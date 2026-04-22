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
  };
  toolPalette: {
    pointer: string;
    pan: string;
    task: string;
    gateway: string;
    start_event: string;
    end_event: string;
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
  };
  export: {
    mermaid: string;
    sql: string;
    dbml: string;
    svg: string;
    png: string;
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
    title_node: 'Knoten',
    title_empty: 'Diagramm',
    close: 'Panel schliessen',
    label: 'Bezeichnung',
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
  },
  toolPalette: {
    pointer: 'Auswahl',
    pan: 'Verschieben',
    task: 'Aufgabe',
    gateway: 'Entscheidung',
    start_event: 'Start',
    end_event: 'Ende',
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
  },
  export: {
    mermaid: 'Mermaid',
    sql: 'SQL DDL',
    dbml: 'DBML',
    svg: 'SVG-Bild',
    png: 'PNG-Bild',
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
    bpmn_placeholder:
      'Noch keine Prozess-Knoten. Nutze process_add_node, um Knoten anzulegen.',
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

// EN-Dict deliberately not exported in v1.1 (plan R11: "EN-Dict empty
// shape in v1.1"). Re-export here once EN values have been audited by
// a native speaker — shipping DE strings under an "EN" label is worse
// than a single-language app. Until then, `Locale` below narrows to
// `'de'` and the `VisoEditor` prop rejects other values at the type
// level.
