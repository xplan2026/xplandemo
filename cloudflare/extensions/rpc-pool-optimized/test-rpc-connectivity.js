#!/usr/bin/env node

/**
 * RPC节点接通率测试脚本
 * 
 * 功能：
 * 1. 对所有RPC节点轮流进行连通性测试
 * 2. 共进行5轮+5轮测试（每5轮间隔10秒）
 * 3. 最终给出成功率排名
 * 
 * 使用方法：
 * node test-rpc-connectivity.js
 */

// RPC节点列表（与 DEFAULT_NODES 保持一致）
const DEFAULT_NODES = [
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

// 测试配置
const CONFIG = {
  timeout: 5000,        // 单次请求超时（毫秒）
  rounds: 5,            // 每组轮数
  groupCount: 2,        // 组数（5+5）
  groupInterval: 10000, // 组间间隔（毫秒）
  maxRetries: 1         // 失败重试次数
}

// 测试结果统计
const testResults = new Map()

/**
 * 测试单个RPC节点
 */
async function testNode(nodeUrl, round, group) {
  const startTime = Date.now()
  const method = 'eth_blockNumber'
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout)
    
    const response = await fetch(nodeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: method,
        params: [],
        id: 1
      }),
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.error) {
      throw new Error(`RPC Error: ${data.error.message || JSON.stringify(data.error)}`)
    }
    
    const duration = Date.now() - startTime
    
    return {
      success: true,
      duration,
      blockNumber: data.result,
      error: null
    }
  } catch (error) {
    const duration = Date.now() - startTime
    return {
      success: false,
      duration,
      blockNumber: null,
      error: error.message
    }
  }
}

/**
 * 执行单轮测试
 */
async function runRound(round, group) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`第 ${group} 组 - 第 ${round} 轮测试开始`)
  console.log(`${'='.repeat(60)}`)
  
  const roundResults = []
  
  // 依次测试所有节点
  for (let i = 0; i < DEFAULT_NODES.length; i++) {
    const nodeUrl = DEFAULT_NODES[i]
    const nodeShort = nodeUrl.replace('https://', '').slice(0, 35)
    
    process.stdout.write(`  [${i + 1}/${DEFAULT_NODES.length}] 测试 ${nodeShort}... `)
    
    // 第一次测试
    let result = await testNode(nodeUrl, round, group)
    
    // 如果失败，重试一次
    if (!result.success && CONFIG.maxRetries > 0) {
      process.stdout.write(`(重试) `)
      const retryResult = await testNode(nodeUrl, round, group)
      if (retryResult.success) {
        result = retryResult
      }
    }
    
    // 更新统计
    if (!testResults.has(nodeUrl)) {
      testResults.set(nodeUrl, {
        url: nodeUrl,
        success: 0,
        failure: 0,
        totalDuration: 0,
        errors: []
      })
    }
    
    const stats = testResults.get(nodeUrl)
    if (result.success) {
      stats.success++
      stats.totalDuration += result.duration
      console.log(`✅ ${result.duration}ms`)
    } else {
      stats.failure++
      stats.errors.push(result.error)
      console.log(`❌ ${result.error}`)
    }
    
    roundResults.push({
      url: nodeUrl,
      success: result.success,
      duration: result.duration,
      error: result.error
    })
    
    // 避免请求过快
    await sleep(100)
  }
  
  return roundResults
}

/**
 * 执行一组测试
 */
async function runGroup(group) {
  console.log(`\n${'█'.repeat(60)}`)
  console.log(`开始第 ${group} 组测试（共 ${CONFIG.rounds} 轮）`)
  console.log(`测试节点数: ${DEFAULT_NODES.length}`)
  console.log(`${'█'.repeat(60)}`)
  
  const groupResults = []
  
  for (let round = 1; round <= CONFIG.rounds; round++) {
    const roundResults = await runRound(round, group)
    groupResults.push(...roundResults)
  }
  
  // 打印组内统计
  console.log(`\n第 ${group} 组测试完成`)
  console.log('-'.repeat(60))
  
  return groupResults
}

/**
 * 打印最终统计
 */
function printFinalStats() {
  console.log(`\n${'█'.repeat(70)}`)
  console.log(`最终测试结果统计`)
  console.log(`${'█'.repeat(70)}`)
  
  const totalTests = CONFIG.rounds * CONFIG.groupCount * DEFAULT_NODES.length
  const totalRounds = CONFIG.rounds * CONFIG.groupCount
  
  // 计算每个节点的统计信息
  const nodeStats = Array.from(testResults.values()).map(node => {
    const totalAttempts = node.success + node.failure
    const successRate = (node.success / totalAttempts) * 100
    const avgDuration = node.success > 0 ? node.totalDuration / node.success : 0
    
    return {
      ...node,
      totalAttempts,
      successRate,
      avgDuration
    }
  })
  
  // 按成功率降序排序
  nodeStats.sort((a, b) => b.successRate - a.successRate)
  
  // 打印排名
  console.log(`\n📊 成功率排名（共 ${DEFAULT_NODES.length} 个节点，每组 ${CONFIG.rounds} 轮 × ${CONFIG.groupCount} 组 = ${totalRounds} 次测试）`)
  console.log('┌────┬─────────────────────────────┬───────────┬──────────┬─────────────┬────────────┐')
  console.log('│排名│ 节点地址                    │ 成功率    │ 成功/总数 │ 平均延迟   │ 失败次数   │')
  console.log('├────┼─────────────────────────────┼───────────┼──────────┼─────────────┼────────────┤')
  
  nodeStats.forEach((node, index) => {
    const rank = index + 1
    const urlShort = node.url.replace('https://', '').slice(0, 28)
    const successRate = node.successRate.toFixed(1) + '%'
    const attempts = `${node.success}/${node.totalAttempts}`
    const avgDuration = node.avgDuration > 0 ? `${node.avgDuration.toFixed(0)}ms` : '-'
    const failures = node.failure
    
    const rankStr = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank.toString().padStart(2)
    
    console.log(`│${rankStr.padStart(3)}│ ${urlShort.padEnd(28)}│ ${successRate.padStart(9)}│ ${attempts.padStart(8)}│ ${avgDuration.padStart(10)}│ ${failures.toString().padStart(10)}│`)
  })
  
  console.log('└────┴─────────────────────────────┴───────────┴──────────┴─────────────┴────────────┘')
  
  // 打印总体统计
  const totalSuccess = nodeStats.reduce((sum, node) => sum + node.success, 0)
  const totalFailure = nodeStats.reduce((sum, node) => sum + node.failure, 0)
  const overallSuccessRate = (totalSuccess / totalTests) * 100
  
  console.log(`\n📈 总体统计:`)
  console.log(`   总测试次数: ${totalTests}`)
  console.log(`   成功次数: ${totalSuccess} (${overallSuccessRate.toFixed(1)}%)`)
  console.log(`   失败次数: ${totalFailure}`)
  
  // 打印失败详情
  if (totalFailure > 0) {
    console.log(`\n⚠️ 失败节点详情:`)
    nodeStats.filter(node => node.failure > 0).forEach(node => {
      console.log(`   • ${node.url.replace('https://', '')}`)
      const errorSummary = {}
      node.errors.forEach(error => {
        const key = error.split(':')[0] || error
        errorSummary[key] = (errorSummary[key] || 0) + 1
      })
      Object.entries(errorSummary).forEach(([error, count]) => {
        console.log(`     - ${error}: ${count}次`)
      })
    })
  }
  
  // 打印推荐
  console.log(`\n💡 推荐配置:`)
  const topNodes = nodeStats.slice(0, 6)
  console.log(`   前6名节点（建议用于节点池）:`)
  topNodes.forEach((node, index) => {
    console.log(`   ${index + 1}. ${node.url}`)
  })
}

/**
 * 延迟函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 主函数
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════╗')
  console.log('║          RPC节点接通率测试脚本                                     ║')
  console.log('╚════════════════════════════════════════════════════════════════════╝')
  console.log(`\n测试配置:`)
  console.log(`  - 测试节点数: ${DEFAULT_NODES.length}`)
  console.log(`  - 测试轮数: ${CONFIG.rounds} 轮 × ${CONFIG.groupCount} 组`)
  console.log(`  - 组间间隔: ${CONFIG.groupInterval / 1000} 秒`)
  console.log(`  - 请求超时: ${CONFIG.timeout}ms`)
  console.log(`  - 失败重试: ${CONFIG.maxRetries} 次`)
  
  const startTime = Date.now()
  
  try {
    // 执行第1组测试
    await runGroup(1)
    
    // 组间间隔
    console.log(`\n⏸️  等待 ${CONFIG.groupInterval / 1000} 秒后开始第 2 组测试...`)
    await sleep(CONFIG.groupInterval)
    
    // 执行第2组测试
    await runGroup(2)
    
    // 打印最终统计
    printFinalStats()
    
    const totalTime = Date.now() - startTime
    console.log(`\n✅ 测试完成，总耗时: ${(totalTime / 1000).toFixed(1)} 秒`)
    
  } catch (error) {
    console.error(`\n❌ 测试失败:`, error.message)
    process.exit(1)
  }
}

// 运行主函数
main()
