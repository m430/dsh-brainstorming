import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'build');
fs.mkdirSync(outDir, { recursive: true });
const bundlePath = path.join(outDir, 'client.bundle.cjs');

await build({
  entryPoints: [path.join(root, 'src/client/index.jsx')],
  outfile: bundlePath,
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['chrome110'],
  jsx: 'automatic',
  loader: { '.css': 'text' },
  external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: true,
  legalComments: 'none',
});

const code = fs.readFileSync(bundlePath, 'utf8');
const wrapped = `window.__ModuleLoader__.load({\n  id: 'dsh-brainstorming',\n  factory(require) {\n    const module = { exports: {} };\n    const exports = module.exports;\n${code}\n    return module.exports;\n  },\n});\n`;
fs.writeFileSync(path.join(root, 'client.js'), wrapped);
console.log(`client.js written (${(wrapped.length / 1024 / 1024).toFixed(2)} MiB)`);
