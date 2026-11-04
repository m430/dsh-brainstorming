import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const host = path.join(root, 'lib/host/index.js');
const client = path.join(root, 'lib/client.js');
if (fs.existsSync(host) && fs.existsSync(client)) {
  process.exit(0);
}
console.log('[prepare] build artifacts missing; running pnpm build…');
const result = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
process.exit(result.status ?? 1);
