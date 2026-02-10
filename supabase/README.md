# Supabase 数据库配置总览

**创建日期**: 2026-02-09
**更新日期**: 2026-02-11
**版本**: v2.0.0
**数据库**: PostgreSQL (Supabase)

## v2.0.0 更新说明

**数据库合并重构**: 合并 demo 和 worker 数据库，统一为 Worker 数据库

### 合并变更
1. **移除不需要的表** - 删除白名单和黑客钱包表（项目不需要）
2. **鉴权机制优化** - 保留 auth_nonce（基于官网钱包连接状态的鉴权）
3. **钱包表整合** - 合并 demo 的 wallets 表，支持 protected/safe/gas 三种类型
4. **合约表增强** - 保留 token_name 字段（来自 demo）
5. **保留实用功能** - 保留 worker_status 和 system_logs（来自 demo）
6. **多 Schema 架构** - 使用 auth_schema、tx_schema、system_schema 三层架构

### 安全修复（P0）
1. **RLS 策略强化** - Worker 数据库移除公共访问，仅允许 authenticated 用户
2. **Auth Nonce 自动清理** - 添加定时清理机制，每小时清理过期 nonce
3. **数据格式验证** - 为钱包地址和交易哈希添加 CHECK 约束
4. **有效测试数据** - 替换无效的零地址为有效测试地址

### 性能优化（P1）
1. **索引优化** - 添加复合索引和部分索引
2. **数据类型修复** - 前端数据库 amount 改为 DECIMAL(30,18)
3. **审计日志表** - 新增系统审计日志功能
4. **聚合视图** - 前端数据库创建交易汇总视图

---

## 数据库架构说明

X-plan 项目使用 **Supabase** 作为数据库服务，分为两个独立的数据库：

### 1. Worker 数据库（合并版）
- **用途**: Cloudflare Worker 数据存储（合并 demo + worker）
- **Schema**: 多 Schema 架构
  - `auth_schema`: 鉴权相关（auth_nonce，基于官网钱包连接状态）
  - `tx_schema`: 交易记录
  - `system_schema`: 系统配置（钱包、合约、RPC节点、Worker状态、日志）
- **文件位置**: `supabase/worker/create-merged-worker-database.sql`

### 2. 官网前端数据库
- **用途**: 官网前端数据存储
- **Schema**: `public` schema
- **表**:
  - `users`: 用户统计（登录用户 + 测试用户）
  - `logs`: 系统操作日志
  - `transactions`: 交易记录
- **文件位置**: `supabase/frontend/`

---

## 文件结构

```
supabase/
├── README.md                           # 本文档
├── worker/                              # Worker 数据库
│   ├── create-worker-database.sql      # Worker 数据库创建脚本（旧版，已废弃）
│   ├── create-merged-worker-database.sql  # Worker 数据库创建脚本（合并版，推荐）
│   ├── fix-worker-database.sql         # Worker 数据库修复脚本
│   └── Worker-数据库设计文档.md         # Worker 数据库设计说明
└── frontend/                           # 官网前端数据库
    ├── create-frontend-database.sql    # 前端数据库创建脚本
    ├── fix-frontend-database.sql       # 前端数据库修复脚本
    └── Frontend-数据库设计文档.md      # 前端数据库设计说明
```

---

## 快速开始

### 选项 A: 单 Supabase 项目（推荐）

使用同一个 Supabase 项目，创建所有表和 Schema：

1. 创建 Supabase 项目
2. 执行 Worker 数据库脚本
3. 执行前端数据库脚本

### 选项 B: 两个独立 Supabase 项目

创建两个独立的 Supabase 项目，分别用于 Worker 和前端：

- **Worker 项目**: 存储业务数据
- **前端项目**: 存储日志和展示数据

---

## 配置步骤

### 1. 创建 Supabase 项目

1. 访问 https://supabase.com
2. 登录并创建新项目
3. 等待项目创建完成（约 2 分钟）
4. 复制 **Project URL** 和 **anon public key**

### 2. 执行 Worker 数据库脚本（合并版）

1. 打开 Supabase Dashboard → SQL Editor
2. 创建新查询
3. 复制 `supabase/worker/create-merged-worker-database.sql` 的内容
4. 粘贴并执行
5. 验证 Schema 和表创建成功

### 3. 执行前端数据库脚本

1. 在同一个 Supabase 项目的 SQL Editor
2. 创建新查询
3. 复制 `supabase/frontend/create-frontend-database.sql` 的内容
4. 粘贴并执行
5. 验证表创建成功

---

## 环境变量配置

### Worker 环境变量

在 Cloudflare Worker 环境变量或 `.env` 文件中配置：

```bash
# Supabase 配置
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key-here
```

### 前端环境变量

在项目根目录的 `.env` 文件中配置：

```bash
# Supabase 配置
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### GitHub Secrets

在 GitHub 仓库中配置：

| Secret 名称 | 说明 |
|-------------|------|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_ANON_KEY` | Supabase Anon Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key（可选） |

---

## 数据库表关系图

### Worker 数据库（合并版）

```
auth_schema
└── auth_nonce          # 认证 nonce（基于官网钱包连接状态）

tx_schema
└── transactions       # 交易记录

system_schema
├── wallets             # 钱包配置（protected/safe/gas）
├── contracts           # 代币合约（含 token_name）
├── rpc_nodes           # RPC 节点
├── db_connections      # 数据库连接
├── worker_status       # Worker 运行状态
├── system_logs         # 系统运行日志
└── audit_log           # 数据变更审计日志
```

### 前端数据库

```
public
├── users              # 用户统计（登录用户 + 测试用户）
├── logs               # 系统日志
└── transactions       # 交易记录
```

---

## 常用查询

### 查询 Worker 数据

```sql
-- 查看未过期的 nonce
SELECT * FROM auth_schema.auth_nonce WHERE expires_at > NOW();

-- 查看交易记录
SELECT * FROM tx_schema.transactions ORDER BY created_at DESC LIMIT 10;

-- 查看钱包配置（按类型）
SELECT * FROM system_schema.wallets WHERE status = 'active' ORDER BY wallet_type;

-- 查看被保护钱包
SELECT * FROM system_schema.wallets WHERE wallet_type = 'protected' AND status = 'active';

-- 查看安全钱包
SELECT * FROM system_schema.wallets WHERE wallet_type = 'safe' AND status = 'active';

-- 查看 Gas 钱包
SELECT * FROM system_schema.wallets WHERE wallet_type = 'gas' AND status = 'active';

-- 查看 Worker 状态
SELECT * FROM system_schema.worker_status;

-- 查看系统日志
SELECT * FROM system_schema.system_logs ORDER BY created_at DESC LIMIT 50;

-- 使用便捷函数获取配置
SELECT * FROM system_schema.get_protected_wallet();
SELECT * FROM system_schema.get_safe_wallet();
SELECT * FROM system_schema.get_gas_wallet();
SELECT * FROM system_schema.get_contract();

-- 查看统计视图
SELECT * FROM system_schema.worker_stats;
SELECT * FROM tx_schema.recent_transactions;
```

### 查询前端数据

```sql
-- 查看最新日志
SELECT * FROM public.logs ORDER BY timestamp DESC LIMIT 50;

-- 查看交易历史
SELECT * FROM public.transactions ORDER BY created_at DESC LIMIT 10;

-- 查询错误日志
SELECT * FROM public.logs WHERE level = 'error' ORDER BY timestamp DESC;
```

---

## 数据库维护

### 清理旧数据

```sql
-- Worker: 清理 7 天前的 nonce
SELECT auth_schema.cleanup_expired_nonce();

-- Worker: 清理 30 天前的交易
SELECT tx_schema.cleanup_old_transactions();

-- Worker: 清理 7 天前的系统日志
SELECT system_schema.cleanup_old_logs();

-- 前端: 清理 30 天前的日志
DELETE FROM public.logs WHERE created_at < NOW() - INTERVAL '30 days';
```

### 创建自动清理任务

```sql
-- 启用 pg_cron 扩展
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 每天凌晨 2 点清理 nonce
SELECT cron.schedule(
  'cleanup-nonce',
  '0 2 * * *',
  $$DELETE FROM auth_schema.auth_nonce WHERE expires_at < NOW()$$
);

-- 每天凌晨 3 点清理日志
SELECT cron.schedule(
  'cleanup-logs',
  '0 3 * * *',
  $$DELETE FROM public.logs WHERE created_at < NOW() - INTERVAL '30 days'$$
);
```

---

## 测试验证

### Worker 数据库连接

在 Cloudflare Worker 控制台测试：

```javascript
const { DatabaseExtension } = require('./extensions/database/DatabaseExtension.js');

const db = new DatabaseExtension(env);
await db.initialize();

// 测试查询
const wallets = await db.system.getProtectedWallets();
console.log('被保护钱包:', wallets);
```

### 前端数据库连接

在浏览器控制台测试：

```javascript
// 测试查询日志
const { data: logs, error } = await supabase
  .from('logs')
  .select('*')
  .limit(5);

if (error) {
  console.error('查询失败:', error);
} else {
  console.log('查询成功:', logs);
}
```

---

## 安全建议

1. **RLS 策略**
   - 已启用 Row Level Security
   - Worker 数据库仅允许 authenticated 用户读写
   - 前端数据库允许公共读取，写入需要认证

2. **API Key 管理**
   - 前端使用 Anon Key（只读）
   - Worker 使用 Service Role Key（读写）
   - 不要在代码中硬编码密钥

2. **API Key 管理**
   - 前端使用 Anon Key（只读）
   - 后端使用 Service Role Key（读写）
   - 不要在代码中硬编码密钥

3. **定期备份**
   - Supabase 自动备份（7 天）
   - 手动导出重要数据

4. **监控使用量**
   - 查看数据库连接数
   - 检查存储空间
   - 监控 API 调用次数

---

## 故障排查

### 问题 1: 连接失败

**错误**: `Could not connect to database`

**解决**:
1. 检查 Supabase URL 是否正确
2. 确认 Supabase 项目已启动
3. 检查 API Key 是否有效

### 问题 2: 权限错误

**错误**: `permission denied for table`

**解决**:
1. 检查 RLS 策略是否正确
2. 使用正确的 API Key（Anon vs Service Role）
3. 重新执行 RLS 策略配置

### 问题 3: 性能问题

**解决**:
1. 检查索引是否创建
2. 限制查询结果数量
3. 添加时间范围过滤

---

## 相关文档

- [Worker 数据库设计](./worker/Worker-数据库设计文档.md)
- [前端数据库设计](./frontend/Frontend-数据库设计文档.md)
- [Supabase 官方文档](https://supabase.com/docs)

---

**最后更新**: 2026-02-11
**版本**: v2.0.0
**重大变更**: 合并 demo 和 worker 数据库
