import { describe, it, expect } from 'vitest';
import { rewriteCanonicalErdUrl } from './url-aliases.js';

describe('rewriteCanonicalErdUrl', () => {
  it('rewrites /__viso-api/erd/source to /__viso-api/source', () => {
    expect(rewriteCanonicalErdUrl('/__viso-api/erd/source')).toBe(
      '/__viso-api/source'
    );
  });

  it('rewrites /__viso-api/erd/positions to /__viso-api/positions', () => {
    expect(rewriteCanonicalErdUrl('/__viso-api/erd/positions')).toBe(
      '/__viso-api/positions'
    );
  });

  it('rewrites /__viso-api/erd/schema to /__viso-api/schema', () => {
    expect(rewriteCanonicalErdUrl('/__viso-api/erd/schema')).toBe(
      '/__viso-api/schema'
    );
  });

  it('passes legacy unprefixed URLs through unchanged', () => {
    expect(rewriteCanonicalErdUrl('/__viso-api/source')).toBe(
      '/__viso-api/source'
    );
    expect(rewriteCanonicalErdUrl('/__viso-api/positions')).toBe(
      '/__viso-api/positions'
    );
    expect(rewriteCanonicalErdUrl('/__viso-api/schema')).toBe(
      '/__viso-api/schema'
    );
  });

  it('passes BPMN and Landscape namespaces through unchanged', () => {
    expect(rewriteCanonicalErdUrl('/__viso-api/bpmn/source')).toBe(
      '/__viso-api/bpmn/source'
    );
    expect(rewriteCanonicalErdUrl('/__viso-api/landscape/source')).toBe(
      '/__viso-api/landscape/source'
    );
  });

  it('handles undefined and unrelated URLs without throwing', () => {
    expect(rewriteCanonicalErdUrl(undefined)).toBeUndefined();
    expect(rewriteCanonicalErdUrl('/some/other/path')).toBe('/some/other/path');
    expect(rewriteCanonicalErdUrl('')).toBe('');
  });
});
