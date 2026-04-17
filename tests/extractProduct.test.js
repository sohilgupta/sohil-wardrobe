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
