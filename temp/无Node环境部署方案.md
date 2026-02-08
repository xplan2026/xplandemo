# 无 Node.js 环境部署 Cloudflare Workers 方案

**当前环境**: 无 Node.js、无 npm、无 wrangler CLI

---

## ❌ 不可行方案

### 1. npx 方式
```bash
npx wrangler deploy
```
**问题**: npx 是 npm 的工具，需要 Node.js 环境

### 2. Python 脚本方式
**问题**: 当前环境没有 Python

### 3. 浏览器插件方式
**问题**: Cloudflare Workers 浏览器插件主要用于管理，不支持部署本地代码

---

## ✅ 可行方案

### 方案 1: 使用 Cloudflare Workers Dashboard（推荐）

**优点**:
- 无需本地安装任何工具
- 直接在浏览器中编辑和部署
- 适合简单项目和快速测试

**步骤**:

1. **登录 Cloudflare Dashboard**:
   - 访问 https://dash.cloudflare.com
   - 登录你的 Cloudflare 账户

2. **创建 Worker**:
   - 导航到 "Workers & Pages"
   - 点击 "Create Application"
   - 选择 "Create Worker"
   - 命名为 `tactics-1`

3. **复制代码**:
   - 打开 `cloudflare/tactics-1/src/index.js`
   - 复制所有代码

4. **粘贴到 Dashboard**:
   - 在 Workers 编辑器中粘贴代码
   - 点击 "Save and Deploy"

5. **配置 Secrets**:
   - 在 Workers Dashboard 中
   - 点击 "Settings" → "Variables and Secrets"
   - 添加以下 secrets:
     - `API_KEY`: `G6oZh6uNasK2n8ntJROCiDwtvu6lq4lNo2fGNdsMXFsOEmXM`
     - `SUPABASE_URL`: `https://jkugpzhhetpiplnzbguw.supabase.co`
     - `SUPABASE_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`（从 .env 获取）
     - `WALLET_PRIVATE_KEY_32af405726ba6bd2f9b7ecdfed3bdd9b590c0939`: `<从 .env 获取>`
     - `SAFE_WALLET_PRIVATE_KEY`: `<从 .env 获取>`
     - `GAS_FUNDING_WALLET_PRIVATE_KEY`: `<从 .env 获取>`

6. **配置环境变量**（如果需要）:
   - 在同一页面添加环境变量
   - 根据需要配置

---

### 方案 2: 使用 GitHub Actions 自动部署

**优点**:
- 通过 GitHub 集成自动部署
- 无需本地环境
- 代码推送后自动触发部署

**步骤**:

1. **创建 GitHub Actions 工作流**:
   - 在 `.github/workflows/deploy.yml` 中创建配置
   - 配置 Cloudflare API Token
   - 配置触发条件（push 到 master）

2. **配置 GitHub Secrets**:
   - 在 GitHub 仓库设置中添加:
     - `CLOUDFLARE_API_TOKEN`: 你的 Cloudflare API Token
     - `CLOUDFLARE_ACCOUNT_ID`: `1b9f2ccbdc655cf10384c9ef205b6eab`

3. **推送代码**:
   - 推送代码到 GitHub
   - GitHub Actions 自动执行部署

**示例工作流**:

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [master]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v2
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy cloudflare/tactics-1
```

---

### 方案 3: 安装 Node.js 到本地目录（便携版）

**优点**:
- 完整的 wrangler CLI 功能
- 适合开发环境

**步骤**:

1. **下载 Node.js 便携版**:
   - 访问 https://nodejs.org/download/release/
   - 下载 `node-v20.10.0-win-x64.zip`（最新稳定版）

2. **解压到项目目录**:
   ```powershell
   # 解压到 d:/TOBEHOST/xplan2026/tools/node/
   # 目录结构：
   # d:/TOBEHOST/xplan2026/
   #   tools/
   #     node/
   #       node.exe
   #       npm.cmd
   #       npx.cmd
   #       ...
   ```

3. **使用 Node.js**:
   ```powershell
   # 添加到 PATH（临时）
   $env:PATH = "d:\TOBEHOST\xplan2026\tools\node;$env:PATH"

   # 验证
   node --version
   npm --version

   # 使用 wrangler
   cd d:/TOBEHOST/xplan2026/cloudflare/tactics-1
   npx wrangler deploy
   ```

4. **创建批处理脚本**:
   ```batch
   @echo off
   set PATH=d:\TOBEHOST\xplan2026\tools\node;%PATH%
   npx wrangler deploy
   ```

---

### 方案 4: 使用 Cloudflare API 直接部署

**优点**:
- 无需 wrangler CLI
- 可以使用 PowerShell 或其他工具

**步骤**:

1. **准备 API Token**:
   - 从 Cloudflare Dashboard 生成 API Token
   - 权限: Workers Script Edit + Workers Scripts Storage Edit

2. **准备 Worker 代码**:
   ```powershell
   # 读取 Worker 代码
   $workerCode = Get-Content "cloudflare/tactics-1/src/index.js" -Raw

   # 压缩代码（可选）
   # ...

   # 调用 Cloudflare API
   $apiToken = "your-cloudflare-api-token"
   $accountId = "1b9f2ccbdc655cf10384c9ef205b6eab"
   $scriptName = "tactics-1"

   $headers = @{
       "Authorization" = "Bearer $apiToken"
       "Content-Type" = "application/javascript"
   }

   $url = "https://api.cloudflare.com/client/v4/accounts/$accountId/workers/scripts/$scriptName"

   Invoke-RestMethod -Uri $url -Method PUT -Headers $headers -Body $workerCode
   ```

3. **配置 Secrets**:
   ```powershell
   $secretName = "API_KEY"
   $secretValue = "G6oZh6uNasK2n8ntJROCiDwtvu6lq4lNo2fGNdsMXFsOEmXM"

   $secretUrl = "https://api.cloudflare.com/client/v4/accounts/$accountId/workers/scripts/$scriptName/secrets/$secretName"

   $headers = @{
       "Authorization" = "Bearer $apiToken"
       "Content-Type" = "application/json"
   }

   $body = @{
       "text" = $secretValue
   } | ConvertTo-Json

   Invoke-RestMethod -Uri $secretUrl -Method PUT -Headers $headers -Body $body
   ```

---

## 📊 方案对比

| 方案 | 难度 | 功能完整性 | 推荐度 |
|------|------|------------|--------|
| Workers Dashboard | ⭐ | 基础 | ⭐⭐⭐⭐⭐（快速测试） |
| GitHub Actions | ⭐⭐ | 完整 | ⭐⭐⭐⭐⭐（CI/CD） |
| Node.js 便携版 | ⭐⭐⭐ | 完整 | ⭐⭐⭐⭐（开发） |
| Cloudflare API | ⭐⭐⭐⭐ | 完整 | ⭐⭐⭐（自动化） |

---

## 🎯 推荐方案

### 当前环境最佳方案: **Workers Dashboard**

**理由**:
- ✅ 无需安装任何工具
- ✅ 直接在浏览器中操作
- ✅ 快速部署和测试
- ✅ 适合当前环境

### 长期方案: **GitHub Actions**

**理由**:
- ✅ 代码推送自动部署
- ✅ 无需本地环境
- ✅ 适合团队协作

---

## 🔧 具体操作指南

### 使用 Workers Dashboard 部署 tactics-1

**步骤**:

1. **登录**: https://dash.cloudflare.com

2. **创建 Worker**:
   - Workers & Pages → Create Application → Create Worker
   - 名称: `tactics-1`

3. **上传代码**:
   - 编辑器中打开 `cloudflare/tactics-1/src/index.js`
   - 全选复制（Ctrl+A, Ctrl+C）
   - 粘贴到 Workers Dashboard 编辑器
   - Save and Deploy

4. **配置 Secrets**:
   - Settings → Variables and Secrets
   - Add secret 逐个添加

5. **测试**:
   - 访问 Worker URL: `https://tactics-1.<你的账户名>.workers.dev/health`

---

## 📝 总结

**当前环境**: 无 Node.js、npm、wrangler CLI

**推荐方案**: **Cloudflare Workers Dashboard**

**理由**:
- ✅ 无需安装任何工具
- ✅ 操作简单直观
- ✅ 适合快速部署和测试

---

**如需长期开发环境，建议安装 Node.js 便携版或配置 GitHub Actions。**
