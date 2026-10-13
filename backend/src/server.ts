import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { TripStore } from './store.js';

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535');
const host = process.env.HOST ?? '127.0.0.1';
const path = process.env.DATABASE_PATH ?? fileURLToPath(new URL('../data/atlas.sqlite', import.meta.url));
const store = new TripStore(path);
const origins = process.env.CORS_ORIGINS?.split(',').map(value => value.trim()).filter(Boolean);
const server = createApp(store, origins).listen(port, host, () => {
  console.log(`Atlas API listening at http://${host}:${port}/api`);
});
server.on('error', error => { console.error(error); store.close(); process.exitCode = 1; });
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(() => { store.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
