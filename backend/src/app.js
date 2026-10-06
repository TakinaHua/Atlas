import express from 'express';
import {fileURLToPath} from 'node:url';
import healthRouter from './routes/health.js';

const publicDirectory = fileURLToPath(new URL('../../frontend/public/', import.meta.url));
const sourceDirectory = fileURLToPath(new URL('../../frontend/src/', import.meta.url));

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use('/api/health', healthRouter);
  app.use('/api', (_request, response) => {
    response.status(404).json({error: 'API endpoint not found'});
  });
  app.use('/src', express.static(sourceDirectory));
  app.use(express.static(publicDirectory));
  app.use((_request, response) => {
    response.status(404).type('text').send('Not found');
  });
  return app;
}
