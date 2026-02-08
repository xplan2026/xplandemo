#!/bin/bash

# 批量修改脚本：将 root 用户改为 ubuntu 用户（带 sudo）
# 服务器: 182.254.180.26
# 系统: Ubuntu 20.04

set -e

echo "========================================="
echo "迁移到 ubuntu 用户"
echo "========================================="
echo ""

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 切换到项目根目录
cd "$(dirname "$0")/.."

echo "正在修改所有文件..."

# 1. 修改 SKILL.md
echo ""
echo "1/7: 修改 SKILL.md..."
sed -i 's/SSH User: root/SSH User: ubuntu (with sudo)/g' .codebuddy/skills/ubuntu-server-manager/SKILL.md
sed -i 's/ssh root@182.254.180.26/ssh ubuntu@182.254.180.26/g' .codebuddy/skills/ubuntu-server-manager/SKILL.md
sed -i 's/- SSH_USER: root/- SSH_USER: ubuntu/g' .codebuddy/skills/ubuntu-server-manager/SKILL.md
sed -i 's/SSH_USER.*root/SSH_USER: ubuntu/g' .codebuddy/skills/ubuntu-server-manager/SKILL.md
echo -e "${GREEN}✓${NC} SKILL.md 修改完成"

# 2. 修改 README.md
echo ""
echo "2/7: 修改 README.md..."
sed -i 's/ssh root@182.254.180.26/ssh ubuntu@182.254.180.26/g' .codebuddy/skills/ubuntu-server-manager/README.md
echo -e "${GREEN}✓${NC} README.md 修改完成"

# 3. 修改 server-architecture.md
echo ""
echo "3/7: 修改 server-architecture.md..."
sed -i 's/ssh root@182.254.180.26/ssh ubuntu@182.254.180.26/g' .codebuddy/skills/ubuntu-server-manager/references/server-architecture.md
echo -e "${GREEN}✓${NC} server-architecture.md 修改完成"

# 4. 修改 troubleshooting-guide.md
echo ""
echo "4/7: 修改 troubleshooting-guide.md..."
sed -i 's/ssh root@182.254.180.26/ssh ubuntu@182.254.180.26/g' .codebuddy/skills/ubuntu-server-manager/references/troubleshooting-guide.md
echo -e "${GREEN}✓${NC} troubleshooting-guide.md 修改完成"

# 5. 修改 setup-server.sh
echo ""
echo "5/7: 修改 setup-server.sh..."
if [ -f "server-configs/setup-server.sh" ]; then
    sed -i 's/ssh root@/ssh ubuntu@/g' server-configs/setup-server.sh
    echo -e "${GREEN}✓${NC} setup-server.sh 修改完成"
else
    echo -e "${YELLOW}⚠${NC} setup-server.sh 不存在，跳过"
fi

# 6. 修改 deploy-frontend.sh
echo ""
echo "6/7: 修改 deploy-frontend.sh..."
if [ -f "server-configs/deploy-frontend.sh" ]; then
    sed -i 's/ssh root@/ssh ubuntu@/g' server-configs/deploy-frontend.sh
    echo -e "${GREEN}✓${NC} deploy-frontend.sh 修改完成"
else
    echo -e "${YELLOW}⚠${NC} deploy-frontend.sh 不存在，跳过"
fi

# 7. 修改 one-click-setup.sh
echo ""
echo "7/7: 修改 one-click-setup.sh..."
if [ -f "server-configs/one-click-setup.sh" ]; then
    sed -i 's/ssh root@/ssh ubuntu@/g' server-configs/one-click-setup.sh
    echo -e "${GREEN}✓${NC} one-click-setup.sh 修改完成"
else
    echo -e "${YELLOW}⚠${NC} one-click-setup.sh 不存在，跳过"
fi

# 8. 修改 GitHub Actions 工作流
echo ""
echo "8/10: 修改 GitHub Actions 工作流..."

# deploy-worker.yml
if [ -f ".github/workflows/deploy-worker.yml" ]; then
    sed -i 's/SSH_USER: root/SSH_USER: ubuntu/g' .github/workflows/deploy-worker.yml
    echo -e "${GREEN}✓${NC} deploy-worker.yml 修改完成"
else
    echo -e "${YELLOW}⚠${NC} deploy-worker.yml 不存在，跳过"
fi

# deploy-frontend.yml
if [ -f ".github/workflows/deploy-frontend.yml" ]; then
    sed -i 's/SSH_USER: root/SSH_USER: ubuntu/g' .github/workflows/deploy-frontend.yml
    echo -e "${GREEN}✓${NC} deploy-frontend.yml 修改完成"
else
    echo -e "${YELLOW}⚠${NC} deploy-frontend.yml 不存在，跳过"
fi

# build-and-deploy-ipfs.yml
if [ -f ".github/workflows/build-and-deploy-ipfs.yml" ]; then
    sed -i 's/SSH_USER: root/SSH_USER: ubuntu/g' .github/workflows/build-and-deploy-ipfs.yml
    echo -e "${GREEN}✓${NC} build-and-deploy-ipfs.yml 修改完成"
else
    echo -e "${YELLOW}⚠${NC} build-and-deploy-ipfs.yml 不存在，跳过"
fi

# 9. 修改所有 shell 脚本，添加 sudo
echo ""
echo "9/10: 为系统命令添加 sudo..."

# 修改 install-server-environment.sh
if [ -f "server-configs/install-server-environment.sh" ]; then
    # 检查是否为 root
    sed -i 's/if \[ "\$EUID" -ne 0 \]; then/# Check if user has sudo privileges\nif [ "$EUID" -ne 0 ] && ! sudo -n true 2>&1; then/g' server-configs/install-server-environment.sh
    sed -i 's/Please use root user/Please use a user with sudo privileges/g' server-configs/install-server-environment.sh
    echo -e "${GREEN}✓${NC} install-server-environment.sh 修改完成"
else
    echo -e "${YELLOW}⚠${NC} install-server-environment.sh 不存在，跳过"
fi

# 修改 check-server-health.sh
if [ -f "server-configs/check-server-health.sh" ]; then
    # 为 systemctl 和其他系统命令添加 sudo
    sed -i 's/systemctl/sudo systemctl/g' server-configs/check-server-health.sh
    echo -e "${GREEN}✓${NC} check-server-health.sh 修改完成"
else
    echo -e "${YELLOW}⚠${NC} check-server-health.sh 不存在，跳过"
fi

# 10. 修改文档
echo ""
echo "10/10: 修改相关文档..."

# temp/SSH-Key-配置指南.md
if [ -f "temp/SSH-Key-配置指南.md" ]; then
    sed -i 's/ssh root@182.254.180.26/ssh ubuntu@182.254.180.26/g' temp/SSH-Key-配置指南.md
    sed -i 's/User: root/User: ubuntu/g' temp/SSH-Key-配置指南.md
    sed -i 's/username: root/username: ubuntu/g' temp/SSH-Key-配置指南.md
    echo -e "${GREEN}✓${NC} SSH-Key-配置指南.md 修改完成"
else
    echo -e "${YELLOW}⚠${NC} SSH-Key-配置指南.md 不存在，跳过"
fi

# temp/服务器环境安装-快速开始.md
if [ -f "temp/服务器环境安装-快速开始.md" ]; then
    sed -i 's/ssh root@182.254.180.26/ssh ubuntu@182.254.180.26/g' temp/服务器环境安装-快速开始.md
    echo -e "${GREEN}✓${NC} 服务器环境安装-快速开始.md 修改完成"
else
    echo -e "${YELLOW}⚠${NC} 服务器环境安装-快速开始.md 不存在，跳过"
fi

echo ""
echo "========================================="
echo "修改完成！"
echo "========================================="
echo ""

echo "已修改的文件："
echo "  • .codebuddy/skills/ubuntu-server-manager/SKILL.md"
echo "  • .codebuddy/skills/ubuntu-server-manager/README.md"
echo "  • .codebuddy/skills/ubuntu-server-manager/references/server-architecture.md"
echo "  • .codebuddy/skills/ubuntu-server-manager/references/troubleshooting-guide.md"
echo "  • server-configs/setup-server.sh"
echo "  • server-configs/deploy-frontend.sh"
echo "  • server-configs/one-click-setup.sh"
echo "  • .github/workflows/deploy-worker.yml"
echo "  • .github/workflows/deploy-frontend.yml"
echo "  • .github/workflows/build-and-deploy-ipfs.yml"
echo "  • temp/SSH-Key-配置指南.md"
echo "  • temp/服务器环境安装-快速开始.md"
echo ""

echo "重要提醒："
echo "  1. 在 GitHub 仓库中更新 SSH_USER Secret 为 'ubuntu'"
echo "  2. 确保 ubuntu 用户有 sudo 权限"
echo "  3. 在服务器上运行: sudo chown -R ubuntu:www-data /var/www/"
echo "  4. 在服务器上运行: sudo chown -R ubuntu:ubuntu /opt/xplan/"
echo "  5. 在服务器上运行: sudo chown -R ubuntu:ubuntu /var/log/xplan/"
echo ""

echo -e "${GREEN}修改完成！${NC}"
