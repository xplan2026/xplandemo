# Supabase 数据库全面审计报告

**审计日期**: 2026-02-11  
**审计范围**: Demo 数据库、前端数据库、Worker 数据库及相关配置文档  
**审计目标**: 安全性、性能、代码质量、最佳实践

---

## 一、严重安全问题

### 1.1 【高危】RLS 策略过度开放 - 所有数据可被任何用户读取

**影响范围**: 所有三个数据库 (Demo, Frontend, Worker)

**问题描述**:
```sql
-- Demo 数据库
CREATE POLICY "Allow public read on transactions" ON demo_schema.transactions FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read on wallets" ON demo_schema.wallets FOR SELECT TO public USING (true);
-- ... 更多类似策略

-- 前端数据库
CREATE POLICY "Allow public read access on logs" ON public.logs FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access on transactions" ON public.transactions FOR SELECT TO public USING (true);

-- Worker 数据库
CREATE POLICY "Allow public read on db_connections" ON system_schema.db_connections FOR SELECT TO public USING (true);
```

**风险分析**:
- 任何人都可以读取所有表的数据，无需任何认证
- Worker 数据库中的 `db_connections` 表包含敏感的数据库连接 URL
- Worker 数据库中的 `rpc_nodes` 表包含 RPC 节点信息
- 所有钱包地址、交易记录、系统配置都对外暴露
- 这可能是 Demo 环境的设计，但 Worker 数据库绝对不应该完全开放

**修复建议**:
```sql
-- Demo 数据库 - 保持公共读取（如果确实是 Demo 用途）
-- 但添加数据脱敏视图

-- 前端数据库 - 限制为只读且限制返回字段
CREATE POLICY "Allow public read access on logs"
  ON public.logs FOR SELECT
  TO public
  USING (true)
  WITH CHECK (
    -- 排除敏感字段（如果将来添加）
    message NOT LIKE '%secret%'
  );

-- Worker 数据库 - 完全移除公共读取权限
DROP POLICY "Allow public read on db_connections" ON system_schema.db_connections;
DROP POLICY "Allow public read on rpc_nodes" ON system_schema.rpc_nodes;
DROP POLICY "Allow public read on whitelist" ON auth_schema.whitelist;

-- 为 Worker 数据库创建特定的认证策略
CREATE POLICY "Allow service read on protected_wallets"
  ON system_schema.protected_wallets FOR SELECT
  TO authenticated
  USING (true);

-- 为前端创建聚合视图，而非原始数据
CREATE OR REPLACE VIEW public.transaction_summary AS
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    status,
    COUNT(*) as count,
    COUNT(DISTINCT from_address) as unique_senders
FROM public.transactions
GROUP BY DATE_TRUNC('hour', created_at), status;
```

---

### 1.2 【高危】Worker 数据库敏感信息暴露

**影响范围**: `supabase/worker/create-worker-database.sql`

**问题描述**:
- `system_schema.db_connections` 表存储数据库连接 URL
- `system_schema.rpc_nodes` 表存储 RPC 节点 URL
- 这些信息通过公共 RLS 策略可以被任何人读取

**风险分析**:
- 数据库连接字符串可能包含密码等敏感信息
- RPC 节点 URL 可能暴露基础架构信息
- 攻击者可以获取系统拓扑信息进行针对性攻击

**修复建议**:
```sql
-- 1. 移除 db_connections 表的公共访问
DROP POLICY IF EXISTS "Allow public read on db_connections" ON system_schema.db_connections;

-- 2. 考虑将敏感配置加密存储
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE system_schema.db_connections
ADD COLUMN connection_url_encrypted BYTEA;

-- 3. 只允许特定的 authenticated 角色（如 service worker）访问
CREATE POLICY "Allow service read on db_connections"
  ON system_schema.db_connections FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = added_by 
    OR EXISTS (
      SELECT 1 FROM auth_schema.whitelist 
      WHERE wallet_address = added_by
      AND status = 'active'
    )
  );
```

---

### 1.3 【高危】Auth Nonce 表缺少过期清理机制

**影响范围**: `supabase/worker/create-worker-database.sql` - `auth_schema.auth_nonce`

**问题描述**:
```sql
CREATE TABLE IF NOT EXISTS auth_schema.auth_nonce (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  nonce VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

虽然设置了 `expires_at` 字段，但没有自动清理机制，旧的 nonce 记录会不断累积。

**风险分析**:
- 大量过期的 nonce 记录占用存储空间
- 可能导致数据库性能下降
- 在免费额度下可能超出存储限制

**修复建议**:
```sql
-- 1. 创建自动清理函数
CREATE OR REPLACE FUNCTION auth_schema.cleanup_expired_nonce()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM auth_schema.auth_nonce
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 2. 启用 pg_cron 扩展
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 3. 配置定时清理（每小时清理一次）
SELECT cron.schedule(
  'cleanup-expired-nonce',
  '0 * * * *',
  $$SELECT auth_schema.cleanup_expired_nonce()$$
);

-- 4. 创建索引加速清理
CREATE INDEX IF NOT EXISTS idx_auth_nonce_expires 
ON auth_schema.auth_nonce(expires_at) 
WHERE expires_at < NOW();
```

---

## 二、中等安全问题

### 2.1 【中危】数据类型不一致导致精度丢失

**影响范围**: Demo 和 Worker 数据库的 `transactions` 表

**问题描述**:
```sql
-- Demo 数据库
amount DECIMAL(30,18) NOT NULL  -- 高精度

-- 前端数据库
amount TEXT NOT NULL  -- 文本类型！

-- Worker 数据库  
amount DECIMAL(30,18) NOT NULL  -- 高精度
```

前端数据库的 `amount` 使用 `TEXT` 类型，这可能导致：
- 精度丢失
- 无法进行数学运算
- 排序不正确
- 类型转换错误

**修复建议**:
```sql
-- 修改前端数据库的 amount 字段
ALTER TABLE public.transactions 
ALTER COLUMN amount TYPE DECIMAL(30,18) 
USING amount::DECIMAL(30,18);

-- 或者使用 NUMERIC 类型（PostgreSQL 中 NUMERIC 和 DECIMAL 是同义词）
ALTER TABLE public.transactions 
ALTER COLUMN amount TYPE NUMERIC(30,18);
```

---

### 2.2 【中危】钱包地址字段缺少格式验证

**影响范围**: 所有数据库中的钱包地址字段

**问题描述**:
```sql
wallet_address VARCHAR(42) UNIQUE NOT NULL,
from_address VARCHAR(42) NOT NULL,
to_address VARCHAR(42) NOT NULL,
```

虽然限制了长度为 42 字符，但没有验证格式（以太坊地址应为 0x 开头 + 40 位十六进制字符）。

**修复建议**:
```sql
-- 1. 创建地址格式验证函数
CREATE OR REPLACE FUNCTION is_valid_ethereum_address(address VARCHAR(42))
RETURNS BOOLEAN AS $$
BEGIN
  RETURN address ~ '^0x[a-fA-F0-9]{40}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. 添加 CHECK 约束（新表）
CREATE TABLE IF NOT EXISTS demo_schema.wallets_v2 (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  CHECK (is_valid_ethereum_address(wallet_address))
);

-- 3. 为现有表添加约束（需要先清理无效数据）
ALTER TABLE demo_schema.wallets
ADD CONSTRAINT chk_wallet_address_format 
CHECK (is_valid_ethereum_address(wallet_address));
```

---

### 2.3 【中危】Transaction Hash 缺少格式验证

**影响范围**: 所有数据库的 `tx_hash` 字段

**问题描述**:
```sql
tx_hash VARCHAR(66) UNIQUE,  -- 交易哈希
```

交易哈希应为 0x 开头 + 64 位十六进制字符，但没有格式验证。

**修复建议**:
```sql
-- 创建交易哈希验证函数
CREATE OR REPLACE FUNCTION is_valid_tx_hash(tx_hash VARCHAR(66))
RETURNS BOOLEAN AS $$
BEGIN
  RETURN tx_hash ~ '^0x[a-fA-F0-9]{64}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 添加约束
ALTER TABLE demo_schema.transactions
ADD CONSTRAINT chk_tx_hash_format 
CHECK (tx_hash IS NULL OR is_valid_tx_hash(tx_hash));
```

---

### 2.4 【中危】缺少数据审计字段

**影响范围**: 所有数据库的配置表

**问题描述**:
多个表缺少必要的审计字段，如：
- `system_schema.protected_wallets` 有 `added_by` 和 `updated_by`
- `system_schema.hacker_wallets` 也有这些字段
- 但 `auth_schema.whitelist` 只有 `created_by`，没有 `updated_by` 或操作历史

**修复建议**:
```sql
-- 1. 为 whitelist 表添加审计字段
ALTER TABLE auth_schema.whitelist
ADD COLUMN updated_by VARCHAR(42),
ADD COLUMN updated_at TIMESTAMP;

-- 2. 创建触发器自动更新时间
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_whitelist_timestamp
BEFORE UPDATE ON auth_schema.whitelist
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- 3. 考虑创建审计日志表
CREATE TABLE IF NOT EXISTS system_schema.audit_log (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(50) NOT NULL,
  record_id INTEGER NOT NULL,
  action VARCHAR(10) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  changed_by VARCHAR(42) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_at TIMESTAMP DEFAULT NOW()
);

-- 4. 创建审计触发器
CREATE OR REPLACE FUNCTION log_audit_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO system_schema.audit_log (table_name, record_id, action, changed_by, new_values)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', NEW.added_by, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO system_schema.audit_log (table_name, record_id, action, changed_by, old_values, new_values)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', NEW.updated_by, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO system_schema.audit_log (table_name, record_id, action, changed_by, old_values)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', OLD.deleted_by, to_jsonb(OLD));
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

---

### 2.5 【中危】索引设计不完整

**影响范围**: 所有数据库

**问题描述**:
- `system_schema.db_connections` 缺少索引
- 软删除表（有 `deleted_at` 字段的表）缺少部分索引
- 没有复合索引优化常见查询

**修复建议**:
```sql
-- 1. 为 db_connections 添加索引
CREATE INDEX IF NOT EXISTS idx_db_connections_name 
ON system_schema.db_connections(connection_name);
CREATE INDEX IF NOT EXISTS idx_db_connections_status 
ON system_schema.db_connections(status);

-- 2. 为软删除表创建部分索引
CREATE INDEX IF NOT EXISTS idx_whitelist_active 
ON auth_schema.whitelist(wallet_address) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_protected_wallets_active 
ON system_schema.protected_wallets(wallet_address) 
WHERE status = 'active' AND deleted_at IS NULL;

-- 3. 为常见查询添加复合索引
-- 假设经常查询：特定钱包的最近成功交易
CREATE INDEX IF NOT EXISTS idx_tx_from_status_created 
ON tx_schema.transactions(from_address, status, created_at DESC);

-- 查询：特定 worker 的最近交易
CREATE INDEX IF NOT EXISTS idx_tx_worker_created 
ON tx_schema.transactions(worker_id, created_at DESC);
```

---

## 三、低优先级问题

### 3.1 【低】时区处理不一致

**影响范围**: Demo 和 Worker 数据库使用 `TIMESTAMP`，前端数据库使用 `TIMESTAMPTZ`

**问题描述**:
```sql
-- Demo/Worker
created_at TIMESTAMP DEFAULT NOW()

-- Frontend  
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**修复建议**:
统一使用 `TIMESTAMPTZ` 以避免时区混淆问题。

---

### 3.2 【低】缺少外键约束

**影响范围**: 多个表之间的关联关系

**问题描述**:
虽然表之间有逻辑关联（如 `worker_status.worker_id` 应该存在），但没有使用外键约束。

**修复建议**:
```sql
-- 添加外键约束（需要先确保数据一致性）
ALTER TABLE demo_schema.worker_status
ADD CONSTRAINT fk_worker_id_unique
FOREIGN KEY (worker_id) REFERENCES demo_schema.worker_status(worker_id);
```

---

### 3.3 【低】表命名不一致

**问题描述**:
- 有些表使用复数：`transactions`, `wallets`, `logs`
- 有些表使用单数：`whitelist`, `auth_nonce`, `protected_wallets`

**修复建议**:
统一使用复数命名规范（数据库领域的最佳实践）。

---

### 3.4 【低】函数命名不规范

**问题描述**:
函数命名不一致，如 `get_protected_wallet()` vs `update_scan_stats()`。

---

### 3.5 【低】缺少 COMMENT 注释

**问题描述**:
虽然 SQL 文件有良好的注释，但表和字段没有数据库级别的 COMMENT。

**修复建议**:
```sql
COMMENT ON TABLE demo_schema.transactions IS '存储所有代币交易记录';
COMMENT ON COLUMN demo_schema.transactions.status IS '交易状态: pending, success, failed';
```

---

## 四、性能优化建议

### 4.1 【性能】前端数据库缺少分区

**问题描述**:
`logs` 和 `transactions` 表可能快速增长，但没有分区策略。

**修复建议**:
```sql
-- 按月分区 logs 表
CREATE TABLE public.logs_partitioned (
  LIKE public.logs INCLUDING ALL
) PARTITION BY RANGE (timestamp);

-- 创建分区
CREATE TABLE public.logs_2026_01 PARTITION OF public.logs_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE public.logs_2026_02 PARTITION OF public.logs_partitioned
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- 创建自动创建分区的函数
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS VOID AS $$
DECLARE
  partition_name TEXT;
  start_date TEXT;
  end_date TEXT;
BEGIN
  partition_name := 'logs_' || to_char(NOW() + INTERVAL '1 month', 'YYYY_MM');
  start_date := to_char(NOW() + INTERVAL '1 month', 'YYYY-MM-01');
  end_date := to_char(NOW() + INTERVAL '2 months', 'YYYY-MM-01');
  
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.logs_partitioned
    FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date, end_date
  );
END;
$$ LANGUAGE plpgsql;
```

---

### 4.2 【性能】缺少连接池配置建议

**问题描述**:
配置文档中没有提及连接池配置。

**修复建议**:
在文档中添加连接池配置说明。

---

### 4.3 【性能】没有查询缓存策略

**问题描述**:
Worker 统计视图每次都重新计算，可以考虑物化视图。

**修复建议**:
```sql
-- 创建物化视图
CREATE MATERIALIZED VIEW demo_schema.worker_stats_mv AS
SELECT 
  ws.worker_id,
  ws.emergency_mode,
  ws.last_scan_at,
  ws.last_transfer_at,
  ws.total_scans,
  ws.total_transfers,
  ws.total_success_transfers,
  ws.total_failed_transfers,
  CASE 
    WHEN ws.total_transfers = 0 THEN 0
    ELSE ROUND((ws.total_success_transfers::numeric / ws.total_transfers) * 100, 2)
  END as success_rate
FROM demo_schema.worker_status ws;

-- 创建唯一索引允许刷新
CREATE UNIQUE INDEX ON demo_schema.worker_stats_mv (worker_id);

-- 创建刷新函数
CREATE OR REPLACE FUNCTION demo_schema.refresh_worker_stats()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY demo_schema.worker_stats_mv;
END;
$$ LANGUAGE plpgsql;
```

---

## 五、代码质量评估

### 5.1 优点

1. **代码组织良好**: SQL 文件结构清晰，分节明确
2. **文档完善**: README 和配置指南详细
3. **版本管理**: 包含版本号和日期
4. **使用扩展**: 正确使用 uuid-ossp 扩展
5. **索引设计**: 为主要查询字段创建了索引

### 5.2 待改进

1. **命名一致性**: 表命名、函数命名需要统一
2. **约束完整性**: 缺少 CHECK 约束和格式验证
3. **错误处理**: 函数缺少错误处理逻辑
4. **测试数据**: Worker 数据库的测试数据使用了无效的零地址

---

## 六、安全最佳实践建议

### 6.1 应立即实施

1. **修改 RLS 策略**: 移除 Worker 数据库的公共读取权限
2. **加密敏感配置**: 加密 `db_connections` 和 `rpc_nodes` 表中的 URL
3. **添加格式验证**: 为钱包地址和交易哈希添加 CHECK 约束
4. **实施自动清理**: 配置过期 nonce 的自动清理

### 6.2 中期改进

1. **实施审计日志**: 为关键操作添加审计追踪
2. **添加速率限制**: 使用 Supabase Edge Functions 实现 API 限流
3. **数据脱敏**: 为前端创建脱敏视图
4. **备份策略**: 配置定期自动备份

### 6.3 长期优化

1. **监控告警**: 配置异常访问告警
2. **安全扫描**: 定期进行安全扫描
3. **渗透测试**: 聘请专业团队进行渗透测试
4. **合规审计**: 确保符合相关法规要求

---

## 七、风险评估矩阵

| 问题类别 | 严重程度 | 影响范围 | 修复优先级 |
|---------|---------|---------|-----------|
| RLS 过度开放 | 高 | 所有数据库 | P0 |
| 敏感信息暴露 | 高 | Worker 数据库 | P0 |
| Auth Nonce 未清理 | 高 | Worker 数据库 | P0 |
| 数据类型不一致 | 中 | 前端数据库 | P1 |
| 地址格式未验证 | 中 | 所有数据库 | P1 |
| 缺少审计字段 | 中 | 配置表 | P1 |
| 索引不完整 | 中 | 所有数据库 | P1 |
| 时区不一致 | 低 | Demo/Worker | P2 |
| 缺少外键约束 | 低 | 所有数据库 | P2 |
| 命名不一致 | 低 | 所有数据库 | P3 |

---

## 八、总结与建议

### 8.1 总体评估

| 评估项 | 得分 | 说明 |
|-------|------|------|
| 代码结构 | 8/10 | 组织良好，分节清晰 |
| 文档完整性 | 9/10 | README 和配置指南详细 |
| 安全性 | 4/10 | RLS 策略存在严重问题 |
| 性能 | 6/10 | 有索引但缺乏分区和缓存 |
| 可维护性 | 7/10 | 命名需要统一 |
| **综合评分** | **6.8/10** | **需要重点关注安全问题** |

### 8.2 关键建议

1. **立即修复**: RLS 策略问题和敏感信息暴露
2. **短期改进**: 添加数据验证、自动清理、审计日志
3. **长期规划**: 分区策略、监控告警、合规审计

### 8.3 优先修复清单

1. [ ] 修改 Worker 数据库 RLS 策略
2. [ ] 加密敏感配置信息
3. [ ] 添加 Auth Nonce 自动清理
4. [ ] 修复前端数据库 amount 数据类型
5. [ ] 添加钱包地址和交易哈希格式验证
6. [ ] 实施审计日志系统

---

**审计完成时间**: 2026-02-11  
**下次审计建议**: 2026-03-11（修复后复查）
