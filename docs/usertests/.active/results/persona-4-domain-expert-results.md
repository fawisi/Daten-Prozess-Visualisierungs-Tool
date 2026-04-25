---
persona: persona-4 (Petra Lehmann, Domain-Expertin)
mode: hybrid
date: 2026-04-25
---

# Test-Ergebnisse — Petra Lehmann (Domain-Expertin)

## Think-Aloud Narrative

> "Mein Kollege hat gesagt 'starte mal viso'. Schwarzer Bildschirm.
> Ein paar Kaesten links oben in der Mitte... ist das fuer mich?
> 'TAFKA Wissensplattform' steht im Properties-Panel. Was ist das?
> Habe ich was Falsches geoeffnet?"

> "Knopf 'Auto-Layout' — Klick. Ah, jetzt sind die Kaesten ordentlicher.
> Was sind das? Ich klicke auf 'users' — Properties zeigt eine Liste
> von Eintraegen wie 'id', 'email', 'name', 'role'. Aber das soll
> doch ein Bestellabwicklungsprozess sein? Ich habe eine fremde
> Datei offen. Wie wechsle ich zu meiner Datei??"

> "Es gibt keinen 'Datei oeffnen'-Knopf. Kein 'File'-Menue.
> Im README steht `npx viso-mcp serve ./dein-file.bpmn.json`. Aber
> ich bin doch schon im Tool... Ich gebe auf, schliesse den Browser-Tab,
> lasse meinen Mann das machen."

> "Spaeter mit Mann: Er startet `serve` neu mit BPMN-File. Jetzt sehe
> ich Kaesten mit 'Start', 'Landing Page', 'CTA Klick?', 'Kontaktformular'.
> Das ist schon eher meins. Ich klicke 'Landing Page'. Properties:
> KNOTEN: landing, BEZEICHNUNG: Landing Page, BESCHREIBUNG: Hero, Value
> Proposition, CTA. Ich kann 'BEZEICHNUNG' aendern in 'Webseite'. Tippe...
> aber wie speichere ich? Drueck Enter — nichts. Klick wo anders —
> immer noch alt. Und reload — alt."

> "Mein Mann sagt: 'die UI updated nur, der Datei-Save geht woanders'.
> Ich verstehe gar nichts. Ich druecke ich Drucken auf den Browser
> (Strg+P) — bekomme die Editoroberflaeche, nicht das Diagramm.
> Drucken kann ich also auch nicht."

> "Mein Mann zeigt mir 'Export -> SVG'. SVG runtergeladen. Aber
> doppelklick — Browser. Schon. Wie mache ich daraus PDF? 'Mach ein
> Screenshot' sagt mein Mann. Wirklich, in 2026?"

## Heuristic Evaluation

| # | Heuristic | Score | Notes |
|---|---|---|---|
| H1 | Visibility | 2 | OPEN FILES: 3 ohne UI-Pfad zur Datei. Save-State im Code-Panel ist nicht im Properties-Panel sichtbar. |
| H2 | Real world | 1 | "viso-erd-v1", "attachmentSlot" — Fachbegriffe fuer Tech-User, nicht fuer Petra |
| H3 | User control | 1 | Properties-Panel-Edit: kein sichtbares Save, keine Persistenz-Anzeige |
| H4 | Consistency | 2 | Klick im Canvas waehlt aus, aber Tab-Switch existiert nicht |
| H5 | Error Prevention | 0 | "Wrong File" — keine Warnung, keine Hilfe |
| H6 | Recognition | 1 | Keine sichtbare File-Oeffnung. Kein Kontext-Menue. |
| H7 | Flexibility | 0 | Cmd+K vs Maus — Cmd+K kennt sie nicht. |
| H8 | Aesthetic | 3 | Dark-Mode ist hip, aber unangenehm fuer Aelteren |
| H9 | Recover | 0 | Keine Help-Texte, keine Tour, kein Onboarding |
| H10 | Help | 1 | EmptyState mit MCP-Tool-Namen — Petra versteht NULL |

**Heuristic-Average: 1.1 / 5**

## SUS

| # | Statement | Score |
|---|---|---|
| Q1 | Use frequently | 1 |
| Q2 | Unnecessarily complex | 5 |
| Q3 | Easy to use | 1 |
| Q4 | Need tech support | 5 |
| Q5 | Well integrated | 1 |
| Q6 | Inconsistency | 5 |
| Q7 | Quick to learn | 1 |
| Q8 | Cumbersome | 5 |
| Q9 | Confident | 1 |
| Q10 | Lot to learn | 5 |

**SUS:** Odd: (1-1)+(1-1)+(1-1)+(1-1)+(1-1) = 0; Even: (5-5)*5 = 0. Total: (0+0) × 2.5 = **0 / 100**

Adjective: **Worst Imaginable** — Petra koennte das Tool nicht alleine bedienen. Ohne IT-Support nicht moeglich.

## Task Completion

| Story | Outcome |
|---|---|
| US-04 ERD/BPMN/Landscape Switch | ❌ FAIL |
| US-11 Empty-State Hilfe | ❌ FAIL |
| US-12 Tooltips | ✅ pass (vorhanden, aber zu kurz) |
| US-29 File-Save | ❌ FAIL (Properties-Edit nicht persistent) |

## Top-3 Probleme aus Petra-Sicht
1. **Keine Datei-Oeffnen-UI** — komplette Blocker
2. **Properties-Edit nicht persistent** — Aenderungen "verschwinden"
3. **Tech-Begriffe ueberall** — keine Domain-Expertin-Sprache
