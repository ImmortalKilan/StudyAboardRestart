// ── Audio System ─────────────────────────────────────────────────────────────
// 8-bit pixel core + wooden/natural resonance warmth.
// All sounds synthesized via Web Audio API — no external files needed.

let _ctx = null;
let _muted = false;

function _ensureCtx() {
  if (!_ctx) {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// ── Mute control ─────────────────────────────────────────────────────────────
export function isMuted() { return _muted; }
export function setMuted(val) {
  _muted = val;
  try { localStorage.setItem('sasr_muted', val ? '1' : '0'); } catch (e) {}
}
export function initMuteState() {
  try {
    const v = localStorage.getItem('sasr_muted');
    if (v === '1') _muted = true;
  } catch (e) {}
}

// ── Synth primitives ─────────────────────────────────────────────────────────

// 8-bit tone — square wave with optional pitch slide for retro feel
function _bit(freq, duration, vol = 0.08, slide = 0) {
  if (_muted) return;
  try {
    const ctx = _ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(freq + slide, ctx.currentTime + duration);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.01);
  } catch (e) {}
}

// Wooden / marimba tone — sine with fast attack + bandpass resonance
function _wood(freq, duration, vol = 0.10) {
  if (_muted) return;
  try {
    const ctx = _ensureCtx();
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Primary tone
    osc.type = 'sine';
    osc.frequency.value = freq;
    // Harmonic overtone for body
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2.76; // inharmonic partial, wood-like

    filter.type = 'bandpass';
    filter.frequency.value = freq * 1.5;
    filter.Q.value = 2.5;

    // Sharp attack, fast decay (wood percussion envelope)
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.003); // 3ms attack
    gain.gain.exponentialRampToValueAtTime(vol * 0.3, t + 0.04); // fast initial decay
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration); // tail

    osc.connect(filter);
    osc2.connect(gain);
    gain.gain.setValueAtTime !== undefined; // just referencing
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc2.start(t);
    osc.stop(t + duration + 0.01);
    osc2.stop(t + duration + 0.01);
  } catch (e) {}
}

// Noise burst (filtered) — for texture hits
function _noiseHit(duration, freq = 2000, vol = 0.04) {
  if (_muted) return;
  try {
    const ctx = _ensureCtx();
    const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const fadeLen = Math.floor(data.length * 0.6);
    for (let i = 0; i < fadeLen; i++) data[data.length - 1 - i] *= i / fadeLen;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 1.5;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  } catch (e) {}
}

// ── Sound library ────────────────────────────────────────────────────────────

// Generic UI tap — light wood knock
export function sfxClick() {
  _wood(880, 0.08, 0.06);
}

// Primary confirm (start game, confirm talent, etc.) — 8-bit ascending + wood body
export function sfxConfirm() {
  _bit(440, 0.05, 0.06);
  setTimeout(() => _bit(660, 0.05, 0.06), 40);
  setTimeout(() => _wood(880, 0.12, 0.08), 80);
}

// Choice button — wood tap with slight pitch
export function sfxChoice() {
  _wood(660, 0.09, 0.07);
  _bit(660, 0.04, 0.03);
}

// Month tick — soft noise + faint wood
export function sfxTick() {
  _noiseHit(0.04, 3000, 0.02);
  _wood(1200, 0.03, 0.02);
}

// Stat up — 8-bit ascending two-note + wood resonance
export function sfxStatUp() {
  _bit(523, 0.06, 0.06);
  setTimeout(() => {
    _bit(784, 0.08, 0.06);
    _wood(784, 0.1, 0.05);
  }, 50);
}

// Stat down — descending 8-bit
export function sfxStatDown() {
  _bit(523, 0.06, 0.06);
  setTimeout(() => _bit(330, 0.1, 0.06), 50);
}

// Storyline enter — warm wood chord arpeggio
export function sfxKeyEvent() {
  _wood(523, 0.25, 0.07);
  setTimeout(() => _wood(659, 0.25, 0.06), 80);
  setTimeout(() => _wood(784, 0.3, 0.06), 160);
}

// Negative event — low 8-bit rumble
export function sfxBad() {
  _bit(120, 0.25, 0.06, -40);
  _bit(150, 0.3, 0.04);
}

// Achievement unlock — 8-bit fanfare arpeggio
export function sfxAchievement() {
  _bit(523, 0.08, 0.06);
  setTimeout(() => _bit(659, 0.08, 0.06), 70);
  setTimeout(() => _bit(784, 0.08, 0.06), 140);
  setTimeout(() => {
    _bit(1047, 0.15, 0.07);
    _wood(1047, 0.2, 0.06);
  }, 210);
}

// Frenemy card played — noise whoosh + 8-bit impact
export function sfxCard() {
  _noiseHit(0.1, 1500, 0.06);
  setTimeout(() => _bit(250, 0.1, 0.07, 80), 60);
}

// Game end — slow descending 8-bit with wood resonance tail
export function sfxGameEnd() {
  _bit(784, 0.1, 0.06);
  setTimeout(() => _bit(659, 0.1, 0.06), 120);
  setTimeout(() => _bit(523, 0.12, 0.06), 240);
  setTimeout(() => {
    _bit(392, 0.2, 0.05);
    _wood(392, 0.4, 0.06);
  }, 360);
}

// Reunion — warm wood chime cascade
export function sfxReunion() {
  _wood(659, 0.2, 0.07);
  setTimeout(() => _wood(784, 0.2, 0.06), 90);
  setTimeout(() => _wood(1047, 0.3, 0.07), 180);
  setTimeout(() => _bit(1047, 0.06, 0.03), 180);
}

// Toggle sound — always plays (bypass mute) for unmute feedback
export function sfxToggle() {
  const wasMuted = _muted;
  _muted = false;
  _wood(wasMuted ? 880 : 440, 0.08, 0.08);
  _muted = wasMuted;
}

// ── NEW: additional granular sounds ──────────────────────────────────────────

// Stat point +/- buttons in allocation screen — tiny wood tick
export function sfxAllocTick() {
  _wood(1100, 0.04, 0.05);
}

// Talent card flip / selection — 8-bit flip
export function sfxTalentFlip() {
  _bit(600, 0.03, 0.05, 200);
  setTimeout(() => _noiseHit(0.03, 4000, 0.02), 20);
}

// Random allocation / shuffle — rapid wood rattle
export function sfxShuffle() {
  for (let i = 0; i < 5; i++) {
    setTimeout(() => _wood(800 + i * 80, 0.03, 0.04), i * 30);
  }
}

// Navigation / screen switch — soft whoosh
export function sfxNav() {
  _noiseHit(0.06, 2500, 0.03);
  _wood(600, 0.05, 0.03);
}

// Sex / option toggle — light 8-bit blip
export function sfxToggleOption() {
  _bit(880, 0.04, 0.05);
}

// Auto-play speed switch
export function sfxAutoToggle() {
  _bit(700, 0.03, 0.04);
  setTimeout(() => _bit(900, 0.03, 0.04), 30);
}

// Attempt action (debut, fitness, chef, etc.) — tension build
export function sfxAttempt() {
  _bit(330, 0.06, 0.05);
  setTimeout(() => _bit(440, 0.06, 0.05), 60);
  setTimeout(() => _bit(550, 0.06, 0.05), 120);
}

// Modal open
export function sfxModalOpen() {
  _wood(500, 0.08, 0.04);
  _bit(500, 0.04, 0.03);
}

// Modal close / cancel
export function sfxModalClose() {
  _bit(400, 0.05, 0.04, -100);
}

// Frenemy card select (during draft)
export function sfxCardSelect() {
  _wood(900, 0.06, 0.06);
  _bit(900, 0.03, 0.03);
}

// Frenemy card deselect
export function sfxCardDeselect() {
  _bit(600, 0.04, 0.04, -100);
}

// Restart game
export function sfxRestart() {
  _bit(600, 0.06, 0.05);
  setTimeout(() => _bit(400, 0.06, 0.05), 50);
  setTimeout(() => _bit(600, 0.08, 0.06), 100);
}

// Summary / poster share
export function sfxShare() {
  _wood(700, 0.08, 0.05);
  setTimeout(() => _wood(900, 0.08, 0.05), 60);
  setTimeout(() => _wood(1100, 0.12, 0.06), 120);
}
