import './alloc.css';

// ── Feasibility spike: 分配属性 (stat allocation) screen under kbone ──────
// Deliberately vanilla JS / manual DOM, matching the real project's style
// (game.js has no framework, just createElement/innerHTML/addEventListener
// scattered across a big render() function). Scope is trimmed down from the
// real screen: no achievement popover, no preset save/import/export, no
// real pixel-avatar renderer — just the part that matters for the spike,
// which is "does kbone handle our actual DOM/CSS/event-listener patterns."
//
// STAT_KEYS / MAX_PER_STAT / ALLOC_TOTAL_BASE mirror engine/constants.js;
// the +/- button logic below is copied verbatim from game.js's real
// click handlers (search "plus-${k}" in game.js) so this spike tests the
// real interaction, not a simplified stand-in.

const STAT_KEYS = ['SOC', 'INT', 'MNY', 'HLT', 'PER', 'APP'];
const STAT_LABELS = { SOC: '社交', INT: '智力', MNY: '家境', HLT: '健康', PER: '毅力', APP: '颜值' };
const MAX_PER_STAT = 10;
const ALLOC_TOTAL = 25;

const state = {
  alloc: { SOC: 0, INT: 0, MNY: 0, HLT: 0, PER: 0, APP: 0 },
};

function buildMarkup() {
  const rows = STAT_KEYS.map(k => `
    <div class="alloc-row">
      <span>${STAT_LABELS[k]}</span>
      <button class="step" id="minus-${k}">−</button>
      <span class="alloc-val" id="alloc-${k}">0</span>
      <button class="step" id="plus-${k}">＋</button>
      <span class="alloc-bonus" id="bonus-${k}"></span>
    </div>`).join('');

  return `
    <div class="creation-step" id="step-alloc">
      <div class="alloc-split">
        <div class="alloc-left">
          <div class="alloc-avatar-wrap-lg">
            <canvas id="alloc-avatar-canvas" width="128" height="192"></canvas>
            <div class="avatar-overlay-controls">
              <div class="avatar-ov-group avatar-ov-sex">
                <button id="sex-male" class="avatar-ov-btn active" title="男">♂</button>
                <button id="sex-female" class="avatar-ov-btn" title="女">♀</button>
              </div>
              <button id="btn-random-appearance" class="avatar-ov-btn" title="随机">🎲</button>
            </div>
            <div class="avatar-ov-hint">属性会实时影响外貌（占位——本 spike 不接入真实 avatar.js 渲染器）</div>
          </div>
        </div>
        <div class="alloc-right">
          <header class="screen-head">
            <h1>分配属性</h1>
            <p class="sub">总共 <strong>${ALLOC_TOTAL}</strong> 点，单项上限 ${MAX_PER_STAT}。</p>
          </header>
          <div class="alloc-banner">剩余点数 <span id="alloc-remaining">${ALLOC_TOTAL}</span></div>
          <div class="alloc-list">${rows}</div>
          <div class="alloc-actions">
            <button class="ghost" id="alloc-random">🎲 随机分配</button>
            <button class="primary" id="alloc-start">确认分配 →</button>
          </div>
        </div>
      </div>
    </div>`;
}

function render() {
  const used = Object.values(state.alloc).reduce((a, b) => a + b, 0);
  const remaining = ALLOC_TOTAL - used;
  document.getElementById('alloc-remaining').textContent = remaining;
  for (const k of STAT_KEYS) {
    document.getElementById(`alloc-${k}`).textContent = state.alloc[k];
  }
}

function drawAvatarPlaceholder() {
  const canvas = document.getElementById('alloc-avatar-canvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#141a26';
  ctx.fillRect(0, 0, 128, 192);
  ctx.fillStyle = '#e6c650';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('avatar', 64, 96);
  ctx.fillText('placeholder', 64, 114);
}

function wireEvents() {
  for (const k of STAT_KEYS) {
    document.getElementById(`plus-${k}`).addEventListener('click', () => {
      const used = Object.values(state.alloc).reduce((a, b) => a + b, 0);
      if (used < ALLOC_TOTAL && state.alloc[k] < MAX_PER_STAT) {
        state.alloc[k] += 1;
        render();
      }
    });
    document.getElementById(`minus-${k}`).addEventListener('click', () => {
      if (state.alloc[k] > 0) {
        state.alloc[k] -= 1;
        render();
      }
    });
  }

  document.getElementById('alloc-random').addEventListener('click', () => {
    for (const k of STAT_KEYS) state.alloc[k] = 0;
    let remaining = ALLOC_TOTAL;
    while (remaining > 0) {
      const availableKeys = STAT_KEYS.filter(k => state.alloc[k] < MAX_PER_STAT);
      if (availableKeys.length === 0) break;
      const k = availableKeys[Math.floor(Math.random() * availableKeys.length)];
      state.alloc[k]++;
      remaining--;
    }
    render();
  });

  document.getElementById('alloc-start').addEventListener('click', () => {
    // real version calls initGame() here; spike just confirms the tap lands
    console.log('confirmed alloc:', JSON.stringify(state.alloc));
  });

  document.getElementById('sex-male').addEventListener('click', (e) => {
    document.getElementById('sex-male').classList.add('active');
    document.getElementById('sex-female').classList.remove('active');
  });
  document.getElementById('sex-female').addEventListener('click', (e) => {
    document.getElementById('sex-female').classList.add('active');
    document.getElementById('sex-male').classList.remove('active');
  });
}

export default function createApp() {
  const container = document.createElement('div');
  container.id = 'app';
  container.innerHTML = buildMarkup();
  document.body.appendChild(container);
  wireEvents();
  drawAvatarPlaceholder();
  render();
  return container;
}
