#!/bin/bash

# 本地执行脚本 - 上传并在服务器上运行环境安装
# 需要在本地机器上执行（Windows Git Bash 或 WSL）

set -e

# 服务器配置
SERVER_HOST="182.254.180.26"
SERVER_USER="ubuntu"
SSH_KEY="$HOME/.ssh/xplan_server_key"

echo "========================================="
echo "上传服务器环境安装脚本"
echo "========================================="
echo ""

# 检查 SSH 密钥
if [ ! -f "$SSH_KEY" ]; then
    echo "错误: SSH 密钥不存在: $SSH_KEY"
    exit 1
fi

# 上传安装脚本
echo "上传安装脚本..."
scp -i "$SSH_KEY" \
    server-configs/install-server-environment.sh \
    "${SERVER_USER}@${SERVER_HOST}:/tmp/"

# 在服务器上执行脚本（需要 root 权限）
echo ""
echo "========================================="
echo "在服务器上执行安装脚本"
echo "========================================="
echo ""

ssh -i "$SSH_KEY" "${SERVER_USER}@${SERVER_HOST}" bash << 'ENDSSH'
# 切换到 root 执行安装
sudo bash /tmp/install-server-environment.sh

# 安装完成后，验证
echo ""
echo "========================================="
echo "验证安装结果"
echo "========================================="
echo ""

echo "已安装软件："
which node && node --version || echo "Node.js: 未安装"
which npm && npm --version || echo "npm: 未安装"
which wrangler && wrangler --version || echo "Wrangler: 未安装"
which nginx && nginx -v 2>&1 || echo "Nginx: 未安装"
which pm2 && pm2 --version || echo "PM2: 未安装"

echo ""
echo "目录权限："
ls -la /var/www/ | grep xplan || echo "xplan 目录: 未创建"
ls -la /opt/xplan/ 2>/dev/null || echo "opt/xplan 目录: 未创建"
ls -la /var/log/xplan/ 2>/dev/null || echo "log/xplan 目录: 未创建"

echo ""
echo "Nginx 状态："
systemctl status nginx --no-pager -l | head -10

echo ""
echo "防火墙状态："
ufw status 2>/dev/null || echo "UFW 未启用"

echo ""
echo "✅ 验证完成"
ENDSSH

echo ""
echo "========================================="
echo "本地验证连接"
echo "========================================="
echo ""

# 本地测试连接
echo "测试 SSH 连接..."
ssh -i "$SSH_KEY" "${SERVER_USER}@${SERVER_HOST}" "echo '✅ SSH 连接成功'"

echo ""
echo "测试 sudo 权限..."
ssh -i "$SSH_KEY" "${SERVER_USER}@${SERVER_HOST}" "sudo systemctl status nginx --no-pager | head -5"

echo ""
echo "========================================="
echo "服务器环境安装完成！"
echo "========================================="
