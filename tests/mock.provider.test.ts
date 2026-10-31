import { MockOcrProvider } from '../src/ocr/mock.provider';

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(() => { throw new Error('Mock provider must not initialise OpenAI'); }),
}));

describe('MockOcrProvider', () => {
  const originalEnv = process.env;
  const image = Buffer.from('image contents are not used by the filename-based mock');
  const unreadable = {
    error: 'UNREADABLE_IMAGE',
    message: 'Could not extract a mileage reading from the provided image',
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
    delete process.env.OCR_PROVIDER;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it.each([
    ['33c24909-e9dd-46d3-8e7f-c44fd9896537.jpeg', { reading: 62690.5, unit: 'miles', confidence: 'high' }],
    ['3ae9d173-8895-409e-844c-77b5841138d7.jpeg', { reading: 161967, unit: 'miles', confidence: 'med' }],
    ['d621e37e-7c0f-49a4-8a19-d628b1e82a33.jpeg', { reading: 154510, unit: 'miles', confidence: 'med' }],
    ['dbab9932-823e-49ed-80db-1e898d836d5e.jpeg', { reading: 205265, unit: 'miles', confidence: 'med' }],
  ] as const)('returns the exact result for %s without credentials', async (filename, expected) => {
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
