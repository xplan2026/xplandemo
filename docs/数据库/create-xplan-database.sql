-- ========================================
-- X-plan 官网数据库创建脚本
-- 版本: v1.0.0
-- 日期: 2026-02-09
-- 数据库: PostgreSQL (Supabase)
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
CREATE POLICY "Allow service insert on logs"
  ON logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow service insert on transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ========================================
-- 5. 验证表创建
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

-- 查看插入的测试数据
SELECT * FROM logs ORDER BY created_at DESC LIMIT 5;
SELECT * FROM transactions ORDER BY created_at DESC LIMIT 5;

-- ========================================
-- 完成
-- ========================================
