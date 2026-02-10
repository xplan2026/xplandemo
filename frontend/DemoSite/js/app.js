// 主应用逻辑

// 全局状态
const state = {
  wallets: [],
  emergencies: [],
  healthy: false,
  emergencyMode: false,
  autoRefreshInterval: null,
  countdownInterval: null
}

/**
 * 初始化应用
 */
function initApp() {
  console.log('初始化 X-plan Demo 管理界面...')

  // 初始化组件
  initApiKeyInput()
  initPrivateKeyToggle()
  initCopyButtons()
  initEventListeners()

  // 初始加载
  loadData()

  // 启动自动刷新（每 30 秒）
  state.autoRefreshInterval = setInterval(loadData, 30000)

  // 启动倒计时更新（每秒）
  state.countdownInterval = setInterval(updateCountdowns, 1000)

  console.log('应用初始化完成')
}

/**
 * 初始化事件监听器
 */
function initEventListeners() {
  // 刷新按钮
  document.getElementById('refreshBtn').addEventListener('click', () => {
    loadData()
  })

  // 开始测试按钮
  document.getElementById('startTestBtn').addEventListener('click', handleStartTest)

  // 启用应急模式按钮
  document.getElementById('enableEmergencyBtn').addEventListener('click', handleEnableEmergency)

  // 禁用应急模式按钮
  document.getElementById('disableEmergencyBtn').addEventListener('click', handleDisableEmergency)

  // 模拟私钥表单切换显示/隐藏
  const toggleTestKeyBtn = document.getElementById('toggleTestKeyBtn')
  const testPrivateKeyInput = document.getElementById('testPrivateKey')
  if (toggleTestKeyBtn && testPrivateKeyInput) {
    toggleTestKeyBtn.addEventListener('click', () => {
      if (testPrivateKeyInput.type === 'password') {
        testPrivateKeyInput.type = 'text'
        toggleTestKeyBtn.textContent = '隐藏'
      } else {
        testPrivateKeyInput.type = 'password'
        toggleTestKeyBtn.textContent = '显示'
      }
    })
  }

  // 模拟转账按钮
  const simulateTransferBtn = document.getElementById('simulateTransferBtn')
  if (simulateTransferBtn) {
    simulateTransferBtn.addEventListener('click', handleSimulateTransfer)
  }
}

/**
 * 初始化私钥显示/隐藏
 */
function initPrivateKeyToggle() {
  const toggleBtn = document.getElementById('togglePrivateKey')
  const privateKeySpan = document.getElementById('protectedPrivateKey')

  if (toggleBtn && privateKeySpan) {
    toggleBtn.addEventListener('click', async () => {
      const isMasked = privateKeySpan.classList.contains('masked')

      if (isMasked) {
        // 显示前弹出警告
        const confirmed = await confirm(
          '⚠️ 安全警告 ⚠️\n\n' +
          '您即将查看演示私钥。请注意：\n\n' +
          '1. 此私钥仅用于演示测试\n' +
          '2. 此钱包在测试网中，无真实资产\n' +
          '3. 🚨 永远不要将不信任的私钥导入到您的真实钱包中！\n' +
          '4. 导入不信任私钥可能导致您的主网资产被盗！\n\n' +
          '是否继续查看？'
        )

        if (!confirmed) return

        privateKeySpan.classList.remove('masked')
        privateKeySpan.textContent = '<protected-wallet-private-key>'
        toggleBtn.textContent = '隐藏'
      } else {
        privateKeySpan.classList.add('masked')
        privateKeySpan.textContent = '0x70...fae6'
        toggleBtn.textContent = '显示'
      }
    })
  }
}

/**
 * 初始化复制按钮
 */
function initCopyButtons() {
  document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.copy
      if (text) {
        navigator.clipboard.writeText(text).then(() => {
          showToast('已复制到剪贴板', 'success')
        }).catch(err => {
          showToast('复制失败', 'error')
        })
      }
    })
  })
}

/**
 * 加载数据
 */
async function loadData() {
  try {
    // 并行加载多个接口
    const [health, status, emergency] = await Promise.all([
      api.getHealth(),
      api.getStatus(),
      api.getEmergency()
    ])

    // 更新状态
    state.healthy = health.status === 'healthy'
    state.wallets = status.wallets || []
    state.emergencies = emergency.emergency_statuses || []

    // 更新 UI
    updateHealthIndicator(state.healthy)
    updateStatusBar(health.worker_name)
    updateBalances(state.wallets)
    updateEmergencyStatus(state.emergencies)
    updateUserStatistics() // 新增：更新用户统计

    document.getElementById('lastUpdate').textContent = formatTime(new Date().toISOString())

  } catch (error) {
    console.error('加载数据失败:', error)
    showToast(`加载数据失败: ${error.message}`, 'error')
    updateHealthIndicator(false)
  }
}

/**
 * 更新余额显示
 */
function updateBalances(wallets) {
  if (!wallets || wallets.length === 0) return

  const wallet = wallets[0]
  const xpdBalance = wallet.xpd_balance || '0'
  const polBalance = wallet.pol_balance || '0'

  document.getElementById('xpdBalance').textContent = formatBalance(xpdBalance)
  document.getElementById('polBalance').textContent = formatBalance(polBalance)
}

/**
 * 更新应急状态
 */
function updateEmergencyStatus(emergencies) {
  const hasEmergency = emergencies && emergencies.some(e => e.in_emergency)
  state.emergencyMode = hasEmergency

  const statusBadge = document.getElementById('emergencyStatusBadge')
  const scanIntervalText = document.getElementById('scanIntervalText')
  const enableBtn = document.getElementById('enableEmergencyBtn')
  const disableBtn = document.getElementById('disableEmergencyBtn')
  const scanModeText = document.getElementById('scanMode')

  if (hasEmergency) {
    statusBadge.textContent = '应急模式 ⚠️'
    statusBadge.className = 'status-badge emergency'
    scanIntervalText.textContent = '5秒/次'
    scanModeText.textContent = '应急模式'
    enableBtn.style.display = 'none'
    disableBtn.style.display = 'inline-flex'
  } else {
    statusBadge.textContent = '常规模式'
    statusBadge.className = 'status-badge normal'
    scanIntervalText.textContent = '1分钟/次'
    scanModeText.textContent = '常规模式'
    enableBtn.style.display = 'inline-flex'
    disableBtn.style.display = 'none'
  }

  // 渲染应急列表
  renderEmergencyList(emergencies)
}

/**
 * 更新倒计时
 */
function updateCountdowns() {
  const items = document.querySelectorAll('.emergency-timer')
  items.forEach(item => {
    const text = item.textContent
    const match = text.match(/(\d+)分(\d+)秒/)
    if (match) {
      let mins = parseInt(match[1])
      let secs = parseInt(match[2])

      secs--
      if (secs < 0) {
        secs = 59
        mins--
      }

      if (mins < 0) {
        item.textContent = '已过期'
      } else {
        item.textContent = `锁定剩余: ${formatCountdown(mins * 60 + secs)}`
      }
    }
  })
}

/**
 * 处理开始测试
 */
async function handleStartTest() {
  const btn = document.getElementById('startTestBtn')

  // 检查 API Key
  if (!api.apiKey) {
    showToast('请先设置 API Key', 'error')
    return
  }

  // 确认操作
  const confirmed = await confirm(
    '将从安全钱包转移 1 XPD 到被保护钱包地址 A\n\n' +
    '此操作将消耗 POL 作为 Gas 费\n\n' +
    '是否继续？'
  )
  if (!confirmed) return

  try {
    setButtonLoading(btn, true, '处理中...')
    showLoading('正在发起转账...')

    const result = await api.testTransfer(1)

    hideLoading()
    setButtonLoading(btn, false)

    if (result.success) {
      showToast(`✅ 转账成功！\n交易哈希: ${result.tx_hash}`, 'success')

      // 重新加载数据
      await delay(2000)
      loadData()
    } else {
      showToast(`❌ 转账失败: ${result.error}`, 'error')
    }

  } catch (error) {
    hideLoading()
    setButtonLoading(btn, false)
    showToast(`转账失败: ${error.message}`, 'error')
  }
}

/**
 * 处理启用应急模式
 */
async function handleEnableEmergency() {
  const btn = document.getElementById('enableEmergencyBtn')

  // 检查 API Key
  if (!api.apiKey) {
    showToast('请先设置 API Key', 'error')
    return
  }

  // 确认操作
  const confirmed = await confirm(
    '确定要启用应急模式吗？\n\n' +
    '启用后将执行以下操作：\n' +
    '1. 扫描频率提升至 5 秒\n' +
    '2. 检测到余额立即转移到安全地址 B\n\n' +
    '是否继续？'
  )
  if (!confirmed) return

  try {
    setButtonLoading(btn, true, '启用中...')
    showLoading('正在启用应急模式...')

    const result = await api.enableEmergency()

    hideLoading()
    setButtonLoading(btn, false)

    if (result.success) {
      showToast('✅ 应急模式已启用', 'success')
      state.emergencyMode = true
      await loadData()
    } else {
      showToast('❌ 启用失败', 'error')
    }

  } catch (error) {
    hideLoading()
    setButtonLoading(btn, false)
    showToast(`启用失败: ${error.message}`, 'error')
  }
}

/**
 * 处理禁用应急模式
 */
async function handleDisableEmergency() {
  const btn = document.getElementById('disableEmergencyBtn')

  // 检查 API Key
  if (!api.apiKey) {
    showToast('请先设置 API Key', 'error')
    return
  }

  // 确认操作
  const confirmed = await confirm(
    '确定要禁用应急模式吗？\n\n' +
    '禁用后将恢复以下设置：\n' +
    '1. 扫描频率恢复至 1 分钟\n' +
    '2. 仅监控，不执行转账\n\n' +
    '是否继续？'
  )
  if (!confirmed) return

  try {
    setButtonLoading(btn, true, '禁用中...')
    showLoading('正在禁用应急模式...')

    const result = await api.disableEmergency()

    hideLoading()
    setButtonLoading(btn, false)

    if (result.success) {
      showToast('✅ 应急模式已禁用', 'success')
      state.emergencyMode = false
      await loadData()
    } else {
      showToast('❌ 禁用失败', 'error')
    }

  } catch (error) {
    hideLoading()
    setButtonLoading(btn, false)
    showToast(`禁用失败: ${error.message}`, 'error')
  }
}

/**
 * 处理模拟转账
 */
async function handleSimulateTransfer() {
  const privateKeyInput = document.getElementById('testPrivateKey')
  const targetAddressInput = document.getElementById('testTargetAddress')
  const btn = document.getElementById('simulateTransferBtn')

  // 验证私钥
  const privateKey = privateKeyInput.value.trim()
  if (!privateKey) {
    showToast('请输入演示私钥', 'error')
    return
  }

  // 验证目标地址
  const targetAddress = targetAddressInput.value.trim()
  if (!targetAddress || !/^0x[a-fA-F0-9]{40}$/.test(targetAddress)) {
    showToast('请输入有效的目标地址', 'error')
    return
  }

  // 确认操作
  const confirmed = await confirm(
    '⚠️ 安全警告 ⚠️\n\n' +
    '您即将使用演示私钥执行模拟转账。\n\n' +
    '请确认：\n' +
    '1. 这是一个测试网钱包\n' +
    '2. 钱包中无真实资产\n' +
    '3. 您了解此操作将消耗 POL 作为 Gas 费\n\n' +
    '是否继续？'
  )
  if (!confirmed) return

  try {
    setButtonLoading(btn, true, '处理中...')
    showLoading('正在发起模拟转账...')

    // 调用 API 执行模拟转账
    const result = await api.simulateTransfer({
      privateKey: privateKey,
      targetAddress: targetAddress,
      amount: '1' // 默认转移 1 XPD
    })

    hideLoading()
    setButtonLoading(btn, false)

    if (result.success) {
      showToast(`✅ 模拟转账成功！\n交易哈希: ${result.tx_hash}`, 'success')

      // 重新加载数据
      await delay(2000)
      loadData()

      // 清空表单
      privateKeyInput.value = ''
      targetAddressInput.value = ''
    } else {
      showToast(`❌ 模拟转账失败: ${result.error}`, 'error')
    }

  } catch (error) {
    hideLoading()
    setButtonLoading(btn, false)
    showToast(`模拟转账失败: ${error.message}`, 'error')
  }
}

/**
 * 更新用户统计
 * 从 Supabase 获取用户统计数据
 */
async function updateUserStatistics() {
  try {
    // 获取 Supabase 配置
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.log('未配置 Supabase，使用模拟数据')
      updateMockUserStatistics()
      return
    }

    // 从 Supabase 获取用户统计
    const response = await fetch(`${supabaseUrl}/rest/v1/user_statistics`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    })

    if (!response.ok) {
      throw new Error('获取用户统计失败')
    }

    const stats = await response.json()
    if (stats && stats.length > 0) {
      const stat = stats[0]
      document.getElementById('realUserCount').textContent = stat.real_users || 0
      document.getElementById('testUserCount').textContent = stat.test_users || 0
    } else {
      updateMockUserStatistics()
    }

  } catch (error) {
    console.error('获取用户统计失败:', error)
    // 降级到模拟数据
    updateMockUserStatistics()
  }
}

/**
 * 更新模拟用户统计（当 Supabase 未配置时使用）
 */
function updateMockUserStatistics() {
  // 模拟一些实时数据
  const mockRealUsers = 8 + Math.floor(Math.random() * 5) // 8-13 个真实用户
  const mockTestUsers = 4 // 4 个测试用户

  document.getElementById('realUserCount').textContent = mockRealUsers
  document.getElementById('testUserCount').textContent = mockTestUsers
}

/**
 * 清理资源
 */
function cleanup() {
  if (state.autoRefreshInterval) {
    clearInterval(state.autoRefreshInterval)
  }
  if (state.countdownInterval) {
    clearInterval(state.countdownInterval)
  }
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp)
} else {
  initApp()
}

// 页面卸载前清理
window.addEventListener('beforeunload', cleanup)
