// 反宿命论行动计划 - 交互模块 (v3: 折叠 + 可编辑 + 时间修正)
(function() {
  'use strict';

  const STORAGE_KEY = 'fk_state_v3';
  const CLOUD_KEY = 'fate_killer_plan';
  var _cloudLoaded = false;
  var _saveTimer = null;

  function getCurrentWeekIndex() {
    var now = new Date();
    var start = new Date(2026, 5, 28); // June 28
    var diff = Math.floor((now - start) / (24 * 60 * 60 * 1000));
    if (diff < 0) return -1;
    if (diff < 14) return 0;  // 第1-2周
    if (diff < 28) return 1;  // 第3-4周
    if (diff < 42) return 2;  // 第5-6周
    if (diff < 56) return 3;  // 第7-8周
    return -1;
  }

  function getAutoCollapsed() {
    var cur = getCurrentWeekIndex();
    var map = {};
    for (var i = 0; i < 4; i++) map[i] = (i !== cur);
    return map;
  }

  async function cloudLoad() {
    try {
      if (window.networkFirst) {
        var result = await window.networkFirst('fk_' + CLOUD_KEY, async function() {
          var token = localStorage.getItem('token');
          if (!token) throw new Error('no token');
          var base = (window.__DEPLOY_CONFIG__ && window.__DEPLOY_CONFIG__.API_BASE_URL) || 'https://zhouji-api.wo1203656818.workers.dev';
          var res = await fetch(base + '/api/user-data?key=' + encodeURIComponent(CLOUD_KEY), {
            headers: { 'Authorization': 'Bearer ' + token }
          });
          var d = await res.json();
          if (d && d.success && d.data) return JSON.parse(d.data);
          throw new Error('no data');
        });
        var syncEl = document.getElementById('fk-sync-status');
        if (syncEl) { syncEl.innerHTML = '<span style="color:#16a34a">☁️ 已同步</span>'; }
        return result.data;
      }
    } catch(e) {
      var syncEl = document.getElementById('fk-sync-status');
      if (syncEl) { syncEl.innerHTML = '<span style="color:#d97706">📱 离线模式</span>'; }
    }
    // 传统回退
    var token = localStorage.getItem('token');
    if (!token) return null;
    try {
      var base = (window.__DEPLOY_CONFIG__ && window.__DEPLOY_CONFIG__.API_BASE_URL) || 'https://zhouji-api.wo1203656818.workers.dev';
      var res = await fetch(base + '/api/user-data?key=' + encodeURIComponent(CLOUD_KEY), {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      var data = await res.json();
      if (data && data.success && data.data) return JSON.parse(data.data);
    } catch(e) { /* offline */ }
    if (window.cacheGet) {
      var off = await window.cacheGet('fk_' + CLOUD_KEY);
      if (off) return off;
    }
    return null;
  }
  async function cloudSave(d) {
    // 使用 writeThrough: 先存本地，再推云端
    if (window.writeThrough) {
      await window.writeThrough('fk_' + CLOUD_KEY, '/api/user-data', { key: CLOUD_KEY, value: JSON.stringify(d) }, 'POST');
      return;
    }
    // 传统回退
    try {
      var token = localStorage.getItem('token');
      if (!token) return;
      var base = (window.__DEPLOY_CONFIG__ && window.__DEPLOY_CONFIG__.API_BASE_URL) || 'https://zhouji-api.wo1203656818.workers.dev';
      await fetch(base + '/api/user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ key: CLOUD_KEY, value: JSON.stringify(d) })
      });
    } catch(e) {}
  }
  function localLoad() {
    try { var r = localStorage.getItem(STORAGE_KEY); if (r) return JSON.parse(r); } catch(e) {}
    return null;
  }
  function localSave(d) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch(e) {}
  }
  function defStore() {
    return { weekChecklists:{}, weekNotes:{}, collapsed:getAutoCollapsed(), editMode:false, customItems:{}, activeDays:{} };
  }
  function dateKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function getStreak() {
    if (!store.activeDays) return 0;
    var streak = 0;
    var d = new Date();
    while (true) {
      var key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      if (store.activeDays[key]) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        // 如果今天还没记录但今天是第一次打卡，今天也算
        if (streak === 0) break; // 今天没打卡，不计数
        // 跳过昨天（允许今天第一次）
        var yesterday = new Date(d);
        yesterday.setDate(yesterday.getDate() - 1);
        var yKey = yesterday.getFullYear() + '-' + String(yesterday.getMonth()+1).padStart(2,'0') + '-' + String(yesterday.getDate()).padStart(2,'0');
        if (store.activeDays[yKey]) break; // 昨天有打卡，今天无，连续中断
        break;
      }
    }
    return streak;
  }
  async function initStore() {
    var c = await cloudLoad();
    if (c) { _cloudLoaded = true; return c; }
    var l = localLoad();
    if (l) { _cloudLoaded = true; cloudSave(l); return l; }
    return defStore();
  }
  function debounceSave() {
    // 立即存本地（同步），确保刷新不丢
    localSave(store);
    if (_saveTimer) clearTimeout(_saveTimer);
    // 异步存云端（防抖）
    _saveTimer = setTimeout(function() {
      if (_cloudLoaded) cloudSave(store);
    }, 800);
  }
  var store = defStore();

  function icon(n) { return '<i class="fas fa-' + n + '"></i>'; }

  // 全局函数
  window._fkToggle = function(wi, ii) {
    if (!store.weekChecklists[wi]) store.weekChecklists[wi] = {};
    var k = 'c' + ii;
    store.weekChecklists[wi][k] = !store.weekChecklists[wi][k];
    // 记录活跃日（用于连胜打卡）
    if (store.weekChecklists[wi][k]) {
      if (!store.activeDays) store.activeDays = {};
      store.activeDays[dateKey()] = true;
    }
    debounceSave();
    refreshCheckUI(wi, ii);
    updateProgressBars();
  };

  window._fkToggleCollapse = function(wi) {
    store.collapsed[wi] = !store.collapsed[wi];
    debounceSave();
    var body = document.getElementById('fk-week-body-' + wi);
    var arrow = document.getElementById('fk-week-arrow-' + wi);
    if (body) {
      if (store.collapsed[wi]) {
        body.style.maxHeight = '0';
        body.style.opacity = '0';
        body.style.overflow = 'hidden';
        body.style.paddingTop = '0';
        body.style.paddingBottom = '0';
      } else {
        body.style.maxHeight = body.scrollHeight + 80 + 'px';
        body.style.opacity = '1';
        body.style.overflow = 'visible';
        body.style.paddingTop = '';
        body.style.paddingBottom = '';
      }
    }
    if (arrow) {
      arrow.style.transform = store.collapsed[wi] ? 'rotate(-90deg)' : 'rotate(0deg)';
    }
  };

  window._fkToggleEditMode = function() {
    store.editMode = !store.editMode;
    debounceSave();
    var btn = document.getElementById('fk-edit-btn');
    var editableEls = document.querySelectorAll('.fk-editable');
    if (btn) {
      btn.innerHTML = store.editMode ? icon('check-circle') + ' 退出编辑' : icon('pencil') + ' 编辑内容';
      btn.style.background = store.editMode ? '#16a34a' : '';
    }
    editableEls.forEach(function(el) {
      el.contentEditable = store.editMode;
      el.style.cursor = store.editMode ? 'text' : 'pointer';
      el.style.border = store.editMode ? '1px dashed #6366f1' : 'none';
      el.style.borderRadius = store.editMode ? '4px' : '0';
      el.style.padding = store.editMode ? '2px 4px' : '0';
    });
    if (!store.editMode) saveEditableContent();
  };

  function saveEditableContent() {
    document.querySelectorAll('.fk-editable').forEach(function(el) {
      var key = el.getAttribute('data-fk-key');
      if (key) {
        if (!store.customItems) store.customItems = {};
        store.customItems[key] = el.innerText;
        debounceSave();
      }
    });
  }

  function refreshCheckUI(wi, ii) {
    var el = document.getElementById('fk-check-' + wi + '-' + ii);
    if (!el) return;
    var isDark = document.documentElement.classList.contains('dark');
    var cBorder = isDark ? '#4b5563' : '#d1d5db';
    var cGreen = '#16a34a';
    var k = 'c' + ii;
    var checked = store.weekChecklists[wi] && store.weekChecklists[wi][k];
    el.innerHTML = checked
      ? '<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:4px;background:' + cGreen + ';color:#fff;font-size:12px;flex-shrink:0;"><i class="fas fa-check"></i></span>'
      : '<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:4px;border:2px solid ' + cBorder + ';flex-shrink:0;"></span>';
    var txt = document.querySelector('.fk-text-' + wi + '-' + ii);
    if (txt) {
      txt.style.color = checked ? (isDark ? '#6b7280' : '#9ca3af') : (isDark ? '#f1f5f9' : '#0f172a');
      txt.style.textDecoration = checked ? 'line-through' : 'none';
    }
  }

  // 后台同步完成后刷新UI
  function rebuildUI(container) {
    updateProgressBars();
    // 刷新所有勾选框
    var total = 34;
    for (var w = 0; w < 4; w++) {
      for (var i = 0; i < 9; i++) {
        refreshCheckUI(w, i);
      }
    }
  }

  function updateProgressBars() {
    var total = 34;
    var done = 0;
    for (var w in store.weekChecklists) {
      for (var k in store.weekChecklists[w]) {
        if (store.weekChecklists[w][k]) done++;
      }
    }
    var pct = total > 0 ? Math.round(done / total * 100) : 0;
    var bar = document.getElementById('fk-progress-bar');
    var label = document.getElementById('fk-progress-label');
    var countEl = document.getElementById('fk-done-count');
    if (bar) bar.style.width = pct + '%';
    if (label) label.textContent = pct + '%';
    if (countEl) countEl.textContent = done + '/' + total;

    // 更新各周计数
    weeksData.forEach(function(w, wi) {
      var wDone = 0;
      w.items.forEach(function(it, ii) {
        var key = 'c' + ii;
        if (store.weekChecklists[wi] && store.weekChecklists[wi][key]) wDone++;
      });
      var counter = document.getElementById('fk-week-counter-' + wi);
      if (counter) counter.textContent = wDone + '/' + w.items.length;
    });
  }

  // ====== 周数据 ======
  var weeksData = [
    {
      label: '第1-2周 · 打基础，从0开始',
      badge: '6月28日-7月11日',
      color: '#0d9488',
      items: [
        '抖音/视频号/B站/小红书开通账号，统一头像简介',
        'X开通账号，bio写中文版（如"送外卖创业路上"）',
        '学视频剪辑（剪映基础：裁剪/字幕/配乐）',
        '学X运营：刷50个同类账号，总结内容规律',
        '拍第一条"反宿命论实验"视频并发全平台',
        'X上发第一篇中文Thread，每天1条坚持7天',
        '跑外卖时每天拍3-5个空镜素材',
        '搭建时间管理模板的内容框架'
      ]
    },
    {
      label: '第3-4周 · 内容引擎启动',
      badge: '7月12日-7月25日',
      color: '#6366f1',
      items: [
        '每天1条30s竖屏+每周1条深度长视频',
        '固定发布节奏：午12点/晚8点各一档',
        'X每天1条中文Thread+2条短帖',
        'X跟帖互动30个同类创作者',
        'X粉丝目标破300',
        '时间管理模板上线（国内¥19.9）',
        '每3天做一次数据复盘',
        '学带货/小黄车基本流程',
        '申请各平台创作激励/中视频计划'
      ]
    },
    {
      label: '第5-6周 · 尝试变现',
      badge: '7月26日-8月8日',
      color: '#d97706',
      items: [
        '创作激励开始产生收入（目标¥800-1500）',
        '模板持续销售（目标¥1000-2000）',
        '带货佣金启动（目标¥500-1000）',
        'X粉丝破500，开通中文创作者激励',
        'X建置顶帖挂产品链接',
        '国内建免费微信群引流',
        '收入目标：国内¥3,000+ / X¥1,000+',
        '学习数据复盘优化内容方向'
      ]
    },
    {
      label: '第7-8周 · 全力冲收入',
      badge: '8月9日-8月27日',
      color: '#ea580c',
      items: [
        '推出"创业入门包"¥49.9（模板+答疑）',
        'X数字产品上架（模板/电子书等）',
        '开启1对1轻咨询 ¥50/次',
        '国内爆款→剪成X版互推',
        'X截图评论→发国内做跨平台引流',
        '朋友圈/微信群主动推广',
        '第60天发盘点打脸视频',
        '冲刺月收入¥10,000'
      ]
    }
  ];

  // ====== 响应式样式 ======
  if (!document.getElementById('fk-responsive')) {
    var rs = document.createElement('style');
    rs.id = 'fk-responsive';
    rs.textContent = [
      '@media (max-width:640px){',
      '#fk-container .fk-grid-4{grid-template-columns:repeat(2,1fr)!important}',
      '#fk-container .fk-grid-3{grid-template-columns:1fr!important}',
      '#fk-container .fk-schedule-time{width:70px!important;font-size:12px!important}',
      '#fk-container{padding:12px 10px 80px!important}',
      '#fk-container h1{font-size:20px!important}',
      '#fk-container .fk-stat-box{padding:10px!important}',
      '#fk-container .fk-stat-box .fk-stat-num{font-size:16px!important}',
      '}',
      '@media (min-width:641px) and (max-width:1024px){',
      '#fk-container .fk-grid-4{grid-template-columns:repeat(4,1fr)!important}',
      '#fk-container .fk-grid-3{grid-template-columns:repeat(3,1fr)!important}',
      '}'
    ].join('\n');
    document.head.appendChild(rs);
  }

  // ====== 渲染 ======
  window.renderFateKiller = async function() {
    // 先用本地数据渲染（瞬间），不等云端
    if (!_cloudLoaded) {
      var local = localLoad();
      if (local) {
        _cloudLoaded = true;
        store = local;
        // 后台同步云端，不阻塞渲染
        cloudLoad().then(function(cloud) {
          if (cloud) {
            var old = JSON.stringify(store);
            store = cloud;
            localSave(store);
            // 云端数据跟本地不同时才重绘
            if (old !== JSON.stringify(cloud)) {
              var container = document.getElementById('fk-container');
              if (container) rebuildUI(container);
            }
          }
        });
      } else {
        // 完全没有本地数据，等云端
        var d = await cloudLoad();
        if (d) { _cloudLoaded = true; store = d; localSave(store); }
      }
    }
    var isDark = document.documentElement.classList.contains('dark');
    var c = {
      bg: isDark ? '#0f172a' : '#f8fafc',
      card: isDark ? '#1e293b' : '#ffffff',
      border: isDark ? '#334155' : '#e2e8f0',
      text: isDark ? '#f1f5f9' : '#0f172a',
      muted: isDark ? '#94a3b8' : '#64748b',
      accent: '#6366f1',
      green: '#16a34a',
      amber: '#d97706',
      coral: '#ea580c',
      teal: '#0d9488'
    };

    var h = '<div id="fk-container" style="max-width:800px;margin:0 auto;padding:16px 20px 80px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,\'PingFang SC\',\'Microsoft YaHei\',sans-serif;">';

    // ====== 顶部 ======
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">';
    h += '<div><h1 style="font-size:24px;font-weight:700;color:' + c.text + ';margin:0;letter-spacing:-0.3px;">' + icon('bolt') + ' 反宿命论计划</h1>';
    h += '<p style="font-size:13px;color:' + c.muted + ';margin:2px 0 0;">从0开始 · 8月底目标月入1万 · 用行动打破2028预言</p>';
    h += '<span id="fk-sync-status" style="font-size:11px;color:' + c.muted + ';margin-top:2px;">⏳ 同步中...</span></div>';
    // 倒计时到第60天（8月27日）
    var end = new Date(2026, 7, 27);
    var now = new Date();
    var daysLeft = Math.max(0, Math.ceil((end - now) / (24*60*60*1000)));
    h += '<div style="display:flex;align-items:center;gap:6px;font-size:13px;color:' + (daysLeft <= 7 ? c.coral : c.text) + ';font-weight:500;">' + icon('stopwatch') + ' 距打脸视频还有 ' + daysLeft + ' 天</div>';
    // 连胜打卡
    var streak = getStreak();
    if (streak > 0) {
      h += '<div style="display:flex;align-items:center;gap:4px;font-size:13px;color:' + c.green + ';font-weight:500;margin-top:4px;">' + icon('fire') + ' 已连续打卡 ' + streak + ' 天</div>';
    }
    h += '<button id="fk-edit-btn" onclick="window._fkToggleEditMode()" style="padding:6px 14px;background:' + (store.editMode ? '#16a34a' : c.card) + ';color:' + (store.editMode ? '#fff' : c.text) + ';border:1px solid ' + c.border + ';border-radius:6px;font-size:13px;cursor:pointer;white-space:nowrap;">' + icon('pencil') + ' 编辑内容</button>';
    h += '</div>';

    // ====== 策略卡片 ======
    h += '<div class="fk-grid-3" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">';
    h += strategyCard(c.teal, 'fa-video', '国内多平台', '抖音/视频号/B站/小红书');
    h += strategyCard(c.accent, 'fa-hashtag', 'X自媒体(中文)', '"外卖创业逆袭实录"系列');
    h += strategyCard(c.amber, 'fa-graduation-cap', '边干边学', '剪辑/运营/技能跟上');
    h += '</div>';

    // ====== 统计 + 进度 ======
    var total = 34, done = 0;
    for (var w in store.weekChecklists) {
      for (var k in store.weekChecklists[w]) {
        if (store.weekChecklists[w][k]) done++;
      }
    }
    var pct = Math.round(done / total * 100);

    h += '<div class="fk-grid-4" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">';
    h += statBox('已完成', '<span id="fk-done-count">' + done + '/' + total + '</span>', c.accent);
    h += statBox('当前阶段', getCurrentWeekLabel(), c.teal);
    h += statBox('国内目标', '¥7,000/月', c.amber);
    h += statBox('X海外目标', '¥3,000/月', c.coral);
    h += '</div>';

    h += '<div style="margin-bottom:20px;">';
    h += '<div style="display:flex;justify-content:space-between;font-size:12px;color:' + c.muted + ';margin-bottom:4px;">';
    h += '<span>总体进度</span><span id="fk-progress-label">' + pct + '%</span></div>';
    h += '<div style="height:6px;background:' + c.border + ';border-radius:99px;overflow:hidden;">';
    h += '<div id="fk-progress-bar" style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,' + c.accent + ',' + c.teal + ');border-radius:99px;transition:width 0.4s;"></div></div>';
    h += '</div>';

    // ====== 每日时间表（修正版） ======
    h += sectionTitle('每日时间表', 'clock', c);
    h += '<div style="background:' + c.card + ';border:1px solid ' + c.border + ';border-radius:12px;overflow:hidden;margin-bottom:20px;">';
    var sched = [
      ['6:00-6:40', icon('sun') + ' 晨跑', c.green],
      ['6:40-7:00', '洗漱/早餐', c.muted],
      ['7:00-8:00', icon('graduation-cap') + ' 学习时间：剪辑/运营', c.accent],
      ['8:00-9:00', icon('video') + ' 拍+剪国内30s竖屏', c.teal],
      ['9:00-12:00', icon('clock') + ' 零碎时间：分发/运营/学X', c.amber],
      ['12:00-13:00', '午饭 + 写X Thread（中文）', c.muted],
      ['13:00-17:00', icon('mug-hot') + ' 自由/学习/准备出门', c.coral],
      ['17:00-23:00', icon('motorcycle') + ' 跑外卖（路上拍素材）', c.coral],
      ['23:00-24:00', icon('clipboard-list') + ' 复盘/洗澡/明日计划', c.muted],
    ];
    sched.forEach(function(r) {
      h += '<div style="display:flex;align-items:center;padding:7px 16px;border-bottom:1px solid ' + c.border + ';font-size:13px;">';
      h += '<span class="fk-schedule-time" style="width:85px;flex-shrink:0;font-weight:500;color:' + r[2] + ';">' + r[0] + '</span>';
      h += '<span style="color:' + c.text + ';">' + r[1] + '</span></div>';
    });
    h += '<div style="padding:7px 16px;font-size:12px;color:' + c.muted + ';background:' + (isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc') + ';">' + icon('info-circle') + ' 送外卖时间已调整为17:00-23:00，白天有6小时富余做内容+学习</div>';
    h += '</div>';

    // ====== 8周折叠清单 ======
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">';
    h += '<h2 style="font-size:16px;font-weight:600;color:' + c.text + ';display:flex;align-items:center;gap:6px;margin:0;">' + icon('list-check') + ' 8周行动清单（点击标题展开/折叠）</h2>';
    h += '</div>';

    // 按时间自动展开当前周
    var autoCollapsed = getAutoCollapsed();

    weeksData.forEach(function(week, wi) {
      // 优先用用户手动状态，没有则用自动折叠逻辑
      var isCollapsed = store.collapsed.hasOwnProperty(wi) ? store.collapsed[wi] : autoCollapsed[wi];
      var wDone = 0;
      week.items.forEach(function(it, ii) {
        if (store.weekChecklists[wi] && store.weekChecklists[wi]['c' + ii]) wDone++;
      });

      h += '<div style="background:' + c.card + ';border:1px solid ' + c.border + ';border-radius:12px;margin-bottom:12px;overflow:hidden;">';

      // 头部（可点击折叠）
      h += '<div onclick="window._fkToggleCollapse(' + wi + ')" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:' + (isCollapsed ? 'none' : '1px solid ' + c.border) + ';background:' + (isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc') + ';cursor:pointer;user-select:none;">';
      h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">';
      h += '<span style="display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:600;color:#fff;background:' + week.color + ';">' + week.badge + '</span>';
      h += '<span style="font-weight:600;font-size:14px;color:' + c.text + ';">' + week.label + '</span>';
      h += '</div>';
      h += '<div style="display:flex;align-items:center;gap:8px;">';
      h += '<span style="font-size:12px;color:' + c.muted + ';" id="fk-week-counter-' + wi + '">' + wDone + '/' + week.items.length + '</span>';
      h += '<span id="fk-week-arrow-' + wi + '" style="transition:transform 0.25s;transform:' + (isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)') + ';color:' + c.muted + ';font-size:14px;">' + icon('chevron-down') + '</span>';
      h += '</div></div>';

      // 主体（可折叠）
      h += '<div id="fk-week-body-' + wi + '" style="transition:all 0.3s ease;overflow:hidden;max-height:' + (isCollapsed ? '0' : '2000px') + ';opacity:' + (isCollapsed ? '0' : '1') + ';padding:' + (isCollapsed ? '0 16px' : '8px 16px 12px') + ';">';
      week.items.forEach(function(item, ii) {
        var key = 'c' + ii;
        var checked = store.weekChecklists[wi] && store.weekChecklists[wi][key];
        var itemKey = 'w' + wi + '-i' + ii;
        var customText = store.customItems && store.customItems[itemKey];
        var displayText = customText || item;
        h += '<div style="display:flex;align-items:flex-start;gap:10px;padding:6px 0;cursor:pointer;" onclick="window._fkToggle(' + wi + ',' + ii + ')">';
        h += '<span id="fk-check-' + wi + '-' + ii + '" style="margin-top:2px;flex-shrink:0;">';
        h += checked
          ? '<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:4px;background:' + c.green + ';color:#fff;font-size:12px;flex-shrink:0;"><i class="fas fa-check"></i></span>'
          : '<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:4px;border:2px solid ' + c.border + ';flex-shrink:0;"></span>';
        h += '</span>';
        h += '<span class="fk-editable fk-text-' + wi + '-' + ii + '" data-fk-key="' + itemKey + '" style="font-size:13px;color:' + (checked ? c.muted : c.text) + ';text-decoration:' + (checked ? 'line-through' : 'none') + ';' + (store.editMode ? 'border:1px dashed ' + c.accent + ';border-radius:4px;padding:2px 4px;cursor:text;' : '') + '">' + displayText + '</span>';
        h += '</div>';
      });
      h += '</div></div>';
    });

    // ====== 收入拆解 ======
    h += sectionTitle('收入目标拆解', 'chart-line', c);
    h += '<div style="background:' + c.card + ';border:1px solid ' + c.border + ';border-radius:12px;padding:16px;margin-bottom:20px;">';

    h += '<p style="font-size:13px;font-weight:600;color:' + c.text + ';margin:0 0 8px;">国内渠道 · 目标 ¥7,000</p>';
    var incomes = [
      { label: '创作激励/中视频', amt: '¥2,000', bar: 29, clr: '#3b82f6' },
      { label: '模板/数字产品销售', amt: '¥2,500', bar: 36, clr: '#8b5cf6' },
      { label: '带货佣金', amt: '¥1,500', bar: 21, clr: '#f59e0b' },
      { label: '私域咨询/社群', amt: '¥1,000', bar: 14, clr: '#10b981' },
    ];
    incomes.forEach(function(v) {
      h += '<div style="display:flex;align-items:center;gap:8px;margin:3px 0;font-size:13px;">';
      h += '<span style="width:120px;flex-shrink:0;color:' + c.text + ';">' + v.label + '</span>';
      h += '<div style="flex:1;height:14px;background:' + c.border + ';border-radius:4px;overflow:hidden;">';
      h += '<div style="height:100%;width:' + v.bar + '%;background:' + v.clr + ';border-radius:4px;"></div></div>';
      h += '<span style="width:65px;text-align:right;font-weight:500;color:' + c.text + ';">' + v.amt + '</span></div>';
    });

    h += '<p style="font-size:13px;font-weight:600;color:' + c.text + ';margin:12px 0 8px;">X海外（中文）· 目标 ¥3,000</p>';
    var xInc = [
      { label: '创作者激励', amt: '¥1,000', bar: 33, clr: '#3b82f6' },
      { label: '数字产品/模板', amt: '¥1,200', bar: 40, clr: '#8b5cf6' },
      { label: '联盟营销', amt: '¥800', bar: 27, clr: '#f59e0b' },
    ];
    xInc.forEach(function(v) {
      h += '<div style="display:flex;align-items:center;gap:8px;margin:3px 0;font-size:13px;">';
      h += '<span style="width:120px;flex-shrink:0;color:' + c.text + ';">' + v.label + '</span>';
      h += '<div style="flex:1;height:14px;background:' + c.border + ';border-radius:4px;overflow:hidden;">';
      h += '<div style="height:100%;width:' + v.bar + '%;background:' + v.clr + ';border-radius:4px;"></div></div>';
      h += '<span style="width:65px;text-align:right;font-weight:500;color:' + c.text + ';">' + v.amt + '</span></div>';
    });

    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:12px;border-top:2px solid ' + c.accent + ';">';
    h += '<span style="font-weight:600;color:' + c.text + ';">月收入合计</span>';
    h += '<span style="font-weight:700;font-size:18px;color:' + c.accent + ';">¥10,000</span>';
    h += '</div></div>';

    // ====== 本周最优先 ======
    h += sectionTitle('本周最优先', 'rocket', c);
    h += '<div style="background:' + c.card + ';border:1px solid ' + c.border + ';border-radius:12px;padding:16px;margin-bottom:20px;">';
    var tops = [
      '全平台开通账号，统一头像简介',
      '学剪映基础（裁剪/字幕/配乐）',
      '拍第一条反宿命论视频发出去',
      'X开号发第一篇中文内容',
      '跑外卖时每天5分钟拍空镜素材',
    ];
    tops.forEach(function(t, i) {
      h += '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;font-size:13px;color:' + c.text + ';">';
      h += '<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:99px;background:' + c.accent + '20;color:' + c.accent + ';font-weight:600;font-size:12px;flex-shrink:0;">' + (i + 1) + '</span>';
      h += '<span>' + t + '</span></div>';
    });
    h += '</div>';

    h += '</div>'; // container end

    var container = document.createElement('div');
    container.innerHTML = h;

    if (!document.getElementById('fk-style')) {
      var s = document.createElement('style');
      s.id = 'fk-style';
      s.textContent = '@keyframes fkFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}.fk-editable:focus{outline:none;background:rgba(99,102,241,0.08)}';
      document.head.appendChild(s);
    }
    container.style.cssText = 'animation:fkFadeIn 0.3s ease;';
    return container;
  };

  // ====== 工具 ======
  function sectionTitle(txt, ic, c) {
    return '<h2 style="font-size:16px;font-weight:600;color:' + c.text + ';margin:20px 0 10px;display:flex;align-items:center;gap:6px;"><i class="fas fa-' + ic + '" style="color:' + c.accent + ';font-size:14px;"></i>' + txt + '</h2>';
  }

  function statBox(label, val, color) {
    var isDark = document.documentElement.classList.contains('dark');
    return '<div class="fk-stat-box" style="background:' + (isDark ? '#1e293b' : '#fff') + ';border:1px solid ' + (isDark ? '#334155' : '#e2e8f0') + ';border-radius:10px;padding:12px;text-align:center;">' +
      '<div class="fk-stat-num" style="font-size:20px;font-weight:700;color:' + color + ';">' + val + '</div>' +
      '<div style="font-size:11px;color:' + (isDark ? '#94a3b8' : '#64748b') + ';margin-top:4px;">' + label + '</div></div>';
  }

  function strategyCard(clr, ic, title, desc) {
    var isDark = document.documentElement.classList.contains('dark');
    return '<div style="background:' + (isDark ? '#1e293b' : '#fff') + ';border:1px solid ' + (isDark ? '#334155' : '#e2e8f0') + ';border-radius:10px;padding:12px;text-align:center;">' +
      '<div style="font-size:20px;color:' + clr + ';margin-bottom:4px;">' + icon(ic) + '</div>' +
      '<div style="font-weight:600;font-size:13px;color:' + (isDark ? '#f1f5f9' : '#0f172a') + ';margin-bottom:2px;">' + title + '</div>' +
      '<div style="font-size:11px;color:' + (isDark ? '#94a3b8' : '#64748b') + ';line-height:1.4;">' + desc + '</div></div>';
  }

  function getCurrentWeekLabel() {
    var n = new Date();
    var s = new Date(2026, 5, 28);
    var d = Math.floor((n - s) / (7 * 86400000));
    if (d < 0) return '未开始';
    if (d < 2) return '1-2周';
    if (d < 4) return '3-4周';
    if (d < 6) return '5-6周';
    if (d < 8) return '7-8周';
    return '已完成';
  }

})();
