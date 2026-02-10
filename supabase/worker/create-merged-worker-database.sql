-- ========================================
-- X-plan Worker 数据库创建脚本（合并版）
-- 版本: v2.0.0
-- 日期: 2026-02-11
-- 数据库: PostgreSQL (Supabase)
-- 用途: Cloudflare Worker 数据存储（合并 demo + worker）
-- 说明: 移除白名单和黑客钱包，保留鉴权 nonce
-- ========================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- 1. 创建 auth_schema
-- ========================================

CREATE SCHEMA IF NOT EXISTS auth_schema;

-- auth_nonce 表（鉴权 nonce，基于官网钱包连接状态）
CREATE TABLE IF NOT EXISTS auth_schema.auth_nonce (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  nonce VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_auth_nonce_wallet_format CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$')
);

-- ========================================
-- 2. 创建 tx_schema
-- ========================================

CREATE SCHEMA IF NOT EXISTS tx_schema;

-- 交易记录表
CREATE TABLE IF NOT EXISTS tx_schema.transactions (
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
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_tx_from_address_format CHECK (from_address ~ '^0x[a-fA-F0-9]{40}$'),
  CONSTRAINT chk_tx_to_address_format CHECK (to_address ~ '^0x[a-fA-F0-9]{40}$'),
  CONSTRAINT chk_tx_hash_format CHECK (tx_hash IS NULL OR tx_hash ~ '^0x[a-fA-F0-9]{64}$')
);

-- ========================================
-- 3. 创建 system_schema
-- ========================================

CREATE SCHEMA IF NOT EXISTS system_schema;

-- 钱包配置表（合并 demo 的 wallets，支持多类型）
CREATE TABLE IF NOT EXISTS system_schema.wallets (
  id SERIAL PRIMARY KEY,
  wallet_type VARCHAR(20) NOT NULL, -- 'protected', 'safe', 'gas'
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  wallet_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  added_by VARCHAR(42),
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_by VARCHAR(42),
  deleted_at TIMESTAMP,
  updated_by VARCHAR(42),
  updated_at TIMESTAMP,
  CONSTRAINT chk_wallet_address_format CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$')
);

-- 合约配置表（合并 worker 和 demo，保留 token_name）
CREATE TABLE IF NOT EXISTS system_schema.contracts (
  id SERIAL PRIMARY KEY,
  contract_address VARCHAR(42) UNIQUE NOT NULL,
  token_name VARCHAR(100) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  decimals INTEGER,
  status VARCHAR(20) DEFAULT 'active',
  added_by VARCHAR(42),
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_by VARCHAR(42),
  deleted_at TIMESTAMP,
  updated_by VARCHAR(42),
  updated_at TIMESTAMP,
  CONSTRAINT chk_contract_address_format CHECK (contract_address ~ '^0x[a-fA-F0-9]{40}$')
);

-- RPC 节点表
CREATE TABLE IF NOT EXISTS system_schema.rpc_nodes (
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

-- 数据库连接表
CREATE TABLE IF NOT EXISTS system_schema.db_connections (
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

-- Worker 状态表（来自 demo）
CREATE TABLE IF NOT EXISTS system_schema.worker_status (
  id SERIAL PRIMARY KEY,
  worker_id VARCHAR(20) UNIQUE NOT NULL,
  emergency_mode BOOLEAN DEFAULT false,
  last_scan_at TIMESTAMP,
  last_transfer_at TIMESTAMP,
  total_scans INTEGER DEFAULT 0,
  total_transfers INTEGER DEFAULT 0,
  total_success_transfers INTEGER DEFAULT 0,
  total_failed_transfers INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 系统日志表（来自 demo）
CREATE TABLE IF NOT EXISTS system_schema.system_logs (
  id SERIAL PRIMARY KEY,
  log_type VARCHAR(50) NOT NULL, -- 'scan', 'transfer', 'error', 'info'
  wallet_address VARCHAR(42),
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_log_wallet_address_format CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$' OR wallet_address IS NULL)
);

-- 审计日志表
CREATE TABLE IF NOT EXISTS system_schema.audit_log (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(50) NOT NULL,
  record_id INTEGER NOT NULL,
  action VARCHAR(10) NOT NULL,
  changed_by VARCHAR(42) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 4. 创建索引
-- ========================================

-- auth_schema 索引
CREATE INDEX IF NOT EXISTS idx_auth_nonce_address ON auth_schema.auth_nonce(wallet_address);
CREATE INDEX IF NOT EXISTS idx_auth_nonce_expires ON auth_schema.auth_nonce(expires_at);

-- tx_schema 索引
CREATE INDEX IF NOT EXISTS idx_tx_worker_id ON tx_schema.transactions(worker_id);
CREATE INDEX IF NOT EXISTS idx_tx_hash ON tx_schema.transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_tx_from ON tx_schema.transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_tx_to ON tx_schema.transactions(to_address);
CREATE INDEX IF NOT EXISTS idx_tx_status ON tx_schema.transactions(status);
CREATE INDEX IF NOT EXISTS idx_tx_created ON tx_schema.transactions(created_at DESC);

-- system_schema 索引
CREATE INDEX IF NOT EXISTS idx_wallets_type ON system_schema.wallets(wallet_type);
CREATE INDEX IF NOT EXISTS idx_wallets_address ON system_schema.wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_contracts_address ON system_schema.contracts(contract_address);
CREATE INDEX IF NOT EXISTS idx_rpc_nodes_status ON system_schema.rpc_nodes(status);
CREATE INDEX IF NOT EXISTS idx_db_connections_name ON system_schema.db_connections(connection_name);
CREATE INDEX IF NOT EXISTS idx_db_connections_status ON system_schema.db_connections(status);
CREATE INDEX IF NOT EXISTS idx_worker_status_id ON system_schema.worker_status(worker_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_type ON system_schema.system_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_schema.system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON system_schema.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON system_schema.audit_log(changed_at DESC);

-- 软删除表的部分索引
CREATE INDEX IF NOT EXISTS idx_wallets_active ON system_schema.wallets(wallet_address) WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_active ON system_schema.contracts(contract_address) WHERE status = 'active' AND deleted_at IS NULL;

-- 复合索引
CREATE INDEX IF NOT EXISTS idx_tx_from_status_created ON tx_schema.transactions(from_address, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_worker_created ON tx_schema.transactions(worker_id, created_at DESC);

-- 索引加速 nonce 清理
CREATE INDEX IF NOT EXISTS idx_auth_nonce_expires_cleanup
ON auth_schema.auth_nonce(expires_at)
WHERE expires_at < NOW();

-- ========================================
-- 5. 插入初始数据
-- ========================================

-- 插入钱包配置（合并 demo 的 3 个钱包）
INSERT INTO system_schema.wallets (wallet_type, wallet_address, wallet_name, added_by) VALUES
  ('protected', '0x32af405726ba6bd2f9b7ecdfed3bdd9b590c0939', '被保护地址 A', '0xadmin'),
  ('safe', '0x2a71e200d13558631831c3e78e88afde8464f761', '安全地址 B', '0xadmin'),
  ('gas', '0x633be54ef2c776bedd8555afc1375847e4b5d8f3', 'Gas 地址 C', '0xadmin')
ON CONFLICT (wallet_address) DO NOTHING;

-- 插入合约配置（XPD 代币）
INSERT INTO system_schema.contracts (contract_address, token_name, symbol, decimals, added_by) VALUES
  ('0x35774A4E1fFEee74Fa3859F89cfae00b3aC8C3A8', 'X-plan Demo Token', 'XPD', 9, '0xadmin')
ON CONFLICT (contract_address) DO NOTHING;

-- 初始化 Worker 状态
INSERT INTO system_schema.worker_status (worker_id, emergency_mode) VALUES
  ('tactics-1', false)
ON CONFLICT (worker_id) DO NOTHING;

-- ========================================
-- 6. 辅助函数
-- ========================================

-- 更新时间戳触发器函数
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为带 updated_at 的表添加触发器
CREATE TRIGGER trigger_update_wallets_timestamp
BEFORE UPDATE ON system_schema.wallets
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trigger_update_contracts_timestamp
BEFORE UPDATE ON system_schema.contracts
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trigger_update_worker_status_timestamp
BEFORE UPDATE ON system_schema.worker_status
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- 获取被保护钱包地址
CREATE OR REPLACE FUNCTION system_schema.get_protected_wallet()
RETURNS VARCHAR(42) AS $$
  SELECT wallet_address FROM system_schema.wallets 
  WHERE wallet_type = 'protected' AND status = 'active' AND deleted_at IS NULL
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- 获取安全钱包地址
CREATE OR REPLACE FUNCTION system_schema.get_safe_wallet()
RETURNS VARCHAR(42) AS $$
  SELECT wallet_address FROM system_schema.wallets 
  WHERE wallet_type = 'safe' AND status = 'active' AND deleted_at IS NULL
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- 获取 Gas 钱包地址
CREATE OR REPLACE FUNCTION system_schema.get_gas_wallet()
RETURNS VARCHAR(42) AS $$
  SELECT wallet_address FROM system_schema.wallets 
  WHERE wallet_type = 'gas' AND status = 'active' AND deleted_at IS NULL
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- 获取合约配置
CREATE OR REPLACE FUNCTION system_schema.get_contract()
RETURNS TABLE (
  contract_address VARCHAR(42),
  token_name VARCHAR(100),
  symbol VARCHAR(20),
  decimals INTEGER
) AS $$
  SELECT contract_address, token_name, symbol, decimals 
  FROM system_schema.contracts 
  WHERE status = 'active' AND deleted_at IS NULL
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- 更新 Worker 扫描统计
CREATE OR REPLACE FUNCTION system_schema.update_scan_stats(worker_id_param VARCHAR(20))
RETURNS VOID AS $$
BEGIN
  UPDATE system_schema.worker_status 
  SET last_scan_at = NOW(),
      total_scans = total_scans + 1,
      updated_at = NOW()
  WHERE worker_id = worker_id_param;
END;
$$ LANGUAGE plpgsql;

-- 更新 Worker 转账统计
CREATE OR REPLACE FUNCTION system_schema.update_transfer_stats(
  worker_id_param VARCHAR(20),
  tx_status VARCHAR(20)
)
RETURNS VOID AS $$
BEGIN
  UPDATE system_schema.worker_status 
  SET last_transfer_at = NOW(),
      total_transfers = total_transfers + 1,
      total_success_transfers = CASE WHEN tx_status = 'success' 
        THEN total_success_transfers + 1 
        ELSE total_success_transfers 
      END,
      total_failed_transfers = CASE WHEN tx_status != 'success' 
        THEN total_failed_transfers + 1 
        ELSE total_failed_transfers 
      END,
      updated_at = NOW()
  WHERE worker_id = worker_id_param;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 7. Auth Nonce 自动清理机制
-- ========================================

-- 创建自动清理函数
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

-- 启用 pg_cron 扩展
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 配置定时清理（每小时清理一次）
SELECT cron.schedule(
  'cleanup-expired-nonce',
  '0 * * * *',
  $$SELECT auth_schema.cleanup_expired_nonce()$$
);

-- ========================================
-- 8. 清理旧数据函数
-- ========================================

-- 清理超过 30 天的交易记录
CREATE OR REPLACE FUNCTION tx_schema.cleanup_old_transactions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM tx_schema.transactions
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 清理超过 7 天的系统日志
CREATE OR REPLACE FUNCTION system_schema.cleanup_old_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM system_schema.system_logs
  WHERE created_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 9. 创建视图
-- ========================================

-- Worker 统计视图
CREATE OR REPLACE VIEW system_schema.worker_stats AS
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
FROM system_schema.worker_status ws;

-- 最近交易视图
CREATE OR REPLACE VIEW tx_schema.recent_transactions AS
SELECT 
  t.*,
  w1.wallet_name as from_wallet_name,
  w2.wallet_name as to_wallet_name
FROM tx_schema.transactions t
LEFT JOIN system_schema.wallets w1 ON t.from_address = w1.wallet_address
LEFT JOIN system_schema.wallets w2 ON t.to_address = w2.wallet_address
ORDER BY t.created_at DESC
LIMIT 100;

-- ========================================
-- 10. Row Level Security (RLS) 策略
-- ========================================

-- 启用 RLS
ALTER TABLE auth_schema.auth_nonce ENABLE ROW LEVEL SECURITY;
ALTER TABLE tx_schema.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_schema.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_schema.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_schema.rpc_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_schema.db_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_schema.worker_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_schema.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_schema.audit_log ENABLE ROW LEVEL SECURITY;

-- 为 Worker 数据库创建特定的认证策略（移除公共访问）
-- 只有 authenticated 用户可以读取
CREATE POLICY "Allow service read on auth_nonce"
  ON auth_schema.auth_nonce FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow service read on transactions"
  ON tx_schema.transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow service read on wallets"
  ON system_schema.wallets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow service read on contracts"
  ON system_schema.contracts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow service read on rpc_nodes"
  ON system_schema.rpc_nodes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow service read on db_connections"
  ON system_schema.db_connections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow service read on worker_status"
  ON system_schema.worker_status FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow service read on system_logs"
  ON system_schema.system_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow service read on audit_log"
  ON system_schema.audit_log FOR SELECT
  TO authenticated
  USING (true);

-- 允许服务密钥写入
CREATE POLICY "Allow service insert on auth_nonce" ON auth_schema.auth_nonce FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow service insert on transactions" ON tx_schema.transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service update on transactions" ON tx_schema.transactions FOR UPDATE TO authenticated WITH CHECK (true);

CREATE POLICY "Allow service insert on wallets" ON system_schema.wallets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service update on wallets" ON system_schema.wallets FOR UPDATE TO authenticated WITH CHECK (true);

CREATE POLICY "Allow service insert on contracts" ON system_schema.contracts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service update on contracts" ON system_schema.contracts FOR UPDATE TO authenticated WITH CHECK (true);

CREATE POLICY "Allow service insert on rpc_nodes" ON system_schema.rpc_nodes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service update on rpc_nodes" ON system_schema.rpc_nodes FOR UPDATE TO authenticated WITH CHECK (true);

CREATE POLICY "Allow service insert on db_connections" ON system_schema.db_connections FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service update on db_connections" ON system_schema.db_connections FOR UPDATE TO authenticated WITH CHECK (true);

CREATE POLICY "Allow service insert on worker_status" ON system_schema.worker_status FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service update on worker_status" ON system_schema.worker_status FOR UPDATE TO authenticated WITH CHECK (true);

CREATE POLICY "Allow service insert on system_logs" ON system_schema.system_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow service insert on audit_log" ON system_schema.audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- ========================================
-- 11. 验证表创建
-- ========================================

SELECT
  schemaname,
  tablename
FROM pg_tables
WHERE schemaname IN ('auth_schema', 'tx_schema', 'system_schema')
ORDER BY schemaname, tablename;

-- ========================================
-- 完成
-- ========================================
