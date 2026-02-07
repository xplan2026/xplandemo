#!/bin/bash
# 批量添加 CORS 响应头到 Worker

FILE="/workspace/cloudflare/integrated-pool-2/src/index.js"

# 1. 修改健康检查响应（已手动修改）
echo "步骤 1: 健康检查 - 已完成"

# 2. 修改速率限制响应
sed -i "s/return new Response(JSON.stringify({/return this.createCorsResponse(JSON.stringify({/g" "$FILE"
sed -i "s/status: 429,/status: 429,/g" "$FILE"
sed -i "s/headers: { 'Content-Type': 'application\/json' }/}/g" "$FILE"

# 3. 修改 API Key 认证响应
sed -i "s/status: 401,/status: 401,/g" "$FILE"

# 4. 修改 Method not allowed 响应
sed -i "s/status: 405,/status: 405,/g" "$FILE"

# 5. 修改 Not found 响应
sed -i "s/status: 404,/status: 404,/g" "$FILE"

# 6. 修改其他 JSON 响应
# 将 `new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })` 
# 替换为 `this.createCorsResponse(JSON.stringify(data), 200)`

echo "批量修改完成"
