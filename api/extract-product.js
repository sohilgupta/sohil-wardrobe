/* ─── POST /api/extract-product ──────────────────────────────────────────────
   Validates a product URL, fetches its HTML, and runs a 3-stage extraction
   pipeline:
     Stage 1 — OG tags + JSON-LD  (zero AI cost)
     Stage 2 — Gemini Flash Lite  (~200 tokens, meta/title only)
     Stage 3 — Gemini Flash       (~2000 tokens, first 8KB body text)
   Returns normalised wardrobe item fields on 200, partial data on 422.
   No auth required — IP rate-limited at 5 req/min per IP.
   ─────────────────────────────────────────────────────────────────────────── */

export const maxDuration = 20; // 5s fetch + two sequential Gemini calls

/* ─── IP rate limiting ───────────────────────────────────────────────────── */
// Module-level Map — persists across warm invocations on the same Vercel instance
const ipMap = new Map(); // ip → { count, resetAt }
const LIMIT = 5;
const WINDOW_MS = 60_000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = ipMap.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + WINDOW_MS;
  }
  if (entry.count >= LIMIT) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  ipMap.set(ip, entry);
  return { allowed: true };
}

/* ─── URL validation ─────────────────────────────────────────────────────── */
const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^::1$/,
  /^0\.0\.0\.0$/,
];

function validateUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { return null; }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  if (BLOCKED_HOSTS.some((re) => re.test(url.hostname))) return null;
  return url.toString();
}

/* ─── Category / layer mapping ───────────────────────────────────────────── */
const LAYER_MAP = [
  { pattern: /t-?shirt|tee|shirt|blouse|top|polo/i,        l: "Base",     c: "Shirts"   },
  { pattern: /sweater|sweatshirt|hoodie|knit|pullover/i,    l: "Mid",      c: "Knitwear" },
  { pattern: /jacket|coat|blazer|parka|bomber|gilet/i,      l: "Outer",    c: "Jackets"  },
  { pattern: /jean|trouser|chino|pant|short|skirt|bottom/i, l: "Bottom",   c: "Trousers" },
  { pattern: /shoe|sneaker|boot|loafer|sandal|trainer/i,    l: "Footwear", c: "Footwear" },
];

function mapCategory(raw) {
  if (!raw) return { l: "Base", c: "Shirts" };
  const entry = LAYER_MAP.find((e) => e.pattern.test(raw));
  return entry ? { l: entry.l, c: entry.c } : { l: "Base", c: "Shirts" };
}

/* ─── HTML parsers ───────────────────────────────────────────────────────── */
function parseOgTags(html) {
  const result = {};
  for (const [tag] of html.matchAll(/<meta[^>]+>/gi)) {
    const prop    = (tag.match(/property=["']([^"']+)["']/i) || [])[1];
    const name    = (tag.match(/name=["']([^"']+)["']/i) || [])[1];
    const content = (tag.match(/content=["']([^"']+)["']/i) || [])[1];
    if (!content) continue;
    const key = prop || name || "";
    if (key === "og:title")                              result.name  = result.name  || content;
    if (key === "og:image" || key === "og:image:secure_url") result.image = result.image || content;
    if (key === "og:description")                        result.description = content;
  }
  if (!result.name) {
    const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (m) result.name = m[1].trim();
  }
  return result;
}

function parseJsonLd(html) {
  const result = {};
  for (const [, json] of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    let data;
    try { data = JSON.parse(json); } catch { continue; }
    const items = Array.isArray(data) ? data : [data];
    for (const item of items) {
      if (item["@type"] !== "Product") continue;
      if (item.name)        result.name  = result.name  || item.name;
      if (item.brand?.name) result.brand = result.brand || item.brand.name;
      if (item.color)       result.color = result.color || item.color;
      const img = Array.isArray(item.image) ? item.image[0] : item.image;
      if (img)              result.image = result.image || img;
      const cat = item.category || item.productType;
      if (cat && !result.l) {
        const { l, c } = mapCategory(cat);
        result.l = l;
        result.c = result.c || c;
      }
    }
  }
  return result;
}

function isSufficient(obj) {
  return !!(obj.name && (obj.color || obj.l));
}

/* ─── Text extraction for Gemini ─────────────────────────────────────────── */
function extractMetaText(html) {
  const parts = [];
  const titleM = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleM) parts.push("Title: " + titleM[1].trim());
  for (const [tag] of html.matchAll(/<meta[^>]+>/gi)) {
    const content = (tag.match(/content=["']([^"']+)["']/i) || [])[1];
    if (content && content.length > 3) parts.push(content);
  }
  return parts.join("\n").slice(0, 2000);
}

function extractBodyText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

/* ─── Gemini API call ────────────────────────────────────────────────────── */
const GEMINI_PROMPT = `Extract product details from this page content.
Return JSON only (no markdown, no explanation): { "name": string, "brand": string, "color": string, "category": string }
- name: the clothing item name (e.g. "Black Bomber Jacket")
- brand: fashion brand name (e.g. "Zara")
- color: simple color name (e.g. "Black", "Navy", "Beige")
- category: clothing type keyword used for layer mapping (e.g. "bomber jacket", "slim jeans", "polo shirt")
Use empty string "" for any field you cannot determine.`;

async function callGemini(apiKey, model, userText) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${GEMINI_PROMPT}\n\n---\n\n${userText}` }] }],
        generationConfig: { maxOutputTokens: 256, thinkingConfig: { thinkingBudget: 0 } },
      }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const part = parts.find((p) => !p.thought) || parts[0];
  if (!part?.text) return null;
  const raw = part.text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(raw); } catch { return null; }
}

function mergeGemini(base, gemini) {
  if (!gemini) return base;
  const m = { ...base };
  if (!m.name  && gemini.name)     m.name  = gemini.name;
  if (!m.brand && gemini.brand)    m.brand = gemini.brand;
  if (!m.color && gemini.color)    m.color = gemini.color;
  if (!m.l     && gemini.category) {
    const { l, c } = mapCategory(gemini.category);
    m.l = l;
    m.c = m.c || c;
  }
  return m;
}

/* ─── Response builders ─────────────────────────────────────────────────── */
function buildResponse(result, productUrl, via) {
  const { l, c } = result.l ? { l: result.l, c: result.c } : mapCategory(result.name || "");
  return {
    name:       result.name  || "",
    brand:      result.brand || "",
    color:      result.color || "",
    l,
    c:          c || "Shirts",
    image:      result.image || null,
    productUrl,
    _source:    "url_import",
    _via:       via,
  };
}

function buildPartial(result) {
  const p = {};
  if (result.name)  p.name  = result.name;
  if (result.brand) p.brand = result.brand;
  if (result.color) p.color = result.color;
  if (result.l)     p.l     = result.l;
  if (result.c)     p.c     = result.c;
  if (result.image) p.image = result.image;
  return p;
}

/* ─── Main handler ───────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // IP rate limit
  const rawIp = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
  const ip = rawIp.split(",")[0].trim();
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return res.status(429).json({ error: `Rate limit. Retry after ${rl.retryAfter} seconds.` });
  }

  // Validate URL
  const { url: rawUrl } = req.body || {};
  if (!rawUrl) return res.status(400).json({ error: "Missing url" });
  const cleanUrl = validateUrl(rawUrl);
  if (!cleanUrl) return res.status(400).json({ error: "Invalid URL" });

  // Fetch HTML (5s timeout, 150KB max)
  let html = "";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const fetchRes = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept":          "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    const buf = await fetchRes.arrayBuffer();
    html = new TextDecoder().decode(buf.slice(0, 150 * 1024));
  } catch {
    return res.status(422).json({ error: "Could not fetch product page", partial: {} });
  }

  // Stage 1: OG + JSON-LD (zero AI cost)
  const og = parseOgTags(html);
  const ld = parseJsonLd(html);
  let result = {
    name:  ld.name  || og.name  || "",
    brand: ld.brand || "",
    color: ld.color || "",
    l:     ld.l     || "",
    c:     ld.c     || "",
    image: ld.image || og.image || null,
  };
  if (isSufficient(result)) {
    return res.status(200).json(buildResponse(result, cleanUrl, "og"));
  }

  // Stage 2: Gemini Flash Lite (~200 tokens — meta + title only)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // No key configured — return whatever Stage 1 found
    return res.status(422).json({ error: "Partial extraction — Gemini not configured", partial: buildPartial(result) });
  }

  const metaText = extractMetaText(html);
  result = mergeGemini(result, await callGemini(apiKey, "gemini-2.0-flash-lite", metaText));
  if (isSufficient(result)) {
    return res.status(200).json(buildResponse(result, cleanUrl, "gemini-b"));
  }

  // Stage 3: Gemini Flash (~2000 tokens — first 8KB of body text)
  const bodyText = extractBodyText(html);
  result = mergeGemini(result, await callGemini(apiKey, "gemini-2.0-flash", bodyText));
  if (isSufficient(result)) {
    return res.status(200).json(buildResponse(result, cleanUrl, "gemini-a"));
  }

  // All stages exhausted
  return res.status(422).json({
    error: "Couldn't extract all product details",
    partial: buildPartial(result),
  });
}
