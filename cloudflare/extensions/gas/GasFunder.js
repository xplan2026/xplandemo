// cloudflare/extensions/gas/GasFunder.js
// Gas 费自动补充扩展
// 当被保护钱包 POL 不足以支付 Gas 费时，从 Gas 费钱包自动补充
//
// 修改记录：
// - 网络：BSC -> Polygon Amoy Testnet
// - Gas币：BNB -> POL
import { ethers } from 'ethers'

/**
 * Gas 费补充器
 * 功能：
 * - 检查被保护钱包的 POL 余额是否足够支付 Gas 费
 * - 从 Gas 费钱包自动补充不足的 POL
 * - 支持多个被保护钱包并发补充
 * - 记录补充操作日志
 */
export class GasFunder {
  constructor(env, db, options = {}) {
    this.env = env
    this.db = db
    this.workerId = options.workerId || 'unknown'

    // Gas 费配置（POL）
    this.minPolForGas = 0.001 // 单次转账需要的最小 POL（保守估计）
    this.targetPolBalance = 0.001 // 目标 POL 余额（补充到此金额，减少暴露风险）

    // Gas 补充钱包地址（不同于 SAFE_WALLET）
    this.gasFundingWallet = this.env.GAS_FUNDING_WALLET
    if (!this.gasFundingWallet) {
      throw new Error('未配置 GAS_FUNDING_WALLET 环境变量')
    }

    // 获取 Gas 补充钱包的私钥
    const privateKey = this.getPrivateKey()
    if (!privateKey) {
      throw new Error(`未找到 Gas 补充钱包 ${this.gasFundingWallet} 的私钥`)
    }

    // RPC 提供者（Polygon Amoy Testnet）
    this.provider = new ethers.JsonRpcProvider(
      this.env.POLYGON_AMOY_RPC || 'https://rpc-amoy.polygon.technology'
    )

    // 创建 Gas 补充钱包实例
    this.gasFundingWalletSigner = new ethers.Wallet(privateKey, this.provider)

    console.log(`✅ [${this.workerId}] GasFunder 初始化完成`)
    console.log(`   Gas 补充钱包: ${this.gasFundingWallet.slice(-4)}`)
    console.log(`   最小 Gas 费: ${this.minPolForGas} POL`)
    console.log(`   目标余额: ${this.targetPolBalance} POL`)
  }

  /**
   * 检查钱包是否需要补充 Gas 费
   * @param {string} walletAddress - 钱包地址
   * @returns {Promise<boolean>} 是否需要补充
   */
  async needsGasFunding(walletAddress) {
    try {
      const balance = await this.provider.getBalance(walletAddress)
      const polBalance = parseFloat(ethers.formatEther(balance))

      return polBalance < this.minPolForGas
    } catch (error) {
      console.error(`❌ 检查钱包 ${walletAddress.slice(-4)} Gas 费失败:`, error.message)
      return false
    }
  }

  /**
   * 为钱包补充 Gas 费
   * @param {string} targetWallet - 目标钱包地址
   * @returns {Promise<Object>} 补充结果
   */
  async fundGas(targetWallet) {
    const targetShort = targetWallet.slice(-4)
    const result = {
      success: false,
      hash: null,
      amount: null,
      from: this.gasFundingWallet,
      to: targetWallet
    }

    try {
      // 检查目标钱包当前余额
      const currentBalance = await this.provider.getBalance(targetWallet)
      const currentPol = parseFloat(ethers.formatEther(currentBalance))

      // 检查 Gas 补充钱包余额
      const fundingBalance = await this.provider.getBalance(this.gasFundingWallet)
      const fundingPol = parseFloat(ethers.formatEther(fundingBalance))

      // 计算需要补充的金额
      const neededAmount = this.targetPolBalance - currentPol

      if (neededAmount <= 0) {
        console.log(`ℹ️ [${this.workerId}] 钱包 ${targetShort} 余额充足，无需补充 (${currentPol} POL)`)
        result.success = true
        result.amount = '0'
        return result
      }

      if (fundingPol < neededAmount + 0.0005) {
        throw new Error(`Gas 补充钱包 POL 不足 (${fundingPol} POL)，需要 ${neededAmount.toFixed(6)} POL`)
      }

      // 获取 Gas 价格
      const gasPrice = await this.getOptimalGasPrice()
      const gasLimit = 21000n // POL 转账标准 gas limit
      const gasCost = gasPrice * gasLimit

      // 实际转账金额 = 需要补充的金额 + Gas 费（保证目标钱包收到足够的 POL）
      const transferAmount = ethers.parseUnits((neededAmount + parseFloat(ethers.formatEther(gasCost))).toFixed(18), 'ether')

      console.log(`💰 [${this.workerId}] 开始补充 Gas 费到钱包 ${targetShort}`)
      console.log(`   目标钱包当前余额: ${currentPol} POL`)
      console.log(`   计划补充金额: ${neededAmount.toFixed(6)} POL`)
      console.log(`   实际转账金额: ${ethers.formatEther(transferAmount)} POL（含 Gas 费）`)

      // 发送转账
      const tx = await this.gasFundingWalletSigner.sendTransaction({
        to: targetWallet,
        value: transferAmount,
        gasLimit,
        gasPrice
      })

      console.log(`✅ [${this.workerId}] Gas 费补充成功: ${tx.hash}`)

      // 记录补充操作
      await this._logFundingEvent({
        target_wallet: targetWallet,
        amount: ethers.formatEther(transferAmount),
        tx_hash: tx.hash,
        reason: 'gas_insufficient'
      })

      result.success = true
      result.hash = tx.hash
      result.amount = ethers.formatEther(transferAmount)

      return result
    } catch (error) {
      console.error(`❌ [${this.workerId}] 补充 Gas 费失败 [${targetShort}]:`, error.message)

      // 记录失败日志
      await this._logFundingEvent({
        target_wallet: targetWallet,
        amount: '0',
        tx_hash: null,
        reason: 'gas_insufficient',
        error: error.message
      })

      result.error = error.message
      return result
    }
  }

  /**
   * 批量补充 Gas 费
   * @param {string[]} walletAddresses - 钱包地址列表
   * @returns {Promise<Array>} 补充结果数组
   */
  async fundGasBatch(walletAddresses) {
    console.log(`🎯 [${this.workerId}] 开始批量补充 ${walletAddresses.length} 个钱包的 Gas 费`)

    const results = await Promise.allSettled(
      walletAddresses.map(wallet => this.fundGas(wallet))
    )

    return results
  }

  /**
   * 检查并补充 Gas 费（自动检测）
   * @param {string[]} walletAddresses - 钱包地址列表
   * @returns {Promise<Object>} 补充结果
   */
  async checkAndFund(walletAddresses) {
    const results = {
      checked: [],
      funded: [],
      skipped: [],
      errors: []
    }

    for (const wallet of walletAddresses) {
      try {
        const walletShort = wallet.slice(-4)
        const needsFunding = await this.needsGasFunding(wallet)

        results.checked.push(wallet)

        if (needsFunding) {
          console.log(`⚠️ [${this.workerId}] 钱包 ${walletShort} 需要 Gas 费补充`)
          const fundResult = await this.fundGas(wallet)

          if (fundResult.success) {
            results.funded.push(wallet)
          } else {
            results.errors.push({ wallet, error: fundResult.error })
          }
        } else {
          console.log(`✅ [${this.workerId}] 钱包 ${walletShort} Gas 费充足`)
          results.skipped.push(wallet)
        }
      } catch (error) {
        console.error(`❌ [${this.workerId}] 处理钱包 ${wallet.slice(-4)} 失败:`, error.message)
        results.errors.push({ wallet, error: error.message })
      }
    }

    console.log(`📊 [${this.workerId}] Gas 费补充完成:`, JSON.stringify({
      checked: results.checked.length,
      funded: results.funded.length,
      skipped: results.skipped.length,
      errors: results.errors.length
    }))

    return results
  }

  /**
   * 获取最优 Gas 价格
   */
  async getOptimalGasPrice() {
    try {
      const feeData = await this.provider.getFeeData()
      if (feeData && feeData.gasPrice) {
        // 使用当前 Gas 价格的 120%
        const gasPrice = (feeData.gasPrice * 120n) / 100n
        return gasPrice
      }
    } catch (error) {
      console.error(`[${this.workerId}] 获取 Gas 价格失败:`, error.message)
    }
    // 默认 3 gwei（BSC 常用）
    return ethers.parseUnits('3', 'gwei')
  }

  /**
   * 获取 Gas 补充钱包私钥
   */
  getPrivateKey() {
    const key = `GAS_FUNDING_WALLET_PRIVATE_KEY`
    let privateKey = this.env[key]

    if (privateKey && privateKey.startsWith('0x')) {
      privateKey = privateKey.slice(2)
    }

    // 移除私钥相关日志，避免泄露敏感信息

    return privateKey || null
  }

  /**
   * 记录 Gas 费补充事件
   */
  async _logFundingEvent(data) {
    if (!this.db.transaction) {
      return
    }

    try {
      await this.db.transaction.saveTransaction({
        worker_id: this.workerId,
        wallet_address: data.target_wallet,
        tx_hash: data.tx_hash,
        token_address: '0x0000000000000000000000000000000000000000', // POL
        amount: data.amount || '0',
        status: data.tx_hash ? 'pending' : 'failed',
        error_message: data.error || null,
        triggered_by: this.safeWallet,
        trigger_reason: data.reason,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error(`记录 Gas 费补充事件失败:`, error.message)
    }
  }
}

/**
 * 创建 Gas 费补充器实例
 */
export function createGasFunder(env, db, options = {}) {
  return new GasFunder(env, db, options)
}
