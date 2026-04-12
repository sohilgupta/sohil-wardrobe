/* ─── TRIP TAB ────────────────────────────────────────────────────────────────
   - Multi-trip switcher
   - Dynamic trip days from useTripStore (replaces hardcoded src/data/trip.js)
   - Inline day editing (city, activity, weather, occasion)
   - TripCreator modal for new trips
   - "Plan All" AI generation unchanged
   ─────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import { T, swatch } from "../theme";
import useTripStore from "../hooks/useTripStore";
import { useTier } from "../contexts/AuthContext";
import { generateTripOutfits } from "../utils/tripGenerator";
import Chip from "./Chip";
import TripCreator from "./TripCreator";

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

function isPlanned(dayId, outfitIds) {
  const data = outfitIds[dayId];
  if (!data) return false;
  const hasReal = (ids) => ids && Object.values(ids).some((v) => v && v !== "REMOVED");
  return hasReal(data.daytime) || hasReal(data.evening);
}

export default function TripTab({
  wardrobe = [],
  outfitIds = {},
  setOutfitIds,
  frozenDays = {},
  onNavigateToDay,
  capsuleIds,
}) {
  const { trips, activeTrip, activeTripId, setActiveTrip, createTrip, updateTripDay } = useTripStore();
  const { limits, isGuest } = useTier();
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiDone,      setAiDone]      = useState(false);
  const [aiError,     setAiError]     = useState(null);
  const [showCreator, setShowCreator] = useState(false);
  const [editingDay,  setEditingDay]  = useState(null);

  const TRIP = activeTrip?.days || [];
  const planned = TRIP.filter((d) => isPlanned(d.id, outfitIds)).length;
  const frozen  = TRIP.filter((d) => frozenDays[d.id]).length;

  async function handlePlanAll() {
    if (aiLoading || wardrobe.length === 0) return;
    setAiLoading(true); setAiError(null); setAiDone(false);
    try {
      await generateTripOutfits({ wardrobe, frozenDays, outfitIds, setOutfitIds, capsuleIds });
      setAiDone(true);
      setTimeout(() => setAiDone(false), 3000);
    } catch (err) {
      setAiError(err.message || "Generation failed. Check your connection.");
    } finally { setAiLoading(false); }
  }

  function handleNewTrip() {
    if (trips.length >= limits.trips) {
      window.dispatchEvent(new CustomEvent("vesti-limit-reached", { detail: { type: "trips" } }));
    } else {
      setShowCreator(true);
    }
  }

  function handleCreateTrip(name, startDate, endDate) {
    return createTrip(name, startDate, endDate);
  }

  return (
    <div>
      {/* ── Hero ── */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: T.accent, marginBottom: 6 }}>
          Trip Overview
        </p>
        <p style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.8, color: T.text, lineHeight: 1.1, marginBottom: 6 }}>
          {activeTrip?.name || "No Trip Yet."}
        </p>
        <p style={{ fontSize: 14, color: T.mid, fontWeight: 400 }}>
          {TRIP.length} days{activeTrip?.destination ? ` · ${activeTrip.destination}` : ""}
        </p>
      </div>

      {/* ── Trip switcher + New Trip button ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {trips.map((t) => (
          <button key={t.id} onClick={() => setActiveTrip(t.id)}
            style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              cursor: "pointer", border: `1px solid ${t.id === activeTripId ? T.accent : T.border}`,
              background: t.id === activeTripId ? T.accentDim : "none",
              color: t.id === activeTripId ? T.accent : T.mid,
              fontFamily: "inherit",
            }}>
            {t.name}
          </button>
        ))}
        <button onClick={handleNewTrip}
          style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
            cursor: "pointer", border: `1px solid ${T.border}`, background: "none",
            color: T.light, fontFamily: "inherit" }}>
          + New Trip
        </button>
        {!isGuest && limits.trips !== Infinity && (
          <span style={{ fontSize: 10, color: T.light }}>
            {trips.length}/{limits.trips} trips
          </span>
        )}
      </div>

      {/* ── Header card ── */}
      <div style={{ background: T.surface, border: `1.5px solid ${T.borderLight}`, borderRadius: 16, padding: 18, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{activeTrip?.name || "—"}</p>
            <p style={{ fontSize: 12, color: T.mid, marginTop: 3 }}>
              {planned}/{TRIP.length} days planned · {frozen} frozen
            </p>
          </div>
          <button onClick={handlePlanAll} disabled={aiLoading || wardrobe.length === 0 || TRIP.length === 0}
            style={{ padding: "9px 18px",
              background: aiDone ? "#0C2010" : aiLoading ? T.alt : T.text,
              color: aiDone ? "#4ADE80" : aiLoading ? T.light : T.bg,
              border: aiDone ? "1.5px solid #4ADE80" : "none",
              borderRadius: 10, fontSize: 12, fontWeight: 700,
              cursor: (aiLoading || wardrobe.length === 0 || TRIP.length === 0) ? "not-allowed" : "pointer",
              opacity: aiLoading ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
            {aiLoading ? (
              <><span style={{ animation: "spin 1.2s linear infinite", display: "inline-block" }}>◌</span>Generating…<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></>
            ) : aiDone ? "✓ Done!" : "✨ Plan All →"}
          </button>
        </div>
        {planned > 0 && TRIP.length > 0 && (
          <div style={{ marginTop: 12, background: T.alt, borderRadius: 4, height: 4 }}>
            <div style={{ height: "100%", background: T.text, width: `${(planned / TRIP.length) * 100}%`, borderRadius: 4, transition: "width 0.4s ease" }} />
          </div>
        )}
        {frozen > 0 && !aiLoading && !aiDone && (
          <p style={{ fontSize: 10, color: T.light, marginTop: 8 }}>
            {frozen} frozen day{frozen !== 1 ? "s" : ""} will be skipped during generation
          </p>
        )}
        {aiError && (
          <div style={{ marginTop: 10, background: "#2D0A0A", border: "1.5px solid #7F1D1D", borderRadius: 10, padding: "9px 12px", fontSize: 11, color: "#FCA5A5", display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span>⚠</span><span>{aiError}</span>
          </div>
        )}
      </div>

      {/* ── Timeline ── */}
      {TRIP.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>✈️</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8 }}>No trips yet</p>
          <p style={{ fontSize: 13, color: T.mid, marginBottom: 20 }}>Create your first trip to start planning outfits.</p>
          <button onClick={handleNewTrip}
            style={{ padding: "11px 24px", background: T.accent, color: "#fff", border: "none",
              borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            + Create a Trip
          </button>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 20, top: 0, bottom: 0, width: 1.5, background: T.borderLight }} />
          {TRIP.map((day) => {
            const done      = isPlanned(day.id, outfitIds);
            const isFrozen  = frozenDays[day.id];
            const items     = getDayItems(day.id, outfitIds, wardrobe);
            const isEditing = editingDay === day.id;

            return (
              <div key={day.id} style={{ display: "flex", gap: 0, marginBottom: 10 }}>
                {/* Timeline dot */}
                <div style={{ width: 42, flexShrink: 0, display: "flex", justifyContent: "center", paddingTop: 18 }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", zIndex: 1,
                    background: isFrozen ? "#60A5FA" : done ? T.text : T.surface,
                    border: `2px solid ${isFrozen ? "#60A5FA" : done ? T.text : T.border}`,
                    transition: "all 0.2s" }} />
                </div>

                {/* Day card */}
                <div style={{ flex: 1, background: T.surface, border: `1px solid ${T.borderLight}`,
                  borderRadius: 16, padding: "16px 18px", overflow: "hidden",
                  transition: "border-color 0.15s" }}
                  onMouseEnter={(e) => !isEditing && (e.currentTarget.style.borderColor = T.border)}
                  onMouseLeave={(e) => !isEditing && (e.currentTarget.style.borderColor = T.borderLight)}>

                  {isEditing ? (
                    /* ── Inline edit form ── */
                    <div onClick={(e) => e.stopPropagation()}>
                      {[
                        { label: "City / Route", field: "city",  value: day.city  },
                        { label: "Day activity", field: "day",   value: day.day   },
                        { label: "Evening",      field: "night", value: day.night },
                      ].map(({ label, field, value }) => (
                        <div key={field} style={{ marginBottom: 8 }}>
                          <p style={{ fontSize: 10, color: T.light, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</p>
                          <input defaultValue={value}
                            onBlur={(e) => updateTripDay(activeTripId, day.id, { [field]: e.target.value })}
                            style={{ width: "100%", background: T.alt, border: `1px solid ${T.border}`,
                              borderRadius: 6, color: T.text, fontSize: 13, padding: "6px 10px", fontFamily: "inherit" }} />
                        </div>
                      ))}
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        {[
                          { label: "Occasion", field: "occ", options: ["Casual","Dinner","Flight","Hiking","Beach","Smart Casual"] },
                          { label: "Weather",  field: "w",   options: ["Cold","Mild","Warm"] },
                        ].map(({ label, field, options }) => (
                          <div key={field} style={{ flex: 1 }}>
                            <p style={{ fontSize: 10, color: T.light, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</p>
                            <select defaultValue={day[field]}
                              onChange={(e) => updateTripDay(activeTripId, day.id, { [field]: e.target.value })}
                              style={{ width: "100%", background: T.alt, border: `1px solid ${T.border}`,
                                borderRadius: 6, color: T.text, fontSize: 12, padding: "6px 8px", fontFamily: "inherit" }}>
                              {options.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => setEditingDay(null)}
                        style={{ fontSize: 11, color: T.accent, background: "none", border: "none",
                          cursor: "pointer", fontWeight: 600, padding: 0 }}>
                        Done editing ✓
                      </button>
                    </div>
                  ) : (
                    /* ── Read-only card ── */
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                      cursor: "pointer" }}
                      onClick={() => onNavigateToDay && onNavigateToDay(day.id)}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                          <span style={{ fontSize: 15 }}>{day.e}</span>
                          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3, color: T.text }}>
                            {day.city || day.date}
                          </span>
                          {isFrozen && <span title="Frozen" style={{ fontSize: 11 }}>🔒</span>}
                        </div>
                        <p style={{ fontSize: 12, color: T.mid, fontWeight: 400, marginBottom: 6 }}>{day.date}</p>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {day.day   && <Chip text={day.day} />}
                          {day.night && <Chip text={day.night} colors={["#4A1942","#F9A8D4"]} />}
                          {day.w  && T.weather[day.w]  && <Chip text={day.w}   colors={T.weather[day.w]} />}
                          {day.occ && T.occ[day.occ] && <Chip text={day.occ} colors={T.occ[day.occ]} />}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 7, marginLeft: 10, flexShrink: 0 }}>
                        {items.length > 0 && (
                          <div style={{ display: "flex" }}>
                            {items.map((item, i) => {
                              const [bg, ac] = swatch(item.col);
                              return (
                                <div key={item.id} style={{ width: 26, height: 26, borderRadius: 7, overflow: "hidden",
                                  border: `2px solid ${T.surface}`, marginLeft: i > 0 ? -6 : 0,
                                  background: `linear-gradient(145deg,${bg},${ac})`, flexShrink: 0 }}>
                                  {item.img && <img src={item.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => (e.target.style.display = "none")} />}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingDay(day.id); }}
                            title="Edit day details"
                            style={{ fontSize: 12, color: T.light, background: "none", border: "none",
                              cursor: "pointer", padding: 0, lineHeight: 1 }}>
                            ✎
                          </button>
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.8, color: T.light, opacity: 0.7 }}>
                            {done ? "Edit →" : "Plan →"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 9, color: T.light, textAlign: "center", marginTop: 12, letterSpacing: 0.5 }}>
        CLICK ANY DAY TO EDIT IN DAILY TAB · ✎ TO EDIT DAY DETAILS · FREEZE DAYS TO ADD TO PACKING
      </p>

      {showCreator && (
        <TripCreator
          onClose={() => setShowCreator(false)}
          onCreateTrip={handleCreateTrip}
        />
      )}
    </div>
  );
}
