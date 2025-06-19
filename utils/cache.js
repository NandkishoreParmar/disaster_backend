import { supabase } from '../config/supabase.js';
import { logger } from './logger.js';

class CacheService {
  async get(key) {
    try {
      const { data, error } = await supabase
        .from('cache')
        .select('value, expires_at')
        .eq('key', key)
        .single();

      if (error) {
        logger.warn(`Cache miss for key: ${key}`);
        return null;
      }

      if (new Date(data.expires_at) < new Date()) {
        await this.delete(key);
        logger.info(`Cache expired for key: ${key}`);
        return null;
      }

      logger.info(`Cache hit for key: ${key}`);
      return data.value;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key, value, ttlMinutes = 60) {
    try {
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
      
      const { error } = await supabase
        .from('cache')
        .upsert({
          key,
          value,
          expires_at: expiresAt.toISOString()
        });

      if (error) {
        logger.error(`Cache set error for key ${key}:`, error);
        return false;
      }

      logger.info(`Cache set for key: ${key}`);
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async delete(key) {
    try {
      const { error } = await supabase
        .from('cache')
        .delete()
        .eq('key', key);

      if (error) {
        logger.error(`Cache delete error for key ${key}:`, error);
        return false;
      }

      logger.info(`Cache deleted for key: ${key}`);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async clear() {
    try {
      const { error } = await supabase
        .from('cache')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) {
        logger.error('Cache clear error:', error);
        return false;
      }

      logger.info('Cache cleared successfully');
      return true;
    } catch (error) {
      logger.error('Cache clear error:', error);
      return false;
    }
  }
}

export const cache = new CacheService();