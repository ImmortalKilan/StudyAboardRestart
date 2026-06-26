// ── Engine Constants ─────────────────────────────────────────────────────
// Pure data: zero DOM dependency, zero side effects.
// Extracted from game.js for reuse across Web and Mini Program targets.

export const STAT_KEYS = ['SOC', 'INT', 'MNY', 'PER', 'HLT', 'APP'];

export const STAT_LABELS = {
  SOC: '社交', INT: '智力', MNY: '家境',
  HAP: '快乐', HLT: '健康', PER: '毅力', APP: '颜值',
  POP: '人气', POK: '牌技', MMR: '天梯分', FIT: '体能', CKL: '厨艺', ATH: '运动', MAG: '魔力', REP: '声望', BND: '影响力', FAN: '粉丝', NET: '势力',
  CHRONO: '时空影响力',
  PSY: '精神力', CLARITY: '清醒度',
  cul: '修为', dao: '大道', karma: '机缘', tribulation: '渡劫', realm: '境界',
};

export const EFFECT_KEYS = new Set([
  ...STAT_KEYS, 'HAP',
  'POP', 'POK', 'MMR', 'FIT', 'CKL', 'ATH', 'MAG', 'REP', 'BND', 'FAN', 'NET', 'HEAT',
  'cul', 'dao', 'karma', 'tribulation',
  'darkOmen', 'courage', 'alliance', 'knowledge', 'cheat_risk',
  'CHRONO', 'timeslip_progress',
  'PSY', 'CLARITY', 'mutant_progress', 'moral',
]);

export const XIANXIA_KEYS = ['realm', 'cul', 'dao', 'karma', 'tribulation'];

// ── Ending classification ────────────────────────────────────────────────
export const LEGENDARY_ENDINGS = new Set([
  50099, // Spy Success
  60090, 60095, // Abyss: 数字神明 / AGI融合 (真结局)
  70092, 70093, // Meta: Ctrl+W / True Ending
  82090, // CEO Peak
  83090, // Esports World Champion
  84061, // Fitness Legend
  85061, // Chef 3-Star
  81090, // Poker God
  86105, 86120, 86136, // Athlete Top Tier
  87190, // Thief Ghost Rating
  61611, // Hogwarts: defeated Voldemort with Elder Wand
  48190, 48191, // EE
  48290, 48291, // ME
  48390, 48391, // BIO
  48590, 48591, // MED
  48790, 48791, // LAW
  48990, 48991, // Film
  42190, 42191, // CS
  43190,        // 商科
  44190,        // 理科
  45191,        // 文科/文艺
  49990, 49991, 49992,  // 音乐
  89090, // Academic White Hat
  89092, // Academic Black Hat
  78081, // Band champion
  76090, // Influencer top
  76096, // Influencer comeback
  88261, // Cheater trad S-tier
  88267, // Cheater tech S-tier
  98160, // Timeslip: 战国真结局 文明的曙光
  98260, // Timeslip: 二战真结局 和平之子
  98360, // Timeslip: 宫斗真结局 凤临天下
  96510, // Mutant: 真相线真结局 记忆花园的守墓人
  96520, // Mutant: 独行线真结局 超越者
  96530, // Mutant: 接纳线真结局 手套下的温度
  96540, // Mutant: 同盟线真结局 双螺旋
  99170, // Xianxia: 羽化撕碎虚空
  99213, // Xianxia: 星尘超脱
]);

export const GOOD_ENDINGS = new Set([
  70091, // Meta: Accept Ending
  80105, // Idol Superstar
  82096, // Corporate Elite
  84091, // Fitness Influencer
  85091, 85092, // Chef 2-Star / 1-Star
  90050, 90052, 90054, 90056, // Late dropout good endings
  61612, // Hogwarts: sacrificial victory
  48192, // EE
  48292, // ME
  48392, // BIO
  48592, // MED
  48792, // LAW
  48992, // Film
  76095, // Influencer MCN平稳退出
  88160, // Cheater 金盆洗手
  88262, // Cheater 惊险过关
  88264, // Cheater 跑路
  98161, // Timeslip: 战国普通结局 青史留名
  98261, // Timeslip: 二战普通结局 无名英雄
  98361, // Timeslip: 宫斗普通结局 宫墙之外
  96511, // Mutant: 真相线普通结局 未完成的拼图
  96521, // Mutant: 独行线普通结局 孤独的棋手
  96531, // Mutant: 接纳线普通结局 带着裂缝的杯子
  96541, // Mutant: 同盟线普通结局 不稳定的同盟
  96503, // Mutant: 扭转结局 我是谁
  96505, // Mutant: 暗王结局
  99171, // Xianxia: 飞升仙界
  99503, // Xianxia: 散仙人间
]);

// ── Xianxia realm derivation ─────────────────────────────────────────────
export function deriveRealm(cul) {
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

// ── Allocation ───────────────────────────────────────────────────────────
export const ALLOC_TOTAL_BASE = 25;
export const MAX_PER_STAT = 10;

// ── Profession by age ────────────────────────────────────────────────────
export const DEFAULT_PROF_BY_AGE = [
  { max: 18, prof: '高中生' },
  { max: 22, prof: '本科生' },
  { max: 25, prof: '打工人' },
  { max: 35, prof: '社畜' },
  { max: 55, prof: '中年人' },
  { max: 99, prof: '退休' },
];

// ── Storyline categories ─────────────────────────────────────────────────
export const HIDDEN_STORYLINES = new Set([
  'spy', 'abyss', 'meta', 'xianxia', 'thief', 'hogwarts', 'timeloop', 'timeslip', 'mutant',
]);

export const SPECIAL_STORYLINES = new Set([
  'idol', 'superstar', 'streamer', 'poker', 'triton', 'local_shark',
  'party', 'ceo', 'wasted', 'esports', 'worlds', 'minor_league',
  'fitness', 'chef', 'athlete', 'academic', 'band',
  'influencer', 'mcn', 'cheater',
]);

export const STORYLINE_UNLOCK_STAT = {
  idol: 'POP', superstar: 'POP', streamer: 'POP',
  poker: 'POK', triton: 'POK', local_shark: 'POK',
  esports: 'MMR', worlds: 'MMR', minor_league: 'MMR',
  fitness: 'FIT',
  chef: 'CKL',
  athlete: 'ATH',
  hogwarts: 'MAG',
  academic: 'REP',
  band: 'BND',
  influencer: 'FAN', mcn: 'FAN',
  cheater: 'NET',
  timeslip: 'CHRONO',
  mutant: 'PSY',
};

// ── Student phase sets ───────────────────────────────────────────────────
export const STUDENT_PHASES = new Set([
  '高中生', '本科生', '理工生', '商科生', '文科生',
  '准留学生', '考研党', '迷茫大学生', '准研究生', '研究生', '海外研究生',
]);

export const GRAD_SCHOOL_PHASES = new Set(['准研究生', '研究生', '海外研究生']);
