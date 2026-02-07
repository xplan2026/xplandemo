# 错误 #004 - wkeyDAO 余额 decimals 配置错误

**日期**: 2025-01-XX  
**Worker**: Cloudflare Worker / 前端  
**版本**: v1.0.2 之前

---

## 错误信息

```
余额显示异常：0.000000000000000000194 wkeyDAO
实际余额应为：0.000000194 wkeyDAO
```

---

## 影响范围

- [x] 功能异常
- [ ] 资产损失
- [ ] 性能下降
- [x] 用户体验影响（显示异常）

---

## 失败分析

1. **数据库配置错误**: `tokens_monitor` 表中 `decimals` 字段配置错误
   - 硬编码为 18（标准 ERC20）
   - wkeyDAO 实际 decimals 为 9

2. **前端配置错误**: 前端 `config.js` 中代币 decimals 配置错误
   - 未查询合约获取实际 decimals
   - 直接使用硬编码值

3. **wkeyDAO 实际 decimals**: wkeyDAO 代币的 decimals 为 9，而非 18
   - decimals 决定代币最小单位
   - 错误的 decimals 导致余额显示异常（多 9 个 0）

---

## 改进措施

**版本**: v1.0.2

### 1. 修正数据库配置

```sql
-- 更新 wkeyDAO 的 decimals
UPDATE tokens_monitor
SET decimals = 9
WHERE token_address = '0x194B302a4b0a79795Fb68E2ADf1B8c9eC5ff8d1F';

-- 验证更新结果
SELECT token_address, symbol, decimals
FROM tokens_monitor
WHERE token_address = '0x194B302a4b0a79795Fb68E2ADf1B8c9eC5ff8d1F';
```

### 2. 修正前端配置

```javascript
// frontend/config.js
const TOKENS = [
  {
    address: '0x194B302a4b0a79795Fb68E2ADf1B8c9eC5ff8d1F',
    symbol: 'wkeyDAO',
    decimals: 9  // 修正为 9
  }
]
```

### 3. 后端代码验证

```javascript
// 在获取代币信息时查询 decimals
const [balance, decimals, symbol] = await Promise.all([
  contract.balanceOf(wallet.address),
  contract.decimals(),  // 从合约查询实际 decimals
  contract.symbol().catch(() => 'Unknown')
])

// 使用正确的 decimals 格式化
const formattedBalance = ethers.formatUnits(balance, decimals)

console.log(`代币余额: ${formattedBalance} ${symbol} (decimals: ${decimals})`)
```

**改进说明**:
- 从合约查询实际的 decimals
- 避免硬编码导致的配置错误
- 使用 `ethers.formatUnits()` 正确格式化余额

### 4. 初始化数据库时查询 decimals

```javascript
// 在初始化代币时，自动查询 decimals
async function initializeToken(tokenAddress) {
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
  
  const [symbol, decimals] = await Promise.all([
    contract.symbol().catch(() => 'Unknown'),
    contract.decimals()
  ])
  
  // 插入到数据库
  await db.insert('tokens_monitor', {
    token_address: tokenAddress,
    symbol: symbol,
    decimals: decimals,  // 使用实际查询的 decimals
    created_at: new Date().toISOString()
  })
  
  console.log(`代币初始化完成: ${symbol} (decimals: ${decimals})`)
}
```

---

## 改进验证

| 测试场景 | 输入 | 预期结果 | 实际结果 |
|----------|------|----------|----------|
| wkeyDAO 余额 | 194 wei (decimals=9) | 显示 0.000000194 | ✅ 通过 |
| wkeyDAO 余额 | 194 wei (decimals=18) | 显示 0.000000000000000000194（错误） | ✅ 修复 |
| 前端显示 | wkeyDAO 余额 | 显示正确 | ✅ 通过 |
| 后端查询 | 余额查询 | 返回正确 decimals | ✅ 通过 |
| 初始化 | 新增代币 | 自动查询 decimals | ✅ 通过 |

---

## 相关文件

- `supabase/init.sql` - 数据库初始化脚本
- `frontend/config.js` - 前端配置
- `cloudflare/extensions/scanner/Scanner.js` - 扫描器
- `docs/开发指南/CLOUDFLARE_WORKER_开发问题手册.md` - 问题手册 #1.3

---

## 经验总结

1. **Decimals 配置**:
   - 不同代币有不同的 decimals（18、9、6 等）
   - 必须查询合约获取实际 decimals
   - 硬编码 decimals 容易出错

2. **前后端一致性**:
   - 数据库、前端、后端 decimals 配置必须一致
   - 建议从合约查询，避免配置错误
   - 格式化时使用正确的 decimals

3. **初始化**:
   - 初始化代币时应自动查询 decimals
   - 避免手动配置导致的错误
   - 记录 decimals 信息便于排查问题

4. **显示问题**:
   - 错误的 decimals 导致余额显示异常
   - 多或少 9 个 0 很容易发现
   - 定期检查显示是否正常

---

**最后更新**: 2025-01-XX
