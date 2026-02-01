/**
 * Example: Products Route with Caching
 * Shows how to integrate cache service into existing routes
 * 
 * Apply this pattern to other routes for consistent caching
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { cache } from '../services/cacheService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/products
 * List all active products with caching
 * 
 * Cache: 5 minutes (300 seconds)
 * Pattern: products:list:[filters]
 */
router.get('/products', async (req, res) => {
  try {
    const { category, status = 'active', page = 1, limit = 20, search } = req.query;
    const skip = (page - 1) * limit;

    // Generate cache key based on filters
    const cacheKey = `products:list:${JSON.stringify({ category, status, page, limit, search })}`;

    // Try cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.info(`✅ Cache HIT for ${cacheKey}`);
      return res.json({
        ...cached,
        _cache: 'HIT'
      });
    }

    logger.info(`📥 Cache MISS for ${cacheKey}`);

    // Build where clause
    const where = {
      status,
      ...(category && { category }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { description: { contains: search } }
        ]
      })
    };

    // ✅ Optimized: Use include with select
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: {
          seller: {
            select: {
              id: true,
              name: true,
              avatar: true,
              rating: true,
              totalReviews: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.product.count({ where })
    ]);

    const response = {
      data: products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit)
      },
      _cache: 'MISS'
    };

    // Cache for 5 minutes
    await cache.set(cacheKey, response, 300);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

/**
 * GET /api/products/:id
 * Get single product with caching
 * 
 * Cache: 10 minutes (600 seconds)
 * Pattern: product:[id]
 */
router.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `product:${id}`;

    // Try cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({
        ...cached,
        _cache: 'HIT'
      });
    }

    // ✅ Optimized: Include related data
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            avatar: true,
            rating: true,
            totalReviews: true
          }
        },
        reviews: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            reviewer: {
              select: { id: true, name: true, avatar: true }
            }
          }
        }
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Cache for 10 minutes
    await cache.set(cacheKey, product, 600);

    res.json(product);
  } catch (error) {
    logger.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

/**
 * POST /api/products
 * Create product (invalidates cache)
 */
router.post('/products', async (req, res) => {
  try {
    const { name, price, description, category, sellerId } = req.body;

    const product = await prisma.product.create({
      data: {
        name,
        price,
        description,
        category,
        sellerId
      }
    });

    // Invalidate related caches
    await cache.delPattern('products:list:*'); // Clear all product lists
    
    logger.info('✅ Created product:', product.id);
    res.status(201).json(product);
  } catch (error) {
    logger.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

/**
 * PUT /api/products/:id
 * Update product (invalidates cache)
 */
router.put('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const product = await prisma.product.update({
      where: { id },
      data: updates
    });

    // Invalidate caches
    await cache.del(`product:${id}`); // Clear specific product
    await cache.delPattern('products:list:*'); // Clear all lists

    logger.info('✅ Updated product:', id);
    res.json(product);
  } catch (error) {
    logger.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

/**
 * DELETE /api/products/:id
 * Delete product (invalidates cache)
 */
router.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.product.delete({
      where: { id }
    });

    // Invalidate caches
    await cache.del(`product:${id}`);
    await cache.delPattern('products:list:*');

    logger.info('✅ Deleted product:', id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

/**
 * GET /api/categories
 * List categories with caching
 * 
 * Cache: 1 hour (3600 seconds) - categories rarely change
 * Pattern: categories:all
 */
router.get('/categories', async (req, res) => {
  try {
    const cacheKey = 'categories:all';

    // Try cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({
        data: cached,
        _cache: 'HIT'
      });
    }

    // ✅ Optimized: Use _count for product counts
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { products: true }
        }
      }
    });

    // Cache for 1 hour
    await cache.set(cacheKey, categories, 3600);

    res.json({
      data: categories,
      _cache: 'MISS'
    });
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * Cache Statistics Endpoint (Development Only)
 * GET /api/cache/stats
 */
router.get('/cache/stats', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  const stats = await cache.getStats();
  res.json(stats);
});

/**
 * Cache Control Endpoint (Development Only)
 * DELETE /api/cache/clear
 */
router.delete('/cache/clear', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  await cache.clear();
  res.json({ success: true, message: 'Cache cleared' });
});

export default router;

/**
 * INTEGRATION INSTRUCTIONS:
 * 
 * 1. Add to server.js:
 *    import { cache } from './src/services/cacheService.js';
 *    
 *    // After creating app
 *    await cache.init();
 * 
 * 2. Import this router in server.js:
 *    import productRoutes from './src/routes/products-cached.js';
 *    app.use('/api', productRoutes);
 * 
 * 3. Or apply caching to existing routes by adding:
 *    - Cache key generation
 *    - cache.get() before database query
 *    - cache.set() after getting response
 *    - cache.del() in update/delete endpoints
 * 
 * CACHING PATTERNS:
 * 
 * - Read-heavy endpoints: Cache with 5-10 minute TTL
 * - Rarely updated data: Cache with 1+ hour TTL
 * - List endpoints: Include filters in cache key
 * - Detail endpoints: Use entity ID in cache key
 * - Update/delete: Invalidate related caches
 * 
 * EXPECTED IMPROVEMENTS:
 * 
 * Without cache: 20-50ms average response
 * With cache: 2-5ms average response (4-10x improvement)
 * 
 * Cache hit rate target: > 70% on production
 */
