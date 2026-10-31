import { suppliedImages, unreadable } from '../fixtures/ocr';
import { MockOcrProvider } from '../../src/ocr/mock.provider';

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(() => { throw new Error('Mock provider must not initialise OpenAI'); }),
}));

describe('MockOcrProvider', () => {
  const originalEnv = process.env;
  const image = Buffer.from('image contents are not used by the filename-based mock');
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
    delete process.env.OCR_PROVIDER;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it.each(suppliedImages)('returns the same result twice for $filename without credentials', async ({ filename, expected }) => {
    const provider = new MockOcrProvider();
    await expect(provider.extractOdometerReading(image, filename)).resolves.toEqual(expected);
    await expect(provider.extractOdometerReading(image, filename)).resolves.toEqual(expected);
  });

  it('returns UNREADABLE_IMAGE for an unknown filename', async () => {
    await expect(new MockOcrProvider().extractOdometerReading(image, 'unknown.png')).resolves.toEqual(unreadable);
  });

  it('safely returns UNREADABLE_IMAGE when no filename is supplied', async () => {
    await expect(new MockOcrProvider().extractOdometerReading(image)).resolves.toEqual(unreadable);
  });
});
