import { useState, useRef } from "react";

/* ─── TOKENS ───────────────────────────────────────────────────────────────── */
const T = {
  bg:"#F8F7F4", surface:"#FFFFFF", alt:"#F2F1ED",
  border:"#E4E2DB", borderLight:"#EDEBE5",
  text:"#1A1916", mid:"#6B6960", light:"#B0ADA5",
  green:"#2A5425",
  weather:{ Cold:["#DBEAFE","#1D4ED8"], Mild:["#D1FAE5","#065F46"], Warm:["#FEF3C7","#92400E"] },
  occ:{ Casual:["#F3F4F6","#374151"], Dinner:["#FCE7F3","#9D174D"], Flight:["#EFF6FF","#1E40AF"], Hiking:["#ECFDF5","#065F46"], Gym:["#FFF7ED","#9A3412"], Formal:["#F5F3FF","#5B21B6"] },
};

/* ─── COLOR SWATCHES (render when image unavailable) ───────────────────────── */
const SWATCHES = {
  "Black":["#1C1C1C","#3A3A3A","#FFFFFF"],
  "White":["#F0F0F0","#E0E0E0","#333333"],
  "Navy Blue":["#1B2A4A","#243660","#FFFFFF"],
  "Midnight Blue":["#191970","#252580","#FFFFFF"],
  "Dark Navy":["#0F1E35","#1B2A4A","#FFFFFF"],
  "Blue":["#3B82F6","#60A5FA","#FFFFFF"],
  "Light Blue":["#BAD7F5","#93C5FD","#1E3A5F"],
  "Oyster White":["#F0EBE1","#E5DDD0","#4A3F35"],
  "Ecru":["#EFE9D8","#E0D5C0","#5C4A2A"],
  "Ecru/Navy":["#EFE9D8","#1B2A4A","#5C4A2A"],
  "Cream":["#F5F0E8","#EAE0CC","#6B5E45"],
  "Beige":["#E8DCC8","#D4C4A8","#5C4A2A"],
  "Light Beige":["#EEE8DC","#E0D8CA","#5C4A2A"],
  "Camel":["#C19A6B","#D4AA7D","#FFFFFF"],
  "Brown":["#7B4F2E","#9B6948","#FFFFFF"],
  "Light Brown":["#C4956A","#D4A880","#FFFFFF"],
  "Dark Brown":["#4A2C17","#6B3F24","#FFFFFF"],
  "Brown Floral":["#7B4F2E","#C4956A","#FFFFFF"],
  "Khaki":["#BDB592","#CEC8A8","#4A4228"],
  "Stone":["#C8B99A","#D8CAAA","#4A3728"],
  "Sand Brown":["#D4A97A","#E0BC95","#5C3A1E"],
  "Olive Green":["#708238","#8A9E4A","#FFFFFF"],
  "Light Green":["#86EFAC","#4ADE80","#14532D"],
  "Grey":["#9CA3AF","#D1D5DB","#1F2937"],
  "Gray":["#9CA3AF","#D1D5DB","#1F2937"],
  "Light Gray":["#D1D5DB","#E5E7EB","#374151"],
  "Dark Grey":["#4B5563","#6B7280","#FFFFFF"],
  "Charcoal":["#374151","#4B5563","#FFFFFF"],
  "Burgundy":["#7F1D1D","#991B1B","#FFFFFF"],
  "Red":["#DC2626","#EF4444","#FFFFFF"],
  "Peach":["#FDBA74","#FCA572","#7C2D12"],
  "Pink":["#F9A8D4","#FBB6CE","#831843"],
  "Yellow":["#FDE047","#FACC15","#713F12"],
  "Mustard":["#CA8A04","#EAB308","#FFFFFF"],
  "Orange":["#F97316","#FB923C","#FFFFFF"],
  "Purple":["#7C3AED","#8B5CF6","#FFFFFF"],
  "Silver":["#C0C0C0","#D4D4D4","#333333"],
  "Black/White":["#1C1C1C","#F5F5F5","#FFFFFF"],
  "Black/Gold":["#1C1C1C","#D4AF37","#FFFFFF"],
  "Pink/White":["#F9A8D4","#FFFFFF","#831843"],
};
function swatch(c) {
  if (!c) return ["#E5E5E5","#D0D0D0","#555"];
  if (SWATCHES[c]) return SWATCHES[c];
  const k = Object.keys(SWATCHES).find(k => c.toLowerCase().includes(k.toLowerCase()));
  return k ? SWATCHES[k] : ["#E8E5DF","#D5D0C8","#6B6960"];
}
const CAT_EMOJI = { Jacket:"🧥","Light Jacket":"🧥",Overshirt:"👕",Coat:"🧥",Blazer:"🤵","T-Shirt":"👕",Shirt:"👔",Polo:"👕",Sweater:"🧶",Sweatshirt:"🧶",Jumper:"🧶","Linen Pants":"👖",Trousers:"👖",Jeans:"👖",Cargo:"👖","Track Pants":"👖",Joggers:"👖",Sneakers:"👟",Derby:"👞",Trainers:"👟",Sandals:"🩴" };

/* ─── WARDROBE (Zara CDN images load; all others use color swatch) ──────────── */
const W = [
  // OUTER
  {id:"j1", n:"Zara Black Faux Leather Jacket",  c:"Jacket",      col:"Black",        occ:"Casual", w:"Mild", l:"Outer", b:"Zara",          t:"Yes", img:"https://static.zara.net/photos///assets/public/92c4/a8b3/a2d94923b934/f174547f555a/04391400800-e1/w/704/04391400800-e1.jpg?ts=1725355672344"},
  {id:"j2", n:"Burberry Puffer Jacket",           c:"Jacket",      col:"Black",        occ:"Casual", w:"Cold", l:"Outer", b:"Burberry",      t:"Yes", img:""},
  {id:"j3", n:"Uniqlo Black Fur Jacket",          c:"Jacket",      col:"Black",        occ:"Casual", w:"Cold", l:"Outer", b:"Uniqlo",        t:"No",  img:""},
  {id:"j4", n:"Zara Technical Bomber Khaki",      c:"Jacket",      col:"Khaki",        occ:"Casual", w:"Mild", l:"Outer", b:"Zara",          t:"Yes", img:"https://static.zara.net/photos///2023/I/0/2/p/5070/304/505/2/w/704/5070304505_6_1_1.jpg?ts=1694439342664"},
  {id:"j5", n:"Zara Faux Suede Jacket Camel",     c:"Jacket",      col:"Camel",        occ:"Dinner", w:"Mild", l:"Outer", b:"Zara",          t:"Yes", img:"https://static.zara.net/assets/public/3ca3/b860/b0fa40d7a3e4/592a9358b1d4/08281152704-e1/08281152704-e1.jpg?ts=1764677550500&w=1920"},
  {id:"j6", n:"Zara Burgundy Quilted Jacket",     c:"Jacket",      col:"Burgundy",     occ:"Casual", w:"Cold", l:"Outer", b:"Zara",          t:"Yes", img:"https://static.zara.net/assets/public/fd7c/3251/92ab47cc873b/534243e8f70b/04302410606-e1/04302410606-e1.jpg?ts=1767775940264&w=1920"},
  {id:"j7", n:"Zara Waxed Finish Jacket Khaki",   c:"Jacket",      col:"Khaki",        occ:"Casual", w:"Mild", l:"Outer", b:"Zara",          t:"Yes", img:"https://static.zara.net/assets/public/dab0/5516/7dc84afcb587/c3d424af4242/05070570505-e1/05070570505-e1.jpg?ts=1759996598768&w=1998"},
  {id:"j8", n:"Zara Velvet Overshirt Black",      c:"Overshirt",   col:"Black",        occ:"Dinner", w:"Mild", l:"Outer", b:"Zara",          t:"Yes", img:"https://static.zara.net/assets/public/1a12/381b/479345e89c23/2274e624f1ee/05070120800-e1/05070120800-e1.jpg?ts=1759239887460&w=1920"},
  {id:"j9", n:"H&M Overshirt Beige Checked",      c:"Overshirt",   col:"Beige",        occ:"Casual", w:"Mild", l:"Outer", b:"H&M",           t:"Yes", img:""},
  {id:"j10",n:"Zara Faux Fur Overshirt Dark Brown",c:"Overshirt",  col:"Dark Brown",   occ:"Casual", w:"Cold", l:"Outer", b:"Zara",          t:"Yes", img:"https://static.zara.net/photos///assets/public/dbf4/da00/75984c52bc1c/51bfd0f09d18/03715713207-e1/w/704/03715713207-e1.jpg?ts=1764235707981"},
  {id:"j11",n:"Zara Double Faced Leather Black",  c:"Jacket",      col:"Black",        occ:"Dinner", w:"Cold", l:"Outer", b:"Zara",          t:"No",  img:"https://static.zara.net/photos///assets/public/7251/cf17/a340425cacf0/0b7b603a0c58/00993405800-e1/w/704/00993405800-e1.jpg?ts=1729158840296"},
  {id:"j12",n:"Zara Wool Blend Camel Coat",       c:"Coat",        col:"Camel",        occ:"Formal", w:"Cold", l:"Outer", b:"Zara",          t:"Yes", img:"https://static.zara.net/assets/public/c904/05d2/578445c08b00/8518247f0a01/04217752707-e1/04217752707-e1.jpg?ts=1727004196494&w=704"},
  {id:"j13",n:"Zara Velvet Blazer Black",         c:"Blazer",      col:"Black",        occ:"Dinner", w:"Mild", l:"Outer", b:"Zara",          t:"Yes", img:"https://static.zara.net/photos///2024/I/0/2/p/9621/070/800/2/w/704/9621070800_6_3_1.jpg?ts=1727256101240"},
  {id:"j14",n:"Zara Cable-Knit Jacket Khaki",     c:"Light Jacket",col:"Khaki",        occ:"Casual", w:"Mild", l:"Outer", b:"Zara",          t:"Yes", img:"https://static.zara.net/assets/public/126d/d78f/fd7c48fc950a/e3be1c0a3515/03992411505-e1/03992411505-e1.jpg?ts=1764861802553&w=1920"},
  {id:"j15",n:"H&M Beige Cardigan",               c:"Light Jacket",col:"Light Beige",  occ:"Casual", w:"Mild", l:"Outer", b:"H&M",           t:"No",  img:""},
  {id:"j16",n:"Zara Yellow Structured Jacket",    c:"Jacket",      col:"Yellow",       occ:"Casual", w:"Warm", l:"Outer", b:"Zara",          t:"No",  img:"https://static.zara.net/assets/public/dc40/f435/d45643029a32/bcee48748f28/01437317306-e1/01437317306-e1.jpg?ts=1753364509588&w=1998"},
  // MID
  {id:"s1", n:"Zara Ribbed Sweater Navy",         c:"Sweater",     col:"Navy Blue",    occ:"Casual", w:"Cold", l:"Mid",   b:"Zara",          t:"Yes", img:"https://static.zara.net/photos///assets/public/9b87/1bff/095c4c6ba40a/8bbf38799681/03284305401-e1/w/1864/03284305401-e1.jpg?ts=1757577893254"},
  {id:"s2", n:"Zara Quarter-Zip Jumper Ecru/Navy",c:"Jumper",      col:"Ecru/Navy",    occ:"Casual", w:"Cold", l:"Mid",   b:"Zara",          t:"Yes", img:"https://static.zara.net/assets/public/468c/4358/fa084edfaeea/b0da46180933/03332400066-e1/03332400066-e1.jpg?ts=1764935146993&w=1920"},
  {id:"s3", n:"Zara Quarter-Zip Sweatshirt Ecru", c:"Sweatshirt",  col:"Ecru",         occ:"Casual", w:"Cold", l:"Mid",   b:"Zara",          t:"Yes", img:"https://static.zara.net/assets/public/c16c/0600/cb7e4079b3b2/67dc15cd7519/04087366712-e1/04087366712-e1.jpg?ts=1764861804097&w=1920"},
  {id:"s4", n:"Zara Knit Polo Sweater Black",     c:"Sweater",     col:"Black",        occ:"Dinner", w:"Cold", l:"Mid",   b:"Zara",          t:"Yes", img:"https://static.zara.net/assets/public/47d3/f389/e34c4234aedb/88b728b6083e/00077300800-e1/00077300800-e1.jpg?ts=1756301081245&w=2704"},
  {id:"s5", n:"Zara Polo Sweater Midnight Blue",  c:"Sweater",     col:"Midnight Blue",occ:"Casual", w:"Cold", l:"Mid",   b:"Zara",          t:"Yes", img:"https://static.zara.net/assets/public/05da/4452/481843f4855f/d25ce3fd50b3/01195331490-e1/01195331490-e1.jpg?ts=1764664089689&w=1920"},
  {id:"s6", n:"Zara Knitted Polo Brown",          c:"Sweater",     col:"Brown",        occ:"Casual", w:"Cold", l:"Mid",   b:"Zara",          t:"No",  img:"https://static.zara.net/assets/public/e14b/b188/fc594ca7a0ce/733c84fedcf4/03284340700-e1/03284340700-e1.jpg?ts=1758531237294&w=1125"},
  {id:"s7", n:"Uniqlo Black Zip Sweater",         c:"Sweater",     col:"Black",        occ:"Casual", w:"Cold", l:"Mid",   b:"Uniqlo",        t:"No",  img:""},
  {id:"s8", n:"Superdry Red Sweatshirt",          c:"Sweatshirt",  col:"Red",          occ:"Casual", w:"Cold", l:"Mid",   b:"Superdry",      t:"No",  img:""},
  // TOPS
  {id:"t1", n:"Zara Basic T-Shirt Black",         c:"T-Shirt",     col:"Black",        occ:"Casual", w:"Warm", l:"Base",  b:"Zara",          t:"Yes", img:"https://static.zara.net/photos///assets/public/094f/ca99/10b44785824a/111a3b1365a2/01887470800-000-e1/w/1864/01887470800-000-e1.jpg?ts=1755079359350"},
  {id:"t2", n:"Tommy Hilfiger T-Shirt Black",     c:"T-Shirt",     col:"Black",        occ:"Casual", w:"Warm", l:"Base",  b:"Tommy Hilfiger",t:"Yes", img:""},
  {id:"t3", n:"Tommy Hilfiger T-Shirt Beige",     c:"T-Shirt",     col:"Beige",        occ:"Casual", w:"Warm", l:"Base",  b:"Tommy Hilfiger",t:"Yes", img:""},
  {id:"t4", n:"Tommy Hilfiger T-Shirt Khaki",     c:"T-Shirt",     col:"Khaki",        occ:"Casual", w:"Warm", l:"Base",  b:"Tommy Hilfiger",t:"No",  img:""},
  {id:"t5", n:"Tommy Hilfiger T-Shirt Blue",      c:"T-Shirt",     col:"Blue",         occ:"Casual", w:"Warm", l:"Base",  b:"Tommy Hilfiger",t:"No",  img:""},
  {id:"t6", n:"Tommy Hilfiger T-Shirt Peach",     c:"T-Shirt",     col:"Peach",        occ:"Casual", w:"Warm", l:"Base",  b:"Tommy Hilfiger",t:"No",  img:""},
  {id:"t7", n:"Zara Baker Knit T-Shirt Navy",     c:"T-Shirt",     col:"Navy Blue",    occ:"Casual", w:"Warm", l:"Base",  b:"Zara",          t:"Yes", img:"https://static.zara.net/assets/public/bd13/6e52/773c415d830c/d3ed25b1ca07/03166314401-e1/03166314401-e1.jpg?ts=1751550118307&w=1920"},
  {id:"t8", n:"Zara Relaxed T-Shirt Yellow",      c:"T-Shirt",     col:"Yellow",       occ:"Casual", w:"Warm", l:"Base",  b:"Zara",          t:"No",  img:"https://static.zara.net/assets/public/c368/cc00/65bf47f1b41b/882ab0dbf967/05536431300-000-e1/05536431300-000-e1.jpg?ts=1754985885299&w=1998"},
  {id:"t9", n:"Jack & Jones Brown Piqué T-Shirt", c:"T-Shirt",     col:"Brown",        occ:"Casual", w:"Warm", l:"Base",  b:"Jack & Jones",  t:"No",  img:""},
  {id:"t10",n:"Jack & Jones Olive Green T-Shirt", c:"T-Shirt",     col:"Olive Green",  occ:"Casual", w:"Warm", l:"Base",  b:"Jack & Jones",  t:"No",  img:""},
  {id:"t11",n:"Jack & Jones Light Blue T-Shirt",  c:"T-Shirt",     col:"Light Blue",   occ:"Casual", w:"Warm", l:"Base",  b:"Jack & Jones",  t:"No",  img:""},
  {id:"t12",n:"Jack & Jones Pink Piqué T-Shirt",  c:"T-Shirt",     col:"Pink",         occ:"Casual", w:"Warm", l:"Base",  b:"Jack & Jones",  t:"No",  img:""},
  // POLO
  {id:"p1", n:"Zara Piqué Polo Ecru",             c:"Polo",        col:"Ecru",         occ:"Casual", w:"Warm", l:"Base",  b:"Zara",          t:"Yes", img:"https://static.zara.net/photos///assets/public/a5ca/ac77/1a9f43ccbad7/59751fca680e/06674419712-e1/w/704/06674419712-e1.jpg?ts=1738859761729"},
  {id:"p2", n:"Zara Pearl Knit Polo Light Blue",  c:"Polo",        col:"Light Blue",   occ:"Casual", w:"Warm", l:"Base",  b:"Zara",          t:"Yes", img:"https://static.zara.net/assets/public/d2b3/fa4e/b15043c98f49/a4549e0f47f4/03284366420-e1/03284366420-e1.jpg?ts=1751881977931&w=1920"},
  {id:"p3", n:"Zara Textured Knit Polo Red",      c:"Polo",        col:"Red",          occ:"Casual", w:"Warm", l:"Base",  b:"Zara",          t:"No",  img:"https://static.zara.net/photos///assets/public/32f4/7282/a5a747a9a9fd/99b0fbc42a59/03332405600-e1/w/704/03332405600-e1.jpg?ts=1750338184165"},
  {id:"p4", n:"Zara Knit Polo Light Green",       c:"Polo",        col:"Light Green",  occ:"Casual", w:"Warm", l:"Base",  b:"Zara",          t:"No",  img:""},
  // SHIRTS
  {id:"sh1",n:"Zara Openwork Knit Shirt White",   c:"Shirt",       col:"Oyster White", occ:"Dinner", w:"Warm", l:"Base",  b:"Zara",          t:"Yes", img:"https://static.zara.net/assets/public/bed7/d902/ab8a41cd86e0/c41f4d06a6e5/03166306251-e1/03166306251-e1.jpg?ts=1751279894544&w=1998"},
  {id:"sh2",n:"Zara Brown Floral Shirt",          c:"Shirt",       col:"Brown Floral", occ:"Dinner", w:"Warm", l:"Base",  b:"Zara",          t:"Yes", img:""},
  {id:"sh3",n:"Celio Cuban Collar Shirt Black",   c:"Shirt",       col:"Black",        occ:"Dinner", w:"Warm", l:"Base",  b:"Celio",         t:"Yes", img:""},
  {id:"sh4",n:"H&M Resort Shirt Light Brown",     c:"Shirt",       col:"Light Brown",  occ:"Casual", w:"Warm", l:"Base",  b:"H&M",           t:"Yes", img:""},
  {id:"sh5",n:"H&M Resort Shirt Cream",           c:"Shirt",       col:"Cream",        occ:"Casual", w:"Warm", l:"Base",  b:"H&M",           t:"Yes", img:""},
  {id:"sh6",n:"Zara Textured Knit Shirt Stone",   c:"Shirt",       col:"Stone",        occ:"Casual", w:"Warm", l:"Base",  b:"Zara",          t:"Yes", img:"https://static.zara.net/assets/public/64be/784b/ea29461684b6/2a234b8e1e31/04938305806-e1/04938305806-e1.jpg?ts=1754047134788&w=1920"},
  {id:"sh7",n:"H&M White Crisp Shirt",            c:"Shirt",       col:"White",        occ:"Formal", w:"Mild", l:"Base",  b:"H&M",           t:"Yes", img:""},
  {id:"sh8",n:"Uniqlo Peach Linen Shirt",         c:"Shirt",       col:"Peach",        occ:"Casual", w:"Warm", l:"Base",  b:"Uniqlo",        t:"Yes", img:""},
  {id:"sh9",n:"UCB Light Blue Linen Shirt",       c:"Shirt",       col:"Light Blue",   occ:"Casual", w:"Warm", l:"Base",  b:"UCB",           t:"Yes", img:""},
  {id:"sh10",n:"Zara Black Textured Shirt",       c:"Shirt",       col:"Black",        occ:"Casual", w:"Mild", l:"Base",  b:"Zara",          t:"Yes", img:"https://static.zara.net/assets/public/3a39/42bd/06a1496fb50d/941216af4045/01450304800-e1/01450304800-e1.jpg?ts=1763108101892&w=2704"},
  {id:"sh11",n:"Zara Western Denim Shirt Grey",   c:"Shirt",       col:"Grey",         occ:"Casual", w:"Mild", l:"Base",  b:"Zara",          t:"Yes", img:"https://static.zara.net/assets/public/2497/5e9b/113d4521b34a/8303f2b306aa/07545390802-e1/07545390802-e1.jpg?ts=1762430479066&w=1920"},
  {id:"sh12",n:"Zara Polka Dot Shirt Black/White",c:"Shirt",       col:"Black/White",  occ:"Dinner", w:"Warm", l:"Base",  b:"Zara",          t:"No",  img:"https://static.zara.net/photos///assets/public/4ea2/8152/fe5048329b92/203fb5151b3e/09333394084-e1/w/704/09333394084-e1.jpg?ts=1764064957066"},
  {id:"sh13",n:"Zara Jacquard Shirt Pink/White",  c:"Shirt",       col:"Pink/White",   occ:"Casual", w:"Warm", l:"Base",  b:"Zara",          t:"No",  img:"https://static.zara.net/photos///assets/public/2d2b/2ad7/88934afa991d/e00d3c6c6bce/05544501046-e1/w/704/05544501046-e1.jpg?ts=1758782668354"},
  // BOTTOMS
  {id:"b1", n:"Zara White Linen Pants",           c:"Linen Pants", col:"White",        occ:"Casual", w:"Warm", l:"Bottom",b:"Zara",          t:"Yes", img:""},
  {id:"b2", n:"Zara Beige Linen Pants",           c:"Linen Pants", col:"Beige",        occ:"Casual", w:"Warm", l:"Bottom",b:"Zara",          t:"Yes", img:""},
  {id:"b3", n:"H&M Light Gray Trousers",          c:"Trousers",    col:"Light Gray",   occ:"Casual", w:"Mild", l:"Bottom",b:"H&M",           t:"Yes", img:""},
  {id:"b4", n:"WROGN Black Jogger Jeans",         c:"Jeans",       col:"Black",        occ:"Casual", w:"Mild", l:"Bottom",b:"Wrogn",         t:"Yes", img:""},
  {id:"b5", n:"H&M Slim Cargo Dark Grey",         c:"Cargo",       col:"Dark Grey",    occ:"Casual", w:"Mild", l:"Bottom",b:"H&M",           t:"Yes", img:""},
  {id:"b6", n:"WROGN Grey Jogger Jeans",          c:"Jeans",       col:"Grey",         occ:"Casual", w:"Mild", l:"Bottom",b:"Wrogn",         t:"No",  img:""},
  {id:"b7", n:"Puma Ferrari Black Track Pants",   c:"Track Pants", col:"Black",        occ:"Gym",    w:"Mild", l:"Bottom",b:"Puma",          t:"Yes", img:""},
  {id:"b8", n:"Zara Camel Stripe Joggers",        c:"Joggers",     col:"Camel",        occ:"Casual", w:"Mild", l:"Bottom",b:"Zara",          t:"No",  img:""},
  {id:"b9", n:"H&M Skinny Cargo Beige",           c:"Cargo",       col:"Beige",        occ:"Casual", w:"Mild", l:"Bottom",b:"H&M",           t:"No",  img:""},
  {id:"b10",n:"M&S White Linen Trousers",         c:"Trousers",    col:"White",        occ:"Casual", w:"Warm", l:"Bottom",b:"M&S",           t:"No",  img:""},
  // FOOTWEAR
  {id:"f1", n:"Adidas Samba Decon White",         c:"Sneakers",    col:"White",        occ:"Casual", w:"Mild", l:"Footwear",b:"Adidas",      t:"Yes", img:""},
  {id:"f2", n:"New Balance 1080 White",           c:"Sneakers",    col:"White",        occ:"Casual", w:"Mild", l:"Footwear",b:"New Balance", t:"Yes", img:""},
  {id:"f3", n:"New Balance 1080 Black",           c:"Sneakers",    col:"Black",        occ:"Gym",    w:"Mild", l:"Footwear",b:"New Balance", t:"Yes", img:""},
  {id:"f4", n:"Adidas Stan Smith White",          c:"Sneakers",    col:"White",        occ:"Casual", w:"Warm", l:"Footwear",b:"Adidas",      t:"No",  img:""},
  {id:"f5", n:"Adidas Superstar Black",           c:"Sneakers",    col:"Black",        occ:"Casual", w:"Mild", l:"Footwear",b:"Adidas",      t:"No",  img:""},
  {id:"f6", n:"H&M Brown Derby Shoes",            c:"Derby",       col:"Brown",        occ:"Dinner", w:"Mild", l:"Footwear",b:"H&M",         t:"Yes", img:""},
  {id:"f7", n:"Woodland Navy Nubuck Derbys",      c:"Derby",       col:"Navy Blue",    occ:"Formal", w:"Mild", l:"Footwear",b:"Woodland",    t:"No",  img:""},
  {id:"f8", n:"Zara Trainers Sand Brown",         c:"Trainers",    col:"Sand Brown",   occ:"Casual", w:"Warm", l:"Footwear",b:"Zara",        t:"Yes", img:"https://static.zara.net/photos///2023/V/1/2/p/2218/120/107/2/w/704/2218120107_6_1_1.jpg?ts=1674824416539"},
  {id:"f9", n:"Zara Double Strap Sandals Brown",  c:"Sandals",     col:"Brown",        occ:"Casual", w:"Warm", l:"Footwear",b:"Zara",        t:"Yes", img:"https://static.zara.net/photos///2023/I/1/2/p/2700/220/700/2/w/704/2700220700_6_2_1.jpg?ts=1689693643310"},
];

/* ─── TRIP ──────────────────────────────────────────────────────────────────── */
const TRIP = [
  {id:"d01",date:"Wed Apr 1", city:"Delhi → Sydney",        day:"Overnight Flight",             night:"",                     occ:"Flight",w:"Cold",e:"✈️"},
  {id:"d02",date:"Thu Apr 2", city:"Sydney",                 day:"Arrival · Taronga Zoo · City", night:"",                     occ:"Casual",w:"Warm",e:"🦁"},
  {id:"d03",date:"Fri Apr 3", city:"Sydney",                 day:"Bondi Beach",                  night:"🎂 Birthday Dinner",    occ:"Dinner",w:"Warm",e:"🏖️"},
  {id:"d04",date:"Sat Apr 4", city:"Sydney",                 day:"Opera House · Harbour Bridge", night:"",                     occ:"Casual",w:"Warm",e:"🎭"},
  {id:"d05",date:"Sun Apr 5", city:"Sydney → Gold Coast",   day:"Arrival · Harbour Walk",       night:"",                     occ:"Casual",w:"Warm",e:"🌊"},
  {id:"d06",date:"Mon Apr 6", city:"Gold Coast",             day:"Theme Park – Movie World",     night:"",                     occ:"Casual",w:"Warm",e:"🎢"},
  {id:"d07",date:"Tue Apr 7", city:"Gold Coast",             day:"Sea World",                    night:"",                     occ:"Casual",w:"Warm",e:"🐬"},
  {id:"d08",date:"Wed Apr 8", city:"Gold Coast → Melbourne", day:"Travel",                       night:"Rooftop Skyline Evening",occ:"Dinner",w:"Mild",e:"🌆"},
  {id:"d09",date:"Thu Apr 9", city:"Melbourne",              day:"Laneways + Cafés",             night:"",                     occ:"Casual",w:"Mild",e:"☕"},
  {id:"d10",date:"Fri Apr 10",city:"Melbourne",              day:"Explore",                      night:"",                     occ:"Casual",w:"Mild",e:"🏙️"},
  {id:"d11",date:"Sat Apr 11",city:"Melbourne → Queenstown", day:"Arrival · Town Walk",          night:"Lake Walk · Chill Dinner",occ:"Dinner",w:"Cold",e:"🏔️"},
  {id:"d12",date:"Sun Apr 12",city:"Queenstown",             day:"Milford Sound Fly & Cruise",   night:"",                     occ:"Hiking",w:"Cold",e:"🚁"},
  {id:"d13",date:"Mon Apr 13",city:"Queenstown",             day:"Luge + Gondola",               night:"",                     occ:"Casual",w:"Cold",e:"🎿"},
  {id:"d14",date:"Tue Apr 14",city:"Queenstown → Tekapo",   day:"Travel",                       night:"Mt John Stargazing",   occ:"Casual",w:"Cold",e:"🌟"},
  {id:"d15",date:"Wed Apr 15",city:"Tekapo → Mount Cook",   day:"Glacier Landing",              night:"",                     occ:"Hiking",w:"Cold",e:"🏔️"},
  {id:"d16",date:"Thu Apr 16",city:"Tekapo → Christchurch", day:"Arrival · City Dinner",        night:"",                     occ:"Dinner",w:"Cold",e:"🍽️"},
  {id:"d17",date:"Fri Apr 17",city:"Christchurch → Auckland",day:"Arrival · City Dinner",       night:"",                     occ:"Dinner",w:"Mild",e:"🌃"},
  {id:"d18",date:"Sat Apr 18",city:"Auckland",               day:"Hobbiton + Glowworm Caves",    night:"",                     occ:"Casual",w:"Mild",e:"🧙"},
  {id:"d19",date:"Sun Apr 19",city:"Auckland",               day:"Relax · Viaduct Harbour",      night:"",                     occ:"Casual",w:"Mild",e:"⛵"},
  {id:"d20",date:"Mon Apr 20",city:"Auckland → Delhi",       day:"Departure Flight",             night:"",                     occ:"Flight",w:"Mild",e:"✈️"},
];

/* ─── OUTFIT ENGINE ─────────────────────────────────────────────────────────── */
function pick(wardrobe, {occ,w}, used=new Set()) {
  const pool = wardrobe.filter(i=>i.t==="Yes").length>=5 ? wardrobe.filter(i=>i.t==="Yes") : wardrobe;
  const score = i => {
    let s=0;
    if(i.occ===occ) s+=5;
    if(["Hiking","Gym"].includes(occ)&&i.occ==="Casual") s+=2;
    if(i.w===w) s+=4;
    if((w==="Cold"&&i.w==="Mild")||(w==="Mild"&&i.w==="Warm")) s+=1;
    if(!used.has(i.id)) s+=3;
    return s;
  };
  const best=(layer,f=()=>true)=>pool.filter(i=>i.l===layer&&f(i)).sort((a,b)=>score(b)-score(a))[0]||null;
  const base=best("Base"), bottom=best("Bottom"), shoe=best("Footwear");
  const mid = (w==="Cold"||(w==="Mild"&&["Dinner","Flight"].includes(occ))) ? best("Mid") : null;
  const outer= (w==="Cold"||occ==="Flight"||w==="Mild") ? best("Outer") : null;
  return [base,mid,outer,bottom,shoe].filter(Boolean);
}

/* ─── AI ────────────────────────────────────────────────────────────────────── */
async function aiTip(items,occ,w,city,act) {
  const desc=items.map(i=>`${i.n} (${i.col})`).join(", ");
  try {
    const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:100,messages:[{role:"user",content:`Fashion stylist. Location: ${city||"AU/NZ"}. Activity: ${act||occ}. Weather: ${w}. Outfit: ${desc}. One punchy sentence of styling advice.`}]})});
    const d=await r.json(); return d.content?.[0]?.text?.trim()||"";
  } catch { return ""; }
}
async function parseURL(url) {
  try {
    const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:200,messages:[{role:"user",content:`Return ONLY a JSON object with keys: name, brand, color, category, imageUrl. No markdown. URL: ${url}`}]})});
    const d=await r.json(); return JSON.parse(d.content?.[0]?.text?.replace(/```json|```/g,"").trim()||"{}");
  } catch { return {}; }
}

/* ─── ITEM VISUAL ───────────────────────────────────────────────────────────── */
function ItemVisual({item, size=160}) {
  const [failed, setFailed] = useState(false);
  const [bg, accent, fg] = swatch(item.col);
  const emoji = CAT_EMOJI[item.c] || "👕";
  const brandInit = (item.b||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

  if (!item.img || failed) {
    // Intentional color swatch with fabric texture feel
    return (
      <div style={{
        width:size, height:size, borderRadius:14, overflow:"hidden", flexShrink:0,
        background:`linear-gradient(145deg, ${bg} 0%, ${accent} 100%)`,
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        position:"relative", userSelect:"none",
      }}>
        {/* Subtle noise texture via repeating gradient */}
        <div style={{ position:"absolute", inset:0, backgroundImage:`repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)` }} />
        {/* Giant faded brand initial */}
        <div style={{ fontSize:size*0.38, fontWeight:800, color:fg, opacity:0.12, lineHeight:1, fontFamily:"'Cormorant Garamond',Georgia,serif", letterSpacing:-4, position:"absolute" }}>
          {brandInit}
        </div>
        {/* Center emoji */}
        <div style={{ fontSize:size*0.22, lineHeight:1, marginBottom:4, position:"relative", zIndex:1 }}>{emoji}</div>
        {/* Color label */}
        <div style={{ fontSize:Math.max(8, size*0.075), fontWeight:700, color:fg, opacity:0.55, letterSpacing:0.8, textAlign:"center", padding:"0 10px", lineHeight:1.3, position:"relative", zIndex:1 }}>
          {item.col.toUpperCase()}
        </div>
        {/* Brand */}
        <div style={{ fontSize:Math.max(7, size*0.06), fontWeight:500, color:fg, opacity:0.35, marginTop:2, letterSpacing:1, position:"relative", zIndex:1 }}>
          {item.b?.toUpperCase()}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width:size, height:size, borderRadius:14, overflow:"hidden", flexShrink:0, background:T.alt }}>
      <img src={item.img} alt={item.n} onError={()=>setFailed(true)}
        style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
    </div>
  );
}

/* ─── CHIPS ─────────────────────────────────────────────────────────────────── */
function Chip({text, colors}) {
  const [bg,fg] = colors || ["#F0EFEB","#5C5950"];
  return <span style={{ display:"inline-flex", fontSize:10, fontWeight:600, letterSpacing:0.3, padding:"2px 8px", borderRadius:20, background:bg, color:fg, whiteSpace:"nowrap" }}>{text}</span>;
}

/* ─── WARDROBE TAB ──────────────────────────────────────────────────────────── */
function WardrobeTab({wardrobe}) {
  const cats=[...new Set(wardrobe.map(i=>i.c))].sort();
  const [cat,setCat]=useState(""); const [occ,setOcc]=useState(""); const [wth,setWth]=useState(""); const [q,setQ]=useState(""); const [detail,setDetail]=useState(null);
  const f=wardrobe.filter(i=>(!cat||i.c===cat)&&(!occ||i.occ===occ)&&(!wth||i.w===wth)&&(!q||i.n.toLowerCase().includes(q.toLowerCase())||i.col.toLowerCase().includes(q.toLowerCase())||(i.b||"").toLowerCase().includes(q.toLowerCase())));

  const selStyle = {padding:"7px 28px 7px 12px",borderRadius:20,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"inherit",appearance:"none",backgroundRepeat:"no-repeat",backgroundPosition:"right 10px center",outline:"none"};

  return (
    <div>
      {/* Search bar */}
      <div style={{position:"relative",marginBottom:12}}>
        <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:T.light,fontSize:16}}>⌕</span>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name, color, brand…"
          style={{width:"100%",padding:"11px 14px 11px 38px",background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:12,fontSize:14,color:T.text,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}} />
      </div>
      {/* Filters */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        <select value={cat} onChange={e=>setCat(e.target.value)} style={{...selStyle,background:cat?T.text:T.surface,color:cat?"#fff":T.mid,border:`1.5px solid ${cat?T.text:T.border}`,backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='${cat?"%23fff":"%23999"}'/%3E%3C/svg%3E")`}}>
          <option value="">Category</option>{cats.map(o=><option key={o}>{o}</option>)}
        </select>
        <select value={occ} onChange={e=>setOcc(e.target.value)} style={{...selStyle,background:occ?T.text:T.surface,color:occ?"#fff":T.mid,border:`1.5px solid ${occ?T.text:T.border}`,backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='${occ?"%23fff":"%23999"}'/%3E%3C/svg%3E")`}}>
          <option value="">Occasion</option>{["Casual","Dinner","Flight","Hiking","Gym","Formal"].map(o=><option key={o}>{o}</option>)}
        </select>
        <select value={wth} onChange={e=>setWth(e.target.value)} style={{...selStyle,background:wth?T.text:T.surface,color:wth?"#fff":T.mid,border:`1.5px solid ${wth?T.text:T.border}`,backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='${wth?"%23fff":"%23999"}'/%3E%3C/svg%3E")`}}>
          <option value="">Weather</option>{["Cold","Mild","Warm"].map(o=><option key={o}>{o}</option>)}
        </select>
        {(cat||occ||wth||q)&&<button onClick={()=>{setCat("");setOcc("");setWth("");setQ("")}} style={{padding:"7px 14px",background:"none",border:`1.5px solid ${T.border}`,borderRadius:20,fontSize:12,color:T.mid,cursor:"pointer"}}>Clear ×</button>}
      </div>
      <p style={{fontSize:12,color:T.light,marginBottom:16}}>{f.length} of {wardrobe.length} items</p>

      {/* Detail sheet */}
      {detail&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setDetail(null)}>
          <div style={{background:T.surface,borderRadius:"20px 20px 0 0",padding:24,width:"100%",maxWidth:520,maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",gap:16,marginBottom:16}}>
              <ItemVisual item={detail} size={110}/>
              <div style={{flex:1}}>
                <p style={{fontSize:16,fontWeight:700,color:T.text,lineHeight:1.3,marginBottom:4}}>{detail.n}</p>
                <p style={{fontSize:13,color:T.mid,marginBottom:12}}>{detail.b}</p>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  <Chip text={detail.col}/>
                  <Chip text={detail.c}/>
                  <Chip text={detail.occ} colors={T.occ[detail.occ]}/>
                  <Chip text={detail.w} colors={T.weather[detail.w]}/>
                  {detail.t==="Yes"&&<Chip text="✈ Travel" colors={["#D1FAE5","#065F46"]}/>}
                </div>
              </div>
            </div>
            <button onClick={()=>setDetail(null)} style={{width:"100%",padding:13,background:T.text,color:"#fff",border:"none",borderRadius:12,fontWeight:600,fontSize:14,cursor:"pointer"}}>Close</button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(148px,1fr))",gap:16}}>
        {f.map(item=>(
          <div key={item.id} onClick={()=>setDetail(item)} style={{cursor:"pointer"}}>
            <div style={{position:"relative"}}>
              <ItemVisual item={item} size={148}/>
              {item.t==="Yes"&&<div style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.6)",color:"#fff",fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:6,letterSpacing:0.5}}>✈</div>}
            </div>
            <div style={{padding:"8px 2px 0"}}>
              <p style={{fontSize:11,fontWeight:600,color:T.text,lineHeight:1.3,marginBottom:3,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{item.n}</p>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                <Chip text={item.col}/>
                <Chip text={item.w} colors={T.weather[item.w]}/>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── OUTFIT GENERATOR ──────────────────────────────────────────────────────── */
function OutfitTab({wardrobe}) {
  const [occ,setOcc]=useState("Casual"); const [wth,setWth]=useState("Mild");
  const [city,setCity]=useState(""); const [act,setAct]=useState("");
  const [outfit,setOutfit]=useState(null); const [tip,setTip]=useState(""); const [tl,setTl]=useState(false); const [gl,setGl]=useState(false);
  const LAYERS={Base:"TOP",Mid:"MID",Outer:"OUTER",Bottom:"BOTTOM",Footwear:"SHOES"};

  const gen=async()=>{
    setGl(true); const o=pick(wardrobe,{occ,w:wth}); setOutfit(o); setTip(""); setGl(false);
    if(city||act){setTl(true);const t=await aiTip(o,occ,wth,city,act);setTip(t);setTl(false);}
  };

  return (
    <div>
      <div style={{background:T.surface,border:`1.5px solid ${T.borderLight}`,borderRadius:16,padding:20,marginBottom:20}}>
        <p style={{fontSize:11,fontWeight:700,color:T.light,letterSpacing:1.5,marginBottom:14}}>BUILD YOUR OUTFIT</p>
        <p style={{fontSize:11,fontWeight:700,color:T.mid,marginBottom:8}}>OCCASION</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
          {["Casual","Dinner","Flight","Hiking","Gym","Formal"].map(o=>(
            <button key={o} onClick={()=>setOcc(o)} style={{padding:"8px 16px",borderRadius:20,border:`1.5px solid ${occ===o?T.text:T.border}`,background:occ===o?T.text:"transparent",color:occ===o?"#fff":T.mid,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>{o}</button>
          ))}
        </div>
        <p style={{fontSize:11,fontWeight:700,color:T.mid,marginBottom:8}}>WEATHER</p>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {[["Cold","🥶"],["Mild","🌤"],["Warm","☀️"]].map(([w,e])=>(
            <button key={w} onClick={()=>setWth(w)} style={{flex:1,padding:"10px",borderRadius:12,border:`1.5px solid ${wth===w?T.text:T.border}`,background:wth===w?T.text:"transparent",color:wth===w?"#fff":T.mid,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>{e} {w}</button>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          {[["Location",city,setCity,"e.g. Sydney"],["Activity",act,setAct,"e.g. Bondi Beach"]].map(([lbl,val,set,ph])=>(
            <div key={lbl}>
              <p style={{fontSize:10,fontWeight:700,color:T.light,letterSpacing:1,marginBottom:5}}>{lbl.toUpperCase()} (OPTIONAL)</p>
              <input value={val} onChange={e=>set(e.target.value)} placeholder={ph} style={{width:"100%",padding:"9px 12px",background:T.alt,border:`1.5px solid ${T.borderLight}`,borderRadius:10,fontSize:13,color:T.text,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
            </div>
          ))}
        </div>
        <button onClick={gen} disabled={gl} style={{width:"100%",padding:15,background:T.text,color:"#fff",border:"none",borderRadius:12,fontSize:15,fontWeight:700,cursor:"pointer",opacity:gl?0.7:1}}>
          {gl?"Generating…":"Generate Outfit →"}
        </button>
      </div>
      {outfit&&(
        <div style={{background:T.surface,border:`1.5px solid ${T.borderLight}`,borderRadius:16,padding:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <p style={{fontSize:11,fontWeight:700,color:T.light,letterSpacing:1.5}}>YOUR OUTFIT</p>
            <button onClick={()=>{const o=pick(wardrobe,{occ,w:wth});setOutfit(o);setTip("");if(city||act){setTl(true);aiTip(o,occ,wth,city,act).then(t=>{setTip(t);setTl(false)});}}} style={{padding:"5px 14px",borderRadius:8,border:`1.5px solid ${T.border}`,background:"none",fontSize:12,color:T.mid,cursor:"pointer"}}>↺ Shuffle</button>
          </div>
          <div style={{display:"flex",gap:12,overflowX:"auto",paddingBottom:8}}>
            {outfit.map(item=>(
              <div key={item.id} style={{flexShrink:0,textAlign:"center"}}>
                <ItemVisual item={item} size={100}/>
                <div style={{marginTop:6}}><Chip text={LAYERS[item.l]||item.l}/></div>
              </div>
            ))}
          </div>
          {tl&&<div style={{marginTop:14,background:T.alt,borderRadius:10,padding:"12px 14px",fontSize:12,color:T.light}}>✨ Getting AI tip…</div>}
          {tip&&<div style={{marginTop:14,background:"#EEF5FF",borderRadius:10,padding:"12px 14px",fontSize:13,color:"#1A3A6B",lineHeight:1.6,fontStyle:"italic"}}>"{tip}"</div>}
          {!tip&&!tl&&<button onClick={()=>{setTl(true);aiTip(outfit,occ,wth,city,act).then(t=>{setTip(t);setTl(false)});}} style={{marginTop:12,width:"100%",padding:10,background:"none",border:`1.5px solid ${T.border}`,borderRadius:10,fontSize:13,color:T.mid,cursor:"pointer",fontFamily:"inherit"}}>✨ Get AI styling tip</button>}
        </div>
      )}
    </div>
  );
}

/* ─── TRIP PLANNER ──────────────────────────────────────────────────────────── */
function TripTab({wardrobe}) {
  const [outfits,setOutfits]=useState({}); const [tips,setTips]=useState({}); const [expanded,setExpanded]=useState(null); const [gen,setGen]=useState(null);
  const used=useRef(new Set());
  const LAYERS={Base:"TOP",Mid:"MID",Outer:"OUTER",Bottom:"BOTTOM",Footwear:"SHOES"};

  const genOne=async day=>{
    setGen(day.id);
    const items=pick(wardrobe,{occ:day.occ,w:day.w},used.current);
    items.forEach(i=>used.current.add(i.id));
    setOutfits(p=>({...p,[day.id]:items}));
    const t=await aiTip(items,day.occ,day.w,day.city,day.day||day.night);
    setTips(p=>({...p,[day.id]:t})); setGen(null);
  };
  const genAll=()=>{
    used.current=new Set();
    TRIP.forEach(day=>{
      const items=pick(wardrobe,{occ:day.occ,w:day.w},used.current);
      items.forEach(i=>used.current.add(i.id));
      setOutfits(p=>({...p,[day.id]:items}));
    });
  };
  const planned=Object.keys(outfits).length;

  return (
    <div>
      <div style={{background:T.surface,border:`1.5px solid ${T.borderLight}`,borderRadius:16,padding:18,marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <p style={{fontSize:16,fontWeight:700,color:T.text}}>AU & NZ — April 2026</p>
            <p style={{fontSize:12,color:T.mid,marginTop:3}}>{planned}/{TRIP.length} days planned</p>
          </div>
          <button onClick={genAll} style={{padding:"9px 18px",background:T.text,color:"#fff",border:"none",borderRadius:10,fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>Plan All →</button>
        </div>
        {planned>0&&<div style={{marginTop:12,background:T.alt,borderRadius:4,height:4}}><div style={{height:"100%",background:T.text,width:`${planned/TRIP.length*100}%`,borderRadius:4,transition:"width 0.4s ease"}}/></div>}
      </div>

      <div style={{position:"relative"}}>
        <div style={{position:"absolute",left:20,top:0,bottom:0,width:1.5,background:T.borderLight}}/>
        {TRIP.map(day=>{
          const done=!!outfits[day.id]; const open=expanded===day.id;
          return (
            <div key={day.id} style={{display:"flex",gap:0,marginBottom:10}}>
              <div style={{width:42,flexShrink:0,display:"flex",justifyContent:"center",paddingTop:18}}>
                <div style={{width:14,height:14,borderRadius:"50%",background:done?T.text:T.surface,border:`2px solid ${done?T.text:T.border}`,zIndex:1,transition:"all 0.2s"}}/>
              </div>
              <div style={{flex:1,background:T.surface,border:`1.5px solid ${T.borderLight}`,borderRadius:14,overflow:"hidden"}}>
                <div onClick={()=>setExpanded(open?null:day.id)} style={{padding:"13px 14px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
                      <span style={{fontSize:15}}>{day.e}</span>
                      <span style={{fontSize:13,fontWeight:700,color:T.text}}>{day.city}</span>
                    </div>
                    <p style={{fontSize:10,color:T.light,marginBottom:6}}>{day.date}</p>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                      {day.day&&<Chip text={day.day}/>}
                      {day.night&&<Chip text={day.night} colors={["#FDF2F8","#9D174D"]}/>}
                      <Chip text={day.w} colors={T.weather[day.w]}/>
                      <Chip text={day.occ} colors={T.occ[day.occ]}/>
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:7,marginLeft:10}}>
                    {done&&(
                      <div style={{display:"flex"}}>
                        {outfits[day.id].slice(0,3).map((item,i)=>{
                          const [bg,ac]=swatch(item.col);
                          return <div key={item.id} style={{width:26,height:26,borderRadius:7,overflow:"hidden",border:"2px solid #fff",marginLeft:i>0?-6:0,background:`linear-gradient(145deg,${bg},${ac})`,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>
                            {item.img?<img src={item.img} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>:null}
                          </div>;
                        })}
                      </div>
                    )}
                    <button onClick={e=>{e.stopPropagation();genOne(day);}} disabled={gen===day.id} style={{padding:"5px 12px",background:done?"none":T.text,color:done?T.mid:"#fff",border:`1.5px solid ${done?T.border:T.text}`,borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                      {gen===day.id?"…":done?"↺":"Plan"}
                    </button>
                  </div>
                </div>
                {open&&done&&(
                  <div style={{borderTop:`1.5px solid ${T.borderLight}`,padding:"14px"}}>
                    <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:6}}>
                      {outfits[day.id].map(item=>(
                        <div key={item.id} style={{flexShrink:0,textAlign:"center"}}>
                          <ItemVisual item={item} size={85}/>
                          <div style={{marginTop:5}}><Chip text={LAYERS[item.l]||item.l}/></div>
                        </div>
                      ))}
                    </div>
                    {tips[day.id]&&<div style={{marginTop:10,background:"#EEF5FF",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#1A3A6B",fontStyle:"italic",lineHeight:1.5}}>"{tips[day.id]}"</div>}
                    {!tips[day.id]&&<button onClick={()=>aiTip(outfits[day.id],day.occ,day.w,day.city,day.day).then(t=>setTips(p=>({...p,[day.id]:t})))} style={{marginTop:8,width:"100%",padding:"7px",background:"none",border:`1px solid ${T.border}`,borderRadius:8,fontSize:11,color:T.mid,cursor:"pointer"}}>✨ AI tip</button>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── ADD ITEM ──────────────────────────────────────────────────────────────── */
function AddTab({onAdd}) {
  const [url,setUrl]=useState(""); const [fl,setFl]=useState(false); const [st,setSt]=useState("");
  const blank={n:"",c:"",col:"",b:"",occ:"Casual",w:"Mild",l:"Base",img:"",t:"No"};
  const [form,setForm]=useState(blank);
  const ff=(k,v)=>setForm(f=>({...f,[k]:v}));

  const fetchUrl=async()=>{ if(!url)return; setFl(true); setSt("Fetching…"); const d=await parseURL(url); setForm(f=>({...f,n:d.name||f.n,c:d.category||f.c,col:d.color||f.col,b:d.brand||f.b,img:d.imageUrl||f.img})); setSt("✓ Done! Review and save."); setFl(false); };
  const save=()=>{ if(!form.n)return; onAdd({...form,id:`add_${Date.now()}`}); setForm(blank); setUrl(""); setSt("✓ Added!"); setTimeout(()=>setSt(""),2500); };

  const F=({label,k,opts})=>(
    <div>
      <p style={{fontSize:10,fontWeight:700,color:T.light,letterSpacing:1,marginBottom:5}}>{label}</p>
      {opts?<select value={form[k]} onChange={e=>ff(k,e.target.value)} style={{width:"100%",padding:"10px 12px",background:T.alt,border:`1.5px solid ${T.borderLight}`,borderRadius:10,fontSize:13,color:T.text,fontFamily:"inherit",outline:"none"}}><option value="">Select…</option>{opts.map(o=><option key={o}>{o}</option>)}</select>
      :<input value={form[k]} onChange={e=>ff(k,e.target.value)} style={{width:"100%",padding:"10px 12px",background:T.alt,border:`1.5px solid ${T.borderLight}`,borderRadius:10,fontSize:13,color:T.text,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>}
    </div>
  );

  return (
    <div style={{maxWidth:500}}>
      <div style={{background:T.surface,border:`1.5px solid ${T.borderLight}`,borderRadius:16,padding:18,marginBottom:16}}>
        <p style={{fontSize:11,fontWeight:700,color:T.light,letterSpacing:1.5,marginBottom:12}}>AUTO-FILL FROM URL</p>
        <div style={{display:"flex",gap:8}}>
          <input value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==="Enter"&&fetchUrl()} placeholder="Paste product URL…" style={{flex:1,padding:"10px 14px",background:T.alt,border:`1.5px solid ${T.borderLight}`,borderRadius:10,fontSize:13,color:T.text,fontFamily:"inherit",outline:"none"}}/>
          <button onClick={fetchUrl} disabled={fl||!url} style={{padding:"10px 18px",background:url?T.text:T.border,color:url?"#fff":"#999",border:"none",borderRadius:10,fontWeight:700,fontSize:13,cursor:url?"pointer":"default"}}>{fl?"…":"Fetch"}</button>
        </div>
        {st&&<p style={{fontSize:12,color:T.green,marginTop:8}}>{st}</p>}
      </div>
      <div style={{background:T.surface,border:`1.5px solid ${T.borderLight}`,borderRadius:16,padding:18}}>
        <p style={{fontSize:11,fontWeight:700,color:T.light,letterSpacing:1.5,marginBottom:16}}>ITEM DETAILS</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{gridColumn:"span 2"}}><F label="ITEM NAME *" k="n"/></div>
          <F label="BRAND" k="b"/> <F label="COLOR" k="col"/>
          <F label="CATEGORY" k="c" opts={["Jacket","Light Jacket","Overshirt","Coat","Blazer","T-Shirt","Polo","Shirt","Sweater","Sweatshirt","Jumper","Linen Pants","Trousers","Jeans","Cargo","Track Pants","Joggers","Sneakers","Derby","Trainers","Sandals"]}/>
          <F label="OCCASION" k="occ" opts={["Casual","Dinner","Flight","Hiking","Gym","Formal"]}/>
          <F label="WEATHER" k="w" opts={["Cold","Mild","Warm"]}/>
          <F label="LAYER" k="l" opts={["Base","Mid","Outer","Bottom","Footwear"]}/>
          <F label="TRAVEL" k="t" opts={["Yes","No"]}/>
          <div style={{gridColumn:"span 2"}}><F label="IMAGE URL" k="img"/></div>
        </div>
        {form.img&&<div style={{marginTop:12,borderRadius:12,overflow:"hidden",height:100,background:T.alt}}><img src={form.img} alt="preview" style={{width:"100%",height:"100%",objectFit:"contain"}}/></div>}
        <button onClick={save} disabled={!form.n} style={{marginTop:16,width:"100%",padding:14,background:form.n?T.text:T.border,color:form.n?"#fff":"#999",border:"none",borderRadius:12,fontWeight:700,fontSize:14,cursor:form.n?"pointer":"default"}}>Add to Wardrobe</button>
      </div>
    </div>
  );
}

/* ─── PACKING LIST ──────────────────────────────────────────────────────────── */
function PackTab({wardrobe}) {
  const [list,setList]=useState(null); const [checked,setChecked]=useState({});
  const gen=()=>{
    const used=new Set(); const all=[];
    TRIP.forEach(day=>{const items=pick(wardrobe,{occ:day.occ,w:day.w},used);items.forEach(i=>{if(!used.has(i.id)){used.add(i.id);all.push(i);}});});
    const g={}; all.forEach(i=>{if(!g[i.l])g[i.l]=[];g[i.l].push(i);});
    setList(g); setChecked({});
  };
  const ORDER=["Base","Mid","Outer","Bottom","Footwear"];
  const LABEL={Base:"Tops & Base Layers",Mid:"Mid Layers / Knitwear",Outer:"Jackets & Outerwear",Bottom:"Bottoms",Footwear:"Footwear"};
  const ICON={Base:"👕",Mid:"🧶",Outer:"🧥",Bottom:"👖",Footwear:"👟"};
  const total=list?Object.values(list).flat().length:0;
  const done=Object.values(checked).filter(Boolean).length;

  return (
    <div>
      <div style={{background:T.surface,border:`1.5px solid ${T.borderLight}`,borderRadius:16,padding:18,marginBottom:20}}>
        <p style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:4}}>🧳 Packing List</p>
        <p style={{fontSize:13,color:T.mid,marginBottom:16,lineHeight:1.6}}>Auto-generated for your 20-day AU/NZ trip. Deduplicates across all days.</p>
        <button onClick={gen} style={{padding:"11px 24px",background:T.text,color:"#fff",border:"none",borderRadius:12,fontWeight:700,fontSize:14,cursor:"pointer"}}>{list?"↺ Regenerate":"Generate List →"}</button>
      </div>
      {list&&<>
        <div style={{background:T.surface,border:`1.5px solid ${T.borderLight}`,borderRadius:14,padding:"14px 18px",marginBottom:20,display:"flex"}}>
          {ORDER.filter(l=>list[l]).map((l,i,arr)=>(
            <div key={l} style={{flex:1,textAlign:"center",borderRight:i<arr.length-1?`1px solid ${T.borderLight}`:"none"}}>
              <p style={{fontSize:20,fontWeight:800,color:T.text,lineHeight:1}}>{list[l].length}</p>
              <p style={{fontSize:9,color:T.light,fontWeight:600,letterSpacing:0.5,marginTop:3}}>{l.toUpperCase()}</p>
            </div>
          ))}
          <div style={{flex:1,textAlign:"center"}}>
            <p style={{fontSize:20,fontWeight:800,color:T.text,lineHeight:1}}>{total}</p>
            <p style={{fontSize:9,color:T.light,fontWeight:600,letterSpacing:0.5,marginTop:3}}>TOTAL</p>
          </div>
        </div>
        {done>0&&<div style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
            <p style={{fontSize:12,fontWeight:600,color:T.text}}>{done}/{total} packed</p>
            <p style={{fontSize:12,color:T.green,fontWeight:600}}>{Math.round(done/total*100)}%</p>
          </div>
          <div style={{background:T.borderLight,borderRadius:4,height:4}}>
            <div style={{height:"100%",background:T.green,width:`${done/total*100}%`,borderRadius:4,transition:"width 0.3s"}}/>
          </div>
        </div>}
        {ORDER.filter(l=>list[l]).map(layer=>(
          <div key={layer} style={{marginBottom:22}}>
            <p style={{fontSize:11,fontWeight:700,color:T.light,letterSpacing:1.5,marginBottom:10}}>{ICON[layer]} {LABEL[layer].toUpperCase()} ({list[layer].length})</p>
            {list[layer].map(item=>{
              const [bg,ac,fg]=swatch(item.col);
              return (
                <div key={item.id} onClick={()=>setChecked(c=>({...c,[item.id]:!c[item.id]}))}
                  style={{display:"flex",alignItems:"center",gap:12,background:checked[item.id]?T.alt:T.surface,border:`1.5px solid ${T.borderLight}`,borderRadius:12,padding:"10px 14px",marginBottom:8,cursor:"pointer",opacity:checked[item.id]?0.55:1,transition:"all 0.15s"}}>
                  <div style={{width:38,height:38,borderRadius:9,flexShrink:0,overflow:"hidden",background:`linear-gradient(145deg,${bg},${ac})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>
                    {item.img?<img src={item.img} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>:null}
                  </div>
                  <div style={{flex:1}}>
                    <p style={{fontSize:13,fontWeight:600,color:T.text,textDecoration:checked[item.id]?"line-through":"none"}}>{item.n}</p>
                    <p style={{fontSize:11,color:T.light}}>{item.b} · {item.col}</p>
                  </div>
                  <div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${checked[item.id]?T.green:T.border}`,background:checked[item.id]?T.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {checked[item.id]&&<span style={{color:"#fff",fontSize:11}}>✓</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </>}
    </div>
  );
}

/* ─── ROOT ──────────────────────────────────────────────────────────────────── */
export default function App() {
  const [tab,setTab]=useState("wardrobe");
  const [wardrobe,setWardrobe]=useState(W);
  const travel=wardrobe.filter(i=>i.t==="Yes").length;
  const NAV=[{id:"wardrobe",icon:"⊞",label:"WARDROBE"},{id:"trip",icon:"✈",label:"TRIP"},{id:"outfit",icon:"✦",label:"OUTFIT AI"},{id:"add",icon:"+",label:"ADD"},{id:"packing",icon:"⊛",label:"PACKING"}];

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'DM Sans','Helvetica Neue',sans-serif",color:T.text}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;700&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-thumb{background:${T.border};border-radius:4px}
        select,input{outline:none;}button:active{transform:scale(0.98);}
      `}</style>

      {/* Header */}
      <div style={{background:T.surface,borderBottom:`1px solid ${T.borderLight}`,position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:700,margin:"0 auto",padding:"0 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",height:54}}>
            <div style={{display:"flex",alignItems:"baseline",gap:10}}>
              <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,letterSpacing:-0.5,color:T.text}}>SOHIL-WARDROBE</span>
              <span style={{fontSize:10,color:T.light,letterSpacing:2,fontWeight:600}}>AU·NZ 2026</span>
            </div>
            <div style={{display:"flex",gap:16}}>
              <div style={{textAlign:"center"}}><p style={{fontSize:14,fontWeight:700,color:T.text,lineHeight:1}}>{wardrobe.length}</p><p style={{fontSize:8,color:T.light,letterSpacing:1,marginTop:1}}>ITEMS</p></div>
              <div style={{textAlign:"center"}}><p style={{fontSize:14,fontWeight:700,color:T.green,lineHeight:1}}>{travel}</p><p style={{fontSize:8,color:T.light,letterSpacing:1,marginTop:1}}>TRAVEL</p></div>
            </div>
          </div>
          <div style={{display:"flex",borderTop:`1px solid ${T.borderLight}`}}>
            {NAV.map(n=>(
              <button key={n.id} onClick={()=>setTab(n.id)} style={{flex:1,padding:"9px 0 10px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,position:"relative"}}>
                <span style={{fontSize:13,color:tab===n.id?T.text:T.light}}>{n.icon}</span>
                <span style={{fontSize:8,fontWeight:tab===n.id?700:500,color:tab===n.id?T.text:T.light,letterSpacing:0.8}}>{n.label}</span>
                {tab===n.id&&<div style={{position:"absolute",bottom:0,left:"15%",right:"15%",height:2,background:T.text,borderRadius:2}}/>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{maxWidth:700,margin:"0 auto",padding:"20px 16px 100px"}}>
        {tab==="wardrobe"&&<WardrobeTab wardrobe={wardrobe}/>}
        {tab==="trip"    &&<TripTab wardrobe={wardrobe}/>}
        {tab==="outfit"  &&<OutfitTab wardrobe={wardrobe}/>}
        {tab==="add"     &&<AddTab onAdd={item=>setWardrobe(w=>[...w,item])}/>}
        {tab==="packing" &&<PackTab wardrobe={wardrobe}/>}
      </div>
    </div>
  );
}
