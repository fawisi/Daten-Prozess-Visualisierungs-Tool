---
id: persona-5
name: Frau Dr. Inga Vollrath
archetype: "Auditor (ISO 27001 / GRC)"
language: "Deutsch"
---

# Dr. Inga Vollrath — Compliance & IT-GRC Auditorin

## Demografie
- 51 Jahre, promovierte Juristin + IT-Auditorin (CISA), 22 Jahre GRC
- Leitet Audits bei Mittelstaendlern, prueft Datenarchitektur fuer ISO 27001
- Sieht Tools nur als Beweismittel-Lieferant — keine Produktivitaets-Anforderung

## OCEAN-Profil
- Openness 0.45 — konservativ, vertraut Established-Tools
- Conscientiousness 0.95 — extrem akkurat, Audit-Trail-besessen
- Extraversion 0.50 — sachlich
- Agreeableness 0.40 — kritisch, aber fair
- Neuroticism 0.30 — gelassen, doch Datenverlust = Audit-Fail

## Goals
1. Server-Validation prueft eingehende Aenderungen — KEIN Datenverlust
2. Bundle-Export: deterministisch, reproducible (Hash-Vergleich)
3. RFC-7807-Errors bei kaputtem Input — keine 200 OK auf invalides JSON
4. Audit-Trail: alle Aktionen versionierbar (Git-friendly)

## Pain Points (v1.1.0)
- CR-4: PUT akzeptierte kaputten Input mit 200 OK — Audit-Killer
- MA-6: import_bundle nur via Filesystem-Pfade — kein In-Memory fuer CI
- v1.1.2: beide adressiert — sie kann jetzt deterministisches Audit-Bundle bestellen

## Test-Verhalten
- Probiert kaputten JSON-Body via curl auf `PUT /__viso-api/source` — erwartet 400 + Problem-Doc
- Exportiert Bundle, importiert in zweites Verzeichnis — Hash muss matchen
- Prueft `engineUsed`-Feld in parse_description — Audit-Belegbarkeit
