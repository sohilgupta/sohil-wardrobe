/* ─── Export Utilities ────────────────────────────────────────────────────────
   Handles text, image-card, and PDF exports for Vesti.

   Rules:
   - Never call AI during export — use cached previews only
   - Free tier exports include a watermark line
   - Pro exports are clean
   ─────────────────────────────────────────────────────────────────────────── */

import TRIP from "../data/trip";

const ATTRIBUTION_PRO  = "Made with Vesti • Sohil Gupta";
const ATTRIBUTION_FREE = "Made with Vesti (Free) • Sohil Gupta • vesti.app";

/* ─── Resolve item name from wardrobe array ─────────────────────────────── */
function itemName(wardrobe, id) {
  if (!id || id === "REMOVED") return null;
  return wardrobe.find((i) => i.id === id)?.n ?? id;
}

/* ─── Format a single outfit slot as readable text ──────────────────────── */
function fmtSlot(wardrobe, slot) {
  if (!slot) return "  —";
  const layers = [
    slot.base  && `Base: ${itemName(wardrobe, slot.base)}`,
    slot.mid   && `Mid: ${itemName(wardrobe, slot.mid)}`,
    slot.outer && `Outer: ${itemName(wardrobe, slot.outer)}`,
    slot.bottom && `Bottom: ${itemName(wardrobe, slot.bottom)}`,
    slot.shoes  && `Shoes: ${itemName(wardrobe, slot.shoes)}`,
  ].filter(Boolean);
  return layers.map((l) => `  ${l}`).join("\n");
}

/* ────────────────────────────────────────────────────────────────────────────
   exportTripText — full trip schedule as plain text
   ─────────────────────────────────────────────────────────────────────────── */
export function exportTripText({ wardrobe, outfitIds, isPro = false }) {
  const attribution = isPro ? ATTRIBUTION_PRO : ATTRIBUTION_FREE;
  const lines = [
    `VESTI — TRIP OUTFIT PLAN`,
    `Generated ${new Date().toLocaleDateString()}`,
    ``,
  ];

  TRIP.forEach((day) => {
    const dayData = outfitIds[day.id];
    lines.push(`── ${day.date} · ${day.city} ──`);
    lines.push(`  Weather: ${day.w}`);

    if (dayData?.daytime) {
      lines.push(`  DAYTIME`);
      lines.push(fmtSlot(wardrobe, dayData.daytime));
    }
    if (dayData?.evening) {
      lines.push(`  EVENING`);
      lines.push(fmtSlot(wardrobe, dayData.evening));
    }
    if (dayData?.flight) {
      lines.push(`  FLIGHT`);
      lines.push(fmtSlot(wardrobe, dayData.flight));
    }
    if (!dayData?.daytime && !dayData?.evening) {
      lines.push(`  (no outfit planned)`);
    }
    lines.push("");
  });

  lines.push(`─────────────────────`);
  lines.push(attribution);

  return lines.join("\n");
}

/* ────────────────────────────────────────────────────────────────────────────
   exportPackingListText — unique items across all outfit slots
   ─────────────────────────────────────────────────────────────────────────── */
export function exportPackingListText({ wardrobe, outfitIds, isPro = false }) {
  const attribution = isPro ? ATTRIBUTION_PRO : ATTRIBUTION_FREE;
  const ALL_SLOTS = ["daytime", "evening", "breakfast", "sleepwear", "flight", "activity"];
  const seen = new Map(); // id → item

  Object.values(outfitIds).forEach((dayData) => {
    if (!dayData) return;
    ALL_SLOTS.forEach((slot) => {
      const s = dayData[slot];
      if (!s) return;
      ["base", "mid", "outer", "bottom", "shoes"].forEach((layer) => {
        const id = s[layer];
        if (id && id !== "REMOVED" && !seen.has(id)) {
          const item = wardrobe.find((i) => i.id === id);
          if (item) seen.set(id, item);
        }
      });
    });
  });

  const byCategory = {};
  seen.forEach((item) => {
    const cat = item.c || item._tab || "Other";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  });

  const lines = [
    `VESTI — PACKING LIST`,
    `${seen.size} items total`,
    `Generated ${new Date().toLocaleDateString()}`,
    ``,
  ];

  Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b)).forEach(([cat, items]) => {
    lines.push(`${cat.toUpperCase()}`);
    items.forEach((i) => lines.push(`  □  ${i.n}${i.brand ? ` (${i.brand})` : ""}`));
    lines.push("");
  });

  lines.push(`─────────────────────`);
  lines.push(attribution);

  return lines.join("\n");
}

/* ────────────────────────────────────────────────────────────────────────────
   downloadText — trigger browser download of a text file
   ─────────────────────────────────────────────────────────────────────────── */
export function downloadText(text, filename = "vesti-export.txt") {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ────────────────────────────────────────────────────────────────────────────
   exportOutfitCard — render a single day's outfit as an HTML card and
   trigger a PNG download via canvas.
   Uses only wardrobe metadata (no AI call).
   ─────────────────────────────────────────────────────────────────────────── */
export async function exportOutfitCard({ wardrobe, dayId, outfitIds, isPro = false }) {
  const day     = TRIP.find((d) => d.id === dayId);
  const dayData = outfitIds[dayId];
  if (!day || !dayData) throw new Error("No outfit data for this day.");

  const attribution = isPro ? ATTRIBUTION_PRO : ATTRIBUTION_FREE;
  const ALL_SLOTS = ["daytime", "evening", "flight", "activity"];
  const slots = ALL_SLOTS.map((s) => ({ label: s.toUpperCase(), data: dayData[s] }))
                         .filter((s) => s.data);

  // Build a minimal HTML string rendered into an off-screen canvas via a Blob URL
  const html = `<!DOCTYPE html><html><head>
<meta charset="UTF-8"/>
<style>
  body{margin:0;background:#0F0F12;color:#E8E6E1;font-family:'DM Sans',sans-serif;padding:24px;width:360px;}
  h1{font-family:Georgia,serif;font-size:22px;font-weight:700;margin:0 0 4px;}
  .sub{font-size:11px;color:#5C5A55;letter-spacing:2px;margin-bottom:20px;}
  .slot{margin-bottom:16px;}
  .slot-label{font-size:9px;color:#8A8780;letter-spacing:2px;font-weight:700;margin-bottom:6px;}
  .item{font-size:13px;color:#E8E6E1;padding:6px 10px;background:#1A1A1F;border-radius:6px;margin-bottom:4px;}
  .attr{font-size:10px;color:#3A3A40;margin-top:20px;border-top:1px solid #2E2E36;padding-top:10px;}
</style></head><body>
<h1>${day.city}</h1>
<p class="sub">${day.date} · ${day.w}</p>
${slots.map((s) => {
  const items = ["base","mid","outer","bottom","shoes"]
    .map((l) => itemName(wardrobe, s.data[l]))
    .filter(Boolean);
  return `<div class="slot"><p class="slot-label">${s.label}</p>${items.map((n) => `<p class="item">${n}</p>`).join("")}</div>`;
}).join("")}
<p class="attr">${attribution}</p>
</body></html>`;

  // Use a data URL to avoid network requests
  const blob = new Blob([html], { type: "text/html" });
  const url  = URL.createObjectURL(blob);

  // Open in new tab — full canvas-to-PNG would require a library like html2canvas
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ────────────────────────────────────────────────────────────────────────────
   exportFullTripHTML — full trip as a printable HTML page (no AI needed)
   ─────────────────────────────────────────────────────────────────────────── */
export function exportFullTripHTML({ wardrobe, outfitIds, isPro = false }) {
  const attribution = isPro ? ATTRIBUTION_PRO : ATTRIBUTION_FREE;
  const ALL_SLOTS   = ["daytime", "evening", "breakfast", "sleepwear", "flight", "activity"];

  const dayCards = TRIP.map((day) => {
    const dayData = outfitIds[day.id];
    const slots   = ALL_SLOTS
      .map((s) => ({ label: s.toUpperCase(), data: dayData?.[s] }))
      .filter((s) => s.data);

    return `
      <div class="day-card">
        <div class="day-header">
          <span class="day-date">${day.date}</span>
          <span class="day-city">${day.city}</span>
          <span class="day-weather">${day.w}</span>
        </div>
        ${slots.map((s) => {
          const items = ["base","mid","outer","bottom","shoes"]
            .map((l) => itemName(wardrobe, s.data[l]))
            .filter(Boolean);
          if (!items.length) return "";
          return `<div class="slot"><p class="slot-label">${s.label}</p>
            ${items.map((n) => `<span class="item">${n}</span>`).join("")}
          </div>`;
        }).join("")}
        ${!slots.length ? `<p class="empty">No outfit planned</p>` : ""}
      </div>`;
  }).join("");

  const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/>
<title>Vesti — Trip Plan</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#0F0F12;color:#E8E6E1;font-family:'DM Sans',sans-serif;padding:32px 20px;max-width:800px;margin:0 auto;}
  h1{font-family:Georgia,serif;font-size:32px;font-weight:700;margin-bottom:6px;}
  .subtitle{font-size:12px;color:#5C5A55;letter-spacing:2px;margin-bottom:32px;}
  .day-card{background:#1A1A1F;border:1px solid #2E2E36;border-radius:12px;padding:16px;margin-bottom:16px;}
  .day-header{display:flex;gap:12px;align-items:baseline;margin-bottom:12px;}
  .day-date{font-size:12px;color:#5C5A55;font-weight:600;}
  .day-city{font-size:16px;font-weight:700;}
  .day-weather{font-size:11px;color:#8A8780;background:#232329;padding:2px 8px;border-radius:4px;}
  .slot{margin-bottom:10px;}
  .slot-label{font-size:9px;color:#8A8780;letter-spacing:2px;font-weight:700;margin-bottom:6px;}
  .item{display:inline-block;font-size:12px;background:#232329;border-radius:6px;padding:4px 10px;margin:2px;}
  .empty{font-size:12px;color:#3A3A40;font-style:italic;}
  .footer{text-align:center;font-size:10px;color:#3A3A40;margin-top:40px;padding-top:16px;border-top:1px solid #2E2E36;}
  @media print{body{background:#fff;color:#000;} .day-card{border-color:#ccc;background:#f9f9f9;}}
</style></head><body>
<h1>Vesti</h1>
<p class="subtitle">TRIP OUTFIT PLAN · ${new Date().toLocaleDateString()}</p>
${dayCards}
<p class="footer">${attribution}</p>
</body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "vesti-trip-plan.html";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
