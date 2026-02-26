/* ─── AI HELPERS ─────────────────────────────────────────────────────────────
   All Claude API calls go through /api/ai (server-side proxy).
   The Anthropic API key lives in the environment — never in the browser.
   ─────────────────────────────────────────────────────────────────────────── */

async function callAI(model, max_tokens, messages) {
  const r = await fetch("/api/ai", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ model, max_tokens, messages }),
  });
  if (!r.ok) throw new Error(`AI proxy returned ${r.status}`);
  return r.json();
}

/* ─── Drive image matcher ────────────────────────────────────────────────── */
// Uses Claude to batch-match unimaged wardrobe items to Drive catalog entries
// by name / color / brand similarity.
//
// unimagedItems: Array<{ id, name, category, color, brand }>
// catalog:       Map<fileId, { name, category, color, brand }>
// Returns:       Record<itemId, fileId> — only high-confidence matches
//                Returns {} on any failure (network, parse, no matches).
export async function matchDriveImages(unimagedItems, catalog) {
  try {
    // Build catalog lines (cap at 150 to stay within token budget)
    const catalogLines = [...catalog.entries()]
      .slice(0, 150)
      .map(([fileId, m]) => `${fileId}: "${m.name}" | ${m.category} | ${m.color} | ${m.brand}`)
      .join("\n");

    const itemLines = unimagedItems
      .map((i) => `${i.id}: "${i.name}" | ${i.category} | ${i.color} | ${i.brand}`)
      .join("\n");

    const prompt =
      `You are matching wardrobe items to Drive images by name/color/brand similarity.\n\n` +
      `CATALOG (items WITH Drive images):\n${catalogLines}\n\n` +
      `ITEMS TO MATCH (need images):\n${itemLines}\n\n` +
      `RULES:\n` +
      `- Only match if HIGHLY confident: same brand + same color + very similar name = same physical garment.\n` +
      `- Different brand = no match. If uncertain, omit entirely.\n` +
      `- Return ONLY a valid JSON object: { "<itemId>": "<fileId>", ... }\n` +
      `- If no confident matches exist, return {}`;

    const d = await callAI("claude-sonnet-4-20250514", 1024, [{ role: "user", content: prompt }]);
    const raw = d.content?.[0]?.text?.replace(/```json|```/g, "").trim() || "{}";
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function aiTip(items, occ, w, city, act) {
  const desc = items.map((i) => `${i.n} (${i.col})`).join(", ");
  try {
    const d = await callAI("claude-sonnet-4-20250514", 100, [
      {
        role: "user",
        content: `Fashion stylist. Location: ${city || "AU/NZ"}. Activity: ${act || occ}. Weather: ${w}. Outfit: ${desc}. One punchy sentence of styling advice.`,
      },
    ]);
    return d.content?.[0]?.text?.trim() || "";
  } catch {
    return "";
  }
}

export async function parseURL(url) {
  try {
    const d = await callAI("claude-sonnet-4-20250514", 200, [
      {
        role: "user",
        content: `Return ONLY a JSON object with keys: name, brand, color, category, imageUrl. No markdown. URL: ${url}`,
      },
    ]);
    return JSON.parse(
      d.content?.[0]?.text?.replace(/```json|```/g, "").trim() || "{}"
    );
  } catch {
    return {};
  }
}
