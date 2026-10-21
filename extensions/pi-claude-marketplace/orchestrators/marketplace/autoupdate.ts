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
//  - failure -> a `(failed)` header with one failed child carrying the
//  reason and the cause, or the `{marketplace not added}` row
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
//  for each scope, inside withLockedStateTransaction:
//   named (LAYER-02): the target layer only; the layer gate refuses the flip
//    when only the other layer declares the marketplace, and reports it not
//    added when neither does
//   unnamed (D-MF-03): each recorded marketplace, in each declaring layer whose
//    value, own or inherited, differs from the request; with --local,
//    claude-plugins.local.json only. A local entry without a value inherits
//    the base entry's value, or off when the base config does not declare the
//    marketplace (LAYER-09)
//   each changed layer gets one batched config write; WR-05: a flip reads and
//   writes only config, never state.json (SPLIT-01)
//  accumulate the changed and unchanged names across scopes
//
//  compose one MarketplaceNotificationMessage per outcome; emit ONE
//  notify(opts.ctx, opts.run,...) call. The caller-supplied order is honored
//  end-to-end; the SC-6 scopes-loop order (project-then-user) is the visible
//  iteration order. No alphabetic sort -- the renderer does not sort and the
//  orchestrator must not re-sort. A row reports the layers the flip targets;
//  `marketplace list` reports the merged value.
//
// NFR-5: zero git surface -- autoupdate never imports platform/git
// or DEFAULT_GIT_OPS.

import path from "node:path";

import { loadConfig } from "../../persistence/config-io.ts";
import { writeBatchedConfigEntries } from "../../persistence/config-write-back.ts";
import { locationsFor } from "../../persistence/locations.ts";
import {
  InvalidMarketplaceManifestError,
  isErrnoException,
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
import { ownValue } from "../../shared/own-key.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";

import { AUTOUPDATE_CONTEXT, NOAUTOUPDATE_CONTEXT } from "./autoupdate.messaging.ts";
import { crossScopeFlag, marketplaceFailureRows, marketplaceLayerVerdict } from "./shared.ts";

import type { MarketplaceLayerVerdict } from "./shared.ts";
import type { ConfigLoadResult, ScopeConfig } from "../../persistence/config-io.ts";
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

/** Inputs to `setMarketplaceAutoupdate`: the notification context, target marketplace, and desired flag. */
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
   * WB-01: when true, target the local config (`claude-plugins.local.json`)
   * instead of the base config (`claude-plugins.json`). The --local path never
   * writes the base config, but it reads it for the value a local entry without
   * one inherits.
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
}

/** One config file of a scope, as a flip reads and writes it. */
interface FlipLayer {
  readonly filePath: string;
  readonly local: boolean;
  readonly config: ScopeConfig;
}

/**
 * What one scope's flip decides: the names it changes, the names already set,
 * and, per layer config, the names whose entry it writes.
 */
interface FlipPlan {
  readonly changed: readonly string[];
  readonly unchanged: readonly string[];
  readonly writes: ReadonlyMap<FlipLayer, readonly string[]>;
}

type RefusedVerdict = Extract<MarketplaceLayerVerdict, { kind: "refused" }>;

/** The `autoupdate` value a local entry without one inherits (D-MF-03 / LAYER-09). */
type InheritedValue = (name: string) => boolean;

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

/** The flip error that ended the flip in one scope, with the reason its row carries. */
interface ScopeFailure {
  readonly scope: Scope;
  readonly reason: ContentReason;
  readonly cause: Error;
}

/**
 * Leaves the scope lock when a layer write fails, carrying the names whose
 * every write had landed before it, so the flip still reports them (D-06).
 */
class FlipWriteFailure extends Error {
  readonly written: readonly string[];
  readonly failure: Error;
  constructor(written: readonly string[], failure: Error) {
    super("flip-write-failure");
    this.name = "FlipWriteFailure";
    this.written = written;
    this.failure = failure;
  }
}

/**
 * The reason of the synthetic failed child (`marketplaceFailureRows`) that
 * carries a flip error to the user. A held state lock narrows to `lock held`
 * (its message carries the retry hint), a CFG-03 abort to `invalid manifest`,
 * a refused file access to `permission denied`, and anything else, such as a
 * config write the writer refuses, to `unreadable`. A missing marketplace and
 * a layer refusal never reach it: `setMarketplaceAutoupdate` collects both
 * (ATTR-05, LAYER-02).
 */
function autoupdateFailedReason(err: Error): ContentReason {
  if (err instanceof StateLockHeldError) {
    return "lock held";
  }

  if (err instanceof InvalidMarketplaceManifestError) {
    return "invalid manifest";
  }

  if (isErrnoException(err) && err.code === "EACCES") {
    return "permission denied";
  }

  return "unreadable";
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
    flipFailureRows(opts, scope, failure),
    undefined,
    cardinality,
  );
}

/** The failed header and its failed child for one scope's flip failure. */
function flipFailureRows(
  opts: AutoupdateOptions,
  scope: Scope,
  failure: { readonly reason: ContentReason; readonly cause: Error },
): ReturnType<typeof marketplaceFailureRows> {
  return marketplaceFailureRows(opts.name ?? "(unknown)", scope, failure.reason, failure.cause);
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
 * The base entry's current value, off when the base config is absent or does
 * not set it. An invalid base config fails closed, and only when a local entry
 * without a value asks (CFG-03).
 */
function inheritFrom(base: ConfigLoadResult): InheritedValue {
  return (name) => {
    if (base.status === "invalid") {
      throw invalidConfigError(path.basename(base.filePath));
    }

    return (
      base.status === "valid" && (ownValue(base.config.marketplaces, name)?.autoupdate ?? false)
    );
  };
}

/** After a flip of the base layer, a base config that declares the marketplace holds `enable`. */
function inheritAfterFlip(base: FlipLayer, enable: boolean): InheritedValue {
  return (name) => enable && ownValue(base.config.marketplaces, name) !== undefined;
}

/**
 * Whether a layer's `autoupdate` value already matches the request. A base
 * entry without a value reads as off (MAU-4). A local entry without a value has
 * the value it inherits: the base entry's value, or off when the base config
 * does not declare the marketplace or the base entry has no value (D-MF-03 /
 * LAYER-09). So a flip writes a local value only when it changes the value that
 * applies.
 */
function layerAlreadySet(
  layer: FlipLayer,
  name: string,
  enable: boolean,
  inherited: InheritedValue,
): boolean {
  const own = ownValue(layer.config.marketplaces, name)?.autoupdate;
  if (own !== undefined) {
    return own === enable;
  }

  return (layer.local && inherited(name)) === enable;
}

/**
 * Plans a flip over `names`: a name with no layer gets no row; otherwise it is
 * changed when any of its layers lacks the requested value, the inherited value
 * of a local entry without one included, and each such layer gets the name in
 * its write batch. One row per name, never one per layer.
 */
function planFlip(
  names: readonly string[],
  layersOf: (name: string) => readonly FlipLayer[],
  enable: boolean,
  inherited: InheritedValue,
): FlipPlan {
  const changed: string[] = [];
  const unchanged: string[] = [];
  const writes = new Map<FlipLayer, string[]>();
  for (const name of names) {
    const layers = layersOf(name);
    if (layers.length === 0) {
      continue;
    }

    const stale = layers.filter((layer) => !layerAlreadySet(layer, name, enable, inherited));
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
 * One batched write per layer config (NFR-3). The patch carries `autoupdate`
 * only, so only an entry the layer already declares is changed. A failed write
 * leaves the earlier files written; `FlipWriteFailure` names the marketplaces
 * whose every write had landed, so the flip reports them beside the failure.
 */
async function writeFlipPlan(plan: FlipPlan, scopeRoot: string, enable: boolean): Promise<void> {
  const written = new Set<FlipLayer>();
  for (const [layer, names] of plan.writes) {
    try {
      // eslint-disable-next-line no-await-in-loop -- at most two layer configs, written one after the other
      await writeBatchedConfigEntries(layer.config, layer.filePath, scopeRoot, {
        marketplaces: Object.fromEntries(names.map((name) => [name, { autoupdate: enable }])),
      });
    } catch (err: unknown) {
      const done = plan.changed.filter((name) =>
        [...plan.writes].every(([other, batch]) => written.has(other) || !batch.includes(name)),
      );
      throw new FlipWriteFailure(done, err as Error);
    }

    written.add(layer);
  }
}

/**
 * LAYER-02 / D-MF-03: a named flip changes only its target layer. The gate
 * stops it, before any write, when the target layer does not declare the
 * marketplace: a refusal when the other layer declares it, not added when
 * neither does, and the CFG-03 failure naming the other file when that file
 * cannot be read.
 */
function requireTargetDeclares(target: FlipLayer, other: ConfigLoadResult, name: string): void {
  const verdict = marketplaceLayerVerdict({
    target: target.config,
    other,
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
 * layer rule (WR-09). It reads the other layer once, for the layer gate and,
 * for a local target, for the inherited value.
 */
async function planNamedFlip(
  opts: AutoupdateOptions,
  locations: ScopedLocations,
  state: ExtensionState,
  name: string,
): Promise<FlipPlan> {
  const local = opts.local === true;
  const target = await loadFlipLayer(
    local ? locations.localConfigJsonPath : locations.baseConfigJsonPath,
    local,
  );
  if (ownValue(state.marketplaces, name) === undefined) {
    throw new MarketplaceNotFoundError(name, []);
  }

  const other = await loadConfig(
    local ? locations.baseConfigJsonPath : locations.localConfigJsonPath,
  );
  if (opts.notifications?.mode !== "orchestrated") {
    requireTargetDeclares(target, other, name);
  }

  return planFlip(
    [name],
    () => [target],
    opts.enable,
    inheritFrom(local ? other : { status: "absent" }),
  );
}

/**
 * The layers an unnamed flip may write and the value a local entry without one
 * inherits. With `--local` only the local layer, loaded first so an invalid
 * local config fails first, and the current base value; otherwise the base
 * layer then the local layer, and the value the base config holds after the
 * flip.
 */
async function everyFlipLayers(
  opts: AutoupdateOptions,
  locations: ScopedLocations,
): Promise<{ readonly layers: readonly FlipLayer[]; readonly inherited: InheritedValue }> {
  if (opts.local === true) {
    const local = await loadFlipLayer(locations.localConfigJsonPath, true);
    return {
      layers: [local],
      inherited: inheritFrom(await loadConfig(locations.baseConfigJsonPath)),
    };
  }

  const base = await loadFlipLayer(locations.baseConfigJsonPath, false);
  const local = await loadFlipLayer(locations.localConfigJsonPath, true);
  return { layers: [base, local], inherited: inheritAfterFlip(base, opts.enable) };
}

/**
 * Plans an unnamed flip (D-MF-03): every recorded marketplace, in state order,
 * changes in each layer that declares it. With `--local` only
 * `claude-plugins.local.json` is written; the base config is read for inherited
 * values, and an unreadable base fails the flip only when a local entry without
 * a value needs it (CFG-03). Without `--local` both layers are read, so either
 * one being invalid aborts the flip (CFG-03), and a local entry without a value
 * inherits the value the base config holds after the flip, so only the base
 * entry is written when the base config declares the marketplace. A
 * marketplace that no applicable layer declares gets no row.
 */
async function planEveryFlip(
  opts: AutoupdateOptions,
  locations: ScopedLocations,
  state: ExtensionState,
): Promise<FlipPlan> {
  const { layers, inherited } = await everyFlipLayers(opts, locations);
  return planFlip(
    Object.keys(state.marketplaces),
    (name) => layers.filter((layer) => ownValue(layer.config.marketplaces, name) !== undefined),
    opts.enable,
    inherited,
  );
}

/**
 * WB-01: one scope's flip runs inside `withLockedStateTransaction`, so the
 * config write happens under the scope lock.
 *
 * WR-05: a flip reads and writes only config, never the legacy `autoupdate`
 * field of the state record, and the closure has no tx.save() (SPLIT-01).
 * Only layers whose value differs from the request are written, a local
 * entry's inherited value included, so an idempotent flip leaves every file's
 * bytes and mtime unchanged (RECON-05).
 *
 * WR-09 / T-56-02-01: orchestrated mode writes nothing, so a reconcile-driven
 * flip never copies an override in the local config
 * (`claude-plugins.local.json`) into the base config.
 */
async function flipOneScope(opts: AutoupdateOptions, scope: Scope): Promise<FlipPlan> {
  const locations = locationsFor(scope, opts.cwd);
  return await withLockedStateTransaction(locations, async (tx) => {
    const plan =
      opts.name === undefined
        ? await planEveryFlip(opts, locations, tx.state)
        : await planNamedFlip(opts, locations, tx.state, opts.name);
    if (opts.notifications?.mode !== "orchestrated") {
      await writeFlipPlan(plan, locations.scopeRoot, opts.enable);
    }

    return plan;
  });
}

/** Folds one scope's flip into the rows: changed names first (SC-6). */
function collectFlipRows(rows: AutoupdateFlipRow[], scope: Scope, plan: FlipPlan): void {
  for (const name of plan.changed) {
    rows.push({ name, scope, alreadyMatching: false });
  }

  for (const name of plan.unchanged) {
    rows.push({ name, scope, alreadyMatching: true });
  }
}

/**
 * Flips each scope in SC-6 order. A missing marketplace and a layer refusal
 * are collected, because the other scope may still flip; any other failure
 * ends the flip and is reported together with the rows of what the flip had
 * already written (D-06): an earlier scope, or an earlier file of this scope.
 */
async function flipScopes(opts: AutoupdateOptions): Promise<{
  readonly rows: readonly AutoupdateFlipRow[];
  readonly refusals: readonly ScopeRefusal[];
  readonly failure?: ScopeFailure;
}> {
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
        return { rows, refusals, failure: scopeFailure(rows, scope, err) };
      }
    }
  }

  return { rows, refusals };
}

/**
 * The failure that ended a flip in `scope`. A write failure adds the rows of
 * the marketplaces its earlier writes flipped. `withLockedStateTransaction`
 * normalizes every rejection through `toError`, so the caught value is an
 * Error on every reachable path.
 */
function scopeFailure(rows: AutoupdateFlipRow[], scope: Scope, err: unknown): ScopeFailure {
  if (err instanceof FlipWriteFailure) {
    rows.push(...err.written.map((name) => ({ name, scope, alreadyMatching: false })));
    return { scope, reason: autoupdateFailedReason(err.failure), cause: err.failure };
  }

  const cause = err as Error;
  return { scope, reason: autoupdateFailedReason(cause), cause };
}

/**
 * A named flip that changed no scope reports the first scope's refusal.
 * Otherwise it reports `(failed) {marketplace not added}` (ATTR-05). With
 * `--scope`, the row names the requested scope and whether the other scope
 * holds the marketplace (SCOPE-01). Without it, every scope missed, so the row
 * names no scope, as `marketplace remove`, `info`, and `update` do (AU-08).
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

  notify(opts.ctx, opts.run, {
    kind: "marketplace-not-added",
    name,
    ...(opts.scope !== undefined && { scope: opts.scope }),
    ...(await crossScopeFlag({ cwd: opts.cwd, marketplace: name, scope: opts.scope })),
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

  return {
    name: row.name,
    scope: row.scope,
    status: enable ? "autoupdate enabled" : "autoupdate disabled",
    plugins: [],
  };
}

/**
 * D-06: a flip that failed after it wrote reports what it wrote and the
 * failure in one emission; with nothing written, the failure alone keeps the
 * command's cardinality.
 */
function notifyFlipWithFailure(
  opts: AutoupdateOptions,
  rows: readonly AutoupdateFlipRow[],
  failure: ScopeFailure,
  cardinality: "single" | "plural",
): void {
  if (rows.length === 0) {
    notifyFlipFailure(opts, failure.scope, failure, cardinality);
    return;
  }

  const marketplaces: MarketplaceRows<PluginFailedMessage>[] = [
    ...rows.map((row) => flipRowMessage(row, opts.enable)),
    ...flipFailureRows(opts, failure.scope, failure),
  ];
  notifyWithContext(
    opts.ctx,
    opts.run,
    flipContextFor(opts.enable),
    marketplaces,
    undefined,
    "plural",
  );
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
  const outcome = await flipScopes(opts);
  if (outcome.failure !== undefined) {
    notifyFlipWithFailure(opts, outcome.rows, outcome.failure, cardinality);
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
