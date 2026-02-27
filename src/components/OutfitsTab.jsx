/* ─── OUTFITS TAB — Outfit per Day ──────────────────────────────────────────
   Data:       wardrobe prop (from useWardrobe hook — single source of truth).
   outfitIds:  from useOutfits hook in App.jsx — persisted to localStorage + backend.
   Layout:     Two-column on desktop, stacked + horizontal day scroll on mobile.

   Outfit per day schema:
   {
     base:   "itemId" | null,
     mid:    "itemId" | null | "REMOVED",   // "REMOVED" = user explicitly disabled
     outer:  "itemId" | null | "REMOVED",
     bottom: "itemId" | null,
     shoes:  "itemId" | null,
   }
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useRef, useCallback } from "react";
import { T } from "../theme";
import TRIP from "../data/trip";
import { generateOutfit, swapItem } from "../utils/styleLogic";
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

/* ─── Resolve outfit IDs → full items (or missing marker) ───────────────── */
function resolveOutfit(outfitIds, wardrobe) {
  if (!outfitIds) return null;
  const resolve = (id) => {
    if (!id || id === "REMOVED") return null;
    const item = wardrobe.find((i) => i.id === id);
    if (item) return item;
    return { _missing: true, id, n: "Item removed", c: "", col: "Grey", b: "", img: "" };
  };
  return {
    base:   resolve(outfitIds.base),
    mid:    resolve(outfitIds.mid),
    outer:  resolve(outfitIds.outer),
    bottom: resolve(outfitIds.bottom),
    shoes:  resolve(outfitIds.shoes),
  };
}

/* ─── Extract IDs from a full-item outfit object ────────────────────────── */
const toIds = (outfit) => ({
  base:   outfit.base?.id   || null,
  mid:    outfit.mid?.id    || null,
  outer:  outfit.outer?.id  || null,
  bottom: outfit.bottom?.id || null,
  shoes:  outfit.shoes?.id  || null,
});

/* ─── Chip color helpers ─────────────────────────────────────────────────── */
const wColors  = (w) => T.weather[w]  || ["#27272A", "#A1A1AA"];
const occColors = (o) => T.occ[o]     || ["#27272A", "#A1A1AA"];

/* ─── Day List Row (desktop sidebar) ─────────────────────────────────────── */
function DayRow({ day, active, hasOutfit, hasMissing, onClick }) {
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
        {hasOutfit && !hasMissing && (
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
function DayChip({ day, active, hasOutfit, hasMissing, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        background: active ? T.alt : "transparent",
        border: `1.5px solid ${active ? T.border : T.borderLight}`,
        borderRadius: 12,
        padding: "8px 10px",
        cursor: "pointer",
        textAlign: "center",
        minWidth: 52,
        transition: "background 0.15s",
      }}
    >
      <div style={{ fontSize: 15, lineHeight: 1 }}>{day.e}</div>
      <div style={{ fontSize: 8, fontWeight: 700, color: active ? T.text : T.light, marginTop: 3, letterSpacing: 0.5 }}>
        {day.id.replace("d", "D")}
      </div>
      <div style={{
        width: 5, height: 5, borderRadius: "50%", margin: "4px auto 0",
        background: hasMissing ? "#FCD34D" : hasOutfit ? T.green : T.borderLight,
      }} />
    </button>
  );
}

/* ─── Layer Toggle Button ─────────────────────────────────────────────────── */
function LayerBtn({ active, label, onAdd, onRemove }) {
  const base = {
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontFamily: "inherit",
    transition: "all 0.15s",
    background: "none",
  };
  if (active) {
    return (
      <button
        onClick={onRemove}
        style={{ ...base, border: `1.5px solid ${T.border}`, color: T.mid }}
        title={`Remove ${label} layer`}
      >
        <span style={{ color: T.text }}>{label.toUpperCase()}</span>
        <span style={{ fontSize: 8, opacity: 0.6 }}>✕</span>
      </button>
    );
  }
  return (
    <button
      onClick={onAdd}
      style={{ ...base, border: `1.5px dashed ${T.borderLight}`, color: T.light }}
      title={`Add ${label} layer`}
    >
      <span>+</span>
      <span>{label.toUpperCase()}</span>
    </button>
  );
}

/* ─── OUTFITS TAB ─────────────────────────────────────────────────────────── */
// Props:
//   wardrobe      – normalized items array from useWardrobe (single source of truth)
//   loading       – boolean (wardrobe still loading)
//   outfitIds     – { [dayId]: { base, mid, outer, bottom, shoes } } from useOutfits
//   setOutfitIds  – setter from useOutfits (handles localStorage + backend sync)
export default function OutfitsTab({ wardrobe = [], loading = false, outfitIds = {}, setOutfitIds }) {
  const [selectedDay, setSelectedDay] = useState(TRIP[0]);
  const [genLoading,  setGenLoading]  = useState(null);
  const isMobile = useIsMobile();

  /* picker state */
  const [pickerLayer, setPickerLayer] = useState(null);
  const pickerOpen = pickerLayer !== null;

  const usedIds = useRef(new Set());

  /* ── Helper: does a day have a real outfit (not just REMOVED markers)? ── */
  const isPlannedDay = (dayId) => {
    const ids = outfitIds[dayId];
    if (!ids) return false;
    return Object.values(ids).some((v) => v && v !== "REMOVED");
  };

  /* ── Auto-generate when day is selected and wardrobe is ready ── */
  useEffect(() => {
    if (!selectedDay || wardrobe.length === 0) return;
    if (isPlannedDay(selectedDay.id)) return; // already has a real outfit
    generateForDay(selectedDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay?.id, wardrobe.length]);

  /* ── Generate outfit for a day ── */
  const generateForDay = useCallback(
    (day) => {
      if (!day || wardrobe.length === 0) return;
      setGenLoading(day.id);

      // Collect IDs used on other days (exclude REMOVED sentinels)
      const otherUsed = new Set();
      Object.entries(outfitIds).forEach(([dId, ids]) => {
        if (dId !== day.id) {
          Object.values(ids).forEach((id) => id && id !== "REMOVED" && otherUsed.add(id));
        }
      });

      // Check if user explicitly disabled any optional layers for this day
      const prevIds     = outfitIds[day.id] || {};
      const midRemoved  = prevIds.mid   === "REMOVED";
      const outerRemoved = prevIds.outer === "REMOVED";

      setTimeout(() => {
        const outfit = generateOutfit(wardrobe, day, otherUsed);
        const ids    = toIds(outfit);

        // Restore user's layer removal preferences
        if (midRemoved)   ids.mid   = "REMOVED";
        if (outerRemoved) ids.outer = "REMOVED";

        Object.values(ids).forEach((id) => id && id !== "REMOVED" && usedIds.current.add(id));

        setOutfitIds((prev) => ({ ...prev, [day.id]: ids }));
        setGenLoading(null);
      }, 0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wardrobe, outfitIds]
  );

  /* ── Regenerate (force fresh pick, preserving REMOVED markers) ── */
  function handleRegenerate() {
    if (!selectedDay) return;
    const current = outfitIds[selectedDay.id];

    // Preserve "REMOVED" markers; release real item IDs from usedIds
    const preserved = {};
    if (current) {
      Object.entries(current).forEach(([k, v]) => {
        if (v === "REMOVED") preserved[k] = "REMOVED";
        else if (v) usedIds.current.delete(v);
      });
    }

    setOutfitIds((prev) => {
      const next = { ...prev };
      if (Object.keys(preserved).length > 0) {
        next[selectedDay.id] = preserved; // keep REMOVED prefs, clear items
      } else {
        delete next[selectedDay.id];
      }
      return next;
    });

    setTimeout(() => generateForDay(selectedDay), 0);
  }

  /* ── Auto-swap via algorithm ── */
  function handleAutoSwap(layer) {
    if (!selectedDay) return;
    const currentId = outfitIds[selectedDay.id]?.[layer];
    if (!currentId || currentId === "REMOVED") return;
    const currentItem = wardrobe.find((i) => i.id === currentId);
    if (!currentItem) return;

    const next = swapItem(wardrobe, currentId, currentItem.c || currentItem.category || "", usedIds.current);
    if (!next) return;

    usedIds.current.delete(currentId);
    usedIds.current.add(next.id);

    setOutfitIds((prev) => ({
      ...prev,
      [selectedDay.id]: { ...(prev[selectedDay.id] || {}), [layer]: next.id },
    }));
  }

  /* ── Open ItemPicker for manual selection ── */
  function handlePick(layer) {
    setPickerLayer(layer);
  }

  /* ── Add optional layer: open picker directly ── */
  function handleAddLayer(layer) {
    if (!selectedDay) return;
    setPickerLayer(layer); // picker will set the item; handlePickerSelect clears REMOVED
  }

  /* ── Remove optional layer: set REMOVED sentinel ── */
  function handleRemoveLayer(layer) {
    if (!selectedDay) return;
    const oldId = outfitIds[selectedDay.id]?.[layer];
    if (oldId && oldId !== "REMOVED") usedIds.current.delete(oldId);

    setOutfitIds((prev) => ({
      ...prev,
      [selectedDay.id]: { ...(prev[selectedDay.id] || {}), [layer]: "REMOVED" },
    }));
  }

  /* ── Picker confirmed: update outfit ID ── */
  function handlePickerSelect(item) {
    if (!selectedDay || !pickerLayer) return;
    const oldId = outfitIds[selectedDay.id]?.[pickerLayer];
    // Remove old item from tracking (ignore REMOVED sentinel)
    if (oldId && oldId !== "REMOVED") usedIds.current.delete(oldId);
    usedIds.current.add(item.id);

    setOutfitIds((prev) => ({
      ...prev,
      [selectedDay.id]: { ...(prev[selectedDay.id] || {}), [pickerLayer]: item.id },
    }));
    setPickerLayer(null);
  }

  /* ── Derived ── */
  const currentIds    = selectedDay ? (outfitIds[selectedDay.id] || null) : null;
  const currentOutfit = currentIds ? resolveOutfit(currentIds, wardrobe) : null;
  const isGenLoading  = genLoading === selectedDay?.id;
  const selectedCount = wardrobe.filter((i) => i.selected).length;
  const plannedCount  = TRIP.filter((d) => isPlannedDay(d.id)).length;

  const hasMissing = (dayId) => {
    const ids = outfitIds[dayId];
    if (!ids) return false;
    return Object.values(ids).some(
      (id) => id && id !== "REMOVED" && !wardrobe.find((i) => i.id === id)
    );
  };

  // Current day's layer state
  const midActive   = !!(currentIds?.mid   && currentIds.mid   !== "REMOVED");
  const outerActive = !!(currentIds?.outer && currentIds.outer !== "REMOVED");

  // ItemPicker currentId — never pass "REMOVED" as a current item
  const pickerCurrentId =
    pickerLayer && currentIds?.[pickerLayer] !== "REMOVED"
      ? currentIds?.[pickerLayer] || null
      : null;

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
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: -0.3, marginBottom: 4 }}>
          Outfit per Day
        </h2>
        <p style={{ fontSize: 11, color: T.mid }}>
          AUS & NZ — April 2026 · {plannedCount}/{TRIP.length} planned · {wardrobe.length} items
        </p>
      </div>

      {/* ── Layout ── */}
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
            width: "100%",
            overflowX: "auto",
            display: "flex",
            gap: 6,
            paddingBottom: 4,
            WebkitOverflowScrolling: "touch",
            msOverflowStyle: "none",
          }}>
            {TRIP.map((day) => (
              <DayChip
                key={day.id}
                day={day}
                active={selectedDay?.id === day.id}
                hasOutfit={isPlannedDay(day.id)}
                hasMissing={hasMissing(day.id)}
                onClick={() => setSelectedDay(day)}
              />
            ))}
          </div>
        ) : (
          /* DESKTOP: vertical sidebar */
          <div style={{
            width: 160,
            flexShrink: 0,
            background: T.surface,
            border: `1.5px solid ${T.borderLight}`,
            borderRadius: 16,
            overflow: "hidden",
          }}>
            <div style={{ padding: "10px 12px 8px", borderBottom: `1px solid ${T.borderLight}`, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: T.light }}>
              DAYS · {plannedCount}/{TRIP.length}
            </div>
            <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 260px)", padding: 6 }}>
              {TRIP.map((day) => (
                <DayRow
                  key={day.id}
                  day={day}
                  active={selectedDay?.id === day.id}
                  hasOutfit={isPlannedDay(day.id)}
                  hasMissing={hasMissing(day.id)}
                  onClick={() => setSelectedDay(day)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Right: Outfit panel ── */}
        <div style={{ flex: 1, minWidth: 0, width: "100%" }}>
          {selectedDay ? (
            <div style={{ background: T.surface, border: `1.5px solid ${T.borderLight}`, borderRadius: 16, overflow: "hidden" }}>

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
                  <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", background: T.alt, border: `1.5px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: T.mid }}>
                    {selectedDay.id.replace("d", "")}
                  </div>
                </div>
              </div>

              {/* Source indicator */}
              <div style={{ padding: "10px 16px 0", fontSize: 10, color: T.light, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.green, display: "inline-block", flexShrink: 0 }} />
                {selectedCount} selected / {wardrobe.length} items · tap ⟳ to swap
              </div>

              {/* Outfit Card */}
              <div style={{ padding: "12px 16px 16px" }}>
                <OutfitCard
                  outfit={currentOutfit}
                  onSwap={handlePick}
                  onRegenerate={handleRegenerate}
                  loading={isGenLoading}
                />

                {/* ── Layer controls ── */}
                {currentIds && !isGenLoading && (
                  <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: T.light, marginRight: 2 }}>
                      LAYERS
                    </span>
                    <LayerBtn
                      active={midActive}
                      label="Mid"
                      onAdd={() => handleAddLayer("mid")}
                      onRemove={() => handleRemoveLayer("mid")}
                    />
                    <LayerBtn
                      active={outerActive}
                      label="Outer"
                      onAdd={() => handleAddLayer("outer")}
                      onRemove={() => handleRemoveLayer("outer")}
                    />
                  </div>
                )}

                {/* Missing item warning */}
                {hasMissing(selectedDay.id) && (
                  <div style={{ marginTop: 12, background: "#2D1A0A", border: `1.5px solid #92400E`, borderRadius: 10, padding: "10px 12px", fontSize: 11, color: "#FCD34D", lineHeight: 1.5 }}>
                    ⚠️ Some items were removed from the wardrobe.
                    Tap ⟳ on the slot to pick a replacement.
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
        WARDROBE · Outfits synced across devices · Single source of truth
      </p>

      {/* ── ItemPicker modal ── */}
      {pickerOpen && (
        <ItemPicker
          wardrobe={wardrobe}
          layer={pickerLayer}
          currentId={pickerCurrentId}
          onSelect={handlePickerSelect}
          onClose={() => setPickerLayer(null)}
        />
      )}
    </div>
  );
}
