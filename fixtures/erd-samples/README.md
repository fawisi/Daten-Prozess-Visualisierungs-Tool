# Reference ERD fixtures

These five DBML files exercise the `DbmlStore` roundtrip path and the
`viso-mcp migrate` CLI. Each sample targets a distinct DBML feature
surface; together they back the "5 reference schemas roundtrip 1:1" quality
gate in the v1.0.0 plan.

| File | Exercises |
|---|---|
| `simple.dbml` | Plain tables, columns, one relation — the happy path. |
| `composite-keys.dbml` | Composite primary keys, composite foreign keys. |
| `enums-and-notes.dbml` | DBML `enum` blocks and `note:` metadata on tables and columns. |
| `multi-schema.dbml` | Self-referential refs (parent/manager hierarchies) exercising the cycle path through the parser. Real cross-DBML-schema splits land in v1.1. |
| `large-50-tables.dbml` | Stress test: 50 tables + 40 refs, perf sanity check. |

## Scope limits (v1.0)

- DBML `indexes`, `enum`, and `TableGroup` parse on load but are **not**
  preserved on save — the internal `Diagram` shape has no slot for them.
  A future `.meta.json` sidecar (v1.1) will close this gap.
- SQL export (`diagram_export_sql`) delegates to `@dbml/core.exporter` for
  the `postgres` and `mysql` dialects only; `mssql`/`oracle`/`snowflake`
  ship in v1.1.
