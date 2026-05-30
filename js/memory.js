/**
 * memory.js — Memory Card System
 *
 * Players earn "memory cards" through cumulative play-throughs.
 * Each card reveals hints about how to trigger a specific storyline.
 * Cards have two hint levels: L1 (cryptic) and L2 (clear).
 * L1 is revealed when the card is first earned.
 * L2 is revealed on the next earn (or spending a second card on same storyline).
 *
 * UI: A floating panel on the start screen + a swipeable carousel modal
 * for selecting which storyline to spend a card on.
 */

const LS_KEY = 'sasr_memory_v1';

// ── Card earn schedule: plays required to earn each card ──
// Cumulative: card 1 at 3 plays, card 2 at 6, card 3 at 10, etc.
const CARD_SCHEDULE = [3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78, 91, 105, 120, 136, 153, 171, 190, 210];

// ── Storyline hint data ──
// Each storyline has: name, category, color theme, icon (CSS-drawn), hints L1 & L2
const STORYLINE_HINTS = {
  // ─── Hidden Storylines ───
  spy: {
    name: '国际特工',
    category: 'hidden',
    color: '#e74c3c',
    accent: '#c0392b',
    gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
    icon: '🕵️',
    iconArt: 'crosshair',
    hints: [
      '「前世的记忆中，那个人血管里流淌着不属于普通人的东西……似乎还需要足够的毅力才能引起他们的注意。」',
      '毅力≥6 + 天赋「隐秘血脉」，18-30岁时触发。'
    ]
  },
  abyss: {
    name: '深渊科技',
    category: 'hidden',
    color: '#8e44ad',
    accent: '#6c3483',
    gradient: 'linear-gradient(135deg, #0d0d1a 0%, #1a0a2e 40%, #2d1b69 100%)',
    icon: '🌀',
    iconArt: 'vortex',
    hints: [
      '「深渊的入口只对最聪明的人敞开……但你还需要一把特殊的钥匙——脑海中闪过的那些不属于已知语言的代码。」',
      '智力≥6 + 天赋「乱码症候群」，19岁以上触发。'
    ]
  },
  meta: {
    name: '第四面墙',
    category: 'hidden',
    color: '#1abc9c',
    accent: '#16a085',
    gradient: 'linear-gradient(135deg, #0a0f0d 0%, #0d1f1a 40%, #1a4a3a 100%)',
    icon: '💊',
    iconArt: 'glitch',
    hints: [
      '「有人看穿了这个世界的本质……但需要超群的智力和洞察力，还有那个总是在耳边响起的奇怪声音。」',
      '智力≥7 + 毅力≥4 + 天赋「奇怪的旁白」，19岁以上触发。进入后有关键选择。'
    ]
  },
  xianxia: {
    name: '修真求道',
    category: 'hidden',
    color: '#f39c12',
    accent: '#d68910',
    gradient: 'linear-gradient(135deg, #1a1400 0%, #2d2200 40%, #4a3800 100%)',
    icon: '⚔️',
    iconArt: 'dao',
    hints: [
      '「仙路飘渺，唯有天赋异禀者方能踏上修真之途。丹田处那股若有若无的气流……你感受到了吗？」',
      '天赋「修仙苗子」，16岁以上即可触发。无属性要求，纯看天赋。'
    ]
  },
  thief: {
    name: '影子协会',
    category: 'hidden',
    color: '#2c3e50',
    accent: '#1a252f',
    gradient: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 40%, #2c2c3e 100%)',
    icon: '🌑',
    iconArt: 'shadow',
    hints: [
      '「影子只接纳那些身手矫健且头脑精明的人……年轻人最受青睐。不需要特殊天赋，但需要全面的能力。」',
      '毅力≥7 + 智力≥7，17-24岁触发。无需特殊天赋，纯属性要求。'
    ]
  },
  hogwarts: {
    name: '霍格沃茨',
    category: 'hidden',
    color: '#9b59b6',
    accent: '#7d3c98',
    gradient: 'linear-gradient(135deg, #1a0a2e 0%, #2d1854 40%, #4a2c6e 100%)',
    icon: '🧙',
    iconArt: 'wand',
    hints: [
      '「魔法学院的入学通知只会寄给有足够金币的年轻人……前提是你在阁楼的旧箱子里发现了那样东西。」',
      '家境>7 + 天赋「老魔杖」，16岁以上触发。'
    ]
  },
  timeloop: {
    name: '时间回环',
    category: 'hidden',
    color: '#3498db',
    accent: '#2980b9',
    gradient: 'linear-gradient(135deg, #0a1628 0%, #0d2137 40%, #1a3a5c 100%)',
    icon: '⏳',
    iconArt: 'loop',
    hints: [
      '「时间的裂缝偶尔会出现在某些特定的年龄段……但触发它的条件至今成谜。」',
      '触发条件较为随机，与特定事件链相关。多次游玩增加遭遇概率。'
    ]
  },

  // ─── Special Storylines ───
  idol: {
    name: '偶像出道',
    category: 'special',
    color: '#e91e63',
    accent: '#c2185b',
    gradient: 'linear-gradient(135deg, #2d0a18 0%, #4a1228 40%, #6e1a3a 100%)',
    icon: '🎤',
    iconArt: 'star',
    hints: [
      '「成为万众瞩目的焦点需要出众的外貌……在最好的年纪被星探发现。」',
      '颜值>10，16-22岁触发。颜值是唯一关键属性，不需要特殊天赋。'
    ]
  },
  poker: {
    name: '地下牌局',
    category: 'special',
    color: '#27ae60',
    accent: '#1e8449',
    gradient: 'linear-gradient(135deg, #0a1a0d 0%, #0d2d14 40%, #1a4a22 100%)',
    icon: '🃏',
    iconArt: 'cards',
    hints: [
      '「赌桌上的传奇需要足够的资本和精明的头脑……年满十八方可入局。」',
      '家境>7 + 智力>7，18岁以上触发。不需要特殊天赋。'
    ]
  },
  party: {
    name: '派对狂魔',
    category: 'special',
    color: '#f1c40f',
    accent: '#d4ac0d',
    gradient: 'linear-gradient(135deg, #1a1800 0%, #2d2800 40%, #4a4000 100%)',
    icon: '🎉',
    iconArt: 'confetti',
    hints: [
      '「社交场上的王者需要极高的社交能力……成年之后才能解锁那个世界。」',
      '社交>9，18岁以上触发。纯社交属性要求，不需要特殊天赋。'
    ]
  },
  esports: {
    name: '职业电竞',
    category: 'special',
    color: '#00bcd4',
    accent: '#0097a7',
    gradient: 'linear-gradient(135deg, #0a1a1e 0%, #0d2d34 40%, #1a4a54 100%)',
    icon: '🎮',
    iconArt: 'controller',
    hints: [
      '「电竞天才需要极高的智力和毅力双修……黄金年龄转瞬即逝。」',
      '智力>8 + 毅力>8，16-22岁触发。双属性高要求，不需要特殊天赋。'
    ]
  },
  fitness: {
    name: '健美巅峰',
    category: 'special',
    color: '#ff5722',
    accent: '#e64a19',
    gradient: 'linear-gradient(135deg, #1a0d0a 0%, #2d140d 40%, #4a221a 100%)',
    icon: '💪',
    iconArt: 'muscle',
    hints: [
      '「健美之路只属于那些身体素质登峰造极的人……」',
      '健康≥10，17岁以上触发。健康是唯一关键，不需要特殊天赋。'
    ]
  },
  chef: {
    name: '校园厨神',
    category: 'special',
    color: '#ff9800',
    accent: '#f57c00',
    gradient: 'linear-gradient(135deg, #1a120a 0%, #2d1e0d 40%, #4a321a 100%)',
    icon: '👨‍🍳',
    iconArt: 'flame',
    hints: [
      '「成为厨神需要毅力、健康和社交的三重修炼……」',
      '毅力≥6 + 健康≥6 + 社交≥5 触发。三属性均衡型，不需要特殊天赋。'
    ]
  },
  band: {
    name: '地下乐队',
    category: 'special',
    color: '#607d8b',
    accent: '#455a64',
    gradient: 'linear-gradient(135deg, #0d1012 0%, #1a2028 40%, #2c3640 100%)',
    icon: '🎸',
    iconArt: 'guitar',
    hints: [
      '「组建乐队需要一定的毅力，而且只有在海外的舞台上才有机会……还需要与生俱来的音乐天赋。」',
      '毅力≥5 + 出国留学 + 天赋「音乐奇才」，18-23岁触发。进入后有关键选择。'
    ]
  },
  influencer: {
    name: '自媒体博主',
    category: 'special',
    color: '#e040fb',
    accent: '#ab47bc',
    gradient: 'linear-gradient(135deg, #1a0d22 0%, #2d1838 40%, #4a2860 100%)',
    icon: '📱',
    iconArt: 'phone',
    hints: [
      '「在社交媒体时代崛起需要颜值和社交双高……趁年轻才有流量。」',
      '颜值≥7 + 社交≥5，16-24岁触发。不需要特殊天赋。'
    ]
  },
  academic: {
    name: '学术深渊',
    category: 'special',
    color: '#5c6bc0',
    accent: '#3f51b5',
    gradient: 'linear-gradient(135deg, #0d0f1a 0%, #1a1e34 40%, #2c3250 100%)',
    icon: '📚',
    iconArt: 'book',
    hints: [
      '「学术的道路需要极高的智力和坚定的毅力……而且必须在海外的学术环境中。」',
      '智力≥8 + 毅力≥5 + 出国留学，18-23岁触发。进入后有关键选择，不需要特殊天赋。'
    ]
  },
};

// All storyline keys in display order
const STORYLINE_ORDER = [
  // Hidden first (more mysterious)
  'spy', 'abyss', 'meta', 'xianxia', 'thief', 'hogwarts', 'timeloop',
  // Then special
  'idol', 'poker', 'party', 'esports', 'fitness', 'chef', 'band', 'influencer', 'academic',
];

// ── Persistence ──

function _load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { totalPlays: 0, cardsEarned: 0, cardsAvailable: 0, revealed: {} };
    return JSON.parse(raw);
  } catch { return { totalPlays: 0, cardsEarned: 0, cardsAvailable: 0, revealed: {} }; }
}

function _save(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}

// ── Public API ──

/** Call when a game ends (state.phase = 'ended'). Increments play count and awards cards. */
export function recordPlaythrough() {
  const data = _load();
  data.totalPlays++;

  // Check if a new card is earned
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

/** Use a card on a storyline to reveal its next hint level. Returns the hint text or null. */
export function useCard(storylineKey) {
  const data = _load();
  if (data.cardsAvailable <= 0) return null;
  const info = STORYLINE_HINTS[storylineKey];
  if (!info) return null;

  const currentLevel = data.revealed[storylineKey] || 0;
  if (currentLevel >= info.hints.length) return null; // fully revealed

  data.cardsAvailable--;
  data.revealed[storylineKey] = currentLevel + 1;
  _save(data);
  return { level: currentLevel + 1, hint: info.hints[currentLevel], storyline: info };
}

/** Get current memory state. */
export function getMemoryState() {
  return _load();
}

/** Get next card threshold info. */
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

/** Get all storyline data for carousel rendering. */
export function getStorylineCards() {
  const data = _load();
  return STORYLINE_ORDER.map(key => {
    const info = STORYLINE_HINTS[key];
    const revealedLevel = data.revealed[key] || 0;
    return {
      key,
      ...info,
      revealedLevel,
      maxLevel: info.hints.length,
      revealedHints: info.hints.slice(0, revealedLevel),
      isFullyRevealed: revealedLevel >= info.hints.length,
      isLocked: revealedLevel === 0,
    };
  });
}

// ── UI: Start Screen Panel ──

export function renderMemoryPanel() {
  const container = document.getElementById('memory-panel');
  if (!container) return;

  const info = getNextCardInfo();
  const cards = getStorylineCards();
  const revealedCount = Object.keys(info.revealed).length;

  // Card count display
  const cardCountEl = container.querySelector('.memory-card-count');
  if (cardCountEl) {
    cardCountEl.textContent = info.cardsAvailable;
    cardCountEl.classList.toggle('has-cards', info.cardsAvailable > 0);
  }

  // Progress text
  const progressEl = container.querySelector('.memory-progress');
  if (progressEl) {
    if (info.nextAt) {
      progressEl.textContent = `再重开 ${info.playsUntilNext} 次可获得记忆卡`;
    } else {
      progressEl.textContent = `已获得全部记忆卡`;
    }
  }

  // Stats
  const statsEl = container.querySelector('.memory-stats');
  if (statsEl) {
    statsEl.textContent = `${info.totalPlays}次重开 · ${revealedCount}/${STORYLINE_ORDER.length}条线索`;
  }
}

// ── UI: Carousel Modal ──

let _carouselIndex = 0;
let _touchStartX = 0;
let _touchDeltaX = 0;
let _isDragging = false;

export function openCarousel() {
  const modal = document.getElementById('memory-modal');
  if (!modal) return;

  const info = getNextCardInfo();
  _carouselIndex = 0;

  _renderCarousel();
  modal.classList.add('open');
  document.body.classList.add('memory-modal-open');

  // Update available count in modal header
  const countEl = modal.querySelector('.mm-available-count');
  if (countEl) countEl.textContent = info.cardsAvailable;
}

export function closeCarousel() {
  const modal = document.getElementById('memory-modal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.classList.remove('memory-modal-open');
}

function _renderCarousel() {
  const track = document.getElementById('mm-track');
  if (!track) return;

  const cards = getStorylineCards();
  const info = getNextCardInfo();

  track.innerHTML = cards.map((card, i) => `
    <div class="mm-card ${card.isLocked ? 'locked' : 'revealed'} ${card.isFullyRevealed ? 'fully-revealed' : ''}"
         data-idx="${i}" data-key="${card.key}"
         style="--card-color:${card.color};--card-accent:${card.accent};--card-gradient:${card.gradient}">
      <div class="mm-card-inner">
        <div class="mm-card-art">
          <div class="mm-card-art-bg"></div>
          <div class="mm-card-art-pattern" data-pattern="${card.iconArt}"></div>
          <div class="mm-card-art-icon">${card.icon}</div>
        </div>
        <div class="mm-card-body">
          <div class="mm-card-category">${card.category === 'hidden' ? '隐藏剧情' : '特殊剧情'}</div>
          <div class="mm-card-name">${card.name}</div>
          ${card.revealedLevel > 0 ? `
            <div class="mm-card-hints">
              ${card.revealedHints.map((h, hi) => `
                <div class="mm-hint mm-hint-l${hi + 1}">
                  <span class="mm-hint-tag">Lv.${hi + 1}</span>
                  <span class="mm-hint-text">${h}</span>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="mm-card-locked-msg">
              <div class="mm-lock-icon">🔒</div>
              <div class="mm-lock-text">使用记忆卡解锁线索</div>
            </div>
          `}
        </div>
        <div class="mm-card-footer">
          ${card.isFullyRevealed ? `
            <div class="mm-card-complete">✦ 线索已全部揭示</div>
          ` : `
            <button class="mm-use-btn" data-key="${card.key}" ${info.cardsAvailable <= 0 ? 'disabled' : ''}>
              ${card.revealedLevel > 0 ? '深入回忆' : '使用记忆卡'}
              ${info.cardsAvailable <= 0 ? '（无可用卡）' : ''}
            </button>
          `}
          <div class="mm-hint-dots">
            ${Array.from({length: card.maxLevel}, (_, di) =>
              `<span class="mm-dot ${di < card.revealedLevel ? 'filled' : ''}"></span>`
            ).join('')}
          </div>
        </div>
      </div>
    </div>
  `).join('');

  _updateCarouselPosition(false);
  _updateIndicator();
}

function _updateCarouselPosition(animate = true) {
  const track = document.getElementById('mm-track');
  if (!track) return;

  const cards = track.querySelectorAll('.mm-card');
  if (!cards.length) return;

  track.style.transition = animate ? 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none';
  track.style.transform = `translateX(calc(-${_carouselIndex * 100}% / 1 + ${_touchDeltaX}px))`;

  // Update active state
  cards.forEach((c, i) => c.classList.toggle('active', i === _carouselIndex));
}

function _updateIndicator() {
  const indicator = document.getElementById('mm-indicator');
  if (!indicator) return;

  const cards = getStorylineCards();
  // Show dots in groups — category separators
  indicator.innerHTML = cards.map((card, i) => {
    const sep = (i === 7) ? '<span class="mm-ind-sep"></span>' : ''; // separator between hidden/special
    return `${sep}<span class="mm-ind-dot ${i === _carouselIndex ? 'active' : ''} ${card.category === 'hidden' ? 'hidden-dot' : 'special-dot'}" data-goto="${i}"></span>`;
  }).join('');
}

function _navigateCarousel(dir) {
  const total = STORYLINE_ORDER.length;
  const next = _carouselIndex + dir;
  if (next < 0 || next >= total) return;
  _carouselIndex = next;
  _updateCarouselPosition(true);
  _updateIndicator();
}

// ── Event Wiring ──

export function initMemoryUI() {
  const panel = document.getElementById('memory-panel');
  const modal = document.getElementById('memory-modal');
  if (!panel || !modal) return;

  // Panel click → open carousel
  panel.addEventListener('click', (e) => {
    if (e.target.closest('.memory-panel-inner')) {
      openCarousel();
    }
  });

  // Close button
  const closeBtn = modal.querySelector('.mm-close');
  if (closeBtn) closeBtn.addEventListener('click', closeCarousel);

  // Backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeCarousel();
  });

  // Arrow navigation
  const prevBtn = modal.querySelector('.mm-nav-prev');
  const nextBtn = modal.querySelector('.mm-nav-next');
  if (prevBtn) prevBtn.addEventListener('click', () => _navigateCarousel(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => _navigateCarousel(1));

  // Indicator dot click
  const indicator = document.getElementById('mm-indicator');
  if (indicator) {
    indicator.addEventListener('click', (e) => {
      const dot = e.target.closest('[data-goto]');
      if (!dot) return;
      _carouselIndex = parseInt(dot.dataset.goto);
      _updateCarouselPosition(true);
      _updateIndicator();
    });
  }

  // Touch/swipe on track
  const track = document.getElementById('mm-track');
  if (track) {
    track.addEventListener('touchstart', (e) => {
      _touchStartX = e.touches[0].clientX;
      _isDragging = true;
      _touchDeltaX = 0;
      track.style.transition = 'none';
    }, { passive: true });

    track.addEventListener('touchmove', (e) => {
      if (!_isDragging) return;
      _touchDeltaX = e.touches[0].clientX - _touchStartX;
      // Resist overdrag at edges
      if ((_carouselIndex === 0 && _touchDeltaX > 0) ||
          (_carouselIndex === STORYLINE_ORDER.length - 1 && _touchDeltaX < 0)) {
        _touchDeltaX *= 0.3;
      }
      _updateCarouselPosition(false);
    }, { passive: true });

    track.addEventListener('touchend', () => {
      _isDragging = false;
      const threshold = 60;
      if (_touchDeltaX < -threshold) _navigateCarousel(1);
      else if (_touchDeltaX > threshold) _navigateCarousel(-1);
      _touchDeltaX = 0;
      _updateCarouselPosition(true);
    });

    // Mouse drag for desktop
    track.addEventListener('mousedown', (e) => {
      _touchStartX = e.clientX;
      _isDragging = true;
      _touchDeltaX = 0;
      track.style.transition = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!_isDragging) return;
      _touchDeltaX = e.clientX - _touchStartX;
      if ((_carouselIndex === 0 && _touchDeltaX > 0) ||
          (_carouselIndex === STORYLINE_ORDER.length - 1 && _touchDeltaX < 0)) {
        _touchDeltaX *= 0.3;
      }
      _updateCarouselPosition(false);
    });

    document.addEventListener('mouseup', () => {
      if (!_isDragging) return;
      _isDragging = false;
      const threshold = 60;
      if (_touchDeltaX < -threshold) _navigateCarousel(1);
      else if (_touchDeltaX > threshold) _navigateCarousel(-1);
      _touchDeltaX = 0;
      _updateCarouselPosition(true);
    });
  }

  // Use card button (delegated)
  modal.addEventListener('click', (e) => {
    const btn = e.target.closest('.mm-use-btn');
    if (!btn || btn.disabled) return;
    const key = btn.dataset.key;
    _handleUseCard(key);
  });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('open')) return;
    if (e.key === 'Escape') closeCarousel();
    else if (e.key === 'ArrowLeft') _navigateCarousel(-1);
    else if (e.key === 'ArrowRight') _navigateCarousel(1);
  });

  // Initial render
  renderMemoryPanel();
}

function _handleUseCard(storylineKey) {
  const result = useCard(storylineKey);
  if (!result) return;

  // Re-render carousel with new state
  _renderCarousel();

  // Update panel
  renderMemoryPanel();

  // Update modal header count
  const modal = document.getElementById('memory-modal');
  const countEl = modal?.querySelector('.mm-available-count');
  if (countEl) {
    const info = getNextCardInfo();
    countEl.textContent = info.cardsAvailable;
  }

  // Flash animation on the card
  const activeCard = document.querySelector(`.mm-card[data-key="${storylineKey}"]`);
  if (activeCard) {
    activeCard.classList.add('mm-card-reveal-anim');
    setTimeout(() => activeCard.classList.remove('mm-card-reveal-anim'), 800);
  }
}

/** Show a "new card earned" toast notification. */
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
