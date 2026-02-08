#!/bin/bash

# 服务器端配置脚本 - 为 ubuntu 用户设置权限
# 服务器: 182.254.180.26
# 系统: Ubuntu 20.04

set -e

echo "========================================="
echo "配置 ubuntu 用户权限"
echo "========================================="
echo ""

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用 root 用户运行此脚本${NC}"
    echo "使用: sudo bash configure-ubuntu-user.sh"
    exit 1
fi

echo "步骤 1/5: 创建必要的目录..."
echo "----------------------------------------"

# 创建项目目录
mkdir -p /opt/xplan
mkdir -p /opt/xplan/contracts
mkdir -p /opt/xplan/logs
mkdir -p /var/log/xplan

# 创建 Web 目录
mkdir -p /var/www/xplan-official-site
mkdir -p /var/www/xplan-demosite

echo -e "${GREEN}✓${NC} 目录创建完成"

echo ""
echo "步骤 2/5: 设置目录权限..."
echo "----------------------------------------"

# 设置 Web 目录权限
chown -R ubuntu:www-data /var/www/
chmod -R 755 /var/www/

# 设置项目目录权限
chown -R ubuntu:ubuntu /opt/xplan/
chmod -R 755 /opt/xplan/

# 设置日志目录权限
chown -R ubuntu:ubuntu /var/log/xplan/
chmod -R 755 /var/log/xplan/

# 设置 Nginx 配置目录权限
chown -R root:root /etc/nginx/
chmod -R 755 /etc/nginx/

echo -e "${GREEN}✓${NC} 目录权限设置完成"

echo ""
echo "步骤 3/5: 配置 sudo 权限..."
echo "----------------------------------------"

# 为 ubuntu 用户添加 sudo 权限
if ! groups ubuntu | grep -q sudo; then
    echo "为 ubuntu 用户添加 sudo 权限..."
    usermod -aG sudo ubuntu
    echo -e "${GREEN}✓${NC} sudo 权限添加完成"
else
    echo -e "${YELLOW}⚠${NC} ubuntu 用户已有 sudo 权限"
fi

# 配置 sudoers 文件，允许 ubuntu 用户免密码执行 systemctl
if ! grep -q "ubuntu.*systemctl" /etc/sudoers; then
    echo "配置 systemctl 免密码..."
    echo "ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl" >> /etc/sudoers
    echo -e "${GREEN}✓${NC} systemctl 免密码配置完成"
else
    echo -e "${YELLOW}⚠${NC} systemctl 免密码已配置"
fi

echo ""
echo "步骤 4/5: 配置 SSH..."
echo "----------------------------------------"

# 确保 ubuntu 用户有 .ssh 目录
mkdir -p /home/ubuntu/.ssh
chmod 700 /home/ubuntu/.ssh

# 确保 authorized_keys 存在
touch /home/ubuntu/.ssh/authorized_keys
chmod 600 /home/ubuntu/.ssh/authorized_keys

chown -R ubuntu:ubuntu /home/ubuntu/.ssh

echo -e "${GREEN}✓${NC} SSH 配置完成"

echo ""
echo "步骤 5/5: 验证配置..."
echo "----------------------------------------"

# 验证 ubuntu 用户
echo "ubuntu 用户信息:"
id ubuntu

echo ""
echo "ubuntu 用户组:"
groups ubuntu

echo ""
echo "目录权限:"
ls -la /var/www/
ls -la /opt/xplan/
ls -la /var/log/xplan/

echo ""
echo "========================================="
echo "配置完成！"
echo "========================================="
echo ""

echo "摘要："
echo "  • ubuntu 用户已添加到 sudo 组"
echo "  • ubuntu 用户可以免密码执行 systemctl"
echo "  • Web 目录 (/var/www/) 所有权: ubuntu:www-data"
echo "  • 项目目录 (/opt/xplan/) 所有权: ubuntu:ubuntu"
echo "  • 日志目录 (/var/log/xplan/) 所有权: ubuntu:ubuntu"
echo ""

echo "后续步骤："
echo "  1. 在 GitHub 仓库中更新 SSH_USER Secret 为 'ubuntu'"
echo "  2. 测试 ubuntu 用户 SSH 登录"
echo "  3. 测试 sudo 权限: sudo systemctl status nginx"
echo ""

echo -e "${GREEN}配置完成！${NC}"
