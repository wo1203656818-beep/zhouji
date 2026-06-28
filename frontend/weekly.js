/* ===================================================================
 * 周视图计划管理模块 v3.0 — 完全重构版
 * 
 * 业务流：查计划 → 整周任务池(显顶) → 7列日网格 → CRUD操作 → 同步任务池
 * 设计原则：单一职责、边界校验、if嵌套≤2层、函数≤80行
 * =================================================================== */

// ╔══════════════════════════════════════════════════════════════════╗
// ║  第一部分：常量配置（所有硬编码值集中管理）                         ║
// ╚══════════════════════════════════════════════════════════════════╝

var W = {
  CAT: [
    { id: 'morning',      label: '晨间', icon: 'fa-sun',       color: '#10B981' },
    { id: 'main_business', label: '主业', icon: 'fa-briefcase', color: '#6366F1' },
    { id: 'side_income',  label: '副业', icon: 'fa-coins',     color: '#F59E0B' },
    { id: 'custom',       label: '自定义', icon: 'fa-pen',     color: '#8B5CF6' }
  ],
  WEEKDAY: ['周日','周一','周二','周三','周四','周五','周六'],
  COLORS: ['#6366F1','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899'],
  COLOR_NAMES: { '#6366F1':'靛蓝', '#10B981':'绿色', '#F59E0B':'橙色', '#EF4444':'红色', '#8B5CF6':'紫色', '#EC4899':'粉色' }
};

// ╔══════════════════════════════════════════════════════════════════╗
// ║  第二部分：纯工具函数（无副作用、无状态依赖、有输入校验）            ║
// ╚══════════════════════════════════════════════════════════════════╝

var U = {

  // 格式化 Date → "YYYY-MM-DD"（本地时区，绝不使用 toISOString）
  fmt: function(d) {
    if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' +
           String(d.getMonth()+1).padStart(2,'0') + '-' +
           String(d.getDate()).padStart(2,'0');
  },

  // "YYYY-MM-DD" → Date（本地时区午夜）
  parse: function(s) {
    if (!s || typeof s !== 'string') return null;
    var d = new Date(s + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  },

  // 计算某天所在周的周一日期 → "YYYY-MM-DD"
  // 算法：getDay() 0=周日 需减6天，1=周一不减，...
  weekStart: function(date) {
    try {
      var d = new Date(date);
      if (isNaN(d.getTime())) { d = new Date(); }
      var day = d.getDay();
      d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
      return U.fmt(d);
    } catch(e) { return U.fmt(new Date()); }
  },

  // 安全获取分类颜色
  catColor: function(catId, fallback) {
    var c = W.CAT.find(function(x) { return x.id === catId; });
    return c ? c.color : (fallback || '#6366F1');
  },

  // 安全获取分类标签
  catLabel: function(catId) {
    var c = W.CAT.find(function(x) { return x.id === catId; });
    return c ? c.label : (catId || '未分类');
  },

  // 校验计划数据完整性 → { ok: bool, msg: string }
  validate: function(plan) {
    if (!plan || typeof plan !== 'object') return { ok: false, msg: '数据为空' };
    var t = plan.title;
    if (!t || typeof t !== 'string' || t.trim().length === 0) return { ok: false, msg: '标题不能为空' };
    if (t.length > 100) return { ok: false, msg: '标题不能超过100字符' };
    if (plan.day_of_week != null) {
      var dw = parseInt(plan.day_of_week);
      if (isNaN(dw) || dw < 0 || dw > 6) return { ok: false, msg: '星期值无效(0-6)' };
    }
    if (plan.priority != null) {
      var pr = parseInt(plan.priority);
      if (isNaN(pr) || pr < 1 || pr > 5) return { ok: false, msg: '优先级无效(1-5)' };
    }
    return { ok: true, msg: '' };
  },

  // 安全获取DOM元素值（不存在时返回默认值）
  val: function(id, def) {
    var el = document.getElementById(id);
    return el ? el.value : (def !== undefined ? def : '');
  }
};

// ╔══════════════════════════════════════════════════════════════════╗
// ║  第三部分：单一状态对象（所有可变状态集中管控）                      ║
// ╚══════════════════════════════════════════════════════════════════╝

var S = {
  weekStart: U.weekStart(new Date()),   // 当前展示周的周一日期
  plans: [],                            // 本周计划数组
  view: 'week',                         // 'week' | 'day'
  selDay: null,                         // 日视图时选中的日期
  selIds: {},                           // 选中的计划ID集合 {id: true}
  skipGuide: false,                     // 跳过引导页标记

  // 重置选择状态
  reset: function() { S.selIds = {}; S.selDay = null; },

  // 切换选中
  toggle: function(id) {
    if (!id) return;
    S.selIds[id] ? delete S.selIds[id] : (S.selIds[id] = true);
  },

  // 选中数组
  selected: function() { return Object.keys(S.selIds).map(Number); },

  // 选中数量
  selCount: function() { return Object.keys(S.selIds).length; },

  // 清空选中
  clearSel: function() { S.selIds = {}; }
};

// ╔══════════════════════════════════════════════════════════════════╗
// ║  第四部分：API封装（统一错误处理 + loading状态 + 参数校验）         ║
// ╚══════════════════════════════════════════════════════════════════╝

var A = {

  // 通用请求包装器
  _call: async function(fn, name) {
    try {
      var r = await fn();
      return { ok: true, data: r, err: null };
    } catch(e) {
      console.error('[' + name + ']', e);
      return { ok: false, data: null, err: e.message || '请求失败' };
    }
  },

  // 获取本周计划
  getPlans: async function(ws) {
    var w = ws || S.weekStart;
    return A._call(function() { return api.get('/api/weekly-plans?week_start=' + w); }, 'getPlans');
  },

  // 初始化内置模板
  initTemplates: async function(ws) {
    var w = ws || S.weekStart;
    return A._call(function() { return api.post('/api/weekly-plans/init-templates', { week_start: w }); }, 'initTemplates');
  },

  // 创建计划
  create: async function(data) {
    if (!data || !data.title) return { ok: false, err: '标题不能为空' };
    if (!data.week_start) data.week_start = S.weekStart;
    return A._call(function() { return api.post('/api/weekly-plans', data); }, 'create');
  },

  // 更新计划
  update: async function(id, data) {
    if (!id || !data) return { ok: false, err: '参数无效' };
    return A._call(function() { return api.put('/api/weekly-plans/' + id, data); }, 'update');
  },

  // 删除计划（支持批量）
  remove: async function(ids) {
    if (!ids || !ids.length) return { ok: false, err: '请选择计划' };
    return A._call(function() { return api.post('/api/weekly-plans/delete', { ids: ids }); }, 'delete');
  },

  // 清空本周
  clear: async function(ws) {
    var w = ws || S.weekStart;
    return A._call(function() { return api.post('/api/weekly-plans/clear', { week_start: w, clear_builtin: true }); }, 'clear');
  },

  // 同步到任务池
  sync: async function(ids, ws) {
    var w = ws || S.weekStart;
    return A._call(function() {
      return api.post('/api/weekly-plans/sync-to-tasks', { plan_ids: ids || [], week_start: w, keep_existing: true });
    }, 'sync');
  },

  // ═══ 模板管理 ═══
  getTemplates: function() { return A._call(function() { return api.get('/api/weekly-plans/templates'); }, 'getTemplates'); },
  createTemplate: function(d) { return A._call(function() { return api.post('/api/weekly-plans/templates', d); }, 'createTemplate'); },
  updateTemplate: function(id, d) { return A._call(function() { return api.put('/api/weekly-plans/templates/' + id, d); }, 'updateTemplate'); },
  deleteTemplate: function(id) { return A._call(function() { return api.del('/api/weekly-plans/templates/' + id); }, 'deleteTemplate'); },
  initCustomTemplates: function(ws) {
    var w = ws || S.weekStart;
    return A._call(function() { return api.post('/api/weekly-plans/init-custom-templates', { week_start: w }); }, 'initCustomTemplates');
  }
};

// ╔══════════════════════════════════════════════════════════════════╗
// ║  第五部分：DOM构建函数（纯渲染，接收数据返回HTML字符串）             ║
// ╚══════════════════════════════════════════════════════════════════╝

var R = {

  // 构建页面头部（周导航 + 视图切换 + 操作按钮）
  head: function(ws, we) {
    var h = '';
    h += '<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">';
    h += '<div>';
    h += '<h2 class="text-xl font-bold text-gray-800 dark:text-white"><i class="fas fa-calendar-week text-indigo-500 mr-2"></i>周视图</h2>';
    h += '<p class="text-xs text-gray-400 mt-1">' + ws + ' ~ ' + we + '</p>';
    h += '</div>';
    h += '<div class="flex items-center gap-2 flex-wrap">';
    // 周导航按钮组
    h += '<div class="flex bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">';
    h += '<button onclick="H.shift(-1)" class="px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500"><i class="fas fa-chevron-left text-xs"></i></button>';
    h += '<button onclick="H.shift(0)" class="px-3 py-2 text-xs font-medium text-indigo-500 border-x border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">本周</button>';
    h += '<button onclick="H.shift(1)" class="px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500"><i class="fas fa-chevron-right text-xs"></i></button>';
    h += '</div>';
    // 视图切换
    h += '<div class="flex bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">';
    h += '<button onclick="H.setView(\'week\')" class="px-3 py-2 text-xs font-medium ' + (S.view==='week'?'bg-indigo-500 text-white':'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700') + '">周</button>';
    h += '<button onclick="H.setView(\'day\')" class="px-3 py-2 text-xs font-medium ' + (S.view==='day'?'bg-indigo-500 text-white':'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700') + '">日</button>';
    h += '</div>';
    // 操作按钮
    h += '<button onclick="H.showAdd()" class="px-3 py-2 bg-indigo-500 text-white rounded-lg text-xs font-medium hover:bg-indigo-600 transition-all"><i class="fas fa-plus mr-1"></i>新建</button>';
    h += '<button onclick="H.showMenu()" class="px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all text-xs"><i class="fas fa-ellipsis-h"></i></button>';
    h += '</div></div>';
    return h;
  },

  // 构建进度条
  progress: function() {
    var total = S.plans.length;
    var done = S.plans.filter(function(p) { return p.status === 'completed'; }).length;
    var pct = total > 0 ? Math.round(done / total * 100) : 0;
    var h = '<div class="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700 mb-5">';
    h += '<div class="flex items-center justify-between text-xs mb-2">';
    h += '<span class="text-gray-500">本周计划 <b class="text-gray-800 dark:text-white">' + total + '</b> 项</span>';
    h += '<span class="text-gray-500">已完成 <b class="text-green-500">' + done + '</b>（' + pct + '%）</span>';
    h += '</div>';
    h += '<div class="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">';
    h += '<div class="h-full bg-green-500 rounded-full transition-all" style="width:' + pct + '%"></div>';
    h += '</div></div>';
    return h;
  },

  // 构建批量操作栏
  batchBar: function() {
    if (S.selCount() === 0) return '';
    var h = '<div class="flex items-center gap-2 mb-4 p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800">';
    h += '<span class="text-xs font-medium text-indigo-600 dark:text-indigo-400">已选 ' + S.selCount() + ' 项</span>';
    h += '<button onclick="H.batchSync()" class="px-2.5 py-1 bg-indigo-500 text-white rounded text-xs hover:bg-indigo-600"><i class="fas fa-sync-alt mr-1"></i>同步</button>';
    h += '<button onclick="H.batchDelete()" class="px-2.5 py-1 bg-red-50 dark:bg-red-900/20 text-red-500 rounded text-xs hover:bg-red-100"><i class="fas fa-trash mr-1"></i>删除</button>';
    h += '<button onclick="S.clearSel();H.refresh();" class="px-2 py-1 text-gray-400 text-xs hover:text-gray-600">取消</button>';
    h += '</div>';
    return h;
  },

  // ═══ 整周任务池 — 核心新设计 ═══
  // 将 day_of_week=null 的计划展示在页面顶部醒目位置
  // 每张卡片可拖拽到下方日期列来分配日期
  pool: function() {
    var items = S.plans.filter(function(p) { return p.day_of_week === null; });
    if (items.length === 0) return '';
    if (S.view === 'day') return '';  // 日视图不需要显示整周池

    var h = '<div class="mb-5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 rounded-xl border-2 border-dashed border-amber-200 dark:border-amber-700 p-4">';
    h += '<div class="flex items-center gap-2 mb-3">';
    h += '<div class="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400"><i class="fas fa-layer-group text-xs"></i></div>';
    h += '<h3 class="text-sm font-bold text-amber-700 dark:text-amber-400">未分配任务</h3>';
    h += '<span class="text-xs text-amber-500">拖拽到下方日期列即可分配星期</span>';
    h += '</div>';
    h += '<div class="flex flex-wrap gap-2">';
    for (var i = 0; i < items.length; i++) {
      h += R.poolCard(items[i]);
    }
    h += '</div></div>';
    return h;
  },

  // 整周池中的单张卡片
  poolCard: function(p) {
    var color = p.color || U.catColor(p.category);
    var isSynced = p.sync_token && p.sync_token.indexOf('synced_') === 0;
    var time = p.start_time ? p.start_time.slice(0,5) + (p.end_time ? '-' + p.end_time.slice(0,5) : '') : '';
    var h = '<div class="group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-amber-300 dark:hover:border-amber-500 transition-all" ';
    h += 'draggable="true" ondragstart="H.dragStart(event,' + p.id + ')" onclick="H.showEdit(' + p.id + ')" style="border-left:3px solid ' + color + '">';
    h += '<div class="flex items-center gap-2">';
    h += '<i class="fas fa-grip-vertical text-gray-300 text-xs"></i>';
    h += '<span class="text-xs font-medium text-gray-700 dark:text-gray-300" style="word-break:break-word;overflow-wrap:break-word" title="' + escapeHtml(p.title) + '">' + escapeHtml(p.title) + '</span>';
    if (time) h += '<span class="text-[10px] text-gray-400"><i class="far fa-clock mr-0.5"></i>' + time + '</span>';
    if (isSynced) h += '<i class="fas fa-check-circle text-[10px] text-green-400 ml-auto"></i>';
    h += '<button onclick="event.stopPropagation();H.showEdit(' + p.id + ')" class="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-gray-300 hover:text-indigo-500 ml-auto" title="编辑"><i class="fas fa-pen text-[9px]"></i></button>';
    h += '</div></div>';
    return h;
  },

  // ═══ 7列周视图 ═══
  weekGrid: function(ws) {
    var wsDate = U.parse(ws);
    if (!wsDate) return '<p class="text-red-500">日期解析错误</p>';

    var today = U.fmt(new Date());
    var h = '<div class="flex md:grid md:grid-cols-7 gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0" style="-webkit-overflow-scrolling:touch;scroll-snap-type:x mandatory;">';

    for (var i = 0; i < 7; i++) {
      // 列 i=0→周日, i=1→周一 ... i=6→周六
      // weekStart是周一，所以列i的日期 = wsDate + (i-1)天
      var d = new Date(wsDate);
      d.setDate(d.getDate() + i - 1);
      var ds = U.fmt(d);
      var isToday = ds === today;
      var dayPlans = S.plans.filter(function(p) { return p.day_of_week === i; });
      h += R.dayCol(i, ds, dayPlans, isToday);
    }
    h += '</div>';
    return h;
  },

  // 单日列
  dayCol: function(dayIdx, ds, plans, isToday) {
    var h = '<div class="bg-white dark:bg-gray-800 rounded-xl border ' + (isToday ? 'border-indigo-300 dark:border-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-900' : 'border-gray-100 dark:border-gray-700') + ' p-2.5 transition-all md:min-w-0 min-w-[220px] flex-shrink-0" style="scroll-snap-align:start;" ';
    h += 'ondragover="event.preventDefault();this.classList.add(\'ring-2\',\'ring-amber-300\')" ';
    h += 'ondragleave="this.classList.remove(\'ring-2\',\'ring-amber-300\')" ';
    h += 'ondrop="H.handleDrop(event,' + dayIdx + ')" ';
    h += '>';
    // 日期头
    h += '<div class="flex items-center justify-between mb-2">';
    h += '<span class="text-xs font-bold ' + (isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400') + '">' + W.WEEKDAY[dayIdx] + '</span>';
    h += '<span class="text-[10px] ' + (isToday ? 'text-indigo-500 font-bold' : 'text-gray-400') + '">' + ds.slice(5) + '</span>';
    h += '</div>';
    // 计划列表
    h += '<div class="space-y-1.5 min-h-[100px]">';
    if (plans.length === 0) {
      h += '<div class="text-center py-3">';
      h += '<p class="text-[10px] text-gray-300 dark:text-gray-600 mb-1">空</p>';
      h += '<button onclick="H.showAdd(' + dayIdx + ')" class="text-[10px] text-indigo-400 hover:underline">+ 添加</button>';
      h += '</div>';
    } else {
      for (var j = 0; j < plans.length; j++) {
        h += R.compactCard(plans[j]);
      }
      // 非空列底部也显示"+ 添加"按钮
      h += '<div class="text-center pt-1.5">';
      h += '<button onclick="event.stopPropagation();H.showAdd(' + dayIdx + ')" class="text-[10px] text-indigo-400 hover:underline">+ 添加</button>';
      h += '</div>';
    }
    h += '</div>';
    // "查看全部"（超过4项时折叠）
    if (plans.length > 4) {
      h += '<button onclick="H.showDay(\'' + ds + '\')" class="text-[10px] text-indigo-400 hover:underline mt-1">全部 ' + plans.length + ' 项</button>';
    }
    h += '</div>';
    return h;
  },

  // 紧凑卡片（用于7列日格中 — 无checkbox，最大化显示标题）
  compactCard: function(p) {
    var color = p.color || U.catColor(p.category);
    var isSel = !!S.selIds[p.id];
    var isDone = p.status === 'completed';
    var time = p.start_time ? p.start_time.slice(0,5) + (p.end_time ? '-' + p.end_time.slice(0,5) : '') : '';
    var title = escapeHtml(p.title);
    // 使用 title 属性展示完整标题（hover 可见）
    var h = '<div class="group rounded-md border cursor-pointer ' +
      (isSel ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-300' : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800') +
      ' p-1.5 hover:shadow-sm transition-all ' +
      (isDone ? 'opacity-50' : '') + '" ';
    h += 'draggable="true" ondragstart="H.dragStart(event,' + p.id + ')" ';
    h += 'onclick="H.showEdit(' + p.id + ')" ';
    h += 'style="border-left:2.5px solid ' + color + '" title="' + title + (time ? ' | ' + time : '') + '">';
    // ═══ 三行布局 ═══
    // 第1行：标题
    h += '<div style="font-size:11px;font-weight:400;line-height:1.35;word-break:break-word;overflow-wrap:break-word;color:#6b7280" class="dark:text-gray-400 ' + (isDone ? 'line-through' : '') + '">' + title + '</div>';
    // 第2行：时间（独占一行，完整显示）
    var isSynced = p.sync_token && p.sync_token.indexOf('synced_') === 0;
    h += '<div style="font-size:10px;color:#9ca3af;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (time || '') + '</div>';
    // 第3行：操作按钮（独占一行，同排不换行）
    h += '<div style="display:flex;align-items:center;margin-top:2px;gap:2px">';
    h += '<span onclick="event.stopPropagation();H.showEdit(' + p.id + ')" style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;color:#9ca3af;cursor:pointer;border-radius:2px" title="编辑" onmouseover="this.style.color=\'#6366f1\';this.style.background=\'#eef2ff\'" onmouseout="this.style.color=\'#9ca3af\';this.style.background=\'transparent\'"><i class="fas fa-pen" style="font-size:7px"></i></span>';
    h += '<span onclick="event.stopPropagation();H.toggleDone(' + p.id + ')" style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;color:#9ca3af;cursor:pointer;border-radius:2px" title="' + (isDone ? '撤销' : '完成') + '" onmouseover="this.style.color=\'#22c55e\';this.style.background=\'#f0fdf4\'" onmouseout="this.style.color=\'#9ca3af\';this.style.background=\'transparent\'"><i class="fas ' + (isDone ? 'fa-undo' : 'fa-check') + '" style="font-size:7px"></i></span>';
    if (!isSynced) h += '<span onclick="event.stopPropagation();H.syncOne(' + p.id + ')" style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;color:#9ca3af;cursor:pointer;border-radius:2px" title="同步到任务池" onmouseover="this.style.color=\'#6366f1\';this.style.background=\'#eef2ff\'" onmouseout="this.style.color=\'#9ca3af\';this.style.background=\'transparent\'"><i class="fas fa-sync-alt" style="font-size:7px"></i></span>';
    h += '<span onclick="event.stopPropagation();H.toggleSel(' + p.id + ')" style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;cursor:pointer;border-radius:50%;' + (isSel ? 'background:#6366f1;color:#fff' : 'color:#9ca3af') + '" title="选择">';
    h += isSel ? '<i class="fas fa-check" style="font-size:8px"></i>' : '<i class="fas fa-circle" style="font-size:6px;color:#9ca3af"></i>';
    h += '</span>';
    h += '</div>';
    h += '</div>';
    return h;
  },

  // ═══ 日视图 ═══
  dayView: function(ds, plans) {
    var dayIdx = new Date(ds + 'T00:00:00').getDay();
    var h = '<div class="mb-4">';
    h += '<button onclick="H.setView(\'week\')" class="text-sm text-indigo-500 hover:underline mb-3 inline-block"><i class="fas fa-arrow-left mr-1"></i>返回周视图</button>';
    h += '<div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">';
    h += '<h3 class="font-bold text-gray-800 dark:text-white mb-3 text-lg">' + W.WEEKDAY[dayIdx] + ' ' + ds + '</h3>';
    if (plans.length === 0) {
      h += '<p class="text-sm text-gray-400 text-center py-8">这一天没有计划</p>';
    } else {
      h += '<div class="space-y-3">';
      for (var i = 0; i < plans.length; i++) {
        h += R.fullCard(plans[i]);
      }
      h += '</div>';
    }
    // 添加按钮
    h += '<div class="text-center mt-3"><button onclick="H.showAdd(' + dayIdx + ')" class="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 transition-all"><i class="fas fa-plus mr-1"></i>添加计划</button></div>';
    h += '</div></div>';
    return h;
  },

  // 完整卡片（日视图/整周列表用）
  fullCard: function(p) {
    var color = p.color || U.catColor(p.category);
    var isSel = !!S.selIds[p.id];
    var isDone = p.status === 'completed';
    var isSynced = p.sync_token && p.sync_token.indexOf('synced_') === 0;
    var time = p.start_time ? p.start_time.slice(0,5) + (p.end_time ? '-' + p.end_time.slice(0,5) : '') : '';

    var h = '<div class="group bg-white dark:bg-gray-800/80 rounded-lg border ' + (isSel ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30' : 'border-gray-100 dark:border-gray-700') + ' p-3 hover:shadow-sm transition-all ' + (isDone ? 'opacity-60' : '') + '" ';
    h += 'draggable="true" ondragstart="H.dragStart(event,' + p.id + ')" style="border-left:3px solid ' + color + '">';
    h += '<div class="flex items-start gap-3">';
    // 复选框
    h += '<input type="checkbox" ' + (isSel ? 'checked' : '') + ' onchange="H.toggleSel(' + p.id + ')" class="mt-1 accent-indigo-500">';
    // 内容区
    h += '<div class="flex-1 min-w-0">';
    h += '<div class="flex items-center gap-2 flex-wrap">';
    h += '<span class="font-medium text-sm text-gray-800 dark:text-white ' + (isDone ? 'line-through' : '') + '">' + escapeHtml(p.title) + '</span>';
    if (p.priority >= 4) h += '<span class="text-[10px] px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-900/20 text-red-500">高优</span>';
    if (isSynced) h += '<span class="text-[10px] px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/20 text-green-500"><i class="fas fa-check"></i></span>';
    if (p.is_builtin) h += '<span class="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-500">模板</span>';
    h += '</div>';
    if (p.description) h += '<p class="text-xs text-gray-400 mt-1 truncate">' + escapeHtml(p.description) + '</p>';
    h += '<div class="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">';
    if (time) h += '<span><i class="far fa-clock mr-0.5"></i>' + time + '</span>';
    h += '<span>' + U.catLabel(p.category) + '</span>';
    h += '</div></div>';
    // 操作按钮组
    h += '<div class="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">';
    h += '<button onclick="event.stopPropagation();H.showEdit(' + p.id + ')" class="w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 text-xs"><i class="fas fa-pen"></i></button>';
    h += '<button onclick="event.stopPropagation();H.remove(' + p.id + ')" class="w-7 h-7 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 text-xs"><i class="fas fa-trash"></i></button>';
    if (!isSynced) h += '<button onclick="event.stopPropagation();H.syncOne(' + p.id + ')" class="w-7 h-7 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-400 hover:text-indigo-500 text-xs" title="同步到任务池"><i class="fas fa-sync-alt"></i></button>';
    h += '<button onclick="event.stopPropagation();H.toggleDone(' + p.id + ')" class="w-7 h-7 rounded hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-400 hover:text-green-500 text-xs"><i class="fas ' + (isDone ? 'fa-undo' : 'fa-check') + '"></i></button>';
    h += '</div>';
    h += '</div></div>';
    return h;
  },

  // ═══ 弹窗 ═══
  // 新建计划弹窗
  addModal: function(defaults) {
    var defs = defaults || {};
    var modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 fk-weekly-modal';
    modal.onclick = function(e) { if (e.target === modal) { H.closeModal(); } };
    modal.innerHTML =
      '<div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl">' +
      '<h3 class="font-bold text-lg text-gray-800 dark:text-white mb-4"><i class="fas fa-plus-circle text-indigo-500 mr-2"></i>新建计划</h3>' +
      '<form onsubmit="return false" class="space-y-3">' +
      '<div><label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">标题 *</label>' +
      '<input id="wa-title" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white" placeholder="计划名称" value="' + (defs.title||'') + '" required></div>' +
      '<div><label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">描述</label>' +
      '<textarea id="wa-desc" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white" rows="2" placeholder="可选">' + (defs.desc||'') + '</textarea></div>' +
      '<div class="grid grid-cols-2 gap-3">' +
      '<div><label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">分类</label>' +
      '<select id="wa-cat" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white">' +
      W.CAT.map(function(c) { return '<option value="' + c.id + '" ' + (defs.category===c.id?'selected':'') + '>' + c.label + '</option>'; }).join('') +
      '</select></div>' +
      '<div><label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">优先级</label>' +
      '<select id="wa-pri" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white">' +
      '<option value="1">⭐ 低</option><option value="2">⭐⭐ 中低</option><option value="3" selected>⭐⭐⭐ 中</option><option value="4">⭐⭐⭐⭐ 高</option><option value="5">⭐⭐⭐⭐⭐ 紧急</option>' +
      '</select></div></div>' +
      '<div class="grid grid-cols-2 gap-3">' +
      '<div><label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">星期</label>' +
      '<select id="wa-day" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white">' +
      '<option value="">整周</option>' +
      W.WEEKDAY.map(function(n,i) { return '<option value="' + i + '" ' + (defs.day===i?'selected':'') + '>' + n + '</option>'; }).join('') +
      '</select></div>' +
      '<div><label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">颜色</label>' +
      '<select id="wa-color" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white">' +
      W.COLORS.map(function(c) { return '<option value="' + c + '">● ' + (W.COLOR_NAMES[c]||c) + '</option>'; }).join('') +
      '</select></div></div>' +
      '<div class="grid grid-cols-2 gap-3">' +
      '<div><label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">开始</label>' +
      '<input type="time" id="wa-start" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white" value="' + (defs.start||'09:00') + '"></div>' +
      '<div><label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">结束</label>' +
      '<input type="time" id="wa-end" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white" value="' + (defs.end||'10:00') + '"></div></div>' +
      '<div class="flex gap-2 pt-2">' +
      '<button onclick="H.submitAdd()" class="flex-1 bg-indigo-500 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-600"><i class="fas fa-check mr-1"></i>创建</button>' +
      '<button onclick="H.closeModal()" class="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>' +
      '</div></form></div>';
    return modal;
  },

  // 编辑计划弹窗
  editModal: function(p) {
    var modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 fk-weekly-modal';
    modal.onclick = function(e) { if (e.target === modal) { H.closeModal(); } };
    modal.innerHTML =
      '<div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl">' +
      '<h3 class="font-bold text-lg text-gray-800 dark:text-white mb-4"><i class="fas fa-edit text-indigo-500 mr-2"></i>编辑</h3>' +
      '<form onsubmit="return false" class="space-y-3">' +
      '<div><label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">标题 *</label>' +
      '<input id="we-title" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white" value="' + escapeHtml(p.title) + '" required></div>' +
      '<div><label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">描述</label>' +
      '<textarea id="we-desc" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white" rows="2">' + escapeHtml(p.description||'') + '</textarea></div>' +
      '<div class="grid grid-cols-2 gap-3">' +
      '<div><label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">分类</label>' +
      '<select id="we-cat" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white">' +
      W.CAT.map(function(c) { return '<option value="' + c.id + '" ' + (p.category===c.id?'selected':'') + '>' + c.label + '</option>'; }).join('') +
      '</select></div>' +
      '<div><label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">优先级</label>' +
      '<select id="we-pri" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white">' +
      [1,2,3,4,5].map(function(v) { return '<option value="' + v + '" ' + (p.priority===v?'selected':'') + '>' + v + '</option>'; }).join('') +
      '</select></div></div>' +
      '<div class="grid grid-cols-2 gap-3">' +
      '<div><label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">星期</label>' +
      '<select id="we-day" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white">' +
      '<option value="">整周</option>' +
      W.WEEKDAY.map(function(n,i) { return '<option value="' + i + '" ' + (p.day_of_week===i?'selected':'') + '>' + n + '</option>'; }).join('') +
      '</select></div>' +
      '<div><label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">状态</label>' +
      '<select id="we-status" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white">' +
      '<option value="pending" ' + (p.status==='pending'?'selected':'') + '>待开始</option>' +
      '<option value="completed" ' + (p.status==='completed'?'selected':'') + '>已完成</option>' +
      '</select></div></div>' +
      '<div class="grid grid-cols-2 gap-3">' +
      '<div><label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">开始</label>' +
      '<input type="time" id="we-start" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white" value="' + (p.start_time||'') + '"></div>' +
      '<div><label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">结束</label>' +
      '<input type="time" id="we-end" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white" value="' + (p.end_time||'') + '"></div></div>' +
      '<div class="flex gap-2 pt-2">' +
      '<button onclick="H.submitEdit(' + p.id + ')" class="flex-1 bg-indigo-500 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-600"><i class="fas fa-save mr-1"></i>保存</button>' +
      '<button onclick="H.closeModal()" class="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>' +
      '</div></form></div>';
    return modal;
  },

  // 引导页
  guide: function() {
    return '<div class="flex items-center justify-center min-h-[50vh]">' +
      '<div class="text-center max-w-md px-4">' +
      '<div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-3xl shadow-lg mx-auto mb-5"><i class="fas fa-calendar-week"></i></div>' +
      '<h2 class="text-2xl font-bold text-gray-800 dark:text-white mb-2">周视图计划</h2>' +
      '<p class="text-sm text-gray-500 dark:text-gray-400 mb-6">规划你的一周，点击下方按钮一键导入模板到每天。<br>导入后可自由编辑、拖拽调整。</p>' +
      '<div class="flex gap-3 justify-center">' +
      '<button onclick="H.initTemplates()" class="px-6 py-3 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 transition-all"><i class="fas fa-magic mr-2"></i>使用内置模板</button>' +
      '<button onclick="H.skipGuide()" class="px-6 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">从零开始</button>' +
      '</div></div></div>';
  },

  // 空状态
  empty: function() {
    if (S.plans.length > 0) return '';
    return '<div class="text-center py-20">' +
      '<div class="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-300 dark:text-gray-600 text-2xl mx-auto mb-4"><i class="fas fa-calendar-plus"></i></div>' +
      '<h3 class="text-lg font-medium text-gray-800 dark:text-white mb-1">本周暂无计划</h3>' +
      '<p class="text-sm text-gray-400 mb-4">点击下方按钮添加计划</p>' +
      '<button onclick="H.showAdd()" class="px-5 py-2 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600"><i class="fas fa-plus mr-1"></i>新建计划</button>' +
      '</div>';
  },

  // 更多操作菜单
  menu: function() {
    var modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 fk-weekly-modal';
    modal.onclick = function(e) { if (e.target === modal) { H.closeModal(); } };
    modal.innerHTML =
      '<div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-xs p-5 shadow-xl">' +
      '<h3 class="font-bold text-gray-800 dark:text-white mb-4"><i class="fas fa-tools text-indigo-500 mr-2"></i>操作</h3>' +
      '<div class="space-y-2">' +
      '<button onclick="H.closeModal();H.initTemplates()" class="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-left">' +
      '<div class="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500"><i class="fas fa-magic text-sm"></i></div>' +
      '<div><p class="text-sm font-medium text-gray-800 dark:text-white">重置模板</p><p class="text-xs text-gray-400">恢复三套预设模板</p></div></button>' +
      '<button onclick="H.closeModal();H.showTemplateEditor()" class="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-left">' +
      '<div class="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-500"><i class="fas fa-pen text-sm"></i></div>' +
      '<div><p class="text-sm font-medium text-gray-800 dark:text-white">编辑模板</p><p class="text-xs text-gray-400">自定义每日模板内容</p></div></button>' +
      '<button onclick="H.closeModal();H.clearWeek()" class="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-left">' +
      '<div class="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500"><i class="fas fa-eraser text-sm"></i></div>' +
      '<div><p class="text-sm font-medium text-gray-800 dark:text-white">清空本周</p><p class="text-xs text-gray-400">删除所有计划</p></div></button>' +
      '<button onclick="H.closeModal();H.syncAll()" class="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-left">' +
      '<div class="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-500"><i class="fas fa-sync-alt text-sm"></i></div>' +
      '<div><p class="text-sm font-medium text-gray-800 dark:text-white">整周同步</p><p class="text-xs text-gray-400">全部同步到任务池</p></div></button>' +
      '</div>' +
      '<button onclick="H.closeModal()" class="w-full mt-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-500 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>' +
      '</div>';
    return modal;
  }
};

// ╔══════════════════════════════════════════════════════════════════╗
// ║  第六部分：事件处理函数（所有用户交互的入口，调用API后刷新页面）      ║
// ╚══════════════════════════════════════════════════════════════════╝

var H = {

  // ═══ 核心：刷新整个页面 ═══
  refresh: async function() {
    if (S._refreshing) return;  // 防止并发刷新
    S._refreshing = true;
    try {
      await window.renderWeekly();
    } catch(e) {
      console.error('[refresh]', e);
    }
    S._refreshing = false;
  },

  // ═══ 渲染主入口 ═══
  // 流程：1)获取数据 2)判断引导 3)构建DOM 4)插入页面
  render: async function() {
    var box = document.createElement('div');
    box.className = 'p-3 md:p-6 max-w-5xl mx-auto fade-in';

    try {
      // 步骤1：计算日期范围
      var ws = S.weekStart;
      var wsDate = U.parse(ws);
      if (!wsDate) throw new Error('日期解析错误');

      var weDate = new Date(wsDate);
      weDate.setDate(weDate.getDate() + 6);
      var weStr = U.fmt(weDate);

      // 步骤2：获取计划数据
      var resp = await A.getPlans(ws);
      if (!resp.ok) throw new Error(resp.err || '加载失败');

      // 步骤3：保存数据到状态
      S.plans = resp.data.plans || [];

      // 步骤4：判断引导页（当前周 + 无计划 + 未跳过 → 引导）
      var isCurrentWeek = (ws === U.weekStart(new Date()));
      if (S.plans.length === 0 && isCurrentWeek && !S.skipGuide) {
        box.innerHTML = R.guide();
        return box;
      }
      S.skipGuide = false;

      // 步骤5：判断日视图
      var isDay = S.view === 'day' && !!S.selDay;
      var dayPlans = isDay ? S.plans.filter(function(p) { return p.day_of_week === new Date(S.selDay + 'T00:00:00').getDay(); }) : [];

      // 步骤6：拼接完整DOM
      var html = '';
      html += R.head(ws, weStr);
      html += R.progress();
      html += R.batchBar();
      html += R.pool();  // ⭐ 整周任务池在网格上方
      if (isDay) {
        html += R.dayView(S.selDay, dayPlans);
      } else {
        html += R.weekGrid(ws);
      }
      html += R.empty();
      box.innerHTML = html;
      return box;

    } catch(e) {
      console.error('[render]', e);
      box.innerHTML = '<div class="text-center py-16 text-red-500"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p>加载失败：' + escapeHtml(e.message) + '</p><button onclick="H.refresh()" class="px-4 py-2 mt-4 bg-indigo-500 text-white rounded-lg text-sm">重试</button></div>';
      return box;
    }
  },

  // ═══ 周导航 ═══
  shift: function(dir) {
    if (dir === 0) {
      S.weekStart = U.weekStart(new Date());
    } else {
      var cur = U.parse(S.weekStart);
      if (!cur) return;
      cur.setDate(cur.getDate() + dir * 7);
      S.weekStart = U.weekStart(cur);
    }
    S.reset();
    H.refresh();
  },

  // ═══ 视图切换 ═══
  setView: function(mode) {
    if (mode !== 'week' && mode !== 'day') return;
    S.view = mode;
    if (mode === 'week') {
      S.selDay = null;
    } else {
      // 日视图：如果没指定日期，默认显示今天的日期
      if (!S.selDay) S.selDay = U.fmt(new Date());
    }
    H.refresh();
  },

  showDay: function(ds) {
    S.view = 'day';
    S.selDay = ds;
    H.refresh();
  },

  // ═══ 选择操作 ═══
  toggleSel: function(id) {
    S.toggle(id);
    H.refresh();
  },

  // ═══ 新建计划 ═══
  showAdd: function(day) {
    if (document.querySelector('.fk-weekly-modal')) return;  // 已有弹窗不重复打开
    var defs = {};
    if (typeof day === 'number') defs.day = day;
    var modal = R.addModal(defs);
    document.body.appendChild(modal);
  },

  submitAdd: async function() {
    if (S._submitting) return;  // 防止重复提交
    S._submitting = true;
    var title = U.val('wa-title', '').trim();
    if (!title) { showToast('请输入标题', 'error'); return; }

    var dayVal = U.val('wa-day', '');
    var data = {
      title: title,
      description: U.val('wa-desc', '').trim(),
      category: U.val('wa-cat', 'custom'),
      priority: parseInt(U.val('wa-pri', '3')) || 3,
      day_of_week: dayVal !== '' ? parseInt(dayVal) : null,
      color: U.val('wa-color', '#6366F1'),
      start_time: U.val('wa-start', null),
      end_time: U.val('wa-end', null),
      week_start: S.weekStart
    };

    var resp = await A.create(data);
    if (resp.ok) {
      H.closeModal();
      showToast('已创建', 'success');
      H.refresh();
    } else {
      showToast('创建失败: ' + resp.err, 'error');
    }
    S._submitting = false;
  },

  // ═══ 编辑计划 ═══
  showEdit: function(id) {
    if (document.querySelector('.fk-weekly-modal')) return;  // 已有弹窗不重复打开
    var p = S.plans.find(function(x) { return x.id === id; });
    if (!p) { showToast('计划不存在', 'error'); return; }
    var modal = R.editModal(p);
    document.body.appendChild(modal);
  },

  submitEdit: async function(id) {
    if (S._submitting) return;
    S._submitting = true;
    var title = U.val('we-title', '').trim();
    if (!title) { showToast('请输入标题', 'error'); return; }

    var p = S.plans.find(function(x) { return x.id === id; });
    var wasSynced = p && p.sync_token && p.sync_token.indexOf('synced_') === 0;

    var dayVal = U.val('we-day', '');
    var data = {
      title: title,
      description: U.val('we-desc', '').trim(),
      category: U.val('we-cat', 'custom'),
      priority: parseInt(U.val('we-pri', '3')) || 3,
      day_of_week: dayVal !== '' ? parseInt(dayVal) : null,
      status: U.val('we-status', 'pending'),
      start_time: U.val('we-start', null),
      end_time: U.val('we-end', null)
    };

    var resp = await A.update(id, data);
    if (resp.ok) {
      H.closeModal();
      showToast('已保存' + (wasSynced ? '（自动同步中...）' : ''), 'success');
      // ⭐ 如果之前已同步到任务池，编辑后自动重新同步
      if (wasSynced) {
        var syncResp = await A.sync([id], S.weekStart);
        if (syncResp.ok) { showToast('已同步更新到任务池', 'success'); }
      }
      H.refresh();
    } else {
      showToast('保存失败: ' + resp.err, 'error');
    }
    S._submitting = false;
  },

  // ═══ 删除计划 ═══
  remove: async function(id) {
    var ok = await showConfirmModal('确认删除此计划？', '删除');
    if (!ok) return;
    var resp = await A.remove([id]);
    if (resp.ok) {
      delete S.selIds[id];
      showToast('已删除', 'success');
      H.refresh();
    } else {
      showToast('删除失败: ' + resp.err, 'error');
    }
  },

  batchDelete: async function() {
    var ids = S.selected();
    if (ids.length === 0) { showToast('请先选择计划', 'warning'); return; }
    var ok = await showConfirmModal('确认删除 ' + ids.length + ' 项计划？', '删除');
    if (!ok) return;
    var resp = await A.remove(ids);
    if (resp.ok) {
      S.clearSel();
      showToast('已删除 ' + ids.length + ' 项', 'success');
      H.refresh();
    } else {
      showToast('删除失败: ' + resp.err, 'error');
    }
  },

  // ═══ 切换完成状态 ═══
  toggleDone: async function(id) {
    var p = S.plans.find(function(x) { return x.id === id; });
    if (!p) return;
    var wasSynced = p.sync_token && p.sync_token.indexOf('synced_') === 0;
    var newStatus = p.status === 'completed' ? 'pending' : 'completed';
    var resp = await A.update(id, { status: newStatus });
    if (resp.ok) {
      showToast(newStatus === 'completed' ? '已完成' : '已撤销', 'success');
      if (wasSynced) {
        var syncResp = await A.sync([id], S.weekStart);
        if (!syncResp.ok) showToast('状态已更新，但同步到任务池失败: ' + (syncResp.err || '未知错误'), 'warning');
      }
      H.refresh();
    } else {
      showToast('操作失败: ' + resp.err, 'error');
    }
  },

  // ═══ 模板操作 ═══
  initTemplates: async function() {
    var resp = await A.initTemplates();
    if (resp.ok) {
      showToast('已导入 ' + resp.data.count + ' 条模板到各日期列（周一~周五）', 'success');
      api.clearCache('/api/weekly-plans');
      H.refresh();
    } else {
      showToast('失败: ' + resp.err, 'error');
    }
  },

  skipGuide: function() {
    S.skipGuide = true;
    S.plans = [];
    H.refresh();
  },

  // ═══ 拖拽 ═══
  dragStart: function(e, id) {
    if (!id) return;
    e.dataTransfer.setData('text/plain', String(id));
    e.dataTransfer.effectAllowed = 'move';
  },

  handleDrop: async function(e, dayIdx) {
    e.preventDefault();
    var el = e.currentTarget;
    if (el) el.classList.remove('ring-2', 'ring-amber-300');

    var raw = e.dataTransfer.getData('text/plain');
    var id = parseInt(raw);
    if (!id || isNaN(id)) return;

    var p = S.plans.find(function(x) { return x.id === id; });
    if (!p) return;
    if (p.day_of_week === dayIdx) return;  // 已经在这一天，不操作

    // ⭐ 关键区分：从池中拖出（day_of_week=null）→ 创建副本，保留原卡片
    //              从某天拖到另一天 → 直接移动
    var resp;
    if (p.day_of_week === null) {
      // 从整周任务池拖出：创建一份带日期的副本，原卡片留在池中
      resp = await A.create({
        title: p.title,
        description: p.description || '',
        category: p.category || 'custom',
        priority: p.priority || 3,
        color: p.color || '#6366F1',
        start_time: p.start_time || null,
        end_time: p.end_time || null,
        day_of_week: dayIdx,
        week_start: S.weekStart
      });
    } else {
      // 从一天拖到另一天：移动
      resp = await A.update(id, { day_of_week: dayIdx });
    }

    if (resp.ok) {
      showToast(p.day_of_week === null ? '已复制到 ' + W.WEEKDAY[dayIdx] : '已移到 ' + W.WEEKDAY[dayIdx], 'success');
      H.refresh();
    } else {
      showToast('操作失败: ' + resp.err, 'error');
    }
  },

  // ═══ 同步 ═══
  syncOne: async function(id) {
    var ok = await showConfirmModal('同步到任务池？系统会自动去重。', '同步');
    if (!ok) return;
    var resp = await A.sync([id], S.weekStart);
    if (resp.ok) {
      var msg = resp.data && resp.data.message ? resp.data.message : '已同步';
      showToast(msg, 'success');
      H.refresh();
    } else {
      showToast('同步失败: ' + resp.err, 'error');
    }
  },

  batchSync: async function() {
    var ids = S.selected();
    if (ids.length === 0) { showToast('请先选择计划', 'warning'); return; }
    var ok = await showConfirmModal('同步 ' + ids.length + ' 项到任务池？', '同步');
    if (!ok) return;
    var resp = await A.sync(ids, S.weekStart);
    if (resp.ok) {
      S.clearSel();
      var msg = resp.data && resp.data.message ? resp.data.message : '已同步';
      showToast(msg, 'success');
      H.refresh();
    } else {
      showToast('同步失败: ' + resp.err, 'error');
    }
  },

  syncAll: async function() {
    H.closeModal();
    // ⭐ 筛选未同步的计划
    var unsynced = S.plans.filter(function(p) {
      return !(p.sync_token && p.sync_token.indexOf('synced_') === 0);
    });
    if (unsynced.length === 0) {
      showToast('所有计划已同步，无需重复操作', 'info');
      return;
    }
    var ok = await showConfirmModal('同步本周 ' + unsynced.length + ' 项未同步计划到任务池？', '同步');
    if (!ok) return;
    // 传入未同步计划的 ID 列表
    var resp = await A.sync(unsynced.map(function(p) { return p.id; }), S.weekStart);
    if (resp.ok) {
      // 显示详细同步结果
      var msg = resp.data && resp.data.message ? resp.data.message : '已同步';
      showToast(msg, 'success');
      H.refresh();
    } else {
      showToast('同步失败: ' + resp.err, 'error');
    }
  },

  // ═══ 清空 ═══
  clearWeek: async function() {
    H.closeModal();
    var ok = await showConfirmModal('确认清空本周所有计划？此操作不可恢复。', '清空');
    if (!ok) return;
    var resp = await A.clear();
    if (resp.ok) {
      showToast('已清空', 'success');
      api.clearCache('/api/weekly-plans');
      H.refresh();
    } else {
      showToast('清空失败: ' + resp.err, 'error');
    }
  },

  // ═══ 弹窗管理 ═══
  showMenu: function() {
    var modal = R.menu();
    document.body.appendChild(modal);
  },

  closeModal: function() {
    // 仅关闭周视图弹窗
    var modals = document.querySelectorAll('div.fixed.inset-0.z-50.fk-weekly-modal');
    for (var i = 0; i < modals.length; i++) {
      if (modals[i].parentNode) modals[i].remove();
    }
  },

  // ═══ 模板编辑器 ═══
  showTemplateEditor: async function() {
    var resp = await A.getTemplates();
    var templates = (resp.ok && resp.data && resp.data.templates) ? resp.data.templates : [];

    var modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 fk-weekly-modal';
    modal.onclick = function(e) { if (e.target === modal) { H.closeModal(); } };

    var html = '<div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-5 shadow-xl" onclick="event.stopPropagation()">';
    html += '<div class="flex items-center justify-between mb-4"><h3 class="font-bold text-gray-800 dark:text-white"><i class="fas fa-pen text-purple-500 mr-2"></i>编辑模板</h3><button onclick="this.closest(\'.fixed\').remove()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button></div>';
    html += '<p class="text-xs text-gray-400 mb-4">自定义每日模板，保存后点击"使用自定义模板"应用到本周</p>';

    // 模板列表
    if (templates.length === 0) {
      html += '<div class="text-center py-6 text-gray-400"><i class="fas fa-file text-2xl mb-2"></i><p class="text-xs">还没有自定义模板</p></div>';
    } else {
      html += '<div class="space-y-2 mb-4">';
      for (var i = 0; i < templates.length; i++) {
        var t = templates[i];
        var dayLabel = t.day_of_week != null ? ['周日','周一','周二','周三','周四','周五','周六'][t.day_of_week] : '全部';
        html += '<div class="flex items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">' +
          '<div class="flex-1 min-w-0"><p class="text-sm font-medium text-gray-800 dark:text-white truncate">' + escapeHtml(t.title) + '</p>' +
          '<p class="text-xs text-gray-400">' + dayLabel + ' · ' + (t.start_time ? t.start_time.slice(0,5) : '') + (t.end_time ? '-' + t.end_time.slice(0,5) : '') + '</p></div>' +
          '<button onclick="H.editTemplateItem(' + t.id + ')" class="px-2 py-1 rounded-lg text-[10px] text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"><i class="fas fa-edit"></i></button>' +
          '<button onclick="H.deleteTemplateItem(' + t.id + ')" class="px-2 py-1 rounded-lg text-[10px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><i class="fas fa-trash"></i></button></div>';
      }
      html += '</div>';
    }

    // 底部按钮
    html += '<div class="flex gap-2">';
    html += '<button onclick="H.addTemplateItem()" class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-purple-500 text-white hover:bg-purple-600 transition-all"><i class="fas fa-plus mr-1"></i>新建模板</button>';
    if (templates.length > 0) {
      html += '<button onclick="H.applyTemplates()" class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600 transition-all"><i class="fas fa-check mr-1"></i>使用自定义模板</button>';
    }
    html += '</div></div>';

    modal.innerHTML = html;
    document.body.appendChild(modal);
  },

  addTemplateItem: function() {
    H.showTemplateForm(null);
  },

  editTemplateItem: function(id) {
    H.showTemplateForm(id);
  },

  deleteTemplateItem: async function(id) {
    var ok = await showConfirmModal('确认删除此模板？', '删除');
    if (!ok) return;
    var resp = await A.deleteTemplate(id);
    if (resp.ok) { showToast('已删除', 'success'); H.showTemplateEditor(); }
    else showToast('删除失败', 'error');
  },

  showTemplateForm: async function(editId) {
    var data = {};
    if (editId) {
      var resp = await A.getTemplates();
      if (resp.ok && resp.data) {
        var found = (resp.data.templates || []).find(function(t) { return t.id === editId; });
        if (found) data = found;
      }
    }
    var dayOptions = ['周日','周一','周二','周三','周四','周五','周六'];
    var daySel = '<select id="te-day" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xs">';
    daySel += '<option value="">全部</option>';
    for (var di = 0; di < 7; di++) {
      daySel += '<option value="' + di + '"' + (data.day_of_week === di ? ' selected' : '') + '>' + dayOptions[di] + '</option>';
    }
    daySel += '</select>';

    var modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 fk-weekly-modal';
    modal.onclick = function(e) { if (e.target === modal) { H.closeModal(); } };
    modal.innerHTML = '<div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-5 shadow-xl" onclick="event.stopPropagation()">' +
      '<h3 class="font-bold text-gray-800 dark:text-white mb-4">' + (editId ? '编辑' : '新建') + '模板</h3>' +
      '<div class="space-y-3">' +
      '<div><label class="text-xs text-gray-500 block mb-1">标题</label><input id="te-title" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm" value="' + escapeHtml(data.title||'') + '"></div>' +
      '<div><label class="text-xs text-gray-500 block mb-1">星期</label>' + daySel + '</div>' +
      '<div class="grid grid-cols-2 gap-2"><div><label class="text-xs text-gray-500 block mb-1">开始时间</label><input id="te-start" type="time" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm" value="' + (data.start_time||'') + '"></div>' +
      '<div><label class="text-xs text-gray-500 block mb-1">结束时间</label><input id="te-end" type="time" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm" value="' + (data.end_time||'') + '"></div></div>' +
      '<div><label class="text-xs text-gray-500 block mb-1">描述（可选）</label><input id="te-desc" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm" value="' + escapeHtml(data.description||'') + '"></div>' +
      '</div>' +
      '<div class="flex gap-2 mt-5"><button onclick="H.saveTemplateItem(' + (editId || 'null') + ')" class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600 transition-all">保存</button>' +
      '<button onclick="this.closest(\'.fixed\').remove()" class="flex-1 py-2.5 rounded-xl text-sm border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700">取消</button></div></div>';
    document.body.appendChild(modal);
  },

  saveTemplateItem: async function(editId) {
    var title = document.getElementById('te-title')?.value?.trim();
    if (!title) { showToast('请输入标题', 'warning'); return; }
    var data = {
      title: title,
      day_of_week: document.getElementById('te-day')?.value || null,
      start_time: document.getElementById('te-start')?.value || null,
      end_time: document.getElementById('te-end')?.value || null,
      description: document.getElementById('te-desc')?.value?.trim() || ''
    };
    if (data.day_of_week === '') data.day_of_week = null;
    var resp = editId ? await A.updateTemplate(editId, data) : await A.createTemplate(data);
    if (resp.ok) { showToast(editId ? '已更新' : '已创建', 'success'); H.showTemplateEditor(); }
    else showToast('保存失败', 'error');
  },

  applyTemplates: async function() {
    H.closeModal();
    var ok = await showConfirmModal('使用自定义模板导入本周计划？（将覆盖现有计划）', '确认');
    if (!ok) return;
    var resp = await A.initCustomTemplates();
    if (resp.ok) { showToast(resp.data.message || '已导入自定义模板', 'success'); H.refresh(); }
    else showToast('导入失败', 'error');
  }
};

// ╔══════════════════════════════════════════════════════════════════╗
// ║  第七部分：全局函数暴露（供HTML onclick调用和路由系统使用）         ║
// ╚══════════════════════════════════════════════════════════════════╝

// 主渲染入口 — 供 app.js 路由系统调用
window.renderWeekly = async function() {
  try {
    var content = await H.render();
    if (!content) return null;
    var main = document.querySelector('#app main');
    if (main) {
      main.innerHTML = '';
      main.appendChild(content);
    }
    return content;
  } catch(e) {
    console.error('[renderWeekly]', e);
    showToast('页面加载失败', 'error');
    return null;
  }
};

// 兼容旧代码的函数别名
window.initWeeklyTemplates    = H.initTemplates;
window.renderWeeklyCustom     = H.skipGuide;
window.shiftWeek              = H.shift;
window.setWeeklyView          = H.setView;
window.togglePlanSelect       = H.toggleSel;
window.clearSelected          = S.clearSel.bind(S);
window.togglePlanStatus       = H.toggleDone;
window.showDeletePlanConfirm  = H.remove;
window.batchDeletePlans       = H.batchDelete;
window.syncPlanToTasks        = H.syncOne;
window.batchSyncToTasks       = H.batchSync;
window.syncAllWeekToTasks     = H.syncAll;
window.showWeeklyActions      = H.showMenu;
window.showAddPlanModal       = H.showAdd;
window.showEditPlanModal      = H.showEdit;
window.dragPlan               = H.dragStart;
window.handlePlanDrop         = H.handleDrop;
window.clearWeeklyPlans       = H.clearWeek;

// 调试用全局暴露
window.WeeklyState   = S;
window.WeeklyHandlers = H;
window.WeeklyRenderer = R;
window.WeeklyAPI      = A;
window.WeeklyUtils    = U;
