/* ─── Canvas rendering utilities (shared by ExportModal + DayExportModal) ───── */

const LAYERS = ["base", "mid", "outer", "thermalBottom", "bottom", "shoes"];

/**
 * Load an image URL → HTMLImageElement, resolving null on error/timeout.
 * @param {string|null} src
 * @param {number} [timeout=4000]
 * @returns {Promise<HTMLImageElement|null>}
 */
export function loadImg(src, timeout = 4000) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
    setTimeout(() => resolve(null), timeout);
  });
}

/**
 * Resolve slot IDs → array of wardrobe items (in layer order, skipping REMOVED/missing).
 * @param {Object|null} slotIds  — { base, mid, outer, thermalBottom, bottom, shoes }
 * @param {Array}       wardrobe — full wardrobe array
 * @returns {Array} resolved items
 */
export function resolveOutfitItems(slotIds, wardrobe) {
  if (!slotIds) return [];
  return LAYERS
    .map((k) => {
      const id = slotIds[k];
      if (!id || id === "REMOVED") return null;
      return wardrobe.find((i) => i.id === id) || null;
    })
    .filter(Boolean);
}
