/* ─── GOOGLE DRIVE IMAGE HELPER ─────────────────────────────────────────────
   Returns the secure image proxy URL — never a raw Drive link in the browser.
   ─────────────────────────────────────────────────────────────────────────── */
export function driveImg(fileId) {
  return `/api/image?id=${fileId}`;
}

/* ─── THEME TOKENS — resolve to CSS variables defined in styles/themes.css ──── */
export const T = {
  bg:           "var(--bg)",
  surface:      "var(--surface)",
  alt:          "var(--alt)",
  border:       "var(--border)",
  borderLight:  "var(--border-light)",
  text:         "var(--text)",
  mid:          "var(--mid)",
  light:        "var(--light)",
  green:        "var(--green)",
  accent:       "var(--accent)",
  accentDim:    "var(--accent-dim)",
  accentBorder: "var(--accent-border)",
  danger:  { bg: "var(--danger-bg)",  border: "var(--danger-border)",  fg: "var(--danger-fg)"  },
  warning: { bg: "var(--warning-bg)", border: "var(--warning-border)", fg: "var(--warning-fg)" },
  success: { bg: "var(--success-bg)", border: "var(--success-border)", fg: "var(--success-fg)" },
  info:    { bg: "var(--info-bg)",    border: "var(--info-border)",    fg: "var(--info-fg)"    },
  teal:    { bg: "var(--teal-bg)",    border: "var(--teal-border)",    fg: "var(--teal-fg)"    },
  weather: {
    Cold: ["var(--weather-cold-bg)", "var(--weather-cold-fg)"],
    Mild: ["var(--weather-mild-bg)", "var(--weather-mild-fg)"],
    Warm: ["var(--weather-warm-bg)", "var(--weather-warm-fg)"],
  },
  occ: {
    Casual: ["var(--occ-casual-bg)", "var(--occ-casual-fg)"],
    Dinner: ["var(--occ-dinner-bg)", "var(--occ-dinner-fg)"],
    Flight: ["var(--occ-flight-bg)", "var(--occ-flight-fg)"],
    Hiking: ["var(--occ-hiking-bg)", "var(--occ-hiking-fg)"],
    Gym:    ["var(--occ-gym-bg)",    "var(--occ-gym-fg)"],
    Formal: ["var(--occ-formal-bg)", "var(--occ-formal-fg)"],
    Show:   ["var(--occ-show-bg)",   "var(--occ-show-fg)"],
  },
};

/* ─── COLOR SWATCHES (render when image unavailable) ───────────────────────── */
export const SWATCHES = {
  Black: ["#1C1C1C", "#3A3A3A", "#FFFFFF"],
  White: ["#F0F0F0", "#E0E0E0", "#333333"],
  "Navy Blue": ["#1B2A4A", "#243660", "#FFFFFF"],
  "Midnight Blue": ["#191970", "#252580", "#FFFFFF"],
  "Dark Navy": ["#0F1E35", "#1B2A4A", "#FFFFFF"],
  Blue: ["#3B82F6", "#60A5FA", "#FFFFFF"],
  "Light Blue": ["#BAD7F5", "#93C5FD", "#1E3A5F"],
  "Oyster White": ["#F0EBE1", "#E5DDD0", "#4A3F35"],
  Ecru: ["#EFE9D8", "#E0D5C0", "#5C4A2A"],
  "Ecru/Navy": ["#EFE9D8", "#1B2A4A", "#5C4A2A"],
  Cream: ["#F5F0E8", "#EAE0CC", "#6B5E45"],
  Beige: ["#E8DCC8", "#D4C4A8", "#5C4A2A"],
  "Light Beige": ["#EEE8DC", "#E0D8CA", "#5C4A2A"],
  Camel: ["#C19A6B", "#D4AA7D", "#FFFFFF"],
  Brown: ["#7B4F2E", "#9B6948", "#FFFFFF"],
  "Light Brown": ["#C4956A", "#D4A880", "#FFFFFF"],
  "Dark Brown": ["#4A2C17", "#6B3F24", "#FFFFFF"],
  "Brown Floral": ["#7B4F2E", "#C4956A", "#FFFFFF"],
  Khaki: ["#BDB592", "#CEC8A8", "#4A4228"],
  Stone: ["#C8B99A", "#D8CAAA", "#4A3728"],
  "Sand Brown": ["#D4A97A", "#E0BC95", "#5C3A1E"],
  "Olive Green": ["#708238", "#8A9E4A", "#FFFFFF"],
  "Light Green": ["#86EFAC", "#4ADE80", "#14532D"],
  Grey: ["#9CA3AF", "#D1D5DB", "#1F2937"],
  Gray: ["#9CA3AF", "#D1D5DB", "#1F2937"],
  "Light Gray": ["#D1D5DB", "#E5E7EB", "#374151"],
  "Dark Grey": ["#4B5563", "#6B7280", "#FFFFFF"],
  Charcoal: ["#374151", "#4B5563", "#FFFFFF"],
  Burgundy: ["#7F1D1D", "#991B1B", "#FFFFFF"],
  Red: ["#DC2626", "#EF4444", "#FFFFFF"],
  Peach: ["#FDBA74", "#FCA572", "#7C2D12"],
  Pink: ["#F9A8D4", "#FBB6CE", "#831843"],
  Yellow: ["#FDE047", "#FACC15", "#713F12"],
  Mustard: ["#CA8A04", "#EAB308", "#FFFFFF"],
  Orange: ["#F97316", "#FB923C", "#FFFFFF"],
  Purple: ["#7C3AED", "#8B5CF6", "#FFFFFF"],
  Silver: ["#C0C0C0", "#D4D4D4", "#333333"],
  "Black/White": ["#1C1C1C", "#F5F5F5", "#FFFFFF"],
  "Black/Gold": ["#1C1C1C", "#D4AF37", "#FFFFFF"],
  "Pink/White": ["#F9A8D4", "#FFFFFF", "#831843"],
};

export function swatch(c) {
  if (!c) return ["#E5E5E5", "#D0D0D0", "#555"];
  if (SWATCHES[c]) return SWATCHES[c];
  const k = Object.keys(SWATCHES).find(
    (k) => c.toLowerCase().includes(k.toLowerCase())
  );
  return k ? SWATCHES[k] : ["#E8E5DF", "#D5D0C8", "#6B6960"];
}

export const CAT_EMOJI = {
  // ─ Google Sheets tab names (new data source)
  Jackets:      "🧥",
  Shoes:        "👟",
  Sweaters:     "🧶",
  Thermals:     "🧣",
  Shirts:       "👔",
  "Gym Tshirts":"👕",
  Bottoms:      "👖",
  // ─ legacy granular categories (local wardrobe.js)
  Jacket: "🧥",
  "Light Jacket": "🧥",
  Overshirt: "👕",
  Coat: "🧥",
  Blazer: "🤵",
  "T-Shirt": "👕",
  Shirt: "👔",
  Polo: "👕",
  Sweater: "🧶",
  Sweatshirt: "🧶",
  Jumper: "🧶",
  "Linen Pants": "👖",
  Trousers: "👖",
  Jeans: "👖",
  Cargo: "👖",
  "Track Pants": "👖",
  Joggers: "👖",
  Sneakers: "👟",
  Derby: "👞",
  Trainers: "👟",
  Sandals: "🩴",
};
