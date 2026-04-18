const W = 64, H = 96, SCALE = 3;

const P = {
  // skin
  skinLight: '#fce4c8', skinMid: '#e8c8a0', skinDark: '#d4a878', skinFlush: '#f0b8a0',
  // hair
  hairBlack: '#1a1416', hairDark: '#3a2820', hairBrown: '#6a4a30', hairLight: '#c8a050',
  // outline
  outline: '#181818',
  // eyes
  eye: '#181818', eyeWhite: '#fff', eyeHighlight: '#fff',
  // mouth
  mouth: '#c04040',
  // cheek
  cheek: '#f0a0a0',
  // clothing
  shirtBasic: '#6a7888', shirtNice: '#3a5878', shirtRich: '#5a2848',
  shirtSpy: '#1a1a20', shirtAbyss: '#1a2a3a', shirtMeta: '#4a3a6a',
  pants: '#2a2e38', pantsNice: '#1a2030',
  shoes: '#1a1a1a', shoesNice: '#4a2a1a',
  // accessories
  glasses: '#2a2a2a', glassesLens: 'rgba(180,210,240,0.4)',
  belt: '#3a3020',
  badgeGold: '#d4a820', badgeSilver: '#a0a0a0', badgeBronze: '#8a5a30',
  tie: '#8a2020',
  // props
  book: '#b83028', laptop: '#444', phone: '#bbb',
  testTube: '#3498db', palette: '#daa520',
  briefcase: '#5a3a1a',
  // bubble
  bubbleBg: '#fff', bubbleBorder: '#ccc',
  // backgrounds
  bgSchoolWall: '#2a3040', bgSchoolBoard: '#1a4a2a', bgSchoolChalk: '#d8d8c8',
  bgCampusGrass: '#1a3a20', bgCampusSky: '#1a2848', bgCampusTree: '#1a4a28',
  bgCampusLeaf: '#2a6a30', bgCampusTrunk: '#4a3020',
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
  if (state.storyline === 'spy') return drawBgSpy(g, state);
  if (state.storyline === 'abyss') return drawBgAbyss(g, state);
  if (state.storyline === 'meta') return drawBgMeta(g, state);
  if (state.age <= 18) return drawBgSchool(g);
  if (state.age <= 25 && state.overseas) return drawBgCampus(g);
  if (state.age <= 40) return drawBgOffice(g);
  return drawBgHome(g);
}

function drawBgSchool(g) {
  fill(g, 0, 0, W, H, P.bgSchoolWall);
  // blackboard
  fill(g, 4, 4, 28, 16, P.bgSchoolBoard);
  fill(g, 5, 5, 26, 14, '#1a5a2a');
  // chalk text lines
  for (let i = 0; i < 3; i++) {
    fill(g, 8, 8 + i * 4, 10 + (i % 2 ? 4 : 0), 1, P.bgSchoolChalk);
  }
  // floor
  fill(g, 0, 76, W, 20, '#1a1820');
  fill(g, 0, 76, W, 1, '#2a2838');
}

function drawBgCampus(g) {
  // sky gradient
  fill(g, 0, 0, W, 50, P.bgCampusSky);
  fill(g, 0, 50, W, 10, '#1a3038');
  // grass
  fill(g, 0, 60, W, 36, P.bgCampusGrass);
  fill(g, 0, 60, W, 2, '#2a5a30');
  // tree left
  fill(g, 2, 30, 4, 30, P.bgCampusTrunk);
  fill(g, 0, 18, 8, 14, P.bgCampusLeaf);
  fill(g, 1, 15, 6, 5, P.bgCampusLeaf);
  // tree right
  fill(g, 54, 34, 4, 26, P.bgCampusTrunk);
  fill(g, 51, 22, 10, 14, P.bgCampusLeaf);
  fill(g, 52, 19, 8, 5, P.bgCampusLeaf);
  // path
  fill(g, 24, 62, 16, 34, '#3a3830');
  fill(g, 23, 62, 1, 34, '#2a2820');
  fill(g, 40, 62, 1, 34, '#2a2820');
}

function drawBgOffice(g) {
  fill(g, 0, 0, W, H, '#1a1e28');
  // desk
  fill(g, 0, 70, W, 4, P.bgOfficeDeskTop);
  fill(g, 2, 74, 4, 22, '#2a2820');
  fill(g, 58, 74, 4, 22, '#2a2820');
  // monitor on desk
  fill(g, 40, 54, 18, 14, P.bgOfficeMonitor);
  fill(g, 42, 56, 14, 10, P.bgOfficeScreen);
  fill(g, 47, 68, 4, 2, '#2a2a2a');
  // small lines on screen
  fill(g, 44, 58, 8, 1, '#3a6090');
  fill(g, 44, 60, 6, 1, '#3a6090');
  fill(g, 44, 62, 10, 1, '#3a6090');
  // floor
  fill(g, 0, 88, W, 8, '#141820');
}

function drawBgHome(g) {
  fill(g, 0, 0, W, H, P.bgHomeWall);
  // window
  fill(g, 40, 10, 18, 22, P.bgHomeWindow);
  fill(g, 40, 10, 18, 1, '#3a3838');
  fill(g, 40, 31, 18, 1, '#3a3838');
  fill(g, 40, 10, 1, 22, '#3a3838');
  fill(g, 57, 10, 1, 22, '#3a3838');
  fill(g, 49, 10, 1, 22, '#3a3838');
  // stars
  px(g, 44, 15, P.bgHomeStar);
  px(g, 52, 18, P.bgHomeStar);
  px(g, 46, 22, P.bgHomeStar);
  px(g, 55, 14, P.bgHomeStar);
  // floor
  fill(g, 0, 76, W, 20, '#1a1820');
  fill(g, 0, 76, W, 1, '#2a2838');
}

function drawBgSpy(g) {
  fill(g, 0, 0, W, H, P.bgSpyDark);
  // red laser grid
  for (let y = 10; y < H; y += 16) fill(g, 0, y, W, 1, '#200808');
  for (let x = 8; x < W; x += 12) fill(g, x, 0, 1, H, '#200808');
  // bright laser beam
  fill(g, 0, 42, W, 1, P.bgSpyLaser);
  fill(g, 0, 58, W, 1, '#a01818');
  // floor
  fill(g, 0, 82, W, 14, '#0a0a0a');
  fill(g, 0, 82, W, 1, '#1a1a1a');
}

function drawBgAbyss(g) {
  fill(g, 0, 0, W, H, P.bgAbyssGlow);
  // server rack lines
  for (let x = 4; x < W; x += 8) fill(g, x, 4, 2, H - 8, '#0a1a30');
  // blinking LEDs
  const leds = [[6,10],[14,20],[22,14],[30,28],[38,8],[46,24],[54,18],[6,40],[22,48],[38,38],[54,44]];
  for (const [lx, ly] of leds) px(g, lx, ly, Math.random() > 0.3 ? P.bgAbyssLine : '#40a0e0');
  // data stream
  for (let y = 0; y < H; y += 3) {
    const x = 30 + ((y * 7) % 11) - 5;
    if (x >= 0 && x < W) px(g, x, y, '#1a5a80');
  }
  // floor
  fill(g, 0, 82, W, 14, '#060e18');
}

function drawBgMeta(g) {
  fill(g, 0, 0, W, H, P.bgMetaGrid);
  // grid pattern
  for (let x = 0; x < W; x += 8) fill(g, x, 0, 1, H, '#200a38');
  for (let y = 0; y < H; y += 8) fill(g, 0, y, W, 1, '#200a38');
  // glitch blocks
  fill(g, 2, 8, 6, 3, P.bgMetaGlitch);
  fill(g, 50, 30, 8, 2, P.bgMetaGlitch);
  fill(g, 10, 70, 12, 2, '#e040e0');
  fill(g, 44, 60, 5, 4, P.bgMetaGlitch);
  // floating text fragments
  fill(g, 48, 12, 10, 1, '#8040c0');
  fill(g, 4, 50, 7, 1, '#8040c0');
  // floor (glitchy)
  fill(g, 0, 82, W, 14, '#0a0418');
  fill(g, 8, 84, 20, 1, P.bgMetaGlitch);
}

// ── Character Body ──

function drawBody(g, state) {
  const isFemale = state.sex === 1;
  const skin = state.HLT >= 7 ? P.skinFlush : (state.HLT <= 2 ? P.skinLight : P.skinMid);

  let shirt = P.shirtBasic;
  if (state.storyline === 'spy') shirt = P.shirtSpy;
  else if (state.storyline === 'abyss') shirt = P.shirtAbyss;
  else if (state.storyline === 'meta') shirt = P.shirtMeta;
  else if (state.MNY >= 7) shirt = P.shirtRich;
  else if (state.MNY >= 4) shirt = P.shirtNice;

  const headTop = 14;
  const headH = 20, headW = 18;
  const headX = 23;

  // head shape (rounded)
  fill(g, headX + 1, headTop, headW - 2, headH, skin);
  fill(g, headX, headTop + 1, headW, headH - 2, skin);
  // outline
  for (let x = headX + 1; x < headX + headW - 1; x++) {
    px(g, x, headTop - 1, P.outline);
    px(g, x, headTop + headH, P.outline);
  }
  px(g, headX, headTop, P.outline);
  px(g, headX + headW - 1, headTop, P.outline);
  px(g, headX, headTop + headH - 1, P.outline);
  px(g, headX + headW - 1, headTop + headH - 1, P.outline);
  for (let y = headTop + 1; y < headTop + headH - 1; y++) {
    px(g, headX - 1, y, P.outline);
    px(g, headX + headW, y, P.outline);
  }

  // neck
  fill(g, headX + 7, headTop + headH, 4, 2, skin);

  // torso
  const torsoY = headTop + headH + 2;
  const torsoH = isFemale ? 26 : 28;
  const torsoX = isFemale ? 18 : 16;
  const torsoW = isFemale ? 28 : 32;

  fill(g, torsoX, torsoY, torsoW, torsoH, shirt);
  // outline torso
  for (let x = torsoX; x < torsoX + torsoW; x++) px(g, x, torsoY + torsoH, P.outline);
  for (let y = torsoY; y < torsoY + torsoH; y++) {
    px(g, torsoX - 1, y, P.outline);
    px(g, torsoX + torsoW, y, P.outline);
  }
  for (let x = torsoX; x < torsoX + torsoW; x++) px(g, x, torsoY - 1, P.outline);

  // arms
  const armW = 4;
  const armH = torsoH - 4;
  fill(g, torsoX - armW, torsoY + 2, armW, armH, shirt);
  fill(g, torsoX + torsoW, torsoY + 2, armW, armH, shirt);
  // hands
  fill(g, torsoX - armW, torsoY + 2 + armH, armW, 3, skin);
  fill(g, torsoX + torsoW, torsoY + 2 + armH, armW, 3, skin);

  // belt
  if (!state.storyline) {
    fill(g, torsoX, torsoY + torsoH - 3, torsoW, 2, P.belt);
  }

  // legs
  const legY = torsoY + torsoH + 1;
  const legH = H - legY - 4;
  const legW = 6;
  const legGap = torsoW - legW * 2 - 4;
  fill(g, torsoX + 2, legY, legW, legH, state.MNY >= 5 ? P.pantsNice : P.pants);
  fill(g, torsoX + torsoW - legW - 2, legY, legW, legH, state.MNY >= 5 ? P.pantsNice : P.pants);

  // shoes
  fill(g, torsoX + 1, H - 4, legW + 2, 4, state.MNY >= 6 ? P.shoesNice : P.shoes);
  fill(g, torsoX + torsoW - legW - 3, H - 4, legW + 2, 4, state.MNY >= 6 ? P.shoesNice : P.shoes);

  return { headTop, headH, headX, headW, torsoX, torsoY, torsoW, torsoH };
}

// ── Hair ──

function drawHair(g, state, m) {
  const isFemale = state.sex === 1;
  let hair = P.hairBlack;
  if (state.APP >= 7) hair = P.hairLight;
  else if (state.APP >= 4) hair = P.hairBrown;
  else if (state.APP >= 2) hair = P.hairDark;

  // top hair
  fill(g, m.headX - 1, m.headTop - 4, m.headW + 2, 6, hair);
  fill(g, m.headX, m.headTop - 5, m.headW, 2, hair);

  if (isFemale) {
    // long side hair
    fill(g, m.headX - 3, m.headTop - 2, 3, 20, hair);
    fill(g, m.headX + m.headW, m.headTop - 2, 3, 20, hair);
    fill(g, m.headX - 2, m.headTop + 18, 2, 8, hair);
    fill(g, m.headX + m.headW, m.headTop + 18, 2, 8, hair);
    // fringe
    fill(g, m.headX, m.headTop, m.headW, 3, hair);
    // part
    fill(g, m.headX + m.headW / 2, m.headTop - 3, 1, 4, P.outline);
  } else {
    // short sides
    fill(g, m.headX - 2, m.headTop - 2, 2, 6, hair);
    fill(g, m.headX + m.headW, m.headTop - 2, 2, 6, hair);
    // spiky top detail
    if (state.PER >= 5) {
      fill(g, m.headX + 2, m.headTop - 6, 3, 2, hair);
      fill(g, m.headX + 8, m.headTop - 7, 3, 3, hair);
      fill(g, m.headX + 14, m.headTop - 6, 3, 2, hair);
    }
  }
}

// ── Face ──

function drawFace(g, state, m) {
  const eyeY = m.headTop + 8;
  const eyeLX = m.headX + 4;
  const eyeRX = m.headX + 12;

  // eye whites
  fill(g, eyeLX, eyeY, 3, 2, P.eyeWhite);
  fill(g, eyeRX, eyeY, 3, 2, P.eyeWhite);
  // pupils
  px(g, eyeLX + 1, eyeY, P.eye);
  px(g, eyeLX + 1, eyeY + 1, P.eye);
  px(g, eyeRX + 1, eyeY, P.eye);
  px(g, eyeRX + 1, eyeY + 1, P.eye);
  // highlights
  px(g, eyeLX + 2, eyeY, P.eyeHighlight);
  px(g, eyeRX + 2, eyeY, P.eyeHighlight);

  // bigger eyes for high APP
  if (state.APP >= 6) {
    fill(g, eyeLX - 1, eyeY, 5, 3, P.eyeWhite);
    fill(g, eyeRX - 1, eyeY, 5, 3, P.eyeWhite);
    px(g, eyeLX + 1, eyeY, P.eye); px(g, eyeLX + 1, eyeY + 1, P.eye); px(g, eyeLX + 2, eyeY + 1, P.eye);
    px(g, eyeRX + 1, eyeY, P.eye); px(g, eyeRX + 1, eyeY + 1, P.eye); px(g, eyeRX + 2, eyeY + 1, P.eye);
    px(g, eyeLX + 3, eyeY, P.eyeHighlight);
    px(g, eyeRX + 3, eyeY, P.eyeHighlight);
  }

  // glasses
  if (state.INT >= 6) {
    const gy = eyeY - 1;
    // left lens frame
    for (let x = eyeLX - 2; x <= eyeLX + 4; x++) { px(g, x, gy, P.glasses); px(g, x, gy + 4, P.glasses); }
    for (let y = gy; y <= gy + 4; y++) { px(g, eyeLX - 2, y, P.glasses); px(g, eyeLX + 4, y, P.glasses); }
    // right lens frame
    for (let x = eyeRX - 2; x <= eyeRX + 4; x++) { px(g, x, gy, P.glasses); px(g, x, gy + 4, P.glasses); }
    for (let y = gy; y <= gy + 4; y++) { px(g, eyeRX - 2, y, P.glasses); px(g, eyeRX + 4, y, P.glasses); }
    // bridge
    fill(g, eyeLX + 4, gy + 1, eyeRX - eyeLX - 5, 1, P.glasses);
    // lens tint
    fill(g, eyeLX - 1, gy + 1, 5, 3, P.glassesLens);
    fill(g, eyeRX - 1, gy + 1, 5, 3, P.glassesLens);
    // re-draw pupils on top
    px(g, eyeLX + 1, eyeY, P.eye); px(g, eyeLX + 1, eyeY + 1, P.eye);
    px(g, eyeRX + 1, eyeY, P.eye); px(g, eyeRX + 1, eyeY + 1, P.eye);
  }

  // eyebrows
  fill(g, eyeLX, eyeY - 3, 4, 1, P.outline);
  fill(g, eyeRX, eyeY - 3, 4, 1, P.outline);
  // angry brows for low HAP
  if ((state.HAP ?? 5) <= 2) {
    px(g, eyeLX, eyeY - 4, P.outline);
    px(g, eyeRX + 3, eyeY - 4, P.outline);
  }

  // nose
  px(g, m.headX + 8, m.headTop + 13, P.outline);
  px(g, m.headX + 9, m.headTop + 13, P.outline);
  px(g, m.headX + 9, m.headTop + 14, P.outline);

  // mouth
  const mouthY = m.headTop + 17;
  const hap = state.HAP ?? 5;
  if (hap >= 7) {
    // big smile
    px(g, m.headX + 5, mouthY, P.mouth);
    fill(g, m.headX + 6, mouthY + 1, 6, 1, P.mouth);
    px(g, m.headX + 12, mouthY, P.mouth);
    fill(g, m.headX + 7, mouthY + 2, 4, 1, '#fff'); // teeth
  } else if (hap >= 4) {
    // slight smile
    fill(g, m.headX + 6, mouthY, 6, 1, P.mouth);
    px(g, m.headX + 5, mouthY - 1, P.outline);
    px(g, m.headX + 12, mouthY - 1, P.outline);
  } else if (hap >= 2) {
    // flat
    fill(g, m.headX + 6, mouthY, 6, 1, P.outline);
  } else {
    // frown
    px(g, m.headX + 5, mouthY + 1, P.outline);
    fill(g, m.headX + 6, mouthY, 6, 1, P.outline);
    px(g, m.headX + 12, mouthY + 1, P.outline);
  }

  // blush for high HLT
  if (state.HLT >= 7) {
    fill(g, m.headX + 1, m.headTop + 14, 3, 2, P.cheek);
    fill(g, m.headX + 14, m.headTop + 14, 3, 2, P.cheek);
  }
}

// ── Accessories on body ──

function drawAccessories(g, state, m) {
  // school badge
  if (state.school === 'T20') fill(g, m.torsoX + 2, m.torsoY + 3, 4, 4, P.badgeGold);
  else if (state.school === 'T50') fill(g, m.torsoX + 2, m.torsoY + 3, 4, 4, P.badgeSilver);
  else if (state.school === 'T100+') fill(g, m.torsoX + 2, m.torsoY + 3, 4, 4, P.badgeBronze);

  // tie for high SOC
  if (state.SOC >= 7 && !state.storyline) {
    fill(g, m.headX + 7, m.headTop + m.headH, 4, 2, P.tie);
    fill(g, m.headX + 8, m.headTop + m.headH + 2, 2, 8, P.tie);
    px(g, m.headX + 7, m.headTop + m.headH + 10, P.tie);
    px(g, m.headX + 10, m.headTop + m.headH + 10, P.tie);
  }

  // spy — holster
  if (state.storyline === 'spy') {
    fill(g, m.torsoX + 2, m.torsoY + 6, 2, 12, '#2a2020');
    fill(g, m.torsoX + m.torsoW - 4, m.torsoY + 6, 2, 12, '#2a2020');
  }

  // abyss — glowing lines on shirt
  if (state.storyline === 'abyss') {
    fill(g, m.torsoX + 4, m.torsoY + 8, m.torsoW - 8, 1, '#1a5a80');
    fill(g, m.torsoX + 6, m.torsoY + 14, m.torsoW - 12, 1, '#1a5a80');
    fill(g, m.torsoX + 4, m.torsoY + 20, m.torsoW - 8, 1, '#1a5a80');
  }

  // meta — pixel artifacts on body
  if (state.storyline === 'meta') {
    fill(g, m.torsoX + 3, m.torsoY + 5, 4, 3, P.bgMetaGlitch);
    fill(g, m.torsoX + m.torsoW - 8, m.torsoY + 12, 5, 2, '#e040e0');
  }
}

// ── Status Bubble (top-right corner) ──

function drawBubble(ctx, state) {
  // Pick icon based on most notable stat
  let icon = null;
  let color = '#888';
  const hap = state.HAP ?? 5;

  if (state.storyline === 'spy') { icon = '🔫'; }
  else if (state.storyline === 'abyss') { icon = '💻'; }
  else if (state.storyline === 'meta') { icon = '🐛'; }
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

  // bubble background
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(bx, by, bw, bh);

  // bubble tail (small triangle pointing down-left)
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.moveTo(bx + 4, by + bh);
  ctx.lineTo(bx + 0, by + bh + 6);
  ctx.lineTo(bx + 10, by + bh);
  ctx.fill();

  // icon
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
    // gun
    fRect(2, 6, 10, 4, '#2a2a2a');
    fRect(12, 6, 4, 3, '#1a1a1a');
    fRect(6, 10, 3, 6, '#2a2a2a');
    fRect(2, 5, 2, 1, '#e02020'); // laser sight
  } else if (state.storyline === 'abyss') {
    // glowing chip
    fRect(3, 4, 10, 10, '#0a2040');
    fRect(4, 5, 8, 8, '#1a4070');
    fRect(6, 7, 4, 4, '#40a0e0');
    fRect(7, 8, 2, 2, '#80e0ff');
    // pins
    fRect(2, 7, 1, 2, '#a0a0a0');
    fRect(2, 11, 1, 2, '#a0a0a0');
    fRect(13, 7, 1, 2, '#a0a0a0');
    fRect(13, 11, 1, 2, '#a0a0a0');
  } else if (state.storyline === 'meta') {
    // floating error box
    fRect(0, 2, 16, 12, '#fff');
    fRect(1, 3, 14, 2, '#e04040');
    fRect(2, 6, 4, 1, '#333');
    fRect(2, 8, 8, 1, '#333');
    fRect(2, 10, 6, 1, '#333');
    fRect(10, 10, 5, 3, '#3a80e0');
  } else if (major === 'CS') {
    fRect(2, 2, 14, 10, P.laptop);
    fRect(3, 3, 12, 6, '#111');
    fRect(4, 4, 10, 4, '#2a5070');
    fRect(2, 10, 14, 2, '#222');
    fRect(5, 4, 2, 1, '#40e870'); fRect(5, 5, 4, 1, '#40e870'); fRect(5, 6, 3, 1, '#40e870');
  } else if (major === '商科') {
    fRect(4, 1, 8, 14, P.phone);
    fRect(5, 2, 6, 12, '#111');
    fRect(6, 10, 1, 3, '#2ecc71');
    fRect(7, 8, 1, 5, '#e74c3c');
    fRect(8, 5, 1, 4, '#2ecc71');
    fRect(9, 4, 1, 2, '#e74c3c');
  } else if (major === '理科') {
    fRect(5, 1, 4, 12, '#a8d8ea');
    fRect(6, 6, 2, 6, P.testTube);
    fRect(5, 12, 4, 2, '#a8d8ea');
    fRect(6, 7, 1, 1, '#fff'); fRect(7, 9, 1, 1, '#fff');
  } else if (major === '文科' || major === '文艺') {
    fRect(2, 4, 12, 10, P.palette);
    fRect(3, 5, 3, 3, '#fff');
    fRect(8, 5, 3, 3, '#e74c3c');
    fRect(10, 9, 3, 3, P.testTube);
    fRect(5, 10, 3, 3, '#2ecc71');
  } else {
    // default book
    fRect(4, 4, 10, 8, P.book);
    fRect(5, 4, 8, 8, '#a02b1f');
    fRect(4, 5, 10, 1, P.outline);
  }
}

// ── Main render ──

export function renderAvatar(canvas, state) {
  const g = makeGrid();

  drawBackground(g, state);
  const m = drawBody(g, state);
  drawHair(g, state, m);
  drawFace(g, state, m);
  drawAccessories(g, state, m);

  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = g[y][x];
      if (c) {
        ctx.fillStyle = c;
        ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
      }
    }
  }

  drawProps(ctx, state, m);
  drawBubble(ctx, state);
}
