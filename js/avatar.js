// js/avatar.js — Layered sprite avatar renderer
// Layers (bottom to top): bg → head → body → hair → accessory
// All sprites: 48×64 pixels, PNG transparent (except bg)
// Missing sprites → silently skipped; placeholder shown if all absent

const CANVAS_W = 48;
const CANVAS_H = 64;

// ─── Layer pools ──────────────────────────────────────────────
const FACE_VARIANTS = ['a', 'b', 'c'];
const HAIR_M = ['short_a', 'short_b', 'buzz', 'swept', 'messy', 'undercut', 'curtains', 'wolf'];
const HAIR_F = ['long', 'long_wavy', 'ponytail', 'high_ponytail', 'bob_a', 'bob_b', 'twintail', 'bun', 'braids', 'pixie'];
const HAIR_COLORS = ['black', 'dark', 'brown', 'light', 'dyed'];
const OUTFITS = ['casual_a', 'casual_b', 'casual_c', 'school', 'school_b', 'hoodie', 'hoodie_b', 'streetwear', 'suit', 'suit_b', 'sporty', 'sporty_b'];

// ─── Sprite cache ─────────────────────────────────────────────
const _cache = new Map();
function _load(src) {
  if (_cache.has(src)) return _cache.get(src);
  const p = new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  _cache.set(src, p);
  return p;
}

// ─── State → key helpers ──────────────────────────────────────
function _skin(hlt) {
  const v = hlt ?? 5;
  return v >= 7 ? 'light' : v >= 4 ? 'mid' : 'dark';
}

function _faceVariant(state) {
  return FACE_VARIANTS[(state.faceVariant ?? 0) % FACE_VARIANTS.length];
}

function _hairStyle(state) {
  const arr = state.sex === 0 ? HAIR_M : HAIR_F;
  return arr[(state.topVariant ?? 0) % arr.length];
}

function _hairColor(state) {
  return HAIR_COLORS[(state.outfitColorId ?? 0) % HAIR_COLORS.length];
}

function _outfit(state) {
  const sl = state.storyline;
  if (sl === 'idol' || sl === 'superstar') return 'idol';
  if (sl === 'xianxia')                   return 'hanfu';
  if (sl === 'athlete' || sl === 'fitness') return 'sporty_b';
  if (sl === 'chef')                       return 'chef';
  if (sl === 'esports' || sl === 'worlds') return 'esports';
  if (sl === 'poker' || sl === 'triton')   return 'poker';
  if (sl === 'spy' || (state.MNY ?? 0) >= 8 || sl === 'ceo') return 'suit';
  if (state.profession === '高中生' || state.profession === '本科生')
    return ['school', 'school_b'][(state.topVariant ?? 0) % 2];
  return OUTFITS[(state.topVariant ?? 0) % OUTFITS.length];
}

function _accessory(state) {
  const sl = state.storyline;
  if (sl === 'esports' || sl === 'worlds') return 'headphones';
  if (sl === 'chef')                       return 'chef_hat';
  if ((state.INT ?? 5) >= 8 && (state.faceVariant ?? 0) % 2 === 0) return 'glasses';
  if ((state.faceVariant ?? 0) % 5 === 1 && (state.outfitColorId ?? 0) % 2 === 0) return 'glasses';
  return null;
}

function _bg(state) {
  const sl = state.storyline;
  if (sl === 'spy')                         return 'bg_spy';
  if (sl === 'xianxia')                     return 'bg_temple';
  if (sl === 'idol' || sl === 'superstar')  return 'bg_stage';
  if (sl === 'poker' || sl === 'triton')    return 'bg_casino';
  if (sl === 'party')                       return 'bg_club';
  if (sl === 'fitness' || sl === 'athlete') return 'bg_gym';
  if (sl === 'chef')                        return 'bg_kitchen';
  if (sl === 'esports' || sl === 'worlds')  return 'bg_cyber';
  if ((state.age ?? 16) <= 18)             return 'bg_school';
  if ((state.age ?? 16) <= 22)             return 'bg_campus';
  if ((state.MNY ?? 5) >= 8)               return 'bg_penthouse';
  return 'bg_office';
}

function _paths(state) {
  const sex = state.sex === 0 ? 'male' : 'female';
  const skin = _skin(state.HLT);
  const fv = _faceVariant(state);
  const acc = _accessory(state);
  return [
    `assets/avatars/bg/${_bg(state)}.png`,
    `assets/avatars/head/${sex}_${skin}_${fv}.png`,
    `assets/avatars/body/${_outfit(state)}.png`,
    `assets/avatars/hair/${_hairStyle(state)}_${_hairColor(state)}.png`,
    acc ? `assets/avatars/accessory/${acc}.png` : null,
  ].filter(Boolean);
}

// ─── Placeholder (shown when no sprites exist yet) ────────────
function _placeholder(ctx, state) {
  const skinHex  = _skin(state.HLT) === 'light' ? '#fce4c8' : _skin(state.HLT) === 'mid' ? '#e8c8a0' : '#d4a878';
  const hairHex  = ['#1a1416','#3a2820','#6a4a30','#c8a050','#e04080'][(state.outfitColorId ?? 0) % 5];
  const shirtHex = ['#4a8cba','#2a6a4a','#8a5a3a','#1a2a4a','#6a3a8a'][(state.topVariant ?? 0) % 5];
  const female   = state.sex === 1;

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // BG
  ctx.fillStyle = '#1a2030';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Hair back
  ctx.fillStyle = hairHex;
  ctx.beginPath(); ctx.ellipse(24, 14, 10, 10, 0, 0, Math.PI * 2); ctx.fill();
  if (female) { ctx.fillRect(14, 14, 4, 16); ctx.fillRect(30, 14, 4, 16); }

  // Head
  ctx.fillStyle = skinHex;
  ctx.beginPath(); ctx.ellipse(24, 18, 8, 10, 0, 0, Math.PI * 2); ctx.fill();

  // Body
  const tw = female ? 18 : 22; const tx = (CANVAS_W - tw) / 2;
  ctx.fillStyle = shirtHex;
  ctx.fillRect(tx, 32, tw, 20);
  ctx.fillRect(tx - 5, 34, 6, 14);
  ctx.fillRect(tx + tw - 1, 34, 6, 14);

  // Hair front
  ctx.fillStyle = hairHex;
  ctx.beginPath(); ctx.ellipse(24, 11, 10, 7, 0, 0, Math.PI); ctx.fill();

  // Eyes
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(19, 17, 3, 3); ctx.fillRect(26, 17, 3, 3);
  ctx.fillStyle = '#fff';
  ctx.fillRect(20, 17, 1, 1); ctx.fillRect(27, 17, 1, 1);

  // Mouth
  const hap = state.HAP ?? 5;
  ctx.fillStyle = '#9a3a3a';
  if (hap >= 6) { ctx.fillRect(21, 24, 6, 1); ctx.fillRect(20, 23, 1, 1); ctx.fillRect(27, 23, 1, 1); }
  else if (hap <= 3) { ctx.fillRect(21, 25, 6, 1); ctx.fillRect(20, 24, 1, 1); ctx.fillRect(27, 24, 1, 1); }
  else { ctx.fillRect(21, 24, 6, 1); }
}

// ─── Composite layers ─────────────────────────────────────────
async function _composite(ctx, state) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  const imgs = await Promise.all(_paths(state).map(_load));
  if (!imgs.some(Boolean)) { _placeholder(ctx, state); return; }
  for (const img of imgs) {
    if (img) ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
  }
}

// ─── Idle animation ───────────────────────────────────────────
let _animId = null;
let _animCanvas = null;

function _stopAnim() {
  if (_animId) { cancelAnimationFrame(_animId); _animId = null; }
  if (_animCanvas) { _animCanvas.style.transform = ''; _animCanvas = null; }
}

function _startAnim(canvas, state) {
  _stopAnim();
  _animCanvas = canvas;
  canvas.width  = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  let t = 0;
  let ready = false;

  async function tick() {
    if (!ready) { await _composite(ctx, state); ready = true; }
    t++;
    const dy = Math.sin(t * 0.04) * 1.2;
    canvas.style.transform = `translateY(${dy.toFixed(2)}px)`;
    _animId = requestAnimationFrame(tick);
  }
  tick();
}

// ─── Public API ───────────────────────────────────────────────
export function renderAvatar(canvas, state) {
  _startAnim(canvas, state);
}

export function createStandaloneAvatar(state) {
  const canvas = document.createElement('canvas');
  canvas.width  = CANVAS_W;
  canvas.height = CANVAS_H;
  canvas.style.imageRendering = 'pixelated';
  _composite(canvas.getContext('2d'), state);
  return canvas;
}
