/* ─── useProfile — Reference photo management ────────────────────────────────
   Stores up to 5 compressed reference photos in localStorage.
   Photos are compressed client-side to ≤ 768px / JPEG 82% before storing,
   keeping each photo under ~250KB.

   Cross-device sync via /api/profile (Upstash KV). Gracefully falls back to
   localStorage-only if the backend returns 503 (not configured).

   Storage key: wdb_profile_photos_v1  (array of base64 data URIs)
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "wdb_profile_photos_v1";
const MAX_PHOTOS  = 5;
const MAX_DIM     = 768;
const JPEG_Q      = 0.82;

/* ── Compress an image File → base64 JPEG data URI ── */
function compressPhoto(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio  = Math.min(MAX_DIM / img.width, MAX_DIM / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", JPEG_Q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

function loadPhotos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePhotos(photos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
  } catch {
    // localStorage full — drop oldest until it fits
    const trimmed = photos.slice(1);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)); } catch { /* ignore */ }
  }
}

/* ── Backend sync helpers ─────────────────────────────────────────────────── */

async function fetchFromBackend() {
  try {
    const res = await fetch("/api/profile");
    if (!res.ok) return null;               // 401, 503, etc. — fall through to local
    const data = await res.json();
    return Array.isArray(data.photos) ? data.photos : null;
  } catch {
    return null;
  }
}

function pushToBackend(photos) {
  fetch("/api/profile", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ photos }),
  }).catch(() => {}); // silently fail if backend unavailable
}

/* ── Hook ─────────────────────────────────────────────────────────────────── */

export default function useProfile() {
  const [photos, setPhotos] = useState(loadPhotos);
  const syncTimer = useRef(null);

  // Debounced backend push (300ms)
  const scheduleSync = useCallback((nextPhotos) => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => pushToBackend(nextPhotos), 300);
  }, []);

  // On mount: fetch from backend and merge (backend wins on conflict)
  useEffect(() => {
    fetchFromBackend().then((remote) => {
      if (!remote) return;                  // backend not configured or offline
      setPhotos((local) => {
        // Use whichever set has more photos (simple merge strategy)
        const merged = remote.length >= local.length ? remote : local;
        savePhotos(merged);
        return merged;
      });
    });
  }, []);

  const addPhoto = useCallback(async (file) => {
    if (!file) return;
    const dataUrl = await compressPhoto(file);
    if (!dataUrl) return;
    setPhotos((prev) => {
      const next = [...prev, dataUrl].slice(-MAX_PHOTOS);
      savePhotos(next);
      scheduleSync(next);
      return next;
    });
  }, [scheduleSync]);

  const removePhoto = useCallback((index) => {
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== index);
      savePhotos(next);
      scheduleSync(next);
      return next;
    });
  }, [scheduleSync]);

  const clearAll = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setPhotos([]);
    scheduleSync([]);
  }, [scheduleSync]);

  return { photos, addPhoto, removePhoto, clearAll, MAX_PHOTOS };
}
