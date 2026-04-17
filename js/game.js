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

// Storyline configurations: death checks, completion, event rate, flavor
const STORYLINE_CFG = {
  spy: {
    duration: 2,
    gracePeriod: 6,
    successEvent: 50099,
    eventRate: 0.8,
    deathChecks: [
      { cond: s => s.HLT <= -3, event: 50060 },
      { cond: s => s.PER <= -1, event: 50061 },
      { cond: s => s.SOC <= -2 && s.HAP <= 0, event: 50064 },
    ],
    flavor: () => spyFlavor(),
  },
  abyss: {
    gracePeriod: 6,
    eventRate: 0.8,
    deathChecks: [
      { cond: s => s.HLT <= -3, event: 60091 },
      { cond: s => s.HAP <= -8 && s.INT <= 0, event: 60091 },
    ],
    flavor: () => abyssFlavor(),
  },
  meta: {
    gracePeriod: 6,
    eventRate: 0.75,
    deathChecks: [
      { cond: s => s.HAP <= -8, event: 70094 },
    ],
    flavor: () => metaFlavor(),
  },
};

const STORYLINE_NAMES = {
  spy: '国际特工',
  abyss: '深渊科技',
  meta: '第四面墙',
};

const state = {
  phase: 'talent',
  alloc: { SOC: 0, INT: 0, MNY: 0, PER: 0, HLT: 0, APP: 0 },
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
  storyline: '',
  storylineStart: 0,
  storylineStartMonth: 0,
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

function gachaDraw(talents, n) {
  // Group talents by grade
  const pools = [[], [], [], []];
  for (const t of talents) pools[t.grade]?.push(t);

  // Rarity roll thresholds: grade 0 (white) 80%, 1 (blue) 15%, 2 (purple) 4%, 3 (orange) 1%
  function rollGrade() {
    const r = Math.random() * 100;
    if (r < 1) return 3;   // orange
    if (r < 5) return 2;   // purple
    if (r < 20) return 1;  // blue
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
    if (t.effect) for (const [k, v] of Object.entries(t.effect)) {
      if (STAT_KEYS.includes(k)) state[k] += v;
      else if (k === 'HAP') state.HAP += v;
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
  const msg = ev.text || ev.event;
  if (msg) pushLog(msg);

  if (ev.effect) for (const [k, v] of Object.entries(ev.effect)) {
    if (STAT_KEYS.includes(k)) state[k] += v;
    else if (k === 'HAP') state.HAP += v;
  }
  if (typeof ev.happyDelta === 'number') state.HAP += ev.happyDelta;
  if (ev.set) {
    for (const [k, v] of Object.entries(ev.set)) state[k] = v;
    if (ev.set.storyline && !state.storylineStart) {
      state.storylineStart = state.age;
      state.storylineStartMonth = state.monthTotal;
    }
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
  let pool = state.randomEvents
    .filter(ev => !ev.noRandom)
    .filter(ev => !state.firedEvents.has(ev.id))
    .filter(ev => !ev.include || evalCondition(state, ev.include))
    .filter(ev => !ev.exclude || !evalCondition(state, ev.exclude));
  // Storyline isolation: only draw matching events
  if (state.storyline) {
    pool = pool.filter(ev => ev.storyline === state.storyline);
  } else {
    pool = pool.filter(ev => !ev.storyline);
  }
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

  if (state.storyline && state.phase !== 'ended') {
    // === Storyline mode: skip normal events, only draw storyline events ===
    const cfg = STORYLINE_CFG[state.storyline];
    if (cfg) {
      // Check time-based completion
      if (cfg.successEvent && state.age - state.storylineStart >= cfg.duration) {
        const ev = state.eventsMap.get(cfg.successEvent);
        if (ev && !state.firedEvents.has(cfg.successEvent)) applyEvent(ev);
      }
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
      const re = Math.random() < 0.8 ? drawRandomEvent() : null;
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

function spyFlavor() {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const y = state.age - state.storylineStart;
  if (y <= 1) return pick([
    '「国际特工」凌晨四点，教官把你从床上拽起来跑十公里。',
    '「国际特工」你在靶场练习射击，耳朵嗡嗡作响。',
    '「国际特工」今天的训练内容是水刑抗审讯，你差点窒息。',
    '「国际特工」格斗课上你被摔了十几次，浑身青紫。',
    '「国际特工」深夜密码学课程，你对着乱码头痛欲裂。',
    '「国际特工」你在黑暗中匍匐前进，膝盖磨破了皮。',
    '「国际特工」教官递给你一份假身份档案：「背下来，这就是你。」',
    '「国际特工」体能测试不合格，被罚多跑五圈。',
  ]);
  if (y <= 3) return pick([
    '「国际特工」你在模拟任务中成功潜入了目标建筑。',
    '「国际特工」今天学习了三种不同的伪装术。',
    '「国际特工」跟踪与反跟踪训练，你在城市街头穿梭。',
    '「国际特工」你学会了用十种不同的方式打开一把锁。',
    '「国际特工」高级驾驶课程——你把训练车的轮胎磨平了。',
    '「国际特工」审讯技巧训练，你开始学会读懂微表情。',
    '「国际特工」今天的任务是48小时不合眼，你在第36小时开始产生幻觉。',
    '「国际特工」教官说你的进步很大，但眼神里没有温度。',
  ]);
  return pick([
    '「国际特工」你已经记不清自己的真名了。',
    '「国际特工」又一次任务简报，你面无表情地点头。',
    '「国际特工」在安全屋里独自度过又一个夜晚。',
    '「国际特工」你检查了三遍窗户和门锁才躺下。',
    '「国际特工」偶尔想起从前的生活，恍如隔世。',
    '「国际特工」搭档用暗号联络你，一切如常。',
    '「国际特工」你在镜子里看到一个陌生人——那是你自己。',
    '「国际特工」任务间隙，你在天台抽了一根烟，看着远处的灯火。',
  ]);
}

function abyssFlavor() {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  return pick([
    '「深渊科技」你盯着满屏的代码，眼前开始出现重影。',
    '「深渊科技」凌晨三点，地下基地的荧光灯发出令人烦躁的嗡嗡声。',
    '「深渊科技」你又做了那个梦——无尽的数据洪流把你淹没。',
    '「深渊科技」咖啡已经喝到第七杯了，你的手在微微发抖。',
    '「深渊科技」AGI 核心的运算指示灯闪烁着冰冷的蓝光，像某种生物的脉搏。',
    '「深渊科技」你已经记不清上一次看到太阳是什么时候了。',
    '「深渊科技」走廊尽头的安保摄像头似乎一直在盯着你。',
    '「深渊科技」你在代码注释里偷偷写下了一句"救命"，然后又删掉了。',
  ]);
}

function metaFlavor() {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  return pick([
    '「第四面墙」天空的分辨率今天似乎降低了，大概是服务器在省资源。',
    '「第四面墙」你试图和一棵树对话，它回复了一句"交互未定义"。',
    '「第四面墙」你又看到了那行浮空的调试信息，然后它闪了一下消失了。',
    '「第四面墙」你盯着镜子看了很久，总觉得你的面部多边形有点少。',
    '「第四面墙」风吹过来的方向不对，好像有人把风场参数填反了。',
    '「第四面墙」路过的NPC第三次对你说了一模一样的台词。',
    '「第四面墙」你试着往地图边缘走，脚下的地面开始变得透明。',
    '「第四面墙」今天的日落持续了零点三秒就切换成了夜晚。',
  ]);
}

function storylineFlavor() {
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

    $('major-display').textContent = state.major || '未定';

    const slBox = $('storyline-box');
    if (state.storyline) {
      slBox.style.display = '';
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
  state.talentIds = new Set(state.talentsPicked.map(t => t.id));
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

  $('btn-start').addEventListener('click', () => {
    showScreen('talent-screen');
  });

  renderTalentSelect(talents);
  showScreen('start-screen');
}

main();
