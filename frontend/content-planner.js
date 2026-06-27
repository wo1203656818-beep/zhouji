// ==================== 内容日历 - 规划短视频 + X Thread ====================
(function() {

  var currentMonth, currentYear;

  function init() {
    var now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
  }
  init();

  window.renderContentPlanner = async function() {
    var isDark = document.documentElement.classList.contains('dark');
    var c = { bg: isDark ? '#0f172a' : '#f8fafc', card: isDark ? '#1e293b' : '#fff', border: isDark ? '#334155' : '#e2e8f0', text: isDark ? '#f1f5f9' : '#0f172a', muted: isDark ? '#94a3b8' : '#64748b' };

    // 加载灵感数据作为内容源
    var inspirations = [];
    try {
      var data = await api.get('/api/diary?template_type=inspiration&limit=99');
      inspirations = data.entries || [];
    } catch(e) {}

    var div = document.createElement('div');
    div.className = 'p-4 md:p-8 max-w-4xl mx-auto fade-in';
    div.style.cssText = 'animation:fadeIn 0.3s ease;';

    var html = '<div style="margin-bottom:24px;">';
    html += '<h2 class="text-xl md:text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2"><i class="fas fa-calendar-alt text-indigo-500" style="font-size:18px;"></i> 内容日历</h2>';
    html += '<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">规划短视频和 X Thread 的发布时间</p></div>';

    // 月度导航
    var monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">';
    html += '<button onclick="window._contentPrevMonth()" class="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-200 dark:hover:bg-gray-600"><i class="fas fa-chevron-left"></i></button>';
    html += '<span class="font-semibold text-gray-800 dark:text-white">' + currentYear + '年 ' + monthNames[currentMonth] + '</span>';
    html += '<button onclick="window._contentNextMonth()" class="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-200 dark:hover:bg-gray-600"><i class="fas fa-chevron-right"></i></button>';
    html += '</div>';

    // 日历网格
    var firstDay = new Date(currentYear, currentMonth, 1).getDay(); // 0=Sun
    var daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    var today = new Date();

    html += '<div style="background:' + c.card + ';border:1px solid ' + c.border + ';border-radius:12px;overflow:hidden;">';
    // 星期行
    var weekDays = ['日','一','二','三','四','五','六'];
    html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);background:' + (isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc') + ';border-bottom:1px solid ' + c.border + ';">';
    weekDays.forEach(function(d) {
      html += '<div style="padding:8px 4px;text-align:center;font-size:12px;color:' + c.muted + ';font-weight:500;">' + d + '</div>';
    });
    html += '</div>';

    // 日期格子
    html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);">';
    // 空白填充
    for (var i = 0; i < firstDay; i++) {
      html += '<div style="min-height:80px;border-right:1px solid ' + c.border + ';border-bottom:1px solid ' + c.border + ';"></div>';
    }
    for (var day = 1; day <= daysInMonth; day++) {
      var isToday = (currentYear === today.getFullYear() && currentMonth === today.getMonth() && day === today.getDate());
      var dateStr = currentYear + '-' + String(currentMonth + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      // 查找当天的灵感
      var dayInspirations = inspirations.filter(function(entry) {
        var created = (entry.created_at || '').split('T')[0];
        return created === dateStr;
      });

      html += '<div style="min-height:80px;padding:4px;border-right:1px solid ' + c.border + ';border-bottom:1px solid ' + c.border + ';' + (isToday ? 'background:' + (isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08))') : '') + ';">';
      html += '<div style="font-size:12px;font-weight:' + (isToday ? '700' : '400') + ';color:' + (isToday ? '#6366f1' : c.text) + ';margin-bottom:2px;">' + day + '</div>';
      // 显示当天灵感
      dayInspirations.slice(0, 2).forEach(function(entry) {
        var short = (entry.content || entry.title || '').substring(0, 12);
        html += '<div style="font-size:9px;padding:1px 3px;margin:1px 0;border-radius:3px;background:#dbeafe;color:#1d4ed8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;" title="' + window.escapeHtml(entry.content || entry.title || '') + '">' + window.escapeHtml(short) + '</div>';
      });
      if (dayInspirations.length > 2) {
        html += '<div style="font-size:9px;color:' + c.muted + ';">+ ' + (dayInspirations.length - 2) + ' 条</div>';
      }
      html += '</div>';
    }
    html += '</div></div>';

    // 灵感列表（可按日期筛选）
    html += '<div style="margin-top:20px;">';
    html += '<h3 class="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5"><i class="fas fa-list text-gray-400" style="font-size:12px;"></i> 当月灵感 (' + inspirations.length + ')</h3>';
    if (inspirations.length === 0) {
      html += '<div class="text-center py-8 text-gray-400 text-sm">还没有灵感，去辅助工具里记录吧</div>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:4px;">';
      inspirations.slice(0, 10).forEach(function(entry) {
        var date = (entry.created_at || '').split('T')[0];
        var snippet = (entry.content || '').substring(0, 60);
        html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:' + c.card + ';border:1px solid ' + c.border + ';border-radius:8px;font-size:13px;">';
        html += '<span style="font-size:11px;color:' + c.muted + ';flex-shrink:0;width:70px;">' + date + '</span>';
        html += '<span style="color:' + c.text + ';">' + window.escapeHtml(snippet) + '</span>';
        html += '</div>';
      });
      html += '</div>';
    }
    html += '</div>';

    div.innerHTML = html;
    return div;
  };

  // 月份导航
  window._contentPrevMonth = function() {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    window.navigate('content-planner');
  };
  window._contentNextMonth = function() {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    window.navigate('content-planner');
  };
})();
