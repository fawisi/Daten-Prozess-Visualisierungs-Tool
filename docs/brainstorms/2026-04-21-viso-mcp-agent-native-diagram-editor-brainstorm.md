---
date: 2026-04-21
updated: 2026-04-22
topic: viso-mcp-agent-native-diagram-editor
version: v2 (Vertiefungsrunde 2026-04-22)
status: Brainstorm abgeschlossen, bereit fuer /workflows:plan
autor: Fabian Willi Simon (+ Claude)
basiert_auf: bestehendes Tool daten-viz-mcp (v0.2.0), Konzept TAFKA KI-Hub v4
mockups: docs/designs/editor-ux-mockups-all5.png, editor-ux-mockup-hybrid-final.png
---

# viso-mcp - Agent-natives Diagramm-Studio

## TL;DR

Wir relaunchen das bestehende `daten-viz-mcp` als **`viso-mcp`**: ein agent-
agnostisches npm-Paket mit leichtgewichtigem Browser-Editor fuer BPMN-Prozesse
und ER-Datenmodelle, das ueber MCP von **allen** Coding-Agents (Claude Code,
Cursor, Cline, Windsurf, Zed) genutzt werden kann. Der TAFKA KI-Hub bindet
denselben Code als Next.js-Komponente ein, der Kunden-Report rendert als HTML
und wird via **Gotenberg** (Docker-Microservice, Hetzner EU) zu PDF exportiert.

**Primaere Formate:** Custom JSON (BPMN-Source-of-Truth) + **DBML**
(ERD-Source-of-Truth) + **Mermaid** (Export-Layer fuer LLM-Kontext). **Editor-UX:**
Canvas-first Hybrid - Tools links, Properties rechts, Code-Panel per Cmd+/
einblendbar, Auto-Layout-Button, Screen-Recording-Attachment.

---

## Was wir bauen

Ein **leichtgewichtiger Browser-Editor**, der

1. BPMN-Prozesse visuell editierbar macht (React Flow + ELK-Auto-Layout),
2. ER-Datenmodelle visuell editierbar macht,
3. alle Diagramme als **Mermaid-Code, DBML oder SQL DDL** exportiert, damit
   sie sich direkt als Kontext in jeden LLM-Prompt einfuegen lassen,
4. via **MCP-Server** von Coding-Agents gelesen UND editiert werden kann
   (atomare Tool-Calls + hybrider `set_*`-Initial-Draft),
5. via **HTTP-API-Wrapper** in den TAFKA KI-Hub (Next.js) eingebunden wird,
6. per **`npx viso-mcp init`** in einem Befehl die MCP-Config fuer Claude
   Code schreibt (weitere Agents nach Community-Feedback),
7. Singleplayer-Tool bleibt (Multi-User-Logik lebt auf Hub-Ebene, nicht im
   Core-Paket).

Das Tool ersetzt nichts Bestehendes radikal - es ist der konsequente naechste
Schritt fuer `daten-viz-mcp` v0.2.0: **Rebrand + DBML-Migration + Auto-Setup-CLI
+ Hub-Ready Packaging + polished Hybrid-UX**.

---

## Warum dieser Weg (nach Research)

Drei parallele Research-Agents (BPMN-Formate, ERD-Formate, LLM-Roundtrip-
Qualitaet) plus vier parallele Agents zur PDF-Toolchain kamen zum gleichen Bild:

**BPMN 2.0 XML ist LLM-feindlich** (arXiv 2509.24592, BPMN Assistant 2025):
direkte XML-Generierung ist 4x teurer in Tokens und erreicht bei Open-Weights-
Modellen nur 8% Erfolgsrate (JSON: 50%). Sogar Claude 4.5 kommt bei XML nur auf
Gleichstand mit JSON-basiertem Editing. Konsequenz: Custom JSON als
BPMN-Source-of-Truth ist die richtige Entscheidung und bleibt.

**DBML ist der Sweet Spot fuer ER-Modelle**: deckt composite keys, indexes,
enums, TableGroups, Referential Actions, multi-schema ab. Hat mit `@dbml/core`
eine robuste npm-Parser-Library. ER Flow's MCP nutzt DBML bereits als Surface
(erflow.io/en/blog/claude-mcp-database-architect). Mermaid erDiagram ist nur
fuer Exports/Views geeignet (fehlen composite-FKs, Indexes, Enums; styling-API
unzuverlaessig, Issue mermaid-js/mermaid#2673).

**Mermaid ist das LLM-Lingua-Franca fuer Exports**: token-aermstes Format
(~150 Tokens/10 Nodes), native GitHub/Notion/VS Code Render, groesster
LLM-Trainings-Fussabdruck. Die "Mermaid + externe CSS-Datei"-Idee ist **kein
echtes Pattern** (Shadow-DOM-Rendering blockiert CSS-Kaskade). Stattdessen:
ein geteiltes `theme.ts` Modul, das `themeVariables` + `classDef`-Fragmente
konsistent injiziert.

**D2 als "Pretty Export" vertagt**: besseres Styling (echte Klassen, Themes,
SVG-Icons) und stabileres Layout (ELK), aber kein GitHub-Render und kleinere
LLM-Community. Fuer spaetere Iteration reservieren, nicht MVP.

**PDF via HTML-Render (Gotenberg)**: da der TAFKA KI-Hub den Audit-Report als
**interaktive HTML-Seite** darstellt (report.html mit Live-ROI-Widgets, Adoption-
Slider, Wirkungsfelder A+B), ist HTML-zu-PDF der natuerlichste Weg. PDFs sind
mit kopierbarem Text und klickbaren Links; Widgets werden beim Export
eingefroren. @react-pdf/renderer faellt raus wegen Memory-Leaks (Issue #718),
SVG-CSS-Problemen und Next.js-16-App-Router-Inkompatibilitaet. Pandoc+Typst
waere doppelpflegebasierte Parallel-Quelle - nicht sinnvoll.

---

## Architektur

```
┌─ BPMN ────────────────────────┐   ┌─ ERD ──────────────────────────┐
│ Source:   custom JSON         │   │ Source:   DBML (.dbml Text)    │
│ Layout:   .bpmn.pos.json      │   │ Layout:   .erd.pos.json        │
│                               │   │                                │
│ Exports:  Mermaid flowchart,  │   │ Exports:  Mermaid erDiagram,   │
│           SVG (fuer PDF)      │   │           SQL DDL (Postgres,   │
│                               │   │           MySQL, MSSQL, ...),  │
│                               │   │           SVG (fuer PDF)       │
└───────────────────────────────┘   └────────────────────────────────┘
            ↓                                        ↓
┌───────────────────────────────────────────────────────────────────┐
│ MCP-Server (stdio, Singleplayer, agent-agnostisch)                │
│ ├─ atomare Mutations: process_add_node, diagram_add_table, ...    │
│ └─ Hybrid-Mode: set_bpmn, set_dbml (fuer Initial-Drafts)          │
│                                                                   │
│ HTTP-API-Wrapper (fuer TAFKA KI-Hub)                              │
│ ├─ POST /api/workspace/:id/bpmn/node                              │
│ ├─ POST /api/workspace/:id/erd/table                              │
│ └─ GET  /api/workspace/:id/export/(mermaid|svg|sql|dbml)          │
│                                                                   │
│ theme.ts (shared Mermaid styling fuer konsistente Exports)        │
└───────────────────────────────────────────────────────────────────┘
            ↓
┌───────────────────────────────────────────────────────────────────┐
│ Browser-Editor (React 19 + @xyflow/react 12 + ELK + shadcn/ui)    │
│ Hybrid-UX: Canvas-first + Tools links + Properties rechts         │
│ Cmd+/ toggelt DBML/JSON-Code-Panel ein                            │
│ - Standalone:  `npx viso-mcp serve process.bpmn.json`             │
│ - Embedded:    Next.js Client Component im TAFKA KI-Hub           │
└───────────────────────────────────────────────────────────────────┘
            ↓
┌───────────────────────────────────────────────────────────────────┐
│ Hub-only: PDF-Export (interaktives HTML → PDF)                    │
│ Gotenberg Docker-Microservice in Hetzner EU (Frankfurt)           │
│ POST /forms/chromium/convert/html  →  PDF-Buffer                  │
│ Vercel-Next.js ruft via fetch(), speichert in Supabase Storage    │
└───────────────────────────────────────────────────────────────────┘
```

---

## Editor-UX: Hybrid Final

Siehe `docs/designs/editor-ux-mockup-hybrid-final.png`. Kombiniert die besten
Elemente aus vier evaluierten Stilen (Excalidraw, dbdiagram.io, Miro/Figma-Lite,
n8n):

- **Top-Header:** Logo, Dateiname, Auto-Layout-Button (primaer, lila),
  "</> Code" Toggle, "↓ Export" Button.
- **Linke Sidebar (68px):** Tool-Palette mit Pointer (default active), Pan,
  Separator, dann BPMN-/ERD-Shapes als echte Symbole (Start-Event = gruener
  Kreis, End-Event = roter Kreis, Task = blauer Rect, Gateway = gelber Diamant).
  Reine Icons-only, kein Text.
- **Canvas (fill):** React-Flow-Canvas. Selektierter Node bekommt gestrichelten
  lila Rahmen. ELK-Auto-Layout bei Knopfdruck oder nach Bulk-Mutation.
- **Rechte Sidebar (300px, einblendbar bei Selection):**
  - Header: Node-Typ + Name (`Task: Registrieren`)
  - Feld: LABEL (Text-Input)
  - Feld: TYPE (Dropdown)
  - Feld: FARBE (6 Farb-Swatches, custom auch moeglich)
  - Feld: KOMMENTAR (Textarea)
  - Section: ATTACHMENTS (Slot fuer Hub-Integration)
    - viso-mcp exportiert nur einen React-Prop `attachmentSlot`. Der Hub
      liefert die konkrete Screen-Recording-/File-Upload-Implementation
      (MediaRecorder-API + Supabase Storage). Spec im Hub-Repo:
      `TAFKA_KI_Transformationshub/docs/research/aktiv/2026-04-18-screen-
      recording-feasibility.md`.
- **Code-Panel (Bottom, toggelbar via Cmd+/ oder "</> Code"-Button):** Split
  einblendbar, zeigt BPMN-JSON oder DBML-Text je nach aktivem Diagramm.
  Live-sync mit Canvas. Fuer Power-User und Agent-Workflow optimal.

**Warum so?** Canvas-first eignet sich fuer die Consultant-Zielgruppe (nicht-
techisch). Das Code-Panel ist fuer Power-User und Agent-Workflows verfuegbar,
aber nicht als Default im Weg. Tools + Shapes in linker Sidebar trennen
Werkzeug-Auswahl vom Properties-Editing rechts. Auto-Layout-Button ist aus
Miro/Figma-Lite uebernommen und beschleunigt das Ordnen nach Bulk-Aenderungen.

**Touch-optimiert:** Canvas unterstuetzt Pinch-Zoom und Touch-Drag (wichtig fuer
TAFKA-Workshops mit iPad).

**MVP-Must-Haves:** Undo/Redo (Cmd+Z), Keyboard-Shortcuts + Command-Palette
(Cmd+K), Auto-Save mit File-Watcher-Sync, Auto-Layout-Button (ELK One-Click).

---

## Agent-Auto-Modeling

**Input:** Freitext-Prompt. Der Agent (Claude Code, Cursor) bekommt eine
Prozess- oder Schema-Beschreibung in natuerlicher Sprache (z.B. "Kunde
registriert sich, bestaetigt E-Mail, kann dann Produkte kaufen") und baut
daraus BPMN oder ERD.

**Autonomie-Grad:** Agent schlaegt vor, User bestaetigt (Human-in-the-Loop).
Editor zeigt den Entwurf sofort im Canvas, User reviewt, editiert oder akzeptiert.
Sicher, besonders im TAFKA-Kontext, wo der Consultant Qualitaet garantiert.

**Technische Umsetzung (Hybrid-Pfad):**
1. Agent macht initial einen **Bulk-Set** via `set_bpmn(json)` oder
   `set_dbml(text)` - komplettes Diagramm in einem Call. Schnell, User sieht
   den Entwurf sofort.
2. Agent macht **spaetere Korrekturen** via atomare Tool-Calls
   (`process_add_node`, `diagram_add_column`). Praezise, diff-freundlich,
   weniger Token-Kosten.

Rationale: Research (arXiv 2509.24592) zeigt, dass atomare Mutations bei grossen
Diagrammen zuverlaessiger sind, aber der Initial-Draft als Bulk-Set
Tokenkosten spart. Hybrid kombiniert beides.

**Paralleles Edit ist moeglich:** Der MCP-Server schreibt Files, der Browser-
Editor hat einen File-Watcher (chokidar, existiert bereits) und re-rendert live
bei Dateiaenderung. Du kannst also gleichzeitig manuell editieren, waehrend der
Agent baut - Last-Write-Wins-Semantik, im Singleplayer-Kontext kein Problem.

---

## Hub-Integration im Detail

### Storage & Tech-Stack (Hub-seitig, recherchiert)

Der TAFKA KI-Hub ist bereits auf folgendem Stack festgelegt (`legacy/portal-
prototype-2026-04/src/lib/db/schema.ts`):
- **Postgres via Supabase EU Frankfurt** + **Drizzle ORM 0.45.2**
- **Next.js 16.2.2 App Router**
- **@xyflow/react 12.10.2** (identische Version wie unser Tool - direkt
  kompatibel)
- **@react-pdf/renderer 4.4.0** im Prototyp (wird fuer viso-Integration durch
  Gotenberg ersetzt)
- **Auth:** Supabase Auth (Magic Links)
- **File Storage:** Supabase Storage mit signierten URLs
- **Row-Level Security:** `workspace_id = current_setting('app.workspace_id')`

### Wie Diagramme persistiert werden

Im Hub-Kontext liegen BPMN-JSON und DBML **als Text-Spalten in Postgres-Tabellen**
(nicht als Files):
- `process_diagrams.bpmn_json` (TEXT), `process_diagrams.positions` (JSONB)
- `erd_diagrams.dbml` (TEXT), `erd_diagrams.positions` (JSONB)
- Beide haben `workspace_id` FK mit RLS

Der HTTP-API-Wrapper im viso-mcp konvertiert zwischen File-based (Singleplayer
`npx viso-mcp serve`) und DB-persistence (Hub). Dieselben MCP-Tools, anderer
Storage-Adapter.

### Rollen & Permissions (Hub-seitig)

**Beide voll editierberechtigt (Consultant + Kunde)** mit **Audit-Log**:
- Jede Mutation speichert `changed_by`, `changed_at`, `diff_json` in
  `diagram_audit_log`
- UI zeigt: "Nils hat 21.04. 14:32 den Task 'Registrieren' hinzugefuegt"
- DSGVO/AI-Act-konform durch vollstaendige Nachvollziehbarkeit
- Spaeter als Feature: "Rollback auf Version X" moeglich

**Wichtige Praezisierung:** `viso-mcp` als npm-Paket ist **Singleplayer**.
Multiplayer-Logik (Consultant + Kunde gleichzeitig) lebt auf Hub-Ebene, nicht
im Tool-Core. Der Hub kann spaeter z.B. Y.js oder Workspace-Locks einbauen,
ohne dass viso-mcp davon etwas weiss.

### Agent-Identitaet im Hub

Agent attribuiert als **Consultant** (nicht als Kunde). Rationale: TAFKA ist
Quality-Owner, Agent arbeitet "im Auftrag des Consultants". Audit-Log-Eintrag:
`changed_by: "Agent (as Nils Muehlenfeld)"`.

---

## PDF-Toolchain (Hub-only)

### Entscheidung: Gotenberg Microservice in Hetzner VPS Frankfurt

Nach 4 parallelen Deep-Research-Agents zu @react-pdf/renderer, Puppeteer/Gotenberg,
Typst und Pandoc+Typst:

**Gewinner: Gotenberg** (Docker-Container mit headless Chromium) als separater
Microservice auf einem Hetzner VPS CX11 (~5€/Monat, Frankfurt).

**Pipeline:**
```
Next.js App (Vercel)
   ├─ rendert interaktives HTML (react-pdf-report.tsx mit ROI-Widgets)
   ├─ fetch('https://viso-pdf.tafka.de/forms/chromium/convert/html', {
   │      method: 'POST',
   │      body: FormData mit index.html, fonts, TAFKA-CSS
   │   })
   └─ bekommt PDF-Buffer zurueck, speichert in Supabase Storage
```

**Warum:**
1. **Hub-Primaer-Output ist bereits HTML** (report.html mit Live-ROI-Widgets).
   HTML→PDF ist die natuerliche Weiterfuehrung, keine doppelte Quelle.
2. **Agent schreibt HTML/Tailwind exzellent** (Fabian-Feedback bestaetigt).
3. **Text bleibt kopierbar**, Links funktionieren, Cmd+F-Suche geht (kein
   Raster-Bild).
4. **BPMN/Mermaid rendern perfekt** (native Browser-Render, 100% Fidelity).
5. **Deploy-Host austauschbar:** Gotenberg ist Standard-Docker-Image. Wechsel
   von Hetzner zu Railway/Fly/Cloud Run ist eine ENV-Variable. Kein Lock-in.

**DSGVO-konform:** Hetzner ist deutscher Anbieter, TAFKA ist alleiniger Data
Controller, PDFs werden in EU gerendert und in EU-Supabase-Storage gespeichert.

---

## Admin-Report-Editor (Hub-Delta, neue User-Story)

Recherche im TAFKA KI-Hub zeigt: der **Admin-Bereich fuer Report-Editing ist
noch nicht spezifiziert**. Der Consultant braucht eine UI, um aus
Audit-Fragebogen + Prozesstabelle + BPMN-/ERD-Diagrammen den 20-30-seitigen
Report zu befuellen. Aktueller Stand:
- `reports` Tabelle existiert (`markdownContent`, `version`, `cachedPdf`)
- `report.html` Clickdummy existiert (Kundenansicht mit Live-ROI-Widgets)
- **Admin-Editor-UI fehlt**. Versionierung/Freigabe-Workflow fehlt.

### Neue User-Story (geht ins Hub-Brainstorm)

> **Als Consultant** will ich im Admin-Bereich einen Audit-Report editieren,
> mit:
> - Strukturierten Template-Feldern (Wirkungsfeld A, Wirkungsfeld B, Prozesse,
>   Fail-Lessons, ROI-Parameter)
> - Optional: Agent-vorbefuellten Inhalten pro Section (aus Audit-Daten +
>   Diagrammen)
> - Live-Preview der Kundenansicht (report.html mit aktuellen Werten)
> - Diagramm-Einbindung aus viso-mcp (Auto-Sync, SVG-Render)
> - Versions-Tracking (`draft` → `in_review` → `approved` → `final`)
> - PDF-Export-Trigger nach Approval (via Gotenberg-Microservice)
> - Audit-Log (wer hat was wann geaendert - DSGVO/AI-Act)

**Impact auf viso-mcp:** Der Admin-Report-Editor importiert die
viso-mcp-React-Components und ruft HTTP-API-Endpoints fuer Diagramm-Export
(SVG, Mermaid, Code). `viso-mcp` muss keine Report-Logik kennen - der Hub
baut den Report-Editor darum herum.

**Dieses Brainstorm dokumentiert die Abhaengigkeit**; die konkrete Spec der
Admin-UI entsteht im Hub-Repo als separates Brainstorm/Plan.

---

## Key Decisions

- **Packaging:** Standalone npm-Paket `viso-mcp`, agent-agnostisch ueber MCP.
- **Distribution:** npm + Auto-Setup-CLI (`npx viso-mcp init`). MVP-Coverage:
  Claude Code (.mcp.json). Cursor/Cline/Windsurf/Zed nach Community-Feedback.
- **BPMN-Format:** Custom JSON bleibt (`viso-bpmn-v1`).
- **ERD-Format:** Wechsel zu DBML via `@dbml/core`.
- **Export-Formate:** Mermaid (default) + SQL DDL + SVG (fuer PDF).
- **Styling:** Gemeinsames `theme.ts` Modul, keine externe CSS.
- **Editing-Mechanik:** Atomare MCP-Tool-Calls **plus** Hybrid-`set_*`-Tools
  fuer Initial-Drafts.
- **Auto-Modeling:** Freitext-Input, Human-in-the-Loop, Hybrid (bulk + atomic).
- **Editor-UX:** Hybrid Final (Canvas-first, Tools links, Properties rechts,
  Code-Panel per Cmd+/ einblendbar). Siehe Mockup 5.
- **Touch-optimiert:** Ja (iPad-Workshops).
- **Hub-Integration:** Standalone npm-Paket, Hub bindet als React Components
  + HTTP-API-Wrapper ein.
- **Hub-Storage:** Postgres/Supabase + Drizzle ORM, RLS per workspace_id.
- **Hub-Rollen:** Beide voll editierberechtigt + Audit-Log. Agent attribuiert
  als Consultant.
- **Multiplayer-Logik:** **Nicht im viso-mcp-Core**, sondern auf Hub-Ebene.
  viso-mcp bleibt Singleplayer.
- **PDF-Toolchain:** Gotenberg Docker-Microservice in Hetzner Frankfurt EU.
  HTML→PDF, nicht React-PDF. Austauschbar per ENV.
- **Name:** `viso-mcp` (phonetisch nah an Visio, markenrechtlich sauber).
- **Lizenz:** MIT.
- **Repo:** Rename von `Daten_Prozess_Visualisierungs_Tool/` zu `viso-mcp/`.
- **Legacy-Support:** Keiner. v1.0 liest nur DBML. `viso-mcp migrate` als
  One-Time-Skript.

---

## MVP Scope

Vier Bausteine fuer den ersten Release:

1. **ERD-Migration JSON → DBML**
   - `@dbml/core` integrieren
   - `DiagramStore` liest/schreibt `.dbml` + `.erd.pos.json`
   - Bestehende MCP-Tools unveraendert an der Oberflaeche, intern auf DBML
   - SQL DDL Export (Postgres/MySQL/MSSQL/Oracle/Snowflake)
   - Migrationsskript `viso-mcp migrate`

2. **Auto-Setup-CLI `npx viso-mcp init`**
   - Claude Code Workspace-Erkennung
   - `.mcp.json` schreiben/erweitern
   - Dry-run, interaktiver Fallback

3. **Hybrid-UX-Editor + Polish-Layer** (explizit aufgeschluesselt)
   - **Theme-Modul** `src/theme.ts` mit `themeVariables` + `classDef`-
     Fragmenten fuer konsistentes Mermaid-Rendering
   - **Editor-Chrome:**
     - Top-Header: Logo, Dateiname, `</> Code`-Toggle, `↓ Export`-Button,
       Auto-Layout-Button (ELK one-click)
     - Linke Sidebar (68px): Tool-Palette (Pointer default-aktiv, Pan,
       Separator, Start-Event, End-Event, Task, Gateway - als Icons)
     - Rechte Sidebar (300px, einblendbar bei Selection): Properties-Panel
       mit LABEL, TYPE, FARBE (6 Swatches), KOMMENTAR, `attachmentSlot`
       (Slot-Prop fuer Hub-Implementation)
     - Bottom Code-Panel: toggelbar via Cmd+/ oder Header-Button, zeigt
       BPMN-JSON oder DBML-Text, Live-Sync mit Canvas
   - **Core-Interaktionen:** Undo/Redo (Cmd+Z), Auto-Save mit File-Watcher-
     Sync, Command-Palette (Cmd+K) mit Actions "Add Task", "Export as SVG"
   - **Polish:** Dark-Mode-Toggle, A11y-Grundlagen (Tab-Order, ARIA-Labels
     fuer Canvas-Nodes, Keyboard-Navigation)
   - **Touch-Support:** Pinch-Zoom + Touch-Drag fuer iPad-Workshops
     (React-Flow unterstuetzt Touch nativ; bei Bedarf @use-gesture/react
     als Erweiterung)

4. **Hub-ready: React Components + HTTP-API + Agent-Auto-Modeling**
   - ESM-Export des Editor-Bundles
   - HTTP-API-Adapter (gleiche MCP-Surface als REST)
   - Neue `set_bpmn`, `set_dbml` Tools fuer Bulk-Initial-Drafts
   - Workspace-ID-Parameter durchgereicht, Auth delegiert an Hub

**Nicht im MVP:**
- D2-Export (vertagt)
- Cursor/Cline/Windsurf/Zed Setup-Zweige
- Multi-User / Live-Collaboration (lebt auf Hub-Ebene)
- BPMN 2.0 XML Import/Export
- Pool/Lane-Darstellung im BPMN-Editor
- Prisma/Drizzle-First-Class-Exports
- Screen-Recording-Implementation (Hub-Thema, viso-mcp exportiert nur
  `attachmentSlot`-Prop)
- Gotenberg-Integration (Hub-Thema, separates Plan)
- Admin-Report-Editor (Hub-Thema, separates Plan)
- Skill-Markdown (post-MVP Community-Release)

---

## Beziehung zum TAFKA KI-Hub

| Hub-Anforderung | Erfuellt durch |
|---|---|
| Browser-Editor als Hub-Modul | React Components + ESM-Export, Next.js Client Component |
| Workspace-Isolation | Hub steuert Files/DB, Tool ist Workspace-agnostisch |
| Agent-Zugriff (Audit-Auto-Modeller) | MCP-Tools + HTTP-API-Wrapper |
| Audit-Report-PDF mit BPMN | SVG-Export + Gotenberg Microservice |
| SQL-DDL fuer IT-Roentgenbild | @dbml/core liefert multi-dialect Export |
| DSGVO/BFSG/AI-Act | Hetzner EU + Supabase EU + Audit-Log |
| Multi-User (Consultant+Kunde) | Hub-Layer baut darueber, viso bleibt Singleplayer |
| iPad-Workshops | Touch-optimierter Canvas im Editor |
| Screen-Recording-Upload | viso-mcp exportiert React-Prop `attachmentSlot`; Hub implementiert via MediaRecorder-API + Supabase Storage |

---

## Open Questions

Zwei Detail-Fragen bleiben bewusst offen fuer die Planning-Phase:

1. **D2-Export in v1.x oder v2.0?** Abhaengig davon, ob Audit-PDFs oder
   Kunden-Pitches ein ernster Use-Case werden. Evaluation nach erstem
   Hub-Prototyp.

2. **Skill-Markdown (SKILL.md)** fuer Community-Veroeffentlichung: eigener
   Release nach MVP-Stabilisierung. Nicht MVP.

---

## Risiken

Fuer die Planning-Phase zu adressieren:

1. **`@dbml/core` API-Stabilitaet:** Externes NPM-Package, Version-Drift
   moeglich. Mitigation: Version pinnen, Parser-Output in eigenem Adapter
   kapseln, Regressions-Tests mit Standard-Schemas (3-5 typische ERDs).

2. **React-Flow / @xyflow/react Major-Upgrades:** v12 wird vom Hub genutzt,
   aber Breaking Changes bei v13+ moeglich (bekannt fuer v10→v11→v12). 
   Mitigation: eigene Wrapper-Components, Upgrade nur synchron mit Hub,
   Changelog-Monitoring.

3. **Gotenberg-Security-Updates (Hub-seitig):** Chromium-Container mit
   Sandbox-Escape-CVE-Historie (CVE-2025-34267). Mitigation: Docker-Image
   mit Watchtower fuer Auto-Updates, `--no-sandbox` nur im isolierten
   Container, Netzwerk-Isolation zur Hub-API.

4. **Hetzner-VPS-Ausfall:** Single-Point-of-Failure fuer PDF-Export.
   Mitigation: Gotenberg ist Standard-Docker-Image, Wechsel zu Railway/Fly
   per ENV-Variable (<1h Downtime). Backup-Plan im Runbook dokumentiert.

5. **Mermaid-Rendering-Inkonsistenzen:** Mermaid-v11-Styling-API hat
   bekannte Bugs (Issue #2673: `classDef` auf Entities unzuverlaessig).
   Mitigation: `theme.ts` isoliert das Styling, Fallback auf inline
   `style`-Direktiven, Regressions-Tests fuer Standard-Diagramme.

---

## Next Steps

→ `/workflows:plan docs/brainstorms/2026-04-21-viso-mcp-agent-native-diagram-editor-brainstorm.md`

Im Plan konkretisieren:
1. Dateistruktur der DBML-Migration, welche Files umgebaut werden
2. Auto-Setup-CLI: Pfade, Parsing-Logik, Detect-Heuristik
3. Hybrid-UX-Editor: React-Component-Baum, Shortcuts, ELK-Integration
4. HTTP-API-Wrapper: OpenAPI-Spec, Auth-Pass-Through
5. Screen-Recording-Integration: MediaRecorder-API, Supabase Storage Upload
6. Test-Strategie: Vitest-Tests, Visual-Regression fuer Editor

---

## Resolved Questions (Archiv)

**Q: Plugin vs. Skill vs. Web-App?** → Standalone npm-Paket mit MCP-Server +
Browser-Editor + Auto-Setup-CLI.

**Q: MCP vs. eigenes Protokoll?** → MCP (einziger offener Standard fuer alle
Agents).

**Q: Mermaid mit externer Style-Datei?** → Existiert nicht (Shadow-DOM).
Loesung: geteiltes `theme.ts` Modul.

**Q: D2 ins MVP?** → Nein, vertagt.

**Q: Hub-Integration: Monorepo oder standalone?** → Standalone. Hub bindet ein.

**Q: Naming?** → `viso-mcp` (markenrechtlich sauber).

**Q: Lizenz?** → MIT.

**Q: Repo umbenennen?** → Ja - `viso-mcp/`.

**Q: Legacy-Support fuer altes ERD-JSON-Format?** → Nein. One-Time-Migration.

**Q: Agent-Coverage-Reihenfolge nach Claude Code?** → Erst Community-Feedback,
dann priorisieren.

**Q: Auto-Modeling-Input-Format?** → Freitext-Prompt.

**Q: Autonomie-Grad des Agents?** → Human-in-the-Loop (Agent schlaegt vor,
User bestaetigt).

**Q: Atomar vs. Bulk beim Agent-Modeling?** → Hybrid (Bulk fuer Draft, Atomar
fuer Edits).

**Q: Hub-Storage?** → Postgres/Supabase + Drizzle, Row-Level Security.

**Q: Rollen im Hub?** → Beide voll editierberechtigt + Audit-Log.

**Q: Agent-Identitaet im Hub?** → Als Consultant attribuiert.

**Q: Multiplayer-Logik im viso-mcp?** → Nein. viso-mcp bleibt Singleplayer,
Multi-User lebt auf Hub-Ebene.

**Q: PDF-Toolchain?** → Gotenberg Docker-Microservice (HTML→PDF), nicht
React-PDF. Hetzner EU Frankfurt.

**Q: Deploy-Target fuer PDF-Service austauschbar?** → Ja, Docker-Standard-Image,
Wechsel ist eine ENV-Variable.

**Q: Editor-UX-Stil?** → Hybrid Final (Canvas-first + Tools links + Properties
rechts + Code-Panel Cmd+/). Mockup in `docs/designs/editor-ux-mockup-hybrid-
final.png`.

**Q: Touch-Support?** → Ja, Pinch-Zoom + Touch-Drag (iPad-Workshops).

**Q: Admin-Report-Editor im Hub?** → Noch nicht spezifiziert. Neue User-Story
mit diesem Brainstorm als Hub-Abhaengigkeit dokumentiert.
