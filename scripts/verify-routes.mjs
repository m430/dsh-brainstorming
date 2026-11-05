/**
 * Regression guard for the plugin's HTTP contract.
 *
 * The Host registers exact Fetch routes through `ctx.connection.fetch`; the
 * Client calls the paths from `src/shared/api.ts`. A drift here surfaces in the
 * UI as an opaque non-JSON 404 ("接口返回非 JSON（HTTP 404）"). This check
 * mounts the built Host entry with a recording Context and asserts that both
 * halves still speak the same paths.
 */

import { API_PATHS, BOARD_API_PATHS, UPDATE_API_PATHS } from '../lib/shared/api.js';
import { apply } from '../lib/host/index.js';

const registered = [];
const disposers = [];
const ctx = {
  effect(run) {
    const dispose = run();
    if (typeof dispose === 'function') disposers.push(dispose);
    return typeof dispose === 'function' ? dispose : undefined;
  },
  connection: {
    fetch: {
      register(route) {
        if (registered.some((item) => item.path === route.path)) {
          throw new Error(`duplicate Fetch route: ${route.path}`);
        }
        registered.push({ path: route.path, methods: route.methods });
        return async () => {};
      },
    },
  },
  get() {
    return undefined;
  },
  logger: { warn() {}, info() {} },
};

// Disable background registry polling so this script exits cleanly.
apply(ctx, { updateCheck: { enabled: false } });

const expected = [
  ...new Set([
    ...Object.values(API_PATHS),
    ...Object.values(BOARD_API_PATHS),
    ...Object.values(UPDATE_API_PATHS),
  ]),
];
const missing = expected.filter((path) => !registered.some((item) => item.path === path));
const extra = registered
  .map((item) => item.path)
  .filter((path) => !expected.includes(path));

if (missing.length > 0 || extra.length > 0) {
  console.error('[verify-routes] Host/Client API path drift detected');
  if (missing.length > 0) console.error('[verify-routes] missing Host routes:', missing);
  if (extra.length > 0) console.error('[verify-routes] unexpected Host routes:', extra);
  process.exit(1);
}

for (const dispose of disposers.reverse()) {
  await dispose();
}

console.log(`[verify-routes] ok — ${registered.length} routes match src/shared/api.ts`);
