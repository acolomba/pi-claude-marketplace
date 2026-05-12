// persistence/state-io.ts
//
// STATE_SCHEMA (ST-1, ST-2, ST-3) + loadState (ST-4..6 funneling) +
// saveState (NFR-1 / AS-1 via atomicWriteJson).
//
// Per Pitfall 9, ENOENT and missing/empty marketplaces map are treated
// identically as DEFAULT_STATE. Per ST-6, source records flow through
// pathSource/githubSource at load time -- the SAME factories used at
// marketplace-add parse time.
//
// Per CONTEXT.md D-09, state shape nests plugins under their owning
// marketplace; the (mp, plugin) tuple is the natural composite key.
//
// Per Pitfall 4, this layer is INTRA-PROCESS only; cross-process
// safety is NOT claimed. withStateGuard (Plan 02-06) enforces the
// single-writer-at-a-time discipline; cross-process races resolve
// last-writer-wins via write-file-atomic's queue.
//
// SECURITY (T-02-16): the schema accepts any string for `manifestPath`
// and `marketplaceRoot`. Containment of THOSE paths is the responsibility
// of Phase 4 marketplace orchestrators when they read the manifest file
// (assertPathInside applied at read site). Phase 2 loads the value
// verbatim.

import { readFile } from "node:fs/promises";
import path from "node:path";

import Type from "typebox";
import { Compile } from "typebox/compile";

import { githubSource, parsePluginSource, pathSource } from "../domain/source.ts";
import { atomicWriteJson } from "../shared/atomic-json.ts";
import { errorMessage } from "../shared/errors.ts";

import { migrateLegacyMarketplaceRecords, persistMigratedState } from "./migrate.ts";

/** ST-3: per-plugin install record (D-09 nesting under marketplaces.<mp>.plugins). */
const PLUGIN_INSTALL_RECORD_SCHEMA = Type.Object({
  version: Type.String(),
  resolvedSource: Type.String(),
  compatibility: Type.Object({
    installable: Type.Boolean(),
    notes: Type.Array(Type.String()),
    supported: Type.Array(Type.String()),
    unsupported: Type.Array(Type.String()),
  }),
  resources: Type.Object({
    skills: Type.Array(Type.String()),
    prompts: Type.Array(Type.String()),
    agents: Type.Array(Type.String()),
    mcpServers: Type.Array(Type.String()),
  }),
  installedAt: Type.String(),
  updatedAt: Type.String(),
});

/**
 * ST-2: per-marketplace record. `source` is `Type.Unknown()` so the schema
 * accepts whatever shape ST-6 funnel produced (PathSource | GitHubSource);
 * cross-shape validation lives in domain/source.ts. The schema's job is
 * the structural envelope; the funnel is the semantic gate.
 */
const MARKETPLACE_RECORD_SCHEMA = Type.Object({
  name: Type.String(),
  scope: Type.Union([Type.Literal("user"), Type.Literal("project")]),
  source: Type.Unknown(),
  addedFromCwd: Type.String(),
  manifestPath: Type.String(),
  marketplaceRoot: Type.String(),
  lastUpdatedAt: Type.Optional(Type.String()),
  autoupdate: Type.Optional(Type.Boolean()),
  plugins: Type.Record(Type.String(), PLUGIN_INSTALL_RECORD_SCHEMA),
});

/** ST-1: state.json shape (schemaVersion locked at 1). */
export const STATE_SCHEMA = Type.Object({
  schemaVersion: Type.Literal(1),
  marketplaces: Type.Record(Type.String(), MARKETPLACE_RECORD_SCHEMA),
});

export type ExtensionState = Type.Static<typeof STATE_SCHEMA>;

/** JIT-compiled validator (D-07). */
export const STATE_VALIDATOR = Compile(STATE_SCHEMA);

/** First-load default (Pitfall 9: ENOENT and empty treated identically). */
export const DEFAULT_STATE: ExtensionState = Object.freeze({
  schemaVersion: 1,
  marketplaces: {},
});

/** Path to state.json given an extensionRoot. */
function stateJsonPathFor(extensionRoot: string): string {
  return path.join(extensionRoot, "state.json");
}

/** Format the first validator error into a single-line message. */
function firstValidationErrorDetail(value: unknown): string {
  const errors = STATE_VALIDATOR.Errors(value);
  const first = errors[0];
  if (!first) {
    return "(no detail available)";
  }

  return `${first.instancePath || "<root>"}: ${first.message}`;
}

function normalizeStoredSource(mpName: string, mp: Record<string, unknown>): void {
  const src = mp.source;

  if (typeof src === "string") {
    const parsedSrc = parsePluginSource(src);
    if (parsedSrc.kind === "unknown") {
      throw new Error(
        `state.json marketplace "${mpName}" has unclassifiable source: ${parsedSrc.reason}`,
      );
    }

    mp.source = parsedSrc;
    return;
  }

  if (typeof src !== "object" || src === null) {
    throw new Error(`state.json marketplace "${mpName}" has missing or invalid source`);
  }

  const obj = src as { kind?: unknown; raw?: unknown };
  if (obj.kind === "path" && typeof obj.raw === "string") {
    mp.source = pathSource(obj.raw);
  } else if (obj.kind === "github" && typeof obj.raw === "string") {
    mp.source = githubSource(obj.raw);
  } else if (obj.kind !== "unknown") {
    throw new Error(
      `state.json marketplace "${mpName}" has malformed source object (missing kind/raw)`,
    );
  }
}

/**
 * ST-1, ST-4, ST-5, ST-6: load + migrate + revalidate state.json.
 *
 * Returns DEFAULT_STATE on ENOENT (Pitfall 9). Throws on any other I/O
 * error or on post-migration schema validation failure (caller logs and
 * surfaces).
 *
 * Async best-effort persist of migrated state happens in the background
 * via persistMigratedState; this function does NOT await it. The IL-3
 * sanctioned warn site in migrate.ts handles persist failures.
 */
export async function loadState(extensionRoot: string): Promise<ExtensionState> {
  const stateJsonPath = stateJsonPathFor(extensionRoot);

  let raw: string;
  try {
    raw = await readFile(stateJsonPath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      // Pitfall 9: missing file -> default state (NOT throw).
      return { schemaVersion: 1, marketplaces: {} };
    }

    throw new Error(`Failed to read ${stateJsonPath}: ${errorMessage(err)}`, { cause: err });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`state.json at ${stateJsonPath} is not valid JSON: ${errorMessage(err)}`, {
      cause: err,
    });
  }

  // ST-4 / ST-5: normalize legacy records.
  const { marketplaces, mutated } = migrateLegacyMarketplaceRecords(parsed, extensionRoot);

  // ST-6: revalidate stored source records through the SAME factories used at
  // parse time. Three legal storage shapes:
  //   1. raw string (V1 legacy) -> classify via parsePluginSource
  //   2. ParsedSource object (current) -> revalidate via pathSource/githubSource
  //   3. unknown-kind object (forward-compat / NFR-12) -> accept verbatim
  for (const [mpName, mpRaw] of Object.entries(marketplaces)) {
    if (typeof mpRaw !== "object" || mpRaw === null) {
      throw new Error(`state.json marketplace "${mpName}" is not an object`);
    }

    const mp = mpRaw as Record<string, unknown>;
    normalizeStoredSource(mpName, mp);
  }

  const normalized: unknown = { schemaVersion: 1, marketplaces };

  if (!STATE_VALIDATOR.Check(normalized)) {
    throw new Error(
      `state.json at ${stateJsonPath} failed schema validation: ${firstValidationErrorDetail(normalized)}`,
    );
  }

  // ST-4 best-effort async save -- fire-and-forget; the IL-3 sanctioned warn
  // in persistMigratedState handles failure.
  if (mutated) {
    void persistMigratedState(stateJsonPath, normalized);
  }

  return normalized;
}

/**
 * ST-1 / NFR-1 / AS-1: atomic state.json write via shared/atomic-json.ts.
 *
 * Asserts the in-memory state matches the schema before writing -- a
 * caller bug (e.g. mutating a record into an invalid shape) surfaces
 * here instead of producing a corrupt state.json on disk.
 */
export async function saveState(extensionRoot: string, state: ExtensionState): Promise<void> {
  if (!STATE_VALIDATOR.Check(state)) {
    throw new Error(
      `saveState refused: in-memory state failed schema validation: ${firstValidationErrorDetail(state)}`,
    );
  }

  const stateJsonPath = stateJsonPathFor(extensionRoot);
  await atomicWriteJson(stateJsonPath, state);
}
