
-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 任务表
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    difficulty INTEGER DEFAULT 3,
    status TEXT DEFAULT 'pending',
    due_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 任务步骤表（原子级拆解）
CREATE TABLE IF NOT EXISTS task_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    duration INTEGER DEFAULT 2,
    status TEXT DEFAULT 'pending',
    order_index INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 情绪记录表
CREATE TABLE IF NOT EXISTS emotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    emotion_type TEXT NOT NULL,
    energy_level INTEGER DEFAULT 3,
    trigger_task TEXT,
    cbt_response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 微启动记录表
CREATE TABLE IF NOT EXISTS micro_starts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    task_id INTEGER,
    step_id INTEGER,
    planned_duration INTEGER DEFAULT 2,
    actual_duration INTEGER DEFAULT 0,
    continued_after_contract BOOLEAN DEFAULT 0,
    status TEXT DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 拖延日志表
CREATE TABLE IF NOT EXISTS procrastination_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    task_id INTEGER,
    reason_type TEXT NOT NULL,
    reason_detail TEXT,
    distraction_source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 承诺/问责表
CREATE TABLE IF NOT EXISTS commitments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    task_id INTEGER,
    description TEXT NOT NULL,
    witness_type TEXT DEFAULT 'self',
    witness_contact TEXT,
    deadline DATETIME,
    completed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 时间块表
CREATE TABLE IF NOT EXISTS time_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    block_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    task_id INTEGER,
    block_type TEXT DEFAULT 'work',
    energy_level INTEGER DEFAULT 3,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 番茄钟表
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    task_id INTEGER,
    step_id INTEGER,
    duration INTEGER DEFAULT 25,
    completed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 每日统计表
CREATE TABLE IF NOT EXISTS daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    stat_date DATE NOT NULL,
    tasks_created INTEGER DEFAULT 0,
    tasks_started INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    micro_starts_count INTEGER DEFAULT 0,
    procrastination_count INTEGER DEFAULT 0,
    pomodoro_count INTEGER DEFAULT 0,
    UNIQUE(user_id, stat_date),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ========== 性能索引 ==========
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_category ON tasks(user_id, category);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON tasks(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_task_steps_task ON task_steps(task_id);
CREATE INDEX IF NOT EXISTS idx_task_steps_user ON task_steps(user_id);
CREATE INDEX IF NOT EXISTS idx_emotions_user ON emotions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_micro_starts_user ON micro_starts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proc_logs_user ON procrastination_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proc_logs_reason ON procrastination_logs(user_id, reason_type);
CREATE INDEX IF NOT EXISTS idx_commitments_user ON commitments(user_id, completed);
CREATE INDEX IF NOT EXISTS idx_timeblocks_user_date ON time_blocks(user_id, block_date);
CREATE INDEX IF NOT EXISTS idx_pomodoro_user ON pomodoro_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_stats_user_date ON daily_stats(user_id, stat_date);

-- ========== 注意 ==========
-- D1对触发器支持有限，以下功能请在应用层实现:
-- 1. updated_at自动更新: 在UPDATE语句中显式设置
-- 2. 级联删除: 在删除用户前手动清理关联数据
-- 3. 外键约束: D1默认不强制执行，请在应用层验证
