// ── BGM System ───────────────────────────────────────────────────────────────
// Reactive background music engine.
//
// Usage:
//   BGM.init()                — call once on first user interaction
//   BGM.setMuted(bool)        — sync with SFX mute toggle
//   BGM.sync(state)           — call at the end of render(); reactively picks track
//   BGM.duck()/unduck()       — call when pendingChoice appears / resolves
//   BGM.fadeOutForCinematic() — call before storyline intro/exit cinematic
//   BGM.resumeAfterCinematic()— call after cinematic onDone
//
// Track files live in assets/bgm/. If a file is missing (404 or decode error),
// BGM silently skips it — the game still runs, just without music. This makes
// it safe to ship the engine before all music is produced.

const BGM_BASE = 'assets/bgm/';
const FADE_MS = 600;        // default crossfade duration
const DUCK_VOL = 0.35;      // volume when ducked (choice visible)
const DUCK_FREQ = 900;      // lowpass freq when ducked (Hz)
const NORMAL_VOL = 0.55;    // base BGM volume (relative to ctx)

// ── Track catalogue ──────────────────────────────────────────────────────────
// id → filename (under assets/bgm/)
const TRACKS = {
  title:           'title.mp3',
  daily:           'daily.mp3',
  summary:         'summary.mp3',
  special_bright:  'special_bright.mp3',
  special_hustle:  'special_hustle.mp3',
  special_neon:    'special_neon.mp3',
  special_party:   'special_party.mp3',
  hidden_spy:      'hidden_spy.mp3',
  hidden_xianxia:  'hidden_xianxia.mp3',
  hidden_hogwarts: 'hidden_hogwarts.mp3',
};

// storyline id → track id
const STORYLINE_TRACK = {
  // bright
  idol: 'special_bright', superstar: 'special_bright', streamer: 'special_bright',
  influencer: 'special_bright', mcn: 'special_bright', band: 'special_bright',
  partners: 'special_bright',  // multiplayer co-op
  // hustle
  fitness: 'special_hustle', chef: 'special_hustle', athlete: 'special_hustle',
  academic: 'special_hustle', ceo: 'special_hustle',
  // neon
  esports: 'special_neon', worlds: 'special_neon', minor_league: 'special_neon',
  poker: 'special_neon', triton: 'special_neon', local_shark: 'special_neon',
  cheater: 'special_neon',
  // party
  party: 'special_party', wasted: 'special_party',
  // hidden — spy / thief family (dark thriller vibe)
  spy: 'hidden_spy', abyss: 'hidden_spy', meta: 'hidden_spy', timeloop: 'hidden_spy',
  thief: 'hidden_spy',
  // hidden — xianxia (solo, ancient cultivation vibe)
  xianxia: 'hidden_xianxia',
  // hidden — magic
  hogwarts: 'hidden_hogwarts',
};

// ── State ────────────────────────────────────────────────────────────────────
let _ctx = null;
let _muted = false;
let _initialized = false;
let _currentTrackId = null;       // what's playing now
let _currentSrc = null;           // BufferSource
let _currentGain = null;          // GainNode for current track
let _currentFilter = null;        // BiquadFilter for ducking
let _ducked = false;
let _suppressedForCinematic = false;
const _buffers = {};              // filename → AudioBuffer | 'failed'
const _loading = {};              // filename → Promise<AudioBuffer|null>

// ── Context helpers ──────────────────────────────────────────────────────────
function _ensureCtx() {
  if (!_ctx) {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

async function _loadBuffer(filename) {
  if (_buffers[filename] === 'failed') return null;
  if (_buffers[filename]) return _buffers[filename];
  if (_loading[filename]) return _loading[filename];
  const p = (async () => {
    try {
      const resp = await fetch(BGM_BASE + filename);
      if (!resp.ok) { _buffers[filename] = 'failed'; return null; }
      const arr = await resp.arrayBuffer();
      const ctx = _ensureCtx();
      const buf = await ctx.decodeAudioData(arr);
      _buffers[filename] = buf;
      return buf;
    } catch (e) {
      _buffers[filename] = 'failed';
      return null;
    }
  })();
  _loading[filename] = p;
  return p;
}

// ── Mute persistence (shared key with SFX) ───────────────────────────────────
export function isMuted() { return _muted; }
export function setMuted(val) {
  _muted = val;
  if (_currentGain) {
    // Hard mute / unmute — no fade, matches SFX behavior
    try {
      const ctx = _ensureCtx();
      _currentGain.gain.setValueAtTime(val ? 0 : (_ducked ? DUCK_VOL : NORMAL_VOL), ctx.currentTime);
    } catch (e) {}
  }
}

export function init() {
  if (_initialized) return;
  _initialized = true;
  try {
    const v = localStorage.getItem('sasr_muted');
    if (v === '1') _muted = true;
  } catch (e) {}
  _ensureCtx();
  // Autoplay policy: if ctx starts suspended, retry sync on first user gesture.
  if (_ctx && _ctx.state !== 'running') {
    const _flushPending = () => {
      if (!_pendingTrackOnResume) return;
      const t = _pendingTrackOnResume;
      _pendingTrackOnResume = null;
      _switchTo(t, FADE_MS);
    };
    // Listen for ctx running — fires when resume() resolves
    _ctx.addEventListener('statechange', () => {
      if (_ctx.state === 'running') _flushPending();
    });
    const _kick = async () => {
      try { await _ctx.resume(); } catch (e) {}
      if (_ctx.state === 'running') _flushPending();
      window.removeEventListener('click', _kick, true);
      window.removeEventListener('keydown', _kick, true);
      window.removeEventListener('touchstart', _kick, true);
      window.removeEventListener('pointerdown', _kick, true);
    };
    window.addEventListener('click', _kick, true);
    window.addEventListener('keydown', _kick, true);
    window.addEventListener('touchstart', _kick, true);
    window.addEventListener('pointerdown', _kick, true);
  }
}

let _pendingTrackOnResume = null;

// ── Track switching ──────────────────────────────────────────────────────────
function _stopCurrent(fadeMs = FADE_MS) {
  if (!_currentSrc || !_currentGain) {
    _currentSrc = _currentGain = _currentFilter = null;
    _currentTrackId = null;
    return;
  }
  try {
    const ctx = _ensureCtx();
    const now = ctx.currentTime;
    const src = _currentSrc;
    const gain = _currentGain;
    const cur = gain.gain.value;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(cur, now);
    gain.gain.linearRampToValueAtTime(0.0001, now + fadeMs / 1000);
    src.stop(now + fadeMs / 1000 + 0.05);
  } catch (e) {}
  _currentSrc = _currentGain = _currentFilter = null;
  _currentTrackId = null;
}

async function _playTrack(trackId, fadeMs = FADE_MS) {
  const filename = TRACKS[trackId];
  if (!filename) return;
  const buf = await _loadBuffer(filename);
  if (!buf) return; // file missing — silently bail
  // If during the await someone else switched, bail.
  if (_currentTrackId !== null && _currentTrackId !== trackId) {
    // we got beaten by another switch — but if we're the latest target, continue;
    // simple heuristic: only continue if no track currently active.
    if (_currentSrc) return;
  }
  try {
    const ctx = _ensureCtx();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = _ducked ? DUCK_FREQ : 22000;
    const gain = ctx.createGain();
    const targetVol = _muted ? 0 : (_ducked ? DUCK_VOL : NORMAL_VOL);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(targetVol, now + fadeMs / 1000);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    _currentSrc = src;
    _currentGain = gain;
    _currentFilter = filter;
    _currentTrackId = trackId;
  } catch (e) {}
}

function _switchTo(trackId, fadeMs = FADE_MS) {
  // Cinematic owns BGM transitions entirely — ignore sync() calls during it.
  // Do NOT touch _currentTrackId here, or resumeAfterCinematic will think
  // we're already on the target track and skip the actual playback.
  if (_suppressedForCinematic) return;
  if (_currentTrackId === trackId) return;
  _stopCurrent(fadeMs);
  // small delay so old track has begun its fade-out before new one starts
  setTimeout(() => {
    if (_suppressedForCinematic) return;
    _playTrack(trackId, fadeMs);
  }, 30);
  _currentTrackId = trackId;
}

// ── Pick track from state ────────────────────────────────────────────────────
function _pickTrack(state) {
  if (!state) return null;
  if (state.phase === 'ended') return 'summary';
  if (state.phase !== 'game') return 'title';
  const sl = state.storyline;
  if (sl && STORYLINE_TRACK[sl]) return STORYLINE_TRACK[sl];
  return 'daily';
}

// ── Public API ───────────────────────────────────────────────────────────────
export function sync(state) {
  if (!_initialized) return;
  const target = _pickTrack(state);
  if (!target) return;
  // If AudioContext can't run yet (no user gesture), remember target and bail.
  if (_ctx && _ctx.state !== 'running') {
    _pendingTrackOnResume = target;
    return;
  }
  if (target !== _currentTrackId) _switchTo(target);
}

export function duck() {
  if (_ducked) return;
  _ducked = true;
  if (!_currentGain || _muted) return;
  try {
    const ctx = _ensureCtx();
    const now = ctx.currentTime;
    _currentGain.gain.cancelScheduledValues(now);
    _currentGain.gain.setValueAtTime(_currentGain.gain.value, now);
    _currentGain.gain.linearRampToValueAtTime(DUCK_VOL, now + 0.3);
    if (_currentFilter) {
      _currentFilter.frequency.cancelScheduledValues(now);
      _currentFilter.frequency.setValueAtTime(_currentFilter.frequency.value, now);
      _currentFilter.frequency.linearRampToValueAtTime(DUCK_FREQ, now + 0.3);
    }
  } catch (e) {}
}

export function unduck() {
  if (!_ducked) return;
  _ducked = false;
  if (!_currentGain || _muted) return;
  try {
    const ctx = _ensureCtx();
    const now = ctx.currentTime;
    _currentGain.gain.cancelScheduledValues(now);
    _currentGain.gain.setValueAtTime(_currentGain.gain.value, now);
    _currentGain.gain.linearRampToValueAtTime(NORMAL_VOL, now + 0.3);
    if (_currentFilter) {
      _currentFilter.frequency.cancelScheduledValues(now);
      _currentFilter.frequency.setValueAtTime(_currentFilter.frequency.value, now);
      _currentFilter.frequency.linearRampToValueAtTime(22000, now + 0.3);
    }
  } catch (e) {}
}

export function fadeOutForCinematic(ms = 400) {
  _suppressedForCinematic = true;
  _stopCurrent(ms);
}

export function resumeAfterCinematic(state, ms = 500) {
  _suppressedForCinematic = false;
  const target = _pickTrack(state);
  if (target) _switchTo(target, ms);
}

// Optional: explicit "preload everything" if you want to warm up the cache.
// Not called by default — files load on demand.
export function preload(trackIds = Object.keys(TRACKS)) {
  trackIds.forEach(id => {
    const fn = TRACKS[id];
    if (fn) _loadBuffer(fn);
  });
}
