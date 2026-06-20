# 周迹 - CloudBase 免费版部署方案

## 📋 方案对比

| 项目 | Cloudflare (原方案) | CloudBase (新方案) |
|------|-------------------|-------------------|
| 前端 | Pages 静态托管 | 静态网站托管 |
| 后端 | Workers | 云函数 (Node.js) |
| 数据库 | D1 (SQLite) | 文档数据库 (MongoDB-like) |
| 文件存储 | R2 | 云存储 |
| 缓存 | KV | 无（不需要） |
| 免费额度 | 完全免费 | 3000 资源点/月 (够轻量使用) |

## 🚀 部署步骤

### 1. 安装 CloudBase CLI

```bash
npm i -g @cloudbase/cli
cloudbase login
```

### 2. 创建 CloudBase 环境

访问 https://console.cloud.tencent.com/tcb
→ 新建环境 → 选择"免费体验版"

### 3. 修改配置

编辑 `cloudbaserc.json`：
```json
{
  "envId": "你的环境ID",   // ← 改成你的
  "region": "ap-guangzhou",
  ...
}
```

### 4. 设置密钥

在 CloudBase 云函数环境变量中设置 (或写在 cloudbaserc.json 的 envVariables 里)：
```
JWT_SECRET = 随机32位字符串（重要！用于用户认证）
```

### 5. 创建数据库集合

在 CloudBase 控制台 → 数据库 → 新建以下集合：

```
users, tasks, task_steps, emotions, diary_entries,
micro_starts, pomodoro_sessions, procrastination_logs,
weekly_plans, user_templates, time_blocks, commitments,
daily_stats
```

### 6. 部署

```bash
# 安装依赖
cd cloudbase/functions/api && npm install && cd ../../..

# 部署云函数
cloudbase functions:deploy api --dir cloudbase/functions/api

# 部署前端
cloudbase hosting deploy ./frontend -e 你的环境ID
```

### 7. 配置 API 地址

部署后在 CloudBase 控制台 → 云函数 → api → 触发器 → 复制 HTTP 触发器地址

然后在前端登录页面，将 API 地址改为这个地址。

## ⚠️ 注意事项

### 数据库差异
- CloudBase 用的是**文档数据库**（类似 MongoDB），不是 SQL
- 文档ID 是自动生成的 `_id`（24字符字符串），不是自增数字ID
- **不支持 JOIN 查询**，需要分两次查询并在代码中关联
- 前端代码中用到的 `task.id` 现在是 `task._id`

### API 覆盖情况
已迁移的 API：
- ✅ 用户认证（注册/登录）
- ✅ 任务管理（CRUD + 排序 + 置顶）
- ✅ 任务步骤
- ✅ 微启动
- ✅ 情绪记录
- ✅ 番茄钟
- ✅ 拖延日志
- ✅ 日记
- ✅ 承诺管理
- ✅ 时间块
- ✅ 网易云音乐搜索
- ✅ 仪表盘概览
- ✅ 周视图计划
- ✅ 用户偏好
- ✅ 数据备份/导入

未迁移（CloudBase 免费版限制）：
- ❌ 百度网盘备份（需额外API）
- ❌ 某些高级聚合查询

### 前端适配
前端代码需要调整：
- 所有 `task.id` → `task._id`
- API 响应中的 ID 字段统一改为 `_id`

这个小改动可以在后续处理。

## 💰 费用预估

免费体验版 3000 资源点/月，个人使用预估消耗：
- 云函数调用：~500 点
- 数据库读写：~1000 点
- 静态托管访问：~500 点
- 剩余约 1000 点余量

正常个人使用完全够用，不会被扣费。
