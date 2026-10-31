import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decode } from 'jpeg-js';
import { PNG } from 'pngjs';
import { extractOdometerReading } from '../src/ocr';

// Proposed service contract: Buffer -> Promise<reading result | unreadable result>.
// These are image-to-result acceptance tests, independent of Express and any OCR provider.
// Expectations come from visual review, not measured OCR scores. Proposed confidence
// policy: high for clear digits with explicit units, medium for blur or uncertain units.
// For this exercise, an absent unit defaults to miles; a primary MPH scale also implies miles.
const suppliedImages = [
  {
    filename: '33c24909-e9dd-46d3-8e7f-c44fd9896537.jpeg',
    description: 'preserves decimal mileage and ignores the 111-mile fuel range',
    expected: { reading: 62690.5, unit: 'miles', confidence: 'high' },
  },
  {
    filename: '3ae9d173-8895-409e-844c-77b5841138d7.jpeg',
    description: 'reads the ODO value instead of the 8:31 clock and defaults to miles',
    expected: { reading: 161967, unit: 'miles', confidence: 'medium' },
  },
  {
    filename: 'd621e37e-7c0f-49a4-8a19-d628b1e82a33.jpeg',
    description: 'reads the blurry mileage with reduced confidence and ignores fuel range',
    expected: { reading: 154510, unit: 'miles', confidence: 'medium' },
  },
  {
    filename: 'dbab9932-823e-49ed-80db-1e898d836d5e.jpeg',
    description: 'reads the ODO value and infers miles from the primary MPH scale',
    expected: { reading: 205265, unit: 'miles', confidence: 'medium' },
  },
];

const unreadable = {
  error: 'UNREADABLE_IMAGE',
  message: 'Could not extract a mileage reading from the provided image',
};

function readImage(filename: string): Buffer {
  return readFileSync(join(__dirname, '../images', filename));
}

describe('extractOdometerReading', () => {
  it.each(suppliedImages)('$description', async ({ filename, expected }) => {
    await expect(extractOdometerReading(readImage(filename))).resolves.toEqual(expected);
  });

  it('returns UNREADABLE_IMAGE when no reading is present', async () => {
    // A valid, blank PNG separates absent mileage from invalid image contents.
    const blank = new PNG({ width: 100, height: 100 });
    blank.data.fill(255);

    await expect(extractOdometerReading(PNG.sync.write(blank))).resolves.toEqual(unreadable);
  });

  it('returns UNREADABLE_IMAGE when two different odometers make the result ambiguous', async () => {
    // Both complete dashboards are equally prominent; neither is designated as the target.
    const left = decode(readImage('33c24909-e9dd-46d3-8e7f-c44fd9896537.jpeg'));
    const right = decode(readImage('dbab9932-823e-49ed-80db-1e898d836d5e.jpeg'));
    const combined = new PNG({
      width: left.width + right.width,
      height: Math.max(left.height, right.height),
    });
    combined.data.fill(255);

    for (const [image, offsetX] of [[left, 0], [right, left.width]] as const) {
      for (let y = 0; y < image.height; y++) {
        image.data.copy(
          combined.data,
          (y * combined.width + offsetX) * 4,
          y * image.width * 4,
          (y + 1) * image.width * 4,
        );
      }
    }

    await expect(extractOdometerReading(PNG.sync.write(combined))).resolves.toEqual(unreadable);
  });
});
