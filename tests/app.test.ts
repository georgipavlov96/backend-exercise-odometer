import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app';

describe('GET /health', () => {
  let server: Server;

  beforeAll((done) => {
    server = app.listen(0, '127.0.0.1', done);
  });

  afterAll((done) => {
    server.close(done);
  });

  it('returns a healthy JSON response', async () => {
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      headers: { Connection: 'close' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });
});
