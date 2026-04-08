/* ─── PROFILE API — Cross-device profile photo sync ─────────────────────────
   GET  /api/profile  → returns saved reference photos from KV store
   POST /api/profile  → saves reference photos to KV store

   Uses the same Upstash/Vercel KV backend as /api/outfits.
   Returns 503 gracefully if KV is not configured; client falls back to localStorage.

   Photos are stored as a JSON array of base64 data URIs.
   Max 5 photos × ~250KB compressed = ~1.25MB per user — well within KV limits.
   ─────────────────────────────────────────────────────────────────────────── */

import { requireAuth } from "../lib/auth.js";

export const config = {
  api: { bodyParser: { sizeLimit: "8mb" } },
};

const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const PROFILE_KEY = "wdb_profile_photos_v1";

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([["GET", key]]),
  });
  if (!res.ok) throw new Error(`KV error: ${res.status}`);
  const [entry] = await res.json();
  const val = entry?.result;
  if (!val) return null;
  return typeof val === "string" ? JSON.parse(val) : val;
}

async function kvSet(key, value) {
  const res = await fetch(`${KV_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([["SET", key, JSON.stringify(value)]]),
  });
  return res.ok;
}

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  if (!KV_URL || !KV_TOKEN) {
    return res.status(503).json({ error: "Backend sync not configured", local: true });
  }

  try {
    if (req.method === "GET") {
      const photos = await kvGet(PROFILE_KEY);
      return res.json({ photos: photos || [] });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const { photos } = body || {};
      if (!Array.isArray(photos)) {
        return res.status(400).json({ error: "Invalid photos data: must be an array" });
      }
      if (photos.some((p) => typeof p !== "string")) {
        return res.status(400).json({ error: "Invalid photos data: all entries must be strings" });
      }
      await kvSet(PROFILE_KEY, photos);
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: "Storage error", message: err.message });
  }
}
