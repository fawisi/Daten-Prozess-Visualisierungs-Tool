---
title: "Phase 2: Browser Preview — Design Specification"
type: design
status: active
date: 2026-03-30
---

# Phase 2: Browser Preview — Design Specification

## Design Direction: Dark Blueprint

**Aesthetic:** Industrial-Technical Blueprint — a dark canvas that evokes engineering schematics, control room dashboards, and technical drawings. Every pixel communicates precision and systems thinking.

**Why this direction:** Developer tools that default to white backgrounds with pastel cards look like every other SaaS product. This tool is for engineers building with AI agents. The visual language should feel like inspecting a live system — not browsing a web app. The blueprint metaphor reinforces that this is a *schema* — a technical plan for how data flows.

**The one memorable thing:** When someone opens this preview, they should feel like they're looking at a living technical drawing that updates in real time. The dark canvas with the subtle dot grid, the sharp cyan accents, the monospaced type annotations — it all says "this is a precise instrument."

---

## Color Palette

All colors defined as CSS custom properties on `:root`. No hardcoded hex values in components.

```css
:root {
  /* Canvas */
  --canvas-bg: #0B0E14;              /* Near-black with blue undertone */
  --canvas-grid-dot: #1A2030;        /* Subtle dot grid — visible but not distracting */
  --canvas-grid-dot-accent: #243044; /* Every 5th grid line slightly brighter */

  /* Node (Table Card) */
  --node-bg: #111820;                /* Dark card — slightly lighter than canvas */
  --node-border: #1E2A3A;            /* Hairline border, low contrast */
  --node-border-hover: #2D6B9E;      /* Blue border on hover — signals interactivity */
  --node-border-selected: #3B9EFF;   /* Bright blue when selected/dragging */
  --node-shadow: 0 2px 16px rgba(0, 0, 0, 0.5); /* Deep drop shadow for depth */

  /* Header (Table Name) */
  --header-bg: #141C28;              /* Slightly differentiated from body */
  --header-text: #E2E8F0;            /* High contrast white-blue */
  --header-icon: #3B9EFF;            /* Blue icon accent for table symbol */

  /* Columns */
  --column-text: #94A3B8;            /* Muted — secondary information */
  --column-text-pk: #E2E8F0;         /* Primary key columns get full brightness */
  --column-divider: #1A2333;         /* Barely-there row separator */

  /* Type Badges */
  --type-badge-bg: #1A2333;          /* Pill background */
  --type-badge-text: #64748B;        /* Low emphasis — type info is reference, not primary */
  --type-badge-text-pk: #F59E0B;     /* Amber for primary key type — the one warm accent */

  /* Primary Key Indicator */
  --pk-amber: #F59E0B;              /* Warm amber — stands out against the cool palette */
  --pk-amber-dim: rgba(245, 158, 11, 0.15); /* Subtle row highlight for PK */

  /* Nullable Indicator */
  --nullable-text: #475569;          /* Very dim — nullable is the default assumption */

  /* Edges (Relations) */
  --edge-stroke: #2D4A6E;            /* Steel blue — visible but not overwhelming */
  --edge-stroke-hover: #3B9EFF;      /* Bright blue on hover */
  --edge-label-bg: #111820;          /* Opaque pill behind cardinality text */
  --edge-label-text: #64748B;        /* Muted cardinality label */
  --edge-label-text-hover: #94A3B8;  /* Slightly brighter on hover */

  /* Controls & UI Chrome */
  --controls-bg: #111820;
  --controls-border: #1E2A3A;
  --controls-icon: #64748B;
  --controls-icon-hover: #E2E8F0;

  /* MiniMap */
  --minimap-bg: #0B0E14;
  --minimap-node: #1E2A3A;
  --minimap-viewport: rgba(59, 158, 255, 0.25);

  /* Status / Feedback */
  --status-connected: #22C55E;       /* Green dot — WebSocket connected */
  --status-reconnecting: #F59E0B;    /* Amber — reconnecting */
  --status-error: #EF4444;           /* Red — connection lost */

  /* Empty State */
  --empty-text: #475569;
  --empty-border: #1E2A3A;
}
```

### Color Rules

1. **Cool dominance, warm accent:** The palette is 95% cool blues/slates. The only warm color is amber (`--pk-amber`) reserved exclusively for primary key indicators. This makes PKs immediately scannable across the canvas.
2. **Three levels of text brightness:** Full (`#E2E8F0`), muted (`#94A3B8`), dim (`#64748B`). Never use pure white (`#FFF`) — it's too harsh on a dark canvas.
3. **Blue as interaction color:** Hover, selection, and connection states all use the `#3B9EFF` blue. One interaction color, applied consistently.

---

## Typography

```css
/* Display / Table Names */
--font-header: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
--font-header-size: 13px;
--font-header-weight: 600;
--font-header-tracking: 0.02em;  /* Slight letter-spacing for readability at small sizes */

/* Column Names */
--font-column: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
--font-column-size: 12px;
--font-column-weight: 400;

/* Type Badges */
--font-type: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
--font-type-size: 10px;
--font-type-weight: 400;
--font-type-tracking: 0.03em;

/* Cardinality Labels (on edges) */
--font-cardinality: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
--font-cardinality-size: 10px;
--font-cardinality-weight: 500;

/* UI Chrome (controls, status) */
--font-ui: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
--font-ui-size: 11px;
```

### Typography Rules

1. **All monospaced.** This is a schema tool — column names, types, and table names are all code-adjacent identifiers. A monospaced stack makes them feel native. JetBrains Mono is the primary choice: it has excellent legibility at small sizes, distinct character shapes (no ambiguity between `0`/`O`, `1`/`l`), and built-in ligatures for operators.
2. **Small sizes, generous line-height.** Nodes will contain many rows. Size 12-13px keeps nodes compact. Line-height of 1.6 on column rows prevents density from becoming claustrophobia.
3. **Weight for hierarchy, not size.** Table names are `600` weight at `13px`. Column names are `400` at `12px`. The difference is subtle but perceptible — hierarchy through weight, not dramatic size jumps.
4. **Load via Google Fonts CDN** in `index.html`: `https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap`

---

## Component Design

### TableNode (`TableNode.tsx`)

The core visual element. Each table is a React Flow custom node.

```
+-------------------------------------------+
|  # users                            [PK]  |  <- Header row
+-------------------------------------------+
|  id          uuid            PK            |  <- Column row (PK highlighted)
|  email       varchar(255)                  |  <- Column row
|  name        varchar(128)    ?             |  <- Nullable indicator
|  created_at  timestamp                     |
+-------------------------------------------+
```

#### Structure

```tsx
<div className="table-node">
  <div className="table-node__header">
    <span className="table-node__icon">{/* table/grid icon */}</span>
    <span className="table-node__name">{tableName}</span>
    <span className="table-node__count">{columns.length}</span>
  </div>
  <div className="table-node__body">
    {columns.map(col => (
      <div className="table-node__row" data-pk={col.primary}>
        <span className="table-node__col-name">{col.name}</span>
        <span className="table-node__col-type">{col.type}</span>
        <span className="table-node__col-badge">
          {col.primary && <span className="badge badge--pk">PK</span>}
          {col.nullable && <span className="badge badge--nullable">?</span>}
        </span>
        {/* React Flow Handle for edge connections */}
        <Handle type="source" position={Position.Right} id={col.name} />
        <Handle type="target" position={Position.Left} id={col.name} />
      </div>
    ))}
  </div>
</div>
```

#### Styling Details

```css
.table-node {
  background: var(--node-bg);
  border: 1px solid var(--node-border);
  border-radius: 6px;
  box-shadow: var(--node-shadow);
  min-width: 240px;
  max-width: 360px;
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.table-node:hover {
  border-color: var(--node-border-hover);
}

.table-node.selected {
  border-color: var(--node-border-selected);
  box-shadow: var(--node-shadow), 0 0 0 1px var(--node-border-selected);
}

.table-node__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--header-bg);
  border-bottom: 1px solid var(--node-border);
}

.table-node__icon {
  color: var(--header-icon);
  font-size: 12px;
  flex-shrink: 0;
}

.table-node__name {
  font-family: var(--font-header);
  font-size: var(--font-header-size);
  font-weight: var(--font-header-weight);
  letter-spacing: var(--font-header-tracking);
  color: var(--header-text);
  text-transform: none;  /* Table names are identifiers — preserve casing */
}

.table-node__count {
  margin-left: auto;
  font-family: var(--font-type);
  font-size: var(--font-type-size);
  color: var(--type-badge-text);
  background: var(--type-badge-bg);
  padding: 1px 6px;
  border-radius: 3px;
}

.table-node__body {
  padding: 4px 0;
}

.table-node__row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  position: relative;
  transition: background 0.1s ease;
}

.table-node__row:hover {
  background: rgba(59, 158, 255, 0.04);
}

.table-node__row[data-pk="true"] {
  background: var(--pk-amber-dim);
}

.table-node__row[data-pk="true"]:hover {
  background: rgba(245, 158, 11, 0.2);
}

.table-node__row + .table-node__row {
  border-top: 1px solid var(--column-divider);
}

.table-node__col-name {
  font-family: var(--font-column);
  font-size: var(--font-column-size);
  font-weight: var(--font-column-weight);
  color: var(--column-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.table-node__row[data-pk="true"] .table-node__col-name {
  color: var(--column-text-pk);
}

.table-node__col-type {
  font-family: var(--font-type);
  font-size: var(--font-type-size);
  letter-spacing: var(--font-type-tracking);
  color: var(--type-badge-text);
  background: var(--type-badge-bg);
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

.table-node__row[data-pk="true"] .table-node__col-type {
  color: var(--type-badge-text-pk);
  background: rgba(245, 158, 11, 0.12);
}

.badge {
  font-family: var(--font-type);
  font-size: 9px;
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 2px;
  text-transform: uppercase;
}

.badge--pk {
  color: var(--pk-amber);
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.badge--nullable {
  color: var(--nullable-text);
  font-size: 11px;
  font-weight: 400;
}

/* React Flow Handles — invisible until hover */
.table-node .react-flow__handle {
  width: 8px;
  height: 8px;
  background: var(--edge-stroke);
  border: 2px solid var(--node-bg);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.table-node:hover .react-flow__handle {
  opacity: 1;
}

.table-node .react-flow__handle:hover {
  background: var(--edge-stroke-hover);
}
```

#### Performance: Memoization

```tsx
// Wrap with React.memo to prevent re-renders when other nodes change
export const TableNode = React.memo(TableNodeComponent);

// Also memoize column rendering for tables with many columns
const ColumnRow = React.memo(({ column }: { column: Column }) => (
  // ... row JSX
));
```

---

### RelationEdge (`RelationEdge.tsx`)

Edges represent foreign key relationships between tables.

#### Styling

```css
/* Base edge path */
.react-flow__edge-path {
  stroke: var(--edge-stroke);
  stroke-width: 1.5;
  fill: none;
  transition: stroke 0.15s ease;
}

.react-flow__edge:hover .react-flow__edge-path {
  stroke: var(--edge-stroke-hover);
  stroke-width: 2;
}

/* Cardinality label pill */
.edge-label {
  font-family: var(--font-cardinality);
  font-size: var(--font-cardinality-size);
  font-weight: var(--font-cardinality-weight);
  color: var(--edge-label-text);
  background: var(--edge-label-bg);
  border: 1px solid var(--node-border);
  padding: 2px 8px;
  border-radius: 4px;
  pointer-events: all;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.react-flow__edge:hover .edge-label {
  color: var(--edge-label-text-hover);
  border-color: var(--node-border-hover);
}
```

#### Cardinality Display

Use symbolic notation instead of verbose text. Compact and universally understood:

| Relation Type  | Label Display |
|----------------|---------------|
| `one-to-one`   | `1 : 1`       |
| `one-to-many`  | `1 : N`       |
| `many-to-one`  | `N : 1`       |
| `many-to-many` | `N : M`       |

#### Edge Type

Use `smoothstep` edge type from React Flow — it routes around nodes with right-angle corners, which fits the technical blueprint aesthetic better than bezier curves.

```tsx
const edgeOptions = {
  type: 'smoothstep',
  pathOptions: { borderRadius: 8 },  // Slightly rounded corners on the steps
  animated: false,  // No animated dash — too distracting at scale
};
```

---

### Canvas (`App.tsx`)

```tsx
<ReactFlow
  nodes={nodes}
  edges={edges}
  nodeTypes={{ table: TableNode }}
  edgeTypes={{ relation: RelationEdge }}
  defaultEdgeOptions={{
    type: 'smoothstep',
    style: { stroke: 'var(--edge-stroke)', strokeWidth: 1.5 },
  }}
  fitView
  fitViewOptions={{ padding: 0.15 }}
  minZoom={0.1}
  maxZoom={2}
  proOptions={{ hideAttribution: true }}
  connectionLineStyle={{ stroke: 'var(--edge-stroke-hover)' }}
>
  <Background
    variant={BackgroundVariant.Dots}
    gap={20}
    size={1}
    color="var(--canvas-grid-dot)"
  />
  <MiniMap
    style={{
      background: 'var(--minimap-bg)',
      border: '1px solid var(--controls-border)',
      borderRadius: '6px',
    }}
    nodeColor="var(--minimap-node)"
    maskColor="rgba(11, 14, 20, 0.85)"
  />
  <Controls
    style={{
      background: 'var(--controls-bg)',
      border: '1px solid var(--controls-border)',
      borderRadius: '6px',
    }}
  />
  <StatusIndicator />  {/* WebSocket connection status */}
</ReactFlow>
```

---

### StatusIndicator (WebSocket feedback)

A minimal, persistent indicator in the bottom-left corner showing connection state.

```css
.status-indicator {
  position: absolute;
  bottom: 16px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-ui);
  font-size: var(--font-ui-size);
  color: var(--empty-text);
  z-index: 5;
}

.status-indicator__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--status-connected);
}

.status-indicator__dot--reconnecting {
  background: var(--status-reconnecting);
  animation: pulse 1.5s ease-in-out infinite;
}

.status-indicator__dot--error {
  background: var(--status-error);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
```

---

### Empty State

When no tables exist yet (first-run experience, per E3 in the plan).

```css
.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 5;
  pointer-events: none;
}

.empty-state__icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 16px;
  color: var(--empty-border);
}

.empty-state__title {
  font-family: var(--font-header);
  font-size: 14px;
  font-weight: 600;
  color: var(--empty-text);
  margin-bottom: 8px;
}

.empty-state__hint {
  font-family: var(--font-ui);
  font-size: var(--font-ui-size);
  color: var(--empty-text);
  max-width: 320px;
  line-height: 1.6;
}

.empty-state__code {
  display: inline-block;
  margin-top: 12px;
  font-family: var(--font-column);
  font-size: 11px;
  color: var(--column-text);
  background: var(--type-badge-bg);
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px dashed var(--empty-border);
}
```

**Empty state content:**
- Icon: A minimal grid/table icon (inline SVG, not an icon library)
- Title: `"No tables yet"`
- Hint: `"Ask your AI agent to create a table using diagram_create_table"`
- Code: `diagram_create_table({ name: "users", columns: [...] })`

---

## Micro-Interactions & Motion

Keep animations restrained. This is a precision tool, not a marketing page.

### Node Appearance (on WebSocket update)

When a new table arrives via WebSocket, fade it in with a subtle scale:

```css
@keyframes node-enter {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.table-node--entering {
  animation: node-enter 0.2s ease-out;
}
```

### Node Removal

When a table is removed, fade out quickly:

```css
@keyframes node-exit {
  to {
    opacity: 0;
    transform: scale(0.95);
  }
}

.table-node--exiting {
  animation: node-exit 0.15s ease-in forwards;
}
```

### Layout Transition

When ELK auto-layout repositions nodes, animate smoothly to new positions:

```tsx
// In useDiagramSync or App.tsx, after ELK produces new positions:
const animateToLayout = (newNodes: Node[]) => {
  // Use React Flow's built-in transition
  setNodes(prev =>
    prev.map(node => {
      const updated = newNodes.find(n => n.id === node.id);
      if (!updated) return node;
      return {
        ...node,
        position: updated.position,
        style: { transition: 'transform 0.3s ease-out' },
      };
    })
  );
};
```

### Hover States

All hover transitions use `0.15s ease` — fast enough to feel responsive, slow enough to not flicker.

---

## Visual Hierarchy Summary

From most prominent to least:

1. **Table names** — highest contrast text, bold weight, blue icon anchor
2. **Primary key rows** — amber background wash + bright column name + amber type badge
3. **Column names** — medium contrast, scannable
4. **Type badges** — low contrast pills, reference information
5. **Cardinality labels** — dim by default, brighten on hover
6. **Edge lines** — steel blue, thinner than node borders
7. **Grid dots** — barely perceptible, provide spatial reference without distraction

---

## Spacing System

Use a 4px base grid:

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
}
```

- Node internal padding: `12px` horizontal, `8px` vertical header, `4px` vertical body
- Row internal padding: `4px 12px`
- Gap between columns in a row: `8px`
- Border radius on nodes: `6px` (sharp enough to feel technical, rounded enough to not look dated)
- Border radius on badges: `3px`

---

## Implementation Notes

### File Structure for Styles

One CSS file, no CSS modules, no Tailwind. CSS custom properties provide the theming. Keep it simple:

```
src/preview/
  styles/
    canvas.css        /* All styles: variables, node, edge, controls, empty state */
```

Import in `main.tsx`:
```tsx
import './styles/canvas.css';
import '@xyflow/react/dist/style.css';  // React Flow base styles — import FIRST
```

**Why no CSS-in-JS or Tailwind:** This is a Vite-served preview, not a component library. A single CSS file with custom properties is the fastest to render, easiest to modify, and produces the smallest bundle. The entire stylesheet will be under 5KB.

### React Flow Overrides

React Flow ships with its own styles. Override them after importing the base:

```css
/* Override React Flow defaults */
.react-flow__node {
  padding: 0;
  border-radius: 0;
  border: none;
  background: none;
  box-shadow: none;
  font-size: inherit;
}

.react-flow__edge.selected .react-flow__edge-path {
  stroke: var(--node-border-selected);
  stroke-width: 2;
}

.react-flow__controls button {
  background: var(--controls-bg);
  border: 1px solid var(--controls-border);
  color: var(--controls-icon);
  border-radius: 4px;
}

.react-flow__controls button:hover {
  background: var(--node-bg);
  color: var(--controls-icon-hover);
}

.react-flow__controls button svg {
  fill: currentColor;
}

.react-flow__minimap {
  border-radius: 6px;
}

/* Remove the default React Flow attribution */
.react-flow__attribution {
  display: none;
}
```

### Icon Approach

Use inline SVGs (3-4 total) instead of an icon library. The only icons needed:

1. **Table icon** — grid/table symbol for node headers (16x16)
2. **Key icon** — small key for primary key badge (optional, `PK` text may suffice)
3. **Connection status dot** — pure CSS, no SVG needed
4. **Controls** — React Flow provides built-in control icons

### Font Loading Strategy

```html
<!-- In index.html <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

Use `font-display: swap` (default in the Google Fonts URL). The fallback stack (`Fira Code`, `SF Mono`, `monospace`) ensures the layout doesn't shift — all are monospaced with similar metrics.

---

## Accessibility

Even for a developer tool:

- All interactive elements (nodes, controls) are keyboard-navigable via React Flow's built-in a11y
- Color contrast ratios: header text on header bg = 10.5:1 (passes AAA), column text on node bg = 5.8:1 (passes AA)
- No information conveyed through color alone: PK is marked with both amber color AND the `PK` badge text
- Nullable is marked with `?` symbol, not just dimmed text
- Status indicator uses both color dot AND text label ("Connected" / "Reconnecting...")

---

## Summary: What Makes This Not Generic

1. **All-monospace typography** — developer tools should look like code, not marketing
2. **Dark blueprint canvas** — not the white-bg-with-shadows every AI tool defaults to
3. **Amber as the only warm accent** — a single warm color reserved for primary keys creates immediate visual scanning capability
4. **Smoothstep edges** — right-angle routing fits the technical aesthetic, bezier curves feel too organic
5. **Restrained animation** — 0.15-0.3s transitions, no bounces, no springs, no particle effects
6. **Information density without clutter** — compact nodes with clear internal hierarchy, generous canvas whitespace between nodes
7. **Blueprint dot grid** — subtle but present, provides spatial anchoring during pan/zoom
