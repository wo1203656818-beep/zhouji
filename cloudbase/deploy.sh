#!/bin/bash
# ═══════════════════════════════════════════════════════
# 周迹 - CloudBase 免费版部署脚本
# 需要先安装：npm i -g @cloudbase/cli
# 使用前：cloudbase login
# ═══════════════════════════════════════════════════════

set -e

echo "=== 1. 登录 CloudBase ==="
cloudbase login

echo ""
echo "=== 2. 创建环境（如已创建请跳过）==="
echo "打开 https://console.cloud.tencent.com/tcb 创建免费体验环境"
echo "创建后把环境ID填到 cloudbaserc.json 的 envId 字段"
read -p "环境ID已填写？(y/n) " CONFIRM
if [ "$CONFIRM" != "y" ]; then exit 1; fi

echo ""
echo "=== 3. 部署云函数 ==="
cd functions/api
npm install
cd ../..
cloudbase functions:deploy api --dir functions/api

echo ""
echo "=== 4. 部署前端静态网站 ==="
cd "$(dirname "$0")"
cloudbase hosting deploy ./frontend -e $(node -e "var c=require('./cloudbaserc.json');console.log(c.envId)")

echo ""
echo "=== 5. 获取 API 地址 ==="
cloudbase functions:detail api

echo ""
echo "=== 部署完成 ==="
echo "请在前端登录页面将 API 地址设置为 CloudBase 云函数的 HTTP 触发器地址"
echo "格式：https://你的环境ID.service.tcloudbase.com/api"
