// ===== Supabase 配置 =====
const SUPABASE_URL = 'https://rwdadlbtvjuoonnbbriy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JgjEFVnjeZPwzn9kO-2qCg_TpE6rIhB';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== 状态 =====
let state = { logs: [] };
let filter = { person: 'all', op: 'all', keyword: '' };
const PAGE_SIZE = 500;

// ===== 工具 =====
function fmtFullTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${mo}-${day} ${h}:${mi}:${s}`;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function opLabel(op) {
  if (op === 'INSERT') return { text: '新增', cls: 'op-insert' };
  if (op === 'UPDATE') return { text: '修改', cls: 'op-update' };
  if (op === 'DELETE') return { text: '删除', cls: 'op-delete' };
  return { text: op || '—', cls: '' };
}

function tableLabel(t) {
  if (t === 'cards') return '记忆卡片';
  if (t === 'reviews') return '复习记录';
  if (t === 'focus') return '考试重点';
  if (t === 'students') return '学生名单';
  return t || '—';
}

// 「谁动过」：优先用操作者自称（页面写入时带的身份），没有就用数据归属
function personOf(log) {
  return log.actor_name || log.student_name || '（未署名）';
}

// ===== 加载 =====
async function loadAll() {
  const btn = document.getElementById('refresh-btn');
  btn.classList.add('loading');
  btn.textContent = '⏳ 加载中...';

  try {
    const { data, error } = await sb
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (error) throw error;
    state.logs = data || [];

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
  const old = main.querySelector('.error-banner');
  if (old) old.remove();
  const banner = document.createElement('div');
  banner.className = 'error-banner';
  banner.textContent = msg;
  main.insertBefore(banner, main.firstChild);
}

// ===== 渲染 =====
function render() {
  renderOverview();
  renderPersonTabs();
  renderOpTabs();
  renderList();
}

function renderOverview() {
  const logs = state.logs;
  document.getElementById('ov-total').textContent = logs.length;

  const people = new Set(logs.map(personOf));
  document.getElementById('ov-people').textContent = people.size;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = logs.filter(l => new Date(l.created_at) >= startOfToday).length;
  document.getElementById('ov-today').textContent = today;

  const del = logs.filter(l => l.op === 'DELETE').length;
  document.getElementById('ov-del').textContent = del;
}

function renderPersonTabs() {
  const box = document.getElementById('actor-tabs');
  const counts = {};
  state.logs.forEach(l => {
    const p = personOf(l);
    counts[p] = (counts[p] || 0) + 1;
  });
  const names = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

  let html = `<button class="name-tab ${filter.person === 'all' ? 'active' : ''}" data-person="all">
    <span class="tab-name">全部</span>
    <span class="tab-count">${state.logs.length}</span>
  </button>`;

  html += names.map(n => `
    <button class="name-tab ${filter.person === n ? 'active' : ''}" data-person="${escapeHtml(n)}">
      <span class="tab-name">${escapeHtml(n)}</span>
      <span class="tab-count">${counts[n]}</span>
    </button>`).join('');

  box.innerHTML = html;
  box.querySelectorAll('.name-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      filter.person = btn.dataset.person;
      render();
    });
  });
}

function renderOpTabs() {
  const box = document.getElementById('op-tabs');
  const counts = { INSERT: 0, UPDATE: 0, DELETE: 0 };
  state.logs.forEach(l => { if (counts[l.op] != null) counts[l.op]++; });

  const ops = [
    { key: 'all', name: '全部', n: state.logs.length },
    { key: 'INSERT', name: '新增', n: counts.INSERT },
    { key: 'UPDATE', name: '修改', n: counts.UPDATE },
    { key: 'DELETE', name: '删除', n: counts.DELETE }
  ];

  box.innerHTML = ops.map(o => `
    <button class="name-tab ${filter.op === o.key ? 'active' : ''}" data-op="${o.key}">
      <span class="tab-name">${o.name}</span>
      <span class="tab-count">${o.n}</span>
    </button>`).join('');

  box.querySelectorAll('.name-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      filter.op = btn.dataset.op;
      render();
    });
  });
}

function getFiltered() {
  const kw = filter.keyword.trim().toLowerCase();
  return state.logs.filter(l => {
    if (filter.person !== 'all' && personOf(l) !== filter.person) return false;
    if (filter.op !== 'all' && l.op !== filter.op) return false;
    if (kw) {
      const blob = [l.summary, l.table_name, l.student_name, l.actor_name,
        (l.changed_fields || []).join(' ')].join(' ').toLowerCase();
      if (!blob.includes(kw)) return false;
    }
    return true;
  });
}

function renderList() {
  const box = document.getElementById('log-list');
  const rows = getFiltered();

  if (rows.length === 0) {
    box.innerHTML = state.logs.length === 0
      ? '<div class="empty-row">还没有任何改动记录</div>'
      : '<div class="empty-row">没有符合条件的记录</div>';
    return;
  }

  box.innerHTML = rows.map(l => {
    const op = opLabel(l.op);
    const person = personOf(l);
    const fields = (l.changed_fields || []);
    const fieldsHtml = fields.length
      ? fields.map(f => `<span class="field-chip">${escapeHtml(f)}</span>`).join('')
      : '';

    return `<div class="log-row" data-id="${l.id}">
      <div class="log-time">${fmtFullTime(l.created_at)}</div>
      <div class="log-op ${op.cls}">${op.text}</div>
      <div class="log-main">
        <div class="log-title">
          <span class="log-person">${escapeHtml(person)}</span>
          <span class="log-sep">·</span>
          <span class="log-table">${escapeHtml(tableLabel(l.table_name))}</span>
          ${l.row_id != null ? `<span class="log-sep">·</span><span class="log-rowid">#${l.row_id}</span>` : ''}
        </div>
        <div class="log-summary">${escapeHtml(l.summary || '')}</div>
        ${fieldsHtml ? `<div class="log-fields">${fieldsHtml}</div>` : ''}
      </div>
      <div class="log-arrow">›</div>
    </div>`;
  }).join('');

  box.querySelectorAll('.log-row').forEach(row => {
    row.addEventListener('click', () => {
      const log = state.logs.find(x => x.id === Number(row.dataset.id));
      if (log) openDetail(log);
    });
  });
}

// ===== 详情 =====
function openDetail(log) {
  const op = opLabel(log.op);
  document.getElementById('log-modal-title').textContent =
    `${op.text} · ${tableLabel(log.table_name)}`;

  const person = personOf(log);
  const sub = [];
  sub.push(`时间 ${fmtFullTime(log.created_at)}`);
  sub.push(`操作者 ${person}`);
  if (log.actor_name && log.student_name && log.actor_name !== log.student_name) {
    sub.push(`数据属于 ${log.student_name}`);
  }
  if (log.actor) sub.push(`来源 ${log.actor}`);
  document.getElementById('log-modal-sub').textContent = sub.join(' · ');

  document.getElementById('log-detail').innerHTML = renderDiff(log);
  document.getElementById('log-modal').hidden = false;
}

function closeDetail() {
  document.getElementById('log-modal').hidden = true;
}

function renderDiff(log) {
  const oldD = log.old_data || {};
  const newD = log.new_data || {};

  // UPDATE：只列真正变了的字段
  let keys;
  if (log.op === 'UPDATE') {
    keys = (log.changed_fields && log.changed_fields.length)
      ? log.changed_fields
      : Object.keys(newD);
  } else {
    keys = Object.keys(log.op === 'DELETE' ? oldD : newD);
  }

  if (!keys.length) return '<p class="diff-empty">这条记录没有可对比的字段</p>';

  const rows = keys.map(k => {
    const ov = oldD[k];
    const nv = newD[k];
    const showOld = log.op !== 'INSERT' && ov !== undefined && ov !== null && ov !== '';
    const showNew = log.op !== 'DELETE' && nv !== undefined && nv !== null && nv !== '';

    let ovHtml = '<span class="diff-void">—</span>';
    let nvHtml = '<span class="diff-void">—</span>';

    if (showOld) {
      ovHtml = `<span class="diff-old">${escapeHtml(String(ov))}</span>`;
    }
    if (showNew) {
      nvHtml = `<span class="diff-new">${escapeHtml(String(nv))}</span>`;
    }

    return `<div class="diff-row">
      <div class="diff-key">${escapeHtml(k)}</div>
      <div class="diff-old-wrap">${ovHtml}</div>
      <div class="diff-arrow">→</div>
      <div class="diff-new-wrap">${nvHtml}</div>
    </div>`;
  }).join('');

  return `<div class="diff-head">
      <div class="diff-key"></div>
      <div class="diff-old-wrap">改之前</div>
      <div class="diff-arrow"></div>
      <div class="diff-new-wrap">改之后</div>
    </div>` + rows;
}

// ===== 事件绑定 =====
document.getElementById('refresh-btn').addEventListener('click', loadAll);
document.getElementById('log-close').addEventListener('click', closeDetail);

document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', (e) => {
    if (e.target !== backdrop) return;
    closeDetail();
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!document.getElementById('log-modal').hidden) closeDetail();
});

const searchInput = document.getElementById('search-input');
let searchTimer = null;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    filter.keyword = searchInput.value;
    renderList();
  }, 200);
});

// ===== 启动 =====
loadAll();
