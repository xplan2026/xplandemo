# Worker-1 及扩展框架代码审查对比

> **文档生成日期**: 2026-01-22
> **分析方法**: 基于源代码分析，不依赖文档

---

## 一、Worker-1 核心功能

### 1.1 定时扫描 (scheduled)

**入口**: `/cloudflare/worker-1-interception/src/index.js` - `export default.scheduled()`

**执行频率**: `* * * * *` (每分钟一次)

**工作流程**:

```
1. 检查 Worker-2 是否活跃
   ↓
2. 初始化 Scanner1, TransferManager, DatabaseExtension, EmergencyExtension
   ↓
3. 检查应急状态 (KV 读取)
   ├─ 有应急状态 → 进入应急模式循环 (5秒扫描15分钟)
   └─ 无应急状态 → 常规扫描
```

**常规扫描流程**:

```
1. 检查 GlobalScanner 最近1分钟是否执行过
   ├─ 执行过 → 跳过 (避免重复转账)
   └─ 未执行 → 继续
   ↓
2. 记录 worker_logs (POST worker_logs)
   ↓
3. 调用 scanner.scan() 扫描钱包
   ↓
4. 触发器判断 (_shouldTransfer)
   ├─ wkeyDAO 余额 > 0 → 触发转账
   ├─ BNB 余额 > 0.001 → 触发转账
   └─ 都不满足 → 结束
   ↓
5. 执行转账 (_executeTransfer)
   ├─ transferManager.emergencyTransfer(wallet)
   └─ db.transaction.saveTransaction() 记录交易
```

### 1.2 HTTP API 接口

**路由定义** (`handleAPI` 函数):

| 路由 | 方法 | 功能 | 权限 |
|------|------|------|--------|
| `/health` | GET | 健康检查 | 无 |
| `/api/wallets` | GET | 获取所有钱包余额 | Web3 认证 |
| `/api/transactions` | GET | 获取交易记录 | Web3 认证 |
| `/api/transfer` | POST | 手动触发转账 | Admin (白名单) |
| `/api/auth/nonce` | GET | 获取登录 nonce | 无 |
| `/api/auth/login` | POST | Web3 签名登录 | 无 |

---

## 二、Scanner1 扫描器

**位置**: `/cloudflare/worker-1-interception/src/scanner-1.js`

### 2.1 核心方法

#### `scan()` - 扫描钱包
```
输入: targetWallet (可选)
输出: {
  wallet, walletShort, bnbBalance, wkeyDaoBalance,
  bnbBalanceRaw, wkeyDaoBalanceRaw,
  lastBnbBalance, lastWkeyDaoBalance, timestamp
}
```

- 并行查询 BNB 和 wkeyDAO 余额 (`Promise.all`)
- 缓存历史余额 (Map 结构)，用于对比余额变化

#### `getERC20Balance()` - 查询代币余额
```
方法: contract.balanceOf(wallet)
代币地址: TOKEN_WKEYDAO (0x194B302a4b0a79795Fb68E2ADf1B8c9eC5ff8d1F)
```

---

## 三、Transfer 转账扩展

**位置**: `/cloudflare/extensions/transfer/Transfer.js`

### 3.1 类架构

```
WalletTransfer (单个钱包转账器)
    ↓
TransferScheduler (全局调度器)
    ↓
TransferManager (兼容旧接口的包装器)
```

### 3.2 WalletTransfer - 单钱包转账

**构造参数**:
- `walletAddress`: 钱包地址
- `workerId`: Worker 标识

**核心方法**:

| 方法 | 功能 | 说明 |
|------|------|------|
| `emergencyTransfer()` | 紧急转账 | 先转 wkeyDAO，再转 BNB (扣除 Gas) |
| `transferERC20()` | ERC20 代币转账 | 调用 `contract.transfer()` |
| `transferBNB()` | BNB 转账 | `wallet.sendTransaction()` 转账全部余额扣除 Gas |

**Gas 策略**:
- 使用 `getFeeData()` 获取当前 Gas 价格
- 应用 120% 倍数确保优先级
- 默认 3 gwei (BSC)

### 3.3 TransferScheduler - 并发管理

**核心功能**:
- `Map<address, WalletTransfer>` 缓存钱包实例
- `Map<address, Promise>` 跟踪活跃转账
- 防止重复转账：同一钱包同时只有一个转账任务

**方法**:

| 方法 | 功能 |
|------|------|
| `triggerTransfer(wallet)` | 触发单钱包转账，返回 Promise |
| `triggerMultipleTransfers(wallets[])` | 并发触发多个钱包，返回 `Promise.allSettled()` |
| `getActiveTransferStatus()` | 获取当前活跃转账状态 |

### 3.4 TransferManager - 兼容包装器

**方法**:
- `emergencyTransfer()` → 委托给 `scheduler.triggerTransfer()`
- `manualTransfer()` → 支持指定代币转账，带超时控制

---

## 四、AuthManager 认证扩展

**位置**: `/cloudflare/extensions/auth/AuthManager.js`

### 4.1 JWT 鉴权流程

```
verifyRequest(request)
  ↓ 检查 Authorization 头
verifyToken(token)
  ↓ 验证 HMAC-SHA256 签名
  ↓ 验证 exp (过期时间)
  └─ 返回 { valid, address, role, payload }
```

### 4.2 Web3 登录流程

```
1. 客户端调用 /api/auth/nonce?address=xxx
   ↓
2. 服务端生成 nonce (32字节随机数)，写入 auth_nonce 表
   ↓
3. 客户端签名 nonce，调用 /api/auth/login
   ↓
4. 服务端验证:
   - verifyNonce(address, nonce) 检查 nonce 是否有效且未过期
   - verifySignature(address, nonce, signature) 使用 ethers.recoverAddress()
   - checkWhitelist(address) 检查白名单
   ↓
5. 生成 JWT (24小时有效期)，返回给客户端
```

**Token 结构**:
```
{
  sub: "0x...",  // 钱包地址
  role: "admin" | "viewer",  // 权限角色
  iat: 1234567890,  // 签发时间
  exp: 1234654290   // 过期时间
}
```

---

## 五、DatabaseExtension 数据库扩展

**位置**: `/cloudflare/extensions/database/DatabaseExtension.js`

### 5.1 配置

**依赖环境变量**:
- `SUPABASE_URL`: Supabase 项目 URL
- `SUPABASE_KEY`: anon public key (已添加 .trim())
- KV 命名空间绑定

### 5.2 核心方法

| 方法 | 功能 |
|------|------|
| `fetchSupabase(endpoint, options)` | 统一 HTTP 请求封装，自动添加认证头 |
| `withRetry(operation, maxRetries=3)` | 重试机制，5秒间隔 |
| `getFromCache(key, ttl)` | KV 缓存读取 |
| `setCache(key, value, ttl)` | KV 缓存写入 |
| `checkAndCleanTable(tableName, maxRecords)` | 调用 RPC 函数清理旧记录 |

**请求头**:
```javascript
{
  'apikey': this.supabaseKey,
  'Authorization': `Bearer ${this.supabaseKey}`,
  'Content-Type': 'application/json'
}
```

### 5.3 子模块

#### AuthModule (auth.js)
- `checkWhitelist(address)`: 检查白名单 (带缓存)
- `generateNonce(address)`: 生成 5 分钟有效的 nonce
- `verifyNonce(address, nonce)`: 验证并删除已使用的 nonce
- `verifySignature(address, nonce, signature)`: ethers.recoverAddress() 验证签名

#### TransactionModule (transaction.js)
- `saveTransaction(data)`: 保存交易记录，支持延迟写入
- `getTransactions({ limit, offset })`: 分页查询交易
- `logError(data)`: 记录错误到 errors 表

#### SystemModule (system.js)
- RPC 节点管理
- 系统配置读取

#### TaskModule (task.js)
- 扫描任务 CRUD 操作
- `ping()`: 健康检查

---

## 六、EmergencyExtension 应急扩展

**位置**: `/cloudflare/extensions/emergency/EmergencyExtension.js`

### 6.1 配置

- `scanInterval`: 5000ms (5秒)
- `maxDuration`: 900000ms (15分钟)
- `protectedWallets`: 从 `PROTECTED_WALLETS` 环境变量读取

### 6.2 应急状态循环

```
runEmergencyLoop({ onScan, onTransfer, onTimeout })
  ↓
while (!isTimeout()):
  ↓
  1. _scanAllWallets() - 并行扫描 3 个钱包
     ↓
  2. 调用 onScan(scanResults)
     ↓
  3. 检查 wkeyDAO 余额 > 0 的钱包
     ├─ 有 → 调用 onTransfer({ wallets: [...] })
     └─ 全部为 0 → 退出应急状态
     ↓
  4. 等待 scanInterval (5秒)
  ↓
循环结束 (超时或所有 wkeyDAO 为 0)
```

**重要特性**:
- **不立即退出**: 检测到 wkeyDAO>0 后触发转账，但继续监控
- **持续 15 分钟**: 给盗币者更多时间盗取，提高抢夺成功率

---

## 七、数据库表结构 (代码推断)

### 7.1 whitelist - 白名单表

```
字段: id, wallet_address, status, added_by, created_at, updated_at
索引: wallet_address, status
```

### 7.2 auth_nonce - 登录 nonce 表

```
字段: id, wallet_address, nonce, expires_at, created_at, used_at
索引: wallet_address, nonce, expires_at
```

### 7.3 transactions - 交易记录表

```
字段: id, worker_id, wallet_address, tx_hash, token_address,
      amount, status, error_message, triggered_by, trigger_reason, created_at
索引: worker_id, wallet_address, status, created_at
```

### 7.4 errors - 错误日志表

```
字段: id, worker_id, error, context, created_at
索引: worker_id, created_at
```

### 7.5 worker_logs - Worker 日志表

```
字段: id, worker_id, action, created_at
索引: worker_id, created_at
```

---

## 八、扩展模块关系图

```
                    ┌─────────────────────┐
                    │   Worker-1        │
                    │   (index.js)      │
                    └─────────┬─────────┘
                              │
              ┌─────────┼─────────┬─────────┐
              │         │         │         │
        ┌─────▼─────▼┐  ┌──▼───┐  ┌▼──────────┐
        │ Scanner1     │  │       │  │           │
        │ (scanner-1) │  │       │  │           │
        └─────┬───────┘  │       │  │           │
              │           │       │  │           │
              │      ┌────▼────▼────┐ │           │
              │      │   Transfer     │ │           │
              │      │   Manager      │ │           │
              │      └──────┬────────┘ │           │
              │             │          │           │
              │        ┌────▼────────▼────┐       │
              │        │  TransferScheduler│       │
              │        └─────┬──────────┘       │
              │              │                  │
              │        ┌─────▼───────────┐   │
              │        │  WalletTransfer    │   │
              │        │  (单个钱包)      │   │
              │        └───────────────────┘   │
              │                              │
              │                              │
        ┌─────▼──────────┬──────────────────────▼─────┐
        │  Database    │  EmergencyExtension      │
        │  Extension   │                       │
        └─────┬────────┴──────────────────────┘
              │
        ┌─────┼─────┬─────────┐
        │     │     │         │
    ┌───▼─┐ ┌─▼───┐ ┌─▼──────┐ ┌▼──────────┐
    │ Auth │ │Trans-│ │ System  │ │ Emergency │
    │Module│ │action│ │ Module  │ │Extension  │
    └──────┘ └──────┘ └─────────┘ └──────────┘
        │         │                    │
        └─────────┴────────────────────┘
                  │
            ┌───▼──────────────┐
            │  Supabase API   │
            │  (PostgreSQL)    │
            └──────────────────┘
```

---

## 九、关键设计决策

### 9.1 并发安全

- **WalletTransfer**: 每个钱包独立实例，私钥隔离
- **TransferScheduler**: 使用 `Map` 跟踪活跃转账，防止重复触发

### 9.2 Gas 优化

- 动态获取 Gas 价格 (`getFeeData()`)
- 使用 120% 倍数确保交易优先级
- 默认 3 gwei (BSC 常用值)

### 9.3 错误重试

- `withRetry` 机制：3 次重试，5 秒间隔
- RPC 调用、数据库写入都自动重试

### 9.4 缓存策略

- **白名单缓存**: 5 分钟 TTL
- **系统配置缓存**: 10 分钟 TTL
- **Nonce**: 5 分钟有效期 + 使用后立即删除

### 9.5 数据清理

- 自动调用 RPC 函数清理旧记录
- `cleanup_old_transactions`: 保留 1000 条
- `cleanup_old_errors`: 保留 1000 条
- `cleanup_expired_nonces`: 清理过期 nonce

---

## 十、环境变量汇总

### 10.1 Vars (wrangler.toml)

```
WORKER_ID, WORKER_TYPE, BSC_RPC,
EMERGENCY_SCAN_INTERVAL (5), EMERGENCY_MAX_DURATION (900),
BNB_THRESHOLD (0.001), WKEYDAO_THRESHOLD (0),
MAX_SCAN_DURATION (7000), MAX_TRANSFER_DURATION (7000),
TOKEN_BNB, TOKEN_WKEYDAO, TOKEN_ADDRESSES,
WRITE_DELAY_MINUTES, WHITELIST_CACHE_TTL, SYSTEM_CONFIG_CACHE_TTL
```

### 10.2 Secrets

```
SUPABASE_URL, SUPABASE_KEY, JWT_SECRET,
SAFE_WALLET, EMERGENCY_PRIVATE_KEY,
WALLET_PRIVATE_KEY_0x... (每个被保护钱包一个)
```

### 10.3 KV 命名空间

```
KV: 缓存层
EMERGENCY_STORE: 应急状态存储
```

---

## 十一、安全机制

### 11.1 权限控制

- **Web3 认证**: nonce + 签名验证
- **白名单机制**: 只有白名单地址是 `admin` 角色
- **JWT**: HMAC-SHA256 签名，24 小时有效期

### 11.2 输入验证

- **地址格式验证**: 钱包地址与私钥匹配
- **Nonce 防重放**: 使用后立即删除
- **参数校验**: 所有 API 参数完整性检查

### 11.3 错误处理

- **全局 try-catch**: 所有异步操作都有错误捕获
- **详细日志**: console.error 输出完整错误上下文
- **数据库错误记录**: 自动记录到 errors 表

---

## 十二、性能优化

### 12.1 并发查询

- **Promise.all**: BNB 和 wkeyDAO 余额并行查询
- **多钱包扫描**: 3 个钱包并行扫描

### 12.2 批量操作

- **triggerMultipleTransfers**: 使用 `Promise.allSettled()` 批量触发转账
- **批量写入**: 交易记录批量保存

### 12.3 延迟写入

- **worker-1**: 立即写入 (应急任务)
- **worker-2/3**: 延迟 1-2 分钟写入

---

**文档结束**
