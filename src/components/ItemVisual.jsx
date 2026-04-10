import { useState } from "react";
import { T, swatch, CAT_EMOJI } from "../theme";

/* ─── ITEM VISUAL ──────────────────────────────────────────────────────────── */
export default function ItemVisual({ item, size = 160 }) {
  const [failed, setFailed] = useState(false);
  const [bg, accent, fg] = swatch(item.col);
  const emoji = CAT_EMOJI[item.c] || "👕";
  const brandInit = (item.b || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (!item.img || failed) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 16,
          overflow: "hidden",
          flexShrink: 0,
          background: `linear-gradient(145deg, ${bg} 0%, ${accent} 100%)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          userSelect: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
          }}
        />
        <div
          style={{
            fontSize: size * 0.38,
            fontWeight: 800,
            color: fg,
            opacity: 0.12,
            lineHeight: 1,
            fontFamily: "'Cormorant Garamond',Georgia,serif",
            letterSpacing: -4,
            position: "absolute",
          }}
        >
          {brandInit}
        </div>
        <div
          style={{
            fontSize: size * 0.22,
            lineHeight: 1,
            marginBottom: 4,
            position: "relative",
            zIndex: 1,
          }}
        >
          {emoji}
        </div>
        <div
          style={{
            fontSize: Math.max(8, size * 0.075),
            fontWeight: 700,
            color: fg,
            opacity: 0.55,
            letterSpacing: 0.8,
            textAlign: "center",
            padding: "0 10px",
            lineHeight: 1.3,
            position: "relative",
            zIndex: 1,
          }}
        >
          {item.col.toUpperCase()}
        </div>
        <div
          style={{
            fontSize: Math.max(7, size * 0.06),
            fontWeight: 500,
            color: fg,
            opacity: 0.35,
            marginTop: 2,
            letterSpacing: 1,
            position: "relative",
            zIndex: 1,
          }}
        >
          {item.b?.toUpperCase()}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 16,
        overflow: "hidden",
        flexShrink: 0,
        background: T.alt,
      }}
    >
      <img
        src={item.img}
        alt={item.n}
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  );
}
