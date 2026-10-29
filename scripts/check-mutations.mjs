import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const source = fileURLToPath(new URL('../', import.meta.url));
const mutations = [
  ['lost coverage removed', 'lost: [...base].filter(path => !head.has(path)).sort(order)', 'lost: []'],
  ['base tree replaced with checkout HEAD', 'const baseEntries = await entries(cwd, baseRevision.tree);', "const baseEntries = await entries(cwd, (await git(cwd, ['rev-parse', 'HEAD^{tree}'])).trim());"]
];
for (const [name, before, after] of mutations) {
  const cwd = mkdtempSync(join(tmpdir(), 'instruct-delta-mutation-'));
  try {
    for (const path of ['lib', 'bin', 'test', 'package.json']) cpSync(join(source, path), join(cwd, path), { recursive: true });
    const path = join(cwd, 'lib/report.mjs');
    const original = readFileSync(path, 'utf8');
    if (!original.includes(before)) throw new Error(`Mutation target missing: ${name}`);
    writeFileSync(path, original.replace(before, after));
    const result = spawnSync(process.execPath, ['--test'], { cwd, encoding: 'utf8', timeout: 60000 });
    if (result.error || result.signal || result.status === 0) throw new Error(`Mutation was not rejected by assertions: ${name}`);
    if (!/AssertionError/.test(result.stdout + result.stderr)) throw new Error(`Mutation failed without an assertion: ${name}`);
    const failed = (result.stdout + result.stderr).match(/(?:# |ℹ )fail (\d+)/)?.[1] ?? 'unknown';
    process.stdout.write(`Killed: ${name} (${failed} failing tests)\n`);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
