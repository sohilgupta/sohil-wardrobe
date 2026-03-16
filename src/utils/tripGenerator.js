/* ─── Shared AI trip + outfit utilities ───────────────────────────────────────
   Consumed by:
     - OutfitsTab  → generateTripOutfits  (full trip, 2 batches)
     - TripTab     → generateTripOutfits  (plan all)
     - OutfitTab   → generateSingleOutfit (single ad-hoc outfit)
     - PackTab     → optimizePackingWithAI + countUniqueItems

   All Gemini calls go through /api/ai (server-side key proxy).

   Optimizations applied:
     1. Skip already-generated days (no forced re-call by default)
     2. Batch generation: multiple days per request
     3. Cache results — same inputs → no API call
     4. Trip Item Pool: send only capsule/frozen items, not full wardrobe
     5. Compact wardrobe format (truncated names, minimal fields)
     6. Rate limiting (text bucket: 5 calls / min)
     7. Logging every AI call (including cache hits)
   ─────────────────────────────────────────────────────────────────────────── */

import TRIP from "../data/trip";
import { getCached, setCached, inputHash }  from "./aiCache";
import { enforceRateLimit }                 from "./aiRateLimit";
import { logAICall }                        from "./aiLogger";

/* ── Internal: POST to /api/ai ─────────────────────────────────────────────── */
async function callAI({ system, userContent, maxTokens = 8000, featureType = "unknown" }) {
  enforceRateLimit("text");

  const res = await fetch("/api/ai", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model:      "gemini-2.5-flash",
      max_tokens: maxTokens,
      system,
      messages:   [{ role: "user", content: userContent }],
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

  const data   = await res.json();
  const result = data?.content?.[0]?.text || "";

  logAICall({ featureType, prompt: userContent, result });
  return result;
}

/* ── Robustly extract JSON from raw Gemini text ───────────────────────────── */
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

/* ── All outfit slot names ──────────────────────────────────────────────────── */
const ALL_OUTFIT_SLOTS = ["daytime", "evening", "breakfast", "sleepwear", "flight", "activity"];

/* ────────────────────────────────────────────────────────────────────────────
   buildTripItemPool — compute the Set of approved item IDs for the trip.

   Pool = (capsule items) ∪ (items in any frozen outfit slot)
   Falls back to null (= full wardrobe) if pool is too small (< 8 items).
   ─────────────────────────────────────────────────────────────────────────── */
export function buildTripItemPool({ wardrobe, capsuleIds, outfitIds = {}, frozenDays = {} }) {
  const poolIds = new Set();

  if (capsuleIds) capsuleIds.forEach((id) => poolIds.add(id));

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

  return poolIds.size >= 8 ? poolIds : null;
}

/* ── Build compact wardrobe text — restricted to TripItemPool when available
   Optimization #3+#5: use only approved items, truncate names to save tokens  */
function buildWardrobeText(wardrobe, tripItemPool) {
  // Format: id|name(≤18 chars)|layer|color|category
  const fmt = (i) =>
    `${i.id}|${i.n.slice(0, 18)}|${i.l || "?"}|${i.col}|${i.c}`;

  if (tripItemPool && tripItemPool.size > 0) {
    const pool = wardrobe.filter((i) => tripItemPool.has(i.id));
    if (pool.length >= 8) return pool.map(fmt).join("\n");
  }

  // Fallback: prefer travel-ready items, then full wardrobe
  const travelItems = wardrobe.filter((i) => i.t === "Yes");
  const pool = travelItems.length >= 15 ? travelItems : wardrobe;
  return pool.map(fmt).join("\n");
}

/* ── Shared constants ───────────────────────────────────────────────────────── */
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
   countUniqueItems — count distinct item IDs across all outfit slots.
   Deterministic — no AI needed.
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

   Optimization #1: Only generates days without existing outfits by default.
   Pass force:true to regenerate all non-frozen days regardless.

   Optimization #2: Sends all days in a batch — 2 batches for the full trip.

   Optimization #3: Caches each batch result keyed by (wardrobeText + tripText).
   Subsequent calls with unchanged inputs return the cached result instantly.

   Parameters:
     wardrobe      — full wardrobe array
     frozenDays    — { [dayId]: boolean }
     outfitIds     — current outfit state (used to skip already-generated days)
     setOutfitIds  — React state setter from useOutfits
     capsuleIds    — Set<itemId> from useCapsule
     onBatchDone   — optional callback after each batch (progress updates)
     force         — if true, regenerate all non-frozen days (default: false)
   Returns: number of days generated (0 if all already have outfits)
   ─────────────────────────────────────────────────────────────────────────── */
export async function generateTripOutfits({
  wardrobe,
  frozenDays,
  setOutfitIds,
  onBatchDone,
  capsuleIds,
  outfitIds,
  force = false,
}) {
  // Build Trip Item Pool — restricts AI to approved items only
  const tripItemPool = buildTripItemPool({
    wardrobe,
    capsuleIds,
    outfitIds: outfitIds || {},
    frozenDays,
  });

  const wardrobeText = buildWardrobeText(wardrobe, tripItemPool);
  const validIds     = tripItemPool || new Set(wardrobe.map((i) => i.id));

  // Optimization #1: Skip frozen days AND (unless force=true) days that
  // already have a generated daytime outfit.
  const daysToGen = TRIP.filter((d) => {
    if (frozenDays[d.id]) return false;
    if (!force) {
      const existing = outfitIds?.[d.id];
      if (existing?.daytime?.base) return false; // already generated
    }
    return true;
  });

  if (daysToGen.length === 0) {
    if (force) {
      throw new Error("All days are frozen. Unfreeze some days first.");
    }
    // All non-frozen days already have outfits — nothing to do
    return 0;
  }

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

    // Optimization #3: check cache before hitting the API
    const hash   = inputHash({ wardrobeText, tripText });
    const cached = getCached({ featureType: "outfitGeneration", hash });

    if (cached) {
      logAICall({ featureType: "outfitGeneration", cached: true });
      applyParsed(cached);
      if (onBatchDone) onBatchDone();
      return;
    }

    const rawText = await callAI({
      system:      SYSTEM_STYLIST,
      userContent: prompt,
      maxTokens:   8000,
      featureType: "outfitGeneration",
    });

    const parsed = extractJSON(rawText);
    setCached({ featureType: "outfitGeneration", hash, value: parsed });
    applyParsed(parsed);
    if (onBatchDone) onBatchDone();
  };

  const mid = Math.ceil(daysToGen.length / 2);
  await callBatch(daysToGen.slice(0, mid));
  await callBatch(daysToGen.slice(mid));

  return daysToGen.length;
}

/* ────────────────────────────────────────────────────────────────────────────
   generateSingleOutfit — one outfit for a given occasion / weather / context.

   Optimization: prefers capsule/travel-ready items (not frozen pool) so
   regeneration always has variety. Rate-limited and logged.

   Returns { base, mid, outer, bottom, shoes } with validated IDs (or null).
   ─────────────────────────────────────────────────────────────────────────── */
export async function generateSingleOutfit({
  wardrobe,
  occ,
  weather,
  city,
  act,
  capsuleIds,
  existingSlotIds,
}) {
  const hasCapsule = capsuleIds && capsuleIds.size >= 8;
  const wardrobeText = buildWardrobeText(wardrobe, hasCapsule ? capsuleIds : null);

  // Restrict valid IDs to capsule-only when capsule is active — prevents non-capsule items slipping through
  const validIds = hasCapsule
    ? new Set(wardrobe.filter((i) => capsuleIds.has(i.id)).map((i) => i.id))
    : new Set(wardrobe.map((i) => i.id));

  const capsuleNote = hasCapsule
    ? `\nIMPORTANT: The catalog above contains ONLY your approved trip capsule items. You MUST use ONLY these exact IDs — do not use any other item IDs.`
    : "";

  const avoidNote = (() => {
    if (!existingSlotIds) return "";
    const layers = ["base", "mid", "outer", "bottom", "shoes"].filter(
      (l) => existingSlotIds[l] && existingSlotIds[l] !== "REMOVED"
    );
    if (layers.length === 0) return "";
    const lines = layers.map((l) => {
      const item = wardrobe.find((i) => i.id === existingSlotIds[l]);
      return `  ${l}: ${item ? item.n : existingSlotIds[l]}`;
    });
    return `\nCURRENT OUTFIT — generate a DIFFERENT look (change at least the base layer and one other item):\n${lines.join("\n")}\n`;
  })();

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
${capsuleNote}${avoidNote}
CONTEXT:
${contextLines}

RULES:
1. Cold = base + mid + outer; Mild = base (outer optional); Warm = base only
2. Dinner / smart casual = polished; Casual = relaxed; Flight = comfortable; Hiking = practical
3. Only use IDs that appear exactly in the catalog
4. Use null for optional layers you choose not to include
5. Generate a FRESH combination — do not reproduce the current outfit listed above

Output ONLY a single JSON object (no markdown, no code blocks):
{"base":"ITEM_ID","mid":"ITEM_ID_OR_NULL","outer":"ITEM_ID_OR_NULL","bottom":"ITEM_ID","shoes":"ITEM_ID"}`;

  const rawText = await callAI({
    system:      SYSTEM_STYLIST,
    userContent: prompt,
    maxTokens:   2000,
    featureType: "singleOutfit",
  });

  const parsed = extractJSON(rawText);
  const result = {};
  ["base", "mid", "outer", "bottom", "shoes"].forEach((layer) => {
    const id = parsed[layer];
    result[layer] = id && validIds.has(id) ? id : null;
  });

  if (!result.base || !result.bottom || !result.shoes) {
    throw new Error("AI returned an invalid outfit. Try again.");
  }
  return result;
}

/* ────────────────────────────────────────────────────────────────────────────
   generateCapsuleWithAI — selects ~20–35 versatile items for the trip capsule.

   Optimization #7: Checks cache first — only calls AI if inputs have changed
   or the cached result has expired (7 days TTL).
   ─────────────────────────────────────────────────────────────────────────── */
export async function generateCapsuleWithAI({ wardrobe, frozenItemIds = new Set() }) {
  if (wardrobe.length === 0) throw new Error("Wardrobe is empty.");

  const allItemsText = wardrobe
    .map((i) => `${i.id}|${i.n.slice(0, 18)}|${i.l || "?"}|${i.col}|${i.c}|${i.w || "?"}`)
    .join("\n");

  const tripSummary = TRIP
    .map((d) => `${d.date}: ${d.city}, Weather: ${d.w}, Day: ${d.day || d.occ}, Evening: ${d.night || "Casual"}`)
    .join("\n");

  const frozenList = wardrobe
    .filter((i) => frozenItemIds.has(i.id))
    .map((i) => `${i.id}|${i.n.slice(0, 18)}|${i.l || "?"}`)
    .join("\n");

  const SYSTEM_CAPSULE =
    "You are an expert travel packing consultant. Output ONLY valid JSON with no markdown, code blocks, or explanation. Never invent item IDs — use only exact IDs from the provided catalog.";

  const frozenSection =
    frozenItemIds.size > 0
      ? `\nPROTECTED ITEMS (already in frozen outfits — MUST be included in capsuleIds):\n${frozenList}\n`
      : "";

  const targetRange =
    frozenItemIds.size > 0
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

  // Optimization #7: cache check
  const hash   = inputHash({ allItemsText, frozenList });
  const cached = getCached({ featureType: "capsuleGeneration", hash });

  if (cached) {
    logAICall({ featureType: "capsuleGeneration", cached: true });
    const validIds  = new Set(wardrobe.map((i) => i.id));
    const validCached = cached.filter((id) => validIds.has(id));
    return [...new Set([...frozenItemIds, ...validCached])];
  }

  const rawText = await callAI({
    system:      SYSTEM_CAPSULE,
    userContent: prompt,
    maxTokens:   2000,
    featureType: "capsuleGeneration",
  });

  const parsed = extractJSON(rawText);
  if (!Array.isArray(parsed.capsuleIds)) {
    throw new Error("AI returned invalid capsule format. Try again.");
  }

  const validIds = new Set(wardrobe.map((i) => i.id));
  const aiIds    = parsed.capsuleIds.filter((id) => validIds.has(id));
  const finalIds = [...new Set([...frozenItemIds, ...aiIds])];

  setCached({ featureType: "capsuleGeneration", hash, value: aiIds });
  return finalIds;
}

/* ────────────────────────────────────────────────────────────────────────────
   optimizePackingWithAI — re-assigns items to minimise total unique item count.
   Frozen days are never changed. Deterministic tasks (dedup, sort, counts)
   are done client-side before/after this call.
   ─────────────────────────────────────────────────────────────────────────── */
export async function optimizePackingWithAI({ wardrobe, outfitIds, frozenDays = {} }) {
  const plannedEntries = Object.entries(outfitIds).filter(
    ([, d]) => d && (d.daytime || d.evening)
  );
  if (plannedEntries.length === 0)
    throw new Error("No planned outfits found to optimize.");

  const beforeCount  = countUniqueItems(outfitIds);
  const wardrobeText = buildWardrobeText(wardrobe, null);
  const wardrobeIds  = new Set(wardrobe.map((i) => i.id));

  const currentText = plannedEntries
    .map(([dayId, dayData]) => {
      const tripDay = TRIP.find((d) => d.id === dayId);
      const locked  = frozenDays[dayId] ? " [LOCKED — do not change]" : "";
      const label   = tripDay
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

      return `${label}:\n  daytime: ${fmtSlot(dayData.daytime)}\n  evening: ${fmtSlot(dayData.evening)}`;
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

  const rawText = await callAI({
    system:      SYSTEM,
    userContent: prompt,
    maxTokens:   8000,
    featureType: "packingOptimization",
  });

  const parsed = extractJSON(rawText);

  const proposed = { ...outfitIds };
  Object.entries(parsed).forEach(([dayId, dayData]) => {
    if (frozenDays[dayId]) return;
    const existing = outfitIds[dayId];
    if (!existing) return;
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
