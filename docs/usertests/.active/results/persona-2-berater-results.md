---
persona: persona-2 (Sarah Kuehn, Senior Consultant)
mode: hybrid
date: 2026-04-25
---

# Test-Ergebnisse — Sarah Kuehn (Senior Consultant)

## Think-Aloud Narrative

> "Im Workshop mit Kunden-Vertretern. Beamer angeschlossen. `npx viso-mcp serve`
> — ich sehe einen schwarzen Editor mit ein paar Tabellen. Light-Mode-Toggle?
> Klick auf das Sonne-Icon — wechselt brav. Gut fuer Beamer."

> "Kunde sagt: 'Wir haben einen Prozess: Bestellung kommt rein, Lager pruefen,
> wenn da, Zahlung, sonst Storno...' Ich will das parallel als BPMN
> aufnehmen. Aber wie wechsle ich zu BPMN? Ich klicke auf 'Code' — das ist
> JSON-Code fuer das ERD. Nicht hilfreich. Ich klicke auf 'v'-Logo links
> oben — keine Reaktion. ESC — schliesst nichts."

> "Im README las ich von Narrative-zu-Diagramm. Versuche `process_parse_description`
> via Claude Code. Beschreibe den Prozess. Antwort: 'nodesAdded: 0, flowsAdded: 0,
> unparsedSpans: ALLES.' Engine = regex. Hmm. Und der Diagramm-State ist
> immer noch der Lead-Funnel-Demo. Ich verstehe nicht warum 'persisted: true'
> obwohl nichts erkannt wurde."

> "Plan B: Wenn ich schon die UI nicht zum Switchen kriege, mach' ich's
> manuell via Editor-Reload mit anderer File. Aber das geht nicht im
> Workshop ohne Restart. Ich gebe auf und mache den Prozess ad-hoc per
> Whiteboard..."

> "Bundle-Export probiere ich noch: Klick auf Export → bundle.zip — laedt
> runter. ZIP enthaelt die source.json + mermaid.md + positions.json.
> Das ist gut. Aber kein PNG/SVG! Manifest sagt PNG ist 'optional'.
> Bei Kunden-Handoff brauche ich ein Bild..."

> "Nach 30 Minuten: Ich kann mit dem Tool weder Live-Workshop machen
> noch zwischen ERD/BPMN/Landscape wechseln. Das ist im Workshop unbrauchbar."

## Heuristic Evaluation (Nielsen)

| # | Heuristic | Score | Notes |
|---|---|---|---|
| H1 | Visibility | 3 | Theme-Toggle visuell klar, aber File-Switch fehlt |
| H2 | Real world | 2 | Narrative-Engine versagt bei deutschen Saetzen |
| H3 | User control | 2 | Kein Save-Indicator-Notification |
| H4 | Consistency | 2 | ZIP-Bundle mal mit, mal ohne PNG; export_bundle ohne PNG default |
| H5 | Error Prevention | 2 | parse_description meldet "ok=true" obwohl nichts erkannt |
| H6 | Recognition | 4 | Theme-Toggle, Code-Button, Export gut sichtbar |
| H7 | Flexibility | 2 | Kein Workshop-tauglicher Multi-File-Modus |
| H8 | Aesthetic | 4 | Saubere Typografie |
| H9 | Recover | 2 | parse_description gibt unparsedSpans aber kein Fix-Hint |
| H10 | Help | 2 | Quickstart sagt "DBML", Vite-Mode laedt JSON |

**Heuristic-Average: 2.5 / 5**

## SUS

| # | Statement | Score |
|---|---|---|
| Q1 | Use frequently | 2 |
| Q2 | Unnecessarily complex | 4 |
| Q3 | Easy to use | 2 |
| Q4 | Need tech support | 4 |
| Q5 | Well integrated | 2 |
| Q6 | Inconsistency | 4 |
| Q7 | Quick to learn | 2 |
| Q8 | Cumbersome | 4 |
| Q9 | Confident | 1 |
| Q10 | Lot to learn | 4 |

**SUS:** Odd: (2-1)+(2-1)+(2-1)+(2-1)+(1-1) = 5; Even: (5-4)+(5-4)+(5-4)+(5-4)+(5-4) = 5. Total: (5+5) × 2.5 = **25 / 100**

Adjective: **Worst Imaginable** (unter 51 = F)

## Task Completion

| Story | Outcome | Notes |
|---|---|---|
| US-06 BPMN-Click-Spawn | ⏭️ blocked | Komme nicht zu BPMN |
| US-07 Drag&Drop | ⏭️ blocked | Ditto |
| US-09 Bundle-Export | ⚠️ partial | Funktioniert, aber kein PNG default |
| US-13 Landscape-UI | ❌ FAIL | Komplett fehlend |
| US-18 parse_description | ❌ FAIL | Regex-Engine versagt bei DE |
| US-21 Theme-Persistenz | ✅ pass | Wechsel funktioniert visuell |
| US-25 Mode-Toggle | ⏭️ blocked | Nur fuer BPMN, ich bin im ERD |

## Top-3 Probleme aus Sarah-Sicht
1. **parse_description erkennt nichts** — Hauptverkaufsargument funktional kaputt
2. **Kein File-Switch im UI** — Workshop unbrauchbar
3. **Bundle ohne PNG default** — Kunden-Handoff unvollstaendig
