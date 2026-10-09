import express from 'express';
import { pathToFileURL } from 'node:url';

// Preview only: itinerary data stays in the browser until UI review is complete.
export const app = express();
app.disable('x-powered-by');
app.get('/api/health', (_req, res) =>
  res.json({
    status: 'ok',
    runtime: 'node',
    framework: 'express',
    mode: 'frontend-preview',
  }),
);
app.use('/api', (_req, res) =>
  res.status(501).json({
    error:
      'Itinerary APIs are deferred until frontend review. Trips are saved in this browser.',
  }),
);
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.API_PORT || 8000);
  const server = app.listen(port, '127.0.0.1', () =>
    console.log(`Atlas Express preview API: http://127.0.0.1:${port}/api/health`),
  );
  server.on('error', (error) => {
    console.error(error.message);
    process.exit(1);
  });
}
