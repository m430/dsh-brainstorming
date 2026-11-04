import { build, context } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const packageId = typeof pkg.name === 'string' ? pkg.name : 'dsh-brainstorming';
const outDir = path.join(root, 'build');
const libDir = path.join(root, 'lib');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(libDir, { recursive: true });
const bundlePath = path.join(outDir, 'client.bundle.cjs');
const clientPath = path.join(libDir, 'client.js');
const legacyClientPath = path.join(root, 'client.js');
const watch = process.argv.includes('--watch');

const esbuildOptions = {
  entryPoints: [path.join(root, 'src/client/index.tsx')],
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
  plugins: [
    {
      name: 'dsh-brainstorming-client-wrapper',
      setup(esbuildApi) {
        esbuildApi.onEnd((result) => {
          if (result.errors.length > 0) return;
          const code = fs.readFileSync(bundlePath, 'utf8');
          const wrapped = `window.__ModuleLoader__.load({\n  id: ${JSON.stringify(packageId)},\n  factory(require) {\n    const module = { exports: {} };\n    const exports = module.exports;\n${code}\n    return module.exports;\n  },\n});\n`;
          fs.writeFileSync(clientPath, wrapped);
          // Remove legacy root client.js so exports cannot drift back to the old path.
          if (fs.existsSync(legacyClientPath)) fs.unlinkSync(legacyClientPath);
          console.log(`[client] lib/client.js written (${(wrapped.length / 1024 / 1024).toFixed(2)} MiB)`);
        });
      },
    },
  ],
};

if (watch) {
  const ctx = await context(esbuildOptions);
  await ctx.watch();
  console.log('[client] watching src/client/** …');
  const stop = async () => {
    await ctx.dispose();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
} else {
  await build(esbuildOptions);
}
