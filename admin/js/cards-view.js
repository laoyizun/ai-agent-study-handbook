// ===== Supabase 配置 =====
const SUPABASE_URL = 'https://rwdadlbtvjuoonnbbriy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JgjEFVnjeZPwzn9kO-2qCg_TpE6rIhB';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== 状态 =====
let state = { students: [], cards: [], reviews: [] };
let filter = { name: 'all', keyword: '' };
// 已翻开的卡片 id 集合
const flipped = new Set();

// ===== 工具 =====
function fmtFullTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

function markLabel(m) {
  if (m === 'done') return '<span class="mark-badge mark-done">已掌握</span>';
  if (m === 'half') return '<span class="mark-badge mark-half">半掌握</span>';
  if (m === 'bad') return '<span class="mark-badge mark-bad">未掌握</span>';
  return '<span class="mark-badge mark-none">未复习</span>';
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ===== 加载数据 =====
async function loadAll() {
  const btn = document.getElementById('refresh-btn');
  btn.classList.add('loading');
  btn.textContent = '⏳ 加载中...';

  try {
    const [studentsRes, cardsRes, reviewsRes] = await Promise.all([
      sb.from('students').select('*').order('name'),
      sb.from('cards').select('*').order('created_at', { ascending: false }),
      sb.from('reviews').select('*').order('reviewed_at', { ascending: false })
    ]);

    if (studentsRes.error) throw studentsRes.error;
    if (cardsRes.error) throw cardsRes.error;
    if (reviewsRes.error) throw reviewsRes.error;

    state.students = studentsRes.data || [];
    state.cards = cardsRes.data || [];
    state.reviews = reviewsRes.data || [];

    render();
    document.getElementById('last-updated').textContent =
      '更新于 ' + fmtFullTime(new Date().toISOString());
  } catch (e) {
    showError('加载失败：' + (e.message || JSON.stringify(e)));
  } finally {
    btn.classList.remove('loading');
    btn.textContent = '🔄 刷新';
  }
}

function showError(msg) {
  const main = document.querySelector('.admin-container');
  const old = document.querySelector('.error-banner');
  if (old) old.remove();
  const banner = document.createElement('div');
  banner.className = 'error-banner';
  banner.textContent = msg;
  main.insertBefore(banner, main.firstChild);
}

// ===== 渲染 =====
function render() {
  renderTabs();
  renderCards();
}

// ===== 名字标签 =====
function renderTabs() {
  const box = document.getElementById('name-tabs');

  // 统计每个名字的卡片数（含没有登记在 students 表里的）
  const counts = {};
  state.cards.forEach(c => {
    counts[c.student_name] = (counts[c.student_name] || 0) + 1;
  });

  // 名字列表 = students 表 + cards 里出现过的（取并集）
  const names = new Set(state.students.map(s => s.name));
  state.cards.forEach(c => names.add(c.student_name));
  const sorted = [...names].sort();

  const allActive = filter.name === 'all';

  let html = `<button class="name-tab ${allActive ? 'active' : ''}" data-name="all">
    <span class="tab-name">全部</span>
    <span class="tab-count">${state.cards.length}</span>
  </button>`;

  html += sorted.map(n => {
    const c = counts[n] || 0;
    const active = filter.name === n;
    return `<button class="name-tab ${active ? 'active' : ''}" data-name="${escapeHtml(n)}">
      <span class="tab-name">${escapeHtml(n)}</span>
      <span class="tab-count">${c}</span>
    </button>`;
  }).join('');

  box.innerHTML = html;

  box.querySelectorAll('.name-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      filter.name = btn.dataset.name;
      render();
    });
  });
}

// ===== 卡片过滤 =====
function getFilteredCards() {
  const kw = filter.keyword.trim().toLowerCase();
  return state.cards.filter(c => {
    if (filter.name !== 'all' && c.student_name !== filter.name) return false;
    if (kw) {
      const hay = ((c.question || '') + ' ' + (c.answer || '') + ' ' + (c.subject || '')).toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}

// ===== 卡片网格 =====
function renderCards() {
  const grid = document.getElementById('card-grid');
  const list = getFilteredCards();

  // 当前筛选的统计条
  const stat = document.getElementById('cards-stat');
  const done = list.filter(c => latestMark(c.id) === 'done').length;
  const half = list.filter(c => latestMark(c.id) === 'half').length;
  const bad = list.filter(c => latestMark(c.id) === 'bad').length;
  const none = list.length - done - half - bad;

  const who = filter.name === 'all' ? '全部学生' : escapeHtml(filter.name);
  stat.innerHTML = `
    <span class="stat-item"><b>${list.length}</b> 张卡</span>
    <span class="stat-sep">·</span>
    <span class="stat-item">${who}</span>
    ${filter.keyword ? `<span class="stat-sep">·</span><span class="stat-item">关键词「${escapeHtml(filter.keyword)}」</span>` : ''}
    <span class="stat-sep">·</span>
    <span class="stat-item"><span class="mark-badge mark-done">已掌握 ${done}</span></span>
    <span class="stat-item"><span class="mark-badge mark-half">半掌握 ${half}</span></span>
    <span class="stat-item"><span class="mark-badge mark-bad">未掌握 ${bad}</span></span>
    <span class="stat-item"><span class="mark-badge mark-none">未复习 ${none}</span></span>
  `;

  if (list.length === 0) {
    grid.innerHTML = '<div class="empty-row">没有符合条件的卡片</div>';
    return;
  }

  // card_id → 最新 mark
  grid.innerHTML = list.map(c => {
    const m = latestMark(c.id);
    const isFlip = flipped.has(c.id);
    return `
    <div class="flip-card ${isFlip ? 'flipped' : ''}" data-id="${c.id}">
      <div class="flip-inner">
        <div class="flip-face flip-front">
          <div class="card-top">
            <span class="subject-chip">${escapeHtml(c.subject || '—')}</span>
            <span class="card-owner">${escapeHtml(c.student_name || '—')}</span>
          </div>
          <div class="card-question">${escapeHtml(c.question || '—')}</div>
          <div class="card-hint">👆 点击翻面看答案</div>
        </div>
        <div class="flip-face flip-back">
          <div class="card-top">
            <span class="subject-chip">${escapeHtml(c.subject || '—')}</span>
            ${markLabel(m)}
          </div>
          <div class="card-answer">${escapeHtml(c.answer || '—')}</div>
          <div class="card-owner card-time">${escapeHtml(c.student_name || '—')} · ${fmtFullTime(c.created_at)}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  // 绑定翻牌
  grid.querySelectorAll('.flip-card').forEach(el => {
    el.addEventListener('click', () => {
      const id = Number(el.dataset.id);
      if (flipped.has(id)) flipped.delete(id);
      else flipped.add(id);
      el.classList.toggle('flipped');
    });
  });
}

// ===== 最新标记 =====
// reviews 是按 reviewed_at 倒序拉的，遍历时后面的（更早的）不覆盖前面的（更新的）
function latestMark(cardId) {
  for (const r of state.reviews) {
    if (r.card_id === cardId) return r.mark;
  }
  return null;
}

// ===== 启动 =====
document.getElementById('refresh-btn').addEventListener('click', loadAll);

const searchInput = document.getElementById('search-input');
let searchTimer = null;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    filter.keyword = searchInput.value;
    renderCards();
  }, 200);
});

loadAll();
