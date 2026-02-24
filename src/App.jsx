import { useState } from "react";
import { T } from "./theme";
import W from "./data/wardrobe";
import WardrobeTab from "./components/WardrobeTab";
import TripTab from "./components/TripTab";
import OutfitTab from "./components/OutfitTab";
import AddTab from "./components/AddTab";
import PackTab from "./components/PackTab";

const NAV = [
  { id: "wardrobe", icon: "⊞", label: "WARDROBE" },
  { id: "trip", icon: "✈", label: "TRIP" },
  { id: "outfit", icon: "✦", label: "OUTFIT AI" },
  { id: "add", icon: "+", label: "ADD" },
  { id: "packing", icon: "⊛", label: "PACKING" },
];

/* ─── ROOT ─────────────────────────────────────────────────────────────────── */
export default function App() {
  const [tab, setTab] = useState("wardrobe");
  const [wardrobe, setWardrobe] = useState(W);
  const travel = wardrobe.filter((i) => i.t === "Yes").length;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        fontFamily: "'DM Sans','Helvetica Neue',sans-serif",
        color: T.text,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;700&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:4px}
        ::-webkit-scrollbar-track{background:transparent}
        select,input{outline:none;}
        select option{background:${T.surface};color:${T.text};}
        button:active{transform:scale(0.98);}
        body{background:${T.bg};color:${T.text};}
        ::placeholder{color:${T.light};}
      `}</style>

      {/* Header */}
      <div
        style={{
          background: T.surface,
          borderBottom: `1px solid ${T.borderLight}`,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 16px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              height: 54,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span
                style={{
                  fontFamily: "'Cormorant Garamond',serif",
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: -0.5,
                  color: T.text,
                }}
              >
                SOHIL-WARDROBE
              </span>
              <span style={{ fontSize: 10, color: T.light, letterSpacing: 2, fontWeight: 600 }}>
                AU·NZ 2026
              </span>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: T.text, lineHeight: 1 }}>
                  {wardrobe.length}
                </p>
                <p style={{ fontSize: 8, color: T.light, letterSpacing: 1, marginTop: 1 }}>ITEMS</p>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: T.green, lineHeight: 1 }}>{travel}</p>
                <p style={{ fontSize: 8, color: T.light, letterSpacing: 1, marginTop: 1 }}>TRAVEL</p>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", borderTop: `1px solid ${T.borderLight}` }}>
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                style={{
                  flex: 1,
                  padding: "9px 0 10px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  position: "relative",
                }}
              >
                <span style={{ fontSize: 13, color: tab === n.id ? T.text : T.light }}>{n.icon}</span>
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: tab === n.id ? 700 : 500,
                    color: tab === n.id ? T.text : T.light,
                    letterSpacing: 0.8,
                  }}
                >
                  {n.label}
                </span>
                {tab === n.id && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: "15%",
                      right: "15%",
                      height: 2,
                      background: T.text,
                      borderRadius: 2,
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px 100px" }}>
        {tab === "wardrobe" && <WardrobeTab wardrobe={wardrobe} />}
        {tab === "trip" && <TripTab wardrobe={wardrobe} />}
        {tab === "outfit" && <OutfitTab wardrobe={wardrobe} />}
        {tab === "add" && <AddTab onAdd={(item) => setWardrobe((w) => [...w, item])} />}
        {tab === "packing" && <PackTab wardrobe={wardrobe} />}
      </div>
    </div>
  );
}
