// 德扑 7 取 5 手牌评估器
// 输入：7 张牌（每张 2 字符，rank+suit，rank: 23456789TJQKA，suit: shdc）
// 输出：分数（数字越大越强），用于两手对比

const RANK_VAL = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };

const CATEGORY = {
  HIGH: 0, PAIR: 1, TWO_PAIR: 2, TRIPS: 3, STRAIGHT: 4,
  FLUSH: 5, FULL_HOUSE: 6, QUADS: 7, STRAIGHT_FLUSH: 8
};

// 把分类、kicker 序列编码成单一数字便于比大小
// score = cat * 1e10 + k1*1e8 + k2*1e6 + k3*1e4 + k4*1e2 + k5
function encode(cat, kickers) {
  let s = cat * 1e10;
  for (let i = 0; i < 5; i++) {
    s += (kickers[i] || 0) * Math.pow(100, 4 - i);
  }
  return s;
}

// 给定升序的 ranks 数组（去重，长度>=5），找最大顺子的最高牌；没有返回 0
function findStraight(ranks) {
  const set = new Set(ranks);
  // A-5 顺子特殊：A 算 1
  if (set.has(14) && set.has(2) && set.has(3) && set.has(4) && set.has(5)) {
    var best = 5;
  } else {
    var best = 0;
  }
  for (let high = 14; high >= 5; high--) {
    if (set.has(high) && set.has(high - 1) && set.has(high - 2) && set.has(high - 3) && set.has(high - 4)) {
      if (high > best) best = high;
      break;
    }
  }
  return best;
}

export function evaluate7(cards) {
  const ranks = cards.map(c => RANK_VAL[c[0]]);
  const suits = cards.map(c => c[1]);

  // 数花色 / 数牌点
  const suitCount = {};
  const suitCards = { s: [], h: [], d: [], c: [] };
  for (let i = 0; i < 7; i++) {
    suitCount[suits[i]] = (suitCount[suits[i]] || 0) + 1;
    suitCards[suits[i]].push(ranks[i]);
  }
  const rankCount = {};
  for (const r of ranks) rankCount[r] = (rankCount[r] || 0) + 1;

  // 检测同花
  let flushSuit = null;
  for (const s in suitCount) if (suitCount[s] >= 5) flushSuit = s;

  // 同花顺
  if (flushSuit) {
    const fr = suitCards[flushSuit].slice().sort((a, b) => a - b);
    const sf = findStraight(fr);
    if (sf > 0) return encode(CATEGORY.STRAIGHT_FLUSH, [sf]);
  }

  // 按出现次数和牌点排序的分组
  const groups = Object.entries(rankCount)
    .map(([r, c]) => ({ r: +r, c }))
    .sort((a, b) => b.c - a.c || b.r - a.r);

  // 四条
  if (groups[0].c === 4) {
    const quad = groups[0].r;
    const kicker = Math.max(...ranks.filter(r => r !== quad));
    return encode(CATEGORY.QUADS, [quad, kicker]);
  }

  // 葫芦：三条 + 对（或第二个三条）
  if (groups[0].c === 3) {
    let pairR = 0;
    for (let i = 1; i < groups.length; i++) {
      if (groups[i].c >= 2) { pairR = groups[i].r; break; }
    }
    if (pairR) return encode(CATEGORY.FULL_HOUSE, [groups[0].r, pairR]);
  }

  // 同花
  if (flushSuit) {
    const top5 = suitCards[flushSuit].sort((a, b) => b - a).slice(0, 5);
    return encode(CATEGORY.FLUSH, top5);
  }

  // 顺子
  const uniq = [...new Set(ranks)].sort((a, b) => a - b);
  const st = findStraight(uniq);
  if (st > 0) return encode(CATEGORY.STRAIGHT, [st]);

  // 三条
  if (groups[0].c === 3) {
    const trip = groups[0].r;
    const kickers = ranks.filter(r => r !== trip).sort((a, b) => b - a).slice(0, 2);
    return encode(CATEGORY.TRIPS, [trip, ...kickers]);
  }

  // 两对
  if (groups[0].c === 2 && groups[1] && groups[1].c === 2) {
    const p1 = groups[0].r, p2 = groups[1].r;
    const kicker = Math.max(...ranks.filter(r => r !== p1 && r !== p2));
    return encode(CATEGORY.TWO_PAIR, [p1, p2, kicker]);
  }

  // 一对
  if (groups[0].c === 2) {
    const p = groups[0].r;
    const kickers = ranks.filter(r => r !== p).sort((a, b) => b - a).slice(0, 3);
    return encode(CATEGORY.PAIR, [p, ...kickers]);
  }

  // 高牌
  const top5 = ranks.slice().sort((a, b) => b - a).slice(0, 5);
  return encode(CATEGORY.HIGH, top5);
}

const CAT_NAMES = ['高牌', '一对', '两对', '三条', '顺子', '同花', '葫芦', '四条', '同花顺'];
export function categoryName(score) {
  return CAT_NAMES[Math.floor(score / 1e10)];
}

const SUITS = ['s', 'h', 'd', 'c'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export function buildDeck() {
  const d = [];
  for (const r of RANKS) for (const s of SUITS) d.push(r + s);
  return d;
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 比较：返回 +1 玩家赢，-1 对手赢，0 平
export function compareHands(playerHole, oppHole, board) {
  const ps = evaluate7([...playerHole, ...board]);
  const os = evaluate7([...oppHole, ...board]);
  if (ps > os) return 1;
  if (ps < os) return -1;
  return 0;
}
