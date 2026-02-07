# Integrated-Pool-2 前端管理界面

**版本**: v2.4.1
**基于版本**: v2.4.0
**状态**: 开发中
**目标 Worker**: integrated-pool-2

---

## 项目简介

这是 Integrated-Pool-2 的前端管理界面，提供可视化的 API 访问和资产管理功能。

**注意**: 本前端仅针对 `integrated-pool-2` Worker（辅助账户），不支持主账户 Worker 的管理。

---

## 功能特性

### 1. 钱包状态监控
- 实时显示所有被保护钱包的余额
- 显示钱包状态（正常/转账/应急）
- 支持自动刷新（每 30 秒）
- 点击钱包卡片查看详情

### 2. 应急状态监控
- 查看所有处于应急状态的钱包
- 显示锁定该钱包的 Worker
- 实时倒计时显示锁的剩余时间

### 3. 手动触发扫描
- 手动触发完整扫描
- 显示扫描进度和结果
- 需要 API Key 认证

### 4. Worker 重启
- 手动重启 Worker
- 清除分布式锁和缓存
- 需要 API Key 认证

### 5. 健康检查
- 检查 Worker 运行状态
- 显示 Worker ID 和时间戳
- 自动定期检查

### 6. API 密钥管理
- 安全存储 API Key（本地加密）
- 支持显示/隐藏切换
- 持久化保存

---

## 技术栈

- **HTML5** - 语义化标签
- **CSS3** - Flexbox/Grid 布局
- **JavaScript (ES6+)** - 原生 JavaScript
- **无框架** - 轻量级，无需构建

---

## 项目结构

```
frontend/
├── index.html              # 主页面
├── css/
│   ├── variables.css       # CSS 变量
│   └── styles.css         # 主样式
├── js/
│   ├── utils.js           # 工具函数
│   ├── api.js             # API 调用封装
│   ├── components.js       # UI 组件
│   └── app.js             # 主应用逻辑
├── assets/
│   └── images/           # 图片资源
└── README.md             # 本文档
```

---

## 快速开始

### 本地开发

1. 克隆项目
```bash
git clone <repository-url>
cd frontend
```

2. 直接打开 index.html
```bash
# 使用浏览器打开
open index.html

# 或使用本地服务器
npx serve .
```

3. 配置 API Key
- 在页面底部的"API 密钥管理"区域输入 API Key
- 点击"保存"按钮

---

## 部署

### 方案 1：Cloudflare Pages（推荐）

1. 将 `frontend/` 目录推送到 GitHub
2. 在 Cloudflare Pages 中连接仓库
3. 配置构建设置：
   - 构建命令：留空
   - 输出目录：`frontend/`
4. 部署

### 方案 2：GitHub Pages

1. 在 GitHub 仓库设置中启用 GitHub Pages
2. 选择 `frontend/` 目录作为源
3. 自动部署

### 方案 3：与 Worker 一起部署

修改 Worker 代码，添加静态资源路由：
```javascript
// 在 Worker 的 fetch 处理中添加
if (url.pathname === '/' || url.pathname === '/index.html') {
  return new Response(indexHtml, {
    headers: { 'Content-Type': 'text/html' }
  })
}
```

---

## API 配置

默认 API 地址：
- 主地址：`https://api.weare.run`
- 备用地址：`https://api.weare.run`

修改 API 地址：
```javascript
// js/api.js
const API_CONFIG = {
  main: 'your-worker-url',
  backup: 'your-backup-worker-url'
}
```

---

## 安全说明

1. **API Key 存储**
   - API Key 存储在浏览器的 localStorage 中
   - 使用 Base64 编码（简化加密）
   - 仅在本地使用，不会发送到其他服务器

2. **CORS 配置**
   - Worker 需要配置 CORS 头
   - 允许前端跨域访问

3. **HTTPS**
   - 建议使用 HTTPS 部署
   - 保护 API Key 传输安全

---

## 浏览器兼容性

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- 移动端浏览器

---

## 开发计划

### 阶段 1：基础设施 ✅
- [x] 创建项目结构
- [x] 实现 API 调用封装
- [x] 实现基础 UI 组件
- [x] 实现核心功能

### 阶段 2：优化和完善 🔄
- [ ] UI/UX 优化
- [ ] 添加更多图表
- [ ] 优化响应式布局
- [ ] 添加错误处理

### 阶段 3：测试和部署 📋
- [ ] 本地测试
- [ ] 部署到 Cloudflare Pages
- [ ] 功能测试
- [ ] 性能优化

---

## 相关文档

- [Worker-Integrated-Pool-API文档.md](../docs/V2/v2.4.0/Worker-Integrated-Pool-API文档.md) - 后端 API 文档
- [v2.4.1-前端开发规划.md](../docs/V2/v2.4.1-前端开发规划.md) - 前端开发规划

---

## 许可证

MIT License

---

**最后更新**: 2026-02-02
