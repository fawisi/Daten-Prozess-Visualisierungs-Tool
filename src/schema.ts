import { z } from 'zod';

// Safe identifier: SQL-style names (letters, digits, underscores, max 64 chars)
export const SafeIdentifier = z
  .string()
  .regex(
    /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/,
    'Must start with a letter or underscore, contain only alphanumerics/underscores, max 64 chars'
  );

export const ColumnType = z
  .string()
  .max(128, 'Column type must be at most 128 characters');

export const ColumnSchema = z.object({
  name: SafeIdentifier.describe('Column name'),
  type: ColumnType.describe('Column data type (e.g. uuid, varchar, integer)'),
  primary: z.boolean().optional().describe('Whether this is a primary key column'),
  nullable: z.boolean().optional().describe('Whether this column allows NULL values'),
  description: z
    .string()
    .max(512)
    .optional()
    .describe('Human-readable description of this column'),
});

export const TableSchema = z.object({
  columns: z
    .array(ColumnSchema)
    .min(1, 'A table must have at least one column'),
  description: z
    .string()
    .max(512)
    .optional()
    .describe('Human-readable description of this table'),
});

export const RelationType = z.enum([
  'one-to-one',
  'one-to-many',
  'many-to-one',
  'many-to-many',
]);

export const RelationSchema = z.object({
  from: z.object({
    table: SafeIdentifier,
    column: SafeIdentifier,
  }),
  to: z.object({
    table: SafeIdentifier,
    column: SafeIdentifier,
  }),
  type: RelationType,
});

export const DiagramSchema = z.object({
  format: z.literal('daten-viz-erd-v1'),
  name: z.string().max(256).optional(),
  tables: z.record(SafeIdentifier, TableSchema),
  relations: z.array(RelationSchema),
});

export const PositionsSchema = z.record(
  SafeIdentifier,
  z.object({ x: z.number(), y: z.number() })
);

// Inferred types
export type Column = z.infer<typeof ColumnSchema>;
export type Table = z.infer<typeof TableSchema>;
export type RelationType_ = z.infer<typeof RelationType>;
export type Relation = z.infer<typeof RelationSchema>;
export type Diagram = z.infer<typeof DiagramSchema>;
export type Positions = z.infer<typeof PositionsSchema>;

// Empty diagram factory
export function emptyDiagram(): Diagram {
  return {
    format: 'daten-viz-erd-v1',
    tables: {},
    relations: [],
  };
}
