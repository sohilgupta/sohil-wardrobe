# Zara Order → Wardrobe Sheet: Import Workflow

A repeatable procedure for entering the items from a **Zara in-store order** into the
Vesti **Wardrobe** Google Sheet, using a browser-automation agent that drives the
user's *already-logged-in* Chrome. Written so any LLM/agent can follow it given only
an order URL.

> The same browser-driven pattern works for Myntra, Nykaa Fashion, and H&M orders —
> only the extraction selectors and image/product-URL shapes differ. This doc covers
> Zara; see "Adapting to other retailers" at the end.

---

## 0. Prerequisites

- The agent can drive the user's real Chrome (e.g. a `claude-in-chrome` style tool),
  because the order page **requires the user's Zara login** and the sheet requires
  their Google login. Do **not** enter credentials — the user must already be signed in.
- Target spreadsheet: **"Wardrobe"**
  `https://docs.google.com/spreadsheets/d/1rl2kl9M4sFIlJtDeAFjd5YIZEFWV1P60Loc3iHMguhk/edit`
- Never `git add -A` or touch production code for this task — it's pure data entry.

## 1. Sheet reference

Tabs (bottom of the sheet), each a garment category:
`Jackets · Shoes · Sweaters · Thermals · Shirts · Gym Tshirts · Bottoms · Shorts · Inventory`

**Columns (identical across garment tabs):**

| Col | Field | Notes |
|-----|-------|-------|
| A | Category | free-text, e.g. `T-Shirt`, `Polo T-Shirt`, `Shirt`, `Vest`, `Jacket`, `Joggers`, `Shorts` |
| B | Item Name | a `=HYPERLINK("<productUrl>","<NAME>")` formula (the app reads the link) |
| C | Color | e.g. `Beige`, `Navy Blue`, `Grey` |
| D | Size | e.g. `L`, `32` |
| E | Brand | e.g. `Zara` |
| F | Image | an `=IMAGE(...)` formula referencing column G — **formula style varies per tab, see below** |
| G | Image URL | plain image URL (the `=IMAGE()` renders it) |
| H | Price | plain number (some tabs currency-format it → still enter a bare number) |
| I | Date of Purchase / Purchase Date | e.g. `21-Jul-2026` |
| J | Product Code | e.g. `0495/310` (keep the slash — stays text, don't let it become a date) |
| K | Weather Sustainability | leave blank |

**Per-tab `=IMAGE()` convention (match the tab you're writing to):**
- **Shirts:** `=IMAGE(G<row>)` (plain, mode 1)
- **Shorts / Bottoms:** `=IMAGE(G<row>,4,160,160)` (mode 4, 160×160)
- Before writing, read an existing `F` cell in that tab and copy its exact formula shape.

**Tab & category selection (Zara tops):**
| Item type | Tab | Category (col A) |
|-----------|-----|------------------|
| T-shirt / slogan tee | Shirts | `T-Shirt` |
| Polo / knit polo | Shirts | `Polo T-Shirt` |
| Shirt / overshirt / flowing shirt | Shirts | `Shirt` |
| Tank / vest | Shirts | `Vest` |
| Jacket / blazer / bomber | Jackets | `Jacket` / `Blazer` |
| Trousers / joggers / jeans | Bottoms | (match existing, e.g. `Joggers`) |
| Shorts | Shorts | `Shorts` |
| Tights / leggings | Bottoms | `Tights` |
| Shoes | Shoes | (match existing) |

Some tabs (e.g. **Jackets**) end with a green **"Sum ="** totals row — never overwrite it.
Insert a data row *above* it via right-click row header → **Insert 1 row below** on the
last data row (an "insert above the Sum row" inherits the green formatting).

## 2. Extract the order (JavaScript, run on the order page)

Navigate the browser to the order URL, then run:

```js
await (async () => {
  window.scrollTo(0, document.body.scrollHeight);
  await new Promise(r => setTimeout(r, 1800));      // let lazy images load
  window.scrollTo(0, document.body.scrollHeight);
  await new Promise(r => setTimeout(r, 1200));
  // Map each 11-digit product-color code -> its image pathname (prefer -e1/-p views)
  const byCode = {};
  document.querySelectorAll('img,source').forEach(el => {
    const s = (el.src || el.srcset || '') + '';
    const url = s.split(' ')[0];
    const m = url.match(/\/(\d{11})-/);
    if (m) { try {
      const p = new URL(url).pathname;
      if (!byCode[m[1]] || p.includes('-e1') || p.includes('-p')) byCode[m[1]] = p;
    } catch {} }
  });
  return { title: document.title, byCode, fullText: document.body.innerText };
})()
```

- `fullText` contains, per item, three lines like:
  `VINTAGE-EFFECT SLOGAN PRINT T-SHIRT` / `BEIGE - REF 0495/310` / `₹ 1,150.00` and a size line (`L`),
  plus `YOU PURCHASED THIS ORDER ON THE  7/21/2026` and `ORDER NUMBER: 014736`.
- **Date:** the `qrCode` param in the URL carries an ISO timestamp
  (`...;2026-07-21T20:19:...`) — trust that. Format as `D-Mon-YYYY` (e.g. `21-Jul-2026`).
- `byCode` keys are the **11-digit** codes; the first **8 digits** are the product id.
- If the page shows a login screen instead, the user isn't signed into Zara — stop and ask them to log in (do not enter credentials).

## 3. Build & verify the image URL and product URL

For each item with 11-digit `code` and raw image `pathname`:

**Image URL** — turn the order thumbnail path into a clean 1920px URL:
```js
const imageUrl = 'https://static.zara.net'
  + pathname.replace(/^\/photos\/+/, '/').replace(/\/w\/\d+\//, '/')
  + '?w=1920';
// e.g. /photos///assets/public/AAAA/BBBB/CCCC/DDDD/00495310450-e2/w/386/00495310450-e2.jpg
//  ->  https://static.zara.net/assets/public/AAAA/BBBB/CCCC/DDDD/00495310450-e2/00495310450-e2.jpg?w=1920
```

**Product URL** — slugify the item name + append `p<first 8 digits>.html`:
```js
const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const productUrl = `https://www.zara.com/in/en/${slug}-p${code.slice(0,8)}.html`;
// "RELAXED FIT KNIT POLO SHIRT" + 02142408802 -> relaxed-fit-knit-polo-shirt-p02142408.html
```

**Verify both before writing** (run on the zara.com origin so fetches are same-origin):
```js
// image loads?
await new Promise(res => { const i = new Image();
  i.onload = () => res(i.naturalWidth); i.onerror = () => res(0); i.src = imageUrl; });
// product page resolves? (200)
(await fetch(productUrl, { credentials: 'include' })).status;
```
If a product URL 404s, the slug is wrong — the bare `https://www.zara.com/in/en/-p<8digits>.html`
sometimes 404s; keep the descriptive slug. If an image doesn't load, try the `-e1`
(or `-p`) variant of the same code.

## 4. Enter rows in the sheet (the fiddly part — follow exactly)

Google Sheets automation has sharp edges; these steps avoid them.

1. Open the sheet, click the target **tab** (e.g. `Shirts`).
2. **Find the last data row:** click a data cell in column A, press `Cmd+Down`, read the
   Name Box (zoom the region around the top-left cell reference). Say it's `A58`.
3. **Add rows if needed:** if pressing `Down` doesn't advance past the last row, the sheet
   is trimmed — scroll to the "**Add [N] more rows at the bottom**" footer, set N to the
   number of items, click **Add**.
4. **Navigate to the first empty row with ARROW KEYS, not the Name Box.**
   The Name Box often fails to focus and your text lands in a cell instead → corruption.
   From the last data row, press `Down` once to reach the first new empty row; verify by
   zooming the Name Box. (Arrow keys sometimes only register once per batch — verify after
   each move and repeat as needed.)
5. **Type the row across with Tab between cells, Enter at the end.** After the final
   `Enter`, the cursor returns to **column A of the next row**, so you can chain rows.
   Column order per row (Shirts example):
   ```
   A: T-Shirt        <Tab>
   B: =HYPERLINK("<productUrl>","<NAME>")   <Tab>
   C: Beige          <Tab>
   D: L              <Tab>
   E: Zara           <Tab>
   F: =IMAGE(G<row>) <Tab>          (Shorts/Bottoms: =IMAGE(G<row>,4,160,160))
   G: <imageUrl>     <Tab>
   H: 1150           <Tab>
   I: 21-Jul-2026    <Tab>
   J: 0495/310       <Enter>
   ```
6. **Verify** after each row (or the batch): screenshot and confirm the `=IMAGE` rendered,
   the item name is an underlined link, and price/date/code are right.

### Gotchas (learned the hard way)
- **Never type into the Name Box** to navigate — it frequently doesn't take focus and the
  text overwrites the currently-selected cell. Use arrow keys; verify with a Name-Box zoom.
- **Text autocomplete:** typing a value that's a prefix of an existing column-A value +
  `Tab` will *accept the autocomplete* (e.g. typing `Polo` became `Polo T-Shirt`). This is
  usually fine/desirable (it matches existing categories) — just be aware.
- **`\t` inside a single `type` string does NOT move cells** — it becomes literal spaces.
  Always send `Tab` as a separate key press.
- **Newly-added bottom rows auto-fill B & F** with the previous row's `=HYPERLINK`/`=IMAGE`
  formulas. Typing your values overwrites them. For an item with **no image/link**, you
  must explicitly `Delete` the auto-filled `F` (and leave `G` blank) and type a **plain**
  item name (no HYPERLINK).
- **Product code with a slash** (`0495/310`) stays text (not a date) because the second
  part > 12 — safe to enter as-is.
- **Formula auto-close:** Sheets auto-inserts closing `)`/`"`; typing the full formula
  including your own closing chars still yields correct text (it types over them). Verified
  to work for `=HYPERLINK(...)` and `=IMAGE(...)`.
- If you corrupt a non-empty cell, fix it deterministically: click it → `Escape` →
  `Delete` → type the correct value → `Tab`.

## 5. Data mapping summary (per item)

| Sheet col | Source |
|-----------|--------|
| A Category | inferred from item type (see table in §1) |
| B Item Name | `=HYPERLINK(productUrl, NAME)` — NAME from `fullText` |
| C Color | the `COLOR - REF ...` line, color part |
| D Size | the size line (`L`, `M`, `32`…) |
| E Brand | `Zara` |
| F Image | `=IMAGE(G<row>[,4,160,160])` per tab |
| G Image URL | built in §3 |
| H Price | `₹ 1,150.00` → `1150` |
| I Date | from the `qrCode` ISO date → `21-Jul-2026` |
| J Product Code | the `REF` value, e.g. `0495/310` |

## Adapting to other retailers

- **Myntra** (`/my/item/details?...`): product image path contains the **styleId**
  (`assets/images/<styleId>/...`); product URL = `https://www.myntra.com/<styleId>`
  (bare id resolves; the slug form 404s). Multi-item orders label the item price
  "Total Item Price". Delisted items may have **no image** — enter with a color swatch,
  no `=IMAGE`, plain-text name.
- **Nykaa Fashion**: `<img>` `src` is blocked by the automation harness (query strings);
  read the image via the element's `alt` and rebuild the clean path
  `adn-static1.nykaa.com/.../product/<x>/<y>/<file>.jpg` (strip any `tr:...` transform).
  Product `/p/<id>` links aren't always in the DOM (JS-routed) — may be unavailable.
- **H&M** (`/account/purchases/order/<id>`): product link is
  `productpage.<id>.html`; the product **name/color** come from that page's `og:title`;
  image `https://image.hm.com/assets/hm/<..>.jpg?imwidth=2160`.

  ⚠️ **Multi-variant colour trap.** One H&M product page serves several colour
  variants, and the **first `"colorName"` in the HTML is often the WRONG one** —
  it belongs to a sibling variant, not the one ordered. Proximity/regex guessing
  around the image hash does not work either (the colour labels live in a distant
  JSON blob). Resolve it deterministically instead:

  1. Take the **exact article code from the order's product link**
     (`productpage.1347123002.html` → `1347123002`).
  2. Fetch *that* page and read `og:title` — it is **variant-specific**
     (`"Men's Rust red/Sun Running shorts with DryMove™"`).
  3. Cross-check by fetching the sibling code (`…001`) and confirming it returns a
     *different* colour. If both return the same, you fetched a redirect — recheck.

  ```js
  // returns e.g. { "1347123001": "Dark plum/Sun", "1347123002": "Rust red/Sun" }
  for (const code of ["1347123001", "1347123002"]) {
    const h = await (await fetch(`https://www2.hm.com/en_in/productpage.${code}.html`,
                                 { credentials: "include" })).text();
    console.log(code, (h.match(/property="og:title"\s+content="([^"]+)"/) || [])[1]);
  }
  ```

  ⚠️ **H&M order pages do not show the size.** There is no size anywhere in the
  order page text — leave column D blank rather than guessing.

## Data safety
- This workflow only **appends** rows to the sheet. It never edits existing rows, the
  app's code, or Supabase/localStorage. If you must add rows in a tab with a `Sum =` row,
  insert *below the last data row* so the totals row stays at the bottom.
