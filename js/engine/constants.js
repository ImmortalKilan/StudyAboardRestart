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

// ── Ending titles (称号) — Tier 1: curated for every legendary/good ending ──
// Used by getPlayerTitle() in game.js as the highest-priority title source.
// Any legendary/good ending id not listed here falls through to Tier 2/3.
export const ENDING_TITLES = {
  // 隐藏线：间谍 / 深渊 / 元叙事
  50099: '影子特工',
  60090: '数字神明',
  60095: '赛博造物主',
  70092: 'Ctrl+W',
  70093: '破壁人',
  70091: '清醒的普通人',

  // 职业线：CEO / 电竞 / 健美 / 厨神 / 扑克 / 运动 / 怪盗 / 霍格沃茨
  82090: '资源整合之王',
  83090: '电竞GOAT',
  84061: '奥林匹亚先生',
  85061: '米其林三星主厨',
  81090: '扑克之神',
  86105: 'NBA状元秀',
  86120: '世界杯冠军',
  86136: '飞盘世界冠军',
  87190: '幽灵大盗',
  61611: '老魔杖之主',
  80105: '武道馆偶像',
  82096: '全身而退的创业者',
  84091: '健身网红',
  85091: '米其林二星主厨',
  85092: '米其林一星传奇',
  61612: '浴血凯旋的巫师',

  // 转码/学业深造：EE / ME / BIO / MED / LAW / Film / CS / 商科 / 理科 / 文科 / 音乐
  48190: '半导体教父',
  48191: '芯片独角兽创始人',
  48290: '总工程师',
  48291: '智能制造革命者',
  48390: '新药之父',
  48391: '生物医药上市新贵',
  48590: '妙手神医',
  48591: '术式冠名人',
  48790: '最贵大律师',
  48791: '铁面大检察官',
  48990: '金棕榈导演',
  48991: '百亿票房大导',
  42190: '首席架构师',
  42191: '纳斯达克敲钟人',
  43190: '资本巨鳄',
  44190: '诺奖得主',
  45191: '传世大家',
  49990: '格莱美新人王',
  49991: '亚洲巡演天王',
  49992: '金曲制作人',
  48192: '跨界技术总监',
  48292: '跨界工业软件专家',
  48392: '生信大神',
  48592: '受人尊敬的X大夫',
  48792: '改变法律的人',
  48992: '奥斯卡编剧',

  // 黑客 / 乐队 / 网红 / 代考
  89090: '白帽黑客',
  89092: '暗网幽灵',
  78081: '冠军贝斯手',
  76090: '顶流网红',
  76096: '翻身网红',
  88261: '考神',
  88267: 'AI考神',
  76095: '全身而退的网红',
  88160: '金盆洗手的枪手',
  88262: '虚惊一场的枪手',
  88264: '跑路的枪手',

  // 穿越三线
  98160: '文明的曙光',
  98260: '和平之子',
  98360: '凤临天下',
  98161: '青史留名',
  98261: '无名英雄',
  98361: '宫墙之外',

  // 变异者线
  96510: '记忆守墓人',
  96520: '超越者',
  96530: '手套下的温度',
  96540: '双螺旋',
  96511: '未完成的拼图',
  96521: '孤独的棋手',
  96531: '带裂缝的杯子',
  96541: '不稳定的同盟',
  96503: '我是谁',
  96505: '暗王',

  // 修真线 + 转专业晚退学
  99170: '羽化撕碎虚空',
  99213: '星尘超脱',
  99171: '飞升仙界',
  99503: '散仙人间',
  90050: '王牌销冠',
  90052: '大器晚成',
  90054: '外卖单王',
  90056: '小店老板',
};

// ── Ending titles — Tier 3: fallback archetype when no ending text is
// usable and the ending isn't in ENDING_TITLES. Keyed by the dominant
// final stat (see getPlayerTitle() in game.js for selection logic).
export const STAT_ARCHETYPE_TITLES = {
  INT: '书呆子学神',
  SOC: '社交牛逼症',
  MNY: '家境实力派',
  APP: '颜值天花板',
  HLT: '养生达人',
  PER: '钢铁般的意志',
  HAP: '快乐至上主义者',
};

// ── Rank tier → rarity percentile line shown on the share poster ─────────
export const RANK_PERCENTILE = {
  'S+': '超过 <b>99%</b> 的留子',
  'S': '超过 <b>95%</b> 的留子',
  'A': '超过 <b>82%</b> 的留子',
  'B': '超过 <b>60%</b> 的留子',
  'C': '超过 <b>35%</b> 的留子',
  'D': '超过 <b>15%</b> 的留子',
  'F': '别灰心，垫底才有反差萌',
};

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
