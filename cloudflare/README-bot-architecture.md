# v2.4.0 Worker-Bot 架构说明

## 架构概述

v2.4.0 版本采用**扩展池架构**（Extension Pool Architecture），将应急状态、转账、Aide等功能实现为扩展函数，由 `worker-integrated-pool` 统一调度同步调用，实现零延迟触发。

## ⚠️ v2.3.0架构已废弃

**废弃原因**：v2.3.0的KV队列触发模式无法实现应急状态的即时响应（延迟约3分钟），已被扩展池架构取代。

**已废弃内容**：
- `worker-turns-1/2/3` - 旧架构Worker，已删除
- `worker-bot-emergency/transfer/aide` - 已删除
- `extensions/emergency/` - 旧KV队列模式扩展，已删除
- `extensions/transfer/` - 旧KV队列模式扩展，已删除

## 扩展池架构

### 核心设计理念

采用**统一调度+扩展池**架构，将应急状态、转账、Aide等功能实现为可复用的扩展函数，由 `worker-bot-scan` 统一调度同步调用。

**优势**：
- ✅ **零延迟触发**：从扫描发现到执行应急状态/转账，无中间Cron间隔
- ✅ **资源高效利用**：扩展函数按需调用，避免空闲Worker占用资源
- ✅ **易于扩展**：新功能可添加为新的扩展函数，无需创建新Worker
- ✅ **调试简化**：所有逻辑在同一个Worker中，日志和追踪更清晰

---

### Worker 划分

#### 1. worker-integrated-pool (统一调度器)

**职责**：
- 每分钟触发，循环扫描3次（每轮间隔20秒）
- 每轮轮流扫描所有被保护钱包
- 钱包间隔可配置（0 或 1 秒）
- 根据扫描结果同步调用扩展函数

**Cron**：`* * * * *`（每分钟）

**扫描频率**：每个钱包每分钟扫描3次

**扩展函数调用**：
- **emergency扩展**：BNB > 0.0005时同步调用
- **transfer扩展**：wkeyDAO > 0 或 USDT > 0时同步调用
- **aide扩展**：转账完成后同步调用

---

#### 2. EmergencyWorkerExtension (应急状态扩展函数)

**职责**：
- 作为扩展函数被worker-integrated-pool同步调用
- 执行应急循环（5秒扫描一次，最多10分钟）
- 只扫描命中钱包，提高效率降低开销
- 检测到代币后触发transfer扩展并退出

**调用方式**：由 `worker-integrated-pool` 同步调用

**应急循环逻辑**：
1. 检查应急状态锁是否有效
2. 只扫描命中的钱包地址（不扫描所有钱包）
3. 检测到 wkeyDAO/USDT > 0 时调用transfer扩展
4. 触发转账后立即退出

**退出条件**：
- 超时（10分钟）
- 锁失效
- 检测到代币，触发transfer扩展

**并发限制**：最多同时处理 2 个不同地址的应急状态

---

#### 3. TransferWorkerExtension (转账扩展函数)

**职责**：
- 作为扩展函数被worker-integrated-pool/emergency扩展同步调用
- 执行转账循环（无时限，达到条件就退出）
- 钱包清空即退出，及时释放锁资源
- 3次交易失败提示gas不足才触发补充gas费

**调用方式**：由 `worker-integrated-pool` 或 `emergency扩展` 同步调用

**转账优先级**：
1. wkeyDAO（优先级 0）
2. USDT（优先级 1）
3. BNB（优先级 2）

**退出条件**：
- 钱包已清空
- 转账成功，调用aide扩展监控交易
- 转账失败（非Gas不足），调用aide扩展处理错误

**并发限制**：最多同时处理 2 个不同地址的转账

---

#### 4. AideWorkerExtension (Aide扩展函数)

**职责**：
- 作为扩展函数被transfer扩展同步调用
- 查询交易状态（成功/失败/待确认）
- 更新 Supabase 数据库中的交易状态
- 失败时创建重试任务或 Gas 补充任务

**调用方式**：由 `transfer扩展` 在转账完成后同步调用

**监控逻辑**：
- 使用 `provider.getTransactionReceipt` 查询交易
- 快速扫描：最多重试 2 次，每次间隔 5 秒
- 快速退出：最多等待 20 秒，然后快速退出释放锁
- 交易未确认时标记为pending，让后续scan任务继续处理
- 失败分析：检查是否因 Gas 不足导致失败，创建重试任务或Gas补充任务

**Aide核心作用**：
- 让transfer及时解锁（不管交易成功或失败，都快速退出）
- 保证交易失败时有处理备用方案（重试或Gas补充）

**并发限制**：最多同时处理 10 个交易

**Aide退出逻辑**：
- **成功退出**：交易已确认（status=1），更新数据库为success，快速退出释放锁
- **失败退出**：交易确认失败（status=0），更新数据库为failed，创建重试任务或Gas补充任务，快速退出释放锁
- **超时退出**：交易未在20秒内确认，更新数据库为pending，快速退出释放锁（让后续scan任务继续处理）

---

## 分布式锁设计

### 锁类型

| 锁类型 | 锁 Key | 用途 | TTL |
|--------|--------|------|-----|
| 扫描锁 | `scan_global_lock` | 防止多个 Scan 实例同时扫描 | 60秒 |
| 应急状态锁 | `emergency_lock_${walletAddress}` | 防止同一钱包的应急状态并发 | 900秒（15分钟） |
| 钱包转账锁 | `wallet_transfer_lock_${walletAddress}` | 防止同一钱包同时转账 | 120秒 |
| Gas 补充锁 | `gas_fund_${walletAddress}` | 防止同时补充同一钱包的 Gas | 120秒 |

### 锁粒度设计

- **Worker 级锁**：`scan_global_lock`（Scan Bot 专用）
- **钱包级锁**：`emergency_lock_${walletAddress}`、`wallet_transfer_lock_${walletAddress}`

**并发策略**：
- 允许同时存在 2 个不同地址的应急状态
- 允许同时存在 2 个不同地址的转账
- 每个钱包在任何时刻只能有一个状态在处理

---

## 任务队列设计

### 应急状态任务

```javascript
{
  type: 'emergency',
  walletAddress: '0x...',
  reason: 'bnb_balance_gt_0.0005',
  status: 'pending',  // pending | processing | completed | failed
  createdAt: '2026-01-31T12:00:00Z',
  maxDuration: 900  // 15分钟
}
```

### 转账任务

```javascript
{
  type: 'transfer',
  walletAddress: '0x...',
  tokenType: 'wkeydao',  // wkeydao | usdt | bnb
  amount: '100',
  status: 'pending',  // pending | processing | completed | failed
  createdAt: '2026-01-31T12:00:00Z',
  priority: 0  // 0=high, 1=normal, 2=low
}
```

### Gas 补充任务

```javascript
{
  type: 'gas_fund',
  walletAddress: '0x...',
  currentBalance: '0.0003',
  targetBalance: '0.002',
  status: 'pending',
  createdAt: '2026-01-31T12:00:00Z'
}
```

### 交易监控任务

```javascript
{
  txHash: '0x...',
  walletAddress: '0x...',
  tokenType: 'wkeydao',
  status: 'pending',  // pending | processing | completed
  createdAt: '2026-01-31T12:00:00Z'
}
```

---

## 数据流

### 新架构（扩展池）

```
┌─────────────────────────────────────────────────────────────────┐
│                  worker-integrated-pool                      │
│  Cron: * * * * * (每分钟触发)                                  │
│                                                                 │
│  1. 循环扫描3轮，每轮扫描所有钱包                               │
│  2. 根据扫描结果同步调用扩展函数                                │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐    │
│  │ BNB > 0.0005                                          │    │
│  │    ↓                                                  │    │
│  │ 同步调用 Emergency Extension                          │    │
│  │    ↓                                                  │    │
│  │ 应急循环（5秒扫描一次，最多10分钟）                     │    │
│  │    ↓                                                  │    │
│  │ 检测到代币 → 调用 Transfer Extension                 │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐    │
│  │ wkeyDAO > 0 或 USDT > 0                              │    │
│  │    ↓                                                  │    │
│  │ 同步调用 Transfer Extension                          │    │
│  │    ↓                                                  │    │
│  │ 转账循环（无时限，钱包清空即退出）                      │    │
│  │    ↓                                                  │    │
│  │ 转账完成 → 同步调用 Aide Extension                    │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐    │
│  │ Aide Extension                                       │    │
│  │    ↓                                                  │    │
│  │ 快速扫描交易状态（最多20秒）                            │    │
│  │    ↓                                                  │    │
│  │ 更新Supabase数据库 + 快速退出释放锁                     │    │
│  │    ↓                                                  │    │
│  │ 失败 → 创建重试任务或Gas补充任务                        │    │
│  └───────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 延迟对比

| 架构 | 延迟路径 | 总延迟 |
|------|----------|--------|
| **旧架构** | T0:扫描发现 → T1:60s后emergency触发 → T2:60s后transfer触发 → T3:60s后aide触发 | ~180秒 |
| **新架构** | T0:扫描发现 → T1:同步调用emergency/transfer → T2:transfer完成调用aide | **~几秒** |

**优势**：
- ✅ 零Cron间隔延迟
- ✅ 应急状态真正做到即时响应
- ✅ 减少KV队列读写开销

---

## 部署步骤

### 1. 安装依赖

```bash
cd /workspace/cloudflare
npm run install:all
```

### 2. 配置 Secrets

**配置worker-integrated-pool（统一调度器）**

```bash
cd worker-integrated-pool

# Supabase配置
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_KEY

# 被保护钱包私钥
wrangler secret put WALLET_PRIVATE_KEY_0x9F4fba96e1D15f8547b9e41Be957Ff143C298e16
wrangler secret put WALLET_PRIVATE_KEY_0x3D3914960567b3A253C429d5Ab81DA1F386F9111
wrangler secret put WALLET_PRIVATE_KEY_0x886b739Ba73C1ccaE826Cb11c8d28e4750C68A89

# Gas补充钱包配置
wrangler secret put GAS_FUNDING_WALLET
wrangler secret put GAS_FUNDING_WALLET_PRIVATE_KEY
```

### 3. 部署

```bash
# 部署 worker-integrated-pool
cd /workspace/cloudflare/worker-integrated-pool
npx wrangler deploy

# 或使用根目录脚本
cd /workspace/cloudflare
npm run deploy
```

---

## 验证部署

### 1. 检查 Worker 状态

访问 Cloudflare Dashboard → Workers → [worker-bot-name] → Triggers

### 2. 查看日志

访问 Cloudflare Dashboard → Workers → [worker-bot-name] → Logs

### 3. 测试手动触发

```bash
# 手动触发扫描
curl -X POST https://worker-bot-scan.workers.dev

# 手动触发转账
curl -X POST -H "Content-Type: application/json" \
  -d '{"walletAddress":"0x...","tokenType":"wkeydao"}' \
  https://worker-bot-transfer.workers.dev

# 查询交易状态
curl https://worker-bot-aide.workers.dev?txHash=0x...
```

---

## 迁移计划

### 阶段 1：部署新架构（当前）
1. 创建 4 个 worker-bot
2. 配置 Secrets
3. 部署到 Cloudflare
4. 保留旧 worker-turns-* 作为备份

### 阶段 2：验证和测试
1. 观察新 Worker 日志
2. 测试转账功能
3. 测试应急状态
4. 验证数据完整性

### 阶段 3：切换到新架构
1. 暂停旧 Worker 的 Cron 触发
2. 验证新架构正常运行
3. 确认无误后删除旧 Worker

---

## 注意事项

### 1. KV 命名空间

新架构复用现有 KV 命名空间：
- `EMERGENCY_STORE`：共享
- `RPC_POOL`：共享

### 2. Secrets 配置

**worker-bot-scan**（统一调度器）：
- `SUPABASE_URL` 和 `SUPABASE_KEY`
- `PROTECTED_WALLETS`
- `WALLET_SCAN_INTERVAL`
- `BNB_THRESHOLD`
- `MAX_SCAN_DURATION`
- `TOKEN_WKEYDAO` 和 `TOKEN_USDT`
- `EMERGENCY_MAX_DURATION`
- `EMERGENCY_SCAN_INTERVAL`
- `MAX_TRANSFER_RETRIES`
- `TARGET_BNB_BALANCE`
- `SAFE_WALLET`
- `GAS_FUNDING_WALLET`
- `WALLET_PRIVATE_KEY_*`（被保护钱包私钥）

**worker-bot-emergency/transfer/aide**（已禁用Cron，仅保留HTTP端点）：
- 仅用于测试/调试，配置同上

### 3. 时钟同步

只有 `worker-bot-scan` 在每分钟整点触发，扩展函数由scan同步调用，无需考虑时钟同步问题。

### 4. 锁竞争

- 新架构支持同时处理 2 个不同地址的应急状态/转账
- 由于是同步调用，锁竞争大大减少
- 如果锁竞争仍然频繁，可以调整钱包扫描间隔

---

## 故障排查

### 问题 1：任务队列堆积

**症状**：KV 中存在大量 pending 任务

**解决方法**：
1. 检查 Transfer Bot 是否正常运行
2. 检查锁是否过期
3. 手动删除过期任务

### 问题 2：交易监控超时

**症状**：交易长时间未确认

**解决方法**：
1. 检查 RPC 节点是否正常
2. 增加超时时间配置
3. 检查网络拥堵情况

### 问题 3：Gas 不足

**症状**：转账失败，日志显示 "insufficient funds"

**解决方法**：
1. 检查 Gas 补充任务是否创建
2. 检查 Gas 补充钱包余额
3. 手动补充 Gas

---

**文档创建日期**：2026-01-31
**版本**：v2.4.0-dev
**作者**：X-plan Team
