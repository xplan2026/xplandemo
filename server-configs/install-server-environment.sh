#!/bin/bash

# Ubuntu 服务器环境安装脚�?# 安装 Node.js, npm, Hardhat, Wrangler CLI
# 服务�? 182.254.180.26
# 系统: Ubuntu 20.04

set -e

echo "========================================="
echo "Ubuntu 服务器环境安�?
echo "========================================="
echo ""

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 函数：打印状�?print_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}�?{NC} $1"
    else
        echo -e "${RED}�?{NC} $1"
        exit 1
    fi
}

# 检查是否为 root 用户
# Check if user has sudo privileges\nif [ "$EUID" -ne 0 ] && ! sudo -n true 2>&1; then
    echo -e "${RED}请使�?root 用户运行此脚�?{NC}"
    echo "使用: sudo bash install-server-environment.sh"
    exit 1
fi

# 更新系统�?echo "1. 更新系统�?.."
apt update && apt upgrade -y
print_status "系统包更新完�?

# 安装基本工具
echo ""
echo "2. 安装基本工具..."
apt install -y \
    curl \
    wget \
    git \
    build-essential \
    python3 \
    python3-pip \
    jq \
    unzip \
    ufw

print_status "基本工具安装完成"

# 安装 Node.js 20.x (LTS)
echo ""
echo "3. 安装 Node.js 20.x..."

# 添加 NodeSource 仓库
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

# 安装 Node.js
apt install -y nodejs

print_status "Node.js 安装完成"

# 验证 Node.js 版本
echo ""
echo "Node.js 版本:"
node --version
print_status "Node.js 版本验证"

# 验证 npm 版本
echo ""
echo "npm 版本:"
npm --version
print_status "npm 版本验证"

# 安装 npm 全局�?echo ""
echo "4. 安装全局 npm �?.."

# 安装 Hardhat
echo "正在安装 Hardhat..."
npm install -g hardhat@2.22.0
print_status "Hardhat 安装完成"

# 验证 Hardhat 版本
echo ""
echo "Hardhat 版本:"
npx hardhat --version

# 安装 Wrangler CLI
echo ""
echo "正在安装 Wrangler CLI..."
npm install -g wrangler@3.78.0
print_status "Wrangler CLI 安装完成"

# 验证 Wrangler 版本
echo ""
echo "Wrangler CLI 版本:"
wrangler --version

# 安装其他有用的工�?echo ""
echo "5. 安装其他工具..."

# 安装 PM2 (进程管理�?
echo "正在安装 PM2..."
npm install -g pm2@5.4.2
print_status "PM2 安装完成"

# 验证 PM2 版本
echo ""
echo "PM2 版本:"
pm2 --version

# 安装 http-server (简单的静态文件服务器)
echo "正在安装 http-server..."
npm install -g http-server@14.1.1
print_status "http-server 安装完成"

# 配置 npm 镜像（可选，加速下载）
echo ""
echo "6. 配置 npm 镜像..."
npm config set registry https://registry.npmmirror.com
print_status "npm 镜像配置完成"

# 创建项目目录
echo ""
echo "7. 创建项目目录..."
mkdir -p /opt/xplan
mkdir -p /opt/xplan/contracts
mkdir -p /opt/xplan/logs
print_status "项目目录创建完成"

# 安装 Nginx（如果尚未安装）
echo ""
echo "8. 安装 Nginx..."
apt install -y nginx
print_status "Nginx 安装完成"

# 配置防火�?echo ""
echo "9. 配置防火�?.."
ufw --force enable
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 6060/tcp  # 应用端口
print_status "防火墙配置完�?

# 显示防火墙状�?echo ""
echo "防火墙状�?"
ufw status

# 创建系统日志目录
echo ""
echo "10. 配置系统日志..."
mkdir -p /var/log/xplan
chown -R root:root /var/log/xplan
chmod -R 755 /var/log/xplan
print_status "系统日志目录配置完成"

# 环境变量配置
echo ""
echo "11. 配置环境变量..."

# 创建 .bashrc 追加文件
cat >> /root/.bashrc << 'EOF'

# X-plan 环境变量
export XPLAN_HOME=/opt/xplan
export XPLAN_LOGS=/var/log/xplan
export PATH=$PATH:$XPLAN_HOME/bin

EOF

print_status "环境变量配置完成"

# 显示安装摘要
echo ""
echo "========================================="
echo "安装完成摘要"
echo "========================================="
echo ""

echo "已安装的软件�?"
echo ""
echo "  �?Node.js: $(node --version)"
echo "  �?npm: $(npm --version)"
echo "  �?Hardhat: $(npx hardhat --version)"
echo "  �?Wrangler CLI: $(wrangler --version)"
echo "  �?PM2: $(pm2 --version)"
echo "  �?http-server: $(http-server --version)"
echo "  �?Nginx: $(nginx -v 2>&1 | cut -d'/' -f2)"
echo ""

echo "配置的路�?"
echo ""
echo "  �?项目目录: /opt/xplan"
echo "  �?日志目录: /var/log/xplan"
echo "  �?Nginx 配置: /etc/nginx/"
echo ""

echo "开放的端口:"
echo ""
echo "  �?22/tcp   - SSH"
echo "  �?80/tcp   - HTTP"
echo "  �?443/tcp  - HTTPS"
echo "  �?6060/tcp - 应用端口"
echo ""

echo "环境变量:"
echo ""
echo "  �?XPLAN_HOME=/opt/xplan"
echo "  �?XPLAN_LOGS=/var/log/xplan"
echo ""

# 测试安装
echo ""
echo "12. 测试安装..."

# 测试 Node.js
node -e "console.log('Node.js 正常工作')" && print_status "Node.js 测试通过"

# 测试 npm
npm --version > /dev/null && print_status "npm 测试通过"

# 测试 Hardhat
npx hardhat --version > /dev/null && print_status "Hardhat 测试通过"

# 测试 Wrangler
wrangler --version > /dev/null && print_status "Wrangler CLI 测试通过"

# 测试 Nginx
systemctl is-active --quiet nginx && print_status "Nginx 运行�? || (echo -e "${RED}Nginx 未运�?{NC}" && systemctl start nginx)

# 显示后续步骤
echo ""
echo "========================================="
echo "后续步骤"
echo "========================================="
echo ""
echo "1. 配置 Nginx:"
echo "   复制 server-configs/xplan-demo.conf �?/etc/nginx/sites-available/"
echo "   创建符号链接�?/etc/nginx/sites-enabled/"
echo "   测试配置: nginx -t"
echo "   重载 Nginx: systemctl reload nginx"
echo ""

echo "2. 配置 GitHub Actions Secrets:"
echo "   �?SSH_PRIVATE_KEY - SSH 私钥"
echo "   �?SSH_HOST - 182.254.180.26"
echo "   �?SSH_USER - root"
echo ""

echo "3. 部署应用:"
echo "   克隆仓库: git clone https://github.com/xplan2026/xplandemo.git"
echo "   运行部署脚本: bash server-configs/deploy-frontend.sh"
echo ""

echo "4. 监控服务器健�?"
echo "   运行健康检�? bash server-configs/check-server-health.sh"
echo "   查看日志: tail -f /var/log/xplan/app.log"
echo ""

echo "========================================="
echo "安装完成�?
echo "========================================="

# 退�?exit 0
