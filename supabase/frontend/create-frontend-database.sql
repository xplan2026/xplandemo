-- ========================================
-- X-plan 前端数据库创建脚本
-- 版本: v1.1.0
-- 日期: 2026-02-11
-- 数据库: PostgreSQL (Supabase)
-- 用途: 前端数据存储
-- 基于 Supabase 数据库审计报告修复
-- ========================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- 1. 创建 users 表（用户统计）
-- ========================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT NOT NULL UNIQUE,
  is_test_user BOOLEAN DEFAULT FALSE,
  first_login_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_user_wallet_address_format CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$')
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_public_users_wallet_address ON public.users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_public_users_is_test ON public.users(is_test_user);
CREATE INDEX IF NOT EXISTS idx_public_users_last_login ON public.users(last_login_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_users_login_count ON public.users(login_count DESC);

-- ========================================
-- 2. 创建 logs 表
-- ========================================

CREATE TABLE IF NOT EXISTS public.logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  category TEXT NOT NULL CHECK (category IN ('monitor', 'transfer', 'error')),
  message TEXT NOT NULL,
  tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_public_logs_timestamp ON public.logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_public_logs_level ON public.logs(level);
CREATE INDEX IF NOT EXISTS idx_public_logs_category ON public.logs(category);
CREATE INDEX IF NOT EXISTS idx_public_logs_tx_hash ON public.logs(tx_hash);

-- ========================================
-- 2. 创建 transactions 表
-- ========================================

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount DECIMAL(30,18) NOT NULL,
  token_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_tx_from_address_format CHECK (from_address ~ '^0x[a-fA-F0-9]{40}$'),
  CONSTRAINT chk_tx_to_address_format CHECK (to_address ~ '^0x[a-fA-F0-9]{40}$'),
  CONSTRAINT chk_tx_hash_format CHECK (tx_hash ~ '^0x[a-fA-F0-9]{64}$')
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_public_transactions_from ON public.transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_public_transactions_to ON public.transactions(to_address);
CREATE INDEX IF NOT EXISTS idx_public_transactions_hash_unique ON public.transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_public_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_public_transactions_created ON public.transactions(created_at DESC);

-- 复合索引优化
CREATE INDEX IF NOT EXISTS idx_public_transactions_from_status ON public.transactions(from_address, status);
CREATE INDEX IF NOT EXISTS idx_public_transactions_to_status ON public.transactions(to_address, status);
CREATE INDEX IF NOT EXISTS idx_public_logs_level_timestamp ON public.logs(level, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_public_logs_category_timestamp ON public.logs(category, timestamp DESC);

-- ========================================
-- 4. 插入测试数据（可选）

-- 插入测试用户（测试用户）
INSERT INTO public.users (wallet_address, is_test_user, first_login_at, last_login_at, login_count) VALUES
  ('0x32af405726ba6bd2f9b7ecdfed3bdd9b590c0939', TRUE, NOW() - INTERVAL '7 days', NOW(), 25),
  ('0x2a71e200d13558631831c3e78e88afde8464f761', TRUE, NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 hour', 18),
  ('0x0000000000000000000000000000000000000001', TRUE, NOW() - INTERVAL '3 days', NOW() - INTERVAL '30 minutes', 12),
  ('0x0000000000000000000000000000000000000002', TRUE, NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 hours', 8)
ON CONFLICT (wallet_address) DO NOTHING;

-- 插入模拟的真实用户
INSERT INTO public.users (wallet_address, is_test_user, first_login_at, last_login_at, login_count) VALUES
  ('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', FALSE, NOW() - INTERVAL '30 days', NOW(), 150),
  ('0x71C7656EC7ab88b098defB751B7401B5f6d8976F', FALSE, NOW() - INTERVAL '25 days', NOW() - INTERVAL '3 hours', 120),
  ('0x3d5b4C5A8F3B9a2d7E9c4F1B6A0E8d7C5b9a3f2', FALSE, NOW() - INTERVAL '20 days', NOW() - INTERVAL '6 hours', 95),
  ('0x4a8e2B1c3D4f5E6a7B8c9D0e1F2a3B4c5D6e7F8a', FALSE, NOW() - INTERVAL '15 days', NOW() - INTERVAL '12 hours', 78),
  ('0x5b9f3C2d4E5f6A7b8C9d0E1f2a3B4c5D6e7F8a9b', FALSE, NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 day', 62)
ON CONFLICT (wallet_address) DO NOTHING;

-- 插入测试日志
-- ========================================

-- 插入测试日志
INSERT INTO public.logs (timestamp, level, category, message) VALUES
  (NOW(), 'info', 'monitor', '系统启动'),
  (NOW() - INTERVAL '1 minute', 'info', 'monitor', '开始扫描钱包')
ON CONFLICT DO NOTHING;

-- 插入测试交易（使用有效地址）
INSERT INTO public.transactions (
  from_address,
  to_address,
  amount,
  token_address,
  tx_hash,
  status
) VALUES (
  '0x32af405726ba6bd2f9b7ecdfed3bdd9b590c0939',
  '0x2a71e200d13558631831c3e78e88afde8464f761',
  1000000000::DECIMAL(30,18),
  '0x35774A4E1fFEee74Fa3859F89cfae00b3aC8C3A8',
  '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  'success'
) ON CONFLICT (tx_hash) DO NOTHING;

-- ========================================
-- 5. Row Level Security (RLS) 策略

-- 启用 RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取（公共访问）
CREATE POLICY "Allow public read access on users"
  ON public.users FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public read access on logs"
  ON public.logs FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public read access on transactions"
  ON public.transactions FOR SELECT
  TO public
  USING (true);

-- 允许服务密钥写入
CREATE POLICY "Allow service insert on users"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow service update on users"
  ON public.users FOR UPDATE
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow service insert on logs"
  ON public.logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow service insert on transactions"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);
-- ========================================

-- 启用 RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取（公共访问）
CREATE POLICY "Allow public read access on logs"
  ON public.logs FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public read access on transactions"
  ON public.transactions FOR SELECT
  TO public
  USING (true);

-- 允许服务密钥写入
CREATE POLICY "Allow service insert on logs"
  ON public.logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow service insert on transactions"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ========================================
-- 6. 聚合视图
-- ========================================

-- 创建交易汇总视图
CREATE OR REPLACE VIEW public.transaction_summary AS
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  status,
  COUNT(*) as count,
  COUNT(DISTINCT from_address) as unique_senders,
  SUM(amount) as total_amount
FROM public.transactions
GROUP BY DATE_TRUNC('hour', created_at), status
ORDER BY hour DESC, status;

-- 创建用户统计视图
CREATE OR REPLACE VIEW public.user_statistics AS
SELECT
  COUNT(*) as total_users,
  COUNT(CASE WHEN is_test_user = TRUE THEN 1 END) as test_users,
  COUNT(CASE WHEN is_test_user = FALSE THEN 1 END) as real_users,
  COUNT(CASE WHEN last_login_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as active_users_24h,
  COUNT(CASE WHEN last_login_at >= NOW() - INTERVAL '7 days' THEN 1 END) as active_users_7d,
  COUNT(CASE WHEN last_login_at >= NOW() - INTERVAL '30 days' THEN 1 END) as active_users_30d,
  SUM(login_count) as total_logins,
  AVG(login_count) as avg_logins_per_user,
  MAX(last_login_at) as latest_login
FROM public.users;

-- ========================================
-- 7. 表和字段注释
-- ========================================

COMMENT ON TABLE public.users IS '用户表，存储登录用户信息和统计数据';
COMMENT ON TABLE public.logs IS '日志表，存储系统运行日志';
COMMENT ON TABLE public.transactions IS '交易记录表，存储前端展示的交易数据';
COMMENT ON COLUMN public.users.wallet_address IS '用户钱包地址';
COMMENT ON COLUMN public.users.is_test_user IS '是否为测试用户: TRUE=测试用户, FALSE=真实用户';
COMMENT ON COLUMN public.users.first_login_at IS '首次登录时间';
COMMENT ON COLUMN public.users.last_login_at IS '最后登录时间';
COMMENT ON COLUMN public.users.login_count IS '登录次数';
COMMENT ON COLUMN public.logs.level IS '日志级别: info, warn, error';
COMMENT ON COLUMN public.logs.category IS '日志分类: monitor, transfer, error';
COMMENT ON COLUMN public.transactions.amount IS '交易金额，单位为最小代币单位';
COMMENT ON COLUMN public.transactions.status IS '交易状态: pending, success, failed';
COMMENT ON VIEW public.user_statistics IS '用户统计视图，提供用户总数、登录用户数、测试用户数等统计信息';

-- ========================================
-- 8. 验证表创建
-- ========================================

SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name IN ('users', 'logs', 'transactions')
ORDER BY table_name, ordinal_position;

-- 查看插入的测试数据
SELECT * FROM public.users ORDER BY created_at DESC LIMIT 5;
SELECT * FROM public.logs ORDER BY created_at DESC LIMIT 5;
SELECT * FROM public.transactions ORDER BY created_at DESC LIMIT 5;

-- 查看用户统计
SELECT * FROM public.user_statistics;

-- ========================================
-- 完成
-- ========================================
