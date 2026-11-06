// persistence/agents-index-io.ts
//
// AG-2 / AG-4 / D-07: load + save for agents-index.json. ENOENT-on-missing
// returns an empty index, file-level corruption throws, per-row corruption
// drops the row + accumulates messages into corruptions[] for the
// caller to surface (IL-3 sanctioned warn path).
//
// AG-4 discipline:
//   File-level (parse fail / missing schemaVersion / schemaVersion ≠ 1
//                / missing or non-array `agents` field) -> THROW.
//   Per-row (TypeBox Check fails on a single row) -> DROP row, push
//                                                    corruption message.
//
// Wire field name `agents:`; see agents-index-schema.ts for the rationale
// and AGENTS_INDEX_VALIDATOR rejection of `entries:`.
//
// AGENTIDXFORM-01: `loadAgentsIndex` parses each row's grant pair
// (`mcpImplementation` and `mcpForms`) into an `AgentsIndexRow`, whose type
// requires the stored form of the implementation the row records. Only a
// hand edit writes a pair that breaks this. Such a row loads without both
// fields and adds no corruption: a corruption drops the row, which would
// orphan its agent file. One `mcp` debug line names the row, and nothing
// reaches the user (RECON-05). `saveAgentsIndex` takes only `AgentsIndexRow`
// rows and writes them as the schema's `AgentsIndex`, schemaVersion 1.
//
// IMPLEMENTATION NOTE: this module derives the on-disk path from
// `loc.extensionRoot` rather than `loc.agentsIndexPath`.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { atomicWriteJson } from "../shared/atomic-json.ts";
import { hookDebugLog } from "../shared/debug-log.ts";
import { errorMessage } from "../shared/errors.ts";

import {
  AGENTS_INDEX_ENTRY_VALIDATOR,
  AGENTS_INDEX_VALIDATOR,
  type AgentsIndex,
  type AgentsIndexEntry,
} from "./agents-index-schema.ts";

import type { ScopedLocations } from "./locations.ts";
import type { McpImplementationId } from "../domain/mcp-implementation.ts";

/** MGRT-01: one implementation's stored grant form of an agent. */
export type AgentGrantForm = NonNullable<NonNullable<AgentsIndexEntry["mcpForms"]>["adapter"]>;

/**
 * AGENTIDXFORM-01: a stored grant pair. `mcpImplementation` names the form
 * the agent file holds, and `mcpForms` always stores that form. It stores
 * the other implementation's form when that form maps the agent's tools
 * (AG-11).
 */
export type StoredGrantForms =
  | {
      readonly mcpImplementation: "adapter";
      readonly mcpForms: { readonly adapter: AgentGrantForm; readonly builtin?: AgentGrantForm };
    }
  | {
      readonly mcpImplementation: "builtin";
      readonly mcpForms: { readonly builtin: AgentGrantForm; readonly adapter?: AgentGrantForm };
    };

/** AGENTIDXFORM-01: a row's grant fields: no stored pair, or a stored pair. */
export type AgentGrantFormFields =
  { readonly mcpImplementation?: never; readonly mcpForms?: never } | StoredGrantForms;

/**
 * AGENTIDXFORM-01: an agents-index row as the extension reads and writes it.
 * The type requires the stored form of the implementation a row records.
 * Field names and JSON shape are the on-disk ones, so every such row is a
 * valid `AgentsIndexEntry`.
 */
export type AgentsIndexRow = Omit<AgentsIndexEntry, "mcpImplementation" | "mcpForms"> &
  AgentGrantFormFields;

/**
 * AGENTIDXFORM-01: builds a stored pair. The file holds `heldForm`, the form
 * of `held`. `otherForm` is the other implementation's form; it is undefined
 * when that implementation maps the agent's tools to nothing (AG-11).
 */
export function storedGrantForms(
  held: McpImplementationId,
  heldForm: AgentGrantForm,
  otherForm: AgentGrantForm | undefined,
): StoredGrantForms {
  if (held === "adapter") {
    return {
      mcpImplementation: "adapter",
      mcpForms: { adapter: heldForm, ...(otherForm === undefined ? {} : { builtin: otherForm }) },
    };
  }

  return {
    mcpImplementation: "builtin",
    mcpForms: { builtin: heldForm, ...(otherForm === undefined ? {} : { adapter: otherForm }) },
  };
}

/** The agents-index document `saveAgentsIndex` writes. */
export interface AgentsIndexDocument {
  readonly schemaVersion: 1;
  readonly agents: readonly AgentsIndexRow[];
}

/**
 * In-memory shape returned by loadAgentsIndex.
 *
 * Adds `corruptions` -- a frozen, per-row warning list the caller
 * surfaces via warnings[] in the bridge CommitResult.
 *
 * `corruptions` is NOT persisted: saveAgentsIndex writes only the
 * schemaVersion and the rows of the AgentsIndexDocument it takes.
 */
export interface LoadedAgentsIndex extends AgentsIndexDocument {
  readonly corruptions: readonly string[];
}

/** Path to agents-index.json given a ScopedLocations bundle. */
function agentsIndexPathFor(loc: ScopedLocations): string {
  return path.join(loc.extensionRoot, "agents-index.json");
}

/**
 * AGENTIDXFORM-01: whether a row has no stored pair, or records an
 * implementation whose form `mcpForms` stores.
 */
function hasMatchedGrantForms(row: AgentsIndexEntry): row is AgentsIndexRow {
  if (row.mcpImplementation === undefined) {
    return row.mcpForms === undefined;
  }

  return row.mcpForms?.[row.mcpImplementation] !== undefined;
}

/**
 * AGENTIDXFORM-01 / RECON-05: a schema-valid row as an `AgentsIndexRow`. A
 * row whose pair does not match loads without both fields and writes one
 * `mcp` debug line.
 */
function parseAgentsIndexRow(row: AgentsIndexEntry): AgentsIndexRow {
  if (hasMatchedGrantForms(row)) {
    return row;
  }

  const { mcpImplementation, mcpForms, ...rest } = row;
  const storedKeys = Object.keys(mcpForms ?? {}).join(",");
  hookDebugLog(
    `agent ${rest.generatedName}: stored grant forms ignored: mcpImplementation ${String(mcpImplementation)}, mcpForms [${storedKeys}]`,
    "mcp",
  );
  return rest;
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
 * preservation invariant).
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
  const obj = parsed as { agents?: unknown };
  if (!Array.isArray(obj.agents)) {
    throw new TypeError(`Invalid agents-index at ${indexPath}: 'agents' field must be an array.`);
  }

  // Per-row: validate each, accumulate corruptions.
  const validAgents: AgentsIndexRow[] = [];
  const corruptions: string[] = [];
  for (let i = 0; i < obj.agents.length; i++) {
    const row: unknown = obj.agents[i];
    if (AGENTS_INDEX_ENTRY_VALIDATOR.Check(row)) {
      validAgents.push(parseAgentsIndexRow(row));
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
 * write -- refuses on schema violation rather than persisting bad data.
 * The atomic write itself goes through `atomicWriteJson`, which uses
 * write-file-atomic (tmp + fsync + rename + concurrent-write queue).
 *
 * AGENTIDXFORM-01: every `AgentsIndexRow` is an on-disk row as it is, so the
 * document saves as the schema's `AgentsIndex` with no conversion.
 */
export async function saveAgentsIndex(
  loc: ScopedLocations,
  index: AgentsIndexDocument,
): Promise<void> {
  const document: AgentsIndex = { schemaVersion: index.schemaVersion, agents: [...index.agents] };
  if (!AGENTS_INDEX_VALIDATOR.Check(document)) {
    throw new Error("saveAgentsIndex refused: index does not match AGENTS_INDEX_SCHEMA.");
  }

  await atomicWriteJson(agentsIndexPathFor(loc), document);
}
