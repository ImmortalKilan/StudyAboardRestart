// ── Achievement System ─────────────────────────────────────────────────────
// Persistent via localStorage; toasts slide in from bottom-right;
// achievement wall opened via trophy button (top-right).

const STORAGE_KEY = 'studyAbroad_ach_v1';

export const ACHIEVEMENTS = [
  // ── 里程碑 ──────────────────────────────────────────────────────────────
  { id: 'first_play',       name: '人生重来',     icon: '🔄', rarity: 'normal',    cat: '里程碑', desc: '开始了第一次留学重开' },
  { id: 'school_t20',       name: '名校之路',     icon: '🎓', rarity: 'rare',      cat: '里程碑', desc: '成功进入顶尖大学（T20 / G5 / 港三 / 帝大 等）' },
  { id: 'school_expelled',  name: '学业未竟',     icon: '📋', rarity: 'normal',    cat: '里程碑', desc: '被学校开除或遣返回国' },
  { id: 'stat_max',         name: '天赋异禀',     icon: '💪', rarity: 'rare',      cat: '里程碑', desc: '某项基础属性达到了 10 点' },
  { id: 'stat_negative',    name: '人生低谷',     icon: '📉', rarity: 'normal',    cat: '里程碑', desc: '某项基础属性跌入了负数' },
  { id: 'all_hidden',       name: '见过世面',     icon: '👁️', rarity: 'legendary', cat: '里程碑', desc: '解锁了全部隐藏剧情' },

  // ── 感情 ─────────────────────────────────────────────────────────────────
  { id: 'romance_first',    name: '初坠爱河',     icon: '💕', rarity: 'normal',    cat: '感情',   desc: '触发了人生第一段恋爱' },
  { id: 'romance_married',  name: '白头到老',     icon: '💍', rarity: 'rare',      cat: '感情',   desc: '步入了婚姻殿堂' },
  { id: 'romance_sea_king', name: '海王/海后',    icon: '🌊', rarity: 'epic',      cat: '感情',   desc: '成为了游走情场的海王' },
  { id: 'romance_divorced', name: '此情成追忆',   icon: '💔', rarity: 'normal',    cat: '感情',   desc: '经历了一段失败的婚姻' },

  // ── 剧情 ─────────────────────────────────────────────────────────────────
  { id: 'sl_spy',           name: '代号：留学生', icon: '🕵️', rarity: 'epic',      cat: '剧情',   desc: '踏上了国际特工之路' },
  { id: 'sl_xianxia',       name: '踏上修真路',   icon: '🌸', rarity: 'epic',      cat: '剧情',   desc: '踏入了修真世界' },
  { id: 'sl_abyss',         name: '深渊研究员',   icon: '🔬', rarity: 'epic',      cat: '剧情',   desc: '进入了深渊科技机构' },
  { id: 'sl_meta',          name: '破局者',       icon: '📺', rarity: 'epic',      cat: '剧情',   desc: '发现了世界的本质' },
  { id: 'sl_idol',          name: '练习生涯',     icon: '🎤', rarity: 'rare',      cat: '剧情',   desc: '开启了偶像出道之路' },
  { id: 'sl_superstar',     name: '巨星崛起',     icon: '⭐', rarity: 'epic',      cat: '剧情',   desc: '踏上了超级巨星之路' },
  { id: 'sl_streamer',      name: '网红大梦',     icon: '📱', rarity: 'rare',      cat: '剧情',   desc: '开始了网红主播生涯' },
  { id: 'sl_party',         name: '派对狂魔',     icon: '🎉', rarity: 'rare',      cat: '剧情',   desc: '成为了留学圈的派对局长' },
  { id: 'sl_poker',         name: '地下牌局',     icon: '🃏', rarity: 'rare',      cat: '剧情',   desc: '踏入了地下扑克圈' },
  { id: 'sl_esports',       name: '电竞新星',     icon: '🎮', rarity: 'rare',      cat: '剧情',   desc: '踏入了职业电竞赛场' },
  { id: 'sl_wasted',        name: '南柯梦境',     icon: '🌙', rarity: 'rare',      cat: '剧情',   desc: '陷入了颓废的南柯梦' },
  { id: 'sl_worlds',        name: '赛场巅峰',     icon: '🏆', rarity: 'epic',      cat: '剧情',   desc: '踏上了电竞世界赛之路' },
  { id: 'sl_fitness',       name: '铁血健将',     icon: '💪', rarity: 'rare',      cat: '剧情',   desc: '踏上了健美之路' },
  { id: 'sl_chef',          name: '围裙新星',     icon: '👨‍🍳', rarity: 'rare',      cat: '剧情',   desc: '踏入了校园厨神的世界' },
  { id: 'sl_athlete',       name: '运动少年',     icon: '⚽', rarity: 'rare',      cat: '剧情',   desc: '加入了校队，开启运动生涯' },
  { id: 'sl_thief',         name: '影子协会',     icon: '🦊', rarity: 'epic',      cat: '剧情',   desc: '收到了影子协会的邀请' },
  { id: 'sl_hogwarts',      name: '魔法学徒',     icon: '🪄', rarity: 'epic',      cat: '剧情',   desc: '收到了霍格沃茨的入学通知书' },
  { id: 'sl_academic',      name: '学术深渊',     icon: '💻', rarity: 'rare',      cat: '剧情',   desc: '发现了学校考试系统的漏洞' },

  // ── 终局 ─────────────────────────────────────────────────────────────────
  { id: 'end_health',       name: '油尽灯枯',     icon: '💀', rarity: 'normal',    cat: '终局',   desc: '因健康耗尽而离开了人世' },
  { id: 'end_retire',       name: '安然退休',     icon: '🏡', rarity: 'normal',    cat: '终局',   desc: '活到 60 岁，平静退休' },
  { id: 'end_idol',         name: '闪耀登场',     icon: '🌟', rarity: 'epic',      cat: '终局',   desc: '成功以偶像身份出道' },
  { id: 'debut_fail',       name: '遗憾落幕',     icon: '😔', rarity: 'normal',    cat: '终局',   desc: '偶像出道以失败告终' },
  { id: 'end_spy',          name: '特工的荣耀',   icon: '🏅', rarity: 'legendary', cat: '终局',   desc: '圆满完成了国际特工任务' },
  { id: 'end_abyss',        name: '深渊彼岸',     icon: '🌌', rarity: 'legendary', cat: '终局',   desc: '完成了深渊科技剧情' },
  { id: 'end_meta',         name: '第五面墙',     icon: '🔮', rarity: 'legendary', cat: '终局',   desc: '和屏幕另一边的人和解了' },
  { id: 'end_ceo',          name: '商界传奇',     icon: '💼', rarity: 'legendary', cat: '终局',   desc: '成功转型，成为了 CEO' },
  { id: 'end_worlds',       name: '全球冠军',     icon: '🥇', rarity: 'legendary', cat: '终局',   desc: '赢得了电竞世界赛冠军' },
  { id: 'end_xianxia',      name: '羽化登仙',     icon: '✨', rarity: 'legendary', cat: '终局',   desc: '踏入修真之路，最终成仙' },
  { id: 'end_fitness',      name: '健美传奇',     icon: '🏋️', rarity: 'legendary', cat: '终局',   desc: '站上了健美巅峰的舞台' },
  { id: 'end_chef',         name: '三星主厨',     icon: '⭐', rarity: 'legendary', cat: '终局',   desc: '获得了米其林三星评级' },
  { id: 'end_athlete',      name: '体坛之巅',     icon: '🏆', rarity: 'legendary', cat: '终局',   desc: '成为了职业体育的传奇' },
  { id: 'end_thief',        name: '幽灵评级',     icon: '👻', rarity: 'legendary', cat: '终局',   desc: '达到了影子协会最高评级' },
  { id: 'end_hogwarts',     name: '救世之星',     icon: '⚡', rarity: 'legendary', cat: '终局',   desc: '用老魔杖击败了伏地魔' },
  { id: 'end_academic_white', name: '白骑士',    icon: '🛡️', rarity: 'legendary', cat: '终局',   desc: 'CVE上有你的名字——Google Project Zero最年轻的成员' },
  { id: 'end_academic_black', name: 'Ghost',     icon: '👻', rarity: 'legendary', cat: '终局',   desc: '金盆洗手，无人知晓你曾是暗网上的Ghost' },
  { id: 'sl_band',           name: '地下新声',   icon: '🎸', rarity: 'rare',      cat: '剧情',   desc: '加入了一支地下乐队，虽然你只是贝斯手' },
  { id: 'end_band_win',      name: 'Encore!',    icon: '🏆', rarity: 'legendary', cat: '终局',   desc: '在Battle of the Bands中获得冠军，全场高喊Encore' },
  { id: 'end_band_fail',     name: '散场之后',   icon: '🎵', rarity: 'rare',      cat: '终局',   desc: '乐队解散了，但那些日子你永远不会忘' },

  // ── 专业传奇终局 ──────────────────────────────────────────────────────────
  { id: 'end_ee',           name: '半导体教父',   icon: '🔬', rarity: 'legendary', cat: '终局',   desc: '在芯片领域封神，重塑了半导体产业格局' },
  { id: 'end_me',           name: '智造先驱',     icon: '🏭', rarity: 'legendary', cat: '终局',   desc: '成为总工程师或智造独角兽创始人' },
  { id: 'end_bio',          name: '新药教父',     icon: '🧬', rarity: 'legendary', cat: '终局',   desc: '研发出重磅新药，改变了医药行业' },
  { id: 'end_med',          name: '杏林圣手',     icon: '🩺', rarity: 'legendary', cat: '终局',   desc: '成为科室主任或以自己命名了新术式' },
  { id: 'end_law',          name: '法界泰斗',     icon: '⚖️', rarity: 'legendary', cat: '终局',   desc: '成为管理合伙人或首席大检察官' },
  { id: 'end_film',         name: '金棕榈之夜',   icon: '🎬', rarity: 'legendary', cat: '终局',   desc: '作为导演斩获国际顶级电影奖' },
  { id: 'end_cs',           name: '硅谷传奇',     icon: '💻', rarity: 'legendary', cat: '终局',   desc: '成为大厂核心或连续创业传奇' },
  { id: 'end_biz',          name: '金融之王',     icon: '💹', rarity: 'legendary', cat: '终局',   desc: '登顶投行或风投界的巅峰' },
  { id: 'end_sci',          name: '学术巨擘',     icon: '🔭', rarity: 'legendary', cat: '终局',   desc: '以全奖直博身份成为学界泰斗' },
  { id: 'end_art',          name: '传世大家',     icon: '🖋️', rarity: 'legendary', cat: '终局',   desc: '作品跨越时代，成为文学/艺术大师' },
  { id: 'end_music',        name: '乐坛传奇',     icon: '🎵', rarity: 'legendary', cat: '终局',   desc: '在音乐领域达到传奇地位' },

  // ── 跨界彩蛋 ──────────────────────────────────────────────────────────────
  { id: 'easter_rhythm',     name: '节奏大师',     icon: '🎹', rarity: 'epic',      cat: '彩蛋',   desc: '音乐爱好者×CS×日本：做出了上架的音游' },
  { id: 'easter_viral',      name: '病毒式传播',   icon: '📹', rarity: 'epic',      cat: '彩蛋',   desc: '电影爱好者×商科×美国：校园纪录片爆红' },
  { id: 'easter_novelist',   name: '跨界作家',     icon: '📖', rarity: 'epic',      cat: '彩蛋',   desc: '法律爱好者×文艺×英国：法律小说出版' },
  { id: 'easter_coral',      name: '科学影像师',   icon: '🪸', rarity: 'epic',      cat: '彩蛋',   desc: '科学爱好者×电影×澳洲：珊瑚纪录片被BBC转发' },
  { id: 'easter_synth',      name: '声音炼金师',   icon: '🔊', rarity: 'epic',      cat: '彩蛋',   desc: '音乐爱好者×理科×欧洲：物理建模合成器走红' },
  { id: 'easter_medtech',    name: '赛博华佗',     icon: '🧬', rarity: 'epic',      cat: '彩蛋',   desc: '医学爱好者×CS×新加坡：AI辅助诊断获奖' },
  { id: 'easter_courtroom',  name: '模拟大律师',   icon: '⚖️', rarity: 'epic',      cat: '彩蛋',   desc: '法律爱好者×商科×香港：模拟庭审全场最佳' },
  { id: 'easter_nomad',      name: '数字游牧',     icon: '🌍', rarity: 'epic',      cat: '彩蛋',   desc: '科技爱好者×商科×欧洲：远程创业走遍三国' },

  // ── 时间回环 ───────────────────────────────────────────────────────────
  { id: 'sl_timeloop',         name: '既视感',       icon: '🔁', rarity: 'epic',      cat: '剧情',   desc: '时间开始重复了' },
  { id: 'end_timeloop',        name: '阳光的角度',   icon: '☀️', rarity: 'legendary', cat: '终局',   desc: '从时间回环中完美逃出——影子带你回了家' },
  { id: 'end_timeloop_escape', name: '逃离了永恒',   icon: '🚪', rarity: 'legendary', cat: '终局',   desc: '你关掉了游戏。这就是出口。' },
];

let _unlocked = new Set();

// ── Init ──────────────────────────────────────────────────────────────────
export function initAchievements() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _unlocked = new Set(raw ? JSON.parse(raw) : []);
  } catch {
    _unlocked = new Set();
  }
  _setupWallHandlers();
  _updateBadge();
}

function _save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([..._unlocked]));
  } catch { /* storage may be unavailable */ }
}

// ── Unlock ────────────────────────────────────────────────────────────────
let _onUnlock = null;
export function setOnUnlock(fn) { _onUnlock = fn; }

export function unlockAchievement(id) {
  if (_unlocked.has(id)) return false;
  const def = ACHIEVEMENTS.find(a => a.id === id);
  if (!def) return false;

  _unlocked.add(id);
  _save();
  _showToast(def);
  _updateBadge();
  if (_onUnlock) try { _onUnlock(def); } catch (e) {}

  // Combo: unlock "见过世面" when all four hidden storylines done
  if (id !== 'all_hidden' &&
      ['sl_spy', 'sl_xianxia', 'sl_abyss', 'sl_meta', 'sl_thief', 'sl_hogwarts', 'sl_timeloop'].every(x => _unlocked.has(x))) {
    unlockAchievement('all_hidden');
  }
  return true;
}

export function isUnlocked(id) { return _unlocked.has(id); }

// ── Toast notification (slides in from bottom-right) ──────────────────────
function _showToast(def) {
  const container = document.getElementById('ach-toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `ach-toast ach-r-${def.rarity}`;
  toast.innerHTML = `
    <div class="ach-toast-icon">${def.icon}</div>
    <div class="ach-toast-body">
      <div class="ach-toast-label">成就解锁</div>
      <div class="ach-toast-name">${def.name}</div>
      <div class="ach-toast-desc">${def.desc}</div>
    </div>
  `;
  container.appendChild(toast);

  // Slide-in on next frame
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('ach-toast-show')));

  // Slide-out after 4.5 s
  setTimeout(() => {
    toast.classList.remove('ach-toast-show');
    const remove = () => { if (toast.parentNode) toast.parentNode.removeChild(toast); };
    toast.addEventListener('transitionend', remove, { once: true });
    setTimeout(remove, 700); // fallback if transitionend doesn't fire
  }, 4500);
}

// ── Trophy badge count ────────────────────────────────────────────────────
function _updateBadge() {
  const badge = document.getElementById('ach-trophy-badge');
  if (badge) badge.textContent = `${_unlocked.size}/${ACHIEVEMENTS.length}`;
  const startBadge = document.getElementById('ach-trophy-start-badge');
  if (startBadge) startBadge.textContent = `${_unlocked.size}/${ACHIEVEMENTS.length}`;
}

// ── Achievement wall ──────────────────────────────────────────────────────
function _setupWallHandlers() {
  const btn      = document.getElementById('ach-trophy-btn');
  const startBtn = document.getElementById('ach-trophy-start-btn');
  const wall     = document.getElementById('ach-wall');
  const closeBtn = document.getElementById('ach-wall-close');
  if (!wall) return;

  if (btn) btn.addEventListener('click', openAchievementWall);
  if (startBtn) startBtn.addEventListener('click', openAchievementWall);
  if (closeBtn) closeBtn.addEventListener('click', closeAchievementWall);

  // Click on backdrop (not on the panel) closes wall
  wall.addEventListener('click', e => {
    if (e.target === wall) closeAchievementWall();
  });

  // Escape key closes wall
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && wall.classList.contains('ach-wall-open')) {
      closeAchievementWall();
    }
  });
}

export function openAchievementWall() {
  const wall = document.getElementById('ach-wall');
  if (!wall) return;
  _renderWall();
  wall.classList.add('ach-wall-open');
}

export function closeAchievementWall() {
  const wall = document.getElementById('ach-wall');
  if (wall) wall.classList.remove('ach-wall-open');
}

function _renderWall() {
  const grid = document.getElementById('ach-wall-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // Update progress count in header
  const countEl = document.getElementById('ach-wall-count');
  if (countEl) countEl.textContent = `${_unlocked.size} / ${ACHIEVEMENTS.length}`;

  const cats = ['里程碑', '感情', '剧情', '终局', '彩蛋'];
  for (const cat of cats) {
    const items = ACHIEVEMENTS.filter(a => a.cat === cat);
    if (!items.length) continue;

    const section = document.createElement('div');
    section.className = 'ach-section';

    const title = document.createElement('div');
    title.className = 'ach-section-title';
    title.textContent = cat;
    section.appendChild(title);

    const row = document.createElement('div');
    row.className = 'ach-section-items';

    for (const def of items) {
      const done = _unlocked.has(def.id);
      const card = document.createElement('div');
      card.className = `ach-card ach-r-${def.rarity} ${done ? 'ach-unlocked' : 'ach-locked'}`;
      card.innerHTML = `
        <div class="ach-card-icon">${def.icon}</div>
        <div class="ach-card-body">
          <div class="ach-card-name">${def.name}</div>
          <div class="ach-card-desc">${done ? def.desc : '???'}</div>
        </div>
        ${done ? '<div class="ach-card-check">✓</div>' : ''}
      `;
      row.appendChild(card);
    }

    section.appendChild(row);
    grid.appendChild(section);
  }
}
