import { spawn } from 'node:child_process';

import { PACKAGE_NAME, VERSION_PATTERN } from './constants.js';

export interface ApplyUpgradeResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

/**
 * Upgrade only `dsh-brainstorming` to an exact validated version via pnpm in the profile dir.
 * Never accepts a caller-supplied package name.
 */
export function applyUpgrade(profileDir: string, version: string): Promise<ApplyUpgradeResult> {
  if (!VERSION_PATTERN.test(version)) {
    return Promise.resolve({
      ok: false,
      stdout: '',
      stderr: 'invalid target version',
      code: 1,
    });
  }

  const spec = `${PACKAGE_NAME}@${version}`;
  return new Promise((resolve) => {
    const child = spawn('pnpm', ['--dir', profileDir, 'add', spec], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
      if (stdout.length > 8_000) stdout = stdout.slice(-8_000);
    });
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
      if (stderr.length > 8_000) stderr = stderr.slice(-8_000);
    });

    child.on('error', (error) => {
      resolve({
        ok: false,
        stdout,
        stderr: error.message || String(error),
        code: null,
      });
    });

    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        stdout,
        stderr,
        code,
      });
    });
  });
}

/** Truncate pnpm stderr for UI (no registry prose beyond the process output). */
export function summarizeApplyError(result: ApplyUpgradeResult): string {
  const raw = (result.stderr || result.stdout || 'pnpm add failed').trim();
  const line = raw.split('\n').map((part) => part.trim()).find((part) => part.length > 0) || 'pnpm add failed';
  return line.length > 240 ? `${line.slice(0, 237)}…` : line;
}
