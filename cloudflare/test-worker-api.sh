#!/bin/bash

echo "=== 测试 Worker API ==="
echo ""

echo "1. 测试 /health 端点（不需要认证）"
curl -s "https://integrated-pool-2.2238642875.workers.dev/health" -w "\nHTTP_CODE:%{http_code}\n"
echo ""

echo "2. 测试 / 端点（不需要认证）"
curl -s "https://integrated-pool-2.2238642875.workers.dev/" -w "\nHTTP_CODE:%{http_code}\n"
echo ""

echo "3. 测试 /status 端点（不需要认证）"
curl -s "https://integrated-pool-2.2238642875.workers.dev/status" -w "\nHTTP_CODE:%{http_code}\n"
echo ""

echo "4. 测试 /scan 端点（需要认证，POST）"
curl -s -X POST "https://integrated-pool-2.2238642875.workers.dev/scan" \
  -H "X-API-Key: test-key" \
  -H "Content-Type: application/json" \
  -w "\nHTTP_CODE:%{http_code}\n"
echo ""

echo "=== 测试完成 ==="
