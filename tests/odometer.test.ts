import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { app } from '../src/app';

// Upload contract: multipart field "image", maximum file size 5 MiB.
// Only upload acceptance/validation is tested here; OCR output is out of scope.
const maxFileSize = 5 * 1024 * 1024;
const images = [
  {
    filename: 'odometer.jpeg',
    type: 'image/jpeg',
    bytes: readFileSync(join(__dirname, '../images/d621e37e-7c0f-49a4-8a19-d628b1e82a33.jpeg')),
  },
  {
    filename: 'image.png',
    type: 'image/png',
    // A valid 1x1 PNG; accepting uploads does not depend on readable mileage.
    bytes: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
      'base64',
    ),
  },
];

describe('POST /odometer/reading upload validation', () => {
  function upload(filename: string, type: string, bytes: Buffer) {
    return request(app)
      .post('/odometer/reading')
      .attach('image', bytes, { filename, contentType: type });
  }

  it.each(images)('accepts $type uploads with 200', async ({ filename, type, bytes }) => {
    await upload(filename, type, bytes).expect(200);
  });

  it('returns 400 when the image file is missing', async () => {
    await request(app)
      .post('/odometer/reading')
      .field('description', 'No image attached')
      .expect(400);
  });

  it('returns 415 for an unsupported file type', async () => {
    await upload('notes.txt', 'text/plain', Buffer.from('Not an image')).expect(415);
  });

  it.each(images)('returns 400 for an empty $type file', async ({ filename, type }) => {
    await upload(filename, type, Buffer.alloc(0)).expect(400);
  });

  it.each(images)('returns 413 for a $type file over 5 MiB', async ({ filename, type, bytes }) => {
    const oversized = Buffer.alloc(maxFileSize + 1);
    bytes.copy(oversized);

    await upload(filename, type, oversized).expect(413);
  });

  it.each(images)('returns 415 for text disguised as $type', async ({ filename, type }) => {
    await upload(filename, type, Buffer.from('This is text, not an image'))
      .expect(415)
      .expect('Content-Type', /application\/json/);
  });

  it.each(images)('returns 400 for corrupted $type data', async ({ filename, type, bytes }) => {
    // Preserve the image signature but replace the remaining data with junk.
    // Recognizing the file format alone must not count as validating the image.
    const corrupted = Buffer.concat([bytes.subarray(0, 16), Buffer.from('corrupted image data')]);

    await upload(filename, type, corrupted)
      .expect(400)
      .expect('Content-Type', /application\/json/);
  });

  it('returns 400 for multipart data without a boundary parameter', async () => {
    await request(app)
      .post('/odometer/reading')
      .set('Content-Type', 'multipart/form-data')
      .send('invalid multipart data')
      .expect(400)
      .expect('Content-Type', /application\/json/);
  });

  it('returns 400 for an incomplete multipart body', async () => {
    const body = [
      '--test-boundary',
      'Content-Disposition: form-data; name="image"; filename="image.png"',
      'Content-Type: image/png',
      '',
      'incomplete file data',
      // The closing multipart boundary is deliberately missing.
    ].join('\r\n');

    await request(app)
      .post('/odometer/reading')
      .set('Content-Type', 'multipart/form-data; boundary=test-boundary')
      .send(body)
      .expect(400)
      .expect('Content-Type', /application\/json/);
  });

  it.each(images)('returns 400 for $type in an unexpected file field', async ({ filename, type, bytes }) => {
    await request(app)
      .post('/odometer/reading')
      .attach('photo', bytes, { filename, contentType: type })
      .expect(400)
      .expect('Content-Type', /application\/json/);
  });
});
