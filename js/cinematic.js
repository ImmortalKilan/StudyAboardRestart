// Storyline 进入时的动画：标题居中亮相 → 飞向左侧剧情位 → effect 数值居中亮相 → 飞向属性栏
const wait = (ms) => new Promise(r => setTimeout(r, ms));

export async function playStorylineIntro({ name, color, effect, statLabels, onDone }) {
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

  // ③ effect 数值居中淡入
  const entries = Object.entries(effect || {}).filter(([, v]) => typeof v === 'number' && v !== 0);
  if (entries.length) {
    const box = document.createElement('div');
    box.className = 'cinematic-attrs';
    for (const [k, v] of entries) {
      const tag = document.createElement('div');
      tag.className = 'cinematic-attr ' + (v >= 0 ? 'pos' : 'neg');
      tag.textContent = `${statLabels[k] || k} ${v >= 0 ? '+' : ''}${v}`;
      tag.dataset.stat = k;
      box.appendChild(tag);
    }
    overlay.appendChild(box);
    await wait(400);

    // ④ 各 tag FLIP 飞向对应 stat-row
    Array.from(box.children).forEach((tag) => {
      const k = tag.dataset.stat;
      const target = document.querySelector(`.stat-row[data-stat="${k}"]`);
      if (!target) return;
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
    });
    await wait(900);
  }

  overlay.remove();
  if (onDone) onDone();
}
