import { evalCondition, pickBranch, pickWeightedBranch } from './dsl.js';
import { renderAvatar, createStandaloneAvatar } from './avatar.js';
import { playStorylineIntro, playStorylineExit } from './cinematic.js';
import { initAchievements, unlockAchievement } from './achievements.js';

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
  48990, 48991  // Film: 金棕榈独立导演, 百亿票房商业导演
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
      { cond: s => (s.HLT || 0) <= 2, event: 85080 },
      { cond: s => (s.HAP || 0) <= 2, event: 85081 },
      { cond: s => (s.SOC || 0) <= 0, event: 85095 },
    ],
    progressChecks: [],
    },
    athlete: {
    gracePeriod: 12,
    eventRate: 0.8,
    deathChecks: [
      { cond: s => (s.HLT || 0) <= 2, event: 86151 },
      { cond: s => (s.HAP || 0) <= 2, event: 86152 },
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
  const [talents, events, ages, randomEvents, xianxiaEvents, hogwartsEvents] = await Promise.all([
    fetch('data/talents.json').then(r => r.json()),
    fetch('data/events.json').then(r => r.json()),
    fetch('data/ages.json').then(r => r.json()),
    fetch('data/random_events.json').then(r => r.json()),
    fetch('data/xianxia_events.json').then(r => r.json()).catch(() => []),
    fetch('data/hogwarts_events.json').then(r => r.json()).catch(() => [])
  ]);
  state.eventsMap = new Map(events.map(e => [e.id, e]));
  state.agesMap = ages;
  state.randomEvents = randomEvents.concat(xianxiaEvents).concat(hogwartsEvents);
  // Also index random events into eventsMap for branch lookups
  for (const re of state.randomEvents) state.eventsMap.set(re.id, re);
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
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
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
    const msg = ev.text || ev.event;
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
  }

  const msg = ev.text || ev.event;
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

  if (ev.effect) for (const [k, v] of Object.entries(ev.effect)) {
    if (EFFECT_KEYS.has(k)) state[k] = (state[k] || 0) + v;
  }
  if (typeof ev.happyDelta === 'number') state.HAP += ev.happyDelta;

  clampStats();

  if (ev.end) {
    state.phase = 'ended';
    state.endingId = ev.id;
    state.endingAge = state.age;
  }

  // Cinematic intro when entering a special/hidden storyline
  if (ev.set && ev.set.storyline && ev.set.storyline !== prevStorylineForCinematic
      && (HIDDEN_STORYLINES.has(ev.set.storyline) || SPECIAL_STORYLINES.has(ev.set.storyline))) {
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

  render();

  // 恢复选择前的自动播放状态
  const savedMode = state._savedAutoMode || 0;
  state._savedAutoMode = 0;
  if (savedMode > 0) startAuto(savedMode);
}

function advanceMonth() {
  // 如果有待选择，阻塞推进
  if (state.pendingChoice || state.pendingCinematic) return;

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
    }
    if (state.age >= 60) {
      pushLog('你退休了。回首这一生，百感交集。', 'ending');
      state.phase = 'ended';
      unlockAchievement('end_retire');
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
        state.talentsPicked.splice(idx, 1);
        el.classList.remove('picked');
      } else if (state.talentsPicked.length < 3) {
        state.talentsPicked.push(t);
        el.classList.add('picked');
      }
      $('talent-confirm').disabled = state.talentsPicked.length !== 3;
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
        row.innerHTML = `
          <span class="stat-label">${label}</span>
          <span class="stat-bar"><span class="stat-fill" style="width:${pct}%"></span></span>
          <span class="stat-val">${val}</span>
        `;
        statsEl.appendChild(row);
      }
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


      rankEl.textContent = rankText;
      rankEl.classList.add(rankClass, 'stamp');
    }
  }
  requestAnimationFrame(update);
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
    leftPanel.insertBefore(rightHead, leftPanel.children[1]);

    if (!gameLayout.querySelector('.mobile-stats-strip')) {
      const strip = document.createElement('div');
      strip.className = 'mobile-stats-strip';
      gameLayout.insertBefore(strip, rightPanel);
      initStripDrag(strip);
      _mobileStatsStripUpdate = () => updateMobileStatsStrip(strip);
      _mobileStatsStripUpdate();
    }

    if (!gameLayout.querySelector('.mobile-fs-toggle')) {
      const toggle = document.createElement('div');
      toggle.className = 'mobile-fs-toggle';
      toggle.innerHTML = '<svg class="fs-arrow" viewBox="0 0 28 14"><polyline points="6,12 14,4 22,12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      toggle.addEventListener('click', () => {
        gameLayout.classList.toggle('mobile-fs');
      });
      rightPanel.insertBefore(toggle, rightPanel.firstChild);
    }
  } else if (!entering) {
    if (rightPanel && rightHead.parentElement === leftPanel) {
      rightPanel.insertBefore(rightHead, rightPanel.querySelector('.mobile-fs-toggle') || rightPanel.firstChild);
    }
    const strip = gameLayout.querySelector('.mobile-stats-strip');
    if (strip) strip.remove();
    const toggle = rightPanel?.querySelector('.mobile-fs-toggle');
    if (toggle) toggle.remove();
    gameLayout.classList.remove('mobile-fs');
    _mobileStatsStripUpdate = null;
  }
}

function updateMobileStatsStrip(strip) {
  if (!strip) return;
  const s = state;
  let html = '';

  const timeEl = document.getElementById('time-display');
  const timeText = timeEl ? timeEl.textContent : `${s.age}岁`;
  html += `<div class="ms-chip ms-chip-time"><span class="ms-val">${timeText}</span></div>`;

  const allKeys = [...STAT_KEYS, 'HAP'];
  for (const k of allKeys) {
    const v = s[k] ?? 0;
    const label = STAT_LABELS[k] || k;
    const pct = Math.max(0, Math.min(100, (v / 30) * 100));
    html += `<div class="ms-chip"><span class="ms-label">${label}</span><div class="ms-bar"><div class="ms-bar-fill" style="width:${pct}%"></div></div><span class="ms-val">${v}</span></div>`;
  }

  if (s.POP != null) html += `<div class="ms-chip"><span class="ms-label">${STAT_LABELS.POP}</span><span class="ms-val">${s.POP}</span></div>`;
  if (s.POK != null) html += `<div class="ms-chip"><span class="ms-label">${STAT_LABELS.POK}</span><span class="ms-val">${s.POK}</span></div>`;
  if (s.FIT != null) html += `<div class="ms-chip"><span class="ms-label">${STAT_LABELS.FIT}</span><span class="ms-val">${s.FIT}</span></div>`;
  if (s.CKL != null) html += `<div class="ms-chip"><span class="ms-label">${STAT_LABELS.CKL}</span><span class="ms-val">${s.CKL}</span></div>`;
  if (s.ATH != null) html += `<div class="ms-chip"><span class="ms-label">${STAT_LABELS.ATH}</span><span class="ms-val">${s.ATH}</span></div>`;
  if (s.MMR != null) html += `<div class="ms-chip"><span class="ms-label">${STAT_LABELS.MMR}</span><span class="ms-val">${s.MMR}</span></div>`;

  const majorEl = document.getElementById('major-display');
  if (majorEl) html += `<div class="ms-chip ms-chip-info"><span class="ms-label">专业</span><span class="ms-val">${majorEl.textContent}</span></div>`;

  const relEl = document.getElementById('relationship-display');
  if (relEl) html += `<div class="ms-chip ms-chip-info"><span class="ms-label">恋爱</span><span class="ms-val">${relEl.textContent}</span></div>`;

  const schoolEl = document.getElementById('school-display');
  if (schoolEl && schoolEl.parentElement.style.display !== 'none') {
    html += `<div class="ms-chip ms-chip-info"><span class="ms-label">学校</span><span class="ms-val">${schoolEl.textContent}</span></div>`;
  }

  const profEl = document.getElementById('profession-display');
  if (profEl && profEl.parentElement.style.display !== 'none') {
    html += `<div class="ms-chip ms-chip-info"><span class="ms-label">职业</span><span class="ms-val">${profEl.textContent}</span></div>`;
  }

  const storyEl = document.getElementById('storyline-display');
  if (storyEl && storyEl.parentElement.style.display !== 'none') {
    html += `<div class="ms-chip ms-chip-storyline"><span class="ms-label">剧情</span><span class="ms-val">${storyEl.textContent}</span></div>`;
  }

  strip.innerHTML = html;
}

function updateCreationAvatar() {
  const canvas = $('creation-avatar-canvas');
  if (canvas) {
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
    renderAvatar(canvas, state);
  }
}

async function main() {
  initAchievements();
  const talents = await loadData();


  $('sex-male').addEventListener('click', () => { state.sex = 0; $('sex-male').classList.add('active'); $('sex-female').classList.remove('active'); updateCreationAvatar(); });
  $('sex-female').addEventListener('click', () => { state.sex = 1; $('sex-female').classList.add('active'); $('sex-male').classList.remove('active'); updateCreationAvatar(); });

  $('btn-random-appearance').addEventListener('click', () => {
    state.faceVariant = Math.floor(Math.random() * 10);
    state.topVariant = Math.floor(Math.random() * 12);
    state.bottomVariant = Math.floor(Math.random() * 6);
    state.outfitColorId = Math.floor(Math.random() * 5);
    updateCreationAvatar();
  });

  $('talent-confirm').addEventListener('click', () => {
    for (const k of STAT_KEYS) {
      state.alloc[k] = 0;
    }
    renderAlloc();
    
    // Programmatic Scroll to Step 2
    const container = $('creation-scroll-area');
    const target = $('step-alloc');
    if (container && target) {
      container.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
    }
    // Reset the internal scroll of the new step for mobile
    setTimeout(() => { target.scrollTop = 0; }, 300);
  });

  for (const k of STAT_KEYS) {
    $(`plus-${k}`).addEventListener('click', () => {
      const used = Object.values(state.alloc).reduce((a, b) => a + b, 0);
      if (used < ALLOC_TOTAL && state.alloc[k] < MAX_PER_STAT) {
        state.alloc[k] += 1;
        renderAlloc();
        updateCreationAvatar();
      }
    });
    $(`minus-${k}`).addEventListener('click', () => {
      if (state.alloc[k] > 0) { 
        state.alloc[k] -= 1; 
        renderAlloc(); 
        updateCreationAvatar();
      }
    });
  }

  $('alloc-back-to-talent').addEventListener('click', () => {
    const container = $('creation-scroll-area');
    const target = $('step-talents');
    if (container && target) {
      container.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
    }
    setTimeout(() => { target.scrollTop = 0; }, 300);
  });

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
    updateCreationAvatar();
  });

  $('alloc-start').addEventListener('click', initGame);

  $('btn-auto-1x').addEventListener('click', () => {
    startAuto(1);
  });

  $('btn-auto-2x').addEventListener('click', () => {
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

  $('btn-summary-share').addEventListener('click', async () => {
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
    $('poster-modal').style.display = 'none';
  });

  $('btn-start').addEventListener('click', () => {
    // Initialize random appearance before showing
    state.faceVariant = Math.floor(Math.random() * 10);
    state.topVariant = Math.floor(Math.random() * 12);
    state.bottomVariant = Math.floor(Math.random() * 6);
    state.outfitColorId = Math.floor(Math.random() * 5);
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
  showScreen('start-screen');
}

main();
