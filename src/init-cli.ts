import { readFile, writeFile, stat, rename, mkdir, copyFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

export type ErdSourceFormat = 'dbml' | 'json';

/**
 * Resolve the absolute path of the bundled fixtures directory. Works in
 * both the source-tree (src/init-cli.ts) and the dist build (dist/init-cli.js)
 * by walking from the current module location up to the package root.
 */
function fixturesDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // Source path: <pkg>/src   ; Dist path: <pkg>/dist  ; Either way fixtures live at <pkg>/fixtures.
  return resolve(here, '..', 'fixtures');
}

/**
 * Configuration object that becomes the `viso-mcp` entry in `.mcp.json`.
 * `npx viso-mcp@latest` (no subcommand) defaults to MCP stdio mode, so we
 * pass the file flags through directly.
 */
export function buildMcpEntry(opts: {
  erdFile: string;
  bpmnFile: string;
}): Record<string, unknown> {
  return {
    command: 'npx',
    args: [
      '-y',
      'viso-mcp@latest',
      '--file',
      opts.erdFile,
      '--bpmn-file',
      opts.bpmnFile,
    ],
  };
}

export interface InitOptions {
  cwd: string;
  erdFile: string;
  bpmnFile: string;
  landscapeFile: string;
  format: ErdSourceFormat;
  withSamples: boolean;
  global: boolean;
  dryRun: boolean;
  force: boolean;
}

export interface InitResult {
  target: string;
  action: 'created' | 'added' | 'updated' | 'noop';
  previous?: unknown;
  next?: unknown;
  message: string;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export async function detectWorkspaceKind(cwd: string): Promise<'claude' | 'node' | 'unknown'> {
  if (await pathExists(join(cwd, '.claude'))) return 'claude';
  if (await pathExists(join(cwd, '.mcp.json'))) return 'claude';
  if (await pathExists(join(cwd, 'package.json'))) return 'node';
  return 'unknown';
}

export async function runInit(opts: InitOptions): Promise<InitResult> {
  const target = opts.global
    ? join(homedir(), '.claude.json')
    : join(opts.cwd, '.mcp.json');

  // --with-samples: copy bundled demo fixtures next to the .mcp.json so a
  // first-time user has an ERD, a BPMN process, and a Landscape ready to
  // open without needing to know the file shapes (CR-6 / MI-3).
  if (opts.withSamples && !opts.dryRun) {
    await copySampleFiles(opts);
  }

  const nextEntry = buildMcpEntry({
    erdFile: opts.erdFile,
    bpmnFile: opts.bpmnFile,
  });

  let existing: Record<string, unknown> | undefined;
  let existingRaw: string | undefined;
  if (await pathExists(target)) {
    existingRaw = await readFile(target, 'utf-8');
    try {
      existing = JSON.parse(existingRaw) as Record<string, unknown>;
    } catch (err) {
      throw new Error(
        `Existing ${target} is not valid JSON — refusing to overwrite. Fix by hand or pass --force.\n${(err as Error).message}`
      );
    }
  }

  const merged = mergeMcpServers(existing, nextEntry);
  const action = decideAction(existing, nextEntry);

  if (opts.dryRun) {
    return {
      target,
      action,
      previous: existing,
      next: merged,
      message: diffSummary(existing, merged),
    };
  }

  if (action === 'noop') {
    return {
      target,
      action,
      previous: existing,
      next: merged,
      message: 'viso-mcp already configured at ' + target,
    };
  }

  if (action === 'updated' && !opts.force) {
    // Preserve the old entry in a .bak so users can roll back manually.
    if (existingRaw) {
      await writeFile(target + '.bak', existingRaw, 'utf-8');
    }
  }

  await mkdir(dirname(target), { recursive: true });
  const out = JSON.stringify(merged, null, 2) + '\n';
  const tmp = join(dirname(target), `.tmp-${randomUUID()}.json`);
  await writeFile(tmp, out, 'utf-8');
  await rename(tmp, target);

  return {
    target,
    action,
    previous: existing,
    next: merged,
    message: {
      created: `Created ${target} with viso-mcp entry`,
      added: `Added viso-mcp entry to existing ${target}`,
      updated: `Updated existing viso-mcp entry in ${target} (.bak saved)`,
      noop: 'viso-mcp already configured',
    }[action],
  };
}

function mergeMcpServers(
  existing: Record<string, unknown> | undefined,
  nextEntry: Record<string, unknown>
): Record<string, unknown> {
  const base = existing ? { ...existing } : {};
  const servers = ((base.mcpServers as Record<string, unknown>) ?? {});
  return {
    ...base,
    mcpServers: {
      ...servers,
      'viso-mcp': nextEntry,
    },
  };
}

function decideAction(
  existing: Record<string, unknown> | undefined,
  nextEntry: Record<string, unknown>
): InitResult['action'] {
  if (!existing) return 'created';
  const servers = (existing.mcpServers as Record<string, unknown>) ?? {};
  if (!servers['viso-mcp']) return 'added';
  if (JSON.stringify(servers['viso-mcp']) === JSON.stringify(nextEntry)) {
    return 'noop';
  }
  return 'updated';
}

function diffSummary(
  prev: Record<string, unknown> | undefined,
  next: Record<string, unknown>
): string {
  const prevSrv =
    (prev?.mcpServers as Record<string, unknown> | undefined)?.['viso-mcp'];
  const nextSrv = (next.mcpServers as Record<string, unknown>)['viso-mcp'];
  const body = [
    prev ? '--- existing' : '--- (no existing file)',
    JSON.stringify(prevSrv ?? null, null, 2),
    '+++ next',
    JSON.stringify(nextSrv, null, 2),
  ].join('\n');
  return body;
}

export async function runInitCli(argv: string[], cwd: string = process.cwd()): Promise<number> {
  const opts: InitOptions = {
    cwd,
    // Default-erdFile depends on --format; resolved after argv parse.
    erdFile: '',
    bpmnFile: './process.bpmn.json',
    landscapeFile: './landscape.landscape.json',
    format: 'dbml',
    withSamples: false,
    global: false,
    dryRun: false,
    force: false,
  };

  let explicitErdFile = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--global') opts.global = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--force') opts.force = true;
    else if (arg === '--with-samples') opts.withSamples = true;
    else if (arg.startsWith('--format=')) {
      const v = arg.slice('--format='.length);
      if (v !== 'dbml' && v !== 'json') {
        process.stderr.write(`Invalid --format: ${v} (expected dbml | json)\n`);
        return 2;
      }
      opts.format = v;
    } else if (arg === '--format') {
      const v = argv[++i];
      if (v !== 'dbml' && v !== 'json') {
        process.stderr.write(`Invalid --format: ${v} (expected dbml | json)\n`);
        return 2;
      }
      opts.format = v;
    } else if (arg.startsWith('--file=')) {
      opts.erdFile = arg.slice('--file='.length);
      explicitErdFile = true;
    } else if (arg === '--file') {
      opts.erdFile = argv[++i];
      explicitErdFile = true;
    } else if (arg.startsWith('--bpmn-file=')) {
      opts.bpmnFile = arg.slice('--bpmn-file='.length);
    } else if (arg === '--bpmn-file') opts.bpmnFile = argv[++i];
    else if (arg.startsWith('--landscape-file=')) {
      opts.landscapeFile = arg.slice('--landscape-file='.length);
    } else if (arg === '--landscape-file') opts.landscapeFile = argv[++i];
    else if (arg === '-h' || arg === '--help') {
      printInitHelp();
      return 0;
    } else {
      process.stderr.write(`Unknown flag: ${arg}\n`);
      printInitHelp();
      return 2;
    }
  }

  // Resolve default erdFile from --format unless an explicit --file was given.
  if (!explicitErdFile) {
    opts.erdFile = opts.format === 'dbml' ? './schema.dbml' : './schema.erd.json';
  }

  try {
    const kind = await detectWorkspaceKind(cwd);
    if (kind === 'unknown' && !opts.global) {
      process.stderr.write(
        'No .claude/, .mcp.json, or package.json detected in the current directory.\n' +
          'Continuing anyway — viso-mcp will write ./.mcp.json here.\n'
      );
    }
    const result = await runInit(opts);
    if (opts.dryRun) {
      process.stdout.write(`[dry-run] ${result.target} — ${result.action}\n`);
      process.stdout.write(result.message + '\n');
    } else {
      process.stdout.write(result.message + '\n');
    }
    return 0;
  } catch (err) {
    process.stderr.write(`init failed: ${(err as Error).message}\n`);
    return 1;
  }
}

function printInitHelp() {
  process.stderr.write(
    `viso-mcp init — write or merge a .mcp.json entry for this workspace.

Usage: viso-mcp init [options]

Options:
  --format dbml|json     ERD source format (default: dbml — recommended)
  --file <path>          ERD source file (default: ./schema.dbml or ./schema.erd.json)
  --bpmn-file <path>     BPMN process file (default: ./process.bpmn.json)
  --landscape-file <p>   Landscape file (default: ./landscape.landscape.json)
  --with-samples         Copy demo fixtures for ERD, BPMN, Landscape
  --global               Write to ~/.claude.json instead of ./.mcp.json
  --dry-run              Show the diff without writing anything
  --force                Overwrite an existing viso-mcp entry without saving a .bak
  -h, --help             Show this help
`
  );
}

/**
 * Copy bundled demo fixtures into the cwd. Skips files that already exist
 * unless --force is passed (caller passes opts.force through). Best-effort:
 * a missing fixture file is reported on stderr but doesn't abort init.
 */
async function copySampleFiles(opts: InitOptions): Promise<void> {
  const samples = fixturesDir();
  const initSamples = join(samples, 'init-samples');

  const entries: { src: string; dst: string }[] = [
    {
      src: join(
        initSamples,
        opts.format === 'dbml' ? 'schema.dbml' : 'schema.erd.json'
      ),
      dst: join(opts.cwd, opts.erdFile),
    },
    {
      src: join(initSamples, 'process.bpmn.json'),
      dst: join(opts.cwd, opts.bpmnFile),
    },
    {
      src: join(initSamples, 'landscape.landscape.json'),
      dst: join(opts.cwd, opts.landscapeFile),
    },
  ];

  for (const { src, dst } of entries) {
    try {
      await stat(src);
    } catch {
      process.stderr.write(`warning: sample missing at ${src}\n`);
      continue;
    }
    if (await pathExists(dst)) {
      if (!opts.force) {
        process.stderr.write(`skipping ${dst} (exists; use --force to overwrite)\n`);
        continue;
      }
    }
    await mkdir(dirname(dst), { recursive: true });
    await copyFile(src, dst);
  }
}
