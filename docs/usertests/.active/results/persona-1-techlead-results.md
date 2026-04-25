---
persona: persona-1 (Dr. Lukas Berger, Tech-Lead)
mode: hybrid (concept + live + mcp)
date: 2026-04-25
---

# Test-Ergebnisse — Dr. Lukas Berger (Tech-Lead / CTO)

## Think-Aloud Narrative

> "OK, `npx viso-mcp serve ./schema.dbml` — startet auf Port 5555. Ich sehe einen
> dunklen Editor, oben Auto-Layout / Code / Theme / Export. Links die Tool-
> Palette mit V und H. Mehr nicht? Ah, ein 'OPEN FILES: 3' im Properties-
> Panel. Gut, also gibt es 3 Files... aber wo sind die Tabs? Ich sehe keine."

> "Cmd+K — Command-Palette geht auf. View, Edit, Export, Navigation.
> 'Switch Diagram...' — ah, da ist es. Klick. ... Nichts passiert.
> Die Palette schliesst sich, aber die Datei wechselt nicht.
> Das ist... ein Bug?"

> "Cmd+/ — Code-Panel oeffnet sich. Hmm, das ist JSON, nicht DBML?
> Im README steht doch 'DBML for ERDs'. Hier steht aber `viso-erd-v1`-JSON.
> Inkonsistent, aber sei's drum. Die Syntax-Highlighting ist ok, Auto-Save
> debounced. Status zeigt IDLE... saving... saved. OK."

> "Aber wie wechsle ich zu BPMN? Schau ich in die HTTP-API:
> GET /__viso-api/files liefert alle 3. Aber im UI gibts kein Sidebar.
> Im Code (App.tsx Zeile 462) sehe ich `setOpenTabs((prev) => prev.length > 0
> ? prev : data.slice(0, 1))` — der oeffnet nur 1 Tab initial, und es
> gibt keinen UI-Pfad um die anderen 2 zu oeffnen. Das ist eine
> **architektonische Luecke**."

> "MCP-Tools im Claude Code Sidekick: `set_dbml` versuche ich mit DBML
> -Code... 'set_dbml requires a DBML-backed store'. Hmm? Ich muss erst
> migrieren via `npx viso-mcp migrate`? Das steht NICHT im Quickstart.
> README + Tool-Output kollidieren."

> "`process_get_schema` zeigt mir die `process.bpmn.json`. Vergleich Vite
> -Preview-Mode: BPMN-Tools haben Click-to-Place, ERD nicht. Auch im
> Code: `bpmnPaneClick` ist BPMN-only (App.tsx 887). ERD-Tabellen kann
> ich also gar nicht via UI hinzufuegen?? Das ist absurd fuer ein 'ERD-
> Editor'. Mein 47-Tabellen-Schema kann ich nur via Code-Panel bauen."

## Heuristic Evaluation (Nielsen)

| # | Heuristic | Score (0-5) | Notes |
|---|---|---|---|
| H1 | Visibility of System Status | 3 | Status-Dot im Code-Panel ok. Aber 'OPEN FILES: 3' ohne Switch-UI ist verwirrend |
| H2 | Match real world | 2 | "viso-erd-v1" vs "DBML" Inkonsistenz; Cardinality-Mapping (N:1 vs many-to-one) |
| H3 | User Control & Freedom | 2 | Undo/Redo nur fuer Positions, nicht Schema-Mutation. PUT broken JSON: kein Reject |
| H4 | Consistency & Standards | 1 | ERD ohne /erd/ Prefix vs BPMN/landscape mit Prefix; set_bpmn(json:) vs process_get_schema(process:) |
| H5 | Error Prevention | 1 | Validate-fn am Code-Panel parsed JSON, aber Server akzeptiert KAPUTTEN Input mit 200 OK |
| H6 | Recognition | 3 | Cmd+K-Palette gut entdeckbar via Footer-Hint. Sidebar fehlt. |
| H7 | Flexibility & Efficiency | 2 | Shortcuts fuer Tools (V/H/1-4). Aber 1-4 nur BPMN. Keine ERD-Shortcuts. |
| H8 | Aesthetic minimalism | 4 | Sauberer Dark-Mode, klare Typografie, monospace fuer Identifiers. |
| H9 | Recover from errors | 1 | "Schema is empty. Create tables first." — kein Hint wie. RFC-7807 nur teilweise. |
| H10 | Help & Documentation | 2 | EmptyState mit MCP-Tool-Namen ("Use process_add_node") fuer Power-User OK, aber unfreundlich |

**Heuristic-Average: 2.1 / 5**

## SUS (System Usability Scale)

| # | Statement | Score (1-5) |
|---|---|---|
| Q1 | Use frequently | 3 |
| Q2 | Unnecessarily complex | 4 (high = bad) |
| Q3 | Easy to use | 2 |
| Q4 | Need technical support | 3 (high = bad) |
| Q5 | Functions well integrated | 2 |
| Q6 | Too much inconsistency | 4 (high = bad) |
| Q7 | Most learn quickly | 2 |
| Q8 | Cumbersome | 3 (high = bad) |
| Q9 | Confident using | 2 |
| Q10 | Need to learn a lot | 4 (high = bad) |

**SUS Score:**
- Odd (Q1,3,5,7,9): (3-1) + (2-1) + (2-1) + (2-1) + (2-1) = 6
- Even (Q2,4,6,8,10): (5-4) + (5-3) + (5-4) + (5-3) + (5-4) = 6
- Total: (6 + 6) × 2.5 = **30 / 100**

Adjective: **Awful** (unter 51 = "F")

## Task Completion

| Story | Outcome | Notes |
|---|---|---|
| US-02 Cmd+K | ✅ pass | Aber Inhalt unvollstaendig (Bundle/SVG/PNG fehlen) |
| US-03 Cmd+/ | ⚠️ partial | Panel oeffnet, aber JSON statt DBML |
| US-04 ERD/BPMN/Landscape Switch | ❌ FAIL | Switch Diagram tut nichts |
| US-08 Auto-Layout | ✅ pass | Klick funktioniert nach Fit-View |
| US-09 Bundle-Export | ⚠️ partial | Im Header-Dropdown sichtbar, in Cmd+K fehlt |
| US-15 set_dbml | ❌ FAIL | 'requires DBML store' — Migration nicht discoverable |
| US-19 Bundle Roundtrip | ⚠️ partial | Funktioniert, aber outPath/inPath = Filesystem-only |
| US-20 RFC-7807 | ❌ FAIL | PUT broken JSON → 200 OK |
| US-22 Undo/Redo | ⚠️ partial | Nur fuer Positions, nicht Schema-Edits |
| US-24 Tool-Shortcuts | ⚠️ partial | V/H ok; 1-4 nur BPMN |
| US-29 File-Persistenz | ⚠️ partial | PUT akzeptiert kaputten Input |

## Top-3 Probleme aus Lukas-Sicht
1. **Kein Tab/Sidebar-UI** — kann nicht zwischen Files wechseln (US-04 Blocker)
2. **set_dbml-Workflow nicht discoverable** — Migration-Step versteckt
3. **PUT akzeptiert kaputten Input** — destruktiv, koennte Production-Schema zerstoeren
