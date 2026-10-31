import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { app } from '../src/app';
import { createOcrProvider } from '../src/ocr';

jest.mock('../src/ocr', () => {
  const provider = { extractOdometerReading: jest.fn() };
  return { createOcrProvider: () => provider };
});

const provider = createOcrProvider();
const extract = jest.mocked(provider.extractOdometerReading);

const filename = '33c24909-e9dd-46d3-8e7f-c44fd9896537.jpeg';
const jpeg = readFileSync(join(__dirname, '../images', filename));
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);
const post = () => request(app).post('/odometer/reading');

describe('POST /odometer/reading OCR integration', () => {
  beforeEach(() => extract.mockReset());

  describe.each([
    { format: 'JPEG', bytes: jpeg, name: filename, result: { reading: 62690.5, unit: 'miles', confidence: 'high' } },
    { format: 'PNG', bytes: png, name: 'dashboard.png', result: { reading: 81000, unit: 'km', confidence: 'med' } },
  ] as const)('$format', ({ bytes, name, result }) => {
    it('passes multipart image bytes and filename to OCR and returns its result', async () => {
      extract.mockResolvedValue(result);
      const response = await post().attach('image', bytes, name).expect(200);
      expect(extract).toHaveBeenCalledTimes(1);
      expect(extract).toHaveBeenCalledWith(bytes, name);
      expect(response.body).toEqual(result);
    });

    it('passes decoded Base64 bytes to OCR and returns its result', async () => {
      extract.mockResolvedValue(result);
      const response = await post().send({ image: bytes.toString('base64') }).expect(200);
      expect(extract).toHaveBeenCalledTimes(1);
      const [image, filename] = extract.mock.calls[0];
      expect(image).toEqual(bytes);
      expect(filename).toBeUndefined();
      expect(response.body).toEqual(result);
    });
  });

  it('preserves a valid null reading', async () => {
    const result = { reading: null, unit: 'miles', confidence: 'low' } as const;
    extract.mockResolvedValue(result);
    await post().attach('image', png, 'dashboard.png').expect(200, result);
  });

  it('returns the unreadable error that the provider resolves on OCR failure', async () => {
    const result = {
      error: 'UNREADABLE_IMAGE',
      message: 'Could not extract a mileage reading from the provided image',
    } as const;
    extract.mockResolvedValue(result);
    const response = await post().attach('image', png, 'dashboard.png').expect(422).expect('Content-Type', /json/);
    expect(response.body).toEqual(result);
  });

  it('returns a safe OCR error when the provider rejects', async () => {
    extract.mockRejectedValue(new Error('private provider details'));
    await post().attach('image', png, 'dashboard.png').expect(500, {
      error: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
    });
  });

  it.each([
    { status: 400, error: 'MISSING_IMAGE', send: () => post().send({}) },
    { status: 413, error: 'FILE_TOO_LARGE', send: () => post().attach('image', Buffer.alloc(5 * 1024 * 1024 + 1), 'large.png') },
    { status: 415, error: 'UNSUPPORTED_FILE_TYPE', send: () => post().send({ image: Buffer.from('text').toString('base64') }) },
  ])('returns $error without invoking OCR', async ({ status, error, send }) => {
    const response = await send().expect(status);
    expect(response.body).toMatchObject({ error, message: expect.any(String) });
    expect(extract).not.toHaveBeenCalled();
  });
});
