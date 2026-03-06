/* ─── OUTFITS TAB — Outfit per Day (Daytime + Evening) ───────────────────────
   Data:       wardrobe prop (from useWardrobe hook — single source of truth).
   outfitIds:  from useOutfits hook in App.jsx — persisted to localStorage + backend.
   frozenDays: { [dayId]: boolean } — frozen days cannot be overwritten by AI gen or local regen.
   Layout:     Two-column on desktop, stacked + horizontal day scroll on mobile.

   Outfit per day schema:
   {
     daytime: { base, mid?, outer?, bottom, thermalBottom?, shoes } | null,
     evening: { base, mid?, outer?, bottom, thermalBottom?, shoes } | null,
   }

   "REMOVED" sentinel: user explicitly removed optional mid/outer/thermalBottom layer.
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useCallback } from "react";
import { T } from "../theme";
import TRIP from "../data/trip";
// generateOutfit (local engine) removed — regen now uses Gemini via generateSingleOutfit
import { generateTripOutfits, generateSingleOutfit } from "../utils/tripGenerator";
import OutfitCard from "./OutfitCard";
import ItemPicker from "./ItemPicker";
import Chip from "./Chip";

/* ─── Responsive hook ────────────────────────────────────────────────────── */
function useIsMobile(bp = 640) {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.innerWidth <= bp);
  useEffect(() => {
    const fn = () => setM(window.innerWidth <= bp);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, [bp]);
  return m;
}

/* ─── Resolve outfit slot IDs → full items (or missing marker) ───────────── */
function resolveOutfit(slotIds, wardrobe) {
  if (!slotIds) return null;
  const resolve = (id) => {
    if (!id || id === "REMOVED") return null;
    const item = wardrobe.find((i) => i.id === id);
    if (item) return item;
    return { _missing: true, id, n: "Item removed", c: "", col: "Grey", b: "", img: "" };
  };
  return {
    base:          resolve(slotIds.base),
    mid:           resolve(slotIds.mid),
    outer:         resolve(slotIds.outer),
    bottom:        resolve(slotIds.bottom),
    thermalBottom: resolve(slotIds.thermalBottom),
    shoes:         resolve(slotIds.shoes),
  };
}

/* ─── Chip colour helpers ────────────────────────────────────────────────── */
const wColors   = (w) => T.weather[w] || ["#27272A", "#A1A1AA"];
const occColors = (o) => T.occ[o]     || ["#27272A", "#A1A1AA"];

/* ─── Determine evening occasion from night field ────────────────────────── */
function eveningOcc(night) {
  if (!night) return "Casual";
  const n = night.toLowerCase();
  if (n.includes("show") || n.includes("theatre") || n.includes("theater") || n.includes("opera") || n.includes("phantom"))
    return "Show";
  if (n.includes("dinner") || n.includes("rooftop") || n.includes("elevated") || n.includes("smart casual"))
    return "Dinner";
  if (n.includes("flight")) return "Flight";
  return "Casual";
}

/* ─── Day List Row (desktop sidebar) ─────────────────────────────────────── */
function DayRow({ day, active, hasOutfit, hasMissing, isFrozen, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left",
        background: active ? T.alt : "none",
        border: `1.5px solid ${active ? T.border : "transparent"}`,
        borderRadius: 12, padding: "10px 12px",
        cursor: "pointer", transition: "background 0.15s",
        position: "relative",
      }}
    >
      {active && (
        <div style={{ position: "absolute", left: 0, top: "20%", bottom: "20%", width: 3, background: T.text, borderRadius: 4 }} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16, lineHeight: 1 }}>{day.e}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: active ? T.text : T.mid, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {day.city.split("→")[0].trim()}
          </div>
          <div style={{ fontSize: 9, color: T.light, marginTop: 1 }}>{day.date}</div>
        </div>
        {hasMissing && <span title="Item removed" style={{ fontSize: 11 }}>⚠️</span>}
        {isFrozen && !hasMissing && <span title="Outfit frozen" style={{ fontSize: 11 }}>🔒</span>}
        {hasOutfit && !hasMissing && !isFrozen && (
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.green, flexShrink: 0 }} />
        )}
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
        <Chip text={day.w}   colors={wColors(day.w)} />
        <Chip text={day.occ} colors={occColors(day.occ)} />
      </div>
    </button>
  );
}

/* ─── Day Chip (mobile horizontal strip) ─────────────────────────────────── */
function DayChip({ day, active, hasOutfit, hasMissing, isFrozen, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        background: active ? T.alt : "transparent",
        border: `1.5px solid ${active ? T.border : T.borderLight}`,
        borderRadius: 12, padding: "8px 10px",
        cursor: "pointer", textAlign: "center",
        minWidth: 52, transition: "background 0.15s",
      }}
    >
      <div style={{ fontSize: 15, lineHeight: 1 }}>{day.e}</div>
      <div style={{ fontSize: 8, fontWeight: 700, color: active ? T.text : T.light, marginTop: 3, letterSpacing: 0.5 }}>
        {day.id.replace("d", "D")}
      </div>
      <div style={{
        width: 5, height: 5, borderRadius: "50%", margin: "4px auto 0",
        background: hasMissing ? "#FCD34D" : isFrozen ? "#60A5FA" : hasOutfit ? T.green : T.borderLight,
      }} />
    </button>
  );
}

/* ─── Layer Toggle Button ─────────────────────────────────────────────────── */
function LayerBtn({ active, label, onAdd, onRemove }) {
  const base = {
    padding: "3px 10px", borderRadius: 20, fontSize: 9, fontWeight: 700,
    letterSpacing: 1, cursor: "pointer", display: "inline-flex",
    alignItems: "center", gap: 4, fontFamily: "inherit",
    transition: "all 0.15s", background: "none",
  };
  if (active) {
    return (
      <button onClick={onRemove} style={{ ...base, border: `1.5px solid ${T.border}`, color: T.mid }} title={`Remove ${label} layer`}>
        <span style={{ color: T.text }}>{label.toUpperCase()}</span>
        <span style={{ fontSize: 8, opacity: 0.6 }}>✕</span>
      </button>
    );
  }
  return (
    <button onClick={onAdd} style={{ ...base, border: `1.5px dashed ${T.borderLight}`, color: T.light }} title={`Add ${label} layer`}>
      <span>+</span>
      <span>{label.toUpperCase()}</span>
    </button>
  );
}

/* ─── Slot Section (renders one daytime or evening outfit slot) ───────────── */
function SlotSection({
  slot, icon, label, activity,
  slotIds, slotOutfit,
  isFrozen, isLoading,
  onPick, onRegenerate, onRemoveLayer, onAddLayer,
}) {
  const midActive           = !!(slotIds?.mid           && slotIds.mid           !== "REMOVED");
  const outerActive         = !!(slotIds?.outer         && slotIds.outer         !== "REMOVED");
  const thermalBottomActive = !!(slotIds?.thermalBottom && slotIds.thermalBottom !== "REMOVED");
  const hasOutfit   = slotIds && Object.values(slotIds).some((v) => v && v !== "REMOVED");

  return (
    <div>
      {/* Slot label */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13 }}>{icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: T.light }}>{label}</span>
          {activity && (
            <span style={{ fontSize: 10, color: T.mid }}>· {activity}</span>
          )}
        </div>
        {/* Per-slot local regenerate button */}
        {!isFrozen && hasOutfit && !isLoading && (
          <button
            onClick={onRegenerate}
            title={`Regenerate ${label.toLowerCase()} outfit`}
            style={{
              background: "none", border: `1px solid ${T.borderLight}`,
              borderRadius: 20, padding: "2px 9px",
              fontSize: 10, color: T.light, cursor: "pointer",
              fontFamily: "inherit", letterSpacing: 0.5,
              display: "flex", alignItems: "center", gap: 4,
              transition: "all 0.15s",
            }}
          >
            ↺ <span style={{ fontSize: 9 }}>REGEN</span>
          </button>
        )}
      </div>

      {/* Empty slot */}
      {!hasOutfit && !isLoading && (
        isFrozen ? (
          /* Frozen + empty: hint to unfreeze */
          <div style={{
            width: "100%", padding: "12px", borderRadius: 12,
            border: `1.5px dashed #374151`,
            background: "none", color: "#4B5563",
            fontSize: 11, fontWeight: 500,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            🔒 Unfreeze to add {label.toLowerCase()} outfit
          </div>
        ) : (
          /* Not frozen: generate button */
          <button
            onClick={onRegenerate}
            style={{
              width: "100%", padding: "12px", borderRadius: 12,
              border: `1.5px dashed ${T.border}`,
              background: "none", color: T.mid,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit", letterSpacing: 0.3,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            ✦ Generate {label.toLowerCase()} outfit
          </button>
        )
      )}

      {/* Outfit card */}
      {(hasOutfit || isLoading) && (
        <OutfitCard
          outfit={slotOutfit}
          onSwap={isFrozen ? null : onPick}
          onRegenerate={isFrozen ? null : onRegenerate}
          loading={isLoading}
        />
      )}

      {/* Layer controls */}
      {slotIds && !isLoading && !isFrozen && (
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: T.light, marginRight: 2 }}>
            LAYERS
          </span>
          <LayerBtn active={midActive}           label="Mid"            onAdd={() => onAddLayer("mid")}           onRemove={() => onRemoveLayer("mid")} />
          <LayerBtn active={outerActive}         label="Outer"          onAdd={() => onAddLayer("outer")}         onRemove={() => onRemoveLayer("outer")} />
          <LayerBtn active={thermalBottomActive} label="Therm. Bottom"  onAdd={() => onAddLayer("thermalBottom")} onRemove={() => onRemoveLayer("thermalBottom")} />
        </div>
      )}
    </div>
  );
}

/* ─── OUTFITS TAB ─────────────────────────────────────────────────────────── */
export default function OutfitsTab({
  wardrobe = [],
  loading = false,
  outfitIds = {},
  setOutfitIds,
  frozenDays = {},
  toggleFreeze,
  focusDayId = null,
  onFocusConsumed,
  capsuleIds,   // Set<itemId> — from useCapsule, passed through for picker + AI gen
}) {
  const [selectedDay, setSelectedDay] = useState(TRIP[0]);
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiError,     setAiError]     = useState(null);
  const [aiDone,      setAiDone]      = useState(false);
  // { dayId, slot } pair showing local regen spinner
  const [slotLoading, setSlotLoading] = useState(null);
  // { slot: "daytime"|"evening", layer: "base"|"mid"|"outer"|"bottom"|"shoes" } | null
  const [pickerLayer, setPickerLayer] = useState(null);

  const isMobile = useIsMobile();

  /* ── Auto-select day when navigated from Trip tab ── */
  useEffect(() => {
    if (!focusDayId) return;
    const day = TRIP.find((d) => d.id === focusDayId);
    if (day) setSelectedDay(day);
    if (onFocusConsumed) onFocusConsumed();
  }, [focusDayId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Derived freeze state for selected day ── */
  const isCurrentFrozen = frozenDays[selectedDay?.id] || false;

  /* ── Does a day have any real outfit data? ── */
  const isPlannedDay = (dayId) => {
    const data = outfitIds[dayId];
    if (!data) return false;
    const hasReal = (ids) => ids && Object.values(ids).some((v) => v && v !== "REMOVED");
    return hasReal(data.daytime) || hasReal(data.evening);
  };

  /* ── Does a day reference any item not in wardrobe? ── */
  const hasMissing = (dayId) => {
    const data = outfitIds[dayId];
    if (!data) return false;
    const check = (ids) => ids && Object.values(ids).some(
      (id) => id && id !== "REMOVED" && !wardrobe.find((i) => i.id === id)
    );
    return check(data.daytime) || check(data.evening);
  };

  /* ── Current day derived data ── */
  const currentDayData = selectedDay ? (outfitIds[selectedDay.id] || null) : null;
  const dtIds = currentDayData?.daytime || null;
  const evIds = currentDayData?.evening || null;
  const daytimeOutfit = dtIds ? resolveOutfit(dtIds, wardrobe) : null;
  const eveningOutfit = evIds ? resolveOutfit(evIds, wardrobe) : null;

  /* ── AI: Generate Outfits for All Non-Frozen Days (via shared utility) ── */
  async function generateAll() {
    if (aiLoading || wardrobe.length === 0) return;
    setAiLoading(true);
    setAiError(null);
    setAiDone(false);
    try {
      await generateTripOutfits({ wardrobe, frozenDays, setOutfitIds, capsuleIds });
      setAiDone(true);
      setTimeout(() => setAiDone(false), 3000);
    } catch (err) {
      setAiError(err.message || "Generation failed. Check your connection and try again.");
    } finally {
      setAiLoading(false);
    }
  }

  /* ── Regen one slot via Gemini ── */
  const regenSlot = useCallback(async (slot) => {
    if (!selectedDay || isCurrentFrozen || wardrobe.length === 0) return;

    setSlotLoading({ dayId: selectedDay.id, slot });

    // Preserve REMOVED sentinels from existing slot
    const prevSlotIds          = outfitIds[selectedDay.id]?.[slot] || {};
    const midRemoved           = prevSlotIds.mid           === "REMOVED";
    const outerRemoved         = prevSlotIds.outer         === "REMOVED";
    const thermalBottomRemoved = prevSlotIds.thermalBottom === "REMOVED";

    // For evening, use the evening occasion derived from the night field
    const effectiveDay = slot === "evening"
      ? { ...selectedDay, occ: eveningOcc(selectedDay.night) }
      : selectedDay;

    try {
      const ids = await generateSingleOutfit({
        wardrobe,
        occ:     effectiveDay.occ,
        weather: effectiveDay.w,
        city:    effectiveDay.city,
        act:     slot === "daytime" ? effectiveDay.day : effectiveDay.night,
        capsuleIds,
      });

      // Re-apply REMOVED sentinels so the user's explicit layer removals are kept
      if (midRemoved)           ids.mid           = "REMOVED";
      if (outerRemoved)         ids.outer         = "REMOVED";
      if (thermalBottomRemoved) ids.thermalBottom = "REMOVED";

      setOutfitIds((prev) => {
        const dayData = prev[selectedDay.id] || { daytime: null, evening: null };
        return {
          ...prev,
          [selectedDay.id]: { ...dayData, [slot]: ids },
        };
      });
    } catch (err) {
      setAiError(err.message || "Regen failed. Try again.");
      setTimeout(() => setAiError(null), 4000);
    } finally {
      setSlotLoading(null);
    }
  }, [selectedDay, isCurrentFrozen, wardrobe, outfitIds, setOutfitIds]);

  /* ── Open ItemPicker for manual slot+layer selection ── */
  function handlePick(slot, layer) {
    if (isCurrentFrozen) return;
    setPickerLayer({ slot, layer });
  }

  /* ── Add optional layer: open picker ── */
  function handleAddLayer(slot, layer) {
    if (!selectedDay || isCurrentFrozen) return;
    setPickerLayer({ slot, layer });
  }

  /* ── Remove optional layer: set REMOVED sentinel ── */
  function handleRemoveLayer(slot, layer) {
    if (!selectedDay || isCurrentFrozen) return;
    setOutfitIds((prev) => {
      const dayData  = prev[selectedDay.id] || { daytime: null, evening: null };
      const slotData = dayData[slot] || {};
      return {
        ...prev,
        [selectedDay.id]: {
          ...dayData,
          [slot]: { ...slotData, [layer]: "REMOVED" },
        },
      };
    });
  }

  /* ── Picker confirmed: update a single slot's layer ── */
  function handlePickerSelect(item) {
    if (!selectedDay || !pickerLayer || isCurrentFrozen) return;
    const { slot, layer } = pickerLayer;
    setOutfitIds((prev) => {
      const dayData  = prev[selectedDay.id] || { daytime: null, evening: null };
      const slotData = dayData[slot] || {};
      return {
        ...prev,
        [selectedDay.id]: {
          ...dayData,
          [slot]: { ...slotData, [layer]: item.id },
        },
      };
    });
    setPickerLayer(null);
  }

  /* ── Picker currentId helper ── */
  const pickerCurrentId = pickerLayer
    ? (() => {
        const id = outfitIds[selectedDay?.id]?.[pickerLayer.slot]?.[pickerLayer.layer];
        return (id && id !== "REMOVED") ? id : null;
      })()
    : null;

  /* ── Slot loading helpers ── */
  const isDtLoading = !!(slotLoading?.dayId === selectedDay?.id && slotLoading?.slot === "daytime");
  const isEvLoading = !!(slotLoading?.dayId === selectedDay?.id && slotLoading?.slot === "evening");

  /* ── Stats ── */
  const plannedCount = TRIP.filter((d) => isPlannedDay(d.id)).length;
  const frozenCount  = TRIP.filter((d) => frozenDays[d.id]).length;

  /* ── Loading state ── */
  if (loading && wardrobe.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: T.mid, flexDirection: "column", gap: 10 }}>
        <span style={{ fontSize: 24 }}>⧖</span>
        <p style={{ fontSize: 12 }}>Loading wardrobe…</p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: -0.3, marginBottom: 4 }}>
          Outfit per Day
        </h2>
        <p style={{ fontSize: 11, color: T.mid }}>
          AUS & NZ — April 2026 · {plannedCount}/{TRIP.length} planned · {frozenCount} frozen · {wardrobe.length} items
        </p>
      </div>

      {/* ── AI Generate Button ── */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={generateAll}
          disabled={aiLoading || wardrobe.length === 0}
          style={{
            width: "100%",
            padding: "13px 20px",
            borderRadius: 14,
            border: aiLoading
              ? `1.5px solid ${T.border}`
              : aiDone
                ? `1.5px solid #4ADE80`
                : "1.5px solid transparent",
            background: aiLoading
              ? T.alt
              : aiDone
                ? "#0C2010"
                : "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            color: aiLoading ? T.light : aiDone ? "#4ADE80" : T.text,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.5,
            cursor: aiLoading || wardrobe.length === 0 ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.2s",
            boxShadow: aiLoading || aiDone ? "none" : "0 4px 20px rgba(15,52,96,0.4)",
          }}
        >
          {aiLoading ? (
            <>
              <span style={{ animation: "spin 1.2s linear infinite", display: "inline-block" }}>◌</span>
              Generating outfits for all {TRIP.filter((d) => !frozenDays[d.id]).length} days…
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </>
          ) : aiDone ? (
            <> ✓ Outfits generated!</>
          ) : (
            <> ✨ Generate Outfits for Trip</>
          )}
        </button>

        {/* Frozen day note */}
        {frozenCount > 0 && !aiLoading && !aiDone && (
          <p style={{ fontSize: 10, color: T.light, marginTop: 6, textAlign: "center" }}>
            {frozenCount} frozen day{frozenCount !== 1 ? "s" : ""} will be skipped · {TRIP.length - frozenCount} will be generated
          </p>
        )}

        {/* AI error */}
        {aiError && (
          <div style={{
            marginTop: 8,
            background: "#2D0A0A", border: "1.5px solid #7F1D1D",
            borderRadius: 10, padding: "10px 14px",
            fontSize: 11, color: "#FCA5A5", lineHeight: 1.5,
            display: "flex", alignItems: "flex-start", gap: 8,
          }}>
            <span style={{ flexShrink: 0 }}>⚠</span>
            <span>{aiError}</span>
          </div>
        )}
      </div>

      {/* ── Two-column layout ── */}
      <div style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        gap: 14,
        alignItems: "flex-start",
      }}>

        {/* ── Day List ── */}
        {isMobile ? (
          /* MOBILE: horizontal scroll strip */
          <div style={{
            width: "100%", overflowX: "auto",
            display: "flex", gap: 6, paddingBottom: 4,
            WebkitOverflowScrolling: "touch",
          }}>
            {TRIP.map((day) => (
              <DayChip
                key={day.id}
                day={day}
                active={selectedDay?.id === day.id}
                hasOutfit={isPlannedDay(day.id)}
                hasMissing={hasMissing(day.id)}
                isFrozen={frozenDays[day.id] || false}
                onClick={() => setSelectedDay(day)}
              />
            ))}
          </div>
        ) : (
          /* DESKTOP: vertical sidebar — sticky so it stays in view while scrolling */
          <div style={{
            width: 160, flexShrink: 0,
            background: T.surface,
            border: `1.5px solid ${T.borderLight}`,
            borderRadius: 16, overflow: "hidden",
            // Sticky + height capped to viewport minus the fixed header (~90px)
            // This keeps the sidebar full-size even at high browser zoom levels
            position: "sticky",
            top: 90,
            alignSelf: "flex-start",
            maxHeight: "calc(100vh - 110px)",
            display: "flex",
            flexDirection: "column",
          }}>
            <div style={{ padding: "10px 12px 8px", borderBottom: `1px solid ${T.borderLight}`, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: T.light, flexShrink: 0 }}>
              DAYS · {plannedCount}/{TRIP.length}
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: 6 }}>
              {TRIP.map((day) => (
                <DayRow
                  key={day.id}
                  day={day}
                  active={selectedDay?.id === day.id}
                  hasOutfit={isPlannedDay(day.id)}
                  hasMissing={hasMissing(day.id)}
                  isFrozen={frozenDays[day.id] || false}
                  onClick={() => setSelectedDay(day)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Right: Outfit panel ── */}
        <div style={{ flex: 1, minWidth: 0, width: "100%" }}>
          {selectedDay ? (
            <div style={{
              background: T.surface,
              border: `1.5px solid ${isCurrentFrozen ? "#374151" : T.borderLight}`,
              borderRadius: 16,
              overflow: "hidden",
            }}>

              {/* Day header */}
              <div style={{ padding: "14px 16px 12px", borderBottom: `1px solid ${T.borderLight}` }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                      <span style={{ fontSize: 18 }}>{selectedDay.e}</span>
                      <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 17, fontWeight: 700, color: T.text, lineHeight: 1.2 }}>
                        {selectedDay.city}
                      </span>
                    </div>
                    <p style={{ fontSize: 10, color: T.light, marginBottom: 6 }}>{selectedDay.date}</p>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {selectedDay.day   && <Chip text={selectedDay.day} />}
                      {selectedDay.night && <Chip text={selectedDay.night} colors={["#4A1942", "#F9A8D4"]} />}
                      <Chip text={selectedDay.w}   colors={wColors(selectedDay.w)} />
                      <Chip text={selectedDay.occ} colors={occColors(selectedDay.occ)} />
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: isCurrentFrozen ? "#1E293B" : T.alt,
                      border: `1.5px solid ${isCurrentFrozen ? "#374151" : T.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, color: T.mid,
                    }}>
                      {selectedDay.id.replace("d", "")}
                    </div>
                    {/* Freeze toggle */}
                    <button
                      onClick={() => toggleFreeze(selectedDay.id)}
                      title={isCurrentFrozen ? "Unfreeze — allow edits" : "Freeze — lock outfit + add to packing"}
                      style={{
                        padding: "4px 9px", borderRadius: 20,
                        fontSize: 9, fontWeight: 700, letterSpacing: 1,
                        cursor: "pointer", fontFamily: "inherit",
                        transition: "all 0.15s",
                        border: isCurrentFrozen ? "1.5px solid #374151" : `1.5px dashed ${T.borderLight}`,
                        background: isCurrentFrozen ? "#1E293B" : "none",
                        color: isCurrentFrozen ? "#60A5FA" : T.light,
                        display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
                      }}
                    >
                      {isCurrentFrozen ? "🔒 FROZEN" : "🔓 FREEZE"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Frozen banner */}
              {isCurrentFrozen && (
                <div style={{
                  padding: "8px 16px", background: "#0F172A",
                  borderBottom: `1px solid #1E293B`,
                  display: "flex", alignItems: "center", gap: 8,
                  fontSize: 10, color: "#60A5FA", fontWeight: 600, letterSpacing: 0.5,
                }}>
                  <span style={{ fontSize: 12 }}>🔒</span>
                  OUTFIT LOCKED · Tap FROZEN to unlock · This day is in your Packing List
                </div>
              )}

              {/* Outfit slots */}
              <div style={{ padding: "14px 16px 18px" }}>

                {/* ── Daytime slot ── */}
                <SlotSection
                  slot="daytime"
                  icon="☀️"
                  label="DAYTIME"
                  activity={selectedDay.day}
                  slotIds={dtIds}
                  slotOutfit={daytimeOutfit}
                  isFrozen={isCurrentFrozen}
                  isLoading={isDtLoading}
                  onPick={(layer) => handlePick("daytime", layer)}
                  onRegenerate={() => regenSlot("daytime")}
                  onRemoveLayer={(layer) => handleRemoveLayer("daytime", layer)}
                  onAddLayer={(layer) => handleAddLayer("daytime", layer)}
                />

                {/* ── Divider ── */}
                <div style={{ height: 1, background: T.borderLight, margin: "18px 0" }} />

                {/* ── Evening slot ── */}
                <SlotSection
                  slot="evening"
                  icon="🌙"
                  label="EVENING"
                  activity={selectedDay.night}
                  slotIds={evIds}
                  slotOutfit={eveningOutfit}
                  isFrozen={isCurrentFrozen}
                  isLoading={isEvLoading}
                  onPick={(layer) => handlePick("evening", layer)}
                  onRegenerate={() => regenSlot("evening")}
                  onRemoveLayer={(layer) => handleRemoveLayer("evening", layer)}
                  onAddLayer={(layer) => handleAddLayer("evening", layer)}
                />

                {/* Missing item warning */}
                {hasMissing(selectedDay.id) && (
                  <div style={{
                    marginTop: 14,
                    background: "#2D1A0A", border: `1.5px solid #92400E`,
                    borderRadius: 10, padding: "10px 12px",
                    fontSize: 11, color: "#FCD34D", lineHeight: 1.5,
                  }}>
                    ⚠️ Some items were removed from the wardrobe.
                    {isCurrentFrozen
                      ? " Unfreeze to pick replacements."
                      : " Tap ⟳ on the slot to pick a replacement."
                    }
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ background: T.surface, border: `1.5px solid ${T.borderLight}`, borderRadius: 16, padding: 32, textAlign: "center", color: T.mid, fontSize: 13 }}>
              Select a day →
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <p style={{ fontSize: 9, color: T.light, textAlign: "center", marginTop: 16, letterSpacing: 0.5 }}>
        WARDROBE · Outfits synced across devices · Freeze days to add to Packing List
      </p>

      {/* ── ItemPicker modal ── */}
      {pickerLayer && !isCurrentFrozen && (
        <ItemPicker
          wardrobe={wardrobe}
          layer={pickerLayer.layer}
          currentId={pickerCurrentId}
          outfitIds={outfitIds}
          frozenDays={frozenDays}
          capsuleIds={capsuleIds}
          onSelect={handlePickerSelect}
          onClose={() => setPickerLayer(null)}
        />
      )}
    </div>
  );
}
