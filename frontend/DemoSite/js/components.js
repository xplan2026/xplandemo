// UI 组件

/**
 * 渲染钱包卡片
 */
function renderWalletCard(wallet) {
  const statusClass = {
    'none': 'normal',
    'normal': 'normal',
    'transfer': 'transfer',
    'emergency': 'emergency'
  }[wallet.action] || 'normal'

  const statusText = {
    'none': '正常',
    'normal': '正常',
    'transfer': '转账',
    'emergency': '应急'
  }[wallet.action] || '未知'

  return `
    <div class="wallet-card" data-address="${wallet.wallet}">
      <div class="wallet-card-header">
        <span class="wallet-address">${formatAddress(wallet.wallet)}</span>
        <span class="status-badge ${statusClass}">${statusText}</span>
      </div>
      <div class="wallet-card-body">
        <div class="balance-item">
          <span class="label">POL</span>
          <span class="value">${formatBalance(wallet.pol_balance)}</span>
        </div>
        <div class="balance-item">
          <span class="label">XPD</span>
          <span class="value">${formatBalance(wallet.xpd_balance)}</span>
        </div>
      </div>
    </div>
  `
}

/**
 * 渲染钱包列表
 */
function renderWallets(wallets) {
  const container = document.getElementById('walletsGrid')

  if (!wallets || wallets.length === 0) {
    container.innerHTML = '<div class="loading">暂无钱包数据</div>'
    return
  }

  container.innerHTML = wallets.map(renderWalletCard).join('')

  // 添加点击事件
  container.querySelectorAll('.wallet-card').forEach(card => {
    card.addEventListener('click', () => {
      const address = card.dataset.address
      showWalletDetail(address)
    })
  })
}

/**
 * 渲染应急状态项
 */
function renderEmergencyItem(emergency) {
  const countdown = emergency.remaining || 0
  return `
    <div class="emergency-item" data-address="${emergency.wallet}">
      <div class="emergency-info">
        <span class="emergency-address">${formatAddress(emergency.wallet)}</span>
        <span class="emergency-timer">锁定剩余: ${formatCountdown(countdown)}</span>
      </div>
      <span class="status-badge emergency">应急中</span>
    </div>
  `
}

/**
 * 渲染应急列表
 */
function renderEmergencyList(emergencies) {
  const container = document.getElementById('emergencyList')

  if (!emergencies || emergencies.length === 0) {
    container.innerHTML = '<div class="loading">暂无应急状态</div>'
    return
  }

  container.innerHTML = emergencies.map(renderEmergencyItem).join('')
}

/**
 * 更新健康指示器
 */
function updateHealthIndicator(healthy) {
  const indicator = document.getElementById('healthIndicator')
  const dot = indicator.querySelector('.status-dot')
  const text = indicator.querySelector('.status-text')

  dot.className = `status-dot ${healthy ? 'healthy' : 'unhealthy'}`
  text.textContent = healthy ? '正常' : '异常'
}

/**
 * 更新状态栏
 */
function updateStatusBar(workerStatus) {
  document.getElementById('workerStatus').textContent = workerStatus || '未知'
}

/**
 * 显示钱包详情
 */
async function showWalletDetail(address) {
  try {
    showLoading('加载钱包详情...')
    const data = await api.getWallet(address)
    hideLoading()

    // 简单的 alert 显示，后续可改进为模态框
    alert(`
钱包详情
---------
地址: ${data.wallet}
POL 余额: ${formatBalance(data.scanResult.polBalance)}
XPD 余额: ${formatBalance(data.scanResult.xpdBalance)}
动作: ${data.action.action}
原因: ${data.action.reason}
    `)
  } catch (error) {
    hideLoading()
    showToast(`加载钱包详情失败: ${error.message}`, 'error')
  }
}

/**
 * 初始化 API Key 输入框
 */
function initApiKeyInput() {
  const input = document.getElementById('apiKeyInput')
  const toggleBtn = document.getElementById('toggleApiKeyBtn')
  const saveBtn = document.getElementById('saveApiKeyBtn')

  if (!input || !toggleBtn || !saveBtn) return

  // 加载已保存的 API Key
  const savedKey = api.apiKey
  if (savedKey) {
    input.value = savedKey
  }

  // 切换显示/隐藏
  toggleBtn.addEventListener('click', () => {
    if (input.type === 'password') {
      input.type = 'text'
      toggleBtn.textContent = '隐藏'
    } else {
      input.type = 'password'
      toggleBtn.textContent = '显示'
    }
  })

  // 保存 API Key
  saveBtn.addEventListener('click', () => {
    const key = input.value.trim()
    if (!key) {
      showToast('请输入 API Key', 'error')
      return
    }

    api.saveApiKey(key)
    showToast('API Key 已保存', 'success')
  })
}

/**
 * 设置按钮加载状态
 */
function setButtonLoading(btn, loading, text) {
  if (!btn) return

  if (loading) {
    btn.disabled = true
    btn.dataset.originalText = btn.textContent
    btn.textContent = text || '处理中...'
  } else {
    btn.disabled = false
    btn.textContent = btn.dataset.originalText || btn.textContent
  }
}

/**
 * 创建确认对话框
 */
function confirm(message) {
  return new Promise((resolve) => {
    const result = window.confirm(message)
    resolve(result)
  })
}
