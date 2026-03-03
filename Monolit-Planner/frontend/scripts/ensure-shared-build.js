import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sharedDir = resolve(__dirname, '../../shared');
const distEntry = resolve(sharedDir, 'dist/index.js');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const require = createRequire(import.meta.url);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: sharedDir,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

let hasTypescript = true;
try {
  require.resolve('typescript', { paths: [sharedDir] });
} catch (error) {
  hasTypescript = false;
}

// In CI environment, ensure shared is built from cache or build it
if (process.env.CI || process.env.VERCEL) {
  console.log('[prepare:shared] CI environment detected.');
  
  if (!existsSync(distEntry)) {
    console.log('[prepare:shared] dist not found, building shared package...');
    
    // Check if typescript is available
    if (!hasTypescript) {
      console.log('[prepare:shared] Installing shared dependencies...');
      run(npmCmd, ['install', '--include=dev']);
    }
    
    // Build shared package
    console.log('[prepare:shared] Building shared package...');
    run(npmCmd, ['run', 'build']);
  } else {
    console.log('[prepare:shared] Shared build found in cache.');
  }
  
  process.exit(0);
}

if (!hasTypescript) {
  console.log('[prepare:shared] Installing shared workspace dependencies...');
  run(npmCmd, ['install', '--include=dev']);
}

if (!existsSync(distEntry)) {
  console.log('[prepare:shared] Building shared workspace package...');
  run(npmCmd, ['run', 'build']);
} else {
  console.log('[prepare:shared] Shared workspace build found, skipping rebuild.');
}
