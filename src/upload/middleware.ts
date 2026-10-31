import { json, type RequestHandler, type Response } from 'express';
import multer from 'multer';
import { maxImageBytes, validateImage } from './image-validation';

class UnsupportedImageTypeError extends Error {}

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

function decodeBase64Image(image: unknown): Buffer | string {
  if (typeof image !== 'string') return 'Provide a Base64 string in the image field';

  const data = Buffer.from(image, 'base64');
  // Node accepts malformed Base64, so require a canonical round trip.
  if (data.toString('base64') !== image) return 'Invalid Base64 image';
  return data;
}

const imageErrors = {
  MISSING_IMAGE: { status: 400, message: 'Provide a file in the image field' },
  EMPTY_IMAGE: { status: 400, message: 'Image must not be empty' },
  FILE_TOO_LARGE: { status: 413, message: 'Image must not exceed 5 MiB' },
  UNSUPPORTED_FILE_TYPE: { status: 415, message: 'Upload a JPEG or PNG image' },
  INVALID_IMAGE: { status: 400, message: 'Image data is corrupted or invalid' },
};

function sendImageError(res: Response, error: keyof typeof imageErrors) {
  const { status, message } = imageErrors[error];
  res.status(status).json({ error, message });
}

function sendInvalidUpload(res: Response, message: string) {
  res.status(400).json({ error: 'INVALID_UPLOAD', message });
}

function handleParseError(error: unknown, isJson: boolean, res: Response) {
  if (error instanceof UnsupportedImageTypeError) {
    return sendImageError(res, 'UNSUPPORTED_FILE_TYPE');
  }
  if ((error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') ||
      (error instanceof Error && 'type' in error && error.type === 'entity.too.large')) {
    return sendImageError(res, 'FILE_TOO_LARGE');
  }
  sendInvalidUpload(res, isJson ? 'Invalid JSON upload' : 'Invalid multipart image upload');
}

export const validateImageUpload: RequestHandler = (req, res, next) => {
  const isJson = Boolean(req.is('application/json'));
  const parse = isJson ? parseJson : parseImage;
  parse(req, res, (error: unknown) => {
    if (error) return handleParseError(error, isJson, res);

    const data = isJson && req.body?.image !== undefined
      ? decodeBase64Image(req.body.image)
      : req.file?.buffer;
    if (typeof data === 'string') return sendInvalidUpload(res, data);
    if (!data) return sendImageError(res, 'MISSING_IMAGE');

    const failure = validateImage(data);
    if (failure) return sendImageError(res, failure);

    res.locals.image = data;
    next();
  });
};
