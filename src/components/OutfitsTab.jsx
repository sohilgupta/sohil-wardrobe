/* ─── OUTFITS TAB — Outfit per Day ──────────────────────────────────────────
   Data: wardrobe prop (from useWardrobe hook — single source of truth).
   Outfits: stored as { [dayId]: { base, mid, outer, bottom, shoes } } where
            each value is an item ID (or null).  Persisted to localStorage.
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useRef, useCallback } from "react";
import { T } from "../theme";
import TRIP from "../data/trip";
import { generateOutfit, swapItem } from "../utils/styleLogic";
import OutfitCard from "./OutfitCard";
import ItemPicker from "./ItemPicker";
import Chip from "./Chip";

/* ─── localStorage helpers ───────────────────────────────────────────────── */
const OUTFITS_KEY = "wdb_outfits_v1";
const loadSavedOutfits = () => {
  try { return JSON.parse(localStorage.getItem(OUTFITS_KEY)) || {}; }
  catch { return {}; }
};
const persistOutfits = (data) => {
  try { localStorage.setItem(OUTFITS_KEY, JSON.stringify(data)); } catch {}
};

/* ─── Resolve outfit IDs → full items (or missing marker) ───────────────── */
function resolveOutfit(outfitIds, wardrobe) {
  if (!outfitIds) return null;
  const resolve = (id) => {
    if (!id) return null;
    const item = wardrobe.find((i) => i.id === id);
    if (item) return item;
    // Item was deleted from wardrobe — surface a "missing" marker
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

/* ─── Day List Row ───────────────────────────────────────────────────────── */
function DayRow({ day, active, hasOutfit, hasMissing, onClick }) {
  return (
    <button onClick={onClick}
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

/* ─── OUTFITS TAB ─────────────────────────────────────────────────────────── */
// Props:
//   wardrobe  – normalized items array from useWardrobe (single source of truth)
//   loading   – boolean (wardrobe still loading)
export default function OutfitsTab({ wardrobe = [], loading = false }) {
  const [outfitIds, setOutfitIds] = useState(loadSavedOutfits); // { dayId → { base, mid, outer, bottom, shoes } }
  const [selectedDay, setSelectedDay] = useState(TRIP[0]);
  const [genLoading,  setGenLoading]  = useState(null);

  /* picker state */
  const [pickerLayer, setPickerLayer] = useState(null); // "base"|"mid"|"outer"|"bottom"|"shoes" | null
  const pickerOpen = pickerLayer !== null;

  const usedIds = useRef(new Set());

  /* ── Auto-generate when day is selected and wardrobe is ready ── */
  useEffect(() => {
    if (!selectedDay || wardrobe.length === 0) return;
    if (outfitIds[selectedDay.id]) return; // already planned
    generateForDay(selectedDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay?.id, wardrobe.length]);

  /* ── Generate outfit for a day ── */
  const generateForDay = useCallback(
    (day) => {
      if (!day || wardrobe.length === 0) return;
      setGenLoading(day.id);

      // Collect IDs used on other days
      const otherUsed = new Set();
      Object.entries(outfitIds).forEach(([dId, ids]) => {
        if (dId !== day.id) Object.values(ids).forEach((id) => id && otherUsed.add(id));
      });

      setTimeout(() => {
        const outfit = generateOutfit(wardrobe, day, otherUsed);
        const ids = toIds(outfit);
        Object.values(ids).forEach((id) => id && usedIds.current.add(id));

        setOutfitIds((prev) => {
          const next = { ...prev, [day.id]: ids };
          persistOutfits(next);
          return next;
        });
        setGenLoading(null);
      }, 0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wardrobe, outfitIds]
  );

  /* ── Regenerate (force fresh pick) ── */
  function handleRegenerate() {
    if (!selectedDay) return;
    // Remove current outfit IDs from usedIds tracker
    const current = outfitIds[selectedDay.id];
    if (current) Object.values(current).forEach((id) => id && usedIds.current.delete(id));

    setOutfitIds((prev) => {
      const next = { ...prev };
      delete next[selectedDay.id];
      persistOutfits(next);
      return next;
    });

    // Trigger generation on next render
    setTimeout(() => generateForDay(selectedDay), 0);
  }

  /* ── Swap via auto-algorithm ── (kept for keyboard/power users via OutfitCard ⟳) */
  function handleAutoSwap(layer) {
    if (!selectedDay) return;
    const currentId = outfitIds[selectedDay.id]?.[layer];
    if (!currentId) return;
    const currentItem = wardrobe.find((i) => i.id === currentId);
    if (!currentItem) return;

    const next = swapItem(wardrobe, currentId, currentItem.c || currentItem.category || "", usedIds.current);
    if (!next) return;

    usedIds.current.delete(currentId);
    usedIds.current.add(next.id);

    setOutfitIds((prev) => {
      const next2 = { ...prev, [selectedDay.id]: { ...(prev[selectedDay.id] || {}), [layer]: next.id } };
      persistOutfits(next2);
      return next2;
    });
  }

  /* ── Open ItemPicker for manual selection ── */
  function handlePick(layer) {
    setPickerLayer(layer);
  }

  /* ── Picker confirmed: update outfit ID ── */
  function handlePickerSelect(item) {
    if (!selectedDay || !pickerLayer) return;
    const oldId = outfitIds[selectedDay.id]?.[pickerLayer];
    if (oldId) usedIds.current.delete(oldId);
    usedIds.current.add(item.id);

    setOutfitIds((prev) => {
      const next = { ...prev, [selectedDay.id]: { ...(prev[selectedDay.id] || {}), [pickerLayer]: item.id } };
      persistOutfits(next);
      return next;
    });
    setPickerLayer(null);
  }

  /* ── Derived ── */
  const currentIds    = selectedDay ? (outfitIds[selectedDay.id] || null) : null;
  const currentOutfit = currentIds ? resolveOutfit(currentIds, wardrobe) : null;
  const isGenLoading  = genLoading === selectedDay?.id;
  const selectedCount = wardrobe.filter((i) => i.selected).length;

  // Check if any day's outfit has a missing item
  const hasMissing = (dayId) => {
    const ids = outfitIds[dayId];
    if (!ids) return false;
    return Object.values(ids).some((id) => id && !wardrobe.find((i) => i.id === id));
  };

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
          AUS & NZ — April 2026 · {TRIP.length} days · {wardrobe.length} wardrobe items
        </p>
      </div>

      {/* ── Two-panel layout ── */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>

        {/* ── Left: Day list ── */}
        <div style={{ width: 160, flexShrink: 0, background: T.surface, border: `1.5px solid ${T.borderLight}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "10px 12px 8px", borderBottom: `1px solid ${T.borderLight}`, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: T.light }}>
            DAYS · {Object.keys(outfitIds).length}/{TRIP.length}
          </div>
          <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 260px)", padding: 6 }}>
            {TRIP.map((day) => (
              <DayRow
                key={day.id}
                day={day}
                active={selectedDay?.id === day.id}
                hasOutfit={!!outfitIds[day.id]}
                hasMissing={hasMissing(day.id)}
                onClick={() => setSelectedDay(day)}
              />
            ))}
          </div>
        </div>

        {/* ── Right: Outfit panel ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
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
                {selectedCount} selected / {wardrobe.length} items · tap ⟳ to pick manually
              </div>

              {/* Outfit Card */}
              <div style={{ padding: "12px 16px 16px" }}>
                <OutfitCard
                  outfit={currentOutfit}
                  onSwap={handlePick}
                  onRegenerate={handleRegenerate}
                  loading={isGenLoading}
                />

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
        WARDROBE · Google Sheets · Single source of truth · Outfits stored locally by ID
      </p>

      {/* ── ItemPicker modal ── */}
      {pickerOpen && (
        <ItemPicker
          wardrobe={wardrobe}
          layer={pickerLayer}
          currentId={outfitIds[selectedDay?.id]?.[pickerLayer] || null}
          onSelect={handlePickerSelect}
          onClose={() => setPickerLayer(null)}
        />
      )}
    </div>
  );
}
