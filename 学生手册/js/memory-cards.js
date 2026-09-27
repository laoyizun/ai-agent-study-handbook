// 记忆卡片 · L4 展示模式
// 只展示示例卡片 + 点击翻转 + 三色标记（用于体验）
// 不输入 / 不生成 / 不下载

(function () {

  // ============ 示例数据 ============
  // 字段名采用中文字段：问题 / 答案 / 章节
  const DEMO_DATA = [
    { 问题: "判别式 Δ>0 的几何意义", 答案: "抛物线和 x 轴相交两点，有两个不同实根", 章节: "一元二次方程" },
    { 问题: "判别式 Δ=0 的根", 答案: "只有一个重根，抛物线刚好擦过 x 轴", 章节: "一元二次方程" },
    { 问题: "判别式 Δ<0 的情况", 答案: "无实根（实数范围内），抛物线整个在 x 轴上方或下方", 章节: "一元二次方程" },
    { 问题: "配方法的四步顺序", 答案: "移项 → 系数归 1 → 配完全平方 → 开方（带 ± 号）", 章节: "一元二次方程" },
    { 问题: "「无实数根」和「无解」的区别", 答案: "实数范围内「无实数根」= 这道题在初中无解；复数范围内所有方程都有解", 章节: "一元二次方程" }
  ];

  // ============ DOM ============
  const $grid = document.getElementById('card-grid');

  // ============ 工具 ============
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  // ============ 渲染 ============
  function renderCards() {
    $grid.innerHTML = '';
    DEMO_DATA.forEach((c, i) => {
      const card = document.createElement('div');
      card.className = 'memory-card';

      card.innerHTML = `
        <div class="card-face card-front">
          <div class="card-topic">${escapeHtml(c.章节 || '')}</div>
          <div class="card-content">${escapeHtml(c.问题)}</div>
          <div class="card-hint">点击翻面</div>
        </div>
        <div class="card-face card-back">
          <div class="card-content">${escapeHtml(c.答案)}</div>
          <div class="card-actions">
            <button class="mark-btn mark-done" data-state="done" title="已掌握">✓</button>
            <button class="mark-btn mark-half" data-state="half" title="半掌握">△</button>
            <button class="mark-btn mark-bad" data-state="bad" title="未掌握">✗</button>
          </div>
        </div>
      `;

      // 翻面
      card.addEventListener('click', function (e) {
        if (e.target.closest('.mark-btn')) return;
        card.classList.toggle('flipped');
      });

      // 三色标记
      card.querySelectorAll('.mark-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          const newState = btn.dataset.state;
          card.classList.remove('is-done', 'is-half', 'is-bad');
          card.classList.add('is-' + newState);
        });
      });

      $grid.appendChild(card);
    });
  }

  // ============ 初始化 ============
  renderCards();
})();