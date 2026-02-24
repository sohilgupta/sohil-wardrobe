import { useState } from "react";
import { T, swatch } from "../theme";
import TRIP from "../data/trip";
import { pick } from "../engine/outfitEngine";

const ORDER = ["Base", "Mid", "Outer", "Bottom", "Footwear"];
const LABEL = {
  Base: "Tops & Base Layers",
  Mid: "Mid Layers / Knitwear",
  Outer: "Jackets & Outerwear",
  Bottom: "Bottoms",
  Footwear: "Footwear",
};
const ICON = { Base: "👕", Mid: "🧶", Outer: "🧥", Bottom: "👖", Footwear: "👟" };

/* ─── PACKING LIST ─────────────────────────────────────────────────────────── */
export default function PackTab({ wardrobe }) {
  const [list, setList] = useState(null);
  const [checked, setChecked] = useState({});

  const gen = () => {
    const used = new Set();
    const all = [];
    TRIP.forEach((day) => {
      const items = pick(wardrobe, { occ: day.occ, w: day.w }, used);
      items.forEach((i) => {
        if (!used.has(i.id)) {
          used.add(i.id);
          all.push(i);
        }
      });
    });
    const g = {};
    all.forEach((i) => {
      if (!g[i.l]) g[i.l] = [];
      g[i.l].push(i);
    });
    setList(g);
    setChecked({});
  };

  const total = list ? Object.values(list).flat().length : 0;
  const done = Object.values(checked).filter(Boolean).length;

  return (
    <div>
      <div
        style={{
          background: T.surface,
          border: `1.5px solid ${T.borderLight}`,
          borderRadius: 16,
          padding: 18,
          marginBottom: 20,
        }}
      >
        <p style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>🧳 Packing List</p>
        <p style={{ fontSize: 13, color: T.mid, marginBottom: 16, lineHeight: 1.6 }}>
          Auto-generated for your 20-day AU/NZ trip. Deduplicates across all days.
        </p>
        <button
          onClick={gen}
          style={{
            padding: "11px 24px",
            background: T.text,
            color: T.bg,
            border: "none",
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          {list ? "↺ Regenerate" : "Generate List →"}
        </button>
      </div>

      {list && (
        <>
          <div
            style={{
              background: T.surface,
              border: `1.5px solid ${T.borderLight}`,
              borderRadius: 14,
              padding: "14px 18px",
              marginBottom: 20,
              display: "flex",
            }}
          >
            {ORDER.filter((l) => list[l]).map((l, i, arr) => (
              <div
                key={l}
                style={{
                  flex: 1,
                  textAlign: "center",
                  borderRight: i < arr.length - 1 ? `1px solid ${T.borderLight}` : "none",
                }}
              >
                <p style={{ fontSize: 20, fontWeight: 800, color: T.text, lineHeight: 1 }}>{list[l].length}</p>
                <p style={{ fontSize: 9, color: T.light, fontWeight: 600, letterSpacing: 0.5, marginTop: 3 }}>
                  {l.toUpperCase()}
                </p>
              </div>
            ))}
            <div style={{ flex: 1, textAlign: "center" }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: T.text, lineHeight: 1 }}>{total}</p>
              <p style={{ fontSize: 9, color: T.light, fontWeight: 600, letterSpacing: 0.5, marginTop: 3 }}>TOTAL</p>
            </div>
          </div>

          {done > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
                  {done}/{total} packed
                </p>
                <p style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>
                  {Math.round((done / total) * 100)}%
                </p>
              </div>
              <div style={{ background: T.borderLight, borderRadius: 4, height: 4 }}>
                <div
                  style={{
                    height: "100%",
                    background: T.green,
                    width: `${(done / total) * 100}%`,
                    borderRadius: 4,
                    transition: "width 0.3s",
                  }}
                />
              </div>
            </div>
          )}

          {ORDER.filter((l) => list[l]).map((layer) => (
            <div key={layer} style={{ marginBottom: 22 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: T.light, letterSpacing: 1.5, marginBottom: 10 }}>
                {ICON[layer]} {LABEL[layer].toUpperCase()} ({list[layer].length})
              </p>
              {list[layer].map((item) => {
                const [bg, ac] = swatch(item.col);
                return (
                  <div
                    key={item.id}
                    onClick={() => setChecked((c) => ({ ...c, [item.id]: !c[item.id] }))}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      background: checked[item.id] ? T.alt : T.surface,
                      border: `1.5px solid ${T.borderLight}`,
                      borderRadius: 12,
                      padding: "10px 14px",
                      marginBottom: 8,
                      cursor: "pointer",
                      opacity: checked[item.id] ? 0.55 : 1,
                      transition: "all 0.15s",
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 9,
                        flexShrink: 0,
                        overflow: "hidden",
                        background: `linear-gradient(145deg,${bg},${ac})`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                      }}
                    >
                      {item.img ? (
                        <img
                          src={item.img}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => (e.target.style.display = "none")}
                        />
                      ) : null}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: T.text,
                          textDecoration: checked[item.id] ? "line-through" : "none",
                        }}
                      >
                        {item.n}
                      </p>
                      <p style={{ fontSize: 11, color: T.light }}>
                        {item.b} · {item.col}
                      </p>
                    </div>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        border: `2px solid ${checked[item.id] ? T.green : T.border}`,
                        background: checked[item.id] ? T.green : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {checked[item.id] && <span style={{ color: "#fff", fontSize: 11 }}>✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
