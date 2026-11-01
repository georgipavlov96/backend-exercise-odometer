import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import { createOcrProvider } from './ocr';
import { unreadable } from './ocr/result';
import { validateImageUpload } from './upload/middleware';

export const app = express();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const handleOcrFailure: ErrorRequestHandler = (_error, _req, res, _next) => {
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An internal error occurred' });
};

const readOdometer: RequestHandler = async (req, res) => {
  const provider = createOcrProvider();
  const result = await provider.extractOdometerReading(res.locals.image, req.file?.originalname);
  if (!('error' in result) && result.reading === null) {
    res.status(422).json(unreadable());
    return;
  }
  res.status('error' in result ? 422 : 200).json(result);
};

app.post('/odometer/reading', validateImageUpload, readOdometer, handleOcrFailure);
