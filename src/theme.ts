/**
 * Shared theme definitions for Mermaid + Markdown exports.
 *
 * viso-mcp renders interactive diagrams via React Flow + CSS custom
 * properties (see `src/preview/styles/globals.css`). For flat text
 * exports — primarily Mermaid — we need a matching colour palette
 * that renders correctly inside GitHub, Notion, Obsidian, or a
 * Mermaid Live Editor. This module centralises those colours so the
 * export helpers in `src/export/mermaid.ts` and
 * `src/bpmn/export-mermaid.ts` stay visually consistent.
 *
 * Palette source: TAFKA-Design-System (Pencil.dev). Indigo / Emerald /
 * Amber / Red pair is the same four-colour wheel the React Flow
 * canvas uses for primary / success / warning / danger states.
 */

/** Hex colours keyed by semantic role. */
export const TAFKA_PALETTE = {
  primary: '#4F46E5', // Indigo 600 — selected edges, primary actions
  success: '#10B981', // Emerald 500 — start events, "ok" states
  warning: '#F59E0B', // Amber 500 — gateways, "needs-attention"
  danger: '#EF4444', // Red 500 — end events, destructive actions
  info: '#0EA5E9', // Sky 500 — neutral highlights
  neutralDark: '#0F172A',
  neutralMid: '#475569',
  neutralLight: '#E2E8F0',
  neutralBg: '#F8FAFC',
  paper: '#FFFFFF',
} as const;

export type TafkaPaletteKey = keyof typeof TAFKA_PALETTE;

/**
 * Mermaid `themeVariables` compatible with `%%{init: { 'theme':
 * 'base', 'themeVariables': {...} } }%%` directives. Keys follow
 * the Mermaid v11 schema — see
 * https://mermaid.js.org/config/theming.html
 */
export interface MermaidThemeVariables {
  primaryColor: string;
  primaryTextColor: string;
  primaryBorderColor: string;
  lineColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  background: string;
  /** flowchart-specific */
  nodeBorder: string;
  clusterBkg: string;
  clusterBorder: string;
  /** ER-specific */
  attributeBackgroundColorOdd: string;
  attributeBackgroundColorEven: string;
}

export const MERMAID_THEME_LIGHT: MermaidThemeVariables = {
  primaryColor: TAFKA_PALETTE.paper,
  primaryTextColor: TAFKA_PALETTE.neutralDark,
  primaryBorderColor: TAFKA_PALETTE.primary,
  lineColor: TAFKA_PALETTE.neutralMid,
  secondaryColor: TAFKA_PALETTE.neutralBg,
  tertiaryColor: TAFKA_PALETTE.neutralLight,
  background: TAFKA_PALETTE.paper,
  nodeBorder: TAFKA_PALETTE.primary,
  clusterBkg: TAFKA_PALETTE.neutralBg,
  clusterBorder: TAFKA_PALETTE.neutralLight,
  attributeBackgroundColorOdd: TAFKA_PALETTE.paper,
  attributeBackgroundColorEven: TAFKA_PALETTE.neutralBg,
};

export const MERMAID_THEME_DARK: MermaidThemeVariables = {
  primaryColor: '#111820',
  primaryTextColor: TAFKA_PALETTE.neutralLight,
  primaryBorderColor: '#3B9EFF',
  lineColor: '#94A3B8',
  secondaryColor: '#1A2333',
  tertiaryColor: '#1E2A3A',
  background: '#0B0E14',
  nodeBorder: '#3B9EFF',
  clusterBkg: '#0F172A',
  clusterBorder: '#1E2A3A',
  attributeBackgroundColorOdd: '#111820',
  attributeBackgroundColorEven: '#1A2333',
};

/**
 * Wraps a Mermaid body in an `%%{init}%%` directive with a theme.
 *
 * `body` is expected to start with the diagram type line (e.g.
 * `flowchart LR`, `erDiagram`). Call sites that already include a
 * trailing newline don't need to worry about extras — this helper
 * preserves the shape.
 */
export function applyMermaidTheme(
  body: string,
  theme: 'light' | 'dark' = 'light'
): string {
  const vars = theme === 'dark' ? MERMAID_THEME_DARK : MERMAID_THEME_LIGHT;
  const init = `%%{init: {"theme": "base", "themeVariables": ${JSON.stringify(vars)}}}%%\n`;
  return init + body;
}

/**
 * Mermaid flowchart style-class fragments for BPMN-ish semantic
 * colours. Add these immediately after the node list but before the
 * edges when you want to highlight specific node kinds.
 *
 * Call-site example (in `bpmn/export-mermaid.ts`):
 *
 *     const lines: string[] = ['flowchart LR'];
 *     // …nodes + edges…
 *     lines.push(...bpmnClassDefs());
 *     lines.push(`class ${startNodeIds.join(',')} startEvent`);
 */
export function bpmnClassDefs(): string[] {
  return [
    `    classDef startEvent fill:${TAFKA_PALETTE.success},stroke:${TAFKA_PALETTE.success},color:${TAFKA_PALETTE.neutralDark}`,
    `    classDef endEvent fill:${TAFKA_PALETTE.danger},stroke:${TAFKA_PALETTE.danger},color:${TAFKA_PALETTE.paper}`,
    `    classDef task fill:${TAFKA_PALETTE.paper},stroke:${TAFKA_PALETTE.primary},color:${TAFKA_PALETTE.neutralDark}`,
    `    classDef gateway fill:${TAFKA_PALETTE.warning},stroke:${TAFKA_PALETTE.warning},color:${TAFKA_PALETTE.neutralDark}`,
  ];
}

/**
 * Status-overlay classes applied on top of the base kind-class. The
 * stroke is strong enough to survive light + dark Mermaid themes; the
 * base fill comes from the kind-class (task/startEvent/endEvent/gateway
 * for BPMN, or a plain table rectangle for ERD).
 */
export function statusClassDefs(): string[] {
  return [
    `    classDef statusOpen stroke:${TAFKA_PALETTE.info},stroke-width:2px`,
    `    classDef statusDone stroke:${TAFKA_PALETTE.success},stroke-width:2px`,
    `    classDef statusBlocked stroke:${TAFKA_PALETTE.danger},stroke-width:3px,color:${TAFKA_PALETTE.danger}`,
  ];
}

/** Map a persistent status value to the Mermaid class name. */
export function statusClassName(status: 'open' | 'done' | 'blocked'): string {
  switch (status) {
    case 'open':
      return 'statusOpen';
    case 'done':
      return 'statusDone';
    case 'blocked':
      return 'statusBlocked';
  }
}
