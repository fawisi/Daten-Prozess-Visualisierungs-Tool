---
title: Drag-and-Drop-Spawn nur in BPMN — ERD und Landscape ignorieren Palette-Drops
problem_type: ui-bugs
component: viso-preview-shell
symptoms:
  - Tool-Palette zeigt Buttons fuer ERD (Table) und Landscape (Person/System/External/Container/Database), aber Drag&Drop auf Canvas spawnt keine Nodes
  - Aktivierter Tool-Button (z.B. Person) zeigt blauen Highlight, dennoch keine Reaktion beim Loslassen ueber dem Canvas
  - BPMN-Modus funktioniert korrekt — Bug ist diagramm-typ-spezifisch
  - Click-to-Place via `paneClick` funktioniert in allen Modi (anderer Code-Pfad)
  - `viso-spawn-node` CustomEvents werden dispatcht, aber kein Listener konsumiert sie ausserhalb BPMN
date_solved: 2026-04-29
tags: [drag-drop, react-flow, palette, multi-diagram, spawn-pipeline, erd, landscape]
status: solved
---

# Drag-and-Drop-Spawn nur in BPMN — ERD und Landscape ignorieren Palette-Drops

## Solution

### Root Cause

`useSpawnListener` und `handleSpawnFromPointer` wurden in der initialen R1-Iteration nur fuer BPMN implementiert. Bei der Erweiterung um ERD (CR-2) und Landscape (CR-3) wurden zwar die Shape-Buttons und der Click-to-Place-Flow nachgezogen, aber der Drag-and-Drop-Listener nicht. Dadurch verwarf der Spawn-Handler jedes Drop-Event mit `diagramType !== 'bpmn'` als Early-Return — Tabellen und Landscape-Tokens konnten nie auf dem Canvas landen.

### Fix

**Datei:** `src/preview/App.tsx` (Zeilen 1077–1095)

```tsx
const handleSpawnFromPointer = useCallback(
  (type: string, clientPos: { x: number; y: number }) => {
    if (readOnly) return;
    if (!diagramType) return;
    // Each diagram type only accepts its own shape tools — drop a
    // landscape token onto an ERD pane (or vice versa) is a no-op.
    let allowed = false;
    switch (diagramType) {
      case 'bpmn':
        allowed = type === 'start-event' || type === 'end-event' || type === 'task' || type === 'gateway';
        break;
      case 'erd':
        allowed = type === 'table';
        break;
      case 'landscape':
        allowed = type.startsWith('lc-');
        break;
    }
    if (!allowed) return;
    const pane = document.querySelector(`[data-viso-canvas-pane="${diagramType}"]`);
    if (!pane) return;
    const rect = pane.getBoundingClientRect();
    handleAddNodeAt(type as Tool, { x: clientPos.x - rect.left, y: clientPos.y - rect.top });
  },
  [readOnly, diagramType, handleAddNodeAt]
);

useSpawnListener({
  onSpawn: handleSpawnFromPointer,
  enabled: !readOnly && !!diagramType,
});
```

### Why this solution works

Der Pane-Selector wird mit `diagramType` parametrisiert und die erlaubten Tool-Types pro Diagrammtyp explizit gewhitelisted — so funktioniert Drag-and-Drop fuer alle drei Typen, ohne dass z. B. ein Landscape-Token versehentlich auf einem ERD-Pane landet.

### Verification steps

1. Dev-Server starten (`npm run dev`) und Preview oeffnen.
2. ERD-Datei (`test-schema.erd.json`) oeffnen, Table-Tool aus Sidebar auf den Canvas droppen — Node `table_34` erscheint und wird in JSON persistiert.
3. Landscape-Datei (`landscape.landscape.json`) oeffnen, nacheinander `lc-person`, `lc-external`, `lc-system` droppen — Nodes `person_18`, `external_13`, `system_23` erscheinen und werden persistiert.
4. Cross-Type-Test: Landscape-Token auf ERD-Pane droppen — keine Node entsteht (erwarteter No-Op).
5. BPMN-Diagramm oeffnen, Task droppen — Regression-Check, Verhalten unveraendert.

## Prevention

### Root Pattern

When a new diagram type is introduced, the **click-to-place path** (`paneClick` → `handleAddNodeAt`) and the **drag-and-drop path** (`handleSpawnFromPointer` → `useSpawnListener` → `handleAddNodeAt`) must be extended **in lockstep**. Forgetting the drag path leaves the tool half-functional. Coupled hotspots: the `Tool` union in `src/types.ts`, keyboard shortcuts in `useToolStore.tsx`, the canvas pane marker `data-viso-canvas-pane="<type>"`, and the per-type `allowed`-switch in `handleSpawnFromPointer`.

### Pre-Merge Checklist (any "new diagram type" or "new shape tool" PR)

- [ ] Extend the `Tool` union in `src/types.ts` and ensure all `switch (tool)` / `switch (diagramType)` blocks compile (no fallthrough to `default`).
- [ ] Add the canvas root `data-viso-canvas-pane="<diagramType>"` marker so `handleSpawnFromPointer`'s pane selector resolves.
- [ ] Extend the `allowed`-switch in `handleSpawnFromPointer` (`src/preview/App.tsx`) with the new tool IDs for the matching `diagramType`.
- [ ] Confirm `useSpawnListener` is enabled (i.e. `diagramType !== null` covers the new type — no early `return null`).
- [ ] Add the new tool to keyboard shortcut wiring in `useToolStore.tsx` and the Tool-Palette UI; smoke-test click-AND-drag in dev.

### Suggested Vitest Regression Test

```ts
// src/preview/__tests__/spawn-listener.test.tsx
import { render, act } from '@testing-library/react';
import { vi } from 'vitest';
import { EditorShell } from '../App';

it('drag-spawn dispatches handleAddNodeAt for landscape lc-person', async () => {
  const putSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response('{}', { status: 200 }),
  );
  const { container } = render(<EditorShell diagramType="landscape" />);
  const pane = container.querySelector('[data-viso-canvas-pane="landscape"]')!;
  expect(pane).toBeTruthy();

  await act(async () => {
    window.dispatchEvent(new CustomEvent('viso-spawn-node', {
      detail: { type: 'lc-person', clientX: 200, clientY: 200 },
    }));
  });

  expect(putSpy).toHaveBeenCalledWith(
    expect.stringContaining('/__viso-api/landscape/source'),
    expect.objectContaining({ method: 'PUT' }),
  );
});
```

Repeat per `diagramType` × representative tool (`bpmn`/`task`, `erd`/`table`, `landscape`/`lc-person`).

### Compile-Time Guard

Use an exhaustive-switch helper: `default: const _exhaustive: never = diagramType; throw new Error(_exhaustive);` — adding a new `Tool`/`DiagramType` variant then **fails the build** at every unhandled `switch`, including `handleSpawnFromPointer`.

## Related

### Source files to reference

1. `src/preview/App.tsx` (Zeilen 1077–1095) — `handleSpawnFromPointer` + `useSpawnListener`-Setup; gefixte Guards
2. `src/preview/hooks/usePaletteDrag.ts` — Pointer-Events Drag-Listener (iPad-Safari-safe, dispatcht `viso-spawn-node`)
3. `src/preview/components/shell/ToolPalette.tsx` — Palette-Buttons mit Pointer-Down/Move/Up-Handlern
4. `src/preview/App.tsx` (Zeilen ~951, ~1053) — `handleAddNodeAt` (ERD/Landscape/BPMN-Branches) + `paneClick` (Click-to-Place-Pfad)
5. `src/types.ts` — `Tool`-Union (alle erlaubten Tool-IDs)

### Related docs / design notes

No prior solution docs in this area — this is the first.

### CHANGELOG entries

- **v1.1.2:** Pointer-Events drag-and-drop palette → canvas, iPad-Safari-safe (R1)
- **v1.1.1 CR-2:** ERD click-to-place table-add tool
- **v1.1.1 CR-3:** Landscape UI-parity: click-to-place + Cmd+K add-actions fuer 5 Node-Kinds

### Plan codes

- **R1** — React-Flow 12 + Pointer-Events DnD fuer iPad (initial nur BPMN)
- **CR-2** — ERD click-to-place table-add tool
- **CR-3** — Landscape click-to-place + Cmd+K
- **MA-9** — Auto-Layout initial run
- **MA-10** — Mode-Toggle Landscape L1/L2
