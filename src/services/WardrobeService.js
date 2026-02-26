/* ─── WARDROBE SERVICE — Google Sheets data source ─────────────────────────── */
const SHEET_ID = "1TAzjCeNh9x0yrtF9Qg7YYuYAUYDcvZYWxagGvQUP5O0";
const SHEET_NAME = "Wardrobe_Master";

// Google Sheets CSV export URL (works for publicly accessible sheets)
function sheetUrl() {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
}

/* ─── CSV PARSER ─────────────────────────────────────────────────────────── */
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function clean(v) {
  return (v || "").trim().replace(/^"|"$/g, "").trim();
}

/* ─── COLUMN RESOLUTION (flexible header matching) ──────────────────────── */
function findCol(headers, ...candidates) {
  for (const candidate of candidates) {
    const idx = headers.findIndex(
      (h) => h.toLowerCase().replace(/\s+/g, " ").trim() === candidate.toLowerCase()
    );
    if (idx !== -1) return idx;
  }
  // Partial match fallback
  for (const candidate of candidates) {
    const idx = headers.findIndex((h) =>
      h.toLowerCase().includes(candidate.toLowerCase())
    );
    if (idx !== -1) return idx;
  }
  return -1;
}

/* ─── MAIN FETCH ─────────────────────────────────────────────────────────── */
export async function fetchWardrobe() {
  const res = await fetch(sheetUrl());
  if (!res.ok) throw new Error(`Google Sheets fetch failed: ${res.status}`);
  const csv = await res.text();
  return parseWardrobe(csv);
}

export function parseWardrobe(csv) {
  const lines = csv.trim().split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const rawHeaders = parseCSVLine(lines[0]).map(clean);

  // Resolve column indices
  const col = {
    category: findCol(rawHeaders, "category"),
    itemName: findCol(rawHeaders, "item name", "name"),
    color: findCol(rawHeaders, "color", "colour"),
    size: findCol(rawHeaders, "size"),
    brand: findCol(rawHeaders, "brand"),
    imageUrl: findCol(rawHeaders, "image url", "image / image url", "image/image url", "imageurl"),
    image: findCol(rawHeaders, "image"),
    price: findCol(rawHeaders, "price"),
    purchaseDate: findCol(rawHeaders, "purchase date", "date"),
    productCode: findCol(rawHeaders, "product code", "sku", "code"),
    selected: findCol(rawHeaders, "selected"),
  };

  return lines
    .slice(1)
    .map((line, idx) => {
      const vals = parseCSVLine(line).map(clean);
      const get = (c) => (c !== -1 ? vals[c] || "" : "");

      const rawImageUrl = get(col.imageUrl);
      const rawImage = get(col.image);
      // Prefer "Image URL" column; if it's a Google Drive ID (no http), convert it
      const imageUrl = pickImageUrl(rawImageUrl, rawImage);

      const selectedRaw = get(col.selected).toLowerCase();
      const selected =
        selectedRaw === "true" ||
        selectedRaw === "yes" ||
        selectedRaw === "1" ||
        selectedRaw === "✓" ||
        selectedRaw === "x";

      const itemName = get(col.itemName);
      const category = get(col.category);
      const color = get(col.color);
      const brand = get(col.brand);

      if (!itemName && !category) return null; // skip blank rows

      return {
        id: `gs_${idx}_${itemName.slice(0, 8).replace(/\s/g, "")}`,
        // Google Sheets canonical fields
        itemName,
        category,
        color,
        size: get(col.size),
        brand,
        imageUrl,
        price: get(col.price),
        purchaseDate: get(col.purchaseDate),
        productCode: get(col.productCode),
        selected,
        // Short-field aliases for compatibility with ItemVisual
        n: itemName,
        c: category,
        col: color,
        b: brand,
        img: imageUrl,
      };
    })
    .filter(Boolean);
}

/* ─── IMAGE URL HELPER ───────────────────────────────────────────────────── */
function pickImageUrl(primary, fallback) {
  const url = primary || fallback || "";
  if (!url) return "";
  // Already a full HTTP URL
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  // Google Drive file ID — convert to public image URL
  if (/^[A-Za-z0-9_-]{20,}$/.test(url)) {
    return `https://lh3.googleusercontent.com/d/${url}`;
  }
  return url;
}

/* ─── ADAPT LOCAL WARDROBE (fallback when Google Sheet is not accessible) ── */
// Converts local wardrobe.js items (short-field schema) to the GS schema
// so all downstream logic works from a single schema.
export function adaptLocalWardrobe(localItems) {
  return localItems.map((item) => ({
    // GS canonical fields
    id: item.id,
    itemName: item.n || "",
    category: item.c || "",
    color: item.col || "",
    size: "",
    brand: item.b || "",
    imageUrl: item.img || "",
    price: "",
    purchaseDate: "",
    productCode: "",
    // Use travel-ready ("Yes") as the "selected" signal for local data
    selected: item.t === "Yes",
    // Short-field aliases (for ItemVisual compatibility)
    n: item.n || "",
    c: item.c || "",
    col: item.col || "",
    b: item.b || "",
    img: item.img || "",
  }));
}
