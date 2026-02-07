# KV存储配置指南

本文档说明如何为RPC Pool Extension配置Cloudflare KV存储。

## 为什么需要KV存储？

- ✅ **持久化节点顺序**：Worker重启后恢复上次的节点排序
- ✅ **全局一致性**：多个Worker实例共享相同的节点状态
- ✅ **自动优化**：失败的节点持续保持在队尾，无需重新学习

## 配置步骤

### 1. 创建KV命名空间

```bash
# 创建生产环境KV命名空间
npx wrangler kv:namespace create "RPC_POOL"

# 创建预览环境KV命名空间
npx wrangler kv:namespace create "RPC_POOL" --preview
```

执行后会输出类似：

```json
{ "binding": "RPC_POOL", "id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
```

### 2. 配置wrangler.toml

在Worker项目的 `wrangler.toml` 中添加KV绑定：

```toml
[[kv_namespaces]]
binding = "RPC_POOL"
id = "生产环境KV_ID"
preview_id = "预览环境KV_ID"
```

**示例：**

```toml
name = "guard-plus-worker"
account_id = "your-account-id"

main = "src/index.js"
compatibility_date = "2025-01-15"

# KV命名空间绑定
[[kv_namespaces]]
binding = "RPC_POOL"
id = "5928af543d66410f92a76ad853d60d99"
preview_id = "1ffd1fbbadb54d6ba4d35afabe0c9376"

[vars]
BSC_RPC_NODES = "https://bsc-rpc.publicnode.com"
```

### 3. 在代码中使用

在Worker代码中初始化RPC Pool：

```javascript
import { RpcPoolExtension } from './extensions/rpc-pool/index.js'

export default {
  async fetch(request, env, ctx) {
    // 创建节点池实例
    const rpcPool = new RpcPoolExtension(env)

    // 初始化（从KV加载节点顺序）
    await rpcPool.initialize()

    // 使用节点池
    const bestNodes = await rpcPool.getBestRpc()
    // ...

    return new Response('OK')
  }
}
```

## KV存储机制

### 存储内容

KV中存储一个JSON对象：

```json
{
  "nodes": [
    "https://bsc-rpc.publicnode.com",
    "https://bsc-dataseed1.binance.org/",
    ...
  ],
  "updatedAt": 1705372800000
}
```

### 存储键

- 键名：`rpc_node_order`
- TTL：24小时（自动过期）

### 自动保存时机

以下操作会自动保存到KV：

1. 添加节点 (`addNode`)
2. 移除节点 (`removeNode`)
3. 标记节点失败 (`markNodeFailed`)
4. 导入配置 (`importConfig`)

### 自动加载时机

- Worker启动时调用 `initialize()` 自动从KV加载
- 如果KV中无数据，使用默认节点列表并保存

## 降级处理

如果未配置KV命名空间：

```javascript
// 未配置KV时的日志
⚠️ 未配置KV命名空间 (env.RPC_POOL)，使用内存存储
```

- ✅ 节点池功能正常工作
- ✅ 所有API方法可用
- ❌ Worker重启后节点顺序重置
- ❌ 多实例节点顺序不一致

## 手动操作

### 手动保存到KV

```javascript
await rpcPool.saveToKV()
```

### 手动从KV重新加载

```javascript
await rpcPool.loadFromKV()
```

### 查看KV内容

```bash
# 列出KV中的所有键
npx wrangler kv:key list --binding=RPC_POOL

# 获取特定键的值
npx wrangler kv:key get "rpc_node_order" --binding=RPC_POOL

# 删除特定键
npx wrangler kv:key delete "rpc_node_order" --binding=RPC_POOL
```

## 监控和调试

### 查看节点池状态

```javascript
const stats = await rpcPool.getStats()
console.log(stats)
// 输出:
// {
//   totalNodes: 11,
//   bestNodeCount: 5,
//   timeout: 7000,
//   hasKV: true,
//   initialized: true
// }
```

### 重置节点顺序

如果需要重置节点顺序：

```bash
# 方法1: 删除KV中的数据
npx wrangler kv:key delete "rpc_node_order" --binding=RPC_POOL

# 方法2: 在代码中重置
await rpcPool.importConfig({ nodes: DEFAULT_NODES })
```

## 常见问题

### Q: 为什么节点顺序没有持久化？

A: 检查以下几点：
1. 是否在wrangler.toml中配置了KV绑定？
2. 是否调用了 `await rpcPool.initialize()`？
3. KV命名空间ID是否正确？

### Q: 多个Worker实例会互相影响吗？

A: 不会。每个Worker实例独立运行，KV只是共享存储。节点顺序在KV中，所有实例读取的是同一份数据。

### Q: KV数据会过期吗？

A: 会。TTL设置为24小时，过期后下次初始化时会使用默认节点列表并重新保存。

### Q: 如何备份节点配置？

A: 使用 `exportConfig()` 导出：

```javascript
const config = rpcPool.exportConfig()
// config 包含: { nodes: [...], config: {...}, timestamp: ... }
```

## 成本说明

Cloudflare KV免费额度：

| 操作 | 免费额度 |
|------|---------|
| 读取 | 100,000 次/天 |
| 写入 | 1,000 次/天 |
| 存储 | 1 GB |

RPC Pool的KV使用量：

- 写入：每次节点变更时1次（很少）
- 读取：Worker启动时1次/次
- 存储：约1 KB

**结论**：完全在免费额度范围内。
