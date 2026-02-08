# X-plan 智能合约防盗币

## 功能说明

智能合约防盗币通过智能合约的权限控制机制实现更强的资产保护。

## 目录结构

```
Smart/
├── contracts/          # Solidity 智能合约
│   ├── AntiTheft.sol   # 主合约
│   ├── ERC20.sol       # ERC20 接口
│   └── ERC721.sol      # ERC721 接口
├── scripts/            # 部署脚本
│   └── deploy.js
├── test/              # 测试脚本
│   └── AntiTheft.test.js
├── README.md
└── package.json
```

## 核心功能

1. **权限控制**：通过合约级别的权限控制，限制资产转移
2. **紧急冻结**：检测到异常行为时立即冻结资产
3. **多签验证**：重要操作需要多签验证
4. **时间锁**：设置资产转移的时间锁

## 开发计划

- [x] 创建目录结构
- [ ] 编写 AntiTheft.sol 智能合约
- [ ] 编写部署脚本
- [ ] 编写测试脚本
- [ ] 部署到 Polygon Amoy 测试网
- [ ] 集成到 DemoSite

## 注意事项

- 仅用于 Polygon Amoy 测试网
- 请勿在主网使用真实资产
