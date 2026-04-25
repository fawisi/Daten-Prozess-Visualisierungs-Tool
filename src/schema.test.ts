import { describe, it, expect } from 'vitest';
import { SafeIdentifier, ColumnSchema, TableSchema, DiagramSchema, emptyDiagram } from './schema.js';

describe('SafeIdentifier', () => {
  it('accepts valid identifiers', () => {
    expect(SafeIdentifier.safeParse('users').success).toBe(true);
    expect(SafeIdentifier.safeParse('_private').success).toBe(true);
    expect(SafeIdentifier.safeParse('order_items').success).toBe(true);
    expect(SafeIdentifier.safeParse('A123').success).toBe(true);
  });

  it('rejects invalid identifiers', () => {
    expect(SafeIdentifier.safeParse('').success).toBe(false);
    expect(SafeIdentifier.safeParse('123abc').success).toBe(false);
    expect(SafeIdentifier.safeParse('has space').success).toBe(false);
    expect(SafeIdentifier.safeParse('has-dash').success).toBe(false);
    expect(SafeIdentifier.safeParse('a'.repeat(65)).success).toBe(false);
  });

  it('accepts max-length identifier (64 chars)', () => {
    expect(SafeIdentifier.safeParse('a'.repeat(64)).success).toBe(true);
  });
});

describe('ColumnSchema', () => {
  it('validates a minimal column', () => {
    const result = ColumnSchema.safeParse({ name: 'id', type: 'uuid' });
    expect(result.success).toBe(true);
  });

  it('validates a full column', () => {
    const result = ColumnSchema.safeParse({
      name: 'email',
      type: 'varchar(255)',
      primary: false,
      nullable: false,
      description: 'Login identifier',
    });
    expect(result.success).toBe(true);
  });

  it('rejects column type over 128 chars', () => {
    const result = ColumnSchema.safeParse({ name: 'x', type: 'a'.repeat(129) });
    expect(result.success).toBe(false);
  });
});

describe('TableSchema', () => {
  it('requires at least one column', () => {
    const result = TableSchema.safeParse({ columns: [] });
    expect(result.success).toBe(false);
  });

  it('accepts a status field on the table', () => {
    const result = TableSchema.safeParse({
      columns: [{ name: 'id', type: 'uuid', primary: true }],
      status: 'blocked',
    });
    expect(result.success).toBe(true);
  });
});

describe('ColumnSchema status', () => {
  it('accepts a status field on a column', () => {
    const result = ColumnSchema.safeParse({
      name: 'email',
      type: 'varchar',
      status: 'open',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown status values (enum is EN-only, e.g. no "offen")', () => {
    const result = ColumnSchema.safeParse({
      name: 'email',
      type: 'varchar',
      status: 'offen',
    });
    expect(result.success).toBe(false);
  });
});

describe('DiagramSchema', () => {
  it('validates empty diagram', () => {
    const result = DiagramSchema.safeParse(emptyDiagram());
    expect(result.success).toBe(true);
  });

  it('validates a full diagram', () => {
    const diagram = {
      format: 'viso-erd-v1',
      name: 'Test DB',
      tables: {
        users: {
          columns: [
            { name: 'id', type: 'uuid', primary: true },
            { name: 'email', type: 'varchar', nullable: false },
          ],
          description: 'App users',
        },
        orders: {
          columns: [
            { name: 'id', type: 'uuid', primary: true },
            { name: 'user_id', type: 'uuid' },
          ],
        },
      },
      relations: [
        {
          from: { table: 'orders', column: 'user_id' },
          to: { table: 'users', column: 'id' },
          type: 'many-to-one',
        },
      ],
    };
    const result = DiagramSchema.safeParse(diagram);
    expect(result.success).toBe(true);
  });

  it('rejects invalid format field', () => {
    const result = DiagramSchema.safeParse({ ...emptyDiagram(), format: 'wrong' });
    expect(result.success).toBe(false);
  });
});
