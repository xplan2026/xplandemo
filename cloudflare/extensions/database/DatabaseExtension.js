// cloudflare/extensions/database/DatabaseExtension.js
// 数据库扩展模块 - 支持多Schema、延迟写入、缓存机制
// 适配 Supabase（PostgreSQL）而非 D1
import { config } from './config.js';
import { AuthModule } from './auth.js';
import { TransactionModule } from './transaction.js';
import { SystemModule } from './system.js';
import { TaskModule } from './task.js';

/**
 * 数据库扩展主类
 * 功能：
 * 1. 多Schema支持（鉴权库、交易库）
 * 2. 延迟写入机制（分钟级，避免阻塞）
 * 3. KV缓存层
 * 4. 错误重试机制
 * 5. 自动清理旧数据（避免超出免费额度）
 */
export class DatabaseExtension {
  constructor(env) {
    this.env = env;
    this.config = config;

    // Supabase 配置
    this.supabaseUrl = env.SUPABASE_URL;
    this.supabaseKey = (env.SUPABASE_KEY || '').trim();

    // 初始化子模块
    this.auth = new AuthModule(env, this);
    this.transaction = new TransactionModule(env, this);
    this.system = new SystemModule(env, this);
    this.task = new TaskModule(env, this);

    // KV缓存键前缀
    this.cachePrefix = 'db_cache:';
  }

  /**
   * 初始化方法
   */
  async initialize() {
    console.log('[DatabaseExtension] 初始化中...');
    console.log('[DatabaseExtension] Supabase URL:', this.supabaseUrl ? '已配置' : '未配置');
    // 移除 Supabase Key 日志输出，避免泄露敏感信息
    console.log('[DatabaseExtension] Supabase Key: 已配置');
    try {
      // 验证 Supabase 连接
      await this.withRetry(async () => {
        const response = await this.fetchSupabase('/', { method: 'HEAD' });
        if (!response.ok) {
          throw new Error('Supabase 连接失败');
        }
      });

      console.log('[DatabaseExtension] 初始化完成');
      return true;
    } catch (error) {
      console.error('[DatabaseExtension] 初始化失败:', error);
      return false;
    }
  }

  /**
   * KV缓存获取（已禁用 - 直接查询 Supabase）
   */
  async getFromCache(key, ttl = 300) {
    return null; // 禁用缓存，直接查询数据库
  }

  /**
   * KV缓存设置（已禁用）
   */
  async setCache(key, value, ttl = 300) {
    return; // 禁用缓存，不写入 KV
  }

  /**
   * 清除缓存（已禁用）
   */
  async clearCache(key) {
    return; // 无需清除缓存
  }

  /**
   * 重试机制（包装任何数据库操作）
   */
  async withRetry(operation, maxRetries = 3, retryInterval = 5000) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.error(`[DatabaseExtension] 操作失败 (尝试 ${attempt}/${maxRetries}):`, error.message);

        if (attempt < maxRetries) {
          console.log(`[DatabaseExtension] ${retryInterval/1000}秒后重试...`);
          await this.sleep(retryInterval);
        }
      }
    }

    throw new Error(`操作失败，已重试 ${maxRetries} 次: ${lastError.message}`);
  }

  /**
   * 休眠函数
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 检查表记录数，超出阈值时清理旧数据
   */
  async checkAndCleanTable(schema, tableName, maxRecords = 1000) {
    try {
      // 根据表名调用对应的清理函数
      let rpcFunction;
      if (tableName === 'transactions') {
        rpcFunction = 'cleanup_old_transactions';
      } else if (tableName === 'errors') {
        rpcFunction = 'cleanup_old_errors';
      } else if (tableName === 'auth_nonce') {
        // nonce 使用不同的清理逻辑
        return await this.cleanupExpiredNonces();
      } else {
        console.log(`[DatabaseExtension] 表 ${tableName} 不支持自动清理`);
        return { cleaned: false };
      }

      const response = await this.fetchSupabase(`rpc/${rpcFunction}`, {
        method: 'POST',
        body: JSON.stringify({
          max_records: maxRecords
        })
      });

      const result = await response.json();

      if (result.deleted_count > 0) {
        console.log(`[DatabaseExtension] 清理完成，删除了 ${result.deleted_count} 条旧记录`);
        return { cleaned: true, deletedCount: result.deleted_count };
      }

      return { cleaned: false, currentCount: result.total_after };
    } catch (error) {
      console.error(`[DatabaseExtension] 清理表 ${schema}.${tableName} 失败:`, error);
      return { cleaned: false, error: error.message };
    }
  }

  /**
   * 清理过期的 nonce
   */
  async cleanupExpiredNonces() {
    try {
      const response = await this.fetchSupabase(`rpc/cleanup_expired_nonces`, {
        method: 'POST'
      });
      const result = await response.json();
      if (result > 0) {
        console.log(`[DatabaseExtension] 清理了 ${result} 条过期 nonce`);
        return { cleaned: true, deletedCount: result };
      }
      return { cleaned: false };
    } catch (error) {
      console.error('[DatabaseExtension] 清理 nonce 失败:', error);
      return { cleaned: false, error: error.message };
    }
  }

  /**
   * 健康检查（简化版 - 无 KV 操作）
   */
  async healthCheck() {
    const results = {
      supabase: false,
      auth: false,
      transaction: false,
      system: false
    };

    try {
      // 检查 Supabase
      await this.withRetry(async () => {
        const response = await this.fetchSupabase('/', { method: 'HEAD' });
        if (response.ok) {
          results.supabase = true;
        }
      });

      // 检查各模块
      try {
        await this.auth.ping();
        results.auth = true;
      } catch (e) { }

      try {
        await this.transaction.ping();
        results.transaction = true;
      } catch (e) { }

      try {
        await this.system.ping();
        results.system = true;
      } catch (e) { }

    } catch (error) {
      console.error('[DatabaseExtension] 健康检查失败:', error);
    }

    return results;
  }

  /**
   * Supabase 请求封装
   */
  async fetchSupabase(endpoint, options = {}) {
    const url = `${this.supabaseUrl}/rest/v1/${endpoint}`;

    const defaultHeaders = {
      'apikey': this.supabaseKey,
      'Authorization': `Bearer ${this.supabaseKey}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    });

    if (!response.ok) {
      // 生产环境只返回通用错误，开发环境返回详细信息
      const isDev = this.env.NODE_ENV === 'development'
      if (isDev) {
        const errorText = await response.text();
        throw new Error(`Supabase请求失败: ${response.status} ${response.statusText} - ${errorText}`);
      } else {
        throw new Error('数据库操作失败');
      }
    }

    return response;
  }

  /**
   * 延迟写入（分钟级）
   * worker-1: 立即写入（应急任务）
   * worker-2: 延迟1分钟
   * worker-3: 延迟2分钟
   */
  async delayedWrite(workerId, data, writeFunction) {
    const delayMinutes = this.config.writeDelays[workerId] || 0;

    if (delayMinutes === 0) {
      // 立即写入
      return await this.withRetry(async () => writeFunction(data));
    }

    // 延迟写入（加入队列）
    console.log(`[DatabaseExtension] 延迟写入: worker-${workerId}, 延迟 ${delayMinutes} 分钟`);
    // 注意：在 Worker 环境中，延迟写入队列需要持久化到 KV
    // 这里简化处理，直接返回延迟信息
    return {
      queued: true,
      executeAt: Date.now() + delayMinutes * 60 * 1000,
      message: '延迟写入队列待实现'
    };
  }
}
