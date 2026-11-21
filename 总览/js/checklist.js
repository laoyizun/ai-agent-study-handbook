// ============================================================
// 能力自查清单 · 数据 + 渲染 + 持久化
// 清单项与上方「能力维度解析」一一对应，共 22 项
// ============================================================

const CHECKLIST = [
  {
    dim: '工具认知',
    items: [
      { id: 'd1-1', name: 'AI 工作空间机制', lessons: ['L1'], do: '理解工作空间是「一组对话 + 共享知识库」，能创建、迁移' },
      { id: 'd1-2', name: '学科任务对话', lessons: ['L1', 'L2'], do: '每个学科用独立对话，不混用' },
      { id: 'd1-3', name: '跨设备 / 跨账号迁移', lessons: ['L2', 'L6'], do: '用迁移文件或云端数据库携带自己的 AI 资产' },
      { id: 'd1-4', name: 'AI 上下文窗口', lessons: ['场景 00'], do: '知道 AI 不是全知，闪念本太长它会漏读' }
    ]
  },
  {
    dim: 'Prompt 工程',
    items: [
      { id: 'd2-1', name: '结构化 prompt 三要素', lessons: ['L1'], do: '用「角色 + 上下文约束 + 输出规范」组织开场白' },
      { id: 'd2-2', name: '个人信息 prompt', lessons: ['L1', 'L2'], do: '主动告诉 AI 年级、学科、已懂什么，不等它问' },
      { id: 'd2-3', name: '对话审计 prompt', lessons: ['L1'], do: '用「总结今天的学习情况」让 AI 反向记录' },
      { id: 'd2-4', name: 'prompt 移植', lessons: ['L2'], do: '让旧对话生成开场白，复制到新对话复用' },
      { id: 'd2-5', name: '反向调用 prompt', lessons: ['L3'], do: '把闪念本喂给 AI 让它接着讲，说得出「我讲通的版本」为什么关键' },
      { id: 'd2-6', name: '弱项诊断 prompt', lessons: ['L2', 'L7'], do: '让 AI 基于自己的数据找出弱项并只挑最薄弱几张' }
    ]
  },
  {
    dim: '知识库设计',
    items: [
      { id: 'd3-1', name: '文件即知识库', lessons: ['L2', 'L3'], do: '理解档案.md / 闪念本.md 是 AI 可读的知识库载体' },
      { id: 'd3-2', name: '字段颗粒度决策', lessons: ['L5', 'L7'], do: '决定 schema 写多少字段写哪些，知道 L5 定死的规范为什么在 L7 能直接用' },
      { id: 'd3-3', name: '学科闪念本结构', lessons: ['L3'], do: '每个学科一份独立闪念本，含卡点 + AI 输出 + 我讲通的版本' },
      { id: 'd3-4', name: '闪念本版本迭代', lessons: ['L3'], do: '在 v1 基础上加「我讲通的版本」，知道为什么要自己再讲一遍' }
    ]
  },
  {
    dim: '对话协作',
    items: [
      { id: 'd4-1', name: '让 AI 进入陪练模式而非代写模式', lessons: ['L1', '场景 01'], do: '用开场白让 AI 知道「我不是来抄答案的」' },
      { id: 'd4-2', name: 'AI 误判澄清', lessons: ['L6'], do: 'AI 误判时主动澄清，而不是绕过去' },
      { id: 'd4-3', name: '多轮对话的迭代', lessons: ['L3'], do: '让 AI 反复更新，自己审阅质量，不第一版就收下' },
      { id: 'd4-4', name: 'AI 输出可移植性', lessons: ['L1', 'L3'], do: '判断输出能不能在新对话用，分清「复制题目」和「沉淀资产」' }
    ]
  },
  {
    dim: '元认知与反思',
    items: [
      { id: 'd5-1', name: '学习状态自评', lessons: ['L1', 'L7'], do: '在 AI 总结里识别「假装懂了」的盲区，数字不对就停下' },
      { id: 'd5-2', name: '对话审计习惯', lessons: ['L1'], do: '每节课结束前主动让 AI 总结，变成习惯' },
      { id: 'd5-3', name: '沉淀意识', lessons: ['L3'], do: '意识到 AI 输出要变成自己的资产，放进对话里等于没沉淀' },
      { id: 'd5-4', name: '跨学科迁移思维', lessons: ['L2', 'L3'], do: '看到不同学科闪念本的共性，知道进度地图能让 AI 跨学科帮忙' }
    ]
  }
];

// 课次 → 章节链接
const LESSON_LINK = {
  'L1': '../学生手册/lesson-1.html',
  'L2': '../学生手册/lesson-2.html',
  'L3': '../学生手册/lesson-3.html',
  'L4': '../学生手册/lesson-4.html',
  'L5': '../学生手册/lesson-5.html',
  'L6': '../学生手册/lesson-6.html',
  'L7': '../学生手册/lesson-7.html',
  '场景 00': '../学生手册/model-机制.html',
  '场景 01': '../学生手册/agent-角色设定.html',
  '场景 02': '../学生手册/skill-对话归档.html'
};

const STORE_KEY = 'handbook-ability-checklist-v1';

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ===== 读取已勾选 =====
function loadChecked() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch (e) {
    return new Set();
  }
}

function saveChecked(set) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify([...set]));
  } catch (e) {
    // 隐私模式下写不进去，不影响勾选本身
  }
}

let checked = loadChecked();

// ===== 渲染 =====
function render() {
  const body = document.getElementById('checklist-body');

  body.innerHTML = CHECKLIST.map((group, gi) => `
    <div class="cl-group">
      <div class="cl-group-head">
        <span class="cl-group-num">${gi + 1}</span>
        <span class="cl-group-name">${escapeHtml(group.dim)}</span>
        <span class="cl-group-progress" id="clp-${gi}">0 / ${group.items.length}</span>
      </div>
      <div class="cl-items">
        ${group.items.map(it => `
          <label class="cl-item">
            <input type="checkbox" data-id="${it.id}">
            <span class="cl-box" aria-hidden="true"></span>
            <span class="cl-text">
              <span class="cl-name">${escapeHtml(it.name)}</span>
              <span class="cl-do">${escapeHtml(it.do)}</span>
              <span class="cl-lessons">
                ${it.lessons.map(l => `<a href="${LESSON_LINK[l] || '#'}">${escapeHtml(l)}</a>`).join('')}
              </span>
            </span>
          </label>`).join('')}
      </div>
    </div>`).join('');

  // 绑定
  body.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = checked.has(cb.dataset.id);
    cb.addEventListener('change', () => {
      if (cb.checked) checked.add(cb.dataset.id);
      else checked.delete(cb.dataset.id);
      saveChecked(checked);
      updateProgress();
    });
  });

  updateProgress();
}

function updateProgress() {
  const total = CHECKLIST.reduce((n, g) => n + g.items.length, 0);
  const done = CHECKLIST.reduce(
    (n, g) => n + g.items.filter(it => checked.has(it.id)).length, 0);

  document.getElementById('cp-total').textContent = total;
  document.getElementById('cp-count').textContent = done;
  document.getElementById('cp-fill').style.width =
    (total ? Math.round(done / total * 100) : 0) + '%';

  // 每组的进度
  CHECKLIST.forEach((group, gi) => {
    const el = document.getElementById('clp-' + gi);
    if (!el) return;
    const d = group.items.filter(it => checked.has(it.id)).length;
    el.textContent = `${d} / ${group.items.length}`;
    el.classList.toggle('done', d === group.items.length);
  });
}

// ===== 清空 =====
document.getElementById('cp-reset').addEventListener('click', () => {
  if (!confirm('清空所有勾选，重新来过？')) return;
  checked = new Set();
  saveChecked(checked);
  render();
});

render();
