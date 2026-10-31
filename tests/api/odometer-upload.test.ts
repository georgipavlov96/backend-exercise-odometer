import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { png, postReading } from '../fixtures/upload';

const mockResult = { reading: 62690.5, unit: 'miles', confidence: 'high' } as const;
jest.mock('../../src/ocr', () => ({
  createOcrProvider: () => ({ extractOdometerReading: async () => mockResult }),
}));

// Upload contract: multipart or Base64 JSON field "image", maximum decoded size 5 MiB.
// Only upload acceptance/validation is tested here; OCR output is out of scope.
const maxFileSize = 5 * 1024 * 1024;
const images = [
  {
    filename: 'odometer.jpeg',
    type: 'image/jpeg',
    bytes: readFileSync(join(__dirname, '../../images/d621e37e-7c0f-49a4-8a19-d628b1e82a33.jpeg')),
  },
  {
    filename: 'image.png',
    type: 'image/png',
    bytes: png,
  },
];

describe('POST /odometer/reading upload validation', () => {
  function upload(filename: string, type: string, bytes: Buffer) {
    return postReading()
      .attach('image', bytes, { filename, contentType: type });
  }

  it.each(images)('accepts $type uploads with 200', async ({ filename, type, bytes }) => {
    await upload(filename, type, bytes).expect(200);
  });

  it('returns 400 when the image file is missing', async () => {
    await postReading()
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
    await postReading()
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

    await postReading()
      .set('Content-Type', 'multipart/form-data; boundary=test-boundary')
      .send(body)
      .expect(400)
      .expect('Content-Type', /application\/json/);
  });

  it.each(images)('returns 400 for $type in an unexpected file field', async ({ filename, type, bytes }) => {
    await postReading()
      .attach('photo', bytes, { filename, contentType: type })
      .expect(400)
      .expect('Content-Type', /application\/json/);
  });

  describe('Base64 JSON uploads', () => {
    const jpeg = images[0].bytes;

    function postJson(body: object | string) {
      return postReading().type('json').send(body);
    }

    function expectError(body: object | string, status: number, error: string) {
      return postJson(body).expect(status).expect(({ body: response }) => {
        expect(response).toMatchObject({ error, message: expect.any(String) });
      });
    }

    it.each(images)('accepts Base64 $type', async ({ bytes }) => {
      await postJson({ image: bytes.toString('base64') }).expect(200, mockResult);
    });

    function jpegBodyOfSize(size: number) {
      // JPEG permits 0xff fill bytes immediately before the end marker.
      const bytes = Buffer.concat([jpeg.subarray(0, -2), Buffer.alloc(size - jpeg.length, 0xff), jpeg.subarray(-2)]);
      return { image: bytes.toString('base64') };
    }

    it('accepts a JPEG of exactly 5 MiB after Base64 decoding', async () => {
      await postJson(jpegBodyOfSize(maxFileSize)).expect(200, mockResult);
    });

    it('returns 413 for a decoded JPEG one byte over 5 MiB', async () => {
      await expectError(jpegBodyOfSize(maxFileSize + 1), 413, 'FILE_TOO_LARGE');
    });

    it('returns 400 for a missing image', async () => {
      await expectError({}, 400, 'MISSING_IMAGE');
    });

    it.each([
      { label: 'null', image: null },
      { label: 'number', image: 42 },
      { label: 'boolean', image: true },
      { label: 'array', image: [] },
      { label: 'object', image: {} },
    ])('returns 400 for a $label image', async ({ image }) => {
      await expectError({ image }, 400, 'INVALID_UPLOAD');
    });

    it('returns 400 for the empty string (Base64 for zero decoded bytes)', async () => {
      await expectError({ image: Buffer.alloc(0).toString('base64') }, 400, 'EMPTY_IMAGE');
    });

    it('returns 400 for a whitespace-only string', async () => {
      await postJson({ image: ' \t\n' }).expect(400).expect(({ body }) => {
        expect(body).toMatchObject({ error: expect.any(String), message: expect.any(String) });
      });
    });

    it.each([
      { label: 'invalid characters', image: '!' + jpeg.toString('base64') },
      { label: 'extra padding', image: jpeg.toString('base64') + '=' },
    ])('returns 400 for Base64 with $label', async ({ image }) => {
      await expectError({ image }, 400, 'INVALID_UPLOAD');
    });

    it.each([
      { label: 'text', image: Buffer.from('not an image').toString('base64') },
      { label: 'GIF', image: 'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==' },
    ])('returns 415 for Base64 containing $label', async ({ image }) => {
      await expectError({ image }, 415, 'UNSUPPORTED_FILE_TYPE');
    });

    it.each(images)('returns 400 for a truncated Base64-encoded $type image', async ({ bytes }) => {
      await expectError({ image: bytes.subarray(0, 16).toString('base64') }, 400, 'INVALID_IMAGE');
    });

    it('returns 400 for malformed JSON', async () => {
      await expectError('{"image":', 400, 'INVALID_UPLOAD');
    });
  });
});
