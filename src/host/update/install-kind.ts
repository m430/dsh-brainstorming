import { PACKAGE_NAME } from './constants.js';
import { readProfilePackageJson } from './resolve-profile.js';

export type InstallKind = 'registry' | 'local' | 'unknown';

function depSpec(pkg: Record<string, unknown>): string | null {
  const deps = pkg.dependencies;
  if (!deps || typeof deps !== 'object' || Array.isArray(deps)) return null;
  const value = (deps as Record<string, unknown>)[PACKAGE_NAME];
  return typeof value === 'string' ? value : null;
}

/** Classify how this plugin is installed into the profile. */
export function resolveInstallKind(profileDir: string | null): InstallKind {
  if (!profileDir) return 'unknown';
  const pkg = readProfilePackageJson(profileDir);
  if (!pkg) return 'unknown';
  const spec = depSpec(pkg);
  if (spec === null) return 'unknown';
  const trimmed = spec.trim();
  if (
    trimmed.startsWith('link:')
    || trimmed.startsWith('file:')
    || trimmed.startsWith('workspace:')
    || trimmed.startsWith('.')
    || trimmed.startsWith('/')
  ) {
    return 'local';
  }
  return 'registry';
}

/** True when profile lists dsh-hot-reload as a dependency (any form). */
export function hasHotReload(profileDir: string | null): boolean {
  if (!profileDir) return false;
  const pkg = readProfilePackageJson(profileDir);
  if (!pkg) return false;
  for (const key of ['dependencies', 'devDependencies'] as const) {
    const block = pkg[key];
    if (!block || typeof block !== 'object' || Array.isArray(block)) continue;
    if ('dsh-hot-reload' in (block as Record<string, unknown>)) return true;
  }
  return false;
}
