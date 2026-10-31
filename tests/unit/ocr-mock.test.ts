import { suppliedImages, unreadable } from '../fixtures/ocr';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createOcrProvider } from '../../src/ocr/factory';

// Guard against real API calls even if mock selection regresses.
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(() => { throw new Error('OpenAI must not be initialised in mock mode'); }),
}));

describe('OCR through the factory in mock mode', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, OCR_PROVIDER: 'mock' };
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // These verify deterministic mock results, not image recognition accuracy.
  it.each(suppliedImages)('returns the fixture result for $filename', async ({ filename, expected }) => {
    const image = readFileSync(join(__dirname, '../../images', filename));
    await expect(createOcrProvider().extractOdometerReading(image, filename)).resolves.toEqual(expected);
  });

  it('returns UNREADABLE_IMAGE for an unknown filename', async () => {
    const image = readFileSync(join(__dirname, '../../images', suppliedImages[0].filename));
    await expect(createOcrProvider().extractOdometerReading(image, 'unknown.jpeg')).resolves.toEqual(unreadable);
  });
});
