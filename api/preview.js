/* ─── POST /api/preview ────────────────────────────────────────────────────────
   Generates a travel-style outfit preview image.

   Tries Gemini image models in order, then falls back to Imagen 4.
   Model order (best quality first, then reliable fallbacks):
     1. gemini-3.1-flash-image-preview   (newest, best)
     2. gemini-3-pro-image-preview       (high quality)
     3. gemini-2.5-flash-image           (fast, reliable)
     4. gemini-2.0-flash-exp-image-generation  (stable fallback)
     5. imagen-4.0-fast-generate-001     (Imagen 4, text-only prompt)

   Uses GEMINI_API_KEY (same key as /api/ai).

   Body: {
     location:        string,
     activity:        string,
     weather:         string,
     outfitDescription: string,
     referencePhotos: string[],    — base64 data URIs from useProfile
     outfitImageUrls: string[],    — absolute URLs for outfit item images
   }
   Response: { imageUrl: string }  — data URI (data:image/...;base64,...)
   ─────────────────────────────────────────────────────────────────────────── */

import { requireAuth } from "../lib/auth.js";

export const maxDuration = 120;

export const config = {
  api: { bodyParser: { sizeLimit: "12mb" } },
};

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/* Gemini models that support generateContent + IMAGE output — tried in order */
const GEMINI_IMAGE_MODELS = [
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview",
  "gemini-2.5-flash-image",
  "gemini-2.0-flash-exp-image-generation",
];

/* ── Helpers ─────────────────────────────────────────────────────────────── */

async function fetchImageAsInlineData(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buffer   = await res.arrayBuffer();
    const base64   = Buffer.from(buffer).toString("base64");
    const mimeType = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
    return { mimeType, data: base64 };
  } catch {
    return null;
  }
}

function dataUriToInlineData(dataUri) {
  const comma = dataUri.indexOf(",");
  if (comma === -1) throw new Error("Invalid data URI");
  const mimeType = dataUri.slice(0, comma).split(":")[1]?.split(";")[0] || "image/jpeg";
  const data     = dataUri.slice(comma + 1);
  return { mimeType, data };
}

/* ── Gemini generateContent with IMAGE modality ─────────────────────────── */
async function tryGeminiModels(apiKey, parts) {
  const errors = [];

  for (const model of GEMINI_IMAGE_MODELS) {
    try {
      const res = await fetch(
        `${BASE}/${model}:generateContent?key=${apiKey}`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents:         [{ role: "user", parts }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
          }),
          signal: AbortSignal.timeout(90_000),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.error?.message || `Error ${res.status}`;
        // Always try next model — quota/not-found/unsupported can all vary per model
        errors.push(`${model}: ${msg}`);
        continue;
      }

      const responseParts = data?.candidates?.[0]?.content?.parts || [];
      for (const part of responseParts) {
        if (part.inlineData?.data) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }

      errors.push(`${model}: no image in response`);
    } catch (err) {
      if (err.name === "TimeoutError") { errors.push(`${model}: timeout`); continue; }
      throw err; // real error — propagate
    }
  }

  return null; // all Gemini models exhausted → caller will try Imagen
}

/* ── Imagen 4 fallback (text-only prompt, no reference photos) ──────────── */
async function tryImagen4(apiKey, prompt) {
  const IMAGEN_MODELS = [
    "imagen-4.0-fast-generate-001",
    "imagen-4.0-generate-001",
  ];

  for (const model of IMAGEN_MODELS) {
    try {
      const res = await fetch(
        `${BASE}/${model}:predict?key=${apiKey}`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances:  [{ prompt }],
            parameters: {
              sampleCount:       1,
              aspectRatio:       "1:1",
              personGeneration:  "allow_adult",
              safetyFilterLevel: "block_some",
            },
          }),
          signal: AbortSignal.timeout(90_000),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error?.message || `Error ${res.status}`;
        if (msg.toLowerCase().includes("not found")) continue;
        throw new Error(`Imagen: ${msg}`);
      }

      const pred = data?.predictions?.[0];
      if (pred?.bytesBase64Encoded) {
        return `data:${pred.mimeType || "image/png"};base64,${pred.bytesBase64Encoded}`;
      }
    } catch (err) {
      if (err.name === "TimeoutError") continue;
      throw err;
    }
  }

  return null;
}

/* ── Main handler ─────────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!requireAuth(req, res)) return;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "GEMINI_API_KEY not configured in Vercel environment variables.",
    });
  }

  const {
    location,
    activity,
    weather,
    outfitDescription,
    referencePhotos  = [],
    outfitImageUrls  = [],
  } = req.body || {};

  if (!location || !outfitDescription) {
    return res.status(400).json({ error: "Missing required fields: location, outfitDescription" });
  }

  const weatherDesc = { Cold: "cold crisp weather", Mild: "mild pleasant weather", Warm: "warm sunny weather" }[weather] || "pleasant weather";
  const activityClause = activity ? `, ${activity}` : "";

  const promptWithFace = [
    `Realistic travel photo of the person shown in the reference photos,`,
    `wearing the exact outfit items provided (${outfitDescription})`,
    `at ${location}${activityClause}, in ${weatherDesc}.`,
    `Natural travel photography, daylight, 35mm lens, full body shot, sharp focus, editorial fashion style.`,
    `Match the person's face and likeness from the reference photos.`,
  ].join(" ");

  const promptNoFace = [
    `Realistic travel fashion photo of a well-dressed South Asian man in his 30s`,
    `wearing ${outfitDescription}`,
    `at ${location}${activityClause}, in ${weatherDesc}.`,
    `Natural daylight, street photography, full body shot, sharp focus, professional travel editorial, 35mm lens.`,
  ].join(" ");

  try {
    /* Build multimodal parts for Gemini */
    const hasPhotos = referencePhotos.length > 0;
    const parts     = [{ text: hasPhotos ? promptWithFace : promptNoFace }];

    if (hasPhotos) {
      for (const dataUri of referencePhotos.slice(0, 3)) {
        try { parts.push({ inlineData: dataUriToInlineData(dataUri) }); } catch { /* skip */ }
      }
    }

    const itemImgs = await Promise.all(outfitImageUrls.slice(0, 4).map(fetchImageAsInlineData));
    for (const img of itemImgs) {
      if (img) parts.push({ inlineData: img });
    }

    /* Try Gemini first (supports reference photos) */
    let imageUrl   = await tryGeminiModels(apiKey, parts);
    let usedFaceRef = !!imageUrl && hasPhotos;

    /* Imagen 4 fallback (text-only, no face reference) */
    if (!imageUrl) {
      imageUrl    = await tryImagen4(apiKey, promptNoFace);
      usedFaceRef = false;
    }

    if (imageUrl) return res.json({ imageUrl, usedFaceRef });

    return res.status(503).json({
      error:
        "Image generation quota exhausted. Your Google AI Studio API key is on the free tier " +
        "(image generation limit = 0). Fix: go to aistudio.google.com → Get API key → " +
        "create a key linked to your billing-enabled Google Cloud project. " +
        "Then update GEMINI_API_KEY in Vercel.",
    });

  } catch (err) {
    console.error("Preview error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
