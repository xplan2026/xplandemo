// cloudflare/extensions/database/system.js
// 系统配置模块 - RPC节点、被保护/盗币者钱包、合约地址管理
export class SystemModule {
  constructor(env, db) {
    this.env = env;
    this.db = db;
  }

  /**
   * 初始化
   */
  async initialize() {
    console.log('[SystemModule] 初始化...');
    try {
      // 验证表结构
      const tables = ['rpc_nodes', 'protected_wallets', 'hacker_wallets', 'contracts'];
      for (const table of tables) {
        try {
          await this.db.withRetry(async () => {
            const response = await this.db.fetchSupabase(`${table}?select=id&limit=1`);
            await response.json();
          });
        } catch (e) {
          console.warn(`[SystemModule] 警告: ${table} 表可能不存在`);
        }
      }
      console.log('[SystemModule] 初始化完成');
    } catch (error) {
      console.warn('[SystemModule] 初始化检查失败:', error.message);
    }
  }

  // ==================== RPC 节点管理 ====================

  /**
   * 获取 RPC 节点列表
   */
  async getRpcNodes() {
    try {
      // 先从缓存获取
      const cached = await this.db.getFromCache('rpc_nodes', 600); // 10分钟
      if (cached) {
        return cached;
      }

      const response = await this.db.withRetry(async () => {
        return await this.db.fetchSupabase('rpc_nodes?select=*&status=eq.active');
      });

      const nodes = await response.json();

      // 更新缓存
      await this.db.setCache('rpc_nodes', nodes, 600);

      return nodes;
    } catch (error) {
      console.error('[SystemModule] 获取RPC节点失败:', error);
      return [];
    }
  }

  /**
   * 添加 RPC 节点
   */
  async addRpcNode(data) {
    try {
      await this.db.withRetry(async () => {
        await this.db.fetchSupabase('rpc_nodes', {
          method: 'POST',
          body: JSON.stringify({
            name: data.name,
            url: data.url,
            status: 'active',
            added_by: data.added_by || 'system',
            created_at: new Date().toISOString()
          })
        });
      });

      // 清除缓存
      await this.db.clearCache('rpc_nodes');

      return true;
    } catch (error) {
      console.error('[SystemModule] 添加RPC节点失败:', error);
      throw error;
    }
  }

  /**
   * 删除 RPC 节点
   */
  async deleteRpcNode(id) {
    try {
      await this.db.withRetry(async () => {
        await this.db.fetchSupabase(`rpc_nodes?id=eq.${id}`, {
          method: 'DELETE'
        });
      });

      // 清除缓存
      await this.db.clearCache('rpc_nodes');

      return true;
    } catch (error) {
      console.error('[SystemModule] 删除RPC节点失败:', error);
      throw error;
    }
  }

  // ==================== 被保护钱包管理 ====================

  /**
   * 获取被保护钱包列表
   */
  async getProtectedWallets() {
    try {
      const response = await this.db.withRetry(async () => {
        return await this.db.fetchSupabase('protected_wallets?select=*&order=created_at.desc');
      });

      return await response.json();
    } catch (error) {
      console.error('[SystemModule] 获取被保护钱包失败:', error);
      return [];
    }
  }

  /**
   * 添加被保护钱包
   */
  async addProtectedWallet(data) {
    try {
      // 检查数量限制（上限3个）
      const current = await this.getProtectedWallets();
      if (current.length >= 3) {
        throw new Error('被保护钱包数量已达上限（3个）');
      }

      await this.db.withRetry(async () => {
        await this.db.fetchSupabase('protected_wallets', {
          method: 'POST',
          body: JSON.stringify({
            wallet_address: data.wallet_address.toLowerCase(),
            safe_wallet_address: data.safe_wallet_address.toLowerCase(),
            status: 'active',
            added_by: data.added_by || 'system',
            created_at: new Date().toISOString()
          })
        });
      });

      return true;
    } catch (error) {
      console.error('[SystemModule] 添加被保护钱包失败:', error);
      throw error;
    }
  }

  /**
   * 删除被保护钱包
   */
  async deleteProtectedWallet(id) {
    try {
      await this.db.withRetry(async () => {
        await this.db.fetchSupabase(`protected_wallets?id=eq.${id}`, {
          method: 'DELETE'
        });
      });

      return true;
    } catch (error) {
      console.error('[SystemModule] 删除被保护钱包失败:', error);
      throw error;
    }
  }

  // ==================== 盗币者钱包管理 ====================

  /**
   * 获取盗币者钱包列表
   */
  async getHackerWallets() {
    try {
      const response = await this.db.withRetry(async () => {
        return await this.db.fetchSupabase('hacker_wallets?select=*&order=created_at.desc');
      });

      return await response.json();
    } catch (error) {
      console.error('[SystemModule] 获取盗币者钱包失败:', error);
      return [];
    }
  }

  /**
   * 添加盗币者钱包
   */
  async addHackerWallet(data) {
    try {
      // 检查数量限制（上限10个）
      const current = await this.getHackerWallets();
      if (current.length >= 10) {
        throw new Error('盗币者钱包数量已达上限（10个）');
      }

      await this.db.withRetry(async () => {
        await this.db.fetchSupabase('hacker_wallets', {
          method: 'POST',
          body: JSON.stringify({
            wallet_address: data.wallet_address.toLowerCase(),
            description: data.description || '',
            status: 'active',
            added_by: data.added_by || 'system',
            created_at: new Date().toISOString()
          })
        });
      });

      return true;
    } catch (error) {
      console.error('[SystemModule] 添加盗币者钱包失败:', error);
      throw error;
    }
  }

  /**
   * 删除盗币者钱包
   */
  async deleteHackerWallet(id) {
    try {
      await this.db.withRetry(async () => {
        await this.db.fetchSupabase(`hacker_wallets?id=eq.${id}`, {
          method: 'DELETE'
        });
      });

      return true;
    } catch (error) {
      console.error('[SystemModule] 删除盗币者钱包失败:', error);
      throw error;
    }
  }

  // ==================== 合约地址管理 ====================

  /**
   * 获取合约地址列表
   */
  async getContracts() {
    try {
      const response = await this.db.withRetry(async () => {
        return await this.db.fetchSupabase('contracts?select=*&order=created_at.desc');
      });

      return await response.json();
    } catch (error) {
      console.error('[SystemModule] 获取合约地址失败:', error);
      return [];
    }
  }

  /**
   * 添加合约地址
   */
  async addContract(data) {
    try {
      // 检查数量限制（上限5个）
      const current = await this.getContracts();
      if (current.length >= 5) {
        throw new Error('合约地址数量已达上限（5个）');
      }

      await this.db.withRetry(async () => {
        await this.db.fetchSupabase('contracts', {
          method: 'POST',
          body: JSON.stringify({
            contract_address: data.contract_address.toLowerCase(),
            token_name: data.token_name,
            token_symbol: data.token_symbol,
            decimals: data.decimals,
            status: 'active',
            added_by: data.added_by || 'system',
            created_at: new Date().toISOString()
          })
        });
      });

      return true;
    } catch (error) {
      console.error('[SystemModule] 添加合约地址失败:', error);
      throw error;
    }
  }

  /**
   * 删除合约地址
   */
  async deleteContract(id) {
    try {
      await this.db.withRetry(async () => {
        await this.db.fetchSupabase(`contracts?id=eq.${id}`, {
          method: 'DELETE'
        });
      });

      return true;
    } catch (error) {
      console.error('[SystemModule] 删除合约地址失败:', error);
      throw error;
    }
  }

  /**
   * Ping
   */
  async ping() {
    try {
      const response = await this.db.fetchSupabase('rpc_nodes?select=id&limit=1');
      await response.json();
      return true;
    } catch (error) {
      return false;
    }
  }
}
