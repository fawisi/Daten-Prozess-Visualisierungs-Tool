/**
 * Shared Mermaid-label-escape helper.
 *
 * Mermaid parses double-quotes inside `"..."`-wrapped labels literally. An
 * untrusted `label` field that contains a `"` terminates the label early;
 * a `\n` or `\r` breaks line-parsing and lets the attacker inject syntax
 * that the downstream renderer (Mermaid -> SVG in-browser) might execute
 * (see CVE-2021-23648, CVE-2022-35930).
 *
 * All three diagram emitters (ERD/BPMN/Landscape) funnel label/description
 * fields through this helper before wrapping them in `"..."`. Plan
 * reference: P0 Security-Requirement #1.
 */
export function escapeMermaidLabel(s: string | null | undefined): string {
  if (s === null || s === undefined) return '';
  // `#quot;` is Mermaid's documented entity for embedded double-quotes.
  // Newlines collapse to a single space so the generated line stays parsable.
  return String(s).replace(/"/g, '#quot;').replace(/[\r\n]+/g, ' ');
}
