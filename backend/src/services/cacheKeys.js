/**
 * Cache Key Manager for ShopEase
 * Centralizes cache key patterns and TTL values
 * Ensures consistency across all cache operations
 */

/**
 * Cache TTL (Time To Live) values in seconds
 * Different data types have different expiration strategies
 */
export const CACHE_TTL = {
  // Product data - changes less frequently (30 min)
  PRODUCT_LIST: 1800,
  PRODUCT_DETAIL: 1800,
  PRODUCT_SEARCH: 1800,
  PRODUCT_SUGGESTIONS: 3600, // 1 hour - autocomplete changes rarely
  CATEGORIES: 3600, // 1 hour - categories change rarely
  CATEGORY_PRODUCTS: 1800,

  // User data - moderate changes (15 min)
  USER_PROFILE: 900,
  USER_STATS: 900,
  USER_WISHLIST: 900,

  // Order data - frequently changes (5 min)
  ORDER_LIST: 300,
  ORDER_DETAIL: 300,
  ORDER_STATS: 300,
  USER_ORDERS: 300,

  // Cart data - very frequent changes (1 min)
  CART_ITEMS: 60,
  CART_TOTAL: 60,

  // Search results - user-specific, moderate (10 min)
  SEARCH_RESULTS: 600,

  // Review data - changes occasionally (1 hour)
  PRODUCT_REVIEWS: 3600,
  REVIEW_STATS: 3600,

  // Payment data - critical, short (2 min)
  PAYMENT_STATUS: 120,

  // General short cache (5 min)
  SHORT: 300,
  // General medium cache (30 min)
  MEDIUM: 1800,
  // General long cache (1 hour)
  LONG: 3600
};

/**
 * Generate cache key for products list
 */
export const getCacheKeys = {
  // Products
  productsList: (page = 1, limit = 20, category = null, status = 'active') => {
    const key = `products:list:${category ? `cat:${category}:` : ''}${status}:p${page}:l${limit}`;
    return { key, ttl: CACHE_TTL.PRODUCT_LIST };
  },

  productDetail: (productId) => {
    return { key: `product:${productId}`, ttl: CACHE_TTL.PRODUCT_DETAIL };
  },

  productSearch: (query, page = 1, limit = 20) => {
    const key = `products:search:${query.toLowerCase()}:p${page}:l${limit}`;
    return { key, ttl: CACHE_TTL.PRODUCT_SEARCH };
  },

  productSuggestions: (query) => {
    return { key: `products:suggestions:${query.toLowerCase()}`, ttl: CACHE_TTL.PRODUCT_SUGGESTIONS };
  },

  categories: () => {
    return { key: 'products:categories', ttl: CACHE_TTL.CATEGORIES };
  },

  categoryProducts: (categoryId, page = 1, limit = 20) => {
    return { key: `category:${categoryId}:p${page}:l${limit}`, ttl: CACHE_TTL.CATEGORY_PRODUCTS };
  },

  // Users
  userProfile: (userId) => {
    return { key: `user:${userId}:profile`, ttl: CACHE_TTL.USER_PROFILE };
  },

  userStats: (userId) => {
    return { key: `user:${userId}:stats`, ttl: CACHE_TTL.USER_STATS };
  },

  userWishlist: (userId) => {
    return { key: `user:${userId}:wishlist`, ttl: CACHE_TTL.USER_WISHLIST };
  },

  // Orders
  ordersList: (userId, page = 1, limit = 20, status = null) => {
    const statusKey = status ? `:${status}` : '';
    return { key: `orders:user:${userId}${statusKey}:p${page}:l${limit}`, ttl: CACHE_TTL.ORDER_LIST };
  },

  orderDetail: (orderId) => {
    return { key: `order:${orderId}`, ttl: CACHE_TTL.ORDER_DETAIL };
  },

  orderStats: (userId) => {
    return { key: `user:${userId}:order:stats`, ttl: CACHE_TTL.ORDER_STATS };
  },

  allOrders: (page = 1, limit = 20, status = null) => {
    const statusKey = status ? `:${status}` : '';
    return { key: `orders:all${statusKey}:p${page}:l${limit}`, ttl: CACHE_TTL.ORDER_LIST };
  },

  // Cart
  cartItems: (userId) => {
    return { key: `cart:${userId}:items`, ttl: CACHE_TTL.CART_ITEMS };
  },

  cartTotal: (userId) => {
    return { key: `cart:${userId}:total`, ttl: CACHE_TTL.CART_TOTAL };
  },

  // Search
  searchResults: (query, type = 'all', page = 1, limit = 20) => {
    return { key: `search:${type}:${query}:p${page}:l${limit}`, ttl: CACHE_TTL.SEARCH_RESULTS };
  },

  // Reviews
  productReviews: (productId, page = 1, limit = 20) => {
    return { key: `reviews:product:${productId}:p${page}:l${limit}`, ttl: CACHE_TTL.PRODUCT_REVIEWS };
  },

  reviewStats: (productId) => {
    return { key: `reviews:product:${productId}:stats`, ttl: CACHE_TTL.REVIEW_STATS };
  },

  // Payment
  paymentStatus: (orderId) => {
    return { key: `payment:${orderId}:status`, ttl: CACHE_TTL.PAYMENT_STATUS };
  }
};

/**
 * Pattern-based cache invalidation keys
 * Use with cache.delPattern() to invalidate multiple entries
 */
export const CACHE_INVALIDATION = {
  // Invalidate all product caches when a product changes
  productChanged: (productId) => [
    `product:${productId}*`,
    'products:*',
    'search:*',
    'products:suggestions:*',
    'products:categories*'
  ],

  // Invalidate all category caches when category changes
  categoryChanged: (categoryId) => [
    `category:${categoryId}*`,
    'products:categories*',
    'products:list:*'
  ],

  // Invalidate user caches when user data changes
  userChanged: (userId) => [
    `user:${userId}*`
  ],

  // Invalidate order caches when order changes
  orderChanged: (orderId, userId) => [
    `order:${orderId}*`,
    `user:${userId}:order*`,
    `orders:*`
  ],

  // Invalidate all caches (nuclear option)
  invalidateAll: () => [
    'products:*',
    'product:*',
    'user:*',
    'orders:*',
    'order:*',
    'cart:*',
    'search:*',
    'reviews:*',
    'payment:*',
    'category:*'
  ]
};

/**
 * Helper function to get proper cache configuration
 * @param {string} type - Cache type key
 * @returns {object} - { key: string, ttl: number }
 */
export function getCacheConfig(type, ...params) {
  const fn = getCacheKeys[type];
  if (!fn) {
    throw new Error(`Unknown cache type: ${type}`);
  }
  return fn(...params);
}

/**
 * Helper to generate invalidation patterns for a resource
 * @param {string} type - Resource type
 * @param {...any} params - Parameters for the resource
 * @returns {string[]} - Array of cache key patterns to invalidate
 */
export function getInvalidationPatterns(type, ...params) {
  const fn = CACHE_INVALIDATION[type];
  if (!fn) {
    throw new Error(`Unknown invalidation type: ${type}`);
  }
  return fn(...params);
}

/**
 * Utility to combine multiple cache keys for bulk operations
 */
export function combineInvalidationPatterns(...patterns) {
  return patterns.flat().filter(Boolean);
}

export default {
  CACHE_TTL,
  getCacheKeys,
  CACHE_INVALIDATION,
  getCacheConfig,
  getInvalidationPatterns,
  combineInvalidationPatterns
};
