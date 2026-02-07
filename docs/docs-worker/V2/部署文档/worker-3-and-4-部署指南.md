# Worker-3 和 Worker-4 部署指南

## 概述

本文档说明如何部署 Worker-3（监控盗币者钱包）和 Worker-4（监控涡轮合约）。

---

## 前置条件

1. **Cloudflare 账号**: 需要有 Cloudflare 账号并登录
2. **Wrangler CLI**: 已安装 Wrangler CLI
3. **KV 命名空间**: 需要创建 KV 命名空间

---

## 部署步骤

### 1. 安装依赖

```bash
cd /workspace/cloudflare
npm install
```

### 2. 创建 KV 命名空间

```bash
# 创建生产环境 KV 命名空间
wrangler kv:namespace create "BLOCK_STORE"

# 创建预览环境 KV 命名空间
wrangler kv:namespace create "BLOCK_STORE" --preview
```

将返回的 ID 分别填入 `worker-3-surveillance/wrangler.toml` 和 `worker-4-turbine/wrangler.toml` 中的 `id` 和 `preview_id` 字段。

### 3. 配置环境变量

#### Worker-3: Surveillance

```bash
cd worker-3-surveillance

# 配置盗币者钱包地址
wrangler secret put THIEF_ADDRESS_1
# 输入: 0x4A01eFCdA6d077A8AF6555Aa83Bc11E7be093561

wrangler secret put THIEF_ADDRESS_2
# 输入: 0xF95B911a3d26b076a10aC726Fde5D800972104B4

# 配置被保护钱包地址
wrangler secret put PROTECTED_ADDRESS_1
# 输入: 你的被保护地址1

wrangler secret put PROTECTED_ADDRESS_2
# 输入: 你的被保护地址2

wrangler secret put PROTECTED_ADDRESS_3
# 输入: 你的被保护地址3
```

#### Worker-4: Turbine

```bash
cd worker-4-turbine

# 配置涡轮合约地址（可选，有默认值）
wrangler secret put TURBINE_CONTRACT_ADDRESS
# 输入: 0xa8aCdd81F46633b69AcB6ec5c16Ee7E00cc8938D

# 配置被保护钱包地址
wrangler secret put PROTECTED_ADDRESS_1
# 输入: 你的被保护地址1

wrangler secret put PROTECTED_ADDRESS_2
# 输入: 你的被保护地址2

wrangler secret put PROTECTED_ADDRESS_3
# 输入: 你的被保护地址3
```

### 4. 部署 Worker

#### 单独部署

```bash
# 部署 Worker-3
cd worker-3-surveillance
npm run deploy

# 部署 Worker-4
cd worker-4-turbine
npm run deploy
```

#### 批量部署（从根目录）

```bash
cd /workspace/cloudflare
npm run deploy:all
```

---

## 配置说明

### Cron Trigger 配置

两个 Worker 都配置为每分钟执行一次：

```toml
[triggers]
crons = ["* * * * *"]
```

如需调整频率，修改 `wrangler.toml` 中的 `crons` 配置。

### RPC 节点配置

默认使用 RpcPoolExtension 的公共节点列表。如需自定义节点：

```bash
# 设置自定义 RPC 节点列表
wrangler secret put BSC_RPC_NODES
# 输入: https://bsc-rpc.publicnode.com,https://bsc-dataseed1.binance.org/
```

---

## 测试

### 健康检查

```bash
# Worker-3
curl https://your-worker-3.workers.dev/health

# Worker-4
curl https://your-worker-4.workers.dev/health
```

### 手动触发监控

```bash
# Worker-3
curl -X POST https://your-worker-3.workers.dev/api/check

# Worker-4
curl -X POST https://your-worker-4.workers.dev/api/check
```

---

## 监控日志

查看 Worker 执行日志：

```bash
# Worker-3
cd worker-3-surveillance
npm run tail

# Worker-4
cd worker-4-turbine
npm run tail
```

---

## 应急状态触发

当前实现将应急状态写入 KV 存储：

```javascript
await env.BLOCK_STORE.put('emergency_state', JSON.stringify({
  triggered: true,
  triggerSource: 'worker-3-surveillance' 或 'worker-4-turbine',
  triggeredAt: new Date().toISOString(),
  transferDetails: transferDetails
}), {
  expirationTtl: 600 // 10分钟过期
})
```

Worker-1 可以通过读取 KV 来检测应急状态。

---

## 注意事项

1. **KV 命名空间**: Worker-3 和 Worker-4 需要共享同一个 KV 命名空间
2. **环境变量**: 确保所有必需的环境变量都已配置
3. **Cron 频率**: 每分钟执行一次，如需调整请修改 wrangler.toml
4. **日志监控**: 使用 `npm run tail` 查看实时日志
5. **应急状态**: 当前使用 KV 存储，后续可改为数据库或直接调用 Worker-1 API

---

## 故障排查

### Worker 无法启动

1. 检查 KV 命名空间 ID 是否正确
2. 检查环境变量是否完整
3. 查看日志：`npm run tail`

### 交易查询失败

1. 检查 RPC 节点是否可用
2. 查看 RpcPoolExtension 的节点列表
3. 检查网络连接

### 应急状态未触发

1. 检查 KV 命名空间配置
2. 查看日志确认是否检测到转账
3. 检查钱包地址配置是否正确

---

**文档版本**: v1.0.0
**创建日期**: 2026-01-19
