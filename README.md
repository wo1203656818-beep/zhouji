# 周迹 - 不是管理时间，是管理启动

> 基于认知行为疗法（CBT）的拖延症干预系统，帮助你从"不想做"到"已经开始了"。

## ✨ 功能特性

| 模块 | 功能 | 说明 |
|------|------|------|
| 🏠 仪表盘 | 今日概览 | 任务、微启动、番茄钟、拖延记录一目了然 |
| ❤️ 情绪缓冲舱 | 情绪识别 | 8种拖延情绪识别 + CBT认知干预 |
| ✂️ 任务解剖台 | 任务拆解 | 把模糊任务切成2分钟原子步骤 |
| ▶️ 微启动 | 2分钟契约 | 只做2分钟，然后自由选择是否继续 |
| ⏱️ 番茄钟 | 25+5节奏 | 25分钟专注 + 5分钟休息循环 |
| 🔬 拖延实验室 | 数据分析 | 拖延模式、时间分布、干扰源可视化 |
| 🤝 温和问责 | 承诺机制 | 自我契约 + 社会承诺 |
| 🕐 时间地形 | 时间规划 | 可视化时间块规划，匹配能量水平 |

## 🛠️ 技术架构

```
前端 (Cloudflare Pages)          后端 (Cloudflare Workers)
┌─────────────────────┐          ┌─────────────────────┐
│  index.html (SPA)   │  HTTP/JS │  index.js (API)     │
│  manifest.json (PWA)│◄────────►│  router.js (路由)    │
│  sw.js (离线缓存)    │          │                     │
└─────────────────────┘          │  Cloudflare D1      │
                                 │  (SQLite 数据库)     │
                                 └─────────────────────┘
```

- **前端**：原生 JavaScript SPA + Tailwind CSS，支持 PWA 离线访问
- **后端**：Cloudflare Workers + D1 数据库，零服务器运维
- **认证**：JWT (HMAC-SHA-256) + SHA-256 密码哈希
- **成本**：完全免费（Cloudflare 免费额度完全够用）

## 📁 项目结构

```
zhouji-v2.3-deploy/
├── frontend/                # 前端（部署到 Cloudflare Pages）
│   ├── index.html           # 主页面（JS 内联，单文件即可运行）
│   ├── app.js               # 独立 JS 副本（与 index.html 内联代码同步）
│   ├── manifest.json        # PWA 配置
│   └── sw.js                # Service Worker 离线缓存
├── backend/                 # 后端（部署到 Cloudflare Workers）
│   ├── index.js             # Worker 主入口（路由处理 + 业务逻辑）
│   ├── router.js            # 轻量路由库
│   ├── schema.sql           # D1 数据库建表语句
│   ├── package.json         # 项目配置
│   └── wrangler.toml        # Worker 部署配置（需修改数据库ID）
├── .gitignore
└── README.md
```

## 🚀 部署教程

### 前置条件

- [Node.js](https://nodejs.org) 18+
- [Cloudflare 账号](https://dash.cloudflare.com)（免费注册）

---

### 第一步：部署后端（Workers + D1）

**1. 安装 Wrangler CLI 并登录**

```bash
npm install -g wrangler
wrangler login
```

浏览器弹出授权页面，点击允许即可。

**2. 创建 D1 数据库**

```bash
cd backend
wrangler d1 create zhouji-db
```

执行后会输出：

```
✅ Successfully created DB 'zhouji-db'
ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**复制这个数据库 ID。**

**3. 配置 wrangler.toml**

编辑 `backend/wrangler.toml`，将 `database_id` 替换为你刚创建的数据库 ID：

```toml
[[d1_databases]]
binding = "DB"
database_name = "zhouji-db"
database_id = "你的数据库ID"   # ← 替换这里
```

同时将 `JWT_SECRET` 改为你自己的密钥（至少32位随机字符串）：

```toml
[vars]
JWT_SECRET = "你自己的随机密钥字符串-至少32位"
```

> ⚠️ **安全提示**：生产环境建议使用 `wrangler secret put JWT_SECRET` 代替明文写在 toml 中。

**4. 初始化数据库**

```bash
wrangler d1 execute zhouji-db --file=./schema.sql
```

**5. 部署后端**

```bash
wrangler deploy
```

部署成功后会显示：

```
✨ Successfully deployed
https://zhouji-api.你的子域名.workers.dev  ← 复制这个地址
```

**保存这个后端地址**，前端配置需要用到。

---

### 第二步：部署前端（Cloudflare Pages）

**方式一：CLI 部署（推荐）**

```bash
cd frontend
npx wrangler pages deploy . --project-name zhouji
```

**方式二：Dashboard 手动上传**

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 左侧菜单 → **Workers 和 Pages** → **创建**
3. 选择 **Pages** → **上传资源**
4. 项目名称填 `zhouji`
5. 将 `frontend/` 目录下的 `index.html`、`manifest.json`、`sw.js` 打包成 zip 上传
6. 点击 **部署站点**

部署完成后获得前端地址：`https://zhouji.pages.dev`

---

### 第三步：配置并使用

1. 打开你的前端页面（如 `https://zhouji.pages.dev`）
2. 在登录页面底部的 **API 地址** 输入框填入后端地址（如 `https://zhouji-api.xxx.workers.dev`）
3. 先点 **立即注册** 创建账号，再登录
4. 开始使用！

---

## 🔄 更新部署

修改代码后重新部署：

```bash
# 更新后端
cd backend && wrangler deploy

# 更新前端
cd frontend && npx wrangler pages deploy . --project-name zhouji
```

## 💰 免费额度

| 服务 | 免费额度 | 说明 |
|------|---------|------|
| Workers | 10万次请求/天 | 完全够用 |
| D1 | 500万次查询/天 | 完全够用 |
| Pages | 无限静态请求 | 完全够用 |

**零成本，无需信用卡。**

## 📱 PWA 安装

部署后用手机浏览器访问：

- **iOS Safari**：分享 → 添加到主屏幕
- **Android Chrome**：菜单 → 安装应用

即可像原生 App 一样使用，支持离线访问。

## ❓ 常见问题

**Q: 页面空白 / 登录失败？**
- 按F12打开控制台检查错误
- 确认 API 地址已正确填写（必须包含 `https://`）
- 确认后端已成功部署（访问 `https://你的后端地址/api/health` 应返回 `{"success":true}`）

**Q: 如何绑定自定义域名？**
- Pages 项目 → 设置 → 自定义域 → 添加域名
- Workers 项目 → 设置 → 触发器 → 自定义域

**Q: 数据安全吗？**
- 数据存储在 Cloudflare D1（SQLite）
- 密码使用 SHA-256 + Salt 哈希
- JWT 令牌用于身份认证

## 📄 License

MIT
