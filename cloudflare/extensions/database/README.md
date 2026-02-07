# 数据库扩展模块 (Database Extension)

## 概述

数据库扩展模块是 X-plan 项目的核心数据层，提供统一的数据库访问接口，支持多 Schema、延迟写入、KV 缓存等功能。

## 功能特性

### 1. 多 Schema 支持
- **auth_schema**: 鉴权相关（白名单、nonce）
- **tx_schema**: 交易记录
- **system_schema**: 系统配置（RPC节点、钱包地址、合约等）

### 2. 延迟写入机制（分钟级）
- **worker-1**: 立即写入（应急任务）
- **worker-2**: 延迟 1 分钟
- **worker-3**: 延迟 2 分钟

### 3. KV 缓存层
- 白名单缓存（5分钟）
- 系统配置缓存（10分钟）
- 写入队列持久化

### 4. 错误重试
- 最大重试次数：3次
- 重试间隔：5秒

### 5. 自动清理
- 交易记录表：超过1000条自动清理最早100条
- auth_nonce表：超过500条自动清理
- error_logs表：超过500条自动清理

## 目录结构

```
cloudflare/extensions/database/
├── DatabaseExtension.js    # 主扩展类
├── config.js               # 配置文件
├── auth.js                 # 鉴权模块
├── transaction.js          # 交易记录模块
├── system.js               # 系统配置模块
└── README.md              # 本文档
```

## 使用方法

### 初始化

```javascript
import { DatabaseExtension } from './cloudflare/extensions/database/DatabaseExtension.js';

export default {
  async fetch(request, env) {
    const db = new DatabaseExtension(env);
    await db.initialize();

    // 使用数据库...
  }
}
```

### 鉴权模块使用

```javascript
// 检查白名单
const isWhitelisted = await db.auth.checkWhitelist(address);

// 添加白名单
await db.auth.addWhitelist(address, addedBy);

// 删除白名单
await db.auth.removeWhitelist(address, removedBy);

// 获取所有白名单
const whitelist = await db.auth.getWhitelist();
```

### 交易记录模块使用

```javascript
// 保存交易记录（直接写入 Supabase）
await db.transaction.saveTransaction({
  txHash: '0x...',
  fromAddress: '0x...',
  toAddress: '0x...',
  tokenSymbol: 'BNB',
  amount: '1.5',
  status: 'success',
  triggeredBy: 'system',
  triggerReason: 'emergency'
});

// 更新交易状态
await db.transaction.updateTransactionStatus('0x...', 'success', {
  gasUsed: '21000',
  blockNumber: 12345
});

// 查询最近交易
const transactions = await db.transaction.getRecentTransactions('0x...', 10);

// 查询失败交易
const failedTxs = await db.transaction.getFailedTransactions('0x...', 10);
```

### 系统配置模块使用

```javascript
// 保存事件日志
await db.system.saveEvent({
  type: 'worker_restart',
  worker_id: 'integrated-pool-2',
  timestamp: new Date().toISOString(),
  reason: 'manual_restart'
});

// 保存错误日志
await db.system.saveError({
  walletAddress: '0x...',
  tokenType: 'wkeydao',
  error: 'Transaction failed',
  timestamp: new Date().toISOString()
});

// 健康检查
await db.system.ping();

// 清理旧数据（通过 RPC）
await db.checkAndCleanTable('system_errors', 500);
await db.checkAndCleanTable('transactions', 1000);
```

## 数据库表设计

### auth_schema

#### whitelist 表
```sql
CREATE TABLE auth_schema.whitelist (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_by VARCHAR(42),
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_by VARCHAR(42),
  deleted_at TIMESTAMP
);
```

#### auth_nonce 表
```sql
CREATE TABLE auth_schema.auth_nonce (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  nonce VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### tx_schema

#### transactions 表
```sql
CREATE TABLE tx_schema.transactions (
  id SERIAL PRIMARY KEY,
  worker_id VARCHAR(20) NOT NULL,
  tx_hash VARCHAR(66) UNIQUE,
  from_address VARCHAR(42) NOT NULL,
  to_address VARCHAR(42) NOT NULL,
  token_symbol VARCHAR(20) NOT NULL,
  amount DECIMAL(30,18) NOT NULL,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  triggered_by VARCHAR(42),
  trigger_reason VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### system_schema

#### protected_wallets 表
```sql
CREATE TABLE system_schema.protected_wallets (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  added_by VARCHAR(42),
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_by VARCHAR(42),
  deleted_at TIMESTAMP,
  updated_by VARCHAR(42),
  updated_at TIMESTAMP
);
```

#### hacker_wallets 表
```sql
CREATE TABLE system_schema.hacker_wallets (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  added_by VARCHAR(42),
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_by VARCHAR(42),
  deleted_at TIMESTAMP,
  updated_by VARCHAR(42),
  updated_at TIMESTAMP
);
```

#### contracts 表
```sql
CREATE TABLE system_schema.contracts (
  id SERIAL PRIMARY KEY,
  contract_address VARCHAR(42) UNIQUE NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  decimals INTEGER,
  status VARCHAR(20) DEFAULT 'active',
  added_by VARCHAR(42),
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_by VARCHAR(42),
  deleted_at TIMESTAMP,
  updated_by VARCHAR(42),
  updated_at TIMESTAMP
);
```

#### rpc_nodes 表
```sql
CREATE TABLE system_schema.rpc_nodes (
  id SERIAL PRIMARY KEY,
  rpc_url VARCHAR(500) NOT NULL,
  name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  added_by VARCHAR(42),
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_by VARCHAR(42),
  deleted_at TIMESTAMP,
  updated_by VARCHAR(42),
  updated_at TIMESTAMP
);
```

#### db_connections 表
```sql
CREATE TABLE system_schema.db_connections (
  id SERIAL PRIMARY KEY,
  connection_name VARCHAR(100) NOT NULL,
  connection_url TEXT NOT NULL,
  purpose VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  added_by VARCHAR(42),
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_by VARCHAR(42),
  deleted_at TIMESTAMP,
  updated_by VARCHAR(42),
  updated_at TIMESTAMP
);
```

## 配置说明

在 `config.js` 中可以配置：

- **writeDelays**: 各 worker 的写入延迟（分钟）
- **retry**: 重试配置（次数、间隔）
- **cache**: KV 缓存 TTL
- **tableThresholds**: 自动清理阈值
- **schemas**: Schema 名称配置

## 定时任务配置

需要在 Cloudflare Worker 中配置定时任务来处理延迟写入队列：

```javascript
export default {
  async scheduled(event, env) {
    const db = new DatabaseExtension(env);
    await db.initialize();
    await db.processWriteQueue(); // 每分钟处理一次
  }
}
```

wrangler.toml 配置：
```toml
[triggers]
crons = ["* * * * *"] # 每分钟执行
```

## 数据中台接口

以下接口预留用于数据中台：

1. **交易记录分析**
   - 按时间范围统计
   - 按 worker 分组统计
   - 成功率分析

2. **RPC节点监控**
   - 节点可用性
   - 响应时间
   - 失败率

3. **告警系统**
   - 交易失败告警
   - 节点异常告警
   - 钱包活动告警

## 注意事项

1. **延迟写入**: 非紧急数据使用延迟写入，避免阻塞
2. **自动清理**: 定期检查表记录数，避免超出免费额度
3. **缓存管理**: 合理设置 TTL，避免缓存过期
4. **错误处理**: 所有操作都带重试机制
5. **连接管理**: 数据库连接信息需要加密存储

## 扩展接口

除了你提出的接口外，建议增加以下可选接口：

1. **日志管理模块**
   - 查询错误日志
   - 日志分类过滤
   - 日志导出

2. **统计分析模块**
   - 交易趋势分析
   - Worker 性能对比
   - 告警统计分析

3. **配置备份模块**
   - 配置导出
   - 配置导入
   - 配置版本管理

4. **监控告警模块**
   - Webhook 配置
   - 告警规则管理
   - 告警历史记录
