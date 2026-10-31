import { unreadable } from '../fixtures/ocr';
import OpenAI from 'openai';
import { OpenAiOcrProvider } from '../../src/ocr/openai.provider';

jest.mock('openai', () => ({ __esModule: true, default: jest.fn() }));

describe('OpenAiOcrProvider', () => {
  const originalEnv = process.env;
  const createResponse = jest.fn();
  const image = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

  beforeEach(() => {
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-key-not-a-real-credential' };
    delete process.env.OCR_PROVIDER;
    createResponse.mockReset();
    jest.mocked(OpenAI).mockReset();
    jest.mocked(OpenAI).mockImplementation(() => ({
      responses: { create: createResponse },
    }) as unknown as OpenAI);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('sends the supplied image to GPT-4.1-mini with the existing strict schema', async () => {
    createResponse.mockResolvedValue({
      output_text: JSON.stringify({ reading: 123456, unit: 'miles', confidence: 'high' }),
    });

    await new OpenAiOcrProvider().extractOdometerReading(image, 'dashboard.jpeg');

    expect(createResponse).toHaveBeenCalledTimes(1);
    expect(createResponse).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gpt-4.1-mini',
      input: expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.arrayContaining([
            expect.objectContaining({
              type: 'input_image',
              image_url: 'data:image/jpeg;base64,' + image.toString('base64'),
            }),
          ]),
        }),
      ]),
      text: {
        format: {
          type: 'json_schema',
          name: 'odometer_reading',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              reading: { type: ['number', 'null'] },
              unit: { type: 'string', enum: ['miles', 'km'] },
              confidence: { type: 'string', enum: ['high', 'med', 'low'] },
            },
            required: ['reading', 'unit', 'confidence'],
            additionalProperties: false,
          },
        },
      },
    }));
  });

  it.each([
    { reading: 123456, unit: 'miles', confidence: 'high' },
    { reading: 62690.5, unit: 'miles', confidence: 'med' },
    { reading: 45000, unit: 'km', confidence: 'low' },
    { reading: null, unit: 'miles', confidence: 'low' },
  ])('preserves a valid result: %j', async (result) => {
    createResponse.mockResolvedValue({ output_text: JSON.stringify(result) });
    await expect(new OpenAiOcrProvider().extractOdometerReading(image)).resolves.toEqual(result);
  });

  it.each([
    ['malformed JSON', '{'],
    ['null response', 'null'],
    ['missing reading', '{"unit":"miles","confidence":"high"}'],
    ['missing unit', '{"reading":123456,"confidence":"high"}'],
    ['missing confidence', '{"reading":123456,"unit":"miles"}'],
    ['invalid unit', '{"reading":123456,"unit":"meters","confidence":"high"}'],
    ['invalid confidence', '{"reading":123456,"unit":"miles","confidence":"medium"}'],
    ['negative reading', '{"reading":-1,"unit":"miles","confidence":"high"}'],
    ['string reading', '{"reading":"123456","unit":"miles","confidence":"high"}'],
    // JSON numeric overflow parses to Infinity; JSON.stringify would turn it into null.
    ['non-finite reading', '{"reading":1e400,"unit":"miles","confidence":"high"}'],
    ['NaN token', '{"reading":NaN,"unit":"miles","confidence":"high"}'],
  ])('returns UNREADABLE_IMAGE for %s', async (_description, outputText) => {
    createResponse.mockResolvedValue({ output_text: outputText });
    await expect(new OpenAiOcrProvider().extractOdometerReading(image)).resolves.toEqual(unreadable);
  });

  it('returns UNREADABLE_IMAGE when the SDK rejects the request', async () => {
    createResponse.mockRejectedValue(new Error('SDK request failed'));
    await expect(new OpenAiOcrProvider().extractOdometerReading(image)).resolves.toEqual(unreadable);
  });
});
