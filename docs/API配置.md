# API 密钥配置文档

**生成日期**: 2026-02-08  
**版本**: v1.0.0

---

## 全局 API 密钥

### Worker API 密钥

用于保护 Cloudflare Worker 的 POST 端点（如 `/test/transfer`, `/emergency/enable` 等）。

**密钥**: 
```
<your-api-key-here>
```

**获取方式**:
- 在 `.env` 文件中配置 `API_SECRET_KEY`
- 或使用随机生成的密钥

**用途**:
- Worker 端点认证
- 前端 API 调用
- 保护敏感操作

**相关配置文件**:
- `.env` → `API_SECRET_KEY`
- `cloudflare/tactics-1/wrangler.toml` → `API_KEY` (Secret)

---

## 其他 API 密钥

### Supabase 密钥

**Supabase URL**:
```
https://jkugpzhhetpiplnzbguw.supabase.co
```

**Supabase Anon Key**:
```
<your-supabase-anon-key>
```

**Supabase Service Role Key**: 需要从 Supabase 控制台获取（用于服务器端操作）

**相关配置文件**:
- `.env` → `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

---

### Cloudflare API Token

用于部署和管理 Cloudflare Workers。

**Token**:
```
<your-cloudflare-api-token>
```

**Account ID**:
```
1b9f2ccbdc655cf10384c9ef205b6eab
```

**获取方式**:
1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 My Profile → API Tokens
3. 创建新的 API Token（权限：Edit Cloudflare Workers）

**相关配置文件**:
- `.env` → `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

---

## 钱包私钥

### 地址 A - 被保护地址

**地址**: `0x32af405726ba6bd2f9b7ecdfed3bdd9b590c0939`  
**私钥**: `<your-protected-wallet-private-key>`

**用途**: 
- 演示目标（在前端公示）
- 资产保护对象

---

### 地址 B - 安全地址

**地址**: `0x2a71e200d13558631831c3e78e88afde8464f761`  
**私钥**: `<your-safe-wallet-private-key>`

**用途**:
- 接收从地址 A 转移的资产
- 测试转账的发送方

---

### 地址 C - Gas 费地址

**地址**: `0x633be54ef2c776bedd8555afc1375847e4b5d8f3`  
**私钥**: `<your-gas-wallet-private-key>`

**用途**:
- 存储 POL 用于支付 Gas 费
- 补充地址 A 和 B 的 Gas 余额

---

## Worker Secrets 配置

### 部署到 Worker 时需要配置的 Secrets

使用以下命令设置 Worker Secrets：

```bash
cd d:/TOBEHOST/xplan2026/cloudflare/tactics-1

# 方法 1: 使用部署脚本（推荐）
PowerShell -ExecutionPolicy Bypass -File setup-secrets.ps1

# 方法 2: 手动配置
# 设置 API Key
npx wrangler secret put API_KEY
# 输入: <your-api-key>

# 设置 Supabase URL
npx wrangler secret put SUPABASE_URL
# 输入: https://jkugpzhhetpiplnzbguw.supabase.co

# 设置 Supabase Key
npx wrangler secret put SUPABASE_KEY
# 输入: <your-supabase-anon-key>

# 设置被保护钱包私钥
npx wrangler secret put WALLET_PRIVATE_KEY_32af405726ba6bd2f9b7ecdfed3bdd9b590c0939
# 输入: <your-protected-wallet-private-key>

# 设置安全钱包私钥
npx wrangler secret put SAFE_WALLET_PRIVATE_KEY
# 输入: <your-safe-wallet-private-key>

# 设置 Gas 费钱包私钥
npx wrangler secret put GAS_FUNDING_WALLET_PRIVATE_KEY
# 输入: <your-gas-wallet-private-key>
```

---

## 前端 API 配置

### 前端默认 API 配置

在 `frontend/DemoSite/js/api.js` 中：

```javascript
const API_CONFIG = {
  main: 'https://tactics-1.xplan2026.workers.dev',
  backup: 'https://tactics-1.xplan2026.workers.dev'
}

// API Key 通过前端界面输入，不在代码中硬编码
const API_KEY = ''  // 用户手动输入
```

---

## 安全注意事项

### ⚠️ 重要提醒

1. **不要将真实密钥提交到 Git**
   - `.env` 文件已在 `.gitignore` 中
   - 不要在代码中硬编码密钥
   - 文档中使用占位符

2. **密钥轮换**
   - 定期更换 API Key（建议每 3 个月）
   - 泄露后立即更换

3. **访问控制**
   - 使用最小权限原则
   - 限制 API Key 的使用范围

4. **前端使用**
   - 仅在演示环境使用此 API Key
   - 生产环境应使用更严格的认证机制

---

## 配置验证

### 验证 Worker Secret 配置

```bash
cd d:/TOBEHOST/xplan2026/cloudflare/tactics-1

# 列出所有 Secrets
npx wrangler secret list

# 查看特定 Secret（不显示值）
npx wrangler secret get API_KEY
```

### 验证前端 API 连接

访问 `https://tactics-1.xplan2026.workers.dev/health` 应返回：

```json
{
  "status": "healthy",
  "worker_id": "tactics-1",
  "worker_name": "tactics-1",
  "timestamp": "2026-02-08T..."
}
```

---

## 密钥生成

### 生成随机 API Key

**PowerShell**:
```powershell
$chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
$apiKey = -join ((1..48) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
Write-Output $apiKey
```

**Node.js**:
```javascript
const crypto = require('crypto')
const apiKey = crypto.randomBytes(24).toString('hex')
console.log(apiKey)
```

### 生成钱包私钥

**使用 MetaMask 或其他钱包工具生成**

---

## 更新历史

| 日期 | 版本 | 更新内容 |
|------|------|----------|
| 2026-02-08 | v1.0.0 | 初始配置，移除真实密钥，使用占位符 |
