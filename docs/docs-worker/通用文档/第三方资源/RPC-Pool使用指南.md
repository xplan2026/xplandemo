# RPC Pool Extension

BSC RPC节点池扩展，实现智能轮换和节点优化。

## 功能特性

- ✅ 自动节点轮换（失败节点移到队尾）
- ✅ 返回最优节点（前5个）
- ✅ 支持运行时动态添加/移除节点
- ✅ 配置导入/导出
- ✅ 超时保护（7秒）
- ✅ **KV持久化：节点排序状态自动保存到Cloudflare KV**
- ✅ **自动恢复：Worker重启后从KV恢复节点顺序**

## 快速开始

```javascript
import { RpcPoolExtension } from './index.js'

// 创建节点池实例
const rpcPool = new RpcPoolExtension(env)

// 初始化（必须先调用）
await rpcPool.initialize()

// 获取最优节点（前5个）
const bestNodes = await rpcPool.getBestRpc()

// 使用节点
for (const nodeUrl of bestNodes) {
  try {
    const provider = new ethers.JsonRpcProvider(nodeUrl)
    // 执行业务逻辑...
    break // 成功则退出
  } catch (error) {
    // 失败，标记节点并尝试下一个
    await rpcPool.markNodeFailed(nodeUrl)
  }
}
```

## 配置KV存储

### 1. 创建KV命名空间

```bash
# 创建生产环境KV命名空间
npx wrangler kv:namespace create "RPC_POOL"

# 创建预览环境KV命名空间
npx wrangler kv:namespace create "RPC_POOL" --preview
```

### 2. 配置wrangler.toml

```toml
[[kv_namespaces]]
binding = "RPC_POOL"
id = "your-kv-namespace-id"
preview_id = "your-preview-kv-id"
```

### 3. KV存储特性

- **自动保存**：节点顺序变更后自动保存到KV
- **自动恢复**：Worker启动时从KV加载上次的节点顺序
- **降级处理**：未配置KV时使用内存存储
- **TTL机制**：KV数据24小时自动过期

## API文档

### RpcPoolExtension

#### constructor(env)
创建节点池实例。

- `env`: Cloudflare Worker环境对象（可选）

#### async initialize()
初始化节点池（必须先调用）。

- 从KV加载节点顺序
- 如KV无数据，使用默认节点列表并保存

#### async getBestRpc()
获取前5个最优节点。

**返回值**: `Array<string>` - 节点URL列表

#### async getNodeList()
获取完整节点列表（排序后）。

**返回值**: `Array<{url: string, index: number}>` - 节点列表

#### async addNode(nodeUrl)
添加节点到队尾。

- `nodeUrl`: 节点URL（字符串）

**返回值**: `boolean` - 是否添加成功

#### async removeNode(nodeUrl)
移除指定节点。

- `nodeUrl`: 节点URL（字符串）

**返回值**: `boolean` - 是否移除成功

#### async markNodeFailed(nodeUrl)
标记节点失败，自动移到队尾。

- `nodeUrl`: 失败的节点URL（字符串）

#### exportConfig()
导出当前配置。

**返回值**: `Object` - 配置对象

#### async importConfig(config)
导入配置。

- `config`: 配置对象

#### async getStats()
获取节点池统计信息。

**返回值**: `Object` - 统计信息（包含hasKV、initialized等）

#### async saveToKV()
手动保存状态到KV。

#### async loadFromKV()
手动从KV重新加载状态。

## 配置

### 环境变量

在 `wrangler.toml` 或环境变量中配置：

```toml
[vars]
BSC_RPC_NODES = "https://bsc-rpc.publicnode.com,https://bsc-dataseed1.binance.org/"

# KV命名空间配置
[[kv_namespaces]]
binding = "RPC_POOL"
id = "your-kv-namespace-id"
preview_id = "your-preview-kv-id"
```

### 默认配置

```javascript
{
  TIMEOUT: 7000,              // 超时时间（毫秒）
  BEST_NODE_COUNT: 5,         // 返回最优节点数量
  ENV_NODES_KEY: 'BSC_RPC_NODES',  // 环境变量键名
  KV_BINDING_NAME: 'RPC_POOL'       // KV绑定名称
}
```

## 默认节点列表

- PublicNode: `https://bsc-rpc.publicnode.com`
- 官方节点: `bsc-dataseed[1-4].binance.org`
- 官方节点: `bsc-dataseed[1-3].ninicoin.io`
- 官方节点: `bsc-dataseed[1-3].defibit.io`

## 使用示例

### 示例1：基本使用（带KV）

```javascript
import { RpcPoolExtension } from './index.js'

// 创建并初始化节点池
const rpcPool = new RpcPoolExtension(env)
await rpcPool.initialize()

const nodes = await rpcPool.getBestRpc()

// 尝试连接
for (const nodeUrl of nodes) {
  try {
    const provider = new ethers.JsonRpcProvider(nodeUrl)
    const balance = await provider.getBalance(walletAddress)
    console.log(`✅ 成功使用节点: ${nodeUrl}`)
    break
  } catch (error) {
    await rpcPool.markNodeFailed(nodeUrl) // 自动保存到KV
  }
}
```

### 示例2：动态管理节点

```javascript
// 添加节点
await rpcPool.addNode('https://new-rpc-node.com')

// 移除节点
await rpcPool.removeNode('https://slow-rpc-node.com')

// 查看节点列表
const nodeList = await rpcPool.getNodeList()
console.log('当前节点列表:', nodeList)
```

### 示例3：配置导入/导出

```javascript
// 导出配置
const config = rpcPool.exportConfig()
console.log('当前配置:', config)

// 导入配置
rpcPool.importConfig({
  nodes: [
    'https://custom-node1.com',
    'https://custom-node2.com'
  ]
})
```

## 注意事项

1. **超时时间**：统一使用7秒超时
2. **重试次数**：异步模式最多5次，单步模式最多3次
3. **全部失败**：抛出异常，终止当前任务
4. **节点排序**：失败节点自动移到队尾，性能差的自然沉淀
5. **无状态**：每次Worker重启后节点顺序重置（如需持久化，可使用KV存储）

## 集成到Scanner

```javascript
import { ethers } from 'ethers'
import { RpcPoolExtension } from '../../extensions/rpc-pool/index.js'

export class Scanner {
  constructor(env) {
    this.env = env
    this.rpcPool = new RpcPoolExtension(env)
    this.timeout = 7000 // 7秒超时
  }

  async scan(walletAddress) {
    const bestNodes = await this.rpcPool.getBestRpc()

    // 异步模式：最多重试5次
    for (let i = 0; i < bestNodes.length; i++) {
      const nodeUrl = bestNodes[i]

      try {
        const provider = new ethers.JsonRpcProvider(nodeUrl)

        // 带超时的请求
        const result = await Promise.race([
          this._scanWithProvider(provider, walletAddress),
          this._timeout(this.timeout, `节点超时 (${this.timeout}ms)`)
        ])

        return result
      } catch (error) {
        // 标记节点失败
        await this.rpcPool.markNodeFailed(nodeUrl)

        // 如果是最后一个节点，抛出异常
        if (i === bestNodes.length - 1) {
          throw new Error('所有节点均不可用，扫描失败')
        }
      }
    }
  }

  async _scanWithProvider(provider, walletAddress) {
    // 使用provider执行扫描逻辑
    const balance = await provider.getBalance(walletAddress)
    return ethers.formatEther(balance)
  }

  _timeout(ms, message) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms)
    })
  }
}
```

## 待实现功能

- [ ] KV持久化（保存节点顺序）
- [ ] 节点健康检查（定期测试）
- [ ] 数据中台对接接口
