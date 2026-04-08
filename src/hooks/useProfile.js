/* ─── useProfile hook ─────────────────────────────────────────────────────────
   Manages profile reference photos used for outfit preview generation.
   Photos are stored as data URLs in localStorage, namespaced per user.

   API:
   - photos[]       — array of { id, dataUrl, addedAt }
   - addPhoto(file) — add a photo (max MAX_PHOTOS)
   - removePhoto(id)— remove by ID
   - clearAll()     — remove all photos
   - MAX_PHOTOS     — 3 (free tier limit)
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useCallback } from "react";
import { useUser } from "../contexts/AuthContext";

export const MAX_PHOTOS = 3;

function getStorageKey(userId) {
  return userId ? `vesti_${userId}_profile_photos` : "vesti_profile_photos";
}

function loadPhotos(userId) {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePhotos(userId, photos) {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(photos));
  } catch { /* quota */ }
}

export default function useProfile() {
  const user = useUser();
  const userId = user?.id ?? null;

  const [photos, setPhotos] = useState(() => loadPhotos(userId));

  const addPhoto = useCallback(
    (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotos((prev) => {
          if (prev.length >= MAX_PHOTOS) return prev;
          const next = [
            ...prev,
            { id: `photo_${Date.now()}`, dataUrl: e.target.result, addedAt: Date.now() },
          ];
          savePhotos(userId, next);
          return next;
        });
      };
      reader.readAsDataURL(file);
    },
    [userId]
  );

  const removePhoto = useCallback(
    (id) => {
      setPhotos((prev) => {
        const next = prev.filter((p) => p.id !== id);
        savePhotos(userId, next);
        return next;
      });
    },
    [userId]
  );

  const clearAll = useCallback(() => {
    setPhotos([]);
    savePhotos(userId, []);
  }, [userId]);

  return { photos, addPhoto, removePhoto, clearAll, MAX_PHOTOS };
}
