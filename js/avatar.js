const W = 64, H = 96, SCALE = 3;
let animFrameId = null;
let lastState = null;
let lastCanvas = null;

const P = {
  skinLight: '#fce4c8', skinMid: '#e8c8a0', skinDark: '#d4a878', skinFlush: '#f0b8a0',
  hairBlack: '#1a1416', hairDark: '#3a2820', hairBrown: '#6a4a30', hairLight: '#c8a050',
  outline: '#181818',
  eye: '#181818', eyeWhite: '#fff', eyeHighlight: '#fff',
  mouth: '#c04040', cheek: '#f0a0a0',
  pants: '#2a2e38', pantsNice: '#1a2030',
  shoes: '#1a1a1a', shoesNice: '#3a1808', shoesSneaker: '#ffffff',
  glasses: '#2a2a2a', glassesLens: 'rgba(180,210,240,0.4)',
  belt: '#3a3020',
  badgeGold: '#d4a820', badgeSilver: '#a0a0a0', badgeBronze: '#8a5a30',
  book: '#b83028', laptop: '#444', phone: '#bbb',
  testTube: '#3498db', palette: '#daa520', briefcase: '#5a3a1a',
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
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++)
      if (yy >= 0 && yy < H && xx >= 0 && xx < W) g[yy][xx] = c;
}

function px(g, x, y, c) {
  if (y >= 0 && y < H && x >= 0 && x < W) g[y][x] = c;
}

// ── Backgrounds ──

function drawBackground(g, state) {
  const sl = state.storyline;
  if (sl === 'spy') return drawBgSpy(g);
  if (sl === 'abyss') return drawBgAbyss(g);
  if (sl === 'meta') return drawBgMeta(g);
  if (sl === 'idol' || sl === 'superstar') return drawBgStage(g);
  if (sl === 'poker' || sl === 'triton' || sl === 'local_shark') return drawBgCasino(g);
  if (sl === 'party') return drawBgClub(g);
  if (sl === 'wasted' || (state.MNY < 3 && state.age > 22)) return drawBgMessy(g);

  if (state.age <= 18) return drawBgSchool(g);
  if (state.age <= 22) return drawBgCampus(g);
  
  // 23 - 35 (Working adults)
  if (state.MNY >= 9) return drawBgPenthouse(g);
  return drawBgOffice(g);
}

function drawBgSchool(g) {
  fill(g, 0, 0, W, H, P.bgSchoolWall);
  fill(g, 4, 4, 28, 16, P.bgSchoolBoard);
  fill(g, 5, 5, 26, 14, '#1a5a2a');
  for (let i = 0; i < 3; i++) fill(g, 8, 8 + i * 4, 10 + (i % 2 ? 4 : 0), 1, P.bgSchoolChalk);
  fill(g, 0, 76, W, 20, '#1a1820');
  fill(g, 0, 76, W, 1, '#2a2838');
}

function drawBgCampus(g) {
  fill(g, 0, 0, W, 50, P.bgCampusSky);
  fill(g, 0, 50, W, 10, '#1a3038');
  fill(g, 0, 60, W, 36, P.bgCampusGrass);
  fill(g, 0, 60, W, 2, '#2a5a30');
  fill(g, 2, 30, 4, 30, P.bgCampusTrunk);
  fill(g, 0, 18, 8, 14, P.bgCampusLeaf);
  fill(g, 1, 15, 6, 5, P.bgCampusLeaf);
  fill(g, 54, 34, 4, 26, P.bgCampusTrunk);
  fill(g, 51, 22, 10, 14, P.bgCampusLeaf);
  fill(g, 52, 19, 8, 5, P.bgCampusLeaf);
  fill(g, 24, 62, 16, 34, '#3a3830');
  fill(g, 23, 62, 1, 34, '#2a2820');
  fill(g, 40, 62, 1, 34, '#2a2820');
}

function drawBgOffice(g) {
  fill(g, 0, 0, W, H, '#1a1e28');
  fill(g, 0, 70, W, 4, P.bgOfficeDeskTop);
  fill(g, 2, 74, 4, 22, '#2a2820');
  fill(g, 58, 74, 4, 22, '#2a2820');
  fill(g, 40, 54, 18, 14, P.bgOfficeMonitor);
  fill(g, 42, 56, 14, 10, P.bgOfficeScreen);
  fill(g, 47, 68, 4, 2, '#2a2a2a');
  fill(g, 44, 58, 8, 1, '#3a6090');
  fill(g, 44, 60, 6, 1, '#3a6090');
  fill(g, 44, 62, 10, 1, '#3a6090');
  fill(g, 0, 88, W, 8, '#141820');
}

function drawBgPenthouse(g) {
  fill(g, 0, 0, W, H, '#0a0a1a'); // dark night
  fill(g, 30, 10, 34, 60, '#101525'); // huge window
  fill(g, 30, 10, 2, 60, '#3a3a4a'); // window frame
  fill(g, 46, 10, 2, 60, '#3a3a4a');
  fill(g, 30, 40, 34, 2, '#3a3a4a');
  // distant city lights
  for(let i=0; i<15; i++) px(g, 34 + Math.random()*28, 45 + Math.random()*20, '#f0d080');
  fill(g, 0, 70, W, 26, '#302020'); // expensive wood floor
  fill(g, 0, 70, W, 2, '#403030');
}

function drawBgMessy(g) {
  fill(g, 0, 0, W, H, '#2a2520'); // dingy wall
  for(let i=0; i<10; i++) fill(g, Math.random()*W, Math.random()*60, 4, 1, '#201a15'); // peeling wallpaper
  fill(g, 45, 10, 10, 10, '#1a2030'); // tiny window
  fill(g, 45, 10, 1, 10, '#111'); fill(g, 54, 10, 1, 10, '#111'); fill(g, 45, 10, 10, 1, '#111');
  fill(g, 0, 76, W, 20, '#151010'); // dirty floor
}

function drawBgSpy(g) {
  fill(g, 0, 0, W, H, P.bgSpyDark);
  for (let y = 10; y < H; y += 16) fill(g, 0, y, W, 1, '#200808');
  for (let x = 8; x < W; x += 12) fill(g, x, 0, 1, H, '#200808');
  fill(g, 0, 42, W, 1, P.bgSpyLaser);
  fill(g, 0, 58, W, 1, '#a01818');
  fill(g, 0, 82, W, 14, '#0a0a0a');
}

function drawBgAbyss(g) {
  fill(g, 0, 0, W, H, P.bgAbyssGlow);
  for (let x = 4; x < W; x += 8) fill(g, x, 4, 2, H - 8, '#0a1a30');
  const leds = [[6,10],[14,20],[22,14],[30,28],[38,8],[46,24],[54,18],[6,40],[22,48],[38,38],[54,44]];
  for (const [lx, ly] of leds) px(g, lx, ly, Math.random() > 0.3 ? P.bgAbyssLine : '#40a0e0');
  for (let y = 0; y < H; y += 3) {
    const x = 30 + ((y * 7) % 11) - 5;
    if (x >= 0 && x < W) px(g, x, y, '#1a5a80');
  }
  fill(g, 0, 82, W, 14, '#060e18');
}

function drawBgMeta(g) {
  fill(g, 0, 0, W, H, P.bgMetaGrid);
  for (let x = 0; x < W; x += 8) fill(g, x, 0, 1, H, '#200a38');
  for (let y = 0; y < H; y += 8) fill(g, 0, y, W, 1, '#200a38');
  fill(g, 2, 8, 6, 3, P.bgMetaGlitch);
  fill(g, 50, 30, 8, 2, P.bgMetaGlitch);
  fill(g, 10, 70, 12, 2, '#e040e0');
  fill(g, 44, 60, 5, 4, P.bgMetaGlitch);
  fill(g, 48, 12, 10, 1, '#8040c0');
  fill(g, 0, 82, W, 14, '#0a0418');
  fill(g, 8, 84, 20, 1, P.bgMetaGlitch);
}

function drawBgStage(g) {
  fill(g, 0, 0, W, H, '#100820');
  for(let y=0; y<H; y++) {
    fill(g, 10 - Math.floor(y/4), y, 10 + Math.floor(y/2), 1, 'rgba(255,220,100,0.15)');
    fill(g, 44 - Math.floor(y/3), y, 10 + Math.floor(y/2), 1, 'rgba(255,100,200,0.15)');
  }
  fill(g, 0, 80, W, 16, '#201030');
  fill(g, 0, 80, W, 2, '#e040a0');
}

function drawBgCasino(g) {
  fill(g, 0, 0, W, H, '#201010');
  fill(g, 0, 60, W, 36, '#105020'); // green table
  fill(g, 0, 56, W, 4, '#502810'); // wood edge
  fill(g, 10, 64, 6, 2, '#e02020'); fill(g, 10, 62, 6, 2, '#e02020'); // chips
  fill(g, 45, 70, 6, 2, '#2020e0'); fill(g, 50, 68, 6, 2, '#2020e0');
}

function drawBgClub(g) {
  fill(g, 0, 0, W, H, '#0a0515');
  for(let i=0; i<5; i++) {
    fill(g, Math.random()*W, Math.random()*50, 2, 20, '#ff0055');
    fill(g, Math.random()*W, Math.random()*50, 2, 20, '#00ffff');
  }
  fill(g, 0, 80, W, 16, '#150a25');
}

// ── Romance Partner Bubble ──

function drawHltEffects(g, state, time) {
  if (state.HLT > -2) return;
  const isCoughing = (time % 4000) < 500;
  // Panting cloud
  const puffY = 20 + Math.round(Math.sin(time / 150) * 2);
  fill(g, 10, puffY, 6, 4, '#e0e0e0');
  fill(g, 11, puffY-1, 4, 6, '#e0e0e0');
  fill(g, 7, puffY+1, 3, 2, '#d0d0d0');
}

function drawPartnerBubble(g, state, yOffset = 0) {
  const rel = state.relationship;
  if (!rel || rel === '单身' || rel === '离异') return;

  const bx = 2, by = 6 + Math.floor(yOffset/2), bw = 18, bh = 16;
  fill(g, bx, by, bw, bh, '#ffffff');
  // outline
  for(let x=bx; x<bx+bw; x++) { px(g, x, by-1, P.outline); px(g, x, by+bh, P.outline); }
  for(let y=by; y<by+bh; y++) { px(g, bx-1, y, P.outline); px(g, bx+bw, y, P.outline); }
  
  // tail
  fill(g, bx+bw, by+bh-4, 4, 3, '#ffffff');
  px(g, bx+bw, by+bh-5, P.outline); px(g, bx+bw+1, by+bh-4, P.outline); 
  px(g, bx+bw+2, by+bh-3, P.outline); px(g, bx+bw+3, by+bh-2, P.outline);
  px(g, bx+bw+4, by+bh-1, P.outline);
  px(g, bx+bw, by+bh-1, P.outline); px(g, bx+bw+1, by+bh, P.outline); 
  px(g, bx+bw+2, by+bh+1, P.outline); px(g, bx+bw+3, by+bh, P.outline);

  // partner head
  const px_ = bx + 3, py_ = by + 4;
  fill(g, px_+1, py_+1, 8, 8, P.skinMid);
  
  const isFemale = state.sex === 1;
  const hair = isFemale ? P.hairBlack : P.hairLight; // opposite of player usually
  if (isFemale) { 
    // Draw Boy Partner
    fill(g, px_, py_, 10, 3, hair);
    fill(g, px_-1, py_+1, 2, 4, hair);
    fill(g, px_+9, py_+1, 2, 4, hair);
  } else { 
    // Draw Girl Partner
    fill(g, px_, py_, 10, 3, hair);
    fill(g, px_-1, py_+1, 3, 10, hair);
    fill(g, px_+8, py_+1, 3, 10, hair);
  }
  
  // eyes
  px(g, px_+2, py_+5, P.eye); px(g, px_+7, py_+5, P.eye);
  
  // heart
  if (rel !== '地下恋' && rel !== '冷战') {
    const hx = px_ + 11, hy = py_ + 2;
    px(g, hx, hy, '#e04040'); px(g, hx+2, hy, '#e04040');
    fill(g, hx-1, hy+1, 5, 2, '#e04040');
    fill(g, hx, hy+3, 3, 1, '#e04040');
    px(g, hx+1, hy+4, '#e04040');
  } else {
    // broken heart or question mark
    const hx = px_ + 11, hy = py_ + 2;
    fill(g, hx, hy, 4, 1, '#888');
    fill(g, hx, hy+2, 2, 1, '#888');
    px(g, hx+1, hy+4, '#888');
  }
}

// ── Character Body ──

function drawBody(g, state, yOffset = 0) {
  const isFemale = state.sex === 1;
  const skin = state.HLT >= 7 ? P.skinFlush : (state.HLT <= 2 ? P.skinLight : P.skinMid);

  const headTop = 14 + yOffset;
  const headH = 20, headW = 18;
  const headX = 23;

  // head shape
  fill(g, headX + 1, headTop, headW - 2, headH, skin);
  fill(g, headX, headTop + 1, headW, headH - 2, skin);
  // outline
  for (let x = headX + 1; x < headX + headW - 1; x++) { px(g, x, headTop - 1, P.outline); px(g, x, headTop + headH, P.outline); }
  px(g, headX, headTop, P.outline); px(g, headX + headW - 1, headTop, P.outline);
  px(g, headX, headTop + headH - 1, P.outline); px(g, headX + headW - 1, headTop + headH - 1, P.outline);
  for (let y = headTop + 1; y < headTop + headH - 1; y++) { px(g, headX - 1, y, P.outline); px(g, headX + headW, y, P.outline); }

  // neck
  fill(g, headX + 7, headTop + headH, 4, 2, skin);

  // torso
  const torsoY = headTop + headH + 2;
  const torsoH = isFemale ? 26 : 28;
  const torsoX = isFemale ? 18 : 16;
  const torsoW = isFemale ? 28 : 32;

  let armColor = '#6a7888';

  // special clothes
  if (state.storyline === 'spy') {
    fill(g, torsoX, torsoY, torsoW, torsoH, '#1a1a20');
    armColor = '#1a1a20';
  } else if (state.storyline === 'abyss') {
    fill(g, torsoX, torsoY, torsoW, torsoH, '#1a2a3a');
    armColor = '#1a2a3a';
  } else if (state.storyline === 'meta') {
    fill(g, torsoX, torsoY, torsoW, torsoH, '#4a3a6a');
    armColor = '#4a3a6a';
  } else if (state.storyline === 'idol' || state.storyline === 'superstar') {
    fill(g, torsoX, torsoY, torsoW, torsoH, '#ffffff'); 
    fill(g, torsoX+4, torsoY+4, torsoW-8, 4, '#ff0055'); 
    armColor = '#ffffff';
  } else if (state.MNY >= 8) {
    // Suit
    fill(g, torsoX, torsoY, torsoW, torsoH, '#2b2b2b'); 
    fill(g, torsoX + 8, torsoY, torsoW - 16, torsoH, '#ffffff'); 
    fill(g, torsoX + torsoW/2 - 1, torsoY, 2, 12, '#8a2020'); 
    armColor = '#2b2b2b';
  } else if (state.MNY >= 5) {
    // Striped shirt
    fill(g, torsoX, torsoY, torsoW, torsoH, '#d0d8e0');
    for(let y = torsoY; y < torsoY + torsoH; y+=3) fill(g, torsoX, y, torsoW, 1, '#5a7898');
    armColor = '#d0d8e0';
  } else {
    // Hoodie
    fill(g, torsoX, torsoY, torsoW, torsoH, '#6a7888');
    fill(g, torsoX - 2, torsoY - 2, 6, 6, '#5a6878');
    fill(g, torsoX + torsoW - 4, torsoY - 2, 6, 6, '#5a6878');
    fill(g, torsoX + 8, torsoY + 2, 1, 6, '#e0e0e0');
    fill(g, torsoX + torsoW - 9, torsoY + 2, 1, 6, '#e0e0e0');
    fill(g, torsoX + 6, torsoY + torsoH - 8, torsoW - 12, 6, '#5a6878');
    armColor = '#6a7888';
  }

  // holes for low SOC
  if (state.SOC <= -2 && state.storyline !== 'spy' && state.storyline !== 'abyss' && state.storyline !== 'meta') {
    fill(g, torsoX + 6, torsoY + 10, 3, 3, skin);
    fill(g, torsoX + 18, torsoY + 18, 4, 2, skin);
    fill(g, torsoX + 10, torsoY + 22, 2, 3, skin);
  }

  // outline torso
  for (let x = torsoX; x < torsoX + torsoW; x++) px(g, x, torsoY + torsoH, P.outline);
  for (let y = torsoY; y < torsoY + torsoH; y++) { px(g, torsoX - 1, y, P.outline); px(g, torsoX + torsoW, y, P.outline); }
  for (let x = torsoX; x < torsoX + torsoW; x++) px(g, x, torsoY - 1, P.outline);

  // arms
  const armW = 4;
  const armH = torsoH - 4;
  fill(g, torsoX - armW, torsoY + 2, armW, armH, armColor);
  fill(g, torsoX + torsoW, torsoY + 2, armW, armH, armColor);
  fill(g, torsoX - armW, torsoY + 2 + armH, armW, 3, skin);
  fill(g, torsoX + torsoW, torsoY + 2 + armH, armW, 3, skin);

  // belt
  if (!state.storyline || state.storyline === 'spy') {
    fill(g, torsoX, torsoY + torsoH - 3, torsoW, 2, P.belt);
  }

  // legs
  const legY = torsoY + torsoH + 1;
  const legH = H - legY - 4;
  const legW = 6;
  fill(g, torsoX + 2, legY, legW, legH, state.MNY >= 5 ? P.pantsNice : P.pants);
  fill(g, torsoX + torsoW - legW - 2, legY, legW, legH, state.MNY >= 5 ? P.pantsNice : P.pants);

  // shoes
  if (state.storyline === 'idol' || state.storyline === 'superstar') {
    fill(g, torsoX + 1, H - 4, legW + 2, 4, '#ffffff');
  } else if (state.MNY >= 8) {
    fill(g, torsoX + 1, H - 4, legW + 2, 4, P.shoesNice);
    fill(g, torsoX + 3, H - 4, 2, 1, '#6a3010'); 
    fill(g, torsoX + torsoW - legW - 3, H - 4, legW + 2, 4, P.shoesNice);
    fill(g, torsoX + torsoW - legW - 1, H - 4, 2, 1, '#6a3010'); 
  } else if (state.MNY >= 5) {
    fill(g, torsoX + 1, H - 4, legW + 2, 4, P.shoesSneaker);
    fill(g, torsoX + 1, H - 2, legW + 2, 2, '#4080e0');
    fill(g, torsoX + torsoW - legW - 3, H - 4, legW + 2, 4, P.shoesSneaker);
    fill(g, torsoX + torsoW - legW - 3, H - 2, legW + 2, 2, '#4080e0');
  } else {
    fill(g, torsoX + 1, H - 4, legW + 2, 4, P.shoes);
    fill(g, torsoX + torsoW - legW - 3, H - 4, legW + 2, 4, P.shoes);
  }

  return { headTop, headH, headX, headW, torsoX, torsoY, torsoW, torsoH };
}

// ── Hair ──

function drawHair(g, state, m) {
  const isFemale = state.sex === 1;
  let hair = P.hairBlack;
  if (state.APP >= 8) hair = P.hairLight;
  else if (state.APP <= 2) hair = '#202a20';
  else if (state.APP >= 5) hair = P.hairBrown;
  else if (state.APP >= 3) hair = P.hairDark;

  fill(g, m.headX - 1, m.headTop - 4, m.headW + 2, 6, hair);
  fill(g, m.headX, m.headTop - 5, m.headW, 2, hair);

  if (isFemale) {
    fill(g, m.headX - 3, m.headTop - 2, 3, 20, hair);
    fill(g, m.headX + m.headW, m.headTop - 2, 3, 20, hair);
    fill(g, m.headX - 2, m.headTop + 18, 2, 8, hair);
    fill(g, m.headX + m.headW, m.headTop + 18, 2, 8, hair);
    fill(g, m.headX, m.headTop, m.headW, 3, hair);
    fill(g, m.headX + m.headW / 2, m.headTop - 3, 1, 4, P.outline);
  } else {
    fill(g, m.headX - 2, m.headTop - 2, 2, 6, hair);
    fill(g, m.headX + m.headW, m.headTop - 2, 2, 6, hair);
    if (state.PER >= 5) {
      fill(g, m.headX + 2, m.headTop - 6, 3, 2, hair);
      fill(g, m.headX + 8, m.headTop - 7, 3, 3, hair);
      fill(g, m.headX + 14, m.headTop - 6, 3, 2, hair);
    }
  }

  if (state.APP <= 2) {
    px(g, m.headX - 3, m.headTop - 5, hair); px(g, m.headX + m.headW + 2, m.headTop - 3, hair);
    px(g, m.headX + 4, m.headTop - 6, hair); px(g, m.headX + 12, m.headTop - 7, hair);
    fill(g, m.headX + m.headW + 1, m.headTop + 5, 2, 1, hair);
  }
}

// ── Face ──

function drawFace(g, state, m) {
  const eyeY = m.headTop + 8;
  const eyeLX = m.headX + 4;
  const eyeRX = m.headX + 12;

  fill(g, eyeLX, eyeY, 3, 2, P.eyeWhite);
  fill(g, eyeRX, eyeY, 3, 2, P.eyeWhite);
  if (state.INT <= 2) {
    // Derpy eyes
    px(g, eyeLX + 2, eyeY, P.eye); px(g, eyeLX + 2, eyeY + 1, P.eye);
    px(g, eyeRX, eyeY + 1, P.eye); px(g, eyeRX, eyeY + 2, P.eye);
    // Drool
    fill(g, m.headX + 11, m.headTop + 17, 2, 4, '#a0c0f0');
  } else {
    px(g, eyeLX + 1, eyeY, P.eye); px(g, eyeLX + 1, eyeY + 1, P.eye);
    px(g, eyeRX + 1, eyeY, P.eye); px(g, eyeRX + 1, eyeY + 1, P.eye);
    px(g, eyeLX + 2, eyeY, P.eyeHighlight); px(g, eyeRX + 2, eyeY, P.eyeHighlight);
  }

  if (state.APP >= 6) {
    fill(g, eyeLX - 1, eyeY, 5, 3, P.eyeWhite); fill(g, eyeRX - 1, eyeY, 5, 3, P.eyeWhite);
    px(g, eyeLX + 1, eyeY, P.eye); px(g, eyeLX + 1, eyeY + 1, P.eye); px(g, eyeLX + 2, eyeY + 1, P.eye);
    px(g, eyeRX + 1, eyeY, P.eye); px(g, eyeRX + 1, eyeY + 1, P.eye); px(g, eyeRX + 2, eyeY + 1, P.eye);
    px(g, eyeLX + 3, eyeY, P.eyeHighlight); px(g, eyeRX + 3, eyeY, P.eyeHighlight);
  }

  if (state.INT >= 6) {
    const gy = eyeY - 1;
    for (let x = eyeLX - 2; x <= eyeLX + 4; x++) { px(g, x, gy, P.glasses); px(g, x, gy + 4, P.glasses); }
    for (let y = gy; y <= gy + 4; y++) { px(g, eyeLX - 2, y, P.glasses); px(g, eyeLX + 4, y, P.glasses); }
    for (let x = eyeRX - 2; x <= eyeRX + 4; x++) { px(g, x, gy, P.glasses); px(g, x, gy + 4, P.glasses); }
    for (let y = gy; y <= gy + 4; y++) { px(g, eyeRX - 2, y, P.glasses); px(g, eyeRX + 4, y, P.glasses); }
    fill(g, eyeLX + 4, gy + 1, eyeRX - eyeLX - 5, 1, P.glasses);
    fill(g, eyeLX - 1, gy + 1, 5, 3, P.glassesLens); fill(g, eyeRX - 1, gy + 1, 5, 3, P.glassesLens);
    px(g, eyeLX + 1, eyeY, P.eye); px(g, eyeLX + 1, eyeY + 1, P.eye);
    px(g, eyeRX + 1, eyeY, P.eye); px(g, eyeRX + 1, eyeY + 1, P.eye);
  }

  fill(g, eyeLX, eyeY - 3, 4, 1, P.outline); fill(g, eyeRX, eyeY - 3, 4, 1, P.outline);
  if ((state.HAP ?? 5) <= 2) { px(g, eyeLX, eyeY - 4, P.outline); px(g, eyeRX + 3, eyeY - 4, P.outline); }

  px(g, m.headX + 8, m.headTop + 13, P.outline); px(g, m.headX + 9, m.headTop + 13, P.outline); px(g, m.headX + 9, m.headTop + 14, P.outline);

  const mouthY = m.headTop + 17;
  const isCoughing = state.HLT <= 2 && (Date.now() % 4000) < 500;
  if (isCoughing) {
    fill(g, m.headX + 5, mouthY, 4, 3, '#000');
    return; // skip normal mouth
  }
  const hap = state.HAP ?? 5;
  if (hap >= 7) {
    px(g, m.headX + 5, mouthY, P.mouth); fill(g, m.headX + 6, mouthY + 1, 6, 1, P.mouth); px(g, m.headX + 12, mouthY, P.mouth);
    fill(g, m.headX + 7, mouthY + 2, 4, 1, '#fff'); 
  } else if (hap >= 4) {
    fill(g, m.headX + 6, mouthY, 6, 1, P.mouth); px(g, m.headX + 5, mouthY - 1, P.outline); px(g, m.headX + 12, mouthY - 1, P.outline);
  } else if (hap >= 2) {
    fill(g, m.headX + 6, mouthY, 6, 1, P.outline);
  } else {
    px(g, m.headX + 5, mouthY + 1, P.outline); fill(g, m.headX + 6, mouthY, 6, 1, P.outline); px(g, m.headX + 12, mouthY + 1, P.outline);
  }

  if (state.MNY <= -2) {
    fill(g, m.headX + 2, m.headTop + 12, 3, 2, '#8a6a4a');
    fill(g, m.headX + 13, m.headTop + 10, 2, 2, '#8a6a4a');
    px(g, m.headX + 6, m.headTop + 15, '#8a6a4a');
  }
  
  if (state.HLT >= 7) {
    fill(g, m.headX + 1, m.headTop + 14, 3, 2, P.cheek); fill(g, m.headX + 14, m.headTop + 14, 3, 2, P.cheek);
  }
}

// ── Accessories on body ──

function drawAccessories(g, state, m) {
  if (state.school === 'T20') fill(g, m.torsoX + 2, m.torsoY + 3, 4, 4, P.badgeGold);
  else if (state.school === 'T50') fill(g, m.torsoX + 2, m.torsoY + 3, 4, 4, P.badgeSilver);
  else if (state.school === 'T100+') fill(g, m.torsoX + 2, m.torsoY + 3, 4, 4, P.badgeBronze);

  if (state.storyline === 'spy') {
    fill(g, m.torsoX + 2, m.torsoY + 6, 2, 12, '#2a2020');
    fill(g, m.torsoX + m.torsoW - 4, m.torsoY + 6, 2, 12, '#2a2020');
  } else if (state.storyline === 'abyss') {
    fill(g, m.torsoX + 4, m.torsoY + 8, m.torsoW - 8, 1, '#1a5a80');
    fill(g, m.torsoX + 6, m.torsoY + 14, m.torsoW - 12, 1, '#1a5a80');
    fill(g, m.torsoX + 4, m.torsoY + 20, m.torsoW - 8, 1, '#1a5a80');
  } else if (state.storyline === 'meta') {
    fill(g, m.torsoX + 3, m.torsoY + 5, 4, 3, P.bgMetaGlitch);
    fill(g, m.torsoX + m.torsoW - 8, m.torsoY + 12, 5, 2, '#e040e0');
  }
}

// ── Status Bubble (top-right corner) ──

function drawBubble(ctx, state) {
  let icon = null;
  let color = '#888';
  const hap = state.HAP ?? 5;
  const rel = state.relationship;

  if (state.storyline === 'spy') { icon = '🔫'; }
  else if (state.storyline === 'abyss') { icon = '💻'; }
  else if (state.storyline === 'meta') { icon = '🐛'; }
  else if (state.storyline === 'idol' || state.storyline === 'superstar') { icon = '🎤'; }
  else if (state.storyline === 'poker' || state.storyline === 'triton') { icon = '♠️'; }
  else if (state.storyline === 'party') { icon = '🍾'; }
  else if (rel === '已婚' || rel === '二婚' || rel === '同居') { icon = '💍'; color = '#f0a0d0'; }
  else if (rel === '异地恋') { icon = '✈️'; color = '#80c0f0'; }
  else if (rel === '快餐恋') { icon = '🍔'; color = '#f08040'; }
  else if (rel === '傍大款') { icon = '👜'; color = '#d4af37'; }
  else if (rel === '离异') { icon = '💔'; color = '#808080'; }
  else if (rel === '早恋中' || rel === '恋爱' || rel === '暧昧' || rel === '校园恋') { icon = '❤️'; color = '#e04040'; }
  else if (rel === '地下恋') { icon = '🤫'; color = '#a080c0'; }
  else if (hap <= 1) { icon = '💀'; color = '#e04040'; }
  else if (state.HLT <= 1) { icon = '🏥'; color = '#e04040'; }
  else if (hap >= 8) { icon = '😄'; color = '#f0c040'; }
  else if (state.INT >= 9) { icon = '💡'; color = '#f0e040'; }
  else if (state.MNY >= 9) { icon = '💰'; color = '#f0c040'; }
  else if (state.SOC >= 9) { icon = '🤝'; color = '#40a0e0'; }
  else if (state.APP >= 8) { icon = '✨'; color = '#f0a0d0'; }
  else if (state.PER >= 8) { icon = '🔥'; color = '#f07030'; }
  else if (hap <= 3) { icon = '😔'; color = '#8090a0'; }
  else { icon = '📖'; color = '#a0b0c0'; }

  if (!icon) return;

  const bx = (W - 12) * SCALE;
  const by = 2 * SCALE;
  const bw = 10 * SCALE;
  const bh = 10 * SCALE;

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.beginPath();
  ctx.moveTo(bx + 4, by + bh);
  ctx.lineTo(bx + 0, by + bh + 6);
  ctx.lineTo(bx + 10, by + bh);
  ctx.fill();

  ctx.font = `${SCALE * 6}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, bx + bw / 2, by + bh / 2 + 1);
}

// ── Props (high-res overlay) ──

function drawProps(ctx, state, m) {
  const subScale = SCALE;
  const baseX = (m.torsoX + m.torsoW - 6) * SCALE;
  const baseY = (m.torsoY + m.torsoH - 4) * SCALE;

  function fRect(sx, sy, sw, sh, color) {
    ctx.fillStyle = color;
    ctx.fillRect(baseX + sx * subScale, baseY + sy * subScale, sw * subScale, sh * subScale);
  }

  const major = state.major;
  if (state.storyline === 'spy') {
    fRect(2, 6, 10, 4, '#2a2a2a'); fRect(12, 6, 4, 3, '#1a1a1a');
    fRect(6, 10, 3, 6, '#2a2a2a'); fRect(2, 5, 2, 1, '#e02020'); 
  } else if (state.storyline === 'abyss') {
    fRect(3, 4, 10, 10, '#0a2040'); fRect(4, 5, 8, 8, '#1a4070');
    fRect(6, 7, 4, 4, '#40a0e0'); fRect(7, 8, 2, 2, '#80e0ff');
    fRect(2, 7, 1, 2, '#a0a0a0'); fRect(2, 11, 1, 2, '#a0a0a0');
    fRect(13, 7, 1, 2, '#a0a0a0'); fRect(13, 11, 1, 2, '#a0a0a0');
  } else if (state.storyline === 'meta') {
    fRect(0, 2, 16, 12, '#fff'); fRect(1, 3, 14, 2, '#e04040');
    fRect(2, 6, 4, 1, '#333'); fRect(2, 8, 8, 1, '#333'); fRect(2, 10, 6, 1, '#333');
    fRect(10, 10, 5, 3, '#3a80e0');
  } else if (major === 'CS' || state.storyline === 'ceo') {
    fRect(2, 2, 14, 10, P.laptop); fRect(3, 3, 12, 6, '#111');
    fRect(4, 4, 10, 4, '#2a5070'); fRect(2, 10, 14, 2, '#222');
    fRect(5, 4, 2, 1, '#40e870'); fRect(5, 5, 4, 1, '#40e870'); fRect(5, 6, 3, 1, '#40e870');
  } else if (major === '商科') {
    fRect(4, 1, 8, 14, P.phone); fRect(5, 2, 6, 12, '#111');
    fRect(6, 10, 1, 3, '#2ecc71'); fRect(7, 8, 1, 5, '#e74c3c');
    fRect(8, 5, 1, 4, '#2ecc71'); fRect(9, 4, 1, 2, '#e74c3c');
  } else if (major === '理科') {
    fRect(5, 1, 4, 12, '#a8d8ea'); fRect(6, 6, 2, 6, P.testTube);
    fRect(5, 12, 4, 2, '#a8d8ea'); fRect(6, 7, 1, 1, '#fff'); fRect(7, 9, 1, 1, '#fff');
  } else if (major === '文科' || major === '文艺') {
    fRect(2, 4, 12, 10, P.palette); fRect(3, 5, 3, 3, '#fff');
    fRect(8, 5, 3, 3, '#e74c3c'); fRect(10, 9, 3, 3, P.testTube); fRect(5, 10, 3, 3, '#2ecc71');
  } else if (state.storyline === 'idol' || state.storyline === 'superstar') {
    // Microphone
    fRect(6, 2, 6, 6, '#a0a0a0'); fRect(7, 3, 4, 4, '#333');
    fRect(8, 8, 2, 10, '#222');
  } else if (state.storyline === 'poker' || state.storyline === 'triton' || state.storyline === 'local_shark') {
    // Poker cards
    fRect(4, 6, 6, 8, '#fff'); fRect(8, 8, 6, 8, '#fff');
    fRect(5, 7, 2, 2, '#e02020'); fRect(9, 9, 2, 2, '#111');
  } else {
    fRect(4, 4, 10, 8, P.book); fRect(5, 4, 8, 8, '#a02b1f'); fRect(4, 5, 10, 1, P.outline);
  }
}

// ── Main render ──


function drawFrame(time) {
  if (!lastCanvas || !lastState) return;
  
  // Calculate a gentle breathing offset (sine wave)
  // Math.sin(time / speed) * amplitude
  // Using Math.round to keep it pixel-perfect
  const yOffset = Math.round(Math.sin(time / 200) * 1.5); 
  
  const g = makeGrid();

  // Background is static (yOffset = 0)
  drawBackground(g, lastState);
  
  // Character and props move with yOffset
  const m = drawBody(g, lastState, yOffset);
  drawHair(g, lastState, m);
  drawFace(g, lastState, m);
  drawAccessories(g, lastState, m);
  drawPartnerBubble(g, lastState, yOffset);
  if (lastState.HAP <= 2) {
    const cx = m.headX + 2;
    const cy = m.headTop - 12 + Math.round(Math.sin(time / 200));
    fill(g, cx, cy, 14, 6, '#606070');
    fill(g, cx+2, cy-2, 10, 2, '#707080');
    fill(g, cx-2, cy+2, 18, 2, '#505060');
    // Rain
    const rainOffset = Math.floor(time / 100) % 4;
    for(let i=0; i<3; i++) {
      fill(g, cx + 2 + i*5, cy + 8 + rainOffset + i*2, 1, 3, '#80a0e0');
    }
  }
  drawHltEffects(g, lastState, time);
  if (lastState.PER <= 2) {
    const sweatY = 16 + Math.floor((time % 2000) / 200);
    fill(g, m.headX + 14, sweatY + yOffset, 2, 3, '#80c0f0');
    px(g, m.headX + 14, sweatY + yOffset - 1, '#80c0f0');
  }

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

  // Draw high-res overlay props (they use m.torsoY which is already offset)
  drawProps(ctx, lastState, m);
  drawBubble(ctx, lastState);

  animFrameId = requestAnimationFrame(drawFrame);
}

export function renderAvatar(canvas, state) {
  lastCanvas = canvas;
  lastState = state;
  
  // Cancel previous animation loop if exists to prevent speeding up
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
  }
  
  // Start the animation loop
  animFrameId = requestAnimationFrame(drawFrame);
}

