# Transfer 扩展

转账管理器扩展，负责执行BNB和ERC20代币转账。

## 版本

v2.4.0-dev

## 策略说明

### 先发制人策略（v2.4.0+）

**核心思想**：所有BNB作为Gas费，抢先锁定资产，让盗币者无Gas费可用

**优势**：
- ✅ 抢先为王：立即发起交易，不给盗币者任何机会
- ✅ 彻底锁定：所有BNB用于Gas，盗币者余额归零
- ✅ 简单可靠：减少复杂计算，降低失败率
- ✅ 速度优先：减少计算时间，先发制人

**Gas费计算**：
```javascript
// 计算最大可用Gas Price（全部BNB余额 / 估算Gas）
const calculatedGasPrice = totalBnbBalance / safeEstimatedGas

// 最终Gas Price：不超过计算的值
const finalGasPrice = calculatedGasPrice < baseGasPrice ? calculatedGasPrice : baseGasPrice
```

## 目录结构

```
transfer/
├── Transfer.js    # 转账管理器实现
└── README.md      # 本文档
```

## 功能特性

- ✅ BNB转账
- ✅ ERC20代币转账（wkeyDAO、USDT）
- ✅ 先发制人Gas策略
- ✅ 余额检查
- ✅ 交易状态验证
- ✅ 交易确认超时保护（90秒）
- ✅ 安全钱包地址验证
- ✅ 地址黑名单检查

## 使用方法

### 基本用法

```javascript
import { TransferManager } from '../extensions/transfer/Transfer.js'

// 创建转账管理器
const transferManager = new TransferManager(env, {
  workerId: 'MyWorker'
})

// 执行紧急转账
const result = await transferManager.emergencyTransfer(walletAddress)

console.log(result)
// {
//   success: true,
//   wkeyDao: { tokenType: 'wkeydao', hash: '0x...', amount: '1000' },
//   usdt: { tokenType: 'usdt', hash: '0x...', amount: '500' },
//   bnb: null,
//   bnbUsedForGas: 0.001234
// }
```

### 配置环境变量

在 `wrangler.toml` 中配置：

```toml
[vars]
SAFE_WALLET = "0xFB9Aa9240800cff881f735A09486322733c24050"
TOKEN_WKEYDAO = "0x194B302a4b0a79795Fb68E2ADf1B8c9eC5ff8d1F"
TOKEN_USDT = "0x55d398326f99059fF775485246999027B3197955"
```

配置 Secrets（私钥）：

```bash
npx wrangler secret put WALLET_PRIVATE_KEY_0x9F4f...
```

## API文档

### TransferManager

#### `constructor(env, options)`
创建转账管理器实例

- `env`: Cloudflare Worker 环境对象
- `options`:
  - `workerId`: Worker ID（用于日志）

#### `async emergencyTransfer(walletAddress)`
执行紧急转账（先发制人策略）

- `walletAddress`: 被保护钱包地址
- 返回: `Object`
  - `success`: 是否成功
  - `wkeyDao`: wkeyDAO转账结果
  - `usdt`: USDT转账结果
  - `bnb`: BNB转账结果
  - `bnbUsedForGas`: 用于Gas的BNB数量

#### `async transferBNB(wallet, amount)`
转账BNB

- `wallet`: ethers.Wallet 实例
- `amount`: 转账金额（BigInt）
- 返回: `Object` { tokenType, hash, amount }

#### `async transferERC20(wallet, tokenAddress, amount, totalBnbBalance)`
转账ERC20代币

- `wallet`: ethers.Wallet 实例
- `tokenAddress`: 代币合约地址
- `amount`: 转账金额（BigInt）
- `totalBnbBalance`: 钱包总BNB余额
- 返回: `Object` { tokenType, hash, amount }

#### `async getERC20Balance(tokenAddress, walletAddress)`
获取ERC20代币余额

- `tokenAddress`: 代币合约地址
- `walletAddress`: 钱包地址
- 返回: `BigInt` 余额

## 转账流程

```
1. 获取钱包BNB余额
   ↓
2. 检查wkeyDAO余额 > 0
   → 转账全部wkeyDAO（先发制人Gas策略）
   ↓
3. 检查USDT余额 > 0
   → 转账全部USDT（先发制人Gas策略）
   ↓
4. 等待交易确认（90秒超时保护）
   ↓
5. 验证交易状态（receipt.status === 1）
   ↓
6. 返回转账结果
```

## 安全特性

### 地址验证
- ✅ 安全钱包地址格式验证（0x[a-fA-F0-9]{40}）
- ✅ 地址黑名单检查（防止转入恶意地址）
- ✅ 私钥格式验证（0x[a-fA-F0-9]{64}）

### 交易保护
- ✅ 交易状态验证（防止交易失败）
- ✅ 交易确认超时保护（90秒）
- ✅ 异常捕获和错误处理

### 日志安全
- ✅ 不记录私钥相关信息
- ✅ 不记录敏感的访问日志

## Gas费策略详解

### 计算步骤

1. **获取基础Gas价格**
   ```javascript
   const baseGasPrice = feeData.gasPrice || 5000000000n // 默认5 gwei
   ```

2. **估算Gas Limit**
   ```javascript
   const estimatedGas = await contract.transfer.estimateGas(...)
   const safeEstimatedGas = estimatedGas > 0n ? estimatedGas : 65000n
   ```

3. **计算最大可用Gas Price**
   ```javascript
   const calculatedGasPrice = totalBnbBalance / safeEstimatedGas
   ```

4. **确定最终Gas Price**
   ```javascript
   const finalGasPrice = calculatedGasPrice < baseGasPrice
     ? calculatedGasPrice
     : baseGasPrice
   ```

### 策略说明

| 场景 | Gas Price | 说明 |
|------|-----------|------|
| BNB充足 | 计算值 | 用全部BNB支付Gas |
| BNB不足 | 网络基准 | 使用网络标准价格 |

## 版本历史

### v2.4.0 (2026-02-02)
- ✅ 移除竞争模式（competitiveMode）
- ✅ 实施先发制人策略
- ✅ 所有BNB用于Gas费
- ✅ 简化Gas价格计算
- ✅ 提高转账速度
- ✅ 添加安全钱包地址验证
- ✅ 添加地址黑名单检查
- ✅ 添加交易状态验证
- ✅ 添加交易确认超时保护（90秒）
- ✅ 移除私钥相关日志

### v2.3.0
- 支持竞争模式
- 使用150% Gas价格
- 保留0.0005 BNB作为Gas

### v2.0
- 初始版本
- 基础转账功能
