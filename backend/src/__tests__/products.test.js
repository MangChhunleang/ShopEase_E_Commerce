import request from 'supertest';
import { createServer } from '../../server.js';

describe('Product Routes', () => {
  let app;
  let adminToken;
  let adminId;

  beforeAll(async () => {
    app = await createServer();

    // Create admin user for testing
    const adminResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'admin@test.com',
        password: 'AdminPassword123!',
      });

    adminToken = adminResponse.body.token;
    adminId = adminResponse.body.userId;
  });

  describe('POST /api/products', () => {
    it('should create a new product', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Product',
          description: 'A test product',
          price: 29.99,
          stock: 100,
          category: 'Electronics',
          status: 'ACTIVE',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', 'Test Product');
      expect(response.body).toHaveProperty('price', '29.99');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Product',
          // Missing required fields
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject duplicate product name', async () => {
      const productData = {
        name: `Product-${Date.now()}`,
        description: 'Test',
        price: 19.99,
        stock: 50,
      };

      // Create first product
      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(productData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(productData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/products', () => {
    it('should retrieve all products', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/products?page=1&limit=10')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should support filtering by category', async () => {
      const response = await request(app)
        .get('/api/products?category=Electronics')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/products/:id', () => {
    let productId;

    beforeAll(async () => {
      const createResponse = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Product-${Date.now()}`,
          description: 'Test product',
          price: 49.99,
          stock: 25,
        });

      productId = createResponse.body.id;
    });

    it('should retrieve a product by id', async () => {
      const response = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', productId);
      expect(response.body).toHaveProperty('name');
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .get('/api/products/999999')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('PUT /api/products/:id', () => {
    let productId;

    beforeAll(async () => {
      const createResponse = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Product-${Date.now()}`,
          price: 39.99,
          stock: 50,
        });

      productId = createResponse.body.id;
    });

    it('should update a product', async () => {
      const response = await request(app)
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          price: 59.99,
          stock: 30,
        })
        .expect(200);

      expect(response.body).toHaveProperty('price', '59.99');
      expect(response.body).toHaveProperty('stock', 30);
    });
  });

  describe('DELETE /api/products/:id', () => {
    let productId;

    beforeAll(async () => {
      const createResponse = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Product-${Date.now()}`,
          price: 9.99,
          stock: 10,
        });

      productId = createResponse.body.id;
    });

    it('should delete a product', async () => {
      await request(app)
        .delete(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify it's deleted
      const response = await request(app)
        .get(`/api/products/${productId}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});
