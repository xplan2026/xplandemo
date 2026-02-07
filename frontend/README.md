# Frontend Projects

此目录包含两个独立的前端项目：

## 📁 项目结构

```
frontend/
├── official-site/          # 官网（X-plan 官方网站）
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
│
└── DemoSite/              # Demo 站点（功能演示）
    ├── src/
    ├── package.json
    └── vite.config.ts
```

---

## 🌐 官网 (Official Site)

### 说明
X-plan 官方网站，展示项目介绍、技术架构、应用场景等内容。

### 技术栈
- Vite + React 18 + TypeScript
- React Router v7
- Tailwind CSS
- Radix UI
- Motion (Framer Motion)

### 功能页面
- 首页 - 项目介绍和特性展示
- 应用场景 - X-plan 的使用场景
- 技术架构 - 技术实现说明
- 定价页面 - 价格方案
- Demo 链接 - 跳转到功能演示站点（需连接钱包登录）

### 启动方式
```bash
cd frontend/official-site
npm install
npm run dev
```

访问：http://localhost:5173

### 配置文件
- `.env` - 环境变量配置
- `vite.config.ts` - Vite 配置
- `package.json` - 依赖和脚本

---

## 🎮 Demo 站点 (Demo Site)

### 说明
功能演示网站，实现反盗币策略（Worker 功能）的完整演示。

### 技术栈
- Vite + React 18 + TypeScript
- ethers.js v6（Web3 交互）
- Tailwind CSS
- Supabase（数据存储）
- Cloudflare Worker API（后端服务）

### 核心功能
- **测试页面** - "开始测试"按钮，触发资产转移
- **模拟攻击页面** - 使用私钥模拟攻击
- **应急控制页面** - Worker 应急状态开关
- **监控日志页面** - 操作日志展示
- **Dashboard** - 实时余额监控和 Worker 状态

### 启动方式
```bash
cd frontend/DemoSite
npm install
npm run dev
```

访问：http://localhost:5174

### 配置文件
- `.env` - 环境变量配置
- `vite.config.ts` - Vite 配置
- `package.json` - 依赖和脚本

---

## 🔗 项目关联

### 官网 → Demo 站点
官网中的导航栏包含"功能演示"链接，用户点击后跳转到 Demo 站点。

**跳转条件**：
- 用户需先在官网连接钱包
- 连接钱包后才能访问 Demo 站点
- Demo 站点验证钱包签名

**实现方式**：
```typescript
// 官网导航组件
const navigateToDemo = async () => {
  const connected = await connectWallet();
  if (connected) {
    window.location.href = 'http://localhost:5174';
  }
};
```

---

## 📦 环境变量配置

### 官网环境变量
```bash
# frontend/official-site/.env
VITE_APP_NAME=X-plan Official Site
VITE_DEMO_SITE_URL=http://localhost:5174
```

### Demo 站点环境变量
```bash
# frontend/DemoSite/.env

# 区块链网络
VITE_POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
VITE_CHAIN_ID=80002

# 代币合约
VITE_TOKEN_CONTRACT_ADDRESS=0x35774A4E1fFEee74Fa3859F89cfae00b3aC8C3A8
VITE_TOKEN_DECIMALS=9

# API 端点
VITE_API_BASE_URL=http://localhost:8787/api

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# 钱包地址
VITE_PROTECTED_ADDRESS=0x9aC84d4B9A6Dd8aF9aB2aC8d4aF9Bd8A7Bd6aF9b
VITE_PROTECTED_PRIVATE_KEY=0x7b9d9c8e2f3a4b5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d
```

---

## 🚀 快速开始

### 1. 安装官网依赖
```bash
cd frontend/official-site
npm install
```

### 2. 安装 Demo 站点依赖
```bash
cd frontend/DemoSite
npm install
```

### 3. 启动两个项目
```bash
# 终端 1 - 官网
cd frontend/official-site
npm run dev

# 终端 2 - Demo 站点
cd frontend/DemoSite
npm run dev
```

---

## 📝 开发指南

### 官网开发
- 页面路由：`official-site/src/routes.tsx`
- 页面组件：`official-site/src/pages/`
- UI 组件：`official-site/src/components/`

### Demo 站点开发
- 页面路由：`DemoSite/src/routes.tsx`
- 页面组件：`DemoSite/src/pages/`
- API 服务：`DemoSite/src/services/api.ts`
- Web3 服务：`DemoSite/src/services/web3.ts`

---

最后更新: 2026-02-07
