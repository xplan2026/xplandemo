# Supabase 数据库配置指南

**创建日期**: 2026-02-09
**适用项目**: X-plan 官网
**数据库类型**: PostgreSQL (Supabase)

---

## 步骤 1: 在 Supabase 创建项目

1. **登录 Supabase**
   - 访问: https://supabase.com
   - 使用邮箱或 GitHub 账号登录

2. **创建新项目**
   - 点击 "New Project"
   - 输入项目名称（例如: `xplan-official`）
   - 选择数据库密码（保存密码，后续需要）
   - 选择区域（推荐: Southeast Asia (Singapore)）
   - 点击 "Create new project"
   - 等待项目创建完成（约 2 分钟）

3. **获取连接信息**
   - 进入项目 Dashboard
   - 左侧菜单 → **Settings** → **API**
   - 复制以下信息：
     - **Project URL**: `https://xxxxx.supabase.co`
     - **anon public**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

## 步骤 2: 执行数据库创建脚本

1. **打开 SQL Editor**
   - 左侧菜单 → **SQL Editor**
   - 点击 "New Query"

2. **执行 SQL 脚本**
   - 打开文件: `docs/数据库/create-xplan-database.sql`
   - 复制完整 SQL 代码
   - 粘贴到 SQL Editor 中
   - 点击 "Run" 执行

3. **验证创建结果**
   - 查看输出结果，确认表创建成功
   - 左侧菜单 → **Table Editor**
   - 应该看到两个表: `logs` 和 `transactions`

---

## 步骤 3: 配置前端环境变量

### 方法 1: 本地开发环境

编辑项目根目录的 `.env` 文件：

```bash
# Supabase 配置
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**注意**:
- 替换 `your-project.supabase.co` 为你的 Project URL
- 替换 `your-anon-key-here` 为 anon public key

### 方法 2: GitHub Secrets 配置

在 GitHub 仓库中配置 Secrets：

1. 进入 GitHub 仓库
2. 点击 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**
4. 添加以下 Secrets:

| Secret 名称 | 说明 |
|-------------|------|
| `SUPABASE_URL` | Project URL（例如: `https://xxxxx.supabase.co`） |
| `SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key（可选，用于服务器端） |

---

## 步骤 4: 测试数据库连接

### 1. 浏览器控制台测试

在网站页面按 F12 打开控制台，执行：

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

// 测试查询交易
const { data: txs } = await supabase
  .from('transactions')
  .select('*')
  .limit(5);

console.log('交易记录:', txs);
```

### 2. 测试插入数据

```javascript
// 插入测试日志
const { data, error } = await supabase
  .from('logs')
  .insert([
    {
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'monitor',
      message: '测试日志插入'
    }
  ]);

if (error) {
  console.error('插入失败:', error);
} else {
  console.log('插入成功:', data);
}
```

---

## 步骤 5: 在服务器上配置环境变量

### 1. 登录服务器

```bash
ssh -i ~/.ssh/xplan_server_key ubuntu@182.254.180.26
```

### 2. 创建环境变量文件

```bash
cd /var/www/xplan-demo

# 创建 .env 文件
nano .env
```

### 3. 添加配置内容

```bash
# Supabase 配置
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# 其他配置...
VITE_APP_TITLE=X-plan Official Site
VITE_NODE_ENV=production
```

### 4. 保存文件

按 `Ctrl+O` 保存，按 `Ctrl+X` 退出

---

## 步骤 6: 验证部署

### 1. 检查环境变量

```bash
cd /var/www/xplan-demo
cat .env
```

### 2. 重新构建前端

```bash
cd /var/www/xplan-demo/official-site

# 安装依赖
npm install

# 构建生产版本
npm run build

# 验证构建输出
ls -la dist/
```

### 3. 访问网站

打开浏览器访问: `http://182.254.180.26:6060`

### 4. 检查数据库

访问 Supabase Dashboard → Table Editor，查看是否有新数据插入

---

## 常见问题

### Q1: 连接 Supabase 失败

**错误信息**:
```
API key does not have the necessary permissions
```

**解决方法**:
1. 检查 Supabase URL 和 Anon Key 是否正确
2. 确认 RLS 策略已启用并允许公共访问
3. 在 Supabase Dashboard → API 检查 Key 是否过期

### Q2: 无法插入数据

**错误信息**:
```
new row violates row-level security policy
```

**解决方法**:
1. 检查 RLS 策略是否允许 `authenticated` 用户插入
2. 使用 Service Role Key 而非 Anon Key 进行写入操作
3. 在 SQL Editor 中重新执行 RLS 策略配置

### Q3: 查询速度慢

**优化建议**:
1. 检查索引是否创建成功:
   ```sql
   SELECT indexname, indexdef
   FROM pg_indexes
   WHERE tablename IN ('logs', 'transactions');
   ```
2. 限制查询结果数量（使用 `.limit()`）
3. 添加时间范围过滤

---

## 数据库维护

### 清理旧数据

```sql
-- 清理 30 天前的日志
DELETE FROM logs
WHERE created_at < NOW() - INTERVAL '30 days';

-- 清理 7 天前的失败交易
DELETE FROM transactions
WHERE status = 'failed' AND created_at < NOW() - INTERVAL '7 days';
```

### 创建自动清理任务

在 Supabase Dashboard 中创建 Cron Job:

1. 左侧菜单 → **Database** → **Extensions**
2. 启用 `pg_cron` 扩展
3. 创建定期清理任务:

```sql
-- 每天凌晨 2 点清理日志
SELECT cron.schedule(
  'cleanup-logs',
  '0 2 * * *',
  $$DELETE FROM logs WHERE created_at < NOW() - INTERVAL '30 days'$$
);

-- 每天凌晨 3 点清理失败交易
SELECT cron.schedule(
  'cleanup-failed-transactions',
  '0 3 * * *',
  $$DELETE FROM transactions WHERE status = 'failed' AND created_at < NOW() - INTERVAL '7 days'$$
);
```

---

## 安全建议

1. **不要提交 .env 文件**
   - 确保 `.env` 在 `.gitignore` 中
   - 使用 GitHub Secrets 存储敏感信息

2. **使用最小权限原则**
   - 前端使用 Anon Key（只读）
   - 后端使用 Service Role Key（读写）

3. **定期备份**
   - Supabase 自动备份（保留 7 天）
   - 手动导出重要数据

4. **监控使用量**
   - 左侧菜单 → **Usage**
   - 查看数据库连接数、存储空间、API 调用次数

---

## 相关文档

- [数据库设计文档](./X-plan-官网数据库设计.md)
- [Supabase 官方文档](https://supabase.com/docs)
- [RLS 策略指南](https://supabase.com/docs/guides/auth/row-level-security)

---

**最后更新**: 2026-02-09
**版本**: v1.0.0
