# X-plan Demo Token (XPD)

X-plan Demo 项目专用 ERC20 代币合约

## 基本信息

- **代币名称**: X-plan Demo Token
- **代币符号**: XPD
- **合约地址**: `0x35774A4E1fFEee74Fa3859F89cfae00b3aC8C3A8`
- **网络**: Amoy Testnet (Polygon Mumbai)
- **部署者**: `0x0D6Ff1EA7Ed215DF0A6C54a8fE288c1c37a218DD`
- **部署时间**: 2026-01-26 13:19:56 UTC
- **初始供应量**: 10,000,000,000 XPD (10000 * 10^9)

## 技术规格

- **Solidity 版本**: ^0.8.20
- **编译器**: solc 0.8.31
- **继承**: OpenZeppelin ERC20, Ownable
- **代币精度**: 9 decimals

## 功能特性

### 核心功能
- ✅ 标准 ERC20 代币转账功能
- ✅ 代币铸造 (仅管理员)
- ✅ 代币销毁 (任意持有者)

### 管理功能 (仅管理员)
- 🔒 **账户冻结**: 可冻结指定地址的转账能力
- ⏱️ **转账冷却**: 设置两次转账之间的最小时间间隔
- 🏷️ **元数据管理**: 更新代币的元数据 URI

## 目录结构

```
ERC20/
├── contracts/              # 智能合约源代码
│   └── XplanDemoToken.sol # 主合约
├── metadata/               # 代币元数据和图标
├── source/                 # 部署信息和文档
│   ├── source.md          # 合约验证信息
│   └── 钱包地址/
│       └── wallet_total.md
├── tests/                  # 测试文件
│   └── XplanDemoToken_test.sol
└── README.md              # 本文件
```

## 合约接口

### 管理员函数

#### emergencyFreeze(address target, bool freeze)
冻结或解冻指定账户

#### setTransferCooldown(uint256 cooldown)
设置转账冷却时间（秒）

#### setTokenURI(string memory newUri)
更新代币元数据 URI

#### mint(address to, uint256 amount)
铸造代币到指定地址

### 查询函数

#### isFrozen(address account)
查询账户是否被冻结

#### tokenURI()
获取代币元数据 URI

### 用户函数

#### burn(uint256 amount)
销毁自己持有的代币

## 外部链接

### 合约验证与交互
- [Sourcify 验证](https://repo.sourcify.dev/80002/0x35774A4E1fFEee74Fa3859F89cfae00b3aC8C3A8)
- [OpenZeppelin 合约浏览器](https://builder.openzeppelin.com/?ecosystem=evm&chainId=80002&address=0x35774A4E1fFEee74Fa3859F89cfae00b3aC8C3A8&service=sourcify)
- [Remix IDE](https://remix.ethereum.org/#lang=en&optimize&runs=200&evmVersion&version=soljson-v0.8.31+commit.fd3a2265.js)
- [EVM Storage](https://evm-storage.codes/?address=0x35774A4E1fFEee74Fa3859F89cfae00b3aC8C3A8&chainId=80002)

### 部署交易
- **交易哈希**: `0xe2d744f06295c74a6d978ba090aea800d1b3e5d8ae5d3aad06ffc442917cf958`
- **区块号**: 32899092

## 使用说明

### 1. 导入合约
```javascript
import ERC20 from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import Ownable from "@openzeppelin/contracts/access/Ownable.sol";
```

### 2. 编译合约
```bash
solc contracts/XplanDemoToken.sol
```

### 3. 部署合约
通过 Remix IDE 或 Hardhat 部署到目标网络

### 4. 验证合约
在 Sourcify 或 Etherscan 上验证合约源代码

## 安全特性

- **访问控制**: 使用 OpenZeppelin 的 Ownable 模式限制管理员功能
- **账户冻结**: 可冻结恶意账户防止非法转账
- **转账冷却**: 防止高频转账和抢跑攻击
- **紧急暂停**: 可快速冻结问题账户

## 注意事项

⚠️ **测试网部署**: 当前合约部署在 Amoy Testnet，仅用于测试目的

⚠️ **管理员权限**: 部署者地址拥有完全控制权，包括铸造和冻结功能

⚠️ **转账冷却**: 默认冷却时间为 0，需要管理员手动设置

## 开发者信息

- **作者**: X-plan Team
- **许可证**: MIT License
- **仓库**: https://github.com/xplan2026/xplandemo

## 更新日志

### v1.0.0 (2026-01-26)
- ✅ 初始版本发布
- ✅ 基础 ERC20 功能
- ✅ 管理员功能实现
- ✅ 安全功能集成
- ✅ 合约部署到 Amoy Testnet
