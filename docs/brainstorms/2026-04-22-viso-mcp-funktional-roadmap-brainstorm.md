---
date: 2026-04-22
topic: viso-mcp-funktional-roadmap
status: ready-for-plan
predecessor: 2026-04-21-viso-mcp-agent-native-diagram-editor-brainstorm.md
---

# viso-mcp — Funktionale Roadmap nach v1.0

## What We're Building

Nach dem Relaunch-Abschluss (v1.0) ist das Tool visuell fertig, **funktional aber noch nicht rund**. Dieses Brainstorm legt fest, was als Nächstes gebaut wird — **Solo-First**, Hub-Integration folgt unverändert auf der bereits vorbereiteten API (`VisoEditor` + `attachmentSlot` + HTTP-Adapter, Phase 5 abgeschlossen).

Kernrichtung: **viso-mcp wird zum Consulting-Werkzeug für TAFKA**. Kunden skizzieren einfach und async, Consultants verfeinern live im Audit-Termin, ein Handoff-Bundle läuft direkt in Coding-Agents weiter. Agents bedienen das Tool bis zu „Diktat → Diagramm".

Drei Visualisierungs-Dimensionen in einer konsistenten Philosophie (Einsteiger-Default + Profi-Toggle):

| Dimension | Default (Simpel) | Toggle (Profi) |
|---|---|---|
| **Datenschema** | ERD mit Basis-Typen | Vollständiges DBML mit Constraints/Indizes |
| **Prozess** | Flowchart Simple (Schritt/Entscheidung/Ergebnis) | BPMN-Voll (Events, Lanes, Subprocess, Messages) |
| **System-Landschaft** | C4 Level 1 (Person/System/External) | C4 Level 2 (Container, Database, Boundary) |

Alles bewusst eng gehalten. Keine Figma-Konkurrenz, kein Multiplayer/Echtzeit-Kollab im Core — das lebt auf Hub-Ebene.

## Why This Approach

Alternative „Hub-First" verworfen: Hub-Integration-API steht bereits, Solo-Bugs drücken Value für MCP-User direkt. Alternative „Solo einfrieren" wäre feindlich gegenüber bestehenden Usern.

Die „Default+Toggle"-Philosophie zieht sich durch alle drei Diagramm-Typen — Kunden starten einfach, Consultants schalten hoch. Technisch trivial, da jede Diagramm-Art nur eine Engine hat mit gefilterter ToolPalette im Default-Mode.

„Handoff-Bundle als Default" spiegelt Claude Design (Anthropic): Export als Ordner mit README + Sources + Rendered-Outputs ist das Pattern, mit dem Coding-Agents am besten arbeiten. Einzel-Exports werden sekundär.

System-Landscape mit Custom React-Flow-Renderer (statt Mermaid C4Context) wurde gewählt, weil die Research zeigt: Mermaid C4Context ist seit 6 Jahren experimental, Layout bricht. Der bestehende BPMN-Renderer ist das bewährte Blueprint.

## Key Decisions

### Strategie

**D1 — Solo-First.** Solo-v1.x stabilisieren & npm-publizieren, Hub-Integration folgt unverändert (Core-API ist ready).

**D2 — Ein großes v1.1 mit allem.** Keine Staffelung. Alle Features zusammen in einem Release. npm-Publish erst nach v1.1, damit 1.1 der erste öffentliche Release ist.

### Visualisierung

**D3 — Prozess-UI: Zwei Modi mit Live-Toggle.**
Default = „Flowchart Simple" (Schritt/Entscheidung/Ergebnis, keine BPMN-Terminologie). Toggle entsperrt vollen BPMN-Modus. Elemente bleiben beim Umschalten erhalten und bekommen BPMN-Attribute. Mode wird pro Diagramm gespeichert.

**D4 — System-Landscape: C4-Modell mit L1/L2-Toggle, Custom Renderer.**
- **Notation**: C4-Model (nicht ArchiMate, nicht UML). Research bestätigt: einfachste Notation, Branchenstandard, 3–5 Symbole in L1.
- **L1 Default** (KMU-Workshop): Person / System / External System / Relation.
- **L2 Toggle** (Consultant-Deep-Dive): + Container / Database / Cloud / Integration / Boundary / Technology-Labels.
- **Rendering**: Custom React-Flow-Renderer wie BPMN (`src/bpmn/` als Blueprint). Mermaid `architecture-beta` als Export. **Nicht** Mermaid C4Context (6 Jahre experimental, Layout bricht).
- **Icon-Set**: 10 Common-Denominator-Icons (Person, System, Database, Cloud, External System, Integration/API, File, Boundary, Data Flow, Container).
- **Schema**: Strukturiertes JSON (`landscape.json`), DBML-analog. MCP-Tools: `landscape_add_system`, `landscape_add_relation`, `landscape_parse_description`.
- **UX-Inspiration**: Miros Workshop-Flow (Sticky-Drag) + Lucidcharts Hover-Verbindungspunkte.

### UX

**D5 — Color-Coding: Semantisch + 3 Status-Overrides.**
Farbe pro Node-Typ fest, TAFKA-Palette (Task/System=Indigo, Gateway=Amber, Event/Person=Emerald, End/ExternalSystem=Slate, DataStore/Database=Violet). Freier Farbwähler wird entfernt. Pro Node setzbarer Status:
- `offen` (default, keine Überschreibung)
- `erledigt` (grün + Häkchen) — für Audit-Checklisten
- `Problem/Blocker` (rot + Warn) — für Schwachstellen

**D6 — Platzieren: Drag-and-Drop + Click-to-Place.**
Beide Patterns aktiv. Drag-Drop primär (Ghost-Preview), Click-to-Place als Fallback (A11y). ESC bricht ab.

**D7 — Sprache: Deutsch-first, Englisch als Option.**
UI-Default, Templates, Labels, Tooltips, Status-Namen auf Deutsch. Englisch via Setting. Mermaid/Code-Export bleibt englisch (technischer Standard).

**D8 — Tablet-freundlich, Phone out-of-scope.**
Touch-Targets und Layouts so gebaut, dass iPad/Surface im Audit-Termin nutzbar sind. Drag-Drop mit Finger, größere Buttons. Phone wird explizit NICHT unterstützt.

### Export & Workflow

**D9 — Export: Handoff-Bundle als Default, Einzel-Exports versteckt.**
Primär-Button erzeugt Ordner:
```
<diagram>/
├── README.md                  # Context für Agents
├── source.{dbml|bpmn.json|landscape.json}
├── exports/
│   ├── mermaid.md             # Docs/GitHub
│   ├── diagram.svg            # Vektor
│   └── diagram.png            # Raster
└── .viso.json                 # Metadata (Mode, Theme, Version)
```
Einzel-Exports ins „Advanced"-Dropdown, via MCP-Tools weiter verfügbar. SVG/PNG-Rendering schließt Phase-6-Debt (`App.tsx:431` Alert).

**D10 — Async-Workflow: Kunde → Share → Consultant.**
Kunde erstellt im Simpel-Mode, teilt per Handoff-Bundle (Ordner oder Mail). Consultant öffnet im Audit-Termin, schaltet Modi hoch, ergänzt. Kein Server nötig, funktioniert im Solo-Tool.

### Agent-Native

**D11 — Narrative-to-Diagram als USP.**
Neues MCP-Tool `landscape_parse_description` (analog auch für BPMN/ERD): Consultant diktiert im Termin („Winestro synchronisiert täglich mit Shopify, SharePoint speichert Rechnungen"), Agent parst den Fließtext und platziert Elemente automatisch. Das ist die Lücke, die viso-mcp gegenüber Miro/draw.io/Lucidchart schließt.

**D12 — Templates: 1 Starter + anwachsende Galerie via MCP-Resources.**
v1.1 shippt mit **einem generischen Starter-Template** (neutral: „Dein CRM", „Deine Buchhaltung"). Die Branchen-Galerie (Weingut, Handwerk, Beratung, E-Commerce, Handel) wird als **MCP-Resource-Repo** aufgebaut — Agent kann via `list_resources` / `read_resource` Templates laden. Consultant-Erfahrung fließt zurück: neue Templates werden über Git-Commits in das Template-Repo ergänzt.

### Architektur

**D13 — Privacy: Lokal-First mit Hub-Hook vorbereitet.**
Solo bleibt lokal (Dateisystem, keine Cloud). Architektur wird so gebaut, dass Hub-Integration später nahtlos Cloud-Persistenz aktivieren kann — ein Flag/Interface im Core-API, aber keine Cloud-Features in v1.1. DSGVO-sauber.

**D14 — Notion-Wissensgraph: Später via Hub, kein Notion-Sync in v1.1.**
Solo-v1.1 bleibt standalone. Die Notion-Brücke baut das Use-Case-Sparring-Portal; das Hub nutzt die VisoEditor-Component mit eigenem Sync-Layer. Klare Trennung der Systeme.

## Resolved Questions

Alle durch Dialog & Research geklärt:
- ~~BPMN + simpel als zwei Engines?~~ → Eine Engine, zwei Presets (D3).
- ~~Architektur Hub-ready?~~ → Ja (Phase-5-Research).
- ~~Multiplayer im Core?~~ → Nein, Hub (D14).
- ~~Release-Reihenfolge?~~ → Ein großes v1.1 (D2).
- ~~System-Landscape-Scope?~~ → C4 L1 + L2 Toggle, Research-basiert (D4).
- ~~System-Landscape Renderer?~~ → Custom React-Flow, Mermaid nur Export (D4).
- ~~Handoff-Bundle-Trigger?~~ → Bundle = Default, Einzel versteckt (D9).
- ~~Status-Werte?~~ → offen / erledigt / Problem (D5).
- ~~npm-Publish-Timing?~~ → Nach v1.1 (D2).
- ~~Agent-Native-Tiefe?~~ → Narrative-to-Diagram (D11).
- ~~Templates-Strategie?~~ → 1 Starter + MCP-Resource-Galerie (D12).
- ~~Kunde-Consultant-Workflow?~~ → Async via Handoff-Bundle (D10).
- ~~Sprache?~~ → Deutsch-first (D7).
- ~~Privacy-Modell?~~ → Lokal-First mit Hub-Hook (D13).
- ~~Form-Factor?~~ → Tablet-freundlich, kein Phone (D8).

## Open Questions (für Plan)

HOW-Fragen, die im `/workflows:plan` gelöst werden:

- **Migration bestehender BPMN-Diagramme**: Default-Mode bei Öffnen = BPMN (nicht Simpel-Downgrade). Konkrete Migrations-Logik im Plan.
- **System-Landscape MCP-Tool-Schnitt**: Generisch `landscape_add_node` mit `kind`-Enum, oder granulare Tools pro Typ? Abwägung im Plan.
- **C4-Boundary-UX**: Lasso-Select? Rechtsklick-Kontextmenü? Explizites „Add Boundary"-Tool?
- **Handoff-Bundle-MIME**: Browser = `.zip`-Download, CLI = Ordner auf FS. Pfad-Handling im Plan.
- **Narrative-to-Diagram-Engine**: Wie wird das Parsing gebaut? Regex-basierte Template-Matcher, oder LLM-Call beim Client (Client-side Claude-Call via MCP)? Latenz/Kosten-Abwägung.
- **Tablet-Touch-Targets**: Konkrete Minimum-Size-Regeln (44px nach HIG?) und Pixel-Budget im Plan.
- **Deutsch-Lokalisierung**: i18n-Framework (i18next? react-intl?) vs. simple Const-Dictionary. Vermutlich Const-Dictionary wegen YAGNI.

## Next Steps

→ `/workflows:plan` auf diesem Dokument. Erwartet wird `docs/plans/2026-04-2X-feat-viso-mcp-v1.1-plan.md` mit Phasen:

1. **P0: Quick-Fixes** (Drag-Drop, Color-Semantisch, SVG/PNG, Status-UI, Deutsch-Dictionary)
2. **P1: Two-Mode-Toggle** (Prozess-UI, gefilterte ToolPalette, BPMN-Unlock, Mode-Persistenz)
3. **P2: System-Landscape v1** (Schema, MCP-Tools, React-Flow-Renderer, L1-Elemente, Handoff-Bundle-Export)
4. **P3: System-Landscape L2 + Narrative-to-Diagram** (Container/DB/Boundary, `landscape_parse_description`, Mermaid `architecture-beta`-Export)
5. **P4: Templates & Tablet-Polish** (Starter-Template, MCP-Resource-API, Touch-Targets, Responsive-Breakpoints)
6. **P5: npm-Publish & Release v1.1**

Hub-Integration bleibt als separates Follow-up-Planungs-Artefakt. Keine Breaking Changes am Core-API.
