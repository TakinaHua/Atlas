import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

// Browser tests use separate ports, Next build output, and a disposable database.
const dir = mkdtempSync(join(tmpdir(), 'atlas-browser-'));
const child = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: '3300',
    API_PORT: '8300',
    HOST: '127.0.0.1',
    ATLAS_API_URL: 'http://127.0.0.1:8300',
    ATLAS_NEXT_DIST_DIR: '.next-browser-tests',
    CORS_ORIGINS: 'http://127.0.0.1:3300',
    DATABASE_PATH: join(dir, 'atlas.sqlite'),
  },
});
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  try {
    child.kill('SIGTERM');
  } catch {
    /* Already exited. */
  }
  setTimeout(() => {
    try {
      child.kill('SIGKILL');
    } catch {
      /* Already exited. */
    }
  }, 5000).unref();
}
child.on('exit', (code) => {
  rmSync(dir, { recursive: true, force: true });
  process.exit(stopping ? 0 : (code ?? 1));
});
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
