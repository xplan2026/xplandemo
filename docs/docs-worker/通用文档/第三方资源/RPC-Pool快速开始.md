# RPC Pool 快速使用指南

## 1. 安装

RPC Pool是纯JavaScript实现，无需安装依赖。

## 2. 基本使用

```javascript
import { RpcPoolExtension } from './index.js'

// 创建节点池实例
const rpcPool = new RpcPoolExtension(env)

// 获取前5个最优节点
const bestNodes = await rpcPool.getBestRpc()

console.log('最优节点:', bestNodes)
```

## 3. 在Scanner中集成

### 步骤1：导入扩展

```javascript
import { RpcPoolExtension } from '../../extensions/rpc-pool/index.js'
```

### 步骤2：初始化节点池

```javascript
constructor(env) {
  this.env = env
  this.rpcPool = new RpcPoolExtension(env)
  this.timeout = 7000  // 7秒超时
}
```

### 步骤3：修改扫描逻辑

```javascript
async scan(walletAddress) {
  // 获取最优节点
  const bestNodes = await this.rpcPool.getBestRpc()

  // 尝试每个节点（最多5次）
  for (let i = 0; i < bestNodes.length; i++) {
    const nodeUrl = bestNodes[i]

    try {
      console.log(`尝试节点 ${i + 1}/${bestNodes.length}: ${nodeUrl}`)

      // 创建provider
      const provider = new ethers.JsonRpcProvider(nodeUrl)

      // 带超时的请求
      const result = await Promise.race([
        this._scanWithProvider(provider, walletAddress),
        this._timeout(this.timeout)
      ])

      console.log(`✅ 成功使用节点: ${nodeUrl}`)
      return result

    } catch (error) {
      console.error(`❌ 节点失败: ${nodeUrl}`)

      // 标记节点失败（自动移到队尾）
      await this.rpcPool.markNodeFailed(nodeUrl)

      // 如果是最后一个节点，抛出异常
      if (i === bestNodes.length - 1) {
        throw new Error('所有节点均不可用')
      }
    }
  }
}
```

## 4. 配置节点列表

### 方式1：环境变量

在 `wrangler.toml` 中配置：

```toml
[vars]
BSC_RPC_NODES = "https://node1.com,https://node2.com,https://node3.com"
```

### 方式2：代码中添加

```javascript
await rpcPool.addNode('https://new-node.com')
```

## 5. 查看节点列表

```javascript
const nodeList = await rpcPool.getNodeList()
console.log('当前节点列表:')
nodeList.forEach((node, i) => {
  console.log(`${i + 1}. ${node.url} (index: ${node.index})`)
})
```

## 6. 管理节点

### 添加节点

```javascript
const success = await rpcPool.addNode('https://new-rpc-node.com')
console.log('添加结果:', success)  // true/false
```

### 移除节点

```javascript
const success = await rpcPool.removeNode('https://slow-rpc-node.com')
console.log('移除结果:', success)  // true/false
```

### 查看统计

```javascript
const stats = rpcPool.getStats()
console.log('节点池统计:')
console.log(`- 总节点数: ${stats.totalNodes}`)
console.log(`- 最优节点数: ${stats.bestNodeCount}`)
console.log(`- 超时时间: ${stats.timeout}ms`)
```

## 7. 完整示例

```javascript
import { ethers } from 'ethers'
import { RpcPoolExtension } from './extensions/rpc-pool/index.js'

export class Scanner {
  constructor(env) {
    this.env = env
    this.rpcPool = new RpcPoolExtension(env)
    this.timeout = 7000
  }

  async scan(walletAddress) {
    const bestNodes = await this.rpcPool.getBestRpc()

    for (let i = 0; i < bestNodes.length; i++) {
      const nodeUrl = bestNodes[i]

      try {
        const provider = new ethers.JsonRpcProvider(nodeUrl)
        const balance = await Promise.race([
          provider.getBalance(walletAddress),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('超时')), this.timeout)
          )
        ])

        console.log(`✅ 余额: ${ethers.formatEther(balance)} BNB`)
        return balance

      } catch (error) {
        await this.rpcPool.markNodeFailed(nodeUrl)

        if (i === bestNodes.length - 1) {
          throw new Error('所有节点均不可用')
        }
      }
    }
  }
}
```

## 8. 运行测试

```bash
cd cloudflare/extensions/rpc-pool
node test.js
```

## 9. 常见问题

### Q1: 节点顺序如何优化？

A: 每次节点连接超时（7秒），节点会自动移到队尾。通过多次轮询，性能差的节点自然沉淀在队尾。

### Q2: 如何查看当前节点排序？

A: 使用 `getNodeList()` 方法，它返回排序后的完整节点列表。

### Q3: 重启后节点顺序会重置吗？

A: 是的，当前版本不持久化节点顺序。如需持久化，可使用Cloudflare KV存储。

### Q4: 超时时间可以修改吗？

A: 可以，在代码中修改 `this.timeout` 或修改 `config.js` 中的 `TIMEOUT` 配置。

### Q5: 如何集成到现有项目？

A: 参考 `example-scanner.js` 文件，它包含完整的集成示例和代码对比。

## 10. 更多文档

- [README.md](README.md) - 完整API文档
- [example-scanner.js](example-scanner.js) - 集成示例
- [test.js](test.js) - 单元测试
