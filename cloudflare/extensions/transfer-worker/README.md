# Transfer Worker 扩展

转账Worker扩展，作为扩展函数被Scanner调用，执行转账循环。

## 版本

v2.4.0-dev

## 功能说明

Transfer Worker 是一个扩展函数，由 Scanner 调用，负责：

1. 检测钱包是否有代币余额需要转账
2. 执行转账操作（wkeyDAO、USDT）
3. 记录交易到数据库
4. 创建 Aide 监控任务
5. 处理 Gas 费不足的情况

## 目录结构

```
transfer-worker/
├── TransferWorkerExtension.js  # 转账Worker扩展实现
└── README.md                 # 本文档
```

## 功能特性

- ✅ 自动检测代币余额
- ✅ 转账wkeyDAO和USDT
- ✅ 交易记录保存
- ✅ Aide监控集成
- ✅ 重试机制（最多3次）
- ✅ Gas费不足处理
- ✅ 钱包清空检查
- ✅ 转账循环超时保护（3分钟）

## 工作流程

```
Scanner检测到代币余额 > 0
         ↓
    触发Transfer Worker
         ↓
    检查钱包BNB余额
         ↓
    执行转账（先发制人策略）
       ↓
  保存交易记录到数据库
       ↓
    创建Aide监控任务
       ↓
    检查钱包是否清空
       ↓
    返回转账结果
```

## 使用方法

### 在 Worker 中使用

```javascript
import { createTransferWorkerExtension } from '../extensions/transfer-worker/TransferWorkerExtension.js'

// 创建扩展
const transferWorker = createTransferWorkerExtension(env, {
  maxRetries: 3,
  safeWallet: env.SAFE_WALLET,
  tokenWkeyDao: env.TOKEN_WKEYDAO,
  tokenUsdt: env.TOKEN_USDT,
  targetBnbBalance: '0.001'
})

// 执行转账循环
const result = await transferWorker.runTransferLoop(walletAddress, tokenType, db, rpcUrl)

console.log(result)
// {
//   completed: true,
//   reason: 'all_transfers_completed',
//   wkeyDao: { ... },
//   usdt: { ... },
//   bnb: { ... },
//   aideTasks: [ ... ]
// }
```

### 在 Scanner 中调用

```javascript
// Scanner 检测到代币余额 > 0
if (scanResult.wkeyDaoBalance > 0 || scanResult.usdtBalance > 0) {
  const tokenType = scanResult.wkeyDaoBalance > 0 ? 'wkeydao' : 'usdt'

  // 调用 Transfer Worker
  const transferResult = await transferWorker.runTransferLoop(
    walletAddress,
    tokenType,
    db,
    rpcUrl
  )

  // 转账成功，调用 Aide 监控交易
  if (transferResult.success && transferResult.aideTasks?.length > 0) {
    await executeAide(env, transferResult.aideTasks, db, rpcUrl)
  }
}
```

## 配置说明

### 环境变量

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

### 扩展参数

```javascript
const transferWorker = createTransferWorkerExtension(env, {
  maxRetries: 3,              // 最大重试次数
  safeWallet: '0x...',         // 安全钱包地址
  tokenWkeyDao: '0x...',      // wkeyDAO代币地址
  tokenUsdt: '0x...',         // USDT代币地址
  targetBnbBalance: '0.001'   // 目标BNB余额（未使用）
})
```

## API文档

### createTransferWorkerExtension(env, options)

创建Transfer Worker扩展

- `env`: Cloudflare Worker 环境对象
- `options`: 配置选项
  - `maxRetries`: 最大重试次数（默认3）
  - `safeWallet`: 安全钱包地址
  - `tokenWkeyDao`: wkeyDAO代币地址
  - `tokenUsdt`: USDT代币地址
  - `targetBnbBalance`: 目标BNB余额（未使用）

### runTransferLoop(walletAddress, tokenType, db, rpcUrl)

执行转账循环

- `walletAddress`: 被保护钱包地址
- `tokenType`: 代币类型（'wkeydao' | 'usdt'）
- `db`: 数据库扩展实例
- `rpcUrl`: RPC节点URL
- 返回: `Object`
  - `completed`: 是否完成
  - `reason`: 完成原因
  - `wkeyDao`: wkeyDAO转账结果
  - `usdt`: USDT转账结果
  - `bnb`: BNB转账结果
  - `aideTasks`: Aide监控任务列表

## 重试机制

### 重试条件

1. Gas费不足（insufficient funds）
2. RPC节点错误
3. 网络超时

### 重试次数

默认最多重试3次，超过则标记失败。

### 重试策略

```javascript
for (retryCount = 0; retryCount < maxRetries; retryCount++) {
  try {
    // 执行转账
    const result = await executeTransfer(...)

    if (result.success) {
      return result  // 成功，退出
    }
  } catch (error) {
    if (isGasError(error)) {
      console.log('Gas费不足，重试...')
      continue  // 继续重试
    }
    throw error  // 其他错误，抛出
  }
}
```

## Gas费处理

### 检测Gas费不足

```javascript
const balance = await provider.getBalance(walletAddress)
const currentBnb = parseFloat(ethers.formatEther(balance))

if (currentBnb < 0.0005) {
  console.log('⚠️ Gas费不足，需要补充')
  // 可以触发Gas补充机制
}
```

### Gas补充策略

由 GasFunder 扩展自动补充Gas费：

```javascript
import { createGasFunder } from '../extensions/gas/GasFunder.js'

const gasFunder = createGasFunder(env, db)
await gasFunder.fundGas(walletAddress)
```

## Aide监控集成

### Aide任务创建

转账成功后自动创建Aide监控任务：

```javascript
if (result.wkeyDao?.hash) {
  aideTasks.push({
    txHash: result.wkeyDao.hash,
    walletAddress,
    tokenType: 'wkeydao'
  })
}
```

### 监控交易状态

```javascript
import { createAideWorkerExtension } from '../extensions/aide-worker/AideWorkerExtension.js'

const aideWorker = createAideWorkerExtension(env)
await aideWorker.monitorTransactions(aideTasks, db)
```

## 钱包清空检查

转账后检查钱包是否清空：

```javascript
const { isWalletEmpty, scanResult } = await checkWalletEmpty(env, walletAddress, rpcUrl)

if (isWalletEmpty) {
  console.log('✅ 钱包已清空')
} else {
  console.log('⚠️ 钱包未完全清空')
}
```

## 日志示例

```
💸 [TransferWorker] 开始执行转账: 0x9F4f (代币: wkeydao, 重试: 0/3)
💰 [TransferWorker] 钱包 0x9F4f BNB余额: 0.001234 BNB
🚀 [TransferManager] 0x9F4f BNB余额: 0.001234 BNB（全部用于Gas费）
⚔️ [TransferManager] 0x9F4f 所有BNB (0.001234) 用于Gas费，盗币者将无Gas费可用
⚔️ [TransferManager] 先发制人Gas配置:
   代币: wkeydao
   总BNB余额: 0.001234 BNB
   Gas Price: 18.5 gwei
   Gas Limit: 65000
   预估Gas费: 0.001202 BNB
✅ [TransferWorker] 转账完成: 0x9F4f
```

## 版本历史

### v2.4.0 (2026-02-02)
- ✅ 移除 competitiveMode 参数
- ✅ 集成先发制人策略
- ✅ 简化Gas费处理逻辑
- ✅ 优化日志输出
- ✅ 添加转账循环超时保护（3分钟）

### v2.3.0
- 支持竞争模式
- Gas费补充集成
- 重试机制优化

### v2.0
- 初始版本
- 基础转账功能
- Aide监控集成
