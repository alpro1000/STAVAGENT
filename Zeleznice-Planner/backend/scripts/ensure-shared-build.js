/**
 * Ensure @stavagent/zeleznice-shared is built before backend start
 * (mirror of Monolit-Planner ensure-shared-build.js convention).
 */
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sharedDir = resolve(__dirname, '../../shared');
const distIndex = resolve(sharedDir, 'dist/index.js');

if (!existsSync(distIndex)) {
  console.log('[ensure-shared-build] shared/dist missing — building @stavagent/zeleznice-shared…');
  execSync('npm install --no-audit --no-fund && npm run build', {
    cwd: sharedDir,
    stdio: 'inherit',
  });
} else {
  console.log('[ensure-shared-build] shared/dist present — skip.');
}
