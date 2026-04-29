// 学徒期德扑 all-in modal
import { buildDeck, shuffle, compareHands, categoryName, evaluate7 } from './poker_eval.js';
import { handToKey } from './poker_winrates.js';

const SUIT_SYM = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_COLOR = { s: '#000', c: '#000', h: '#d33', d: '#d33' };

function cardEl(card, hidden) {
  const el = document.createElement('div');
  el.className = 'poker-card' + (hidden ? ' card-back' : '');
  if (!hidden && card) {
    const r = card[0] === 'T' ? '10' : card[0];
    const s = card[1];
    el.innerHTML = `<span class="card-rank">${r}</span><span class="card-suit" style="color:${SUIT_COLOR[s]}">${SUIT_SYM[s]}</span>`;
  }
  return el;
}

// state: 当前游戏 state
// opts: { title, betMin, loseMul, foldPok, foldMny }
// onDone(result): result = { action: 'bet'|'fold', win: 1|-1|0, pokDelta, mnyDelta, log }
export function runHoldemModal(state, onDone, opts = {}) {
  const title = opts.title || '德州扑克 · 学徒局';
  const betMin = Math.max(1, opts.betMin || 1);
  const loseMul = opts.loseMul || 2;
  const foldPok = opts.foldPok != null ? opts.foldPok : 2;
  const foldMny = opts.foldMny != null ? opts.foldMny : 1;

  const deck = shuffle(buildDeck());
  const playerHole = [deck.pop(), deck.pop()];
  const oppHole = [deck.pop(), deck.pop()];
  const board = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];

  const handKey = handToKey(playerHole[0], playerHole[1]);
  const curPOK = state.POK || 0;

  const overlay = document.createElement('div');
  overlay.className = 'holdem-overlay';
  overlay.innerHTML = `
    <div class="holdem-modal">
      <div class="holdem-title">${title}</div>
      <div class="holdem-row holdem-opponent">
        <div class="holdem-label">对手</div>
        <div class="card-row" id="opp-cards"></div>
      </div>
      <div class="holdem-row holdem-board">
        <div class="holdem-label">公共牌</div>
        <div class="card-row" id="board-cards"></div>
      </div>
      <div class="holdem-row holdem-player">
        <div class="holdem-label">你</div>
        <div class="card-row" id="player-cards"></div>
      </div>
      <div class="holdem-info">
        <span class="hand-key">${handKey}</span>
        <span class="hand-pok">当前 POK：<strong>${curPOK}</strong></span>
      </div>
      <div class="holdem-bet">
        <label>下注 POK：<span id="bet-display">${betMin}</span></label>
        <input type="range" id="bet-slider" min="${betMin}" max="${Math.max(betMin, curPOK)}" value="${betMin}" ${curPOK < betMin ? 'disabled' : ''} />
      </div>
      <div class="holdem-actions">
        <button id="btn-fold" class="ghost">弃牌（-${Math.min(foldPok, curPOK)} POK，-${foldMny} MNY）</button>
        <button id="btn-bet" class="primary" ${curPOK < betMin ? 'disabled' : ''}>Bet</button>
      </div>
      <div class="holdem-result" id="holdem-result"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const oppRow = overlay.querySelector('#opp-cards');
  const boardRow = overlay.querySelector('#board-cards');
  const playerRow = overlay.querySelector('#player-cards');
  oppRow.appendChild(cardEl(oppHole[0], true));
  oppRow.appendChild(cardEl(oppHole[1], true));
  for (let i = 0; i < 5; i++) boardRow.appendChild(cardEl(null, true));
  playerRow.appendChild(cardEl(playerHole[0], false));
  playerRow.appendChild(cardEl(playerHole[1], false));

  const slider = overlay.querySelector('#bet-slider');
  const betDisplay = overlay.querySelector('#bet-display');
  slider.addEventListener('input', () => { betDisplay.textContent = slider.value; });

  const resultDiv = overlay.querySelector('#holdem-result');
  const btnBet = overlay.querySelector('#btn-bet');
  const btnFold = overlay.querySelector('#btn-fold');

  function reveal(cb) {
    btnBet.disabled = true;
    btnFold.disabled = true;
    slider.disabled = true;
    // 翻对手牌
    oppRow.innerHTML = '';
    oppRow.appendChild(cardEl(oppHole[0], false));
    oppRow.appendChild(cardEl(oppHole[1], false));
    // 依次翻公共牌
    let i = 0;
    const flip = () => {
      if (i >= 5) { setTimeout(cb, 400); return; }
      boardRow.children[i].classList.remove('card-back');
      const c = board[i];
      const r = c[0] === 'T' ? '10' : c[0];
      const s = c[1];
      boardRow.children[i].innerHTML = `<span class="card-rank">${r}</span><span class="card-suit" style="color:${SUIT_COLOR[s]}">${SUIT_SYM[s]}</span>`;
      i++;
      setTimeout(flip, 350);
    };
    flip();
  }

  btnBet.addEventListener('click', () => {
    const bet = parseInt(slider.value, 10) || 1;
    reveal(() => {
      const cmp = compareHands(playerHole, oppHole, board);
      const pScore = evaluate7([...playerHole, ...board]);
      const oScore = evaluate7([...oppHole, ...board]);
      const pName = categoryName(pScore), oName = categoryName(oScore);
      let pokDelta, msg;
      if (cmp > 0) {
        pokDelta = bet;
        msg = `你赢了！${pName} 击败 ${oName}，POK +${bet}`;
      } else if (cmp < 0) {
        pokDelta = -Math.min(bet * loseMul, curPOK);
        msg = `你输了。${oName} 压过 ${pName}，POK ${pokDelta}`;
      } else {
        pokDelta = 0;
        msg = `平局（${pName} vs ${oName}），POK 不变`;
      }
      resultDiv.textContent = msg;
      resultDiv.className = 'holdem-result ' + (cmp > 0 ? 'win' : cmp < 0 ? 'lose' : 'tie');
      const closeBtn = document.createElement('button');
      closeBtn.className = 'primary';
      closeBtn.textContent = '收摊';
      closeBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
        onDone({
          action: 'bet',
          win: cmp,
          pokDelta,
          mnyDelta: 0,
          log: `你的底牌 ${formatCard(playerHole[0])}${formatCard(playerHole[1])}（${handKey}），对手 ${formatCard(oppHole[0])}${formatCard(oppHole[1])}。公共牌 ${board.map(formatCard).join(' ')}。${msg}`
        });
      });
      overlay.querySelector('.holdem-actions').innerHTML = '';
      overlay.querySelector('.holdem-actions').appendChild(closeBtn);
    });
  });

  btnFold.addEventListener('click', () => {
    const pokLoss = Math.min(foldPok, curPOK);
    document.body.removeChild(overlay);
    onDone({
      action: 'fold',
      win: 0,
      pokDelta: -pokLoss,
      mnyDelta: -foldMny,
      log: `你的底牌 ${formatCard(playerHole[0])}${formatCard(playerHole[1])}（${handKey}）。你选择 fold 走人，POK -${pokLoss}，桌费 MNY -${foldMny}。`
    });
  });
}

function formatCard(c) {
  const r = c[0] === 'T' ? '10' : c[0];
  return r + SUIT_SYM[c[1]];
}
