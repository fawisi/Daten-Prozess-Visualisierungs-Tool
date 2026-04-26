import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildMcpEntry,
  detectWorkspaceKind,
  runInit,
  runInitCli,
} from './init-cli.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'viso-init-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function read(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, 'utf-8')) as Record<string, unknown>;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe('buildMcpEntry', () => {
  it('produces the canonical npx invocation', () => {
    const entry = buildMcpEntry({
      erdFile: './schema.dbml',
      bpmnFile: './process.bpmn.json',
    });
    expect(entry).toEqual({
      command: 'npx',
      args: [
        '-y',
        'viso-mcp@latest',
        '--file',
        './schema.dbml',
        '--bpmn-file',
        './process.bpmn.json',
      ],
    });
  });
});

describe('detectWorkspaceKind', () => {
  it('detects a Claude workspace via the .claude directory', async () => {
    await mkdir(join(tempDir, '.claude'), { recursive: true });
    expect(await detectWorkspaceKind(tempDir)).toBe('claude');
  });

  it('detects a Node project via package.json', async () => {
    await writeFile(join(tempDir, 'package.json'), '{}');
    expect(await detectWorkspaceKind(tempDir)).toBe('node');
  });

  it('returns unknown for a bare directory', async () => {
    expect(await detectWorkspaceKind(tempDir)).toBe('unknown');
  });
});

describe('runInit', () => {
  const opts = (overrides: Partial<Parameters<typeof runInit>[0]>) => ({
    cwd: tempDir,
    erdFile: './schema.dbml',
    bpmnFile: './process.bpmn.json',
    global: false,
    dryRun: false,
    force: false,
    ...overrides,
  });

  it('creates a fresh .mcp.json when none exists', async () => {
    const result = await runInit(opts({}));
    expect(result.action).toBe('created');
    const contents = await read(join(tempDir, '.mcp.json'));
    const servers = contents.mcpServers as Record<string, unknown>;
    expect(servers['viso-mcp']).toBeDefined();
  });

  it('merges into an existing .mcp.json without touching other servers', async () => {
    const existing = {
      mcpServers: {
        other: { command: 'node', args: ['./other.js'] },
      },
    };
    await writeFile(join(tempDir, '.mcp.json'), JSON.stringify(existing, null, 2));

    const result = await runInit(opts({}));
    expect(result.action).toBe('added');

    const after = await read(join(tempDir, '.mcp.json'));
    const servers = after.mcpServers as Record<string, unknown>;
    expect(servers.other).toEqual(existing.mcpServers.other);
    expect(servers['viso-mcp']).toBeDefined();
  });

  it('updates an existing viso-mcp entry and saves a .bak', async () => {
    const stale = {
      mcpServers: {
        'viso-mcp': { command: 'node', args: ['./old/path'] },
      },
    };
    await writeFile(join(tempDir, '.mcp.json'), JSON.stringify(stale, null, 2));

    const result = await runInit(opts({}));
    expect(result.action).toBe('updated');

    expect(await exists(join(tempDir, '.mcp.json.bak'))).toBe(true);
    const after = await read(join(tempDir, '.mcp.json'));
    const entry = (after.mcpServers as Record<string, unknown>)['viso-mcp'] as {
      command: string;
      args: string[];
    };
    expect(entry.command).toBe('npx');
    expect(entry.args).toContain('viso-mcp@latest');
  });

  it('is a noop when the entry already matches', async () => {
    await runInit(opts({})); // create
    const first = await readFile(join(tempDir, '.mcp.json'), 'utf-8');
    const firstMtime = (await stat(join(tempDir, '.mcp.json'))).mtimeMs;

    // Small sleep so mtime would change if we rewrote
    await new Promise((r) => setTimeout(r, 20));
    const result = await runInit(opts({}));
    expect(result.action).toBe('noop');

    const second = await readFile(join(tempDir, '.mcp.json'), 'utf-8');
    const secondMtime = (await stat(join(tempDir, '.mcp.json'))).mtimeMs;
    expect(second).toBe(first);
    expect(secondMtime).toBe(firstMtime);
  });

  it('dry-run never touches the filesystem', async () => {
    const result = await runInit(opts({ dryRun: true }));
    expect(result.action).toBe('created');
    expect(await exists(join(tempDir, '.mcp.json'))).toBe(false);
  });

  it('refuses to overwrite a file that is not valid JSON', async () => {
    await writeFile(join(tempDir, '.mcp.json'), 'this is not json');
    await expect(runInit(opts({}))).rejects.toThrow(/not valid JSON/);
  });
});

describe('runInitCli', () => {
  it('handles --help and exits 0', async () => {
    expect(await runInitCli(['--help'], tempDir)).toBe(0);
  });

  it('rejects unknown flags with exit 2', async () => {
    expect(await runInitCli(['--totally-unknown'], tempDir)).toBe(2);
  });

  it('writes .mcp.json with defaults when run in a detected workspace', async () => {
    await mkdir(join(tempDir, '.claude'), { recursive: true });
    const code = await runInitCli([], tempDir);
    expect(code).toBe(0);
    expect(await exists(join(tempDir, '.mcp.json'))).toBe(true);
  });

  it('--format=dbml is the default and writes ./schema.dbml as erdFile', async () => {
    await mkdir(join(tempDir, '.claude'), { recursive: true });
    expect(await runInitCli([], tempDir)).toBe(0);
    const after = await read(join(tempDir, '.mcp.json'));
    const entry = (after.mcpServers as Record<string, unknown>)['viso-mcp'] as {
      args: string[];
    };
    expect(entry.args).toContain('./schema.dbml');
  });

  it('--format=json switches the default erdFile to ./schema.erd.json', async () => {
    await mkdir(join(tempDir, '.claude'), { recursive: true });
    expect(await runInitCli(['--format=json'], tempDir)).toBe(0);
    const after = await read(join(tempDir, '.mcp.json'));
    const entry = (after.mcpServers as Record<string, unknown>)['viso-mcp'] as {
      args: string[];
    };
    expect(entry.args).toContain('./schema.erd.json');
    expect(entry.args).not.toContain('./schema.dbml');
  });

  it('rejects an invalid --format value with exit 2', async () => {
    expect(await runInitCli(['--format=xml'], tempDir)).toBe(2);
  });

  it('--with-samples copies the bundled DBML, BPMN, and Landscape fixtures', async () => {
    await mkdir(join(tempDir, '.claude'), { recursive: true });
    expect(await runInitCli(['--with-samples'], tempDir)).toBe(0);
    expect(await exists(join(tempDir, 'schema.dbml'))).toBe(true);
    expect(await exists(join(tempDir, 'process.bpmn.json'))).toBe(true);
    expect(await exists(join(tempDir, 'landscape.landscape.json'))).toBe(true);
  });

  it('--with-samples + --format=json copies the JSON ERD fixture instead', async () => {
    await mkdir(join(tempDir, '.claude'), { recursive: true });
    expect(await runInitCli(['--with-samples', '--format=json'], tempDir)).toBe(0);
    expect(await exists(join(tempDir, 'schema.erd.json'))).toBe(true);
    expect(await exists(join(tempDir, 'schema.dbml'))).toBe(false);
  });
});
