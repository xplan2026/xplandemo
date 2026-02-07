# Cloudflare Workers 依赖管理指南

## 概述

X-plan Cloudflare Workers 采用**统一依赖管理**策略，避免在每个 Worker 目录中重复安装依赖，减少仓库体积和维护成本。

## 目录结构

```
cloudflare/
├── package.json              # 统一的依赖配置
├── node_modules/             # 统一的依赖安装目录
├── worker-1-interception/    # Worker-1
│   └── package.json         # 引用根目录依赖
├── worker-2-scheduler/       # Worker-2
│   └── package.json         # 引用根目录依赖
├── worker-3-surveillance/   # Worker-3
│   └── package.json         # 引用根目录依赖
└── extensions/              # 扩展模块
    └── database/           # 数据库扩展
```

## 统一依赖配置

### 根目录 package.json

所有 Worker 共用的依赖在 `cloudflare/package.json` 中定义：

```json
{
  "name": "x-plan-cloudflare",
  "version": "2.0.0",
  "dependencies": {
    "ethers": "^6.13.0"
  },
  "devDependencies": {
    "wrangler": "^3.78.0"
  }
}
```

### 子 Worker package.json

每个 Worker 的 `package.json` 使用 `file:` 协议引用根目录的依赖：

```json
{
  "name": "worker-1-interception",
  "dependencies": {
    "ethers": "file:../node_modules/ethers"
  },
  "devDependencies": {
    "wrangler": "file:../node_modules/wrangler"
  }
}
```

## 安装流程

### 首次安装

```bash
cd cloudflare

# 1. 安装根目录依赖
npm install

# 2. 各 Worker 无需单独安装，直接使用根目录依赖
```

### 更新依赖

```bash
cd cloudflare

# 更新根目录依赖
npm update

# 或者更新特定包
npm install ethers@latest
npm install wrangler@latest
```

## 常用命令

### 根目录统一命令

```bash
cd cloudflare

# 安装所有 Worker 依赖（如果需要）
npm run install:all

# 启动 Worker-1 开发环境
npm run dev:w1

# 启动 Worker-2 开发环境
npm run dev:w2

# 启动 Worker-3 开发环境
npm run dev:w3

# 部署 Worker-1
npm run deploy:w1

# 部署 Worker-2
npm run deploy:w2

# 部署 Worker-3
npm run deploy:w3

# 部署所有 Worker
npm run deploy:all
```

### 单独 Worker 命令

```bash
# 进入 Worker 目录
cd cloudflare/worker-1-interception

# 开发
npm run dev

# 部署
npm run deploy

# 测试
npm run test
```

## 优势

1. **减少体积** - 避免在每个 Worker 中重复安装相同的依赖
2. **统一版本** - 所有 Worker 使用相同版本的依赖，避免兼容性问题
3. **简化维护** - 只需在一个地方更新依赖
4. **提高效率** - 安装和更新依赖更快
5. **节省空间** - 减少 node_modules 占用空间

## 注意事项

1. **依赖引用** - 使用 `file:../node_modules/包名` 引用根目录依赖
2. **路径正确** - 确保 `../node_modules` 路径正确
3. **根目录优先** - 始终在根目录执行依赖安装和更新
4. **wrangler 兼容** - 每个 Worker 独立的 `wrangler.toml` 配置

## 故障排查

### 依赖找不到

**问题**：`Cannot find module 'ethers'`

**解决方案**：
```bash
cd cloudflare
npm install
```

### wrangler 命令不可用

**问题**：`wrangler: command not found`

**解决方案**：
```bash
cd cloudflare
npm install wrangler --save-dev
```

### Worker 部署失败

**问题**：`Error: Cannot resolve dependency`

**解决方案**：
```bash
# 检查依赖引用路径是否正确
cat worker-1-interception/package.json

# 重新安装依赖
cd cloudflare
rm -rf node_modules
npm install
```

## 扩展模块依赖

扩展模块（`extensions/`）同样遵循统一依赖管理策略：

```json
// extensions/database/package.json
{
  "name": "database-extension",
  "dependencies": {
    "ethers": "file:../node_modules/ethers"
  }
}
```

## 最佳实践

1. **统一安装** - 始终在根目录执行依赖安装
2. **版本锁定** - 在根目录 package.json 中锁定依赖版本
3. **定期更新** - 定期检查并更新依赖版本
4. **测试验证** - 更新依赖后进行充分测试
5. **文档同步** - 更新依赖时同步更新文档

---

**文档创建日期**: 2026-01-16
**维护者**: X-plan 开发团队
