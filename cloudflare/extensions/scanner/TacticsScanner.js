// cloudflare/extensions/scanner/TacticsScanner.js
// 战术扫描器 - 每个实例对应一个被保护钱包地址（常量）
// 功能：
// 1. 扫描指定钱包的POL、XPD余额
// 2. 当XPD>0时，立即执行转账
// 3. 当POL余额>0.001时，触发应急状态（写入KV）
//
// 修改记录：
// - 网络：BSC -> Polygon Amoy Testnet
// - Gas币：BNB -> POL
// - 资产代币：wkeyDAO -> XPD
// - 删除：USDT 相关逻辑
import { ethers } from 'ethers'

export class TacticsScanner {
  constructor(env, walletAddress, options = {}) {
    this.env = env
    // 钱包地址作为常量
    this.walletAddress = walletAddress
    this.walletShort = walletAddress.slice(-4)
    this.workerId = options.workerId || `scanner-${this.walletShort}`

    // RPC 提供者（Polygon Amoy Testnet）
    const providerUrls = options.providers || [
      options.rpcUrl || env.POLYGON_AMOY_RPC || 'https://rpc-amoy.polygon.technology',
      'https://rpc.ankr.com/polygon_amoy',
      'https://polygon-amoy.blockpi.network/v1/rpc/public'
    ]
    this.providers = [...providerUrls]
    this._shuffleProviders()
    this.rpcUrl = this._getProviderUrl()

    // 代币配置（XPD 代币）
    this.xpdToken = env.TOKEN_XPD || '0x35774A4E1fFEee74Fa3859F89cfae00b3aC8C3A8'

    // 代币精度（XPD 精度为 9）
    this.xpdDecimals = parseInt(env.TOKEN_XPD_DECIMALS || '9')

    // POL阈值
    this.polThreshold = parseFloat(env.POL_THRESHOLD || '0.001')

    // 缓存 Provider（复用优化）
    this._cachedProvider = null
    this._cachedProviderUrl = null

    console.log(`🔧 [${this.workerId}] 初始化完成，钱包: ${this.walletAddress}, RPC数量: ${this.providers.length}`)
  }

  /**
   * Fisher-Yates 洗牌算法，随机打乱provider数组
   */
  _shuffleProviders() {
    for (let i = this.providers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.providers[i], this.providers[j]] = [this.providers[j], this.providers[i]]
    }
  }

  /**
   * 获取随机provider URL
   */
  _getProviderUrl() {
    return this.providers[0] || 'https://bsc-rpc.publicnode.com'
  }

  /**
   * 获取或创建Provider（复用优化）
   */
  _getProvider(url = null) {
    const targetUrl = url || this._getProviderUrl()

    // 复用已有Provider
    if (this._cachedProvider && this._cachedProviderUrl === targetUrl) {
      return this._cachedProvider
    }

    // 创建新Provider
    this._cachedProvider = new ethers.JsonRpcProvider(targetUrl)
    this._cachedProviderUrl = targetUrl
    return this._cachedProvider
  }

  /**
   * 获取BNB余额（带重试）
   */
  async getBalanceWithRetry(walletAddress) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const provider = this._getProvider()
        const balance = await provider.getBalance(walletAddress)
        return balance
      } catch (error) {
        console.warn(`[${this.workerId}] BNB余额查询失败（第${attempt + 1}次）:`, error.message)

        // 失败后切换到下一个 provider
        if (attempt === 0) {
          const failedUrl = this.providers.shift()
          this.providers.push(failedUrl) // 失败的节点移到队尾
          console.warn(`[${this.workerId}] 切换到备用RPC节点`)
        }

        if (attempt === 1) {
          throw new Error(`BNB余额查询失败（重试后仍失败）: ${error.message}`)
        }
      }
    }
  }

  /**
   * 获取ERC20余额（带重试）
   */
  async getERC20WithRetry(tokenAddress) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const provider = this._getProvider()
        const contract = new ethers.Contract(tokenAddress, [
          "function balanceOf(address) view returns (uint256)"
        ], provider)
        const balance = await contract.balanceOf(this.walletAddress)
        return balance
      } catch (error) {
        console.warn(`[${this.workerId}] ERC20余额查询失败（第${attempt + 1}次）:`, error.message)

        // 失败后切换到下一个 provider
        if (attempt === 0) {
          const failedUrl = this.providers.shift()
          this.providers.push(failedUrl) // 失败的节点移到队尾
          console.warn(`[${this.workerId}] 切换到备用RPC节点`)
        }

        if (attempt === 1) {
          return 0n
        }
      }
    }
    return 0n
  }

  /**
   * 扫描钱包余额
   * @returns {Promise<Object>} 扫描结果
   */
  async scan() {
    try {
      console.log(`🔍 [${this.workerId}] 开始扫描...`)

      // 并行查询BNB、wkeyDAO和USDT余额，添加6秒超时保护
      const scanPromise = Promise.all([
        this.getBalanceWithRetry(this.walletAddress),
        this.getERC20WithRetry(this.wkeyDaoToken),
        this.getERC20WithRetry(this.usdtToken)
      ])

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('扫描超时')), 6000)
      )

      // 使用Promise.race，但包装scanPromise以正确处理错误
      const safeScanPromise = scanPromise.catch(err => ({
        _error: true,
        error: err
      }))

      const result = await Promise.race([safeScanPromise, timeoutPromise])

      // 检查是否有错误
      if (result._error) {
        throw result.error
      }

      const [bnbBalance, wkeyDaoBalance, usdtBalance] = result

      const bnbFormatted = ethers.formatEther(bnbBalance)
      const wkeyDaoFormatted = ethers.formatUnits(wkeyDaoBalance, 18)
      const usdtFormatted = ethers.formatUnits(usdtBalance, 18)

      console.log(`📊 [${this.workerId}] 扫描结果:`, {
        BNB: bnbFormatted,
        wkeyDAO: wkeyDaoFormatted,
        USDT: usdtFormatted
      })

      return {
        wallet: this.walletAddress,
        walletShort: this.walletShort,
        bnbBalance: bnbFormatted,
        wkeyDaoBalance: wkeyDaoFormatted,
        usdtBalance: usdtFormatted,
        bnbBalanceRaw: bnbBalance,
        wkeyDaoBalanceRaw: wkeyDaoBalance,
        usdtBalanceRaw: usdtBalance
      }
    } catch (error) {
      // CPU超限错误特殊处理
      if (error.message.includes('exceededCpu')) {
        console.error(`❌ [${this.workerId}] CPU超限，跳过扫描:`, error.message)
        throw new Error(`CPU超限: ${error.message}`)
      }
      console.error(`❌ [${this.workerId}] 扫描失败:`, error.message)
      throw error
    }
  }

  /**
   * 检查是否需要执行转账或触发应急状态
   * @param {Object} scanResult - 扫描结果
   * @returns {Object} { action: string, reason: string, token?: string }
   */
  checkAction(scanResult) {
    const wkeyDaoBalance = parseFloat(scanResult.wkeyDaoBalance || '0')
    const usdtBalance = parseFloat(scanResult.usdtBalance || '0')
    const bnbBalance = parseFloat(scanResult.bnbBalance || '0')

    // 规则1: wkeyDAO>0，立即转账
    if (wkeyDaoBalance > 0) {
      console.log(`💰 [${this.workerId}] 检测到wkeyDAO余额>0，触发转账: ${wkeyDaoBalance}`)
      return {
        action: 'transfer',
        token: 'wkeydao',
        reason: 'wkeydao_balance_gt_zero'
      }
    }

    // 规则2: USDT>0，立即转账
    if (usdtBalance > 0) {
      console.log(`💰 [${this.workerId}] 检测到USDT余额>0，触发转账: ${usdtBalance}`)
      return {
        action: 'transfer',
        token: 'usdt',
        reason: 'usdt_balance_gt_zero'
      }
    }

    // 规则3: BNB>0.001，触发应急状态
    if (bnbBalance > this.bnbThreshold) {
      console.log(`🚨 [${this.workerId}] 检测到BNB余额>${this.bnbThreshold}，触发应急状态`)
      return {
        action: 'emergency',
        reason: 'bnb_balance_exceeds_threshold'
      }
    }

    // 无需行动
    return {
      action: 'none',
      reason: null
    }
  }

}

/**
 * 创建战术扫描器实例
 */
export function createTacticsScanner(env, walletAddress, options = {}) {
  return new TacticsScanner(env, walletAddress, options)
}
