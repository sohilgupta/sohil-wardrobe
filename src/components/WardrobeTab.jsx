import { useState } from "react";
import { T } from "../theme";
import ItemVisual from "./ItemVisual";
import Chip from "./Chip";

/* ─── WARDROBE TAB ─────────────────────────────────────────────────────────── */
export default function WardrobeTab({ wardrobe }) {
  const cats = [...new Set(wardrobe.map((i) => i.c))].sort();
  const [cat, setCat] = useState("");
  const [occ, setOcc] = useState("");
  const [wth, setWth] = useState("");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState(null);

  const f = wardrobe.filter(
    (i) =>
      (!cat || i.c === cat) &&
      (!occ || i.occ === occ) &&
      (!wth || i.w === wth) &&
      (!q ||
        i.n.toLowerCase().includes(q.toLowerCase()) ||
        i.col.toLowerCase().includes(q.toLowerCase()) ||
        (i.b || "").toLowerCase().includes(q.toLowerCase()))
  );

  const selStyle = {
    padding: "7px 28px 7px 12px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    appearance: "none",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    outline: "none",
  };

  const activeSelBg = (active) =>
    active ? T.text : T.surface;
  const activeSelColor = (active) =>
    active ? "#fff" : T.mid;
  const activeSelBorder = (active) =>
    `1.5px solid ${active ? T.text : T.border}`;
  const selArrow = (active) =>
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='${active ? "%23fff" : "%23666"}'/%3E%3C/svg%3E")`;

  return (
    <div>
      {/* Search bar */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <span
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            color: T.light,
            fontSize: 16,
          }}
        >
          ⌕
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, color, brand…"
          style={{
            width: "100%",
            padding: "11px 14px 11px 38px",
            background: T.surface,
            border: `1.5px solid ${T.border}`,
            borderRadius: 12,
            fontSize: 14,
            color: T.text,
            outline: "none",
            boxSizing: "border-box",
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          style={{
            ...selStyle,
            background: activeSelBg(cat),
            color: activeSelColor(cat),
            border: activeSelBorder(cat),
            backgroundImage: selArrow(cat),
          }}
        >
          <option value="">Category</option>
          {cats.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <select
          value={occ}
          onChange={(e) => setOcc(e.target.value)}
          style={{
            ...selStyle,
            background: activeSelBg(occ),
            color: activeSelColor(occ),
            border: activeSelBorder(occ),
            backgroundImage: selArrow(occ),
          }}
        >
          <option value="">Occasion</option>
          {["Casual", "Dinner", "Flight", "Hiking", "Gym", "Formal"].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <select
          value={wth}
          onChange={(e) => setWth(e.target.value)}
          style={{
            ...selStyle,
            background: activeSelBg(wth),
            color: activeSelColor(wth),
            border: activeSelBorder(wth),
            backgroundImage: selArrow(wth),
          }}
        >
          <option value="">Weather</option>
          {["Cold", "Mild", "Warm"].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        {(cat || occ || wth || q) && (
          <button
            onClick={() => {
              setCat("");
              setOcc("");
              setWth("");
              setQ("");
            }}
            style={{
              padding: "7px 14px",
              background: "none",
              border: `1.5px solid ${T.border}`,
              borderRadius: 20,
              fontSize: 12,
              color: T.mid,
              cursor: "pointer",
            }}
          >
            Clear ×
          </button>
        )}
      </div>
      <p style={{ fontSize: 12, color: T.light, marginBottom: 16 }}>
        {f.length} of {wardrobe.length} items
      </p>

      {/* Detail sheet */}
      {detail && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 300,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onClick={() => setDetail(null)}
        >
          <div
            style={{
              background: T.surface,
              borderRadius: "20px 20px 0 0",
              padding: 24,
              width: "100%",
              maxWidth: 520,
              maxHeight: "85vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <ItemVisual item={detail} size={110} />
              <div style={{ flex: 1 }}>
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: T.text,
                    lineHeight: 1.3,
                    marginBottom: 4,
                  }}
                >
                  {detail.n}
                </p>
                <p style={{ fontSize: 13, color: T.mid, marginBottom: 12 }}>
                  {detail.b}
                </p>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  <Chip text={detail.col} />
                  <Chip text={detail.c} />
                  <Chip text={detail.occ} colors={T.occ[detail.occ]} />
                  <Chip text={detail.w} colors={T.weather[detail.w]} />
                  {detail.t === "Yes" && (
                    <Chip text="✈ Travel" colors={["#14532D", "#4ADE80"]} />
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setDetail(null)}
              style={{
                width: "100%",
                padding: 13,
                background: T.text,
                color: T.bg,
                border: "none",
                borderRadius: 12,
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(148px,1fr))",
          gap: 16,
        }}
      >
        {f.map((item) => (
          <div key={item.id} onClick={() => setDetail(item)} style={{ cursor: "pointer" }}>
            <div style={{ position: "relative" }}>
              <ItemVisual item={item} size={148} />
              {item.t === "Yes" && (
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    background: "rgba(0,0,0,0.6)",
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: 6,
                    letterSpacing: 0.5,
                  }}
                >
                  ✈
                </div>
              )}
            </div>
            <div style={{ padding: "8px 2px 0" }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: T.text,
                  lineHeight: 1.3,
                  marginBottom: 3,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {item.n}
              </p>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <Chip text={item.col} />
                <Chip text={item.w} colors={T.weather[item.w]} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
