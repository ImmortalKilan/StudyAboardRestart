import { evalCondition, pickBranch, pickWeightedBranch } from './dsl.js';
import { renderAvatar } from './avatar.js';

const STAT_KEYS = ['SOC', 'INT', 'MNY', 'PER', 'HLT', 'APP'];
const STAT_LABELS = {
  SOC: '社交', INT: '智力', MNY: '家境',
  HAP: '快乐', HLT: '健康', PER: '毅力', APP: '颜值',
  POP: '人气', POK: '牌技', MMR: '天梯分'
};
const EFFECT_KEYS = new Set([...STAT_KEYS, 'HAP', 'POP', 'POK', 'MMR']);
const ALLOC_TOTAL = 25;
const MAX_PER_STAT = 10;

const DEFAULT_PROF_BY_AGE = [
  { max: 18, prof: '高中生' },
  { max: 22, prof: '本科生' },
  { max: 25, prof: '打工人' },
  { max: 35, prof: '社畜' },
  { max: 55, prof: '中年人' },
  { max: 99, prof: '退休' }
];

// Storyline configurations: death checks, completion, event rate, flavor
const STORYLINE_CFG = {
  spy: {
    duration: 4,
    gracePeriod: 12,
    successEvent: 50099,
    eventRate: 0.8,
    deathChecks: [
      { cond: s => s.HLT <= -2, event: 50060 },
      { cond: s => s.PER <= -2, event: 50061 },
      { cond: s => s.SOC <= -2 && s.HAP <= -2, event: 50064 },
      { cond: s => s.INT <= -2, event: 50062 },
      { cond: s => s.SOC <= -4, event: 50063 },
      { cond: s => s.HAP <= -4 && s.INT > -2, event: 50065 },
    ],
    flavor: () => spyFlavor(),
  },
  abyss: {
    duration: 3,
    gracePeriod: 12,
    successEvent: 60040,
    eventRate: 0.8,
    deathChecks: [
      { cond: s => s.HLT <= -20, event: 60091 },
      { cond: s => s.HAP <= -8, event: 60091 },
    ],
    flavor: () => abyssFlavor(),
  },
  meta: {
    duration: 4,
    gracePeriod: 12,
    successEvent: 70040,
    eventRate: 0.75,
    deathChecks: [
      { cond: s => s.HAP <= -5, event: 70094 },
      { cond: s => s.HLT <= -5, event: 70095 }
    ],
    flavor: () => metaFlavor(),
  },
  party: {
    gracePeriod: 12,
    eventRate: 0.7,
    deathChecks: [
      { cond: s => s.INT < 0, event: 82020 },
      { cond: s => s.HLT <= -2, event: 82021 },
    ],
    progressChecks: [
      { cond: s => s.age - s.storylineStart >= 1, event: 82040 },
    ],
  },
  ceo: {
    gracePeriod: 12,
    eventRate: 0.7,
    deathChecks: [
      { cond: s => s.MNY <= -2, event: 82095 },
    ],
    progressChecks: [
      { cond: s => s.age >= 27 && s.SOC >= 20 && s.MNY >= 15, event: 82090 },
      { cond: s => s.age >= 30, event: 82096 },
    ],
  },
  poker: {
    gracePeriod: 12,
    eventRate: 0.7,
    deathChecks: [
      { cond: s => s.MNY <= -4, event: 81091 },
      { cond: s => (s.POK || 0) <= 0 && s.age - s.storylineStart >= 1, event: 81094 },
    ],
    progressChecks: [
      { cond: s => (s.POK || 0) > 20 || s.age - s.storylineStart >= 2, event: 81040 },
    ],
  },
  triton: {
    gracePeriod: 12,
    eventRate: 0.7,
    deathChecks: [
      { cond: s => s.POK < -4 || s.MNY <= -4, event: 81091 },
    ],
    progressChecks: [
      { cond: s => s.POK >= 30, event: 81090 },
    ],
  },
  local_shark: {
    gracePeriod: 12,
    eventRate: 0.7,
    deathChecks: [
      { cond: s => s.MNY <= -4, event: 81091 },
    ],
    progressChecks: [
      { cond: s => s.POK >= 20, event: 81092 },
      { cond: s => s.age >= 25, event: 81093 },
    ],
  },
  esports: {
    gracePeriod: 12,
    eventRate: 0.7,
    deathChecks: [
      { cond: s => s.HLT <= -2, event: 83091 },
    ],
    progressChecks: [
      { cond: s => s.match_fixing, event: 83092 },
      { cond: s => s.age - s.storylineStart >= 1, event: 83040 },
    ],
  },
  worlds: {
    gracePeriod: 12,
    eventRate: 0.7,
    deathChecks: [
      { cond: s => s.HLT <= -1, event: 83091 },
    ],
    progressChecks: [
      { cond: s => s.match_fixing, event: 83092 },
      { cond: s => s.MMR >= 40 && s.PER >= 10 && !s.match_fixing, event: 83090 },
      { cond: s => s.age - s.storylineStart >= 1, event: 83093 },
    ],
  },
  minor_league: {
    gracePeriod: 12,
    eventRate: 0.7,
    progressChecks: [
      { cond: s => s.match_fixing, event: 83092 },
      { cond: s => s.age - s.storylineStart >= 1, event: 83094 },
    ],
  },
  idol: {
    gracePeriod: 12,
    eventRate: 0.6,
    progressChecks: [
      { cond: s => s.age - s.storylineStart >= 3, event: 80040 },
    ],
  },
  superstar: {
    gracePeriod: 12,
    eventRate: 0.6,
    progressChecks: [
      { cond: s => s.POP >= 80, event: 80090 },
      { cond: s => s.INT < 4, event: 80091 },
      { cond: s => s.age - s.storylineStart >= 3, event: 80094 },
    ],
  },
  streamer: {
    gracePeriod: 12,
    eventRate: 0.6,
    progressChecks: [
      { cond: s => s.age - s.storylineStart >= 2 && s.POP >= 20, event: 80092 },
      { cond: s => s.age - s.storylineStart >= 2 && s.POP < 20, event: 80093 },
    ],
  },
  wasted: {
    gracePeriod: 12,
    eventRate: 0.6,
    progressChecks: [
      { cond: s => s.age - s.storylineStart >= 2 && s.HAP <= 0 && s.SOC <= 0, event: 82093 },
      { cond: s => s.age - s.storylineStart >= 3, event: 82094 },
    ],
  },
};

const STORYLINE_NAMES = {
  spy: '国际特工',
  abyss: '深渊科技',
  meta: '第四面墙',
  idol: '偶像出道',
  superstar: '超级巨星',
  streamer: '网红主播',
  poker: '地下牌局',
  triton: '赌神之路',
  local_shark: '地头蛇',
  party: '派对狂魔',
  ceo: '最强合伙人',
  wasted: '南柯一梦',
  esports: '职业电竞',
  worlds: '世界赛之路',
  minor_league: '次级联赛',
};
const HIDDEN_STORYLINES = new Set(['spy', 'abyss', 'meta']);
const SPECIAL_STORYLINES = new Set(['idol', 'superstar', 'streamer', 'poker', 'triton', 'local_shark', 'party', 'ceo', 'wasted', 'esports', 'worlds', 'minor_league']);
const STUDENT_PHASES = new Set([
  '高中生', '本科生', '理工生', '商科生', '文科生',
  '准留学生', '考研党', '迷茫大学生', '准研究生', '研究生', '海外研究生',
]);
const GRAD_SCHOOL_PHASES = new Set(['准研究生', '研究生', '海外研究生']);

const state = {
  phase: 'talent',
  alloc: { SOC: 0, INT: 0, MNY: 0, PER: 0, HLT: 0, APP: 0 },
  allocBase: { SOC: 0, INT: 0, MNY: 0, PER: 0, HLT: 0, APP: 0 },
  talentsPool: [],
  talentsPicked: [],
  talentIds: new Set(),
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
  major: '',
  relationship: '单身',
  relationshipHistory: [],
  storyline: '',
  storylineStart: 0,
  storylineStartMonth: 0,
  profession: '高中生',
  gradEndAge: 0,
  gradEndMonth: 0,
  pendingEvent: null,

  // ── Choice System State ──
  // pendingChoice: 当前正在等待玩家选择的 choices 数组（来自事件的 choices 字段）
  //   格式: [{ text: "按钮文字", next: 后续事件ID }, ...]
  //   非 null 时游戏暂停推进，等待玩家点击按钮
  // lastChoiceMonth: 上一次触发选择事件的 monthTotal，用于节流
  //   两次选择至少间隔 18 个月，避免频繁打断游戏节奏
  // _savedAutoMode: 选择弹出时保存的自动播放模式（0/1/2），选择完成后恢复
  pendingChoice: null,
  lastChoiceMonth: 0,
  _savedAutoMode: 0,
  SOC: 0, INT: 0, MNY: 0, PER: 0, HLT: 0, APP: 0,
  HAP: 5,
  POP: 0, POK: 0, MMR: 0,

  // Summary tracking
  statPeaks: {},
  storylinesVisited: new Set(),
};

let autoTimer = null;
let autoMode = 0;
let sessionPlayCount = 0;

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

function gachaDraw(talents, n) {
  // Group talents by grade
  const pools = [[], [], [], []];
  for (const t of talents) pools[t.grade]?.push(t);

  // Rarity roll thresholds: grade 0 (white) 80%, 1 (blue) 15%, 2 (purple) 4%, 3 (orange) 1%
  function rollGrade() {
    const r = Math.random() * 100;
    if (r < 5) return 3;   // orange
    if (r < 10) return 2;   // purple
    if (r < 30) return 1;  // blue
    return 0;               // white
  }

  function pickFrom(pool, seen) {
    const available = pool.filter(t => !seen.has(t.id));
    if (!available.length) return null;
    return available[Math.floor(Math.random() * available.length)];
  }

  const chosen = [];
  const seen = new Set();
  let gotRare = false; // track if any purple (2) or orange (3) appeared

  for (let i = 0; i < n; i++) {
    let grade = rollGrade();
    if (grade >= 2) gotRare = true;

    // Pity: if this is the last slot and no rare yet, force purple or orange
    if (i === n - 1 && !gotRare) {
      grade = Math.random() < 0.2 ? 3 : 2;
    }

    let t = pickFrom(pools[grade], seen);
    // Fallback: if pool exhausted, try adjacent grades
    if (!t) {
      for (const fallback of [grade - 1, grade + 1, 0, 1, 2, 3]) {
        if (fallback >= 0 && fallback <= 3) {
          t = pickFrom(pools[fallback], seen);
          if (t) break;
        }
      }
    }
    if (t) { seen.add(t.id); chosen.push(t); }
  }
  return chosen;
}

function applyTalentEffects() {
  for (const t of state.talentsPicked) {
    if (t.effect) {
      for (const [k, v] of Object.entries(t.effect)) {
        if (STAT_KEYS.includes(k)) {
          state[k] = (state[k] || 0) + v;
        } else if (k === 'HAP') {
          state.HAP += v;
        }
      }
    }
    if (typeof t.happyDelta === 'number') state.HAP += t.happyDelta;
  }
}

function clampStats() {
  state.HAP = Math.min(10, state.HAP);
  const trackKeys = ['SOC', 'INT', 'MNY', 'HAP', 'HLT', 'PER', 'APP', 'POP', 'POK', 'MMR'];
  for (const k of trackKeys) {
    const v = state[k] || 0;
    if (state.statPeaks[k] === undefined || v > state.statPeaks[k]) state.statPeaks[k] = v;
  }
  if (state.storyline) state.storylinesVisited.add(state.storyline);
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

function scheduleGraduateCompletion() {
  if (state.gradEndAge && state.gradEndMonth) return;
  const startAge = Math.max(23, state.age + (state.monthOfYear >= 9 ? 1 : 0));
  const endAge = Math.min(25, startAge + Math.floor(Math.random() * Math.max(1, 26 - startAge)));
  const endMonths = [5, 6, 7, 8, 9];
  state.gradEndAge = endAge;
  state.gradEndMonth = endMonths[Math.floor(Math.random() * endMonths.length)];
}

function maybeGraduateFromSchool() {
  if (!GRAD_SCHOOL_PHASES.has(state.profession)) return false;
  if (!state.gradEndAge || !state.gradEndMonth) scheduleGraduateCompletion();
  const reached = state.age > state.gradEndAge
    || (state.age === state.gradEndAge && state.monthOfYear >= state.gradEndMonth);
  if (!reached) return false;

  if (state.profession === '海外研究生') {
    pushLog('研究生毕业了。答辩、修改、熬夜赶论文的日子终于结束，你拖着行李走出校园，开始认真投递人生的第一批正式岗位。');
  } else {
    pushLog('研究生毕业了。论文定稿、答辩通过、拍完毕业照之后，你忽然发现学生时代真的结束了。接下来，是找工作的阶段。');
  }

  state.profession = '求职中';
  state.gradEndAge = 0;
  state.gradEndMonth = 0;
  return true;
}

function assignFallbackMajor() {
  if (state.major) return;
  const options = state.hsType === '体制内'
    ? [['理科', 55], ['文科', 45]]
    : [['CS', 40], ['商科', 35], ['文艺', 25]];
  for (const opt of options) {
    if (opt[0] === 'CS' && state.INT >= 6) opt[1] += 20;
    if (opt[0] === '商科' && state.MNY >= 6) opt[1] += 20;
    if (opt[0] === '文艺' && (state.APP >= 5 || state.SOC >= 6)) opt[1] += 15;
    if (opt[0] === '理科' && state.INT >= 6) opt[1] += 20;
    if (opt[0] === '文科' && state.SOC >= 6) opt[1] += 15;
  }
  const total = options.reduce((s, o) => s + o[1], 0);
  let r = Math.random() * total;
  for (const [name, w] of options) {
    r -= w;
    if (r <= 0) { state.major = name; break; }
  }
  if (!state.major) state.major = options[options.length - 1][0];
  pushLog(`你最终确定了自己的专业方向：${state.major}。`);
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

  // Separate fixed-month events from flexible ones
  const fixed = pool.filter(ev => ev.fixedMonth);
  const flex = pool.filter(ev => !ev.fixedMonth);

  const plan = new Map();
  for (const ev of fixed) plan.set(ev.fixedMonth, ev.id);

  const count = Math.min(flex.length, 1 + Math.floor(Math.random() * 3));
  const chosen = sample(flex, count);
  const usedMonths = new Set(plan.keys());
  const availMonths = [1,2,3,4,5,6,7,8,9,10,11,12].filter(m => !usedMonths.has(m));
  const months = sample(availMonths, count).sort((a, b) => a - b);
  chosen.forEach((ev, i) => plan.set(months[i], ev.id));
  state.yearlyPlan.set(age, plan);
}

function applyEvent(ev) {
  // Storyline replay: only show text, skip all side effects
  if (ev._replay) {
    delete ev._replay;
    const msg = ev.text || ev.event;
    if (msg) pushLog(msg);
    return;
  }

  if (!ev.repeatable) state.firedEvents.add(ev.id);

  // Apply set before logging so storyline color is correct
  if (ev.set) {
    const prevStoryline = state.storyline;
    const prevRel = state.relationship;
    for (const [k, v] of Object.entries(ev.set)) state[k] = v;
    if (ev.set.relationship !== undefined && ev.set.relationship !== prevRel) {
      if (!state.relationshipHistory) state.relationshipHistory = [];
      const last = state.relationshipHistory[state.relationshipHistory.length - 1];
      if (!last || last.rel !== ev.set.relationship) {
        state.relationshipHistory.push({
          rel: ev.set.relationship,
          age: state.age,
          month: state.monthOfYear,
        });
      }
    }
    if (ev.set.storyline && (!state.storylineStart || ev.set.storyline !== prevStoryline)) {
      state.storylineStart = state.age;
      state.storylineStartMonth = state.monthTotal;
    }
    if (ev.set.profession && GRAD_SCHOOL_PHASES.has(ev.set.profession)) {
      scheduleGraduateCompletion();
    }
  }

  const msg = ev.text || ev.event;
  let evLogType = ev.end ? 'ending' : (ev.romance ? 'romance' : ev.logType || undefined);
  if (!evLogType && ev.include && /MAJOR==/.test(ev.include)) {
    evLogType = 'major';
  }
  if (msg) pushLog(msg, evLogType);

  if (ev.effect) for (const [k, v] of Object.entries(ev.effect)) {
    if (EFFECT_KEYS.has(k)) state[k] = (state[k] || 0) + v;
  }
  if (typeof ev.happyDelta === 'number') state.HAP += ev.happyDelta;

  clampStats();

  if (ev.end) {
    state.phase = 'ended';
  }

  // ── Choice System: 玩家交互选择 ──
  // 如果事件定义了 choices 数组，暂停游戏让玩家从中选一个。
  // 选择后执行 resolveChoice()，跳转到对应 next 事件。
  // 优先级: choices > branch（两者互斥，choices 会 return 跳过 branch）
  if (ev.choices && ev.choices.length > 0 && state.phase !== 'ended') {
    let visible = ev.choices.filter(c => !c.showExpr || evalCondition(state, c.showExpr));
    if (visible.length === 0) return;
    if (ev.pickN && visible.length > ev.pickN) {
      visible = sample(visible, ev.pickN);
    }
    state.pendingChoice = visible;
    state.lastChoiceMonth = state.monthTotal;
    state._savedAutoMode = autoMode;  // 保存自动播放状态
    stopAuto();                        // 暂停自动播放等待玩家操作
    return;                            // 不再执行 branch
  }

  if (ev.branch) {
    const nextId = pickBranch(state, ev.branch);
    if (nextId) {
      const next = state.eventsMap.get(nextId);
      if (next) state.pendingEvent = next;
    }
  }
}

function pushLog(text, typeOverride) {
  const tag = `${state.age}岁${state.monthOfYear}月`;
  let logType = typeOverride || '';
  if (!logType && state.storyline) {
    logType = HIDDEN_STORYLINES.has(state.storyline) ? 'hidden' : 'special';
  }
  state.log.push({ tag, text, logType });
  if (state.log.length > 200) {
    state.log.shift();
    state.logRenderedCount = Math.max(0, state.logRenderedCount - 1);
  }
}

function drawRandomEvent() {
  let pool = state.randomEvents
    .filter(ev => !ev.noRandom)
    .filter(ev => !state.firedEvents.has(ev.id))
    .filter(ev => !ev.include || evalCondition(state, ev.include))
    .filter(ev => !ev.exclude || !evalCondition(state, ev.exclude));
  // Storyline isolation: only draw matching events
  const matchStoryline = (ev) => Array.isArray(ev.storyline)
    ? ev.storyline.includes(state.storyline)
    : ev.storyline === state.storyline;
  if (state.storyline) {
    pool = pool.filter(matchStoryline);
    // If all storyline events have fired, allow replaying them (text only)
    // so the storyline doesn't devolve into repeating flavor text
    if (!pool.length) {
      pool = state.randomEvents
        .filter(ev => !ev.noRandom)
        .filter(matchStoryline)
        .filter(ev => !ev.choices)
        .filter(ev => !ev.include || evalCondition(state, ev.include))
        .filter(ev => !ev.exclude || !evalCondition(state, ev.exclude));
      pool.forEach(ev => { ev._replay = true; });
    }
  } else {
    pool = pool.filter(ev => !ev.storyline);
  }
  // ── Choice 频率节流 ──
  // 两次选择事件至少间隔 8 个月（剧情线内不限）
  if (!state.storyline && state.lastChoiceMonth && state.monthTotal - state.lastChoiceMonth < 8) {
    pool = pool.filter(ev => !ev.choices);
  }
  if (!pool.length) return null;
  const majorKey = state.major ? 'MAJOR==' + state.major : null;
  const weights = pool.map(ev => {
    let w = ev.weight ?? 1;
    if (majorKey && ev.include && ev.include.includes(majorKey)) w *= 2;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/**
 * resolveChoice(index) — 玩家点击选择按钮后的回调
 *
 * 流程:
 *   1. 取出玩家选中的 choice 对象
 *   2. 清除 pendingChoice（解除游戏暂停）
 *   3. 如果 choice.next 指向一个事件 ID，执行该后续事件（可以继续 branch/choices 链）
 *   4. 恢复之前保存的自动播放模式
 */
function resolveChoice(index) {
  const choice = state.pendingChoice[index];
  state.pendingChoice = null;

  if (choice.next) {
    const ev = state.eventsMap.get(choice.next);
    if (ev) applyEvent(ev);
  }

  render();

  // 恢复选择前的自动播放状态
  const savedMode = state._savedAutoMode || 0;
  state._savedAutoMode = 0;
  if (savedMode > 0) startAuto(savedMode);
}

function advanceMonth() {
  // 如果有待选择，阻塞推进
  if (state.pendingChoice) return;

  // Fire pending event from previous branch before advancing
  if (state.pendingEvent) {
    const pe = state.pendingEvent;
    state.pendingEvent = null;
    applyEvent(pe);
    render();
    return;
  }

  state.monthTotal += 1;
  state.monthOfYear += 1;
  if (state.monthOfYear > 12) {
    state.monthOfYear = 1;
    state.age += 1;
    syncProfessionByAge();
    if (state.age >= 21 && !state.major && !state.storyline) assignFallbackMajor();
  }

  if (state.phase !== 'ended' && maybeGraduateFromSchool()) {
    render();
    return;
  }

  if (state.storyline && state.phase !== 'ended') {
    // === Storyline mode: skip normal events, only draw storyline events ===
    const cfg = STORYLINE_CFG[state.storyline];
    if (cfg) {
      // Check time-based completion
      if (cfg.successEvent && state.age - state.storylineStart >= cfg.duration) {
        const ev = state.eventsMap.get(cfg.successEvent);
        if (ev && !state.firedEvents.has(cfg.successEvent)) applyEvent(ev);
      }
      // Check progress triggers (e.g., age-gated storyline transitions)
      else if (cfg.progressChecks && cfg.progressChecks.some(pc => {
        if (pc.cond(state)) {
          const ev = state.eventsMap.get(pc.event);
          if (ev && !state.firedEvents.has(pc.event)) { applyEvent(ev); return true; }
        }
        return false;
      })) { /* handled */ }
      // Check death/fail conditions (skip during grace period)
      else if (cfg.deathChecks && state.monthTotal - (state.storylineStartMonth || 0) > (cfg.gracePeriod || 0) && cfg.deathChecks.some(dc => {
        if (dc.cond(state)) {
          const ev = state.eventsMap.get(dc.event);
          if (ev && !state.firedEvents.has(dc.event)) { applyEvent(ev); return true; }
        }
        return false;
      })) { /* handled */ }
      else {
        const re = Math.random() < (cfg.eventRate || 0.8) ? drawRandomEvent() : null;
        if (re) applyEvent(re);
        else pushLog(cfg.flavor ? cfg.flavor() : storylineFlavor());
      }
    } else {
      // Generic storyline without config — just draw storyline events
      const re = Math.random() < 0.3 ? drawRandomEvent() : null;
      if (re) applyEvent(re);
      else pushLog(storylineFlavor());
    }
  } else {
    // === Normal mode ===
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
  }

  if (!state.storyline) {
    if (state.HLT <= -5) {
      pushLog('「结局：油尽灯枯」长期的忽视和透支终于压垮了你的身体。你在一个深夜倒下，再也没有醒来。人生就此画上句号。');
      state.phase = 'ended';
    }
    if (state.age >= 60) {
      pushLog('你退休了。回首这一生，百感交集。');
      state.phase = 'ended';
    }
  }

  render();
}

let _lastFlavor = '';

function seasonalFlavor() {
  const pick = a => {
    const pool = a.length > 1 ? a.filter(x => x !== _lastFlavor) : a;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    _lastFlavor = chosen;
    return chosen;
  };
  const m = state.monthOfYear;
  const age = state.age;

  // 高中前过渡期 (15岁, 9月前)
  if (age === 15 && m <= 8) {
    if (m <= 2) return pick([
      '寒假在家，刷刷手机看看剧。',
      '放假第一天就开始熬夜，生物钟彻底崩了。',
      '被亲戚问「以后要出国吗」，你笑了笑没说话。',
      '窝在被子里刷手机，假期真是太快乐了。',
      '在家每天睡到中午，感觉自己在坐牢。',
      '妈妈开始帮你研究各种高中，你还没什么感觉。',
    ]);
    if (m <= 4) return pick([
      '还在等高中的消息，心里有点忐忑。',
      '樱花开了，和同学出去拍了一波照。',
      '春困袭来，每天都昏昏沉沉的。',
      '偶尔翻翻英语书，假装在为未来做准备。',
      '和朋友约了几次饭，聊聊以后的打算。',
      '爸妈带你参观了一所国际学校，感觉还不错。',
    ]);
    if (m <= 6) return pick([
      '中考结束了，漫长的暑假正式开始。',
      '考完试的那个下午，世界突然安静了。',
      '毕业季，和同学们拍了很多合照。',
      '聚餐散场后有些伤感，大家要各奔东西了。',
      '暂时没什么事，每天在家躺平。',
      '终于不用再做卷子了——至少暂时是这样。',
    ]);
    return pick([
      '暑假，整天待在家打游戏。',
      '夏天太热，只想待在空调房不出门。',
      '和小学/初中的朋友聚了几次，关系似乎在变淡。',
      '暑假过半，偶尔想想即将开始的高中生活。',
      '爸妈给你买了新书包，高中要开始了。',
      '倒计时开学，自由余额不足。',
    ]);
  }

  // 高中时代 (15岁9月 - 18岁3月)
  if ((age === 15 && m >= 9) || (age >= 16 && age <= 17) || (age === 18 && m <= 3)) {
    const isIntl = state.hsType === '国际';

    if (m <= 2) return pick(isIntl ? [
      '寒假在家，抽空背了几天单词。',
      '放假第一天就开始熬夜，生物钟彻底崩了。',
      '被亲戚问「出国准备得怎么样了」，你含糊应了一声。',
      '窝在被子里刷手机，假期真是太快乐了。',
      '寒假背了两天单词，然后就没然后了。',
      '在家每天睡到中午，感觉自己在坐牢。',
    ] : [
      '寒假在家，抽空写了几张卷子。',
      '放假第一天就开始熬夜，生物钟彻底崩了。',
      '被亲戚问「能考上一本吗」，你笑了笑没说话。',
      '窝在被子里刷手机，假期真是太快乐了。',
      '寒假作业还剩一大堆，最后三天疯狂赶工。',
      '在家每天睡到中午，感觉自己在坐牢。',
    ]);

    if (m <= 4) return pick(isIntl ? [
      '新学期开始了，课表排得满满当当。',
      '樱花开了，课间偷偷跑去拍照。',
      '春困袭来，上课频频走神。',
      '单词本翻到第三页，已经有些想放弃。',
      '模考成绩出来了，几家欢喜几家愁。',
      '英语课上被cue到回答问题，磕磕巴巴说完松了口气。',
    ] : [
      '新学期开始了，课表排得满满当当。',
      '樱花开了，课间偷偷跑去拍照。',
      '春困袭来，上课频频走神。',
      '开学综合征还没好，作业已经堆成山。',
      '模考成绩出来了，几家欢喜几家愁。',
      '数学老师又在黑板上画了一道你看不懂的题。',
    ]);

    if (m <= 6) return pick(isIntl ? [
      '期末考试逼近，开始疯狂复习。',
      '考前互相传阅笔记，临时抱佛脚。',
      '最后一科考完，冲出教室的那一刻世界都亮了。',
      '复习到深夜，眼前的字已经开始跳舞。',
      '期末考前转发了一条锦鲤，玄学护体。',
      'GPA出来了，你盯着小数点后两位看了半天。',
    ] : [
      '期末考试逼近，开始疯狂复习。',
      '考前互相传阅笔记，临时抱佛脚。',
      '最后一科考完，冲出教室的那一刻世界都亮了。',
      '考完一门感觉血槽已空，然而还有三门。',
      '复习到深夜，眼前的字已经开始跳舞。',
      '排名贴出来了，你在人群后面踮脚看了一眼。',
    ]);

    if (m <= 8) return pick(isIntl ? [
      '暑假，报了个托福/雅思班继续卷。',
      '夏天太热，只想待在空调房不出门。',
      '暑假刷了几套标化真题，感觉有点进步。',
      '和同学约出去玩了一趟，晒得黢黑。',
      '暑假过半，单词还没背完。',
      '暑假参加了一个夏校/夏令营，简历又多了一行。',
    ] : [
      '暑假，被拉去上补习班。',
      '夏天太热，只想待在空调房不出门。',
      '暑假作业做了一半，实在写不下去了。',
      '和同学约出去玩了一趟，晒得黢黑。',
      '暑假过半，作业还没做完一半。',
      '收到下学期的课表，沉默了。',
    ]);

    if (m <= 10) {
      if (age === 15) return pick(isIntl ? [
        '第一次踏进国际高中校园，一切都是新鲜的。',
        '高中开学了，新同学新老师新教室，有点紧张。',
        '报到第一天，校园比想象中大好多。',
        '军训结束了，晒黑了两个度但交到了新朋友。',
        '第一次上全英文课，听得云里雾里。',
        '刚开学就被学长学姐安利了一堆社团，眼花缭乱。',
      ] : [
        '第一次踏进高中校园，一切都是新鲜的。',
        '高中开学了，新同学新老师新教室，有点紧张。',
        '报到第一天，教室墙上写着「提高一分，干掉千人」。',
        '军训结束了，晒黑了两个度但交到了新朋友。',
        '第一堂课老师就说：离高考还有三年，不远了。',
        '刚开学就被学长学姐安利了一堆社团，眼花缭乱。',
      ]);
      return pick(isIntl ? [
        '秋季学期，新的课表。',
        '开学第一周就想放假。',
        '秋风起，食堂上了新菜。',
        '社团招新，传单塞了一书包。',
        '换季降温，感冒了一整周。',
        '国庆长假之后，上课如上坟。',
      ] : [
        '秋季学期，新的课表。',
        '开学第一周就想放假。',
        '秋风起，食堂上了新菜。',
        '月考又来了，卷子像雪花一样发下来。',
        '换季降温，感冒了一整周。',
        '国庆长假之后，上课如上坟。',
      ]);
    }

    return pick(isIntl ? [
      '年关将至，开始准备期末。',
      '天冷了，早起变成一种酷刑。',
      '期末将至，又到了临时抱佛脚的季节。',
      '下雪了，课间大家跑出去打雪仗。',
      '年底总结：今年又过去了。',
      '冬天来了，教室里暖气开得很足，昏昏欲睡。',
    ] : [
      '年关将至，开始准备期末。',
      '天冷了，早起变成一种酷刑。',
      '期末将至，又到了疯狂刷卷子的季节。',
      '下雪了，课间大家跑出去打雪仗。',
      '年底总结：今年又过去了。',
      '冬天来了，教室里暖气开得很足，昏昏欲睡。',
    ]);
  }

  // 大学时代 (18岁4月 - 25岁, 仅限在校生)
  const workingProfs = new Set(['海外打工人','海归','打工人','待业','上班族','Gap Year',
    '大厂核心','产品经理','全栈开发','外包码农','独立开发者','连续创业者','财富自由',
    '投行精英','四大会计','咨询顾问','销售经理','金融民工','自由撰稿人','策展人','独立艺术家','艺术教师','文员']);
  if (age <= 25 && !workingProfs.has(state.profession)) {
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
      '开学第一周就想退学。',
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

function spyFlavor() {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const y = state.age - state.storylineStart;
  if (y <= 1) return pick([
    '凌晨四点，教官把你从床上拽起来跑十公里。',
    '你在靶场练习射击，耳朵嗡嗡作响。',
    '今天的训练内容是水刑抗审讯，你差点窒息。',
    '格斗课上你被摔了十几次，浑身青紫。',
    '深夜密码学课程，你对着乱码头痛欲裂。',
    '你在黑暗中匍匐前进，膝盖磨破了皮。',
    '教官递给你一份假身份档案：「背下来，这就是你。」',
    '体能测试不合格，被罚多跑五圈。',
  ]);
  if (y <= 3) return pick([
    '你在模拟任务中成功潜入了目标建筑。',
    '今天学习了三种不同的伪装术。',
    '跟踪与反跟踪训练，你在城市街头穿梭。',
    '你学会了用十种不同的方式打开一把锁。',
    '高级驾驶课程——你把训练车的轮胎磨平了。',
    '审讯技巧训练，你开始学会读懂微表情。',
    '今天的任务是48小时不合眼，你在第36小时开始产生幻觉。',
    '教官说你的进步很大，但眼神里没有温度。',
  ]);
  return pick([
    '你已经记不清自己的真名了。',
    '又一次任务简报，你面无表情地点头。',
    '在安全屋里独自度过又一个夜晚。',
    '你检查了三遍窗户和门锁才躺下。',
    '偶尔想起从前的生活，恍如隔世。',
    '搭档用暗号联络你，一切如常。',
    '你在镜子里看到一个陌生人——那是你自己。',
    '任务间隙，你在天台抽了一根烟，看着远处的灯火。',
  ]);
}

function abyssFlavor() {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  return pick([
    '你盯着满屏的代码，眼前开始出现重影。',
    '凌晨三点，地下基地的荧光灯发出令人烦躁的嗡嗡声。',
    '你又做了那个梦——无尽的数据洪流把你淹没。',
    '咖啡已经喝到第七杯了，你的手在微微发抖。',
    'AGI 核心的运算指示灯闪烁着冰冷的蓝光，像某种生物的脉搏。',
    '你已经记不清上一次看到太阳是什么时候了。',
    '走廊尽头的安保摄像头似乎一直在盯着你。',
    '你在代码注释里偷偷写下了一句"救命"，然后又删掉了。',
  ]);
}

function metaFlavor() {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  return pick([
    '天空的分辨率今天似乎降低了，大概是服务器在省资源。',
    '你试图和一棵树对话，它回复了一句"交互未定义"。',
    '你又看到了那行浮空的调试信息，然后它闪了一下消失了。',
    '你盯着镜子看了很久，总觉得你的面部多边形有点少。',
    '风吹过来的方向不对，好像有人把风场参数填反了。',
    '路过的NPC第三次对你说了一模一样的台词。',
    '你试着往地图边缘走，脚下的地面开始变得透明。',
    '今天的日落持续了零点三秒就切换成了夜晚。',
  ]);
}

function storylineFlavor() {
  const sl = state.storyline;
  const flavors = {
    idol:       ['你在练习室里反复排练舞步。', '经纪人给你排了一个新通告。', '你对着镜子练习微笑。', '化妆师又给你换了一个新造型。', '你在录音棚里反复 retake 同一句歌词。', '今天的体重秤数字让你心跳加速。', '你和队友一起练习队形走位到深夜。', '舞台监督叫你重新对一遍走位。', '你在评估表上又被打了 B 等级。', '粉丝群的小作文又一次让你失眠。'],
    superstar:  ['粉丝在社交媒体上疯狂刷屏。', '你的日程被各种活动填满了。', '又是忙碌而充实的一天。', '助理递来一杯咖啡，你已经分不清是第几杯了。', '保镖小心翼翼地把你护送进酒店后门。', '你在飞往下一个城市的私人飞机上小憩。', '商务团队又递来一份七位数的代言合约。', '剧组在深夜给你加了三场补拍。', '你打开热搜，发现自己又上了榜首。', '走红毯前你被造型师围着改了第六版礼服。'],
    streamer:   ['你调试着直播间的灯光和设备。', '今天的直播数据还不错。', '你在构思下一期的内容选题。', '中控让你今晚的下播时间再延后两个小时。', '你看了眼实时弹幕，刷屏的全是要求你跳舞。', '今天的礼物榜被一个新榜一刷上了百万。', '你回复完粉丝群里几百条消息，已经凌晨四点。', '剪辑师把你今天的高光镜头剪成了短视频。', '你在选品会议上挑选下场直播的 SKU。', '广告金主又寄来了一堆产品试用装。'],
    poker:      ['你在脑海中复盘昨晚的牌局。', '你默默计算着底池赔率。', '你研究着对手的下注模式。'],
    triton:     ['你的名字开始在牌圈里传开。', '你冷静地分析着每一手牌。', '高额桌的空气令人窒息。'],
    local_shark:['你在牌桌上不动声色。', '又是一个漫长的夜晚。', '你点了一杯威士忌，继续等待。'],
    party:      ['你在组织下一场派对的细节。', '手机响个不停，全是派对邀请。', '你和朋友们在策划一个大活动。'],
    ceo:        ['你在咖啡厅里和合伙人讨论商业计划。', '投资人的电话一个接一个。', '你在白板上画着公司的未来蓝图。'],
    wasted:     ['你宿醉未醒，盯着天花板发呆。', '昨晚的记忆一片模糊。', '你翻了翻空空如也的钱包。', '出租屋的水电费又欠了一个月。', '你打开冰箱，里面只剩半瓶过期的啤酒。', '你发了个朋友圈，没人点赞。', '你点了一份最便宜的麦当劳外卖。', '你刷了一晚上短视频，太阳又升起来了。', '你想找老朋友聚聚，发现已经没人愿意接你电话。', '你看着窗外别人忙碌的身影，感到一种说不出的疲倦。'],
    esports:    ['你坐在电竞椅上看着回放录像。', '训练赛打到凌晨三点，眼睛干涩发酸。', '你在练习瞄准，一遍又一遍。'],
    worlds:     ['全世界的目光都聚焦在这里。', '你在后台调整着鼠标DPI。', '赛前的紧张感让你手心冒汗。'],
    minor_league:['又是一场没人看的比赛。', '网吧的空调坏了，热得你心烦意乱。', '你刷着手机看顶级联赛的集锦，心里五味杂陈。'],
  };
  const pool = flavors[sl];
  if (pool) return pool[Math.floor(Math.random() * pool.length)];
  return '……';
}

function $(id) { return document.getElementById(id); }

function renderTalentSelect(talents) {
  const pool = gachaDraw(talents, 10);
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
  const baseTotal = Object.values(state.allocBase).reduce((a, b) => a + b, 0);
  const used = Object.values(state.alloc).reduce((a, b) => a + b, 0) - baseTotal;
  const remaining = ALLOC_TOTAL - used;
  $('alloc-remaining').textContent = remaining;

  const bonusByStat = {};
  for (const k of STAT_KEYS) bonusByStat[k] = 0;
  for (const t of state.talentsPicked || []) {
    if (!t.effect) continue;
    for (const [k, v] of Object.entries(t.effect)) {
      if (STAT_KEYS.includes(k)) bonusByStat[k] += v;
    }
  }

  for (const k of STAT_KEYS) {
    $(`alloc-${k}`).textContent = state.alloc[k];
    const bEl = $(`bonus-${k}`);
    if (bEl) {
      const b = bonusByStat[k];
      if (b) {
        bEl.textContent = (b > 0 ? '+' : '') + b;
        bEl.className = 'alloc-bonus ' + (b > 0 ? 'pos' : 'neg');
      } else {
        bEl.textContent = '';
        bEl.className = 'alloc-bonus';
      }
    }
  }

  const banner = $('talent-bonus-banner');
  if (banner) {
    const picks = state.talentsPicked || [];
    if (picks.length === 0) {
      banner.style.display = 'none';
      banner.innerHTML = '';
    } else {
      banner.style.display = '';
      const chips = picks.map(t => {
        const parts = [];
        if (t.effect) {
          for (const [k, v] of Object.entries(t.effect)) {
            const label = STAT_LABELS[k];
            if (!label) continue;
            parts.push(`<span class="tb-eff ${v > 0 ? 'pos' : 'neg'}">${v > 0 ? '+' : ''}${v}${label}</span>`);
          }
        }
        if (typeof t.happyDelta === 'number' && t.happyDelta) {
          parts.push(`<span class="tb-eff ${t.happyDelta > 0 ? 'pos' : 'neg'}">${t.happyDelta > 0 ? '+' : ''}${t.happyDelta}快乐</span>`);
        }
        const effHtml = parts.length ? parts.join('') : '<span class="tb-eff none">无属性加成</span>';
        return `<span class="tb-chip grade-${t.grade}"><span class="tb-name">${t.name}</span>${effHtml}</span>`;
      }).join('');
      banner.innerHTML = `<span class="tb-label">已选天赋</span><div class="tb-chips">${chips}</div>`;
    }
  }

  $('alloc-start').disabled = remaining !== 0;
}

function render() {
  if (state.phase === 'game' || state.phase === 'ended') {
    renderAvatar($('avatar-canvas'), state);

    const statsEl = $('stats-panel');
    statsEl.innerHTML = '';
    const shown = ['SOC', 'INT', 'MNY', 'HAP', 'HLT', 'PER', 'APP'];
    if (state.showPOP) shown.push('POP');
    if (state.showPOK) shown.push('POK');
    if (state.showMMR) shown.push('MMR');
    const dynamicMax = Math.max(1, ...shown.filter(k => k !== 'HAP').map(k => state[k]));
    const SPECIAL_STATS = new Set(['POP', 'POK', 'MMR']);
    for (const k of shown) {
      const row = document.createElement('div');
      const isSpecial = SPECIAL_STATS.has(k);
      row.className = 'stat-row' + (isSpecial ? ' stat-special' : '');
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

    const schoolBox = $('school-box');
    if (state.school && state.school !== '无') {
      schoolBox.style.display = '';
      $('school-display').textContent = state.school;
    } else {
      schoolBox.style.display = 'none';
    }

    $('major-display').textContent = state.major || '未定';
    $('relationship-display').textContent = state.relationship || '单身';

    const profBox = $('profession-box');
    if (state.profession && !STUDENT_PHASES.has(state.profession)) {
      profBox.style.display = '';
      $('profession-display').textContent = state.profession;
    } else {
      profBox.style.display = 'none';
    }

    const slBox = $('storyline-box');
    if (state.storyline) {
      slBox.style.display = '';
      const isHidden = HIDDEN_STORYLINES.has(state.storyline);
      slBox.classList.toggle('hidden-storyline', isHidden);
      slBox.classList.toggle('special-storyline', !isHidden);
      slBox.querySelector('.storyline-label').textContent = isHidden ? '隐藏剧情' : '特殊剧情';
      $('storyline-display').textContent = STORYLINE_NAMES[state.storyline] || state.storyline;
    } else {
      slBox.style.display = 'none';
    }

    $('time-display').textContent = `${state.age}岁${state.monthOfYear}个月`;

    const logEl = $('event-log');
    if (state.logRenderedCount > state.log.length) {
      state.logRenderedCount = 0;
      logEl.innerHTML = '';
    }
    const hadNew = state.log.length > state.logRenderedCount;
    for (let i = state.logRenderedCount; i < state.log.length; i++) {
      const entry = state.log[i];
      const div = document.createElement('div');
      const logCls = entry.logType ? ' log-' + entry.logType : '';
      div.className = 'log-entry' + logCls;
      div.innerHTML = `<span class="log-tag">${entry.tag}</span><span class="log-text">${entry.text}</span>`;
      logEl.appendChild(div);
    }
    state.logRenderedCount = state.log.length;
    for (const el of logEl.querySelectorAll('.log-entry.log-latest')) el.classList.remove('log-latest');
    const last = logEl.lastElementChild;
    if (last && last.classList.contains('log-entry')) last.classList.add('log-latest');
    if (hadNew) logEl.scrollTop = logEl.scrollHeight;

    // ── Choice UI 渲染 ──
    // 每次 render 先移除旧的选择按钮（避免重复）
    const oldChoice = logEl.querySelector('.choice-container');
    if (oldChoice) oldChoice.remove();

    while (logEl.children.length > 60) {
      logEl.removeChild(logEl.firstElementChild);
    }

    // 如果 pendingChoice 非空，在事件流底部渲染选择按钮
    // 点击任一按钮 → resolveChoice(i) → 跳转到 choice.next 事件
    // 如果 next 事件有特殊颜色（romance/hidden/special），按钮文字也上色
    if (state.pendingChoice) {
      const choiceDiv = document.createElement('div');
      choiceDiv.className = 'choice-container';
      const isCardLayout = state.pendingChoice.some(c => c.title || c.desc);
      if (isCardLayout) choiceDiv.classList.add('choice-cards');
      state.pendingChoice.forEach((c, i) => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        if (c.title || c.desc) btn.classList.add('choice-card');
        const locked = c.requireExpr && !evalCondition(state, c.requireExpr);
        if (c.title || c.desc) {
          const titleEl = document.createElement('div');
          titleEl.className = 'choice-title';
          titleEl.textContent = c.title || c.text || '';
          btn.appendChild(titleEl);
          if (c.desc) {
            const descEl = document.createElement('div');
            descEl.className = 'choice-desc';
            descEl.textContent = c.desc;
            btn.appendChild(descEl);
          }
          if (c.requireText) {
            const reqEl = document.createElement('div');
            reqEl.className = 'choice-req' + (locked ? ' locked' : ' met');
            reqEl.textContent = (locked ? '🔒 ' : '✓ ') + c.requireText;
            btn.appendChild(reqEl);
          }
        } else {
          btn.textContent = c.text;
        }
        // Determine color from next event's type
        const nextEv = c.next ? state.eventsMap.get(c.next) : null;
        const colorType = nextEv
          ? (nextEv.romance ? 'romance'
            : nextEv.logType ? nextEv.logType
            : nextEv.set && nextEv.set.storyline
              ? (HIDDEN_STORYLINES.has(nextEv.set.storyline) ? 'hidden' : 'special')
              : '')
          : '';
        if (colorType) btn.classList.add('choice-' + colorType);
        if (locked) {
          btn.classList.add('choice-locked');
          btn.disabled = true;
        }
        btn.addEventListener('click', (e) => {
          e.stopPropagation();  // 阻止冒泡到面板的 advanceMonth
          if (locked) return;
          resolveChoice(i);
        });
        choiceDiv.appendChild(btn);
      });
      logEl.appendChild(choiceDiv);
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
  const sb = $('btn-summary');
  if (sb) sb.style.display = ended ? '' : 'none';
  b1.disabled = ended;
  b2.disabled = ended;
  if (ended && !_endCinematicShown && document.body.classList.contains('in-game')) {
    setTimeout(showEndCinematic, 600);
  }
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
  advanceMonth();
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
  state.talentIds = new Set(state.talentsPicked.map(t => t.id));
  state.statPeaks = {};
  state.storylinesVisited = new Set();
  _endCinematicShown = false;
  applyTalentEffects();
  clampStats();
  state.phase = 'game';
  state.age = 15;
  state.monthOfYear = 1;
  state.gradEndAge = 0;
  state.gradEndMonth = 0;
  syncProfessionByAge();
  planYear(15);

  sessionPlayCount++;
  if (sessionPlayCount <= 1) {
    pushLog('你重生了，重生在15岁的冬天。');
  } else {
    pushLog('你又重生了，重生在15岁的冬天。');
  }
  const plan = state.yearlyPlan.get(15);
  if (plan && plan.has(1)) {
    const ev = state.eventsMap.get(plan.get(1));
    plan.delete(1);
    if (ev) applyEvent(ev);
  }

  showScreen('game-screen');
  render();
}

let _endCinematicShown = false;

function showEndCinematic() {
  if (_endCinematicShown) return;
  _endCinematicShown = true;

  // Pick the actual ending log: prefer logType='ending' (set when ev.end=true),
  // fallback to last entry with 「结局」 keyword, else last log
  const logs = state.log;
  let endingIdx = -1;
  for (let i = logs.length - 1; i >= 0; i--) {
    if (logs[i].logType === 'ending') { endingIdx = i; break; }
  }
  if (endingIdx < 0) {
    for (let i = logs.length - 1; i >= 0; i--) {
      if (logs[i].text && /结局/.test(logs[i].text)) { endingIdx = i; break; }
    }
  }
  const endingLog = endingIdx >= 0 ? logs[endingIdx] : logs[logs.length - 1];

  $('end-card-tag').textContent = endingLog ? endingLog.tag : '';
  $('end-card-text').textContent = endingLog ? endingLog.text : '一段人生结束了。';

  // Try to find the matching DOM log entry for the fly animation
  const logEl = $('event-log');
  let sourceEl = null;
  if (endingIdx >= 0) {
    const entries = logEl.querySelectorAll('.log-entry');
    sourceEl = entries[endingIdx] || logEl.lastElementChild;
  } else {
    sourceEl = logEl.lastElementChild;
  }

  const overlay = $('end-overlay');
  overlay.classList.add('active');

  if (sourceEl) {
    const rect = sourceEl.getBoundingClientRect();
    const ghost = document.createElement('div');
    ghost.className = 'end-ghost';
    ghost.textContent = endingLog ? endingLog.text : '';
    ghost.style.top = rect.top + 'px';
    ghost.style.left = rect.left + 'px';
    ghost.style.width = rect.width + 'px';
    overlay.appendChild(ghost);
    requestAnimationFrame(() => {
      ghost.classList.add('ghost-flying');
    });
    setTimeout(() => ghost.remove(), 1700);
  }

  setTimeout(() => {
    overlay.classList.add('show-card');
  }, 1400);
}

function dismissEndOverlay() {
  const overlay = $('end-overlay');
  overlay.classList.remove('active', 'show-card');
}

function renderSummary() {
  const ageY = state.age;
  const ageM = state.monthOfYear;
  $('summary-subtitle').textContent = `走过 ${ageY} 岁 ${ageM} 个月`;

  // Hero avatar — render immediately, then redundantly to catch layout edge cases
  const sumCanvas = $('summary-avatar');
  if (sumCanvas) {
    renderAvatar(sumCanvas, state);
    setTimeout(() => renderAvatar(sumCanvas, state), 50);
    setTimeout(() => renderAvatar(sumCanvas, state), 250);
  }

  // Hero meta (chips next to avatar)
  const heroMeta = $('summary-hero-meta');
  if (heroMeta) {
    const chips = [];
    chips.push(`<span class="hero-chip hero-chip-age">${ageY} 岁 ${ageM} 个月</span>`);
    if (state.school && state.school !== '无') chips.push(`<span class="hero-chip">${state.school}</span>`);
    if (state.major) chips.push(`<span class="hero-chip">${state.major}</span>`);
    if (state.profession) chips.push(`<span class="hero-chip">${state.profession}</span>`);
    if (state.relationship) chips.push(`<span class="hero-chip">${state.relationship}</span>`);
    heroMeta.innerHTML = chips.join('');
  }

  // 最终结局：优先 logType=ending（来自 ev.end=true），否则回退到 hidden/special/「结局」
  const reversed = [...state.log].reverse();
  const endingLog = reversed.find(e => e.logType === 'ending')
    || reversed.find(e => (e.text && /结局/.test(e.text)) || e.logType === 'hidden' || e.logType === 'special');
  const endingEl = $('summary-ending');
  if (endingLog) {
    endingEl.innerHTML = `<div class="ending-tag">${endingLog.tag}</div><div class="ending-text">${endingLog.text}</div>`;
  } else {
    endingEl.innerHTML = `<div class="ending-text">这一生平淡如水。</div>`;
  }

  // 剧情列表
  const slEl = $('summary-storylines');
  const visited = [...state.storylinesVisited];
  if (visited.length === 0) {
    slEl.innerHTML = `<div class="empty-hint">没有触发任何特殊剧情</div>`;
  } else {
    slEl.innerHTML = visited.map(sl => {
      const cls = HIDDEN_STORYLINES.has(sl) ? 'storyline-chip hidden' : 'storyline-chip special';
      return `<span class="${cls}">${STORYLINE_NAMES[sl] || sl}</span>`;
    }).join('');
  }

  // 属性
  const statsEl = $('summary-stats');
  const keys = ['SOC', 'INT', 'MNY', 'HAP', 'HLT', 'PER', 'APP'];
  if (state.statPeaks.POP !== undefined && state.statPeaks.POP > 0) keys.push('POP');
  if (state.statPeaks.POK !== undefined && state.statPeaks.POK > 0) keys.push('POK');
  if (state.statPeaks.MMR !== undefined && state.statPeaks.MMR > 0) keys.push('MMR');
  statsEl.innerHTML = keys.map(k => {
    const peak = state.statPeaks[k] ?? 0;
    const cur = state[k] ?? 0;
    const isSpec = ['POP','POK','MMR'].includes(k);
    return `
      <div class="stat-line ${isSpec ? 'spec' : ''}">
        <span class="stat-line-label">${STAT_LABELS[k]}</span>
        <span class="stat-line-cur">${cur}</span>
        <span class="stat-line-peak">峰值 ${peak}</span>
      </div>
    `;
  }).join('');

  // 天赋
  const talentEl = $('summary-talents');
  if (state.talentsPicked && state.talentsPicked.length) {
    talentEl.innerHTML = state.talentsPicked.map(t =>
      `<div class="talent-line grade-${t.grade}"><span class="t-line-name">${t.name}</span><span class="t-line-desc">${t.description}</span></div>`
    ).join('');
  } else {
    talentEl.innerHTML = `<div class="empty-hint">无天赋记录</div>`;
  }

  // 高光时刻：抽 hidden/special/romance 的 log，最多 6 条
  const hlEl = $('summary-highlights');
  const highlights = state.log.filter(e =>
    e.logType === 'hidden' || e.logType === 'special' || e.logType === 'romance'
  );
  if (highlights.length === 0) {
    hlEl.innerHTML = `<div class="empty-hint">没有特别记录</div>`;
  } else {
    hlEl.innerHTML = highlights.map(h =>
      `<div class="highlight-row hl-${h.logType}"><span class="hl-tag">${h.tag}</span><span class="hl-text">${h.text}</span></div>`
    ).join('');
  }

  // 恋爱史
  const romEl = $('summary-romance');
  if (romEl) {
    const history = (state.relationshipHistory || []).filter(h => h.rel && h.rel !== '单身');
    const finalRelation = state.relationship || '单身';
    if (history.length === 0 && (finalRelation === '单身' || !finalRelation)) {
      const taunts = [
        '从 15 岁单身到现在，纯纯的单身狗一条 🐕',
        '一辈子没人要，建议下辈子练练颜值。',
        '情感经历：纯白一片。爱情？那是别人的故事。',
        '连暧昧都没有过，这哪是留学生，这是修行僧。',
      ];
      const taunt = taunts[Math.floor(Math.random() * taunts.length)];
      romEl.innerHTML = `<div class="romance-empty">${taunt}</div>`;
    } else {
      const chips = history.map((h, i) => {
        const isLast = i === history.length - 1;
        return `<span class="rom-stage${isLast ? ' rom-stage-final' : ''}">${h.rel}<span class="rom-stage-age">${h.age}岁</span></span>`;
      }).join('<span class="rom-arrow">→</span>');
      romEl.innerHTML = `<div class="romance-flow">${chips || `<span class="rom-stage">${finalRelation}</span>`}</div>`;
    }
  }

  // 人生数据
  const metaEl = $('summary-meta');
  const totalEvents = state.log.length;
  const ageDeath = state.HLT <= -5;
  const finalProf = state.profession || '未定';
  const finalSchool = state.school && state.school !== '无' ? state.school : '—';
  const finalRel = state.relationship || '单身';
  metaEl.innerHTML = `
    <div class="meta-row"><span class="meta-k">事件总数</span><span class="meta-v">${totalEvents}</span></div>
    <div class="meta-row"><span class="meta-k">最终学校</span><span class="meta-v">${finalSchool}</span></div>
    <div class="meta-row"><span class="meta-k">最终职业</span><span class="meta-v">${finalProf}</span></div>
    <div class="meta-row"><span class="meta-k">恋爱状态</span><span class="meta-v">${finalRel}</span></div>
    <div class="meta-row"><span class="meta-k">触发剧情</span><span class="meta-v">${visited.length} 条</span></div>
    <div class="meta-row"><span class="meta-k">死因</span><span class="meta-v">${ageDeath ? '健康崩溃' : (state.age >= 60 ? '善终退休' : '剧情结局')}</span></div>
  `;
}

function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.remove('active');
  $(id).classList.add('active');
  document.body.classList.toggle('in-game', id === 'game-screen');
  document.body.classList.toggle('in-summary', id === 'summary-screen');
  if (id !== 'game-screen') stopAuto();
}

async function main() {
  const talents = await loadData();

  $('sex-male').addEventListener('click', () => { state.sex = 0; $('sex-male').classList.add('active'); $('sex-female').classList.remove('active'); });
  $('sex-female').addEventListener('click', () => { state.sex = 1; $('sex-female').classList.add('active'); $('sex-male').classList.remove('active'); });

  $('talent-confirm').addEventListener('click', () => {
    for (const k of STAT_KEYS) {
      state.alloc[k] = 0;
    }
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

  $('alloc-random').addEventListener('click', () => {
    for (const k of STAT_KEYS) state.alloc[k] = 0;
    let remaining = ALLOC_TOTAL;
    while (remaining > 0) {
      const availableKeys = STAT_KEYS.filter(k => state.alloc[k] < MAX_PER_STAT);
      if (availableKeys.length === 0) break;
      const k = availableKeys[Math.floor(Math.random() * availableKeys.length)];
      state.alloc[k]++;
      remaining--;
    }
    renderAlloc();
  });

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

  $('btn-restart').addEventListener('click', () => {
    showScreen('start-screen');
    location.reload();
  });

  $('btn-summary').addEventListener('click', () => {
    dismissEndOverlay();
    showScreen('summary-screen');
    renderSummary();
  });

  $('btn-end-summary').addEventListener('click', () => {
    dismissEndOverlay();
    showScreen('summary-screen');
    renderSummary();
  });

  $('btn-end-restart').addEventListener('click', () => {
    location.reload();
  });

  $('btn-summary-back').addEventListener('click', () => {
    showScreen('game-screen');
    render();
  });

  $('btn-summary-restart').addEventListener('click', () => {
    location.reload();
  });

  $('btn-start').addEventListener('click', () => {
    showScreen('talent-screen');
  });

  renderTalentSelect(talents);
  showScreen('start-screen');
}

main();
