import {readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
let checked = 0;
function checkDirectory(directory) {
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    if (entry.name === 'node_modules') continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) checkDirectory(path);
    else if (/\.(js|cjs|mjs)$/.test(entry.name)) {
      const result = spawnSync(process.execPath, ['--check', path], {stdio: 'inherit'});
      if (result.error) throw result.error;
      if (result.status !== 0) process.exit(result.status || 1);
      checked++;
    }
  }
}
for (const directory of ['frontend', 'backend', 'scripts']) {
  checkDirectory(resolve(root, directory));
}
console.log(`Syntax checked ${checked} JavaScript files.`);
