import { useState, useRef } from "react";
import { T, swatch } from "../theme";
import TRIP from "../data/trip";
import { pick } from "../engine/outfitEngine";
import { aiTip } from "../engine/ai";
import ItemVisual from "./ItemVisual";
import Chip from "./Chip";

const LAYERS = { Base: "TOP", Mid: "MID", Outer: "OUTER", Bottom: "BOTTOM", Footwear: "SHOES" };

/* ─── TRIP PLANNER ─────────────────────────────────────────────────────────── */
export default function TripTab({ wardrobe }) {
  const [outfits, setOutfits] = useState({});
  const [tips, setTips] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [gen, setGen] = useState(null);
  const used = useRef(new Set());

  const genOne = async (day) => {
    setGen(day.id);
    const items = pick(wardrobe, { occ: day.occ, w: day.w }, used.current);
    items.forEach((i) => used.current.add(i.id));
    setOutfits((p) => ({ ...p, [day.id]: items }));
    const t = await aiTip(items, day.occ, day.w, day.city, day.day || day.night);
    setTips((p) => ({ ...p, [day.id]: t }));
    setGen(null);
  };

  const genAll = () => {
    used.current = new Set();
    TRIP.forEach((day) => {
      const items = pick(wardrobe, { occ: day.occ, w: day.w }, used.current);
      items.forEach((i) => used.current.add(i.id));
      setOutfits((p) => ({ ...p, [day.id]: items }));
    });
  };

  const planned = Object.keys(outfits).length;

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: T.text }}>AU & NZ — April 2026</p>
            <p style={{ fontSize: 12, color: T.mid, marginTop: 3 }}>
              {planned}/{TRIP.length} days planned
            </p>
          </div>
          <button
            onClick={genAll}
            style={{
              padding: "9px 18px",
              background: T.text,
              color: T.bg,
              border: "none",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Plan All →
          </button>
        </div>
        {planned > 0 && (
          <div style={{ marginTop: 12, background: T.alt, borderRadius: 4, height: 4 }}>
            <div
              style={{
                height: "100%",
                background: T.text,
                width: `${(planned / TRIP.length) * 100}%`,
                borderRadius: 4,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        )}
      </div>

      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: 20, top: 0, bottom: 0, width: 1.5, background: T.borderLight }} />
        {TRIP.map((day) => {
          const done = !!outfits[day.id];
          const open = expanded === day.id;
          return (
            <div key={day.id} style={{ display: "flex", gap: 0, marginBottom: 10 }}>
              <div style={{ width: 42, flexShrink: 0, display: "flex", justifyContent: "center", paddingTop: 18 }}>
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: done ? T.text : T.surface,
                    border: `2px solid ${done ? T.text : T.border}`,
                    zIndex: 1,
                    transition: "all 0.2s",
                  }}
                />
              </div>
              <div
                style={{
                  flex: 1,
                  background: T.surface,
                  border: `1.5px solid ${T.borderLight}`,
                  borderRadius: 14,
                  overflow: "hidden",
                }}
              >
                <div
                  onClick={() => setExpanded(open ? null : day.id)}
                  style={{
                    padding: "13px 14px",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                      <span style={{ fontSize: 15 }}>{day.e}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{day.city}</span>
                    </div>
                    <p style={{ fontSize: 10, color: T.light, marginBottom: 6 }}>{day.date}</p>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {day.day && <Chip text={day.day} />}
                      {day.night && <Chip text={day.night} colors={["#4A1942", "#F9A8D4"]} />}
                      <Chip text={day.w} colors={T.weather[day.w]} />
                      <Chip text={day.occ} colors={T.occ[day.occ]} />
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 7, marginLeft: 10 }}>
                    {done && (
                      <div style={{ display: "flex" }}>
                        {outfits[day.id].slice(0, 3).map((item, i) => {
                          const [bg, ac] = swatch(item.col);
                          return (
                            <div
                              key={item.id}
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 7,
                                overflow: "hidden",
                                border: `2px solid ${T.surface}`,
                                marginLeft: i > 0 ? -6 : 0,
                                background: `linear-gradient(145deg,${bg},${ac})`,
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 10,
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
                          );
                        })}
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        genOne(day);
                      }}
                      disabled={gen === day.id}
                      style={{
                        padding: "5px 12px",
                        background: done ? "none" : T.text,
                        color: done ? T.mid : T.bg,
                        border: `1.5px solid ${done ? T.border : T.text}`,
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {gen === day.id ? "…" : done ? "↺" : "Plan"}
                    </button>
                  </div>
                </div>
                {open && done && (
                  <div style={{ borderTop: `1.5px solid ${T.borderLight}`, padding: "14px" }}>
                    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
                      {outfits[day.id].map((item) => (
                        <div key={item.id} style={{ flexShrink: 0, textAlign: "center" }}>
                          <ItemVisual item={item} size={85} />
                          <div style={{ marginTop: 5 }}>
                            <Chip text={LAYERS[item.l] || item.l} />
                          </div>
                        </div>
                      ))}
                    </div>
                    {tips[day.id] && (
                      <div
                        style={{
                          marginTop: 10,
                          background: "#1A2744",
                          borderRadius: 10,
                          padding: "10px 12px",
                          fontSize: 12,
                          color: "#93C5FD",
                          fontStyle: "italic",
                          lineHeight: 1.5,
                        }}
                      >
                        "{tips[day.id]}"
                      </div>
                    )}
                    {!tips[day.id] && (
                      <button
                        onClick={() =>
                          aiTip(outfits[day.id], day.occ, day.w, day.city, day.day).then((t) =>
                            setTips((p) => ({ ...p, [day.id]: t }))
                          )
                        }
                        style={{
                          marginTop: 8,
                          width: "100%",
                          padding: "7px",
                          background: "none",
                          border: `1px solid ${T.border}`,
                          borderRadius: 8,
                          fontSize: 11,
                          color: T.mid,
                          cursor: "pointer",
                        }}
                      >
                        ✨ AI tip
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
