# Cloudflare Workers 环境变量配置
# 部署到 Cloudflare (223864287@QQ.com) 时需要配置的环境变量

---

## Worker-1: Interception (抢先转移)

### 环境变量 [vars]
```toml
WORKER_ID = "worker-1-interception"
WORKER_TYPE = "interception"
BSC_RPC = "https://bsc-rpc.publicnode.com"
EMERGENCY_SCAN_INTERVAL = 5      # 应急状态扫描间隔（秒）
EMERGENCY_MAX_DURATION = 900     # 应急状态最大时长（秒，15分钟）- 延长防止过早退出
BNB_THRESHOLD = 0.001            # BNB阈值（触发应急状态）
WKEYDAO_THRESHOLD = 0            # wkeyDAO阈值（检测余额）
MAX_SCAN_DURATION = 7000          # 最大扫描超时（毫秒）
MAX_TRANSFER_DURATION = 7000      # 最大转账超时（毫秒）

# 代币配置
TOKEN_BNB = "0x0000000000000000000000000000000000000000"
TOKEN_WKEYDAO = "0x194B302a4b0a79795Fb68E2ADf1B8c9eC5ff8d1F"
TOKEN_ADDRESSES = "0x0000000000000000000000000000000000000000,0x194B302a4b0a79795Fb68E2ADf1B8c9eC5ff8d1F"

# 写入延迟（分钟）- worker-1 立即写入
WRITE_DELAY_MINUTES = 0

# 缓存TTL（秒）
WHITELIST_CACHE_TTL = 300
SYSTEM_CONFIG_CACHE_TTL = 600

# 被保护钱包地址（逗号分隔，3个）
PROTECTED_WALLETS = "0xADDRESS1,0xADDRESS2,0xADDRESS3"
```

### Secrets (使用 wrangler secret put 配置)
```bash
# 安全钱包地址（接收转出的资产）
wrangler secret put SAFE_WALLET

# Supabase 数据库配置
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_KEY

# JWT 签名密钥
wrangler secret put JWT_SECRET

# 各个被保护钱包的私钥
wrangler secret put WALLET_PRIVATE_KEY_0xADDRESS1
wrangler secret put WALLET_PRIVATE_KEY_0xADDRESS2
wrangler secret put WALLET_PRIVATE_KEY_0xADDRESS3
```

---

## Worker-3: Surveillance (监控告警)

### 环境变量 [vars]
```toml
WORKER_ID = "worker-3-surveillance"
WORKER_NAME = "Surveillance"

# 盗币者钱包地址（默认值）
THIEF_ADDRESS_1 = "0x4A01eFCdA6d077A8AF6555Aa83Bc11E7be093561"
THIEF_ADDRESS_2 = "0xF95B911a3d26b076a10aC726Fde5D800972104B4"

# 被保护地址
PROTECTED_ADDRESS_1 = "0xADDRESS1"
PROTECTED_ADDRESS_2 = "0xADDRESS2"
PROTECTED_ADDRESS_3 = "0xADDRESS3"
```

### Secrets (可选)
```bash
# Supabase 数据库配置（可选，用于记录告警）
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_KEY
```

---

## Worker-4: Turbine (涡轮监控)

### 环境变量 [vars]
```toml
WORKER_ID = "worker-4-turbine"
WORKER_NAME = "Turbine Monitor"

# 涡轮合约地址
TURBINE_CONTRACT_ADDRESS = "0xa8aCdd81F46633b69AcB6ec5c16Ee7E00cc8938D"

# 被保护地址（可以配置多个涡轮合约）
PROTECTED_ADDRESS_1 = "0xADDRESS1"
PROTECTED_ADDRESS_2 = "0xADDRESS2"
PROTECTED_ADDRESS_3 = "0xADDRESS3"
```

### Secrets (可选)
```bash
# Supabase 数据库配置（可选，用于记录告警）
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_KEY
```

---

## KV 命名空间配置

所有 Worker 共享同一个 KV 命名空间：`EMERGENCY_STORE`

```toml
[[kv_namespaces]]
binding = "EMERGENCY_STORE"
id = "YOUR_EMERGENCY_KV_ID"
preview_id = "YOUR_PREVIEW_EMERGENCY_KV_ID"
```

**创建 KV 命名空间**：
```bash
wrangler kv:namespace create EMERGENCY_STORE
wrangler kv:namespace create EMERGENCY_STORE --preview
```

---

## 部署步骤

### 1. 切换到 Cloudflare 帐号
```bash
npx wrangler login
```

### 2. 创建 KV 命名空间（只需一次）
```bash
cd cloudflare/worker-1-interception
wrangler kv:namespace create EMERGENCY_STORE
wrangler kv:namespace create EMERGENCY_STORE --preview

# 将返回的 ID 更新到各个 worker 的 wrangler.toml 中
```

### 3. 部署 Worker-1（不需要数据库）
```bash
cd cloudflare/worker-1-interception

# 配置环境变量（编辑 wrangler.toml）
# 配置 Secrets
wrangler secret put SAFE_WALLET
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_KEY
wrangler secret put JWT_SECRET
wrangler secret put WALLET_PRIVATE_KEY_0xADDRESS1
wrangler secret put WALLET_PRIVATE_KEY_0xADDRESS2
wrangler secret put WALLET_PRIVATE_KEY_0xADDRESS3

# 部署
npx wrangler deploy
```

### 4. 启用新的 Supabase 帐号并初始化数据库
```bash
# 在 Supabase 控制台创建新项目
# 执行 supabase/00-init.sql 初始化脚本
```

### 5. 部署 Worker-3
```bash
cd cloudflare/worker-3-surveillance

# 更新 KV namespace ID（与 Worker-1 相同）
# 配置环境变量（编辑 wrangler.toml）

# 部署
npx wrangler deploy
```

### 6. 部署 Worker-4
```bash
cd cloudflare/worker-4-turbine

# 更新 KV namespace ID（与 Worker-1 相同）
# 配置环境变量（编辑 wrangler.toml）

# 部署
npx wrangler deploy
```

---

## 验证部署

### 检查 Worker-1
```bash
curl https://worker-1-interception.YOUR_SUBDOMAIN.workers.dev/health
```

### 检查 Worker-3
```bash
curl https://worker-3-surveillance.YOUR_SUBDOMAIN.workers.dev/health
```

### 检查 Worker-4
```bash
curl https://worker-4-turbine.YOUR_SUBDOMAIN.workers.dev/health
```

---

## 关键修复说明

### 应急状态过早退出问题已修复

**修复内容**：
1. **Worker-1 现在会读取应急状态**（KV: `emergency_state`）
2. **进入应急循环**：5秒扫描一次所有被保护钱包
3. **检测到 wkeyDAO>0 后转账，但不退出**（继续监控）
4. **应急状态时长延长到15分钟**（从10分钟）

**修复原理**：
- Worker-3/4 发现转账后写入 KV 标记
- Worker-1 定时任务检查 KV 标记
- 发现标记后进入应急循环
- 应急循环中持续监控，不退出

**部署后验证**：
1. 确认 Worker-1 能读取应急状态
2. 确认应急循环能正常运行
3. 确认转账后不退出，继续监控
4. 确认15分钟后超时退出

---

**创建日期**: 2026-01-22
**负责人**: 开心 (Happy)
