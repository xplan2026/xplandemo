# Worker-Turns 部署指南

**版本**: v2.3.0  
**作者**: Milaifon Alex  
**日期**: 2026-01-29

---

## 一、概述

Worker-Turns 是 v2.3.0 的核心架构，由 3 个协同工作的 Worker 组成，实现分布式扫描和高可靠性资产保护。

### 架构特点

- **3 个 Worker 协同工作**: worker-turns-1/2/3
- **调度配置**: 分别在每分钟的 0 秒、20 秒、40 秒启动
- **扫描频率**: 总计 9 次/分钟（3 钱包 × 3 Worker）
- **CPU 负载均衡**: 每个 Worker 约 6 秒/分钟，避免过载
- **容错性强**: 单个 Worker 故障不影响其他 2 个
- **响应速度快**: 最长响应延迟 20 秒

---

## 二、部署准备

### 2.1 确认 KV 命名空间

3 个 Worker 共享以下 KV 命名空间：

| 绑定名称 | KV ID | 用途 |
|---------|-------|------|
| EMERGENCY_STORE | 4826f7e3ef8a4ca89ed3251ab615b924 | 应急状态存储 |
| RPC_POOL | c8f09dd5682942d7be33f89f6104fe8a | RPC 节点池 |

**注意**: 确保这些 KV 已在 Cloudflare Dashboard 中创建。

### 2.2 配置环境变量

3 个 Worker 共享相同的环境变量（除 `WORKER_ID` 和 `WORKER_NAME` 外）：

#### 需要在 wrangler.toml 中配置的变量：

```toml
[vars]
WORKER_ID = "worker-turns-1"  # 每个 Worker 不同
WORKER_NAME = "Turns-1"       # 每个 Worker 不同

PROTECTED_WALLETS = "0x9F4f...,0x3D39...,0x886b..."
BNB_THRESHOLD = "0.001"
MAX_SCAN_DURATION = "7000"
MAX_TRANSFER_DURATION = "7000"
EMERGENCY_SCAN_INTERVAL = "5"
EMERGENCY_MAX_DURATION = "900"
MIN_BNB_FOR_GAS = "0.0005"
TARGET_BNB_BALANCE = "0.002"
MAX_GAS_INSUFFICIENT_RETRIES = "3"
TOKEN_BNB = "0x0000000000000000000000000000000000000000"
TOKEN_WKEYDAO = "0x194B302a4b0a79795Fb68E2ADf1B8c9eC5ff8d1F"
TOKEN_USDT = "0x55d398326f99059fF775485246999027B3197955"
```

#### 需要使用 wrangler secret put 配置的变量：

```bash
# 进入每个 Worker 目录
cd /workspace/cloudflare/worker-turns-1

# 配置 Supabase 连接
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_KEY
wrangler secret put JWT_SECRET

# 配置安全钱包
wrangler secret put SAFE_WALLET

# 配置 Gas 补充钱包
wrangler secret put GAS_FUNDING_WALLET
wrangler secret put GAS_FUNDING_WALLET_PRIVATE_KEY

# 配置被保护钱包私钥（按钱包地址）
wrangler secret put WALLET_PRIVATE_KEY_0x9f4fba96e1d15f8547b9e41be957ff143c298e16
wrangler secret put WALLET_PRIVATE_KEY_0x3d3914960567b3a253c429d5ab81da1f386f9111
wrangler secret put WALLET_PRIVATE_KEY_0x886b739ba73c1ccae826cb11c8d28e4750c68a89

# 可选：配置自定义 RPC 节点
wrangler secret put BSC_RPC
wrangler secret put BSC_RPC_NODES
```

---

## 三、部署步骤

### 3.1 部署 Worker-Turns-1

```bash
cd /workspace/cloudflare/worker-turns-1

# 先配置 secrets（如果是首次部署）
# 详见"二、部署准备 - 2.2 配置环境变量"

# 部署 Worker
wrangler deploy
```

### 3.2 部署 Worker-Turns-2

```bash
cd /workspace/cloudflare/worker-turns-2

# 配置 secrets（与 worker-turns-1 相同，无需重复设置如果共享账户）
# 但建议验证配置是否正确

# 部署 Worker
wrangler deploy
```

### 3.3 部署 Worker-Turns-3

```bash
cd /workspace/cloudflare/worker-turns-3

# 配置 secrets（与 worker-turns-1 相同）

# 部署 Worker
wrangler deploy
```

---

## 四、同时部署 3 个 Worker

### 方法一：手动逐个部署

```bash
cd /workspace/cloudflare/worker-turns-1 && wrangler deploy
cd /workspace/cloudflare/worker-turns-2 && wrangler deploy
cd /workspace/cloudflare/worker-turns-3 && wrangler deploy
```

### 方法二：使用脚本自动部署

创建 `deploy-turns.sh` 脚本：

```bash
#!/bin/bash

set -e  # 遇到错误立即退出

echo "🚀 开始部署 Worker-Turns 架构..."

# 部署 worker-turns-1
echo "📦 部署 worker-turns-1..."
cd /workspace/cloudflare/worker-turns-1
wrangler deploy

# 部署 worker-turns-2
echo "📦 部署 worker-turns-2..."
cd /workspace/cloudflare/worker-turns-2
wrangler deploy

# 部署 worker-turns-3
echo "📦 部署 worker-turns-3..."
cd /workspace/cloudflare/worker-turns-3
wrangler deploy

echo "✅ 所有 Worker 部署完成！"
```

使用方法：

```bash
chmod +x /workspace/cloudflare/deploy-turns.sh
/workspace/cloudflare/deploy-turns.sh
```

---

## 五、数据库集成说明

### 5.1 数据库结构

Worker-Turns 使用 Supabase 数据库，与 worker-1-interception 和 worker-tactics-1 共享相同的数据库结构。

**无需修改数据库**，因为：

1. **worker_id 字段**: 3 个 Worker 分别使用 `worker-turns-1`、`worker-turns-2`、`worker-turns-3` 作为标识
2. **表结构兼容**: 使用相同的表（`transactions`、`errors`、`emergency_status` 等）
3. **无新增字段**: 不引入新的数据库字段或表

### 5.2 数据库优化

虽然无需修改数据库结构，但可以优化查询性能：

#### 优化 1: 为 worker_id 添加索引（如果尚未添加）

```sql
-- 在 transactions 表中为 worker_id 添加索引
CREATE INDEX IF NOT EXISTS idx_transactions_worker_id 
ON transactions(worker_id);

-- 在 errors 表中为 worker_id 添加索引
CREATE INDEX IF NOT EXISTS idx_errors_worker_id 
ON errors(worker_id);

-- 在 emergency_status 表中为 worker_id 添加索引
CREATE INDEX IF NOT EXISTS idx_emergency_status_worker_id 
ON emergency_status(worker_id);
```

#### 优化 2: 查询优化

当需要查询 3 个 Worker 的数据时，使用以下查询：

```sql
-- 查询最近的交易记录（3 个 Worker）
SELECT * FROM transactions 
WHERE worker_id IN ('worker-turns-1', 'worker-turns-2', 'worker-turns-3')
ORDER BY timestamp DESC 
LIMIT 50;

-- 查询错误记录（3 个 Worker）
SELECT * FROM errors 
WHERE worker_id IN ('worker-turns-1', 'worker-turns-2', 'worker-turns-3')
ORDER BY timestamp DESC 
LIMIT 50;
```

---

## 六、Gas 费补充功能集成

### 6.1 集成状态

✅ **Worker-Turns 已集成 Gas 费补充功能**

集成方式：
- **EmergencyExtension 内部自动调用 GasFunder**
- **无需在 Worker 代码中单独导入 GasFunder**
- **3 次连续 Gas 不足失败后自动补充**

### 6.2 触发条件

当以下条件满足时，自动补充 Gas 费：

1. **转账失败**: 交易因 Gas 不足而失败
2. **连续失败**: 同一个钱包连续 3 次因 Gas 不足失败
3. **余额检查**: 检查被保护钱包 BNB 余额 < `MIN_BNB_FOR_GAS`（0.0005 BNB）

### 6.3 补充机制

```javascript
// EmergencyExtension 内部代码（自动执行）
if (this.gasInsufficientCounters.get(walletAddress) >= this.maxGasInsufficientRetries) {
  // 动态导入 GasFunder
  const { GasFunder } = await import('../gas/GasFunder.js')
  const gasFunder = new GasFunder(this.env, this.db, { workerId: this.workerId })
  
  // 补充 Gas 费
  const fundResult = await gasFunder.fundGas(walletAddress)
  
  // 重置计数器
  this.gasInsufficientCounters.set(walletAddress, 0)
}
```

### 6.4 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `MIN_BNB_FOR_GAS` | 0.0005 BNB | 触发补充的最小余额 |
| `TARGET_BNB_BALANCE` | 0.002 BNB | 补充后的目标余额 |
| `MAX_GAS_INSUFFICIENT_RETRIES` | 3 | 连续失败多少次后补充 |

### 6.5 配置 Gas 补充钱包

```bash
# 进入 Worker 目录
cd /workspace/cloudflare/worker-turns-1

# 配置 Gas 补充钱包地址
wrangler secret put GAS_FUNDING_WALLET

# 输入 Gas 补充钱包地址，例如：
# 0x1234567890123456789012345678901234567890

# 配置 Gas 补充钱包私钥
wrangler secret put GAS_FUNDING_WALLET_PRIVATE_KEY

# 输入私钥（不带 0x 前缀）
```

**重要提示**:
- Gas 补充钱包需要有足够的 BNB 余额
- Gas 补充钱包不同于 `SAFE_WALLET`（收款钱包）
- 3 个 Worker 共享相同的 Gas 补充钱包配置

---

## 七、部署验证

### 7.1 检查 Worker 状态

```bash
# 查看所有 Worker 列表
wrangler deployments list

# 查看 worker-turns-1 状态
cd /workspace/cloudflare/worker-turns-1
wrangler deployments list

# 查看 worker-turns-2 状态
cd /workspace/cloudflare/worker-turns-2
wrangler deployments list

# 查看 worker-turns-3 状态
cd /workspace/cloudflare/worker-turns-3
wrangler deployments list
```

### 7.2 查看实时日志

```bash
# 查看 worker-turns-1 日志
wrangler tail --format pretty

# 在另一个终端查看 worker-turns-2 日志
cd /workspace/cloudflare/worker-turns-2
wrangler tail --format pretty

# 在另一个终端查看 worker-turns-3 日志
cd /workspace/cloudflare/worker-turns-3
wrangler tail --format pretty
```

### 7.3 验证调度时间

在日志中检查以下信息：

- **worker-turns-1**: 应该在每分钟的 0-2 秒启动
- **worker-turns-2**: 应该在每分钟的 20-22 秒启动
- **worker-turns-3**: 应该在每分钟的 40-42 秒启动

示例日志：

```
🚀 [worker-turns-1] 开始定时扫描 2026-01-29T12:00:00.123Z
📊 预期启动时间: 每分 0 秒，实际启动时间: 第 0 秒
```

---

## 八、常见问题

### Q1: 3 个 Worker 是否使用同一个 wrangler.toml 文件？

**否**，每个 Worker 有独立的 `wrangler.toml` 文件，但配置基本相同，只有 `name`、`WORKER_ID`、`WORKER_NAME` 不同。

### Q2: 如何实现 3 个 Worker 同时部署？

**方法一**: 逐个部署（手动）
```bash
cd worker-turns-1 && wrangler deploy
cd worker-turns-2 && wrangler deploy
cd worker-turns-3 && wrangler deploy
```

**方法二**: 使用脚本自动部署
```bash
./deploy-turns.sh
```

### Q3: worker-turns 协同方案是否需要修改数据库？

**否**，3 个 Worker 共享相同的数据库结构，无需修改。只需为 `worker_id` 添加索引以优化查询性能。

### Q4: worker-turns 是否集成了 Gas 费补充扩展？

**是**，已通过 EmergencyExtension 自动集成 GasFunder，无需单独配置。当连续 3 次因 Gas 不足失败后，自动补充 Gas 费。

### Q5: 3 个 Worker 如何共享 KV 数据？

3 个 Worker 使用相同的 KV 绑定配置（`EMERGENCY_STORE`、`RPC_POOL`），因此可以共享应急状态和 RPC 节点池数据。

---

## 九、生产环境部署检查清单

部署前请确认以下项目：

- [ ] KV 命名空间已创建（EMERGENCY_STORE、RPC_POOL）
- [ ] Supabase 数据库连接正常
- [ ] Safe Wallet 已配置
- [ ] Gas 补充钱包已配置且有足够的 BNB 余额
- [ ] 被保护钱包私钥已正确配置
- [ ] RPC 节点池配置正常（或使用默认节点）
- [ ] 数据库索引已优化（可选）
- [ ] 部署脚本已测试
- [ ] 日志监控已配置

---

## 十、故障排查

### 10.1 Worker 部署失败

```bash
# 查看详细错误信息
wrangler deploy --verbose

# 检查配置文件语法
cat wrangler.toml
```

### 10.2 Worker 启动时间不准确

检查以下内容：
- Cloudflare Cron Trigger 配置是否正确
- 时间偏差修正是否正常执行（每 12 小时）
- 网络延迟是否过高

### 10.3 Gas 费补充失败

检查以下内容：
- `GAS_FUNDING_WALLET` 是否正确配置
- `GAS_FUNDING_WALLET_PRIVATE_KEY` 是否正确
- Gas 补充钱包是否有足够的 BNB 余额
- 日志中是否有相关错误信息

---

**最后更新**: 2026-01-29  
**文档版本**: 1.0
