/* ─── useCapsule hook ────────────────────────────────────────────────────────
   Manages the Trip Capsule — a curated subset of wardrobe items used to
   narrow the outfit picker and AI generation to a travel-ready shortlist.

   Storage: localStorage "wdb_capsule_v1" (array of item IDs).
   The capsule is a local planning filter only — not synced to the backend.
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useCallback } from "react";

const CAPSULE_KEY = "wdb_capsule_v1";

function loadCapsuleIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(CAPSULE_KEY));
    return Array.isArray(raw) ? new Set(raw) : new Set();
  } catch {
    return new Set();
  }
}

function saveCapsuleIds(ids) {
  try {
    localStorage.setItem(CAPSULE_KEY, JSON.stringify([...ids]));
  } catch { /* quota */ }
}

export default function useCapsule() {
  const [capsuleIds, setCapsuleIds] = useState(() => loadCapsuleIds());

  const toggleCapsule = useCallback((id) => {
    setCapsuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      saveCapsuleIds(next);
      return next;
    });
  }, []);

  /* Replace entire capsule (used by AI generation) */
  const setManyCapsule = useCallback((ids) => {
    const next = new Set(ids);
    saveCapsuleIds(next);
    setCapsuleIds(next);
  }, []);

  const clearCapsule = useCallback(() => {
    saveCapsuleIds(new Set());
    setCapsuleIds(new Set());
  }, []);

  return { capsuleIds, toggleCapsule, setManyCapsule, clearCapsule };
}
