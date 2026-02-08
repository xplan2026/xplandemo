# PowerShell 脚本 - 上传并在服务器上运行环境安装
# 需要在 Windows PowerShell 上执行

$ErrorActionPreference = "Stop"

# 服务器配置
$ServerHost = "182.254.180.26"
$ServerUser = "ubuntu"
$SshKeyPath = "$env:USERPROFILE\.ssh\xplan_server_key"
$InstallScript = "server-configs\install-server-environment.sh"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "上传服务器环境安装脚本" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 SSH 密钥
if (-not (Test-Path $SshKeyPath)) {
    Write-Host "错误: SSH 密钥不存在: $SshKeyPath" -ForegroundColor Red
    exit 1
}

# 检查安装脚本
if (-not (Test-Path $InstallScript)) {
    Write-Host "错误: 安装脚本不存在: $InstallScript" -ForegroundColor Red
    exit 1
}

# 上传安装脚本
Write-Host "上传安装脚本..." -ForegroundColor Yellow
scp -i $SshKeyPath $InstallScript "${ServerUser}@${ServerHost}:/tmp/"

# 在服务器上执行脚本
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "在服务器上执行安装脚本" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

ssh -i $SshKeyPath "${ServerUser}@${ServerHost}" @"
# 切换到 root 执行安装
sudo bash /tmp/install-server-environment.sh

# 安装完成后，验证
echo ""
echo "========================================="
echo "验证安装结果"
echo "========================================="
echo ""

echo "已安装软件："
which node && node --version || echo "Node.js: 未安装"
which npm && npm --version || echo "npm: 未安装"
which wrangler && wrangler --version || echo "Wrangler: 未安装"
which nginx && nginx -v 2>&1 || echo "Nginx: 未安装"
which pm2 && pm2 --version || echo "PM2: 未安装"

echo ""
echo "目录权限："
ls -la /var/www/ | grep xplan || echo "xplan 目录: 未创建"
ls -la /opt/xplan/ 2>/dev/null || echo "opt/xplan 目录: 未创建"
ls -la /var/log/xplan/ 2>/dev/null || echo "log/xplan 目录: 未创建"

echo ""
echo "Nginx 状态："
systemctl status nginx --no-pager -l | head -10

echo ""
echo "防火墙状态："
ufw status 2>/dev/null || echo "UFW 未启用"

echo ""
echo "✅ 验证完成"
"@

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "本地验证连接" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# 测试 SSH 连接
Write-Host "测试 SSH 连接..." -ForegroundColor Yellow
ssh -i $SshKeyPath "${ServerUser}@${ServerHost}" "echo '✅ SSH 连接成功'"

Write-Host ""
Write-Host "测试 sudo 权限..." -ForegroundColor Yellow
ssh -i $SshKeyPath "${ServerUser}@${ServerHost}" "sudo systemctl status nginx --no-pager | head -5"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "服务器环境安装完成！" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "后续步骤：" -ForegroundColor Cyan
Write-Host "  1. 在 GitHub 仓库中配置 Secrets" -ForegroundColor White
Write-Host "  2. 测试 GitHub Actions 部署" -ForegroundColor White
Write-Host "  3. 访问部署的网站" -ForegroundColor White
Write-Host ""
