import type { Landscape, LandscapeNode } from './schema.js';
import { applyMermaidTheme, statusClassDefs, statusClassName } from '../theme.js';
import { escapeMermaidLabel } from '../export/mermaid-escape.js';

/**
 * Mermaid export for System Landscape diagrams.
 *
 * **Strategy (plan R4 — critical finding)**: Primary export is
 * `flowchart LR` with C4-styled `classDef` — it renders in GitHub GFM
 * + Notion + Claude.md AND preserves relation labels, which C4
 * *requires* (every line must be labelled with intent/protocol).
 * Mermaid `architecture-beta` cannot render edge-labels (stale issue),
 * so it's offered as a secondary "icon-rich preview" via
 * `variant: 'architecture-beta'` — structure only, labels lost.
 */

const FLOWCHART_KIND_SHAPE: Record<
  string,
  (id: string, label: string) => string
> = {
  person: (id, label) => `    ${id}(("${label}"))`,
  system: (id, label) => `    ${id}["${label}"]`,
  external: (id, label) => `    ${id}>"${label}"]`,
  container: (id, label) => `    ${id}["${label}"]`,
  database: (id, label) => `    ${id}[("${label}")]`,
  cloud: (id, label) => `    ${id}(["${label}"])`,
  boundary: (id, label) => `    ${id}[["${label}"]]`,
};

function landscapeClassDefs(): string[] {
  // Kept inline rather than in theme.ts because the palette here is
  // C4-scoped (person uses Amber, system Indigo, external Slate, db
  // Violet, cloud Sky). If a consumer needs to override, they can
  // post-process the output.
  return [
    '    classDef person   fill:#fef3c7,stroke:#f59e0b,color:#000',
    '    classDef system   fill:#c7d2fe,stroke:#6366f1,color:#000',
    '    classDef external fill:#e2e8f0,stroke:#64748b,color:#000',
    '    classDef container fill:#e0e7ff,stroke:#6366f1,color:#000',
    '    classDef database fill:#ddd6fe,stroke:#8b5cf6,color:#000',
    '    classDef cloud    fill:#bae6fd,stroke:#0ea5e9,color:#000',
    '    classDef boundary fill:#fef9c3,stroke:#ca8a04,color:#000,stroke-dasharray: 5 5',
  ];
}

export interface MermaidLandscapeOptions {
  /**
   * `'flowchart'` (default) renders a labelled `flowchart LR` with C4
   * classDefs. `'architecture-beta'` emits the struct-only variant for
   * icon-rich preview in environments that support it.
   */
  variant?: 'flowchart' | 'architecture-beta';
  /** When set, wraps the output in `%%{init}%%`. */
  theme?: 'light' | 'dark';
}

export function landscapeToMermaid(
  landscape: Landscape,
  options: MermaidLandscapeOptions = {}
): string {
  const variant = options.variant ?? 'flowchart';
  const body =
    variant === 'architecture-beta'
      ? toArchitectureBeta(landscape)
      : toFlowchart(landscape);
  return options.theme ? applyMermaidTheme(body, options.theme) : body;
}

function toFlowchart(landscape: Landscape): string {
  const lines: string[] = ['flowchart LR'];
  const nodeIds = Object.keys(landscape.nodes).sort();

  // Group boundary children so the flowchart renders a visible cluster.
  const boundaryChildren: Record<string, string[]> = {};
  for (const id of nodeIds) {
    const node = landscape.nodes[id];
    if ('parentId' in node && node.parentId) {
      if (!boundaryChildren[node.parentId]) boundaryChildren[node.parentId] = [];
      boundaryChildren[node.parentId].push(id);
    }
  }

  const topLevelIds = nodeIds.filter((id) => {
    const node = landscape.nodes[id];
    return !('parentId' in node) || !node.parentId;
  });

  for (const id of topLevelIds) {
    const node = landscape.nodes[id];
    if (node.kind === 'boundary') {
      lines.push(`    subgraph ${id}["${escapeMermaidLabel(node.label)}"]`);
      const children = boundaryChildren[id] ?? [];
      for (const childId of children) {
        const child = landscape.nodes[childId];
        lines.push(renderNodeShape(childId, child));
      }
      lines.push('    end');
    } else {
      lines.push(renderNodeShape(id, node));
    }
  }

  const sortedRelations = [...landscape.relations].sort((a, b) => {
    const aKey = `${a.from}-${a.to}`;
    const bKey = `${b.from}-${b.to}`;
    return aKey.localeCompare(bKey);
  });

  for (const rel of sortedRelations) {
    const label =
      rel.label || rel.technology
        ? escapeMermaidLabel(
            [rel.label, rel.technology].filter(Boolean).join(' · ')
          )
        : '';
    if (label) {
      lines.push(`    ${rel.from}-- "${label}" -->${rel.to}`);
    } else {
      lines.push(`    ${rel.from}-->${rel.to}`);
    }
  }

  lines.push(...landscapeClassDefs());
  for (const id of nodeIds) {
    lines.push(`    class ${id} ${landscape.nodes[id].kind}`);
  }

  // Status overlay — reuses the shared helpers so ERD / BPMN / Landscape
  // exports stay visually consistent.
  const byStatus: Record<'open' | 'done' | 'blocked', string[]> = {
    open: [],
    done: [],
    blocked: [],
  };
  for (const id of nodeIds) {
    const s = landscape.nodes[id].status;
    if (s) byStatus[s].push(id);
  }
  const usedStatuses = (Object.keys(byStatus) as Array<keyof typeof byStatus>)
    .filter((s) => byStatus[s].length > 0);
  if (usedStatuses.length > 0) {
    const wantedClasses = new Set(usedStatuses.map((s) => statusClassName(s)));
    for (const def of statusClassDefs()) {
      if ([...wantedClasses].some((cls) => def.includes(` ${cls} `))) {
        lines.push(def);
      }
    }
    for (const s of usedStatuses) {
      lines.push(`    class ${byStatus[s].join(',')} ${statusClassName(s)}`);
    }
  }

  return lines.join('\n') + '\n';
}

function renderNodeShape(id: string, node: LandscapeNode): string {
  const shape = FLOWCHART_KIND_SHAPE[node.kind];
  const techSuffix =
    'technology' in node && node.technology
      ? ` <br/>[${escapeMermaidLabel(node.technology)}]`
      : '';
  const baseLabel = escapeMermaidLabel(node.label);
  return shape
    ? shape(id, techSuffix ? `${baseLabel}${techSuffix}` : baseLabel)
    : `    ${id}["${baseLabel}"]`;
}

function toArchitectureBeta(landscape: Landscape): string {
  // Architecture-beta cannot render edge labels (Mermaid issue #7211)
  // — document that loss inline so the README in the handoff bundle
  // can point readers to the flowchart variant when labels matter.
  const lines: string[] = [
    'architecture-beta',
    '    %% Edge labels are not supported by architecture-beta.',
    '    %% Use the `flowchart` variant for C4-compliant labelled relations.',
  ];
  const nodeIds = Object.keys(landscape.nodes).sort();
  for (const id of nodeIds) {
    const node = landscape.nodes[id];
    if (node.kind === 'boundary') {
      lines.push(`    group ${id}(cloud)[${escapeMermaidLabel(node.label)}]`);
    }
  }
  for (const id of nodeIds) {
    const node = landscape.nodes[id];
    if (node.kind === 'boundary') continue;
    const parentSuffix =
      'parentId' in node && node.parentId ? ` in ${node.parentId}` : '';
    const iconForKind =
      node.kind === 'database'
        ? 'database'
        : node.kind === 'cloud'
          ? 'cloud'
          : node.kind === 'person'
            ? 'logos:users'
            : 'server';
    lines.push(
      `    service ${id}(${iconForKind})[${escapeMermaidLabel(node.label)}]${parentSuffix}`
    );
  }

  const sortedRelations = [...landscape.relations].sort((a, b) => {
    const aKey = `${a.from}-${a.to}`;
    const bKey = `${b.from}-${b.to}`;
    return aKey.localeCompare(bKey);
  });
  for (const rel of sortedRelations) {
    lines.push(`    ${rel.from}:R --> L:${rel.to}`);
  }
  return lines.join('\n') + '\n';
}
