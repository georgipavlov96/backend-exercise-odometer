import type { RequestHandler } from 'express';
import multer from 'multer';

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
    next();
  });
};
