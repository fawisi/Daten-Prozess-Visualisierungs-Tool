# Brainstorm: viso-mcp Stabilisierung — Pfad D (Editor-First)

**Datum:** 2026-05-01
**Branch-Vorschlag:** `feat/v1.2-stabilization-d` (nach Brainstorm-Approval)
**Folgt auf:** v1.1.2 (Open-Items-Sweep) + Post-1.1.2 Bugfixes (Drag-Drop, Edges, Tab-Wechsel)
**Vorgaenger-Tests:** Synthetic v1.1.0 (SUS 23), Synthetic v1.1.2 Re-Test (SUS 70.5)
**Real-User-Test:** Keine bisher. Fabian-Eindruck: Editor noch nicht zuverlaessig nutzbar.

---

## What We're Building

`viso-mcp` solid kriegen, sodass Fabian es taeglich fuer Kundenarbeit nutzen kann
— in allen 3 Use Cases (ERD, BPMN, Landscape). Hub-Integration komplett vertagt
bis Editor traegt.

**Drin:**
- UX-Bugs reproduzieren und fixen (Drag-Drop-Position, Drag-Drop-Greifen, Edges-ziehen, Edges-loeschen) — bug-driven, alle 3 Diagrammtypen parallel
- v1.1.3 Open-Backlog (E3): ERD-Tabellen-Rename, Auto-Layout-Performance, Sample-Files-Distribution
- Vereinfachter Bug-Capture: Fabian meldet im Chat, Claude dokumentiert in `docs/usage-log/`

**Raus:**
- Hub-Integration / Module-Build / iframe-Embedding
- Neue Features ueber die 3 Use Cases hinaus
- Open-Source-Marketing / npm-Promotion
- Refactor in shared package (`@tafka/viso-editor`) — kommt in Folgephase

---

## Why This Approach (Pfad D)

1. **Synthetic ≠ Real.** Re-Test sagt SUS 70.5 — Fabians Real-Eindruck ist
   anders. Die einzige Truth-Source ist Real-Nutzung. Pfad D macht das zur
   primaeren Validierungsmethode.

2. **Editor-Basis vor Hub-Integration.** Wenn der Editor in Phase D nicht
   traegt, ist jede Hub-Strategie (A/B/C aus dem Vergleich) eine schiefe Basis.
   Hub-Frage wird nach D mit Daten entschieden, nicht im Voraus.

3. **Du-zentriert messbar.** "Taeglich nutzbar ohne Frust" ist subjektiv,
   aber Fabian ist die Validierungsinstanz. Schnelle Feedback-Schleife (Bug
   gemeldet → reproduziert → gefixt → re-getestet) statt aufwaendiger
   Real-User-Studie. Externer Test kann spaeter.

4. **Keine Deadline = Iteration moeglich.** Quality-First-Prinzip. Wir
   priorisieren nach Frust-Niveau, nicht nach Plan-Reihenfolge.

---

## Key Decisions

### D1 — Erfolgskriterium: Subjektive Daily-Use-Validierung
Validierungs-Instanz ist Fabian selbst. "Solid" heisst:
- Drag-Drop legt Knoten am Mauszeiger ab (nicht irgendwo)
- Linien lassen sich zwischen 2 Knoten ziehen (alle 3 Diagrammtypen)
- Linien lassen sich loeschen (Klick + Delete oder Kontextmenue)
- Fabian kann ein Kundengespraech komplett mit dem Editor begleiten,
  ohne ins Code-Panel oder ins Terminal fluechten zu muessen.

### D2 — Bug-driven, nicht use-case-driven
ERD, BPMN, Landscape sind gleich wichtig — die Reihenfolge folgt aber nicht
dem Use-Case, sondern dem Bug. Konkret: Drag-Drop-Position-Bug (B1) wird
in allen 3 Diagrammtypen gemeinsam reproduziert und gefixt, dann B2, dann
B3/B4. Vorteil: Root-Cause oft im selben Modul (z.B. React-Flow-Coordinate-
Transform), 1 Fix loest 3 Stellen. Nachteil: kein "ein Use-Case komplett
fertig"-Gefuehl bis ganz zum Schluss.

### D3 — Hub-Frage komplett vertagt
A/B/C aus der Strategie-Tabelle bleiben offen. Nach Phase D wird mit
echten Daten (Reproduktions-Logs, Frust-Tagebuch) entschieden. Kein
Hub-Code in dieser Phase, kein iframe, kein npm-Package-Refactor.

### D4 — Zeitrahmen offen, Etappen-getaktet
Keine Deadline. Stattdessen Etappen mit klarem Abschluss-Kriterium:
- **E1 — Reproduktion:** Bugs live nachstellen, Repro-Steps dokumentieren.
- **E2 — Critical Fixes:** Drag-Drop-Position, Drag-Drop-Greifen, Edges create/delete.
- **E3 — Backlog-Sweep:** ERD-Tabellen-Rename, Auto-Layout-Performance.
- **E4 — Daily-Use-Run:** Fabian nutzt fuer ein echtes Kundenprojekt.
- **E5 — Iteration:** Bug-Findings aus E4 fixen.
- **E6 — Hub-Frage:** bei "kein Frust mehr" → Hub-Frage neu aufrollen.

### D5 — Vereinfachter Bug-Capture (statt formales Tagebuch)
Kein eigenes Tagebuch-File. Stattdessen: wenn Fabian beim Real-Nutzen
einen Bug oder Friction-Punkt erlebt, meldet er ihn direkt im Chat
("das geht nicht / das fuehlt sich falsch an"). Claude legt dann in
`docs/usage-log/YYYY-MM-DD-<slug>.md` einen Repro-Eintrag an mit:
Datum, Diagramm-Typ, Repro-Steps, erwartetes vs. tatsaechliches
Verhalten. Vorteil: kein Disziplin-Overhead fuer Fabian, trotzdem
systematische Aufzeichnung.

### D6 — Pass-Kriterium: Bauchgefuehl
"Phase D abgeschlossen" wenn Fabian sagt: _"ich nutze es jetzt
taeglich, ohne Frust"_. Bewusste Entscheidung gegen formale Tests
(SUS-Score, Kundengespraech-Test) — die kommen erst, wenn die
Hub-Frage neu aufgerollt wird. Risiko: subjektiv, kann sich verschieben.
Mitigation: Bug-Capture-Eintraege (D5) als externes Korrektiv —
wenn die Frequenz neuer Eintraege stark sinkt, ist das ein Indikator.

---

## Bug-Liste (Stand 2026-05-01, von Fabian gemeldet)

| # | Beschreibung | Use Case | Erste Hypothese |
|---|---|---|---|
| **B1** | Drag-Drop legt Knoten an falscher Stelle ab (nicht beim Mauszeiger) | alle 3? | Drop-Coordinate-Calc verwendet vermutlich Canvas-Origin statt React-Flow-Coordinate-Transform |
| **B2** | Drag-Drop greift manchmal gar nicht | unklar | Eventuell Tool-Selection nicht persistiert nach Tab-Wechsel (commit `38ecee4` hat das fuer Cross-Pollution gefixt — Edge-Cases pruefen) |
| **B3** | Linien (Edges) lassen sich nicht ziehen | unklar | Commit `51ce91e` hat BPMN+Landscape Edge-Create gefixt; ERD nutzt anderes Pattern (DBML-Relations) — evtl. ERD-only Bug |
| **B4** | Linien lassen sich nicht loeschen | unklar | `react-flow-edges-readonly.md` Solution-Doc existiert; pruefen ob auch ERD-Relations betroffen |

Alle 4 Bugs werden in E1 live im Browser nachgestellt, bevor Fix-Plan
geschrieben wird.

---

## Resolved Questions

- ✅ **MCP vs. Hub-Modul gleichzeitig?** → Nein, Hub vertagt (D3).
- ✅ **Real-User-Test pflicht?** → Nein, Fabian-zentriert reicht fuer Phase D (D1).
- ✅ **Welche Use Cases?** → Alle 3 (ERD, BPMN, Landscape) gleich wichtig.
- ✅ **Zeitrahmen?** → Keine Deadline, Etappen-getaktet (D4).
- ✅ **Reihenfolge?** → Bug-driven, nicht use-case-driven (D2).
- ✅ **Tagebuch-Mode?** → Vereinfacht: Bug im Chat, Claude dokumentiert (D5).
- ✅ **v1.1.3 Backlog?** → Rein, als E3 (ERD-Rename, Auto-Layout, Sample-Files).
- ✅ **Pass-Kriterium?** → Bauchgefuehl + Bug-Capture-Frequenz als Korrektiv (D6).

## Open Questions

Keine offen. Alle Brainstorm-Entscheidungen getroffen, bereit fuer
`/workflows:plan`.

---

## Next Step

`/workflows:plan` mit diesem Brainstorm. Erste Plan-Aktion in E1:
Live-Reproduktion. Dev-Server starten, alle 4 Bugs in BPMN + ERD +
Landscape durchklicken, Verhalten dokumentieren. Daraus priorisierter
Fix-Plan.
