// ── Audio System ─────────────────────────────────────────────────────────────
// All sounds synthesized via Web Audio API — no external files needed.
// Plays short tonal blips for UI feedback; respects user mute preference.

let _ctx = null;
let _muted = false;

// Lazy-init AudioContext (must happen after user gesture)
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

// ── Core synth helper ────────────────────────────────────────────────────────
function _beep(freq, duration, type = 'sine', vol = 0.12, ramp = 0.02) {
  if (_muted) return;
  try {
    const ctx = _ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function _noise(duration, vol = 0.06) {
  if (_muted) return;
  try {
    const ctx = _ensureCtx();
    const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * vol;
    // Fade envelope
    const fadeLen = Math.floor(data.length * 0.3);
    for (let i = 0; i < fadeLen; i++) data[data.length - 1 - i] *= i / fadeLen;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
  } catch (e) {}
}

// ── Sound library ────────────────────────────────────────────────────────────

// UI button click — light tap
export function sfxClick() {
  _beep(800, 0.08, 'sine', 0.08);
}

// Primary button (confirm, start, etc.) — higher brighter tap
export function sfxConfirm() {
  _beep(880, 0.06, 'sine', 0.1);
  setTimeout(() => _beep(1100, 0.08, 'sine', 0.08), 50);
}

// Choice button — soft click
export function sfxChoice() {
  _beep(660, 0.07, 'triangle', 0.1);
}

// Month advance / tick — very subtle page turn
export function sfxTick() {
  _noise(0.06, 0.03);
}

// Stat up — ascending two-note
export function sfxStatUp() {
  _beep(523, 0.08, 'sine', 0.08);
  setTimeout(() => _beep(659, 0.1, 'sine', 0.07), 60);
}

// Stat down — descending two-note
export function sfxStatDown() {
  _beep(440, 0.08, 'sine', 0.08);
  setTimeout(() => _beep(330, 0.12, 'sine', 0.07), 60);
}

// Key event (storyline enter, reunion, etc.) — warm chord
export function sfxKeyEvent() {
  _beep(523, 0.3, 'sine', 0.07);
  _beep(659, 0.3, 'sine', 0.06);
  _beep(784, 0.3, 'sine', 0.05);
}

// Negative event (death, disaster) — low rumble
export function sfxBad() {
  _beep(150, 0.3, 'sawtooth', 0.06);
  _beep(120, 0.4, 'sine', 0.04);
}

// Achievement unlock — bright ascending arpeggio
export function sfxAchievement() {
  _beep(523, 0.12, 'sine', 0.08);
  setTimeout(() => _beep(659, 0.12, 'sine', 0.08), 80);
  setTimeout(() => _beep(784, 0.12, 'sine', 0.08), 160);
  setTimeout(() => _beep(1047, 0.2, 'sine', 0.1), 240);
}

// Card played (frenemy) — whoosh + impact
export function sfxCard() {
  _noise(0.12, 0.08);
  setTimeout(() => _beep(300, 0.15, 'triangle', 0.1), 80);
}

// Game end — slow descending tone
export function sfxGameEnd() {
  _beep(784, 0.15, 'sine', 0.08);
  setTimeout(() => _beep(659, 0.15, 'sine', 0.07), 150);
  setTimeout(() => _beep(523, 0.15, 'sine', 0.06), 300);
  setTimeout(() => _beep(392, 0.4, 'sine', 0.06), 450);
}

// Reunion — warm chime
export function sfxReunion() {
  _beep(659, 0.2, 'sine', 0.08);
  setTimeout(() => _beep(784, 0.2, 'sine', 0.07), 100);
  setTimeout(() => _beep(1047, 0.3, 'sine', 0.06), 200);
}

// Toggle sound — feedback blip
export function sfxToggle() {
  // Always plays (bypass mute) so user hears confirmation of unmute
  const wasMuted = _muted;
  _muted = false;
  _beep(wasMuted ? 880 : 440, 0.08, 'sine', 0.1);
  _muted = wasMuted;
}
