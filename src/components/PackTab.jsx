/* ─── PACKING TAB — Built from FROZEN days only ───────────────────────────────
   Only includes items from days where isFrozen = true.
   Collects from both daytime + evening outfit slots per frozen day.
   Groups by clothing layer, sorts by usage frequency.

   "✨ Optimize Packing" button: calls Gemini to minimize unique item count
   across all planned days → shows before/after confirmation → apply to Daily.

   Empty state: directs user to plan outfits in DAILY tab, then freeze days.
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useMemo } from "react";
import { T, swatch } from "../theme";
import TRIP from "../data/trip";
import { optimizePackingWithAI } from "../utils/tripGenerator";

const LAYER_ORDER = ["Base", "Mid", "Outer", "Bottom", "Footwear"];
const LAYER_LABEL = {
  Base:     "Tops & Base Layers",
  Mid:      "Mid Layers / Knitwear",
  Outer:    "Jackets & Outerwear",
  Bottom:   "Bottoms",
  Footwear: "Footwear",
};
const LAYER_ICON = { Base: "👕", Mid: "🧶", Outer: "🧥", Bottom: "👖", Footwear: "👟" };

/* ─── PACKING LIST ─────────────────────────────────────────────────────────── */
export default function PackTab({ wardrobe = [], outfitIds = {}, setOutfitIds, frozenDays = {}, capsuleIds }) {
  const [checked, setChecked] = useState({});

  /* ── Optimizer state ── */
  const [optLoading, setOptLoading] = useState(false);
  const [optError,   setOptError]   = useState(null);
  const [optResult,  setOptResult]  = useState(null); // { beforeCount, afterCount, proposed }
  const [optApplied, setOptApplied] = useState(false);

  async function handleOptimize() {
    if (optLoading) return;
    setOptLoading(true);
    setOptError(null);
    setOptResult(null);
    setOptApplied(false);
    try {
      const result = await optimizePackingWithAI({ wardrobe, outfitIds, frozenDays });
      setOptResult(result);
    } catch (err) {
      setOptError(err.message || "Optimization failed. Try again.");
    } finally {
      setOptLoading(false);
    }
  }

  function handleApplyOptimization() {
    if (!optResult) return;
    setOutfitIds(optResult.proposed);
    setOptApplied(true);
    setOptResult(null);
    setTimeout(() => setOptApplied(false), 4000);
  }

  /* ── Build packing list — frozen-day outfit items + capsule items ── */
  const { groups, capsuleOnlyGroups, totalItems, capsuleOnlyCount, frozenCount, totalDays } = useMemo(() => {
    const usage = {}; // itemId → how many outfit slots it appears in
    let frozenWithOutfits = 0;

    Object.entries(outfitIds).forEach(([dayId, dayData]) => {
      // Only count frozen days
      if (!frozenDays[dayId]) return;
      if (!dayData) return;

      const collectSlot = (slotIds) => {
        if (!slotIds) return false;
        let hasReal = false;
        Object.values(slotIds).forEach((id) => {
          if (id && id !== "REMOVED") {
            usage[id] = (usage[id] || 0) + 1;
            hasReal = true;
          }
        });
        return hasReal;
      };

      const dtHas = collectSlot(dayData.daytime);
      const evHas = collectSlot(dayData.evening);
      if (dtHas || evHas) frozenWithOutfits++;
    });

    // Resolve item IDs to full item objects + attach usage count
    const items = Object.entries(usage)
      .map(([id, count]) => {
        const item = wardrobe.find((i) => i.id === id);
        return item ? { ...item, _useCount: count } : null;
      })
      .filter(Boolean);

    // Group by item.l ("Base" | "Mid" | "Outer" | "Bottom" | "Footwear")
    const grp = {};
    items.forEach((item) => {
      const layer = item.l || "Base";
      if (!grp[layer]) grp[layer] = [];
      grp[layer].push(item);
    });

    // Sort each group by usage count (most-worn first)
    Object.values(grp).forEach((g) => g.sort((a, b) => b._useCount - a._useCount));

    // Capsule-only items: in capsule but NOT already in outfit-based packing
    const outfitItemIds = new Set(Object.keys(usage));
    const capsuleOnlyItems = (capsuleIds && capsuleIds.size > 0)
      ? wardrobe
          .filter((i) => capsuleIds.has(i.id) && !outfitItemIds.has(i.id))
          .map((i) => ({ ...i, _useCount: 0 }))
      : [];

    const capsuleGrp = {};
    capsuleOnlyItems.forEach((item) => {
      const layer = item.l || "Base";
      if (!capsuleGrp[layer]) capsuleGrp[layer] = [];
      capsuleGrp[layer].push(item);
    });

    // Count total frozen days (regardless of whether they have outfits)
    const totalFrozen = Object.values(frozenDays).filter(Boolean).length;

    return {
      groups: grp,
      capsuleOnlyGroups: capsuleGrp,
      totalItems: items.length,
      capsuleOnlyCount: capsuleOnlyItems.length,
      frozenCount: frozenWithOutfits,
      totalDays: totalFrozen,
    };
  }, [outfitIds, frozenDays, wardrobe, capsuleIds]);

  const hasData = totalItems > 0 || capsuleOnlyCount > 0;
  const done = Object.values(checked).filter(Boolean).length;

  /* ── Empty state ── */
  if (!hasData) {
    const hasFrozenDays = Object.values(frozenDays).some(Boolean);
    return (
      <div>
        <div style={{
          background: T.surface,
          border: `1.5px solid ${T.borderLight}`,
          borderRadius: 16,
          padding: "28px 24px",
          textAlign: "center",
        }}>
          <p style={{ fontSize: 32, marginBottom: 14 }}>🧳</p>
          <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 10 }}>
            Packing List
          </p>
          {hasFrozenDays ? (
            <p style={{ fontSize: 12, color: T.mid, lineHeight: 1.7, maxWidth: 300, margin: "0 auto" }}>
              You have frozen days but no outfits yet. Plan outfits in{" "}
              <strong style={{ color: T.text, letterSpacing: 1 }}>DAILY</strong>{" "}
              tab first, then freeze days to build your packing list.
            </p>
          ) : (
            <p style={{ fontSize: 12, color: T.mid, lineHeight: 1.7, maxWidth: 300, margin: "0 auto" }}>
              Plan your outfits in the{" "}
              <strong style={{ color: T.text, letterSpacing: 1 }}>DAILY</strong>{" "}
              tab, then{" "}
              <strong style={{ color: "#60A5FA" }}>🔒 Freeze</strong>{" "}
              days to add them to your packing list.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ── */}
      <div style={{
        background: T.surface,
        border: `1.5px solid ${T.borderLight}`,
        borderRadius: 16,
        padding: "16px 18px",
        marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 700, color: T.text }}>
            🧳 Packing List
          </p>
          <div style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1,
            color: "#60A5FA",
            background: "#0F172A",
            border: "1px solid #1E293B",
            borderRadius: 20,
            padding: "3px 10px",
          }}>
            🔒 {totalDays} FROZEN DAY{totalDays !== 1 ? "S" : ""}
          </div>
        </div>
        <p style={{ fontSize: 12, color: T.mid, lineHeight: 1.6, marginTop: 4 }}>
          Built from {frozenCount}/{TRIP.length} frozen days ·{" "}
          <strong style={{ color: T.text }}>{totalItems}</strong> unique items
        </p>
      </div>

      {/* ── Packing Optimizer ── */}
      <div style={{
        background: T.surface,
        border: `1.5px solid ${T.borderLight}`,
        borderRadius: 16,
        padding: "14px 18px",
        marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: T.text }}>Packing Optimizer</p>
            <p style={{ fontSize: 11, color: T.mid, marginTop: 2 }}>
              Use AI to minimize unique items across all planned days
            </p>
          </div>
          <button
            onClick={handleOptimize}
            disabled={optLoading}
            style={{
              padding: "9px 16px",
              background: optApplied ? "#0C2010" : "linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)",
              color: optApplied ? "#4ADE80" : T.text,
              border: optApplied ? "1.5px solid #4ADE80" : "1.5px solid transparent",
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 700,
              cursor: optLoading ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "inherit",
              boxShadow: optApplied ? "none" : "0 2px 12px rgba(15,52,96,0.4)",
              opacity: optLoading ? 0.7 : 1,
              flexShrink: 0,
            }}
          >
            {optLoading ? (
              <>
                <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>◌</span>
                Analysing…
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </>
            ) : optApplied ? (
              "✓ Optimized!"
            ) : (
              "✨ Optimize Packing"
            )}
          </button>
        </div>

        {/* Optimizer error */}
        {optError && (
          <div style={{
            marginTop: 10,
            background: "#2D0A0A",
            border: "1.5px solid #7F1D1D",
            borderRadius: 10,
            padding: "9px 12px",
            fontSize: 11,
            color: "#FCA5A5",
            lineHeight: 1.5,
          }}>
            ⚠ {optError}
          </div>
        )}

        {/* Optimizer result confirmation */}
        {optResult && (
          <div style={{
            marginTop: 12,
            background: "#0A1A10",
            border: "1.5px solid #166534",
            borderRadius: 12,
            padding: "14px 16px",
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#4ADE80", marginBottom: 4 }}>
              Ready to optimize!
            </p>
            <p style={{ fontSize: 12, color: T.mid, marginBottom: 12, lineHeight: 1.6 }}>
              <strong style={{ color: T.text }}>{optResult.beforeCount}</strong> unique items →{" "}
              <strong style={{ color: "#4ADE80" }}>{optResult.afterCount}</strong> unique items
              {optResult.beforeCount > optResult.afterCount && (
                <span style={{ color: "#86EFAC", marginLeft: 4 }}>
                  (save {optResult.beforeCount - optResult.afterCount} items)
                </span>
              )}
            </p>
            <p style={{ fontSize: 10, color: T.light, marginBottom: 12, lineHeight: 1.5 }}>
              This will update all non-frozen days in your Daily tab. Frozen days are unchanged.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setOptResult(null)}
                style={{
                  flex: 1,
                  padding: "9px",
                  background: "none",
                  border: `1.5px solid ${T.border}`,
                  borderRadius: 10,
                  fontSize: 12,
                  color: T.mid,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleApplyOptimization}
                style={{
                  flex: 2,
                  padding: "9px",
                  background: "#166534",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#4ADE80",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                ✓ Apply Optimization
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Category summary bar ── */}
      <div style={{
        background: T.surface,
        border: `1.5px solid ${T.borderLight}`,
        borderRadius: 14,
        padding: "12px 6px",
        marginBottom: 20,
        display: "flex",
        flexWrap: "wrap",
        gap: 0,
      }}>
        {LAYER_ORDER.filter((l) => groups[l]).map((l, i, arr) => (
          <div
            key={l}
            style={{
              flex: "1 1 auto",
              textAlign: "center",
              borderRight: i < arr.length - 1 ? `1px solid ${T.borderLight}` : "none",
              padding: "4px 8px",
              minWidth: 44,
            }}
          >
            <p style={{ fontSize: 18, fontWeight: 800, color: T.text, lineHeight: 1 }}>{groups[l].length}</p>
            <p style={{ fontSize: 8, color: T.light, fontWeight: 600, letterSpacing: 0.5, marginTop: 3 }}>
              {LAYER_ICON[l]} {l.toUpperCase()}
            </p>
          </div>
        ))}
        <div style={{ flex: "1 1 auto", textAlign: "center", padding: "4px 8px", minWidth: 44 }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: T.text, lineHeight: 1 }}>{totalItems}</p>
          <p style={{ fontSize: 8, color: T.light, fontWeight: 600, letterSpacing: 0.5, marginTop: 3 }}>TOTAL</p>
        </div>
      </div>

      {/* ── Progress bar ── */}
      {done > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{done}/{totalItems} packed</p>
            <p style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>
              {Math.round((done / totalItems) * 100)}%
            </p>
          </div>
          <div style={{ background: T.borderLight, borderRadius: 4, height: 4 }}>
            <div style={{
              height: "100%",
              background: T.green,
              width: `${(done / totalItems) * 100}%`,
              borderRadius: 4,
              transition: "width 0.3s",
            }} />
          </div>
        </div>
      )}

      {/* ── Items by layer ── */}
      {LAYER_ORDER.filter((l) => groups[l]).map((layer) => (
        <div key={layer} style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: T.light, letterSpacing: 1.5, marginBottom: 10 }}>
            {LAYER_ICON[layer]} {LAYER_LABEL[layer].toUpperCase()} ({groups[layer].length})
          </p>
          {groups[layer].map((item) => {
            const [bg, ac] = swatch(item.col);
            const isPacked = checked[item.id];
            return (
              <div
                key={item.id}
                onClick={() => setChecked((c) => ({ ...c, [item.id]: !c[item.id] }))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: isPacked ? T.alt : T.surface,
                  border: `1.5px solid ${T.borderLight}`,
                  borderRadius: 12,
                  padding: "10px 14px",
                  marginBottom: 8,
                  cursor: "pointer",
                  opacity: isPacked ? 0.55 : 1,
                  transition: "all 0.15s",
                }}
              >
                {/* Image / color swatch */}
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  flexShrink: 0,
                  overflow: "hidden",
                  background: `linear-gradient(145deg,${bg},${ac})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {item.img ? (
                    <img
                      src={item.img}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => (e.target.style.display = "none")}
                    />
                  ) : null}
                </div>

                {/* Item info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: T.text,
                    textDecoration: isPacked ? "line-through" : "none",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {item.n}
                  </p>
                  <p style={{ fontSize: 11, color: T.light, marginTop: 1 }}>
                    {item.b} · {item.col}
                  </p>
                </div>

                {/* Usage count badge */}
                <div style={{
                  flexShrink: 0,
                  fontSize: 9,
                  fontWeight: 700,
                  color: T.light,
                  letterSpacing: 0.5,
                  background: T.alt,
                  border: `1px solid ${T.borderLight}`,
                  borderRadius: 20,
                  padding: "2px 8px",
                  whiteSpace: "nowrap",
                }}>
                  ×{item._useCount}
                </div>

                {/* Checkbox */}
                <div style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: `2px solid ${isPacked ? T.green : T.border}`,
                  background: isPacked ? T.green : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 0.15s",
                }}>
                  {isPacked && <span style={{ color: "#fff", fontSize: 11 }}>✓</span>}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* ── Trip Capsule section (items in capsule but not in any outfit) ── */}
      {capsuleOnlyCount > 0 && (
        <div style={{ marginTop: 8, marginBottom: 24 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#2DD4BF", letterSpacing: 1.5 }}>
              ✈ TRIP CAPSULE · NOT IN OUTFITS ({capsuleOnlyCount})
            </p>
          </div>
          {LAYER_ORDER.filter((l) => capsuleOnlyGroups[l]).map((layer) => (
            <div key={layer} style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: T.light, letterSpacing: 1.5, marginBottom: 8 }}>
                {LAYER_ICON[layer]} {LAYER_LABEL[layer].toUpperCase()} ({capsuleOnlyGroups[layer].length})
              </p>
              {capsuleOnlyGroups[layer].map((item) => {
                const [bg, ac] = swatch(item.col);
                const isPacked = checked[item.id];
                return (
                  <div
                    key={item.id}
                    onClick={() => setChecked((c) => ({ ...c, [item.id]: !c[item.id] }))}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      background: isPacked ? T.alt : T.surface,
                      border: `1.5px solid ${isPacked ? T.borderLight : "#0D2E2B"}`,
                      borderRadius: 12,
                      padding: "10px 14px",
                      marginBottom: 8,
                      cursor: "pointer",
                      opacity: isPacked ? 0.55 : 1,
                      transition: "all 0.15s",
                    }}
                  >
                    {/* Image / color swatch */}
                    <div style={{
                      width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                      overflow: "hidden",
                      background: `linear-gradient(145deg,${bg},${ac})`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {item.img ? (
                        <img src={item.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => (e.target.style.display = "none")} />
                      ) : null}
                    </div>

                    {/* Item info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 13, fontWeight: 600, color: T.text,
                        textDecoration: isPacked ? "line-through" : "none",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {item.n}
                      </p>
                      <p style={{ fontSize: 11, color: T.light, marginTop: 1 }}>{item.b} · {item.col}</p>
                    </div>

                    {/* Capsule badge */}
                    <div style={{
                      flexShrink: 0, fontSize: 8, fontWeight: 700,
                      color: "#2DD4BF", background: "#0D2E2B",
                      border: "1px solid #14B8A6", borderRadius: 20,
                      padding: "2px 7px", whiteSpace: "nowrap",
                    }}>
                      ✈ CAPSULE
                    </div>

                    {/* Checkbox */}
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%",
                      border: `2px solid ${isPacked ? T.green : T.border}`,
                      background: isPacked ? T.green : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, transition: "all 0.15s",
                    }}>
                      {isPacked && <span style={{ color: "#fff", fontSize: 11 }}>✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      <p style={{ fontSize: 9, color: T.light, textAlign: "center", marginTop: 8, letterSpacing: 0.5 }}>
        FROZEN DAYS ONLY · {TRIP.length - totalDays > 0 ? `${TRIP.length - totalDays} DAYS NOT YET FROZEN` : "ALL DAYS FROZEN ✓"}
      </p>
    </div>
  );
}
