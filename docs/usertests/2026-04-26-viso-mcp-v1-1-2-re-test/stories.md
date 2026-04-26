# User Stories — viso-mcp v1.1.2 Re-Test (Connextra, INVEST-validated)

12 Stories aus den 30 Stories der v1.1.0-Baseline kuratiert — fokussiert auf
die 22 closed Findings. Jede Story hat ein `addressed_by`-Mapping zu CR/MA/MI-IDs.

---

## US-R01 — File-Switch ERD ↔ BPMN ↔ Landscape
**Als** KI-Berater (Anika)
**moechte ich** zwischen den 3 Use-Case-Files wechseln,
**damit** ich meinen kompletten Architektur-Workspace pflegen kann.
- INVEST: I:✓ N:✓ V:✓ E:✓ S:✓ T:✓
- Erwartung: AppSidebar zeigt 3 Sektionen (ERD, BPMN, Landscape); Tabs bleiben sichtbar
- **addressed_by:** CR-1
- **Status (v1.1.2):** ✓ closed (alle Tabs initial offen, AppSidebar gemounted)

## US-R02 — ERD-Tabelle per Klick erstellen
**Als** Daten-Analystin (Lina)
**moechte ich** mit Tool `5` (Table) auf den Canvas klicken,
**damit** ich ohne Code-Panel eine Tabelle setze.
- INVEST: I:✓ N:✓ V:✓ E:✓ S:✓ T:✓
- Erwartung: Click-to-Place erzeugt Tabelle mit Default-Spalten
- **addressed_by:** CR-2
- **Status (v1.1.2):** ✓ closed (ToolPalette + Cmd+K + erdPaneClick)

## US-R03 — Landscape per UI bauen
**Als** Workshop-Moderator (Christoph)
**moechte ich** Person `6`, System `7`, External `8`, Container `9`, Database `0` per Klick spawnen,
**damit** ich live im Workshop ein C4-Diagramm baue.
- INVEST: I:✓ N:✓ V:✓ E:✓ S:✓ T:✓
- **addressed_by:** CR-3
- **Status (v1.1.2):** ✓ closed (5 Landscape-Tools, AppSidebar-Sektion, DiagramTabs-Icon)

## US-R04 — Server lehnt kaputten Input ab
**Als** Auditorin (Inga)
**moechte ich**, dass `PUT /__viso-api/source` mit invalidem JSON 400 + RFC-7807 zurueckgibt,
**damit** mein Audit-Trail keine korrupten Files enthaelt.
- INVEST: I:✓ N:✓ V:✓ E:✓ S:✓ T:✓
- Erwartung: 400 + `application/problem+json`, Original-File unveraendert
- **addressed_by:** CR-4
- **Status (v1.1.2):** ✓ closed (`writeValidatedRawBody`, atomic-rename-write)

## US-R05 — DE-Narrative wird zu Diagramm
**Als** KI-Berater (Anika)
**moechte ich** "Kunden haben mehrere Bestellungen" eingeben → 2 Tabellen + 1:N-Relation,
**damit** ich Workshop-Notizen direkt visualisiere.
- INVEST: I:✓ N:✓ V:✓ E:✓ S:✓ T:✓
- Erwartung: DE-Patterns greifen; LLM-Fallback aktivierbar via `VISO_LLM_PARSE=true`
- **addressed_by:** CR-5
- **Status (v1.1.2):** ✓ closed (5 ERD + 6 BPMN DE-Patterns + LLM-Adapter)

## US-R06 — `set_dbml` migriert JSON-Mode automatisch
**Als** Daten-Analystin (Lina)
**moechte ich**, dass `set_dbml` bei `*.erd.json` automatisch zu DBML migriert,
**damit** Power-User-Demo nicht beim ersten Aufruf bricht.
- INVEST: I:✓ N:✓ V:✓ E:✓ S:✓ T:✓
- Erwartung: Output enthaelt `migrated: true`, `oldPath`, `newPath`
- **addressed_by:** CR-6
- **Status (v1.1.2):** ✓ closed (Auto-Migration + `init --format=dbml|json`)

## US-R07 — Cmd+K und Header-Dropdown bieten gleiche Exporte
**Als** KI-Berater (Anika)
**moechte ich** in Cmd+K alle 6 Export-Optionen finden (bundle, mermaid, sql, dbml, svg, png),
**damit** Tastatur- und Maus-Workflow konsistent sind.
- INVEST: I:✓ N:✓ V:✓ E:✓ S:✓ T:✓
- Erwartung: Single Source of Truth via `EXPORT_OPTIONS`
- **addressed_by:** CR-7
- **Status (v1.1.2):** ✓ closed (`src/preview/components/shell/export-options.ts`)

## US-R08 — ERD-Properties-Edits sind persistent
**Als** Daten-Analystin (Lina)
**moechte ich**, dass ich Spaltennamen und Tabellen-Description im PropertiesPanel aendern kann
und sie nach Reload erhalten bleiben.
- INVEST: I:✓ N:✓ V:✓ E:✓ S:✓ T:✓
- Erwartung: handleUpdateNode persistiert ERD- und Landscape-Edits via JSON-Patch
- **addressed_by:** MA-2
- **Status (v1.1.2):** ✓ closed (Commit 0f9cb81)

## US-R09 — ERD-API-Routes mit `/erd/`-Prefix (mit Backwards-Compat)
**Als** Daten-Analystin (Lina)
**moechte ich** `/__viso-api/erd/source` als kanonische Route + `/__viso-api/source` als Alias,
**damit** alle 3 Use Cases die gleiche URL-Struktur haben.
- INVEST: I:✓ N:✓ V:✓ E:✓ S:✓ T:✓
- **addressed_by:** MA-5
- **Status (v1.1.2):** ✓ closed (Commit 56947ae)

## US-R10 — In-Memory Bundle-Roundtrip
**Als** Auditorin (Inga)
**moechte ich** `export_bundle({ inMemory: true })` → Bytes → `import_bundle({ bytes })`,
**damit** ich CI-Pipelines ohne Filesystem-Detour fahre.
- INVEST: I:✓ N:✓ V:✓ E:✓ S:✓ T:✓
- **addressed_by:** MA-6
- **Status (v1.1.2):** ✓ closed (Commit 6ca1573)

## US-R11 — Bundle-Default mit PNG
**Als** Workshop-Moderator (Christoph)
**moechte ich**, dass `export_bundle` standardmaessig PNG enthaelt,
**damit** Beamer-Foto-Handoff direkt funktioniert.
- INVEST: I:✓ N:✓ V:✓ E:✓ S:✓ T:✓
- Erwartung: Default `includePng: true`, opt-out via Param
- **addressed_by:** MA-8
- **Status (v1.1.2):** ✓ closed (puppeteer-optional, Commit f28ab2f)

## US-R12 — Auto-Layout initial + ERD-Add-Column im PropertiesPanel + Landscape-Mode-Toggle
**Als** Workshop-Moderator (Christoph) + Daten-Analystin (Lina)
**moechte ich** beim ersten File-Mount Auto-Layout (kein Knoten-Stack auf 0,0),
"+ Add Column"-Button im ERD-PropertiesPanel
und Mode-Toggle L1/L2 fuer Landscape im TopHeader,
**damit** Live-Demo + Datenmodellierung + C4-Detail-Wechsel ohne Code-Panel laufen.
- INVEST: I:✓ N:✓ V:✓ E:✓ S:✓ T:✓
- **addressed_by:** MA-9, MA-10, MA-11
- **Status (v1.1.2):** ✓ alle drei closed (Commits de4df04, 22036e2, 3f06957)

---

## Mapping-Matrix Story → Finding-IDs

| Story | Finding | Persona | v1.1.2-Status |
|---|---|---|---|
| US-R01 | CR-1 | P1 Anika | ✓ closed |
| US-R02 | CR-2 | P3 Lina | ✓ closed |
| US-R03 | CR-3 | P4 Christoph | ✓ closed |
| US-R04 | CR-4 | P5 Inga | ✓ closed |
| US-R05 | CR-5 | P1 Anika | ✓ closed |
| US-R06 | CR-6 | P3 Lina | ✓ closed |
| US-R07 | CR-7 | P1 Anika | ✓ closed |
| US-R08 | MA-2 | P3 Lina | ✓ closed |
| US-R09 | MA-5 | P3 Lina | ✓ closed |
| US-R10 | MA-6 | P5 Inga | ✓ closed |
| US-R11 | MA-8 | P4 Christoph | ✓ closed |
| US-R12 | MA-9, MA-10, MA-11 | P4 + P3 | ✓ alle closed |

Nicht-Story-abgedeckt aber im Re-Test verifiziert:
- MI-1 (EmptyState ohne MCP-Tool-Namen) — closed in v1.1.1
- MI-2 (i18n EN-Schale) — closed in v1.1.2
- MI-4 (KNOTEN/BEZEICHNUNG → TYP/NAME) — closed in v1.1.2
- MA-1, MA-3, MA-4, MA-7, MA-12 — closed in v1.1.1

Verbleibend (NICHT im Story-Set, da kosmetisch / partial):
- MI-3 (Sample-Files .gitignored) — partial, durch `init --with-samples` gemildert
- MA-13 / Performance-Beobachtung — siehe report.md "Top 3 verbleibende Findings"
