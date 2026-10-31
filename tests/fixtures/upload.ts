import request from 'supertest';
import { app } from '../../src/app';

// A valid 1x1 PNG is sufficient to exercise upload validation.
export const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);

export function postReading() {
  return request(app).post('/odometer/reading');
}
