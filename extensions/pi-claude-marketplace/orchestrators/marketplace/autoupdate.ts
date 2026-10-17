// orchestrators/marketplace/autoupdate.ts
//
// MAU-1, MAU-2, MAU-3, MAU-4 + SC-6 + NFR-5.
//
// Each orchestration emits a single
// notify(opts.ctx, opts.run, { marketplaces: [...] }) call. Outcomes map to
// the 7-entry MarketplaceStatus grammar (+ optional `reasons?:`):
//
//  - enable fresh -> status: "autoupdate enabled"
//  -> `● <mp> [<scope>] <autoupdate>`
//  - disable fresh -> status: "autoupdate disabled"
//  -> `● <mp> [<scope>] <no autoupdate>`
//  - enable idempotent -> status: "skipped", reasons: ["already autoupdate"]
//  -> `● <mp> [<scope>] <autoupdate> {already autoupdate}`
//  severity: "info"
//  - disable idempotent -> status: "skipped", reasons: ["already no autoupdate"]
//  -> `● <mp> [<scope>] <no autoupdate> {already no autoupdate}`
//  severity: "info"
//  - failure (not-found) -> status: "failed"
//  -> `⊘ <mp> [<scope>] (failed)`
//  severity: "error"
//  - empty scopes -> marketplaces: []
//  -> `(no marketplaces)` sentinel
//
// None of these emit the `/reload to pick up changes` trailer:
// `shouldEmitReloadHint` fires only on a PLUGIN row with a state-changing
// status (installed/updated/reinstalled/uninstalled), and an autoupdate flip
// changes a marketplace record, not a Pi-visible resource (SNM-33).
//
// UXG-04 / MSG-GR-5 / D-18-05: the marker-as-outcome row form
// (`● <mp> [<scope>] <autoupdate>` / `<no autoupdate>`) is the emitted form
// on the flip surface, for byte-form parity with the marketplace-list surface
// header. Fresh flips render the bare marker; idempotent flips render the
// marker + the `{already autoupdate}` / `{already no autoupdate}` brace. The
// renderer (shared/notification-dispatch.ts) owns the byte composition; per AGENTS.md IL-2
// all output still flows through notify(). The `autoupdate enabled` /
// `autoupdate disabled` / `skipped` MarketplaceStatus discriminators carry the
// outcome; the REASONS members are `already autoupdate` / `already no
// autoupdate`.
//
// Single orchestrator parameterized by `enable: boolean`. The edge layer maps
// `marketplace autoupdate` -> enable=true and `marketplace noautoupdate` ->
// enable=false.
//
// Flow:
//  scopes = opts.scope !== undefined ? [opts.scope] : ["project", "user"] // SC-6
//  for each scope:
//  withLockedStateTransaction(locations, async (tx) => {
//  result = classifyAutoupdateFlip(tx.state, opts.name, opts.enable) // MAU-1, MAU-3, MAU-4
//  }) // WR-05: classify-only -- state.json is NEVER written by a flip;
//     // the config write-back is the real flip (SPLIT-01)
//  accumulate result.changed[] and result.unchanged[] across scopes
//
//  compose one MarketplaceNotificationMessage per outcome; emit ONE
//  notify(opts.ctx, opts.run,...) call. The caller-supplied order is honored
//  end-to-end; the SC-6 scopes-loop order (project-then-user) is the visible
//  iteration order. No alphabetic sort -- the renderer does not sort and the
//  orchestrator must not re-sort.
//
// NFR-5: zero git surface -- autoupdate never imports platform/git
// or DEFAULT_GIT_OPS.

import path from "node:path";

import { loadConfig } from "../../persistence/config-io.ts";
import { writeBatchedConfigEntries } from "../../persistence/config-write-back.ts";
import { locationsFor } from "../../persistence/locations.ts";
import {
  InvalidMarketplaceManifestError,
  MarketplaceNotFoundError,
  StateLockHeldError,
} from "../../shared/errors.ts";
import { notify } from "../../shared/notification-dispatch.ts";
import { type ContentReason } from "../../shared/notification-types.ts";
import { type PluginFailedMessage } from "../../shared/notification-types.ts";
import {
  notifyWithContext,
  type MarketplaceRows,
  type Plural,
} from "../../shared/notify-context.ts";
import { ownValue, setOwn } from "../../shared/own-key.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";

import { AUTOUPDATE_CONTEXT, NOAUTOUPDATE_CONTEXT } from "./autoupdate.messaging.ts";
import {
  classifyAutoupdateFlip,
  crossScopeFlag,
  marketplaceFailureRows,
  marketplaceLayerVerdict,
} from "./shared.ts";

import type { MarketplaceLayerVerdict } from "./shared.ts";
import type { MarketplaceConfigEntry, ScopeConfig } from "../../persistence/config-io.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * RECON-03 / WR-09: notification mode selector. Mirrors
 * the marketplace add/remove shape. Omitted (undefined) ===
 * `{ mode: "standalone" }` -- byte-identical to today. Orchestrated mode
 * suppresses config write-back so a reconcile-driven flip never clobbers a
 * per-machine override (WR-09 / T-56-02-01).
 */
export type AutoupdateNotifications =
  { readonly mode: "standalone" } | { readonly mode: "orchestrated" };

export interface AutoupdateOptions {
  readonly ctx: NotificationContext;
  /**
   * D-05 / D-07: the command's run, or the bootstrap run when bootstrap drives
   * the flip. Every emission renders from its soft-dependency snapshot, even
   * though marketplace-level rows never carry soft-dep markers.
   */
  readonly run: NotificationRun;
  /** When undefined, flip every marketplace in target scope(s). */
  readonly name?: string;
  /** true -> autoupdate; false -> noautoupdate. */
  readonly enable: boolean;
  /** When undefined, SC-6 enumerates BOTH scopes. */
  readonly scope?: Scope;
  /** Project-scope cwd (ignored for user scope). */
  readonly cwd: string;
  /**
   * WB-01: when true, target
   * `claude-plugins.local.json` instead of `claude-plugins.json`. The base
   * file is NEVER touched on the --local path.
   */
  readonly local?: boolean;
  /**
   * RECON-03 / WR-09: notification mode selector. Omitted === standalone.
   * Orchestrated mode skips config write-back so reconcile-driven flips
   * never clobber per-machine overrides.
   */
  readonly notifications?: AutoupdateNotifications;
}

interface AutoupdateFlipRow {
  readonly name: string;
  readonly scope: Scope;
  readonly alreadyMatching: boolean;
  /**
   * I2 / PR #51: when true, the write-back was skipped because no `source`
   * could be synthesized for a first-time config write. The row renders as a
   * `(failed) {not found}` mp row instead of the success marker, so a name
   * whose config never landed is not reported as a fresh flip.
   */
  readonly writeBackSkipped?: boolean;
}

/** One config file of a scope, as a flip reads and writes it. */
interface FlipLayer {
  readonly filePath: string;
  readonly local: boolean;
  readonly config: ScopeConfig;
}

/**
 * What one scope's flip decides: the names it changes, the names already set,
 * and, per layer file, the names whose entry it writes.
 */
interface FlipPlan {
  readonly changed: readonly string[];
  readonly unchanged: readonly string[];
  readonly writes: ReadonlyMap<FlipLayer, readonly string[]>;
}

type RefusedVerdict = Extract<MarketplaceLayerVerdict, { kind: "refused" }>;

/**
 * Leaves the state lock when the layer gate refuses a named flip, carrying the
 * verdict to the caller, which reports it only when no scope flipped.
 */
class FlipRefused extends Error {
  readonly verdict: RefusedVerdict;
  constructor(verdict: RefusedVerdict) {
    super("flip-refused");
    this.name = "FlipRefused";
    this.verdict = verdict;
  }
}

/** A named flip that the layer gate refused in one scope. */
interface ScopeRefusal {
  readonly scope: Scope;
  readonly verdict: RefusedVerdict;
}

/**
 * The reason of the synthetic failed child (`marketplaceFailureRows`) that
 * carries the underlying autoupdate-flip error to the user; the child's
 * `cause` drives the renderer's depth-5 cause-chain trailer. A held state lock
 * narrows to the `lock held`
 * reason (its message carries the retry hint); a CFG-03 invalid-config abort
 * narrows to `invalid manifest`; anything else falls back to the permissive
 * `not found`.
 *
 * ATTR-05: this row does not carry the missing-marketplace case. An
 * explicit-scope `MarketplaceNotFoundError` routes to the standalone
 * `MarketplaceNotAddedMessage` `{marketplace not added}` variant in
 * `setMarketplaceAutoupdate`, BEFORE this helper is reached, so this helper maps
 * `StateLockHeldError` (-> `lock held`, whose message carries the retry
 * hint), `InvalidMarketplaceManifestError` (-> `invalid manifest`, the
 * CFG-03 arm), and other non-not-found flip errors (-> the permissive `not
 * found` fallback).
 */
function autoupdateFailedReason(err: Error): ContentReason {
  if (err instanceof StateLockHeldError) {
    return "lock held";
  }

  if (err instanceof InvalidMarketplaceManifestError) {
    return "invalid manifest";
  }

  return "not found";
}

/**
 * Selects the command context for the shared autoupdate orchestrator: the
 * `marketplace autoupdate` context when enabling, the `marketplace noautoupdate`
 * context when disabling. Mirrors the enable/disable boolean-flag split.
 */
function flipContextFor(enable: boolean): typeof AUTOUPDATE_CONTEXT | typeof NOAUTOUPDATE_CONTEXT {
  return enable ? AUTOUPDATE_CONTEXT : NOAUTOUPDATE_CONTEXT;
}

/**
 * Renders a per-scope flip failure: a layer refusal, or any error other than a
 * missing marketplace, which the caller reports as `{marketplace not added}`.
 * The synthetic failed child carries the cause, so a held lock keeps its retry
 * hint (the marketplace header carries no `cause`, SNM-10).
 */
function notifyFlipFailure(
  opts: AutoupdateOptions,
  scope: Scope,
  failure: { readonly reason: ContentReason; readonly cause: Error },
  cardinality: "single" | "plural",
): void {
  // OUT-07 / D-12: the flip command is selected by the boolean `opts.enable`
  // flag (mirrors enable/disable); the failed child row dispatches through the
  // command context.
  notifyWithContext(
    opts.ctx,
    opts.run,
    flipContextFor(opts.enable),
    marketplaceFailureRows(opts.name ?? "(unknown)", scope, failure.reason, failure.cause),
    undefined,
    cardinality,
  );
}

function invalidConfigError(basename: string): InvalidMarketplaceManifestError {
  return new InvalidMarketplaceManifestError(`Config file "${basename}" failed schema validation.`);
}

/**
 * CFG-03 (T-56-02-05): loads a layer the flip may write, aborting before any
 * change when it is invalid; the error names the file by its basename only.
 */
async function loadFlipLayer(filePath: string, local: boolean): Promise<FlipLayer> {
  const cfg = await loadConfig(filePath);
  if (cfg.status === "invalid") {
    throw invalidConfigError(path.basename(filePath));
  }

  return { filePath, local, config: cfg.status === "valid" ? cfg.config : { schemaVersion: 1 } };
}

/**
 * Whether a layer's own `autoupdate` value already matches the request. An
 * absent value in the shared layer reads as off (MAU-4). An absent value in
 * the local layer is no value at all, so a flip always writes it, which is how
 * a per-machine override comes to exist.
 */
function layerAlreadySet(layer: FlipLayer, name: string, enable: boolean): boolean {
  const own = ownValue(layer.config.marketplaces, name)?.autoupdate;
  if (own === undefined) {
    return !layer.local && !enable;
  }

  return own === enable;
}

/**
 * Plans a flip over `names`: a name is changed when any of its layers lacks
 * the requested value, and each such layer gets the name in its write batch.
 */
function planFlip(
  names: readonly string[],
  layersOf: (name: string) => readonly FlipLayer[],
  enable: boolean,
): FlipPlan {
  const changed: string[] = [];
  const unchanged: string[] = [];
  const writes = new Map<FlipLayer, string[]>();
  for (const name of names) {
    const stale = layersOf(name).filter((layer) => !layerAlreadySet(layer, name, enable));
    if (stale.length === 0) {
      unchanged.push(name);
      continue;
    }

    changed.push(name);
    for (const layer of stale) {
      writes.set(layer, [...(writes.get(layer) ?? []), name]);
    }
  }

  return { changed, unchanged, writes };
}

/**
 * One batched write per layer file (NFR-3). The patch carries `autoupdate`
 * only, so only an entry the layer already declares is changed.
 */
async function writeFlipPlan(plan: FlipPlan, scopeRoot: string, enable: boolean): Promise<void> {
  for (const [layer, names] of plan.writes) {
    // eslint-disable-next-line no-await-in-loop -- at most two layer files, written one after the other
    await writeBatchedConfigEntries(layer.config, layer.filePath, scopeRoot, {
      marketplaces: Object.fromEntries(names.map((name) => [name, { autoupdate: enable }])),
    });
  }
}

/**
 * LAYER-02 / D-MF-03: a named flip changes only its target layer. The gate
 * stops it, before any write, when the target layer does not declare the
 * marketplace: a refusal when the other layer declares it, not added when
 * neither does, and the CFG-03 failure naming the other file when that file
 * cannot be read.
 */
async function requireTargetDeclares(
  target: FlipLayer,
  otherPath: string,
  name: string,
): Promise<void> {
  const verdict = marketplaceLayerVerdict({
    target: target.config,
    other: await loadConfig(otherPath),
    targetIsLocal: target.local,
    marketplace: name,
  });
  if (verdict.kind === "refused") {
    throw new FlipRefused(verdict);
  }

  if (verdict.kind === "undeclared") {
    throw new MarketplaceNotFoundError(name, []);
  }

  if (verdict.kind === "other-unreadable") {
    throw invalidConfigError(verdict.otherBasename);
  }
}

/**
 * Plans a named flip inside the scope lock. Reconcile-driven flips apply no
 * layer rule (WR-09).
 */
async function planNamedFlip(
  opts: AutoupdateOptions,
  locations: ScopedLocations,
  state: ExtensionState,
  name: string,
): Promise<FlipPlan> {
  const local = opts.local === true;
  const target = await loadFlipLayer(
    local ? locations.configLocalJsonPath : locations.configJsonPath,
    local,
  );
  if (ownValue(state.marketplaces, name) === undefined) {
    throw new MarketplaceNotFoundError(name, []);
  }

  if (opts.notifications?.mode !== "orchestrated") {
    await requireTargetDeclares(
      target,
      local ? locations.configJsonPath : locations.configLocalJsonPath,
      name,
    );
  }

  return planFlip([name], () => [target], opts.enable);
}

/**
 * Reclassify both state-side `changed` AND state-side `unchanged` names
 * against the CONFIG-side `autoupdate` truth (SPLIT-01). The
 * config (claude-plugins.json) is the new source of truth. The D-13 scrub
 * strips legacy `autoupdate` from state once the config file exists.
 *
 * Two reclassification directions:
 *  - `changed` -> `unchanged`: when the config already carries the
 *    requested `enable` value, the write-back is a no-op (RECON-05 mtime
 *    stability).
 *  - `unchanged` -> `changed`: when the state-side classifier saw "nothing
 *    to do" (because the D-13 scrub stripped state.autoupdate so it reads
 *    as undefined === false), BUT the config-side truth is the OPPOSITE
 *    of `enable`, the user's flip is a real change that MUST land in the
 *    config. Without this promotion, a `disable` issued after a previous
 *    `enable` (config=true; state.autoupdate scrubbed to undefined) would
 *    silently no-op even though the user's intent is the opposite of the
 *    config truth. A MISSING config entry / missing `autoupdate` field
 *    keeps the state-side classification as-is.
 */
function reclassifyByConfigTruth(
  current: ScopeConfig,
  result: { changed: readonly string[]; unchanged: readonly string[] },
  enable: boolean,
): { changed: readonly string[]; unchanged: readonly string[] } {
  const reallyChanged: string[] = [];
  const reallyUnchanged: string[] = [];

  for (const name of result.changed) {
    if (ownValue(current.marketplaces, name)?.autoupdate === enable) {
      reallyUnchanged.push(name);
    } else {
      reallyChanged.push(name);
    }
  }

  for (const name of result.unchanged) {
    const configValue = ownValue(current.marketplaces, name)?.autoupdate;
    // Promote: config carries the OPPOSITE explicit value. The user's flip
    // would diverge from config truth without a write-back, so it's a
    // fresh change.
    if (configValue !== undefined && configValue !== enable) {
      reallyChanged.push(name);
    } else {
      reallyUnchanged.push(name);
    }
  }

  return { changed: reallyChanged, unchanged: reallyUnchanged };
}

/**
 * Build the per-marketplace patch passed to writeMarketplaceConfigEntry.
 * On a first-time write where no existing config entry carries `source`,
 * synthesize it from the state record's `source.raw` (the verbatim
 * user-typed string -- the reconcile planner's `samePlannedSource`
 * contract).
 */
function buildAutoupdatePatch(
  current: ScopeConfig,
  state: { marketplaces: Record<string, unknown> },
  name: string,
  enable: boolean,
): Partial<MarketplaceConfigEntry> {
  const patch: Partial<MarketplaceConfigEntry> = { autoupdate: enable };
  if (ownValue(current.marketplaces, name)?.source !== undefined) {
    return patch;
  }

  const stateRecord = ownValue(state.marketplaces, name) as { source?: unknown } | undefined;
  const raw = (stateRecord?.source as { raw?: unknown } | undefined)?.raw;
  if (typeof raw === "string") {
    patch.source = raw;
  }

  return patch;
}

/**
 * Accumulate ONE batched patch across every fresh-flipped marketplace and
 * issue a SINGLE `writeBatchedConfigEntries` call (one `saveConfig`,
 * all-or-nothing).
 *
 * Applying all N patches in memory against the same `current` snapshot
 * before the single atomic save avoids a last-write-wins clobber across a
 * bare-form flip over N marketplaces, and makes a mid-write failure
 * all-or-nothing (NFR-3).
 *
 * WR-06(b): an entry is SKIPPED from the batch when no
 * string `source` can be synthesized for a first-time write (config entry
 * absent AND the state record's `source.raw` is not a string -- hand-edited
 * or legacy state). Including it would trip `saveConfig`'s required-`source`
 * invariant throw, which the failure router narrows to a lying `{not found}`
 * row -- a misclassification of a config write refusal.
 */
async function writeAutoupdateBack(
  current: ScopeConfig,
  state: { marketplaces: Record<string, unknown> },
  targetConfigPath: string,
  scopeRoot: string,
  changed: readonly string[],
  enable: boolean,
): Promise<{ readonly skipped: readonly string[] }> {
  const marketplaces: Record<string, Partial<MarketplaceConfigEntry>> = {};
  const skipped: string[] = [];
  for (const name of changed) {
    const patch = buildAutoupdatePatch(current, state, name, enable);
    const hasConfigSource = ownValue(current.marketplaces, name)?.source !== undefined;
    if (!hasConfigSource && patch.source === undefined) {
      // I2 / PR #51 / WR-06(b): unsynthesizable source. The entry is dropped
      // from the batch while its name stays in `finalResult.changed`, so the
      // skipped names are returned here and the orchestrator demotes them into
      // an honest failed row rather than rendering success for a flip that was
      // never persisted.
      skipped.push(name);
      continue;
    }

    setOwn(marketplaces, name, patch);
  }

  if (Object.keys(marketplaces).length === 0) {
    return { skipped };
  }

  await writeBatchedConfigEntries(current, targetConfigPath, scopeRoot, { marketplaces });
  return { skipped };
}

/**
 * WB-01: execute a single-scope autoupdate
 * flip inside `withLockedStateTransaction` so the config write-back happens
 * under the per-scope lock (serialized against concurrent state mutators).
 *
 * WR-05: the flip never writes state.json --
 * `classifyAutoupdateFlip` is classify-only and the closure has no
 * tx.save(). SPLIT-01 moved autoupdate truth into the config; the config
 * write-back IS the flip.
 *
 * Write-back fires ONLY on FRESH flips (result.changed). Idempotent flips
 * (already-matching) return BEFORE the write-back call so the targeted config
 * file's mtime is byte-stable (RECON-05 fixed-point preserved).
 *
 * WR-09 / T-56-02-01: orchestrated-mode SKIPS write-back so a reconcile-
 * driven flip never copies a `claude-plugins.local.json` override back into
 * the shared base file.
 *
 * T-56-02-05: CFG-03 invalid-config surfaces with a basename-only error
 * message via the synthetic `Error` -- no absolute path leak.
 */
async function flipOneScope(opts: AutoupdateOptions, scope: Scope): Promise<ScopeFlipResult> {
  const locations = locationsFor(scope, opts.cwd);
  return await withLockedStateTransaction(locations, async (tx) => {
    if (opts.name === undefined) {
      return await flipEveryMarketplace(opts, locations, tx.state);
    }

    const plan = await planNamedFlip(opts, locations, tx.state, opts.name);
    if (opts.notifications?.mode !== "orchestrated") {
      await writeFlipPlan(plan, locations.scopeRoot, opts.enable);
    }

    // WR-05: no tx.save(); the config write is the flip (SPLIT-01).
    return { changed: plan.changed, unchanged: plan.unchanged, skipped: [] };
  });
}

interface ScopeFlipResult {
  readonly changed: readonly string[];
  readonly unchanged: readonly string[];
  readonly skipped: readonly string[];
}

async function flipEveryMarketplace(
  opts: AutoupdateOptions,
  locations: ScopedLocations,
  state: ExtensionState,
): Promise<ScopeFlipResult> {
  const orchestrated = opts.notifications?.mode === "orchestrated";
  const targetConfigPath =
    opts.local === true ? locations.configLocalJsonPath : locations.configJsonPath;
  const configBasename = path.basename(targetConfigPath);
  // CFG-03 (T-56-02-05): abort BEFORE any state mutation; basename-only.
  const cfg = await loadConfig(targetConfigPath);
  if (cfg.status === "invalid") {
    throw new InvalidMarketplaceManifestError(
      `Config file "${configBasename}" failed schema validation.`,
    );
  }

  // SPLIT-01: idempotency is measured against the CONFIG-side
  // truth, not state. The D-13 scrub strips legacy `autoupdate` from state
  // once the config file exists, so a state-side idempotency check would
  // re-classify every same-value flip as a "fresh flip" (mtime drift).
  const current: ScopeConfig = cfg.status === "valid" ? cfg.config : { schemaVersion: 1 };
  const stateResult = classifyAutoupdateFlip(state, undefined, opts.enable);
  const finalResult = reclassifyByConfigTruth(current, stateResult, opts.enable);

  if (finalResult.changed.length === 0) {
    // mtime-drift guard: no fresh flip -> SKIP the config write-back.
    // The targeted config file's mtime is byte-stable.
    return { ...finalResult, skipped: [] as readonly string[] };
  }

  // WR-09 / T-56-02-01: orchestrated-mode SKIPS write-back.
  // I2 / PR #51: even in orchestrated mode we still need to detect
  // unsynthesizable-source skips so the cascade caller can demote them
  // honestly. Run the dry classifier (no disk write) to identify which
  // entries would have been silently dropped.
  let skipped: readonly string[];
  if (orchestrated) {
    const drySkipped: string[] = [];
    for (const name of finalResult.changed) {
      const patch = buildAutoupdatePatch(current, state, name, opts.enable);
      const hasConfigSource = ownValue(current.marketplaces, name)?.source !== undefined;
      if (!hasConfigSource && patch.source === undefined) {
        drySkipped.push(name);
      }
    }

    skipped = drySkipped;
  } else {
    const writeResult = await writeAutoupdateBack(
      current,
      state,
      targetConfigPath,
      locations.scopeRoot,
      finalResult.changed,
      opts.enable,
    );
    skipped = writeResult.skipped;
  }

  // WR-05: NO tx.save() -- classifyAutoupdateFlip no
  // longer mutates state, so a flip never rewrites state.json. The config
  // write-back above IS the flip (SPLIT-01: config owns autoupdate truth;
  // the D-13 scrub strips the legacy state field on the next load).
  return { ...finalResult, skipped };
}

/**
 * Fold one scope's flip result into the cascade rows.
 *
 * I2 / PR #51: a write-back-skipped name is demoted from a success row (the
 * `<autoupdate>` fresh marker) to an honest failed row. Such a name appears in
 * `result.changed` even though its config write never landed, so reporting it
 * as a success would lie about persistence.
 */
function collectFlipRows(
  rows: AutoupdateFlipRow[],
  scope: Scope,
  result: Awaited<ReturnType<typeof flipOneScope>>,
): void {
  const skippedSet = new Set(result.skipped);
  for (const name of result.changed) {
    rows.push({ name, scope, alreadyMatching: false, writeBackSkipped: skippedSet.has(name) });
  }

  for (const name of result.unchanged) {
    rows.push({ name, scope, alreadyMatching: true });
  }
}

/**
 * Flips each scope in SC-6 order. A missing marketplace and a layer refusal
 * are collected, because the other scope may still flip; any other failure is
 * reported at once and ends the flip (`undefined`).
 */
async function flipScopes(
  opts: AutoupdateOptions,
  cardinality: "single" | "plural",
): Promise<
  | { readonly rows: readonly AutoupdateFlipRow[]; readonly refusals: readonly ScopeRefusal[] }
  | undefined
> {
  const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];
  const rows: AutoupdateFlipRow[] = [];
  const refusals: ScopeRefusal[] = [];
  for (const scope of scopes) {
    try {
      // eslint-disable-next-line no-await-in-loop -- at most two scopes, each flip under its own scope lock
      collectFlipRows(rows, scope, await flipOneScope(opts, scope));
    } catch (err) {
      if (err instanceof FlipRefused) {
        refusals.push({ scope, verdict: err.verdict });
      } else if (!(err instanceof MarketplaceNotFoundError)) {
        // `withLockedStateTransaction` normalizes every rejection through
        // `toError`, so this caught value is an Error on every reachable path.
        const cause = err as Error;
        notifyFlipFailure(
          opts,
          scope,
          { reason: autoupdateFailedReason(cause), cause },
          cardinality,
        );
        return undefined;
      }
    }
  }

  return { rows, refusals };
}

/**
 * A named flip that changed no scope reports the first scope's refusal, or,
 * when no scope's layers declare the marketplace,
 * `(failed) {marketplace not added}` (ATTR-05). With no `--scope`, every scope
 * missed, so the bracket names the first one in SC-6 order: project.
 */
async function notifyNamedMiss(
  opts: AutoupdateOptions,
  name: string,
  refusals: readonly ScopeRefusal[],
): Promise<void> {
  const [refusal] = refusals;
  if (refusal !== undefined) {
    notifyFlipFailure(
      opts,
      refusal.scope,
      { reason: refusal.verdict.reason, cause: refusal.verdict.refusal },
      "single",
    );
    return;
  }

  const missScope = opts.scope ?? "project";
  notify(opts.ctx, opts.run, {
    kind: "marketplace-not-added",
    name,
    scope: missScope,
    ...(await crossScopeFlag({ cwd: opts.cwd, marketplace: name, scope: missScope })),
  });
}

function flipRowMessage(
  row: AutoupdateFlipRow,
  enable: boolean,
): MarketplaceRows<PluginFailedMessage> {
  if (row.alreadyMatching) {
    return {
      name: row.name,
      scope: row.scope,
      status: "skipped",
      reasons: [enable ? "already autoupdate" : "already no autoupdate"],
      plugins: [],
      // D-03/D-06: a benign idempotent autoupdate skip -> info, no reload.
      // Stamped explicitly (defaults coincide) so every producer row carries
      // an auditable severity/needsReload fact rather than relying on the
      // implicit SEV-01/RLD-01 default.
      severity: "info",
      needsReload: false,
    };
  }

  if (row.writeBackSkipped === true) {
    // I2 / PR #51: the config write-back was skipped because no `source`
    // could be synthesized for a first-time write, so nothing landed in
    // claude-plugins.json. Demote to a failed row using the closed-set
    // `not found` reason rather than rendering a `<autoupdate>` fresh-flip
    // success.
    return {
      name: row.name,
      scope: row.scope,
      status: "failed",
      reasons: ["not found"],
      // D-03: a failed autoupdate flip -> error.
      severity: "error",
      plugins: [],
    };
  }

  return {
    name: row.name,
    scope: row.scope,
    status: enable ? "autoupdate enabled" : "autoupdate disabled",
    plugins: [],
  };
}

/**
 * NotificationMessage construction recipe:
 * - One MarketplaceNotificationMessage per outcome, emitted via ONE
 *   notify(opts.ctx, opts.run, ...) call; `plugins: []` is required.
 * - Discriminator: mp.status drawn from { "autoupdate enabled",
 *   "autoupdate disabled", "skipped" }; idempotent flips additionally carry
 *   `reasons: ["already autoupdate" | "already no autoupdate"]`.
 * - Severity (info / warning) and `/reload to pick up changes` are computed
 *   by notify(); callers MUST NOT compose.
 * - Caller order is honored end-to-end -- the SC-6 scopes-loop order is the
 *   visible iteration order. NO alphabetic sort here.
 * - Reference: catalog UAT fixtures `enable-fresh`, `disable-fresh`,
 *   `enable-idempotent`, `disable-idempotent`.
 */
function notifyFlipRows(
  opts: AutoupdateOptions,
  rows: readonly AutoupdateFlipRow[],
  cardinality: "single" | "plural",
): void {
  // The autoupdate / noautoupdate commands share this orchestrator, selected by
  // the boolean `opts.enable` flag (mirrors enable/disable).
  const flipContext = flipContextFor(opts.enable);

  // Empty marketplaces[] -> the `(no marketplaces)` sentinel renders verbatim
  // via the central seam. No orchestrator-side composition.
  // OUT-07 / D-12: empty inventory -> Plural (zero rows).
  if (rows.length === 0) {
    const emptyRows: Plural<MarketplaceRows<PluginFailedMessage>> = [];
    notifyWithContext(opts.ctx, opts.run, flipContext, emptyRows, undefined, cardinality);
    return;
  }

  // WR-01: type the accumulator at the narrow `MarketplaceRows<PluginFailedMessage>`
  // so each per-arm literal is checked against the flip context's row shape (the
  // failed arm is the only plugin-carrying Msg; every row builds `plugins: []`),
  // and the array widens to `notifyWithContext` with no cast.
  const marketplaces: MarketplaceRows<PluginFailedMessage>[] = rows.map((row) =>
    flipRowMessage(row, opts.enable),
  );

  // OUT-07 / D-12: bulk multi-marketplace flip cascade -> Plural. The
  // autoupdate enabled/disabled/skipped/failed headers render via the central
  // seam; the command is selected by the boolean `opts.enable` flag.
  notifyWithContext(opts.ctx, opts.run, flipContext, marketplaces, undefined, cardinality);
}

export async function setMarketplaceAutoupdate(opts: AutoupdateOptions): Promise<void> {
  const cardinality = opts.name === undefined ? "plural" : "single";
  const outcome = await flipScopes(opts, cardinality);
  if (outcome === undefined) {
    return;
  }

  // LAYER-02: without `--scope`, a named flip reports the scopes it changed,
  // and a refusal or a missing marketplace only when no scope changed.
  if (opts.name !== undefined && outcome.rows.length === 0) {
    await notifyNamedMiss(opts, opts.name, outcome.refusals);
    return;
  }

  notifyFlipRows(opts, outcome.rows, cardinality);
}
