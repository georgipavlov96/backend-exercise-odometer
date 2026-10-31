import request from 'supertest';
import { app } from '../src/app';

describe('GET /health', () => {
  it('returns a healthy JSON response', async () => {
    await request(app)
      .get('/health')
      .expect(200)
      .expect('Content-Type', /application\/json/)
      .expect({ status: 'ok' });
  });
});
