import { readFile, writeFile, stat, rename, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';

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
    erdFile: './schema.dbml',
    bpmnFile: './process.bpmn.json',
    global: false,
    dryRun: false,
    force: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--global') opts.global = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--force') opts.force = true;
    else if (arg.startsWith('--file=')) opts.erdFile = arg.slice('--file='.length);
    else if (arg === '--file') opts.erdFile = argv[++i];
    else if (arg.startsWith('--bpmn-file=')) {
      opts.bpmnFile = arg.slice('--bpmn-file='.length);
    } else if (arg === '--bpmn-file') opts.bpmnFile = argv[++i];
    else if (arg === '-h' || arg === '--help') {
      printInitHelp();
      return 0;
    } else {
      process.stderr.write(`Unknown flag: ${arg}\n`);
      printInitHelp();
      return 2;
    }
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
  --file <path>         ERD source file (default: ./schema.dbml)
  --bpmn-file <path>    BPMN process file (default: ./process.bpmn.json)
  --global              Write to ~/.claude.json instead of ./.mcp.json
  --dry-run             Show the diff without writing anything
  --force               Overwrite an existing viso-mcp entry without saving a .bak
  -h, --help            Show this help
`
  );
}
