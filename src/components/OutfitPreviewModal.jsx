/* ─── OutfitPreviewModal ──────────────────────────────────────────────────────
   Travel-style outfit preview modal.

   Props:
     day                 — TRIP day object
     slot                — "daytime" | "evening" | ...
     slotLabel           — display label e.g. "DAYTIME"
     slotIds             — { base, mid, outer, ... } item ID map
     wardrobe            — full wardrobe array
     imageUrl            — cached preview image URL or null
     isGenerating        — bool
     profilePhotos       — string[] base64 data URIs from useProfile
     onNavigateToProfile — () => void — navigates user to Profile tab
     onGenerate          — async () => void
     onRegenerate        — async () => void (clear + regenerate)
     onClose             — () => void
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect } from "react";
import { T, CAT_EMOJI, swatch } from "../theme";

/* ─── Mini outfit item thumbnail strip ───────────────────────────────────── */
function MiniThumb({ item }) {
  const [failed, setFailed] = useState(false);
  if (!item) return null;
  const img  = item.img || "";
  const name = item.n   || "";
  const [bg, accent] = swatch(item.col || "");
  const emoji = CAT_EMOJI[item.c] || "👕";
  const showImg = img && !failed;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <div style={{
        width: 52, height: 52, borderRadius: 10, overflow: "hidden", flexShrink: 0,
        background: showImg ? T.alt : `linear-gradient(145deg,${bg},${accent})`,
        border: `1px solid ${T.borderLight}`,
      }}>
        {showImg
          ? <img src={img} alt={name} onError={() => setFailed(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{emoji}</div>
        }
      </div>
      <p style={{ fontSize: 8, color: T.light, textAlign: "center", maxWidth: 52, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
        {name}
      </p>
    </div>
  );
}

/* ─── Reference photo status bar ─────────────────────────────────────────── */
function ProfilePhotoStatus({ count, onNavigateToProfile, onClose }) {
  const hasEnough = count >= 3;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 14px", marginBottom: 14,
      background: hasEnough ? "rgba(12,32,16,0.8)" : T.alt,
      border: `1px solid ${hasEnough ? "#166534" : T.borderLight}`,
      borderRadius: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex" }}>
          {count === 0
            ? <div style={{ width: 22, height: 22, borderRadius: "50%", background: T.alt, border: `1.5px dashed ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>+</div>
            : Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                <div key={i} style={{ width: 22, height: 22, borderRadius: "50%", background: T.border, border: `1.5px solid ${T.surface}`, marginLeft: i > 0 ? -6 : 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>👤</div>
              ))
          }
        </div>
        <p style={{ fontSize: 10, color: count === 0 ? T.mid : hasEnough ? T.green : "#FBBF24" }}>
          {count === 0
            ? "No reference photos · Generic AI look"
            : hasEnough
              ? `${count} photos · Gemini uses your face`
              : `${count} photo${count !== 1 ? "s" : ""} · Add ${3 - count} more for best results`}
        </p>
      </div>
      <button
        onClick={() => { onClose(); onNavigateToProfile?.(); }}
        style={{
          background: "none", border: `1px solid ${T.border}`,
          borderRadius: 8, padding: "3px 9px",
          fontSize: 9, color: T.mid, cursor: "pointer",
          fontFamily: "inherit", letterSpacing: 0.5, whiteSpace: "nowrap",
        }}
      >
        {count === 0 ? "+ Add photos" : "Manage"}
      </button>
    </div>
  );
}

/* ─── MAIN MODAL ──────────────────────────────────────────────────────────── */
export default function OutfitPreviewModal({
  day, slot, slotLabel, slotIds, wardrobe,
  imageUrl, isGenerating,
  usedFaceRef = null,   // true = Gemini used face photos, false = Imagen fallback, null = unknown
  profilePhotos = [],
  onNavigateToProfile,
  onGenerate, onRegenerate, onClose,
}) {
  const [error, setError] = useState(null);

  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  const outfitItems = ["base", "mid", "outer", "thermalBottom", "bottom", "shoes"]
    .map((k) => {
      const id = slotIds?.[k];
      if (!id || id === "REMOVED") return null;
      return wardrobe.find((i) => i.id === id) || null;
    })
    .filter(Boolean);

  const location = day.city.split("→")[0].trim();
  const activity = slot === "evening" ? day.night : day.day;

  async function handleGenerate(regen = false) {
    setError(null);
    try {
      if (regen) await onRegenerate();
      else       await onGenerate();
    } catch (err) {
      setError(err.message || "Generation failed");
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 1100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{
          background: T.surface, borderRadius: "22px 22px 0 0",
          width: "100%", maxWidth: 480, maxHeight: "94vh", overflowY: "auto",
          animation: "slideUp 0.22s ease-out", paddingBottom: 32,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "18px 20px 14px", borderBottom: `1px solid ${T.borderLight}`,
          position: "sticky", top: 0, background: T.surface, zIndex: 1,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 16 }}>{day.e}</span>
              <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 15, fontWeight: 700, color: T.text }}>{location}</span>
              <span style={{ fontSize: 9, color: T.light, letterSpacing: 1 }}>· {slotLabel}</span>
            </div>
            <p style={{ fontSize: 10, color: T.light, marginTop: 2 }}>{day.date}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: `1.5px solid ${T.border}`, borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", color: T.mid, fontSize: 14, cursor: "pointer" }}>✕</button>
        </div>

        {/* Outfit strip */}
        {outfitItems.length > 0 && (
          <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.borderLight}`, overflowX: "auto" }}>
            <p style={{ fontSize: 8, letterSpacing: 1.5, color: T.light, fontWeight: 700, marginBottom: 8 }}>OUTFIT</p>
            <div style={{ display: "flex", gap: 10 }}>
              {outfitItems.map((item, i) => <MiniThumb key={i} item={item} />)}
            </div>
          </div>
        )}

        <div style={{ padding: "16px 20px" }}>
          {/* Reference photo status */}
          <ProfilePhotoStatus count={profilePhotos.length} onNavigateToProfile={onNavigateToProfile} onClose={onClose} />

          {/* Preview image / loading / placeholder */}
          {isGenerating ? (
            <div style={{ width: "100%", height: 360, background: T.alt, borderRadius: 16, border: `1.5px solid ${T.borderLight}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
              <span style={{ fontSize: 32, animation: "spin 1.5s linear infinite", display: "inline-block" }}>✦</span>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>
                  {profilePhotos.length >= 1 ? "Generating with your face…" : "Generating preview…"}
                </p>
                <p style={{ fontSize: 10, color: T.light, marginTop: 4 }}>
                  {profilePhotos.length >= 1
                    ? "Gemini generating with your face · 30–60s"
                    : "Gemini generating travel look · 20–40s"}
                </p>
              </div>
            </div>
          ) : imageUrl ? (
            <div style={{ position: "relative" }}>
              <img src={imageUrl} alt={`${slotLabel} at ${location}`}
                style={{ width: "100%", borderRadius: 16, display: "block", border: `1.5px solid ${T.borderLight}` }} />
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: "24px 14px 12px",
                background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
                borderRadius: "0 0 16px 16px",
              }}>
                <p style={{ fontSize: 12, color: "#E8E6E1", fontWeight: 600 }}>{location}</p>
                {activity && <p style={{ fontSize: 10, color: "rgba(232,230,225,0.7)", marginTop: 2 }}>{activity}</p>}
                {usedFaceRef === true && (
                  <p style={{ fontSize: 8, color: "rgba(74,222,128,0.8)", marginTop: 3, letterSpacing: 0.5 }}>✓ Generated with your reference photos</p>
                )}
                {usedFaceRef === false && (
                  <p style={{ fontSize: 8, color: "rgba(251,191,36,0.8)", marginTop: 3, letterSpacing: 0.5 }}>⚠ Generic AI look · Gemini quota reached</p>
                )}
              </div>
            </div>
          ) : (
            <div style={{ width: "100%", height: 300, background: T.alt, borderRadius: 16, border: `1.5px dashed ${T.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <div style={{ fontSize: 36 }}>📸</div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 13, color: T.mid, fontWeight: 600 }}>No preview yet</p>
                <p style={{ fontSize: 10, color: T.light, marginTop: 4, maxWidth: 220, textAlign: "center" }}>
                  {profilePhotos.length >= 1
                    ? `Generate a travel photo of you in this outfit at ${location}`
                    : `Upload reference photos in Profile for a personalised preview`}
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ marginTop: 10, background: "#2D0A0A", border: "1.5px solid #7F1D1D", borderRadius: 10, padding: "10px 14px", fontSize: 11, color: "#FCA5A5", lineHeight: 1.5 }}>
              ⚠ {error}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ padding: "0 20px", display: "flex", gap: 10 }}>
          {imageUrl && !isGenerating && (
            <button onClick={() => handleGenerate(true)} style={{ flex: 1, padding: "11px", background: "none", border: `1.5px solid ${T.border}`, borderRadius: 12, fontSize: 12, color: T.mid, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
              ↺ Regenerate
            </button>
          )}
          {!imageUrl && !isGenerating && (
            <button onClick={() => handleGenerate(false)} style={{ flex: 2, padding: "13px", cursor: "pointer", borderRadius: 14, border: "1.5px solid transparent", background: "linear-gradient(135deg,#1a1a2e,#0f3460)", color: T.text, fontSize: 13, fontWeight: 700, letterSpacing: 0.5, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 20px rgba(15,52,96,0.5)" }}>
              ✦ Preview Me Here
            </button>
          )}
          <button onClick={onClose} style={{ flex: 0, padding: "11px", minWidth: 70, background: "none", border: `1.5px solid ${T.border}`, borderRadius: 12, fontSize: 12, color: T.mid, cursor: "pointer", fontFamily: "inherit" }}>
            Close
          </button>
        </div>

        <p style={{ fontSize: 9, color: T.light, textAlign: "center", marginTop: 12, padding: "0 20px", lineHeight: 1.5 }}>
          AI-generated travel preview · Gemini multimodal · Stylised approximation
        </p>
      </div>
    </div>
  );
}
