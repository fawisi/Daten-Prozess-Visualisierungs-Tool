import { buildBundleBlob } from '../../bundle/serialize.js';
import type { BundleManifest } from '../../bundle/manifest.js';
import { BUNDLE_SCHEMA_VERSION } from '../../bundle/manifest.js';

/**
 * Browser-side Handoff-Bundle builder. Fetches source + positions from
 * the HTTP adapter (or Vite plugin endpoints), optionally renders a
 * Mermaid + SVG + PNG via the canvas, and hands a Blob back to App.tsx
 * to trigger a download.
 *
 * Node-side callers use `bundle/tools.ts#export_bundle` instead — they
 * hit the FS directly without the HTTP round-trip.
 */

export interface BrowserBundleInputs {
  diagramType: 'erd' | 'bpmn' | 'landscape';
  diagramName: string;
  sourceUrl: string;
  positionsUrl?: string | null;
  mermaidUrl?: string | null;
  /** Optional browser-rendered SVG/PNG from render-diagram.ts. */
  svg?: Blob | null;
  png?: Blob | null;
  mode?: BundleManifest['mode'];
  authHeader?: string;
  toolVersion: string;
}

async function fetchText(url: string, authHeader?: string): Promise<string | undefined> {
  const init = authHeader ? { headers: { Authorization: authHeader } } : undefined;
  const res = await fetch(url, init);
  if (!res.ok) return undefined;
  return res.text();
}

export async function buildBrowserBundle(inputs: BrowserBundleInputs): Promise<Blob> {
  const manifest: BundleManifest = {
    version: BUNDLE_SCHEMA_VERSION,
    diagramType: inputs.diagramType,
    name: inputs.diagramName,
    ...(inputs.mode ? { mode: inputs.mode } : {}),
    createdAt: new Date().toISOString(),
    tool: { name: 'viso-mcp', version: inputs.toolVersion },
  };

  const source = (await fetchText(inputs.sourceUrl, inputs.authHeader)) ?? '';
  const positions = inputs.positionsUrl
    ? await fetchText(inputs.positionsUrl, inputs.authHeader)
    : undefined;
  const mermaid = inputs.mermaidUrl
    ? await fetchText(inputs.mermaidUrl, inputs.authHeader)
    : undefined;

  return buildBundleBlob({
    manifest,
    source,
    ...(positions ? { positions } : {}),
    ...(mermaid ? { mermaid } : {}),
    ...(inputs.svg ? { svg: inputs.svg } : {}),
    ...(inputs.png ? { png: inputs.png } : {}),
  });
}
