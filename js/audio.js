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

// ── Stings (Web Audio synthesis, no files needed) ────────────────────────────
// Short one-shot musical hits triggered at story beats. Each composes the
// existing primitives (_bit, _wood) plus a few extras inline.

function _tone(type, freq, duration, vol, slide = 0) {
  if (_muted) return;
  try {
    const ctx = _ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + duration);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  } catch (e) {}
}

function _noiseBurst(duration, vol, filterFreq = 4000, q = 1) {
  if (_muted) return;
  try {
    const ctx = _ensureCtx();
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
    src.stop(t + duration + 0.05);
  } catch (e) {}
}

// Red-cinematic intro sting (hidden storyline): low rumble + reverse-cymbal swell + impact
export function stingHiddenIntro() {
  if (_muted) return;
  _noiseBurst(0.8, 0.08, 2000, 0.5);            // swell
  setTimeout(() => {
    _tone('sawtooth', 110, 0.6, 0.08, -40);     // low rumble
    _tone('square', 55, 0.8, 0.06);             // sub
    _noiseBurst(0.15, 0.12, 800, 2);            // impact
  }, 700);
}

// Gold intro sting (special / career storyline): rising brass-like chord
export function stingSpecialIntro() {
  if (_muted) return;
  // C major triad arpeggio then chord
  _wood(523, 0.18, 0.07);                         // C5
  setTimeout(() => _wood(659, 0.18, 0.07), 90);   // E5
  setTimeout(() => _wood(784, 0.22, 0.07), 180);  // G5
  setTimeout(() => {
    _tone('triangle', 523, 0.6, 0.06);
    _tone('triangle', 659, 0.6, 0.05);
    _tone('triangle', 784, 0.6, 0.05);
    _tone('triangle', 1047, 0.6, 0.04);           // C6 sparkle
  }, 280);
}

// Death sting: low sustained tone + bell decay
export function stingDeath() {
  if (_muted) return;
  _tone('sine', 110, 1.2, 0.08);
  _tone('sine', 165, 1.2, 0.05);
  setTimeout(() => {
    _tone('sine', 392, 1.6, 0.07);                // G4 bell
    _tone('sine', 784, 1.6, 0.03);                // G5 overtone
  }, 200);
}

// Legendary ending sting: rising triumphant triad
export function stingLegendary() {
  if (_muted) return;
  _wood(523, 0.2, 0.08);
  setTimeout(() => _wood(659, 0.2, 0.08), 120);
  setTimeout(() => _wood(784, 0.25, 0.08), 240);
  setTimeout(() => {
    _wood(1047, 0.5, 0.09);
    _tone('triangle', 1047, 0.7, 0.05);
    _tone('triangle', 1319, 0.7, 0.04);            // E6
    _tone('triangle', 1568, 0.7, 0.04);            // G6
  }, 380);
}

// Attempt success: ascending three-note flourish
export function stingSuccess() {
  if (_muted) return;
  _bit(523, 0.08, 0.07);
  setTimeout(() => _bit(659, 0.08, 0.07), 80);
  setTimeout(() => {
    _bit(784, 0.12, 0.07);
    _wood(784, 0.2, 0.06);
  }, 160);
}

// Attempt failure: descending minor flourish
export function stingFail() {
  if (_muted) return;
  _bit(523, 0.1, 0.07);
  setTimeout(() => _bit(440, 0.1, 0.06), 110);
  setTimeout(() => {
    _bit(330, 0.15, 0.06);
    _tone('sawtooth', 165, 0.5, 0.05, -30);
  }, 220);
}
