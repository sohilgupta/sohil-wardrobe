/* ─── OUTFIT ENGINE ─────────────────────────────────────────────────────────── */
export function pick(wardrobe, { occ, w }, used = new Set()) {
  const pool =
    wardrobe.filter((i) => i.t === "Yes").length >= 5
      ? wardrobe.filter((i) => i.t === "Yes")
      : wardrobe;

  const score = (i) => {
    let s = 0;
    if (i.occ === occ) s += 5;
    if (["Hiking", "Gym"].includes(occ) && i.occ === "Casual") s += 2;
    if (i.w === w) s += 4;
    if ((w === "Cold" && i.w === "Mild") || (w === "Mild" && i.w === "Warm"))
      s += 1;
    if (!used.has(i.id)) s += 3;
    return s;
  };

  const best = (layer, f = () => true) =>
    pool
      .filter((i) => i.l === layer && f(i))
      .sort((a, b) => score(b) - score(a))[0] || null;

  const base = best("Base");
  const bottom = best("Bottom");
  const shoe = best("Footwear");
  const mid =
    w === "Cold" || (w === "Mild" && ["Dinner", "Flight"].includes(occ))
      ? best("Mid")
      : null;
  const outer =
    w === "Cold" || occ === "Flight" || w === "Mild" ? best("Outer") : null;

  return [base, mid, outer, bottom, shoe].filter(Boolean);
}
