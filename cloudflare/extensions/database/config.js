// cloudflare/extensions/database/config.js
// 数据库扩展配置文件

export const config = {
  // 写入延迟配置（分钟）
  // worker-1: 立即写入（应急任务）
  // worker-2: 延迟1分钟
  // worker-3: 延迟2分钟
  writeDelays: {
    'worker-1-interception': 0,
    'worker-2-interception': 1,
    'worker-3-surveillance': 2
  },

  // 缓存 TTL 配置（秒）
  cacheTTL: {
    whitelist: 300,      // 白名单缓存5分钟
    rpcNodes: 600,       // RPC节点缓存10分钟
    systemConfig: 600    // 系统配置缓存10分钟
  },

  // 重试配置
  retry: {
    maxRetries: 3,
    retryInterval: 5000  // 5秒
  },

  // 表清理阈值
  cleanThresholds: {
    transactions: 1000,
    errors: 1000,
    authNonce: 1000
  },

  // 数量限制
  limits: {
    protectedWallets: 3,
    hackerWallets: 10,
    contracts: 5,
    rpcNodes: 50
  }
};
