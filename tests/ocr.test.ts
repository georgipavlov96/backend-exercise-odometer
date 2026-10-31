import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createOcrProvider } from '../src/ocr/factory';

// Guard against real API calls even if mock selection regresses.
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(() => { throw new Error('OpenAI must not be initialised in mock mode'); }),
}));

const suppliedImages = [
  { filename: '33c24909-e9dd-46d3-8e7f-c44fd9896537.jpeg', expected: { reading: 62690.5, unit: 'miles', confidence: 'high' } },
  { filename: '3ae9d173-8895-409e-844c-77b5841138d7.jpeg', expected: { reading: 161967, unit: 'miles', confidence: 'med' } },
  { filename: 'd621e37e-7c0f-49a4-8a19-d628b1e82a33.jpeg', expected: { reading: 154510, unit: 'miles', confidence: 'med' } },
  { filename: 'dbab9932-823e-49ed-80db-1e898d836d5e.jpeg', expected: { reading: 205265, unit: 'miles', confidence: 'med' } },
];

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
    const image = readFileSync(join(__dirname, '../images', filename));
    await expect(createOcrProvider().extractOdometerReading(image, filename)).resolves.toEqual(expected);
  });

  it('returns UNREADABLE_IMAGE for an unknown filename', async () => {
    const image = readFileSync(join(__dirname, '../images', suppliedImages[0].filename));
    await expect(createOcrProvider().extractOdometerReading(image, 'unknown.jpeg')).resolves.toEqual({
      error: 'UNREADABLE_IMAGE',
      message: 'Could not extract a mileage reading from the provided image',
    });
  });
});
