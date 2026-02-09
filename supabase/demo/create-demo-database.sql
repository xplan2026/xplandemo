-- ========================================
-- X-plan Demo 数据库创建脚本（简化版）
-- 版本: v1.0.0
-- 日期: 2026-02-09
-- 数据库: PostgreSQL (Supabase)
-- 用途: Demo 专用数据库
-- ========================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- 1. 创建 demo_schema
-- ========================================

CREATE SCHEMA IF NOT EXISTS demo_schema;

-- ========================================
-- 2. 创建表
-- ========================================

-- 交易记录表
CREATE TABLE IF NOT EXISTS demo_schema.transactions (
  id SERIAL PRIMARY KEY,
  tx_hash VARCHAR(66) UNIQUE,
  from_address VARCHAR(42) NOT NULL,
  to_address VARCHAR(42) NOT NULL,
  token_symbol VARCHAR(20) NOT NULL,
  amount DECIMAL(30,18) NOT NULL,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  triggered_by VARCHAR(42),
  trigger_reason VARCHAR(100),
  worker_id VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 钱包配置表（Demo 3个固定钱包）
CREATE TABLE IF NOT EXISTS demo_schema.wallets (
  id SERIAL PRIMARY KEY,
  wallet_type VARCHAR(20) NOT NULL, -- 'protected', 'safe', 'gas'
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  wallet_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 合约配置表（Demo 仅1个合约）
CREATE TABLE IF NOT EXISTS demo_schema.contracts (
  id SERIAL PRIMARY KEY,
  contract_address VARCHAR(42) UNIQUE NOT NULL,
  token_name VARCHAR(100) NOT NULL,
  token_symbol VARCHAR(20) NOT NULL,
  decimals INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Worker 状态表
CREATE TABLE IF NOT EXISTS demo_schema.worker_status (
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

-- 系统日志表
CREATE TABLE IF NOT EXISTS demo_schema.system_logs (
  id SERIAL PRIMARY KEY,
  log_type VARCHAR(50) NOT NULL, -- 'scan', 'transfer', 'error', 'info'
  wallet_address VARCHAR(42),
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 3. 创建索引
-- ========================================

-- transactions 索引
CREATE INDEX IF NOT EXISTS idx_tx_hash ON demo_schema.transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_tx_from ON demo_schema.transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_tx_to ON demo_schema.transactions(to_address);
CREATE INDEX IF NOT EXISTS idx_tx_status ON demo_schema.transactions(status);
CREATE INDEX IF NOT EXISTS idx_tx_created ON demo_schema.transactions(created_at DESC);

-- wallets 索引
CREATE INDEX IF NOT EXISTS idx_wallets_type ON demo_schema.wallets(wallet_type);
CREATE INDEX IF NOT EXISTS idx_wallets_address ON demo_schema.wallets(wallet_address);

-- contracts 索引
CREATE INDEX IF NOT EXISTS idx_contracts_address ON demo_schema.contracts(contract_address);

-- worker_status 索引
CREATE INDEX IF NOT EXISTS idx_worker_id ON demo_schema.worker_status(worker_id);

-- system_logs 索引
CREATE INDEX IF NOT EXISTS idx_logs_type ON demo_schema.system_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_logs_created ON demo_schema.system_logs(created_at DESC);

-- ========================================
-- 4. 插入初始数据
-- ========================================

-- 插入钱包配置（Demo 3个钱包）
INSERT INTO demo_schema.wallets (wallet_type, wallet_address, wallet_name, status) VALUES
  ('protected', '0x32af405726ba6bd2f9b7ecdfed3bdd9b590c0939', '被保护地址 A', 'active'),
  ('safe', '0x2a71e200d13558631831c3e78e88afde8464f761', '安全地址 B', 'active'),
  ('gas', '0x633be54ef2c776bedd8555afc1375847e4b5d8f3', 'Gas 地址 C', 'active')
ON CONFLICT (wallet_address) DO NOTHING;

-- 插入合约配置（XPD 代币）
INSERT INTO demo_schema.contracts (contract_address, token_name, token_symbol, decimals, status) VALUES
  ('0x35774A4E1fFEee74Fa3859F89cfae00b3aC8C3A8', 'X-plan Demo Token', 'XPD', 9, 'active')
ON CONFLICT (contract_address) DO NOTHING;

-- 初始化 Worker 状态
INSERT INTO demo_schema.worker_status (worker_id, emergency_mode) VALUES
  ('tactics-1', false)
ON CONFLICT (worker_id) DO NOTHING;

-- ========================================
-- 5. Row Level Security (RLS) 策略
-- ========================================

-- 启用 RLS
ALTER TABLE demo_schema.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_schema.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_schema.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_schema.worker_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_schema.system_logs ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取（公共访问）
CREATE POLICY "Allow public read on transactions" ON demo_schema.transactions FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read on wallets" ON demo_schema.wallets FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read on contracts" ON demo_schema.contracts FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read on worker_status" ON demo_schema.worker_status FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read on system_logs" ON demo_schema.system_logs FOR SELECT TO public USING (true);

-- 允许 service key 写入
CREATE POLICY "Allow service insert on transactions" ON demo_schema.transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service update on transactions" ON demo_schema.transactions FOR UPDATE TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service insert on wallets" ON demo_schema.wallets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service update on wallets" ON demo_schema.wallets FOR UPDATE TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service insert on contracts" ON demo_schema.contracts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service update on contracts" ON demo_schema.contracts FOR UPDATE TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service insert on worker_status" ON demo_schema.worker_status FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service update on worker_status" ON demo_schema.worker_status FOR UPDATE TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service insert on system_logs" ON demo_schema.system_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ========================================
-- 6. 创建视图（方便查询）
-- ========================================

-- Worker 统计视图
CREATE OR REPLACE VIEW demo_schema.worker_stats AS
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

-- 最近交易视图
CREATE OR REPLACE VIEW demo_schema.recent_transactions AS
SELECT 
  t.*,
  w1.wallet_name as from_wallet_name,
  w2.wallet_name as to_wallet_name
FROM demo_schema.transactions t
LEFT JOIN demo_schema.wallets w1 ON t.from_address = w1.wallet_address
LEFT JOIN demo_schema.wallets w2 ON t.to_address = w2.wallet_address
ORDER BY t.created_at DESC
LIMIT 100;

-- ========================================
-- 7. 常用查询函数
-- ========================================

-- 获取被保护钱包地址
CREATE OR REPLACE FUNCTION demo_schema.get_protected_wallet()
RETURNS VARCHAR(42) AS $$
  SELECT wallet_address FROM demo_schema.wallets 
  WHERE wallet_type = 'protected' AND status = 'active' 
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- 获取安全钱包地址
CREATE OR REPLACE FUNCTION demo_schema.get_safe_wallet()
RETURNS VARCHAR(42) AS $$
  SELECT wallet_address FROM demo_schema.wallets 
  WHERE wallet_type = 'safe' AND status = 'active' 
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- 获取 Gas 钱包地址
CREATE OR REPLACE FUNCTION demo_schema.get_gas_wallet()
RETURNS VARCHAR(42) AS $$
  SELECT wallet_address FROM demo_schema.wallets 
  WHERE wallet_type = 'gas' AND status = 'active' 
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- 获取合约配置
CREATE OR REPLACE FUNCTION demo_schema.get_contract()
RETURNS TABLE (
  contract_address VARCHAR(42),
  token_name VARCHAR(100),
  token_symbol VARCHAR(20),
  decimals INTEGER
) AS $$
  SELECT contract_address, token_name, token_symbol, decimals 
  FROM demo_schema.contracts 
  WHERE status = 'active' 
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- 更新 Worker 扫描统计
CREATE OR REPLACE FUNCTION demo_schema.update_scan_stats(worker_id_param VARCHAR(20))
RETURNS VOID AS $$
BEGIN
  UPDATE demo_schema.worker_status 
  SET last_scan_at = NOW(),
      total_scans = total_scans + 1,
      updated_at = NOW()
  WHERE worker_id = worker_id_param;
END;
$$ LANGUAGE plpgsql;

-- 更新 Worker 转账统计
CREATE OR REPLACE FUNCTION demo_schema.update_transfer_stats(
  worker_id_param VARCHAR(20),
  tx_status VARCHAR(20)
)
RETURNS VOID AS $$
BEGIN
  UPDATE demo_schema.worker_status 
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
-- 8. 清理旧数据（防止超出免费额度）
-- ========================================

-- 清理超过 30 天的交易记录
CREATE OR REPLACE FUNCTION demo_schema.cleanup_old_transactions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM demo_schema.transactions
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 清理超过 7 天的系统日志
CREATE OR REPLACE FUNCTION demo_schema.cleanup_old_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM demo_schema.system_logs
  WHERE created_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 9. 验证表创建
-- ========================================

SELECT
  schemaname,
  tablename
FROM pg_tables
WHERE schemaname = 'demo_schema'
ORDER BY tablename;

-- ========================================
-- 完成
-- ========================================
