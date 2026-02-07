// cloudflare/extensions/rpc-pool-optimized/config.js
// RPC节点池优化扩展配置

/**
 * 默认的BSC RPC节点列表
 * 来源：多个公共BSC RPC节点
 */
export const DEFAULT_NODES = [
  'https://bsc-rpc.publicnode.com',
  'https://bsc-dataseed1.binance.org/',
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

/**
 * 默认配置
 */
export const DEFAULT_CONFIG = {
  // 节点池大小（前N个最优节点）
  POOL_SIZE: 6,

  // 节点请求超时（毫秒）
  TIMEOUT: 7000,

  // 节点失败最大重试次数
  MAX_RETRIES: 2,

  // 节点维护时间（北京时间，小时）
  MAINTENANCE_HOUR: 12
}
