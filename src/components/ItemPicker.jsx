import { useState, useMemo } from "react";
import { T, swatch, CAT_EMOJI } from "../theme";
import TRIP from "../data/trip";

/* ─── Layer filter functions ──────────────────────────────────────────────────
   Filter wardrobe items for each outfit layer slot.
   Filtering uses the item's `l` field (derived + corrected in SheetSyncService)
   rather than tab names — so footwear/bottom overrides flow through automatically.

   Base also includes Sweaters tab items (pullovers/crewnecks worn as the
   primary visible top, since a sweatshirt or crewneck is a valid base layer.
   ─────────────────────────────────────────────────────────────────────────── */
export const LAYER_FILTER = {
  base:          (i) => i.l === "Base" || i._tab === "Sweaters",
  mid:           (i) => i.l === "Mid" || i._tab === "Shirts",
  outer:         (i) => i.l === "Outer",
  bottom:        (i) => i.l === "Bottom" && i._tab !== "Thermals",
  thermalBottom: (i) => i._tab === "Thermals" && i.l === "Bottom",
  shoes:         (i) => i.l === "Footwear",
};

const LAYER_LABELS = {
  base:          "Base / Top",
  mid:           "Mid Layer",
  outer:         "Outer / Jacket",
  bottom:        "Bottom",
  thermalBottom: "Thermal Bottom",
  shoes:         "Shoes",
};

/* ─── All outfit slot names (used to scan usage across all occasions) ──────── */
const ALL_SLOTS = ["daytime", "evening", "breakfast", "sleepwear", "flight", "activity"];

/* ─── Usage stats precomputation ─────────────────────────────────────────────
   Iterates all outfitIds (all 6 slot types) to build per-item stats:
     count     – total appearances across all days + slots
     inFrozen  – appears in at least one frozen day
     inAny     – appears in any planned day
     inRecent  – in the first 3 TRIP days that have outfits planned
   Exported so OutfitsTab can import it for OutfitCard usage badges.
   ─────────────────────────────────────────────────────────────────────────── */
export function computeUsageStats(outfitIds, frozenDays) {
  const stats = {};

  const recentDayIds = new Set(
    TRIP.filter((d) => outfitIds[d.id])
      .slice(0, 3)
      .map((d) => d.id)
  );

  Object.entries(outfitIds).forEach(([dayId, dayData]) => {
    if (!dayData) return;
    const isFrozen = frozenDays[dayId] === true;
    const isRecent = recentDayIds.has(dayId);

    ALL_SLOTS.forEach((slot) => {
      const slotIds = dayData[slot];
      if (!slotIds || typeof slotIds !== "object") return;
      Object.values(slotIds).forEach((itemId) => {
        if (!itemId || itemId === "REMOVED") return;
        if (!stats[itemId]) {
          stats[itemId] = { count: 0, inFrozen: false, inAny: false, inRecent: false };
        }
        stats[itemId].count++;
        stats[itemId].inAny = true;
        if (isFrozen) stats[itemId].inFrozen = true;
        if (isRecent) stats[itemId].inRecent = true;
      });
    });
  });

  return stats;
}

/* ─── Full scoring formula for Suggested section ─────────────────────────────
   score =
     (inFrozenOutfits × 30) + (inPackingOnly × 25) +
     (usageCount × 10) + (recentlyUsed × 5) +
     (matchesWeather × 15) + (matchesOccasion × 10)
   ─────────────────────────────────────────────────────────────────────────── */
function computeFullScore(stats, item, dayWeather, dayOcc, capsuleIds) {
  const inFrozen   = stats?.inFrozen  || false;
  // inPackingOnly: in capsule (packing-list eligible) but not in a frozen outfit
  const inPacking  = !inFrozen && (capsuleIds?.has(item.id) ?? false);
  const usageCount = stats?.count     || 0;
  const inRecent   = stats?.inRecent  || false;

  let score = 0;
  if (inFrozen)  score += 30;
  if (inPacking) score += 25;
  score += usageCount * 10;
  if (inRecent)  score += 5;

  // Weather match: item weather tag matches the day's weather
  if (dayWeather && item.w) {
    if (item.w === dayWeather) score += 15;
    else if (item.w === "All" || item.w === "Any") score += 5;
  }

  // Occasion match: item occasion tag matches the day's occasion
  if (dayOcc && item.occ) {
    const iOcc = (item.occ || "").toLowerCase();
    const dOcc = (dayOcc  || "").toLowerCase();
    if (iOcc.includes(dOcc) || dOcc.includes(iOcc)) score += 10;
  }

  return score;
}

/* ─── Legacy simple score (used for sorting outside of Suggested) ────────── */
function itemScore(s) {
  if (!s) return 0;
  return (s.count * 5) + (s.inFrozen ? 20 : 0) + (s.inAny ? 10 : 0) + (s.inRecent ? 5 : 0);
}

/* ─── Mini item thumbnail ─────────────────────────────────────────────────── */
function Thumb({ item, selected, stats, onSelect }) {
  const [failed, setFailed] = useState(false);
  const name     = item.n || item.itemName || "";
  const color    = item.col || item.color || "Black";
  const brand    = item.b || item.brand || "";
  const img      = item.img || item.imageUrl || "";
  const cat      = item.c || item.category || "";
  const [bg, ac, fg] = swatch(color);
  const emoji    = CAT_EMOJI[cat] || "👕";
  const showImg  = img && !failed;

  const inFrozen   = stats?.inFrozen || false;
  const usageCount = stats?.count    || 0;

  return (
    <div
      onClick={onSelect}
      style={{
        cursor: "pointer",
        borderRadius: 14,
        overflow: "hidden",
        border: `2px solid ${selected ? T.text : inFrozen ? "#93C5FD" : T.borderLight}`,
        background: T.alt,
        transition: "border-color 0.15s, transform 0.1s",
        transform: selected ? "scale(1.03)" : "scale(1)",
        position: "relative",
      }}
    >
      {/* Image / swatch */}
      <div
        style={{
          width: "100%",
          paddingTop: "100%",
          position: "relative",
          background: showImg ? T.alt : `linear-gradient(145deg,${bg},${ac})`,
        }}
      >
        {showImg ? (
          <img
            src={img}
            alt={name}
            onError={() => setFailed(true)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            }}
          >
            <span style={{ fontSize: 28 }}>{emoji}</span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: fg,
                opacity: 0.6,
                letterSpacing: 0.5,
                textAlign: "center",
                padding: "0 4px",
              }}
            >
              {color.toUpperCase()}
            </span>
          </div>
        )}

        {/* Selected checkmark */}
        {selected && (
          <div
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: T.text,
              color: T.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            ✓
          </div>
        )}

        {/* Frozen badge — hidden when selected */}
        {inFrozen && !selected && (
          <div
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              background: "#1E3A5F",
              color: "#93C5FD",
              borderRadius: 6,
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 5px",
              lineHeight: 1.4,
            }}
          >
            🔒
          </div>
        )}
      </div>

      {/* Label */}
      <div style={{ padding: "6px 7px 7px" }}>
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: T.text,
            lineHeight: 1.3,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {name}
        </p>
        {brand && (
          <p style={{ fontSize: 9, color: T.light, marginTop: 2, letterSpacing: 0.5 }}>
            {brand.toUpperCase()}
          </p>
        )}
        {usageCount >= 2 && (
          <p style={{ fontSize: 8, color: "#93C5FD", marginTop: 2, fontWeight: 700 }}>
            ×{usageCount} used
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── ItemPicker modal ────────────────────────────────────────────────────── */
// Props:
//   wardrobe    – full items array (from useWardrobe)
//   layer       – "base"|"mid"|"outer"|"bottom"|"shoes" — pre-filters the list
//   currentId   – currently selected item ID (shown as selected)
//   outfitIds   – full outfit state for usage-based ranking
//   frozenDays  – frozen state for badge + score boost
//   capsuleIds  – Set<itemId> — if non-empty, default to capsule-only view
//   dayWeather  – current day's weather ("Cold"|"Mild"|"Warm") for Suggested scoring
//   dayOcc      – current day's occasion for Suggested scoring
//   onSelect(item) – called when user confirms a selection
//   onClose     – called to dismiss without selecting
export default function ItemPicker({
  wardrobe,
  layer,
  currentId,
  outfitIds  = {},
  frozenDays = {},
  capsuleIds,
  dayWeather,   // NEW — for Suggested scoring
  dayOcc,       // NEW — for Suggested scoring
  onSelect,
  onClose,
}) {
  const [q,       setQ]       = useState("");
  const [pending, setPending] = useState(currentId || null);

  const filterFn   = LAYER_FILTER[layer];
  const layerLabel = LAYER_LABELS[layer] || layer;

  /* ── Precompute Trip Item Pool (capsule ∪ frozen outfit items) ── */
  const tripItemPoolIds = useMemo(() => {
    const poolIds = new Set();
    // Add capsule items
    if (capsuleIds) capsuleIds.forEach((id) => poolIds.add(id));
    // Add items from frozen outfit slots
    Object.entries(outfitIds).forEach(([dayId, dayData]) => {
      if (!frozenDays[dayId] || !dayData) return;
      ALL_SLOTS.forEach((slot) => {
        const slotIds = dayData[slot];
        if (!slotIds) return;
        Object.values(slotIds).forEach((id) => {
          if (id && id !== "REMOVED") poolIds.add(id);
        });
      });
    });
    return poolIds;
  }, [capsuleIds, outfitIds, frozenDays]);

  /* Determine if capsule filtering is available for this layer */
  const layerPool = filterFn ? wardrobe.filter(filterFn) : wardrobe;
  const capsuleInLayer = capsuleIds && capsuleIds.size > 0
    ? layerPool.filter((i) => capsuleIds.has(i.id)).length
    : 0;
  const hasCapsule = capsuleInLayer > 0;

  /* Default to capsule-only if capsule has items for this layer */
  const [showAll, setShowAll] = useState(!hasCapsule);

  /* Precompute usage stats — recomputes only when outfit/freeze state changes */
  const usageStats = useMemo(
    () => computeUsageStats(outfitIds, frozenDays),
    [outfitIds, frozenDays]
  );

  /* Filter by layer, then capsule/all toggle, then search query */
  const filtered = useMemo(() => {
    let pool = filterFn ? wardrobe.filter(filterFn) : wardrobe;
    if (!showAll && capsuleIds && capsuleIds.size > 0) {
      pool = pool.filter((i) => capsuleIds.has(i.id));
    }
    if (!q.trim()) return pool;
    const lq = q.toLowerCase();
    return pool.filter(
      (i) =>
        (i.n || i.itemName || "").toLowerCase().includes(lq) ||
        (i.col || i.color || "").toLowerCase().includes(lq) ||
        (i.b || i.brand || "").toLowerCase().includes(lq) ||
        (i.productCode || "").toLowerCase().includes(lq)
    );
  }, [wardrobe, layer, showAll, capsuleIds, q]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Sort by legacy score descending, then alphabetical */
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const diff = itemScore(usageStats[b.id]) - itemScore(usageStats[a.id]);
      if (diff !== 0) return diff;
      return (a.n || "").localeCompare(b.n || "");
    });
  }, [filtered, usageStats]);

  /* ── Sections ─────────────────────────────────────────────────────────────
     1. ✦ Suggested   — top 6 from TripItemPool for this layer, full score
     2. 🔥 Frequently Used — usageCount ≥ 2, not already in Suggested
     3. 📦 In Packing      — inFrozen, not in above
     4. All Items / Trip Capsule — the rest
     Each item appears in exactly one section.
  ── */
  const sections = useMemo(() => {
    // ── Suggested: top 6 TripItemPool items for this layer, sorted by full score
    const fullLayerPool = filterFn ? wardrobe.filter(filterFn) : wardrobe;
    const tripLayerItems = fullLayerPool.filter((i) => tripItemPoolIds.has(i.id));
    const suggestedSorted = [...tripLayerItems]
      .sort((a, b) => {
        const sA = computeFullScore(usageStats[a.id], a, dayWeather, dayOcc, capsuleIds);
        const sB = computeFullScore(usageStats[b.id], b, dayWeather, dayOcc, capsuleIds);
        return sB - sA;
      })
      .slice(0, 6);
    const suggestedIds = new Set(suggestedSorted.map((i) => i.id));

    // ── Partition sorted (filtered main pool) into sections, excluding suggested
    const frequentItems = sorted.filter(
      (i) => (usageStats[i.id]?.count || 0) >= 2 && !suggestedIds.has(i.id)
    );
    const frequentIds = new Set(frequentItems.map((i) => i.id));

    const packedItems = sorted.filter(
      (i) => usageStats[i.id]?.inFrozen && !frequentIds.has(i.id) && !suggestedIds.has(i.id)
    );
    const packedIds = new Set(packedItems.map((i) => i.id));

    const restItems = sorted.filter(
      (i) => !suggestedIds.has(i.id) && !frequentIds.has(i.id) && !packedIds.has(i.id)
    );

    const result = [];
    if (suggestedSorted.length > 0)
      result.push({ label: "✦ Suggested",      items: suggestedSorted, accent: "#2DD4BF" });
    if (frequentItems.length > 0)
      result.push({ label: "🔥 Frequently Used", items: frequentItems });
    if (packedItems.length > 0)
      result.push({ label: "📦 In Packing",      items: packedItems });
    result.push({ label: showAll ? "All Items" : "✈ Trip Capsule", items: restItems });
    return result;
  }, [sorted, usageStats, wardrobe, tripItemPoolIds, capsuleIds, dayWeather, dayOcc, filterFn, showAll]);

  const hasSpecialSections = sections.length > 1;

  function confirm() {
    if (!pending) return;
    const item = wardrobe.find((i) => i.id === pending);
    if (item) onSelect(item);
  }

  return (
    /* Backdrop */
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 500,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      {/* Sheet */}
      <div
        style={{
          background: T.surface,
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 700,
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 16px 12px",
            borderBottom: `1px solid ${T.borderLight}`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
                Pick · {layerLabel}
              </p>
              <p style={{ fontSize: 11, color: T.mid, marginTop: 2 }}>
                {filtered.length} item{filtered.length !== 1 ? "s" : ""}
                {hasCapsule && !showAll && (
                  <span style={{ color: "#2DD4BF", marginLeft: 4 }}>· capsule only</span>
                )}
                {tripItemPoolIds.size > 0 && (
                  <span style={{ color: "#2DD4BF", marginLeft: 4 }}>
                    · {tripItemPoolIds.size} trip items
                  </span>
                )}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Capsule / All toggle */}
              {hasCapsule && (
                <button
                  onClick={() => setShowAll((v) => !v)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 20,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    border: showAll ? `1.5px solid ${T.border}` : "1.5px solid #14B8A6",
                    background: showAll ? "none" : "#0D2E2B",
                    color: showAll ? T.light : "#2DD4BF",
                    whiteSpace: "nowrap",
                  }}
                >
                  {showAll ? "All Items" : "✈ Capsule"}
                </button>
              )}
              <button
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  color: T.mid,
                  fontSize: 18,
                  cursor: "pointer",
                  padding: "4px 8px",
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: T.light,
                fontSize: 14,
              }}
            >
              ⌕
            </span>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, color, brand, code…"
              style={{
                width: "100%",
                padding: "9px 12px 9px 34px",
                background: T.alt,
                border: `1.5px solid ${T.border}`,
                borderRadius: 10,
                fontSize: 13,
                color: T.text,
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>

        {/* Grid */}
        <div
          style={{
            overflowY: "auto",
            flex: 1,
            padding: "12px 12px 0",
          }}
        >
          {filtered.length === 0 && sections.every((s) => s.items.length === 0) ? (
            <div style={{ textAlign: "center", padding: 40, color: T.light, fontSize: 13 }}>
              No items found
            </div>
          ) : (
            sections.map((section) => {
              if (section.items.length === 0) return null;
              return (
                <div key={section.label} style={{ marginBottom: 8 }}>
                  {hasSpecialSections && (
                    <p
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: section.accent || T.mid,
                        letterSpacing: 1,
                        textTransform: "uppercase",
                        paddingTop: 8,
                        paddingBottom: 6,
                      }}
                    >
                      {section.label}
                    </p>
                  )}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {section.items.map((item) => (
                      <Thumb
                        key={item.id}
                        item={item}
                        selected={pending === item.id}
                        stats={usageStats[item.id]}
                        onSelect={() => setPending(item.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: "12px 16px 20px",
            borderTop: `1px solid ${T.borderLight}`,
            display: "flex",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "11px",
              background: "none",
              border: `1.5px solid ${T.border}`,
              borderRadius: 12,
              fontSize: 13,
              color: T.mid,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={!pending}
            style={{
              flex: 2,
              padding: "11px",
              background: pending ? T.text : T.border,
              border: "none",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 700,
              color: pending ? T.bg : T.light,
              cursor: pending ? "pointer" : "default",
              fontFamily: "inherit",
              transition: "background 0.15s",
            }}
          >
            Select →
          </button>
        </div>
      </div>
    </div>
  );
}
