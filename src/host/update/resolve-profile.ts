import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PACKAGE_NAME } from './constants.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readJson(filePath: string): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  } catch {
    return null;
  }
}

function walkParents(startDir: string): string[] {
  const dirs: string[] = [];
  let current = path.resolve(startDir);
  for (;;) {
    dirs.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return dirs;
}

export interface PluginLocation {
  /** Absolute path to this plugin's package root (directory with package.json name=dsh-brainstorming). */
  packageRoot: string;
  /** Installed package.json version string, if readable. */
  currentVersion: string | null;
}

/** Locate this plugin's package root and version from a module URL (typically import.meta.url). */
export function resolvePluginLocation(moduleUrl: string): PluginLocation | null {
  const start = path.dirname(fileURLToPath(moduleUrl));
  for (const dir of walkParents(start)) {
    const pkgPath = path.join(dir, 'package.json');
    const raw = readJson(pkgPath);
    if (!isRecord(raw) || raw.name !== PACKAGE_NAME) continue;
    const currentVersion = typeof raw.version === 'string' ? raw.version : null;
    return { packageRoot: dir, currentVersion };
  }
  return null;
}

/**
 * Walk up from the plugin package looking for a profile root:
 * package.json with `dsh.profile` (and usually dependencies).
 */
export function resolveProfileDir(fromPackageRoot: string): string | null {
  for (const dir of walkParents(fromPackageRoot)) {
    if (dir === fromPackageRoot) continue;
    const pkgPath = path.join(dir, 'package.json');
    const raw = readJson(pkgPath);
    if (!isRecord(raw)) continue;
    if (isRecord(raw.dsh) && isRecord(raw.dsh.profile)) return dir;
  }
  return null;
}

export function readProfilePackageJson(profileDir: string): Record<string, unknown> | null {
  const raw = readJson(path.join(profileDir, 'package.json'));
  return isRecord(raw) ? raw : null;
}
