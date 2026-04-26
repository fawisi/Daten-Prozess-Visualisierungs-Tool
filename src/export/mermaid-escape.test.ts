import { describe, it, expect } from 'vitest';
import { escapeMermaidLabel } from './mermaid-escape.js';

describe('escapeMermaidLabel', () => {
  it('passes through plain strings unchanged', () => {
    expect(escapeMermaidLabel('Hello world')).toBe('Hello world');
    expect(escapeMermaidLabel('Aufgabe erledigt')).toBe('Aufgabe erledigt');
  });

  it('replaces double-quotes with Mermaid #quot; entity', () => {
    expect(escapeMermaidLabel('He said "hi"')).toBe('He said #quot;hi#quot;');
  });

  it('collapses newlines to a single space', () => {
    expect(escapeMermaidLabel('line1\nline2')).toBe('line1 line2');
    expect(escapeMermaidLabel('line1\r\nline2')).toBe('line1 line2');
    expect(escapeMermaidLabel('a\n\n\nb')).toBe('a b');
  });

  it('handles null and undefined as empty string', () => {
    expect(escapeMermaidLabel(null)).toBe('');
    expect(escapeMermaidLabel(undefined)).toBe('');
  });

  it('defends against quote-injection that would break the label wrapper', () => {
    // An attacker-controlled label like `x"]`-then-mermaid-code should not
    // escape the surrounding `"..."`.
    const payload = 'x"]; style attacker fill:#f00';
    const escaped = escapeMermaidLabel(payload);
    expect(escaped).not.toContain('"');
  });
});
