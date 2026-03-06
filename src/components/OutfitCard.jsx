import { useState, useEffect } from "react";
import { T, swatch, CAT_EMOJI } from "../theme";

/* ─── LAYER META ─────────────────────────────────────────────────────────── */
const LAYER_META = {
  base:          { label: "BASE",    order: 1 },
  mid:           { label: "MID",     order: 2 },
  outer:         { label: "OUTER",   order: 3 },
  thermalBottom: { label: "THERMAL", order: 4 },
  bottom:        { label: "BOTTOM",  order: 5 },
  shoes:         { label: "SHOES",   order: 6 },
};

/* ─── PREMIUM ITEM THUMB ─────────────────────────────────────────────────── */
function PremiumItemThumb({ item, onSwap, width = 110, height = 110, alwaysSwap = false, usageCount = 0 }) {
  const [failed,  setFailed]  = useState(false);
  const [hovered, setHovered] = useState(false);

  const color    = item.col   || item.color    || "";
  const brand    = item.b     || item.brand    || "";
  const name     = item.n     || item.itemName || "";
  const img      = item.img   || item.imageUrl || "";
  const category = item.c     || item.category || "";
  const missing  = item._missing;

  const [bg, accent, fg] = swatch(color);
  const emoji   = CAT_EMOJI[category] || "👕";
  const initials = brand.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const showImage = img && !failed && !missing;

  const boxStyle = {
    width,
    height,
    borderRadius: width >= 150 ? 18 : width >= 110 ? 16 : 14,
    overflow: "hidden",
    flexShrink: 0,
    position: "relative",
    border: missing
      ? "1.5px dashed #92400E"
      : `1.5px solid ${T.borderLight}`,
    background: missing
      ? "#2D1A0A"
      : showImage
        ? T.alt
        : `linear-gradient(145deg, ${bg} 0%, ${accent} 100%)`,
    boxShadow: width >= 150
      ? "0 8px 24px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.3)"
      : "0 4px 12px rgba(0,0,0,0.35)",
  };

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={boxStyle}>
        {/* ── texture overlay for swatches ── */}
        {!showImage && !missing && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(255,255,255,0.03) 2px,rgba(255,255,255,0.03) 4px)",
            }}
          />
        )}

        {/* ── image or swatch or missing ── */}
        {missing ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
            }}
          >
            <span style={{ fontSize: Math.max(16, width * 0.2) }}>⚠️</span>
            <span
              style={{
                fontSize: Math.max(7, width * 0.06),
                fontWeight: 700,
                color: "#FCD34D",
                letterSpacing: 0.8,
                textAlign: "center",
                padding: "0 6px",
              }}
            >
              REMOVED
            </span>
          </div>
        ) : showImage ? (
          <img
            src={img}
            alt={name}
            onError={() => setFailed(true)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
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
              gap: 3,
            }}
          >
            <span
              style={{
                fontSize: width * 0.35,
                fontWeight: 800,
                color: fg,
                opacity: 0.1,
                lineHeight: 1,
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                letterSpacing: -3,
                position: "absolute",
              }}
            >
              {initials}
            </span>
            <span style={{ fontSize: Math.max(14, width * 0.22), lineHeight: 1, position: "relative", zIndex: 1 }}>
              {emoji}
            </span>
            <span
              style={{
                fontSize: Math.max(7, width * 0.065),
                fontWeight: 700,
                color: fg,
                opacity: 0.5,
                letterSpacing: 0.8,
                textAlign: "center",
                padding: "0 6px",
                lineHeight: 1.3,
                position: "relative",
                zIndex: 1,
              }}
            >
              {color.toUpperCase()}
            </span>
          </div>
        )}

        {/* ── swap button ── */}
        {onSwap && (
          <button
            onClick={(e) => { e.stopPropagation(); onSwap(); }}
            title="Swap item"
            style={{
              position: "absolute",
              bottom: 6,
              right: 6,
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "rgba(26,26,31,0.9)",
              border: `1.5px solid ${hovered || alwaysSwap || missing ? T.border : "transparent"}`,
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: 13,
              color: hovered || missing ? T.text : T.mid,
              opacity: alwaysSwap || missing ? 1 : hovered ? 1 : 0.7,
              transition: "opacity 0.15s, border-color 0.15s, color 0.15s",
              zIndex: 2,
            }}
          >
            ⟳
          </button>
        )}
      </div>

      {/* ── item label ── */}
      <div style={{ width, textAlign: "center" }}>
        <p
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: Math.max(9, width * 0.072),
            fontWeight: 500,
            color: missing ? "#FCD34D" : T.text,
            lineHeight: 1.3,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            letterSpacing: 0.1,
          }}
        >
          {missing ? "Item removed" : name}
        </p>
        {!missing && brand && (
          <p
            style={{
              fontSize: Math.max(7, width * 0.056),
              fontWeight: 700,
              color: T.light,
              marginTop: 2,
              letterSpacing: 1.1,
            }}
          >
            {brand.toUpperCase()}
          </p>
        )}
        {/* ── usage badge: shown when item appears 2+ times across all outfit slots ── */}
        {!missing && usageCount >= 2 && (
          <p
            style={{
              fontSize: Math.max(7, width * 0.056),
              fontWeight: 700,
              color: "#93C5FD",
              marginTop: 2,
              letterSpacing: 0.8,
            }}
          >
            ×{usageCount} used
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── LAYER BADGE ────────────────────────────────────────────────────────── */
function LayerBadge({ layer }) {
  const meta = LAYER_META[layer] || { label: layer.toUpperCase() };
  return (
    <div
      style={{
        fontSize: 7,
        fontWeight: 700,
        letterSpacing: 2,
        color: T.light,
        padding: "2px 8px",
        background: T.alt,
        border: `1px solid ${T.border}`,
        borderRadius: 20,
        whiteSpace: "nowrap",
        alignSelf: "center",
        flexShrink: 0,
      }}
    >
      {meta.label}
    </div>
  );
}

/* ─── SLOT (layer badge + thumb) ─────────────────────────────────────────── */
function Slot({ layer, item, onSwap, width, height, alwaysSwap = false, usageStats }) {
  if (!item) return null;
  const usageCount = (!item._missing && usageStats?.[item.id]?.count) || 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <LayerBadge layer={layer} />
      <PremiumItemThumb
        item={item}
        onSwap={onSwap}
        width={width}
        height={height}
        alwaysSwap={alwaysSwap || item._missing}
        usageCount={usageCount}
      />
    </div>
  );
}

/* ─── EXPAND MODAL ───────────────────────────────────────────────────────── */
function OutfitExpandModal({ outfit, onSwap, onRegenerate, onClose, usageStats }) {
  const { base, mid, outer, thermalBottom, bottom, shoes } = outfit;

  // Close on Escape
  useEffect(() => {
    function handleKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Wrap onSwap so modal closes before ItemPicker opens
  function handleSwap(layer) {
    onClose();
    onSwap(layer);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.88)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: T.surface,
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 520,
          maxHeight: "92vh",
          overflowY: "auto",
          animation: "slideUp 0.22s ease-out",
          paddingBottom: 28,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 20px 14px",
            borderBottom: `1px solid ${T.borderLight}`,
            position: "sticky",
            top: 0,
            background: T.surface,
            zIndex: 1,
          }}
        >
          <span
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 16,
              fontWeight: 700,
              color: T.text,
              letterSpacing: 2,
            }}
          >
            Full Outfit
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: `1.5px solid ${T.border}`,
              borderRadius: "50%",
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: T.mid,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* Hero: BASE */}
        {base && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "22px 20px 0" }}>
            <Slot layer="base" item={base} onSwap={() => handleSwap("base")} width={200} height={220} alwaysSwap usageStats={usageStats} />
          </div>
        )}

        {/* Mid row: MID + OUTER */}
        {(mid || outer) && (
          <div style={{ display: "flex", justifyContent: "center", gap: 16, padding: "16px 20px 0" }}>
            {mid   && <Slot layer="mid"   item={mid}   onSwap={() => handleSwap("mid")}   width={130} height={130} alwaysSwap usageStats={usageStats} />}
            {outer && <Slot layer="outer" item={outer} onSwap={() => handleSwap("outer")} width={130} height={130} alwaysSwap usageStats={usageStats} />}
          </div>
        )}

        {/* Lower row: THERMAL BOTTOM + BOTTOM + SHOES */}
        {(thermalBottom || bottom || shoes) && (
          <div style={{ display: "flex", justifyContent: "center", gap: 16, padding: "16px 20px 0", flexWrap: "wrap" }}>
            {thermalBottom && <Slot layer="thermalBottom" item={thermalBottom} onSwap={() => handleSwap("thermalBottom")} width={120} height={120} alwaysSwap usageStats={usageStats} />}
            {bottom        && <Slot layer="bottom"        item={bottom}        onSwap={() => handleSwap("bottom")}        width={140} height={140} alwaysSwap usageStats={usageStats} />}
            {shoes         && <Slot layer="shoes"         item={shoes}         onSwap={() => handleSwap("shoes")}         width={140} height={140} alwaysSwap usageStats={usageStats} />}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", gap: 10, padding: "20px 20px 0" }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "11px",
              background: "none",
              border: `1.5px solid ${T.border}`,
              borderRadius: 12,
              fontSize: 12,
              color: T.mid,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ✕ Close
          </button>
          {onRegenerate && (
            <button
              onClick={() => { onRegenerate(); onClose(); }}
              style={{
                flex: 2,
                padding: "11px",
                background: "none",
                border: `1.5px solid ${T.border}`,
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
                color: T.mid,
                cursor: "pointer",
                fontFamily: "inherit",
                letterSpacing: 0.3,
              }}
            >
              ↺ Regenerate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── OUTFIT CARD (main export) ──────────────────────────────────────────── */
// Props:
//   outfit:       { base, mid, outer, thermalBottom, bottom, shoes } — full item objects or null
//   onSwap(layer): callback to swap an item in that layer
//   onRegenerate:  callback to regenerate the full outfit
//   loading:       boolean
//   usageStats:    { [itemId]: { count, inFrozen, inAny, inRecent } } — from computeUsageStats
export default function OutfitCard({ outfit, onSwap, onRegenerate, loading, usageStats }) {
  const [expanded, setExpanded] = useState(false);

  /* ── loading state ── */
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 280,
          color: T.mid,
          fontSize: 13,
          gap: 8,
          background: T.surface,
          borderRadius: 18,
          border: `1.5px solid ${T.borderLight}`,
        }}
      >
        <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>◌</span>
        Generating outfit…
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  /* ── empty state ── */
  if (!outfit || Object.values(outfit).every((v) => !v)) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 200,
          color: T.mid,
          fontSize: 13,
          flexDirection: "column",
          gap: 8,
          background: T.surface,
          borderRadius: 18,
          border: `1.5px solid ${T.borderLight}`,
        }}
      >
        <span style={{ fontSize: 28 }}>👔</span>
        <p>Select a day to see the outfit</p>
      </div>
    );
  }

  const { base, mid, outer, thermalBottom, bottom, shoes } = outfit;
  const hasCompanions = mid || outer;
  const hasLower      = thermalBottom || bottom || shoes;

  return (
    <>
      {/* ── Card ── */}
      <div
        onClick={() => setExpanded(true)}
        style={{
          background: T.surface,
          borderRadius: 18,
          border: `1.5px solid ${T.borderLight}`,
          padding: "18px 16px 14px",
          cursor: "pointer",
          transition: "border-color 0.2s",
          userSelect: "none",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = T.border)}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.borderLight)}
      >
        {/* ── Upper row: BASE hero + companion column ── */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
          {/* Hero: BASE */}
          {base && (
            <Slot
              layer="base"
              item={base}
              onSwap={onSwap ? () => onSwap("base") : null}
              width={160}
              height={180}
              usageStats={usageStats}
            />
          )}

          {/* Companion column: OUTER + MID (stacked) */}
          {hasCompanions && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, alignItems: "center", paddingTop: 4 }}>
              {outer && (
                <Slot
                  layer="outer"
                  item={outer}
                  onSwap={onSwap ? () => onSwap("outer") : null}
                  width={90}
                  height={90}
                  usageStats={usageStats}
                />
              )}
              {mid && (
                <Slot
                  layer="mid"
                  item={mid}
                  onSwap={onSwap ? () => onSwap("mid") : null}
                  width={90}
                  height={90}
                  usageStats={usageStats}
                />
              )}
            </div>
          )}
        </div>

        {/* ── Separator ── */}
        {hasLower && (
          <div style={{ height: 1, background: T.borderLight, margin: "0 0 14px" }} />
        )}

        {/* ── Lower row: THERMAL BOTTOM + BOTTOM + SHOES ── */}
        {hasLower && (
          <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
            {thermalBottom && (
              <Slot
                layer="thermalBottom"
                item={thermalBottom}
                onSwap={onSwap ? () => onSwap("thermalBottom") : null}
                width={100}
                height={100}
                usageStats={usageStats}
              />
            )}
            {bottom && (
              <Slot
                layer="bottom"
                item={bottom}
                onSwap={onSwap ? () => onSwap("bottom") : null}
                width={120}
                height={120}
                usageStats={usageStats}
              />
            )}
            {shoes && (
              <Slot
                layer="shoes"
                item={shoes}
                onSwap={onSwap ? () => onSwap("shoes") : null}
                width={120}
                height={120}
                usageStats={usageStats}
              />
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {onRegenerate && (
            <button
              onClick={(e) => { e.stopPropagation(); onRegenerate(); }}
              style={{
                flex: 1,
                padding: "9px 14px",
                background: "none",
                border: `1.5px solid ${T.border}`,
                borderRadius: 10,
                color: T.mid,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: 0.3,
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              ↺ Regenerate
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            style={{
              flex: 1,
              padding: "9px 14px",
              background: "none",
              border: `1.5px solid ${T.border}`,
              borderRadius: 10,
              color: T.mid,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: 0.3,
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
            }}
          >
            ⊞ Full outfit
          </button>
        </div>
      </div>

      {/* ── Expand Modal ── */}
      {expanded && (
        <OutfitExpandModal
          outfit={outfit}
          onSwap={onSwap}
          onRegenerate={onRegenerate}
          onClose={() => setExpanded(false)}
          usageStats={usageStats}
        />
      )}
    </>
  );
}
