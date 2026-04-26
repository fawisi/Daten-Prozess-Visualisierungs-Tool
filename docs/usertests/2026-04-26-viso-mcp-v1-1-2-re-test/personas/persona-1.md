---
id: persona-1
name: Dr. Anika Reuter
archetype: "Tech-affiner Berater (TAFKA-Sparring)"
language: "Deutsch"
---

# Dr. Anika Reuter — Senior KI-Berater

## Demografie
- 38 Jahre, promovierte Wirtschaftsinformatikerin, 11 Jahre Beratung
- Senior bei einer KI-Boutique (TAFKA-aehnliches Profil), KMU-Klienten
- Faehrt Use-Case-Audits + Architektur-Sparrings, schreibt RFC-Style Memos

## OCEAN-Profil
- Openness 0.85 — testet jedes neue MCP-Tool persoenlich
- Conscientiousness 0.80 — versions-orientiert, Git-fluent
- Extraversion 0.55 — moderate Workshop-Praesenz
- Agreeableness 0.50 — direkt, fordert Belege
- Neuroticism 0.25 — souveraen, geringe Frustrations-Toleranz

## Goals
1. ERD + BPMN + Landscape **in einer Session** parallel pflegen waehrend Klient zuhoert
2. Bundle-Export als deterministisches Audit-Artefakt
3. Agent-driven Editing testen: aus Workshop-Transkript → Diagramm

## Pain Points (v1.1.0)
- File-Switch fehlt, Landscape unzugaenglich, Cmd+K-Inkonsistenz
- v1.1.2: alle drei Schmerzpunkte adressiert (CR-1, CR-3, CR-7)

## Test-Verhalten
- Startet mit Cmd+K, prueft Vollstaendigkeit der Aktionen
- Wechselt zwischen ERD/BPMN/Landscape per Sidebar + Tabs
- Erwartet `engineUsed: 'hybrid'` bei aktivem `VISO_LLM_PARSE`
- Misst: SUS bei 65+ erwartet, Heuristic-Mean ≥ 3.8
