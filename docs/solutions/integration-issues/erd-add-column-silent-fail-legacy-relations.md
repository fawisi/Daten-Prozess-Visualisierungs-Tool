---
title: ERD "Spalte hinzufuegen" tut nichts — Legacy-Relations brechen Zod-Validation
date: 2026-04-29
problem_type: integration_issue
component: viso-mcp preview/App.tsx + useDiagramSync
symptoms:
  - Im Properties-Panel "+ Spalte hinzufuegen" geklickt; Inspector zeigt neue Spalte; Canvas-Tabelle bleibt unveraendert
  - Keine Fehlermeldung im UI, keine Console-Warnung — nur Stille
  - Network-Tab zeigt GET /__viso-api/erd/source, aber kein nachfolgendes PUT
  - Edges zwischen Tabellen sind unsichtbar, obwohl `relations` im Source-File stehen
  - Tritt bei aelteren ERD-Files und allen Notion-Pipeline-Outputs auf
tags:
  - erd
  - properties-panel
  - zod-validation
  - silent-failure
  - schema-migration
  - notion-pipeline
  - legacy-format
related_issues:
  - docs/solutions/integration-issues/notion-to-viso-pipeline-and-set-dbml-stale-build.md
status: solved
verified: true
fixed_in_commit: 05f953e
fixed_in_branch: fix/edges-create-delete-broken
---

## Problem

Reproduzierbar mit jedem ERD-File, das `relations` im v1.0-Format enthaelt:

1. ERD-Tab oeffnen, Tabelle anklicken
2. Im Properties-Panel rechts "+ Spalte hinzufuegen" druecken
3. Inspector zeigt sofort `new_col` als neue Zeile (lokaler React-State updated)
4. **Canvas-Tabelle links zeigt die neue Spalte nicht.** Nichts passiert visuell.
5. Reload zeigt: die Spalte ist auch nicht persistiert.

Gleicher Effekt bei jedem anderen Properties-Panel-Edit (Label-Rename, Status, Description) — die ERD-spezifischen Mutations gehen alle durch den gleichen `handleUpdateNode`-Pfad und scheitern still.

## Root Cause

`handleUpdateNode` in [src/preview/App.tsx](../../../src/preview/App.tsx) liest die Source-Datei, parsed JSON, validiert mit `DiagramSchema.safeParse(...)` — und returnt **silent** wenn die Validation fehlschlaegt:

```ts
const validated = DiagramSchema.safeParse(parsedDoc);
if (!validated.success) return;  // <-- silent abort, kein Log, kein Toast
applyErdTableUpdate(validated.data, id, update);
await handles.putSource(JSON.stringify(validated.data, null, 2));
```

Der Silent-Return war Absicht ([kieran-review B2](../../plans/2026-04-22-feat-viso-mcp-v1.1-plan.md): "a malformed file on disk should not be silently round-tripped"), aber er verschluckt auch **strukturell-aequivalente Legacy-Files**, die aus aelteren viso-Versionen oder dem Notion-Pipeline-Output stammen:

| v1.0-Form (Notion-Pipeline)              | v1.1-Form (canonical)                            |
|------------------------------------------|--------------------------------------------------|
| `from: "Junction_Problem_UC"`            | `from: { table: "Junction_Problem_UC", column: "problem_id" }` |
| `fromColumn: "problem_id"`               | (in `from` integriert)                           |
| `to: "Probleme"`                         | `to: { table: "Probleme", column: "id" }`        |
| `toColumn: "id"`                         | (in `to` integriert)                             |
| `cardinality: "N:1"`                     | `type: "many-to-one"`                            |

Zod rejected, weil `RelationSchema.from` ein Objekt erwartet aber einen String bekommt. Der Read-Pfad in `useDiagramSync.loadSchema` validierte _nicht_ und wuerstelte sich durch — `rel.from.table` wurde dort `undefined`, was die Edges unsichtbar machte (zweiter, unauffaelligerer Symptom-Strang).

## Investigation

Schritte, die NICHT zum Ziel gefuehrt haben:

1. **Properties-Panel-State debuggen** — die `addColumn`-Funktion war OK (Inspector zeigte ja die neue Spalte).
2. **`onUpdateNode`-Prop auf Schritt geprueft** — Callback war richtig verdrahtet.
3. **`handleUpdateNode` mit console.log instrumentieren** — bestaetigte Ein-/Ausgang in der ERD-Branch.

Was schliesslich gewirkt hat:

4. **Network-Tab inspizieren** waehrend Add-Column → GET `/__viso-api/erd/source` sichtbar, **kein** PUT. Damit war klar: Code laeuft bis `refreshSource`, aber bricht zwischen JSON.parse und `putSource` ab.
5. **Manuell `DiagramSchema.safeParse(<file>)`** im Browser ausgefuehrt → 5 Issues an `relations[*].from`/`to`/`type`.
6. **Source-File angeschaut** → 43 Relations alle in v1.0-Form mit `cardinality: "N:1"`.

## Working Solution

Drei Aenderungen — neue Util, zwei Call-Sites, ein Test-File. Commit [05f953e](../../../).

### 1. Neuer Normalizer

[src/preview/normalize-relations.ts](../../../src/preview/normalize-relations.ts) — mutiert in-place, returns same doc fuer Inline-Chaining. Nutzt `toLong()` aus dem bestehenden [src/cardinality.ts](../../../src/cardinality.ts) fuer das `1:1`/`1:N`/`N:1`/`N:N` → `one-to-one`/.../`many-to-many` Mapping.

```ts
export function normalizeRelations<T extends { relations?: unknown }>(doc: T): T {
  // ... iterates doc.relations, rewrites legacy shapes:
  //   from: "Tab", fromColumn: "col"  →  from: { table: "Tab", column: "col" }
  //   cardinality: "N:1"              →  type: "many-to-one"
  // Unbekannte Shapes werden NICHT angefasst, damit Zod sie weiter
  // ablehnen kann (kein "schluck alles still" Anti-Pattern).
}
```

### 2. Call-Site im Schreib-Pfad

[src/preview/App.tsx](../../../src/preview/App.tsx) `handleUpdateNode`, ERD-Branch — vor `safeParse` normalisieren, und bei trotzdem fehlgeschlagener Validation jetzt `console.error` statt silent return:

```ts
normalizeRelations(parsedDoc as { relations?: unknown });
const validated = DiagramSchema.safeParse(parsedDoc);
if (!validated.success) {
  console.error('[viso] ERD update aborted: source failed schema validation', validated.error.issues);
  return;
}
```

### 3. Call-Site im Lese-Pfad

[src/preview/hooks/useDiagramSync.ts](../../../src/preview/hooks/useDiagramSync.ts) `loadSchema` — normalisieren bevor `diagramToNodesAndEdges` die Edges baut. Bonus-Effekt: Edges werden jetzt auch fuer Legacy-Files korrekt gerendert.

```ts
const diagram: Diagram = normalizeRelations(raw?.data ?? raw);
```

### Migrations-Verhalten

Beim ersten Panel-Edit auf einer Legacy-Datei wird der gesamte Doc nach Normalisierung + Mutation als kanonische Form via `putSource` zurueckgeschrieben. Die Datei migriert sich **opportunistisch** — kein separater Migrations-Run noetig.

### Verifikation

1. Browser-Reload, Sektoren-Tabelle anklicken, Add-Column → Network: `PUT /__viso-api/erd/source → 200 OK`
2. Canvas-Node zeigt jetzt 8 Spalten incl. `new_col`
3. `relations[0]` in Source-File ist jetzt canonical: `{ from: { table: ..., column: ... }, to: ..., type: "many-to-one" }`
4. Edges zwischen Tabellen werden gerendert (vorher unsichtbar)
5. 6 neue Unit-Tests in [src/preview/normalize-relations.test.ts](../../../src/preview/normalize-relations.test.ts) gruen
6. 13 bestehende `node-update.test.ts` Tests gruen

## Prevention

### Regel 1 — Silent Returns sichtbar machen

Jeder `if (!validated.success) return;` in einem Handler ist ein potenzieller "Feature funktioniert nicht aber niemand merkt's"-Bug. Mindestens `console.error(validated.error.issues)`, ideal: User-facing Toast. Die kieran-review B2 Begruendung ("nicht silent ueberschreiben") gilt fuer den Datei-Write — nicht fuer das Logging.

### Regel 2 — Bei Schema-Bumps: Normalizer statt Hard-Reject

Wenn ein Schema verschaerft wird (v1.0 `cardinality: "N:1"` → v1.1 `type: "many-to-one"`), gehoert ein Read-Path-Normalizer dazu, **bevor** Files in produktiven Pipelines existieren. Spaeter nachgeruestet kostet Bug-Reports.

### Regel 3 — Pipeline-Outputs gegen das Canonical-Schema testen

Die Notion-Pipeline ([siehe verwandte Doku](./notion-to-viso-pipeline-and-set-dbml-stale-build.md)) emittierte v1.0-Format obwohl der Reader v1.1 erwartete. Idealerweise haengt am Pipeline-Ausgang ein Smoke-Test:

```ts
const result = DiagramSchema.safeParse(JSON.parse(pipelineOutput));
if (!result.success) throw new Error('Pipeline output drifted from schema');
```

### Test-Coverage

Neuer Test-File [normalize-relations.test.ts](../../../src/preview/normalize-relations.test.ts) deckt:

- Legacy → canonical Konversion
- Pass-Through fuer bereits-canonical Shape (Idempotenz)
- Alle 4 Cardinality-Mappings (1:1, 1:N, N:1, N:N)
- Cleanup der Legacy-Felder (`fromColumn`, `toColumn`, `cardinality` werden geloescht)
- Robustheit gegen unbekannte Shapes (passt-through, damit Zod sie sieht)
- `relations: undefined` und `relations: null`

## Cross-References

- Verwandte Doku: [Notion-zu-viso Pipeline + stale build](./notion-to-viso-pipeline-and-set-dbml-stale-build.md) — selber Legacy-Format-Pfad, anderer Symptom-Strang (set_dbml-Fehler)
- Schema-Definition: [src/schema.ts](../../../src/schema.ts) — `RelationSchema`, `DiagramSchema`
- Cardinality-Util: [src/cardinality.ts](../../../src/cardinality.ts) — `toLong()`, `toShort()`
- Original-Fix-Plan: [v1.1 plan](../../plans/2026-04-22-feat-viso-mcp-v1.1-plan.md) — kieran-review B2 Kontext fuer den Silent-Return
- Atomic-Write-Validierung: [src/preview/vite-validation.ts](../../../src/preview/vite-validation.ts) — `writeValidatedRawBody` rejected weiter Schema-Violations beim PUT (zweite Verteidigungslinie)
