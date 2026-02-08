#!/bin/bash

# Ubuntu 服务器初始化脚本
# 使用方法: ./setup-server.sh

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}X-plan Demo 服务器初始化脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ 请使用 root 用户运行此脚本${NC}"
    exit 1
fi

# 更新系统
echo -e "${YELLOW}更新系统...${NC}"
apt update && apt upgrade -y
echo -e "${GREEN}✅ 系统更新完成${NC}"
echo ""

# 安装基础软件
echo -e "${YELLOW}安装基础软件...${NC}"
apt install -y \
    nginx \
    git \
    curl \
    rsync \
    build-essential \
    python3 \
    python3-pip \
    nodejs \
    npm \
    jq
echo -e "${GREEN}✅ 基础软件安装完成${NC}"
echo ""

# 创建部署目录
echo -e "${YELLOW}创建部署目录...${NC}"
mkdir -p /var/www/xplan-demo
mkdir -p /var/backups/xplan-demo
echo -e "${GREEN}✅ 目录创建完成${NC}"
echo ""

# 配置 Nginx
echo -e "${YELLOW}配置 Nginx...${NC}"
# 确保站点可用目录存在
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/sites-enabled

# 配置 Nginx 用户
echo "Setting up Nginx user..."
useradd -r -s /bin/false www-data 2>/dev/null || true
echo -e "${GREEN}✅ Nginx 配置准备完成${NC}"
echo ""

# 配置防火墙
echo -e "${YELLOW}配置防火墙...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp    # SSH
    ufw allow 6060/tcp   # X-plan Demo
    ufw allow 80/tcp     # HTTP
    ufw allow 443/tcp    # HTTPS
    echo -e "${GREEN}✅ 防火墙配置完成${NC}"
else
    echo -e "${YELLOW}⚠️  UFW 未安装，跳过防火墙配置${NC}"
fi
echo ""

# 安装 PM2（用于 Node.js 进程管理）
echo -e "${YELLOW}安装 PM2...${NC}"
npm install -g pm2
echo -e "${GREEN}✅ PM2 安装完成${NC}"
echo ""

# 配置日志轮转
echo -e "${YELLOW}配置日志轮转...${NC}"
cat > /etc/logrotate.d/xplan-demo << 'EOF'
/var/log/nginx/xplan-demo-*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}
EOF
echo -e "${GREEN}✅ 日志轮转配置完成${NC}"
echo ""

# 创建系统服务
echo -e "${YELLOW}创建系统服务...${NC}"
cat > /etc/systemd/system/xplan-demo-health.service << 'EOF'
[Unit]
Description=X-plan Demo Health Check
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/xplan-demo
ExecStart=/usr/bin/node /var/www/xplan-demo/health-check.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
echo -e "${GREEN}✅ 系统服务配置完成${NC}"
echo ""

# 完成
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 服务器初始化完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "下一步："
echo "1. 部署 Nginx 配置: ./deploy-frontend.sh"
echo "2. 配置 GitHub Actions Secrets (SSH_PRIVATE_KEY)"
echo "3. 推送代码触发自动部署"
echo ""
