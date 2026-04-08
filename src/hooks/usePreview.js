/* ─── usePreview — Outfit preview cache + generation ─────────────────────────
   Caches generated preview images in localStorage.
   Cache key: `{dayId}_{slot}_{outfitItemHash}` — content-addressed, so
   changing the outfit automatically invalidates the cached preview.

   Cache entry shape: { url: string, faceRef: bool }
     • url     — base64 data URI of the generated image
     • faceRef — true if Gemini generated with reference photos, false if
                 Imagen fallback was used (no face conditioning)

   Optimizations:
     • Cache always checked before calling /api/preview
     • MAX_CACHED=8 cap — oldest entry evicted on write
     • Rate-limited (preview bucket: 10 calls/min)
     • All calls logged via aiLogger
     • In-flight guard prevents duplicate requests for the same key
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useCallback } from "react";
import { enforceRateLimit }     from "../utils/aiRateLimit";
import { logAICall }            from "../utils/aiLogger";

const CACHE_KEY  = "wdb_previews_v2";
const MAX_CACHED = 8;

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(cache) {
  // Enforce entry cap — keep the MAX_CACHED most recently inserted entries
  const entries = Object.entries(cache);
  const trimmed = entries.length > MAX_CACHED
    ? Object.fromEntries(entries.slice(entries.length - MAX_CACHED))
    : cache;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full — evict oldest half and retry
    try {
      const half = Object.fromEntries(entries.slice(Math.floor(entries.length / 2)));
      localStorage.setItem(CACHE_KEY, JSON.stringify(half));
    } catch {
      localStorage.removeItem(CACHE_KEY);
    }
  }
}

// Stable hash of a slot's item IDs — changes when outfit changes, invalidating the cache
export function outfitSlotHash(slotIds) {
  if (!slotIds) return "empty";
  return ["base", "mid", "outer", "thermalBottom", "bottom", "shoes"]
    .map((k) => slotIds[k] || "")
    .join("_");
}

export function buildPreviewKey(dayId, slot, slotIds) {
  return `${dayId}_${slot}_${outfitSlotHash(slotIds)}`;
}

export default function usePreview() {
  const [cache, setCache]   = useState(loadCache);
  const [generating, setGen] = useState({});  // { [key]: true }

  /** Returns the URL string for a cached preview, or null. */
  const getPreview = useCallback((key) => cache[key]?.url || null, [cache]);

  /** Returns { url, faceRef } for a cached preview, or null. */
  const getPreviewData = useCallback((key) => cache[key] || null, [cache]);

  const setPreview = useCallback((key, imageUrl, faceRef = true) => {
    setCache((prev) => {
      const next = { ...prev, [key]: { url: imageUrl, faceRef } };
      saveCache(next);
      return next;
    });
  }, []);

  const clearPreview = useCallback((key) => {
    setCache((prev) => {
      const next = { ...prev };
      delete next[key];
      saveCache(next);
      return next;
    });
  }, []);

  // Generate via /api/preview, cache result.
  // Optimization #8: checks cache first, rate-limits, prevents duplicate in-flight requests.
  const generatePreview = useCallback(async ({
    key,
    location,
    activity,
    weather,
    slotIds,
    wardrobe,
    referencePhotos = [],
  }) => {
    // Already generating this key — prevent duplicate request
    if (generating[key]) return null;

    // Cache hit — no API call needed
    const existing = loadCache()[key];
    if (existing) {
      logAICall({ featureType: "outfitPreview", cached: true });
      return existing;
    }

    // Rate limit check (throws with user-friendly message if exceeded)
    enforceRateLimit("preview");

    setGen((prev) => ({ ...prev, [key]: true }));

    try {
      const resolve = (id) => {
        if (!id || id === "REMOVED") return null;
        return wardrobe.find((i) => i.id === id) || null;
      };

      const items = ["base", "mid", "outer", "thermalBottom", "bottom", "shoes"]
        .map((k) => resolve(slotIds?.[k]))
        .filter(Boolean);

      const outfitDescription = items
        .map((i) => [i.col, i.n, i.b ? `by ${i.b}` : ""].filter(Boolean).join(" "))
        .join(", ");

      // Outfit item image URLs — made absolute so the server can fetch them
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const outfitImageUrls = items
        .map((i) => i.img)
        .filter(Boolean)
        .map((url) => (url.startsWith("http") ? url : `${origin}${url}`));

      const res = await fetch("/api/preview", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location,
          activity,
          weather,
          outfitDescription,
          referencePhotos,
          outfitImageUrls,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview generation failed");

      logAICall({ featureType: "outfitPreview", prompt: outfitDescription, result: "[image]" });
      const faceRef = data.usedFaceRef ?? true;
      setPreview(key, data.imageUrl, faceRef);
      return { imageUrl: data.imageUrl, faceRef };

    } finally {
      setGen((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }, [generating, setPreview]);

  return {
    getPreview,
    getPreviewData,
    setPreview,
    clearPreview,
    generatePreview,
    isGenerating: (key) => !!generating[key],
    // expose raw cache for ExportModal / DayExportModal
    cache,
  };
}
