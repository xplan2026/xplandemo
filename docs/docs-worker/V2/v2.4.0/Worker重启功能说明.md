# Worker 手动重启功能说明

## 功能概述

Worker 提供了一个 `/restart` HTTP 端点，用于手动重启 Worker，清除缓存、释放锁、重置状态。

## 使用场景

1. **Cloudflare 免费额度超限**
   - 当出现 429 错误码时
   - CPU 时间超限
   - 请求次数超限

2. **Worker 状态异常**
   - 分布式锁卡死
   - 钱包状态异常
   - 缓存数据过期

3. **手动干预后重置**
   - 手动干预操作后需要重置状态
   - 测试完成后清理环境

## API 端点

### 请求

```bash
POST https://worker-integrated-pool.3813518962.workers.dev/restart
```

或

```bash
POST https://integrated-pool-2.2238642875.workers.dev/restart
```

### 请求体

```json
{}
```

### 响应示例

```json
{
  "success": true,
  "message": "Worker restarted successfully",
  "worker_id": "worker-integrated-pool",
  "worker_name": "worker-integrated-pool",
  "timestamp": "2026-02-02T02:00:00.000Z",
  "duration": 123,
  "actions": [
    {
      "action": "release_lock",
      "key": "scan_global_lock",
      "success": true
    },
    {
      "action": "release_lock",
      "key": "manual_scan_lock",
      "success": true
    },
    {
      "action": "release_wallet_lock",
      "wallet": "e16",
      "success": true
    },
    {
      "action": "clear_ratelimit",
      "key": "ratelimit:/:",
      "success": true
    },
    {
      "action": "log_restart_event",
      "success": true
    }
  ],
  "summary": {
    "total_actions": 10,
    "successful_actions": 10,
    "failed_actions": 0
  }
}
```

## 重启操作内容

### 1. 清除分布式锁

清除以下锁：
- `scan_global_lock` - 全局扫描锁
- `manual_scan_lock` - 手动扫描锁
- `emergency_lock` - 应急状态锁
- `transfer_lock` - 转账锁
- 所有钱包锁（按钱包地址）

### 2. 清除 KV 缓存

清除速率限制缓存：
- `ratelimit:/:` - 健康检查速率限制
- `ratelimit:/status:` - 状态查询速率限制
- `ratelimit:/scan:` - 扫描触发速率限制
- `ratelimit:/restart:` - 重启速率限制

### 3. 记录重启事件

在数据库中记录重启事件，包括：
- 重启类型（manual_restart）
- 执行的操作
- 操作结果统计

## 使用方法

### cURL 命令

```bash
curl -X POST https://worker-integrated-pool.3813518962.workers.dev/restart
```

### JavaScript

```javascript
const response = await fetch('https://worker-integrated-pool.3813518962.workers.dev/restart', {
  method: 'POST'
})
const result = await response.json()
console.log(result)
```

### Python

```python
import requests

response = requests.post('https://worker-integrated-pool.3813518962.workers.dev/restart')
result = response.json()
print(result)
```

## 注意事项

1. **重启不会停止 Cron 任务**
   - Cron 触发器是 Cloudflare 平台层面的配置，重启 Worker 不会停止定时任务
   - 重启只会清除内存状态和 KV 缓存

2. **重启是幂等的**
   - 可以多次执行重启操作，不会产生副作用
   - 锁和缓存不存在时，释放操作会静默失败

3. **重启不丢失数据**
   - Supabase 数据库中的数据不会被清除
   - 仅清除分布式锁和速率限制缓存

4. **速率限制**
   - 重启端点也受速率限制限制（10次/分钟/IP）
   - 频繁重启可能触发速率限制

5. **安全性**
   - 重启端点没有额外的认证保护
   - 建议在生产环境中添加 API Key 或签名验证

## 故障排查

### 重启失败

如果重启返回 `success: false`，检查：

1. KV 命名空间是否可用
2. 数据库连接是否正常
3. Worker 是否有足够的权限

### 重启后仍然异常

如果重启后 Worker 仍然异常：

1. 检查 Cron 触发器配置
2. 检查环境变量是否正确
3. 查看 Worker 日志
4. 考虑重新部署 Worker

## 监控建议

建议监控以下指标：

1. 重启频率
   - 如果频繁重启，说明存在系统性问题

2. 重启成功/失败率
   - 失败率高需要检查配置

3. 重启耗时
   - 耗时过长可能影响性能

## 版本信息

- **添加版本**: v2.4.0-dev
- **更新日期**: 2026-02-02
- **适用 Worker**: worker-integrated-pool, integrated-pool-2
