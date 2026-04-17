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
  { max: 25, prof: '打工人' },
  { max: 35, prof: '社畜' },
  { max: 55, prof: '中年人' },
  { max: 99, prof: '退休' }
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
  overseas: 0,
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

  if (ev.end) {
    state.phase = 'ended';
  }

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
    .filter(ev => !ev.noRandom)
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

  if (state.HLT <= -5) {
    pushLog('你的身体彻底垮了，人生到此为止。');
    state.phase = 'ended';
  }
  if (state.age >= 60) {
    pushLog('你退休了。回首这一生，百感交集。');
    state.phase = 'ended';
  }

  render();
}

function seasonalFlavor() {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const m = state.monthOfYear;
  const age = state.age;

  // 学生时代 (15-25)
  if (age <= 25) {
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

  // 打工时代 (26-39)
  if (age <= 39) {
    if (m <= 2) return pick([
      '春节假期，抢票大战又开始了。',
      '年终奖到账了——看了一眼，沉默了。',
      '过年回家被催婚，你假装没听到。',
      '在老家躺了七天，感觉电量充满了。',
      '同学群里有人晒娃了，你默默退出群聊。',
    ]);
    if (m <= 4) return pick([
      '新的一年，新的KPI。',
      '春天来了，周末去公园野餐。',
      '跳槽季到了，你忍不住打开了招聘网站。',
      '开始健身了，办了张年卡。',
      '和同事团建，尬聊了一整天。',
    ]);
    if (m <= 6) return pick([
      '年中述职，PPT写到凌晨。',
      '618大促，购物车清空了一半。',
      '天气太热，通勤就是一种折磨。',
      '项目DDL逼近，连续加班两周。',
      '收到猎头的消息，心动了一下。',
    ]);
    if (m <= 8) return pick([
      '请了年假出去旅行，回来发现邮件爆了。',
      '夏天太热，只想在家吹空调。',
      '周末约朋友聚了一次，聊的全是工作和房价。',
      '体检报告出来了，有几项指标不太好。',
      '暑假？上班族没有暑假，只有更热的通勤。',
    ]);
    if (m <= 10) return pick([
      '秋风起，想起了学生时代。',
      '国庆长假，出门全是人，在家全是剧。',
      '金九银十跳槽季，你在犹豫。',
      '降温了，翻出去年的外套发现扣子掉了。',
      '新来了个实习生，你看着他想起了自己当年。',
    ]);
    return pick([
      '年底了，绩效考核又来了。',
      '双十一剁完手，看看余额，痛。',
      '天冷了，早上起床全靠意志力。',
      '年底总结：又忙了一年，也不知道忙了什么。',
      '公司年会抽奖，你一如既往地什么都没中。',
    ]);
  }

  // 中年时代 (40-59)
  if (m <= 2) return pick([
    '过年了，孩子们都回来了。',
    '年终体检，医生说要注意血压。',
    '春节在家包饺子，和小时候一样。',
    '被亲戚问「你家孩子成绩怎么样」，轮到你了。',
    '窝在沙发上看春晚，不知不觉睡着了。',
  ]);
  if (m <= 4) return pick([
    '春天了，在小区里散步。',
    '体检报告越来越长，心态越来越稳。',
    '开始研究养生茶了，枸杞泡起来。',
    '老同学聚会，大家都胖了一圈。',
    '换了一双舒服的鞋，不追求好看了。',
  ]);
  if (m <= 6) return pick([
    '单位体制改革，你有点不安。',
    '夏天到了，游泳成了唯一的运动。',
    '孩子期末考试，你比他还紧张。',
    '老家来电话了，父母身体还好。',
    '下班后去公园走了一万步，感觉还行。',
  ]);
  if (m <= 8) return pick([
    '带家人出去旅游了一趟，累但开心。',
    '夏天太热，血压有点高。',
    '同龄人有人升职了，你心态平和。',
    '开始听播客了，通勤时间不那么无聊了。',
    '暑假给孩子报了兴趣班，钱包在滴血。',
  ]);
  if (m <= 10) return pick([
    '秋天了，身体恢复得比夏天好一些。',
    '朋友圈全是旅游照，你在加班。',
    '开始计划退休后的生活了。',
    '给父母打了个电话，聊了半小时。',
    '在公司已经是老员工了，新人都叫你哥/姐。',
  ]);
  return pick([
    '又是一年年底，感叹时间过得真快。',
    '年底了，开始给晚辈准备红包。',
    '下雪了，膝盖有点不舒服。',
    '年度总结：平平淡淡才是真。',
    '翻到年轻时候的照片，恍如隔世。',
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
