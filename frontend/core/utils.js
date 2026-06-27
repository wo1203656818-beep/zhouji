// ====== 周迹 Core: 工具函数 ======
window.$ = function(s) { return document.querySelector(s); };
window.$$ = function(s) { return document.querySelectorAll(s); };

window.el = function(tag, cls, html) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

window.escapeHtml = function(str) {
  if (!str && str !== 0) return '';
  var d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str)));
  return d.innerHTML;
};

window.debounce = function(fn, ms) {
  ms = ms || 300; var t;
  return function() { clearTimeout(t); var ctx = this, args = arguments; t = setTimeout(function() { fn.apply(ctx, args); }, ms); };
};

// Toast 通知
window.showToast = function(message, type) {
  type = type || 'success';
  var colors = { success: '#16a34a', error: '#dc2626', warning: '#d97706', info: '#6366f1' };
  var c = colors[type] || colors.success;
  var t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:99999;background:' + c + ';color:#fff;padding:10px 20px;border-radius:12px;font-size:13px;font-weight:500;box-shadow:0 4px 20px rgba(0,0,0,0.2);max-width:85%;text-align:center;transition:opacity 0.3s;';
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(function() { t.style.opacity = '0'; setTimeout(function() { if (t.parentNode) t.remove(); }, 300); }, 2500);
};

// 确认弹窗
window.showConfirmModal = function(msg, confirmText, cancelText) {
  return new Promise(function(resolve) {
    var prev = document.activeElement;
    var backdrop = window.el('div', 'fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 modal-backdrop');
    backdrop.innerHTML = '<div class="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl modal-content">' +
      '<p class="text-gray-800 dark:text-gray-200 mb-6">' + window.escapeHtml(msg) + '</p>' +
      '<div class="flex gap-3 justify-end">' +
      '<button id="modal-cancel-btn" class="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all font-medium touch-btn">' + window.escapeHtml(cancelText || '取消') + '</button>' +
      '<button id="modal-confirm-btn" class="px-4 py-2 rounded-xl bg-danger text-white hover:bg-danger/90 transition-all font-medium touch-btn">' + window.escapeHtml(confirmText || '确定') + '</button>' +
      '</div></div>';
    document.body.appendChild(backdrop);
    setTimeout(function() { document.getElementById('modal-confirm-btn').focus(); }, 50);
    function close(r) { backdrop.remove(); if (prev && prev.focus) prev.focus(); resolve(r); }
    document.getElementById('modal-confirm-btn').onclick = function() { close(true); };
    document.getElementById('modal-cancel-btn').onclick = function() { close(false); };
    backdrop.onclick = function(e) { if (e.target === backdrop) close(false); };
    var kh = function(e) { if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', kh); } };
    document.addEventListener('keydown', kh);
  });
};

// 错误+重试
window.showErrorWithRetry = function(containerId, retryFn, msg) {
  var c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = '<div class="text-center py-8 text-gray-400 dark:text-gray-500">' +
    '<i class="fas fa-exclamation-triangle text-3xl mb-3 text-danger/60"></i>' +
    '<p class="mb-3">' + window.escapeHtml(msg || '加载失败') + '</p>' +
    '<button onclick="' + retryFn + '()" class="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-all touch-btn">' +
    '<i class="fas fa-redo mr-1"></i>重试</button></div>';
};
