# X-plan 官网 Supabase 数据库设计

**创建日期**: 2026-02-09
**版本**: v1.0.0
**数据库**: PostgreSQL (Supabase)

---

## 概述

X-plan 官网需要两个核心表用于存储系统日志和交易记录。

---

## 数据库表结构

### 1. logs 表

**用途**: 存储系统操作日志，用于监控和调试。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | `uuid` | PRIMARY KEY | 日志唯一标识 |
| `timestamp` | `timestamptz` | NOT NULL | 时间戳 |
| `level` | `text` | NOT NULL | 日志级别: 'info', 'warn', 'error' |
| `category` | `text` | NOT NULL | 日志分类: 'monitor', 'transfer', 'error' |
| `message` | `text` | NOT NULL | 日志消息 |
| `tx_hash` | `text` | NULL | 关联的交易哈希（可选） |
| `created_at` | `timestamptz` | NOT NULL DEFAULT NOW() | 记录创建时间 |

**索引**:
- `idx_logs_timestamp`: 按 timestamp 降序（用于时间范围查询）
- `idx_logs_level`: 按 level 筛选
- `idx_logs_category`: 按 category 筛选

**示例数据**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-02-09T10:30:00Z",
  "level": "info",
  "category": "monitor",
  "message": "扫描钱包地址: 0x...",
  "tx_hash": null,
  "created_at": "2026-02-09T10:30:00Z"
}
```

---

### 2. transactions 表

**用途**: 存储交易记录，追踪资产转移。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | `uuid` | PRIMARY KEY | 交易唯一标识 |
| `from_address` | `text` | NOT NULL | 发送方地址 |
| `to_address` | `text` | NOT NULL | 接收方地址 |
| `amount` | `text` | NOT NULL | 转账金额（字符串，支持大数） |
| `token_address` | `text` | NOT NULL | 代币合约地址 |
| `tx_hash` | `text` | NOT NULL UNIQUE | 交易哈希 |
| `status` | `text` | NOT NULL | 交易状态: 'pending', 'success', 'failed' |
| `created_at` | `timestamptz` | NOT NULL DEFAULT NOW() | 记录创建时间 |

**索引**:
- `idx_transactions_from_address`: 按发送方地址查询
- `idx_transactions_to_address`: 按接收方地址查询
- `idx_transactions_tx_hash`: 按 tx_hash 查询（唯一）
- `idx_transactions_status`: 按状态筛选
- `idx_transactions_created_at`: 按时间降序

**示例数据**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "from_address": "0x123...",
  "to_address": "0x456...",
  "amount": "1000000000",
  "token_address": "0x35774A4E1fFEee74Fa3859F89cfae00b3aC8C3A8",
  "tx_hash": "0xabc123...",
  "status": "success",
  "created_at": "2026-02-09T10:30:00Z"
}
```

---

## SQL 创建脚本

### 完整 SQL 脚本

```sql
-- ========================================
-- X-plan 官网数据库创建脚本
-- 版本: v1.0.0
-- 日期: 2026-02-09
-- ========================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- 1. 创建 logs 表
-- ========================================

CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  category TEXT NOT NULL CHECK (category IN ('monitor', 'transfer', 'error')),
  message TEXT NOT NULL,
  tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_category ON logs(category);
CREATE INDEX IF NOT EXISTS idx_logs_tx_hash ON logs(tx_hash);

-- ========================================
-- 2. 创建 transactions 表
-- ========================================

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  token_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_transactions_from_address ON transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_transactions_to_address ON transactions(to_address);
CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- ========================================
-- 3. 插入测试数据（可选）
-- ========================================

-- 插入测试日志
INSERT INTO logs (timestamp, level, category, message) VALUES
  (NOW(), 'info', 'monitor', '系统启动'),
  (NOW() - INTERVAL '1 minute', 'info', 'monitor', '开始扫描钱包');

-- 插入测试交易
INSERT INTO transactions (
  from_address,
  to_address,
  amount,
  token_address,
  tx_hash,
  status
) VALUES (
  '0x0000000000000000000000000000000000000000',
  '0x0000000000000000000000000000000000000001',
  '1000000000',
  '0x35774A4E1fFEee74Fa3859F89cfae00b3aC8C3A8',
  '0x0000000000000000000000000000000000000000000000000000000000000000',
  'success'
);

-- ========================================
-- 4. Row Level Security (RLS) 策略
-- ========================================

-- 启用 RLS
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取（公共访问）
CREATE POLICY "Allow public read access on logs"
  ON logs FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public read access on transactions"
  ON transactions FOR SELECT
  TO public
  USING (true);

-- 允许服务密钥写入
-- 注意: 在实际使用中，应该创建特定的 API Key 或使用 Supabase Service Role Key
CREATE POLICY "Allow service insert on logs"
  ON logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow service insert on transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ========================================
-- 完成
-- ========================================

-- 查看创建的表
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name IN ('logs', 'transactions')
ORDER BY table_name, ordinal_position;
```

---

## Supabase 配置步骤

### 1. 在 Supabase 控制台执行 SQL

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 左侧菜单 → **SQL Editor**
4. 点击 **New Query**
5. 粘贴上面的 SQL 脚本
6. 点击 **Run** 执行

### 2. 配置环境变量

在项目根目录的 `.env` 文件中添加：

```bash
# Supabase 配置
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. 更新前端代码

确保 `frontend/official-site/src/lib/config.ts` 中的配置正确：

```typescript
export const config = {
  // ...
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  // ...
};
```

### 4. 配置 GitHub Secrets

在 GitHub 仓库中添加以下 Secrets：

- `SUPABASE_URL`: 你的 Supabase 项目 URL
- `SUPABASE_ANON_KEY`: Supabase Anon Key

---

## 常用查询

### 查询最新日志

```sql
SELECT * FROM logs
ORDER BY timestamp DESC
LIMIT 50;
```

### 查询错误日志

```sql
SELECT * FROM logs
WHERE level = 'error'
ORDER BY timestamp DESC;
```

### 查询交易历史

```sql
SELECT * FROM transactions
ORDER BY created_at DESC;
```

### 查询特定地址的交易

```sql
SELECT * FROM transactions
WHERE from_address = '0x...' OR to_address = '0x...'
ORDER BY created_at DESC;
```

---

## 数据库维护

### 清理旧日志（保留 30 天）

```sql
DELETE FROM logs
WHERE created_at < NOW() - INTERVAL '30 days';
```

### 清理失败的交易（保留 7 天）

```sql
DELETE FROM transactions
WHERE status = 'failed' AND created_at < NOW() - INTERVAL '7 days';
```

---

## 安全建议

1. **RLS 策略**: 已启用 Row Level Security，确保数据访问安全
2. **API Key**: 前端使用 Anon Key，后端使用 Service Role Key
3. **敏感数据**: 不要在数据库中存储私钥等敏感信息
4. **备份**: 定期备份数据库（Supabase 自动备份）

---

## 测试验证

### 测试 Supabase 连接

在浏览器控制台执行：

```javascript
// 测试连接
const { data, error } = await supabase
  .from('logs')
  .select('*')
  .limit(1);

if (error) {
  console.error('连接失败:', error);
} else {
  console.log('连接成功:', data);
}
```

---

## 更新历史

| 日期 | 版本 | 更新内容 |
|------|------|----------|
| 2026-02-09 | v1.0.0 | 初始版本，创建 logs 和 transactions 表 |

---

**文档创建**: 2026-02-09
**适用版本**: v1.0.0
