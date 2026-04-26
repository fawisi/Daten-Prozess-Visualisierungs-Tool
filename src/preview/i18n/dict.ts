/**
 * Const-Dictionary i18n. No framework (YAGNI for 2 locales, ~300 strings).
 *
 * Design decisions (plan R7 / R11):
 * - `de` is the ground-truth shape. `en` ships with the same keys but
 *   English values — the EN toggle appears once `en` is fleshed out
 *   post-v1.1.
 * - Values can be `string` or a function of interpolation args so
 *   pluralisation like `"{count} versteckte Elemente"` works from day 1.
 * - Flat-key lookups (`t('properties.status')`) so the key space is easy
 *   to grep and so a future tooling pass can lint for unused / missing
 *   keys.
 */

export interface Dict {
  properties: {
    title_node: string;
    title_empty: string;
    close: string;
    label: string;
    type: string;
    status: string;
    status_open: string;
    status_done: string;
    status_blocked: string;
    comment: string;
    comment_placeholder: string;
    attachments: string;
    diagram: string;
    format: string;
    empty_hint_head: string;
    empty_hint_body: string;
    hidden_elements: (args: { count: number }) => string;
    /** ERD column-list section (MA-11 — v1.1.2). */
    columns: string;
    column_name_placeholder: string;
    column_type_placeholder: string;
    column_primary: string;
    column_remove: string;
    column_remove_disabled: string;
    add_column: string;
  };
  toolPalette: {
    pointer: string;
    pan: string;
    // BPMN
    task: string;
    gateway: string;
    start_event: string;
    end_event: string;
    // ERD (v1.1.1 — CR-2)
    table: string;
    // Landscape (v1.1.1 — CR-3)
    lc_person: string;
    lc_system: string;
    lc_external: string;
    lc_container: string;
    lc_database: string;
  };
  topHeader: {
    app_name: string;
    auto_layout: string;
    auto_layout_title: string;
    code: string;
    code_title: string;
    export: string;
    language_switch: string;
    theme_switch_light: string;
    theme_switch_dark: string;
    mode_simple: string;
    mode_bpmn: string;
    mode_toggle_aria: string;
    mode_hidden_hint: (args: { count: number }) => string;
    /** C4 Landscape detail level (MA-10 — v1.1.2). */
    mode_l1: string;
    mode_l2: string;
    mode_toggle_landscape_aria: string;
  };
  export: {
    mermaid: string;
    sql: string;
    dbml: string;
    svg: string;
    png: string;
    bundle: string;
    error_sql_requires_http: string;
    error_mermaid_requires_http: string;
    error_sql_erd_only: string;
    error_dbml_erd_only: string;
    error_http_fail: (args: { status: number; detail: string }) => string;
  };
  empty: {
    canvas_title: string;
    canvas_hint: string;
    bpmn_placeholder: string;
    erd_placeholder: string;
    landscape_placeholder: string;
  };
  footer: {
    tagline: string;
    tagline_hint: string;
  };
  validation: {
    single_start_event: (args: { existing: string }) => string;
  };
}

// Native enum values are stored in English on disk. This maps them to the
// display string for the active locale so badges, dropdowns, and
// PropertiesPanel copy all stay consistent.
export type PersistentStatus = 'open' | 'done' | 'blocked';

export const de: Dict = {
  properties: {
    // MI-4 (v1.1.2): "Knoten" / "Bezeichnung" waren in den User-Tests
    // unklar. "Typ" beschreibt die Sektion praeziser, "Name" ist die
    // direkte Eigenschaft der Tabelle / des Knotens.
    title_node: 'Typ',
    title_empty: 'Diagramm',
    close: 'Panel schliessen',
    label: 'Name',
    type: 'Typ',
    status: 'Status',
    status_open: 'Offen',
    status_done: 'Erledigt',
    status_blocked: 'Problem/Blocker',
    comment: 'Kommentar',
    comment_placeholder: 'Notiz hinzufuegen...',
    attachments: 'Anhaenge',
    diagram: 'Diagramm',
    format: 'Format',
    empty_hint_head: 'Nichts ausgewaehlt',
    empty_hint_body:
      'Klicke einen Knoten im Canvas, oder nutze Cmd+K fuer die Command-Palette.',
    hidden_elements: ({ count }) =>
      `${count} versteckte${count === 1 ? 's' : ''} BPMN-Element${count === 1 ? '' : 'e'}`,
    columns: 'Spalten',
    column_name_placeholder: 'Spaltenname',
    column_type_placeholder: 'Datentyp',
    column_primary: 'PK',
    column_remove: 'Spalte entfernen',
    column_remove_disabled: 'Mindestens eine Spalte muss bleiben',
    add_column: 'Spalte hinzufuegen',
  },
  toolPalette: {
    pointer: 'Auswahl',
    pan: 'Verschieben',
    task: 'Aufgabe',
    gateway: 'Entscheidung',
    start_event: 'Start',
    end_event: 'Ende',
    table: 'Tabelle',
    lc_person: 'Person',
    lc_system: 'System',
    lc_external: 'Externes System',
    lc_container: 'Container',
    lc_database: 'Datenbank',
  },
  topHeader: {
    app_name: 'viso-mcp',
    auto_layout: 'Auto-Layout',
    auto_layout_title: 'Auto-Layout (ELK)',
    code: 'Code',
    code_title: 'Code-Panel umschalten (Cmd+/)',
    export: 'Export',
    language_switch: 'Sprache',
    theme_switch_light: 'Zu Light Mode wechseln',
    theme_switch_dark: 'Zu Dark Mode wechseln',
    mode_simple: 'Einfach',
    mode_bpmn: 'BPMN-Profi',
    mode_toggle_aria: 'Prozess-Modus umschalten',
    mode_hidden_hint: ({ count }) =>
      `${count} ${count === 1 ? 'versteckt' : 'versteckte'} BPMN-Element${count === 1 ? '' : 'e'}`,
    mode_l1: 'L1 Kontext',
    mode_l2: 'L2 Container',
    mode_toggle_landscape_aria: 'Landscape-Detailgrad umschalten',
  },
  export: {
    mermaid: 'Mermaid',
    sql: 'SQL DDL',
    dbml: 'DBML',
    svg: 'SVG-Bild',
    png: 'PNG-Bild',
    bundle: 'Handoff-Paket',
    error_sql_requires_http:
      'SQL-Export benoetigt den HTTP-Adapter. Starte `viso-mcp http` oder konfiguriere `apiBaseUrl`.',
    error_mermaid_requires_http:
      'Mermaid-Export benoetigt den HTTP-Adapter. Starte `viso-mcp http` oder konfiguriere `apiBaseUrl`.',
    error_sql_erd_only: 'SQL-Export ist nur fuer ERD-Diagramme moeglich.',
    error_dbml_erd_only: 'DBML-Export ist nur fuer ERD-Diagramme moeglich.',
    error_http_fail: ({ status, detail }) =>
      `HTTP-Export fehlgeschlagen (${status}): ${detail}`,
  },
  empty: {
    canvas_title: 'Kein Diagramm geladen',
    canvas_hint:
      'Klicke ein Werkzeug in der Seitenleiste oder druecke Cmd+K fuer die Command-Palette.',
    // MI-1: replaced MCP-tool-name with click-first wording for non-agent users.
    bpmn_placeholder:
      'Noch keine Prozess-Knoten. Klicke das Task-Werkzeug (Shortcut 3) und dann auf den Canvas, um deinen ersten Knoten zu setzen.',
    erd_placeholder:
      'Noch keine Tabellen. Klicke das Tabellen-Werkzeug (Shortcut 5) und dann auf den Canvas, um deine erste Tabelle anzulegen.',
    landscape_placeholder:
      'Noch keine Landscape-Knoten. Klicke ein Landscape-Werkzeug (Shortcut 6 bis 0) und dann auf den Canvas.',
  },
  footer: {
    tagline:
      'Canvas-first Zeichnen · Werkzeuge links · Eigenschaften rechts fuer selektierten Knoten',
    tagline_hint: 'Cmd+/ oeffnet das Code-Panel (Profi-Modus)',
  },
  validation: {
    single_start_event: ({ existing }) =>
      `Der Prozess hat bereits ein Start-Event ("${existing}"). Es darf nur eines geben.`,
  },
};

// EN-Dict — same key-shape as `de`, English values. Added in v1.1.2
// (MI-2). Hub consumers can flip the locale prop now; copy is a clean
// translation, not auto-generated, but expect refinement based on
// actual EN-locale user feedback. The Dict-Type forces both locales to
// stay in sync — a missing key fails TypeScript in CI.
export const en: Dict = {
  properties: {
    // MI-4 (v1.1.2): see DE comment — same renames in English.
    title_node: 'Type',
    title_empty: 'Diagram',
    close: 'Close panel',
    label: 'Name',
    type: 'Type',
    status: 'Status',
    status_open: 'Open',
    status_done: 'Done',
    status_blocked: 'Blocked',
    comment: 'Comment',
    comment_placeholder: 'Add a note...',
    attachments: 'Attachments',
    diagram: 'Diagram',
    format: 'Format',
    empty_hint_head: 'Nothing selected',
    empty_hint_body:
      'Click a node on the canvas, or use Cmd+K to open the command palette.',
    hidden_elements: ({ count }) =>
      `${count} hidden BPMN element${count === 1 ? '' : 's'}`,
    columns: 'Columns',
    column_name_placeholder: 'Column name',
    column_type_placeholder: 'Data type',
    column_primary: 'PK',
    column_remove: 'Remove column',
    column_remove_disabled: 'At least one column must remain',
    add_column: 'Add column',
  },
  toolPalette: {
    pointer: 'Select',
    pan: 'Pan',
    task: 'Task',
    gateway: 'Gateway',
    start_event: 'Start',
    end_event: 'End',
    table: 'Table',
    lc_person: 'Person',
    lc_system: 'System',
    lc_external: 'External system',
    lc_container: 'Container',
    lc_database: 'Database',
  },
  topHeader: {
    app_name: 'viso-mcp',
    auto_layout: 'Auto-Layout',
    auto_layout_title: 'Auto-Layout (ELK)',
    code: 'Code',
    code_title: 'Toggle code panel (Cmd+/)',
    export: 'Export',
    language_switch: 'Language',
    theme_switch_light: 'Switch to Light Mode',
    theme_switch_dark: 'Switch to Dark Mode',
    mode_simple: 'Simple',
    mode_bpmn: 'BPMN Pro',
    mode_toggle_aria: 'Toggle process mode',
    mode_hidden_hint: ({ count }) =>
      `${count} hidden BPMN element${count === 1 ? '' : 's'}`,
    mode_l1: 'L1 Context',
    mode_l2: 'L2 Container',
    mode_toggle_landscape_aria: 'Toggle landscape detail level',
  },
  export: {
    mermaid: 'Mermaid',
    sql: 'SQL DDL',
    dbml: 'DBML',
    svg: 'SVG image',
    png: 'PNG image',
    bundle: 'Handoff Bundle',
    error_sql_requires_http:
      'SQL export requires the HTTP adapter. Start `viso-mcp http` or configure `apiBaseUrl`.',
    error_mermaid_requires_http:
      'Mermaid export requires the HTTP adapter. Start `viso-mcp http` or configure `apiBaseUrl`.',
    error_sql_erd_only: 'SQL export is only available for ERD diagrams.',
    error_dbml_erd_only: 'DBML export is only available for ERD diagrams.',
    error_http_fail: ({ status, detail }) =>
      `HTTP export failed (${status}): ${detail}`,
  },
  empty: {
    canvas_title: 'No diagram loaded',
    canvas_hint:
      'Click a tool in the sidebar or press Cmd+K for the command palette.',
    bpmn_placeholder:
      'No process nodes yet. Click the Task tool (shortcut 3) and then the canvas to place your first node.',
    erd_placeholder:
      'No tables yet. Click the Table tool (shortcut 5) and then the canvas to add your first table.',
    landscape_placeholder:
      'No landscape nodes yet. Click a landscape tool (shortcut 6 through 0) and then the canvas.',
  },
  footer: {
    tagline:
      'Canvas-first drawing · tools left · properties right for the selected node',
    tagline_hint: 'Cmd+/ opens the code panel (pro mode)',
  },
  validation: {
    single_start_event: ({ existing }) =>
      `The process already has a start event ("${existing}"). Only one is allowed.`,
  },
};
