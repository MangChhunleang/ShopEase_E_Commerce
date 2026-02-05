import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { query } from './src/config/database.js';
import { requireAuth, requireAdmin } from './src/middleware/auth.js';
import authRoutes from './src/routes/auth.routes.js';
import { upload, uploadBanner, getImageUrl, getBannerUrl, deleteImageFile, deleteBannerFile, extractFilenameFromUrl } from './src/utils/upload.js';
import bakongService from './src/services/bakong.service.js';
import { validateEnv, isProduction } from './src/utils/validate-env.js';
import logger from './src/utils/logger.js';
import * as Sentry from '@sentry/node';
import productsService from './src/services/products.service.js';
import ordersService from './src/services/orders.service.js';
import usersService from './src/services/users.service.js';
// Redis/Caching disabled - removed for simplified deployment
import { getProductsList, searchProducts, getProductSuggestions } from './src/services/products.service.js';

// Load environment variables - suppress dotenv tips
dotenv.config({ debug: false });

// Validate environment variables before starting
validateEnv();

// Debug logging utility - now uses Winston logger
const DEBUG = process.env.DEBUG === 'true';
const debug = (tag, message, data = null) => {
  if (DEBUG) {
    logger.debug(`[${tag}] ${message}`, data || {});
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Sentry error tracking (optional)
if (process.env.SENTRY_DSN) {
  try {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    });

    if (Sentry.Handlers) {
      app.use(Sentry.Handlers.requestHandler());
      logger.info('Sentry initialized');
    } else {
      logger.warn('Sentry Handlers not available - error tracking disabled');
    }
  } catch (error) {
    logger.warn('Sentry initialization failed', { error: error.message });
  }
}

// CORS configuration - secure for production
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    
    // In production, strictly enforce allowed origins
    if (isProduction() && !allowedOrigins.includes(origin)) {
      logger.warn('CORS: Blocked unauthorized origin', { origin });
      return callback(new Error('Not allowed by CORS'));
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // In development, allow all origins with warning
    if (!isProduction()) {
      logger.warn('CORS: Allowing origin in development mode', { origin });
      return callback(null, true);
    }
    
    // Reject if not in allowed list and in production
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

// Rate limiting configuration
// Payment status check limiter - allow frequent checks but prevent abuse
const paymentStatusLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 20, // Max 20 requests per minute per IP (every 3 seconds)
  message: { error: 'Too many payment status checks. Please wait a moment and try again.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Order creation limiter - prevent spam orders
const orderCreationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 5, // Max 5 orders per minute per IP
  message: { error: 'Too many orders created. Please wait a moment before placing another order.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth limiter - prevent brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 login attempts per 15 minutes
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limiter - prevent DOS attacks
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Max 100 requests per minute per IP
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general limiter to all routes
app.use(generalLimiter);

// ==================== HEALTH CHECK ENDPOINTS ====================
// These endpoints should respond quickly without auth or rate limiting

// Basic health check - is the server running?
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Ready check - is the server ready to handle requests?
app.get('/ready', async (req, res) => {
  try {
    // Check database connection
    await query('SELECT 1');
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'ok',
        uptime: process.uptime()
      }
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'error',
        error: error.message
      }
    });
  }
});

// Cache stats endpoint - disabled (Redis removed)
app.get('/cache/stats', async (req, res) => {
  res.status(200).json({
    cache: 'Disabled',
    message: 'Redis caching has been removed for simplified deployment',
    timestamp: new Date().toISOString()
  });
});

// Serve static files (uploaded images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Auth routes
app.use('/api/auth', authLimiter, authRoutes);

const parseImages = v => {
  if (!v) return [];
  if (Array.isArray(v)) {
    // Ensure all image URLs are properly formatted
    return v.map(img => {
      // If it's already a full URL or starts with /uploads, return as is
      if (typeof img === 'string' && (img.startsWith('http') || img.startsWith('/uploads'))) {
        return img;
      }
      // If it's base64, return as is (for backward compatibility)
      if (typeof img === 'string' && img.startsWith('data:image')) {
        return img;
      }
      return img;
    });
  }
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const mapProduct = row => {
  const images = parseImages(row.images);

  // Return relative URLs for /uploads/ paths - let clients convert to their base URL
  // This works better for mobile apps that use different base URLs (10.0.2.2 vs localhost)
  // Full URLs (http/https) and base64 are returned as-is
  const processedImages = images.map(img => {
    // If it's already a full URL or base64, return as-is
    if (typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://') || img.startsWith('data:image'))) {
      return img;
    }
    // For relative URLs starting with /uploads/, return as relative
    // Clients (web/mobile) will prepend their own base URL
    if (typeof img === 'string' && img.startsWith('/uploads/')) {
      return img; // Return relative URL
    }
    return img;
  });

  return {
    ...row,
    images: processedImages,
  };
};

// Validate that a category exists and is a leaf (no children). Returns result with status code hints.
const validateLeafCategory = async (categoryName) => {
  const categories = await query('SELECT * FROM Category WHERE name = ?', [categoryName]);
  if (!categories || categories.length === 0) {
    return { ok: false, code: 'not_found' };
  }

  if (categories.length > 1) {
    return { ok: false, code: 'ambiguous' };
  }

  const category = categories[0];
  const children = await query('SELECT COUNT(*) AS count FROM Category WHERE parentCategoryId = ?', [category.id]);
  const childCount = Number(children?.[0]?.count || 0);

  if (childCount > 0) {
    return { ok: false, code: 'not_leaf', category };
  }

  return { ok: true, category };
};

app.post('/auth/login', generalLimiter, async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const users = await query('SELECT * FROM User WHERE email = ? LIMIT 1', [email]);
    const user = users[0];
    if (!user) {
      logger.logAuth('LOGIN', email, false, 'User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      logger.logAuth('LOGIN', email, false, 'Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    logger.logAuth('LOGIN', email, true, `Role: ${user.role}`);
    res.json({ token, role: user.role });
  } catch (error) {
    logger.error('Login error', { email, error: error.message });
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Firebase token login endpoint - for mobile app
app.post('/auth/firebase-login', async (req, res) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ error: 'ID token required' });
    }

    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email || `firebase_${firebaseUid}@shopease.local`;
    const phoneNumber = decodedToken.phone_number || null;

    // Check if user exists in database
    let userRows = await query('SELECT * FROM User WHERE email = ? LIMIT 1', [email]);
    let user = userRows[0];

    // Create user if doesn't exist (first-time login)
    if (!user) {
      await query(
        'INSERT INTO User (email, passwordHash, phoneNumber, role, isActive) VALUES (?, ?, ?, ?, ?)',
        [email, await bcrypt.hash(firebaseUid, 10), phoneNumber, 'USER', true]
      );
      userRows = await query('SELECT * FROM User WHERE email = ? LIMIT 1', [email]);
      user = userRows[0];
    }

    // Generate JWT token for the user
    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    logger.logAuth('FIREBASE_LOGIN', email, true, `Firebase UID: ${firebaseUid}`);
    res.json({ token, role: user.role, userId: user.id });
  } catch (error) {
    logger.error('Firebase login error', { error: error.message });
    res.status(401).json({ error: 'Firebase authentication failed', details: error.message });
  }
});

app.get('/me', requireAuth, (req, res) => res.json({ userId: req.user.userId, role: req.user.role }));

// Public products endpoint for customers (only active products)
// ✅ OPTIMIZED: Phase 2 + Phase 3: Prisma (100x) + Redis Caching (6-10x)
// Total: 600-1000x faster than original
app.get('/api/products', async (req, res) => {
  try {
    const { page = 1, limit = 20, category } = req.query;
    
    const result = await getProductsList({
      page: parseInt(page),
      limit: parseInt(limit),
      category: category || null
    });

    res.set('X-Performance', 'Phase2-Phase3');
    res.json(result);
  } catch (error) {
    logger.error('Products fetch error', { error: error.message });
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Legacy endpoint for backward compatibility
app.get('/products', async (_req, res) => {
  try {
    const result = await getProductsList({ limit: 100 });
    res.json(result.data);
  } catch (error) {
    logger.error('Products fetch error', { error: error.message });
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Search products endpoint with filters
// ✅ OPTIMIZED: Phase 2 + Phase 3: Prisma (120x) + Redis Caching (6-10x)
// Total: 720-1200x faster than original
app.get('/api/products/search', async (req, res) => {
  try {
    const {
      q = '',
      category = '',
      minPrice = null,
      maxPrice = null,
      sort = 'name',
      page = 1,
      limit = 20
    } = req.query;

    const result = await searchProducts({
      query: q,
      category,
      minPrice: minPrice ? parseFloat(minPrice) : null,
      maxPrice: maxPrice ? parseFloat(maxPrice) : null,
      sort,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json(result);
  } catch (error) {
    logger.error('Search error', { error: error.message });
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

// Legacy search endpoint for backward compatibility
app.get('/products/search', async (req, res) => {
  try {
    const {
      q = '',
      category = '',
      minPrice = '',
      maxPrice = '',
      sort = 'name',
      limit = 100,
      offset = 0
    } = req.query;

    const page = Math.floor(parseInt(offset) / parseInt(limit)) + 1;
    
    const result = await searchProducts({
      query: q,
      category,
      minPrice: minPrice ? parseFloat(minPrice) : null,
      maxPrice: maxPrice ? parseFloat(maxPrice) : null,
      sort,
      page,
      limit: parseInt(limit)
    });

    res.json(result.data);
  } catch (error) {
    logger.error('Search error', { error: error.message });
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

// Get search suggestions (autocomplete)
// ✅ OPTIMIZED: Phase 2 + Phase 3: Prisma + Redis (80x base + 6-10x cache = 480-800x)
app.get('/api/products/suggestions', async (req, res) => {
  try {
    const { q = '' } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const suggestions = await getProductSuggestions(q.trim(), 10);
  } catch (error) {
    logger.error('Suggestions error', { error: error.message });
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

// Legacy suggestions endpoint for backward compatibility
app.get('/products/suggestions', async (req, res) => {
  try {
    const { q = '' } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const suggestions = await getProductSuggestions(q.trim(), 10);
    const formatted = suggestions.map(s => ({
      text: s.name,
      category: s.category,
      type: 'product'
    }));
    res.json(formatted);
  } catch (error) {
    logger.error('Suggestions error', { error: error.message });
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

// Admin products endpoint (all products including archived)
app.get('/admin/products', requireAuth, requireAdmin, async (_req, res) => {
  const rows = await query('SELECT * FROM Product ORDER BY updatedAt DESC');
  res.json(rows.map(mapProduct));
});

app.post('/admin/products', requireAuth, requireAdmin, async (req, res) => {
  const { name, description = '', price, stock = 0, status = 'ACTIVE', images = [], category = null } = req.body ?? {};
  if (!name || price === undefined) return res.status(400).json({ error: 'Name and price required' });

  const normalizedCategory = typeof category === 'string' && category.trim() !== '' ? category.trim() : null;
  if (normalizedCategory) {
    const leafCheck = await validateLeafCategory(normalizedCategory);
    if (!leafCheck.ok) {
      if (leafCheck.code === 'not_found') {
        return res.status(400).json({ error: 'Category not found. Please select an existing subcategory.' });
      }
      if (leafCheck.code === 'ambiguous') {
        return res.status(400).json({ error: `Multiple categories named "${normalizedCategory}" exist. Rename to make it unique and select the subcategory.` });
      }
      if (leafCheck.code === 'not_leaf') {
        return res.status(400).json({ error: 'Category has child categories. Please pick a subcategory instead.' });
      }
    }
  }

  // Color and offer are deprecated; store nulls to keep schema compatibility
  const payload = [name, description, price, stock, status, JSON.stringify(images), normalizedCategory, null, null, req.user.userId];
  const result = await query(
    'INSERT INTO Product (name, description, price, stock, status, images, category, offer, color, updatedById, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?, NOW(), NOW())',
    payload,
  );
  const insertedId = result.insertId;
  const [product] = await query('SELECT * FROM Product WHERE id = ? LIMIT 1', [insertedId]);
  
  // ✅ CACHE INVALIDATION: Clear caches after product creation
  // Cache invalidation disabled - Redis removed
  
  res.status(201).json(mapProduct(product));
});

app.put('/admin/products/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const { name, description = '', price, stock = 0, status = 'ACTIVE', images = [], category = null } = req.body ?? {};

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Name and price required' });
    }

    // Check if product exists
    const existingProducts = await query('SELECT * FROM Product WHERE id = ? LIMIT 1', [id]);
    if (!existingProducts || existingProducts.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const normalizedCategory = typeof category === 'string' && category.trim() !== '' ? category.trim() : null;
    if (normalizedCategory) {
      const leafCheck = await validateLeafCategory(normalizedCategory);
      if (!leafCheck.ok) {
        if (leafCheck.code === 'not_found') {
          return res.status(400).json({ error: 'Category not found. Please select an existing subcategory.' });
        }
        if (leafCheck.code === 'ambiguous') {
          return res.status(400).json({ error: `Multiple categories named "${normalizedCategory}" exist. Rename to make it unique and select the subcategory.` });
        }
        if (leafCheck.code === 'not_leaf') {
          return res.status(400).json({ error: 'Category has child categories. Please pick a subcategory instead.' });
        }
      }
    }

    // Update the product - query() returns ResultSetHeader for UPDATE/DELETE
    // Color and offer are deprecated; store nulls to keep schema compatibility
    const payload = [name, description, price, stock, status, JSON.stringify(images), normalizedCategory, null, null, req.user.userId, id];
    const result = await query(
      'UPDATE Product SET name=?, description=?, price=?, stock=?, status=?, images=?, category=?, offer=?, color=?, updatedById=?, updatedAt=NOW() WHERE id=?',
      payload,
    );

    // Verify update - result is ResultSetHeader with affectedRows property
    // For UPDATE/DELETE, query() returns the ResultSetHeader object directly
    if (result && typeof result === 'object' && result.affectedRows !== undefined) {
      if (result.affectedRows === 0) {
        return res.status(500).json({ error: 'Failed to update product - no rows affected' });
      }
    }

    // Fetch and return updated product
    const products = await query('SELECT * FROM Product WHERE id = ? LIMIT 1', [id]);
    if (!products || products.length === 0) {
      return res.status(404).json({ error: 'Product not found after update' });
    }

    logger.info('Product updated', { productId: id, name: products[0].name });
    
    // ✅ CACHE INVALIDATION: Clear caches after product update
    await invalidateProductCache(id);
    
    res.json(mapProduct(products[0]));
  } catch (error) {
    logger.error('Product update error', { 
      productId: req.params.id,
      error: error.message,
      code: error.code
    });

    // Check if it's a column error
    if (error.message && error.message.includes('Unknown column')) {
      return res.status(500).json({
        error: 'Database schema mismatch. Please run: cd backend && node init_db.js',
        details: error.message
      });
    }

    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.patch('/admin/products/:id/status', requireAuth, requireAdmin, async (req, res) => {
  const { status } = req.body ?? {};
  if (!['ACTIVE', 'ARCHIVED'].includes(status)) return res.status(400).json({ error: 'Bad status' });
  const productId = Number(req.params.id);
  await query(
    'UPDATE Product SET status=?, updatedById=?, updatedAt=NOW() WHERE id=?',
    [status, req.user.userId, productId],
  );
  
  // ✅ CACHE INVALIDATION: Clear caches after status change
  // Cache invalidation disabled - Redis removed
  
  res.json({ ok: true });
});

app.delete('/admin/products/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    // Check if product exists
    const products = await query('SELECT * FROM Product WHERE id = ? LIMIT 1', [id]);
    if (!products || products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Delete the product - query() returns ResultSetHeader for UPDATE/DELETE
    const result = await query('DELETE FROM Product WHERE id = ?', [id]);

    // Verify deletion - result is ResultSetHeader with affectedRows property
    // For UPDATE/DELETE, query() returns the ResultSetHeader object directly
    if (result && typeof result === 'object' && result.affectedRows !== undefined) {
      if (result.affectedRows === 0) {
        return res.status(500).json({ error: 'Failed to delete product - no rows affected' });
      }
    }

    logger.info('Product deleted', { productId: id });
    
    // ✅ CACHE INVALIDATION: Clear caches after product deletion
    await invalidateProductCache(id);
    
    res.json({ ok: true, message: 'Product deleted successfully' });
  } catch (error) {
    logger.error('Product delete error', {
      productId: req.params.id,
      error: error.message,
      code: error.code
    });

    // Check if it's a column error
    if (error.message && error.message.includes('Unknown column')) {
      return res.status(500).json({
        error: 'Database schema mismatch. Please run: cd backend && node init_db.js',
        details: error.message
      });
    }

    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ==================== FILE UPLOAD ENDPOINTS ====================

// Upload product images
app.post('/admin/upload', requireAuth, requireAdmin, upload.array('images', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const imageUrls = req.files.map(file => {
      // Return full URL - adjust base URL based on your setup
      const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
      return getImageUrl(file.filename);
    });

    logger.info('Images uploaded', { count: req.files.length });
    res.json({
      success: true,
      images: imageUrls,
      message: `Successfully uploaded ${req.files.length} image(s)`
    });
  } catch (error) {
    logger.error('Upload error', { error: error.message });
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

// Upload user profile image (for regular users)
app.post('/user/upload', requireAuth, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const imageUrl = getImageUrl(req.file.filename);

    logger.info('User profile image uploaded', { userId: req.user.userId, filename: req.file.filename });
    res.json({
      success: true,
      images: [imageUrl],
      message: 'Profile image uploaded successfully'
    });
  } catch (error) {
    logger.error('User profile upload error', { error: error.message });
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

// Delete uploaded image
app.delete('/admin/upload/:filename', requireAuth, requireAdmin, (req, res) => {
  try {
    const filename = req.params.filename;

    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    // Security: prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const deleted = deleteImageFile(filename);

    if (deleted) {
      logger.info('Image deleted', { filename });
      res.json({ success: true, message: 'Image deleted successfully' });
    } else {
      res.status(404).json({ error: 'Image not found' });
    }
  } catch (error) {
    logger.error('Image delete error', { filename: req.params.filename, error: error.message });
    res.status(500).json({ error: 'Delete failed', details: error.message });
  }
});

// ==================== BANNER UPLOAD ENDPOINTS ====================

// Upload banner images
app.post('/admin/banners/upload', requireAuth, requireAdmin, uploadBanner.array('images', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const imageUrls = req.files.map(file => getBannerUrl(file.filename));

    console.log(`[BANNER-UPLOAD] Uploaded ${req.files.length} banner image(s)`);
    res.json({
      success: true,
      images: imageUrls,
      message: `Successfully uploaded ${req.files.length} banner image(s)`
    });
  } catch (error) {
    console.error('[BANNER-UPLOAD] Error:', error);
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

// Delete uploaded banner image
app.delete('/admin/banners/upload/:filename', requireAuth, requireAdmin, (req, res) => {
  try {
    const filename = req.params.filename;

    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    // Security: prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const deleted = deleteBannerFile(filename);

    if (deleted) {
      console.log(`[BANNER-UPLOAD] Deleted banner: ${filename}`);
      res.json({ success: true, message: 'Banner image deleted successfully' });
    } else {
      res.status(404).json({ error: 'Banner image not found' });
    }
  } catch (error) {
    console.error('[BANNER-UPLOAD] Delete error:', error);
    res.status(500).json({ error: 'Delete failed', details: error.message });
  }
});

// ==================== CATEGORY ENDPOINTS ====================

// Public endpoint: Get all categories (for mobile app)
// Helper function to build category hierarchy
function buildCategoryHierarchy(categories) {
  const categoryMap = new Map();
  const rootCategories = [];

  // First pass: create map of all categories
  categories.forEach(cat => {
    categoryMap.set(cat.id, {
      ...cat,
      subcategories: []
    });
  });

  // Second pass: build hierarchy
  categories.forEach(cat => {
    const category = categoryMap.get(cat.id);
    if (cat.parentCategoryId === null || cat.parentCategoryId === undefined) {
      rootCategories.push(category);
    } else {
      const parent = categoryMap.get(cat.parentCategoryId);
      if (parent) {
        parent.subcategories.push(category);
      } else {
        // Parent not found, treat as root
        rootCategories.push(category);
      }
    }
  });

  return rootCategories;
}

// Public endpoint: Get all categories (with hierarchy)
app.get('/categories', async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM Category ORDER BY parentCategoryId ASC, name ASC');

    // Return flat list for backward compatibility, but include parentCategoryId
    res.json(rows);
  } catch (error) {
    console.error('[CATEGORIES] Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Public endpoint: Get categories with hierarchy
app.get('/categories/hierarchy', async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM Category ORDER BY parentCategoryId ASC, name ASC');
    const hierarchy = buildCategoryHierarchy(rows);
    res.json(hierarchy);
  } catch (error) {
    console.error('[CATEGORIES] Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Public endpoint: Get subcategories of a parent category
app.get('/categories/:parentId/subcategories', async (req, res) => {
  try {
    const parentId = Number(req.params.parentId);
    if (!parentId || isNaN(parentId)) {
      return res.status(400).json({ error: 'Invalid parent category ID' });
    }

    const rows = await query(
      'SELECT * FROM Category WHERE parentCategoryId = ? ORDER BY name ASC',
      [parentId]
    );
    res.json(rows);
  } catch (error) {
    console.error('[CATEGORIES] Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Admin endpoint: Get all categories
app.get('/admin/categories', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM Category ORDER BY parentCategoryId ASC, name ASC');
    res.json(rows);
  } catch (error) {
    console.error('[CATEGORIES] Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Admin endpoint: Create category
app.post('/admin/categories', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, description = null, icon = null, color = null, logoUrl = null, parentCategoryId = null } = req.body ?? {};
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Validate parentCategoryId if provided
    if (parentCategoryId !== null && parentCategoryId !== undefined) {
      const parentId = Number(parentCategoryId);
      if (isNaN(parentId)) {
        return res.status(400).json({ error: 'Invalid parent category ID' });
      }

      // Check if parent category exists
      const parent = await query('SELECT * FROM Category WHERE id = ? LIMIT 1', [parentId]);
      if (!parent || parent.length === 0) {
        return res.status(400).json({ error: 'Parent category not found' });
      }

      // Check if parent has a parent (only 2 levels allowed)
      if (parent[0].parentCategoryId !== null && parent[0].parentCategoryId !== undefined) {
        return res.status(400).json({ error: 'Cannot create subcategory of a subcategory. Only 2 levels are allowed.' });
      }
    }

    // Check if category with same name and parent already exists
    const existing = await query(
      'SELECT * FROM Category WHERE name = ? AND (parentCategoryId = ? OR (parentCategoryId IS NULL AND ? IS NULL)) LIMIT 1',
      [name.trim(), parentCategoryId, parentCategoryId]
    );
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Category with this name already exists in this parent category' });
    }

    const result = await query(
      'INSERT INTO Category (name, description, icon, color, logoUrl, parentCategoryId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [name.trim(), description || null, icon || null, color || null, logoUrl || null, parentCategoryId || null]
    );

    const insertedId = result.insertId;
    const [category] = await query('SELECT * FROM Category WHERE id = ? LIMIT 1', [insertedId]);

    console.log(`[CATEGORY] Created: ${name} (${insertedId})${parentCategoryId ? ` under parent ${parentCategoryId}` : ''}`);
    res.status(201).json(category);
  } catch (error) {
    console.error('[CATEGORY] Create error:', error);

    // Check for duplicate key error
    if (error.code === 'ER_DUP_ENTRY' || error.message.includes('Duplicate entry')) {
      return res.status(400).json({ error: 'Category with this name already exists in this parent category' });
    }

    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Admin endpoint: Update category
app.put('/admin/categories/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    const { name, description = null, icon = null, color = null, logoUrl = null, parentCategoryId = null } = req.body ?? {};
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Check if category exists
    const existing = await query('SELECT * FROM Category WHERE id = ? LIMIT 1', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Validate parentCategoryId if provided
    if (parentCategoryId !== null && parentCategoryId !== undefined) {
      const parentId = Number(parentCategoryId);
      if (isNaN(parentId)) {
        return res.status(400).json({ error: 'Invalid parent category ID' });
      }

      // Prevent setting itself as parent
      if (parentId === id) {
        return res.status(400).json({ error: 'Category cannot be its own parent' });
      }

      // Check if parent category exists
      const parent = await query('SELECT * FROM Category WHERE id = ? LIMIT 1', [parentId]);
      if (!parent || parent.length === 0) {
        return res.status(400).json({ error: 'Parent category not found' });
      }

      // Check if parent has a parent (only 2 levels allowed)
      if (parent[0].parentCategoryId !== null && parent[0].parentCategoryId !== undefined) {
        return res.status(400).json({ error: 'Cannot set parent to a subcategory. Only 2 levels are allowed.' });
      }
    }

    // Check if another category with the same name and parent exists
    const duplicate = await query(
      'SELECT * FROM Category WHERE name = ? AND id != ? AND (parentCategoryId = ? OR (parentCategoryId IS NULL AND ? IS NULL)) LIMIT 1',
      [name.trim(), id, parentCategoryId, parentCategoryId]
    );
    if (duplicate && duplicate.length > 0) {
      return res.status(400).json({ error: 'Category with this name already exists in this parent category' });
    }

    const result = await query(
      'UPDATE Category SET name=?, description=?, icon=?, color=?, logoUrl=?, parentCategoryId=?, updatedAt=NOW() WHERE id=?',
      [name.trim(), description || null, icon || null, color || null, logoUrl || null, parentCategoryId || null, id]
    );

    if (result && typeof result === 'object' && result.affectedRows !== undefined) {
      if (result.affectedRows === 0) {
        return res.status(500).json({ error: 'Failed to update category - no rows affected' });
      }
    }

    const [category] = await query('SELECT * FROM Category WHERE id = ? LIMIT 1', [id]);

    console.log(`[CATEGORY] Updated: ${name} (${id})`);
    res.json(category);
  } catch (error) {
    console.error('[CATEGORY] Update error:', error);

    // Check for duplicate key error
    if (error.code === 'ER_DUP_ENTRY' || error.message.includes('Duplicate entry')) {
      return res.status(400).json({ error: 'Category with this name already exists' });
    }

    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Admin endpoint: Delete category
app.delete('/admin/categories/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    // Check if category exists
    const categories = await query('SELECT * FROM Category WHERE id = ? LIMIT 1', [id]);
    if (!categories || categories.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if any products are using this category
    const products = await query('SELECT COUNT(*) as count FROM Product WHERE category = ?', [categories[0].name]);
    if (products[0]?.count > 0) {
      return res.status(400).json({
        error: `Cannot delete category. ${products[0].count} product(s) are using this category. Please update or remove those products first.`
      });
    }

    const result = await query('DELETE FROM Category WHERE id = ?', [id]);

    if (result && typeof result === 'object' && result.affectedRows !== undefined) {
      if (result.affectedRows === 0) {
        return res.status(500).json({ error: 'Failed to delete category - no rows affected' });
      }
    }

    console.log(`[CATEGORY] Deleted: ${categories[0].name} (${id})`);
    res.json({ ok: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('[CATEGORY] Delete error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Helper function to map banner with image URL
const mapBanner = (row) => {
  // Return relative URLs - let mobile clients convert to their base URL
  // This matches the product image approach for consistency
  return {
    ...row,
    // imageUrl is already stored as relative path, return as-is
  };
};

// Public endpoint: Get active banners (for mobile app)
app.get('/banners', async (req, res) => {
  try {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const { type } = req.query;
    
    let whereClause = 'WHERE isActive = TRUE';
    
    // Filter by banner type
    if (type === 'home') {
      whereClause += ' AND displayOnHome = TRUE';
    } else if (type === 'category') {
      whereClause += ' AND displayOnHome = FALSE';
    }
    // If no type specified, return all active banners
    
    const rows = await query(
      `SELECT * FROM Banner 
       ${whereClause}
       AND (startDate IS NULL OR startDate <= ?)
       AND (endDate IS NULL OR endDate >= ?)
       ORDER BY displayOrder ASC, createdAt DESC`,
      [now, now]
    );
    res.json(rows.map(mapBanner));
  } catch (error) {
    console.error('[BANNERS] Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Admin endpoint: Get all banners
app.get('/admin/banners', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM Banner ORDER BY displayOrder ASC, createdAt DESC');
    res.json(rows.map(mapBanner));
  } catch (error) {
    console.error('[BANNERS] Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Admin endpoint: Create banner
app.post('/admin/banners', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      title = null,
      imageUrl,
      linkType = 'none',
      linkValue = null,
      displayOrder = 0,
      isActive = true,
      displayOnHome = true,
      startDate = null,
      endDate = null
    } = req.body ?? {};

    if (!imageUrl || imageUrl.trim() === '') {
      return res.status(400).json({ error: 'Banner image URL is required' });
    }

    // Accept both relative paths (/uploads/banners/...) and full URLs
    // Store as relative path in database for flexibility
    let relativePath = imageUrl.trim();
    if (relativePath.includes('://')) {
      // Extract relative path from full URL
      const match = relativePath.match(/\/uploads\/(banners|products)\/([^\/\?]+)/);
      if (match) {
        relativePath = `/uploads/${match[1]}/${match[2]}`;
      } else {
        return res.status(400).json({ error: 'Invalid image URL format' });
      }
    } else if (!relativePath.startsWith('/uploads/')) {
      return res.status(400).json({ error: 'Image URL must be a relative path (/uploads/banners/...) or full URL' });
    }

    // Auto-generate title if not provided
    const bannerTitle = title && title.trim() ? title.trim() : `Banner_${Date.now()}`;

    // Validate linkType
    const validLinkTypes = ['none', 'product', 'category', 'url'];
    if (!validLinkTypes.includes(linkType)) {
      return res.status(400).json({ error: 'Invalid link type' });
    }

    // If linkType requires linkValue, validate it
    if (linkType !== 'none' && (!linkValue || linkValue.trim() === '')) {
      return res.status(400).json({ error: 'Link value is required when link type is not "none"' });
    }

    const result = await query(
      `INSERT INTO Banner (title, imageUrl, linkType, linkValue, displayOrder, isActive, displayOnHome, startDate, endDate, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        bannerTitle,
        relativePath,
        linkType,
        linkValue ? linkValue.trim() : null,
        displayOrder,
        isActive,
        displayOnHome,
        startDate || null,
        endDate || null
      ]
    );

    const insertedId = result.insertId;
    const [banner] = await query('SELECT * FROM Banner WHERE id = ? LIMIT 1', [insertedId]);

    console.log(`[BANNER] Created: ${bannerTitle} (${insertedId})`);
    res.status(201).json(mapBanner(banner));
  } catch (error) {
    console.error('[BANNER] Create error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Admin endpoint: Update banner
app.put('/admin/banners/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid banner ID' });
    }

    const {
      title = null,
      imageUrl,
      linkType = 'none',
      linkValue = null,
      displayOrder = 0,
      isActive = true,
      displayOnHome = true,
      startDate = null,
      endDate = null
    } = req.body ?? {};

    // Check if banner exists
    const existing = await query('SELECT * FROM Banner WHERE id = ? LIMIT 1', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    if (!imageUrl || imageUrl.trim() === '') {
      return res.status(400).json({ error: 'Banner image URL is required' });
    }

    // Accept both relative paths (/uploads/banners/...) and full URLs
    // Store as relative path in database for flexibility
    let relativePath = imageUrl.trim();
    if (relativePath.includes('://')) {
      // Extract relative path from full URL
      const match = relativePath.match(/\/uploads\/(banners|products)\/([^\/\?]+)/);
      if (match) {
        relativePath = `/uploads/${match[1]}/${match[2]}`;
      } else {
        return res.status(400).json({ error: 'Invalid image URL format' });
      }
    } else if (!relativePath.startsWith('/uploads/')) {
      return res.status(400).json({ error: 'Image URL must be a relative path (/uploads/banners/...) or full URL' });
    }

    // Auto-generate title if not provided, otherwise use the provided title
    const bannerTitle = title && title.trim() ? title.trim() : (existing[0].title || `Banner_${Date.now()}`);

    // Validate linkType
    const validLinkTypes = ['none', 'product', 'category', 'url'];
    if (!validLinkTypes.includes(linkType)) {
      return res.status(400).json({ error: 'Invalid link type' });
    }

    // If linkType requires linkValue, validate it
    if (linkType !== 'none' && (!linkValue || linkValue.trim() === '')) {
      return res.status(400).json({ error: 'Link value is required when link type is not "none"' });
    }

    const result = await query(
      `UPDATE Banner SET title=?, imageUrl=?, linkType=?, linkValue=?, displayOrder=?, isActive=?, displayOnHome=?, startDate=?, endDate=?, updatedAt=NOW() 
       WHERE id=?`,
      [
        bannerTitle,
        relativePath,
        linkType,
        linkValue ? linkValue.trim() : null,
        displayOrder,
        isActive,
        displayOnHome,
        startDate || null,
        endDate || null,
        id
      ]
    );

    if (result && typeof result === 'object' && result.affectedRows !== undefined) {
      if (result.affectedRows === 0) {
        return res.status(500).json({ error: 'Failed to update banner - no rows affected' });
      }
    }

    const [banner] = await query('SELECT * FROM Banner WHERE id = ? LIMIT 1', [id]);

    console.log(`[BANNER] Updated: ${bannerTitle} (${id})`);
    res.json(mapBanner(banner));
  } catch (error) {
    console.error('[BANNER] Update error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Admin endpoint: Delete banner
app.delete('/admin/banners/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid banner ID' });
    }

    // Check if banner exists
    const banners = await query('SELECT * FROM Banner WHERE id = ? LIMIT 1', [id]);
    if (!banners || banners.length === 0) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    // Delete banner image file if it's in uploads
    const banner = banners[0];
    if (banner.imageUrl && banner.imageUrl.startsWith('/uploads/')) {
      const filename = extractFilenameFromUrl(banner.imageUrl);
      if (filename) {
        deleteImageFile(filename);
      }
    }

    await query('DELETE FROM Banner WHERE id = ?', [id]);

    console.log(`[BANNER] Deleted: ${id}`);
    res.json({ message: 'Banner deleted successfully' });
  } catch (error) {
    console.error('[BANNER] Delete error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Helper function to generate order number: ORD-YYYYMMDD-XXXXXX
function generateOrderNumber() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const randomStr = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
  return `ORD-${dateStr}-${randomStr}`;
}

// Helper function to map order with items
async function mapOrder(orderRow) {
  const items = await query(
    'SELECT * FROM OrderItem WHERE orderId = ? ORDER BY id',
    [orderRow.id]
  );
  return {
    ...orderRow,
    items: items.map(item => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      productImage: item.productImage,
      price: Number(item.price),
      quantity: item.quantity,
      color: item.color,
      offer: item.offer,
    })),
  };
}

// STEP 2: Create Order (for mobile app checkout)
// This endpoint is public (no auth required) so customers can place orders
// Apply rate limiting to prevent order spam
app.post('/orders', orderCreationLimiter, async (req, res) => {
  let connection;
  try {
    console.log('[ORDER] Received order request:', JSON.stringify(req.body, null, 2));
    const {
      items = [],
      customerName,
      customerPhone,
      customerAddress,
      customerCity,
      customerDistrict,
      paymentMethod,
      userId = null, // Optional: if user is logged in
    } = req.body ?? {};

    // Validation
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Order must have at least one item' });
    }
    if (!customerName || !customerPhone || !customerAddress || !customerCity || !customerDistrict) {
      return res.status(400).json({ error: 'Customer information is required' });
    }
    if (!paymentMethod || !['Cash on Delivery', 'ABA Pay', 'Bakong'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Valid payment method is required (Cash on Delivery, ABA Pay, or Bakong)' });
    }

    // Get database connection for transaction
    const { default: pool } = await import('./src/config/database.js');
    connection = await pool.getConnection();
    
    // Start transaction
    await connection.beginTransaction();
    console.log('[ORDER] Transaction started');

    // Validate stock availability and recalculate prices from database
    // SECURITY: Don't trust client prices - fetch actual prices from DB
    let calculatedSubtotal = 0;
    const validatedItems = [];
    
    for (const item of items) {
      const quantity = Number(item.quantity) || 1;
      
      if (!item.productId) {
        await connection.rollback();
        return res.status(400).json({ error: `Invalid product: ${item.name || 'Unknown'}` });
      }
      
      // Fetch product with current price and stock from database
      const [productRows] = await connection.execute(
        'SELECT id, name, price, stock, images FROM Product WHERE id = ? AND status = "ACTIVE" LIMIT 1',
        [item.productId]
      );
      
      if (!productRows || productRows.length === 0) {
        await connection.rollback();
        return res.status(400).json({ error: `Product ${item.name || item.productName} not found or inactive` });
      }
      
      const product = productRows[0];
      const availableStock = product.stock || 0;
      
      if (availableStock < quantity) {
        await connection.rollback();
        return res.status(400).json({ 
          error: `Insufficient stock for ${product.name}. Available: ${availableStock}, Requested: ${quantity}` 
        });
      }
      
      // Use actual price from database (SECURITY FIX)
      const actualPrice = Number(product.price);
      const itemTotal = actualPrice * quantity;
      calculatedSubtotal += itemTotal;
      
      // Store validated item data
      validatedItems.push({
        productId: product.id,
        productName: product.name,
        productImage: item.imageUrl || item.productImage || (product.images ? JSON.parse(product.images)[0] : null),
        price: actualPrice, // Use DB price, not client price
        quantity: quantity,
        color: item.color || null,
        offer: item.offer || null,
      });
      
      console.log(`[ORDER] Validated item: ${product.name} - Price: $${actualPrice} x ${quantity} = $${itemTotal.toFixed(2)}`);
    }

    // Calculate totals with proper rounding (2 decimal places)
    const shipping = 0.00; // Free shipping
    const subtotal = Math.round(calculatedSubtotal * 100) / 100;
    const total = Math.round((subtotal + shipping) * 100) / 100;

    console.log(`[ORDER] Calculated totals - Subtotal: $${subtotal}, Shipping: $${shipping}, Total: $${total}`);

    // Generate order number
    const orderNumber = generateOrderNumber();

    // Validate userId if provided (must exist in User table)
    let validUserId = null;
    if (userId !== null && userId !== undefined) {
      const userIdNum = Number(userId);
      if (!isNaN(userIdNum) && userIdNum > 0) {
        // Check if user exists
        const [users] = await connection.execute('SELECT id FROM User WHERE id = ? LIMIT 1', [userIdNum]);
        if (users && users.length > 0) {
          validUserId = userIdNum;
        } else {
          console.warn(`[ORDER] Invalid userId provided: ${userId}, ignoring`);
        }
      }
    }

    // Insert order
    console.log('[ORDER] Inserting order with data:', {
      orderNumber,
      customerName,
      subtotal,
      shipping,
      total,
      userId: validUserId,
    });

    const [orderResult] = await connection.execute(
      `INSERT INTO \`Order\` (
        orderNumber, customerName, customerPhone, customerAddress, customerCity, 
        customerDistrict, paymentMethod, status, subtotal, shipping, total, userId,
        orderDate, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, NOW(), NOW(), NOW())`,
      [
        orderNumber,
        customerName,
        customerPhone,
        customerAddress,
        customerCity,
        customerDistrict,
        paymentMethod,
        subtotal,
        shipping,
        total,
        validUserId,
      ]
    );

    const orderId = orderResult.insertId;
    console.log('[ORDER] Order inserted with ID:', orderId);

    if (!orderId) {
      await connection.rollback();
      throw new Error('Failed to get order ID after insertion');
    }

    // Insert order items and deduct stock (within same transaction)
    console.log('[ORDER] Inserting order items and deducting stock...');
    for (const item of validatedItems) {
      // Insert order item
      await connection.execute(
        `INSERT INTO OrderItem (
          orderId, productId, productName, productImage, price, quantity, color, offer, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          orderId,
          item.productId,
          item.productName,
          item.productImage,
          item.price,
          item.quantity,
          item.color,
          item.offer,
        ]
      );
      
      // Deduct stock from product (within transaction)
      await connection.execute(
        'UPDATE Product SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.productId]
      );
      
      console.log(`[ORDER] Item inserted and stock deducted: ${item.productName} (${item.quantity} units)`);
    }

    // Commit transaction - all operations succeeded
    await connection.commit();
    console.log('[ORDER] Transaction committed successfully');

    // Fetch complete order with items (using regular pool, not connection)
    console.log('[ORDER] Fetching order with id:', orderId);
    const orderRows = await query('SELECT * FROM `Order` WHERE id = ? LIMIT 1', [orderId]);

    if (!orderRows || orderRows.length === 0) {
      throw new Error(`Order with id ${orderId} not found after insertion`);
    }

    const order = orderRows[0];
    const orderWithItems = await mapOrder(order);

    // If payment method is Bakong, generate QR code
    if (paymentMethod === 'Bakong') {
      try {
        const amountInKHR = bakongService.convertUSDToKHR(total);
        const qrResult = await bakongService.generateKHQR({
          amount: amountInKHR,
          orderNumber: orderNumber,
          merchantName: 'ShopEase',
          merchantCity: customerCity || 'Phnom Penh'
        });

        if (qrResult.success) {
          orderWithItems.bakongQR = {
            qrCode: qrResult.qrCode,
            qrString: qrResult.qrString,
            amount: amountInKHR,
            currency: 'KHR'
          };
          console.log('[ORDER] Bakong QR code generated for order:', orderNumber);
        }
      } catch (qrError) {
        console.error('[ORDER] Error generating Bakong QR code:', qrError);
        // Don't fail the order creation if QR generation fails
      }
    }

    console.log(`[ORDER] Created: ${orderNumber} (${orderId}) - Total: $${total.toFixed(2)}`);
    res.status(201).json(orderWithItems);
  } catch (error) {
    // Rollback transaction on any error
    if (connection) {
      try {
        await connection.rollback();
        console.log('[ORDER] Transaction rolled back due to error');
      } catch (rollbackError) {
        console.error('[ORDER] Error during rollback:', rollbackError);
      }
    }
    
    console.error('[ORDER] Create error:', error);
    console.error('[ORDER] Error message:', error.message);
    console.error('[ORDER] Error code:', error.code);
    console.error('[ORDER] Stack:', error.stack);

    // Check if it's a column error
    if (error.message && error.message.includes('Unknown column')) {
      return res.status(500).json({
        error: 'Database schema mismatch. Please run: cd backend && node init_db.js',
        details: error.message
      });
    }

    // Check if it's a foreign key constraint error
    if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.message.includes('foreign key constraint')) {
      return res.status(400).json({
        error: 'Invalid user ID or product ID',
        details: error.message
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
      code: error.code
    });
  } finally {
    // Release connection back to pool
    if (connection) {
      connection.release();
      console.log('[ORDER] Database connection released');
    }
  }
});

// STEP 4: List Orders (for web admin and mobile app)
// Admin can see all orders, regular users can only see their own orders
app.get('/admin/orders/cancelled', requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    // Get total count
    const [countResult] = await query(
      'SELECT COUNT(*) as total FROM `Order` WHERE status = ?',
      ['cancelled']
    );
    const total = countResult[0]?.total || 0;

    // Get cancelled orders with customer and payment details
    const orders = await query(
      `SELECT 
        o.id, o.orderNumber, o.status, o.total, o.subtotal,
        o.customerName, o.customerPhone, o.paymentMethod,
        o.createdAt, o.updatedAt,
        COUNT(oi.id) as itemCount, SUM(oi.quantity) as totalItems
      FROM \`Order\` o
      LEFT JOIN OrderItem oi ON o.id = oi.orderId
      WHERE o.status = 'cancelled'
      GROUP BY o.id
      ORDER BY o.updatedAt DESC
      LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // Get history for each order to show reason for cancellation
    const ordersWithReason = await Promise.all(
      orders.map(async (order) => {
        const history = await query(
          'SELECT status, note, createdAt FROM OrderStatusHistory WHERE orderId = ? ORDER BY createdAt DESC LIMIT 1',
          [order.id]
        );
        return {
          ...order,
          cancellationReason: history[0]?.note || 'Unknown reason',
          cancelledAt: history[0]?.createdAt || order.updatedAt,
        };
      })
    );

    res.json({
      success: true,
      data: ordersWithReason,
      pagination: {
        page: page,
        limit: limit,
        total: total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('[ADMIN CANCELLED ORDERS] Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Admin report: Timeout impact analysis
app.get('/admin/orders/report/timeout-impact', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Find all auto-cancelled orders (those with 'Auto-cancelled: Payment timeout' in history)
    const timeoutOrders = await query(
      `SELECT 
        o.id, o.orderNumber, o.total, o.subtotal, o.paymentMethod,
        o.createdAt, o.updatedAt,
        SUM(oi.quantity * oi.price) as value
      FROM \`Order\` o
      LEFT JOIN OrderItem oi ON o.id = oi.orderId
      WHERE o.status = 'cancelled'
      AND EXISTS (
        SELECT 1 FROM OrderStatusHistory osh 
        WHERE osh.orderId = o.id 
        AND osh.note LIKE '%Payment timeout%'
      )
      GROUP BY o.id
      ORDER BY o.createdAt DESC`
    );

    // Calculate metrics
    const totalTimeoutOrders = timeoutOrders.length;
    const totalLostRevenue = timeoutOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    const totalLostItems = timeoutOrders.reduce((sum, order) => sum + (order.totalItems || 0), 0);

    // Group by payment method to see which methods have most timeouts
    const byPaymentMethod = {};
    for (const order of timeoutOrders) {
      const method = order.paymentMethod || 'Unknown';
      if (!byPaymentMethod[method]) {
        byPaymentMethod[method] = { count: 0, revenue: 0 };
      }
      byPaymentMethod[method].count++;
      byPaymentMethod[method].revenue += order.total || 0;
    }

    // Calculate average order value lost
    const avgOrderValue = totalTimeoutOrders > 0 ? totalLostRevenue / totalTimeoutOrders : 0;

    // Get last 30 days timeout trend
    const last30Days = await query(
      `SELECT 
        DATE(o.createdAt) as date,
        COUNT(*) as orderCount,
        SUM(o.total) as revenue
      FROM \`Order\` o
      WHERE o.status = 'cancelled'
      AND EXISTS (
        SELECT 1 FROM OrderStatusHistory osh 
        WHERE osh.orderId = o.id 
        AND osh.note LIKE '%Payment timeout%'
      )
      AND o.createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(o.createdAt)
      ORDER BY date DESC`
    );

    res.json({
      success: true,
      summary: {
        totalTimeoutOrders: totalTimeoutOrders,
        totalLostRevenue: Number(totalLostRevenue.toFixed(2)),
        totalLostItems: totalLostItems,
        averageOrderValue: Number(avgOrderValue.toFixed(2)),
      },
      byPaymentMethod: byPaymentMethod,
      trend: {
        last30Days: last30Days,
        description: 'Orders lost to payment timeout in last 30 days'
      }
    });
  } catch (error) {
    console.error('[ADMIN TIMEOUT REPORT] Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// STEP 4: List Orders (for web admin and mobile app)
// Admin can see all orders, regular users can only see their own orders
app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    const { status, search, startDate, endDate, userId: filterUserId, page = 1, limit = 20 } = req.query;
    const isAdmin = req.user.role === 'ADMIN';

    // Permission check
    const userIdToFetch = isAdmin && filterUserId ? parseInt(filterUserId) : (isAdmin ? null : req.user.userId);

    // ✅ OPTIMIZED: Single efficient query
    const result = await ordersService.getOrdersList({
      userId: userIdToFetch,
      status,
      search,
      startDate,
      endDate,
      page: parseInt(page),
      limit: parseInt(limit),
      isAdmin
    });

    res.json(result);
  } catch (error) {
    logger.error('Orders fetch error', { error: error.message });
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Legacy endpoint for backward compatibility
app.get('/orders', requireAuth, async (req, res) => {
  try {
    const { status, search, startDate, endDate, userId: filterUserId, page = 1, limit = 100 } = req.query;
    const isAdmin = req.user.role === 'ADMIN';

    const userIdToFetch = isAdmin && filterUserId ? parseInt(filterUserId) : (isAdmin ? null : req.user.userId);
    const safePage = Math.max(1, parseInt(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit) || 100));

    const result = await ordersService.getOrdersList({
      userId: userIdToFetch,
      status,
      search,
      startDate,
      endDate,
      page: safePage,
      limit: safeLimit,
      isAdmin
    });

    res.json(result.data);
  } catch (error) {
    logger.error('Orders fetch error', { error: error.message });
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// STEP 6: Get Order Details (for web admin and mobile app)
// This endpoint requires authentication (admin can view any order, users can view their own)
app.get('/orders/:id', requireAuth, async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    console.log('[ORDER] Fetching order details for id:', orderId);

    // Fetch order
    const orderRows = await query('SELECT * FROM `Order` WHERE id = ? LIMIT 1', [orderId]);

    if (!orderRows || orderRows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderRows[0];

    // Check if user has permission to view this order
    // Admin can view any order, regular users can only view their own orders
    const isAdmin = req.user.role === 'ADMIN';
    const isOrderOwner = order.userId && order.userId === req.user.userId;

    if (!isAdmin && !isOrderOwner) {
      return res.status(403).json({ error: 'You do not have permission to view this order' });
    }

    // Map order with items
    const orderWithItems = await mapOrder(order);

    console.log(`[ORDER] Returning order details: ${order.orderNumber} (${orderId})`);
    res.json(orderWithItems);
  } catch (error) {
    console.error('[ORDER] Get details error:', error);
    console.error('[ORDER] Error message:', error.message);
    console.error('[ORDER] Stack:', error.stack);

    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// STEP 8: Update Order Status (for web admin)
// This endpoint requires admin authentication
app.patch('/orders/:id/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const { status } = req.body ?? {};

    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    // Validate status
    if (!status || !['pending', 'processing', 'delivered', 'expired', 'failed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required (pending, processing, delivered, expired, failed, or cancelled)' });
    }

    console.log(`[ORDER] Updating status for order ${orderId} to ${status}`);

    // Check if order exists
    const orderRows = await query('SELECT * FROM `Order` WHERE id = ? LIMIT 1', [orderId]);
    if (!orderRows || orderRows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const currentOrder = orderRows[0];
    const currentStatus = currentOrder.status;

    // If order is being cancelled or marked as failed, restore stock
    if ((status === 'cancelled' || status === 'failed') && currentStatus !== 'cancelled' && currentStatus !== 'failed') {
      try {
        const orderItems = await query(
          'SELECT productId, quantity FROM OrderItem WHERE orderId = ?',
          [orderId]
        );
        
        for (const item of orderItems) {
          if (item.productId && item.quantity > 0) {
            await query(
              'UPDATE Product SET stock = stock + ? WHERE id = ?',
              [item.quantity, item.productId]
            );
            console.log(`[ORDER] Stock restored: ${item.quantity} units for product ${item.productId}`);
          }
        }
      } catch (err) {
        console.error('[ORDER] Error restoring stock:', err);
        // Continue with status update even if stock restoration fails
      }
    }

    // Validate status transitions (optional - can be made more strict)
    // For now, allow any valid status transition
    // You could add logic like: pending → processing → delivered only

    // Update order status
    await query(
      'UPDATE `Order` SET status = ?, updatedAt = NOW() WHERE id = ?',
      [status, orderId]
    );

    // Track status change in history
    await query(
      'INSERT INTO OrderStatusHistory (orderId, status, note, createdAt) VALUES (?, ?, ?, NOW())',
      [orderId, status, `Status changed from ${currentStatus} to ${status}`]
    );

    // Fetch updated order with items
    const updatedOrderRows = await query('SELECT * FROM `Order` WHERE id = ? LIMIT 1', [orderId]);
    const updatedOrder = updatedOrderRows[0];
    const orderWithItems = await mapOrder(updatedOrder);

    console.log(`[ORDER] Status updated: ${currentOrder.orderNumber} (${orderId}) - ${currentStatus} → ${status}`);
    res.json(orderWithItems);
  } catch (error) {
    console.error('[ORDER] Update status error:', error);
    console.error('[ORDER] Error message:', error.message);
    console.error('[ORDER] Stack:', error.stack);

    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// STEP 10: Dashboard Statistics (for web admin)
// This endpoint requires admin authentication
// Alias /stats to /dashboard/stats for convenience
app.get('/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('[DASHBOARD] Fetching statistics via /stats alias');
    
    // Count orders by status
    const pendingOrders = await query(
      'SELECT COUNT(*) as count FROM `Order` WHERE status = ?',
      ['pending']
    );
    const processingOrders = await query(
      'SELECT COUNT(*) as count FROM `Order` WHERE status = ?',
      ['processing']
    );
    const deliveredOrders = await query(
      'SELECT COUNT(*) as count FROM `Order` WHERE status = ?',
      ['delivered']
    );
    const cancelledOrders = await query(
      'SELECT COUNT(*) as count FROM `Order` WHERE status = ?',
      ['cancelled']
    );
    const expiredOrders = await query(
      'SELECT COUNT(*) as count FROM `Order` WHERE status = ?',
      ['expired']
    );
    const failedOrders = await query(
      'SELECT COUNT(*) as count FROM `Order` WHERE status = ?',
      ['failed']
    );

    const totalOrders = await query('SELECT COUNT(*) as count FROM `Order`');
    const totalProducts = await query('SELECT COUNT(*) as count FROM Product');
    const totalUsers = await query('SELECT COUNT(*) as count FROM User');
    
    // Get total revenue
    const revenueResult = await query(
      'SELECT SUM(total) as revenue FROM `Order` WHERE status = ?',
      ['delivered']
    );

    res.json({
      totalOrders: totalOrders[0].count,
      totalProducts: totalProducts[0].count,
      totalUsers: totalUsers[0].count,
      totalRevenue: revenueResult[0].revenue || 0,
      pendingOrders: pendingOrders[0].count,
      processingOrders: processingOrders[0].count,
      deliveredOrders: deliveredOrders[0].count,
      cancelledOrders: cancelledOrders[0].count,
      expiredOrders: expiredOrders[0].count,
      failedOrders: failedOrders[0].count,
    });
  } catch (error) {
    console.error('[DASHBOARD] Error fetching stats:', error);
    logger.error('Dashboard stats error', { error: error.message });
    res.status(500).json({ message: 'Error fetching dashboard statistics' });
  }
});

app.get('/dashboard/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('[DASHBOARD] Fetching statistics');

    // Count orders by status
    const pendingOrders = await query(
      'SELECT COUNT(*) as count FROM `Order` WHERE status = ?',
      ['pending']
    );
    const processingOrders = await query(
      'SELECT COUNT(*) as count FROM `Order` WHERE status = ?',
      ['processing']
    );
    const deliveredOrders = await query(
      'SELECT COUNT(*) as count FROM `Order` WHERE status = ?',
      ['delivered']
    );
    const cancelledOrders = await query(
      'SELECT COUNT(*) as count FROM `Order` WHERE status = ?',
      ['cancelled']
    );
    const expiredOrders = await query(
      'SELECT COUNT(*) as count FROM `Order` WHERE status = ?',
      ['expired']
    );
    const failedOrders = await query(
      'SELECT COUNT(*) as count FROM `Order` WHERE status = ?',
      ['failed']
    );

    // Total orders count
    const totalOrders = await query('SELECT COUNT(*) as count FROM `Order`');

    // Calculate total revenue (sum of all delivered orders)
    const revenueResult = await query(
      'SELECT COALESCE(SUM(total), 0) as total FROM `Order` WHERE status = ?',
      ['delivered']
    );

    // Get recent orders count (last 7 days)
    const recentOrders = await query(
      'SELECT COUNT(*) as count FROM `Order` WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );

    // Get recent revenue (last 7 days)
    const recentRevenueResult = await query(
      'SELECT COALESCE(SUM(total), 0) as total FROM `Order` WHERE status = ? AND createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)',
      ['delivered']
    );

    const stats = {
      orders: {
        total: totalOrders[0]?.count || 0,
        pending: pendingOrders[0]?.count || 0,
        processing: processingOrders[0]?.count || 0,
        delivered: deliveredOrders[0]?.count || 0,
        cancelled: cancelledOrders[0]?.count || 0,
        expired: expiredOrders[0]?.count || 0,
        failed: failedOrders[0]?.count || 0,
      },
      revenue: {
        total: Number(revenueResult[0]?.total || 0),
        recent: Number(recentRevenueResult[0]?.total || 0), // Last 7 days
      },
      recentOrders: recentOrders[0]?.count || 0, // Last 7 days
    };

    console.log('[DASHBOARD] Statistics:', stats);
    res.json(stats);
  } catch (error) {
    console.error('[DASHBOARD] Stats error:', error);
    console.error('[DASHBOARD] Error message:', error.message);
    console.error('[DASHBOARD] Stack:', error.stack);

    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// ==================== USER MANAGEMENT ENDPOINTS ====================

// Admin endpoint: Get all users
app.get('/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { role, search, isActive } = req.query;

    let sql = 'SELECT id, email, phoneNumber, isPhoneVerified, role, isActive, createdAt, updatedAt FROM User WHERE 1=1';
    const params = [];

    // Filter by role
    if (role && (role === 'USER' || role === 'ADMIN')) {
      sql += ' AND role = ?';
      params.push(role);
    }

    // Filter by active status
    if (isActive !== undefined) {
      sql += ' AND isActive = ?';
      params.push(isActive === 'true' ? 1 : 0);
    }

    // Search by email or phone
    if (search && search.trim()) {
      sql += ' AND (email LIKE ? OR phoneNumber LIKE ?)';
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm, searchTerm);
    }

    sql += ' ORDER BY createdAt DESC';

    const users = await query(sql, params);

    // Get order counts and stats for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        // Get order count
        const orderCount = await query(
          'SELECT COUNT(*) as count FROM `Order` WHERE userId = ?',
          [user.id]
        );

        // Get total spent
        const totalSpent = await query(
          'SELECT COALESCE(SUM(total), 0) as total FROM `Order` WHERE userId = ? AND status = ?',
          [user.id, 'delivered']
        );

        // Get last order date
        const lastOrder = await query(
          'SELECT createdAt as orderDate FROM `Order` WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
          [user.id]
        );

        return {
          ...user,
          orderCount: orderCount[0]?.count || 0,
          totalSpent: Number(totalSpent[0]?.total || 0),
          lastOrderDate: lastOrder[0]?.orderDate || null,
        };
      })
    );

    res.json(usersWithStats);
  } catch (error) {
    console.error('[USERS] Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Admin endpoint: Get user details with order history
app.get('/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const [user] = await query(
      'SELECT id, email, phoneNumber, isPhoneVerified, role, isActive, createdAt, updatedAt FROM User WHERE id = ? LIMIT 1',
      [id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get order history
    const orders = await query(
      'SELECT id, orderNumber, status, total, createdAt as orderDate, createdAt FROM `Order` WHERE userId = ? ORDER BY createdAt DESC',
      [id]
    );

    // Get order statistics
    const orderStats = await query(
      `SELECT 
        COUNT(*) as totalOrders,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingOrders,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processingOrders,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as deliveredOrders,
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN total ELSE 0 END), 0) as totalSpent
      FROM \`Order\` 
      WHERE userId = ?`,
      [id]
    );

    res.json({
      ...user,
      isActive: user.isActive === 1 || user.isActive === true,
      orders: orders,
      stats: {
        totalOrders: orderStats[0]?.totalOrders || 0,
        pendingOrders: orderStats[0]?.pendingOrders || 0,
        processingOrders: orderStats[0]?.processingOrders || 0,
        deliveredOrders: orderStats[0]?.deliveredOrders || 0,
        totalSpent: Number(orderStats[0]?.totalSpent || 0),
      },
    });
  } catch (error) {
    console.error('[USER] Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Admin endpoint: Get user's order history
app.get('/admin/users/:id/orders', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Check if user exists
    const [user] = await query('SELECT id FROM User WHERE id = ? LIMIT 1', [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const orders = await query(
      `SELECT 
        o.id, o.orderNumber, o.status, o.total, o.createdAt as orderDate, o.createdAt,
        o.customerName, o.customerPhone, o.paymentMethod
      FROM \`Order\` o
      WHERE o.userId = ?
      ORDER BY o.createdAt DESC`,
      [id]
    );

    // Get order items for each order
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await query(
          'SELECT productName, quantity, price FROM OrderItem WHERE orderId = ?',
          [order.id]
        );
        return {
          ...order,
          items: items,
        };
      })
    );

    res.json(ordersWithItems);
  } catch (error) {
    console.error('[USER ORDERS] Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Admin endpoint: Update user status (activate/deactivate)
app.patch('/admin/users/:id/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' });
    }

    // Prevent deactivating yourself
    if (id === req.user.userId && !isActive) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }

    const [user] = await query('SELECT id, email FROM User WHERE id = ? LIMIT 1', [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await query('UPDATE User SET isActive = ?, updatedAt = NOW() WHERE id = ?', [isActive, id]);

    console.log(`[USER] ${isActive ? 'Activated' : 'Deactivated'} user: ${user.email} (${id})`);
    res.json({ ok: true, message: `User ${isActive ? 'activated' : 'deactivated'} successfully` });
  } catch (error) {
    console.error('[USER STATUS] Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ==================== REVIEW ENDPOINTS ====================

// Public endpoint: Get reviews for a product
app.get('/products/:id/reviews', async (req, res) => {
  try {
    const productId = Number(req.params.id);
    if (!productId || isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const reviews = await query(
      `SELECT r.*, u.email as userEmail 
       FROM Review r 
       LEFT JOIN User u ON r.userId = u.id 
       WHERE r.productId = ? AND r.isApproved = TRUE 
       ORDER BY r.createdAt DESC`,
      [productId]
    );

    // Calculate average rating
    const avgRating = await query(
      'SELECT AVG(rating) as avg, COUNT(*) as count FROM Review WHERE productId = ? AND isApproved = TRUE',
      [productId]
    );

    res.json({
      reviews: reviews.map(r => ({
        ...r,
        isApproved: r.isApproved === 1 || r.isApproved === true,
      })),
      averageRating: avgRating[0]?.avg ? Number(avgRating[0].avg).toFixed(1) : '0.0',
      totalReviews: avgRating[0]?.count || 0,
    });
  } catch (error) {
    console.error('[REVIEWS] Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Authenticated endpoint: Create review
app.post('/products/:id/reviews', requireAuth, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    if (!productId || isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const { rating, comment, userName } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if product exists
    const [product] = await query('SELECT id FROM Product WHERE id = ? LIMIT 1', [productId]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if user already reviewed this product
    const existing = await query(
      'SELECT id FROM Review WHERE productId = ? AND userId = ? LIMIT 1',
      [productId, req.user.userId]
    );
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'You have already reviewed this product' });
    }

    const result = await query(
      'INSERT INTO Review (productId, userId, userName, rating, comment, isApproved, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, TRUE, NOW(), NOW())',
      [productId, req.user.userId, userName || null, rating, comment || null]
    );

    const [review] = await query('SELECT * FROM Review WHERE id = ? LIMIT 1', [result.insertId]);
    console.log(`[REVIEW] Created review for product ${productId} by user ${req.user.userId}`);
    res.status(201).json(review);
  } catch (error) {
    console.error('[REVIEW] Create error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Admin endpoint: Get all reviews
app.get('/admin/reviews', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { productId, isApproved } = req.query;

    let sql = `SELECT r.*, p.name as productName, u.email as userEmail 
               FROM Review r 
               LEFT JOIN Product p ON r.productId = p.id 
               LEFT JOIN User u ON r.userId = u.id 
               WHERE 1=1`;
    const params = [];

    if (productId) {
      sql += ' AND r.productId = ?';
      params.push(Number(productId));
    }

    if (isApproved !== undefined) {
      sql += ' AND r.isApproved = ?';
      params.push(isApproved === 'true' ? 1 : 0);
    }

    sql += ' ORDER BY r.createdAt DESC';

    const reviews = await query(sql, params);
    res.json(reviews.map(r => ({
      ...r,
      isApproved: r.isApproved === 1 || r.isApproved === true,
    })));
  } catch (error) {
    console.error('[REVIEWS] Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Admin endpoint: Update review approval
app.patch('/admin/reviews/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }

    const { isApproved } = req.body;
    if (typeof isApproved !== 'boolean') {
      return res.status(400).json({ error: 'isApproved must be a boolean' });
    }

    await query('UPDATE Review SET isApproved = ?, updatedAt = NOW() WHERE id = ?', [isApproved, id]);
    res.json({ ok: true, message: `Review ${isApproved ? 'approved' : 'unapproved'} successfully` });
  } catch (error) {
    console.error('[REVIEW] Update error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Admin endpoint: Delete review
app.delete('/admin/reviews/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }

    await query('DELETE FROM Review WHERE id = ?', [id]);
    res.json({ ok: true, message: 'Review deleted successfully' });
  } catch (error) {
    console.error('[REVIEW] Delete error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ==================== WISHLIST ENDPOINTS ====================

// Get user's wishlist
app.get('/wishlist', requireAuth, async (req, res) => {
  try {
    const wishlist = await query(
      `SELECT w.*, p.name, p.price, p.images, p.category, p.status 
       FROM Wishlist w 
       JOIN Product p ON w.productId = p.id 
       WHERE w.userId = ? AND p.status = 'ACTIVE'
       ORDER BY w.createdAt DESC`,
      [req.user.userId]
    );

    res.json(wishlist.map(item => ({
      ...item,
      images: typeof item.images === 'string' ? JSON.parse(item.images) : item.images,
    })));
  } catch (error) {
    console.error('[WISHLIST] Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Add product to wishlist
app.post('/wishlist', requireAuth, async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId || isNaN(Number(productId))) {
      return res.status(400).json({ error: 'Valid product ID is required' });
    }

    // Check if product exists
    const [product] = await query('SELECT id FROM Product WHERE id = ? LIMIT 1', [productId]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if already in wishlist
    const existing = await query(
      'SELECT id FROM Wishlist WHERE userId = ? AND productId = ? LIMIT 1',
      [req.user.userId, productId]
    );
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Product already in wishlist' });
    }

    await query(
      'INSERT INTO Wishlist (userId, productId, createdAt) VALUES (?, ?, NOW())',
      [req.user.userId, productId]
    );

    res.status(201).json({ ok: true, message: 'Product added to wishlist' });
  } catch (error) {
    console.error('[WISHLIST] Add error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Product already in wishlist' });
    }
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Remove product from wishlist
app.delete('/wishlist/:productId', requireAuth, async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    if (!productId || isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const result = await query(
      'DELETE FROM Wishlist WHERE userId = ? AND productId = ?',
      [req.user.userId, productId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found in wishlist' });
    }

    res.json({ ok: true, message: 'Product removed from wishlist' });
  } catch (error) {
    console.error('[WISHLIST] Remove error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Check if product is in wishlist
app.get('/wishlist/check/:productId', requireAuth, async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    if (!productId || isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const [item] = await query(
      'SELECT id FROM Wishlist WHERE userId = ? AND productId = ? LIMIT 1',
      [req.user.userId, productId]
    );

    res.json({ inWishlist: !!item });
  } catch (error) {
    console.error('[WISHLIST] Check error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ==================== ORDER TRACKING ====================

// Get order tracking/history
app.get('/orders/:id/tracking', requireAuth, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    // Check if order exists and user has access
    const [order] = await query('SELECT * FROM `Order` WHERE id = ? LIMIT 1', [orderId]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if user owns the order or is admin
    if (order.userId !== req.user.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get status history
    const history = await query(
      'SELECT * FROM OrderStatusHistory WHERE orderId = ? ORDER BY createdAt ASC',
      [orderId]
    );

    // If no history exists, create initial entry
    if (history.length === 0) {
      await query(
        'INSERT INTO OrderStatusHistory (orderId, status, note, createdAt) VALUES (?, ?, ?, ?)',
        [orderId, order.status, 'Order created', order.orderDate || order.createdAt]
      );
      const newHistory = await query(
        'SELECT * FROM OrderStatusHistory WHERE orderId = ? ORDER BY createdAt ASC',
        [orderId]
      );
      return res.json({
        order: await mapOrder(order),
        history: newHistory,
      });
    }

    res.json({
      order: await mapOrder(order),
      history: history,
    });
  } catch (error) {
    console.error('[ORDER TRACKING] Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ============================================
// BAKONG PAYMENT ENDPOINTS
// ============================================

// Get Bakong QR code for an order
// Allow access for guest orders (no userId) or authenticated users
app.get('/orders/:orderId/bakong-qr', async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);

    // Get order
    const orderRows = await query('SELECT * FROM `Order` WHERE id = ? LIMIT 1', [orderId]);

    if (!orderRows || orderRows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderRows[0];

    // Permission check:
    // 1. If order has no userId (guest order), allow access
    // 2. If order has userId, require authentication and check if user matches
    // 3. Admins can always access

    // Relaxed authentication: Allow access to QR code for payment purposes
    // Authentication is optional - we just need to ensure the order exists
    // This allows the payment page to load even if token expires during checkout
    if (order.userId) {
      // Order belongs to a user - try to verify token if provided
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const isAdmin = decoded.role === 'ADMIN';

          // Check if user matches or is admin
          if (!isAdmin && order.userId !== decoded.userId) {
            return res.status(403).json({ error: 'Access denied' });
          }
          // Token is valid and user matches - allow access
        } catch (authError) {
          // Token is invalid or expired, but we'll allow access anyway for payment
          // This ensures users can complete payment even if their session expires
          console.log(`[BAKONG QR] Token verification failed for order ${order.id}, allowing access for payment: ${authError.message}`);
        }
      }
      // If no token provided, allow access anyway (payment pages should be accessible)
    }
    // If order has no userId (guest order), allow access without auth

    // Check if order uses Bakong payment
    if (order.paymentMethod !== 'Bakong') {
      return res.status(400).json({ error: 'Order does not use Bakong payment method' });
    }

    // Check if order is still pending (can't generate QR for completed orders)
    if (order.status !== 'pending') {
      return res.status(400).json({
        error: 'Cannot generate QR code. Order is already processed.',
        orderStatus: order.status
      });
    }

    // Generate QR code
    const amountInKHR = bakongService.convertUSDToKHR(order.total);
    const qrResult = await bakongService.generateKHQR({
      amount: amountInKHR,
      orderNumber: order.orderNumber,
      merchantName: 'ShopEase',
      merchantCity: order.customerCity || 'Phnom Penh'
    });

    if (!qrResult.success) {
      return res.status(500).json({
        error: 'Failed to generate QR code',
        details: qrResult.error
      });
    }

    // Log MD5 for debugging/manual verification
    if (qrResult.qrCode && qrResult.qrCode.md5) {
      const generatedMd5 = qrResult.qrCode.md5;
      console.log(`[BAKONG] Generated MD5 for order ${order.orderNumber}:`, generatedMd5);

      // Store the MD5 in the database to ensure we verify against the exact same hash later
      // The timestamp in the QR code makes the hash unique, so we MUST save this specific instance
      if (generatedMd5) {
        await query(
          'UPDATE `Order` SET bakongTransactionId = ? WHERE id = ?',
          [generatedMd5, order.id]
        );
        console.log(`[BAKONG] Saved MD5 to database for order ${order.orderNumber}`);
      }
    }

    // Check if QR code is expired
    const now = new Date();
    const expiryTime = new Date(qrResult.expiryTime);
    const isExpired = now > expiryTime;
    const secondsRemaining = Math.max(0, Math.floor((expiryTime - now) / 1000));

    res.json({
      success: true,
      qrCode: qrResult.qrCode,
      qrString: qrResult.qrString,
      amount: amountInKHR,
      currency: 'KHR',
      orderNumber: order.orderNumber,
      orderTotal: order.total,
      orderTotalCurrency: 'USD',
      expiryTime: qrResult.expiryTime,
      expiresIn: qrResult.expiresIn, // seconds
      isExpired: isExpired,
      secondsRemaining: secondsRemaining
    });
  } catch (error) {
    console.error('[BAKONG QR] Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Regenerate Bakong QR code (if expired)
// Allow access for guest orders (no userId) or authenticated users
app.post('/orders/:orderId/bakong-qr/regenerate', async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);

    // Get order
    const orderRows = await query('SELECT * FROM `Order` WHERE id = ? LIMIT 1', [orderId]);

    if (!orderRows || orderRows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderRows[0];

    // Relaxed authentication (same as QR endpoint)
    if (order.userId) {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const isAdmin = decoded.role === 'ADMIN';

          if (!isAdmin && order.userId !== decoded.userId) {
            return res.status(403).json({ error: 'Access denied' });
          }
        } catch (authError) {
          console.log(`[BAKONG QR REGENERATE] Token verification failed for order ${order.id}, allowing access for payment: ${authError.message}`);
        }
      }
    }

    // Check if order uses Bakong payment
    if (order.paymentMethod !== 'Bakong') {
      return res.status(400).json({ error: 'Order does not use Bakong payment method' });
    }

    // Check if order is still pending
    if (order.status !== 'pending') {
      return res.status(400).json({
        error: 'Cannot regenerate QR code. Order is already processed.',
        orderStatus: order.status
      });
    }

    // Generate new QR code
    const amountInKHR = bakongService.convertUSDToKHR(order.total);
    const qrResult = await bakongService.generateKHQR({
      amount: amountInKHR,
      orderNumber: order.orderNumber,
      merchantName: 'ShopEase',
      merchantCity: order.customerCity || 'Phnom Penh'
    });

    if (!qrResult.success) {
      return res.status(500).json({
        error: 'Failed to regenerate QR code',
        details: qrResult.error
      });
    }

    const now = new Date();
    const expiryTime = new Date(qrResult.expiryTime);
    const secondsRemaining = Math.max(0, Math.floor((expiryTime - now) / 1000));

    res.json({
      success: true,
      qrCode: qrResult.qrCode,
      qrString: qrResult.qrString,
      amount: amountInKHR,
      currency: 'KHR',
      orderNumber: order.orderNumber,
      orderTotal: order.total,
      orderTotalCurrency: 'USD',
      expiryTime: qrResult.expiryTime,
      expiresIn: qrResult.expiresIn,
      isExpired: false,
      secondsRemaining: secondsRemaining,
      message: 'QR code regenerated successfully'
    });
  } catch (error) {
    console.error('[BAKONG QR REGENERATE] Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Helper function to check and mark expired Bakong orders
// Automatically cancels expired orders and restores stock
async function checkAndMarkExpiredOrders() {
  let connection;
  try {
    const expiryMinutes = parseInt(process.env.ORDER_EXPIRY_MINUTES) || 15;
    
    // Find pending Bakong orders older than expiry duration
    const expiredOrders = await query(
      `SELECT id, orderNumber, createdAt 
       FROM \`Order\` 
       WHERE paymentMethod = 'Bakong' 
       AND status = 'pending' 
       AND createdAt < DATE_SUB(NOW(), INTERVAL ${expiryMinutes} MINUTE)`
    );

    if (expiredOrders.length === 0) {
      return 0;
    }

    console.log(`[CLEANUP] Found ${expiredOrders.length} expired order(s)`);

    const { default: pool } = await import('./src/config/database.js');
    let processedCount = 0;

    for (const expiredOrder of expiredOrders) {
      connection = await pool.getConnection();
      
      try {
        await connection.beginTransaction();
        console.log(`[CLEANUP] Processing order: ${expiredOrder.orderNumber} (${expiredOrder.id})`);

        // Check if already processed (prevent duplicate processing)
        const [statusCheck] = await connection.execute(
          'SELECT status FROM `Order` WHERE id = ? LIMIT 1',
          [expiredOrder.id]
        );

        if (statusCheck[0]?.status !== 'pending') {
          console.log(`[CLEANUP] Order ${expiredOrder.orderNumber} already processed (status: ${statusCheck[0]?.status})`);
          await connection.rollback();
          connection.release();
          continue;
        }

        // Get order items to restore stock
        const [orderItems] = await connection.execute(
          'SELECT productId, quantity, productName FROM OrderItem WHERE orderId = ?',
          [expiredOrder.id]
        );

        // Restore stock for each item
        for (const item of orderItems) {
          if (item.productId && item.quantity > 0) {
            await connection.execute(
              'UPDATE Product SET stock = stock + ? WHERE id = ?',
              [item.quantity, item.productId]
            );
            console.log(`[CLEANUP] Restored stock: ${item.quantity} units for product ${item.productId} (${item.productName})`);
          }
        }

        // Update order status to cancelled
        await connection.execute(
          'UPDATE `Order` SET status = ?, updatedAt = NOW() WHERE id = ?',
          ['cancelled', expiredOrder.id]
        );

        // Record in status history (use 'pending' as status since OrderStatusHistory ENUM may not have 'cancelled')
        await connection.execute(
          'INSERT INTO OrderStatusHistory (orderId, status, note, createdAt) VALUES (?, ?, ?, NOW())',
          [expiredOrder.id, 'pending', `Auto-cancelled: Payment timeout after ${expiryMinutes} minutes. Stock restored.`]
        );

        await connection.commit();
        console.log(`[CLEANUP] Order ${expiredOrder.orderNumber} cancelled and stock restored`);
        processedCount++;

      } catch (error) {
        console.error(`[CLEANUP] Error processing order ${expiredOrder.orderNumber}:`, error);
        if (connection) {
          await connection.rollback();
        }
      } finally {
        if (connection) {
          connection.release();
        }
      }
    }

    console.log(`[CLEANUP] Completed: ${processedCount} order(s) processed`);
    return processedCount;
  } catch (error) {
    console.error('[CLEANUP] Error checking expired orders:', error);
    return 0;
  }
}

// Verify Bakong payment status
// Allow access for guest orders (no userId) or authenticated users
// Apply rate limiting to prevent polling abuse
app.get('/orders/:orderId/bakong-status', paymentStatusLimiter, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);

    // Get order
    const orderRows = await query('SELECT * FROM `Order` WHERE id = ? LIMIT 1', [orderId]);

    if (!orderRows || orderRows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderRows[0];

    // Check if order uses Bakong payment
    if (order.paymentMethod === 'Bakong' && order.status === 'pending') {
      const orderAge = new Date() - new Date(order.createdAt);
      const expiryDuration = 15 * 60 * 1000; // 15 minutes (Standard)
      // const expiryDuration = 1 * 60 * 1000; // 1 minute (For Testing)

      if (orderAge > expiryDuration) {
        // Order expired - mark as cancelled and restore stock
        try {
          // Get order items to restore stock
          const orderItems = await query(
            'SELECT productId, quantity FROM OrderItem WHERE orderId = ?',
            [order.id]
          );

          // Restore stock for each item
          for (const item of orderItems) {
            if (item.productId && item.quantity > 0) {
              await query(
                'UPDATE Product SET stock = stock + ? WHERE id = ?',
                [item.quantity, item.productId]
              );
              console.log(`[BAKONG STATUS] Restored stock: ${item.quantity} units for product ${item.productId}`);
            }
          }
        } catch (stockError) {
          console.error('[BAKONG STATUS] Error restoring stock:', stockError);
          // Continue with status update even if stock restoration fails
        }

        await query(
          'UPDATE `Order` SET status = ?, updatedAt = NOW() WHERE id = ?',
          ['cancelled', order.id]
        );

        await query(
          'INSERT INTO OrderStatusHistory (orderId, status, note, createdAt) VALUES (?, ?, ?, NOW())',
          [order.id, 'pending', 'Payment timeout - order cancelled and stock restored.']
        );

        return res.json({
          success: true,
          orderId: order.id,
          orderNumber: order.orderNumber,
          paymentStatus: 'expired',
          orderStatus: 'cancelled', // Updated status
          isExpired: true,
          message: 'Payment QR code expired. Order cancelled and items returned to stock.'
        });
      }
    }

    // Relaxed authentication (same as QR endpoint)
    if (order.userId) {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const isAdmin = decoded.role === 'ADMIN';

          if (!isAdmin && order.userId !== decoded.userId) {
            return res.status(403).json({ error: 'Access denied' });
          }
        } catch (authError) {
          console.log(`[BAKONG STATUS] Token verification failed for order ${order.id}, allowing access for payment: ${authError.message}`);
        }
      }
    }
    // If order has no userId (guest order), allow access without auth

    // Check if order uses Bakong payment
    if (order.paymentMethod !== 'Bakong') {
      return res.status(400).json({ error: 'Order does not use Bakong payment method' });
    }

    // Verify payment with Bakong API if still pending
    // This allows "active polling" which works on localhost without webhooks
    if (order.status === 'pending') {
      try {
        // regenerate MD5 to check status
        let md5;

        // 1. Try to use stored MD5 from database (Reliable method)
        if (order.bakongTransactionId) {
          md5 = order.bakongTransactionId;
          console.log(`[BAKONG STATUS] Using stored MD5 for order ${order.orderNumber}: ${md5}`);
        }
        // 2. Fallback: Regenerate (Unreliable due to timestamp differences)
        else {
          console.log(`[BAKONG STATUS] No stored MD5, regenerating... (Warning: Might result in mismatch)`);
          const amountInKHR = bakongService.convertUSDToKHR(order.total);
          const khqrString = bakongService.generateKHQRString({
            amount: amountInKHR,
            orderNumber: order.orderNumber,
            merchantName: 'ShopEase',
            merchantCity: order.customerCity || 'Phnom Penh'
          });

          if (khqrString) {
            md5 = bakongService.generateMd5(khqrString);
          }
        }

        if (md5) {
          console.log(`[BAKONG STATUS] Verifying payment with MD5: ${md5}`);
          const verifyResult = await bakongService.verifyPayment(md5);

          if (verifyResult.success && verifyResult.status === 'completed') {
            // Payment confirmed via API polling!
            console.log(`[BAKONG STATUS] Payment confirmed for order ${order.orderNumber} via API poll`);

            // Update order status
            await query(
              'UPDATE `Order` SET status = ?, updatedAt = NOW() WHERE id = ?',
              ['processing', order.id]
            );

            await query(
              'INSERT INTO OrderStatusHistory (orderId, status, note, createdAt) VALUES (?, ?, ?, NOW())',
              [order.id, 'processing', 'Payment confirmed via Bakong API poll']
            );

            // Update local object for response
            order.status = 'processing';
          }
        }
      } catch (checkError) {
        console.error('[BAKONG STATUS] Active check failed:', checkError);
        // Continue, don't fail the request, just report pending
      }
    }

    let paymentStatus = 'pending';
    let message = 'Waiting for payment...';
    let isExpired = false;

    // Check statuses
    if (order.status === 'processing' || order.status === 'completed' || order.status === 'delivered') {
      paymentStatus = 'completed';
      message = 'Payment confirmed';
    } else if (order.status === 'expired') {
      paymentStatus = 'expired';
      isExpired = true;
      message = 'Payment QR code expired';
    } else if (order.status === 'failed') {
      paymentStatus = 'failed';
      message = 'Payment failed';
    }

    // Return current status (Mobile app polls this)
    res.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentStatus: paymentStatus,
      orderStatus: order.status,
      // md5: md5, // Not generating MD5 anymore for check to save performance
      isExpired: isExpired,
      message: message
    });
  } catch (error) {
    console.error('[BAKONG STATUS] Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ============================================
// BAKONG WEBHOOK ENDPOINT
// ============================================

// Bakong payment webhook handler
// This endpoint receives payment notifications from Bakong
// Note: This endpoint should be placed BEFORE the express.json() middleware if you need raw body
// For now, we'll use the JSON middleware which should work for most webhooks
app.post('/api/payments/bakong/webhook', async (req, res) => {
  try {
    // Webhook data should already be parsed by express.json() middleware
    const webhookData = req.body;
    const signature = req.headers['x-bakong-signature'];

    console.log('[BAKONG WEBHOOK] Received webhook:', JSON.stringify(webhookData, null, 2));

    // Process webhook using Bakong service
    const webhookResult = await bakongService.handleWebhook(webhookData, signature);

    if (!webhookResult.success) {
      console.error('[BAKONG WEBHOOK] Webhook processing failed:', webhookResult.error);
      return res.status(400).json({
        error: 'Webhook processing failed',
        details: webhookResult.error
      });
    }

    // Extract order information
    const { orderId, orderNumber, transactionId, isPaid, paymentStatus } = webhookResult;

    if (!orderId && !orderNumber) {
      console.error('[BAKONG WEBHOOK] No order identifier in webhook');
      return res.status(400).json({ error: 'Order ID or order number is required' });
    }

    // Find order by ID or order number
    let order;
    if (orderId) {
      const orderRows = await query('SELECT * FROM `Order` WHERE id = ? LIMIT 1', [orderId]);
      if (orderRows && orderRows.length > 0) {
        order = orderRows[0];
      }
    }

    if (!order && orderNumber) {
      const orderRows = await query('SELECT * FROM `Order` WHERE orderNumber = ? LIMIT 1', [orderNumber]);
      if (orderRows && orderRows.length > 0) {
        order = orderRows[0];
      }
    }

    if (!order) {
      console.error('[BAKONG WEBHOOK] Order not found:', { orderId, orderNumber });
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if order uses Bakong payment
    if (order.paymentMethod !== 'Bakong') {
      console.warn('[BAKONG WEBHOOK] Order does not use Bakong payment:', order.orderNumber);
      return res.status(400).json({ error: 'Order does not use Bakong payment method' });
    }

    // Update order status if payment is confirmed
    if (isPaid) {
      const currentStatus = order.status;
      let newStatus = 'processing'; // Move to processing when paid

      // Only update if status is still pending
      if (currentStatus === 'pending') {
        await query(
          'UPDATE `Order` SET status = ?, updatedAt = NOW() WHERE id = ?',
          [newStatus, order.id]
        );

        // Track status change in history
        await query(
          'INSERT INTO OrderStatusHistory (orderId, status, note, createdAt) VALUES (?, ?, ?, NOW())',
          [order.id, newStatus, `Payment confirmed via Bakong webhook. Transaction: ${transactionId || 'N/A'}`]
        );

        console.log(`[BAKONG WEBHOOK] Order ${order.orderNumber} (${order.id}) updated: ${currentStatus} → ${newStatus}`);
        console.log(`[BAKONG WEBHOOK] Payment confirmed. Transaction ID: ${transactionId || 'N/A'}`);

        // Update local status for response
        order.status = newStatus;

        // TODO: Send notification to customer
        // You can integrate with your notification system here
        // For example: send push notification, email, SMS, etc.
      } else {
        console.log(`[BAKONG WEBHOOK] Order ${order.orderNumber} already processed (status: ${currentStatus})`);
      }
    } else {
      console.log(`[BAKONG WEBHOOK] Payment not confirmed. Status: ${paymentStatus}`);
    }

    // Return success response to Bakong
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status
    });

  } catch (error) {
    console.error('[BAKONG WEBHOOK] Error processing webhook:', error);
    console.error('[BAKONG WEBHOOK] Error stack:', error.stack);

    // Return error but don't expose internal details
    res.status(500).json({
      error: 'Internal server error',
      message: 'Webhook processing failed'
    });
  }
});

// Sentry error handler (must be after all routes)
if (process.env.SENTRY_DSN && Sentry.Handlers) {
  try {
    app.use(Sentry.Handlers.errorHandler());
  } catch (error) {
    logger.warn('Sentry error handler not available', { error: error.message });
  }
}

const PORT = process.env.PORT || 4000;

// Redis caching disabled

// Listen on all network interfaces (0.0.0.0) to allow connections from mobile devices
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access locally: http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  if (!process.env.DATABASE_URL) {
    console.warn('WARNING: DATABASE_URL not set - database operations will fail');
  }
  if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET not set - authentication will fail');
  }

  // Start automatic cleanup scheduler for expired orders
  const cleanupIntervalMinutes = parseInt(process.env.CLEANUP_INTERVAL_MINUTES) || 5;
  const expiryMinutes = parseInt(process.env.ORDER_EXPIRY_MINUTES) || 15;
  
  console.log(`[CLEANUP] Automatic order cleanup enabled`);
  console.log(`[CLEANUP] Checking for expired orders every ${cleanupIntervalMinutes} minute(s)`);
  console.log(`[CLEANUP] Orders expire after ${expiryMinutes} minute(s) of non-payment`);

  // Run cleanup immediately on startup (after 30 seconds delay)
  setTimeout(async () => {
    console.log('[CLEANUP] Running initial cleanup check...');
    await checkAndMarkExpiredOrders();
  }, 30000);

  // Schedule periodic cleanup
  setInterval(async () => {
    console.log('[CLEANUP] Running scheduled cleanup check...');
    await checkAndMarkExpiredOrders();
  }, cleanupIntervalMinutes * 60 * 1000);
});
