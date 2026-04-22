import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as fc from 'fast-check';
import { loadModeSidecar, saveModeSidecar } from '../mode-sidecar.js';

/**
 * Property-based guarantees that matter for P1 two-mode-prozess:
 * - save(mode) followed by load() returns the same mode for any sequence
 *   of mode flips (plan P1 Success-Criteria: "Toggle-Switch bewahrt alle
 *   Nodes").
 * - Double-flip is a no-op: simple→bpmn→simple leaves no trace in the
 *   sidecar content besides the final mode.
 * - Overwrite is safe: saving 'bpmn' over an existing 'simple' sidecar
 *   cleanly replaces — no leftover key leak.
 */
describe('mode-sidecar idempotenz', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'viso-mode-idem-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('save→load returns the last saved mode', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom('simple' as const, 'bpmn' as const), {
          minLength: 1,
          maxLength: 10,
        }),
        async (modes) => {
          const source = join(dir, `run-${Math.random()}.bpmn.json`);
          for (const mode of modes) {
            await saveModeSidecar(source, {
              kind: 'bpmn',
              mode,
              version: '1.1',
            });
          }
          const loaded = await loadModeSidecar(source);
          expect(loaded).toEqual({
            kind: 'bpmn',
            mode: modes[modes.length - 1],
            version: '1.1',
          });
        }
      ),
      { numRuns: 30 }
    );
  });

  it('idempotent: save(X) twice in a row == save(X) once', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('simple' as const, 'bpmn' as const),
        async (mode) => {
          const source = join(dir, `idem-${Math.random()}.bpmn.json`);
          await saveModeSidecar(source, { kind: 'bpmn', mode, version: '1.1' });
          const once = await loadModeSidecar(source);
          await saveModeSidecar(source, { kind: 'bpmn', mode, version: '1.1' });
          const twice = await loadModeSidecar(source);
          expect(twice).toEqual(once);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('round-trip simple→bpmn→simple leaves mode: simple, no orphan state', async () => {
    const source = join(dir, 'round-trip.bpmn.json');
    await saveModeSidecar(source, { kind: 'bpmn', mode: 'simple', version: '1.1' });
    await saveModeSidecar(source, { kind: 'bpmn', mode: 'bpmn', version: '1.1' });
    await saveModeSidecar(source, { kind: 'bpmn', mode: 'simple', version: '1.1' });
    const final = await loadModeSidecar(source);
    expect(final).toEqual({ kind: 'bpmn', mode: 'simple', version: '1.1' });
  });
});
