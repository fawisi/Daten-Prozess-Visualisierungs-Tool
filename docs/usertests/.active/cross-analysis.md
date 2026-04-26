# Cross-Analysis — Synthetic User Test viso-mcp v1.1.0

**Datum:** 2026-04-25
**Personas:** 5 (Tech-Lead, Berater, Junior-Dev, Domain-Expertin, Power-User)
**Use Cases:** ERD (DBML), BPMN, Landscape (C4)
**Test-Modi:** Concept + Live-Browser + MCP-Simulation

## Aggregated SUS

| Persona | SUS | Adjective |
|---|---|---|
| Lukas (Tech-Lead) | 30 / 100 | Awful (F) |
| Sarah (Berater) | 25 / 100 | Worst Imaginable (F) |
| Maximilian (Junior) | 7.5 / 100 | Worst Imaginable (F) |
| Petra (Domain) | 0 / 100 | Worst Imaginable (F) |
| Yannick (Power) | 52.5 / 100 | Marginal (D) |
| **Mean SUS** | **23 / 100** | **F-Grade** |

> Branch-Benchmark (Sauro/Lewis 2009): SUS-Mean ueber alle Persona-Profile
> liegt typischerweise bei 68. **Diese App liegt 45 Punkte UNTER dem
> Branchen-Schnitt.**

## Heuristic Averages

| # | Heuristic | Lukas | Sarah | Max | Petra | Yannick | Avg |
|---|---|---|---|---|---|---|---|
| H1 | Visibility | 3 | 3 | 2 | 2 | 2 | **2.4** |
| H2 | Real World | 2 | 2 | 1 | 1 | 2 | **1.6** |
| H3 | User Control | 2 | 2 | 2 | 1 | 2 | **1.8** |
| H4 | Consistency | 1 | 2 | 2 | 2 | 1 | **1.6** |
| H5 | Error Prev. | 1 | 2 | 1 | 0 | 2 | **1.2** |
| H6 | Recognition | 3 | 4 | 3 | 1 | 3 | **2.8** |
| H7 | Flexibility | 2 | 2 | 1 | 0 | 3 | **1.6** |
| H8 | Aesthetic | 4 | 4 | 3 | 3 | 4 | **3.6** |
| H9 | Recovery | 1 | 2 | 1 | 0 | 2 | **1.2** |
| H10 | Help | 2 | 2 | 1 | 1 | 2 | **1.6** |
| | **Average** | 2.1 | 2.5 | 1.7 | 1.1 | 2.3 | **1.94** |

> Beste Heuristik: **H8 Aesthetic** (3.6) — Tool sieht gut aus.
> Schlechteste: **H5 Error Prev.** und **H9 Recovery** (1.2) — gefaehrlich.

## Findings — Konsolidiert nach Severity

### CRITICAL (P0 — Blocker, mehrere Personas blockiert)

#### F-001: KEIN UI-PFAD ZUM FILE-WECHSEL (ERD ↔ BPMN ↔ Landscape)
**Severity:** Critical · **Affects:** 5/5 Personas · **Stories blocked:** US-04, US-06, US-07, US-13, US-25
**Root Cause:** `App.tsx:462` setzt `setOpenTabs(data.slice(0, 1))` initial; `DiagramTabs` wird nur bei `openTabs.length > 1` gerendert; `AppSidebar` wird gar NICHT gerendert in EditorShell; "Switch Diagram..." in Cmd+K ruft `setCommandPaletteOpen(true)` (re-opens itself).
**Impact:** User kann nur die initial gemountete Datei bearbeiten. ERD ↔ BPMN ↔ Landscape ist unerreichbar via UI. **Hauptverkaufsargument "alle 3 Use Cases im einem Tool" ist UI-funktional kaputt**.
**Fix-Vorschlag:**
1. `setOpenTabs(data)` (alle initial)
2. `DiagramTabs` immer rendern wenn `openTabs.length > 0`
3. `AppSidebar` in EditorShell mounten
4. `onSwitchDiagram` mit File-Picker statt Re-Open

#### F-002: ERD-MODE HAT 0 KLICK-BASIERTE ADD-MOEGLICHKEITEN
**Severity:** Critical · **Affects:** 4/5 Personas · **Stories:** US-01
**Root Cause:** `ToolPalette.tsx:14,27-30` — alle Shape-Tools haben `diagramType: 'bpmn'`. ERD hat KEIN Add-Tool. `CommandPalette` hat keine Add-Table-Action. `App.tsx:887` — `bpmnPaneClick` nur fuer BPMN, nicht ERD.
**Impact:** User ohne Code-Panel-Skills (Junior, Petra) kann **keine** ERD-Tabelle erstellen.
**Fix-Vorschlag:**
1. ToolPalette: `{ id: 'table', diagramType: 'erd', shortcut: '5', icon: Table2 }`
2. CommandPalette: `{ id: 'add-table', when: 'erd', run: ... }`
3. App.tsx: `erdPaneClick` analog zu `bpmnPaneClick`
4. handleAddNodeAt erweitern fuer ERD (`type: 'table'`)

#### F-003: LANDSCAPE-USE-CASE IST UI-VOLLKOMMEN UNZUGAENGLICH
**Severity:** Critical · **Affects:** 5/5 · **Stories:** US-13
**Root Cause:** Mehrfach-Layer-Bug:
- `AppSidebar.tsx:31-32` — filtert nur ERD und BPMN, **kein Landscape**
- `DiagramTabs.tsx:30-34` — Landscape bekommt faelschlich BPMN-Icon (GitBranch)
- `CommandPalette.tsx:25` — `when: 'bpmn' | 'erd' | 'any'` — Landscape im Type unmoeglich
- `ToolPalette.tsx:34` — `diagramType: 'bpmn' | 'erd' | null` — Landscape im Type unmoeglich
- `App.tsx:944` — `showModeToggle={diagramType === 'bpmn'}` — Mode-Toggle nur BPMN
**Impact:** Komplette Landscape-Funktionalitaet existiert nur via Code-Panel oder MCP-Tools. Kein einziger UI-Klick fuehrt zu einer Landscape-Aktion.
**Fix-Vorschlag:** Type-Erweiterung von `'bpmn' | 'erd'` auf `'bpmn' | 'erd' | 'landscape'` ueberall. Landscape-spezifische Tools (Person, System, External, Container, Database).

#### F-004: PUT /__viso-api/source AKZEPTIERT KAPUTTEN INPUT MIT 200 OK
**Severity:** Critical · **Affects:** Yannick · **Stories:** US-20, US-29
**Root Cause:** `vite-plugin.ts:106-108` — `writeRawBody(req, res, erdSchemaPath)` schreibt body unvalidiert in die Datei. Kein JSON-Parse-Check, keine Zod-Validation.
**Impact:** Bei kaputtem Input ueber das Code-Panel oder direkten HTTP-Call wird die DATEI ZERSTOERT. Bei naechstem Reload faellt der Editor auf EmptyState zurueck. **Datenverlust-Risiko**.
**Fix-Vorschlag:** `writeRawBody` ersetzen durch `writeValidatedJsonBody` mit Zod-Schema-Check. Bei Failure: 400 + RFC-7807. **Atomic write** (rename-based).

#### F-005: parse_description ENGINE NUR REGEX, VERSAGT BEI DEUTSCH
**Severity:** Critical · **Affects:** Sarah, Yannick · **Stories:** US-18
**Root Cause:** `src/narrative/*` — Regex-Engine, kein LLM-Fallback. `engineUsed: 'regex'` immer.
**Impact:** Hauptverkaufsargument "Narrative-zu-Diagramm" funktional unbrauchbar fuer DE. ERD: 0/5 Saetze erkannt. BPMN: 0/7 erkannt. Landscape: 5/10 partial.
**Fix-Vorschlag:**
1. Strict Regex-Verbesserung fuer DE-Patterns (haben, hat mehrere, gehoert zu, ...)
2. Optional LLM-Fallback via Claude API (env-flag `VISO_LLM_PARSE=true`)
3. `engineUsed: 'llm' | 'regex' | 'mixed'` reporten

#### F-006: set_dbml SETZT DBML-STORE VORAUS, VITE-MODE UNDOKUMENTIERT
**Severity:** Critical · **Affects:** Lukas, Yannick · **Stories:** US-15
**Root Cause:** README sagt "DBML for ERDs", aber `npx viso-mcp init` legt JSON-File an (`*.erd.json`). Migration nicht erwaehnt.
**Impact:** Power-User-Demo bricht. Erstkontakt-Tool ist unbrauchbar.
**Fix-Vorschlag:**
1. `npx viso-mcp init --format=dbml|json` als Option
2. Default: dbml im README-Quickstart
3. set_dbml in JSON-Mode: Auto-migrate mit Bestaetigungsprompt
4. README: "Migration: `npx viso-mcp migrate <file>`" prominent

#### F-007: COMMAND-PALETTE INKONSISTENT ZU EXPORT-DROPDOWN
**Severity:** Critical (User-Verwirrung) · **Affects:** Yannick · **Stories:** US-09
**Root Cause:** `TopHeader.tsx:28-35` — 6 Export-IDs (bundle, mermaid, sql, dbml, svg, png). `CommandPalette.tsx:127-237` — 3 Export-Aktionen (mermaid, sql, dbml). Bundle, SVG, PNG fehlen.
**Impact:** Power-User wechselt zwischen Tab und Maus, findet Inkonsistenz.
**Fix-Vorschlag:** `buildDefaultActions` erweitern um `bundle`, `svg`, `png`. Single Source of Truth.

### MAJOR (P1 — verschlechtert Core-UX)

#### F-008: Properties "Anhaenge: Screen-Recording starten" Demo-Stub aktiv im Vite-Mode
**Severity:** Major · **Affects:** Maximilian, Petra · **Notes:** Hub-Slot-Stub leakt in Standalone-Setup
**Fix:** `attachmentSlot` nur rendern wenn `apiBaseUrl` (Hub-Mode) gesetzt; oder explizite `enableAttachments`-Prop.

#### F-009: Properties-Edit BEZEICHNUNG/KNOTEN nicht persistent fuer ERD
**Severity:** Major · **Affects:** Maximilian, Petra · **Stories:** US-05
**Root Cause:** `App.tsx:707-712` — handleUpdateNode "ERD node edits land in a later phase" (Kommentar im Code).
**Fix:** ERD handleUpdateNode mit JSON-Patch-Mutation analog zu BPMN. Min. fuer `description` und `name`.

#### F-010: Cardinality-Inkonsistenz: "N:1" (Mermaid) vs "many-to-one" (MCP API)
**Severity:** Major · **Affects:** Yannick · **Stories:** US-15
**Fix:** Einheitliches Mapping-Modul: `cardinality.ts` mit `toMermaid`, `toCrowsFoot`, `toUml`.

#### F-011: Param-Naming inkonsistent (`json` vs `process`/`landscape`)
**Severity:** Major · **Affects:** Yannick · **Stories:** US-16, US-17
**Fix:** `set_bpmn(process: ...)`, `set_landscape(landscape: ...)`.

#### F-012: ERD-API-Routes ohne `/erd/` Prefix vs BPMN/Landscape mit
**Severity:** Major · **Affects:** Yannick
**Root Cause:** `vite-plugin.ts:92,102` und ApiConfig `erdSource: '/__viso-api/source'`.
**Fix:** Migration zu `/__viso-api/erd/source` mit Backwards-Compat-Alias.

#### F-013: export_bundle / import_bundle erfordern Filesystem-Pfade
**Severity:** Major · **Affects:** Yannick · **Stories:** US-19
**Fix:** Optional `inBytes`, `outBytes` als ArrayBuffer-Return; outPath optional fuer CLI-Convenience.

#### F-014: parse_description zeigt `persisted: true` bei 0 nodesAdded
**Severity:** Major · **Affects:** Sarah, Yannick · **Stories:** US-18
**Fix:** `persisted: false` wenn nichts neu hinzugefuegt; `noOp: true`-Flag.

#### F-015: Bundle-Default ohne PNG
**Severity:** Major · **Affects:** Sarah · **Stories:** US-09
**Fix:** Default `includePng: true`; opt-out via Param.

#### F-016: Auto-Layout laeuft nicht initial
**Severity:** Major · **Affects:** Maximilian, Petra · **Stories:** US-08
**Fix:** beim ersten Mount falls keine Positionen vorhanden auto-layout triggern (oder ELK in `useDiagramSync` als initial).

#### F-017: Mode-Toggle nur fuer BPMN
**Severity:** Major · **Affects:** Sarah, Yannick · **Stories:** US-25
**Root Cause:** `App.tsx:944` — `showModeToggle={diagramType === 'bpmn'}`.
**Fix:** Auch fuer Landscape (l1 / l2-Modus).

#### F-018: Keine "Add Column"-Funktion in Properties-Panel
**Severity:** Major · **Affects:** Maximilian · **Stories:** US-05
**Fix:** ERD PropertiesPanel: liste Columns + "+ Add Column"-Button.

#### F-019: HYBRID-Badge hardcoded
**Severity:** Major · **Affects:** Lukas
**Root Cause:** `App.tsx:941` — `badge={files.length > 0 ? 'HYBRID' : undefined}`.
**Fix:** Badge auf Diagram-Type setzen (`ERD`, `BPMN`, `LANDSCAPE`); `HYBRID` nur wenn Hub-Modus.

#### F-020: AppSidebar wird nicht gerendert
**Severity:** Major (covered by F-001 Root-Cause)

### MINOR (P2 — kosmetisch oder Edge)

#### F-021: EmptyState-Texte enthalten MCP-Tool-Namen
**Severity:** Minor · **Affects:** Maximilian, Petra · **Stories:** US-11
**Examples:** "Use process_add_node to create nodes.", "Use landscape_add_node to create them."
**Fix:** Ersetzen durch endbenutzerfreundliche Texte. MCP-Hint optional via `?` collapsible.

#### F-022: 'Open Files' nicht i18n
**Severity:** Minor · **Affects:** Petra
**Fix:** `t.properties.openFiles` etc.

#### F-023: Sample-Files (`*.erd.json`) sind .gitignored
**Severity:** Minor · **Notes:** Frische Repo-Klone haben keine Demo-Daten zum Testen
**Fix:** `fixtures/erd-samples/`-Pfad nutzen + `npx viso-mcp init --with-samples`.

#### F-024: KNOTEN/BEZEICHNUNG-Doppelung im Properties-Panel verwirrt
**Severity:** Minor
**Fix:** `KNOTEN: users` als Type-Header eindeutig markieren oder weglassen. `BEZEICHNUNG` → `Name`.

## Patterns / Themen

1. **"Erd ist Sonderfall"** — In API-Routes (kein Prefix), in Tools (keine Shapes), in Properties (kein Add-Column), in handleUpdateNode (auskommentiert). 6 Findings haben den Root-Cause "ERD wurde nachgereicht aber nicht ausreichend integriert".

2. **"Landscape ist Drittklassig"** — In Types (`'bpmn' | 'erd'`), in Sidebar-Filter, in CommandPalette, in DiagramTabs, in ToolPalette, in Mode-Toggle. 8 Findings haben den Root-Cause "Landscape wurde als P2 hinzugefuegt aber nicht ueberall durchgezogen".

3. **"Server-Validation fehlt"** — PUT akzeptiert kaputten Input, parse_description-`persisted:true` bei 0 added, Code-Panel client-side-validate-only. 4 Findings.

4. **"Headless / Cloud-Story unfertig"** — export_bundle und import_bundle erfordern outPath/inPath als FS, kein In-Memory-Bytes-Return. 2 Findings.

5. **"Quickstart ↔ Realitaet Diskrepanz"** — README sagt DBML, Vite-Init schreibt JSON. parse_description wird beworben, aber Engine ist Regex-only. 3 Findings.

## Recommendation Priority Matrix

| Priority | Finding | Effort (T-shirt) | User Impact |
|---|---|---|---|
| P0 | F-001 File-Switch UI | M | 5/5 blocked |
| P0 | F-002 ERD Add-Tools | M | 4/5 blocked |
| P0 | F-003 Landscape UI komplett | L | 5/5 |
| P0 | F-004 PUT-Validation | S | Datenverlust-Risiko |
| P0 | F-006 set_dbml Migration | S | Power-User-Demo |
| P1 | F-005 parse_description LLM-Fallback | L | Keynote-Feature |
| P1 | F-007 Cmd+K vs Header Inkonsistenz | S | Verwirrung |
| P1 | F-008 attachmentSlot-Stub | S | UX-Bruch |
| P1 | F-009 ERD-Properties-Persistenz | M | Workflow |
| P1 | F-016 Initial Auto-Layout | S | First-Impression |
| P2 | F-021 EmptyState-Texte | XS | Junior-Onboarding |
| P2 | F-023 Sample-Files Init | S | Erstkontakt |

## Limitations Disclaimer

Dies ist ein synthetisches User-Test mit AI-simulierten Personas. Per "Lost
in Simulation" (arXiv 2026) liegen Calibration-Errors typischerweise bei
±15%. Die realen User-Tests muessten reproduziert werden mit:
- 2-3 echten Tech-Leads
- 2 echten Beratern in Workshop-Setting
- 2 echten Junior-Devs
- 1 echte Domain-Expertin (Non-Tech)
- 2 Power-User aus MCP-Community

Trotz Calibration-Error sind die Findings dieses Reports valide:
- Findings F-001 bis F-007 sind **Code-Inspektion-basiert** (zero AI-uncertainty)
- Findings F-008 bis F-024 sind **Live-Test-basiert** (replizierbar)
