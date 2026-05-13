// persistence/agents-index-schema.ts
//
// AG-2 / D-07: schema definition + JIT-compiled validators for
// `agents-index.json`. Mirrors Phase 2's persistence/state-io.ts
// TypeBox + Compile pattern (default Type import + Type.Static).
//
// Wire field name `agents:` is preserved from V1 (planner-resolved
// open question -- see 03-CONTEXT.md / 03-PATTERNS.md line ~700).
// Renaming to `entries:` would be a breaking on-disk change relative
// to V1 with no compensating benefit at this phase. A future
// schemaVersion 2 migration may reconsider.
//
// Validators are compiled ONCE at module load (not inside loaders);
// consumers (loadAgentsIndex / saveAgentsIndex / future bridge code)
// pay zero per-call compilation cost.

import Type from "typebox";
import { Compile } from "typebox/compile";

/**
 * AG-2: per-row schema for agents-index.json.
 *
 * Every field except `originalModel` is required so the AG-4 per-row
 * validator can drop malformed rows without crashing the load. String
 * arrays default to empty arrays (not optional) -- the CALLER materializes
 * `[]` rather than relying on schema-level absence.
 */
export const AGENTS_INDEX_ENTRY_SCHEMA = Type.Object({
  plugin: Type.String(),
  marketplace: Type.String(),
  sourceAgent: Type.String(),
  generatedName: Type.String(),
  sourcePath: Type.String(),
  targetPath: Type.String(),
  sourceHash: Type.String(),
  originalModel: Type.Optional(Type.String()),
  droppedFields: Type.Array(Type.String()),
  droppedTools: Type.Array(Type.String()),
  warnings: Type.Array(Type.String()),
});

/**
 * D-07 / AG-2: full-document schema. `schemaVersion` is locked at 1
 * via `Type.Literal(1)` so a doc with `schemaVersion: 2` fails the
 * top-level Check (file-level corruption per AG-4).
 *
 * Wire field name `agents:` -- DO NOT rename to `entries:`; the
 * rename would be a breaking on-disk change relative to V1.
 */
export const AGENTS_INDEX_SCHEMA = Type.Object({
  schemaVersion: Type.Literal(1),
  agents: Type.Array(AGENTS_INDEX_ENTRY_SCHEMA),
});

export type AgentsIndexEntry = Type.Static<typeof AGENTS_INDEX_ENTRY_SCHEMA>;
export type AgentsIndex = Type.Static<typeof AGENTS_INDEX_SCHEMA>;

/**
 * D-07: JIT-compiled validators. Compile ONCE at module load
 * (Phase 2 STATE_VALIDATOR pattern). Per-row validator is exposed
 * separately so loadAgentsIndex can validate each row in isolation
 * (AG-4 soft-fail discipline) without re-validating the envelope.
 */
export const AGENTS_INDEX_VALIDATOR = Compile(AGENTS_INDEX_SCHEMA);
export const AGENTS_INDEX_ENTRY_VALIDATOR = Compile(AGENTS_INDEX_ENTRY_SCHEMA);
