// cloudflare/extensions/transfer-worker/TransferWorkerExtension.js
// Transfer Worker Extension: 转账扩展函数
// 功能：作为扩展函数被scan调用，执行转账循环
// 版本：v2.4.0-dev
import { TransferManager } from '../transfer/Transfer.js'
import { createTacticsScanner } from '../scanner/TacticsScanner.js'
import { ethers } from 'ethers'

/**
 * 创建Transfer Worker扩展
 */
export function createTransferWorkerExtension(env, options = {}) {
  const {
    maxRetries = 3,
    safeWallet,
    tokenWkeyDao,
    tokenUsdt,
    bnbTransferThreshold = '0.0002', // BNB转账阈值降低为0.0002
    maxGasErrors = 3 // 连续Gas不足错误次数上限
  } = options

  /**
   * 检查钱包是否已清空
   * 阈值统一为：BNB <= 0.0002
   */
  async function checkWalletEmpty(env, walletAddress, rpcUrl) {
    const scanner = createTacticsScanner(env, {
      walletAddress,
      rpcUrl,
      bnbThreshold: parseFloat(bnbTransferThreshold),
      tokenWkeyDao,
      tokenUsdt,
      maxDuration: 7000
    })

    const scanResult = await scanner.scan()

    const isWalletEmpty = scanResult.wkeyDaoBalance === 0 &&
                          scanResult.usdtBalance === 0 &&
                          scanResult.bnbBalance <= parseFloat(bnbTransferThreshold)

    return {
      isWalletEmpty,
      scanResult
    }
  }

  /**
   * 执行转账
   * 返回: { success: boolean, result: object, walletEmpty: boolean, isGasError: boolean, gasFundTriggered: boolean, retryCount: number }
   */
  async function executeTransfer(walletAddress, tokenType, db, rpcUrl, retryCount = 0) {
    console.log(`💸 [TransferWorker] 开始执行转账: ${walletAddress.slice(-4)} (代币: ${tokenType}, 重试: ${retryCount}/${maxRetries})`)

    try {
      // 创建provider用于检查余额
      const provider = new ethers.JsonRpcProvider(rpcUrl)

      // 检查钱包余额
      const balance = await provider.getBalance(walletAddress)
      const currentBnb = parseFloat(ethers.formatEther(balance))

      console.log(`💰 [TransferWorker] 钱包 ${walletAddress.slice(-4)} BNB余额: ${currentBnb}`)

      // 创建TransferManager
      const transferManager = new TransferManager({
        ...env,
        SAFE_WALLET: safeWallet,
        TOKEN_WKEYDAO: tokenWkeyDao,
        TOKEN_USDT: tokenUsdt
      }, { workerId: 'TransferWorker' })

      // 执行转账
      const result = await transferManager.emergencyTransfer(walletAddress)

      console.log(`✅ [TransferWorker] 转账完成: ${walletAddress.slice(-4)}`, result)

      // 保存交易记录并写入Aide队列
      const aideTasks = []

      if (result.wkeyDao?.hash) {
        await db.transaction.saveTransaction({
          txHash: result.wkeyDao.hash,
          fromAddress: walletAddress,
          toAddress: safeWallet,
          tokenType: 'wkeydao',
          amount: result.wkeyDao.amount || '0',
          status: 'submitted',
          workerId: 'TransferWorker'
        })

        aideTasks.push({
          txHash: result.wkeyDao.hash,
          walletAddress,
          tokenType: 'wkeydao'
        })
      }

      if (result.bnb?.hash) {
        await db.transaction.saveTransaction({
          txHash: result.bnb.hash,
          fromAddress: walletAddress,
          toAddress: safeWallet,
          tokenType: 'bnb',
          amount: result.bnb.amount || '0',
          status: 'submitted',
          workerId: 'TransferWorker'
        })

        aideTasks.push({
          txHash: result.bnb.hash,
          walletAddress,
          tokenType: 'bnb'
        })
      }

      if (result.usdt?.hash) {
        await db.transaction.saveTransaction({
          txHash: result.usdt.hash,
          fromAddress: walletAddress,
          toAddress: safeWallet,
          tokenType: 'usdt',
          amount: result.usdt.amount || '0',
          status: 'submitted',
          workerId: 'TransferWorker'
        })

        aideTasks.push({
          txHash: result.usdt.hash,
          walletAddress,
          tokenType: 'usdt'
        })
      }

      // 检查钱包是否已清空
      const { isWalletEmpty } = await checkWalletEmpty(env, walletAddress, rpcUrl)

      if (isWalletEmpty) {
        console.log(`🎉 [TransferWorker] 钱包 ${walletAddress.slice(-4)} 已清空，及时退出`)
      }

      return {
        success: true,
        result,
        walletEmpty: isWalletEmpty,
        aideTasks
      }
    } catch (error) {
      console.error(`❌ [TransferWorker] 转账失败: ${walletAddress.slice(-4)}`, error.message)

      // 检查是否是Gas不足错误
      const isGasError = error.message.toLowerCase().includes('insufficient funds') ||
                         error.message.toLowerCase().includes('gas') ||
                         error.message.toLowerCase().includes('exceeds balance')

      if (isGasError) {
        // Gas不足错误，检查BNB余额
        const targetBnbFloat = 0.001

        if (currentBnb >= targetBnbFloat) {
          // BNB >= 0.001，忽略Gas不足错误
          console.log(`⚠️ [TransferWorker] BNB余额 ${currentBnb} BNB >= ${targetBnbFloat} BNB，忽略Gas不足错误`)
          console.log(`   可能原因：网络拥堵导致Gas价格上涨，或交易本身失败（非Gas问题）`)
          return { success: false, error: error.message, isGasError, gasSkipped: true }
        } else {
          // BNB < 0.001，触发Gas补充
          console.log(`⛽ [TransferWorker] BNB余额不足 (${currentBnb} BNB < ${targetBnbFloat} BNB)，准备补充Gas费`)

          const gasFundResult = await executeGasFund(walletAddress, currentBnb, targetBnbFloat, rpcUrl)

          if (gasFundResult.success) {
            console.log(`✅ [TransferWorker] Gas补充成功，等待5秒后重试`)
            await new Promise(resolve => setTimeout(resolve, 5000))

            // 验证余额是否已补充
            try {
              const provider = new ethers.JsonRpcProvider(rpcUrl)
              const balance = await provider.getBalance(walletAddress)
              const verifiedBnb = parseFloat(ethers.formatEther(balance))

              if (verifiedBnb < targetBnbFloat) {
                console.log(`⚠️ [TransferWorker] Gas补充未完成 (当前: ${verifiedBnb} BNB, 目标: ${targetBnbFloat} BNB)`)
                return { success: false, error: error.message, isGasError, gasFundTriggered: true, gasFundCompleted: false }
              }

              console.log(`✅ [TransferWorker] Gas补充验证成功 (当前: ${verifiedBnb} BNB)`)
              return { success: false, error: error.message, isGasError, gasFundTriggered: true, gasFundCompleted: true }
            } catch (error) {
              console.error(`❌ [TransferWorker] 验证Gas补充失败:`, error.message)
              return { success: false, error: error.message, isGasError, gasFundTriggered: true, gasFundCompleted: false }
            }
          } else {
            console.error(`❌ [TransferWorker] Gas补充失败:`, gasFundResult.error)
            return { success: false, error: error.message, isGasError, gasFundTriggered: true, gasFundCompleted: false }
          }
        }
      }

      // 非Gas错误或达到最大重试次数，直接返回错误
      return { success: false, error: error.message, isGasError, shouldAbandon: retryCount >= maxRetries }
    }
  }

  /**
   * 执行转账循环（无时限，达到条件就退出）
   * 返回: { success: boolean, completed: boolean, reason: string, aideTasks: array }
   */
  async function runTransferLoop(walletAddress, tokenType, db, rpcUrl) {
    let retryCount = 0
    let gasErrorCount = 0      // 连续Gas不足错误计数
    let walletEmpty = false
    let allAideTasks = []
    const startTime = Date.now()
    const MAX_LOOP_DURATION = 3 * 60 * 1000 // 3分钟最大执行时间

    console.log(`🔄 [TransferWorker] 开始转账循环: ${walletAddress.slice(-4)} (${tokenType})`)
    console.log(`   配置: maxRetries=${maxRetries}, maxGasErrors=${maxGasErrors}`)

    while (retryCount <= maxRetries && !walletEmpty) {
      // 检查执行时间
      if (Date.now() - startTime > MAX_LOOP_DURATION) {
        console.log(`⏱️ [TransferWorker] 转账循环超时，强制退出`)
        return { success: false, completed: false, reason: 'timeout', aideTasks: allAideTasks }
      }
      // 执行转账
      const transferResult = await executeTransfer(walletAddress, tokenType, db, rpcUrl, retryCount)

      // 收集Aide任务
      if (transferResult.aideTasks && transferResult.aideTasks.length > 0) {
        allAideTasks.push(...transferResult.aideTasks)
      }

      walletEmpty = transferResult.walletEmpty

      if (transferResult.shouldAbandon) {
        // 需要放弃（如BNB失败2次且无其它代币）
        console.log(`❌ [TransferWorker] 达到放弃条件，退出转账循环`)
        return { success: false, completed: false, reason: 'abandoned', aideTasks: allAideTasks }
      }

      if (!transferResult.success && transferResult.gasFundTriggered) {
        // Gas补充已触发，检查是否完成
        if (transferResult.gasFundCompleted) {
          // Gas补充成功，重置Gas错误计数
          gasErrorCount = 0
          retryCount++
          console.log(`🔄 [TransferWorker] Gas补充完成，开始重试 (${retryCount}/${maxRetries})`)
          continue
        } else {
          // Gas补充失败，退出循环
          console.log(`❌ [TransferWorker] Gas补充失败，退出转账循环`)
          return { success: false, completed: false, reason: 'gas_fund_failed', aideTasks: allAideTasks }
        }
      }

      if (walletEmpty) {
        console.log(`✅ [TransferWorker] 钱包已清空，转账循环完成`)
        return { success: true, completed: true, reason: 'wallet_empty', aideTasks: allAideTasks }
      }

      if (!transferResult.success) {
        // 转账失败
        if (transferResult.isGasError) {
          // Gas不足错误，检查BNB余额
          if (transferResult.gasSkipped) {
            // BNB >= 0.001，忽略此错误，不计入Gas错误计数
            console.log(`ℹ️ [TransferWorker] BNB余额充足（>=0.001），忽略Gas不足错误`)
            gasErrorCount = 0
            retryCount++
            continue
          } else {
            // BNB < 0.001，计入Gas错误计数
          gasErrorCount++
          console.log(`⚠️ [TransferWorker] Gas不足错误 (${gasErrorCount}/${maxGasErrors})`)

          if (gasErrorCount >= maxGasErrors) {
            console.log(`❌ [TransferWorker] 连续${maxGasErrors}次Gas不足错误，退出转账循环`)
            return { success: false, completed: false, reason: 'max_gas_errors', aideTasks: allAideTasks }
            }

            retryCount++
            continue
          }
        } else {
          // 非Gas不足错误，退出循环
          console.log(`❌ [TransferWorker] 转账失败（非Gas问题），退出循环`)
          return { success: false, completed: false, reason: transferResult.error, aideTasks: allAideTasks }
        }
      }

      // 转账成功但钱包未清空，检查是否还有代币
      const { isWalletEmpty } = await checkWalletEmpty(env, walletAddress, rpcUrl)

      if (isWalletEmpty) {
        walletEmpty = true
        console.log(`✅ [TransferWorker] 钱包代币已清空，转账循环完成`)
        break
      }

      // 还有代币，继续转账
      console.log(`🔄 [TransferWorker] 钱包还有代币，继续转账...`)
      retryCount++
    }

    return { success: walletEmpty, completed: walletEmpty, reason: walletEmpty ? 'completed' : 'max_retries', aideTasks: allAideTasks }
  }

  /**
   * 执行Gas费补充
   * 返回: { success: boolean, hash: string }
   */
  async function executeGasFund(walletAddress, currentBalance, targetBalance, rpcUrl) {
    console.log(`⛽ [TransferWorker] 开始补充Gas费: ${walletAddress.slice(-4)} (当前: ${currentBalance} BNB, 固定目标: 0.001 BNB)`)

    try {
      // 创建provider
      const provider = new ethers.JsonRpcProvider(rpcUrl)

      // 获取Gas补充钱包
      const gasFundingWallet = env.GAS_FUNDING_WALLET
      const gasFundingPrivateKey = env.GAS_FUNDING_WALLET_PRIVATE_KEY

      if (!gasFundingWallet || !gasFundingPrivateKey) {
        throw new Error('未配置Gas补充钱包')
      }

      const gasFundingSigner = new ethers.Wallet(gasFundingPrivateKey, provider)

      // 固定补充0.001 BNB（包含Gas成本）
      const transferAmount = ethers.parseEther('0.001')

      // 发送转账
      const tx = await gasFundingSigner.sendTransaction({
        to: walletAddress,
        value: transferAmount
      })

      console.log(`✅ [TransferWorker] Gas费补充完成: ${walletAddress.slice(-4)} (固定金额: 0.001 BNB, 哈希: ${tx.hash})`)

      // 添加超时保护（20秒）
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Gas补充交易确认超时')), 20 * 1000)
      })

      try {
        await Promise.race([tx.wait(), timeoutPromise])
        console.log(`✅ [TransferWorker] Gas费补充交易已确认`)
      } catch (error) {
        if (error.message.includes('超时')) {
          console.warn(`⚠️ [TransferWorker] Gas补充交易已提交但未确认: ${tx.hash}`)
          return { success: true, hash: tx.hash, status: 'pending' }
        }
        console.error(`⚠️ [TransferWorker] Gas费补充交易确认失败:`, error.message)
        return { success: false, error: error.message }
      }

      return { success: true, hash: tx.hash }
    } catch (error) {
      console.error(`❌ [TransferWorker] Gas费补充失败: ${walletAddress.slice(-4)}`, error.message)
      return { success: false, error: error.message }
    }
  }

  return {
    runTransferLoop,
    executeGasFund,
    checkWalletEmpty
  }
}
