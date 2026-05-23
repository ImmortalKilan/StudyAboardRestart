import { evalCondition, pickBranch, pickWeightedBranch } from './dsl.js';
import { renderAvatar, createStandaloneAvatar } from './avatar.js';
import { playStorylineIntro, playStorylineExit } from './cinematic.js';
import { initAchievements, unlockAchievement, setOnUnlock } from './achievements.js';
import { initFlowchart, openFlowchart, unlockFlowchartNode, setFlowchartSfx, resetSessionUnlocks, getSessionUnlocks } from './flowchart.js';
import * as SFX from './audio.js';
// Multiplayer — loaded dynamically so single-player works even if it fails
let mp = { enabled: false, connected: false, cards: [], opponent: {} };
let createRoom, joinRoom, mpSend, mpOn, mpDisconnect, resetMpState, REUNION_AGES, FATE_CARDS, initialFateCards, draftFrenemyCards, FRENEMY_CARD_POOL;
// MP VS comparison data
let _mpMyEndData = null;   // own final snapshot, set when game ends
let _mpOppEndData = null;  // opponent's final snapshot, received via game_end
let _allTalents = null;    // cached talents data for restart without reload

const STAT_KEYS = ['SOC', 'INT', 'MNY', 'PER', 'HLT', 'APP'];
const STAT_LABELS = {
  SOC: '社交', INT: '智力', MNY: '家境',
  HAP: '快乐', HLT: '健康', PER: '毅力', APP: '颜值',
  POP: '人气', POK: '牌技', MMR: '天梯分', FIT: '体能', CKL: '厨艺', ATH: '运动', MAG: '魔力',
  cul: '修为', dao: '大道', karma: '机缘', tribulation: '渡劫', realm: '境界'
};
const EFFECT_KEYS = new Set([...STAT_KEYS, 'HAP', 'POP', 'POK', 'MMR', 'FIT', 'CKL', 'ATH', 'MAG', 'HEAT', 'cul', 'dao', 'karma', 'tribulation', 'darkOmen', 'courage', 'alliance', 'knowledge']);
const XIANXIA_KEYS = ['realm', 'cul', 'dao', 'karma', 'tribulation'];

// ── Special Scoring Endings ──
const LEGENDARY_ENDINGS = new Set([
  50099, // Spy Success
  60040, // Abyss Success
  70040, 70094, // Meta Success / Madman
  82090, // CEO Peak
  83090, // Esports World Champion
  84061, // Fitness Legend
  85061, // Chef 3-Star
  81090, // Poker God
  86105, 86120, 86136, // Athlete Top Tier (NBA状元, World Cup Champion, Frisbee Worlds Champion)
  87190, // Thief Ghost Rating
  61611, // Hogwarts: defeated Voldemort with Elder Wand
  48190, 48191, // EE: 半导体教父, 芯片独角兽
  48290, 48291, // ME: 总工程师, 智造独角兽
  48390, 48391, // BIO: 新药教父, 生物医药独角兽
  48590, 48591, // MED: 科室主任, 新术式命名
  48790, 48791, // LAW: 管理合伙人, 首席大检察官
  48990, 48991, // Film: 金棕榈独立导演, 百亿票房商业导演
  42190, 42191, // CS: 大厂核心, 连续创业者
  43190,        // 商科: 投行精英/风投巨鳄
  44190,        // 理科: 全奖直博巅峰
  45191,        // 文科/文艺: 传世大家
  49990, 49991, 49992  // 音乐: 独立音乐人, 流行歌手, 作曲家
]);

const GOOD_ENDINGS = new Set([
  80105, // Idol Superstar
  82096, // Corporate Elite
  84091, // Fitness Influencer
  85091, 85092, // Chef 2-Star / 1-Star
  90050, 90052, 90054, 90056, // Late dropout good endings
  61612, 61613, // Hogwarts: defeated Voldemort (patronus / resurrection)
  48192, // EE: 转码逆袭
  48292, // ME: 转码逆袭
  48392, // BIO: 生信逆袭
  48592, // MED: 受人尊敬的主治
  48792, // LAW: 知名人权律师
  48992  // Film: 奥斯卡编剧
]);

function deriveRealm(cul) {
  cul = cul || 0;
  if (cul < 1) return '凡人';
  if (cul < 20) return `引气${'一二三四五六七八九'[Math.min(8, Math.floor((cul - 1) / 2))]}层`;
  if (cul < 60) return ['筑基初期', '筑基中期', '筑基后期', '筑基巅峰'][Math.min(3, Math.floor((cul - 20) / 10))];
  if (cul < 150) return `金丹${'一二三四五六七八九'[Math.min(8, Math.floor((cul - 60) / 10))]}层`;
  if (cul < 300) return `元婴${'一二三四五六七八九'[Math.min(8, Math.floor((cul - 150) / 17))]}层`;
  if (cul < 600) return '化神期';
  if (cul < 1000) return '渡劫期';
  if (cul < 1500) return '羽化境';
  return '仙人境';
}
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
    fitness: {
    gracePeriod: 12,
    eventRate: 0.8,
    deathChecks: [
      { cond: s => s.PER < 3, event: 84094 },
      { cond: s => s.MNY <= -4, event: 84095 },
    ],
    progressChecks: [
      { cond: s => s.HLT < 0 && s.FIT >= 10, event: 84093 },
    ],
    },
    chef: {
    gracePeriod: 12,
    eventRate: 0.8,
    deathChecks: [
      { cond: s => (s.HLT || 0) <= 0, event: 85080 },
      { cond: s => (s.HAP || 0) <= 0, event: 85081 },
      { cond: s => (s.SOC || 0) <= 0, event: 85095 },
    ],
    progressChecks: [],
    },
    athlete: {
    gracePeriod: 12,
    eventRate: 0.8,
    deathChecks: [
      { cond: s => (s.HLT || 0) <= 0, event: 86151 },
      { cond: s => (s.HAP || 0) <= 0, event: 86152 },
      { cond: s => (s.SOC || 0) <= 0, event: 86153 },
    ],
    progressChecks: [],
    },
    thief: {
    gracePeriod: 12,
    eventRate: 0.7,
    deathChecks: [
      { cond: s => (s.HLT || 0) <= 0, event: 87195 },
      { cond: s => (s.HAP || 0) <= -3, event: 87196 },
      { cond: s => (s.SOC || 0) <= -3, event: 87197 },
    ],
    progressChecks: [
      { cond: s => s.thief_stage === 'active' && s.age - s.storylineStart >= 3, event: 87100 },
    ],
    },
      idol: {    gracePeriod: 12,
    eventRate: 0.7,
    deathChecks: [
      { cond: s => s.HLT <= -2, event: 82021 },
    ],
    progressChecks: [],
  },
  party: {
    gracePeriod: 6,
    eventRate: 0.8,
    deathChecks: [
      { cond: s => s.HLT < 2 && Math.random() < 0.25, event: 82022 },
      { cond: s => s.HLT <= -3, event: 82021 },
      { cond: s => s.SOC <= -3, event: 82020 },
      { cond: s => s.MNY <= -3, event: 82091 },
    ],
    progressChecks: [],
    flavor: () => {
      const lines = ['你在组织下一场派对的细节。', '手机响个不停，全是派对邀请。', '你和朋友们在策划一个大活动。'];
      return lines[Math.floor(Math.random() * lines.length)];
    },
  },
  ceo: {
    gracePeriod: 12,
    eventRate: 0.7,
    deathChecks: [
      { cond: s => s.MNY <= -2, event: 82095 },
    ],
    progressChecks: [
      { cond: s => (s.age - s.storylineStart) >= 2 && s.SOC >= 30 && s.MNY >= 10, event: 82090 },
      { cond: s => (s.age - s.storylineStart) >= 2, event: 82096 },
    ],
  },
  poker: {
    gracePeriod: 12,
    eventRate: 0.7,
    deathChecks: [
      { cond: s => s.MNY <= -4, event: 81091 },
      { cond: s => (s.POK || 0) <= 0 && s.age - s.storylineStart >= 1, event: 81094 },
    ],
    progressChecks: [],
  },
  triton: {
    gracePeriod: 12,
    eventRate: 0.7,
    deathChecks: [
      { cond: s => s.POK < -4 || s.MNY <= -4, event: 81091 },
    ],
    progressChecks: [
      { cond: s => s.POK >= 30, event: () => Math.random() < 0.75 ? 81090 : 81092 },
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
      { cond: s => s.MMR >= 40 && s.PER >= 10 && !s.match_fixing, event: () => Math.random() < 0.7 ? 83090 : 83094 },
      { cond: s => s.age - s.storylineStart >= 1, event: 83093 },
    ],
  },
  minor_league: {
    gracePeriod: 12,
    eventRate: 0.7,
    progressChecks: [
      { cond: s => s.match_fixing, event: 83092 },
      { cond: s => s.monthTotal - (s.storylineStartMonth || 0) >= 36, event: 83094 },
    ],
  },
  idol: {
    gracePeriod: 12,
    eventRate: 0.7,
    progressChecks: [
      { cond: s => s.japan_path && s.jp_fluent && (s.POP || 0) >= 20 && s.age - s.storylineStart >= 4, event: 80105 },
    ],
  },
  superstar: {
    gracePeriod: 12,
    eventRate: 0.6,
    progressChecks: [
      { cond: s => s.POP >= 80, event: () => Math.random() < 0.7 ? 80090 : 80092 },
      { cond: s => s.INT < 4, event: 80091 },
      { cond: s => s.age - s.storylineStart >= 3, event: 80094 },
    ],
  },
  streamer: {
    gracePeriod: 12,
    eventRate: 0.6,
    progressChecks: [
      { cond: s => s.age - s.storylineStart >= 2 && s.POP >= 40, event: 80092 },
      { cond: s => s.age - s.storylineStart >= 2 && s.POP < 40, event: 80093 },
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
  xianxia: {
    gracePeriod: 0,
    eventRate: 0.55,
    progressChecks: [
      // 自动触发突破事件
      { cond: s => (s.cul || 0) >= 18 && !s.firedEvents.has(99019) && !s.firedEvents.has(99020), event: 99019 },
      { cond: s => (s.cul || 0) >= 55 && !s.firedEvents.has(99039) && !s.firedEvents.has(99040), event: 99039 },
      { cond: s => (s.cul || 0) >= 140 && !s.firedEvents.has(99061) && !s.firedEvents.has(99062), event: 99061 },
      { cond: s => (s.cul || 0) >= 290 && (s.dao || 0) >= 4 && !s.firedEvents.has(99079) && !s.firedEvents.has(99080), event: 99079 },
      { cond: s => (s.cul || 0) >= 580 && !s.firedEvents.has(99089), event: 99089 },
      // 40 岁仍未筑基 → 泯然众人
      { cond: s => s.age >= 40 && (s.cul || 0) < 18, event: 99305 },
    ],
    deathChecks: [],
    flavor: () => xianxiaFlavor(),
  },
  hogwarts: {
    gracePeriod: 24,
    eventRate: 0.6,
    progressChecks: [
      { cond: s => (s.hogwartsYear || 1) >= 7 && !s.firedEvents.has(61600) && (s.darkForces || 0) === 0, event: 61500 },
    ],
    deathChecks: [],
    flavor: () => hogwartsFlavor(),
  },
};

// ── Hogwarts flavor lines ──────────────────────────────────────
function hogwartsFlavor() {
  const lines = [
    '你在公共休息室里做着魔药学的论文，壁炉里的火焰跳跃不停。',
    '猫头鹰送来了家里的包裹，里面是一大盒自制曲奇。',
    '你在图书馆翻阅《高级魔药制作》，差点打翻旁边的墨水瓶。',
    '移动楼梯又变了方向，你在城堡里多走了二十分钟的冤枉路。',
    '差点被打人柳的枝条抽中，你及时跳开了。',
    '晚饭时南瓜汁喝了三杯，幽灵们在头顶飘来飘去。',
    '你在天文塔顶看星星，辨认着猎户座和天狼星的位置。',
    '草药学课上，你成功让曼德拉草安静下来了。',
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

// ── Idol stage clock (System D) ─────────────────────────────────
// Stages: 'training' (0-12 mo) → 'debut_window' (12-60 mo) → 'debuted'
// During debut_window, success probability decays 5% every 3 months past
// a 6-month grace, capped at -50%. Forced auto-attempt at month 60.
const IDOL_TRAINING_LEN = 12;
const IDOL_FORCE_LEN = 24;
const IDOL_DECAY_GRACE = 6;
const IDOL_DECAY_STEP = 3;
const IDOL_DECAY_AMT = 5;
const IDOL_DECAY_CAP = 50;
const IDOL_PROB_CAP = 75;
const IDOL_PROB_FLOOR = 5;

function initIdolStage() {
  state.idol_stage = 'training';
  state.debut_decay = 0;
  state.debut_attempted = false;
  state.debut_window_start_month = null;
}

function updateIdolStage() {
  if (state.storyline !== 'idol') return;
  if (state.idol_stage === undefined || state.idol_stage === null) initIdolStage();
  if (state.debut_attempted) return;
  const monthsIn = state.monthTotal - (state.storylineStartMonth || 0);
  if (state.idol_stage === 'training' && monthsIn >= IDOL_TRAINING_LEN) {
    state.idol_stage = 'debut_window';
    state.debut_window_start_month = state.monthTotal;
  }
  if (state.idol_stage === 'debut_window') {
    const inWindow = state.monthTotal - (state.debut_window_start_month || state.monthTotal);
    const decaySteps = Math.max(0, Math.floor((inWindow - IDOL_DECAY_GRACE) / IDOL_DECAY_STEP));
    state.debut_decay = Math.min(IDOL_DECAY_CAP, decaySteps * IDOL_DECAY_AMT);
    if (monthsIn >= IDOL_FORCE_LEN) attemptDebut(true);
  }
}

function computeDebutProb(s) {
  if (s.storyline !== 'idol') return 0;
  let p = -10;
  p += (s.POP || 0) * 1.8;
  p += (s.APP || 0) * 1.5;
  p += (s.PER || 0) * 0.8;
  if (s.japan_path) p += 6;
  if (s.jp_fluent) p += 4;
  if (s.kohaku) p += 8;
  if (s.scandal) p -= 20;
  p -= (s.debut_decay || 0);
  return Math.max(IDOL_PROB_FLOOR, Math.min(IDOL_PROB_CAP, Math.round(p)));
}

function attemptDebut(forced) {
  if (state.debut_attempted) return;
  state.debut_attempted = true;
  state.idol_stage = 'debuted';
  const prob = computeDebutProb(state);
  const success = Math.random() * 100 < prob;
  // mark legacy gate event as fired so its branch never auto-runs
  state.firedEvents.add(80040);
  const evId = success ? 80041 : 80042;
  const ev = state.eventsMap.get(evId);
  if (forced) {
    pushLog(success
      ? '事务所给出最后机会窗口，命运的骰子滚了一下——成了。'
      : '机会窗口悄悄关上了，没人再找你试镜。');
  }
  if (ev) applyEvent(ev);
  render();
}

// ── Party stage clock (mirror of idol) ──────────────────────────
// Stages: 'settling' (0-12 mo) → 'ceo_window' (12-60 mo) → 'exited'
const PARTY_SETTLE_LEN = 12;
const PARTY_FORCE_LEN = 24;
const PARTY_DECAY_GRACE = 6;
const PARTY_DECAY_STEP = 3;
const PARTY_DECAY_AMT = 5;
const PARTY_DECAY_CAP = 50;
const PARTY_PROB_CAP = 75;
const PARTY_PROB_FLOOR = 5;

function initPartyStage() {
  state.party_stage = 'settling';
  state.ceo_decay = 0;
  state.ceo_attempted = false;
  state.ceo_window_start_month = null;
}

function updatePartyStage() {
  if (state.storyline !== 'party') return;
  if (state.party_stage === undefined || state.party_stage === null) initPartyStage();
  if (state.ceo_attempted) return;
  const monthsIn = state.monthTotal - (state.storylineStartMonth || 0);
  if (state.party_stage === 'settling' && monthsIn >= PARTY_SETTLE_LEN) {
    state.party_stage = 'ceo_window';
    state.ceo_window_start_month = state.monthTotal;
  }
  if (state.party_stage === 'ceo_window') {
    const inWindow = state.monthTotal - (state.ceo_window_start_month || state.monthTotal);
    const decaySteps = Math.max(0, Math.floor((inWindow - PARTY_DECAY_GRACE) / PARTY_DECAY_STEP));
    state.ceo_decay = Math.min(PARTY_DECAY_CAP, decaySteps * PARTY_DECAY_AMT);
    if (monthsIn >= PARTY_FORCE_LEN) attemptCeo(true);
  }
}

function computeCeoProb(s) {
  if (s.storyline !== 'party') return 0;
  let p = -10;
  p += (s.SOC || 0) * 2.0;
  p += (s.MNY || 0) * 1.2;
  p += (s.INT || 0) * 0.8;
  if (s.party_clean) p += 8;
  if (s.party_dirty) p -= 10;
  if (s.academic_dishonesty) p -= 12;
  p -= (s.ceo_decay || 0);
  return Math.max(PARTY_PROB_FLOOR, Math.min(PARTY_PROB_CAP, Math.round(p)));
}

function attemptCeo(forced) {
  if (state.ceo_attempted) return;
  state.ceo_attempted = true;
  state.party_stage = 'exited';
  const prob = computeCeoProb(state);
  const success = Math.random() * 100 < prob;
  state.firedEvents.add(82040);
  const evId = success ? 82041 : 82042;
  const ev = state.eventsMap.get(evId);
  if (forced) {
    pushLog(success
      ? '送别派对的酒桌上，你拍板了——成立公司。'
      : '派对散场了，没人再叫你「局长」。');
  }
  if (ev) applyEvent(ev);
  render();
}

// ── Esports stage clock (mirror of idol/party) ──────────────────
// Stages: 'rookie' (0-12 mo) → 'qualifier_window' (12-60 mo) → 'qualified'
const ESPORTS_ROOKIE_LEN = 12;
const ESPORTS_FORCE_LEN = 24;
const ESPORTS_DECAY_GRACE = 6;
const ESPORTS_DECAY_STEP = 3;
const ESPORTS_DECAY_AMT = 5;
const ESPORTS_DECAY_CAP = 50;
const ESPORTS_PROB_CAP = 80;
const ESPORTS_PROB_FLOOR = 5;

function initEsportsStage() {
  state.esports_stage = 'rookie';
  state.qualifier_decay = 0;
  state.qualifier_attempted = false;
  state.qualifier_window_start_month = null;
}

// ── Fitness Stage Clock ──────────────────────────────────────────────
const FITNESS_PREP_LEN = 12;
const FITNESS_FORCE_LEN = 27;
const FITNESS_DECAY_GRACE = 3;
const FITNESS_DECAY_PER_MONTH = 1.5;
const FITNESS_DECAY_CAP = 15;

function initFitnessStage() {
  state.fitness_stage = 'prep';
  state.fitness_attempted = false;
  state.fitness_comp_window_start = 0;
  state.fitness_decay = 0;
}

function updateFitnessStage() {
  if (state.storyline !== 'fitness') return;
  if (state.fitness_stage === undefined || state.fitness_stage === null) initFitnessStage();
  if (state.fitness_attempted) return;
  const monthsIn = state.monthTotal - (state.storylineStartMonth || 0);
  if (state.fitness_stage === 'prep' && monthsIn >= FITNESS_PREP_LEN) {
    state.fitness_stage = 'comp_window';
    state.fitness_comp_window_start = state.monthTotal;
    state.fitness_decay = 0;
  }
  if (state.fitness_stage === 'comp_window') {
    const inWin = state.monthTotal - (state.fitness_comp_window_start || state.monthTotal);
    if (inWin > FITNESS_DECAY_GRACE) {
      state.fitness_decay = Math.min(FITNESS_DECAY_CAP,
        Math.round((inWin - FITNESS_DECAY_GRACE) * FITNESS_DECAY_PER_MONTH));
    }
  }
  const isRetry = (state.fitness_attempt_count || 0) >= 1;
  const forceLen = isRetry ? FITNESS_PREP_LEN : FITNESS_FORCE_LEN;
  if (state.fitness_stage === 'comp_window' && monthsIn >= forceLen) {
    attemptFitness(true);
  }
}

function computeFitnessProb(s) {
  if (s.storyline !== 'fitness') return 0;
  let p = -30;
  p += (s.FIT || 0) * 2;
  p += (s.PER || 0) * 1;
  p += (s.APP || 0) * 0.5;
  if (s.fitness_attempt_count >= 1) p += 10;
  p -= (s.fitness_decay || 0);
  return Math.max(5, Math.min(95, Math.round(p)));
}

async function attemptFitness(forced) {
  if (state.fitness_attempted) return;
  state.fitness_attempted = true; // 原子锁，防止重复触发

  state.pendingCinematic = true;
  state._cineSavedAuto = autoMode;
  stopAuto();
  render();

  await playStorylineIntro({
    name: "奥林匹亚总决赛",
    color: "#f1c40f",
    statLabels: STAT_LABELS,
    onDone: () => {
      state.fitness_stage = 'completed';
      state.fitness_attempt_count = (state.fitness_attempt_count || 0) + 1;
      const prob = computeFitnessProb(state);
      const success = Math.random() * 100 < prob;
      triggerEvent(84060); 
      setTimeout(() => {
        if (success) {
          triggerEvent(84061);
        } else {
          if (state.fitness_attempt_count >= 2) {
            triggerEvent(84065);
          } else {
            triggerEvent(84062);
          }
        }
        state.pendingCinematic = false;
        const saved = state._cineSavedAuto || 0;
        state._cineSavedAuto = 0;
        if (saved > 0) startAuto(saved);
        render();
      }, 800);
    }
  });
}// ── Chef Stage Clock ──────────────────────────────────────────────
const CHEF_STARTUP_LEN = 12;
const CHEF_FORCE_LEN = 27;
const CHEF_DECAY_GRACE = 3;
const CHEF_DECAY_PER_MONTH = 1.5;
const CHEF_DECAY_CAP = 15;

function initChefStage() {
  state.chef_stage = 'startup';
  state.chef_attempted = false;
  state.chef_comp_window_start = 0;
  state.chef_decay = 0;
}

function updateChefStage() {
  if (state.storyline !== 'chef') return;
  if (state.chef_stage === undefined || state.chef_stage === null) initChefStage();
  if (state.chef_attempted) return;
  const monthsIn = state.monthTotal - (state.storylineStartMonth || 0);
  if (state.chef_stage === 'startup' && monthsIn >= CHEF_STARTUP_LEN) {
    state.chef_stage = 'comp_window';
    state.chef_comp_window_start = state.monthTotal;
    state.chef_decay = 0;
  }
  if (state.chef_stage === 'comp_window') {
    const inWin = state.monthTotal - (state.chef_comp_window_start || state.monthTotal);
    if (inWin > CHEF_DECAY_GRACE) {
      state.chef_decay = Math.min(CHEF_DECAY_CAP,
        Math.round((inWin - CHEF_DECAY_GRACE) * CHEF_DECAY_PER_MONTH));
    }
  }
  if (state.chef_stage === 'comp_window' && monthsIn >= CHEF_FORCE_LEN) {
    attemptChef(true);
  }
}

function computeChefProb(s) {
  if (s.storyline !== 'chef') return 0;
  let p = -20;
  p += (s.CKL || 0) * 1.6;
  p += (s.SOC || 0) * 0.4;
  p += (s.PER || 0) * 0.4;
  p -= (s.chef_decay || 0);
  return Math.max(5, Math.min(95, Math.round(p)));
}

async function attemptChef(forced) {
  if (state.chef_attempted) return;
  state.chef_attempted = true;

  state.pendingCinematic = true;
  state._cineSavedAuto = autoMode;
  stopAuto();
  render();

  const prob = computeChefProb(state);
  const success = Math.random() * 100 < prob;
  state.chef_result = success ? 'success' : 'fail';
  state.chef_bonus = 0;

  await playStorylineIntro({
    name: "米其林星级审定",
    color: "#e74c3c",
    statLabels: STAT_LABELS,
    onDone: () => {
      state.chef_stage = 'completed';
      triggerEvent(85060);
      state.pendingCinematic = false;
      const saved = state._cineSavedAuto || 0;
      state._cineSavedAuto = 0;
      if (saved > 0) startAuto(saved);
      render();
    }
  });
}

function resolveChefFinal() {
  const bonus = (state.chef_bonus || 0) + (state.chef_bonus_extra || 0);
  if (state.chef_result === 'success') {
    const ckl = (state.CKL || 0) + bonus;
    triggerEvent(ckl >= 50 ? 85061 : ckl >= 40 ? 85091 : 85092);
  } else {
    triggerEvent(85062);
  }
}

// ── Athlete Stage Clock ──────────────────────────────────────────
const ATHLETE_STARTUP_LEN = 12;
const ATHLETE_FORCE_LEN = 27;
const ATHLETE_DECAY_GRACE = 3;
const ATHLETE_DECAY_PER_MONTH = 1.5;
const ATHLETE_DECAY_CAP = 15;

function initAthleteStage() {
  state.athlete_stage = 'startup';
  state.athlete_attempted = false;
  state.athlete_comp_window_start = 0;
  state.athlete_decay = 0;
}

function updateAthleteStage() {
  if (state.storyline !== 'athlete') return;
  if (state.athlete_stage === undefined || state.athlete_stage === null) initAthleteStage();
  if (state.athlete_attempted) return;
  const monthsIn = state.monthTotal - (state.storylineStartMonth || 0);
  if (state.athlete_stage === 'startup' && monthsIn >= ATHLETE_STARTUP_LEN) {
    state.athlete_stage = 'comp_window';
    state.athlete_comp_window_start = state.monthTotal;
    state.athlete_decay = 0;
  }
  if (state.athlete_stage === 'comp_window') {
    const inWin = state.monthTotal - (state.athlete_comp_window_start || state.monthTotal);
    if (inWin > ATHLETE_DECAY_GRACE) {
      state.athlete_decay = Math.min(ATHLETE_DECAY_CAP,
        Math.round((inWin - ATHLETE_DECAY_GRACE) * ATHLETE_DECAY_PER_MONTH));
    }
  }
  if (state.athlete_stage === 'comp_window' && monthsIn >= ATHLETE_FORCE_LEN) {
    attemptAthlete(true);
  }
}

function updateHogwartsYear() {
  if (state.storyline !== 'hogwarts') return;
  const monthsIn = (state.monthTotal || 0) - (state.storylineStartMonth || 0);
  const year = Math.min(7, Math.floor(monthsIn / 12) + 1);
  if (year > (state.hogwartsYear || 1)) {
    state.hogwartsYear = year;
  }
}

function computeAthleteProb(s) {
  if (s.storyline !== 'athlete') return 0;
  let p = -15;
  p += (s.ATH || 0) * 2;
  p += (s.PER || 0) * 0.5;
  p += (s.HLT || 0) * 0.5;
  p -= (s.athlete_decay || 0);
  return Math.max(5, Math.min(95, Math.round(p)));
}

const SPORT_LABELS = { basketball: 'NBA选秀', soccer: '世界杯预选赛', frisbee: '飞盘世锦赛' };

function finishAthleteCompetition() {
  state.pendingCinematic = false;
  const saved = state._cineSavedAuto || 0;
  state._cineSavedAuto = 0;
  if (saved > 0) startAuto(saved);
  render();
}

function runNBADraft() {
  triggerEvent(86102);
  setTimeout(() => {
    triggerEvent(86103);
    setTimeout(() => {
      triggerEvent(86104);
      setTimeout(() => {
        const ath = state.ATH || 0;
        let probs;
        if (ath >= 40)      probs = [8, 12, 15, 30, 25, 10, 0];
        else if (ath >= 30) probs = [0, 3, 7, 25, 35, 30, 0];
        else if (ath >= 22) probs = [0, 0, 0, 5, 25, 60, 10];
        else                probs = [0, 0, 0, 0, 5, 45, 50];
        const events = [86105, 86106, 86107, 86108, 86109, 86110, 86111];
        const roll = Math.random() * 100;
        let cum = 0;
        let result = events[events.length - 1];
        for (let i = 0; i < probs.length; i++) {
          cum += probs[i];
          if (roll < cum) { result = events[i]; break; }
        }
        triggerEvent(result);
        finishAthleteCompetition();
      }, 800);
    }, 800);
  }, 800);
}

function runWorldCup() {
  const rounds = [
    { win: 86112, lose: 86113, penalty: 0 },
    { win: 86114, lose: 86115, penalty: 5 },
    { win: 86116, lose: 86117, penalty: 10 },
    { win: 86118, lose: 86119, penalty: 15 },
  ];
  function playRound(i) {
    if (i >= rounds.length) {
      const wp = Math.max(20, Math.min(85, 30 + (state.ATH || 0) * 1.2 - 20));
      triggerEvent(Math.random() * 100 < wp ? 86120 : 86121);
      finishAthleteCompetition();
      return;
    }
    const r = rounds[i];
    const wp = Math.max(20, Math.min(85, 30 + (state.ATH || 0) * 1.2 - r.penalty));
    const won = Math.random() * 100 < wp;
    triggerEvent(won ? r.win : r.lose);
    if (!won) { finishAthleteCompetition(); return; }
    setTimeout(() => playRound(i + 1), 800);
  }
  playRound(0);
}

function runFrisbeeWorlds() {
  const rounds = [
    { win: 86130, lose: 86131, penalty: 0 },
    { win: 86132, lose: 86133, penalty: 5 },
    { win: 86134, lose: 86135, penalty: 10 },
  ];
  function playRound(i) {
    if (i >= rounds.length) {
      const wp = Math.max(20, Math.min(85, 30 + (state.ATH || 0) * 1.2 - 15));
      triggerEvent(Math.random() * 100 < wp ? 86136 : 86137);
      finishAthleteCompetition();
      return;
    }
    const r = rounds[i];
    const wp = Math.max(20, Math.min(85, 30 + (state.ATH || 0) * 1.2 - r.penalty));
    const won = Math.random() * 100 < wp;
    triggerEvent(won ? r.win : r.lose);
    if (!won) { finishAthleteCompetition(); return; }
    setTimeout(() => playRound(i + 1), 800);
  }
  playRound(0);
}

async function attemptAthlete(forced) {
  if (state.athlete_attempted) return;
  state.athlete_attempted = true;

  state.pendingCinematic = true;
  state._cineSavedAuto = autoMode;
  stopAuto();
  render();

  const sport = state.sport_type || 'basketball';
  await playStorylineIntro({
    name: SPORT_LABELS[sport] || '职业选拔',
    color: "#2ecc71",
    statLabels: STAT_LABELS,
    onDone: () => {
      state.athlete_stage = 'completed';
      const prob = computeAthleteProb(state);
      const success = Math.random() * 100 < prob;
      triggerEvent(86100);
      setTimeout(() => {
        if (success) {
          if (sport === 'basketball') runNBADraft();
          else if (sport === 'soccer') runWorldCup();
          else runFrisbeeWorlds();
        } else {
          const s = state;
          if ((s.MNY || 0) >= 25) triggerEvent(86140);
          else if ((s.SOC || 0) >= 15) triggerEvent(86141);
          else if ((s.INT || 0) >= 15) triggerEvent(86142);
          else triggerEvent(86143);
          finishAthleteCompetition();
        }
      }, 800);
    }
  });
}

function updateEsportsStage() {
  if (state.storyline !== 'esports') return;
  if (state.esports_stage === undefined || state.esports_stage === null) initEsportsStage();
  if (state.qualifier_attempted) return;
  const monthsIn = state.monthTotal - (state.storylineStartMonth || 0);
  if (state.esports_stage === 'rookie' && monthsIn >= ESPORTS_ROOKIE_LEN) {
    state.esports_stage = 'qualifier_window';
    state.qualifier_window_start_month = state.monthTotal;
  }
  if (state.esports_stage === 'qualifier_window') {
    const inWindow = state.monthTotal - (state.qualifier_window_start_month || state.monthTotal);
    const decaySteps = Math.max(0, Math.floor((inWindow - ESPORTS_DECAY_GRACE) / ESPORTS_DECAY_STEP));
    state.qualifier_decay = Math.min(ESPORTS_DECAY_CAP, decaySteps * ESPORTS_DECAY_AMT);
    if (monthsIn >= ESPORTS_FORCE_LEN) attemptQualifier(true);
  }
}

function computeQualifierProb(s) {
  if (s.storyline !== 'esports') return 0;
  let p = -10;
  p += (s.MMR || 0) * 1.5;
  p += (s.PER || 0) * 1.0;
  p += (s.INT || 0) * 0.5;
  p -= (s.qualifier_decay || 0);
  return Math.max(ESPORTS_PROB_FLOOR, Math.min(ESPORTS_PROB_CAP, Math.round(p)));
}

function attemptQualifier(forced) {
  if (state.qualifier_attempted) return;
  state.qualifier_attempted = true;
  state.esports_stage = 'qualified';
  const prob = computeQualifierProb(state);
  const success = Math.random() * 100 < prob;
  state.firedEvents.add(83040);
  const evId = success ? 83041 : 83042;
  const ev = state.eventsMap.get(evId);
  if (forced) {
    pushLog(success
      ? '常规赛打到最后一刻——你们挤进了世界赛门票名单。'
      : '常规赛收官，名次卡在升降机里，没人再叫你们顶级队伍。');
  }
  if (ev) applyEvent(ev);
  render();
}

// ── Poker stage clock (mirror of esports) ──────────────────────
// Stages: 'rookie' (0-12 mo) → 'triton_window' (12-60 mo) → 'attempted'
const POKER_ROOKIE_LEN = 12;
const POKER_FORCE_LEN = 24;
const POKER_DECAY_GRACE = 6;
const POKER_DECAY_STEP = 3;
const POKER_DECAY_AMT = 5;
const POKER_DECAY_CAP = 50;
const POKER_PROB_CAP = 80;
const POKER_PROB_FLOOR = 5;

function initPokerStage() {
  state.poker_stage = 'rookie';
  state.triton_decay = 0;
  state.triton_attempted = false;
  state.triton_window_start_month = null;
}

function updatePokerStage() {
  if (state.storyline !== 'poker') return;
  if (state.poker_stage === undefined || state.poker_stage === null) initPokerStage();
  if (state.triton_attempted) return;
  const monthsIn = state.monthTotal - (state.storylineStartMonth || 0);
  if (state.poker_stage === 'rookie' && monthsIn >= POKER_ROOKIE_LEN) {
    state.poker_stage = 'triton_window';
    state.triton_window_start_month = state.monthTotal;
  }
  if (state.poker_stage === 'triton_window') {
    const inWindow = state.monthTotal - (state.triton_window_start_month || state.monthTotal);
    const decaySteps = Math.max(0, Math.floor((inWindow - POKER_DECAY_GRACE) / POKER_DECAY_STEP));
    state.triton_decay = Math.min(POKER_DECAY_CAP, decaySteps * POKER_DECAY_AMT);
    if (monthsIn >= POKER_FORCE_LEN) attemptTriton(true);
  }
}

function computeTritonProb(s) {
  if (s.storyline !== 'poker') return 0;
  let p = -10;
  p += (s.POK || 0) * 1.5;
  p += (s.INT || 0) * 0.8;
  p += (s.MNY || 0) * 0.6;
  p -= (s.triton_decay || 0);
  return Math.max(POKER_PROB_FLOOR, Math.min(POKER_PROB_CAP, Math.round(p)));
}

function attemptTriton(forced) {
  if (state.triton_attempted) return;
  state.triton_attempted = true;
  state.poker_stage = 'attempted';
  const prob = computeTritonProb(state);
  const success = Math.random() * 100 < prob;
  state.firedEvents.add(81040);
  const evId = success ? 81041 : 81042;
  const ev = state.eventsMap.get(evId);
  if (forced) {
    pushLog(success
      ? '高客锦标赛打到决胜桌——你撕下了职业赛圈的入场券。'
      : '资格赛泡沫期被河杀淘汰，顶级牌桌的门在你面前关上了。');
  }
  if (ev) applyEvent(ev);
  render();
}

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
  xianxia: '修真求道',
  fitness: '健美巅峰',
  chef: '校园厨神',
  athlete: '校队之星',
  thief: '影子协会',
  hogwarts: '霍格沃茨',
};
const HIDDEN_STORYLINES = new Set(['spy', 'abyss', 'meta', 'xianxia', 'thief', 'hogwarts']);
const SPECIAL_STORYLINES = new Set(['idol', 'superstar', 'streamer', 'poker', 'triton', 'local_shark', 'party', 'ceo', 'wasted', 'esports', 'worlds', 'minor_league', 'fitness', 'chef', 'athlete']);
const STORYLINE_UNLOCK_STAT = {
  idol: 'POP', superstar: 'POP', streamer: 'POP',
  poker: 'POK', triton: 'POK', local_shark: 'POK',
  esports: 'MMR', worlds: 'MMR', minor_league: 'MMR',
  fitness: 'FIT',
  chef: 'CKL',
  athlete: 'ATH',
  hogwarts: 'MAG',
};
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
  country: '',
  countryIntent: '',
  schoolTier: '',
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
  cul: 0, dao: 0, karma: 0, tribulation: 0,
  xianxiaSeed: 0, yuanshen_book: 0, xingchen_book: 0,
  MAG: 0, hogwartsYear: 0, housePt: 0, house: '', hasOwl: 0, hogwartsSeed: 0,

  // Summary tracking
  statPeaks: {},
  storylinesVisited: new Set(),
  choiceHistory: [],
};

let autoTimer = null;
let autoMode = 0;
let sessionPlayCount = 0;

async function loadData() {
  const [talents, events, ages, randomEvents, xianxiaEvents, hogwartsEvents, mpEvents] = await Promise.all([
    fetch('data/talents.json').then(r => r.json()),
    fetch('data/events.json').then(r => r.json()),
    fetch('data/ages.json').then(r => r.json()),
    fetch('data/random_events.json').then(r => r.json()),
    fetch('data/xianxia_events.json').then(r => r.json()).catch(() => []),
    fetch('data/hogwarts_events.json').then(r => r.json()).catch(() => []),
    fetch('data/multiplayer_events.json').then(r => r.json()).catch(() => [])
  ]);
  state.eventsMap = new Map(events.map(e => [e.id, e]));
  state.agesMap = ages;
  state.randomEvents = randomEvents.concat(xianxiaEvents).concat(hogwartsEvents);
  // Also index random events into eventsMap for branch lookups
  for (const re of state.randomEvents) state.eventsMap.set(re.id, re);
  // Index mp events but DON'T put them in random pool (they're triggered explicitly)
  const realMpEvents = mpEvents.filter(e => typeof e.id === 'number');
  for (const re of realMpEvents) state.eventsMap.set(re.id, re);
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
    if (r < 2) return 3;   // orange
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
  const trackKeys = ['SOC', 'INT', 'MNY', 'HAP', 'HLT', 'PER', 'APP', 'POP', 'POK', 'MMR', 'FIT', 'CKL', 'cul', 'dao', 'karma', 'tribulation'];
  for (const k of trackKeys) {
    const v = state[k] || 0;
    if (state.statPeaks[k] === undefined || v > state.statPeaks[k]) state.statPeaks[k] = v;
  }
  if (state.storyline) state.storylinesVisited.add(state.storyline);

  // Achievement: any base stat hits 10
  if (STAT_KEYS.some(k => (state[k] || 0) >= 10)) unlockAchievement('stat_max');
  // Achievement: any base stat goes negative
  if (STAT_KEYS.some(k => (state[k] || 0) < 0)) unlockAchievement('stat_negative');
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
    ? [['理科', 30], ['文科', 30], ['MED', 20], ['法学', 20]]
    : [['CS', 10], ['商科', 10], ['文艺', 10], ['EE', 10], ['ME', 10], ['BIO', 10], ['MED', 10], ['法学', 10], ['电影', 10], ['音乐', 10]];
  for (const opt of options) {
    if (opt[0] === 'CS' && state.INT >= 6) opt[1] += 15;
    if (opt[0] === '商科' && state.MNY >= 6) opt[1] += 15;
    if (opt[0] === '文艺' && (state.APP >= 5 || state.SOC >= 6)) opt[1] += 10;
    if (opt[0] === '理科' && state.INT >= 6) opt[1] += 15;
    if (opt[0] === '文科' && state.SOC >= 6) opt[1] += 10;
    if (opt[0] === 'EE' && state.INT >= 6) opt[1] += 15;
    if (opt[0] === 'ME' && state.INT >= 5 && state.PER >= 5) opt[1] += 15;
    if (opt[0] === 'BIO' && state.INT >= 6) opt[1] += 15;
    if (opt[0] === 'MED' && state.INT >= 7 && state.PER >= 6) opt[1] += 15;
    if (opt[0] === '法学' && state.INT >= 6 && state.SOC >= 5) opt[1] += 15;
    if (opt[0] === '电影' && state.APP >= 5) opt[1] += 10;
    if (opt[0] === '音乐' && (state.APP >= 5 || state.PER >= 6)) opt[1] += 10;
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

function probTone(p) {
  if (p >= 60) return 'good';
  if (p >= 30) return 'warn';
  return 'bad';
}

function showConfirm({ title, body, stats, okText, cancelText }) {
  return new Promise(resolve => {
    const mask = $('confirm-modal');
    const titleEl = $('confirm-title');
    const bodyEl = $('confirm-body');
    const statsEl = $('confirm-stats');
    const okBtn = $('confirm-ok');
    const cancelBtn = $('confirm-cancel');
    if (!mask) { resolve(window.confirm(body || title || '')); return; }
    SFX.sfxModalOpen();
    titleEl.textContent = title || '确认';
    bodyEl.textContent = body || '';
    statsEl.innerHTML = '';
    if (Array.isArray(stats)) {
      stats.forEach(s => {
        const row = document.createElement('div');
        row.className = 'modal-stat';
        const lab = document.createElement('span');
        lab.className = 'modal-stat-label';
        lab.textContent = s.label + '：';
        const val = document.createElement('span');
        val.className = 'modal-stat-value' + (s.tone ? ' ' + s.tone : '');
        val.textContent = s.value;
        row.appendChild(lab);
        row.appendChild(val);
        statsEl.appendChild(row);
      });
    }
    okBtn.textContent = okText || '确定';
    cancelBtn.textContent = cancelText || '取消';
    mask.style.display = '';

    const cleanup = (result) => {
      mask.style.display = 'none';
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      mask.removeEventListener('click', onMaskClick);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const onOk = () => { SFX.sfxModalConfirm(); cleanup(true); };
    const onCancel = () => { SFX.sfxModalClose(); cleanup(false); };
    const onMaskClick = (e) => { if (e.target === mask) cleanup(false); };
    const onKey = (e) => {
      if (e.key === 'Escape') cleanup(false);
      else if (e.key === 'Enter') cleanup(true);
    };
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    mask.addEventListener('click', onMaskClick);
    document.addEventListener('keydown', onKey);
    setTimeout(() => okBtn.focus(), 0);
  });
}

function triggerEvent(id) {
  const ev = state.eventsMap.get(id);
  if (ev) applyEvent(ev);
}

function applyEvent(ev) {
  // Storyline replay: only show text, skip all side effects
  if (ev._replay) {
    delete ev._replay;
    const _raw = ev.text || ev.event;
    const msg = Array.isArray(_raw) ? _raw[Math.floor(Math.random() * _raw.length)] : _raw;
    if (msg) pushLog(msg);
    return;
  }

  if (!ev.repeatable) state.firedEvents.add(ev.id);

  const prevStorylineForCinematic = state.storyline;

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
      if (ev.set.storyline === 'idol') initIdolStage();
      if (ev.set.storyline === 'party') initPartyStage();
      if (ev.set.storyline === 'esports') initEsportsStage();
      if (ev.set.storyline === 'poker') initPokerStage();
      if (ev.set.storyline === 'fitness') initFitnessStage();
      if (ev.set.storyline === 'chef') initChefStage();
      if (ev.set.storyline === 'athlete') initAthleteStage();
    }
    if (ev.set.profession && GRAD_SCHOOL_PHASES.has(ev.set.profession)) {
      scheduleGraduateCompletion();
    }

    // ── Milestone tracking (for MP VS timeline) ──
    if (state.milestones) {
      const ms = { age: state.age, month: state.monthOfYear };
      if (ev.set.school && ev.set.school !== '无' && ev.set.school !== prevRel) {
        state.milestones.push({ ...ms, type: 'school', text: `考入${ev.set.school}` });
      }
      if (ev.set.overseas === 1) {
        state.milestones.push({ ...ms, type: 'overseas', text: `出国留学（${ev.set.country || state.country || ''}）` });
      }
      if (ev.set.major && ev.set.major !== state.major) {
        state.milestones.push({ ...ms, type: 'major', text: `选择${ev.set.major}专业` });
      }
      if (ev.set.storyline && ev.set.storyline !== prevStoryline && ev.set.storyline !== '') {
        const slName = STORYLINE_NAMES[ev.set.storyline] || ev.set.storyline;
        state.milestones.push({ ...ms, type: 'storyline', text: `进入【${slName}】剧情` });
      }
      if (ev.set.relationship !== undefined && ev.set.relationship !== prevRel) {
        state.milestones.push({ ...ms, type: 'relationship', text: `恋爱状态→${ev.set.relationship}` });
      }
    }
  }

  // Ending milestone
  if (ev.end && state.milestones) {
    const endText = (ev.text || ev.event || '').slice(0, 20);
    state.milestones.push({ age: state.age, month: state.monthOfYear, type: 'ending', text: `结局：${endText}…` });
  }

  const _rawMsg = ev.text || ev.event;
  const msg = Array.isArray(_rawMsg) ? _rawMsg[Math.floor(Math.random() * _rawMsg.length)] : _rawMsg;
  let evLogType = ev.logType
    || (ev.romance ? 'romance' : undefined)
    || (ev.include && (/MAJOR==/.test(ev.include) || /profession==/.test(ev.include)) ? 'major' : undefined);
  // Any event with ev.end always gets the ending style (overrides storyline color)
  if (ev.end) evLogType = 'ending';
  // Non-terminal storyline exit: storyline cleared but life continues
  const isStorylineExit = ev.set && ev.set.storyline === ''
    && prevStorylineForCinematic && !ev.end;
  if (isStorylineExit) {
    evLogType = 'storyline-exit';
    const statToHide = STORYLINE_UNLOCK_STAT[prevStorylineForCinematic];
    if (statToHide) state['show' + statToHide] = false;
    
    // Reset profession to generic age-based fallback when abandoning a special career
    if (state.age >= 23) {
      state.late_dropout = true;
      state.profession = '待业中';
    } else {
      for (const row of DEFAULT_PROF_BY_AGE) {
        if (state.age <= row.max) {
          state.profession = row.prof;
          break;
        }
      }
    }
  }
  if (msg) pushLog(msg, evLogType);

  // Snapshot stats before applying effects (for change animation)
  const _preFx = {};
  for (const k of STAT_KEYS) _preFx[k] = state[k] || 0;
  _preFx.HAP = state.HAP || 0;

  if (ev.effect) for (const [k, v] of Object.entries(ev.effect)) {
    if (EFFECT_KEYS.has(k)) state[k] = (state[k] || 0) + v;
  }
  if (typeof ev.happyDelta === 'number') state.HAP += ev.happyDelta;

  clampStats();

  // Track which stats changed for render animation
  state._statChanges = {};
  let _hasUp = false, _hasDown = false;
  for (const k of [...STAT_KEYS, 'HAP']) {
    const delta = (state[k] || 0) - (_preFx[k] || 0);
    if (delta !== 0) { state._statChanges[k] = delta; if (delta > 0) _hasUp = true; else _hasDown = true; }
  }
  if (_hasUp && !_hasDown) SFX.sfxStatUp();
  else if (_hasDown && !_hasUp) SFX.sfxStatDown();

  if (ev.end) {
    state.phase = 'ended';
    state.endingId = ev.id;
    state.endingAge = state.age;
    SFX.sfxGameEnd();
    // Clean up any pending MP reunion state
    if (mp._reunionTimeout) { clearTimeout(mp._reunionTimeout); mp._reunionTimeout = null; }
    mp.isWaiting = false;
    _hideWaitingOverlay();
  }

  // Cinematic intro when entering a special/hidden storyline
  if (ev.set && ev.set.storyline && ev.set.storyline !== prevStorylineForCinematic
      && (HIDDEN_STORYLINES.has(ev.set.storyline) || SPECIAL_STORYLINES.has(ev.set.storyline))) {
    SFX.sfxKeyEvent();
    state.pendingCinematic = true;
    state._cineSavedAuto = autoMode;
    stopAuto();
    render();
    const isHidden = HIDDEN_STORYLINES.has(state.storyline);
    const newStat = STORYLINE_UNLOCK_STAT[state.storyline];
    const prevStat = STORYLINE_UNLOCK_STAT[prevStorylineForCinematic];
    playStorylineIntro({
      name: STORYLINE_NAMES[state.storyline] || state.storyline,
      color: state.storyline === 'hogwarts' ? '#9B59B6' : (isHidden ? '#ff5252' : '#d4af37'),
      unlockStat: (newStat && newStat !== prevStat) ? newStat : null,
      statLabels: STAT_LABELS,
      onDone: () => {
        state.pendingCinematic = false;
        const saved = state._cineSavedAuto || 0;
        state._cineSavedAuto = 0;
        if (saved > 0) startAuto(saved);
      }
    });
  }

  // Cinematic exit when leaving a special/hidden storyline
  if (isStorylineExit) {
    state.pendingCinematic = true;
    state._cineSavedAuto = autoMode;
    stopAuto();
    render();
    const statToHide = STORYLINE_UNLOCK_STAT[prevStorylineForCinematic];
    playStorylineExit({
      name: STORYLINE_NAMES[prevStorylineForCinematic] || prevStorylineForCinematic,
      color: '#aaa',
      hideStat: statToHide,
      statLabels: STAT_LABELS,
      onDone: () => {
        state.pendingCinematic = false;
        const saved = state._cineSavedAuto || 0;
        state._cineSavedAuto = 0;
        if (saved > 0) startAuto(saved);
        render();
      }
    });
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

  if (ev.id === 85069) {
    resolveChefFinal();
  }

  // ── Achievement triggers ──────────────────────────────────────────────────
  _checkEventAchievements(ev);
}

function _checkEventAchievements(ev) {
  // Romance events
  if (ev.romance) unlockAchievement('romance_first');

  if (ev.set) {
    const rel = ev.set.relationship;
    if (rel === '已婚' || rel === '二婚') unlockAchievement('romance_married');
    if (rel === '海王' || rel === '海后') unlockAchievement('romance_sea_king');
    if (rel === '离异') unlockAchievement('romance_divorced');

    // Storyline entry
    const sl = ev.set.storyline;
    if (sl) {
      const SL_MAP = {
        spy: 'sl_spy', xianxia: 'sl_xianxia', abyss: 'sl_abyss', meta: 'sl_meta',
        idol: 'sl_idol', superstar: 'sl_superstar', streamer: 'sl_streamer',
        party: 'sl_party', wasted: 'sl_wasted', poker: 'sl_poker',
        esports: 'sl_esports', worlds: 'sl_worlds',
        fitness: 'sl_fitness', chef: 'sl_chef', athlete: 'sl_athlete',
        thief: 'sl_thief', hogwarts: 'sl_hogwarts',
      };
      if (SL_MAP[sl]) unlockAchievement(SL_MAP[sl]);
    }

    // School milestones
    const school = ev.set.school;
    const tier = ev.set.schoolTier;
    if (tier === 'top' || school === 'T20') unlockAchievement('school_t20');
    if (school === '遣返' || school === '退学') unlockAchievement('school_expelled');

    // ── Flowchart node unlocks (non-achievement triggers) ──
    const hsType = ev.set.hsType;
    if (hsType === '国际') unlockFlowchartNode('n_hs_intl');
    if (hsType === '体制内') unlockFlowchartNode('n_hs_normal');

    const country = ev.set.country;
    const COUNTRY_NODE = { '美国': 'n_us', '英国': 'n_uk', '澳洲': 'n_au', '欧洲': 'n_eu', '香港': 'n_hk', '日本': 'n_jp', '新加坡': 'n_sg' };
    if (country && COUNTRY_NODE[country]) unlockFlowchartNode(COUNTRY_NODE[country]);

    if (tier === 'mid') unlockFlowchartNode('n_mid');
    if (tier === 'low') unlockFlowchartNode('n_low');
  }

  // Specific event IDs for outcomes
  const id = ev.id;
  if (id === 80041) unlockAchievement('end_idol');          // idol debut success
  if (id === 80042) unlockAchievement('debut_fail');        // idol debut failure
  if (id === 50099) unlockAchievement('end_spy');           // spy mission success
  if (id === 60040) unlockAchievement('end_abyss');         // abyss storyline success
  if (id === 70040) unlockAchievement('end_meta');          // meta storyline success
  if (id === 82041 || id === 82090) unlockAchievement('end_ceo');   // CEO success
  if (id === 83090 || id === 83094) unlockAchievement('end_worlds'); // worlds win

  if (id === 84061) unlockAchievement('end_fitness');        // fitness legend
  if (id === 85061) unlockAchievement('end_chef');           // chef 3-star
  if (id === 86105 || id === 86120 || id === 86136) unlockAchievement('end_athlete'); // athlete top tier
  if (id === 87190) unlockAchievement('end_thief');          // thief ghost rating
  if (id === 61611) unlockAchievement('end_hogwarts');       // defeated Voldemort with Elder Wand

  // Major career legendary endings
  if (id === 48190 || id === 48191) unlockAchievement('end_ee');    // EE: 半导体教父 / 芯片独角兽
  if (id === 48290 || id === 48291) unlockAchievement('end_me');    // ME: 总工程师 / 智造独角兽
  if (id === 48390 || id === 48391) unlockAchievement('end_bio');   // BIO: 新药教父 / 生物医药独角兽
  if (id === 48590 || id === 48591) unlockAchievement('end_med');   // MED: 科室主任 / 新术式命名
  if (id === 48790 || id === 48791) unlockAchievement('end_law');   // LAW: 管理合伙人 / 首席大检察官
  if (id === 48990 || id === 48991) unlockAchievement('end_film');  // Film: 金棕榈 / 百亿票房
  if (id === 42190 || id === 42191) unlockAchievement('end_cs');    // CS: 大厂核心 / 连续创业者
  if (id === 43190) unlockAchievement('end_biz');                   // 商科: 投行精英/风投巨鳄
  if (id === 44190) unlockAchievement('end_sci');                   // 理科: 全奖直博巅峰
  if (id === 45191) unlockAchievement('end_art');                   // 文科/文艺: 传世大家
  if (id === 49990 || id === 49991 || id === 49992) unlockAchievement('end_music'); // 音乐: 传奇

  // Xianxia immortal ending: any game-end while in xianxia with high cul
  if (ev.end && state.storyline === 'xianxia' && (state.cul || 0) >= 1000) {
    unlockAchievement('end_xianxia');
  }

  // Easter egg combo achievements
  if (id === 49640) unlockAchievement('easter_rhythm');
  if (id === 49641) unlockAchievement('easter_viral');
  if (id === 49642) unlockAchievement('easter_novelist');
  if (id === 49643) unlockAchievement('easter_coral');
  if (id === 49644) unlockAchievement('easter_synth');
  if (id === 49645) unlockAchievement('easter_medtech');
  if (id === 49646) unlockAchievement('easter_courtroom');
  if (id === 49647) unlockAchievement('easter_nomad');
}

function _parseRequireHint(expr) {
  // Parse simple stat conditions like (INT>=6)&(SOC>=4) into readable hints
  const HINT_LABELS = { ...STAT_LABELS, IQ: '智力', STR: '毅力', HEA: '健康' };
  const parts = [];
  const re = /(\w+)\s*(>=|>|<=|<|==|!=)\s*(\d+)/g;
  let m;
  while ((m = re.exec(expr)) !== null) {
    const [, key, op, val] = m;
    const label = HINT_LABELS[key];
    if (!label) continue;
    const cur = state[key] || 0;
    if (op === '>=' || op === '>') {
      parts.push(`${label}≥${val}（当前${cur}）`);
    } else if (op === '<=' || op === '<') {
      parts.push(`${label}≤${val}（当前${cur}）`);
    } else if (op === '==' || op === '!=') {
      parts.push(`${label}=${val}`);
    }
  }
  return parts.length > 0 ? '需要 ' + parts.join('，') : '条件不满足';
}

function pushLog(text, typeOverride) {
  const tag = `${state.age}岁${state.monthOfYear}月`;
  let logType = typeOverride || '';
  if (!logType && state.storyline) {
    if (state.storyline === 'hogwarts') logType = 'hogwarts';
    else logType = HIDDEN_STORYLINES.has(state.storyline) ? 'hidden' : 'special';
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
    .filter(ev => !ev.exclude || !evalCondition(state, ev.exclude))
    .filter(ev => {
      if (!ev.stage || ev.stage === '*') return true;
      if (state.storyline === 'idol') return ev.stage === state.idol_stage;
      if (state.storyline === 'party') return ev.stage === state.party_stage;
      return true;
    });
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
        .filter(ev => !ev.exclude || !evalCondition(state, ev.exclude))
        .filter(ev => {
          if (!ev.stage || ev.stage === '*') return true;
          if (state.storyline === 'idol') return ev.stage === state.idol_stage;
          if (state.storyline === 'party') return ev.stage === state.party_stage;
          return true;
        });
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
  const romanceImmune = state.talentIds && state.talentIds.has(3036);
  const weights = pool.map(ev => {
    let w = ev.weight ?? 1;
    if (majorKey && ev.include && ev.include.includes(majorKey)) w *= 2;
    // System A: damp choice events so flavor dominates
    if (ev.choices && ev.choices.length > 0) w *= 0.5;
    if (romanceImmune && ev.romance) w *= 0.5;
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
  SFX.sfxChoice();
  const choice = state.pendingChoice[index];
  const allOptions = state.pendingChoice.map(c => c.title || c.text || '?');
  const chosenText = choice.title || choice.text || '?';
  const context = state.log.length > 0 ? state.log[state.log.length - 1].text : '';
  state.choiceHistory.push({
    age: `${state.age}岁${state.monthOfYear}月`,
    context,
    options: allOptions,
    chosen: chosenText,
    chosenIdx: index,
  });
  state.pendingChoice = null;

  if (choice.branch) {
    const nextId = pickBranch(state, choice.branch);
    if (nextId) {
      const ev = state.eventsMap.get(nextId);
      if (ev) applyEvent(ev);
    }
  } else if (choice.next) {
    if (choice.set) {
      for (const [k, v] of Object.entries(choice.set)) state[k] = v;
    }
    if (choice.effect) {
      for (const [k, v] of Object.entries(choice.effect)) {
        if (EFFECT_KEYS.has(k)) state[k] = (state[k] || 0) + v;
      }
      clampStats();
    }
    const ev = state.eventsMap.get(choice.next);
    if (ev) applyEvent(ev);
  } else if (choice.effect || choice.set || choice.resultText || choice.text) {
    const prevStoryline = state.storyline;

    // Inline outcome: apply effect/set and log a short result line
    if (choice.set) {
      for (const [k, v] of Object.entries(choice.set)) state[k] = v;
    }
    if (choice.effect) {
      for (const [k, v] of Object.entries(choice.effect)) {
        if (EFFECT_KEYS.has(k)) state[k] = (state[k] || 0) + v;
      }
      clampStats();
    }

    const isExit = choice.set && choice.set.storyline === '' && prevStoryline;
    let logType = undefined;
    
    if (isExit) {
      logType = 'storyline-exit';
      const statToHide = STORYLINE_UNLOCK_STAT[prevStoryline];
      if (statToHide) state['show' + statToHide] = false;
      
      // Reset profession
      if (state.age >= 23) {
        state.late_dropout = true;
        state.profession = '待业中';
      } else {
        for (const row of DEFAULT_PROF_BY_AGE) {
          if (state.age <= row.max) {
            state.profession = row.prof;
            break;
          }
        }
      }
      
      state.pendingCinematic = true;
      state._cineSavedAuto = autoMode;
      stopAuto();
      playStorylineExit({
        name: STORYLINE_NAMES[prevStoryline] || prevStoryline,
        color: '#aaa',
        hideStat: statToHide,
        statLabels: STAT_LABELS,
        onDone: () => {
          state.pendingCinematic = false;
          const saved = state._cineSavedAuto || 0;
          state._cineSavedAuto = 0;
          if (saved > 0) startAuto(saved);
          render();
        }
      });
    }

    // ── Storyline Retry Logic ──
    // 如果玩家在决赛失败后选择“再战一年”，我们需要重置尝试标记和时间线
    if (choice.text && (choice.text.includes('明年再来') || choice.text.includes('重振旗鼓'))) {
      state.storylineStartMonth = state.monthTotal;
      if (state.storyline === 'fitness') {
        state.fitness_attempted = false;
        state.fitness_stage = 'comp_window';
        state.fitness_comp_window_start = state.monthTotal;
        state.fitness_decay = 0;
      }
      if (state.storyline === 'chef') {
        state.chef_attempted = false;
        state.chef_stage = 'startup';
      }
    }

    const line = choice.resultText || `→ ${choice.text || ''}`;
    if (line) pushLog(line, logType);
  }

  // ── Butterfly effect: event-bound send ──
  // If the chosen option has a butterflySend key AND we're in MP, send to opponent
  if (choice.butterflySend && mp.enabled && mp.connected && mpSend) {
    const bfKey = choice.butterflySend;
    if (!mp.butterflySent) mp.butterflySent = new Set();
    if (!mp.butterflySent.has(bfKey)) {
      mp.butterflySent.add(bfKey);
      mpSend('butterfly', { payload: { key: bfKey, srcAge: state.age } });
      pushLog('（你的选择，在远方泛起了涟漪……）', 'mp-butterfly');
    }
  }

  render();

  // 恢复选择前的自动播放状态
  const savedMode = state._savedAutoMode || 0;
  state._savedAutoMode = 0;
  if (savedMode > 0) startAuto(savedMode);
}

function advanceMonth() {
  // 如果有待选择，阻塞推进
  if (state.pendingChoice || state.pendingCinematic) return;
  SFX.sfxTick();

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
    // Idol stage clock — must run before progress/death checks so debut may fire
    updateIdolStage();
    updatePartyStage();
    updateEsportsStage();
    updatePokerStage();
    updateFitnessStage();
    updateChefStage();
    updateAthleteStage();
    updateHogwartsYear();
    if (state.phase === 'ended' || state.pendingChoice) { render(); return; }
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
          const eid = typeof pc.event === 'function' ? pc.event(state) : pc.event;
          const ev = state.eventsMap.get(eid);
          if (ev && !state.firedEvents.has(eid)) { applyEvent(ev); return true; }
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
    const _statComboDeaths = [
      { cond: s => s.INT <= 0 && s.overseas, event: 99931 },
      { cond: s => s.SOC <= 0 && s.HAP <= 0 && s.overseas, event: 99932 },
      { cond: s => s.MNY <= 0 && s.HLT <= 0 && s.overseas, event: 99933 },
      { cond: s => s.PER <= 0 && s.MNY <= 0 && s.overseas, event: 99934 },
      { cond: s => s.APP <= 0 && s.SOC <= 0 && s.overseas, event: 99935 },
      { cond: s => s.INT <= 0 && s.PER <= 0 && s.overseas, event: 99936 },
      { cond: s => s.HLT <= 0 && s.HAP <= 0 && s.overseas, event: 99937 },
      { cond: s => s.SOC <= 0 && s.PER <= 0 && s.overseas, event: 99938 },
    ];
    const eligible = _statComboDeaths.filter(dc => dc.cond(state) && !state.firedEvents.has(dc.event));
    if (eligible.length && Math.random() < 0.2) {
      const pick = eligible[Math.floor(Math.random() * eligible.length)];
      const ev = state.eventsMap.get(pick.event);
      if (ev) applyEvent(ev);
    }

    if (state.HLT <= -5) {
      pushLog('「结局：油尽灯枯」长期的忽视和透支终于压垮了你的身体。你在一个深夜倒下，再也没有醒来。人生就此画上句号。', 'ending');
      state.phase = 'ended';
      unlockAchievement('end_health');
      if (mp._reunionTimeout) { clearTimeout(mp._reunionTimeout); mp._reunionTimeout = null; }
      mp.isWaiting = false;
    }
    if (state.age >= 60) {
      pushLog('你退休了。回首这一生，百感交集。', 'ending');
      state.phase = 'ended';
      unlockAchievement('end_retire');
      if (mp._reunionTimeout) { clearTimeout(mp._reunionTimeout); mp._reunionTimeout = null; }
      mp.isWaiting = false;
    }
  }

  // ── Multiplayer per-tick hooks ──
  if (mp.enabled && mp.connected && state.phase !== 'ended') {
    _broadcastState();
    // Apply incoming fate card effects
    if (mp.incomingCardEffect) {
      _applyIncomingCard(mp.incomingCardEffect);
      mp.incomingCardEffect = null;
    }
    // Check reunion ages (fire on month 1 of the reunion year)
    if (REUNION_AGES && state.monthOfYear === 1 && REUNION_AGES.includes(state.age)) {
      _triggerReunion(state.age);
    }
    // Process incoming butterfly effects (skip during special/hidden storylines)
    const _inStoryline = state.storyline &&
      (SPECIAL_STORYLINES.has(state.storyline) || HIDDEN_STORYLINES.has(state.storyline));
    if (mp.pendingButterfly && mp.pendingButterfly.length > 0 && !_inStoryline) {
      const bf = mp.pendingButterfly.shift();
      const bfEv = _findButterflyReceive(bf.key);
      if (bfEv) applyEvent(bfEv);
    }

    // ── Butterfly effect: stat-based auto-trigger ──
    // Every 6 months, check stat conditions and probabilistically send butterflies
    // Skip during special/hidden storylines
    if (state.monthTotal % 6 === 0 && state.age >= 18 && !_inStoryline) {
      if (!mp.butterflySent) mp.butterflySent = new Set();
      const _bfAutoRules = [
        { key: 'internship',        cond: () => state.INT >= 12 && state.MNY <= 3 && state.age >= 20, prob: 0.15 },
        { key: 'network',           cond: () => state.SOC <= 2 && state.age >= 19, prob: 0.12 },
        { key: 'startup',           cond: () => state.INT >= 10 && state.MNY >= 8 && state.age >= 22 && !state.storyline, prob: 0.10 },
        { key: 'overseas_advanced', cond: () => state.INT >= 12 && state.overseas && state.age >= 22, prob: 0.10 },
        { key: 'romance',           cond: () => state.APP >= 10 && state.relationship === '单身' && state.age >= 19, prob: 0.12 },
      ];
      for (const rule of _bfAutoRules) {
        if (mp.butterflySent.has(rule.key)) continue;
        if (rule.cond() && Math.random() < rule.prob) {
          mp.butterflySent.add(rule.key);
          mpSend('butterfly', { payload: { key: rule.key, srcAge: state.age } });
          break; // max 1 auto-butterfly per check
        }
      }
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
  if (age <= 23 && !workingProfs.has(state.profession)) {
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
  if (age <= 30) {
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
      '和同事团建，尬聊了一整天。'
    ]);
    if (m <= 6) return pick([
      '年中述职，PPT写到凌晨。',
      '618大促，购物车清空了一半。',
      '天气太热，通勤就是一种折磨。',
      '项目DDL逼近，连续加班两周。',
      '收到猎头的消息，心动了一下。'
    ]);
    if (m <= 8) return pick([
      '请了年假出去旅行，回来发现邮件爆了。',
      '夏天太热，只想在家吹空调。',
      '周末约朋友聚了一次，聊的全是工作和房价。',
      '体检报告出来了，有几项指标不太好。',
      '暑假？上班族没有暑假，只有更热的通勤。'
    ]);
    if (m <= 10) return pick([
      '秋风起，想起了学生时代。',
      '国庆长假，出门全是人，在家全是剧。',
      '金九银十跳槽季，你在犹豫。',
      '降温了，翻出去年的外套发现扣子掉了。',
      '新来了个实习生，你看着他想起了自己当年。'
    ]);
    return pick([
      '年底了，绩效考核又来了。',
      '双十一剁完手，看看余额，痛。',
      '天冷了，早上起床全靠意志力。',
      '年底总结：又忙了一年，也不知道忙了什么。'
    ]);
  }

  // 中年时代 (40-59)
  if (m <= 2) return pick([
    '年终体检，医生说要注意血压。',
    '春节在家包饺子，和小时候一样。',
    '窝在沙发上看春晚，不知不觉睡着了。'
  ]);
  if (m <= 4) return pick([
    '春天了，在小区里散步。',
    '体检报告越来越长，心态越来越稳。',
    '开始研究养生茶了，枸杞泡起来。',
    '老同学聚会，大家都胖了一圈。',
    '换了一双舒服的鞋，不追求好看了。'
  ]);
  if (m <= 6) return pick([
    '单位体制改革，你有点不安。',
    '夏天到了，游泳成了唯一的运动。',
    '老家来电话了，父母身体还好。',
    '下班后去公园走了一万步，感觉还行。'
  ]);
  if (m <= 8) return pick([
    '带家人出去旅游了一趟，累但开心。',
    '夏天太热，血压有点高。',
    '同龄人有人升职了，你心态平和。',
    '开始听播客了，通勤时间不那么无聊了。'
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
    xianxia:    ['你于洞府中盘膝吐纳，岁月如水流过。', '山雨过后，林间灵气格外稠密。', '你抬头看天，一只白鹤掠过云端。', '你打坐时，听见远处有人在念诵经文。', '你拈起一片落叶，叶上灵息流转。', '你在溪边写了几个字，又被风吹散。', '你试着以神识扫过山林，鸟兽四散。', '你想起当年那本残卷，墨迹仍在脑海中流动。'],
    fitness:    ['你对着镜子检查肌肉分离度。', '又到了痛苦的练腿日。', '你在计算今天的宏量营养素。', '凌晨的健身房只有杠铃的撞击声。', '你喝下了一大口难以下咽的蛋白粉。', '你的体脂率似乎又降了一点。'],
    chef:       ['你在后厨反复翻炒，火苗窜起。', '你切土豆切得手腕发麻。', '你正在研究新的酱汁配方。', '餐车外的食客排起了长队。', '你清洗着沾满油污的铁锅。', '空气中弥漫着香料的味道。'],
    athlete:    ['你在训练场上挥汗如雨。', '教练的哨声在耳边回响。', '你在力量房做着第无数组深蹲。', '冰敷袋贴在酸痛的膝盖上。', '你在看比赛录像分析战术。', '更衣室里弥漫着运动后的疲惫。']
  };
  const pool = flavors[sl];
  if (pool) return pool[Math.floor(Math.random() * pool.length)];
  return '……';
}

function xianxiaFlavor() {
  return storylineFlavor();
}

function $(id) { return document.getElementById(id); }

function _renderFrenemyDraft() {
  if (!draftFrenemyCards) return;
  const pool = draftFrenemyCards();
  state._frenemyDraftPool = pool;
  state._frenemyDraftPicked = [];
  const grid = $('frenemy-draft-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const gradeLabels = ['普通', '稀有', '史诗'];
  for (const card of pool) {
    const el = document.createElement('div');
    el.className = `frenemy-card ${card.category}`;
    el.innerHTML = `
      <div class="fc-name">${card.icon} ${card.name}<span class="fc-grade g${card.grade}">${gradeLabels[card.grade]}</span></div>
      <div class="fc-desc">${card.desc}</div>
    `;
    el.addEventListener('click', () => {
      const picked = state._frenemyDraftPicked;
      const idx = picked.findIndex(c => c.id === card.id);
      if (idx >= 0) {
        SFX.sfxCardDeselect();
        picked.splice(idx, 1);
        el.classList.remove('selected');
      } else if (picked.length < 3) {
        SFX.sfxCardSelect();
        picked.push(card);
        el.classList.add('selected');
      }
      const cnt = picked.length;
      const btn = $('frenemy-confirm');
      btn.disabled = cnt !== 3;
      btn.textContent = cnt === 3 ? '确认损友卡 →' : `确认损友卡（${cnt}/3）`;
    });
    grid.appendChild(el);
  }
  const btn = $('frenemy-confirm');
  if (btn) { btn.disabled = true; btn.textContent = '确认损友卡（0/3）'; }
}

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
      if (idx >= 0) {
        SFX.sfxTalentDeselect();
        state.talentsPicked.splice(idx, 1);
        el.classList.remove('picked');
      } else if (state.talentsPicked.length < 3) {
        SFX.sfxTalentFlip();
        state.talentsPicked.push(t);
        el.classList.add('picked');
      }
      const cnt = state.talentsPicked.length;
      $('talent-confirm').disabled = cnt !== 3;
      $('talent-confirm').textContent = cnt === 3 ? '确认天赋 →' : `确认天赋（${cnt}/3）`;
      if (typeof updateCreationAvatar === 'function') updateCreationAvatar();
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
    const avatarCanvas = $('avatar-canvas');
    if (avatarCanvas) renderAvatar(avatarCanvas, state);

    const statsEl = $('stats-panel');
    const isXianxia = state.storyline === 'xianxia';
    const wasXianxia = statsEl.classList.contains('mode-xianxia');

    // 进入修仙模式：触发抹除→新属性出现的动画
    if (isXianxia && !wasXianxia && !statsEl.classList.contains('mode-shifting')) {
      statsEl.classList.add('mode-shifting');
      setTimeout(() => {
        statsEl.classList.remove('mode-shifting');
        statsEl.classList.add('mode-xianxia', 'mode-emerging');
        render();
        setTimeout(() => statsEl.classList.remove('mode-emerging'), 1200);
      }, 900);
      return;
    }
    if (statsEl.classList.contains('mode-shifting')) return;
    if (!isXianxia) statsEl.classList.remove('mode-xianxia');

    statsEl.innerHTML = '';

    if (isXianxia) {
      const realm = deriveRealm(state.cul);
      const cul = state.cul || 0;
      const culMax = cul < 20 ? 20 : cul < 60 ? 60 : cul < 150 ? 150 : cul < 300 ? 300 : cul < 600 ? 600 : cul < 1000 ? 1000 : cul < 1500 ? 1500 : Math.max(2000, cul);
      const rows = [
        { label: '境界', val: realm, isText: true },
        { label: '修为', val: cul, max: culMax },
        { label: '大道', val: state.dao || 0, max: 6 },
        { label: '机缘', val: state.karma || 0, max: 10 },
        { label: '渡劫', val: state.tribulation || 0, max: 9 },
      ];
      for (const r of rows) {
        const row = document.createElement('div');
        row.className = 'stat-row stat-xianxia';
        if (r.isText) {
          row.innerHTML = `<span class="stat-label">${r.label}</span><span class="stat-realm">${r.val}</span>`;
        } else {
          const pct = Math.max(0, Math.min(100, (r.val / r.max) * 100));
          row.innerHTML = `
            <span class="stat-label">${r.label}</span>
            <span class="stat-bar"><span class="stat-fill" style="width:${pct}%"></span></span>
            <span class="stat-val">${r.val}</span>
          `;
        }
        statsEl.appendChild(row);
      }
    } else {
      const shown = ['SOC', 'INT', 'MNY', 'HAP', 'HLT', 'PER', 'APP'];
      if (state.showPOP) shown.push('POP');
      if (state.showPOK) shown.push('POK');
      if (state.showMMR) shown.push('MMR');
      if (state.showFIT) shown.push('FIT');
      if (state.showCKL) shown.push('CKL');
      if (state.showATH) shown.push('ATH');
      if (state.showMAG) shown.push('MAG');
      const dynamicMax = Math.max(1, ...shown.filter(k => k !== 'HAP').map(k => state[k]));
      const SPECIAL_STATS = new Set(['POP', 'POK', 'MMR', 'FIT', 'CKL', 'ATH', 'MAG']);
      for (const k of shown) {
        const row = document.createElement('div');
        const isSpecial = SPECIAL_STATS.has(k);
        row.className = 'stat-row' + (isSpecial ? (k === 'MAG' ? ' stat-special stat-hogwarts' : ' stat-special') : '');
        row.dataset.stat = k;
        const label = STAT_LABELS[k];
        const val = state[k];
        const base = k === 'HAP' ? 10 : dynamicMax;
        const pct = Math.max(0, Math.min(100, (val / base) * 100));
        const chg = state._statChanges && state._statChanges[k];
        const chgHtml = chg ? `<span class="stat-delta ${chg > 0 ? 'pos' : 'neg'}">${chg > 0 ? '+' : ''}${chg}</span>` : '';
        row.innerHTML = `
          <span class="stat-label">${label}</span>
          <span class="stat-bar"><span class="stat-fill" style="width:${pct}%"></span></span>
          <span class="stat-val">${val}${chgHtml}</span>
        `;
        if (chg) row.classList.add('stat-changed', chg > 0 ? 'stat-up' : 'stat-down');
        statsEl.appendChild(row);
      }
      // Clear after rendering so animation only plays once
      if (state._statChanges) state._statChanges = null;
    }

    const HOUSE_NAMES = {
      gryffindor: '格兰芬多', ravenclaw: '拉文克劳',
      hufflepuff: '赫奇帕奇', slytherin: '斯莱特林'
    };
    const HOUSE_COLORS = {
      gryffindor: { primary: '#740001', secondary: '#EEBA30', text: '#c0392b' },
      slytherin:  { primary: '#1A472A', secondary: '#AAAAAA', text: '#27ae60' },
      ravenclaw:  { primary: '#222F5B', secondary: '#BEBEBE', text: '#5b8abf' },
      hufflepuff: { primary: '#FFDB00', secondary: '#000000', text: '#d4a017' }
    };
    const isHogwarts = state.storyline === 'hogwarts';

    const schoolBox = $('school-box');


    const majorBox = $('major-box');
    const profBox = $('profession-box');
    const houseBox = $('house-box');

    if (isHogwarts) {
      schoolBox.classList.add('hogwarts-fade-out');
      majorBox.classList.add('hogwarts-fade-out');
      profBox.classList.add('hogwarts-fade-out');
      schoolBox.style.display = 'none';
      majorBox.style.display = 'none';
      profBox.style.display = 'none';

      if (state.house) {
        houseBox.style.display = '';
        houseBox.classList.add('hogwarts-fade-in');
        const hc = HOUSE_COLORS[state.house] || { primary: '#9B59B6', secondary: '#9B59B6', text: '#9B59B6' };
        houseBox.style.setProperty('--house-gradient', `linear-gradient(to right, ${hc.primary}, ${hc.secondary})`);
        houseBox.style.background = `linear-gradient(135deg, ${hc.primary}18 0%, var(--card-2) 60%)`;
        $('house-display').textContent = HOUSE_NAMES[state.house] || state.house;
        $('house-display').style.color = hc.text;
        const houseLabel = houseBox.querySelector('.hogwarts-house-label');
        if (houseLabel) houseLabel.style.color = hc.primary;
      } else {
        houseBox.style.display = 'none';
      }
    } else {
      schoolBox.classList.remove('hogwarts-fade-out');
      majorBox.classList.remove('hogwarts-fade-out');
      profBox.classList.remove('hogwarts-fade-out');
      houseBox.classList.remove('hogwarts-fade-in');
      houseBox.style.display = 'none';

      if (state.school && state.school !== '无') {
        schoolBox.style.display = '';
        $('school-display').textContent = state.school;
      } else {
        schoolBox.style.display = 'none';
      }

      majorBox.style.display = '';
      $('major-display').textContent = state.major || '未定';

      if (state.profession && !STUDENT_PHASES.has(state.profession)) {
        profBox.style.display = '';
        $('profession-display').textContent = state.profession;
      } else {
        profBox.style.display = 'none';
      }
    }

    $('relationship-display').textContent = (state.talentIds.has(3036) && state.relationship === '暧昧')
      ? '？？？'
      : (state.relationship || '单身');

    const slBox = $('storyline-box');
    if (state.storyline) {
      slBox.style.display = '';
      const isHidden = HIDDEN_STORYLINES.has(state.storyline);
      slBox.classList.toggle('hidden-storyline', isHidden && !isHogwarts);
      slBox.classList.toggle('special-storyline', !isHidden);
      slBox.classList.toggle('hogwarts-storyline', isHogwarts);
      slBox.querySelector('.storyline-label').textContent = isHogwarts ? '魔法世界' : (isHidden ? '隐藏剧情' : '特殊剧情');
      $('storyline-display').textContent = STORYLINE_NAMES[state.storyline] || state.storyline;
    } else {
      slBox.style.display = 'none';
      slBox.classList.remove('hogwarts-storyline');
    }

    const debutBox = $('debut-box');
    if (state.storyline === 'idol' && !state.debut_attempted && state.phase !== 'ended') {
      debutBox.style.display = '';
      const stageEl = $('debut-stage');
      const probEl = $('debut-prob');
      const warnEl = $('debut-decay-warn');
      const btn = $('btn-try-debut');
      const monthsIn = state.monthTotal - (state.storylineStartMonth || 0);
      if (state.idol_stage === 'training' || state.idol_stage == null) {
        const remaining = Math.max(0, IDOL_TRAINING_LEN - monthsIn);
        stageEl.textContent = `练习生 · 还剩 ${remaining} 个月`;
        probEl.textContent = '--';
        warnEl.textContent = '满 12 个月后开放出道窗口';
        btn.disabled = true;
      } else if (state.idol_stage === 'debut_window') {
        const prob = computeDebutProb(state);
        const inWin = state.monthTotal - (state.debut_window_start_month || state.monthTotal);
        const monthsToForce = Math.max(0, IDOL_FORCE_LEN - monthsIn);
        stageEl.textContent = `出道窗口 · 强制结算还剩 ${monthsToForce} 个月`;
        probEl.textContent = prob + '%';
        probEl.style.color = prob >= 50 ? '#7ed7a0' : prob >= 25 ? '#f5b642' : '#e06060';
        const inGrace = inWin < IDOL_DECAY_GRACE;
        const monthsToNextDecay = inGrace
          ? IDOL_DECAY_GRACE - inWin
          : (IDOL_DECAY_STEP - ((inWin - IDOL_DECAY_GRACE) % IDOL_DECAY_STEP)) || IDOL_DECAY_STEP;
        if ((state.debut_decay || 0) >= IDOL_DECAY_CAP) {
          warnEl.textContent = `衰减已封顶（-${IDOL_DECAY_CAP}%），再拖也不会更低`;
        } else if (inGrace) {
          warnEl.textContent = `${monthsToNextDecay} 个月后开始衰减（每 3 个月 -5%）`;
        } else {
          warnEl.textContent = `已衰减 ${state.debut_decay || 0}% · ${monthsToNextDecay} 个月后再 -5%`;
        }
        btn.disabled = false;
      }
    } else {
      debutBox.style.display = 'none';
    }

    const partyBox = $('party-box');
    if (partyBox) {
      if (state.storyline === 'party' && !state.ceo_attempted && state.phase !== 'ended') {
        partyBox.style.display = '';
        const stageEl = $('party-stage');
        const probEl = $('ceo-prob');
        const warnEl = $('ceo-decay-warn');
        const btn = $('btn-try-ceo');
        const monthsIn = state.monthTotal - (state.storylineStartMonth || 0);
        if (state.party_stage === 'settling' || state.party_stage == null) {
          const remaining = Math.max(0, PARTY_SETTLE_LEN - monthsIn);
          stageEl.textContent = `局长 · 还剩 ${remaining} 个月`;
          probEl.textContent = '--';
          warnEl.textContent = '满 12 个月后开放转型窗口';
          btn.disabled = true;
        } else if (state.party_stage === 'ceo_window') {
          const prob = computeCeoProb(state);
          const inWin = state.monthTotal - (state.ceo_window_start_month || state.monthTotal);
          const monthsToForce = Math.max(0, PARTY_FORCE_LEN - monthsIn);
          stageEl.textContent = `转型窗口 · 强制结算还剩 ${monthsToForce} 个月`;
          probEl.textContent = prob + '%';
          probEl.style.color = prob >= 50 ? '#7ed7a0' : prob >= 25 ? '#f5b642' : '#e06060';
          const inGrace = inWin < PARTY_DECAY_GRACE;
          const monthsToNextDecay = inGrace
            ? PARTY_DECAY_GRACE - inWin
            : (PARTY_DECAY_STEP - ((inWin - PARTY_DECAY_GRACE) % PARTY_DECAY_STEP)) || PARTY_DECAY_STEP;
          if ((state.ceo_decay || 0) >= PARTY_DECAY_CAP) {
            warnEl.textContent = `衰减已封顶（-${PARTY_DECAY_CAP}%），再拖也不会更低`;
          } else if (inGrace) {
            warnEl.textContent = `${monthsToNextDecay} 个月后开始衰减（每 3 个月 -5%）`;
          } else {
            warnEl.textContent = `已衰减 ${state.ceo_decay || 0}% · ${monthsToNextDecay} 个月后再 -5%`;
          }
          btn.disabled = false;
        }
      } else {
        partyBox.style.display = 'none';
      }
    }

    const esportsBox = $('esports-box');
    if (esportsBox) {
      if (state.storyline === 'esports' && !state.qualifier_attempted && state.phase !== 'ended') {
        esportsBox.style.display = '';
        const stageEl = $('esports-stage');
        const probEl = $('esports-prob');
        const warnEl = $('esports-decay-warn');
        const btn = $('btn-try-qualifier');
        const monthsIn = state.monthTotal - (state.storylineStartMonth || 0);
        if (state.esports_stage === 'rookie' || state.esports_stage == null) {
          const remaining = Math.max(0, ESPORTS_ROOKIE_LEN - monthsIn);
          stageEl.textContent = `新秀期 · 还剩 ${remaining} 个月`;
          probEl.textContent = '--';
          warnEl.textContent = '满 12 个月后开放出线窗口';
          btn.disabled = true;
        } else if (state.esports_stage === 'qualifier_window') {
          const prob = computeQualifierProb(state);
          const inWin = state.monthTotal - (state.qualifier_window_start_month || state.monthTotal);
          const monthsToForce = Math.max(0, ESPORTS_FORCE_LEN - monthsIn);
          stageEl.textContent = `出线窗口 · 强制结算还剩 ${monthsToForce} 个月`;
          probEl.textContent = prob + '%';
          probEl.style.color = prob >= 50 ? '#7ed7a0' : prob >= 25 ? '#f5b642' : '#e06060';
          const inGrace = inWin < ESPORTS_DECAY_GRACE;
          const monthsToNextDecay = inGrace
            ? ESPORTS_DECAY_GRACE - inWin
            : (ESPORTS_DECAY_STEP - ((inWin - ESPORTS_DECAY_GRACE) % ESPORTS_DECAY_STEP)) || ESPORTS_DECAY_STEP;
          if ((state.qualifier_decay || 0) >= ESPORTS_DECAY_CAP) {
            warnEl.textContent = `衰减已封顶（-${ESPORTS_DECAY_CAP}%），再拖也不会更低`;
          } else if (inGrace) {
            warnEl.textContent = `${monthsToNextDecay} 个月后开始衰减（每 3 个月 -5%）`;
          } else {
            warnEl.textContent = `已衰减 ${state.qualifier_decay || 0}% · ${monthsToNextDecay} 个月后再 -5%`;
          }
          btn.disabled = false;
        }
      } else {
        esportsBox.style.display = 'none';
      }
    }

    const fitnessBox = $('fitness-box');
    if (fitnessBox) {
      if (state.storyline === 'fitness' && !state.fitness_attempted && state.phase !== 'ended') {
        fitnessBox.style.display = 'flex';
        const stageEl = $('fitness-stage');
        const probEl = $('fitness-prob');
        const warnEl = $('fitness-decay-warn');
        const btn = $('btn-try-fitness');
        const monthsIn = state.monthTotal - (state.storylineStartMonth || 0);
        
        if (state.fitness_stage === 'prep' || state.fitness_stage == null) {
          const remaining = Math.max(0, FITNESS_PREP_LEN - monthsIn);
          stageEl.textContent = `备赛期 · 还剩 ${remaining} 个月`;
          probEl.textContent = '--';
          warnEl.textContent = '备赛 12 个月后登上选拔赛舞台';
          btn.disabled = true;
        } else {
          const prob = computeFitnessProb(state);
          const isRetry = (state.fitness_attempt_count || 0) >= 1;
          const forceLen = isRetry ? FITNESS_PREP_LEN : FITNESS_FORCE_LEN;
          const monthsToForce = Math.max(0, forceLen - monthsIn);
          const retryTag = isRetry ? ' [再战]' : '';
          stageEl.textContent = `选拔窗口${retryTag} · 强制结算还剩 ${monthsToForce} 个月`;
          probEl.textContent = prob + '%';
          probEl.style.color = prob >= 50 ? '#7ed7a0' : prob >= 25 ? '#f5b642' : '#e06060';
          const inWin = state.monthTotal - (state.fitness_comp_window_start || state.monthTotal);
          const decay = state.fitness_decay || 0;
          if (decay >= FITNESS_DECAY_CAP) {
            warnEl.textContent = `状态衰减已封顶（-${FITNESS_DECAY_CAP}%），尽快登台`;
          } else if (inWin <= FITNESS_DECAY_GRACE) {
            warnEl.textContent = `${FITNESS_DECAY_GRACE - inWin} 个月后状态开始衰减`;
          } else {
            warnEl.textContent = `状态已衰减 ${decay}%（每月 -${FITNESS_DECAY_PER_MONTH}%）`;
          }
          btn.disabled = false;
        }
      } else {
        fitnessBox.style.display = 'none';
      }
    }

    const chefBox = $('chef-box');
    if (chefBox) {
      if (state.storyline === 'chef' && !state.chef_attempted && state.phase !== 'ended') {
        chefBox.style.display = 'flex';
        const stageEl = $('chef-stage');
        const probEl = $('chef-prob');
        const warnEl = $('chef-decay-warn');
        const btn = $('btn-try-chef');
        const monthsIn = state.monthTotal - (state.storylineStartMonth || 0);
        
        if (state.chef_stage === 'startup' || state.chef_stage == null) {
          const remaining = Math.max(0, CHEF_STARTUP_LEN - monthsIn);
          stageEl.textContent = `初创期 · 还剩 ${remaining} 个月`;
          probEl.textContent = '--';
          warnEl.textContent = '满 12 个月后开启米其林考察';
          btn.disabled = true;
        } else {
          const prob = computeChefProb(state);
          const monthsToForce = Math.max(0, CHEF_FORCE_LEN - monthsIn);
          stageEl.textContent = `考察期 · 强制结算还剩 ${monthsToForce} 个月`;
          probEl.textContent = prob + '%';
          probEl.style.color = prob >= 50 ? '#7ed7a0' : prob >= 25 ? '#f5b642' : '#e06060';
          const inWin = state.monthTotal - (state.chef_comp_window_start || state.monthTotal);
          const decay = state.chef_decay || 0;
          if (decay >= CHEF_DECAY_CAP) {
            warnEl.textContent = `状态衰减已封顶（-${CHEF_DECAY_CAP}%），尽快行动`;
          } else if (inWin <= CHEF_DECAY_GRACE) {
            warnEl.textContent = `${CHEF_DECAY_GRACE - inWin} 个月后获星概率开始衰减`;
          } else {
            warnEl.textContent = `获星概率已衰减 ${decay}%（每月 -${CHEF_DECAY_PER_MONTH}%）`;
          }
          btn.disabled = false;
        }
      } else {
        chefBox.style.display = 'none';
      }
    }

    const athleteBox = $('athlete-box');
    if (athleteBox) {
      if (state.storyline === 'athlete' && !state.athlete_attempted && state.phase !== 'ended') {
        athleteBox.style.display = 'flex';
        const titleEl = $('athlete-title');
        const stageEl = $('athlete-stage');
        const probEl = $('athlete-prob');
        const warnEl = $('athlete-decay-warn');
        const btn = $('btn-try-athlete');
        const sport = state.sport_type || 'basketball';
        if (titleEl) titleEl.textContent = SPORT_LABELS[sport] || '职业选拔';
        const monthsIn = state.monthTotal - (state.storylineStartMonth || 0);

        if (state.athlete_stage === 'startup' || state.athlete_stage == null) {
          const remaining = Math.max(0, ATHLETE_STARTUP_LEN - monthsIn);
          stageEl.textContent = `训练期 · 还剩 ${remaining} 个月`;
          probEl.textContent = '--';
          warnEl.textContent = '满 12 个月后开启选拔窗口';
          btn.disabled = true;
        } else {
          const prob = computeAthleteProb(state);
          const monthsToForce = Math.max(0, ATHLETE_FORCE_LEN - monthsIn);
          stageEl.textContent = `选拔期 · 强制结算还剩 ${monthsToForce} 个月`;
          probEl.textContent = prob + '%';
          probEl.style.color = prob >= 50 ? '#7ed7a0' : prob >= 25 ? '#f5b642' : '#e06060';
          const inWin = state.monthTotal - (state.athlete_comp_window_start || state.monthTotal);
          const decay = state.athlete_decay || 0;
          if (decay >= ATHLETE_DECAY_CAP) {
            warnEl.textContent = `状态衰减已封顶（-${ATHLETE_DECAY_CAP}%），尽快行动`;
          } else if (inWin <= ATHLETE_DECAY_GRACE) {
            warnEl.textContent = `${ATHLETE_DECAY_GRACE - inWin} 个月后晋级概率开始衰减`;
          } else {
            warnEl.textContent = `晋级概率已衰减 ${decay}%（每月 -${ATHLETE_DECAY_PER_MONTH}%）`;
          }
          btn.disabled = false;
        }
      } else {
        athleteBox.style.display = 'none';
      }
    }

    const pokerBox = $('poker-box');
    if (pokerBox) {
      if (state.storyline === 'poker' && !state.triton_attempted && state.phase !== 'ended') {
        pokerBox.style.display = '';
        const stageEl = $('poker-stage');
        const probEl = $('triton-prob');
        const warnEl = $('triton-decay-warn');
        const btn = $('btn-try-triton');
        const monthsIn = state.monthTotal - (state.storylineStartMonth || 0);
        if (state.poker_stage === 'rookie' || state.poker_stage == null) {
          const remaining = Math.max(0, POKER_ROOKIE_LEN - monthsIn);
          stageEl.textContent = `学徒期 · 还剩 ${remaining} 个月`;
          probEl.textContent = '--';
          warnEl.textContent = '满 12 个月后开放参赛窗口';
          btn.disabled = true;
        } else if (state.poker_stage === 'triton_window') {
          const prob = computeTritonProb(state);
          const inWin = state.monthTotal - (state.triton_window_start_month || state.monthTotal);
          const monthsToForce = Math.max(0, POKER_FORCE_LEN - monthsIn);
          stageEl.textContent = `参赛窗口 · 强制结算还剩 ${monthsToForce} 个月`;
          probEl.textContent = prob + '%';
          probEl.style.color = prob >= 50 ? '#7ed7a0' : prob >= 25 ? '#f5b642' : '#e06060';
          const inGrace = inWin < POKER_DECAY_GRACE;
          const monthsToNextDecay = inGrace
            ? POKER_DECAY_GRACE - inWin
            : (POKER_DECAY_STEP - ((inWin - POKER_DECAY_GRACE) % POKER_DECAY_STEP)) || POKER_DECAY_STEP;
          if ((state.triton_decay || 0) >= POKER_DECAY_CAP) {
            warnEl.textContent = `衰减已封顶（-${POKER_DECAY_CAP}%），再拖也不会更低`;
          } else if (inGrace) {
            warnEl.textContent = `${monthsToNextDecay} 个月后开始衰减（每 3 个月 -5%）`;
          } else {
            warnEl.textContent = `已衰减 ${state.triton_decay || 0}% · ${monthsToNextDecay} 个月后再 -5%`;
          }
          btn.disabled = false;
        }
      } else {
        pokerBox.style.display = 'none';
      }
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
      if (isCardLayout) {
        choiceDiv.classList.add('choice-cards');
        if (state.log.length > 0) {
          const ctxEl = document.createElement('div');
          ctxEl.className = 'choice-context';
          ctxEl.textContent = state.log[state.log.length - 1].text;
          choiceDiv.appendChild(ctxEl);
        }
      }
      
      let canClick = false;
      setTimeout(() => { canClick = true; }, 500);

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
          if (c.requireText || (locked && c.requireExpr)) {
            const reqEl = document.createElement('div');
            reqEl.className = 'choice-req' + (locked ? ' locked' : ' met');
            const hintText = c.requireText || _parseRequireHint(c.requireExpr);
            reqEl.textContent = (locked ? '🔒 ' : '✓ ') + hintText;
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
        if (c.gold) btn.classList.add('choice-gold');
        if (locked) {
          btn.classList.add('choice-locked');
          btn.disabled = true;
        }
        btn.addEventListener('click', (e) => {
          e.stopPropagation();  // 阻止冒泡到面板的 advanceMonth
          if (locked || !canClick) return;
          resolveChoice(i);
        });
        choiceDiv.appendChild(btn);
      });
      logEl.appendChild(choiceDiv);
    }

    logEl.scrollTop = logEl.scrollHeight;
  }

  updateAutoButtons();
  if (_mobileStatsStripUpdate) _mobileStatsStripUpdate();
  if (_mobileStatsGridUpdate) _mobileStatsGridUpdate();
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
  // End cinematic is now triggered by player click, not auto-shown
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
  state.choiceHistory = [];
  state.milestones = [];
  state.cardHistory = [];
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
  unlockAchievement('first_play');
  const plan = state.yearlyPlan.get(15);
  if (plan && plan.has(1)) {
    const ev = state.eventsMap.get(plan.get(1));
    plan.delete(1);
    if (ev) applyEvent(ev);
  }

  showScreen('game-screen');
  render();

  // Multiplayer: show opponent bar & broadcast initial state
  if (mp.enabled && mp.connected) {
    _broadcastState();
    _renderOpponentBar();
  }
}

let _endCinematicShown = false;

function showEndCinematic() {
  if (_endCinematicShown) return;
  _endCinematicShown = true;

  // Pick the actual ending log: only logType='ending' (set when ev.end=true or system endings)
  const logs = state.log;
  let endingIdx = -1;
  for (let i = logs.length - 1; i >= 0; i--) {
    if (logs[i].logType === 'ending') { endingIdx = i; break; }
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

function calculateScore() {
  let score = 0;
  const peaks = state.statPeaks || {};
  
  // Base stats
  score += (peaks.INT || 0) * 100;
  score += (peaks.MNY || 0) * 100;
  score += (peaks.APP || 0) * 100;
  score += (peaks.SOC || 0) * 100;
  score += (peaks.HLT || 0) * 100;
  score += (peaks.PER || 0) * 120; // PER is harder
  score += (peaks.HAP || 0) * 80;

  // Breakthrough bonuses
  for (const k of ['INT', 'MNY', 'APP', 'SOC', 'HLT', 'PER', 'HAP']) {
    if ((peaks[k] || 0) >= 10) score += 300;
  }

  // Special Stats
  if (peaks.POP) score += peaks.POP * 50;
  if (peaks.POK) score += peaks.POK * 500;
  if (peaks.MMR) score += peaks.MMR * 1;
  if (peaks.cul) score += peaks.cul * 20;

  // Education bonus
  if (state.schoolTier === 'top' || state.school === 'T20') score += 1000;
  else if (state.schoolTier === 'mid' || state.school === 'T50') score += 500;
  else if (state.school === '遣返' || state.school === '退学') score -= 1000;

  // Storyline / Hidden Paths
  if (state.storylinesVisited && state.storylinesVisited.size > 0) {
    score += state.storylinesVisited.size * 2000;
  }

  // Romance / Relationship modifier
  if (state.relationship) {
    const rel = state.relationship;
    if (rel === '已婚' || rel === '二婚') score += 1500; // 人生圆满
    else if (rel === '恋爱' || rel === '校园恋' || rel === '同居') score += 800;
    else if (rel === '傍大款') score += 500; 
    else if (rel === '海王') score += 2000; // 海王高分
    else if (rel === '离异') score -= 500;
    else if (rel === '地下恋' || rel === '快餐恋' || rel === '异地恋') score += 300;
  }
  // 奖励丰富的情感经历
  if (state.romanceHistory && state.romanceHistory.length > 0) {
    score += state.romanceHistory.length * 200; // 每一段过去的感情加200阅历分
  }

  // Emotional modifier
  const finalHap = state.HAP || 5;
  const finalHlt = state.HLT || 5;
  
  let multiplier = 1.0;
  if (finalHap < 3) multiplier *= 0.9;
  if (finalHlt < 2) multiplier *= 0.9;
  if (finalHap >= 8 && finalHlt >= 8) multiplier *= 1.1;

  // ── Ending & Timing Bonuses ──
  // 传奇结局与好结局的固定加分与百分比加成
  // 并且越早触发传奇结局，加分越多
  if (state.endingId) {
    const eid = state.endingId;
    const eage = state.endingAge || state.age;
    
    if (LEGENDARY_ENDINGS.has(eid)) {
      score += 2000; // 传奇结局固定加5000
      multiplier += 0.2; // 额外50%总分加成
      
      // 越早达成越牛：以28岁为基准，每早一年多加1000分
      const earlyBonus = Math.max(0, (30 - eage) * 400);
      score += earlyBonus;
    } else if (GOOD_ENDINGS.has(eid)) {
      score += 1000; // 好结局固定加2000
      multiplier += 0.1; // 额外20%总分加成
      
      // 越早达成越牛：每早一年多加400分
      const earlyBonus = Math.max(0, (30 - eage) * 200);
      score += earlyBonus;
    }
  }

  return Math.max(0, Math.floor(score * multiplier));
}

function animateScore(targetScore) {
  const scoreEl = $('summary-score-val');
  const rankEl = $('summary-score-rank');
  rankEl.className = 'score-rank'; // reset
  rankEl.textContent = '';
  scoreEl.textContent = '0';

  let current = 0;
  const duration = 3000; // ms
  const start = performance.now();

  function update(time) {
    const elapsed = time - start;
    const progress = Math.min(elapsed / duration, 1);
    // easeOutExpo
    const ease = 1 - Math.pow(1 - progress, 4);
    current = Math.floor(ease * targetScore);
    scoreEl.textContent = current;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      scoreEl.textContent = targetScore;
      
      // Determine Rank
      let rankText = 'F级 你是人吗';
      let rankClass = 'rank-F';
      if (targetScore >= 30000) { rankText = 'S+ 璀璨传奇'; rankClass = 'rank-S'; }
      else if (targetScore >= 25000) { rankText = 'S级 人中龙凤'; rankClass = 'rank-S'; }
      else if (targetScore >= 20000) { rankText = 'A级 高质量人类'; rankClass = 'rank-A'; }
      else if (targetScore >= 15000) { rankText = 'B级 人上人'; rankClass = 'rank-B'; }
      else if (targetScore >= 9000) { rankText = 'C级 勉强算人'; rankClass = 'rank-C'; }


      // Split into rank grade line + comment line
      const parts = rankText.match(/^(\S+)\s+(.+)$/);
      if (parts) {
        rankEl.innerHTML = `<span class="rank-grade">${parts[1]}</span><span class="rank-comment">${parts[2]}</span>`;
      } else {
        rankEl.textContent = rankText;
      }
      rankEl.classList.add(rankClass, 'stamp');
    }
  }
  requestAnimationFrame(update);
}

// ── Title / Badge System ─────────────────────────────────────────────────────
const TITLE_DEFS = [
  // 属性类
  { id: 'max_int', icon: '🧠', name: '学霸传奇', check: () => state.INT >= 10 },
  { id: 'max_soc', icon: '🦋', name: '社交蝴蝶', check: () => state.SOC >= 10 },
  { id: 'max_mny', icon: '💰', name: '富可敌国', check: () => state.MNY >= 10 },
  { id: 'max_per', icon: '🔥', name: '钢铁意志', check: () => state.PER >= 10 },
  { id: 'max_hlt', icon: '💪', name: '铁人体魄', check: () => state.HLT >= 10 },
  { id: 'max_app', icon: '✨', name: '倾国倾城', check: () => state.APP >= 10 },
  { id: 'all_high', icon: '👑', name: '人生赢家', check: () => ['SOC','INT','MNY','PER','HLT','APP'].every(k => state[k] >= 7) },
  { id: 'all_max', icon: '🌟', name: '完美人类', check: () => ['SOC','INT','MNY','PER','HLT','APP'].every(k => state[k] >= 10) },
  // 学校类
  { id: 'top_school', icon: '🎓', name: '名校光环', check: () => state.schoolTier === 'top' },
  { id: 'grad_school', icon: '📚', name: '学术深造', check: () => state.firedEvents && [...state.firedEvents].some(id => id >= 10700 && id <= 10799) },
  // 恋爱类
  { id: 'married', icon: '💍', name: '修成正果', check: () => state.relationship === '已婚' || state.relationship === '二婚' },
  { id: 'sea_king', icon: '🌊', name: '渣王/渣后', check: () => state.relationship === '海王' || state.relationship === '海后' },
  { id: 'forever_single', icon: '🐕', name: '单身贵族', check: () => state.relationship === '单身' && state.age >= 35 },
  // 剧情类
  { id: 'multi_storyline', icon: '📖', name: '剧情收集者', check: () => state.storylinesVisited && state.storylinesVisited.size >= 2 },
  { id: 'hidden_explorer', icon: '🕵️', name: '暗面行者', check: () => state.storylinesVisited && [...state.storylinesVisited].some(s => HIDDEN_STORYLINES.has(s)) },
  // 生存类
  { id: 'long_life', icon: '🧓', name: '长命百岁', check: () => state.age >= 60 },
  { id: 'young_death', icon: '💀', name: '英年早逝', check: () => state.age <= 25 && state.phase === 'ended' },
  { id: 'happy_life', icon: '😊', name: '快乐至上', check: () => state.HAP >= 9 },
  { id: 'sad_life', icon: '😢', name: '苦中作乐', check: () => state.HAP <= 2 && state.age >= 30 },
  // 职业类
  { id: 'ceo', icon: '🏢', name: '商界大佬', check: () => state.profession && (state.profession.includes('CEO') || state.profession.includes('合伙人') || state.profession.includes('创始人')) },
  { id: 'doctor', icon: '⚕️', name: '悬壶济世', check: () => state.profession && (state.profession.includes('主治') || state.profession.includes('主任') || state.profession.includes('医生')) },
  // 特殊
  { id: 'broke_happy', icon: '🤡', name: '穷开心', check: () => state.MNY <= 2 && state.HAP >= 8 },
  { id: 'rich_sad', icon: '😞', name: '富贵闲愁', check: () => state.MNY >= 8 && state.HAP <= 3 },
];

function _computeTitles() {
  return TITLE_DEFS.filter(t => {
    try { return t.check(); } catch (e) { return false; }
  });
}

function _renderTitles(titles) {
  const el = $('summary-titles');
  if (!el) return;
  if (titles.length === 0) { el.innerHTML = ''; return; }

  // Pre-defined scattered positions (percentage-based, avoid center content)
  const POSITIONS = [
    { top: '2%', left: '3%', rotate: -12 },
    { top: '5%', right: '4%', rotate: 8 },
    { top: '15%', left: '1%', rotate: -5 },
    { top: '18%', right: '2%', rotate: 15 },
    { top: '30%', left: '2%', rotate: -18 },
    { top: '28%', right: '3%', rotate: 6 },
    { top: '42%', left: '1%', rotate: 10 },
    { top: '45%', right: '1%', rotate: -8 },
    { top: '55%', left: '3%', rotate: -14 },
    { top: '58%', right: '4%', rotate: 12 },
    { top: '68%', left: '2%', rotate: 7 },
    { top: '72%', right: '2%', rotate: -10 },
  ];

  el.innerHTML = '';
  titles.forEach((t, i) => {
    const pos = POSITIONS[i % POSITIONS.length];
    const badge = document.createElement('div');
    badge.className = 'title-badge';
    badge.innerHTML = `<span class="title-icon">${t.icon}</span><span class="title-name">${t.name}</span>`;
    badge.style.position = 'absolute';
    badge.style.top = pos.top || 'auto';
    badge.style.bottom = pos.bottom || 'auto';
    badge.style.left = pos.left || 'auto';
    badge.style.right = pos.right || 'auto';
    badge.style.setProperty('--badge-rotate', `${pos.rotate}deg`);
    badge.style.animationDelay = `${0.5 + i * 0.2}s`;
    el.appendChild(badge);
  });
}

function renderSummary() {
  const ageY = state.age;
  const ageM = state.monthOfYear;
  $('summary-subtitle').textContent = `走过 ${ageY} 岁 ${ageM} 个月`;

  // Score Animation
  const finalScore = calculateScore();
  animateScore(finalScore);

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

  // 最终结局：只取 logType=ending（来自 ev.end=true 或系统结局）
  const reversed = [...state.log].reverse();
  const endingLog = reversed.find(e => e.logType === 'ending');
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
  if (state.statPeaks.FIT !== undefined && state.statPeaks.FIT > 0) keys.push('FIT');
  if (state.statPeaks.CKL !== undefined && state.statPeaks.CKL > 0) keys.push('CKL');
  if (state.statPeaks.cul !== undefined && state.statPeaks.cul > 0) keys.push('cul');
  if (state.statPeaks.dao !== undefined && state.statPeaks.dao > 0) keys.push('dao');
  if (state.statPeaks.karma !== undefined && state.statPeaks.karma > 0) keys.push('karma');
  if (state.statPeaks.tribulation !== undefined && state.statPeaks.tribulation > 0) keys.push('tribulation');
  statsEl.innerHTML = keys.map(k => {
    const peak = state.statPeaks[k] ?? 0;
    const cur = state[k] ?? 0;
    const isSpec = ['POP','POK','MMR','FIT','CKL','cul','dao','karma','tribulation'].includes(k);
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

  // 命运抉择：玩家做出过的选择
  const hlEl = $('summary-highlights');
  const choices = state.choiceHistory || [];
  if (choices.length === 0) {
    hlEl.innerHTML = `<div class="empty-hint">没有做出过选择</div>`;
  } else {
    hlEl.innerHTML = choices.map(c => {
      const opts = c.options.map((o, i) =>
        `<span class="choice-opt${i === c.chosenIdx ? ' choice-opt-picked' : ''}">${o}</span>`
      ).join('');
      return `<div class="choice-record">
        <div class="choice-record-head"><span class="hl-tag">${c.age}</span></div>
        <div class="choice-record-ctx">${c.context}</div>
        <div class="choice-record-opts">${opts}</div>
      </div>`;
    }).join('');
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

  // ── Flowchart nudge: show if new nodes unlocked this session ──
  const fcNewCount = getSessionUnlocks();
  const existingNudge = document.getElementById('fc-nudge');
  if (existingNudge) existingNudge.remove();
  if (fcNewCount > 0) {
    const nudge = document.createElement('div');
    nudge.id = 'fc-nudge';
    nudge.className = 'fc-nudge';
    nudge.innerHTML = `<span class="fc-nudge-icon">🗺️</span> 本局解锁了 <strong>${fcNewCount}</strong> 个新命运节点 <button class="fc-nudge-btn" id="fc-nudge-go">去看看 →</button>`;
    const wrap = document.querySelector('.summary-wrap');
    if (wrap) wrap.insertBefore(nudge, wrap.querySelector('.summary-grid'));
    const goBtn = $('fc-nudge-go');
    if (goBtn) goBtn.addEventListener('click', () => { openFlowchart(); });
  }

  // ── MP: broadcast end data & show VS button & opponent status ──
  if (mp.enabled) {
    _mpBroadcastEndData();
    const vsBtn = $('btn-mp-vs');
    if (vsBtn) vsBtn.style.display = '';
    const leaveBtn = $('btn-mp-leave');
    if (leaveBtn) leaveBtn.style.display = '';
    _updateMpSummaryStatus();
  }
}

/* ═══════════════════════════════════════════════════════════════
   Multiplayer VS Comparison
   ═══════════════════════════════════════════════════════════════ */

// ── 趣味称号定义 ──
// condition(me, opp) → 'me' | 'opp' | 'both' | null
const MP_AWARDS = [
  {
    id: 'early_death', icon: '💀', name: '英年早逝奖',
    desc: '更早告别人世',
    condition: (me, opp) => {
      if (me.age === opp.age) return null;
      return me.age < opp.age ? 'me' : 'opp';
    },
  },
  {
    id: 'longevity', icon: '🐢', name: '长寿之星',
    desc: '活得最久的那个',
    condition: (me, opp) => {
      if (me.age >= 55 && opp.age >= 55) return 'both';
      if (me.age >= 55) return 'me';
      if (opp.age >= 55) return 'opp';
      return null;
    },
  },
  {
    id: 'solo_king', icon: '🐕', name: '母胎solo奖',
    desc: '至死没脱单',
    condition: (me, opp) => {
      const meS = me.relationship === '单身';
      const oppS = opp.relationship === '单身';
      if (meS && oppS) return 'both';
      if (meS) return 'me';
      if (oppS) return 'opp';
      return null;
    },
  },
  {
    id: 'sea_king', icon: '🌊', name: '海王/海后',
    desc: '感情里的多面手',
    condition: (me, opp) => {
      const meH = me.relationship === '海王' || me.relationship === '海后';
      const oppH = opp.relationship === '海王' || opp.relationship === '海后';
      if (meH && oppH) return 'both';
      if (meH) return 'me';
      if (oppH) return 'opp';
      return null;
    },
  },
  {
    id: 'brain', icon: '🧠', name: '学霸担当',
    desc: '智力值最高',
    condition: (me, opp) => {
      if (me.stats.INT === opp.stats.INT) return null;
      return me.stats.INT > opp.stats.INT ? 'me' : 'opp';
    },
  },
  {
    id: 'rich', icon: '💰', name: '人生赢家',
    desc: '最有钱的那个',
    condition: (me, opp) => {
      if (me.stats.MNY === opp.stats.MNY) return null;
      return me.stats.MNY > opp.stats.MNY ? 'me' : 'opp';
    },
  },
  {
    id: 'broke', icon: '📉', name: '最惨打工人',
    desc: '家境垫底',
    condition: (me, opp) => {
      if (me.stats.MNY <= 1 && opp.stats.MNY <= 1) return 'both';
      if (me.stats.MNY <= 1) return 'me';
      if (opp.stats.MNY <= 1) return 'opp';
      return null;
    },
  },
  {
    id: 'pretty', icon: '✨', name: '颜值巅峰',
    desc: '最好看的那位',
    condition: (me, opp) => {
      if (me.stats.APP === opp.stats.APP) return null;
      return me.stats.APP > opp.stats.APP ? 'me' : 'opp';
    },
  },
  {
    id: 'social_butterfly', icon: '🦋', name: '社交达人',
    desc: '社交能力碾压',
    condition: (me, opp) => {
      if (me.stats.SOC >= 8 && me.stats.SOC > opp.stats.SOC + 3) return 'me';
      if (opp.stats.SOC >= 8 && opp.stats.SOC > me.stats.SOC + 3) return 'opp';
      return null;
    },
  },
  {
    id: 'drama_king', icon: '🎭', name: '戏精本精',
    desc: '经历剧情线最多',
    condition: (me, opp) => {
      const meC = (me.storylinesVisited || []).length;
      const oppC = (opp.storylinesVisited || []).length;
      if (meC === oppC) return null;
      return meC > oppC ? 'me' : 'opp';
    },
  },
  {
    id: 'happy', icon: '😁', name: '快乐肥宅',
    desc: '快乐值爆表',
    condition: (me, opp) => {
      if (me.stats.HAP >= 9 && opp.stats.HAP >= 9) return 'both';
      if (me.stats.HAP >= 9) return 'me';
      if (opp.stats.HAP >= 9) return 'opp';
      return null;
    },
  },
  {
    id: 'miserable', icon: '😭', name: '人间不值得',
    desc: '快乐值见底',
    condition: (me, opp) => {
      if (me.stats.HAP <= 1 && opp.stats.HAP <= 1) return 'both';
      if (me.stats.HAP <= 1) return 'me';
      if (opp.stats.HAP <= 1) return 'opp';
      return null;
    },
  },
  {
    id: 'tough', icon: '💪', name: '钢铁意志',
    desc: '毅力值最高',
    condition: (me, opp) => {
      if (me.stats.PER >= 9 && me.stats.PER > opp.stats.PER) return 'me';
      if (opp.stats.PER >= 9 && opp.stats.PER > me.stats.PER) return 'opp';
      return null;
    },
  },
  {
    id: 'glass', icon: '🫙', name: '玻璃心体质',
    desc: '健康值见底',
    condition: (me, opp) => {
      if (me.stats.HLT <= 0 && opp.stats.HLT <= 0) return 'both';
      if (me.stats.HLT <= 0) return 'me';
      if (opp.stats.HLT <= 0) return 'opp';
      return null;
    },
  },
  {
    id: 'allrounder', icon: '🌟', name: '六边形战士',
    desc: '六维均衡且全部≥6',
    condition: (me, opp) => {
      const base = ['SOC','INT','MNY','PER','HLT','APP'];
      const meOk = base.every(k => (me.stats[k] || 0) >= 6);
      const oppOk = base.every(k => (opp.stats[k] || 0) >= 6);
      if (meOk && oppOk) return 'both';
      if (meOk) return 'me';
      if (oppOk) return 'opp';
      return null;
    },
  },
  {
    id: 'top_school', icon: '🎓', name: '名校光环',
    desc: '学校tier最高',
    condition: (me, opp) => {
      const tierRank = { top: 3, mid: 2, low: 1, '': 0 };
      const meR = tierRank[me.schoolTier] || 0;
      const oppR = tierRank[opp.schoolTier] || 0;
      if (meR === oppR) return null;
      return meR > oppR ? 'me' : 'opp';
    },
  },
  {
    id: 'score_king', icon: '🏆', name: '总分之王',
    desc: '人生综合评分最高',
    condition: (me, opp) => {
      if (Math.abs(me.score - opp.score) < 200) return null;
      return me.score > opp.score ? 'me' : 'opp';
    },
  },
];

function _mpCollectAwards(me, opp) {
  const myAwards = [];
  const oppAwards = [];
  for (const a of MP_AWARDS) {
    const winner = a.condition(me, opp);
    if (winner === 'me' || winner === 'both') myAwards.push(a);
    if (winner === 'opp' || winner === 'both') oppAwards.push(a);
  }
  return { myAwards, oppAwards };
}

function _mpRenderAwards(me, opp) {
  const { myAwards, oppAwards } = _mpCollectAwards(me, opp);
  // Cap at 4 each
  const myShow = myAwards.slice(0, 4);
  const oppShow = oppAwards.slice(0, 4);
  const renderList = (list) => list.length === 0
    ? '<div class="award-empty">无称号</div>'
    : list.map(a => `
        <div class="award-chip">
          <span class="award-icon">${a.icon}</span>
          <div class="award-text">
            <span class="award-name">${a.name}</span>
            <span class="award-desc">${a.desc}</span>
          </div>
        </div>
      `).join('');

  return `
    <div class="mp-vs-awards-title">颁奖典礼</div>
    <div class="mp-vs-awards-cols">
      <div class="mp-vs-awards-col left">
        <div class="awards-col-name">${me.nickname}</div>
        ${renderList(myShow)}
      </div>
      <div class="mp-vs-awards-col right">
        <div class="awards-col-name">${opp.nickname}</div>
        ${renderList(oppShow)}
      </div>
    </div>
  `;
}

function _mpBuildMySnapshot() {
  const score = calculateScore();
  const ageDeath = state.HLT <= -5;
  return {
    nickname: mp.myNickname || '我',
    age: state.age, month: state.monthOfYear,
    score,
    sex: state.sex,
    school: state.school || '无',
    schoolTier: state.schoolTier || '',
    major: state.major || '未定',
    profession: state.profession || '未定',
    relationship: state.relationship || '单身',
    country: state.country || '',
    storylinesVisited: [...(state.storylinesVisited || [])],
    endingId: state.endingId || null,
    deathCause: ageDeath ? '健康崩溃' : (state.age >= 60 ? '善终退休' : '剧情结局'),
    stats: {
      SOC: state.SOC || 0, INT: state.INT || 0, MNY: state.MNY || 0,
      PER: state.PER || 0, HLT: state.HLT || 0, APP: state.APP || 0, HAP: state.HAP || 0,
    },
    peaks: { ...(state.statPeaks || {}) },
    talentNames: (state.talentsPicked || []).map(t => t.name),
    milestones: [...(state.milestones || [])],
    cardHistory: [...(state.cardHistory || [])],
    // Avatar state for rendering
    avatarState: {
      sex: state.sex, skinTone: state.skinTone,
      faceVariant: state.faceVariant, topVariant: state.topVariant,
      bottomVariant: state.bottomVariant, outfitColorId: state.outfitColorId,
      SOC: state.SOC, INT: state.INT, MNY: state.MNY,
      PER: state.PER, HLT: state.HLT, APP: state.APP, HAP: state.HAP,
      school: state.school, profession: state.profession, storyline: state.storyline,
    },
  };
}

function _mpBroadcastEndData() {
  _mpMyEndData = _mpBuildMySnapshot();
  if (mp.connected && mpSend) {
    mpSend('game_end', _mpMyEndData);
  }
}

function _updateMpSummaryStatus() {
  const el = $('mp-summary-status');
  const txt = $('mp-summary-status-text');
  if (!el || !txt) return;
  if (!mp.enabled) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  const oppName = mp.opponent?.nickname || '对方';
  if (_mpOppEndData) {
    el.classList.add('opp-ended');
    txt.textContent = `${oppName} 已结束人生（${_mpOppEndData.age}岁，${_mpOppEndData.score || '—'}分）— 点击「查看双人对比」`;
  } else if (!mp.connected) {
    el.classList.remove('opp-ended');
    txt.textContent = `${oppName} 已断开连接`;
  } else {
    el.classList.remove('opp-ended');
    txt.textContent = `${oppName} 还在奋斗中…结束后可查看双人对比`;
  }
}

function _mpShowVsComparison() {
  const me = _mpMyEndData;
  const opp = _mpOppEndData;
  if (!me) return;

  const ov = $('mp-vs-overlay');
  if (!ov) return;
  ov.style.display = '';

  // Subtitle
  const sub = $('mp-vs-subtitle');
  if (opp) {
    sub.textContent = `${me.nickname} vs ${opp.nickname} — 谁的人生更精彩？`;
  } else {
    sub.textContent = `对方还在奋斗中…对比数据使用最后同步的状态`;
  }

  // ── Avatars ──
  $('mp-vs-name-me').textContent = me.nickname;
  $('mp-vs-age-me').textContent = `${me.age}岁${me.month}个月`;
  $('mp-vs-score-me').textContent = me.score + '分';

  // Render my avatar
  const myCanvas = $('mp-vs-avatar-me');
  if (myCanvas) renderAvatar(myCanvas, me.avatarState);

  if (opp) {
    $('mp-vs-name-opp').textContent = opp.nickname;
    $('mp-vs-age-opp').textContent = `${opp.age}岁${opp.month || 1}个月`;
    $('mp-vs-score-opp').textContent = (opp.score || 0) + '分';
    // Render opponent avatar
    const oppCanvas = $('mp-vs-avatar-opp');
    if (oppCanvas && opp.avatarState) renderAvatar(oppCanvas, opp.avatarState);
  } else {
    // Use last synced opponent data
    $('mp-vs-name-opp').textContent = mp.opponent.nickname || '对手';
    $('mp-vs-age-opp').textContent = `${mp.opponent.age || '?'}岁`;
    $('mp-vs-score-opp').textContent = '进行中…';
  }

  // ── Winner / loser visual weight ──
  const myScore = me.score || 0;
  const oppScore = opp ? (opp.score || 0) : 0;
  const leftPlayer = document.querySelector('.mp-vs-left');
  const rightPlayer = document.querySelector('.mp-vs-right');
  if (leftPlayer) leftPlayer.classList.remove('vs-winner', 'vs-loser');
  if (rightPlayer) rightPlayer.classList.remove('vs-winner', 'vs-loser');
  if (opp && Math.abs(myScore - oppScore) >= 500) {
    if (myScore > oppScore) {
      if (leftPlayer) leftPlayer.classList.add('vs-winner');
      if (rightPlayer) rightPlayer.classList.add('vs-loser');
    } else {
      if (rightPlayer) rightPlayer.classList.add('vs-winner');
      if (leftPlayer) leftPlayer.classList.add('vs-loser');
    }
  }

  // ── Relation badge ──
  const rel = mp.relation || 0;
  const relBadge = $('mp-vs-relation-badge');
  const relCls = rel > 20 ? 'pos' : rel < -20 ? 'neg' : 'neutral';
  relBadge.className = 'mp-vs-relation-badge ' + relCls;
  relBadge.textContent = `好感度 ${rel > 0 ? '+' : ''}${rel}`;

  // ── Radar Chart ──
  const statsKeys = ['SOC', 'INT', 'MNY', 'PER', 'HLT', 'APP', 'HAP'];
  const oppStats = opp ? opp.stats : (mp.opponent.stats || {});
  const statsEl = $('mp-vs-stats');
  const maxStat = 20; // grid boundary = 20; values >20 burst outside

  // SVG radar geometry — use larger viewBox to accommodate overflow
  const cx = 200, cy = 180, R = 110;
  const n = statsKeys.length;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2; // top

  function polar(angle, r) {
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  // Grid rings (3 levels: 7, 14, 20)
  let gridSvg = '';
  for (const frac of [0.35, 0.7, 1]) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = startAngle + i * angleStep;
      pts.push(polar(a, R * frac).join(','));
    }
    gridSvg += `<polygon points="${pts.join(' ')}" class="mp-vs-radar-grid"/>`;
  }

  // Axes
  let axisSvg = '';
  for (let i = 0; i < n; i++) {
    const a = startAngle + i * angleStep;
    const [ex, ey] = polar(a, R);
    axisSvg += `<line x1="${cx}" y1="${cy}" x2="${ex}" y2="${ey}" class="mp-vs-radar-axis"/>`;
  }

  // Data polygons — NO cap, values >20 burst outside circle
  function dataPoints(stats) {
    return statsKeys.map((k, i) => {
      const val = Math.max(0, stats[k] || 0);
      const r = (val / maxStat) * R; // can exceed R
      const a = startAngle + i * angleStep;
      return polar(a, Math.max(r, R * 0.05));
    });
  }
  const myPts = dataPoints(me.stats);
  const oppPts = dataPoints(oppStats);

  // Labels + values at each axis (pushed further out)
  let labelSvg = '';
  for (let i = 0; i < n; i++) {
    const a = startAngle + i * angleStep;
    const [lx, ly] = polar(a, R + 34);
    labelSvg += `<text x="${lx}" y="${ly}" class="mp-vs-radar-label">${STAT_LABELS[statsKeys[i]]}</text>`;
    const myV = me.stats[statsKeys[i]] || 0;
    const oppV = oppStats[statsKeys[i]] || 0;
    labelSvg += `<text x="${lx - 14}" y="${ly + 14}" class="mp-vs-radar-val p1">${myV}</text>`;
    labelSvg += `<text x="${lx + 14}" y="${ly + 14}" class="mp-vs-radar-val p2">${oppV}</text>`;
  }

  statsEl.innerHTML = `<svg class="mp-vs-radar-svg" viewBox="0 0 400 360">
    ${gridSvg}${axisSvg}
    <polygon points="${oppPts.map(p => p.join(',')).join(' ')}" class="mp-vs-radar-poly p2"/>
    <polygon points="${myPts.map(p => p.join(',')).join(' ')}" class="mp-vs-radar-poly p1"/>
    ${labelSvg}
  </svg>`;

  // ── Bar comparison (below radar) ──
  let barsEl = document.getElementById('mp-vs-bars');
  if (!barsEl) {
    barsEl = document.createElement('div');
    barsEl.id = 'mp-vs-bars';
    barsEl.className = 'mp-vs-bars';
    statsEl.parentNode.insertBefore(barsEl, statsEl.nextSibling);
  }
  // Find the max absolute value across both players for scaling
  const allVals = statsKeys.map(k => Math.max(Math.abs(me.stats[k] || 0), Math.abs(oppStats[k] || 0)));
  const barScale = Math.max(...allVals, 1);

  let barsHtml = '';
  for (const k of statsKeys) {
    const myV = me.stats[k] || 0;
    const oppV = oppStats[k] || 0;
    const myW = Math.abs(myV) / barScale * 100;
    const oppW = Math.abs(oppV) / barScale * 100;
    const myWin = myV > oppV;
    const oppWin = oppV > myV;
    const myNeg = myV < 0;
    const oppNeg = oppV < 0;
    barsHtml += `<div class="mp-vs-bar-row">
      <div class="bar-label">${STAT_LABELS[k]}</div>
      <div class="bar-pair">
        <div class="bar-line">
          <span class="bar-val p1${myNeg ? ' negative' : ''}${myWin ? ' win' : ''}">${myV}</span>
          <div class="bar-track"><div class="bar-fill p1${myWin ? ' win' : ''}" style="width:${myW}%"></div></div>
        </div>
        <div class="bar-line">
          <span class="bar-val p2${oppNeg ? ' negative' : ''}${oppWin ? ' win' : ''}">${oppV}</span>
          <div class="bar-track"><div class="bar-fill p2${oppWin ? ' win' : ''}" style="width:${oppW}%"></div></div>
        </div>
      </div>
    </div>`;
  }
  barsEl.innerHTML = barsHtml;

  // ── Life comparison ──
  const oppData = opp || {};
  const lifeEl = $('mp-vs-life');
  const rows = [
    ['学校', me.school, oppData.school || mp.opponent.school || '—'],
    ['专业', me.major, oppData.major || mp.opponent.major || '未定'],
    ['职业', me.profession, oppData.profession || mp.opponent.profession || '—'],
    ['恋爱', me.relationship, oppData.relationship || mp.opponent.relationship || '单身'],
    ['活到', `${me.age}岁`, opp ? `${opp.age}岁` : '进行中'],
    ['死因', me.deathCause, oppData.deathCause || '—'],
  ];
  lifeEl.innerHTML = `
    <div class="mp-vs-life-card">
      <div class="lc-label">人生轨迹</div>
      ${rows.map(([label, myV, oppV]) => `
        <div class="lc-row">
          <span class="lc-val-me">${myV}</span>
          <span class="lc-vs">${label}</span>
          <span class="lc-val-opp">${oppV}</span>
        </div>
      `).join('')}
    </div>
    <div class="mp-vs-life-card">
      <div class="lc-label">天赋对比</div>
      ${(() => {
        const myT = me.talentNames || [];
        const oppT = oppData.talentNames || [];
        const maxLen = Math.max(myT.length, oppT.length, 1);
        let html = '';
        for (let i = 0; i < maxLen; i++) {
          html += `<div class="lc-row">
            <span class="lc-val-me">${myT[i] || '—'}</span>
            <span class="lc-vs">天赋${i+1}</span>
            <span class="lc-val-opp">${oppT[i] || '—'}</span>
          </div>`;
        }
        return html;
      })()}
    </div>
  `;

  // ── Awards ──
  let awardsEl = document.getElementById('mp-vs-awards');
  if (!awardsEl) {
    awardsEl = document.createElement('div');
    awardsEl.id = 'mp-vs-awards';
    awardsEl.className = 'mp-vs-awards';
    // Insert after life comparison
    const lifeEl2 = $('mp-vs-life');
    lifeEl2.parentNode.insertBefore(awardsEl, lifeEl2.nextSibling);
  }
  if (opp) {
    awardsEl.innerHTML = _mpRenderAwards(me, opp);
    awardsEl.style.display = '';
  } else {
    awardsEl.style.display = 'none';
  }

  // ── Timeline ──
  let tlEl = document.getElementById('mp-vs-timeline');
  if (!tlEl) {
    tlEl = document.createElement('div');
    tlEl.id = 'mp-vs-timeline';
    tlEl.className = 'mp-vs-timeline';
    awardsEl.parentNode.insertBefore(tlEl, awardsEl.nextSibling);
  }
  if (opp && me.milestones && opp.milestones) {
    tlEl.innerHTML = _mpRenderTimeline(me, opp);
    tlEl.style.display = '';
  } else {
    tlEl.style.display = 'none';
  }

  // ── Card recap ──
  let cardEl = document.getElementById('mp-vs-cardrecap');
  if (!cardEl) {
    cardEl = document.createElement('div');
    cardEl.id = 'mp-vs-cardrecap';
    cardEl.className = 'mp-vs-cardrecap';
    tlEl.parentNode.insertBefore(cardEl, tlEl.nextSibling);
  }
  if (me.cardHistory && me.cardHistory.length > 0 || opp && opp.cardHistory && opp.cardHistory.length > 0) {
    cardEl.innerHTML = _mpRenderCardRecap(me, opp);
    cardEl.style.display = '';
  } else {
    cardEl.style.display = 'none';
  }

  // ── Commentary ──
  const comEl = $('mp-vs-commentary');
  comEl.innerHTML = _mpGenerateCommentary(me, opp || null);

  // ── Relation story ──
  const rsEl = $('mp-vs-relation-story');
  rsEl.innerHTML = _mpGenerateRelationStory(rel, me, opp || null);
}

function _mpGenerateCommentary(me, opp) {
  const lines = [];
  let winnerName = '';

  if (opp) {
    const scoreDiff = me.score - opp.score;
    const w = scoreDiff >= 0 ? me : opp;
    const l = scoreDiff >= 0 ? opp : me;
    const gap = Math.abs(scoreDiff);

    if (gap < 500) {
      winnerName = '🤝 不分伯仲';
      lines.push('势均力敌，这辈子算打了个平手');
      lines.push('差距不到500分，你俩上辈子是不是双胞胎？');
    } else {
      winnerName = `🏆 ${w.nickname} 胜出！`;
      if (gap > 15000) {
        lines.push(`${l.nickname}，你这不叫人生，叫体验服试玩`);
        lines.push(`碾压级差距，${w.nickname}赢麻了`);
      } else if (gap > 10000) {
        lines.push(`${l.nickname}，下辈子见`);
        lines.push(`分差过万，建议${l.nickname}申请重开`);
      } else if (gap > 5000) {
        lines.push(`${w.nickname}赢得不算冤枉`);
        lines.push(`差了${gap}分，够${l.nickname}哭好几个通宵的`);
      } else if (gap > 2000) {
        lines.push(`险胜，但也够吹一辈子了`);
        lines.push(`不多不少，差了${gap}分的体面`);
      } else {
        lines.push(`险胜，但也够吹一辈子了`);
        lines.push(`只差${gap}分，${l.nickname}估计要拍大腿`);
      }
    }

    // Age comparison
    const ageDiff = Math.abs(me.age - opp.age);
    const older = me.age >= opp.age ? me : opp;
    const younger = me.age >= opp.age ? opp : me;
    if (ageDiff > 20) {
      lines.push(`${older.nickname}多活了${ageDiff}年，${younger.nickname}的人生才刚到高潮就结束了`);
    } else if (ageDiff > 10) {
      lines.push(`多活${ageDiff}年，这本身就是一种胜利`);
    }
    if (older.age >= 55 && younger.age < 30) {
      lines.push(`一个安度晚年，一个英年早逝——命运有时候就是这么不讲道理`);
    }
    if (younger.age < 22) {
      lines.push(`${younger.nickname}连毕业典礼都没等到，人生剧本写了个开头就完结了`);
    }

    // Stat contrasts
    const myTotal = Object.values(me.stats).reduce((a, b) => a + b, 0);
    const oppTotal = Object.values(opp.stats).reduce((a, b) => a + b, 0);
    if (Math.abs(myTotal - oppTotal) > 20) {
      const stronger = myTotal > oppTotal ? me : opp;
      const weaker = myTotal > oppTotal ? opp : me;
      lines.push(`六维属性差距悬殊，${weaker.nickname}属于被全方位碾压`);
    }

    // Happiness
    if (me.stats.HAP <= 1 && opp.stats.HAP >= 8) lines.push(`${me.nickname}苦了一辈子，${opp.nickname}笑了一辈子——快乐才是真赢家`);
    else if (opp.stats.HAP <= 1 && me.stats.HAP >= 8) lines.push(`${opp.nickname}苦了一辈子，${me.nickname}笑了一辈子——快乐才是真赢家`);
    else if (me.stats.HAP <= 2 && opp.stats.HAP <= 2) lines.push('两个人都不快乐，这局没有赢家');

    // Money
    if (me.stats.MNY >= 10 && opp.stats.MNY <= 2) lines.push(`${me.nickname}财务自由，${opp.nickname}吃土度日——贫富差距照进现实`);
    else if (opp.stats.MNY >= 10 && me.stats.MNY <= 2) lines.push(`${opp.nickname}财务自由，${me.nickname}吃土度日——贫富差距照进现实`);
    else if (me.stats.MNY <= 1 && opp.stats.MNY <= 1) lines.push('都穷到叮当响，至少苦难面前人人平等');

    // Intelligence
    if (Math.abs((me.stats.INT || 0) - (opp.stats.INT || 0)) > 6) {
      const smart = (me.stats.INT || 0) > (opp.stats.INT || 0) ? me : opp;
      const dumb = (me.stats.INT || 0) > (opp.stats.INT || 0) ? opp : me;
      lines.push(`智力差距太大，${dumb.nickname}可能到现在还没搞懂怎么输的`);
    }

    // Health / negative stats
    if ((me.stats.HLT || 0) < 0 || (opp.stats.HLT || 0) < 0) {
      const sick = (me.stats.HLT || 0) < (opp.stats.HLT || 0) ? me : opp;
      lines.push(`${sick.nickname}的健康值都成负数了，这身体怕是欠了阎王债`);
    }

    // Relationship roasts
    if (me.relationship === '单身' && opp.relationship === '单身') {
      lines.push('两个单身狗的碰撞，至少这个很公平');
    } else if (me.relationship === '单身' && (opp.relationship === '已婚' || opp.relationship === '二婚')) {
      lines.push(`${opp.nickname}找到了另一半，${me.nickname}只找到了外卖app`);
    } else if (opp.relationship === '单身' && (me.relationship === '已婚' || me.relationship === '二婚')) {
      lines.push(`${me.nickname}找到了另一半，${opp.nickname}只找到了外卖app`);
    }
    if ((me.relationship === '海王' || me.relationship === '海后') && (opp.relationship === '海王' || opp.relationship === '海后')) {
      lines.push('都是海王，修罗场现场，建议组个渣王宇宙');
    }
    if ((me.relationship === '离异' && opp.relationship === '已婚') || (opp.relationship === '离异' && me.relationship === '已婚')) {
      const divorced = me.relationship === '离异' ? me : opp;
      lines.push(`${divorced.nickname}的婚姻没能撑到最后，有些缘分确实强求不来`);
    }

    // School comparison
    if (me.school && opp.school && me.school !== opp.school) {
      if (me.schoolTier === 'top' && opp.schoolTier === 'low') lines.push(`${me.nickname}名校出身，${opp.nickname}……也是读过书的`);
      else if (opp.schoolTier === 'top' && me.schoolTier === 'low') lines.push(`${opp.nickname}名校出身，${me.nickname}……也是读过书的`);
    }

    // Death cause roast
    if (me.deathCause && opp.deathCause && me.deathCause !== opp.deathCause) {
      if (me.deathCause.includes('猝死') || opp.deathCause.includes('猝死')) {
        const sudden = me.deathCause.includes('猝死') ? me : opp;
        lines.push(`${sudden.nickname}连告别的时间都没有，人生有时候连省略号都不给你`);
      }
    }
  } else {
    winnerName = '⏳ 等待对方…';
    lines.push('你已走完全程，对方还在路上');
  }

  // Pick main verdict line + 2-3 supporting lines
  const picked = [lines[0]];
  const rest = lines.slice(1).sort(() => Math.random() - 0.5).slice(0, 3);
  picked.push(...rest);

  return `
    <div class="vc-winner">${winnerName}</div>
    <div class="vc-lines">${picked.map(l => `<div class="vc-line">${l}</div>`).join('')}</div>
  `;
}

function _mpGenerateRelationStory(relation, me, opp) {
  let title, desc, cls;
  if (relation >= 80) {
    title = '💕 灵魂伴侣'; cls = 'pos';
    desc = '即使人生不同，心始终在一起';
  } else if (relation >= 50) {
    title = '🤝 铁哥们'; cls = 'pos';
    desc = '关键时刻总是互相扶持';
  } else if (relation >= 20) {
    title = '😊 不错的朋友'; cls = 'pos';
    desc = '毕业多年后还会偶尔联系';
  } else if (relation >= -20) {
    title = '😐 点头之交'; cls = 'neutral';
    desc = '同学群里潜水的那种';
  } else if (relation >= -50) {
    title = '😤 塑料同学情'; cls = 'neg';
    desc = '暗地较劲，朋友圈炫耀';
  } else if (relation >= -80) {
    title = '🔥 宿敌'; cls = 'neg';
    desc = '下辈子最好别再碰到';
  } else {
    title = '💀 不共戴天'; cls = 'neg';
    desc = '请投胎到不同星球';
  }

  return `
    <div class="rs-val ${cls}">${relation > 0 ? '+' : ''}${relation}</div>
    <div class="rs-label">${title}</div>
    <div class="rs-desc">${desc}</div>
  `;
}

// ── Timeline render ──
function _mpRenderTimeline(me, opp) {
  const myMs = me.milestones || [];
  const oppMs = opp.milestones || [];
  if (myMs.length === 0 && oppMs.length === 0) return '';

  // Merge all ages and sort
  const allAges = new Set([...myMs.map(m => m.age), ...oppMs.map(m => m.age)]);
  const sorted = [...allAges].sort((a, b) => a - b);

  const myByAge = {};
  for (const m of myMs) { if (!myByAge[m.age]) myByAge[m.age] = []; myByAge[m.age].push(m); }
  const oppByAge = {};
  for (const m of oppMs) { if (!oppByAge[m.age]) oppByAge[m.age] = []; oppByAge[m.age].push(m); }

  const typeIcons = {
    school: '🎓', overseas: '✈️', major: '📚', storyline: '🎭',
    relationship: '💕', ending: '🏁',
  };

  let html = `<div class="tl-title">人生时间线</div><div class="tl-body">`;
  for (const age of sorted) {
    const myItems = myByAge[age] || [];
    const oppItems = oppByAge[age] || [];
    html += `<div class="tl-row">`;
    html += `<div class="tl-left">${myItems.map(m => `<span class="tl-item me">${typeIcons[m.type] || '•'} ${m.text}</span>`).join('')}</div>`;
    html += `<div class="tl-center"><span class="tl-dot"></span><span class="tl-age">${age}岁</span></div>`;
    html += `<div class="tl-right">${oppItems.map(m => `<span class="tl-item opp">${typeIcons[m.type] || '•'} ${m.text}</span>`).join('')}</div>`;
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

// ── Card recap render ──
// Only use MY cardHistory (it already has both sent & received from my perspective).
// Don't merge opponent's — it would duplicate every event with swapped directions.
function _mpRenderCardRecap(me, opp) {
  const cards = (me.cardHistory || []).slice().sort((a, b) => a.age - b.age || (a.month || 0) - (b.month || 0));
  if (cards.length === 0) return '';

  const oppName = (opp && opp.nickname) || '对手';
  let html = `<div class="cr-title">损友卡战报</div><div class="cr-list">`;
  for (const c of cards) {
    const isSent = c.direction === 'sent';
    const fromName = isSent ? me.nickname : oppName;
    const toName = isSent ? oppName : me.nickname;
    html += `<div class="cr-item ${c.direction}">
      <span class="cr-age">${c.age}岁</span>
      <span class="cr-who">${fromName}</span>
      <span class="cr-dir">${isSent ? '→' : '←'}</span>
      <span class="cr-target">${toName}</span>
      <span class="cr-card">${c.cardName || c.cardId}</span>
    </div>`;
  }
  html += `</div>`;
  return html;
}

function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.remove('active');
  $(id).classList.add('active');
  document.body.classList.toggle('in-game', id === 'game-screen');
  document.body.classList.toggle('in-summary', id === 'summary-screen');
  document.body.classList.toggle('in-creation', id === 'creation-screen');
  if (id !== 'game-screen') stopAuto();
  rearrangeMobileLayout(id === 'game-screen');
}

let _mobileStatsStripUpdate = null;
let _mobileStatsGridUpdate = null;

// Re-run mobile layout when window resizes (e.g. browser DevTools toggle)
let _resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    const inGame = document.body.classList.contains('in-game');
    if (inGame) rearrangeMobileLayout(true);
  }, 200);
});

function initStripDrag(el) {
  let isDown = false, startX, scrollLeft;
  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') return;
    isDown = true;
    startX = e.pageX - el.offsetLeft;
    scrollLeft = el.scrollLeft;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if (!isDown) return;
    const x = e.pageX - el.offsetLeft;
    el.scrollLeft = scrollLeft - (x - startX);
  });
  const stop = () => { isDown = false; };
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
}

function rearrangeMobileLayout(entering) {
  const isMobile = window.matchMedia('(max-width: 760px)').matches;
  const leftPanel = document.querySelector('.left-panel');
  const rightHead = document.querySelector('.right-head');
  const rightPanel = document.querySelector('.right-panel');
  const gameLayout = document.querySelector('.game-layout');
  if (!leftPanel || !rightHead || !gameLayout) return;

  if (entering && isMobile) {
    // 创建属性 grid（替代原来的按钮区，放在头像右侧）
    if (!leftPanel.querySelector('.mobile-stats-grid')) {
      const grid = document.createElement('div');
      grid.className = 'mobile-stats-grid';
      leftPanel.appendChild(grid);
      _mobileStatsGridUpdate = () => updateMobileStatsGrid(grid);
      _mobileStatsGridUpdate();
    }

    // 创建底部条，并把按钮区(right-head)移进来
    if (!gameLayout.querySelector('.mobile-stats-strip')) {
      const strip = document.createElement('div');
      strip.className = 'mobile-stats-strip';
      gameLayout.insertBefore(strip, rightPanel);
      // 时间 chip 在最左侧
      const timeChip = document.createElement('div');
      timeChip.className = 'mp-strip-time';
      strip.appendChild(timeChip);
      strip.appendChild(rightHead);   // 按钮区在时间右边
      initStripDrag(strip);
      _mobileStatsStripUpdate = () => updateMobileStatsStrip(strip);
      _mobileStatsStripUpdate();
    }

    if (!gameLayout.querySelector('.mobile-fs-toggle')) {
      const toggle = document.createElement('div');
      toggle.className = 'mobile-fs-toggle';
      toggle.innerHTML = '<svg class="fs-arrow" viewBox="0 0 42 14"><polyline points="10,12 21,4 32,12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      toggle.addEventListener('click', () => {
        gameLayout.classList.toggle('mobile-fs');
      });
      rightPanel.insertBefore(toggle, rightPanel.firstChild);
    }
  } else if (!entering) {
    // 还原：把 right-head 放回 right-panel
    const strip = gameLayout.querySelector('.mobile-stats-strip');
    if (rightPanel && strip && rightHead.parentElement === strip) {
      rightPanel.insertBefore(rightHead, rightPanel.querySelector('.mobile-fs-toggle') || rightPanel.firstChild);
    }
    if (strip) strip.remove();
    const grid = leftPanel.querySelector('.mobile-stats-grid');
    if (grid) grid.remove();
    const toggle = rightPanel?.querySelector('.mobile-fs-toggle');
    if (toggle) toggle.remove();
    gameLayout.classList.remove('mobile-fs');
    _mobileStatsStripUpdate = null;
    _mobileStatsGridUpdate = null;
  }
}

// Strip 只放时间 chip + 按钮区（right-head 已移入 DOM）
function updateMobileStatsStrip(strip) {
  if (!strip) return;
  // 清空除时间chip和right-head外的其他残留
  Array.from(strip.children).forEach(ch => {
    if (!ch.classList.contains('right-head') && !ch.classList.contains('mp-strip-time')) ch.remove();
  });
  // 更新时间文本
  const timeChip = strip.querySelector('.mp-strip-time');
  const timeEl = document.getElementById('time-display');
  if (timeChip && timeEl) timeChip.textContent = timeEl.textContent;
}

// 头像右侧的属性 grid：时间 + 2x4 stat 单元格 + 信息 chip 列表
function updateMobileStatsGrid(grid) {
  if (!grid) return;
  const s = state;

  const timeEl = document.getElementById('time-display');
  const timeText = timeEl ? timeEl.textContent : `${s.age}岁`;

  // 基础 7 项：社/智/家/乐 + 健/毅/颜（HAP 放在第4格）
  // 触发剧情后追加 career stat 凑成 2x4（用 show* 标志判断）
  const baseKeys = ['SOC', 'INT', 'MNY', 'HAP', 'HLT', 'PER', 'APP'];
  const careerKeys = ['POP', 'POK', 'MMR', 'FIT', 'CKL', 'ATH', 'MAG'];

  let cellsHtml = '';
  for (const k of baseKeys) {
    const v = s[k] ?? 0;
    const label = STAT_LABELS[k] || k;
    const pct = Math.max(0, Math.min(100, (v / 30) * 100));
    cellsHtml += `<div class="msg-cell"><span class="msg-label">${label}</span><div class="msg-bar"><div class="msg-bar-fill" style="width:${pct}%"></div></div><span class="msg-val">${v}</span></div>`;
  }
  for (const k of careerKeys) {
    if (s['show' + k]) {
      const v = s[k] || 0;
      const label = STAT_LABELS[k] || k;
      const cap = (k === 'MMR') ? 4000 : 100;
      const pct = Math.max(0, Math.min(100, (v / cap) * 100));
      cellsHtml += `<div class="msg-cell career"><span class="msg-label">${label}</span><div class="msg-bar"><div class="msg-bar-fill" style="width:${pct}%"></div></div><span class="msg-val">${v}</span></div>`;
    }
  }

  // 信息 chip 区：专业 / 学校 / 恋爱 / 职业 / 剧情
  let infoHtml = '';
  const majorEl = document.getElementById('major-display');
  if (majorEl) infoHtml += `<div class="msg-info-chip"><span class="msg-info-label">专业</span><span class="msg-info-val">${majorEl.textContent}</span></div>`;
  // 学校/职业 始终显示，没数据时给占位文案，保证右上区域不留白
  const schoolEl = document.getElementById('school-display');
  const schoolText = schoolEl && schoolEl.parentElement && schoolEl.parentElement.style.display !== 'none'
    ? schoolEl.textContent : (s.school && s.school !== '无' ? s.school : '在读');
  infoHtml += `<div class="msg-info-chip"><span class="msg-info-label">学校</span><span class="msg-info-val">${schoolText}</span></div>`;
  const relEl = document.getElementById('relationship-display');
  if (relEl) infoHtml += `<div class="msg-info-chip"><span class="msg-info-label">恋爱</span><span class="msg-info-val">${relEl.textContent}</span></div>`;
  const profEl = document.getElementById('profession-display');
  const profText = profEl && profEl.parentElement && profEl.parentElement.style.display !== 'none'
    ? profEl.textContent : (s.profession || '高中生');
  infoHtml += `<div class="msg-info-chip"><span class="msg-info-label">职业</span><span class="msg-info-val">${profText}</span></div>`;
  const storyEl = document.getElementById('storyline-display');
  if (storyEl && storyEl.parentElement && storyEl.parentElement.style.display !== 'none') {
    infoHtml += `<div class="msg-info-chip msg-info-storyline"><span class="msg-info-label">剧情</span><span class="msg-info-val">${storyEl.textContent}</span></div>`;
  }

  grid.innerHTML = `
    <div class="msg-cells">${cellsHtml}</div>
    ${infoHtml ? `<div class="msg-info">${infoHtml}</div>` : ''}
  `;
}

function updateCreationAvatar() {
  // Temporarily sync stats for preview
  for (const k of STAT_KEYS) {
    state[k] = (state.alloc[k] || 0);
  }
  // Also apply talent bonuses to the preview
  for (const t of state.talentsPicked || []) {
    if (t.effect) {
      for (const [k, v] of Object.entries(t.effect)) {
        if (STAT_KEYS.includes(k)) state[k] = (state[k] || 0) + v;
      }
    }
  }
  for (const id of ['creation-avatar-canvas', 'alloc-avatar-canvas']) {
    const canvas = $(id);
    if (canvas) renderAvatar(canvas, state);
  }
}

// ── 修复 iOS Safari viewport 高度问题 ──────────────────────────────────────
// iOS Safari 上 URL 栏会让 100vh / 100dvh 计算异常，导致 .app 高度不对，
// 进游戏一开始下方留白，需要手动滑动一下才会重排。
// 解决方案：用 visualViewport API（iOS 13+ 支持）实时获取真实可见高度，
// 直接给 .app 设置 px 高度，比纯 CSS 单位可靠得多。
function _syncViewportHeight() {
  // 优先 visualViewport（监听 URL 栏变化最准），fallback innerHeight
  const h = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
  document.documentElement.style.setProperty('--vh', `${h * 0.01}px`);
  document.documentElement.style.setProperty('--app-height', `${h}px`);
  // 直接给 .app / .screen 强制高度，绕过浏览器的 vh 计算 bug
  const app = document.querySelector('.app');
  if (app) app.style.height = `${h}px`;
  document.querySelectorAll('.screen').forEach(el => {
    el.style.height = `${h}px`;
  });
}

// 监听各种触发点
_syncViewportHeight();
window.addEventListener('resize', _syncViewportHeight);
window.addEventListener('orientationchange', () => setTimeout(_syncViewportHeight, 100));
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', _syncViewportHeight);
  window.visualViewport.addEventListener('scroll', _syncViewportHeight);
}
// iOS 加载后 URL 栏可能继续动，多次延迟同步保险
[100, 300, 600, 1200].forEach(ms => setTimeout(_syncViewportHeight, ms));
// 首帧后再同步一次
requestAnimationFrame(_syncViewportHeight);

// ── Performance: pause all CSS animations when tab is hidden ──
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    document.body.classList.add('tab-hidden');
  } else {
    document.body.classList.remove('tab-hidden');
  }
});

async function main() {
  initAchievements();
  initFlowchart();
  setFlowchartSfx({
    onOpen: () => SFX.sfxModalOpen(),
    onClose: () => SFX.sfxModalClose(),
    onHover: () => SFX.sfxTick(),
  });
  setOnUnlock(() => SFX.sfxAchievement());
  SFX.initMuteState();

  // Flowchart open buttons
  const fcStartBtn = $('fc-open-start-btn');
  if (fcStartBtn) fcStartBtn.addEventListener('click', () => { openFlowchart(); });
  // Mute button
  const muteBtn = $('btn-mute');
  if (muteBtn) {
    muteBtn.textContent = SFX.isMuted() ? '🔇' : '🔊';
    muteBtn.addEventListener('click', () => {
      const next = !SFX.isMuted();
      SFX.setMuted(next);
      muteBtn.textContent = next ? '🔇' : '🔊';
      SFX.sfxToggle();
    });
  }
  const talents = await loadData();
  _allTalents = talents;


  $('sex-male').addEventListener('click', () => { SFX.sfxToggleOption(); state.sex = 0; $('sex-male').classList.add('active'); $('sex-female').classList.remove('active'); updateCreationAvatar(); });
  $('sex-female').addEventListener('click', () => { SFX.sfxToggleOption(); state.sex = 1; $('sex-female').classList.add('active'); $('sex-male').classList.remove('active'); updateCreationAvatar(); });

  $('btn-random-appearance').addEventListener('click', () => {
    SFX.sfxShuffle();
    state.faceVariant = Math.floor(Math.random() * 10);
    state.topVariant = Math.floor(Math.random() * 24);
    state.bottomVariant = Math.floor(Math.random() * 8);
    state.outfitColorId = Math.floor(Math.random() * 16);
    updateCreationAvatar();
  });

  // Skin tone picker (0=dark, 1=mid, 2=light)
  for (let tone = 0; tone < 3; tone++) {
    const btn = $(`skin-${tone}`);
    if (!btn) continue;
    btn.addEventListener('click', () => {
      SFX.sfxToggleOption();
      state.skinTone = tone;
      for (let t = 0; t < 3; t++) $(`skin-${t}`).classList.toggle('active', t === tone);
      updateCreationAvatar();
    });
  }

  let _scrollToAlloc = function() {
    for (const k of STAT_KEYS) {
      state.alloc[k] = 0;
    }
    renderAlloc();
    updateCreationAvatar();
    const container = $('creation-scroll-area');
    const target = $('step-alloc');
    if (container && target) {
      container.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
    }
    setTimeout(() => { target.scrollTop = 0; }, 300);
    if (window.matchMedia('(max-width: 760px)').matches) {
      const banner = target.querySelector('.alloc-banner');
      const allocList = target.querySelector('.alloc-list');
      if (banner && allocList && banner.nextElementSibling !== allocList) {
        allocList.parentNode.insertBefore(banner, allocList);
      }
    }
  };

  $('talent-confirm').addEventListener('click', () => {
    SFX.sfxConfirm();
    // In MP mode: show frenemy card draft as a separate step
    if (mp.enabled && draftFrenemyCards) {
      _renderFrenemyDraft();
      const container = $('creation-scroll-area');
      const talentStep = $('step-talents');
      const frenemyStep = $('step-frenemy');
      if (talentStep) talentStep.style.display = 'none';
      if (frenemyStep) frenemyStep.style.display = '';
      if (container) container.scrollTo({ top: 0, behavior: 'auto' });
    } else {
      _scrollToAlloc();
    }
  });

  // Frenemy card draft confirm → proceed to alloc
  $('frenemy-confirm')?.addEventListener('click', () => {
    SFX.sfxConfirm();
    const picked = state._frenemyDraftPicked || [];
    if (picked.length !== 3) return;
    mp.cards = picked.map(c => ({ ...c, used: false }));
    const frenemyStep = $('step-frenemy');
    if (frenemyStep) frenemyStep.style.display = 'none';
    // Show talents step again (for consistency) and alloc
    const talentStep = $('step-talents');
    if (talentStep) talentStep.style.display = '';
    _scrollToAlloc();
  });

  for (const k of STAT_KEYS) {
    $(`plus-${k}`).addEventListener('click', () => {
      const used = Object.values(state.alloc).reduce((a, b) => a + b, 0);
      if (used < ALLOC_TOTAL && state.alloc[k] < MAX_PER_STAT) {
        SFX.sfxAllocTick();
        state.alloc[k] += 1;
        renderAlloc();
        updateCreationAvatar();
      }
    });
    $(`minus-${k}`).addEventListener('click', () => {
      if (state.alloc[k] > 0) {
        SFX.sfxAllocTick();
        state.alloc[k] -= 1;
        renderAlloc();
        updateCreationAvatar();
      }
    });
  }

  $('alloc-back-to-talent').addEventListener('click', () => {
    SFX.sfxBack();
    const container = $('creation-scroll-area');
    const target = $('step-talents');
    if (container && target) {
      container.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
    }
    setTimeout(() => { target.scrollTop = 0; }, 300);
  });

  $('alloc-random').addEventListener('click', () => {
    SFX.sfxShuffle();
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
    updateCreationAvatar();
  });

  $('alloc-start').addEventListener('click', () => { SFX.sfxConfirm(); initGame(); });

  // ── Stat Preset System ──────────────────────────────────────────────────
  const PRESET_LS_KEY = 'studyAbroad_presets_v1';
  const SYSTEM_PRESETS = [
    { name: '社牛', stats: { SOC: 10, INT: 3, MNY: 3, PER: 3, HLT: 3, APP: 3 }, system: true },
    { name: '学霸', stats: { SOC: 1, INT: 10, MNY: 3, PER: 6, HLT: 2, APP: 3 }, system: true },
    { name: '富富富', stats: { SOC: 3, INT: 3, MNY: 10, PER: 3, HLT: 3, APP: 3 }, system: true },
    { name: '颜值狂魔', stats: { SOC: 3, INT: 2, MNY: 3, PER: 2, HLT: 5, APP: 10 }, system: true },
    { name: '健康达人', stats: { SOC: 3, INT: 3, MNY: 3, PER: 3, HLT: 10, APP: 3 }, system: true },
    { name: '均衡发展', stats: { SOC: 4, INT: 4, MNY: 4, PER: 5, HLT: 4, APP: 4 }, system: true },
    { name: '意志如铁', stats: { SOC: 2, INT: 5, MNY: 2, PER: 10, HLT: 4, APP: 2 }, system: true },
  ];

  function _loadUserPresets() {
    try {
      return JSON.parse(localStorage.getItem(PRESET_LS_KEY) || '[]');
    } catch { return []; }
  }
  function _saveUserPresets(list) {
    localStorage.setItem(PRESET_LS_KEY, JSON.stringify(list));
  }
  function _applyPreset(stats) {
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    if (total !== ALLOC_TOTAL) return;
    for (const k of STAT_KEYS) {
      if (typeof stats[k] !== 'number' || stats[k] < 0 || stats[k] > MAX_PER_STAT) return;
    }
    for (const k of STAT_KEYS) state.alloc[k] = stats[k];
    SFX.sfxConfirm();
    renderAlloc();
    updateCreationAvatar();
  }
  function _renderPresets() {
    const container = $('preset-list');
    if (!container) return;
    const userPresets = _loadUserPresets();
    const all = [...SYSTEM_PRESETS, ...userPresets];
    container.innerHTML = all.map((p, i) => {
      const isSystem = p.system;
      const userIdx = isSystem ? -1 : i - SYSTEM_PRESETS.length;
      const summary = STAT_KEYS.map(k => `${STAT_LABELS[k]}${p.stats[k]}`).join(' / ');
      const dataAttr = isSystem ? `data-sysidx="${i}"` : `data-idx="${userIdx}"`;
      return `<span class="preset-chip ${isSystem ? 'system' : 'user'}" ${dataAttr} title="${summary}">` +
        `${p.name}` +
        `${isSystem ? '' : `<span class="preset-del" data-delidx="${userIdx}">✕</span>`}</span>`;
    }).join('');
  }

  $('preset-list')?.addEventListener('click', (e) => {
    const del = e.target.closest('.preset-del');
    if (del) {
      const idx = parseInt(del.dataset.delidx);
      const userPresets = _loadUserPresets();
      if (idx >= 0 && idx < userPresets.length) {
        userPresets.splice(idx, 1);
        _saveUserPresets(userPresets);
        _renderPresets();
      }
      return;
    }
    const chip = e.target.closest('.preset-chip');
    if (!chip) return;
    const sysIdx = parseInt(chip.dataset.sysidx ?? '-1');
    const userIdx = parseInt(chip.dataset.idx);
    const preset = sysIdx >= 0 ? SYSTEM_PRESETS[sysIdx] : _loadUserPresets()[userIdx];
    if (preset) _applyPreset(preset.stats);
  });

  function _showToast(msg, duration = 2000) {
    const el = $('preset-toast');
    if (!el) return;
    el.textContent = msg;
    el.style.display = '';
    el.style.animation = 'none';
    el.offsetHeight; // reflow
    el.style.animation = '';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.display = 'none'; }, duration);
  }

  function _showModal({ title, inputMode, placeholder, defaultValue, onConfirm }) {
    const overlay = $('preset-modal-overlay');
    const titleEl = $('preset-modal-title');
    const body = $('preset-modal-body');
    const confirmBtn = $('preset-modal-confirm');
    const cancelBtn = $('preset-modal-cancel');
    if (!overlay) return;

    titleEl.textContent = title || '提示';
    if (inputMode === 'textarea') {
      body.innerHTML = `<textarea id="preset-modal-ta" class="preset-modal-textarea" placeholder="${placeholder || ''}">${defaultValue || ''}</textarea>`;
    } else {
      body.innerHTML = `<input type="text" id="preset-modal-input" class="preset-modal-input" placeholder="${placeholder || ''}" maxlength="20" value="${defaultValue || ''}" />`;
    }
    overlay.style.display = '';
    const inputEl = body.querySelector('input, textarea');
    setTimeout(() => inputEl?.focus(), 50);

    function close() {
      overlay.style.display = 'none';
      confirmBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', close);
      overlay.removeEventListener('click', onBg);
      inputEl?.removeEventListener('keydown', onKey);
    }
    function onOk() {
      const val = inputEl?.value || '';
      close();
      if (onConfirm) onConfirm(val);
    }
    function onBg(e) { if (e.target === overlay) close(); }
    function onKey(e) { if (e.key === 'Enter' && inputMode !== 'textarea') onOk(); if (e.key === 'Escape') close(); }

    confirmBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', onBg);
    inputEl?.addEventListener('keydown', onKey);
  }

  $('preset-save')?.addEventListener('click', () => {
    const used = Object.values(state.alloc).reduce((a, b) => a + b, 0);
    if (used !== ALLOC_TOTAL) {
      _showToast('请先分配完所有点数再保存');
      return;
    }
    _showModal({
      title: '保存预设',
      placeholder: '输入预设名称',
      onConfirm(name) {
        if (!name || !name.trim()) return;
        const userPresets = _loadUserPresets();
        userPresets.push({ name: name.trim(), stats: { ...state.alloc } });
        _saveUserPresets(userPresets);
        _renderPresets();
        _showToast('预设已保存');
      },
    });
  });

  $('preset-export')?.addEventListener('click', () => {
    const userPresets = _loadUserPresets();
    const all = [
      ...SYSTEM_PRESETS.map(p => ({ name: p.name, stats: p.stats, system: true })),
      ...userPresets.map(p => ({ name: p.name, stats: p.stats })),
    ];
    if (all.length === 0) { _showToast('没有可导出的预设'); return; }
    const overlay = $('preset-modal-overlay');
    const titleEl = $('preset-modal-title');
    const body = $('preset-modal-body');
    const confirmBtn = $('preset-modal-confirm');
    const cancelBtn = $('preset-modal-cancel');
    titleEl.textContent = '选择要导出的预设';
    body.innerHTML = `<div class="preset-export-pick">${all.map((p, i) => {
      const summary = STAT_KEYS.map(k => `${STAT_LABELS[k]}${p.stats[k]}`).join('/');
      return `<label class="preset-export-item"><input type="checkbox" value="${i}" /><span>${p.name}</span><span class="preset-export-summary">${summary}</span></label>`;
    }).join('')}</div>`;
    overlay.style.display = '';

    function close() {
      overlay.style.display = 'none';
      confirmBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', close);
      overlay.removeEventListener('click', onBg);
    }
    function onOk() {
      const checks = body.querySelectorAll('input[type=checkbox]:checked');
      const picked = Array.from(checks).map(c => {
        const p = all[parseInt(c.value)];
        return { name: p.name, stats: p.stats };
      });
      close();
      if (picked.length === 0) { _showToast('未选择任何预设'); return; }
      const json = JSON.stringify(picked);
      navigator.clipboard.writeText(json).then(() => {
        _showToast(`已导出 ${picked.length} 个预设到剪贴板`);
      }).catch(() => {
        _showModal({ title: '导出结果', inputMode: 'textarea', defaultValue: json });
      });
    }
    function onBg(e) { if (e.target === overlay) close(); }
    confirmBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', onBg);
  });

  $('preset-import')?.addEventListener('click', () => {
    _showModal({
      title: '导入预设',
      inputMode: 'textarea',
      placeholder: '粘贴预设代码',
      onConfirm(raw) {
        if (!raw || !raw.trim()) return;
        try {
          const arr = JSON.parse(raw.trim());
          if (!Array.isArray(arr)) throw new Error('格式错误');
          const valid = arr.filter(p =>
            p && p.name && p.stats &&
            STAT_KEYS.every(k => typeof p.stats[k] === 'number') &&
            Object.values(p.stats).reduce((a, b) => a + b, 0) === ALLOC_TOTAL
          ).map(p => ({ name: p.name, stats: p.stats }));
          if (valid.length === 0) { _showToast('没有找到有效的预设'); return; }
          const userPresets = _loadUserPresets();
          userPresets.push(...valid);
          _saveUserPresets(userPresets);
          _renderPresets();
          _showToast(`成功导入 ${valid.length} 个预设`);
        } catch { _showToast('导入失败，请检查格式'); }
      },
    });
  });

  _renderPresets();

  $('btn-auto-1x').addEventListener('click', () => {
    SFX.sfxAutoToggle();
    startAuto(1);
  });

  $('btn-auto-2x').addEventListener('click', () => {
    SFX.sfxAutoToggle();
    startAuto(2);
  });

  document.querySelector('.right-panel').addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    if (state.phase === 'ended') {
      if (!_endCinematicShown) showEndCinematic();
      return;
    }
    advanceMonth();
  });

  $('btn-restart').addEventListener('click', () => {
    SFX.sfxRestart();
    showScreen('start-screen');
    location.reload();
  });

  $('btn-try-debut').addEventListener('click', async () => {
    if (state.phase === 'ended') return;
    if (state.storyline !== 'idol') return;
    if (state.idol_stage !== 'debut_window') return;
    if (state.debut_attempted) return;
    const prob = computeDebutProb(state);
    const ok = await showConfirm({
      title: '尝试出道',
      body: '现在向事务所提交最终试镜——只有一次机会。',
      stats: [
        { label: '成功率', value: prob + '%', tone: probTone(prob) },
        { label: '成功', value: '明星之路' },
        { label: '失败', value: '网红主播', tone: 'warn' },
      ],
    });
    if (!ok) return;
    stopAuto();
    attemptDebut(false);
  });

  const btnTryCeo = $('btn-try-ceo');
  if (btnTryCeo) {
    btnTryCeo.addEventListener('click', async () => {
      if (state.phase === 'ended') return;
      if (state.storyline !== 'party') return;
      if (state.party_stage !== 'ceo_window') return;
      if (state.ceo_attempted) return;
      const prob = computeCeoProb(state);
      const ok = await showConfirm({
        title: '尝试转型',
        body: '退出派对圈，把人脉和余钱押到合伙创业上。',
        stats: [
          { label: '成功率', value: prob + '%', tone: probTone(prob) },
          { label: '成功', value: 'CEO 之路' },
          { label: '失败', value: '派对散场，沦为废人', tone: 'bad' },
        ],
      });
      if (!ok) return;
      stopAuto();
      attemptCeo(false);
    });
  }

  const btnTryFitness = $('btn-try-fitness');
  if (btnTryFitness) {
    btnTryFitness.addEventListener('click', async () => {
      if (state.phase === 'ended') return;
      if (state.storyline !== 'fitness') return;
      if (state.fitness_attempted) return;
      const prob = computeFitnessProb(state);
      const ok = await showConfirm({
        title: '登上奥林匹亚',
        body: '这是职业健美的最高舞台。你准备好展示你的钢铁躯壳了吗？',
        stats: [
          { label: '夺冠概率', value: prob + '%', tone: probTone(prob) },
          { label: '成功', value: '诸神黄昏 (终极成就)' },
          { label: '失败', value: '遗憾离场', tone: 'warn' },
        ],
        okText: '开始展示',
        cancelText: '再练一个月'
      });
      if (ok) attemptFitness();
    });
  }

  const btnTryChef = $('btn-try-chef');
  if (btnTryChef) {
    btnTryChef.addEventListener('click', async () => {
      if (state.phase === 'ended') return;
      if (state.storyline !== 'chef') return;
      if (state.chef_attempted) return;
      const prob = computeChefProb(state);
      const ok = await showConfirm({
        title: '呈上主菜',
        body: '米其林密探已经落座。这一道菜将决定你餐车的命运。',
        stats: [
          { label: '获星概率', value: prob + '%', tone: probTone(prob) },
          { label: '成功', value: '晋升星级主厨' },
          { label: '失败', value: '维持现状', tone: 'warn' },
        ],
        okText: '呈上菜品',
        cancelText: '再调整一下'
      });
      if (ok) attemptChef();
    });
  }

  const btnTryAthlete = $('btn-try-athlete');
  if (btnTryAthlete) {
    btnTryAthlete.addEventListener('click', async () => {
      if (state.phase === 'ended') return;
      if (state.storyline !== 'athlete') return;
      if (state.athlete_attempted) return;
      const prob = computeAthleteProb(state);
      const sport = state.sport_type || 'basketball';
      const ok = await showConfirm({
        title: SPORT_LABELS[sport] || '职业选拔',
        body: '选拔的日子到了。所有的训练和伤痛，都将在这一刻得到回应。',
        stats: [
          { label: '晋级概率', value: prob + '%', tone: probTone(prob) },
          { label: '成功', value: '职业生涯开启' },
          { label: '失败', value: '另寻出路', tone: 'warn' },
        ],
        okText: '迎接选拔',
        cancelText: '再练一个月'
      });
      if (ok) attemptAthlete();
    });
  }

  const btnTryQualifier = $('btn-try-qualifier');
  if (btnTryQualifier) {
    btnTryQualifier.addEventListener('click', async () => {
      if (state.phase === 'ended') return;
      if (state.storyline !== 'esports') return;
      if (state.esports_stage !== 'qualifier_window') return;
      if (state.qualifier_attempted) return;
      const prob = computeQualifierProb(state);
      const ok = await showConfirm({
        title: '尝试出线',
        body: '常规赛收官战，目标是世界赛门票。',
        stats: [
          { label: '出线率', value: prob + '%', tone: probTone(prob) },
          { label: '成功', value: '世界赛之路' },
          { label: '失败', value: '次级联赛', tone: 'warn' },
        ],
      });
      if (!ok) return;
      stopAuto();
      attemptQualifier(false);
    });
  }

  const btnTryTriton = $('btn-try-triton');
  if (btnTryTriton) {
    btnTryTriton.addEventListener('click', async () => {
      if (state.phase === 'ended') return;
      if (state.storyline !== 'poker') return;
      if (state.poker_stage !== 'triton_window') return;
      if (state.triton_attempted) return;
      const prob = computeTritonProb(state);
      const ok = await showConfirm({
        title: '尝试参赛',
        body: '高客锦标赛的资格赛，押上全部筹码冲职业圈。',
        stats: [
          { label: '晋级率', value: prob + '%', tone: probTone(prob) },
          { label: '成功', value: '传奇扑克 Triton' },
          { label: '失败', value: '地头蛇', tone: 'warn' },
        ],
      });
      if (!ok) return;
      stopAuto();
      attemptTriton(false);
    });
  }

  $('btn-summary').addEventListener('click', () => {
    SFX.sfxNav();
    dismissEndOverlay();
    showScreen('summary-screen');
    renderSummary();
  });

  $('btn-end-summary').addEventListener('click', () => {
    SFX.sfxNav();
    dismissEndOverlay();
    showScreen('summary-screen');
    renderSummary();
  });

  $('btn-end-restart').addEventListener('click', () => {
    SFX.sfxRestart();
    if (mp.enabled && mp.connected) { _mpHandleRestart(); return; }
    location.reload();
  });

  $('btn-summary-back').addEventListener('click', () => {
    SFX.sfxNav();
    showScreen('game-screen');
    render();
  });

  $('btn-summary-restart').addEventListener('click', () => {
    SFX.sfxRestart();
    if (mp.enabled && mp.connected) { _mpHandleRestart(); return; }
    location.reload();
  });

  // MP VS comparison button
  $('btn-mp-vs')?.addEventListener('click', () => {
    SFX.sfxNav();
    _mpShowVsComparison();
  });
  $('mp-vs-close')?.addEventListener('click', () => {
    SFX.sfxModalClose();
    $('mp-vs-overlay').style.display = 'none';
  });
  $('mp-vs-back')?.addEventListener('click', () => {
    SFX.sfxModalClose();
    $('mp-vs-overlay').style.display = 'none';
  });

  // MP: 退出房间
  $('btn-mp-leave')?.addEventListener('click', () => {
    SFX.sfxNav();
    showConfirm({
      title: '退出房间',
      body: '确定要退出联机房间回到主界面吗？',
      okText: '退出', cancelText: '取消',
    }).then(ok => {
      if (ok) location.reload();
    });
  });

  $('btn-summary-share').addEventListener('click', async () => {
    SFX.sfxShare();
    try {
      const btn = $('btn-summary-share');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<span class="icon">⏳</span> 生成中...';
      btn.disabled = true;

      // 1. Fill poster data
      const avatarCanvas = $('summary-avatar');
      if(avatarCanvas) {
        $('poster-avatar').src = avatarCanvas.toDataURL('image/png');
      }

      $('poster-score-val').textContent = $('summary-score-val').textContent;
      const rankEl = $('summary-score-rank');
      const pRankEl = $('poster-rank');
      pRankEl.className = 'poster-rank ' + rankEl.className.replace('score-rank', '').replace('stamp', '').trim();
      
      const fullRankText = rankEl.textContent; // e.g. "C级 勉强算人"
      const rankMatch = fullRankText.match(/^([SABCD]级)(.*)$/);
      let rankLetter = fullRankText;
      let rankDesc = "";
      if (rankMatch) {
          rankLetter = rankMatch[1]; // "C级"
          rankDesc = rankMatch[2].trim(); // "勉强算人"
      }
      pRankEl.innerHTML = `<div class="poster-rank-letter">${rankLetter}</div><div class="poster-rank-desc">${rankDesc}</div>`;

      // Meta
      const heroChips = document.querySelectorAll('#summary-hero-meta .hero-chip');
      let metaHTML = '';
      const labels = ['生存时长', '最终学历', '主修方向', '职业身份', '感情状态', '其他'];
      heroChips.forEach((chip, i) => {
        const val = chip.innerText;
        if(val) metaHTML += `<div class="poster-meta-item"><span class="poster-meta-k">${labels[i]||'状态'}</span><span class="poster-meta-v">${val}</span></div>`;
      });
      $('poster-meta').innerHTML = metaHTML;

      // Stats
      const keys = ['SOC', 'INT', 'MNY', 'HAP', 'HLT', 'PER', 'APP'];
      let statsHTML = '';
      keys.forEach(k => {
         const cur = state[k] ?? 0;
         statsHTML += `<div class="poster-stat-box"><div class="poster-stat-label">${STAT_LABELS[k]}</div><div class="poster-stat-val">${cur}</div></div>`;
      });
      $('poster-stats').innerHTML = statsHTML;

      // Talents
      const pTalentsEl = $('poster-talents');
      if (state.talentsPicked && state.talentsPicked.length) {
        pTalentsEl.innerHTML = state.talentsPicked.map(t =>
          `<div class="poster-talent-item grade-${t.grade}">
            <span class="poster-talent-name">${t.name}</span>
            <span class="poster-talent-desc">${t.description}</span>
          </div>`
        ).join('');
      } else {
        pTalentsEl.innerHTML = `<div class="poster-hl-item">未选择任何天赋。</div>`;
      }

      // Ending
      const reversed = [...state.log].reverse();
      const endingLog = reversed.find(e => e.logType === 'ending');
      if (endingLog) {
        $('poster-ending').innerHTML = `<div class="poster-ending-tag">${endingLog.tag}</div><div class="poster-ending-text">${endingLog.text}</div>`;
      } else {
        $('poster-ending').innerHTML = `<div class="poster-ending-text">这一生平淡如水。</div>`;
      }

      // Highlights
      const hlEl = $('summary-highlights');
      let hlHTML = '';
      if (hlEl) {
         const records = hlEl.querySelectorAll('.choice-record');
         for(let i=0; i<Math.min(records.length, 3); i++) {
            const ctx = records[i].querySelector('.choice-record-ctx')?.innerText || '';
            const picked = records[i].querySelector('.choice-opt-picked')?.innerText || '';
            if(ctx && picked) {
              hlHTML += `<div class="poster-hl-item">面临 <b>${ctx}</b>，最终选择了 <b>${picked}</b></div>`;
            }
         }
      }
      if(!hlHTML) hlHTML = `<div class="poster-hl-item">按部就班的一生，未经历重大命运抉择。</div>`;
      $('poster-highlights').innerHTML = hlHTML;

      // Footer message
      const pFooterRank = $('poster-footer-rank');
      const letterOnlyMatch = fullRankText.match(/^([SABCD])/);
      pFooterRank.textContent = letterOnlyMatch ? letterOnlyMatch[1] : fullRankText[0];
      pFooterRank.className = rankEl.className.replace('score-rank', '').replace('stamp', '').trim();

      // Small delay to ensure any CSS/DOM updates are applied
      await new Promise(r => setTimeout(r, 150));
      
      const pTemplate = $('poster-template');
      
      const canvas = await html2canvas(pTemplate, {
        backgroundColor: '#0d1117',
        scale: window.devicePixelRatio || 2,
        useCORS: true
      });
      
      const dataUrl = canvas.toDataURL('image/png');
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 760;

      if (!isMobile) {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = '我的留学人生档案.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const imgWrap = $('poster-img-wrap');
        imgWrap.innerHTML = '';
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.width = '100%';
        img.style.display = 'block';
        imgWrap.appendChild(img);
        
        $('poster-modal').style.display = 'flex';
      }

      btn.innerHTML = originalText;
      btn.disabled = false;

    } catch (e) {
      console.error(e);
      alert('生成图片失败，请稍后再试。');
      const btn = $('btn-summary-share');
      btn.innerHTML = '<span class="icon">📸</span> 生成人生档案';
      btn.disabled = false;
    }
  });

  $('btn-close-poster').addEventListener('click', () => {
    SFX.sfxModalClose();
    $('poster-modal').style.display = 'none';
  });

  $('btn-start').addEventListener('click', () => {
    SFX.preloadSounds();
    SFX.sfxConfirm();
    resetSessionUnlocks();
    // Initialize random appearance before showing
    state.faceVariant = Math.floor(Math.random() * 10);
    state.topVariant = Math.floor(Math.random() * 24);
    state.bottomVariant = Math.floor(Math.random() * 8);
    state.outfitColorId = Math.floor(Math.random() * 16);
    if (typeof state.skinTone !== 'number') state.skinTone = 1;
    for (let t = 0; t < 3; t++) {
      const el = $(`skin-${t}`);
      if (el) el.classList.toggle('active', t === state.skinTone);
    }
    state.sex = 0;
    $('sex-male').classList.add('active');
    $('sex-female').classList.remove('active');

    showScreen('creation-screen');

    // Always start at step-talents (first step)
    const scrollArea = $('creation-scroll-area');
    if (scrollArea) scrollArea.scrollTop = 0;
    // Avatar is in the last step — no need to render on start-screen click
  });

  renderTalentSelect(talents);
  updateCreationAvatar();
  showScreen('start-screen');

  // ── Tutorial system ──────────────────────────────────────────────
  const _tutSeen = (() => { try { return localStorage.getItem('sasr_tutorial_seen'); } catch(e) { return null; } })();

  function _openTutorial() {
    SFX.sfxNav();
    $('tutorial-modal').style.display = '';
  }
  function _closeTutorial() {
    SFX.sfxModalClose();
    $('tutorial-modal').style.display = 'none';
  }

  // First-time prompt
  if (!_tutSeen) {
    $('tutorial-prompt').style.display = '';
    $('tutorial-prompt-yes').addEventListener('click', () => {
      SFX.sfxConfirm();
      $('tutorial-prompt').style.display = 'none';
      try { localStorage.setItem('sasr_tutorial_seen', '1'); } catch(e) {}
      _openTutorial();
    });
    $('tutorial-prompt-no').addEventListener('click', () => {
      SFX.sfxClick();
      $('tutorial-prompt').style.display = 'none';
      try { localStorage.setItem('sasr_tutorial_seen', '1'); } catch(e) {}
      try { localStorage.setItem('sasr_guide_done', '1'); } catch(e) {}
    });
  }

  // Tutorial button on start screen
  $('btn-tutorial').addEventListener('click', () => _openTutorial());
  $('tutorial-close').addEventListener('click', () => _closeTutorial());
  $('tutorial-start-game').addEventListener('click', () => {
    _closeTutorial();
    $('btn-start').click();
  });

  // ── Step-by-step Guide (A层) ────────────────────────────────────
  const _guideDone = (() => { try { return localStorage.getItem('sasr_guide_done'); } catch(e) { return null; } })();
  let _guideActive = false;
  let _guideStep = 0;

  // Steps are grouped by phase: 'creation' steps first, then 'game' steps
  const GUIDE_STEPS = [
    // ── Creation Screen Steps ──
    {
      phase: 'creation',
      target: '#talent-list',
      title: '🎲 抽取天赋',
      body: '这是你的天赋卡池，共 10 张随机天赋。<strong>点击选择 3 张</strong>带入本局游戏。\n颜色越亮越稀有，橙色最强。',
      arrow: 'bottom',
    },
    {
      phase: 'creation',
      target: '#talent-confirm',
      title: '✅ 确认选择',
      body: '选好 3 张天赋后，这个按钮会亮起。点击确认进入<strong>属性分配</strong>阶段。',
      arrow: 'top',
    },
    // Note: alloc steps will fire after user confirms talents and scrolls
    {
      phase: 'alloc',
      target: '.alloc-list',
      title: '📊 分配属性点',
      body: '用 <strong>＋</strong> 和 <strong>−</strong> 分配 25 个点数到六大属性。\n每项上限 10，天赋加成会额外叠加。点「随机分配」可以一键随机。',
      arrow: 'left',
    },
    {
      phase: 'alloc',
      target: '#alloc-start',
      title: '🚀 开始人生',
      body: '属性分配好后，点击这个按钮正式开始你的留学人生！',
      arrow: 'top',
    },
    // ── Game Screen Steps ──
    {
      phase: 'game',
      target: '.left-panel',
      title: '👤 你的状态',
      body: '左侧面板显示你的<strong>头像、属性、学校、专业、恋爱</strong>等状态。\n属性条会随事件实时变化。',
      arrow: 'right',
    },
    {
      phase: 'game',
      target: '.right-panel',
      title: '📜 事件面板',
      body: '<strong>点击这里推进一个月</strong>，触发新事件。\n遇到选择时，选项按钮会出现在这里——有些选项需要属性达标才能选。',
      arrow: 'left',
    },
    {
      phase: 'game',
      target: '#btn-auto-1x',
      title: '⏩ 自动播放',
      body: '懒得一直点？按「自动播放」让游戏自动跑。\n遇到选择时会<strong>自动暂停</strong>等你操作。',
      arrow: 'bottom',
    },
  ];

  function _guideShow(stepIdx) {
    const overlay = $('guide-overlay');
    const spotlight = $('guide-spotlight');
    const tooltip = $('guide-tooltip');
    const arrow = $('guide-arrow');
    const titleEl = $('guide-title');
    const bodyEl = $('guide-body');
    const indicator = $('guide-step-indicator');
    const nextBtn = $('guide-next');

    const step = GUIDE_STEPS[stepIdx];
    if (!step) { _guideEnd(); return; }

    const targetEl = document.querySelector(step.target);
    if (!targetEl || targetEl.offsetHeight === 0) {
      // Target not visible, skip
      _guideStep++;
      setTimeout(() => _guideShow(_guideStep), 100);
      return;
    }

    overlay.style.display = '';
    _guideActive = true;

    // Spotlight
    const rect = targetEl.getBoundingClientRect();
    const pad = 8;
    spotlight.style.top = (rect.top - pad) + 'px';
    spotlight.style.left = (rect.left - pad) + 'px';
    spotlight.style.width = (rect.width + pad * 2) + 'px';
    spotlight.style.height = (rect.height + pad * 2) + 'px';

    // Step dots
    indicator.innerHTML = GUIDE_STEPS.map((_, i) =>
      `<span class="guide-step-dot ${i < stepIdx ? 'done' : i === stepIdx ? 'active' : ''}"></span>`
    ).join('');

    // Content
    titleEl.textContent = step.title;
    bodyEl.innerHTML = step.body.replace(/\n/g, '<br>');
    nextBtn.textContent = stepIdx === GUIDE_STEPS.length - 1 ? '开始游戏！' : '下一步';

    // Position tooltip
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    tooltip.style.removeProperty('top');
    tooltip.style.removeProperty('bottom');
    tooltip.style.removeProperty('left');
    tooltip.style.removeProperty('right');

    // For tall elements (> 60% viewport), use center-of-viewport vertical positioning
    const isTall = rect.height > vh * 0.6;
    const centerY = isTall ? vh / 2 : rect.top + rect.height / 2;

    if (step.arrow === 'right' || step.arrow === 'left') {
      // Place tooltip beside the target, vertically centered
      let tooltipTop = centerY - 80;
      tooltipTop = Math.max(20, Math.min(tooltipTop, vh - 220));
      tooltip.style.top = tooltipTop + 'px';
      if (step.arrow === 'right') {
        tooltip.style.left = Math.min(rect.right + 60, vw - 340) + 'px';
      } else {
        tooltip.style.left = Math.max(10, rect.left - 340) + 'px';
      }
    } else {
      // Place tooltip above or below
      const spaceBelow = vh - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow > 180 || spaceBelow > spaceAbove) {
        tooltip.style.top = Math.min(rect.bottom + 20, vh - 200) + 'px';
      } else {
        tooltip.style.top = Math.max(20, rect.top - 200) + 'px';
      }
      let tooltipLeft = rect.left + rect.width / 2 - 160;
      tooltipLeft = Math.max(10, Math.min(tooltipLeft, vw - 330));
      tooltip.style.left = tooltipLeft + 'px';
    }

    // Re-trigger animation
    tooltip.style.animation = 'none';
    tooltip.offsetHeight; // reflow
    tooltip.style.animation = '';

    // Arrow pointing at target — use clamped center for tall elements
    const arrowY = isTall ? (vh / 2 - 24) : (rect.top + rect.height / 2 - 24);
    const arrowYClamped = Math.max(20, Math.min(arrowY, vh - 60));

    if (step.arrow === 'bottom') {
      arrow.style.display = '';
      arrow.style.top = Math.min(rect.bottom + 2, vh - 60) + 'px';
      arrow.style.left = (rect.left + rect.width / 2 - 24) + 'px';
      arrow.style.transform = 'rotate(0deg)';
    } else if (step.arrow === 'top') {
      arrow.style.display = '';
      arrow.style.top = Math.max(rect.top - 52, 4) + 'px';
      arrow.style.left = (rect.left + rect.width / 2 - 24) + 'px';
      arrow.style.transform = 'rotate(180deg)';
    } else if (step.arrow === 'right') {
      arrow.style.display = '';
      arrow.style.top = arrowYClamped + 'px';
      arrow.style.left = (rect.right + 4) + 'px';
      arrow.style.transform = 'rotate(-90deg)';
    } else if (step.arrow === 'left') {
      arrow.style.display = '';
      arrow.style.top = arrowYClamped + 'px';
      arrow.style.left = (rect.left - 52) + 'px';
      arrow.style.transform = 'rotate(90deg)';
    } else {
      arrow.style.display = 'none';
    }
  }

  function _guideEnd() {
    $('guide-overlay').style.display = 'none';
    _guideActive = false;
    try { localStorage.setItem('sasr_guide_done', '1'); } catch(e) {}
  }

  function _guideNext() {
    SFX.sfxClick();
    _guideStep++;
    const nextStep = GUIDE_STEPS[_guideStep];
    if (!nextStep) {
      _guideEnd();
      return;
    }
    // If the next step is in a different phase, pause — will be resumed by hooks
    const curStep = GUIDE_STEPS[_guideStep - 1];
    if (nextStep.phase !== curStep.phase) {
      $('guide-overlay').style.display = 'none';
      _guideActive = false;
      return;
    }
    _guideShow(_guideStep);
  }

  // Called by various hooks when the right phase becomes visible
  function _guideResumeForPhase(phase) {
    if (_guideStep >= GUIDE_STEPS.length) return;
    if (_guideActive) return; // already showing
    const nextStep = GUIDE_STEPS[_guideStep];
    if (nextStep && nextStep.phase === phase) {
      setTimeout(() => {
        _guideActive = true;
        _guideShow(_guideStep);
      }, 500);
    }
  }

  $('guide-next').addEventListener('click', _guideNext);
  $('guide-skip').addEventListener('click', () => { SFX.sfxClick(); _guideEnd(); });

  // Hook showScreen for game-screen phase resume
  const _origShowScreen = showScreen;
  showScreen = function(id) {
    _origShowScreen(id);
    if (id === 'game-screen') _guideResumeForPhase('game');
  };

  // Hook _scrollToAlloc for alloc phase resume
  const _origScrollToAlloc = _scrollToAlloc;
  _scrollToAlloc = function() {
    _origScrollToAlloc();
    _guideResumeForPhase('alloc');
  };

  // Hook: start guide when entering creation screen for the first time
  if (!_guideDone) {
    let _guideStarted = false;
    const _creationObserver = new MutationObserver(() => {
      if (!_guideStarted && $('creation-screen').classList.contains('active')) {
        _guideStarted = true;
        _creationObserver.disconnect();
        setTimeout(() => {
          _guideStep = 0;
          _guideActive = true;
          _guideShow(0);
        }, 500);
      }
    });
    _creationObserver.observe($('creation-screen'), { attributes: true, attributeFilter: ['class'] });
  }

  // ── Multiplayer (optional) ──────────────────────────────────────
  try {
    const _mp = await import('./multiplayer.js');
    mp = _mp.mp;
    createRoom = _mp.createRoom;
    joinRoom = _mp.joinRoom;
    mpSend = _mp.send;
    mpOn = _mp.on;
    mpDisconnect = _mp.disconnect;
    resetMpState = _mp.resetMpState;
    REUNION_AGES = _mp.REUNION_AGES;
    FATE_CARDS = _mp.FATE_CARDS;
    initialFateCards = _mp.initialFateCards;
    draftFrenemyCards = _mp.draftFrenemyCards;
    FRENEMY_CARD_POOL = _mp.FRENEMY_CARD_POOL;
    _wireMultiplayerUI();
  } catch (e) {
    console.warn('[mp] multiplayer.js 加载失败，联机功能不可用:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MULTIPLAYER INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

function _broadcastState() {
  if (!mp.enabled || !mp.connected) return;
  mpSend('state_sync', {
    age: state.age,
    month: state.monthOfYear,
    school: state.school,
    profession: state.profession,
    major: state.major || '未定',
    country: state.country,
    storyline: state.storyline,
    relationship: state.relationship,
    stats: {
      SOC: state.SOC, INT: state.INT, MNY: state.MNY,
      PER: state.PER, HLT: state.HLT, APP: state.APP, HAP: state.HAP,
    },
  });
}

function _changeRelation(delta, reason) {
  mp.relation = Math.max(-100, Math.min(100, mp.relation + delta));
  mpSend('relation_delta', { delta, reason: reason || '' });
  _renderOpponentBar();
}

function _findButterflyReceive(key) {
  for (const ev of state.eventsMap.values()) {
    if (ev.butterflyReceive === key) return ev;
  }
  return null;
}

function _isDeclineChoice(choice, ev) {
  const txt = (choice.title || choice.text || '').trim();
  if (!txt) return false;
  return /拒绝|婉拒|放弃|不去|不接|留下|算了|不感兴趣|跳过/.test(txt);
}

function _applyIncomingCard(eff) {
  if (!eff) return;
  const cardName = eff.cardName || '损友卡';
  const isHelp = eff.category === 'help';
  const logType = isHelp ? 'mp-reunion' : 'mp-pvp';

  // ── Special chaos effects ──
  if (eff.special) {
    const base = ['SOC', 'INT', 'MNY', 'PER', 'HLT', 'APP'];
    if (eff.special === 'swap_random_stat') {
      const k = base[Math.floor(Math.random() * base.length)];
      const oppVal = eff._oppStats ? eff._oppStats[k] : 5;
      const myVal = state[k] || 0;
      state[k] = oppVal;
      pushLog(`【${cardName}】对方发动了灵魂交换！你的${STAT_LABELS[k]}从${myVal}变成了${oppVal}`, logType);
    } else if (eff.special === 'roulette') {
      if (Math.random() < 0.4) {
        // backfire — sender gets the penalty (we're the target, so we're safe)
        pushLog(`【${cardName}】对方对你发动了俄罗斯轮盘……但反噬了自己！你安然无恙`, logType);
      } else {
        const k = base[Math.floor(Math.random() * base.length)];
        state[k] = (state[k] || 0) - 4;
        pushLog(`【${cardName}】对方对你发动了俄罗斯轮盘！你的${STAT_LABELS[k]}-4`, logType);
      }
    } else if (eff.special === 'swap_top3') {
      const myStats = base.map(k => [k, state[k] || 0]).sort((a, b) => b[1] - a[1]);
      const oppStats = eff._oppStats || {};
      const top3Keys = myStats.slice(0, 3).map(x => x[0]);
      const changes = [];
      for (const k of top3Keys) {
        const myV = state[k] || 0;
        const oppV = oppStats[k] || 0;
        state[k] = oppV;
        changes.push(`${STAT_LABELS[k]}:${myV}→${oppV}`);
      }
      pushLog(`【${cardName}】人生互换！你的三项最高属性被替换：${changes.join('、')}`, logType);
    } else if (eff.special === 'double_or_nothing') {
      const lucky = Math.random() < 0.5;
      const delta = lucky ? 2 : -2;
      for (const k of base) state[k] = (state[k] || 0) + delta;
      state.HAP = (state.HAP || 0) + delta;
      pushLog(`【${cardName}】全押！${lucky ? '运气爆棚，全属性+2！' : '手气不佳，全属性-2…'}`, logType);
    } else if (eff.special === 'mirror_lowest') {
      const srcVal = eff._mirrorVal ?? 0;
      const srcKey = eff._mirrorKey || 'HLT';
      const oldVal = state[srcKey] || 0;
      state[srcKey] = srcVal;
      pushLog(`【${cardName}】镜像！对方把自己最低的${STAT_LABELS[srcKey]}(${srcVal})复制给了你（原${oldVal}）`, logType);
    } else if (eff.special === 'joker') {
      // Reverse: intended harm becomes help — random +2 to two stats
      const picks = [...base].sort(() => Math.random() - 0.5).slice(0, 2);
      for (const k of picks) state[k] = (state[k] || 0) + 2;
      state.HAP = (state.HAP || 0) + 1;
      pushLog(`【${cardName}】小丑牌！对方本想害你，结果弄巧成拙——你的${picks.map(k => STAT_LABELS[k]).join('、')}各+2，HAP+1`, logType);
    } else if (eff.special === 'drift') {
      const k = base[Math.floor(Math.random() * base.length)];
      const delta = Math.random() < 0.5 ? 3 : -3;
      state[k] = (state[k] || 0) + delta;
      pushLog(`【${cardName}】属性漂移！你的${STAT_LABELS[k]}${delta > 0 ? '+3' : '-3'}`, logType);
    } else if (eff.special === 'steal_stat') {
      // Steal 2 points from target's highest stat
      let maxK = 'SOC', maxV = -99;
      for (const k of base) { if ((state[k] || 0) > maxV) { maxV = state[k] || 0; maxK = k; } }
      state[maxK] = (state[maxK] || 0) - 2;
      pushLog(`【${cardName}】偷属性！对方偷走了你${STAT_LABELS[maxK]}的2点（${maxV}→${maxV - 2}）`, logType);
    } else if (eff.special === 'nuke') {
      const shuffled = [...base].sort(() => Math.random() - 0.5);
      const targets = shuffled.slice(0, 2);
      for (const k of targets) state[k] = (state[k] || 0) - 3;
      pushLog(`【${cardName}】同归于尽！你的${targets.map(k => STAT_LABELS[k]).join('、')}各-3`, logType);
    }
    clampStats(); render(); return;
  }

  // ── Normal stat effects ──
  if (eff.stats) {
    for (const [k, v] of Object.entries(eff.stats)) {
      if (EFFECT_KEYS.has(k)) state[k] = (state[k] || 0) + v;
    }
    clampStats();
    const verb = isHelp ? '帮了你一把' : '对你出手了';
    pushLog(`【${cardName}】对方${verb}——${_formatCardEffect(eff.stats)}`, logType);
  }
  render();
}

function _formatCardEffect(stats) {
  const labels = { SOC: '社交', INT: '智力', MNY: '家境', PER: '毅力', HLT: '健康', APP: '颜值', HAP: '快乐' };
  return Object.entries(stats).map(([k, v]) => `${labels[k] || k}${v > 0 ? '+' : ''}${v}`).join('、');
}

function _triggerReunion(age) {
  // 如果自己在特殊/隐藏剧情中，跳过同学聚会
  if (state.storyline && (SPECIAL_STORYLINES.has(state.storyline) || HIDDEN_STORYLINES.has(state.storyline))) {
    mpSend('reunion_skip', { age, reason: 'in_storyline' });
    pushLog(`（你正忙于自己的事业，错过了${age}岁的同学聚会）`, 'mp-reunion');
    render();
    return;
  }
  // 对方已经结束游戏或断线，无法参加聚会
  if (_mpOppEndData || !mp.connected) {
    pushLog(`（${mp.opponent.nickname || '对方'}已经结束了人生，${age}岁的同学聚会无法举行）`, 'mp-reunion');
    render();
    return;
  }
  mpSend('reunion_arrived', { age });
  if (mp.opponent.age >= age) {
    _fireReunionEvent(age);
  } else {
    mp.isWaiting = true;
    mp.waitReason = `等待对方到达 ${age} 岁参加同学聚会...`;
    _renderWaitingOverlay();
    // 超时保护：30秒后自动取消等待
    mp._reunionTimeout = setTimeout(() => {
      if (mp.isWaiting && mp.waitReason.includes(`${age}`)) {
        mp.isWaiting = false;
        _showWaitingDismiss(`等了好久，${mp.opponent.nickname || '对方'} 好像迷路了……`);
        pushLog(`（等了很久，${mp.opponent.nickname || '对方'}没能赶到${age}岁的同学聚会）`, 'mp-reunion');
      }
    }, 30000);
  }
}

async function _playReunionCinematic(age, myName, oppName, oppProf, oppSchool, relLabel) {
  SFX.sfxReunion();
  const _w = ms => new Promise(r => setTimeout(r, ms));

  const overlay = document.createElement('div');
  overlay.className = 'reunion-overlay';

  // Title
  const title = document.createElement('div');
  title.className = 'reunion-title';
  title.textContent = `${age}岁 · 老友聚会`;
  overlay.appendChild(title);

  // Cards row: [me] [rel] [opp]
  const row = document.createElement('div');
  row.className = 'reunion-cards';

  const myCard = document.createElement('div');
  myCard.className = 'reunion-card left';
  myCard.innerHTML = `<span class="reunion-card-name">${myName}</span>
    <span class="reunion-card-info">${state.profession || '未知'}</span>`;

  const relTag = document.createElement('div');
  relTag.className = 'reunion-rel';
  relTag.textContent = relLabel;

  const oppCard = document.createElement('div');
  oppCard.className = 'reunion-card right';
  oppCard.innerHTML = `<span class="reunion-card-name">${oppName}</span>
    <span class="reunion-card-info">${oppProf}${oppSchool ? ' · ' + oppSchool : ''}</span>`;

  row.appendChild(myCard);
  row.appendChild(relTag);
  row.appendChild(oppCard);
  overlay.appendChild(row);

  document.body.appendChild(overlay);

  // Timeline (~2s total)
  // 0ms: overlay bg fade in + title pop
  await _w(30);
  overlay.classList.add('active');
  title.classList.add('show');

  // 350ms: cards slide in
  await _w(350);
  myCard.classList.add('show');
  oppCard.classList.add('show');

  // 650ms: relation label pops
  await _w(300);
  relTag.classList.add('show');

  // Hold for reading
  await _w(900);

  // Fade out everything
  overlay.classList.add('fade-out');
  await _w(350);
  overlay.remove();
}

// ── Reunion Dilemma Config ──
const REUNION_DILEMMA = {
  23: {
    title: '毕业季',
    intro: (opp, rel, oppProf, oppSchool, oppRel) =>
      `毕业季的老同学聚餐，你见到了${rel}${opp}。TA现在是「${oppProf}」${oppSchool ? `，从${oppSchool}毕业` : ''}。大家点了一桌子菜，气氛正好。${oppRel === '单身' ? 'TA还是单身，你们开始起哄。' : `听说TA现在${oppRel}了。`}`,
    choices: [
      { key: 'coop', icon: '🍻', text: '一起痛饮到天亮', desc: '不管未来怎样，今晚不醉不归' },
      { key: 'betray', icon: '📱', text: '好好发个朋友圈装一下', desc: '记录一下吧，难得的重逢嘛' },
      { key: 'risky', icon: '🎓', text: '提议一起创业', desc: '我有个想法，要不要一起干？' },
    ],
    results: {
      'coop_coop':     { my: { SOC: 2, HAP: 4 }, opp: { SOC: 2, HAP: 4 }, rel: 30, text: (o) => `你们聊了一晚上，从大学糗事到现在的迷茫，越聊越起劲。临走时勾肩搭背，约好下个月再聚。` },
      'coop_betray':   { my: { HAP: -2, SOC: -2 }, opp: { MNY: 4 }, rel: -40, text: (o) => `你掏心掏肺讲了半天，${o}却一直在拍照修图发朋友圈。配文"和老同学叙旧❤️"，你成了TA精致生活的背景板。` },
      'coop_risky':    { my: { SOC: 2, HAP: 4 }, opp: { HAP: -2, PER: 2 }, rel: 10, text: (o) => `你喝得正开心，${o}突然认真地说想一起创业。你笑了笑没接话。TA有些失落，但你们的关系倒没变差。` },
      'betray_coop':   { my: { MNY: 4 }, opp: { HAP: -2, SOC: -2 }, rel: -40, text: (o) => `${o}真诚地分享着近况，你却忙着拍照选滤镜。"在大学同学聚会，感恩遇见🥂"，发出去点赞数不少。${o}看到后表情有点微妙。` },
      'betray_betray': { my: { HAP: -2 }, opp: { HAP: -2 }, rel: -20, text: (o) => `你们都在忙着拍照发朋友圈，互相给对方点了个赞，然后各自沉默刷手机。散场时客气地说"下次再聚"，心里都知道不会有下次。` },
      'betray_risky':  { my: { MNY: 4 }, opp: { HAP: -4 }, rel: -40, text: (o) => `${o}鼓起勇气提出一起创业，你却对着手机头也不抬地回了句"再说吧"。TA的表情像被泼了一盆冷水。` },
      'risky_coop':    { my: { HAP: -2, PER: 2 }, opp: { SOC: 2, HAP: 4 }, rel: 10, text: (o) => `你提出一起创业的想法，${o}笑着说"先喝酒吧"。虽然没被接受，但TA的态度很温暖，你反而更坚定了自己的想法。` },
      'risky_betray':  { my: { HAP: -4 }, opp: { MNY: 4 }, rel: -40, text: (o) => `你兴致勃勃地讲创业计划，${o}一边嗯嗯一边发朋友圈。你后来才发现TA配文写的是"有人毕业了还在做梦😂"。` },
      'risky_risky':   { my: { MNY: 6, SOC: 4, PER: 2 }, opp: { MNY: 6, SOC: 4, PER: 2 }, rel: 40, text: (o) => `你们不约而同地提出创业，越聊越兴奋，当晚就在餐巾纸上画起了商业计划。也许这才是这顿饭最大的收获。` },
    },
  },
  28: {
    title: '职场江湖',
    intro: (opp, rel, oppProf, oppSchool, oppRel) =>
      `工作几年了，你和${rel}${opp}约了顿饭。TA现在是「${oppProf}」，看起来变了不少。你们点了壶茶，聊起各自的近况。`,
    choices: [
      { key: 'coop', icon: '🤝', text: '帮TA内推工作', desc: '把自己的人脉资源分享出去' },
      { key: 'betray', icon: '💼', text: '套TA的商业情报', desc: '表面关心，其实在打探对方底细' },
      { key: 'neutral', icon: '🍷', text: '什么都不聊，纯喝酒', desc: '不帮不坑，今晚只想放松' },
    ],
    results: {
      'coop_coop':       { my: { SOC: 2, HAP: 4, MNY: 2 }, opp: { SOC: 2, HAP: 4, MNY: 2 }, rel: 30, text: (o) => `你帮${o}推了个好机会，TA也把自己的人脉介绍给你。这顿饭吃得值——老朋友就是最好的资源。` },
      'coop_betray':     { my: { HAP: -2, SOC: -2 }, opp: { MNY: 4, SOC: 2 }, rel: -40, text: (o) => `你费心帮${o}牵线搭桥，后来才发现TA背地里在挖你的客户。一股寒意涌上心头。` },
      'coop_neutral':    { my: { SOC: 2 }, opp: { HAP: 2 }, rel: 5, text: (o) => `你主动聊起工作机会想帮${o}，TA笑着说"今天不聊工作"，举起酒杯。也好，难得清闲。` },
      'betray_coop':     { my: { MNY: 4, SOC: 2 }, opp: { HAP: -2, SOC: -2 }, rel: -40, text: (o) => `${o}热心地帮你介绍资源，你却悄悄记下了TA的客户联系方式。生意场上嘛……你安慰自己。` },
      'betray_betray':   { my: { HAP: -2 }, opp: { HAP: -2 }, rel: -20, text: (o) => `你们表面和气地交换信息，暗地里都在套对方的底。最后谁也没占到便宜，饭钱倒花了不少。` },
      'betray_neutral':  { my: { MNY: 2 }, opp: { HAP: -2 }, rel: -20, text: (o) => `你旁敲侧击地套话，${o}只顾喝酒不接茬。临走时TA说"感觉你今天怪怪的"。尴尬。` },
      'neutral_coop':    { my: { HAP: 2 }, opp: { SOC: 2 }, rel: 5, text: (o) => `${o}想帮你推荐工作，你摆摆手说今天就是想放松。TA的好意你记在心里了。` },
      'neutral_betray':  { my: { HAP: -2 }, opp: { MNY: 2 }, rel: -20, text: (o) => `你只想安静喝酒，${o}却一直在套你的工作情况。一顿饭吃得索然无味。` },
      'neutral_neutral': { my: { HAP: 2, HLT: -2 }, opp: { HAP: 2, HLT: -2 }, rel: 0, text: (o) => `你们默契地不聊任何正事，一杯接一杯地喝。凌晨两点扶着墙回家，头疼得厉害。但心情不错。` },
    },
  },
  33: {
    title: '最后的交杯',
    intro: (opp, rel, oppProf, oppSchool, oppRel) =>
      `${rel}${opp}约你吃饭。TA现在是「${oppProf}」。能来的老朋友已经不多了。你们找了个安静的地方坐下，窗外是深秋的街景。`,
    choices: [
      { key: 'coop', icon: '🫂', text: '掏心窝子聊人生', desc: '聊遗憾、梦想、这些年的起落' },
      { key: 'betray', icon: '🪞', text: '维持表面客气', desc: '笑着碰杯，心里想着自己的事' },
      { key: 'risky', icon: '💰', text: '提议一起搞投资', desc: '中年了有点积蓄，合伙投点什么？' },
    ],
    results: {
      'coop_coop':     { my: { SOC: 4, HAP: 6 }, opp: { SOC: 4, HAP: 6 }, rel: 40, text: (o) => `人到中年，能这么掏心窝子聊的朋友不多了。从事业聊到家庭、遗憾和梦想，你们聊到深夜。散场时都红了眼眶。` },
      'coop_betray':   { my: { HAP: -4 }, opp: { SOC: 2 }, rel: -50, text: (o) => `你放下了所有防备想好好聊聊，${o}却全程在客套寒暄。你突然意识到，有些人注定走不进你的世界。` },
      'coop_risky':    { my: { SOC: 4, HAP: 6 }, opp: { HAP: -2, PER: 2 }, rel: 20, text: (o) => `你想好好叙叙旧，${o}却急着聊投资。你耐心听完，说"钱的事不急，先把酒喝了"。${o}愣了一下，然后笑了。` },
      'betray_coop':   { my: { SOC: 2 }, opp: { HAP: -4 }, rel: -50, text: (o) => `${o}想跟你好好聊聊这些年的心里话，你却笑着把话题带过。回家路上你有点后悔——这种机会可能不多了。` },
      'betray_betray': { my: { HAP: -4 }, opp: { HAP: -4 }, rel: -30, text: (o) => `你们笑着碰杯，聊些无关痛痒的话题。临走时客气地说"保重"，转身各自消失在夜色里。这大概就是大人的交往方式吧。` },
      'betray_risky':  { my: { SOC: 2 }, opp: { HAP: -4 }, rel: -30, text: (o) => `${o}认真地提出合伙投资，你敷衍地说"回去考虑考虑"。TA看出你没当回事，沉默了很久。` },
      'risky_coop':    { my: { HAP: -2, PER: 2 }, opp: { SOC: 4, HAP: 6 }, rel: 20, text: (o) => `你聊起投资的想法，${o}不置可否，反而拉你聊起了当年的事。你被TA的真诚打动，决定今晚不谈钱了。` },
      'risky_betray':  { my: { HAP: -4 }, opp: { SOC: 2 }, rel: -30, text: (o) => `你认真提出合伙计划，${o}客气地顾左右而言他。回家路上你觉得自己像个傻子。` },
      'risky_risky':   { my: { MNY: 8, SOC: 4, PER: 4 }, opp: { MNY: 8, SOC: 4, PER: 4 }, rel: 50, text: (o) => `你们不约而同提出一起搞投资，越聊越认真，当场就开始研究项目。十年的信任，比任何商业计划书都值钱。` },
    },
  },
};

// Pending dilemma state
let _reunionDilemmaAge = 0;
let _reunionMyChoice = null;
let _reunionOppChoice = null;
let _reunionOppChoiceAge = 0; // track which age the opp choice belongs to

function _showReunionDilemma(age, oppName) {
  const cfg = REUNION_DILEMMA[age];
  if (!cfg) return;
  // Don't reset _reunionOppChoice — opponent may have already sent their choice
  // Only clear if it's stale (from a different reunion age)
  _reunionDilemmaAge = age;
  _reunionMyChoice = null;
  if (_reunionOppChoiceAge !== age) _reunionOppChoice = null;

  // Build overlay
  const overlay = document.createElement('div');
  overlay.id = 'reunion-dilemma-overlay';
  overlay.className = 'reunion-dilemma-overlay';
  overlay.innerHTML = `
    <div class="reunion-dilemma-box">
      <div class="reunion-dilemma-title">${cfg.title}</div>
      <div class="reunion-dilemma-prompt">你打算怎么做？</div>
      <div class="reunion-dilemma-choices">
        ${cfg.choices.map(c => `
          <button class="reunion-dilemma-btn" data-key="${c.key}">
            <span class="rdb-icon">${c.icon}</span>
            <div class="rdb-content">
              <span class="rdb-text">${c.text}</span>
              <span class="rdb-desc">${c.desc}</span>
            </div>
          </button>
        `).join('')}
      </div>
      <div class="reunion-dilemma-waiting" style="display:none;">
        <div class="rdw-spinner"></div>
        <span>等待${oppName}做出选择…</span>
        <button class="reunion-dilemma-dismiss">跳过</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));

  // Wire dismiss/skip button in waiting state
  overlay.querySelector('.reunion-dilemma-dismiss').addEventListener('click', () => {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);
    pushLog(`（你提前离开了聚会）`, 'mp-reunion');
    _reunionDilemmaAge = 0;
    _reunionMyChoice = null;
    _reunionOppChoice = null;
    _reunionOppChoiceAge = 0;
    state.autoPlay = state._reunionSavedAuto || false;
    if (state._reunionSavedAutoMode) startAuto(state._reunionSavedAutoMode);
    render();
  });

  // Wire button clicks
  overlay.querySelectorAll('.reunion-dilemma-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      SFX.sfxChoice();
      _reunionMyChoice = btn.dataset.key;
      mpSend('reunion_choice', { age, choice: _reunionMyChoice });
      // Disable buttons, show waiting or resolve
      overlay.querySelectorAll('.reunion-dilemma-btn').forEach(b => {
        b.disabled = true;
        if (b === btn) b.classList.add('selected');
        else b.classList.add('dimmed');
      });
      if (_reunionOppChoice) {
        _resolveReunionDilemma(age);
      } else {
        overlay.querySelector('.reunion-dilemma-waiting').style.display = 'flex';
      }
    });
  });
}

function _resolveReunionDilemma(age) {
  const cfg = REUNION_DILEMMA[age];
  if (!cfg || !_reunionMyChoice || !_reunionOppChoice) return;
  const key = `${_reunionMyChoice}_${_reunionOppChoice}`;
  const result = cfg.results[key];
  if (!result) return;

  const oppName = mp.opponent.nickname || '对方';

  // Apply my stat effects
  if (result.my) {
    for (const [k, v] of Object.entries(result.my)) {
      if (k === 'HAP') state.HAP = Math.max(0, Math.min(10, (state.HAP || 0) + v));
      else state[k] = Math.max(0, Math.min(10, (state[k] || 0) + v));
    }
  }
  // Send opponent effects
  if (result.opp) {
    mpSend('reunion_effect', { age, effects: result.opp });
  }
  // Relation change
  if (result.rel) {
    _changeRelation(result.rel, `${age}岁聚会`);
  }

  // Result text
  const resultText = result.text(oppName);
  pushLog(resultText, 'mp-reunion');

  // Effect summary log
  if (result.my) {
    const parts = Object.entries(result.my).map(([k, v]) =>
      `${STAT_LABELS[k] || k}${v > 0 ? '+' : ''}${v}`
    );
    if (result.rel) parts.push(`好感度${result.rel > 0 ? '+' : ''}${result.rel}`);
    pushLog(`（${parts.join('，')}）`, 'mp-reunion');
  }

  // Transition to result display
  const overlay = document.getElementById('reunion-dilemma-overlay');
  if (overlay) {
    const box = overlay.querySelector('.reunion-dilemma-box');
    box.innerHTML = `
      <div class="reunion-dilemma-result">
        <div class="rdr-opp-choice">
          ${oppName}选择了：${_getChoiceLabel(age, _reunionOppChoice)}
        </div>
        <div class="rdr-text">${resultText}</div>
        <div class="rdr-effects">${_formatDilemmaEffects(result.my, result.rel)}</div>
        <button class="rdr-close">继续</button>
      </div>
    `;
    box.querySelector('.rdr-close').addEventListener('click', () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 300);
      state.autoPlay = state._reunionSavedAuto || false;
      if (state._reunionSavedAutoMode) startAuto(state._reunionSavedAutoMode);
      render();
    });
  }

  _reunionDilemmaAge = 0;
  _reunionMyChoice = null;
  _reunionOppChoice = null;
  _reunionOppChoiceAge = 0;
}

function _getChoiceLabel(age, key) {
  const cfg = REUNION_DILEMMA[age];
  if (!cfg) return key;
  const c = cfg.choices.find(ch => ch.key === key);
  return c ? `${c.icon} ${c.text}` : key;
}

function _formatDilemmaEffects(effects, rel) {
  if (!effects) return '';
  const parts = Object.entries(effects).map(([k, v]) => {
    const cls = v > 0 ? 'pos' : 'neg';
    return `<span class="rde-tag ${cls}">${STAT_LABELS[k] || k} ${v > 0 ? '+' : ''}${v}</span>`;
  });
  if (rel) {
    const cls = rel > 0 ? 'pos' : 'neg';
    parts.push(`<span class="rde-tag ${cls}">好感度 ${rel > 0 ? '+' : ''}${rel}</span>`);
  }
  return parts.join('');
}

function _cancelReunionDilemma(oppName) {
  if (!_reunionDilemmaAge) return;
  const overlay = document.getElementById('reunion-dilemma-overlay');
  if (overlay) {
    const box = overlay.querySelector('.reunion-dilemma-box');
    box.innerHTML = `
      <div class="reunion-dilemma-result">
        <div class="rdr-text">${oppName}突然离开了……聚会不欢而散。</div>
        <button class="rdr-close">继续</button>
      </div>
    `;
    box.querySelector('.rdr-close').addEventListener('click', () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 300);
      state.autoPlay = state._reunionSavedAuto || false;
      if (state._reunionSavedAutoMode) startAuto(state._reunionSavedAutoMode);
      render();
    });
  }
  pushLog(`（${oppName}突然离开了，聚会提前结束）`, 'mp-reunion');
  _reunionDilemmaAge = 0;
  _reunionMyChoice = null;
  _reunionOppChoice = null;
  _reunionOppChoiceAge = 0;
}

async function _fireReunionEvent(age) {
  mp.isWaiting = false;
  if (mp._reunionTimeout) { clearTimeout(mp._reunionTimeout); mp._reunionTimeout = null; }
  _hideWaitingOverlay();
  const oppName = mp.opponent.nickname || '对方';
  const oppProf = mp.opponent.profession || '未知';
  const oppSchool = mp.opponent.school || '';
  const oppRel = mp.opponent.relationship || '单身';
  const relLabel = mp.relation >= 50 ? '老铁' : mp.relation >= 0 ? '同学' : '冤家';
  const myName = state.nickname || '你';

  // Pause auto-play during reunion (both autoMode timer and state flag)
  state._reunionSavedAutoMode = autoMode;
  if (autoMode) stopAuto();
  state._reunionSavedAuto = state.autoPlay;
  state.autoPlay = false;

  // 1. Cinematic animation
  await _playReunionCinematic(age, myName, oppName, oppProf, oppSchool, relLabel);

  // 2. Narrative intro + base effect
  const cfg = REUNION_DILEMMA[age];
  const introText = cfg ? cfg.intro(oppName, relLabel, oppProf, oppSchool, oppRel) : `${age}岁的老友聚会。`;
  const reunionEvent = {
    id: `mp_reunion_${age}`,
    event: introText,
    effect: { SOC: 1, HAP: 1 },
    noRandom: true,
  };
  if (!state.pendingChoice) {
    applyEvent(reunionEvent);
  } else {
    state.pendingEvent = reunionEvent;
  }
  pushLog(`🤝 ${age}岁老友聚会！`, 'mp-reunion');
  render();

  // 3. Show dilemma choices (auto-play stays paused until player closes result)
  _showReunionDilemma(age, oppName);
}

function _wireMpMessageHandlers() {
  mpOn('hello', (data) => {
    mp.opponent.nickname = data.nickname || '对手';
    _renderOpponentBar();
  });

  mpOn('state_sync', (data) => {
    Object.assign(mp.opponent, data);
    _renderOpponentBar();
  });

  mpOn('butterfly', (data) => {
    if (data.payload) mp.pendingButterfly.push(data.payload);
  });

  mpOn('reunion_arrived', (data) => {
    // 如果自己也在特殊剧情中，跳过
    if (state.storyline && (SPECIAL_STORYLINES.has(state.storyline) || HIDDEN_STORYLINES.has(state.storyline))) {
      mpSend('reunion_skip', { age: data.age, reason: 'in_storyline' });
      pushLog(`（你正忙于自己的事业，错过了${data.age}岁的同学聚会）`, 'mp-reunion');
      render();
      return;
    }
    if (state.age >= data.age && mp.isWaiting && mp.waitReason.includes(`${data.age}`)) {
      _fireReunionEvent(data.age);
    } else if (state.age >= data.age) {
      _fireReunionEvent(data.age);
    }
  });

  mpOn('reunion_skip', (data) => {
    // 对方跳过了同学聚会
    if (mp.isWaiting && mp.waitReason.includes(`${data.age}`)) {
      mp.isWaiting = false;
      _hideWaitingOverlay();
      pushLog(`（${mp.opponent.nickname}正忙于自己的事业，没来参加${data.age}岁的同学聚会）`, 'mp-reunion');
      render();
    }
  });

  mpOn('reunion_choice', (data) => {
    _reunionOppChoice = data.choice;
    _reunionOppChoiceAge = data.age;
    if (_reunionMyChoice) {
      // Both chose — resolve
      _resolveReunionDilemma(data.age);
    }
    // Otherwise opponent chose first — _reunionOppChoice is stored and preserved,
    // will be checked when player clicks a button in _showReunionDilemma
  });

  mpOn('reunion_effect', (data) => {
    // Apply effects sent by opponent's dilemma result
    if (data.effects) {
      for (const [k, v] of Object.entries(data.effects)) {
        if (k === 'HAP') state.HAP = Math.max(0, Math.min(10, (state.HAP || 0) + v));
        else state[k] = Math.max(0, Math.min(10, (state[k] || 0) + v));
      }
      const parts = Object.entries(data.effects).map(([k, v]) =>
        `${STAT_LABELS[k] || k}${v > 0 ? '+' : ''}${v}`
      );
      pushLog(`（聚会影响：${parts.join('，')}）`, 'mp-reunion');
      render();
    }
  });

  mpOn('card_played', (data) => {
    const def = FATE_CARDS[data.card];
    if (def) {
      const incoming = { ...def.effect, cardName: def.name, category: def.category };
      // Chaos cards: attach sender stats
      if (data.senderStats) incoming._oppStats = data.senderStats;
      if (data.mirrorKey) { incoming._mirrorKey = data.mirrorKey; incoming._mirrorVal = data.mirrorVal; }
      mp.incomingCardEffect = incoming;
      if (state.cardHistory) state.cardHistory.push({
        age: state.age, month: state.monthOfYear,
        cardId: data.card, cardName: def.name, direction: 'received',
      });
    }
  });

  mpOn('relation_delta', (data) => {
    mp.relation = Math.max(-100, Math.min(100, mp.relation + data.delta));
    _renderOpponentBar();
  });

  mpOn('coop_invite', (data) => {
    mp.coopInvitePending = { from: 'them', storyline: data.storyline };
    _showCoopInviteToast();
  });

  mpOn('coop_response', (data) => {
    if (data.accept && data.storyline === 'partners') {
      const ev = state.eventsMap.get(95020);
      if (ev) applyEvent(ev);
      _hideCoopInviteToast();
    } else {
      pushLog('（对方婉拒了合作邀请）', 'mp-coop-intro');
      render();
    }
  });

  mpOn('game_end', (data) => {
    _mpOppEndData = data;
    // 对方结束了 → 如果我在等待同学聚会，显示提示后关闭
    if (mp.isWaiting) {
      mp.isWaiting = false;
      if (mp._reunionTimeout) { clearTimeout(mp._reunionTimeout); mp._reunionTimeout = null; }
      _showWaitingDismiss(`${data.nickname || mp.opponent.nickname} 好像已经消失了……同学聚会取消`);
      pushLog(`（${data.nickname || mp.opponent.nickname}已经结束了人生，同学聚会取消）`, 'mp-reunion');
    }
    // 对方在聚会选择中消失 → 自动结算为对方"弃权"(neutral/betray depending on age)
    _cancelReunionDilemma(data.nickname || mp.opponent.nickname);
    pushLog(`【${data.nickname || mp.opponent.nickname}】结束了人生：${data.age}岁，得分 ${data.score || '—'}`, 'mp-reunion');
    render();
    // If I already ended too, auto-refresh the VS button visibility & summary status
    if (state.phase === 'ended') {
      const vsBtn = $('btn-mp-vs');
      if (vsBtn) vsBtn.style.display = '';
      _updateMpSummaryStatus();
    }
  });

  mpOn('peer_left', () => {
    // 取消同学聚会等待
    if (mp.isWaiting) {
      mp.isWaiting = false;
      if (mp._reunionTimeout) { clearTimeout(mp._reunionTimeout); mp._reunionTimeout = null; }
      _showWaitingDismiss(`${mp.opponent.nickname || '对方'} 好像已经断线了……同学聚会取消`);
    }
    // 取消聚会选择
    _cancelReunionDilemma(mp.opponent.nickname || '对方');
    // 取消 restart 等待
    if (_mpRestartPending) {
      _mpRestartPending = false;
      _hideWaitingOverlay();
    }
    if (state.phase === 'game') {
      showConfirm({ title: '对方已离开', body: '本局联机结束，将转为单人模式继续。', okText: '好的' });
      mp.enabled = false;
      _hideOpponentBar();
    } else if (state.phase === 'ended') {
      // Game already over — silently clean up, no disruptive modal
      mp.connected = false;
      _hideOpponentBar();
      _updateMpSummaryStatus();
    }
  });

  // 再来一次同步
  mpOn('restart_request', () => _mpOnRestartRequest());
  mpOn('restart_ready', () => _mpOnRestartReady());
  mpOn('restart_decline', () => _mpOnRestartDecline());
}

function _renderOpponentBar() {
  if (!mp.enabled) { _hideOpponentBar(); return; }
  const bar = $('mp-opponent-bar');
  if (!bar) return;
  bar.style.display = 'flex';
  $('mp-bar-nick').textContent = mp.opponent.nickname || '对手';
  $('mp-bar-age').textContent = mp.opponent.age || '—';
  $('mp-bar-school').textContent = mp.opponent.school || '—';
  $('mp-bar-major').textContent = mp.opponent.major || '未定';
  $('mp-bar-prof').textContent = mp.opponent.profession || '—';
  $('mp-bar-rel').textContent = mp.opponent.relationship || '单身';
  $('mp-bar-relation-val').textContent = mp.relation;
  const fill = $('mp-relation-fill');
  const pct = (mp.relation + 100) / 2;
  fill.style.width = pct + '%';
  fill.className = 'mp-relation-fill ' + (mp.relation > 20 ? 'pos' : mp.relation < -20 ? 'neg' : '');
  const remaining = mp.cards.filter(c => !c.used).length;
  const cc = $('mp-cards-count');
  if (cc) cc.textContent = remaining;
}

function _hideOpponentBar() {
  const bar = $('mp-opponent-bar');
  if (bar) bar.style.display = 'none';
}

function _renderWaitingOverlay() {
  const ov = $('mp-waiting-overlay');
  if (!ov) return;
  ov.style.display = mp.isWaiting ? 'flex' : 'none';
  const r = $('mp-waiting-reason');
  if (r) r.textContent = mp.waitReason || '';
}

function _hideWaitingOverlay() {
  const ov = $('mp-waiting-overlay');
  if (ov) ov.style.display = 'none';
}

// 对方死亡/断线时，把等待覆盖层切换成提示文案，2秒后自动关闭
function _showWaitingDismiss(msg) {
  const ov = $('mp-waiting-overlay');
  if (!ov) return;
  ov.innerHTML = `
    <div class="mp-wait-box">
      <div style="font-size:36px;margin-bottom:12px;">💀</div>
      <h3 style="color:#ff8a8a;">${msg}</h3>
    </div>`;
  ov.style.display = 'flex';
  setTimeout(() => { ov.style.display = 'none'; render(); }, 2500);
}

function _renderCardsPanel() {
  const list = $('mp-cards-list');
  if (!list) return;
  list.innerHTML = '';
  const gradeStars = ['', ' ★', ' ★★'];
  for (const card of mp.cards) {
    const cat = card.category || 'harm';
    const div = document.createElement('div');
    div.className = 'mp-card-item cat-' + cat + (card.grade === 2 ? ' big' : '') + (card.used ? ' used' : '');
    div.innerHTML = `
      <div class="mp-card-name">${card.icon} ${card.name}${gradeStars[card.grade] || ''}</div>
      <div class="mp-card-desc">${card.desc}</div>
    `;
    if (!card.used) {
      div.addEventListener('click', async () => {
        // 对方已结束游戏，不能再用卡
        if (_mpOppEndData) {
          await showConfirm({ title: '无法使用', body: `${mp.opponent.nickname} 已经不在了……`, okText: '好吧' });
          return;
        }
        const verb = cat === 'help' ? '帮助' : '对';
        const ok = await showConfirm({
          title: `使用「${card.name}」`,
          body: `确定${verb} ${mp.opponent.nickname} 使用「${card.name}」吗？`,
          okText: '使用', cancelText: '取消',
        });
        if (!ok) return;
        card.used = true;
        // Build payload — chaos cards need sender's stats
        const payload = { card: card.id };
        if (card.effect && card.effect.special) {
          const base = ['SOC', 'INT', 'MNY', 'PER', 'HLT', 'APP'];
          payload.senderStats = {};
          for (const k of base) payload.senderStats[k] = state[k] || 0;
          // For mirror: compute sender's lowest stat
          if (card.effect.special === 'mirror_lowest') {
            let minK = 'HLT', minV = 99;
            for (const k of base) { if ((state[k] || 0) < minV) { minV = state[k] || 0; minK = k; } }
            payload.mirrorKey = minK;
            payload.mirrorVal = minV;
          }
          // steal_stat: sender gains 2 to their lowest stat
          if (card.effect.special === 'steal_stat') {
            let minK = 'SOC', minV = 99;
            for (const k of base) { if ((state[k] || 0) < minV) { minV = state[k] || 0; minK = k; } }
            state[minK] = (state[minK] || 0) + 2;
            clampStats();
          }
          // nuke: sender also takes -3 to two random stats
          if (card.effect.special === 'nuke') {
            const shuffled = [...base].sort(() => Math.random() - 0.5).slice(0, 2);
            for (const k of shuffled) state[k] = (state[k] || 0) - 3;
            clampStats();
          }
        }
        SFX.sfxCard();
        mpSend('card_played', payload);
        if (state.cardHistory) state.cardHistory.push({
          age: state.age, month: state.monthOfYear,
          cardId: card.id, cardName: card.name, direction: 'sent',
        });
        _changeRelation(card.effect.relationDelta || 0, `使用${card.name}`);
        const logType = cat === 'help' ? 'mp-reunion' : 'mp-pvp';
        pushLog(`（你对 ${mp.opponent.nickname} 使用了「${card.name}」）`, logType);
        _renderCardsPanel();
        _renderOpponentBar();
        render();
      });
    }
    list.appendChild(div);
  }
}

function _showCoopInviteToast() {
  const t = $('mp-coop-toast');
  if (!t) return;
  t.style.display = 'block';
  $('mp-coop-text').textContent = `${mp.opponent.nickname} 邀请你一起进入「合伙创业」剧情`;
}

function _hideCoopInviteToast() {
  const t = $('mp-coop-toast');
  if (t) t.style.display = 'none';
}

function _wireMultiplayerUI() {
  _wireMpMessageHandlers();

  $('btn-mp-start')?.addEventListener('click', () => {
    const m = $('mp-modal');
    if (m) m.style.display = 'flex';
  });

  $('mp-back-home')?.addEventListener('click', async () => {
    if (mp.connected || mp.peer) {
      const ok = await showConfirm({
        title: '退出联机',
        body: '确定要退出联机吗？已连接的房间会断开。',
        okText: '退出', cancelText: '取消',
      });
      if (!ok) return;
      try { mpDisconnect(); } catch (e) {}
      resetMpState();
    }
    $('mp-create-result').style.display = 'none';
    $('mp-join-status').style.display = 'none';
    $('mp-connected-banner').style.display = 'none';
    $('mp-btn-create').disabled = false;
    $('mp-btn-create').textContent = '创建房间';
    $('mp-btn-join').disabled = false;
    $('mp-btn-join').textContent = '加入房间';
    $('mp-modal').style.display = 'none';
  });

  $('mp-tab-create')?.addEventListener('click', () => {
    $('mp-tab-create').classList.add('active');
    $('mp-tab-join').classList.remove('active');
    $('mp-pane-create').style.display = '';
    $('mp-pane-join').style.display = 'none';
  });
  $('mp-tab-join')?.addEventListener('click', () => {
    $('mp-tab-join').classList.add('active');
    $('mp-tab-create').classList.remove('active');
    $('mp-pane-join').style.display = '';
    $('mp-pane-create').style.display = 'none';
  });

  $('mp-btn-create')?.addEventListener('click', async () => {
    const name = ($('mp-create-name').value || '房主').trim();
    const btn = $('mp-btn-create');
    btn.disabled = true; btn.textContent = '创建中...';
    try {
      const code = await createRoom(name);
      $('mp-roomcode').textContent = code;
      $('mp-create-result').style.display = 'block';
    } catch (e) {
      alert('创建失败: ' + (e.message || e));
      btn.disabled = false; btn.textContent = '创建房间';
    }
  });

  $('mp-copy-code')?.addEventListener('click', () => {
    const code = $('mp-roomcode')?.textContent || '';
    if (!code || code === '------') return;
    navigator.clipboard.writeText(code).then(() => {
      const toast = $('mp-copy-toast');
      if (toast) { toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 1500); }
    });
  });

  $('mp-btn-join')?.addEventListener('click', async () => {
    const name = ($('mp-join-name').value || '玩家').trim();
    const code = ($('mp-join-code').value || '').trim().toUpperCase();
    if (!code || code.length !== 6) { alert('请输入6位房间码'); return; }
    const btn = $('mp-btn-join');
    btn.disabled = true; btn.textContent = '连接中...';
    const status = $('mp-join-status');
    status.style.display = 'block';
    status.textContent = '正在连接房主...';
    try {
      await joinRoom(code, name);
      status.textContent = '✅ 已连接，等待房主开始游戏';
    } catch (e) {
      alert('加入失败: ' + (e.message || e));
      btn.disabled = false; btn.textContent = '加入房间';
      status.style.display = 'none';
    }
  });

  let _mpMyReady = false;
  let _mpOppReady = false;

  function _updateLobbyStatus() {
    const meStatus = $('mp-lobby-me-status');
    const oppStatus = $('mp-lobby-opp-status');
    if (meStatus) {
      meStatus.textContent = _mpMyReady ? '✓ 已准备' : '未准备';
      meStatus.className = 'mp-lobby-status' + (_mpMyReady ? ' ready' : '');
    }
    if (oppStatus) {
      oppStatus.textContent = _mpOppReady ? '✓ 已准备' : '未准备';
      oppStatus.className = 'mp-lobby-status' + (_mpOppReady ? ' ready' : '');
    }
    const hint = $('mp-ready-hint');
    if (hint) {
      if (_mpMyReady && !_mpOppReady) {
        hint.style.display = 'block';
        hint.textContent = '等待对方准备...';
      } else {
        hint.style.display = 'none';
      }
    }
    const btn = $('mp-ready-btn');
    if (btn) {
      if (_mpMyReady) {
        btn.textContent = '取消准备';
        btn.classList.add('cancel');
      } else {
        btn.textContent = '准备';
        btn.classList.remove('cancel');
      }
    }
  }

  mpOn('connected', () => {
    _mpMyReady = false;
    _mpOppReady = false;
    $('mp-connected-banner').style.display = 'block';
    if ($('mp-lobby-me')) $('mp-lobby-me').textContent = mp.myNickname || '我';
    if ($('mp-lobby-me-tag')) $('mp-lobby-me-tag').textContent = mp.isHost ? '房主' : '加入者';
    if ($('mp-lobby-opp')) $('mp-lobby-opp').textContent = '已连接';
    if ($('mp-lobby-opp-tag')) $('mp-lobby-opp-tag').textContent = mp.isHost ? '加入者' : '房主';
    _updateLobbyStatus();
  });
  mpOn('hello', () => {
    if ($('mp-lobby-opp')) $('mp-lobby-opp').textContent = mp.opponent.nickname;
  });

  $('mp-ready-btn')?.addEventListener('click', () => {
    _mpMyReady = !_mpMyReady;
    mpSend('ready_state', { ready: _mpMyReady });
    _updateLobbyStatus();
    if (_mpMyReady && _mpOppReady) {
      // 双方都准备 → 开始游戏
      mpSend('start_game', {});
      _enterMpCreation();
    }
  });

  mpOn('ready_state', (data) => {
    _mpOppReady = data.ready;
    _updateLobbyStatus();
    if (_mpMyReady && _mpOppReady) {
      mpSend('start_game', {});
      _enterMpCreation();
    }
  });

  mpOn('start_game', () => {
    _enterMpCreation();
  });

  $('mp-cards-btn')?.addEventListener('click', () => {
    const p = $('mp-cards-panel');
    if (!p) return;
    if (p.style.display === 'block') { p.style.display = 'none'; return; }
    _renderCardsPanel();
    p.style.display = 'block';
  });
  $('mp-cards-close')?.addEventListener('click', () => {
    $('mp-cards-panel').style.display = 'none';
  });

  // 取消等待按钮（同学聚会 & 再来一次）
  $('mp-waiting-cancel')?.addEventListener('click', () => {
    if (_mpRestartPending) {
      _mpRestartPending = false;
      _hideWaitingOverlay();
      _mpRestartResetButton();
      mpSend('restart_decline', {});
      return;
    }
    // 取消同学聚会等待
    if (mp._reunionTimeout) { clearTimeout(mp._reunionTimeout); mp._reunionTimeout = null; }
    mp.isWaiting = false;
    _hideWaitingOverlay();
    pushLog('（你决定不再等了，跳过了这次同学聚会）', 'mp-reunion');
    mpSend('reunion_skip', { age: state.age, reason: 'cancelled' });
    render();
  });

  $('mp-coop-accept')?.addEventListener('click', () => {
    mpSend('coop_response', { accept: true, storyline: 'partners' });
    const ev = state.eventsMap.get(95020);
    if (ev) applyEvent(ev);
    _hideCoopInviteToast();
    render();
  });
  $('mp-coop-decline')?.addEventListener('click', () => {
    mpSend('coop_response', { accept: false, storyline: 'partners' });
    _hideCoopInviteToast();
  });

  window.addEventListener('beforeunload', () => {
    if (mp.enabled && mp.connected) {
      try { mpSend('peer_left', {}); } catch (e) {}
      mpDisconnect();
    }
  });
}

// ── 完整重置游戏状态（不 reload 页面） ─────────────────────────────────────
function _resetGameState() {
  // 清空 state 到初始值
  state.phase = 'talent';
  for (const k of STAT_KEYS) { state.alloc[k] = 0; state.allocBase[k] = 0; state[k] = 0; }
  state.HAP = 5;
  state.talentsPool = [];
  state.talentsPicked = [];
  state.talentIds = new Set();
  state.firedEvents = new Set();
  state.yearlyPlan = new Map();
  state.log = [];
  state.logRenderedCount = 0;
  state.sex = 0;
  state.age = 15;
  state.monthOfYear = 1;
  state.monthTotal = 1;
  state.school = '无';
  state.hsType = '';
  state.overseas = 0;
  state.country = '';
  state.countryIntent = '';
  state.schoolTier = '';
  state.major = '';
  state.relationship = '单身';
  state.relationshipHistory = [];
  state.storyline = '';
  state.storylineStart = 0;
  state.storylineStartMonth = 0;
  state.profession = '高中生';
  state.gradEndAge = 0;
  state.gradEndMonth = 0;
  state.pendingEvent = null;
  state.pendingChoice = null;
  state.lastChoiceMonth = 0;
  state._savedAutoMode = 0;
  state.POP = 0; state.POK = 0; state.MMR = 0;
  state.FIT = 0; state.CKL = 0; state.ATH = 0;
  state.MAG = 0; state.hogwartsYear = 0; state.housePt = 0; state.house = ''; state.hasOwl = 0; state.hogwartsSeed = 0;
  // 隐藏特殊属性面板
  state.showPOP = false; state.showPOK = false; state.showMMR = false;
  state.showFIT = false; state.showCKL = false; state.showATH = false;
  state.showMAG = false;
  state.cul = 0; state.dao = 0; state.karma = 0; state.tribulation = 0;
  state.xianxiaSeed = 0; state.yuanshen_book = 0; state.xingchen_book = 0;
  state.statPeaks = {};
  state.storylinesVisited = new Set();
  state.choiceHistory = [];
  state.milestones = [];
  state.cardHistory = [];
  state._frenemyDraftPool = null;
  state._frenemyDraftPicked = [];
  // 清除各种 flag
  for (const flag of ['match_fixing', 'japan_path', 'jp_fluent', 'kohaku', 'scandal',
    'party_clean', 'party_dirty', 'academic_dishonesty', 'late_dropout', 'hobby',
    'idol_stage', 'debut_attempted', 'party_stage', 'esports_stage', 'poker_stage',
    'fitness_stage', 'chef_stage', 'athlete_stage', 'pendingCinematic', '_cineSavedAuto']) {
    delete state[flag];
  }
  // 停止自动播放
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  autoMode = 0;
  // 清 MP end data
  _mpMyEndData = null;
  _mpOppEndData = null;
  // 清 UI
  const eventLog = $('event-log');
  if (eventLog) eventLog.innerHTML = '';
  const vsOverlay = $('mp-vs-overlay');
  if (vsOverlay) vsOverlay.style.display = 'none';
  const endOverlay = $('end-overlay');
  if (endOverlay) endOverlay.classList.remove('active');
  const vsBtn = $('btn-mp-vs');
  if (vsBtn) vsBtn.style.display = 'none';
  // 重置 step 显示状态
  const stepTalents = $('step-talents');
  const stepFrenemy = $('step-frenemy');
  const stepAlloc = $('step-alloc');
  if (stepTalents) stepTalents.style.display = '';
  if (stepFrenemy) stepFrenemy.style.display = 'none';
  if (stepAlloc) stepAlloc.style.display = '';
}

function _enterMpCreation() {
  _resetGameState();
  mp.cards = [];
  mp.relation = 0;
  mp.incomingCardEffect = null;
  mp.pendingReunionAge = null;
  mp.isWaiting = false;
  mp.waitReason = '';
  mp.pendingButterfly = [];
  mp.butterflySent = new Set();
  mp.coopInvitePending = null;
  mp.opponent.age = 15;
  mp.opponent.profession = '高中生';
  mp.opponent.school = '';
  mp.opponent.major = '';
  mp.opponent.storyline = '';
  mp.opponent.relationship = '单身';
  mp.opponent.stats = { SOC: 0, INT: 0, MNY: 0, PER: 0, HLT: 0, APP: 0, HAP: 5 };
  mp.opponent.endingId = null;
  mp.opponent.endingScore = 0;
  $('mp-modal').style.display = 'none';
  state.faceVariant = Math.floor(Math.random() * 10);
  state.topVariant = Math.floor(Math.random() * 24);
  state.bottomVariant = Math.floor(Math.random() * 8);
  state.outfitColorId = Math.floor(Math.random() * 16);
  if (typeof state.skinTone !== 'number') state.skinTone = 1;
  for (let t = 0; t < 3; t++) {
    const el = $(`skin-${t}`);
    if (el) el.classList.toggle('active', t === state.skinTone);
  }
  state.sex = 0;
  $('sex-male').classList.add('active');
  $('sex-female').classList.remove('active');
  // 重新抽天赋
  if (_allTalents) renderTalentSelect(_allTalents);
  $('talent-confirm').disabled = true;
  $('talent-confirm').textContent = '确认天赋（0/3）';
  showScreen('creation-screen');
  const scrollArea = $('creation-scroll-area');
  if (scrollArea) scrollArea.scrollTop = 0;
}

// ── 联机模式再来一次 ──────────────────────────────────────────────────────
let _mpRestartPending = false; // 我已发出 restart 请求

function _mpHandleRestart() {
  // 联机模式：发送 restart 请求并等待对方
  if (!mp.enabled || !mp.connected) {
    location.reload();
    return;
  }
  if (_mpRestartPending) return; // 已经在等了
  if (!_mpOppEndData) {
    showConfirm({ title: '对方还在游戏中', body: '等对方也结束后才能一起再来一次哦', okText: '好的' });
    return;
  }
  _mpRestartPending = true;
  mpSend('restart_request', {});
  // Change button to waiting state
  const btn = $('btn-summary-restart');
  if (btn) {
    btn.disabled = true;
    btn._origText = btn.textContent;
    btn.textContent = '等待对方确认…';
    btn.classList.add('waiting');
  }
}

function _mpRestartResetButton() {
  const btn = $('btn-summary-restart');
  if (btn) {
    btn.disabled = false;
    btn.textContent = btn._origText || '再来一次';
    btn.classList.remove('waiting');
  }
}

function _mpOnRestartRequest() {
  // 对方想再来一次
  showConfirm({
    title: '再来一次？',
    body: `${mp.opponent.nickname} 想再来一次，一起吗？`,
    okText: '走起！', cancelText: '算了',
  }).then(ok => {
    if (ok) {
      mpSend('restart_ready', {});
      _mpDoRestart();
    } else {
      mpSend('restart_decline', {});
    }
  });
}

function _mpOnRestartReady() {
  _mpRestartPending = false;
  _hideWaitingOverlay();
  _mpRestartResetButton();
  _mpDoRestart();
}

function _mpOnRestartDecline() {
  _mpRestartPending = false;
  _hideWaitingOverlay();
  _mpRestartResetButton();
  showConfirm({ title: '对方拒绝了', body: `${mp.opponent.nickname} 不想再来一次了`, okText: '好吧' });
}

function _mpDoRestart() {
  _enterMpCreation();
  _renderOpponentBar();
}

main();
