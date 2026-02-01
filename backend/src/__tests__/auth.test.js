import request from 'supertest';
import { createServer } from '../../server.js';

describe('Auth Routes', () => {
  let app;

  beforeAll(async () => {
    app = await createServer();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: `test-${Date.now()}@example.com`,
          password: 'TestPassword123!',
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('role');
      expect(response.body).toHaveProperty('userId');
    });

    it('should reject duplicate email', async () => {
      const email = `test-${Date.now()}@example.com`;
      
      // Register first user
      await request(app)
        .post('/api/auth/register')
        .send({ email, password: 'TestPassword123!' })
        .expect(201);

      // Try to register same email
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email, password: 'TestPassword123!' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toMatch(/already exists|duplicate/i);
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: 'TestPassword123!',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/auth/login', () => {
    let testEmail;
    let testPassword = 'TestPassword123!';

    beforeEach(async () => {
      testEmail = `test-${Date.now()}@example.com`;
      await request(app)
        .post('/api/auth/register')
        .send({ email: testEmail, password: testPassword });
    });

    it('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('role', 'USER');
    });

    it('should reject wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'WrongPassword123!' })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toMatch(/incorrect|invalid/i);
    });

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: testPassword })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('JWT Token Validation', () => {
    let token;
    let testEmail;
    let testPassword = 'TestPassword123!';

    beforeEach(async () => {
      testEmail = `test-${Date.now()}@example.com`;
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({ email: testEmail, password: testPassword });
      
      token = registerResponse.body.token;
    });

    it('should accept valid JWT token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('email', testEmail);
      expect(response.body).toHaveProperty('role', 'USER');
    });

    it('should reject missing token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toMatch(/token|unauthorized/i);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token-here')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});
