/* ─── useCapsule hook ────────────────────────────────────────────────────────
   Manages the Trip Capsule — a curated subset of wardrobe items used to
   narrow the outfit picker and AI generation to a travel-ready shortlist.

   Persistence:
   - Primary: /api/capsule backend (KV store, cross-device sync)
   - Cache: localStorage "wdb_capsule_v1" (instant local reads)

   Backend is the source of truth. On mount + page focus + every 5 min:
   re-fetches from backend and replaces local state. On any change:
   saves to localStorage + debounced push to backend.
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useRef, useCallback } from "react";

const LS_KEY = "wdb_capsule_v1";

/* ── localStorage helpers ──────────────────────────────────────────────────── */
function loadLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY));
    return Array.isArray(raw) ? new Set(raw) : new Set();
  } catch {
    return new Set();
  }
}

function saveLocal(ids) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]));
  } catch { /* quota */ }
}

/* ── Hook ─────────────────────────────────────────────────────────────────── */
export default function useCapsule() {
  const [capsuleIds, _setCapsuleIds] = useState(() => loadLocal());

  // Ref always reflects latest — avoids stale closures in callbacks
  const capsuleRef  = useRef(loadLocal());
  const syncTimer   = useRef(null);
  // Track whether backend has been fetched at least once
  const fetchedOnce = useRef(false);

  /* ── Push current state to backend (debounced 300ms) ── */
  const pushToBackend = useCallback((ids) => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      fetch("/api/capsule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...ids] }),
      }).catch(() => {}); // silently fail if backend unavailable
    }, 300);
  }, []);

  /* ── Fetch from backend and replace local state ── */
  const fetchFromBackend = useCallback(() => {
    fetch("/api/capsule")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.ids)) return;
        // Backend is source of truth — replace local state entirely
        const next = new Set(data.ids);
        capsuleRef.current = next;
        saveLocal(next);
        _setCapsuleIds(next);
        fetchedOnce.current = true;
      })
      .catch(() => {
        // Backend unavailable — keep localStorage as fallback
        fetchedOnce.current = true;
      });
  }, []);

  /* ── On mount: fetch from backend ── */
  useEffect(() => { fetchFromBackend(); }, [fetchFromBackend]);

  /* ── On page focus: re-sync (cross-device awareness) ── */
  useEffect(() => {
    window.addEventListener("focus", fetchFromBackend);
    return () => window.removeEventListener("focus", fetchFromBackend);
  }, [fetchFromBackend]);

  /* ── Background refresh every 5 minutes ── */
  useEffect(() => {
    const interval = setInterval(fetchFromBackend, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchFromBackend]);

  /* ── toggleCapsule: add/remove a single item ── */
  const toggleCapsule = useCallback((id) => {
    _setCapsuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      capsuleRef.current = next;
      saveLocal(next);
      pushToBackend(next);
      return next;
    });
  }, [pushToBackend]);

  /* ── setManyCapsule: replace entire capsule (AI generation / init) ── */
  const setManyCapsule = useCallback((ids) => {
    const next = new Set(ids);
    capsuleRef.current = next;
    saveLocal(next);
    pushToBackend(next);
    _setCapsuleIds(next);
  }, [pushToBackend]);

  /* ── clearCapsule: remove all items ── */
  const clearCapsule = useCallback(() => {
    const next = new Set();
    capsuleRef.current = next;
    saveLocal(next);
    pushToBackend(next);
    _setCapsuleIds(next);
  }, [pushToBackend]);

  return { capsuleIds, toggleCapsule, setManyCapsule, clearCapsule, fetchedOnce };
}
