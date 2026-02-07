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
}

/**
 * 初始化私钥显示/隐藏
 */
function initPrivateKeyToggle() {
  const toggleBtn = document.getElementById('togglePrivateKey')
  const privateKeySpan = document.getElementById('protectedPrivateKey')

  if (toggleBtn && privateKeySpan) {
    toggleBtn.addEventListener('click', () => {
      const isMasked = privateKeySpan.classList.contains('masked')
      if (isMasked) {
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
