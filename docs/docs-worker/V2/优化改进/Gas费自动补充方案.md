# Gas 费自动补充方案

## 概述

当被保护钱包检测到 wkeyDAO 或 USDT 余额 > 0，但 BNB 余额不足以支付 Gas 费时，系统会自动从 **专用 Gas 补充钱包** 补充足够的 BNB，然后触发代币转账。

### 设计理念

- **职责分离**：Gas 补充钱包仅用于补充 Gas 费，SAFE_WALLET 仅作为收款地址
- **风险控制**：Gas 补充钱包仅保持少量 BNB（约 0.002），降低私钥暴露风险
- **简化管理**：SAFE_WALLET 不需要私钥配置，无需担心私钥安全

## 工作流程

### 应急状态下的自动补充

```
1. 检测到 wkeyDAO > 0 或 USDT > 0
2. 直接触发转账（不做 Gas 预检查）
3. 转账失败时检查是否因为 Gas 费不足
4. 累计 Gas 费不足失败次数（每个钱包独立计数）
   ├─ 失败次数 < 3：只记录日志，等待下次扫描重试
   └─ 失败次数 >= 3：
      ├─ 从安全钱包补充 BNB 到目标余额 0.005
      ├─ 等待链上确认
      ├─ 补充成功后重置计数器
      └─ 补充失败则保持计数器不变，等待下次重试
5. 下次扫描时如果 Gas 足够，转账将成功
```

### 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `MIN_BNB_FOR_GAS` | 0.0005 | 单次转账需要的最小 BNB（仅供参考，实际不用于预检查） |
| `TARGET_BNB_BALANCE` | 0.002 | 补充后的目标 BNB 余额（降低暴露风险） |
| `MAX_GAS_INSUFFICIENT_RETRIES` | 3 | 连续 Gas 不足失败多少次后自动补充 |
| 补充金额 | 目标 - 当前 + Gas 费 | 实际转账金额 |

## 环境变量配置

### 必需配置

```toml
# wrangler.toml 或 Cloudflare 环境变量

# Gas 补充钱包（用于补充 Gas 费）
GAS_FUNDING_WALLET = "0x..."  # Gas 补充钱包地址

# 安全钱包（收款地址，不需要私钥）
SAFE_WALLET = "0x..."  # 安全钱包地址

# 被保护钱包列表
PROTECTED_WALLETS = "0x地址1,0x地址2,0x地址3"
```

### 密钥配置（Secret）

```bash
# Gas 补充钱包私钥（必需）
wrangler secret put GAS_FUNDING_WALLET_PRIVATE_KEY

# 数据库配置
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_KEY

# JWT 密钥
wrangler secret put JWT_SECRET

# 被保护钱包私钥（每个钱包一个）
wrangler secret put WALLET_PRIVATE_KEY_0x钱包地址小写1
wrangler secret put WALLET_PRIVATE_KEY_0x钱包地址小写2
wrangler secret put WALLET_PRIVATE_KEY_0x钱包地址小写3
```

### 钱包说明

| 钱包类型 | 地址变量 | 私钥变量 | 余额建议 | 用途 |
|---------|---------|---------|---------|------|
| **Gas 补充钱包** | `GAS_FUNDING_WALLET` | `GAS_FUNDING_WALLET_PRIVATE_KEY` | 0.002 BNB | 补充 Gas 费到被保护钱包 |
| **安全钱包** | `SAFE_WALLET` | ❌ 无需配置 | 较大金额 | 接收被保护钱包的转账 |
| **被保护钱包** | `PROTECTED_WALLETS` | `WALLET_PRIVATE_KEY_<地址>` | - | 监控并自动转账 |

**重要提示**：
- **Gas 补充钱包**：只需要少量 BNB（约 0.002），私钥有暴露风险
- **安全钱包**：金额较大，但不配置私钥，只作为收款地址
- **被保护钱包**：每个需要设置对应的私钥

## 代码集成

### 使用示例

```javascript
import { GasFunder } from '../extensions/gas/GasFunder.js'

// 创建 GasFunder 实例
const gasFunder = new GasFunder(env, db, { workerId: 'worker-1' })

// 检查钱包是否需要补充 Gas 费
const needsFunding = await gasFunder.needsGasFunding(walletAddress)

// 补充 Gas 费
const result = await gasFunder.fundGas(walletAddress)

// 批量补充
const batchResults = await gasFunder.fundGasBatch(walletAddresses)

// 自动检测并补充
const checkResults = await gasFunder.checkAndFund(walletAddresses)
```

### 在 EmergencyExtension 中自动集成

Gas 费补充功能已自动集成到 `EmergencyExtension.js` 中，采用**失败重试策略**：

1. **直接触发转账**：不做 Gas 预检查，直接尝试转账
2. **失败检测**：检测转账失败是否因为 Gas 费不足
3. **累计计数**：每个钱包独立累计 Gas 不足失败次数
4. **自动补充**：连续 3 次失败后自动补充 Gas 费
5. **重置计数**：补充成功后重置计数器

#### 工作时序图

```
扫描 1: wkeyDAO > 0 → 触发转账 → 失败（Gas不足）→ 计数=1
扫描 2: wkeyDAO > 0 → 触发转账 → 失败（Gas不足）→ 计数=2
扫描 3: wkeyDAO > 0 → 触发转账 → 失败（Gas不足）→ 计数=3
         ↓
         自动补充 Gas 费（从安全钱包）→ 计数重置为 0
扫描 4: wkeyDAO > 0 → 触发转账 → 成功！
```

## 优势

### 采用失败重试策略的优势

1. **减少不必要的 Gas 消耗**：只有在确认 Gas 不足时才补充，避免过度消耗
2. **简化逻辑**：直接尝试转账，不做预检查，代码更简洁
3. **更符合实际场景**：很多情况下 Gas 是足够的，无需预先补充
4. **容错性强**：3 次重试给系统足够的时间应对网络波动或临时 Gas 飙升

### 相比 Guard 状态方案

1. **简化系统复杂度**：无需新增 Guard 状态和扩展
2. **无资源消耗**：不会增加额外的定时任务和扫描开销
3. **自动化程度高**：完全自动化，无需人工干预
4. **响应速度快**：立即补充，无需等待 10 分钟的 Guard 状态

### 相比手机通知方案

1. **无外部依赖**：不需要引入第三方通知服务（如 Pushover、Twilio）
2. **零成本**：无需支付短信或推送通知费用
3. **可靠性高**：完全由区块链保证，无中间环节
4. **可商用**：无需担心通知服务的免费额度限制

## 注意事项

### Gas 补充钱包余额管理

- **Gas 补充钱包**应始终保持约 0.002 BNB 余额
- 定期监控 Gas 补充钱包余额，必要时补充
- 可以设置监控告警（通过前端或日志分析）
- 由于余额较小，即使私钥泄露风险也较低

### 安全钱包余额管理

- **安全钱包**作为收款地址，不需要私钥
- 可以持有大量资金，无私钥暴露风险
- 定期监控安全钱包余额和转账记录

### Gas 费消耗

- 每次补充约消耗 0.00045 BNB（Gas 费）+ 补充金额
- 补充后的目标余额是 0.002 BNB，可支持约 4-5 次 ERC20 转账
- 如果被保护钱包频繁触发应急状态，可以考虑提高 `TARGET_BNB_BALANCE`
- 由于余额较小（0.002），即使私钥泄露，损失也有限

### 失败处理

- Gas 补充失败时会记录错误日志到数据库
- 不会无限重试，等待下一次扫描（5秒后）
- 如果 Gas 补充钱包余额不足，需要人工干预补充

## 扩展性

### 支持多个 Gas 来源钱包

可以扩展 `GasFunder` 类，支持从多个钱包轮流补充 Gas 费：

```javascript
const gasSources = [
  'SAFE_WALLET_1',
  'SAFE_WALLET_2',
  'SAFE_WALLET_3'
]

// 自动选择余额充足的 Gas 来源钱包
```

### 自定义 Gas 策略

可以根据不同场景调整 Gas 策略：

```javascript
// 保守策略（低 Gas，慢确认）
gasFunder.setGasStrategy('conservative', { gasPriceMultiplier: 1.0 })

// 激进策略（高 Gas，快确认）
gasFunder.setGasStrategy('aggressive', { gasPriceMultiplier: 1.5 })
```

## 测试建议

### 单元测试

1. 测试 Gas 费不足时的自动补充
2. 测试 Gas 补充失败时的错误处理
3. 测试补充成功后的转账触发
4. 测试并发多个钱包的补充

### 集成测试

1. 在测试网络上模拟 Gas 不足场景
2. 验证补充流程的完整性
3. 检查数据库日志记录
4. 监控 Gas 费消耗

## 监控指标

建议监控以下指标：

- 安全钱包 BNB 余额
- Gas 费补充次数
- Gas 费补充成功率
- Gas 费补充失败原因
- 单次补充的平均 Gas 成本

## 相关文件

- `/workspace/cloudflare/extensions/gas/GasFunder.js` - Gas 费补充器实现
- `/workspace/cloudflare/extensions/emergency/EmergencyExtension.js` - 集成自动补充功能
- `/workspace/cloudflare/worker-1-interception/wrangler.toml` - 环境变量配置

---

**创建日期**: 2026-01-23
**适用版本**: v1.2.0+
