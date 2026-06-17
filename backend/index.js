
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

// ========== 数据库迁移函数 ==========
let dbMigrated = false;
async function migrateDatabase(db) {
  if (dbMigrated) return;
  
  try {
    // 检查 emotions 表的列
    const tableInfo = await db.prepare('PRAGMA table_info(emotions)').all();
    const columns = (tableInfo.results || []).map(col => col.name);
    
    // 添加新列（如果不存在）
    const newColumns = [
      { name: 'intensity', type: 'INTEGER DEFAULT 5' },
      { name: 'trigger_factor', type: 'TEXT' },
      { name: 'thought', type: 'TEXT' },
      { name: 'activity', type: 'TEXT' }
    ];
    
    for (const col of newColumns) {
      if (!columns.includes(col.name)) {
        try {
          await db.prepare(`ALTER TABLE emotions ADD COLUMN ${col.name} ${col.type}`).run();
          console.log(`Added column: ${col.name}`);
        } catch (e) {
          // 列可能已存在，忽略错误
          console.log(`Column ${col.name} might already exist: ${e.message}`);
        }
      }
    }
    
    // 检查 tasks 表的 priority 列
    const tasksTableInfo = await db.prepare('PRAGMA table_info(tasks)').all();
    const taskColumns = (tasksTableInfo.results || []).map(col => col.name);
    
    if (!taskColumns.includes('priority')) {
      try {
        await db.prepare('ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 3').run();
        console.log('Added column: priority to tasks');
      } catch (e) {
        console.log(`Column priority might already exist: ${e.message}`);
      }
    }
    
    // 检查 diary_entries 表的新列
    try {
      const diaryTableInfo = await db.prepare('PRAGMA table_info(diary_entries)').all();
      const diaryColumns = (diaryTableInfo.results || []).map(col => col.name);
      
      const diaryNewColumns = [
        { name: 'cbt_thought', type: 'TEXT' },
        { name: 'cbt_emotion', type: 'TEXT' },
        { name: 'cbt_behavior', type: 'TEXT' },
        { name: 'cbt_reframe', type: 'TEXT' },
        { name: 'template_type', type: 'TEXT DEFAULT "free"' }
      ];
      
      for (const col of diaryNewColumns) {
        if (!diaryColumns.includes(col.name)) {
          try {
            await db.prepare(`ALTER TABLE diary_entries ADD COLUMN ${col.name} ${col.type}`).run();
            console.log(`Added column: ${col.name} to diary_entries`);
          } catch (e) {
            console.log(`Column ${col.name} might already exist: ${e.message}`);
          }
        }
      }
    } catch (e) {
      // diary_entries 表可能不存在（旧版本）
      console.log('diary_entries table might not exist yet');
    }
    
    // 检查 commitments 表的新列
    try {
      const commitmentsTableInfo = await db.prepare('PRAGMA table_info(commitments)').all();
      const commitmentsColumns = (commitmentsTableInfo.results || []).map(col => col.name);
      
      const commitmentsNewColumns = [
        { name: 'relapse_count', type: 'INTEGER DEFAULT 0' },
        { name: 'last_relapse_date', type: 'DATETIME' },
        { name: 'reminder_enabled', type: 'BOOLEAN DEFAULT 0' },
        { name: 'reminder_time', type: 'TIME' }
      ];
      
      for (const col of commitmentsNewColumns) {
        if (!commitmentsColumns.includes(col.name)) {
          try {
            await db.prepare(`ALTER TABLE commitments ADD COLUMN ${col.name} ${col.type}`).run();
            console.log(`Added column: ${col.name} to commitments`);
          } catch (e) {
            console.log(`Column ${col.name} might already exist: ${e.message}`);
          }
        }
      }
    } catch (e) {
      console.log('commitments table check failed:', e.message);
    }
    
    // 创建成就相关表（P3成就系统）
    try {
      // 创建成就定义表
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS achievements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          description TEXT,
          icon TEXT,
          category TEXT DEFAULT 'task',
          condition_type TEXT NOT NULL,
          condition_value INTEGER DEFAULT 1,
          points INTEGER DEFAULT 10,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      console.log('Achievements table ready');
      
      // 创建用户成就记录表
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS user_achievements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          achievement_id INTEGER NOT NULL,
          unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
          UNIQUE(user_id, achievement_id)
        )
      `).run();
      console.log('User achievements table ready');
      
      // 插入预设成就（如果表为空）
      const achievementCount = await db.prepare('SELECT COUNT(*) as count FROM achievements').first();
      if (!achievementCount || achievementCount.count === 0) {
        const presetAchievements = [
          ['first_task', '初出茅庐', '完成第一个任务', '🎯', 'task', 'tasks_completed', 1, 10],
          ['task_10', '小有成就', '完成10个任务', '⭐', 'task', 'tasks_completed', 10, 50],
          ['task_50', '任务达人', '完成50个任务', '🏆', 'task', 'tasks_completed', 50, 100],
          ['task_100', '任务大师', '完成100个任务', '👑', 'task', 'tasks_completed', 100, 200],
          ['streak_3', '三连击', '连续3天完成任务', '🔥', 'streak', 'daily_tasks', 3, 30],
          ['streak_7', '一周坚持', '连续7天完成任务', '💪', 'streak', 'daily_tasks', 7, 70],
          ['streak_30', '月度之星', '连续30天完成任务', '🌟', 'streak', 'daily_tasks', 30, 300],
          ['diary_1', '日记新手', '写下第一篇日记', '📝', 'diary', 'diary_count', 1, 10],
          ['diary_10', '日记达人', '写下10篇日记', '📚', 'diary', 'diary_count', 10, 50],
          ['diary_30', '习惯养成', '写下30篇日记', '✍️', 'diary', 'diary_count', 30, 100],
          ['emotion_10', '情绪观察者', '记录10次情绪', '😊', 'emotion', 'emotion_count', 10, 30],
          ['emotion_50', '情绪大师', '记录50次情绪', '🧠', 'emotion', 'emotion_count', 50, 100],
          ['pomodoro_10', '番茄新手', '完成10个番茄钟', '🍅', 'pomodoro', 'pomodoro_completed', 10, 30],
          ['pomodoro_50', '专注达人', '完成50个番茄钟', '⏰', 'pomodoro', 'pomodoro_completed', 50, 100],
          ['micro_start_10', '微启动爱好者', '使用微启动10次', '🚀', 'micro_start', 'micro_start_count', 10, 30],
          ['commitment_1', '承诺新手', '创建第一个承诺', '🤝', 'commitment', 'commitment_count', 1, 10],
          ['early_bird', '早起鸟儿', '在早上6-9点完成任务', '🌅', 'special', 'early_task', 1, 20],
          ['night_owl', '夜猫子', '在晚上10-12点完成任务', '🦉', 'special', 'late_task', 1, 20],
          ['category_5', '全能选手', '在5个不同类别中完成任务', '🎨', 'special', 'category_count', 5, 50],
          ['perfectionist', '完美主义者', '连续10个任务都在截止日期前完成', '💎', 'special', 'on_time_rate', 90, 100]
        ];
        
        for (const ach of presetAchievements) {
          try {
            await db.prepare(
              `INSERT OR IGNORE INTO achievements (name, display_name, description, icon, category, condition_type, condition_value, points) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(...ach).run();
          } catch (e) {
            console.log('Achievement insert error:', e.message);
          }
        }
        console.log('Preset achievements inserted');
      }
    } catch (e) {
      console.log('Achievement tables creation failed:', e.message);
    }
    
    // 创建自定义CBT模板表（P3）
    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS cbt_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          template_type TEXT DEFAULT 'custom',
          fields JSON,
          is_public BOOLEAN DEFAULT 0,
          use_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `).run();
      console.log('CBT templates table ready');
    } catch (e) {
      console.log('CBT templates table creation failed:', e.message);
    }
    
    // 创建用户设置表（存储 OAuth token 等）
    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS user_settings (
          user_id INTEGER NOT NULL,
          key TEXT NOT NULL,
          value TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, key),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `).run();
      console.log('User settings table ready');
    } catch (e) {
      console.log('User settings table creation failed:', e.message);
    }
    
    // 周视图计划表
    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS weekly_plans (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT DEFAULT '',
          category TEXT DEFAULT 'custom',
          day_of_week INTEGER,
          start_time TEXT,
          end_time TEXT,
          priority INTEGER DEFAULT 3,
          status TEXT DEFAULT 'pending',
          color TEXT DEFAULT '#6366F1',
          week_start DATE,
          is_builtin INTEGER DEFAULT 0,
          sync_token TEXT DEFAULT '',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `).run();
      console.log('Weekly plans table ready');
    } catch (e) {
      console.log('Weekly plans table creation failed:', e.message);
    }
    
    // user_templates 表（周视图用户自定义模板）
    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS user_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT DEFAULT '',
          category TEXT DEFAULT 'custom',
          day_of_week INTEGER,
          start_time TEXT,
          end_time TEXT,
          priority INTEGER DEFAULT 3,
          color TEXT DEFAULT '#6366F1',
          sort_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `).run();
      console.log('User templates table ready');
    } catch (e) {
      console.log('User templates table creation failed:', e.message);
    }
    
    // tasks 表新增 source 列（若不存在）
    try {
      await db.prepare(`ALTER TABLE tasks ADD COLUMN source TEXT DEFAULT ''`).run();
      console.log('Tasks source column added');
    } catch (e) { /* 列已存在则忽略 */ }
    
    dbMigrated = true;
    console.log('Database migration completed');
  } catch (e) {
    console.error('Database migration failed:', e.message);
  }
}

// ========== 工具函数 ==========

async function signJWT(payload, secret) {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, data);
  // 修复: 使用 ArrayBuffer 转 base64，正确处理 UTF-8 多字节字符
  const base64Data = arrayBufferToBase64(data);
  const base64Sig = arrayBufferToBase64(signature);
  return `${base64Data}.${base64Sig}`;
}

async function verifyJWT(token, secret) {
  try {
    const [dataB64, sigB64] = token.split('.');
    if (!dataB64 || !sigB64) return null;
    // 修复: base64 直接转 Uint8Array，不再经过 TextEncoder
    const data = base64ToArrayBuffer(dataB64);
    const signature = base64ToArrayBuffer(sigB64);
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const valid = await crypto.subtle.verify('HMAC', key, signature, data);
    if (!valid) return null;
    return JSON.parse(new TextDecoder().decode(data));
  } catch (e) { return null; }
}

// ArrayBuffer 和 Base64 互转工具函数
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'zhouji-salt-v2-2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

function corsHeaders(origin, env = {}) {
  // 修复 BE-009: CORS 配置，支持多域名 + Cloudflare Pages 预览域名
  const allowedOrigins = [
    'https://zhouji-frontend.pages.dev',
    'https://zhouji.pages.dev',
    'http://localhost:8080',
    'http://localhost:3000'
  ];
  
  let allowedOrigin = 'https://zhouji-frontend.pages.dev'; // 默认
  
  // 支持 Cloudflare Pages 所有预览域名 *.pages.dev
  if (origin && origin.endsWith('.pages.dev')) {
    allowedOrigin = origin;
  }
  // 精确匹配白名单（覆盖上面的通用规则，确保已知域名优先）
  if (origin && allowedOrigins.includes(origin)) {
    allowedOrigin = origin;
  }
  // 安全修复：禁止动态允许任意来源，仅允许白名单中的域名
  
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

// 清除用户仪表盘 KV 缓存（在数据变更时调用）
async function clearDashCache(env, userId) {
  if (env.CACHE) {
    try { await env.CACHE.delete('dash_' + userId); } catch(e) { /* ignore */ }
  }
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

// 修改密码
router.post('/api/auth/change-password', async (req, env) => {
  try {
    const auth = await authMiddleware(req, env);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

    const { oldPassword, newPassword } = await req.json();
    if (!oldPassword || !newPassword) return jsonResponse({ error: '旧密码和新密码不能为空' }, 400);
    if (newPassword.length < 6) return jsonResponse({ error: '新密码至少6位' }, 400);

    const db = env.DB;
    const user = await db.prepare('SELECT id, password_hash FROM users WHERE id = ?')
      .bind(auth.userId).first();
    if (!user) return jsonResponse({ error: '用户不存在' }, 404);

    const oldHash = await hashPassword(oldPassword);
    if (oldHash !== user.password_hash) return jsonResponse({ error: '旧密码不正确' }, 400);

    const newHash = await hashPassword(newPassword);
    await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newHash, auth.userId).run();

    return jsonResponse({ success: true, message: '密码已修改，请重新登录' });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// 文件上传到 R2
router.post('/api/upload', async (req, env) => {
  try {
    const auth = await authMiddleware(req, env);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

    const { filename, content_type, data } = await req.json();
    if (!filename || !data) return jsonResponse({ error: '缺少文件信息' }, 400);
    
    // 限制文件大小：base64 解码后不超过 10MB
    const maxSize = 10 * 1024 * 1024; // 10MB
    const decodedSize = Math.ceil(data.length * 3 / 4);
    if (decodedSize > maxSize) {
      return jsonResponse({ error: '文件过大，最大支持 10MB' }, 413);
    }

    // 限制文件类型
    const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')).toLowerCase() : '';
    const allowedExts = ['.jpg','.jpeg','.png','.gif','.webp','.pdf','.doc','.docx','.xls','.xlsx','.txt','.md','.zip','.mp3','.mp4'];
    if (ext && !allowedExts.includes(ext)) {
      return jsonResponse({ error: `不支持的文件类型: ${ext}` }, 400);
    }
    const key = `diary/${auth.userId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;

    // 解码 base64 数据
    const binaryStr = atob(data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // 上传到 R2
    await env.ATTACHMENTS.put(key, bytes, {
      httpMetadata: { contentType: content_type || 'application/octet-stream' }
    });

    // 生成公开访问 URL（从请求 URL 动态获取）
    const backendOrigin = new URL(req.url).origin;
    const url = `${backendOrigin}/api/attachments/${key}`;

    return jsonResponse({ success: true, url, key });
  } catch (e) {
    return jsonResponse({ error: '上传失败', detail: e.message }, 500);
  }
});

// 提供 R2 文件访问
router.get('/api/attachments/:key+', async (req, env) => {
  const key = req.params.key;
  const object = await env.ATTACHMENTS.get(key);
  if (!object) return new Response('Not Found', { status: 404 });

  const headers = new Headers();
  object.httpMetadata && headers.set('content-type', object.httpMetadata.contentType);
  headers.set('cache-control', 'public, max-age=31536000');
  return new Response(object.body, { headers });
});

// ========== 网易云音乐搜索 ==========
router.get('/api/music/search', async (req, env) => {
  const url = new URL(req.url);
  const keyword = url.searchParams.get('keyword');
  if (!keyword || keyword.length < 1) {
    return jsonResponse({ error: '请输入搜索关键词' }, 400);
  }
  
  try {
    const searchUrl = `https://music.163.com/api/search/get?s=${encodeURIComponent(keyword)}&type=1&limit=20&offset=0`;
    const resp = await fetch(searchUrl, {
      headers: {
        'Referer': 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': 'appver=2.0.2'
      }
    });
    const data = await resp.json();
    
    // 格式化返回结果
    const songs = (data.result?.songs || []).map(s => ({
      id: s.id,
      name: s.name,
      artists: (s.artists || []).map(a => a.name).join(' / '),
      album: s.album?.name || '',
      duration: s.duration || 0,
      // NetEase 外链播放器 URL
      embedUrl: `https://music.163.com/outchain/player?type=2&id=${s.id}&auto=0&height=66`
    }));
    
    return jsonResponse({ success: true, songs, total: data.result?.songCount || 0 });
  } catch (e) {
    return jsonResponse({ error: '搜索失败', detail: e.message }, 500);
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
    const { title, description, category, difficulty, priority, due_date } = await req.json();
    const cleanTitle = sanitize(title, 200);
    if (!cleanTitle || cleanTitle.length < 1) return jsonResponse({ error: '任务标题不能为空', success: false }, 400);
    if (cleanTitle.length > 200) return jsonResponse({ error: '任务标题不能超过200字符', success: false }, 400);
    var cleanDesc = sanitize(description, 1000);
    var cleanCat = sanitize(category, 50) || 'general';
    var cleanDiff = sanitizeNumber(difficulty, 1, 5);
    var cleanPriority = sanitizeNumber(priority, 1, 5);
    var cleanDate = sanitizeDate(due_date);

    const db = env.DB;
    const result = await db.prepare(
      `INSERT INTO tasks (user_id, title, description, category, difficulty, priority, due_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).bind(auth.userId, cleanTitle, cleanDesc, cleanCat, cleanDiff, cleanPriority, cleanDate).run();

    const taskId = getLastRowId(result);
    await updateDailyStat(db, auth.userId, 'tasks_created');
    await clearDashCache(env, auth.userId);

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
    const { title, description, status, difficulty, priority, due_date } = await req.json();

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
    if (priority !== undefined) { updates.push('priority = ?'); bindings.push(Math.min(5, Math.max(1, parseInt(priority) || 3))); }
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
    await clearDashCache(env, auth.userId);

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
    const { emotion_type, energy_level, trigger_task, cbt_response, intensity, trigger_factor, thought, activity } = await req.json();
    var validEmotions = ['vague', 'fear', 'boring', 'distracted', 'tired', 'anxious', 'confident', 'calm', 'excited', 'frustrated', 'overwhelmed', 'hopeful'];
    if (!emotion_type || !validEmotions.includes(emotion_type)) {
      return jsonResponse({ error: '情绪类型无效', success: false }, 400);
    }

    const db = env.DB;
    const result = await db.prepare(
      `INSERT INTO emotions (user_id, emotion_type, energy_level, trigger_task, cbt_response, intensity, trigger_factor, thought, activity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(auth.userId, 
           sanitize(emotion_type), 
           Math.min(5, Math.max(1, parseInt(energy_level) || 3)),
           sanitize(trigger_task),
           sanitize(cbt_response, 1000),
           Math.min(10, Math.max(1, parseInt(intensity) || 5)),
           sanitize(trigger_factor, 200),
           sanitize(thought, 500),
           sanitize(activity, 200)
    ).run();

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
    await clearDashCache(env, auth.userId);

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
      `SELECT ms.*, t.title as task_title, t.due_date as task_due_date, t.description as task_desc, s.title as step_title 
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
    const { task_id, description, witness_type, witness_contact, deadline, reminder_enabled, reminder_time } = await req.json();
    const cleanDesc = sanitize(description);
    if (!cleanDesc) return jsonResponse({ error: '承诺描述不能为空' }, 400);

    const db = env.DB;
    const result = await db.prepare(
      `INSERT INTO commitments (user_id, task_id, description, witness_type, witness_contact, deadline, reminder_enabled, reminder_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(auth.userId, task_id || null, cleanDesc, sanitize(witness_type) || 'self',
           sanitize(witness_contact), deadline || null, 
           reminder_enabled ? 1 : 0, reminder_time || null).run();

    return jsonResponse({ success: true, commitmentId: getLastRowId(result) });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// 记录破戒
router.post('/api/commitments/:id/relapse', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const commitmentId = req.params.id;
    const db = env.DB;
    
    const existing = await db.prepare('SELECT * FROM commitments WHERE id = ? AND user_id = ?')
      .bind(commitmentId, auth.userId).first();
    if (!existing) return jsonResponse({ error: '承诺不存在' }, 404);
    
    const newRelapseCount = (existing.relapse_count || 0) + 1;
    
    await db.prepare(
      `UPDATE commitments SET relapse_count = ?, last_relapse_date = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`
    ).bind(newRelapseCount, commitmentId, auth.userId).run();
    
    return jsonResponse({ success: true, relapseCount: newRelapseCount });
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
    const { completed, description, reminder_enabled, reminder_time } = await req.json();
    const db = env.DB;
    const updates = [];
    const bindings = [];
    if (completed !== undefined) { updates.push('completed = ?'); bindings.push(completed ? 1 : 0); }
    if (description !== undefined) { updates.push('description = ?'); bindings.push(sanitize(description)); }
    if (reminder_enabled !== undefined) { updates.push('reminder_enabled = ?'); bindings.push(reminder_enabled ? 1 : 0); }
    if (reminder_time !== undefined) { updates.push('reminder_time = ?'); bindings.push(reminder_time || null); }
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
    await clearDashCache(env, auth.userId);
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
      `SELECT p.*, t.title as task_title, t.due_date as task_due_date, t.description as task_desc, s.title as step_title
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
    const cacheKey = 'dash_' + userId;
    
    // KV 缓存：30秒有效，加 ?fresh=1 跳过缓存
    var url = new URL(req.url);
    if (env.CACHE && url.searchParams.get('fresh') !== '1') {
      try {
        var cached = await env.CACHE.get(cacheKey, 'json');
        if (cached) return jsonResponse(cached);
      } catch (e) { /* 缓存miss则正常查询 */ }
    }

    // 并行查询所有仪表盘数据
    const [todayStats, pendingTasks, todayBlocks, recentEmotion, weeklyStatsResult, weeklyEmotionsResult, todayPomoResult, upcomingTasksResult] = await Promise.all([
      db.prepare('SELECT * FROM daily_stats WHERE user_id = ? AND stat_date = ?').bind(userId, today).first(),
      db.prepare(`SELECT * FROM tasks WHERE user_id = ? AND status IN ('pending', 'in_progress') ORDER BY difficulty ASC, created_at DESC LIMIT 5`).bind(userId).all(),
      db.prepare(`SELECT tb.*, t.title as task_title, t.status as task_status FROM time_blocks tb LEFT JOIN tasks t ON tb.task_id = t.id WHERE tb.user_id = ? AND tb.block_date = ? ORDER BY tb.start_time`).bind(userId, today).all(),
      db.prepare('SELECT * FROM emotions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(userId).first(),
      db.prepare(`SELECT stat_date, tasks_created, tasks_started, tasks_completed, micro_starts_count, procrastination_count, pomodoro_count FROM daily_stats WHERE user_id = ? AND stat_date >= date('now', '-7 days') ORDER BY stat_date`).bind(userId).all(),
      db.prepare(`SELECT date(created_at) as emotion_date, emotion_type, COUNT(*) as count FROM emotions WHERE user_id = ? AND date(created_at) >= date('now', '-7 days') GROUP BY emotion_date, emotion_type ORDER BY emotion_date`).bind(userId).all(),
      db.prepare(`SELECT COUNT(*) as count, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed FROM pomodoro_sessions WHERE user_id = ? AND date(created_at) = ?`).bind(userId, today).first(),
      db.prepare(`SELECT * FROM tasks WHERE user_id = ? AND status != 'completed' AND due_date IS NOT NULL AND (due_date <= date('now', '+3 days')) ORDER BY due_date ASC LIMIT 10`).bind(userId).all()
    ]);
    
    // 合并情绪数据到周统计
    const weeklyStatsWithEmotions = (weeklyStatsResult.results || []).map(stat => {
      const dayEmotions = (weeklyEmotionsResult.results || []).filter(e => e.emotion_date === stat.stat_date);
      const topEmotion = dayEmotions.sort((a, b) => b.count - a.count)[0];
      return { ...stat, emotion_type: topEmotion ? topEmotion.emotion_type : null };
    });
    
    // 数据可视化需要的数据（每个表单独容错）
    const safeQuery = async (table) => {
      try {
        const r = await db.prepare(`SELECT * FROM ${table} WHERE user_id = ? ORDER BY created_at DESC`).bind(userId).all();
        return r.results || [];
      } catch (e) {
        console.error(`表 ${table} 查询失败:`, e.message);
        return [];
      }
    };
    
    const allTasks = await safeQuery('tasks');
    const allEmotions = await safeQuery('emotions');
    const allCommitments = await safeQuery('commitments');
    const allDiary = await safeQuery('diary_entries');
    const allMicroStarts = await safeQuery('micro_starts');
    const allPomodoro = await safeQuery('pomodoro_sessions');
    
    var respData = {
      success: true,
      todayStats: todayStats || { tasks_created: 0, tasks_started: 0, tasks_completed: 0, micro_starts_count: 0, procrastination_count: 0, pomodoro_count: 0 },
      pendingTasks: pendingTasks.results || [],
      todayBlocks: todayBlocks.results || [],
      recentEmotion,
      weeklyStats: weeklyStatsWithEmotions || [],
      todayPomodoro: todayPomoResult || { count: 0, completed: 0 },
      upcomingTasks: upcomingTasksResult.results || [],
      tasks: allTasks,
      emotions: allEmotions,
      commitments: allCommitments,
      diary: allDiary,
      microStarts: allMicroStarts,
      pomodoro: allPomodoro
    };
    
    // 写入 KV 缓存（30秒过期）
    if (env.CACHE) {
      try { await env.CACHE.put(cacheKey, JSON.stringify(respData), { expirationTtl: 30 }); } catch(e) { /* 缓存写入失败不影响返回 */ }
    }
    
    return jsonResponse(respData);
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// ========== 数据备份到 R2 ==========
router.post('/api/backup', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);
  try {
    const db = env.DB; const uid = auth.userId;
    const sq = async t => { try { const r = await db.prepare(`SELECT * FROM ${t} WHERE user_id = ?`).bind(uid).all(); return r.results||[]; }catch(e){return[];} };
    const data = { tasks: await sq('tasks'), diary: await sq('diary'), emotions: await sq('emotions'), commitments: await sq('commitments'), microStarts: await sq('micro_starts'), taskSteps: await sq('task_steps'), procrastination: await sq('procrastination_logs'), pomodoro: await sq('pomodoro_sessions'), timeBlocks: await sq('time_blocks'), dailyStats: await sq('daily_stats'), weeklyPlans: await sq('weekly_plans'), backupDate: new Date().toISOString(), userId: uid };
    const key = `backup/${uid}/${Date.now()}.json`;
    await env.ATTACHMENTS.put(key, JSON.stringify(data,null,2), { httpMetadata: { contentType: 'application/json' } });
    return jsonResponse({ success: true, key, size: JSON.stringify(data).length, date: data.backupDate });
  } catch(e) { return jsonResponse({ error:'备份失败',detail:e.message },500); }
});
router.get('/api/backup/list', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);
  try {
    const objs = await env.ATTACHMENTS.list({ prefix: `backup/${auth.userId}/` });
    const b = (objs.objects||[]).map(o => ({ key:o.key, size:o.size, uploaded:o.uploaded })).sort((a,b)=>new Date(b.uploaded)-new Date(a.uploaded));
    return jsonResponse({ success: true, backups: b });
  } catch(e) { return jsonResponse({ error:'获取列表失败',detail:e.message },500); }
});

// ========== 百度网盘备份 ==========
const BAIDU_TOKEN_URL = 'https://openapi.baidu.com/oauth/2.0/token';
const BAIDU_UPLOAD_URL = 'https://d.pcs.baidu.com/rest/2.0/pcs/file';

// 获取百度回调地址（环境变量优先）
function getBaiduRedirectUri(env) {
  return env.BAIDU_REDIRECT_URI || 'https://zhouji-api.wo1203656818.workers.dev/api/cloud-drive/baidu/callback';
}

// 获取百度 OAuth 授权 URL
// 获取百度网盘配置状态（全局/用户）
router.get('/api/cloud-drive/baidu/config-status', async (req, env) => {
  // 检查是否有全局配置（不需要登录就能检测）
  const hasGlobalConfig = !!(env.BAIDU_APP_KEY && env.BAIDU_SECRET_KEY);
  
  let hasUserConfig = false;
  let usingGlobal = hasGlobalConfig;
  
  // 如果用户已登录，检查用户是否有自己的配置
  const auth = await authMiddleware(req, env);
  if (!auth.error && auth.userId) {
    const userPrefs = await env.DB.prepare(
      'SELECT value FROM user_settings WHERE user_id = ? AND key = ?'
    ).bind(auth.userId, 'baidu_prefs').first();
    hasUserConfig = !!userPrefs;
    usingGlobal = hasGlobalConfig && !userPrefs;
  }
  
  return jsonResponse({
    success: true,
    hasGlobalConfig,
    hasUserConfig,
    usingGlobal
  });
});

// 获取百度网盘授权URL
router.get('/api/cloud-drive/baidu/auth-url', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);
  try {
    const { searchParams } = new URL(req.url);
    
    // 优先使用全局配置（环境变量）
    let appKey = env.BAIDU_APP_KEY;
    let secretKey = env.BAIDU_SECRET_KEY;
    
    // 如果没有全局配置，使用用户传入的配置
    if (!appKey || !secretKey) {
      appKey = searchParams.get('app_key');
      secretKey = searchParams.get('secret_key');
      if (!appKey) return jsonResponse({ error: '缺少 app_key' }, 400);
      if (!secretKey) return jsonResponse({ error: '缺少 secret_key' }, 400);
    }
    
    // 优先使用环境变量中的回调地址，否则用 Workers 地址动态生成
    const redirectUri = env.BAIDU_REDIRECT_URI || `https://zhouji-api.wo1203656818.workers.dev/api/cloud-drive/baidu/callback`;
    
    // 后端生成完整的 state（含 userId、appKey、secretKey）
    const state = btoa(JSON.stringify({
      userId: auth.userId,
      appKey: appKey,
      secretKey: secretKey
    }));
    
    // 构建 OAuth 授权 URL（让百度带上 state 返回，包含前端域名）
    const frontendDomain = searchParams.get('frontend') || (env.FRONTEND_URL || 'https://zhouji-frontend.pages.dev');
    const stateWithDomain = `${state}|${frontendDomain}`;
    const authUrl = `https://openapi.baidu.com/oauth/2.0/authorize?response_type=code&client_id=${appKey}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=basic,netdisk&display=popup&state=${encodeURIComponent(stateWithDomain)}`;
    
    return jsonResponse({ success: true, url: authUrl, redirect_uri: redirectUri });
  } catch(e) { return jsonResponse({ error: e.message }, 500); }
});

// 百度 OAuth 回调（接收 code，换 token）
router.get('/api/cloud-drive/baidu/callback', async (req, env) => {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // base64 加密的 userId + appKey + secretKey
  if (!code || !state) return new Response('参数缺失', { status: 400 });
  
  try {
    // 解析格式: base64State|frontendDomain
    const stateParts = decodeURIComponent(state).split('|');
    const base64State = stateParts[0];
    const frontendDomain = stateParts[1] || (env.FRONTEND_URL || 'https://zhouji-frontend.pages.dev');
    
    const decoded = JSON.parse(atob(base64State));
    const { userId, appKey, secretKey } = decoded;
    if (!userId || !appKey || !secretKey) return new Response('state 参数无效', { status: 400 });
    
    const redirectUri = getBaiduRedirectUri(env);
    const tokenResp = await fetch(BAIDU_TOKEN_URL + '?' + new URLSearchParams({
      grant_type: 'authorization_code', code, client_id: appKey,
      client_secret: secretKey, redirect_uri: redirectUri
    }), { method: 'POST' });
    
    const tokenData = await tokenResp.json();
    if (!tokenData.access_token) return new Response('获取 token 失败: ' + JSON.stringify(tokenData), { status: 400 });
    
    // 保存 token 到数据库
    const db = env.DB;
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 2592000) * 1000).toISOString();
    await db.prepare(
      'INSERT OR REPLACE INTO user_settings (user_id, key, value) VALUES (?, ?, ?)'
    ).bind(userId, 'baidu_token', JSON.stringify({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt,
      app_key: appKey,
      secret_key: secretKey
    })).run();
    
    // 重定向回正确的前端域名（从state中解析）
    return new Response(`<script>window.location.href='${frontendDomain}/#/settings?baidu_connected=1'</script>`, {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch(e) {
    return new Response('认证失败: ' + e.message, { status: 500 });
  }
});

// 检查百度网盘连接状态
router.get('/api/cloud-drive/baidu/status', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);
  try {
    const db = env.DB;
    const row = await db.prepare('SELECT value FROM user_settings WHERE user_id = ? AND key = ?').bind(auth.userId, 'baidu_token').first();
    if (!row) return jsonResponse({ connected: false });
    const token = JSON.parse(row.value);
    const expired = new Date(token.expires_at) < new Date();
    return jsonResponse({ connected: true, expired, expires_at: token.expires_at });
  } catch(e) { return jsonResponse({ error: e.message }, 500); }
});

// 百度网盘创建目录
async function baiduMkdir(accessToken, path) {
  try {
    const resp = await fetch(`https://pcs.baidu.com/rest/2.0/pcs/file?method=mkdir&path=${encodeURIComponent(path)}&access_token=${accessToken}`, { method: 'POST' });
    return await resp.json();
  } catch (e) {
    return { error_code: -1, error_msg: e.message };
  }
}

// 百度网盘上传单个文件
async function baiduUpload(accessToken, filePath, fileName, content, mimeType) {
  const form = new FormData();
  form.append('file', new Blob([content], { type: mimeType }), fileName);
  const resp = await fetch(`${BAIDU_UPLOAD_URL}?method=upload&access_token=${accessToken}&path=${encodeURIComponent(filePath + fileName)}&ondup=overwrite`, {
    method: 'POST', body: form
  });
  return await resp.json();
}

// 上传备份到百度网盘
router.post('/api/cloud-drive/baidu/backup', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);
  try {
    const db = env.DB;
    const row = await db.prepare('SELECT value FROM user_settings WHERE user_id = ? AND key = ?').bind(auth.userId, 'baidu_token').first();
    if (!row) return jsonResponse({ error: '未连接百度网盘，请先在设置中授权' }, 401);
    
    const tokenData = JSON.parse(row.value);
    let accessToken = tokenData.access_token;
    
    // 检查 token 是否过期
    if (new Date(tokenData.expires_at) < new Date()) {
      const refreshResp = await fetch(BAIDU_TOKEN_URL + '?' + new URLSearchParams({
        grant_type: 'refresh_token', refresh_token: tokenData.refresh_token,
        client_id: tokenData.app_key, client_secret: tokenData.secret_key
      }), { method: 'POST' });
      const refreshData = await refreshResp.json();
      if (!refreshData.access_token) return jsonResponse({ error: 'Token 刷新失败，请重新授权' }, 401);
      accessToken = refreshData.access_token;
      const newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 2592000) * 1000).toISOString();
      await db.prepare(
        'UPDATE user_settings SET value = ? WHERE user_id = ? AND key = ?'
      ).bind(JSON.stringify({
        ...tokenData, access_token: accessToken,
        refresh_token: refreshData.refresh_token || tokenData.refresh_token,
        expires_at: newExpiresAt
      }), auth.userId, 'baidu_token').run();
    }
    
    // ========== 解析可选日期参数 ==========
    let dateFrom = '', dateTo = '';
    try {
      const body = await req.json();
      dateFrom = body.dateFrom || '';
      dateTo = body.dateTo || '';
    } catch(e) { /* 无 body 或非 JSON 格式，使用默认值 */ }
    const hasDateFilter = dateFrom && dateTo;
    
    // ========== 查询所有数据 ==========
    const userId = auth.userId;
    const safeQuery = async (table, columns = '*', dateColumn = 'created_at') => {
      try {
        let sql = `SELECT ${columns} FROM ${table} WHERE user_id = ?`;
        const params = [userId];
        if (hasDateFilter) {
          sql += ` AND ${dateColumn} >= ? AND ${dateColumn} <= ?`;
          params.push(dateFrom + 'T00:00:00', dateTo + 'T23:59:59');
        }
        const result = await db.prepare(sql).bind(...params).all();
        return result.results || [];
      } catch (e) { return []; }
    };

    const [tasks, steps, emotions, microStarts, logs, commitments, timeBlocks, stats, pomodoro, diary, diaryMedia] = await Promise.all([
      safeQuery('tasks'),
      safeQuery('task_steps'),
      safeQuery('emotions'),
      safeQuery('micro_starts'),
      safeQuery('procrastination_logs'),
      safeQuery('commitments'),
      safeQuery('time_blocks'),
      safeQuery('daily_stats'),
      safeQuery('pomodoro_sessions'),
      safeQuery('diary_entries'),
      safeQuery('diary_media'),
    ]);

    const dateStr = new Date().toISOString().split('T')[0];
    const label = hasDateFilter ? `${dateFrom}_至_${dateTo}` : dateStr;
    const rootFolder = `/apps/周迹备份/`;
    const backupDir = `备份_${label}/`;
    const fullPath = rootFolder + backupDir;
    
    // 创建文件夹结构
    const subDirs = ['任务与计划', '日记与成长', '时间管理', '媒体文件'];
    await baiduMkdir(accessToken, fullPath);
    for (const dir of subDirs) {
      await baiduMkdir(accessToken, fullPath + dir + '/');
    }
    
    // ========== 数据分类 ==========
    const dataSets = {
      '任务与计划': [
        { name: '01_任务清单.json', data: tasks },
        { name: '02_任务步骤.json', data: steps },
        { name: '03_承诺书.json', data: commitments },
        { name: '04_微启动记录.json', data: microStarts },
      ],
      '日记与成长': [
        { name: '01_日记.json', data: diary },
        { name: '02_情绪记录.json', data: emotions },
        { name: '03_拖延日志.json', data: logs },
      ],
      '时间管理': [
        { name: '01_番茄钟记录.json', data: pomodoro },
        { name: '02_每日统计.json', data: stats },
        { name: '03_时间块.json', data: timeBlocks },
      ],
      '媒体文件': [
        { name: '附件清单.json', data: diaryMedia.map(m => ({
          id: m.id, diaryId: m.diary_id, fileName: m.file_name,
          fileUrl: m.file_url, fileType: m.file_type,
          createdAt: m.created_at
        })) },
      ],
    };
    
    // 上传按类型拆分的数据文件
    let uploadedCount = 0;
    for (const [dir, files] of Object.entries(dataSets)) {
      for (const file of files) {
        const jsonStr = JSON.stringify({ exportDate: new Date().toISOString(), type: file.name.replace('.json', ''), count: file.data.length, data: file.data }, null, 2);
        const result = await baiduUpload(accessToken, fullPath + dir + '/', file.name, jsonStr, 'application/json');
        if (!result.error_code) uploadedCount++;
      }
    }
    
    // ========== 生成 README 说明文件 ==========
    const totalItems = tasks.length + diary.length + emotions.length + microStarts.length + pomodoro.length + stats.length + commitments.length + logs.length + timeBlocks.length + steps.length;
    const readmeContent = `╔══════════════════════════════════════════╗
║       周迹 - 数据备份说明              ║
╚══════════════════════════════════════════╝

备份时间: ${new Date().toLocaleString('zh-CN')}
数据范围: ${hasDateFilter ? `${dateFrom} ~ ${dateTo}` : '全量数据'}
数据条数: ${totalItems} 条记录
附件数量: ${diaryMedia.length} 个媒体文件

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📂 目录结构说明
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 任务与计划/
├── 01_任务清单.json        - ${tasks.length} 条任务
├── 02_任务步骤.json        - ${steps.length} 条步骤
├── 03_承诺书.json          - ${commitments.length} 条承诺
└── 04_微启动记录.json      - ${microStarts.length} 条微启动记录

📁 日记与成长/
├── 01_日记.json            - ${diary.length} 篇日记
├── 02_情绪记录.json        - ${emotions.length} 条情绪记录
└── 03_拖延日志.json        - ${logs.length} 条拖延记录

📁 时间管理/
├── 01_番茄钟记录.json      - ${pomodoro.length} 个番茄钟
├── 02_每日统计.json        - ${stats.length} 天统计数据
└── 03_时间块.json          - ${timeBlocks.length} 个时间块

📁 媒体文件/
├── 附件清单.json           - ${diaryMedia.length} 个附件元信息
└── (原始附件文件)

📦 全量数据包.json          - 完整可导入的备份数据

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 恢复说明
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

要将此备份恢复到周迹应用：
1. 下载 "全量数据包.json"
2. 在周迹应用的"设置 → 导入数据"中选择该文件
3. 系统会自动解析并导入所有数据

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 注意事项
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 此备份由周迹应用自动生成
• 单个 JSON 文件可直接在浏览器或编辑器中查看
• 附件文件需要配合 "全量数据包.json" 中的路径引用才能恢复
`;
    await baiduUpload(accessToken, fullPath, '📖_备份说明.txt', readmeContent, 'text/plain; charset=utf-8');
    
    // ========== 全量数据包（用于恢复导入）==========
    const fullBackup = {
      exportDate: new Date().toISOString(),
      version: '2.2.0',
      label: hasDateFilter ? `${dateFrom} ~ ${dateTo}` : '全量备份',
      data: {
        tasks, taskSteps: steps, emotions, microStarts,
        procrastinationLogs: logs, commitments, timeBlocks,
        dailyStats: stats, pomodoroSessions: pomodoro,
        diary, diaryMedia
      }
    };
    await baiduUpload(accessToken, fullPath, '📦_全量数据包.json', JSON.stringify(fullBackup, null, 2), 'application/json');
    
    // ========== 备份原始附件到媒体文件目录 ==========
    let attachmentSuccess = 0;
    for (const media of diaryMedia) {
      try {
        // file_url 可能是完整URL或R2 key，提取key部分
        const r2Key = media.file_url?.includes('/api/attachments/') 
          ? media.file_url.split('/api/attachments/')[1] 
          : media.file_url;
        if (!r2Key) continue;
        
        const obj = await env.ATTACHMENTS.get(r2Key);
        if (obj) {
          const fileBuffer = await obj.arrayBuffer();
          const ext = (media.file_name || 'file').split('.').pop().toLowerCase();
          const mimeTypes = {
            jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
            gif: 'image/gif', webp: 'image/webp',
            pdf: 'application/pdf', doc: 'application/msword',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            txt: 'text/plain', md: 'text/markdown',
            zip: 'application/zip', rar: 'application/x-rar-compressed'
          };
          const mimeType = mimeTypes[ext] || 'application/octet-stream';
          const result = await baiduUpload(accessToken, fullPath + '媒体文件/', media.file_name, fileBuffer, mimeType);
          if (!result.error_code) attachmentSuccess++;
        }
      } catch (e) {
        console.error('备份附件失败:', media.file_name, e.message);
      }
    }
    
    return jsonResponse({
      success: true,
      summary: {
        date: label,
        folder: fullPath,
        dataFiles: uploadedCount,
        dataItems: totalItems,
        attachments: attachmentSuccess,
        attachmentTotal: diaryMedia.length
      },
      message: `✅ 备份完成！${uploadedCount} 个数据文件 + ${attachmentSuccess}/${diaryMedia.length} 个附件 → ${backupDir}`,
      structure: {
        root: backupDir,
        subdirs: subDirs,
        fullDataFile: '📦_全量数据包.json',
        readme: '📖_备份说明.txt'
      }
    });
  } catch(e) {
    return jsonResponse({ error: '备份失败: ' + e.message }, 500);
  }
});

// 检查百度网盘全局配置状态
router.get('/api/cloud-drive/baidu/config-status', async (req, env) => {
  const hasGlobalConfig = !!(env.BAIDU_APP_KEY && env.BAIDU_SECRET_KEY);
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ hasGlobalConfig, error: auth.error }, auth.status);
  try {
    const db = env.DB;
    const row = await db.prepare('SELECT value FROM user_settings WHERE user_id = ? AND key = ?').bind(auth.userId, 'baidu_token').first();
    const hasUserConfig = !!row;
    // 检查用户是否手动填写了配置（如果全局配置已存在，用户也填了则使用用户的）
    const prefsBody = req.body || {};
    return jsonResponse({ hasGlobalConfig, hasUserConfig });
  } catch(e) { return jsonResponse({ hasGlobalConfig, hasUserConfig: false }); }
});

// 断开百度网盘连接
router.post('/api/cloud-drive/baidu/disconnect', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);
  try {
    await env.DB.prepare('DELETE FROM user_settings WHERE user_id = ? AND key = ?').bind(auth.userId, 'baidu_token').run();
    return jsonResponse({ success: true });
  } catch(e) { return jsonResponse({ error: e.message }, 500); }
});

// ========== 导出/导入 ==========

router.get('/api/export', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const userId = auth.userId;
    
    // 支持日期筛选（从export前端传递）
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const hasDateFilter = startDate && endDate;

    // 逐个查询，忽略不存在的表
    const safeQuery = async (table, columns = '*', dateColumn = 'created_at') => {
      try {
        let sql = `SELECT ${columns} FROM ${table} WHERE user_id = ?`;
        const params = [userId];
        if (hasDateFilter) {
          sql += ` AND ${dateColumn} >= ? AND ${dateColumn} <= ?`;
          params.push(startDate + 'T00:00:00', endDate + 'T23:59:59');
        }
        const result = await db.prepare(sql).bind(...params).all();
        return result.results || [];
      } catch (e) {
        console.error(`表 ${table} 查询失败:`, e.message);
        return [];
      }
    };

    const [tasks, steps, emotions, microStarts, logs, commitments, timeBlocks, stats, pomodoro, diary, diaryMedia, weeklyPlans] = await Promise.all([
      safeQuery('tasks'),
      safeQuery('task_steps'),
      safeQuery('emotions'),
      safeQuery('micro_starts'),
      safeQuery('procrastination_logs'),
      safeQuery('commitments'),
      safeQuery('time_blocks'),
      safeQuery('daily_stats'),
      safeQuery('pomodoro_sessions'),
      safeQuery('diary_entries'),
      safeQuery('diary_media'),
      safeQuery('weekly_plans'),
    ]);

    return jsonResponse({
      success: true,
      exportDate: new Date().toISOString(),
      data: {
        tasks: tasks,
        diary: diary,
        taskSteps: steps,
        emotions: emotions,
        microStarts: microStarts,
        procrastination: logs,
        commitments: commitments,
        timeBlocks: timeBlocks,
        dailyStats: stats,
        pomodoro: pomodoro,
        diaryMedia: diaryMedia,
        weeklyPlans: weeklyPlans
      }
    });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// ========== 统计API（P3数据可视化）==========

// 获取任务完成趋势（过去30天）
router.get('/api/stats/task-trend', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const userId = auth.userId;
    const days = 30;
    
    const { results } = await db.prepare(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM tasks 
       WHERE user_id = ? AND created_at >= DATE('now', '-${days} days')
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    ).bind(userId).all();
    
    return jsonResponse({ success: true, trend: results });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// 获取情绪变化曲线
router.get('/api/stats/emotion-trend', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const userId = auth.userId;
    
    const { results } = await db.prepare(
      `SELECT 
        DATE(created_at) as date,
        AVG(energy_level) as avg_energy,
        COUNT(*) as count
       FROM emotions 
       WHERE user_id = ? AND created_at >= DATE('now', '-30 days')
       GROUP BY DATE(created_at)
       ORDER BY date ASC
       LIMIT 30`
    ).bind(userId).all();
    
    return jsonResponse({ success: true, trend: results });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// 获取习惯养成热力图数据
router.get('/api/stats/habit-heatmap', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const userId = auth.userId;
    
    const { results } = await db.prepare(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as activities
       FROM (
         SELECT user_id, created_at FROM tasks WHERE user_id = ?
         UNION ALL
         SELECT user_id, created_at FROM emotions WHERE user_id = ?
         UNION ALL
         SELECT user_id, created_at FROM commitments WHERE user_id = ?
       )
       WHERE date >= DATE('now', '-90 days')
       GROUP BY DATE(date)
       ORDER BY date ASC`
    ).bind(userId, userId, userId).all();
    
    return jsonResponse({ success: true, heatmap: results });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// 获取拖延模式分析
router.get('/api/stats/procrastination-pattern', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const userId = auth.userId;
    
    const { results } = await db.prepare(
      `SELECT 
        reason_type,
        COUNT(*) as count,
        COUNT(DISTINCT DATE(created_at)) as days
       FROM procrastination_logs 
       WHERE user_id = ? AND created_at >= DATE('now', '-30 days')
       GROUP BY reason_type
       ORDER BY count DESC`
    ).bind(userId).all();
    
    return jsonResponse({ success: true, pattern: results });
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
    let imported = { tasks: 0, steps: 0, emotions: 0, microStarts: 0, logs: 0, commitments: 0, timeBlocks: 0, pomodoro: 0, diary: 0, media: 0, weeklyPlans: 0 };

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

    const logsData = data.procrastinationLogs || data.procrastination || [];
    if (logsData.length > 0) {
      for (const p of logsData) {
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

    if (data.diary && Array.isArray(data.diary)) {
      for (const d of data.diary) {
        try {
          await db.prepare(
            `INSERT INTO diary_entries (user_id, title, content, emotion, weather, tags, cbt_thought, cbt_emotion, cbt_behavior, cbt_reframe, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(userId, sanitize(d.title || ''), sanitize(d.content || ''), sanitize(d.emotion || ''),
                 sanitize(d.weather || ''), sanitize(d.tags || ''), sanitize(d.cbt_thought || ''),
                 sanitize(d.cbt_emotion || ''), sanitize(d.cbt_behavior || ''), sanitize(d.cbt_reframe || ''),
                 d.created_at || new Date().toISOString(), d.updated_at || new Date().toISOString()).run();
          imported.diary++;
        } catch (e) {}
      }
    }

    if (data.diaryMedia && Array.isArray(data.diaryMedia)) {
      for (const m of data.diaryMedia) {
        try {
          await db.prepare(
            `INSERT INTO diary_media (diary_id, user_id, file_name, file_url, file_type, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(m.diary_id || null, userId, sanitize(m.file_name || ''),
                 sanitize(m.file_url || ''), sanitize(m.file_type || ''),
                 m.created_at || new Date().toISOString()).run();
          imported.media++;
        } catch (e) {}
      }
    }

    if (data.weeklyPlans && Array.isArray(data.weeklyPlans)) {
      for (const w of data.weeklyPlans) {
        try {
          await db.prepare(
            `INSERT INTO weekly_plans (user_id, title, description, category, color, status, day_of_week, start_time, end_time, week_start, source, sync_token, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(userId, sanitize(w.title || ''), sanitize(w.description || ''), sanitize(w.category || ''),
                 sanitize(w.color || ''), w.status || 'pending', w.day_of_week, w.start_time || null, w.end_time || null,
                 w.week_start || null, sanitize(w.source || 'manual'), sanitize(w.sync_token || ''),
                 w.created_at || new Date().toISOString(), w.updated_at || new Date().toISOString()).run();
          imported.weeklyPlans++;
        } catch (e) {}
      }
    }

    return jsonResponse({ success: true, imported });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// ========== 用户数据管理API（P3）==========

// 删除用户所有数据
router.delete('/api/user/data', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const userId = auth.userId;

    // 删除所有关联数据
    const tables = [
      'user_achievements', 'diary_media', 'diary_entries', 'emotions',
      'procrastination_logs', 'commitments', 'time_blocks', 'pomodoro_sessions',
      'micro_starts', 'task_steps', 'tasks', 'daily_stats', 'cbt_templates', 'weekly_plans'
    ];

    for (const table of tables) {
      try {
        await db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).bind(userId).run();
      } catch (e) {
        // 表可能不存在
      }
    }

    return jsonResponse({ success: true, message: '所有数据已删除' });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// 保存用户偏好设置
router.post('/api/user/preferences', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const userId = auth.userId;
    const prefs = await req.json();

    // 创建或更新用户偏好（使用upsert）
    try {
      await db.prepare(
        `INSERT INTO user_preferences (user_id, preferences) VALUES (?, ?)
         ON CONFLICT(user_id) DO UPDATE SET preferences = ?, updated_at = CURRENT_TIMESTAMP`
      ).bind(userId, JSON.stringify(prefs), JSON.stringify(prefs)).run();
    } catch (e) {
      // 如果表不存在，尝试创建
      try {
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS user_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            preferences TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `).run();
        await db.prepare(
          'INSERT INTO user_preferences (user_id, preferences) VALUES (?, ?)'
        ).bind(userId, JSON.stringify(prefs)).run();
      } catch (e2) {
        console.error('Preferences save error:', e2.message);
      }
    }

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// ========== 成就系统API（P3）==========

// 获取所有成就列表
router.get('/api/achievements', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const userId = auth.userId;

    // 获取所有成就
    const { results: allAchievements } = await db.prepare(
      'SELECT * FROM achievements ORDER BY points ASC'
    ).all();

    // 获取用户已解锁的成就
    const { results: userAchievements } = await db.prepare(
      'SELECT achievement_id FROM user_achievements WHERE user_id = ?'
    ).bind(userId).all();

    const unlockedIds = new Set(userAchievements.map(ua => ua.achievement_id));

    // 合并数据
    const achievements = await Promise.all(allAchievements.map(async (ach) => ({
      ...ach,
      unlocked: unlockedIds.has(ach.id),
      progress: await calculateAchievementProgress(db, userId, ach) // 计算进度
    })));

    // 计算用户总分
    const userPointsResult = await db.prepare(
      `SELECT SUM(a.points) as total_points 
       FROM user_achievements ua 
       JOIN achievements a ON ua.achievement_id = a.id 
       WHERE ua.user_id = ?`
    ).bind(userId).first();

    const totalPoints = userPointsResult?.total_points || 0;
    const unlockedCount = userAchievements.length;
    const totalCount = allAchievements.length;

    return jsonResponse({
      success: true,
      achievements,
      summary: {
        totalPoints,
        unlockedCount,
        totalCount,
        completionRate: totalCount > 0 ? (unlockedCount / totalCount * 100).toFixed(1) : 0
      }
    });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// 辅助函数：计算成就进度
async function calculateAchievementProgress(db, userId, achievement) {
  try {
    const conditionType = achievement.condition_type;
    const conditionValue = achievement.condition_value;

    let currentValue = 0;

    switch (conditionType) {
      case 'tasks_completed':
        const taskResult = await db.prepare(
          'SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = "completed"'
        ).bind(userId).first();
        currentValue = taskResult?.count || 0;
        break;

      case 'diary_count':
        const diaryResult = await db.prepare(
          'SELECT COUNT(*) as count FROM diary_entries WHERE user_id = ?'
        ).bind(userId).first();
        currentValue = diaryResult?.count || 0;
        break;

      case 'emotion_count':
        const emotionResult = await db.prepare(
          'SELECT COUNT(*) as count FROM emotions WHERE user_id = ?'
        ).bind(userId).first();
        currentValue = emotionResult?.count || 0;
        break;

      case 'pomodoro_completed':
        const pomodoroResult = await db.prepare(
          'SELECT COUNT(*) as count FROM pomodoro_sessions WHERE user_id = ? AND completed = 1'
        ).bind(userId).first();
        currentValue = pomodoroResult?.count || 0;
        break;

      case 'micro_start_count':
        const microStartResult = await db.prepare(
          'SELECT COUNT(*) as count FROM micro_starts WHERE user_id = ?'
        ).bind(userId).first();
        currentValue = microStartResult?.count || 0;
        break;

      case 'commitment_count':
        const commitmentResult = await db.prepare(
          'SELECT COUNT(*) as count FROM commitments WHERE user_id = ?'
        ).bind(userId).first();
        currentValue = commitmentResult?.count || 0;
        break;

      case 'daily_tasks':
        // 计算连续完成任务天数
        const streakResult = await db.prepare(
          `SELECT stat_date FROM daily_stats 
           WHERE user_id = ? AND tasks_completed > 0 
           ORDER BY stat_date DESC`
        ).bind(userId).all();

        let streak = 0;
        let expectedDate = new Date();
        expectedDate.setDate(expectedDate.getDate() + 1); // 从明天开始检查

        for (const row of (streakResult.results || [])) {
          const rowDate = new Date(row.stat_date);
          expectedDate.setDate(expectedDate.getDate() - 1);

          if (rowDate.toISOString().split('T')[0] === expectedDate.toISOString().split('T')[0]) {
            streak++;
          } else {
            break;
          }
        }
        currentValue = streak;
        break;

      case 'category_count':
        const categoryResult = await db.prepare(
          'SELECT COUNT(DISTINCT category) as count FROM tasks WHERE user_id = ? AND status = "completed"'
        ).bind(userId).first();
        currentValue = categoryResult?.count || 0;
        break;

      case 'early_task':
        const earlyResult = await db.prepare(
          'SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = "completed" AND CAST(strftime("%H", updated_at) AS INTEGER) BETWEEN 6 AND 9'
        ).bind(userId).first();
        currentValue = earlyResult?.count || 0;
        break;

      case 'late_task':
        const lateResult = await db.prepare(
          'SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = "completed" AND CAST(strftime("%H", updated_at) AS INTEGER) BETWEEN 22 AND 23'
        ).bind(userId).first();
        currentValue = lateResult?.count || 0;
        break;

      case 'on_time_rate':
        const totalTasks = await db.prepare(
          'SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = "completed" AND due_date IS NOT NULL'
        ).bind(userId).first();
        const onTimeTasks = await db.prepare(
          'SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = "completed" AND due_date IS NOT NULL AND date(updated_at) <= due_date'
        ).bind(userId).first();

        if (totalTasks?.count > 0) {
          currentValue = Math.round((onTimeTasks?.count || 0) / totalTasks.count * 100);
        } else {
          currentValue = 0;
        }
        break;

      default:
        currentValue = 0;
    }

    return {
      current: currentValue,
      required: conditionValue,
      percentage: conditionValue > 0 ? Math.min(100, Math.round(currentValue / conditionValue * 100)) : 0
    };
  } catch (e) {
    console.error('Progress calculation error:', e);
    return { current: 0, required: achievement.condition_value, percentage: 0 };
  }
}

// 检查并解锁成就（内部函数，可被其他API调用）
async function checkAndUnlockAchievements(db, userId) {
  try {
    // 获取所有未解锁的成就
    const { results: allAchievements } = await db.prepare(
      `SELECT a.* FROM achievements a 
       WHERE a.id NOT IN (
         SELECT achievement_id FROM user_achievements WHERE user_id = ?
       )`,
    ).bind(userId).all();

    const newlyUnlocked = [];

    for (const achievement of (allAchievements || [])) {
      const progress = await calculateAchievementProgress(db, userId, achievement);

      if (progress.current >= achievement.condition_value) {
        // 解锁成就
        await db.prepare(
          'INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)'
        ).bind(userId, achievement.id).run();

        newlyUnlocked.push({
          name: achievement.display_name,
          description: achievement.description,
          icon: achievement.icon,
          points: achievement.points
        });
      }
    }

    return newlyUnlocked;
  } catch (e) {
    console.error('Achievement check error:', e);
    return [];
  }
}

// 手动触发成就检查
router.post('/api/achievements/check', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const newlyUnlocked = await checkAndUnlockAchievements(db, auth.userId);

    return jsonResponse({
      success: true,
      unlocked: newlyUnlocked,
      message: newlyUnlocked.length > 0 ? `恭喜！解锁了 ${newlyUnlocked.length} 个成就` : '暂无新成就解锁'
    });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// 获取用户成就统计
router.get('/api/achievements/stats', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const userId = auth.userId;

    const stats = await db.prepare(
      `SELECT 
         COUNT(ua.id) as unlocked_count,
         SUM(a.points) as total_points,
         MAX(ua.unlocked_at) as last_unlock
       FROM user_achievements ua
       JOIN achievements a ON ua.achievement_id = a.id
       WHERE ua.user_id = ?`
    ).bind(userId).first();

    const totalAchievements = await db.prepare('SELECT COUNT(*) as count FROM achievements').first();

    return jsonResponse({
      success: true,
      stats: {
        unlockedCount: stats?.unlocked_count || 0,
        totalPoints: stats?.total_points || 0,
        lastUnlock: stats?.last_unlock || null,
        totalAchievements: totalAchievements?.count || 0,
        completionRate: totalAchievements?.count > 0 ? 
          ((stats?.unlocked_count || 0) / totalAchievements.count * 100).toFixed(1) : 0
      }
    });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// ========== 周视图计划API（P4）==========

// 内置模板数据
const WEEKLY_BUILTIN_TEMPLATES = [
  // ⭐ 模板定义：每个模板分配 day_of_week，导入后直接出现在对应日期列中
  // day_of_week: 0=周日 1=周一 ... 6=周六
  { title: '晨间运动', description: '早起跑步、体能锻炼', category: 'morning', day_of_week: 1, start_time: '06:30', end_time: '07:30', priority: 4, color: '#10B981', is_builtin: 1 },
  { title: '晨间运动', description: '早起跑步、体能锻炼', category: 'morning', day_of_week: 2, start_time: '06:30', end_time: '07:30', priority: 4, color: '#10B981', is_builtin: 1 },
  { title: '晨间运动', description: '早起跑步、体能锻炼', category: 'morning', day_of_week: 3, start_time: '06:30', end_time: '07:30', priority: 4, color: '#10B981', is_builtin: 1 },
  { title: '晨间运动', description: '早起跑步、体能锻炼', category: 'morning', day_of_week: 4, start_time: '06:30', end_time: '07:30', priority: 4, color: '#10B981', is_builtin: 1 },
  { title: '晨间运动', description: '早起跑步、体能锻炼', category: 'morning', day_of_week: 5, start_time: '06:30', end_time: '07:30', priority: 4, color: '#10B981', is_builtin: 1 },
  { title: '创业主业', description: '上午拍摄创业短视频、项目运营', category: 'main_business', day_of_week: 1, start_time: '09:00', end_time: '12:00', priority: 5, color: '#6366F1', is_builtin: 1 },
  { title: '创业主业', description: '上午拍摄创业短视频、项目运营', category: 'main_business', day_of_week: 2, start_time: '09:00', end_time: '12:00', priority: 5, color: '#6366F1', is_builtin: 1 },
  { title: '创业主业', description: '上午拍摄创业短视频、项目运营', category: 'main_business', day_of_week: 3, start_time: '09:00', end_time: '12:00', priority: 5, color: '#6366F1', is_builtin: 1 },
  { title: '创业主业', description: '上午拍摄创业短视频、项目运营', category: 'main_business', day_of_week: 4, start_time: '09:00', end_time: '12:00', priority: 5, color: '#6366F1', is_builtin: 1 },
  { title: '创业主业', description: '上午拍摄创业短视频、项目运营', category: 'main_business', day_of_week: 5, start_time: '09:00', end_time: '12:00', priority: 5, color: '#6366F1', is_builtin: 1 },
  { title: '副业增收', description: '下午空闲时间开展兼职赚取额外收入', category: 'side_income', day_of_week: 1, start_time: '14:00', end_time: '17:00', priority: 3, color: '#F59E0B', is_builtin: 1 },
  { title: '副业增收', description: '下午空闲时间开展兼职赚取额外收入', category: 'side_income', day_of_week: 2, start_time: '14:00', end_time: '17:00', priority: 3, color: '#F59E0B', is_builtin: 1 },
  { title: '副业增收', description: '下午空闲时间开展兼职赚取额外收入', category: 'side_income', day_of_week: 3, start_time: '14:00', end_time: '17:00', priority: 3, color: '#F59E0B', is_builtin: 1 },
  { title: '副业增收', description: '下午空闲时间开展兼职赚取额外收入', category: 'side_income', day_of_week: 4, start_time: '14:00', end_time: '17:00', priority: 3, color: '#F59E0B', is_builtin: 1 },
  { title: '副业增收', description: '下午空闲时间开展兼职赚取额外收入', category: 'side_income', day_of_week: 5, start_time: '14:00', end_time: '17:00', priority: 3, color: '#F59E0B', is_builtin: 1 },
  { title: '周末复盘', description: '回顾本周完成情况、规划下周重点', category: 'custom', day_of_week: 6, start_time: '20:00', end_time: '21:00', priority: 4, color: '#8B5CF6', is_builtin: 1 },
  { title: '自由安排', description: '灵活处理个人事务、休闲放松', category: 'custom', day_of_week: 0, start_time: '09:00', end_time: '18:00', priority: 2, color: '#EC4899', is_builtin: 1 },
];

// 获取周计划列表
router.get('/api/weekly-plans', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);
  try {
    const { searchParams } = new URL(req.url);
    const weekStart = searchParams.get('week_start') || '';
    const db = env.DB;
    const userId = auth.userId;
    
    let sql = 'SELECT * FROM weekly_plans WHERE user_id = ?';
    const params = [userId];
    if (weekStart) {
      sql += ' AND week_start = ?';
      params.push(weekStart);
    }
    sql += ' ORDER BY day_of_week ASC, start_time ASC';
    
    const result = await db.prepare(sql).bind(...params).all();
    const plans = result.results || [];
    
    // 如果没有数据且没有指定week_start，自动初始化内置模板
    if (plans.length === 0 && !weekStart) {
      return jsonResponse({ success: true, plans: [], needsInit: true });
    }
    
    return jsonResponse({ success: true, plans });
  } catch (e) {
    return jsonResponse({ error: '获取周计划失败: ' + e.message }, 500);
  }
});

// 初始化内置模板到指定周
router.post('/api/weekly-plans/init-templates', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);
  try {
    const body = await req.json();
    const weekStart = body.week_start || '';
    if (!weekStart) return jsonResponse({ error: '缺少 week_start' }, 400);
    
    const db = env.DB;
    const userId = auth.userId;
    let count = 0;
    
    for (const tpl of WEEKLY_BUILTIN_TEMPLATES) {
      await db.prepare(
        `INSERT INTO weekly_plans (user_id, title, description, category, day_of_week, start_time, end_time, priority, color, week_start, is_builtin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
      ).bind(userId, tpl.title, tpl.description, tpl.category, tpl.day_of_week,
             tpl.start_time, tpl.end_time, tpl.priority, tpl.color, weekStart).run();
      count++;
    }
    
    return jsonResponse({ success: true, count, message: `已添加 ${count} 条内置模板` });
  } catch (e) {
    return jsonResponse({ error: '初始化模板失败: ' + e.message }, 500);
  }
});

// 创建周计划
router.post('/api/weekly-plans', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);
  try {
    const body = await req.json();
    const { title, description, category, day_of_week, start_time, end_time, priority, color, week_start, is_builtin } = body;
    if (!title) return jsonResponse({ error: '缺少标题' }, 400);
    
    const db = env.DB;
    const result = await db.prepare(
      `INSERT INTO weekly_plans (user_id, title, description, category, day_of_week, start_time, end_time, priority, color, week_start, is_builtin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(auth.userId, sanitize(title), sanitize(description || ''), sanitize(category || 'custom'),
           day_of_week !== undefined && day_of_week !== null ? day_of_week : null, start_time || null, end_time || null,
           priority || 3, sanitize(color || '#6366F1'), week_start || null,
           is_builtin || 0).run();
    
    return jsonResponse({ success: true, id: result.meta?.last_row_id, message: '计划已创建' });
  } catch (e) {
    return jsonResponse({ error: '创建周计划失败: ' + e.message }, 500);
  }
});

// 更新周计划
router.put('/api/weekly-plans/:id', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);
  try {
    const body = await req.json();
    const { id } = req.params;
    if (!id) return jsonResponse({ error: '缺少计划ID' }, 400);
    
    const db = env.DB;
    const userId = auth.userId;
    
    // 动态构建 SET 子句
    const fields = ['title', 'description', 'category', 'day_of_week', 'start_time', 'end_time', 'priority', 'color', 'status', 'week_start'];
    const sets = [];
    const vals = [];
    for (const f of fields) {
      if (body[f] !== undefined) {
        sets.push(`${f} = ?`);
        vals.push(f === 'title' || f === 'description' || f === 'category' || f === 'color' ? sanitize(body[f]) : body[f]);
      }
    }
    if (sets.length === 0) return jsonResponse({ error: '未提供更新的字段' }, 400);
    sets.push("updated_at = CURRENT_TIMESTAMP");
    vals.push(userId, id);
    
    await db.prepare(`UPDATE weekly_plans SET ${sets.join(', ')} WHERE user_id = ? AND id = ?`).bind(...vals).run();
    return jsonResponse({ success: true, message: '计划已更新' });
  } catch (e) {
    return jsonResponse({ error: '更新周计划失败: ' + e.message }, 500);
  }
});

// 删除周计划（支持批量）
router.post('/api/weekly-plans/delete', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);
  try {
    const body = await req.json();
    const ids = body.ids || [];
    if (ids.length === 0) return jsonResponse({ error: '缺少计划ID列表' }, 400);
    
    const db = env.DB;
    const userId = auth.userId;
    const placeholders = ids.map(() => '?').join(',');
    await db.prepare(`DELETE FROM weekly_plans WHERE user_id = ? AND id IN (${placeholders})`).bind(userId, ...ids).run();
    
    return jsonResponse({ success: true, deleted: ids.length });
  } catch (e) {
    return jsonResponse({ error: '删除周计划失败: ' + e.message }, 500);
  }
});

// 清空周计划（可筛选内置/自定义）
router.post('/api/weekly-plans/clear', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);
  try {
    const body = await req.json();
    const weekStart = body.week_start || '';
    const clearBuiltin = body.clear_builtin !== false; // 默认清掉内置
    
    const db = env.DB;
    const userId = auth.userId;
    
    let sql = 'DELETE FROM weekly_plans WHERE user_id = ?';
    const params = [userId];
    if (weekStart) { sql += ' AND week_start = ?'; params.push(weekStart); }
    if (!clearBuiltin) { sql += ' AND is_builtin = 0'; }
    
    await db.prepare(sql).bind(...params).run();
    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: '清空周计划失败: ' + e.message }, 500);
  }
});

// 同步周计划到任务池
router.post('/api/weekly-plans/sync-to-tasks', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);
  try {
    const body = await req.json();
    const planIds = body.plan_ids || [];       // 指定计划ID（单选/批量）
    const weekStart = body.week_start || '';   // 整周同步
    const keepExisting = body.keep_existing !== false; // 是否保留已有任务
    
    if (planIds.length === 0 && !weekStart) return jsonResponse({ error: '请指定要同步的计划' }, 400);
    
    const db = env.DB;
    const userId = auth.userId;
    
    // 获取待同步计划
    let plans = [];
    if (planIds.length > 0) {
      const placeholders = planIds.map(() => '?').join(',');
      const r = await db.prepare(`SELECT * FROM weekly_plans WHERE user_id = ? AND id IN (${placeholders})`).bind(userId, ...planIds).all();
      plans = r.results || [];
    } else if (weekStart) {
      const r = await db.prepare('SELECT * FROM weekly_plans WHERE user_id = ? AND week_start = ?').bind(userId, weekStart).all();
      plans = r.results || [];
    }
    
    if (plans.length === 0) return jsonResponse({ error: '没有找到待同步的计划' }, 400);
    
    let synced = 0, skipped = 0, updated = 0;
    const now = new Date().toISOString();
    
    for (const plan of plans) {
      const titleKey = (plan.title || '').trim().toLowerCase();

      // 构建描述（包含星期和时间信息）
      var weekdays = ['周日','周一','周二','周三','周四','周五','周六'];
      var weekdayLabel = plan.day_of_week != null ? weekdays[plan.day_of_week] : '';
      var timeInfo = '';
      if (plan.start_time) {
        timeInfo = plan.start_time.slice(0,5);
        if (plan.end_time) timeInfo += '-' + plan.end_time.slice(0,5);
      }
      var descExtra = [weekdayLabel, timeInfo].filter(Boolean).join(' ');
      var desc = ('[周视图导入]' + (descExtra ? ' ' + descExtra : '') + (plan.description ? ' | ' + plan.description : '')).trim();
      
      // 计算具体日期
      var dueDate = null;
      if (plan.day_of_week !== null && plan.week_start) {
        var d = new Date(plan.week_start + 'T00:00:00');
        d.setDate(d.getDate() + plan.day_of_week);
        dueDate = d.toISOString().split('T')[0];
      }
      
      // ⭐ 按 title + source + due_date 三重匹配去重
      // 同一标题但不同日期的计划视为不同任务
      var existingTask = await db.prepare(
        'SELECT id FROM tasks WHERE user_id = ? AND title = ? AND source = \'weekly_plan\' AND due_date = ? LIMIT 1'
      ).bind(userId, sanitize(plan.title), dueDate).first();
      
      if (existingTask) {
        // 已存在 → UPDATE
        await db.prepare(
          'UPDATE tasks SET description = ?, category = ?, priority = ?, difficulty = ?, due_date = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?'
        ).bind(sanitize(desc), sanitize(plan.category || 'general'), plan.priority || 3,
               Math.ceil(plan.priority / 2) || 2, dueDate || null,
               plan.status === 'completed' ? 'completed' : 'pending', now, existingTask.id, userId).run();
        updated++;
      } else {
        // 不存在 → 创建（已按 title+source+due_date 精确去重，不同日期即为不同任务）
        await db.prepare(
          `INSERT INTO tasks (user_id, title, description, category, difficulty, priority, status, due_date, source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'weekly_plan', ?, ?)`
        ).bind(userId, sanitize(plan.title), sanitize(desc), sanitize(plan.category || 'general'),
               Math.ceil(plan.priority / 2) || 2, plan.priority || 3,
               plan.status === 'completed' ? 'completed' : 'pending',
               dueDate || null, now, now).run();
        
        synced++;
      }
      
      // 标记已同步
      await db.prepare('UPDATE weekly_plans SET sync_token = ? WHERE id = ?').bind('synced_' + now, plan.id).run();
    }
    
    await clearDashCache(env, userId);
    return jsonResponse({ success: true, synced, skipped, updated, total: plans.length, message: `同步完成：新增 ${synced} 个，更新 ${updated} 个，跳过 ${skipped} 个重复` });
  } catch (e) {
    return jsonResponse({ error: '同步失败: ' + e.message }, 500);
  }
});

// ========== 周视图用户模板API ==========

// 获取用户模板列表
router.get('/api/weekly-plans/templates', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM user_templates WHERE user_id = ? ORDER BY sort_order ASC, day_of_week ASC'
    ).bind(auth.userId).all();
    return jsonResponse({ success: true, templates: results || [] });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
});

// 创建模板
router.post('/api/weekly-plans/templates', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);
  try {
    var body = await req.json();
    if (!body.title || !body.title.trim()) return jsonResponse({ error: '标题不能为空' }, 400);
    var r = await env.DB.prepare(
      `INSERT INTO user_templates (user_id, title, description, category, day_of_week, start_time, end_time, priority, color, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(auth.userId, sanitize(body.title), sanitize(body.description||''), sanitize(body.category||'custom',50),
           body.day_of_week != null ? body.day_of_week : null, body.start_time||null, body.end_time||null,
           body.priority||3, body.color||'#6366F1', body.sort_order||0).run();
    return jsonResponse({ success: true, id: getLastRowId(r) });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
});

// 更新模板
router.put('/api/weekly-plans/templates/:id', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);
  try {
    var body = await req.json();
    var sets = [], vals = [];
    ['title','description','category','day_of_week','start_time','end_time','priority','color','sort_order'].forEach(function(k) {
      if (body[k] !== undefined) { sets.push(k + ' = ?'); vals.push(k === 'title' ? sanitize(body[k],200) : sanitize(String(body[k]),500)); }
    });
    if (sets.length === 0) return jsonResponse({ error: '没有需要更新的字段' }, 400);
    sets.push('updated_at = CURRENT_TIMESTAMP');
    vals.push(auth.userId, req.params.id);
    await env.DB.prepare('UPDATE user_templates SET ' + sets.join(', ') + ' WHERE user_id = ? AND id = ?').bind(...vals).run();
    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
});

// 删除模板
router.delete('/api/weekly-plans/templates/:id', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);
  try {
    await env.DB.prepare('DELETE FROM user_templates WHERE user_id = ? AND id = ?').bind(auth.userId, req.params.id).run();
    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
});

// 使用模板初始化某周（替代内置模板）
router.post('/api/weekly-plans/init-custom-templates', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);
  try {
    var body = await req.json();
    var weekStart = body.week_start;
    if (!weekStart) return jsonResponse({ error: '请指定周起始日期' }, 400);
    
    var templates = await env.DB.prepare(
      'SELECT * FROM user_templates WHERE user_id = ? ORDER BY sort_order ASC'
    ).bind(auth.userId).all();
    
    var count = 0;
    for (var t of (templates.results || [])) {
      await env.DB.prepare(
        `INSERT INTO weekly_plans (user_id, title, description, category, day_of_week, start_time, end_time, priority, color, week_start, is_builtin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
      ).bind(auth.userId, t.title, t.description||'', t.category||'custom', t.day_of_week,
             t.start_time||null, t.end_time||null, t.priority||3, t.color||'#6366F1', weekStart).run();
      count++;
    }
    return jsonResponse({ success: true, count: count, message: '已导入 ' + count + ' 条自定义模板' });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
});

// ========== CBT模板API（P3）==========

// 获取CBT模板列表（用户自定义 + 系统预设）
router.get('/api/cbt-templates', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const userId = auth.userId;

    // 获取用户自定义模板
    const { results: userTemplates } = await db.prepare(
      'SELECT * FROM cbt_templates WHERE user_id = ? ORDER BY use_count DESC, created_at DESC'
    ).bind(userId).all();

    // 系统预设模板
    const systemTemplates = [
      {
        id: 'sys_cbt',
        name: 'CBT 思维记录',
        description: '认知行为疗法经典模板，帮助你识别和重构消极思维',
        template_type: 'cbt',
        fields: JSON.stringify([
          { key: 'cbt_thought', label: '自动思维', placeholder: '当时脑子里在想什么？', icon: 'fa-lightbulb' },
          { key: 'cbt_emotion', label: '情绪感受', placeholder: '感受到什么情绪？多强？1-10', icon: 'fa-heart' },
          { key: 'cbt_behavior', label: '行为反应', placeholder: '你做了什么？或不做什么？', icon: 'fa-running' },
          { key: 'cbt_reframe', label: '思维重构', placeholder: '更平衡的想法是什么？', icon: 'fa-sync' }
        ]),
        is_system: true
      },
      {
        id: 'sys_gratitude',
        name: '感恩日记',
        description: '每天记录值得感恩的事物，培养积极心态',
        template_type: 'gratitude',
        fields: JSON.stringify([
          { key: 'gratitude_1', label: '今天最感恩的一件事', placeholder: '描述今天让你感到感恩的事情...', icon: 'fa-star' },
          { key: 'gratitude_2', label: '感恩的人', placeholder: '今天谁让你感到温暖？', icon: 'fa-user-friends' },
          { key: 'gratitude_3', label: '对自己的感恩', placeholder: '今天有什么值得肯定自己的？', icon: 'fa-hand-holding-heart' },
          { key: 'gratitude_reflection', label: '感恩感悟', placeholder: '这些感恩让你意识到了什么？', icon: 'fa-feather' }
        ]),
        is_system: true
      },
      {
        id: 'sys_reflection',
        name: '每日反思',
        description: '回顾一天的得失，促进自我成长',
        template_type: 'reflection',
        fields: JSON.stringify([
          { key: 'reflection_good', label: '今天做得好的', placeholder: '今天有什么事做得不错？', icon: 'fa-check-circle' },
          { key: 'reflection_bad', label: '可以改进的', placeholder: '哪些地方可以做得更好？', icon: 'fa-exclamation-circle' },
          { key: 'reflection_learn', label: '今天学到的', placeholder: '今天有什么新发现或领悟？', icon: 'fa-graduation-cap' },
          { key: 'reflection_tomorrow', label: '明天的计划', placeholder: '明天想怎样改进？', icon: 'fa-calendar-check' }
        ]),
        is_system: true
      },
      {
        id: 'sys_procrastination',
        name: '拖延分析',
        description: '深入分析拖延原因，找到突破口',
        template_type: 'procrastination',
        fields: JSON.stringify([
          { key: 'proc_task', label: '拖延的任务', placeholder: '你在拖延什么任务？', icon: 'fa-clock' },
          { key: 'proc_reason', label: '拖延原因', placeholder: '为什么不想做？害怕什么？', icon: 'fa-search' },
          { key: 'proc_feeling', label: '拖延时的感受', placeholder: '拖延时你有什么感觉？', icon: 'fa-frown' },
          { key: 'proc_smallest', label: '最小第一步', placeholder: '你能做的最小一步是什么？', icon: 'fa-shoe-prints' },
          { key: 'proc_commitment', label: '行动承诺', placeholder: '我承诺在___分钟内完成这第一步', icon: 'fa-handshake' }
        ]),
        is_system: true
      },
      {
        id: 'sys_anxiety',
        name: '焦虑缓解',
        description: '系统化分析焦虑来源，制定应对策略',
        template_type: 'anxiety',
        fields: JSON.stringify([
          { key: 'anxiety_trigger', label: '焦虑触发点', placeholder: '什么让你感到焦虑？', icon: 'fa-bolt' },
          { key: 'anxiety_worst', label: '最坏的情况', placeholder: '你担心最坏会怎样？', icon: 'fa-cloud-showers-heavy' },
          { key: 'anxiety_probability', label: '实际可能性', placeholder: '这种情况真正发生的概率有多大？', icon: 'fa-percentage' },
          { key: 'anxiety_cope', label: '应对策略', placeholder: '如果真的发生了，你能怎样应对？', icon: 'fa-shield-alt' },
          { key: 'anxiety_action', label: '当下行动', placeholder: '现在你能做的一件有用的事是什么？', icon: 'fa-play' }
        ]),
        is_system: true
      }
    ];

    return jsonResponse({
      success: true,
      templates: [...systemTemplates, ...(userTemplates || []).map(t => ({ ...t, is_system: false }))]
    });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// 创建自定义CBT模板
router.post('/api/cbt-templates', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const { name, description, template_type, fields } = await req.json();
    
    if (!name || !fields || !Array.isArray(fields) || fields.length === 0) {
      return jsonResponse({ error: '模板名称和字段不能为空' }, 400);
    }

    const db = env.DB;
    const result = await db.prepare(
      `INSERT INTO cbt_templates (user_id, name, description, template_type, fields) 
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      auth.userId,
      sanitize(name, 100),
      sanitize(description, 500),
      sanitize(template_type || 'custom', 30),
      JSON.stringify(fields)
    ).run();

    return jsonResponse({ success: true, templateId: getLastRowId(result) });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// 更新自定义CBT模板
router.put('/api/cbt-templates/:id', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const { id } = req.params;
    const { name, description, template_type, fields } = await req.json();
    const db = env.DB;

    // 验证模板属于当前用户
    const existing = await db.prepare(
      'SELECT id FROM cbt_templates WHERE id = ? AND user_id = ?'
    ).bind(id, auth.userId).first();

    if (!existing) {
      return jsonResponse({ error: '模板不存在或无权编辑' }, 403);
    }

    await db.prepare(
      `UPDATE cbt_templates SET name = ?, description = ?, template_type = ?, fields = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ? AND user_id = ?`
    ).bind(
      sanitize(name, 100),
      sanitize(description, 500),
      sanitize(template_type || 'custom', 30),
      JSON.stringify(fields),
      id,
      auth.userId
    ).run();

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// 删除自定义CBT模板
router.delete('/api/cbt-templates/:id', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const { id } = req.params;
    const db = env.DB;

    const result = await db.prepare(
      'DELETE FROM cbt_templates WHERE id = ? AND user_id = ?'
    ).bind(id, auth.userId).run();

    if (!result.meta?.changes) {
      return jsonResponse({ error: '模板不存在或无权删除' }, 403);
    }

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// 使用模板（增加使用次数）
router.post('/api/cbt-templates/:id/use', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const { id } = req.params;
    const db = env.DB;

    // 只更新用户自己的模板使用次数（系统模板不计数）
    const idNum = parseInt(id);
    if (!isNaN(idNum)) {
      await db.prepare(
        'UPDATE cbt_templates SET use_count = use_count + 1 WHERE id = ? AND user_id = ?'
      ).bind(idNum, auth.userId).run();
    }

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// ========== 日记功能 ==========

// 创建日记条目
router.post('/api/diary', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const { title, content, mood, weather, location, is_private, template_type, cbt_thought, cbt_emotion, cbt_behavior, cbt_reframe, media } = await req.json();
    const cleanTitle = sanitize(title, 200) || '无标题';
    const cleanContent = sanitize(content, 5000);
    const cleanMood = sanitize(mood, 20) || 'neutral';
    const cleanWeather = sanitize(weather, 50);
    const cleanLocation = sanitize(location, 100);
    const cleanTemplateType = sanitize(template_type, 20) || 'free';
    const privateFlag = is_private !== false ? 1 : 0;

    const db = env.DB;
    const result = await db.prepare(
      `INSERT INTO diary_entries (user_id, title, content, mood, weather, location, is_private, template_type, cbt_thought, cbt_emotion, cbt_behavior, cbt_reframe)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(auth.userId, cleanTitle, cleanContent, cleanMood, cleanWeather, cleanLocation, privateFlag, cleanTemplateType, 
         sanitize(cbt_thought, 2000), sanitize(cbt_emotion, 1000), sanitize(cbt_behavior, 2000), sanitize(cbt_reframe, 2000)).run();

    const entryId = getLastRowId(result);

    // 保存媒体文件（如果有）
    if (media && Array.isArray(media) && entryId) {
      for (const m of media) {
        if (m.file_url && m.media_type) {
          await db.prepare(
            `INSERT INTO diary_media (entry_id, user_id, media_type, file_name, file_url, file_size, duration, width, height)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            entryId,
            auth.userId,
            sanitize(m.media_type, 10),
            sanitize(m.file_name, 200),
            m.file_url,
            parseInt(m.file_size) || 0,
            parseInt(m.duration) || null,
            parseInt(m.width) || null,
            parseInt(m.height) || null
          ).run();
        }
      }
    }

    return jsonResponse({ success: true, entryId });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// 获取日记列表
router.get('/api/diary', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const offset = parseInt(url.searchParams.get('offset')) || 0;
    const mood = url.searchParams.get('mood');
    const template_type = url.searchParams.get('template_type');
    const search = url.searchParams.get('search');

    const db = env.DB;
    let sql = 'SELECT * FROM diary_entries WHERE user_id = ?';
    let bindings = [auth.userId];

    if (mood) { sql += ' AND mood = ?'; bindings.push(mood); }
    if (template_type) { sql += ' AND template_type = ?'; bindings.push(template_type); }
    if (search) { sql += ' AND (title LIKE ? OR content LIKE ? OR cbt_thought LIKE ? OR cbt_reframe LIKE ?)'; bindings.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const { results } = await db.prepare(sql).bind(...bindings).all();

    // 为每条日记加载媒体文件
    for (const entry of results) {
      const media = await db.prepare(
        'SELECT * FROM diary_media WHERE entry_id = ? ORDER BY created_at'
      ).bind(entry.id).all();
      entry.media = media.results || [];
    }

    return jsonResponse({ success: true, entries: results });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// 获取单条日记详情
router.get('/api/diary/:id', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const entry = await db.prepare(
      'SELECT * FROM diary_entries WHERE id = ? AND user_id = ?'
    ).bind(req.params.id, auth.userId).first();

    if (!entry) return jsonResponse({ error: '日记不存在' }, 404);

    const media = await db.prepare(
      'SELECT * FROM diary_media WHERE entry_id = ? ORDER BY created_at'
    ).bind(entry.id).all();

    entry.media = media.results || [];

    return jsonResponse({ success: true, entry });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// 更新日记
router.put('/api/diary/:id', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const entryId = req.params.id;
    const { title, content, mood, weather, location, is_private, template_type, cbt_thought, cbt_emotion, cbt_behavior, cbt_reframe, media } = await req.json();

    const db = env.DB;
    const existing = await db.prepare('SELECT id FROM diary_entries WHERE id = ? AND user_id = ?')
      .bind(entryId, auth.userId).first();
    if (!existing) return jsonResponse({ error: '日记不存在' }, 404);

    const updates = [];
    const bindings = [];

    if (title !== undefined) { updates.push('title = ?'); bindings.push(sanitize(title, 200)); }
    if (content !== undefined) { updates.push('content = ?'); bindings.push(sanitize(content, 5000)); }
    if (mood !== undefined) { updates.push('mood = ?'); bindings.push(sanitize(mood, 20)); }
    if (weather !== undefined) { updates.push('weather = ?'); bindings.push(sanitize(weather, 50)); }
    if (location !== undefined) { updates.push('location = ?'); bindings.push(sanitize(location, 100)); }
    if (is_private !== undefined) { updates.push('is_private = ?'); bindings.push(is_private ? 1 : 0); }
    if (template_type !== undefined) { updates.push('template_type = ?'); bindings.push(sanitize(template_type, 20)); }
    if (cbt_thought !== undefined) { updates.push('cbt_thought = ?'); bindings.push(sanitize(cbt_thought, 2000)); }
    if (cbt_emotion !== undefined) { updates.push('cbt_emotion = ?'); bindings.push(sanitize(cbt_emotion, 1000)); }
    if (cbt_behavior !== undefined) { updates.push('cbt_behavior = ?'); bindings.push(sanitize(cbt_behavior, 2000)); }
    if (cbt_reframe !== undefined) { updates.push('cbt_reframe = ?'); bindings.push(sanitize(cbt_reframe, 2000)); }
    updates.push("updated_at = CURRENT_TIMESTAMP");
    bindings.push(entryId, auth.userId);

    await db.prepare(`UPDATE diary_entries SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).bind(...bindings).run();

    // 更新媒体文件（先删除旧的，再插入新的）
    if (media && Array.isArray(media)) {
      await db.prepare('DELETE FROM diary_media WHERE entry_id = ? AND user_id = ?').bind(entryId, auth.userId).run();

      for (const m of media) {
        if (m.file_url && m.media_type) {
          await db.prepare(
            `INSERT INTO diary_media (entry_id, user_id, media_type, file_name, file_url, file_size, duration, width, height)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            entryId,
            auth.userId,
            sanitize(m.media_type, 10),
            sanitize(m.file_name, 200),
            m.file_url,
            parseInt(m.file_size) || 0,
            parseInt(m.duration) || null,
            parseInt(m.width) || null,
            parseInt(m.height) || null
          ).run();
        }
      }
    }

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: '服务器内部错误', detail: env.NODE_ENV === 'development' ? e.message : undefined }, 500);
  }
});

// 删除日记
router.delete('/api/diary/:id', async (req, env) => {
  const auth = await authMiddleware(req, env);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const db = env.DB;
    const entryId = req.params.id;

    // 级联删除媒体文件
    await db.prepare('DELETE FROM diary_media WHERE entry_id = ? AND user_id = ?').bind(entryId, auth.userId).run();
    await db.prepare('DELETE FROM diary_entries WHERE id = ? AND user_id = ?').bind(entryId, auth.userId).run();

    return jsonResponse({ success: true });
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
    await db.prepare('DELETE FROM diary_entries WHERE user_id = ?').bind(userId).run();
    await db.prepare('DELETE FROM diary_media WHERE user_id = ?').bind(userId).run();
    await db.prepare('DELETE FROM user_settings WHERE user_id = ?').bind(userId).run();
    await db.prepare('DELETE FROM user_preferences WHERE user_id = ?').bind(userId).run();
    await db.prepare('DELETE FROM user_achievements WHERE user_id = ?').bind(userId).run();
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

    // 数据库迁移（只在第一次请求时执行）
    await migrateDatabase(env.DB);

    // 修复: OPTIONS 预检请求必须最先处理，且包含 CORS 头
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    // 修复 BE-005: 验证关键环境变量
    if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
      return jsonResponse({ 
        error: '服务器配置错误: JWT_SECRET 未设置或太短',
        success: false 
      }, 500, corsHeaders(origin, env));
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
