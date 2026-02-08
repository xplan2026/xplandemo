#!/bin/bash

# 服务器环境完整安装脚本
# 服务器: 182.254.180.26
# 系统: Ubuntu 22.04 LTS
# 用户: ubuntu (with sudo)

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}服务器环境完整安装${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用 root 用户运行此脚本${NC}"
    echo "使用: sudo bash install-server-environment.sh"
    exit 1
fi

echo -e "${GREEN}[1/10]${NC} 更新系统包..."
apt update && apt upgrade -y

echo -e "${GREEN}[2/10]${NC} 安装基础工具..."
apt install -y \
    curl \
    wget \
    git \
    build-essential \
    htop \
    net-tools \
    unzip \
    software-properties-common

echo -e "${GREEN}[3/10]${NC} 安装 Node.js 20.x..."
# 使用 NodeSource 仓库安装 Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo -e "${GREEN}[4/10]${NC} 验证 Node.js 和 npm..."
node --version
npm --version

echo -e "${GREEN}[5/10]${NC} 全局安装 Wrangler CLI..."
npm install -g wrangler@3.78.0

echo -e "${GREEN}[6/10]${NC} 验证 Wrangler..."
wrangler --version

echo -e "${GREEN}[7/10]${NC} 安装 Nginx..."
apt install -y nginx
systemctl enable nginx
systemctl start nginx

echo -e "${GREEN}[8/10]${NC} 安装 PM2..."
npm install -g pm2@5.4.2

echo -e "${GREEN}[9/10]${NC} 安装 Hardhat..."
npm install -g hardhat@2.22.0

echo -e "${GREEN}[10/10]${NC} 创建目录结构..."
mkdir -p /var/www/xplan-official-site
mkdir -p /var/www/xplan-demosite
mkdir -p /opt/xplan
mkdir -p /opt/xplan/contracts
mkdir -p /opt/xplan/logs
mkdir -p /var/log/xplan
mkdir -p /home/ubuntu/.ssh

echo -e "${GREEN}[完成]${NC} 设置目录权限..."
# Web 目录
chown -R ubuntu:www-data /var/www/
chmod -R 755 /var/www/

# 项目目录
chown -R ubuntu:ubuntu /opt/xplan/
chmod -R 755 /opt/xplan/

# 日志目录
chown -R ubuntu:ubuntu /var/log/xplan/
chmod -R 755 /var/log/xplan/

# SSH 目录
chown -R ubuntu:ubuntu /home/ubuntu/.ssh
chmod 700 /home/ubuntu/.ssh
chmod 600 /home/ubuntu/.ssh/authorized_keys 2>/dev/null || true

echo -e "${GREEN}[完成]${NC} 配置 sudo 权限..."
# 添加 ubuntu 用户到 sudo 组
usermod -aG sudo ubuntu 2>/dev/null || true

# 配置免密码执行 systemctl
if ! grep -q "ubuntu.*systemctl" /etc/sudoers.d/ 2>/dev/null; then
    mkdir -p /etc/sudoers.d
    echo "ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl" > /etc/sudoers.d/90-ubuntu-systemctl
    chmod 440 /etc/sudoers.d/90-ubuntu-systemctl
fi

echo -e "${GREEN}[完成]${NC} 配置防火墙..."
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp    # SSH
    ufw allow 80/tcp    # HTTP
    ufw allow 443/tcp   # HTTPS
    ufw allow 6060/tcp  # Application
    ufw --force enable
fi

echo ""
echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}安装完成！${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""
echo "已安装的软件："
echo "  • Node.js $(node --version)"
echo "  • npm $(npm --version)"
echo "  • Wrangler $(wrangler --version)"
echo "  • Nginx $(nginx -v 2>&1 | grep -oP '\d+\.\d+\.\d+')"
echo "  • PM2 $(pm2 --version)"
echo "  • Hardhat $(hardhat --version)"
echo ""
echo "目录结构："
echo "  • Web 目录: /var/www/"
echo "    - /var/www/xplan-official-site"
echo "    - /var/www/xplan-demosite"
echo "  • 项目目录: /opt/xplan/"
echo "  • 日志目录: /var/log/xplan/"
echo ""
echo "权限配置："
echo "  • ubuntu 用户已添加到 sudo 组"
echo "  • ubuntu 用户可以免密码执行 systemctl"
echo "  • Web 目录所有权: ubuntu:www-data"
echo "  • 项目目录所有权: ubuntu:ubuntu"
echo ""
echo "验证命令："
echo "  • 检查 Nginx: systemctl status nginx"
echo "  • 查看 Nginx 日志: tail -f /var/log/nginx/access.log"
echo "  • 测试网站: curl http://localhost"
echo ""
echo -e "${GREEN}✅ 服务器环境安装完成！${NC}"
