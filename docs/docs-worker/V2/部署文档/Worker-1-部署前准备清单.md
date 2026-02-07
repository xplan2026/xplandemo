# Worker-1 部署前准备清单

**创建日期**: 2026-01-23
**版本**: v1.3.0 (Gas 费自动补充)

---

## 1. 环境变量配置（Environment Variables）

### 在 wrangler.toml 中已配置

```toml
WORKER_ID = "worker-1-interception"
WORKER_TYPE = "interception"
BSC_RPC = "https://bsc-rpc.publicnode.com"
EMERGENCY_SCAN_INTERVAL = 5
EMERGENCY_MAX_DURATION = 900
BNB_THRESHOLD = 0.001
WKEYDAO_THRESHOLD = 0
MAX_SCAN_DURATION = 7000
MAX_TRANSFER_DURATION = 7000

# Gas 费补充配置（新增）
MIN_BNB_FOR_GAS = 0.0005
TARGET_BNB_BALANCE = 0.002
MAX_GAS_INSUFFICIENT_RETRIES = 3

# 代币配置
TOKEN_BNB = "0x0000000000000000000000000000000000000000"
TOKEN_WKEYDAO = "0x194B302a4b0a79795Fb68E2ADf1B8c9eC5ff8d1F"
TOKEN_USDT = "0x55d398326f99059fF775485246999027B3197955"
TOKEN_ADDRESSES = "0x0000000000000000000000000000000000000000,0x194B302a4b0a79795Fb68E2ADf1B8c9eC5ff8d1F,0x55d398326f99059fF775485246999027B3197955"

PROTECTED_WALLETS = "0x钱包1,0x钱包2,0x钱包3"  # 需要填写实际地址
GAS_FUNDING_WALLET = "0x..."  # 需要填写实际地址
SAFE_WALLET = "0x..."        # 需要填写实际地址
```

---

## 2. 密钥配置（Secrets）

### 需要设置的 Secrets

```bash
# 1. Gas 补充钱包私钥（新增）
CLOUDFLARE_API_TOKEN=<your_token> npx wrangler secret put GAS_FUNDING_WALLET_PRIVATE_KEY

# 2. 数据库配置
CLOUDFLARE_API_TOKEN=<your_token> npx wrangler secret put SUPABASE_URL
CLOUDFLARE_API_TOKEN=<your_token> npx wrangler secret put SUPABASE_KEY

# 3. JWT 密钥
CLOUDFLARE_API_TOKEN=<your_token> npx wrangler secret put JWT_SECRET

# 4. 被保护钱包私钥（每个钱包一个）
CLOUDFLARE_API_TOKEN=<your_token> npx wrangler secret put WALLET_PRIVATE_KEY_0x钱包地址小写1
CLOUDFLARE_API_TOKEN=<your_token> npx wrangler secret put WALLET_PRIVATE_KEY_0x钱包地址小写2
CLOUDFLARE_API_TOKEN=<your_token> npx wrangler secret put WALLET_PRIVATE_KEY_0x钱包地址小写3
```

### 注意事项

- **GAS_FUNDING_WALLET_PRIVATE_KEY**：固定名称，不带钱包地址
- **WALLET_PRIVATE_KEY_<地址>**：带小写钱包地址
- **SAFE_WALLET**：不需要私钥，只作为收款地址
- 所有私钥输入时**不要包含 0x 前缀**

---

## 3. 钱包职责说明

| 钱包类型 | 变量名 | 私钥变量 | 余额建议 | 用途 |
|---------|---------|---------|---------|------|
| **Gas 补充钱包** | `GAS_FUNDING_WALLET` | `GAS_FUNDING_WALLET_PRIVATE_KEY` | ~0.002 BNB | 补充 Gas 费到被保护钱包 |
| **安全钱包** | `SAFE_WALLET` | ❌ 无需配置 | 较大金额 | 接收被保护钱包的转账 |
| **被保护钱包** | `PROTECTED_WALLETS` | `WALLET_PRIVATE_KEY_<地址>` | - | 监控并自动转账 |

---

## 4. KV 命名空间配置

### 已在 wrangler.toml 中配置

```toml
[[kv_namespaces]]
binding = "KV"
id = "657a2769de12494f9df1e07a9ee256ba"
preview_id = ""

[[kv_namespaces]]
binding = "EMERGENCY_STORE"
id = "fcaf59ca0248424b9a13605484fe3120"
preview_id = ""
```

---

## 5. 代码完整性检查

### ✅ 已完成的功能

1. **Gas 费自动补充**
   - [x] 创建 GasFunder 扩展
   - [x] 使用独立 Gas 补充钱包（GAS_FUNDING_WALLET）
   - [x] 目标余额 0.002 BNB（降低暴露风险）
   - [x] 完整的错误处理和日志记录

2. **失败重试策略**
   - [x] 连续 3 次 Gas 不足失败后自动补充
   - [x] 每个钱包独立计数
   - [x] 补充成功后重置计数器
   - [x] 不影响 BNB 充足时的正常转账

3. **退出条件修复**
   - [x] 只检查 wkeyDAO 和 USDT 余额为 0
   - [x] 不检查 BNB 余额（Gas 费几乎不可能为 0）

4. **文档更新**
   - [x] 更新 Gas 费自动补充方案文档
   - [x] 更新 wrangler.toml 配置说明

### ⚠️ Linter 警告（可忽略）

1. `index.js` Line 42: `await` 在 async 函数上的警告（误报，await 是正确的）

---

## 6. 部署步骤

### 6.1 进入项目目录

```bash
cd /workspace/cloudflare/worker-1-interception
```

### 6.2 验证配置

```bash
# 检查 wrangler 版本
npx wrangler --version
# 预期输出: ⛅️ wrangler 3.78.0

# 检查配置
npx wrangler secret list
```

### 6.3 部署

```bash
# 使用 API Token 部署
CLOUDFLARE_API_TOKEN=<your_token> npx wrangler deploy
```

### 预期输出

```
⛅️ wrangler 3.78.0
Uploading worker-1-interception...
Published worker-1-interception
  https://worker-1-interception.你的账户名.workers.dev
Current ID: worker-1-interception
```

---

## 7. 部署后验证

### 7.1 检查 Worker 状态

```bash
# 查看 Worker 日志
npx wrangler tail --format=pretty
```

### 7.2 测试 API

```bash
# 健康检查
curl https://worker-1-interception.你的账户名.workers.dev/health

# 预期响应
{
  "status": "ok",
  "service": "worker-1-interception",
  "worker_id": "worker-1-interception",
  "timestamp": "2026-01-23T..."
}
```

### 7.3 监控应急状态

```bash
# 在 Cloudflare Dashboard 中查看 KV 存储的 EMERGENCY_STORE
# 或通过 Worker 日志观察应急状态触发
```

---

## 8. 常见问题

### Q1: 部署时报错 "403 Forbidden"

**原因**: API Token 权限不足

**解决**: 确保 API Token 包含以下权限：
- Workers Scripts: Edit
- Workers KV Storage: Edit
- Workers Routes: Edit
- Workers Tail: Read

### Q2: Gas 补充失败

**可能原因**:
1. GAS_FUNDING_WALLET 未配置
2. GAS_FUNDING_WALLET_PRIVATE_KEY 未设置
3. Gas 补充钱包余额不足

**解决**: 检查环境变量和密钥配置，补充 Gas 补充钱包的 BNB 余额

### Q3: 应急状态无法退出

**可能原因**:
1. wkeyDAO 或 USDT 余额不为 0
2. 数据库写入失败

**解决**: 检查数据库连接，确保 Supabase 配置正确

---

## 9. 相关文档

- `/workspace/docs/开发指南/Gas费自动补充方案.md` - Gas 费补充功能说明
- `/workspace/docs/开发指南/部署/Wrangler登录与配置记录.md` - Wrangler 配置记录
- `/workspace/cloudflare/worker-1-interception/wrangler.toml` - 环境变量配置

---

**最后更新**: 2026-01-23
