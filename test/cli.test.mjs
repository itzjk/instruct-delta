import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/instruct-delta.mjs', import.meta.url));
const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com', GIT_CONFIG_COUNT: '0' };
function git(cwd, ...args) { return execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim(); }
function repo(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'instruct-delta-test-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  git(cwd, 'init', '-q', '-b', 'main');
  return cwd;
}
function put(cwd, path, text = path) { mkdirSync(dirname(join(cwd, path)), { recursive: true }); writeFileSync(join(cwd, path), text); }
function commit(cwd) { git(cwd, 'add', '-A'); git(cwd, 'commit', '-qm', 'Fixture'); return git(cwd, 'rev-parse', 'HEAD'); }
function run(cwd, args = []) { return spawnSync(process.execPath, [cli, ...args], { cwd, env, encoding: 'utf8' }); }
function report(cwd, base, head, extra = []) {
  const result = run(cwd, ['--base', base, '--head', head, '--json', ...extra]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}
function paths(change, side) { return change.coverage[side].entries.map(entry => entry.path); }

test('root and nested instructions retain overlapping coverage and union counts', t => {
  const cwd = repo(t);
  for (const path of ['AGENTS.md', 'app/CLAUDE.md', 'app/main.js', 'other.txt']) put(cwd, path);
  const base = commit(cwd);
  put(cwd, 'AGENTS.md', 'Root changed');
  put(cwd, 'app/CLAUDE.md', 'Nested changed');
  const head = commit(cwd);
  const result = report(cwd, base, head);
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.revisions.base.commit, base);
  assert.equal(result.revisions.head.commit, head);
  assert.equal(result.revisions.base.tree, git(cwd, 'rev-parse', `${base}^{tree}`));
  assert.deepEqual(result.changes.map(c => c.status), ['modified', 'modified']);
  assert.deepEqual(paths(result.changes[0], 'base'), ['AGENTS.md', 'app/CLAUDE.md', 'app/main.js', 'other.txt']);
  assert.deepEqual(paths(result.changes[1], 'head'), ['app/CLAUDE.md', 'app/main.js']);
  assert.equal(result.summary.retained.count, 4);
  assert.equal(result.summary.baseCovered, 4);
  assert.equal(result.summary.headCovered, 4);
});

test('addition, deletion, and moved source paths use both committed trees', t => {
  const cwd = repo(t);
  put(cwd, 'old/AGENTS.md', 'Old rules');
  put(cwd, 'old/move.js');
  put(cwd, 'new/stay.js');
  const base = commit(cwd);
  rmSync(join(cwd, 'old/AGENTS.md'));
  renameSync(join(cwd, 'old/move.js'), join(cwd, 'new/move.js'));
  put(cwd, 'new/CLAUDE.md', 'Different new rules');
  const head = commit(cwd);
  const result = report(cwd, base, head);
  assert.deepEqual(result.changes.map(c => c.status), ['added', 'deleted']);
  assert.deepEqual(result.summary.lost.paths, ['old/AGENTS.md', 'old/move.js']);
  assert.deepEqual(result.summary.gained.paths, ['new/CLAUDE.md', 'new/move.js', 'new/stay.js']);
  assert.equal(result.summary.lost.count, 2);
  assert.equal(result.summary.retained.count, 0);
  assert.deepEqual(paths(result.changes[1], 'base'), ['old/AGENTS.md', 'old/move.js']);
});

test('instruction rename reports old and new directory coverage', t => {
  const cwd = repo(t);
  put(cwd, 'a/AGENTS.md', 'Keep this identical for rename detection.');
  put(cwd, 'a/a.js');
  put(cwd, 'b/b.js');
  const base = commit(cwd);
  renameSync(join(cwd, 'a/AGENTS.md'), join(cwd, 'b/CLAUDE.md'));
  const head = commit(cwd);
  const result = report(cwd, base, head);
  assert.equal(result.changes.length, 1);
  const change = result.changes[0];
  assert.equal(change.status, 'renamed');
  assert.equal(change.before.path, 'a/AGENTS.md');
  assert.equal(change.after.path, 'b/CLAUDE.md');
  assert.deepEqual(change.delta.lost.paths, ['a/AGENTS.md', 'a/a.js']);
  assert.deepEqual(change.delta.gained.paths, ['b/CLAUDE.md', 'b/b.js']);
});

test('rename into or out of a recognized instruction name is addition or deletion', t => {
  const cwd = repo(t);
  put(cwd, 'notes.txt', 'Distinct source notes');
  put(cwd, 'AGENTS.md', 'Distinct old rules');
  const base = commit(cwd);
  renameSync(join(cwd, 'notes.txt'), join(cwd, 'CLAUDE.md'));
  renameSync(join(cwd, 'AGENTS.md'), join(cwd, 'retired.txt'));
  const result = report(cwd, base, commit(cwd));
  assert.deepEqual(result.changes.map(c => c.status), ['deleted', 'added']);
});

test('NUL-delimited Git paths preserve spaces, Unicode, tabs, newlines, and symlinks', t => {
  const cwd = repo(t);
  const directory = 'space café\tline\nnext';
  const rule = `${directory}/AGENTS.md`;
  put(cwd, `${directory}/文件\t\n.js`);
  symlinkSync('/missing/outside-target', join(cwd, directory, 'link'));
  const base = commit(cwd);
  symlinkSync('../../outside-rules', join(cwd, rule));
  const head = commit(cwd);
  const result = report(cwd, base, head);
  const change = result.changes[0];
  assert.equal(change.after.path, rule);
  assert.equal(change.after.kind, 'symlink');
  assert.equal(change.after.mode, '120000');
  assert.equal(change.coverage.head.entries.find(e => e.path.endsWith('/link')).kind, 'symlink');
  assert.ok(paths(change, 'head').includes(`${directory}/文件\t\n.js`));
  const human = run(cwd, ['--base', base, '--head', head]);
  assert.equal(human.status, 0);
  assert.ok(human.stdout.includes(JSON.stringify(rule)));
  assert.ok(human.stdout.includes('[symlink]'));
});

test('dirty checkout, staged index, HEAD, untracked files and content stay unchanged', t => {
  const cwd = repo(t);
  put(cwd, 'AGENTS.md', 'Base');
  put(cwd, 'removed.js');
  const base = commit(cwd);
  put(cwd, 'AGENTS.md', 'Head');
  rmSync(join(cwd, 'removed.js'));
  put(cwd, 'head.js');
  const head = commit(cwd);
  git(cwd, 'checkout', '-q', base);
  put(cwd, 'AGENTS.md', 'Staged instructions');
  git(cwd, 'add', 'AGENTS.md');
  put(cwd, 'AGENTS.md', 'Unstaged instructions');
  put(cwd, 'untracked.txt', 'Private local content');
  const snapshot = () => ({
    head: git(cwd, 'rev-parse', 'HEAD'),
    index: readFileSync(join(cwd, '.git/index')).toString('hex'),
    state: git(cwd, 'status', '--porcelain=v1', '-z'),
    files: ['AGENTS.md', 'removed.js', 'untracked.txt'].map(p => readFileSync(join(cwd, p)).toString('hex'))
  });
  const before = snapshot();
  const result = report(cwd, base, head);
  assert.deepEqual(result.summary.lost.paths, ['removed.js']);
  assert.deepEqual(result.summary.gained.paths, ['head.js']);
  assert.deepEqual(paths(result.changes[0], 'base'), ['AGENTS.md', 'removed.js']);
  assert.deepEqual(paths(result.changes[0], 'head'), ['AGENTS.md', 'head.js']);
  assert.deepEqual(snapshot(), before);
});

test('unchanged instructions and repositories without instructions produce empty reports', t => {
  const cwd = repo(t);
  put(cwd, 'agents.md');
  put(cwd, 'CLAUDE.MD');
  const base = commit(cwd);
  put(cwd, 'src.js');
  const head = commit(cwd);
  assert.deepEqual(report(cwd, base, head).changes, []);
  put(cwd, 'AGENTS.md');
  const rule = commit(cwd);
  put(cwd, 'more.js');
  const result = report(cwd, rule, commit(cwd));
  assert.equal(result.summary.changedInstructions, 0);
  assert.equal(result.summary.baseCovered, 0);
  assert.equal(result.summary.retained.count, 0);
  assert.deepEqual(result.changes, []);
  assert.match(run(cwd, ['--base', base, '--head', head]).stdout, /No instruction changes/);
});

test('output limit affects only human paths, JSON stays complete and deterministic', t => {
  const cwd = repo(t);
  put(cwd, 'AGENTS.md', 'Before');
  for (let i = 0; i < 15; i++) put(cwd, `file-${i}.js`);
  const base = commit(cwd);
  put(cwd, 'AGENTS.md', 'After');
  const head = commit(cwd);
  const args = ['--base', base, '--head', head, '--limit', '1'];
  const human = run(cwd, args);
  assert.match(human.stdout, /15 more; use --json/);
  assert.equal(human.stdout.includes('"file-0.js"'), false);
  const result = report(cwd, base, head, ['--limit', '0']);
  assert.equal(result.changes[0].coverage.head.entries.length, 16);
  assert.deepEqual(result, report(cwd, base, head));
});

test('invalid input, invalid refs, unborn repos, and non-repositories fail clearly', t => {
  const cwd = repo(t);
  assert.match(run(cwd, ['--base', 'HEAD', '--head', 'HEAD']).stderr, /Cannot resolve ref/);
  put(cwd, 'file');
  commit(cwd);
  for (const args of [[], ['--base', 'HEAD'], ['--base', '--all', '--head', 'HEAD'], ['--base', 'HEAD..main', '--head', 'HEAD'], ['--base', 'HEAD:file', '--head', 'HEAD'], ['--base', 'HEAD\n', '--head', 'HEAD'], ['--base', 'no-such-ref', '--head', 'HEAD'], ['--base', 'HEAD', '--head', 'HEAD', '--limit', '-1'], ['--base', 'HEAD', '--head', 'HEAD', '--limit', '1.5'], ['--base', 'HEAD', '--head', 'HEAD', '--json', '--json'], ['--help', '--head', 'HEAD'], ['--unknown']]) {
    const result = run(cwd, args);
    assert.equal(result.status, 1, JSON.stringify(args));
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^instruct-delta: /);
  }
  const outside = mkdtempSync(join(tmpdir(), 'instruct-delta-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  assert.equal(run(outside, ['--base', 'HEAD', '--head', 'HEAD']).status, 1);
  assert.match(run(outside, ['--help']).stdout, /Usage:/);
  assert.equal(run(outside, ['--version']).stdout, '0.1.0\n');
});

test('works from a nested cwd, a bare repo, annotated tags and abbreviated refs', t => {
  const cwd = repo(t);
  put(cwd, 'AGENTS.md', 'Before');
  put(cwd, 'nested/source.js');
  const base = commit(cwd);
  git(cwd, 'tag', '-a', 'base', '-m', 'Base');
  put(cwd, 'AGENTS.md', 'After');
  const head = commit(cwd);
  assert.equal(report(join(cwd, 'nested'), 'base', head.slice(0, 9)).summary.retained.count, 2);
  const bare = resolve(cwd, 'bare.git');
  git(cwd, 'clone', '-q', '--bare', cwd, bare);
  assert.equal(report(bare, base, head).changes.length, 1);
});

test('mode changes and opaque submodules are explicit tree entries', t => {
  const cwd = repo(t);
  put(cwd, 'AGENTS.md', 'Rules');
  const base = commit(cwd);
  git(cwd, 'update-index', '--chmod=+x', 'AGENTS.md');
  git(cwd, 'update-index', '--add', '--cacheinfo', `160000,${base},vendor/module`);
  git(cwd, 'commit', '-qm', 'Mode and gitlink');
  const result = report(cwd, base, 'HEAD');
  assert.equal(result.changes[0].after.mode, '100755');
  const entry = result.changes[0].coverage.head.entries.find(e => e.path === 'vendor/module');
  assert.equal(entry.kind, 'submodule');
  assert.equal(entry.mode, '160000');
  assert.deepEqual(result.summary.gained.paths, ['vendor/module']);
});

test('an instruction-looking gitlink is opaque, not an instruction file', t => {
  const cwd = repo(t);
  put(cwd, 'seed');
  const base = commit(cwd);
  git(cwd, 'update-index', '--add', '--cacheinfo', `160000,${base},AGENTS.md`);
  git(cwd, 'commit', '-qm', 'Add opaque gitlink');
  assert.deepEqual(report(cwd, base, 'HEAD').changes, []);
});

test('deleting a nested instruction loses its coverage even when an unchanged parent remains', t => {
  const cwd = repo(t);
  put(cwd, 'AGENTS.md', 'Root rules');
  put(cwd, 'app/AGENTS.md', 'App rules');
  put(cwd, 'app/source.js');
  const base = commit(cwd);
  rmSync(join(cwd, 'app/AGENTS.md'));
  const result = report(cwd, base, commit(cwd));
  assert.equal(result.summary.changedInstructions, 1);
  assert.deepEqual(result.summary.lost.paths, ['app/AGENTS.md', 'app/source.js']);
  assert.equal(result.summary.headCovered, 0);
});

test('invalid UTF-8 paths fail instead of silently replacing bytes', t => {
  const cwd = repo(t);
  put(cwd, 'AGENTS.md', 'Base');
  const base = commit(cwd);
  put(cwd, 'AGENTS.md', 'Head');
  git(cwd, 'add', 'AGENTS.md');
  const oid = git(cwd, 'rev-parse', `${base}:AGENTS.md`);
  execFileSync('git', ['update-index', '-z', '--index-info'], {
    cwd, env, input: Buffer.concat([Buffer.from(`100644 ${oid}\t`), Buffer.from([0xff, 0])])
  });
  git(cwd, 'commit', '-qm', 'Add non-UTF-8 tree entry');
  const head = git(cwd, 'rev-parse', 'HEAD');
  const result = run(cwd, ['--base', base, '--head', head, '--json']);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /valid UTF-8/);
});
