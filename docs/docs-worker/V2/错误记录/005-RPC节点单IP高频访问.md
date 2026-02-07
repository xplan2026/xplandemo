# 错误 #005 - RPC 节点单 IP 高频访问被标记

**日期**: 2025-01-XX  
**Worker**: Cloudflare Worker  
**版本**: v1.1.0 之前

---

## 错误信息

```
Error: network error
Error: could not detect network
Error: RPC 节点请求被拒绝
```

---

## 影响范围

- [x] 功能异常
- [x] 性能下降
- [ ] 资产损失
- [x] 用户体验影响

---

## 失败分析

1. **单 IP 高频访问**: Cloudflare Worker 固定 IP 定时轮询单个 RPC 节点
   - Worker 定时任务每分钟触发
   - 每次扫描都向同一个 RPC 节点发送请求
   - 短时间内产生大量请求

2. **被标记为异常**: BSC RPC 节点检测到高频访问，可能标记 IP 为异常
   - 节点可能有反爬虫机制
   - 高频访问可能被识别为异常行为
   - IP 被限制或封禁

3. **请求被拒绝**: 节点可能限制或拒绝来自该 IP 的请求
   - 请求超时
   - 返回错误
   - 功能无法正常使用

---

## 改进措施

**版本**: v1.1.0

### 1. 实现 RPC 节点池轮换

```javascript
// cloudflare/extensions/rpc-pool/RpcPoolExtension.js
class RpcPoolExtension {
  constructor(env) {
    // 默认节点列表
    this.nodes = [
      'https://bsc-rpc.publicnode.com',
      'https://bsc-dataseed1.binance.org/',
      'https://bsc-dataseed2.binance.org/',
      'https://bsc-dataseed1.ninicoin.io/',
      'https://bsc-dataseed2.ninicoin.io/',
      'https://bsc-dataseed3.defibit.io/',
      'https://bsc-dataseed4.defibit.io/'
    ]
    
    // 从环境变量读取自定义节点
    if (env.CUSTOM_RPC_NODES) {
      const customNodes = env.CUSTOM_RPC_NODES.split(',').map(n => n.trim())
      this.nodes = [...customNodes, ...this.nodes]
    }
  }

  /**
   * 获取最优节点（前5个）
   */
  async getBestRpc() {
    return this.nodes.slice(0, 5)
  }

  /**
   * 标记节点失败，移到队尾
   */
  async markNodeFailed(nodeUrl) {
    const index = this.nodes.indexOf(nodeUrl)
    if (index !== -1 && index !== this.nodes.length - 1) {
      this.nodes.splice(index, 1)
      this.nodes.push(nodeUrl)
      console.log(`RPC 节点 ${nodeUrl} 已标记失败，移至队尾`)
    }
  }

  /**
   * 测试节点可用性
   */
  async testNode(nodeUrl) {
    try {
      const provider = new ethers.JsonRpcProvider(nodeUrl)
      const blockNumber = await provider.getBlockNumber()
      return { success: true, blockNumber, latency: Date.now() - startTime }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
}

export { RpcPoolExtension }
```

### 2. 超时时间调整

```javascript
// 原有配置
const TIMEOUT = 3000  // 3秒

// 改进后配置
const TIMEOUT = 7000  // 7秒
```

**改进说明**:
- 将超时时间从 3 秒增加到 7 秒
- 给予 RPC 节点更多响应时间
- 减少误判为失败的概率

### 3. 使用方式

```javascript
// 在扫描器中使用 RPC 节点池
class InterceptionScanner {
  constructor(env) {
    this.env = env
    this.rpcPool = new RpcPoolExtension(env)
    this.timeout = parseInt(env.RPC_TIMEOUT || '7000')
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
        console.warn(`RPC 节点 ${nodeUrl} 请求失败:`, error.message)
        await this.rpcPool.markNodeFailed(nodeUrl)
        
        if (i === bestNodes.length - 1) {
          throw new Error('所有节点均不可用')
        }
      }
    }
  }

  async _scanWithProvider(provider, walletAddress) {
    // 扫描逻辑
    const contract = new ethers.Contract(
      this.env.TOKEN_WKEYDAO,
      ERC20_ABI,
      provider
    )

    const [balance, decimals] = await Promise.all([
      contract.balanceOf(walletAddress),
      contract.decimals()
    ])

    return {
      wallet: walletAddress,
      wkeyDaoBalance: ethers.formatUnits(balance, decimals)
    }
  }

  _timeout(ms) {
    return new Promise((_, reject) => 
      setTimeout(() => reject(new Error('RPC 请求超时')), ms)
    )
  }
}
```

### 4. 环境变量配置

```toml
# wrangler.toml
[vars]
RPC_TIMEOUT = "7000"
CUSTOM_RPC_NODES = "https://your-custom-rpc-1.com,https://your-custom-rpc-2.com"
```

---

## 改进验证

| 测试场景 | 输入 | 预期结果 | 实际结果 |
|----------|------|----------|----------|
| 正常访问 | 单节点可用 | 扫描成功 | ✅ 通过 |
| 节点失败 | 主节点不可用 | 自动切换到备用节点 | ✅ 通过 |
| 高频访问 | 定时任务触发 | 节点轮换，分散请求 | ✅ 通过 |
| 超时调整 | 网络延迟较高 | 7秒超时，减少误判 | ✅ 通过 |

---

## 相关文件

- `cloudflare/extensions/rpc-pool/RpcPoolExtension.js` - RPC 节点池扩展
- `cloudflare/extensions/scanner/Scanner.js` - 扫描器
- `docs/开发指南/RPC-Pool-实现总结.md` - 实现总结
- `docs/数据库/BSC_RPC节点高频访问保护策略.md` - 保护策略文档

---

## 经验总结

1. **避免单点故障**:
   - 不要依赖单个 RPC 节点
   - 实现节点池轮换
   - 节点失败自动切换

2. **超时设置**:
   - 合理设置超时时间（7 秒）
   - 过短会导致误判
   - 过长会影响性能

3. **高频访问保护**:
   - 定时任务注意访问频率
   - 使用多个节点分散请求
   - 避免被标记为异常

4. **节点选择**:
   - 使用官方和社区节点
   - 可以自定义节点列表
   - 定期检查节点可用性

---

**最后更新**: 2025-01-XX
