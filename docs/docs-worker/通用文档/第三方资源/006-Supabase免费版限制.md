# 错误 #006 - Supabase 免费版 1000 条限制

**日期**: 2025-01-XX  
**Worker**: Cloudflare Worker  
**版本**: v1.0.2 之前

---

## 错误信息

```
Error: Supabase请求失败: 413 Payload Too Large
Error: row-level security violation
Error: 超出免费版限制
```

---

## 影响范围

- [x] 功能异常
- [ ] 资产损失
- [x] 性能下降
- [x] 用户体验影响

---

## 失败分析

1. **Supabase 免费版限制**: 每张表最多存储 1000 条记录
   - Supabase 免费版有严格的行数限制
   - 超过限制后无法写入新记录
   - 需要升级到付费版或清理旧数据

2. **扫描日志频繁写入**: 每分钟扫描都写入日志，导致记录数快速增长
   - 定时任务每分钟触发一次
   - 每次扫描都写入 `scans` 表
   - 17 小时左右达到 1000 条限制

3. **超出限制**: 当记录超过 1000 条时，写入失败
   - 返回 413 错误
   - 功能无法正常使用
   - 数据丢失风险

---

## 改进措施

**版本**: v1.0.2

### 1. 停止记录扫描日志

```javascript
// 原有逻辑（每次扫描都记录）
const scanResult = await scanner.scan(walletAddress)
await db.saveScanLog(scanResult)  // ❌ 频繁写入

// 改进后逻辑（只记录转账）
const transferResult = await transferManager.transfer(walletAddress)
if (transferResult.success) {
  await db.saveTransaction(transferResult)  // ✅ 只记录转账
}
```

**改进说明**:
- 停止写入 `scans` 表
- 只记录转账记录 (`transactions` 表)
- 大幅减少数据库写入量
- 转账记录量远小于扫描日志

### 2. 触发器自动清理

```sql
-- supabase/trigger_auto_cleanup.sql

-- 创建自动清理触发器
CREATE OR REPLACE FUNCTION auto_cleanup_transactions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  record_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO record_count FROM transactions;
  
  IF record_count > 900 THEN
    DELETE FROM transactions
    WHERE id IN (
      SELECT id FROM transactions
      ORDER BY created_at ASC
      LIMIT 100
    );
    
    RAISE NOTICE '自动清理: 删除了 100 条旧记录';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 在插入后触发
CREATE TRIGGER trigger_auto_cleanup
AFTER INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION auto_cleanup_transactions();
```

**改进说明**:
- 触发器在每次插入后执行
- 当记录数超过 900 条时，自动删除最旧的 100 条
- 保持记录数在 1000 条以内
- 保留最新的记录（更有价值）

### 3. 批量写入优化

```javascript
// 如果必须写入大量数据，使用批量插入
async function batchInsert(records) {
  const batchSize = 50
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    await supabase
      .from('transactions')
      .insert(batch)
    
    await new Promise(resolve => setTimeout(resolve, 100))  // 避免触发速率限制
  }
}
```

### 4. 限制查询范围

```javascript
// 查询时限制返回记录数
const { data, error } = await supabase
  .from('transactions')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(100)  // 只返回最近 100 条
```

---

## 改进验证

| 测试场景 | 输入 | 预期结果 | 实际结果 |
|----------|------|----------|----------|
| 正常写入 | 新交易记录 | 写入成功 | ✅ 通过 |
| 接近限制 | 记录数 = 950 | 自动清理，保留 850 条 | ✅ 通过 |
| 超过限制 | 记录数 = 1050 | 自动清理，保留 950 条 | ✅ 通过 |
| 批量写入 | 插入 200 条记录 | 分批插入，避免速率限制 | ✅ 通过 |

---

## 相关文件

- `supabase/trigger_auto_cleanup.sql` - 自动清理触发器
- `cloudflare/extensions/database/DatabaseExtension.js` - 数据库扩展
- `docs/开发指南/CLOUDFLARE_WORKER_开发问题手册.md` - 问题手册 #3.1

---

## 经验总结

1. **免费版限制**:
   - Supabase 免费版每表最多 1000 条
   - 需要考虑写入频率
   - 必须实现自动清理

2. **减少写入**:
   - 只记录关键数据（如交易记录）
   - 停止记录频繁生成的日志
   - 使用批量写入减少请求次数

3. **自动清理**:
   - 使用触发器自动清理
   - 设置合理的阈值（900 条）
   - 保留最新的记录（更有价值）

4. **长期方案**:
   - 考虑升级到付费版
   - 或迁移到其他数据库（如 Cloudflare D1）
   - 或使用本地 KV 存储

---

**最后更新**: 2025-01-XX
