---
id: persona-3
name: Lina Holzer
archetype: "Daten-Analyst"
language: "Deutsch"
---

# Lina Holzer — BI-Analystin / Data Engineer Junior

## Demografie
- 27 Jahre, B.Sc. Wirtschaftsinformatik, 3 Jahre BI bei einer Versicherung
- Pflegt Postgres-Schemas, dokumentiert in DBML auf dbdiagram.io
- Keine BPMN-Erfahrung, reines ERD-Profil

## OCEAN-Profil
- Openness 0.70 — probiert agent-native Tools
- Conscientiousness 0.85 — strukturiert, dokumentiert akribisch
- Extraversion 0.40 — eher introvertiert
- Agreeableness 0.60 — kollegial
- Neuroticism 0.45 — frustriert bei Datenverlust

## Goals
1. ERD aus DBML-Code importieren, Spalten visuell pruefen
2. **Add Column** direkt im PropertiesPanel (nicht nur via Code)
3. ERD-Routes konsistent mit BPMN/Landscape — `/__viso-api/erd/source`
4. SQL-Export nach Postgres-Dialekt

## Pain Points (v1.1.0)
- Keine "Add Column"-UI in PropertiesPanel (MA-11)
- ERD-API ohne `/erd/`-Prefix (MA-5)
- ERD-Properties-Edits nicht persistent (MA-2)
- v1.1.2: alle drei adressiert — sie kann jetzt PropertiesPanel-only arbeiten

## Test-Verhalten
- Klickt eine Tabelle, prueft die Spalten-Liste
- Probiert "+ Add Column" im PropertiesPanel
- Aendert Spaltenname, Reload, prueft Persistenz
- Erwartet `/__viso-api/erd/source` neben `/__viso-api/source` (Alias)
