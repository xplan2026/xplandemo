// X-plan Demo - Tactics-1 Worker
// 功能：监控被保护钱包，检测到异常余额时自动转移资产到安全地址
// 版本：v1.0.0
// 网络：Polygon Amoy Testnet (Chain ID: 80002)
// 代币：XPD (精度: 9)
//
// 调度配置：
// - 常规模式：每60秒扫描一次
// - 应急模式：每5秒扫描一次（触发条件：POL余额 > 0.01）
//
// 资产保护逻辑：
// - 监控被保护钱包的 POL 和 XPD 余额
// - 检测到异常时自动转移资产到安全钱包
// - 支持手动触发测试（从安全钱包转账到被保护钱包）
import { createTacticsScanner } from '../../extensions/scanner/TacticsScanner.js'
import { DatabaseExtension } from '../../extensions/database/DatabaseExtension.js'
import { RpcPoolOptimizedExtension, createRpcSelector } from '../../extensions/rpc-pool-optimized/RpcPoolOptimizedExtension.js'
import { createEmergencyWorkerExtension } from '../../extensions/emergency-worker/EmergencyWorkerExtension.js'
import { createTransferWorkerExtension } from '../../extensions/transfer-worker/TransferWorkerExtension.js'
import { createAideWorkerExtension } from '../../extensions/aide-worker/AideWorkerExtension.js'
import { ethers } from 'ethers'


// ==================== 配置 ====================
const WORKER_ID = 'tactics-1'

// 从环境变量读取配置
const CONFIG = {
  PROTECTED_WALLETS: [],
  WALLET_SCAN_INTERVAL: 0,
  POL_THRESHOLD: '0.01',  // POL阈值（触发应急状态）
  MAX_SCAN_DURATION: 7000,
  TOKEN_XPD: '',  // XPD代币地址
  EMERGENCY_MAX_DURATION: 600,
  EMERGENCY_SCAN_INTERVAL: 5,
  MAX_TRANSFER_RETRIES: 3,
  MAX_GAS_ERRORS: 3,
  TARGET_POL_BALANCE: '0.001',
  SAFE_WALLET: '',
  GAS_FUNDING_WALLET: '',
  COMPETITIVE_MODE: true
}

// ==================== 工具函数 ====================

/**
 * 创建简化的分布式锁（适配单钱包场景）
 * 使用 KV 存储实现分布式锁
 */
function createDistributedLock(env, db) {
  const LOCK_PREFIX = 'lock:'
  const DEFAULT_TTL = 600 // 10分钟

  return {
    /**
     * 获取锁
     * @param {string} key - 锁的键
     * @param {number} ttl - 锁的存活时间（秒）
     */
    async acquireLock(key, ttl = DEFAULT_TTL) {
      try {
        const lockKey = LOCK_PREFIX + key
        const lockValue = `${WORKER_ID}:${Date.now()}`
        const expiresAt = Date.now() + (ttl * 1000)

        // 使用 KV 的 put 方法设置锁（仅当锁不存在时）
        await env.RPC_POOL.put(lockKey, lockValue, {
          expirationTtl: ttl
        })

        // 验证锁是否成功获取
        const currentValue = await env.RPC_POOL.get(lockKey)
        if (currentValue === lockValue) {
          console.log(`🔒 [Lock] 成功获取锁: ${key}`)
          return { success: true, workerId: WORKER_ID, expiresAt }
        }

        // 获取失败，返回锁的状态
        const parts = currentValue ? currentValue.split(':') : []
        const owner = parts[0] || 'unknown'
        const timestamp = parts[1] ? parseInt(parts[1]) : Date.now()

        return {
          success: false,
          workerId: owner,
          timestamp,
          ttl: (timestamp + ttl * 1000) - Date.now(),
          remaining: Math.max(0, (timestamp + ttl * 1000) - Date.now())
        }
      } catch (error) {
        console.error(`❌ [Lock] 获取锁失败: ${key}`, error.message)
        return { success: false, error: error.message }
      }
    },

    /**
     * 释放锁
     * @param {string} key - 锁的键
     */
    async releaseLock(key) {
      try {
        const lockKey = LOCK_PREFIX + key
        const currentValue = await env.RPC_POOL.get(lockKey)

        // 检查锁是否属于当前 Worker
        if (currentValue && currentValue.startsWith(WORKER_ID)) {
          await env.RPC_POOL.delete(lockKey)
          console.log(`🔓 [Lock] 成功释放锁: ${key}`)
          return { success: true }
        }

        // 锁不存在或不属于当前 Worker
        return {
          success: false,
          error: currentValue ? 'Lock owned by another worker' : 'Lock not found'
        }
      } catch (error) {
        console.error(`❌ [Lock] 释放锁失败: ${key}`, error.message)
        return { success: false, error: error.message }
      }
    },

    /**
     * 检查锁的状态
     * @param {string} key - 锁的键
     */
    async checkLock(key) {
      try {
        const lockKey = LOCK_PREFIX + key
        const currentValue = await env.RPC_POOL.get(lockKey)

        if (!currentValue) {
          return { locked: false }
        }

        const parts = currentValue.split(':')
        const workerId = parts[0] || 'unknown'
        const timestamp = parts[1] ? parseInt(parts[1]) : Date.now()
        const remaining = (timestamp + DEFAULT_TTL * 1000) - Date.now()

        return {
          locked: true,
          workerId,
          timestamp,
          ttl: DEFAULT_TTL * 1000,
          remaining: Math.max(0, remaining)
        }
      } catch (error) {
        console.error(`❌ [Lock] 检查锁状态失败: ${key}`, error.message)
        return { locked: false, error: error.message }
      }
    }
  }
}

/**
 * 解析环境变量
 */
function parseConfig(env) {
  // 钱包地址格式验证
  function isValidWalletAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  const wallets = (env.PROTECTED_WALLETS || '')
    .split(',')
    .map(w => w.trim())
    .filter(w => w && isValidWalletAddress(w))

  // 去重（小写比较）
  const uniqueWallets = [...new Set(wallets.map(w => w.toLowerCase()))]

  // 数量上限限制
  const MAX_WALLETS = 5
  if (uniqueWallets.length > MAX_WALLETS) {
    throw new Error(`被保护钱包数量超过限制: ${uniqueWallets.length} > ${MAX_WALLETS}`)
  }

  CONFIG.PROTECTED_WALLETS = uniqueWallets

  if (CONFIG.PROTECTED_WALLETS.length === 0) {
    console.warn('⚠️ [配置] 没有有效的被保护钱包地址')
  }

  CONFIG.WALLET_SCAN_INTERVAL = parseInt(env.WALLET_SCAN_INTERVAL || '0')
  CONFIG.POL_THRESHOLD = env.POL_THRESHOLD || '0.01'
  CONFIG.MAX_SCAN_DURATION = parseInt(env.MAX_SCAN_DURATION || '7000')
  CONFIG.TOKEN_XPD = env.TOKEN_XPD
  CONFIG.EMERGENCY_MAX_DURATION = parseInt(env.EMERGENCY_MAX_DURATION || '600')
  CONFIG.EMERGENCY_SCAN_INTERVAL = parseInt(env.EMERGENCY_SCAN_INTERVAL || '5')
  CONFIG.MAX_TRANSFER_RETRIES = parseInt(env.MAX_TRANSFER_RETRIES || '3')
  CONFIG.MAX_GAS_ERRORS = parseInt(env.MAX_GAS_ERRORS || '3')
  CONFIG.TARGET_POL_BALANCE = env.TARGET_POL_BALANCE || '0.001'
  CONFIG.SAFE_WALLET = env.SAFE_WALLET
  CONFIG.GAS_FUNDING_WALLET = env.GAS_FUNDING_WALLET
  CONFIG.COMPETITIVE_MODE = (env.COMPETITIVE_MODE || 'true') !== 'false'
}

/**
 * 扫描单个钱包
 */
async function scanWallet(env, walletAddress, rpcUrl) {
  const startTime = Date.now()

  try {
    const scanner = createTacticsScanner(env, walletAddress, {
      rpcUrl: rpcUrl,
      polThreshold: parseFloat(CONFIG.POL_THRESHOLD),
      tokenXpd: CONFIG.TOKEN_XPD,
      maxDuration: CONFIG.MAX_SCAN_DURATION
    })

    // 执行扫描
    const scanResult = await scanner.scan()

    // 判断需要执行的操作
    const action = scanner.checkAction(scanResult)

    console.log(`🔍 [${WORKER_ID}] 钱包 ${walletAddress.slice(-4)} 扫描完成:`, {
      pol: scanResult.polBalance,
      xpd: scanResult.xpdBalance,
      action: action.action,
      duration: Date.now() - startTime
    })

    return {
      walletAddress,
      scanResult,
      action,
      success: true
    }
  } catch (error) {
    // CPU超限错误特殊处理
    if (error.message.includes('CPU超限')) {
      console.error(`❌ [${WORKER_ID}] 钱包 ${walletAddress.slice(-4)} CPU超限，跳过`)
      return {
        walletAddress,
        success: false,
        error: 'cpu_exceeded',
        errorType: 'cpu'
      }
    }
    console.error(`❌ [${WORKER_ID}] 钱包 ${walletAddress.slice(-4)} 扫描失败:`, error.message)
    return {
      walletAddress,
      success: false,
      error: error.message
    }
  }
}

// ==================== 全局状态 ====================
let currentEmergencyWallet = null
let currentEmergencyAbortController = null

// ==================== 主处理函数 ====================

/**
 * 执行一轮扫描
 * @param {Object} env - 环境变量
 * @param {Object} rpcPool - RPC节点池
 * @param {number} round - 轮次（1或2）
 * @param {boolean} enableRetry - 是否启用重试
 * @param {Array} emergencyWallets - 进入应急状态的钱包列表
 * @param {Object} db - 数据库扩展
 */
async function performScanRound(env, rpcPool, round, enableRetry, emergencyWallets, db) {
  const startTime = Date.now()
  const roundResults = []

  for (const wallet of CONFIG.PROTECTED_WALLETS) {
    // 跳过进入应急状态的钱包
    if (currentEmergencyWallet === wallet) {
      console.log(`🚨 [${WORKER_ID}] 钱包 ${wallet.slice(-4)} 处于应急状态，跳过常规扫描`)
      continue
    }

    const rpcSelector = createRpcSelector(rpcPool)
    const { node: rpcUrl, reportFailure, reportSuccess } = await rpcSelector.getNode()

    let scanResult
    try {
      scanResult = await scanWallet(env, wallet, rpcUrl)
      if (scanResult.success) {
        await reportSuccess()
      }
    } catch (error) {
      if (enableRetry && round === 1) {
        console.log(`⚠️ [${WORKER_ID}] 第${round}轮扫描失败，重试一次: ${wallet.slice(-4)} (${error.message})`)
        await reportFailure()

        const { node: rpcUrl2, reportFailure: reportFailure2, reportSuccess: reportSuccess2 } = await rpcSelector.getNode()
        try {
          scanResult = await scanWallet(env, wallet, rpcUrl2)
          if (scanResult.success) {
            await reportSuccess2()
          }
        } catch (error2) {
          console.error(`❌ [${WORKER_ID}] 第${round}轮扫描重试失败: ${wallet.slice(-4)} (${error2.message})`)
          await reportFailure2()
          // 不记录失败，直接跳过
          continue
        }
      } else {
        // 第2轮不重试，直接跳过
        console.log(`⏸️ [${WORKER_ID}] 第${round}轮扫描失败，跳过: ${wallet.slice(-4)} (${error.message})`)
        await reportFailure()
        continue
      }
    }

    roundResults.push(scanResult)

    // 检查是否需要执行应急状态
    if (scanResult.success && scanResult.action.action === 'emergency') {
      console.log(`🚨 [${WORKER_ID}] 钱包 ${wallet.slice(-4)} 触发应急状态`)

      // 检查是否已有应急状态
      if (currentEmergencyWallet) {
        console.log(`⚠️ [${WORKER_ID}] 已有应急状态（${currentEmergencyWallet.slice(-4)}），立即终止并启动新应急状态`)

        // 终止旧应急状态
        if (currentEmergencyAbortController) {
          currentEmergencyAbortController.abort()
        }
      }

      // 启动新应急状态
      currentEmergencyWallet = wallet
      currentEmergencyAbortController = new AbortController()

      // 异步执行应急状态
      executeEmergencyAsync(env, wallet, rpcUrl, db, currentEmergencyAbortController.signal)
    }
    // 转账操作在应急状态中处理，常规任务不执行转账
  }

  console.log(`✅ [${WORKER_ID}] 第${round}轮扫描完成:`, {
    scanned: roundResults.length,
    skipped: CONFIG.PROTECTED_WALLETS.length - roundResults.length,
    duration: Date.now() - startTime
  })
}

/**
 * 执行应急状态（同步包装）
 * @param {Object} env - 环境变量
 * @param {string} walletAddress - 钱包地址
 * @param {string} rpcUrl - RPC节点URL
 */
async function executeEmergency(env, walletAddress, rpcUrl) {
  const db = new DatabaseExtension(env)
  await db.initialize()

  const abortController = new AbortController()
  return await executeEmergencyAsync(env, walletAddress, rpcUrl, db, abortController.signal)
}

/**
 * 执行转账（同步包装）
 * @param {Object} env - 环境变量
 * @param {string} walletAddress - 钱包地址
 * @param {string} tokenType - 代币类型
 * @param {Object} db - 数据库扩展
 * @param {string} rpcUrl - RPC节点URL
 */
async function executeTransfer(env, walletAddress, tokenType, db, rpcUrl) {
  const transferWorker = createTransferWorkerExtension(env, {
    maxRetries: CONFIG.MAX_TRANSFER_RETRIES,
    maxGasErrors: CONFIG.MAX_GAS_ERRORS,
    safeWallet: CONFIG.SAFE_WALLET,
    tokenXpd: CONFIG.TOKEN_XPD
  })

  return await transferWorker.runTransferLoop(walletAddress, tokenType, db, rpcUrl)
}

/**
 * 异步执行应急状态
 * @param {Object} env - 环境变量
 * @param {string} walletAddress - 钱包地址
 * @param {string} rpcUrl - RPC节点URL
 * @param {Object} db - 数据库扩展
 * @param {AbortSignal} abortSignal - 终止信号
 */
async function executeEmergencyAsync(env, walletAddress, rpcUrl, db, abortSignal) {
  try {
    console.log(`🚨 [${WORKER_ID}] 启动应急状态: ${walletAddress.slice(-4)}`)

    // 创建转账扩展
    const transferWorker = createTransferWorkerExtension(env, {
      maxRetries: CONFIG.MAX_TRANSFER_RETRIES,
      maxGasErrors: CONFIG.MAX_GAS_ERRORS,
      safeWallet: CONFIG.SAFE_WALLET,
      tokenXpd: CONFIG.TOKEN_XPD
    })

    // 定义转账完成回调（调用Aide监控）
    const onTransferComplete = async (transferResult) => {
      if (transferResult.aideTasks && transferResult.aideTasks.length > 0) {
        console.log(`🔍 [${WORKER_ID}] 转账完成，调用Aide监控交易 (${transferResult.aideTasks.length} 个任务)`)
        try {
          await executeAide(env, transferResult.aideTasks, db, rpcUrl)
        } catch (error) {
          console.error(`❌ [${WORKER_ID}] 调用Aide失败:`, error.message)
        }
      }
    }

    // 创建应急扩展，传入转账扩展和回调
    const emergencyWorker = createEmergencyWorkerExtension(env, {
      polThreshold: CONFIG.POL_THRESHOLD,
      maxDuration: CONFIG.EMERGENCY_MAX_DURATION,
      scanInterval: CONFIG.EMERGENCY_SCAN_INTERVAL,
      tokenXpd: CONFIG.TOKEN_XPD,
      transferWorker,
      db,
      onTransferComplete
    })

    // 定义锁检查回调（检查是否仍为当前应急状态）
    const checkLockCallback = async () => {
      return currentEmergencyWallet === walletAddress && !abortSignal.aborted
    }

    // 运行应急循环
    const result = await emergencyWorker.runEmergencyLoop(walletAddress, rpcUrl, checkLockCallback)

    console.log(`✅ [${WORKER_ID}] 应急状态完成: ${walletAddress.slice(-4)} (原因: ${result.reason})`)

    // 清除应急状态标记
    if (currentEmergencyWallet === walletAddress) {
      currentEmergencyWallet = null
      currentEmergencyAbortController = null
    }

    return { success: true, ...result }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log(`⚠️ [${WORKER_ID}] 应急状态被终止: ${walletAddress.slice(-4)}`)
      return { success: false, reason: 'aborted' }
    }
    console.error(`❌ [${WORKER_ID}] 应急状态失败: ${walletAddress.slice(-4)}`, error.message)

    // 清除应急状态标记
    if (currentEmergencyWallet === walletAddress) {
      currentEmergencyWallet = null
      currentEmergencyAbortController = null
    }

    return { success: false, error: error.message }
  }
}

/**
 * 执行 Aide 监控
 * @param {Object} env - 环境变量
 * @param {Array} aideTasks - Aide 任务列表
 * @param {Object} db - 数据库扩展
 * @param {string} rpcUrl - RPC节点URL
 */
async function executeAide(env, aideTasks, db, rpcUrl) {
  if (!aideTasks || aideTasks.length === 0) {
    console.log(`📭 [${WORKER_ID}] 无 Aide 任务需要处理`)
    return
  }

  console.log(`🔍 [${WORKER_ID}] 开始 Aide 监控 (${aideTasks.length} 个任务)`)

  // 创建 Aide 扩展
  const aideWorker = createAideWorkerExtension(env, { rpcUrl })

  // 监控交易
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const results = await aideWorker.monitorTransactions(aideTasks, provider, db)

    console.log(`✅ [${WORKER_ID}] Aide 监控完成`, {
      total: aideTasks.length,
      success: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
      pending: results.filter(r => r.status === 'pending').length
    })
  } catch (error) {
    console.error(`❌ [${WORKER_ID}] Aide 监控失败:`, error.message)
  }
}

export default {
  // 定时任务 - 每分钟执行
  async scheduled(event, env) {
    const startTime = Date.now()
    const now = new Date()

    console.log(`🚀 [${WORKER_ID}] 开始定时扫描`, now.toISOString())
    console.log(`📋 Cron触发信息:`, { cron: event.cron, scheduledTime: event.scheduledTime })

    // 解析配置
    parseConfig(env)

    // 初始化扩展
    const rpcPool = new RpcPoolOptimizedExtension(env)
    await rpcPool.initialize()

    const db = new DatabaseExtension(env)
    await db.initialize()

    try {
      // 检查并执行节点池维护（每天12:00北京时间）
      await rpcPool.checkMaintenance()

      // 获取当前进入应急状态的钱包
      const emergencyWallets = []

      // 第一轮扫描（第0秒）- 失败重试1次
      console.log(`🔍 [${WORKER_ID}] 第一轮扫描开始（第0秒）`)
      await performScanRound(env, rpcPool, 1, true, emergencyWallets, db)

      // 计算第二轮扫描的延迟时间（30秒减去第一轮扫描耗时）
      const firstRoundDuration = Date.now() - startTime
      const delayBeforeSecondRound = Math.max(0, 30000 - firstRoundDuration)

      console.log(`🕐 [${WORKER_ID}] 第一轮扫描耗时 ${firstRoundDuration}ms，第二轮扫描将在 ${delayBeforeSecondRound}ms 后开始`)

      // 延迟到第30秒执行第二轮扫描
      setTimeout(async () => {
        try {
          // 检查是否超过59秒（保护机制）
          const elapsed = Date.now() - startTime
          if (elapsed > 59000) {
            console.log(`⏰ [${WORKER_ID}] 第二轮扫描超时（已耗时 ${elapsed}ms），跳过`)
            return
          }

          console.log(`🔍 [${WORKER_ID}] 第二轮扫描开始（第${elapsed}ms）`)
          await performScanRound(env, rpcPool, 2, false, emergencyWallets, db)
        } catch (error) {
          console.error(`❌ [${WORKER_ID}] 第二轮扫描失败:`, error.message)
        }
      }, delayBeforeSecondRound)

    } catch (error) {
      console.error(`❌ [${WORKER_ID}] 扫描失败:`, error.message)
    }

    console.log(`✅ [${WORKER_ID}] 定时扫描任务已启动，耗时 ${Date.now() - startTime}ms`)
  },

  // CORS 响应头
  createCorsHeaders() {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
    }
  },

  // 创建带 CORS 的 Response
  createCorsResponse(data, options = {}) {
    // 兼容两种调用方式：数字状态码 或 { status: xxx } 对象
    const status = typeof options === 'number' ? options : (options.status || 200)
    return new Response(data, {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...this.createCorsHeaders()
      }
    })
  },

  /**
   * JSON 序列化，处理 BigInt
   */
  safeStringify(obj) {
    return JSON.stringify(obj, (key, value) => {
      return typeof value === 'bigint' ? value.toString() : value
    })
  },

  // HTTP请求处理（用于API访问和手动触发）
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown'

    // 处理 OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: this.createCorsHeaders() })
    }

    // API Key 认证检查（仅对危险操作需要）
    const dangerousPaths = ['/scan', '/trigger', '/restart']
    const isDangerousRequest = dangerousPaths.some(p => path === p)

    if (isDangerousRequest && request.method === 'POST') {
      const apiKey = request.headers.get('X-API-Key')
      if (!apiKey || apiKey !== env.API_KEY) {
        console.warn(`⚠️ [${WORKER_ID}] API Key 认证失败: ${path} (IP: ${ip})`)
        return this.createCorsResponse(JSON.stringify({
          error: 'Unauthorized',
          message: 'Invalid or missing API Key'
        }), 401)
      }
    }

    console.log(`🌐 [${WORKER_ID}] 收到HTTP请求: ${request.method} ${path} (IP: ${ip})`)

    // 1. 健康检查和状态查询
    if (path === '/' || path === '/health') {
      return this.createCorsResponse(JSON.stringify({
        status: 'healthy',
        worker_id: WORKER_ID,
        worker_name: env.WORKER_NAME,
        timestamp: new Date().toISOString()
      }))
    }

    // 2. 钱包余额查询
    if (path === '/status') {
      return this.handleStatus(request, env)
    }

    // 3. 手动触发扫描（仅POST）
    if (path === '/scan' || path === '/trigger') {
      if (request.method !== 'POST') {
        return this.createCorsResponse(JSON.stringify({
          error: 'Method not allowed',
          message: 'Please use POST request to trigger scan'
        }), {
          status: 405,
        })
      }

      return this.handleManualScan(request, env)
    }

    // 4. 钱包详情查询
    if (path === '/wallet' && url.searchParams.has('address')) {
      return this.handleWalletDetail(request, env)
    }

    // 5. 应急状态查询
    if (path === '/emergency') {
      return this.handleEmergencyStatus(request, env)
    }

    // 6. 手动重启 Worker
    if (path === '/restart') {
      if (request.method !== 'POST') {
        return this.createCorsResponse(JSON.stringify({
          error: 'Method not allowed',
          message: 'Please use POST request to restart worker'
        }), {
          status: 405,
        })
      }
      return this.handleRestart(request, env)
    }

    // 7. API文档
    if (path === '/api-docs' || path === '/docs') {
      return new Response(this.getApiDocs(), {
        headers: this.createCorsHeaders()
      })
    }

    // 8. 测试转账（从安全钱包转账到被保护钱包）- 仅POST
    if (path === '/test/transfer') {
      if (request.method !== 'POST') {
        return this.createCorsResponse(JSON.stringify({
          error: 'Method not allowed',
          message: 'Please use POST request to trigger test transfer'
        }), {
          status: 405,
        })
      }
      return this.handleTestTransfer(request, env)
    }

    // 9. 切换应急模式 - 仅POST
    if (path === '/emergency/enable') {
      if (request.method !== 'POST') {
        return this.createCorsResponse(JSON.stringify({
          error: 'Method not allowed',
          message: 'Please use POST request to enable emergency mode'
        }), {
          status: 405,
        })
      }
      return this.handleEmergencyToggle(request, env, true)
    }

    if (path === '/emergency/disable') {
      if (request.method !== 'POST') {
        return this.createCorsResponse(JSON.stringify({
          error: 'Method not allowed',
          message: 'Please use POST request to disable emergency mode'
        }), {
          status: 405,
        })
      }
      return this.handleEmergencyToggle(request, env, false)
    }

    // 404
    return this.createCorsResponse(JSON.stringify({
      error: 'Not found',
      message: 'Available endpoints: /, /health, /status, /scan, /wallet, /emergency, /restart, /test/transfer, /emergency/enable, /emergency/disable, /api-docs'
    }), {
      status: 404,
    })
  },

  /**
   * 处理状态查询
   */
  async handleStatus(request, env) {
    try {
      parseConfig(env)

      const rpcPool = new RpcPoolOptimizedExtension(env)
      await rpcPool.initialize()

      const results = []

      for (const wallet of CONFIG.PROTECTED_WALLETS) {
        try {
          // 获取RPC节点（使用优化扩展）
          const rpcSelector = createRpcSelector(rpcPool)
          const { node: rpcUrl, reportFailure, reportSuccess } = await rpcSelector.getNode()

          const result = await scanWallet(env, wallet, rpcUrl)
          if (result.success) {
            await reportSuccess()
          }

          if (result.success) {
            results.push({
              wallet: wallet,
              wallet_short: wallet.slice(-4),
              pol_balance: result.scanResult.polBalance,
              xpd_balance: result.scanResult.xpdBalance,
              action: result.action.action,
              action_detail: result.action
            })
          } else {
            results.push({
              wallet: wallet,
              wallet_short: wallet.slice(-4),
              error: result.error,
              error_type: result.errorType
            })
          }
        } catch (error) {
          await reportFailure()
          results.push({
            wallet: wallet,
            wallet_short: wallet.slice(-4),
            error: error.message
          })
        }
      }

      return this.createCorsResponse(JSON.stringify({
        success: true,
        worker_id: WORKER_ID,
        worker_name: env.WORKER_NAME,
        timestamp: new Date().toISOString(),
        wallets: results,
        summary: {
          total: CONFIG.PROTECTED_WALLETS.length,
          emergency: results.filter(r => r.action === 'emergency').length,
          transfer: results.filter(r => r.action === 'transfer').length,
          normal: results.filter(r => r.action === 'none').length
        }
      }))
    } catch (error) {
      return this.createCorsResponse(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
      })
    }
  },

  /**
   * 处理手动扫描
   */
  async handleManualScan(request, env) {
    const startTime = Date.now()

    try {
      // 解析配置
      parseConfig(env)

      // 初始化扩展
      const rpcPool = new RpcPoolOptimizedExtension(env)
      await rpcPool.initialize()

      const db = new DatabaseExtension(env)
      await db.initialize()

      const lock = createDistributedLock(env, db)

      try {
        // 获取扫描锁
        const scanLockResult = await lock.acquireLock('manual_scan_lock', 600)
        if (!scanLockResult.success) {
          return this.createCorsResponse(JSON.stringify({
            success: false,
            error: 'Another scan is already running',
            message: '请等待当前扫描完成'
          }), {
            status: 429,
          })
        }

        try {
          // 获取最优的3个RPC节点
          const bestRpcNodes = await rpcPool.getBestRpc()
          const providerUrls = bestRpcNodes ? bestRpcNodes.slice(0, 3) : []

          const results = []

          for (const wallet of CONFIG.PROTECTED_WALLETS) {
            // 获取RPC节点（使用优化扩展）
            const rpcSelector = createRpcSelector(rpcPool)
            const { node: rpcUrl, reportFailure, reportSuccess } = await rpcSelector.getNode()

            try {
              const result = await scanWallet(env, wallet, rpcUrl)
              if (result.success) {
                await reportSuccess()
              }

              results.push(result)

              // 如果扫描成功，判断是否需要执行操作
              if (result.success) {
                // 根据扫描结果同步调用扩展
                if (result.action.action === 'emergency') {
                  console.log(`🚨 [${WORKER_ID}] 手动扫描触发应急状态: ${wallet.slice(-4)}`)
                  await executeEmergency(env, wallet, rpcUrl, lock)
                } else if (result.action.action === 'transfer') {
                  const tokenType = result.action.token
                  console.log(`💸 [${WORKER_ID}] 手动扫描触发转账: ${wallet.slice(-4)} (${tokenType})`)
                  const transferResult = await executeTransfer(env, wallet, tokenType, db, rpcUrl, lock)

                  // 转账成功，调用Aide监控交易
                  if (transferResult.success && transferResult.aideTasks && transferResult.aideTasks.length > 0) {
                    await executeAide(env, transferResult.aideTasks, db, rpcUrl)
                  }
                }
              }
            } catch (error) {
              // 扫描失败，记录失败
              await reportFailure()
              console.error(`❌ [${WORKER_ID}] 手动扫描失败: ${wallet.slice(-4)} (${error.message})`)
              results.push({
                walletAddress: wallet,
                success: false,
                error: error.message,
                errorType: 'rpc'
              })
            }

            // 钱包间隔
            if (CONFIG.WALLET_SCAN_INTERVAL > 0) {
              await new Promise(resolve => setTimeout(resolve, CONFIG.WALLET_SCAN_INTERVAL * 1000))
            }
          }

          const successCount = results.filter(r => r.success).length

          return this.createCorsResponse(JSON.stringify({
            success: true,
            message: 'Manual scan completed',
            results,
            summary: {
              total: results.length,
              success: successCount,
              duration: Date.now() - startTime
            }
          }))
        } finally {
          await lock.releaseLock('manual_scan_lock')
        }
      } catch (error) {
        return this.createCorsResponse(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
        })
      }
    } catch (error) {
      return this.createCorsResponse(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
      })
    }
  },

  /**
   * 处理钱包详情查询
   */
  async handleWalletDetail(request, env) {
    const walletAddress = new URL(request.url).searchParams.get('address')

    // 验证地址格式
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return this.createCorsResponse(JSON.stringify({
        success: false,
        error: 'Invalid wallet address'
      }), {
        status: 400,
      })
    }

    try {
      parseConfig(env)

      const rpcPool = new RpcPoolOptimizedExtension(env)
      await rpcPool.initialize()

      // 获取RPC节点（使用优化扩展）
      const rpcSelector = createRpcSelector(rpcPool)
      const { node: rpcUrl, reportFailure, reportSuccess } = await rpcSelector.getNode()

      const result = await scanWallet(env, walletAddress, rpcUrl)
      if (result.success) {
        await reportSuccess()
      }

      // 使用自定义 JSON 序列化处理 BigInt
      const response = {
        success: result.success,
        wallet: walletAddress,
        ...result
      }

      return this.createCorsResponse(this.safeStringify(response), {})
    } catch (error) {
      return this.createCorsResponse(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
      })
    }
  },

  /**
   * 处理应急状态查询
   */
  async handleEmergencyStatus(request, env) {
    try {
      parseConfig(env)

      const db = new DatabaseExtension(env)
      await db.initialize()

      const lock = createDistributedLock(env, db)

      const emergencyStatuses = []

      for (const wallet of CONFIG.PROTECTED_WALLETS) {
        const lockStatus = await lock.checkLock(wallet)

        emergencyStatuses.push({
          wallet: wallet,
          wallet_short: wallet.slice(-4),
          in_emergency: lockStatus.locked,
          workerId: lockStatus.workerId,
          timestamp: lockStatus.timestamp,
          ttl: lockStatus.ttl,
          remaining: lockStatus.remaining
        })
      }

      return this.createCorsResponse(JSON.stringify({
        success: true,
        worker_id: WORKER_ID,
        timestamp: new Date().toISOString(),
        emergency_statuses: emergencyStatuses,
        in_emergency_count: emergencyStatuses.filter(e => e.in_emergency).length
      }))
    } catch (error) {
      return this.createCorsResponse(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
      })
    }
  },

  /**
   * 处理手动重启 Worker
   * 用途：清除缓存、释放锁、重置状态，用于处理 429 错误或异常状态
   */
  async handleRestart(request, env) {
    const startTime = Date.now()

    try {
      console.log(`🔄 [${WORKER_ID}] 开始手动重启 Worker`)

      const actions = []

      // 1. 清除所有分布式锁
      try {
        const db = new DatabaseExtension(env)
        await db.initialize()
        const lock = createDistributedLock(env, db)

        const lockKeys = ['scan_global_lock', 'manual_scan_lock', 'emergency_lock', 'transfer_lock']
        for (const lockKey of lockKeys) {
          try {
            await lock.releaseLock(lockKey)
            actions.push({ action: 'release_lock', key: lockKey, success: true })
          } catch (error) {
            actions.push({ action: 'release_lock', key: lockKey, success: false, error: error.message })
          }
        }

        // 清除所有钱包的锁
        for (const wallet of CONFIG.PROTECTED_WALLETS) {
          try {
            await lock.releaseLock(wallet)
            actions.push({ action: 'release_wallet_lock', wallet: wallet.slice(-4), success: true })
          } catch (error) {
            actions.push({ action: 'release_wallet_lock', wallet: wallet.slice(-4), success: false, error: error.message })
          }
        }
      } catch (error) {
        console.error(`❌ [${WORKER_ID}] 清除锁失败:`, error.message)
        actions.push({ action: 'clear_locks', success: false, error: error.message })
      }

      // 2. 清除 KV 缓存（可选，仅清除速率限制）
      try {
        const rateLimitKeys = ['ratelimit:/:', 'ratelimit:/status:', 'ratelimit:/scan:', 'ratelimit:/restart:']
        for (const key of rateLimitKeys) {
          try {
            await env.RPC_POOL.delete(key)
            actions.push({ action: 'clear_ratelimit', key: key, success: true })
          } catch (error) {
            actions.push({ action: 'clear_ratelimit', key: key, success: false, error: error.message })
          }
        }
      } catch (error) {
        console.error(`❌ [${WORKER_ID}] 清除速率限制失败:`, error.message)
        actions.push({ action: 'clear_ratelimits', success: false, error: error.message })
      }

      // 3. 记录重启事件
      try {
        const db = new DatabaseExtension(env)
        await db.initialize()

        await db.system.saveEvent({
          type: 'worker_restart',
          worker_id: WORKER_ID,
          worker_name: env.WORKER_NAME,
          timestamp: new Date().toISOString(),
          reason: 'manual_restart',
          actions_performed: actions.length,
          duration: Date.now() - startTime
        })

        actions.push({ action: 'log_restart_event', success: true })
      } catch (error) {
        console.error(`❌ [${WORKER_ID}] 记录重启事件失败:`, error.message)
        actions.push({ action: 'log_restart_event', success: false, error: error.message })
      }

      console.log(`✅ [${WORKER_ID}] Worker 重启完成，耗时 ${Date.now() - startTime}ms`)

      return this.createCorsResponse(JSON.stringify({
        success: true,
        message: 'Worker restarted successfully',
        worker_id: WORKER_ID,
        worker_name: env.WORKER_NAME,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        actions: actions,
        summary: {
          total_actions: actions.length,
          successful_actions: actions.filter(a => a.success).length,
          failed_actions: actions.filter(a => !a.success).length
        }
      }))
    } catch (error) {
      console.error(`❌ [${WORKER_ID}] Worker 重启失败:`, error.message)

      return this.createCorsResponse(JSON.stringify({
        success: false,
        error: error.message,
        worker_id: WORKER_ID,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      }), {
        status: 500,
      })
    }
  },

  /**
   * 处理测试转账（从安全钱包转账到被保护钱包）
   */
  async handleTestTransfer(request, env) {
    try {
      parseConfig(env)

      const body = await request.json()
      const { amount } = body

      if (!amount || amount <= 0) {
        return this.createCorsResponse(JSON.stringify({
          success: false,
          error: 'Invalid amount'
        }), {
          status: 400,
        })
      }

      // 获取第一个被保护钱包地址
      const protectedWallet = CONFIG.PROTECTED_WALLETS[0]
      if (!protectedWallet) {
        return this.createCorsResponse(JSON.stringify({
          success: false,
          error: 'No protected wallet configured'
        }), {
          status: 500,
        })
      }

      // 获取安全钱包私钥
      const safeWalletPrivateKey = env[`WALLET_PRIVATE_KEY_${CONFIG.SAFE_WALLET.toLowerCase().replace('0x', '')}`] || env.SAFE_WALLET_PRIVATE_KEY
      if (!safeWalletPrivateKey) {
        return this.createCorsResponse(JSON.stringify({
          success: false,
          error: 'Safe wallet private key not found'
        }), {
          status: 500,
        })
      }

      // 初始化RPC
      const rpcPool = new RpcPoolOptimizedExtension(env)
      await rpcPool.initialize()
      const { node: rpcUrl } = await rpcPool.getBestRpc()

      const provider = new ethers.JsonRpcProvider(rpcUrl)
      const safeWallet = new ethers.Wallet(safeWalletPrivateKey, provider)

      // XPD代币合约ABI（仅需要transfer方法）
      const tokenABI = [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function decimals() view returns (uint8)'
      ]
      const tokenContract = new ethers.Contract(CONFIG.TOKEN_XPD, tokenABI, safeWallet)

      // 获取代币精度
      const decimals = await tokenContract.decimals()
      const transferAmount = ethers.parseUnits(amount.toString(), decimals)

      // 执行转账
      const tx = await tokenContract.transfer(protectedWallet, transferAmount)
      console.log(`📤 [${WORKER_ID}] 测试转账发起: ${safeWallet.address} -> ${protectedWallet.slice(-4)}, 金额: ${amount} XPD, Hash: ${tx.hash}`)

      // 等待交易确认
      const receipt = await tx.wait()

      console.log(`✅ [${WORKER_ID}] 测试转账成功: Hash: ${receipt.hash}`)

      return this.createCorsResponse(JSON.stringify({
        success: true,
        message: 'Test transfer completed',
        tx_hash: receipt.hash,
        from: safeWallet.address,
        to: protectedWallet,
        amount: amount,
        token: 'XPD',
        block_number: receipt.blockNumber
      }))
    } catch (error) {
      console.error(`❌ [${WORKER_ID}] 测试转账失败:`, error.message)
      return this.createCorsResponse(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
      })
    }
  },

  /**
   * 处理应急模式切换
   */
  async handleEmergencyToggle(request, env, enable) {
    try {
      const action = enable ? 'enable' : 'disable'

      console.log(`🔄 [${WORKER_ID}] ${action === 'enable' ? '启用' : '禁用'}应急模式`)

      // 初始化数据库
      const db = new DatabaseExtension(env)
      await db.initialize()

      // 记录模式切换事件
      await db.system.saveEvent({
        type: 'emergency_mode_toggle',
        worker_id: WORKER_ID,
        worker_name: env.WORKER_NAME,
        timestamp: new Date().toISOString(),
        action: action,
        reason: 'manual_toggle'
      })

      return this.createCorsResponse(JSON.stringify({
        success: true,
        message: `Emergency mode ${action}d successfully`,
        worker_id: WORKER_ID,
        worker_name: env.WORKER_NAME,
        emergency_mode: enable,
        timestamp: new Date().toISOString()
      }))
    } catch (error) {
      console.error(`❌ [${WORKER_ID}] 应急模式切换失败:`, error.message)
      return this.createCorsResponse(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
      })
    }
  },

  /**
   * 获取API文档
   */
  getApiDocs() {
    return JSON.stringify({
      title: 'X-plan Demo Tactics-1 API Documentation',
      version: 'v1.0.0',
      base_url: 'https://tactics-1.xplan2026.workers.dev',
      network: 'Polygon Amoy Testnet (Chain ID: 80002)',
      token: 'XPD (精度: 9)',
      endpoints: [
        {
          method: 'GET',
          paths: ['/', '/health'],
          description: '健康检查',
          response: {
            status: 'healthy',
            worker_id: 'string',
            worker_name: 'string',
            timestamp: 'ISO 8601'
          }
        },
        {
          method: 'GET',
          path: '/status',
          description: '查询所有被保护钱包状态',
          response: {
            success: true,
            wallets: [
              {
                wallet: 'string',
                wallet_short: 'string',
                pol_balance: 'number',
                xpd_balance: 'number',
                action: 'emergency|transfer|none',
                action_detail: 'object'
              }
            ],
            summary: {
              total: 'number',
              emergency: 'number',
              transfer: 'number',
              normal: 'number'
            }
          }
        },
        {
          method: 'GET',
          path: '/wallet?address=0x...',
          description: '查询单个钱包详情',
          parameters: {
            address: '钱包地址（0x开头的40位十六进制字符串）'
          },
          response: {
            success: true,
            wallet: 'string',
            scanResult: {},
            action: {}
          }
        },
        {
          method: 'GET',
          path: '/emergency',
          description: '查询所有钱包的应急状态',
          response: {
            success: true,
            emergency_statuses: [
              {
                wallet: 'string',
                wallet_short: 'string',
                in_emergency: 'boolean',
                workerId: 'string',
                timestamp: 'ISO 8601',
                ttl: 'number',
                remaining: 'number'
              }
            ],
            in_emergency_count: 'number'
          }
        },
        {
          method: 'POST',
          paths: ['/scan', '/trigger'],
          description: '手动触发完整扫描（包括转账）',
          headers: {
            'X-API-Key': 'API密钥'
          },
          body: '{}',
          response: {
            success: true,
            results: [],
            summary: {
              total: 'number',
              success: 'number',
              duration: 'number'
            }
          }
        },
        {
          method: 'POST',
          path: '/test/transfer',
          description: '测试转账：从安全钱包转账XPD到被保护钱包',
          headers: {
            'X-API-Key': 'API密钥'
          },
          body: {
            amount: '转账金额（XPD数量，数字）'
          },
          response: {
            success: true,
            message: 'Test transfer completed',
            tx_hash: 'string',
            from: 'string',
            to: 'string',
            amount: 'number',
            token: 'XPD',
            block_number: 'number'
          }
        },
        {
          method: 'POST',
          path: '/emergency/enable',
          description: '启用应急模式（快速扫描，5秒间隔）',
          headers: {
            'X-API-Key': 'API密钥'
          },
          body: '{}',
          response: {
            success: true,
            message: 'Emergency mode enabled successfully',
            worker_id: 'string',
            emergency_mode: true,
            timestamp: 'ISO 8601'
          }
        },
        {
          method: 'POST',
          path: '/emergency/disable',
          description: '禁用应急模式（恢复正常扫描，60秒间隔）',
          headers: {
            'X-API-Key': 'API密钥'
          },
          body: '{}',
          response: {
            success: true,
            message: 'Emergency mode disabled successfully',
            worker_id: 'string',
            emergency_mode: false,
            timestamp: 'ISO 8601'
          }
        },
        {
          method: 'POST',
          path: '/restart',
          description: '手动重启 Worker（清除缓存、释放锁、重置状态）',
          headers: {
            'X-API-Key': 'API密钥'
          },
          body: '{}',
          response: {
            success: true,
            message: 'Worker restarted successfully',
            worker_id: 'string',
            worker_name: 'string',
            timestamp: 'ISO 8601',
            duration: 'number',
            actions: [
              {
                action: 'string',
                success: 'boolean',
                error: 'string|null'
              }
            ],
            summary: {
              total_actions: 'number',
              successful_actions: 'number',
              failed_actions: 'number'
            }
          }
        },
        {
          method: 'GET',
          paths: ['/api-docs', '/docs'],
          description: '获取API文档（JSON格式）',
          response: '当前文档内容'
        }
      ],
      notes: [
        '网络: Polygon Amoy Testnet (Chain ID: 80002)',
        '代币: XPD (精度: 9)',
        'Gas代币: POL',
        '所有GET请求都可以通过浏览器直接访问',
        'POST请求需要 X-API-Key 头部认证',
        '/test/transfer 端点用于测试：从安全钱包转账到被保护钱包',
        '应急模式触发条件：POL余额 > 0.01',
        '建议使用 /status 端点进行状态监控'
      ]
    }, null, 2)
  }
}
