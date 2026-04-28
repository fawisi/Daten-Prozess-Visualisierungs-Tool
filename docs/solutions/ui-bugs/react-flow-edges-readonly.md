---
title: ReactFlow-Canvases — Edges nicht erstellbar/loeschbar (onConnect/onEdgesChange fehlten)
date: 2026-04-29
problem_type: ui_bug
severity: high
component: react-flow-canvases
symptoms:
  - Drag von Handle zu Handle erzeugt keine neue Edge in ERD/BPMN/Landscape
  - Bestehende Edges lassen sich per Klick + Backspace/Delete nicht entfernen
  - Edges verhalten sich effektiv read-only, keine Interaktion moeglich
tags:
  - react-flow
  - xyflow
  - edges
  - onConnect
  - onEdgesChange
  - sync-hooks
  - canvas
related_commits:
  - 05f953e
  - 51ce91e
related_files:
  - src/preview/App.tsx
  - src/preview/hooks/useDiagramSync.ts
  - src/preview/hooks/useProcessSync.ts
  - src/preview/hooks/useLandscapeSync.ts
---

## Symptom

Im Canvas konnten Edges weder neu gezogen noch geloescht werden. User-Sicht: „Drag von einem Handle zum anderen tut nichts, Edge anklicken und Backspace tut nichts." Objektiv: Die React-Flow-Standard-Interaktionen blieben in allen drei Canvases (ERD, BPMN, Landscape) ohne Effekt — kein Source-Write, kein Reload. Im ERD zusaetzlich: „Spalte hinzufuegen" im Properties-Panel zeigte die neue Spalte im Inspector, aber die Canvas-Tabelle reagierte nicht.

## Investigation

- App.tsx: `<ReactFlow>` bekam nur `onNodesChange`, keine Edge-Handler — Drag-Connect und Selection-Delete hatten keinen Listener.
- Sync-Hooks (useDiagramSync/useProcessSync/useLandscapeSync): `onEdgesChange`, `onConnect`, `onEdgesDelete` waren nicht implementiert.
- `handleUpdateNode` in App.tsx aborted silent: `DiagramSchema.safeParse` warf, aber der Code returnte ohne `console.error`.
- Aha: Notion-Pipeline-Outputs und v1.0-Files persistieren Relations als `{ from: <table>, fromColumn, to: <table>, toColumn, cardinality: 'N:1' }` — v1.1 verlangt `{ from: { table, column }, to: { table, column }, type: 'many-to-one' }`. Zod-Reject blockierte alle Schreib-Pfade fuer Legacy-Files.
- Handle-IDs haben Form `"${column}-source"`/`"${column}-target"` und Spaltennamen koennen Bindestriche enthalten (`user_id-source`) — naive `split('-')` zerlegt falsch.

## Root Cause

Zwei zusammenhaengende Defekte: (1) Die Sync-Hooks lieferten keine Edge-CRUD-Handler, und App.tsx reichte sie auch nicht weiter — Edge-Create/Delete war komplett unverdrahtet. (2) Bei ERD-Files im Legacy-Format scheiterte zusaetzlich `DiagramSchema.safeParse` in `handleUpdateNode`, was den Source-Write fuer jede Panel-Aenderung still blockierte. Der `loadSchema`-Reader war permissiv (las nur `rel.from.table`, was bei String-`from` `undefined` ergab — Edges renderten gar nicht erst), die Schreibseite strikt — also: Edges weg, Edits no-op.

## Fix

### Sync-Hooks (use{Diagram,Process,Landscape}Sync.ts)

Drei Handler pro Hook ergaenzt:

```ts
const onEdgesChange = useCallback((changes: EdgeChange[]) => {
  setEdges((prev) => applyEdgeChanges(changes, prev));
}, []);

const onConnect = useCallback(async (connection: Connection) => {
  // ... source-file write via fetch
}, [writeDoc]);

const onEdgesDelete = useCallback(async (deleted: Edge[]) => {
  // ... filter + write
}, [writeDoc]);
```

Begruendung: Edges sind kanonisch in der Source-Datei (Relations/Flows) — nicht im React-Flow-State. Pfad ist deshalb GET → JSON.parse → mutate → PUT, und der WebSocket-Reload propagiert die neue Edge zurueck in den Canvas. Kein optimistisches Setzen von Edges, weil die Source-Datei die einzige Wahrheit bleibt und Konflikte mit parallelen MCP-Tools so gar nicht erst entstehen. `onEdgesChange` haelt nur lokale Selection/UI-Aenderungen, „remove"-Changes laufen ueber `onEdgesDelete`.

### Canvas-Wiring (App.tsx)

In allen drei Canvases die Handler an `<ReactFlow>` weiterreichen:

```tsx
const { ..., onEdgesChange, onConnect, onEdgesDelete } = sync;

<ReactFlow
  ...
  onEdgesChange={onEdgesChange}
  onConnect={onConnect}
  onEdgesDelete={onEdgesDelete}
/>
```

Zusaetzlich vor dem `safeParse` in `handleUpdateNode`: `normalizeRelations(parsedDoc)` aufrufen und bei Validation-Fehlern `console.error(...validated.error.issues)` statt silent return — damit der naechste Bug nicht wieder unsichtbar bleibt.

### Detail: Handle-Suffix-Parsing (ERD)

Handle-IDs in TableNode haben das Schema `"${column}-source"` bzw. `"${column}-target"`. Spaltennamen koennen selbst Bindestriche enthalten (z.B. `user_id-source` oder gar `customer-id-source`), deshalb wuerde `split('-')` die Spalte zerstoeren. `endsWith` + `slice(0, -suffix.length)` schneidet sauber nur das Suffix ab.

```ts
const handleColumn = (handleId, suffix) => {
  if (!handleId || !handleId.endsWith(suffix)) return null;
  return handleId.slice(0, -suffix.length);
};
```

### Bonus: normalizeRelations (Legacy-Migration)

`src/preview/normalize-relations.ts` rewrited Legacy-Relation-Shapes (`from: string`, `fromColumn`, `cardinality: 'N:1'`) in-place zur kanonischen v1.1-Form. Aufgerufen in `useDiagramSync.loadSchema` (beim Read) und in `App.tsx::handleUpdateNode` (vor `safeParse`). Effekt: Legacy-Files werden beim ersten Panel-Edit opportunistisch zur kanonischen Form migriert, Edges rendern wieder, Schreib-Pfad gruent durch Zod.

## Verification

- `src/preview/normalize-relations.test.ts`: 6 Cases (Legacy → canonical, Pass-Through, alle 4 Cardinality-Mappings 1:1/1:N/N:1/N:N, Cleanup der Legacy-Felder, Robustheit bei kaputten Shapes/fehlender `relations`-Array).
- ERD-Smoke-Test im Browser: zwei Tabellen-Handles verbunden → Edge erscheint, `erd.json` enthaelt neue Relation in kanonischer Form (`{from:{table,column}, to:{table,column}, type:'many-to-one'}`).
- Edge-Click + Backspace im ERD: Edge verschwindet aus Canvas, `erd.json` hat eine Relation weniger — Match per `source/target` + `sourceHandle/targetHandle`-Suffix-Strip.
- BPMN/Landscape teilen den identischen Source-File-Roundtrip-Pfad (Relations/Flows by `from`/`to`-String-Match), per Code-Review verifiziert.
- „Spalte hinzufuegen" im Properties-Panel auf einem Notion-Legacy-File: Spalte erscheint jetzt auch in der Canvas-Tabelle; das `erd.json` wird beim Edit von Legacy- auf v1.1-Shape migriert.
- `npm test`: 304/304 grun.

## Prevention

### Warum es so lange unbemerkt blieb

Bestehende Edges wurden aus der Source-Datei (z.B. `relations.json`, `flows.json`) lesend gerendert — der Canvas sah „funktional" aus. MCP-Tools/API-Routen legten Relations/Flows backend-seitig an, woraufhin der WebSocket-Reload den Canvas neu hydrierte und die Kante magisch erschien. Dadurch blieb verborgen, dass UI-seitiges Drag-Connect und Backspace-Delete nie eine Schreib-Aktion ausgeloest haben — die `onConnect`/`onEdgesChange`/`onEdgesDelete`-Props fehlten schlicht im JSX.

### Checklist fuer neue ReactFlow-Canvases

Wenn ein neues Diagramm eingefuehrt wird (vierter Diagramm-Typ etc.), pruefen:

- [ ] `<ReactFlow nodes={...} edges={...}>` hat alle vier interaktiven Handler: `onNodesChange`, `onEdgesChange`, `onConnect`, `onEdgesDelete`
- [ ] Custom-Nodes haben `<Handle type="source">` und `<Handle type="target">` korrekt platziert (Position passt zur Edge-Richtung; `isConnectable` nicht versehentlich `false`)
- [ ] Sync-Hook persistiert Connect/Delete via `*Source`-Endpunkt + WebSocket-Reload (nicht nur lokaler `setEdges` — sonst geht die Kante beim naechsten Reload verloren)
- [ ] Manueller Smoke-Test: Drag von Handle zu Handle erzeugt Edge in der Source-Datei (`git diff` zeigt JSON-Aenderung); Edge selektieren + Backspace entfernt sie und persistiert das Delete
- [ ] Falls Custom-Edge-Komponenten: `interactionWidth` ausreichend (default 20) damit sich die Edge anklicken laesst — sonst greift Backspace ins Leere
- [ ] `defaultEdgeOptions` / `connectionMode` (loose vs. strict) bewusst gesetzt, nicht aus anderem Canvas blind kopiert

### Test-Idee (E2E)

Vitest + `@testing-library/react` + RF-Test-Utilities (oder Playwright fuer echtes Drag). Pro Diagramm-Typ (ERD/BPMN/Landscape) ein Smoke:

```ts
// pseudocode
describe.each(['erd', 'bpmn', 'landscape'])('%s canvas write-path', (kind) => {
  it('persists connect + delete', async () => {
    const { canvas } = await mountCanvasWithFixtures(kind, {
      nodes: [nodeA, nodeB], // zwei Nodes, keine Edges
    });

    // 1) Connect: programmatisch onConnect feuern (oder Drag in Playwright)
    await fireConnect(canvas, { source: 'A', target: 'B' });
    await waitForWsRoundtrip();
    expect(await readSource(kind)).toMatchObject({
      relations: [{ from: 'A', to: 'B' }], // bzw. flows fuer BPMN
    });

    // 2) Delete: Edge selektieren, Backspace
    await selectEdge(canvas, 'A->B');
    await fireKey('Backspace');
    await waitForWsRoundtrip();
    expect((await readSource(kind)).relations).toEqual([]);
  });
});
```

Kritisch: der Test muss die **Source-Datei** pruefen (`fs.readFile` auf das JSON hinter `*Source`), nicht nur den lokalen React-State — sonst faengt er genau diesen Bug nicht.

### Sentinel-Check (Build-Zeit)

TypeScript-Wrapper statt eslint-Rule (pragmatischer, kein Custom-Plugin noetig): Ein `<EditableReactFlow>`-Wrapper in `src/preview/components/`, der `<ReactFlow>` umschliesst und dessen Props per **Required-Pick** alle vier Handler erzwingt:

```ts
// EditableReactFlow.tsx
import { ReactFlow, type ReactFlowProps } from '@xyflow/react';

type Required4<T> = T & Required<Pick<ReactFlowProps,
  'onNodesChange' | 'onEdgesChange' | 'onConnect' | 'onEdgesDelete'
>>;

export function EditableReactFlow(props: Required4<ReactFlowProps>) {
  return <ReactFlow {...props} />;
}
```

Konvention: jeder neue Canvas (`ERDCanvas`, `BPMNCanvas`, `LandscapeCanvas`, …) verwendet `EditableReactFlow` statt `ReactFlow` direkt. Das Vergessen eines Handlers wird dann zum **TS-Fehler beim Build** (`tsc --noEmit` in CI), nicht zum stillen Runtime-Bug. Read-only-Visualisierungen duerfen weiter `<ReactFlow>` direkt nutzen — die Trennung ist explizit.

Zusaetzlich Pre-Release-Smoke (manuell, 30 Sek pro Canvas): „Drag von Handle A zu Handle B — erscheint Eintrag in `*.json`? Backspace auf Edge — verschwindet Eintrag?" als Punkt in der Release-Checklist.

## Related Documentation

_(Erste Solutions-Doku in diesem Repo — `docs/solutions/` existiert noch nicht. Verwandte Plaene unten.)_

- [docs/plans/2026-04-25-feat-stabilization-sprint-v1-1-1-plan.md](../../plans/2026-04-25-feat-stabilization-sprint-v1-1-1-plan.md) — Stabilisierungs-Sprint, in dem der Edge-Workflow auf allen drei Canvases stabilisiert wurde
- [docs/plans/2026-04-22-feat-viso-mcp-v1.1-plan.md](../../plans/2026-04-22-feat-viso-mcp-v1.1-plan.md) — v1.1-Plan, fuehrt die kanonische Relations-Form ein, die `normalizeRelations` heute migriert

## Related Commits & PRs

- `51ce91e` — `feat(canvas): Edge create/delete fuer BPMN und Landscape` — direkter Vorgaenger: spendiert `useProcessSync`/`useLandscapeSync` die fehlenden `onConnect`/`onEdgesChange`/`onEdgesDelete`-Handler
- `05f953e` — `fix(erd): Spalte hinzufuegen — Legacy-Relations vor Zod-Validierung normalisieren` — selber Bug-Cluster: silenter Source-Roundtrip, der Edges aus Sicht des Users „weg fressen" liess; loest ein `handleUpdateNode`-No-Op via `normalizeRelations`
- `d61345a` — `feat(erd): B1 — ERD-Tabellen-Rename mit Relations-Update` — beruehrt denselben Roundtrip-Pfad (Schema laden → mutieren → `putSource`), den `onConnect`/`onEdgesDelete` jetzt benutzen
- `0d130af` — `chore(wip): Debug-Logs fuer spawn-from-pointer (ERD/Landscape)` — WIP-Logs fuer den `handleAddNodeAt`/Pointer-Pfad, der dieselbe Source-Write-Pipeline nutzt wie das neue Edge-Verhalten

## Cross-References

- [src/preview/App.tsx](../../../src/preview/App.tsx) — drei `<ReactFlow>`-Renderings (ERD/BPMN/Landscape) destrukturieren `onConnect`/`onEdgesChange`/`onEdgesDelete` aus dem jeweiligen Sync-Hook und verdrahten sie auf das Canvas
- [src/preview/hooks/useDiagramSync.ts](../../../src/preview/hooks/useDiagramSync.ts) — ERD-Sync-Hook, urspruengliche Implementation der drei Edge-Handler; Vorlage fuer Process- und Landscape-Hook
- [src/preview/hooks/useProcessSync.ts](../../../src/preview/hooks/useProcessSync.ts) — BPMN-Sync, in `51ce91e` um `onEdgesChange` (`applyEdgeChanges` lokal), `onConnect` (Source-Write neuer Flow) und `onEdgesDelete` (Filter per `source`/`target`) ergaenzt
- [src/preview/hooks/useLandscapeSync.ts](../../../src/preview/hooks/useLandscapeSync.ts) — Landscape-Sync, identisch zum Process-Hook gepatcht (Relation statt Flow als Source-Mutation)
- [src/preview/normalize-relations.ts](../../../src/preview/normalize-relations.ts) — Pre-Zod-Migration von Legacy-Relations; greift in `handleUpdateNode` und `loadSchema`, schuetzt damit auch den `onConnect`/`onEdgesDelete`-Roundtrip vor silent Validation-Fails
