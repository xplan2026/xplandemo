// API 调用封装

// API 配置 - 从环境变量读取
const API_CONFIG = {
  main: import.meta.env.VITE_API_MAIN_URL || 'https://tactics-1.xplan2026.workers.dev',
  backup: import.meta.env.VITE_API_BACKUP_URL || 'https://tactics-1.xplan2026.workers.dev'
}

// API 调用类
class WorkerAPI {
  constructor(baseUrl = API_CONFIG.main) {
    this.baseUrl = baseUrl
    this.backupUrl = API_CONFIG.backup
    this.apiKey = this.loadApiKey()
  }

  // 加载 API Key
  loadApiKey() {
    return secureStorage.load('worker_api_key') || ''
  }

  // 保存 API Key
  saveApiKey(key) {
    secureStorage.save('worker_api_key', key)
    this.apiKey = key
  }

  // 删除 API Key
  removeApiKey() {
    secureStorage.remove('worker_api_key')
    this.apiKey = ''
  }

  // 通用请求方法
  async request(endpoint, options = {}) {
    let url = `${this.baseUrl}${endpoint}`

    // 设置请求头
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    }

    // 如果需要认证，添加 API Key
    if (options.requireAuth) {
      if (!this.apiKey) {
        throw new Error('API Key 未设置')
      }
      headers['X-API-Key'] = this.apiKey
    }

    const requestOptions = {
      ...options,
      headers
    }

    try {
      const response = await fetch(url, requestOptions)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      return data
    } catch (error) {
      // 如果主地址失败，尝试备用地址
      if (this.baseUrl !== this.backupUrl) {
        console.warn('主地址请求失败，尝试备用地址:', error)
        url = `${this.backupUrl}${endpoint}`
        const response = await fetch(url, requestOptions)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || data.error || `HTTP ${response.status}: ${response.statusText}`)
        }

        return data
      }

      throw error
    }
  }

  // 获取健康状态
  async getHealth() {
    return this.request('/health')
  }

  // 获取钱包状态
  async getStatus() {
    return this.request('/status')
  }

  // 获取单个钱包详情
  async getWallet(address) {
    return this.request(`/wallet?address=${address}`)
  }

  // 获取应急状态
  async getEmergency() {
    return this.request('/emergency')
  }

  // 测试转账（新增）
  async testTransfer(amount = 1) {
    return this.request('/test/transfer', {
      method: 'POST',
      requireAuth: true,
      body: JSON.stringify({ amount })
    })
  }

  // 模拟转账（使用表单中的私钥）
  async simulateTransfer(data) {
    return this.request('/simulate/transfer', {
      method: 'POST',
      requireAuth: true,
      body: JSON.stringify(data)
    })
  }

  // 启用应急模式（新增）
  async enableEmergency() {
    return this.request('/emergency/enable', {
      method: 'POST',
      requireAuth: true
    })
  }

  // 禁用应急模式（新增）
  async disableEmergency() {
    return this.request('/emergency/disable', {
      method: 'POST',
      requireAuth: true
    })
  }

  // 手动触发扫描
  async scan() {
    return this.request('/scan', {
      method: 'POST',
      requireAuth: true
    })
  }

  // 手动重启 Worker
  async restart() {
    return this.request('/restart', {
      method: 'POST',
      requireAuth: true
    })
  }

  // 获取 API 文档
  async getApiDocs() {
    return this.request('/api-docs')
  }
}

// 创建全局 API 实例
const api = new WorkerAPI()

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WorkerAPI, api, API_CONFIG }
}
