# Worker-1 依赖数据库表说明

**创建日期**: 2026-01-22
**用途**: 说明 Worker-1 (Interception Worker) 运行所需的数据库表

---

## 概述

Worker-1 是核心拦截 Worker，负责：
- 常规扫描（每分钟）
- 应急状态扫描（每5秒）
- 执行转账任务
- 提供 HTTP API 接口

## Worker-1 依赖的数据库表

### 1. whitelist（白名单表）

**用途**: Web3 登录鉴权，验证钱包地址是否在白名单中

**字段说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL | 主键 |
| wallet_address | VARCHAR(42) | 钱包地址（唯一） |
| status | VARCHAR(20) | 状态（active/inactive） |
| added_by | VARCHAR(100) | 添加者 |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

**使用场景**:
- 用户通过 Web3 签名登录时，查询是否在白名单
- `/api/auth/login` 接口调用 `db.auth.checkWhitelist()`

---

### 2. auth_nonce（签名 Nonce 表）

**用途**: 存储 Web3 签名验证的临时 Nonce

**字段说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL | 主键 |
| wallet_address | VARCHAR(42) | 钱包地址 |
| nonce | VARCHAR(64) | Nonce 值（唯一） |
| expires_at | TIMESTAMPTZ | 过期时间 |
| created_at | TIMESTAMPTZ | 创建时间 |
| used_at | TIMESTAMPTZ | 使用时间 |

**使用场景**:
- 用户请求登录时，`/api/auth/nonce` 生成 Nonce 并存储
- 用户提交签名时，验证 Nonce 有效性并标记已使用

---

### 3. transactions（交易记录表）

**用途**: 记录所有转账操作（自动 + 手动）

**字段说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL | 主键 |
| worker_id | VARCHAR(20) | Worker ID |
| wallet_address | VARCHAR(42) | 来源钱包地址 |
| tx_hash | VARCHAR(66) | 交易哈希（唯一） |
| token_address | VARCHAR(42) | 代币地址 |
| amount | NUMERIC(40,18) | 转账金额 |
| status | VARCHAR(20) | 状态（pending/success/failed） |
| error_message | TEXT | 错误信息 |
| triggered_by | VARCHAR(100) | 触发者 |
| trigger_reason | TEXT | 触发原因 |
| created_at | TIMESTAMPTZ | 创建时间 |

**使用场景**:
- 应急模式触发转账时记录（status: pending）
- 常规扫描触发转账时记录
- 手动转账时记录（`/api/transfer`）
- 查询交易历史（`/api/transactions`）

**触发原因**:
- `emergency_mode` - 应急模式触发
- `wkeydao_balance_gt_zero` - wkeyDAO 余额 > 0
- `bnb_balance_exceeds_threshold` - BNB 余额超过阈值
- `manual` - 手动转账

---

### 4. errors（错误记录表）

**用途**: 记录 Worker 运行中的错误

**字段说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL | 主键 |
| worker_id | VARCHAR(20) | Worker ID |
| error | TEXT | 错误信息 |
| context | JSONB | 错误上下文 |
| created_at | TIMESTAMPTZ | 创建时间 |

**使用场景**:
- 定时扫描出错时记录（`db.transaction.logError()`）
- 转账失败时记录
- API 请求错误时记录

---

### 5. worker_logs（Worker 日志表）

**用途**: 记录 Worker 执行日志，用于避免重复扫描

**字段说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL | 主键 |
| worker_id | VARCHAR(20) | Worker ID |
| action | VARCHAR(50) | 执行动作 |
| created_at | TIMESTAMPTZ | 创建时间 |

**使用场景**:
- 检查 GlobalScanner 是否在最近 1 分钟内执行
- 避免重复触发转账
- Worker-1 定时任务启动时记录 `scheduled_scan`

**查询示例**:
```javascript
// 检查最近1分钟内是否有 global-scanner 执行
const { data: globalScan } = await db.client
  .from('worker_logs')
  .select('*')
  .eq('worker_id', 'global-scanner')
  .gte('created_at', new Date(Date.now() - 60000).toISOString())
  .order('created_at', { ascending: false })
  .limit(1)
```

---

## 表之间的关系

```
Worker-1 执行流程：

1. 定时任务触发
   ↓
2. 检查 worker_logs 表
   ├─ 如果 global-scanner 最近1分钟执行过 → 跳过
   └─ 否则 → 继续执行
   ↓
3. 应急状态检查（从 EMERGENCY_STORE KV 读取）
   ├─ 有应急状态 → 进入 5 秒高频扫描
   │  └─ 触发转账 → 记录到 transactions 表
   └─ 无应急状态 → 常规扫描
      ├─ 检测到资产 → 记录到 transactions 表
      └─ 记录本次扫描到 worker_logs 表
   ↓
4. HTTP API 请求
   ├─ 登录 → 查询 whitelist + auth_nonce
   ├─ 转账 → 记录到 transactions 表
   └─ 查询历史 → 从 transactions 表读取
   ↓
5. 错误处理
   └─ 记录到 errors 表
```

---

## 索引说明

### whitelist 表索引
- `idx_whitelist_wallet` - 按 wallet_address 查询（最常用）
- `idx_whitelist_status` - 按状态查询

### auth_nonce 表索引
- `idx_auth_nonce_wallet` - 按钱包地址查询
- `idx_auth_nonce_nonce` - 按 nonce 查询（验证时使用）
- `idx_auth_nonce_expires` - 按过期时间查询（清理时使用）

### transactions 表索引
- `idx_transactions_worker` - 按 worker_id 查询
- `idx_transactions_wallet` - 按钱包地址查询
- `idx_transactions_status` - 按状态查询
- `idx_transactions_created_at` - 按创建时间倒序（查询历史）

### errors 表索引
- `idx_errors_worker` - 按 worker_id 查询
- `idx_errors_created_at` - 按创建时间倒序

### worker_logs 表索引
- `idx_worker_logs_worker` - 按 worker_id 查询
- `idx_worker_logs_created_at` - 按创建时间倒序
- `idx_worker_logs_worker_created` - **组合索引**（最常用，用于检查最近执行）

---

## 数据清理策略

### auth_nonce 表
- 过期 Nonce：删除 `expires_at < NOW()` 的记录
- 已使用 Nonce：删除 `used_at < NOW() - INTERVAL '1 hour'` 的记录
- 清理函数：`cleanup_expired_nonces()`

### transactions 表
- 保留最近 1000 条记录
- 清理函数：`cleanup_old_transactions(1000)`

### errors 表
- 保留最近 1000 条记录
- 清理函数：`cleanup_old_errors(1000)`

---

## 初始化检查清单

部署 Worker-1 前，请确认以下表已创建：

- [ ] `whitelist` - 白名单表
- [ ] `auth_nonce` - 签名 Nonce 表
- [ ] `transactions` - 交易记录表
- [ ] `errors` - 错误记录表
- [ ] `worker_logs` - Worker 日志表

**初始化脚本**: `/workspace/supabase/00-init.sql`

---

## 常见问题

### Q: Worker-1 可以在没有数据库的情况下运行吗？

A: 不可以。Worker-1 依赖数据库进行：
- 鉴权（whitelist + auth_nonce）
- 交易记录（transactions）
- 错误日志（errors）
- 重复扫描检查（worker_logs）

### Q: 如果数据库不可用，Worker-1 会怎样？

A: Worker-1 会尝试重试 3 次（`withRetry` 机制），如果仍然失败则记录错误到控制台，转账操作会失败。

### Q: worker_logs 表的作用是什么？

A: 用于避免多个 Worker 重复触发转账。Worker-1 会检查 GlobalScanner 是否在最近 1 分钟内执行，如果是则跳过本次扫描。

---

**最后更新**: 2026-01-22
