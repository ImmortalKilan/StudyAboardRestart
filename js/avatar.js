const W = 32, H = 48, SCALE = 6;

const PALETTE = {
  outline: '#1a1a1a',
  skinPale: '#f7d9b8',
  skinTan: '#d49a72',
  skinFlush: '#e6a890',
  hairDark: '#2b2118',
  hairBrown: '#5a3a22',
  hairLight: '#c9a063',
  shirtPlain: '#7d8a96',
  shirtNice: '#3d5a80',
  shirtRich: '#5b2d4e',
  pants: '#2a2f3a',
  shoes: '#1f1f1f',
  glasses: '#1a1a1a',
  badgeT20: '#b8860b',
  badgeT50: '#7a7a7a',
  badgeT100: '#8a5a3a',
  bookProp: '#c0392b',
  laptopProp: '#444',
  bagProp: '#3a2a1a',
  cheek: '#e88a8a',
  eyeNormal: '#1a1a1a',
  bg: 'transparent'
};

function makeGrid() {
  const g = [];
  for (let y = 0; y < H; y++) g.push(new Array(W).fill(null));
  return g;
}

function fillRect(g, x, y, w, h, c) {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++)
      if (yy >= 0 && yy < H && xx >= 0 && xx < W) g[yy][xx] = c;
}

function px(g, x, y, c) {
  if (y >= 0 && y < H && x >= 0 && x < W) g[y][x] = c;
}

function drawBody(g, state) {
  const isFemale = state.sex === 1;
  const skin = state.HLT >= 7 ? PALETTE.skinFlush : (state.HLT <= 3 ? PALETTE.skinPale : PALETTE.skinTan);

  let shirt = PALETTE.shirtPlain;
  if (state.MNY >= 7) shirt = PALETTE.shirtRich;
  else if (state.MNY >= 4) shirt = PALETTE.shirtNice;

  const headTop = state.age >= 20 ? 6 : 7;
  const headH = 11;
  const headX = 11, headW = 10;

  fillRect(g, headX, headTop, headW, headH, skin);
  for (let x = headX; x < headX + headW; x++) {
    px(g, x, headTop - 1, PALETTE.outline);
    px(g, x, headTop + headH, PALETTE.outline);
  }
  for (let y = headTop; y < headTop + headH; y++) {
    px(g, headX - 1, y, PALETTE.outline);
    px(g, headX + headW, y, PALETTE.outline);
  }

  const torsoY = headTop + headH + 1;
  const torsoH = isFemale ? 14 : 15;
  const torsoX = isFemale ? 10 : 9;
  const torsoW = isFemale ? 12 : 14;

  fillRect(g, torsoX, torsoY, torsoW, torsoH, shirt);
  for (let x = torsoX; x < torsoX + torsoW; x++) px(g, x, torsoY + torsoH, PALETTE.outline);
  for (let y = torsoY; y < torsoY + torsoH; y++) {
    px(g, torsoX - 1, y, PALETTE.outline);
    px(g, torsoX + torsoW, y, PALETTE.outline);
  }

  if (isFemale) {
    fillRect(g, torsoX - 1, torsoY + 2, 1, 4, shirt);
    fillRect(g, torsoX + torsoW, torsoY + 2, 1, 4, shirt);
  }

  const legY = torsoY + torsoH + 1;
  const legH = H - legY - 2;
  fillRect(g, torsoX + 2, legY, 4, legH, PALETTE.pants);
  fillRect(g, torsoX + torsoW - 6, legY, 4, legH, PALETTE.pants);
  fillRect(g, torsoX + 1, H - 2, 5, 2, PALETTE.shoes);
  fillRect(g, torsoX + torsoW - 6, H - 2, 5, 2, PALETTE.shoes);

  return { headTop, headH, headX, headW, torsoX, torsoY, torsoW, torsoH };
}

function drawHair(g, state, m) {
  const isFemale = state.sex === 1;
  let hair = PALETTE.hairDark;
  if (state.APP >= 7) hair = PALETTE.hairLight;
  else if (state.APP >= 4) hair = PALETTE.hairBrown;

  fillRect(g, m.headX - 1, m.headTop - 2, m.headW + 2, 3, hair);
  if (isFemale) {
    fillRect(g, m.headX - 2, m.headTop, 1, 8, hair);
    fillRect(g, m.headX + m.headW + 1, m.headTop, 1, 8, hair);
    fillRect(g, m.headX - 1, m.headTop + 8, 1, 4, hair);
    fillRect(g, m.headX + m.headW, m.headTop + 8, 1, 4, hair);
  } else {
    fillRect(g, m.headX - 1, m.headTop, 1, 2, hair);
    fillRect(g, m.headX + m.headW, m.headTop, 1, 2, hair);
  }

  if (state.PER <= 3) {
    px(g, m.headX + 2, m.headTop - 2, PALETTE.outline);
    px(g, m.headX + 5, m.headTop - 2, PALETTE.outline);
  }
}

function drawFace(g, state, m) {
  const eyeY = m.headTop + 4;
  const eyeLX = m.headX + 2;
  const eyeRX = m.headX + 7;

  px(g, eyeLX, eyeY, PALETTE.eyeNormal);
  px(g, eyeRX, eyeY, PALETTE.eyeNormal);
  if (state.APP >= 6) {
    px(g, eyeLX + 1, eyeY, PALETTE.eyeNormal);
    px(g, eyeRX + 1, eyeY, PALETTE.eyeNormal);
  }

  if (state.INT >= 6) {
    fillRect(g, eyeLX - 1, eyeY - 1, 4, 3, null);
    px(g, eyeLX - 1, eyeY, PALETTE.glasses);
    px(g, eyeLX - 1, eyeY - 1, PALETTE.glasses);
    px(g, eyeLX - 1, eyeY + 1, PALETTE.glasses);
    px(g, eyeLX, eyeY - 1, PALETTE.glasses);
    px(g, eyeLX + 1, eyeY - 1, PALETTE.glasses);
    px(g, eyeLX + 2, eyeY - 1, PALETTE.glasses);
    px(g, eyeLX + 2, eyeY, PALETTE.glasses);
    px(g, eyeLX + 2, eyeY + 1, PALETTE.glasses);
    px(g, eyeLX, eyeY + 1, PALETTE.glasses);
    px(g, eyeLX + 1, eyeY + 1, PALETTE.glasses);

    px(g, eyeRX - 1, eyeY, PALETTE.glasses);
    px(g, eyeRX - 1, eyeY - 1, PALETTE.glasses);
    px(g, eyeRX - 1, eyeY + 1, PALETTE.glasses);
    px(g, eyeRX, eyeY - 1, PALETTE.glasses);
    px(g, eyeRX + 1, eyeY - 1, PALETTE.glasses);
    px(g, eyeRX + 2, eyeY - 1, PALETTE.glasses);
    px(g, eyeRX + 2, eyeY, PALETTE.glasses);
    px(g, eyeRX + 2, eyeY + 1, PALETTE.glasses);
    px(g, eyeRX, eyeY + 1, PALETTE.glasses);
    px(g, eyeRX + 1, eyeY + 1, PALETTE.glasses);

    px(g, eyeLX, eyeY, PALETTE.eyeNormal);
    px(g, eyeRX, eyeY, PALETTE.eyeNormal);
    px(g, eyeLX + 3, eyeY, PALETTE.glasses);
  }

  px(g, m.headX + 4, m.headTop + 6, PALETTE.outline);
  px(g, m.headX + 5, m.headTop + 6, PALETTE.outline);

  const mouthY = m.headTop + 8;
  const happy = state.HAP ?? 5;
  if (happy >= 7) {
    px(g, m.headX + 3, mouthY, PALETTE.outline);
    px(g, m.headX + 4, mouthY + 1, PALETTE.outline);
    px(g, m.headX + 5, mouthY + 1, PALETTE.outline);
    px(g, m.headX + 6, mouthY, PALETTE.outline);
  } else if (happy <= 3) {
    px(g, m.headX + 3, mouthY + 1, PALETTE.outline);
    px(g, m.headX + 4, mouthY, PALETTE.outline);
    px(g, m.headX + 5, mouthY, PALETTE.outline);
    px(g, m.headX + 6, mouthY + 1, PALETTE.outline);
  } else {
    px(g, m.headX + 4, mouthY, PALETTE.outline);
    px(g, m.headX + 5, mouthY, PALETTE.outline);
  }

  if (state.HLT >= 7) {
    px(g, m.headX + 1, m.headTop + 7, PALETTE.cheek);
    px(g, m.headX + 8, m.headTop + 7, PALETTE.cheek);
  }
}

function drawAccessories(g, state, m) {
  if (state.SOC >= 7) {
    fillRect(g, m.headX + 3, m.headTop + 11, 4, 1, PALETTE.outline);
  }

  if (state.school === 'T20') fillRect(g, m.torsoX + 1, m.torsoY + 2, 2, 2, PALETTE.badgeT20);
  else if (state.school === 'T50') fillRect(g, m.torsoX + 1, m.torsoY + 2, 2, 2, PALETTE.badgeT50);
  else if (state.school === 'T100+') fillRect(g, m.torsoX + 1, m.torsoY + 2, 2, 2, PALETTE.badgeT100);

  const prop = state.profession;
  if (prop === '本科生' || prop === '研究生') {
    fillRect(g, m.torsoX + m.torsoW - 1, m.torsoY + m.torsoH - 4, 4, 3, PALETTE.bookProp);
    px(g, m.torsoX + m.torsoW - 1, m.torsoY + m.torsoH - 5, PALETTE.outline);
  } else if (prop === '理工生' || prop === '海外打工人') {
    fillRect(g, m.torsoX + m.torsoW - 1, m.torsoY + m.torsoH - 4, 5, 3, PALETTE.laptopProp);
  } else if (prop === '商科生' || prop === '海归') {
    fillRect(g, m.torsoX - 3, m.torsoY + m.torsoH - 5, 3, 5, PALETTE.bagProp);
    px(g, m.torsoX - 2, m.torsoY + m.torsoH - 6, PALETTE.outline);
  }

  if (state.PER >= 7) {
    fillRect(g, m.torsoX, m.torsoY + 4, m.torsoW, 1, '#000');
  }
}

export function renderAvatar(canvas, state) {
  const g = makeGrid();
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
}
