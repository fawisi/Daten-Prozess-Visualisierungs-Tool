---
id: persona-5
name: Yannick Vogel
archetype: "Power-User / Agent-First Developer"
language: "Deutsch/Englisch gemischt"
---

# Yannick Vogel — Independent Software Engineer & MCP-Power-User

## Demografie
- 29 Jahre, Self-Taught, ehemals FullStack-Dev bei Zalando
- Solo-Engineer, baut Agent-Pipelines fuer Kunden
- Ist seit 6 Monaten "all-in MCP" — alle Tools muessen MCP-kompatibel sein

## OCEAN-Profil
- **Openness:** 0.95 — Early Adopter, probiert sofort neue MCP-Server
- **Conscientiousness:** 0.60 — eher Zeitknapp als Akkurat
- **Extraversion:** 0.50 — twittert viel, asynchron
- **Agreeableness:** 0.40 — sehr kritisch, "wenn schon, denn schon"
- **Neuroticism:** 0.30 — gelassen, aber zynisch bei UI-Bugs

## Goals
1. Komplettes Workflow-Bundle in <5 Minuten generieren — von Description zu Diagramm zu Export
2. ERD + BPMN + Landscape parallel laufen lassen waehrend Claude generiert
3. **set_dbml** / **set_bpmn** / **set_landscape** — Bulk-Generation testen
4. **import_bundle** / **export_bundle** — Roundtrip pruefen
5. **parse_description** — Narrative-zu-Diagramm fuer alle 3 Typen testen
6. Edge-Cases: Was passiert wenn JSON kaputt ist? Was bei zirkulaeren Refs?

## Pain Points
- Hat keine Geduld fuer Klick-Workflows
- Erwartet alle Tools deterministisch und idempotent
- Will JSON-RFC-7807-Errors bei kaputtem Input
- Verachtet Toaster-Notifications statt strukturierter Errors
- Erwartet DARK-MODE als Default
- Erwartet Hot-Reload bei Code-Aenderungen

## Knowledge Level
- **Sehr hoch** bei: ALLES (TypeScript, MCP, BPMN, DBML, JSON-Schema, React, Vite)
- Will Edge-Cases finden

## Test-Verhalten
- Liest erstmal die Tool-Liste
- Probiert **set_dbml** mit kaputtem Input
- Probiert **import_bundle** mit minimalem ZIP
- Wechselt zwischen Editor und CLI
- Macht 5 Cmd+K-Aufrufe pro Minute
- Sucht nach versteckten Shortcuts
- Will Headless-Modus (in CI nutzen)

## Erwartete Tasks
- Als Power-User **moechte ich** mit `set_dbml` ein 50-Tabellen-Schema in <2s laden, **damit** ich Bulk-Operationen agentenseitig testen kann.
- Als Power-User **moechte ich** `parse_description` fuer alle 3 Diagrammtypen testen, **damit** ich weiss welche Narrative-Patterns funktionieren.
- Als Power-User **moechte ich** den Code-Panel mit Auto-Format und Linting, **damit** ich nicht auf der Console schauen muss.
- Als Power-User **moechte ich** kaputten Input absichtlich provozieren, **damit** ich strukturierte Error-Responses sehe.
- Als Power-User **moechte ich** ein Bundle exportieren und sofort wieder importieren (Roundtrip), **damit** ich Idempotenz pruefe.
- Als Power-User **moechte ich** alle 3 Sample-Files parallel offen, **damit** ich Tab-Switching pruefe.
