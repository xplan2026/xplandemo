# EmergencyExtension.logEvent() 优化方案

**日期**: 2026-01-27
**文件**: `cloudflare/extensions/emergency/EmergencyExtension.js`

---

## 问题分析

### 当前使用情况

`_logEmergencyStatus()` 方法被调用的位置：

| 位置 | 调用时机 | action | metadata |
|------|---------|--------|----------|
| `enterEmergencyMode()` (第70行) | 进入应急状态 | `entered` | `{ wallets, reason: 'automatic_trigger' }` |
| `exitEmergencyMode()` (第105行) | 退出应急状态 | `exited` | `{ reason }` |

### 目的

**记录应急状态变化**，包括：
- 何时进入应急模式
- 何时退出应急模式
- 涉及哪些钱包
- 退出原因

### 当前实现

```javascript
async _logEmergencyStatus(action, metadata = {}) {
  if (!this.db.emergency) {
    return  // 🔴 模块不存在，静默失败
  }

  try {
    await this.db.emergency.logEvent({
      worker_id: this.workerId,
      action,
      wallets: this.protectedWallets,
      metadata,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error(`记录应急状态失败:`, error.message)
  }
}
```

---

## 是否需要数据库？

### ❌ 当前设计问题

1. **紧急状态变化很少发生**
   - 正常情况下，应急模式每周可能触发 0-2 次
   - 每次进入/退出 = 2 条记录
   - 月增量：~16 条

2. **已有 console.log 输出**
   ```javascript
   console.log(`🚨 [${this.workerId}] 进入应急状态，监控 ${this.protectedWallets.length} 个钱包`)
   console.log(`✅ [${this.workerId}] 退出应急状态，原因: ${reason}`)
   ```

3. **DatabaseExtension 没有初始化 emergency 模块**
   - 代码中调用 `this.db.emergency` 但模块不存在
   - 静默失败，没有任何效果

4. **Supabase 免费版限制**
   - 20,000 行/月 写入限制
   - 每条记录都增加写入压力

### ✅ 实际需求

| 需求 | 优先级 | 实现方式 |
|------|--------|----------|
| 实时监控 | 🔴 高 | console.log（已实现） |
| 历史审计 | 🟡 中 | 可选，使用 KV 存储 |
| 趋势分析 | 🟢 低 | 可选，使用外部日志服务 |

---

## 优化方案

### 方案 1: 移除数据库记录，仅使用 console.log（推荐）

**优点**:
- ✅ 最简单，无需额外依赖
- ✅ 减少数据库写入压力
- ✅ console.log 可通过 Cloudflare 日志查看

**缺点**:
- ❌ 无历史记录（重启后丢失）
- ❌ 无法查询历史应急事件

**代码修改**:

```javascript
// cloudflare/extensions/emergency/EmergencyExtension.js

/**
 * 记录应急状态变化
 * @private
 */
async _logEmergencyStatus(action, metadata = {}) {
  // 仅使用 console.log，不写入数据库
  const actionText = action === 'entered' ? '进入' : '退出'
  const reasonText = metadata.reason ? `，原因: ${metadata.reason}` : ''

  console.log(`📋 [${this.workerId}] 应急状态${actionText} - 钱包数: ${this.protectedWallets.length}${reasonText}`)
}
```

---

### 方案 2: 使用 KV 存储应急事件（建议）

**优点**:
- ✅ 有历史记录
- ✅ 查询快速
- ✅ 不占用数据库写入配额
- ✅ Cloudflare Workers 免费版 KV 有足够配额

**缺点**:
- ❌ KV 有 1MB 键大小限制
- ❌ 需要手动清理过期数据

**代码修改**:

```javascript
// cloudflare/extensions/emergency/EmergencyExtension.js

export class EmergencyExtension {
  constructor(env, db, options = {}) {
    this.env = env
    this.db = db
    this.workerId = options.workerId || 'unknown'

    // KV 绑定
    this.kv = env.EMERGENCY_KV || env.KV || null

    // ... 其他初始化
  }

  /**
   * 记录应急状态变化
   * @private
   */
  async _logEmergencyStatus(action, metadata = {}) {
    const timestamp = Date.now()
    const eventKey = `emergency_event:${this.workerId}:${timestamp}`

    const event = {
      worker_id: this.workerId,
      action,
      wallets: this.protectedWallets,
      metadata,
      timestamp: new Date(timestamp).toISOString()
    }

    // console.log 输出
    const actionText = action === 'entered' ? '进入' : '退出'
    console.log(`📋 [${this.workerId}] 应急状态${actionText} - ${JSON.stringify(event)}`)

    // KV 存储（可选）
    if (this.kv) {
      try {
        await this.kv.put(eventKey, JSON.stringify(event), {
          expirationTtl: 7 * 24 * 60 * 60 // 7 天 TTL
        })
      } catch (error) {
        console.warn(`[EmergencyExtension] KV 写入失败:`, error.message)
      }
    }
  }

  /**
   * 获取应急事件历史
   */
  async getEmergencyHistory(limit = 50) {
    if (!this.kv) {
      return []
    }

    try {
      const { list } = await this.kv.list({
        prefix: `emergency_event:${this.workerId}:`,
        limit
      })

      return list.map(item => JSON.parse(item.value))
    } catch (error) {
      console.error(`[EmergencyExtension] 获取历史失败:`, error.message)
      return []
    }
  }
}
```

**wrangler.toml 配置**:
```toml
[[kv_namespaces]]
binding = "EMERGENCY_KV"
id = "YOUR_EMERGENCY_KV_ID"
preview_id = "YOUR_PREVIEW_EMERGENCY_KV_ID"
```

---

### 方案 3: 保留数据库记录，但移除依赖（不推荐）

**优点**:
- ✅ 有完整的历史记录
- ✅ 可通过 SQL 查询
- ✅ 适合大规模系统

**缺点**:
- ❌ 占用数据库写入配额
- ❌ 需要创建表和模块
- ❌ 对于应急事件（低频）过于复杂

**代码修改**:

需要创建：
1. `supabase/01-create-emergency-tables.sql` - 创建表
2. `cloudflare/extensions/database/emergency.js` - 模块实现
3. `cloudflare/extensions/database/DatabaseExtension.js` - 添加模块导入

---

## 方案对比

| 方案 | 复杂度 | 存储持久化 | 查询能力 | 数据库压力 | 推荐度 |
|------|--------|-----------|----------|-----------|--------|
| 方案 1: 仅 console.log | 🟢 低 | ❌ 无 | ❌ 仅实时 | 🟢 无 | ⭐⭐⭐⭐ |
| 方案 2: KV 存储 | 🟡 中 | ✅ KV | ✅ 快速 | 🟢 无 | ⭐⭐⭐⭐⭐ |
| 方案 3: 数据库存储 | 🔴 高 | ✅ 数据库 | ✅ SQL | 🟡 低-中 | ⭐⭐ |

---

## 最终建议

### 短期（立即执行）: 采用方案 1

```javascript
// cloudflare/extensions/emergency/EmergencyExtension.js

async _logEmergencyStatus(action, metadata = {}) {
  const actionText = action === 'entered' ? '进入' : '退出'
  const reasonText = metadata.reason ? `，原因: ${metadata.reason}` : ''

  console.log(`📋 [${this.workerId}] 应急状态${actionText} - 钱包数: ${this.protectedWallets.length}${reasonText}`)
}
```

**理由**:
- 应急事件低频，实时日志已足够
- 简单直接，无额外依赖
- Cloudflare Dashboard 可查看历史日志（最近 7 天）

### 中期（可选）: 采用方案 2

如果需要查询应急事件历史，使用 KV 存储：
- 添加 KV 绑定到 `wrangler.toml`
- 修改 `_logEmergencyStatus()` 方法
- 添加 `getEmergencyHistory()` 方法

### 长期（不推荐）: 方案 3

除非有明确的审计需求，否则不推荐使用数据库存储应急事件。

---

## 清理建议

### 需要删除的代码

```javascript
// EmergencyExtension.js:407-422
async _logEmergencyStatus(action, metadata = {}) {
  if (!this.db.emergency) {  // ❌ 删除此检查
    return
  }

  try {
    await this.db.emergency.logEvent({  // ❌ 删除数据库调用
      worker_id: this.workerId,
      action,
      wallets: this.protectedWallets,
      metadata,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error(`记录应急状态失败:`, error.message)  // ❌ 删除错误处理
  }
}
```

### 需要删除的文档

- `docs/数据库/worker-tactics-1数据库使用情况分析.md` 中的 emergency_events 表相关内容

---

## 总结

| 问题 | 答案 |
|------|------|
| `logEvent()` 的目的是什么？ | 记录应急状态变化（进入/退出） |
| 是否可以优化为不使用数据库？ | ✅ **强烈推荐** |
| 推荐方案是什么？ | 方案 1: 仅使用 console.log |
| 如需历史记录怎么办？ | 方案 2: 使用 KV 存储 |

---

**结论**: 应急状态变化记录可以**完全移除数据库依赖**，改为使用 console.log 或 KV 存储。
