/* ============================================
   学生手册 · 公共脚本
   ============================================ */

// 默认行为：复制紧邻的 pre > code / pre 文本
function copyCode(btn) {
  const wrap = btn.parentElement;
  const code = wrap.querySelector('pre code') || wrap.querySelector('pre');
  const text = code.innerText;
  copyToClipboard(text, btn);
}

// 按 data-copy-target="元素 ID" 复制指定元素的文本
function copyById(btn) {
  const targetId = btn.getAttribute('data-copy-target');
  const target = document.getElementById(targetId);
  if (!target) {
    btn.innerText = '未找到目标';
    setTimeout(() => { btn.innerText = '复制'; }, 1500);
    return;
  }
  copyToClipboard(target.innerText, btn);
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerText;
    btn.innerText = '已复制 ✓';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.innerText = orig;
      btn.classList.remove('copied');
    }, 1500);
  }).catch(() => {
    btn.innerText = '复制失败';
    setTimeout(() => { btn.innerText = '复制'; }, 1500);
  });
}

// 绑定所有 .copy-btn
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    if (btn.getAttribute('data-copy-target')) {
      btn.addEventListener('click', () => copyById(btn));
    } else {
      btn.addEventListener('click', () => copyCode(btn));
    }
  });
});