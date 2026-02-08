#!/bin/bash

# IPFS 部署脚本（本地使用）

set -e

# 配置变量
PINATA_API_KEY="${PINATA_API_KEY:-your_api_key}"
PINATA_API_SECRET="${PINATA_API_SECRET:-your_api_secret}"
PINATA_JWT="${PINATA_JWT:-your_jwt_token}"
BUILD_DIR="./frontend/official-site/dist"

# 检查 build 目录
if [ ! -d "$BUILD_DIR" ]; then
    echo "❌ 构建目录不存在: $BUILD_DIR"
    echo "请先运行: cd frontend/official-site && npm run build"
    exit 1
fi

echo "开始上传到 IPFS..."
echo "构建目录: $BUILD_DIR"
echo ""

# 使用 Pinata CLI 上传
if command -v pinata &> /dev/null; then
    echo "使用 Pinata CLI 上传..."
    CID=$(pinata upload-dir "$BUILD_DIR" --cid-version 1 | jq -r '.IpfsHash')
else
    echo "⚠️  Pinata CLI 未安装，尝试使用 Node.js 脚本..."
    if [ ! -f ".github/scripts/upload-ipfs.js" ]; then
        echo "❌ IPFS 上传脚本不存在"
        exit 1
    fi

    # 安装依赖
    echo "安装 Pinata SDK..."
    npm install --silent @pinata/sdk

    # 设置环境变量
    export PINATA_JWT="$PINATA_JWT"

    # 运行上传脚本
    node .github/scripts/upload-ipfs.js
    exit 0
fi

if [ -z "$CID" ]; then
    echo "❌ 上传失败，无法获取 CID"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ IPFS 部署完成"
echo "=========================================="
echo ""
echo "IPFS CID: $CID"
echo ""
echo "访问地址："
echo "  🌐 IPFS Gateway: https://gateway.pinata.cloud/ipfs/$CID"
echo "  🔗 Dweb Link: https://ipfs.io/ipfs/$CID"
echo ""
echo "=========================================="
