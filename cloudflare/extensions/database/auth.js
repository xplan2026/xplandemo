// cloudflare/extensions/database/auth.js
// 鉴权模块 - 白名单管理、Nonce 验证
import { recoverAddress, hashMessage } from 'ethers';

export class AuthModule {
  constructor(env, db) {
    this.env = env;
    this.db = db;
  }

  /**
   * 初始化
   */
  async initialize() {
    console.log('[AuthModule] 初始化...');
    // 验证表结构
    try {
      await this.db.withRetry(async () => {
        const response = await this.db.fetchSupabase('whitelist?select=id&limit=1');
        await response.json();
      });
      console.log('[AuthModule] 初始化完成');
    } catch (error) {
      console.warn('[AuthModule] 警告: whitelist 表可能不存在，请运行初始化 SQL');
    }
  }

  /**
   * 检查白名单
   */
  async checkWhitelist(address) {
    try {
      // 先从缓存获取
      const cached = await this.db.getFromCache(`whitelist:${address}`, 300); // 5分钟
      if (cached !== null) {
        return cached;
      }

      // 从数据库查询
      const response = await this.db.withRetry(async () => {
        return await this.db.fetchSupabase(
          `whitelist?wallet_address=eq.${address}&select=*`
        );
      });

      const data = await response.json();
      const isWhitelisted = data && data.length > 0;

      // 更新缓存
      await this.db.setCache(`whitelist:${address}`, isWhitelisted, 300);

      return isWhitelisted;
    } catch (error) {
      console.error('[AuthModule] 检查白名单失败:', error);
      return false;
    }
  }

  /**
   * 生成 Nonce
   */
  async generateNonce(address) {
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    try {
      await this.db.withRetry(async () => {
        await this.db.fetchSupabase('auth_nonce', {
          method: 'POST',
          body: JSON.stringify({
            wallet_address: address.toLowerCase(),
            nonce,
            expires_at: expiresAt
          })
        });
      });

      return nonce;
    } catch (error) {
      console.error('[AuthModule] 生成Nonce失败:', error);
      throw new Error('生成Nonce失败');
    }
  }

  /**
   * 验证 Nonce
   */
  async verifyNonce(address, nonce) {
    try {
      const response = await this.db.withRetry(async () => {
        return await this.db.fetchSupabase(
          `auth_nonce?wallet_address=eq.${address}&nonce=eq.${nonce}&select=*&limit=1`
        );
      });

      const data = await response.json();

      if (!data || data.length === 0) {
        return false;
      }

      // 检查是否过期
      const expiresAt = new Date(data[0].expires_at);
      if (expiresAt < new Date()) {
        return false;
      }

      // 删除已使用的 nonce
      await this.db.withRetry(async () => {
        await this.db.fetchSupabase(`auth_nonce?id=eq.${data[0].id}`, {
          method: 'DELETE'
        });
      });

      return true;
    } catch (error) {
      console.error('[AuthModule] 验证Nonce失败:', error);
      return false;
    }
  }

  /**
   * 验证签名
   */
  async verifySignature(address, nonce, signature) {
    try {
      // 验证 nonce
      const isValidNonce = await this.verifyNonce(address, nonce);
      if (!isValidNonce) {
        return false;
      }

      // 恢复签名地址
      const message = nonce;
      const recoveredAddress = recoverAddress(hashMessage(message), signature);

      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
      console.error('[AuthModule] 验证签名失败:', error);
      return false;
    }
  }

  /**
   * 添加白名单
   */
  async addToWhitelist(address, addedBy = 'system') {
    try {
      await this.db.withRetry(async () => {
        await this.db.fetchSupabase('whitelist', {
          method: 'POST',
          body: JSON.stringify({
            wallet_address: address.toLowerCase(),
            status: 'active',
            added_by: addedBy,
            created_at: new Date().toISOString()
          })
        });
      });

      // 清除缓存
      await this.db.clearCache(`whitelist:${address}`);

      return true;
    } catch (error) {
      console.error('[AuthModule] 添加白名单失败:', error);
      throw error;
    }
  }

  /**
   * 删除白名单
   */
  async removeFromWhitelist(address) {
    try {
      await this.db.withRetry(async () => {
        await this.db.fetchSupabase(
          `whitelist?wallet_address=eq.${address}`,
          { method: 'DELETE' }
        );
      });

      // 清除缓存
      await this.db.clearCache(`whitelist:${address}`);

      return true;
    } catch (error) {
      console.error('[AuthModule] 删除白名单失败:', error);
      throw error;
    }
  }

  /**
   * 获取白名单列表
   */
  async getWhitelist() {
    try {
      const response = await this.db.withRetry(async () => {
        return await this.db.fetchSupabase('whitelist?select=*&order=created_at.desc');
      });

      return await response.json();
    } catch (error) {
      console.error('[AuthModule] 获取白名单失败:', error);
      return [];
    }
  }

  /**
   * Ping
   */
  async ping() {
    try {
      const response = await this.db.fetchSupabase('whitelist?select=id&limit=1');
      await response.json();
      return true;
    } catch (error) {
      return false;
    }
  }
}
