import request from 'supertest';
import app from '../src/app';

describe('Health Controller', () => {
  describe('GET /health', () => {
    it('should return 200 OK and a basic health check response', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ok');
    });
  });

  describe('GET /health/details', () => {
    it('should return 200 OK and a detailed health check response', async () => {
      const res = await request(app).get('/health/details');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ok).toBeDefined();
      expect(res.body.data.services).toBeDefined();
    });
  });
});