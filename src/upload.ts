import type { RequestHandler } from 'express';
import multer from 'multer';
import { decode as decodeJpeg } from 'jpeg-js';
import { PNG } from 'pngjs';

const jpegSignature = Buffer.from([0xff, 0xd8, 0xff]);
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

class UnsupportedImageTypeError extends Error {}

const parseImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== 'image/jpeg' && file.mimetype !== 'image/png') {
      callback(new UnsupportedImageTypeError());
      return;
    }
    callback(null, true);
  },
}).single('image');

export const validateImageUpload: RequestHandler = (req, res, next) => {
  parseImage(req, res, (error: unknown) => {
    if (error instanceof UnsupportedImageTypeError) {
      res.status(415).json({ error: 'UNSUPPORTED_FILE_TYPE', message: 'Upload a JPEG or PNG image' });
      return;
    }
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'FILE_TOO_LARGE', message: 'Image must not exceed 5 MiB' });
      return;
    }
    if (error) {
      res.status(400).json({ error: 'INVALID_UPLOAD', message: 'Invalid multipart image upload' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'MISSING_IMAGE', message: 'Provide a file in the image field' });
      return;
    }
    if (req.file.size === 0) {
      res.status(400).json({ error: 'EMPTY_IMAGE', message: 'Image must not be empty' });
      return;
    }

    const data = req.file.buffer;
    const isJpeg = data.subarray(0, jpegSignature.length).equals(jpegSignature);
    const isPng = data.subarray(0, pngSignature.length).equals(pngSignature);
    if (!isJpeg && !isPng) {
      res.status(415).json({ error: 'UNSUPPORTED_FILE_TYPE', message: 'Upload a JPEG or PNG image' });
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
    next();
  });
};
