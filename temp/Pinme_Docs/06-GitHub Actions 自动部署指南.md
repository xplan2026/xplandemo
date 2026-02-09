# 使用 PinMe 的 GitHub Actions 自动部署

使用 GitHub Actions 与 PinMe CLI，把网站自动部署到 IPFS。本指南将带你搭建完整的 CI/CD 流水线，把 Web 项目部署到去中心化存储，并实现接近零停机的更新。

## [INFO] 概览
GitHub Actions + PinMe 可以提供：

- 自动化部署：代码变更自动触发部署
- 零停机体验：通过 IPFS 内容寻址实现平滑更新
- 版本可追溯：每次部署都绑定到一个提交（commit）
- 低成本：IPFS 存储不需要传统托管费用
- ENS 集成：自动把域名绑定到部署内容

## [LIST] 前置条件
开始之前，请确认：

- GitHub 仓库：包含你的 Web 项目的公开或私有仓库
- PinMe 账号：从 PinMe 官网 获取 AppKey
- 基础 Git 知识：了解分支与提交
- Node.js 项目：有可构建的 Web 项目（Vite、Webpack 等）

## [TOOL] 配置指南

### 步骤 1：获取 PinMe AppKey
- 打开 PinMe 官网
- 连接钱包并注册
- 进入 Settings → API Keys
- 生成或复制你的 AppKey
- 格式：<address>-<jwt-token>

### 步骤 2：配置 GitHub Secrets
- 仓库 → Settings → Secrets and variables → Actions
- 点击 “New repository secret”
- 新增 PINME_APPKEY，值为你的 AppKey

### 步骤 3：创建 GitHub Actions 工作流
- 在仓库中创建 .github/workflows/deploy.yml：
```yaml
name: Deploy to PinMe

on:
  # Automatic trigger on specific file changes
  push:
    branches:
      - main
      - master
    paths:
      - 'src/**'           # Source code changes
      - 'package.json'     # Dependency changes
      - 'vite.config.ts'   # Build configuration changes
      - 'build/deploy_gke.yml'  # Deployment configuration
  
  # Manual trigger option
  workflow_dispatch:
    inputs:
      domain:
        description: 'Custom domain name (optional)'
        required: false
        type: string
      build_dir:
        description: 'Build directory (default: dist)'
        required: false
        default: 'dist'
        type: string

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'  # or 'pnpm'/'yarn'

      - name: Install dependencies
        run: npm ci  # or 'pnpm install'/'yarn install'

      - name: Build project
        run: npm run build  # Adjust to your build command

      - name: Install PinMe CLI
        run: npm install -g pinme

      - name: Deploy to PinMe
        env:
          PINME_APPKEY: ${{ secrets.PINME_APPKEY }}
        run: |
          # Set up PinMe authentication
          pinme set-appkey "$PINME_APPKEY"
          
          # Deploy with custom or default domain
          if [ -n "${{ github.event.inputs.domain }}" ]; then
            DOMAIN="${{ github.event.inputs.domain }}"
          else
            # Auto-generate domain from repository name
            DOMAIN=$(echo "${{ github.repository }}" | tr '[:upper:]' '[:lower:]' | tr '/' '-')
          fi
          
          # Upload build directory
          pinme upload "dist" --domain "$DOMAIN"
```
## [CONFIG] 高级配置
### 触发条件（文件变化）
通过 paths 控制什么时候触发部署：
```yaml
on:
  push:
    paths:
      - 'src/**'              # Monitor source code changes
      - 'package.json'        # Monitor dependency updates
      - 'vite.config.ts'      # Monitor build config
      - 'public/**'           # Monitor static assets
```
### 多环境部署
区分不同环境：
```yaml
jobs:
  deploy-staging:
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      # ... setup steps
      - name: Deploy to Staging
        run: pinme upload "dist" --domain "my-project-staging.pinit.eth.limo"
  
  deploy-production:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      # ... setup steps
      - name: Deploy to Production
        run: pinme upload "dist" --domain "my-project.pinit.eth.limo"
```
### 构建缓存
用缓存提升构建速度：
```yaml
- name: Cache dependencies
  uses: actions/cache@v4
  with:
    path: |
      ~/.npm
      node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```
## [EXAMPLE] 常见用例

### 1. React/Vue/Angular 应用
```yaml
- name: Build React App
  run: npm run build

- name: Deploy to PinMe
  run: pinme upload "build" --domain "my-react-app.pinit.eth.limo"
```
### 2. 静态站点生成器
```yaml
- name: Build Hugo Site
  run: hugo --minify

- name: Deploy to PinMe
  run: pinme upload "public" --domain "my-hugo-site.pinit.eth.limo"
```
### 3. 文档站点
```yaml
- name: Build Documentation
  run: npm run build:docs

- name: Deploy to PinMe
  run: pinme upload "docs-dist" --domain "my-docs.pinit.eth.limo"
```
## [DEBUG] 监控与排错
### 查看部署历史
```bash
# 查看 PinMe 上传历史
pinme list

# 查看某次部署详情
pinme info <cid>
```
### 排查失败部署
- 查看 GitHub Actions 日志：检查 workflow run logs
- 验证 AppKey：确认 PINME_APPKEY 的值与格式正确
- 确认构建输出：确保 build 成功且输出目录正确
- 网络问题：确认能访问 IPFS 网络

### 常见问题与解决方案
1. 问题：“AppKey authentication failed”
解决：确认 PINME_APPKEY 的格式与有效性

2. 问题：“Build directory not found”
解决：确认构建产物目录存在（例如 dist/build/out）

3. 问题：“Domain already in use”
解决：换一个唯一域名，或等待上次部署完成

## [GUIDE] 最佳实践
### 1. 优化构建性能
- name: Use CI-optimized build
  run: npm run build:ci  # Custom build script optimized for CI
### 2. 区分环境配置
```yaml
- name: Configure environment
  run: |
    if [ "${{ github.ref }}" == "refs/heads/main" ]; then
      export NODE_ENV=production
    else
      export NODE_ENV=staging
    fi
    npm run build
```
### 3. 回滚策略
```yaml
- name: Deploy with rollback option
  run: |
    # Store previous deployment info for potential rollback
    PREV_CID=$(pinme list --limit 1 --format json | jq -r '.[0].cid')
    
    # Deploy new version
    NEW_CID=$(pinme upload "dist" --domain "my-app.pinit.eth.limo" --output json | jq -r '.cid')
    
    echo "Previous CID: $PREV_CID"
    echo "New CID: $NEW_CID"
```
## [LINK] 与其他服务集成
### 自定义域名
```yaml
- name: Deploy with custom domain
  run: |
    pinme upload "dist" --domain "www.mywebsite.com" --custom-domain
```
### 分析/统计集成
```yaml
- name: Add analytics
  run: |
    # Insert analytics script before deployment
    sed -i 's|</head>|<script src="https://analytics.example.com/tracker.js"></script></head>|' dist/index.html
    pinme upload "dist" --domain "my-app.pinit.eth.limo"
```
### CDN 集成
```yaml
- name: Update CDN
  run: |
    CID=$(pinme upload "dist" --domain "my-app.pinit.eth.limo" --output json | jq -r '.cid')
    curl -X POST "https://api.cloudflare.com/client/v4/zones/zone_id/purge_cache" \
      -H "Authorization: Bearer $CF_TOKEN" \
      -H "Content-Type: application/json" \
      --data '{"purge_everything":true}'
```
## 总结
借助 GitHub Actions + PinMe，你可以获得强大、免费的自动化部署流水线，具备：

- 通过 IPFS 内容寻址实现的低停机/平滑部署
- 随流量增长的天然扩展性
- 分布式网络上的持久存储
- 无传统托管费用的成本优势
- 通过自动化提升研发效率

现在就开始自动化部署，加入去中心化网络的浪潮！