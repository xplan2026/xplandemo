// cloudflare/extensions/database/transaction.js
// 交易记录模块
export class TransactionModule {
  constructor(env, db) {
    this.env = env;
    this.db = db;
  }

  /**
   * 初始化
   */
  async initialize() {
    console.log('[TransactionModule] 初始化...');
    try {
      await this.db.withRetry(async () => {
        const response = await this.db.fetchSupabase('transactions?select=id&limit=1');
        await response.json();
      });
      console.log('[TransactionModule] 初始化完成');
    } catch (error) {
      console.warn('[TransactionModule] 警告: transactions 表可能不存在，请运行初始化 SQL');
    }
  }

  /**
   * 保存交易记录
   */
  async saveTransaction(data) {
    try {
      const workerId = data.worker_id || 'unknown';
      const tableName = 'transactions';

      // 使用延迟写入（worker-1 立即写入）
      await this.db.delayedWrite(workerId, data, async (txData) => {
        await this.db.fetchSupabase(tableName, {
          method: 'POST',
          body: JSON.stringify({
            worker_id: txData.worker_id,
            wallet_address: txData.wallet_address,
            tx_hash: txData.tx_hash,
            token_address: txData.token_address,
            amount: txData.amount,
            status: txData.status,
            error_message: txData.error_message,
            triggered_by: txData.triggered_by,
            trigger_reason: txData.trigger_reason,
            created_at: new Date().toISOString()
          })
        });
      });

      return { success: true };
    } catch (error) {
      console.error('[TransactionModule] 保存交易记录失败:', error);
      throw error;
    }
  }

  /**
   * 更新交易状态
   */
  async updateTransactionStatus(txHash, status, updateData = {}) {
    try {
      // 验证 txHash 格式
      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        throw new Error('无效的交易哈希格式');
      }

      // 验证状态值
      const validStatuses = ['pending', 'success', 'failed', 'submitted'];
      if (!validStatuses.includes(status)) {
        throw new Error(`无效的状态值: ${status}`);
      }

      // 字段白名单
      const allowedFields = ['gasUsed', 'blockNumber', 'transactionIndex', 'logsCount', 'gasUsedRaw'];
      const sanitizedUpdate = {};
      for (const key of Object.keys(updateData)) {
        if (allowedFields.includes(key)) {
          sanitizedUpdate[key] = updateData[key];
        }
      }

      const tableName = 'transactions';

      await this.db.withRetry(async () => {
        const response = await this.db.fetchSupabase(`${tableName}?tx_hash=eq.${txHash}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: status,
            ...sanitizedUpdate,
            updated_at: new Date().toISOString()
          })
        });

        if (!response.ok) {
          throw new Error(`更新失败: ${response.status}`);
        }
      });

      return { success: true };
    } catch (error) {
      console.error('[TransactionModule] 更新交易状态失败:', error);
      throw error;
    }
  }

  /**
   * 获取交易记录
   */
  async getTransactions({ limit = 50, offset = 0, workerId = null, status = null } = {}) {
    try {
      let query = `transactions?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`;

      if (workerId) {
        query += `&worker_id=eq.${workerId}`;
      }

      if (status) {
        query += `&status=eq.${status}`;
      }

      const response = await this.db.withRetry(async () => {
        return await this.db.fetchSupabase(query);
      });

      return await response.json();
    } catch (error) {
      console.error('[TransactionModule] 获取交易失败:', error);
      return [];
    }
  }

  /**
   * 获取失败交易记录
   */
  async getFailedTransactions(walletAddress = null, limit = 10) {
    try {
      let query = `transactions?select=*&order=created_at.desc&limit=${limit}`;
      query += `&status=eq.failed`;

      if (walletAddress) {
        query += `&wallet_address=eq.${walletAddress}`;
      }

      const response = await this.db.withRetry(async () => {
        return await this.db.fetchSupabase(query);
      });

      return await response.json();
    } catch (error) {
      console.error('[TransactionModule] 获取失败交易失败:', error);
      return [];
    }
  }

  /**
   * 获取交易统计
   */
  async getStatistics(workerId = null) {
    try {
      let query = 'transactions?select=worker_id,status,count';
      if (workerId) {
        query += `&worker_id=eq.${workerId}`;
      }

      const response = await this.db.withRetry(async () => {
        return await this.db.fetchSupabase(query);
      });

      const data = await response.json();

      // 统计数据
      const stats = {
        total: 0,
        success: 0,
        failed: 0,
        pending: 0,
        byWorker: {}
      };

      for (const item of data) {
        stats.total++;
        if (item.status === 'success') stats.success++;
        if (item.status === 'failed') stats.failed++;
        if (item.status === 'pending') stats.pending++;

        if (item.worker_id) {
          if (!stats.byWorker[item.worker_id]) {
            stats.byWorker[item.worker_id] = { total: 0, success: 0, failed: 0 };
          }
          stats.byWorker[item.worker_id].total++;
          if (item.status === 'success') stats.byWorker[item.worker_id].success++;
          if (item.status === 'failed') stats.byWorker[item.worker_id].failed++;
        }
      }

      return stats;
    } catch (error) {
      console.error('[TransactionModule] 获取统计失败:', error);
      return null;
    }
  }

  /**
   * 记录错误
   */
  async logError(data) {
    try {
      await this.db.withRetry(async () => {
        await this.db.fetchSupabase('errors', {
          method: 'POST',
          body: JSON.stringify({
            worker_id: data.worker_id || 'unknown',
            error: data.error,
            context: data.context,
            created_at: new Date().toISOString()
          })
        });
      });

      // 检查并清理旧记录
      await this.db.checkAndCleanTable('public', 'errors', 1000);

      return true;
    } catch (error) {
      console.error('[TransactionModule] 记录错误失败:', error);
      return false;
    }
  }

  /**
   * 删除交易记录
   */
  async deleteTransaction(id) {
    try {
      await this.db.withRetry(async () => {
        await this.db.fetchSupabase(`transactions?id=eq.${id}`, {
          method: 'DELETE'
        });
      });

      return true;
    } catch (error) {
      console.error('[TransactionModule] 删除交易失败:', error);
      throw error;
    }
  }

  /**
   * Ping
   */
  async ping() {
    try {
      const response = await this.db.fetchSupabase('transactions?select=id&limit=1');
      await response.json();
      return true;
    } catch (error) {
      return false;
    }
  }
}
