import type { OdometerResult } from './result';

export interface OcrProvider {
  extractOdometerReading(
    image: Buffer,
    filename?: string,
  ): Promise<OdometerResult>;
}
