-- ========================================
-- X-plan Worker 数据库创建脚本
-- 版本: v1.0.0
-- 日期: 2026-02-09
-- 数据库: PostgreSQL (Supabase)
-- 用途: Cloudflare Worker 数据存储
-- ========================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- 1. 创建 auth_schema
-- ========================================

CREATE SCHEMA IF NOT EXISTS auth_schema;

-- whitelist 表
CREATE TABLE IF NOT EXISTS auth_schema.whitelist (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_by VARCHAR(42),
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_by VARCHAR(42),
  deleted_at TIMESTAMP
);

-- auth_nonce 表
CREATE TABLE IF NOT EXISTS auth_schema.auth_nonce (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  nonce VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 2. 创建 tx_schema
-- ========================================

CREATE SCHEMA IF NOT EXISTS tx_schema;

-- transactions 表
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
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 3. 创建 system_schema
-- ========================================

CREATE SCHEMA IF NOT EXISTS system_schema;

-- protected_wallets 表
CREATE TABLE IF NOT EXISTS system_schema.protected_wallets (
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

-- hacker_wallets 表
CREATE TABLE IF NOT EXISTS system_schema.hacker_wallets (
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

-- contracts 表
CREATE TABLE IF NOT EXISTS system_schema.contracts (
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

-- rpc_nodes 表
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

-- db_connections 表
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

-- ========================================
-- 4. 创建索引
-- ========================================

-- auth_schema 索引
CREATE INDEX IF NOT EXISTS idx_whitelist_address ON auth_schema.whitelist(wallet_address);
CREATE INDEX IF NOT EXISTS idx_whitelist_status ON auth_schema.whitelist(status);
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
CREATE INDEX IF NOT EXISTS idx_protected_wallets_address ON system_schema.protected_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_hacker_wallets_address ON system_schema.hacker_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_contracts_address ON system_schema.contracts(contract_address);
CREATE INDEX IF NOT EXISTS idx_rpc_nodes_status ON system_schema.rpc_nodes(status);

-- ========================================
-- 5. 插入测试数据
-- ========================================

-- 插入测试钱包
INSERT INTO system_schema.protected_wallets (wallet_address, name, added_by) VALUES
  ('0x0000000000000000000000000000000000000000', '测试钱包1', '0xadmin'),
  ('0x0000000000000000000000000000000000000001', '测试钱包2', '0xadmin')
ON CONFLICT (wallet_address) DO NOTHING;

-- 插入测试合约
INSERT INTO system_schema.contracts (contract_address, symbol, decimals, added_by) VALUES
  ('0x35774A4E1fFEee74Fa3859F89cfae00b3aC8C3A8', 'XPD', 9, '0xadmin')
ON CONFLICT (contract_address) DO NOTHING;

-- ========================================
-- 6. Row Level Security (RLS) 策略
-- ========================================

-- 启用 RLS
ALTER TABLE auth_schema.whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_schema.auth_nonce ENABLE ROW LEVEL SECURITY;
ALTER TABLE tx_schema.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_schema.protected_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_schema.hacker_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_schema.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_schema.rpc_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_schema.db_connections ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取（公共访问）
CREATE POLICY "Allow public read on whitelist" ON auth_schema.whitelist FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read on auth_nonce" ON auth_schema.auth_nonce FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read on transactions" ON tx_schema.transactions FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read on protected_wallets" ON system_schema.protected_wallets FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read on hacker_wallets" ON system_schema.hacker_wallets FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read on contracts" ON system_schema.contracts FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read on rpc_nodes" ON system_schema.rpc_nodes FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read on db_connections" ON system_schema.db_connections FOR SELECT TO public USING (true);

-- 允许服务密钥写入
CREATE POLICY "Allow service insert on whitelist" ON auth_schema.whitelist FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service update on whitelist" ON auth_schema.whitelist FOR UPDATE TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service insert on auth_nonce" ON auth_schema.auth_nonce FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service insert on transactions" ON tx_schema.transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service update on transactions" ON tx_schema.transactions FOR UPDATE TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service insert on protected_wallets" ON system_schema.protected_wallets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service update on protected_wallets" ON system_schema.protected_wallets FOR UPDATE TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service insert on hacker_wallets" ON system_schema.hacker_wallets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service update on hacker_wallets" ON system_schema.hacker_wallets FOR UPDATE TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service insert on contracts" ON system_schema.contracts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service update on contracts" ON system_schema.contracts FOR UPDATE TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service insert on rpc_nodes" ON system_schema.rpc_nodes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service update on rpc_nodes" ON system_schema.rpc_nodes FOR UPDATE TO authenticated WITH CHECK (true);

-- ========================================
-- 7. 验证表创建
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
