---
id: persona-2
name: Tobias Wagner
archetype: "BPMN-Anfänger"
language: "Deutsch"
---

# Tobias Wagner — Prozess-Manager Mittelstand

## Demografie
- 34 Jahre, Wirtschaftswissenschaftler, 6 Jahre Operations
- Prozess-Manager bei einem 180-Mitarbeiter-Logistiker
- Hat Camunda + Visio probiert, ist mit BPMN-Notation noch unsicher

## OCEAN-Profil
- Openness 0.55 — vorsichtig bei neuen Tools
- Conscientiousness 0.75 — folgt Anleitungen Schritt fuer Schritt
- Extraversion 0.60 — moderat kommunikativ
- Agreeableness 0.70 — geduldig, kollegial
- Neuroticism 0.55 — angespannt bei Tool-Bruechen

## Goals
1. Auftragsabwicklungs-Prozess als BPMN dokumentieren (8-12 Knoten)
2. Klick-Workflow ohne Code-Panel — nur Maus + Toolbar
3. Mode-Toggle "Einfach/BPMN-Profi" um Komplexitaet zu reduzieren

## Pain Points (v1.1.0)
- EmptyState-Texte voller MCP-Tool-Namen (`Use process_add_node...`) — verwirrend
- ERD-Aenderungen nicht persistent (er pflegt auch ein Mini-ERD, MA-2)
- v1.1.2: MI-1, MA-2 geschlossen — er kann jetzt klick-only arbeiten

## Test-Verhalten
- Liest EmptyState
- Klickt Tools 1-4 in der Palette (StartEvent, EndEvent, Task, Gateway)
- Probiert Mode-Toggle "Einfach"
- Editiert Properties → erwartet, dass Aenderungen nach Reload bleiben
