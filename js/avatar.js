// js/avatar.js �� Layered sprite avatar renderer
// Sprites: assets/avatars/{layer}/{key}.png
// Missing sprites �� null (silently skipped; placeholder silhouette shown if all layers absent)

const CANVAS_W = 128;
const CANVAS_H = 192;

// ������ Layer definitions ��������������������������������������������������������������������������������
// ─── Layer definitions ────────────────────────────────────────
const HAIR_M      = ['short_a', 'short_b', 'buzz', 'swept', 'messy', 'undercut', 'curtains', 'wolf'];
const HAIR_F      = ['long', 'long_wavy', 'ponytail', 'high_ponytail', 'bob_a', 'bob_b', 'twintail', 'bun', 'braids', 'pixie'];
const HAIR_COLORS = ['black', 'dark', 'brown', 'light', 'dyed'];
const OUTFITS     = ['casual_a', 'casual_b', 'casual_c', 'school', 'school_b', 'hoodie', 'hoodie_b', 'streetwear', 'suit', 'suit_b', 'sporty', 'sporty_b'];

// ������ Sprite cache ��������������������������������������������������������������������������������������������
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

// ������ State �� file key helpers ������������������������������������������������������������������
function _skin(hlt) {
  const v = hlt ?? 5;
  return v >= 7 ? 'light' : v >= 4 ? 'mid' : 'dark';
}

function _hairStyle(state) {
  const arr = state.sex === 0 ? HAIR_M : HAIR_F;
  return arr[(state.faceVariant ?? 0) % arr.length];
}

function _hairColor(state) {
  return HAIR_COLORS[(state.outfitColorId ?? 0) % HAIR_COLORS.length];
}

function _outfit(state) {
  const sl = state.storyline;
  if (sl === 'idol' || sl === 'superstar') return 'idol';
  if (sl === 'xianxia') return 'hanfu';
  if (sl === 'athlete' || sl === 'fitness') return 'sporty_b';
  if (sl === 'chef') return 'chef';
  if (sl === 'esports' || sl === 'worlds') return 'esports';
  if (sl === 'poker' || sl === 'triton') return 'poker';
  if (sl === 'spy' || (state.MNY ?? 0) >= 8 || sl === 'ceo') return 'suit';
  if (state.profession === '高中生' || state.profession === '本科生') return OUTFITS.filter(o => o.startsWith('school'))[(state.topVariant ?? 0) % 2];
  return OUTFITS[(state.topVariant ?? 0) % OUTFITS.length];
}

function _eyes(state) {
  // Glasses: INT≥8 + face combo, or specific faceVariant+color combo
  const wearsGlasses = ((state.faceVariant ?? 0) + (state.outfitColorId ?? 0)) % 5 === 0
    || ((state.INT ?? 5) >= 8 && (state.faceVariant ?? 0) % 2 === 0);
  if (wearsGlasses) return 'glasses';
  if ((state.HLT ?? 5) < 3) return 'tired';
  // normal_a vs normal_b based on faceVariant
  return ((state.faceVariant ?? 0) % 2 === 0) ? 'normal_a' : 'normal_b';
}

function _mouth(state) {
  const hap = state.HAP ?? 5;
  if (hap >= 8) return 'grin';
  if (hap >= 6) return 'smile';
  if (hap <= 3) return 'frown';
  return 'neutral';
}

function _paths(state) {
  const sex = state.sex === 0 ? 'male' : 'female';
  return [
    `assets/avatars/base/${sex}_${_skin(state.HLT)}.png`,
    `assets/avatars/clothes/${_outfit(state)}.png`,
    `assets/avatars/eyes/${_eyes(state)}.png`,
    `assets/avatars/mouth/${_mouth(state)}.png`,
    `assets/avatars/hair/${_hairStyle(state)}_${_hairColor(state)}.png`,
  ];
}

// ������ Placeholder silhouette (shown when no sprites are loaded) ��������������������������������
function _placeholder(ctx, state) {
  const skinHex  = _skin(state.HLT) === 'light' ? '#fce4c8' : _skin(state.HLT) === 'mid' ? '#e8c8a0' : '#d4a878';
  const hairHex  = ['#1a1416','#3a2820','#6a4a30','#c8a050','#e04080'][(state.outfitColorId ?? 0) % 5];
  const shirtHex = ['#4a8cba','#2a6a4a','#8a5a3a','#1a2a4a','#6a3a8a'][(state.topVariant ?? 0) % 5];
  const female   = state.sex === 1;

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Hair back
  ctx.fillStyle = hairHex;
  ctx.beginPath(); ctx.ellipse(64, 38, 22, 22, 0, 0, Math.PI * 2); ctx.fill();
  if (female) { ctx.fillRect(44, 38, 10, 36); ctx.fillRect(74, 38, 10, 36); }

  // Head
  ctx.fillStyle = skinHex;
  ctx.beginPath(); ctx.ellipse(64, 52, 20, 24, 0, 0, Math.PI * 2); ctx.fill();

  // Neck + torso
  ctx.fillRect(59, 74, 10, 10);
  ctx.fillStyle = shirtHex;
  const tw = female ? 44 : 52; const tx = (CANVAS_W - tw) / 2;
  ctx.fillRect(tx, 84, tw, 48);
  ctx.fillRect(tx - 13, 88, 14, 36);
  ctx.fillRect(tx + tw - 1, 88, 14, 36);

  // Legs
  ctx.fillStyle = '#2a3a5a';
  ctx.fillRect(tx + 4, 132, 16, 48); ctx.fillRect(tx + tw - 20, 132, 16, 48);

  // Hair front
  ctx.fillStyle = hairHex;
  ctx.beginPath(); ctx.ellipse(64, 34, 22, 18, 0, 0, Math.PI); ctx.fill();

  // Eyes
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(52, 50, 6, 6); ctx.fillRect(70, 50, 6, 6);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(53, 51, 2, 2); ctx.fillRect(71, 51, 2, 2);

  // Mouth
  const hap = state.HAP ?? 5;
  ctx.strokeStyle = '#9a3a3a'; ctx.lineWidth = 2; ctx.beginPath();
  if (hap >= 7)      { ctx.arc(64, 65, 6, 0, Math.PI); }
  else if (hap <= 3) { ctx.arc(64, 70, 6, Math.PI, 0); }
  else               { ctx.moveTo(58, 66); ctx.lineTo(70, 66); }
  ctx.stroke();
}

// ������ Composite layers onto canvas ����������������������������������������������������������
async function _composite(ctx, state) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  const imgs = await Promise.all(_paths(state).map(_load));
  if (!imgs.some(Boolean)) {
    _placeholder(ctx, state);
    return;
  }
  for (const img of imgs) {
    if (img) ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
  }
}

// ������ Idle animation ��������������������������������������������������������������������������������������
let _animId   = null;
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
    const dy = Math.sin(t * 0.04) * 1.5;
    canvas.style.transform = `translateY(${dy.toFixed(2)}px)`;
    _animId = requestAnimationFrame(tick);
  }
  tick();
}

// ������ Public API ����������������������������������������������������������������������������������������������
export function renderAvatar(canvas, state) {
  _startAnim(canvas, state);
}

export function createStandaloneAvatar(state) {
  const canvas = document.createElement('canvas');
  canvas.width  = CANVAS_W;
  canvas.height = CANVAS_H;
  canvas.style.imageRendering = 'pixelated';
  _composite(canvas.getContext('2d'), state); // async draw, fine for decorative use
  return canvas;
}
