/**
 * backend/dist/server.mjs is committed (Railway deploys the backend folder on
 * its own, without the shared src/ code). This fails if it is out of date —
 * fix with: npm run build:backend
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('committed backend bundle matches the sources', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'kc-bundle-')), 'server.mjs');
  execFileSync(process.execPath, [
    'node_modules/rolldown/bin/cli.mjs',
    'backend/src/index.ts',
    '--file', out, '--platform', 'node', '--format', 'esm', '--external', 'pg',
  ], { stdio: 'pipe' });
  const fresh = readFileSync(out, 'utf8');
  const committed = readFileSync('backend/dist/server.mjs', 'utf8');
  expect(committed === fresh, 'backend/dist/server.mjs is stale — run `npm run build:backend`').toBe(true);
}, 30_000);
