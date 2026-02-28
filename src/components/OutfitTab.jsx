/* ─── OUTFIT AI TAB — Gemini single outfit generator + Apply to Day ───────────
   1. User picks Occasion / Weather / Location (optional) / Activity (optional).
   2. "Generate" calls Gemini → returns { base, mid, outer, bottom, shoes } IDs.
   3. Outfit displayed using OutfitCard (read-only, no swap/regen).
   4. "Apply to Day" section: pick a trip day + slot → writes to outfitIds.
   ─────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import { T } from "../theme";
import TRIP from "../data/trip";
import { generateSingleOutfit } from "../utils/tripGenerator";
import OutfitCard from "./OutfitCard";

/* ── Resolve slot IDs → full item objects ─────────────────────────────────── */
function resolveIds(ids, wardrobe) {
  if (!ids) return null;
  const find = (id) => (id ? wardrobe.find((i) => i.id === id) || null : null);
  return {
    base:   find(ids.base),
    mid:    find(ids.mid),
    outer:  find(ids.outer),
    bottom: find(ids.bottom),
    shoes:  find(ids.shoes),
  };
}

/* ─── OUTFIT AI TAB ─────────────────────────────────────────────────────── */
export default function OutfitTab({ wardrobe = [], outfitIds = {}, setOutfitIds }) {
  /* ── Generator inputs ── */
  const [occ, setOcc]   = useState("Casual");
  const [wth, setWth]   = useState("Mild");
  const [city, setCity] = useState("");
  const [act,  setAct]  = useState("");

  /* ── Generation state ── */
  const [genLoading,    setGenLoading]    = useState(false);
  const [genError,      setGenError]      = useState(null);
  const [generatedIds,  setGeneratedIds]  = useState(null); // slot IDs from AI
  const [generatedItem, setGeneratedItem] = useState(null); // resolved items

  /* ── Apply-to-Day state ── */
  const [applyDay,     setApplyDay]     = useState(TRIP[0]?.id || "");
  const [applySlot,    setApplySlot]    = useState("daytime");
  const [applySuccess, setApplySuccess] = useState(null);

  /* ── Call Gemini for a single outfit ── */
  async function handleGenerate() {
    if (genLoading || wardrobe.length === 0) return;
    setGenLoading(true);
    setGenError(null);
    setGeneratedIds(null);
    setGeneratedItem(null);
    setApplySuccess(null);
    try {
      const ids = await generateSingleOutfit({ wardrobe, occ, weather: wth, city, act });
      setGeneratedIds(ids);
      setGeneratedItem(resolveIds(ids, wardrobe));
    } catch (err) {
      setGenError(err.message || "Generation failed. Try again.");
    } finally {
      setGenLoading(false);
    }
  }

  /* ── Apply generated outfit to the selected day + slot ── */
  function handleApply() {
    if (!generatedIds || !applyDay) return;
    setOutfitIds((prev) => {
      const dayData = prev[applyDay] || { daytime: null, evening: null };
      return {
        ...prev,
        [applyDay]: { ...dayData, [applySlot]: generatedIds },
      };
    });
    const tripDay = TRIP.find((d) => d.id === applyDay);
    const label = tripDay ? `${tripDay.city} (${applySlot})` : applyDay;
    setApplySuccess(`✓ Applied to ${label}`);
    setTimeout(() => setApplySuccess(null), 4000);
  }

  /* ── Current outfit for the selected day/slot (for "will replace" preview) */
  const existingIds = outfitIds[applyDay]?.[applySlot] || null;
  const hasExisting = existingIds && Object.values(existingIds).some((v) => v && v !== "REMOVED");

  return (
    <div>
      {/* ── Inputs card ── */}
      <div
        style={{
          background: T.surface,
          border: `1.5px solid ${T.borderLight}`,
          borderRadius: 16,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: T.light,
            letterSpacing: 1.5,
            marginBottom: 16,
          }}
        >
          BUILD YOUR OUTFIT
        </p>

        {/* Occasion */}
        <p style={{ fontSize: 11, fontWeight: 700, color: T.mid, marginBottom: 8 }}>OCCASION</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {["Casual", "Dinner", "Flight", "Hiking", "Gym", "Formal"].map((o) => (
            <button
              key={o}
              onClick={() => { setOcc(o); setGeneratedIds(null); setGeneratedItem(null); }}
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

        {/* Weather */}
        <p style={{ fontSize: 11, fontWeight: 700, color: T.mid, marginBottom: 8 }}>WEATHER</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[
            ["Cold", "🥶"],
            ["Mild", "🌤"],
            ["Warm", "☀️"],
          ].map(([w, e]) => (
            <button
              key={w}
              onClick={() => { setWth(w); setGeneratedIds(null); setGeneratedItem(null); }}
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

        {/* Location + Activity */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            ["Location", city, setCity, "e.g. Sydney"],
            ["Activity", act,  setAct,  "e.g. Bondi Beach"],
          ].map(([lbl, val, set, ph]) => (
            <div key={lbl}>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: T.light,
                  letterSpacing: 1,
                  marginBottom: 5,
                }}
              >
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

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={genLoading || wardrobe.length === 0}
          style={{
            width: "100%",
            padding: 15,
            background: genLoading ? T.alt : T.text,
            color: genLoading ? T.light : T.bg,
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            cursor: genLoading || wardrobe.length === 0 ? "not-allowed" : "pointer",
            opacity: genLoading ? 0.7 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontFamily: "inherit",
          }}
        >
          {genLoading ? (
            <>
              <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>◌</span>
              Generating…
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </>
          ) : (
            "✨ Generate Outfit →"
          )}
        </button>

        {/* Error */}
        {genError && (
          <div
            style={{
              marginTop: 10,
              background: "#2D0A0A",
              border: "1.5px solid #7F1D1D",
              borderRadius: 10,
              padding: "9px 12px",
              fontSize: 11,
              color: "#FCA5A5",
              lineHeight: 1.5,
            }}
          >
            ⚠ {genError}
          </div>
        )}
      </div>

      {/* ── Generated outfit ── */}
      {(genLoading || generatedItem) && (
        <div
          style={{
            background: T.surface,
            border: `1.5px solid ${T.borderLight}`,
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 700, color: T.light, letterSpacing: 1.5 }}>
              YOUR OUTFIT
            </p>
            {!genLoading && generatedItem && (
              <button
                onClick={handleGenerate}
                style={{
                  padding: "5px 14px",
                  borderRadius: 8,
                  border: `1.5px solid ${T.border}`,
                  background: "none",
                  fontSize: 12,
                  color: T.mid,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                ↺ Regenerate
              </button>
            )}
          </div>

          <OutfitCard
            outfit={generatedItem}
            onSwap={null}
            onRegenerate={null}
            loading={genLoading}
          />
        </div>
      )}

      {/* ── Apply to Day ── */}
      {generatedIds && !genLoading && (
        <div
          style={{
            background: T.surface,
            border: `1.5px solid ${T.borderLight}`,
            borderRadius: 16,
            padding: 20,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: T.light,
              letterSpacing: 1.5,
              marginBottom: 16,
            }}
          >
            APPLY TO A DAY
          </p>

          {/* Day selector */}
          <p style={{ fontSize: 11, fontWeight: 700, color: T.mid, marginBottom: 8 }}>DAY</p>
          <select
            value={applyDay}
            onChange={(e) => setApplyDay(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: T.alt,
              border: `1.5px solid ${T.borderLight}`,
              borderRadius: 10,
              fontSize: 13,
              color: T.text,
              fontFamily: "inherit",
              outline: "none",
              marginBottom: 14,
              cursor: "pointer",
              appearance: "none",
              WebkitAppearance: "none",
            }}
          >
            {TRIP.map((d) => (
              <option key={d.id} value={d.id}>
                {d.id.toUpperCase()} · {d.city} ({d.date})
              </option>
            ))}
          </select>

          {/* Slot selector */}
          <p style={{ fontSize: 11, fontWeight: 700, color: T.mid, marginBottom: 8 }}>SLOT</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[
              ["daytime", "☀️ Daytime"],
              ["evening", "🌙 Evening"],
            ].map(([s, label]) => (
              <button
                key={s}
                onClick={() => setApplySlot(s)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 12,
                  border: `1.5px solid ${applySlot === s ? T.text : T.border}`,
                  background: applySlot === s ? T.text : "transparent",
                  color: applySlot === s ? T.bg : T.mid,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontFamily: "inherit",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* "Will replace" notice */}
          {hasExisting && (
            <div
              style={{
                marginBottom: 12,
                background: "#2D1A0A",
                border: "1px solid #92400E",
                borderRadius: 10,
                padding: "8px 12px",
                fontSize: 11,
                color: "#FCD34D",
                lineHeight: 1.5,
              }}
            >
              ⚠ This will replace the existing {applySlot} outfit for{" "}
              {TRIP.find((d) => d.id === applyDay)?.city || applyDay}.
            </div>
          )}

          {/* Apply button */}
          <button
            onClick={handleApply}
            style={{
              width: "100%",
              padding: 14,
              background: applySuccess ? "#0C2010" : T.text,
              color: applySuccess ? "#4ADE80" : T.bg,
              border: applySuccess ? "1.5px solid #4ADE80" : "none",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.2s",
            }}
          >
            {applySuccess || "Apply to Day →"}
          </button>
        </div>
      )}
    </div>
  );
}
