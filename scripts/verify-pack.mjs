import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function fail(message) {
  console.error(`[verify-pack] ${message}`);
  process.exit(1);
}

const requiredExports = ['.', './client', './cordis.patch.yml', './package.json', './icon'];
for (const key of requiredExports) {
  const target = pkg.exports?.[key];
  if (key === './package.json') {
    if (typeof target !== 'string') fail(`exports["${key}"] is missing`);
    continue;
  }
  if (key === '.') {
    if (!target || typeof target !== 'object' || typeof target.default !== 'string') {
      fail(`exports["."] must declare default`);
    }
    const main = path.join(root, String(target.default).replace(/^\.\//, ''));
    if (!fs.existsSync(main)) fail(`Host entry missing: ${main}`);
    continue;
  }
  if (typeof target !== 'string') fail(`exports["${key}"] is missing`);
  const resolved = path.join(root, target.replace(/^\.\//, ''));
  if (!fs.existsSync(resolved)) fail(`Export target missing for ${key}: ${resolved}`);
}

const clientPath = path.join(root, 'lib/client.js');
if (!fs.existsSync(clientPath)) fail('lib/client.js missing — run pnpm build first');
const clientSource = fs.readFileSync(clientPath, 'utf8');
if (!clientSource.includes('window.__ModuleLoader__.load')) {
  fail('lib/client.js must register via window.__ModuleLoader__.load');
}
if (!clientSource.includes(`id: ${JSON.stringify(pkg.name)}`)) {
  fail(`lib/client.js factory id must equal package.name (${pkg.name})`);
}

if (!pkg.dsh?.bundle?.patch) fail('dsh.bundle.patch is required');
const patchPath = path.join(root, String(pkg.dsh.bundle.patch).replace(/^\.\//, ''));
if (!fs.existsSync(patchPath)) fail(`dsh.bundle.patch missing: ${patchPath}`);

const spawned = spawnSync('npm', ['pack', '--dry-run', '--ignore-scripts'], {
  cwd: root,
  encoding: 'utf8',
});
const packText = `${spawned.stdout || ''}\n${spawned.stderr || ''}`;
if (spawned.status !== 0 && !packText.includes('Tarball Contents')) {
  fail(`npm pack --dry-run failed with status ${spawned.status}\n${packText}`);
}

const mustInclude = ['lib/client.js', 'lib/host/index.js', 'cordis.patch.yml', 'package.json', 'icon.svg'];
for (const file of mustInclude) {
  if (!packText.includes(file)) fail(`npm pack is missing ${file}`);
}

const bareClient = packText
  .split('\n')
  .map((line) => line.replace(/^npm notice\s*/u, '').trim())
  .some((line) => /^(?:\d+(?:\.\d+)?[kKmMgG]?B\s+)?client\.js$/u.test(line));
if (bareClient) fail('npm pack still includes root client.js; use lib/client.js only');

console.log('[verify-pack] ok');
