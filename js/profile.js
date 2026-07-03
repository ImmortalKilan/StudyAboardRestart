// ── Profile & Data Transfer ──────────────────────────────────────
// Manages player profile (nickname, UUID, stats display) and
// cross-device data import/export (JSON file + base64 text string).

import { onDataImported } from './memory.js';

const PROFILE_KEY = 'sasr_profile_v1';

const ALL_DATA_KEYS = [
  'sasr_profile_v1',
  'studyAbroad_ach_v1',
  'sasr_endings_v1',
  'sasr_memory_v1',
  'sasr_relics_v1',
  'sasr_redeemed_v1',
  'sasr_total_plays',
  'sasr_total_runs',
  'sasr_tutorial_seen',
  'sasr_guide_done',
  'sasr_first_card_guide',
  'sasr_share_bonus',
  'sasr_timeloop_trapped',
  'sasr_muted',
  'sasr_moments_eggs_v1',
  'studyAbroad_fc_v1',
  'studyAbroad_presets_v1',
  'pwa_guide_dismissed',
];

function _uuid() {
  return 'xxxx-xxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveProfile(p) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {}
}

function ensureProfile() {
  let p = loadProfile();
  if (!p) {
    p = { id: _uuid(), nickname: '', createdAt: Date.now() };
    saveProfile(p);
  }
  return p;
}

function setNickname(name) {
  const p = ensureProfile();
  p.nickname = (name || '').trim().slice(0, 16);
  saveProfile(p);
  return p;
}

// ── Stats helpers ──

function getTotalPlays() {
  return parseInt(localStorage.getItem('sasr_total_plays') || '0', 10) || 0;
}

function getAchievementCount() {
  try {
    const raw = localStorage.getItem('studyAbroad_ach_v1');
    if (raw) return JSON.parse(raw).length;
  } catch {}
  return 0;
}

function getEndingCount() {
  try {
    const raw = localStorage.getItem('sasr_endings_v1');
    if (raw) return Object.keys(JSON.parse(raw)).length;
  } catch {}
  return 0;
}

// ── Export ──

function _gatherData() {
  const bundle = { _ver: 1, _ts: Date.now() };
  for (const key of ALL_DATA_KEYS) {
    const val = localStorage.getItem(key);
    if (val !== null) bundle[key] = val;
  }
  return bundle;
}

function exportAsJSON() {
  const data = _gatherData();
  const profile = ensureProfile();
  const name = profile.nickname || '留学重开';
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}_存档_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

function exportAsText() {
  const json = JSON.stringify(_gatherData());
  try {
    return btoa(unescape(encodeURIComponent(json)));
  } catch {
    return btoa(json);
  }
}

// ── Import ──

function _applyBundle(bundle) {
  if (!bundle || typeof bundle !== 'object' || !bundle._ver) {
    throw new Error('无效的存档数据');
  }
  for (const key of ALL_DATA_KEYS) {
    if (key in bundle) {
      try { localStorage.setItem(key, bundle[key]); } catch {}
    } else {
      try { localStorage.removeItem(key); } catch {}
    }
  }
  onDataImported();
}

function importFromJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const bundle = JSON.parse(reader.result);
        _applyBundle(bundle);
        resolve(bundle);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

function importFromText(str) {
  try {
    const json = decodeURIComponent(escape(atob(str.trim())));
    const bundle = JSON.parse(json);
    _applyBundle(bundle);
    return bundle;
  } catch {
    try {
      const bundle = JSON.parse(atob(str.trim()));
      _applyBundle(bundle);
      return bundle;
    } catch {
      throw new Error('无效的转移码');
    }
  }
}

// ── Modal UI ──

let _modalEl = null;

function _getModal() {
  if (_modalEl) return _modalEl;
  _modalEl = document.getElementById('profile-modal');
  if (!_modalEl) return null;

  const close = () => _modalEl.classList.remove('open');
  _modalEl.querySelector('.pf-backdrop').addEventListener('click', close);
  _modalEl.querySelector('.pf-close').addEventListener('click', close);

  // nickname edit
  const nickInput = _modalEl.querySelector('#pf-nick-input');
  const nickSave = _modalEl.querySelector('#pf-nick-save');
  nickSave.addEventListener('click', () => {
    setNickname(nickInput.value);
    _refreshModal();
    nickSave.textContent = '已保存';
    setTimeout(() => { nickSave.textContent = '保存'; }, 1200);
  });
  nickInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') nickSave.click();
  });

  // export JSON
  _modalEl.querySelector('#pf-export-json').addEventListener('click', () => {
    exportAsJSON();
  });

  // export text
  _modalEl.querySelector('#pf-export-text').addEventListener('click', () => {
    const code = exportAsText();
    const ta = _modalEl.querySelector('#pf-text-area');
    ta.value = code;
    ta.parentElement.style.display = 'block';
    ta.select();
    try { navigator.clipboard.writeText(code); } catch {}
    const btn = _modalEl.querySelector('#pf-export-text');
    btn.textContent = '已复制到剪贴板';
    setTimeout(() => { btn.textContent = '生成转移码'; }, 2000);
  });

  // import JSON
  const fileInput = _modalEl.querySelector('#pf-import-file');
  _modalEl.querySelector('#pf-import-json').addEventListener('click', () => {
    fileInput.click();
  });
  fileInput.addEventListener('change', async () => {
    if (!fileInput.files.length) return;
    try {
      await importFromJSON(fileInput.files[0]);
      _showImportSuccess();
    } catch (e) {
      alert('导入失败: ' + e.message);
    }
    fileInput.value = '';
  });

  // import text
  _modalEl.querySelector('#pf-import-text-btn').addEventListener('click', () => {
    const area = _modalEl.querySelector('#pf-import-text-area');
    const wrap = area.parentElement;
    if (wrap.style.display === 'block') {
      // submit
      const val = area.value.trim();
      if (!val) return;
      try {
        importFromText(val);
        _showImportSuccess();
      } catch (e) {
        alert('导入失败: ' + e.message);
      }
    } else {
      wrap.style.display = 'block';
      area.value = '';
      area.focus();
    }
  });

  return _modalEl;
}

function _showImportSuccess() {
  const msg = document.createElement('div');
  msg.className = 'pf-import-toast';
  msg.textContent = '导入成功！即将刷新页面...';
  document.body.appendChild(msg);
  setTimeout(() => location.reload(), 1500);
}

function _refreshModal() {
  const modal = _getModal();
  if (!modal) return;
  const profile = ensureProfile();
  const nickInput = modal.querySelector('#pf-nick-input');
  nickInput.value = profile.nickname || '';
  nickInput.placeholder = '给自己起个名字';

  modal.querySelector('#pf-stat-plays').textContent = getTotalPlays();
  modal.querySelector('#pf-stat-ach').textContent = getAchievementCount();
  modal.querySelector('#pf-stat-endings').textContent = getEndingCount();
  modal.querySelector('#pf-uid').textContent = 'UID: ' + profile.id;

  // reset text areas
  const exportArea = modal.querySelector('#pf-text-area');
  if (exportArea) exportArea.parentElement.style.display = 'none';
  const importArea = modal.querySelector('#pf-import-text-area');
  if (importArea) importArea.parentElement.style.display = 'none';
}

export function openProfileModal() {
  const modal = _getModal();
  if (!modal) return;
  _refreshModal();
  modal.classList.add('open');
}

export function initProfile() {
  ensureProfile();
  const btn = document.getElementById('profile-btn');
  if (btn) btn.addEventListener('click', openProfileModal);
}
