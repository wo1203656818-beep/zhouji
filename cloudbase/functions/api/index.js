// ═══════════════════════════════════════════════════════
// 周迹 - CloudBase HTTP 云函数（无框架，原生实现）
// 环境ID: buyibandewo-d4gyvn0db0f577e93
// ═══════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'zhouji-cb-jwt-2026-secure-key-8x9k2';
const CORS_ORIGIN = '*';

// ═══ CloudBase SDK ═══
const cloudbase = require('@cloudbase/node-sdk');
const app_cb = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app_cb.database();
const _ = db.command;

// ═══ 工具函数 ═══
function sanitize(str, maxLen) {
  if (!str) return '';
  maxLen = maxLen || 500;
  return String(str).replace(/[<>]/g, '').substring(0, maxLen);
}

function jsonResp(code, data) {
  return {
    statusCode: code,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify(data)
  };
}

function ok(data) { return jsonResp(200, data); }
function err(code, msg) { return jsonResp(code, { error: msg }); }

// ═══ 数据库辅助 ═══
const coll = (name) => db.collection(name);

async function findOne(col, where) {
  const r = await coll(col).where(where).limit(1).get();
  return (r.data && r.data.length) ? r.data[0] : null;
}

async function findList(col, where, orderBy, order, limit) {
  const r = await coll(col).where(where || {}).orderBy(orderBy || 'created_at', order || 'desc').limit(limit || 200).get();
  return r.data || [];
}

async function insert(col, data) {
  data.created_at = data.created_at || new Date().toISOString();
  const r = await coll(col).add(data);
  return r.id;
}

async function removeMany(col, where) {
  const r = await coll(col).where(where).get();
  for (const d of r.data) await coll(col).doc(d._id).remove();
  return r.data.length;
}

function hashPwd(pwd, salt) {
  return crypto.createHash('sha256').update(pwd + salt).digest('hex');
}

// ═══ 认证 ═══
function authMiddleware(event) {
  const token = (event.headers.authorization || '').replace('Bearer ', '');
  if (!token) return null;
  try {
    const d = jwt.verify(token, JWT_SECRET);
    return d.userId;
  } catch(e) { return null; }
}

// ═══ 路由映射 ═══
async function route(event) {
  const path = event.path || '';
  const method = event.httpMethod || 'GET';

  // CORS
  if (method === 'OPTIONS') return jsonResp(200, {});

  // 解析 body
  let body = {};
  try {
    body = event.body ? (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) : {};
  } catch(e) {}

  const params = {};
  // 路径参数 (简化实现)
  const userId = authMiddleware(event);

  // ═══ 健康检查 ═══
  if (path === '/api/health') return ok({ success: true });

  // ═══ 注册（无需登录）═══
  if (path === '/api/auth/register' && method === 'POST') {
    var un = sanitize(body.username, 30);
    var pw = body.password || '';
    if (!un || !pw) return err(400, '用户名和密码不能为空');
    var exist = await findOne('users', { username: un });
    if (exist) return err(400, '用户名已存在');
    var salt = crypto.randomBytes(16).toString('hex');
    var ph = hashPwd(pw, salt);
    var uid = await insert('users', { username: un, password: ph, salt });
    var token = jwt.sign({ userId: uid, username: un }, JWT_SECRET, { expiresIn: '7d' });
    return ok({ success: true, token, userId: uid, username: un });
  }

  // ═══ 登录（无需登录）═══
  if (path === '/api/auth/login' && method === 'POST') {
    var user = await findOne('users', { username: body.username });
    if (!user) return err(401, '用户名或密码错误');
    if (hashPwd(body.password || '', user.salt) !== user.password) return err(401, '用户名或密码错误');
    var token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    return ok({ success: true, token, userId: user._id, username: user.username, preferences: user.preferences || {} });
  }

  // ═══ 以下路由需要登录 ═══
  if (!userId) return err(401, '请先登录');

  // ========== 任务 ==========
  if (path === '/api/tasks' && method === 'GET') {
    var where = { user_id: userId };
    if (body.status || event.queryStringParameters?.status) {
      where.status = body.status || event.queryStringParameters?.status;
    }
    var tasks = await findList('tasks', where, 'sort_order', 'asc', 300);
    var search = body.search || event.queryStringParameters?.search;
    if (search) {
      var kw = search.toLowerCase();
      tasks = tasks.filter(t => (t.title||'').toLowerCase().includes(kw) || (t.description||'').toLowerCase().includes(kw));
    }
    return ok({ success: true, tasks });
  }

  if (path === '/api/tasks' && method === 'POST') {
    if (!body.title) return err(400, '标题不能为空');
    var data = {
      user_id: userId,
      title: sanitize(body.title, 200),
      description: sanitize(body.description, 1000),
      category: sanitize(body.category, 50) || 'general',
      difficulty: Math.min(5, Math.max(1, parseInt(body.difficulty) || 3)),
      priority: Math.min(5, Math.max(1, parseInt(body.priority) || 3)),
      due_date: body.due_date || null,
      status: 'pending', is_pinned: 0, sort_order: 0, source: ''
    };
    var tid = await insert('tasks', data);
    // 更新统计
    var today = new Date().toISOString().split('T')[0];
    var stat = await findOne('daily_stats', { user_id: userId, stat_date: today });
    if (stat) await coll('daily_stats').doc(stat._id).update({ tasks_created: _.inc(1) });
    else await insert('daily_stats', { user_id: userId, stat_date: today, tasks_created: 1 });
    return ok({ success: true, taskId: tid });
  }

  // PUT /api/tasks/:id
  if (path.startsWith('/api/tasks/') && !path.includes('/steps') && !path.includes('/reorder') && method === 'PUT') {
    var taskId = path.split('/')[3];
    var task = await findOne('tasks', { _id: taskId, user_id: userId });
    if (!task) return err(404, '任务不存在');
    var upd = {};
    if (body.title !== undefined) upd.title = sanitize(body.title, 200);
    if (body.description !== undefined) upd.description = sanitize(body.description, 1000);
    if (body.status !== undefined) upd.status = body.status;
    if (body.difficulty !== undefined) upd.difficulty = parseInt(body.difficulty);
    if (body.priority !== undefined) upd.priority = parseInt(body.priority);
    if (body.due_date !== undefined) upd.due_date = body.due_date;
    if (body.is_pinned !== undefined) upd.is_pinned = body.is_pinned ? 1 : 0;
    if (body.sort_order !== undefined) upd.sort_order = parseInt(body.sort_order) || 0;
    if (Object.keys(upd).length === 0) return ok({ success: true });
    upd.updated_at = new Date().toISOString();
    await coll('tasks').doc(task._id).update(upd);
    return ok({ success: true });
  }

  // DELETE /api/tasks/:id
  if (path.startsWith('/api/tasks/') && !path.includes('/steps') && !path.includes('/reorder') && method === 'DELETE') {
    var taskId = path.split('/')[3];
    var task = await findOne('tasks', { _id: taskId, user_id: userId });
    if (!task) return err(404, '任务不存在');
    await removeMany('task_steps', { task_id: taskId });
    await removeMany('micro_starts', { task_id: taskId });
    await removeMany('procrastination_logs', { task_id: taskId });
    await removeMany('commitments', { task_id: taskId });
    await coll('tasks').doc(task._id).remove();
    return ok({ success: true });
  }

  // ========== 拖拽重排 ==========
  if (path === '/api/tasks/reorder' && method === 'POST') {
    if (!body.orders || !Array.isArray(body.orders)) return err(400, '参数无效');
    for (var o of body.orders) {
      if (o.id && o.sort_order != null) {
        var t = await findOne('tasks', { _id: o.id, user_id: userId });
        if (t) await coll('tasks').doc(t._id).update({ sort_order: parseInt(o.sort_order) || 0 });
      }
    }
    return ok({ success: true });
  }

  // ========== 任务步骤 ==========
  if (path.startsWith('/api/tasks/') && path.endsWith('/steps') && method === 'GET') {
    var tid = path.split('/')[3];
    var steps = await findList('task_steps', { task_id: tid }, 'created_at', 'asc', 50);
    return ok({ success: true, steps });
  }

  if (path.startsWith('/api/tasks/') && path.endsWith('/steps') && method === 'POST') {
    var tid = path.split('/')[3];
    if (!body.title) return err(400, '步骤标题不能为空');
    var sid = await insert('task_steps', {
      task_id: tid, user_id: userId,
      title: sanitize(body.title, 200),
      planned_duration: parseInt(body.planned_duration) || 2,
      status: 'pending'
    });
    return ok({ success: true, stepId: sid });
  }

  // PUT /api/steps/:id
  if (path.startsWith('/api/steps/') && method === 'PUT') {
    var sid = path.split('/')[3];
    var step = await findOne('task_steps', { _id: sid });
    if (!step) return err(404, '步骤不存在');
    var upd = {};
    if (body.status !== undefined) upd.status = body.status;
    if (body.title !== undefined) upd.title = sanitize(body.title, 200);
    if (body.planned_duration !== undefined) upd.planned_duration = parseInt(body.planned_duration);
    if (Object.keys(upd).length > 0) await coll('task_steps').doc(step._id).update(upd);
    return ok({ success: true });
  }

  // ========== 微启动 ==========
  if (path === '/api/micro-starts' && method === 'POST') {
    var mid = await insert('micro_starts', {
      user_id: userId,
      task_id: body.task_id || null,
      step_id: body.step_id || null,
      planned_duration: parseInt(body.planned_duration) || 2,
      actual_duration: parseInt(body.actual_duration) || 0,
      continued_after_contract: body.continued_after_contract ? 1 : 0,
      status: 'completed'
    });
    if (body.task_id) {
      var task = await findOne('tasks', { _id: body.task_id, user_id: userId });
      if (task && task.status !== 'completed') await coll('tasks').doc(task._id).update({ status: 'in_progress' });
    }
    var today = new Date().toISOString().split('T')[0];
    var stat = await findOne('daily_stats', { user_id: userId, stat_date: today });
    if (stat) await coll('daily_stats').doc(stat._id).update({ micro_starts_count: _.inc(1) });
    else await insert('daily_stats', { user_id: userId, stat_date: today, micro_starts_count: 1 });
    return ok({ success: true, microStartId: mid });
  }

  if (path === '/api/micro-starts' && method === 'GET') {
    var msList = await findList('micro_starts', { user_id: userId }, 'created_at', 'desc', 100);
    for (var i = 0; i < msList.length; i++) {
      var ms = msList[i];
      if (ms.task_id) {
        var t = await findOne('tasks', { _id: ms.task_id });
        ms.task_title = t ? t.title : null;
        ms.task_due_date = t ? t.due_date : null;
      }
      if (ms.step_id) {
        var s = await findOne('task_steps', { _id: ms.step_id });
        ms.step_title = s ? s.title : null;
      }
    }
    return ok({ success: true, microStarts: msList });
  }

  // ========== 情绪 ==========
  if (path === '/api/emotions' && method === 'POST') {
    if (!body.emotion_type) return err(400, '请选择情绪');
    var eid = await insert('emotions', {
      user_id: userId,
      emotion_type: sanitize(body.emotion_type, 20),
      energy_level: parseInt(body.energy_level) || 3,
      trigger_task: sanitize(body.trigger_task, 200),
      cbt_response: sanitize(body.cbt_response, 2000)
    });
    return ok({ success: true, emotionId: eid });
  }

  if (path === '/api/emotions' && method === 'GET') {
    var ems = await findList('emotions', { user_id: userId }, 'created_at', 'desc', 50);
    return ok({ success: true, emotions: ems });
  }

  // ========== 番茄钟 ==========
  if (path === '/api/pomodoro' && method === 'POST') {
    var pid = await insert('pomodoro_sessions', {
      user_id: userId,
      task_id: body.task_id || null,
      step_id: body.step_id || null,
      duration: parseInt(body.duration) || 25,
      completed: body.completed ? 1 : 0
    });
    var today = new Date().toISOString().split('T')[0];
    var stat = await findOne('daily_stats', { user_id: userId, stat_date: today });
    if (stat) await coll('daily_stats').doc(stat._id).update({ pomodoro_count: _.inc(1) });
    return ok({ success: true, sessionId: pid });
  }

  if (path === '/api/pomodoro' && method === 'GET') {
    var sessions = await findList('pomodoro_sessions', { user_id: userId }, 'created_at', 'desc', 100);
    for (var i = 0; i < sessions.length; i++) {
      if (sessions[i].task_id) {
        var t = await findOne('tasks', { _id: sessions[i].task_id });
        sessions[i].task_title = t ? t.title : null;
        sessions[i].task_due_date = t ? t.due_date : null;
      }
    }
    return ok({ success: true, sessions });
  }

  // ========== 拖延日志 ==========
  if (path === '/api/procrastination-logs' && method === 'POST') {
    var lid = await insert('procrastination_logs', {
      user_id: userId, task_id: body.task_id || null,
      reason: sanitize(body.reason, 200),
      distraction_type: sanitize(body.distraction_type, 50),
      duration_wasted: parseInt(body.duration_wasted) || 0
    });
    var today = new Date().toISOString().split('T')[0];
    var stat = await findOne('daily_stats', { user_id: userId, stat_date: today });
    if (stat) await coll('daily_stats').doc(stat._id).update({ procrastination_count: _.inc(1) });
    return ok({ success: true, logId: lid });
  }

  // ========== 日记 ==========
  if (path === '/api/diary' && method === 'POST') {
    var did = await insert('diary_entries', {
      user_id: userId,
      title: sanitize(body.title, 200) || '无标题',
      content: sanitize(body.content, 5000),
      mood: sanitize(body.mood, 20) || 'neutral',
      template_type: sanitize(body.template_type, 20) || 'free',
      is_private: body.is_private !== false ? 1 : 0,
      cbt_thought: sanitize(body.cbt_thought, 2000),
      cbt_reframe: sanitize(body.cbt_reframe, 2000)
    });
    return ok({ success: true, entryId: did });
  }

  if (path === '/api/diary' && method === 'GET') {
    var entries = await findList('diary_entries', { user_id: userId }, 'created_at', 'desc', 50);
    return ok({ success: true, entries });
  }

  // ========== 承诺 ==========
  if (path === '/api/commitments' && method === 'POST') {
    if (!body.content) return err(400, '承诺内容不能为空');
    var cid = await insert('commitments', {
      user_id: userId, task_id: body.task_id || null,
      content: sanitize(body.content, 500),
      deadline: body.deadline || null,
      witness_name: sanitize(body.witness_name, 50),
      status: 'active'
    });
    return ok({ success: true, commitmentId: cid });
  }

  if (path === '/api/commitments' && method === 'GET') {
    var cmts = await findList('commitments', { user_id: userId }, 'created_at', 'desc', 50);
    return ok({ success: true, commitments: cmts });
  }

  // ========== 时间块 ==========
  if (path === '/api/time-blocks' && method === 'POST') {
    var bid = await insert('time_blocks', {
      user_id: userId, task_id: body.task_id || null,
      block_date: body.block_date || new Date().toISOString().split('T')[0],
      start_time: body.start_time || '09:00',
      end_time: body.end_time || '10:00',
      block_type: sanitize(body.block_type, 20) || 'work',
      energy_level: parseInt(body.energy_level) || 3
    });
    return ok({ success: true, blockId: bid });
  }

  if (path === '/api/time-blocks' && method === 'GET') {
    var where = { user_id: userId };
    var dt = body.date || event.queryStringParameters?.date;
    if (dt) where.block_date = dt;
    var blocks = await findList('time_blocks', where, 'start_time', 'asc', 200);
    return ok({ success: true, blocks });
  }

  // ========== 网易云音乐 ==========
  if (path === '/api/music/search') {
    var kw = body.keyword || event.queryStringParameters?.keyword || '';
    if (!kw) return err(400, '请输入关键词');
    try {
      var resp = await fetch(`https://music.163.com/api/search/get?s=${encodeURIComponent(kw)}&type=1&limit=20&offset=0`, {
        headers: { 'Referer': 'https://music.163.com/', 'User-Agent': 'Mozilla/5.0' }
      });
      var d = await resp.json();
      var songs = (d.result?.songs || []).map(function(s) {
        return {
          id: s.id, name: s.name,
          artists: (s.artists || []).map(function(a) { return a.name; }).join(' / '),
          album: s.album?.name || '', duration: s.duration || 0,
          embedUrl: 'https://music.163.com/outchain/player?type=2&id=' + s.id + '&auto=0&height=66'
        };
      });
      return ok({ success: true, songs, total: d.result?.songCount || 0 });
    } catch(e) { return err(500, e.message); }
  }

  // ========== 用户信息 ==========
  if (path === '/api/user' && method === 'GET') {
    var user = await findOne('users', { _id: userId });
    if (!user) return err(404, '用户不存在');
    return ok({ success: true, user: { id: user._id, username: user.username, preferences: user.preferences || {} } });
  }

  // ========== 用户偏好 ==========
  if (path === '/api/user/preferences' && method === 'POST') {
    var user = await findOne('users', { _id: userId });
    if (!user) return err(404, '用户不存在');
    var prefs = Object.assign({}, user.preferences || {}, body);
    await coll('users').doc(user._id).update({ preferences: prefs });
    return ok({ success: true });
  }

  // ========== 百度网盘状态（简化返回）==========
  if (path === '/api/cloud-drive/baidu/config-status') {
    return ok({ success: true, hasGlobalConfig: false, hasUserConfig: false });
  }

  // 404
  return err(404, 'Not Found: ' + path);
}

// ═══ 主入口 ═══
exports.main = async (event, context) => {
  try {
    return await route(event);
  } catch(e) {
    return jsonResp(500, { error: e.message });
  }
};
