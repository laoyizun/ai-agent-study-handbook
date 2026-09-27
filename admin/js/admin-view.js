// ===== Supabase 配置 =====
const SUPABASE_URL = 'https://rwdadlbtvjuoonnbbriy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JgjEFVnjeZPwzn9kO-2qCg_TpE6rIhB';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== 状态 =====
let state = { students: [], cards: [], reviews: [] };

// ===== 工具 =====
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
  if (diff < 604800) return Math.floor(diff / 86400) + ' 天前';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
  return '<span class="mark-badge">—</span>';
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
  renderOverview();
  renderStudentsTable();
  renderSubjectGrid();
  renderRecentTable();
}

function renderOverview() {
  document.getElementById('ov-students').textContent = state.students.length;

  const cards = state.cards.length;
  document.getElementById('ov-cards').textContent = cards;

  const reviews = state.reviews.length;
  document.getElementById('ov-reviews').textContent = reviews;

  const subjects = new Set(state.cards.map(c => c.subject).filter(Boolean));
  document.getElementById('ov-subjects').textContent = subjects.size;
}

function renderStudentsTable() {
  const tbody = document.getElementById('students-tbody');

  if (state.students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">还没有学生数据</td></tr>';
    return;
  }

  // 按每个学生聚合
  const studentCards = {};
  state.students.forEach(s => {
    studentCards[s.name] = { cards: [], reviews: [] };
  });
  state.cards.forEach(c => {
    if (!studentCards[c.student_name]) studentCards[c.student_name] = { cards: [], reviews: [] };
    studentCards[c.student_name].cards.push(c);
  });

  // reviews 通过 card_id 关联
  const cardIdToMark = {};
  state.reviews.forEach(r => {
    cardIdToMark[r.card_id] = r.mark;
  });

  const cardIdToStudent = {};
  state.cards.forEach(c => {
    cardIdToStudent[c.id] = c.student_name;
  });

  state.reviews.forEach(r => {
    const student = cardIdToStudent[r.card_id];
    if (student && studentCards[student]) {
      studentCards[student].reviews.push(r);
    }
  });

  const rows = state.students.map(s => {
    const data = studentCards[s.name] || { cards: [], reviews: [] };
    const cardList = data.cards;
    const reviewList = data.reviews;

    // 三色统计（每张卡的最新标记 = 已掌握/半掌握/未掌握）
    const cardStatus = {};
    cardList.forEach(c => { cardStatus[c.id] = null; });
    reviewList.forEach(r => {
      // 最近的 mark 覆盖
      cardStatus[r.card_id] = r.mark;
    });
    let done = 0, half = 0, bad = 0;
    Object.values(cardStatus).forEach(m => {
      if (m === 'done') done++;
      else if (m === 'half') half++;
      else if (m === 'bad') bad++;
    });

    // 学科
    const subjects = [...new Set(cardList.map(c => c.subject).filter(Boolean))];

    // 掌握率 = 已掌握 / (有标记的卡数)，如果没标记则 0%
    const reviewedCount = done + half + bad;
    const rate = reviewedCount > 0 ? Math.round(done / reviewedCount * 100) : 0;
    let rateClass = 'low';
    if (rate >= 70) rateClass = '';
    else if (rate >= 40) rateClass = 'mid';

    const subjectsHtml = subjects.length > 0
      ? subjects.map(x => `<span class="subject-chip">${escapeHtml(x)}</span>`).join('')
      : '<span class="subject-chip" style="color:var(--ink-faint)">—</span>';

    return `<tr>
      <td><span class="student-name">${escapeHtml(s.name)}</span></td>
      <td>${cardList.length}</td>
      <td><div class="subject-chips">${subjectsHtml}</div></td>
      <td>${reviewList.length}</td>
      <td>${done}</td>
      <td>${half}</td>
      <td>${bad}</td>
      <td>
        <div class="rate-wrap">
          <div class="rate-bar"><div class="rate-fill ${rateClass}" style="width:${rate}%"></div></div>
          <span class="rate-text">${rate}%</span>
        </div>
      </td>
    </tr>`;
  });

  tbody.innerHTML = rows.join('');
}

function renderSubjectGrid() {
  const grid = document.getElementById('subject-grid');

  const counts = {};
  state.cards.forEach(c => {
    if (!c.subject) return;
    counts[c.subject] = (counts[c.subject] || 0) + 1;
  });

  const subjects = Object.keys(counts).sort();

  if (subjects.length === 0) {
    grid.innerHTML = '<div class="empty-row">还没有卡片数据</div>';
    return;
  }

  grid.innerHTML = subjects.map(s => `
    <div class="subject-cell">
      <div class="subject-cell-name">${escapeHtml(s)}</div>
      <div class="subject-cell-count">${counts[s]}</div>
    </div>
  `).join('');
}

function renderRecentTable() {
  const tbody = document.getElementById('recent-tbody');

  const cardById = {};
  state.cards.forEach(c => { cardById[c.id] = c; });

  const recent = state.reviews.slice(0, 20);

  if (recent.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">还没有复习记录</td></tr>';
    return;
  }

  tbody.innerHTML = recent.map(r => {
    const card = cardById[r.card_id] || {};
    return `<tr>
      <td><span class="recent-time">${fmtTime(r.reviewed_at)}</span></td>
      <td><span class="student-name">${escapeHtml(card.student_name || '—')}</span></td>
      <td><span class="subject-chip">${escapeHtml(card.subject || '—')}</span></td>
      <td><div class="recent-question">${escapeHtml(card.question || '—')}</div></td>
      <td>${markLabel(r.mark)}</td>
    </tr>`;
  }).join('');
}

// ===== 启动 =====
document.getElementById('refresh-btn').addEventListener('click', loadAll);
loadAll();