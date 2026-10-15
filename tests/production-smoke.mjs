import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(import.meta.dirname, '..');
const temporary = mkdtempSync(join(tmpdir(), 'atlas-production-'));
const dist = `.next-production-check-${process.pid}`;
const children = new Set();
// Next adds isolated output paths to these files; restore only our generated changes.
const configPath = join(root, 'frontend/tsconfig.json');
const configBefore = readFileSync(configPath, 'utf8');
const nextEnvPath = join(root, 'frontend/next-env.d.ts');
const nextEnvBefore = existsSync(nextEnvPath) ? readFileSync(nextEnvPath, 'utf8') : null;
async function availablePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
const apiPort = await availablePort();
let webPort = await availablePort();
while (webPort === apiPort) webPort = await availablePort();
const origin = `http://127.0.0.1:${webPort}`;
const env = {
  ...process.env,
  API_PORT: String(apiPort),
  PORT: String(webPort),
  HOST: '127.0.0.1',
  ATLAS_API_URL: `http://127.0.0.1:${apiPort}`,
  ATLAS_NEXT_DIST_DIR: dist,
  DATABASE_PATH: join(temporary, 'test.sqlite'),
  CORS_ORIGINS: origin,
};
function start(command, args, cwd = root) {
  const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.output = '';
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (chunk) => {
      child.output = (child.output + chunk).slice(-12000);
    });
  children.add(child);
  return child;
}
async function run(command, args, cwd) {
  const child = start(command, args, cwd);
  const [code] = await once(child, 'exit');
  children.delete(child);
  assert.equal(code, 0, child.output);
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    children.delete(child);
    return;
  }
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  await exited;
  clearTimeout(timer);
  children.delete(child);
}
async function ready(url, child) {
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error(child.output);
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(500) })).ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`Server did not become ready: ${child.output}`);
}
async function api(path, method = 'GET', body) {
  const response = await fetch(`${origin}/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5000),
  });
  const result = await response.json();
  assert.ok(response.ok, JSON.stringify(result));
  return result;
}
try {
  console.log('Building isolated production frontend and backend…');
  await run('npm', ['run', 'build']);
  let backend = start(process.execPath, ['backend/dist/server.js']);
  await ready(`http://127.0.0.1:${apiPort}/api/health`, backend);
  const web = start(
    process.execPath,
    [join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1'],
    join(root, 'frontend'),
  );
  await ready(`${origin}/api/health`, web);
  const page = await fetch(origin);
  assert.ok((await page.text()).includes('Atlas'));
  const { results } = await api('/destinations?q=Pittsburgh');
  const location = results.find((r) => r.name === 'Pittsburgh');
  assert.ok(location);
  const place = {
    id: 'production-stop',
    name: 'Gateway area',
    address: 'Pittsburgh',
    category: 'Sightseeing',
    notes: 'Production restart check',
    latitude: 40.4420279,
    longitude: -80.0060824,
  };
  const created = await api('/itineraries', 'POST', {
    name: 'Production smoke test',
    destination: location.label,
    destinationLocation: location,
    startDate: '2026-10-14',
    endDate: '2026-10-15',
    days: [
      { date: '2026-10-14', places: [place] },
      { date: '2026-10-15', places: [] },
    ],
  });
  const moved = await api(`/itineraries/${created.id}`, 'PUT', {
    ...created,
    days: [
      { date: '2026-10-14', places: [] },
      { date: '2026-10-15', places: [place] },
    ],
  });
  console.log('Restarting the compiled API against the same temporary SQLite database…');
  await stop(backend);
  backend = start(process.execPath, ['backend/dist/server.js']);
  await ready(`http://127.0.0.1:${apiPort}/api/health`, backend);
  const reopened = await api(`/itineraries/${created.id}`);
  assert.deepEqual(reopened, moved);
  const exported = (await api('/itineraries')).trips;
  assert.deepEqual(exported, [moved]);
  const imported = await api('/itineraries/import', 'POST', { trips: exported });
  assert.equal(imported.imported, 0);
  assert.equal(imported.skipped, 1);
  const demo = await api('/routes/walking-demo', 'POST', {
    stops: [
      { latitude: place.latitude, longitude: place.longitude },
      { latitude: 40.4410009, longitude: -80.002423 },
    ],
  });
  assert.equal(demo.algorithm, 'Dijkstra');
  assert.ok(demo.distanceMeters > 400);
  console.log(
    'PASS: production page/proxy, destination catalog, atomic move, process restart persistence, backup round-trip idempotency, and compiled Dijkstra graph.',
  );
} finally {
  for (const child of [...children]) await stop(child);
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  config.include = config.include.filter((path) => !path.startsWith(`${dist}/`));
  writeFileSync(
    configPath,
    JSON.stringify(config) === JSON.stringify(JSON.parse(configBefore))
      ? configBefore
      : JSON.stringify(config, null, 2) + '\n',
  );
  if (existsSync(nextEnvPath) && readFileSync(nextEnvPath, 'utf8').includes(dist)) {
    if (nextEnvBefore === null) rmSync(nextEnvPath);
    else writeFileSync(nextEnvPath, nextEnvBefore);
  }
  rmSync(temporary, { recursive: true, force: true });
  rmSync(join(root, 'frontend', dist), { recursive: true, force: true });
}
