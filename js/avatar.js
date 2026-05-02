const W = 128, H = 192, SCALE = 1.5;
let animFrameId = null;
let lastState = null;
let lastCanvas = null;

const P = {
  skinLight: '#fce4c8', skinMid: '#e8c8a0', skinDark: '#d4a878', skinFlush: '#f0b8a0',
  hairBlack: '#1a1416', hairDark: '#3a2820', hairBrown: '#6a4a30', hairLight: '#c8a050',
  outline: '#181818',
  eye: '#181818', eyeWhite: '#fff', eyeHighlight: '#fff', eyeLash: '#111',
  mouth: '#c04040', cheek: '#f0a0a0', blemish: '#c89070', bag: '#c0a090',
  pants: '#2a2e38', jeans: '#2980b9', shorts: '#d35400', bball: '#111', pantsNice: '#1a2030',
  shoes: '#1a1a1a', shoesNice: '#3a1808', shoesSneaker: '#ffffff', sneakerDetail: '#e74c3c',
  glasses: '#2a2a2a', glassesLens: 'rgba(180,210,240,0.4)',
  belt: '#3a3020', beltBuckle: '#f1c40f',
  // Backgrounds
  bgSchoolWall: '#2a3040', bgSchoolBoard: '#1a4a2a', bgSchoolChalk: '#d8d8c8',
  bgCampusGrass: '#1a3a20', bgCampusSky: '#1a2848', bgCampusTree: '#1a4a28', bgCampusLeaf: '#2a6a30', bgCampusTrunk: '#4a3020',
  bgOfficeDeskTop: '#3a3028', bgOfficeMonitor: '#1a2030', bgOfficeScreen: '#2a4060',
  bgHomeWall: '#2a2838', bgHomeWindow: '#1a3050', bgHomeStar: '#f0e8a0',
  bgSpyDark: '#0a0a10', bgSpyLaser: '#e02020',
  bgAbyssGlow: '#0a1828', bgAbyssLine: '#1a4a70',
  bgMetaGrid: '#1a0a28', bgMetaGlitch: '#40e870',
};

function makeGrid() {
  const g = [];
  for (let y = 0; y < H; y++) g.push(new Array(W).fill(null));
  return g;
}

function fill(g, x, y, w, h, c) {
  x = Math.floor(x); y = Math.floor(y); w = Math.floor(w); h = Math.floor(h);
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++)
      if (yy >= 0 && yy < H && xx >= 0 && xx < W) g[yy][xx] = c;
}

function px(g, x, y, c) {
  x = Math.floor(x); y = Math.floor(y);
  if (y >= 0 && y < H && x >= 0 && x < W) g[y][x] = c;
}

function drawSprite(g, startX, startY, pattern, colorMap) {
  for (let y = 0; y < pattern.length; y++) {
    const row = pattern[y];
    for (let x = 0; x < row.length; x++) {
      const char = row[x];
      if (char !== ' ' && colorMap[char]) {
        px(g, startX + x, startY + y, colorMap[char]);
      }
    }
  }
}

// ── Backgrounds (Doubled Res & Enhanced) ──

function drawBackground(g, state) {
  const sl = state.storyline;
  if (sl === 'spy') return drawBgSpy(g);
  if (sl === 'abyss') return drawBgAbyss(g);
  if (sl === 'meta') return drawBgMeta(g);
  if (sl === 'xianxia') return drawBgXianxia(g, state);
  if (sl === 'idol' || sl === 'superstar') return drawBgStage(g);
  if (sl === 'poker' || sl === 'triton' || sl === 'local_shark') return drawBgCasino(g);
  if (sl === 'party') return drawBgClub(g);
  if (sl === 'wasted' || (state.MNY < 3 && state.age > 22)) return drawBgMessy(g);

  if (state.age <= 18) return drawBgSchool(g);
  if (state.age <= 22) return drawBgCampus(g);
  if (state.MNY >= 9) return drawBgPenthouse(g);
  return drawBgOffice(g);
}

function drawBgSchool(g) {
  fill(g, 0, 0, W, H, P.bgSchoolWall);
  fill(g, 8, 8, 56, 32, P.bgSchoolBoard);
  fill(g, 10, 10, 52, 28, '#1a5a2a');
  for (let i = 0; i < 3; i++) fill(g, 16, 16 + i * 8, 20 + (i % 2 ? 8 : 0), 2, P.bgSchoolChalk);
  fill(g, 40, 14, 16, 2, P.bgSchoolChalk); fill(g, 46, 18, 12, 2, P.bgSchoolChalk);
  fill(g, 90, 10, 20, 20, '#eee'); fill(g, 92, 12, 16, 16, '#fff'); 
  fill(g, 99, 14, 2, 6, '#333'); fill(g, 99, 20, 6, 2, '#e02020'); 
  fill(g, 0, 152, W, 40, '#1a1820'); fill(g, 0, 152, W, 2, '#2a2838');
  fill(g, 10, 160, 20, 4, '#5c4033'); fill(g, 90, 164, 24, 4, '#5c4033');
}

function drawBgCampus(g) {
  fill(g, 0, 0, W, 100, P.bgCampusSky);
  fill(g, 20, 20, 30, 10, '#fff'); fill(g, 26, 14, 20, 10, '#fff');
  fill(g, 80, 40, 40, 8, '#f0f0f0'); fill(g, 90, 34, 20, 10, '#f0f0f0');
  fill(g, 0, 100, W, 20, '#1a3038'); fill(g, 20, 80, 16, 40, '#2a4050'); fill(g, 80, 70, 24, 50, '#203848');
  fill(g, 0, 120, W, 72, P.bgCampusGrass); fill(g, 0, 120, W, 4, '#2a5a30');
  fill(g, 4, 60, 8, 60, P.bgCampusTrunk);
  fill(g, 0, 36, 16, 28, P.bgCampusLeaf); fill(g, 2, 30, 12, 10, P.bgCampusLeaf);
  fill(g, 108, 68, 8, 52, P.bgCampusTrunk);
  fill(g, 102, 44, 20, 28, P.bgCampusLeaf); fill(g, 104, 38, 16, 10, P.bgCampusLeaf);
  fill(g, 48, 124, 32, 68, '#3a3830'); fill(g, 46, 124, 2, 68, '#2a2820'); fill(g, 80, 124, 2, 68, '#2a2820'); 
}

function drawBgOffice(g) {
  fill(g, 0, 0, W, H, '#1a1e28');
  fill(g, 0, 140, W, 8, P.bgOfficeDeskTop);
  fill(g, 4, 148, 8, 44, '#2a2820'); fill(g, 116, 148, 8, 44, '#2a2820');
  fill(g, 80, 108, 36, 28, P.bgOfficeMonitor); fill(g, 84, 112, 28, 20, P.bgOfficeScreen);
  fill(g, 94, 136, 8, 4, '#2a2a2a');
  fill(g, 88, 116, 16, 2, '#3a6090'); fill(g, 88, 120, 12, 2, '#3a6090'); fill(g, 88, 124, 20, 2, '#3a6090');
  fill(g, 10, 124, 16, 16, '#27ae60'); fill(g, 14, 140, 8, 8, '#d35400');
  fill(g, 0, 176, W, 16, '#141820');
}

function drawBgPenthouse(g) {
  fill(g, 0, 0, W, H, '#0a0a1a'); 
  fill(g, 60, 20, 68, 120, '#101525'); 
  fill(g, 60, 20, 4, 120, '#3a3a4a'); fill(g, 92, 20, 4, 120, '#3a3a4a'); fill(g, 60, 80, 68, 4, '#3a3a4a');
  for(let i=0; i<30; i++) px(g, 68 + Math.random()*56, 90 + Math.random()*40, '#f0d080');
  fill(g, 16, 120, 16, 4, '#2a2a2a'); fill(g, 18, 130, 12, 10, '#8a2020'); 
  fill(g, 0, 140, W, 52, '#302020'); fill(g, 0, 140, W, 4, '#403030');
}

function drawBgMessy(g) {
  fill(g, 0, 0, W, H, '#2a2520'); 
  for(let i=0; i<20; i++) fill(g, Math.random()*W, Math.random()*120, 8, 2, '#201a15'); 
  fill(g, 90, 20, 20, 20, '#1a2030'); 
  fill(g, 90, 20, 2, 20, '#111'); fill(g, 108, 20, 2, 20, '#111'); fill(g, 90, 20, 20, 2, '#111');
  fill(g, 20, 140, 12, 12, '#333'); fill(g, 80, 148, 8, 6, '#444');
  fill(g, 0, 152, W, 40, '#151010'); 
}

function drawBgSpy(g) {
  fill(g, 0, 0, W, H, P.bgSpyDark);
  for (let y = 20; y < H; y += 32) fill(g, 0, y, W, 2, '#200808');
  for (let x = 16; x < W; x += 24) fill(g, x, 0, 2, H, '#200808');
  fill(g, 0, 84, W, 2, P.bgSpyLaser); fill(g, 0, 116, W, 2, '#a01818');
  fill(g, 0, 164, W, 28, '#0a0a0a');
}

function drawBgAbyss(g) {
  fill(g, 0, 0, W, H, P.bgAbyssGlow);
  for (let x = 8; x < W; x += 16) fill(g, x, 8, 4, H - 16, '#0a1a30');
  const leds = [[12,20],[28,40],[44,28],[60,56],[76,16],[92,48],[108,36],[12,80],[44,96],[76,76],[108,88]];
  for (const [lx, ly] of leds) fill(g, lx, ly, 4, 4, Math.random() > 0.3 ? P.bgAbyssLine : '#40a0e0');
  fill(g, 0, 164, W, 28, '#060e18');
}

function drawBgMeta(g) {
  fill(g, 0, 0, W, H, P.bgMetaGrid);
  for (let x = 0; x < W; x += 16) fill(g, x, 0, 2, H, '#200a38');
  for (let y = 0; y < H; y += 16) fill(g, 0, y, W, 2, '#200a38');
  fill(g, 4, 16, 12, 6, P.bgMetaGlitch); fill(g, 100, 60, 16, 4, P.bgMetaGlitch);
  fill(g, 20, 140, 24, 4, '#e040e0'); fill(g, 88, 120, 10, 8, P.bgMetaGlitch);
  fill(g, 0, 164, W, 28, '#0a0418'); fill(g, 16, 168, 40, 2, P.bgMetaGlitch);
}

function drawBgXianxia(g, state) {
  const cul = state.cul || 0;
  const sky = cul >= 300 ? '#1a0a30' : cul >= 60 ? '#0a1830' : '#101a2a';
  fill(g, 0, 0, W, H, sky);
  for (let x = 0; x < W; x+=2) {
    const h = 36 + Math.round(16 * Math.sin(x * 0.2)) + (x % 14);
    fill(g, x, 80 - h/2, 2, h, '#1a2438');
  }
  fill(g, 92, 16, 16, 16, cul >= 300 ? '#f0e8a0' : '#d8d0c0');
  for (let i = 0; i < 20; i++) px(g, (i*14+6) % W, (i*10+4) % 72, '#f0f0d0');
  if (cul >= 300) {
    fill(g, 0, 152, W, 40, '#2a2050');
    for (let i = 0; i < 12; i++) fill(g, (i*24+4) % W, 156 + (i%3)*8, 20, 4, '#a090d0');
  } else {
    fill(g, 0, 152, W, 40, '#0a1018'); fill(g, 0, 152, W, 2, '#2a3848');
  }
}

function drawBgStage(g) {
  fill(g, 0, 0, W, H, '#100820');
  for(let y=0; y<H; y+=2) {
    fill(g, 20 - Math.floor(y/4), y, 20 + Math.floor(y/2), 2, 'rgba(255,220,100,0.15)');
    fill(g, 88 - Math.floor(y/3), y, 20 + Math.floor(y/2), 2, 'rgba(255,100,200,0.15)');
  }
  fill(g, 0, 160, W, 32, '#201030'); fill(g, 0, 160, W, 4, '#e040a0');
}

function drawBgCasino(g) {
  fill(g, 0, 0, W, H, '#201010');
  fill(g, 0, 120, W, 72, '#105020'); 
  fill(g, 0, 112, W, 8, '#502810'); 
  fill(g, 20, 128, 12, 4, '#e02020'); fill(g, 20, 124, 12, 4, '#e02020'); 
  fill(g, 90, 140, 12, 4, '#2020e0'); fill(g, 100, 136, 12, 4, '#2020e0');
}

function drawBgClub(g) {
  fill(g, 0, 0, W, H, '#0a0515');
  for(let i=0; i<10; i++) {
    fill(g, Math.random()*W, Math.random()*100, 4, 40, '#ff0055');
    fill(g, Math.random()*W, Math.random()*100, 4, 40, '#00ffff');
  }
  fill(g, 0, 160, W, 32, '#150a25');
}

// ── Base Body (High Res) ──

function darkenHex(hex) {
  if (hex.startsWith('rgba')) return 'rgba(0,0,0,0.3)';
  if (hex === '#ffffff' || hex === '#fff') return '#cccccc';
  return '#111111'; 
}

function drawBody(g, state, yOffset = 0, time = 0) {
  const isFemale = state.sex === 1;
  const skin = state.HLT >= 7 ? P.skinFlush : (state.HLT <= 2 ? P.skinLight : P.skinMid);

  // Walk Cycle Logic (0: Idle/Pass, 1: Right forward, 2: Idle/Pass, 3: Left forward)
  const isWalking = time > 0;
  const walkFrame = isWalking ? Math.floor(time / 250) % 4 : 0;
  const walkBounce = (walkFrame === 1 || walkFrame === 3) ? 2 : 0;

  // 统一的微弱呼吸幅度，保证头、脖子、躯干作为整体一起运动
  const animY = Math.floor(yOffset / 2) + walkBounce;
  const baseHeadTop = 36; 
  const headTop = baseHeadTop + animY;
  const headH = 40, headW = 36;
  const headX = 46;

  fill(g, headX + 2, headTop, headW - 4, headH, skin);
  fill(g, headX, headTop + 2, headW, headH - 4, skin);
  for (let x = headX + 2; x < headX + headW - 2; x++) { px(g, x, headTop - 1, P.outline); px(g, x, headTop + headH, P.outline); }
  for (let y = headTop + 2; y < headTop + headH - 2; y++) { px(g, headX - 1, y, P.outline); px(g, headX + headW, y, P.outline); }

  // 脖子跟着头一起动
  fill(g, headX + 14, headTop + headH, 8, 4, skin); 

  // 躯干紧连着脖子
  const torsoY = headTop + headH + 4;
  const torsoH = isFemale ? 56 : 60; // 躯干长一点
  const torsoX = isFemale ? 36 : 32;
  const torsoW = isFemale ? 56 : 64;

  fill(g, torsoX, torsoY, torsoW, torsoH, skin);
  const armW = 8;
  const armH = torsoH - 8;
  
  let leftArmX = torsoX - armW;
  let rightArmX = torsoX + torsoW;
  
  if (walkFrame === 1) { leftArmX += 4; rightArmX -= 4; }
  else if (walkFrame === 3) { leftArmX -= 4; rightArmX += 4; }

  fill(g, leftArmX, torsoY + 4, armW, armH + 6, skin);
  fill(g, rightArmX, torsoY + 4, armW, armH + 6, skin);

  for (let x = torsoX; x < torsoX + torsoW; x++) px(g, x, torsoY + torsoH, P.outline);
  for (let y = torsoY; y < torsoY + torsoH; y++) { px(g, torsoX - 1, y, P.outline); px(g, torsoX + torsoW, y, P.outline); }
  for (let x = torsoX; x < torsoX + torsoW; x++) px(g, x, torsoY - 1, P.outline);

  // Legs & Pants
  const legY = torsoY + torsoH + 2;
  const legH = H - legY - 8; // 腿现在变短了
  const legW = 12;
  
  let leftLegX = torsoX + 4;
  let rightLegX = torsoX + torsoW - legW - 4;
  let leftLegDark = false;
  let rightLegDark = false;

  if (walkFrame === 1) {
    rightLegX += 6; 
    leftLegX -= 4;
    leftLegDark = true;
  } else if (walkFrame === 3) {
    leftLegX += 6;
    rightLegX -= 4;
    rightLegDark = true;
  }

  let pColor = P.pants;
  let pType = state.bottomVariant % 3; 
  if (state.MNY >= 8 || state.storyline === 'ceo' || state.storyline === 'spy') { pColor = P.pantsNice; pType = 0; } 
  else if (pType === 0) pColor = P.jeans;
  else if (pType === 1) pColor = P.shorts;
  else { pColor = P.bball; pType = 2; } 

  const drawLeg = (lx, isDark) => {
    const c = isDark ? darkenHex(pColor) : pColor;
    const s = isDark ? darkenHex(skin) : skin;
    
    if (pType === 1) { 
      fill(g, lx, legY, legW, 20, c);
      fill(g, lx, legY + 20, legW, legH - 20, s);
    } else if (pType === 2) { 
      fill(g, lx - 2, legY, legW + 4, 28, c);
      fill(g, lx + 10, legY, 2, 28, isDark ? '#aaa' : '#fff'); 
      fill(g, lx, legY + 28, legW, legH - 28, s);
    } else { 
      fill(g, lx, legY, legW, legH, c);
      if (pColor === P.jeans && !isDark) {
        fill(g, lx + 4, legY + 10, 4, 16, 'rgba(255,255,255,0.15)'); 
      }
    }
  };

  if (leftLegDark) { drawLeg(leftLegX, true); drawLeg(rightLegX, false); }
  else { drawLeg(rightLegX, rightLegDark); drawLeg(leftLegX, false); }

  // Shoes
  let sColor = P.shoes;
  if (state.storyline === 'idol' || state.storyline === 'superstar') { sColor = '#ffffff'; } 
  else if (state.MNY >= 8 || state.storyline === 'ceo') { sColor = P.shoesNice; } 
  else if (state.topVariant % 2 === 0 || pType > 0) { sColor = P.shoesSneaker; }

  const drawShoe = (lx, isDark) => {
    const c = isDark ? darkenHex(sColor) : sColor;
    fill(g, lx - 2, H - 8, legW + 4, 8, c);
    
    if (sColor === P.shoesSneaker) {
      fill(g, lx - 2, H - 4, legW + 4, 4, isDark ? darkenHex(P.sneakerDetail) : P.sneakerDetail);
      fill(g, lx + 2, H - 8, 2, 4, isDark ? '#111' : '#333'); 
    } else if (sColor === P.shoesNice) {
      fill(g, lx + 2, H - 8, 4, 2, isDark ? '#2a1005' : '#6a3010');
    }
  };

  if (leftLegDark) { drawShoe(leftLegX, true); drawShoe(rightLegX, false); }
  else { drawShoe(rightLegX, rightLegDark); drawShoe(leftLegX, false); }

  return { headTop, headH, headX, headW, torsoX, torsoY, torsoW, torsoH, armW, armH };
}

// ── Detailed ASCII Faces ──

function drawFace(g, state, m) {
  const cMap = { 
    '.': P.eye, '@': P.eyeWhite, '*': P.eyeHighlight, '-': P.mouth, 
    '~': P.cheek, ',': P.blemish, 'o': P.bag, '|': P.eyeLash 
  };
  
  let tier = 2;
  if (state.APP <= 2) tier = 0;
  else if (state.APP <= 4) tier = 1;
  else if (state.APP <= 6) tier = 2;
  else if (state.APP <= 8) tier = 3;
  else tier = 4;

  const fId = state.faceVariant % 2;

  const faces = {
    T0_0: [ 
      "                            ",
      "                            ",
      "  ........        ........  ",
      " .@@@@@@..       ..@@@@@@.  ",
      ".@@....@@.       .@@....@@. ",
      ".@@....@@.       .@@....@@. ",
      " .@@@@@@..       ..@@@@@@.  ",
      "  oooooooo        oooooooo  ",
      "   oooooo          oooooo   ",
      "                            ",
      "             ..             ",
      "                            ",
      "                            ",
      "       --------------       ",
      "      ----------------      "
    ],
    T0_1: [ 
      "     ,,,                    ",
      "    ,,,         ,,,         ",
      "  ......        ......      ",
      " .@@@@@@.      .@@@@@@.     ",
      " .@....@.      .@....@.     ",
      " .@....@.      .@....@.     ",
      "  ......        ......      ",
      "                            ",
      "            ,,,             ",
      "            ,,,             ",
      "             ..             ",
      "                            ",
      "          --------          ",
      "           ------           "
    ],
    T1_0: [ 
      "                            ",
      "                            ",
      "   ......          ......   ",
      "  .@@@@@@.        .@@@@@@.  ",
      "  .@@..@@.        .@@..@@.  ",
      "  .@@..@@.        .@@..@@.  ",
      "   ......          ......   ",
      "                            ",
      "                            ",
      "             ..             ",
      "                            ",
      "         ----------         ",
      "         ----------         "
    ],
    T1_1: [ 
      "                            ",
      "  ......                    ",
      " .@@@@@@..          ......  ",
      "  .@@..@@..        ..@@@@@@.",
      "   .......        ..@@..@@. ",
      "                   .......  ",
      "                            ",
      "             ..             ",
      "                            ",
      "         ----------         ",
      "          --------          "
    ],
    T2_0: [ 
      "                            ",
      "                            ",
      "  ........        ........  ",
      " .@@@@@@@@.      .@@@@@@@@. ",
      ".@@..**..@@.    .@@..**..@@.",
      ".@@......@@.    .@@......@@.",
      ".@@......@@.    .@@......@@.",
      " .@@@@@@@@.      .@@@@@@@@. ",
      "  ........        ........  ",
      "                            ",
      "             ..             ",
      "                            ",
      "         ----------         ",
      "         ----------         "
    ],
    T2_1: [ 
      "                            ",
      "  ........        ........  ",
      " .@@@@@@@@.      .@@@@@@@@. ",
      ".@@..**..@@.    .@@..**..@@.",
      " .@@....@@.      .@@....@@. ",
      "  ........        ........  ",
      "                            ",
      "                            ",
      "             ..             ",
      "                            ",
      "        ------------        ",
      "         ----------         "
    ],
    T3_0: [ 
      " |||||||||        ||||||||| ",
      "|@@@@@@@@@|      |@@@@@@@@@|",
      "|@@****@@@|      |@@****@@@|",
      "|@@.***.@@|      |@@.***.@@|",
      "|@@.....@@|      |@@.....@@|",
      "|@@@@@@@@@|      |@@@@@@@@@|",
      " .........        ......... ",
      "  ~~~~~~~          ~~~~~~~  ",
      "   ~~~~~            ~~~~~   ",
      "             ..             ",
      "                            ",
      "        ------------        ",
      "         ----------         "
    ],
    T3_1: [ 
      " .|||||||.        .|||||||. ",
      ".@@@@@@@@@|      |@@@@@@@@@.",
      "|@@****@@@|      |@@****@@@|",
      "|@@.....@@|      |@@.....@@|",
      " .@@@@@@@.        .@@@@@@@. ",
      "  .......          .......  ",
      "                            ",
      "             ..             ",
      "                            ",
      "        ------------        ",
      "        ------------        "
    ],
    T4_0: [ 
      " ||||||||||      |||||||||| ",
      "|@@@@@@@@@@|    |@@@@@@@@@@|",
      "|@@******@@|    |@@******@@|",
      "|@@.****.@@|    |@@.****.@@|",
      "|@@......@@|    |@@......@@|",
      "|@@......@@|    |@@......@@|",
      "|@@@@@@@@@@|    |@@@@@@@@@@|",
      " ..........      .......... ",
      "  ~~~~~~~~        ~~~~~~~~  ",
      "   ~~~~~~          ~~~~~~   ",
      "                            ",
      "             ..             ",
      "                            ",
      "       --------------       ",
      "       ----......----       ",
      "        ------------        "
    ],
    T4_1: [ 
      " ||||||||||      |||||||||| ",
      "|@@@@@@@@@@|    |@@@@@@@@@@|",
      "|@@******@@|    |@@******@@|",
      "|@@......@@|    |@@......@@|",
      "|@@......@@|    |@@......@@|",
      " .@@@@@@@@.      .@@@@@@@@. ",
      "  ........        ........  ",
      "                            ",
      "                    .       ",
      "             ..             ",
      "                            ",
      "         ----------         ",
      "         ----------         "
    ]
  };

  let pat;
  if (tier === 0) pat = (fId === 0) ? faces.T0_0 : faces.T0_1;
  else if (tier === 1) pat = (fId === 0) ? faces.T1_0 : faces.T1_1;
  else if (tier === 2) pat = (fId === 0) ? faces.T2_0 : faces.T2_1;
  else if (tier === 3) pat = (fId === 0) ? faces.T3_0 : faces.T3_1;
  else pat = (fId === 0) ? faces.T4_0 : faces.T4_1;

  if (state.INT <= 2) pat = faces.T0_0; 

  const startX = m.headX + 4;
  const startY = m.headTop + 16;
  drawSprite(g, startX, startY, pat, cMap);

  // 智力表现：不再是刻板的眼镜，而是专注、深邃的剑眉（睿智感）
  if (state.INT >= 8) {
    // 左眉毛 (从外向内微降)
    fill(g, m.headX + 4, m.headTop + 14, 6, 1, '#222');
    fill(g, m.headX + 10, m.headTop + 15, 4, 1, '#222');
    // 右眉毛 (从内向外微升)
    fill(g, m.headX + 26, m.headTop + 14, 6, 1, '#222');
    fill(g, m.headX + 22, m.headTop + 15, 4, 1, '#222');
    
    // 智慧的眼神高光（蓝绿色）
    if (state.APP >= 4) {
      px(g, m.headX + 12, m.headTop + 20, '#40e0d0');
      px(g, m.headX + 28, m.headTop + 20, '#40e0d0');
    }
  }

  // 眼镜变成纯随机的饰品（25% 概率），不再强制绑定高智商
  const wearsGlasses = (state.faceVariant + state.topVariant + state.outfitColorId) % 4 === 0;
  if (wearsGlasses) {
    fill(g, m.headX + 2, m.headTop + 14, 14, 12, P.glassesLens);
    fill(g, m.headX + 20, m.headTop + 14, 14, 12, P.glassesLens);
    for (let i=0; i<16; i++) { px(g, m.headX+1+i, m.headTop+13, P.glasses); px(g, m.headX+1+i, m.headTop+26, P.glasses); }
    for (let i=0; i<16; i++) { px(g, m.headX+19+i, m.headTop+13, P.glasses); px(g, m.headX+19+i, m.headTop+26, P.glasses); }
    fill(g, m.headX+1, m.headTop+13, 2, 14, P.glasses); fill(g, m.headX+15, m.headTop+13, 2, 14, P.glasses);
    fill(g, m.headX+19, m.headTop+13, 2, 14, P.glasses); fill(g, m.headX+33, m.headTop+13, 2, 14, P.glasses);
    fill(g, m.headX+17, m.headTop+18, 2, 2, P.glasses); 
  }
}

// ── Detailed ASCII Clothes ──

function drawClothes(g, state, m) {
  const cMap = { 
    '#': '#ecf0f1', '.': '#bdc3c7', '*': '#e74c3c', '@': '#fff', 
    'S': '#2c3e50', 'L': '#e74c3c', 'W': '#fff', 'K': '#111', 'O': '#e67e22', 'D': '#34495e', 'G': '#95a5a6'
  };

  const colors = [
    { '#': '#ecf0f1', '.': '#bdc3c7', '*': '#e74c3c', '@': '#fff' }, 
    { '#': '#2ecc71', '.': '#27ae60', '*': '#fff', '@': '#f1c40f' }, 
    { '#': '#e67e22', '.': '#d35400', '*': '#fff', '@': '#2c3e50' }, 
    { '#': '#9b59b6', '.': '#8e44ad', '*': '#f1c40f', '@': '#fff' }, 
    { '#': '#1abc9c', '.': '#16a085', '*': '#34495e', '@': '#fff' }  
  ];

  if (state.MNY < 8 && state.storyline !== 'ceo' && state.storyline !== 'spy') {
    const pal = colors[state.outfitColorId % colors.length];
    cMap['#'] = pal['#']; cMap['.'] = pal['.']; cMap['*'] = pal['*']; cMap['@'] = pal['@'];
  }

  const supremeT = [
    "                                                        ",
    "        ########################################        ",
    "   ##################################################   ",
    " ###################################################### ",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########                                        ########",
    "########      LLLLLLLLLLLLLLLLLLLLLLLLLLLL      ########",
    "########      LLLLLLLLLLLLLLLLLLLLLLLLLLLL      ########",
    "########      LLLLWWLLWLLWLLWWLLWLLWLLWWLL      ########",
    "########      LLLLWLLLWLLWLLWLLLWLLWLLWLLL      ########",
    "########      LLLLWWLLWWWWLLWWLLWLLWLLWWLL      ########",
    "########      LLLLLWLLWLLWLLWLLLWLLWLLWLLL      ########",
    "########      LLLLWWLLWLLWLLWLLLWWWWLLWWLL      ########",
    "########      LLLLLLLLLLLLLLLLLLLLLLLLLLLL      ########",
    "########      LLLLLLLLLLLLLLLLLLLLLLLLLLLL      ########",
    "########                                        ########",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "########################################################",
    "  ####################################################  "
  ];

  const stussyHoodie = [
    "                                                        ",
    "        KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK        ",
    "   KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK   ",
    " KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK ",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKK          OO    O O O             KKKKKKKK",
    "KKKKKKKKKKKKKK         OO OO     O              KKKKKKKK",
    "KKKKKKKKKKKKKK         OOOO      O              KKKKKKKK",
    "KKKKKKKKKKKKKK         OO OO     O              KKKKKKKK",
    "KKKKKKKKKKKKKK         OO  O     O              KKKKKKKK",
    "KKKKKKKKKKKKKK                                  KKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKK                      KKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKK                          KKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKK                            KKKKKKKKKKKKKK",
    "KKKKKKKKKKKKK                              KKKKKKKKKKKKK",
    "KKKKKKKKKKKK                                KKKKKKKKKKKK",
    "KKKKKKKKKKK                                  KKKKKKKKKKK",
    "KKKKKKKKKK                                    KKKKKKKKKK",
    "KKKKKKKKK                                      KKKKKKKKK",
    "KKKKKKKK                                        KKKKKKKK",
    "KKKKKKK                                          KKKKKKK",
    "KKKKKK                                            KKKKKK",
    "KKKKKK                                            KKKKKK",
    "KKKKKK                                            KKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "  DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD  "
  ];

  const suitPattern = [
    "                                                        ",
    "        SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS        ",
    "   SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS   ",
    " SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS ",
    "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WLLW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WLLW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WLLW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WLLW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WLLW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WLLW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WLLW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSS   WWWW   SSSSSSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",
    "  SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS  "
  ];

  const pufferJacket = [
    "                                                        ",
    "        DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD        ",
    "   DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD   ",
    " DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD ",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "  KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK  "
  ];

  let pat = supremeT;
  let isShortSleeve = true;

  if (state.MNY >= 8 || state.storyline === 'ceo' || state.storyline === 'spy') {
    pat = suitPattern;
    isShortSleeve = false;
    if (state.storyline === 'spy') { cMap['S'] = '#111'; cMap['W'] = '#000'; }
  } else {
    if (state.major === 'CS') { pat = supremeT; cMap['#'] = '#000'; cMap['@'] = '#27ae60'; cMap['L'] = '#000'; } // Hacker
    else if (state.topVariant === 1) { pat = stussyHoodie; isShortSleeve = false; }
    else if (state.topVariant === 2) { pat = pufferJacket; isShortSleeve = false; }
    else if (state.topVariant === 3) { pat = suitPattern; isShortSleeve = false; cMap['S'] = '#d35400'; cMap['L'] = '#2c3e50'; } 
    else { pat = supremeT; }
  }

  const startX = m.torsoX - m.armW;
  const startY = m.torsoY;
  
  let currentSleeveColor = cMap['#'];
  if (isShortSleeve) {
    fill(g, startX, startY, m.armW, 16, cMap['#']);
    fill(g, m.torsoX + m.torsoW, startY, m.armW, 16, cMap['#']);
  } else {
    currentSleeveColor = cMap['S'] || cMap['K'] || cMap['D'];
    fill(g, startX, startY, m.armW, m.torsoH, currentSleeveColor);
    fill(g, m.torsoX + m.torsoW, startY, m.armW, m.torsoH, currentSleeveColor);
    fill(g, startX, startY + m.torsoH - 4, m.armW, 4, cMap['D'] || '#111');
    fill(g, m.torsoX + m.torsoW, startY + m.torsoH - 4, m.armW, 4, cMap['D'] || '#111');
  }

  const cx = m.torsoX + Math.floor((m.torsoW - 56) / 2);
  drawSprite(g, cx, startY, pat, cMap);

  return currentSleeveColor;
}

// ── Hair ──

function drawHair(g, state, m) {
  const isFemale = state.sex === 1;
  let hair = P.hairBlack;
  if (state.APP >= 8) hair = P.hairLight;
  else if (state.APP <= 2) hair = '#202a20';
  else if (state.APP >= 5) hair = P.hairBrown;
  else if (state.APP >= 3) hair = P.hairDark;

  // 根据 faceVariant, topVariant 等生成一个固定的发型 ID (0, 1, 2)
  const hId = (state.faceVariant + state.topVariant + state.outfitColorId) % 3;

  if (!isFemale) {
    if (hId === 0) {
      // 发型 0: 蓬松碎刘海 (Texturized Fringe / Messy) - 2025 流行男发
      fill(g, m.headX - 4, m.headTop - 12, m.headW + 8, 20, hair);
      // 顶部的蓬松碎发
      for(let i=0; i<5; i++) {
        fill(g, m.headX + i*8, m.headTop - 18 + (i%2)*4, 6, 8, hair);
        fill(g, m.headX + 2 + i*8, m.headTop - 22 + (i%3)*4, 4, 6, hair);
      }
      // 前额的碎刘海
      for(let i=0; i<6; i++) {
        fill(g, m.headX + i*6, m.headTop + 2, 5, 8 + (i%2)*4, hair);
        fill(g, m.headX + 1 + i*6, m.headTop + 10 + (i%2)*4, 3, 4, hair);
      }
      // 鬓角
      fill(g, m.headX - 2, m.headTop + 8, 4, 12, hair);
      fill(g, m.headX + m.headW - 2, m.headTop + 8, 4, 12, hair);
    } else if (hId === 1) {
      // 发型 1: 韩式中分 (Middle Part / Curtained)
      fill(g, m.headX - 6, m.headTop - 10, m.headW + 12, 16, hair);
      fill(g, m.headX - 2, m.headTop - 14, m.headW + 4, 6, hair);
      // 左侧中分垂下
      fill(g, m.headX - 4, m.headTop + 4, 16, 16, hair); 
      fill(g, m.headX - 2, m.headTop + 20, 10, 4, hair);
      // 右侧中分垂下
      fill(g, m.headX + m.headW - 12, m.headTop + 4, 16, 16, hair); 
      fill(g, m.headX + m.headW - 8, m.headTop + 20, 10, 4, hair);
      // 露出中间额头
    } else {
      // 发型 2: 狼尾 (Wolf Cut / Mullet)
      fill(g, m.headX - 4, m.headTop - 10, m.headW + 8, 16, hair);
      fill(g, m.headX + 4, m.headTop - 14, m.headW - 8, 8, hair);
      // 较短的齐刘海
      fill(g, m.headX + 2, m.headTop + 2, m.headW - 4, 6, hair);
      for(let i=0; i<8; i++) fill(g, m.headX + 4 + i*4, m.headTop + 8, 2, 2+(i%2)*2, hair);
      // 脑后留长的狼尾
      fill(g, m.headX - 8, m.headTop + 6, 8, 24, hair); 
      fill(g, m.headX - 10, m.headTop + 30, 8, 8, hair); 
      fill(g, m.headX + m.headW, m.headTop + 6, 8, 24, hair); 
      fill(g, m.headX + m.headW + 2, m.headTop + 30, 8, 8, hair);
    }
  } else {
    if (hId === 0) {
      // 发型 0: 浪漫法式波浪长卷发 (Wavy Long)
      fill(g, m.headX - 6, m.headTop - 14, m.headW + 12, 20, hair);
      fill(g, m.headX, m.headTop - 18, m.headW, 6, hair);
      // 刘海
      fill(g, m.headX, m.headTop + 2, m.headW, 10, hair);
      fill(g, m.headX + 4, m.headTop + 12, 6, 4, hair); fill(g, m.headX + 26, m.headTop + 12, 6, 4, hair);
      // 波浪长发垂至腰间
      for(let y=0; y<50; y+=8) {
        let offset = (y % 16 === 0) ? -2 : 2;
        fill(g, m.headX - 14 + offset, m.headTop + 6 + y, 12, 10, hair);
        fill(g, m.headX + m.headW + 2 + offset, m.headTop + 6 + y, 12, 10, hair);
      }
    } else if (hId === 1) {
      // 发型 1: 层次感波波头短发 (Layered Bob)
      fill(g, m.headX - 8, m.headTop - 12, m.headW + 16, 24, hair);
      fill(g, m.headX - 2, m.headTop - 16, m.headW + 4, 6, hair);
      // 侧分大刘海
      fill(g, m.headX, m.headTop + 2, 24, 12, hair);
      fill(g, m.headX + 4, m.headTop + 14, 16, 6, hair);
      // 两侧蓬松的包脸短发
      fill(g, m.headX - 10, m.headTop + 12, 10, 20, hair);
      fill(g, m.headX - 6, m.headTop + 32, 6, 6, hair);
      fill(g, m.headX + m.headW, m.headTop + 12, 10, 20, hair);
      fill(g, m.headX + m.headW, m.headTop + 32, 6, 6, hair);
    } else {
      // 发型 2: 姬发式黑长直 (Hime Cut / Straight Long)
      fill(g, m.headX - 6, m.headTop - 12, m.headW + 12, 16, hair);
      fill(g, m.headX, m.headTop - 14, m.headW, 4, hair);
      // 极度平整的齐刘海
      fill(g, m.headX, m.headTop + 2, m.headW, 8, hair);
      for(let x=m.headX; x<m.headX+m.headW; x+=4) px(g, x, m.headTop+10, hair);
      // 姬发式公主切鬓角
      fill(g, m.headX - 4, m.headTop + 6, 6, 16, hair);
      fill(g, m.headX + m.headW - 2, m.headTop + 6, 6, 16, hair);
      // 背后长发直下
      fill(g, m.headX - 12, m.headTop + 6, 8, 60, hair);
      fill(g, m.headX + m.headW + 4, m.headTop + 6, 8, 60, hair);
    }
  }
}

// ── Status Bubble ──

function drawBubble(ctx, state) {
  const bx = (W - 24) * SCALE;
  const by = 4 * SCALE;
  const bw = 20 * SCALE;
  const bh = 20 * SCALE;

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.beginPath();
  ctx.moveTo(bx + 8, by + bh);
  ctx.lineTo(bx + 0, by + bh + 12);
  ctx.lineTo(bx + 20, by + bh);
  ctx.fill();

  ctx.font = `${SCALE * 12}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let icon = '📖';
  if (state.HAP >= 8) icon = '😄';
  else if (state.HAP <= 2) icon = '💀';
  else if (state.storyline === 'spy') icon = '🔫';
  else if (state.storyline === 'ceo') icon = '💼';
  else if (state.APP >= 8) icon = '✨';
  else if (state.MNY >= 8) icon = '💰';
  ctx.fillText(icon, bx + bw / 2, by + bh / 2 + 2);
}

// ── Props & Items ──

function drawProps(g, state, m, time, sleeveColor) {
  const major = state.major;

  if (major === 'CS' || state.storyline === 'abyss' || state.storyline === 'meta') {
    // 笔记本电脑位置
    const lapX = m.torsoX + Math.floor(m.torsoW / 2) - 22; 
    const lapY = m.torsoY + 26; 

    // 1. 先画大臂（使用袖子颜色，产生真实的连接感）
    const upperArmH = 14;
    fill(g, m.torsoX - m.armW, m.torsoY + 4, m.armW, upperArmH, sleeveColor);
    fill(g, m.torsoX + m.torsoW, m.torsoY + 4, m.armW, upperArmH, sleeveColor);
    
    // 2. 画笔记本电脑
    // 笔记本边框高亮（让深色电脑在黑色衣服前可见）
    fill(g, lapX - 1, lapY - 1, 46, 22, '#444'); 
    // 电脑主体
    fill(g, lapX, lapY, 44, 20, '#1a1a1a'); 
    // 亮着的屏幕
    fill(g, lapX + 4, lapY + 2, 36, 14, '#111');
    fill(g, lapX + 6, lapY + 4, 32, 10, '#1a2030'); 
    
    // 动态滚动的代码（更亮）
    const codeLineOffset = Math.floor(time / 400) % 4;
    if (codeLineOffset !== 0) fill(g, lapX + 8, lapY + 6, 12, 1, '#4ade80');
    if (codeLineOffset !== 1) fill(g, lapX + 8, lapY + 8, 24, 1, '#4ade80');
    if (codeLineOffset !== 2) fill(g, lapX + 12, lapY + 10, 16, 1, '#facc15');
    if (codeLineOffset !== 3) fill(g, lapX + 8, lapY + 12, 8, 1, '#38bdf8');

    // 笔记本转轴细节
    fill(g, lapX, lapY + 17, 44, 3, '#000');

    // 3. 画小臂和手部（肤色，覆盖在笔记本最上方）
    // 从袖口处延伸出来
    fill(g, m.torsoX - m.armW, m.torsoY + 4 + upperArmH, m.armW, 6, P.skinMid);
    fill(g, m.torsoX + m.torsoW, m.torsoY + 4 + upperArmH, m.armW, 6, P.skinMid);
    // 斜着指向笔记本
    fill(g, m.torsoX - m.armW + 4, m.torsoY + 4 + upperArmH + 4, 12, 6, P.skinMid);
    fill(g, m.torsoX + m.torsoW - 12, m.torsoY + 4 + upperArmH + 4, 12, 6, P.skinMid);
    // 扣住笔记本的手指
    fill(g, lapX + 2, lapY + 14, 10, 8, P.skinMid);
    fill(g, lapX + 32, lapY + 14, 10, 8, P.skinMid);
    // 指尖细节
    px(g, lapX + 4, lapY + 16, P.outline);
    px(g, lapX + 38, lapY + 16, P.outline);

  } else if (major === '商科' || state.storyline === 'ceo') {
    // 一手拿最新款手机看股市，一手拿星巴克
    const phoneX = m.torsoX - m.armW - 4;
    const phoneY = m.torsoY + m.torsoH - 16;
    fill(g, m.torsoX - m.armW, phoneY + 6, 8, 6, P.skinMid); // 弯曲的手臂
    fill(g, phoneX, phoneY, 8, 14, '#111');
    fill(g, phoneX + 1, phoneY + 1, 6, 12, '#fff'); // 屏幕亮
    fill(g, phoneX + 1, phoneY + 8, 6, 4, '#2ecc71'); // 绿色K线
    
    const cupX = m.torsoX + m.torsoW - 2;
    const cupY = m.torsoY + m.torsoH - 18;
    fill(g, m.torsoX + m.torsoW - 4, cupY + 8, 8, 6, P.skinMid); // 弯曲的手臂
    fill(g, cupX, cupY, 10, 14, '#fff'); // 杯身
    fill(g, cupX + 2, cupY + 4, 6, 6, '#27ae60'); // 星巴克Logo
    fill(g, cupX - 2, cupY - 2, 14, 2, '#fff'); // 杯盖
    
    // 手指覆盖
    fill(g, phoneX - 2, phoneY + 8, 4, 4, P.skinMid);
    fill(g, cupX + 4, cupY + 8, 4, 4, P.skinMid);
  } else if (major === '理科') {
    // 拿着冒泡的荧光试管
    const tubeX = m.torsoX + m.torsoW + 2;
    const tubeY = m.torsoY + m.torsoH - 24;
    fill(g, m.torsoX + m.torsoW - 4, tubeY + 14, 10, 6, P.skinMid); // 手臂
    fill(g, tubeX, tubeY, 8, 20, 'rgba(255,255,255,0.4)'); // 玻璃管
    
    // 液体起伏动画
    const fluidY = tubeY + 8 + Math.round(Math.sin(time / 150) * 2);
    fill(g, tubeX, fluidY, 8, tubeY + 20 - fluidY, '#3498db');
    px(g, tubeX + 2, fluidY + 2, '#fff'); // 气泡
    px(g, tubeX + 4, fluidY + 6, '#fff');
    // 发光
    fill(g, tubeX - 4, fluidY - 4, 16, 16, 'rgba(52,152,219,0.3)');
    
    // 手指
    fill(g, tubeX - 2, tubeY + 12, 6, 6, P.skinMid);
  } else if (major === '文科' || major === '文艺') {
    // 捧着一本厚厚的书
    const bookX = m.torsoX + Math.floor(m.torsoW / 2) - 12;
    const bookY = m.torsoY + 28;
    fill(g, bookX, bookY, 24, 20, '#8e44ad'); // 书皮
    fill(g, bookX + 2, bookY + 2, 20, 16, '#9b59b6');
    fill(g, bookX + 20, bookY + 2, 4, 16, '#ecf0f1'); // 书页
    fill(g, bookX + 4, bookY + 4, 12, 2, '#f1c40f'); // 烫金书名
    fill(g, bookX + 4, bookY + 8, 14, 2, '#f1c40f');
    
    // 弯曲的手臂捧书
    fill(g, m.torsoX - m.armW, bookY + 12, 14, 6, P.skinMid);
    fill(g, m.torsoX + m.torsoW - 14 + m.armW, bookY + 12, 14, 6, P.skinMid);
    // 手
    fill(g, bookX - 2, bookY + 14, 6, 6, P.skinMid);
    fill(g, bookX + 20, bookY + 14, 6, 6, P.skinMid);
  }
}

// ── Main Render ──

function drawFrame(time) {
  if (!lastCanvas || !lastState) return;
  const yOffset = Math.round(Math.sin(time / 200) * 2);

  const g = makeGrid();

  drawBackground(g, lastState);
  const m = drawBody(g, lastState, yOffset);
  const sleeveColor = drawClothes(g, lastState, m);
  drawProps(g, lastState, m, time, sleeveColor);
  drawFace(g, lastState, m);
  drawHair(g, lastState, m);

  lastCanvas.width = W * SCALE;
  lastCanvas.height = H * SCALE;
  const ctx = lastCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, lastCanvas.width, lastCanvas.height);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = g[y][x];
      if (c) {
        ctx.fillStyle = c;
        ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
      }
    }
  }

  drawBubble(ctx, lastState);
  animFrameId = requestAnimationFrame(drawFrame);
}

export function renderAvatar(canvas, state) {
  lastCanvas = canvas;
  lastState = state;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  drawFrame(performance.now());
}

export function createStandaloneAvatar(state) {
  const canvas = document.createElement('canvas');
  // 4 frames width for walk cycle
  canvas.width = W * SCALE * 4; 
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  for (let frame = 0; frame < 4; frame++) {
    const g = makeGrid();
    // Simulate time passing: frame 0 -> 0ms, frame 1 -> 250ms, frame 2 -> 500ms, frame 3 -> 750ms
    const mockTime = frame * 250 + 10; 
    
    // yOffset is 0 because walkBounce handles the bobbing in drawBody when time > 0
    const m = drawBody(g, state, 0, mockTime);
    const sleeveColor = drawClothes(g, state, m);
    drawProps(g, state, m, mockTime, sleeveColor);
    drawFace(g, state, m);
    drawHair(g, state, m);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = g[y][x];
        if (c) {
          ctx.fillStyle = c;
          // Offset x by frame * W
          ctx.fillRect((x + frame * W) * SCALE, y * SCALE, SCALE, SCALE);
        }
      }
    }
  }
  
  return canvas;
}
