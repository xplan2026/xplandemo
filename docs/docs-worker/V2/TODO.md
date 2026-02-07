# V2 TODO

本文档记录 V2 版本的待办事项和任务清单。

---

## 当前活跃分支：v2.4.1-dev

### 分支工作目标

v2.4.1 版本聚焦于**前端管理界面开发**，为 Worker-Integrated-Pool 提供可视化的 Web 管理平台。

### 核心功能

1. **钱包状态监控**
   - 实时显示所有被保护钱包的余额（BNB、wkeyDAO、USDT）
   - 显示钱包状态（正常/转账/应急）- 颜色编码
   - 自动刷新（每 30 秒）
   - 点击钱包卡片查看详情

2. **应急状态监控**
   - 查看所有处于应急状态的钱包
   - 显示锁定该钱包的 Worker
   - 实时倒计时显示锁的剩余时间

3. **手动触发扫描**
   - 手动触发完整扫描和转账操作
   - 显示扫描进度和结果
   - 需要 API Key 认证
   - 二次确认对话框保护

4. **Worker 重启**
   - 手动重启 Worker，清除分布式锁
   - 显示执行的操作列表
   - 需要 API Key 认证
   - 二次确认对话框保护

5. **健康检查**
   - 检查 Worker 运行状态
   - 显示 Worker ID 和时间戳
   - 实时状态指示灯（绿色=正常，红色=异常）

6. **API 密钥管理**
   - 安全存储 API Key（本地加密存储）
   - 支持显示/隐藏切换
   - 持久化保存（localStorage）

### 技术栈

- **HTML5** - 语义化标签
- **CSS3** - Flexbox/Grid 布局，CSS 变量
- **JavaScript ES6+** - 原生，无框架
- **响应式设计** - 桌面端、平板端、移动端

### 目标 Worker

- **唯一 Worker**: `integrated-pool-2`
- **API 地址**: `https://api.weare.run`
- **自定义域名**: `api.weare.run`

### 项目结构

```
frontend/
├── index.html          # 主页面
├── css/
│   ├── variables.css   # CSS 变量
│   └── styles.css     # 主样式
├── js/
│   ├── utils.js       # 工具函数
│   ├── api.js         # API 调用封装
│   ├── components.js   # UI 组件
│   └── app.js         # 主应用逻辑
└── README.md          # 前端说明文档
```

---

## 已完成的分支：v2.4.0-dev

### 分支工作目标

v2.4.0 版本聚焦于**代码审计和安全加固**，优化现有 Worker 架构，提升系统安全性和可靠性。

### 核心目标

1. **代码深度审计** - 全面检查代码安全和质量
   - 识别严重、高危、中危问题
   - 修复安全漏洞和性能问题
   - 优化代码质量

2. **RPC节点优化** - 简化节点池管理
   - 删除不可用节点
   - 移除复杂排名逻辑
   - 使用手动测试方法

3. **Gas费策略优化** - 简化为先发制人策略
   - 所有BNB作为Gas费
   - 移除竞争模式计算
   - 抢先锁定资产

4. **扩展模块清理** - 删除未使用的扩展
   - 合并重复的RPC节点扩展
   - 删除未使用的扩展模块
   - 统一扩展入口

5. **文档完善** - 为所有扩展创建README
   - 转账扩展文档
   - Transfer Worker文档
   - RPC节点池文档

---

## 待办事项

### 已完成 ✅

#### 2026-02-02 - 代码审计与安全加固

**代码深度审计**
- [x] 执行全面的代码审计
  - [x] 发现31个问题（5个严重、7个高危、7个中危）
  - [x] 生成详细审计报告
- [x] 修复严重问题（4/5个）
  - [x] 移除GasFunder私钥日志
  - [x] 移除Transfer私钥访问日志
  - [x] 移除DatabaseExtension的Supabase Key日志
  - [x] 添加分布式锁TTL机制注释
- [x] 修复高危问题（5/7个）
  - [x] 添加安全钱包地址验证
  - [x] 添加地址黑名单检查
  - [x] 生产环境返回通用错误
  - [x] 添加API速率限制（10次/分钟）
  - [x] 钱包列表去重和数量上限
- [x] 修复中危问题（5/7个）
  - [x] 添加交易状态验证
  - [x] 添加缓存穿透防护
  - [x] 添加转账循环超时保护（3分钟）
  - [x] 添加交易确认超时保护（90秒）
  - [x] 移除RPC节点健康检查（使用手动测试）
  - [x] 调整钱包数量上限为5个

**部署测试**
- [x] 修复依赖问题（ethers导入错误）
- [x] 部署到主账号（worker-integrated-pool）
- [x] 部署到辅助账号（integrated-pool-2）
- [x] 复制代码到两个Worker目录

**新增功能：API Key认证**
- [x] 添加 API Key 认证机制
- [x] 仅对危险操作需要认证（`/scan`, `/restart`）
- [x] 修改两个 Worker 代码
- [x] 通过 Secret 设置 API Key
- [x] 为两个 Worker 设置相同的 API Key
- [x] 重新部署两个 Worker
- [x] 创建 API 文档

**新增功能：手动重启**
- [x] 添加 `/restart` HTTP端点
- [x] 实现清除分布式锁功能
- [x] 实现清除KV缓存功能
- [x] 记录重启事件到数据库
- [x] 更新API文档
- [x] 创建功能说明文档
- [x] 部署到两个账号

**文档分类和整理**
- [x] 创建 v2.4.0 版本目录
- [x] 移动 v2.4.0 专属文档
- [x] 移动通用文档到通用文档/
- [x] 重命名 Worker文档/ 为 2.3.0-worker-废弃/

**RPC节点优化**
- [x] 执行RPC节点连通性测试
- [x] 测试结果：5个节点100%可用，6个节点完全不可用
- [x] 删除6个不可用节点
- [x] 保留5个可用节点
  - bsc-dataseed2.defibit.io (540ms)
  - bsc-dataseed2.ninicoin.io (580ms)
  - bsc-dataseed3.ninicoin.io (590ms)
  - bsc-dataseed3.defibit.io (580ms)
  - bsc-rpc.publicnode.com (610ms)
- [x] 简化RpcPoolOptimizedExtension
  - [x] 移除节点排名逻辑
  - [x] 移除KV持久化
  - [x] 移除自动维护
  - [x] 移除健康检查
- [x] 创建测试脚本 `test-rpc-connectivity.js`
- [x] 创建RPC节点池README文档
- [x] 记录测试结果到 `docs/V2/RPC节点接通率测试-2026-02-02.md`

**Gas费策略优化**
- [x] 移除竞争模式（competitiveMode）
- [x] 实施先发制人策略
  - [x] 所有BNB作为Gas费
  - [x] 移除150% Gas价格倍数
  - [x] 移除Gas Limit buffer
  - [x] 简化Gas价格计算
- [x] 更新Transfer扩展README

**扩展模块清理**
- [x] 删除 `extensions/rpc-pool/` 目录
  - [x] 删除 RpcPoolExtension.js
  - [x] 删除 config.js
  - [x] 删除 example-scanner.js
  - [x] 删除 index.js
  - [x] 删除 test.js
- [x] 删除 `extensions/transaction-checker/` 目录
  - [x] 删除 TransactionChecker.js
  - [x] 删除 index.js
  - [x] 删除 package.json
- [x] 移动测试脚本到扩展目录
  - [x] `test-rpc-connectivity.js` → `rpc-pool-optimized/`

**文档完善**
- [x] 创建 `extensions/rpc-pool-optimized/README.md`
- [x] 创建 `extensions/transfer/README.md`
- [x] 创建 `extensions/transfer-worker/README.md`
- [x] 添加安全特性说明
- [x] 添加Gas费策略详解
- [x] 更新版本历史

### 进行中 🔄

无

### 待完成 📋

#### 阶段 1：测试和验证
- [x] 部署修复后的代码到 Cloudflare
- [x] 验证 Worker 正常运行
- [ ] 测试 API Key 认证功能
- [ ] 测试安全钱包地址验证
- [ ] 测试API速率限制
- [ ] 测试交易状态验证
- [ ] 测试超时保护机制
- [ ] 测试手动重启功能

#### 阶段 2：监控和优化
- [ ] 监控Worker运行日志
- [ ] 观察RPC节点可用性
- [ ] 定期手动测试RPC节点
- [ ] 根据测试结果更新节点列表

#### 阶段 3：文档完善
- [ ] 更新项目主README
- [ ] 创建部署文档
- [ ] 创建故障排查手册
- [ ] 添加API文档链接

---

## 技术债务和优化

### 代码优化
- [ ] 添加单元测试
- [ ] 添加集成测试
- [ ] 添加日志分级（DEBUG/INFO/WARN/ERROR）
- [ ] 优化任务队列性能
- [ ] 添加监控指标

### 性能优化
- [ ] 并行化钱包扫描
- [ ] 添加本地缓存层
- [ ] 优化重试退避策略

### 安全优化
- [ ] 实施更严格的输入验证
- [ ] 添加请求签名验证
- [ ] 实施更细粒度的权限控制

---

## 风险和注意事项

### 风险

1. **RPC节点故障**：如果剩余5个节点同时故障，系统无法运行
2. **手动维护负担**：需要定期手动测试RPC节点
3. **安全策略变更**：先发制人策略需要充分测试
4. **速率限制误伤**：API速率限制可能影响正常使用

### 注意事项

1. **定期RPC测试**：建议每月测试一次RPC节点可用性
2. **监控日志**：密切关注Worker运行日志
3. **渐进式部署**：修复后分阶段部署，观察效果
4. **保留回退方案**：必要时可回退到旧版本

---

## 相关文档

- [Worker-Integrated-Pool-API文档.md](./v2.4.0/Worker-Integrated-Pool-API文档.md) - API 文档
- [RPC节点接通率测试-2026-02-02.md](./v2.4.0/RPC节点接通率测试-2026-02-02.md) - 节点测试结果
- [Worker重启功能说明.md](./v2.4.0/Worker重启功能说明.md) - 手动重启功能文档
- [transfer/README.md](../../cloudflare/extensions/transfer/README.md) - 转账扩展文档
- [transfer-worker/README.md](../../cloudflare/extensions/transfer-worker/README.md) - Transfer Worker文档
- [rpc-pool-optimized/README.md](../../cloudflare/extensions/rpc-pool-optimized/README.md) - RPC节点池文档

---

## 版本规划

|| 版本 | 状态 | 说明 | 分支 |
|||------|------|------|------|
||| **v2.3.0** | ✅ 完成 | Worker-Turns 协同架构 | `v2.3.0` |
||| ****v2.4.0** | ✅ 完成 | 代码审计与安全加固 | `v2.4.0-dev` |
|||| **v2.4.1** | 📋 计划中 | 前端管理界面 | `v2.4.1-dev` |
||| **v2.5.0** | 📋 计划中 | 待定 | `v2.5.0-dev` |
||| **v3.0** | 💡 规划中 | 官网 + Demo + 开源 | `v3.0.0-dev` |

---

**最后更新**：2026-02-02

---

## v2.4.1 待办事项

### 已完成 ✅

#### 2026-02-02 - 前端基础实现

**项目初始化**
- [x] 创建 v2.4.1-dev 分支
- [x] 创建前端项目结构
- [x] 创建核心文件（HTML、CSS、JS）

**核心功能实现**
- [x] 钱包状态监控（实时显示余额和状态）
- [x] 应急状态监控（倒计时显示）
- [x] 手动触发扫描（API Key 认证）
- [x] Worker 重启（API Key 认证）
- [x] 健康检查
- [x] API 密钥管理

**API 配置**
- [x] 配置 API 端点为 `https://api.weare.run`
- [x] 针对 `integrated-pool-2` Worker
- [x] 实现 API Key 认证

**UI/UX 设计**
- [x] 响应式布局（桌面端、平板端、移动端）
- [x] CSS 变量系统
- [x] 颜色编码（绿色=正常，红色=异常）
- [x] 卡片式布局
- [x] 加载动画和过渡效果

**文档完善**
- [x] 创建前端 README 文档
- [x] 创建 v2.4.1 前端开发规划文档
- [x] 创建 v2.4.1 分支规则（仅针对 integrated-pool-2）

**代码清理**
- [x] 删除废弃的 worker-integrated-pool 目录
- [x] 删除废弃的文档目录（V1、2.3.0-worker-废弃、RateLimiting）
- [x] 删除废弃的 API 文档（X-plan-API文档.md）
- [x] 更新主 README.md
- [x] 更新 TODO.md

### 已完成 ✅

#### 2026-02-02 - 双账户部署与Cron错开

**新增功能：双账户Worker部署**
- [x] 添加主账户 Worker (`worker-integrated-pool`)
- [x] 复制 `integrated-pool-2` 到 `worker-integrated-pool`
- [x] 修改 `worker-integrated-pool/wrangler.toml` 配置
  - [x] 更新为主账户 account_id
  - [x] 更新 Worker ID 和名称
  - [x] 更新 KV 命名空间 ID
- [x] 验证两个 Worker 代码一致性
  - [x] KV 使用相同（仅 ID 不同）
  - [x] 全局锁使用相同
  - [x] 两阶段扫描优化相同
- [x] 部署 `worker-integrated-pool` 到主账户
- [x] 创建 Worker 性能分析报告

**Cron 执行时间错开优化**
- [x] 设置 `worker-integrated-pool` Cron: `* * * * *` (每分钟 0 秒)
- [x] 设置 `integrated-pool-2` Cron: `30 * * * *` (每分钟 30 秒)
- [x] 部署 `integrated-pool-2` 更新
- [x] 提交并推送

**文档更新**
- [x] 创建 Worker 性能分析报告
  - [x] 分析移除 API 访问的影响
  - [x] 代码规模：API 代码占 53.8%
  - [x] 性能影响：对主要功能提升仅 0.08%
  - [x] 结论：建议保留 API 访问功能
- [x] 创建安全模式设计方案
  - [x] 方案一：临时禁用保护（推荐）
  - [x] 方案二：白名单代币（更精细）
  - [x] 方案三：手动转账窗口期（安全）
  - [x] API 设计、Worker 逻辑、数据库结构
  - [x] 安全评估和性能影响分析

### 进行中 🔄

无

### 待完成 📋

#### 阶段 1：安全模式实施（方案一：临时禁用保护）

**数据库准备**
- [ ] 创建 `wallet_pause_history` 表
- [ ] 创建索引

**Worker 修改（同时修改两个 Worker）**
- [ ] 修改 `scanWallet` 函数，添加暂停检查逻辑
- [ ] 实现 `recordPauseStatus` 函数
- [ ] 实现 `recordResumeStatus` 函数
- [ ] 实现 `handlePauseWallet` API 处理器
- [ ] 实现 `handleResumeWallet` API 处理器
- [ ] 实现 `handleWalletStatus` API 处理器
- [ ] 更新路由注册

**前端开发**
- [ ] 在钱包状态页面添加"暂停保护"按钮
- [ ] 添加"恢复保护"按钮
- [ ] 显示暂停倒计时
- [ ] 显示暂停历史记录
- [ ] 添加二次确认对话框

**测试验证**
- [ ] 测试暂停保护功能
- [ ] 测试自动恢复保护
- [ ] 测试手动恢复保护
- [ ] 测试每日次数限制（5 次）
- [ ] 测试时长限制（1 小时）
- [ ] 部署到两个 Worker
- [ ] 提交并推送

#### 阶段 2：安全模式实施（方案三：手动转账窗口）

**Worker 修改**
- [ ] 修改 `scanWallet` 函数，添加窗口检查逻辑
- [ ] 实现 `handleOpenManualWindow` API 处理器
- [ ] 更新路由注册

**前端开发**
- [ ] 添加"开启手动窗口"按钮
- [ ] 显示窗口倒计时
- [ ] 显示窗口剩余次数
- [ ] 添加二次确认对话框

**测试验证**
- [ ] 测试手动窗口功能
- [ ] 测试窗口自动关闭
- [ ] 测试每日次数限制（3 次）
- [ ] 测试总时长限制（10 分钟）
- [ ] 部署到两个 Worker
- [ ] 提交并推送

#### 阶段 3：安全增强

**操作审计**
- [ ] 记录所有 API 调用
- [ ] 记录操作 IP 地址
- [ ] 记录操作时间戳
- [ ] 添加审计日志查询 API

**告警机制**
- [ ] 钱包暂停超过阈值时发送告警
- [ ] 钱包手动窗口次数过多时发送告警
- [ ] 检测到异常操作时发送告警

**监控面板**
- [ ] 添加钱包保护状态监控
- [ ] 添加暂停历史可视化
- [ ] 添加操作审计日志

#### 阶段 4：功能测试

- [ ] 本地测试所有功能
- [ ] 测试 API Key 认证
- [ ] 测试钱包状态监控
- [ ] 测试应急状态监控
- [ ] 测试手动触发扫描
- [ ] 测试 Worker 重启
- [ ] 测试健康检查
- [ ] 测试 API 密钥管理

#### 阶段 5：UI/UX 优化
- [ ] 添加更多图表和数据可视化
- [ ] 优化动画效果
- [ ] 改进移动端体验
- [ ] 添加深色模式
- [ ] 优化加载性能

#### 阶段 6：部署
- [ ] 配置 Cloudflare Pages
- [ ] 部署前端到 Cloudflare Pages
- [ ] 配置自定义域名（如 `admin.weare.run`）
- [ ] 配置 HTTPS
- [ ] 配置 CORS（如需要）

#### 阶段 7：文档完善
- [ ] 更新前端 README（添加部署说明）
- [ ] 创建用户手册
- [ ] 创建故障排查手册
- [ ] 添加视频教程（可选）

