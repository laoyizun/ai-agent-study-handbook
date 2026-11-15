// ===== Supabase 配置 =====
const SUPABASE_URL = 'https://rwdadlbtvjuoonnbbriy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JgjEFVnjeZPwzn9kO-2qCg_TpE6rIhB';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== 状态 =====
let state = { students: [], cards: [], reviews: [] };
let filter = { name: 'all', keyword: '' };
// 已翻开的卡片 id 集合
const flipped = new Set();
// 当前操作身份（决定哪些卡可以改），存本地
const IDENTITY_KEY = 'cards-view-identity';
let identity = localStorage.getItem(IDENTITY_KEY) || '';
// 正在编辑 / 删除的卡片 id
let editingId = null;
let deletingId = null;
let toastTimer = null;

// 写请求要带身份头，数据库那边才知道是谁动的手
// HTTP 头放不了中文，先转 base64，服务端解回 UTF8
function actorHeader() {
  if (!identity) return '';
  const bytes = new TextEncoder().encode(identity);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

// 给写操作挂上身份头（没选身份就不挂）
function withActor(builder) {
  const h = actorHeader();
  return h ? builder.setHeader('X-Actor-Name-B64', h) : builder;
}

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

// ===== 提示条 =====
function toast(msg, kind) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (kind ? ' toast--' + kind : '');
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
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

  renderIdentitySelect(sorted);
}

// ===== 身份下拉 =====
function renderIdentitySelect(names) {
  const sel = document.getElementById('identity-select');
  const hint = document.getElementById('identity-hint');
  const list = [...names].sort();

  // 只有在有卡片的学生里出现过、且在 students 表登记过的，才列出来
  sel.innerHTML = '<option value="">\u2014 \u4E0D\u8BBE\u7F6E\uFF08\u53EA\u8BFB\u6D4F\u89C8\uFF09\u2014</option>'
    + list.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');

  // 身份可能已经不在名单里（比如数据库换了），这时清掉
  if (identity && !list.includes(identity)) identity = '';

  sel.value = identity;

  if (identity) {
    hint.textContent = `\u4f60\u6b63\u5728\u4ee5 ${identity} \u7684\u8eab\u4efd\u6d4f\u89c8\uff1a\u53ea\u6709 ${identity} \u7684\u5361\u7247\u4e0a\u4f1a\u51fa\u73b0\u7f16\u8f91\u548c\u5220\u9664\u6309\u94ae`;
    hint.classList.add('on');
  } else {
    hint.textContent = '\u9009\u597d\u540d\u5b57\u540e\uff0c\u53ea\u6709\u8fd9\u4e2a\u4eba\u7684\u5361\u7247\u4e0a\u4f1a\u51fa\u73b0\u7f16\u8f91\u548c\u5220\u9664\u6309\u94ae';
    hint.classList.remove('on');
  }
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
  const canEdit = !!(identity && identity.length);
  grid.innerHTML = list.map(c => {
    const m = latestMark(c.id);
    const isFlip = flipped.has(c.id);
    const mine = canEdit && c.student_name === identity;
    const weak = c.weakness
      ? `<div class="card-weakness"><b>卡点</b>${escapeHtml(c.weakness)}</div>` : '';
    const actions = mine ? `
      <div class="card-actions">
        <button class="card-btn" data-act="edit" data-id="${c.id}">\u270F\uFE0F 编辑</button>
        <button class="card-btn card-btn--del" data-act="del" data-id="${c.id}">\u{1F5D1}\uFE0F 删除</button>
        <span class="card-id">#${c.id}</span>
      </div>` : '';
    return `
    <div class="flip-card ${isFlip ? 'flipped' : ''}${c.weakness ? ' has-weakness' : ''}${mine ? ' can-edit' : ''}" data-id="${c.id}">
      <div class="flip-inner">
        <div class="flip-face flip-front">
          <div class="card-top">
            <span class="subject-chip">${escapeHtml(c.subject || '—')}</span>
            <span class="card-owner">${escapeHtml(c.student_name || '—')}</span>
          </div>
          <div class="card-question">${escapeHtml(c.question || '—')}</div>
          ${weak}
          <div class="card-hint">\uD83D\uDC40 点击翻面看答案</div>
          ${actions}
        </div>
        <div class="flip-face flip-back">
          <div class="card-top">
            <span class="subject-chip">${escapeHtml(c.subject || '—')}</span>
            ${markLabel(m)}
          </div>
          <div class="card-answer">${escapeHtml(c.answer || '—')}</div>
          <div class="card-owner card-time">${escapeHtml(c.student_name || '—')} · ${fmtFullTime(c.created_at)}</div>
          ${actions}
        </div>
      </div>
    </div>`;
  }).join('');

  // 绑定翻牌
  grid.querySelectorAll('.flip-card').forEach(el => {
    el.addEventListener('click', (e) => {
      // 点操作按钮不翻面
      if (e.target.closest('.card-actions')) return;
      const id = Number(el.dataset.id);
      if (flipped.has(id)) flipped.delete(id);
      else flipped.add(id);
      el.classList.toggle('flipped');
    });
  });

  // 绑定编辑 / 删除
  grid.querySelectorAll('.card-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      if (btn.dataset.act === 'edit') openEdit(id);
      else openDelete(id);
    });
  });
}

// ===== 编辑 =====
function openEdit(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;

  // 只能改自己名下的卡
  if (!identity || card.student_name !== identity) {
    toast('只能编辑自己名下的卡片', 'err');
    return;
  }

  editingId = cardId;
  document.getElementById('edit-modal-sub').textContent =
    `属于 ${card.student_name} · #${card.id} · 创建于 ${fmtFullTime(card.created_at)}`;
  document.getElementById('edit-subject').value = card.subject || '';
  document.getElementById('edit-question').value = card.question || '';
  document.getElementById('edit-answer').value = card.answer || '';
  document.getElementById('edit-weakness').value = card.weakness || '';
  document.getElementById('edit-modal').hidden = false;
  document.getElementById('edit-question').focus();
}

function closeEdit() {
  document.getElementById('edit-modal').hidden = true;
  editingId = null;
}

async function saveEdit() {
  if (editingId == null) return;
  const btn = document.getElementById('edit-save');
  const patch = {
    subject: document.getElementById('edit-subject').value.trim(),
    question: document.getElementById('edit-question').value.trim(),
    answer: document.getElementById('edit-answer').value.trim(),
    // 空字符串要转成 null：空 = 还没记，不是"记了但没弱点"
    weakness: document.getElementById('edit-weakness').value.trim() || null
  };

  if (!patch.question || !patch.answer) {
    toast('问题和答案不能为空', 'err');
    return;
  }

  btn.disabled = true;
  btn.textContent = '保存中...';
  try {
    const { error } = await withActor(
      sb.from('cards').update(patch).eq('id', editingId)
    );
    if (error) throw error;

    // 本地状态同步
    const i = state.cards.findIndex(c => c.id === editingId);
    if (i >= 0) state.cards[i] = { ...state.cards[i], ...patch };

    closeEdit();
    render();
    toast('已保存', 'ok');
  } catch (e) {
    toast('保存失败：' + (e.message || e), 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = '保存';
  }
}

// ===== 删除 =====
function openDelete(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;

  if (!identity || card.student_name !== identity) {
    toast('只能删除自己名下的卡片', 'err');
    return;
  }

  deletingId = cardId;
  document.getElementById('delete-modal-sub').textContent =
    `属于 ${card.student_name} · #${card.id}`;
  document.getElementById('delete-modal').hidden = false;
}

function closeDelete() {
  document.getElementById('delete-modal').hidden = true;
  deletingId = null;
}

async function confirmDelete() {
  if (deletingId == null) return;
  const btn = document.getElementById('delete-confirm');
  btn.disabled = true;
  btn.textContent = '删除中...';
  try {
    const { error } = await withActor(
      sb.from('cards').delete().eq('id', deletingId)
    );
    if (error) throw error;

    // reviews 会级联删除，本地状态也同步清掉
    state.cards = state.cards.filter(c => c.id !== deletingId);
    state.reviews = state.reviews.filter(r => r.card_id !== deletingId);

    closeDelete();
    render();
    toast('已删除（复习标记一起清掉了）', 'ok');
  } catch (e) {
    toast('删除失败：' + (e.message || e), 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = '确认删除';
  }
}

// ===== 最新标记 =====
// reviews 是按 reviewed_at 倒序拉的，遍历时后面的（更早的）不覆盖前面的（更新的）
function latestMark(cardId) {
  for (const r of state.reviews) {
    if (r.card_id === cardId) return r.mark;
  }
  return null;
}

// ===== 事件绑定 =====
// 身份选择
const identitySelect = document.getElementById('identity-select');
identitySelect.addEventListener('change', () => {
  identity = identitySelect.value;
  if (identity) localStorage.setItem(IDENTITY_KEY, identity);
  else localStorage.removeItem(IDENTITY_KEY);
  render();
  if (identity) toast(`现在是 ${identity} 的身份`, 'ok');
});

// 编辑弹窗
document.getElementById('edit-cancel').addEventListener('click', closeEdit);
document.getElementById('edit-save').addEventListener('click', saveEdit);

// 删除弹窗
document.getElementById('delete-cancel').addEventListener('click', closeDelete);
document.getElementById('delete-confirm').addEventListener('click', confirmDelete);

// 点遮罩关闭 + ESC 关闭
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', (e) => {
    if (e.target !== backdrop) return;
    if (backdrop.id === 'edit-modal') closeEdit();
    else closeDelete();
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!document.getElementById('edit-modal').hidden) closeEdit();
  if (!document.getElementById('delete-modal').hidden) closeDelete();
});

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
