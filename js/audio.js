// ── Audio System ─────────────────────────────────────────────────────────────
// Hybrid: Kenney ogg files for UI interactions + Web Audio synthesis for stat effects.
// Kenney assets: CC0 licensed from kenney.nl

let _ctx = null;
let _muted = false;
const _audioCache = {};  // path → AudioBuffer
const SFX_BASE = 'assets/sfx/';

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

// ── File-based playback ─────────────────────────────────────────────────────
async function _loadBuffer(filename) {
  if (_audioCache[filename]) return _audioCache[filename];
  try {
    const ctx = _ensureCtx();
    const resp = await fetch(SFX_BASE + filename);
    const arr = await resp.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr);
    _audioCache[filename] = buf;
    return buf;
  } catch (e) {
    return null;
  }
}

function _playFile(filename, vol = 0.5) {
  if (_muted) return;
  _loadBuffer(filename).then(buf => {
    if (!buf) return;
    try {
      const ctx = _ensureCtx();
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch (e) {}
  });
}

// Preload critical sounds on first user interaction
let _preloaded = false;
export function preloadSounds() {
  if (_preloaded) return;
  _preloaded = true;
  const critical = [
    'click_002.ogg', 'rollover1.ogg', 'click3.ogg', 'click4.ogg',
    'glitch_004.ogg', 'switch3.ogg', 'click1.ogg'
  ];
  critical.forEach(f => _loadBuffer(f));
}

// ── Synth primitives (kept for stat effects) ────────────────────────────────

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

function _wood(freq, duration, vol = 0.10) {
  if (_muted) return;
  try {
    const ctx = _ensureCtx();
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2.76;
    filter.type = 'bandpass';
    filter.frequency.value = freq * 1.5;
    filter.Q.value = 2.5;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(vol * 0.3, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(filter);
    osc2.connect(gain);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc2.start(t);
    osc.stop(t + duration + 0.01);
    osc2.stop(t + duration + 0.01);
  } catch (e) {}
}

// ── Sound library ────────────────────────────────────────────────────────────

// 1,2,3: Generic UI tap / toggle (sex, skin, random appearance)
export function sfxClick() {
  _playFile('click_002.ogg', 0.5);
}

// 9: Primary confirm (start game)
export function sfxConfirm() {
  _playFile('click4.ogg', 0.55);
}

// 12: Choice button (event options)
export function sfxChoice() {
  _playFile('click3.ogg', 0.5);
}

// 10: Month tick
export function sfxTick() {
  _playFile('rollover1.ogg', 0.35);
}

// 13: Stat up — kept as synth (ascending pitch conveys "up")
export function sfxStatUp() {
  _bit(523, 0.06, 0.06);
  setTimeout(() => {
    _bit(784, 0.08, 0.06);
    _wood(784, 0.1, 0.05);
  }, 50);
}

// 14: Stat down — kept as synth (descending pitch conveys "down")
export function sfxStatDown() {
  _bit(523, 0.06, 0.06);
  setTimeout(() => _bit(330, 0.1, 0.06), 50);
}

// 15: Storyline enter — kept as synth for now
export function sfxKeyEvent() {
  _wood(523, 0.25, 0.07);
  setTimeout(() => _wood(659, 0.25, 0.06), 80);
  setTimeout(() => _wood(784, 0.3, 0.06), 160);
}

// 16: Negative event — kept as synth for now
export function sfxBad() {
  _bit(120, 0.25, 0.06, -40);
  _bit(150, 0.3, 0.04);
}

// 17: Achievement unlock
export function sfxAchievement() {
  _playFile('confirmation_002.ogg', 0.6);
}

// 18: Frenemy card played
export function sfxCard() {
  _playFile('switch9.ogg', 0.5);
}

// 25: Game end — kept as synth for now
export function sfxGameEnd() {
  _bit(784, 0.1, 0.06);
  setTimeout(() => _bit(659, 0.1, 0.06), 120);
  setTimeout(() => _bit(523, 0.12, 0.06), 240);
  setTimeout(() => {
    _bit(392, 0.2, 0.05);
    _wood(392, 0.4, 0.06);
  }, 360);
}

// 29: Reunion — kept as synth for now
export function sfxReunion() {
  _wood(659, 0.2, 0.07);
  setTimeout(() => _wood(784, 0.2, 0.06), 90);
  setTimeout(() => _wood(1047, 0.3, 0.07), 180);
  setTimeout(() => _bit(1047, 0.06, 0.03), 180);
}

// 24: Toggle sound — always plays (bypass mute) for unmute feedback
export function sfxToggle() {
  const wasMuted = _muted;
  _muted = false;
  _playFile('click_005.ogg', 0.5);
  _muted = wasMuted;
}

// ── Granular sounds ─────────────────────────────────────────────────────────

// 6: Stat point +/- buttons in allocation screen
export function sfxAllocTick() {
  _playFile('glitch_004.ogg', 0.4);
}

// 4: Talent card flip / selection
export function sfxTalentFlip() {
  _playFile('switch3.ogg', 0.5);
}

// 7: Random allocation / shuffle
export function sfxShuffle() {
  _playFile('click5.ogg', 0.5);
}

// 26: Navigation / screen switch / summary page flip
export function sfxNav() {
  _playFile('rollover2.ogg', 0.45);
}

// 1,2,3: Sex / option toggle (same as sfxClick)
export function sfxToggleOption() {
  _playFile('click_002.ogg', 0.5);
}

// 11: Auto-play speed switch
export function sfxAutoToggle() {
  _playFile('switch5.ogg', 0.45);
}

// Attempt action (debut, fitness, chef, etc.) — kept as synth
export function sfxAttempt() {
  _bit(330, 0.06, 0.05);
  setTimeout(() => _bit(440, 0.06, 0.05), 60);
  setTimeout(() => _bit(550, 0.06, 0.05), 120);
}

// 21: Modal open
export function sfxModalOpen() {
  _playFile('switch2.ogg', 0.45);
}

// 23: Modal close / cancel
export function sfxModalClose() {
  _playFile('switch6.ogg', 0.45);
}

// 22: Modal confirm (OK)
export function sfxModalConfirm() {
  _playFile('click1.ogg', 0.5);
}

// 19: Frenemy card select (during draft)
export function sfxCardSelect() {
  _playFile('switch4.ogg', 0.5);
}

// 20: Frenemy card deselect
export function sfxCardDeselect() {
  _playFile('switch8.ogg', 0.45);
}

// 28: Restart game
export function sfxRestart() {
  _playFile('switch11.ogg', 0.5);
}

// 27: Summary / poster share
export function sfxShare() {
  _playFile('click2.ogg', 0.5);
}

// 5: Talent card deselect
export function sfxTalentDeselect() {
  _playFile('switch7.ogg', 0.45);
}

// 8: Back button (alloc → talent)
export function sfxBack() {
  _playFile('switch1.ogg', 0.45);
}

// NEW: Error / locked option
export function sfxError() {
  _playFile('error_005.ogg', 0.5);
}
