/* ─── Shared AI trip + outfit utilities ───────────────────────────────────────
   Consumed by:
     - OutfitsTab  → generateTripOutfits  (full trip, 2 batches)
     - TripTab     → generateTripOutfits  (plan all)
     - OutfitTab   → generateSingleOutfit (single ad-hoc outfit)
     - PackTab     → optimizePackingWithAI + countUniqueItems

   All Gemini calls go through /api/ai (server-side key proxy).
   ─────────────────────────────────────────────────────────────────────────── */

import TRIP from "../data/trip";

/* ── Internal: POST to /api/ai ────────────────────────────────────────────── */
async function callAI({ system, userContent, maxTokens = 8000 }) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      (typeof err.error === "string" ? err.error : err.error?.message) ||
      err.message ||
      `API error ${res.status}`;
    throw new Error(msg);
  }
  const data = await res.json();
  return data?.content?.[0]?.text || "";
}

/* ── Robustly extract JSON from raw Gemini text ──────────────────────────── */
function extractJSON(rawText) {
  const s = rawText.indexOf("{");
  const e = rawText.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("Could not parse AI response. Try again.");
  return JSON.parse(rawText.slice(s, e + 1));
}

/* ── Validate a slot object (required fields + ID must exist in validIds set) */
function validateSlot(slot, validIds) {
  if (!slot || typeof slot !== "object") return null;
  const result = {};
  ["base", "mid", "outer", "bottom", "shoes"].forEach((layer) => {
    const id = slot[layer];
    result[layer] = id && validIds.has(id) ? id : null;
  });
  if (!result.base || !result.bottom || !result.shoes) return null;
  return result;
}

/* ── All outfit slot names ─────────────────────────────────────────────────── */
const ALL_OUTFIT_SLOTS = ["daytime", "evening", "breakfast", "sleepwear", "flight", "activity"];

/* ────────────────────────────────────────────────────────────────────────────
   buildTripItemPool — compute the Set of approved item IDs for the trip.

   Pool = (capsule items) ∪ (items in any frozen outfit slot)
   This is the only set of items the AI generators are allowed to use.

   Falls back to null (= full wardrobe) if pool is too small (< 8 items).
   ─────────────────────────────────────────────────────────────────────────── */
export function buildTripItemPool({ wardrobe, capsuleIds, outfitIds = {}, frozenDays = {} }) {
  const poolIds = new Set();

  // 1. Items in the trip capsule
  if (capsuleIds) {
    capsuleIds.forEach((id) => poolIds.add(id));
  }

  // 2. Items in any frozen outfit slot (= packing list items)
  Object.entries(outfitIds).forEach(([dayId, dayData]) => {
    if (!frozenDays[dayId] || !dayData) return;
    ALL_OUTFIT_SLOTS.forEach((slot) => {
      const slotIds = dayData[slot];
      if (!slotIds) return;
      Object.values(slotIds).forEach((id) => {
        if (id && id !== "REMOVED") poolIds.add(id);
      });
    });
  });

  // Return null if pool is too small to reliably generate complete outfits
  return poolIds.size >= 8 ? poolIds : null;
}

/* ── Build compact wardrobe text — restricted to TripItemPool when available */
function buildWardrobeText(wardrobe, tripItemPool) {
  if (tripItemPool && tripItemPool.size > 0) {
    const pool = wardrobe.filter((i) => tripItemPool.has(i.id));
    if (pool.length >= 8) {
      return pool.map((i) => `${i.id}|${i.n}|${i.l || "?"}|${i.col}|${i.c}`).join("\n");
    }
  }
  // Fallback: prefer travel-ready items, then full wardrobe
  const travelItems = wardrobe.filter((i) => i.t === "Yes");
  const pool = travelItems.length >= 15 ? travelItems : wardrobe;
  return pool.map((i) => `${i.id}|${i.n}|${i.l || "?"}|${i.col}|${i.c}`).join("\n");
}

/* ── Shared constants ─────────────────────────────────────────────────────── */
const SYSTEM_STYLIST =
  "You are a personal travel stylist. Output ONLY valid JSON with no markdown, code blocks, or explanation. Never invent item IDs — use only exact IDs from the provided catalog.";

const OUTFIT_RULES = `GENERATION RULES:
1. Weather → Layers: Cold = base + mid + outer; Mild = base + outer (optional); Warm = base only (mid/outer optional)
2. Occasion → Style: Flight = comfort + practical; Active/Hiking = functional + layered; Dinner = elevated + polished; Casual = relaxed
3. Minimize unique items — reuse items across multiple days as much as possible
4. Never repeat the exact same complete outfit on consecutive days
5. Evening outfits can share bottom and shoes with daytime but change the base layer
6. Layer field meaning: Base = base slot; Mid = mid slot; Outer = outer slot; Bottom = bottom slot; Footwear = shoes slot
7. Only use IDs that appear exactly in the catalog above`;

const EXAMPLE_OUTPUT = `Output ONLY a JSON object — no markdown, no code blocks, no explanation:
{
  "d01": {
    "daytime": {"base":"ITEM_ID","mid":"ITEM_ID_OR_NULL","outer":"ITEM_ID_OR_NULL","bottom":"ITEM_ID","shoes":"ITEM_ID"},
    "evening": {"base":"ITEM_ID","mid":null,"outer":null,"bottom":"ITEM_ID","shoes":"ITEM_ID"}
  }
}`;

/* ────────────────────────────────────────────────────────────────────────────
   countUniqueItems — count distinct item IDs across all outfit slots
   ─────────────────────────────────────────────────────────────────────────── */
export function countUniqueItems(outfitIds) {
  const ids = new Set();
  Object.values(outfitIds).forEach((dayData) => {
    if (!dayData) return;
    ALL_OUTFIT_SLOTS.forEach((slot) => {
      const slotIds = dayData[slot];
      if (!slotIds) return;
      Object.values(slotIds).forEach((id) => {
        if (id && id !== "REMOVED") ids.add(id);
      });
    });
  });
  return ids.size;
}

/* ────────────────────────────────────────────────────────────────────────────
   generateTripOutfits — full trip generation in 2 sequential batches.

   Now uses TripItemPool to restrict generation to approved items only:
     Pool = capsule items ∪ items in frozen outfit slots

   Parameters:
     wardrobe      — full wardrobe array
     frozenDays    — { [dayId]: boolean }
     setOutfitIds  — React state setter from useOutfits
     outfitIds     — current outfit state (needed to compute tripItemPool)
     capsuleIds    — Set<itemId> from useCapsule
     onBatchDone   — optional callback after each batch (for progress updates)
   Returns:        number of days generated
   ─────────────────────────────────────────────────────────────────────────── */
export async function generateTripOutfits({ wardrobe, frozenDays, setOutfitIds, onBatchDone, capsuleIds, outfitIds }) {
  // Build Trip Item Pool — restricts AI to approved items only
  const tripItemPool = buildTripItemPool({
    wardrobe,
    capsuleIds,
    outfitIds: outfitIds || {},
    frozenDays,
  });

  const wardrobeText = buildWardrobeText(wardrobe, tripItemPool);
  // Validate returned IDs against the same pool (falls back to full wardrobe if pool was too small)
  const validIds = tripItemPool || new Set(wardrobe.map((i) => i.id));

  const daysToGen = TRIP.filter((d) => !frozenDays[d.id]);
  if (daysToGen.length === 0)
    throw new Error("All days are frozen. Unfreeze some days first.");

  const poolNote = tripItemPool
    ? `\nIMPORTANT: The catalog above contains ONLY your approved trip items. Use ONLY these IDs.`
    : "";

  const applyParsed = (parsed) => {
    setOutfitIds((prev) => {
      const next = { ...prev };
      Object.entries(parsed).forEach(([dayId, dayData]) => {
        if (frozenDays[dayId]) return;
        const dt = validateSlot(dayData?.daytime, validIds);
        const ev = validateSlot(dayData?.evening, validIds);
        if (dt) {
          // Preserve any existing optional slots (breakfast/sleepwear/flight/activity)
          next[dayId] = { ...(next[dayId] || {}), daytime: dt, evening: ev };
        }
      });
      return next;
    });
  };

  const callBatch = async (batchDays) => {
    const tripText = batchDays
      .map(
        (d) =>
          `${d.id}: ${d.city} | ${d.date} | Weather: ${d.w} | Day: ${d.day || d.occ} | Evening: ${
            d.night || "Casual"
          }`
      )
      .join("\n");

    const prompt = `WARDROBE CATALOG (ID|Name|Layer|Color|Category):\n${wardrobeText}\n${poolNote}\n\nTRIP SCHEDULE:\n${tripText}\n\n${OUTFIT_RULES}\n\nGenerate outfits for ALL days listed above.\n\n${EXAMPLE_OUTPUT}`;
    const rawText = await callAI({ system: SYSTEM_STYLIST, userContent: prompt, maxTokens: 8000 });
    const parsed = extractJSON(rawText);
    applyParsed(parsed);
    if (onBatchDone) onBatchDone();
  };

  const mid = Math.ceil(daysToGen.length / 2);
  await callBatch(daysToGen.slice(0, mid));
  await callBatch(daysToGen.slice(mid));

  return daysToGen.length;
}

/* ────────────────────────────────────────────────────────────────────────────
   generateSingleOutfit — one outfit for given occasion / weather / context.
   Now restricted to TripItemPool when available.
   Returns { base, mid, outer, bottom, shoes } with validated IDs (or null)
   ─────────────────────────────────────────────────────────────────────────── */
export async function generateSingleOutfit({ wardrobe, occ, weather, city, act, capsuleIds, outfitIds, frozenDays }) {
  // Build Trip Item Pool
  const tripItemPool = buildTripItemPool({
    wardrobe,
    capsuleIds,
    outfitIds: outfitIds || {},
    frozenDays: frozenDays || {},
  });

  const wardrobeText = buildWardrobeText(wardrobe, tripItemPool);
  const validIds = tripItemPool || new Set(wardrobe.map((i) => i.id));

  const poolNote = tripItemPool
    ? `\nIMPORTANT: Use ONLY the approved trip items listed in the catalog above.`
    : "";

  const contextLines = [
    `Occasion: ${occ}`,
    `Weather: ${weather}`,
    city && `Location: ${city}`,
    act  && `Activity: ${act}`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `WARDROBE CATALOG (ID|Name|Layer|Color|Category):
${wardrobeText}
${poolNote}
CONTEXT:
${contextLines}

RULES:
1. Cold = base + mid + outer; Mild = base (outer optional); Warm = base only
2. Dinner / smart casual = polished; Casual = relaxed; Flight = comfortable; Hiking = practical
3. Only use IDs that appear exactly in the catalog
4. Use null for optional layers you choose not to include

Output ONLY a single JSON object (no markdown, no code blocks):
{"base":"ITEM_ID","mid":"ITEM_ID_OR_NULL","outer":"ITEM_ID_OR_NULL","bottom":"ITEM_ID","shoes":"ITEM_ID"}`;

  const rawText = await callAI({ system: SYSTEM_STYLIST, userContent: prompt, maxTokens: 2000 });
  const parsed = extractJSON(rawText);

  // Validate all IDs against Trip Item Pool (or full wardrobe as fallback)
  const result = {};
  ["base", "mid", "outer", "bottom", "shoes"].forEach((layer) => {
    const id = parsed[layer];
    result[layer] = id && validIds.has(id) ? id : null;
  });

  if (!result.base && !result.bottom && !result.shoes) {
    throw new Error("AI returned an invalid outfit. Try again.");
  }
  return result;
}

/* ────────────────────────────────────────────────────────────────────────────
   generateCapsuleWithAI — selects ~20–35 versatile items for the trip capsule.
   Takes the full wardrobe (so the AI can consider all options) and returns an
   array of item IDs chosen for maximum versatility, layering, and efficiency.

   Parameters:
     wardrobe      — full wardrobe array
     frozenItemIds — Set<itemId> of items already in frozen outfits (protected)
   These frozen-outfit items are ALWAYS included in the result; the AI is asked
   to suggest additional items and remove unnecessary duplicates around them.
   ─────────────────────────────────────────────────────────────────────────── */
export async function generateCapsuleWithAI({ wardrobe, frozenItemIds = new Set() }) {
  if (wardrobe.length === 0) throw new Error("Wardrobe is empty.");

  // Build a richer per-item description including weather tag
  const allItemsText = wardrobe
    .map((i) => `${i.id}|${i.n}|${i.l || "?"}|${i.col}|${i.c}|${i.w || "?"}`)
    .join("\n");

  // Summarise trip weather + activities from TRIP data
  const tripSummary = TRIP
    .map((d) => `${d.date}: ${d.city}, Weather: ${d.w}, Day: ${d.day || d.occ}, Evening: ${d.night || "Casual"}`)
    .join("\n");

  // List frozen items that must be preserved
  const frozenList = wardrobe
    .filter((i) => frozenItemIds.has(i.id))
    .map((i) => `${i.id}|${i.n}|${i.l || "?"}`)
    .join("\n");

  const SYSTEM_CAPSULE =
    "You are an expert travel packing consultant. Output ONLY valid JSON with no markdown, code blocks, or explanation. Never invent item IDs — use only exact IDs from the provided catalog.";

  const frozenSection = frozenItemIds.size > 0
    ? `\nPROTECTED ITEMS (already in frozen outfits — MUST be included in capsuleIds):\n${frozenList}\n`
    : "";

  const targetRange = frozenItemIds.size > 0
    ? "Aim for 20–35 total items (including all protected items above)."
    : "Select 25–35 versatile items.";

  const prompt = `FULL WARDROBE (ID|Name|Layer|Color|Category|Weather):
${allItemsText}

TRIP SCHEDULE:
${tripSummary}
${frozenSection}
TASK: ${targetRange} Form a complete travel capsule for this specific trip.

SELECTION RULES:
1. Always include ALL protected items listed above
2. Cover all weather conditions present in the trip schedule
3. Include items for all activity types (hiking, dinner, casual, flights, shows)
4. Ensure layering coverage: at least 3 base layers, 2 mid layers, 2 outer layers
5. Include at least 2 bottoms, 2–3 pairs of shoes
6. Prioritize items that work across multiple occasions
7. Prefer neutral colors for versatility; a few accent pieces are fine
8. Remove unnecessary duplicates — prefer versatile items over single-use ones
9. Only use exact IDs from the catalog above

Output ONLY a JSON object:
{"capsuleIds": ["ID1", "ID2", "ID3"]}`;

  const rawText = await callAI({ system: SYSTEM_CAPSULE, userContent: prompt, maxTokens: 2000 });
  const parsed = extractJSON(rawText);

  if (!Array.isArray(parsed.capsuleIds)) {
    throw new Error("AI returned invalid capsule format. Try again.");
  }

  const validIds = new Set(wardrobe.map((i) => i.id));
  const aiIds = parsed.capsuleIds.filter((id) => validIds.has(id));

  // Frozen items are always included regardless of what the AI returned
  const finalIds = [...new Set([...frozenItemIds, ...aiIds])];
  return finalIds;
}

/* ────────────────────────────────────────────────────────────────────────────
   optimizePackingWithAI — re-assigns items across all planned days to minimize
   the total unique item count (frozen days are never changed).
   Returns { beforeCount, afterCount, proposed } where proposed is a new
   outfitIds object ready to be applied via setOutfitIds.
   ─────────────────────────────────────────────────────────────────────────── */
export async function optimizePackingWithAI({ wardrobe, outfitIds, frozenDays = {} }) {
  const plannedEntries = Object.entries(outfitIds).filter(
    ([, d]) => d && (d.daytime || d.evening)
  );
  if (plannedEntries.length === 0)
    throw new Error("No planned outfits found to optimize.");

  const beforeCount = countUniqueItems(outfitIds);
  const wardrobeText = buildWardrobeText(wardrobe, null);
  const wardrobeIds = new Set(wardrobe.map((i) => i.id));

  // Current outfit assignments text — locked days clearly marked
  const currentText = plannedEntries
    .map(([dayId, dayData]) => {
      const tripDay = TRIP.find((d) => d.id === dayId);
      const locked = frozenDays[dayId] ? " [LOCKED — do not change]" : "";
      const label = tripDay
        ? `${dayId} (${tripDay.city}, ${tripDay.w})${locked}`
        : `${dayId}${locked}`;

      const fmtSlot = (slotIds) => {
        if (!slotIds) return "null";
        return (
          `base=${slotIds.base || "null"} ` +
          `mid=${slotIds.mid || "null"} ` +
          `outer=${slotIds.outer || "null"} ` +
          `bottom=${slotIds.bottom || "null"} ` +
          `shoes=${slotIds.shoes || "null"}`
        );
      };

      return `${label}:\n  daytime: ${fmtSlot(dayData.daytime)}\n  evening: ${fmtSlot(
        dayData.evening
      )}`;
    })
    .join("\n");

  const SYSTEM =
    "You are a travel packing optimizer. Output ONLY valid JSON with no markdown or explanation. Never invent item IDs — only use exact IDs from the catalog.";

  const prompt = `WARDROBE CATALOG (ID|Name|Layer|Color|Category):
${wardrobeText}

CURRENT OUTFIT ASSIGNMENTS:
${currentText}

TASK: Re-assign outfit items to MINIMIZE the total number of unique items across all non-locked days.
Rules:
1. Do NOT change days marked [LOCKED]
2. Keep outfit structure (daytime + evening per day exactly as it currently exists)
3. Reuse items across as many days as possible to minimize total packing
4. Never repeat the exact same complete outfit on consecutive days
5. Cold weather days still need base + mid + outer
6. Only use IDs from the catalog above
7. Use null for any slot that is currently null

Output ONLY a JSON object with ALL planned days (same structure as input, even for LOCKED days):
{
  "d01": {
    "daytime": {"base":"ID","mid":"ID_OR_NULL","outer":"ID_OR_NULL","bottom":"ID","shoes":"ID"},
    "evening": {"base":"ID","mid":null,"outer":null,"bottom":"ID","shoes":"ID"}
  }
}`;

  const rawText = await callAI({ system: SYSTEM, userContent: prompt, maxTokens: 8000 });
  const parsed = extractJSON(rawText);

  // Build proposed outfitIds — never override frozen days
  const proposed = { ...outfitIds };
  Object.entries(parsed).forEach(([dayId, dayData]) => {
    if (frozenDays[dayId]) return; // never touch frozen days
    const existing = outfitIds[dayId];
    if (!existing) return; // don't add new days

    const dt = validateSlot(dayData?.daytime, wardrobeIds);
    const ev = validateSlot(dayData?.evening, wardrobeIds);

    proposed[dayId] = {
      daytime: dt || existing.daytime,
      evening: ev || existing.evening,
    };
  });

  const afterCount = countUniqueItems(proposed);
  return { beforeCount, afterCount, proposed };
}
