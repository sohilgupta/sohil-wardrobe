/* ─── PACKING TAB — Auto-built from Daily outfits ────────────────────────────
   Builds a deduplicated packing list from outfitIds (planned days in Daily tab).
   Groups by clothing layer, sorts by usage frequency.
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useMemo } from "react";
import { T, swatch } from "../theme";
import TRIP from "../data/trip";

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
export default function PackTab({ wardrobe = [], outfitIds = {} }) {
  const [checked, setChecked] = useState({});

  /* ── Build packing list from daily outfits ── */
  const { groups, totalItems, plannedDays } = useMemo(() => {
    const usage = {}; // itemId → how many days it's used
    let days = 0;

    Object.values(outfitIds).forEach((dayIds) => {
      if (!dayIds) return;
      const { base, mid, outer, bottom, shoes } = dayIds;
      const ids = [base, mid, outer, bottom, shoes];
      const hasReal = ids.some((id) => id && id !== "REMOVED");
      if (hasReal) days++;

      ids.forEach((id) => {
        if (id && id !== "REMOVED") {
          usage[id] = (usage[id] || 0) + 1;
        }
      });
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

    return { groups: grp, totalItems: items.length, plannedDays: days };
  }, [outfitIds, wardrobe]);

  const hasData = totalItems > 0;
  const done = Object.values(checked).filter(Boolean).length;

  /* ── Empty state ── */
  if (!hasData) {
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
          <p style={{ fontSize: 12, color: T.mid, lineHeight: 1.7, maxWidth: 280, margin: "0 auto" }}>
            Plan your outfits in the{" "}
            <strong style={{ color: T.text, letterSpacing: 1 }}>DAILY</strong>{" "}
            tab first. Your packing list will build automatically from your selections.
          </p>
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
        <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 5 }}>
          🧳 Packing List
        </p>
        <p style={{ fontSize: 12, color: T.mid, lineHeight: 1.6 }}>
          Built from {plannedDays}/{TRIP.length} planned days ·{" "}
          <strong style={{ color: T.text }}>{totalItems}</strong> unique items
        </p>
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

      {/* ── Footer ── */}
      <p style={{ fontSize: 9, color: T.light, textAlign: "center", marginTop: 8, letterSpacing: 0.5 }}>
        AUTO-BUILT FROM DAILY OUTFITS · {TRIP.length - plannedDays > 0 ? `${TRIP.length - plannedDays} DAYS UNPLANNED` : "ALL DAYS PLANNED ✓"}
      </p>
    </div>
  );
}
