// cloudflare/extensions/database/task.js
// 任务管理模块 - 管理定时扫描任务
export class TaskModule {
  constructor(env, db) {
    this.env = env;
    this.db = db;
  }

  /**
   * 创建任务
   */
  async createTask(taskData) {
    return await this.withRetry(async () => {
      const response = await this.fetchSupabase('scan_tasks', {
        method: 'POST',
        body: JSON.stringify(taskData)
      });

      const result = await response.json();

      // 检查并清理旧记录
      await this.checkAndCleanTable('public', 'scan_tasks', 1000);

      return result;
    });
  }

  /**
   * 获取任务列表
   */
  async getTasks(filters = {}) {
    return await this.withRetry(async () => {
      let query = this.fetchSupabase('scan_tasks');

      // 构建查询参数
      const params = [];
      if (filters.wallet_address) {
        params.push(`wallet_address=eq.${filters.wallet_address.toLowerCase()}`);
      }
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          params.push(`or=(${filters.status.map(s => `status.eq.${s}`).join(',')})`);
        } else {
          params.push(`status=eq.${filters.status}`);
        }
      }
      if (filters.id) {
        params.push(`id=eq.${filters.id}`);
      }
      if (filters.task_end_time) {
        params.push(`task_end_time=gte.${filters.task_end_time}`);
      }

      if (params.length > 0) {
        query = this.fetchSupabase(`scan_tasks?${params.join('&')}&order=created_at.desc`);
      }

      const response = await query;
      const tasks = await response.json();

      return tasks || [];
    });
  }

  /**
   * 更新任务
   */
  async updateTask(taskId, updates) {
    return await this.withRetry(async () => {
      const response = await this.fetchSupabase(`scan_tasks?id=eq.${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });

      const result = await response.json();
      return result;
    });
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId) {
    return await this.withRetry(async () => {
      const response = await this.fetchSupabase(`scan_tasks?id=eq.${taskId}`, {
        method: 'DELETE'
      });

      return await response.json();
    });
  }

  /**
   * Ping（健康检查）
   */
  async ping() {
    try {
      await this.getTasks({ limit: 1 });
      return true;
    } catch (error) {
      throw error;
    }
  }
}
