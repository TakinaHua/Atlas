import {createApp} from './app.js';

const port = Number(process.env.PORT || 8000);
const host = process.env.HOST || '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

const server = createApp().listen(port, host, () => {
  console.log(`Atlas is running at http://${host}:${port}`);
});
server.on('error', error => {
  console.error(`Atlas could not start: ${error.message}`);
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
