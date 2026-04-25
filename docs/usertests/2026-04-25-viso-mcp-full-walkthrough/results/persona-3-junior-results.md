---
persona: persona-3 (Maximilian Schroeder, Junior-Dev)
mode: hybrid
date: 2026-04-25
---

# Test-Ergebnisse — Maximilian Schroeder (Junior-Dev, Visual Learner)

## Think-Aloud Narrative

> "Ich starte das Tool. Sehe... Tabellen? Sind das Beispiel-Tabellen?
> users, courses, certificates... ja. Cool. Ich klicke auf 'users' —
> rechts erscheint ein Panel: KNOTEN: users, BEZEICHNUNG: users,
> KOMMENTAR: Plattform-Nutzer (Admins, Dozenten, Teilnehmer).
> Was ist 'KNOTEN' vs 'BEZEICHNUNG'? Beide sind 'users'?
> Verwirrend. Ich aendere BEZEICHNUNG in 'users_table' und drueck Enter
> — nichts passiert. Hmm, vielleicht muss ich klicken? Es bleibt 'users'."

> "ANHAENGE: 'Screen-Recording starten' (blauer Button). Was ist das?
> Eine Tabelle hat Anhaenge? Komisch. Klick — passiert nichts.
> Sub-Text sagt 'Hub-Integration injiziert eigene Komponente via
> attachmentSlot.' — ich verstehe das nicht. Ich nutze ja `npx viso-mcp serve`,
> nicht 'Hub-Integration'."

> "Ich will eine eigene Tabelle anlegen. Toolbar links: V, H. Mehr nicht?
> Auf BPMN-Sites haben Editoren immer Tools fuer Shapes... hier nicht.
> Ich druecke '3' (Task-Shortcut den ich vom BPMN-Quickstart geraten habe)
> — aktiviert sich nichts. Hmm."

> "Cmd+K — Command-Palette. View, Edit, Export, Navigation. Wo ist
> 'Add Table'? Es gibt keins! Wie soll ich eine Tabelle anlegen??"

> "Ich klicke 'Code' — JSON-Code rechts unten. Editiere... ok, ich 
> kopiere `users` und mache eine eigene `posts`-Tabelle. Save... 
> Status zeigt 'saving'. Dann 'saved'. Aber im Canvas erscheint 
> nichts Neues. Ich reload — Aha! Da ist es. Aber das Layout ist 
> scheisse, alle Tabellen wieder geclustert in der Mitte."

> "Auto-Layout-Klick — ja, jetzt sind sie auseinander. Aber wenn ich
> jetzt eine Spalte hinzufuegen will... rechts in der Properties-Panel
> sind keine 'Add Column'-Buttons! Ich muss zurueck in den Code.
> Code-zu-Click-zu-Code-zu-Reload — das ist ein Workflow von 1995."

## Heuristic Evaluation

| # | Heuristic | Score | Notes |
|---|---|---|---|
| H1 | Visibility | 2 | KNOTEN/BEZEICHNUNG Doppelung verwirrt; Screen-Recording-Stub aktiv im Vite-Mode |
| H2 | Real world | 1 | Begriffe wie viso-erd-v1, attachmentSlot fuer Anfaenger schwer |
| H3 | User control | 2 | BEZEICHNUNG-Edit ohne sichtbares Save |
| H4 | Consistency | 2 | Tool-Palette: BPMN-Tools sichtbar, ERD nicht |
| H5 | Error Prevention | 1 | Code-Editor laesst kaputten Input zu, aber Mehr-Werte stillschweigend ignoriert |
| H6 | Recognition | 3 | Cmd+K-Discovery via Footer-Hint OK |
| H7 | Flexibility | 1 | Komplette ERD-Erstellung ueber Code, kein Klick-Pfad |
| H8 | Aesthetic | 3 | OK-Design, aber Empty-Slots ablenkend |
| H9 | Recover | 1 | "Schema is empty" gibt keinen Quick-Action-Link |
| H10 | Help | 1 | EmptyState ueberall mit "Use process_add_node MCP-Tool" — Junior versteht das nicht |

**Heuristic-Average: 1.7 / 5**

## SUS

| # | Statement | Score |
|---|---|---|
| Q1 | Use frequently | 2 |
| Q2 | Unnecessarily complex | 5 |
| Q3 | Easy to use | 1 |
| Q4 | Need tech support | 5 |
| Q5 | Well integrated | 2 |
| Q6 | Inconsistency | 4 |
| Q7 | Quick to learn | 1 |
| Q8 | Cumbersome | 5 |
| Q9 | Confident | 1 |
| Q10 | Lot to learn | 5 |

**SUS:** Odd: (2-1)+(1-1)+(2-1)+(1-1)+(1-1) = 2; Even: (5-5)+(5-5)+(5-4)+(5-5)+(5-5) = 1. Total: (2+1) × 2.5 = **7.5 / 100**

Adjective: **Worst Imaginable**

## Task Completion

| Story | Outcome | Notes |
|---|---|---|
| US-01 Tabelle per Klick | ❌ FAIL | Keine ERD-Shape-Tools |
| US-05 Properties-Edit | ⚠️ partial | KNOTEN/BEZEICHNUNG-Doppel; kein Add-Column |
| US-11 Empty-State Hilfe | ❌ FAIL | "Use process_add_node" — Junior versteht nicht |
| US-12 Tooltips | ✅ pass | Tool-Buttons haben title-Tooltips |

## Top-3 Probleme aus Maximilian-Sicht
1. **Keine ERD-Add-Tools** — kann nicht starten
2. **Empty-State-Texte zu technisch** — MCP-Tool-Namen fuer Endbenutzer
3. **Properties-Panel: KNOTEN/BEZEICHNUNG/ANHAENGE-Stub** — verwirrt
