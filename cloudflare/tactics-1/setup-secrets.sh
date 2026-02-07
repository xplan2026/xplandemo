#!/bin/bash

# X-plan Demo - Tactics-1 Worker Secrets 配置脚本
# 用途：批量设置所有 Worker Secrets
# 使用方法：cd 到 tactics-1 目录后执行此脚本

set -e

echo "=========================================="
echo "X-plan Demo - Tactics-1 Secrets 配置"
echo "=========================================="
echo ""

# 检查是否在正确的目录
if [ ! -f "wrangler.toml" ]; then
    echo "❌ 错误：请先 cd 到 tactics-1 目录"
    exit 1
fi

# 检查 .env 文件是否存在
if [ ! -f "../../../.env" ]; then
    echo "❌ 错误：.env 文件不存在"
    exit 1
fi

# 读取 .env 文件中的配置
source "../../../.env"

# 设置 API Key
echo "📝 配置 API_KEY..."
echo "$API_SECRET_KEY" | npx wrangler secret put API_KEY
echo "✅ API_KEY 配置完成"
echo ""

# 设置 Supabase URL
echo "📝 配置 SUPABASE_URL..."
echo "$SUPABASE_URL" | npx wrangler secret put SUPABASE_URL
echo "✅ SUPABASE_URL 配置完成"
echo ""

# 设置 Supabase Key
echo "📝 配置 SUPABASE_KEY..."
echo "$SUPABASE_ANON_KEY" | npx wrangler secret put SUPABASE_KEY
echo "✅ SUPABASE_KEY 配置完成"
echo ""

# 设置被保护钱包私钥（地址 A）
echo "📝 配置被保护钱包私钥 (地址 A)..."
echo "$PROTECTED_PRIVATE_KEY" | npx wrangler secret put WALLET_PRIVATE_KEY_32af405726ba6bd2f9b7ecdfed3bdd9b590c0939
echo "✅ 被保护钱包私钥配置完成"
echo ""

# 设置安全钱包私钥（地址 B）
echo "📝 配置安全钱包私钥 (地址 B)..."
echo "$SAFE_PRIVATE_KEY" | npx wrangler secret put SAFE_WALLET_PRIVATE_KEY
echo "✅ 安全钱包私钥配置完成"
echo ""

# 设置 Gas 费钱包私钥（地址 C）
echo "📝 配置 Gas 费钱包私钥 (地址 C)..."
echo "$GAS_PRIVATE_KEY" | npx wrangler secret put GAS_FUNDING_WALLET_PRIVATE_KEY
echo "✅ Gas 费钱包私钥配置完成"
echo ""

echo "=========================================="
echo "🎉 所有 Secrets 配置完成！"
echo "=========================================="
echo ""
echo "验证配置："
echo "  npx wrangler secret list"
echo ""
