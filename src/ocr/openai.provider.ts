import OpenAI from 'openai';
import type { OcrProvider } from './provider';
import { unreadable, type OdometerResult } from './result';

const prompt = `Read the odometer displayed in this vehicle dashboard image.

              Return the exact numeric reading, including any visible decimal digits.
              Do not round or truncate the number.

              Ignore speed, RPM, fuel range, clock and trip readings.
              If any digits are genuinely unreadable, return null rather than guessing.

              Return "km" if the odometer unit is explicitly kilometres.
              Return "miles" if the odometer unit is miles or mi.
              Default to "miles" if the unit is not visible.

              Confidence must be:
              - "high" when the reading is clearly visible.
              - "med" when the reading is mostly readable but uncertain.
              - "low" when the reading is unreadable or highly uncertain.

              Return null for reading when confidence is "low" and digits cannot be read reliably.`;

const responseSchema = {
  type: 'object',
  properties: {
    reading: { type: ['number', 'null'] },
    unit: { type: 'string', enum: ['miles', 'km'] },
    confidence: { type: 'string', enum: ['high', 'med', 'low'] },
  },
  required: ['reading', 'unit', 'confidence'],
  additionalProperties: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseReading(text: string): OdometerResult {
  const result: unknown = JSON.parse(text);
  console.log('OpenAI response:', result);
  if (!isRecord(result)) return unreadable();

  const { reading, unit, confidence } = result;
  if (reading !== null && !(typeof reading === 'number' && Number.isFinite(reading) && reading >= 0)) {
    return unreadable();
  }
  if (unit !== 'miles' && unit !== 'km') return unreadable();
  if (confidence !== 'high' && confidence !== 'med' && confidence !== 'low') return unreadable();

  return { reading, unit, confidence };
}

export class OpenAiOcrProvider implements OcrProvider {
  private readonly client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 3,
  });

  async extractOdometerReading(image: Buffer, _filename?: string): Promise<OdometerResult> {
    try {
      const response = await this.client.responses.create({
        model: 'gpt-4.1-mini',
        text: {
          format: { type: 'json_schema', name: 'odometer_reading', strict: true, schema: responseSchema },
        },
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            {
              type: 'input_image',
              image_url: `data:image/jpeg;base64,${image.toString('base64')}`,
              detail: 'high',
            },
          ],
        }],
      });
      return parseReading(response.output_text);
    } catch (error) {
      console.error('OpenAI recognition failed:', error);
      return unreadable();
    }
  }
}
