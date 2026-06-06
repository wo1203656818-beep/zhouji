
// ==================== 周迹后端 v2.1 - D1兼容性修复版 ====================

import { Router } from './router.js';

// ========== 输入验证辅助函数 (修复 BE-001) ==========
function sanitizeUsername(username) {
  if (!username || typeof username !== 'string') return '';
  return username.replace(/[<>\&"'\/\\]/g, '').trim().slice(0, 30);
}

function sanitizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const cleaned = email.replace(/[<>\&"']/g, '').trim().slice(0, 100);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(cleaned) ? cleaned : '';
}

function sanitizeNumber(value, min, max) {
  const num = parseInt(value);
  if (isNaN(num)) return min;
  return Math.max(min, Math.min(max, num));
}

function sanitizeDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return dateStr.slice(0, 10); // YYYY-MM-DD
}

// 增强的 sanitize 函数 (修复 BE-002)
function sanitize(str, maxLength = 500) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim()
    .slice(0, maxLength);
}

// ========== 工具函数 ==========

async function signJWT(payload, secret) {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const base64Data = btoa(String.fromCharCode(...new Uint8Array(data)));
  const base64Sig = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${base64Data}.${base64Sig}`;
}

async function verifyJWT(token, secret) {
  try {
    const [dataB64, sigB64] = token.split('.');
    if (!dataB64 || !sigB64) return null;
    const data = new TextEncoder().encode(atob(dataB64));
    const signature = new Uint8Array(atob(sigB64).split('').map(c => c.charCodeAt(0)));
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const valid = await crypto.subtle.verify('HMAC', key, signature, data);
    if (!valid) return null;
    return JSON.parse(atob(dataB64));
  } catch (e) { return null; }
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'zhouji-salt-v2-2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

function corsHeaders(origin, env = {}) {
  // 修复 BE-009: CORS 安全，凭据模式下不能使用通配符
  const allowedOrigin = origin && origin !== 'null' 
    ? origin 
    : (env.ALLOWED_ORIGIN || 'https://zhouji.pages.dev');
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  };
}

function jsonResponse(data, status, extraHeaders) {
  if (status === void 0) { status = 200; }
  if (extraHeaders === void 0) { extraHeaders = {}; }
  return new Response(JSON.stringify(data), {
    status: status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      ...extraHeaders
    },
  });
}

async function authMiddleware(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return { error: '未提供认证令牌', status: 401 };
  }
  const token = auth.slice(7);
  if (!token || token.length < 10) {
    return { error: '无效的认证令牌格式', status: 401 };
  }
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) return { error: '无效的认证令牌', status: 401 };
  if (!payload.userId || !payload.username) {
    return { error: '令牌数据不完整', status: 401 };
  }
  return { userId: payload.userId, username: payload.username };
}

// 安全的 last_row_id 获取 - D1标准方式：result.meta.last_row_id
function getLastRowId(result) {
  if (result && result.meta && typeof result.meta.last_row_id === 'number') {
    return result.meta.last_row_id;
  }
  return null;
}

// ========== 请求限流 (简单内存版) ==========
const rateLimitMap = new Map();
function checkRateLimit(clientIP, maxRequests, windowMs) {
  if (maxRequests === void 0) { maxRequests = 200; }
  if (windowMs === void 0) { windowMs = 60000; }
  cleanupRateLimit(); // 清理过期记录
  var now = Date.now();
  var record = rateLimitMap.get(clientIP);
  if (!record || now - record.start > windowMs) {
    rateLimitMap.set(clientIP, { start: now, count: 1 });
    return { allowed: true, remaining: maxRequests - 1 };
  }
  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((record.start + windowMs - now) / 1000) };
  }
  record.count++;
  return { allowed: true, remaining: maxRequests - record.count };
}
// 清理过期记录（在 checkRateLimit 中按需清理）
function cleanupRateLimit() {
  var now = Date.now();
  for (var _i = 0, _a = Array.from(rateLimitMap.entries()); _i < _a.length; _i++) {
    var _b = _a[_i], key = _b[0], record = _b[1];
    if (now - record.start > 120000) rateLimitMap.delete(key);
  }
}

// 更新每日统计
async function updateDailyStat(db, userId, field, increment = 1) {
  const today = new Date().toISOString().split('T')[0];
  try {
    // 修复 BE-003: D1 兼容性，先 UPDATE 再 INSERT
    const updateResult = await db.prepare(
      `UPDATE daily_stats SET ${field} = COALESCE(${field}, 0) + ? 
       WHERE user_id = ? AND stat_date = ?`
    ).bind(increment, userId, today).run();

    // 如果没有更新到记录，则插入新记录
    if (!updateResult.meta || updateResult.meta.changes === 0) {
      await db.prepare(
        `INSERT INTO daily_stats (user_id, stat_date, ${field}) VALUES (?, ?, ?)`
      ).bind(userId, today, increment).run();
    }
  } catch (e) { 
    console.error('Stat update error:', e); 
  }
}

// 输入消毒

// ========== 路由 ==========
const router = new Router();

// 健康检查
router.get('/api/health', async (req, env) => {
  try {
    var start = Date.now();
    const dbTest = await env.DB.prepare('SELECT 1 as test').first();
    var dbLatency = Date.now() - start;
    return jsonResponse({
      success: true,
      status: 'ok',
      service: 'zhouji-api',
      version: '2.2.0',
      db: dbTest && dbTest.test === 1 ? 'connected' : 'error',
      dbLatency: dbLatency + 'ms',
      timestamp: new Date().toISOString(),
      uptime: 'running'
    });
  } catch (e) {
    return jsonResponse({ success: false, status: 'error', message: '数据库连接失败' }, 500);
  }
});

// ========== 认证 ==========

router.post('/api/auth/register', async (req, env) => {
  try {
    const body = await req.json();
    const username = sanitizeUsername(body.username);
    const password = body.password || '';
    const email = sanitizeEmail(body.email);

    if (!username || !password) return jsonResponse({ error: '用户名和密码不能为空' }, 400);
    if (username.length < 3 || username.length > 30) return jsonResponse({ error: '用户名3-30位' }, 400);
    if (password.length < 6 || password.length > 100) return jsonResponse({ error: '密码6-100位' }, 400);

    const db = env.DB;
    const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
    if (existing) return jsonResponse({ error: '用户名已存在' }, 409);

    const passwordHash = await hashPassword(password);
    const result = await db.prepare(
      'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)'
    ).bind(username, passwordHash, email || null).run();

    const userId = getLastRowId(result);
    if (!userId) {
      // fallback: query the inserted user
      const newUser = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
      if (!newUser) return jsonResponse({ error: '注册失败，请重试' }, 500);
    }
    const finalUserId = userId || (await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first())?.id;
    const token = await signJWT({ userId: finalUserId, username }, env.JWT_SECRET);

    return jsonResponse({ success: true, token, userId: finalUserId, username });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

router.post('/api/auth/login', async (req, env) => {
  try {
    const { username, password } = await req.json();
    if (!username || !password) return jsonResponse({ error: '用户名和密码不能为空' }, 400);

    const db = env.DB;
    const user = await db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
      .bind(sanitizeUsername(username)).first();
    if (!user) return jsonResponse({ error: '用户名或密码错误' }, 401);

    const passwordHash = await hashPassword(password);
    if (passwordHash !== user.password_hash) return jsonResponse({ error: '用户名或密码错误' }, 401);

    const token = await signJWT({ userId: user.id, username: user.username }, env.JWT_SECRET);
    return jsonResponse({ success: true, token, userId: user.id, username: user.username });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

router.get('/api/user', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  const db = env.DB;
  const user = await db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?')
    .bind(auth.userId).first();
  return jsonResponse({ success: true, user });
});

// ========== 任务管理 ==========

router.post('/api/tasks', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const { title, description, category, difficulty, due_date } = await req.json();
    const cleanTitle = sanitize(title, 200);
    if (!cleanTitle || cleanTitle.length < 1) return jsonResponse({ error: '任务标题不能为空', success: false }, 400);
    if (cleanTitle.length > 200) return jsonResponse({ error: '任务标题不能超过200字符', success: false }, 400);
    var cleanDesc = sanitize(description, 1000);
    var cleanCat = sanitize(category, 50) || 'general';
    var cleanDiff = sanitizeNumber(difficulty, 1, 5);
    var cleanDate = sanitizeDate(due_date);

    const db = env.DB;
    const result = await db.prepare(
      `INSERT INTO tasks (user_id, title, description, category, difficulty, due_date, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    ).bind(auth.userId, cleanTitle, cleanDesc, cleanCat, cleanDiff, cleanDate).run();

    const taskId = getLastRowId(result);
    await updateDailyStat(db, auth.userId, 'tasks_created');

    return jsonResponse({ success: true, taskId });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

router.get('/api/tasks', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');

    const db = env.DB;
    let sql = 'SELECT * FROM tasks WHERE user_id = ?';
    let bindings = [auth.userId];

    if (status) { sql += ' AND status = ?'; bindings.push(status); }
    if (category) { sql += ' AND category = ?'; bindings.push(category); }
    if (search) { sql += ' AND (title LIKE ? OR description LIKE ?)'; bindings.push(`%${search}%`, `%${search}%`); }
    sql += ' ORDER BY CASE status WHEN "in_progress" THEN 1 WHEN "pending" THEN 2 ELSE 3 END, difficulty ASC, created_at DESC';

    const { results } = await db.prepare(sql).bind(...bindings).all();

    for (const task of results) {
      const steps = await db.prepare('SELECT COUNT(*) as count FROM task_steps WHERE task_id = ?')
        .bind(task.id).first();
      task.steps_count = steps?.count || 0;
    }

    return jsonResponse({ success: true, tasks: results });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

router.put('/api/tasks/:id', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const taskId = req.params.id;
    const { title, description, status, difficulty, due_date } = await req.json();

    const db = env.DB;
    const existing = await db.prepare('SELECT status FROM tasks WHERE id = ? AND user_id = ?')
      .bind(taskId, auth.userId).first();
    if (!existing) return jsonResponse({ error: '任务不存在' }, 404);

    const updates = [];
    const bindings = [];
    if (title !== undefined) { updates.push('title = ?'); bindings.push(sanitize(title)); }
    if (description !== undefined) { updates.push('description = ?'); bindings.push(sanitize(description)); }
    if (status !== undefined) { updates.push('status = ?'); bindings.push(status); }
    if (difficulty !== undefined) { updates.push('difficulty = ?'); bindings.push(Math.min(5, Math.max(1, parseInt(difficulty) || 3))); }
    if (due_date !== undefined) { updates.push('due_date = ?'); bindings.push(due_date); }
    updates.push('updated_at = CURRENT_TIMESTAMP');
    bindings.push(taskId, auth.userId);

    await db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).bind(...bindings).run();

    if (status === 'in_progress' && existing.status !== 'in_progress') {
      await updateDailyStat(db, auth.userId, 'tasks_started');
    }
    if (status === 'completed' && existing.status !== 'completed') {
      await updateDailyStat(db, auth.userId, 'tasks_completed');
    }

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

router.delete('/api/tasks/:id', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const taskId = req.params.id;
    // 修复 BE-013: 级联删除关联数据
    await db.prepare('DELETE FROM task_steps WHERE task_id = ?').bind(taskId).run();
    await db.prepare('DELETE FROM micro_starts WHERE task_id = ?').bind(taskId).run();
    await db.prepare('DELETE FROM procrastination_logs WHERE task_id = ?').bind(taskId).run();
    await db.prepare('DELETE FROM commitments WHERE task_id = ?').bind(taskId).run();
    await db.prepare('DELETE FROM time_blocks WHERE task_id = ?').bind(taskId).run();
    await db.prepare('DELETE FROM pomodoro_sessions WHERE task_id = ?').bind(taskId).run();
    await db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').bind(taskId, auth.userId).run();

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// ========== 任务步骤 ==========

router.post('/api/tasks/:id/steps', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const taskId = req.params.id;
    const { title, duration, order_index } = await req.json();
    const cleanTitle = sanitize(title);
    if (!cleanTitle) return jsonResponse({ error: '步骤标题不能为空' }, 400);

    const db = env.DB;
    const task = await db.prepare('SELECT id FROM tasks WHERE id = ? AND user_id = ?')
      .bind(taskId, auth.userId).first();
    if (!task) return jsonResponse({ error: '任务不存在' }, 404);

    const result = await db.prepare(
      `INSERT INTO task_steps (task_id, user_id, title, duration, order_index, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`
    ).bind(taskId, auth.userId, cleanTitle, Math.min(60, Math.max(1, parseInt(duration) || 2)), 
           parseInt(order_index) || 0).run();

    return jsonResponse({ success: true, stepId: getLastRowId(result) });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

router.get('/api/tasks/:id/steps', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const { results } = await db.prepare(
      'SELECT * FROM task_steps WHERE task_id = ? AND user_id = ? ORDER BY order_index, created_at'
    ).bind(req.params.id, auth.userId).all();
    return jsonResponse({ success: true, steps: results });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

router.put('/api/steps/:id', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const { status, title } = await req.json();
    const db = env.DB;
    const updates = [];
    const bindings = [];
    if (status !== undefined) { updates.push('status = ?'); bindings.push(status); }
    if (title !== undefined) { updates.push('title = ?'); bindings.push(sanitize(title)); }
    bindings.push(req.params.id, auth.userId);

    await db.prepare(`UPDATE task_steps SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).bind(...bindings).run();
    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

router.delete('/api/steps/:id', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    await env.DB.prepare('DELETE FROM task_steps WHERE id = ? AND user_id = ?')
      .bind(req.params.id, auth.userId).run();
    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// ========== 情绪缓冲舱 ==========

router.post('/api/emotions', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const { emotion_type, energy_level, trigger_task, cbt_response } = await req.json();
    var validEmotions = ['vague', 'fear', 'boring', 'distracted', 'tired', 'anxious', 'confident', 'calm'];
    if (!emotion_type || !validEmotions.includes(emotion_type)) {
      return jsonResponse({ error: '情绪类型无效', success: false }, 400);
    }

    const db = env.DB;
    const result = await db.prepare(
      `INSERT INTO emotions (user_id, emotion_type, energy_level, trigger_task, cbt_response)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(auth.userId, sanitize(emotion_type), Math.min(5, Math.max(1, parseInt(energy_level) || 3)),
           sanitize(trigger_task), sanitize(cbt_response)).run();

    return jsonResponse({ success: true, emotionId: getLastRowId(result) });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

router.get('/api/emotions', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const { results } = await db.prepare(
      'SELECT * FROM emotions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100'
    ).bind(auth.userId).all();
    return jsonResponse({ success: true, emotions: results });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// ========== 微启动系统 ==========

router.post('/api/micro-starts', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const { task_id, step_id, planned_duration, actual_duration, continued_after_contract } = await req.json();

    const db = env.DB;
    const result = await db.prepare(
      `INSERT INTO micro_starts (user_id, task_id, step_id, planned_duration, actual_duration, continued_after_contract, status)
       VALUES (?, ?, ?, ?, ?, ?, 'completed')`
    ).bind(auth.userId, task_id || null, step_id || null, parseInt(planned_duration) || 2,
           parseInt(actual_duration) || 0, continued_after_contract ? 1 : 0).run();

    await updateDailyStat(db, auth.userId, 'micro_starts_count');

    if (task_id) {
      await db.prepare("UPDATE tasks SET status = 'in_progress' WHERE id = ? AND user_id = ?")
        .bind(task_id, auth.userId).run();
    }

    return jsonResponse({ success: true, microStartId: getLastRowId(result) });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

router.get('/api/micro-starts', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const { results } = await db.prepare(
      `SELECT ms.*, t.title as task_title, s.title as step_title 
       FROM micro_starts ms
       LEFT JOIN tasks t ON ms.task_id = t.id
       LEFT JOIN task_steps s ON ms.step_id = s.id
       WHERE ms.user_id = ? ORDER BY ms.created_at DESC LIMIT 100`
    ).bind(auth.userId).all();
    return jsonResponse({ success: true, microStarts: results });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// ========== 拖延日志 ==========

router.post('/api/procrastination-logs', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const { task_id, reason_type, reason_detail, distraction_source } = await req.json();
    if (!reason_type) return jsonResponse({ error: '拖延原因不能为空' }, 400);

    const db = env.DB;
    const result = await db.prepare(
      `INSERT INTO procrastination_logs (user_id, task_id, reason_type, reason_detail, distraction_source)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(auth.userId, task_id || null, sanitize(reason_type), sanitize(reason_detail), sanitize(distraction_source)).run();

    await updateDailyStat(db, auth.userId, 'procrastination_count');
    return jsonResponse({ success: true, logId: getLastRowId(result) });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

router.get('/api/procrastination-logs', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const { results } = await db.prepare(
      `SELECT pl.*, t.title as task_title 
       FROM procrastination_logs pl
       LEFT JOIN tasks t ON pl.task_id = t.id
       WHERE pl.user_id = ? ORDER BY pl.created_at DESC LIMIT 100`
    ).bind(auth.userId).all();
    return jsonResponse({ success: true, logs: results });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// ========== 承诺/问责 ==========

router.post('/api/commitments', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const { task_id, description, witness_type, witness_contact, deadline } = await req.json();
    const cleanDesc = sanitize(description);
    if (!cleanDesc) return jsonResponse({ error: '承诺描述不能为空' }, 400);

    const db = env.DB;
    const result = await db.prepare(
      `INSERT INTO commitments (user_id, task_id, description, witness_type, witness_contact, deadline)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(auth.userId, task_id || null, cleanDesc, sanitize(witness_type) || 'self',
           sanitize(witness_contact), deadline || null).run();

    return jsonResponse({ success: true, commitmentId: getLastRowId(result) });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

router.get('/api/commitments', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const { results } = await db.prepare(
      `SELECT c.*, t.title as task_title 
       FROM commitments c
       LEFT JOIN tasks t ON c.task_id = t.id
       WHERE c.user_id = ? ORDER BY c.created_at DESC`
    ).bind(auth.userId).all();
    return jsonResponse({ success: true, commitments: results });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

router.put('/api/commitments/:id', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const { completed, description } = await req.json();
    const db = env.DB;
    const updates = [];
    const bindings = [];
    if (completed !== undefined) { updates.push('completed = ?'); bindings.push(completed ? 1 : 0); }
    if (description !== undefined) { updates.push('description = ?'); bindings.push(sanitize(description)); }
    bindings.push(req.params.id, auth.userId);

    await db.prepare(`UPDATE commitments SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).bind(...bindings).run();
    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

router.delete('/api/commitments/:id', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    await env.DB.prepare('DELETE FROM commitments WHERE id = ? AND user_id = ?')
      .bind(req.params.id, auth.userId).run();
    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// ========== 时间块 ==========

router.post('/api/time-blocks', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const { block_date, start_time, end_time, task_id, block_type, energy_level } = await req.json();
    if (!block_date || !start_time || !end_time) {
      return jsonResponse({ error: '日期和时间为必填项', success: false }, 400);
    }
    var timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
      return jsonResponse({ error: '时间格式不正确 (HH:MM)', success: false }, 400);
    }
    if (start_time >= end_time) {
      return jsonResponse({ error: '结束时间必须晚于开始时间', success: false }, 400);
    }
    var validTypes = ['work', 'rest', 'exercise', 'social'];
    var cleanType = validTypes.includes(block_type) ? block_type : 'work';

    const db = env.DB;
    const result = await db.prepare(
      `INSERT INTO time_blocks (user_id, block_date, start_time, end_time, task_id, block_type, energy_level)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(auth.userId, block_date, start_time, end_time, task_id || null,
           cleanType, sanitizeNumber(energy_level, 1, 5)).run();

    return jsonResponse({ success: true, blockId: getLastRowId(result) });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

router.get('/api/time-blocks', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const url = new URL(req.url);
    const date = url.searchParams.get('date');
    const db = env.DB;

    let sql = `SELECT tb.*, t.title as task_title, t.status as task_status
       FROM time_blocks tb
       LEFT JOIN tasks t ON tb.task_id = t.id
       WHERE tb.user_id = ?`;
    let bindings = [auth.userId];

    if (date) { sql += ' AND tb.block_date = ?'; bindings.push(date); }
    sql += ' ORDER BY tb.start_time';

    const { results } = await db.prepare(sql).bind(...bindings).all();
    return jsonResponse({ success: true, timeBlocks: results });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

router.delete('/api/time-blocks/:id', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    await env.DB.prepare('DELETE FROM time_blocks WHERE id = ? AND user_id = ?')
      .bind(req.params.id, auth.userId).run();
    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// ========== 番茄钟 ==========

router.post('/api/pomodoro', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const { task_id, step_id, duration, completed } = await req.json();
    const db = env.DB;
    const result = await db.prepare(
      `INSERT INTO pomodoro_sessions (user_id, task_id, step_id, duration, completed, created_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(auth.userId, task_id || null, step_id || null, parseInt(duration) || 25, completed ? 1 : 0).run();

    await updateDailyStat(db, auth.userId, 'pomodoro_count');
    return jsonResponse({ success: true, sessionId: getLastRowId(result) });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

router.get('/api/pomodoro', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const { results } = await db.prepare(
      `SELECT p.*, t.title as task_title, s.title as step_title
       FROM pomodoro_sessions p
       LEFT JOIN tasks t ON p.task_id = t.id
       LEFT JOIN task_steps s ON p.step_id = s.id
       WHERE p.user_id = ? ORDER BY p.created_at DESC LIMIT 100`
    ).bind(auth.userId).all();
    return jsonResponse({ success: true, sessions: results });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// ========== 数据分析 ==========

router.get('/api/analytics/patterns', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const userId = auth.userId;

    const weekdayStats = await db.prepare(
      `SELECT 
        CASE strftime('%w', created_at) 
          WHEN '0' THEN '周日' WHEN '1' THEN '周一' WHEN '2' THEN '周二'
          WHEN '3' THEN '周三' WHEN '4' THEN '周四' WHEN '5' THEN '周五' WHEN '6' THEN '周六'
        END as weekday,
        COUNT(*) as count
       FROM procrastination_logs WHERE user_id = ?
       GROUP BY strftime('%w', created_at)`
    ).bind(userId).all();

    const taskTypeStats = await db.prepare(
      `SELECT t.category, COUNT(pl.id) as count
       FROM procrastination_logs pl
       LEFT JOIN tasks t ON pl.task_id = t.id
       WHERE pl.user_id = ? AND t.category IS NOT NULL
       GROUP BY t.category`
    ).bind(userId).all();

    const reasonStats = await db.prepare(
      `SELECT reason_type, COUNT(*) as count
       FROM procrastination_logs WHERE user_id = ?
       GROUP BY reason_type ORDER BY count DESC`
    ).bind(userId).all();

    const distractionStats = await db.prepare(
      `SELECT distraction_source, COUNT(*) as count
       FROM procrastination_logs 
       WHERE user_id = ? AND distraction_source != '' AND distraction_source IS NOT NULL
       GROUP BY distraction_source ORDER BY count DESC LIMIT 10`
    ).bind(userId).all();

    const dailyStats = await db.prepare(
      `SELECT * FROM daily_stats 
       WHERE user_id = ? AND stat_date >= date('now', '-30 days')
       ORDER BY stat_date`
    ).bind(userId).all();

    const microStartStats = await db.prepare(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN continued_after_contract = 1 THEN 1 ELSE 0 END) as continued_count
       FROM micro_starts WHERE user_id = ?`
    ).bind(userId).first();

    const taskStats = await db.prepare(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress
       FROM tasks WHERE user_id = ?`
    ).bind(userId).first();

    const pomodoroStats = await db.prepare(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
        SUM(duration) as total_minutes
       FROM pomodoro_sessions WHERE user_id = ?`
    ).bind(userId).first();

    return jsonResponse({
      success: true,
      patterns: {
        weekdayDistribution: weekdayStats.results || [],
        taskTypeDistribution: taskTypeStats.results || [],
        reasonDistribution: reasonStats.results || [],
        distractionDistribution: distractionStats.results || [],
        dailyTrend: dailyStats.results || [],
        microStartSuccess: microStartStats || { total: 0, continued_count: 0 },
        taskCompletionRate: taskStats || { total: 0, completed: 0, in_progress: 0 },
        pomodoroStats: pomodoroStats || { total: 0, completed: 0, total_minutes: 0 }
      }
    });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// ========== 仪表盘 ==========

router.get('/api/dashboard', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const userId = auth.userId;
    const today = new Date().toISOString().split('T')[0];

    const todayStats = await db.prepare(
      'SELECT * FROM daily_stats WHERE user_id = ? AND stat_date = ?'
    ).bind(userId, today).first();

    const pendingTasks = await db.prepare(
      `SELECT * FROM tasks WHERE user_id = ? AND status IN ('pending', 'in_progress') 
       ORDER BY difficulty ASC, created_at DESC LIMIT 5`
    ).bind(userId).all();

    const todayBlocks = await db.prepare(
      `SELECT tb.*, t.title as task_title, t.status as task_status
       FROM time_blocks tb
       LEFT JOIN tasks t ON tb.task_id = t.id
       WHERE tb.user_id = ? AND tb.block_date = ?
       ORDER BY tb.start_time`
    ).bind(userId, today).all();

    const recentEmotion = await db.prepare(
      'SELECT * FROM emotions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(userId).first();

    const weeklyStats = await db.prepare(
      `SELECT stat_date, tasks_created, tasks_started, tasks_completed, micro_starts_count, procrastination_count, pomodoro_count
       FROM daily_stats WHERE user_id = ? AND stat_date >= date('now', '-7 days')
       ORDER BY stat_date`
    ).bind(userId).all();

    const todayPomodoro = await db.prepare(
      `SELECT COUNT(*) as count, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
       FROM pomodoro_sessions WHERE user_id = ? AND date(created_at) = ?`
    ).bind(userId, today).first();

    return jsonResponse({
      success: true,
      todayStats: todayStats || { tasks_created: 0, tasks_started: 0, tasks_completed: 0, micro_starts_count: 0, procrastination_count: 0, pomodoro_count: 0 },
      pendingTasks: pendingTasks.results || [],
      todayBlocks: todayBlocks.results || [],
      recentEmotion,
      weeklyStats: weeklyStats.results || [],
      todayPomodoro: todayPomodoro || { count: 0, completed: 0 }
    });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// ========== 导出/导入 ==========

router.get('/api/export', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const userId = auth.userId;

    const [tasks, steps, emotions, microStarts, logs, commitments, timeBlocks, stats, pomodoro] = await Promise.all([
      db.prepare('SELECT * FROM tasks WHERE user_id = ?').bind(userId).all(),
      db.prepare('SELECT * FROM task_steps WHERE user_id = ?').bind(userId).all(),
      db.prepare('SELECT * FROM emotions WHERE user_id = ?').bind(userId).all(),
      db.prepare('SELECT * FROM micro_starts WHERE user_id = ?').bind(userId).all(),
      db.prepare('SELECT * FROM procrastination_logs WHERE user_id = ?').bind(userId).all(),
      db.prepare('SELECT * FROM commitments WHERE user_id = ?').bind(userId).all(),
      db.prepare('SELECT * FROM time_blocks WHERE user_id = ?').bind(userId).all(),
      db.prepare('SELECT * FROM daily_stats WHERE user_id = ?').bind(userId).all(),
      db.prepare('SELECT * FROM pomodoro_sessions WHERE user_id = ?').bind(userId).all(),
    ]);

    return jsonResponse({
      success: true,
      exportDate: new Date().toISOString(),
      data: {
        tasks: tasks.results || [],
        taskSteps: steps.results || [],
        emotions: emotions.results || [],
        microStarts: microStarts.results || [],
        procrastinationLogs: logs.results || [],
        commitments: commitments.results || [],
        timeBlocks: timeBlocks.results || [],
        dailyStats: stats.results || [],
        pomodoroSessions: pomodoro.results || []
      }
    });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

router.post('/api/import', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const { data } = await req.json();
    const db = env.DB;
    const userId = auth.userId;
    let imported = { tasks: 0, steps: 0, emotions: 0, microStarts: 0, logs: 0, commitments: 0, timeBlocks: 0, pomodoro: 0 };

    if (data.tasks && Array.isArray(data.tasks)) {
      for (const t of data.tasks) {
        try {
          await db.prepare(
            `INSERT INTO tasks (user_id, title, description, category, difficulty, status, due_date, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(userId, sanitize(t.title), sanitize(t.description), sanitize(t.category), t.difficulty || 3,
                 t.status || 'pending', t.due_date || null, t.created_at || new Date().toISOString(),
                 t.updated_at || new Date().toISOString()).run();
          imported.tasks++;
        } catch (e) {}
      }
    }

    if (data.taskSteps && Array.isArray(data.taskSteps)) {
      for (const s of data.taskSteps) {
        try {
          await db.prepare(
            `INSERT INTO task_steps (task_id, user_id, title, duration, status, order_index, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(s.task_id, userId, sanitize(s.title), s.duration || 2, s.status || 'pending',
                 s.order_index || 0, s.created_at || new Date().toISOString()).run();
          imported.steps++;
        } catch (e) {}
      }
    }

    if (data.emotions && Array.isArray(data.emotions)) {
      for (const e of data.emotions) {
        try {
          await db.prepare(
            `INSERT INTO emotions (user_id, emotion_type, energy_level, trigger_task, cbt_response, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(userId, sanitize(e.emotion_type), e.energy_level || 3, sanitize(e.trigger_task),
                 sanitize(e.cbt_response), e.created_at || new Date().toISOString()).run();
          imported.emotions++;
        } catch (e) {}
      }
    }

    if (data.microStarts && Array.isArray(data.microStarts)) {
      for (const m of data.microStarts) {
        try {
          await db.prepare(
            `INSERT INTO micro_starts (user_id, task_id, step_id, planned_duration, actual_duration, continued_after_contract, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(userId, m.task_id || null, m.step_id || null, m.planned_duration || 2,
                 m.actual_duration || 0, m.continued_after_contract || 0, m.status || 'completed',
                 m.created_at || new Date().toISOString()).run();
          imported.microStarts++;
        } catch (e) {}
      }
    }

    if (data.procrastinationLogs && Array.isArray(data.procrastinationLogs)) {
      for (const p of data.procrastinationLogs) {
        try {
          await db.prepare(
            `INSERT INTO procrastination_logs (user_id, task_id, reason_type, reason_detail, distraction_source, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(userId, p.task_id || null, sanitize(p.reason_type), sanitize(p.reason_detail),
                 sanitize(p.distraction_source), p.created_at || new Date().toISOString()).run();
          imported.logs++;
        } catch (e) {}
      }
    }

    if (data.commitments && Array.isArray(data.commitments)) {
      for (const c of data.commitments) {
        try {
          await db.prepare(
            `INSERT INTO commitments (user_id, task_id, description, witness_type, witness_contact, deadline, completed, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(userId, c.task_id || null, sanitize(c.description), sanitize(c.witness_type) || 'self',
                 sanitize(c.witness_contact), c.deadline || null, c.completed || 0,
                 c.created_at || new Date().toISOString()).run();
          imported.commitments++;
        } catch (e) {}
      }
    }

    if (data.timeBlocks && Array.isArray(data.timeBlocks)) {
      for (const t of data.timeBlocks) {
        try {
          await db.prepare(
            `INSERT INTO time_blocks (user_id, block_date, start_time, end_time, task_id, block_type, energy_level, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(userId, t.block_date, t.start_time, t.end_time, t.task_id || null,
                 sanitize(t.block_type) || 'work', t.energy_level || 3,
                 t.created_at || new Date().toISOString()).run();
          imported.timeBlocks++;
        } catch (e) {}
      }
    }

    if (data.pomodoroSessions && Array.isArray(data.pomodoroSessions)) {
      for (const p of data.pomodoroSessions) {
        try {
          await db.prepare(
            `INSERT INTO pomodoro_sessions (user_id, task_id, step_id, duration, completed, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(userId, p.task_id || null, p.step_id || null, p.duration || 25,
                 p.completed || 0, p.created_at || new Date().toISOString()).run();
          imported.pomodoro++;
        } catch (e) {}
      }
    }

    return jsonResponse({ success: true, imported });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// ========== 主入口 ==========


// 修复 DB-001: 用户删除级联清理
router.delete('/api/user', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  const db = env.DB;
  const userId = auth.userId;

  try {
    // 级联删除所有关联数据
    await db.prepare('DELETE FROM task_steps WHERE user_id = ?').bind(userId).run();
    await db.prepare('DELETE FROM tasks WHERE user_id = ?').bind(userId).run();
    await db.prepare('DELETE FROM emotions WHERE user_id = ?').bind(userId).run();
    await db.prepare('DELETE FROM micro_starts WHERE user_id = ?').bind(userId).run();
    await db.prepare('DELETE FROM procrastination_logs WHERE user_id = ?').bind(userId).run();
    await db.prepare('DELETE FROM commitments WHERE user_id = ?').bind(userId).run();
    await db.prepare('DELETE FROM time_blocks WHERE user_id = ?').bind(userId).run();
    await db.prepare('DELETE FROM pomodoro_sessions WHERE user_id = ?').bind(userId).run();
    await db.prepare('DELETE FROM daily_stats WHERE user_id = ?').bind(userId).run();
    await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();

    return jsonResponse({ success: true, message: '账号及所有数据已删除' });
  } catch (e) {
    return jsonResponse({ error: '删除账号失败', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';
    const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';

    // 修复 BE-005: 验证关键环境变量
    if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
      return jsonResponse({ 
        error: '服务器配置错误: JWT_SECRET 未设置或太短',
        success: false 
      }, 500);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    // 请求限流检查 (认证接口更严格)
    var isAuthEndpoint = url.pathname.includes('/auth/');
    var rateLimit = checkRateLimit(clientIP, isAuthEndpoint ? 10 : 200, 60000);
    if (!rateLimit.allowed) {
      return jsonResponse({
        success: false,
        error: '请求过于频繁，请稍后再试',
        retryAfter: rateLimit.retryAfter
      }, 429, {
        'X-RateLimit-Limit': String(isAuthEndpoint ? 10 : 200),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(rateLimit.retryAfter)
      });
    }

    try {
      const response = await router.handle(request, env);

      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders(origin, env)).forEach(([k, v]) => {
        if (!newHeaders.has(k)) newHeaders.set(k, v);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, env) },
      });
    }
  }
};
