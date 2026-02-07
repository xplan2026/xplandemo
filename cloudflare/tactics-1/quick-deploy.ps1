# X-plan Demo - Tactics-1 快速部署脚本
# 用途：配置 Secrets 并部署 Worker（从 .env 文件读取）
# 使用方法：cd 到 tactics-1 目录后执行此脚本
# PowerShell -ExecutionPolicy Bypass -File quick-deploy.ps1

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "X-plan Demo - Tactics-1 快速部署" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否在正确的目录
if (!(Test-Path "wrangler.toml")) {
    Write-Host "❌ 错误：请先 cd 到 tactics-1 目录" -ForegroundColor Red
    exit 1
}

# 检查 .env 文件是否存在
$envFilePath = "..\..\.env"
if (!(Test-Path $envFilePath)) {
    Write-Host "❌ 错误：.env 文件不存在" -ForegroundColor Red
    exit 1
}

# 读取 .env 文件
$envContent = Get-Content $envFilePath | Where-Object { $_ -match '^[A-Z_]+=' }
$envVars = @{}
foreach ($line in $envContent) {
    if ($line -match '^([A-Z_]+)=(.*)$') {
        $envVars[$matches[1]] = $matches[2]
    }
}

Write-Host "步骤 1/3: 配置 Worker Secrets" -ForegroundColor Yellow
Write-Host "-------------------------------------------" -ForegroundColor Gray
Write-Host ""

# 设置 API Key
Write-Host "📝 [1/6] 配置 API_KEY..." -ForegroundColor Yellow
$envVars['API_SECRET_KEY'] | npx wrangler secret put API_KEY

# 设置 Supabase URL
Write-Host "📝 [2/6] 配置 SUPABASE_URL..." -ForegroundColor Yellow
$envVars['SUPABASE_URL'] | npx wrangler secret put SUPABASE_URL

# 设置 Supabase Key
Write-Host "📝 [3/6] 配置 SUPABASE_KEY..." -ForegroundColor Yellow
$envVars['SUPABASE_ANON_KEY'] | npx wrangler secret put SUPABASE_KEY

# 设置被保护钱包私钥（地址 A）
Write-Host "📝 [4/6] 配置被保护钱包私钥 (地址 A)..." -ForegroundColor Yellow
$envVars['PROTECTED_PRIVATE_KEY'] | npx wrangler secret put WALLET_PRIVATE_KEY_32af405726ba6bd2f9b7ecdfed3bdd9b590c0939

# 设置安全钱包私钥（地址 B）
Write-Host "📝 [5/6] 配置安全钱包私钥 (地址 B)..." -ForegroundColor Yellow
$envVars['SAFE_PRIVATE_KEY'] | npx wrangler secret put SAFE_WALLET_PRIVATE_KEY

# 设置 Gas 费钱包私钥（地址 C）
Write-Host "📝 [6/6] 配置 Gas 费钱包私钥 (地址 C)..." -ForegroundColor Yellow
$envVars['GAS_PRIVATE_KEY'] | npx wrangler secret put GAS_FUNDING_WALLET_PRIVATE_KEY

Write-Host ""
Write-Host "✅ 所有 Secrets 配置完成" -ForegroundColor Green
Write-Host ""

Write-Host "步骤 2/3: 验证 Secrets 配置" -ForegroundColor Yellow
Write-Host "-------------------------------------------" -ForegroundColor Gray
Write-Host ""
Write-Host "当前配置的 Secrets:" -ForegroundColor Cyan
npx wrangler secret list
Write-Host ""

Write-Host "步骤 3/3: 部署 Worker" -ForegroundColor Yellow
Write-Host "-------------------------------------------" -ForegroundColor Gray
Write-Host ""

# 设置环境变量（从 .env 读取）
$env:CLOUDFLARE_API_TOKEN = $envVars['CLOUDFLARE_API_TOKEN']
$env:CLOUDFLARE_ACCOUNT_ID = $envVars['CLOUDFLARE_ACCOUNT_ID']

Write-Host "🚀 开始部署 Worker..." -ForegroundColor Yellow
npx wrangler deploy

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🎉 部署完成！" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📌 Worker URL:" -ForegroundColor Yellow
Write-Host "  https://tactics-1.xplan2026.workers.dev" -ForegroundColor White
Write-Host ""
Write-Host "📌 测试端点:" -ForegroundColor Yellow
Write-Host "  健康检查: https://tactics-1.xplan2026.workers.dev/health" -ForegroundColor White
Write-Host "  API 文档: https://tactics-1.xplan2026.workers.dev/api-docs" -ForegroundColor White
Write-Host "  状态查询: https://tactics-1.xplan2026.workers.dev/status" -ForegroundColor White
Write-Host ""
