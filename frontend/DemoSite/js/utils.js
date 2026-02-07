// 工具函数

/**
 * 格式化钱包地址
 */
function formatAddress(address) {
  if (!address) return '未知地址'
  const prefix = address.substring(0, 6)
  const suffix = address.substring(address.length - 4)
  return `${prefix}...${suffix}`
}

/**
 * 格式化时间
 */
function formatTime(timestamp) {
  if (!timestamp) return '--'
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

/**
 * 格式化倒计时
 */
function formatCountdown(seconds) {
  if (!seconds || seconds < 0) return '0秒'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}分${secs}秒`
}

/**
 * 格式化余额
 */
function formatBalance(balance) {
  if (balance === null || balance === undefined) return '--'
  const num = parseFloat(balance)
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

/**
 * 延迟执行
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 显示提示框
 */
function showToast(message, type = 'success', duration = 3000) {
  const toast = document.getElementById('toast')
  toast.textContent = message
  toast.className = `toast ${type} show`

  setTimeout(() => {
    toast.classList.remove('show')
  }, duration)
}

/**
 * 显示加载遮罩
 */
function showLoading(message = '处理中...') {
  const overlay = document.getElementById('loadingOverlay')
  const modalText = overlay.querySelector('.modal-text')
  modalText.textContent = message
  overlay.style.display = 'flex'
}

/**
 * 隐藏加载遮罩
 */
function hideLoading() {
  const overlay = document.getElementById('loadingOverlay')
  overlay.style.display = 'none'
}

/**
 * 防抖函数
 */
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * 节流函数
 */
function throttle(func, limit) {
  let inThrottle
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * 本地存储封装
 */
const storage = {
  get(key, defaultValue = null) {
    try {
      const value = localStorage.getItem(key)
      return value ? JSON.parse(value) : defaultValue
    } catch (error) {
      console.error('读取 localStorage 失败:', error)
      return defaultValue
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error('写入 localStorage 失败:', error)
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error('删除 localStorage 失败:', error)
    }
  }
}

/**
 * 加密存储（简化版，实际应用应使用更安全的加密方式）
 */
const secureStorage = {
  save(key, value) {
    // 简化的 Base64 编码，实际应使用 Web Crypto API
    const encoded = btoa(encodeURIComponent(JSON.stringify(value)))
    storage.set(key, encoded)
  },

  load(key) {
    const encoded = storage.get(key)
    if (!encoded) return null
    try {
      return JSON.parse(decodeURIComponent(atob(encoded)))
    } catch (error) {
      console.error('解密失败:', error)
      return null
    }
  },

  remove(key) {
    storage.remove(key)
  }
}
