/* ─── DRIVE IMAGE SERVICE ────────────────────────────────────────────────────
   Auto-enriches wardrobe items that lack images by matching them to Drive
   images already known from the wardrobe.js local catalog.

   All image URLs use the secure proxy path /api/image?id={fileId}.
   No raw Google Drive or lh3.googleusercontent.com URLs reach the browser.

   Flow:
     1. buildDriveCatalog(items)  — scan all items for Drive file IDs in img URLs
     2. findUnimagedItems(items)  — find items with img === ""
     3. matchDriveImages() via Claude  — batch-match by name/color/brand
     4. applyDriveMatches(items)  — fill in proxy img URLs (non-destructive)
     5. Cache in localStorage (invalidated when unimaged set changes)
   ─────────────────────────────────────────────────────────────────────────── */

import { matchDriveImages } from "../engine/ai";

const DRIVE_MATCHES_KEY = "wdb_drive_matches_v1";
const CACHE_TTL_MS      = 7 * 24 * 60 * 60 * 1000; // 1 week

/* ─── Parse Drive file ID from any img URL format ────────────────────────── */
export function extractDriveFileId(imgUrl) {
  if (!imgUrl) return null;

  // Proxy URL: /api/image?id={fileId}
  const proxyMatch = imgUrl.match(/\/api\/image\?id=([A-Za-z0-9_-]+)/);
  if (proxyMatch) return proxyMatch[1];

  // lh3.googleusercontent.com/d/{fileId}
  const lhMatch = imgUrl.match(/lh3\.googleusercontent\.com\/d\/([A-Za-z0-9_-]+)/);
  if (lhMatch) return lhMatch[1];

  // drive.google.com/...?id={fileId} or ?...&id={fileId}
  const qMatch = imgUrl.match(/[?&]id=([A-Za-z0-9_-]{20,})/);
  if (qMatch) return qMatch[1];

  // drive.google.com/file/d/{fileId}/...
  const pathMatch = imgUrl.match(/\/d\/([A-Za-z0-9_-]{20,})/);
  if (pathMatch) return pathMatch[1];

  return null;
}

/* ─── Build catalog from items that already have Drive images ─────────────── */
// Returns Map<fileId → { name, category, color, brand }>
export function buildDriveCatalog(items) {
  const catalog = new Map();
  for (const item of items) {
    const img = item.img || item.imageUrl || "";
    const fileId = extractDriveFileId(img);
    if (!fileId) continue;
    catalog.set(fileId, {
      name:     item.n     || item.itemName  || "",
      category: item.c     || item.category  || "",
      color:    item.col   || item.color     || "",
      brand:    item.b     || item.brand     || "",
    });
  }
  return catalog;
}

/* ─── Find items that have no image ──────────────────────────────────────── */
export function findUnimagedItems(items) {
  return items
    .filter((i) => !i.img && !i.imageUrl)
    .map((i) => ({
      id:       i.id,
      name:     i.n     || i.itemName  || "",
      category: i.c     || i.category  || "",
      color:    i.col   || i.color     || "",
      brand:    i.b     || i.brand     || "",
    }));
}

/* ─── Cache helpers ──────────────────────────────────────────────────────── */
function loadMatchCache(unimagedIds) {
  try {
    const raw = localStorage.getItem(DRIVE_MATCHES_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    if (!cache?.fetchedAt || !cache?.matches) return null;

    // TTL check
    if (Date.now() - cache.fetchedAt > CACHE_TTL_MS) return null;

    // Invalidate if the set of unimaged items has changed
    const cached  = [...(cache.unimaged || [])].sort().join(",");
    const current = [...unimagedIds].sort().join(",");
    if (cached !== current) return null;

    return cache.matches; // Record<itemId, fileId>
  } catch {
    return null;
  }
}

function saveMatchCache(unimagedIds, matches) {
  try {
    localStorage.setItem(
      DRIVE_MATCHES_KEY,
      JSON.stringify({ fetchedAt: Date.now(), unimaged: [...unimagedIds].sort(), matches })
    );
  } catch {
    /* quota — no-op, will re-match next session */
  }
}

/* ─── Apply matched file IDs back to items (non-destructive) ─────────────── */
export function applyDriveMatches(items, matches) {
  return items.map((item) => {
    if (item.img || item.imageUrl) return item; // already has image
    const fileId = matches[item.id];
    if (!fileId) return item;
    // Use secure proxy URL — never a raw Drive link
    const url = `/api/image?id=${fileId}`;
    return { ...item, img: url, imageUrl: url, _driveMatched: true };
  });
}

/* ─── Main entry: enrich items with Drive images ─────────────────────────── */
// Called from useWardrobe after sync. Fully async, fire-and-forget.
// Calls setItems only if new matches are applied (or found in cache).
export async function enrichWithDriveImages(items, setItems) {
  try {
    const catalog  = buildDriveCatalog(items);
    const unimaged = findUnimagedItems(items);

    // Guard 1: nothing to do
    if (unimaged.length === 0) return;

    // Guard 2: no catalog to match against
    if (catalog.size === 0) return;

    const unimagedIds = unimaged.map((i) => i.id);

    // Try cache first
    const cached = loadMatchCache(unimagedIds);
    if (cached) {
      // Use functional update form so we always operate on latest state,
      // never overwriting concurrent edits made while enrichment ran
      setItems((prev) => applyDriveMatches(prev, cached));
      return;
    }

    // Call Claude to batch-match (goes through /api/ai proxy)
    const matches = await matchDriveImages(unimaged, catalog);

    // Cache result (even empty {} — prevents re-calling Claude every sync)
    saveMatchCache(unimagedIds, matches);

    if (Object.keys(matches).length > 0) {
      setItems((prev) => applyDriveMatches(prev, matches));
    }
  } catch {
    /* Any failure is silent — swatch fallbacks remain */
  }
}
