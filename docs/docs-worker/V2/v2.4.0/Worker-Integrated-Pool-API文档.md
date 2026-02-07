# Worker-Integrated-Pool API 文档

**版本**: v2.4.0-dev  
**更新日期**: 2026-02-02

---

## 基础信息

### 部署的 Workers

| Worker 名称 | URL | 说明 |
|-----------|-----|------|
| worker-integrated-pool | https://worker-integrated-pool.3813518962.workers.dev | 主账户 Worker |
| integrated-pool-2 | https://integrated-pool-2.2238642875.workers.dev | 辅助账户 Worker |

### 认证方式

| 端点 | 需要认证 | 认证方式 |
|------|----------|---------|
| `POST /scan`, `/trigger`, `/restart` | ✅ 是 | API Key (Header: `X-API-Key`) |
| 其他所有 GET 端点 | ❌ 否 | 公开访问 |

### API Key 使用方式

```bash
curl -X POST \
  -H "X-API-Key: your-api-key" \
  https://worker-integrated-pool.3813518962.workers.dev/scan
```

---

## API 端点

### 1. 健康检查

**GET** `/` 或 `/health`

检查 Worker 是否正常运行。

**请求**
```http
GET /health
```

**响应**
```json
{
  "status": "healthy",
  "worker_id": "worker-integrated-pool",
  "worker_name": "worker-integrated-pool",
  "timestamp": "2026-02-02T10:00:00.000Z"
}
```

---

### 2. 查询所有钱包状态

**GET** `/status`

查询所有被保护钱包的余额和状态。

**请求**
```http
GET /status
```

**响应**
```json
{
  "success": true,
  "worker_id": "worker-integrated-pool",
  "worker_name": "worker-integrated-pool",
  "timestamp": "2026-02-02T10:00:00.000Z",
  "wallets": [
    {
      "wallet": "0x9F4fba96e1D15f8547b9e41Be957Ff143C298e16",
      "wallet_short": "8e16",
      "bnb_balance": "0.001",
      "wkeydao_balance": "100",
      "usdt_balance": "0",
      "action": "emergency",
      "action_detail": {
        "action": "emergency",
        "reason": "BNB balance exceeds threshold",
        "bnbThreshold": 0.0005,
        "bnbBalance": 0.001
      }
    }
  ],
  "summary": {
    "total": 3,
    "emergency": 1,
    "transfer": 1,
    "normal": 1
  }
}
```

**字段说明**
| 字段 | 类型 | 说明 |
|------|------|------|
| action | string | 操作类型：`emergency`（应急）、`transfer`（转账）、`none`（正常） |
| bnb_balance | string | BNB 余额 |
| wkeydao_balance | string | wkeyDAO 余额 |
| usdt_balance | string | USDT 余额 |

---

### 3. 查询单个钱包详情

**GET** `/wallet?address=0x...`

查询单个钱包的详细信息。

**请求参数**
| 参数 | 类型 | 必填 | 说明 |
|------|------|-----|------|
| address | string | 是 | 钱包地址（0x开头的40位十六进制） |

**请求示例**
```http
GET /wallet?address=0x9F4fba96e1D15f8547b9e41Be957Ff143C298e16
```

**响应**
```json
{
  "success": true,
  "wallet": "0x9F4fba96e1D15f8547b9e41Be957Ff143C298e16",
  "scanResult": {
    "bnbBalance": "0.001",
    "wkeyDaoBalance": "100",
    "usdtBalance": "0"
  },
  "action": {
    "action": "emergency",
    "reason": "BNB balance exceeds threshold"
  }
}
```

---

### 4. 查询应急状态

**GET** `/emergency`

查询所有钱包的应急状态（是否正在执行应急扫描）。

**请求**
```http
GET /emergency
```

**响应**
```json
{
  "success": true,
  "worker_id": "worker-integrated-pool",
  "timestamp": "2026-02-02T10:00:00.000Z",
  "emergency_statuses": [
    {
      "wallet": "0x9F4fba96e1D15f8547b9e41Be957Ff143C298e16",
      "wallet_short": "8e16",
      "in_emergency": true,
      "workerId": "worker-integrated-pool",
      "timestamp": "2026-02-02T10:00:00.000Z",
      "ttl": 600,
      "remaining": 580
    }
  ],
  "in_emergency_count": 1
}
```

**字段说明**
| 字段 | 类型 | 说明 |
|------|------|------|
| in_emergency | boolean | 是否处于应急状态 |
| workerId | string | 锁定该钱包的 Worker ID |
| ttl | number | 锁的总时长（秒） |
| remaining | number | 锁的剩余时间（秒） |

---

### 5. 手动触发扫描（危险操作）

**POST** `/scan` 或 `/trigger`

手动触发完整扫描，包括应急状态和转账操作。

**请求头**
```http
Content-Type: application/json
X-API-Key: your-api-key
```

**请求体**
```json
{}
```

**响应**
```json
{
  "success": true,
  "message": "Manual scan completed",
  "results": [
    {
      "walletAddress": "0x9F4fba96e1D15f8547b9e41Be957Ff143C298e16",
      "success": true,
      "scanResult": {
        "bnbBalance": "0.001",
        "wkeyDaoBalance": "100",
        "usdtBalance": "0"
      },
      "action": {
        "action": "emergency"
      }
    }
  ],
  "summary": {
    "total": 3,
    "success": 3,
    "duration": 5000
  }
}
```

**错误响应**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing API Key"
}
```

**状态码**
- `200`: 成功
- `401`: API Key 无效或缺失
- `429`: 另一个扫描正在运行
- `500`: 服务器错误

**重要说明**
- 此端点会执行完整的扫描流程
- 如果检测到应急状态，会立即触发应急扫描
- 如果检测到需要转账，会立即执行转账操作
- 扫描期间会获取分布式锁，防止并发冲突

---

### 6. 手动重启 Worker（危险操作）

**POST** `/restart`

手动重启 Worker，清除所有分布式锁和缓存。

**请求头**
```http
Content-Type: application/json
X-API-Key: your-api-key
```

**请求体**
```json
{}
```

**响应**
```json
{
  "success": true,
  "message": "Worker restarted successfully",
  "worker_id": "worker-integrated-pool",
  "worker_name": "worker-integrated-pool",
  "timestamp": "2026-02-02T10:00:00.000Z",
  "duration": 150,
  "actions": [
    {
      "action": "release_lock",
      "key": "scan_global_lock",
      "success": true
    },
    {
      "action": "release_lock",
      "key": "manual_scan_lock",
      "success": true
    },
    {
      "action": "release_wallet_lock",
      "wallet": "8e16",
      "success": true
    },
    {
      "action": "clear_ratelimit",
      "key": "ratelimit:/status:",
      "success": true
    },
    {
      "action": "log_restart_event",
      "success": true
    }
  ],
  "summary": {
    "total_actions": 10,
    "successful_actions": 10,
    "failed_actions": 0
  }
}
```

**执行的操作**
1. 释放所有分布式锁（scan_global_lock, manual_scan_lock, emergency_lock, transfer_lock）
2. 释放所有钱包锁
3. 清除速率限制缓存
4. 记录重启事件到数据库

**使用场景**
- 处理 429 错误（请求过于频繁）
- Worker 处于异常状态
- 需要强制释放锁

---

### 7. 获取 API 文档

**GET** `/api-docs` 或 `/docs`

获取 API 文档（JSON 格式）。

**请求**
```http
GET /api-docs
```

**响应**
```json
{
  "title": "Worker-Integrated-Pool API Documentation",
  "version": "v2.4.0-dev",
  "base_url": "https://api.weare.run",
  "endpoints": [...],
  "notes": [...]
}
```

---

## 安全机制

### API Key 认证

危险操作需要 API Key 认证：

| 端点 | 方法 | 需要认证 |
|------|------|---------|
| `/scan`, `/trigger` | POST | ✅ 是 |
| `/restart` | POST | ✅ 是 |

**设置 API Key**
```bash
# 在 Worker 目录下执行
npx wrangler secret put API_KEY
# 输入你的 API Key
```

### 速率限制

每个 IP 每分钟最多 10 次请求，超过限制返回：
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded"
}
```

**状态码**: `429`

### 分布式锁

Worker 使用分布式锁防止并发冲突：

| 锁名称 | 用途 | 超时时间 |
|--------|------|---------|
| scan_global_lock | 全局扫描锁 | 600 秒（10 分钟） |
| manual_scan_lock | 手动扫描锁 | 600 秒（10 分钟） |
| {wallet_address} | 钱包锁 | 120 秒（转账）或 600 秒（应急） |

---

## 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | API Key 无效或缺失 |
| 404 | 端点不存在 |
| 405 | 方法不允许（如对 GET 端点使用 POST） |
| 429 | 请求过于频繁（速率限制或扫描锁被占用） |
| 500 | 服务器内部错误 |

---

## 使用示例

### 查询钱包状态（公开）

```bash
curl https://worker-integrated-pool.3813518962.workers.dev/status
```

### 手动触发扫描（需要 API Key）

```bash
curl -X POST \
  -H "X-API-Key: your-api-key" \
  https://worker-integrated-pool.3813518962.workers.dev/scan
```

### 重启 Worker（需要 API Key）

```bash
curl -X POST \
  -H "X-API-Key: your-api-key" \
  https://worker-integrated-pool.3813518962.workers.dev/restart
```

### JavaScript 示例

```javascript
// 查询状态
const response = await fetch('https://worker-integrated-pool.3813518962.workers.dev/status')
const data = await response.json()
console.log(data.wallets)

// 手动扫描
const scanResponse = await fetch('https://worker-integrated-pool.3813518962.workers.dev/scan', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your-api-key'
  }
})
const scanData = await scanResponse.json()
console.log(scanData.summary)
```

---

## Worker 配置

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| PROTECTED_WALLETS | 被保护钱包地址（逗号分隔） | - |
| WALLET_SCAN_INTERVAL | 钱包扫描间隔（秒） | 0 |
| BNB_THRESHOLD | BNB 阈值（触发应急状态） | 0.0005 |
| MAX_SCAN_DURATION | 最大扫描时长（毫秒） | 7000 |
| COMPETITIVE_MODE | 竞争模式（使用所有 BNB 作为 Gas） | true |
| SAFE_WALLET | 安全钱包地址 | - |
| API_KEY | API Key（通过 Secret 设置） | - |

### 定时任务

- **Cron**: `* * * * *`（每分钟执行一次）
- **扫描轮次**: 每次定时任务执行 2 轮扫描，每轮间隔 30 秒

---

## 工作流程

### 定时扫描流程

1. **每分钟触发**一次定时任务
2. **初始化扩展**: RPC 池、数据库、分布式锁
3. **获取全局扫描锁**: 防止并发
4. **循环扫描钱包**（2 轮，每轮间隔 30 秒）：
   - 随机选择 RPC 节点
   - 扫描钱包余额
   - 判断是否需要应急状态或转账
   - 执行相应操作
5. **释放全局扫描锁**

### 手动扫描流程

1. 验证 API Key
2. 获取手动扫描锁
3. 循环扫描所有钱包
4. 根据扫描结果执行应急状态或转账
5. 释放手动扫描锁

---

## 数据库集成

Worker 集成 Supabase 作为持久化存储：

### 主要功能

1. **交易记录**: 记录所有转账操作
2. **Aide 监控**: 监控交易确认状态
3. **事件日志**: 记录系统事件（如 Worker 重启）

### 表结构

- `transactions`: 交易记录表
- `aide_tasks`: Aide 监控任务表
- `events`: 系统事件表

---

## 更新日志

### v2.4.0-dev (2026-02-02)

**新增**
- API Key 认证机制
- `/restart` 端点
- 分布式锁管理

**优化**
- RPC 节点池优化（读取环境变量）
- 速率限制改进

**修复**
- 修复 RPC 节点连续初始化的问题

---

## 注意事项

1. **安全警告**
   - 不要在公开代码中暴露 API Key
   - 定期更换 API Key
   - 监控访问日志

2. **性能考虑**
   - 手动扫描会占用 Worker CPU 时间
   - 频繁触发可能导致 429 错误

3. **锁管理**
   - 使用 `/restart` 清除异常锁
   - 避免长时间占用锁

4. **RPC 节点**
   - Worker 维护多个 RPC 节点池
   - 每次扫描随机选择节点
   - 节点列表可通过环境变量 `BSC_RPC_NODES` 配置

---

**文档维护者**: Auto AI  
**最后更新**: 2026-02-02
