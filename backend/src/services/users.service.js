/**
 * Users Service - Optimized Queries
 * 
 * Provides optimized queries for user-related endpoints:
 * - User profile with related data
 * - User orders
 * - User statistics
 */

import { query } from '../config/database.js';
import logger from '../utils/logger.js';
import ordersService from './orders.service.js';

/**
 * Get user profile with related data
 * ✅ OPTIMIZED: Efficient queries with proper structuring
 * 
 * @param {number} userId - User ID
 * @returns {Promise<Object>}
 */
export async function getUserProfile(userId) {
  try {
    // Get user basic info
    const users = await query(
      'SELECT id, email, role, createdAt, updatedAt FROM User WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];

    // Get user stats (orders, etc) in parallel
    const [stats, recentOrders] = await Promise.all([
      ordersService.getOrderStats(userId),
      ordersService.getUserOrders(userId, 5, 1)
    ]);

    user.stats = {
      totalOrders: stats.totalOrders || 0,
      completedOrders: stats.completedOrders || 0,
      pendingOrders: stats.pendingOrders || 0,
      totalSpent: stats.totalSpent || 0,
      averageOrderValue: stats.averageOrderValue || 0
    };

    user.recentOrders = recentOrders.data || [];

    logger.debug('User profile fetched', {
      userId,
      totalOrders: stats.totalOrders
    });

    return user;
  } catch (error) {
    logger.error('Error fetching user profile', {
      error: error.message,
      userId
    });
    throw error;
  }
}

/**
 * Get user by email
 * ✅ OPTIMIZED: Direct lookup with index
 * 
 * @param {string} email - User email
 * @returns {Promise<Object>}
 */
export async function getUserByEmail(email) {
  try {
    const users = await query(
      'SELECT * FROM User WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return null;
    }

    return users[0];
  } catch (error) {
    logger.error('Error fetching user by email', {
      error: error.message,
      email
    });
    throw error;
  }
}

/**
 * Get user by ID
 * @param {number} userId - User ID
 * @returns {Promise<Object>}
 */
export async function getUserById(userId) {
  try {
    const users = await query(
      'SELECT * FROM User WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return null;
    }

    return users[0];
  } catch (error) {
    logger.error('Error fetching user by id', {
      error: error.message,
      userId
    });
    throw error;
  }
}

/**
 * List users with optional filtering
 * ✅ OPTIMIZED: Single query with pagination
 * 
 * @param {Object} options - Filter options
 * @param {string} options.role - Filter by role (USER, ADMIN)
 * @param {string} options.search - Search by email
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @returns {Promise<{data: Array, pagination: Object}>}
 */
export async function listUsers(options = {}) {
  const {
    role = null,
    search = null,
    page = 1,
    limit = 20
  } = options;

  const skip = (page - 1) * limit;
  let whereConditions = [];
  let queryParams = [];

  try {
    // Filter by role
    if (role && ['USER', 'ADMIN'].includes(role)) {
      whereConditions.push('role = ?');
      queryParams.push(role);
    }

    // Search by email
    if (search) {
      whereConditions.push('email LIKE ?');
      queryParams.push(`%${search}%`);
    }

    // Build WHERE clause
    let whereClause = '';
    if (whereConditions.length > 0) {
      whereClause = ' WHERE ' + whereConditions.join(' AND ');
    }

    // Get total
    const countResult = await query(
      `SELECT COUNT(*) as count FROM User${whereClause}`,
      queryParams
    );
    const total = countResult[0]?.count || 0;

    // Get users (without password hashes)
    const users = await query(
      `SELECT id, email, role, createdAt, updatedAt FROM User${whereClause}
       ORDER BY createdAt DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, skip]
    );

    logger.debug('Users listed', {
      count: users.length,
      total,
      filters: { role, search }
    });

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error listing users', {
      error: error.message,
      filters: { role, search }
    });
    throw error;
  }
}

/**
 * Get user statistics
 * @returns {Promise<Object>}
 */
export async function getUserStats() {
  try {
    const stats = await query(
      `SELECT
        COUNT(*) as totalUsers,
        SUM(CASE WHEN role = 'ADMIN' THEN 1 ELSE 0 END) as adminCount,
        SUM(CASE WHEN role = 'USER' THEN 1 ELSE 0 END) as userCount
       FROM User`
    );

    return stats[0] || {};
  } catch (error) {
    logger.error('Error fetching user stats', {
      error: error.message
    });
    throw error;
  }
}

export default {
  getUserProfile,
  getUserByEmail,
  getUserById,
  listUsers,
  getUserStats
};
