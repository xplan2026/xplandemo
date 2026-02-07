# X-plan Demo 钱包地址配置

## 📋 概述

X-plan Demo 项目使用三个钱包地址来实现资产保护模拟功能。所有地址和私钥已配置在项目根目录的 `.env` 文件中。

---

## 🔒 配置位置

所有钱包地址和私钥的配置存储在：

```
项目根目录/.env
```

⚠️ **重要**: `.env` 文件包含敏感信息，已在 `.gitignore` 中配置，不会提交到版本控制系统。

---

## 📍 钱包地址说明

### 地址 A - 被保护地址

**用途**: 模拟私钥被盗的钱包，持有待保护的 XPD 代币

**配置项**:
- `PROTECTED_ADDRESS`: 地址 A 的公钥地址
- `PROTECTED_PRIVATE_KEY`: 地址 A 的私钥

**特点**:
- 私钥将在前端页面公示，用于演示攻击场景
- 该地址的 XPD 余额是 Worker 监控的主要目标

---

### 地址 B - 安全地址

**用途**: Worker 执行资产转移的目标地址，接收保护转出的 XPD 代币

**配置项**:
- `SAFE_ADDRESS`: 地址 B 的公钥地址
- `SAFE_PRIVATE_KEY`: 地址 B 的私钥

**特点**:
- 私钥必须保密，仅配置在 Worker 环境变量中
- 应急模式触发时，Worker 会将资产转移到此地址

---

### 地址 C - Gas 费地址

**用途**: 存储 POL 代币，为 Worker 提供执行保护操作所需的 Gas 费

**配置项**:
- `GAS_ADDRESS`: 地址 C 的公钥地址
- `GAS_PRIVATE_KEY`: 地址 C 的私钥

**特点**:
- 私钥必须保密，仅配置在 Worker 环境变量中
- Worker 在转移资产的同时，会转移剩余的 POL 到此地址
- 确保每次操作都有足够的 Gas 费

---

## 🔧 配置方式

### 1. 查看/修改配置

编辑项目根目录的 `.env` 文件：

```bash
# 地址 A - 被保护地址
PROTECTED_ADDRESS=0x你的地址A
PROTECTED_PRIVATE_KEY=0x你的私钥A

# 地址 B - 安全地址
SAFE_ADDRESS=0x你的地址B
SAFE_PRIVATE_KEY=0x你的私钥B

# 地址 C - Gas 费地址
GAS_ADDRESS=0x你的地址C
GAS_PRIVATE_KEY=0x你的私钥C
```

### 2. 部署到 Cloudflare Workers

在 Cloudflare Workers 中配置敏感信息：

**方法 1: 通过 Dashboard**
1. 登录 Cloudflare Dashboard
2. 进入 Workers & Pages > Settings > Variables and Secrets
3. 添加以下 Secrets：
   - `PROTECTED_PRIVATE_KEY`
   - `SAFE_PRIVATE_KEY`
   - `GAS_PRIVATE_KEY`

**方法 2: 通过 CLI**
```bash
npx wrangler secret put SAFE_PRIVATE_KEY
npx wrangler secret put GAS_PRIVATE_KEY
```

---

## 📋 部署前检查清单

在部署项目前，请确认以下配置：

- [ ] `.env` 文件已创建并配置所有必需的环境变量
- [ ] 地址 A、B、C 的公钥地址已正确填写
- [ ] 地址 A 的私钥已配置（用于前端展示）
- [ ] 地址 B 的私钥已配置到 Worker（安全目标地址）
- [ ] 地址 C 的私钥已配置到 Worker（Gas 费地址）
- [ ] 向地址 C 充值足够的 POL 代币（从水龙头获取，建议至少 1 POL）
- [ ] 向地址 A 转移 XPD 代币用于测试（建议至少 100 XPD）
- [ ] 确认 `.env` 文件未提交到 Git 仓库

---

## ⚠️ 安全提示

1. **私钥安全**:
   - 地址 A 的私钥可在前端公示（测试用途）
   - 地址 B 和 C 的私钥**必须保密**
   - 绝不在代码中硬编码私钥

2. **环境变量**:
   - 使用 `.env.example` 作为模板
   - `.env` 文件已添加到 `.gitignore`
   - 部署时使用 Cloudflare Workers Secrets 加密存储

3. **测试网专用**:
   - 本项目仅用于 Polygon Amoy 测试网
   - 请勿在主网使用真实资产
   - 测试完成后请勿在真实场景使用测试私钥

4. **Gas 费管理**:
   - 保持地址 C 至少 1 POL 作为备用
   - 监控 Worker 的 Gas 费消耗
   - 及时补充 POL 避免保护功能失效

---

## 🔗 相关文档

- [环境变量说明](./环境变量说明.md) - 详细的环境变量配置指南
- [项目背景](./项目背景.md) - 项目的整体说明
- [前端功能说明](./前端功能说明.md) - 前端功能详细说明

---

## ❓ 常见问题

### Q: 如何生成新的钱包地址？

**A**: 您可以使用以下方式生成新地址：

1. **使用 MetaMask**:
   - 安装 MetaMask 扩展
   - 创建新账户
   - 导出私钥

2. **使用 ethers.js**:
   ```javascript
   const { ethers } = require('ethers');
   const wallet = ethers.Wallet.createRandom();
   console.log('地址:', wallet.address);
   console.log('私钥:', wallet.privateKey);
   ```

3. **使用在线工具**:
   - [MyEtherWallet](https://www.myetherwallet.com/)
   - [Remix IDE](https://remix.ethereum.org/)

### Q: 如何获取测试网的 POL？

**A**: 访问 Polygon Amoy 水龙头：
- [Polygon Amoy Faucet](https://faucet.polygon.technology/)
- [Amoy Faucet](https://amoy.polygon.technology/faucet)

### Q: 如何获取 XPD 代币？

**A**: 从已部署的 XPD 合约铸造或转账：
- 合约地址: `0x35774A4E1fFEee74Fa3859F89cfae00b3aC8C3A8`
- 合约代码位于: `ERC20/contracts/XplanDemoToken.sol`

---

最后更新: 2026-02-07
