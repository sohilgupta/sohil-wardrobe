// src/hooks/useGuestSession.js
/* ─── useGuestSession ─────────────────────────────────────────────────────────
   Manages the anonymous guest identity stored in localStorage.
   Called once inside AuthProvider — not by components directly.
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useCallback } from "react";

const GUEST_ID_KEY = "vesti_guest_id";

function guestPrefix(guestId) {
  return `vesti_guest_${guestId}_`;
}

/** Read or create the guestId. Only creates if no Supabase user exists. */
export function initGuestId(hasUser) {
  if (hasUser) return null;
  const existing = localStorage.getItem(GUEST_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(GUEST_ID_KEY, id);
  return id;
}

export default function useGuestSession(user) {
  const [guestId, setGuestId] = useState(() => {
    if (user) return null;
    return localStorage.getItem(GUEST_ID_KEY) || null;
  });

  /** Removes vesti_guest_id and all vesti_guest_<id>_* keys. */
  const clearGuestSession = useCallback(() => {
    const id = localStorage.getItem(GUEST_ID_KEY);
    if (!id) return;
    const prefix = guestPrefix(id);
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k === GUEST_ID_KEY || k.startsWith(prefix))) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
    setGuestId(null);
  }, []);

  /** Called when no user is present — ensures a guestId exists. */
  const ensureGuestId = useCallback(() => {
    const existing = localStorage.getItem(GUEST_ID_KEY);
    if (existing) { setGuestId(existing); return existing; }
    const id = crypto.randomUUID();
    localStorage.setItem(GUEST_ID_KEY, id);
    setGuestId(id);
    return id;
  }, []);

  return { guestId, isGuest: !user && !!guestId, clearGuestSession, ensureGuestId };
}

/** Helper: namespaced localStorage key for a given guest data type */
export function guestKey(guestId, type) {
  return `vesti_guest_${guestId}_${type}`;
}
