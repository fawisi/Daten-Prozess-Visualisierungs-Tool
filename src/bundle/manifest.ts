import { z } from 'zod';
import { DiagramTypeEnum } from '../types.js';

/**
 * Handoff-Bundle manifest (`.viso.json` inside the Zip / directory).
 *
 * Architecture (plan R8): pure, no FS / DOM dependencies. Browser
 * (html-to-image + JSZip) and CLI (fs.writeFile) both serialise through
 * this schema so the Zip shape is bit-identical across surfaces.
 *
 * Security (plan Req #2 — Zip-Slip + JSON-Bomb): entries accepted by the
 * importer are whitelisted here. Any other path is rejected.
 *
 * v1.1.1: `diagramType` zieht jetzt aus dem zentralen `DiagramTypeEnum`
 * in `src/types.ts` (Plan AD-1 — Single Source of Truth fuer alle
 * UI- + Tool-Code-Stellen).
 */

export const BUNDLE_SCHEMA_VERSION = '1.1';

export const BundleManifestSchema = z.object({
  version: z.literal(BUNDLE_SCHEMA_VERSION),
  diagramType: DiagramTypeEnum,
  name: z.string().max(256),
  /** Mode sidecar snapshot at export time. */
  mode: z.enum(['simple', 'bpmn', 'l1', 'l2']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  createdAt: z.string().datetime().optional(),
  tool: z.object({
    name: z.literal('viso-mcp'),
    version: z.string(),
  }),
});

export type BundleManifest = z.infer<typeof BundleManifestSchema>;

/** Entries the importer will read. Anything else is rejected as Zip-Slip. */
export const BUNDLE_ALLOWED_ENTRIES = new Set<string>([
  'README.md',
  '.viso.json',
  'positions.json',
  'source.erd.dbml',
  'source.bpmn.json',
  'source.landscape.json',
  'exports/mermaid.md',
  'exports/diagram.svg',
  'exports/diagram.png',
]);

/** ≤ 5 MiB unpacked, ≤ 20 entries — defends against JSON-bomb + Zip-bomb. */
export const BUNDLE_MAX_UNCOMPRESSED_BYTES = 5 * 1024 * 1024;
export const BUNDLE_MAX_ENTRY_COUNT = 20;

/** Fixed date baked into every entry for deterministic Zip output (plan R3). */
export const BUNDLE_FIXED_DATE = new Date('2024-01-01T00:00:00Z');

export function readmeFor(manifest: BundleManifest): string {
  const dt = manifest.diagramType;
  const diagramDe =
    dt === 'erd' ? 'ER-Diagramm' : dt === 'bpmn' ? 'Prozess' : 'System-Landscape';
  const sourceFile =
    dt === 'erd'
      ? 'source.erd.dbml'
      : dt === 'bpmn'
        ? 'source.bpmn.json'
        : 'source.landscape.json';
  return [
    '---',
    `title: "${manifest.name}"`,
    `source_tool: ${manifest.tool.name}@${manifest.tool.version}`,
    `diagram_type: ${dt}`,
    manifest.createdAt ? `created: ${manifest.createdAt}` : '',
    `version: ${manifest.version}`,
    '---',
    '',
    `# ${manifest.name}`,
    '',
    `Handoff-Paket (${diagramDe}) — erzeugt von viso-mcp.`,
    '',
    '## Inhalt',
    '',
    `- **${sourceFile}** — maschinenlesbare Quelle (round-trip-fähig).`,
    '- **positions.json** — Koordinaten-Sidecar.',
    '- **exports/mermaid.md** — Mermaid-Code für GitHub/Notion/Claude.md.',
    '- **exports/diagram.svg** — Vektor-Snapshot.',
    '- **exports/diagram.png** — Raster-Snapshot.',
    '- **.viso.json** — Manifest (nicht editieren).',
    '',
    '## For Claude',
    '',
    '1. Lies `.viso.json` zuerst.',
    `2. Quelle liegt in \`${sourceFile}\`.`,
    '3. Bei Änderungen bitte Round-Trip über `import_bundle` (nicht hand-merge).',
    '',
  ]
    .filter((line) => line !== '')
    .join('\n') + '\n';
}
