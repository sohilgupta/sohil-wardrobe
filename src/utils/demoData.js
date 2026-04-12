// src/utils/demoData.js
import SEED_TRIP from "../data/trip";

export const DEMO_TRIP_ID = "trip_aus_nz_2026";

export const DEMO_ITEMS = [
  // Base layers (3)
  { id: "demo_base_01", n: "White Linen Shirt",       c: "Shirts",   col: "White",     b: "Demo", l: "Base",     occ: "Casual", w: "Warm", t: "Yes", img: "", _demo: true },
  { id: "demo_base_02", n: "Black Merino Tee",        c: "Shirts",   col: "Black",     b: "Demo", l: "Base",     occ: "Casual", w: "Mild", t: "Yes", img: "", _demo: true },
  { id: "demo_base_03", n: "Cream Knit Sweater",      c: "Knitwear", col: "Cream",     b: "Demo", l: "Base",     occ: "Casual", w: "Mild", t: "Yes", img: "", _demo: true },
  // Mid layer (1)
  { id: "demo_mid_01",  n: "Grey Cashmere Roll-Neck", c: "Knitwear", col: "Grey",      b: "Demo", l: "Mid",      occ: "Casual", w: "Cold", t: "Yes", img: "", _demo: true },
  // Outer layers (2)
  { id: "demo_outer_01", n: "Black Bomber Jacket",   c: "Jackets",  col: "Black",     b: "Demo", l: "Outer",    occ: "Casual", w: "Mild", t: "Yes", img: "", _demo: true },
  { id: "demo_outer_02", n: "Navy Trench Coat",      c: "Jackets",  col: "Navy Blue", b: "Demo", l: "Outer",    occ: "Dinner", w: "Cold", t: "Yes", img: "", _demo: true },
  // Bottoms (3)
  { id: "demo_bottom_01", n: "Navy Slim Trousers",   c: "Trousers", col: "Navy Blue", b: "Demo", l: "Bottom",   occ: "Dinner", w: "Mild", t: "Yes", img: "", _demo: true },
  { id: "demo_bottom_02", n: "Khaki Chinos",         c: "Trousers", col: "Khaki",     b: "Demo", l: "Bottom",   occ: "Casual", w: "Warm", t: "Yes", img: "", _demo: true },
  { id: "demo_bottom_03", n: "Black Slim Jeans",     c: "Jeans",    col: "Black",     b: "Demo", l: "Bottom",   occ: "Casual", w: "Mild", t: "Yes", img: "", _demo: true },
  // Footwear (3)
  { id: "demo_shoes_01", n: "White Leather Sneakers", c: "Footwear", col: "White",    b: "Demo", l: "Footwear", occ: "Casual", w: "Warm", t: "Yes", img: "", _demo: true },
  { id: "demo_shoes_02", n: "Brown Leather Boots",    c: "Footwear", col: "Brown",    b: "Demo", l: "Footwear", occ: "Dinner", w: "Cold", t: "Yes", img: "", _demo: true },
  { id: "demo_shoes_03", n: "Black Derby Shoes",      c: "Footwear", col: "Black",    b: "Demo", l: "Footwear", occ: "Formal", w: "Mild", t: "Yes", img: "", _demo: true },
];

const DEMO_OUTFITS = {
  d01: {
    daytime: { base: "demo_base_01", bottom: "demo_bottom_02", shoes: "demo_shoes_01" },
    evening: { base: "demo_base_02", bottom: "demo_bottom_01", shoes: "demo_shoes_02" },
  },
  d02: {
    daytime: { base: "demo_base_03", bottom: "demo_bottom_03", shoes: "demo_shoes_01" },
    evening: { base: "demo_base_02", mid: "demo_mid_01", bottom: "demo_bottom_01", shoes: "demo_shoes_02" },
  },
  d03: {
    daytime: { base: "demo_base_02", outer: "demo_outer_01", bottom: "demo_bottom_03", shoes: "demo_shoes_01" },
    evening: { base: "demo_base_01", outer: "demo_outer_02", bottom: "demo_bottom_01", shoes: "demo_shoes_03" },
  },
};

const DEMO_TRIP = {
  id:          DEMO_TRIP_ID,
  name:        "Australia & NZ 2026",
  destination: "Sydney, Melbourne, Queenstown",
  createdAt:   "2026-04-01T00:00:00Z",
  days:        SEED_TRIP,
};

function wardrobeKey(guestId) { return `vesti_guest_${guestId}_wardrobe`; }
function tripsKey(guestId)    { return `vesti_guest_${guestId}_trips`; }
function outfitKey()          { return `vesti_outfits_${DEMO_TRIP_ID}_v1`; }
function demoFlagKey(guestId) { return `vesti_guest_${guestId}_demo_mode`; }

function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export function loadDemo(guestId) {
  if (!guestId) return;
  save(wardrobeKey(guestId), DEMO_ITEMS);
  save(tripsKey(guestId), [DEMO_TRIP]);
  save(outfitKey(), { outfitIds: DEMO_OUTFITS, frozenDays: {}, updatedAt: {} });
  localStorage.setItem(demoFlagKey(guestId), "1");
  window.dispatchEvent(new CustomEvent("vesti-demo-loaded", { detail: { guestId } }));
}

export function clearDemo(guestId) {
  if (!guestId) return;
  localStorage.removeItem(wardrobeKey(guestId));
  localStorage.removeItem(tripsKey(guestId));
  localStorage.removeItem(outfitKey());
  localStorage.removeItem(demoFlagKey(guestId));
  window.dispatchEvent(new CustomEvent("vesti-demo-cleared", { detail: { guestId } }));
}

export function isDemoActive(guestId) {
  return !!guestId && localStorage.getItem(demoFlagKey(guestId)) === "1";
}
