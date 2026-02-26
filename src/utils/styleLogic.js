/* ─── STYLE LOGIC — derived intelligence from category ─────────────────────── */

/* ─── getLayer ────────────────────────────────────────────────────────────── */
// Returns: "outer" | "mid" | "base" | "bottom" | "shoes"
export function getLayer(category) {
  if (!category) return "base";
  const cat = category.toLowerCase().trim();

  if (
    cat.includes("jacket") ||
    cat.includes("coat") ||
    cat.includes("blazer") ||
    cat.includes("overshirt") ||
    cat.includes("windbreaker") ||
    cat.includes("parka") ||
    cat.includes("anorak")
  )
    return "outer";

  if (
    cat.includes("sweater") ||
    cat.includes("sweatshirt") ||
    cat.includes("jumper") ||
    cat.includes("hoodie") ||
    cat.includes("fleece") ||
    cat.includes("knit")
  )
    return "mid";

  if (
    cat.includes("sneakers") ||
    cat.includes("shoes") ||
    cat.includes("boots") ||
    cat.includes("trainers") ||
    cat.includes("derby") ||
    cat.includes("sandals") ||
    cat.includes("loafers") ||
    cat.includes("footwear")
  )
    return "shoes";

  if (
    cat.includes("pants") ||
    cat.includes("jeans") ||
    cat.includes("trousers") ||
    cat.includes("bottoms") ||
    cat.includes("shorts") ||
    cat.includes("cargo") ||
    cat.includes("joggers") ||
    cat.includes("track") ||
    cat.includes("chinos") ||
    cat.includes("skirt") ||
    cat.includes("linen pant")
  )
    return "bottom";

  // Default: base (shirts, t-shirts, polos, tank tops, etc.)
  return "base";
}

/* ─── getOccasion ─────────────────────────────────────────────────────────── */
// Returns: "casual" | "dinner" | "travel" | "gym"
export function getOccasion(category) {
  if (!category) return "casual";
  const cat = category.toLowerCase().trim();

  if (cat.includes("gym") || cat.includes("sport") || cat.includes("athletic") || cat.includes("running"))
    return "gym";

  if (cat.includes("blazer") || cat.includes("formal") || cat.includes("dress shirt"))
    return "dinner";

  if (cat.includes("jacket") || cat.includes("coat"))
    return "dinner"; // jackets → dinner/travel

  if (cat.includes("shirt") && !cat.includes("t-shirt") && !cat.includes("tee"))
    return "casual"; // shirts → casual/dinner (casual as primary)

  return "casual";
}

/* ─── getWeather ──────────────────────────────────────────────────────────── */
// Returns: "Cold" | "Mild" | "Warm"
export function getWeather(category) {
  if (!category) return "Mild";
  const cat = category.toLowerCase().trim();

  if (
    cat.includes("jacket") ||
    cat.includes("coat") ||
    cat.includes("sweater") ||
    cat.includes("sweatshirt") ||
    cat.includes("jumper") ||
    cat.includes("hoodie") ||
    cat.includes("fleece") ||
    cat.includes("knit") ||
    cat.includes("wool")
  )
    return "Cold";

  if (
    cat.includes("t-shirt") ||
    cat.includes("tshirt") ||
    cat.includes("tee") ||
    cat.includes("tank") ||
    cat.includes("gym")
  )
    return "Warm";

  return "Mild"; // shirts, pants, shoes etc → mild/neutral
}

/* ─── COLOR MATCHING ──────────────────────────────────────────────────────── */
const NEUTRALS = [
  "black", "white", "grey", "gray", "charcoal", "navy", "beige", "cream",
  "camel", "stone", "tan", "khaki", "ecru", "oyster", "sand", "ivory",
  "off-white", "offwhite", "dark navy", "midnight", "nude",
];

const CLASHES = [
  ["red", "orange"],
  ["pink", "orange"],
  ["red", "purple"],
  ["yellow", "green"],
  ["lime", "red"],
  ["bright blue", "purple"],
];

export function colorsCompat(c1, c2) {
  if (!c1 || !c2) return true;
  const a = c1.toLowerCase();
  const b = c2.toLowerCase();
  if (NEUTRALS.some((n) => a.includes(n)) || NEUTRALS.some((n) => b.includes(n))) return true;
  for (const [x, y] of CLASHES) {
    if ((a.includes(x) && b.includes(y)) || (a.includes(y) && b.includes(x))) return false;
  }
  return true;
}

export function outfitColorsOk(items) {
  const colors = items.map((i) => i.color || i.col).filter(Boolean);
  for (let i = 0; i < colors.length; i++)
    for (let j = i + 1; j < colors.length; j++)
      if (!colorsCompat(colors[i], colors[j])) return false;
  return true;
}

/* ─── OUTFIT GENERATION ───────────────────────────────────────────────────── */
// Generates a {base, mid, outer, bottom, shoes} outfit from GS wardrobe items.
// day: { occ, w } from trip data
// usedIds: Set of item IDs already worn on other days (penalized, not excluded)
export function generateOutfit(gsItems, day, usedIds = new Set()) {
  if (!gsItems || gsItems.length === 0) return {};

  // Prefer selected items; fall back to full wardrobe if fewer than 5 selected
  const selected = gsItems.filter((i) => i.selected);
  const pool = selected.length >= 5 ? selected : gsItems;

  // Bucket by layer (handle both GS schema and local short-field schema)
  const byLayer = {};
  for (const item of pool) {
    const layer = getLayer(item.category || item.c || "");
    if (!byLayer[layer]) byLayer[layer] = [];
    byLayer[layer].push(item);
  }

  const dayWeather = (day?.w || "Mild");
  const dayOcc = (day?.occ || "Casual");

  const score = (item) => {
    let s = 0;
    const cat = item.category || item.c || "";
    const iw = getWeather(cat);
    const io = getOccasion(cat);

    // Weather match
    if (iw === dayWeather) s += 4;
    if (dayWeather === "Cold" && iw === "Mild") s += 1;
    if (dayWeather === "Mild" && iw === "Warm") s += 1;

    // Occasion match
    if (io === dayOcc.toLowerCase()) s += 3;
    if (dayOcc === "Gym" && io === "gym") s += 5;

    // Not already used → prefer fresh items
    if (!usedIds.has(item.id)) s += 3;

    return s;
  };

  // Pick best item per layer (optionally excluding specific ids)
  const best = (layer, excludeIds = []) => {
    const items = (byLayer[layer] || []).filter((i) => !excludeIds.includes(i.id));
    if (!items.length) return null;
    return [...items].sort((a, b) => score(b) - score(a))[0];
  };

  const base = best("base");
  const bottom = best("bottom");
  const shoes = best("shoes");

  const needsMid =
    dayWeather === "Cold" ||
    (dayWeather === "Mild" && ["Dinner", "Flight"].includes(dayOcc));
  const needsOuter = dayWeather === "Cold" || dayOcc === "Flight" || dayWeather === "Mild";

  const mid = needsMid ? best("mid") : null;
  const outer = needsOuter ? best("outer") : null;

  return { base, mid, outer, bottom, shoes };
}

/* ─── SWAP ITEM ───────────────────────────────────────────────────────────── */
// Returns the next available item in the same layer, skipping currentId.
export function swapItem(gsItems, currentId, category, usedIds = new Set()) {
  const layer = getLayer(category);
  const pool = gsItems.filter((i) => getLayer(i.category) === layer && i.id !== currentId);
  if (!pool.length) return null;
  // Prefer unused
  const unused = pool.filter((i) => !usedIds.has(i.id));
  return (unused.length ? unused : pool)[0];
}
