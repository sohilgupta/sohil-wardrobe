// src/components/GuestLanding.jsx
/* ─── GuestLanding ────────────────────────────────────────────────────────────
   Shown in WardrobeTab when: isGuest && wardrobe.length === 0 && !isDemoMode
   Props: onAddItem (opens add form), onTryDemo (loads demo + navigates)
   ─────────────────────────────────────────────────────────────────────────── */

import { T } from "../theme";
import { LIMITS } from "../utils/tiers";

/* ── Static demo preview data (decorative only) ─────────────────────────── */
const PREVIEW_DAYS = [
  {
    city:    "Day 1 · Sydney",
    swatches: ["#F0EBE1", "#1B2A4A", "#BDB592", "#7B4F2E"],
    occ:     "Casual",
    weather: "Warm",
    occColor:  ["rgba(10,132,255,0.15)", "#60A5FA", "rgba(10,132,255,0.25)"],
    wColor:    ["rgba(251,191,36,0.1)",  "#FBBF24", "rgba(251,191,36,0.25)"],
  },
  {
    city:    "Day 2 · Melbourne",
    swatches: ["#1C1C1C", "#374151", "#C19A6B", "#4A2C17"],
    occ:     "Dinner",
    weather: "Mild",
    occColor:  ["rgba(10,132,255,0.15)", "#60A5FA", "rgba(10,132,255,0.25)"],
    wColor:    ["rgba(74,222,128,0.1)",  "#4ADE80", "rgba(74,222,128,0.25)"],
  },
];

function Chip({ label, bg, color, border }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
      background: bg, color, border: `1px solid ${border}`, display: "inline-block" }}>
      {label}
    </span>
  );
}

export default function GuestLanding({ onAddItem, onTryDemo }) {
  return (
    <div style={{ animation: "fadeUp 0.4s ease both" }}>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
        textTransform: "uppercase", color: T.accent, marginBottom: 8 }}>
        Your Wardrobe
      </p>
      <p style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.8,
        color: T.text, lineHeight: 1.1, marginBottom: 10 }}>
        Plan outfits from<br />your wardrobe
      </p>
      <p style={{ fontSize: 14, color: T.mid, lineHeight: 1.6, marginBottom: 22 }}>
        Add a few items — Vesti builds your outfits automatically.
      </p>

      {/* ── CTAs ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 32 }}>
        <button onClick={onAddItem}
          style={{ flex: 1, background: T.accent, color: "#fff", border: "none",
            borderRadius: 12, padding: "12px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          + Add your first item
        </button>
        <button onClick={onTryDemo}
          style={{ flex: 1, background: "transparent", color: T.accent,
            border: `1.5px solid ${T.accentBorder}`, borderRadius: 12,
            padding: "12px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Try demo →
        </button>
      </div>

      {/* ── Demo preview ─────────────────────────────────────────────────── */}
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
        textTransform: "uppercase", color: T.light, marginBottom: 10 }}>
        Demo preview
      </p>

      {/* 2-column day cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        {PREVIEW_DAYS.map((d) => (
          <div key={d.city} style={{ background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 12, padding: 12 }}>
            <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em",
              textTransform: "uppercase", color: T.light, marginBottom: 8 }}>
              {d.city}
            </p>
            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
              {d.swatches.map((hex) => (
                <div key={hex} style={{ width: 22, height: 22, borderRadius: 4, background: hex }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <Chip label={d.occ} bg={d.occColor[0]} color={d.occColor[1]} border={d.occColor[2]} />
              <Chip label={d.weather} bg={d.wColor[0]} color={d.wColor[1]} border={d.wColor[2]} />
            </div>
          </div>
        ))}
      </div>

      {/* Outfit strip */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 12, padding: 12, display: "flex", alignItems: "center",
        gap: 10, marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {["#1C1C1C", "#1B2A4A", "#4A2C17"].map((hex) => (
            <div key={hex} style={{ width: 20, height: 28, borderRadius: 4, background: hex }} />
          ))}
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: T.text, marginBottom: 2 }}>
            Evening · Day 3 · Queenstown
          </p>
          <p style={{ fontSize: 10, color: T.mid }}>
            Black top · Navy trousers · Brown boots
          </p>
        </div>
      </div>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
        textTransform: "uppercase", color: T.light, marginBottom: 10 }}>
        How it works
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { icon: "👔", label: "Add\nclothes" },
          { icon: "✈️", label: "Plan\ntrip" },
          { icon: "✨", label: "AI\noutfits" },
        ].map((s) => (
          <div key={s.label} style={{ flex: 1, textAlign: "center",
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 12, padding: "10px 6px" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 10, color: T.mid, lineHeight: 1.4,
              whiteSpace: "pre-line" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Limit hint ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8,
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 10, padding: "8px 12px" }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%",
          background: T.green, flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: T.light }}>
          Free · {LIMITS.guest.wardrobe} items · {LIMITS.guest.trips} trip · No account needed
        </span>
      </div>
    </div>
  );
}
