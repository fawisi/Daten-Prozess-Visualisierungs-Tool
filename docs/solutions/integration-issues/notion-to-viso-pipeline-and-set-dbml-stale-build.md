---
title: Notion-Wissensgraph als ERD und Landscape via viso-mcp visualisieren
date: 2026-04-29
problem_type: integration_issue
component: viso-mcp + notion-mcp
symptoms:
  - set_dbml schlaegt fehl mit "unsupported-backing-store" / "requires a DBML-backed store" — obwohl die Source bereits Auto-Migration (v1.1.2 CR-6) hat
  - Kein direkter Workflow Notion-DB-Schema -> ERD; Schema muss aus notion-fetch-Output rekonstruiert werden
  - dist/server.cjs ist aelter als src/tools.ts → MCP-Server faehrt mit veraltetem Build
tags:
  - mcp
  - notion
  - viso
  - erd
  - landscape
  - dbml
  - stale-build
  - workaround
related_issues: []
status: solved
verified: true
---

## Problem

Aufgabe: TAFKA-Architektur und Wissensgraph aus Notion in viso-mcp als Landscape und ERD spiegeln.

Zwei Probleme dabei:

1. **`set_dbml` brach mit RFC-7807 Problem-Detail ab:**
   ```json
   {
     "type": "https://viso-mcp.dev/problems/unsupported-backing-store",
     "title": "set_dbml requires a DBML-backed store",
     "detail": "The current ERD file is not a .dbml file. Run `npx viso-mcp migrate <file>` to switch to DBML first."
   }
   ```

2. **Kein dokumentierter Notion → viso Pfad:** Notion-Datenbanken haben Schema-Infos in `notion-fetch`-Outputs (data-source-state und sqlite-table), aber die Brücke zu viso-Tabellen muss man selbst bauen.

## Root Cause

**Stale Build.** Source-Code in [src/tools.ts:395-424](../../../src/tools.ts) hat seit v1.1.2 (CR-6) eine **Auto-Migration**: bei JSON-backed Stores ruft `set_dbml` automatisch `migrateFile()` auf und swappt die Store-Reference auf `DbmlStore`. Der laufende MCP-Server fuhr aber mit `dist/server.cjs` vom 25.04., während `src/tools.ts` am 26.04. aktualisiert wurde — der gebaute Server kannte die Auto-Migration noch nicht.

Sekundär: Wer bei `viso-erd-v1` JSON bleiben will (z. B. wegen einfacher Inspektion via `cat`/`jq` oder fehlender DBML-Toolchain), hat aktuell keinen offiziellen Schreib-Endpoint dafür. Das Format ist aber stabil und wird vom Server geladen, wenn man die Datei direkt schreibt.

## Working Solution

### Schritt 1: Notion-Datenbanken finden

```js
// Hub-Page suchen
mcp__notion__notion-search({
  query: "TAFKA Wissensgraph",
  query_type: "internal",
  filters: {},
  content_search_mode: "workspace_search",
  page_size: 10
})
// → page-IDs + URLs

// Hub fetchen, dann data-source-URLs aus den <database>-Tags ziehen
mcp__notion__notion-fetch({ id: "<hub-page-id>" })
// → Liste mit data-source-url="collection://<uuid>"
```

### Schritt 2: Schemas extrahieren

Jeder `notion-fetch` mit `id: "collection://..."` liefert zwei Schema-Quellen:

- **`<data-source-state>`** — vollständiges Property-Schema mit `type` (`title`/`text`/`select`/`number`/`date`/`relation`/`formula`/`file`/`multi_select`)
- **`<sqlite-table>`** — DB-Schema-Sicht mit Spalten + Hinweisen auf Relations:

```text
"🗄️ Sektoren" TEXT, -- JSON array of page URLs relating to {{collection://...}}
```

Daraus lassen sich Tabellen, Spaltentypen und M:N-Beziehungen 1:1 ableiten.

### Schritt 3: Landscape bauen via `set_landscape`

`set_landscape` funktioniert atomar — keine Build-Probleme:

```js
mcp__viso-mcp__set_landscape({
  json: JSON.stringify({
    format: "viso-landscape-v1",
    name: "TAFKA Operations",
    nodes: {
      "Fabian":   { kind: "person",   label: "Fabian (GF Tech)" },
      "TAFKA_HQ": { kind: "system",   label: "TAFKA HQ (Notion-Hub)" },
      "OpenAI":   { kind: "external", label: "OpenAI (Whisper, GPT)" }
    },
    relations: [
      { from: "Fabian",   to: "TAFKA_HQ", label: "fuehrt" },
      { from: "TAFKA_HQ", to: "OpenAI",   label: "Whisper-Transkription" }
    ]
  })
})
// → { ok: true, nodeCount: 3, relationCount: 2 }
```

Erlaubte `kind`-Werte: `person`, `system`, `external`, `container`, `database`, `cloud`, `boundary`.

### Schritt 4: ERD bauen — Primärer Fix

```bash
# Build aktualisieren, damit Auto-Migration greift
cd <viso-mcp-projekt>
npm run build

# Danach kann set_dbml den .erd.json -> .dbml automatisch migrieren
```

Dann normaler `set_dbml`-Aufruf:

```js
mcp__viso-mcp__set_dbml({
  dbml: `
    Table Use_Cases {
      id uuid [pk]
      name varchar [not null]
      ai_pattern varchar
    }
    Table Sektoren {
      id uuid [pk]
      name varchar
    }
    Ref: Use_Cases.sektor_id > Sektoren.id
  `
})
// → migrationInfo: { migrated: true, oldPath: "schema.erd.json", newPath: "schema.dbml" }
```

### Schritt 4b: Fallback — direct JSON-Write

Wer DBML nicht nutzen will (oder den Build nicht aktualisieren kann), schreibt direkt das `viso-erd-v1` JSON in das ERD-File aus `launch.json`:

```json
{
  "format": "viso-erd-v1",
  "name": "TAFKA Wissensgraph",
  "tables": {
    "Use_Cases": {
      "description": "KI-Anwendungsfaelle (HUB)",
      "columns": [
        { "name": "id",         "type": "uuid",   "primary": true },
        { "name": "name",       "type": "varchar(255)", "nullable": false },
        { "name": "ai_pattern", "type": "varchar(32)" }
      ]
    },
    "J_UC_Tool": {
      "description": "M:N Junction Use_Case <-> Tool",
      "columns": [
        { "name": "use_case_id", "type": "uuid", "primary": true },
        { "name": "tool_id",     "type": "uuid", "primary": true }
      ]
    }
  },
  "relations": [
    {
      "from": "J_UC_Tool", "fromColumn": "use_case_id",
      "to":   "Use_Cases", "toColumn":   "id",
      "cardinality": "N:1"
    }
  ]
}
```

Pfad-Quelle: `.claude/launch.json` → `env.VISO_FILE` (z. B. `./test-schema.erd.json`). Atomic schreiben (Write-Tool), Browser zieht via HMR nach.

### Schritt 5: Browser-Preview verifizieren

```js
// Server starten
mcp__Claude_Preview__preview_start({ name: "preview" })
// → port 5555

// Tab-Switch (Tab-Buttons haben echte Mouse-Event-Handler, nicht nur .click())
mcp__Claude_Preview__preview_eval({
  expression: `
    const tab = [...document.querySelectorAll('button')]
      .find(b => b.innerText?.startsWith('test-schema.erd'));
    const r = tab.getBoundingClientRect();
    const opts = { bubbles:true, clientX: r.left + 50, clientY: r.top + r.height/2 };
    ['pointerdown','mousedown','pointerup','mouseup','click']
      .forEach(t => tab.dispatchEvent(new MouseEvent(t, opts)));
  `
})

// Auto-Layout + Fit-View
mcp__Claude_Preview__preview_eval({
  expression: `
    document.querySelector('button:has(span:contains("Auto-Layout"))')?.click();
    setTimeout(() => document.querySelector('.react-flow__controls-fitview')?.click(), 800);
  `
})

// Visuell verifizieren
mcp__Claude_Preview__preview_screenshot({ serverId: "..." })
```

## Prevention & Best Practices

### Vor dem nächsten `set_dbml`-Aufruf

1. **Build-Check:** `stat dist/server.cjs src/tools.ts` — wenn `src/` neuer ist als `dist/`, erst `npm run build`.
2. **Backing-Store-Check:** Aus der `.mcp.json` das `--file`-Argument lesen — `.dbml` oder `.erd.json` entscheidet den Pfad.
3. **DBML vorab parsen:** Bei komplexen Schemas (>15 Tabellen) lokal mit `@dbml/core` validieren, bevor `set_dbml` aufgerufen wird.

### Notion → viso-Pipeline-Regeln

- **data-source-URLs einzeln validieren** vor dem Mass-Fetch (HEAD via `notion-fetch` mit einer einzigen ID).
- **Browser-Preview ist die finale Verifikation** — kein "Done" ohne visuellen Check + Auto-Layout.
- **Nur Tabellen/Knoten aufnehmen, die echte Properties haben** — leere Notion-DBs vorher rausfiltern, sonst rauscht das ERD voll mit Geistern.
- **Relations beidseitig prüfen** (Source und Target müssen im Schema existieren), sonst kaputter ERD-State.
- **M:N immer als Junction-Tabelle modellieren** — viso-erd-v1 hat keine native M:N, nur 1:N-Refs.

### Wann welcher viso-mcp-Schreib-Pfad?

| Backing Store    | Tool                  | Build-Voraussetzung      |
|------------------|-----------------------|--------------------------|
| `.dbml`          | `set_dbml`            | egal                     |
| `.erd.json` v1.1.2+ | `set_dbml` (Auto-Migration) | aktueller Build erforderlich |
| `.erd.json` v1.1.1- | direct file write     | keine                    |
| `.landscape.json`| `set_landscape`       | egal                     |
| `.bpmn.json`     | `set_bpmn`            | egal                     |

### Test-Cases zur Verhinderung

- **Smoke-Test:** `diagram_get_schema` direkt nach `set_landscape`/Write — Tabellen- und Relations-Count gegen Erwartung prüfen.
- **Build-Freshness-Test:** CI-Step `[ src/tools.ts -ot dist/server.cjs ]` — bricht ab, wenn dist veraltet ist.
- **Roundtrip-Test:** JSON schreiben → `diagram_get_schema` lesen → Diff gegen geschriebene Daten — schlägt früh bei Schema-Drift an.
- **Notion-Fixture-Test:** Eine leere und eine volle DB als Fixture, um Filter-Logik abzusichern.

## Related Docs & Cross-References

### Im Repo

- [README.md](../../../README.md) — `set_dbml` Auto-Migration Beschreibung
- [CHANGELOG.md](../../../CHANGELOG.md) — v1.1.1 CR-6 (set_dbml Auto-Migration), v1.0.0 Format-Rename `daten-viz-erd-v1` → `viso-erd-v1`
- [docs/migration-guide.md](../../migration-guide.md) — JSON → DBML Migration
- [src/tools.ts:395-424](../../../src/tools.ts) — `set_dbml` Auto-Migration-Implementierung
- [src/store.ts](../../../src/store.ts) — `DiagramStore` (legacy JSON) vs `DbmlStore`
- [docs/brainstorms/2026-04-22-viso-mcp-funktional-roadmap-brainstorm.md](../../brainstorms/2026-04-22-viso-mcp-funktional-roadmap-brainstorm.md) — D14 Notion-Wissensgraph als Hub-Feature
- [docs/plans/2026-04-22-feat-viso-mcp-v1.1-plan.md](../../plans/2026-04-22-feat-viso-mcp-v1.1-plan.md) — Notion-Brücke geplant

### Externe Bezüge

- `~/Documents/Claude_Code/CLAUDE.md` — TAFKA-Business-Kontext
- TAFKA_Wissensgraph-Repo — Notion-MCP-Patterns (Karpathy-Pattern, Token-Reduktion)

### Verwandte Konzepte

- `viso-erd-v1` JSON-Format vs DBML — JSON ist expliziter für M:N (Junction-Tables), DBML ist kompakter
- `launch.json` env-Variablen — `VISO_FILE`, `VISO_BPMN_FILE`, `VISO_LANDSCAPE_FILE` (alte Namen: `DATEN_VIZ_*`)
- RFC-7807 `application/problem+json` — viso-mcp nutzt das durchgängig für Tool-Errors

## Merksatz

Wenn `set_dbml` `unsupported-backing-store` wirft: **erst `npm run build` versuchen** (Auto-Migration ist seit v1.1.2 in der Source). Wenn man bewusst bei JSON bleiben will: `viso-erd-v1` direkt ins ERD-File schreiben — atomar, reversibel, Junctions explizit.
