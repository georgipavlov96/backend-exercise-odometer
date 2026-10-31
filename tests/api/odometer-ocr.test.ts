import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { png, postReading } from '../fixtures/upload';
import { unreadable } from '../fixtures/ocr';
import { createOcrProvider } from '../../src/ocr';

jest.mock('../../src/ocr', () => {
  const provider = { extractOdometerReading: jest.fn() };
  return { createOcrProvider: () => provider };
});

const provider = createOcrProvider();
const extract = jest.mocked(provider.extractOdometerReading);

const filename = '33c24909-e9dd-46d3-8e7f-c44fd9896537.jpeg';
const jpeg = readFileSync(join(__dirname, '../../images', filename));

describe('POST /odometer/reading OCR integration', () => {
  beforeEach(() => extract.mockReset());

  describe.each([
    { format: 'JPEG', bytes: jpeg, name: filename, result: { reading: 62690.5, unit: 'miles', confidence: 'high' } },
    { format: 'PNG', bytes: png, name: 'dashboard.png', result: { reading: 81000, unit: 'km', confidence: 'med' } },
  ] as const)('$format', ({ bytes, name, result }) => {
    it('passes multipart image bytes and filename to OCR and returns its result', async () => {
      extract.mockResolvedValue(result);
      const response = await postReading().attach('image', bytes, name).expect(200);
      expect(extract).toHaveBeenCalledTimes(1);
      expect(extract).toHaveBeenCalledWith(bytes, name);
      expect(response.body).toEqual(result);
    });

    it('passes decoded Base64 bytes to OCR and returns its result', async () => {
      extract.mockResolvedValue(result);
      const response = await postReading().send({ image: bytes.toString('base64') }).expect(200);
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
    await postReading().attach('image', png, 'dashboard.png').expect(200, result);
  });

  it('returns the unreadable error that the provider resolves on OCR failure', async () => {
    extract.mockResolvedValue(unreadable);
    const response = await postReading().attach('image', png, 'dashboard.png').expect(422).expect('Content-Type', /json/);
    expect(response.body).toEqual(unreadable);
  });

  it('returns a safe OCR error when the provider rejects', async () => {
    extract.mockRejectedValue(new Error('private provider details'));
    await postReading().attach('image', png, 'dashboard.png').expect(500, {
      error: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
    });
  });

  it.each([
    { status: 400, error: 'MISSING_IMAGE', send: () => postReading().send({}) },
    { status: 413, error: 'FILE_TOO_LARGE', send: () => postReading().attach('image', Buffer.alloc(5 * 1024 * 1024 + 1), 'large.png') },
    { status: 415, error: 'UNSUPPORTED_FILE_TYPE', send: () => postReading().send({ image: Buffer.from('text').toString('base64') }) },
  ])('returns $error without invoking OCR', async ({ status, error, send }) => {
    const response = await send().expect(status);
    expect(response.body).toMatchObject({ error, message: expect.any(String) });
    expect(extract).not.toHaveBeenCalled();
  });
});
