# API端点使用指南

**版本**: v2.4.0-dev  
**Worker名称**: integrated-pool-2  
**基础URL**: https://api.weare.run

---

## 目录

1. [现有端点](#现有端点)
2. [使用示例](#使用示例)
3. [可选扩展端点](#可选扩展端点)
4. [自定义端点开发](#自定义端点开发)
5. [注意事项](#注意事项)

---

## 现有端点

### 1. 健康检查

#### 端点
```
GET https://api.weare.run/
GET https://api.weare.run/health
```

#### 描述
返回Worker的基本健康状态信息。

#### 响应示例
```json
{
  "status": "healthy",
  "worker_id": "integrated-pool-2",
  "worker_name": "Integrated-Pool2",
  "timestamp": "2026-01-31T14:30:00.000Z"
}
```

#### 使用命令
```bash
curl https://api.weare.run/
curl https://api.weare.run/health
```

---

### 2. 查询所有钱包状态

#### 端点
```
GET https://api.weare.run/status
```

#### 描述
查询所有被保护钱包的余额、代币数量和当前操作状态。这是最常用的监控端点。

#### 响应示例
```json
{
  "success": true,
  "worker_id": "integrated-pool-2",
  "worker_name": "Integrated-Pool2",
  "timestamp": "2026-01-31T14:30:00.000Z",
  "wallets": [
    {
      "wallet": "0x9F4fba96e1D15f8547b9e41Be957Ff143C298e16",
      "wallet_short": "2e16",
      "bnb_balance": "0.0001",
      "wkeydao_balance": "0",
      "usdt_balance": "0",
      "action": "emergency",
      "action_detail": {
        "action": "emergency",
        "reason": "bnb_below_threshold"
      }
    },
    {
      "wallet": "0x3D3914960567b3A253C429d5Ab81DA1F386F9111",
      "wallet_short": "9111",
      "bnb_balance": "0.005",
      "wkeydao_balance": "100",
      "usdt_balance": "0",
      "action": "transfer",
      "action_detail": {
        "action": "transfer",
        "token": "wkeydao",
        "reason": "has_token"
      }
    }
  ],
  "summary": {
    "total": 2,
    "emergency": 1,
    "transfer": 1,
    "normal": 0
  }
}
```

#### 使用命令
```bash
curl https://api.weare.run/status
curl https://api.weare.run/status | jq .  # 美化输出
curl https://api.weare.run/status | jq '.summary'  # 只查看摘要
```

---

### 3. 手动触发扫描（包括转账）

#### 端点
```
POST https://api.weare.run/scan
POST https://api.weare.run/trigger
```

#### 描述
手动执行完整扫描流程，包括钱包扫描、应急状态处理、转账操作和Aide监控。**注意：此操作会执行转账，请谨慎使用！**

#### 请求体
```json
{}
```

#### 响应示例
```json
{
  "success": true,
  "message": "Manual scan completed",
  "results": [
    {
      "walletAddress": "0x9F4fba96e1D15f8547b9e41Be957Ff143C298e16",
      "scanResult": {
        "bnbBalance": "0.0001",
        "wkeyDaoBalance": "0",
        "usdtBalance": "0"
      },
      "action": {
        "action": "emergency"
      },
      "success": true
    }
  ],
  "summary": {
    "total": 1,
    "success": 1,
    "duration": 5000
  }
}
```

#### 使用命令
```bash
# 基本调用
curl -X POST https://api.weare.run/scan

# 带美化输出
curl -X POST https://api.weare.run/scan | jq .

# 查看扫描进度（实时）
curl -X POST https://api.weare.run/scan -w "\nTime: %{time_total}s\n"
```

---

### 4. 查询单个钱包详情

#### 端点
```
GET https://api.weare.run/wallet?address={wallet_address}
```

#### 描述
查询指定钱包的详细扫描结果。

#### 请求参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| address | string | 是 | 钱包地址（0x开头的40位十六进制字符串） |

#### 响应示例
```json
{
  "success": true,
  "wallet": "0x9F4fba96e1D15f8547b9e41Be957Ff143C298e16",
  "scanResult": {
    "bnbBalance": "0.0001",
    "wkeyDaoBalance": "0",
    "usdtBalance": "0"
  },
  "action": {
    "action": "emergency",
    "reason": "bnb_below_threshold"
  }
}
```

#### 使用命令
```bash
# 基本查询
curl "https://api.weare.run/wallet?address=0x9F4fba96e1D15f8547b9e41Be957Ff143C298e16"

# 美化输出
curl "https://api.weare.run/wallet?address=0x9F4fba96e1D15f8547b9e41Be957Ff143C298e16" | jq .

# 只查看余额
curl "https://api.weare.run/wallet?address=0x9F4fba96e1D15f8547b9e41Be957Ff143C298e16" | jq '.scanResult'
```

---

### 5. 查询应急状态

#### 端点
```
GET https://api.weare.run/emergency
```

#### 描述
查询所有钱包的应急状态（是否处于应急模式）。

#### 响应示例
```json
{
  "success": true,
  "worker_id": "integrated-pool-2",
  "timestamp": "2026-01-31T14:30:00.000Z",
  "emergency_statuses": [
    {
      "wallet": "0x9F4fba96e1D15f8547b9e41Be957Ff143C298e16",
      "wallet_short": "2e16",
      "in_emergency": true,
      "lock_data": {
        "startTime": "2026-01-31T14:00:00.000Z",
        "duration": 600
      }
    },
    {
      "wallet": "0x3D3914960567b3A253C429d5Ab81DA1F386F9111",
      "wallet_short": "9111",
      "in_emergency": false,
      "lock_data": null
    }
  ],
  "in_emergency_count": 1
}
```

#### 使用命令
```bash
# 基本查询
curl https://api.weare.run/emergency

# 只查看应急状态的钱包
curl https://api.weare.run/emergency | jq '.emergency_statuses[] | select(.in_emergency == true)'

# 查看应急数量
curl https://api.weare.run/emergency | jq '.in_emergency_count'
```

---

### 6. API文档

#### 端点
```
GET https://api.weare.run/api-docs
GET https://api.weare.run/docs
```

#### 描述
获取API文档（JSON格式）。

#### 使用命令
```bash
curl https://api.weare.run/api-docs | jq .
```

---

## 使用示例

### 示例1: 定期监控钱包状态

创建一个监控脚本 `monitor.sh`：

```bash
#!/bin/bash

while true; do
  echo "=== $(date) ==="
  curl -s https://api.weare.run/status | jq '.summary'
  echo ""
  sleep 60
done
```

运行：
```bash
chmod +x monitor.sh
./monitor.sh
```

### 示例2: 检查是否有钱包处于应急状态

```bash
# 检查是否有钱包处于应急状态
curl -s https://api.weare.run/emergency | jq '.in_emergency_count'

# 如果有，发送通知
EMERGENCY_COUNT=$(curl -s https://api.weare.run/emergency | jq '.in_emergency_count')
if [ "$EMERGENCY_COUNT" -gt 0 ]; then
  echo "警告：有 $EMERGENCY_COUNT 个钱包处于应急状态！"
  # 发送通知（如邮件、Telegram等）
fi
```

### 示例3: 查询特定钱包的余额

```bash
WALLET="0x9F4fba96e1D15f8547b9e41Be957Ff143C298e16"
curl -s "https://api.weare.run/wallet?address=$WALLET" | jq '.scanResult'
```

### 示例4: 手动触发扫描（谨慎使用）

```bash
# 先查看当前状态
curl -s https://api.weare.run/status | jq '.summary'

# 确认后手动触发扫描
echo "是否触发扫描？(y/n)"
read answer
if [ "$answer" = "y" ]; then
  curl -X POST https://api.weare.run/scan | jq .
fi
```

---

## 可选扩展端点

以下是一些可以添加的实用端点，您可以根据需求选择实现：

### 1. 交易历史查询

#### 端点
```
GET https://api.weare.run/transactions
GET https://api.weare.run/transactions?wallet={wallet_address}
GET https://api.weare.run/transactions?limit={limit}
GET https://api.weare.run/transactions?status={status}
```

#### 描述
查询交易历史记录，支持按钱包、状态、数量过滤。

#### 可实现的功能
- 查询所有交易
- 按钱包地址过滤
- 按状态过滤（pending/confirmed/failed）
- 分页查询

---

### 2. RPC节点状态查询

#### 端点
```
GET https://api.weare.run/rpc/status
```

#### 描述
查询RPC节点的健康状态和性能指标。

#### 响应示例
```json
{
  "nodes": [
    {
      "url": "https://bsc-rpc.publicnode.com",
      "latency": 150,
      "success_rate": 0.99,
      "last_used": "2026-01-31T14:30:00.000Z"
    }
  ]
}
```

---

### 3. 配置查询和更新

#### 端点
```
GET https://api.weare.run/config
POST https://api.weare.run/config
```

#### 描述
查询和更新Worker配置（需要认证）。

#### 可更新的配置
- `BNB_THRESHOLD`: BNB阈值
- `TARGET_BNB_BALANCE`: 目标BNB余额
- `COMPETITIVE_MODE`: 竞争模式开关
- `WALLET_SCAN_INTERVAL`: 扫描间隔

---

### 4. 统计数据

#### 端点
```
GET https://api.weare.run/stats
GET https://api.weare.run/stats?period={day|week|month}
```

#### 描述
查询统计数据，包括扫描次数、转账次数、成功率等。

#### 响应示例
```json
{
  "period": "day",
  "scans": 1440,
  "transfers": 5,
  "success_rate": 0.98,
  "total_value_transferred": "100.5"
}
```

---

### 5. Webhook管理

#### 端点
```
GET https://api.weare.run/webhooks
POST https://api.weare.run/webhooks
DELETE https://api.weare.run/webhooks/{id}
```

#### 描述
管理Webhook，在特定事件发生时发送通知。

#### 可触发的事件
- 钱包进入应急状态
- 转账完成
- 交易失败
- 余额低于阈值

---

### 6. 批量钱包管理

#### 端点
```
GET https://api.weare.run/wallets
POST https://api.weare.run/wallets
DELETE https://api.weare.run/wallets/{address}
```

#### 描述
批量管理被保护的钱包列表。

---

### 7. 资产汇总

#### 端点
```
GET https://api.weare.run/assets
```

#### 描述
汇总所有被保护钱包的资产总额。

#### 响应示例
```json
{
  "total_bnb": "0.015",
  "total_wkeydao": "150",
  "total_usdt": "1000",
  "wallets": 3,
  "usd_value": {
    "bnb": 4500,
    "wkeydao": 1500,
    "usdt": 1000,
    "total": 7000
  }
}
```

---

### 8. 导出数据

#### 端点
```
GET https://api.weare.run/export/transactions
GET https://api.weare.run/export/wallets
GET https://api.weare.run/export/logs
```

#### 描述
导出数据为CSV或JSON格式。

---

### 9. 日志查询

#### 端点
```
GET https://api.weare.run/logs
GET https://api.weare.run/logs?level={info|error|warn}
GET https://api.weare.run/logs?wallet={wallet_address}
GET https://api.weare.run/logs?since={timestamp}
```

#### 描述
查询Worker日志，支持按级别、钱包、时间过滤。

---

### 10. 测试端点

#### 端点
```
POST https://api.weare.run/test/scan
POST https://api.weare.run/test/transfer
POST https://api.weare.run/test/emergency
```

#### 描述
测试特定功能（仅限测试环境）。

---

## 自定义端点开发

### 如何添加新端点

在 `/workspace/cloudflare/worker-integrated-pool/src/index.js` 的 `fetch` 方法中添加新的路由处理：

```javascript
async fetch(request, env) {
  const url = new URL(request.url)
  const path = url.pathname
  const method = request.method

  // 现有端点...

  // 添加新端点
  if (path === '/my-new-endpoint' && method === 'GET') {
    return this.handleMyNewEndpoint(request, env)
  }

  // 404
  return new Response('Not found', { status: 404 })
},

/**
 * 处理新端点
 */
async handleMyNewEndpoint(request, env) {
  try {
    // 你的逻辑
    const data = { message: 'Hello!' }

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
```

### 访问环境变量

```javascript
const config = {
  PROTECTED_WALLETS: env.PROTECTED_WALLETS,
  BNB_THRESHOLD: env.BNB_THRESHOLD,
  // ...
}
```

### 访问KV存储

```javascript
// 读取
const data = await env.EMERGENCY_STORE.get('key')

// 写入
await env.EMERGENCY_STORE.put('key', JSON.stringify(data))

// 删除
await env.EMERGENCY_STORE.delete('key')
```

### 访问数据库

```javascript
const db = new DatabaseExtension(env)
await db.initialize()

// 查询
const transactions = await db.getTransactions()

// 插入
await db.insertTransaction({
  walletAddress,
  tokenType,
  amount,
  // ...
})
```

### 使用RPC

```javascript
import { RpcPoolOptimizedExtension, createRpcSelector } from './extensions/rpc-pool-optimized/RpcPoolOptimizedExtension.js'

const rpcPool = new RpcPoolOptimizedExtension(env)
await rpcPool.initialize()

// 获取随机节点（带失败重试）
const rpcSelector = createRpcSelector(rpcPool)
const { node: rpcUrl } = await rpcSelector.getNode()

// 发送RPC请求
const response = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'eth_getBalance',
    params: [walletAddress, 'latest'],
    id: 1
  })
})
```

---

## 注意事项

### 1. 安全性

- **敏感操作需要认证**：对于配置更新、转账等敏感操作，建议添加API Key或JWT认证
- **限制访问频率**：防止API被滥用，可以添加速率限制
- **验证输入**：对所有输入参数进行验证

### 2. 性能

- **异步处理**：耗时操作（如RPC请求）应使用异步处理
- **缓存**：频繁查询的数据可以缓存到KV中
- **超时设置**：为所有网络请求设置合理的超时时间

### 3. 错误处理

- **统一错误响应格式**：所有错误都返回统一的JSON格式
- **日志记录**：记录错误信息，便于排查问题
- **友好的错误消息**：提供清晰的错误提示

### 4. 文档

- **保持文档更新**：每次修改API后，同步更新文档
- **提供示例**：为每个端点提供清晰的使用示例
- **版本控制**：API版本变更时，提供迁移指南

---

## 快速参考

### 常用命令速查

```bash
# 健康检查
curl https://api.weare.run/

# 查询所有钱包状态
curl https://api.weare.run/status | jq .

# 查询单个钱包
curl "https://api.weare.run/wallet?address=0x9F4fba96e1D15f8547b9e41Be957Ff143C298e16" | jq .

# 查询应急状态
curl https://api.weare.run/emergency | jq '.in_emergency_count'

# 手动触发扫描（谨慎！）
curl -X POST https://api.weare.run/scan

# 查看API文档
curl https://api.weare.run/api-docs | jq .
```

### 监控脚本模板

```bash
#!/bin/bash
# monitor.sh - 定期监控脚本

API_URL="https://api.weare.run"

while true; do
  clear
  echo "=== $(date) ==="
  echo ""
  
  # 查询状态
  STATUS=$(curl -s "$API_URL/status")
  
  # 显示摘要
  echo "钱包总数: $(echo $STATUS | jq '.summary.total')"
  echo "应急状态: $(echo $STATUS | jq '.summary.emergency')"
  echo "待转账: $(echo $STATUS | jq '.summary.transfer')"
  echo "正常: $(echo $STATUS | jq '.summary.normal')"
  
  echo ""
  echo "=== 钱包详情 ==="
  echo "$STATUS" | jq '.wallets[] | {wallet: .wallet_short, bnb: .bnb_balance, action: .action}'
  
  sleep 30
done
```

---

**最后更新**: 2026-01-31
