---
date: 2026-04-21
topic: viso-mcp-agent-native-diagram-editor
status: Brainstorm abgeschlossen, bereit fuer /workflows:plan
autor: Fabian Willi Simon (+ Claude)
basiert_auf: bestehendes Tool daten-viz-mcp (v0.2.0), Konzept TAFKA KI-Hub v4
---

# viso-mcp - Agent-natives Diagramm-Studio

## TL;DR

Wir relaunchen das bestehende `daten-viz-mcp` als **`viso-mcp`**: ein agent-
agnostisches npm-Paket mit Browser-Editor fuer BPMN-Prozesse und ER-Datenmodelle,
das ueber MCP von **allen** Coding-Agents (Claude Code, Cursor, Cline, Windsurf,
Zed) genutzt werden kann. Der TAFKA KI-Hub bindet denselben Code als Next.js-
Komponente ein. Primaeres Austauschformat fuer LLMs: **Mermaid** (Kontext) +
**DBML** (ERD-Source-of-Truth) + **Custom JSON** (BPMN-Source-of-Truth).

---

## Was wir bauen

Ein **leichtgewichtiger Browser-Editor**, der

1. BPMN-Prozesse visuell editierbar macht (React Flow + ELK-Auto-Layout),
2. ER-Datenmodelle visuell editierbar macht,
3. alle Diagramme als **Mermaid-Code oder DBML-Code** exportiert, damit sie
   sich direkt als Kontext in jeden LLM-Prompt einfuegen lassen,
4. via **MCP-Server** von Coding-Agents gelesen UND editiert werden kann
   (atomare Tool-Calls, nicht Full-Document-Rewrites),
5. via **HTTP-API-Wrapper** in den TAFKA KI-Hub (Next.js) eingebunden wird,
6. per **`npx viso-mcp init`** in einem Befehl die MCP-Config fuer jeden
   unterstuetzten Agent schreibt.

Das Tool ersetzt nichts Bestehendes radikal - es ist der konsequente naechste
Schritt fuer `daten-viz-mcp` v0.2.0: **Rebrand + DBML-Migration + Auto-Setup-CLI
+ Hub-Ready Packaging**.

---

## Warum dieser Weg (nach Research)

Drei parallele Research-Agents (BPMN-Formate, ERD-Formate, LLM-Roundtrip-
Qualitaet) kamen zum gleichen Bild:

**BPMN 2.0 XML ist LLM-feindlich** (arXiv 2509.24592, BPMN Assistant 2025):
direkte XML-Generierung ist 4x teurer in Tokens und erreicht bei Open-Weights-
Modellen nur 8% Erfolgsrate (JSON: 50%). Sogar Claude 4.5 kommt bei XML nur auf
Gleichstand mit JSON-basiertem Editing. Konsequenz: Custom JSON als
BPMN-Source-of-Truth ist die richtige Entscheidung und bleibt.

**DBML ist der Sweet Spot fuer ER-Modelle**: deckt composite keys, indexes,
enums, TableGroups, Referential Actions, multi-schema ab. Hat mit `@dbml/core`
eine robuste npm-Parser-Library. ER Flow's MCP nutzt DBML bereits als Surface
(erflow.io/en/blog/claude-mcp-database-architect). Mermaid erDiagram ist nur
fuer Exports/Views geeignet, nicht als Source - fehlen composite-FKs, Indexes,
Enums; styling-API ist unzuverlaessig (GitHub Issue mermaid-js/mermaid#2673).

**Mermaid ist das LLM-Lingua-Franca fuer Exports**: token-aermstes Format
(~150 Tokens/10 Nodes), native GitHub/Notion/VS Code Render, groesster
LLM-Trainings-Fussabdruck. Die "Mermaid + externe CSS-Datei"-Idee ist **kein
echtes Pattern** (Shadow-DOM-Rendering blockiert CSS-Kaskade). Stattdessen:
ein geteiltes `theme.ts` Modul, das `themeVariables` + `classDef` pro Export
konsistent injiziert.

**D2 als "Pretty Export" vertagt**: hat besseres Styling (echte Klassen, Themes,
SVG-Icons) und stabileres Layout (ELK), aber kein GitHub-Render und kleinere
LLM-Community. Fuer Kunden-Pitch-Decks/Audit-PDFs eine spaetere Erweiterung
wert, aber nicht MVP.

---

## Architektur

```
┌─ BPMN ────────────────────────┐   ┌─ ERD ──────────────────────────┐
│ Source:   custom JSON         │   │ Source:   DBML (.dbml Text)    │
│ Layout:   .bpmn.pos.json      │   │ Layout:   .erd.pos.json        │
│                               │   │                                │
│ Exports:  Mermaid flowchart   │   │ Exports:  Mermaid erDiagram,   │
│           (+ optional D2)     │   │           SQL DDL (Postgres,   │
│                               │   │           MySQL, MSSQL, ...)   │
└───────────────────────────────┘   └────────────────────────────────┘
            ↓                                        ↓
┌───────────────────────────────────────────────────────────────────┐
│ MCP-Server (stdio)         HTTP-API-Wrapper (fuer TAFKA KI-Hub)   │
│ - process_add_node         - POST /api/workspace/:id/bpmn/node    │
│ - process_add_flow         - POST /api/workspace/:id/erd/table    │
│ - diagram_add_table        - GET  /api/workspace/:id/export/...   │
│ - diagram_add_column                                              │
│ - diagram_set_dbml         theme.ts (shared Mermaid styling)      │
│ - ... (atomare Mutations)                                         │
└───────────────────────────────────────────────────────────────────┘
            ↓
┌───────────────────────────────────────────────────────────────────┐
│ Browser-Editor (React 19 + @xyflow/react + ELK + shadcn/ui)       │
│ - Standalone:  `npx viso-mcp serve process.bpmn.json`             │
│ - Embedded:    Next.js Client Component im TAFKA KI-Hub           │
└───────────────────────────────────────────────────────────────────┘
```

---

## Key Decisions

- **Packaging:** Standalone npm-Paket `viso-mcp`, agent-agnostisch ueber MCP.
  Rationale: Fabians Prioritaet "Am liebsten etwas das mit jedem Coding Agent
  geht." MCP ist der einzige offene Standard, den Claude Code, Cursor, Cline,
  Windsurf, Zed alle sprechen.

- **Distribution:** npm-Paket + Auto-Setup-CLI (`npx viso-mcp init`).
  MVP-Coverage: **Claude Code (.mcp.json)**. Cursor/Cline/Windsurf folgen in
  spaeteren Releases. Rationale: Fabians Primaer-Agent, spaeter Community-Pull.

- **BPMN-Format:** Custom JSON bleibt (`viso-bpmn-v1`, Fortsetzung des
  bestehenden `daten-viz-bpmn-v1` Schemas). Rationale: Forschung zeigt
  eindeutig, dass BPMN 2.0 XML fuer LLM-Edits ungeeignet ist; Mermaid kann
  kein echtes BPMN (keine Gateway-Semantik, keine Pools/Lanes).

- **ERD-Format:** Wechsel von Custom JSON zu **DBML** als Source-of-Truth,
  Custom JSON wird zum `.erd.pos.json` Sidecar (nur Koordinaten + UI-State).
  Integration via `@dbml/core` npm package (Parse/Generate DBML <-> SQL DDL
  fuer Postgres/MySQL/MSSQL/Oracle/Snowflake). Rationale: DBML ist der
  community-standard mit stabilem Parser, expressiv genug fuer echte Schemas,
  LLMs erzeugen es zuverlaessig.

- **Export-Formate (MVP):** Mermaid (erDiagram + flowchart) und SQL DDL (via
  @dbml/core). D2 vertagt.

- **Styling:** Kein externes CSS. Stattdessen gemeinsames `theme.ts` Modul mit
  zentralen `themeVariables` + `classDef`-Fragmenten, die pro Render injiziert
  werden.

- **Editing-Mechanik:** **Atomare MCP-Tool-Calls** (add_node, add_flow,
  add_table, add_column, ...). Kein Full-Document-Rewrite via Prompt.
  Rationale: Forschung zeigt hoehere Erfolgsrate, kleinere Token-Kosten,
  bessere Diff-Freundlichkeit. Das existiert bereits; bleibt unveraendert.

- **Hub-Integration:** Tool bleibt eigenstaendiges npm-Paket. TAFKA KI-Hub
  (Next.js) bindet den Editor als React Components ein und wrappt die
  MCP-Tools in HTTP-API-Routes (`/api/workspace/:id/...`). Rationale:
  saubere Trennung, Wiederverwendbarkeit fuer andere Kontexte
  (Cursor/Claude Code), minimaler doppelter Aufwand.

- **Name:** `viso-mcp` (phonetisch nah an Visio, aber markenrechtlich sauber -
  keine Microsoft-Kollision). Auf npm verfuegbar gecheckt (21.04.2026).

- **Lizenz:** **MIT**. Rationale: maximal offen, Community-Adoption erleichtert,
  Standard fuer MCP-Tools. TAFKA behaelt Reputation + Brand-Bindung via README
  und Package-Name.

- **Repo:** `Daten_Prozess_Visualisierungs_Tool/` wird zu **`viso-mcp/`**
  umbenannt (Git-History bleibt via `git mv` erhalten). Paketname = Repo-Name.

- **Legacy-Support:** **Kein Legacy-Support.** v1.0 liest ausschliesslich DBML
  fuer ERDs. One-Time-Migrationsskript `viso-mcp migrate` wird mitgeliefert,
  aber kein Dual-Format-Read. Pragmatisch: das Tool ist bei v0.2.0, praktisch
  noch keine Install-Basis in der Wildnis.

- **Agent-Coverage ueber MVP hinaus:** Nach Claude-Code-Release **2-4 Wochen
  Community-Feedback sammeln** (GitHub Issues, Analytics, Developer-Gespraeche),
  dann Cursor/Cline/Windsurf/Zed nach Nachfrage priorisieren. Kein
  Vorab-Commitment auf Reihenfolge.

---

## MVP Scope

Vier Bausteine, die gemeinsam geliefert werden:

1. **ERD-Migration JSON -> DBML** (Kern-Umbau)
   - `@dbml/core` integrieren
   - `DiagramStore` liest/schreibt `.dbml` + `.erd.pos.json`
   - Bestehende MCP-Tools (add_table, add_relation, ...) unveraendert, intern
     auf DBML umgestellt
   - SQL DDL Export via `@dbml/core` (Postgres/MySQL/MSSQL/Oracle/Snowflake)
   - Migrationsskript: alte `.erd.json` -> `.dbml` + `.erd.pos.json`

2. **Auto-Setup-CLI `npx viso-mcp init`**
   - Erkennt Claude Code Workspace (sucht `.mcp.json` oder `.claude/`)
   - Schreibt/erweitert `.mcp.json` mit `viso-mcp` Eintrag
   - Interaktiver Fallback wenn Env nicht erkannt
   - Dry-run-Flag

3. **Theme-Modul + polished Editor-UI**
   - `src/theme.ts` mit `themeVariables` + `classDef`-Fragmenten
   - Mermaid-Exports nutzen konsistentes Theme
   - Editor-UI: Dark Mode, Tailwind-Clean, A11y-Grundlagen (Tab-Order,
     ARIA-Labels fuer Canvas-Nodes)

4. **Hub-ready: React Components + HTTP-API-Wrapper**
   - ESM-Export des Editor-Bundles (importierbar in Next.js)
   - Thin HTTP-Adapter: gleiche MCP-Tool-Surface als REST
   - Workspace-ID-Parameter durchgereicht, Auth delegiert an Hub

**Was nicht im MVP ist** (bewusst vertagt):

- D2-Export (spaeter als Flag `--export d2`, bei Bedarf)
- Cursor/Cline/Windsurf/Zed Setup-Zweige in init-CLI
- Multi-User / Live-Collaboration (Y.js o.ae.) - Workspace-Isolation via
  Hub reicht zunaechst
- Richtige BPMN 2.0 XML Import/Export
- Pool/Lane-Darstellung im BPMN-Editor
- Vollstaendige Prisma/Drizzle-Exports (moeglich via @dbml/core zu DBML,
  aber nicht first-class)
- Skill-Markdown fuer Community-Veroeffentlichung (kommt als eigener
  Release, wenn MVP stabil ist)

---

## Beziehung zum TAFKA KI-Hub

Der Hub ist **Stufe 2 (BPMN-Sprint)** und teilweise **Stufe 1 (Audit:
Prozess-Tabelle, IT-Roentgenbild)** auf dieses Tool angewiesen. Wichtige
Hub-Anforderungen, die Option A erfuellt:

| Anforderung | Erfuellt durch |
|---|---|
| Browser-Editor als Hub-Modul | React Components + ESM-Export, Next.js-Client-Component |
| Workspace-Isolation | Hub kontrolliert File-Pfade, Tool ist Workspace-agnostisch |
| Agent-Zugriff (Audit-Auto-Modeller) | MCP-Tools + HTTP-API-Wrapper |
| Audit-Report-PDF mit BPMN | Mermaid-Export rendert in Pandoc/Puppeteer-Pipeline |
| SQL-DDL fuer IT-Roentgenbild | @dbml/core liefert multi-dialect Export |
| DSGVO/BFSG/AI-Act | Stateless Tool, Isolation via Hub |

Der Hub bleibt dabei entkoppelt: wenn TAFKA das Tool ausbaut, profitieren
Cursor-/Claude-Code-User gleichzeitig. Wenn externe User das Tool nutzen,
entsteht Community-Pull fuer den Hub.

---

## Open Questions

Zwei Detail-Fragen bleiben bewusst offen fuer die Planning-Phase, abhaengig
von Prototyp-Erkenntnissen bzw. Community-Feedback:

1. **D2-Export in v1.x oder v2.0?** Abhaengig davon, ob Audit-PDFs oder
   Kunden-Pitches ein ernster Use-Case werden. Entscheidung: nach erstem
   Hub-Prototyp evaluieren.

2. **Skill-Markdown (SKILL.md) fuer Community-Veroeffentlichung:** eigener
   Release nach MVP-Stabilisierung. Nicht MVP.

---

## Next Steps

→ `/workflows:plan` fuer Implementierungs-Details

---

## Resolved Questions (Archiv)

**Q: Plugin vs. Skill vs. Web-App?**
A: Standalone npm-Paket mit MCP-Server + Browser-Editor + Auto-Setup-CLI.
Skill-Markdown faellt fuer MVP raus, kommt spaeter.

**Q: MCP vs. eigenes Protokoll?**
A: MCP. Ist der einzige offene Standard, den alle relevanten Coding-Agents
sprechen.

**Q: Mermaid mit externer Style-Datei?**
A: Existiert nicht (Shadow-DOM-Rendering). Loesung: geteiltes `theme.ts` Modul.

**Q: D2 ins MVP?**
A: Nein, vertagt. Mermaid reicht fuer MVP.

**Q: Hub-Integration: Monorepo oder standalone?**
A: Standalone. Hub bindet ein.

**Q: Naming?**
A: `viso-mcp` (phonetisch-nah an Visio, markenrechtlich sauber).

**Q: Lizenz?**
A: MIT. Offene Adoption ueber Wettbewerbsvorteil priorisiert.

**Q: Repo umbenennen?**
A: Ja - `viso-mcp/` statt `Daten_Prozess_Visualisierungs_Tool/`.

**Q: Legacy-Support fuer altes ERD-JSON-Format?**
A: Nein. Hartes Abschneiden, `viso-mcp migrate` als One-Time-Skript.

**Q: Agent-Coverage-Reihenfolge nach Claude Code?**
A: Erst 2-4 Wochen Community-Feedback, dann priorisieren - kein Vorab-Commit.
