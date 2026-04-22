import { describe, it, expect } from 'vitest';
import { landscapeToMermaid } from './export-mermaid.js';
import type { Landscape } from './schema.js';

const sample: Landscape = {
  format: 'viso-landscape-v1',
  name: 'Customer Domain',
  nodes: {
    User: { kind: 'person', label: 'Kunde' },
    Web: { kind: 'system', label: 'Webshop' },
    API: { kind: 'system', label: 'Order API' },
    DB: { kind: 'database', label: 'Postgres', technology: 'PG 15' },
    Stripe: { kind: 'external', label: 'Stripe' },
  },
  relations: [
    { from: 'User', to: 'Web', label: 'browse' },
    { from: 'Web', to: 'API', label: 'JSON/HTTPS', technology: 'REST' },
    { from: 'API', to: 'DB', label: 'read/write' },
    { from: 'API', to: 'Stripe', label: 'charge', technology: 'REST/HTTPS' },
  ],
};

describe('landscapeToMermaid — flowchart (primary)', () => {
  it('starts with flowchart LR by default', () => {
    const out = landscapeToMermaid(sample);
    expect(out.startsWith('flowchart LR\n')).toBe(true);
  });

  it('emits C4 classDefs for every kind', () => {
    const out = landscapeToMermaid(sample);
    expect(out).toContain('classDef person');
    expect(out).toContain('classDef system');
    expect(out).toContain('classDef external');
    expect(out).toContain('classDef database');
  });

  it('renders relation labels (C4 requires them)', () => {
    const out = landscapeToMermaid(sample);
    expect(out).toContain('"browse"');
    // label + technology combined with middle dot
    expect(out).toContain('JSON/HTTPS · REST');
  });

  it('escapes quotes in labels to prevent injection', () => {
    const evil: Landscape = {
      format: 'viso-landscape-v1',
      nodes: {
        Evil: { kind: 'system', label: 'he said "hi"' },
      },
      relations: [],
    };
    const out = landscapeToMermaid(evil);
    expect(out).toContain('#quot;');
  });

  it('emits subgraph for boundary containment', () => {
    const withBoundary: Landscape = {
      format: 'viso-landscape-v1',
      nodes: {
        B1: { kind: 'boundary', label: 'Core Domain' },
        S1: { kind: 'container', label: 'API', parentId: 'B1' },
      },
      relations: [],
    };
    const out = landscapeToMermaid(withBoundary);
    expect(out).toMatch(/subgraph B1\["Core Domain"\]/);
    expect(out).toContain('S1["API"]');
    expect(out).toContain('    end');
  });

  it('emits status classDefs when any node has status', () => {
    const withStatus: Landscape = {
      format: 'viso-landscape-v1',
      nodes: {
        X: { kind: 'system', label: 'X', status: 'blocked' },
      },
      relations: [],
    };
    const out = landscapeToMermaid(withStatus);
    expect(out).toContain('classDef statusBlocked');
    expect(out).toContain('class X statusBlocked');
  });

  it('produces deterministic output', () => {
    expect(landscapeToMermaid(sample)).toBe(landscapeToMermaid(sample));
  });
});

describe('landscapeToMermaid — architecture-beta (secondary)', () => {
  it('emits architecture-beta header and documents label loss', () => {
    const out = landscapeToMermaid(sample, { variant: 'architecture-beta' });
    expect(out.startsWith('architecture-beta\n')).toBe(true);
    expect(out).toContain('Edge labels are not supported');
  });

  it('uses group / service / arrow syntax', () => {
    const out = landscapeToMermaid(sample, { variant: 'architecture-beta' });
    expect(out).toMatch(/service User\(logos:users\)/);
    expect(out).toMatch(/service DB\(database\)/);
    expect(out).toMatch(/User:R --> L:Web/);
  });
});
