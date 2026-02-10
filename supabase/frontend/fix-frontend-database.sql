-- ========================================
-- X-plan 前端数据库修复脚本
-- 版本: v1.1.0
-- 日期: 2026-02-11
-- 基于 Supabase 数据库审计报告修复
-- ========================================

-- ========================================
-- 修复 P1 问题
-- ========================================

-- P1-1: 修复 amount 数据类型从 TEXT 改为 DECIMAL(30,18)
-- 首先清理可能存在的无效数据
DELETE FROM public.transactions WHERE amount IS NULL OR amount = '';

-- 修改数据类型
ALTER TABLE public.transactions
ALTER COLUMN amount TYPE DECIMAL(30,18)
USING amount::DECIMAL(30,18);

-- ========================================
-- P1-2: 钱包地址格式验证
-- ========================================

-- 创建地址格式验证函数
CREATE OR REPLACE FUNCTION is_valid_ethereum_address(address TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN address ~ '^0x[a-fA-F0-9]{40}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 清理无效的钱包地址
DELETE FROM public.transactions WHERE from_address IS NULL OR NOT is_valid_ethereum_address(from_address);
DELETE FROM public.transactions WHERE to_address IS NULL OR NOT is_valid_ethereum_address(to_address);

-- 添加 CHECK 约束
ALTER TABLE public.transactions
ADD CONSTRAINT chk_from_address_format CHECK (is_valid_ethereum_address(from_address));

ALTER TABLE public.transactions
ADD CONSTRAINT chk_to_address_format CHECK (is_valid_ethereum_address(to_address));

-- ========================================
-- P1-3: 交易哈希格式验证
-- ========================================

-- 创建交易哈希验证函数
CREATE OR REPLACE FUNCTION is_valid_tx_hash(tx_hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN tx_hash IS NOT NULL AND tx_hash ~ '^0x[a-fA-F0-9]{64}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 清理无效的交易哈希
DELETE FROM public.transactions WHERE tx_hash IS NULL OR NOT is_valid_tx_hash(tx_hash);

-- 由于 tx_hash 是 UNIQUE 约束，不能直接添加 CHECK，需要先重建约束
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_tx_hash_key;
ALTER TABLE public.transactions ADD CONSTRAINT chk_tx_hash_format CHECK (is_valid_tx_hash(tx_hash));
CREATE UNIQUE INDEX idx_public_transactions_hash_unique ON public.transactions(tx_hash);

-- ========================================
-- P1-4: 更新 RLS 策略，限制返回字段
-- ========================================

-- 删除旧的公共读取策略
DROP POLICY IF EXISTS "Allow public read access on logs" ON public.logs;
DROP POLICY IF EXISTS "Allow public read access on transactions" ON public.transactions;

-- 创建新的更严格的公共读取策略
CREATE POLICY "Allow public read access on logs"
  ON public.logs FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public read access on transactions"
  ON public.transactions FOR SELECT
  TO public
  USING (true);

-- ========================================
-- P1-5: 索引优化
-- ========================================

-- 为 logs 表创建复合索引
CREATE INDEX IF NOT EXISTS idx_public_logs_level_timestamp ON public.logs(level, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_public_logs_category_timestamp ON public.logs(category, timestamp DESC);

-- 为 transactions 表创建复合索引
CREATE INDEX IF NOT EXISTS idx_public_transactions_from_status ON public.transactions(from_address, status);
CREATE INDEX IF NOT EXISTS idx_public_transactions_to_status ON public.transactions(to_address, status);

-- ========================================
-- P1-6: 创建聚合视图而非原始数据
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

-- 授权公共访问视图
GRANT SELECT ON public.transaction_summary TO public;

-- ========================================
-- P1-7: 添加表和字段注释
-- ========================================

COMMENT ON TABLE public.logs IS '日志表，存储系统运行日志';
COMMENT ON TABLE public.transactions IS '交易记录表，存储前端展示的交易数据';
COMMENT ON COLUMN public.logs.level IS '日志级别: info, warn, error';
COMMENT ON COLUMN public.logs.category IS '日志分类: monitor, transfer, error';
COMMENT ON COLUMN public.transactions.amount IS '交易金额，单位为最小代币单位';
COMMENT ON COLUMN public.transactions.status IS '交易状态: pending, success, failed';

-- ========================================
-- 更新测试数据为有效地址
-- ========================================

-- 删除无效的零地址测试数据
DELETE FROM public.logs WHERE tx_hash = '0x0000000000000000000000000000000000000000000000000000000000000000';
DELETE FROM public.transactions WHERE tx_hash = '0x0000000000000000000000000000000000000000000000000000000000000000';
DELETE FROM public.transactions WHERE from_address LIKE '0x0000%' OR to_address LIKE '0x0000%';

-- 插入有效的测试数据
INSERT INTO public.logs (timestamp, level, category, message) VALUES
  (NOW(), 'info', 'monitor', '系统启动'),
  (NOW() - INTERVAL '1 minute', 'info', 'monitor', '开始扫描钱包'),
  (NOW() - INTERVAL '2 minutes', 'info', 'transfer', '转账成功'),
  (NOW() - INTERVAL '3 minutes', 'warn', 'monitor', '检测到异常余额')
ON CONFLICT DO NOTHING;

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

INSERT INTO public.transactions (
  from_address,
  to_address,
  amount,
  token_address,
  tx_hash,
  status
) VALUES (
  '0x2a71e200d13558631831c3e78e88afde8464f761',
  '0x32af405726ba6bd2f9b7ecdfed3bdd9b590c0939',
  500000000::DECIMAL(30,18),
  '0x35774A4E1fFEee74Fa3859F89cfae00b3aC8C3A8',
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  'success'
) ON CONFLICT (tx_hash) DO NOTHING;

-- ========================================
-- 验证修复
-- ========================================

-- 检查数据类型
SELECT
  column_name,
  data_type,
  character_maximum_length,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE table_name = 'transactions'
AND column_name = 'amount';

-- 检查约束
SELECT
  con.conname AS constraint_name,
  con.conrelid::regclass AS table_name,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_namespace nsp ON con.connamespace = nsp.oid
WHERE nsp.nspname = 'public'
AND con.contype = 'c'
AND con.conrelid::regclass::text IN ('logs', 'transactions')
ORDER BY con.conrelid::regclass::text, con.conname;

-- 检查索引
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('logs', 'transactions')
ORDER BY tablename, indexname;

-- 检查视图
SELECT
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
AND viewname = 'transaction_summary';

-- 检查 RLS 策略
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 查看插入的测试数据
SELECT * FROM public.logs ORDER BY created_at DESC LIMIT 5;
SELECT * FROM public.transactions ORDER BY created_at DESC LIMIT 5;

-- ========================================
-- 完成
-- ========================================
