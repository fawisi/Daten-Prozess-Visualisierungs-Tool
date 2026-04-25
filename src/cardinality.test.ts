import { describe, it, expect } from 'vitest';
import {
  toLong,
  toShort,
  toMermaid,
  isShortForm,
  CardinalityInput,
} from './cardinality.js';

describe('cardinality', () => {
  describe('toLong', () => {
    it('maps 1:N to one-to-many', () => {
      expect(toLong('1:N')).toBe('one-to-many');
    });

    it('maps N:1 to many-to-one', () => {
      expect(toLong('N:1')).toBe('many-to-one');
    });

    it('passes long form through unchanged', () => {
      expect(toLong('one-to-many')).toBe('one-to-many');
    });
  });

  describe('toShort', () => {
    it('maps one-to-many to 1:N', () => {
      expect(toShort('one-to-many')).toBe('1:N');
    });

    it('maps many-to-many to N:N', () => {
      expect(toShort('many-to-many')).toBe('N:N');
    });
  });

  describe('toMermaid', () => {
    it('produces Mermaid notation for one-to-many', () => {
      expect(toMermaid('one-to-many')).toBe('||--o{');
    });
  });

  describe('isShortForm', () => {
    it('detects 1:N as short', () => {
      expect(isShortForm('1:N')).toBe(true);
    });

    it('rejects long form', () => {
      expect(isShortForm('one-to-many')).toBe(false);
    });

    it('rejects garbage', () => {
      expect(isShortForm('foo')).toBe(false);
    });
  });

  describe('CardinalityInput Zod schema', () => {
    it('accepts long form', () => {
      expect(CardinalityInput.parse('one-to-many')).toBe('one-to-many');
    });

    it('accepts short form', () => {
      expect(CardinalityInput.parse('1:N')).toBe('1:N');
    });

    it('rejects unknown literal', () => {
      expect(() => CardinalityInput.parse('to-be-or-not-to-be')).toThrow();
    });
  });
});
