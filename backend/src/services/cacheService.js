/**
 * Cache Service for ShopEase
 * Provides Redis-based caching with TTL support
 * 
 * Features:
 * - Graceful degradation if Redis unavailable
 * - Pattern-based cache invalidation
 * - Automatic TTL management
 * - Cache statistics tracking
 * - Built-in middleware support
 * 
 * Usage:
 * 1. npm install redis
 * 2. Add REDIS_URL to .env (optional, defaults to localhost:6379)
 * 3. Initialize in server.js: await cache.init()
 * 4. Use in endpoints: app.get('/api/data', withCache('key', 300), handler)
 */

import { createClient } from 'redis';
import logger from '../utils/logger.js';

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.keyPrefix = 'shopease:';
  }

  /**
   * Initialize Redis connection
   * Safe to call even if Redis is not available (graceful degradation)
   */
  async init() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Redis connection failed after 10 retries');
              return new Error('Redis max retries exceeded');
            }
            return Math.min(retries * 50, 500);
          }
        }
      });

      this.client.on('error', (err) => {
        logger.error('Redis client error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('✅ Redis connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('✅ Redis ready for commands');
      });

      await this.client.connect();
      this.isConnected = true;
      logger.info('✅ Cache service initialized');
    } catch (error) {
      logger.warn('⚠️  Redis not available - caching disabled (graceful degradation)', error.message);
      this.isConnected = false;
    }
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} - Cached value or null
   */
  async get(key) {
    if (!this.isConnected) return null;

    try {
      const value = await this.client.get(this.keyPrefix + key);
      if (value) {
        logger.debug(`Cache HIT: ${key}`);
        return JSON.parse(value);
      }
      logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (default: 300 = 5 min)
   */
  async set(key, value, ttl = 300) {
    if (!this.isConnected) return;

    try {
      const fullKey = this.keyPrefix + key;
      await this.client.setEx(fullKey, ttl, JSON.stringify(value));
      logger.debug(`Cache SET: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete cache entry
   * @param {string} key - Cache key to delete
   */
  async del(key) {
    if (!this.isConnected) return;

    try {
      const result = await this.client.del(this.keyPrefix + key);
      logger.debug(`Cache DELETE: ${key} (deleted: ${result})`);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Delete multiple cache entries with pattern matching
   * @param {string} pattern - Key pattern (e.g., 'products:*')
   */
  async delPattern(pattern) {
    if (!this.isConnected) return;

    try {
      const fullPattern = this.keyPrefix + pattern;
      const keys = await this.client.keys(fullPattern);
      
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.debug(`Cache DELETE PATTERN: ${pattern} (deleted: ${keys.length} keys)`);
      }
    } catch (error) {
      logger.error(`Cache delete pattern error for ${pattern}:`, error);
    }
  }

  /**
   * Clear all cache
   */
  async clear() {
    if (!this.isConnected) return;

    try {
      const keys = await this.client.keys(this.keyPrefix + '*');
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.info(`Cache cleared (deleted: ${keys.length} keys)`);
      }
    } catch (error) {
      logger.error('Cache clear error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    if (!this.isConnected) {
      return { status: 'disconnected' };
    }

    try {
      const keys = await this.client.keys(this.keyPrefix + '*');
      const info = await this.client.info();
      
      return {
        status: 'connected',
        keysCount: keys.length,
        memoryUsage: info.used_memory_human,
        hitRate: info.keyspace_hits / (info.keyspace_hits + info.keyspace_misses) || 0
      };
    } catch (error) {
      logger.error('Cache stats error:', error);
      return { status: 'error' };
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis disconnected');
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.isConnected) return false;

    try {
      await this.client.ping();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const cache = new CacheService();

/**
 * Cache Middleware Factory
 * Wraps route handlers to add caching
 * 
 * Usage:
 * app.get('/api/products', withCache('products:all', 300), getProducts);
 */
export function withCache(cacheKey, ttl = 300) {
  return async (req, res, next) => {
    // Skip cache for non-GET requests or with cache bypass header
    if (req.method !== 'GET' || req.headers['cache-control'] === 'no-cache') {
      return next();
    }

    // Generate cache key with query params
    const finalKey = `${cacheKey}:${JSON.stringify(req.query)}`;
    
    // Check cache
    const cached = await cache.get(finalKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json to cache response
    res.json = function(data) {
      cache.set(finalKey, data, ttl);
      res.set('X-Cache', 'MISS');
      return originalJson(data);
    };

    next();
  };
}

/**
 * Middleware to expose cache stats at /cache/stats
 */
export function cacheStatsMiddleware(req, res) {
  if (req.path === '/cache/stats' && process.env.NODE_ENV === 'development') {
    return cache.getStats().then(stats => res.json(stats));
  }
}

export default cache;
