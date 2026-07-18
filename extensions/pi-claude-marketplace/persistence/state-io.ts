// persistence/state-io.ts
//
// STATE_SCHEMA (ST-1, ST-2, ST-3) + loadState (ST-4..6 funneling) +
// saveState (NFR-1 / AS-1 via atomicWriteJson).
//
// ENOENT and missing/empty marketplaces map are treated identically as
// DEFAULT_STATE. Per ST-6, source records flow through
// pathSource/githubSource at load time -- the SAME factories used at
// marketplace-add parse time.
//
// Per D-09, state shape nests plugins under their owning
// marketplace; the (mp, plugin) tuple is the natural composite key.
//
// This layer is INTRA-PROCESS only; cross-process
// safety is NOT claimed. withStateGuard enforces the
// single-writer-at-a-time discipline; cross-process races resolve
// last-writer-wins via write-file-atomic's queue.
//
// SECURITY (T-02-16): the schema accepts any string for `manifestPath`
// and `marketplaceRoot`. Containment of THOSE paths is the responsibility
// of the marketplace orchestrators when they read the manifest file
// (assertPathInside applied at read site). This layer loads the value
// verbatim.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import Type from "typebox";
import { Compile } from "typebox/compile";

import { githubSource, parsePluginSource, pathSource } from "../domain/source.ts";
import { atomicWriteJson } from "../shared/atomic-json.ts";
import { errorMessage } from "../shared/errors.ts";

import { migrateLegacyMarketplaceRecords, persistMigratedState } from "./migrate.ts";

/**
 * ST-3: per-plugin install record (D-09 nesting under marketplaces.<mp>.plugins).
 *
 * HOOK-02 / D-57-01: `resources.hooks` is REQUIRED (string[]). It holds
 * the plugin's hooks-container-dir generatedName per D-57-03 (zero or one
 * entry; mirrors the skills/prompts/agents/mcpServers generatedName
 * discipline -- state.json never holds absolute paths). The migration is
 * additive: `ensurePluginResources` in persistence/migrate.ts fills
 * `hooks: []` before validation runs, so v1.0..v1.12 state.json files
 * load cleanly.
 *
 * ENBL-02: `enabled: boolean` is REQUIRED (schemaVersion 2+). The migration
 * fills `enabled: true` for all existing records via `ensurePluginEnabled`
 * before validation runs, so v1.0..v1.13 state.json files load cleanly.
 * `enabled: false` is the sole disable marker; `true` means active.
 */
const PLUGIN_INSTALL_RECORD_SCHEMA = Type.Object({
  version: Type.String(),
  resolvedSource: Type.String(),
  // D-77-02 / PURL-09: the full 40-hex resolved commit sha for git-source
  // installs. OPTIONAL and additive -- NO schemaVersion bump (mirrors the
  // lastReconciledExtensionVersion precedent), so a legacy record without it
  // loads unchanged and absence needs no migrate fill. Git-source-only:
  // path/github-name installs omit it. Reinstall uses THIS full sha as its
  // re-clone checkout pin; clone GC presence-checks it to derive live keys.
  resolvedSha: Type.Optional(Type.String()),
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
    hooks: Type.Array(Type.String()),
  }),
  enabled: Type.Boolean(),
  installedAt: Type.String(),
  updatedAt: Type.String(),
});

/** The permissive stored shape -- any `enabled` + `resources` combination. */
export type PluginInstallRecord = Type.Static<typeof PLUGIN_INSTALL_RECORD_SCHEMA>;

/**
 * ENBL-02 two-signal invariant, expressed in the type system.
 *
 * The stored record permits any `enabled` + `resources` combination, but
 * only three are legal: enabled + populated (active), disabled + empty (the
 * disable terminal state), and enabled + empty (the transient
 * post-migration / pre-self-heal shape). The fourth -- disabled + populated
 * -- is the contradiction these branded types forbid: `DisabledPluginRecord`
 * pins every resources array to the empty tuple `[]`, so a literal carrying a
 * non-empty array is a compile error. `toDisabledRecord` is the sole
 * sanctioned producer; the disable orchestrator routes through it (replacing
 * the record in the map) instead of mutating fields in place, so the branded
 * type survives to the assignment.
 */
export type EnabledPluginRecord = PluginInstallRecord & { enabled: true };
export type DisabledPluginRecord = PluginInstallRecord & {
  enabled: false;
  resources: {
    skills: [];
    prompts: [];
    agents: [];
    mcpServers: [];
    hooks: [];
  };
};

/**
 * Build the disabled form of a plugin record: preserve version /
 * resolvedSource / compatibility / installedAt, reset every resources array
 * to empty, set `enabled: false`, and stamp `updatedAt`. The empty-tuple
 * return type makes "disabled but populated" unrepresentable at the call site.
 */
export function toDisabledRecord(
  record: PluginInstallRecord,
  updatedAt: string,
): DisabledPluginRecord {
  return {
    ...record,
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled: false,
    updatedAt,
  };
}

/**
 * ST-2: per-marketplace record. `source` is `Type.Unknown()` so the schema
 * accepts whatever shape ST-6 funnel produced (PathSource | GitHubSource);
 * cross-shape validation lives in domain/source.ts. The schema's job is
 * the structural envelope; the funnel is the semantic gate.
 */
const MARKETPLACE_RECORD_SCHEMA = Type.Object({
  name: Type.String(),
  scope: Type.Union([Type.Literal("user"), Type.Literal("project")]),
  // D-14: `source` KEEPS on the state record (materialized machine fact). The
  // user-authored desired-state `source` lives on `CONFIG_SCHEMA` in
  // `persistence/config-io.ts`; the two are deliberately separate per the
  // ownership split.
  source: Type.Unknown(),
  addedFromCwd: Type.String(),
  manifestPath: Type.String(),
  marketplaceRoot: Type.String(),
  lastUpdatedAt: Type.Optional(Type.String()),
  // SPLIT-01 / D-12: `autoupdate` field REMOVED from MARKETPLACE_RECORD_SCHEMA.
  // It lives in CONFIG_SCHEMA (per-marketplace config entry) now. Legacy
  // state.json that still has the field loads cleanly via typebox's lenient
  // default; the D-13-gated scrub in migrate.ts removes it post-migration.
  plugins: Type.Record(Type.String(), PLUGIN_INSTALL_RECORD_SCHEMA),
});

/**
 * ST-1: state.json shape. schemaVersion 1 is the pre-ENBL-02 shape (no
 * `enabled` field on plugin records); schemaVersion 2 is the ENBL-02 shape
 * (`enabled: boolean` required). The union lets loadState accept both during
 * the migration cycle; `persistMigratedState` always writes schemaVersion 2.
 */
export const STATE_SCHEMA = Type.Object({
  schemaVersion: Type.Union([Type.Literal(1), Type.Literal(2)]),
  // BFILL-02 / D-68-01: the last extension version that reconciled this state.
  // OPTIONAL and additive -- NO schemaVersion bump. An absent stamp means
  // scan-once (treated as version-changed) so an old doc without it loads
  // unchanged and the next save writes it. It gates the load-time backfill
  // scan, which only fires when this differs from EXTENSION_VERSION (the sole
  // thing that can move the supported-kind boundary).
  lastReconciledExtensionVersion: Type.Optional(Type.String()),
  marketplaces: Type.Record(Type.String(), MARKETPLACE_RECORD_SCHEMA),
});

export type ExtensionState = Type.Static<typeof STATE_SCHEMA>;

/** JIT-compiled validator (D-07). */
export const STATE_VALIDATOR = Compile(STATE_SCHEMA);

/** First-load default (ENOENT and empty treated identically). */
export const DEFAULT_STATE: ExtensionState = Object.freeze({
  schemaVersion: 2,
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
  } else if (obj.kind === "url" && typeof obj.raw === "string") {
    // MURL-01/MURL-05: revalidate a stored url source through the SAME parser
    // funnel (ST-6) so the .git-canonical url + optional #ref are recomputed.
    // Anything that no longer classifies as url is a corrupt record.
    const parsedSrc = parsePluginSource(obj.raw);
    if (parsedSrc.kind !== "url") {
      throw new Error(`state.json marketplace "${mpName}" has an invalid url source: ${obj.raw}`);
    }

    mp.source = parsedSrc;
  } else if (obj.kind !== "unknown") {
    throw new Error(
      `state.json marketplace "${mpName}" has malformed source object (missing kind/raw)`,
    );
  }
}

/**
 * ST-1, ST-4, ST-5, ST-6: load + migrate + revalidate state.json.
 *
 * Returns DEFAULT_STATE on ENOENT. Throws on any other I/O
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
      // Missing file -> default state (NOT throw).
      return { schemaVersion: 2, marketplaces: {} };
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

  // ST-4 / ST-5 / D-13: normalize legacy records. The third argument is the
  // D-13 ORDERING RAIL gate: the `autoupdate` scrub fires only when the
  // scope's `claude-plugins.json` already exists, preserving the legacy
  // field on the first load before the first-run migration has
  // captured it. The gate predicate lives HERE (not inside the migrator) so
  // `migrateLegacyMarketplaceRecords` stays a pure function with no hidden
  // I/O, and the D-13 gate decision is visible at the load seam where the
  // path is derived. The SYNC `existsSync` probe is taken once, before the
  // fully-synchronous migrate call, so the gate cannot race the in-memory
  // transform. `extensionRoot` is `<scopeRoot>/pi-claude-marketplace`, so
  // `path.dirname(extensionRoot)` is `<scopeRoot>` and the config sits as a
  // sibling at `<scopeRoot>/claude-plugins.json` -- this matches the
  // `locationsFor` construction in `persistence/locations.ts` byte-for-byte
  // (pinned by a drift-guard test in tests/persistence/state-io.test.ts).
  // We do NOT import `locationsFor` here because the external
  // `loadState(extensionRoot)` signature MUST stay unchanged for
  // orchestrator callers.
  const configJsonPath = path.join(path.dirname(extensionRoot), "claude-plugins.json");
  const scrubAutoupdate = existsSync(configJsonPath);
  const { marketplaces, mutated } = migrateLegacyMarketplaceRecords(
    parsed,
    extensionRoot,
    scrubAutoupdate,
  );

  // ST-6: revalidate stored source records through the SAME factories used at
  // parse time. Three legal storage shapes:
  //   1. raw string -> classify via parsePluginSource
  //   2. ParsedSource object -> revalidate via pathSource/githubSource
  //   3. unknown-kind object (forward-compat / NFR-12) -> accept verbatim
  for (const [mpName, mpRaw] of Object.entries(marketplaces)) {
    if (typeof mpRaw !== "object" || mpRaw === null) {
      throw new Error(`state.json marketplace "${mpName}" is not an object`);
    }

    const mp = mpRaw as Record<string, unknown>;
    normalizeStoredSource(mpName, mp);
  }

  // BFILL-02 / D-68-01: thread the optional stamp from the parsed root onto
  // the rebuilt object. The normalization rebuilds { schemaVersion,
  // marketplaces } and would otherwise SILENTLY DROP this top-level field,
  // leaving the backfill gate permanently open. Only a string is carried
  // through; a non-string or absent stamp is ignored (absent = scan-once).
  const parsedRoot = parsed as { lastReconciledExtensionVersion?: unknown };
  const normalized: unknown =
    typeof parsedRoot.lastReconciledExtensionVersion === "string"
      ? {
          schemaVersion: 2,
          lastReconciledExtensionVersion: parsedRoot.lastReconciledExtensionVersion,
          marketplaces,
        }
      : { schemaVersion: 2, marketplaces };

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
