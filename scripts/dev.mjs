import { spawn } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const node = process.execPath;
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 300);
}

function launch(name, args) {
  const child = spawn(node, args, { cwd: root, stdio: 'inherit' });
  children.push(child);
  child.on('exit', (code, signal) => {
    if (stopping) return;
    console.error(`[${name}] exited${signal ? ` (${signal})` : ` with code ${code ?? 1}`}`);
    stop(code ?? 1);
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

console.log('[dev] host: tsc --watch');
launch('host', [
  path.join(root, 'node_modules/typescript/bin/tsc'),
  '-p',
  'tsconfig.host.json',
  '--watch',
  '--preserveWatchOutput',
]);

console.log('[dev] client: esbuild --watch');
launch('client', [path.join(root, 'scripts/build-client.mjs'), '--watch']);
