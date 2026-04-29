// 169 格起手牌胜率表（heads-up vs 单一随机手牌，pre-flop %）
// 来源：r/poker；用于 modal 里给玩家展示当前底牌的"参考胜率"
// 实际胜负仍由 poker_eval.js 真实 7 取 5 评估决出
export const POKER_WINRATES = {
  AA: 85, KK: 82, QQ: 80, JJ: 77, TT: 75, 99: 72, 88: 69, 77: 66, 66: 63,
  55: 60, 44: 57, 33: 54, 22: 50,

  AKs: 67, AQs: 66, AJs: 65, ATs: 65, A9s: 63, A8s: 62, A7s: 61, A6s: 60, A5s: 60, A4s: 59, A3s: 58, A2s: 57,
  KQs: 63, KJs: 63, KTs: 62, K9s: 60, K8s: 58, K7s: 57, K6s: 57, K5s: 56, K4s: 55, K3s: 54, K2s: 53,
  QJs: 60, QTs: 59, Q9s: 58, Q8s: 56, Q7s: 54, Q6s: 54, Q5s: 53, Q4s: 52, Q3s: 51, Q2s: 50,
  JTs: 57, J9s: 56, J8s: 54, J7s: 52, J6s: 50, J5s: 50, J4s: 49, J3s: 48, J2s: 47,
  T9s: 54, T8s: 52, T7s: 51, T6s: 49, T5s: 47, T4s: 46, T3s: 46, T2s: 45,
  "98s": 51, "97s": 49, "96s": 47, "95s": 46, "94s": 44, "93s": 43, "92s": 42,
  "87s": 48, "86s": 46, "85s": 44, "84s": 43, "83s": 41, "82s": 40,
  "76s": 45, "75s": 44, "74s": 42, "73s": 40, "72s": 38,
  "65s": 43, "64s": 41, "63s": 39, "62s": 38,
  "54s": 41, "53s": 40, "52s": 38,
  "43s": 39, "42s": 37,
  "32s": 36,

  AKo: 65, AQo: 64, AJo: 64, ATo: 63, A9o: 61, A8o: 60, A7o: 59, A6o: 58, A5o: 58, A4o: 57, A3o: 56, A2o: 55,
  KQo: 61, KJo: 61, KTo: 60, K9o: 58, K8o: 56, K7o: 55, K6o: 54, K5o: 53, K4o: 52, K3o: 51, K2o: 50,
  QJo: 58, QTo: 57, Q9o: 55, Q8o: 54, Q7o: 52, Q6o: 51, Q5o: 50, Q4o: 49, Q3o: 48, Q2o: 47,
  JTo: 55, J9o: 53, J8o: 51, J7o: 50, J6o: 48, J5o: 47, J4o: 46, J3o: 45, J2o: 44,
  T9o: 51, T8o: 50, T7o: 48, T6o: 46, T5o: 44, T4o: 43, T3o: 42, T2o: 42,
  "98o": 48, "97o": 46, "96o": 44, "95o": 43, "94o": 41, "93o": 40, "92o": 39,
  "87o": 45, "86o": 43, "85o": 41, "84o": 39, "83o": 37, "82o": 37,
  "76o": 42, "75o": 40, "74o": 38, "73o": 37, "72o": 35,
  "65o": 40, "64o": 40, "63o": 36, "62o": 34,
  "54o": 38, "53o": 36, "52o": 34,
  "43o": 35, "42o": 33,
  "32o": 32
};

const RANK_ORDER = '23456789TJQKA';

export function handToKey(c1, c2) {
  const r1 = c1[0], r2 = c2[0];
  const s1 = c1[1], s2 = c2[1];
  if (r1 === r2) return r1 + r2;
  const i1 = RANK_ORDER.indexOf(r1);
  const i2 = RANK_ORDER.indexOf(r2);
  const hi = i1 > i2 ? r1 : r2;
  const lo = i1 > i2 ? r2 : r1;
  return hi + lo + (s1 === s2 ? 's' : 'o');
}

export function getWinRate(c1, c2) {
  return POKER_WINRATES[handToKey(c1, c2)] ?? 50;
}
