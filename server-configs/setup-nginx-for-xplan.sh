#!/bin/bash

# Nginx 配置脚本 - X-plan 项目
# 用途：上传并配置 Nginx

set -e

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================="
echo "配置 Nginx - X-plan 项目"
echo "========================================="
echo ""

# 停用现有站点
echo -e "${YELLOW}[1/5]${NC} 停用现有 Nginx 站点..."
sudo rm -f /etc/nginx/sites-enabled/guard-plus
sudo rm -f /etc/nginx/sites-enabled/scope.yuleague.top
sudo rm -f /etc/nginx/sites-enabled/default

# 删除现有配置
echo -e "${GREEN}[2/5]${NC} 删除现有配置文件..."
sudo rm -f /etc/nginx/sites-available/guard-plus
sudo rm -f /etc/nginx/sites-available/scope.yuleague.top
sudo rm -f /etc/nginx/sites-available/default

# 创建新配置
echo -e "${GREEN}[3/5]${NC} 创建 X-plan Nginx 配置..."
sudo tee /etc/nginx/sites-available/xplan > /dev/null << 'EOF'
# X-plan 官方网站配置
server {
    listen 6060;
    server_name _;

    root /var/www/xplan-official-site;
    index index.html;

    access_log /var/log/nginx/xplan-official-access.log;
    error_log /var/log/nginx/xplan-official-error.log;

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF

# 启用站点
echo -e "${GREEN}[4/5]${NC} 启用 X-plan 站点..."
sudo ln -sf /etc/nginx/sites-available/xplan /etc/nginx/sites-enabled/xplan

# 测试配置
echo -e "${GREEN}[5/5]${NC} 测试 Nginx 配置..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅${NC} Nginx 配置测试通过"
else
    echo -e "${YELLOW}⚠${NC}  Nginx 配置测试失败，请检查配置"
    exit 1
fi

# 重新加载 Nginx
echo ""
echo "重新加载 Nginx..."
sudo systemctl reload nginx

# 验证 Nginx 状态
echo ""
echo "验证 Nginx 状态..."
sudo systemctl status nginx --no-pager | head -10

echo ""
echo "========================================="
echo "Nginx 配置完成！"
echo "========================================="
echo ""
echo "访问地址："
echo "  • 官网: http://182.254.180.26:6060"
echo ""
echo "日志文件："
echo "  • 访问日志: /var/log/nginx/xplan-official-access.log"
echo "  • 错误日志: /var/log/nginx/xplan-official-error.log"
echo ""
echo -e "${GREEN}✅ 配置完成！${NC}"
