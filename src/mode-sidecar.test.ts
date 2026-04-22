import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadModeSidecar, saveModeSidecar } from './mode-sidecar.js';
import { deriveModePath, assertSidecarInsideRoot } from './positions.js';

describe('mode-sidecar', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'viso-mode-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns null when the sidecar does not exist', async () => {
    const sidecar = await loadModeSidecar(join(dir, 'process.bpmn.json'));
    expect(sidecar).toBeNull();
  });

  it('round-trips a bpmn mode sidecar', async () => {
    const source = join(dir, 'process.bpmn.json');
    await saveModeSidecar(source, { kind: 'bpmn', mode: 'simple', version: '1.1' });
    const loaded = await loadModeSidecar(source);
    expect(loaded).toEqual({ kind: 'bpmn', mode: 'simple', version: '1.1' });
  });

  it('rejects a landscape-kind sidecar in v1.1 (branch not yet implemented)', async () => {
    const source = join(dir, 'ops.landscape.json');
    const sidecarPath = deriveModePath(source);
    await writeFile(
      sidecarPath,
      JSON.stringify({ kind: 'landscape', mode: 'l2', version: '1.1' }),
      'utf-8'
    );
    // The landscape branch is added in P2 (plan R7). Until then, no
    // producer exists, and the loader should reject — an unrecognized
    // kind must never silently succeed.
    await expect(loadModeSidecar(source)).rejects.toThrow(/Invalid mode sidecar/);
  });

  it('rejects a sidecar with a malformed JSON body', async () => {
    const sidecarPath = deriveModePath(join(dir, 'process.bpmn.json'));
    await writeFile(sidecarPath, '{not-json', 'utf-8');
    await expect(loadModeSidecar(join(dir, 'process.bpmn.json'))).rejects.toThrow(
      /Invalid JSON/
    );
  });

  it('rejects a sidecar that does not match the schema', async () => {
    const sidecarPath = deriveModePath(join(dir, 'process.bpmn.json'));
    await writeFile(sidecarPath, JSON.stringify({ kind: 'weird', mode: 'x' }), 'utf-8');
    await expect(loadModeSidecar(join(dir, 'process.bpmn.json'))).rejects.toThrow(
      /Invalid mode sidecar/
    );
  });

  it('assertSidecarInsideRoot accepts a sidecar inside the source dir', () => {
    const root = '/tmp/foo';
    expect(assertSidecarInsideRoot('/tmp/foo/bar.mode.json', root)).toBe(
      '/tmp/foo/bar.mode.json'
    );
  });

  it('assertSidecarInsideRoot rejects a traversal attempt', () => {
    const root = '/tmp/foo';
    expect(() => assertSidecarInsideRoot('/tmp/evil/../foo/../evil/x.json', root)).toThrow(
      /outside workspace root/
    );
  });

  it('assertSidecarInsideRoot rejects sibling directories', () => {
    expect(() =>
      assertSidecarInsideRoot('/tmp/sibling/file.json', '/tmp/root')
    ).toThrow(/outside workspace root/);
  });
});
