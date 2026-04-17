import { evalCondition, pickBranch } from './dsl.js';
import { renderAvatar } from './avatar.js';

const STAT_KEYS = ['SOC', 'IQ', 'MNY', 'STR', 'HEA', 'APP'];
const STAT_LABELS = {
  SOC: '社交', IQ: '智力', MNY: '家境',
  HAP: '快乐', HEA: '健康', STR: '毅力', APP: '颜值'
};
const ALLOC_TOTAL = 20;
const MAX_PER_STAT = 10;

const DEFAULT_PROF_BY_AGE = [
  { max: 18, prof: '高中生' },
  { max: 22, prof: '本科生' },
  { max: 99, prof: '毕业生' }
];

const state = {
  phase: 'talent',
  alloc: { SOC: 0, IQ: 0, MNY: 0, STR: 0, HEA: 0, APP: 0 },
  talentsPool: [],
  talentsPicked: [],
  eventsMap: new Map(),
  agesMap: {},
  firedEvents: new Set(),
  yearlyPlan: new Map(),
  log: [],
  sex: 0,
  age: 15,
  monthOfYear: 1,
  monthTotal: 1,
  school: '无',
  profession: '高中生',
  SOC: 0, IQ: 0, MNY: 0, STR: 0, HEA: 0, APP: 0,
  HAP: 5
};

async function loadData() {
  const [talents, events, ages] = await Promise.all([
    fetch('data/talents.json').then(r => r.json()),
    fetch('data/events.json').then(r => r.json()),
    fetch('data/ages.json').then(r => r.json())
  ]);
  state.eventsMap = new Map(events.map(e => [e.id, e]));
  state.agesMap = ages;
  return talents;
}

function sample(arr, n) {
  const a = arr.slice();
  const out = [];
  while (out.length < n && a.length) {
    const i = Math.floor(Math.random() * a.length);
    out.push(a.splice(i, 1)[0]);
  }
  return out;
}

function weightedTalentDraw(talents, n) {
  const weighted = [];
  for (const t of talents) {
    const w = [20, 10, 4, 1][t.grade] ?? 1;
    for (let i = 0; i < w; i++) weighted.push(t);
  }
  const chosen = [];
  const seen = new Set();
  while (chosen.length < n && weighted.length) {
    const i = Math.floor(Math.random() * weighted.length);
    const t = weighted[i];
    if (!seen.has(t.id)) { seen.add(t.id); chosen.push(t); }
    weighted.splice(i, 1);
  }
  return chosen;
}

function applyTalentEffects() {
  for (const t of state.talentsPicked) {
    if (t.effect) for (const [k, v] of Object.entries(t.effect)) {
      if (STAT_KEYS.includes(k)) state[k] += v;
    }
    if (typeof t.happyDelta === 'number') state.HAP += t.happyDelta;
  }
}

function clampStats() {
  for (const k of STAT_KEYS) state[k] = Math.max(0, Math.min(20, state[k]));
  state.HAP = Math.max(0, Math.min(10, state.HAP));
}

function syncProfessionByAge() {
  if (state.age <= 18 && state.profession === '高中生') return;
  for (const row of DEFAULT_PROF_BY_AGE) {
    if (state.age <= row.max) {
      if (state.profession === '高中生' && state.age > 18) state.profession = row.prof;
      break;
    }
  }
}

function planYear(age) {
  const pool = (state.agesMap[age]?.event ?? [])
    .map(id => state.eventsMap.get(id))
    .filter(Boolean)
    .filter(ev => !ev.noRandom)
    .filter(ev => !state.firedEvents.has(ev.id))
    .filter(ev => evalCondition(state, ev.include))
    .filter(ev => !ev.exclude || !evalCondition(state, ev.exclude));

  if (!pool.length) return;
  const count = Math.min(pool.length, 1 + Math.floor(Math.random() * 3));
  const chosen = sample(pool, count);
  const months = sample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], count).sort((a, b) => a - b);
  const plan = new Map();
  chosen.forEach((ev, i) => plan.set(months[i], ev.id));
  state.yearlyPlan.set(age, plan);
}

function applyEvent(ev) {
  state.firedEvents.add(ev.id);
  pushLog(ev.text);

  if (ev.effect) for (const [k, v] of Object.entries(ev.effect)) {
    if (STAT_KEYS.includes(k)) state[k] += v;
  }
  if (typeof ev.happyDelta === 'number') state.HAP += ev.happyDelta;
  if (ev.set) {
    if (ev.set.school) state.school = ev.set.school;
    if (ev.set.profession) state.profession = ev.set.profession;
  }

  clampStats();

  if (ev.branch) {
    const nextId = pickBranch(state, ev.branch);
    if (nextId) {
      const next = state.eventsMap.get(nextId);
      if (next) applyEvent(next);
    }
  }
}

function pushLog(text) {
  const tag = `${state.age}岁${state.monthOfYear}月`;
  state.log.unshift({ tag, text });
  if (state.log.length > 200) state.log.pop();
}

function advanceMonth() {
  state.monthTotal += 1;
  state.monthOfYear += 1;
  if (state.monthOfYear > 12) {
    state.monthOfYear = 1;
    state.age += 1;
    syncProfessionByAge();
  }

  if (state.monthOfYear === 1) planYear(state.age);

  const plan = state.yearlyPlan.get(state.age);
  if (plan && plan.has(state.monthOfYear)) {
    const id = plan.get(state.monthOfYear);
    plan.delete(state.monthOfYear);
    const ev = state.eventsMap.get(id);
    const ok = ev && evalCondition(state, ev.include) && (!ev.exclude || !evalCondition(state, ev.exclude));
    if (ok) applyEvent(ev);
    else pushLog('……');
  } else {
    pushLog(seasonalFlavor());
  }

  if (state.HEA <= 0) {
    pushLog('你的身体垮了，休学回国。');
    state.phase = 'ended';
  }
  if (state.age >= 26) {
    pushLog('你的留学人生告一段落。');
    state.phase = 'ended';
  }

  render();
}

function seasonalFlavor() {
  const m = state.monthOfYear;
  if (m <= 2) return '冬日寒假，窝在家刷剧。';
  if (m <= 4) return '春季学期照常推进。';
  if (m <= 6) return '期末周逼近。';
  if (m <= 8) return '暑假，一边实习一边焦虑。';
  if (m <= 10) return '秋季学期，新的课表。';
  return '年关将至，准备冲刺下学期。';
}

function $(id) { return document.getElementById(id); }

function renderTalentSelect(talents) {
  const pool = weightedTalentDraw(talents, 10);
  state.talentsPool = pool;
  const list = $('talent-list');
  list.innerHTML = '';
  pool.forEach(t => {
    const el = document.createElement('div');
    el.className = 'talent-card grade-' + t.grade;
    el.innerHTML = `<div class="t-name">${t.name}</div><div class="t-desc">${t.description}</div>`;
    el.addEventListener('click', () => {
      const idx = state.talentsPicked.findIndex(x => x.id === t.id);
      if (idx >= 0) { state.talentsPicked.splice(idx, 1); el.classList.remove('picked'); }
      else if (state.talentsPicked.length < 3) { state.talentsPicked.push(t); el.classList.add('picked'); }
      $('talent-confirm').disabled = state.talentsPicked.length !== 3;
    });
    list.appendChild(el);
  });
}

function renderAlloc() {
  const remaining = ALLOC_TOTAL - Object.values(state.alloc).reduce((a, b) => a + b, 0);
  $('alloc-remaining').textContent = remaining;
  for (const k of STAT_KEYS) {
    $(`alloc-${k}`).textContent = state.alloc[k];
  }
  $('alloc-start').disabled = remaining !== 0;
}

function render() {
  if (state.phase === 'game' || state.phase === 'ended') {
    renderAvatar($('avatar-canvas'), state);

    const statsEl = $('stats-panel');
    statsEl.innerHTML = '';
    const shown = ['SOC', 'IQ', 'MNY', 'HAP', 'HEA', 'STR', 'APP'];
    for (const k of shown) {
      const row = document.createElement('div');
      row.className = 'stat-row';
      const label = STAT_LABELS[k];
      const val = state[k];
      const max = k === 'HAP' ? 10 : 20;
      const pct = Math.max(0, Math.min(100, (val / max) * 100));
      row.innerHTML = `
        <span class="stat-label">${label}</span>
        <span class="stat-bar"><span class="stat-fill" style="width:${pct}%"></span></span>
        <span class="stat-val">${val}</span>
      `;
      statsEl.appendChild(row);
    }

    $('time-display').textContent = `${state.age}岁${state.monthOfYear}个月`;

    const logEl = $('event-log');
    logEl.innerHTML = '';
    for (const entry of state.log.slice(0, 60)) {
      const div = document.createElement('div');
      div.className = 'log-entry';
      div.innerHTML = `<span class="log-tag">${entry.tag}</span><span class="log-text">${entry.text}</span>`;
      logEl.appendChild(div);
    }

    $('btn-next').disabled = state.phase === 'ended';
    $('btn-next').textContent = state.phase === 'ended' ? '人生结束' : '下一月';
  }
}

function initGame() {
  for (const k of STAT_KEYS) state[k] = state.alloc[k];
  state.HAP = 5;
  applyTalentEffects();
  clampStats();
  state.phase = 'game';
  state.age = 15;
  state.monthOfYear = 1;
  syncProfessionByAge();
  planYear(15);

  pushLog('你选择了留学这条路，故事从15岁开始。');
  const plan = state.yearlyPlan.get(15);
  if (plan && plan.has(1)) {
    const ev = state.eventsMap.get(plan.get(1));
    plan.delete(1);
    if (ev) applyEvent(ev);
  }

  showScreen('game-screen');
  render();
}

function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.remove('active');
  $(id).classList.add('active');
}

async function main() {
  const talents = await loadData();

  $('sex-male').addEventListener('click', () => { state.sex = 0; $('sex-male').classList.add('active'); $('sex-female').classList.remove('active'); });
  $('sex-female').addEventListener('click', () => { state.sex = 1; $('sex-female').classList.add('active'); $('sex-male').classList.remove('active'); });

  $('talent-confirm').addEventListener('click', () => {
    showScreen('alloc-screen');
    renderAlloc();
  });

  for (const k of STAT_KEYS) {
    $(`plus-${k}`).addEventListener('click', () => {
      const used = Object.values(state.alloc).reduce((a, b) => a + b, 0);
      if (used < ALLOC_TOTAL && state.alloc[k] < MAX_PER_STAT) {
        state.alloc[k] += 1;
        renderAlloc();
      }
    });
    $(`minus-${k}`).addEventListener('click', () => {
      if (state.alloc[k] > 0) { state.alloc[k] -= 1; renderAlloc(); }
    });
  }

  $('alloc-start').addEventListener('click', initGame);

  $('btn-next').addEventListener('click', () => {
    if (state.phase !== 'ended') advanceMonth();
  });

  $('btn-restart').addEventListener('click', () => location.reload());

  renderTalentSelect(talents);
  showScreen('talent-screen');
}

main();
