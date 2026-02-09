# Worker 数据库设计文档

**创建日期**: 2026-02-09
**版本**: v1.0.0
**数据库**: PostgreSQL (Supabase)
**用途**: Cloudflare Worker 数据存储

---

## 概述

Worker 数据库使用 **多 Schema 架构**，将不同类型的数据隔离在不同的 Schema 中，提高数据管理的灵活性和安全性。

---

## Schema 架构

### 1. auth_schema - 鉴权相关

存储鉴权相关的数据，包括白名单和认证 nonce。

#### 1.1 whitelist 表

**用途**: 管理允许访问的地址白名单。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | `SERIAL` | PRIMARY KEY | 自增主键 |
| `wallet_address` | `VARCHAR(42)` | UNIQUE NOT NULL | 钱包地址 |
| `status` | `VARCHAR(20)` | DEFAULT 'active' | 状态: 'active', 'inactive' |
| `created_by` | `VARCHAR(42)` | NULL | 创建人地址 |
| `created_at` | `TIMESTAMP` | DEFAULT NOW() | 创建时间 |
| `deleted_by` | `VARCHAR(42)` | NULL | 删除人地址 |
| `deleted_at` | `TIMESTAMP` | NULL | 删除时间 |

**索引**:
- `idx_whitelist_address`: wallet_address
- `idx_whitelist_status`: status

**示例数据**:
```json
{
  "id": 1,
  "wallet_address": "0x1234567890123456789012345678901234567890",
  "status": "active",
  "created_by": "0xadmin",
  "created_at": "2026-02-09T10:00:00Z",
  "deleted_by": null,
  "deleted_at": null
}
```

#### 1.2 auth_nonce 表

**用途**: 存储认证 nonce，防止重放攻击。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | `SERIAL` | PRIMARY KEY | 自增主键 |
| `wallet_address` | `VARCHAR(42)` | NOT NULL | 钱包地址 |
| `nonce` | `VARCHAR(64)` | NOT NULL | 随机 nonce 值 |
| `expires_at` | `TIMESTAMP` | NOT NULL | 过期时间 |
| `created_at` | `TIMESTAMP` | DEFAULT NOW() | 创建时间 |

**索引**:
- `idx_auth_nonce_address`: wallet_address
- `idx_auth_nonce_expires`: expires_at

**示例数据**:
```json
{
  "id": 1,
  "wallet_address": "0x1234567890123456789012345678901234567890",
  "nonce": "abc123...",
  "expires_at": "2026-02-09T10:05:00Z",
  "created_at": "2026-02-09T10:00:00Z"
}
```

---

### 2. tx_schema - 交易记录

存储所有交易记录。

#### 2.1 transactions 表

**用途**: 记录 Worker 执行的所有交易。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | `SERIAL` | PRIMARY KEY | 自增主键 |
| `worker_id` | `VARCHAR(20)` | NOT NULL | Worker ID |
| `tx_hash` | `VARCHAR(66)` | UNIQUE | 交易哈希 |
| `from_address` | `VARCHAR(42)` | NOT NULL | 发送方地址 |
| `to_address` | `VARCHAR(42)` | NOT NULL | 接收方地址 |
| `token_symbol` | `VARCHAR(20)` | NOT NULL | 代币符号 |
| `amount` | `DECIMAL(30,18)` | NOT NULL | 转账金额 |
| `status` | `VARCHAR(20)` | NOT NULL | 交易状态: 'pending', 'success', 'failed' |
| `error_message` | `TEXT` | NULL | 错误信息 |
| `triggered_by` | `VARCHAR(42)` | NULL | 触发人地址 |
| `trigger_reason` | `VARCHAR(100)` | NULL | 触发原因 |
| `created_at` | `TIMESTAMP` | DEFAULT NOW() | 创建时间 |

**索引**:
- `idx_tx_worker_id`: worker_id
- `idx_tx_hash`: tx_hash
- `idx_tx_from`: from_address
- `idx_tx_to`: to_address
- `idx_tx_status`: status
- `idx_tx_created`: created_at DESC

**示例数据**:
```json
{
  "id": 1,
  "worker_id": "worker-1",
  "tx_hash": "0xabc123...",
  "from_address": "0x...",
  "to_address": "0x...",
  "token_symbol": "XPD",
  "amount": "1000000000.000000000000000000",
  "status": "success",
  "error_message": null,
  "triggered_by": "system",
  "trigger_reason": "emergency",
  "created_at": "2026-02-09T10:00:00Z"
}
```

---

### 3. system_schema - 系统配置

存储系统配置和元数据。

#### 3.1 protected_wallets 表

**用途**: 管理被保护的钱包地址。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | `SERIAL` | PRIMARY KEY | 自增主键 |
| `wallet_address` | `VARCHAR(42)` | UNIQUE NOT NULL | 钱包地址 |
| `name` | `VARCHAR(100)` | NULL | 钱包名称 |
| `status` | `VARCHAR(20)` | DEFAULT 'active' | 状态 |
| `added_by` | `VARCHAR(42)` | NULL | 添加人 |
| `created_at` | `TIMESTAMP` | DEFAULT NOW() | 创建时间 |
| `deleted_by` | `VARCHAR(42)` | NULL | 删除人 |
| `deleted_at` | `TIMESTAMP` | NULL | 删除时间 |
| `updated_by` | `VARCHAR(42)` | NULL | 更新人 |
| `updated_at` | `TIMESTAMP` | NULL | 更新时间 |

**索引**:
- `idx_protected_wallets_address`: wallet_address

#### 3.2 hacker_wallets 表

**用途**: 管理黑客钱包地址（黑名单）。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | `SERIAL` | PRIMARY KEY | 自增主键 |
| `wallet_address` | `VARCHAR(42)` | UNIQUE NOT NULL | 钱包地址 |
| `name` | `VARCHAR(100)` | NULL | 名称 |
| `status` | `VARCHAR(20)` | DEFAULT 'active' | 状态 |
| `added_by` | `VARCHAR(42)` | NULL | 添加人 |
| `created_at` | `TIMESTAMP` | DEFAULT NOW() | 创建时间 |
| `deleted_by` | `VARCHAR(42)` | NULL | 删除人 |
| `deleted_at` | `TIMESTAMP` | NULL | 删除时间 |
| `updated_by` | `VARCHAR(42)` | NULL | 更新人 |
| `updated_at` | `TIMESTAMP` | NULL | 更新时间 |

**索引**:
- `idx_hacker_wallets_address`: wallet_address

#### 3.3 contracts 表

**用途**: 管理代币合约信息。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | `SERIAL` | PRIMARY KEY | 自增主键 |
| `contract_address` | `VARCHAR(42)` | UNIQUE NOT NULL | 合约地址 |
| `symbol` | `VARCHAR(20)` | NOT NULL | 代币符号 |
| `decimals` | `INTEGER` | NULL | 精度 |
| `status` | `VARCHAR(20)` | DEFAULT 'active' | 状态 |
| `added_by` | `VARCHAR(42)` | NULL | 添加人 |
| `created_at` | `TIMESTAMP` | DEFAULT NOW() | 创建时间 |
| `deleted_by` | `VARCHAR(42)` | NULL | 删除人 |
| `deleted_at` | `TIMESTAMP` | NULL | 删除时间 |
| `updated_by` | `VARCHAR(42)` | NULL | 更新人 |
| `updated_at` | `TIMESTAMP` | NULL | 更新时间 |

**索引**:
- `idx_contracts_address`: contract_address

#### 3.4 rpc_nodes 表

**用途**: 管理 RPC 节点列表。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | `SERIAL` | PRIMARY KEY | 自增主键 |
| `rpc_url` | `VARCHAR(500)` | NOT NULL | RPC URL |
| `name` | `VARCHAR(100)` | NULL | 节点名称 |
| `status` | `VARCHAR(20)` | DEFAULT 'active' | 状态 |
| `added_by` | `VARCHAR(42)` | NULL | 添加人 |
| `created_at` | `TIMESTAMP` | DEFAULT NOW() | 创建时间 |
| `deleted_by` | `VARCHAR(42)` | NULL | 删除人 |
| `deleted_at` | `TIMESTAMP` | NULL | 删除时间 |
| `updated_by` | `VARCHAR(42)` | NULL | 更新人 |
| `updated_at` | `TIMESTAMP` | NULL | 更新时间 |

**索引**:
- `idx_rpc_nodes_status`: status

#### 3.5 db_connections 表

**用途**: 管理数据库连接配置。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | `SERIAL` | PRIMARY KEY | 自增主键 |
| `connection_name` | `VARCHAR(100)` | NOT NULL | 连接名称 |
| `connection_url` | `TEXT` | NOT NULL | 连接 URL |
| `purpose` | `VARCHAR(50)` | NULL | 用途 |
| `status` | `VARCHAR(20)` | DEFAULT 'active' | 状态 |
| `added_by` | `VARCHAR(42)` | NULL | 添加人 |
| `created_at` | `TIMESTAMP` | DEFAULT NOW() | 创建时间 |
| `deleted_by` | `VARCHAR(42)` | NULL | 删除人 |
| `deleted_at` | `TIMESTAMP` | NULL | 删除时间 |
| `updated_by` | `VARCHAR(42)` | NULL | 更新人 |
| `updated_at` | `TIMESTAMP` | NULL | 更新时间 |

---

## 数据库特性

### 1. Row Level Security (RLS)

所有表都启用了 RLS，配置如下：

- **公共读取**: 允许所有人读取数据
- **认证写入**: 仅允许认证用户写入数据

### 2. 延迟写入机制

Worker 使用延迟写入机制，避免阻塞：

- **worker-1**: 立即写入（应急任务）
- **worker-2**: 延迟 1 分钟
- **worker-3**: 延迟 2 分钟

### 3. 自动清理

定期清理旧数据：

- **auth_nonce 表**: 超过 500 条自动清理
- **transactions 表**: 超过 1000 条自动清理最早 100 条

---

## 常用查询

### 鉴权相关

```sql
-- 查询白名单
SELECT * FROM auth_schema.whitelist WHERE status = 'active';

-- 添加白名单
INSERT INTO auth_schema.whitelist (wallet_address, status, created_by)
VALUES ('0x...', 'active', '0xadmin');

-- 查询未过期的 nonce
SELECT * FROM auth_schema.auth_nonce
WHERE expires_at > NOW();
```

### 交易记录

```sql
-- 查询最近交易
SELECT * FROM tx_schema.transactions
ORDER BY created_at DESC
LIMIT 10;

-- 查询特定 Worker 的交易
SELECT * FROM tx_schema.transactions
WHERE worker_id = 'worker-1'
ORDER BY created_at DESC;

-- 查询失败交易
SELECT * FROM tx_schema.transactions
WHERE status = 'failed'
ORDER BY created_at DESC;
```

### 系统配置

```sql
-- 查询被保护钱包
SELECT * FROM system_schema.protected_wallets
WHERE status = 'active';

-- 查询活跃的 RPC 节点
SELECT * FROM system_schema.rpc_nodes
WHERE status = 'active';

-- 查询代币合约
SELECT * FROM system_schema.contracts
WHERE status = 'active';
```

---

## 数据库维护

### 清理过期 nonce

```sql
DELETE FROM auth_schema.auth_nonce
WHERE expires_at < NOW();
```

### 清理旧交易记录

```sql
DELETE FROM tx_schema.transactions
WHERE created_at < NOW() - INTERVAL '30 days';
```

---

## 相关文档

- [Supabase 配置指南](../Supabase配置指南.md)
- [前端数据库设计](../frontend/Frontend-数据库设计文档.md)
- [Worker 扩展模块](../../cloudflare/extensions/database/README.md)

---

**最后更新**: 2026-02-09
**版本**: v1.0.0
