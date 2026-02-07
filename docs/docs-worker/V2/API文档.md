# Guard Plus API 文档

## 基础信息

- **Base URL**: Worker 部署后的 URL（如 `https://guard-plus.3813518962.workers.dev`）
- **认证方式**: 无（通过 IP/域名白名单控制）
- **CORS**: 允许所有来源

## 通用响应格式

### 成功响应
```json
{
  "success": true,
  "data": { ... }
}
```

### 错误响应
```json
{
  "success": false,
  "error": "错误信息"
}
```

---

## API 端点

### 1. 健康检查

**GET** `/health`

检查 Worker 是否正常运行。

**请求**
```http
GET /health
```

**响应**
```json
{
  "status": "ok",
  "service": "guard-plus-worker",
  "timestamp": "2026-01-15T12:00:00.000Z"
}
```

---

### 2. 创建扫描任务

**POST** `/api/tasks`

创建一个新的扫描任务。

**请求头**
```http
Content-Type: application/json
```

**请求体**
```json
{
  "wallet_address": "0x886b739Ba73C1ccaE826Cb11c8d28e4750C68A89",
  "vortex_start_time": "2026-01-15T12:00:00Z"
}
```

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| wallet_address | string | 是 | 钱包地址（必须是 WATCHED_WALLETS 中配置的地址） |
| vortex_start_time | string | 是 | 涡轮开始时间（ISO 8601 格式） |

**响应**
```json
{
  "success": true,
  "task_id": 123,
  "scheduled_scan_time": "2026-01-15T23:30:00Z"
}
```

| 字段 | 类型 | 说明 |
|-----|------|------|
| task_id | number | 任务 ID |
| scheduled_scan_time | string | 预计扫描触发时间（涡轮开始 + 11.5 小时） |

**错误响应**
- `400`: 参数缺失或无效
- `403`: 访问被拒绝（IP/域名不在白名单）
- `500`: 服务器错误

---

### 3. 获取任务列表

**GET** `/api/tasks`

获取扫描任务列表。

**请求参数**
| 参数 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| wallet_address | string | 否 | 筛选指定钱包的任务 |

**请求示例**
```http
GET /api/tasks?wallet_address=0x886b739Ba73C1ccaE826Cb11c8d28e4750C68A89
```

**响应**
```json
{
  "success": true,
  "tasks": [
    {
      "id": 123,
      "wallet_address": "0x886b739Ba73C1ccaE826Cb11c8d28e4750C68A89",
      "vortex_start_time": "2026-01-15T12:00:00Z",
      "scheduled_scan_time": "2026-01-15T23:30:00Z",
      "status": "pending",
      "high_freq_until": null,
      "created_at": "2026-01-15T10:00:00Z",
      "updated_at": "2026-01-15T10:00:00Z",
      "completed_at": null
    }
  ]
}
```

**任务状态**
| 状态 | 说明 |
|-----|------|
| pending | 待扫描（未到触发时间） |
| active | 监控中（已开始扫描） |
| completed | 已完成（转账完成） |
| failed | 失败 |

---

### 4. 获取单个任务

**GET** `/api/task`

获取单个任务详情。

**请求参数**
| 参数 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| id | number | 是 | 任务 ID |

**请求示例**
```http
GET /api/task?id=123
```

**响应**
```json
{
  "success": true,
  "task": {
    "id": 123,
    "wallet_address": "0x886b739Ba73C1ccaE826Cb11c8d28e4750C68A89",
    "vortex_start_time": "2026-01-15T12:00:00Z",
    "scheduled_scan_time": "2026-01-15T23:30:00Z",
    "status": "active",
    "high_freq_until": "2026-01-15T23:40:00Z",
    "created_at": "2026-01-15T10:00:00Z",
    "updated_at": "2026-01-15T23:30:00Z",
    "completed_at": null
  }
}
```

---

### 5. 更新任务状态

**PUT** `/api/task`

更新任务状态或设置高频扫描时间。

**请求头**
```http
Content-Type: application/json
```

**请求参数**
| 参数 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| id | number | 是 | 任务 ID |

**请求体**
```json
{
  "status": "active",
  "high_freq_until": "2026-01-15T23:40:00Z"
}
```

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| status | string | 否 | 任务状态（pending/active/completed/failed） |
| high_freq_until | string | 否 | 高频扫描截止时间（ISO 8601 格式） |

**响应**
```json
{
  "success": true
}
```

---

### 6. 扫描钱包

**GET** `/api/scan`

扫描指定钱包的余额。

**请求参数**
| 参数 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| wallet_address | string | 是 | 钱包地址 |

**请求示例**
```http
GET /api/scan?wallet_address=0x886b739Ba73C1ccaE826Cb11c8d28e4750C68A89
```

**响应**
```json
{
  "success": true,
  "wallet_address": "0x886b739Ba73C1ccaE826Cb11c8d28e4750C68A89",
  "bnb_balance": "0.1234",
  "wkeydao_balance": "100.5",
  "bnb_increased": false,
  "wkeydao_changed": false,
  "high_freq_until": null,
  "should_transfer": false,
  "timestamp": 1705296000000
}
```

| 字段 | 类型 | 说明 |
|-----|------|------|
| wallet_address | string | 钱包地址 |
| bnb_balance | string | BNB 余额 |
| wkeydao_balance | string | wkeyDAO 余额 |
| bnb_increased | boolean | BNB 余额是否增加 |
| wkeydao_changed | boolean | wkeyDAO 余额是否变化 |
| high_freq_until | number \| null | 高频扫描截止时间（时间戳，null 表示不启用） |
| should_transfer | boolean | 是否需要立即转账 |
| timestamp | number | 扫描时间戳 |

**重要说明**：
- 当 `bnb_increased` 为 `true` 时，`high_freq_until` 将包含 10 分钟后的时间戳
- 当 `wkeydao_changed` 为 `true` 时，`should_transfer` 为 `true`，前端应立即触发转账

---

### 7. 触发转账

**POST** `/api/transfer`

触发紧急转账，将钱包中的所有 wkeyDAO 和 BNB 转移到安全钱包。

**请求头**
```http
Content-Type: application/json
```

**请求体**
```json
{
  "wallet_address": "0x886b739Ba73C1ccaE826Cb11c8d28e4750C68A89"
}
```

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| wallet_address | string | 是 | 钱包地址 |

**响应**
```json
{
  "success": true,
  "results": {
    "wkeydao": {
      "success": true,
      "hash": "0xabc123...",
      "amount": "100.5"
    },
    "bnb": {
      "success": true,
      "hash": "0xdef456...",
      "amount": "0.1234"
    }
  }
}
```

**转账顺序**：
1. 先转移 wkeyDAO 代币
2. 再转移 BNB（扣除 gas 费用）

**错误处理**：
- 如果 BNB 余额不足以支付 gas 费，BNB 转账会失败，但 wkeyDAO 转账仍会执行
- 所有转账操作都会记录到 Supabase 的 `transactions` 表

---

## 安全机制

### IP/域名白名单

Worker 通过环境变量配置访问控制：

```toml
[vars]
ALLOWED_IPS = "1.2.3.4,5.6.7.8"
ALLOWED_DOMAINS = "yourdomain.com,app.yourdomain.com"
```

- 如果 `ALLOWED_IPS` 为空，则不检查 IP
- 如果 `ALLOWED_DOMAINS` 为空，则不检查域名
- 如果两者都为空，允许所有访问（开发环境）

**拒绝访问响应**
```json
{
  "success": false,
  "error": "Access denied",
  "reason": "IP not whitelisted"
}
```

---

## 错误码

| HTTP 状态码 | 说明 |
|------------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 403 | 访问被拒绝 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 使用示例

### 前端轮询示例

```javascript
// 普通轮询（30 秒）
setInterval(async () => {
  const result = await fetch('/api/scan?wallet_address=0x886b...')
  const data = await result.json()

  if (data.high_freq_until) {
    // BNB 增加，切换到高频轮询（5 秒）
    startHighFreqPolling()
  }

  if (data.should_transfer) {
    // wkeyDAO 变化，触发转账
    await triggerTransfer()
  }
}, 30000)

// 高频轮询（5 秒）
function startHighFreqPolling() {
  const pollInterval = setInterval(async () => {
    const result = await fetch('/api/scan?wallet_address=0x886b...')
    const data = await result.json()

    if (Date.now() > data.high_freq_until) {
      // 恢复普通轮询
      clearInterval(pollInterval)
      return
    }

    if (data.should_transfer) {
      await triggerTransfer()
      clearInterval(pollInterval)
    }
  }, 5000)
}
```

---

## 数据库说明

### guard_tasks 表

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | bigint | 主键 |
| wallet_address | varchar(42) | 钱包地址 |
| vortex_start_time | timestamp | 涡轮开始时间 |
| scheduled_scan_time | timestamp | 预计扫描时间 |
| status | varchar(20) | 任务状态 |
| high_freq_until | timestamp | 高频扫描截止时间 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |
| completed_at | timestamp | 完成时间 |

### transactions 表（复用）

| 字段 | 类型 | 说明 |
|-----|------|------|
| wallet_address | varchar(42) | 钱包地址 |
| type | varchar(20) | 交易类型（auto/manual） |
| action | varchar(50) | 操作类型 |
| token_address | varchar(42) | 代币地址 |
| amount | text | 金额 |
| status | varchar(20) | 状态（success/failed） |
| tx_hash | text | 交易哈希 |
| triggered_by | varchar(100) | 触发者 |
| trigger_reason | text | 触发原因 |
| error_message | text | 错误信息 |
| created_at | timestamp | 创建时间 |
