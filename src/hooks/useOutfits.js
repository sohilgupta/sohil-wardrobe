/* ─── useOutfits hook ─────────────────────────────────────────────────────────
   Manages outfit-per-day state with dual persistence:
   1. localStorage — instant local persistence (always available)
   2. /api/outfits  — cross-device backend sync (when KV is configured)

   Sync strategy:
   - On load:   read localStorage immediately → then fetch backend (backend wins)
   - On change: write localStorage immediately + debounced POST to backend (300ms)

   Data structure per day:
   {
     d01: { base: "itemId", mid: "itemId"|null|"REMOVED", outer: "itemId"|null|"REMOVED",
            bottom: "itemId", shoes: "itemId" }
   }
   "REMOVED" sentinel = user explicitly disabled that layer (persists across regenerations).
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useRef } from "react";

const OUTFITS_KEY = "wdb_outfits_v1";

const loadLocal = () => {
  try { return JSON.parse(localStorage.getItem(OUTFITS_KEY)) || {}; }
  catch { return {}; }
};

const saveLocal = (data) => {
  try { localStorage.setItem(OUTFITS_KEY, JSON.stringify(data)); } catch {}
};

export default function useOutfits() {
  const [outfitIds, _setOutfitIds] = useState(loadLocal);
  const syncTimer = useRef(null);

  /* ── On mount: fetch from backend and merge ── */
  useEffect(() => {
    fetch("/api/outfits")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.outfits && Object.keys(data.outfits).length > 0) {
          // Backend takes precedence for cross-device truth.
          // Local data keeps any days not yet synced to backend.
          _setOutfitIds((prev) => {
            const merged = { ...prev, ...data.outfits };
            saveLocal(merged);
            return merged;
          });
        }
      })
      .catch(() => {}); // silently fall back to local-only mode
  }, []);

  /* ── setOutfitIds: persist locally + debounced sync to backend ── */
  const setOutfitIds = (updater) => {
    _setOutfitIds((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveLocal(next);

      // Debounced backend sync — avoids hammering on rapid changes
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        fetch("/api/outfits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outfits: next }),
        }).catch(() => {}); // silently fail if backend unavailable
      }, 300);

      return next;
    });
  };

  return { outfitIds, setOutfitIds };
}
