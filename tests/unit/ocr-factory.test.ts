import OpenAI from 'openai';

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(() => ({ responses: { create: jest.fn() } })),
}));

describe('createOcrProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
    delete process.env.OCR_PROVIDER;
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Load after configuring the environment, including module initialisation.
  function loadProviders() {
    let modules!: {
      createOcrProvider: typeof import('../../src/ocr/factory').createOcrProvider;
      MockOcrProvider: typeof import('../../src/ocr/mock.provider').MockOcrProvider;
      OpenAiOcrProvider: typeof import('../../src/ocr/openai.provider').OpenAiOcrProvider;
    };
    jest.isolateModules(() => {
      modules = {
        ...require('../../src/ocr/factory'),
        ...require('../../src/ocr/mock.provider'),
        ...require('../../src/ocr/openai.provider'),
      };
    });
    return modules;
  }

  it('selects MockOcrProvider without an API key and does not initialise OpenAI', () => {
    const { createOcrProvider, MockOcrProvider } = loadProviders();
    expect(createOcrProvider()).toBeInstanceOf(MockOcrProvider);
    expect(OpenAI).not.toHaveBeenCalled();
  });

  it('selects OpenAiOcrProvider with an API key', () => {
    process.env.OPENAI_API_KEY = 'test-key-not-a-real-credential';
    const { createOcrProvider, OpenAiOcrProvider } = loadProviders();
    expect(createOcrProvider()).toBeInstanceOf(OpenAiOcrProvider);
  });

  it('lets mock mode override credentials without initialising OpenAI', () => {
    process.env.OPENAI_API_KEY = 'test-key-not-a-real-credential';
    process.env.OCR_PROVIDER = 'mock';
    const { createOcrProvider, MockOcrProvider } = loadProviders();
    expect(createOcrProvider()).toBeInstanceOf(MockOcrProvider);
    expect(OpenAI).not.toHaveBeenCalled();
  });
});
