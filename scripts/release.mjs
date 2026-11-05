#!/usr/bin/env node
/**
 * Cut a release: bump version → verify → commit/tag → push → npm publish → GitHub Release.
 *
 * Usage:
 *   pnpm release                 # patch bump (0.0.3 → 0.0.4)
 *   pnpm release minor           # 0.0.x → 0.1.0
 *   pnpm release major
 *   pnpm release 0.1.0           # explicit version
 *   pnpm release --dry-run       # print plan, no writes / publish
 *   pnpm release --no-publish    # commit + tag + push only
 *
 * Prerequisites:
 *   - clean git working tree on the release branch (default: main)
 *   - CHANGELOG.md + CHANGELOG.zh.md already contain a `## <version>` section
 *   - logged in: `npm whoami`, `gh auth status`
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pkgPath = path.join(root, 'package.json');
const changelogEnPath = path.join(root, 'CHANGELOG.md');
const changelogZhPath = path.join(root, 'CHANGELOG.zh.md');
const readmePath = path.join(root, 'README.md');

const args = process.argv.slice(2).filter((a) => a !== '--');
const dryRun = args.includes('--dry-run');
const noPublish = args.includes('--no-publish');
const positional = args.filter((a) => !a.startsWith('--'));
const bumpArg = positional[0] || 'patch';

function fail(message) {
  console.error(`[release] ${message}`);
  process.exit(1);
}

function run(command, commandArgs, opts = {}) {
  const label = [command, ...commandArgs].join(' ');
  if (dryRun && opts.mutate) {
    console.log(`[dry-run] ${label}`);
    return { status: 0, stdout: '', stderr: '' };
  }
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    stdio: opts.stdio ?? 'pipe',
    env: process.env,
  });
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    fail(`command failed (${result.status}): ${label}`);
  }
  return result;
}

function runInherit(command, commandArgs, mutate = true) {
  return run(command, commandArgs, { stdio: 'inherit', mutate });
}

function parseVersion(raw) {
  const match = String(raw).trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) fail(`invalid version: ${raw}`);
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] || null,
    toString() {
      const base = `${this.major}.${this.minor}.${this.patch}`;
      return this.prerelease ? `${base}-${this.prerelease}` : base;
    },
  };
}

function bumpVersion(current, kind) {
  if (/^\d+\.\d+\.\d+/.test(kind)) return parseVersion(kind);
  const next = { ...current, prerelease: null };
  if (kind === 'major') {
    next.major += 1;
    next.minor = 0;
    next.patch = 0;
  } else if (kind === 'minor') {
    next.minor += 1;
    next.patch = 0;
  } else if (kind === 'patch') {
    next.patch += 1;
  } else {
    fail(`unknown bump "${kind}" (use patch|minor|major|x.y.z)`);
  }
  return next;
}

function extractChangelogSection(markdown, version) {
  const heading = `## ${version}`;
  const start = markdown.indexOf(heading);
  if (start === -1) return null;
  const after = markdown.slice(start + heading.length);
  const next = after.search(/\n##\s+/);
  const body = (next === -1 ? after : after.slice(0, next)).trim();
  return body;
}

function replacePinnedPackageVersion(readme, fromVersion, toVersion) {
  const pinned = new RegExp(`(dsh-brainstorming@)${fromVersion.replace(/\./g, '\\.')}`, 'g');
  if (!pinned.test(readme)) return readme;
  return readme.replace(pinned, `$1${toVersion}`);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const current = parseVersion(pkg.version);
const next = bumpVersion(current, bumpArg);
const nextVersion = next.toString();
const tag = `v${nextVersion}`;
const today = new Date().toISOString().slice(0, 10);

if (nextVersion === current.toString()) fail(`version unchanged (${nextVersion})`);

const status = run('git', ['status', '--porcelain']).stdout.trim();
if (status) fail(`working tree not clean:\n${status}`);

const branch = run('git', ['branch', '--show-current']).stdout.trim();
if (branch !== 'main' && branch !== 'master') {
  fail(`refusing to release from branch "${branch}" (expected main/master)`);
}

const changelogEn = fs.readFileSync(changelogEnPath, 'utf8');
const changelogZh = fs.readFileSync(changelogZhPath, 'utf8');
const notesEn = extractChangelogSection(changelogEn, nextVersion);
const notesZh = extractChangelogSection(changelogZh, nextVersion);
if (!notesEn) {
  fail(
    `CHANGELOG.md missing "## ${nextVersion}" section. Add release notes first, then re-run.`,
  );
}
if (!notesZh) {
  fail(
    `CHANGELOG.zh.md missing "## ${nextVersion}" section. Add release notes first, then re-run.`,
  );
}

// Soft check: date line looks like "## 0.0.4 - 2026-11-05"
const enHeadingOk = changelogEn.includes(`## ${nextVersion} - `);
const zhHeadingOk = changelogZh.includes(`## ${nextVersion} - `);
if (!enHeadingOk || !zhHeadingOk) {
  console.warn(
    `[release] tip: prefer headings like "## ${nextVersion} - ${today}" in both changelogs`,
  );
}

console.log(`[release] ${current} → ${nextVersion} (tag ${tag})${dryRun ? ' [dry-run]' : ''}`);

if (!dryRun) {
  pkg.version = nextVersion;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  let readme = fs.readFileSync(readmePath, 'utf8');
  const updatedReadme = replacePinnedPackageVersion(readme, current.toString(), nextVersion);
  if (updatedReadme !== readme) fs.writeFileSync(readmePath, updatedReadme);
}

runInherit('pnpm', ['check'], true);
runInherit('pnpm', ['build'], true);
runInherit('pnpm', ['verify-pack'], true);

if (!dryRun) {
  runInherit('git', ['add', 'package.json', 'CHANGELOG.md', 'CHANGELOG.zh.md', 'README.md']);
  // Include lockfile if version bump touched it (usually not).
  const staged = run('git', ['diff', '--cached', '--name-only']).stdout.trim();
  if (!staged) fail('nothing staged for release commit');
  runInherit('git', ['commit', '-m', `chore: release v${nextVersion}`]);
  runInherit('git', ['tag', '-a', tag, '-m', `v${nextVersion}`]);
  runInherit('git', ['push', 'origin', 'HEAD']);
  runInherit('git', ['push', 'origin', tag]);
}

if (!noPublish) {
  if (!dryRun) {
    runInherit('npm', ['whoami']); // fail early if not logged in
  }
  runInherit('npm', ['publish', '--access', 'public'], true);

  const releaseBody = [
    notesEn,
    '',
    '---',
    '',
    notesZh,
    '',
    `npm: https://www.npmjs.com/package/${pkg.name}/v/${nextVersion}`,
  ].join('\n');

  if (dryRun) {
    console.log('[dry-run] gh release create', tag);
    console.log(releaseBody);
  } else {
    const notesFile = path.join(root, '.release-notes.tmp.md');
    fs.writeFileSync(notesFile, releaseBody);
    try {
      runInherit('gh', [
        'release',
        'create',
        tag,
        '--title',
        tag,
        '--notes-file',
        notesFile,
      ]);
    } finally {
      fs.unlinkSync(notesFile);
    }
  }
}

console.log(`[release] done → ${tag}`);
