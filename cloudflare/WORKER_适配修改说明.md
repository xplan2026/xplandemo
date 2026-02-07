# Worker 代码适配修改说明

## 📋 概述

本文档记录了从原 BSC 项目迁移到 Polygon Amoy X-plan Demo 项目的所有修改。

---

## 🔧 主要修改内容

### 1. 网络配置变更

| 项目 | 原项目 (BSC) | 新项目 (Polygon Amoy) |
|------|----------------|----------------------|
| 网络 | BSC Mainnet | Polygon Amoy Testnet |
| Chain ID | 56 | 80002 |
| Gas 代币 | BNB | POL |
| Gas 精度 | 18 | 18 |

### 2. RPC 节点变更

#### 原项目 RPC
```javascript
env.BSC_RPC || 'https://bsc-rpc.publicnode.com'
```

#### 新项目 RPC
```javascript
env.POLYGON_AMOY_RPC || 'https://rpc-amoy.polygon.technology'
```

#### 备用 RPC 列表
```javascript
const providerUrls = [
  'https://rpc-amoy.polygon.technology',
  'https://rpc.ankr.com/polygon_amoy',
  'https://polygon-amoy.blockpi.network/v1/rpc/public'
]
```

### 3. 代币配置变更

| 项目 | 原项目 | 新项目 |
|------|---------|---------|
| 资产代币 | wkeyDAO | XPD |
| 代币地址 | `0x194B302a4b0a79795Fb68E2ADf1B8c9eC5ff8d1F` | `0x35774A4E1fFEee74Fa3859F89cfae00b3aC8C3A8` |
| 代币精度 | 18 | 9 |
| USDT | 支持 | **删除（不需要）** |

### 4. 钱包地址配置变更

| 变量名 | 原项目 | 新项目 |
|---------|---------|---------|
| 被保护地址 | `PROTECTED_WALLET` | `PROTECTED_ADDRESS` |
| 安全地址 | `SAFE_WALLET` | `SAFE_ADDRESS` |
| Gas 费地址 | `GAS_FUNDING_WALLET` | `GAS_ADDRESS` |

---

## 📁 已修改的文件

### ✅ extensions/scanner/TacticsScanner.js

**修改内容**：
- ✅ RPC URL 改为 Polygon Amoy
- ✅ 代币从 wkeyDAO/USDT 改为 XPD
- ✅ 删除 USDT 相关逻辑
- ✅ BNB 阈值改为 POL 阈值
- ✅ XPD 精度设置为 9

**关键代码变化**：
```javascript
// 旧代码
this.wkeyDaoToken = env.TOKEN_WKEYDAO || '0x194B302a4b0a79795Fb68E2ADf1B8c9eC5ff8d1F'
this.usdtToken = env.TOKEN_USDT || '0x55d398326f99059fF775485246999027B3197955'
this.bnbThreshold = parseFloat(env.BNB_THRESHOLD || '0.0005')

// 新代码
this.xpdToken = env.TOKEN_XPD || '0x35774A4E1fFEee74Fa3859F89cfae00b3aC8C3A8'
this.xpdDecimals = parseInt(env.TOKEN_XPD_DECIMALS || '9')
this.polThreshold = parseFloat(env.POL_THRESHOLD || '0.001')
```

---

### ✅ extensions/transfer/Transfer.js

**修改内容**：
- ✅ RPC URL 改为 Polygon Amoy
- ✅ 代币从 wkeyDAO/USDT 改为 XPD
- ✅ 删除 USDT 转账逻辑
- ✅ BNB 转账改为 POL 转账
- ✅ Gas 策略适配 POL
- ✅ XPD 精度设置为 9

**关键代码变化**：
```javascript
// 旧代码
this.tokenWkeyDao = env.TOKEN_WKEYDAO || '0x194B302a4b0a79795Fb68E2ADf1B8c9eC5ff8d1F'
this.tokenUsdt = env.TOKEN_USDT || '0x55d398326f99059fF775485246999027B3197955'
this.provider = new ethers.JsonRpcProvider(env.BSC_RPC || 'https://bsc-rpc.publicnode.com')

// 新代码
this.xpdToken = env.TOKEN_XPD || '0x35774A4E1fFEee74Fa3859F89cfae00b3aC8C3A8'
this.xpdDecimals = parseInt(env.TOKEN_XPD_DECIMALS || '9')
this.provider = new ethers.JsonRpcProvider(env.POLYGON_AMOY_RPC || 'https://rpc-amoy.polygon.technology')
```

---

### ✅ extensions/gas/GasFunder.js

**修改内容**：
- ✅ RPC URL 改为 Polygon Amoy
- ✅ BNB 改为 POL
- ✅ Gas 费相关变量名更新

**关键代码变化**：
```javascript
// 旧代码
this.minBnbForGas = 0.001
this.targetBnbBalance = 0.001
this.gasFundingWallet = this.env.GAS_FUNDING_WALLET
this.provider = new ethers.JsonRpcProvider(
  this.env.BSC_RPC || 'https://bsc-rpc.publicnode.com'
)

// 新代码
this.minPolForGas = 0.001
this.targetPolBalance = 0.001
this.gasFundingWallet = this.env.GAS_FUNDING_WALLET
this.provider = new ethers.JsonRpcProvider(
  this.env.POLYGON_AMOY_RPC || 'https://rpc-amoy.polygon.technology'
)
```

---

## 📝 待修改的文件

以下文件需要进一步修改，但还未完成：

### ⏳ cloudflare/tactics-1/src/index.js

**需要添加**：
- ✅ 前端"开始测试"按钮的 API 端点
- ✅ 应急状态控制 API
- ✅ 余额查询 API
- ✅ 日志查询 API

**API 端点列表**：
```javascript
// 测试转账 API
app.post('/api/test/transfer', async (ctx) => {
  // 从安全钱包转移 1 XPD 到被保护钱包
  // 金额：1 XPD (1000000000，精度 9)
})

// 应急状态控制
app.post('/api/emergency/start', async (ctx) => {
  // 启动应急模式
  // 扫描频率改为 5 秒/次
})

app.post('/api/emergency/stop', async (ctx) => {
  // 关闭应急模式
  // 扫描频率改为 60 秒/次
})

// 查询状态
app.get('/api/status', async (ctx) => {
  // 返回当前状态
  // mode: 'normal' | 'emergency'
  // scanInterval: 60 | 5
  // lastScanTime: ISO 时间戳
})

// 查询余额
app.get('/api/balance', async (ctx) => {
  // 返回被保护钱包的余额
  // xpdBalance: string
  // polBalance: string
  // lastUpdated: ISO 时间戳
})

// 查询日志
app.get('/api/logs', async (ctx) => {
  // 返回操作日志
  // logs: Array<{ timestamp, level, category, message, txHash }>
  // total: number
})
```

---

## 🔧 环境变量配置

### 需要配置的环境变量

```bash
# ========================================
# 网络配置
# ========================================
POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology
CHAIN_ID=80002

# ========================================
# 钱包地址配置
# ========================================
PROTECTED_ADDRESS=0x9aC84d4B9A6Dd8aF9aB2aC8d4aF9Bd8A7Bd6aF9b
SAFE_ADDRESS=0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b
GAS_ADDRESS=0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5

# ========================================
# 钱包私钥配置（仅 Worker 使用）
# ========================================
WALLET_PRIVATE_KEY_PROTECTED=0x7b9d9c8e2f3a4b5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d
WALLET_PRIVATE_KEY_SAFE=0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a
WALLET_PRIVATE_KEY_GAS=0x2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2

# ========================================
# 代币配置
# ========================================
TOKEN_XPD=0x35774A4E1fFEee74Fa3859F89cfae00b3aC8C3A8
TOKEN_XPD_DECIMALS=9

# ========================================
# 阈值配置
# ========================================
POL_THRESHOLD=0.001
XPD_THRESHOLD=0.01

# ========================================
# 扫描间隔配置
# ========================================
SCAN_INTERVAL_NORMAL=60
SCAN_INTERVAL_EMERGENCY=5

# ========================================
# Supabase 配置（可选）
# ========================================
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

---

## 🚀 部署前检查清单

### 代码检查
- [ ] 所有文件中的 `BSC_RPC` 已改为 `POLYGON_AMOY_RPC`
- [ ] 所有文件中的 `wkeyDAO` 已改为 `XPD`
- [ ] 所有文件中的 `USDT` 相关代码已删除
- [ ] 所有文件中的 `BNB` 已改为 `POL`
- [ ] XPD 代币精度设置为 9
- [ ] 钱包地址变量名已更新

### 环境变量检查
- [ ] `POLYGON_AMOY_RPC` 已配置
- [ ] `CHAIN_ID` 设置为 80002
- [ ] `TOKEN_XPD` 设置为正确地址
- [ ] `TOKEN_XPD_DECIMALS` 设置为 9
- [ ] 三个钱包地址已配置
- [ ] 三个钱包私钥已配置
- [ ] Supabase 配置已设置（如需要）

### 功能测试
- [ ] 扫描器可以查询 XPD 余额
- [ ] 扫描器可以查询 POL 余额
- [ ] 转账功能正常工作
- [ ] Gas 费补充功能正常
- [ ] 应急模式切换正常
- [ ] API 端点响应正常

---

## 📊 测试步骤

### 1. 本地测试
```bash
cd cloudflare/tactics-1
npx wrangler dev
```

### 2. 测试 API 端点

#### 启动测试
```bash
curl -X POST http://localhost:8787/api/test/transfer \
  -H "Content-Type: application/json" \
  -d '{"amount": "1000000000"}'
```

#### 启动应急模式
```bash
curl -X POST http://localhost:8787/api/emergency/start
```

#### 查询余额
```bash
curl http://localhost:8787/api/balance
```

#### 查询状态
```bash
curl http://localhost:8787/api/status
```

### 3. 部署到 Cloudflare
```bash
npx wrangler deploy
```

---

最后更新: 2026-02-07
