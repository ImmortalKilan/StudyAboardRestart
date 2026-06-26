/**
 * memory.js — Memory Card System (Grid Collection UI)
 *
 * Players earn "memory cards" through cumulative play-throughs.
 * Each card reveals hints about how to trigger a specific storyline.
 * Cards have two hint levels: L1 (cryptic) and L2 (clear).
 *
 * UI: A ghost button in the top-right bar + a grid collection modal
 * with flip/expand animation for card details.
 */

import { renderAvatar } from './avatar.js';

const LS_KEY = 'sasr_memory_v1';

const CARD_SCHEDULE = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57];

const STORYLINE_HINTS = {
  spy: {
    name: '国际特工', category: 'hidden', color: '#e74c3c', accent: '#c0392b',
    gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
    icon: '🕵️', iconArt: 'crosshair',
    hints: [
      '「前世的记忆中，那个人血管里流淌着不属于普通人的东西……似乎还需要足够的毅力才能引起他们的注意。」',
      '毅力≥6 + 天赋「隐秘血脉」，18-30岁时触发。'
    ]
  },
  abyss: {
    name: '深渊科技', category: 'hidden', color: '#8e44ad', accent: '#6c3483',
    gradient: 'linear-gradient(135deg, #0d0d1a 0%, #1a0a2e 40%, #2d1b69 100%)',
    icon: '🌀', iconArt: 'vortex',
    hints: [
      '「深渊的入口只对最聪明的人敞开……但你还需要一把特殊的钥匙——脑海中闪过的那些不属于已知语言的代码。」',
      '智力≥6 + 天赋「乱码症候群」，19岁以上触发。'
    ]
  },
  meta: {
    name: '第四面墙', category: 'hidden', color: '#1abc9c', accent: '#16a085',
    gradient: 'linear-gradient(135deg, #0a0f0d 0%, #0d1f1a 40%, #1a4a3a 100%)',
    icon: '💊', iconArt: 'glitch',
    hints: [
      '「有人看穿了这个世界的本质……但需要超群的智力和洞察力，还有那个总是在耳边响起的奇怪声音。」',
      '智力≥7 + 毅力≥4 + 天赋「奇怪的旁白」，19岁以上触发。进入后有关键选择。'
    ]
  },
  xianxia: {
    name: '修真求道', category: 'hidden', color: '#f39c12', accent: '#d68910',
    gradient: 'linear-gradient(135deg, #1a1400 0%, #2d2200 40%, #4a3800 100%)',
    icon: '⚔️', iconArt: 'dao',
    hints: [
      '「仙路飘渺，唯有天赋异禀者方能踏上修真之途。丹田处那股若有若无的气流……你感受到了吗？」',
      '天赋「修仙苗子」，16岁以上即可触发。无属性要求，纯看天赋。'
    ]
  },
  thief: {
    name: '影子协会', category: 'hidden', color: '#2c3e50', accent: '#1a252f',
    gradient: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 40%, #2c2c3e 100%)',
    icon: '🌑', iconArt: 'shadow',
    hints: [
      '「影子只接纳那些身手矫健且头脑精明的人……年轻人最受青睐。不需要特殊天赋，但需要全面的能力。」',
      '毅力≥7 + 智力≥7，17-24岁触发。无需特殊天赋，纯属性要求。'
    ]
  },
  hogwarts: {
    name: '霍格沃茨', category: 'hidden', color: '#9b59b6', accent: '#7d3c98',
    gradient: 'linear-gradient(135deg, #1a0a2e 0%, #2d1854 40%, #4a2c6e 100%)',
    icon: '🧙', iconArt: 'wand',
    hints: [
      '「魔法学院的入学通知只会寄给有足够金币的年轻人……前提是你在阁楼的旧箱子里发现了那样东西。」',
      '家境>7 + 天赋「老魔杖」，16岁以上触发。'
    ]
  },
  timeloop: {
    name: '时间回环', category: 'hidden', color: '#3498db', accent: '#2980b9',
    gradient: 'linear-gradient(135deg, #0a1628 0%, #0d2137 40%, #1a3a5c 100%)',
    icon: '⏳', iconArt: 'loop',
    hints: [
      '「时间的裂缝偶尔会出现在某些特定的年龄段……但触发它的条件至今成谜。」',
      '触发条件较为随机，与特定事件链相关。多次游玩增加遭遇概率。'
    ]
  },
  mutant: {
    name: '基因觉醒', category: 'hidden', color: '#e74c8b', accent: '#c2185b',
    gradient: 'linear-gradient(135deg, #1a0a1e 0%, #2d1040 40%, #4a1a6e 100%)',
    icon: '🧠', iconArt: 'brain',
    hints: [
      '「碰触他人的瞬间，不属于你的画面闪过脑海……这需要足够强壮的身体来承受基因的觉醒。」',
      '健康>6 + 天赋「基因突变」，16岁以上触发。'
    ]
  },
  basketball: {
    name: '状元之路', category: 'special', color: '#e65100', accent: '#bf360c',
    gradient: 'linear-gradient(135deg, #1a0d00 0%, #2d1800 40%, #4a2800 100%)',
    icon: '🏀', iconArt: 'ball',
    hints: [
      '「前世的记忆中，那个人在球场上如鱼得水……他的投篮手感似乎是天生的，而且身体条件和意志力也不容小觑。」',
      '健康≥6 + 毅力≥5 + 社交≥3 + 天赋「投篮天赋」，16-23岁触发。'
    ]
  },
  soccer: {
    name: '伟大的左后卫', category: 'special', color: '#2e7d32', accent: '#1b5e20',
    gradient: 'linear-gradient(135deg, #0a1a0d 0%, #0d2d14 40%, #1a4a22 100%)',
    icon: '⚽', iconArt: 'goal',
    hints: [
      '「前世的记忆中，那个人在绿茵场上风驰电掣……他的脚法灵活得不可思议，左右脚一样自如。」',
      '健康≥6 + 毅力≥5 + 社交≥3 + 天赋「盘带天赋」，16-23岁触发。'
    ]
  },
  frisbee: {
    name: 'Huck之神', category: 'special', color: '#00838f', accent: '#006064',
    gradient: 'linear-gradient(135deg, #0a1a1e 0%, #0d2d34 40%, #1a4a54 100%)',
    icon: '🥏', iconArt: 'disc',
    hints: [
      '「前世的记忆中，那个人甩出的飞盘总是稳得离谱……他的爆发力和精准度似乎远超常人。」',
      '健康≥7 + 毅力≥5 + 社交≥3 + 天赋「飞盘天赋」，16-23岁触发。'
    ]
  },
  idol: {
    name: '偶像出道', category: 'special', color: '#e91e63', accent: '#c2185b',
    gradient: 'linear-gradient(135deg, #2d0a18 0%, #4a1228 40%, #6e1a3a 100%)',
    icon: '🎤', iconArt: 'star',
    hints: [
      '「成为万众瞩目的焦点需要出众的外貌……在最好的年纪被星探发现。」',
      '颜值>10，16-22岁触发。颜值是唯一关键属性，不需要特殊天赋。'
    ]
  },
  poker: {
    name: '地下牌局', category: 'special', color: '#27ae60', accent: '#1e8449',
    gradient: 'linear-gradient(135deg, #0a1a0d 0%, #0d2d14 40%, #1a4a22 100%)',
    icon: '🃏', iconArt: 'cards',
    hints: [
      '「赌桌上的传奇需要足够的资本和精明的头脑……年满十八方可入局。」',
      '家境>7 + 智力>7，18岁以上触发。不需要特殊天赋。'
    ]
  },
  party: {
    name: '派对狂魔', category: 'special', color: '#f1c40f', accent: '#d4ac0d',
    gradient: 'linear-gradient(135deg, #1a1800 0%, #2d2800 40%, #4a4000 100%)',
    icon: '🎉', iconArt: 'confetti',
    hints: [
      '「社交场上的王者需要极高的社交能力……成年之后才能解锁那个世界。」',
      '社交>9，18岁以上触发。纯社交属性要求，不需要特殊天赋。'
    ]
  },
  esports: {
    name: '职业电竞', category: 'special', color: '#00bcd4', accent: '#0097a7',
    gradient: 'linear-gradient(135deg, #0a1a1e 0%, #0d2d34 40%, #1a4a54 100%)',
    icon: '🎮', iconArt: 'controller',
    hints: [
      '「电竞天才需要极高的智力和毅力双修……以及像魔王一般的天赋......黄金年龄转瞬即逝。」',
      '智力>8 + 毅力>8，16-22岁触发。双属性高要求，需要「魔王代」天赋。'
    ]
  },
  fitness: {
    name: '健美巅峰', category: 'special', color: '#ff5722', accent: '#e64a19',
    gradient: 'linear-gradient(135deg, #1a0d0a 0%, #2d140d 40%, #4a221a 100%)',
    icon: '💪', iconArt: 'muscle',
    hints: [
      '「健美之路只属于那些身体素质登峰造极的人……」',
      '健康≥10，17岁以上触发。健康是唯一关键，不需要特殊天赋。'
    ]
  },
  chef: {
    name: '校园厨神', category: 'special', color: '#ff9800', accent: '#f57c00',
    gradient: 'linear-gradient(135deg, #1a120a 0%, #2d1e0d 40%, #4a321a 100%)',
    icon: '👨‍🍳', iconArt: 'flame',
    hints: [
      '「成为厨神需要毅力、健康和社交的三重修炼……」',
      '毅力≥6 + 健康≥6 + 社交≥5 触发。三属性均衡型，不需要特殊天赋。'
    ]
  },
  band: {
    name: '地下乐队', category: 'special', color: '#607d8b', accent: '#455a64',
    gradient: 'linear-gradient(135deg, #0d1012 0%, #1a2028 40%, #2c3640 100%)',
    icon: '🎸', iconArt: 'guitar',
    hints: [
      '「组建乐队需要一定的毅力，而且只有在海外的舞台上才有机会……还需要与生俱来的音乐天赋。」',
      '毅力≥5 + 出国留学 + 天赋「音乐奇才」，18-23岁触发。进入后有关键选择。'
    ]
  },
  influencer: {
    name: '自媒体博主', category: 'special', color: '#e040fb', accent: '#ab47bc',
    gradient: 'linear-gradient(135deg, #1a0d22 0%, #2d1838 40%, #4a2860 100%)',
    icon: '📱', iconArt: 'phone',
    hints: [
      '「在社交媒体时代崛起需要颜值和社交双高……趁年轻才有流量。」',
      '颜值≥7 + 社交≥5，16-24岁触发。不需要特殊天赋。'
    ]
  },
  academic: {
    name: '学术深渊', category: 'special', color: '#5c6bc0', accent: '#3f51b5',
    gradient: 'linear-gradient(135deg, #0d0f1a 0%, #1a1e34 40%, #2c3250 100%)',
    icon: '📚', iconArt: 'book',
    hints: [
      '「学术的道路需要极高的智力和坚定的毅力……而且必须在海外的学术环境中。」',
      '智力≥8 + 毅力≥5 + 出国留学，18-23岁触发。进入后有关键选择，不需要特殊天赋。'
    ]
  },
  cheater: {
    name: '代考帝国', category: 'special', color: '#2ecc71', accent: '#27ae60',
    gradient: 'linear-gradient(135deg, #0a1a0d 0%, #1a2d14 40%, #2d4a22 100%)',
    icon: '📝', iconArt: 'pen',
    hints: [
      '「前世的记忆中，那个人把知识变成了生意……需要足够聪明，也需要足够会来事。」',
      '智力≥8 + 社交≥6，出国后18岁以上触发。不需要特殊天赋。'
    ]
  },
  timeslip: {
    name: '时空穿越者', category: 'hidden', color: '#e67e22', accent: '#d35400',
    gradient: 'linear-gradient(135deg, #1a1200 0%, #2d1e00 40%, #4a3200 100%)',
    icon: '🕰️', iconArt: 'hourglass',
    hints: [
      '「前世的记忆里，那个人的意识不属于一个时代……课堂上、图书馆里，总有不属于这个世界的画面闪过。也许需要某种与生俱来的天赋。」',
      '天赋「穿越者」(3025)，17岁以上开始触发裂隙闪回。四次闪回后选择三条历史线之一深入。'
    ]
  },
};

const STORYLINE_ORDER = [
  'spy', 'abyss', 'meta', 'xianxia', 'thief', 'hogwarts', 'timeloop', 'timeslip', 'mutant',
  'basketball', 'soccer', 'frisbee', 'idol', 'poker', 'party', 'esports', 'fitness', 'chef', 'band', 'influencer', 'academic', 'cheater',
];

// ── Persistence ──

function _defaultData() { return { totalPlays: 0, cardsEarned: 0, cardsAvailable: 0, revealed: {} }; }

function _load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return _defaultData();
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return _defaultData();
    data.totalPlays = Number(data.totalPlays) || 0;
    data.cardsEarned = Number(data.cardsEarned) || 0;
    data.cardsAvailable = Number(data.cardsAvailable) || 0;
    if (!data.revealed || typeof data.revealed !== 'object') data.revealed = {};
    // Repair: recalculate cardsEarned from totalPlays if out of sync
    let expected = 0;
    for (let i = 0; i < CARD_SCHEDULE.length; i++) {
      if (data.totalPlays >= CARD_SCHEDULE[i]) expected = i + 1;
      else break;
    }
    if (data.cardsEarned > expected) {
      const excess = data.cardsEarned - expected;
      data.cardsEarned = expected;
      data.cardsAvailable = Math.max(0, data.cardsAvailable - excess);
      _save(data);
    }
    return data;
  } catch { return _defaultData(); }
}

function _save(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}

function _snapshotAvatarState(state) {
  if (!state || typeof state !== 'object') return null;
  const keys = [
    'sex', 'age', 'month', 'monthOfYear', 'HAP', 'HLT', 'MNY', 'INT', 'CHR',
    'profession', 'major', 'hobby', 'storyline', 'relationship', 'hsType',
    '_forceOutfit', 'avatarHairStyle', 'avatarHairColor', 'avatarFace',
  ];
  const snap = {};
  for (const key of keys) {
    const value = state[key];
    if (value !== undefined && value !== null && typeof value !== 'object') snap[key] = value;
  }
  return snap;
}

function _renderLastAvatar(container, avatarState) {
  const canvas = container.querySelector('#memory-last-avatar');
  if (!canvas) return;
  const state = avatarState || { sex: 0, age: 18, HAP: 5, HLT: 5, MNY: 2, profession: '本科生' };
  renderAvatar(canvas, state);
  requestAnimationFrame(() => renderAvatar(canvas, state));
}

// ── Public API ──

/** Call when a game ends (state.phase = 'ended'). Increments play count and awards cards. */
export function recordPlaythrough(finalState = null) {
  const data = _load();
  data.totalPlays = (Number(data.totalPlays) || 0) + 1;
  data.cardsEarned = Number(data.cardsEarned) || 0;
  data.cardsAvailable = Number(data.cardsAvailable) || 0;
  const avatarState = _snapshotAvatarState(finalState);
  if (avatarState) data.lastAvatar = avatarState;

  const nextThreshold = CARD_SCHEDULE[data.cardsEarned] || Infinity;
  if (data.totalPlays >= nextThreshold) {
    data.cardsEarned++;
    data.cardsAvailable++;
    _save(data);
    return { newCard: true, totalCards: data.cardsEarned, available: data.cardsAvailable, totalPlays: data.totalPlays };
  }
  _save(data);
  return { newCard: false, totalCards: data.cardsEarned, available: data.cardsAvailable, totalPlays: data.totalPlays };
}

export function useCard(storylineKey) {
  const data = _load();
  if (data.cardsAvailable <= 0) return null;
  const info = STORYLINE_HINTS[storylineKey];
  if (!info) return null;
  const currentLevel = data.revealed[storylineKey] || 0;
  if (currentLevel >= info.hints.length) return null;
  data.cardsAvailable--;
  data.revealed[storylineKey] = currentLevel + 1;
  _save(data);
  return { level: currentLevel + 1, hint: info.hints[currentLevel], storyline: info };
}

export function getMemoryState() { return _load(); }

export function getNextCardInfo() {
  const data = _load();
  const nextIdx = data.cardsEarned;
  const nextThreshold = CARD_SCHEDULE[nextIdx] || null;
  return {
    totalPlays: data.totalPlays,
    cardsEarned: data.cardsEarned,
    cardsAvailable: data.cardsAvailable,
    nextAt: nextThreshold,
    playsUntilNext: nextThreshold ? nextThreshold - data.totalPlays : null,
    revealed: data.revealed,
  };
}

export function getStorylineCards() {
  const data = _load();
  return STORYLINE_ORDER.map(key => {
    const info = STORYLINE_HINTS[key];
    const revealedLevel = data.revealed[key] || 0;
    return {
      key, ...info, revealedLevel,
      maxLevel: info.hints.length,
      revealedHints: info.hints.slice(0, revealedLevel),
      isFullyRevealed: revealedLevel >= info.hints.length,
      isLocked: revealedLevel === 0,
    };
  });
}

// ── UI: Top-right button ──

export function renderMemoryPanel() {
  const countEl = document.getElementById('memory-btn-count');
  if (!countEl) return;
  const info = getNextCardInfo();
  countEl.textContent = info.cardsAvailable;
  const btn = document.getElementById('memory-btn');
  if (btn) btn.classList.toggle('mm-has-cards', info.cardsAvailable > 0);
}

// ── UI: Grid Collection Modal ──

export function openCarousel() {
  const modal = document.getElementById('memory-modal');
  if (!modal) return;
  _renderGrid();
  modal.classList.add('open');
  document.body.classList.add('memory-modal-open');
  const info = getNextCardInfo();
  const countEl = modal.querySelector('.mm-available-count');
  if (countEl) countEl.textContent = info.cardsAvailable;
}

export function closeCarousel() {
  const modal = document.getElementById('memory-modal');
  if (!modal) return;
  _closeDetail();
  modal.classList.remove('open');
  document.body.classList.remove('memory-modal-open');
}

function _renderGrid() {
  const hiddenGrid = document.getElementById('mm-grid-hidden');
  const specialGrid = document.getElementById('mm-grid-special');
  if (!hiddenGrid || !specialGrid) return;

  const cards = getStorylineCards();
  const hidden = cards.filter(c => c.category === 'hidden');
  const special = cards.filter(c => c.category === 'special');

  hiddenGrid.innerHTML = hidden.map(c => _renderThumb(c)).join('');
  specialGrid.innerHTML = special.map(c => _renderThumb(c)).join('');
}

function _renderThumb(card) {
  const statusClass = card.isFullyRevealed ? 'fully-revealed' : card.isLocked ? 'locked' : 'revealed';
  const dots = Array.from({ length: card.maxLevel }, (_, i) =>
    `<span class="mm-thumb-dot ${i < card.revealedLevel ? 'filled' : ''}"></span>`
  ).join('');

  return `
    <div class="mm-thumb ${statusClass}" data-key="${card.key}"
         style="--card-color:${card.color};--card-accent:${card.accent};--card-gradient:${card.gradient}">
      <div class="mm-thumb-inner">
        <div class="mm-thumb-art">
          <div class="mm-thumb-art-bg"></div>
          <div class="mm-thumb-icon">${card.isLocked ? '🔒' : card.icon}</div>
          ${card.isLocked ? '<div class="mm-thumb-shimmer"></div>' : ''}
        </div>
        <div class="mm-thumb-info">
          <div class="mm-thumb-name">${card.isLocked ? '???' : card.name}</div>
          <div class="mm-thumb-dots">${dots}</div>
        </div>
      </div>
    </div>
  `;
}

// ── Detail expand/flip ──

let _activeDetailKey = null;

function _openDetail(key, thumbEl) {
  const detail = document.getElementById('mm-detail');
  const detailCard = document.getElementById('mm-detail-card');
  if (!detail || !detailCard) return;

  _activeDetailKey = key;
  const cards = getStorylineCards();
  const card = cards.find(c => c.key === key);
  if (!card) return;

  const info = getNextCardInfo();

  detailCard.style.setProperty('--card-color', card.color);
  detailCard.style.setProperty('--card-accent', card.accent);
  detailCard.style.setProperty('--card-gradient', card.gradient);

  detailCard.innerHTML = `
    <div class="mm-detail-inner">
      <button class="mm-detail-close" aria-label="关闭">&times;</button>
      <div class="mm-detail-art">
        <div class="mm-detail-art-bg"></div>
        <div class="mm-detail-icon">${card.icon}</div>
      </div>
      <div class="mm-detail-body">
        <div class="mm-detail-category">${card.category === 'hidden' ? '隐藏剧情' : '特殊剧情'}</div>
        <div class="mm-detail-name">${card.name}</div>
        ${card.revealedLevel > 0 ? `
          <div class="mm-detail-hints">
            ${card.revealedHints.map((h, i) => `
              <div class="mm-detail-hint mm-hint-l${i + 1}">
                <span class="mm-detail-hint-tag">Lv.${i + 1}</span>
                <span class="mm-detail-hint-text">${h}</span>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="mm-detail-locked">
            <div class="mm-detail-locked-text">使用记忆卡解锁线索</div>
          </div>
        `}
      </div>
      <div class="mm-detail-footer">
        ${card.isFullyRevealed ? `
          <div class="mm-detail-complete">✦ 线索已全部揭示</div>
        ` : `
          <button class="mm-use-btn" data-key="${card.key}" ${info.cardsAvailable <= 0 ? 'disabled' : ''}>
            ${card.revealedLevel > 0 ? '深入回忆' : '使用记忆卡'}
            ${info.cardsAvailable <= 0 ? '（无可用卡）' : ''}
          </button>
        `}
        <div class="mm-detail-dots">
          ${Array.from({ length: card.maxLevel }, (_, i) =>
            `<span class="mm-thumb-dot ${i < card.revealedLevel ? 'filled' : ''}"></span>`
          ).join('')}
        </div>
      </div>
    </div>
  `;

  detail.classList.add('open');
}

function _closeDetail() {
  const detail = document.getElementById('mm-detail');
  if (!detail) return;
  detail.classList.remove('open');
  _activeDetailKey = null;
}

function _handleUseCard(storylineKey) {
  const result = useCard(storylineKey);
  if (!result) return;
  _renderGrid();
  renderMemoryPanel();
  const modal = document.getElementById('memory-modal');
  const countEl = modal?.querySelector('.mm-available-count');
  if (countEl) {
    const info = getNextCardInfo();
    countEl.textContent = info.cardsAvailable;
  }
  _openDetail(storylineKey, null);
}

// ── Event Wiring ──

export function initMemoryUI() {
  const btn = document.getElementById('memory-btn');
  const modal = document.getElementById('memory-modal');
  if (!modal) return;

  if (btn) btn.addEventListener('click', () => openCarousel());

  const closeBtn = modal.querySelector('.mm-close');
  if (closeBtn) closeBtn.addEventListener('click', closeCarousel);

  const backdrop = modal.querySelector('.mm-backdrop');
  if (backdrop) backdrop.addEventListener('click', closeCarousel);

  // Grid thumb click → open detail
  modal.addEventListener('click', (e) => {
    const thumb = e.target.closest('.mm-thumb');
    if (thumb) {
      _openDetail(thumb.dataset.key, thumb);
      return;
    }
    // Detail close button
    if (e.target.closest('.mm-detail-close')) {
      _closeDetail();
      return;
    }
    // Detail backdrop
    if (e.target.closest('.mm-detail-backdrop')) {
      _closeDetail();
      return;
    }
    // Use card button
    const useBtn = e.target.closest('.mm-use-btn');
    if (useBtn && !useBtn.disabled) {
      _handleUseCard(useBtn.dataset.key);
      return;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('open')) return;
    if (e.key === 'Escape') {
      if (_activeDetailKey) _closeDetail();
      else closeCarousel();
    }
  });

  renderMemoryPanel();
}

export function showNewCardToast() {
  const toast = document.createElement('div');
  toast.className = 'memory-toast';
  toast.innerHTML = `
    <div class="memory-toast-inner">
      <div class="memory-toast-icon">🃏</div>
      <div class="memory-toast-text">
        <div class="memory-toast-title">获得记忆卡！</div>
        <div class="memory-toast-sub">前世的记忆碎片浮现……</div>
      </div>
    </div>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}
