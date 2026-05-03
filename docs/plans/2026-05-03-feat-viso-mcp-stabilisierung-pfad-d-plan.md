---
title: viso-mcp Stabilisierung — Pfad D (Editor-First)
type: feat
status: active
date: 2026-05-03
deepened: 2026-05-03
brainstorm: docs/brainstorms/2026-05-01-viso-mcp-stabilisierung-pfad-d-brainstorm.md
branch_plan: docs/brainstorm-stabilisierung-pfad-d
branch_implementation: feat/v1.2-stabilization-d
---

# viso-mcp Stabilisierung — Pfad D (Editor-First)

## Enhancement Summary

**Deepened on:** 2026-05-03 (zwei Runden, 13 Research-Agents total)
**Sections enhanced:** alle Etappen + Risk + Documentation Plan + neue "Schutzgeruest"-Sektion
**Research agents used:**
- **Runde 1 (Plan-Architektur):** Architecture-Strategist, Performance-Oracle, Best-Practices-Researcher, Code-Simplicity-Reviewer, Julik-Frontend-Races, Kieran-TypeScript, Learnings-Researcher, Framework-Docs-Researcher (React Flow 12), Explore (Code-Locations)
- **Runde 2 (Operational-Tiefe):** Repo-Research-Analyst (Multi-Provider-Audit), Julik-Frontend-Races (Vitest-Setup + useRef-Migration), Best-Practices-Researcher (E1-Operational-Playbook), Kieran-TypeScript (Schutzgeruest-Paket Lefthook+Sentinels)

### Key Improvements (was hat sich gegenueber v1 geaendert)

1. **Etappen-Reihenfolge umgestellt:** E3 (Backlog-Sweep) nach E4 (Daily-Use) verschoben — Real-Findings priorisieren Polish-Items, sonst Sunk-Cost-Risiko.
2. **E6 als eigene Phase gestrichen.** Hub-Frage wird zu einem Trigger-Punkt _nach_ E5, kein Etappen-Schritt.
3. **B1-Fix konkretisiert:** Refactor-Reihenfolge in 4 Schritten (Provider mounten → Pure-Helper → Canvases umbauen → Spawn-Pfad). Code-Audit hat bestaetigt: aktuell EXISTIERT NICHT EIN EINZIGER `<ReactFlowProvider>` im Repo. Auto-Provider-Modus laeuft, `useReactFlow()` wird nirgends genutzt — der Bug ist also kein Versehen, sondern strukturell durch das Hook-Pattern blockiert.
4. **B2-Hypothese geschaerft + Implementierungs-Plan:** Top-Verdacht ist `data-viso-canvas-pane`-Selector-Stale + Tool-Reset feuert nur bei *ungueltigem* Tool (Wechsel zwischen 2 ERDs ueberlebt es). Fix in 3 Schritten (H3 Tool-Reset eine Zeile, H2+H1 zusammen via useRef + permanent Listener), Prod-Build-Repro VOR Code zur H6-Disambiguation.
5. **E3.2 Auto-Layout vereinfacht:** Web Worker komplett gestrichen. Hash-basiertes Caching + `requestIdleCallback` + Manual-Button + ELK-Config `thoroughness:1`.
6. **Schutzgeruest-Paket neu strukturiert (E2.5+):** Lefthook (nicht Husky), `assertNever`-Helper, `EditableReactFlow`-Wrapper, TS-Strict-Flags, Minimal-ESLint — als priorisiertes Paket mit Aufwand/Impact pro Item.
7. **`EditableReactFlow`-Wrapper mit Generics:** korrekt typisiert `<N extends Node, E extends Edge>`. Pre-Commit-grep ueber Lefthook.
8. **Indikator 2 quantifiziert:** "0 neue usage-log-Eintraege bei mindestens 3 Daily-Use-Sessions in 7 Tagen".
9. **Pro-Bug-Sub-Branches** statt Long-Lived-Stabilization-Branch.
10. **`hub-relevant`-Tag in usage-log** als Pre-Material fuer das Hub-Brainstorm.
11. **E1-Operational-Playbook:** 7 konkrete Console-Log-Stellen mit `// E1-DEBUG`-Marker, Stale-Build-Bash-Oneliner, DevTools-Inspection-Skript, Triage-Matrix fuer 4 E1.3-Outcomes, Chrome DevTools "Recorder"-Tab statt Playwright im E1-Scope.
12. **Test-Infrastruktur-Lage geklaert:** Repo hat KEIN jsdom, KEIN @testing-library/react (vitest matcht nur `.test.ts`). Empfehlung: Hook-isolierte Tests fuer E2.B2 (createSpawnHandler als reine Funktion), volles jsdom-Setup erst spaeter.

### New Considerations Discovered (Runde 2)

- **Es gibt aktuell ZERO ReactFlowProvider im Source.** `grep` liefert null Treffer. Drei `<ReactFlow>`-Instanzen laufen im Auto-Provider-Modus — drei separate Provider-Bubbles. Der Kommentar in `App.tsx:286-289` belegt: bewusst akzeptiert. Refactor muss Provider erst einfuehren.
- **`useReactFlow()` wird NIRGENDS aufgerufen.** Auch null Treffer. Die `bounds.left`-Math ist also nicht ein vergessener Migrations-Schritt, sondern der akzeptierte Workaround.
- **Migrations-Pflicht fuer Sidecars.** Bestehende `*.pos.json`-Files haben Pane-Pixel-Positionen gespeichert (alte Math). Nach `screenToFlowPosition`-Fix werden Knoten "verschoben" wirken — Migrations-Hinweis ans Source-File-Format anhaengen.
- **`handlePaneClick`-Code triplikat.** `App.tsx:180-190, 283-297, 401-411` — drei mal das gleiche `evt.clientX - bounds.left` in den Canvas-Branches. App.tsx hat 1364 Zeilen — der Coordinate-Refactor ist die Gelegenheit fuer Split in 3 separate Canvas-Komponenten (ErdCanvas/BpmnCanvas/LandscapeCanvas).
- **Tool-Reset-Effect existiert bereits, aber unvollstaendig.** `App.tsx:508-512` resettet Tool nur bei *ungueltigem* Tool fuer neuen Diagrammtyp. Wechsel zwischen 2 ERDs oder 2 BPMNs ueberlebt das Tool — und genau das ist der wahrscheinlichste B2-Pfad.
- **Stale-Build ist tatsaechlich vorhanden.** `dist/server.cjs` (22.04.) ist aelter als `src/preview/App.tsx` (26.04.). E1.0 wird 80% der Faelle aufloesen.
- **Custom-Edges haben `interactionWidth` nicht gesetzt** (Default 20px) — Empfehlung: 40px.
- **vitest.config.ts matcht nur `.test.ts`** (kein `.tsx`). Setup-Aufwand: vitest.config + jsdom + Testing-Library + tsconfig-JSX-Mirroring.
- **Pointer-Capture-Audit ergaenzt:** Wenn `usePaletteDrag.ts` `setPointerCapture` nutzt + Tab-Wechsel mid-drag → Pointer-Up landet im Nirvana. Pruefen vor B2-Fix.

---

## Overview

`viso-mcp` braucht eine stabile Editor-Basis, bevor wir die Hub-Frage neu
aufrollen. Synthetic Tests sagen SUS 70.5 (gut), Fabians Real-Eindruck
sagt "noch nicht zuverlaessig nutzbar" — diese Luecke schliessen wir,
indem wir die 4 gemeldeten UX-Bugs (B1–B4) live im Browser
reproduzieren, fixen, und Fabians taegliche Kundenarbeit im Editor zur
primaeren Validierungsmethode machen. 5 Etappen (E1–E5), keine Deadline,
Quality-First. Die Hub-Frage faellt _nach_ E5 als eigener Plan-Stream.

**Drin:** B1–B4 Bug-Fixes, ein eingeschobenes E2.5 (ERD-Rename + exhaustive-switch-Refactor), E3 nach E4 verlagert (Polish nach Real-Validation), strukturierter Bug-Capture beim Real-Nutzen, Daily-Use-Run mit echtem Kundenprojekt, Iteration auf Findings.

**Raus aus dieser Phase:** Hub-Integration, iframe-Embedding, npm-Package-Refactor in
`@tafka/viso-editor`, neue Features ueber die 3 Use Cases (ERD/BPMN/Landscape)
hinaus, Open-Source-Promotion, Web Worker fuer ELK.

---

## Problem Statement

### Symptom

Fabian erlebt den Editor in der taeglichen Anwendung als nicht zuverlaessig.
4 konkrete Bugs sind gemeldet (siehe Bug-Tabelle unten). Davon sind drei
laut Solution-Docs bereits gefixt — sie tauchen in Fabians Real-Eindruck
trotzdem als kaputt auf. Das ist ein Widerspruch, der vor jedem
Code-Schritt aufgeloest werden muss.

### Root Causes (drei moegliche Ursachen)

1. **Stale Build (Hauptverdacht, faktisch bestaetigt).** Der MCP-Server
   faehrt aus `dist/server.cjs`. Diese Datei stammt vom 22.04., waehrend
   `src/preview/App.tsx` zuletzt am 26.04. geaendert wurde. Wenn Fabian
   `npx viso-mcp serve` benutzt, laeuft er auf einem 4 Tage alten Build,
   der die Fixes fuer B2/B3/B4 noch nicht enthaelt. Genau dieses
   Stale-Build-Pattern ist in
   [docs/solutions/integration-issues/notion-to-viso-pipeline-and-set-dbml-stale-build.md](../solutions/integration-issues/notion-to-viso-pipeline-and-set-dbml-stale-build.md)
   bereits einmal aufgetreten und identisch zu loesen
   (`npm run build`).

2. **Edge-Cases ausserhalb des Solution-Doc-Scopes.** Die Fixes fuer
   B2 (drag-drop-spawn-diagramm-typ-aware), B3 und B4 (react-flow-edges-readonly)
   wurden code-mässig verifiziert, aber nicht durch Real-User-Sessions.
   Es ist plausibel, dass Edge-Cases (kombinierte Aktionen, bestimmte
   Files, Tab-Wechsel-Sequenzen) noch brechen. Top-Verdacht: ein
   Selector-Stale beim Tab-Wechsel laesst Drag-Drops "in null" verschwinden.

3. **Synthetic-Test-Blindspot.** Der v1.1.2-Re-Test hat bewusst auf
   den Live-Browser-Pfad verzichtet (Begruendung im Report:
   "Browser-MCP interagiert nicht zuverlaessig mit ReactFlow's
   SVG-Selektion"). Damit ist ein ganzer Klasse von Bugs strukturell
   unsichtbar — genau die, die Fabian beim Klicken erlebt.

### Bug-Liste (Stand 2026-05-01)

| # | Beschreibung | Use Case | Solution-Doc vorhanden? | Hypothese (deepened) |
|---|---|---|---|---|
| **B1** | Drag-Drop legt Knoten an falscher Stelle ab | alle 3? | **Nein** | Aktuelle Berechnung `clientPos.x - paneRect.left` ignoriert Zoom + Pan. Kanonische Loesung: React-Flow's `screenToFlowPosition` (rechnet `pointToRendererPoint` mit Transform). Betrifft Drag UND Click-to-Place gleichermassen. |
| **B2** | Drag-Drop greift manchmal gar nicht | unklar | Ja: [drag-drop-spawn-diagramm-typ-aware.md](../solutions/ui-bugs/drag-drop-spawn-diagramm-typ-aware.md) | Stale Build ODER `data-viso-canvas-pane`-Selector-Stale beim Tab-Wechsel (silent `null`-Return). Plus: Tool-State leckt evtl. ueber Diagramm-Typen. |
| **B3** | Linien (Edges) lassen sich nicht ziehen | unklar | Ja: [react-flow-edges-readonly.md](../solutions/ui-bugs/react-flow-edges-readonly.md) | Stale Build ODER ERD-spezifischer Legacy-File-Fall (Fix in Commit `51ce91e`). |
| **B4** | Linien lassen sich nicht loeschen | unklar | Ja: [react-flow-edges-readonly.md](../solutions/ui-bugs/react-flow-edges-readonly.md) | Stale Build ODER `interactionWidth` der Custom-Edges zu klein (default 20px, Touch-zu-klein). Custom-Edges haben das Setting aktuell gar nicht gesetzt. |

### Warum Pfad D (Kurzfassung — Vergleich im Brainstorm)

A/B/C aus dem Strategie-Vergleich setzen voraus, dass der Editor
selbst traegt. Wenn die Drag-Drop-Position nach 4 Wochen
Re-Test-Optimismus immer noch falsch ist, ist jede Hub-Strategie
auf Sand gebaut. Pfad D priorisiert die Editor-Basis.

---

## Proposed Solution

Fuenf Etappen, jede mit klarem Abschluss-Kriterium. E2 startet erst,
wenn E1 die Bugs reproduziert hat (oder festgestellt hat, dass
sie bereits gefixt sind und nur ein Re-Build fehlte).

```
E1 Reproduktion ──▶ E2 Critical Fixes ──▶ E2.5 Quick-Wins ──▶
E4 Daily-Use-Run ──▶ E3 Polish-Sweep + E5 Iteration (parallel)
```

E3 (Polish) und E5 (Iteration aus Real-Findings) laufen nach E4
parallel — Polish-Items werden je nach Real-Findings re-priorisiert.

**Bug-driven, nicht use-case-driven:** B1 wird in allen 3 Diagrammtypen
gemeinsam reproduziert und gefixt, dann B2, dann B3/B4. Vorteil:
Root-Cause oft im selben Modul — 1 Fix loest 3 Stellen.

---

## Technical Approach

### Etappe E1 — Live-Reproduktion (Gate)

**Ziel:** Klarheit, ob die 4 Bugs aktuell tatsaechlich im Editor auftreten,
und falls ja: was genau passiert. Ohne diese Klarheit faellt jeder Fix
in den Synthetic-vs-Real-Spalt.

#### E1.0 — Build-Freshness-Check (allererster Schritt)

```bash
# Disambiguation in 5 Sekunden
stat -f "%Sm" dist/server.cjs src/preview/App.tsx src/tools.ts
git log -1 --format="%h %s" -- dist/
git log -1 --format="%h %s" -- src/
```

Wenn `src/`-Mtime > `dist/`-Mtime: `npm run build`, dann zurueck zu E1.1.

- [ ] `npm run build && npm test && npm run typecheck` — alles gruen, sonst nicht weitergehen

#### E1.1 — Editor starten und Sample-Setup

- [ ] Sauberes Test-Verzeichnis ausserhalb des Repo-Roots
- [ ] `npx viso-mcp init --with-samples` (zieht 4-Tabellen-DBML, 8-Node-BPMN, 5-Node-Landscape)
- [ ] `npx viso-mcp serve` — Browser auf `http://localhost:5555`
- [ ] Initial-Smoke: alle 3 Tabs öffnen, Knoten + Edges sichtbar?
- [ ] DevTools Hard-Reload + Application > Storage > Clear Site Data (entfernt Service-Worker-Cache)

#### E1.2 — Bug-Repro nach Bug-Gruppen (vereinfacht)

Repro-Datei: `docs/usage-log/2026-05-03-bug-repro.md`. Jeder Bug bekommt:
Build-Hash, Repro-Steps, Expected, Actual (Pixel-Werte!), Frequency, Severity, Console-Output.

**B1 (Drop-Position) — minimal-aussagekraeftig:**

- [ ] Pro Diagrammtyp ein Drop bei Default-Zoom
- [ ] Pro Diagrammtyp ein Drop bei Zoom 50%
- [ ] Pro Diagrammtyp ein Drop nach Pan
- [ ] Pixel-Offset quantifizieren: erwartete vs. tatsaechliche Mittelpunkt-Position, plus Zoom-Wert + Pan-Offset
- [ ] Click-to-Place vergleichen — gleicher Bug?

(6 Klicks reichen, um Existenz und Muster zu bestaetigen — keine Variations-Matrix.)

**B2 (Drag greift nicht):**

- [ ] BPMN → ERD → Landscape: Tool selektieren, Tab wechseln, sofort drag-drop
- [ ] Spezifisch: zwischen den Tabs hin- und herwechseln, dann drag — wie oft schluckt's?
- [ ] DevTools: `console.log` in `handleSpawnFromPointer` einbauen (E1-only, vor Repro), `null`-Selector-Treffer protokollieren

**B3 (Edges nicht ziehbar):** alle 3 Typen, plus 1× mit Notion-Pipeline-Output (Legacy-Format)

**B4 (Edges nicht loeschbar):** Edge anklicken (Hitbox-Test bei verschiedenen Positionen), Backspace, Delete

#### E1.3 — Klassifikation pro Bug

- **Tatsaechlich offen** → Fix-Plan in E2
- **Stale-Build-Effekt** (verschwindet nach Re-Build) → CI-Sentinel-Step (E2.0), in CHANGELOG
- **Edge-Case** → Solution-Doc erweitern + Fix in E2

#### Research Insights — E1

**Best Practices (Bug-Repro-Methodik):**
- Pflichtfelder pro Bug: Steps / Expected / Actual / Environment / Frequency / Severity / Evidence (GitHub-Issue + STAR-Hybrid)
- DevTools-Reihenfolge: Hard-Reload → Console → Network → React DevTools → Elements (80% der Faelle sind Stale Cache → Schritt 1 zuerst)
- Pixel-Offset bei B1 quantifizieren: notiere Zoom-Wert + Pan-Offset + erwartete vs tatsaechliche Position. Diese 3 Werte verraten sofort, ob Coordinate-Transform falsch ist
- Drag-Drop spezifisch: DevTools im _separaten Fenster_, nicht docked — Pointer-Events haben mit docked DevTools drastisch reduzierte FPS (react-three-fiber Issue #1196)

**Quellen:**
- https://testgrid.io/blog/guide-to-write-an-effective-bug-report/
- https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms
- https://www.codemzy.com/blog/drag-and-drop-bug-fixes

**Markdown-Template fuer `docs/usage-log/2026-05-03-bug-repro.md`:**

```markdown
# Bug-Repro Session — 2026-05-03

## Build-Info
- Git-SHA: <short>
- dist/server.cjs Mtime: <YYYY-MM-DD HH:MM>
- Stale-Build-Verdacht: ja/nein → npm run build ausgefuehrt: ja/nein
- Post-Build SHA1 (dist): <hash>

## Environment
- Browser: Chrome <version> (macOS <version>)
- DevTools: separates Fenster

## B1 — Drag-Drop falsche Stelle
**Steps:** 1. ... 2. ...
**Expected:** Knoten-Mittelpunkt = screenToFlowPosition(clientX, clientY)
**Actual:** Knoten landet bei (X, Y) im Flow-Space. Offset: -68px x / -52px y. Zoom: 0.75. Pan: (-120, -45).
**Frequency:** 5/5
**Severity:** Hoch
**Console:** keine Errors / [Errors hier]

## B2 / B3 / B4 — analog
```

**Abschluss-Kriterium E1:** `docs/usage-log/2026-05-03-bug-repro.md` enthaelt
fuer jeden der 4 Bugs eine Klassifikation und (falls offen) prazise
Repro-Steps. Commit `docs(usage-log): E1 — Live-Repro 4 Bugs`.

---

### Etappe E2 — Critical Fixes

**Ziel:** Die in E1 als "tatsaechlich offen" klassifizierten Bugs fixen.
Pro Bug eigener Sub-Branch (`fix/B1-drop-position`, `fix/B2-tab-switch`, etc.),
alle gegen `feat/v1.2-stabilization-d`.

#### E2.0 — Build-Freshness-Sentinel (persistent)

Falls E1.0 zeigt, dass Stale Build die Bugs erklaert: die Maßnahme
persistieren, damit es nicht wieder passiert.

- [ ] Pre-Push-Hook oder CI-Step: `[ src/ -ot dist/ ]` failed-by-default
- [ ] README-Sektion "Bevor du `npx viso-mcp serve` ausfuehrst: `npm run build` wenn `src/` neuer ist"
- [ ] Optional: `viso-mcp serve` startet selbst mit Mtime-Check und warnt, wenn Stale

#### E2.B1 — Drop-Position (vermutlich tatsaechlich offen)

**Strategie:** Coordinate-Transform-Unification — alle 3 Spawn-Pfade
(Drag-Drop, Click-to-Place, paneClick) gemeinsam migrieren auf
`screenToFlowPosition`. Helper extrahieren als reine Funktion fuer
testbarkeit.

**Fix-Skizze (Plain Language):**

Statt im `App` selbst zu rechnen, fragt `App` den aktuell aktiven
Canvas: "wandle mir bitte diesen Mauszeiger in deine Flow-Koordinaten
um". Der Canvas weiss als einziger, wie der Viewport gerade
verschoben/gezoomt ist (xyflow-Anforderung: `useReactFlow()` muss
INNERHALB jedes `<ReactFlow>`-Subtrees aufgerufen werden).

**Akzeptanzkriterien E2.B1:**

- [ ] Coordinate-Helper als reine Funktion in `src/preview/lib/coords.ts` extrahiert (testbar ohne DOM)
- [ ] `useReactFlow().screenToFlowPosition` wird in jeder Canvas-Komponente (ErdCanvas/BpmnCanvas/LandscapeCanvas) verwendet, nicht in App.tsx
- [ ] Bei Zoom 50/100/200% landet Knoten beim Mauszeiger (±5px)
- [ ] Nach Pan/Scroll: Knoten landet beim Mauszeiger
- [ ] Click-to-Place (`paneClick` in App.tsx:180-190) verhaelt sich identisch — gleicher Helper genutzt
- [ ] Pure-Function-Vitest-Test fuer den Helper (kein jsdom-Layout-Engine-Problem)
- [ ] 1× Playwright-Smoke pro Diagramm-Typ (echte Browser-Drag-Drop)
- [ ] Solution-Doc neu: `docs/solutions/ui-bugs/drag-drop-position-zoom-aware.md`

#### Research Insights — E2.B1

**React Flow 12 Specifics:**
- `screenToFlowPosition(clientPos, options?)` rechnet 3 Schritte: `clientPos - domNode.getBoundingClientRect()` → `pointToRendererPoint(transform, snapToGrid)` → `XYPosition`. Genau die mittlere Schicht fehlt aktuell.
- `useReactFlow()` MUSS innerhalb eines `<ReactFlowProvider>` sein. xyflow Issue #5689: Multiple `<ReactFlow>` unter EINEM Provider verursacht Knoten-Jitter — viso-mcp braucht 3 separate Provider.
- iPad-Safari: `clientX/Y` (nicht `pageX/Y`) und `touch-action: none` auf `.react-flow__pane` setzen
- `nodeOrigin` Default `[0, 0]` beibehalten — `screenToFlowPosition` ignoriert `nodeOrigin` ohnehin, also Origin per neuem Knoten setzen wenn zentriert gewollt

**Pitfalls:**
- P1: Manuelle `clientX - paneRect.left`-Math (genau der Bug)
- P2: `useReactFlow()` ausserhalb Provider → undefined
- P4: `pageX` statt `clientX` shifted by scroll
- P5: 1 Provider fuer mehrere Flows = Knoten-Jitter
- P7: Default `interactionWidth: 20` (B4) zu klein fuer Touch — wird in B4 mit-gefixt

**Quellen:**
- https://reactflow.dev/api-reference/hooks/use-react-flow
- https://reactflow.dev/examples/interaction/drag-and-drop
- https://github.com/xyflow/xyflow/issues/5689 (multi-instance Provider-Bug)

**Code-Locations (verifiziert via Code-Audit):**
- `src/preview/App.tsx:1098-1112` — `handleSpawnFromPointer` (Drop-Berechnung)
- `src/preview/App.tsx:180-190` — `paneClick` Handler (Click-to-Place, identische Math)
- `src/preview/hooks/usePaletteDrag.ts:36-42` — `dispatchSpawn` (CustomEvent-Emitter, kein Change noetig)

#### E2.B2 — Drag-Drop greift nicht (Edge-Cases nach Tab-Wechsel)

**Wenn Stale-Build-Effekt:** keine Code-Aenderung, nur E2.0-Sentinel.

**Wenn echter Edge-Case — Top-Hypothesen (sortiert nach Wahrscheinlichkeit):**

- **H2 (sehr hoch):** `document.querySelector('[data-viso-canvas-pane="<diagramType>"]')` ist beim Tab-Wechsel stale (DOM-Replacement und State-Update nicht im selben Commit). `null`-Return → `if (!pane) return` schluckt es geraeuschlos. **Fix:** `useRef` auf das Pane-Element halten, via Callback-Ref im Canvas gesetzt.
- **H3 (hoch):** `activeTool` steht noch auf `"task"` (BPMN), `diagramType` ist schon `"erd"` → `isToolValidForDiagram` returnt `false`. **Fix:** Beim Tab-Wechsel `setActiveTool('pointer')` ausloesen.
- **H1 (mittel):** `useEffect`-Cleanup-Race im `useSpawnListener` — Listener kurzzeitig leer zwischen Tab-Wechsel-Commits. **Fix:** Listener permanent auf `window` halten, `enabled`/`onSpawn`-Check via `useRef` lesen.

**Akzeptanzkriterien E2.B2:**

- [ ] Tool selektieren → Tab wechseln → zurueckwechseln → drag-drop spawnt Knoten (5/5)
- [ ] Vitest mit jsdom + `@testing-library/user-event` deckt H1/H2/H3 (`rerender(<App diagramType="bpmn" />)` + CustomEvent-Dispatch + Spawn-Spy)
- [ ] Smoke-Test: alle 3 Tabs durchklicken, drag-drop am Anfang und am Ende
- [ ] `src/preview/__tests__/spawn-listener.test.tsx` neu erstellen (existiert noch nicht)

#### Research Insights — E2.B2

- Vitest deckt 80% der Hypothesen (H1/H2/H3) deterministisch
- H4/H6 (Pointer-Capture, Strict-Mode-Double-Mount) brauchen Playwright — erst nachgelagert
- React 19 Dev-Mode mountet Effects 2× (Strict Mode) — das verdoppelt H1-Race-Chance in dev. Production-Build separat testen.

**Code-Locations:**
- `src/preview/hooks/usePaletteDrag.ts:44-118` — `usePaletteDrag` (Pointer-Events Drag-Listener)
- `src/preview/hooks/usePaletteDrag.ts:134-145` — `useSpawnListener` (Window-Listener)
- `src/preview/hooks/usePaletteDrag.ts:28` — `CANVAS_DROPZONE_SELECTOR`
- `src/preview/state/useToolStore.tsx:164-169, 28-43` — Tool-Persistierung (Context-basiert, Session-only)

#### E2.B3 / E2.B4 — Edges create/delete

Hauptverdacht: Stale-Build. Falls echter Edge-Case:

- **B3:** ERD-Legacy-Files brechen vor `normalizeRelations` (Reader-Pfad bereits gefixt). Falls weiter offen: Spalten-Handle-Suffix-Logik (`column-source`/`column-target`) bei Bindestrichen pruefen.
- **B4:** `interactionWidth` auf Custom-Edges (`RelationEdge.tsx`, `SequenceFlowEdge.tsx`, `LandscapeRelationEdge.tsx`) ist aktuell **nicht gesetzt** — Default 20px ist fuer Touch zu klein. Empfehlung: `defaultEdgeOptions={{ interactionWidth: 40 }}` plus `connectionRadius: 30` auf den 3 `<ReactFlow>`-Instanzen.

**Akzeptanzkriterien E2.B3:**

- [ ] Drag von Source-Handle zu Target-Handle erzeugt Edge in allen 3 Diagrammtypen
- [ ] In ERD: Edge auch zwischen `column-source` und `column-target` von Spalten mit Bindestrich im Namen
- [ ] Source-File enthaelt nach Connect die neue Relation/Flow in kanonischer Form
- [ ] Bei Legacy-Files: erstes Connect migriert opportunistisch zur v1.1-Form (`normalizeRelations`)

**Akzeptanzkriterien E2.B4:**

- [ ] Edge anklicken (Hitbox >= 40px), Backspace loescht aus Canvas und Source-File
- [ ] Edge anklicken, Delete loescht (gleicher Code-Pfad)
- [ ] In allen 3 Diagrammtypen reproduzierbar
- [ ] `interactionWidth: 40` in `defaultEdgeOptions` aller 3 ReactFlow-Instanzen
- [ ] `connectionRadius: 30` aller 3 ReactFlow-Instanzen
- [ ] `EditableReactFlow`-Wrapper erstellt mit Generics `<N extends Node, E extends Edge>`, alle 3 Canvases nutzen ihn

#### Research Insights — E2.B4

**`EditableReactFlow`-Pattern (Kieran-Korrektur des Solution-Doc-Vorschlags):**

```ts
import type { ReactFlowProps, Node, Edge } from '@xyflow/react';

type RequiredEditable<N extends Node, E extends Edge> =
  ReactFlowProps<N, E> & Required<Pick<
    ReactFlowProps<N, E>,
    'onNodesChange' | 'onEdgesChange' | 'onConnect' | 'onEdgesDelete'
  >>;

export function EditableReactFlow<N extends Node = Node, E extends Edge = Edge>(
  props: RequiredEditable<N, E>
) {
  return <ReactFlow<N, E> {...props} />;
}
```

Plain Language: Der Wrapper erbt Knoten-Typ-Information (Spalten in ERD,
Label in BPMN). Ohne Generics wuerde der Wrapper jeden Custom-Knoten
als "unbekannt" sehen.

**Pre-Commit-Hook gegen Direkt-Imports:**

```bash
#!/bin/sh
# .husky/pre-commit
if grep -rn '<ReactFlow ' src/preview/components/canvases/ src/preview/App.tsx 2>/dev/null \
  | grep -v 'EditableReactFlow' | grep -v '//.*'; then
  echo "ERROR: direct <ReactFlow> in canvas code. Use EditableReactFlow."
  exit 1
fi
```

**Code-Locations (verifiziert):**
- `src/preview/hooks/useDiagramSync.ts:194-197` — ERD `handleColumn` Suffix-Strip
- `src/preview/hooks/useDiagramSync.ts:224-253` — ERD `onConnect`
- `src/preview/hooks/useDiagramSync.ts:255-280` — ERD `onEdgesDelete`
- `src/preview/hooks/useProcessSync.ts:211-228, 230-247` — BPMN `onConnect/Delete`
- `src/preview/hooks/useLandscapeSync.ts:214-234, 236-251` — Landscape `onConnect/Delete`
- `src/preview/components/{erd,bpmn,landscape}/*Edge.tsx` — Custom-Edges (kein `interactionWidth` aktuell)

**Abschluss-Kriterium E2:** Alle in E1 offenen Bugs gefixt oder klassifiziert.
Conventional Commits pro Bug. Solution-Docs in `docs/solutions/ui-bugs/`.

---

### Etappe E2.5 — Quick-Wins (Eingeschoben)

Zwei Items, die billig und logisch zur E2-Fix-Welle gehoeren —
teil-implementiert oder strukturelles Schutzgeruest.

#### E2.5.1 — ERD-Tabellen-Rename in PropertiesPanel (S, ~3h)

**Status:** im CHANGELOG-Unreleased-Block schon notiert, vermutlich
teil-implementiert (`applyErdTableUpdate` mit Rename-Logik existiert,
laut CHANGELOG +6 Tests). Pruefen: fehlt nur das UI-Wiring?

**Akzeptanzkriterien:**

- [ ] PropertiesPanel-Header: ERD-Tabellen-Name editierbar
- [ ] On-Blur PATCH ruft `applyErdTableUpdate` auf — Tabellen-Schluessel + alle Relations (`from.table`, `to.table`) werden mitgezogen
- [ ] Validierung gegen `SafeIdentifier`-Regex; Trivial / Kollision / Invalid sind stille no-ops
- [ ] CHANGELOG aktualisiert

#### E2.5.2 — Exhaustive-Switch-Refactor in App.tsx (XS, ~30 min)

**Status:** 4 nicht-erschoepfende `switch`-Statements in `App.tsx`
(Zeilen 1252, 1265, 1278, 1292: `isToolValidForDiagram`, `typePrefix`,
`defaultLabel`, `landscapeDefaultLabel`). Ein 4. Diagrammtyp wuerde
stumm fehlschlagen.

**Akzeptanzkriterien:**

- [ ] Helper `assertNever(x: never): never` in `src/preview/lib/exhaustive.ts` neu
- [ ] Alle 4 switch-default-Branches umgestellt auf `return assertNever(diagramType)`
- [ ] `npm run typecheck` gruen — bei einem hypothetischen 4. Diagrammtyp wuerden alle 4 Stellen TS-Errors werfen

**Plain Language:** "Wenn jemand spaeter einen 4. Diagrammtyp einfuehrt,
bricht der Build an genau den Stellen, wo eine Erweiterung noetig ist —
kein Suchen, kein Vergessen."

---

### Etappe E4 — Daily-Use-Run

**Ziel:** Fabian nutzt den stabilisierten Editor fuer ein echtes
Kundenprojekt komplett ohne Workarounds. Das ist die einzige
Validierung, die die Synthetic-vs-Real-Luecke schliesst.
**Wichtig:** E4 kommt VOR E3 — Real-Findings priorisieren Polish.

#### Setup

- [ ] Kundenprojekt waehlen (Notion-Pipeline-Output OK, Greenfield OK)
- [ ] Browser-Tab-Bookmark, `docs/usage-log/`-Verzeichnis erreichbar
- [ ] Bug-Capture-Modus: Frust im Chat → Claude legt `docs/usage-log/YYYY-MM-DD-<slug>.md` an

#### Was Fabian probiert

- [ ] 1× ERD von 5+ Tabellen vollstaendig im Editor zusammenklicken
- [ ] 1× BPMN von 5+ Knoten vollstaendig zusammenklicken
- [ ] 1× Landscape mit 3+ Boundaries
- [ ] Notion-Pipeline-Output oeffnen, Tabelle umbenennen, Spalte hinzufuegen, Relation erstellen, Reload, alles noch da
- [ ] Export pro Diagramm-Typ ausprobieren (Mermaid, SVG/PNG)

#### Bug-Capture pro Frust-Punkt

- Datum + Diagramm-Typ + Build-Hash
- Repro-Steps (wenn moeglich)
- Expected vs Actual
- Schweregrad (klein / mittel / blockierend)
- **Tag `hub-relevant`** wenn ein Friction-Punkt Hub-Architektur betrifft (z.B. "kann nicht in Notion einbetten") — fuer das Hub-Folge-Brainstorm

**Abschluss-Kriterium E4:** Mindestens 1 abgeschlossenes Kundenprojekt
komplett im Editor erstellt. `docs/usage-log/`-Verzeichnis enthaelt 0
oder mehr Eintraege — egal wie viele, Hauptsache ehrlich.

---

### Etappe E3 — Polish-Sweep (post-E4)

**Ziel:** Re-priorisierte Polish-Items aus dem v1.1.2-Re-Test, jetzt
gefiltert durch Real-Findings aus E4. Wenn E4 zeigt, dass
Auto-Layout-Performance nie ein Problem war: streichen. Wenn andere
Polish-Items aus E4 dazugekommen sind: einsortieren.

#### E3.1 — Auto-Layout-Performance (M, ~4h, falls in E4 als Frust gemeldet)

**Empfehlung statt Web-Worker (Performance-Oracle):** drei billige Hebel
in dieser Reihenfolge — wenn die ersten zwei reichen, ist Schritt 3
und der Worker ueberfluessig.

1. **Hash-basiertes Layout-Caching (XS, ~2h)** — `nodes.map(n=>n.id).sort().join('|')` als Cache-Key, Positionen in `*.pos.json` (existiert bereits laut CHANGELOG). Re-Mount mit gleichen Knoten = 0ms ELK. Loest 80% der Faelle.
2. **Deferred Layout via `requestIdleCallback` (XS, ~1h)** — Mount mit Default-Positionen, Layout snappt nach erstem Paint ein (~300ms). Subjektiv viel besser als 600ms-Freeze.
3. **Manual-Button als Fallback (XS, ~1h)** — `<button onClick={handleAutoLayout}>` im TopHeader.
4. **ELK-Config tunen** — `elk.layered.thoroughness: 1` (statt default 7) bringt 3-5× Speedup bei minimalem Qualitaetsverlust.
5. **Web Worker (Loesung A)** — explizit AUS dieser Phase. Steht in Future Considerations, nur wenn 1+2+3+4 nicht reichen.

**Akzeptanzkriterien (umformuliert):**

- [ ] First Paint < 200ms (nicht: gesamtes Layout < 200ms — unrealistisch fuer ELK bei 47 Knoten)
- [ ] Layout-Einrasten < 800ms (asynchron, nicht-blockierend)
- [ ] Re-Mount mit unveraenderten Knoten < 50ms (Cache-Hit)
- [ ] Bestehender Auto-Layout-Test in `auto-layout.test.ts` weiter gruen

#### E3.2 — Sample-Files Distribution (XS, ~1h)

**Status:** MI-3 partial. `init --with-samples` shipped, aber `git clone +
npm run preview` ohne `init` faellt in EmptyState.

**Loesung:** Tiny pre-init `dev/sample.erd.json` (nicht .gitignored), nur
fuer den Demo-/Screenshot-Fall.

#### Research Insights — E3

**ELK-Benchmarks (real):**
- 30 Knoten: ~150-300ms
- 50 Knoten: ~500-900ms (passt zur Plan-Beobachtung)
- 100 Knoten: > 2s

**xyflow v12 + ELK Tipps:**
- `useNodesState`/`useEdgesState` nur fuer interaktive States — Layout-Pass direkt `setNodes` ohne Hook-Diffing
- `nodesDraggable={false}` waehrend Layout, dann re-enable
- `defaultEdgeOptions` statt per-Edge-Props (spart Re-Renders)
- `onlyRenderVisibleElements: true` bei > 50 Knoten — Viewport-Culling
- `fitView` separat von Layout — beide zusammen verdoppeln Reflow

**Abschluss-Kriterium E3:** Re-priorisierte Items entweder geschlossen oder begruendet verworfen.

---

### Etappe E5 — Iteration

**Ziel:** Die in E4 gemeldeten Bugs fixen, sortiert nach Schweregrad.
Laeuft parallel zu E3 — Real-Findings haben Vorrang vor
vermutetem Polish.

#### Vorgehen

- [ ] Pro Eintrag in `docs/usage-log/`: Repro im Editor, Hypothese, Fix, Solution-Doc
- [ ] Fixes im Sub-Branch-Pattern (`fix/<kurz-beschreibung>`)
- [ ] Nach jedem Fix: Smoke-Test alle 3 Diagrammtypen (kein Re-Frust)
- [ ] CHANGELOG aktualisiert

#### Loop-Ende — beide Indikatoren positiv

- **Indikator 1 (subjektiv):** Fabian sagt: _"ich nutze es jetzt taeglich, ohne Frust"_
- **Indikator 2 (objektiv, quantifiziert):** **0 neue `usage-log`-Eintraege bei mindestens 3 Daily-Use-Sessions in 7 Tagen**

#### E4-Findings, die in E2 als "fixed" galten

- Solution-Doc-Update (Edge-Case-Sektion) + Fix in E5
- **NICHT** zurueck zu E2 — E2 ist Phase-Gate, kein Loop-Target

**Abschluss-Kriterium E5:** Beide Indikatoren positiv. Letzter Commit
auf dem Stabilisierungs-Branch ist `chore(release): v1.2.0 —
Stabilisierung`.

---

### Hub-Frage — Trigger nach E5 (kein Etappen-Schritt mehr)

Mit den Daten aus E1–E5 die in der Brainstorm-Tabelle vertagte
Hub-Strategie entscheiden. Eigenes Brainstorm + eigener Plan,
nicht Etappe dieses Stabilisierungsplans.

**Input:**
- `docs/usage-log/`-Eintraege mit Tag `hub-relevant` (gesammelt waehrend E4/E5)
- E2/E3 Solution-Docs (Welche Fixes waren teuer? Welche trivial?)
- Hub-Anforderungen (Was muss der Hub rendern? Inline-Edit? Read-only? Kommentare?)

**Triggert:** `compound-engineering:workflows:brainstorm` mit Datei
`docs/brainstorms/2026-MM-DD-viso-mcp-hub-strategie-brainstorm.md`.

---

## Acceptance Criteria

### Funktional (pro Etappe)

| Etappe | Kriterium |
|---|---|
| E1 | `docs/usage-log/2026-05-03-bug-repro.md` enthaelt fuer B1–B4 jeweils Klassifikation + Repro-Steps + Pixel-Daten |
| E2 | Alle "tatsaechlich offen"-Bugs aus E1 sind gefixt; Pure-Function-Vitest-Coverage; Solution-Doc pro Fix; `EditableReactFlow`-Wrapper aktiv |
| E2.5 | ERD-Rename funktioniert; alle 4 switch-Statements sind exhaustive-checked |
| E4 | Mindestens 1 abgeschlossenes Kundenprojekt komplett im Editor erstellt |
| E3 | Real-priorisierte Polish-Items entweder geschlossen oder begruendet verworfen |
| E5 | Subjektiv: Fabian "ohne Frust"; Objektiv: 0 neue Eintraege bei ≥ 3 Daily-Use / 7 Tage |

### Nicht-funktional

- **Tests gruen:** `npm test` muss am Ende jeder Etappe gruen sein (310/310 Stand 2026-05-01)
- **Typecheck gruen:** `npm run typecheck`
- **Build aktuell:** Vor jedem Etappen-Abschluss `npm run build`, `dist/` darf nicht aelter sein als `src/`
- **Conventional Commits:** `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- **Branch-Hygiene:** Plan-Branch (`docs/brainstorm-stabilisierung-pfad-d`); Sub-Branches pro Bug (`fix/B1-...`) gegen `feat/v1.2-stabilization-d`
- **Solution-Doc nach jedem Fix**

---

## Success Metrics

### Primaer (subjektiv, du-zentriert)

- Fabian nutzt `viso-mcp` taeglich fuer Kundenarbeit ohne Workarounds
- Fabian sagt explizit: _"das geht jetzt"_

### Sekundaer (objektiv, als Korrektiv)

- 0 neue `docs/usage-log/`-Eintraege bei mindestens 3 Daily-Use-Sessions in 7 Tagen
- Tests-Suite waechst mit jedem Fix
- CHANGELOG-Unreleased-Block hat < 5 offene Items am Ende

### Nicht-Ziele

- SUS-Score (kommt erst beim externen Test post-Stabilisierung)
- Cross-Browser-Coverage (Safari iPad opportunistisch)
- Keyboard-Shortcuts-Vollstaendigkeit

---

## Dependencies & Prerequisites

- Node 20.18+, `npm ci`
- Browser (Chrome bevorzugt, DevTools im separaten Fenster)
- Test-Verzeichnis ausserhalb des Repo-Roots fuer `npx viso-mcp init`
- Mindestens 1 echtes Kunden-ERD fuer E4
- Brainstorm + Solution-Docs internalisiert, CHANGELOG durchgelesen

---

## Risk Analysis & Mitigation (4 echte Risiken)

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| **Stale-Build erklaert alle 4 Bugs** | hoch | hoch (positiv) | E1.0 erste Aktion. Wenn Bugs verschwinden: E2.0 Sentinel-Step. |
| **B1 ist tiefer als nur `screenToFlowPosition`** | mittel | mittel | E1.2 mit Zoom-Variations testet Hypothese. Falls falsch: neue Hypothese (multi-Provider, Pointer-Capture, etc.) |
| **E4 zeigt keinen Frust → falsche Sicherheit** | gering | hoch | Indikator 2 (≥ 3 Daily-Use / 7 Tage, 0 Eintraege) als hartes Korrektiv |
| **Fabian-Disziplin fuer Bug-Capture wankt** | mittel | gering | Vereinfachter Capture-Mode (Chat → Claude). Claude proaktiv: "willst du das festhalten?" |

---

## Resource Requirements

- **Personal:** Fabian (Validator + Real-User), Claude (Implementor + Documenter)
- **Zeit:** keine Deadline, Etappen-getaktet
- **Infrastruktur:** lokal, keine CI/CD-Aenderungen
- **Externe Abhaengigkeiten:** keine

---

## Future Considerations

- **Web Worker fuer ELK** — wenn E3.1 Caching+IdleCallback nicht reicht
- **Externer Real-User-Test** (3-5 KMU-Berater post-E5, TAFKA-Sparring-Channel)
- **Hub-Brainstorm + -Plan** als Folge-Stream nach E5
- **Performance-Budget in CI** — "ELK initial < 400ms fuer n ≤ 30 nodes"
- **CI-Step Stale-Build-Guard** als Pre-Push-Hook (nur wenn Pattern wieder auftritt)

---

## Documentation Plan (3 Stellen, nicht 7)

| Wann | Was | Wohin |
|---|---|---|
| E4 (laufend) + E1 | Repro-Eintraege + Frust-Eintraege | `docs/usage-log/` |
| Pro Fix | Solution-Doc mit Symptom / Root Cause / Fix / Prevention | `docs/solutions/<kategorie>/<slug>.md` |
| Pro Etappen-Ende | CHANGELOG-Unreleased-Block | `CHANGELOG.md` |

Compound-Engineering-Lessons via `compound-engineering:workflows:compound`
am Phasen-Ende — kein eigener Doc-Slot, sondern Trigger.

---

## Operational Appendix (Tier-2-Vertiefung)

Nach 13 parallelen Research-Agents in 2 Runden hier die ausfuehrungsfertigen
Operational-Details. Jede Sub-Sektion ist eigenstaendig nutzbar.

### Anhang A — E1 Live-Repro Operational Playbook

#### A.1 Vorbereitungs-Checkliste (vor der Browser-Session)

**7 Console-Logs einbauen mit `// E1-DEBUG`-Marker (vor `git checkout` revertierbar):**

| Datei | Zeile | Was loggen | Liefert |
|---|---|---|---|
| `usePaletteDrag.ts` | vor `dispatchSpawn` (~Z. 100) | `toolType, e.clientX, e.clientY, dropzone?.dataset.visoCanvasPane, document.querySelectorAll('[data-viso-canvas-pane]').length` | B1 (Pixel-Input) + B2 (Pane-Treffer/Miss + Mehrfach-Treffer) |
| `usePaletteDrag.ts` | `useSpawnListener.handler` (Z. 138) | `detail, enabled, performance.now()` | B2 (Listener-aktiv-Status, Race-Detection) |
| `useDiagramSync.ts` | Z. 224 (`onConnect`), Z. 255 (`onEdgesDelete`) | `params, diagramType` | B3/B4 fuer ERD |
| `useProcessSync.ts` | Z. 211, 230 | analog | B3/B4 fuer BPMN |
| `useLandscapeSync.ts` | Z. 214, 236 | analog | B3/B4 fuer Landscape |

**Revert nach E1.3:** `git diff` auf `// E1-DEBUG`-Marker, `git checkout -- <files>`.

**DevTools-Setup (im SEPARATEN Fenster, nicht docked — sonst FPS-Drop):**

- Settings > Preferences > Show rulers on hover
- More tools > Rendering: "Highlight pointer events" + "Frame Rendering Stats" + "Layer borders"
- Network: "Disable cache" aktivieren
- Console: "Preserve log" aktivieren
- `Cmd+Shift+P` > "Show frames per second"

**Editor starten — korrekter E1-Pfad:** `npm run build && npx viso-mcp serve`
(genau das, was Fabian taeglich macht — `vite preview` waere blind fuer Stale-Build).
Build-Hash via `git rev-parse --short HEAD` notieren.

#### A.2 Stale-Build-Disambiguation (5-Sekunden-Bash-Oneliner)

```bash
[ "$(stat -f %m src/preview/App.tsx)" -gt "$(stat -f %m dist/server.cjs)" ] \
  && echo "STALE: npm run build erforderlich" || echo "FRESH"
```

#### A.3 Repro-Skript pro Bug

**B1 — Pixel-Offset quantifizieren:**
- Pro Diagrammtyp + Zoom-Level (100/50%/post-Pan): Tool dragen
- `event.clientX/Y` aus E1-DEBUG-Log ablesen
- Knoten-Position via Console: `window.__REACT_FLOW_INSTANCE__?.getNodes()` (oder via React DevTools)
- Differenz berechnen, plus `getViewport().zoom` und `getViewport().x/y` mit-loggen

**B2 — Tab-Wechsel-Race:**
- Sequenz `BPMN auswaehlen → ERD-Tab → drag-drop` 10× wiederholen, Treffer/Miss zaehlen → Frequency
- Console-Log zeigt: `dropzone === null`? `pane-Elemente.length > 1`? `enabled === false beim Spawn`?

**B3 — Edges:**
- ERD: 2 Tabellen, Spalte→Spalte ziehen. `git diff` auf `schema.erd.json`: Eintrag in `relations[]` neu?
- Mit Notion-Pipeline-File wiederholen (Legacy-Format)

**B4 — Edges loeschen:**
- Edge anklicken — `selectedEdges.length > 0`? `interactionWidth` der Custom-Edges via Elements-Tab inspizieren
- Backspace/Delete — `onEdgesDelete`-Log feuert?
- Hitbox-Test: 5 Klicks an unterschiedlichen Edge-Positionen

#### A.4 Recorder statt Playwright im E1-Scope

**Empfehlung: Chrome DevTools "Recorder"-Tab** (built-in). `Cmd+Shift+P` > "Show Recorder", Session aufnehmen, als JSON speichern. Reicht fuer Frame-by-Frame-Review. Playwright-Setup kostet ~1h, lohnt erst bei E2-E5.

#### A.5 Triage-Matrix nach E1.3

| Outcome | Naechster Plan-Schritt |
|---|---|
| Alle 4 = stale | E2.0-Sentinel sofort, danach direkt E2.5 + E4 (B1 wahrscheinlich auch erschlagen) |
| B1 offen, Rest stale | E2.B1 startet (Sub-Branch), E2.0 parallel |
| Edge-Case (z.B. nur Legacy-Notion-File bricht B3) | Solution-Doc um Edge-Case-Sektion + Fix als Sub-Task in E2 |
| `hub-relevant`-Tag gesetzt | Pre-Material-Liste fuer Hub-Brainstorm — kein E2-Aufwand |

---

### Anhang B — E2.B1 Coordinate-Transform-Unification (Refactor in 4 Schritten)

#### B.1 Audit-Befund (kritisch)

**Es gibt aktuell ZERO `<ReactFlowProvider>` im Source-Code.** Drei
`<ReactFlow>`-Instanzen laufen im Auto-Provider-Modus → drei separate
Provider-Bubbles. `useReactFlow()` wird **nirgends** aufgerufen. Der
Kommentar in `App.tsx:286-289` belegt: bewusst akzeptierter Workaround.

#### B.2 Refactor-Reihenfolge

**Schritt 1 — Provider mounten (2 Zeilen):**
- `<ReactFlowProvider>` in `VisoEditor.tsx:85-108` um den Editor-Shell
- ODER direkt in `EditorShell` (App.tsx ab Z. 469)

**Schritt 2 — Pure Helper anlegen:**
- Datei: `src/preview/lib/coords.ts` neu
- Signature: `clientToFlowPosition(clientPos, paneRect, viewport): {x, y}`
- Formel: `flowX = (clientX - paneRect.left - viewport.x) / viewport.zoom`
- Tests in `src/preview/lib/coords.test.ts`: Identitaet (zoom=1, pan=0,0), Pan-Only, Zoom-Only, Pan+Zoom, numerische Stabilitaet bei zoom=0.1
- Mehrwert: testbar ohne React-Context (jsdom-NaN-Hell vermieden)

**Schritt 3 — Canvas-Komponenten anfassen (3 Stellen):**
- `App.tsx:180-190` (ErdCanvas), `:283-297` (BpmnCanvas), `:401-411` (LandscapeCanvas)
- Jede Komponente: `const { screenToFlowPosition } = useReactFlow()` ergaenzen
- `bounds.left/top`-Hack ersetzen durch `screenToFlowPosition({x: evt.clientX, y: evt.clientY})`

**Schritt 4 — handleSpawnFromPointer:**
- `App.tsx:1098-1112` — entweder via neuer `CanvasHandles.screenToFlow`-Methode (Type erweitern in Z. 76-88) oder direkt im EditorShell (geht erst nach Schritt 1)
- Existierender Kommentar Z. 286-289 entfernen

#### B.3 Side-Effect-Audit

| Pfad | Risk | Begruendung |
|---|---|---|
| MCP-Tools (`process_add_node`, `diagram_create_table`, `landscape_add_node`) | **null** | Nehmen kein x/y-Input; Positionen via Auto-Layout |
| `usePaletteDrag.ts:53-100` (Drag-DnD) | **MUSS mitziehen** | Sonst Click-to-Place korrekt aber Drop bleibt verzerrt → neuer Inkonsistenz-Bug |
| Auto-Layout-Pfad | **null** | Arbeitet komplett in Flow-Coords |
| `persistPosition` (Sidecar) | **Migrations-Hinweis** | Bestehende `*.pos.json` haben falsche (Pane-Pixel-)Werte. Nach Fix wirken Knoten "verschoben" → Migration-Note ans Format anhaengen |

#### B.4 App.tsx-Split-Empfehlung (kombinieren mit Refactor)

App.tsx hat 1364 Zeilen. Die 3 dupliziertem `handlePaneClick`-Closures
sind ein Code-Smell. Refactor-Gelegenheit: Split in
`src/preview/components/canvases/{ErdCanvas,BpmnCanvas,LandscapeCanvas}.tsx`.
Nicht zwingend in E2.B1, aber sinnvoll waehrend man eh dabei ist.

---

### Anhang C — E2.B2 Race-Conditions (Implementierungs-Plan)

#### C.1 Empfohlene Reihenfolge

1. **Prod-Build-Test ZUERST** (vor Code) — Repro im `npm run build && npx serve dist/` im Inkognito-Tab. Wenn Bug auch hier auftritt: H6 (Strict-Mode-Double-Mount) raus, H1/H2/H3 bleiben.
2. **H3-Fix (1 Zeile, 50% der Symptome)** — `App.tsx:508-512` resettet Tool nur bei *ungueltigem* Tool. Verschaerfen auf jeden Tab-Wechsel:

```ts
useEffect(() => {
  setActiveTool('pointer');
}, [activeTab, setActiveTool]);
```

Alten Effect Z. 508-512 loeschen (Validity-Check obsolet).

3. **H2 + H1 zusammen** — useRef + Listener-permanent in einem Rutsch.

#### C.2 useRef-Migration (H2-Fix, Plain Language)

- `paneRef = useRef<HTMLDivElement | null>(null)` in App.tsx
- Pane-divs (App.tsx:193, 300, 414) bekommen `ref={(el) => { paneRef.current = el; }}` (Callback-Ref reicht — kein `forwardRef` noetig)
- `handleSpawnFromPointer` (Z. 1106): `paneRef.current` statt `document.querySelector(...)`
- `data-viso-canvas-pane`-Marker bleibt fuer DevTools/E2E-Selectors, wird aber nicht mehr gelesen

**Race-Detail (Doku-Pflicht):** Wenn jemand spaeter alle 3 Panes
parallel mountet (`display:none`-Tabs), zeigen alle 3 Refs nacheinander
auf ihr Element und ueberschreiben sich → wieder kaputt. Code-Kommentar:
"Pane wird nur gemounted wenn aktiver Tab — Ref-Strategie haengt davon ab".

#### C.3 Listener-permanent-Pattern (H1-Fix)

```ts
export function useSpawnListener({ onSpawn, enabled }: UseSpawnListenerOptions) {
  const onSpawnRef = useRef(onSpawn);
  const enabledRef = useRef(enabled);

  useEffect(() => { onSpawnRef.current = onSpawn; }, [onSpawn]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  useEffect(() => {
    function handler(e: Event) {
      if (!enabledRef.current) return;
      const detail = (e as CustomEvent<SpawnEventDetail>).detail;
      if (!detail) return;
      onSpawnRef.current(detail.type, { x: detail.clientX, y: detail.clientY });
    }
    window.addEventListener('viso-spawn-node', handler as EventListener);
    return () => window.removeEventListener('viso-spawn-node', handler as EventListener);
  }, []); // <-- leer, exakt einmal
}
```

Plain Language: Listener wird genau einmal beim Mount registriert,
einmal beim Unmount entfernt. Aktuelle Logik wird ueber Refs gelesen,
die immer den neuesten Stand haben.

#### C.4 Zusaetzliche Audits (vor Code)

- **Pointer-Capture-Check in `usePaletteDrag.ts`:** Wird `setPointerCapture` genutzt? Wenn ja: Tab-Wechsel mid-drag = Pointer-Up-Event ins Nirvana. Fix: `releasePointerCapture` im Tab-Wechsel-Effect ergaenzen.
- **Lazy-Load-Schutz:** Wenn `paneRef.current === null` → silent return + dev-mode `console.warn`

#### C.5 Test-Strategie (Repo hat KEIN jsdom)

**Empfehlung: Hook-isolierte Tests fuer E2.B2:**

Spawn-Handler aus App rausziehen in reine Funktion:
```ts
function createSpawnHandler({
  getPane,        // () => HTMLElement | null
  addNodeAt,      // (tool, pos) => void
}) { ... }
```

Test-Datei: `src/preview/hooks/usePaletteDrag.test.ts` (passt sofort
in den existierenden `**/*.test.ts`-Glob, kein Setup).

Vitest mit Spies, kein jsdom noetig:
- H2: Mock `getPane` mit unterschiedlichen `getBoundingClientRect`-Werten
- H1: Spy auf `addEventListener`/`removeEventListener` — pro Mount EIN add, pro Unmount EIN remove
- H3: separater Test fuer Tab-Wechsel-Effect

Volles jsdom-Setup (`@testing-library/react`) erst spaeter, wenn E2.B3+
mehr DOM-Tests braucht.

---

### Anhang D — Schutzgeruest-Paket (Lefthook + Sentinels)

#### D.1 Priorisierung

| # | Item | Aufwand | Impact | Wann |
|---|---|---|---|---|
| 1 | `assertNever` + 4 switches | XS (~30 min) | mid | E2.5.2 |
| 2 | `EditableReactFlow` + 3 App.tsx-Migrations | S (~2h) | high | E2.B4 |
| 3 | Lefthook + grep + freshness | S (~2h) | high | E2.0 |
| 4 | CI-Erweiterung | XS (~30 min) | high | E2.0 |
| 5 | TS-Flag `noUncheckedIndexedAccess` | M (~4h) | high | nach E2 |
| 6 | Minimal-ESLint | S (~2h) | mid | nach E2 |

#### D.2 Lefthook (statt Husky)

**Begruendung:** viso-mcp hat kein bestehendes Husky-Setup → freie Wahl.
Lefthook hat eingebautes Glob-Filtering, parallele Jobs, eine YAML.

**Datei:** `lefthook.yml` im Repo-Root

```yaml
pre-commit:
  parallel: true
  commands:
    grep-direct-reactflow:
      glob: "src/preview/**/*.{ts,tsx}"
      exclude: "src/preview/components/canvases/EditableReactFlow.tsx"
      run: |
        if grep -nE "from '@xyflow/react'" {staged_files} | grep -E "ReactFlow[^a-zA-Z]" ; then
          echo "Direkt-Import von <ReactFlow> verboten — nutze EditableReactFlow-Wrapper."
          exit 1
        fi
    typecheck:
      run: npm run typecheck
    test-affected:
      glob: "src/**/*.{ts,tsx}"
      run: npx vitest related --run {staged_files}

pre-push:
  commands:
    build-freshness:
      run: |
        if [ -d dist ] && [ "$(find src -newer dist -type f | head -1)" ]; then
          echo "Stale build: src ist neuer als dist. Bitte 'npm run build' ausfuehren."
          exit 1
        fi
    full-test:
      run: npm test
```

**Setup:** `npm i -D lefthook && npx lefthook install`.

#### D.3 CI-Pendant (`.github/workflows/ci.yml`-Erweiterung)

```yaml
- name: Build-Freshness Sentinel
  run: |
    npm run build
    if [ "$(find src -newer dist -type f | head -1)" ]; then
      echo "Build inkonsistent: src neuer als frisch gebauter dist."
      exit 1
    fi

- name: Grep-Guard ReactFlow direct imports
  run: |
    if grep -rnE "from '@xyflow/react'" src/preview --include="*.tsx" --include="*.ts" \
        | grep -E "ReactFlow[^a-zA-Z]" \
        | grep -v "EditableReactFlow.tsx" ; then
      echo "Direkt-Imports gefunden."
      exit 1
    fi
```

**Lokal vs CI:** Lokal = schnelles Feedback. CI = Safety Net (Hooks via `--no-verify` umgehbar).

#### D.4 `assertNever`-Helper

**Datei:** `src/preview/lib/exhaustive.ts`

```ts
export function assertNever(value: never, context?: string): never {
  throw new Error(
    `Unhandled discriminant${context ? ` in ${context}` : ''}: ${JSON.stringify(value)}`,
  );
}
```

**Wirksam durch:** TS-`strict: true` (bereits gesetzt). `never`-Parameter
zwingt nicht-erschoepfende Switches zum Compile-Fehler. Kein Test fuer
den Helper selbst — Korrektheit ist Typ-Eigenschaft.

**Migrations-Stellen:** `App.tsx:1252, 1265, 1278, 1292`.

#### D.5 `EditableReactFlow`-Wrapper

**Datei:** `src/preview/components/canvases/EditableReactFlow.tsx`

```tsx
import { ReactFlow, type ReactFlowProps, type Node, type Edge } from '@xyflow/react';

type RequiredEditable<N extends Node, E extends Edge> =
  ReactFlowProps<N, E> & Required<Pick<
    ReactFlowProps<N, E>,
    'onNodesChange' | 'onEdgesChange' | 'onConnect' | 'onEdgesDelete'
  >>;

export function EditableReactFlow<N extends Node = Node, E extends Edge = Edge>(
  props: RequiredEditable<N, E>
) {
  return <ReactFlow<N, E> {...props} />;
}
```

**Migrations-Stellen:** `App.tsx:194` (ERD), `:301` (BPMN), `:415` (Landscape).

#### D.6 TS-Strict-Audit

Aktuell gesetzt: `strict: true` (8 Flags). Empfohlene Ergaenzungen:

| Flag | Aufwand | Impact | Schutz |
|---|---|---|---|
| `noUncheckedIndexedAccess: true` | M | high | `array[i]` als `T \| undefined` |
| `exactOptionalPropertyTypes: true` | M | mid | `prop?: T` darf nicht explizit `undefined` sein |
| `noFallthroughCasesInSwitch: true` | XS | mid | Switch-Fallthrough = Compile-Error |
| `noImplicitOverride: true` | XS | low | OO-Sicherheit |

#### D.7 Minimal-ESLint (4 Rules)

`eslint.config.js` Flat-Config:
- `@typescript-eslint/switch-exhaustiveness-check: error` — ESLint-Pendant zu `assertNever`, Belt-and-Suspenders
- `react-hooks/exhaustive-deps: error` — direkt relevant fuer Sync-Hooks
- `react-hooks/rules-of-hooks: error`
- `@typescript-eslint/no-explicit-any: warn`

#### D.8 Mit-Reichweite

**Strukturell unmoeglich nach Schutzgeruest:**
- Stale-Build-Bugs (Pfad-D-Hauptthema)
- Direkt-Import-Cross-Pollination
- Nicht-erschoepfende Diagramm-Type-Switches
- Undefinierte Array-Zugriffe (mit `noUncheckedIndexedAccess`)
- Stale Hook-Closures (ESLint `exhaustive-deps`)

**Bleibt ungeschuetzt:**
- Race Conditions in async Sync-Hooks → braucht Tests/Locks
- Layout-Bugs (ELK, Positionierung) → braucht Visual-Regression
- MCP-Tool-Drift (Server vs UI Schema) → braucht Contract-Tests
- React-Re-Render-Performance → braucht React DevTools Profiler

---

## References & Research

### Internal References

- [docs/brainstorms/2026-05-01-viso-mcp-stabilisierung-pfad-d-brainstorm.md](../brainstorms/2026-05-01-viso-mcp-stabilisierung-pfad-d-brainstorm.md) — Hauptinput, alle 8 Decisions
- [docs/usertests/2026-04-25-viso-mcp-full-walkthrough/report.md](../usertests/2026-04-25-viso-mcp-full-walkthrough/report.md) — v1.1.0 Baseline (SUS 23)
- [docs/usertests/2026-04-26-viso-mcp-v1-1-2-re-test/report.md](../usertests/2026-04-26-viso-mcp-v1-1-2-re-test/report.md) — v1.1.2 Re-Test (SUS 70.5) + Top 3 remaining
- [docs/plans/2026-04-25-feat-stabilization-sprint-v1-1-1-plan.md](2026-04-25-feat-stabilization-sprint-v1-1-1-plan.md) — Vorgaenger-Stabilisierung (CR-1 bis CR-7)
- [docs/solutions/ui-bugs/react-flow-edges-readonly.md](../solutions/ui-bugs/react-flow-edges-readonly.md) — B3/B4 + Sentinel-Empfehlung
- [docs/solutions/ui-bugs/drag-drop-spawn-diagramm-typ-aware.md](../solutions/ui-bugs/drag-drop-spawn-diagramm-typ-aware.md) — B2 Pre-Merge-Checklist
- [docs/solutions/integration-issues/erd-add-column-silent-fail-legacy-relations.md](../solutions/integration-issues/erd-add-column-silent-fail-legacy-relations.md) — `normalizeRelations`
- [docs/solutions/integration-issues/notion-to-viso-pipeline-and-set-dbml-stale-build.md](../solutions/integration-issues/notion-to-viso-pipeline-and-set-dbml-stale-build.md) — Stale-Build-Pattern (E1.0 + E2.0)
- [CLAUDE.md](../../CLAUDE.md) — Projekt-Workflow-Regeln
- [CHANGELOG.md](../../CHANGELOG.md) — v1.1.0 / v1.1.1 / v1.1.2 + Unreleased

### Code Hotspots (verifiziert via Code-Audit)

- `src/preview/App.tsx:1098-1112` — `handleSpawnFromPointer` (B1)
- `src/preview/App.tsx:180-190` — `paneClick` (B1, identische Math)
- `src/preview/App.tsx:193, 300, 414` — `data-viso-canvas-pane`-Marker (B2)
- `src/preview/App.tsx:1252, 1265, 1278, 1292` — 4 nicht-erschoepfende Switches (E2.5.2)
- `src/preview/hooks/usePaletteDrag.ts:28, 36-42, 44-118, 134-145` — Drag/Spawn (B2)
- `src/preview/hooks/useDiagramSync.ts:194-280` — ERD `onConnect/onEdgesDelete` (B3/B4)
- `src/preview/hooks/useProcessSync.ts:211-247` — BPMN `onConnect/Delete` (B3/B4)
- `src/preview/hooks/useLandscapeSync.ts:214-251` — Landscape (B3/B4)
- `src/preview/components/{erd,bpmn,landscape}/*Edge.tsx` — Custom-Edges, kein `interactionWidth` aktuell (B4)
- `src/preview/state/useToolStore.tsx:28-43, 164-169` — Tool-Persistierung (B2)

### Test-Files (verifiziert)

- `src/preview/normalize-relations.test.ts` — Legacy-Format-Tests
- `src/preview/node-update.test.ts` — `applyErdTableUpdate` (E2.5.1 relevant), 13 Cases
- `src/preview/hooks/auto-layout.test.ts` — `isInitialAutoLayoutNeeded`, 5 Cases
- `src/preview/__tests__/spawn-listener.test.tsx` — **EXISTIERT NICHT** (in E2.B2 neu erstellen)

### External References

- [React Flow API: `screenToFlowPosition`](https://reactflow.dev/api-reference/types/react-flow-instance#screen-to-flow-position) — kanonische Coordinate-Transform (B1)
- [React Flow Examples: Drag and Drop](https://reactflow.dev/examples/interaction/drag-and-drop) — Referenz-Implementation
- [React Flow: useReactFlow Hook](https://reactflow.dev/api-reference/hooks/use-react-flow)
- [React Flow: Multiple Flows / Hooks & Providers](https://reactflow.dev/learn/advanced-use/hooks-providers) — 1 Provider pro Flow
- [xyflow Issue #5689](https://github.com/xyflow/xyflow/issues/5689) — Multi-Instance-Provider-Bug
- [xyflow Issue #4814](https://github.com/xyflow/xyflow/issues/4814) — `interactionWidth`-Quirk
- [DBML Spec](https://dbml.dbdiagram.io/docs/) — Source-of-truth fuer ERD-Format
- [Vitest Docs](https://vitest.dev/) — Test-Runner

### Related Work

- Commit `38ecee4` — Tool/Diagramm-Cross-Pollination Guard (B2-Aspekt)
- Commit `51ce91e` — Edge create/delete fuer BPMN + Landscape (B3/B4)
- Commit `05f953e` — ERD `normalizeRelations` (B3-Vorbereitung)
- Commit `d61345a` — ERD-Tabellen-Rename (E2.5.1-Vorbereitung)
- Commit `aaa9cd0` — v1.1.2 Release Open-Items-Sweep
- Commit `548b891` — Pfad-D-Brainstorm
