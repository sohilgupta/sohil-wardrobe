/* ─── URL IMPORT — PURE UTILITY FUNCTIONS ────────────────────────────────────
   Used by:
   - api/extract-product.js  (server-side, duplicates validateUrl / mapCategory)
   - tests/extractProduct.test.js (unit tests)
   - src/components/WardrobeTab.jsx (fetchProductDetails only)
   ─────────────────────────────────────────────────────────────────────────── */

/* ─── Layer / category mapping ───────────────────────────────────────────── */
export const LAYER_MAP = [
  { pattern: /t-?shirt|tee|shirt|blouse|top|polo/i,        l: "Base",     c: "Shirts"   },
  { pattern: /sweater|sweatshirt|hoodie|knit|pullover/i,    l: "Mid",      c: "Knitwear" },
  { pattern: /jacket|coat|blazer|parka|bomber|gilet/i,      l: "Outer",    c: "Jackets"  },
  { pattern: /jean|trouser|chino|pant|short|skirt|bottom/i, l: "Bottom",   c: "Trousers" },
  { pattern: /shoe|sneaker|boot|loafer|sandal|trainer/i,    l: "Footwear", c: "Footwear" },
];

export function mapCategory(raw) {
  if (!raw) return { l: "Base", c: "Shirts" };
  const entry = LAYER_MAP.find((e) => e.pattern.test(raw));
  return entry ? { l: entry.l, c: entry.c } : { l: "Base", c: "Shirts" };
}

/* ─── URL validation ─────────────────────────────────────────────────────── */
const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^::1$/,
  /^0\.0\.0\.0$/,
];

export function validateUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid URL");
  if (BLOCKED_HOSTS.some((re) => re.test(url.hostname))) throw new Error("Invalid URL");
  return url.toString();
}

/* ─── OG tag parser ──────────────────────────────────────────────────────── */
export function parseOgTags(html) {
  const result = {};
  for (const [tag] of html.matchAll(/<meta[^>]+>/gi)) {
    const prop    = (tag.match(/property=["']([^"']+)["']/i) || [])[1];
    const name    = (tag.match(/name=["']([^"']+)["']/i) || [])[1];
    const content = (tag.match(/content=["']([^"']+)["']/i) || [])[1];
    if (!content) continue;
    const key = prop || name || "";
    if (key === "og:title")                              result.name        = result.name  || content;
    if (key === "og:image" || key === "og:image:secure_url") result.image = result.image || content;
    if (key === "og:description")                        result.description = content;
  }
  if (!result.name) {
    const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (m) result.name = m[1].trim();
  }
  return result;
}

/* ─── JSON-LD parser ─────────────────────────────────────────────────────── */
export function parseJsonLd(html) {
  const result = {};
  for (const [, json] of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    let data;
    try { data = JSON.parse(json); } catch { continue; }
    const items = Array.isArray(data) ? data : [data];
    for (const item of items) {
      if (item["@type"] !== "Product") continue;
      if (item.name)        result.name  = result.name  || item.name;
      if (item.brand?.name) result.brand = result.brand || item.brand.name;
      if (item.color)       result.color = result.color || item.color;
      const img = Array.isArray(item.image) ? item.image[0] : item.image;
      if (img)              result.image = result.image || img;
      const cat = item.category || item.productType;
      if (cat && !result.l) {
        const { l, c } = mapCategory(cat);
        result.l = l;
        result.c = result.c || c;
      }
    }
  }
  return result;
}

/* ─── Sufficiency check ──────────────────────────────────────────────────── */
export function isSufficient(obj) {
  return !!(obj.name && (obj.color || obj.l));
}

/* ─── Client fetch helper ────────────────────────────────────────────────── */
export async function fetchProductDetails(url) {
  const res = await fetch("/api/extract-product", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { ok: false, error: data.error, partial: data.partial || {} };
  }
  return { ok: true, data };
}
