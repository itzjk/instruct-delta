import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const decoder = new TextDecoder('utf-8', { fatal: true });
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const instruction = path => /(^|\/)(AGENTS|CLAUDE)\.md$/.test(path);

async function git(cwd, args) {
  try {
    const { stdout } = await execute('git', ['--no-pager', ...args], {
      cwd,
      encoding: 'buffer',
      maxBuffer: 256 * 1024 * 1024,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_NO_REPLACE_OBJECTS: '1', GIT_NO_LAZY_FETCH: '1', LC_ALL: 'C' }
    });
    return decoder.decode(stdout);
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('Git is required and must be on PATH.');
    if (error instanceof TypeError) throw new Error('Git paths must be valid UTF-8.');
    if (error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') throw new Error('Git output exceeds the 256 MiB limit.');
    throw new Error('Cannot read Git objects. Run inside a repository with the requested history available locally.');
  }
}

function validateRef(ref) {
  if (typeof ref !== 'string' || !ref || ref.startsWith('-') || /[\s\x00-\x1f\x7f:]|\.\./u.test(ref)) {
    throw new Error('Each ref must be one commit revision, without option prefixes, ranges, whitespace, or path selectors.');
  }
}

async function revision(cwd, ref) {
  validateRef(ref);
  try {
    const commit = (await git(cwd, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`])).trim();
    const tree = (await git(cwd, ['rev-parse', '--verify', '--end-of-options', `${commit}^{tree}`])).trim();
    return { ref, commit, tree };
  } catch {
    throw new Error(`Cannot resolve ref ${JSON.stringify(ref)} to a commit. Check the ref and fetch its history if needed.`);
  }
}

async function entries(cwd, tree) {
  const output = await git(cwd, ['ls-tree', '-r', '-z', '--full-tree', tree]);
  return new Map(output.split('\0').filter(Boolean).map(record => {
    const tab = record.indexOf('\t');
    const [mode, type, oid] = record.slice(0, tab).split(' ');
    const path = record.slice(tab + 1);
    if (!['100644', '100755', '120000', '160000'].includes(mode)) throw new Error(`Unsupported Git mode ${mode} at ${JSON.stringify(path)}.`);
    return [path, { path, mode, oid, kind: mode === '120000' ? 'symlink' : type === 'commit' ? 'submodule' : 'file' }];
  }).sort(([a], [b]) => order(a, b)));
}

function coverage(tree, path) {
  if (path === null) return [];
  const slash = path.lastIndexOf('/');
  const prefix = slash === -1 ? '' : path.slice(0, slash + 1);
  return [...tree.values()].filter(entry => entry.path.startsWith(prefix));
}

function delta(before, after) {
  const base = new Set(before.map(entry => entry.path));
  const head = new Set(after.map(entry => entry.path));
  return {
    gained: [...head].filter(path => !base.has(path)).sort(order),
    lost: [...base].filter(path => !head.has(path)).sort(order),
    retained: [...base].filter(path => head.has(path)).sort(order)
  };
}

function counted(paths) {
  return { count: paths.length, paths };
}

function instructionEntry(tree, path) {
  if (path === null) return null;
  const entry = tree.get(path);
  return { ...entry, directory: path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '.' };
}

export async function compare({ cwd = process.cwd(), base, head }) {
  validateRef(base);
  validateRef(head);
  await git(cwd, ['rev-parse', '--git-dir']);
  const baseRevision = await revision(cwd, base);
  const headRevision = await revision(cwd, head);
  const baseEntries = await entries(cwd, baseRevision.tree);
  const headEntries = await entries(cwd, headRevision.tree);
  const raw = await git(cwd, ['diff-tree', '--no-commit-id', '--raw', '-r', '-z', '--no-abbrev', '--no-ext-diff', '--no-textconv', '--no-relative', '--ignore-submodules=none', '-M50%', '-l0', baseRevision.tree, headRevision.tree, '--']);
  const tokens = raw.split('\0');
  const changes = [];
  const coveredBase = new Map();
  const coveredHead = new Map();
  for (let index = 0; index < tokens.length - 1;) {
    const header = tokens[index++];
    const status = header.split(' ').at(-1);
    const first = tokens[index++];
    const second = status.startsWith('R') || status.startsWith('C') ? tokens[index++] : first;
    const beforePath = status === 'A' || !instruction(first) || baseEntries.get(first)?.kind === 'submodule' ? null : first;
    const afterPath = status === 'D' || !instruction(second) || headEntries.get(second)?.kind === 'submodule' ? null : second;
    if (beforePath === null && afterPath === null) continue;
    const before = coverage(baseEntries, beforePath);
    const after = coverage(headEntries, afterPath);
    for (const entry of before) coveredBase.set(entry.path, entry);
    for (const entry of after) coveredHead.set(entry.path, entry);
    const difference = delta(before, after);
    changes.push({
      status: beforePath === null ? 'added' : afterPath === null ? 'deleted' : status.startsWith('R') ? 'renamed' : 'modified',
      before: instructionEntry(baseEntries, beforePath),
      after: instructionEntry(headEntries, afterPath),
      coverage: { base: { count: before.length, entries: before }, head: { count: after.length, entries: after } },
      delta: Object.fromEntries(Object.entries(difference).map(([key, paths]) => [key, counted(paths)]))
    });
  }
  changes.sort((a, b) => order(a.after?.path ?? a.before.path, b.after?.path ?? b.before.path));
  const unionBase = [...coveredBase.values()].sort((a, b) => order(a.path, b.path));
  const unionHead = [...coveredHead.values()].sort((a, b) => order(a.path, b.path));
  const difference = delta(unionBase, unionHead);
  return {
    schemaVersion: 1,
    revisions: { base: baseRevision, head: headRevision },
    summary: {
      changedInstructions: changes.length,
      baseCovered: unionBase.length,
      headCovered: unionHead.length,
      ...Object.fromEntries(Object.entries(difference).map(([key, paths]) => [key, counted(paths)]))
    },
    changes
  };
}

export function human(report, limit = 10) {
  const { summary, revisions, changes } = report;
  const lines = [
    `instruct-delta ${revisions.base.commit.slice(0, 8)} -> ${revisions.head.commit.slice(0, 8)}`,
    `${summary.changedInstructions} changed instruction file(s) | ${summary.baseCovered} -> ${summary.headCovered} covered paths`,
    `Coverage: +${summary.gained.count} gained, -${summary.lost.count} lost, ${summary.retained.count} retained`,
    'Structural directory coverage; paths are compared by name.'
  ];
  if (!changes.length) lines.push('No instruction changes.');
  for (const change of changes) {
    const label = change.status === 'renamed' ? `${JSON.stringify(change.before.path)} -> ${JSON.stringify(change.after.path)}` : JSON.stringify((change.after ?? change.before).path);
    lines.push('', `${change.status.toUpperCase()} ${label}`);
    for (const side of ['before', 'after']) {
      const entry = change[side];
      if (entry) lines.push(`  ${side}: ${entry.kind} (${entry.mode})`);
    }
    for (const side of ['base', 'head']) {
      const { count, entries } = change.coverage[side];
      lines.push(`  ${side} coverage: ${count}`);
      for (const entry of entries.slice(0, limit)) lines.push(`    ${JSON.stringify(entry.path)}${entry.kind === 'file' ? '' : ` [${entry.kind}]`}`);
      if (count > limit) lines.push(`    ... ${count - limit} more; use --json for every path`);
    }
    lines.push(`  +${change.delta.gained.count} gained, -${change.delta.lost.count} lost, ${change.delta.retained.count} retained`);
  }
  return lines.join('\n') + '\n';
}
