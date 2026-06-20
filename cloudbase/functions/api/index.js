// ═══════════════════════════════════════════════════════
// 周迹 - CloudBase 云函数 API（免费版部署方案）
// 部署：cloudbase functions:deploy api
// ═══════════════════════════════════════════════════════

const express = require('express');
const jwt = require('jsonwebtoken');

// ═══ 配置 ═══
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-to-random-32-chars';
const JWT_EXPIRES = '7d';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://your-frontend.pages.dev';

// ═══ 初始化 CloudBase ═══
// CloudBase Cloud Function 环境自带 cloudbase 对象
const cloudbase = require('@cloudbase/node-sdk');
const app_cb = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app_cb.database();
const _ = db.command;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ═══ 工具函数 ═══
function sanitize(str, maxLen = 500) {
  if (!str) return '';
  str = String(str).replace(/[<>]/g, '').substring(0, maxLen);
  return str;
}

function jsonOk(data, status = 200) {
  return res => res.status(status).json(data);
}

// ═══ 认证中间件 ═══
async function authMw(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '请先登录' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch(e) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

// 可选认证（仪表盘config-status）
function optionalAuth(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.userId;
    }
  } catch(e) {}
  next();
}

// ═══ 数据库辅助 ═══
const coll = (name) => db.collection(name);

// 取单条
async function findOne(collection, where) {
  const r = await coll(collection).where(where).limit(1).get();
  return (r.data && r.data.length) ? r.data[0] : null;
}

// 取列表
async function findList(collection, where, orderBy = 'created_at', order = 'desc', limit = 100) {
  const r = await coll(collection).where(where || {}).orderBy(orderBy, order).limit(limit).get();
  return r.data || [];
}

// 插入
async function insert(collection, data) {
  data.created_at = data.created_at || new Date().toISOString();
  const r = await coll(collection).add(data);
  return r.id;
}

// 更新
async function updateOne(collection, where, data) {
  data.updated_at = new Date().toISOString();
  // CloudBase where更新需先查后改
  const r = await coll(collection).where(where).limit(1).get();
  if (!r.data.length) return 0;
  await coll(collection).doc(r.data[0]._id).update(data);
  return 1;
}

// 删除
async function removeOne(collection, where) {
  const r = await coll(collection).where(where).limit(1).get();
  if (!r.data.length) return 0;
  await coll(collection).doc(r.data[0]._id).remove();
  return 1;
}

async function removeMany(collection, where) {
  const r = await coll(collection).where(where).get();
  for (const doc of r.data) {
    await coll(collection).doc(doc._id).remove();
  }
  return r.data.length;
}

// 聚合查询 - count
async function countDocs(collection, where) {
  const r = await coll(collection).where(where || {}).count();
  return r.total || 0;
}

// ========== 健康检查 ==========
app.get('/api/health', (req, res) => res.json({ success: true }));

// ========== 用户认证 ==========
const crypto = require('crypto');
function hashPwd(pwd, salt) {
  return crypto.createHash('sha256').update(pwd + salt).digest('hex');
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password || username.length > 30) return res.status(400).json({ error: '用户名和密码不能为空' });
    const exist = await findOne('users', { username });
    if (exist) return res.status(400).json({ error: '用户名已存在' });
    const salt = crypto.randomBytes(16).toString('hex');
    const passHash = hashPwd(password, salt);
    const uid = await insert('users', { username, password: passHash, salt, created_at: new Date().toISOString() });
    const token = jwt.sign({ userId: uid, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({ success: true, token, userId: uid, username });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await findOne('users', { username });
    if (!user) return res.status(401).json({ error: '用户名或密码错误' });
    if (hashPwd(password, user.salt) !== user.password) return res.status(401).json({ error: '用户名或密码错误' });
    const token = jwt.sign({ userId: user._id, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({ success: true, token, userId: user._id, username, preferences: user.preferences || {} });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ========== 任务管理 ==========
app.get('/api/tasks', authMw, async (req, res) => {
  try {
    const { status, search } = req.query;
    let where = { user_id: req.userId };
    if (status) where.status = status;
    const tasks = await findList('tasks', where, 'sort_order', 'asc', 200);
    // 搜索过滤
    let result = tasks;
    if (search) {
      const kw = search.toLowerCase();
      result = tasks.filter(t => (t.title||'').toLowerCase().includes(kw) || (t.description||'').toLowerCase().includes(kw));
    }
    res.json({ success: true, tasks: result });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tasks', authMw, async (req, res) => {
  try {
    const { title, description, category, difficulty, priority, due_date } = req.body;
    if (!title) return res.status(400).json({ error: '标题不能为空' });
    const data = {
      user_id: req.userId,
      title: sanitize(title, 200),
      description: sanitize(description, 1000),
      category: sanitize(category, 50) || 'general',
      difficulty: Math.min(5, Math.max(1, parseInt(difficulty) || 3)),
      priority: Math.min(5, Math.max(1, parseInt(priority) || 3)),
      due_date: due_date || null,
      status: 'pending',
      is_pinned: 0,
      sort_order: 0,
      source: '',
      created_at: new Date().toISOString()
    };
    const id = await insert('tasks', data);
    // 更新每日统计
    const today = new Date().toISOString().split('T')[0];
    const stat = await findOne('daily_stats', { user_id: req.userId, stat_date: today });
    if (stat) {
      await coll('daily_stats').doc(stat._id).update({ tasks_created: _.inc(1) });
    } else {
      await insert('daily_stats', { user_id: req.userId, stat_date: today, tasks_created: 1, tasks_started: 0, tasks_completed: 0, micro_starts_count: 0, procrastination_count: 0, pomodoro_count: 0 });
    }
    res.json({ success: true, taskId: id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/tasks/:id', authMw, async (req, res) => {
  try {
    const { title, description, status, difficulty, priority, due_date, is_pinned, sort_order } = req.body;
    const task = await findOne('tasks', { _id: req.params.id, user_id: req.userId });
    if (!task) return res.status(404).json({ error: '任务不存在' });
    const updateData = {};
    if (title !== undefined) updateData.title = sanitize(title, 200);
    if (description !== undefined) updateData.description = sanitize(description, 1000);
    if (status !== undefined) updateData.status = status;
    if (difficulty !== undefined) updateData.difficulty = parseInt(difficulty);
    if (priority !== undefined) updateData.priority = parseInt(priority);
    if (due_date !== undefined) updateData.due_date = due_date;
    if (is_pinned !== undefined) updateData.is_pinned = is_pinned ? 1 : 0;
    if (sort_order !== undefined) updateData.sort_order = parseInt(sort_order) || 0;
    
    if (Object.keys(updateData).length === 0) return res.json({ success: true });
    updateData.updated_at = new Date().toISOString();
    await coll('tasks').doc(task._id).update(updateData);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/tasks/:id', authMw, async (req, res) => {
  try {
    const taskId = req.params.id;
    const task = await findOne('tasks', { _id: taskId, user_id: req.userId });
    if (!task) return res.status(404).json({ error: '任务不存在' });
    await removeMany('task_steps', { task_id: taskId });
    await removeMany('micro_starts', { task_id: taskId });
    await removeMany('procrastination_logs', { task_id: taskId });
    await removeMany('commitments', { task_id: taskId });
    await coll('tasks').doc(task._id).remove();
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// 拖拽重排
app.post('/api/tasks/reorder', authMw, async (req, res) => {
  try {
    const { orders } = req.body;
    if (!orders || !Array.isArray(orders)) return res.status(400).json({ error: '参数无效' });
    for (const o of orders) {
      if (o.id && o.sort_order != null) {
        const task = await findOne('tasks', { _id: o.id, user_id: req.userId });
        if (task) await coll('tasks').doc(task._id).update({ sort_order: parseInt(o.sort_order) || 0 });
      }
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ========== 任务步骤 ==========
app.get('/api/tasks/:id/steps', authMw, async (req, res) => {
  const steps = await findList('task_steps', { task_id: req.params.id }, 'created_at', 'asc', 50);
  res.json({ success: true, steps });
});

app.post('/api/tasks/:id/steps', authMw, async (req, res) => {
  try {
    const { title, planned_duration } = req.body;
    if (!title) return res.status(400).json({ error: '步骤标题不能为空' });
    const id = await insert('task_steps', {
      task_id: req.params.id,
      user_id: req.userId,
      title: sanitize(title, 200),
      planned_duration: parseInt(planned_duration) || 2,
      status: 'pending'
    });
    res.json({ success: true, stepId: id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/steps/:id', authMw, async (req, res) => {
  try {
    const step = await findOne('task_steps', { _id: req.params.id });
    if (!step) return res.status(404).json({ error: '步骤不存在' });
    const data = {};
    if (req.body.status !== undefined) data.status = req.body.status;
    if (req.body.title !== undefined) data.title = sanitize(req.body.title, 200);
    if (req.body.planned_duration !== undefined) data.planned_duration = parseInt(req.body.planned_duration);
    if (Object.keys(data).length === 0) return res.json({ success: true });
    await coll('task_steps').doc(step._id).update(data);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ========== 微启动 ==========
app.post('/api/micro-starts', authMw, async (req, res) => {
  try {
    const { task_id, step_id, planned_duration, actual_duration, continued_after_contract } = req.body;
    const id = await insert('micro_starts', {
      user_id: req.userId,
      task_id: task_id || null,
      step_id: step_id || null,
      planned_duration: parseInt(planned_duration) || 2,
      actual_duration: parseInt(actual_duration) || 0,
      continued_after_contract: continued_after_contract ? 1 : 0,
      status: 'completed'
    });
    if (task_id) {
      const task = await findOne('tasks', { _id: task_id, user_id: req.userId });
      if (task && task.status !== 'completed') {
        await coll('tasks').doc(task._id).update({ status: 'in_progress' });
      }
    }
    // 更新统计
    const today = new Date().toISOString().split('T')[0];
    const stat = await findOne('daily_stats', { user_id: req.userId, stat_date: today });
    if (stat) {
      await coll('daily_stats').doc(stat._id).update({ micro_starts_count: _.inc(1) });
    } else {
      await insert('daily_stats', { user_id: req.userId, stat_date: today, tasks_created: 0, tasks_started: 0, tasks_completed: 0, micro_starts_count: 1, procrastination_count: 0, pomodoro_count: 0 });
    }
    res.json({ success: true, microStartId: id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/micro-starts', authMw, async (req, res) => {
  try {
    const microStarts = await findList('micro_starts', { user_id: req.userId }, 'created_at', 'desc', 100);
    // 补充任务标题 - CloudBase document DB 无 JOIN，需分别查询
    for (const ms of microStarts) {
      if (ms.task_id) {
        const task = await findOne('tasks', { _id: ms.task_id });
        ms.task_title = task ? task.title : null;
        ms.task_due_date = task ? task.due_date : null;
        ms.task_desc = task ? task.description : null;
      }
      if (ms.step_id) {
        const step = await findOne('task_steps', { _id: ms.step_id });
        ms.step_title = step ? step.title : null;
      }
    }
    res.json({ success: true, microStarts });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ========== 情绪记录 ==========
app.post('/api/emotions', authMw, async (req, res) => {
  try {
    const { emotion_type, energy_level, trigger_task, cbt_response } = req.body;
    if (!emotion_type) return res.status(400).json({ error: '请选择情绪' });
    const id = await insert('emotions', {
      user_id: req.userId,
      emotion_type: sanitize(emotion_type, 20),
      energy_level: parseInt(energy_level) || 3,
      trigger_task: sanitize(trigger_task, 200),
      cbt_response: sanitize(cbt_response, 2000)
    });
    res.json({ success: true, emotionId: id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/emotions', authMw, async (req, res) => {
  const emotions = await findList('emotions', { user_id: req.userId }, 'created_at', 'desc', 50);
  res.json({ success: true, emotions });
});

// ========== 番茄钟 ==========
app.post('/api/pomodoro', authMw, async (req, res) => {
  try {
    const { task_id, step_id, duration, completed } = req.body;
    const id = await insert('pomodoro_sessions', {
      user_id: req.userId,
      task_id: task_id || null,
      step_id: step_id || null,
      duration: parseInt(duration) || 25,
      completed: completed ? 1 : 0
    });
    // 更新统计
    const today = new Date().toISOString().split('T')[0];
    const stat = await findOne('daily_stats', { user_id: req.userId, stat_date: today });
    if (stat) {
      await coll('daily_stats').doc(stat._id).update({ pomodoro_count: _.inc(1) });
    }
    res.json({ success: true, sessionId: id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/pomodoro', authMw, async (req, res) => {
  const sessions = await findList('pomodoro_sessions', { user_id: req.userId }, 'created_at', 'desc', 100);
  for (const s of sessions) {
    if (s.task_id) {
      const task = await findOne('tasks', { _id: s.task_id });
      s.task_title = task ? task.title : null;
      s.task_due_date = task ? task.due_date : null;
    }
  }
  res.json({ success: true, sessions });
});

// ========== 拖延日志 ==========
app.post('/api/procrastination-logs', authMw, async (req, res) => {
  try {
    const { task_id, reason, distraction_type, duration_wasted } = req.body;
    const id = await insert('procrastination_logs', {
      user_id: req.userId,
      task_id: task_id || null,
      reason: sanitize(reason, 200),
      distraction_type: sanitize(distraction_type, 50),
      duration_wasted: parseInt(duration_wasted) || 0
    });
    const today = new Date().toISOString().split('T')[0];
    const stat = await findOne('daily_stats', { user_id: req.userId, stat_date: today });
    if (stat) {
      await coll('daily_stats').doc(stat._id).update({ procrastination_count: _.inc(1) });
    }
    res.json({ success: true, logId: id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ========== 日记 ==========
app.post('/api/diary', authMw, async (req, res) => {
  try {
    const { title, content, mood, weather, location, is_private, template_type, cbt_thought, cbt_emotion, cbt_behavior, cbt_reframe } = req.body;
    const id = await insert('diary_entries', {
      user_id: req.userId,
      title: sanitize(title, 200) || '无标题',
      content: sanitize(content, 5000),
      mood: sanitize(mood, 20) || 'neutral',
      weather: sanitize(weather, 50) || '',
      location: sanitize(location, 100) || '',
      is_private: is_private !== false ? 1 : 0,
      template_type: sanitize(template_type, 20) || 'free',
      cbt_thought: sanitize(cbt_thought, 2000),
      cbt_emotion: sanitize(cbt_emotion, 1000),
      cbt_behavior: sanitize(cbt_behavior, 2000),
      cbt_reframe: sanitize(cbt_reframe, 2000)
    });
    res.json({ success: true, entryId: id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/diary', authMw, async (req, res) => {
  const entries = await findList('diary_entries', { user_id: req.userId }, 'created_at', 'desc', 50);
  res.json({ success: true, entries });
});

// ========== 承诺管理 ==========
app.post('/api/commitments', authMw, async (req, res) => {
  try {
    const { task_id, content, deadline, witness_name } = req.body;
    if (!content) return res.status(400).json({ error: '承诺内容不能为空' });
    const id = await insert('commitments', {
      user_id: req.userId,
      task_id: task_id || null,
      content: sanitize(content, 500),
      deadline: deadline || null,
      witness_name: sanitize(witness_name, 50),
      status: 'active'
    });
    res.json({ success: true, commitmentId: id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/commitments', authMw, async (req, res) => {
  const commitments = await findList('commitments', { user_id: req.userId }, 'created_at', 'desc', 50);
  res.json({ success: true, commitments });
});

// ========== 时间块 ==========
app.post('/api/time-blocks', authMw, async (req, res) => {
  try {
    const { task_id, block_date, start_time, end_time, block_type, energy_level } = req.body;
    const id = await insert('time_blocks', {
      user_id: req.userId,
      task_id: task_id || null,
      block_date: block_date || new Date().toISOString().split('T')[0],
      start_time: start_time || '09:00',
      end_time: end_time || '10:00',
      block_type: sanitize(block_type, 20) || 'work',
      energy_level: parseInt(energy_level) || 3
    });
    res.json({ success: true, blockId: id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/time-blocks', authMw, async (req, res) => {
  const { date } = req.query;
  const where = { user_id: req.userId };
  if (date) where.block_date = date;
  const blocks = await findList('time_blocks', where, 'start_time', 'asc', 200);
  for (const b of blocks) {
    if (b.task_id) {
      const task = await findOne('tasks', { _id: b.task_id });
      b.task_title = task ? task.title : null;
      b.task_status = task ? task.status : null;
    }
  }
  res.json({ success: true, blocks });
});

// ========== 网易云音乐搜索 ==========
app.get('/api/music/search', async (req, res) => {
  const { keyword } = req.query;
  if (!keyword) return res.status(400).json({ error: '请输入关键词' });
  try {
    const resp = await fetch(`https://music.163.com/api/search/get?s=${encodeURIComponent(keyword)}&type=1&limit=20&offset=0`, {
      headers: { 'Referer': 'https://music.163.com/', 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await resp.json();
    const songs = (data.result?.songs || []).map(s => ({
      id: s.id, name: s.name,
      artists: (s.artists || []).map(a => a.name).join(' / '),
      album: s.album?.name || '', duration: s.duration || 0,
      embedUrl: `https://music.163.com/outchain/player?type=2&id=${s.id}&auto=0&height=66`
    }));
    res.json({ success: true, songs, total: data.result?.songCount || 0 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ========== 仪表盘 ==========
app.get('/api/dashboard', authMw, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    // 并行查询所有数据
    const [stats, tasks, emotions, microStarts, pomo, entries] = await Promise.all([
      findOne('daily_stats', { user_id: req.userId, stat_date: today }),
      findList('tasks', { user_id: req.userId }, 'created_at', 'desc', 200),
      findList('emotions', { user_id: req.userId }, 'created_at', 'desc', 100),
      findList('micro_starts', { user_id: req.userId }, 'created_at', 'desc', 100),
      findList('pomodoro_sessions', { user_id: req.userId }, 'created_at', 'desc', 100),
      findList('diary_entries', { user_id: req.userId }, 'created_at', 'desc', 100)
    ]);
    
    // 计算统计
    const todayPomo = pomo.filter(p => p.created_at && p.created_at.startsWith(today));
    const todayStats = stats || { tasks_created: 0, tasks_started: 0, tasks_completed: 0, micro_starts_count: 0, procrastination_count: 0, pomodoro_count: 0 };
    const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').slice(0, 5);
    const recentEmotion = emotions[0] || null;
    const todayMicroStarts = microStarts.filter(ms => ms.created_at && ms.created_at.startsWith(today));
    
    // 近7天统计
    const weeklyStats = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const s = await findOne('daily_stats', { user_id: req.userId, stat_date: ds }) || {};
      weeklyStats.push({ stat_date: ds, ...s });
    }
    
    // 到期任务
    const upcomingTasks = tasks.filter(t => {
      return t.status !== 'completed' && t.due_date && t.due_date <= new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
    }).slice(0, 10);
    
    res.json({
      success: true,
      todayStats,
      pendingTasks,
      todayBlocks: [],
      recentEmotion,
      weeklyStats,
      todayPomodoro: { count: todayPomo.length, completed: todayPomo.filter(p => p.completed).length },
      upcomingTasks,
      tasks, emotions, commitments: [], diary: entries, microStarts, pomodoro: pomo
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ========== 数据备份 ==========
app.post('/api/backup', authMw, async (req, res) => {
  try {
    const tables = ['tasks','diary_entries','emotions','commitments','micro_starts','pomodoro_sessions','time_blocks','daily_stats'];
    let data = { backupDate: new Date().toISOString(), userId: req.userId };
    for (const t of tables) {
      try {
        data[t] = await findList(t, { user_id: req.userId });
      } catch(e) { data[t] = []; }
    }
    const key = `backup/${req.userId}/${Date.now()}.json`;
    await cloudbase.uploadFile({
      cloudPath: key,
      fileContent: Buffer.from(JSON.stringify(data,null,2))
    });
    res.json({ success: true, key, size: JSON.stringify(data).length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ========== 用户偏好 ==========
app.post('/api/user/preferences', authMw, async (req, res) => {
  try {
    const user = await findOne('users', { _id: req.userId });
    if (!user) return res.status(404).json({ error: '用户不存在' });
    const prefs = { ...(user.preferences || {}), ...req.body };
    await coll('users').doc(user._id).update({ preferences: prefs });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ========== 数据导入 ==========
app.post('/api/import', authMw, async (req, res) => {
  try {
    const { entries } = req.body;
    if (!entries || !Array.isArray(entries)) return res.status(400).json({ error: '无数据' });
    let count = 0;
    for (const entry of entries) {
      if (entry.type === 'task') {
        delete entry._id; entry.user_id = req.userId;
        await insert('tasks', entry); count++;
      }
    }
    res.json({ success: true, imported: count });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ========== 每周计划（精简版）==========
app.get('/api/weekly-plans', authMw, async (req, res) => {
  const { week_start } = req.query;
  const where = { user_id: req.userId };
  if (week_start) where.week_start = week_start;
  const plans = await findList('weekly_plans', where, 'day_of_week', 'asc', 200);
  res.json({ success: true, plans });
});

app.post('/api/weekly-plans', authMw, async (req, res) => {
  try {
    const data = { ...req.body, user_id: req.userId };
    if (!data.title) return res.status(400).json({ error: '标题不能为空' });
    const id = await insert('weekly_plans', data);
    res.json({ success: true, id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/weekly-plans/:id', authMw, async (req, res) => {
  try {
    const plan = await findOne('weekly_plans', { _id: req.params.id, user_id: req.userId });
    if (!plan) return res.status(404).json({ error: '计划不存在' });
    await coll('weekly_plans').doc(plan._id).update({ ...req.body, updated_at: new Date().toISOString() });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/weekly-plans/delete', authMw, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: '请选择计划' });
    for (const id of ids) {
      await removeOne('weekly_plans', { _id: id, user_id: req.userId });
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ========== 周视图模板 ==========
app.get('/api/weekly-plans/templates', authMw, async (req, res) => {
  const templates = await findList('user_templates', { user_id: req.userId }, 'sort_order', 'asc', 50);
  res.json({ success: true, templates });
});

app.post('/api/weekly-plans/templates', authMw, async (req, res) => {
  try {
    if (!req.body.title) return res.status(400).json({ error: '标题不能为空' });
    const id = await insert('user_templates', { ...req.body, user_id: req.userId });
    res.json({ success: true, id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/weekly-plans/templates/:id', authMw, async (req, res) => {
  try {
    const tpl = await findOne('user_templates', { _id: req.params.id, user_id: req.userId });
    if (!tpl) return res.status(404).json({ error: '模板不存在' });
    await coll('user_templates').doc(tpl._id).update({ ...req.body, updated_at: new Date().toISOString() });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/weekly-plans/templates/:id', authMw, async (req, res) => {
  try {
    await removeOne('user_templates', { _id: req.params.id, user_id: req.userId });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ========== 百度网盘配置状态 ==========
app.get('/api/cloud-drive/baidu/config-status', optionalAuth, (req, res) => {
  // CloudBase 版不做百度网盘集成（免费版资源有限）
  res.json({ success: true, hasGlobalConfig: false, hasUserConfig: false, usingGlobal: false });
});

// ========== 404 ==========
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// ========== 导出为 CloudBase 云函数入口 ==========
const { serverless } = require('@cloudbase/serverless');
exports.main = serverless(app);
