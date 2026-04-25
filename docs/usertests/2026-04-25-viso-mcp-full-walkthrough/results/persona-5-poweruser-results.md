---
persona: persona-5 (Yannick Vogel, Power-User)
mode: hybrid + mcp-deep-dive
date: 2026-04-25
---

# Test-Ergebnisse — Yannick Vogel (Power-User)

## Think-Aloud Narrative

> "MCP-Server installiert via `npx viso-mcp init`. .mcp.json gepatcht.
> Tools-Liste: 30+. Sehr gut. Lass uns gleich Edge-Cases testen."

> "1. set_dbml mit valid DBML — 'set_dbml requires a DBML-backed store'.
>    OK fair, das ist eine Annahme: ERD-Source ist DBML. Im Vite-Mode
>    ist's aber JSON. Inkonsistenz, aber durch `npx viso-mcp migrate`
>    fixbar. README sagt das nicht klar genug — Power-User-tauglich,
>    Junior-killer."

> "2. parse_description mit DE-Text — engineUsed: 'regex', tablesAdded: 0.
>    Engine ist Regex-only. Power-User-Erwartung war LLM-Fallback.
>    'Lost in Translation' fuer DE-Texte. Persisted: true obwohl 0 added
>    — vermutlich Idempotency-Markierung, aber super-verwirrend."

> "3. set_bpmn(json: ...) — funktioniert. Returns nodeCount, flowCount,
>    prunedPositions. Sauber. Aber `process` waere als Param-Name
>    konsistent zum get_schema-Output. Hier `json` — meh."

> "4. import_bundle — braucht inPath als Filesystem-Pfad. Nicht agent-
>    native im Sinne von 'Agent kann Bytes uebergeben'. In Cloud-MCP
>    (Anthropic Hub o.ae.) wuerde das nicht funktionieren — kein
>    Filesystem. Bug oder Feature? Vermutlich frueh."

> "5. export_bundle — same outPath-Constraint. Manifest-JSON ist sauber.
>    Aber: `includePng:false` per default. Fuer ein 'Handoff'-Bundle
>    erwarte ich PNG. README spricht von 'consulting-ready'."

> "6. PUT /__viso-api/source mit kaputtem JSON — 200 OK. Server schreibt
>    invalid JSON in die Datei. Code-Panel-Validate ist Client-side,
>    der Server hat kein Validate. Das ist ein **echtes** Bug.
>    File-Korruption per HTTP-PUT."

> "7. Endpoint-Inkonsistenz: ERD ohne /erd/ prefix, BPMN/landscape mit.
>    Werd ich wieder vergessen, im Frontend nachschlagen. Anti-Convention."

> "8. Cardinality-Mapping: diagram_add_relation erwartet 'many-to-one',
>    aber Mermaid-Output zeigt 'N:1'. Welche ist die Wahrheit? Konsistenz
>    bitte."

> "9. Cmd+K im Browser-Editor: zeigt nur 3 von 6 Export-Optionen.
>    Bundle, SVG, PNG fehlen. Der Header-Dropdown hat alle 6.
>    Codeparity zwischen Header und Palette ist nicht da — klassischer
>    Fall von 'zwei Quellen der Wahrheit', irgendwann driftet es weg."

> "10. Landscape: Tool-Palette hat 0 Tools dafuer (TOOLS array hat keine
>     diagramType: 'landscape'-Eintraege). Cmd+K hat 0 Landscape-Aktionen
>     (when: 'bpmn' | 'erd' | 'any' — Type erlaubt 'landscape' gar nicht).
>     Heisst: Landscape ist UI-only via Code-Panel oder MCP. Drittklassig."

> "Insgesamt: Solide Architektur (zod, ELK, RFC-7807-Errors teilweise),
> aber zu viel halb-fertig. v1.1.0 ist eher v0.5.0."

## Heuristic Evaluation

| # | Heuristic | Score | Notes |
|---|---|---|---|
| H1 | Visibility | 2 | Status-Indicator im Code-Panel ok, aber MCP-Tools-Persistenz-Status unklar |
| H2 | Real world | 2 | Param-Naming-Inkonsistenzen (json vs process); Cardinality-Mapping |
| H3 | User control | 2 | PUT-Validation-Gap; Undo nur Positions |
| H4 | Consistency | 1 | ERD-Sonderfall im Routing; many-to-one vs N:1; CodePalette ≠ Header |
| H5 | Error Prevention | 2 | RFC-7807 nur partial; Code-Panel client-validate, server nicht |
| H6 | Recognition | 3 | Tools-Liste discoverable, MCP-Inspector ok |
| H7 | Flexibility | 3 | Bulk-Mutation (set_bpmn) gut; aber Cloud-Headless nicht moeglich (in/outPath) |
| H8 | Aesthetic | 4 | Code, JSON-Schemas sauber |
| H9 | Recover | 2 | Some RFC-7807 (set_dbml), aber nicht alle Tools haben strukturierte Errors |
| H10 | Help | 2 | README luecken, Migrationspfad nicht klar |

**Heuristic-Average: 2.3 / 5**

## SUS

| # | Statement | Score |
|---|---|---|
| Q1 | Use frequently | 4 |
| Q2 | Unnecessarily complex | 3 |
| Q3 | Easy to use | 3 |
| Q4 | Need tech support | 2 |
| Q5 | Well integrated | 2 |
| Q6 | Inconsistency | 4 |
| Q7 | Quick to learn | 3 |
| Q8 | Cumbersome | 3 |
| Q9 | Confident | 3 |
| Q10 | Lot to learn | 3 |

**SUS:** Odd: (4-1)+(3-1)+(2-1)+(3-1)+(3-1) = 11; Even: (5-3)+(5-2)+(5-4)+(5-3)+(5-3) = 10. Total: (11+10) × 2.5 = **52.5 / 100**

Adjective: **OK / Marginal-acceptable** (D-Grade)

## Task Completion

| Story | Outcome | Notes |
|---|---|---|
| US-15 set_dbml | ❌ FAIL | DBML-store-required, undocumented |
| US-16 set_bpmn | ✅ pass | Funktioniert nach Param-Korrektur (json: nicht process:) |
| US-17 set_landscape | ✅ pass | Funktioniert nach Param-Korrektur |
| US-18 parse_description | ❌ FAIL | Regex-only |
| US-19 Bundle Roundtrip | ⚠️ partial | outPath/inPath = FS-only |
| US-20 RFC-7807 | ⚠️ partial | Nicht alle Tools |

## Top-3 Probleme aus Yannick-Sicht
1. **Server akzeptiert kaputten Input** (PUT 200 OK) — Datei-Korruption
2. **parse_description regex-only** — Hauptverkauf nicht haltbar
3. **Inkonsistenzen ueberall** — Routes, Param-Names, Cardinality, Cmd+K vs Header
