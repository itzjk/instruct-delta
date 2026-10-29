import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const cwd = resolve(process.argv[2] ?? '.demo-repo');
mkdirSync(cwd);
const env = {
  ...process.env,
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_COUNT: '0',
  GIT_AUTHOR_NAME: 'Demo', GIT_AUTHOR_EMAIL: 'demo@example.com',
  GIT_COMMITTER_NAME: 'Demo', GIT_COMMITTER_EMAIL: 'demo@example.com',
  GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z'
};
function git(...args) { return execFileSync('git', args, { cwd, env, encoding: 'utf8' }); }
function put(path, text) { mkdirSync(dirname(join(cwd, path)), { recursive: true }); writeFileSync(join(cwd, path), text); }
git('init', '-q', '-b', 'main');
put('AGENTS.md', 'Run the tests before committing.\n');
put('packages/api/CLAUDE.md', 'Keep API responses consistent.\n');
put('packages/api/server.js', 'export const port = 3000;\n');
put('packages/web/app.js', 'export const title = "Example";\n');
put('README.md', '# Example monorepo\n');
git('add', '.');
git('commit', '-qm', 'Add example monorepo');
git('tag', 'base');
put('AGENTS.md', 'Run the tests and check formatting before committing.\n');
put('packages/api/CLAUDE.md', 'Keep API responses consistent and validate request bodies.\n');
git('add', '.');
git('commit', '-qm', 'Update root and API instructions');
git('tag', 'head');
process.stdout.write('Created example repo with base and head tags.\n');
