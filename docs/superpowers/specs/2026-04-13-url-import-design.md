# URL Import — Paste Product URL → Auto-Add Wardrobe Item

> **Status:** Approved design · ready for implementation planning
> **Date:** 2026-04-13

---

## Goal

Allow any user (guest or logged-in) to paste a Zara / Myntra / H&M / Ajio product URL and automatically extract name, brand, color, category, and image, then confirm before adding to their wardrobe. The experience should feel magical but degrade gracefully when extraction fails.

---

## Design Decisions

| Question | Decision |
|---|---|
| Who can use it? | Everyone — guests and logged-in users. IP rate-limited (5 req/min). |
| Modal flow | Option B: separate confirmation step. URL input + "Add manually" are two entry points. Confirmation card replaces the form after fetch. |
| Editable fields | Minimal by default: name, color, category. "Edit more" expander reveals brand + layer. |
| Error recovery | Smart fallback: partial data pre-fills fields. Green border = detected, red border = needs input. CTA reads "Complete details". |
| Gemini strategy | 3-stage pipeline: OG+JSON-LD → Gemini B (meta/title) → Gemini A (HTML slice). |
| Loading copy | "Analyzing product…" / "Extracting details from page" |

---

## Architecture

### New files

| File | Responsibility |
|---|---|
| `api/extract-product.js` | Vercel serverless function. Validates URL, fetches HTML, runs 3-stage extraction pipeline, returns normalised item fields. IP rate-limited. |
| `src/utils/urlExtract.js` | Client-side helper. `fetchProductDetails(url)` calls the API, maps response to `addForm` shape. |

### Modified files

| File | Change |
|---|---|
| `src/components/WardrobeTab.jsx` | New `importUrl`, `importState`, `importResult`, `importPartial` state. URL input + confirmation card + error card rendered inside existing Add Item modal. |
| `vercel.json` | Add `"api/extract-product.js": { "maxDuration": 20 }` — covers 5s fetch + two sequential Gemini calls. |

No new React components — the entire import UI is state-driven within the existing modal.

---

## UI Flow

### Entry point (inside Add Item modal)

```
┌─────────────────────────────────┐
│ Add Item                        │
│                                 │
│ ┌ PASTE PRODUCT LINK ─────────┐ │
│ │ https://…        [Fetch]    │ │
│ └─────────────────────────────┘ │
│                                 │
│ ──────────── OR ──────────────  │
│                                 │
│ [ + Add manually ]              │
└─────────────────────────────────┘
```

### States

**`idle`** — URL input + "Add manually" button shown.

**`loading`** — Fetch button grayed out. Skeleton shimmer over image (80×100px) and field areas. Spinner + "Analyzing product…" / "Extracting details from page".

**`confirm`** — Confirmation card:
- Image thumbnail (80×100px) with "✓ Detected" badge + source domain
- Summary line: Name · Brand · Layer
- Category chips
- Editable: Name (text input), Color (dropdown), Category (dropdown)
- "Edit more" expander → reveals Brand (text input) + Layer (dropdown)
- Buttons: Cancel | **Confirm & Add**

**`error`** — Smart fallback card:
- Warning icon + "Couldn't detect all details" + "We found some info — fill in the rest below."
- URL field shows "Try again" button
- Fields pre-filled with whatever was extracted:
  - Green border + ✓ label = detected
  - Red border + asterisk = missing (needs user input)
- Buttons: Cancel | **Complete details**
  - "Complete details" merges partial data into `addForm` and opens the standard form pre-filled

---

## Data Flow

```
WardrobeTab state:
  importUrl      string         controlled URL input
  importState    idle|loading|confirm|error
  importResult   ExtractionResult | null    (on confirm)
  importPartial  Partial<ExtractionResult>  (on error)

"Fetch details" click:
  → setImportState("loading")
  → fetchProductDetails(importUrl)   [POST /api/extract-product]
  → success → setImportResult(data), setImportState("confirm")
  → error   → setImportPartial(partial), setImportState("error")

"Confirm & Add":
  → build item object from importResult + edited fields:
    { n, b, col, c, l, img: image, productUrl, _source: "url_import", t: "Yes" }
  → call onAdd(item) directly — NOT saveAdd() (which hardcodes _source:"local" and lacks l/productUrl)
  → reset: importState="idle", importUrl="", importResult=null

"Complete details":
  → merge importPartial into addForm
  → reset import state
  → open standard manual form pre-filled (addForm already set)

"Try again":
  → setImportState("idle") — URL field remains populated for re-edit

"Cancel":
  → reset all import state, close modal
```

---

## Backend: `api/extract-product.js`

### Request / Response

```
POST /api/extract-product
Content-Type: application/json
{ url: string }

200 OK
{
  name:       string,
  brand:      string,
  color:      string,
  l:          "Base"|"Mid"|"Outer"|"Bottom"|"Footwear",
  c:          string,          // app category tab name e.g. "Jackets"
  image:      string | null,   // absolute URL
  productUrl: string,          // echoed back (cleaned)
  _source:    "url_import",
  _via:       "og"|"gemini-b"|"gemini-a"   // which stage produced the result
}

422 Unprocessable  { error: "...", partial: { ... } }
429 Too Many Req   { error: "Rate limit. Retry after X seconds." }
400 Bad Request    { error: "Invalid URL" }
```

### Extraction Pipeline

**Stage 1 — OG + JSON-LD** (zero AI cost)

```
og:title          → name
og:image          → image
og:description    → (context for Gemini if needed)
JSON-LD [Product]:
  .name           → name
  .brand.name     → brand
  .color          → color
  .image          → image
  .category       → raw category string → LAYER_MAP lookup
```

Sufficiency threshold: has `name` AND at least one of (`color` OR `l`).
If sufficient → return with `_via: "og"`.

**Stage 2 — Gemini B** (meta/title only, ~200 tokens)

Triggered when Stage 1 is insufficient.

```
Input: page title + all <meta> tag content + OG values found so far
Prompt:
  "Extract product details from this page metadata.
   Return JSON only: { name, brand, color, category, type }
   Be concise. category and type should be the clothing type (e.g. jacket, jeans, t-shirt)."
```

If sufficient → return with `_via: "gemini-b"`.

**Stage 3 — Gemini A** (HTML slice, ~2000 tokens)

Triggered when Stage 2 is still insufficient.

```
Input: first 8KB of body text (HTML tags stripped, whitespace collapsed)
Same prompt as Stage 2.
```

Always returns whatever was found. If still below threshold → return 422 with partial data.
`_via: "gemini-a"`.

### Category → Layer Mapping

```js
const LAYER_MAP = [
  { pattern: /t-?shirt|tee|shirt|blouse|top|polo/i,        l: "Base",     c: "Shirts"   },
  { pattern: /sweater|sweatshirt|hoodie|knit|pullover/i,    l: "Mid",      c: "Knitwear" },
  { pattern: /jacket|coat|blazer|parka|bomber|gilet/i,      l: "Outer",    c: "Jackets"  },
  { pattern: /jean|trouser|chino|pant|short|skirt|bottom/i, l: "Bottom",   c: "Trousers" },
  { pattern: /shoe|sneaker|boot|loafer|sandal|trainer/i,    l: "Footwear", c: "Footwear" },
];
// Fallback: l = "Base", c = "Shirts" when no pattern matches
```

---

## Security & Rate Limiting

### URL validation

```js
const url = new URL(rawUrl);               // throws on malformed
if (!["http:", "https:"].includes(url.protocol)) throw "Invalid URL";

const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\./,  /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./, /^::1$/, /^0\.0\.0\.0$/,
];
if (BLOCKED_HOSTS.some(re => re.test(url.hostname))) throw "Invalid URL";
```

### Fetch hardening

```js
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);
fetch(url, {
  signal: controller.signal,
  headers: {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ...",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
  },
  redirect: "follow",
});
// Read max 150KB of response body before parsing
```

### IP Rate Limiting

```js
// Module-level — persists across warm invocations on the same Vercel instance
const ipMap = new Map(); // ip → { count, resetAt }
const LIMIT = 5, WINDOW_MS = 60_000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = ipMap.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + WINDOW_MS; }
  if (entry.count >= LIMIT) return false;
  entry.count++;
  ipMap.set(ip, entry);
  return true;
}
```

IP read from `req.headers["x-forwarded-for"]` (Vercel sets this). Falls back to `req.socket.remoteAddress`.

---

## Client Helper: `src/utils/urlExtract.js`

```js
export async function fetchProductDetails(url) {
  const res = await fetch("/api/extract-product", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!res.ok) {
    // Return partial data (may be empty {}) alongside the error
    return { ok: false, error: data.error, partial: data.partial || {} };
  }
  return { ok: true, data };
}
```

Maps directly onto `importResult` / `importPartial` in WardrobeTab — no further transformation needed.

---

## Testing

### `tests/extractProduct.test.js`

Unit tests (no network, no Gemini):
- `mapCategory()` — all 5 layer types + fallback
- `validateUrl()` — rejects private IPs, `localhost`, non-http schemes, malformed
- `parseOgTags()` — extracts `og:title`, `og:image` from fixture HTML strings
- `parseJsonLd()` — extracts Product schema fields from fixture HTML strings
- `isSufficient()` — true when name + color present; false when name missing; false when both color and l missing

Gemini stages and fetch behaviour tested manually only (integration).

---

## Error Handling Summary

| Scenario | Response | UI |
|---|---|---|
| Malformed / private URL | 400 | Inline field error: "Invalid URL" |
| Fetch timeout (>5s) | 422 + partial | Error card (smart fallback) |
| Site blocks scraping (403/429) | 422 + partial | Error card |
| All 3 stages return insufficient | 422 + partial | Error card with whatever was found |
| Rate limit exceeded | 429 | Inline: "Too many requests. Try again in Xs." |
| Gemini API key missing | 500 | Error card — falls back gracefully without AI |

---

## Future-Ready (not in scope)

- Per-URL result caching (Redis / Vercel KV) — avoids re-fetching the same product
- Multiple image extraction (og:image:secure_url, JSON-LD image arrays)
- Auto-tag weather/occasion from product description
- Support Farfetch, ASOS, Uniqlo, Nike

---

## Acceptance Criteria

1. Guest pastes a Zara URL → confirmation card appears with image, name, color, category
2. "Confirm & Add" → item added to wardrobe with `_source: "url_import"` and `productUrl` set
3. Myntra URL (partial extraction) → error card with partial pre-fill → "Complete details" opens pre-filled form
4. Private IP URL → rejected with "Invalid URL"
5. 6th request within 60s from same IP → 429 returned
6. All unit tests pass: `npm test -- tests/extractProduct.test.js`
7. Full build passes: `npm run build`
8. End-to-end under 10 seconds on a fast product page (OG path, no Gemini)
