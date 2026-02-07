# worker-tactics-1 数据库使用情况分析

**日期**: 2026-01-27
**分析范围**: worker-tactics-1 及其依赖的扩展

---

## 概述

worker-tactics-1 使用 Supabase PostgreSQL 作为数据持久化层，通过 DatabaseExtension 统一访问数据库。

### 数据库架构

```
Supabase (PostgreSQL)
├── Auth Tables         (whitelist, auth_nonce)
├── System Tables       (rpc_nodes, protected_wallets, hacker_wallets, contracts)
├── Task Tables         (scan_tasks)
├── Transaction Tables  (transactions, worker_logs)
└── Error Tables        (errors)
```

---

## 数据库使用情况总结

### ✅ 已使用的表

#### 1.1 transactions 表
**用途**: 记录转账操作

**使用位置**:
- `worker-tactics-1/src/index.js:181-192` - 保存成功交易
- `worker-tactics-1/src/index.js:199-210` - 保存失败交易
- `worker-1-interception/src/index.js` - 保存交易记录

**写入字段**:
```javascript
{
  worker_id: 'worker-tactics-1',
  wallet_address: '0x...',
  tx_hash: '0x...' || null,
  token_address: '0x...',
  amount: '0',
  status: 'pending' | 'failed',
  error_message: null | '...',
  triggered_by: 'worker-tactics-1' | 'worker-tactics-1-emergency',
  trigger_reason: 'tactics_scan' | 'emergency_mode',
  created_at: '2026-01-27T...'
}
```

**触发条件**:
- wkeyDAO > 0 时触发转账
- USDT > 0 时触发转账
- 应急模式下检测到余额 > 0

**清理策略**: 超过 1000 条记录自动清理最早的记录

---

#### 1.2 errors 表
**用途**: 记录错误日志

**使用位置**:
- `worker-tactics-1/src/index.js:121-127` - 扫描失败
- `worker-tactics-1/src/index.js:149-154` - 主程序错误
- `worker-tactics-1/src/index.js:267-273` - 应急模式转账失败
- `worker-tactics-1/src/index.js:287-293` - 应急循环错误

**写入字段**:
```javascript
{
  worker_id: 'worker-tactics-1',
  wallet_address: '0x...' || null,
  error: '...',
  context: 'scheduled_scan' | 'emergency_transfer' | 'gas_funding_success' | ...,
  created_at: '2026-01-27T...'
}
```

**触发条件**:
- 扫描失败（RPC 超时、网络错误）
- 转账失败
- 数据库操作失败
- Gas 费补充成功/失败

**清理策略**: 超过 1000 条记录自动清理最早的记录

---

### ⚠️ 未使用但已定义的表

#### 2.1 auth_nonce 表
**状态**: ✅ 表已定义，未使用

**说明**: worker-tactics-1 不需要鉴权功能，此表用于其他 worker（如 API 端点）

---

#### 2.2 scan_tasks 表
**状态**: ✅ 表已定义，未使用

**说明**: worker-tactics-1 不使用任务调度表，直接使用 cron 触发

---

#### 2.3 worker_logs 表
**状态**: ✅ 表已定义，未使用

**说明**: worker-tactics-1 直接使用 console.log 输出日志

---

#### 2.4 System Tables (rpc_nodes, protected_wallets, etc.)
**状态**: ✅ 表已定义，未使用

**说明**:
- `rpc_nodes`: worker-tactics-1 使用 RpcPoolExtension 的 KV 存储
- `protected_wallets`: worker-tactics-1 使用硬编码钱包地址
- `hacker_wallets`: 未使用
- `contracts`: 未使用

---

## 数据迁移需求

### 🟡 可选: 添加 gas_funding_events 表

**原因**: 记录 Gas 费补充操作，便于追踪和审计

**迁移 SQL**:

```sql
-- gas_funding_events 表
CREATE TABLE IF NOT EXISTS gas_funding_events (
    id BIGSERIAL PRIMARY KEY,
    worker_id VARCHAR(50) NOT NULL,
    wallet_address VARCHAR(42) NOT NULL,
    from_wallet VARCHAR(42) NOT NULL,
    amount NUMERIC(40, 18) NOT NULL,
    tx_hash VARCHAR(66),
    status VARCHAR(20) NOT NULL,  -- 'pending' | 'success' | 'failed'
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gas_funding_wallet ON gas_funding_events(wallet_address);
CREATE INDEX IF NOT EXISTS idx_gas_funding_worker ON gas_funding_events(worker_id);
CREATE INDEX IF NOT EXISTS idx_gas_funding_status ON gas_funding_events(status);
CREATE INDEX IF NOT EXISTS idx_gas_funding_created_at ON gas_funding_events(created_at DESC);

-- 启用 RLS
ALTER TABLE gas_funding_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to gas_funding_events" ON gas_funding_events
    TO postgres USING (true) WITH CHECK (true);

-- 添加 updated_at 触发器
CREATE TRIGGER update_gas_funding_events_updated_at BEFORE UPDATE ON gas_funding_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### 🟢 建议: 添加 rpc_pool_status 表

**原因**: 记录 RPC 节点池状态变化，便于监控

**迁移 SQL**:

```sql
-- rpc_pool_status 表
CREATE TABLE IF NOT EXISTS rpc_pool_status (
    id BIGSERIAL PRIMARY KEY,
    worker_id VARCHAR(50) NOT NULL,
    node_url VARCHAR(500) NOT NULL,
    event_type VARCHAR(50) NOT NULL,  -- 'failed' | 'recovered' | 'moved'
    position INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rpc_pool_node ON rpc_pool_status(node_url);
CREATE INDEX IF NOT EXISTS idx_rpc_pool_worker ON rpc_pool_status(worker_id);
CREATE INDEX IF NOT EXISTS idx_rpc_pool_created_at ON rpc_pool_status(created_at DESC);

-- 启用 RLS
ALTER TABLE rpc_pool_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to rpc_pool_status" ON rpc_pool_status
    TO postgres USING (true) WITH CHECK (true);
```

---

## 代码修改需求

### 🟢 可选: GasFundingModule

**新建文件**: `cloudflare/extensions/database/gasFunding.js`

**新建文件**: `cloudflare/extensions/database/gasFunding.js`

参考 EmergencyModule 的结构，添加 Gas 费补充记录功能。

---

### 3. 🟢 可选: RpcPoolStatusModule

**新建文件**: `cloudflare/extensions/database/rpcPoolStatus.js`

参考 EmergencyModule 的结构，添加 RPC 节点池状态记录功能。

---

## 数据库连接配置

### 环境变量

```toml
# wrangler.toml
[vars]
# 无需额外配置

# Secrets (使用 wrangler secret put 配置)
# SUPABASE_URL - Supabase项目URL
# SUPABASE_KEY - Supabase服务密钥
```

### KV 命名空间

```toml
[[kv_namespaces]]
binding = "KV"
id = "YOUR_KV_ID"
preview_id = "YOUR_PREVIEW_KV_ID"
```

**用途**:
- 缓存 RPC 节点列表（10分钟）
- 缓存白名单（5分钟）

---

## 性能分析

### 2. 写入频率

| 表 | 写入频率 | 每分钟最大写入 |
|----|---------|----------------|
| transactions | 触发转账时 | 1-3 条 |
| errors | 出错时 | 0-10 条 |
| total | - | **~11 条/分钟** |

### 查询频率

| 操作 | 频率 | 说明 |
|------|------|------|
| saveTransaction | 1-3 次/分钟 | 插入交易记录 |
| logError | 0-10 次/分钟 | 插入错误日志 |
| checkAndCleanTable | 4 次/分钟 | 检查是否需要清理 |
| cleanup_old_transactions | 按需 | RPC 调用清理函数 |
| cleanup_old_errors | 按需 | RPC 调用清理函数 |

### 存储容量

| 表 | 保留记录数 | 预估月增长 |
|----|-----------|-----------|
| transactions | 1000 | ~130,000 条 |
| errors | 1000 | ~432,000 条 |
| **total** | - | ~562,000 条 |

Supabase 免费版限制：
- 500MB 数据库存储
- 2GB 文件存储
- 50,000 行/月 读取
- 20,000 行/月 写入

**结论**: 需要启用 Supabase Pro 版本或优化清理策略

---

## 清理策略建议

### 1. 调整自动清理阈值

**当前**:
- transactions: 1000 条
- errors: 1000 条

**建议**:
```javascript
// 降低到 500 条，减少存储压力
await this.db.checkAndCleanTable('public', 'transactions', 500);
await this.db.checkAndCleanTable('public', 'errors', 500);
```

---

## 总结

### 数据库使用情况

| 表 | 使用状态 | 是否需要迁移 |
|----|---------|-------------|
| transactions | ✅ 已使用 | ❌ 否 |
| errors | ✅ 已使用 | ❌ 否 |
| emergency_events | ❌ 未使用 | 🔴 **是** |
| auth_nonce | ✅ 已定义 | ❌ 否 |
| scan_tasks | ✅ 已定义 | ❌ 否 |
| worker_logs | ✅ 已定义 | ❌ 否 |
| rpc_nodes | ✅ 已定义 | ❌ 否 |
| protected_wallets | ✅ 已定义 | ❌ 否 |
| hacker_wallets | ✅ 已定义 | ❌ 否 |
| contracts | ✅ 已定义 | ❌ 否 |

### 代码修改需求

| 文件 | 修改类型 | 优先级 |
|------|---------|--------|
| `cloudflare/extensions/database/DatabaseExtension.js` | 添加 emergency 模块 | 🔴 紧急 |
| `cloudflare/extensions/database/emergency.js` | 新建文件 | 🔴 紧急 |
| `supabase/01-create-emergency-tables.sql` | 新建迁移脚本 | 🔴 紧急 |
| `cloudflare/extensions/database/gasFunding.js` | 新建文件（可选） | 🟡 建议 |
| `supabase/02-create-gas-funding-tables.sql` | 新建迁移脚本（可选） | 🟡 建议 |

### 执行顺序

1. **立即执行**（紧急）:
   - 创建 `emergency_events` 表
   - 添加 `EmergencyModule` 到 DatabaseExtension

2. **建议执行**（下次迭代）:
   - 创建 `gas_funding_events` 表
   - 添加 `GasFundingModule`

3. **可选执行**（监控优化）:
   - 创建 `rpc_pool_status` 表
   - 调整自动清理阈值

---

**结论**: worker-tactics-1 对数据库的使用**基本正常**，但需要补充 `emergency_events` 表以完整记录应急状态变化。
