# X-plan Demo - Tactics-1 Worker Secrets 配置脚本
# 用途：批量设置所有 Worker Secrets（从 .env 文件读取）
# 使用方法：cd 到 tactics-1 目录后执行此脚本
# PowerShell -ExecutionPolicy Bypass -File setup-secrets.ps1

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "X-plan Demo - Tactics-1 Secrets 配置" -ForegroundColor Cyan
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

# 设置 API Key
Write-Host "📝 配置 API_KEY..." -ForegroundColor Yellow
$envVars['API_SECRET_KEY'] | npx wrangler secret put API_KEY
Write-Host "✅ API_KEY 配置完成" -ForegroundColor Green
Write-Host ""

# 设置 Supabase URL
Write-Host "📝 配置 SUPABASE_URL..." -ForegroundColor Yellow
$envVars['SUPABASE_URL'] | npx wrangler secret put SUPABASE_URL
Write-Host "✅ SUPABASE_URL 配置完成" -ForegroundColor Green
Write-Host ""

# 设置 Supabase Key
Write-Host "📝 配置 SUPABASE_KEY..." -ForegroundColor Yellow
$envVars['SUPABASE_ANON_KEY'] | npx wrangler secret put SUPABASE_KEY
Write-Host "✅ SUPABASE_KEY 配置完成" -ForegroundColor Green
Write-Host ""

# 设置被保护钱包私钥（地址 A）
Write-Host "📝 配置被保护钱包私钥 (地址 A)..." -ForegroundColor Yellow
$envVars['PROTECTED_PRIVATE_KEY'] | npx wrangler secret put WALLET_PRIVATE_KEY_32af405726ba6bd2f9b7ecdfed3bdd9b590c0939
Write-Host "✅ 被保护钱包私钥配置完成" -ForegroundColor Green
Write-Host ""

# 设置安全钱包私钥（地址 B）
Write-Host "📝 配置安全钱包私钥 (地址 B)..." -ForegroundColor Yellow
$envVars['SAFE_PRIVATE_KEY'] | npx wrangler secret put SAFE_WALLET_PRIVATE_KEY
Write-Host "✅ 安全钱包私钥配置完成" -ForegroundColor Green
Write-Host ""

# 设置 Gas 费钱包私钥（地址 C）
Write-Host "📝 配置 Gas 费钱包私钥 (地址 C)..." -ForegroundColor Yellow
$envVars['GAS_PRIVATE_KEY'] | npx wrangler secret put GAS_FUNDING_WALLET_PRIVATE_KEY
Write-Host "✅ Gas 费钱包私钥配置完成" -ForegroundColor Green
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🎉 所有 Secrets 配置完成！" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "验证配置：" -ForegroundColor Yellow
Write-Host "  npx wrangler secret list" -ForegroundColor White
Write-Host ""
