#!/usr/bin/env node
import { compare, human } from '../lib/report.mjs';

const help = `Usage: instruct-delta --base <ref> --head <ref> [--json] [--limit <n>]

Compare structural AGENTS.md and CLAUDE.md coverage in two Git commits.
Run from any directory inside the repository, or inside a bare repository.

  --base <ref>   Base commit revision (required)
  --head <ref>   Head commit revision (required)
  --json         Emit the complete versioned report, never truncated
  --limit <n>    Paths shown per instruction per tree (default: 10)
  --help         Show this help
  --version      Show version

Nested instructions retain parent coverage. Symlinks are not followed.
Submodules are opaque entries; their contents are not inspected.
`;

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    process.stdout.write(help);
  } else if (args.length === 1 && args[0] === '--version') {
    process.stdout.write('0.1.0\n');
  } else {
    const options = {};
    const seen = new Set();
    for (let index = 0; index < args.length; index++) {
      const flag = args[index];
      if (!['--base', '--head', '--json', '--limit'].includes(flag)) throw new Error(`Unknown argument ${JSON.stringify(flag)}. Use --help.`);
      if (seen.has(flag)) throw new Error(`Duplicate argument ${flag}.`);
      seen.add(flag);
      if (flag === '--json') options.json = true;
      else {
        const value = args[++index];
        if (!value || value.startsWith('-')) throw new Error(`Missing or invalid value for ${flag}.`);
        options[flag.slice(2)] = value;
      }
    }
    if (!options.base || !options.head) throw new Error('--base and --head are required. Use --help.');
    if (options.limit !== undefined && (!/^\d+$/.test(options.limit) || !Number.isSafeInteger(Number(options.limit)))) throw new Error('--limit must be a non-negative safe integer.');
    const report = await compare(options);
    process.stdout.write(options.json ? JSON.stringify(report, null, 2) + '\n' : human(report, options.limit === undefined ? 10 : Number(options.limit)));
  }
} catch (error) {
  process.stderr.write(`instruct-delta: ${error.message}\n`);
  process.exitCode = 1;
}
