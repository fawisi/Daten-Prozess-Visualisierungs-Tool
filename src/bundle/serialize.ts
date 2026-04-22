import JSZip from 'jszip';
import {
  BUNDLE_ALLOWED_ENTRIES,
  BUNDLE_FIXED_DATE,
  BUNDLE_MAX_UNCOMPRESSED_BYTES,
  BUNDLE_MAX_ENTRY_COUNT,
  BundleManifestSchema,
  readmeFor,
} from './manifest.js';
import type { BundleManifest } from './manifest.js';

/**
 * Build a deterministic handoff-bundle Zip (plan R3):
 * - compression 'STORE' + platform 'UNIX' + fixed date on every entry
 *   so a byte-identical diagram produces a byte-identical Zip.
 * - Entry set is bounded by `BUNDLE_ALLOWED_ENTRIES` both on write AND
 *   on import — nothing outside the whitelist is produced or accepted.
 *
 * Browser + CLI callers feed their own rendered Blobs / buffers in;
 * this module knows nothing about html-to-image or Node-fs paths.
 */

export interface BundleInputs {
  manifest: BundleManifest;
  /** Full source-file contents (dbml / json). */
  source: string;
  /** Positions sidecar JSON (may be empty string). */
  positions?: string;
  /** Pre-rendered Mermaid text. */
  mermaid?: string;
  /** Rendered SVG blob. */
  svg?: Blob | Uint8Array;
  /** Rendered PNG blob. */
  png?: Blob | Uint8Array;
}

export async function buildBundleBlob(inputs: BundleInputs): Promise<Blob> {
  // Validate manifest once up front — the importer reads it first, so
  // rejecting bad inputs here fails loudly at the right time.
  BundleManifestSchema.parse(inputs.manifest);

  const zip = new JSZip();
  const opts = { date: BUNDLE_FIXED_DATE } as const;

  zip.file('.viso.json', JSON.stringify(inputs.manifest, null, 2) + '\n', opts);
  zip.file('README.md', readmeFor(inputs.manifest), opts);

  const sourceName =
    inputs.manifest.diagramType === 'erd'
      ? 'source.erd.dbml'
      : inputs.manifest.diagramType === 'bpmn'
        ? 'source.bpmn.json'
        : 'source.landscape.json';
  zip.file(sourceName, inputs.source, opts);

  if (inputs.positions !== undefined) {
    zip.file('positions.json', inputs.positions, opts);
  }

  if (inputs.mermaid !== undefined || inputs.svg !== undefined || inputs.png !== undefined) {
    const exports = zip.folder('exports', opts);
    if (exports) {
      if (inputs.mermaid !== undefined) exports.file('mermaid.md', inputs.mermaid, opts);
      if (inputs.svg !== undefined) exports.file('diagram.svg', inputs.svg, opts);
      if (inputs.png !== undefined) exports.file('diagram.png', inputs.png, opts);
    }
  }

  return zip.generateAsync({
    type: 'blob',
    compression: 'STORE',
    streamFiles: false,
    platform: 'UNIX',
  });
}

/**
 * Parse a Zip + enforce security caps. Returns the manifest and the
 * whitelisted entries as string / Uint8Array payloads. Throws on any
 * safety violation so callers fail closed.
 */
export interface ParsedBundle {
  manifest: BundleManifest;
  source: string;
  positions?: string;
  mermaid?: string;
  svg?: Uint8Array;
  png?: Uint8Array;
}

export async function parseBundleBlob(data: Blob | ArrayBuffer | Uint8Array): Promise<ParsedBundle> {
  // JSZip in Node (tests) cannot accept a Blob directly; normalise to
  // a Uint8Array which works in both environments.
  let input: ArrayBuffer | Uint8Array;
  if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
    input = data;
  } else if (typeof (data as Blob).arrayBuffer === 'function') {
    input = new Uint8Array(await (data as Blob).arrayBuffer());
  } else {
    throw new Error('parseBundleBlob: unsupported input — expected Blob, ArrayBuffer, or Uint8Array');
  }
  const zip = await JSZip.loadAsync(input);

  const entries = Object.entries(zip.files).filter(([, f]) => !f.dir);
  if (entries.length > BUNDLE_MAX_ENTRY_COUNT) {
    throw new Error(
      `Bundle rejected: ${entries.length} entries > max ${BUNDLE_MAX_ENTRY_COUNT}`
    );
  }

  let totalBytes = 0;
  const payloads: Record<string, { text?: string; bytes?: Uint8Array }> = {};
  for (const [name, file] of entries) {
    // Reject traversal + absolute paths up-front.
    if (name.includes('..') || name.startsWith('/')) {
      throw new Error(`Bundle rejected: illegal entry path "${name}"`);
    }
    if (!BUNDLE_ALLOWED_ENTRIES.has(name)) {
      throw new Error(`Bundle rejected: unknown entry "${name}" — not in allow-list`);
    }
    const bytes = await file.async('uint8array');
    totalBytes += bytes.byteLength;
    if (totalBytes > BUNDLE_MAX_UNCOMPRESSED_BYTES) {
      throw new Error(
        `Bundle rejected: uncompressed size > ${BUNDLE_MAX_UNCOMPRESSED_BYTES} bytes`
      );
    }
    if (name.endsWith('.png') || name.endsWith('.svg')) {
      payloads[name] = { bytes };
    } else {
      payloads[name] = { text: new TextDecoder('utf-8').decode(bytes) };
    }
  }

  const manifestEntry = payloads['.viso.json'];
  if (!manifestEntry?.text) {
    throw new Error('Bundle rejected: missing .viso.json manifest');
  }
  const manifest = BundleManifestSchema.parse(JSON.parse(manifestEntry.text));

  const sourceName =
    manifest.diagramType === 'erd'
      ? 'source.erd.dbml'
      : manifest.diagramType === 'bpmn'
        ? 'source.bpmn.json'
        : 'source.landscape.json';
  const sourceEntry = payloads[sourceName];
  if (!sourceEntry?.text) {
    throw new Error(`Bundle rejected: missing ${sourceName}`);
  }

  return {
    manifest,
    source: sourceEntry.text,
    positions: payloads['positions.json']?.text,
    mermaid: payloads['exports/mermaid.md']?.text,
    svg: payloads['exports/diagram.svg']?.bytes,
    png: payloads['exports/diagram.png']?.bytes,
  };
}
