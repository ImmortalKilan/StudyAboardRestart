// ── Canvas-native poster renderer ────────────────────────────────────────
// Draws the "金榜判词" share card entirely with Canvas 2D primitives — no
// DOM, no CSS, no html2canvas. This is prep for the WeChat Mini Game port
// (which has no real DOM, only a canvas), but it also runs unmodified in
// any browser canvas, so it's built and tested here first.
//
// Mirrors the layout/values of the web version's `.poster-*` CSS
// (styles.css) and `#poster-template` markup (index.html) as closely as
// Canvas 2D allows. Kept dependency-free (pure functions over a 2D
// context) so it can be dropped into a mini-game project later with at
// most a font-loading and image-loading adaptation.

const W = 720;
const PAD_X = 54;
const PAD_TOP = 38;
const PAD_BOTTOM = 42;
const CONTENT_W = W - PAD_X * 2;

// ── Rank tier tokens — same palette as the CSS custom properties ─────────
const RANK_TOKENS = {
  S: { bg: '#100d09', bg2: '#17130c', fg: '#efe9dc', muted: '#8d8570', faint: '#59503f', gold: '#e8c15a', goldDim: '#b79a4e', seal: '#c8402f', sealDim: '#8a3226', rule: 'rgba(232,193,90,.22)' },
  A: { bg: '#100d09', bg2: '#17130c', fg: '#ece5da', muted: '#8d8070', faint: '#574d3f', gold: '#e0a85c', goldDim: '#b3854a', seal: '#b8582a', sealDim: '#7d3c1f', rule: 'rgba(224,168,92,.22)' },
  B: { bg: '#0a0d10', bg2: '#101418', fg: '#e2e8ec', muted: '#77828c', faint: '#454e57', gold: '#7fb0d8', goldDim: '#6690ab', seal: '#3f6f95', sealDim: '#2c4e69', rule: 'rgba(127,176,216,.2)' },
  C: { bg: '#0d0d0d', bg2: '#131313', fg: '#dcdcdc', muted: '#83837e', faint: '#4c4c48', gold: '#b9c0c6', goldDim: '#8d949a', seal: '#6b7278', sealDim: '#464c50', rule: 'rgba(185,192,198,.18)' },
  D: { bg: '#0c0d0a', bg2: '#12130f', fg: '#dee0d3', muted: '#82866f', faint: '#4b4e3f', gold: '#a8ad82', goldDim: '#82865f', seal: '#6b6f4a', sealDim: '#494c31', rule: 'rgba(168,173,130,.18)' },
  F: { bg: '#0c0d0e', bg2: '#121415', fg: '#dfe2e4', muted: '#767c80', faint: '#454a4d', gold: '#9fb4c2', goldDim: '#7891a0', seal: '#566268', sealDim: '#3d464b', rule: 'rgba(159,180,194,.18)' },
};

const FONT = {
  brand: '900 50px "STSong","Noto Serif SC","SimSun",serif',
  subtitle: 'italic 600 15px Georgia,serif',
  rank: '800 142px "Helvetica Neue",Arial,sans-serif',
  rankPlus: '800 66px "Helvetica Neue",Arial,sans-serif',
  score: '700 47px "SF Mono","Menlo","Courier New",monospace',
  scoreUnit: '600 15px "PingFang SC","Noto Sans SC",sans-serif',
  rarity: '600 12px "PingFang SC","Noto Sans SC",sans-serif',
  titleLabel: '700 12px "PingFang SC","Noto Sans SC",sans-serif',
  title: '700 62px "STXingkai","Xingkai SC","华文行楷",cursive',
  meta: '400 14px "PingFang SC","Noto Sans SC",sans-serif',
  stats: '400 12.5px "PingFang SC","Noto Sans SC",sans-serif',
  statsLbl: '700 11px "PingFang SC","Noto Sans SC",sans-serif',
  endingTag: '700 11.5px "PingFang SC","Noto Sans SC",sans-serif',
  ending: '400 19px "STKaiti","Kaiti SC","STSong",serif',
  footer: '700 17px "PingFang SC","Noto Sans SC",sans-serif',
  qrHint: '600 10.5px "PingFang SC","Noto Sans SC",sans-serif',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, font, maxWidth) {
  ctx.font = font;
  const lines = [];
  let line = '';
  for (const ch of String(text)) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Draws a sequence of {text, font, color} runs left-to-right starting at
// (x, y), returns the ending x — used for meta/stats lines that mix a
// muted label with a bold/colored value inline (canvas has no innerHTML).
function drawRuns(ctx, runs, x, y) {
  let cx = x;
  for (const run of runs) {
    ctx.font = run.font;
    ctx.fillStyle = run.color;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(run.text, cx, y);
    cx += ctx.measureText(run.text).width;
  }
  return cx;
}

function glow(ctx, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}
function noGlow(ctx) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

/**
 * Measures the total card height for the given data (variable — driven
 * mostly by how many lines the meta/ending text wrap into), mirroring the
 * auto-height flow layout of the CSS version.
 */
export function measurePosterHeight(ctx, data) {
  const t = RANK_TOKENS[data.rankKey] || RANK_TOKENS.C;
  let y = PAD_TOP;

  y += 148 + 9 + 13; // brandline row height ≈ QR box + gap + hint label
  y += 10; // brandline margin-bottom

  const heroColW = CONTENT_W - 174 - 24;
  y += 262; // hero row height = portrait height (rank/score/title stack is shorter, portrait dominates)
  // if title wraps to 2 lines it can exceed the portrait's height — account for that
  const titleLines = wrapText(ctx, data.title, FONT.title, heroColW);
  const heroColContentH = 142 /*rank*/ + 8 /*rarity gap*/ + 14 /*rarity*/ + 30 /*title gap*/ + 8 /*label*/ + titleLines.length * 62 * 1.2;
  y = PAD_TOP + 148 + 9 + 13 + 10 + Math.max(262, heroColContentH);

  y += 36 + 1 + 26; // rule

  y += 20; // meta line
  y += 8 + 18; // stats line

  y += 32; // ending margin-top
  const endingLines = wrapText(ctx, data.endingText, FONT.ending, CONTENT_W - 20);
  y += (data.endingTag ? 11.5 + 8 : 0) + endingLines.length * 19 * 1.85;

  y += 38 + 22 + 17; // footer
  y += PAD_BOTTOM;
  return Math.ceil(y);
}

/**
 * Draws the full poster into `ctx` (a Canvas2D context already sized to
 * `width x height` — get `height` from measurePosterHeight first).
 *
 * data = {
 *   rankKey: 'S'|'A'|'B'|'C'|'D'|'F',
 *   rankLetter: 'S+' | 'S' | 'A' ...  (display glyph, plus sign optional)
 *   score: number,
 *   percentileText: string,           // e.g. "超过 99% 的留子" — the "99%" run is auto-detected and bolded
 *   title: string,                    // 称号
 *   avatarImage: CanvasImageSource,    // pre-loaded avatar (square)
 *   qrImage: CanvasImageSource,        // pre-loaded QR code
 *   metaParts: [{ text, bold }],      // deduped meta chips, already resolved to plain strings
 *   stats: [{ label, value, tier }],  // tier: 'hi' | 'mid' | 'lo'
 *   endingTag: string,                // may be ''
 *   endingText: string,
 *   footerRankText: string,           // e.g. "S+"
 * }
 */
export function drawPoster(ctx, height, data) {
  const t = RANK_TOKENS[data.rankKey] || RANK_TOKENS.C;
  const width = W;

  // background
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, width, height);
  const grad = ctx.createRadialGradient(width * 0.15, -height * 0.1, 0, width * 0.15, -height * 0.1, 900);
  grad.addColorStop(0, t.bg2);
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // subtle grain (sparse random dots, cheap stand-in for the CSS repeating-gradient texture)
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#ffffff';
  let seed = 42;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 900; i++) {
    ctx.fillRect(rand() * width, rand() * height, 1, 1);
  }
  ctx.restore();

  // giant background rank watermark glyph
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = t.seal;
  ctx.font = '800 340px "Helvetica Neue",Arial,sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(data.rankKey, width - 260, -50);
  ctx.restore();

  let x = PAD_X;
  let y = PAD_TOP;

  // ── brandline: title/subtitle left, framed QR right ──
  ctx.textBaseline = 'alphabetic';
  glow(ctx, 'rgba(232,193,90,.35)', 24);
  ctx.font = FONT.brand;
  ctx.fillStyle = t.gold;
  ctx.fillText('留学重开模拟器', x, y + 44);
  noGlow(ctx);
  ctx.strokeStyle = t.gold;
  // gold underline accent
  const underlineGrad = ctx.createLinearGradient(x, 0, x + 64, 0);
  underlineGrad.addColorStop(0, t.gold);
  underlineGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = underlineGrad;
  ctx.fillRect(x, y + 56, 64, 3);
  ctx.font = FONT.subtitle;
  ctx.fillStyle = t.goldDim;
  ctx.fillText('S T U D Y   A B R O A D   S I M U L A T O R', x, y + 80);

  // QR frame
  const qrSize = 148, qrX = width - PAD_X - qrSize, qrY = y;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#f6f0e2';
  roundRect(ctx, qrX, qrY, qrSize, qrSize, 4);
  ctx.fill();
  ctx.restore();
  if (data.qrImage) {
    const pad = 8;
    ctx.drawImage(data.qrImage, qrX + pad, qrY + pad, qrSize - pad * 2, qrSize - pad * 2);
  }
  ctx.strokeStyle = t.gold; ctx.lineWidth = 2;
  const bl = 14, bo = 5;
  // corners
  ctx.beginPath(); ctx.moveTo(qrX - bo, qrY - bo + bl); ctx.lineTo(qrX - bo, qrY - bo); ctx.lineTo(qrX - bo + bl, qrY - bo); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(qrX + qrSize + bo - bl, qrY - bo); ctx.lineTo(qrX + qrSize + bo, qrY - bo); ctx.lineTo(qrX + qrSize + bo, qrY - bo + bl); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(qrX - bo, qrY + qrSize + bo - bl); ctx.lineTo(qrX - bo, qrY + qrSize + bo); ctx.lineTo(qrX - bo + bl, qrY + qrSize + bo); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(qrX + qrSize + bo - bl, qrY + qrSize + bo); ctx.lineTo(qrX + qrSize + bo, qrY + qrSize + bo); ctx.lineTo(qrX + qrSize + bo, qrY + qrSize + bo - bl); ctx.stroke();
  ctx.font = FONT.qrHint;
  ctx.fillStyle = t.muted;
  ctx.textAlign = 'center';
  ctx.fillText('扫码来重开', qrX + qrSize / 2, qrY + qrSize + 22);
  ctx.textAlign = 'left';

  y += 148 + 9 + 13 + 10;

  // ── hero row: portrait + rank/score/title ──
  const heroTop = y;
  const portraitW = 174, portraitH = 262;
  const pGrad = ctx.createLinearGradient(x, heroTop, x + portraitW, heroTop + portraitH);
  pGrad.addColorStop(0, t.bg2); pGrad.addColorStop(1, t.bg);
  ctx.fillStyle = pGrad;
  roundRect(ctx, x, heroTop, portraitW, portraitH, 4);
  ctx.fill();
  ctx.strokeStyle = t.rule; ctx.lineWidth = 1;
  roundRect(ctx, x, heroTop, portraitW, portraitH, 4); ctx.stroke();
  roundRect(ctx, x + 6, heroTop + 6, portraitW - 12, portraitH - 12, 2); ctx.stroke();
  if (data.avatarImage) {
    const avSize = 150;
    ctx.save();
    roundRect(ctx, x, heroTop, portraitW, portraitH, 4);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(data.avatarImage, x + (portraitW - avSize) / 2, heroTop + (portraitH - avSize) / 2, avSize, avSize);
    ctx.restore();
  }

  const heroColX = x + portraitW + 24;
  const heroColW = CONTENT_W - portraitW - 24;
  let hy = heroTop;

  // rank glyph + score glyph, baseline-aligned
  glow(ctx, t.sealDim, 40);
  ctx.font = FONT.rank;
  ctx.fillStyle = t.fg;
  const rankBaseline = hy + 116;
  ctx.fillText(data.rankKey, heroColX, rankBaseline);
  const rankW = ctx.measureText(data.rankKey).width;
  noGlow(ctx);
  let plusW = 0;
  if (data.rankLetter && data.rankLetter.includes('+')) {
    ctx.font = FONT.rankPlus;
    ctx.fillStyle = t.seal;
    ctx.fillText('+', heroColX + rankW - 4, rankBaseline - 40);
    plusW = ctx.measureText('+').width + 10;
  }
  ctx.font = FONT.score;
  ctx.fillStyle = t.gold;
  const scoreX = heroColX + rankW + plusW + 20;
  ctx.fillText(String(data.score), scoreX, rankBaseline - 8);
  const scoreW = ctx.measureText(String(data.score)).width;
  ctx.font = FONT.scoreUnit;
  ctx.fillStyle = t.muted;
  ctx.fillText('分', scoreX + scoreW + 3, rankBaseline - 8);

  hy = rankBaseline + 8 + 12;
  ctx.font = FONT.rarity;
  ctx.fillStyle = t.muted;
  ctx.letterSpacing = '3px';
  ctx.fillText(data.percentileText, heroColX, hy);
  ctx.letterSpacing = '0px';

  hy += 30;
  ctx.font = FONT.titleLabel;
  ctx.fillStyle = t.faint;
  ctx.fillText('称  号', heroColX, hy);

  hy += 8 + 50;
  ctx.font = FONT.title;
  ctx.fillStyle = t.gold;
  glow(ctx, 'rgba(0,0,0,.4)', 16);
  const titleLines = wrapText(ctx, data.title, FONT.title, heroColW);
  titleLines.forEach((line, i) => {
    ctx.fillText(line, heroColX, hy + i * 62 * 1.2);
  });
  noGlow(ctx);
  hy += (titleLines.length - 1) * 62 * 1.2;

  y = Math.max(heroTop + portraitH, hy + 20);

  // ── rule ──
  y += 36;
  ctx.strokeStyle = t.rule; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + CONTENT_W, y); ctx.stroke();
  y += 26;

  // ── dossier: meta line ──
  {
    let mx = x;
    data.metaParts.forEach((part, i) => {
      if (i > 0) {
        ctx.font = FONT.meta; ctx.fillStyle = t.faint;
        ctx.fillText('·', mx, y);
        mx += ctx.measureText('·').width + 8 * 2;
      }
      ctx.font = FONT.meta;
      ctx.fillStyle = part.bold ? t.goldDim : t.fg;
      if (part.bold) ctx.font = '700 14px "PingFang SC","Noto Sans SC",sans-serif';
      ctx.fillText(part.text, mx, y);
      mx += ctx.measureText(part.text).width;
    });
  }

  // ── stats line ──
  y += 8 + 18;
  {
    let sx = x;
    ctx.font = FONT.statsLbl; ctx.fillStyle = t.faint;
    ctx.fillText('终值', sx, y);
    sx += ctx.measureText('终值').width + 8;
    data.stats.forEach((s, i) => {
      if (i > 0) {
        ctx.font = FONT.stats; ctx.fillStyle = t.faint;
        ctx.fillText('·', sx, y);
        sx += ctx.measureText('·').width + 12;
      }
      ctx.font = FONT.stats; ctx.fillStyle = t.muted;
      ctx.fillText(s.label, sx, y);
      sx += ctx.measureText(s.label).width;
      const color = s.tier === 'hi' ? t.gold : s.tier === 'lo' ? t.faint : t.fg;
      if (s.tier === 'hi') glow(ctx, 'rgba(232,193,90,.25)', 10);
      ctx.font = '800 12.5px "PingFang SC","Noto Sans SC",sans-serif';
      ctx.fillStyle = color;
      ctx.fillText(String(s.value), sx, y);
      sx += ctx.measureText(String(s.value)).width;
      noGlow(ctx);
    });
  }

  // ── ending pull-quote ──
  y += 32;
  const endingTop = y;
  ctx.font = FONT.endingTag;
  ctx.fillStyle = t.muted;
  let ey = y;
  if (data.endingTag) {
    ctx.fillText(data.endingTag, x + 20, ey);
    ey += 8 + 11.5;
  }
  ctx.font = FONT.ending;
  ctx.fillStyle = t.fg;
  const endingLines = wrapText(ctx, data.endingText, FONT.ending, CONTENT_W - 20);
  endingLines.forEach((line, i) => {
    ctx.fillText(line, x + 20, ey + i * 19 * 1.85);
  });
  const endingBottom = ey + (endingLines.length - 1) * 19 * 1.85 + 10;
  ctx.strokeStyle = t.sealDim; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, endingTop - 14); ctx.lineTo(x, endingBottom); ctx.stroke();

  y = endingBottom;

  // ── footer ──
  y += 38;
  ctx.strokeStyle = t.rule; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + CONTENT_W, y); ctx.stroke();
  y += 22 + 17;
  ctx.textAlign = 'center';
  ctx.font = FONT.footer;
  const prefix = '我玩出了 ', suffix = ' 级人生，你也快来试试！';
  ctx.font = FONT.footer; ctx.fillStyle = t.fg;
  const prefixW = ctx.measureText(prefix).width;
  ctx.font = '900 17px "PingFang SC","Noto Sans SC",sans-serif';
  const rankW2 = ctx.measureText(data.footerRankText).width;
  ctx.font = FONT.footer;
  const suffixW = ctx.measureText(suffix).width;
  const totalW = prefixW + rankW2 + suffixW;
  const startX = width / 2 - totalW / 2;
  ctx.textAlign = 'left';
  ctx.font = FONT.footer; ctx.fillStyle = t.fg;
  ctx.fillText(prefix, startX, y);
  ctx.font = '900 17px "PingFang SC","Noto Sans SC",sans-serif'; ctx.fillStyle = t.gold;
  ctx.fillText(data.footerRankText, startX + prefixW, y);
  ctx.font = FONT.footer; ctx.fillStyle = t.fg;
  ctx.fillText(suffix, startX + prefixW + rankW2, y);
}
