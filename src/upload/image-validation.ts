import { decode as decodeJpeg } from 'jpeg-js';
import { PNG } from 'pngjs';

export const maxImageBytes = 5 * 1024 * 1024;
const jpegSignature = Buffer.from([0xff, 0xd8, 0xff]);
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function validateImage(data: Buffer) {
  if (data.length === 0) return 'EMPTY_IMAGE';
  if (data.length > maxImageBytes) return 'FILE_TOO_LARGE';

  try {
    if (data.subarray(0, jpegSignature.length).equals(jpegSignature)) {
      decodeJpeg(data, { tolerantDecoding: false });
    } else if (data.subarray(0, pngSignature.length).equals(pngSignature)) {
      PNG.sync.read(data, { checkCRC: true });
    } else {
      return 'UNSUPPORTED_FILE_TYPE';
    }
  } catch {
    return 'INVALID_IMAGE';
  }
}
