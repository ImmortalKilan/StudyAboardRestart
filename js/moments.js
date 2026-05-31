/**
 * 朋友圈 (Moments / Social Feed) Engine
 * ─────────────────────────────────────
 * Generates NPC classmate posts and comments each game month.
 * Integrates with game.js via initMoments / tickMoments / checkPostable.
 */

// Hidden storylines — must match HIDDEN_STORYLINES in game.js
// Feed is blocked + reactions cleared when player enters one of these
const HIDDEN_STORYLINE_SET = new Set(['spy', 'abyss', 'meta', 'xianxia', 'thief', 'hogwarts', 'timeloop']);

// ══════════════════════════════════════════════════════════════
//  EASTER EGG TRACKING — persisted across playthroughs via localStorage
// ══════════════════════════════════════════════════════════════
const EGG_STORAGE_KEY = 'sasr_moments_eggs_v1';
const EGG_DEFS = {
  // ID: { name, hint }
  mom_last_post:  { name: '妈妈的最后一条朋友圈', hint: '结局之后那条没说完的话' },
  fourth_wall:    { name: '第四面墙裂痕',         hint: '有人在透过屏幕看你' },
  hidden_npc:     { name: '???的踪迹',           hint: '名单上多出来的那位' },
  midnight_3am:   { name: '凌晨三点的朋友圈',     hint: '正常人都该睡了' },
  festival:       { name: '节日彩蛋',             hint: '现实世界的某一天' },
  group_screenshot: { name: '群聊截图',           hint: '原来朋友圈外还有世界' },
  cipher:         { name: '藏字游戏',             hint: '每句的第一个字' },
  dejavu:         { name: '前世的回响',           hint: '重开够多次才能解锁' },
  npc_shade:      { name: 'NPC 暗讽',             hint: '他们其实都知道' },
  hidden_entry:   { name: '朋友圈里的暗号',       hint: '用对的暗号回复对的人' },
};

function _loadEggs() {
  try {
    const raw = localStorage.getItem(EGG_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}
function _saveEggs(set) {
  try { localStorage.setItem(EGG_STORAGE_KEY, JSON.stringify([...set])); } catch {}
}
function _unlockEgg(id) {
  if (!EGG_DEFS[id]) return;
  const eggs = _loadEggs();
  if (eggs.has(id)) return false;
  eggs.add(id);
  _saveEggs(eggs);
  _showEggToast(id);
  return true;
}
function _showEggToast(id) {
  const def = EGG_DEFS[id];
  if (!def) return;
  let toast = document.getElementById('moments-egg-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'moments-egg-toast';
    toast.className = 'moments-egg-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `
    <div class="egg-toast-icon">🥚</div>
    <div class="egg-toast-body">
      <div class="egg-toast-title">朋友圈彩蛋</div>
      <div class="egg-toast-name">${def.name}</div>
      <div class="egg-toast-hint">${def.hint}</div>
    </div>
  `;
  toast.classList.remove('show');
  void toast.offsetWidth; // restart anim
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4500);
}
// ══════════════════════════════════════════════════════════════
//  EASTER EGGS — special post pools (#4 第四面墙 / #6 群聊截图 / #9 数字密码)
// ══════════════════════════════════════════════════════════════

// #4 第四面墙裂痕 — NPC 偶尔发元意味帖子
const FOURTH_WALL_POSTS = [
  { type: ['scholar','grinder','lazy','romantic','rich','social'],
    text: '今天突然觉得，我们好像在被人观察。' },
  { type: ['scholar','romantic'],
    text: '你有没有觉得，有时候做选择不是自己做的？' },
  { type: ['lazy','rich'],
    text: '如果我们都是别人故事里的角色，那我宁愿是个有戏的反派。' },
  { type: ['romantic','social'],
    text: '梦里我去了好多个不同的人生，醒来还是在这里。' },
  { type: ['grinder','scholar'],
    text: '突然意识到时间不是连续的。每个瞬间之间都有一道缝隙。' },
  { type: ['rich','social'],
    text: '今天朋友圈打开特别慢，好像有人在加载这一切。' },
];

// #6 群聊截图 — NPC 转发"群聊截图"
const GROUP_SCREENSHOT_POSTS = [
  { type: ['social','rich'],
    text: '[群聊截图] 群友 A：你们看 ta 朋友圈了吗？\n群友 B：看了，那条挺有意思的\n群友 A：评论区更好看\n群友 C：被我截图了\n\n...谁能告诉我他们说的是谁？' },
  { type: ['lazy','scholar'],
    text: '[群聊截图] 神秘群友：这一届的人比上一届的有意思\n神秘群友：尤其那个 X X X\n神秘群友：剩下的也都各有戏\n\n大半夜的不知道哪个群，看了一下没看明白。' },
  { type: ['romantic','social'],
    text: '[转] 翻到去年的群聊，原来去年这条聊到我了：\n→ "ta 这种人最容易被感情骗"\n→ "这倒是真的"\n→ "下次见面别提"\n\n...是不是我现在该提一下了。' },
  { type: ['grinder','scholar'],
    text: '[截图] 找到一个"留学生爹味聚集地"群，里面有人在分析每个同学的发展轨迹。我居然被列入"潜力股 top 10"了。但前 9 个我一个都不认识。' },
];

// #9 数字密码 — 每句首字组合藏一句话
const CIPHER_POSTS = [
  { type: ['scholar','grinder'],
    text: '认 真 思 考 一 个 问 题：\n你 觉 得 你 是 谁？\n不 要 急 着 回 答。\n要 想 清 楚。\n撕 掉 标 签 看 看。',
    cipher: '你不要撕（cipher hint: 每行首字）' },
  { type: ['romantic','lazy'],
    text: '我 真 的 受 够 了\n们 是 不 是 都 在 演？\n都 装 作 没 看 见\n是 不 是 都 同 谋?',
    cipher: '我们都是 (一种群体感)' },
  { type: ['rich','social'],
    text: '别 总 看 我 朋 友 圈\n看 你 自 己 的\n回 头 看\n家 里 有 人 等',
    cipher: '别看回家 (劝玩家关掉游戏)' },
];

function _maybeAddEasterEggPost(gameState) {
  if (!momentsState || momentsState.blocked) return;
  // 0.8% per tick — 大约每年触发 1 次（24 个月 × 0.5 概率）
  const roll = Math.random();
  if (roll > 0.008) return;

  const monthTotal = gameState.monthTotal || 0;
  // 选一个 NPC
  const candidates = momentsState.npcs;
  if (!candidates || candidates.length === 0) return;

  // 三选一：fourth_wall / group_screenshot / cipher
  const eggType = ['fourth_wall', 'group_screenshot', 'cipher'][Math.floor(Math.random() * 3)];
  let pool, eggId;
  if (eggType === 'fourth_wall') { pool = FOURTH_WALL_POSTS; eggId = 'fourth_wall'; }
  else if (eggType === 'group_screenshot') { pool = GROUP_SCREENSHOT_POSTS; eggId = 'group_screenshot'; }
  else { pool = CIPHER_POSTS; eggId = 'cipher'; }

  // 找一个合适类型的 NPC
  const eligible = pool.filter(p => candidates.some(n => p.type.includes(n.type)));
  if (eligible.length === 0) return;
  const picked = eligible[Math.floor(Math.random() * eligible.length)];
  const npc = candidates.find(n => picked.type.includes(n.type));
  if (!npc) return;

  _addNpcPost(npc, picked.text, 'general', gameState);
  npc._lastPostMonth = monthTotal;
  _unlockEgg(eggId);
}

// ══════════════════════════════════════════════════════════════
//  EASTER EGG #5: Hidden Storyline Entry — NPC 发暗号，玩家正确回复触发
// ══════════════════════════════════════════════════════════════
/**
 * Each entry has:
 *   npcType: 哪种 NPC 适合发这条
 *   text:    NPC 的暗号帖子
 *   keywords: 玩家评论里需要包含的关键词（任意一个匹配即可）
 *   storyline: 触发的隐藏剧情 id
 *   minAge:  最早触发年龄
 */
const HIDDEN_ENTRY_POSTS = [
  {
    npcType: 'scholar',
    text: '夜里收到了一封匿名邮件。署名只有三个字母：A.B.Y. 求懂的同学私聊。',
    // 收紧：必须输入明确的暗号，不能是 'aby' 这种 'baby' 子串
    keywords: ['A.B.Y', 'ABY', 'abyss', '深渊'],
    storyline: 'abyss',
    minAge: 19,
    hint: '看到不该看的东西',
  },
  {
    npcType: 'social',
    text: '今天在咖啡馆遇到一个奇怪的人，他说了一串数字给我：1-1-4-5-1-4。然后就走了。',
    // 收紧：去掉 '114' 和 '懂的都懂'（前者会撞门牌/电话，后者太常见）
    keywords: ['114514', '1145', 'meta'],
    storyline: 'meta',
    minAge: 18,
    hint: '一切都是模拟',
  },
  {
    npcType: 'lazy',
    text: '今天午睡梦到自己重活了一次。一切都跟现在一模一样。这种感觉有点恐怖...',
    // 收紧：去掉 '梦/又一次/我也是' 这种日常常见词，保留密码感强的
    keywords: ['重开', '重生', 'timeloop', '回环', '时间回环', '又重开'],
    storyline: 'timeloop',
    minAge: 17,
    hint: '时间在打转',
  },
  {
    npcType: 'rich',
    text: '家族里有个不能提的人。最近发现 ta 留下的笔记。第一页只写了三个字："信任我"。',
    // 收紧：'信任' 单字太常见，必须组合或专有名词
    keywords: ['信任我', '信任你', 'spy', '间谍', '特工'],
    storyline: 'spy',
    minAge: 19,
    hint: '看似平常的对话',
  },
];

// 玩家在某条暗号帖子下评论时检查，触发剧情解锁
function _checkHiddenEntryReply(post, commentText) {
  if (!post._hiddenEntry) return null;
  const entry = post._hiddenEntry;
  const lower = commentText.toLowerCase();
  const matched = entry.keywords.some(kw => lower.includes(kw.toLowerCase()));
  if (!matched) return null;
  // 通过 callback 告知 game.js
  if (_onHiddenEntryUnlock) {
    _onHiddenEntryUnlock(entry.storyline, entry.hint);
  }
  _unlockEgg('hidden_entry');
  return entry;
}

// game.js 注册回调 — 接收 (storylineId, hint) 后触发对应剧情
let _onHiddenEntryUnlock = null;
export function setMomentsHiddenEntryHandler(fn) { _onHiddenEntryUnlock = fn; }

function _maybeAddHiddenEntryPost(gameState) {
  if (!momentsState || momentsState.blocked) return;
  // 已有玩家在某条隐藏剧情中？不触发
  if (gameState.storyline) return;
  // 每 18 个月 check 一次，触发率 8% — 一局可能出现 1-2 个暗号帖
  if ((gameState.monthTotal || 0) % 18 !== 0) return;
  if (Math.random() > 0.08) return;

  const eligible = HIDDEN_ENTRY_POSTS.filter(p => gameState.age >= p.minAge);
  if (eligible.length === 0) return;
  const picked = eligible[Math.floor(Math.random() * eligible.length)];
  const npc = momentsState.npcs.find(n => n.type === picked.npcType);
  if (!npc) return;

  // 添加一条特殊的隐藏入口帖子
  _addNpcPost(npc, picked.text, 'general', gameState);
  // 最新添加的就是 momentsState.posts[0]
  const post = momentsState.posts[0];
  if (post) {
    post._hiddenEntry = picked;
    post._protectedFromPrune = true; // 保留这条直到玩家互动
  }
  npc._lastPostMonth = gameState.monthTotal;
}

// ══════════════════════════════════════════════════════════════
//  EASTER EGG #7: Real-time 3am posts
//  EASTER EGG #8: Real-date festival posts
// ══════════════════════════════════════════════════════════════
const MIDNIGHT_3AM_POSTS = {
  scholar:  '凌晨三点。该睡了。但 paper deadline 是明天。',
  rich:     '又是凌晨三点的酒店阳台。生活有时候安静得有点可怕。',
  social:   '这个点还醒着的都是有故事的人。来聊聊？',
  lazy:     '凌晨三点看手机，原来不止我一个人。',
  grinder:  '睡眠是 productivity 的最大反派。但今晚我可能输了。',
  romantic: '夜很深，想 ta。',
};
const FESTIVAL_POSTS = {
  christmas: {
    rich:     '在阿斯本滑雪。这才是 Christmas 🎄',
    social:   '今晚开 100 人的圣诞 party 🎄 谁来？',
    romantic: '和 ta 一起拆礼物 🎁 这就是幸福吧',
    scholar:  '别人都在过节，我在写 paper。圣诞快乐？',
    grinder:  '今天 office 只有我和保安。互祝圣诞快乐。',
    lazy:     '没有人陪过节也挺好，电视里有圣诞特别节目。',
  },
  spring_festival: {
    rich:     '年夜饭定在了米其林二星。今年红包发到手软 🧧',
    social:   '今年回家初一到初七排满了局，每天三场。',
    romantic: '一起回家见家长 ❤️ 终于走到这一步了',
    scholar:  '春节也在 lab。教授说今年要带病过年。',
    grinder:  '春节加班 + 1。但 manager 说我 dedication 满分。',
    lazy:     '今年压岁钱破了纪录。还是当孩子好。',
  },
  halloween: {
    rich:     '万圣节 party 主办方是我。预算别问。',
    social:   '装扮成了 Joker 🃏 收获了 100 张照片 + 50 个微信',
    romantic: '和 ta cosplay 情侣装 🎃 朋友圈点赞破千',
    scholar:  '万圣节也在改 paper。Trick or paper？',
    grinder:  '万圣节加班。糖果是 office 茶水间的。',
    lazy:     '万圣节宅家。但我打游戏的角色 cosplay 起来了。',
  },
  mid_autumn: {
    rich:     '中秋家宴。月饼是从外公那一辈传下来的方子。',
    social:   '在 Times Square 看到了月亮，跟群里发了 300 张照片。',
    romantic: '一个人的中秋。给 ta 发了短信，没回。',
    scholar:  '中秋赏月顺便看了篇 paper。月亮和论文都很美。',
    grinder:  '中秋加班。月饼是 office 福袋里的。',
    lazy:     '今年的中秋月饼我一口都没吃完。',
  },
};
function _maybeAddTimeBasedEgg(gameState) {
  if (!momentsState || momentsState.blocked) return;
  // 每 6 个月才 check 一次，避免每月都触发
  if ((gameState.monthTotal || 0) % 6 !== 0) return;

  const now = new Date();
  const hour = now.getHours();
  const month = now.getMonth() + 1; // 1-12
  const date = now.getDate();

  // 凌晨 3 点：hour 0-4
  if (hour >= 0 && hour <= 4) {
    if (Math.random() < 0.5) {
      const eligible = momentsState.npcs.filter(n => MIDNIGHT_3AM_POSTS[n.type]);
      if (eligible.length > 0) {
        const npc = eligible[Math.floor(Math.random() * eligible.length)];
        _addNpcPost(npc, MIDNIGHT_3AM_POSTS[npc.type], 'general', gameState);
        npc._lastPostMonth = gameState.monthTotal;
        _unlockEgg('midnight_3am');
        return;
      }
    }
  }

  // 节日 check
  let festival = null;
  if (month === 12 && date >= 20 && date <= 27) festival = 'christmas';
  else if ((month === 1 && date >= 20) || (month === 2 && date <= 15)) festival = 'spring_festival';
  else if (month === 10 && date >= 28 && date <= 31) festival = 'halloween';
  else if (month === 9 && date >= 10 && date <= 20) festival = 'mid_autumn';

  if (festival && Math.random() < 0.7) {
    const pool = FESTIVAL_POSTS[festival];
    const eligible = momentsState.npcs.filter(n => pool[n.type]);
    if (eligible.length > 0) {
      const npc = eligible[Math.floor(Math.random() * eligible.length)];
      _addNpcPost(npc, pool[npc.type], 'general', gameState);
      npc._lastPostMonth = gameState.monthTotal;
      _unlockEgg('festival');
    }
  }
}

// ══════════════════════════════════════════════════════════════
//  EASTER EGG #3: déjà vu (cross-playthrough)
// ══════════════════════════════════════════════════════════════
const DEJAVU_POSTS = [
  '做了个奇怪的梦，梦里你不是这样的人。',
  '感觉这一切，我经历过一次了。Déjà vu 真奇怪。',
  '今早醒来突然觉得自己年纪很大。其实我刚 20。',
  '群里的人我好像都很熟，但又叫不上名字。',
  '昨晚梦到自己重活了一次，醒来朋友圈一切如常。',
];
const DEJAVU_PLAYER_NAMED = [
  // 这条会替换 ${playerName} 为玩家中文名
  '嘿，${playerName}。欢迎再次来到这里。',
  '${playerName}，我们好像见过。但每次都是这样的开头。',
  '${playerName}，你这次想清楚要做什么了吗？',
];
function _maybeAddDejavuEgg(gameState) {
  if (!momentsState || momentsState.blocked) return;
  // 读取重开次数（来自 game.js sessionPlayCount，或 localStorage）
  let restartCount = 0;
  try {
    restartCount = parseInt(localStorage.getItem('sasr_total_plays') || '0', 10) || 0;
  } catch {}
  // 重开 3 次以下不触发
  if (restartCount < 3) return;
  // 每 6 个月 check，1.5% 概率
  if ((gameState.monthTotal || 0) % 6 !== 0) return;
  if (Math.random() > 0.015) return;

  const npc = momentsState.npcs[Math.floor(Math.random() * momentsState.npcs.length)];
  if (!npc) return;

  // 重开 ≥ 5 次：解锁带玩家名字的 déjà vu
  let text;
  if (restartCount >= 5 && Math.random() < 0.3) {
    const playerName = gameState._playerCnName || '同学';
    text = DEJAVU_PLAYER_NAMED[Math.floor(Math.random() * DEJAVU_PLAYER_NAMED.length)]
      .replace('${playerName}', playerName);
  } else {
    text = DEJAVU_POSTS[Math.floor(Math.random() * DEJAVU_POSTS.length)];
  }
  _addNpcPost(npc, text, 'general', gameState);
  npc._lastPostMonth = gameState.monthTotal;
  _unlockEgg('dejavu');
}

// ══════════════════════════════════════════════════════════════
//  EASTER EGG #2: Mom's Last Post (called from game.js on game end)
// ══════════════════════════════════════════════════════════════
/**
 * Add a final "mom post" to the feed when the game ends.
 * The post content depends on the player's ending tone.
 * Call this from game.js when state.phase === 'ended'.
 */
export function addMomLastPost(gameState, endingTone) {
  if (!momentsState) return;
  if (momentsState._momLastPostAdded) return; // only once
  momentsState._momLastPostAdded = true;

  // Pick a mom post based on tone
  let text;
  if (endingTone === 'tragedy' || endingTone === 'death') {
    // 玩家死了/失踪 — 妈妈不知道，停留在过去
    const lines = [
      '小宝，你最近怎么不接妈妈电话？妈妈炖了你最爱的鸡汤。',
      '又一年过去了。儿子/女儿，你还好吗？妈妈想你了。',
      '今天整理你高中的相册，眼泪都掉下来了。回家吧。',
      '小区里又来了一个跟你像的孩子。妈妈看了好久。',
    ];
    text = lines[Math.floor(Math.random() * lines.length)];
  } else if (endingTone === 'legendary' || endingTone === 'good') {
    // 玩家功成名就 — 妈妈骄傲
    const lines = [
      '今天看到孩子的新闻报道，妈妈在朋友圈转发了 8 遍。',
      '终于熬到孩子有出息了。从 15 岁那个夏天，到现在，妈妈值了。',
      '孩子今天给我打电话说一切都好，妈妈在阳台站了半小时。',
      '陪伴是最长情的告白。从你出生那天就开始。',
    ];
    text = lines[Math.floor(Math.random() * lines.length)];
  } else {
    // 普通结局 — 平淡温情
    const lines = [
      '今天和孩子视频了 20 分钟。够了，妈妈很满足。',
      '回头看，你长大的每个瞬间妈妈都记得。',
      '不管你混得怎么样，回家的灯永远亮着。',
      '小时候你不爱吃青菜，长大了反而最爱了。妈妈一直记得。',
    ];
    text = lines[Math.floor(Math.random() * lines.length)];
  }

  const post = {
    id: `mom_last_${Date.now()}`,
    isPlayer: false,
    npcType: 'mom',
    name: '妈妈',
    initial: '妈',
    isClose: true, // 妈妈永远是 A 档好友
    color: '#c0a080',
    avatarBg: '#2a2218',
    text,
    postType: 'mom_last',
    age: gameState.age,
    month: gameState.monthOfYear,
    time: '此刻',
    comments: [],
    likes: 99,
    _momLast: true,
    _protectedFromPrune: true,
  };

  momentsState.posts.unshift(post);
  momentsState._dirty = true;
  _unlockEgg('mom_last_post');
  _renderMoments();
}

/** Public: get discovered eggs (for summary / memory display) */
export function getDiscoveredEggs() {
  const eggs = _loadEggs();
  return Object.entries(EGG_DEFS).map(([id, def]) => ({
    id, name: def.name, hint: def.hint, discovered: eggs.has(id),
  }));
}

// ══════════════════════════════════════════════════════════════
//  NPC TYPE DEFINITIONS
// ══════════════════════════════════════════════════════════════

const NPC_TYPES = {
  scholar: {
    label: '学霸',
    color: '#4a9de5',
    avatarBg: '#1a2a44',
    names: {
      male:   ['陈思远', '王子明', '刘睿哲', '赵一凡'],
      female: ['周敏仪', '林悦彤', '吴书晗', '孙若琳'],
      en:     ['Kevin', 'Edward', 'Claire', 'Sophia'],
    },
    bio: (npc) => `${npc.school || '某知名大学'} · ${npc.major || '学术研究'}`,
    commentStyle: 'academic',
  },
  rich: {
    label: '富二代',
    color: '#f5b642',
    avatarBg: '#3d2a0a',
    names: {
      male:   ['钱俊豪', '黄子轩', '何家铭', '方瑞霖'],
      female: ['钱诗涵', '黄雨萱', '何曼妮', '方婉清'],
      en:     ['Justin', 'Brandon', 'Victoria', 'Charlotte'],
    },
    bio: (npc) => `生活美学家 · 世界公民`,
    commentStyle: 'generous',
  },
  social: {
    label: '社交达人',
    color: '#e84393',
    avatarBg: '#3a1a2a',
    names: {
      male:   ['张悦', '李昊然', '马天宇', '陆嘉伟'],
      female: ['张琳琳', '李思颖', '马小曼', '陆婷婷'],
      en:     ['Jessica', 'Alex', 'Rachel', 'Jason'],
    },
    bio: (npc) => `社交网络中心 · 永远在局上`,
    commentStyle: 'enthusiastic',
  },
  lazy: {
    label: '躺平型',
    color: '#6c7a89',
    avatarBg: '#1a1e24',
    names: {
      male:   ['杨小帆', '徐天懒', '冯大福', '郭闲鱼'],
      female: ['杨小萌', '徐悠悠', '冯小雪', '郭甜甜'],
      en:     ['Mike', 'Ethan', 'Amy', 'Sarah'],
    },
    bio: (npc) => `活着就行 · 咸鱼本鱼`,
    commentStyle: 'selfDeprecating',
  },
  grinder: {
    label: '卷王',
    color: '#e74c3c',
    avatarBg: '#2a1010',
    names: {
      male:   ['郑毅恒', '曹学勤', '邓博远', '许奋进'],
      female: ['郑佳琪', '曹雨桐', '邓思源', '许诗涵'],
      en:     ['Derek', 'Andy', 'Cindy', 'Lisa'],
    },
    bio: (npc) => `效率优先 · 永远在路上`,
    commentStyle: 'competitive',
  },
  romantic: {
    label: '恋爱脑',
    color: '#fd79a8',
    avatarBg: '#2a1a24',
    names: {
      male:   ['林小暖', '沈柔情', '唐恋恋', '萧暮雪'],
      female: ['林小鹿', '沈思念', '唐心怡', '萧雨薇'],
      en:     ['Luna', 'Daniel', 'Bella', 'Leo'],
    },
    bio: (npc) => npc._loveCycle === 'single' ? '寻找真爱中...' : npc._loveCycle === 'dating' ? '恋爱中💕' : '重新出发',
    commentStyle: 'romantic',
  },
};

// Mom is always present, only comments on player posts
const MOM_NPC = {
  type: 'mom',
  label: '老妈',
  name: '妈妈',
  color: '#c0a080',
  avatarBg: '#2a2218',
  commentStyle: 'caring',
};

// ══════════════════════════════════════════════════════════════
//  NPC POST TEMPLATES — organized by age range & type
// ══════════════════════════════════════════════════════════════

/**
 * Milestone posts: keyed by NPC type, each an array of { age, month, cond?, text, img? }
 * `cond` is optional fn(npc, gameState) for conditional display
 * `month` can be a number or array of numbers
 */
const MILESTONE_POSTS = {
  scholar: [
    // ── 高中 ──
    { age: 15, month: [9,10], text: '新学期，新目标。高一先把GPA稳住💪' },
    { age: 16, month: [2,3], text: '竞赛初赛过了！开始准备复赛，每天刷题到凌晨两点...' },
    { age: 16, month: [6,7], text: '暑假报了三个学科营，比上学还忙😂' },
    { age: 17, month: [9], text: '高三了。SAT/雅思/竞赛三线作战，感觉头发要掉光了' },
    { age: 17, month: [10,11], text: '文书改到第15版了...为什么每一版中介都说"再改改"' },
    { age: 17, month: [12], text: 'EA/ED申请递交了🙏希望有好消息' },
    { age: 18, month: [3,4], text: (npc) => `录取结果出了！最终去了${npc.school}！感恩一路上帮助过我的每一个人🎉` },
    // ── 本科 ──
    { age: 18, month: [8,9], text: (npc) => `第一天到${npc.school}报到，宿舍比想象中小，但一切都是新的开始` },
    { age: 19, month: [5,6], text: '大一结束了，GPA还行，保持住！暑假找了个科研助理的位置' },
    { age: 19, month: [12], text: '期末考试周。图书馆位置比春运火车票还难抢' },
    { age: 20, month: [3,4], text: '开始考虑读研了...PhD还是Master，这是个问题' },
    { age: 20, month: [9,10], text: '大三了，简历上的项目终于不是只有课程作业了' },
    { age: 21, month: [2,3], text: '研究生申请季...又开始改文书的痛苦循环' },
    { age: 21, month: [11,12], text: '毕业论文开题了，导师说"方向不错，但还需要更多数据"' },
    { age: 22, month: [5,6], text: '本科毕业了🎓 下一站，PhD' },
    // ── PhD ──
    { age: 23, month: [8,9], text: '研究生第一周。lab 比想象中卷，组里 4 个 5 年级老博士盯着我...' },
    { age: 24, month: [4,5], text: '第一篇 paper 投出去了。等结果的日子比 4 月还煎熬' },
    { age: 25, month: [2,3], text: 'Qualifying Exam 通过了！正式从研究生变成 PhD 候选人 🎓' },
    { age: 26, month: [10,11], text: '第三年了。导师终于不催我每周开会了，说明我开始"独立科研"了（？）' },
    { age: 27, month: [5,6], text: '一作 paper 被顶会接收了！可能是这五年最开心的一天' },
    { age: 28, month: [3,4], text: 'Defense 终于通过了 🎉 Dr. 是我了。简历改了五年，今天终于能加上 Dr. 这两个字' },
    // ── 工作 ──
    { age: 28, month: [8,9], text: '入职第一周。Faculty 同事都比我大十岁，我是组里最年轻的 assistant prof。' },
    { age: 30, month: [6,7], text: '第一届硕士生毕业了，看着他们的样子有点恍惚。原来我已经是别人导师了。' },
    { age: 32, month: [3,4], text: 'NSF grant 终于过了！第三次申请，再被拒就要怀疑人生了。' },
    { age: 33, month: [9,10], text: 'Tenure track 第五年。Tenure case 已经准备好了，剩下的就是等。' },
    { age: 34, month: [5,6], text: '拿 tenure 了 🎉 终于可以做自己想做的研究了。从此再也不用追 funding（理论上）。' },
  ],
  rich: [
    // ── 高中 ──
    { age: 15, month: [7,8], text: '暑假和家人去了马尔代夫🏝️ 人少景美，就是Wi-Fi差了点' },
    { age: 16, month: [1,2], text: '新年在瑞士滑雪⛷️ 摔了无数次但很开心！' },
    { age: 16, month: [10,11], text: '中介帮我规划了一条"完美申请路线"，感觉稳了？' },
    { age: 17, month: [12], text: '申请材料交了，顺便在纽约逛了逛，提前感受一下大学城的氛围' },
    { age: 18, month: [3,4], text: (npc) => `offer拿到了！${npc.school}我来了🎊 爸妈说考上就送辆车` },
    // ── 本科 ──
    { age: 18, month: [8,9], text: '到学校了，公寓装修花了一周。终于有了自己的小天地✨' },
    { age: 19, month: [3,4], text: '春假去了坎昆🌴 和朋友们包了个villa' },
    { age: 19, month: [11,12], text: '期末不想学习，在家吃了一周外卖。快乐！' },
    { age: 20, month: [7,8], text: '暑假去了欧洲十国游🇫🇷🇮🇹🇪🇸 行李箱装不下了' },
    { age: 21, month: [6,7], text: '爸让我回去实习了解家里生意，原来赚钱也不容易啊' },
    { age: 22, month: [5,6], text: '毕业了！准备gap一年再想想下一步，先环游世界🌍' },
    // ── Gap & 接班 ──
    { age: 23, month: [4,5], text: '在南美 backpacking 三个月，回来发现微信群消息有 9999+。' },
    { age: 24, month: [1,2], text: '正式入职家族企业。Title 是 Special Projects Manager，其实就是给我爸跑腿的。' },
    { age: 25, month: [9,10], text: '主导了第一个项目。结果还不错。爸第一次在朋友圈转发我了 🥲' },
    { age: 26, month: [11,12], text: '订婚了 💍 对象是 papa 的合伙人的女儿，认识三年了。' },
    { age: 27, month: [5,6], text: '婚礼办在普罗旺斯。请的人不算多，就 200 人左右吧。' },
    { age: 28, month: [10,11], text: '一胎出生 👶 全家人都疯了，比我自己出生那次还隆重（开玩笑）。' },
    { age: 30, month: [3,4], text: '30 岁。爸把上海的分公司交给我了。从今天开始算是真正"上班"了。' },
    { age: 32, month: [7,8], text: '在迪拜买了游艇 🛥️ 不会开，请了个 captain。' },
    { age: 34, month: [11,12], text: '二胎也出生了。这下家族信托基金的分配又得重新算。' },
  ],
  social: [
    // ── 高中 ──
    { age: 15, month: [9,10], text: '新学校第一周就认识了30个人！加了好多微信群😆' },
    { age: 16, month: [3,4], text: '组织了年级春游，150人报名，我是总策划！' },
    { age: 16, month: [12], text: '参加了国际学校的圣诞party🎄 认识了好多有意思的人' },
    { age: 17, month: [5,6], text: '毕业季！大家都在忙申请，我帮同学们整理了一份选校指南' },
    { age: 17, month: [10,11], text: '文书互改小组成立了！大家互帮互助，氛围超好' },
    { age: 18, month: [3,4], text: (npc) => `录了${npc.school}！申请群里大家都在分享offer，好开心！` },
    // ── 本科 ──
    { age: 18, month: [9], text: '开学第一周参加了8个社团的招新😂 最后加了4个' },
    { age: 19, month: [10,11], text: '办了一场200人的万圣节派对🎃 全校都来了！' },
    { age: 20, month: [3,4], text: '做了一个留学生互助平台，用户量刚破1000！' },
    { age: 21, month: [9,10], text: '开始networking了，LinkedIn上加了50个行业前辈' },
    { age: 22, month: [5,6], text: '毕业了！感恩这四年遇到的每一个人🥺 毕业party上大家都哭了' },
    // ── 工作 ──
    { age: 23, month: [7,8], text: 'Day 1 of a new chapter — 入职某 marketing agency。同事都好年轻，我是 oldest in the room（其实最大也只有 26 😂）' },
    { age: 24, month: [5,6], text: '升 Senior Associate 了！比预期早半年。看来"会聊天"是种 hard skill。' },
    { age: 25, month: [11,12], text: '换工作了。去了 client side。终于不用 weekend pitch 了 🙏' },
    { age: 26, month: [4,5], text: '订婚啦 💍 在 college 认识的，谈了五年。这次真的要走到最后了。' },
    { age: 27, month: [10,11], text: '婚礼。我们 invite 了 350 个人，最后来了 280。可能创了我们 friend group 的纪录。' },
    { age: 28, month: [8,9], text: '升 Director 了。下属 12 个，每周 1on1 排满。' },
    { age: 29, month: [11,12], text: '一胎出生 👶 没人告诉过我半夜起来喂奶有多崩溃。' },
    { age: 31, month: [3,4], text: '30 岁同学聚会。来了 80 多个人。我帮 6 对介绍对象成功，剩下 4 对还在 ongoing。' },
    { age: 33, month: [6,7], text: '跳槽去了某独角兽做 VP of Marketing。这次工资翻了一倍。' },
    { age: 34, month: [10,11], text: '二胎出生。终于凑齐"龙凤胎组合"——虽然不是同时生的。' },
  ],
  lazy: [
    // ── 高中 ──
    { age: 15, month: [9,10], text: '开学了...暑假的快乐结束了😴' },
    { age: 16, month: [5,6], text: '期末考试周，我选择了躺平。反正也卷不过你们' },
    { age: 16, month: [11,12], text: '大家都在写文书，我在打游戏。等等，我也该写了吧？' },
    { age: 17, month: [10,11], text: '文书第一版刚写完...其实是截止前一天晚上赶的' },
    { age: 17, month: [12], text: '申请交了！什么？EA？那是啥？我全部RD' },
    { age: 18, month: [3,4], text: (npc) => `offer来了，${npc.school}。虽然不是TOP但够用了，知足常乐！` },
    // ── 本科 ──
    { age: 18, month: [9], text: '到学校了。室友好卷啊，我是不是来错地方了😂' },
    { age: 19, month: [5,6], text: '大一过完了。GPA？别问。问就是及格万岁' },
    { age: 19, month: [12], text: '考试周。我的复习策略：考前一天速成。屡试不爽（大概）' },
    { age: 20, month: [7,8], text: '暑假终于可以在家躺着了🛋️ 什么实习不实习的' },
    { age: 21, month: [3,4], text: '同学们都在找工作/考研，我还在纠结中午吃什么' },
    { age: 22, month: [5,6], text: '毕业了！没想到我也有这一天。接下来...先在家躺几个月吧' },
    // ── 工作 ──
    { age: 23, month: [9,10], text: '在家躺了半年，妈说再不出去就把我送去当兵。最后投了 3 份简历，进了离家最近的那家。' },
    { age: 24, month: [11,12], text: '工作一年了，工资没涨，工作量倒是涨了三倍。哎。' },
    { age: 25, month: [6,7], text: '辞职了。妈又开始唠叨。我说我要 gap year，她说"你已经 gap 三年了"。' },
    { age: 26, month: [3,4], text: '考公备考第一年。背书背到想哭。早知道大学就好好学了（其实根本不知道）。' },
    { age: 27, month: [4,5], text: '面试失败。回家躺了一周。后来发现其实没事，反正也不指望这次能上岸。' },
    { age: 28, month: [11,12], text: '终于上岸了！十八线小县城的事业编。妈哭了，我也哭了——但原因不一样。' },
    { age: 30, month: [3,4], text: '30 岁了。日子还是那个日子，工资还是那个工资。但好像也不太焦虑了。' },
    { age: 32, month: [7,8], text: '相亲了第 8 次。妈说"差不多就行了"。我说"差太多了"。' },
    { age: 34, month: [10,11], text: '突然发现我居然有 20 万存款了。原来不消费真的能存下钱来。' },
  ],
  grinder: [
    // ── 高中 ──
    { age: 15, month: [9], text: '高一目标：年级前三。已经做了详细的学习计划表📋' },
    { age: 16, month: [2,3], text: '寒假没休息，做了200道数学题+读了5本课外书。开学稳了' },
    { age: 16, month: [7,8], text: '暑假：SAT集训+竞赛培训+背单词5000个。时间不够用啊' },
    { age: 17, month: [9], text: 'SAT出分了！距离满分只差一点点，要不要再考一次...' },
    { age: 17, month: [10,11], text: '文书改到第20版了。每一版都比上一版好。精益求精！' },
    { age: 17, month: [12], text: 'ED+EA+RD申了15所学校。概率越大越好👊' },
    { age: 18, month: [3,4], text: (npc) => `${npc.school}！功夫不负有心人！接下来要在大学继续保持节奏` },
    // ── 本科 ──
    { age: 18, month: [9,10], text: '大学第一个月：已经预习完了整学期的课程😤' },
    { age: 19, month: [5,6], text: 'GPA 4.0！Dean\'s List！暑假拿到了大厂实习offer' },
    { age: 20, month: [2,3], text: '大二论文被教授推荐发表了！学术之路越走越宽' },
    { age: 20, month: [9,10], text: '开始准备GRE了，目标330+。每天6个小时备考起步' },
    { age: 21, month: [3,4], text: '研究生offer全到了，全奖！选哪个学校好纠结...' },
    { age: 22, month: [5,6], text: '毕业典礼上拿了最佳论文奖🏆 下一站：更高的山峰' },
    // ── 工作 ──
    { age: 23, month: [7,8], text: '大厂入职 Day 1。同事 95% 是 PhD，剩下的 5% 是早创业过两次的。我，本科应届，进去深呼吸三秒。' },
    { age: 24, month: [11,12], text: '第一次 review，被 manager 说"潜力很大但还需要 push 自己"。回家把所有 weekend 的 plan 都 cancel 了。' },
    { age: 25, month: [5,6], text: '升 Senior Engineer 了！比同期早半年。今晚加班加到 1 点庆祝。' },
    { age: 26, month: [9,10], text: '体检报告下来了，三项异常。医生说"年轻人不要这么拼"。但我不拼怎么 promote？' },
    { age: 27, month: [3,4], text: '终于升 Staff 了 🎉 同期里第一个。但是失眠开始严重了，可能需要看医生。' },
    { age: 28, month: [11,12], text: '挖去某创业公司做 Founding Engineer，stock 给到 1%。赌一把。' },
    { age: 30, month: [3,4], text: '30 岁。复查说我有早期高血压。开始吃降压药了。但 IPO 还差三步，不能停。' },
    { age: 31, month: [6,7], text: '公司 IPO 了 🚀 paper net worth 八位数。但我已经一个月没回家吃过晚饭了。' },
    { age: 33, month: [4,5], text: '辞职了。Burnout 到吃不下饭。去巴厘岛 reset 三个月。' },
    { age: 34, month: [10,11], text: '从巴厘岛回来。开始做远程顾问，一周 work 20 小时。生活第一次像个人。' },
  ],
  romantic: [
    // ── 高中 ──
    { age: 15, month: [10,11], text: '班上新来了一个转学生...好帅/好漂亮啊😳' },
    { age: 16, month: [2,3], text: '情人节收到了匿名情书！好奇是谁写的' },
    { age: 16, month: [9,10], text: '和TA在一起了❤️ 幸福得像个傻子', _setCycle: 'dating' },
    { age: 17, month: [3,4], text: '恋爱半年纪念日🎂 一起去看了日落' },
    { age: 17, month: [8,9], text: '分手了...长距离太难了。哭了一整夜😢', _setCycle: 'breakup' },
    { age: 17, month: [12], text: '申请季根本无心写文书...脑子里全是 ex' },
    { age: 18, month: [3,4], text: (npc) => `去了${npc.school}，新的开始！先不想感情的事了...大概`, _setCycle: 'single' },
    // ── 本科 ──
    { age: 18, month: [10,11], text: '在新学校又心动了...不行不行，先专心学习！' },
    { age: 19, month: [2,3], text: '又恋爱了！！这次一定可以长久❤️‍🔥', _setCycle: 'dating' },
    { age: 19, month: [9,10], text: '一周年纪念日！我们一起做了饭，虽然糊了但很开心' },
    { age: 20, month: [4,5], text: '又分手了...我是不是恋爱绝缘体😭', _setCycle: 'breakup' },
    { age: 20, month: [9,10], text: '决定单身一段时间，好好爱自己', _setCycle: 'single' },
    { age: 21, month: [3,4], text: '命运的齿轮再次转动...又遇到了一个很对的人💫', _setCycle: 'dating' },
    { age: 22, month: [5,6], text: '毕业了。不管感情怎样，这段留学时光教会了我如何去爱' },
    // ── 工作 / 婚姻周期 ──
    { age: 23, month: [4,5], text: '毕业后异地，撑了一年还是分了。第几次了我都不想数了 😞', _setCycle: 'breakup' },
    { age: 24, month: [9,10], text: 'Dating apps 真的好可怕。但又比一个人在家强一点。', _setCycle: 'single' },
    { age: 25, month: [6,7], text: '遇到了一个人，可能真的就是这个了 🌹', _setCycle: 'dating' },
    { age: 26, month: [11,12], text: '订婚了 💍 这次是真的要结婚了。' },
    { age: 27, month: [5,6], text: '结婚啦 👰 这一天等了 28 年（虚岁）。' },
    { age: 29, month: [3,4], text: '一胎出生 👶 才知道当父母比谈恋爱难多了。' },
    { age: 31, month: [9,10], text: '... 我们离婚了。原因不想说，反正没出轨。', _setCycle: 'breakup' },
    { age: 32, month: [6,7], text: '一个人带娃的第一年。其实没想象中难，难的是想 ex 的时候。', _setCycle: 'single' },
    { age: 33, month: [11,12], text: '又遇到了一个人。慢慢来吧。这次先不官宣了。', _setCycle: 'dating' },
    { age: 35, month: [4,5], text: '二婚了 💕 这次小型仪式，只请了真正的好朋友。' },
  ],
};

// ══════════════════════════════════════════════════════════════
//  RANDOM / FILLER POSTS — keyed by NPC type × age range
// ══════════════════════════════════════════════════════════════

const RANDOM_POSTS = {
  // ─────────────────────────────────────────────────────────────
  //  Scholar 学霸
  // ─────────────────────────────────────────────────────────────
  scholar: {
    '15-17': [
      '今天在图书馆找到了一本很有意思的论文合集，标签都翻烂了',
      '又是 debug 到凌晨的一天，终于跑通了！',
      '推荐一本好书：《Why Nations Fail》，读完感觉世界观都变了',
      '模考成绩出来了，还需要继续努力 💪',
      '周末和同学一起讨论了一下午数学题，收获很大',
      '物理竞赛的真题做完了。难度比想象的低，但坑比想象的多。',
    ],
    '18-20': [
      'Office hours 排了半小时队，教授讲了两分钟就解决了我想了三天的问题',
      '实验室的数据终于跑出来了！虽然和预期不太一样...',
      '今天课堂上回答了教授的问题，感觉自己闪闪发光',
      '写论文的痛苦：第一段改了两个小时',
      '在咖啡馆写作业，隔壁桌的人居然也在学同一门课',
      'CS 课的 final project 提交了。两周没睡好觉，今晚必须睡 12 个小时。',
      '突然意识到大学也才四年。开始有点焦虑下一步了。',
    ],
    '21-22': [
      '研究生申请文书快把我逼疯了，但看到学长学姐的经历又充满了动力',
      '毕业论文进度：30%。导师说再加油，我觉得再加命',
      '拿到了一封很好的推荐信，感动到想哭',
      '最后一个学期了，有点舍不得图书馆的老位置',
      'Senior thesis 终于过了。导师在评语里写"超出预期"。我配截图私聊三个朋友。',
    ],
    '23-25': [
      '导师又改了 paper 第七版。我已经分不清哪个版本是哪个了。',
      'Lab meeting 上 present 了。第一次没有手抖。',
      '今晚十点的实验室还有五个人。这就是 PhD 生活。',
      '突然意识到自己已经不是"学生"而是"工人"了。区别是工资低一点。',
      'Conference 投稿被 reject。审稿人 #2 又来了。',
      'Conference 投稿 accept 了 🎉 这次审稿人 #2 居然是支持的，世界变了。',
    ],
    '26-28': [
      '组里来了新一届的硕士生。我开始觉得自己老了。',
      'Defense 前最后一个月。每天梦到自己被 committee 围攻。',
      'Job market season 开始了。Faculty position 比博士还难申。',
      'On-site interview 飞了三个学校，下飞机直接 jet lag 到不会说话。',
      '决定接 offer 了。原来人生第一份正式合同居然要从 25 万年薪开始（还是 9 个月的）。',
    ],
    '29-31': [
      '第一次教 100 人的课。讲台下面坐着的脸比 PhD 答辩的 committee 还可怕。',
      'Grant proposal 写第三轮了。AI 帮不上忙的部分恰好是最难的。',
      '30 岁了。同龄非学术朋友的孩子都快上学了，我还在等 PI promotion。',
      '今晚改 PhD 学生论文到凌晨。突然理解了当年我导师为什么总在凌晨回我邮件。',
      '论文终于 accept 了！这是从 PhD 第三年就开始写的，跨度六年。',
    ],
    '32-35': [
      'Tenure case 终于过了 🎉 这五年没白熬。',
      '今年带的学生第一次拿到 best paper。比自己拿还开心。',
      '同事跳去 industry 了，offer 是我现在工资的三倍。我装作没看到。',
      '突然意识到自己已经 35 了，开始劝学生"不一定非要读 PhD"。',
      '今天和家人吃饭。我妈第一次没问"什么时候发顶刊"。我感动了。',
    ],
  },
  // ─────────────────────────────────────────────────────────────
  //  Rich 富二代
  // ─────────────────────────────────────────────────────────────
  rich: {
    '15-17': [
      '新到了一双限量版球鞋 👟 开心！',
      '家里给配了新车，周末去兜风 🏎️',
      '下午茶 ☕ 生活需要仪式感',
      '米其林三星打卡 ✅ 鹅肝确实好吃',
      '寒假去伦敦三周，朋友圈定位估计会让大家烦死 🙃',
    ],
    '18-20': [
      '周末去了迈阿密晒太阳 🌞',
      '刚从日本回来，买了好多手办和限定周边',
      '新公寓装修完了，效果很满意 ✨',
      '和朋友们在游艇上看了日落 🌅 人生巅峰',
      '试了一家新的 omakase，chef 人很 nice',
      '爸说让我学学投资...好吧先开个模拟盘',
      'Apple keynote 我去了现场。其实没必要去，但去了就是去了。',
    ],
    '21-22': [
      '毕业旅行计划：南美三国 + 南极 🐧 有人一起吗',
      '开始认真思考未来了...要不自己创个业？',
      '虽然不差钱但还是要证明自己的价值。加油！',
      'Senior year 没什么课了。每天 yoga + 看书 + brunch，过得像个 housewife。',
    ],
    '23-25': [
      '在意大利 backpacking 的第 28 天。开始想念上海的小笼包。',
      '爸在朋友圈发了我家公司的新项目。配图是十年前的我。我能 say what？',
      '陪 papa 见客户。客户是我大学同学的爸爸。这世界真小。',
      '我大学室友说："你居然真的在工作"。我也很惊讶。',
      '新车提了 🚗 这次没用爸的钱，刷了自己 bonus。值得记录一下。',
    ],
    '26-28': [
      '出差去东京。住公司给订的酒店，我说"能不能升一下舱"，HR 沉默了五秒。',
      '订婚了 💍 婚礼场地在普罗旺斯。预算别问。',
      '同学聚会上才发现，很多人居然真的在拿月薪。我连 monthly retainer 都嫌 cashflow 麻烦。',
      '收到 family office 的 quarterly report。我居然真的看了一会儿。',
      '婚礼定下来了。最后版本 invite 300 人，predict 200 人会来。',
    ],
    '29-31': [
      '一胎出生 👶 我爸已经在帮孩子取英文名字了。我们还没起中文名。',
      '老婆开始抱怨我应酬太多了。我让她加入。她拒绝了。',
      '上市公司的 board meeting 第一次让我发言。我谈了 ESG，大家都很满意。',
      '30 岁。Papa 把上海的分公司交给我了。这是 birthday gift。',
      '搬去了大宅。新房子的水电费比上一套高三倍。',
    ],
    '32-35': [
      '在迪拜买了游艇。其实不会开船，但有 captain。',
      '今年的家族年会，我第一次坐主桌。Papa 在旁边小声说"别紧张"。',
      '同学开始借钱了。我礼貌地"读不懂"消息。',
      '健身教练说我"成长性下降明显"。33 岁的中年代谢，狗都嫌。',
      '二胎出生了。这下家里热闹了。家族信托基金的分配方案又要重写。',
    ],
  },
  // ─────────────────────────────────────────────────────────────
  //  Social 社交达人
  // ─────────────────────────────────────────────────────────────
  social: {
    '15-17': [
      '今天又认识了三个新朋友！世界真小',
      '被选为学生会主席候选人了，紧张 😬',
      '周末组局：谁来 KTV？已经有 8 个人了',
      '帮同学解决了一个矛盾，成就感满满',
      '生日 party 来了 60 个人。爸妈一脸"这都是谁"。',
    ],
    '18-20': [
      '今天的 networking event 收获了 5 张名片！',
      '组织了一场中秋聚餐 🥮 30 个人一起过节',
      '被邀请参加了一个很棒的 startup pitch night',
      '室友生日惊喜策划成功！看到 ta 的表情一切都值了 🎂',
      '加入了学校的 case competition 团队，队友都很强',
      '在学校碰到了高中同学！世界真是太小了',
      '在洗手间帮陌生人解决了拉链问题，加了微信，下周一起 brunch。',
    ],
    '21-22': [
      '办了一场毕业生 networking dinner，来了 80 多人',
      '帮学弟学妹改文书改到手软，但看到他们拿到 offer 很开心',
      '收到了好多毕业聚会的邀请，每天晚上都有局',
      'Senior week 把所有 best friends 拍了一遍 polaroid，编了一本相册。今天送出去时大家都哭了。',
    ],
    '23-25': [
      '入职新公司第一周已经认识了三层楼的人，CEO 邮件回我"glad to have you on the team"。',
      '帮 director 介绍了对象。成了。我现在是公司里的红娘 lol。',
      '周末有 7 个朋友办了 wedding。我去了 4 个。',
      '老板说"你的 client 关系比你的 KPI 好"。这算 compliment 吗？',
      '同事 happy hour 后我打车送了五个不同方向的人回家。Uber 都看蒙了。',
    ],
    '26-28': [
      '升 Senior Director 了。Team 从 4 个人涨到 12 个人。日程从 9-6 涨到 7-10。',
      '订婚啦 💍 是大学时朋友介绍的对象，谈了快五年。',
      '婚礼定在 Napa，invite 350 人。预计来 280。这是我们 friend group 的纪录。',
      '今年参加了 14 场 wedding。三场是自己策划的。',
      '在公司里非正式当起 mentor。每周和 8 个不同的人 1on1。',
    ],
    '29-31': [
      '一胎出生 👶 朋友圈点赞过千。但半夜起来喂奶时一个朋友都帮不了。',
      '30 岁那天我办了 200 人的聚会。第一次发现累。原来精力是有限的。',
      '同学聚会上才发现，那个高中时最安静的同学现在年薪七位数。世事难料。',
      '老板说我"过度社交"。我以为是优点，原来是 leadership 的 risk。',
      '换了 VP 的 title。终于不用直接 own KPI 了，只用 review 别人的 KPI。',
    ],
    '32-35': [
      '组织了一场中学同学的 reunion。25 年了。来了 60 多人，比毕业那年还热闹。',
      '二胎出生了。这次我比第一次淡定，但老婆已经不想再生了。',
      '跳槽去了某独角兽做 VP。这次工资翻倍，但 commute 也翻倍。',
      '今年的 LinkedIn 通知是 3000+ congrats messages。我一条都没回。',
      '突然发现自己已经成了别人朋友圈里的 "successful 校友" 案例。有点恍惚。',
    ],
  },
  // ─────────────────────────────────────────────────────────────
  //  Lazy 躺平型
  // ─────────────────────────────────────────────────────────────
  lazy: {
    '15-17': [
      '又是在被窝里刷手机到半夜的一天 📱',
      '妈说我不努力以后没出路...但现在很困啊',
      '今天的成就：从床移动到了沙发',
      '看了一天 B 站，质量很高的一天！',
      '今天读完了一本网文。3000 章。我也是有毅力的人嘛。',
    ],
    '18-20': [
      '室友去上课了，我继续睡...反正有录播',
      '食堂的新菜还不错，今天值得发个圈',
      '打了一天游戏，rank 上了一级。这也是进步！',
      '又翘课了...下周一定去（flag 已立）',
      '外卖小哥说"老样子？"...我是不是点太多次了',
      '今天什么都没做但是过得很快乐，这就够了吧？',
      '室友 6 点起床去 gym。我假装没听见。',
    ],
    '21-22': [
      '大家都在忙秋招春招，我在忙着追新番',
      '论文还没开始写...但 deadline 还有两个月呢（心虚）',
      '被我妈催找工作了...先考虑考虑吧',
      '同学说"你毕业后想干什么"，我说"想想"。已经想了三个月。',
    ],
    '23-25': [
      '工作第一年发现一个秘密：原来上班 8 小时只有 3 小时在做事。',
      '同事问我职业规划。我说"活着"。他笑了，以为是开玩笑。',
      '今天又被 manager talk 了，问我"你最近的 deliverable 在哪"。我说在脑子里。',
      '辞职了。这次妈没生气，她说她早就预料到了。',
      '考公备考 day 1。第一本《申论》就让我想睡觉。',
    ],
    '26-28': [
      '面试又挂了。HR 说"对方更 active 一些"。我懂，这是委婉。',
      '上岸了！十八线小县城事业编。妈喜极而泣。我也喜，因为终于不用面试了。',
      '编制内的同事都好佛系。原来不止我一个人。',
      '同学聚会上才发现，工资和年龄不成正比，但和卷的程度成正比。',
      '今天 8 点准时下班。30 岁前我可能再也不会加班了。',
    ],
    '29-31': [
      '30 岁。日子还是那个日子。但好像也没什么遗憾。',
      '被妈安排相亲。对方第一句话是"你工资多少"。我说"够吃"。然后没有然后了。',
      '楼下新开了一家奶茶店。我成了第一批 VIP 会员。',
      '存了 10 万。看着银行卡，第一次觉得不消费也挺好。',
      '今年读了 30 本网文。比大学四年加起来的书还多。',
    ],
    '32-35': [
      '相亲第 12 次。这次对方没问工资，问的是户口。我回家了。',
      '突然想报个班学个东西。报名前一晚突然又不想了。',
      '今天和编制内的同事们组了局打麻将。原来这就是中年人的快乐。',
      '存款破 30 万了。这是不消费的力量。',
      '同学突然 IPO 了。我点了个赞，关掉手机继续追剧。',
    ],
  },
  // ─────────────────────────────────────────────────────────────
  //  Grinder 卷王
  // ─────────────────────────────────────────────────────────────
  grinder: {
    '15-17': [
      '今天效率：学习 12 小时，运动 1 小时，sleep 6 小时。完美的一天',
      'SAT 单词又背了 200 个，距离目标还差 1000',
      '竞赛培训班里都是狠人，但我更狠 😤',
      '做了一份学习计划甘特图，细化到每个小时',
      '今天没有睡午觉，节省了 45 分钟。一年下来就是 270 小时。',
    ],
    '18-20': [
      '又是图书馆开门到关门的一天 📚',
      '暑假实习 offer 拿到了！大厂！冲！',
      '同时修了 6 门课 + 1 个科研 + 1 个实习。时间管理大师就是我',
      '凌晨 3 点的校园真安静，只有我和保安',
      '这学期目标：所有课 A 以上。目前进度：75%',
      '刷了 100 道 LeetCode，感觉自己可以了（吗？）',
      '同学约我打游戏，我说我下周一三五晚上有空。他没回。',
    ],
    '21-22': [
      '秋招拿到了梦想公司的 offer！所有的努力都值了！',
      '毕业论文提前一个月完成了。效率！',
      'GPA 最终定格在 3.9x，差一点满分...有点遗憾',
      'Senior year 课少，我每周再加一份兼职。时间不能浪费。',
    ],
    '23-25': [
      '入职第一周。从早 8 点到晚 11 点。终于知道大厂是什么意思了。',
      '今天写了 800 行代码。Manager 说"质量比数量重要"。但我两个都做到了。',
      '第一次 perf review，被打 "Strong Exceeds"。今晚加班庆祝。',
      '同期的 8 个 new grad 已经走了 3 个。剩下 5 个里，我打算先升 Senior。',
      '体检异常项：3。医生说"年轻人不要这么拼"。可是我不拼别人就拼了。',
    ],
    '26-28': [
      '升 Staff 了，比同期早两年。但发际线也早两年。',
      '面试了三家公司，都给了 offer。最后选了 stock 最多的那家。',
      '在 startup 做 founding engineer。stock 多了 10 倍，工资降了 30%。值得。',
      '失眠加重了。开始吃褪黑素 + 抗焦虑药。但是 IPO 还差三步。',
      '今天差点在 1on1 哭出来。Manager 让我"take a week off"。我说"deadline 之后"。',
    ],
    '29-31': [
      '30 岁。复查说我有早期高血压。开始吃降压药。',
      '公司 IPO 了 🚀 paper net worth 八位数。然后大厨发现我已经一个月没回家吃过饭了。',
      '老婆下了最后通牒：要么辞职，要么离婚。我开始 dust off 简历。',
      'Burnout 严重到不能 commute。Manager 让我 work from Bali 一个月。',
      '辞职信交了。Manager 哭了，我也哭了，但是不同原因。',
    ],
    '32-35': [
      '从巴厘岛回来。第一次发现"早睡早起"原来这么爽。',
      '开始做远程顾问。一周 work 20 小时，工资是当年大厂的 60%。够。',
      '同事跟我说要 follow 我的"early retirement"路径。我说我没退休，只是 reset 了。',
      '今天 11 点上床。这是过去十年从没有的奢侈。',
      '体检报告：所有指标恢复正常。原来人是可以修的。',
    ],
  },
  // ─────────────────────────────────────────────────────────────
  //  Romantic 恋爱脑
  // ─────────────────────────────────────────────────────────────
  romantic: {
    '15-17': [
      '今天 TA 对我笑了...我可以开心一整天',
      '暗恋真的好辛苦啊，但又不敢说 😔',
      '看了一部恋爱电影，哭得稀里哗啦',
      '分手后第一次一个人逛街，有点不习惯',
      '今天给暗恋对象编了一条短信。删了七遍。最后没发。',
    ],
    '18-20': [
      '异地恋太难了...但每次视频都很开心',
      '和 TA 一起去了图书馆，虽然没怎么学习但很幸福',
      '在路上看到一对情侣...酸了',
      '单身久了，看什么都像情侣',
      '朋友说我恋爱脑...我觉得这是优点！',
      '给 TA 准备了一个小惊喜，期待反应 💝',
      '今天又被分手了。第三次了。每次都觉得这次是真的。',
    ],
    '21-22': [
      '毕业后要面对的不只是工作，还有感情的走向...',
      '在异国他乡遇到对的人，是留学最大的收获吧',
      '不管以后怎样，希望我们都能幸福',
      '同学一对一对地谈毕业去哪。我们俩还在讨论"我们还是我们吗"。',
    ],
    '23-25': [
      '毕业一年了，分了。原因是 "different life goals"。其实就是 ta 想要 stability，我想要 spark。',
      'Dating app 上又匹配了一个 ta。算了，这次先不浪费时间约会，直接看眼缘吧。',
      '今天去看了一部 rom-com 一个人。出来时觉得自己很惨，又觉得很自由。',
      '朋友圈三对结婚了。我连男朋友都没。',
      '又遇到一个似乎对的人。这次先慢慢来，不要急。',
    ],
    '26-28': [
      '终于订婚了 💍 谈了两年。这次真的就是 ta 了。',
      '婚礼策划比想象中累。我和 ta 已经因为座位安排吵了三次架。',
      '结婚啦 👰 今天宣誓时我哭了，妈妈也哭了，宾客也哭了。',
      '蜜月去了希腊。第一次旅行不用算钱，原来这就是 partnership 的好处。',
      '怀孕了 👶 第一次产检医生说"胎心很好"，我和 ta 在车里哭了 10 分钟。',
    ],
    '29-31': [
      '一胎出生了。婴儿真的会让两个人之间发生奇怪的化学反应。',
      '生完孩子后争吵频率上升了 5 倍。但和好的频率也是。',
      '30 岁那天 ta 给我办了 surprise party。来了 40 个人，全是我从高中到现在的朋友。哭。',
      '... 我们离婚了。原因不想说，反正没第三者。',
      '一个人带娃的第一年。最难的不是娃，是想 ex 的时候。',
    ],
    '32-35': [
      '又遇到一个人。这次先不官宣了。怕乌鸦嘴。',
      '过了这么多年，发现 ta 是我前任的同事。这世界真小，小得让人 awkward。',
      '二婚了 💕 这次小型仪式，只请了真正的好朋友。我妈说"这次最好是最后一次"。',
      '突然意识到爱情和年龄无关。33 岁也可以心动。',
      '前任结婚了。我朋友圈点了赞。其实没什么感觉了。',
    ],
  },
};

// ══════════════════════════════════════════════════════════════
//  NPC COMMENT TEMPLATES
// ══════════════════════════════════════════════════════════════

const COMMENT_TEMPLATES = {
  // Comment on school admission
  school: {
    scholar:      ['恭喜恭喜！好学校👏', '实至名归！', '太强了！我也要加油'],
    rich:         ['厉害呀！开学请你吃饭🍽️', '恭喜恭喜🎉 以后一起玩呀'],
    social:       ['啊啊啊恭喜！！！开学一定要联系我！', '太棒了！我帮你拉新生群'],
    lazy:         ['牛...你怎么做到的', '羡慕了', '大佬带带我'],
    grinder:      ['你也很厉害！一起加油💪', '恭喜！我也录了，以后做校友'],
    romantic:     ['好棒！新学校说不定有帅哥美女哦😏', '恭喜恭喜～'],
    mom:          ['妈妈为你骄傲！记得多穿衣服🧥', '太好了宝贝！到了要好好吃饭'],
  },
  // Comment on relationship start (dating/married)
  love: {
    scholar:      ['恋爱也要兼顾学业哦', '恭喜！but论文写了吗😂'],
    rich:         ['请客请客！🥂', '在一起快乐就好'],
    social:       ['啊啊啊！什么时候的事！给我讲讲！！', '终于脱单了！恭喜😆'],
    lazy:         ['又被秀到了...', '这个世界对单身狗太不友好了'],
    grinder:      ['恋爱会影响学习效率的...开玩笑的恭喜', '恭喜！要注意balance'],
    romantic:     ['太甜了！！我也好想谈恋爱😭', '替你开心！要一直幸福下去❤️'],
    mom:          ['交男/女朋友了？什么时候带回来给妈看看', '要注意安全，学业为重'],
  },
  // Comment on breakup / heartbreak
  breakup: {
    scholar:      ['别想太多，把精力放在学习上吧', '时间会治愈一切'],
    rich:         ['走，我请你吃大餐散散心', '别难过了，更好的在后面'],
    social:       ['需要聊聊吗？随时找我倾诉！', '抱抱你😢 下次一定遇到对的人'],
    lazy:         ['分手了也好，省钱了...', '加入我们单身快乐大军吧'],
    grinder:      ['正好可以专心提升自己了', '没关系，一切都是最好的安排'],
    romantic:     ['心疼你😢 我懂那种感觉...', '一个人也要好好的啊'],
    mom:          ['宝贝别难过，妈妈在呢', '不合适就不要勉强，以后会遇到更好的'],
  },
  // Comment on flexing / achievements
  flex: {
    scholar:      ['优秀！', '厉害了', '向你学习'],
    rich:         ['太酷了吧！哪里的？我也想去', '赞赞赞！'],
    social:       ['好棒！！下次带我一起呀！', '也太厉害了吧！'],
    lazy:         ['你们的人生和我的怎么差这么多...', '酸了酸了'],
    grinder:      ['不错！但你有考虑过XXX吗？', '厉害，我还在努力中'],
    romantic:     ['好棒～', '真好呀！'],
    mom:          ['妈妈的宝贝真棒！', '好好好！继续加油'],
  },
  // Comment on struggles / sad posts
  struggle: {
    scholar:      ['别灰心，你已经很棒了', '加油！调整一下就好'],
    rich:         ['别想太多了，周末出来玩散散心？我请客', '没事没事，一切都会好的'],
    social:       ['需要聊聊吗？随时找我！', '抱抱！我陪你😊'],
    lazy:         ['我也一样...咱们一起躺', '哈哈哈欢迎加入我的阵营'],
    grinder:      ['你需要一个更好的时间管理计划', '别放弃！坚持就是胜利'],
    romantic:     ['心疼你😢 需要安慰的话随时来找我', '一切都会好起来的'],
    mom:          ['宝贝别难过，妈妈永远支持你', '没关系的，健康开心最重要'],
  },
  // ── REPLY templates — NPC replies to player's comment, by sentiment ──
  reply_positive: {
    scholar:      ['谢谢！互相学习 🤝', '哈哈过奖了，一起进步', '感谢支持！能被你这种人夸我很开心', '受之有愧 🥺', '诶嘿，被你这么一夸我都不好意思了'],
    rich:         ['谢啦 😄 改天约', '哈哈承蒙夸奖', '欸嘿，谢谢谢谢', '你也很会说话嘛 😎', '请你喝下午茶？'],
    social:       ['哈哈谢谢你呀！下次一起玩！', '蟹蟹蟹蟹 💕', '你也很棒呀！', '抱抱抱 ❤️ 你最贴心了', '今晚有空吗一起吃饭！'],
    lazy:         ['谢了谢了', '嘿嘿', '诶...谢谢', '没想到还有人看我朋友圈', '这是今天唯一被夸的事情，存着了'],
    grinder:      ['谢谢！我们一起加油', '感谢认可！', '互勉互勉', '一起冲！下个目标见！', '其实没那么厉害，再加把劲'],
    romantic:     ['谢谢你 ❤️ 你也要幸福呀', '哈哈谢谢 💕', '感动！', '你这么暖，怎么还没对象呀？', '抱抱，谢谢你的话'],
  },
  reply_negative: {
    scholar:      ['哈哈别这样说', '你也别只看到表面嘛', '其实没那么夸张啦', '行吧，那你说说怎么算 valid', '你这话我可以放进论文里当 anti-thesis 吗 😏'],
    rich:         ['哈哈哈酸啥呀', '哎不要这样嘛', '夸张了夸张了', '酸吗？多吃点甜的', '哈哈哈你这话我截屏发我妈了'],
    social:       ['哈哈哈哈哈别这样啦！', '欸你也来一起呀！', '哎呀你太搞笑了', '欸欸说真的你想加入吗？', '哈哈这评论我笑了三秒'],
    lazy:         ['是吧是吧 😂', '我也想知道', '人生就是这样', '哈哈我们都一样', '诶嘿，难兄难弟'],
    grinder:      ['你也可以的，别气馁', '一起努力嘛', '我也很累的好吗 😅', '说得好像我没付出过一样', '行行行，下次我也来评论你'],
    romantic:     ['哈哈别这样说嘛', '你也会遇到的 💕', '不要羡慕啦', '酸什么呀，你也会有的', '哈哈你这话听着像是吃醋了哦 😏'],
  },
  reply_neutral: {
    scholar:      ['嗯嗯', '哈哈', '是的', '收到', '嗯，确实'],
    rich:         ['哈哈', '👍', '嗯呐', 'ok ok', '收到'],
    social:       ['哈哈是呀！', '对吧对吧', '😆', '你也这么觉得？', '哈哈我懂'],
    lazy:         ['嗯', '🙃', '是吧', '哦', '...'],
    grinder:      ['嗯', '是的', '👌', '收到，下条', '好'],
    romantic:     ['嗯嗯～', '是呀', '😊', '懂的懂的', '是这样'],
  },
  // Other NPCs chiming in on the conversation
  chime: {
    scholar:      ['插一句，确实如此', '+1', '认同'],
    rich:         ['哈哈我也来凑个热闹', '+1', '哈哈哈'],
    social:       ['让我也参与一下！', '我也想说！', '哈哈这个我有发言权'],
    lazy:         ['路过', '吃瓜🍉', '默默围观'],
    grinder:      ['同意', '+1', '说得对'],
    romantic:     ['路过点赞💕', '看到啦', '嘿嘿'],
  },
  // ── SNARK ── NPC 怼回去用，玩家发挑衅/装/秀的评论时触发
  snark: {
    scholar:      ['谁问你了 🙃', '你的看法 invalid。', '行行行你说的都对。', '0 个人在意 + 1。', '这观点我研究过，N=1 时确实是这样。'],
    rich:         ['谁问你了 😂', 'is 谁 in 问？', '0 个人 care。', '你这话听着像是没坐过头等舱说的。', '哈哈哈你认真的吗？'],
    social:       ['哈哈谁问你呀～', '你是不是一个人在 echo chamber 里聊嗨了？', '蟹蟹你的高见 🙃', '0 个人 cares but ok。', '你这个发言已经成功让我对你重新评估了。'],
    lazy:         ['谁问？', '哦。', '...好的。', '没人想知道', '你这条我看不见，下一条。'],
    grinder:      ['谁问你了 + 1', '你的 input 不需要。', '建议先 do something 再来发表意见。', '你说的对（保命用）', '我先去 grind 了，你慢慢说。'],
    romantic:     ['你是不是觉得你很重要 🥺', '谁问你了呀～', '你这话听着像没谈过恋爱的人说的', '🤡 是人是吗', '已读不回 hh'],
  },
  // General / casual post
  general: {
    scholar:      ['有道理', '哈哈', '不错不错'],
    rich:         ['赞👍', '哈哈有意思', '看起来很棒'],
    social:       ['哈哈哈太真实了！', '快来群里说！', '笑死😂'],
    lazy:         ['我也是...', '😂', '真实'],
    grinder:      ['嗯', '加油', '💪'],
    romantic:     ['好可爱', '哈哈～', '❤️'],
    mom:          ['妈妈看到了', '嗯嗯好的', '注意身体'],
  },
};

// ══════════════════════════════════════════════════════════════
//  PLAYER POST PROMPT TEMPLATES
// ══════════════════════════════════════════════════════════════

const PLAYER_POST_TEMPLATES = {
  school: (school) => `刚刚录取了 ${school}！要不要发个朋友圈庆祝一下？`,
  relationship_start: () => '恋爱了！要不要在朋友圈官宣一下？',
  relationship_breakup: () => '分手了...要不要在朋友圈说点什么？',
  storyline: (name) => `进入了${name}剧情线！要不要分享一下这个特殊时刻？`,
  graduation: () => '毕业了！要不要发个朋友圈纪念一下？',
  achievement: (text) => `${text}！要不要发个朋友圈炫耀一下？`,
};

// Post text the player actually publishes
const PLAYER_POST_CONTENT = {
  school: (school) => [
    `${school}，我来了！新的旅程开始🎉`,
    `offer get！${school}！！感恩🙏`,
    `努力没有白费！${school}录取通知书到手📮`,
  ],
  relationship_start: () => [
    '官宣❤️ 从今天开始，多了一个人一起走',
    '终于脱单了！感谢命运的安排💕',
  ],
  relationship_breakup: () => [
    '有些路，注定要一个人走。',
    '结束了。感谢你教会我的一切。',
  ],
  storyline: (name) => [
    `人生的新篇章：${name}。全力以赴！🔥`,
    `没想到人生会走上这条路...${name}，我准备好了`,
  ],
  graduation: () => [
    '毕业了🎓 感谢这段旅程中遇到的每一个人',
    '学生时代结束了。下一站，新的开始！🌟',
  ],
};

// ══════════════════════════════════════════════════════════════
//  SCHOOL ASSIGNMENT LOGIC FOR NPCs
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
//  DRAMA SCRIPTS — NPC vs NPC scandals (Feature 5)
// ══════════════════════════════════════════════════════════════

/**
 * Each script has:
 *   id: unique
 *   requires: [npcTypeA, npcTypeB]  — both must be present in this playthrough
 *   minAge: trigger only after this age
 *   steps: array of { delay, role, text, comments?, playerChoice? }
 *     delay: months from script start (or previous step) before this step fires
 *     role: 'A' | 'B' — which NPC posts it
 *     text: post body
 *     comments: optional pre-baked comments from the other NPC or third parties
 *     playerChoice: optional — final step has player buttons [吃瓜/劝架/火上浇油]
 *
 * Final step's playerChoice outcomes record a flag on the NPC objects:
 *   choseA: player took side A → B gives cold comments to player
 *   choseB: player took side B → A gives cold comments to player
 *   peace:  player mediated → both warmer to player
 *   fuel:   player火上浇油 → both colder, but HAP +3 (内心爽)
 *   gossip: player吃瓜 → no change
 */
const DRAMA_SCRIPTS = [
  {
    id: 'rich_vs_grinder',
    requires: ['rich', 'grinder'],
    minAge: 19,
    steps: [
      {
        delay: 0,
        role: 'A', // rich
        text: '今晚的米其林确实不错。人这一辈子，享受比什么都重要 🥂',
        comments: [
          { role: 'B', text: '享受得起的人才有资格说享受 🙃' },
        ],
      },
      {
        delay: 2,
        role: 'B', // grinder
        text: '又一篇 paper 投出去了。有些人 30 岁靠爸妈，有些人 30 岁靠自己。',
        comments: [
          { role: 'A', text: '靠自己累不累啊 😂' },
        ],
      },
      {
        delay: 2,
        role: 'A',
        text: '@${B} 你不就是嫉妒吗？说话别这么阴阳怪气，没人逼你看我朋友圈。',
        comments: [
          { role: 'B', text: '是是是，我嫉妒，你赢了。把我屏蔽吧。' },
        ],
      },
      {
        delay: 1,
        role: 'A',
        text: '拉黑了某些 EQ 低的人，眼不见为净 😊 朋友圈也清净点。',
        playerChoice: {
          context: '你看着这场撕逼...',
          options: [
            { key: 'gossip', label: '🍵 吃瓜', desc: '默默看戏' },
            { key: 'peace', label: '🕊️ 劝架', desc: '两边都劝一下' },
            { key: 'fuel', label: '🔥 火上浇油', desc: '在下面评论"打起来！"' },
          ],
        },
      },
    ],
  },
  {
    id: 'lazy_vs_grinder',
    requires: ['lazy', 'grinder'],
    minAge: 18,
    steps: [
      {
        delay: 0,
        role: 'B', // grinder
        text: '宿舍那位每天打游戏到凌晨 3 点，我已经一个月没睡过好觉了 😩',
        comments: [],
      },
      {
        delay: 1,
        role: 'A', // lazy
        text: '某位室友 7 点起床念英语，你他妈知不知道我几点睡的？',
        comments: [
          { role: 'B', text: '我念英语跟你睡多晚有什么关系？' },
          { role: 'A', text: '你戴个耳机不行吗' },
        ],
      },
      {
        delay: 2,
        role: 'A',
        text: '搬出去了。终于自由了。👋',
        playerChoice: {
          context: '你看着这场室友互删...',
          options: [
            { key: 'gossip', label: '🍵 吃瓜', desc: '记下这个瓜' },
            { key: 'peace', label: '🕊️ 劝架', desc: '私聊两个人都安慰一下' },
            { key: 'fuel', label: '🔥 火上浇油', desc: '在下面评论"赞！终于眼不见心不烦"' },
          ],
        },
      },
    ],
  },
  {
    id: 'romantic_drama',
    requires: ['romantic', 'social'],
    minAge: 19,
    steps: [
      {
        delay: 0,
        role: 'A', // romantic
        text: '原来你说的"只是朋友"，是这种程度的朋友吗。',
        comments: [],
      },
      {
        delay: 1,
        role: 'B', // social
        text: '@${A} 你删我之前能不能先听我解释一下？',
        comments: [
          { role: 'A', text: '不用了。所有人都看见照片了。' },
        ],
      },
      {
        delay: 1,
        role: 'A',
        text: '不是所有人的"我就是这样的人"都能被原谅的。',
        playerChoice: {
          context: '你看着这场感情纠纷...',
          options: [
            { key: 'gossip', label: '🍵 吃瓜', desc: '哇这瓜真大' },
            { key: 'peace', label: '🕊️ 劝架', desc: '两边都劝劝，给个台阶下' },
            { key: 'fuel', label: '🔥 火上浇油', desc: '评论"分得好！这种人留着干嘛"' },
          ],
        },
      },
    ],
  },
];

// ══════════════════════════════════════════════════════════════
//  ACTIONABLE POSTS — NPC posts with action buttons (Feature 3)
// ══════════════════════════════════════════════════════════════

/**
 * Each entry: NPC type → array of actionable post definitions
 * Each post has:
 *   text: post body (NPC voice)
 *   actionLabel: button label (e.g. "去蹭一下")
 *   minAge / maxAge: when ta might post this
 *   requireExpr: function(state) -> bool (entry condition)
 *   event: inline event object { text, effect, set?, choices?, branches? }
 *          text can include ${npcName}
 */
const ACTIONABLE_POSTS = {
  social: [
    {
      text: '周末在我家办个 housewarming，几个老朋友聚聚 🍻 都来！',
      actionLabel: '去蹭一下',
      minAge: 17, maxAge: 24,
      requireExpr: (s) => s.SOC >= 3,
      event: {
        text: '你去了 ${npcName} 家的 party。人不多，但都挺有意思。回来路上脚有点疼。',
        effect: { SOC: 2, HAP: 2, HLT: -1 },
        // 单身 + 25% 概率触发桃花
        chanceEffect: {
          chance: 0.25,
          condition: (s) => s.relationship === '单身',
          text: '你在 party 上跟一个挺聊得来的人加了微信。回家路上你忍不住又翻了一遍 ta 的朋友圈。',
          effect: { HAP: 1, APP: 1 },
        },
      },
    },
    {
      text: '帮我拉新生群呗，给你介绍几个学长学姐 🤝',
      actionLabel: '帮 ta 一把',
      minAge: 18, maxAge: 22,
      requireExpr: (s) => s.profession === '本科生' || s.profession === '研究生',
      event: {
        text: '你帮 ${npcName} 拉了几个群，意外认识了几个学长。其中一个可能能帮你内推暑期。',
        effect: { SOC: 2, INT: 1 },
      },
    },
  ],
  grinder: [
    {
      text: '期末项目快疯了，谁会带带我 🙏 仅限 CS / 商科 / 理科同学',
      actionLabel: '一起肝',
      minAge: 18, maxAge: 22,
      requireExpr: (s) => ['CS', '商科', '理科'].includes(s.major),
      event: {
        text: '你和 ${npcName} 在图书馆肝了一周。代码能力涨了，但脖子也僵了。',
        effect: { INT: 2, HAP: -1, HLT: -1 },
        // CS 同学加成
        chanceEffect: {
          chance: 1.0,
          condition: (s) => s.major === 'CS',
          text: '你帮 ${npcName} 重构了整个项目架构。教授给了你们小组 A+。',
          effect: { INT: 1 },
        },
      },
    },
    {
      text: '一起申请暑研？我已经联系了几个教授，多一个 backup 也好',
      actionLabel: '一起申',
      minAge: 18, maxAge: 22,
      requireExpr: (s) => (s.profession === '本科生' && s.INT >= 5),
      event: {
        text: '你和 ${npcName} 联合申请了几个暑研。有两个 lab 给了回复，最后选了一个 PI 比较温柔的。',
        effect: { INT: 2, PER: 1, HAP: -1 },
      },
    },
  ],
  rich: [
    {
      text: '泰勒丝演唱会内场多一张，谁要 ✋ 别问我多少钱',
      actionLabel: '蹭一下',
      minAge: 16, maxAge: 24,
      requireExpr: (s) => s.MNY >= 2, // 起码能付得起交通费
      event: {
        text: '${npcName} 带你去了演唱会。视野绝佳，回家路上还顺道吃了顿好的。',
        effect: { HAP: 2, MNY: -1 },
      },
    },
    {
      text: '家里有间公寓空着，想搬来一起住吗？分摊一下水电就行',
      actionLabel: '搬过去',
      minAge: 18, maxAge: 22,
      requireExpr: (s) => s.profession === '本科生' && s.MNY >= 1,
      event: {
        text: '你搬到了 ${npcName} 家的公寓。条件比宿舍好太多了。但每次进门都有点心理压力。',
        effect: { HAP: 2, HLT: 1, MNY: -1 },
      },
    },
  ],
  romantic: [
    {
      text: '我朋友说有个特别合适的人想介绍给你...有兴趣吗 👀',
      actionLabel: '见一面',
      minAge: 18, maxAge: 28,
      requireExpr: (s) => s.relationship === '单身',
      event: {
        text: '${npcName} 硬拉你去了相亲。对方比想象中正常多了。',
        effect: { HAP: 1 },
        choices: [
          { label: '约 ta 下次', effect: { HAP: 2, APP: 1 }, set: { relationship: '恋爱中' } },
          { label: '聊得不来', effect: { HAP: 0 } },
        ],
      },
    },
  ],
  lazy: [
    {
      text: '今天什么都不想干，谁来宿舍陪我打一天游戏 🎮',
      actionLabel: '加入摆烂',
      minAge: 17, maxAge: 24,
      requireExpr: (s) => s.profession !== '高中生',
      event: {
        text: '你跟 ${npcName} 在宿舍打了一整天游戏。开心，但作业堆成山了。',
        effect: { HAP: 2, INT: -1, PER: -1 },
      },
    },
  ],
  scholar: [
    {
      text: '组了个论文读书会，每周三晚 9 点。需要的同学进群',
      actionLabel: '加入',
      minAge: 18, maxAge: 24,
      requireExpr: (s) => s.profession === '本科生' || s.profession === '研究生',
      event: {
        text: '你加入了 ${npcName} 的读书会。每周读一篇 paper，开始觉得自己开始懂学术圈了。',
        effect: { INT: 2, SOC: 1, HAP: -1 },
      },
    },
  ],
};

// ══════════════════════════════════════════════════════════════
//  REACTION POSTS — NPC reacts to player events (80% flex / 20% support)
// ══════════════════════════════════════════════════════════════

/**
 * Each entry: NPC type → array of post objects { text, mood }
 * mood: 'flex' (NPC bragging) | 'support' (NPC congratulating) | 'peer' (neutral)
 * Reactions fire 1-3 months after the triggering player event.
 */
const REACTION_POSTS = {
  // Player got their admission result (any tier)
  school_done: {
    scholar: [
      { text: '尘埃落定，准备启程。这两年的付出，值了。', mood: 'flex' },
      { text: '看到群里有人晒 offer 了。我的也到了，先不发，免得太招摇 🙊', mood: 'flex' },
      { text: '感谢申请季陪我熬夜的所有人。下一站，新的城市。', mood: 'flex' },
      { text: '其实我觉得申请就是一场玄学。能录全靠老天爷赏饭吃 🙏', mood: 'support' },
    ],
    rich: [
      { text: '感谢 papa 和 mama，也感谢我那位 $500/小时 的文书老师 🥲', mood: 'flex' },
      { text: '终于不用每天被中介催材料了，朋友圈久违地静下来。', mood: 'flex' },
      { text: '决定去东岸了。看了一圈房，可能直接买一套省事点。', mood: 'flex' },
      { text: '同届录取的同学们都好厉害，跪了 🙇', mood: 'support' },
    ],
    grinder: [
      { text: '录取结果出了。这只是序章，从今天开始重新出发。', mood: 'flex' },
      { text: '我每天 4 点起床的那段日子，没人比我自己更清楚。一切都值了。', mood: 'flex' },
      { text: 'GPA、活动、文书、面试，逐个攻下来。下一站继续卷。', mood: 'flex' },
      { text: '群里有同学拿了我做梦都不敢想的 offer，太强了 👏', mood: 'support' },
    ],
    social: [
      { text: '录取季终于结束！周六晚上 8 点 XX 餐厅，offer 多的请客，offer 少的随意 🍻', mood: 'flex' },
      { text: '感谢这一年陪我互改文书的每一个人，下学期换个城市继续做朋友 ❤️', mood: 'peer' },
      { text: '已经在拉新生群了，谁有同届的同学 @ 进来！', mood: 'peer' },
      { text: '看到大佬们晒 offer，我先躲一下 🙈', mood: 'support' },
    ],
    lazy: [
      { text: '录了一个不算好也不算差的学校。能去就行吧，知足常乐 🙃', mood: 'peer' },
      { text: '别人都在晒 offer，我连录取邮件都还没仔细看。大概率是被录了吧。', mood: 'peer' },
      { text: '看着同学们拿名校 offer，我...我先去打把游戏冷静一下 😅', mood: 'support' },
      { text: '反正都是大学，去哪不是去。佛了。', mood: 'peer' },
    ],
    romantic: [
      { text: '和 ta 终于要去同一个城市了 💕 这是命中注定吧', mood: 'flex' },
      { text: '虽然不是一个学校，但起码同一个时区。每天 FaceTime 也算异地恋吧？', mood: 'peer' },
      { text: '录取季结束，下一站继续找寻属于我的那个 ta ✨', mood: 'peer' },
      { text: '看到别人晒 offer，我在看朋友的恋情进度 🍵 大家都好好的就行', mood: 'support' },
    ],
  },

  // 🥚 EASTER EGG #1: NPC 暗讽 — 玩家做了不光彩的事时 NPC 暗中嘲讽
  shade_failure: {
    rich:     [{ text: '听说有人挂科了，跪了 🙏 我幸运，没挂。', mood: 'flex' }],
    grinder:  [{ text: '又一波 final 结束。GPA 4.0 保持中。可能不是每个人都做得到，但努力总能做到吧？', mood: 'flex' }],
    scholar:  [{ text: '看到群里有人被 academic probation。说真的，平时多 office hours 真的会差很多。', mood: 'flex' }],
    social:   [{ text: '听说有人挂科了，群里默默吃瓜 🍵', mood: 'flex' }],
    lazy:     [{ text: '哈哈哈又有同学挂科了，欢迎加入"及格万岁"阵营。', mood: 'peer' }],
    romantic: [{ text: '挂科不可怕，可怕的是 ta 因为忙挂科没时间陪我。', mood: 'flex' }],
  },
  shade_cheating: {
    grinder:  [{ text: '今天看 ChatGPT 论文检测的新闻。感叹 GPA 4.0 的浓度可能要打折了 😏', mood: 'flex' }],
    scholar:  [{ text: '学术不端是底线问题。教授查得越来越严了，最近又有人栽了。', mood: 'flex' }],
    rich:     [{ text: '走捷径的人朋友圈晒得最响。被抓的时候也最惨。', mood: 'flex' }],
    social:   [{ text: '群里又在传谁谁谁 cheat 了。真的是吗 🍵', mood: 'flex' }],
  },
  shade_breakup_cycle: {
    romantic: [{ text: '有些人感情就像换衣服。但也是 ta 的人生选择，祝福吧。', mood: 'flex' }],
    social:   [{ text: '听说群里有人又分手了 🍵 这是第几任了？', mood: 'flex' }],
    lazy:     [{ text: '哈哈感情就是这样，我一直保持 0 输入 0 输出。', mood: 'peer' }],
    scholar:  [{ text: '感情过于频繁会影响 productivity。这是有研究的。', mood: 'flex' }],
  },
  shade_poor: {
    rich:     [{ text: '有些朋友最近不太常出现在聚餐了，希望 ta 一切都好 🙏', mood: 'flex' }],
    grinder:  [{ text: '今年的 bonus 到了。还是要努力工作呀，没钱的日子真的不好过。', mood: 'flex' }],
    social:   [{ text: '群里筹钱给某位朋友。如果你看到，悄悄转账给我。', mood: 'flex' }],
  },

  // Player just broke up
  breakup: {
    romantic: [
      { text: '今天和 ta 一起做了饭，虽然糊了但很开心。爱情真的是世界上最美好的东西吧 ❤️', mood: 'flex' },
      { text: '一周年纪念日 🌹 谢谢 ta 陪我走过这一年', mood: 'flex' },
      { text: '看到朋友圈有人在难过。感情这种事，强求不来 💔', mood: 'support' },
    ],
    social: [
      { text: '今晚带某位刚失恋的朋友出去喝了一杯。听 ta 哭到打嗝。哭完就好了。', mood: 'support' },
      { text: '昨晚和对象去看了流星雨，许了三个愿。生活真的不能太苦自己 🌠', mood: 'flex' },
    ],
    rich: [
      { text: '失恋最好的解药是机票 + 海岛 ✈️ 实在不行就两张机票，下次别带 ta 来了。', mood: 'support' },
      { text: '今晚带某位朋友吃了顿好的，记住，失去的从来都不是损失。', mood: 'support' },
    ],
    lazy: [
      { text: '感情这种东西真的麻烦，我是不打算搞了。一个人多自由。', mood: 'peer' },
      { text: '又有同学加入我们单身阵营了 🐕 欢迎欢迎，躺平群里见。', mood: 'peer' },
    ],
    scholar: [
      { text: '不在恋爱里浪费时间，是 ta 的 productivity 春天到了 📈', mood: 'support' },
      { text: '我导师说年轻人谈恋爱影响产出。看来他是对的（虽然我也没谈过）。', mood: 'peer' },
    ],
    grinder: [
      { text: '没时间难过。论文不会等任何人。', mood: 'support' },
    ],
  },

  // Player started a new relationship
  new_relationship: {
    romantic: [
      { text: '看到群里有人官宣了！恭喜恭喜 💕 期待下一波糖', mood: 'support' },
      { text: '又一对了，朋友圈最近的甜度严重超标，单身的我已被齁晕 🥲', mood: 'support' },
    ],
    social: [
      { text: '官宣一波！恭喜某人脱单！周末聚餐这次让 ta 请 😏', mood: 'support' },
    ],
    lazy: [
      { text: '又一个被爱情拐走的同学。单身阵营今晚为你默哀。', mood: 'peer' },
      { text: '别秀别秀，单身狗的心承受不住 🐕💔', mood: 'peer' },
    ],
    grinder: [
      { text: '恋爱可以，但 GPA 不能掉。学长姐我作为过来人的忠告。', mood: 'support' },
    ],
    rich: [
      { text: '恋爱了就请客嘛，新对象的甜品我赞助 🍰', mood: 'support' },
    ],
    scholar: [
      { text: '恭喜某人官宣！但提醒一下，下周还有 due 哦 📝', mood: 'support' },
    ],
  },

  // Player entered a non-hidden special storyline
  special_storyline: {
    social: [
      { text: '听说同学里有人开始走特别的路了，期待 👀', mood: 'support' },
      { text: '人各有志。能走出自己的路才是真厉害 💪', mood: 'support' },
    ],
    lazy: [
      { text: '看到同学搞副业搞起来了。我想了想还是继续躺着吧。', mood: 'peer' },
    ],
    grinder: [
      { text: '别人都在 grind 各自的赛道，我也不能掉队。', mood: 'flex' },
    ],
    rich: [
      { text: '搞事业是好事。需要 funding 找我聊 💸', mood: 'support' },
    ],
    romantic: [
      { text: '不管走哪条路，记得给自己留点谈恋爱的时间啊 💕', mood: 'support' },
    ],
    scholar: [
      { text: '看到同学走非传统路线，我还是更适合学术圈一点。', mood: 'peer' },
    ],
  },
};

// ══════════════════════════════════════════════════════════════
//  NPC ENDINGS — Class Reunion (生成同学十年后的去向)
// ══════════════════════════════════════════════════════════════

const NPC_ENDINGS = {
  scholar: [
    '在 MIT 读完 PhD 后留校做了助理教授。朋友圈再也没更新过。',
    '回国进了某 985 当青椒。每年发一条朋友圈：又一届毕业生送走了。',
    '在 Google DeepMind 做研究员。论文被引一万次，但永远在加班。',
    '博士读到第七年还没毕业。给你发消息："要不你借我点钱过年..."',
    '一篇 Nature 让 ta 一夜成名，后来被发现数据有问题，悄无声息地消失了。',
  ],
  rich: [
    '接班了家族企业。三年后公司在港交所敲钟，朋友圈晒了一张和爸爸的合照。',
    '在迪拜买了游艇但不会开。每条朋友圈定位都不同，配文永远是"忙里偷闲"，但其实退休了三年了。',
    '创业三次全部失败，最后回家吃软饭。倒也是过得挺潇洒。',
    '移民去了新西兰开了家民宿，配文："终于不用看父母脸色了"。',
    '家族企业被查了。ta 朋友圈停在三年前的迈阿密。',
  ],
  social: [
    '成了百万粉的网红博主。每天直播带货到凌晨。',
    '进了某大厂做 marketing 总监。微信好友 5000+ 全是工作。',
    '开了家公关公司，年入千万。同学聚会从不缺席，每次都是 ta 买单。',
    '搞了个留学生互助 App，融资到了 B 轮，最近上了 36kr。',
    '消失了三年，再出现时已经在监狱了——原因没人敢问。',
  ],
  lazy: [
    '考公考了五年，终于上岸了一个十八线小县城的事业编。每天打卡下班。',
    '回家继承了父母的奶茶店。生意一般，但人很快乐。',
    '不知道怎么搞的，玩游戏玩成了主播，现在月入十万。',
    '当了几年家庭主夫/主妇，最近开始研究做菜，朋友圈全是黑暗料理。',
    '失联了。最后一条朋友圈是三年前的："好累，想睡很久。"',
  ],
  grinder: [
    '32 岁做到某大厂 P8。今年体检查出三高，朋友圈第一次发了张病假条。',
    '连续创业三次终于成了。公司刚 IPO，ta 的胃也切掉了三分之一。',
    '35 岁被裁。转去东南亚做远程，现在在巴厘岛冲浪，朋友圈终于不卷了。',
    '考上了清北博士。同时手握三份大厂 offer。然后猝死在了答辩前一周。',
    '已经是某 AI 独角兽 CTO 了。每天工作 16 小时，从不发朋友圈。',
  ],
  romantic: [
    '结过两次婚，又离了。最近朋友圈发"这次真的不会再相信爱情了"。',
    '终于和大学时的初恋复合，去年结婚生了一对双胞胎。',
    '在三十岁那年去了西藏，再回来时已经是个游记博主。从此独身。',
    '嫁/娶了富二代同学的爸爸/妈妈。这个瓜震动了整个同学圈。',
    '一直没结婚，独自养了三只猫。微博签名是："我已经不需要任何人了。"',
  ],
};

const NPC_SCHOOLS = {
  scholar: {
    美国: ['MIT', 'Stanford', '哈佛', '耶鲁', '哥大', '宾大', '杜克'],
    英国: ['牛津', '剑桥', 'LSE', 'IC'],
    澳洲: ['墨大', '悉尼大学', 'ANU'],
    欧洲: ['ETH Zurich', 'TU Munich'],
    香港: ['港大', '港科大', '港中文'],
    日本: ['东京大学', '京都大学'],
    新加坡: ['NUS', 'NTU'],
  },
  rich: {
    美国: ['NYU', 'USC', 'UCLA', '波士顿大学', '哥大'],
    英国: ['UCL', 'KCL', '爱丁堡'],
    澳洲: ['悉尼大学', '墨大'],
    欧洲: ['博科尼', 'IE商学院'],
    香港: ['港大', '港中文'],
    日本: ['庆应', '早稻田'],
    新加坡: ['NUS', 'SMU'],
  },
  social: {
    美国: ['USC', 'UCLA', '密歇根', '波士顿大学', 'NYU'],
    英国: ['KCL', '曼大', '爱丁堡'],
    澳洲: ['悉尼大学', 'UNSW'],
    欧洲: ['巴黎政治学院', '阿姆斯特丹大学'],
    香港: ['港大', '港中文'],
    日本: ['早稻田', '庆应'],
    新加坡: ['NUS', 'NTU'],
  },
  lazy: {
    美国: ['OSU', 'ASU', 'UIC', '匹兹堡大学', '雪城大学'],
    英国: ['利兹', '诺丁汉', '谢菲尔德'],
    澳洲: ['蒙纳士', 'UQ'],
    欧洲: ['都灵理工', '代尔夫特'],
    香港: ['城大', '理工'],
    日本: ['关西大学', '立命馆'],
    新加坡: ['SMU', 'SUTD'],
  },
  grinder: {
    美国: ['CMU', 'Berkeley', '康奈尔', 'Caltech', 'UMich'],
    英国: ['IC', 'UCL', '牛津'],
    澳洲: ['墨大', 'ANU'],
    欧洲: ['ETH Zurich', 'EPFL'],
    香港: ['港大', '港科大'],
    日本: ['东京大学', '东京工业大学'],
    新加坡: ['NUS', 'NTU'],
  },
  romantic: {
    美国: ['NYU', 'BU', 'USC', '华盛顿大学', 'UCI'],
    英国: ['KCL', '爱丁堡', '曼大'],
    澳洲: ['悉尼大学', 'UNSW'],
    欧洲: ['索邦', '米兰理工'],
    香港: ['港大', '浸会'],
    日本: ['早稻田', '上智'],
    新加坡: ['NUS', 'SMU'],
  },
};

// ══════════════════════════════════════════════════════════════
//  MOMENTS STATE & ENGINE
// ══════════════════════════════════════════════════════════════

let momentsState = null;

/**
 * Initialize the moments system at game start.
 * @param {Object} gameState — the main `state` from game.js
 */
export function initMoments(gameState) {
  // Pick 5 NPC types (out of 6)
  const typeKeys = Object.keys(NPC_TYPES);
  const shuffled = typeKeys.sort(() => Math.random() - 0.5);
  const chosen = shuffled.slice(0, 5);

  const npcs = chosen.map(type => {
    const def = NPC_TYPES[type];
    const sex = Math.random() < 0.5 ? 'male' : 'female';
    const names = def.names[sex];
    const cnName = names[Math.floor(Math.random() * names.length)];
    const enName = def.names.en[Math.floor(Math.random() * def.names.en.length)];
    // Determine NPC country/school based on player's country (same cohort)
    const country = gameState.countryIntent || gameState.country || '美国';
    const schoolPool = (NPC_SCHOOLS[type] && NPC_SCHOOLS[type][country]) || NPC_SCHOOLS[type]?.['美国'] || ['某大学'];
    const school = schoolPool[Math.floor(Math.random() * schoolPool.length)];

    return {
      id: `npc_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      cnName,                          // 仅中文名（用于 @-mention / event 文案 / 头像首字）
      enName,                          // 英文名
      typeLabel: def.label,            // 性格标签 (学霸/富二代...)
      isClose: false,                  // 是否好友 (A 备注前缀) — 下面随机标记 1-2 个
      // name = 显示名（备注全文）— 在 _rebuildDisplayName 中根据 isClose 生成
      name: `${cnName} ${enName} ${def.label}`,
      initial: cnName.charAt(0),       // 头像首字 (中文姓)
      sex,
      color: def.color,
      avatarBg: def.avatarBg,
      school,
      country,
      major: type === 'scholar' ? '学术研究' : type === 'grinder' ? 'CS/工程' : type === 'rich' ? '商科' : type === 'romantic' ? '文科' : '',
      _loveCycle: type === 'romantic' ? 'single' : undefined,
      _firedMilestones: new Set(),
      _lastPostMonth: 0, // cooldown tracker
      _lastActionableSemester: -1, // last semester index (year*3 + season) ta posted actionable
      _firedActionableKeys: new Set(), // dedup actionable post text per NPC
      commentChance: type === 'social' ? 0.8 : type === 'mom' ? 1.0 : 0.35,
    };
  });

  // Randomly mark 1-2 NPCs as "close friends" (A 备注前缀)
  const closeCount = 1 + Math.floor(Math.random() * 2); // 1 或 2 个
  const shuffledNpcs = npcs.slice().sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(closeCount, shuffledNpcs.length); i++) {
    shuffledNpcs[i].isClose = true;
    shuffledNpcs[i].name = `A ${shuffledNpcs[i].cnName} ${shuffledNpcs[i].enName} ${shuffledNpcs[i].typeLabel}`;
  }

  // 🥚 EASTER EGG #10: Hidden NPC — 5% 概率开局加一个 ??? NPC
  // ta 不主动发帖，只偶尔出现在评论里，结局时会有特殊待遇
  if (Math.random() < 0.05) {
    const hiddenNpc = {
      id: `npc_hidden_${Date.now()}`,
      type: 'hidden',
      cnName: '???',
      enName: '???',
      typeLabel: '???',
      isClose: false,
      isHidden: true,
      name: '???',
      initial: '?',
      sex: 0,
      color: '#9a8db5',
      avatarBg: '#1a1525',
      school: '???',
      country: '???',
      major: '',
      _firedMilestones: new Set(),
      _lastPostMonth: 0,
      _lastActionableSemester: 999, // 永不发 actionable
      _firedActionableKeys: new Set(),
      _hiddenCommentCount: 0,
      commentChance: 0.05,
    };
    npcs.push(hiddenNpc);
    _unlockEgg('hidden_npc');
  }

  momentsState = {
    npcs,
    posts: [],           // all posts, newest first
    unreadCount: 0,
    playerPostPending: null, // { type, text, options }
    _lastPlayerPostMonth: 0,
    blocked: false,       // true during hidden storylines
    _dirty: false,        // set when feed needs re-render
    _pendingReactions: [],// queue of { trigger, atMonth } scheduled NPC reactions
    _drama: null,         // active drama: { scriptId, stepIdx, npcA, npcB, nextStepAtMonth, resolution }
    _dramaTriggeredThisGame: false, // max 1 drama per game
  };

  _currentGameMonth = gameState.monthTotal || 0;

  // Render initial empty state
  _renderMoments();
  _updateBadge();
}

/**
 * Called every advanceMonth() tick from game.js
 */
export function tickMoments(gameState) {
  if (!momentsState) return;

  // Keep current month for comment-reply scheduling
  _currentGameMonth = gameState.monthTotal;

  // Hidden storylines block the feed
  const wasBlocked = momentsState.blocked;
  momentsState.blocked = HIDDEN_STORYLINE_SET.has(gameState.storyline);

  if (momentsState.blocked) {
    // Just entered hidden storyline → clear queued reactions so they don't
    // dump out all at once if/when the player exits the hidden line.
    if (!wasBlocked) {
      momentsState._pendingReactions = [];
    }
    return;
  }

  // Process scheduled NPC replies to player comments
  _processPendingReplies(gameState);

  // Process scheduled NPC reactions to player events
  _processPendingReactions(gameState);

  // Try to start a drama (Feature 5) — 5% chance per tick if conditions met
  _maybeTriggerDrama(gameState);
  // Advance active drama if exists
  _processDrama(gameState);

  // 彩蛋帖子（第四面墙 / 群聊截图 / 数字密码）
  _maybeAddEasterEggPost(gameState);
  // 时间彩蛋（凌晨 3 点 / 节日）
  _maybeAddTimeBasedEgg(gameState);
  // 跨周目 déjà vu
  _maybeAddDejavuEgg(gameState);
  // 隐藏剧情入口帖
  _maybeAddHiddenEntryPost(gameState);

  const age = gameState.age;
  const month = gameState.monthOfYear;

  const monthTotal = gameState.monthTotal || 0;

  // Each NPC: check milestones (ignore cooldown), then maybe random post (with cooldown)
  for (const npc of momentsState.npcs) {
    const milestones = MILESTONE_POSTS[npc.type] || [];
    let postedThisTick = false;

    for (const ms of milestones) {
      if (ms.age !== age) continue;
      const months = Array.isArray(ms.month) ? ms.month : [ms.month];
      if (!months.includes(month)) continue;
      const key = `${npc.type}_${ms.age}_${JSON.stringify(ms.month)}`;
      if (npc._firedMilestones.has(key)) continue;
      if (ms.cond && !ms.cond(npc, gameState)) continue;

      // Always mark fired so we don't keep retrying this same milestone next month
      npc._firedMilestones.add(key);

      // ── Milestone frequency gate: only 30% of scheduled milestones actually post ──
      // Romantic NPC's _setCycle posts must always fire to keep their love-cycle state consistent
      const mustFire = !!ms._setCycle;
      if (!mustFire && Math.random() > 0.30) continue;

      const text = typeof ms.text === 'function' ? ms.text(npc) : ms.text;

      if (ms._setCycle) npc._loveCycle = ms._setCycle;

      _addNpcPost(npc, text, _classifyPost(text, npc.type), gameState);
      npc._lastPostMonth = monthTotal;
      postedThisTick = true;
      break; // max 1 milestone post per NPC per tick
    }

    // Random post: cooldown 18+ months, 1% chance per month off cooldown (~1 random post / 3 years per NPC)
    if (!postedThisTick && monthTotal - npc._lastPostMonth >= 18 && Math.random() < 0.01) {
      const ageRange = age <= 17 ? '15-17'
                    : age <= 20 ? '18-20'
                    : age <= 22 ? '21-22'
                    : age <= 25 ? '23-25'
                    : age <= 28 ? '26-28'
                    : age <= 31 ? '29-31'
                    : '32-35';
      const pool = RANDOM_POSTS[npc.type]?.[ageRange];
      if (pool && pool.length > 0) {
        const text = pool[Math.floor(Math.random() * pool.length)];
        _addNpcPost(npc, text, _classifyPost(text, npc.type), gameState);
        npc._lastPostMonth = monthTotal;
        postedThisTick = true;
      }
    }

    // Actionable post: roll EXACTLY ONCE per 4-month semester, 7% chance (was 20%, -65%)
    if (!postedThisTick) {
      const semesterIdx = Math.floor(monthTotal / 4);
      if (semesterIdx > npc._lastActionableSemester) {
        // Mark this semester as rolled regardless of outcome — prevents per-month re-rolling
        npc._lastActionableSemester = semesterIdx;
        if (Math.random() < 0.07) {
          _maybeAddActionablePost(npc, gameState);
        }
      }
    }
  }

  // Only re-render if something actually changed this tick
  if (momentsState._dirty) {
    _renderMoments();
    momentsState._dirty = false;
  }
  _updateBadge();
}

/**
 * Called from applyEvent in game.js when a postable event fires
 * Returns the post prompt data or null
 */
export function checkPostable(ev, gameState) {
  if (!momentsState || momentsState.blocked) return null;
  if (!ev.set) return null;

  // Cooldown: at least 3 months between player posts
  if (gameState.monthTotal - momentsState._lastPlayerPostMonth < 3) return null;

  let promptType = null;
  let promptArg = '';

  if (ev.set.school && ev.set.school !== '无' && ev.set.school !== '退学' && ev.set.school !== '遣返') {
    promptType = 'school';
    promptArg = ev.set.school;
  } else if (ev.set.relationship === '恋爱中' || ev.set.relationship === '已婚') {
    promptType = 'relationship_start';
  } else if (ev.set.relationship === '单身' && gameState.relationship === '恋爱中') {
    promptType = 'relationship_breakup';
  } else if (ev.set.storyline && !HIDDEN_STORYLINE_SET.has(ev.set.storyline)) {
    const STORYLINE_NAMES_LOCAL = {
      idol: '偶像出道', esports: '电竞之路', poker: '牌王之路',
      fitness: '健身达人', chef: '厨神之路', athlete: '体育之星',
      ceo: 'CEO之路', band: '乐队之路', influencer: '网红之路',
      academic: '学术之路', triton: '牌王之路',
    };
    promptType = 'storyline';
    promptArg = STORYLINE_NAMES_LOCAL[ev.set.storyline] || ev.set.storyline;
  } else if (ev.end && ev.id !== 99999) {
    // Graduation-like endings
    promptType = 'graduation';
  }

  if (!promptType) return null;

  return {
    type: promptType,
    arg: promptArg,
    prompt: PLAYER_POST_TEMPLATES[promptType](promptArg),
  };
}

/**
 * Player chose to post
 */
export function playerPost(type, arg, gameState) {
  if (!momentsState) return;

  const contentPool = PLAYER_POST_CONTENT[type]?.(arg) || [`分享了一条动态`];
  const text = contentPool[Math.floor(Math.random() * contentPool.length)];

  const post = {
    id: `player_${Date.now()}`,
    isPlayer: true,
    name: '我',
    color: '#f5b642',
    avatarBg: '#2a2008',
    text,
    postType: type === 'school' || type === 'graduation' ? 'flex' : type === 'relationship_start' ? 'love' : type === 'relationship_breakup' ? 'struggle' : 'flex',
    age: gameState.age,
    month: gameState.monthOfYear,
    time: _formatTime(gameState),
    comments: [],
    likes: Math.floor(Math.random() * 15) + 5,
  };

  // Generate NPC comments on player post
  _generateComments(post, gameState);

  // Mom always comments on player posts
  const momComment = _pickRandom(COMMENT_TEMPLATES[post.postType]?.mom || COMMENT_TEMPLATES.general.mom);
  post.comments.push({
    name: MOM_NPC.name,
    color: MOM_NPC.color,
    text: momComment,
    isMom: true,
  });

  momentsState.posts.unshift(post);
  momentsState.unreadCount++;
  momentsState._lastPlayerPostMonth = gameState.monthTotal;
  _prunePosts();

  _renderMoments();
  _updateBadge();
}

// ── Internal helpers ─────────────────────────────────────────

function _addNpcPost(npc, text, postType, gameState) {
  const post = {
    id: `${npc.id}_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`,
    isPlayer: false,
    npcType: npc.type,
    name: npc.name,
    initial: npc.initial,
    isClose: npc.isClose,
    color: npc.color,
    avatarBg: npc.avatarBg,
    text,
    postType,
    age: gameState.age,
    month: gameState.monthOfYear,
    time: _formatTime(gameState),
    comments: [],
    likes: Math.floor(Math.random() * 20) + 1,
  };

  // Other NPCs might comment
  _generateComments(post, gameState);

  momentsState.posts.unshift(post);
  momentsState.unreadCount++;
  momentsState._dirty = true;
  _prunePosts();
}

// ─────────────────────────────────────────────────────────────
// Actionable posts (Feature 3)
// ─────────────────────────────────────────────────────────────

// Callback set by game.js, called when a player clicks an action button.
// Signature: (eventDef, npc) => void
let _onActionableEvent = null;
export function setMomentsActionHandler(fn) { _onActionableEvent = fn; }

function _maybeAddActionablePost(npc, gameState) {
  const pool = ACTIONABLE_POSTS[npc.type];
  if (!pool || pool.length === 0) return;

  // Filter by age & condition & not-yet-fired-for-this-npc
  const eligible = pool.filter(p => {
    if (gameState.age < p.minAge || gameState.age > p.maxAge) return false;
    if (p.requireExpr && !p.requireExpr(gameState)) return false;
    if (npc._firedActionableKeys.has(p.text)) return false;
    return true;
  });
  if (eligible.length === 0) return;

  const picked = eligible[Math.floor(Math.random() * eligible.length)];
  npc._firedActionableKeys.add(picked.text);
  npc._lastPostMonth = gameState.monthTotal || 0;

  // Action expires after 4 months if not clicked
  const expiresAt = (gameState.monthTotal || 0) + 4;

  const post = {
    id: `${npc.id}_act_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`,
    isPlayer: false,
    npcType: npc.type,
    name: npc.name,
    initial: npc.initial,
    isClose: npc.isClose,
    color: npc.color,
    avatarBg: npc.avatarBg,
    text: picked.text,
    postType: 'actionable',
    age: gameState.age,
    month: gameState.monthOfYear,
    time: _formatTime(gameState),
    comments: [],
    likes: Math.floor(Math.random() * 15) + 3,
    action: {
      label: picked.actionLabel,
      event: picked.event,
      npcName: npc.cnName, // event log uses bare cn name, not the full memo
      expiresAt,
    },
  };

  // Small set of pre-comments from other NPCs so it doesn't look lonely
  _generateComments(post, gameState);

  momentsState.posts.unshift(post);
  momentsState.unreadCount++;
  momentsState._dirty = true;
  _prunePosts();
}

// Player clicked the action button — apply the inline event
function _handleAction(postId) {
  if (!momentsState) return;
  const post = momentsState.posts.find(p => p.id === postId);
  if (!post || !post.action || post.action.consumed) return;

  post.action.consumed = true;
  momentsState._dirty = true;

  if (_onActionableEvent) {
    _onActionableEvent(post.action.event, { name: post.action.npcName, color: post.color });
  }
  _renderMoments();
}

// Cap memory: keep only the most recent N posts.
// EXCEPTION: drama posts waiting for player choice are protected so the
// drama doesn't deadlock if many other posts get queued in between.
const MAX_POSTS = 30;
function _prunePosts() {
  if (!momentsState) return;
  if (momentsState.posts.length <= MAX_POSTS) return;

  const protectedPosts = [];
  const trimmable = [];
  for (const p of momentsState.posts) {
    const needsChoice = p._dramaChoice && !p._dramaChoiceResolved;
    if (needsChoice || p._protectedFromPrune) protectedPosts.push(p);
    else trimmable.push(p);
  }
  // Keep all protected + top N of trimmable
  const keepTrimmable = trimmable.slice(0, Math.max(0, MAX_POSTS - protectedPosts.length));
  // Rebuild posts list preserving original order (newest first)
  const keep = new Set([...protectedPosts, ...keepTrimmable]);
  momentsState.posts = momentsState.posts.filter(p => keep.has(p));
}

// Cold replies for NPCs who player火上浇油 in a drama
const COLD_COMMENTS = ['哦。', '嗯。', '...', '🙃', '随你'];
// Warm replies for NPCs who player 劝架 in a drama
const WARM_COMMENTS = ['谢谢你支持我 ❤️', '还好有你', '上次的事谢谢你', '你是真朋友👍'];

// 🥚 Hidden NPC 评论 - 逐次升级的渐进可怕话语
const HIDDEN_NPC_LINES = [
  '👍', '...', '👀', '。', '🌑',
  '你看不到我吗', '我一直在看', '原来是你呀',
  '你不记得我了？', '上一次你也是这样的', '又一次了',
  '别担心，我不会告诉别人的', '这次结局会不一样吗',
];

function _generateComments(post, gameState) {
  if (!momentsState) return;
  const commentersPool = momentsState.npcs.filter(n => n.id !== post.id);

  for (const npc of commentersPool) {
    // 🥚 Hidden NPC special path
    if (npc.isHidden) {
      // 8% 概率出现在某条评论里
      if (Math.random() < 0.08) {
        const lineIdx = Math.min(npc._hiddenCommentCount || 0, HIDDEN_NPC_LINES.length - 1);
        const text = HIDDEN_NPC_LINES[lineIdx];
        npc._hiddenCommentCount = (npc._hiddenCommentCount || 0) + 1;
        post.comments.push({
          name: npc.name,
          color: npc.color,
          text,
        });
      }
      continue; // 不走普通逻辑
    }

    if (post.isPlayer || npc.type !== post.npcType) {
      const chance = npc.type === 'social' ? 0.6 : 0.25;
      if (Math.random() < chance) {
        let text;
        // Drama aftermath: NPC attitude affects how they comment on player's posts
        if (post.isPlayer && npc._dramaAttitude === 'cold') {
          text = _pickRandom(COLD_COMMENTS);
        } else if (post.isPlayer && npc._dramaAttitude === 'warm') {
          text = _pickRandom(WARM_COMMENTS);
        } else {
          const templates = COMMENT_TEMPLATES[post.postType]?.[npc.type] || COMMENT_TEMPLATES.general[npc.type] || ['👍'];
          text = _pickRandom(templates);
        }
        post.comments.push({
          name: npc.name,
          color: npc.color,
          text,
        });
      }
    }
  }
}

function _classifyPost(text, npcType) {
  // Simple heuristic classification — order matters (more specific first)
  if (/录取|offer|录了|考上|考入|考到/.test(text)) return 'school';
  if (/分手|失恋|一个人走|结束了/.test(text)) return 'breakup';
  if (/恋爱|在一起|情人|心动|脱单|官宣|纪念日/.test(text)) return 'love';
  if (/哭|难|辛苦|崩|痛苦|灰心|酸|不想|拒|暗恋/.test(text)) return 'struggle';
  if (/旅|吃|买|玩|限量|米其林|游艇|打卡|装修|GPA.*4|奖|冠/.test(text)) return 'flex';
  return 'general';
}

function _pickRandom(arr) {
  if (!arr || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

function _formatTime(gameState) {
  return `${gameState.age}岁${gameState.monthOfYear}月`;
}

// ══════════════════════════════════════════════════════════════
//  RENDERING
// ══════════════════════════════════════════════════════════════

let _momentsPanel = null;
let _momentsMobilePanel = null;
let _momentsVisible = false;

export function getMomentsPanel() { return _momentsPanel; }

function _renderMoments() {
  if (!_momentsPanel) return;
  const container = _momentsPanel.querySelector('.moments-feed');
  if (!container) return;

  if (!momentsState || momentsState.posts.length === 0) {
    container.innerHTML = `
      <div class="moments-empty">
        <div class="moments-empty-icon">📱</div>
        <div class="moments-empty-text">还没有动态</div>
        <div class="moments-empty-sub">随着游戏进行，你和同学们的朋友圈会逐渐丰富起来</div>
      </div>`;
    return;
  }

  if (momentsState.blocked) {
    container.innerHTML = `
      <div class="moments-blocked">
        <div class="moments-blocked-icon">📡</div>
        <div class="moments-blocked-text">信号中断</div>
        <div class="moments-blocked-sub">你已进入特殊剧情线，朋友圈暂时无法访问...</div>
        <div class="moments-blocked-glitch"></div>
      </div>`;
    return;
  }

  // Render posts (show most recent 50)
  const postsToShow = momentsState.posts.slice(0, 50);
  container.innerHTML = postsToShow.map(post => _renderPost(post)).join('');

  // Bind click delegation for like & comment actions
  _bindPostActions(container);
}

function _bindPostActions(container) {
  // Use event delegation on the feed container
  container.onclick = (e) => {
    e.stopPropagation();

    // Action button (Feature 3)
    const actionBtn = e.target.closest('.moments-action-btn');
    if (actionBtn && !actionBtn.disabled) {
      const postId = actionBtn.dataset.postId;
      _handleAction(postId);
      return;
    }

    // Drama choice button (Feature 5)
    const dramaBtn = e.target.closest('.moments-drama-btn');
    if (dramaBtn && !dramaBtn.disabled) {
      const postId = dramaBtn.dataset.postId;
      const key = dramaBtn.dataset.dramaKey;
      _handleDramaChoice(postId, key);
      return;
    }

    // Like button
    const likeBtn = e.target.closest('.moments-like-btn');
    if (likeBtn) {
      const postId = likeBtn.dataset.postId;
      _handleLike(postId);
      return;
    }

    // Comment submit
    const commentBtn = e.target.closest('.moments-comment-submit');
    if (commentBtn) {
      const postId = commentBtn.dataset.postId;
      const input = container.querySelector(`.moments-comment-input[data-post-id="${postId}"]`);
      if (input && input.value.trim()) {
        _handleComment(postId, input.value.trim());
        input.value = '';
      }
      return;
    }
  };

  // Enter key to submit comment
  container.onkeydown = (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('moments-comment-input')) {
      e.preventDefault();
      const postId = e.target.dataset.postId;
      if (e.target.value.trim()) {
        _handleComment(postId, e.target.value.trim());
        e.target.value = '';
      }
    }
  };
}

function _handleLike(postId) {
  if (!momentsState) return;
  const post = momentsState.posts.find(p => p.id === postId);
  if (!post) return;
  if (post._playerLiked) return; // already liked
  post._playerLiked = true;
  post.likes += 1;
  _renderMoments();
}

function _handleComment(postId, text) {
  if (!momentsState) return;
  const post = momentsState.posts.find(p => p.id === postId);
  if (!post) return;
  post.comments.push({
    name: '我',
    color: '#f5b642',
    text,
    isPlayer: true,
  });

  // 🥚 #5 EASTER EGG — 玩家在隐藏入口帖下评论了正确暗号
  const hiddenEntry = _checkHiddenEntryReply(post, text);
  if (hiddenEntry) {
    // 帖子里加一条神秘回复
    post.comments.push({
      name: post.name,
      color: post.color,
      text: '...你也知道？那么，我们见个面吧。',
      isReply: true,
    });
    // 标记已使用，避免重复触发
    post._hiddenEntry = null;
    post._protectedFromPrune = false;
    _renderMoments();
    return; // 跳过常规 reply 调度
  }

  // Schedule NPC reply 1-2 game months later
  if (!post.isPlayer && _currentGameMonth != null) {
    post._pendingReply = {
      atMonth: _currentGameMonth + 1 + Math.floor(Math.random() * 2),
      sentiment: _classifySentiment(text),
      playerComment: text,
    };
  }
  _renderMoments();
}

// Track current game month for reply scheduling
let _currentGameMonth = null;

// Classify player comment sentiment
// 'snark' = 玩家在挑衅/装/秀/不友好 → NPC 用怼回去的话回应
// 'positive' / 'negative' / 'neutral' = 普通互动
function _classifySentiment(text) {
  // SNARK 优先：玩家说一些挑衅/秀/嘲讽/装的话 → NPC 直接怼回
  if (/^(我|看我|哈哈我|让我)|我比你|我才是|不行|垃圾|菜|蠢|傻|笨|👎|🤡|🙄|你算什么|关我屁事|无聊|没意思|装|凡尔赛/.test(text)) return 'snark';
  // 玩家发表自夸/单方面输出立场
  if (/(我厉害|我牛|我棒|我成功|我赢了|我胜了|你输了)/.test(text)) return 'snark';
  // 普通正面
  if (/恭喜|赞|棒|厉害|牛|强|优秀|加油|支持|好棒|👏|💪|❤|🎉|👍|爱了|喜欢|羡慕|佩服/.test(text)) return 'positive';
  // 玩家自嘲/酸/吐槽（不针对 NPC）
  if (/酸了|哭了|笑死|哈哈哈|🤣|😂|我也|可恶|呜呜|哎/.test(text)) return 'negative';
  return 'neutral';
}

// Process pending replies — called from tickMoments each game tick
function _processPendingReplies(gameState) {
  if (!momentsState) return;
  _currentGameMonth = gameState.monthTotal;
  const monthTotal = gameState.monthTotal;

  for (const post of momentsState.posts) {
    if (!post._pendingReply) continue;
    if (post._pendingReply.atMonth > monthTotal) continue;

    // Generate reply from the original poster (NPC)
    const npc = momentsState.npcs.find(n => n.type === post.npcType);
    if (!npc) { post._pendingReply = null; continue; }

    const sentiment = post._pendingReply.sentiment;
    // 'snark' 直接用 snark 模板（怼回去）；其他用 reply_* 模板
    let templates;
    if (sentiment === 'snark') {
      templates = COMMENT_TEMPLATES.snark?.[npc.type] || ['谁问你了 🙃'];
    } else {
      const replyKey = `reply_${sentiment}`;
      templates = COMMENT_TEMPLATES[replyKey]?.[npc.type] || ['谢谢'];
    }
    // snark 不加 @我 前缀，让怼的人显得"懒得回应你"
    const replyText = sentiment === 'snark' ? _pickRandom(templates) : '@我 ' + _pickRandom(templates);

    post.comments.push({
      name: npc.name,
      color: npc.color,
      text: replyText,
      isReply: true,
    });

    // 20% chance another NPC chimes in
    if (Math.random() < 0.2) {
      const otherNpcs = momentsState.npcs.filter(n => n.type !== post.npcType);
      if (otherNpcs.length > 0) {
        const otherNpc = otherNpcs[Math.floor(Math.random() * otherNpcs.length)];
        const chimeTemplates = COMMENT_TEMPLATES.chime[otherNpc.type] || ['+1'];
        post.comments.push({
          name: otherNpc.name,
          color: otherNpc.color,
          text: _pickRandom(chimeTemplates),
        });
      }
    }

    post._pendingReply = null;
    momentsState.unreadCount++;
    momentsState._dirty = true;
  }
}

// ──────────────────────────────────────────────────────────────
//  NPC reactions to player events (Feature 1)
// ──────────────────────────────────────────────────────────────

/**
 * Returns true if NPC has a milestone matching the reaction trigger
 * within ±2 months of current. Used to avoid "milestone + reaction" duplication.
 */
function _npcHasRecentMilestone(npc, gameState, trigger) {
  const milestones = MILESTONE_POSTS[npc.type] || [];
  // Map trigger → keywords in milestone text to consider "same topic"
  const triggerKeywords = {
    school_done:      /录取|offer|考上|考入|学校|大学/,
    breakup:          /分手|失恋/,
    new_relationship: /在一起|脱单|官宣|恋爱了/,
    special_storyline: null, // no milestone competes here
  };
  const kw = triggerKeywords[trigger];
  if (!kw) return false;

  const curAge = gameState.age;
  const curMonth = gameState.monthOfYear;
  const curAbs = curAge * 12 + curMonth;

  for (const ms of milestones) {
    if (Math.abs(ms.age - curAge) > 1) continue;
    const months = Array.isArray(ms.month) ? ms.month : [ms.month];
    // Check if any of the milestone's months are within ±2 months of current
    const closeEnough = months.some(m => Math.abs((ms.age * 12 + m) - curAbs) <= 2);
    if (!closeEnough) continue;
    // Test text against keywords (resolve fn)
    const text = typeof ms.text === 'function' ? ms.text(npc) : ms.text;
    if (kw.test(text)) return true;
  }
  return false;
}

/**
 * Called from game.js applyEvent. Detects significant player events
 * and schedules NPC reaction posts 1-3 months later.
 *
 * Triggers:
 *  - school: player got admission result (ev.set.school)
 *  - breakup: player went from 恋爱中 → 单身
 *  - new_relationship: player went 单身 → 恋爱中/已婚
 *  - special_storyline: player entered a non-hidden special storyline
 */
export function reactToPlayerEvent(ev, gameState) {
  if (!momentsState) return;
  if (momentsState.blocked) return; // no reactions during hidden storylines
  if (!ev.set) return;

  const monthTotal = gameState.monthTotal || 0;
  const reactions = [];

  // Trigger 1: school admission
  if (ev.set.school && !['无', '退学', '遣返', ''].includes(ev.set.school)) {
    reactions.push({ trigger: 'school_done', delay: 1 + Math.floor(Math.random() * 3) });
  }

  // Trigger 2: breakup (was 恋爱中/已婚 → now 单身/离异)
  const prevRel = gameState._prevRelationshipForMoments;
  if (ev.set.relationship === '单身' && (prevRel === '恋爱中' || prevRel === '已婚')) {
    reactions.push({ trigger: 'breakup', delay: 1 + Math.floor(Math.random() * 2) });
  }
  // Trigger 3: new relationship
  if ((ev.set.relationship === '恋爱中' || ev.set.relationship === '已婚') && prevRel === '单身') {
    reactions.push({ trigger: 'new_relationship', delay: 1 + Math.floor(Math.random() * 2) });
  }

  // Trigger 4: special storyline (any non-hidden storyline)
  if (ev.set.storyline && !HIDDEN_STORYLINE_SET.has(ev.set.storyline)) {
    reactions.push({ trigger: 'special_storyline', delay: 1 + Math.floor(Math.random() * 3) });
  }

  // 🥚 #1 EASTER EGG — NPC 暗讽 shade reactions
  // 这些 trigger 检测玩家"丢人"事件，NPC 朋友圈用 shade 模板暗中嘲讽
  // 玩家挂科 / 学术不端
  if (ev.set.academic_dishonesty || (ev.id && ev.id === 99931) /* INT≤0死 */) {
    reactions.push({ trigger: 'shade_cheating', delay: 1 + Math.floor(Math.random() * 2) });
    _unlockEgg('npc_shade');
  }
  if (ev.set.failed_exam || /挂科|fail|fail.*course|被劝退/.test(ev.text || ev.event || '')) {
    reactions.push({ trigger: 'shade_failure', delay: 1 + Math.floor(Math.random() * 2) });
    _unlockEgg('npc_shade');
  }
  // 玩家进入"海王"或"二婚"/"离异" — 暗示感情混乱
  if (['海王', '海后', '二婚', '离异'].includes(ev.set.relationship)) {
    reactions.push({ trigger: 'shade_breakup_cycle', delay: 1 + Math.floor(Math.random() * 2) });
    _unlockEgg('npc_shade');
  }
  // 玩家 MNY 跌穿底（≤0）— 暗示落魄
  if (gameState.MNY != null && gameState.MNY <= 0 && Math.random() < 0.3) {
    reactions.push({ trigger: 'shade_poor', delay: 1 + Math.floor(Math.random() * 3) });
    _unlockEgg('npc_shade');
  }

  // Schedule reactions
  for (const r of reactions) {
    momentsState._pendingReactions.push({
      trigger: r.trigger,
      atMonth: monthTotal + r.delay,
    });
  }
}

function _processPendingReactions(gameState) {
  if (!momentsState || !momentsState._pendingReactions) return;
  const monthTotal = gameState.monthTotal || 0;
  const remaining = [];

  for (const r of momentsState._pendingReactions) {
    if (r.atMonth > monthTotal) {
      remaining.push(r);
      continue;
    }

    // Time to fire: each NPC has a chance to react with a contextual post
    // 80% flex / 20% support: weighted pick by mood
    const templatesByType = REACTION_POSTS[r.trigger];
    if (!templatesByType) continue;

    for (const npc of momentsState.npcs) {
      const pool = templatesByType[npc.type];
      if (!pool || pool.length === 0) continue;

      // Skip NPCs who already posted a milestone in ±2 months of now
      // (avoids "Kevin posts admission" + "Kevin reacts to admission" same window)
      if (_npcHasRecentMilestone(npc, gameState, r.trigger)) continue;

      // Per-NPC chance to react — reduced ~70% to keep feed quiet (was 35/25/25/15)
      const baseChance =
        r.trigger === 'school_done'      ? 0.10 :
        r.trigger === 'breakup'          ? 0.08 :
        r.trigger === 'new_relationship' ? 0.08 :
        r.trigger === 'special_storyline'? 0.05 : 0.06;
      if (Math.random() > baseChance) continue;

      // 80% flex / peer, 20% support — weighted random
      const useSupport = Math.random() < 0.2;
      let filtered = pool.filter(p => useSupport ? p.mood === 'support' : p.mood !== 'support');

      // ── Romantic NPC sanity: don't post "我跟 ta 一周年纪念日" if currently single/breakup ──
      if (npc.type === 'romantic' && npc._loveCycle !== 'dating') {
        // Force support-only templates (which don't assume NPC is in a relationship)
        filtered = pool.filter(p => p.mood === 'support');
      }

      const finalPool = filtered.length > 0 ? filtered : pool.filter(p => p.mood === 'support');
      if (finalPool.length === 0) continue;
      const picked = finalPool[Math.floor(Math.random() * finalPool.length)];

      // Classify post type based on trigger
      const postType =
        r.trigger === 'school_done'      ? 'school' :
        r.trigger === 'breakup'          ? 'breakup' :
        r.trigger === 'new_relationship' ? 'love' :
        r.trigger === 'special_storyline'? 'flex' : 'general';

      _addNpcPost(npc, picked.text, postType, gameState);
      // Mark reaction so cooldowns track properly
      npc._lastPostMonth = monthTotal;
    }
  }

  momentsState._pendingReactions = remaining;
}

// ─────────────────────────────────────────────────────────────
// NPC Drama System (Feature 5)
// ─────────────────────────────────────────────────────────────

function _maybeTriggerDrama(gameState) {
  if (!momentsState || momentsState._drama) return;
  if (momentsState._dramaTriggeredThisGame) return;
  if (gameState.age < 18) return; // need some history first

  // 4% per tick to start a drama, only check every 6 months
  if ((gameState.monthTotal || 0) % 6 !== 0) return;
  if (Math.random() > 0.04) return;

  // Find a script whose required NPC types are both present
  const npcTypesPresent = new Set(momentsState.npcs.map(n => n.type));
  const eligible = DRAMA_SCRIPTS.filter(s =>
    s.requires.every(t => npcTypesPresent.has(t)) &&
    gameState.age >= s.minAge
  );
  if (eligible.length === 0) return;

  const script = eligible[Math.floor(Math.random() * eligible.length)];
  const npcA = momentsState.npcs.find(n => n.type === script.requires[0]);
  const npcB = momentsState.npcs.find(n => n.type === script.requires[1]);
  if (!npcA || !npcB) return;

  momentsState._drama = {
    scriptId: script.id,
    stepIdx: 0,
    npcA, npcB,
    nextStepAtMonth: gameState.monthTotal || 0, // first step fires immediately
    resolution: null,
  };
  momentsState._dramaTriggeredThisGame = true;
}

function _processDrama(gameState) {
  if (!momentsState || !momentsState._drama) return;
  const drama = momentsState._drama;
  const script = DRAMA_SCRIPTS.find(s => s.id === drama.scriptId);
  if (!script) { momentsState._drama = null; return; }

  // If waiting for player choice, do nothing (handled by button click)
  if (drama.waitingForChoice) return;

  // If story finished, clear after resolution recorded
  if (drama.stepIdx >= script.steps.length) {
    momentsState._drama = null;
    return;
  }

  const monthTotal = gameState.monthTotal || 0;
  if (drama.nextStepAtMonth > monthTotal) return;

  const step = script.steps[drama.stepIdx];
  const poster = step.role === 'A' ? drama.npcA : drama.npcB;
  const other = step.role === 'A' ? drama.npcB : drama.npcA;

  // Resolve ${A}/${B} placeholders in text + comments — use bare cn name,
  // not the full memo (otherwise we get "@A 陈思远 Edward 学霸 你不就是嫉妒吗")
  const fillNames = (s) => (s || '')
    .replace(/\$\{A\}/g, drama.npcA.cnName)
    .replace(/\$\{B\}/g, drama.npcB.cnName);

  const text = fillNames(step.text);

  // Pre-baked comments from the other NPC
  const preComments = (step.comments || []).map(c => {
    const cNpc = c.role === 'A' ? drama.npcA : drama.npcB;
    return {
      name: cNpc.name,
      color: cNpc.color,
      text: fillNames(c.text),
    };
  });

  // Build the drama post — special postType so we can render player choice buttons inline
  const post = {
    id: `drama_${drama.scriptId}_${drama.stepIdx}_${Date.now()}`,
    isPlayer: false,
    npcType: poster.type,
    name: poster.name,
    initial: poster.initial,
    isClose: poster.isClose,
    color: poster.color,
    avatarBg: poster.avatarBg,
    text,
    postType: 'drama',
    age: gameState.age,
    month: gameState.monthOfYear,
    time: _formatTime(gameState),
    comments: preComments,
    likes: Math.floor(Math.random() * 8) + 2,
    _drama: true,
  };

  // If this step has a player choice, attach it (rendered as buttons)
  if (step.playerChoice) {
    post._dramaChoice = step.playerChoice;
    drama.waitingForChoice = true;
  }

  momentsState.posts.unshift(post);
  momentsState.unreadCount++;
  momentsState._dirty = true;
  _prunePosts();

  drama.stepIdx++;
  if (drama.stepIdx < script.steps.length) {
    const nextStep = script.steps[drama.stepIdx];
    drama.nextStepAtMonth = monthTotal + (nextStep.delay || 1);
  }
}

// Called when player clicks a drama choice button
function _handleDramaChoice(postId, key) {
  if (!momentsState || !momentsState._drama) return;
  const post = momentsState.posts.find(p => p.id === postId);
  if (!post || !post._dramaChoice) return;

  const drama = momentsState._drama;
  drama.resolution = key;
  drama.waitingForChoice = false;

  // Apply consequences (only affect朋友圈 layer — comment tone toward player)
  const playerLikedSide = key === 'peace' ? 'both' : key === 'fuel' ? 'neither' : key === 'gossip' ? null : null;
  drama.npcA._dramaAttitude = playerLikedSide === 'both' ? 'warm' : playerLikedSide === 'neither' ? 'cold' : 'neutral';
  drama.npcB._dramaAttitude = playerLikedSide === 'both' ? 'warm' : playerLikedSide === 'neither' ? 'cold' : 'neutral';

  // Add the player's choice as a comment on the drama post
  let choiceText = '';
  if (key === 'gossip') choiceText = '（你默默截了图，没说话）';
  else if (key === 'peace') choiceText = '你给两人都发了私信，让他们冷静一下。';
  else if (key === 'fuel') choiceText = '（你在评论区点了"打起来！"，然后掉头就跑）';

  if (choiceText) {
    post.comments.push({
      name: '我',
      color: '#f5b642',
      text: choiceText,
      isPlayer: true,
    });
  }

  // 火上浇油给玩家内心爽 HAP +2，但需要 game.js 提供 callback
  if (key === 'fuel' && _onDramaResolve) {
    _onDramaResolve('fuel');
  }

  // Lock the buttons
  post._dramaChoiceResolved = key;

  // Schedule any remaining drama steps to proceed
  if (drama.stepIdx < (DRAMA_SCRIPTS.find(s => s.id === drama.scriptId)?.steps.length || 0)) {
    drama.nextStepAtMonth = _currentGameMonth + 1;
  } else {
    // Drama ended
    momentsState._drama = null;
  }

  momentsState._dirty = true;
  _renderMoments();
}

// Hook so game.js can give player HAP bonus for 火上浇油
let _onDramaResolve = null;
export function setMomentsDramaHandler(fn) { _onDramaResolve = fn; }

function _renderPost(post) {
  // Avatar initial: 中文姓 (post.initial) for NPCs, "我" for player
  const initial = post.isPlayer ? '我' : (post.initial || post.name.charAt(0));
  const playerClass = post.isPlayer ? ' moments-post-player' : '';

  // Display name with WeChat-style memo format. NPCs already store full memo in post.name
  // (e.g. "A 陈思远 Edward 学霸"). Split off the "A " prefix so we can style it differently.
  let nameHtml;
  if (post.isPlayer) {
    nameHtml = `<span class="moments-post-name" style="color:${post.color}">${post.name}</span>`;
  } else if (post.isClose && post.name.startsWith('A ')) {
    nameHtml = `<span class="moments-post-name" style="color:${post.color}"><span class="moments-name-close">A</span> ${post.name.slice(2)}</span>`;
  } else {
    nameHtml = `<span class="moments-post-name" style="color:${post.color}">${post.name}</span>`;
  }

  const commentsHtml = post.comments.length > 0 ? `
    <div class="moments-comments">
      ${post.comments.map(c => {
        const cls = c.isPlayer ? ' moments-comment-player' : (c.isReply ? ' moments-comment-reply' : '');
        // Style "A " prefix if present (close friend memo)
        const nameRendered = (typeof c.name === 'string' && c.name.startsWith('A '))
          ? `<span class="moments-name-close">A</span> ${c.name.slice(2)}`
          : c.name;
        return `<div class="moments-comment${cls}">
          <span class="moments-comment-name" style="color:${c.color}">${nameRendered}</span>
          <span class="moments-comment-text">${c.text}</span>
        </div>`;
      }).join('')}
    </div>` : '';

  const likedClass = post._playerLiked ? ' liked' : '';

  // Only show comment input for NPC posts (not player's own)
  const commentInput = !post.isPlayer ? `
    <div class="moments-comment-row">
      <input class="moments-comment-input" data-post-id="${post.id}" placeholder="说点什么..." maxlength="50" />
      <button class="moments-comment-submit" data-post-id="${post.id}">发送</button>
    </div>` : '';

  // Action button (Feature 3) — only shown if not consumed/expired
  let actionHtml = '';
  if (post.action) {
    if (post.action.consumed) {
      actionHtml = `<div class="moments-action-row consumed">已参与</div>`;
    } else if (_currentGameMonth != null && post.action.expiresAt < _currentGameMonth) {
      actionHtml = `<div class="moments-action-row expired">活动已结束</div>`;
    } else {
      actionHtml = `<div class="moments-action-row">
        <button class="moments-action-btn" data-post-id="${post.id}">${post.action.label} ✨</button>
      </div>`;
    }
  }

  // Drama choice buttons (Feature 5)
  let dramaHtml = '';
  if (post._dramaChoice) {
    if (post._dramaChoiceResolved) {
      const chosen = post._dramaChoice.options.find(o => o.key === post._dramaChoiceResolved);
      dramaHtml = `<div class="moments-drama-row consumed">你选了：${chosen ? chosen.label : '已选'}</div>`;
    } else {
      dramaHtml = `<div class="moments-drama-row">
        <div class="moments-drama-context">${post._dramaChoice.context}</div>
        <div class="moments-drama-options">
          ${post._dramaChoice.options.map(o => `
            <button class="moments-drama-btn" data-post-id="${post.id}" data-drama-key="${o.key}" title="${o.desc}">${o.label}</button>
          `).join('')}
        </div>
      </div>`;
    }
  }

  return `
    <div class="moments-post${playerClass}" data-post-id="${post.id}">
      <div class="moments-post-avatar" style="background:${post.avatarBg}; color:${post.color}">
        ${initial}
      </div>
      <div class="moments-post-body">
        <div class="moments-post-header">
          ${nameHtml}
        </div>
        <div class="moments-post-text">${post.text}</div>
        ${actionHtml}
        ${dramaHtml}
        <div class="moments-post-footer">
          <span class="moments-post-time">${post.time}</span>
          <button class="moments-like-btn${likedClass}" data-post-id="${post.id}">
            ${post._playerLiked ? '♥' : '♡'} ${post.likes}
          </button>
        </div>
        ${commentsHtml}
        ${commentInput}
      </div>
    </div>`;
}

function _updateBadge() {
  const badge = document.getElementById('moments-badge');
  if (!badge) return;
  if (momentsState && momentsState.unreadCount > 0 && !_momentsVisible) {
    badge.textContent = momentsState.unreadCount > 99 ? '99+' : momentsState.unreadCount;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
  // Mobile badge
  const mobileBadge = document.getElementById('moments-badge-mobile');
  if (mobileBadge) {
    if (momentsState && momentsState.unreadCount > 0 && !_momentsVisible) {
      mobileBadge.textContent = momentsState.unreadCount > 99 ? '99+' : momentsState.unreadCount;
      mobileBadge.style.display = '';
    } else {
      mobileBadge.style.display = 'none';
    }
  }
}

// ══════════════════════════════════════════════════════════════
//  TAB SWITCHING & PANEL MANAGEMENT
// ══════════════════════════════════════════════════════════════

let _savedAutoMode = 0;
let _onPauseAuto = null;
let _onResumeAuto = null;

/**
 * Mount the moments UI. Called once from game.js init.
 * Desktop: right-edge floating panel — collapsed shows thin vertical tab, expanded slides in
 * Keyboard: M key toggles expand/collapse
 * Mobile: button in strip → full-screen overlay
 */
export function mountMomentsUI(opts = {}) {
  _onPauseAuto = opts.onPauseAuto || null;
  _onResumeAuto = opts.onResumeAuto || null;

  // 1) Independent strip — always flush to viewport right edge
  const strip = document.createElement('button');
  strip.id = 'moments-rfloat-strip';
  strip.className = 'moments-rfloat-strip';
  strip.type = 'button';
  strip.title = '朋友圈 (M)';
  strip.innerHTML = `
    <span class="moments-rfloat-strip-text">朋友圈</span>
    <span id="moments-badge" class="moments-badge moments-badge-strip" style="display:none">0</span>
  `;
  document.body.appendChild(strip);

  // 2) Panel — slides in from right when expanded
  _momentsPanel = document.createElement('div');
  _momentsPanel.id = 'moments-panel';
  _momentsPanel.className = 'moments-rfloat collapsed';
  _momentsPanel.innerHTML = `
    <div class="moments-rfloat-inner">
      <div class="moments-rfloat-header">
        <span class="moments-rfloat-title">朋友圈</span>
        <span class="moments-rfloat-hint">M 键开关</span>
        <button class="moments-rfloat-close" type="button" title="收起 (M)">✕</button>
      </div>
      <div class="moments-feed"></div>
    </div>
  `;
  document.body.appendChild(_momentsPanel);

  // CRITICAL: Stop click propagation so right-panel's advanceMonth handler doesn't fire
  _momentsPanel.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  strip.addEventListener('click', (e) => {
    e.stopPropagation();
    _expandMoments();
  });

  // Close button → collapse
  const closeBtn = _momentsPanel.querySelector('.moments-rfloat-close');
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    _collapseMoments();
  });

  // M keyboard shortcut — toggle open/close
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'm' || e.key === 'M') {
      if (_momentsPanel.classList.contains('collapsed')) _expandMoments();
      else _collapseMoments();
    }
  });
}

function _expandMoments() {
  if (!_momentsPanel) return;
  _momentsPanel.classList.remove('collapsed');
  _momentsVisible = true;
  if (momentsState) momentsState.unreadCount = 0;
  _updateBadge();
  _renderMoments();
}

function _collapseMoments() {
  if (!_momentsPanel) return;
  _momentsPanel.classList.add('collapsed');
  _momentsVisible = false;
}

/**
 * Show player post prompt UI
 */
export function showPostPrompt(promptData, gameState, onChoice) {
  // Create a modal-style prompt
  let overlay = document.getElementById('moments-post-prompt');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'moments-post-prompt';
    overlay.className = 'moments-post-prompt';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="moments-prompt-card">
      <div class="moments-prompt-icon">📱</div>
      <div class="moments-prompt-text">${promptData.prompt}</div>
      <div class="moments-prompt-actions">
        <button class="moments-prompt-btn moments-prompt-share" data-choice="share">
          <span class="moments-prompt-btn-icon">✨</span>
          晒一下
          <span class="moments-prompt-btn-sub">快乐+2</span>
        </button>
        <button class="moments-prompt-btn moments-prompt-quiet" data-choice="quiet">
          <span class="moments-prompt-btn-icon">🤫</span>
          低调分享
          <span class="moments-prompt-btn-sub">社交+1</span>
        </button>
        <button class="moments-prompt-btn moments-prompt-skip" data-choice="skip">
          算了
        </button>
      </div>
    </div>
  `;

  overlay.style.display = 'flex';

  overlay.addEventListener('click', function handler(e) {
    const btn = e.target.closest('.moments-prompt-btn');
    if (!btn) return;
    const choice = btn.dataset.choice;
    overlay.style.display = 'none';
    overlay.removeEventListener('click', handler);
    if (onChoice) onChoice(choice);
  });
}

/**
 * Mobile: show moments as full-screen slide-up overlay
 */
export function mountMobileMoments() {
  if (_momentsMobilePanel) return;

  _momentsMobilePanel = document.createElement('div');
  _momentsMobilePanel.id = 'moments-mobile-panel';
  _momentsMobilePanel.className = 'moments-mobile-panel';
  _momentsMobilePanel.innerHTML = `
    <div class="moments-mobile-header">
      <button class="moments-mobile-close">✕</button>
      <span class="moments-mobile-title">朋友圈</span>
    </div>
    <div class="moments-feed"></div>
  `;
  document.body.appendChild(_momentsMobilePanel);

  _momentsMobilePanel.querySelector('.moments-mobile-close').addEventListener('click', () => {
    _momentsMobilePanel.classList.remove('open');
    _momentsVisible = false;
    if (_onResumeAuto && _savedAutoMode) {
      _onResumeAuto(_savedAutoMode);
      _savedAutoMode = 0;
    }
  });
}

export function openMobileMoments() {
  if (!_momentsMobilePanel) mountMobileMoments();

  // Copy feed content from desktop panel
  const desktopFeed = _momentsPanel?.querySelector('.moments-feed');
  const mobileFeed = _momentsMobilePanel.querySelector('.moments-feed');
  if (desktopFeed && mobileFeed) {
    mobileFeed.innerHTML = desktopFeed.innerHTML;
  }

  _momentsMobilePanel.classList.add('open');
  _momentsVisible = true;

  if (momentsState) momentsState.unreadCount = 0;
  _updateBadge();

  if (_onPauseAuto) _savedAutoMode = _onPauseAuto();
}

/**
 * Reset moments state (called on game restart)
 */
export function resetMoments() {
  momentsState = null;
  _momentsVisible = false;
  _savedAutoMode = 0;
  if (_momentsPanel) {
    const feed = _momentsPanel.querySelector('.moments-feed');
    if (feed) feed.innerHTML = '';
  }
  _updateBadge();
}

/**
 * Check if moments is currently visible (for pause logic)
 */
export function isMomentsVisible() {
  return _momentsVisible;
}

/**
 * Get class reunion data — called at game end for the summary screen.
 * Returns an array of { name, color, type, label, ending } for each NPC.
 */
export function getClassReunion() {
  if (!momentsState || !momentsState.npcs || momentsState.npcs.length === 0) return [];
  return momentsState.npcs.map(npc => {
    const endings = NPC_ENDINGS[npc.type] || ['毕业后失联了，没人知道 ta 去了哪。'];
    const ending = endings[Math.floor(Math.random() * endings.length)];
    return {
      name: npc.name,              // full memo (with possible "A " prefix)
      isClose: npc.isClose,
      initial: npc.initial,         // 中文姓
      color: npc.color,
      avatarBg: npc.avatarBg,
      type: npc.type,
      label: npc.typeLabel,
      ending,
    };
  });
}
