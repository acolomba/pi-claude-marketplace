// persistence/agents-index-io.ts
//
// AG-2 / AG-4 / D-07: load + save for agents-index.json. Mirrors the
// Phase 2 state-io.ts structural template -- ENOENT-on-missing returns
// an empty index, file-level corruption throws, per-row corruption
// drops the row + accumulates messages into corruptions[] for the
// caller to surface (IL-3 sanctioned warn path).
//
// AG-4 discipline (verbatim from 03-PATTERNS.md lines 707-748):
//   File-level (parse fail / missing schemaVersion / schemaVersion ≠ 1
//                / missing or non-array `agents` field) -> THROW.
//   Per-row (TypeBox Check fails on a single row) -> DROP row, push
//                                                    corruption message.
//
// Wire field name `agents:` is preserved from V1; see agents-index-schema.ts
// for the rationale and AGENTS_INDEX_VALIDATOR rejection of `entries:`.
//
// IMPLEMENTATION NOTE: this module derives the on-disk path from
// `loc.extensionRoot` rather than `loc.agentsIndexPath` to avoid
// coupling to Plan 03-01's parallel-wave ScopedLocations extension.
// Once 03-01 merges, a trivial follow-up can swap in `loc.agentsIndexPath`
// directly. See SUMMARY.md "Open Questions" for tracking.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { atomicWriteJson } from "../shared/atomic-json.ts";
import { errorMessage } from "../shared/errors.ts";

import {
  AGENTS_INDEX_ENTRY_VALIDATOR,
  AGENTS_INDEX_VALIDATOR,
  type AgentsIndex,
  type AgentsIndexEntry,
} from "./agents-index-schema.ts";

import type { ScopedLocations } from "./locations.ts";

/**
 * In-memory shape returned by loadAgentsIndex.
 *
 * Adds `corruptions` -- a frozen, per-row warning list the caller
 * surfaces via warnings[] in the bridge CommitResult (Plan 03-05).
 *
 * `corruptions` is NOT persisted. saveAgentsIndex accepts AgentsIndex
 * (the on-disk shape), not LoadedAgentsIndex.
 */
export interface LoadedAgentsIndex {
  readonly schemaVersion: 1;
  readonly agents: readonly AgentsIndexEntry[];
  readonly corruptions: readonly string[];
}

/** Path to agents-index.json given a ScopedLocations bundle. */
function agentsIndexPathFor(loc: ScopedLocations): string {
  return path.join(loc.extensionRoot, "agents-index.json");
}

/** First validator error formatted as a single-line message. */
function firstEntryErrorDetail(value: unknown): string {
  const errors = AGENTS_INDEX_ENTRY_VALIDATOR.Errors(value);
  const first = errors[0];
  if (!first) {
    return "(no detail available)";
  }

  return `${first.instancePath || "<root>"}: ${first.message}`;
}

/**
 * AG-2 / AG-4: load agents-index.json with file-level-throw,
 * per-row-soft-fail discipline.
 *
 * Behavior:
 *   ENOENT (missing file) -> return empty index (NOT throw; AG-2 first-run).
 *   Parse failure         -> throw (file-level corruption).
 *   schemaVersion missing/!= 1 -> throw (file-level corruption).
 *   `agents` missing or not an array -> throw (file-level corruption).
 *   Per-row TypeBox failure -> drop row, push corruption message.
 *
 * Returned arrays are frozen so the caller cannot accidentally mutate
 * the loaded view (defense-in-depth around the AG-3 cross-owner
 * preservation invariant in Plan 03-05).
 */
export async function loadAgentsIndex(loc: ScopedLocations): Promise<LoadedAgentsIndex> {
  const indexPath = agentsIndexPathFor(loc);

  let text: string;
  try {
    text = await readFile(indexPath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        schemaVersion: 1,
        agents: Object.freeze([]),
        corruptions: Object.freeze([]),
      };
    }

    throw err;
  }

  // File-level: parse.
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new TypeError(`Failed to parse agents-index at ${indexPath}: ${errorMessage(err)}`, {
      cause: err,
    });
  }

  // File-level: schemaVersion check.
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    (parsed as { schemaVersion?: unknown }).schemaVersion !== 1
  ) {
    throw new Error(`Unsupported agents-index schema at ${indexPath}: expected schemaVersion 1.`);
  }

  // File-level: agents-array check.
  const obj = parsed as { schemaVersion: 1; agents?: unknown };
  if (!Array.isArray(obj.agents)) {
    throw new TypeError(`Invalid agents-index at ${indexPath}: 'agents' field must be an array.`);
  }

  // Per-row: validate each, accumulate corruptions.
  const validAgents: AgentsIndexEntry[] = [];
  const corruptions: string[] = [];
  for (let i = 0; i < obj.agents.length; i++) {
    const row: unknown = obj.agents[i];
    if (AGENTS_INDEX_ENTRY_VALIDATOR.Check(row)) {
      validAgents.push(row);
    } else {
      corruptions.push(
        `${indexPath}.agents[${String(i)}]: row failed schema validation (entry dropped) -- ${firstEntryErrorDetail(row)}`,
      );
    }
  }

  return {
    schemaVersion: 1,
    agents: Object.freeze(validAgents),
    corruptions: Object.freeze(corruptions),
  };
}

/**
 * AG-2 / NFR-1: save agents-index.json atomically.
 *
 * Validates the full document against AGENTS_INDEX_VALIDATOR before
 * write -- refuses on schema violation rather than persisting bad data
 * (mirrors Phase 2 saveState pre-write Check, state-io.ts line 212).
 * The atomic write itself goes through `atomicWriteJson`, which uses
 * write-file-atomic@^8 (tmp + fsync + rename + concurrent-write queue).
 */
export async function saveAgentsIndex(loc: ScopedLocations, index: AgentsIndex): Promise<void> {
  if (!AGENTS_INDEX_VALIDATOR.Check(index)) {
    throw new Error("saveAgentsIndex refused: index does not match AGENTS_INDEX_SCHEMA.");
  }

  await atomicWriteJson(agentsIndexPathFor(loc), index);
}
