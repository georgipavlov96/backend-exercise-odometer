import { MockOcrProvider } from './mock.provider';
import { OpenAiOcrProvider } from './openai.provider';
import type { OcrProvider } from './provider';

export function createOcrProvider(): OcrProvider {
  if (process.env.OCR_PROVIDER === 'mock' || !process.env.OPENAI_API_KEY) {
    return new MockOcrProvider();
  }
  return new OpenAiOcrProvider();
}
