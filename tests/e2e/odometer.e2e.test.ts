import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import { app } from '../../src/app';

/**
 * @jest-environment node
 */

const CONFIDENCE_LEVELS = ['high', 'med', 'low'];

describe('POST /odometer/reading with OpenAI', () => {
  beforeAll(() => {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw new Error('OPENAI_API_KEY is required to run the real OCR E2E tests');
    }
    process.env.OCR_PROVIDER = 'openai';
  });

  it.each([
    { filename: '33c24909-e9dd-46d3-8e7f-c44fd9896537.jpeg', reading: 62690.5, format: 'multipart' },
    { filename: '3ae9d173-8895-409e-844c-77b5841138d7.jpeg', reading: 161967, format: 'base64' },
    { filename: 'd621e37e-7c0f-49a4-8a19-d628b1e82a33.jpeg', reading: 154510, format: 'multipart' },
    { filename: 'dbab9932-823e-49ed-80db-1e898d836d5e.jpeg', reading: 205265, format: 'base64' },
  ])('reads $reading from $filename via $format', async ({ filename, reading, format }) => {
    const image = await readFile(join(__dirname, '../../images', filename));
    const upload = request(app).post('/odometer/reading');
    if (format === 'multipart') {
      upload.attach('image', image, 'odometer.jpeg');
    } else {
      upload.send({ image: image.toString('base64') });
    }

    const { body } = await upload.expect('Content-Type', /json/).expect(200);
    expect(body.reading).toBe(reading);
    expect(['miles', 'km']).toContain(body.unit);
    expect(CONFIDENCE_LEVELS).toContain(body.confidence);
  });

  it('reads 48253 miles from the blurry PNG via multipart', async () => {
    // This synthetic image is deliberately blurred to evaluate degraded-image handling.
    const image = await readFile(join(__dirname, '../../images', 'odometer-blurry.png'));
    const { body } = await request(app).post('/odometer/reading')
      .attach('image', image, 'odometer.png')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(body.reading).toBe(48253);
    expect(body.unit).toBe('miles');
    expect(CONFIDENCE_LEVELS).toContain(body.confidence);
  });
});
