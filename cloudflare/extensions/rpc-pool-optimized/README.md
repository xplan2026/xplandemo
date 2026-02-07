# RPC节点池扩展

BSC RPC节点池管理扩展，提供随机节点选择和连通性测试功能。

## 目录结构

```
rpc-pool-optimized/
├── config.js                     # 节点配置文件
├── RpcPoolOptimizedExtension.js   # 节点池扩展实现
├── test-rpc-connectivity.js       # 节点连通性测试脚本
└── README.md                     # 本文档
```

## 功能特性

- ✅ 随机节点选择（每个任务独立选择）
- ✅ 简单的初始化流程
- ✅ 失败日志记录
- ✅ 节点连通性测试脚本
- ❌ 无复杂的排名逻辑
- ❌ 无KV持久化
- ❌ 无自动维护

## 当前可用节点（5个）

| 排名 | 节点地址 | 平均延迟 | 测试日期 |
|------|----------|----------|----------|
| 1 | bsc-dataseed2.defibit.io | 540ms | 2026-02-02 |
| 2 | bsc-dataseed2.ninicoin.io | 580ms | 2026-02-02 |
| 3 | bsc-dataseed3.ninicoin.io | 590ms | 2026-02-02 |
| 4 | bsc-dataseed3.defibit.io | 580ms | 2026-02-02 |
| 5 | bsc-rpc.publicnode.com | 610ms | 2026-02-02 |

> 测试详情：详见 `/workspace/docs/V2/RPC节点接通率测试-2026-02-02.md`

## 使用方法

### 1. 在Worker中使用

```javascript
import { RpcPoolOptimizedExtension, createRpcSelector } from '../extensions/rpc-pool-optimized/RpcPoolOptimizedExtension.js'

// 初始化节点池
const rpcPool = new RpcPoolOptimizedExtension(env)
await rpcPool.initialize()

// 创建选择器并获取节点
const rpcSelector = createRpcSelector(rpcPool)
const { node: rpcUrl, reportFailure, reportSuccess } = await rpcSelector.getNode()

// 使用节点
try {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1
    })
  })
  await reportSuccess()  // 报告成功
} catch (error) {
  await reportFailure()  // 报告失败
}
```

### 2. 测试节点连通性

```bash
cd /workspace/cloudflare/extensions/rpc-pool-optimized
node test-rpc-connectivity.js
```

测试脚本会：
- 对所有节点轮流测试（默认5轮 × 2组）
- 显示每个节点的成功率和延迟
- 给出最终的排名报告

### 3. 修改节点配置

编辑 `config.js` 文件：

```javascript
export const DEFAULT_NODES = [
  'https://bsc-dataseed2.defibit.io',
  'https://bsc-dataseed2.ninicoin.io',
  'https://bsc-dataseed3.ninicoin.io',
  'https://bsc-dataseed3.defibit.io',
  'https://bsc-rpc.publicnode.com'
]
```

## API文档

### RpcPoolOptimizedExtension

#### `constructor(env)`
创建节点池实例

- `env`: Cloudflare Worker 环境对象

#### `async initialize()`
初始化节点池

#### `async getRandomNode()`
获取随机节点

- 返回: `string` - 节点URL

#### `async recordNodeFailure(nodeUrl)`
记录节点失败（仅记录日志）

- `nodeUrl`: 失败的节点URL

#### `async checkMaintenance()`
检查并执行节点池维护（已禁用）

#### `exportConfig()`
导出当前配置

- 返回: `Object` - 配置对象

#### `async getStats()`
获取统计信息

- 返回: `Object` - 统计信息

### createRpcSelector(rpcPool)

创建RPC节点选择器

#### `async getNode()`
获取节点（带报告机制）

- 返回: `Object`
  - `node`: 节点URL
  - `reportFailure()`: 报告失败的函数
  - `reportSuccess()`: 报告成功的函数

## 测试脚本说明

### 配置

```javascript
const CONFIG = {
  timeout: 5000,        // 单次请求超时（毫秒）
  rounds: 5,            // 每组轮数
  groupCount: 2,        // 组数（5+5）
  groupInterval: 10000, // 组间间隔（毫秒）
  maxRetries: 1         // 失败重试次数
}
```

### 输出示例

```
📊 成功率排名（共 11 个节点，每组 5 轮 × 2 组 = 10 次测试）
┌────┬─────────────────────────────┬───────────┬──────────┬─────────────┬────────────┐
│排名│ 节点地址                    │ 成功率    │ 成功/总数 │ 平均延迟   │ 失败次数   │
├────┼─────────────────────────────┼───────────┼──────────┼─────────────┼────────────┤
│ 🥇│ bsc-rpc.publicnode.com      │  100.0%   │  10/10   │     312ms   │       0    │
...
```

## 维护指南

### 定期测试节点

建议每周运行一次测试脚本，验证节点可用性：

```bash
node test-rpc-connectivity.js
```

### 更新节点列表

根据测试结果，更新 `config.js` 中的 `DEFAULT_NODES`：
- 删除不可用节点
- 添加新的可用节点

### 查看测试历史

测试报告保存在 `/workspace/docs/V2/` 目录下：
- `RPC节点接通率测试-2026-02-02.md`

## 版本历史

### v2.4.0 (2026-02-02)
- 简化代码逻辑，移除KV持久化
- 移除节点排名和维护机制
- 保留5个可用节点
- 删除 `rpc-pool` 和 `transaction-checker` 扩展
- 添加测试脚本到扩展目录

### v2.3.0
- 创建 `RpcPoolOptimizedExtension`
- 支持KV持久化失败记录
- 每天自动维护节点池

### v2.0
- 创建 `RpcPoolExtension`
- 支持节点轮换机制
