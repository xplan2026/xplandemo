# Wrangler 登录与配置记录

**记录日期**: 2026-01-22
**最后更新**: 2026-01-31

---

## Cloudflare 账户信息

### 账户 1 (v2.0.0 - 备份部署，生产中)

- **邮箱**: 2238642875@qq.com
- **账户 ID**: ef9cd986c28831a3f85041a8cf08990a
- **状态**: v2.0.0 版本部署在此账号，**生产环境中运行**
- **说明**: 备份部署策略，与 v2.3.0 同时运行

### 账户 2 (v2.3.0 - 主部署，生产中)

- **邮箱**: 3813518962@qq.com
- **账户 ID**: 7d8c0fb0cc70cda866c1f942a543417c
- **状态**: v2.3.0 版本部署在此账号，**生产环境中运行**
- **说明**: Worker-Turns 架构主部署

---

## 问题描述

在云 IDE 环境中，wrangler 4.x 版本无法通过 OAuth 登录，因为回调服务器无法正常工作。

---

## 解决方案

### 步骤 1: 使用 API Token 方式（推荐）

**wrangler 4.x 和 3.x 都支持通过环境变量使用 API Token，无需 OAuth 登录。**

使用最新版本 wrangler：

```bash
# 安装最新版本 wrangler
npm install -g wrangler

# 验证版本
npx wrangler --version
# 输出: ⛅️ wrangler 4.x.x
```

### 步骤 1.1: 创建 API Token

1. 访问 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. 点击 "Create Token"
3. 选择模板 "Edit Cloudflare Workers"
4. 配置权限：
   - **Workers Scripts**: Edit
   - **Workers KV Storage**: Edit
   - **Workers Routes**: Edit
   - **Workers Tail**: Read
   - **Workers Observability**: Edit
   - **Account Settings**: Read
5. 创建后复制 Token

### 步骤 1.2: 使用 API Token 部署

**⚠️ 重要：使用 wrangler 4.x 时，必须在 Worker 子目录内运行部署命令**

```bash
# 方法1: 直接在命令中设置环境变量
cd /workspace/cloudflare/worker-turns-1
CLOUDFLARE_API_TOKEN=你的token npx wrangler deploy

# 方法2: 设置环境变量后部署
export CLOUDFLARE_API_TOKEN=你的token
cd /workspace/cloudflare/worker-turns-1
npx wrangler deploy
```

### 步骤 1.3: 使用 API Token 操作 KV

```bash
# 创建 KV 命名空间
CLOUDFLARE_API_TOKEN=你的token npx wrangler kv namespace create "KV"

# 设置 Secret
CLOUDFLARE_API_TOKEN=你的token npx wrangler secret put JWT_SECRET
```

---

### 步骤 2: (可选) 使用 wrangler 3.78.0

如果遇到 wrangler 4.x 兼容性问题，可以降级到 3.78.0：

```bash
# 安装 wrangler 3.78.0
npm install -g wrangler@3.78.0

# 验证版本
npx wrangler --version
# 输出: ⛅️ wrangler 3.78.0

# 使用方式与 wrangler 4.x 完全相同
CLOUDFLARE_API_TOKEN=你的token npx wrangler deploy
```

### 步骤 2: 创建 KV 命名空间

使用 `CLOUDFLARE_API_TOKEN` 环境变量指定 API Token。

#### 2.1 v2.0.0 KV 命名空间（账户 1，备用）

**账户 ID**: ef9cd986c28831a3f85041a8cf08990a

```bash
cd /workspace/cloudflare/worker-1-interception
CLOUDFLARE_API_TOKEN=<token_账户1> npx wrangler kv namespace create "KV"
```

**KV 命名空间 ID**:
- KV: `3e1113416486489b9b40f237b6c153ef`
- EMERGENCY_STORE: `81b0112734e14e69954ab06648bf5bfa`

#### 2.2 v2.3.0 KV 命名空间（账户 2，当前使用）

**账户 ID**: 7d8c0fb0cc70cda866c1f942a543417c

```bash
cd /workspace/cloudflare/worker-turns-1
CLOUDFLARE_API_TOKEN=<token_账户2> npx wrangler kv namespace create "EMERGENCY_STORE"
```

**创建 KV 命名空间（用于缓存）**:
```bash
CLOUDFLARE_API_TOKEN=<token_账户2> npx wrangler kv namespace create "KV"
```

**输出**:
```
🌀 Creating namespace with title "worker-turns-1-KV"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
[[kv_namespaces]]
binding = "KV"
id = "657a2769de12494f9df1e07a9ee256ba"
```

**创建 EMERGENCY_STORE 命名空间（用于应急状态）**:

```bash
CLOUDFLARE_API_TOKEN=<token_账户2> npx wrangler kv namespace create "EMERGENCY_STORE"
```

**输出**:
```
🌀 Creating namespace with title "worker-turns-1-EMERGENCY_STORE"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
[[kv_namespaces]]
binding = "EMERGENCY_STORE"
id = "fcaf59ca0248424b9a13605484fe3120"
```

### 步骤 3: 更新 wrangler.toml

#### 3.1 v2.0.0 wrangler.toml 配置（账户 1，备份部署）

```toml
# 账户 1 (v2.0.0 备用)
account_id = "ef9cd986c28831a3f85041a8cf08990a"

# KV 命名空间绑定
[[kv_namespaces]]
binding = "KV"
id = "3e1113416486489b9b40f237b6c153ef"
preview_id = ""

# 应急状态KV命名空间绑定
[[kv_namespaces]]
binding = "EMERGENCY_STORE"
id = "81b0112734e14e69954ab06648bf5bfa"
preview_id = ""
```

#### 3.2 v2.3.0 wrangler.toml 配置（账户 2，主部署）

```toml
# 账户 2 (v2.3.0 当前)
account_id = "7d8c0fb0cc70cda866c1f942a543417c"

# KV 命名空间绑定
[[kv_namespaces]]
binding = "EMERGENCY_STORE"
id = "fcaf59ca0248424b9a13605484fe3120"
preview_id = ""
```

---

## 配置的 KV 命名空间

### v2.0.0（账户 1，备份部署，生产中）

| 命名空间 | Binding | Namespace ID | 用途 |
|---------|----------|-------------|------|
| KV | KV | 3e1113416486489b9b40f237b6c153ef | 缓存 |
| EMERGENCY_STORE | EMERGENCY_STORE | 81b0112734e14e69954ab06648bf5bfa | 应急状态存储 |

### v2.3.0（账户 2，主部署，生产中）

| 命名空间 | Binding | Namespace ID | 用途 |
|---------|----------|-------------|------|
| EMERGENCY_STORE | EMERGENCY_STORE | fcaf59ca0248424b9a13605484fe3120 | 应急状态存储 |

**生产环境部署**:
- 主部署: 账户 2 (3813518962@qq.com, v2.3.0)
- 备份部署: 账户 1 (2238642875@qq.com, v2.0.0)

---

## API Token 权限

使用的 API Token 需要以下权限：

- **Workers Scripts**: Edit
- **Workers KV Storage**: Edit
- **Workers Routes**: Edit
- **Workers Tail**: Read
- **Workers Observability**: Edit
- **Account Settings**: Read

---

## 故障排查

### 问题 1: 403 Forbidden 错误

**原因**: API Token 权限不足或已过期。

**解决**:
1. 检查 API Token 权限是否完整
2. 重新创建 API Token
3. 使用正确的账户 ID

### 问题 2: 端口 8976 被占用

**原因**: 之前的 wrangler 进程仍在运行。

**解决**:
```bash
lsof -ti:8976 | xargs kill -9 2>/dev/null
```

### 问题 3: OAuth 登录失败

**原因**: 云 IDE 环境中 OAuth 回调服务器无法正常工作。

**解决**: 使用 API Token 方式（推荐），无需 OAuth 登录：
```bash
CLOUDFLARE_API_TOKEN=你的token npx wrangler deploy
```

---

## 后续部署命令

### 部署 Worker-1

```bash
cd /workspace/cloudflare/worker-1-interception
CLOUDFLARE_API_TOKEN=<your_token> npx wrangler deploy
```

### 配置 Secrets

```bash
# 设置 JWT_SECRET
CLOUDFLARE_API_TOKEN=<your_token> npx wrangler secret put JWT_SECRET
# 粘贴: BY1chdKPhKb4RE7Swy0zNyDyRF3MId2hFC2BQmXgsxc=

# 设置 EMERGENCY_PRIVATE_KEY
CLOUDFLARE_API_TOKEN=<your_token> npx wrangler secret put EMERGENCY_PRIVATE_KEY
# 粘贴: f8e693b0b2ddef40187350d2cfba0e020e855b5796fc28769d7c3fc9c229b60c

# 设置 SAFE_WALLET
CLOUDFLARE_API_TOKEN=<your_token> npx wrangler secret put SAFE_WALLET
# 粘贴安全钱包地址

# 设置各被保护钱包的私钥
CLOUDFLARE_API_TOKEN=<your_token> npx wrangler secret put WALLET_PRIVATE_KEY_<钱包地址小写>
# 示例: WALLET_PRIVATE_KEY_0x123abc...
# 注意: 使用钱包完整地址并转为小写
```

---

## 环境配置

### Supabase 配置

- **SUPABASE_URL**: `YOUR_SUPABASE_URL`
- **SUPABASE_KEY**: `YOUR_SUPABASE_KEY`（service_role 密钥）

### 生成密钥

- **JWT_SECRET**: `<KEY>`
- **EMERGENCY_PRIVATE_KEY**: `<KEY>`

---

## 关键命令速查

```bash
# 检查 wrangler 版本
npx wrangler --version

# 检查登录状态
npx wrangler whoami

# 创建 KV 命名空间（需要 API Token）
CLOUDFLARE_API_TOKEN=<your_token> npx wrangler kv namespace create "<namespace_name>"

# 部署 Worker（需要 API Token）
CLOUDFLARE_API_TOKEN=<your_token> npx wrangler deploy

# 设置 Secret（需要 API Token）
CLOUDFLARE_API_TOKEN=<your_token> npx wrangler secret put <secret_name>
```

---

**最后更新**: 2026-01-22
