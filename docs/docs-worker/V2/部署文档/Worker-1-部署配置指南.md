# Worker-1 部署配置指南

**创建日期**: 2026-01-22
**用途**: Worker-1 (Interception Worker) 部署到 Cloudflare Workers 的完整配置指南

---

## 概述

Worker-1 是核心拦截 Worker，负责：
- 常规扫描（每分钟）
- 应急状态扫描（每5秒）
- 执行转账任务
- 提供 HTTP API 接口

---

## 前置条件

### 1. Cloudflare 账号
- 已创建 Cloudflare 账号
- 已登录 Cloudflare Dashboard

### 2. Supabase 项目
- 已创建 Supabase 项目
- 已执行数据库初始化脚本（`/workspace/supabase/00-init.sql`）
- **Supabase URL**: `https://rambqnvegbwesbqjacka.supabase.co`
- **Supabase Key**: `sb_publishable_6P34EUtHr-aolLESfwz-HQ_w4y1Vael`

### 3. KV 命名空间
需要在 Cloudflare Dashboard 中创建：
- `KV` - 用于缓存
- `EMERGENCY_STORE` - 用于存储应急状态

---

## 环境变量配置

### 在 Cloudflare Dashboard 中配置

进入 Cloudflare Dashboard → Workers & Pages → Worker-1 → Settings → Variables → Environment Variables

添加以下环境变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `WORKER_ID` | `worker-1-interception` | Worker 标识 |
| `WORKER_TYPE` | `interception` | Worker 类型 |
| `BSC_RPC` | `https://bsc-rpc.publicnode.com` | BSC RPC 节点 |
| `EMERGENCY_SCAN_INTERVAL` | `5` | 应急扫描间隔（秒） |
| `EMERGENCY_MAX_DURATION` | `900` | 应急最大时长（秒，15分钟） |
| `BNB_THRESHOLD` | `0.001` | BNB 阈值 |
| `WKEYDAO_THRESHOLD` | `0` | wkeyDAO 阈值 |
| `MAX_SCAN_DURATION` | `7000` | 最大扫描超时（毫秒） |
| `MAX_TRANSFER_DURATION` | `7000` | 最大转账超时（毫秒） |
| `TOKEN_BNB` | `0x0000000000000000000000000000000000000000` | BNB 代币地址 |
| `TOKEN_WKEYDAO` | `0x194B302a4b0a79795Fb68E2ADf1B8c9eC5ff8d1F` | wkeyDAO 代币地址 |
| `TOKEN_ADDRESSES` | `0x0000000000000000000000000000000000000000,0x194B302a4b0a79795Fb68E2ADf1B8c9eC5ff8d1F` | 代币地址列表 |
| `WRITE_DELAY_MINUTES` | `0` | 写入延迟（分钟） |
| `WHITELIST_CACHE_TTL` | `300` | 白名单缓存TTL（秒） |
| `SYSTEM_CONFIG_CACHE_TTL` | `600` | 系统配置缓存TTL（秒） |
| `SUPABASE_URL` | `https://rambqnvegbwesbqjacka.supabase.co` | Supabase 项目 URL |
| `SUPABASE_KEY` | `sb_publishable_6P34EUtHr-aolLESfwz-HQ_w4y1Vael` | Supabase 密钥（**使用 service_role 密钥**） |

---

## Secrets 配置

### Secrets 需要通过 wrangler CLI 配置

进入项目根目录，执行以下命令：

#### 1. JWT_SECRET（JWT 签名密钥）

**已生成密钥**: `BY1chdKPhKb4RE7Swy0zNyDyRF3MId2hFC2BQmXgsxc=`

设置 JWT_SECRET：
```bash
npx wrangler secret put JWT_SECRET
# 粘贴: BY1chdKPhKb4RE7Swy0zNyDyRF3MId2hFC2BQmXgsxc=
```

#### 2. SAFE_WALLET_PRIVATE_KEY（安全钱包私钥）

设置安全钱包私钥（用于接收转账）：
```bash
npx wrangler secret put SAFE_WALLET_PRIVATE_KEY
# 粘贴安全钱包私钥（不要包含 0x 前缀）
```

#### 3. EMERGENCY_PRIVATE_KEY（应急状态签名私钥）

**已生成密钥**: `f8e693b0b2ddef40187350d2cfba0e020e855b5796fc28769d7c3fc9c229b60c`

设置 EMERGENCY_PRIVATE_KEY：
```bash
npx wrangler secret put EMERGENCY_PRIVATE_KEY
# 粘贴: f8e693b0b2ddef40187350d2cfba0e020e855b5796fc28769d7c3fc9c229b60c
```

#### 4. WALLET_PRIVATE_KEY_xxxx（被保护钱包私钥）

为每个被保护钱包设置私钥（xxxx 替换为钱包地址后4位）：

```bash
# 示例：钱包地址 0x1234567890abcdef1234567890abcdef12345678
npx wrangler secret put WALLET_PRIVATE_KEY_5678
# 粘贴该钱包的私钥（不要包含 0x 前缀）
```

如果有多个被保护钱包，为每个钱包设置对应的私钥。

---

## KV 命名空间绑定

### 1. 创建 KV 命名空间

在 Cloudflare Dashboard 中创建两个 KV 命名空间：

- **KV**（用于缓存）
  - 命名空间名称：`worker-1-cache`
  - 创建后会获得 `namespace_id`

- **EMERGENCY_STORE**（用于应急状态）
  - 命名空间名称：`emergency-store`
  - 创建后会获得 `namespace_id`

### 2. 绑定 KV 命名空间

在 `wrangler.toml` 中配置 KV 绑定：

```toml
# KV 命名空间绑定
[[kv_namespaces]]
binding = "KV"
id = "YOUR_KV_ID"  # 替换为实际的 KV namespace_id
preview_id = "YOUR_PREVIEW_KV_ID"

# 应急状态KV命名空间绑定
[[kv_namespaces]]
binding = "EMERGENCY_STORE"
id = "YOUR_EMERGENCY_KV_ID"  # 替换为实际的 EMERGENCY_STORE namespace_id
preview_id = "YOUR_PREVIEW_EMERGENCY_KV_ID"
```

---

## 部署步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 wrangler.toml

更新 `cloudflare/worker-1-interception/wrangler.toml` 中的：
- `account_id` - 您的 Cloudflare 账户 ID
- KV 命名空间的 `id` 和 `preview_id`

### 3. 配置环境变量

在 Cloudflare Dashboard 中配置所有环境变量（见上表）。

### 4. 配置 Secrets

使用 wrangler CLI 配置所有 Secrets（见上文）。

### 5. 部署

```bash
# 进入 Worker-1 目录
cd cloudflare/worker-1-interception

# 部署到 Cloudflare
npx wrangler deploy
```

### 6. 验证部署

```bash
# 检查 Worker 状态
npx wrangler tail

# 或者访问健康检查接口
curl https://worker-1-interception.你的子域名.workers.dev/health
```

预期返回：
```json
{
  "status": "ok",
  "service": "worker-1-interception",
  "worker_id": "worker-1-interception",
  "timestamp": "2026-01-22T10:00:00.000Z",
  "database": {
    "supabase": true,
    "kv": true,
    "auth": true,
    "transaction": true,
    "system": true
  }
}
```

---

## 配置检查清单

部署前请确认：

- [ ] Supabase 项目已创建
- [ ] 数据库初始化脚本已执行
- [ ] Supabase URL 和 Key 已配置
- [ ] KV 命名空间已创建并绑定
- [ ] JWT_SECRET 已生成并配置
- [ ] SAFE_WALLET_PRIVATE_KEY 已配置
- [ ] EMERGENCY_PRIVATE_KEY 已生成并配置
- [ ] 所有被保护钱包私钥已配置（WALLET_PRIVATE_KEY_xxxx）
- [ ] wrangler.toml 中的 account_id 已更新
- [ ] KV namespace_id 已配置到 wrangler.toml

---

## 常见问题

### Q: SUPABASE_KEY 应该使用哪个密钥？

**A**: 使用 **service_role** 密钥（不是 `anon public` 密钥）。

在 Supabase Dashboard → Project Settings → API 中：
- `anon public` → 前端使用
- `service_role` → 后端使用（Worker 需要使用这个）

### Q: 为什么需要 EMERGENCY_PRIVATE_KEY？

**A**: 用于验证应急状态的签名。当 Worker-3/4 触发应急状态时，会使用该私钥进行签名验证，防止恶意触发。

### Q: WALLET_PRIVATE_KEY_xxxx 的命名规则是什么？

**A**: `xxxx` 是被保护钱包地址的后4位。

例如：
- 钱包地址：`0x1234567890abcdef1234567890abcdef12345678`
- Secret 名称：`WALLET_PRIVATE_KEY_5678`

### Q: Worker-1 可以独立部署吗？

**A**: 可以。Worker-1 不依赖其他 Worker，可以独立运行。但需要：
- Supabase 数据库（必需）
- KV 命名空间（必需）
- 其他 Worker 不影响 Worker-1 的核心功能

### Q: 如何验证 Worker-1 是否正常工作？

**A**: 访问健康检查接口：
```bash
curl https://worker-1-interception.你的子域名.workers.dev/health
```

检查返回的 `database` 字段，所有值都应为 `true`。

### Q: Worker-1 的定时任务是什么？

**A**: Worker-1 每分钟执行一次扫描（通过 Cron 设置）：
- Cron 表达式：`* * * * *`（每分钟）
- 常规扫描：检测资产转入并触发转账
- 应急状态：检测到应急状态后进入 5 秒高频扫描

---

## 附录：Supabase 密钥获取

### 1. 获取 SUPABASE_URL

在 Supabase Dashboard → Project Settings → API 中：
- Project URL → 复制到 `SUPABASE_URL`
- 示例：`https://rambqnvegbwesbqjacka.supabase.co`

### 2. 获取 SUPABASE_KEY

在 Supabase Dashboard → Project Settings → API 中：
- **service_role** secret → 复制到 `SUPABASE_KEY`
- 注意：不要使用 `anon public` 密钥

---

**最后更新**: 2026-01-22
