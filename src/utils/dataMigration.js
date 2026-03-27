/* ─── One-Time Data Migration ────────────────────────────────────────────────
   Runs once per userId when the user first authenticates.
   Copies all legacy (pre-Vesti-refactor) localStorage keys into the new
   userId-namespaced keys so no existing data is lost.

   Legacy keys (written by the old single-user app):
     wdb_cache_v3        → wardrobe cache from Google Sheets
     wdb_overrides_v2    → manual edits / additions / deletions
     wdb_outfits_v3      → per-day outfit assignments
     wdb_capsule_v1      → trip capsule item IDs

   New keys (per-user namespaced):
     vesti_${userId}_cache_v1
     vesti_${userId}_overrides_v1
     vesti_${userId}_outfits_v1
     vesti_${userId}_capsule_v1

   Safety:
     - Only runs if the new namespaced key does NOT already exist
     - Marks completion with vesti_${userId}_migrated = "1"
     - Never deletes legacy keys (safe to re-read if something goes wrong)
   ─────────────────────────────────────────────────────────────────────────── */

const LEGACY_MAP = [
  { from: "wdb_cache_v3",     to: (uid) => `vesti_${uid}_cache_v1`     },
  { from: "wdb_overrides_v2", to: (uid) => `vesti_${uid}_overrides_v1` },
  { from: "wdb_outfits_v3",   to: (uid) => `vesti_${uid}_outfits_v1`   },
  { from: "wdb_capsule_v1",   to: (uid) => `vesti_${uid}_capsule_v1`   },
];

/* ── migrateLocalData — call once when userId becomes available ─────────── */
export function migrateLocalData(userId) {
  if (!userId) return;

  const flagKey = `vesti_${userId}_migrated`;

  // Already migrated on this device for this user
  if (localStorage.getItem(flagKey)) return;

  let migrated = 0;

  LEGACY_MAP.forEach(({ from, to }) => {
    try {
      const newKey  = to(userId);
      const legVal  = localStorage.getItem(from);

      // Only copy if there's legacy data AND the new key doesn't exist yet
      if (!legVal) return;
      if (localStorage.getItem(newKey)) return; // already has user-scoped data, don't overwrite

      localStorage.setItem(newKey, legVal);
      migrated++;
      console.log(`[Vesti migration] ${from} → ${newKey}`);
    } catch {
      // Storage quota or parse error — skip this key
    }
  });

  // Mark migration done for this userId
  localStorage.setItem(flagKey, "1");

  if (migrated > 0) {
    console.log(`[Vesti migration] Migrated ${migrated} data stores for user ${userId.slice(0, 8)}…`);
    // Dispatch event so open hooks can reload their state from the new keys
    window.dispatchEvent(new CustomEvent("vesti-data-migrated", { detail: { userId } }));
  }
}

/* ── hasMigrated — check without running ───────────────────────────────── */
export function hasMigrated(userId) {
  if (!userId) return false;
  return Boolean(localStorage.getItem(`vesti_${userId}_migrated`));
}
