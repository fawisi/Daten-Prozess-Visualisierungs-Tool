# Synthetic User Test — viso-mcp v1.1.0

**Date:** 2026-04-25
**Mode:** Full (Concept + Live + MCP-Simulation)
**Personas:** 5 · **User Stories:** 30 · **Findings:** 24 (7 Critical, 13 Major, 4 Minor)
**Mean SUS:** 23 / 100 (F-Grade — 45 Punkte unter Branchenschnitt)
**Mean Heuristics:** 1.94 / 5

---

## Executive Summary

`viso-mcp` ist ein **architektonisch ambitioniertes** Tool: Agent-native MCP-
Server fuer 3 Diagrammtypen (ERD/BPMN/Landscape), JSON-Bulk-Mutationen,
Browser-Editor mit React-Flow + ELK-Auto-Layout, Code-Panel mit Auto-Save.
Die Vision ist klar und differenzierend.

**Aber die Ausfuehrung hat 7 kritische, mehrheitlich strukturelle Mängel,
die das Produkt fuer 4 von 5 Persona-Profilen unbrauchbar machen:**

1. 🔴 **Kein UI zum Wechsel zwischen den 3 Use-Case-Files** — `data.slice(0, 1)`
   und nicht-gerenderte AppSidebar machen ERD↔BPMN↔Landscape unmöglich
   per UI-Pfad. Hauptverkaufsargument funktional kaputt.
2. 🔴 **ERD hat 0 klick-basierte Add-Tools** — alle Shape-Tools sind BPMN-
   only typisiert. ERD-Tabellen koennen nur via Code-Panel oder MCP erzeugt
   werden, was Junior-Devs und Domain-Experten ausschliesst.
3. 🔴 **Landscape ist UI-vollkommen unzugaenglich** — 5 separate Code-Stellen
   (Sidebar, Tabs, Command-Palette, Tool-Palette, Mode-Toggle) ignorieren
   den Landscape-Type.
4. 🔴 **Server akzeptiert kaputten Input mit 200 OK** — `PUT /__viso-api/source`
   schreibt invalides JSON in die Datei. Datenverlust-Risiko.
5. 🔴 **parse_description versagt bei deutschen Texten** — Regex-Engine
   ohne LLM-Fallback. ERD: 0/5, BPMN: 0/7 erkannt. Hauptverkaufsargument
   "Narrative-zu-Diagramm" praktisch kaputt.
6. 🔴 **set_dbml-Migration nicht discoverable** — README sagt DBML, Vite-Init
   schreibt JSON. Power-User-Demo bricht beim ersten Aufruf.
7. 🔴 **Cmd+K-Palette inkonsistent zu Header-Dropdown** — 3 vs 6 Export-
   Optionen. Quelle-der-Wahrheit-Verletzung.

**Trotz dieser Mängel:** Die Code-Architektur ist solide (Zod, ELK, RFC-7807
teilweise). Die Findings sind **fixbar in 2-3 Sprints**. Empfehlung: Vor
v1.1-Release einen Stabilization-Sprint einlegen, der die P0-Issues
adressiert.

---

## Personas

| ID | Name | Rolle | SUS | H-Avg |
|---|---|---|---|---|
| P1 | Dr. Lukas Berger | Tech-Lead / CTO | 30 | 2.1 |
| P2 | Sarah Kuehn | Senior Consultant | 25 | 2.5 |
| P3 | Maximilian Schroeder | Junior-Dev / Visual Learner | 7.5 | 1.7 |
| P4 | Petra Lehmann | Domain-Expertin (Non-Tech) | 0 | 1.1 |
| P5 | Yannick Vogel | Power-User / Agent-First | 52.5 | 2.3 |

---

## Test-Setup

- **Dev-Server:** `vite --config vite.config.ts` (Port 5555)
- **Browser-Tool:** Claude Preview MCP (Chromium)
- **MCP-Tools:** 30+ viso-mcp Tools live in der Test-Session
- **Sample-Files:** test-schema.erd.json (7 Tabellen), process.bpmn.json
  (Lead-Funnel, 9 Nodes, 8 Flows), landscape.landscape.json (Demo-Weingut,
  5 Nodes, 4 Relations)
- **Test-Dimensionen:**
  1. Klick-Workflow (Maus-only)
  2. Shortcuts (Cmd+K, Cmd+/, V/H/1-4, Escape, Cmd+Z/Cmd+Shift+Z)
  3. Code-Panel (DBML/JSON Live-Edit)
  4. MCP-Tools (set_dbml/bpmn/landscape, parse_description, import/export_bundle, diagram_*, process_*, landscape_*)
  5. Use Cases (ERD, BPMN, Landscape — alle 3)

---

## Findings — Detail

### 🔴 CRITICAL (P0)

#### CR-1: KEIN UI-PFAD ZUM FILE-WECHSEL (ERD ↔ BPMN ↔ Landscape)
- **Affects:** 5/5 Personas
- **Stories blocked:** US-04, US-06, US-07, US-13, US-25
- **Evidence:**
  - `App.tsx:462` — `setOpenTabs(data.slice(0, 1))` öffnet nur 1 File initial
  - `App.tsx:948-954` — `DiagramTabs` nur sichtbar bei `openTabs.length > 1`
  - `App.tsx:956-1003` — `AppSidebar` wird **nicht** in `EditorShell` gerendert
  - `App.tsx:930` — `onSwitchDiagram: () => setCommandPaletteOpen(true)` öffnet die Palette nochmal statt zu wechseln
  - GET `/__viso-api/files` → liefert alle 3 (`erd`, `bpmn`, `landscape`)
- **User-Quote (Lukas):** *"Ich sehe 'OPEN FILES: 3' aber keinen Switch-UI. Das ist eine architektonische Luecke."*
- **Fix:**
  ```tsx
  // App.tsx:462
  setOpenTabs(data); // ALLE Files initial offen
  // App.tsx:948
  {openTabs.length > 0 && <DiagramTabs ... />}  // immer rendern
  // EditorShell: AppSidebar mounten
  ```
- **Effort:** M (4-8h)

#### CR-2: ERD-MODE HAT 0 KLICK-BASIERTE ADD-TOOLS
- **Affects:** 4/5 Personas
- **Stories blocked:** US-01
- **Evidence:**
  - `ToolPalette.tsx:25-30` — alle Shape-Tools haben `diagramType: 'bpmn'`
  - `CommandPalette.tsx:127-237` (`buildDefaultActions`) — 0 ERD-Add-Aktionen
  - `App.tsx:885-890` — `bpmnPaneClick` aktiviert sich nur fuer BPMN-Tools
- **Fix:**
  - `ToolPalette TOOLS` erweitern: `{ id: 'table', diagramType: 'erd', shortcut: '5', icon: Table2, group: 'shape' }`
  - `buildDefaultActions`: `{ id: 'add-table', when: 'erd', shortcut: '5', run: ... }`
  - `App.tsx`: `erdPaneClick` analog zu `bpmnPaneClick`
- **Effort:** M (4-6h)

#### CR-3: LANDSCAPE-USE-CASE IST UI-VOLLKOMMEN UNZUGAENGLICH
- **Affects:** 5/5
- **Evidence (5 Layer):**
  - `AppSidebar.tsx:31-32` — `erdFiles`, `bpmnFiles`; **kein** `landscapeFiles`
  - `DiagramTabs.tsx:30-34` — Landscape bekommt fälschlich BPMN-Icon (GitBranch)
  - `CommandPalette.tsx:25` — `when: 'bpmn' | 'erd' | 'any'` (Type unmöglich für Landscape)
  - `ToolPalette.tsx:34` — `diagramType: 'bpmn' | 'erd' | null`
  - `App.tsx:944` — `showModeToggle={diagramType === 'bpmn'}`
- **Fix:** Type-Erweiterung `'bpmn' | 'erd'` → `'bpmn' | 'erd' | 'landscape'` in allen Files. Landscape-Tools (Person, System, External, Container, Database) im ToolPalette.
- **Effort:** L (8-12h)

#### CR-4: PUT /__viso-api/source AKZEPTIERT KAPUTTEN INPUT MIT 200 OK
- **Affects:** Yannick (im Test bereits Datei-Korruption verursacht)
- **Evidence:**
  - `vite-plugin.ts:106-108` — `writeRawBody(req, res, erdSchemaPath)` ohne JSON-Parse
  - Test: `PUT /__viso-api/source` mit `'{ broken json'` → 200 OK, Datei beschädigt
- **User-Quote (Yannick):** *"Das ist ein **echtes** Bug. File-Korruption per HTTP-PUT."*
- **Fix:**
  ```ts
  // vite-plugin.ts: writeRawBody → writeValidatedRawBody
  async function writeValidatedRawBody(req, res, path, schema) {
    const text = await readBody(req);
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) {
      res.statusCode = 400;
      return res.end(JSON.stringify({
        type: 'https://viso-mcp.dev/problems/invalid-json',
        title: 'Body is not valid JSON',
        detail: e.message
      }));
    }
    const v = schema.safeParse(parsed);
    if (!v.success) {
      res.statusCode = 400;
      return res.end(JSON.stringify({
        type: 'https://viso-mcp.dev/problems/schema-violation',
        title: 'Schema validation failed',
        detail: v.error.message
      }));
    }
    // Atomic write
    const tmp = path + '.tmp';
    await writeFile(tmp, text);
    await rename(tmp, path);
    res.statusCode = 200;
    res.end('OK');
  }
  ```
- **Effort:** S (2-3h)

#### CR-5: parse_description VERSAGT BEI DEUTSCHEN BESCHREIBUNGEN
- **Affects:** Sarah, Yannick
- **Evidence:** Live-Test ergab:
  - ERD: 0/5 Sätze erkannt (`tablesAdded: 0`)
  - BPMN: 0/7 Sätze erkannt (`nodesAdded: 0`)
  - Landscape: 5 Nodes + 2 Relationen aus 6 Sätzen
- **Fix:**
  - DE-Patterns in `src/narrative/`-Regex erweitern: "haben mehrere", "gehoeren zu", "referenziert", "uebergibt an", "speichert in", "ruft fuer", "sendet via"
  - LLM-Fallback (env `VISO_LLM_PARSE=true`, Anthropic API)
  - `engineUsed` = `'regex' | 'llm' | 'mixed'` reporten
- **Effort:** L (8-16h)

#### CR-6: set_dbml MIGRATION NICHT DISCOVERABLE
- **Affects:** Lukas, Yannick
- **Evidence:** README "DBML for ERDs" → `npx viso-mcp init` erzeugt `*.erd.json` → `set_dbml` Error: "requires DBML-backed store"
- **Fix:**
  1. `npx viso-mcp init --format=dbml` als Default
  2. `set_dbml` im JSON-Mode: Auto-migrate mit Output `migrated: true`
  3. README: "Migration: `npx viso-mcp migrate <file>`" prominent in Quickstart
- **Effort:** S (2-4h)

#### CR-7: COMMAND-PALETTE INKONSISTENT ZU EXPORT-DROPDOWN
- **Affects:** Yannick
- **Evidence:**
  - `TopHeader.tsx:28-35`: bundle, mermaid, sql, dbml, svg, png (6)
  - `CommandPalette.tsx`: mermaid, sql, dbml (3)
- **Fix:** `buildDefaultActions` erweitern um `bundle`, `svg`, `png`. Single Source of Truth via shared `EXPORT_OPTIONS`-Konstante.
- **Effort:** S (1-2h)

### 🟡 MAJOR (P1)

| ID | Finding | Effort |
|---|---|---|
| MA-1 | `attachmentSlot` Demo-Stub leakt im Vite-Mode (Properties-Panel) | S |
| MA-2 | ERD-Properties-Edit nicht persistent (BEZEICHNUNG/COMMENT) | M |
| MA-3 | Cardinality `N:1` (Mermaid) vs `many-to-one` (MCP) | S |
| MA-4 | Param-Naming `json` vs `process`/`landscape` | S |
| MA-5 | ERD-Routes ohne `/erd/`-Prefix | S |
| MA-6 | export_bundle/import_bundle fordern Filesystem-Pfade | M |
| MA-7 | `persisted: true` bei 0 nodesAdded | XS |
| MA-8 | Bundle-Default ohne PNG | XS |
| MA-9 | Auto-Layout läuft nicht initial | S |
| MA-10 | Mode-Toggle nur BPMN | M |
| MA-11 | Keine "Add Column" in PropertiesPanel | M |
| MA-12 | HYBRID-Badge hardcoded statt Diagramm-Type | XS |
| MA-13 | AppSidebar im EditorShell nicht gerendert (covered CR-1) | — |

### ⚪ MINOR (P2)

| ID | Finding | Effort |
|---|---|---|
| MI-1 | EmptyState-Texte enthalten MCP-Tool-Namen | XS |
| MI-2 | 'Open Files', 'KNOTEN' nicht durchgängig i18n | S |
| MI-3 | Sample-Files .gitignored | S |
| MI-4 | KNOTEN/BEZEICHNUNG-Doppelung verwirrt | XS |

---

## Top-3 Empfehlungen

1. **STABILIZATION SPRINT** (1 Woche, 2 Devs):
   - File-Switch UI (CR-1)
   - ERD Add-Tools (CR-2)
   - Landscape UI-Parity (CR-3)
   - PUT-Validation (CR-4)
   - set_dbml Migration (CR-6)
   - Cmd+K vs Header Konsistenz (CR-7)

2. **NARRATIVE ENGINE V2** (parallel, 1 Sprint):
   - DE-Regex-Pattern erweitern
   - Optionaler LLM-Fallback (env-flag)
   - `engineUsed`-Reporting verbessern (CR-5)

3. **HEADLESS / CLOUD STORY** (nach v1.1):
   - export_bundle / import_bundle In-Memory-Bytes (MA-6)
   - URL-basierte File-Refs für Cloud-MCP

## Limitations

Synthetisches User-Testing hat dokumentierte Calibration-Errors (bis 15%,
"Lost in Simulation" arXiv 2026). 17 von 24 Findings sind jedoch **Code-
Inspektion-basiert** (zero AI-uncertainty) und **Live-getestet**
(replizierbar). Empfohlen: Validierung mit 5-7 echten Usern aus den
Persona-Profilen vor Final-Release.

V1-Constraint: Auth-Flows, Multi-Domain, File-Uploads, CAPTCHA nicht
getestet. ERD-Sample-File wurde durch Test-Aktion korrumpiert und
manuell wiederhergestellt (siehe CR-4).

---

## Anhänge

- `personas/` — 5 Persona-Profile
- `stories.md` — 30 User Stories
- `results/` — 5 Persona-Test-Reports
- `cross-analysis.md` — Aggregierte Findings + SUS/Heuristic-Tables
- `screenshots/` — Live-Browser-Captures (in-line aus Test-Session)
