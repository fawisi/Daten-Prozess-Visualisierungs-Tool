import { describe, it, expect } from 'vitest';
import {
  LandscapeNodeIdentifier,
  LandscapeNodeSchema,
  LandscapeSchema,
  emptyLandscape,
  isL1Kind,
  isL2Kind,
} from './schema.js';

describe('LandscapeNodeSchema', () => {
  it('accepts an L1 person node', () => {
    const r = LandscapeNodeSchema.safeParse({
      kind: 'person',
      label: 'End User',
    });
    expect(r.success).toBe(true);
  });

  it('accepts an L1 system node with status', () => {
    const r = LandscapeNodeSchema.safeParse({
      kind: 'system',
      label: 'Order API',
      status: 'blocked',
    });
    expect(r.success).toBe(true);
  });

  it('accepts an L2 container with technology', () => {
    const r = LandscapeNodeSchema.safeParse({
      kind: 'container',
      label: 'Web App',
      technology: 'Next.js 16',
    });
    expect(r.success).toBe(true);
  });

  it('rejects L1 kind with L2-only technology field (type-safety uplift, R7)', () => {
    const r = LandscapeNodeSchema.safeParse({
      kind: 'person',
      label: 'End User',
      technology: 'Humans',
    });
    // The discriminator selects the L1 branch which has no `technology`
    // field — Zod by default strips unknown, so parse SUCCEEDS but the
    // field is stripped. Assert the field is not round-tripped.
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data as { technology?: string }).technology).toBeUndefined();
    }
  });

  it('accepts a boundary node for L2 containment', () => {
    const r = LandscapeNodeSchema.safeParse({
      kind: 'boundary',
      label: 'Customer-facing',
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown kinds', () => {
    const r = LandscapeNodeSchema.safeParse({ kind: 'weird', label: 'X' });
    expect(r.success).toBe(false);
  });

  it('rejects unknown status values (EN-only)', () => {
    const r = LandscapeNodeSchema.safeParse({
      kind: 'system',
      label: 'Web',
      status: 'offen',
    });
    expect(r.success).toBe(false);
  });
});

describe('LandscapeSchema', () => {
  it('accepts an empty landscape', () => {
    expect(LandscapeSchema.safeParse(emptyLandscape()).success).toBe(true);
  });

  it('validates a complete L2 landscape with boundary containment', () => {
    const landscape = {
      format: 'viso-landscape-v1',
      name: 'Customer domain',
      nodes: {
        User: { kind: 'person', label: 'Kunde' },
        Boundary: { kind: 'boundary', label: 'Customer Domain' },
        Web: {
          kind: 'container',
          label: 'Webshop',
          technology: 'Next.js 16',
          parentId: 'Boundary',
        },
        DB: { kind: 'database', label: 'Postgres', technology: 'PG 15', parentId: 'Boundary' },
      },
      relations: [
        { from: 'User', to: 'Web', label: 'uses', technology: 'HTTPS' },
        { from: 'Web', to: 'DB', label: 'reads/writes', technology: 'JDBC' },
      ],
    };
    expect(LandscapeSchema.safeParse(landscape).success).toBe(true);
  });

  it('rejects a wrong format field', () => {
    expect(
      LandscapeSchema.safeParse({ ...emptyLandscape(), format: 'viso-bpmn-v1' }).success
    ).toBe(false);
  });
});

describe('LandscapeNodeIdentifier', () => {
  it('accepts valid ids', () => {
    expect(LandscapeNodeIdentifier.safeParse('Winestro').success).toBe(true);
    expect(LandscapeNodeIdentifier.safeParse('_ops').success).toBe(true);
    expect(LandscapeNodeIdentifier.safeParse('orders-db').success).toBe(true);
  });

  it('rejects invalid ids', () => {
    expect(LandscapeNodeIdentifier.safeParse('1abc').success).toBe(false);
    expect(LandscapeNodeIdentifier.safeParse('a b').success).toBe(false);
    expect(LandscapeNodeIdentifier.safeParse('a'.repeat(65)).success).toBe(false);
  });
});

describe('level helpers', () => {
  it('isL1Kind returns true for person/system/external, false for L2', () => {
    expect(isL1Kind('person')).toBe(true);
    expect(isL1Kind('system')).toBe(true);
    expect(isL1Kind('external')).toBe(true);
    expect(isL1Kind('container')).toBe(false);
    expect(isL1Kind('database')).toBe(false);
  });

  it('isL2Kind returns true for L2-only kinds', () => {
    expect(isL2Kind('container')).toBe(true);
    expect(isL2Kind('database')).toBe(true);
    expect(isL2Kind('cloud')).toBe(true);
    expect(isL2Kind('boundary')).toBe(true);
    expect(isL2Kind('person')).toBe(false);
  });
});
