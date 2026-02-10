#!/bin/bash
# 部署到服务器脚本（通过 Git Bundle）
# 创建时间: 2026-02-08

set -e

echo "=========================================="
echo "  部署代码到 Ubuntu 服务器"
echo "=========================================="
echo ""

SSH_KEY="$HOME/.ssh/xplan_server_key"
SSH_HOST="ubuntu@182.254.180.26"
REPO_DIR="d:/TOBEHOST/xplan2026"
BUNDLE_FILE="/tmp/xplandemo.bundle"

echo "📦 步骤 1: 创建 Git Bundle..."
cd "$REPO_DIR"
git bundle create "$BUNDLE_FILE" --all
echo "✅ Bundle 创建完成: $BUNDLE_FILE"
echo ""

echo "📤 步骤 2: 上传到服务器..."
scp -i "$SSH_KEY" "$BUNDLE_FILE" "$SSH_HOST:/tmp/"
echo "✅ 上传完成"
echo ""

echo "🔧 步骤 3: 在服务器上克隆..."
ssh -i "$SSH_KEY" "$SSH_HOST" << 'EOF'
cd /tmp
rm -rf xplandemo
git clone xplandemo.bundle xplandemo
cd xplandemo
echo "✅ 克隆完成"
echo ""
echo "📂 目录结构:"
ls -la
EOF

echo ""
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
echo ""
echo "接下来可以在服务器上运行配置脚本:"
echo "ssh -i $SSH_KEY $SSH_HOST \"cd /tmp/xplandemo && sudo bash server-configs/configure-ubuntu-user.sh\""
