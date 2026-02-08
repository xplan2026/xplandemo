#!/bin/bash
# Server Skill 功能测试脚本
# 创建时间: 2026-02-08

echo "=========================================="
echo "  Ubuntu Server Skill 功能测试"
echo "=========================================="
echo ""

SSH_KEY="$HOME/.ssh/xplan_server_key"
SSH_HOST="ubuntu@182.254.180.26"
SSH_CMD="ssh -i $SSH_KEY $SSH_HOST"

# 测试 1：基本连接
echo "📋 测试 1: SSH 基本连接"
$SSH_CMD "echo '✅ SSH 连接成功' && whoami"
echo ""

# 测试 2：服务器信息
echo "📋 测试 2: 服务器信息"
$SSH_CMD "cat /etc/os-release | grep PRETTY_NAME && uname -r && free -h | grep Mem"
echo ""

# 测试 3：文件传输
echo "📋 测试 3: 文件传输"
echo "测试文件 - $(date)" > /tmp/test-skill.txt
scp -i $SSH_KEY /tmp/test-skill.txt $SSH_HOST:/tmp/
$SSH_CMD "cat /tmp/test-skill.txt && rm /tmp/test-skill.txt"
echo ""

# 测试 4：远程命令（sudo）
echo "📋 测试 4: 远程命令执行（sudo）"
$SSH_CMD "sudo systemctl status nginx | grep Active || echo 'Nginx 未运行或未安装'"
echo ""

# 测试 5：Git 克隆
echo "📋 测试 5: Git 仓库克隆"
$SSH_CMD "cd /tmp && rm -rf xplandemo-test && git clone https://github.com/xplan2026/xplandemo.git xplandemo-test && ls -la xplandemo-test/server-configs/ && rm -rf xplandemo-test"
echo ""

# 测试 6：环境检查
echo "📋 测试 6: 软件环境检查"
$SSH_CMD "echo '=== Node.js ===' && which node && node --version 2>&1 || echo '未安装 Node.js' && echo '' && echo '=== npm ===' && which npm && npm --version 2>&1 || echo '未安装 npm' && echo '' && echo '=== Nginx ===' && which nginx && nginx -v 2>&1 || echo '未安装 Nginx' && echo '' && echo '=== Hardhat ===' && which hardhat && npx hardhat --version 2>&1 || echo '未安装 Hardhat' && echo '' && echo '=== Wrangler ===' && which wrangler && wrangler --version 2>&1 || echo '未安装 Wrangler'"
echo ""

# 测试 7：磁盘空间
echo "📋 测试 7: 磁盘空间"
$SSH_CMD "df -h | head -5"
echo ""

# 测试 8：防火墙状态
echo "📋 测试 8: 防火墙状态"
$SSH_CMD "sudo ufw status"
echo ""

echo "=========================================="
echo "  测试完成！"
echo "=========================================="
