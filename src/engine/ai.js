/* ─── AI HELPERS ───────────────────────────────────────────────────────────── */
export async function aiTip(items, occ, w, city, act) {
  const desc = items.map((i) => `${i.n} (${i.col})`).join(", ");
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: `Fashion stylist. Location: ${city || "AU/NZ"}. Activity: ${act || occ}. Weather: ${w}. Outfit: ${desc}. One punchy sentence of styling advice.`,
          },
        ],
      }),
    });
    const d = await r.json();
    return d.content?.[0]?.text?.trim() || "";
  } catch {
    return "";
  }
}

export async function parseURL(url) {
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: `Return ONLY a JSON object with keys: name, brand, color, category, imageUrl. No markdown. URL: ${url}`,
          },
        ],
      }),
    });
    const d = await r.json();
    return JSON.parse(
      d.content?.[0]?.text?.replace(/```json|```/g, "").trim() || "{}"
    );
  } catch {
    return {};
  }
}
