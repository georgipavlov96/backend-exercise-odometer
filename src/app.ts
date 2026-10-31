import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import { createOcrProvider } from './ocr';
import { validateImageUpload } from './upload';

export const app = express();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const handleOcrFailure: ErrorRequestHandler = (_error, _req, res, _next) => {
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An internal error occurred' });
};

app.post('/odometer/reading', validateImageUpload, async (req: Request, res: Response) => {
  const provider = createOcrProvider();
  const result = await provider.extractOdometerReading(res.locals.image, req.file?.originalname);
  res.status('error' in result ? 422 : 200).json(result);
}, handleOcrFailure);
