import { describe, it, expect } from 'vitest';
import { buildBundleBlob, parseBundleBlob } from './serialize.js';
import type { BundleManifest } from './manifest.js';

const manifestBpmn: BundleManifest = {
  version: '1.1',
  diagramType: 'bpmn',
  name: 'order-process',
  mode: 'simple',
  tool: { name: 'viso-mcp', version: '1.1.0-alpha' },
};

const manifestLandscape: BundleManifest = {
  version: '1.1',
  diagramType: 'landscape',
  name: 'winestro-audit',
  mode: 'l1',
  tool: { name: 'viso-mcp', version: '1.1.0-alpha' },
};

describe('Handoff-Bundle — build + parse round-trip', () => {
  it('round-trips a BPMN bundle', async () => {
    const source = JSON.stringify({
      format: 'viso-bpmn-v1',
      nodes: { start: { type: 'start-event', label: 'Start' } },
      flows: [],
    });
    const positions = JSON.stringify({ start: { x: 0, y: 0 } });
    const mermaid = 'flowchart LR\n    start(("Start"))';
    const blob = await buildBundleBlob({
      manifest: manifestBpmn,
      source,
      positions,
      mermaid,
    });
    const parsed = await parseBundleBlob(blob);
    expect(parsed.manifest).toEqual(manifestBpmn);
    expect(parsed.source).toBe(source);
    expect(parsed.positions).toBe(positions);
    expect(parsed.mermaid).toBe(mermaid);
  });

  it('round-trips a landscape bundle without optional exports', async () => {
    const source = JSON.stringify({
      format: 'viso-landscape-v1',
      nodes: {},
      relations: [],
    });
    const blob = await buildBundleBlob({ manifest: manifestLandscape, source });
    const parsed = await parseBundleBlob(blob);
    expect(parsed.manifest.diagramType).toBe('landscape');
    expect(parsed.source).toBe(source);
    expect(parsed.positions).toBeUndefined();
    expect(parsed.mermaid).toBeUndefined();
  });

  it('produces deterministic Zip bytes for identical inputs', async () => {
    const input = {
      manifest: manifestBpmn,
      source: 'x',
      positions: '{}',
      mermaid: 'flowchart LR',
    };
    const a = await buildBundleBlob(input);
    const b = await buildBundleBlob(input);
    const aBytes = new Uint8Array(await a.arrayBuffer());
    const bBytes = new Uint8Array(await b.arrayBuffer());
    expect(aBytes.length).toBe(bBytes.length);
    // Byte-identical Zip output — R3 fixed-date + STORE + UNIX platform.
    expect(aBytes).toEqual(bBytes);
  });

  it('rejects a Zip missing the manifest', async () => {
    // Build a fake Zip by re-exporting only the source: round-trip
    // through an inject-skip. Simpler: build, then delete .viso.json.
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('source.bpmn.json', '{}');
    const blob = await zip.generateAsync({ type: 'blob' });
    await expect(parseBundleBlob(blob)).rejects.toThrow(/missing .viso.json manifest/);
  });

  it('rejects traversal entries (Zip-Slip hardening)', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('.viso.json', JSON.stringify(manifestBpmn));
    zip.file('source.bpmn.json', '{}');
    // JSZip normalises '../../etc/passwd' to 'etc/passwd', so both
    // error paths (illegal + not-in-allow-list) defend: the whitelist
    // rejects anything outside the documented set.
    zip.file('../../etc/passwd', 'root:x:0:0');
    const blob = await zip.generateAsync({ type: 'blob' });
    await expect(parseBundleBlob(blob)).rejects.toThrow(
      /illegal entry path|not in allow-list/
    );
  });

  it('rejects entries with a .. segment after normalisation', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('.viso.json', JSON.stringify(manifestBpmn));
    zip.file('source.bpmn.json', '{}');
    // An attacker-controlled entry name with a literal '..' segment
    // that survives JSZip normalisation (e.g. no leading slash path).
    zip.file('exports/../etc/passwd', 'root:x:0:0');
    const blob = await zip.generateAsync({ type: 'blob' });
    await expect(parseBundleBlob(blob)).rejects.toThrow(
      /illegal entry path|not in allow-list/
    );
  });

  it('rejects a bundle with > 20 entries', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('.viso.json', JSON.stringify(manifestBpmn));
    zip.file('source.bpmn.json', '{}');
    for (let i = 0; i < 25; i += 1) {
      zip.file(`extra-${i}.md`, 'x');
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    await expect(parseBundleBlob(blob)).rejects.toThrow(/entries > max/);
  });

  it('rejects a malformed manifest', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('.viso.json', JSON.stringify({ version: '2.0', foo: 'bar' }));
    zip.file('source.bpmn.json', '{}');
    const blob = await zip.generateAsync({ type: 'blob' });
    await expect(parseBundleBlob(blob)).rejects.toThrow();
  });
});
