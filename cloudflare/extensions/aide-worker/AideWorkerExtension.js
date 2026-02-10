// cloudflare/extensions/aide-worker/AideWorkerExtension.js
// Aide Worker Extension: Aide辅助扩展函数
// 功能：作为扩展函数被transfer调用，在转账结束后触发
// 版本：v2.4.1-dev
//
// 关键优化：
// - 不使用 KV 队列（删除了所有 queueTask 相关代码）
// - 错误记录改用 Supabase 存储（db.system.saveError）

import { ethers } from 'ethers'

/**
 * 创建Aide Worker扩展
 */
export function createAideWorkerExtension(env, options = {}) {
  const {
    txCheckInterval = 5,      // 交易检查间隔（秒）
    maxTxWaitTime = 20,      // 最大等待时间（秒，快速退出以释放锁）
    maxTxRetries = 2,         // 最大重试次数（减少重试次数，快速失败）
    rpcUrl = env.POLYGON_AMOY_RPC || 'https://rpc-amoy.polygon.technology'  // RPC节点URL
  } = options

  /**
   * 检查交易状态
   * 返回: { status: 'success'|'failed'|'pending'|'error', receipt?: object, message?: string }
   */
  async function checkTransactionStatus(txHash, provider) {
    try {
      // 获取交易收据
      const receipt = await provider.getTransactionReceipt(txHash)

      if (!receipt) {
        return { status: 'pending', message: 'Transaction not yet confirmed' }
      }

      // 交易已确认
      if (receipt.status === 1) {
        return { status: 'success', receipt }
      } else {
        // 交易失败
        return { status: 'failed', receipt }
      }
    } catch (error) {
      console.error(`❌ [AideWorker] 查询交易 ${txHash.slice(-8)} 状态失败:`, error.message)
      return { status: 'error', message: error.message }
    }
  }

  /**
   * 更新数据库中的交易状态
   */
  async function updateTransactionStatus(db, txHash, status, receipt = null) {
    try {
      const updateData = {
        status: status,
        updatedAt: new Date().toISOString()
      }

      if (receipt) {
        updateData.gasUsed = receipt.gasUsed?.toString() || '0'
        updateData.blockNumber = receipt.blockNumber
        updateData.transactionIndex = receipt.transactionIndex
        updateData.logsCount = receipt.logs?.length || 0
      }

      await db.transaction.updateTransactionStatus(txHash, status, updateData)

      console.log(`📝 [AideWorker] 更新交易状态: ${txHash.slice(-8)} -> ${status}`)
    } catch (error) {
      console.error(`❌ [AideWorker] 更新交易状态失败: ${txHash.slice(-8)}`, error.message)
    }
  }

  /**
   * 检查是否需要重试转账
   * 返回: { shouldRetry: boolean, reason?: string }
   */
  async function shouldRetryTransfer(walletAddress, db) {
    try {
      // 查询最近失败的交易
      const failedTxs = await db.transaction.getFailedTransactions(walletAddress, 10)

      // 检查是否是因为gas不足导致的失败
      const gasInsufficientTxs = failedTxs.filter(tx =>
        tx.error?.includes('insufficient funds') ||
        tx.error?.includes('gas')
      )

      if (gasInsufficientTxs.length >= 3) {
        // 连续3次因gas不足失败，建议补充gas
        console.log(`⚠️ [AideWorker] 钱包 ${walletAddress.slice(-4)} 连续 ${gasInsufficientTxs.length} 次因gas不足失败`)

        // 记录错误到 Supabase
        if (db && db.system) {
          db.system.saveError({
            walletAddress,
            tokenType: 'gas',
            error: `连续 ${gasInsufficientTxs.length} 次因gas不足失败`,
            timestamp: new Date().toISOString()
          }).catch(err => {
            console.error(`❌ [AideWorker] 写入错误记录失败:`, err.message)
          })
        }

        return { shouldRetry: false, reason: 'need_gas_fund' }
      }

      // 检查失败次数
      if (failedTxs.length >= maxTxRetries) {
        console.log(`⚠️ [AideWorker] 钱包 ${walletAddress.slice(-4)} 已重试 ${failedTxs.length} 次，停止重试`)
        return { shouldRetry: false, reason: 'max_retries_exceeded' }
      }

      return { shouldRetry: true }
    } catch (error) {
      console.error(`❌ [AideWorker] 检查重试条件失败:`, error.message)
      return { shouldRetry: false, reason: 'check_error' }
    }
  }

  /**
   * 监控单个交易（快速扫描，及时退出）
   * 返回: { success: boolean, status: string, reason?: string }
   */
  async function monitorTransaction(txRecord, provider, db) {
    const { txHash, walletAddress, tokenType } = txRecord

    console.log(`🔍 [AideWorker] 快速扫描交易: ${txHash.slice(-8)} (${tokenType})`)

    const startTime = Date.now()
    let retries = 0

    while (retries < maxTxRetries && Date.now() - startTime < maxTxWaitTime * 1000) {
      // 检查交易状态
      const result = await checkTransactionStatus(txHash, provider)

      if (result.status === 'success') {
        console.log(`✅ [AideWorker] 交易已确认: ${txHash.slice(-8)}`)

        // 更新数据库为success
        await updateTransactionStatus(db, txHash, 'success', result.receipt)

        // 快速退出，让transfer及时解锁
        return { success: true, status: 'success' }
      } else if (result.status === 'failed') {
        console.log(`❌ [AideWorker] 交易失败: ${txHash.slice(-8)}`)

        // 更新数据库为failed
        await updateTransactionStatus(db, txHash, 'failed', result.receipt)

        // 检查是否需要重试
        const retryCheck = await shouldRetryTransfer(walletAddress, db)

        if (retryCheck.shouldRetry) {
          // 记录错误到 Supabase
          if (db && db.system) {
            db.system.saveError({
              walletAddress,
              tokenType,
              error: `转账失败，需要重试`,
              timestamp: new Date().toISOString()
            }).catch(err => {
              console.error(`❌ [AideWorker] 写入错误记录失败:`, err.message)
            })
          }
          console.log(`🔄 [AideWorker] 重试任务改由主流程处理: ${walletAddress.slice(-4)} (${tokenType})`)
        }

        // 快速退出，让transfer及时解锁
        return { success: false, status: 'failed', reason: retryCheck.reason }
      } else if (result.status === 'error') {
        console.log(`⚠️ [AideWorker] 查询交易出错，重试 ${retries + 1}/${maxTxRetries}`)
      }

      // 等待下一次检查
      await new Promise(resolve => setTimeout(resolve, txCheckInterval * 1000))
      retries++
    }

    // 超时：交易未在20秒内确认，记录为pending但快速退出
    console.log(`⏱️ [AideWorker] 交易尚未确认(20秒)，快速退出释放锁: ${txHash.slice(-8)}`)

    // 更新数据库状态为pending，让后续scan任务继续处理
    await updateTransactionStatus(db, txHash, 'pending')

    return { success: false, status: 'pending' }
  }

  /**
   * 批量监控交易
   * 返回: { total: number, success: number, failed: number, timeout: number }
   */
  async function monitorTransactions(aideTasks, db) {
    const results = []

    console.log(`🔍 [AideWorker] 开始监控 ${aideTasks.length} 个交易`)

    // 创建provider，使用传入的rpcUrl
    const provider = new ethers.JsonRpcProvider(rpcUrl)

    for (const tx of aideTasks) {
      try {
        const result = await monitorTransaction(tx, provider, db)
        results.push({
          txHash: tx.txHash,
          walletAddress: tx.walletAddress,
          success: result.success,
          status: result.status
        })
      } catch (error) {
        console.error(`❌ [AideWorker] 监控交易失败: ${tx.txHash.slice(-8)}`, error.message)
        results.push({
          txHash: tx.txHash,
          walletAddress: tx.walletAddress,
          success: false,
          reason: error.message
        })
      }
    }

    // 统计结果
    const summary = {
      total: results.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => r.status === 'failed').length,
      timeout: results.filter(r => r.status === 'timeout').length
    }

    console.log(`📊 [AideWorker] 交易监控完成:`, summary)

    return summary
  }

  /**
   * 获取待处理的错误数量（使用 Supabase）
   * 返回: { total: number }
   */
  async function getPendingErrorCount(db) {
    if (!db || !db.system) return { total: 0 }

    try {
      const response = await db.fetchSupabase(
        `system_errors?select=count&timestamp=gt.${new Date(Date.now() - 3600000).toISOString()}`
      )
      const data = await response.json()

      return { total: data[0]?.count || 0 }
    } catch (error) {
      console.error(`❌ [AideWorker] 获取错误数量失败:`, error.message)
      return { total: 0 }
    }
  }

  /**
   * 列出最近错误（使用 Supabase）
   * 返回: { errors: Array }
   */
  async function listRecentErrors(db, limit = 10) {
    if (!db || !db.system) return { errors: [] }

    try {
      const response = await db.fetchSupabase(
        `system_errors?select=*&order=timestamp.desc&limit=${limit}`
      )
      const data = await response.json()

      return { errors: data || [] }
    } catch (error) {
      console.error(`❌ [AideWorker] 列出错误失败:`, error.message)
      return { errors: [] }
    }
  }

  /**
   * 清理旧错误记录（使用 Supabase）
   * 返回: { total: number }
   */
  async function clearOldErrors(db, olderThanHours = 24) {
    if (!db || !db.system) return { total: 0 }

    try {
      const cutoffTime = new Date(Date.now() - olderThanHours * 3600000).toISOString()

      const response = await db.fetchSupabase(
        `system_errors?timestamp=lt.${cutoffTime}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        throw new Error(`删除失败: ${response.status}`)
      }

      console.log(`✅ [AideWorker] 清理了旧错误记录`)
      return { total: 0 } // Supabase REST API 不返回删除数量
    } catch (error) {
      console.error(`❌ [AideWorker] 清理旧错误失败:`, error.message)
      return { total: 0 }
    }
  }

  return {
    monitorTransactions,
    getPendingErrorCount,
    listRecentErrors,
    clearOldErrors,
    checkTransactionStatus
  }
}
