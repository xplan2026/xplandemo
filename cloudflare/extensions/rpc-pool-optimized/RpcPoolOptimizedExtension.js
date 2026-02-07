// cloudflare/extensions/rpc-pool-optimized/RpcPoolOptimizedExtension.js
// RPC节点池扩展 - v2.4.0（简化版）
// 功能：
// 1. 维护5个可用的RPC节点池
// 2. 每个任务随机选择一个节点
// 3. 失败时记录日志（不持久化）
// 4. 定期手动测试可用性（使用 test-rpc-connectivity.js）

import { DEFAULT_NODES, DEFAULT_CONFIG } from './config.js'

/**
 * RPC节点池扩展（简化版）
 */
export class RpcPoolOptimizedExtension {
  constructor(env) {
    this.env = env
    this.config = DEFAULT_CONFIG

    // 优先从环境变量读取节点列表，否则使用默认节点
    let nodes = DEFAULT_NODES
    if (env && env.BSC_RPC_NODES) {
      nodes = env.BSC_RPC_NODES.split(',').map(url => url.trim()).filter(url => url)
    }

    this.nodePool = [...nodes]
    this._initialized = false
  }

  /**
   * 初始化节点池
   */
  async initialize() {
    if (this._initialized) {
      return
    }

    this._initialized = true
    console.log(`✅ [RpcPoolOptimized] 节点池初始化完成，共 ${this.nodePool.length} 个节点`)
    this.nodePool.forEach((url, index) => {
      console.log(`   ${index + 1}. ${url}`)
    })
  }

  /**
   * 获取随机节点（每个任务独立选择）
   */
  async getRandomNode() {
    if (this.nodePool.length === 0) {
      throw new Error('节点池为空')
    }

    const randomIndex = Math.floor(Math.random() * this.nodePool.length)
    const selectedNode = this.nodePool[randomIndex]

    console.log(`🔌 [RpcPoolOptimized] 随机选择节点 [${randomIndex + 1}/${this.nodePool.length}]: ${selectedNode}`)

    return selectedNode
  }

  /**
   * 记录节点失败（仅记录日志，不持久化）
   */
  async recordNodeFailure(nodeUrl) {
    console.error(`❌ [RpcPoolOptimized] 节点请求失败: ${nodeUrl}`)
    // 不再记录到KV，定期使用脚本手动测试可用性
  }

  /**
   * 检查并执行节点池维护（已禁用）
   * 说明：使用 test-rpc-connectivity.js 脚本手动测试
   */
  async checkMaintenance() {
    // 不再自动维护，使用测试脚本手动验证节点可用性
    return
  }

  /**
   * 导出当前配置
   */
  exportConfig() {
    return {
      nodePool: [...this.nodePool],
      timestamp: Date.now()
    }
  }

  /**
   * 获取统计信息
   */
  async getStats() {
    return {
      poolSize: this.nodePool.length,
      totalNodes: DEFAULT_NODES.length,
      initialized: this._initialized
    }
  }
}

/**
 * 创建RPC节点选择器（简化版）
 */
export function createRpcSelector(rpcPool) {
  return {
    /**
     * 获取节点（简化版，无重试逻辑）
     */
    async getNode() {
      const node = await rpcPool.getRandomNode()

      return {
        node,
        async reportFailure() {
          await rpcPool.recordNodeFailure(node)
        },
        async reportSuccess() {
          // 成功时不做任何操作
        }
      }
    }
  }
}
