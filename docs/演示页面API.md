# 演示页面 API 文档

## 基础信息

- **主地址**：`https://tactics-1.xplan2026.workers.dev`
- **备份地址**：`https://demo.x-plan.top` (暂未开放)
- **认证方式**：`X-API-Key` 请求头

---

## 1. 健康检查

**端点**：`GET /health`

**认证**：无需

**说明**：检查 Worker 服务状态

**请求示例**：
```bash
curl https://tactics-1.xplan2026.workers.dev/health
```

**响应示例**：
```json
{
  "success": true,
  "message": "OK"
}
```

---

## 2. 获取钱包状态

**端点**：`GET /status`

**认证**：无需

**说明**：获取 Worker 和钱包的整体状态

**请求示例**：
```bash
curl https://tactics-1.xplan2026.workers.dev/status
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "status": "running",
    "scanMode": "normal",
    "lastUpdate": "2024-02-11T10:30:00Z",
    "workerStatus": "active",
    "emergencyMode": false,
    "scanInterval": 60
  }
}
```
修改说明：
1. 在演示页面中，钱包状态需要展示的是钱包中各种资产的余额，而不是 Worker 的状态。
2. 所以这里的API端点不应该是worker的后端地址，而是应该使用ether.js来获取钱包的余额。
3. 在演示页中有一个“刷新”按钮，可以用来触发刷新钱包地址的余额

**数据字段说明**：
| 字段 | 类型 | 说明 |
|------|------|------|
| status | string | 当前状态 |
| scanMode | string | 扫描模式 (normal/emergency) |
| lastUpdate | string | 最后更新时间 (ISO 8601) |
| workerStatus | string | Worker 状态 |
| emergencyMode | boolean | 应急模式开关 |
| scanInterval | number | 扫描间隔（秒） |

---

## 3. 获取钱包详情

**端点**：`GET /wallet`

**认证**：无需

**参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| address | string | 是 | 钱包地址 |

**请求示例**：
```bash
curl "https://tactics-1.xplan2026.workers.dev/wallet?address=0x32af405726ba6bd2f9b7ecdfed3bdd9b590c0939"
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "address": "0x32af405726ba6bd2f9b7ecdfed3bdd9b590c0939",
    "balance": "0.5",
    "xpdBalance": "1000",
    "emergencyMode": false,
    "lastScan": "2024-02-11T10:30:00Z"
  }
}
```

**数据字段说明**：
| 字段 | 类型 | 说明 |
|------|------|------|
| address | string | 钱包地址 |
| balance | string | POL 余额（字符串格式） |
| xpdBalance | string | XPD 余额（字符串格式） |
| emergencyMode | boolean | 应急模式状态 |
| lastScan | string | 最后扫描时间 |

---

## 4. 获取应急状态

**端点**：`GET /emergency`

**认证**：无需

**说明**：获取应急模式状态和转账记录

**请求示例**：
```bash
curl https://tactics-1.xplan2026.workers.dev/emergency
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "scanInterval": 5,
    "transfers": [
      {
        "id": "tx_001",
        "timestamp": "2024-02-11T10:25:00Z",
        "from": "0x32af405726ba6bd2f9b7ecdfed3bdd9b590c0939",
        "to": "0x1234567890123456789012345678901234567890",
        "amount": "1000",
        "txHash": "0xabcdef...",
        "status": "completed"
      }
    ]
  }
}
```

**数据字段说明**：
| 字段 | 类型 | 说明 |
|------|------|------|
| enabled | boolean | 是否启用应急模式 |
| scanInterval | number | 扫描间隔（秒） |
| transfers | array | 应急转账记录 |

**Transfer 对象字段**：
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 转账 ID |
| timestamp | string | 转账时间 (ISO 8601) |
| from | string | 源地址 |
| to | string | 目标地址 |
| amount | string | 转账金额 |
| txHash | string | 交易哈希 |
| status | string | 状态 (completed/pending/failed) |

---

## 5. 测试转账

**端点**：`POST /test/transfer`

**认证**：需要 (`X-API-Key` 请求头)

**说明**：从安全钱包转账指定数量 XPD 到被保护地址

**请求头**：
```
Content-Type: application/json
X-API-Key: your-api-key-here
```

**请求体**：
```json
{
  "amount": 1
}
```

**请求示例**：
```bash
curl -X POST https://tactics-1.xplan2026.workers.dev/test/transfer \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{"amount": 1}'
```

**响应示例**：
```json
{
  "success": true,
  "message": "转账成功",
  "data": {
    "txHash": "0xabcdef...",
    "amount": "1"
  }
}
```

---

## 6. 模拟转账

**端点**：`POST /simulate/transfer`

**认证**：需要 (`X-API-Key` 请求头)

**说明**：使用提供的私钥模拟转账操作，用于测试防盗币功能

**请求头**：
```
Content-Type: application/json
X-API-Key: your-api-key-here
```

**请求体**：
```json
{
  "privateKey": "0x70616d7068657400000000000000000000000000000000000000000000000fae6",
  "targetAddress": "0x1234567890123456789012345678901234567890"
}
```

**请求示例**：
```bash
curl -X POST https://tactics-1.xplan2026.workers.dev/simulate/transfer \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{
    "privateKey": "0x70616d7068657400000000000000000000000000000000000000000000000fae6",
    "targetAddress": "0x1234567890123456789012345678901234567890"
  }'
```

**响应示例**：
```json
{
  "success": true,
  "message": "转账成功",
  "data": {
    "txHash": "0xabcdef...",
    "from": "0x32af405726ba6bd2f9b7ecdfed3bdd9b590c0939",
    "to": "0x1234567890123456789012345678901234567890",
    "amount": "1000"
  }
}
```

---

## 7. 启用应急模式

**端点**：`POST /emergency/enable`

**认证**：需要 (`X-API-Key` 请求头)

**说明**：开启应急模式，扫描间隔缩短至 5 秒

**请求头**：
```
X-API-Key: your-api-key-here
```

**请求示例**：
```bash
curl -X POST https://tactics-1.xplan2026.workers.dev/emergency/enable \
  -H "X-API-Key: your-api-key-here"
```

**响应示例**：
```json
{
  "success": true,
  "message": "应急模式已启用",
  "data": {
    "enabled": true,
    "scanInterval": 5
  }
}
```

---

## 8. 禁用应急模式

**端点**：`POST /emergency/disable`

**认证**：需要 (`X-API-Key` 请求头)

**说明**：关闭应急模式，恢复 1 分钟扫描间隔

**请求头**：
```
X-API-Key: your-api-key-here
```

**请求示例**：
```bash
curl -X POST https://tactics-1.xplan2026.workers.dev/emergency/disable \
  -H "X-API-Key: your-api-key-here"
```

**响应示例**：
```json
{
  "success": true,
  "message": "应急模式已关闭",
  "data": {
    "enabled": false,
    "scanInterval": 60
  }
}
```

---

## 9. 手动触发扫描

**端点**：`POST /scan`

**认证**：需要 (`X-API-Key` 请求头)

**说明**：手动触发一次钱包扫描

**请求头**：
```
X-API-Key: your-api-key-here
```

**请求示例**：
```bash
curl -X POST https://tactics-1.xplan2026.workers.dev/scan \
  -H "X-API-Key: your-api-key-here"
```

**响应示例**：
```json
{
  "success": true,
  "message": "扫描已触发",
  "data": {
    "scanTime": "2024-02-11T10:30:00Z"
  }
}
```

---

## 10. 手动重启 Worker

**端点**：`POST /restart`

**认证**：需要 (`X-API-Key` 请求头)

**说明**：手动重启 Worker 服务

**请求头**：
```
X-API-Key: your-api-key-here
```

**请求示例**：
```bash
curl -X POST https://tactics-1.xplan2026.workers.dev/restart \
  -H "X-API-Key: your-api-key-here"
```

**响应示例**：
```json
{
  "success": true,
  "message": "Worker 已重启",
  "data": {
    "restartTime": "2024-02-11T10:30:00Z"
  }
}
```

---

## 通用响应格式

所有 API 响应均遵循以下格式：

```json
{
  "success": true,
  "message": "操作成功",
  "data": { },
  "error": ""
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 请求是否成功 |
| message | string | 提示消息 |
| data | object | 返回数据（具体结构见各 API） |
| error | string | 错误信息（失败时返回） |

---

## 错误响应示例

```json
{
  "success": false,
  "error": "API Key 未设置",
  "message": "认证失败"
}
```

```json
{
  "success": false,
  "error": "余额不足",
  "message": "转账失败"
}
```

---

## 环境变量配置

在项目 `.env` 文件中配置：

```env
VITE_API_MAIN_URL=https://tactics-1.xplan2026.workers.dev
VITE_API_BACKUP_URL=https://tactics-1.xplan2026.workers.dev
```

---

## 修改需求记录

<!-- 请在此处描述 API 修改需求 -->

---
