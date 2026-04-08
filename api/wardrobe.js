/* ─── GET /api/wardrobe ──────────────────────────────────────────────────────
   Server-side proxy for the Google Sheets wardrobe data.
   Returns raw gviz JSON text for each tab — client parses it.
   Requires a valid Supabase JWT in the Authorization header.
   ─────────────────────────────────────────────────────────────────────────── */

import { createClient } from "@supabase/supabase-js";

const TABS = [
  "Jackets",
  "Shoes",
  "Sweaters",
  "Thermals",
  "Shirts",
  "Gym Tshirts",
  "Bottoms",
];

const supabaseUrl      = process.env.SUPABASE_URL      || process.env.VITE_SUPABASE_URL;
const supabaseKey      = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseAdmin    = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

async function requireSupabaseAuth(req, res) {
  const token = req.headers.authorization?.replace("Bearer ", "").trim();
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return false; }
  if (!supabaseAdmin) { res.status(503).json({ error: "Auth not configured" }); return false; }
  const { error } = await supabaseAdmin.auth.getUser(token);
  if (error) { res.status(401).json({ error: "Unauthorized" }); return false; }
  return true;
}

export default async function handler(req, res) {
  if (!await requireSupabaseAuth(req, res)) return;

  const sheetId = process.env.SHEET_ID;
  if (!sheetId) {
    return res.status(500).json({ error: "SHEET_ID environment variable is not set" });
  }

  const results = await Promise.allSettled(
    TABS.map(async (tab) => {
      const url =
        `https://docs.google.com/spreadsheets/d/${sheetId}` +
        `/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(tab)}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Tab "${tab}" HTTP ${response.status}`);

      const text = await response.text();
      if (text.includes("accounts.google.com")) {
        throw new Error(`Tab "${tab}" requires Google auth — sheet must be publicly shared`);
      }

      return { tab, text };
    })
  );

  const data = {};
  let successCount = 0;

  for (const r of results) {
    if (r.status === "fulfilled") {
      data[r.value.tab] = r.value.text;
      successCount++;
    } else {
      console.error("Tab fetch error:", r.reason?.message);
    }
  }

  if (successCount === 0) {
    return res.status(502).json({ error: "All wardrobe tabs failed to load" });
  }

  // Private cache: 5 minutes (avoids hammering Google on every page load)
  res.setHeader("Cache-Control", "private, max-age=300");
  return res.status(200).json(data);
}
