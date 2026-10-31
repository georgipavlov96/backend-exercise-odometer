import express from 'express';
import { validateImageUpload } from './upload';

export const app = express();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/odometer/reading', validateImageUpload, (_req, res) => {
  res.json({ status: 'accepted' });
});
