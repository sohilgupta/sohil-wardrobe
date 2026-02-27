/* ─── OUTFITS API — Cross-device outfit sync ─────────────────────────────────
   GET  /api/outfits  → returns saved outfits from KV store
   POST /api/outfits  → saves outfits to KV store

   Requires Vercel KV or Upstash Redis:
     KV_REST_API_URL   + KV_REST_API_TOKEN    (Vercel KV naming)
     UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN  (direct Upstash naming)

   Returns 503 gracefully if KV is not configured; client falls back to localStorage.
   ─────────────────────────────────────────────────────────────────────────── */

import { requireAuth } from "../lib/auth.js";

const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const OUTFITS_KEY = "wdb_outfits_v1";

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
    // Backend storage not configured — client silently falls back to localStorage
    return res.status(503).json({ error: "Backend sync not configured", local: true });
  }

  try {
    if (req.method === "GET") {
      const outfits = await kvGet(OUTFITS_KEY);
      return res.json({ outfits: outfits || {} });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const { outfits } = body || {};
      if (!outfits || typeof outfits !== "object") {
        return res.status(400).json({ error: "Invalid outfits data" });
      }
      await kvSet(OUTFITS_KEY, outfits);
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: "Storage error", message: err.message });
  }
}
