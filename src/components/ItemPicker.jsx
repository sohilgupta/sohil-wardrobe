import { useState, useMemo } from "react";
import { T, swatch, CAT_EMOJI } from "../theme";

/* ─── Which wardrobe categories belong to each outfit layer ─────────────────
   Used to auto-filter the picker when editing a specific slot.
   ─────────────────────────────────────────────────────────────────────────── */
export const LAYER_TABS = {
  base:   ["Shirts", "Gym Tshirts", "Thermals"],
  mid:    ["Sweaters"],
  outer:  ["Jackets"],
  bottom: ["Bottoms"],
  shoes:  ["Shoes"],
};

const LAYER_LABELS = {
  base:   "Base / Top",
  mid:    "Mid Layer",
  outer:  "Outer / Jacket",
  bottom: "Bottom",
  shoes:  "Shoes",
};

/* ─── Mini item thumbnail ─────────────────────────────────────────────────── */
function Thumb({ item, selected, onSelect }) {
  const [failed, setFailed] = useState(false);
  const name    = item.n || item.itemName || "";
  const color   = item.col || item.color || "Black";
  const brand   = item.b || item.brand || "";
  const img     = item.img || item.imageUrl || "";
  const cat     = item.c || item.category || "";
  const [bg, ac, fg] = swatch(color);
  const emoji = CAT_EMOJI[cat] || "👕";
  const showImg = img && !failed;

  return (
    <div
      onClick={onSelect}
      style={{
        cursor: "pointer",
        borderRadius: 14,
        overflow: "hidden",
        border: `2px solid ${selected ? T.text : T.borderLight}`,
        background: T.alt,
        transition: "border-color 0.15s, transform 0.1s",
        transform: selected ? "scale(1.03)" : "scale(1)",
        position: "relative",
      }}
    >
      {/* Image / swatch */}
      <div
        style={{
          width: "100%",
          paddingTop: "100%",
          position: "relative",
          background: showImg ? T.alt : `linear-gradient(145deg,${bg},${ac})`,
        }}
      >
        {showImg ? (
          <img
            src={img}
            alt={name}
            onError={() => setFailed(true)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            }}
          >
            <span style={{ fontSize: 28 }}>{emoji}</span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: fg,
                opacity: 0.6,
                letterSpacing: 0.5,
                textAlign: "center",
                padding: "0 4px",
              }}
            >
              {color.toUpperCase()}
            </span>
          </div>
        )}

        {/* Selected checkmark */}
        {selected && (
          <div
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: T.text,
              color: T.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            ✓
          </div>
        )}
      </div>

      {/* Label */}
      <div style={{ padding: "6px 7px 7px" }}>
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: T.text,
            lineHeight: 1.3,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {name}
        </p>
        {brand && (
          <p style={{ fontSize: 9, color: T.light, marginTop: 2, letterSpacing: 0.5 }}>
            {brand.toUpperCase()}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── ItemPicker modal ────────────────────────────────────────────────────── */
// Props:
//   wardrobe    – full items array (from useWardrobe)
//   layer       – "base"|"mid"|"outer"|"bottom"|"shoes" — pre-filters the list
//   currentId   – currently selected item ID (shown as selected)
//   onSelect(item) – called when user confirms a selection
//   onClose     – called to dismiss without selecting
export default function ItemPicker({ wardrobe, layer, currentId, onSelect, onClose }) {
  const [q,        setQ]        = useState("");
  const [pending,  setPending]  = useState(currentId || null);

  const allowedTabs = LAYER_TABS[layer] || [];
  const layerLabel  = LAYER_LABELS[layer] || layer;

  /* Filter: tab → layer, then search */
  const filtered = useMemo(() => {
    const pool = allowedTabs.length
      ? wardrobe.filter((i) => allowedTabs.includes(i.c || i.category))
      : wardrobe;

    if (!q.trim()) return pool;
    const lq = q.toLowerCase();
    return pool.filter(
      (i) =>
        (i.n || i.itemName || "").toLowerCase().includes(lq) ||
        (i.col || i.color || "").toLowerCase().includes(lq) ||
        (i.b || i.brand || "").toLowerCase().includes(lq) ||
        (i.productCode || "").toLowerCase().includes(lq)
    );
  }, [wardrobe, layer, q]);  // eslint-disable-line react-hooks/exhaustive-deps

  function confirm() {
    if (!pending) return;
    const item = wardrobe.find((i) => i.id === pending);
    if (item) onSelect(item);
  }

  return (
    /* Backdrop */
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 500,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      {/* Sheet */}
      <div
        style={{
          background: T.surface,
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 700,
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 16px 12px",
            borderBottom: `1px solid ${T.borderLight}`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
                Pick · {layerLabel}
              </p>
              <p style={{ fontSize: 11, color: T.mid, marginTop: 2 }}>
                {filtered.length} item{filtered.length !== 1 ? "s" : ""}
                {allowedTabs.length ? ` · ${allowedTabs.join(", ")}` : ""}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: T.mid,
                fontSize: 18,
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              ✕
            </button>
          </div>

          {/* Search */}
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: T.light,
                fontSize: 14,
              }}
            >
              ⌕
            </span>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, color, brand, code…"
              style={{
                width: "100%",
                padding: "9px 12px 9px 34px",
                background: T.alt,
                border: `1.5px solid ${T.border}`,
                borderRadius: 10,
                fontSize: 13,
                color: T.text,
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>

        {/* Grid */}
        <div
          style={{
            overflowY: "auto",
            flex: 1,
            padding: "12px 12px 0",
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: T.light, fontSize: 13 }}>
              No items found
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                gap: 10,
              }}
            >
              {filtered.map((item) => (
                <Thumb
                  key={item.id}
                  item={item}
                  selected={pending === item.id}
                  onSelect={() => setPending(item.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: "12px 16px 20px",
            borderTop: `1px solid ${T.borderLight}`,
            display: "flex",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "11px",
              background: "none",
              border: `1.5px solid ${T.border}`,
              borderRadius: 12,
              fontSize: 13,
              color: T.mid,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={!pending}
            style={{
              flex: 2,
              padding: "11px",
              background: pending ? T.text : T.border,
              border: "none",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 700,
              color: pending ? T.bg : T.light,
              cursor: pending ? "pointer" : "default",
              fontFamily: "inherit",
              transition: "background 0.15s",
            }}
          >
            Select →
          </button>
        </div>
      </div>
    </div>
  );
}
