// js/avatar.js — Low-resolution pixel portrait
// Logical canvas: 64×80 pixels, scaled up smoothly via CSS (pixelated).
// Face is an explicit oval shape (row-width table) — NOT a square.
// Default renderer uses modular image assets; the old procedural painter stays
// as a fallback while images are loading or if an asset is missing.
//
// Layer order (bottom→top):
//   bg → back-hair → body/outfit → head (masked oval) → face → front-hair → accessory
//
// Public API (unchanged):
//   renderAvatar(canvas, state)
//   createStandaloneAvatar(state)

const W = 64;
const H = 64;
const MODULAR_W = 72;
const MODULAR_H = 72;
const OUTLINE = '#1b1320';

// ─── Palettes ─────────────────────────────────────────────────
const SKIN = {
  light: { hi: '#ffe6cc', base: '#f4caa4', shade: '#c98c64', line: '#7a4528' },
  mid:   { hi: '#e3b487', base: '#c48a5a', shade: '#8a5530', line: '#4a2814' },
  dark:  { hi: '#8a5634', base: '#693a1f', shade: '#3e2010', line: '#1c0a05' },
};

const HAIR_COLORS = {
  black:  { hi: '#4a3c54', base: '#221828', shade: '#0a0610' },
  dark:   { hi: '#6e4c34', base: '#3a221a', shade: '#160a08' },
  brown:  { hi: '#b07840', base: '#6e3c1e', shade: '#3a1d0c' },
  blonde: { hi: '#ffe8a8', base: '#d8a850', shade: '#946826' },
  pink:   { hi: '#ffc4e0', base: '#e070b0', shade: '#8c2860' },
  silver: { hi: '#ffffff', base: '#c8c8d4', shade: '#6e6e80' },
  red:    { hi: '#ff9870', base: '#c44030', shade: '#6a1a0e' },
  blue:   { hi: '#9ac4ff', base: '#4870c0', shade: '#1c3878' },
};

const SHIRT_COLORS = [
  { hi: '#7ab4dc', base: '#4682b4', shade: '#1e4264' }, // 0  ocean blue
  { hi: '#ea8080', base: '#c44040', shade: '#6e1414' }, // 1  crimson
  { hi: '#74c890', base: '#2a8a48', shade: '#0e4220' }, // 2  forest green
  { hi: '#ffd860', base: '#d8a020', shade: '#7a5008' }, // 3  mustard
  { hi: '#b48ade', base: '#7848a8', shade: '#341858' }, // 4  amethyst
  { hi: '#ffa470', base: '#e07028', shade: '#7a3608' }, // 5  pumpkin
  { hi: '#82d4d4', base: '#38a8a8', shade: '#0e4a4a' }, // 6  teal
  { hi: '#f0a8cc', base: '#d878a8', shade: '#823856' }, // 7  rose
  { hi: '#ffffff', base: '#dadada', shade: '#7a7a7a' }, // 8  pearl
  { hi: '#5a5a6e', base: '#2a2a3a', shade: '#0c0c14' }, // 9  midnight
  { hi: '#a8e070', base: '#5ca228', shade: '#2e5a0e' }, // 10 lime
  { hi: '#d8b48a', base: '#8a5a30', shade: '#3e2410' }, // 11 caramel
  { hi: '#80a8e0', base: '#3858a8', shade: '#162454' }, // 12 royal blue
  { hi: '#e8c878', base: '#a87830', shade: '#503608' }, // 13 bronze
  { hi: '#e0a0c0', base: '#a04880', shade: '#581e3e' }, // 14 berry
  { hi: '#a0d8e8', base: '#4894b0', shade: '#1e4a5c' }, // 15 sky
];

// ─── State→trait helpers ──────────────────────────────────────
function skinOf(s) {
  // Explicit player-picked skin tone (0 dark / 1 mid / 2 light) takes precedence;
  // fall back to HLT-derived tone for legacy / runtime use.
  if (typeof s.skinTone === 'number') {
    return s.skinTone >= 2 ? SKIN.light : s.skinTone <= 0 ? SKIN.dark : SKIN.mid;
  }
  const v = s.HLT ?? 5;
  return v >= 7 ? SKIN.light : v >= 4 ? SKIN.mid : SKIN.dark;
}
function bodyTypeOf(s) {
  const h = s.HLT ?? 5;
  if (h >= 8) return 'fit';
  if (h <= 3) return 'soft';
  return 'normal';
}
function hairColorOf(s) {
  const keys = Object.keys(HAIR_COLORS);
  return HAIR_COLORS[keys[(s.outfitColorId ?? 0) % keys.length]];
}
function shirtColorOf(s) { return SHIRT_COLORS[(s.outfitColorId ?? 0) % SHIRT_COLORS.length]; }
function hairStyleOf(s) {
  const male = ['short', 'spiky', 'swept', 'messy', 'undercut', 'curtains'];
  const female = ['long', 'wavy', 'ponytail', 'bob', 'twintail', 'bun'];
  const pool = s.sex === 0 ? male : female;
  return pool[(s.topVariant ?? 0) % pool.length];
}
function outfitOf(s) {
  if (s._forceOutfit) return s._forceOutfit;
  const sl = s.storyline;
  const v = s.topVariant ?? 0;
  const pick = pool => pool[v % pool.length];

  // ── 1. Storyline-locked outfits (highest priority) ──
  if (sl === 'idol' || sl === 'superstar') return pick(['idol', 'idol_dress', 'idol_jacket']);
  if (sl === 'xianxia') return pick(['hanfu', 'daoist_robe', 'sect_uniform']);
  if (sl === 'chef') return 'chef';
  if (sl === 'hogwarts') return pick(['robe', 'house_robe']);
  if (sl === 'abyss') return 'labcoat';
  if (sl === 'spy') return pick(['suit', 'trench', 'tactical']);
  if (sl === 'ceo') return pick(['tuxedo', 'suit', 'premium_suit']);
  if (sl === 'fitness' || sl === 'athlete') return pick(['tank', 'tracksuit', 'jersey']);
  if (sl === 'thief') return 'thief';
  if (sl === 'esports' || sl === 'worlds' || sl === 'minor_league') return pick(['gaming_jersey', 'hoodie', 'tracksuit']);
  if (sl === 'poker') return pick(['poker_vest', 'suit', 'hoodie']);
  if (sl === 'party') return pick(['politician', 'suit', 'sweater_v']);
  if (sl === 'academic') return pick(['hoodie', 'tee', 'tracksuit']);
  if (sl === 'band') return pick(['tee', 'hoodie', 'tracksuit']);
  if (sl === 'triton') return pick(['naval', 'tactical']);
  if (sl === 'meta') return pick(['hoodie', 'tracksuit', 'tee']);

  // ── 2. Low-stat distress wear (overrides money/profession) ──
  const mny = s.MNY ?? 5;
  const hap = s.HAP ?? 5;
  if (mny <= 1 && hap <= 2) return 'ragged';
  if (mny <= 1) return pick(['ragged', 'patched_tee']);
  if (hap <= 1) return 'pajamas';

  // ── 3. Profession + stage-aware pool ──
  const prof = s.profession || '';
  const major = s.major || '';
  const hobby = s.hobby || '';
  const month = s.month ?? 6;
  const isWinter = month <= 2 || month >= 11;
  const isSummer = month >= 6 && month <= 8;

  // High schooler — uniform variants + PE
  if (prof === '高中生') {
    if (s.hsType === '国际') return pick(['school_blazer', 'school', 'cardigan']);
    return pick(['school', 'school_pe', 'school_blazer']);
  }

  // Undergrad — many casual pools, biased by major / hobby / season
  if (prof === '本科生') {
    const pool = ['tee', 'hoodie', 'denim_jacket', 'varsity', 'sweater_v', 'cardigan', 'flannel', 'polo'];
    if (major === 'CS') pool.unshift('cs_hoodie', 'hoodie');
    if (major === '商科') pool.unshift('blazer', 'polo');
    if (major === '理科') pool.unshift('polo', 'sweater_v');
    if (major === '文科') pool.unshift('turtleneck', 'cardigan');
    if (major === '文艺') pool.unshift('art_smock', 'beret_top', 'striped_tee');
    if (hobby === '电竞') pool.unshift('gaming_jersey');
    if (hobby === '跑步' || hobby === '健身') pool.unshift('tracksuit', 'tank');
    if (hobby === '摄影') pool.unshift('photo_vest');
    if (isWinter) pool.unshift('winter_coat', 'puffer', 'sweater_v');
    if (isSummer) pool.unshift('tee', 'tank', 'hawaiian');
    return pick(pool);
  }

  // Grad student — academic vibe
  if (prof === '研究生' || prof === '博士') {
    return pick(['grad_hoodie', 'cardigan', 'turtleneck', 'flannel', 'sweater_v', 'cs_hoodie']);
  }

  // Job hunting — sad cheap suit pool
  if (prof === '求职中') return pick(['cheap_suit', 'shirt_tie', 'sweater_v']);

  // Working — by MNY tier
  if (prof === '工作' || prof === '职场人') {
    if (mny >= 9) return pick(['tuxedo', 'premium_suit', 'suit']);
    if (mny >= 7) return pick(['suit', 'shirt_tie', 'blazer']);
    if (mny >= 4) return pick(['shirt_tie', 'polo', 'sweater_v', 'blazer']);
    return pick(['shirt_tie', 'flannel', 'tee']);
  }

  // Retired
  if (prof === '退休' || prof === '老年') return pick(['cardigan', 'sweater_v', 'flannel', 'pajamas']);

  // ── 4. Money tier fallback (general) ──
  if (mny >= 10) return pick(['tuxedo', 'premium_suit']);
  if (mny >= 8) return pick(['suit', 'premium_suit', 'blazer']);

  // ── 5. Default casual pool, season-biased ──
  const casual = ['tee', 'hoodie', 'jacket', 'flannel', 'polo', 'sweater_v', 'denim_jacket'];
  if (isWinter) casual.unshift('winter_coat', 'puffer');
  if (isSummer) casual.unshift('tank', 'hawaiian');
  return pick(casual);
}
function accessoryOf(s) {
  const sl = s.storyline;
  if (sl === 'esports' || sl === 'worlds' || sl === 'minor_league') return 'headphones';
  if (sl === 'chef') return 'chef_hat';
  if (sl === 'abyss') return 'goggles';
  if (sl === 'thief') return 'mask';
  if (sl === 'hogwarts') return 'glasses';
  if (sl === 'academic') return 'headphones';
  if (sl === 'band') return 'headphones';
  if ((s.INT ?? 5) >= 8) return 'glasses';
  return null;
}
function eyeColorOf(s) {
  const colors = ['#3a5aa8', '#5a3818', '#1e6a3a', '#7a2880', '#a05818', '#2a8aa8'];
  return colors[(s.outfitColorId ?? 0) % colors.length];
}

// ─── Pixel primitives ─────────────────────────────────────────
function px(ctx, x, y, c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
function hline(ctx, x, y, w, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, 1); }

// Fill a shape by a row-width table. `rows[i] = [innerWidth, leftPad?]` (leftPad optional, centers if omitted).
// Returns the actual painted cells as a Set "x,y" so we can later derive an outline.
function fillRows(ctx, x0, y0, rows, color) {
  const cells = new Set();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const wRow = Array.isArray(r) ? r[0] : r;
    const widest = Math.max(...rows.map(rr => Array.isArray(rr) ? rr[0] : rr));
    const pad = Array.isArray(r) && r.length > 1 ? r[1] : Math.floor((widest - wRow) / 2);
    for (let j = 0; j < wRow; j++) {
      const x = x0 + pad + j, y = y0 + i;
      cells.add(x + ',' + y);
    }
  }
  ctx.fillStyle = color;
  for (const k of cells) {
    const [x, y] = k.split(',').map(Number);
    ctx.fillRect(x, y, 1, 1);
  }
  return cells;
}

// Draw outline (1px) around an interior cell set: any cell adjacent to a non-member.
function drawOutlineAround(ctx, cells, color, skipTrapped = false) {
  ctx.fillStyle = color;
  const has = k => cells.has(k);
  for (const k of cells) {
    const [x, y] = k.split(',').map(Number);
    const N = [[x,y-1],[x,y+1],[x-1,y],[x+1,y]];
    for (const [nx, ny] of N) {
      const key = nx + ',' + ny;
      if (has(key)) continue;
      // When outlining a concave silhouette (hair), skip empty cells that are
      // horizontally trapped between two hair columns — those dips would otherwise
      // read as dark triangular holes inside the hair mass.
      if (skipTrapped && has((nx - 1) + ',' + ny) && has((nx + 1) + ',' + ny)) continue;
      ctx.fillRect(nx, ny, 1, 1);
    }
  }
}

// ─── Outfit detail primitives ────────────────────────────────
// All assume `cx` = HEAD_CX (32) and y coords are absolute pixel rows.

// Necktie: rectangular knot + tapered body + point. Length includes knot.
function drawTie(ctx, cx, top, len, color, knotColor) {
  rect(ctx, cx - 2, top, 4, 1, knotColor || color);       // knot top
  rect(ctx, cx - 1, top + 1, 3, 1, knotColor || color);   // knot bottom
  rect(ctx, cx - 1, top + 2, 2, len - 3, color);          // body
  px(ctx, cx - 1, top + len - 1, color);                  // tip pt 1
  px(ctx, cx, top + len - 1, color);                      // tip pt 2
  px(ctx, cx, top + len, color);                          // sharp pt
}

// Bow tie centered at cx, vertical center at top.
function drawBowtie(ctx, cx, top, color, hi) {
  rect(ctx, cx - 3, top, 7, 2, color);
  px(ctx, cx - 3, top - 1, color);
  px(ctx, cx + 3, top - 1, color);
  px(ctx, cx - 3, top + 2, color);
  px(ctx, cx + 3, top + 2, color);
  rect(ctx, cx, top, 1, 2, hi || color);
}

// Suit-style lapels: triangular wedges flanking the V-opening.
// Returns the "V cutout" rows so caller can paint inner shirt.
function drawLapels(ctx, cx, top, depth, color, shadeC) {
  for (let i = 0; i < depth; i++) {
    // outer slope of lapel: 1 col further out each row, 2 px thick
    const xL = cx - 3 - Math.floor(i / 2);
    const xR = cx + 2 + Math.floor(i / 2);
    rect(ctx, xL, top + i, 2, 1, color);
    rect(ctx, xR, top + i, 2, 1, color);
    if (shadeC) {
      px(ctx, xL, top + i, shadeC);
      px(ctx, xR + 1, top + i, shadeC);
    }
  }
}

// Paint a V-shape inner shirt opening behind lapels.
// `bottom` = how deep the V cuts (rows), color = inner shirt color.
function drawShirtV(ctx, cx, top, depth, color) {
  for (let i = 0; i < depth; i++) {
    const w = Math.min(2 + i, 5);
    rect(ctx, cx - Math.floor(w / 2), top + i, w, 1, color);
  }
}

// Crew / round collar — small dark arc just under the neck.
function drawCrewCollar(ctx, cx, top, color) {
  rect(ctx, cx - 3, top, 6, 1, color);
  px(ctx, cx - 4, top + 1, color);
  px(ctx, cx + 3, top + 1, color);
}

// Polo collar — two flared wings + button placket.
function drawPoloCollar(ctx, cx, top, color, buttonColor) {
  rect(ctx, cx - 3, top, 6, 1, color);
  px(ctx, cx - 4, top + 1, color);
  px(ctx, cx + 3, top + 1, color);
  // placket
  px(ctx, cx, top + 1, buttonColor);
  px(ctx, cx, top + 3, buttonColor);
}

// High dress-shirt collar — small triangular wings flanking neck.
function drawShirtCollar(ctx, cx, top, color, shadeC) {
  px(ctx, cx - 3, top, color);
  px(ctx, cx + 2, top, color);
  px(ctx, cx - 2, top + 1, color);
  px(ctx, cx + 1, top + 1, color);
  if (shadeC) {
    px(ctx, cx - 3, top + 1, shadeC);
    px(ctx, cx + 2, top + 1, shadeC);
  }
}

// Sailor-fuku collar — big square flap on the back/upper torso.
function drawSailorCollar(ctx, cx, top, color, stripeColor) {
  // wide square collar
  rect(ctx, cx - 5, top, 11, 1, color);
  rect(ctx, cx - 5, top + 1, 3, 4, color);
  rect(ctx, cx + 3, top + 1, 3, 4, color);
  // V opening shows shirt below
  for (let i = 0; i < 4; i++) {
    px(ctx, cx - 2 + i, top + 1 + i, color);
  }
  // stripe trim
  if (stripeColor) {
    px(ctx, cx - 5, top + 5, stripeColor);
    px(ctx, cx - 4, top + 5, stripeColor);
    px(ctx, cx + 4, top + 5, stripeColor);
    px(ctx, cx + 5, top + 5, stripeColor);
  }
}

// Vertical button column.
function drawButtons(ctx, cx, top, count, gap, color) {
  for (let i = 0; i < count; i++) px(ctx, cx, top + i * gap, color);
}

// Hood draped over shoulders, EXTENDS above torsoTop. Width auto from widest row.
function drawHood(ctx, cx, top, widest, color, inner) {
  const half = Math.floor(widest / 2);
  // 3 rows above torso top, narrower at the very top
  rect(ctx, cx - half + 3, top - 3, widest - 6, 1, color);
  rect(ctx, cx - half + 2, top - 2, widest - 4, 1, color);
  rect(ctx, cx - half + 2, top - 1, widest - 4, 1, color);
  // inner lining V at neckline
  if (inner) {
    rect(ctx, cx - 2, top, 4, 1, inner);
    rect(ctx, cx - 1, top + 1, 2, 2, inner);
  }
  // drawstring dots
  px(ctx, cx - 2, top + 3, OUTLINE);
  px(ctx, cx + 1, top + 3, OUTLINE);
}

// Chest pocket — small rectangle, optionally outlined.
function drawPocket(ctx, x, y, w, h, color, outlineC) {
  rect(ctx, x, y, w, h, color);
  if (outlineC) {
    hline(ctx, x, y, w, outlineC);
    hline(ctx, x, y + h - 1, w, outlineC);
  }
}

// Front zipper line.
function drawZipper(ctx, cx, top, len, color) {
  for (let i = 0; i < len; i++) px(ctx, cx, top + i, color);
  // teeth dots
  for (let i = 0; i < len; i += 2) px(ctx, cx + 1, top + i, color);
}

// Kangaroo pocket on the front (hoodie).
function drawKangarooPocket(ctx, cx, top, color) {
  rect(ctx, cx - 5, top, 11, 4, color);
  // hand slits
  px(ctx, cx - 4, top + 1, OUTLINE);
  px(ctx, cx + 4, top + 1, OUTLINE);
  px(ctx, cx - 4, top + 2, OUTLINE);
  px(ctx, cx + 4, top + 2, OUTLINE);
}


// ─── Head shape (oval / 瓜子脸 — explicitly NOT a square) ────
// Row widths from top to bottom of head. Total 20 rows, max width 16.
// Forehead wider, cheeks widest, jaw narrows, chin pointed.
const HEAD_ROWS = [
  6,   // 0  top of skull
  10,  // 1
  12,  // 2
  14,  // 3
  16,  // 4  forehead
  16,  // 5
  16,  // 6  temples
  16,  // 7  brow line
  16,  // 8
  16,  // 9  eye line
  16,  // 10
  14,  // 11 cheekbone narrowing
  14,  // 12 nose
  12,  // 13
  12,  // 14
  10,  // 15 mouth line
  10,  // 16
  8,   // 17 jaw
  6,   // 18
  4,   // 19 chin
];
const HEAD_X = 24;  // left of widest row (HEAD_CX - 8)
const HEAD_Y = 12;
const HEAD_CX = 32; // center x
const FACE_TOP = HEAD_Y;
const FACE_BOT = HEAD_Y + HEAD_ROWS.length - 1; // = 31

// ─── Background ───────────────────────────────────────────────
function drawBg(ctx, state) {
  // Simple two-tone, user said they'd swap with AI bg later.
  const top = '#2c3850';
  const bot = '#5a6e90';
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // soft floor disc
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, H - 4, W, 4);
}

// ─── Body / outfit ────────────────────────────────────────────
function drawBody(ctx, state) {
  const skin = skinOf(state);
  const shirt = shirtColorOf(state);
  const outfit = outfitOf(state);
  const female = state.sex === 1;

  // neck (6 wide, 4 tall) — thicker
  rect(ctx, HEAD_CX - 3, FACE_BOT - 1, 6, 5, skin.base);
  rect(ctx, HEAD_CX - 3, FACE_BOT + 3, 6, 1, skin.shade);
  // collarbone shadow under jaw
  rect(ctx, HEAD_CX - 2, FACE_BOT - 1, 4, 1, skin.shade);
  // neck outline
  px(ctx, HEAD_CX - 4, FACE_BOT, OUTLINE);
  px(ctx, HEAD_CX + 3, FACE_BOT, OUTLINE);
  px(ctx, HEAD_CX - 4, FACE_BOT + 1, OUTLINE);
  px(ctx, HEAD_CX + 3, FACE_BOT + 1, OUTLINE);
  px(ctx, HEAD_CX - 4, FACE_BOT + 2, OUTLINE);
  px(ctx, HEAD_CX + 3, FACE_BOT + 2, OUTLINE);

  // torso shape via rows — rectangular silhouette, width by sex + body type (HLT)
  // Female silhouette gets a subtle hourglass (bust → waist → hips) instead of a flat box.
  const torsoTop = FACE_BOT + 3;
  const bodyType = bodyTypeOf(state);
  const PROFILE = {
    male:   { fit: { w: 24, armW: 4 }, normal: { w: 26, armW: 3 }, soft: { w: 30, armW: 4 } },
    female: { fit: { w: 22, armW: 3 }, normal: { w: 24, armW: 3 }, soft: { w: 28, armW: 4 } },
  };
  const prof = PROFILE[female ? 'female' : 'male'][bodyType];
  const torsoRows = [];
  torsoRows.push([Math.max(4, prof.w - 6)]);
  torsoRows.push([Math.max(6, prof.w - 3)]);
  if (female) {
    // 26 rows: 6 bust (full w), 8 waist (w-2 in middle), 12 hips (w or +2 for soft)
    const waist = Math.max(prof.w - 2, prof.w - (bodyType === 'soft' ? 0 : 2));
    const hip = prof.w + (bodyType === 'soft' ? 2 : 0);
    for (let i = 0; i < 6; i++) torsoRows.push([prof.w]);          // bust
    for (let i = 0; i < 8; i++) torsoRows.push([waist]);            // waist
    for (let i = 0; i < 12; i++) torsoRows.push([hip]);             // hips
  } else {
    for (let i = 0; i < 26; i++) torsoRows.push([prof.w]);
  }
  const widestTorso = Math.max(...torsoRows.map(r => r[0]));
  const torsoX0 = HEAD_CX - Math.floor(widestTorso / 2);

  let base = shirt.base, hi = shirt.hi, shade = shirt.shade, accent = null;
  if (outfit === 'school')       { base = '#f4f0e4'; hi = '#ffffff'; shade = '#a8a494'; accent = shirt.base; }
  else if (outfit === 'school_blazer') { base = '#1c2848'; hi = '#3a4870'; shade = '#0a0e1c'; accent = '#c43838'; }
  else if (outfit === 'school_pe') { base = '#e8e8ec'; hi = '#ffffff'; shade = '#9c9ca0'; accent = '#c43838'; }
  else if (outfit === 'suit')    { base = '#252535'; hi = '#3c3c54'; shade = '#0a0a14'; accent = '#f4f0e4'; }
  else if (outfit === 'premium_suit') { base = '#1c1c2c'; hi = '#2e2e44'; shade = '#06060c'; accent = shirt.base; }
  else if (outfit === 'tuxedo')  { base = '#0a0a14'; hi = '#1c1c28'; shade = '#000000'; accent = '#ffffff'; }
  else if (outfit === 'cheap_suit') { base = '#3c3c48'; hi = '#54546a'; shade = '#1c1c24'; accent = '#7a7060'; }
  else if (outfit === 'shirt_tie') { base = '#f0f0f4'; hi = '#ffffff'; shade = '#a0a0a8'; accent = shirt.base; }
  else if (outfit === 'blazer')  { base = shirt.shade; hi = shirt.base; shade = '#000'; accent = '#f4f0e4'; }
  else if (outfit === 'chef')    { base = '#f4f0e4'; hi = '#ffffff'; shade = '#b8b4a4'; accent = '#1c1c28'; }
  else if (outfit === 'robe')    { base = '#1a1018'; hi = '#3a2438'; shade = '#080408'; accent = shirt.base; }
  else if (outfit === 'house_robe') { base = '#1a1018'; hi = '#3a2438'; shade = '#080408'; accent = shirt.base; }
  else if (outfit === 'labcoat') { base = '#f4f0e4'; hi = '#ffffff'; shade = '#b8b4a4'; accent = '#5a8aaa'; }
  else if (outfit === 'hanfu')   { base = '#e8d8b4'; hi = '#fff0d8'; shade = '#a89878'; accent = '#a83838'; }
  else if (outfit === 'daoist_robe') { base = '#c0c0d0'; hi = '#e0e0ec'; shade = '#70708a'; accent = '#2a3852'; }
  else if (outfit === 'sect_uniform') { base = '#2a4858'; hi = '#4a7090'; shade = '#0e1c24'; accent = '#d8c060'; }
  else if (outfit === 'idol')    { base = '#f070b0'; hi = '#ffb4d8'; shade = '#a83878'; accent = '#fff070'; }
  else if (outfit === 'idol_dress') { base = '#ffb4d8'; hi = '#ffffff'; shade = '#c47090'; accent = '#a020a0'; }
  else if (outfit === 'idol_jacket') { base = '#fff070'; hi = '#ffffc8'; shade = '#a87830'; accent = '#f070b0'; }
  else if (outfit === 'thief')   { base = '#1a1a24'; hi = '#2e2e3c'; shade = '#08080c'; }
  else if (outfit === 'tactical') { base = '#28342a'; hi = '#445248'; shade = '#0c1410'; accent = '#1c1c20'; }
  else if (outfit === 'trench')  { base = '#a89070'; hi = '#c8b090'; shade = '#5a4828'; accent = '#3c2810'; }
  else if (outfit === 'naval')   { base = '#1a2848'; hi = '#3858a8'; shade = '#080e1c'; accent = '#ffffff'; }
  else if (outfit === 'politician') { base = '#28304a'; hi = '#445270'; shade = '#0e121e'; accent = '#c43838'; }
  else if (outfit === 'tank')    { base = shirt.base; hi = shirt.hi; shade = shirt.shade; }
  else if (outfit === 'tracksuit') { base = shirt.shade; hi = shirt.base; shade = '#0a0a0e'; accent = '#ffffff'; }
  else if (outfit === 'jersey')  { base = shirt.base; hi = shirt.hi; shade = shirt.shade; accent = '#ffffff'; }
  else if (outfit === 'gaming_jersey') { base = '#0e0e18'; hi = '#2a2a3c'; shade = '#040408'; accent = shirt.base; }
  else if (outfit === 'poker_vest') { base = '#1c1c28'; hi = '#34344a'; shade = '#06060c'; accent = '#a83030'; }
  else if (outfit === 'jacket')  { base = shirt.shade; hi = shirt.base; shade = '#000'; accent = shirt.base; }
  else if (outfit === 'denim_jacket') { base = '#3858a0'; hi = '#5878c0'; shade = '#1c2c5c'; accent = '#d8b870'; }
  else if (outfit === 'varsity') { base = shirt.shade; hi = shirt.base; shade = '#0a0a0e'; accent = '#f4f0e4'; }
  else if (outfit === 'flannel') { base = shirt.base; hi = shirt.hi; shade = shirt.shade; accent = '#1c1c20'; }
  else if (outfit === 'hawaiian') { base = shirt.base; hi = shirt.hi; shade = shirt.shade; accent = '#fff070'; }
  else if (outfit === 'striped_tee') { base = shirt.hi; hi = shirt.base; shade = shirt.shade; accent = shirt.shade; }
  else if (outfit === 'polo')    { base = shirt.base; hi = shirt.hi; shade = shirt.shade; accent = '#f4f0e4'; }
  else if (outfit === 'cardigan') { base = shirt.shade; hi = shirt.base; shade = '#0a0a14'; accent = '#d8b870'; }
  else if (outfit === 'sweater_v') { base = shirt.base; hi = shirt.hi; shade = shirt.shade; accent = '#f4f0e4'; }
  else if (outfit === 'turtleneck') { base = shirt.shade; hi = shirt.base; shade = '#0a0a14'; }
  else if (outfit === 'winter_coat') { base = shirt.shade; hi = shirt.base; shade = '#000'; accent = '#7a5a3c'; }
  else if (outfit === 'puffer')  { base = shirt.base; hi = shirt.hi; shade = shirt.shade; accent = shirt.shade; }
  else if (outfit === 'cs_hoodie') { base = '#1c1c28'; hi = '#34344a'; shade = '#06060c'; accent = '#74c890'; }
  else if (outfit === 'grad_hoodie') { base = '#2a2848'; hi = '#42406a'; shade = '#0e0e1c'; accent = '#d8b870'; }
  else if (outfit === 'art_smock') { base = '#e8e0d0'; hi = '#fff8e8'; shade = '#a89878'; accent = shirt.base; }
  else if (outfit === 'beret_top') { base = shirt.base; hi = shirt.hi; shade = shirt.shade; accent = '#1c1c20'; }
  else if (outfit === 'photo_vest') { base = '#54483c'; hi = '#7a6850'; shade = '#1e1810'; accent = '#1c1c20'; }
  else if (outfit === 'ragged')  { base = '#5a4a3c'; hi = '#7a6850'; shade = '#2a1e14'; accent = '#1c1c20'; }
  else if (outfit === 'patched_tee') { base = shirt.shade; hi = shirt.base; shade = '#000'; accent = '#5a4a3c'; }
  else if (outfit === 'pajamas') { base = '#7090c0'; hi = '#a0c0e0'; shade = '#384868'; accent = '#ffffff'; }

  const torsoCells = fillRows(ctx, torsoX0, torsoTop, torsoRows, base);

  // ---- Light shading (keep silhouette rectangular) ----
  const rowEdges = torsoRows.map((r, i) => {
    const w = r[0];
    const pad = Math.floor((widestTorso - w) / 2);
    return { y: torsoTop + i, left: torsoX0 + pad, right: torsoX0 + pad + w - 1, w };
  });
  // Right edge: 1 column of shade for whole height
  ctx.fillStyle = shade;
  for (const re of rowEdges) ctx.fillRect(re.right, re.y, 1, 1);
  // Bottom row darker (hem shadow)
  {
    const re = rowEdges[rowEdges.length - 1];
    for (let x = re.left; x <= re.right; x++) ctx.fillRect(x, re.y, 1, 1);
  }
  // Faint center seam — only on plain tops, every 3rd row, very subtle
  if (!['suit','hoodie','idol','hanfu','robe','school','chef','labcoat'].includes(outfit)) {
    for (let i = 6; i < rowEdges.length - 3; i += 3) {
      const re = rowEdges[i];
      if (re.w >= 10) ctx.fillRect(HEAD_CX, re.y, 1, 1);
    }
  }
  // Left edge: 1 column of highlight
  ctx.fillStyle = hi;
  for (const re of rowEdges) ctx.fillRect(re.left, re.y, 1, 1);

  // Female-only: subtle bust curve hint (shade under the chest line, highlight on top of bust)
  if (female) {
    ctx.fillStyle = shade;
    // shade line under the bust (row index ~7, just before the waist starts)
    const bustY = torsoTop + 7;
    px(ctx, HEAD_CX - 4, bustY, shade);
    px(ctx, HEAD_CX - 3, bustY + 1, shade);
    px(ctx, HEAD_CX + 3, bustY, shade);
    px(ctx, HEAD_CX + 2, bustY + 1, shade);
    // a soft highlight on top of each bust to suggest roundness
    ctx.fillStyle = hi;
    px(ctx, HEAD_CX - 4, torsoTop + 4, hi);
    px(ctx, HEAD_CX + 3, torsoTop + 4, hi);
  }

  // outline around torso
  drawOutlineAround(ctx, torsoCells, OUTLINE);

  // collar / outfit details (drawn over fill)
  if (outfit === 'school') {
    // 体制内白衬衫 + 红领带
    // 领子: 2 片小三角翻领
    px(ctx, HEAD_CX - 3, torsoTop, '#a8a494');
    px(ctx, HEAD_CX - 2, torsoTop + 1, '#a8a494');
    px(ctx, HEAD_CX + 2, torsoTop, '#a8a494');
    px(ctx, HEAD_CX + 1, torsoTop + 1, '#a8a494');
    px(ctx, HEAD_CX - 3, torsoTop + 1, shade);
    px(ctx, HEAD_CX + 2, torsoTop + 1, shade);
    // 领带: 3px 宽, 10px 长, 带领结
    drawTie(ctx, HEAD_CX, torsoTop + 2, 10, '#c43838', '#7a1818');
    // 胸前口袋
    drawPocket(ctx, HEAD_CX + 3, torsoTop + 5, 4, 3, base, shade);
    // 口袋上的铅笔
    px(ctx, HEAD_CX + 4, torsoTop + 4, '#3858a0');
    // 4 粒纵向纹扣(在领带右侧)
    drawButtons(ctx, HEAD_CX + 2, torsoTop + 9, 3, 2, shade);
    // 手臂袖口深色圈(短袖压线) — short-sleeve hem cue
    hline(ctx, HEAD_CX - 9, torsoTop + 3, 3, shade);
    hline(ctx, HEAD_CX + 7, torsoTop + 3, 3, shade);
  } else if (outfit === 'school_blazer') {
    // 国际部 / 日系西装校服: 深藍西装外套 + 白衬衫 + 红/藍领带 + 金色校徽
    // 1) 内衣 V: 3 行递增的白衬衫开口
    drawShirtV(ctx, HEAD_CX, torsoTop, 4, '#f4f0e4');
    // 2) 西装翻领: 两侧倒三角 wedge
    drawLapels(ctx, HEAD_CX, torsoTop, 5, base, shade);
    // 3) 领带
    drawTie(ctx, HEAD_CX, torsoTop + 2, 9, '#c43838', '#7a1818');
    // 4) 胸前校徽: 金色 2x3
    rect(ctx, HEAD_CX - 6, torsoTop + 4, 2, 3, '#d8b870');
    px(ctx, HEAD_CX - 5, torsoTop + 5, '#7a5008');
    // 5) 扣子两粒(腰际)
    px(ctx, HEAD_CX - 1, torsoTop + 12, '#d8b870');
    px(ctx, HEAD_CX + 1, torsoTop + 12, '#d8b870');
    // 6) 侧口袋小横线
    hline(ctx, HEAD_CX - 7, torsoTop + 10, 4, shade);
    hline(ctx, HEAD_CX + 3, torsoTop + 10, 4, shade);
  } else if (outfit === 'school_pe') {
    // 白色运动 polo + 侧身红色走条 + 胸前校名缩写
    drawPoloCollar(ctx, HEAD_CX, torsoTop, accent, shade);
    // 胸前绿色编号牌
    rect(ctx, HEAD_CX - 5, torsoTop + 4, 4, 3, accent);
    px(ctx, HEAD_CX - 4, torsoTop + 5, base);
    px(ctx, HEAD_CX - 3, torsoTop + 5, base);
    // 侧身红条
    for (let i = 0; i < 14; i++) {
      px(ctx, HEAD_CX - 9, torsoTop + i, accent);
      px(ctx, HEAD_CX + 8, torsoTop + i, accent);
    }
    // 下摆深线
    hline(ctx, HEAD_CX - 8, torsoTop + 13, 16, shade);
  } else if (outfit === 'suit') {
    // 正装西装: 大翻领 + 白衬衫三角 + 领带
    drawShirtV(ctx, HEAD_CX, torsoTop, 6, '#f4f0e4');
    drawLapels(ctx, HEAD_CX, torsoTop, 6, base, shade);
    drawTie(ctx, HEAD_CX, torsoTop + 2, 9, shirt.base, shirt.shade);
    // 口袋布
    rect(ctx, HEAD_CX - 7, torsoTop + 7, 3, 2, accent);
    px(ctx, HEAD_CX - 6, torsoTop + 6, accent);
    // 2 粒扣
    px(ctx, HEAD_CX, torsoTop + 11, shade);
    px(ctx, HEAD_CX, torsoTop + 14, shade);
    // 中缝
    for (let i = 7; i < 16; i++) px(ctx, HEAD_CX - 1, torsoTop + i, shade);
  } else if (outfit === 'hoodie') {
    // 连帽卫衣: 大连帽覆盖肩部 + 拉绳 + 袋鼠口袋
    drawHood(ctx, HEAD_CX, torsoTop, widestTorso, shade, hi);
    drawKangarooPocket(ctx, HEAD_CX, torsoTop + 8, shade);
    // 拉链(半拉式)
    for (let i = 0; i < 4; i++) px(ctx, HEAD_CX, torsoTop + 3 + i, OUTLINE);
    // 拉绳结结点
    px(ctx, HEAD_CX - 2, torsoTop + 4, hi);
    px(ctx, HEAD_CX + 1, torsoTop + 4, hi);
  } else if (outfit === 'hanfu') {
    // 汉服: 交领(斗) + 广袖 + 腰间丝带 + 胸前圈云纹
    // 交领: 右衣片压在左衣片上面, 形成斜向的 y 型闭合
    for (let i = 0; i < 8; i++) {
      // 左衣片外边线(斜入)
      px(ctx, HEAD_CX - 4 + i, torsoTop + i, accent);
      px(ctx, HEAD_CX - 5 + i, torsoTop + i, shade);
    }
    // 右衣片豆豆
    for (let i = 0; i < 4; i++) {
      px(ctx, HEAD_CX + 4 + i, torsoTop + i, accent);
    }
    // 领口云纹装饰
    rect(ctx, HEAD_CX - 3, torsoTop, 6, 1, accent);
    px(ctx, HEAD_CX, torsoTop + 1, accent);
    // 腰带(室底中间)
    rect(ctx, HEAD_CX - 9, torsoTop + 10, 18, 3, accent);
    rect(ctx, HEAD_CX - 9, torsoTop + 10, 18, 1, '#7a2828');
    rect(ctx, HEAD_CX - 9, torsoTop + 12, 18, 1, '#7a2828');
    // 腰带结 + 流苏(垂下)
    rect(ctx, HEAD_CX - 1, torsoTop + 13, 2, 5, accent);
    px(ctx, HEAD_CX - 1, torsoTop + 17, '#7a2828');
    px(ctx, HEAD_CX, torsoTop + 17, '#7a2828');
  } else if (outfit === 'robe') {
    // 霍格沃茨长袍: 黑袍 + 象德色围巾(红金竖条) + 胸前徽章
    // 围巾(高领): 两色纵向条纹, 挂在肩部两侧垂下
    const scarfL = HEAD_CX - 6, scarfR = HEAD_CX + 4;
    for (let i = 0; i < 6; i++) {
      const col = (i % 2 === 0) ? '#a01020' : '#d8a830';
      rect(ctx, scarfL, torsoTop + i, 4, 1, col);
      rect(ctx, scarfR, torsoTop + i, 4, 1, col);
    }
    // 围巾末端流苏
    px(ctx, scarfL, torsoTop + 6, '#d8a830');
    px(ctx, scarfL + 2, torsoTop + 6, '#a01020');
    px(ctx, scarfR + 1, torsoTop + 6, '#d8a830');
    px(ctx, scarfR + 3, torsoTop + 6, '#a01020');
    // 袍子中缝开口
    rect(ctx, HEAD_CX - 1, torsoTop + 6, 2, 10, shade);
    // 胸前徽章(金色盾形)
    rect(ctx, HEAD_CX - 4, torsoTop + 8, 3, 4, '#d8a830');
    px(ctx, HEAD_CX - 4, torsoTop + 11, '#7a5008');
    px(ctx, HEAD_CX - 2, torsoTop + 11, '#7a5008');
  } else if (outfit === 'idol') {
    // 粉色偶像装: 肩位边饰 + 胸前大蝴蝶结 + 裙下摆癖边
    // 肩部白色灯笼袖边饰
    for (let i = 0; i < 3; i++) {
      px(ctx, HEAD_CX - 9, torsoTop + i, '#ffffff');
      px(ctx, HEAD_CX + 8, torsoTop + i, '#ffffff');
    }
    // 领口白色丝带镞
    rect(ctx, HEAD_CX - 4, torsoTop, 8, 1, '#ffffff');
    // 蝴蝶结(中央大)
    rect(ctx, HEAD_CX - 4, torsoTop + 2, 8, 3, accent);
    rect(ctx, HEAD_CX - 5, torsoTop + 3, 10, 1, accent);
    px(ctx, HEAD_CX - 5, torsoTop + 2, accent);
    px(ctx, HEAD_CX + 4, torsoTop + 2, accent);
    px(ctx, HEAD_CX - 5, torsoTop + 4, accent);
    px(ctx, HEAD_CX + 4, torsoTop + 4, accent);
    // 蝴蝶结中心点
    rect(ctx, HEAD_CX - 1, torsoTop + 3, 2, 1, shade);
    // 裙下摆白色蝘丝边(横线走条)
    rect(ctx, HEAD_CX - 8, torsoTop + 13, 16, 1, '#ffffff');
    // 闪烁(3 点)
    px(ctx, HEAD_CX - 6, torsoTop + 8, '#ffffff');
    px(ctx, HEAD_CX + 5, torsoTop + 10, '#ffffff');
    px(ctx, HEAD_CX + 2, torsoTop + 7, '#ffffff');
  } else if (outfit === 'labcoat') {
    // 白大褂: 外袍开金 + 内衬 + 胸前 ID 牌 + 口袋带笔
    // 内衬衫(中央纵色块)
    rect(ctx, HEAD_CX - 2, torsoTop, 4, 16, shirt.base);
    // 领子翻边
    px(ctx, HEAD_CX - 3, torsoTop, shade);
    px(ctx, HEAD_CX + 2, torsoTop, shade);
    px(ctx, HEAD_CX - 3, torsoTop + 1, shade);
    px(ctx, HEAD_CX + 2, torsoTop + 1, shade);
    // 中间扣子(带领带)
    drawTie(ctx, HEAD_CX, torsoTop + 1, 6, accent, shade);
    // 左胸 ID 牌(索子上挂)
    rect(ctx, HEAD_CX - 6, torsoTop + 5, 3, 2, accent);
    px(ctx, HEAD_CX - 5, torsoTop + 4, shade);
    px(ctx, HEAD_CX - 5, torsoTop + 5, '#ffffff');
    // 胸前口袋 + 笔
    drawPocket(ctx, HEAD_CX + 3, torsoTop + 5, 4, 3, base, shade);
    rect(ctx, HEAD_CX + 4, torsoTop + 4, 1, 3, '#3858a0');
    px(ctx, HEAD_CX + 4, torsoTop + 3, accent);
    // 外袍底部侧口袋开口线
    hline(ctx, HEAD_CX - 9, torsoTop + 11, 4, shade);
    hline(ctx, HEAD_CX + 5, torsoTop + 11, 4, shade);
    // 领口听诊器管子垃侧型(可选)
    px(ctx, HEAD_CX - 4, torsoTop + 1, shade);
    px(ctx, HEAD_CX - 4, torsoTop + 2, shade);
    px(ctx, HEAD_CX - 4, torsoTop + 3, shade);
  } else if (outfit === 'tracksuit') {
    // 运动服: 中间拉链 + 3 道肩膗白条(汇本)
    // 领口立领
    rect(ctx, HEAD_CX - 4, torsoTop - 1, 8, 1, hi);
    rect(ctx, HEAD_CX - 4, torsoTop, 8, 1, base);
    rect(ctx, HEAD_CX + 3, torsoTop, 1, 1, hi); // 领口高光
    // 拉链(从领到腰)
    for (let i = 0; i < 14; i++) {
      px(ctx, HEAD_CX, torsoTop + i, accent);
      if (i % 2 === 0) px(ctx, HEAD_CX + 1, torsoTop + i, shade);
    }
    // 拉链头
    rect(ctx, HEAD_CX, torsoTop, 2, 1, '#c0c0c0');
    // 胸前品牌 LOGO 色块(左胸)
    rect(ctx, HEAD_CX - 7, torsoTop + 4, 3, 2, accent);
    // 肩部 3 道条(拉到袖子, 这里起步 3 行)
    for (let i = 0; i < 3; i++) {
      px(ctx, HEAD_CX - 10, torsoTop + i, accent);
      px(ctx, HEAD_CX - 11, torsoTop + i, accent);
      px(ctx, HEAD_CX + 9, torsoTop + i, accent);
      px(ctx, HEAD_CX + 10, torsoTop + i, accent);
    }
    // 下摆领口艰面深色圈
    hline(ctx, HEAD_CX - 9, torsoTop + 13, 18, shade);
  } else if (outfit === 'flannel') {
    // 格子衬衫: 真正的交叉格纹(纵 + 横 + 细线)
    // 纵粗条(黑)
    for (let dx = -7; dx < 8; dx += 4) {
      for (let y = 0; y < 16; y++) px(ctx, HEAD_CX + dx, torsoTop + y, shade);
      for (let y = 0; y < 16; y++) px(ctx, HEAD_CX + dx + 1, torsoTop + y, shade);
    }
    // 横粗条
    for (let y = 2; y < 16; y += 5) {
      hline(ctx, HEAD_CX - 8, torsoTop + y, 17, shade);
      hline(ctx, HEAD_CX - 8, torsoTop + y + 1, 17, shade);
    }
    // 细纵亮线(白)
    for (let dx = -5; dx < 8; dx += 4) {
      for (let y = 0; y < 16; y++) px(ctx, HEAD_CX + dx, torsoTop + y, hi);
    }
    // 领子 + 中间扣子门襤
    drawShirtCollar(ctx, HEAD_CX, torsoTop, shade, null);
    drawButtons(ctx, HEAD_CX, torsoTop + 2, 5, 3, shade);
  } else if (outfit === 'premium_suit') {
    // 高级定制西装: 细条纹 + 黄金口袋巾 + 领带 + 领銲
    drawShirtV(ctx, HEAD_CX, torsoTop, 6, '#f4f0e4');
    drawLapels(ctx, HEAD_CX, torsoTop, 7, base, '#080810');
    drawTie(ctx, HEAD_CX, torsoTop + 2, 10, accent, shade);
    // 样品中间亮细条纹
    for (let dx = -6; dx <= 6; dx += 4) {
      for (let y = 7; y < 16; y += 2) px(ctx, HEAD_CX + dx, torsoTop + y, hi);
    }
    // 黄金口袋巾(左胸)
    rect(ctx, HEAD_CX - 7, torsoTop + 6, 3, 2, '#d8b870');
    px(ctx, HEAD_CX - 6, torsoTop + 5, '#d8b870');
    px(ctx, HEAD_CX - 7, torsoTop + 8, '#9a7028');
    // 领銲金針
    px(ctx, HEAD_CX - 4, torsoTop + 3, '#d8b870');
    // 2 粒金扣
    px(ctx, HEAD_CX, torsoTop + 12, '#d8b870');
    px(ctx, HEAD_CX, torsoTop + 15, '#d8b870');
  } else if (outfit === 'tuxedo') {
    // 黑色纶士服: 丝光变色翻领 + 黑蝴蝶领结 + 中间白衬 + 腰间黑丝带
    // 中间白衬衫(中央垂直色块)
    rect(ctx, HEAD_CX - 1, torsoTop, 2, 10, '#ffffff');
    // 丝光领(黑色高光)
    drawLapels(ctx, HEAD_CX, torsoTop, 8, base, '#000');
    // 蝴蝶领结
    drawBowtie(ctx, HEAD_CX, torsoTop + 1, '#080808', '#1c1c20');
    // 白衬衫上三颖51颛扣子
    px(ctx, HEAD_CX, torsoTop + 5, '#1c1c28');
    px(ctx, HEAD_CX, torsoTop + 7, '#1c1c28');
    px(ctx, HEAD_CX, torsoTop + 9, '#1c1c28');
    // 中间腰间黑丝带(cummerbund)
    rect(ctx, HEAD_CX - 6, torsoTop + 11, 12, 2, '#0c0c14');
    // 口袋巾(白)
    px(ctx, HEAD_CX - 7, torsoTop + 6, '#ffffff');
    px(ctx, HEAD_CX - 6, torsoTop + 6, '#ffffff');
    px(ctx, HEAD_CX - 6, torsoTop + 7, '#ffffff');
  } else if (outfit === 'cheap_suit') {
    // 接布装: 色差不足的小翻领 + 歪领带 + 皱起线条
    drawShirtV(ctx, HEAD_CX, torsoTop, 4, '#d8d4c0');
    drawLapels(ctx, HEAD_CX, torsoTop, 4, base, shade);
    // 歪领带(偏右)
    drawTie(ctx, HEAD_CX + 1, torsoTop + 2, 8, '#7a3030', '#3a1818');
    // 衰黄补丁
    px(ctx, HEAD_CX - 6, torsoTop + 9, '#7a6840');
    px(ctx, HEAD_CX - 5, torsoTop + 9, '#7a6840');
    px(ctx, HEAD_CX - 6, torsoTop + 10, '#7a6840');
    // 衰狾线
    for (let i = 0; i < 3; i++) px(ctx, HEAD_CX + 4, torsoTop + 7 + i, shade);
    // 2 个不匹配的扣子
    px(ctx, HEAD_CX - 1, torsoTop + 12, '#888880');
    px(ctx, HEAD_CX + 1, torsoTop + 14, '#a8a890');
  } else if (outfit === 'shirt_tie') {
    // 正式领带衬衫(无外套)
    drawShirtCollar(ctx, HEAD_CX, torsoTop, shade, null);
    // 领带
    drawTie(ctx, HEAD_CX, torsoTop + 2, 11, accent, '#3a3a4a');
    // 中间门襤 + 扣子(领带两侧)
    for (let i = 0; i < 14; i++) px(ctx, HEAD_CX - 2, torsoTop + 2 + i, shade);
    drawButtons(ctx, HEAD_CX - 2, torsoTop + 7, 3, 3, '#888880');
    // 胸前口袋轮廓
    hline(ctx, HEAD_CX + 3, torsoTop + 5, 4, shade);
    px(ctx, HEAD_CX + 3, torsoTop + 6, shade);
    px(ctx, HEAD_CX + 6, torsoTop + 6, shade);
    hline(ctx, HEAD_CX + 3, torsoTop + 7, 4, shade);
    // 袖口艰面压线
    hline(ctx, HEAD_CX - 9, torsoTop + 12, 3, shade);
    hline(ctx, HEAD_CX + 7, torsoTop + 12, 3, shade);
  } else if (outfit === 'blazer') {
    // 商务休闲 blazer: 开件示中面着色衬衫不打领带
    drawShirtV(ctx, HEAD_CX, torsoTop, 7, shirt.base);
    drawLapels(ctx, HEAD_CX, torsoTop, 5, base, shade);
    // 内衬领子
    px(ctx, HEAD_CX - 3, torsoTop, shirt.shade);
    px(ctx, HEAD_CX + 2, torsoTop, shirt.shade);
    // 1 粒扣(中间)
    px(ctx, HEAD_CX - 1, torsoTop + 11, '#d8b870');
    px(ctx, HEAD_CX + 1, torsoTop + 11, '#d8b870');
    // 口袋底边(两侧)
    hline(ctx, HEAD_CX - 9, torsoTop + 9, 4, shade);
    hline(ctx, HEAD_CX + 5, torsoTop + 9, 4, shade);
  } else if (outfit === 'cs_hoodie') {
    // 程序员黑色连帽卫衣 + 胸前 “</>” 主题
    drawHood(ctx, HEAD_CX, torsoTop, widestTorso, shade, hi);
    drawKangarooPocket(ctx, HEAD_CX, torsoTop + 8, shade);
    // 拉链
    for (let i = 0; i < 4; i++) px(ctx, HEAD_CX, torsoTop + 3 + i, OUTLINE);
    // 胸前 "</>" 绿色代码符号
    px(ctx, HEAD_CX - 4, torsoTop + 5, accent);
    px(ctx, HEAD_CX - 5, torsoTop + 6, accent);
    px(ctx, HEAD_CX - 4, torsoTop + 7, accent);
    px(ctx, HEAD_CX - 2, torsoTop + 5, accent);
    px(ctx, HEAD_CX - 2, torsoTop + 6, accent);
    px(ctx, HEAD_CX - 2, torsoTop + 7, accent);
    px(ctx, HEAD_CX, torsoTop + 5, accent);
    px(ctx, HEAD_CX + 1, torsoTop + 6, accent);
    px(ctx, HEAD_CX, torsoTop + 7, accent);
  } else if (outfit === 'grad_hoodie') {
    // 大学卫衣: 连帽 + 胸前 大学名胸标 + 胸前姓名线条
    drawHood(ctx, HEAD_CX, torsoTop, widestTorso, shade, hi);
    drawKangarooPocket(ctx, HEAD_CX, torsoTop + 8, shade);
    // 胸前学校 LOGO(金色盾 + 字块)
    rect(ctx, HEAD_CX - 4, torsoTop + 4, 8, 4, accent);
    px(ctx, HEAD_CX - 4, torsoTop + 4, shade);
    px(ctx, HEAD_CX + 3, torsoTop + 4, shade);
    px(ctx, HEAD_CX - 4, torsoTop + 7, shade);
    px(ctx, HEAD_CX + 3, torsoTop + 7, shade);
    // 中间金色字样点
    px(ctx, HEAD_CX - 1, torsoTop + 6, '#7a5008');
    px(ctx, HEAD_CX + 1, torsoTop + 6, '#7a5008');
  } else if (outfit === 'daoist_robe') {
    // 道袍: 高领 + 中间八卦图 + 广袖 + 黑色腰带 + 中缝
    // 高领交领
    rect(ctx, HEAD_CX - 4, torsoTop, 8, 2, shade);
    rect(ctx, HEAD_CX - 3, torsoTop, 6, 1, base);
    // 中央象德八卦图(黑白阴阳样式)
    rect(ctx, HEAD_CX - 2, torsoTop + 4, 4, 4, '#1c1c28');
    rect(ctx, HEAD_CX - 2, torsoTop + 4, 4, 2, hi);
    px(ctx, HEAD_CX - 1, torsoTop + 5, '#1c1c28');
    px(ctx, HEAD_CX, torsoTop + 6, hi);
    // 中间黑缝
    for (let i = 8; i < 16; i++) px(ctx, HEAD_CX, torsoTop + i, shade);
    // 黑色羚带(丝练) 丝带出头
    rect(ctx, HEAD_CX - 9, torsoTop + 11, 18, 2, '#1c1c28');
    px(ctx, HEAD_CX - 2, torsoTop + 13, '#1c1c28');
    px(ctx, HEAD_CX + 1, torsoTop + 13, '#1c1c28');
  } else if (outfit === 'sect_uniform') {
    // 修仙宗门服: 藍主体 + 金色领口镞 + 胸前宗门徽记 + 金色羚带
    // 领口金色镞边(上绘 1 行)
    rect(ctx, HEAD_CX - 5, torsoTop, 10, 1, accent);
    rect(ctx, HEAD_CX - 6, torsoTop + 1, 12, 1, accent);
    // V 型领口内线
    px(ctx, HEAD_CX - 1, torsoTop + 2, accent);
    px(ctx, HEAD_CX, torsoTop + 2, accent);
    px(ctx, HEAD_CX - 2, torsoTop + 3, accent);
    px(ctx, HEAD_CX + 1, torsoTop + 3, accent);
    // 胸前宗门徽记(菱形)
    px(ctx, HEAD_CX, torsoTop + 5, accent);
    px(ctx, HEAD_CX - 1, torsoTop + 6, accent);
    px(ctx, HEAD_CX + 1, torsoTop + 6, accent);
    px(ctx, HEAD_CX, torsoTop + 6, hi);
    px(ctx, HEAD_CX, torsoTop + 7, accent);
    // 金色羚带
    rect(ctx, HEAD_CX - 9, torsoTop + 10, 18, 2, accent);
    rect(ctx, HEAD_CX - 9, torsoTop + 10, 18, 1, '#7a5008');
    // 腰间玫珑玠挂件
    rect(ctx, HEAD_CX - 1, torsoTop + 12, 2, 4, accent);
    px(ctx, HEAD_CX, torsoTop + 16, '#7a5008');
    // 外袍下摆侧开叉线
    for (let i = 13; i < 16; i++) px(ctx, HEAD_CX - 9, torsoTop + i, shade);
    for (let i = 13; i < 16; i++) px(ctx, HEAD_CX + 9, torsoTop + i, shade);
  } else if (outfit === 'idol_dress') {
    // 偶像连衣裙: 胸前大蝴蝶结 + 腰间拼接 + 裙裾蝘丝
    // 领口镞边
    rect(ctx, HEAD_CX - 4, torsoTop, 8, 1, '#ffffff');
    // 胸前大蝴蝶结
    rect(ctx, HEAD_CX - 4, torsoTop + 2, 8, 3, accent);
    rect(ctx, HEAD_CX - 5, torsoTop + 3, 10, 1, accent);
    px(ctx, HEAD_CX - 5, torsoTop + 2, accent);
    px(ctx, HEAD_CX + 4, torsoTop + 2, accent);
    rect(ctx, HEAD_CX - 1, torsoTop + 3, 2, 1, shade);
    // 腰间拼接镞边(白)
    rect(ctx, HEAD_CX - 8, torsoTop + 8, 17, 1, '#ffffff');
    // 裙裾白色蝘丝边(锐齿)
    for (let i = 0; i < 9; i++) px(ctx, HEAD_CX - 8 + i * 2, torsoTop + 14, '#ffffff');
    for (let i = 0; i < 9; i++) px(ctx, HEAD_CX - 9 + i * 2, torsoTop + 15, '#ffffff');
    // 裙裾垃起线折
    for (let i = -7; i < 8; i += 2) {
      for (let y = 9; y < 14; y++) px(ctx, HEAD_CX + i, torsoTop + y, shade);
    }
  } else if (outfit === 'idol_jacket') {
    // 黄色偶像外套: 中间拉链 + 彩色胸前条 + 胸前星星牌
    // 立领
    rect(ctx, HEAD_CX - 4, torsoTop, 8, 1, accent);
    rect(ctx, HEAD_CX - 4, torsoTop + 1, 8, 1, shade);
    // 中间拉链
    for (let i = 0; i < 14; i++) px(ctx, HEAD_CX, torsoTop + 2 + i, '#a8a8a0');
    px(ctx, HEAD_CX, torsoTop + 2, '#ffffff');
    // 胸前偏侧彩色动画条(红/藍)
    for (let i = 0; i < 8; i++) {
      px(ctx, HEAD_CX - 6 + i, torsoTop + 4, accent);
      px(ctx, HEAD_CX - 6 + i, torsoTop + 5, '#3858a0');
    }
    // 胸前星星牌(金黄)
    rect(ctx, HEAD_CX - 5, torsoTop + 7, 3, 2, '#d8b870');
    px(ctx, HEAD_CX - 4, torsoTop + 6, '#d8b870');
    px(ctx, HEAD_CX - 4, torsoTop + 9, '#d8b870');
    // 下摆腴子领口输出
    hline(ctx, HEAD_CX - 8, torsoTop + 14, 16, shade);
    // 亮灞点
    px(ctx, HEAD_CX + 3, torsoTop + 9, '#ffffff');
    px(ctx, HEAD_CX + 5, torsoTop + 11, '#ffffff');
  } else if (outfit === 'chef') {
    // 厨师服: 双排扣白厨师服 + 立领 + 黑领巾
    // 立领(上出肩部)
    rect(ctx, HEAD_CX - 4, torsoTop - 1, 8, 1, base);
    rect(ctx, HEAD_CX - 4, torsoTop, 8, 1, shade);
    // 领口黑领巾(领带状)
    drawTie(ctx, HEAD_CX, torsoTop + 1, 5, '#1c1c28', '#000');
    // 双排黑扣(2 列 x 4 个)
    for (let i = 0; i < 4; i++) {
      px(ctx, HEAD_CX - 4, torsoTop + 5 + i * 2, '#1c1c28');
      px(ctx, HEAD_CX + 4, torsoTop + 5 + i * 2, '#1c1c28');
    }
    // 双排间折线(斜捏叠引线)
    for (let i = 0; i < 8; i++) {
      px(ctx, HEAD_CX - 3 + Math.floor(i * 0.3), torsoTop + 5 + i, shade);
    }
    // 围裙带(腰间白带)
    rect(ctx, HEAD_CX - 9, torsoTop + 13, 18, 2, hi);
    rect(ctx, HEAD_CX - 9, torsoTop + 13, 18, 1, '#d8d4c0');
  } else if (outfit === 'house_robe') {
    // 领子护圏諲席位集徽: 黑袍 + 馆色领带 + 领口馆徽 + 中缝
    // 黑袍本体已由 base 填充
    // 馆色领带与领带
    drawShirtCollar(ctx, HEAD_CX, torsoTop, accent, null);
    drawTie(ctx, HEAD_CX, torsoTop + 2, 9, accent, shade);
    // 领带中间金色条纹
    px(ctx, HEAD_CX, torsoTop + 4, '#d8b870');
    px(ctx, HEAD_CX, torsoTop + 6, '#d8b870');
    // 胸前馆章 (金色盾)
    rect(ctx, HEAD_CX - 6, torsoTop + 5, 3, 4, '#d8b870');
    px(ctx, HEAD_CX - 5, torsoTop + 6, accent);
    px(ctx, HEAD_CX - 6, torsoTop + 8, '#7a5008');
    px(ctx, HEAD_CX - 4, torsoTop + 8, '#7a5008');
    // 袍子中缝
    for (let i = 7; i < 16; i++) px(ctx, HEAD_CX - 1, torsoTop + i, shade);
  } else if (outfit === 'tactical') {
    // 特工战术背心: MOLLE 肩带 + 4 个口袋 + 腰间手枪 + 胸前补丁
    // 肩部战术带
    rect(ctx, HEAD_CX - 6, torsoTop, 12, 1, shade);
    rect(ctx, HEAD_CX - 6, torsoTop + 1, 12, 1, OUTLINE);
    // 4 个胸前口袋
    rect(ctx, HEAD_CX - 5, torsoTop + 3, 4, 3, shade);
    rect(ctx, HEAD_CX + 1, torsoTop + 3, 4, 3, shade);
    rect(ctx, HEAD_CX - 5, torsoTop + 8, 4, 3, shade);
    rect(ctx, HEAD_CX + 1, torsoTop + 8, 4, 3, shade);
    // 口袋扪点(美几个折线)
    for (const [x, y] of [[-3, 3], [3, 3], [-3, 8], [3, 8]]) {
      px(ctx, HEAD_CX + x, torsoTop + y, OUTLINE);
    }
    // 右肩 红色补丁(国旗)
    px(ctx, HEAD_CX - 6, torsoTop + 5, accent);
    px(ctx, HEAD_CX - 7, torsoTop + 5, accent);
    // 腰间手枪套款
    rect(ctx, HEAD_CX + 5, torsoTop + 12, 3, 4, shade);
    px(ctx, HEAD_CX + 6, torsoTop + 11, OUTLINE);
    // 腰带
    hline(ctx, HEAD_CX - 9, torsoTop + 15, 18, OUTLINE);
  } else if (outfit === 'trench') {
    // 风衣: 双排扣金扣 + 嬽嬽领 + 腰带腰扭 + 肩狗(epaulette)
    // 大翻领
    drawLapels(ctx, HEAD_CX, torsoTop, 5, hi, shade);
    drawShirtV(ctx, HEAD_CX, torsoTop, 4, shirt.base);
    // 双排扣 6 个(2 列)
    for (let i = 0; i < 3; i++) {
      px(ctx, HEAD_CX - 4, torsoTop + 5 + i * 3, accent);
      px(ctx, HEAD_CX + 4, torsoTop + 5 + i * 3, accent);
    }
    // 肩狗
    rect(ctx, HEAD_CX - 8, torsoTop, 3, 1, shade);
    rect(ctx, HEAD_CX + 5, torsoTop, 3, 1, shade);
    px(ctx, HEAD_CX - 7, torsoTop, accent);
    px(ctx, HEAD_CX + 6, torsoTop, accent);
    // 腰带带金扣
    rect(ctx, HEAD_CX - 9, torsoTop + 13, 18, 1, shade);
    rect(ctx, HEAD_CX, torsoTop + 13, 2, 2, accent);
    px(ctx, HEAD_CX, torsoTop + 14, shade);
  } else if (outfit === 'naval') {
    // 海军军官: 黑主体 + 领口交叉金纹 + 4 粒金扣 + 肩板 + 胸前套子 + 胸前奖章
    // 高领(中间黑金)
    rect(ctx, HEAD_CX - 4, torsoTop - 1, 8, 1, OUTLINE);
    rect(ctx, HEAD_CX - 4, torsoTop, 8, 1, accent);
    rect(ctx, HEAD_CX - 3, torsoTop + 1, 6, 1, base);
    // 肩板(金色三竖条)
    for (let i = 0; i < 3; i++) {
      rect(ctx, HEAD_CX - 9, torsoTop + i, 3, 1, accent);
      rect(ctx, HEAD_CX + 6, torsoTop + i, 3, 1, accent);
    }
    // 中间 4 粒金扣
    for (let i = 0; i < 4; i++) {
      px(ctx, HEAD_CX - 1, torsoTop + 3 + i * 3, accent);
      px(ctx, HEAD_CX + 1, torsoTop + 3 + i * 3, accent);
    }
    // 胸前奖章三色条(黄/红/藍)
    rect(ctx, HEAD_CX - 6, torsoTop + 7, 1, 2, accent);
    rect(ctx, HEAD_CX - 5, torsoTop + 7, 1, 2, '#c43838');
    rect(ctx, HEAD_CX - 4, torsoTop + 7, 1, 2, '#3858a0');
    // 腰带(黑)
    rect(ctx, HEAD_CX - 9, torsoTop + 14, 18, 2, OUTLINE);
    rect(ctx, HEAD_CX, torsoTop + 14, 2, 2, accent);
  } else if (outfit === 'politician') {
    // 政客: 藍西装 + 红领带 + 领銲国旗針 + 白衬
    drawShirtV(ctx, HEAD_CX, torsoTop, 6, '#f4f0e4');
    drawLapels(ctx, HEAD_CX, torsoTop, 6, base, shade);
    drawTie(ctx, HEAD_CX, torsoTop + 2, 10, '#c43838', '#7a1818');
    // 领銲国旗别针(红白藍 3 点)
    px(ctx, HEAD_CX - 5, torsoTop + 3, '#c43838');
    px(ctx, HEAD_CX - 5, torsoTop + 4, '#ffffff');
    px(ctx, HEAD_CX - 4, torsoTop + 4, '#3858a0');
    // 2 粒扣
    px(ctx, HEAD_CX, torsoTop + 13, shade);
    px(ctx, HEAD_CX, torsoTop + 15, shade);
  } else if (outfit === 'poker_vest') {
    // 扑克玩家西装马甲: 白衬 + 黑蝴蝶结 + 马甲扣 + 金表链
    // 中间白衬衫露出
    rect(ctx, HEAD_CX - 2, torsoTop, 4, 14, '#f4f0e4');
    // 白衬领子
    px(ctx, HEAD_CX - 3, torsoTop, '#d8d4c0');
    px(ctx, HEAD_CX + 2, torsoTop, '#d8d4c0');
    // 黑蝴蝶领结
    drawBowtie(ctx, HEAD_CX, torsoTop + 1, '#1c1c28', '#3a3a4a');
    // 马甲V型开口边(上宽下窄)
    drawLapels(ctx, HEAD_CX, torsoTop + 3, 5, base, shade);
    // 中间扣子 5 粒
    for (let i = 0; i < 5; i++) px(ctx, HEAD_CX, torsoTop + 5 + i * 2, '#d8b870');
    // 腰间金表链(横线)
    hline(ctx, HEAD_CX + 1, torsoTop + 11, 5, '#d8b870');
    px(ctx, HEAD_CX + 5, torsoTop + 12, '#d8b870');
  } else if (outfit === 'thief') {
    // 贼装(全黑): 腰间装备带 + 面巾(领口) + 害区取警
    // 领口黑面巾(覆盖颈部)
    rect(ctx, HEAD_CX - 3, torsoTop - 1, 6, 2, '#1c1c28');
    rect(ctx, HEAD_CX - 4, torsoTop, 8, 1, '#1c1c28');
    // 胸前丝象带(斜走)
    for (let i = 0; i < 12; i++) px(ctx, HEAD_CX - 5 + i, torsoTop + 4 + Math.floor(i / 3), shade);
    // 腰间装备带 + 3 个装备袋
    rect(ctx, HEAD_CX - 9, torsoTop + 11, 18, 2, OUTLINE);
    rect(ctx, HEAD_CX - 5, torsoTop + 10, 3, 3, '#1c1c28');
    rect(ctx, HEAD_CX - 1, torsoTop + 10, 3, 3, '#1c1c28');
    rect(ctx, HEAD_CX + 3, torsoTop + 10, 3, 3, '#1c1c28');
    // 金色腰带扭
    rect(ctx, HEAD_CX, torsoTop + 11, 2, 2, accent);
  } else if (outfit === 'tank') {
    // 背心: 细肩带 + V 形大开口 + 露肩
    for (let y = 0; y < 14; y++) {
      px(ctx, HEAD_CX - 6, torsoTop + y, base);
      px(ctx, HEAD_CX + 5, torsoTop + y, base);
      px(ctx, HEAD_CX - 7, torsoTop + y, base);
      px(ctx, HEAD_CX + 6, torsoTop + y, base);
    }
    for (let dx = -5; dx <= 4; dx++) {
      px(ctx, HEAD_CX + dx, torsoTop, skin.base);
      px(ctx, HEAD_CX + dx, torsoTop + 1, skin.shade);
    }
    for (let i = 0; i < 4; i++) {
      for (let dx = -i; dx <= i; dx++) px(ctx, HEAD_CX + dx, torsoTop + 2 + i, skin.base);
    }
    for (let y = 0; y < 14; y++) {
      px(ctx, HEAD_CX - 5, torsoTop + y, shade);
      px(ctx, HEAD_CX + 4, torsoTop + y, shade);
    }
    px(ctx, HEAD_CX - 1, torsoTop + 9, accent);
  } else if (outfit === 'tee') {
    drawCrewCollar(ctx, HEAD_CX, torsoTop, shade);
    rect(ctx, HEAD_CX - 3, torsoTop + 5, 7, 4, accent);
    px(ctx, HEAD_CX - 2, torsoTop + 6, base);
    px(ctx, HEAD_CX + 1, torsoTop + 6, base);
    px(ctx, HEAD_CX, torsoTop + 7, base);
    hline(ctx, HEAD_CX - 9, torsoTop + 14, 18, shade);
  } else if (outfit === 'polo') {
    drawPoloCollar(ctx, HEAD_CX, torsoTop, accent, shade);
    for (let i = 0; i < 5; i++) px(ctx, HEAD_CX - 1, torsoTop + 2 + i, shade);
    px(ctx, HEAD_CX, torsoTop + 3, accent);
    px(ctx, HEAD_CX, torsoTop + 6, accent);
    rect(ctx, HEAD_CX + 3, torsoTop + 5, 3, 2, accent);
    px(ctx, HEAD_CX + 4, torsoTop + 5, hi);
  } else if (outfit === 'cardigan') {
    drawShirtV(ctx, HEAD_CX, torsoTop, 8, shirt.base);
    for (let i = 0; i < 14; i++) {
      px(ctx, HEAD_CX - 3, torsoTop + i, shade);
      px(ctx, HEAD_CX + 2, torsoTop + i, shade);
    }
    for (let i = 0; i < 5; i++) px(ctx, HEAD_CX + 2, torsoTop + 2 + i * 3, accent);
    drawPocket(ctx, HEAD_CX - 8, torsoTop + 10, 4, 3, base, shade);
    drawPocket(ctx, HEAD_CX + 4, torsoTop + 10, 4, 3, base, shade);
  } else if (outfit === 'sweater_v') {
    drawShirtV(ctx, HEAD_CX, torsoTop, 5, shirt.base);
    for (let i = 0; i < 5; i++) {
      px(ctx, HEAD_CX - 2 - Math.floor(i/2), torsoTop + i, shade);
      px(ctx, HEAD_CX + 1 + Math.floor(i/2), torsoTop + i, shade);
    }
    for (let dx = -5; dx <= 5; dx += 4) {
      for (let dy = 8; dy <= 12; dy += 3) px(ctx, HEAD_CX + dx, torsoTop + dy, accent);
    }
    hline(ctx, HEAD_CX - 9, torsoTop + 13, 18, shade);
    hline(ctx, HEAD_CX - 9, torsoTop + 15, 18, shade);
  } else if (outfit === 'turtleneck') {
    rect(ctx, HEAD_CX - 3, torsoTop - 3, 6, 4, base);
    rect(ctx, HEAD_CX - 3, torsoTop - 3, 6, 1, hi);
    rect(ctx, HEAD_CX - 3, torsoTop, 6, 1, shade);
    for (let dy = 4; dy <= 12; dy += 4) hline(ctx, HEAD_CX - 8, torsoTop + dy, 16, shade);
    px(ctx, HEAD_CX - 6, torsoTop + 5, accent);
    px(ctx, HEAD_CX - 5, torsoTop + 5, accent);
  } else if (outfit === 'denim_jacket') {
    drawShirtCollar(ctx, HEAD_CX, torsoTop, shade, OUTLINE);
    rect(ctx, HEAD_CX - 8, torsoTop + 4, 5, 4, shade);
    rect(ctx, HEAD_CX + 3, torsoTop + 4, 5, 4, shade);
    hline(ctx, HEAD_CX - 8, torsoTop + 4, 5, OUTLINE);
    hline(ctx, HEAD_CX + 3, torsoTop + 4, 5, OUTLINE);
    px(ctx, HEAD_CX - 6, torsoTop + 4, accent);
    px(ctx, HEAD_CX + 5, torsoTop + 4, accent);
    for (let i = 0; i < 5; i++) px(ctx, HEAD_CX, torsoTop + 2 + i * 3, accent);
    for (let i = 0; i < 14; i++) px(ctx, HEAD_CX - 1, torsoTop + 2 + i, shade);
    hline(ctx, HEAD_CX - 9, torsoTop + 15, 18, shade);
  } else if (outfit === 'varsity') {
    rect(ctx, HEAD_CX - 7, torsoTop + 3, 5, 6, accent);
    hline(ctx, HEAD_CX - 7, torsoTop + 3, 5, hi);
    hline(ctx, HEAD_CX - 7, torsoTop + 8, 5, hi);
    px(ctx, HEAD_CX - 6, torsoTop + 5, OUTLINE);
    px(ctx, HEAD_CX - 3, torsoTop + 5, OUTLINE);
    px(ctx, HEAD_CX - 5, torsoTop + 6, OUTLINE);
    px(ctx, HEAD_CX - 4, torsoTop + 6, OUTLINE);
    px(ctx, HEAD_CX - 6, torsoTop + 7, OUTLINE);
    px(ctx, HEAD_CX - 3, torsoTop + 7, OUTLINE);
    for (let i = 0; i < 5; i++) px(ctx, HEAD_CX, torsoTop + 2 + i * 3, '#d8b870');
    for (let i = 0; i < 14; i++) px(ctx, HEAD_CX - 1, torsoTop + 2 + i, shade);
    hline(ctx, HEAD_CX - 9, torsoTop + 14, 18, hi);
    hline(ctx, HEAD_CX - 9, torsoTop + 16, 18, hi);
  } else if (outfit === 'jacket') {
    rect(ctx, HEAD_CX - 4, torsoTop - 1, 8, 1, shade);
    drawZipper(ctx, HEAD_CX, torsoTop, 14, shade);
    rect(ctx, HEAD_CX - 8, torsoTop + 9, 5, 3, shade);
    rect(ctx, HEAD_CX + 3, torsoTop + 9, 5, 3, shade);
    hline(ctx, HEAD_CX - 8, torsoTop + 9, 5, OUTLINE);
    hline(ctx, HEAD_CX + 3, torsoTop + 9, 5, OUTLINE);
    rect(ctx, HEAD_CX + 3, torsoTop + 4, 3, 2, accent);
  } else if (outfit === 'hawaiian') {
    drawShirtCollar(ctx, HEAD_CX, torsoTop, shade, null);
    for (let i = 0; i < 14; i++) px(ctx, HEAD_CX - 1, torsoTop + 2 + i, shade);
    drawButtons(ctx, HEAD_CX, torsoTop + 3, 4, 3, hi);
    const flowers = [
      [-6, 3, '#c43838'], [4, 4, '#d8b870'], [-5, 7, '#7a3858'],
      [3, 8, '#5ca228'], [-4, 11, '#c43838'], [5, 12, '#d8b870'],
      [-6, 14, '#3858a0'], [2, 13, '#c43838']
    ];
    for (const f of flowers) {
      rect(ctx, HEAD_CX + f[0], torsoTop + f[1], 2, 2, f[2]);
      px(ctx, HEAD_CX + f[0], torsoTop + f[1], hi);
      px(ctx, HEAD_CX + f[0] + 1, torsoTop + f[1] + 1, OUTLINE);
    }
  } else if (outfit === 'striped_tee') {
    drawCrewCollar(ctx, HEAD_CX, torsoTop, shade);
    for (let y = 1; y < 14; y += 2) hline(ctx, HEAD_CX - 9, torsoTop + y, 18, accent);
    hline(ctx, HEAD_CX - 9, torsoTop + 14, 18, shade);
  } else if (outfit === 'winter_coat') {
    drawHood(ctx, HEAD_CX, torsoTop, widestTorso, shade, null);
    for (let i = 0; i < widestTorso - 8; i += 2) {
      px(ctx, HEAD_CX - Math.floor((widestTorso - 8) / 2) + i, torsoTop - 4, hi);
      px(ctx, HEAD_CX - Math.floor((widestTorso - 8) / 2) + i + 1, torsoTop - 4, '#b8b4a4');
    }
    for (let i = 0; i < 4; i++) {
      const y = torsoTop + 3 + i * 3;
      rect(ctx, HEAD_CX - 3, y, 6, 1, '#8a6840');
      px(ctx, HEAD_CX - 3, y, OUTLINE);
      px(ctx, HEAD_CX + 2, y, OUTLINE);
    }
    rect(ctx, HEAD_CX - 9, torsoTop + 13, 18, 2, shade);
    rect(ctx, HEAD_CX, torsoTop + 13, 2, 2, accent);
  } else if (outfit === 'puffer') {
    rect(ctx, HEAD_CX - 4, torsoTop - 1, 8, 2, shade);
    for (let i = 0; i < 14; i++) {
      px(ctx, HEAD_CX, torsoTop + i, OUTLINE);
      if (i % 2 === 0) px(ctx, HEAD_CX + 1, torsoTop + i, '#c0c0c0');
    }
    for (let y = 3; y < 14; y += 3) {
      hline(ctx, HEAD_CX - 9, torsoTop + y, 18, shade);
      hline(ctx, HEAD_CX - 9, torsoTop + y + 1, 18, hi);
    }
  } else if (outfit === 'beret_top') {
    for (let y = 0; y < 14; y += 2) hline(ctx, HEAD_CX - 9, torsoTop + y, 18, hi);
    for (let y = 1; y < 14; y += 2) hline(ctx, HEAD_CX - 9, torsoTop + y, 18, accent);
    rect(ctx, HEAD_CX - 4, torsoTop - 1, 8, 2, '#c43838');
    rect(ctx, HEAD_CX - 3, torsoTop + 1, 6, 1, '#c43838');
    rect(ctx, HEAD_CX - 1, torsoTop + 2, 2, 3, '#c43838');
  } else if (outfit === 'photo_vest') {
    rect(ctx, HEAD_CX - 4, torsoTop, 8, 1, shade);
    for (let r = 0; r < 3; r++) {
      const y = torsoTop + 2 + r * 4;
      rect(ctx, HEAD_CX - 7, y, 4, 3, shade);
      hline(ctx, HEAD_CX - 7, y, 4, OUTLINE);
      px(ctx, HEAD_CX - 5, y + 1, accent);
      rect(ctx, HEAD_CX + 3, y, 4, 3, shade);
      hline(ctx, HEAD_CX + 3, y, 4, OUTLINE);
      px(ctx, HEAD_CX + 5, y + 1, accent);
    }
    for (let i = 0; i < 14; i++) px(ctx, HEAD_CX, torsoTop + 2 + i, OUTLINE);
  } else if (outfit === 'ragged') {
    rect(ctx, HEAD_CX - 6, torsoTop + 3, 4, 3, '#7a6840');
    hline(ctx, HEAD_CX - 6, torsoTop + 3, 4, OUTLINE);
    hline(ctx, HEAD_CX - 6, torsoTop + 5, 4, OUTLINE);
    rect(ctx, HEAD_CX + 2, torsoTop + 7, 4, 3, '#5a4a3a');
    hline(ctx, HEAD_CX + 2, torsoTop + 7, 4, OUTLINE);
    hline(ctx, HEAD_CX + 2, torsoTop + 9, 4, OUTLINE);
    px(ctx, HEAD_CX, torsoTop + 5, OUTLINE);
    px(ctx, HEAD_CX + 1, torsoTop + 6, OUTLINE);
    px(ctx, HEAD_CX, torsoTop + 6, OUTLINE);
    px(ctx, HEAD_CX - 1, torsoTop + 6, OUTLINE);
    for (let i = 0; i < 9; i++) {
      const x = HEAD_CX - 8 + i * 2;
      px(ctx, x, torsoTop + 14, base);
      px(ctx, x + 1, torsoTop + 14, OUTLINE);
      px(ctx, x, torsoTop + 15, OUTLINE);
    }
  } else if (outfit === 'patched_tee') {
    drawCrewCollar(ctx, HEAD_CX, torsoTop, shade);
    rect(ctx, HEAD_CX - 6, torsoTop + 4, 4, 4, '#7a6840');
    hline(ctx, HEAD_CX - 6, torsoTop + 4, 4, OUTLINE);
    hline(ctx, HEAD_CX - 6, torsoTop + 7, 4, OUTLINE);
    rect(ctx, HEAD_CX + 2, torsoTop + 8, 4, 3, '#5a4a3a');
    hline(ctx, HEAD_CX + 2, torsoTop + 8, 4, OUTLINE);
    hline(ctx, HEAD_CX + 2, torsoTop + 10, 4, OUTLINE);
    px(ctx, HEAD_CX, torsoTop + 9, shade);
    px(ctx, HEAD_CX + 3, torsoTop + 4, shade);
  } else if (outfit === 'pajamas') {
    for (let dx = -7; dx <= 7; dx += 3) {
      for (let y = 0; y < 16; y++) px(ctx, HEAD_CX + dx, torsoTop + y, accent);
    }
    drawCrewCollar(ctx, HEAD_CX, torsoTop, shade);
    for (let i = 0; i < 14; i++) px(ctx, HEAD_CX - 1, torsoTop + 2 + i, shade);
    drawButtons(ctx, HEAD_CX, torsoTop + 3, 4, 3, hi);
    drawPocket(ctx, HEAD_CX + 3, torsoTop + 5, 4, 3, base, shade);
  } else if (outfit === 'jersey') {
    // 运动球月衣: 大号码 + 胸前 V领 + 网眼点状
    drawCrewCollar(ctx, HEAD_CX, torsoTop, accent);
    drawShirtV(ctx, HEAD_CX, torsoTop, 3, accent);
    // 胸前大数字 "7"
    rect(ctx, HEAD_CX - 4, torsoTop + 4, 8, 1, hi);
    rect(ctx, HEAD_CX + 2, torsoTop + 4, 2, 9, hi);
    px(ctx, HEAD_CX + 1, torsoTop + 7, hi);
    px(ctx, HEAD_CX, torsoTop + 9, hi);
    px(ctx, HEAD_CX - 1, torsoTop + 11, hi);
    // 网眼点状(纹理)
    for (let dx = -6; dx <= 6; dx += 3) {
      for (let dy = 6; dy <= 14; dy += 3) {
        if (Math.abs(dx) > 2 || dy > 13) px(ctx, HEAD_CX + dx, torsoTop + dy, hi);
      }
    }
    // 侧身带色块
    rect(ctx, HEAD_CX - 9, torsoTop + 5, 1, 8, accent);
    rect(ctx, HEAD_CX + 9, torsoTop + 5, 1, 8, accent);
  } else if (outfit === 'gaming_jersey') {
    // 电竞队服: 黑主体 + 艳色胸前 LOGO + 赞助商带条 + 袖口起次位
    drawCrewCollar(ctx, HEAD_CX, torsoTop, accent);
    // 胸前队徽 LOGO 胸补丁
    rect(ctx, HEAD_CX - 4, torsoTop + 4, 8, 4, accent);
    px(ctx, HEAD_CX - 4, torsoTop + 4, base);
    px(ctx, HEAD_CX + 3, torsoTop + 4, base);
    px(ctx, HEAD_CX - 4, torsoTop + 7, base);
    px(ctx, HEAD_CX + 3, torsoTop + 7, base);
    // 队徽中央成圆 黑点
    px(ctx, HEAD_CX - 1, torsoTop + 5, base);
    px(ctx, HEAD_CX, torsoTop + 6, base);
    px(ctx, HEAD_CX + 1, torsoTop + 5, base);
    // 赞助商胸下胸上条
    rect(ctx, HEAD_CX - 6, torsoTop + 10, 12, 1, hi);
    rect(ctx, HEAD_CX - 6, torsoTop + 12, 12, 1, accent);
    // 肩部三颖51三角肩袋巾 点点肩
    for (let dx = -7; dx <= -5; dx++) {
      px(ctx, HEAD_CX + dx, torsoTop, accent);
      px(ctx, HEAD_CX - dx, torsoTop, accent);
    }
    // 下摆艰面压线
    hline(ctx, HEAD_CX - 9, torsoTop + 14, 18, shade);
  } else if (outfit === 'poker_vest') {
    // vest opening showing white shirt + bow tie
    rect(ctx, HEAD_CX - 1, torsoTop, 2, 12, '#f0f0f4');
    rect(ctx, HEAD_CX - 2, torsoTop, 4, 1, accent);
    for (let i = 0; i < 4; i++) px(ctx, HEAD_CX, torsoTop + 2 + i * 2, accent);
  } else if (outfit === 'denim_jacket') {
    // pockets + brass buttons
    rect(ctx, HEAD_CX - 5, torsoTop + 4, 3, 3, shade);
    rect(ctx, HEAD_CX + 2, torsoTop + 4, 3, 3, shade);
    for (let i = 0; i < 5; i++) px(ctx, HEAD_CX - 1, torsoTop + 1 + i * 2, accent);
  } else if (outfit === 'varsity') {
    // letterman patch
    rect(ctx, HEAD_CX - 4, torsoTop + 3, 4, 4, accent);
    px(ctx, HEAD_CX - 3, torsoTop + 4, base);
    px(ctx, HEAD_CX - 2, torsoTop + 5, base);
    // contrast sleeves done via arm color (longSleeve)
  } else if (outfit === 'flannel') {
    // plaid: vertical + horizontal lines
    for (let y = 0; y < 14; y += 2) {
      hline(ctx, HEAD_CX - 6, torsoTop + y, 12, hi);
    }
    for (let x = -6; x < 6; x += 3) {
      for (let y = 0; y < 14; y++) px(ctx, HEAD_CX + x, torsoTop + y, accent);
    }
  } else if (outfit === 'hawaiian') {
    // scattered flower dots
    const pts = [[-5,2],[-2,5],[3,3],[1,8],[-4,10],[4,7],[-1,12]];
    for (const [dx, dy] of pts) {
      rect(ctx, HEAD_CX + dx, torsoTop + dy, 2, 2, accent);
    }
  }


  // arms — anchored on torso shoulder, with a rounded deltoid cap to avoid hard L-corner
  const longSleeve = [
    'suit','premium_suit','tuxedo','cheap_suit','shirt_tie','blazer','hoodie','chef','robe','house_robe',
    'labcoat','hanfu','daoist_robe','sect_uniform','jacket','denim_jacket','varsity','flannel','thief',
    'tactical','trench','naval','politician','tracksuit','gaming_jersey','cardigan','sweater_v','turtleneck',
    'winter_coat','puffer','cs_hoodie','grad_hoodie','art_smock','school_blazer','idol_jacket','pajamas','school'
  ].includes(outfit);
  const armCol = longSleeve ? base : skin.base;
  const armShade = longSleeve ? shade : skin.shade;
  const armHi = longSleeve ? hi : skin.hi;
  const armLen = 18;
  const shoulderRow = rowEdges[2]; // widest row = shoulder line
  const shoulderW = prof.armW;
  const wristW = Math.max(2, shoulderW - 1);
  const armCells = { L: new Set(), R: new Set() };
  for (let i = 0; i < armLen; i++) {
    const t = i / (armLen - 1);
    let w = Math.round(shoulderW - t * (shoulderW - wristW));
    // top 2 rows: deltoid cap — overlap torso (no gap) and narrow outer edge
    // so shoulder reads as a single curved shape instead of two adjacent rectangles
    let innerOffset; // how far inside the torso the arm's inner edge sits
    if (i === 0)      { w = shoulderW - 1; innerOffset = 1; }   // tuck under shoulder, narrow top
    else if (i === 1) { w = shoulderW;     innerOffset = 0; }   // flush against torso
    else              { w = w;             innerOffset = -1; }  // 1px gap from torso
    const y = torsoTop + 1 + i;
    // left arm
    const lInnerEdge = shoulderRow.left + innerOffset; // inclusive inner edge
    const lOuter = lInnerEdge - w + 1;                  // outer (leftmost) edge
    for (let x = lOuter; x <= lInnerEdge; x++) armCells.L.add(x + ',' + y);
    // right arm (mirror)
    const rInnerEdge = shoulderRow.right - innerOffset;
    const rOuter = rInnerEdge + w - 1;
    for (let x = rInnerEdge; x <= rOuter; x++) armCells.R.add(x + ',' + y);
  }
  // fill base
  ctx.fillStyle = armCol;
  for (const k of [...armCells.L, ...armCells.R]) {
    const [x, y] = k.split(',').map(Number);
    ctx.fillRect(x, y, 1, 1);
  }
  // outer-edge shade (rightmost col of each arm)
  ctx.fillStyle = armShade;
  for (const set of [armCells.L, armCells.R]) {
    const isLeft = set === armCells.L;
    for (const k of set) {
      const [x, y] = k.split(',').map(Number);
      // shade the OUTER edge of each arm (left arm: leftmost col; right arm: rightmost col)
      const neighbor = isLeft ? (x - 1) + ',' + y : (x + 1) + ',' + y;
      if (!set.has(neighbor)) ctx.fillRect(x, y, 1, 1);
    }
  }
  // inner-edge highlight (toward torso) on upper half
  ctx.fillStyle = armHi;
  for (const set of [armCells.L, armCells.R]) {
    const isLeft = set === armCells.L;
    for (const k of set) {
      const [x, y] = k.split(',').map(Number);
      const neighbor = isLeft ? (x + 1) + ',' + y : (x - 1) + ',' + y;
      if (!set.has(neighbor) && y < torsoTop + 8) ctx.fillRect(x, y, 1, 1);
    }
  }
  // deltoid shading at very top (rounds the shoulder)
  ctx.fillStyle = shade;
  ctx.fillRect(shoulderRow.left, torsoTop + 1, 1, 1);
  ctx.fillRect(shoulderRow.right, torsoTop + 1, 1, 1);
  // sleeve cuff / wrist shadow at bottom
  ctx.fillStyle = longSleeve ? shade : skin.shade;
  for (const set of [armCells.L, armCells.R]) {
    for (const k of set) {
      const [x, y] = k.split(',').map(Number);
      if (y >= torsoTop + armLen - 1) ctx.fillRect(x, y, 1, 1);
    }
  }
  // outlines
  drawOutlineAround(ctx, armCells.L, OUTLINE);
  drawOutlineAround(ctx, armCells.R, OUTLINE);
}

// ─── Head ─────────────────────────────────────────────────────
let _headCells = null;
function drawHead(ctx, state) {
  const skin = skinOf(state);
  // fill base
  _headCells = fillRows(ctx, HEAD_X, HEAD_Y, HEAD_ROWS, skin.base);
  // right-side cel shade
  ctx.fillStyle = skin.shade;
  for (const k of _headCells) {
    const [x, y] = k.split(',').map(Number);
    // shade the rightmost 2 columns of each row
    // find row width by checking neighbors
    const right = _headCells.has((x + 1) + ',' + y);
    if (!right) { ctx.fillRect(x, y, 1, 1); ctx.fillRect(x - 1, y, 1, 1); }
  }
  // top highlight (forehead) — 1px row of hi near top of skull
  ctx.fillStyle = skin.hi;
  for (const k of _headCells) {
    const [x, y] = k.split(',').map(Number);
    if (y === HEAD_Y + 2 && x < HEAD_CX) ctx.fillRect(x, y, 1, 1);
  }
  // chin shadow (bottom strip darker shade)
  ctx.fillStyle = skin.shade;
  for (const k of _headCells) {
    const [x, y] = k.split(',').map(Number);
    if (y === FACE_BOT - 1) ctx.fillRect(x, y, 1, 1);
  }
  // outline
  drawOutlineAround(ctx, _headCells, OUTLINE);

  // ears (small bumps at sides at eye-line)
  const earY = HEAD_Y + 9;
  px(ctx, HEAD_X - 1, earY, OUTLINE);
  px(ctx, HEAD_X - 1, earY + 1, OUTLINE);
  px(ctx, HEAD_X + 16, earY, OUTLINE);
  px(ctx, HEAD_X + 16, earY + 1, OUTLINE);
}

// ─── Face: brows, eyes, nose hint, mouth, blush ───────────────
function drawFace(ctx, state) {
  const skin = skinOf(state);
  const eye = eyeColorOf(state);
  const hap = state.HAP ?? 5;
  const fv = state.faceVariant ?? 0;

  // brows (row HEAD_Y + 7)
  const browY = HEAD_Y + 7;
  if (fv % 3 === 0) {
    rect(ctx, HEAD_CX - 6, browY, 3, 1, OUTLINE);
    rect(ctx, HEAD_CX + 3, browY, 3, 1, OUTLINE);
  } else if (fv % 3 === 1) {
    // arched
    rect(ctx, HEAD_CX - 6, browY + 1, 1, 1, OUTLINE);
    rect(ctx, HEAD_CX - 5, browY, 2, 1, OUTLINE);
    rect(ctx, HEAD_CX + 4, browY + 1, 1, 1, OUTLINE);
    rect(ctx, HEAD_CX + 3, browY, 2, 1, OUTLINE);
  } else {
    // thick
    rect(ctx, HEAD_CX - 6, browY, 3, 2, OUTLINE);
    rect(ctx, HEAD_CX + 3, browY, 3, 2, OUTLINE);
  }

  // eyes — 3 wide, 3 tall each (sclera + iris + pupil + sparkle)
  const eyeY = HEAD_Y + 9;
  const eyeXL = HEAD_CX - 7;
  const eyeXR = HEAD_CX + 4;
  if (hap <= 2) {
    // sad/closed: arc downward
    rect(ctx, eyeXL, eyeY + 1, 3, 1, OUTLINE);
    px(ctx, eyeXL, eyeY + 2, OUTLINE);
    px(ctx, eyeXL + 2, eyeY + 2, OUTLINE);
    rect(ctx, eyeXR, eyeY + 1, 3, 1, OUTLINE);
    px(ctx, eyeXR, eyeY + 2, OUTLINE);
    px(ctx, eyeXR + 2, eyeY + 2, OUTLINE);
  } else {
    for (const ex of [eyeXL, eyeXR]) {
      // sclera (white) — 3×3
      rect(ctx, ex, eyeY, 3, 3, '#ffffff');
      // iris 2×3 in middle of socket
      rect(ctx, ex, eyeY, 2, 3, eye);
      // pupil 1×2
      px(ctx, ex, eyeY + 1, OUTLINE);
      px(ctx, ex, eyeY + 2, OUTLINE);
      // top sparkle
      px(ctx, ex + 1, eyeY, '#ffffff');
      // outline top + bottom of eye
      rect(ctx, ex, eyeY - 1, 3, 1, OUTLINE);
      rect(ctx, ex, eyeY + 3, 3, 1, OUTLINE);
    }
    // outer lashes flick
    px(ctx, eyeXL - 1, eyeY - 1, OUTLINE);
    px(ctx, eyeXR + 3, eyeY - 1, OUTLINE);
  }

  // nose hint (single shaded pixel slightly off-center)
  px(ctx, HEAD_CX + 1, HEAD_Y + 12, skin.shade);
  px(ctx, HEAD_CX, HEAD_Y + 13, skin.shade);
  px(ctx, HEAD_CX + 1, HEAD_Y + 13, skin.shade);

  // mouth (row HEAD_Y + 15)
  const mY = HEAD_Y + 15;
  if (hap >= 8) {
    rect(ctx, HEAD_CX - 2, mY, 4, 1, OUTLINE);
    px(ctx, HEAD_CX - 3, mY - 1, OUTLINE);
    px(ctx, HEAD_CX + 2, mY - 1, OUTLINE);
    rect(ctx, HEAD_CX - 1, mY + 1, 2, 1, '#9a3a4a');
  } else if (hap >= 5) {
    rect(ctx, HEAD_CX - 2, mY, 4, 1, OUTLINE);
    px(ctx, HEAD_CX - 3, mY - 1, OUTLINE);
    px(ctx, HEAD_CX + 2, mY - 1, OUTLINE);
  } else if (hap >= 3) {
    rect(ctx, HEAD_CX - 2, mY, 4, 1, OUTLINE);
  } else {
    rect(ctx, HEAD_CX - 2, mY + 1, 4, 1, OUTLINE);
    px(ctx, HEAD_CX - 3, mY, OUTLINE);
    px(ctx, HEAD_CX + 2, mY, OUTLINE);
  }

  // blush
  if (hap >= 6 && (state.HLT ?? 5) >= 4) {
    px(ctx, HEAD_CX - 7, HEAD_Y + 12, '#f08aa0');
    px(ctx, HEAD_CX - 6, HEAD_Y + 12, '#f8b0c0');
    px(ctx, HEAD_CX + 6, HEAD_Y + 12, '#f08aa0');
    px(ctx, HEAD_CX + 5, HEAD_Y + 12, '#f8b0c0');
  }
}

// ─── Hair back (behind body — long styles) ────────────────────
function drawHairBack(ctx, state) {
  if (state.sex !== 1) return;
  const c = hairColorOf(state);
  const style = hairStyleOf(state);

  // Helper: fill a set of cells, shade outer columns, outline
  const paintMass = (cells, opts = {}) => {
    ctx.fillStyle = c.base;
    for (const k of cells) { const [x, y] = k.split(',').map(Number); ctx.fillRect(x, y, 1, 1); }
    // right-edge shade (1px) for depth
    ctx.fillStyle = c.shade;
    for (const k of cells) {
      const [x, y] = k.split(',').map(Number);
      if (!cells.has((x + 1) + ',' + y)) ctx.fillRect(x, y, 1, 1);
    }
    // optional left-edge highlight on upper portion
    if (opts.highlight) {
      ctx.fillStyle = c.hi;
      for (const k of cells) {
        const [x, y] = k.split(',').map(Number);
        if (!cells.has((x - 1) + ',' + y) && y < HEAD_Y + 10) ctx.fillRect(x, y, 1, 1);
      }
    }
    drawOutlineAround(ctx, cells, OUTLINE, true);
  };

  if (style === 'long' || style === 'wavy') {
    // Two side drapes from temples down past shoulders, plus a center back panel.
    const top = HEAD_Y + 2;
    const bot = H - 2;
    const cells = new Set();
    for (let y = top; y < bot; y++) {
      const t = (y - top) / (bot - top);
      // Side drape width tapers wider toward the bottom (hair falls outward)
      const wave = style === 'wavy' ? Math.round(Math.sin((y - top) * 0.6) * 1.2) : 0;
      const wOff = Math.round(2 + t * 5) + Math.max(0, wave);
      // Left curtain
      for (let x = HEAD_X - 1 - wOff; x <= HEAD_X + 1; x++) cells.add(x + ',' + y);
      // Right curtain
      for (let x = HEAD_X + 14; x <= HEAD_X + 16 + wOff; x++) cells.add(x + ',' + y);
      // Center back panel (behind neck/upper back)
      if (y < HEAD_Y + 16) {
        for (let x = HEAD_X + 2; x <= HEAD_X + 13; x++) cells.add(x + ',' + y);
      }
    }
    paintMass(cells, { highlight: true });
    if (style === 'wavy') {
      // scallop bottom: small bumps along the hem
      ctx.fillStyle = c.shade;
      for (let i = -1; i < 6; i++) {
        const sx = HEAD_X - 2 + i * 4;
        px(ctx, sx, bot - 1, c.shade);
        px(ctx, sx + 1, bot - 1, c.shade);
      }
    }
  } else if (style === 'ponytail') {
    // High ponytail: thick base attached to crown, sweeping back-right, gently widening.
    const cells = new Set();
    // base knot wrapping around the back-right of head
    for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 3; dx++) {
      cells.add((HEAD_X + 13 + dx) + ',' + (HEAD_Y + 3 + dy));
    }
    // tail: starts thick at base, tapers a touch then expands at the tip
    for (let i = 0; i < 20; i++) {
      const t = i / 19;
      const sway = Math.round(i * 0.25); // arcs out to the right
      const w = i < 4 ? 4 : (i < 14 ? 3 : (i < 18 ? 4 : 3));
      const cx = HEAD_X + 16 + sway;
      for (let j = 0; j < w; j++) cells.add((cx + j) + ',' + (HEAD_Y + 4 + i));
    }
    paintMass(cells, { highlight: true });
    // tie band at base
    ctx.fillStyle = c.shade;
    rect(ctx, HEAD_X + 15, HEAD_Y + 5, 4, 2, c.shade);
  } else if (style === 'twintail') {
    // Two pigtails attached at temples, hanging down-out then straight down.
    const cells = new Set();
    for (const side of [-1, 1]) {
      // base wrap
      const bx = side < 0 ? HEAD_X - 2 : HEAD_X + 14;
      for (let dy = 0; dy <= 3; dy++) for (let dx = 0; dx < 4; dx++) {
        cells.add((bx + dx) + ',' + (HEAD_Y + 3 + dy));
      }
      // tail body
      for (let i = 0; i < 17; i++) {
        const drift = Math.round(i * 0.15);
        const ox = side < 0 ? bx - 1 - drift : bx + drift;
        const w = i < 3 ? 5 : (i < 12 ? 4 : (i < 16 ? 3 : 2));
        for (let j = 0; j < w; j++) cells.add((ox + j) + ',' + (HEAD_Y + 6 + i));
      }
    }
    paintMass(cells, { highlight: true });
    // ribbon ties
    ctx.fillStyle = c.shade;
    rect(ctx, HEAD_X - 2, HEAD_Y + 7, 5, 2, c.shade);
    rect(ctx, HEAD_X + 13, HEAD_Y + 7, 5, 2, c.shade);
  } else if (style === 'bob') {
    // Shoulder-length blunt cut framing the face, slightly flared at bottom.
    const cells = new Set();
    const top = HEAD_Y + 2;
    const bot = HEAD_Y + 17;
    for (let y = top; y < bot; y++) {
      const t = (y - top) / (bot - top);
      const flare = Math.round(t * 2);
      for (let x = HEAD_X - 1 - flare; x <= HEAD_X + 16 + flare; x++) cells.add(x + ',' + y);
    }
    paintMass(cells, { highlight: true });
  } else if (style === 'bun') {
    // Bun on top of head + short back fringe at nape.
    const cells = new Set();
    // bun ball (rounded)
    const bunRows = [4, 6, 8, 8, 6, 4];
    for (let i = 0; i < bunRows.length; i++) {
      const w = bunRows[i];
      const x0 = HEAD_CX - Math.floor(w / 2);
      for (let j = 0; j < w; j++) cells.add((x0 + j) + ',' + (HEAD_Y - 4 + i));
    }
    // small nape fringe
    for (let y = HEAD_Y + 12; y < HEAD_Y + 15; y++) {
      for (let x = HEAD_X + 2; x < HEAD_X + 14; x++) cells.add(x + ',' + y);
    }
    paintMass(cells, { highlight: true });
    // tie wrap around bun base
    ctx.fillStyle = c.shade;
    rect(ctx, HEAD_CX - 3, HEAD_Y + 1, 6, 1, c.shade);
  }
}

// ─── Hair front (crown + bangs sit on top of head fill) ───────
// Per-style hair silhouette as a column-height profile.
// `top[i]` = how many pixels of hair rise above HEAD_Y at column (HEAD_X-1 + i),
// `side`  = extra width on each side (columns added outside HEAD_X..HEAD_X+15)
// `flow`  = direction the strands fall: 'L', 'R', 'C' (center part), 'spiky'
const HAIR_PROFILE = {
  buzz:     { top: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], side: 0, flow: 'C' },
  undercut: { top: [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2], side: 0, flow: 'C' },
  short:    { top: [2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2], side: 1, flow: 'R' },
  swept:    { top: [2,2,3,3,4,4,4,4,3,3,3,3,2,2,2,2], side: 1, flow: 'R' },
  messy:    { top: [3,4,3,4,4,3,4,4,3,4,4,3,4,3,4,3], side: 2, flow: 'messy' },
  curtains: { top: [2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2], side: 2, flow: 'C' },
  spiky:    { top: [3,5,4,5,4,5,4,5,4,5,4,5,4,5,3,4], side: 1, flow: 'spiky' },
  ponytail: { top: [3,3,4,4,4,3,3,3,3,3,3,3,3,4,3,3], side: 2, flow: 'R' },
  twintail: { top: [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3], side: 2, flow: 'C' },
  bun:      { top: [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3], side: 2, flow: 'C' },
  long:     { top: [3,4,5,5,4,4,4,4,4,4,4,4,5,5,4,3], side: 3, flow: 'C' },
  wavy:     { top: [3,4,5,4,4,3,4,4,4,4,3,4,4,5,4,3], side: 3, flow: 'C' },
  bob:      { top: [3,3,4,4,4,4,4,4,4,4,4,4,4,4,3,3], side: 2, flow: 'C' },
};

// Build the complete front-hair silhouette as a single cell set.
// Includes: top dome (above HEAD_Y), side wings outside head, scalp cap covering
// the upper head (and its outline notches), bangs over forehead, and optional
// face-framing curtains for long/female styles.
// The whole mass is painted in one pass so there are no notches between layers.
function buildHairMass(style) {
  const p = HAIR_PROFILE[style] || HAIR_PROFILE.short;
  const cells = new Set();
  const add = (x, y) => cells.add(x + ',' + y);
  const addRect = (x0, y0, w, h = 1) => {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) add(x0 + dx, y0 + dy);
  };

  // 1) Top dome — jagged silhouette ABOVE the head per profile.top[]
  for (let i = 0; i < p.top.length; i++) {
    const h = p.top[i];
    for (let dy = 0; dy < h; dy++) add(HEAD_X + i, HEAD_Y - 1 - dy);
  }

  // 2) Side wings extending outside head width
  if (p.side > 0) {
    for (let s = 1; s <= p.side; s++) {
      const len = Math.max(2, p.side - s + 1) + 4;
      for (let dy = 0; dy < len; dy++) {
        add(HEAD_X - s, HEAD_Y + dy);
        add(HEAD_X + 15 + s, HEAD_Y + dy);
      }
      add(HEAD_X - s, HEAD_Y - 1);
      add(HEAD_X + 15 + s, HEAD_Y - 1);
    }
  }

  // 3) Scalp cap — covers top rows of the head AND the cascading head-outline
  // notches at the corners where the skull widens row by row. Use a constant
  // full-width rectangle so the cap never narrows between rows (which would
  // leave 1px background gaps between scalp and side wings).
  const crownDepth = (style === 'buzz' || style === 'undercut') ? 3 : 5;
  const widest = Math.max(...HEAD_ROWS);
  for (let i = 0; i < crownDepth; i++) {
    addRect(HEAD_X, HEAD_Y + i, widest);
  }

  // 4) Bangs over the forehead (style-specific)
  const bangY = HEAD_Y + 4;
  switch (style) {
    case 'short':
    case 'swept':
      addRect(HEAD_X + 1, bangY, 6, 2);
      addRect(HEAD_X + 7, bangY, 5, 1);
      add(HEAD_X + 7, bangY + 1);
      add(HEAD_X + 8, bangY + 1);
      break;
    case 'spiky':
      add(HEAD_X + 1, bangY); add(HEAD_X + 2, bangY + 1);
      add(HEAD_X + 5, bangY); add(HEAD_X + 6, bangY + 1);
      add(HEAD_X + 9, bangY); add(HEAD_X + 10, bangY + 1);
      add(HEAD_X + 13, bangY); add(HEAD_X + 14, bangY + 1);
      add(HEAD_X + 5, HEAD_Y - 1);
      add(HEAD_X + 10, HEAD_Y - 1);
      break;
    case 'messy':
      addRect(HEAD_X + 1, bangY, 3, 1);
      addRect(HEAD_X + 6, bangY + 1, 3, 1);
      addRect(HEAD_X + 11, bangY, 3, 1);
      add(HEAD_X + 3, HEAD_Y - 1);
      add(HEAD_X + 11, HEAD_Y - 1);
      break;
    case 'curtains':
      addRect(HEAD_X + 1, bangY, 5, 2);
      addRect(HEAD_X + 10, bangY, 5, 2);
      add(HEAD_X + 5, bangY + 2);
      add(HEAD_X + 10, bangY + 2);
      break;
    case 'undercut':
      addRect(HEAD_X + 2, bangY, 8, 1);
      break;
    case 'buzz':
      addRect(HEAD_X + 2, bangY, 12, 1);
      break;
    case 'long':
    case 'wavy':
    case 'bob':
      // face-framing curtains down the sides + center-part bangs
      for (let y = HEAD_Y + 3; y < HEAD_Y + 12; y++) {
        add(HEAD_X, y);
        add(HEAD_X + 15, y);
      }
      addRect(HEAD_X + 1, bangY, 6, 1);
      addRect(HEAD_X + 9, bangY, 6, 1);
      break;
    case 'ponytail':
      addRect(HEAD_X + 1, bangY, 14, 1);
      // small sideburn down the temple
      for (let y = HEAD_Y + 3; y < HEAD_Y + 7; y++) {
        add(HEAD_X, y); add(HEAD_X + 1, y);
      }
      break;
    case 'twintail':
    case 'bun':
      addRect(HEAD_X + 1, bangY, 14, 1);
      break;
  }

  return { cells, p };
}

function drawHairFront(ctx, state) {
  const c = hairColorOf(state);
  const style = hairStyleOf(state);
  const { cells, p } = buildHairMass(style);

  // 1) Base fill (overpaints any head outline pixels inside the hair mass)
  ctx.fillStyle = c.base;
  for (const k of cells) {
    const [x, y] = k.split(',').map(Number);
    ctx.fillRect(x, y, 1, 1);
  }

  // 2) Strand-flow shading — vertical 1px lines following hair direction
  ctx.fillStyle = c.shade;
  const shadeCols = (() => {
    if (p.flow === 'R') return [1, 4, 7, 10, 13];
    if (p.flow === 'L') return [2, 5, 8, 11, 14];
    if (p.flow === 'spiky') return [1, 3, 5, 7, 9, 11, 13];
    if (p.flow === 'messy') return [1, 4, 6, 9, 12, 14];
    return [2, 5, 10, 13]; // center part
  })();
  for (const ci of shadeCols) {
    const x = HEAD_X + ci;
    const h = p.top[ci] ?? 0;
    for (let dy = 0; dy < h - 1; dy++) {
      if (cells.has(x + ',' + (HEAD_Y - 1 - dy))) ctx.fillRect(x, HEAD_Y - 1 - dy, 1, 1);
    }
  }

  // Center part for C-flow styles
  if (p.flow === 'C' && style !== 'buzz' && style !== 'undercut') {
    px(ctx, HEAD_X + 7, HEAD_Y, c.shade);
    px(ctx, HEAD_X + 8, HEAD_Y + 1, c.shade);
  }

  // 3) Crown sheen — single highlight blob, not a full ring
  ctx.fillStyle = c.hi;
  const hiCols = p.flow === 'L' ? [10, 11, 12] : [3, 4, 5];
  for (const ci of hiCols) {
    const h = p.top[ci] ?? 0;
    if (h >= 2) {
      px(ctx, HEAD_X + ci, HEAD_Y - h + 1, c.hi);
      if (h >= 3) px(ctx, HEAD_X + ci, HEAD_Y - h + 2, c.hi);
    }
  }
  const hiX = p.flow === 'L' ? HEAD_X + 11 : HEAD_X + 4;
  px(ctx, hiX, HEAD_Y + 1, c.hi);
  px(ctx, hiX + 1, HEAD_Y + 1, c.hi);
  px(ctx, hiX, HEAD_Y + 2, c.hi);

  // 4) Outline the WHOLE hair mass in one pass (skipTrapped: don't fill V-dips)
  drawOutlineAround(ctx, cells, OUTLINE, true);
}

// ─── Accessory ────────────────────────────────────────────────
function drawAccessory(ctx, state) {
  const acc = accessoryOf(state);
  if (!acc) return;
  const eyeY = HEAD_Y + 9;
  switch (acc) {
    case 'glasses':
      // round frames over eyes
      rect(ctx, HEAD_CX - 8, eyeY - 1, 5, 5, OUTLINE);
      rect(ctx, HEAD_CX + 3, eyeY - 1, 5, 5, OUTLINE);
      // clear center
      rect(ctx, HEAD_CX - 7, eyeY, 3, 3, '#a8d8f8');
      rect(ctx, HEAD_CX + 4, eyeY, 3, 3, '#a8d8f8');
      px(ctx, HEAD_CX - 7, eyeY, '#ffffff');
      px(ctx, HEAD_CX + 4, eyeY, '#ffffff');
      // bridge
      px(ctx, HEAD_CX - 3, eyeY + 1, OUTLINE);
      px(ctx, HEAD_CX - 2, eyeY + 1, OUTLINE);
      px(ctx, HEAD_CX - 1, eyeY + 1, OUTLINE);
      px(ctx, HEAD_CX, eyeY + 1, OUTLINE);
      px(ctx, HEAD_CX + 1, eyeY + 1, OUTLINE);
      px(ctx, HEAD_CX + 2, eyeY + 1, OUTLINE);
      // re-draw pupils on top of lens tint
      for (const ex of [HEAD_CX - 7, HEAD_CX + 4]) {
        px(ctx, ex, eyeY + 1, OUTLINE);
        px(ctx, ex, eyeY + 2, OUTLINE);
      }
      break;
    case 'headphones':
      // band over crown
      rect(ctx, HEAD_CX - 8, HEAD_Y - 1, 16, 2, OUTLINE);
      rect(ctx, HEAD_CX - 7, HEAD_Y, 14, 1, '#2a2a32');
      // cups at ears
      rect(ctx, HEAD_X - 2, HEAD_Y + 8, 2, 4, OUTLINE);
      rect(ctx, HEAD_X + 16, HEAD_Y + 8, 2, 4, OUTLINE);
      rect(ctx, HEAD_X - 2, HEAD_Y + 9, 2, 2, '#c44848');
      rect(ctx, HEAD_X + 16, HEAD_Y + 9, 2, 2, '#c44848');
      break;
    case 'chef_hat':
      // puffy top
      rect(ctx, HEAD_CX - 7, HEAD_Y - 6, 14, 4, '#f4f0e4');
      rect(ctx, HEAD_CX - 8, HEAD_Y - 4, 16, 3, '#f4f0e4');
      rect(ctx, HEAD_CX - 8, HEAD_Y - 1, 16, 1, OUTLINE);
      // tiny shading
      rect(ctx, HEAD_CX + 5, HEAD_Y - 5, 2, 3, '#c8c4b4');
      break;
    case 'goggles':
      rect(ctx, HEAD_CX - 8, eyeY - 1, 5, 4, OUTLINE);
      rect(ctx, HEAD_CX + 3, eyeY - 1, 5, 4, OUTLINE);
      rect(ctx, HEAD_CX - 7, eyeY, 3, 2, '#60d8a8');
      rect(ctx, HEAD_CX + 4, eyeY, 3, 2, '#60d8a8');
      // strap
      rect(ctx, HEAD_CX - 12, eyeY, 24, 1, OUTLINE);
      break;
    case 'mask':
      // covers lower half of face
      rect(ctx, HEAD_X + 2, HEAD_Y + 13, 12, 4, OUTLINE);
      rect(ctx, HEAD_X + 3, HEAD_Y + 14, 10, 2, '#262630');
      break;
  }
}

// ─── Compose ──────────────────────────────────────────────────
function paint(ctx, state) {
  ctx.clearRect(0, 0, W, H);
  drawBg(ctx, state);
  drawHairBack(ctx, state);
  drawBody(ctx, state);
  drawHead(ctx, state);
  drawFace(ctx, state);
  drawHairFront(ctx, state);
  drawAccessory(ctx, state);
}

// ─── Public API ───────────────────────────────────────────────
// Modular image avatar -------------------------------------------------------
const MODULAR_ROOT = new URL('../assets/avatars/modular_v1_calibrated/', import.meta.url).href;
const MODULAR_IMAGES = new Map();
const MODULAR_PENDING_RENDERS = new Map();

const MALE_HAIR_STYLES = ['short_neat', 'short_fluffy', 'side_swept'];
const MALE_HAIR_COLORS = ['black', 'chestnut', 'dark_brown', 'silver'];
const FEMALE_HAIR_STYLES = ['bob', 'long_straight', 'side_ponytail'];
const FEMALE_HAIR_COLORS = ['black', 'chestnut', 'blonde', 'rose_pink'];

const BODY_ASSET_BY_OUTFIT = {
  male: {
    school: 'school_uniform', school_blazer: 'school_uniform', school_pe: 'gym_top',
    suit: 'suit', premium_suit: 'business_blazer', tuxedo: 'suit', cheap_suit: 'office_shirt',
    shirt_tie: 'office_shirt', blazer: 'business_blazer',
    hoodie: 'teal_student_hoodie', cs_hoodie: 'teal_student_hoodie', grad_hoodie: 'teal_student_hoodie',
    hanfu: 'xianxia_robe', daoist_robe: 'xianxia_robe', sect_uniform: 'xianxia_robe',
    robe: 'wizard_robe', house_robe: 'wizard_robe', labcoat: 'labcoat', chef: 'chef_coat',
    idol: 'idol_jacket', idol_dress: 'idol_jacket', idol_jacket: 'idol_jacket',
    tracksuit: 'tracksuit', tank: 'gym_top', jersey: 'esports_jersey', gaming_jersey: 'esports_jersey',
    poker_vest: 'business_blazer', thief: 'worn_hoodie', tactical: 'tracksuit',
    trench: 'business_blazer', naval: 'business_blazer', politician: 'business_blazer',
    tee: 'teal_student_hoodie', polo: 'office_shirt', cardigan: 'cardigan',
    sweater_v: 'cardigan', turtleneck: 'cardigan', denim_jacket: 'teal_student_hoodie',
    varsity: 'teal_student_hoodie', jacket: 'teal_student_hoodie', flannel: 'party_shirt',
    hawaiian: 'party_shirt', striped_tee: 'teal_student_hoodie', winter_coat: 'worn_hoodie',
    puffer: 'worn_hoodie', art_smock: 'office_shirt', beret_top: 'cardigan',
    photo_vest: 'party_shirt', ragged: 'worn_hoodie', patched_tee: 'worn_hoodie', pajamas: 'worn_hoodie',
  },
  female: {
    school: 'female_preppy_blazer', school_blazer: 'female_preppy_blazer', school_pe: 'female_gym_jacket',
    suit: 'female_suit', premium_suit: 'female_business_blazer', tuxedo: 'female_suit',
    cheap_suit: 'female_office_shirt', shirt_tie: 'female_office_shirt', blazer: 'female_business_blazer',
    hoodie: 'female_teal_crop_hoodie', cs_hoodie: 'female_teal_crop_hoodie', grad_hoodie: 'female_teal_crop_hoodie',
    hanfu: 'female_xianxia_hanfu', daoist_robe: 'female_xianxia_hanfu', sect_uniform: 'female_xianxia_hanfu',
    robe: 'female_wizard_robe', house_robe: 'female_wizard_robe', labcoat: 'female_labcoat',
    chef: 'female_chef_coat', idol: 'female_idol_stage', idol_dress: 'female_idol_stage',
    idol_jacket: 'female_idol_stage', tracksuit: 'female_gym_jacket', tank: 'female_gym_jacket',
    jersey: 'female_esports_jersey', gaming_jersey: 'female_esports_jersey',
    poker_vest: 'female_business_blazer', thief: 'female_worn_sweater', tactical: 'female_gym_jacket',
    trench: 'female_business_blazer', naval: 'female_business_blazer', politician: 'female_business_blazer',
    tee: 'female_white_blouse', polo: 'female_white_blouse', cardigan: 'female_cardigan_cream',
    sweater_v: 'female_worn_sweater', turtleneck: 'female_worn_sweater',
    denim_jacket: 'female_teal_crop_hoodie', varsity: 'female_teal_crop_hoodie',
    jacket: 'female_teal_crop_hoodie', flannel: 'female_party_top', hawaiian: 'female_party_top',
    striped_tee: 'female_white_blouse', winter_coat: 'female_worn_sweater', puffer: 'female_worn_sweater',
    art_smock: 'female_white_blouse', beret_top: 'female_cardigan_cream', photo_vest: 'female_party_top',
    ragged: 'female_worn_sweater', patched_tee: 'female_worn_sweater', pajamas: 'female_worn_sweater',
  },
};

const MODULAR_LAYER_TRANSFORMS = {
  body_full: {
    gym_top: { y: -3 },
    teal_student_hoodie: { y: -3 },
  },
  hair: {
    male_short_fluffy_black: { x: -1, y: -1, scale: 1.13 },
    male_short_fluffy_chestnut: { x: -1, y: -1, scale: 1.13 },
    male_short_fluffy_dark_brown: { x: -1, y: -1, scale: 1.16 },
    male_short_fluffy_silver: { x: 1, y: 1, scale: 0.94 },
  },
};

function modularLayerTransform(folder, id, state) {
  const base = MODULAR_LAYER_TRANSFORMS[folder]?.[id] || null;
  const isMale = (state?.sex ?? 0) === 0;
  const maleHeadGear =
    isMale &&
    ((folder === 'accessory' && (id === 'glasses' || id === 'headphones')) ||
     (folder === 'accessory_under' && id === 'headphones'));
  if (!maleHeadGear) return base;
  return { ...(base || {}), x: (base?.x || 0) + 1 };
}

function normIndex(value, size) {
  const n = Number.isFinite(value) ? Math.trunc(value) : 0;
  return ((n % size) + size) % size;
}

function assetUrl(folder, id) {
  return `${MODULAR_ROOT}${folder}/${id}.png`;
}

function flushModularRenders() {
  const entries = Array.from(MODULAR_PENDING_RENDERS.entries());
  MODULAR_PENDING_RENDERS.clear();
  for (const [canvas, state] of entries) {
    if (canvas) renderAvatar(canvas, state);
  }
}

function modularImage(src) {
  let entry = MODULAR_IMAGES.get(src);
  if (entry) return entry;
  const img = new Image();
  entry = { img, loaded: false, failed: false };
  img.onload = () => { entry.loaded = true; flushModularRenders(); };
  img.onerror = () => { entry.failed = true; flushModularRenders(); };
  img.src = src;
  MODULAR_IMAGES.set(src, entry);
  return entry;
}

function drawModularAsset(ctx, folder, id, canvas, state) {
  if (!id) return true;
  const entry = modularImage(assetUrl(folder, id));
  if (entry.loaded) {
    const transform = modularLayerTransform(folder, id, state);
    if (transform) {
      const scale = transform.scale || 1;
      const w = Math.round(MODULAR_W * scale);
      const h = Math.round(MODULAR_H * scale);
      const x = Math.round((MODULAR_W - w) / 2 + (transform.x || 0));
      const y = Math.round((MODULAR_H - h) / 2 + (transform.y || 0));
      ctx.drawImage(entry.img, x, y, w, h);
    } else {
      ctx.drawImage(entry.img, 0, 0, MODULAR_W, MODULAR_H);
    }
    return true;
  }
  if (!entry.failed) MODULAR_PENDING_RENDERS.set(canvas, state);
  return entry.failed;
}

function expressionId(state) {
  const hap = state.HAP ?? 5;
  if (hap < 3) return 'tired';
  if (hap > 7) return 'happy';
  return 'neutral';
}

function modularHeadId(state) {
  return `${state.sex === 1 ? 'female' : 'male'}_${expressionId(state)}`;
}

function modularHairId(state) {
  const female = state.sex === 1;
  const styles = female ? FEMALE_HAIR_STYLES : MALE_HAIR_STYLES;
  const colors = female ? FEMALE_HAIR_COLORS : MALE_HAIR_COLORS;
  const sex = female ? 'female' : 'male';
  const style = styles[normIndex(state.topVariant ?? 0, styles.length)];
  const color = colors[normIndex(state.outfitColorId ?? 0, colors.length)];
  return `${sex}_${style}_${color}`;
}

function modularBodyId(state) {
  const sex = state.sex === 1 ? 'female' : 'male';
  if ((state.HLT ?? 5) <= -2 && (state.MNY ?? 5) <= 3) {
    return sex === 'female' ? 'female_worn_sweater' : 'worn_hoodie';
  }
  const outfit = outfitOf(state);
  return BODY_ASSET_BY_OUTFIT[sex][outfit] || (sex === 'female' ? 'female_teal_crop_hoodie' : 'teal_student_hoodie');
}

function modularBgId(state) {
  const sl = state.storyline || '';
  if (sl === 'xianxia') return 'xianxia_temple';
  if (sl === 'hogwarts') return 'magic_corridor';
  if (sl === 'chef') return 'kitchen';
  if (sl === 'esports' || sl === 'worlds' || sl === 'minor_league') return 'esports_room';
  if (sl === 'fitness' || sl === 'athlete') return 'gym';
  if (sl === 'poker' || sl === 'triton' || sl === 'local_shark') return 'casino_party';
  if (sl === 'party' || sl === 'ceo' || sl === 'spy') return 'office';
  if (sl === 'idol' || sl === 'superstar' || sl === 'streamer') return 'campus';
  const rel = state.relationship || '';
  if (rel && rel !== '单身' && rel !== '鍗曡韩') return 'cafe_date';
  if ((state.HAP ?? 5) <= 2 || (state.HLT ?? 5) <= -2) return 'dorm_night';
  if ((state.INT ?? 0) >= 8) return 'library';
  if ((state.age ?? 15) >= 23 || (state.profession || '').includes('作')) return 'office';
  if ((state.school && state.school !== '无') || (state.profession || '').includes('学')) return 'campus';
  return 'dorm_day';
}

function modularBubbleId(state) {
  const sl = state.storyline || '';
  const rel = state.relationship || '';
  if ((state.HLT ?? 5) <= -4) return 'sick';
  if ((state.HAP ?? 5) <= 2) return 'stress';
  if (sl === 'xianxia') return 'xianxia';
  if (sl === 'hogwarts') return 'magic';
  if (sl === 'chef') return 'chef';
  if (sl === 'esports' || sl === 'worlds' || sl === 'minor_league') return 'esports';
  if (rel && rel !== '单身' && rel !== '鍗曡韩') return 'love';
  if ((state.MNY ?? 0) >= 9) return 'rich';
  if ((state.INT ?? 0) >= 8) return 'academic';
  if ((state.HAP ?? 5) >= 8) return 'happy';
  if ((state.HLT ?? 5) <= -2) return 'tired';
  return null;
}

function modularAccessoryId(state) {
  const sl = state.storyline || '';
  if (sl === 'esports' || sl === 'worlds' || sl === 'minor_league' || sl === 'band') return 'headphones';
  if (sl === 'hogwarts' || sl === 'academic' || (state.INT ?? 0) >= 8) return 'glasses';
  if (sl === 'xianxia') return 'spirit_beads';
  return null;
}

function modularAccessoryUnderId(state) {
  return modularAccessoryId(state) === 'headphones' ? 'headphones' : null;
}

function paintModular(ctx, canvas, state) {
  ctx.clearRect(0, 0, MODULAR_W, MODULAR_H);
  let usable = true;
  usable = drawModularAsset(ctx, 'bg', modularBgId(state), canvas, state) && usable;
  usable = drawModularAsset(ctx, 'body_full', modularBodyId(state), canvas, state) && usable;
  usable = drawModularAsset(ctx, 'head', modularHeadId(state), canvas, state) && usable;
  usable = drawModularAsset(ctx, 'accessory_under', modularAccessoryUnderId(state), canvas, state) && usable;
  usable = drawModularAsset(ctx, 'hair', modularHairId(state), canvas, state) && usable;
  usable = drawModularAsset(ctx, 'accessory', modularAccessoryId(state), canvas, state) && usable;
  usable = drawModularAsset(ctx, 'bubble', modularBubbleId(state), canvas, state) && usable;
  return usable;
}

export function renderAvatar(canvas, state) {
  canvas.width = MODULAR_W;
  canvas.height = MODULAR_H;
  canvas.style.imageRendering = 'pixelated';
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const avatarState = state || {};
  const useLegacy = avatarState._legacyAvatar === true;
  if (useLegacy) {
    canvas.width = W;
    canvas.height = H;
    ctx.imageSmoothingEnabled = false;
    paint(ctx, avatarState);
  } else {
    paintModular(ctx, canvas, avatarState);
  }
  // Idle bobbing via CSS animation (no JS rAF loop needed)
  canvas.style.animation = 'avatarBob 2.6s ease-in-out infinite';
}

export function createStandaloneAvatar(state) {
  const canvas = document.createElement('canvas');
  canvas.width = MODULAR_W;
  canvas.height = MODULAR_H;
  canvas.style.imageRendering = 'pixelated';
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  paintModular(ctx, canvas, state || {});
  return canvas;
}
