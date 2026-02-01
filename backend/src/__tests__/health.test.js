import request from 'supertest';
import { createServer } from '../../server.js';

describe('Health Check Endpoints', () => {
  let app;

  beforeAll(async () => {
    app = await createServer();
  });

  describe('GET /health', () => {
    it('should return 200 with health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('GET /ready', () => {
    it('should return 200 when database is ready', async () => {
      const response = await request(app)
        .get('/ready')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ready');
      expect(response.body.checks).toHaveProperty('database', 'ok');
    });
  });
});
