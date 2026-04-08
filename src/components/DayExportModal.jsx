/* ─── DayExportModal — Single-day outfit export ──────────────────────────────
   Exports one day's outfits as:
     • Text  (.txt download + clipboard copy)
     • Image Card  (Canvas PNG, 640px)
     • PDF  (print window)
   Client-side only. No AI calls. Read-only.
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect } from "react";
import { T, swatch, CAT_EMOJI } from "../theme";
import { buildPreviewKey } from "../hooks/usePreview";
import { loadImg } from "../utils/canvasUtils";

const SLOT_ORDER = ["daytime", "evening", "breakfast", "flight", "activity", "sleepwear"];
const SLOT_META  = {
  daytime:   { icon: "☀️", label: "DAYTIME" },
  evening:   { icon: "🌙", label: "EVENING" },
  breakfast: { icon: "☕", label: "BREAKFAST" },
  sleepwear: { icon: "😴", label: "SLEEPWEAR" },
  flight:    { icon: "✈️", label: "FLIGHT" },
  activity:  { icon: "🏃", label: "ACTIVITY" },
};
const LAYERS = ["base", "mid", "outer", "thermalBottom", "bottom", "shoes"];

/* ── Helpers ── */
function resolveItems(slotIds, wardrobe) {
  if (!slotIds) return [];
  return LAYERS
    .map((k) => {
      const id = slotIds[k];
      if (!id || id === "REMOVED") return null;
      return wardrobe.find((i) => i.id === id) || null;
    })
    .filter(Boolean);
}

function activeSlots(dayData, wardrobe) {
  return SLOT_ORDER
    .map((slot) => {
      const slotIds = dayData?.[slot];
      if (slotIds === null || slotIds === undefined) return null;
      const items = resolveItems(slotIds, wardrobe);
      if (items.length === 0) return null;
      return { slot, slotIds, items };
    })
    .filter(Boolean);
}

function buildText(day, dayData, wardrobe) {
  const city = day.city.split("→")[0].trim();
  const lines = [`${day.date} — ${city}`, `Weather: ${day.w}`];
  if (day.day)   lines.push(`Day: ${day.day}`);
  if (day.night) lines.push(`Night: ${day.night}`);
  lines.push("");

  for (const { slot, items } of activeSlots(dayData, wardrobe)) {
    const m = SLOT_META[slot];
    lines.push(`${m.icon}  ${m.label}`);
    items.forEach((item) => {
      lines.push(`  • ${item.n}${item.b ? ` (${item.b})` : ""}`);
    });
    lines.push("");
  }
  return lines.join("\n").trim();
}

/* ── Rounded rect helper ── */
function roundRectClip(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ── Canvas PNG generation ── */
async function generateCanvas(day, dayData, wardrobe, previewCache) {
  const slots = activeSlots(dayData, wardrobe);
  if (slots.length === 0) return null;

  const W       = 640;
  const PAD     = 28;
  const ISIZE   = 76;
  const IGAP    = 12;
  const HERO_H  = 240;

  // Pre-load all images in parallel
  const itemImgMap = {};
  const heroImgMap = {};

  await Promise.all([
    ...slots.flatMap(({ items }) =>
      items.map(async (item) => {
        if (item.img) itemImgMap[item.id] = await loadImg(item.img);
      })
    ),
    ...slots.map(async ({ slot, slotIds }) => {
      const pKey = buildPreviewKey(day.id, slot, slotIds);
      const cached = previewCache?.[pKey];
      const heroUrl = cached?.url || cached || null;  // handles both { url } and legacy string
      if (heroUrl) heroImgMap[slot] = await loadImg(heroUrl);
    }),
  ]);

  // Calculate height
  let totalH = 90; // header
  for (const { slot, items } of slots) {
    totalH += 30; // slot label + divider
    if (heroImgMap[slot]) totalH += HERO_H + 14;
    else {
      const rows = Math.ceil(items.length / Math.floor((W - PAD * 2) / (ISIZE + IGAP)));
      totalH += rows * (ISIZE + 18) + 8;
    }
    totalH += 14; // slot gap
  }
  totalH += PAD;

  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = totalH;
  const ctx = canvas.getContext("2d");

  /* ── Background ── */
  ctx.fillStyle = "#0F0F12";
  ctx.fillRect(0, 0, W, totalH);

  /* ── Header band ── */
  ctx.fillStyle = "#17171D";
  ctx.fillRect(0, 0, W, 80);
  ctx.strokeStyle = "#252530";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 80); ctx.lineTo(W, 80); ctx.stroke();

  const city = day.city.split("→")[0].trim();
  ctx.fillStyle = "#E8E6E1";
  ctx.font = "bold 22px 'Georgia', serif";
  ctx.fillText(city, PAD, 34);

  ctx.fillStyle = "#666";
  ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(day.date, PAD, 54);

  const meta = [day.day, day.night].filter(Boolean).join(" · ");
  if (meta) {
    ctx.fillStyle = "#555";
    ctx.font = "10px -apple-system, sans-serif";
    ctx.fillText(meta.slice(0, 64), PAD, 70);
  }

  // Weather chip (top-right)
  const chipW = 70;
  ctx.fillStyle = "#252530";
  roundRectClip(ctx, W - PAD - chipW, 24, chipW, 22, 6);
  ctx.fill();
  ctx.fillStyle = "#888";
  ctx.font = "10px -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(day.w, W - PAD - chipW / 2, 39);
  ctx.textAlign = "left";

  /* ── Slots ── */
  let y = 90;

  for (const { slot, items } of slots) {
    const m = SLOT_META[slot];
    const heroImg = heroImgMap[slot];

    // Slot label
    ctx.fillStyle = "#444";
    ctx.font = "bold 9px -apple-system, sans-serif";
    ctx.fillText(m.label, PAD, y + 13);
    ctx.strokeStyle = "#252530";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD, y + 19); ctx.lineTo(W - PAD, y + 19); ctx.stroke();
    y += 28;

    if (heroImg) {
      /* Hero preview image */
      ctx.save();
      roundRectClip(ctx, PAD, y, W - PAD * 2, HERO_H, 12);
      ctx.clip();
      ctx.drawImage(heroImg, PAD, y, W - PAD * 2, HERO_H);
      ctx.restore();

      // Gradient overlay at bottom
      const grad = ctx.createLinearGradient(0, y + HERO_H - 60, 0, y + HERO_H);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.7)");
      ctx.save();
      roundRectClip(ctx, PAD, y, W - PAD * 2, HERO_H, 12);
      ctx.clip();
      ctx.fillStyle = grad;
      ctx.fillRect(PAD, y, W - PAD * 2, HERO_H);
      ctx.restore();

      y += HERO_H + 14;
    } else {
      /* Item grid */
      let x = PAD;
      for (const item of items) {
        if (x + ISIZE > W - PAD) { x = PAD; y += ISIZE + 18; }

        const imgEl = itemImgMap[item.id];
        const [bg, accent] = swatch(item.col || "");

        ctx.save();
        roundRectClip(ctx, x, y, ISIZE, ISIZE, 10);
        ctx.clip();
        if (imgEl) {
          ctx.fillStyle = "#1A1A22";
          ctx.fillRect(x, y, ISIZE, ISIZE);
          ctx.drawImage(imgEl, x, y, ISIZE, ISIZE);
        } else {
          const grd = ctx.createLinearGradient(x, y, x + ISIZE, y + ISIZE);
          grd.addColorStop(0, bg);
          grd.addColorStop(1, accent);
          ctx.fillStyle = grd;
          ctx.fillRect(x, y, ISIZE, ISIZE);
        }
        ctx.restore();

        // Item name
        ctx.fillStyle = "#777";
        ctx.font = "8px -apple-system, sans-serif";
        const nm = item.n.length > 11 ? item.n.slice(0, 11) + "…" : item.n;
        ctx.textAlign = "center";
        ctx.fillText(nm, x + ISIZE / 2, y + ISIZE + 12);
        ctx.textAlign = "left";

        x += ISIZE + IGAP;
      }
      y += ISIZE + 18 + 8;
    }

    y += 14; // slot gap
  }

  // Footer
  ctx.fillStyle = "#333";
  ctx.font = "9px -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("SOHIL-WARDROBE · AUS·NZ 2026", W / 2, totalH - 10);

  return canvas;
}

/* ─── PDF HTML builder ── */
function openPDF(day, dayData, wardrobe) {
  const city = day.city.split("→")[0].trim();
  const slots = activeSlots(dayData, wardrobe);

  const slotsHtml = slots.map(({ slot, items }) => {
    const m = SLOT_META[slot];
    const itemsHtml = items.map((item) => `
      <div class="item">
        ${item.img
          ? `<img src="${item.img}" alt="${item.n}" onerror="this.style.display='none'" />`
          : `<div class="swatch"></div>`
        }
        <div class="name">${item.n}</div>
        ${item.b ? `<div class="brand">${item.b}</div>` : ""}
      </div>`).join("");
    return `
      <div class="slot">
        <div class="slot-label">${m.icon} ${m.label}</div>
        <div class="items-row">${itemsHtml}</div>
      </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${day.date} — ${city}</title>
<style>
  body{font-family:Georgia,serif;background:#fff;color:#111;padding:32px;max-width:680px;margin:0 auto}
  h1{font-size:28px;margin:0 0 4px;letter-spacing:-0.5px}
  .meta{color:#888;font-size:13px;margin-bottom:8px}
  .chips{display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap}
  .chip{background:#f3f4f6;border-radius:20px;padding:3px 12px;font-size:11px;color:#555}
  .slot{margin-bottom:22px;border-top:1px solid #e5e7eb;padding-top:14px}
  .slot-label{font-size:10px;font-weight:700;letter-spacing:2px;color:#999;margin-bottom:12px}
  .items-row{display:flex;gap:12px;flex-wrap:wrap}
  .item{text-align:center;width:88px}
  .item img{width:88px;height:88px;object-fit:cover;border-radius:10px;display:block;border:1px solid #e5e7eb}
  .swatch{width:88px;height:88px;background:#e5e7eb;border-radius:10px}
  .name{font-size:9px;color:#555;margin-top:4px;word-break:break-word;line-height:1.3}
  .brand{font-size:8px;color:#aaa}
  .footer{font-size:8px;color:#ccc;margin-top:28px;text-align:center;letter-spacing:1px}
  @media print{body{padding:16px}}
</style>
</head><body>
  <h1>${city}</h1>
  <div class="meta">${day.date}</div>
  <div class="chips">
    <span class="chip">${day.w}</span>
    ${day.day   ? `<span class="chip">${day.day}</span>`   : ""}
    ${day.night ? `<span class="chip">${day.night}</span>` : ""}
  </div>
  ${slotsHtml}
  <p class="footer">SOHIL-WARDROBE · AUS·NZ 2026</p>
</body></html>`;

  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 600);
}

/* ─── MODAL ── */
export default function DayExportModal({ day, dayData, wardrobe, previewCache, onClose }) {
  const [format,    setFormat]    = useState(null); // null | "text" | "image" | "pdf"
  const [exporting, setExporting] = useState(false);
  const [copied,    setCopied]    = useState(false);

  const city        = day.city.split("→")[0].trim();
  const textContent = buildText(day, dayData, wardrobe);
  const hasAnyData  = activeSlots(dayData, wardrobe).length > 0;

  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  }

  function handleDownloadText() {
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${day.date.replace(/\s/g, "_")}_${city}_outfits.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleDownloadPNG() {
    setExporting(true);
    try {
      const canvas = await generateCanvas(day, dayData, wardrobe, previewCache);
      if (!canvas) return;
      const url = canvas.toDataURL("image/png");
      const a   = document.createElement("a");
      a.href    = url;
      a.download = `${day.date.replace(/\s/g, "_")}_${city}_outfit_card.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setExporting(false);
    }
  }

  /* Shared back button style */
  const backBtn = {
    background: "none", border: "none", color: T.mid, fontSize: 11,
    cursor: "pointer", fontFamily: "inherit", padding: 0,
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 1200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{
          background: T.surface, borderRadius: "20px 20px 0 0",
          width: "100%", maxWidth: 480, paddingBottom: 32,
          animation: "slideUp 0.22s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "18px 20px 14px", borderBottom: `1px solid ${T.borderLight}`,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 16 }}>{day.e}</span>
              <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 15, fontWeight: 700, color: T.text }}>{city}</span>
            </div>
            <p style={{ fontSize: 10, color: T.light, marginTop: 2 }}>{day.date} · Export Day</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: `1.5px solid ${T.border}`, borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", color: T.mid, fontSize: 14, cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "16px 20px" }}>

          {/* No outfit yet */}
          {!hasAnyData && (
            <div style={{ textAlign: "center", padding: "28px 0", color: T.light, fontSize: 12 }}>
              No outfits planned for this day yet.
            </div>
          )}

          {/* Format picker */}
          {hasAnyData && !format && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: T.light, marginBottom: 4 }}>EXPORT FORMAT</p>
              {[
                { id: "text",  icon: "📄", title: "Export as Text",       desc: "Structured itinerary · copy or download .txt" },
                { id: "image", icon: "🖼",  title: "Export as Image Card", desc: "Styled PNG card with outfit photos · 640px" },
                { id: "pdf",   icon: "📑", title: "Export as PDF",        desc: "Printable single-page layout · open in browser" },
              ].map(({ id, icon, title, desc }) => (
                <button
                  key={id}
                  onClick={() => setFormat(id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 16px", borderRadius: 14,
                    background: T.alt, border: `1.5px solid ${T.borderLight}`,
                    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    transition: "border-color 0.15s", width: "100%",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = T.border)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.borderLight)}
                >
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 2 }}>{title}</p>
                    <p style={{ fontSize: 10, color: T.light }}>{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Text panel */}
          {format === "text" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <button onClick={() => setFormat(null)} style={backBtn}>← Back</button>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: T.light }}>TEXT EXPORT</p>
              </div>
              <pre style={{
                background: T.alt, border: `1px solid ${T.borderLight}`,
                borderRadius: 12, padding: "12px 14px",
                fontSize: 11, color: T.mid, lineHeight: 1.7,
                whiteSpace: "pre-wrap", maxHeight: 260, overflowY: "auto",
                fontFamily: "monospace", margin: "0 0 12px",
              }}>{textContent}</pre>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleCopy}
                  style={{
                    flex: 1, padding: "11px", borderRadius: 12,
                    border: `1.5px solid ${copied ? "#4ADE80" : T.border}`,
                    background: copied ? "#0C2010" : "none",
                    color: copied ? "#4ADE80" : T.mid,
                    fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    transition: "all 0.2s",
                  }}
                >
                  {copied ? "✓ Copied!" : "Copy to Clipboard"}
                </button>
                <button
                  onClick={handleDownloadText}
                  style={{
                    flex: 1, padding: "11px", borderRadius: 12,
                    border: "1.5px solid transparent",
                    background: "linear-gradient(135deg,#1a1a2e,#0f3460)",
                    color: T.text, fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  ⬇ Download .txt
                </button>
              </div>
            </div>
          )}

          {/* Image panel */}
          {format === "image" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <button onClick={() => setFormat(null)} style={backBtn}>← Back</button>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: T.light }}>IMAGE CARD</p>
              </div>
              <div style={{
                background: T.alt, border: `1px solid ${T.borderLight}`,
                borderRadius: 12, padding: "16px", textAlign: "center", marginBottom: 14,
              }}>
                <p style={{ fontSize: 13, color: T.mid, marginBottom: 4 }}>640px PNG outfit card</p>
                <p style={{ fontSize: 10, color: T.light, lineHeight: 1.5 }}>
                  Shows outfit item photos per slot.<br />
                  Uses AI preview as hero image where available.
                </p>
              </div>
              <button
                onClick={handleDownloadPNG}
                disabled={exporting}
                style={{
                  width: "100%", padding: "13px", borderRadius: 14,
                  border: "1.5px solid transparent",
                  background: exporting ? T.alt : "linear-gradient(135deg,#1a1a2e,#0f3460)",
                  color: exporting ? T.light : T.text,
                  fontSize: 13, fontWeight: 700,
                  cursor: exporting ? "wait" : "pointer",
                  fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "all 0.2s",
                }}
              >
                {exporting
                  ? <><span style={{ animation: "spin 1.2s linear infinite", display: "inline-block" }}>◌</span> Building card…</>
                  : "⬇ Download PNG"}
              </button>
            </div>
          )}

          {/* PDF panel */}
          {format === "pdf" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <button onClick={() => setFormat(null)} style={backBtn}>← Back</button>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: T.light }}>PDF EXPORT</p>
              </div>
              <div style={{
                background: T.alt, border: `1px solid ${T.borderLight}`,
                borderRadius: 12, padding: "16px", textAlign: "center", marginBottom: 14,
              }}>
                <p style={{ fontSize: 13, color: T.mid, marginBottom: 4 }}>Opens a print-ready page</p>
                <p style={{ fontSize: 10, color: T.light, lineHeight: 1.5 }}>
                  Use your browser's print dialog →<br />
                  <strong style={{ color: T.mid }}>Save as PDF</strong>
                </p>
              </div>
              <button
                onClick={() => openPDF(day, dayData, wardrobe)}
                style={{
                  width: "100%", padding: "13px", borderRadius: 14,
                  border: "1.5px solid transparent",
                  background: "linear-gradient(135deg,#1a1a2e,#0f3460)",
                  color: T.text, fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                📑 Open PDF Preview
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
