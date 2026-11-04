// persistence/agents-index-schema.ts
//
// AG-2 / D-07: schema definition + JIT-compiled validators for
// `agents-index.json`. Uses the TypeBox + Compile pattern (default Type
// import + Type.Static).
//
// Wire field name `agents:`. Renaming to `entries:` would be a breaking
// on-disk change with no compensating benefit. A future schemaVersion 2
// migration may reconsider.
//
// Validators are compiled ONCE at module load (not inside loaders);
// consumers (loadAgentsIndex / saveAgentsIndex / future bridge code)
// pay zero per-call compilation cost.

import Type from "typebox";
import { Compile } from "typebox/compile";

/**
 * MGRT-01 / D-MB-03: one MCP implementation's grant form of a generated
 * agent: the file's frontmatter block (from the opening `---` line through
 * the closing `---` line), and the warnings and dropped tools that form
 * records. The body is the same under both implementations, so no form
 * stores it.
 */
const AGENTS_INDEX_MCP_FORM_SCHEMA = Type.Object({
  frontmatter: Type.String(),
  warnings: Type.Array(Type.String()),
  droppedTools: Type.Array(Type.String()),
});

/**
 * AG-2: per-row schema for agents-index.json.
 *
 * Every field except `originalModel`, `mcpImplementation`, and `mcpForms` is
 * required so the AG-4 per-row validator can drop malformed rows without
 * crashing the load. String arrays default to empty arrays (not optional) --
 * the CALLER materializes `[]` rather than relying on schema-level absence.
 *
 * MGRT-01 / D-MB-03: `mcpImplementation` and `mcpForms` are OPTIONAL and
 * additive -- NO schemaVersion bump. `mcpImplementation` names the grant form
 * the agent file holds now; `mcpForms` holds the form of each implementation
 * that rendered the agent, so a load after a switch can swap the file's
 * frontmatter block for the active implementation's. The stage writes them
 * only when the two implementations render the agent differently. A row
 * without them was written before MGRT-01, or its agent renders the same
 * under both implementations.
 */
const AGENTS_INDEX_ENTRY_SCHEMA = Type.Object({
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
  mcpImplementation: Type.Optional(Type.Union([Type.Literal("adapter"), Type.Literal("builtin")])),
  mcpForms: Type.Optional(
    Type.Object({
      adapter: Type.Optional(AGENTS_INDEX_MCP_FORM_SCHEMA),
      builtin: Type.Optional(AGENTS_INDEX_MCP_FORM_SCHEMA),
    }),
  ),
});

/**
 * D-07 / AG-2: full-document schema. `schemaVersion` is locked at 1
 * via `Type.Literal(1)` so a doc with `schemaVersion: 2` fails the
 * top-level Check (file-level corruption per AG-4).
 *
 * Wire field name `agents:` -- DO NOT rename to `entries:`; the
 * rename would be a breaking on-disk change.
 */
const AGENTS_INDEX_SCHEMA = Type.Object({
  schemaVersion: Type.Literal(1),
  agents: Type.Array(AGENTS_INDEX_ENTRY_SCHEMA),
});

export type AgentsIndexEntry = Type.Static<typeof AGENTS_INDEX_ENTRY_SCHEMA>;
export type AgentsIndex = Type.Static<typeof AGENTS_INDEX_SCHEMA>;

/**
 * D-07: JIT-compiled validators. Compile ONCE at module load. Per-row
 * validator is exposed separately so loadAgentsIndex can validate each
 * row in isolation (AG-4 soft-fail discipline) without re-validating
 * the envelope.
 */
export const AGENTS_INDEX_VALIDATOR = Compile(AGENTS_INDEX_SCHEMA);
export const AGENTS_INDEX_ENTRY_VALIDATOR = Compile(AGENTS_INDEX_ENTRY_SCHEMA);
