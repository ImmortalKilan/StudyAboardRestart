import { evalCondition, pickBranch, pickWeightedBranch } from './dsl.js';
import { renderAvatar } from './avatar.js';

const STAT_KEYS = ['SOC', 'INT', 'MNY', 'PER', 'HLT', 'APP'];
const STAT_LABELS = {
  SOC: '社交', INT: '智力', MNY: '家境',
  HAP: '快乐', HLT: '健康', PER: '毅力', APP: '颜值'
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
  alloc: { SOC: 0, INT: 0, MNY: 0, PER: 0, HLT: 0, APP: 0 },
  talentsPool: [],
  talentsPicked: [],
  eventsMap: new Map(),
  agesMap: {},
  firedEvents: new Set(),
  randomEvents: [],
  yearlyPlan: new Map(),
  log: [],
  logRenderedCount: 0,
  sex: 0,
  age: 15,
  monthOfYear: 1,
  monthTotal: 1,
  school: '无',
  hsType: '',
  profession: '高中生',
  SOC: 0, INT: 0, MNY: 0, PER: 0, HLT: 0, APP: 0,
  HAP: 5
};

let autoTimer = null;
let autoMode = 0;

async function loadData() {
  const [talents, events, ages, randomEvents] = await Promise.all([
    fetch('data/talents.json').then(r => r.json()),
    fetch('data/events.json').then(r => r.json()),
    fetch('data/ages.json').then(r => r.json()),
    fetch('data/random_events.json').then(r => r.json())
  ]);
  state.eventsMap = new Map(events.map(e => [e.id, e]));
  state.agesMap = ages;
  state.randomEvents = randomEvents;
  // Also index random events into eventsMap for branch lookups
  for (const re of randomEvents) state.eventsMap.set(re.id, re);
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
  state.HAP = Math.min(10, state.HAP);
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
  pushLog(ev.text || ev.event);

  if (ev.effect) for (const [k, v] of Object.entries(ev.effect)) {
    if (STAT_KEYS.includes(k)) state[k] += v;
  }
  if (typeof ev.happyDelta === 'number') state.HAP += ev.happyDelta;
  if (ev.set) {
    for (const [k, v] of Object.entries(ev.set)) state[k] = v;
  }

  clampStats();

  if (ev.branch) {
    // Detect weighted branch format ("id:weight") vs conditional ("cond?id")
    const isWeighted = ev.branch.some(b => /^\d+:\d+$/.test(b));
    const nextId = isWeighted ? pickWeightedBranch(ev.branch) : pickBranch(state, ev.branch);
    if (nextId) {
      const next = state.eventsMap.get(nextId);
      if (next) applyEvent(next);
    }
  }
}

function pushLog(text) {
  const tag = `${state.age}岁${state.monthOfYear}月`;
  state.log.push({ tag, text });
  if (state.log.length > 200) {
    state.log.shift();
    state.logRenderedCount = Math.max(0, state.logRenderedCount - 1);
  }
}

function drawRandomEvent() {
  const pool = state.randomEvents
    .filter(ev => !state.firedEvents.has(ev.id))
    .filter(ev => !ev.include || evalCondition(state, ev.include))
    .filter(ev => !ev.exclude || !evalCondition(state, ev.exclude));
  if (!pool.length) return null;
  const weights = pool.map(ev => ev.weight ?? 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
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
    const re = Math.random() < 0.4 ? drawRandomEvent() : null;
    if (re) applyEvent(re);
    else pushLog(seasonalFlavor());
  }

  if (state.HLT <= 0) {
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
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const m = state.monthOfYear;
  if (m <= 2) return pick([
    '冬日寒假，窝在家刷剧。',
    '放假第一天就开始熬夜，生物钟彻底崩了。',
    '被亲戚问「成绩怎么样」，笑而不语。',
    '寒假余额不足，作业还没动。',
    '窝在被子里刷手机，假期真是太快乐了。',
    '在家每天睡到中午，感觉自己在坐牢。',
  ]);
  if (m <= 4) return pick([
    '春季学期照常推进。',
    '樱花开了，朋友圈全是打卡照。',
    '新学期选了一门传说中的「水课」。',
    '图书馆占座战争又开始了。',
    '春困袭来，上课频频走神。',
    '开学综合征还没好，作业已经堆成山。',
  ]);
  if (m <= 6) return pick([
    '期末周逼近，图书馆一座难求。',
    'DDL战士上线，咖啡续命中。',
    '通宵复习，眼前的字已经开始跳舞。',
    '考完一门感觉血槽已空，然而还有三门。',
    '互相传阅「往年真题」，玄学押题环节。',
    '期末复习群里有人发了锦鲤，疯狂转发。',
  ]);
  if (m <= 8) return pick([
    '暑假，一边实习一边焦虑。',
    '暑假打工攒钱，累但充实。',
    '夏天太热，只想待在空调房不出门。',
    '暑假过半才想起还有暑期作业。',
    '朋友都在旅行，而你在搬砖。',
    '收到下学期的课表，沉默了。',
  ]);
  if (m <= 10) return pick([
    '秋季学期，新的课表。',
    '开学第一周就想退学（不是）。',
    '秋风起，食堂上了新菜。',
    '社团招新，传单塞了一书包。',
    '换季降温，感冒了一整周。',
    '国庆长假之后，上课如上坟。',
  ]);
  return pick([
    '年关将至，准备冲刺下学期。',
    '双十一的快递终于到齐了。',
    '天冷了，早起变成一种酷刑。',
    '期末将至，又到了「学一学期不如学一晚上」的季节。',
    '下雪了，校园里多了很多雪人。',
    '年底总结：今年又白过了。',
  ]);
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
    const shown = ['SOC', 'INT', 'MNY', 'HAP', 'HLT', 'PER', 'APP'];
    const dynamicMax = Math.max(1, ...shown.filter(k => k !== 'HAP').map(k => state[k]));
    for (const k of shown) {
      const row = document.createElement('div');
      row.className = 'stat-row';
      const label = STAT_LABELS[k];
      const val = state[k];
      const base = k === 'HAP' ? 10 : dynamicMax;
      const pct = Math.max(0, Math.min(100, (val / base) * 100));
      row.innerHTML = `
        <span class="stat-label">${label}</span>
        <span class="stat-bar"><span class="stat-fill" style="width:${pct}%"></span></span>
        <span class="stat-val">${val}</span>
      `;
      statsEl.appendChild(row);
    }

    $('time-display').textContent = `${state.age}岁${state.monthOfYear}个月`;

    const logEl = $('event-log');
    if (state.logRenderedCount > state.log.length) {
      state.logRenderedCount = 0;
      logEl.innerHTML = '';
    }
    for (let i = state.logRenderedCount; i < state.log.length; i++) {
      const entry = state.log[i];
      const div = document.createElement('div');
      div.className = 'log-entry';
      div.innerHTML = `<span class="log-tag">${entry.tag}</span><span class="log-text">${entry.text}</span>`;
      logEl.appendChild(div);
    }
    state.logRenderedCount = state.log.length;
    while (logEl.children.length > 60) {
      logEl.removeChild(logEl.firstElementChild);
    }
    logEl.scrollTop = logEl.scrollHeight;
  }

  updateAutoButtons();
}

function updateAutoButtons() {
  const b1 = $('btn-auto-1x');
  const b2 = $('btn-auto-2x');
  if (!b1 || !b2) return;

  b1.classList.toggle('active', autoMode === 1);
  b2.classList.toggle('active', autoMode === 2);

  const ended = state.phase === 'ended';
  b1.disabled = ended;
  b2.disabled = ended;
}

function stopAuto() {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
  }
  autoMode = 0;
  updateAutoButtons();
}

function startAuto(mode) {
  if (state.phase === 'ended') return;
  if (autoMode === mode) {
    stopAuto();
    return;
  }

  stopAuto();
  autoMode = mode;
  const ms = mode === 2 ? 500 : 1000;
  autoTimer = setInterval(() => {
    if (state.phase === 'ended') {
      stopAuto();
      return;
    }
    advanceMonth();
  }, ms);
  updateAutoButtons();
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
  document.body.classList.toggle('in-game', id === 'game-screen');
  if (id !== 'game-screen') stopAuto();
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

  $('btn-auto-1x').addEventListener('click', () => {
    startAuto(1);
  });

  $('btn-auto-2x').addEventListener('click', () => {
    startAuto(2);
  });

  document.querySelector('.right-panel').addEventListener('click', (e) => {
    if (state.phase === 'ended') return;
    if (e.target.closest('button')) return;
    advanceMonth();
  });

  $('btn-restart').addEventListener('click', () => location.reload());

  renderTalentSelect(talents);
  showScreen('talent-screen');
}

main();
