import { json, type RequestHandler } from 'express';
import multer from 'multer';
import { decode as decodeJpeg } from 'jpeg-js';
import { PNG } from 'pngjs';

const jpegSignature = Buffer.from([0xff, 0xd8, 0xff]);
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

class UnsupportedImageTypeError extends Error {}

const unsupportedFileType = { error: 'UNSUPPORTED_FILE_TYPE', message: 'Upload a JPEG or PNG image' };
const fileTooLarge = { error: 'FILE_TOO_LARGE', message: 'Image must not exceed 5 MiB' };

const maxImageBytes = 5 * 1024 * 1024;
// Allow the Base64 representation plus 1 KiB for the JSON envelope.
const parseJson = json({ limit: 4 * Math.ceil(maxImageBytes / 3) + 1024 });
const parseImage = multer({
  storage: multer.memoryStorage(),
  // Multer signals the limit when it is reached, so allow exactly 5 MiB.
  limits: { fileSize: maxImageBytes + 1, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== 'image/jpeg' && file.mimetype !== 'image/png') {
      callback(new UnsupportedImageTypeError());
      return;
    }
    callback(null, true);
  },
}).single('image');

export const validateImageUpload: RequestHandler = (req, res, next) => {
  const isJson = Boolean(req.is('application/json'));
  const parse = isJson ? parseJson : parseImage;
  parse(req, res, (error: unknown) => {
    if (error instanceof UnsupportedImageTypeError) {
      res.status(415).json(unsupportedFileType);
      return;
    }
    if ((error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') ||
        (error instanceof Error && 'type' in error && error.type === 'entity.too.large')) {
      res.status(413).json(fileTooLarge);
      return;
    }
    if (error) {
      res.status(400).json({ error: 'INVALID_UPLOAD', message: isJson ? 'Invalid JSON upload' : 'Invalid multipart image upload' });
      return;
    }
    let data = req.file?.buffer;
    if (isJson && req.body?.image !== undefined) {
      const image: unknown = req.body.image;
      if (typeof image !== 'string') {
        res.status(400).json({ error: 'INVALID_UPLOAD', message: 'Provide a Base64 string in the image field' });
        return;
      }
      data = Buffer.from(image, 'base64');
      // Node decodes malformed Base64 permissively. Require a canonical round trip.
      if (data.toString('base64') !== image) {
        res.status(400).json({ error: 'INVALID_UPLOAD', message: 'Invalid Base64 image' });
        return;
      }
    }
    if (!data) {
      res.status(400).json({ error: 'MISSING_IMAGE', message: 'Provide a file in the image field' });
      return;
    }
    if (data.length === 0) {
      res.status(400).json({ error: 'EMPTY_IMAGE', message: 'Image must not be empty' });
      return;
    }

    if (data.length > maxImageBytes) {
      res.status(413).json(fileTooLarge);
      return;
    }
    const isJpeg = data.subarray(0, jpegSignature.length).equals(jpegSignature);
    const isPng = data.subarray(0, pngSignature.length).equals(pngSignature);
    if (!isJpeg && !isPng) {
      res.status(415).json(unsupportedFileType);
      return;
    }

    try {
      // Signatures identify the format; decoding validates the actual pixel data.
      if (isJpeg) {
        decodeJpeg(data, { tolerantDecoding: false });
      } else {
        PNG.sync.read(data, { checkCRC: true });
      }
    } catch {
      res.status(400).json({ error: 'INVALID_IMAGE', message: 'Image data is corrupted or invalid' });
      return;
    }
    res.locals.image = data;
    next();
  });
};
