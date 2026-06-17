# 周迹 — 不是管理时间，是管理启动

> 基于认知行为疗法（CBT）的拖延症干预系统，帮助你从"不想做"到"已经开始了"。

## ✨ 功能特性

| 模块 | 功能 | 说明 |
|------|------|------|
| 📊 仪表盘 | 今日总览 | 5个核心指标 + 待启动任务 + 7天趋势 + 情绪 + 快捷操作 |
| 📅 周视图 | 周计划管理 | 7列拖拽网格，可自定义模板，一键同步到任务池 |
| ✂️ 任务台 | 任务拆解 | 把模糊任务切成2分钟原子步骤 |
| ❤️ 情绪舱 | 情绪识别 | 8种拖延情绪识别 + 能量水平 + CBT认知干预 |
| ▶️ 微启动 | 2分钟契约 | 只做2分钟，然后自由选择是否继续 |
| 🍅 番茄钟 | 25+5节奏 | 25分钟专注 + 5分钟休息循环 |
| 📔 日记 | CBT日记 | 自由写作 + CBT思维记录 + 媒体附件 |
| 🔬 拖延实验室 | 数据分析 | 拖延模式、时间分布、干扰源可视化 |
| 🤝 温和承诺 | 自我契约 | 自我承诺 + 违约追踪 |
| 🕐 时间块 | 时间规划 | 可视化时间块规划，匹配能量水平 |
| 🧠 CBT 速记 | 思维重构 | 捕获消极思维 → 理性重构 → 微小行动 |
| 🎵 专注音乐 | 网易云音乐 | 搜索播放专注音乐/白噪音 |
| 📊 数据 | 统计图表 | 任务趋势、情绪分析、拖延模式、番茄记录 |

## 🛠️ 技术架构

```
前端 (Cloudflare Pages)              后端 (Cloudflare Workers)
┌─────────────────────────┐          ┌─────────────────────────────┐
│  index.html (SPA)       │  HTTP/JS │  index.js (API 路由)        │
│  app.js (主应用)         │◄────────►│  router.js (路由库)         │
│  weekly.js (周视图)      │          │                             │
│  diary.js (日记)         │          │  Cloudflare D1 (SQLite)     │
│  stats.js (数据统计)     │          │  Cloudflare R2 (附件存储)    │
│  assistant.js (CBT速记)  │          │  Cloudflare KV (缓存)       │
│  social.js (分享导出)     │          └─────────────────────────────┘
│  manifest.json (PWA)     │
│  sw.js (离线缓存)         │
└─────────────────────────┘
```

- **前端**：原生 JavaScript SPA + Tailwind CSS，支持 PWA 离线访问
- **后端**：Cloudflare Workers + D1 数据库 + R2 对象存储 + KV 缓存
- **认证**：JWT (HMAC-SHA-256) + SHA-256 密码哈希
- **成本**：完全免费（Cloudflare 免费额度完全够用）

## 📁 项目结构

```
zhouji/
├── frontend/                 # 前端（部署到 Cloudflare Pages）
│   ├── index.html           # 主页面
│   ├── app.js               # 主应用（路由、导航、仪表盘、任务台）
│   ├── weekly.js            # 周视图模块（拖拽、模板编辑）
│   ├── diary.js             # 日记 + CBT 模板系统
│   ├── stats.js             # 数据统计与可视化
│   ├── assistant.js         # 辅助工具（CBT 速记 + 网易云音乐）
│   ├── social.js            # 社交分享与数据导出
│   ├── styles.css           # 自定义样式
│   ├── manifest.json        # PWA 配置
│   ├── sw.js                # Service Worker 离线缓存
│   └── insert_globals.py    # 构建脚本（注入 API 地址）
├── backend/                  # 后端（部署到 Cloudflare Workers）
│   ├── index.js             # Worker 主入口（全部 API 路由 + 业务逻辑）
│   ├── router.js            # 轻量路由库
│   ├── schema.sql           # D1 数据库建表语句
│   ├── package.json         # 项目配置
│   └── wrangler.toml        # Worker 部署配置
├── .gitignore
└── README.md
```

## 🚀 快速部署

### 前置条件

- [Node.js](https://nodejs.org) 18+
- [Cloudflare 账号](https://dash.cloudflare.com)（免费注册）

### 第一步：部署后端

```bash
# 安装 Wrangler CLI 并登录
npm install -g wrangler
wrangler login

cd backend

# 创建 D1 数据库
wrangler d1 create zhouji-db
# → 复制输出的数据库 ID

# 创建 KV 命名空间（用于仪表盘缓存）
wrangler kv namespace create zhouji-cache

# 配置 wrangler.toml（替换 database_id 和 KV id）
# 编辑 wrangler.toml

# 设置 JWT 密钥（重要！）
wrangler secret put JWT_SECRET
# 输入至少 32 位的随机字符串

# 初始化数据库
wrangler d1 execute zhouji-db --file=./schema.sql

# 部署后端
wrangler deploy
# → 获得后端地址: https://zhouji-api.xxx.workers.dev
```

### 第二步：部署前端

```bash
cd frontend
npx wrangler pages deploy . --project-name zhouji
# → 获得前端地址: https://zhouji.pages.dev
```

### 第三步：配置并使用

1. 打开前端地址，在登录页底部填入后端 API 地址
2. 注册账号并登录
3. 开始使用！

## 💰 免费额度

| 服务 | 免费额度 | 说明 |
|------|---------|------|
| Workers | 10万次请求/天 | 完全够用 |
| D1 | 500万次查询/天 | 完全够用 |
| KV | 1000次读/天 + 1000次写/天 | 仪表盘缓存够用 |
| R2 | 10GB 存储 | 附件存储够用 |
| Pages | 无限静态请求 | 完全够用 |

**零成本，无需信用卡。**

## 📱 PWA 安装

部署后用手机浏览器访问：

- **iOS Safari**：分享 → 添加到主屏幕
- **Android Chrome**：菜单 → 安装应用

即可像原生 App 一样使用，支持离线访问。

## 🔄 更新部署

```bash
# 更新后端
cd backend && wrangler deploy

# 更新前端
cd frontend && npx wrangler pages deploy . --project-name zhouji
```

> ⚠️ Windows 用户部署前需清除代理环境变量：
> ```bash
> unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy
> ```

## 📝 设计理念

**周迹**的核心逻辑来自 CBT 对拖延症的理解：

1. **识别自动思维** → 情绪舱 + CBT 速记捕获"我就是做不了"等消极想法
2. **行为激活** → 微启动（2分钟契约）打破行动瘫痪
3. **任务拆解** → 原子步骤降低任务压力
4. **情绪调节** → 能量匹配 + 认知重构
5. **模式识别** → 数据统计分析拖延规律
6. **正向反馈** → 连胜天数、任务完成率可视化

## 📄 License

MIT
