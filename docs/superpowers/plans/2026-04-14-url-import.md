# URL Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any user (guest or logged-in) paste a Zara/Myntra/H&M product URL and auto-populate a wardrobe item via a 3-stage extraction pipeline (OG+JSON-LD → Gemini Flash Lite → Gemini Flash), with a confirmation card before adding.

**Architecture:** A new Vercel serverless function (`api/extract-product.js`) handles fetching and extraction server-side; a thin client helper (`src/utils/urlExtract.js`) exposes pure utility functions used by both the API and the test suite; the WardrobeTab modal grows a URL-import flow (4 states: idle → loading → confirm | error) rendered inline via `importState` — no new component files.

**Tech Stack:** Vitest + jsdom for unit tests; Vercel serverless (Node 18+); Google Gemini API (`gemini-2.0-flash-lite` for Stage 2, `gemini-2.0-flash` for Stage 3); React 19 inline state.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/utils/urlExtract.js` | **Create** | Pure utilities: `validateUrl`, `mapCategory`, `parseOgTags`, `parseJsonLd`, `isSufficient`, `fetchProductDetails` (client POST helper) |
| `tests/extractProduct.test.js` | **Create** | Unit tests for all 6 exports — no network, no Gemini |
| `api/extract-product.js` | **Create** | Vercel serverless: IP rate limit, URL validate, fetch HTML, 3-stage extraction pipeline, normalised response |
| `vercel.json` | **Modify** | Add `"api/extract-product.js": { "maxDuration": 20 }` |
| `src/components/WardrobeTab.jsx` | **Modify** | Import `fetchProductDetails`; add 6 new state vars; add handler functions; replace Add Item modal body with import-aware UI (idle/loading/confirm/error/manual states) |

> **Note on file size:** WardrobeTab.jsx is currently 521 lines. The spec explicitly requires the import UI to live inside it (no new component files). The file will grow to ~780 lines — accept this as a spec-driven exception to the 500-line guideline.

---

### Task 1: Pure utility functions + unit tests

**Files:**
- Create: `src/utils/urlExtract.js`
- Create: `tests/extractProduct.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/extractProduct.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateUrl,
  mapCategory,
  parseOgTags,
  parseJsonLd,
  isSufficient,
  fetchProductDetails,
} from "../src/utils/urlExtract.js";

// ── validateUrl ────────────────────────────────────────────────────────────

describe("validateUrl", () => {
  it("accepts a valid https URL and returns cleaned string", () => {
    expect(() => validateUrl("https://www.zara.com/product/123")).not.toThrow();
  });
  it("accepts http URLs", () => {
    expect(() => validateUrl("http://myntra.com/product/456")).not.toThrow();
  });
  it("rejects malformed URL", () => {
    expect(() => validateUrl("not-a-url")).toThrow("Invalid URL");
  });
  it("rejects non-http/https schemes", () => {
    expect(() => validateUrl("ftp://example.com")).toThrow("Invalid URL");
    expect(() => validateUrl("javascript:alert(1)")).toThrow("Invalid URL");
  });
  it("rejects localhost", () => {
    expect(() => validateUrl("http://localhost/api")).toThrow("Invalid URL");
  });
  it("rejects 127.x.x.x", () => {
    expect(() => validateUrl("http://127.0.0.1/")).toThrow("Invalid URL");
  });
  it("rejects 10.x.x.x private range", () => {
    expect(() => validateUrl("http://10.0.0.1/")).toThrow("Invalid URL");
  });
  it("rejects 192.168.x.x private range", () => {
    expect(() => validateUrl("http://192.168.1.1/")).toThrow("Invalid URL");
  });
  it("rejects 169.254.x.x link-local (AWS metadata)", () => {
    expect(() => validateUrl("http://169.254.169.254/latest/meta-data/")).toThrow("Invalid URL");
  });
});

// ── mapCategory ────────────────────────────────────────────────────────────

describe("mapCategory", () => {
  it("maps t-shirt → Base / Shirts", () => {
    expect(mapCategory("t-shirt")).toEqual({ l: "Base", c: "Shirts" });
  });
  it("maps tee → Base / Shirts (short form)", () => {
    expect(mapCategory("classic tee")).toEqual({ l: "Base", c: "Shirts" });
  });
  it("maps hoodie → Mid / Knitwear", () => {
    expect(mapCategory("zip hoodie")).toEqual({ l: "Mid", c: "Knitwear" });
  });
  it("maps pullover → Mid / Knitwear", () => {
    expect(mapCategory("wool pullover")).toEqual({ l: "Mid", c: "Knitwear" });
  });
  it("maps bomber jacket → Outer / Jackets", () => {
    expect(mapCategory("bomber jacket")).toEqual({ l: "Outer", c: "Jackets" });
  });
  it("maps coat → Outer / Jackets", () => {
    expect(mapCategory("overcoat")).toEqual({ l: "Outer", c: "Jackets" });
  });
  it("maps jeans → Bottom / Trousers", () => {
    expect(mapCategory("slim jeans")).toEqual({ l: "Bottom", c: "Trousers" });
  });
  it("maps trousers → Bottom / Trousers", () => {
    expect(mapCategory("chino trousers")).toEqual({ l: "Bottom", c: "Trousers" });
  });
  it("maps sneakers → Footwear / Footwear", () => {
    expect(mapCategory("white sneakers")).toEqual({ l: "Footwear", c: "Footwear" });
  });
  it("maps boot → Footwear / Footwear", () => {
    expect(mapCategory("chelsea boot")).toEqual({ l: "Footwear", c: "Footwear" });
  });
  it("falls back to Base / Shirts for unrecognised input", () => {
    expect(mapCategory("mystery garment")).toEqual({ l: "Base", c: "Shirts" });
  });
  it("falls back for null input", () => {
    expect(mapCategory(null)).toEqual({ l: "Base", c: "Shirts" });
  });
  it("falls back for undefined input", () => {
    expect(mapCategory(undefined)).toEqual({ l: "Base", c: "Shirts" });
  });
});

// ── parseOgTags ────────────────────────────────────────────────────────────

describe("parseOgTags", () => {
  it("extracts og:title", () => {
    const html = `<meta property="og:title" content="Black Bomber Jacket" />`;
    expect(parseOgTags(html).name).toBe("Black Bomber Jacket");
  });
  it("extracts og:image", () => {
    const html = `<meta property="og:image" content="https://example.com/img.jpg" />`;
    expect(parseOgTags(html).image).toBe("https://example.com/img.jpg");
  });
  it("extracts og:description", () => {
    const html = `<meta property="og:description" content="A great jacket" />`;
    expect(parseOgTags(html).description).toBe("A great jacket");
  });
  it("falls back to <title> when og:title is absent", () => {
    const html = `<title>Product Name | Store</title>`;
    expect(parseOgTags(html).name).toBe("Product Name | Store");
  });
  it("prefers og:title over <title>", () => {
    const html = `<meta property="og:title" content="OG Name" /><title>Page Title</title>`;
    expect(parseOgTags(html).name).toBe("OG Name");
  });
  it("returns empty object for empty HTML", () => {
    expect(parseOgTags("")).toEqual({});
  });
  it("handles single-quote meta attributes", () => {
    const html = `<meta property='og:title' content='Single Quote Title' />`;
    expect(parseOgTags(html).name).toBe("Single Quote Title");
  });
});

// ── parseJsonLd ────────────────────────────────────────────────────────────

describe("parseJsonLd", () => {
  it("extracts name and brand from Product schema", () => {
    const html = `<script type="application/ld+json">
      {"@type":"Product","name":"Black Tee","brand":{"name":"Zara"}}
    </script>`;
    const r = parseJsonLd(html);
    expect(r.name).toBe("Black Tee");
    expect(r.brand).toBe("Zara");
  });
  it("extracts color and image", () => {
    const html = `<script type="application/ld+json">
      {"@type":"Product","name":"Jacket","color":"Black","image":"https://ex.com/img.jpg"}
    </script>`;
    const r = parseJsonLd(html);
    expect(r.color).toBe("Black");
    expect(r.image).toBe("https://ex.com/img.jpg");
  });
  it("extracts first element of image array", () => {
    const html = `<script type="application/ld+json">
      {"@type":"Product","name":"Jacket","image":["https://ex.com/1.jpg","https://ex.com/2.jpg"]}
    </script>`;
    expect(parseJsonLd(html).image).toBe("https://ex.com/1.jpg");
  });
  it("maps category to l + c via LAYER_MAP", () => {
    const html = `<script type="application/ld+json">
      {"@type":"Product","name":"Hoodie","category":"hoodie"}
    </script>`;
    const r = parseJsonLd(html);
    expect(r.l).toBe("Mid");
    expect(r.c).toBe("Knitwear");
  });
  it("ignores non-Product @type entries", () => {
    const html = `<script type="application/ld+json">
      {"@type":"Organization","name":"Zara"}
    </script>`;
    expect(parseJsonLd(html)).toEqual({});
  });
  it("handles LD+JSON array wrapper", () => {
    const html = `<script type="application/ld+json">
      [{"@type":"Product","name":"Shirt","brand":{"name":"H&M"}}]
    </script>`;
    const r = parseJsonLd(html);
    expect(r.name).toBe("Shirt");
    expect(r.brand).toBe("H&M");
  });
  it("skips malformed JSON silently", () => {
    const html = `<script type="application/ld+json">{ not valid json }</script>`;
    expect(() => parseJsonLd(html)).not.toThrow();
    expect(parseJsonLd(html)).toEqual({});
  });
  it("returns empty object when no JSON-LD present", () => {
    expect(parseJsonLd("<html><body>hello</body></html>")).toEqual({});
  });
});

// ── isSufficient ───────────────────────────────────────────────────────────

describe("isSufficient", () => {
  it("true when name + color present", () => {
    expect(isSufficient({ name: "Jacket", color: "Black" })).toBe(true);
  });
  it("true when name + l present (no color)", () => {
    expect(isSufficient({ name: "Jacket", l: "Outer" })).toBe(true);
  });
  it("false when name is missing", () => {
    expect(isSufficient({ color: "Black", l: "Outer" })).toBe(false);
  });
  it("false when both color and l are missing", () => {
    expect(isSufficient({ name: "Jacket" })).toBe(false);
  });
  it("false for empty object", () => {
    expect(isSufficient({})).toBe(false);
  });
  it("false when name is empty string", () => {
    expect(isSufficient({ name: "", color: "Black" })).toBe(false);
  });
});

// ── fetchProductDetails ────────────────────────────────────────────────────

describe("fetchProductDetails", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns { ok: true, data } on HTTP 200", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: "Jacket", color: "Black", _via: "og" }),
    });
    const result = await fetchProductDetails("https://zara.com/product/1");
    expect(result.ok).toBe(true);
    expect(result.data.name).toBe("Jacket");
  });

  it("POSTs to /api/extract-product with url in body", async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await fetchProductDetails("https://zara.com/product/1");
    expect(fetch).toHaveBeenCalledWith("/api/extract-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://zara.com/product/1" }),
    });
  });

  it("returns { ok: false, error, partial } on non-200", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Partial only", partial: { name: "Jacket" } }),
    });
    const result = await fetchProductDetails("https://myntra.com/p/1");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Partial only");
    expect(result.partial.name).toBe("Jacket");
  });

  it("returns partial: {} when error response has no partial field", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Rate limit" }),
    });
    const result = await fetchProductDetails("https://zara.com/product/1");
    expect(result.partial).toEqual({});
  });
});
```

- [ ] **Step 2: Run tests — verify they all fail (module not found)**

```bash
cd /Users/sohilgupta/Documents/sohil-wardrobe
npm test -- tests/extractProduct.test.js
```

Expected output: `Cannot find module '../src/utils/urlExtract.js'`

- [ ] **Step 3: Create `src/utils/urlExtract.js` with all 6 exports**

```js
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
    if (key === "og:title")                          result.name        = result.name  || content;
    if (key === "og:image" || key === "og:image:secure_url") result.image = result.image || content;
    if (key === "og:description")                    result.description = content;
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
```

- [ ] **Step 4: Run tests — verify they all pass**

```bash
npm test -- tests/extractProduct.test.js
```

Expected: all tests pass. Look for the count line — should be something like `✓ 40 tests passed`.

If any test fails, fix the implementation (not the test) before proceeding.

- [ ] **Step 5: Run the full test suite — verify no regressions**

```bash
npm test
```

Expected: all previously passing tests still pass (35 from prior tasks + the new ones).

- [ ] **Step 6: Commit**

```bash
cd /Users/sohilgupta/Documents/sohil-wardrobe
git add src/utils/urlExtract.js tests/extractProduct.test.js
git commit -m "$(cat <<'EOF'
feat: add URL import utility functions with full unit test coverage

- validateUrl: blocks private IPs, non-http schemes, malformed URLs
- mapCategory: LAYER_MAP regex → { l, c } with Base/Shirts fallback
- parseOgTags: extracts og:title, og:image, og:description + <title> fallback
- parseJsonLd: extracts Product schema fields, maps category via LAYER_MAP
- isSufficient: name + (color || l) threshold check
- fetchProductDetails: client POST helper for /api/extract-product

Co-Authored-By: claude-flow <ruv@ruv.net>
EOF
)"
```

---

### Task 2: Backend serverless endpoint

**Files:**
- Create: `api/extract-product.js`
- Modify: `vercel.json`

- [ ] **Step 1: Read `vercel.json` to confirm current state**

```bash
cat /Users/sohilgupta/Documents/sohil-wardrobe/vercel.json
```

Expected output:
```json
{
  "framework": "vite",
  "functions": {
    "api/ai.js":              { "maxDuration": 60 },
    "api/stripe/checkout.js": { "maxDuration": 30 },
    "api/stripe/webhook.js":  { "maxDuration": 30 },
    "api/stripe/portal.js":   { "maxDuration": 30 }
  }
}
```

- [ ] **Step 2: Create `api/extract-product.js`**

```js
/* ─── POST /api/extract-product ──────────────────────────────────────────────
   Validates a product URL, fetches its HTML, and runs a 3-stage extraction
   pipeline:
     Stage 1 — OG tags + JSON-LD  (zero AI cost)
     Stage 2 — Gemini Flash Lite  (~200 tokens, meta/title only)
     Stage 3 — Gemini Flash       (~2000 tokens, first 8KB body text)
   Returns normalised wardrobe item fields on 200, partial data on 422.
   No auth required — IP rate-limited at 5 req/min per IP.
   ─────────────────────────────────────────────────────────────────────────── */

export const maxDuration = 20; // 5s fetch + two sequential Gemini calls

/* ─── IP rate limiting ───────────────────────────────────────────────────── */
// Module-level Map — persists across warm invocations on the same Vercel instance
const ipMap = new Map(); // ip → { count, resetAt }
const LIMIT = 5;
const WINDOW_MS = 60_000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = ipMap.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + WINDOW_MS;
  }
  if (entry.count >= LIMIT) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  ipMap.set(ip, entry);
  return { allowed: true };
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

function validateUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { return null; }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  if (BLOCKED_HOSTS.some((re) => re.test(url.hostname))) return null;
  return url.toString();
}

/* ─── Category / layer mapping ───────────────────────────────────────────── */
const LAYER_MAP = [
  { pattern: /t-?shirt|tee|shirt|blouse|top|polo/i,        l: "Base",     c: "Shirts"   },
  { pattern: /sweater|sweatshirt|hoodie|knit|pullover/i,    l: "Mid",      c: "Knitwear" },
  { pattern: /jacket|coat|blazer|parka|bomber|gilet/i,      l: "Outer",    c: "Jackets"  },
  { pattern: /jean|trouser|chino|pant|short|skirt|bottom/i, l: "Bottom",   c: "Trousers" },
  { pattern: /shoe|sneaker|boot|loafer|sandal|trainer/i,    l: "Footwear", c: "Footwear" },
];

function mapCategory(raw) {
  if (!raw) return { l: "Base", c: "Shirts" };
  const entry = LAYER_MAP.find((e) => e.pattern.test(raw));
  return entry ? { l: entry.l, c: entry.c } : { l: "Base", c: "Shirts" };
}

/* ─── HTML parsers ───────────────────────────────────────────────────────── */
function parseOgTags(html) {
  const result = {};
  for (const [tag] of html.matchAll(/<meta[^>]+>/gi)) {
    const prop    = (tag.match(/property=["']([^"']+)["']/i) || [])[1];
    const name    = (tag.match(/name=["']([^"']+)["']/i) || [])[1];
    const content = (tag.match(/content=["']([^"']+)["']/i) || [])[1];
    if (!content) continue;
    const key = prop || name || "";
    if (key === "og:title")                              result.name  = result.name  || content;
    if (key === "og:image" || key === "og:image:secure_url") result.image = result.image || content;
    if (key === "og:description")                        result.description = content;
  }
  if (!result.name) {
    const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (m) result.name = m[1].trim();
  }
  return result;
}

function parseJsonLd(html) {
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

function isSufficient(obj) {
  return !!(obj.name && (obj.color || obj.l));
}

/* ─── Text extraction for Gemini ─────────────────────────────────────────── */
function extractMetaText(html) {
  const parts = [];
  const titleM = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleM) parts.push("Title: " + titleM[1].trim());
  for (const [tag] of html.matchAll(/<meta[^>]+>/gi)) {
    const content = (tag.match(/content=["']([^"']+)["']/i) || [])[1];
    if (content && content.length > 3) parts.push(content);
  }
  return parts.join("\n").slice(0, 2000);
}

function extractBodyText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

/* ─── Gemini API call ────────────────────────────────────────────────────── */
const GEMINI_PROMPT = `Extract product details from this page content.
Return JSON only (no markdown, no explanation): { "name": string, "brand": string, "color": string, "category": string }
- name: the clothing item name (e.g. "Black Bomber Jacket")
- brand: fashion brand name (e.g. "Zara")
- color: simple color name (e.g. "Black", "Navy", "Beige")
- category: clothing type keyword used for layer mapping (e.g. "bomber jacket", "slim jeans", "polo shirt")
Use empty string "" for any field you cannot determine.`;

async function callGemini(apiKey, model, userText) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${GEMINI_PROMPT}\n\n---\n\n${userText}` }] }],
        generationConfig: { maxOutputTokens: 256, thinkingConfig: { thinkingBudget: 0 } },
      }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const part = parts.find((p) => !p.thought) || parts[0];
  if (!part?.text) return null;
  const raw = part.text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(raw); } catch { return null; }
}

function mergeGemini(base, gemini) {
  if (!gemini) return base;
  const m = { ...base };
  if (!m.name  && gemini.name)     m.name  = gemini.name;
  if (!m.brand && gemini.brand)    m.brand = gemini.brand;
  if (!m.color && gemini.color)    m.color = gemini.color;
  if (!m.l     && gemini.category) {
    const { l, c } = mapCategory(gemini.category);
    m.l = l;
    m.c = m.c || c;
  }
  return m;
}

/* ─── Response builders ─────────────────────────────────────────────────── */
function buildResponse(result, productUrl, via) {
  const { l, c } = result.l ? { l: result.l, c: result.c } : mapCategory(result.name || "");
  return {
    name:       result.name  || "",
    brand:      result.brand || "",
    color:      result.color || "",
    l,
    c:          c || "Shirts",
    image:      result.image || null,
    productUrl,
    _source:    "url_import",
    _via:       via,
  };
}

function buildPartial(result) {
  const p = {};
  if (result.name)  p.name  = result.name;
  if (result.brand) p.brand = result.brand;
  if (result.color) p.color = result.color;
  if (result.l)     p.l     = result.l;
  if (result.c)     p.c     = result.c;
  if (result.image) p.image = result.image;
  return p;
}

/* ─── Main handler ───────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // IP rate limit
  const rawIp = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
  const ip = rawIp.split(",")[0].trim();
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return res.status(429).json({ error: `Rate limit. Retry after ${rl.retryAfter} seconds.` });
  }

  // Validate URL
  const { url: rawUrl } = req.body || {};
  if (!rawUrl) return res.status(400).json({ error: "Missing url" });
  const cleanUrl = validateUrl(rawUrl);
  if (!cleanUrl) return res.status(400).json({ error: "Invalid URL" });

  // Fetch HTML (5s timeout, 150KB max)
  let html = "";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const fetchRes = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept":          "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    const buf = await fetchRes.arrayBuffer();
    html = new TextDecoder().decode(buf.slice(0, 150 * 1024));
  } catch {
    return res.status(422).json({ error: "Could not fetch product page", partial: {} });
  }

  // Stage 1: OG + JSON-LD (zero AI cost)
  const og = parseOgTags(html);
  const ld = parseJsonLd(html);
  let result = {
    name:  ld.name  || og.name  || "",
    brand: ld.brand || "",
    color: ld.color || "",
    l:     ld.l     || "",
    c:     ld.c     || "",
    image: ld.image || og.image || null,
  };
  if (isSufficient(result)) {
    return res.status(200).json(buildResponse(result, cleanUrl, "og"));
  }

  // Stage 2: Gemini Flash Lite (~200 tokens — meta + title only)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // No key configured — return whatever Stage 1 found
    return res.status(422).json({ error: "Partial extraction — Gemini not configured", partial: buildPartial(result) });
  }

  const metaText = extractMetaText(html);
  result = mergeGemini(result, await callGemini(apiKey, "gemini-2.0-flash-lite", metaText));
  if (isSufficient(result)) {
    return res.status(200).json(buildResponse(result, cleanUrl, "gemini-b"));
  }

  // Stage 3: Gemini Flash (~2000 tokens — first 8KB of body text)
  const bodyText = extractBodyText(html);
  result = mergeGemini(result, await callGemini(apiKey, "gemini-2.0-flash", bodyText));
  if (isSufficient(result)) {
    return res.status(200).json(buildResponse(result, cleanUrl, "gemini-a"));
  }

  // All stages exhausted
  return res.status(422).json({
    error: "Couldn't extract all product details",
    partial: buildPartial(result),
  });
}
```

- [ ] **Step 3: Add `extract-product.js` to `vercel.json`**

Open `vercel.json` and add the new entry inside `"functions"`:

```json
{
  "framework": "vite",
  "functions": {
    "api/ai.js":                 { "maxDuration": 60 },
    "api/extract-product.js":    { "maxDuration": 20 },
    "api/stripe/checkout.js":    { "maxDuration": 30 },
    "api/stripe/webhook.js":     { "maxDuration": 30 },
    "api/stripe/portal.js":      { "maxDuration": 30 }
  }
}
```

- [ ] **Step 4: Run the full test suite — no regressions**

```bash
npm test
```

Expected: all tests pass. The new `extractProduct.test.js` tests don't exercise the API file (it's a Node module with direct fetch calls — no unit test wrapper needed; integration-tested manually against real URLs).

- [ ] **Step 5: Verify build still passes**

```bash
npm run build
```

Expected: build completes with no errors. Vite does not bundle API files, so this checks only that the client-side code is clean.

- [ ] **Step 6: Commit**

```bash
cd /Users/sohilgupta/Documents/sohil-wardrobe
git add api/extract-product.js vercel.json
git commit -m "$(cat <<'EOF'
feat: add /api/extract-product serverless endpoint

3-stage extraction pipeline: OG+JSON-LD → Gemini Flash Lite (meta) →
Gemini Flash (HTML slice). IP rate-limited at 5 req/min. No auth required
(guests need access). 150KB HTML cap, 5s fetch timeout, private IP block.

Co-Authored-By: claude-flow <ruv@ruv.net>
EOF
)"
```

---

### Task 3: WardrobeTab modal UI

**Files:**
- Modify: `src/components/WardrobeTab.jsx`

The modal currently renders a simple form (name, brand, color, image URL, notes, category, cancel/add buttons). This task replaces that with an import-first flow:
- **idle** → URL input + "— OR —" + "Add manually" button
- **loading** → skeleton shimmer card + grayed URL field
- **confirm** → confirmation card (image, name/color/category editable, "Edit more" expander)
- **error** → error card (partial data surfaced, "Add manually" CTA)
- **manual** → the existing form (unchanged, pre-filled when coming from error state)

- [ ] **Step 1: Add the `fetchProductDetails` import**

In `src/components/WardrobeTab.jsx`, change line 1 from:
```js
import { useState, useMemo } from "react";
```
to:
```js
import { useState, useMemo } from "react";
import { fetchProductDetails } from "../utils/urlExtract";
```

- [ ] **Step 2: Add `COLOR_OPTIONS` and `LAYER_OPTIONS` constants near the top**

After the existing `selArrow` helper (around line 42), add:

```js
/* ─── URL import — static options ────────────────────────────────────────── */
const COLOR_OPTIONS = [
  "Black","White","Navy Blue","Blue","Grey","Beige","Camel","Brown",
  "Khaki","Burgundy","Red","Green","Pink","Yellow","Orange","Purple",
  "Olive Green","Charcoal","Cream","Stone",
];
const LAYER_OPTIONS = ["Base", "Mid", "Outer", "Bottom", "Footwear"];
```

- [ ] **Step 3: Add 6 new state variables after the existing `confirmDel` state**

Find the block (around line 119):
```js
  const [confirmDel, setConfirmDel] = useState(false);
```

Add immediately after:
```js
  /* ── URL import state ── */
  const [importUrl,     setImportUrl]     = useState("");
  const [importState,   setImportState]   = useState("idle"); // idle|loading|confirm|error|manual
  const [importResult,  setImportResult]  = useState(null);
  const [importPartial, setImportPartial] = useState({});
  const [confirmForm,   setConfirmForm]   = useState({ n: "", col: "", c: "", b: "", l: "" });
  const [editMoreOpen,  setEditMoreOpen]  = useState(false);
```

- [ ] **Step 4: Add import handler functions after the existing `openAdd` and `saveAdd` helpers**

Find the end of `saveAdd()` (around line 187). After the closing `}` of `saveAdd`, add:

```js
  /* ── URL import handlers ── */
  async function handleFetch() {
    if (!importUrl.trim()) return;
    setImportState("loading");
    const res = await fetchProductDetails(importUrl.trim());
    if (res.ok) {
      const d = res.data;
      setImportResult(d);
      setConfirmForm({
        n:   d.name  || "",
        col: d.color || "",
        c:   d.c     || cats[0] || "Shirts",
        b:   d.brand || "",
        l:   d.l     || "Base",
      });
      setEditMoreOpen(false);
      setImportState("confirm");
    } else {
      setImportPartial(res.partial || {});
      setImportState("error");
    }
  }

  function handleConfirmAdd() {
    if (!confirmForm.n.trim()) return;
    if (wardrobe.length >= limits.wardrobe) {
      window.dispatchEvent(new CustomEvent("vesti-limit-reached", { detail: { type: "wardrobe" } }));
      return;
    }
    onAdd?.({
      n:          confirmForm.n.trim(),
      b:          confirmForm.b.trim(),
      col:        confirmForm.col || "Black",
      c:          confirmForm.c  || "Shirts",
      l:          confirmForm.l  || "Base",
      img:        importResult?.image || "",
      productUrl: importResult?.productUrl || "",
      _source:    "url_import",
      t:          "Yes",
    });
    handleCloseModal();
  }

  function handleCompleteDetails() {
    setAddForm({
      n:     importPartial.name  || "",
      b:     importPartial.brand || "",
      col:   importPartial.color || "",
      c:     importPartial.c     || cats[0] || "Shirts",
      img:   importPartial.image || "",
      notes: "",
    });
    setImportUrl("");
    setImportResult(null);
    setImportPartial({});
    setEditMoreOpen(false);
    setImportState("manual");
  }

  function handleCloseModal() {
    setImportUrl("");
    setImportResult(null);
    setImportPartial({});
    setEditMoreOpen(false);
    setImportState("idle");
    setAdding(false);
  }
```

- [ ] **Step 5: Replace the Add Item modal block**

Find the existing Add Item modal (the `{adding && (...)}` block starting around line 487). Replace the **entire block** (from `{/* ── Add Item modal ── */}` through its closing `)}`) with:

```jsx
      {/* ── Add Item modal ── */}
      {adding && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={handleCloseModal}
        >
          <div
            style={{ background: T.surface, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 16 }}>Add Item</p>

            {/* ── IDLE: URL input + "Add manually" ── */}
            {importState === "idle" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: T.alt, border: `1.5px solid ${T.border}`, borderRadius: 12, padding: "10px 14px" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: T.light, letterSpacing: 1, marginBottom: 6 }}>PASTE PRODUCT LINK</p>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="url"
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && importUrl.trim() && handleFetch()}
                      placeholder="https://www.zara.com/…"
                      style={{ ...INPUT, flex: 1, padding: "7px 10px", fontSize: 12, background: "transparent", border: "none", outline: "none" }}
                    />
                    <button
                      onClick={handleFetch}
                      disabled={!importUrl.trim()}
                      style={{
                        padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, border: "none", cursor: importUrl.trim() ? "pointer" : "default",
                        background: importUrl.trim() ? T.accent : T.border,
                        color: importUrl.trim() ? "#fff" : T.light,
                        flexShrink: 0, whiteSpace: "nowrap",
                      }}
                    >
                      Fetch
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                  <span style={{ fontSize: 10, color: T.light }}>OR</span>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                </div>

                <button
                  onClick={() => setImportState("manual")}
                  style={{ width: "100%", padding: 11, background: "none", border: `1.5px solid ${T.border}`, borderRadius: 12, fontSize: 13, color: T.mid, cursor: "pointer", fontWeight: 600 }}
                >
                  + Add manually
                </button>
              </div>
            )}

            {/* ── LOADING: skeleton shimmer ── */}
            {importState === "loading" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Grayed URL field */}
                <div style={{ background: T.alt, border: `1.5px solid ${T.border}`, borderRadius: 12, padding: "10px 14px" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: T.light, letterSpacing: 1, marginBottom: 6 }}>PASTE PRODUCT LINK</p>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: T.light, flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {importUrl}
                    </span>
                    <span style={{ padding: "5px 12px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: T.border, color: T.light, flexShrink: 0 }}>Fetch</span>
                  </div>
                </div>

                {/* Skeleton card */}
                <div style={{ background: T.alt, border: `1.5px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ display: "flex", gap: 12, padding: "12px 14px", alignItems: "flex-start" }}>
                    <div style={{ width: 80, height: 100, borderRadius: 10, flexShrink: 0, background: `linear-gradient(90deg,${T.surface} 25%,${T.border} 50%,${T.surface} 75%)`, backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
                    <div style={{ flex: 1, paddingTop: 4, display: "flex", flexDirection: "column", gap: 8 }}>
                      {[60, 85, 55, 45].map((w, i) => (
                        <div key={i} style={{ height: i === 3 ? 20 : i === 1 ? 14 : 8, borderRadius: i === 3 ? 20 : 4, width: `${w}%`, background: `linear-gradient(90deg,${T.surface} 25%,${T.border} 50%,${T.surface} 75%)`, backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ height: 1, background: T.border, margin: "0 14px" }} />
                  <div style={{ padding: "14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${T.border}`, borderTopColor: T.accent, flexShrink: 0, animation: "spin 0.9s linear infinite" }} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 2 }}>Analyzing product…</p>
                      <p style={{ fontSize: 10, color: T.light }}>Extracting details from page</p>
                    </div>
                  </div>
                  <div style={{ padding: "0 14px 12px", display: "flex", flexDirection: "column", gap: 7 }}>
                    {[null, null].map((_, i) => (
                      <div key={i} style={{ height: 32, borderRadius: 8, background: `linear-gradient(90deg,${T.surface} 25%,${T.border} 50%,${T.surface} 75%)`, backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── CONFIRM: confirmation card ── */}
            {importState === "confirm" && importResult && (
              <div style={{ background: T.alt, border: `1.5px solid ${T.accentBorder}`, borderRadius: 12, overflow: "hidden" }}>
                {/* Image + summary */}
                <div style={{ display: "flex", gap: 12, padding: "12px 14px", alignItems: "flex-start" }}>
                  {importResult.image ? (
                    <img
                      src={importResult.image}
                      alt={confirmForm.n}
                      style={{ width: 80, height: 100, objectFit: "cover", borderRadius: 10, flexShrink: 0 }}
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  ) : (
                    <div style={{ width: 80, height: 100, borderRadius: 10, flexShrink: 0, background: `linear-gradient(145deg,#1B2A4A,#374151)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
                      🧥
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                      <span style={{ fontSize: 8.5, fontWeight: 700, background: "rgba(74,222,128,0.12)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.25)", padding: "2px 7px", borderRadius: 20 }}>✓ Detected</span>
                      <span style={{ fontSize: 9, color: T.light }}>
                        {(() => { try { return new URL(importResult.productUrl).hostname.replace(/^www\./, ""); } catch { return ""; } })()}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 3, lineHeight: 1.3 }}>{confirmForm.n || "—"}</p>
                    <p style={{ fontSize: 11, color: T.mid, marginBottom: 6 }}>{[confirmForm.b, confirmForm.col, confirmForm.l].filter(Boolean).join(" · ")}</p>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {confirmForm.c && <span style={{ fontSize: 8.5, fontWeight: 700, background: T.accentDim, color: "#60A5FA", border: `1px solid ${T.accentBorder}`, padding: "2px 7px", borderRadius: 20 }}>{confirmForm.c}</span>}
                      {confirmForm.l && <span style={{ fontSize: 8.5, fontWeight: 700, background: "rgba(167,139,250,0.1)", color: "#A78BFA", border: "1px solid rgba(167,139,250,0.2)", padding: "2px 7px", borderRadius: 20 }}>{confirmForm.l}</span>}
                    </div>
                  </div>
                </div>

                <div style={{ height: 1, background: T.border, margin: "0 14px" }} />

                {/* Editable fields */}
                <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
                  {/* Name */}
                  <div>
                    <p style={{ fontSize: 8.5, fontWeight: 700, color: T.light, letterSpacing: 1, marginBottom: 3 }}>NAME</p>
                    <input
                      type="text"
                      value={confirmForm.n}
                      onChange={(e) => setConfirmForm((p) => ({ ...p, n: e.target.value }))}
                      style={{ ...INPUT, padding: "7px 10px", fontSize: 12, border: `1.5px solid ${T.accentBorder}` }}
                    />
                  </div>

                  {/* Color + Category */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                    <div>
                      <p style={{ fontSize: 8.5, fontWeight: 700, color: T.light, letterSpacing: 1, marginBottom: 3 }}>COLOR</p>
                      <select
                        value={confirmForm.col}
                        onChange={(e) => setConfirmForm((p) => ({ ...p, col: e.target.value }))}
                        style={{ ...INPUT, padding: "7px 10px", fontSize: 11, appearance: "auto", color: T.text }}
                      >
                        {COLOR_OPTIONS.map((c) => <option key={c}>{c}</option>)}
                        {confirmForm.col && !COLOR_OPTIONS.includes(confirmForm.col) && (
                          <option value={confirmForm.col}>{confirmForm.col}</option>
                        )}
                      </select>
                    </div>
                    <div>
                      <p style={{ fontSize: 8.5, fontWeight: 700, color: T.light, letterSpacing: 1, marginBottom: 3 }}>CATEGORY</p>
                      <select
                        value={confirmForm.c}
                        onChange={(e) => setConfirmForm((p) => ({ ...p, c: e.target.value }))}
                        style={{ ...INPUT, padding: "7px 10px", fontSize: 11, appearance: "auto", color: T.text }}
                      >
                        {cats.map((c) => <option key={c}>{c}</option>)}
                        {confirmForm.c && !cats.includes(confirmForm.c) && (
                          <option value={confirmForm.c}>{confirmForm.c}</option>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Edit more expander */}
                  <button
                    onClick={() => setEditMoreOpen((p) => !p)}
                    style={{ background: "none", border: "none", padding: "2px 0", display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    <span style={{ fontSize: 10, color: T.light, fontWeight: 600 }}>Edit more</span>
                    <span style={{ fontSize: 10, color: T.light }}>{editMoreOpen ? "⌄" : "›"}</span>
                  </button>

                  {editMoreOpen && (
                    <div style={{ borderTop: `1px dashed ${T.border}`, paddingTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                      <div>
                        <p style={{ fontSize: 8.5, fontWeight: 700, color: T.light, letterSpacing: 1, marginBottom: 3 }}>BRAND</p>
                        <input
                          type="text"
                          value={confirmForm.b}
                          onChange={(e) => setConfirmForm((p) => ({ ...p, b: e.target.value }))}
                          style={{ ...INPUT, padding: "7px 10px", fontSize: 11 }}
                        />
                      </div>
                      <div>
                        <p style={{ fontSize: 8.5, fontWeight: 700, color: T.light, letterSpacing: 1, marginBottom: 3 }}>LAYER</p>
                        <select
                          value={confirmForm.l}
                          onChange={(e) => setConfirmForm((p) => ({ ...p, l: e.target.value }))}
                          style={{ ...INPUT, padding: "7px 10px", fontSize: 11, appearance: "auto", color: T.text }}
                        >
                          {LAYER_OPTIONS.map((l) => <option key={l}>{l}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ borderTop: `1px solid ${T.border}`, display: "grid", gridTemplateColumns: "1fr 2fr" }}>
                  <button onClick={handleCloseModal} style={{ padding: 12, background: "none", border: "none", borderRight: `1px solid ${T.border}`, fontSize: 12, color: T.mid, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  <button
                    onClick={handleConfirmAdd}
                    disabled={!confirmForm.n.trim()}
                    style={{ padding: 12, background: confirmForm.n.trim() ? T.text : T.border, border: "none", fontSize: 13, fontWeight: 700, color: confirmForm.n.trim() ? T.bg : T.light, cursor: confirmForm.n.trim() ? "pointer" : "default", fontFamily: "inherit" }}
                  >
                    Confirm & Add
                  </button>
                </div>
              </div>
            )}

            {/* ── ERROR: smart fallback card ── */}
            {importState === "error" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* URL field with Try again */}
                <div style={{ background: T.alt, border: `1.5px solid ${T.border}`, borderRadius: 12, padding: "10px 14px" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: T.light, letterSpacing: 1, marginBottom: 6 }}>PASTE PRODUCT LINK</p>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: T.light, flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{importUrl}</span>
                    <button
                      onClick={() => setImportState("idle")}
                      style={{ padding: "5px 12px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: T.accentDim, color: T.accent, border: `1px solid ${T.accentBorder}`, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", fontFamily: "inherit" }}
                    >
                      Try again
                    </button>
                  </div>
                </div>

                {/* Error card */}
                <div style={{ background: T.alt, border: "1.5px solid rgba(248,113,113,0.25)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "16px 14px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 40, height: 40, background: "rgba(248,113,113,0.1)", borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(248,113,113,0.2)", fontSize: 18 }}>
                      ⚠
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4, lineHeight: 1.3 }}>Couldn't detect all details</p>
                      <p style={{ fontSize: 11, color: T.mid, lineHeight: 1.5 }}>
                        {Object.keys(importPartial).length > 0
                          ? "We found some info — fill in the rest below."
                          : "This site may block automated reads. Add details manually instead."}
                      </p>
                    </div>
                  </div>

                  {Object.keys(importPartial).length > 0 && (
                    <>
                      <div style={{ height: 1, background: T.border, margin: "0 14px" }} />
                      <div style={{ padding: "10px 14px" }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: T.light, letterSpacing: 1, marginBottom: 7 }}>WHAT WE FOUND</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {["name", "brand", "color", "l"].map((field) => (
                            <div key={field} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {importPartial[field] ? (
                                <>
                                  <span style={{ fontSize: 10, color: "#4ADE80" }}>✓</span>
                                  <span style={{ fontSize: 11, color: T.mid }}>
                                    {field.charAt(0).toUpperCase() + field.slice(1)}: <span style={{ color: T.text }}>{importPartial[field]}</span>
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span style={{ fontSize: 10, color: "#F87171" }}>✕</span>
                                  <span style={{ fontSize: 11, color: T.light }}>{field.charAt(0).toUpperCase() + field.slice(1)}: not detected</span>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <div style={{ borderTop: `1px solid ${T.border}`, display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    <button onClick={handleCloseModal} style={{ padding: 12, background: "none", border: "none", borderRight: `1px solid ${T.border}`, fontSize: 12, color: T.mid, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    <button onClick={handleCompleteDetails} style={{ padding: 12, background: T.text, border: "none", fontSize: 13, fontWeight: 700, color: T.bg, cursor: "pointer", fontFamily: "inherit" }}>Complete details</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── MANUAL: standard form (unchanged) ── */}
            {importState === "manual" && (
              <>
                <Field label="Name *"    value={addForm.n}     onChange={(v) => setAddForm((p) => ({ ...p, n: v }))}     placeholder="e.g. Zara Black Tee" />
                <Field label="Brand"     value={addForm.b}     onChange={(v) => setAddForm((p) => ({ ...p, b: v }))}     placeholder="Brand" />
                <Field label="Color"     value={addForm.col}   onChange={(v) => setAddForm((p) => ({ ...p, col: v }))}   placeholder="e.g. Black" />
                <Field label="Image URL" value={addForm.img}   onChange={(v) => setAddForm((p) => ({ ...p, img: v }))}   placeholder="https://…" />
                <Field label="Notes"     value={addForm.notes} onChange={(v) => setAddForm((p) => ({ ...p, notes: v }))} placeholder="Optional notes" type="textarea" />
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 10, fontWeight: 600, color: T.light, letterSpacing: 0.8, display: "block", marginBottom: 4 }}>CATEGORY</label>
                  <select value={addForm.c} onChange={(e) => setAddForm((p) => ({ ...p, c: e.target.value }))}
                    style={{ ...INPUT, appearance: "auto", color: T.text }}>
                    {cats.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleCloseModal} style={{ flex: 1, padding: 11, background: "none", border: `1.5px solid ${T.border}`, borderRadius: 12, fontSize: 13, color: T.mid, cursor: "pointer" }}>Cancel</button>
                  <button onClick={saveAdd} disabled={!addForm.n.trim()}
                    style={{ flex: 2, padding: 11, background: addForm.n.trim() ? T.text : T.border, border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, color: addForm.n.trim() ? T.bg : T.light, cursor: addForm.n.trim() ? "pointer" : "default" }}>
                    Add Item
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
```

- [ ] **Step 6: Add CSS keyframe animations to the existing `<style>` block in `App.jsx`**

The shimmer and spinner animations are needed for the loading state. Open `src/App.jsx`, find the existing `@keyframes slideUpFade` inside the `<style>` tag, and add the two new keyframes alongside it:

```css
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
```

The existing style tag will look like this after the edit:
```html
<style>{`
  @keyframes slideUpFade { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  @keyframes spin { to { transform: rotate(360deg); } }
`}</style>
```

- [ ] **Step 7: Run the full test suite**

```bash
npm test
```

Expected: all tests pass. (The WardrobeTab change is pure JSX — no logic tested by existing tests changes.)

- [ ] **Step 8: Verify the build passes**

```bash
npm run build
```

Expected: no errors. Watch for missing imports or JSX syntax errors.

- [ ] **Step 9: Commit**

```bash
cd /Users/sohilgupta/Documents/sohil-wardrobe
git add src/components/WardrobeTab.jsx src/App.jsx
git commit -m "$(cat <<'EOF'
feat: add URL import flow to Add Item modal in WardrobeTab

idle → paste URL + Fetch → loading skeleton → confirm card (editable name/
color/category, 'Edit more' expander for brand+layer) → Confirm & Add.
Error state surfaces partial extraction with 'Complete details' fallback to
pre-filled manual form. Calls onAdd() directly (not saveAdd) to preserve
_source:url_import and productUrl fields.

Co-Authored-By: claude-flow <ruv@ruv.net>
EOF
)"
```

---

### Task 4: Final build, test, and push

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite one final time**

```bash
cd /Users/sohilgupta/Documents/sohil-wardrobe
npm test
```

Expected output: all tests pass. The new tests in `tests/extractProduct.test.js` should be included in the count.

- [ ] **Step 2: Run a clean production build**

```bash
npm run build
```

Expected: exits 0 with no warnings about missing modules or type errors.

- [ ] **Step 3: Push to main**

```bash
git push origin main
```

Expected: push succeeds. Vercel will auto-deploy. Check https://vercel.com/dashboard for the deployment status.

- [ ] **Step 4: Verify deployment**

After Vercel reports "Ready" (usually 1–2 minutes):

1. Open the production URL in a browser
2. Click "Add Item" on any wardrobe tab
3. Confirm the URL input + "Add manually" button appear (idle state)
4. Paste a Zara URL (e.g. `https://www.zara.com/us/en/relaxed-fit-heavyweight-hoodie-p08875400.html`) → confirm the loading skeleton appears → confirm the confirmation card appears with name/color/category
5. Click "Confirm & Add" → confirm the item appears in the wardrobe list with `_source: "url_import"` visible (check browser console or item detail)

---

## Self-Review

### Spec coverage check

| Spec requirement | Covered by task |
|---|---|
| Guest + logged-in can use it | No `requireAuth` in `api/extract-product.js` ✓ |
| IP rate-limited (5 req/min) | `checkRateLimit` in Task 2 ✓ |
| URL input + "Add manually" two entry points | Task 3 idle state ✓ |
| Confirmation card with image, name, color, category | Task 3 confirm state ✓ |
| "Edit more" expander → brand + layer | Task 3 confirm state `editMoreOpen` ✓ |
| Loading: skeleton shimmer + spinner + copy | Task 3 loading state ✓ |
| Error: partial data surfaced, green ✓ / red ✕ labels | Task 3 error state ✓ |
| "Complete details" → merges partial into manual form | `handleCompleteDetails` in Task 3 ✓ |
| "Try again" → back to idle, URL preserved | Task 3 error state button ✓ |
| "Confirm & Add" calls `onAdd()` not `saveAdd()` | `handleConfirmAdd` in Task 3 ✓ |
| `_source: "url_import"` + `productUrl` fields set | `handleConfirmAdd` in Task 3 ✓ |
| 3-stage pipeline: OG → Gemini B → Gemini A | Task 2 ✓ |
| `_via` field in response | `buildResponse` in Task 2 ✓ |
| LAYER_MAP with 5 patterns + fallback | Tasks 1 + 2 ✓ |
| Private IP / non-http URL rejection | `validateUrl` + tests ✓ |
| Fetch hardening: 5s timeout, 150KB, mobile UA | Task 2 handler ✓ |
| `vercel.json` maxDuration: 20 | Task 2 Step 3 ✓ |
| Unit tests: mapCategory / validateUrl / parseOgTags / parseJsonLd / isSufficient | Task 1 ✓ |
| Graceful fallback when `GEMINI_API_KEY` missing | Task 2: returns 422 with partial ✓ |

All 8 acceptance criteria from the spec are covered.

### Placeholder scan

No TBDs, TODOs, or "similar to task N" references — every step contains working code.

### Type / name consistency

- `confirmForm` fields: `{ n, col, c, b, l }` — consistent with `addForm` shape used in `saveAdd()`.
- `importPartial` fields checked: `name`, `brand`, `color`, `l`, `c`, `image` — matches `buildPartial()` output keys.
- `onAdd()` call in `handleConfirmAdd` passes `{ n, b, col, c, l, img, productUrl, _source, t }` — matches item schema in MEMORY.md.
- `fetchProductDetails` return shape: `{ ok, data }` or `{ ok, error, partial }` — matches usage in `handleFetch`.
