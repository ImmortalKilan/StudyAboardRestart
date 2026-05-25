// ── Story Flowchart — Radial Star Map ───────────────────────────────────────
// "命运星图" layout: university at center, storylines radiate outward.
// - Nebula fog for unexplored regions (feTurbulence + organic blobs)
// - Polar-orbit particles per region
// - Curved edges that bow outward from center
// - 3-tier cascade reveal animation
// - Hover tooltips with fuzzy hints

import { isUnlocked, ACHIEVEMENTS } from './achievements.js';

let _chartData = null;
let _container = null;
let _svg = null;
let _nodeMap = {};
let _regionMap = {};
let _animating = false;
const STORAGE_KEY = 'studyAbroad_fc_v1';

let _fcUnlocked = new Set();
let _sessionNewUnlocks = 0;

function _loadFcState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _fcUnlocked = new Set(raw ? JSON.parse(raw) : []);
  } catch { _fcUnlocked = new Set(); }
}

function _saveFcState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([..._fcUnlocked])); } catch {}
}

export function unlockFlowchartNode(nodeId) {
  if (!_fcUnlocked.has(nodeId)) {
    _fcUnlocked.add(nodeId);
    _sessionNewUnlocks++;
    _saveFcState();
  }
}

export function resetSessionUnlocks() { _sessionNewUnlocks = 0; }
export function getSessionUnlocks() { return _sessionNewUnlocks; }

function _isNodeUnlocked(node) {
  if (node.achId && isUnlocked(node.achId)) return true;
  if (_fcUnlocked.has(node.id)) return true;
  return false;
}

function _isRegionExplored(region) {
  return region.nodes.some(n => _isNodeUnlocked(n));
}

// ── Data loading ────────────────────────────────────────────────────────────
export async function loadFlowchartData() {
  if (_chartData) return _chartData;
  const resp = await fetch('data/flowchart.json');
  _chartData = await resp.json();
  _nodeMap = {};
  _regionMap = {};
  for (const r of _chartData.regions) {
    _regionMap[r.id] = r;
    for (const n of r.nodes) {
      _nodeMap[n.id] = n;
      n._region = r;
    }
  }
  return _chartData;
}

// ── Colors ──────────────────────────────────────────────────────────────────
function _rarityForNode(node) {
  if (!node.achId) return 'normal';
  const def = ACHIEVEMENTS.find(a => a.id === node.achId);
  return def ? def.rarity : 'normal';
}

const RARITY_COLORS = {
  normal:    { glow: '#d4a056', fill: '#3d2e1a', stroke: '#d4a056' },
  rare:      { glow: '#56b8d4', fill: '#1a2e3d', stroke: '#56b8d4' },
  epic:      { glow: '#b456d4', fill: '#2e1a3d', stroke: '#b456d4' },
  legendary: { glow: '#ffd700', fill: '#3d3a1a', stroke: '#ffd700' },
};

const LOCKED_COLOR = { fill: '#111118', stroke: '#28283a' };

// ── Layout constants ────────────────────────────────────────────────────────
const CX = 1400, CY = 1300;
const NODE_W = 120, NODE_H = 36;
const PAD = 80;

const _isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);

// ── Region atmosphere config ────────────────────────────────────────────────
const REGION_PARTICLES = {
  origin:          { color: '#ffffff', color2: '#d4a056', count: 6,  speed: 0.25, size: [1.5, 3] },
  highschool:      { color: '#88aaff', color2: '#aaccff', count: 8,  speed: 0.3,  size: [1.5, 3] },
  country:         { color: '#4499ff', color2: '#66ccff', count: 10, speed: 0.3,  size: [2, 3.5] },
  school:          { color: '#44ddaa', color2: '#88ffcc', count: 14, speed: 0.35, size: [2, 4] },
  career_star:     { color: '#ffcc00', color2: '#ffdd55', count: 14, speed: 0.4,  size: [2, 4] },
  career_shadow:   { color: '#ff3355', color2: '#ff6688', count: 14, speed: 0.5,  size: [2, 4.5] },
  career_branch:   { color: '#ff8833', color2: '#ffaa55', count: 10, speed: 0.4,  size: [2, 3.5] },
  endings_star:    { color: '#ffaa33', color2: '#ffdd88', count: 12, speed: 0.4,  size: [2, 4] },
  endings_shadow:  { color: '#cc2244', color2: '#ff5577', count: 10, speed: 0.45, size: [2, 4] },
  endings_peak:    { color: '#88ddff', color2: '#bbffff', count: 14, speed: 0.35, size: [2, 4.5] },
  endings_fate:    { color: '#d4a056', color2: '#ffcc77', count: 8,  speed: 0.3,  size: [2, 3.5] },
  romance:         { color: '#ff4488', color2: '#ff88bb', count: 10, speed: 0.3,  size: [2, 4] },
  milestones:      { color: '#d4a056', color2: '#ffcc77', count: 6,  speed: 0.25, size: [2, 3] },
  easter:          { color: '#33ddbb', color2: '#77ffdd', count: 10, speed: 0.5,  size: [2, 4] },
};

// ── Nebula tint per region (for fog inner glow) ─────────────────────────────
const NEBULA_TINT = {
  origin:        '#d4a056',
  highschool:    '#6688cc',
  country:       '#3366aa',
  school:        '#33aa77',
  career_star:   '#cc9900',
  career_shadow: '#991133',
  career_branch: '#cc6622',
  endings_star:  '#cc8822',
  endings_shadow:'#881133',
  endings_peak:  '#5599cc',
  endings_fate:  '#aa8844',
  romance:       '#cc3366',
  milestones:    '#aa7733',
  easter:        '#22aa88',
};

// ── Fuzzy hint text for locked nodes ────────────────────────────────────────
const NODE_HINTS = {
  n_hs_intl:    '通往海外的跳板，从这里开始',
  n_hs_normal:  '千军万马过独木桥',
  n_us:         '大洋彼岸的自由之地',
  n_uk:         '雾都与红砖的召唤',
  n_au:         '南半球的阳光在等你',
  n_eu:         '古老大陆的浪漫与严谨',
  n_hk:         '维港灯火，近在咫尺',
  n_jp:         '樱花国度的求学路',
  n_sg:         '赤道上的花园城市',
  n_top:        '金字塔尖的入场券',
  n_mid:        '稳扎稳打的选择',
  n_low:        '起点低不代表终点低',
  n_expelled:   '并非所有旅途都能走到终点',
  n_love:       '心动是不讲道理的',
  n_married:    '当两个人决定共度余生',
  n_seaking:    '情场里翻涌的人',
  n_divorced:   '有些故事终究要画上句号',
  n_sl_idol:    '当聚光灯为你亮起……',
  n_sl_esports: '屏幕那头闪烁的胜负',
  n_sl_fitness: '钢铁是怎样炼成的',
  n_sl_chef:    '烟火气里藏着的野心',
  n_sl_athlete: '汗水浇灌的赛道',
  n_sl_party:   '夜色下永不停歇的人',
  n_sl_spy:     '命运在暗处低语',
  n_sl_xianxia: '天地间有不可说之事',
  n_sl_abyss:   '深处传来奇异的回响',
  n_sl_meta:    '时间为什么是一个月一个月跳的？',
  n_sl_thief:   '月光下有人无声地行走',
  n_sl_hogwarts:'猫头鹰带来了一封信',
  n_sl_superstar:'光芒之上还有更高的天空',
  n_sl_streamer: '镜头前的人生也是人生',
  n_sl_poker:   '暗流涌动的牌桌',
  n_sl_worlds:  '站在世界的聚光灯下',
  n_sl_wasted:  '深夜之后是更深的夜',
  n_end_idol:     '万人合唱你名字的那一刻',
  n_end_idol_fail:'不是所有梦都能被照亮',
  n_end_worlds:   '举起奖杯的人只有一个',
  n_end_fitness:  '站在最高领奖台上的身影',
  n_end_chef:     '味蕾之上的至高评价',
  n_end_athlete:  '奖牌背面写着多少汗水',
  n_end_ceo:      '从校园到商业帝国的跨越',
  n_end_spy:      '功成身退，无人知晓',
  n_end_xianxia:  '大道三千，殊途同归',
  n_end_abyss:    '当你凝视深渊……',
  n_end_meta:     '谢谢你陪我走到这里',
  n_end_thief:    '最好的猎手从不留下痕迹',
  n_end_hogwarts: '最终决战，光明终将到来',
  n_end_health:   '灯火渐渐黯淡',
  n_end_retire:   '平淡也是一种圆满',
  n_all_hidden:   '当所有暗门都被推开之后',
  n_stat_max:     '某种天赋被推向了极致',
  n_stat_neg:     '坠落也是一种经历',
  n_end_ee:       '芯片上刻着你的名字',
  n_end_me:       '齿轮与钢铁的交响曲',
  n_end_bio:      '微观世界里的救世者',
  n_end_med:      '白大褂下跳动的仁心',
  n_end_law:      '法槌落下的重量',
  n_end_film:     '银幕上永恒的那束光',
  n_end_cs:       '01的尽头是什么',
  n_end_biz:      '数字与人心的博弈',
  n_end_sci:      '真理不在意有没有人鼓掌',
  n_end_art:      '笔墨之间藏着整个宇宙',
  n_end_music:    '音符里有一个完整的世界',
  n_sl_academic:  '代码深处藏着不该看到的东西',
  n_end_academic_white: '键盘上的正义值得被铭记',
  n_end_academic_black: '最好的黑客从不留下痕迹',
  n_sl_band: '地下室里的低频震动，是梦想的声音',
  n_end_band_win: '全场高喊Encore，贝斯手终于被记住了',
  n_end_band_fail: '琴盒上贴满了贴纸，每一张都是回忆',
  n_easter_rhythm:   '当两种截然不同的节奏碰撞',
  n_easter_viral:    '一夜之间，所有人都在转发',
  n_easter_novelist: '键盘上敲出另一个世界',
  n_easter_coral:    '镜头对准了海底深处',
  n_easter_synth:    '用电流编织旋律',
  n_easter_medtech:  '当代码学会治病',
  n_easter_courtroom:'法庭上的意外角色',
  n_easter_nomad:    '行李箱就是整个办公室',
};

// ── SVG Helpers ─────────────────────────────────────────────────────────────
function _svgEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// ── Edge helpers ────────────────────────────────────────────────────────────
function _nodeCenter(n) {
  return { x: n.x + PAD + NODE_W / 2, y: n.y + PAD + NODE_H / 2 };
}

function _isEntryCorridor(n) {
  return n.x + NODE_W / 2 < CX - 200;
}

function _makeEdgePath(from, to) {
  const a = _nodeCenter(from);
  const b = _nodeCenter(to);

  if (_isEntryCorridor(from) && _isEntryCorridor(to)) {
    const cx = (a.x + b.x) / 2;
    return `M${a.x},${a.y} C${cx},${a.y} ${cx},${b.y} ${b.x},${b.y}`;
  }

  if (_isEntryCorridor(from) && !_isEntryCorridor(to)) {
    const cx1 = a.x + (b.x - a.x) * 0.4;
    const cy1 = a.y;
    const cx2 = a.x + (b.x - a.x) * 0.6;
    const cy2 = b.y;
    return `M${a.x},${a.y} C${cx1},${cy1} ${cx2},${cy2} ${b.x},${b.y}`;
  }

  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const pcx = CX + PAD;
  const pcy = CY + PAD;
  const dx = mx - pcx;
  const dy = my - pcy;
  const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
  const edgeLen = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  const bow = Math.min(18 + edgeLen * 0.04, 55);
  const cpx = mx + (dx / dist) * bow;
  const cpy = my + (dy / dist) * bow;
  return `M${a.x},${a.y} Q${cpx},${cpy} ${b.x},${b.y}`;
}

// ── Nebula fog helpers ──────────────────────────────────────────────────────
function _regionBounds(region) {
  let x1 = Infinity, y1 = Infinity, x2 = 0, y2 = 0;
  for (const n of region.nodes) {
    if (n.x < x1) x1 = n.x;
    if (n.y < y1) y1 = n.y;
    if (n.x + NODE_W > x2) x2 = n.x + NODE_W;
    if (n.y + NODE_H > y2) y2 = n.y + NODE_H;
  }
  return {
    cx: (x1 + x2) / 2 + PAD,
    cy: (y1 + y2) / 2 + PAD,
    rx: (x2 - x1) / 2 + 60,
    ry: (y2 - y1) / 2 + 50,
  };
}

function _buildNebulaGroup(region, defs, seedBase) {
  const g = _svgEl('g', { class: 'fc-nebula-group', 'data-region': region.id });
  const b = _regionBounds(region);
  const tint = NEBULA_TINT[region.id] || '#444466';
  const seed = seedBase + region.id.length * 7;

  if (_isMobile) {
    const rect = _svgEl('rect', {
      x: b.cx - b.rx - 10, y: b.cy - b.ry - 10,
      width: (b.rx + 10) * 2, height: (b.ry + 10) * 2,
      rx: 20,
      fill: 'rgba(8,8,16,0.88)',
      class: 'fc-nebula-mobile',
    });
    g.appendChild(rect);
  } else {
    const filterId = `nebula-${region.id}`;
    const filter = _svgEl('filter', {
      id: filterId, x: '-30%', y: '-30%', width: '160%', height: '160%',
    });
    const turb = _svgEl('feTurbulence', {
      type: 'fractalNoise', baseFrequency: '0.018 0.024',
      numOctaves: '4', seed: String(seed), result: 'noise',
    });
    const disp = _svgEl('feDisplacementMap', {
      in: 'SourceGraphic', in2: 'noise', scale: '22',
      xChannelSelector: 'R', yChannelSelector: 'G', result: 'displaced',
    });
    const blur = _svgEl('feGaussianBlur', {
      in: 'displaced', stdDeviation: '6', result: 'blurred',
    });
    filter.appendChild(turb);
    filter.appendChild(disp);
    filter.appendChild(blur);
    defs.appendChild(filter);

    const outerRx = b.rx * 1.35;
    const outerRy = b.ry * 1.35;
    const outer = _svgEl('ellipse', {
      cx: b.cx, cy: b.cy, rx: outerRx, ry: outerRy,
      fill: 'rgba(6,6,14,0.55)', filter: `url(#${filterId})`,
      class: 'fc-nebula-outer',
    });
    g.appendChild(outer);

    const mid = _svgEl('ellipse', {
      cx: b.cx + (Math.sin(seed) * 8), cy: b.cy + (Math.cos(seed) * 6),
      rx: b.rx * 1.05, ry: b.ry * 1.05,
      fill: 'rgba(8,8,18,0.7)', filter: `url(#${filterId})`,
      class: 'fc-nebula-mid',
    });
    g.appendChild(mid);

    const core = _svgEl('ellipse', {
      cx: b.cx, cy: b.cy, rx: b.rx * 0.6, ry: b.ry * 0.6,
      fill: tint, opacity: '0.08',
      class: 'fc-nebula-core',
    });
    g.appendChild(core);

    for (let i = 0; i < 3; i++) {
      const angle = (seed * 37 + i * 120) % 360;
      const rad = angle * Math.PI / 180;
      const wx = b.cx + Math.cos(rad) * b.rx * 0.8;
      const wy = b.cy + Math.sin(rad) * b.ry * 0.8;
      const wisp = _svgEl('ellipse', {
        cx: wx, cy: wy,
        rx: 20 + i * 8, ry: 6 + i * 2,
        fill: 'rgba(6,6,14,0.4)',
        transform: `rotate(${angle}, ${wx}, ${wy})`,
        class: 'fc-nebula-wisp',
      });
      wisp.style.setProperty('--wisp-delay', `${i * -2.5}s`);
      g.appendChild(wisp);
    }
  }

  const qm = _svgEl('text', {
    x: b.cx, y: b.cy,
    'text-anchor': 'middle', 'dominant-baseline': 'middle',
    class: 'fc-fog-question',
  });
  qm.textContent = '?';
  g.appendChild(qm);

  return g;
}

// ── Render ───────────────────────────────────────────────────────────────────
export function renderFlowchart(containerId) {
  _loadFcState();
  _container = document.getElementById(containerId);
  if (!_container || !_chartData) return;
  _container.innerHTML = '';

  let maxX = 0, maxY = 0;
  for (const r of _chartData.regions) {
    for (const n of r.nodes) {
      if (n.x + NODE_W > maxX) maxX = n.x + NODE_W;
      if (n.y + NODE_H > maxY) maxY = n.y + NODE_H;
    }
  }
  const svgW = maxX + PAD * 2;
  const svgH = maxY + PAD * 2;

  _svg = _svgEl('svg', {
    width: svgW, height: svgH,
    viewBox: `0 0 ${svgW} ${svgH}`,
    class: 'fc-svg',
  });

  // ── Defs ──
  const defs = _svgEl('defs');

  if (!_isMobile) {
    for (const [rarity, colors] of Object.entries(RARITY_COLORS)) {
      const filter = _svgEl('filter', { id: `glow-${rarity}`, x: '-50%', y: '-50%', width: '200%', height: '200%' });
      const flood = _svgEl('feFlood', { 'flood-color': colors.glow, 'flood-opacity': '0.6', result: 'flood' });
      const comp = _svgEl('feComposite', { in: 'flood', in2: 'SourceGraphic', operator: 'in', result: 'masked' });
      const blur = _svgEl('feGaussianBlur', { in: 'masked', stdDeviation: '4', result: 'blur' });
      const merge = _svgEl('feMerge');
      merge.appendChild(_svgEl('feMergeNode', { in: 'blur' }));
      merge.appendChild(_svgEl('feMergeNode', { in: 'SourceGraphic' }));
      filter.appendChild(flood); filter.appendChild(comp); filter.appendChild(blur); filter.appendChild(merge);
      defs.appendChild(filter);
    }

    const edgeGlow = _svgEl('filter', { id: 'edge-flow', x: '-10%', y: '-10%', width: '120%', height: '120%' });
    edgeGlow.appendChild(_svgEl('feGaussianBlur', { stdDeviation: '2', result: 'glow' }));
    const em = _svgEl('feMerge');
    em.appendChild(_svgEl('feMergeNode', { in: 'glow' }));
    em.appendChild(_svgEl('feMergeNode', { in: 'SourceGraphic' }));
    edgeGlow.appendChild(em);
    defs.appendChild(edgeGlow);
  }

  _svg.appendChild(defs);

  // ── Layer 0: Center ring decoration (desktop only) ──
  if (!_isMobile) {
    const ringGroup = _svgEl('g', { class: 'fc-center-rings', opacity: '0.12' });
    for (const r of [200, 550, 880]) {
      ringGroup.appendChild(_svgEl('circle', {
        cx: CX + PAD, cy: CY + PAD, r,
        fill: 'none', stroke: '#d4a056',
        'stroke-width': '0.5', 'stroke-dasharray': '3 8',
      }));
    }
    _svg.appendChild(ringGroup);
  }

  // ── Layer 1: Particles (desktop only) ──
  if (!_isMobile) {
    const particleGroup = _svgEl('g', { class: 'fc-particles' });
    for (const r of _chartData.regions) {
      const pConfig = REGION_PARTICLES[r.id];
      if (!pConfig) continue;
      const explored = _isRegionExplored(r);
      const count = explored ? pConfig.count : Math.ceil(pConfig.count * 0.3);
      const opBase = explored ? 0.2 : 0.06;
      const opRange = explored ? 0.4 : 0.1;

      const b = _regionBounds(r);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random();
        const px = b.cx + Math.cos(angle) * b.rx * dist * 1.2;
        const py = b.cy + Math.sin(angle) * b.ry * dist * 1.2;
        const pr = pConfig.size[0] + Math.random() * (pConfig.size[1] - pConfig.size[0]);
        const color = Math.random() > 0.5 ? pConfig.color : pConfig.color2;
        const dur = (4 + Math.random() * 5) / pConfig.speed;

        const orbitR = 15 + Math.random() * 35;
        const circle = _svgEl('circle', {
          cx: px, cy: py, r: explored ? pr : pr * 0.7,
          fill: color,
          opacity: opBase + Math.random() * opRange,
          class: 'fc-particle',
        });
        circle.style.setProperty('--orbit-r', `${orbitR}px`);
        circle.style.setProperty('--orbit-dur', `${dur}s`);
        circle.style.setProperty('--orbit-delay', `${-Math.random() * dur}s`);
        particleGroup.appendChild(circle);
      }
    }
    _svg.appendChild(particleGroup);
  }

  // ── Layer 2: Edges ──
  const edgeGroup = _svgEl('g', { class: 'fc-edges' });
  for (const edge of _chartData.edges) {
    const fromNode = _nodeMap[edge.from];
    const toNode = _nodeMap[edge.to];
    if (!fromNode || !toNode) continue;

    const bothUnlocked = _isNodeUnlocked(fromNode) && _isNodeUnlocked(toNode);
    const d = _makeEdgePath(fromNode, toNode);

    const path = _svgEl('path', {
      d,
      class: bothUnlocked ? 'fc-edge-lit' : 'fc-edge-dim',
      fill: 'none',
      'stroke-width': bothUnlocked ? '2' : '1',
    });
    if (bothUnlocked && !_isMobile) {
      path.setAttribute('filter', 'url(#edge-flow)');
    }
    edgeGroup.appendChild(path);
  }
  _svg.appendChild(edgeGroup);

  // ── Layer 3: Nebula fog for unexplored regions ──
  const fogGroup = _svgEl('g', { class: 'fc-fog' });
  let seedIdx = 0;
  for (const r of _chartData.regions) {
    if (_isRegionExplored(r)) continue;
    fogGroup.appendChild(_buildNebulaGroup(r, defs, seedIdx));
    seedIdx += 13;
  }
  _svg.appendChild(fogGroup);

  // ── Layer 4: Region labels ──
  const labelGroup = _svgEl('g', { class: 'fc-labels' });
  for (const r of _chartData.regions) {
    const b = _regionBounds(r);
    const explored = _isRegionExplored(r);
    const lbl = _svgEl('text', {
      x: b.cx,
      y: b.cy - b.ry - 10,
      class: explored ? 'fc-region-label fc-explored' : 'fc-region-label',
      'text-anchor': 'middle',
    });
    lbl.textContent = (explored && r.labelRevealed) ? r.labelRevealed : r.label;
    labelGroup.appendChild(lbl);
  }
  _svg.appendChild(labelGroup);

  // ── Layer 5: Nodes ──
  const nodeGroup = _svgEl('g', { class: 'fc-nodes' });
  for (const r of _chartData.regions) {
    for (const n of r.nodes) {
      const unlocked = _isNodeUnlocked(n);
      const regionExplored = _isRegionExplored(r);
      const rarity = _rarityForNode(n);
      const colors = unlocked ? RARITY_COLORS[rarity] : LOCKED_COLOR;

      const g = _svgEl('g', {
        class: `fc-node ${unlocked ? 'fc-unlocked' : 'fc-locked'} fc-rarity-${rarity}`,
        'data-id': n.id,
        'data-rarity': rarity,
        transform: `translate(${n.x + PAD}, ${n.y + PAD})`,
      });

      const rect = _svgEl('rect', {
        width: NODE_W, height: NODE_H, rx: 8,
        fill: colors.fill, stroke: colors.stroke,
        'stroke-width': unlocked ? '2' : '1',
      });
      if (unlocked && !_isMobile) rect.setAttribute('filter', `url(#glow-${rarity})`);
      g.appendChild(rect);

      const text = _svgEl('text', {
        x: NODE_W / 2, y: NODE_H / 2 + 1,
        class: 'fc-node-text',
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
      });

      if (unlocked) {
        text.textContent = n.label;
        text.setAttribute('fill', colors.glow);
      } else if (regionExplored) {
        text.textContent = '? ? ?';
        text.setAttribute('fill', '#3a3a50');
      } else {
        text.textContent = '';
        text.setAttribute('fill', '#222');
      }
      g.appendChild(text);

      if (!unlocked && regionExplored) {
        const lockIcon = _svgEl('text', {
          x: NODE_W / 2, y: NODE_H / 2 + 1,
          class: 'fc-lock-icon',
          'text-anchor': 'middle', 'dominant-baseline': 'middle',
          fill: '#2a2a3a', 'font-size': '14',
        });
        lockIcon.textContent = '🔒';
        g.appendChild(lockIcon);

        if (!_isMobile) {
          const pulseRect = _svgEl('rect', {
            width: NODE_W, height: NODE_H, rx: 8,
            fill: 'none', stroke: '#28283a', 'stroke-width': '1',
            class: 'fc-locked-pulse',
          });
          g.appendChild(pulseRect);
        }
      }

      nodeGroup.appendChild(g);
    }
  }
  _svg.appendChild(nodeGroup);

  _setupTooltips();
  _container.appendChild(_svg);
  _renderStats();
}

// ── Tooltips ────────────────────────────────────────────────────────────────
function _setupTooltips() {
  if (!_svg) return;
  const existing = document.getElementById('fc-tooltip');
  if (existing) existing.remove();

  const tooltip = document.createElement('div');
  tooltip.id = 'fc-tooltip';
  tooltip.className = 'fc-tooltip';
  tooltip.style.display = 'none';

  const panel = document.querySelector('.fc-panel');
  if (panel) panel.appendChild(tooltip);

  _svg.querySelectorAll('.fc-node').forEach(nodeEl => {
    const nodeId = nodeEl.getAttribute('data-id');
    const node = _nodeMap[nodeId];
    if (!node) return;

    nodeEl.addEventListener('mouseenter', () => {
      if (_onHoverSfx) _onHoverSfx();
      const unlocked = _isNodeUnlocked(node);
      const rarity = _rarityForNode(node);
      const colors = RARITY_COLORS[rarity];

      let html = '';
      if (unlocked) {
        const def = node.achId ? ACHIEVEMENTS.find(a => a.id === node.achId) : null;
        html = `<div class="fc-tip-name" style="color:${colors.glow}">${node.label}</div>`;
        if (def) html += `<div class="fc-tip-desc">${def.desc}</div>`;
        html += `<div class="fc-tip-rarity fc-tip-r-${rarity}">${{normal:'普通',rare:'稀有',epic:'史诗',legendary:'传说'}[rarity]}</div>`;
      } else {
        const hint = NODE_HINTS[nodeId] || '未知的命运节点';
        html = `<div class="fc-tip-locked">🔒 未解锁</div>`;
        html += `<div class="fc-tip-hint">${hint}</div>`;
      }

      tooltip.innerHTML = html;
      tooltip.style.display = 'block';
      const panelRect = panel.getBoundingClientRect();
      const nodeRect = nodeEl.getBoundingClientRect();
      const tx = nodeRect.left + nodeRect.width / 2 - panelRect.left;
      const ty = nodeRect.top - panelRect.top - 8;
      tooltip.style.left = tx + 'px';
      tooltip.style.top = ty + 'px';
      tooltip.classList.add('fc-tooltip-show');
    });

    nodeEl.addEventListener('mouseleave', () => {
      tooltip.classList.remove('fc-tooltip-show');
      tooltip.style.display = 'none';
    });
  });
}

// ── Stats & Legend ───────────────────────────────────────────────────────────
function _renderStats() {
  const statsEl = document.getElementById('fc-stats');
  if (!statsEl) return;
  let total = 0, unlocked = 0;
  for (const r of _chartData.regions) {
    for (const n of r.nodes) {
      total++;
      if (_isNodeUnlocked(n)) unlocked++;
    }
  }
  const pct = total > 0 ? Math.round(unlocked / total * 100) : 0;
  statsEl.textContent = `已探索 ${unlocked}/${total} 个节点（${pct}%）`;
  _renderLegend();
}

function _renderLegend() {
  const panel = document.querySelector('.fc-panel');
  if (!panel || panel.querySelector('.fc-legend')) return;
  const legend = document.createElement('div');
  legend.className = 'fc-legend';
  legend.innerHTML = `
    <span class="fc-legend-item"><span class="fc-legend-dot" style="background:${RARITY_COLORS.normal.glow}"></span>普通</span>
    <span class="fc-legend-item"><span class="fc-legend-dot" style="background:${RARITY_COLORS.rare.glow}"></span>稀有</span>
    <span class="fc-legend-item"><span class="fc-legend-dot" style="background:${RARITY_COLORS.epic.glow}"></span>史诗</span>
    <span class="fc-legend-item"><span class="fc-legend-dot" style="background:${RARITY_COLORS.legendary.glow}"></span>传说</span>
    <span class="fc-legend-sep"></span>
    <span class="fc-legend-item"><span class="fc-legend-dot fc-legend-locked"></span>未解锁</span>
    <span class="fc-legend-item"><span class="fc-legend-fog"></span>未探索区域</span>
  `;
  panel.appendChild(legend);
}

// ── Cascade Animation ───────────────────────────────────────────────────────
export function playCascadeAnimation() {
  if (_isMobile) return;
  if (!_svg || _animating) return;
  _animating = true;

  const unlockedNodes = [];
  for (const r of _chartData.regions) {
    for (const n of r.nodes) {
      if (_isNodeUnlocked(n)) unlockedNodes.push(n);
    }
  }
  const pcx = CX + PAD, pcy = CY + PAD;
  unlockedNodes.sort((a, b) => {
    const da = Math.sqrt((a.x + NODE_W / 2 - CX) ** 2 + (a.y + NODE_H / 2 - CY) ** 2);
    const db = Math.sqrt((b.x + NODE_W / 2 - CX) ** 2 + (b.y + NODE_H / 2 - CY) ** 2);
    return da - db;
  });

  _svg.querySelectorAll('.fc-node.fc-unlocked').forEach(el => { el.style.opacity = '0'; });
  _svg.querySelectorAll('.fc-edge-lit').forEach(el => { el.style.opacity = '0'; });

  let delay = 200;
  const STEP = 55;

  unlockedNodes.forEach((n, i) => {
    const el = _svg.querySelector(`.fc-node[data-id="${n.id}"]`);
    if (!el) return;
    const rarity = _rarityForNode(n);

    setTimeout(() => {
      el.style.transition = 'opacity 0.4s ease-out';
      el.style.opacity = '1';
      if (rarity === 'normal') el.classList.add('fc-reveal-t1');
      else if (rarity === 'rare') el.classList.add('fc-reveal-t2');
      else el.classList.add('fc-reveal-t3');
    }, delay + i * STEP);
  });

  setTimeout(() => {
    _svg.querySelectorAll('.fc-edge-lit').forEach((el, i) => {
      setTimeout(() => {
        el.style.transition = 'opacity 0.3s ease-out';
        el.style.opacity = '1';
      }, i * 20);
    });
  }, delay + unlockedNodes.length * STEP * 0.4);

  setTimeout(() => { _animating = false; }, delay + unlockedNodes.length * STEP + 600);
}

// ── Open / Close ────────────────────────────────────────────────────────────
let _isOpen = false;
let _onOpenSfx = null;
let _onCloseSfx = null;
let _onHoverSfx = null;

export function setFlowchartSfx({ onOpen, onClose, onHover }) {
  _onOpenSfx = onOpen || null;
  _onCloseSfx = onClose || null;
  _onHoverSfx = onHover || null;
}

export async function openFlowchart() {
  if (_isOpen) return;
  _isOpen = true;
  if (_onOpenSfx) _onOpenSfx();
  await loadFlowchartData();
  const overlay = document.getElementById('fc-overlay');
  if (!overlay) return;
  overlay.classList.add('fc-open');
  renderFlowchart('fc-canvas');
  _autoCenterCanvas();
  setTimeout(() => playCascadeAnimation(), 300);
}

export function closeFlowchart() {
  _isOpen = false;
  if (_onCloseSfx) _onCloseSfx();
  const overlay = document.getElementById('fc-overlay');
  if (overlay) overlay.classList.remove('fc-open');
  const container = document.getElementById('fc-canvas');
  if (container) container.innerHTML = '';
  _svg = null;
}

function _autoCenterCanvas() {
  const canvas = document.getElementById('fc-canvas');
  if (!canvas || !_chartData) return;
  let sumX = 0, sumY = 0, count = 0;
  for (const r of _chartData.regions) {
    for (const n of r.nodes) {
      if (_isNodeUnlocked(n)) {
        sumX += n.x + NODE_W / 2 + PAD;
        sumY += n.y + NODE_H / 2 + PAD;
        count++;
      }
    }
  }
  if (count === 0) {
    requestAnimationFrame(() => {
      canvas.scrollLeft = CX + PAD - canvas.clientWidth / 2;
      canvas.scrollTop = CY + PAD - canvas.clientHeight / 2;
    });
    return;
  }
  const cx = sumX / count;
  const cy = sumY / count;
  requestAnimationFrame(() => {
    canvas.scrollLeft = cx - canvas.clientWidth / 2;
    canvas.scrollTop = cy - canvas.clientHeight / 2;
  });
}

// ── Setup ───────────────────────────────────────────────────────────────────
export function initFlowchart() {
  _loadFcState();

  const overlay = document.getElementById('fc-overlay');
  if (!overlay) return;

  const closeBtn = document.getElementById('fc-close');
  if (closeBtn) closeBtn.addEventListener('click', closeFlowchart);

  const mobileCloseBtn = document.getElementById('fc-mobile-close');
  if (mobileCloseBtn) mobileCloseBtn.addEventListener('click', closeFlowchart);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeFlowchart();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _isOpen) closeFlowchart();
  });

  let _zoomScale = 1;
  const ZOOM_MIN = 0.3;
  const ZOOM_MAX = 2.0;
  const ZOOM_STEP = 0.15;

  function _applyZoom() {
    const svg = document.querySelector('#fc-canvas .fc-svg');
    if (!svg) return;
    svg.style.transform = `scale(${_zoomScale})`;
    svg.style.transformOrigin = 'top left';
    const label = document.getElementById('fc-zoom-level');
    if (label) label.textContent = Math.round(_zoomScale * 100) + '%';
  }

  function _zoomTo(newScale, centerX, centerY) {
    const canvas = document.getElementById('fc-canvas');
    if (!canvas) return;
    const oldScale = _zoomScale;
    _zoomScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newScale));
    if (_zoomScale === oldScale) return;
    if (centerX !== undefined && centerY !== undefined) {
      const scrollCX = canvas.scrollLeft + centerX;
      const scrollCY = canvas.scrollTop + centerY;
      const ratio = _zoomScale / oldScale;
      canvas.scrollLeft = scrollCX * ratio - centerX;
      canvas.scrollTop = scrollCY * ratio - centerY;
    }
    _applyZoom();
  }

  document.getElementById('fc-zoom-in')?.addEventListener('click', () => {
    _zoomTo(_zoomScale + ZOOM_STEP);
  });
  document.getElementById('fc-zoom-out')?.addEventListener('click', () => {
    _zoomTo(_zoomScale - ZOOM_STEP);
  });
  document.getElementById('fc-zoom-reset')?.addEventListener('click', () => {
    _zoomScale = 1;
    _applyZoom();
  });

  const canvas = document.getElementById('fc-canvas');
  if (canvas) {
    let dragging = false;
    let startX = 0, startY = 0, scrollX = 0, scrollY = 0;

    canvas.addEventListener('wheel', e => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      _zoomTo(_zoomScale + delta, cx, cy);
    }, { passive: false });

    canvas.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      scrollX = canvas.scrollLeft;
      scrollY = canvas.scrollTop;
      canvas.style.cursor = 'grabbing';
      e.preventDefault();
    });
    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      canvas.scrollLeft = scrollX - (e.clientX - startX);
      canvas.scrollTop = scrollY - (e.clientY - startY);
    });
    window.addEventListener('mouseup', () => {
      if (dragging) { dragging = false; canvas.style.cursor = 'grab'; }
    });

    let lastPinchDist = 0;
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        dragging = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        scrollX = canvas.scrollLeft;
        scrollY = canvas.scrollTop;
      } else if (e.touches.length === 2) {
        dragging = false;
        lastPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });
    canvas.addEventListener('touchmove', e => {
      if (e.touches.length === 1 && dragging) {
        canvas.scrollLeft = scrollX - (e.touches[0].clientX - startX);
        canvas.scrollTop = scrollY - (e.touches[0].clientY - startY);
        e.preventDefault();
      } else if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (lastPinchDist > 0) {
          const rect = canvas.getBoundingClientRect();
          const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
          const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
          const ratio = dist / lastPinchDist;
          _zoomTo(_zoomScale * ratio, cx, cy);
        }
        lastPinchDist = dist;
      }
    }, { passive: false });
    canvas.addEventListener('touchend', e => {
      dragging = false;
      if (e.touches.length < 2) lastPinchDist = 0;
    });
    canvas.addEventListener('touchcancel', () => { dragging = false; lastPinchDist = 0; });
  }
}
