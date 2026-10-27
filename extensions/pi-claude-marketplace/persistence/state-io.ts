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
import { withoutTagCommit } from "../domain/version.ts";
import { atomicWriteJson } from "../shared/atomic-json.ts";
import { errorMessage } from "../shared/errors.ts";

import { migrateLegacyMarketplaceRecords, persistMigratedState } from "./migrate.ts";

import type { GitHubSource, HostedManifestSource, UrlSource } from "../domain/source.ts";

/**
 * D-100-01 / D-100-02 / ENBL-11: one persisted hook entry -- the event name
 * plus the optional matcher, and NOTHING else.
 *
 * The two properties are the whole payload boundary. Handler material --
 * command strings, arguments, timeouts, environment -- is never written here,
 * so `state.json` does not become a durable copy of a plugin's shell commands
 * and `info` has nothing of the sort to render. The value is a RENDERING
 * source only, never a routing source: registered handlers come from the
 * hydrate walk over the on-disk materialized configuration and from nowhere
 * else, so a fabricated entry can mislead `info` but cannot run.
 *
 * `event` is a plain string rather than a closed union on purpose: a future
 * Claude event token must not invalidate a whole state file. The narrowing to
 * the renderer's closed `HookSummaryEntry` union happens once, at the read
 * boundary (`domain/components/hooks.ts::hookSummaryEntriesFromPersisted`).
 */
const PERSISTED_HOOK_ENTRY_SCHEMA = Type.Object({
  event: Type.String(),
  matcher: Type.Optional(Type.String()),
});

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
 *
 * D-04-01 / D-04-03: `provenance` is REQUIRED (schemaVersion 3+) and states
 * how the plugin got here -- `"explicit"` when the user named it, `"dependency"`
 * when another plugin's declaration pulled it in. The migration fills
 * `"explicit"` for every record that lacks the field via
 * `ensurePluginProvenance` before validation runs, so schemaVersion 1 and 2
 * state.json files load cleanly. `"explicit"` is the truthful default rather
 * than a guess: no released build ran a dependency cascade, so every record a
 * released build wrote is a plugin the user asked for by name.
 *
 * COMPAT-01: the public PluginInstallRecord type and saved records expose the
 * compatibility contract; the schema remains this module's validation boundary.
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
  // GV-01: the semver of the release tag a dependency's version range selected,
  // which Claude Code records as `resolvedVersion` beside a `version` that
  // carries the tag's commit. OPTIONAL and additive -- NO schemaVersion bump
  // (the resolvedSha precedent). Absent when no range selected a tag, and on a
  // record written before GV-01, whose `version` is the tag's semver itself.
  resolvedVersion: Type.Optional(Type.String()),
  // D-100-01 / ENBL-10: the supported hook entries the install materialized.
  // OPTIONAL and additive -- NO schemaVersion bump (the resolvedSha
  // precedent), so a legacy record without it loads unchanged and absence
  // needs no migrate fill.
  //
  // ABSENCE MEANS "this record predates the key": the reader falls through to
  // the materialized-file read. That is a DIFFERENT fact from a present empty
  // array, which means "this plugin declares no supported hooks" -- a
  // completed answer carrying zero entries. Records self-heal on the next
  // install, update, reinstall or enable; there is no backfill (D-100-09).
  //
  // Two payload boundaries, both enforced by PERSISTED_HOOK_ENTRY_SCHEMA
  // above: the entries are the SUPPORTED subset only (D-100-02), and no
  // handler payload is recorded, so the value is a rendering source and never
  // a routing source.
  //
  // Named for the entries themselves because `resources.hooks` already holds
  // a different fact -- the hooks CONTAINER slug.
  hookEntries: Type.Optional(Type.Array(PERSISTED_HOOK_ENTRY_SCHEMA)),
  // LOAD-02 / D-06-01: the record is disabled as a CONSEQUENCE of a
  // declaration the load-time check found unsatisfied, not by a user choice.
  // OPTIONAL and additive -- NO schemaVersion bump (the resolvedSha /
  // hookEntries precedent), so a legacy record without it loads unchanged and
  // absence needs no migrate fill.
  //
  // ABSENCE MEANS "not currently held down by the check". It is never a claim
  // that the check ran and found nothing: the verdict is re-derived live on
  // every reconcile pass, and this boolean only answers whether the record is
  // held down right now. A widening into a reason enum would make it a durable
  // claim about WHY, which nothing keeps honest.
  dependencyDisabled: Type.Optional(Type.Boolean()),
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
    // WLIF-01: the workflow envelopes this install placed. Required, like
    // every sibling axis, so each construction site is compile-forced to
    // answer for it. It is the ONLY inventory of those envelopes that
    // survives the process -- they sit outside every scope root and nothing
    // on disk can be enumerated to rediscover them.
    workflows: Type.Array(Type.String()),
  }),
  enabled: Type.Boolean(),
  // D-04-01: the mode only. A declarer list would be a cache of another
  // plugin's manifest that nothing keeps honest; prune re-derives "does
  // anything still need this?" from the installed declarations instead.
  provenance: Type.Union([Type.Literal("explicit"), Type.Literal("dependency")]),
  installedAt: Type.String(),
  updatedAt: Type.String(),
});

/** The permissive stored shape -- any `enabled` + `resources` combination. */
export type PluginInstallRecord = Type.Static<typeof PLUGIN_INSTALL_RECORD_SCHEMA>;

/**
 * ENBL-02 / ENBL-18 / D-100-10: the disable transform's guarantee, expressed
 * in the type system.
 *
 * `enabled` is the sole disable marker, and disabling changes `enabled` and
 * `updatedAt` and NOTHING ELSE. The record is a description of the
 * INSTALLATION, not a mirror of the current disk contents: the disable cascade
 * still unstages every artifact of all six kinds (ENBL-13 / D-100-04), but the
 * record keeps naming what the install materialized, so `info` can report what
 * a disabled plugin contains -- including after its marketplace manifest entry
 * has disappeared and nothing else can answer.
 *
 * The resources shape rides through as the type parameter `R`, so a producer
 * returning a record whose `resources` differs from its input's is a compile
 * error. `toDisabledRecord` is the sole sanctioned producer; the disable
 * orchestrator routes through it (replacing the record in the map) instead of
 * mutating fields in place, so the type survives to the assignment. Because the
 * generic constrains only the producer, the behavioral proof that disable
 * preserves the inventory lives in the orchestrator suite.
 */
export type DisabledPluginRecord<
  R extends PluginInstallRecord["resources"] = PluginInstallRecord["resources"],
> = PluginInstallRecord & {
  enabled: false;
  resources: R;
};

/**
 * ENBL-18 / D-100-10: build the disabled form of a plugin record -- set
 * `enabled: false`, stamp `updatedAt`, preserve everything else including every
 * `resources.*` array. The `resources: R` passthrough in the return type makes
 * any change to the inventory a compile error here at the producer.
 */
export function toDisabledRecord<R extends PluginInstallRecord["resources"]>(
  record: PluginInstallRecord & { resources: R },
  updatedAt: string,
): DisabledPluginRecord<R> {
  return {
    ...record,
    enabled: false,
    updatedAt,
  };
}

/**
 * ENBL-05: the SOLE disabled-state predicate -- the read side of the shape
 * {@link toDisabledRecord} writes. Every surface that asks "is this record
 * currently disabled" consumes this one definition; a module that re-derives
 * the rule locally is a drift twin the gate in
 * `test/architecture/disabled-state-classification.test.ts` rejects. That
 * gate WALKS the whole extension source tree rather than an allowlist of
 * known sites, so the claim holds for a copy landing anywhere -- this module
 * is the single exemption, because reading the boolean here IS the
 * definition.
 *
 * The availability axis (`compatibility.installable`) is deliberately NOT an
 * input. The disable orchestrator is the only writer of `enabled: false` and
 * it places no availability guard before writing, so a soft-degraded record
 * can be explicitly disabled too; reading both axes merged those two
 * independent facts and left the disabled partial unrecognized everywhere.
 * Degraded-ness and disabled-ness are orthogonal: a record with
 * `installable: false` and `enabled: true` is degraded, NOT disabled, and
 * must keep materializing its supported components.
 *
 * The `resources.*` arrays are not read either: emptiness is a consequence of
 * disabling, never the marker (a hooks-only plugin is legitimately installed
 * with four empty arrays, and the transient post-migration shape is enabled
 * with five).
 *
 * Structural parameter so every caller's record view satisfies it directly.
 */
export function isRecordedButDisabled(record: { readonly enabled: boolean }): boolean {
  return !record.enabled;
}

/**
 * GV-01: the version a dependency's version range reads for a record -- the
 * tag's semver when a range selected one, as Claude Code reads
 * `resolvedVersion` first, else the recorded version without the commit a
 * pinned `anthropic-plugin-directory` plugin carries, as Claude Code reads
 * the plugin's declared version.
 */
export function rangeVersionOf(record: {
  readonly version: string;
  readonly resolvedVersion?: string;
  readonly resolvedSha?: string;
}): string {
  return record.resolvedVersion ?? withoutTagCommit(record.version, record.resolvedSha);
}

/**
 * GV-01: a record as a move to a catalog `version` leaves it. No release tag
 * selected that version, so the record keeps no tag version for a range to
 * read.
 */
export function atCatalogVersion(
  record: PluginInstallRecord,
  version: string,
): PluginInstallRecord {
  const moved = { ...record, version };
  delete moved.resolvedVersion;
  return moved;
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
  // Comparison metadata from the last successful add or refresh, never a source.
  lastSuccessfulManifest: Type.Optional(Type.String()),
  // SPLIT-01 / D-12: `autoupdate` field REMOVED from MARKETPLACE_RECORD_SCHEMA.
  // It lives in CONFIG_SCHEMA (per-marketplace config entry) now. Legacy
  // state.json that still has the field loads cleanly via typebox's lenient
  // default; the D-13-gated scrub in migrate.ts removes it post-migration.
  plugins: Type.Record(Type.String(), PLUGIN_INSTALL_RECORD_SCHEMA),
});

/**
 * ST-1: state.json shape. schemaVersion 1 is the pre-ENBL-02 shape (no
 * `enabled` field on plugin records); schemaVersion 2 is the ENBL-02 shape
 * (`enabled: boolean` required); schemaVersion 3 is the D-04-03 shape
 * (`provenance` required). The union lets loadState accept all three during
 * the migration cycle; `persistMigratedState` always writes schemaVersion 3.
 */
const STATE_SCHEMA = Type.Object({
  schemaVersion: Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)]),
  // BFILL-02 / D-68-01: the last extension version that reconciled this state.
  // OPTIONAL and additive -- NO schemaVersion bump, so an old doc without it
  // loads unchanged. D-13: it no longer gates anything and nothing writes it;
  // it stays readable, with no migration, so a file that carries it loads and
  // saves byte-stable.
  lastReconciledExtensionVersion: Type.Optional(Type.String()),
  marketplaces: Type.Record(Type.String(), MARKETPLACE_RECORD_SCHEMA),
});

export type ExtensionState = Type.Static<typeof STATE_SCHEMA>;

/** JIT-compiled validator (D-07). */
const STATE_VALIDATOR = Compile(STATE_SCHEMA);

/** First-load default (ENOENT and empty treated identically). */
export const DEFAULT_STATE: ExtensionState = Object.freeze({
  schemaVersion: 3,
  marketplaces: {},
});

/** Path to state.json given an extensionRoot. */
function stateJsonPathFor(extensionRoot: string): string {
  return path.join(extensionRoot, "state.json");
}

/** Format the first validator error into a single-line message. */
function firstValidationErrorDetail(first: {
  readonly instancePath: string;
  readonly message: string;
}): string {
  return `${first.instancePath || "<root>"}: ${first.message}`;
}

/**
 * MURL-01/MURL-05: revalidate a stored url source through the SAME parser
 * funnel (ST-6) so the .git-canonical url + optional #ref are recomputed.
 * Any other parse, a github shorthand included, is a corrupt record.
 */
function revalidateStoredUrlSource(mpName: string, raw: string): UrlSource | GitHubSource {
  const parsedSrc = parsePluginSource(raw);
  // D-76-02: an https github.com url parses as `github`, and the record migrates to that kind.
  if (parsedSrc.kind === "url" || (parsedSrc.kind === "github" && raw.startsWith("https://"))) {
    return parsedSrc;
  }

  throw new Error(`state.json marketplace "${mpName}" has an invalid url source: ${raw}`);
}

/**
 * D-PL5-05 / ST-6: revalidate a stored hosted source through the SAME parser
 * funnel, so its fragment-free url is recomputed. Any other parse is a
 * corrupt record.
 */
function revalidateStoredHostedSource(mpName: string, raw: string): HostedManifestSource {
  const parsedSrc = parsePluginSource(raw);
  if (parsedSrc.kind === "hosted") {
    return parsedSrc;
  }

  throw new Error(`state.json marketplace "${mpName}" has an invalid hosted source: ${raw}`);
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
    mp.source = revalidateStoredUrlSource(mpName, obj.raw);
  } else if (obj.kind === "hosted" && typeof obj.raw === "string") {
    mp.source = revalidateStoredHostedSource(mpName, obj.raw);
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
 * By default, migrated state persists in the background via
 * persistMigratedState; this function does NOT await it. Pass
 * `persistMigration: false` for a read-only snapshot. The IL-3 sanctioned
 * warn site in migrate.ts handles persist failures.
 */
export async function loadState(
  extensionRoot: string,
  options: { readonly persistMigration?: boolean } = {},
): Promise<ExtensionState> {
  const stateJsonPath = stateJsonPathFor(extensionRoot);

  let raw: string;
  try {
    raw = await readFile(stateJsonPath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      // Missing file -> default state (NOT throw).
      return { schemaVersion: 3, marketplaces: {} };
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

  const parsedRecord =
    typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  if (
    parsedRecord !== undefined &&
    Object.hasOwn(parsedRecord, "schemaVersion") &&
    parsedRecord.schemaVersion !== 1 &&
    parsedRecord.schemaVersion !== 2 &&
    parsedRecord.schemaVersion !== 3
  ) {
    throw new Error(`state.json at ${stateJsonPath} has an unsupported schema version`);
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
  // (pinned by a drift-guard test in test/persistence/state-io.test.ts).
  // We do NOT import `locationsFor` here because the external
  // `loadState` keeps the extension-root path contract for orchestrator callers.
  const baseConfigJsonPath = path.join(path.dirname(extensionRoot), "claude-plugins.json");
  const scrubAutoupdate = existsSync(baseConfigJsonPath);
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
  for (const [mpName, mp] of Object.entries(marketplaces)) {
    normalizeStoredSource(mpName, mp);
  }

  // BFILL-02 / D-68-01 / D-13: thread the optional stamp from the parsed root
  // onto the rebuilt object. The normalization rebuilds { schemaVersion,
  // marketplaces } and would otherwise SILENTLY DROP this top-level field, so a
  // file that carries it would lose it on the next save. Only a string is
  // carried through; a non-string or absent stamp is ignored.
  const reconciliationStamp = parsedRecord?.lastReconciledExtensionVersion;
  const normalized: unknown =
    typeof reconciliationStamp === "string"
      ? {
          schemaVersion: 3,
          lastReconciledExtensionVersion: reconciliationStamp,
          marketplaces,
        }
      : { schemaVersion: 3, marketplaces };

  const [validationError] = STATE_VALIDATOR.Errors(normalized);
  if (validationError !== undefined) {
    throw new Error(
      `state.json at ${stateJsonPath} failed schema validation: ${firstValidationErrorDetail(validationError)}`,
    );
  }

  // No schema issues proves the normalized JSON has the public state shape.
  const state = normalized as ExtensionState;

  // ST-4 best-effort async save -- fire-and-forget; the IL-3 sanctioned warn
  // in persistMigratedState handles failure. Preview explicitly suppresses it.
  if (mutated && options.persistMigration !== false) {
    void persistMigratedState(stateJsonPath, state);
  }

  return state;
}

/**
 * ST-1 / NFR-1 / AS-1: atomic state.json write via shared/atomic-json.ts.
 *
 * Asserts the in-memory state matches the schema before writing -- a
 * caller bug (e.g. mutating a record into an invalid shape) surfaces
 * here instead of producing a corrupt state.json on disk.
 */
export async function saveState(extensionRoot: string, state: ExtensionState): Promise<void> {
  const [validationError] = STATE_VALIDATOR.Errors(state);
  if (validationError !== undefined) {
    throw new Error(
      `saveState refused: in-memory state failed schema validation: ${firstValidationErrorDetail(validationError)}`,
    );
  }

  const stateJsonPath = stateJsonPathFor(extensionRoot);
  await atomicWriteJson(stateJsonPath, state);
}
