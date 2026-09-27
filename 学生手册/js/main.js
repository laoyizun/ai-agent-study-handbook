/* ============================================
   学生手册 · 公共脚本
   ============================================ */

function copyCode(btn) {
  const wrap = btn.parentElement;
  const code = wrap.querySelector('pre code') || wrap.querySelector('pre');
  const text = code.innerText;
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