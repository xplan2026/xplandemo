#!/bin/bash

# X-plan Official Site 前端部署脚本
# Ubuntu 服务器部署脚本

set -e  # 遇到错误立即退出

# 配置变量
SERVER_USER="ubuntu"
SERVER_HOST="182.254.180.26"
SERVER_PORT="22"
SSH_KEY="/tmp/ssh_key/xplan_key"
DEPLOY_PATH="/var/www/xplan-official-site"
NGINX_CONF="/etc/nginx/sites-available/xplan"
NGINX_ENABLED="/etc/nginx/sites-enabled"
BACKUP_DIR="/home/ubuntu/backups/xplan-official-site"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}X-plan Official Site 前端部署脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查 SSH 连接
echo -e "${YELLOW}检查 SSH 连接...${NC}"
if ! ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_HOST} "echo 'SSH 连接成功'" > /dev/null 2>&1; then
    echo -e "${RED}❌ SSH 连接失败，请检查服务器地址和密钥配置${NC}"
    exit 1
fi
echo -e "${GREEN}✅ SSH 连接成功${NC}"
echo ""

# 创建备份
echo -e "${YELLOW}创建备份...${NC}"
ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_HOST} "mkdir -p ${BACKUP_DIR} && if [ -d ${DEPLOY_PATH} ]; then tar -czf ${BACKUP_DIR}/backup-$(date +%Y%m%d-%H%M%S).tar.gz ${DEPLOY_PATH} 2>/dev/null || true; fi"
echo -e "${GREEN}✅ 备份完成${NC}"
echo ""

# 部署官网前端
echo -e "${YELLOW}部署官网前端...${NC}"
# 先上传到临时目录
TEMP_DEPLOY="/tmp/xplan-deploy"
rsync -avz -e "ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no -p ${SERVER_PORT}" \
    --exclude 'node_modules' \
    --exclude '.git' \
    ../frontend/official-site/dist/ \
    ${SERVER_USER}@${SERVER_HOST}:${TEMP_DEPLOY}/

# 使用 sudo 移动文件并设置权限
ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_HOST} \
    "sudo rm -rf ${DEPLOY_PATH} && sudo mkdir -p ${DEPLOY_PATH} && sudo cp -r ${TEMP_DEPLOY}/* ${DEPLOY_PATH}/ && sudo rm -rf ${TEMP_DEPLOY}"

echo -e "${GREEN}✅ 官网前端部署完成${NC}"
echo ""

# 设置权限
echo -e "${YELLOW}设置文件权限...${NC}"
ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_HOST} \
    "sudo chown -R www-data:www-data ${DEPLOY_PATH} && sudo chmod -R 755 ${DEPLOY_PATH}"
echo -e "${GREEN}✅ 权限设置完成${NC}"
echo ""

# 部署 Nginx 配置
echo -e "${YELLOW}部署 Nginx 配置...${NC}"
scp -i ${SSH_KEY} -o StrictHostKeyChecking=no -P ${SERVER_PORT} xplan-demo.conf \
    ${SERVER_USER}@${SERVER_HOST}:/tmp/xplan.conf

ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_HOST} \
    "sudo mv /tmp/xplan.conf ${NGINX_CONF} && sudo ln -sf ${NGINX_CONF} ${NGINX_ENABLED}/xplan"
echo -e "${GREEN}✅ Nginx 配置部署完成${NC}"
echo ""

# 测试并重启 Nginx
echo -e "${YELLOW}测试 Nginx 配置...${NC}"
if ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_HOST} "sudo nginx -t"; then
    echo -e "${GREEN}✅ Nginx 配置测试通过${NC}"

    echo -e "${YELLOW}重启 Nginx...${NC}"
    ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_HOST} "sudo systemctl reload nginx"
    echo -e "${GREEN}✅ Nginx 重启成功${NC}"
else
    echo -e "${RED}❌ Nginx 配置测试失败${NC}"
    exit 1
fi
echo ""

# 验证部署
echo -e "${YELLOW}验证部署...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://${SERVER_HOST}:6060/health || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ 部署验证成功${NC}"
    echo -e "${GREEN}🌐 访问地址: http://${SERVER_HOST}:6060${NC}"
else
    echo -e "${RED}❌ 部署验证失败 (HTTP $HTTP_CODE)${NC}"
    exit 1
fi
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
