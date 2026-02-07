// cloudflare/extensions/transfer/Transfer.js
// 转账管理器
// 版本：v2.4.0-dev -> X-plan Demo
// 策略：所有POL作为Gas费，先发制人锁定资产，让盗币者无Gas费可用
//
// 修改记录：
// - 网络：BSC -> Polygon Amoy Testnet
// - Gas币：BNB -> POL
// - 资产代币：wkeyDAO -> XPD
// - 删除：USDT 相关逻辑
import { ethers } from 'ethers'

export class TransferManager {
  constructor(env, options = {}) {
    this.env = env
    this.workerId = options.workerId || 'TransferManager'
    this.safeWallet = env.SAFE_WALLET
    this.gasWallet = env.GAS_WALLET // POL Gas费钱包
    this.xpdToken = env.TOKEN_XPD || '0x35774A4E1fFEee74Fa3859F89cfae00b3aC8C3A8'
    this.xpdDecimals = parseInt(env.TOKEN_XPD_DECIMALS || '9')
    this.provider = new ethers.JsonRpcProvider(env.POLYGON_AMOY_RPC || 'https://rpc-amoy.polygon.technology')

    // 验证安全钱包地址格式
    if (!this.safeWallet || !/^0x[a-fA-F0-9]{40}$/.test(this.safeWallet)) {
      throw new Error(`无效的 SAFE_WALLET 配置`)
    }

    // 地址黑名单（防止转入已知恶意的地址）
    this.blockedAddresses = ['0x0000000000000000000000000000000000000001']
    if (this.blockedAddresses.includes(this.safeWallet.toLowerCase())) {
      throw new Error('SAFE_WALLET 在黑名单中')
    }
  }

  getPrivateKey(walletAddress) {
    const privateKey = this.env[`WALLET_PRIVATE_KEY_${walletAddress}`]

    // 移除私钥访问日志，避免泄露敏感信息

    // 验证私钥格式
    if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
      throw new Error(`无效的私钥格式: ${walletAddress.slice(-4)}`)
    }

    return privateKey
  }

  getWallet(walletAddress) {
    const privateKey = this.getPrivateKey(walletAddress)
    if (!privateKey) throw new Error(`未找到钱包 ${walletAddress.slice(-4)} 的私钥`)
    return new ethers.Wallet(privateKey, this.provider)
  }

  async emergencyTransfer(walletAddress) {
    const wallet = this.getWallet(walletAddress)
    const result = { success: true, wkeyDao: null, usdt: null, bnb: null }

    try {
      const transfers = []

      // 获取BNB余额
      const bnbBalance = await this.provider.getBalance(wallet)
      const bnbFloat = parseFloat(ethers.formatEther(bnbBalance))

      console.log(`🚀 [${this.workerId}] ${walletAddress.slice(-4)} BNB余额: ${bnbFloat.toFixed(6)} BNB`)

      // wkeyDAO
      const wkeyDaoBalance = await this.getERC20Balance(this.tokenWkeyDao, walletAddress)
      if (wkeyDaoBalance > 0n) {
        transfers.push(this.transferERC20(wallet, this.tokenWkeyDao, wkeyDaoBalance, bnbBalance))
      }

      // USDT
      const usdtBalance = await this.getERC20Balance(this.tokenUsdt, walletAddress)
      if (usdtBalance > 0n) {
        transfers.push(this.transferERC20(wallet, this.tokenUsdt, usdtBalance, bnbBalance))
      }

      // BNB：如果余额超过阈值，也一起转账
      if (bnbBalance > 200000000000000n) { // > 0.0002 BNB
        console.log(`💎 [${this.workerId}] ${walletAddress.slice(-4)} BNB余额充足，准备转账BNB`)
        transfers.push(this.transferBNB(wallet, bnbBalance))
      } else {
        console.log(`⚔️ [${this.workerId}] ${walletAddress.slice(-4)} BNB余额 (${bnbFloat.toFixed(6)}) 仅用于Gas费，盗币者将无Gas费可用`)
      }

      // 串行执行转账（避免BNB转账与ERC20转账的Gas竞争）
      let hasFailures = false
      if (transfers.length > 0) {
        for (const transfer of transfers) {
          try {
            const txResult = await transfer
            if (txResult.tokenType === 'wkeydao') result.wkeyDao = txResult
            else if (txResult.tokenType === 'usdt') result.usdt = txResult
            else if (txResult.tokenType === 'bnb') result.bnb = txResult
          } catch (error) {
            console.error(`❌ [${this.workerId}] 转账失败:`, error.message)
            hasFailures = true
          }
        }
      }

      result.success = !hasFailures
      result.partialFailure = hasFailures
      return result
    } catch (error) {
      result.success = false
      result.error = error.message
      return result
    }
  }

  async transferERC20(wallet, tokenAddress, amount, totalBnbBalance) {
    const contract = new ethers.Contract(tokenAddress, [
      "function balanceOf(address) view returns (uint256)",
      "function transfer(address, uint256) returns (bool)"
    ], wallet)

    const tokenType = tokenAddress.toLowerCase() === this.tokenWkeyDao.toLowerCase() ? 'wkeydao' : 'usdt'

    // 使用所有BNB作为Gas费：简单直接，先发制人
    let gasOverrides = {}
    if (totalBnbBalance > 0n) {
      try {
        // 估算Gas Limit
        const estimatedGas = await contract.transfer.estimateGas(this.safeWallet, amount, { from: wallet.address })
        const safeEstimatedGas = estimatedGas > 0n ? estimatedGas : 65000n

        // 计算最大可用Gas Price（全部BNB余额 / 估算Gas）
        // 移除基础Gas Price下限，无论余额多少都使用全部BNB
        const calculatedGasPrice = totalBnbBalance / safeEstimatedGas

        gasOverrides = {
          gasLimit: safeEstimatedGas,
          gasPrice: calculatedGasPrice
        }

        console.log(`⚔️ [${this.workerId}] 先发制人Gas配置:`)
        console.log(`   代币: ${tokenType}`)
        console.log(`   总BNB余额: ${ethers.formatEther(totalBnbBalance)} BNB`)
        console.log(`   Gas Price: ${ethers.formatUnits(gasOverrides.gasPrice, 'gwei')} gwei`)
        console.log(`   Gas Limit: ${gasOverrides.gasLimit}`)
        console.log(`   预估Gas费: ${ethers.formatEther(gasOverrides.gasPrice * gasOverrides.gasLimit)} BNB`)
      } catch (error) {
        console.error(`⚠️ [${this.workerId}] Gas配置失败，使用默认设置:`, error.message)
      }
    }

    const tx = await contract.transfer(this.safeWallet, amount, gasOverrides)

    // 添加交易确认超时保护（20秒）
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('交易确认超时')), 20 * 1000)
    })

    let receipt
    try {
      receipt = await Promise.race([tx.wait(), timeoutPromise])
    } catch (error) {
      if (error.message.includes('超时')) {
        // 交易已提交，需要异步监控
        console.log(`⏱️ [${this.workerId}] 交易提交成功但未在90秒内确认: ${tx.hash}`)
        return {
          tokenType,
          hash: tx.hash,
          amount: ethers.formatUnits(amount, 18),
          status: 'pending'
        }
      }
      throw error
    }

    // 验证交易状态
    if (receipt.status !== 1) {
      throw new Error(`转账交易失败: ${tx.hash}`)
    }

    return {
      tokenType,
      hash: tx.hash,
      amount: ethers.formatUnits(amount, 18),
      success: true
    }
  }

  async transferBNB(wallet, amount) {
    // 配置Gas参数（与ERC20转账保持一致的Gas策略）
    const gasOverrides = {
      gasLimit: 21000n
    }

    try {
      const feeData = await this.provider.getFeeData()
      gasOverrides.gasPrice = feeData.gasPrice || 5000000000n

      console.log(`⚔️ [${this.workerId}] BNB转账Gas配置:`)
      console.log(`   Gas Price: ${ethers.formatUnits(gasOverrides.gasPrice, 'gwei')} gwei`)
      console.log(`   Gas Limit: ${gasOverrides.gasLimit}`)
      console.log(`   预估Gas费: ${ethers.formatEther(gasOverrides.gasPrice * gasOverrides.gasLimit)} BNB`)
      console.log(`   转账金额: ${ethers.formatEther(amount)} BNB`)
    } catch (error) {
      console.error(`⚠️ [${this.workerId}] 获取Gas费失败:`, error.message)
    }

    const tx = await wallet.sendTransaction({ to: this.safeWallet, value: amount, ...gasOverrides })

    // 添加超时保护（20秒）
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('BNB转账确认超时')), 20 * 1000)
    })

    try {
      await Promise.race([tx.wait(), timeoutPromise])
      return { tokenType: 'bnb', hash: tx.hash, amount: ethers.formatEther(amount) }
    } catch (error) {
      if (error.message.includes('超时')) {
        return {
          tokenType: 'bnb',
          hash: tx.hash,
          amount: ethers.formatEther(amount),
          status: 'pending'
        }
      }
      throw error
    }
  }

  async getERC20Balance(tokenAddress, walletAddress) {
    const contract = new ethers.Contract(tokenAddress, [
      "function balanceOf(address) view returns (uint256)"
    ], this.provider)
    return await contract.balanceOf(walletAddress)
  }
}
