/* ─── TRIP CAPSULE TAB ───────────────────────────────────────────────────────
   Manage a curated shortlist of wardrobe items for the trip.
   Items in the capsule are:
     • Shown first (and by default exclusively) in outfit pickers
     • Passed to AI generation instead of the full wardrobe
     • Listed in the Packing tab even if not yet in any outfit

   "✨ Generate Trip Capsule" uses AI to auto-select ~25–35 versatile items.
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useMemo } from "react";
import { T, swatch, CAT_EMOJI } from "../theme";
import { generateCapsuleWithAI } from "../utils/tripGenerator";

/* ─── filter select helpers (shared style from WardrobeTab) ──────────────── */
const selStyle = {
  padding: "7px 28px 7px 12px",
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
  appearance: "none",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  outline: "none",
};
const selBg     = (a) => (a ? "#E8E6E1" : "#26262B");
const selColor  = (a) => (a ? "#0F0F12" : "#C4C1BB");
const selBorder = (a) => `1.5px solid ${a ? "#E8E6E1" : "#3C3C44"}`;
const selArrow  = (a) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='${a ? "%230F0F12" : "%23C4C1BB"}'/%3E%3C/svg%3E")`;

/* ─── Item card with capsule toggle ──────────────────────────────────────── */
function CapsuleCard({ item, inCapsule, onToggle }) {
  const [imgFailed, setImgFailed] = useState(false);
  const name  = item.n || item.itemName || "";
  const color = item.col || item.color || "Black";
  const brand = item.b || item.brand || "";
  const img   = item.img || item.imageUrl || "";
  const cat   = item.c || item.category || "";
  const [bg, ac, fg] = swatch(color);
  const emoji  = CAT_EMOJI[cat] || "👕";
  const showImg = img && !imgFailed;

  return (
    <div style={{ position: "relative" }}>
      {/* Image / swatch */}
      <div
        onClick={onToggle}
        style={{
          borderRadius: 12,
          overflow: "hidden",
          border: `2px solid ${inCapsule ? "#14B8A6" : T.borderLight}`,
          background: T.alt,
          cursor: "pointer",
          transition: "border-color 0.15s",
          position: "relative",
        }}
      >
        <div style={{
          width: "100%",
          paddingTop: "100%",
          position: "relative",
          background: showImg ? T.alt : `linear-gradient(145deg,${bg},${ac})`,
        }}>
          {showImg ? (
            <img
              src={img}
              alt={name}
              onError={() => setImgFailed(true)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
              <span style={{ fontSize: 26 }}>{emoji}</span>
              <span style={{ fontSize: 8, fontWeight: 700, color: fg, opacity: 0.6, letterSpacing: 0.5 }}>
                {color.toUpperCase()}
              </span>
            </div>
          )}

          {/* Capsule badge — top-right */}
          {inCapsule && (
            <div style={{
              position: "absolute", top: 6, right: 6,
              background: "#0D4A43",
              color: "#2DD4BF",
              borderRadius: 6,
              fontSize: 8,
              fontWeight: 700,
              padding: "2px 5px",
              lineHeight: 1.4,
              letterSpacing: 0.5,
            }}>
              ✈ TRIP
            </div>
          )}

          {/* Source badge — top-left */}
          {item._source === "local" && (
            <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(60,20,100,0.85)", color: "#A78BFA", fontSize: 8, fontWeight: 700, padding: "2px 5px", borderRadius: 5 }}>
              LOCAL
            </div>
          )}
        </div>

        {/* Item name */}
        <div style={{ padding: "6px 7px 7px" }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: T.text, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {name}
          </p>
          {brand && (
            <p style={{ fontSize: 9, color: T.light, marginTop: 2, letterSpacing: 0.5 }}>
              {brand.toUpperCase()}
            </p>
          )}
        </div>
      </div>

      {/* Toggle button — below card */}
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          marginTop: 5,
          padding: "5px 0",
          borderRadius: 8,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 0.5,
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "all 0.15s",
          border: inCapsule ? "1.5px solid #14B8A6" : `1.5px dashed ${T.borderLight}`,
          background: inCapsule ? "#0D2E2B" : "none",
          color: inCapsule ? "#2DD4BF" : T.light,
        }}
      >
        {inCapsule ? "✓ In Trip" : "+ Add"}
      </button>
    </div>
  );
}

/* ─── CAPSULE TAB ─────────────────────────────────────────────────────────── */
export default function CapsuleTab({ wardrobe = [], capsuleIds, toggleCapsule, setManyCapsule, clearCapsule }) {
  const [q,      setQ]      = useState("");
  const [cat,    setCat]    = useState("");
  const [showCapsuleOnly, setShowCapsuleOnly] = useState(false);

  /* AI generation state */
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError,   setAiError]   = useState(null);
  const [aiDone,    setAiDone]    = useState(false);

  /* Filter options */
  const cats = useMemo(() => [...new Set(wardrobe.map((i) => i.c))].sort(), [wardrobe]);

  /* Filtered list */
  const filtered = useMemo(() => {
    let pool = wardrobe;
    if (showCapsuleOnly) pool = pool.filter((i) => capsuleIds.has(i.id));
    if (cat) pool = pool.filter((i) => i.c === cat);
    if (q) {
      const lq = q.toLowerCase();
      pool = pool.filter((i) =>
        (i.n || "").toLowerCase().includes(lq) ||
        (i.b || "").toLowerCase().includes(lq) ||
        (i.col || "").toLowerCase().includes(lq) ||
        (i.c || "").toLowerCase().includes(lq)
      );
    }
    return pool;
  }, [wardrobe, capsuleIds, showCapsuleOnly, cat, q]);

  const capsuleCount = capsuleIds.size;

  async function handleGenerateCapsule() {
    if (aiLoading || wardrobe.length === 0) return;
    setAiLoading(true);
    setAiError(null);
    setAiDone(false);
    try {
      const ids = await generateCapsuleWithAI({ wardrobe });
      setManyCapsule(ids);
      setAiDone(true);
      setTimeout(() => setAiDone(false), 3000);
    } catch (err) {
      setAiError(err.message || "Generation failed. Try again.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: -0.3 }}>
            Trip Capsule
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              background: capsuleCount > 0 ? "#0D2E2B" : T.surface,
              border: `1.5px solid ${capsuleCount > 0 ? "#14B8A6" : T.borderLight}`,
              borderRadius: 20,
              padding: "4px 12px",
              fontSize: 11,
              fontWeight: 700,
              color: capsuleCount > 0 ? "#2DD4BF" : T.light,
            }}>
              {capsuleCount} / {wardrobe.length}
            </div>
            {capsuleCount > 0 && (
              <button
                onClick={clearCapsule}
                style={{
                  padding: "4px 10px",
                  background: "none",
                  border: `1.5px solid ${T.border}`,
                  borderRadius: 20,
                  fontSize: 10,
                  color: "#F87171",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <p style={{ fontSize: 11, color: T.mid }}>
          Curate your travel wardrobe · outfit picker uses capsule items by default
        </p>
      </div>

      {/* ── Generate AI Capsule ── */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={handleGenerateCapsule}
          disabled={aiLoading || wardrobe.length === 0}
          style={{
            width: "100%",
            padding: "13px 20px",
            borderRadius: 14,
            border: aiDone ? "1.5px solid #14B8A6" : aiLoading ? `1.5px solid ${T.border}` : "1.5px solid transparent",
            background: aiLoading
              ? T.alt
              : aiDone
                ? "#0D2E2B"
                : "linear-gradient(135deg, #0D2E2B 0%, #0f3460 100%)",
            color: aiLoading ? T.light : aiDone ? "#2DD4BF" : T.text,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.5,
            cursor: aiLoading || wardrobe.length === 0 ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.2s",
            boxShadow: aiLoading || aiDone ? "none" : "0 4px 20px rgba(13,46,43,0.4)",
          }}
        >
          {aiLoading ? (
            <>
              <span style={{ animation: "spin 1.2s linear infinite", display: "inline-block" }}>◌</span>
              Selecting best travel items…
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </>
          ) : aiDone ? (
            <>✓ {capsuleCount} items selected!</>
          ) : (
            <>✨ Generate Trip Capsule</>
          )}
        </button>
        {!aiLoading && !aiDone && (
          <p style={{ fontSize: 10, color: T.light, marginTop: 5, textAlign: "center" }}>
            AI selects ~25–35 versatile items based on weather, activities & layering
          </p>
        )}
        {aiError && (
          <div style={{ marginTop: 8, background: "#2D0A0A", border: "1.5px solid #7F1D1D", borderRadius: 10, padding: "10px 14px", fontSize: 11, color: "#FCA5A5", lineHeight: 1.5 }}>
            ⚠ {aiError}
          </div>
        )}
      </div>

      {/* ── Filters ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: 140 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.light, fontSize: 14 }}>⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            style={{
              width: "100%",
              padding: "8px 12px 8px 34px",
              background: T.surface,
              border: `1.5px solid ${T.border}`,
              borderRadius: 20,
              fontSize: 12,
              color: T.text,
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
        </div>

        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          style={{ ...selStyle, backgroundColor: selBg(cat), color: selColor(cat), border: selBorder(cat), backgroundImage: selArrow(cat) }}
        >
          <option value="">All Categories</option>
          {cats.map((o) => <option key={o}>{o}</option>)}
        </select>

        {/* Capsule-only toggle */}
        <button
          onClick={() => setShowCapsuleOnly((v) => !v)}
          style={{
            padding: "7px 14px",
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            border: showCapsuleOnly ? "1.5px solid #14B8A6" : `1.5px solid ${T.border}`,
            background: showCapsuleOnly ? "#0D2E2B" : "none",
            color: showCapsuleOnly ? "#2DD4BF" : T.light,
            letterSpacing: 0.5,
            whiteSpace: "nowrap",
          }}
        >
          {showCapsuleOnly ? "✈ Capsule" : "All Items"}
        </button>
      </div>

      {/* ── Count ── */}
      <p style={{ fontSize: 11, color: T.light, marginBottom: 14 }}>
        {filtered.length} of {wardrobe.length} items
        {capsuleCount > 0 && !showCapsuleOnly && (
          <span style={{ color: "#2DD4BF", marginLeft: 6 }}>· {capsuleCount} in capsule</span>
        )}
      </p>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: T.light, fontSize: 12 }}>
          {showCapsuleOnly && capsuleCount === 0
            ? "No items in your Trip Capsule yet. Add items below or use Generate."
            : "No items match your filter."
          }
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 14 }}>
          {filtered.map((item) => (
            <CapsuleCard
              key={item.id}
              item={item}
              inCapsule={capsuleIds.has(item.id)}
              onToggle={() => toggleCapsule(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
