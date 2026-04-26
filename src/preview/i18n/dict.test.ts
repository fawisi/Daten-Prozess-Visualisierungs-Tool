import { describe, it, expect } from 'vitest';
import { de, en } from './dict.js';

/**
 * Locale-completeness tests (MI-2 — v1.1.2). Dict-Type already forces
 * both locales to declare the same keys at compile-time; these runtime
 * tests catch (1) accidental same-string copies (a common AI-translation
 * artefact) and (2) silent shape drift if the type ever loosens.
 */

function flatKeys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === 'object' && !Array.isArray(v)
      ? flatKeys(v as object, path)
      : [path];
  });
}

describe('i18n dictionaries', () => {
  it('de and en expose the exact same key set', () => {
    const deKeys = flatKeys(de).sort();
    const enKeys = flatKeys(en).sort();
    expect(enKeys).toEqual(deKeys);
  });

  it('de and en cover every section the Dict-type declares', () => {
    const sections = [
      'properties',
      'toolPalette',
      'topHeader',
      'export',
      'empty',
      'footer',
      'validation',
    ];
    for (const section of sections) {
      expect(de).toHaveProperty(section);
      expect(en).toHaveProperty(section);
    }
  });

  it('en is not a verbatim copy of de (sanity-check on translation)', () => {
    // A representative sample — the full key-by-key check would be
    // noisy, but at least these high-traffic strings should differ.
    expect(en.topHeader.mode_simple).not.toBe(de.topHeader.mode_simple);
    expect(en.properties.label).not.toBe(de.properties.label);
    expect(en.export.bundle).not.toBe(de.export.bundle);
  });

  it('functional keys still produce strings on en', () => {
    expect(typeof en.topHeader.mode_hidden_hint({ count: 1 })).toBe('string');
    expect(typeof en.properties.hidden_elements({ count: 3 })).toBe('string');
    expect(
      typeof en.export.error_http_fail({ status: 500, detail: 'oops' })
    ).toBe('string');
    expect(
      typeof en.validation.single_start_event({ existing: 'start_1' })
    ).toBe('string');
  });
});
