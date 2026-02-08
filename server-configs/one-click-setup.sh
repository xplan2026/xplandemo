#!/bin/bash

# 一键部署脚本 - Ubuntu 服务器初始化
# 服务器: 182.254.180.26
# 系统: Ubuntu 20.04
# 用途: 初始化服务器、安装环境、配置 SSH Key

set -e

echo "========================================="
echo "X-plan 服务器一键部署"
echo "========================================="
echo ""
echo "服务器: 182.254.180.26"
echo "系统: Ubuntu 20.04"
echo ""

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用 root 用户运行此脚本${NC}"
    echo "使用: sudo bash one-click-setup.sh"
    exit 1
fi

# 步骤 1: 安装服务器环境
echo ""
echo -e "${BLUE}步骤 1/4: 安装服务器环境${NC}"
echo "----------------------------------------"

if [ -f "install-server-environment.sh" ]; then
    bash install-server-environment.sh
    echo -e "${GREEN}✓${NC} 环境安装完成"
else
    echo -e "${RED}✗${NC} 找不到 install-server-environment.sh"
    exit 1
fi

# 步骤 2: 克隆仓库
echo ""
echo -e "${BLUE}步骤 2/4: 克隆 X-plan 仓库${NC}"
echo "----------------------------------------"

# 切换到临时目录
cd /tmp

# 删除旧的克隆（如果存在）
if [ -d "xplandemo" ]; then
    echo "删除旧的克隆..."
    rm -rf xplandemo
fi

# 克隆仓库
echo "正在克隆仓库..."
git clone https://github.com/xplan2026/xplandemo.git

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} 仓库克隆成功"
else
    echo -e "${RED}✗${NC} 仓库克隆失败"
    exit 1
fi

# 进入项目目录
cd xplandemo

# 步骤 3: 配置 Nginx
echo ""
echo -e "${BLUE}步骤 3/4: 配置 Nginx${NC}"
echo "----------------------------------------"

# 复制 Nginx 配置文件
if [ -f "server-configs/xplan-demo.conf" ]; then
    echo "复制 Nginx 配置文件..."
    cp server-configs/xplan-demo.conf /etc/nginx/sites-available/xplan-demo.conf

    # 创建符号链接
    echo "创建符号链接..."
    ln -sf /etc/nginx/sites-available/xplan-demo.conf /etc/nginx/sites-enabled/xplan-demo.conf

    # 测试配置
    echo "测试 Nginx 配置..."
    if nginx -t; then
        echo -e "${GREEN}✓${NC} Nginx 配置测试通过"
    else
        echo -e "${RED}✗${NC} Nginx 配置测试失败"
        exit 1
    fi

    # 重载 Nginx
    echo "重载 Nginx..."
    systemctl reload nginx
    echo -e "${GREEN}✓${NC} Nginx 配置完成"
else
    echo -e "${YELLOW}⚠${NC} 找不到 Nginx 配置文件，跳过此步骤"
fi

# 创建 Web 目录
echo ""
echo "创建 Web 目录..."
mkdir -p /var/www/xplan-official-site
mkdir -p /var/www/xplan-demosite
chown -R www-data:www-data /var/www/
chmod -R 755 /var/www/
echo -e "${GREEN}✓${NC} Web 目录创建完成"

# 步骤 4: 配置 SSH Key（提示用户）
echo ""
echo -e "${BLUE}步骤 4/4: 配置 SSH Key${NC}"
echo "----------------------------------------"
echo ""
echo "请按照以下步骤配置 SSH Key："
echo ""
echo "1. 在本地机器上生成 SSH Key:"
echo "   ssh-keygen -t ed25519 -C \"xplan2026@163.com\" -f ~/.ssh/xplan_key"
echo ""
echo "2. 复制公钥到服务器:"
echo "   cat ~/.ssh/xplan_key.pub | ssh root@182.254.180.26 \"cat >> ~/.ssh/authorized_keys\""
echo ""
echo "3. 配置 GitHub Secrets:"
echo "   • SSH_PRIVATE_KEY - 粘贴私钥内容"
echo "   • SSH_HOST - 182.254.180.26"
echo "   • SSH_USER - root"
echo ""
echo "详细指南请查看: temp/SSH-Key-配置指南.md"
echo ""

# 询问是否现在配置 SSH Key
read -p "是否现在配置 SSH Key? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "请粘贴你的 SSH 公钥内容（按 Ctrl+D 结束）："

    # 创建 .ssh 目录（如果不存在）
    mkdir -p ~/.ssh
    chmod 700 ~/.ssh

    # 创建 authorized_keys（如果不存在）
    touch ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys

    # 读取公钥
    cat > ~/.ssh/xplan_key_temp.pub
    cat ~/.ssh/xplan_key_temp.pub >> ~/.ssh/authorized_keys
    rm ~/.ssh/xplan_key_temp.pub

    echo -e "${GREEN}✓${NC} SSH 公钥已添加"
    echo ""
    echo "现在你可以在本地使用以下命令登录（无需密码）："
    echo "  ssh -i ~/.ssh/xplan_key root@182.254.180.26"
else
    echo -e "${YELLOW}⚠${NC} 跳过 SSH Key 配置"
fi

# 部署摘要
echo ""
echo "========================================="
echo "部署完成摘要"
echo "========================================="
echo ""

echo "✓ 服务器环境安装"
echo "  • Node.js, npm, Hardhat, Wrangler CLI"
echo "  • Nginx, PM2, http-server"
echo "  • 防火墙配置"
echo ""

echo "✓ 仓库克隆"
echo "  • 位置: /tmp/xplandemo"
echo ""

echo "✓ Nginx 配置"
echo "  • 配置文件: /etc/nginx/sites-available/xplan-demo.conf"
echo "  • Web 目录:"
echo "    - /var/www/xplan-official-site"
echo "    - /var/www/xplan-demosite"
echo ""

echo "✓ SSH Key"
echo "  • 状态: $(grep -q "xplan" ~/.ssh/authorized_keys && echo "已配置" || echo "待配置")"
echo ""

# 显示服务状态
echo "========================================="
echo "服务状态"
echo "========================================="
echo ""

systemctl status nginx --no-pager | head -n 5

echo ""
echo "开放的端口:"
ufw status numbered

# 显示后续步骤
echo ""
echo "========================================="
echo "后续步骤"
echo "========================================="
echo ""

echo "1. 测试服务器连接:"
echo "   curl http://182.254.180.26:6060"
echo ""

echo "2. 配置 GitHub Actions Secrets:"
echo "   访问: https://github.com/xplan2026/xplandemo/settings/secrets/actions"
echo "   添加:"
echo "   • CLOUDFLARE_API_TOKEN"
echo "   • CLOUDFLARE_ACCOUNT_ID"
echo "   • SSH_PRIVATE_KEY"
echo "   • SSH_HOST"
echo "   • SSH_USER"
echo "   • PINATA_API_KEY"
echo "   • PINATA_API_SECRET"
echo "   • PINATA_JWT"
echo ""

echo "3. 部署应用:"
echo "   方式 1: 通过 GitHub Actions 自动部署"
echo "   方式 2: 手动运行: bash server-configs/deploy-frontend.sh"
echo ""

echo "4. 监控服务器:"
echo "   bash server-configs/check-server-health.sh"
echo ""

echo "========================================="
echo "部署完成！"
echo "========================================="

# 创建安装日志
INSTALL_LOG="/var/log/xplan/installation-$(date +%Y%m%d-%H%M%S).log"
echo "安装日志: $INSTALL_LOG"

echo "安装时间: $(date)" > "$INSTALL_LOG"
echo "Node.js 版本: $(node --version)" >> "$INSTALL_LOG"
echo "npm 版本: $(npm --version)" >> "$INSTALL_LOG"
echo "Nginx 状态: $(systemctl is-active nginx)" >> "$INSTALL_LOG"

exit 0
