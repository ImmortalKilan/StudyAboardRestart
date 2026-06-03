// ── 转世遗产系统 (Reincarnation Legacy) ──────────────────────────
// Manages relic generation, mutation, persistence, sharing, and UI.

const LS_KEY = 'sasr_relics_v1';
const MAX_VAULT = 5;

const GRADE_NAMES = ['凡物', '遗珍', '宿命', '传说'];
const GRADE_COLORS = ['#b0b8c4', '#4a9de5', '#a855f7', '#f5b642'];
const GRADE_LIVES = [2, 3, 4, 5];
const GRADE_MUTATE_CHANCE = [0.10, 0.20, 0.30, 0.40];

// ── Relic Template Pool ──────────────────────────────────────────

const RELIC_TEMPLATES = {
  0: [
    { name: '旧课本', effect: { INT: 1 }, desc: '封面写着一个陌生的名字' },
    { name: '记账本', effect: { MNY: 1 }, desc: '每一页都记满了开销，最后一页写着"省着点"' },
    { name: '破球鞋', effect: { HLT: 1 }, desc: '鞋底磨平了，但穿着意外地合脚' },
    { name: '社交名片', effect: { SOC: 1 }, desc: '上面的电话号码已经打不通了' },
    { name: '旧日记', effect: { HAP: 1 }, desc: '字迹潦草，但能感受到写的人很快乐' },
    { name: '化妆镜', effect: { APP: 1 }, desc: '镜面有道裂痕，但映出的脸莫名熟悉' },
    { name: '旧耳机', effect: { HAP: 1 }, desc: '只有左边能响，但放的歌你好像听过' },
    { name: '磨损的笔', effect: { PER: 1 }, desc: '笔帽咬痕累累，是个用功的人' },
  ],
  1: [
    { name: 'GRE词汇书', effect: { INT: 2 }, desc: '书页间夹着一张已过期的准考证', cond: s => ['T20', 'T50', 'G5', '帝大', '港三', '新二'].includes(s.school) },
    { name: '信用卡账单', effect: { MNY: 2 }, desc: '额度惊人，但已被冻结', cond: s => (s.statPeaks?.MNY || 0) >= 8 },
    { name: '健身会员卡', effect: { HLT: 2, PER: 1 }, desc: '卡背面刮花了，显然用过很多次', cond: s => (s.statPeaks?.HLT || 0) >= 8 },
    { name: '恋人的信', effect: { HAP: 2, SOC: 1 }, desc: '信纸已经泛黄，但折痕说明被反复翻阅', cond: s => s.relationship === '已婚' },
    { name: '简历模板', effect: { SOC: 2 }, desc: '技能栏写了很多，但全被划掉了' },
    { name: '精致的发带', effect: { APP: 2 }, desc: '丝绸已经褪色，但系上去时心跳加速', cond: s => (s.statPeaks?.APP || 0) >= 8 },
    { name: '旧护照', effect: { SOC: 1, PER: 1 }, desc: '签证页盖满了章，有个章是你不认识的国家' },
    { name: '学生证', effect: { INT: 1, HAP: 1 }, desc: '照片上的人在笑，但眼神很累' },
  ],
  2: [
    // Each purple template has a `storylines` array — entering any of those storylines
    // in a playthrough guarantees this relic as an option at end-game.
    { name: '修仙残卷', effect: { INT: 3, HLT: 1 }, desc: '翻开第一页，天旋地转', storylines: ['xianxia'], cond: s => s.storyline === 'xianxia' },
    { name: '特工日记', effect: { PER: 3, SOC: 1 }, desc: '用密码写成，你居然看得懂', storylines: ['spy'], cond: s => s.storyline === 'spy' },
    { name: '冠军奖杯', effect: { HAP: 3, APP: 1 }, desc: '奖杯底座刻着"第一名"，但比赛名称被磨掉了', storylines: ['esports', 'worlds', 'minor_league', 'athlete'], cond: s => ['esports','worlds','minor_league','athlete'].includes(s.storyline) },
    { name: '主厨围裙', effect: { HLT: 2, HAP: 2 }, desc: '上面还残留着香料的味道', storylines: ['chef'], cond: s => s.storyline === 'chef' },
    { name: '金唱片', effect: { APP: 3, SOC: 1 }, desc: '封面是一个你不认识的人，但笑容很熟悉', storylines: ['idol', 'superstar', 'band'], cond: s => ['idol','superstar','band'].includes(s.storyline) },
    { name: '黑色面具', effect: { PER: 2, INT: 2 }, desc: '戴上它时，你听到了低语', storylines: ['abyss'], cond: s => s.storyline === 'abyss' },
    { name: '扑克牌', effect: { INT: 2, MNY: 2 }, desc: '总共只有51张，缺了一张黑桃A', storylines: ['poker', 'triton', 'local_shark'], cond: s => ['poker','triton','local_shark'].includes(s.storyline) },
    { name: '破旧的哨子', effect: { SOC: 3, PER: 1 }, desc: '吹响它时，你感觉身边有很多人', storylines: ['party', 'wasted'], cond: s => ['party','wasted'].includes(s.storyline) },
    { name: '代码U盘', effect: { INT: 3, MNY: 1 }, desc: '里面只有一个文件：README_IMPORTANT.txt', storylines: ['academic', 'ceo'], cond: s => ['academic','ceo'].includes(s.storyline) },
    { name: '破损的存档', effect: { INT: 2, PER: 2 }, desc: '文件名是save_final_final_v3.sav，打开后屏幕开始闪烁', storylines: ['meta'], cond: s => s.storyline === 'meta' },
    { name: '夜行手套', effect: { PER: 3, MNY: 1 }, desc: '指尖的触感告诉你，这双手拿过很多不属于自己的东西', storylines: ['thief'], cond: s => s.storyline === 'thief' },
    { name: '断裂的魔杖', effect: { INT: 2, HAP: 2 }, desc: '木芯还在微微发烫，似乎记得主人的名字', storylines: ['hogwarts'], cond: s => s.storyline === 'hogwarts' },
    { name: '停摆的怀表', effect: { PER: 2, HLT: 2 }, desc: '指针永远停在3点14分，但你总觉得它还在走', storylines: ['timeloop'], cond: s => s.storyline === 'timeloop' },
    { name: '锈迹斑斑的哑铃', effect: { HLT: 3, PER: 1 }, desc: '握住它的瞬间，肌肉记忆涌了上来', storylines: ['fitness'], cond: s => s.storyline === 'fitness' },
    { name: '破碎的手机屏', effect: { SOC: 2, APP: 2 }, desc: '屏幕碎了但还亮着，通知栏有999+未读', storylines: ['influencer', 'mcn', 'streamer', 'washed'], cond: s => ['influencer','mcn','streamer','washed'].includes(s.storyline) },
  ],
  3: [
    { name: '轮回之钥', effect: { SOC: 2, INT: 2, MNY: 2, PER: 2, HLT: 2, APP: 2 }, desc: '握住它的瞬间，你想起了一切', cond: s => s._isLegendary },
    { name: '神秘黑卡', effect: { MNY: 5, SOC: 2 }, desc: '没有卡号，没有姓名，但每台POS机都认它', cond: s => (s._score || 0) >= 28000 },
    { name: '命运罗盘', effect: { INT: 2, PER: 2 }, desc: '指针永远指向你', special: 'extra_talent', cond: s => s._isLegendary && s._isHiddenStoryline },
    { name: '不朽笔记', effect: { INT: 4 }, desc: '最后一页写着："这不是第一次了"', noDecay: true, cond: s => s.storyline === 'meta' },
    { name: '凤凰羽毛', effect: { HLT: 4, HAP: 2 }, desc: '握在手里时，伤口似乎愈合得更快', cond: s => s._isLegendary },
  ],
};

// ── Mutation Templates ───────────────────────────────────────────

const MUTATIONS = [
  { fromName: '旧课本', toName: '泛黄的手稿', newEffect: { PER: 1 }, desc: '你翻开手稿，想起了什么...' },
  { fromName: 'GRE词汇书', toName: '破损的笔记', effectDelta: { INT: -1, PER: 1 }, desc: '墨迹已经看不清了，但你的手在自动书写' },
  { fromName: '信用卡账单', toName: '神秘存折', effectDelta: { MNY: 1 }, desc: '余额显示为???，但ATM吐出了一张纸条' },
  { fromName: '修仙残卷', toName: '上古玉简', newEffect: { cul: 2 }, desc: '玉简上的符文自行浮现' },
  { fromName: '特工日记', toName: '加密芯片', effectDelta: { INT: 1, PER: -1 }, desc: '芯片植入后，你开始看到一些不该看到的东西' },
  { fromName: '金唱片', toName: '裂开的唱片', effectDelta: { APP: -1, HAP: 1 }, desc: '碎片反射出的光影里，有人在跳舞' },
  { fromName: '黑色面具', toName: '深渊凝视', effectDelta: { INT: 1, HLT: -1 }, desc: '你凝视深渊，深渊也在凝视你' },
  { fromName: '轮回之钥', toName: '命运碎片', effectDelta: { SOC: -1, INT: -1, MNY: -1, PER: -1, HLT: -1, APP: -1, HAP: 1 }, desc: '钥匙碎成了无数片，每一片都映着不同的人生' },
  { fromName: '破损的存档', toName: '崩坏的代码', effectDelta: { INT: 1, PER: -1 }, desc: '存档损坏了，但你从乱码中读出了真相' },
  { fromName: '夜行手套', toName: '隐形斗篷', effectDelta: { PER: 1, MNY: -1 }, desc: '手套褪色后变得透明，穿戴者也是' },
  { fromName: '断裂的魔杖', toName: '接骨木残枝', newEffect: { INT: 3, HAP: 1 }, desc: '断口处长出了新芽' },
  { fromName: '停摆的怀表', toName: '逆转沙漏', effectDelta: { HLT: 1, PER: -1 }, desc: '沙子开始往上流了' },
  { fromName: '锈迹斑斑的哑铃', toName: '黄金哑铃', effectDelta: { HLT: 1 }, desc: '铁锈剥落，露出了金色的内核' },
  { fromName: '破碎的手机屏', toName: '全息投影仪', effectDelta: { APP: 1, SOC: -1 }, desc: '碎片重组成了一个小型投影装置' },
  { fromName: '扑克牌', toName: '命运塔罗', newEffect: { INT: 3, HAP: 1 }, desc: '扑克牌的花色变成了塔罗图案' },
  { fromName: '冠军奖杯', toName: '碎裂的王冠', effectDelta: { HAP: -1, PER: 1 }, desc: '奖杯碎了，但碎片拼成了一顶王冠' },
];

// ── Relic Triggers (blue = flavor events, purple = storyline boosts) ──

// Blue relics: one-time flavor event that fires when a condition is met during gameplay.
// Each trigger fires once per playthrough. `condFn(state)` gates it; `apply(state)` runs the effect.
const BLUE_TRIGGERS = [
  {
    relicName: 'GRE词汇书',
    condFn: s => s.profession === '本科生' && s.INT >= 6,
    log: '你翻开口袋里那本GRE词汇书，某个单词突然让你灵光一闪。',
    apply: s => { s.INT = (s.INT || 0) + 1; },
    effectDesc: '智力 +1',
  },
  {
    relicName: '信用卡账单',
    condFn: s => s.MNY <= 2 && s.age >= 18,
    log: '你摸出那张冻结的信用卡，ATM居然吐出了一笔钱。',
    apply: s => { s.MNY = (s.MNY || 0) + 2; },
    effectDesc: '家境 +2',
  },
  {
    relicName: '健身会员卡',
    condFn: s => s.HLT >= 5 && s.monthTotal >= 24,
    log: '你用那张旧会员卡推开健身房的门，身体记住了一切。',
    apply: s => { s.HLT = (s.HLT || 0) + 1; s.PER = (s.PER || 0) + 1; },
    effectDesc: '健康 +1 毅力 +1',
  },
  {
    relicName: '恋人的信',
    condFn: s => s.relationship === '恋爱中' || s.relationship === '已婚',
    log: '你在抽屉深处找到一封泛黄的信，读完之后心里暖暖的。',
    apply: s => { s.HAP = (s.HAP || 0) + 2; },
    effectDesc: '快乐 +2',
  },
  {
    relicName: '精致的发带',
    condFn: s => s.APP >= 6 && s.age >= 19,
    log: '你系上那条褪色的发带，镜子里的自己突然变得耀眼。',
    apply: s => { s.APP = (s.APP || 0) + 1; },
    effectDesc: '颜值 +1',
  },
  {
    relicName: '旧护照',
    condFn: s => s.overseas === 1,
    log: '海关翻开你的旧护照，里面夹着一张前世的登机牌。一阵既视感涌来。',
    apply: s => { s.SOC = (s.SOC || 0) + 1; },
    effectDesc: '社交 +1',
  },
  {
    relicName: '学生证',
    condFn: s => s.profession === '本科生' && s.age <= 20,
    log: '你摸出一张旧学生证，照片上的人和你长得一模一样。',
    apply: s => { s.HAP = (s.HAP || 0) + 1; },
    effectDesc: '快乐 +1',
  },
  {
    relicName: '简历模板',
    condFn: s => s.profession === '求职中',
    log: '你打开那份简历模板，技能栏虽然被划掉了，但格式完美。面试官眼前一亮。',
    apply: s => { s.SOC = (s.SOC || 0) + 1; s.PER = (s.PER || 0) + 1; },
    effectDesc: '社交 +1 毅力 +1',
  },
];

// Purple relics: when inheriting a purple relic and re-entering the same storyline,
// give a stat boost to the storyline-specific stat. `boostStat` is the stat key,
// `boostAmount` is the bonus applied once when entering the storyline.
const PURPLE_TRIGGERS = [
  { relicName: '修仙残卷', storylines: ['xianxia'], boostStat: 'cul', boostAmount: 3, log: '残卷上的符文自行浮现，修为大增。' },
  { relicName: '特工日记', storylines: ['spy'], boostStat: 'PER', boostAmount: 2, log: '日记里的暗号你竟然看得懂，身手敏捷了许多。' },
  { relicName: '冠军奖杯', storylines: ['esports', 'worlds', 'minor_league'], boostStat: 'MMR', boostAmount: 50, log: '握住奖杯的瞬间，操作手感回来了。' },
  { relicName: '冠军奖杯', storylines: ['athlete'], boostStat: 'ATH', boostAmount: 3, log: '奖杯在背包里发出微光，你的身体充满力量。' },
  { relicName: '主厨围裙', storylines: ['chef'], boostStat: 'CKL', boostAmount: 3, log: '系上围裙的瞬间，刀工记忆涌上手指。' },
  { relicName: '金唱片', storylines: ['idol', 'superstar', 'band'], boostStat: 'POP', boostAmount: 3, log: '唱片在阳光下闪烁，你不自觉地哼起了旋律。' },
  { relicName: '黑色面具', storylines: ['abyss'], boostStat: 'INT', boostAmount: 2, log: '面具贴上脸的一刻，低语变成了指引。' },
  { relicName: '扑克牌', storylines: ['poker', 'triton', 'local_shark'], boostStat: 'POK', boostAmount: 3, log: '你拿起那副51张的牌，第一手就是同花顺。' },
  { relicName: '破旧的哨子', storylines: ['party', 'wasted'], boostStat: 'SOC', boostAmount: 2, log: '哨声响起，全场的目光都聚焦在你身上。' },
  { relicName: '代码U盘', storylines: ['academic'], boostStat: 'REP', boostAmount: 3, log: 'U盘里的README写着一行代码，你瞬间理解了导师的课题。' },
  { relicName: '代码U盘', storylines: ['ceo'], boostStat: 'MNY', boostAmount: 2, log: 'U盘里的商业计划书虽然过时，但核心思路依然超前。' },
  { relicName: '破损的存档', storylines: ['meta'], boostStat: 'PER', boostAmount: 2, log: '存档加载了一瞬间，你看到了这个世界的代码。' },
  { relicName: '夜行手套', storylines: ['thief'], boostStat: 'PER', boostAmount: 2, log: '戴上手套的瞬间，黑暗变得透明。' },
  { relicName: '断裂的魔杖', storylines: ['hogwarts'], boostStat: 'MAG', boostAmount: 3, log: '魔杖断口处迸出火花，它认出了你。' },
  { relicName: '停摆的怀表', storylines: ['timeloop'], boostStat: 'PER', boostAmount: 2, log: '怀表突然开始走动，你感觉时间在你手中。' },
  { relicName: '锈迹斑斑的哑铃', storylines: ['fitness'], boostStat: 'FIT', boostAmount: 3, log: '举起哑铃的那一刻，前世的肌肉记忆全部回来了。' },
  { relicName: '破碎的手机屏', storylines: ['influencer', 'mcn', 'streamer'], boostStat: 'FAN', boostAmount: 3, log: '碎屏亮起，粉丝数从0开始疯涨。' },
  { relicName: '一叠假身份证', storylines: ['cheater'], boostStat: 'NET', boostAmount: 3, log: '翻开假证的瞬间，那些代号和暗语全部回忆起来了。' },
];

// ── Trigger check functions (called from game.js) ───────────────

// Checks blue relic triggers during advanceMonth. Returns { log, effectDesc } or null.
// Fires at most once per relic per playthrough — tracks via state._relicTriggered Set.
export function checkBlueTrigger(state) {
  const relic = state._inheritedRelic;
  if (!relic || relic.grade !== 1) return null; // blue = grade 1
  if (!state._relicTriggered) state._relicTriggered = new Set();
  if (state._relicTriggered.has('blue')) return null; // already fired this playthrough

  const trigger = BLUE_TRIGGERS.find(t => t.relicName === relic.name);
  if (!trigger) return null;
  if (!trigger.condFn(state)) return null;

  // Fire the trigger
  trigger.apply(state);
  state._relicTriggered.add('blue');
  return { log: trigger.log, effectDesc: trigger.effectDesc };
}

// Checks purple relic trigger when entering a storyline. Returns { log, boostStat, boostAmount } or null.
// Called from applyEvent when ev.set.storyline is set.
export function checkPurpleTrigger(state, newStoryline) {
  const relic = state._inheritedRelic;
  if (!relic || relic.grade !== 2) return null; // purple = grade 2
  if (!state._relicTriggered) state._relicTriggered = new Set();
  if (state._relicTriggered.has('purple')) return null;

  const trigger = PURPLE_TRIGGERS.find(t => t.relicName === relic.name && t.storylines.includes(newStoryline));
  if (!trigger) return null;

  // Apply the boost
  state[trigger.boostStat] = (state[trigger.boostStat] || 0) + trigger.boostAmount;
  state._relicTriggered.add('purple');
  return { log: trigger.log, boostStat: trigger.boostStat, boostAmount: trigger.boostAmount };
}

// ── Persistence ──────────────────────────────────────────────────

function _load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { vault: [], activeRelicId: null };
    const data = JSON.parse(raw);
    if (!Array.isArray(data.vault)) data.vault = [];
    return data;
  } catch { return { vault: [], activeRelicId: null }; }
}

function _save(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}

// ── Public API ───────────────────────────────────────────────────

export function getRelicVault() {
  return _load().vault;
}

export function getVaultCount() {
  return _load().vault.length;
}

export function addRelic(relic) {
  const data = _load();
  if (data.vault.length >= MAX_VAULT) return false;
  data.vault.push(relic);
  _save(data);
  return true;
}

export function removeRelic(relicId) {
  const data = _load();
  data.vault = data.vault.filter(r => r.id !== relicId);
  if (data.activeRelicId === relicId) data.activeRelicId = null;
  _save(data);
}

export function setActiveRelic(relicId) {
  const data = _load();
  data.activeRelicId = relicId;
  _save(data);
}

export function getActiveRelic() {
  const data = _load();
  if (!data.activeRelicId) return null;
  return data.vault.find(r => r.id === data.activeRelicId) || null;
}

export function clearActiveRelic() {
  const data = _load();
  data.activeRelicId = null;
  _save(data);
}

// Called at end of game: consume one life from the active relic, apply mutation
export function consumeActiveRelic() {
  const data = _load();
  if (!data.activeRelicId) return null;
  const relic = data.vault.find(r => r.id === data.activeRelicId);
  if (!relic) { data.activeRelicId = null; _save(data); return null; }

  relic.lives--;
  let mutationResult = null;

  if (relic.lives > 0 && !relic.noDecay) {
    mutationResult = _tryMutate(relic);
  }

  if (relic.lives <= 0) {
    data.vault = data.vault.filter(r => r.id !== relic.id);
  }

  data.activeRelicId = null;
  _save(data);
  return { relic, mutationResult, destroyed: relic.lives <= 0 };
}

// ── Relic Generation ─────────────────────────────────────────────

export function generateRelic(state, score, isLegendary, isGood, storylineNameMap) {
  const targetGrade = _determineGrade(state, score, isLegendary, isGood);
  const template = _pickTemplate(targetGrade, state, score, isLegendary);
  const grade = template.actualGrade;

  const slName = (storylineNameMap && state.storyline) ? (storylineNameMap[state.storyline] || state.storyline) : '';

  const relic = {
    id: 'relic_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    name: template.name,
    description: template.desc,
    grade,
    effect: { ...template.effect },
    origin: {
      endingId: state.endingId || 0,
      school: state.school || '无',
      storyline: slName,
      age: state.age || 0,
      score: score || 0,
      profession: state.profession || '',
      relationship: state.relationship || '',
    },
    lives: GRADE_LIVES[grade],
    maxLives: GRADE_LIVES[grade],
    mutations: [],
  };
  if (template.noDecay) relic.noDecay = true;
  if (template.special) relic.special = template.special;
  return relic;
}

function _determineGrade(state, score, isLegendary, isGood) {
  if (isLegendary && score >= 25000) return 3;
  if (isLegendary) {
    return Math.random() < 0.6 ? 3 : 2;
  }
  if (isGood || score >= 18000) {
    const r = Math.random();
    if (r < 0.1) return 3;
    if (r < 0.5) return 2;
    return 1;
  }
  if (score >= 10000) {
    const r = Math.random();
    if (r < 0.05) return 2;
    if (r < 0.4) return 1;
    return 0;
  }
  return Math.random() < 0.15 ? 1 : 0;
}

function _pickTemplate(grade, state, score, isLegendary) {
  const enriched = {
    ...state,
    _score: score,
    _isLegendary: isLegendary,
    _isHiddenStoryline: ['spy', 'abyss', 'meta', 'xianxia', 'thief', 'hogwarts', 'timeloop'].includes(state.storyline),
  };

  // Try the target grade first, then fall through lower grades
  for (let g = grade; g >= 0; g--) {
    const pool = RELIC_TEMPLATES[g];
    if (!pool) continue;
    const matching = pool.filter(t => !t.cond || t.cond(enriched));
    const fallback = pool.filter(t => !t.cond);
    const candidates = matching.length > 0 ? matching : fallback;
    if (candidates.length > 0) {
      return { actualGrade: g, ...candidates[Math.floor(Math.random() * candidates.length)] };
    }
  }
  return { actualGrade: 0, ...RELIC_TEMPLATES[0][0] };
}

// ── Mutation ─────────────────────────────────────────────────────

function _tryMutate(relic) {
  const chance = GRADE_MUTATE_CHANCE[relic.grade] || 0.1;
  if (Math.random() > chance) return null;

  const specific = MUTATIONS.find(m => m.fromName === relic.name);
  if (specific) {
    relic.mutations.push({ from: relic.name, to: specific.toName, life: relic.lives });
    relic.name = specific.toName;
    relic.description = specific.desc;
    if (specific.newEffect) {
      relic.effect = { ...specific.newEffect };
    } else if (specific.effectDelta) {
      for (const [k, v] of Object.entries(specific.effectDelta)) {
        relic.effect[k] = (relic.effect[k] || 0) + v;
        if (relic.effect[k] <= 0) delete relic.effect[k];
      }
    }
    return { type: 'specific', name: relic.name, desc: relic.description };
  }

  // Generic mutation: shift one stat ±1
  const keys = Object.keys(relic.effect);
  if (keys.length === 0) return null;
  const key = keys[Math.floor(Math.random() * keys.length)];
  const delta = Math.random() < 0.4 ? 1 : -1;
  relic.effect[key] = (relic.effect[key] || 0) + delta;
  if (relic.effect[key] <= 0) delete relic.effect[key];

  const mutDesc = delta > 0 ? '遗物在轮回中变得更强了' : '遗物在轮回中有些褪色了';
  relic.mutations.push({ from: relic.name, to: relic.name, life: relic.lives, delta });
  return { type: 'generic', name: relic.name, desc: mutDesc, key, delta };
}

// ── Share Encoding ───────────────────────────────────────────────

const REDEEMED_KEY = 'sasr_redeemed_v1';

function _loadRedeemed() {
  try { return JSON.parse(localStorage.getItem(REDEEMED_KEY) || '[]'); } catch { return []; }
}
function _saveRedeemed(list) {
  try { localStorage.setItem(REDEEMED_KEY, JSON.stringify(list)); } catch {}
}
function _isRedeemed(sid) { return _loadRedeemed().includes(sid); }
function _markRedeemed(sid) {
  const list = _loadRedeemed();
  if (!list.includes(sid)) { list.push(sid); _saveRedeemed(list); }
}

export function encodeRelicShare(relic) {
  // sid is fixed per relic — same relic always produces same sid
  const sid = relic.id;
  const slim = {
    sid,
    n: relic.name, g: relic.grade,
    e: relic.effect, d: relic.description,
    o: { s: relic.origin.school, sl: relic.origin.storyline, a: relic.origin.age },
  };
  try {
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(slim))));
    // Mark as redeemed on sender side too — prevents self-import
    _markRedeemed(sid);
    return code;
  } catch { return ''; }
}

export function decodeRelicShare(encoded) {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const slim = JSON.parse(json);
    if (!slim.sid) return { error: '无效的遗物码' };
    if (_isRedeemed(slim.sid)) return { error: '这个遗物码已经被使用过了' };
    // Check if the relic is already in the vault (same source relic or same name)
    const vault = getRelicVault();
    if (vault.some(r => r.id === slim.sid || r.name === slim.n)) {
      return { error: '你已经拥有这件遗物了' };
    }
    return {
      id: 'relic_gift_' + Date.now(),
      sid: slim.sid,
      name: slim.n, grade: slim.g,
      effect: slim.e, description: slim.d,
      origin: { school: slim.o.s, storyline: slim.o.sl, age: slim.o.a, score: 0, endingId: 0 },
      lives: GRADE_LIVES[slim.g],
      maxLives: GRADE_LIVES[slim.g],
      mutations: [],
      isGift: true,
    };
  } catch { return { error: '无效的遗物码' }; }
}

// Call after successfully adding the relic to vault
export function redeemRelicCode(sid) {
  if (sid) _markRedeemed(sid);
}

// ── UI Helpers ───────────────────────────────────────────────────

export function formatEffect(effect) {
  if (!effect || Object.keys(effect).length === 0) return '（已褪色）';
  const LABELS = {
    SOC: '社交', INT: '智力', MNY: '家境', HAP: '快乐',
    HLT: '健康', PER: '毅力', APP: '颜值',
    cul: '修为', dao: '大道',
  };
  return Object.entries(effect)
    .map(([k, v]) => `${LABELS[k] || k} ${v > 0 ? '+' : ''}${v}`)
    .join('  ');
}

export function gradeLabel(grade) {
  return GRADE_NAMES[grade] || GRADE_NAMES[0];
}

export function gradeColor(grade) {
  return GRADE_COLORS[grade] || GRADE_COLORS[0];
}

export { MAX_VAULT, GRADE_NAMES, GRADE_COLORS, GRADE_LIVES };

// ── Relic Vault Modal UI ─────────────────────────────────────────

let _vaultModalOpen = false;

export function openVaultModal() {
  const modal = document.getElementById('relic-vault-modal');
  if (!modal) return;
  _renderVaultContent();
  const cap = document.getElementById('rv-capacity');
  if (cap) cap.textContent = `${getVaultCount()}/${MAX_VAULT}`;
  modal.classList.add('open');
  _vaultModalOpen = true;
}

export function closeVaultModal() {
  const modal = document.getElementById('relic-vault-modal');
  if (!modal) return;
  modal.classList.remove('open');
  _vaultModalOpen = false;
}

function _renderVaultContent() {
  const vault = getRelicVault();
  const grid = document.getElementById('rv-grid');
  if (!grid) return;

  if (vault.length === 0) {
    grid.innerHTML = '<div class="rv-empty">还没有遗物。完成一局游戏后可以留下遗物。</div>';
    return;
  }

  grid.innerHTML = vault.map(r => _renderRelicCard(r, true)).join('');
}

function _renderRelicCard(relic, showDiscard) {
  const effectStr = formatEffect(relic.effect);
  const livesStr = Array.from({ length: relic.maxLives }, (_, i) =>
    `<span class="rv-life ${i < relic.lives ? 'active' : ''}">⏳</span>`
  ).join('');

  return `
    <div class="rv-card grade-${relic.grade}" data-relic-id="${relic.id}">
      <div class="rv-card-header">
        <span class="rv-card-grade" style="color:${gradeColor(relic.grade)}">${gradeLabel(relic.grade)}</span>
      </div>
      <div class="rv-card-name">${relic.name}</div>
      <div class="rv-card-effect">${effectStr}</div>
      <div class="rv-card-lives">${livesStr}</div>
      <div class="rv-card-desc">"${relic.description}"</div>
      <div class="rv-card-origin">来自：${[relic.origin.school !== '无' && relic.origin.school, relic.origin.storyline, relic.origin.age + '岁'].filter(Boolean).join(' · ')}</div>
      ${showDiscard ? `<div class="rv-card-actions">
        <button class="rv-share-btn" data-relic-id="${relic.id}">分享</button>
        <button class="rv-discard-btn" data-relic-id="${relic.id}">丢弃</button>
      </div>` : ''}
    </div>
  `;
}

function _handleImport(modal) {
  const input = modal.querySelector('#rv-import-input');
  if (!input) return;
  const code = input.value.trim();
  if (!code) { _flashImportMsg(modal, '请粘贴遗物码', false); return; }

  const result = decodeRelicShare(code);
  if (result.error) { _flashImportMsg(modal, result.error, false); return; }

  if (getVaultCount() >= MAX_VAULT) { _flashImportMsg(modal, '遗物库已满，请先丢弃一个', false); return; }

  if (addRelic(result)) {
    redeemRelicCode(result.sid);
    input.value = '';
    _flashImportMsg(modal, `成功导入「${result.name}」！`, true);
    _renderVaultContent();
    updateVaultButton();
    const cap = document.getElementById('rv-capacity');
    if (cap) cap.textContent = `${getVaultCount()}/${MAX_VAULT}`;
  }
}

function _showConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'rv-confirm-overlay';
    overlay.innerHTML = `
      <div class="rv-confirm-box">
        <div class="rv-confirm-msg">${message}</div>
        <div class="rv-confirm-btns">
          <button class="rv-confirm-cancel">取消</button>
          <button class="rv-confirm-ok">确定</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    const cleanup = (result) => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };
    overlay.querySelector('.rv-confirm-cancel').onclick = () => cleanup(false);
    overlay.querySelector('.rv-confirm-ok').onclick = () => cleanup(true);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
  });
}

function _flashImportMsg(modal, msg, success) {
  const el = modal.querySelector('#rv-import-msg');
  if (!el) return;
  el.textContent = msg;
  el.className = 'rv-import-msg ' + (success ? 'success' : 'error');
  el.style.display = '';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

export function initRelicUI() {
  const modal = document.getElementById('relic-vault-modal');
  if (!modal) return;

  const closeBtn = modal.querySelector('.rv-close');
  if (closeBtn) closeBtn.addEventListener('click', closeVaultModal);

  const backdrop = modal.querySelector('.rv-backdrop');
  if (backdrop) backdrop.addEventListener('click', closeVaultModal);

  modal.addEventListener('click', (e) => {
    // Discard
    const discardBtn = e.target.closest('.rv-discard-btn');
    if (discardBtn) {
      const id = discardBtn.dataset.relicId;
      if (id) {
        const vault = getRelicVault();
        const target = vault.find(r => r.id === id);
        const name = target ? `「${target.name}」` : '这件遗物';
        _showConfirm(`确定要丢弃${name}吗？<br>丢弃后无法恢复。`).then(ok => {
          if (!ok) return;
          removeRelic(id);
          _renderVaultContent();
          updateVaultButton();
          const cap = document.getElementById('rv-capacity');
          if (cap) cap.textContent = `${getVaultCount()}/${MAX_VAULT}`;
        });
      }
    }
    // Share
    const shareBtn = e.target.closest('.rv-share-btn');
    if (shareBtn) {
      const id = shareBtn.dataset.relicId;
      const vault = getRelicVault();
      const relic = vault.find(r => r.id === id);
      if (!relic) return;
      const code = encodeRelicShare(relic);
      if (!code) return;
      navigator.clipboard.writeText(code).then(() => {
        shareBtn.textContent = '已复制';
        shareBtn.classList.add('copied');
        setTimeout(() => { shareBtn.textContent = '分享'; shareBtn.classList.remove('copied'); }, 2000);
      }).catch(() => {
        // Fallback: select a temp input
        const tmp = document.createElement('textarea');
        tmp.value = code; document.body.appendChild(tmp);
        tmp.select(); document.execCommand('copy');
        tmp.remove();
        shareBtn.textContent = '已复制';
        shareBtn.classList.add('copied');
        setTimeout(() => { shareBtn.textContent = '分享'; shareBtn.classList.remove('copied'); }, 2000);
      });
    }
    // Import
    const importBtn = e.target.closest('#rv-import-btn');
    if (importBtn) {
      _handleImport(modal);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (_vaultModalOpen && e.key === 'Escape') closeVaultModal();
  });

  updateVaultButton();
}

export function updateVaultButton() {
  const btn = document.getElementById('relic-vault-btn');
  if (!btn) return;
  const count = getVaultCount();
  const countEl = btn.querySelector('#relic-vault-count');
  if (countEl) countEl.textContent = `${count}/${MAX_VAULT}`;
}

// ── Relic Slot (flat card grid in alloc step) ────────────────────

let _slotSelectedId = null;

export function renderRelicSlot() {
  const slot = document.getElementById('relic-slot');
  if (!slot) return;

  const vault = getRelicVault();
  if (vault.length === 0) {
    slot.style.display = 'none';
    _slotSelectedId = null;
    return;
  }

  slot.style.display = '';
  _slotSelectedId = null;
  _renderSlotContent(slot, vault);
}

function _renderSlotContent(slot, vault) {
  slot.innerHTML = `
    <div class="relic-slot-header">
      <span class="relic-slot-title">前世遗物</span>
      <span class="relic-slot-sub">选 1 个带入本局 · 结束后轮回次数 -1</span>
    </div>
    <div class="relic-slot-grid">
      ${vault.map(r => {
        const effectStr = formatEffect(r.effect);
        const livesStr = Array.from({ length: r.maxLives }, (_, i) =>
          `<span class="rv-life ${i < r.lives ? 'active' : ''}">⏳</span>`
        ).join('');
        const sel = r.id === _slotSelectedId ? ' picked' : '';
        return `
          <div class="relic-slot-card grade-${r.grade}${sel}" data-relic-id="${r.id}">
            <div class="relic-slot-card-grade" style="color:${gradeColor(r.grade)}">${gradeLabel(r.grade)}</div>
            <div class="relic-slot-card-name">${r.name}</div>
            <div class="relic-slot-card-effect">${effectStr}</div>
            <div class="relic-slot-card-lives">${livesStr}</div>
          </div>
        `;
      }).join('')}
    </div>
    <button class="relic-slot-skip${_slotSelectedId ? '' : ' active'}">空手而来</button>
  `;
}

export function initRelicSlot() {
  const slot = document.getElementById('relic-slot');
  if (!slot) return;

  slot.addEventListener('click', (e) => {
    const vault = getRelicVault();
    if (!vault.length) return;

    // Click a card → select (or deselect if already selected)
    const card = e.target.closest('.relic-slot-card');
    if (card) {
      const id = card.dataset.relicId;
      if (_slotSelectedId === id) {
        // Deselect
        _slotSelectedId = null;
        clearActiveRelic();
      } else {
        _slotSelectedId = id;
        setActiveRelic(id);
      }
      _renderSlotContent(slot, vault);
      return;
    }

    // Click skip → deselect
    if (e.target.closest('.relic-slot-skip')) {
      _slotSelectedId = null;
      clearActiveRelic();
      _renderSlotContent(slot, vault);
      return;
    }
  });
}

// Called right before initGame to finalize the relic choice onto state
export function finalizeRelicChoice() {
  if (_slotSelectedId) {
    setActiveRelic(_slotSelectedId);
    return getActiveRelic();
  }
  clearActiveRelic();
  return null;
}

// ── Post-game reward modal (pick 1 of 3) ─────────────────────────

let _rewardResolve = null;

export function generateRelicChoices(state, score, isLegendary, isGood, storylineNameMap) {
  // Check storylinesVisited for guaranteed purple relics
  const visited = state.storylinesVisited ? [...state.storylinesVisited] : [];
  const purplePool = RELIC_TEMPLATES[2];
  const guaranteedPurples = [];

  for (const tpl of purplePool) {
    if (!tpl.storylines) continue;
    if (tpl.storylines.some(sl => visited.includes(sl))) {
      guaranteedPurples.push(tpl);
    }
  }

  // If player visited storylines → guaranteed purple(s) come first, then fill rest randomly
  // If multiple storylines visited, all matching purples are shown (up to 3)
  const relics = [];

  if (guaranteedPurples.length > 0) {
    // Add guaranteed purples (up to 3)
    for (const tpl of guaranteedPurples.slice(0, 3)) {
      const slName = (storylineNameMap && state.storyline) ? (storylineNameMap[state.storyline] || state.storyline) : '';
      relics.push({
        id: 'relic_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
        name: tpl.name,
        description: tpl.desc,
        grade: 2,
        effect: { ...tpl.effect },
        origin: {
          endingId: state.endingId || 0,
          school: state.school || '无',
          storyline: slName,
          age: state.age || 0,
          score: score || 0,
          profession: state.profession || '',
          relationship: state.relationship || '',
        },
        lives: GRADE_LIVES[2],
        maxLives: GRADE_LIVES[2],
        mutations: [],
      });
    }
  }

  // Fill remaining slots (up to 3 total) with normal generation
  while (relics.length < 3) {
    relics.push(generateRelic(state, score, isLegendary, isGood, storylineNameMap));
  }

  return relics;
}

export function showRelicReward(relics) {
  return new Promise((resolve) => {
    _rewardResolve = resolve;
    const modal = document.getElementById('relic-reward-modal');
    if (!modal) { resolve(null); return; }

    const grid = document.getElementById('relic-reward-grid');
    grid.innerHTML = relics.map((r, i) => {
      const effectStr = formatEffect(r.effect);
      const livesStr = Array.from({ length: r.maxLives }, (_, i) =>
        `<span class="rv-life ${i < r.lives ? 'active' : ''}">⏳</span>`
      ).join('');
      return `
        <div class="rv-card reward-card grade-${r.grade}" data-idx="${i}">
          <div class="rv-card-header">
            <span class="rv-card-grade" style="color:${gradeColor(r.grade)}">${gradeLabel(r.grade)}</span>
          </div>
          <div class="rv-card-name">${r.name}</div>
          <div class="rv-card-effect">${effectStr}</div>
          <div class="rv-card-lives">${livesStr}</div>
          <div class="rv-card-desc">"${r.description}"</div>
        </div>
      `;
    }).join('');

    let selectedIdx = null;
    const keepBtn = document.getElementById('relic-reward-keep');
    const skipBtn = document.getElementById('relic-reward-skip');
    keepBtn.disabled = true;

    const fullArea = document.getElementById('relic-reward-full');
    if (fullArea) fullArea.style.display = 'none';

    grid.onclick = (e) => {
      const card = e.target.closest('.reward-card');
      if (!card) return;
      grid.querySelectorAll('.reward-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedIdx = parseInt(card.dataset.idx, 10);

      // Check vault capacity
      const vault = getRelicVault();
      if (vault.length >= MAX_VAULT) {
        keepBtn.textContent = '遗物库已满，请先丢弃一个';
        keepBtn.disabled = true;
        _renderRewardReplace(modal, relics[selectedIdx]);
      } else {
        keepBtn.textContent = '收入遗物库';
        keepBtn.disabled = false;
        if (fullArea) fullArea.style.display = 'none';
      }
    };

    keepBtn.onclick = () => {
      if (selectedIdx == null) return;
      const chosen = relics[selectedIdx];
      if (addRelic(chosen)) {
        modal.classList.remove('open');
        updateVaultButton();
        if (_rewardResolve) { _rewardResolve(chosen); _rewardResolve = null; }
      }
    };

    skipBtn.onclick = () => {
      modal.classList.remove('open');
      if (_rewardResolve) { _rewardResolve(null); _rewardResolve = null; }
    };

    modal.classList.add('open');
  });
}

function _renderRewardReplace(modal, newRelic) {
  const replaceArea = document.getElementById('relic-reward-full');
  if (!replaceArea) return;
  replaceArea.style.display = '';
  const vault = getRelicVault();
  replaceArea.innerHTML = `
    <div class="rv-replace-title">选择要丢弃的遗物：</div>
    ${vault.map(r => `
      <div class="rv-replace-item" data-relic-id="${r.id}">
        <span style="color:${gradeColor(r.grade)}">${r.name}</span>
        <span class="rv-card-effect">${formatEffect(r.effect)}</span>
      </div>
    `).join('')}
  `;

  replaceArea.onclick = (e) => {
    const item = e.target.closest('.rv-replace-item');
    if (!item) return;
    const oldId = item.dataset.relicId;
    removeRelic(oldId);
    if (addRelic(newRelic)) {
      modal.classList.remove('open');
      updateVaultButton();
      if (_rewardResolve) { _rewardResolve(newRelic); _rewardResolve = null; }
    }
  };
}

// ── Mutation Toast ───────────────────────────────────────────────

export function showMutationToast(result) {
  if (!result) return;
  if (!result.mutationResult && !result.destroyed) return;
  const mr = result.mutationResult;
  const toast = document.createElement('div');
  toast.className = 'relic-mutation-toast';
  toast.innerHTML = `
    <div class="rmt-title">${mr ? '遗物变异' : '遗物消散'}</div>
    <div class="rmt-name">${result.relic.name}</div>
    ${mr ? `<div class="rmt-desc">${mr.desc}</div>` : ''}
    ${result.destroyed ? '<div class="rmt-destroyed">遗物在轮回中消散了...</div>' : ''}
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 500);
  }, 3500);
}

// ── Gift link detection ──────────────────────────────────────────

export function checkGiftLink() {
  const hash = window.location.hash;
  if (!hash.startsWith('#relic=')) return null;
  const encoded = hash.slice(7);
  const result = decodeRelicShare(encoded);
  window.history.replaceState(null, '', window.location.pathname);
  if (result.error) return null; // invalid or already redeemed
  return result;
}
