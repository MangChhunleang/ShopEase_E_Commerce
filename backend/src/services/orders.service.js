/**
 * Orders Service - Optimized Queries
 * 
 * Uses raw SQL but with optimized patterns:
 * - Single query for order list with filtering
 * - Batch loading for related data where needed
 * - Proper pagination
 * - Efficient filtering
 */

import { query } from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * Get orders with optional filtering
 * ✅ OPTIMIZED: Single query with proper indexes
 * 
 * @param {Object} options - Filter options
 * @param {number} options.userId - Filter by user (for regular users or admin filter)
 * @param {string} options.status - Filter by status
 * @param {string} options.startDate - Filter by start date
 * @param {string} options.endDate - Filter by end date
 * @param {string} options.search - Search by order number/customer name/phone
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @param {boolean} options.isAdmin - Is admin (affects filtering)
 * @returns {Promise<{data: Array, pagination: Object}>}
 */
export async function getOrdersList(options = {}) {
  const {
    userId = null,
    status = null,
    startDate = null,
    endDate = null,
    search = null,
    page = 1,
    limit = 20,
    isAdmin = false
  } = options;

  const skip = (page - 1) * limit;
  let whereConditions = [];
  let queryParams = [];

  try {
    // Permission check
    if (!isAdmin && userId) {
      whereConditions.push('userId = ?');
      queryParams.push(userId);
    } else if (isAdmin && userId) {
      whereConditions.push('userId = ?');
      queryParams.push(userId);
    }

    // Filter by status
    if (status && ['pending', 'processing', 'delivered', 'cancelled'].includes(status)) {
      whereConditions.push('status = ?');
      queryParams.push(status);
    }

    // Filter by date range
    if (startDate) {
      whereConditions.push('orderDate >= ?');
      queryParams.push(startDate);
    }
    if (endDate) {
      whereConditions.push('orderDate <= ?');
      queryParams.push(endDate);
    }

    // Search
    if (search) {
      whereConditions.push('(orderNumber LIKE ? OR customerName LIKE ? OR customerPhone LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    // Build WHERE clause
    let whereClause = '';
    if (whereConditions.length > 0) {
      whereClause = ' WHERE ' + whereConditions.join(' AND ');
    }

    // Get total count (separate query for accurate pagination)
    const countResult = await query(
      `SELECT COUNT(*) as count FROM \`Order\`${whereClause}`,
      queryParams
    );
    const total = countResult[0]?.count || 0;

    // Get paginated orders
    // ✅ OPTIMIZED: Uses indexes on userId, status, orderDate
    const orders = await query(
      `SELECT * FROM \`Order\`${whereClause}
       ORDER BY orderDate DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, skip]
    );

    logger.debug('Orders fetched', {
      count: orders.length,
      total,
      page,
      limit,
      filters: { userId, status, search }
    });

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error fetching orders', {
      error: error.message,
      filters: { userId, status, startDate, endDate, search }
    });
    throw error;
  }
}

/**
 * Get order details by ID
 * ✅ OPTIMIZED: Single query for order
 * 
 * @param {number} orderId - Order ID
 * @param {number} userId - User ID (for permission check)
 * @param {boolean} isAdmin - Is admin
 * @returns {Promise<Object>}
 */
export async function getOrderById(orderId, userId = null, isAdmin = false) {
  try {
    let sql = 'SELECT * FROM `Order` WHERE id = ?';
    let params = [orderId];

    // Permission check
    if (!isAdmin && userId) {
      sql += ' AND userId = ?';
      params.push(userId);
    }

    const orders = await query(sql, params);
    if (orders.length === 0) {
      throw new Error('Order not found or access denied');
    }

    const order = orders[0];

    // Get order items
    const items = await query(
      'SELECT * FROM OrderItem WHERE orderId = ?',
      [orderId]
    );

    order.items = items;

    logger.debug('Order fetched', {
      orderId,
      itemsCount: items.length
    });

    return order;
  } catch (error) {
    logger.error('Error fetching order', {
      error: error.message,
      orderId
    });
    throw error;
  }
}

/**
 * Search orders with advanced filters
 * ✅ OPTIMIZED: Efficient SQL with proper conditions
 * 
 * @param {Object} filters - Search filters
 * @param {string} filters.search - Search query
 * @param {string} filters.status - Status filter
 * @param {number} filters.minAmount - Minimum order amount
 * @param {number} filters.maxAmount - Maximum order amount
 * @param {number} filters.page - Page number
 * @param {number} filters.limit - Items per page
 * @returns {Promise<{data: Array, pagination: Object}>}
 */
export async function searchOrders(filters = {}) {
  const {
    search = '',
    status = null,
    minAmount = null,
    maxAmount = null,
    page = 1,
    limit = 20
  } = filters;

  const skip = (page - 1) * limit;
  let whereConditions = [];
  let queryParams = [];

  try {
    // Search
    if (search) {
      whereConditions.push(
        '(orderNumber LIKE ? OR customerName LIKE ? OR customerEmail LIKE ? OR customerPhone LIKE ?)'
      );
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Status filter
    if (status && ['pending', 'processing', 'delivered', 'cancelled'].includes(status)) {
      whereConditions.push('status = ?');
      queryParams.push(status);
    }

    // Amount filters
    if (minAmount !== null) {
      whereConditions.push('totalAmount >= ?');
      queryParams.push(minAmount);
    }
    if (maxAmount !== null) {
      whereConditions.push('totalAmount <= ?');
      queryParams.push(maxAmount);
    }

    // Build WHERE clause
    let whereClause = '';
    if (whereConditions.length > 0) {
      whereClause = ' WHERE ' + whereConditions.join(' AND ');
    }

    // Get total
    const countResult = await query(
      `SELECT COUNT(*) as count FROM \`Order\`${whereClause}`,
      queryParams
    );
    const total = countResult[0]?.count || 0;

    // Get results
    const orders = await query(
      `SELECT * FROM \`Order\`${whereClause}
       ORDER BY orderDate DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, skip]
    );

    logger.debug('Orders searched', {
      resultsCount: orders.length,
      total,
      filters: { search, status, minAmount, maxAmount }
    });

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error searching orders', {
      error: error.message,
      filters
    });
    throw error;
  }
}

/**
 * Get user's orders (for user profile)
 * ✅ OPTIMIZED: Single query with pagination
 * 
 * @param {number} userId - User ID
 * @param {number} limit - Limit results
 * @param {number} page - Page number
 * @returns {Promise<{data: Array, pagination: Object}>}
 */
export async function getUserOrders(userId, limit = 10, page = 1) {
  const skip = (page - 1) * limit;

  try {
    // Get total
    const countResult = await query(
      'SELECT COUNT(*) as count FROM `Order` WHERE userId = ?',
      [userId]
    );
    const total = countResult[0]?.count || 0;

    // Get user orders
    const orders = await query(
      `SELECT * FROM \`Order\`
       WHERE userId = ?
       ORDER BY orderDate DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, skip]
    );

    logger.debug('User orders fetched', {
      userId,
      count: orders.length,
      total
    });

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error fetching user orders', {
      error: error.message,
      userId
    });
    throw error;
  }
}

/**
 * Get order statistics
 * @param {number} userId - User ID (optional, for user's orders only)
 * @returns {Promise<Object>}
 */
export async function getOrderStats(userId = null) {
  try {
    let whereClause = userId ? ' WHERE userId = ?' : '';
    let params = userId ? [userId] : [];

    const stats = await query(
      `SELECT 
        COUNT(*) as totalOrders,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as completedOrders,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingOrders,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processingOrders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelledOrders,
        SUM(totalAmount) as totalSpent,
        AVG(totalAmount) as averageOrderValue
       FROM \`Order\`${whereClause}`,
      params
    );

    return stats[0] || {};
  } catch (error) {
    logger.error('Error fetching order stats', {
      error: error.message,
      userId
    });
    throw error;
  }
}

export default {
  getOrdersList,
  getOrderById,
  searchOrders,
  getUserOrders,
  getOrderStats
};
