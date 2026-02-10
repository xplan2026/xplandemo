// 侧边栏导航
document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar')
  const sidebarToggle = document.getElementById('sidebarToggle')
  const navItems = document.querySelectorAll('.nav-item')
  const pages = document.querySelectorAll('.page')
  const walletStatus = document.getElementById('walletStatus')

  // 侧边栏切换（移动端）
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open')
    })
  }

  // 点击外部关闭侧边栏（移动端）
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      if (!sidebar.contains(e.target) && !sidebarToggle?.contains(e.target)) {
        sidebar.classList.remove('open')
      }
    }
  })

  // 页面切换
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault()

      const targetPage = item.dataset.page

      // 更新导航状态
      navItems.forEach(nav => nav.classList.remove('active'))
      item.classList.add('active')

      // 切换页面
      pages.forEach(page => {
        if (page.dataset.page === targetPage) {
          page.style.display = 'block'
        } else {
          page.style.display = 'none'
        }
      })

      // 关闭移动端侧边栏
      if (window.innerWidth <= 768) {
        sidebar.classList.remove('open')
      }
    })
  })

  // 检查钱包连接状态
  function checkWalletStatus() {
    // 检查 localStorage 或 sessionStorage 中的钱包连接信息
    const walletConnected = localStorage.getItem('walletConnected') === 'true'
    const walletAddress = localStorage.getItem('walletAddress')

    if (walletConnected && walletAddress) {
      walletStatus.innerHTML = `
        <span class="status-icon">🟢</span>
        <span class="status-text">${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}</span>
      `
    } else {
      walletStatus.innerHTML = `
        <span class="status-icon">🔴</span>
        <span class="status-text">未连接钱包</span>
      `
    }
  }

  // 初始检查
  checkWalletStatus()

  // 定期检查钱包状态
  setInterval(checkWalletStatus, 5000)

  // 监听来自官网的跨域消息
  window.addEventListener('message', (event) => {
    // 验证来源（从环境变量读取）
    const allowedOriginsEnv = import.meta.env.VITE_ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173,http://localhost:5174'
    const allowedOrigins = allowedOriginsEnv.split(',').map(origin => origin.trim())

    if (allowedOrigins.includes(event.origin)) {
      if (event.data && event.data.type === 'WALLET_CONNECTED') {
        // 验证消息结构
        if (!event.data.address || !/^0x[a-fA-F0-9]{40}$/.test(event.data.address)) {
          console.warn('Invalid wallet address in message')
          return
        }

        // 保存钱包连接信息
        localStorage.setItem('walletConnected', 'true')
        localStorage.setItem('walletAddress', event.data.address)
        localStorage.setItem('walletChainId', event.data.chainId)
        localStorage.setItem('walletConnectTime', Date.now().toString())

        // 更新UI
        checkWalletStatus()

        // 发送确认消息
        event.source.postMessage({
          type: 'WALLET_CONNECTED_ACK',
          address: event.data.address
        }, event.origin)
      } else if (event.data && event.data.type === 'WALLET_DISCONNECTED') {
        // 清除钱包连接信息
        localStorage.removeItem('walletConnected')
        localStorage.removeItem('walletAddress')
        localStorage.removeItem('walletChainId')
        localStorage.removeItem('walletConnectTime')

        // 更新UI
        checkWalletStatus()
      }
    }
  })

  // 暴露全局函数供官网调用
  window.connectWalletFromOfficialSite = (address, chainId) => {
    localStorage.setItem('walletConnected', 'true')
    localStorage.setItem('walletAddress', address)
    localStorage.setItem('walletChainId', chainId)
    checkWalletStatus()
    return true
  }

  window.disconnectWalletFromOfficialSite = () => {
    localStorage.removeItem('walletConnected')
    localStorage.removeItem('walletAddress')
    localStorage.removeItem('walletChainId')
    checkWalletStatus()
    return true
  }
})
