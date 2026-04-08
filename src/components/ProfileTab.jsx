/* ─── ProfileTab — Reference photos for outfit preview generation ─────────────
   Upload up to 5 face reference photos.
   Photos are compressed client-side and stored in localStorage.
   They are sent to /api/preview when generating outfit previews,
   enabling PhotoMaker to condition the generated image on your face.
   ─────────────────────────────────────────────────────────────────────────── */

import { useRef } from "react";
import { T } from "../theme";

export default function ProfileTab({ photos, onAdd, onRemove, onClearAll, maxPhotos }) {
  const inputRef = useRef(null);

  function handleFiles(files) {
    const remaining = maxPhotos - photos.length;
    Array.from(files).slice(0, remaining).forEach((f) => onAdd(f));
  }

  function handleInputChange(e) {
    handleFiles(e.target.files);
    e.target.value = ""; // reset so same file can be re-selected
  }

  function handleDrop(e) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  const canAdd = photos.length < maxPhotos;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{
          fontFamily: "'Cormorant Garamond',serif",
          fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: -0.3, marginBottom: 4,
        }}>
          Profile · Avatar
        </h2>
        <p style={{ fontSize: 11, color: T.mid }}>
          Upload 3–5 clear face photos. These are used by AI to generate outfit previews with your likeness.
        </p>
      </div>

      {/* Tips card */}
      <div style={{
        background: T.alt, border: `1px solid ${T.borderLight}`,
        borderRadius: 14, padding: "14px 16px", marginBottom: 20,
      }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: T.light, letterSpacing: 1.5, marginBottom: 8 }}>
          BEST RESULTS
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {[
            "Use photos where your face is clearly visible",
            "Include a mix: front-facing, slight angles",
            "Good lighting — avoid heavy shadows or filters",
            "At least 1 full-body or upper-body shot works best",
          ].map((tip, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 9, color: T.green, flexShrink: 0, marginTop: 1 }}>✓</span>
              <p style={{ fontSize: 10, color: T.mid, lineHeight: 1.5 }}>{tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Upload area */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleInputChange}
        style={{ display: "none" }}
      />

      {canAdd && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          style={{
            border: `1.5px dashed ${T.border}`,
            borderRadius: 16, padding: "28px 20px",
            textAlign: "center", cursor: "pointer",
            background: T.alt, marginBottom: 20,
            transition: "border-color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = T.text)}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.border)}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.mid, marginBottom: 4 }}>
            Upload reference photos
          </p>
          <p style={{ fontSize: 10, color: T.light }}>
            Click or drag &amp; drop · Up to {maxPhotos - photos.length} more
          </p>
          <p style={{ fontSize: 9, color: T.light, marginTop: 6, letterSpacing: 0.5 }}>
            JPEG / PNG · Compressed automatically · Stored locally
          </p>
        </div>
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 12,
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: T.light, letterSpacing: 1.5 }}>
              REFERENCE PHOTOS · {photos.length}/{maxPhotos}
            </p>
            <button
              onClick={onClearAll}
              style={{
                background: "none", border: "none",
                fontSize: 9, color: T.light, cursor: "pointer",
                fontFamily: "inherit", letterSpacing: 0.5,
                padding: "3px 8px", borderRadius: 6,
              }}
            >
              Clear all
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {photos.map((dataUrl, i) => (
              <div key={i} style={{ position: "relative", aspectRatio: "1/1" }}>
                <img
                  src={dataUrl}
                  alt={`Reference ${i + 1}`}
                  style={{
                    width: "100%", height: "100%",
                    objectFit: "cover", borderRadius: 12,
                    border: `1.5px solid ${T.borderLight}`,
                    display: "block",
                  }}
                />
                {/* Delete button */}
                <button
                  onClick={() => onRemove(i)}
                  title="Remove photo"
                  style={{
                    position: "absolute", top: 6, right: 6,
                    width: 24, height: 24, borderRadius: "50%",
                    background: "rgba(15,15,18,0.85)",
                    border: `1px solid ${T.border}`,
                    color: T.mid, fontSize: 10,
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  ✕
                </button>
                {/* Index badge */}
                <div style={{
                  position: "absolute", bottom: 6, left: 6,
                  fontSize: 8, fontWeight: 700, letterSpacing: 0.5,
                  color: "rgba(232,230,225,0.8)",
                  background: "rgba(15,15,18,0.75)",
                  padding: "2px 6px", borderRadius: 6,
                  backdropFilter: "blur(4px)",
                }}>
                  {i + 1}
                </div>
              </div>
            ))}

            {/* "Add more" cell when not at max */}
            {canAdd && (
              <div
                onClick={() => inputRef.current?.click()}
                style={{
                  aspectRatio: "1/1", borderRadius: 12,
                  border: `1.5px dashed ${T.borderLight}`,
                  background: T.alt, cursor: "pointer",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 4,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = T.border)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.borderLight)}
              >
                <span style={{ fontSize: 20 }}>+</span>
                <span style={{ fontSize: 8, color: T.light }}>ADD</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status banner */}
      <div style={{
        background: photos.length >= 3 ? "#0C2010" : T.alt,
        border: `1px solid ${photos.length >= 3 ? "#166534" : T.borderLight}`,
        borderRadius: 12, padding: "12px 16px",
      }}>
        {photos.length === 0 && (
          <p style={{ fontSize: 11, color: T.light }}>
            📸 No photos uploaded yet. Outfit previews will use a generic AI-generated look without your face.
          </p>
        )}
        {photos.length > 0 && photos.length < 3 && (
          <p style={{ fontSize: 11, color: "#FBBF24" }}>
            ⚡ {photos.length} photo{photos.length !== 1 ? "s" : ""} uploaded — add at least 3 for better face accuracy.
          </p>
        )}
        {photos.length >= 3 && (
          <p style={{ fontSize: 11, color: T.green }}>
            ✓ {photos.length} reference photos ready — outfit previews will be generated with your likeness.
          </p>
        )}
      </div>

      {/* Privacy note */}
      <p style={{
        fontSize: 9, color: T.light, textAlign: "center",
        marginTop: 16, lineHeight: 1.6, letterSpacing: 0.3,
      }}>
        Photos stored locally and synced via Upstash KV · Compressed to ≤768px ·
        Sent to Gemini only when generating a preview · Never stored on third-party servers
      </p>
    </div>
  );
}
