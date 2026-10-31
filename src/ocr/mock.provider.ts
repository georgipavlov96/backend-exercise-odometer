import { unreadable, type OdometerResult } from './result';
import type { OcrProvider } from './provider';

export class MockOcrProvider implements OcrProvider {
  async extractOdometerReading(
    _image: Buffer,
    filename?: string,
  ): Promise<OdometerResult> {
    switch (filename) {
      case '33c24909-e9dd-46d3-8e7f-c44fd9896537.jpeg':
        return { reading: 62690.5, unit: 'miles', confidence: 'high' };
      case '3ae9d173-8895-409e-844c-77b5841138d7.jpeg':
        return { reading: 161967, unit: 'miles', confidence: 'med' };
      case 'd621e37e-7c0f-49a4-8a19-d628b1e82a33.jpeg':
        return { reading: 154510, unit: 'miles', confidence: 'med' };
      case 'dbab9932-823e-49ed-80db-1e898d836d5e.jpeg':
        return { reading: 205265, unit: 'miles', confidence: 'med' };
      case 'odometer-blurry.png':
        return { reading: 48253, unit: 'miles', confidence: 'med' };
      default:
        return unreadable();
    }
  }
}
