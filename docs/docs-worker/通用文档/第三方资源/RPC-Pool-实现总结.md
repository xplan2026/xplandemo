# RPC Pool 扩展实现总结

## 完成时间
2025-01-16

## 需求背景

为了避免单IP定时轮询BSC RPC节点被标记进黑名单，需要实现节点池轮换功能。

## 核心设计

### 1. 优化策略（简化版）
- ❌ 无需统计指标（成功次数、响应时间等）
- ❌ 无需复杂权重计算
- ✅ **简单排序规则**：失败 → 移到队尾
- ✅ **N次轮询后**：性能差的节点自然排在后面
- ✅ **人工管理**：查看列表，手动删除差节点

### 2. 超时与重试
- **超时时间**：7秒（原guard-plus/项目为3秒，已修改为7秒）
- **失败处理**：立即切换到下一个节点
- **重试次数**：
  - 异步模式（Promise.all）：最多5次
  - 单步模式：最多3次
- **全部失败**：抛出异常，终止当前任务

### 3. 接口设计

```javascript
class RpcPoolExtension {
  constructor(env)
  async getBestRpc()              // 返回前5个节点
  async getNodeList()             // 获取完整节点列表
  async addNode(nodeUrl)           // 添加节点
  async removeNode(nodeUrl)        // 移除节点
  async markNodeFailed(nodeUrl)    // 标记失败，移到队尾
  exportConfig()                  // 导出配置
  importConfig(config)            // 导入配置
  getStats()                      // 获取统计信息
}
```

## 文件结构

```
cloudflare/
├── extensions/rpc-pool/
│   ├── index.js                    # 主入口
│   ├── RpcPoolExtension.js         # 核心实现（4.06 KB）
│   ├── config.js                   # 默认配置
│   ├── README.md                   # 扩展文档
│   ├── example-scanner.js          # 集成示例（6.92 KB）
│   └── test.js                     # 单元测试
├── docs/
│   └── 开发计划.md                 # 开发计划
├── README.md                       # 项目说明
└── docs/RPC-Pool-实现总结.md       # 本文件
```

## 默认节点列表

```javascript
[
  'https://bsc-rpc.publicnode.com',          // PublicNode
  'https://bsc-dataseed1.binance.org/',     // 官方节点
  'https://bsc-dataseed2.binance.org/',
  'https://bsc-dataseed3.binance.org/',
  'https://bsc-dataseed4.binance.org/',
  'https://bsc-dataseed1.ninicoin.io/',
  'https://bsc-dataseed2.ninicoin.io/',
  'https://bsc-dataseed3.ninicoin.io/',
  'https://bsc-dataseed1.defibit.io/',
  'https://bsc-dataseed2.defibit.io/',
  'https://bsc-dataseed3.defibit.io/'
]
```

## 使用方式（工厂模式）

```javascript
import { RpcPoolExtension } from './extensions/rpc-pool/index.js'

class Scanner {
  constructor(env) {
    this.rpcPool = new RpcPoolExtension(env)
    this.timeout = 7000
  }

  async scan(walletAddress) {
    const bestNodes = await this.rpcPool.getBestRpc()

    for (let i = 0; i < bestNodes.length; i++) {
      const nodeUrl = bestNodes[i]
      try {
        const provider = new ethers.JsonRpcProvider(nodeUrl)
        const result = await Promise.race([
          this._scanWithProvider(provider, walletAddress),
          this._timeout(this.timeout)
        ])
        return result
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

## 已完成的修改

### 1. guard-plus项目超时时间修改

**文件**: `guard-plus/guard-plus-worker/src/lib/scanner.js`
- 第17行：`timeout = 3000` → `timeout = 7000`

**文件**: `guard-plus/guard-plus-worker/src/api/scan.js`
- 第68行：`await scanner.scan(walletAddress, 3000)` → `await scanner.scan(walletAddress, 7000)`

**原因**: 3秒超时太短，容易造成阻塞失败

### 2. cloudflare-worker目录
- **未修改**（需先获得授权）
- 在 `example-scanner.js` 中已标注改造说明

## 核心功能实现

### 1. 节点池初始化
- 优先从环境变量 `BSC_RPC_NODES` 加载
- 否则使用默认节点列表
- 创建数组副本，避免修改原数组

### 2. 智能轮换
- 节点失败后，自动移到队尾
- 无需统计响应时间、成功率等指标
- 通过多次轮询，性能差的自然沉淀

### 3. 动态管理
- 支持运行时添加节点（`addNode`）
- 支持运行时移除节点（`removeNode`）
- 支持配置导出/导入（`exportConfig`/`importConfig`）

### 4. 预留接口
- `getNodeList()` - 供数据中台查询节点状态
- `exportConfig`/`importConfig` - 供数据中台管理节点配置

## 测试

已提供单元测试文件 `test.js`，包含10个测试用例：

1. 基本初始化
2. 从环境变量加载
3. 获取最优节点
4. 获取节点列表
5. 添加节点
6. 添加重复节点
7. 标记节点失败（移到队尾）
8. 移除节点
9. 配置导出/导入
10. 空环境变量处理

## 文档

- ✅ `README.md` - 扩展功能文档
- ✅ `example-scanner.js` - 集成示例（含代码对比）
- ✅ `test.js` - 单元测试
- ✅ `cloudflare/README.md` - 项目结构说明
- ✅ `cloudflare/docs/开发计划.md` - 整体开发计划

## 下一步计划

### 1. 集成到guard-plus-worker
- [ ] 修改 `scanner.js` 使用RpcPoolExtension
- [ ] 测试部署
- [ ] 验证节点轮换功能

### 2. 项目重构
- [ ] 创建 `cloudflare/worker1/` 目录
- [ ] 迁移 `guard-plus/guard-plus-worker/` 代码
- [ ] 更新部署脚本
- [ ] 更新文档

### 3. 集成到cloudflare-worker（需授权）
- [ ] 获得用户授权
- [ ] 立即提交commit
- [ ] 修改scanner文件
- [ ] 测试部署

### 4. 持久化（可选）
- [ ] 使用Cloudflare KV存储节点顺序
- [ ] 重启后恢复节点排序状态

## 技术要点

### 1. 简单胜于复杂
- 不使用权重算法
- 不记录统计数据
- 仅通过排序实现优化

### 2. 失败处理
- 唯一错误类型：7秒超时
- 失败节点自动移到队尾
- 全部失败抛出异常

### 3. 工厂模式
- 提供最优节点列表（而非单个节点）
- 由调用者决定如何使用节点
- 灵活性更高

### 4. 预留接口
- `getNodeList()` 返回排序后的完整列表
- 数据中台可据此实现自动化管理

## 注意事项

1. **cloudflare-worker/ 目录**：独立部署，暂不修改
2. **guard-plus/ 目录**：主项目，已修改超时时间
3. **无状态设计**：Worker重启后节点顺序重置（如需持久化，使用KV）
4. **超时统一**：所有节点统一7秒超时

## 参考资料

- [BSC RPC节点高频访问保护策略](../../docs/BSC_RPC节点高频访问保护策略.md)
- [开发计划.md](开发计划.md)
- [Cloudflare Workers官方文档](https://developers.cloudflare.com/workers/)
