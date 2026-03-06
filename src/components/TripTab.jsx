/* ─── TRIP TAB — Overview + "Plan All" via Gemini + Navigate to Daily ─────────
   - Timeline of all trip days (read-only overview).
   - Outfit mini-preview per day pulled from shared outfitIds (Daily state).
   - "Plan All" → calls generateTripOutfits → writes to setOutfitIds (Daily).
   - Clicking a day → calls onNavigateToDay to jump to Daily tab for that day.
   - No per-day Plan/↺ buttons (editing happens in Daily).
   ─────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import { T, swatch } from "../theme";
import TRIP from "../data/trip";
import { generateTripOutfits } from "../utils/tripGenerator";
import Chip from "./Chip";

/* ─── Resolve up to N item objects from a day's outfitIds entry ─────────── */
function getDayItems(dayId, outfitIds, wardrobe, limit = 4) {
  const data = outfitIds[dayId];
  if (!data) return [];
  const ids = new Set();
  ["daytime", "evening"].forEach((slot) => {
    const slotIds = data[slot];
    if (!slotIds) return;
    Object.values(slotIds).forEach((id) => {
      if (id && id !== "REMOVED") ids.add(id);
    });
  });
  return [...ids]
    .slice(0, limit)
    .map((id) => wardrobe.find((i) => i.id === id))
    .filter(Boolean);
}

/* ─── Does a day have any real outfit data? ─────────────────────────────── */
function isPlanned(dayId, outfitIds) {
  const data = outfitIds[dayId];
  if (!data) return false;
  const hasReal = (ids) => ids && Object.values(ids).some((v) => v && v !== "REMOVED");
  return hasReal(data.daytime) || hasReal(data.evening);
}

/* ─── TRIP TAB ───────────────────────────────────────────────────────────── */
export default function TripTab({
  wardrobe = [],
  outfitIds = {},
  setOutfitIds,
  frozenDays = {},
  onNavigateToDay,
  capsuleIds,
}) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDone,    setAiDone]    = useState(false);
  const [aiError,   setAiError]   = useState(null);

  const planned = TRIP.filter((d) => isPlanned(d.id, outfitIds)).length;
  const frozen  = TRIP.filter((d) => frozenDays[d.id]).length;

  /* ── Plan All → Gemini generates outfits for all non-frozen days ── */
  async function handlePlanAll() {
    if (aiLoading || wardrobe.length === 0) return;
    setAiLoading(true);
    setAiError(null);
    setAiDone(false);
    try {
      await generateTripOutfits({ wardrobe, frozenDays, outfitIds, setOutfitIds, capsuleIds });
      setAiDone(true);
      setTimeout(() => setAiDone(false), 3000);
    } catch (err) {
      setAiError(err.message || "Generation failed. Check your connection and try again.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div>
      {/* ── Header card ── */}
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
              {planned}/{TRIP.length} days planned · {frozen} frozen
            </p>
          </div>
          <button
            onClick={handlePlanAll}
            disabled={aiLoading || wardrobe.length === 0}
            style={{
              padding: "9px 18px",
              background: aiDone ? "#0C2010" : aiLoading ? T.alt : T.text,
              color: aiDone ? "#4ADE80" : aiLoading ? T.light : T.bg,
              border: aiDone ? "1.5px solid #4ADE80" : "none",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              cursor: aiLoading || wardrobe.length === 0 ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              opacity: aiLoading ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {aiLoading ? (
              <>
                <span style={{ animation: "spin 1.2s linear infinite", display: "inline-block" }}>◌</span>
                Generating…
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </>
            ) : aiDone ? (
              "✓ Done!"
            ) : (
              "✨ Plan All →"
            )}
          </button>
        </div>

        {/* Progress bar */}
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

        {/* Frozen note */}
        {frozen > 0 && !aiLoading && !aiDone && (
          <p style={{ fontSize: 10, color: T.light, marginTop: 8 }}>
            {frozen} frozen day{frozen !== 1 ? "s" : ""} will be skipped during generation
          </p>
        )}

        {/* Error */}
        {aiError && (
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
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <span style={{ flexShrink: 0 }}>⚠</span>
            <span>{aiError}</span>
          </div>
        )}
      </div>

      {/* ── Timeline ── */}
      <div style={{ position: "relative" }}>
        {/* Vertical line */}
        <div
          style={{
            position: "absolute",
            left: 20,
            top: 0,
            bottom: 0,
            width: 1.5,
            background: T.borderLight,
          }}
        />

        {TRIP.map((day) => {
          const done   = isPlanned(day.id, outfitIds);
          const frozen = frozenDays[day.id];
          const items  = getDayItems(day.id, outfitIds, wardrobe);

          return (
            <div key={day.id} style={{ display: "flex", gap: 0, marginBottom: 10 }}>
              {/* Timeline dot */}
              <div
                style={{
                  width: 42,
                  flexShrink: 0,
                  display: "flex",
                  justifyContent: "center",
                  paddingTop: 18,
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: frozen ? "#60A5FA" : done ? T.text : T.surface,
                    border: `2px solid ${frozen ? "#60A5FA" : done ? T.text : T.border}`,
                    zIndex: 1,
                    transition: "all 0.2s",
                  }}
                />
              </div>

              {/* Day card — clicking navigates to Daily */}
              <div
                onClick={() => onNavigateToDay && onNavigateToDay(day.id)}
                style={{
                  flex: 1,
                  background: T.surface,
                  border: `1.5px solid ${T.borderLight}`,
                  borderRadius: 14,
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = T.border)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.borderLight)}
              >
                <div
                  style={{
                    padding: "13px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  {/* Left: day info */}
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        marginBottom: 3,
                      }}
                    >
                      <span style={{ fontSize: 15 }}>{day.e}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                        {day.city}
                      </span>
                      {frozen && (
                        <span
                          title="Frozen"
                          style={{ fontSize: 11, marginLeft: 2 }}
                        >
                          🔒
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 10, color: T.light, marginBottom: 6 }}>{day.date}</p>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {day.day   && <Chip text={day.day} />}
                      {day.night && <Chip text={day.night} colors={["#4A1942", "#F9A8D4"]} />}
                      <Chip text={day.w}   colors={T.weather[day.w]} />
                      <Chip text={day.occ} colors={T.occ[day.occ]} />
                    </div>
                  </div>

                  {/* Right: item thumbnails + edit cue */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 7,
                      marginLeft: 10,
                      flexShrink: 0,
                    }}
                  >
                    {/* Outfit thumbnails */}
                    {items.length > 0 && (
                      <div style={{ display: "flex" }}>
                        {items.map((item, i) => {
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
                              }}
                            >
                              {item.img && (
                                <img
                                  src={item.img}
                                  alt=""
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                  }}
                                  onError={(e) => (e.target.style.display = "none")}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Edit cue */}
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: 0.8,
                        color: T.light,
                        opacity: 0.7,
                      }}
                    >
                      {done ? "Edit →" : "Plan →"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p
        style={{
          fontSize: 9,
          color: T.light,
          textAlign: "center",
          marginTop: 12,
          letterSpacing: 0.5,
        }}
      >
        CLICK ANY DAY TO EDIT IN DAILY TAB · FREEZE DAYS TO ADD TO PACKING LIST
      </p>
    </div>
  );
}
