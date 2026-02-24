import { useState } from "react";
import { T } from "../theme";
import { pick } from "../engine/outfitEngine";
import { aiTip } from "../engine/ai";
import ItemVisual from "./ItemVisual";
import Chip from "./Chip";

const LAYERS = { Base: "TOP", Mid: "MID", Outer: "OUTER", Bottom: "BOTTOM", Footwear: "SHOES" };

/* ─── OUTFIT GENERATOR ─────────────────────────────────────────────────────── */
export default function OutfitTab({ wardrobe }) {
  const [occ, setOcc] = useState("Casual");
  const [wth, setWth] = useState("Mild");
  const [city, setCity] = useState("");
  const [act, setAct] = useState("");
  const [outfit, setOutfit] = useState(null);
  const [tip, setTip] = useState("");
  const [tl, setTl] = useState(false);
  const [gl, setGl] = useState(false);

  const gen = async () => {
    setGl(true);
    const o = pick(wardrobe, { occ, w: wth });
    setOutfit(o);
    setTip("");
    setGl(false);
    if (city || act) {
      setTl(true);
      const t = await aiTip(o, occ, wth, city, act);
      setTip(t);
      setTl(false);
    }
  };

  return (
    <div>
      <div
        style={{
          background: T.surface,
          border: `1.5px solid ${T.borderLight}`,
          borderRadius: 16,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <p style={{ fontSize: 11, fontWeight: 700, color: T.light, letterSpacing: 1.5, marginBottom: 14 }}>
          BUILD YOUR OUTFIT
        </p>
        <p style={{ fontSize: 11, fontWeight: 700, color: T.mid, marginBottom: 8 }}>OCCASION</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {["Casual", "Dinner", "Flight", "Hiking", "Gym", "Formal"].map((o) => (
            <button
              key={o}
              onClick={() => setOcc(o)}
              style={{
                padding: "8px 16px",
                borderRadius: 20,
                border: `1.5px solid ${occ === o ? T.text : T.border}`,
                background: occ === o ? T.text : "transparent",
                color: occ === o ? T.bg : T.mid,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {o}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, fontWeight: 700, color: T.mid, marginBottom: 8 }}>WEATHER</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[
            ["Cold", "🥶"],
            ["Mild", "🌤"],
            ["Warm", "☀️"],
          ].map(([w, e]) => (
            <button
              key={w}
              onClick={() => setWth(w)}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 12,
                border: `1.5px solid ${wth === w ? T.text : T.border}`,
                background: wth === w ? T.text : "transparent",
                color: wth === w ? T.bg : T.mid,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {e} {w}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            ["Location", city, setCity, "e.g. Sydney"],
            ["Activity", act, setAct, "e.g. Bondi Beach"],
          ].map(([lbl, val, set, ph]) => (
            <div key={lbl}>
              <p style={{ fontSize: 10, fontWeight: 700, color: T.light, letterSpacing: 1, marginBottom: 5 }}>
                {lbl.toUpperCase()} (OPTIONAL)
              </p>
              <input
                value={val}
                onChange={(e) => set(e.target.value)}
                placeholder={ph}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  background: T.alt,
                  border: `1.5px solid ${T.borderLight}`,
                  borderRadius: 10,
                  fontSize: 13,
                  color: T.text,
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          ))}
        </div>
        <button
          onClick={gen}
          disabled={gl}
          style={{
            width: "100%",
            padding: 15,
            background: T.text,
            color: T.bg,
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            opacity: gl ? 0.7 : 1,
          }}
        >
          {gl ? "Generating…" : "Generate Outfit →"}
        </button>
      </div>

      {outfit && (
        <div
          style={{
            background: T.surface,
            border: `1.5px solid ${T.borderLight}`,
            borderRadius: 16,
            padding: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: T.light, letterSpacing: 1.5 }}>YOUR OUTFIT</p>
            <button
              onClick={() => {
                const o = pick(wardrobe, { occ, w: wth });
                setOutfit(o);
                setTip("");
                if (city || act) {
                  setTl(true);
                  aiTip(o, occ, wth, city, act).then((t) => {
                    setTip(t);
                    setTl(false);
                  });
                }
              }}
              style={{
                padding: "5px 14px",
                borderRadius: 8,
                border: `1.5px solid ${T.border}`,
                background: "none",
                fontSize: 12,
                color: T.mid,
                cursor: "pointer",
              }}
            >
              ↺ Shuffle
            </button>
          </div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
            {outfit.map((item) => (
              <div key={item.id} style={{ flexShrink: 0, textAlign: "center" }}>
                <ItemVisual item={item} size={100} />
                <div style={{ marginTop: 6 }}>
                  <Chip text={LAYERS[item.l] || item.l} />
                </div>
              </div>
            ))}
          </div>
          {tl && (
            <div
              style={{
                marginTop: 14,
                background: T.alt,
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 12,
                color: T.light,
              }}
            >
              ✨ Getting AI tip…
            </div>
          )}
          {tip && (
            <div
              style={{
                marginTop: 14,
                background: "#1A2744",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 13,
                color: "#93C5FD",
                lineHeight: 1.6,
                fontStyle: "italic",
              }}
            >
              "{tip}"
            </div>
          )}
          {!tip && !tl && (
            <button
              onClick={() => {
                setTl(true);
                aiTip(outfit, occ, wth, city, act).then((t) => {
                  setTip(t);
                  setTl(false);
                });
              }}
              style={{
                marginTop: 12,
                width: "100%",
                padding: 10,
                background: "none",
                border: `1.5px solid ${T.border}`,
                borderRadius: 10,
                fontSize: 13,
                color: T.mid,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ✨ Get AI styling tip
            </button>
          )}
        </div>
      )}
    </div>
  );
}
