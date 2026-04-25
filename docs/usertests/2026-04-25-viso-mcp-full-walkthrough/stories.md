# User Stories (INVEST-validated, Connextra format)

## Test-Dimensionen
1. **Klick-Workflow** (Maus-only)
2. **Shortcuts** (Cmd+K, Cmd+/, V, H, 1-4, Escape)
3. **Code-Panel** (DBML / JSON)
4. **MCP-Tools** (Code-Import, Bulk-Mutation, parse_description, import_bundle)
5. **Use Cases**: ERD (DBML), BPMN, Landscape (C4)

---

## US-01 — ERD-Tabelle per Klick erstellen
**Als** Junior-Dev (Maximilian)
**moechte ich** eine neue Tabelle per Klick auf ein Tool in der Palette erstellen,
**damit** ich ohne Code-Kenntnisse mein erstes ERD bauen kann.
- INVEST: I:✓ N:✓ V:✓ E:✓ S:✓ T:✓
- Erwartung: Tool-Palette zeigt "Add Table"-Button fuer ERD
- Hypothese: **WIRD FAILEN** — Code-Inspection zeigt keine ERD-Shape-Tools

## US-02 — Cmd+K Command-Palette
**Als** Tech-Lead (Lukas)
**moechte ich** per Cmd+K alle Aktionen finden + ausfuehren,
**damit** ich nicht zur Maus greifen muss.
- INVEST: I:✓ N:✓ V:✓ E:✓ S:✓ T:✓
- Erwartung: Cmd+K oeffnet Palette, alle Aktionen verfuegbar
- Im ERD-Mode: Add Table fehlt; im BPMN-Mode: Add Start/End/Task/Gateway sichtbar

## US-03 — Cmd+/ Code-Panel
**Als** Tech-Lead (Lukas)
**moechte ich** per Cmd+/ das Code-Panel oeffnen + DBML/JSON live editieren,
**damit** ich Bulk-Aenderungen schnell durchfuehre.
- Erwartung: Editor mit Syntax-Highlighting, Auto-Save, Validation

## US-04 — Wechsel zwischen ERD/BPMN/Landscape
**Als** Tech-Lead / Power-User
**moechte ich** zwischen den 3 Use-Case-Files wechseln,
**damit** ich meinen kompletten Architektur-Workspace bearbeiten kann.
- Erwartung: Sidebar oder Tab-Liste; Persistenz beim Reload
- Hypothese: **WIRD FAILEN** — F-024 (openTabs init = slice(0,1))

## US-05 — Tabellen-Properties bearbeiten
**Als** Junior-Dev
**moechte ich** auf eine Tabelle klicken und Properties (Name, Spalten, PK) sehen + editieren,
**damit** ich strukturiert arbeiten kann.

## US-06 — BPMN-Knoten per Klick spawnen
**Als** Beraterin (Sarah)
**moechte ich** waehrend Workshop per Klick auf das Tool und dann auf den Canvas einen Task setzen,
**damit** Kunden Live mitsehen.
- Tools: 1=StartEvent, 2=EndEvent, 3=Task, 4=Gateway

## US-07 — Drag&Drop Tools auf Canvas
**Als** Beraterin
**moechte ich** das Tool aus der Palette auf den Canvas ziehen,
**damit** Position bestimmbar ist.

## US-08 — Auto-Layout
**Als** Tech-Lead
**moechte ich** Auto-Layout per Button oder Cmd+K,
**damit** mein Diagramm aufgeraeumt ist.

## US-09 — Export Bundle
**Als** Beraterin
**moechte ich** ein ZIP-Bundle exportieren (Source + Mermaid + SVG + Positions),
**damit** Kunden Handoff bekommen.
- Hypothese: **WIRD INKONSISTENT** — F-020 (Bundle in Header-Dropdown ja, in Cmd+K nein)

## US-10 — Theme-Toggle
**Als** Beraterin
**moechte ich** zwischen Dark/Light wechseln,
**damit** Beamer-Workshops funktionieren.

## US-11 — Empty-State Hilfe
**Als** Domain-Expertin (Petra)
**moechte ich** im leeren Canvas eine Anleitung sehen,
**damit** ich starten kann.
- Hypothese: **WIRD FAILEN** — F-007 (EmptyState verweist auf MCP-Tool-Namen)

## US-12 — Tooltips
**Als** Domain-Expertin
**moechte ich** beim Hover ueber Buttons Tooltips sehen,
**damit** ich verstehe was sie tun.

## US-13 — Landscape per UI bauen
**Als** Beraterin
**moechte ich** im Landscape-Mode Personen, Systeme, Externe per Tool/Klick anlegen,
**damit** ich C4-Diagramme schnell baue.
- Hypothese: **WIRD KOMPLETT FAILEN** — keine Landscape-Tools in ToolPalette, keine Landscape-Aktionen in Cmd+K, kein Landscape-Tab.

## US-14 — Code-Import via DBML
**Als** Tech-Lead
**moechte ich** per Code-Panel DBML einfuegen + Diagramm wird live aktualisiert,
**damit** ich von dbdiagram.io importiere.

## US-15 — Code-Import via set_dbml MCP-Tool
**Als** Power-User (Yannick)
**moechte ich** via MCP-Tool `set_dbml` ein 50-Tabellen-Schema bulk laden,
**damit** Agenten das schnell tun koennen.

## US-16 — set_bpmn MCP-Tool
**Als** Power-User
**moechte ich** via `set_bpmn` einen kompletten Prozess in einem Call laden.

## US-17 — set_landscape MCP-Tool
**Als** Power-User
**moechte ich** via `set_landscape` ein C4-Diagramm in einem Call laden.

## US-18 — parse_description (Narrative-zu-Diagramm)
**Als** Beraterin
**moechte ich** einen Beschreibungstext eingeben und automatisch ein BPMN/ERD/Landscape generieren,
**damit** ich aus Workshop-Notizen sofort Visualisierung habe.
- Tools: `diagram_parse_description`, `process_parse_description`, `landscape_parse_description`

## US-19 — import_bundle / export_bundle Roundtrip
**Als** Power-User
**moechte ich** ein Bundle exportieren und sofort wieder importieren,
**damit** ich Idempotenz pruefe.

## US-20 — Validation bei kaputtem JSON/DBML
**Als** Power-User
**moechte ich** strukturierte RFC-7807-Errors bei kaputtem Input,
**damit** ich nicht raten muss.

## US-21 — Light/Dark-Mode Persistenz
**Als** Beraterin
**moechte ich** dass mein Theme-Setting nach Reload erhalten bleibt.

## US-22 — Undo/Redo (Cmd+Z, Cmd+Shift+Z)
**Als** Tech-Lead
**moechte ich** meine letzte Aenderung zurueckholen.

## US-23 — Escape schliesst Palette/Selection
**Als** Power-User
**moechte ich** Escape um Palette + Selection zu schliessen.

## US-24 — Tool-Shortcuts (V, H, 1-4)
**Als** Tech-Lead
**moechte ich** Buchstaben-Shortcuts fuer alle Tools.

## US-25 — Process-Mode Toggle (simple/bpmn)
**Als** Beraterin
**moechte ich** zwischen Simple-Mode und BPMN-Mode wechseln,
**damit** Junior-Mitarbeiter weniger Optionen sehen.
- Hypothese: Nur fuer BPMN-Files sichtbar (showModeToggle === bpmn)

## US-26 — Hidden-Elements-Counter im Simple-Mode
**Als** Beraterin
**moechte ich** sehen wenn im Simple-Mode Elemente versteckt sind.

## US-27 — Mini-Map-Navigation
**Als** Tech-Lead bei 50+ Tabellen
**moechte ich** mittels Mini-Map navigieren.

## US-28 — Zoom (In/Out/Fit)
**Als** alle
**moechten** zoomen koennen.

## US-29 — File-Save-Persistenz
**Als** Tech-Lead
**moechte ich** dass meine Aenderungen auf Disk gespeichert werden.

## US-30 — RFC-7807 Error-Responses
**Als** Power-User
**moechte ich** strukturierte Errors bei MCP-Calls.
