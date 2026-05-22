// ── Multiplayer Networking Layer (PeerJS based) ─────────────────────────────
// 联机层：房主创建房间生成短码，朋友输入码加入。
// 弱同步模式：双方各自推进，关键节点（同学聚会/双人剧情/PvP）需要等待对方到达。
//
// 消息协议（双方对称）：
//   { type: 'hello', nickname, sex }                     初次握手
//   { type: 'state_sync', age, month, school, profession, major, country,
//                          relationship, storyline, stats: {SOC,INT,MNY,PER,HLT,APP,HAP} }
//   { type: 'butterfly', srcEvent, payload }            玩家A拒绝关键机会 → 推送给B
//   { type: 'reunion_arrived', age }                    我已到达同学聚会触发点
//   { type: 'reunion_data', age, snapshot }             同学聚会数据交换
//   { type: 'card_played', card, target }               打出命运卡
//   { type: 'relation_delta', delta, reason }           关系值变化通知
//   { type: 'coop_invite', storyline }                  邀请进入双人剧情线
//   { type: 'coop_response', accept, storyline }        响应邀请
//   { type: 'game_end', endingId, age, score }          一方游戏结束
//   { type: 'chat', text }                              简易聊天（可选）
//   { type: 'disconnect_intent' }                       主动退出

export const mp = {
  enabled: false,
  isHost: false,
  myNickname: '我',
  roomCode: '',

  peer: null,
  conn: null,
  connected: false,

  // 对方核心信息（用于顶部条显示和同学聚会等）
  opponent: {
    nickname: '对手',
    sex: 0,
    age: 15,
    month: 1,
    school: '',
    profession: '高中生',
    major: '',
    country: '',
    storyline: '',
    relationship: '单身',
    stats: { SOC: 0, INT: 0, MNY: 0, PER: 0, HLT: 0, APP: 0, HAP: 5 },
    endingId: null,
    endingScore: 0,
  },

  // 关系值 (-100 ~ 100)
  relation: 0,

  // 命运卡（开局3张：2小坑 + 1大招）
  cards: [],   // [{id, name, kind:'small'|'big', desc, used:false}]
  incomingCardEffect: null, // 对方打出后存在这里，由 game.js 在下次事件应用

  // 同步状态
  pendingReunionAge: null,  // 等待对方到达此年龄触发同学聚会
  isWaiting: false,         // 是否阻塞等待对方
  waitReason: '',

  // 蝴蝶效应：收到的关键机会推送（队列）
  pendingButterfly: [],

  // 双人剧情邀请状态
  coopInvitePending: null,  // {from:'me'|'them', storyline:'partners'}

  // 消息回调表
  handlers: {},
};

// ── 损友卡定义 ──────────────────────────────────────────────────────────────
// category: 'harm' (红) | 'help' (绿) | 'chaos' (紫)
// grade: 0=普通, 1=稀有, 2=史诗
export const FRENEMY_CARD_POOL = [
  // ─── 害人卡 (harm) ───
  {
    id: 'rumor', category: 'harm', grade: 0, icon: '📣', name: '嚼舌根',
    desc: '在留学生群里说对方坏话。SOC-3, HAP-1。好感-10',
    effect: { stats: { SOC: -3, HAP: -1 }, relationDelta: -10 },
  },
  {
    id: 'midnight_call', category: 'harm', grade: 0, icon: '😈', name: '半夜夺命call',
    desc: '算好时差在对方凌晨4点疯狂打电话。HLT-2, HAP-1。好感-10',
    effect: { stats: { HLT: -2, HAP: -1 }, relationDelta: -10 },
  },
  {
    id: 'screenshot', category: 'harm', grade: 0, icon: '🤡', name: '朋友圈挂人',
    desc: '截对方聊天记录配上阴阳怪气的点评发出去。SOC-2, APP-1。好感-10',
    effect: { stats: { SOC: -2, APP: -1 }, relationDelta: -10 },
  },
  {
    id: 'ugly_photo', category: 'harm', grade: 1, icon: '📸', name: '丑照轰炸',
    desc: '把对方的黑历史照片发到朋友圈。APP-3, HAP-2。好感-20',
    effect: { stats: { APP: -3, HAP: -2 }, relationDelta: -20 },
  },
  {
    id: 'report', category: 'harm', grade: 1, icon: '📝', name: '举报学术不端',
    desc: '向对方学校匿名举报作弊（不管有没有）。INT-3, SOC-2。好感-20',
    effect: { stats: { INT: -3, SOC: -2 }, relationDelta: -20 },
  },
  {
    id: 'ex_like', category: 'harm', grade: 1, icon: '🐍', name: '给前任点赞',
    desc: '疯狂给对方前任的社交媒体点赞评论。HAP-3, PER-1。好感-15',
    effect: { stats: { HAP: -3, PER: -1 }, relationDelta: -15 },
  },
  {
    id: 'ghost', category: 'harm', grade: 1, icon: '💬', name: '已读不回',
    desc: '对方找你倾诉的时候永远已读不回。HAP-2, SOC-2。好感-15',
    effect: { stats: { HAP: -2, SOC: -2 }, relationDelta: -15 },
  },
  {
    id: 'bad_ramen', category: 'harm', grade: 0, icon: '🎁', name: '寄一箱泡面',
    desc: '给对方寄了一箱家乡泡面……全是最难吃的口味。HAP-2。好感-5',
    effect: { stats: { HAP: -2 }, relationDelta: -5 },
  },
  {
    id: 'erase', category: 'harm', grade: 2, icon: '🌑', name: '社会性死亡',
    desc: '发动终极社死攻击。全属性-2, HAP-4。好感-30',
    effect: { stats: { SOC: -2, INT: -2, MNY: -2, PER: -2, HLT: -2, APP: -2, HAP: -4 }, relationDelta: -30 },
  },
  {
    id: 'doxx', category: 'harm', grade: 2, icon: '🕵️', name: '开盒',
    desc: '人肉搜索对方并把信息挂到网上。SOC-4, PER-3。好感-30',
    effect: { stats: { SOC: -4, PER: -3 }, relationDelta: -30 },
  },

  // ─── 帮人卡 (help) ───
  {
    id: 'red_packet', category: 'help', grade: 0, icon: '🧧', name: '发个大红包',
    desc: '在对方最难的时候转了一笔钱。MNY+2, HAP+1。好感+10',
    effect: { stats: { MNY: 2, HAP: 1 }, relationDelta: 10 },
  },
  {
    id: 'share_notes', category: 'help', grade: 0, icon: '📖', name: '共享网课笔记',
    desc: '把自己整理的笔记和录屏全部共享。INT+2, PER+1。好感+15',
    effect: { stats: { INT: 2, PER: 1 }, relationDelta: 15 },
  },
  {
    id: 'delivery', category: 'help', grade: 0, icon: '🍕', name: '跨洋外卖',
    desc: '点了一份对方城市的外卖送到门口。HAP+2, HLT+1。好感+10',
    effect: { stats: { HAP: 2, HLT: 1 }, relationDelta: 10 },
  },
  {
    id: 'late_chat', category: 'help', grade: 0, icon: '🌙', name: '跨时差陪聊',
    desc: '凌晨3点爬起来陪对方聊到天亮。HAP+2, PER+1。好感+10',
    effect: { stats: { HAP: 2, PER: 1 }, relationDelta: 10 },
  },
  {
    id: 'essay', category: 'help', grade: 1, icon: '✍️', name: '远程代写essay',
    desc: '熬夜帮对方赶了一篇due。INT+2, PER+1。好感+15',
    effect: { stats: { INT: 2, PER: 1 }, relationDelta: 15 },
  },
  {
    id: 'lend_money', category: 'help', grade: 1, icon: '💸', name: '借钱不催',
    desc: '在对方最难的时候借钱还不催还。MNY+3, HAP+1。好感+25',
    effect: { stats: { MNY: 3, HAP: 1 }, relationDelta: 25 },
  },
  {
    id: 'care_package', category: 'help', grade: 1, icon: '📮', name: '寄家乡特产',
    desc: '千里迢迢寄了一箱家乡零食和调料。HAP+3, HLT+1。好感+20',
    effect: { stats: { HAP: 3, HLT: 1 }, relationDelta: 20 },
  },
  {
    id: 'rec_letter', category: 'help', grade: 1, icon: '📋', name: '帮写推荐信',
    desc: '帮对方润色了推荐信和简历。INT+2, SOC+1。好感+20',
    effect: { stats: { INT: 2, SOC: 1 }, relationDelta: 20 },
  },
  {
    id: 'all_in_help', category: 'help', grade: 2, icon: '🌟', name: '两肋插刀',
    desc: '在对方人生低谷全力相挺。全属性+1, HAP+3。好感+35',
    effect: { stats: { SOC: 1, INT: 1, MNY: 1, PER: 1, HLT: 1, APP: 1, HAP: 3 }, relationDelta: 35 },
  },
  {
    id: 'referral', category: 'help', grade: 2, icon: '💼', name: '内推大厂',
    desc: '用自己的人脉帮对方拿到面试机会。MNY+2, SOC+2, INT+1。好感+30',
    effect: { stats: { MNY: 2, SOC: 2, INT: 1 }, relationDelta: 30 },
  },

  // ─── 骚操作卡 (chaos) ───
  {
    id: 'double_or_nothing', category: 'chaos', grade: 0, icon: '🎲', name: '全押',
    desc: '50%概率对方全属性+2，50%概率全属性-2。好感-5',
    effect: { special: 'double_or_nothing', relationDelta: -5 },
  },
  {
    id: 'mirror', category: 'chaos', grade: 0, icon: '🪞', name: '镜像',
    desc: '把自己最低的属性复制给对方（替换同属性）。好感-10',
    effect: { special: 'mirror_lowest', relationDelta: -10 },
  },
  {
    id: 'joker', category: 'chaos', grade: 0, icon: '🃏', name: '小丑牌',
    desc: '本来想害对方，结果帮了对方（效果反转）。好感+5',
    effect: { special: 'joker', relationDelta: 5 },
  },
  {
    id: 'drift', category: 'chaos', grade: 0, icon: '🌀', name: '属性漂移',
    desc: '双方各随机一项属性±3，完全看运气。好感不变',
    effect: { special: 'drift', relationDelta: 0 },
  },
  {
    id: 'swap_stat', category: 'chaos', grade: 1, icon: '🔀', name: '灵魂交换',
    desc: '随机一项属性和对方互换数值。好感不变',
    effect: { special: 'swap_random_stat', relationDelta: 0 },
  },
  {
    id: 'roulette', category: 'chaos', grade: 1, icon: '🎰', name: '俄罗斯轮盘',
    desc: '对方随机一项属性-4，40%概率反噬自己。好感-5',
    effect: { special: 'roulette', relationDelta: -5 },
  },
  {
    id: 'steal_stat', category: 'chaos', grade: 1, icon: '🧲', name: '偷属性',
    desc: '偷对方最高属性的2点加到自己身上。好感-15',
    effect: { special: 'steal_stat', relationDelta: -15 },
  },
  {
    id: 'nuke', category: 'chaos', grade: 1, icon: '💣', name: '同归于尽',
    desc: '双方随机两项属性各-3。好感-10',
    effect: { special: 'nuke', relationDelta: -10 },
  },
  {
    id: 'identity_theft', category: 'chaos', grade: 2, icon: '🎭', name: '人生互换',
    desc: '和对方交换三项最高属性值。命运从此改写。好感-10',
    effect: { special: 'swap_top3', relationDelta: -10 },
  },
];

// Build lookup map
export const FATE_CARDS = {};
for (const c of FRENEMY_CARD_POOL) FATE_CARDS[c.id] = c;

// Draft: pick 8 candidates (balanced across categories), player picks 3
export function draftFrenemyCards() {
  const byCat = { harm: [], help: [], chaos: [] };
  for (const c of FRENEMY_CARD_POOL) byCat[c.category].push(c);
  // shuffle each
  for (const arr of Object.values(byCat)) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  // pick 3 harm, 3 help, 3 chaos (= 9), player picks 3
  const pool = [
    ...byCat.harm.slice(0, 3),
    ...byCat.help.slice(0, 3),
    ...byCat.chaos.slice(0, 3),
  ];
  // final shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

export function initialFateCards() {
  // fallback: if draft wasn't used, give 3 defaults
  return [
    { ...FATE_CARDS.rumor, used: false },
    { ...FATE_CARDS.red_packet, used: false },
    { ...FATE_CARDS.double_or_nothing, used: false },
  ];
}

// ── PeerJS 初始化 ───────────────────────────────────────────────────────────
function ensurePeerJSLoaded() {
  return new Promise((resolve, reject) => {
    if (window.Peer) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('PeerJS 加载失败，请检查网络'));
    document.head.appendChild(s);
  });
}

function shortCode() {
  // 6位字母数字，去掉易混字符
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

const ROOM_PREFIX = 'sasr-mp-';  // PeerJS id 前缀，避免和其他游戏冲突

// ── 信令 & ICE 配置 ────────────────────────────────────────────────────────
// 自建 PeerJS 信令服务器（设为 null 则回退到默认 0.peerjs.com）
const CUSTOM_PEER_SERVER = { host: 'studyaboardrestart.onrender.com', port: 443, secure: true, path: '/mp' };

// ICE 服务器：STUN 免费，TURN 用于 P2P 打洞失败时中继（跨国必备）
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.nextcloud.com:443' },
  // 免费 TURN（有带宽限制，测试够用；正式上线建议换付费的）
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

function _peerOptions(extraId) {
  const opts = {
    debug: 0,
    config: { iceServers: ICE_SERVERS },
  };
  if (CUSTOM_PEER_SERVER) {
    opts.host = CUSTOM_PEER_SERVER.host;
    opts.port = CUSTOM_PEER_SERVER.port || 443;
    opts.secure = CUSTOM_PEER_SERVER.secure !== false;
    if (CUSTOM_PEER_SERVER.path) opts.path = CUSTOM_PEER_SERVER.path;
  }
  return opts;
}

export async function createRoom(nickname) {
  await ensurePeerJSLoaded();
  mp.myNickname = nickname || '玩家';
  mp.isHost = true;
  mp.roomCode = shortCode();
  return new Promise((resolve, reject) => {
    const peerId = ROOM_PREFIX + mp.roomCode;
    mp.peer = new Peer(peerId, _peerOptions());
    let opened = false;
    mp.peer.on('open', () => {
      opened = true;
      resolve(mp.roomCode);
    });
    mp.peer.on('connection', (conn) => {
      // 房间已满（已有一个连接）→ 拒绝第三人
      if (mp.conn && mp.connected) {
        try {
          conn.on('open', () => {
            conn.send(JSON.stringify({ type: 'room_full', data: {} }));
            setTimeout(() => conn.close(), 500);
          });
        } catch (e) {}
        return;
      }
      mp.conn = conn;
      _wireConnection(conn);
    });
    mp.peer.on('error', (err) => {
      if (!opened) reject(err);
      else _emit('error', err);
    });
  });
}

export async function joinRoom(code, nickname) {
  await ensurePeerJSLoaded();
  mp.myNickname = nickname || '玩家';
  mp.isHost = false;
  mp.roomCode = code.toUpperCase();
  return new Promise((resolve, reject) => {
    mp.peer = new Peer(_peerOptions());
    mp.peer.on('open', () => {
      const conn = mp.peer.connect(ROOM_PREFIX + mp.roomCode, { reliable: true });
      mp.conn = conn;
      conn.on('open', () => {
        // 先监听是否被拒绝（房间已满）
        const earlyHandler = (raw) => {
          try {
            const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (msg && msg.type === 'room_full') {
              conn.off('data', earlyHandler);
              mp.conn = null;
              try { mp.peer.destroy(); } catch (e) {}
              mp.peer = null;
              reject(new Error('房间已满（最多2人）'));
              return;
            }
          } catch (e) {}
          // 不是 room_full → 移除临时监听，正常建连
          conn.off('data', earlyHandler);
          _wireConnection(conn);
          // 重放这条消息给正常 handler
          try {
            const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (msg && msg.type) _emit(msg.type, msg.data || {});
          } catch (e) {}
          resolve();
        };
        conn.on('data', earlyHandler);
        // 如果 500ms 内没收到 room_full，也直接建连
        setTimeout(() => {
          conn.off('data', earlyHandler);
          if (!mp.connected) {
            _wireConnection(conn);
            resolve();
          }
        }, 500);
      });
      conn.on('error', (e) => reject(e));
      setTimeout(() => {
        if (!mp.connected) reject(new Error('连接超时，请确认房间码正确且房主在线'));
      }, 12000);
    });
    mp.peer.on('error', (err) => reject(err));
  });
}

function _wireConnection(conn) {
  conn.on('open', () => {
    mp.connected = true;
    mp.enabled = true;
    _emit('connected', {});
    // 主动 hello
    send('hello', { nickname: mp.myNickname });
  });
  conn.on('data', (raw) => {
    try {
      const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (msg && msg.type) _emit(msg.type, msg.data || {});
    } catch (e) { /* ignore */ }
  });
  conn.on('close', () => {
    mp.connected = false;
    _emit('peer_left', {});
  });
  conn.on('error', (e) => {
    _emit('error', e);
  });
  // 如果已经是 open 状态（join 路径会先 open 再 wire），主动触发一次
  if (conn.open) {
    setTimeout(() => {
      mp.connected = true;
      mp.enabled = true;
      _emit('connected', {});
      send('hello', { nickname: mp.myNickname });
    }, 0);
  }
}

export function send(type, data) {
  if (!mp.conn || !mp.connected) return;
  try {
    mp.conn.send(JSON.stringify({ type, data: data || {} }));
  } catch (e) { /* ignore */ }
}

export function on(type, handler) {
  if (!mp.handlers[type]) mp.handlers[type] = [];
  mp.handlers[type].push(handler);
}

function _emit(type, data) {
  const list = mp.handlers[type] || [];
  for (const h of list) {
    try { h(data); } catch (e) { console.error('[mp] handler error', e); }
  }
}

export function disconnect() {
  try { if (mp.conn) mp.conn.close(); } catch (e) {}
  try { if (mp.peer) mp.peer.destroy(); } catch (e) {}
  mp.conn = null; mp.peer = null;
  mp.connected = false; mp.enabled = false;
}

export function resetMpState() {
  disconnect();
  mp.opponent = {
    nickname: '对手', sex: 0, age: 15, month: 1,
    school: '', profession: '高中生', major: '', country: '',
    storyline: '', relationship: '单身',
    stats: { SOC: 0, INT: 0, MNY: 0, PER: 0, HLT: 0, APP: 0, HAP: 5 },
    endingId: null, endingScore: 0,
  };
  mp.relation = 0;
  mp.cards = [];
  mp.incomingCardEffect = null;
  mp.pendingReunionAge = null;
  mp.isWaiting = false;
  mp.waitReason = '';
  mp.pendingButterfly = [];
  mp.coopInvitePending = null;
  mp.handlers = {};
}

// 同学聚会触发年龄（满足任一即触发）
export const REUNION_AGES = [23, 28, 33];

// 蝴蝶效应：关键机会事件 ID 列表（在这些事件上拒绝/放弃 → 推送给对方）
// game.js 在 resolveChoice 时检测 ev.butterflyKey，把对应事件推给对方
// 这里不硬编码 ID；由 events JSON 里的 butterflyKey 标记驱动
