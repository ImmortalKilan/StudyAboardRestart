// Storyline 进入时的动画：标题居中亮相 → 飞向左侧剧情位 → effect 数值居中亮相 → 飞向属性栏
const wait = (ms) => new Promise(r => setTimeout(r, ms));

export async function playStorylineIntro({ name, color, unlockStat, statLabels, onDone }) {
  const overlay = document.createElement('div');
  overlay.className = 'cinematic-overlay';
  document.body.appendChild(overlay);

  // ① 标题居中淡入
  const title = document.createElement('div');
  title.className = 'cinematic-title';
  title.style.color = color;
  title.textContent = name;
  overlay.appendChild(title);
  await wait(1300); // fade in 500 + 停留 800

  // ② FLIP 飞向 storyline-display
  const slTarget = document.querySelector('#storyline-display');
  if (slTarget) {
    const tRect = slTarget.getBoundingClientRect();
    const sRect = title.getBoundingClientRect();
    const dx = tRect.left + tRect.width / 2 - (sRect.left + sRect.width / 2);
    const dy = tRect.top + tRect.height / 2 - (sRect.top + sRect.height / 2);
    const scale = Math.max(0.2, tRect.height / sRect.height);
    title.animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) scale(${scale})`, opacity: 0 }
      ],
      { duration: 1000, easing: 'cubic-bezier(.4,.0,.2,1)', fill: 'forwards' }
    );
    await wait(1000);
  }
  title.remove();

  // ③ 解锁新属性提示居中淡入
  if (unlockStat) {
    const box = document.createElement('div');
    box.className = 'cinematic-attrs';
    const tag = document.createElement('div');
    tag.className = 'cinematic-attr unlock';
    tag.textContent = `解锁新属性：${statLabels[unlockStat] || unlockStat}`;
    tag.dataset.stat = unlockStat;
    box.appendChild(tag);
    overlay.appendChild(box);
    await wait(800);

    // ④ FLIP 飞向对应 stat-row
    const target = document.querySelector(`.stat-row[data-stat="${unlockStat}"]`);
    if (target) {
      const tRect = target.getBoundingClientRect();
      const sRect = tag.getBoundingClientRect();
      const dx = tRect.left + tRect.width / 2 - (sRect.left + sRect.width / 2);
      const dy = tRect.top + tRect.height / 2 - (sRect.top + sRect.height / 2);
      tag.animate(
        [
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: `translate(${dx}px,${dy}px) scale(0.6)`, opacity: 0 }
        ],
        { duration: 900, easing: 'cubic-bezier(.4,.0,.2,1)', fill: 'forwards' }
      );
      await wait(900);
    }
  }

  overlay.remove();
  if (onDone) onDone();
}

export async function playStorylineExit({ name, color, hideStat, statLabels, onDone }) {
  const overlay = document.createElement('div');
  overlay.className = 'cinematic-overlay';
  document.body.appendChild(overlay);

  // ① 标题居中亮相（带“结篇”字样）
  const title = document.createElement('div');
  title.className = 'cinematic-title';
  title.style.color = color;
  title.style.fontSize = '32px';
  title.innerHTML = `<span style="font-size:14px; opacity:0.7; display:block; margin-bottom:10px;">—— 剧情结篇 ——</span>${name}`;
  overlay.appendChild(title);
  
  // 伴随一个向下的轻微位移淡入
  title.animate([
    { transform: 'translateY(-20px)', opacity: 0 },
    { transform: 'translateY(0)', opacity: 1 }
  ], { duration: 800, fill: 'forwards' });

  await wait(2000);

  // ② 如果有要隐藏的属性，做一个缩回动画
  if (hideStat) {
    const target = document.querySelector(`.stat-row[data-stat="${hideStat}"]`);
    if (target) {
      target.style.transition = 'all 1s ease';
      target.style.opacity = '0.3';
      target.style.transform = 'scale(0.9)';
      await wait(500);
    }
  }

  // ③ 整体淡出
  overlay.style.transition = 'opacity 0.8s ease';
  overlay.style.opacity = '0';
  await wait(800);

  overlay.remove();
  if (onDone) onDone();
}

