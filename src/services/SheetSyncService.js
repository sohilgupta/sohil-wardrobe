/* ─── SHEET SYNC SERVICE ─────────────────────────────────────────────────────
   Fetches Jackets / Shoes / Sweaters / Thermals / Shirts / Gym Tshirts / Bottoms
   from the server-side proxy (/api/wardrobe) which fetches from Google Sheets.
   The raw gviz JSON text is returned by the API; parsing stays client-side.

   Uses the gviz JSON endpoint (not CSV) so that embedded Image columns in the
   sheet don't corrupt the export (CSV collapses all rows into one when an
   embedded image cell is present).
   ─────────────────────────────────────────────────────────────────────────── */

export const WARDROBE_TABS = [
  "Jackets",
  "Shoes",
  "Sweaters",
  "Thermals",
  "Shirts",
  "Gym Tshirts",
  "Bottoms",
];

/* ─── Parse gviz JSON response ───────────────────────────────────────────── */
// The response is wrapped: google.visualization.Query.setResponse({...});
// Strip that wrapper to get valid JSON.
function parseGvizJson(text) {
  // The wrapper is always "google.visualization.Query.setResponse(" ... ");"
  const start = text.indexOf("{");
  const end   = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Invalid gviz response");
  return JSON.parse(text.slice(start, end + 1));
}

/* ─── Find column index by label (case-insensitive, partial match) ────────── */
function findColByLabel(cols, ...candidates) {
  for (const c of candidates) {
    const lc = c.toLowerCase();
    const i  = cols.findIndex(
      (col) => col.label.toLowerCase() === lc ||
               col.label.toLowerCase().includes(lc)
    );
    if (i !== -1) return i;
  }
  return -1;
}

/* ─── Safe cell value getter ─────────────────────────────────────────────── */
function cellVal(row, idx) {
  if (idx === -1 || !row.c || !row.c[idx]) return "";
  const v = row.c[idx].v;
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/* ─── Image URL resolver — returns proxy path, never a raw Drive URL ──────── */
function resolveImg(raw) {
  if (!raw) return "";

  // Extract the Drive file ID from any supported format and return the
  // secure image proxy URL (/api/image?id=) — Drive URLs stay server-side.
  if (raw.includes("drive.google.com")) {
    const idFromQuery = raw.match(/[?&]id=([A-Za-z0-9_-]+)/);
    const idFromPath  = raw.match(/\/d\/([A-Za-z0-9_-]+)/);
    const fileId = (idFromQuery || idFromPath)?.[1];
    return fileId ? `/api/image?id=${fileId}` : "";
  }

  // Already a proxy URL — pass through
  if (raw.startsWith("/api/image?id=")) return raw;

  // lh3.googleusercontent.com/d/{fileId} — extract the file ID
  const lhMatch = raw.match(/lh3\.googleusercontent\.com\/d\/([A-Za-z0-9_-]+)/);
  if (lhMatch) return `/api/image?id=${lhMatch[1]}`;

  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;

  // Raw Drive file ID (20+ alphanumeric chars with no slashes)
  if (/^[A-Za-z0-9_-]{20,}$/.test(raw))
    return `/api/image?id=${raw}`;

  return "";
}

/* ─── Derive layer from tab name ─────────────────────────────────────────── */
export function layerFromTab(tab) {
  const t = tab.toLowerCase();
  if (t.includes("jacket")) return "Outer";
  if (t.includes("sweater")) return "Mid";
  if (t.includes("shoe") || t.includes("footwear")) return "Footwear";
  if (t.includes("bottom")) return "Bottom";
  // Shirts, Gym Tshirts, Thermals → Base
  return "Base";
}

/* ─── Footwear keywords — override layer if tab assignment is wrong ─────── */
const FOOTWEAR_KEYWORDS = [
  "shoe", "shoes", "sneaker", "boot", "loafer", "slipper",
  "sandal", "slide", "slides", "flip flop", "trainer", "mule",
];

function isFootwearByName(name) {
  const lower = name.toLowerCase();
  return FOOTWEAR_KEYWORDS.some((kw) => lower.includes(kw));
}

export function occFromTab(tab) {
  const t = tab.toLowerCase();
  if (t.includes("gym")) return "Gym";
  return "Casual";
}

export function weatherFromTab(tab) {
  const t = tab.toLowerCase();
  if (t.includes("jacket") || t.includes("sweater") || t.includes("thermal"))
    return "Cold";
  if (t.includes("gym") || t.includes("tshirt")) return "Warm";
  return "Mild";
}

/* ─── Normalize one tab's gviz JSON into items ───────────────────────────── */
function normalizeTab(tabName, gvizData) {
  const { cols, rows } = gvizData.table;

  if (!rows || rows.length === 0) return [];

  // Detect login redirect (cols will be empty or have unexpected labels)
  if (!cols || cols.length === 0)
    throw new Error(`Tab "${tabName}" returned no columns — sheet may be private`);

  const colIdx = {
    name:        findColByLabel(cols, "item name", "name"),
    category:    findColByLabel(cols, "category"),
    color:       findColByLabel(cols, "color", "colour"),
    brand:       findColByLabel(cols, "brand"),
    productCode: findColByLabel(cols, "product code", "sku", "code"),
    imageUrl:    findColByLabel(cols, "image url", "image / image url", "image/image url", "imageurl"),
    image:       findColByLabel(cols, "image"),   // fallback embedded-image column
    notes:       findColByLabel(cols, "notes", "note"),
    size:        findColByLabel(cols, "size"),
    price:       findColByLabel(cols, "price"),
  };

  // Prefer "image url" column; fall back to "image" column
  const imgColIdx = colIdx.imageUrl !== -1 ? colIdx.imageUrl : colIdx.image;

  const layer   = layerFromTab(tabName);
  const occ     = occFromTab(tabName);
  const weather = weatherFromTab(tabName);

  return rows
    .map((row, idx) => {
      const name = cellVal(row, colIdx.name);
      if (!name) return null;

      // Skip summary/formula rows (e.g. "Sum =" totals row)
      if (name.toLowerCase().startsWith("sum")) return null;

      const color       = cellVal(row, colIdx.color) || "Black";
      const brand       = cellVal(row, colIdx.brand);
      const productCode = cellVal(row, colIdx.productCode);
      const imgRaw      = cellVal(row, imgColIdx);

      // Stable ID: tab + index + first chars of name
      const id = `gs_${tabName.replace(/\s+/g, "_")}_${idx}_${name
        .slice(0, 8)
        .replace(/\W/g, "")}`;

      // If the tab-based layer is wrong (e.g. slides in Gym Tshirts),
      // override with Footwear when the item name contains footwear keywords.
      const effectiveLayer = (layer !== "Footwear" && isFootwearByName(name))
        ? "Footwear"
        : layer;

      return {
        id,
        // ─ display fields (short-field schema used by ItemVisual / WardrobeTab)
        n:   name,
        c:   (colIdx.category !== -1 ? cellVal(row, colIdx.category) : "") || tabName,
        col: color,
        b:   brand,
        img: resolveImg(imgRaw),
        // ─ extended fields
        productCode,
        notes:    cellVal(row, colIdx.notes),
        size:     cellVal(row, colIdx.size),
        price:    cellVal(row, colIdx.price),
        // ─ derived outfit-engine fields
        l:   effectiveLayer, // "Outer" | "Mid" | "Base" | "Bottom" | "Footwear"
        occ,                // "Casual" | "Gym"
        w:   weather,       // "Cold" | "Mild" | "Warm"
        t:   "Yes",         // all wardrobe items treated as travel-ready
        selected: true,
        // ─ provenance
        _source: "sheets",
        _tab:    tabName,
      };
    })
    .filter(Boolean);
}

/* ─── Public: fetch all tabs via server-side proxy ───────────────────────── */
export async function fetchAllTabs() {
  const res = await fetch("/api/wardrobe");

  if (!res.ok) {
    if (res.status === 401) throw new Error("Not authenticated");
    throw new Error(`Wardrobe API error ${res.status}`);
  }

  // data = { Jackets: "<gviz text>", Shoes: "<gviz text>", ... }
  const data = await res.json();

  const items = [];
  let successCount = 0;

  for (const [tab, text] of Object.entries(data)) {
    try {
      if (text.includes("accounts.google.com"))
        throw new Error(`Tab "${tab}" requires Google auth`);

      const gvizData = parseGvizJson(text);
      items.push(...normalizeTab(tab, gvizData));
      successCount++;
    } catch {
      // Failed tabs are silently skipped — partial data is better than none
    }
  }

  if (successCount === 0)
    throw new Error("All wardrobe tabs failed to load (sheet may be private)");

  return items;
}
