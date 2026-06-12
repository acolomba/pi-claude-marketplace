// orchestrators/marketplace/autoupdate.ts
//
// MAU-1, MAU-2, MAU-3, MAU-4 + SC-6 + NFR-5.
//
// Each orchestration emits a single
// notify(opts.ctx, opts.pi, { marketplaces: [...] }) call. Outcomes map to
// the 7-entry MarketplaceStatus grammar (+ optional `reasons?:`):
//
//  - enable fresh -> status: "autoupdate enabled"
//  -> `● <mp> [<scope>] <autoupdate>`
//  - disable fresh -> status: "autoupdate disabled"
//  -> `● <mp> [<scope>] <no autoupdate>`
//  - enable idempotent -> status: "skipped", reasons: ["already autoupdate"]
//  -> `● <mp> [<scope>] <autoupdate> {already autoupdate}`
//  severity: "warning"
//  - disable idempotent -> status: "skipped", reasons: ["already no autoupdate"]
//  -> `● <mp> [<scope>] <no autoupdate> {already no autoupdate}`
//  severity: "warning"
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
// renderer (shared/notify.ts) owns the byte composition; per CLAUDE.md IL-2
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
//  notify(opts.ctx, opts.pi,...) call. The caller-supplied order is honored
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
import { errorMessage, MarketplaceNotFoundError, StateLockHeldError } from "../../shared/errors.ts";
import { notify } from "../../shared/notify.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";

import { classifyAutoupdateFlip } from "./shared.ts";

import type { MarketplaceConfigEntry, ScopeConfig } from "../../persistence/config-io.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type {
  ContentReason,
  MarketplaceNotificationMessage,
  PluginFailedMessage,
} from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * RECON-03 / WR-09: notification mode selector. Mirrors
 * the marketplace add/remove shape. Omitted (undefined) ===
 * `{ mode: "standalone" }` -- byte-identical to today. Orchestrated mode
 * suppresses config write-back so a reconcile-driven flip never clobbers a
 * per-machine override (WR-09 / T-56-02-01).
 */
export type AutoupdateNotifications =
  | { readonly mode: "standalone" }
  | { readonly mode: "orchestrated" };

export interface AutoupdateOptions {
  readonly ctx: ExtensionContext;
  /**
   * Soft-dep probe target, consumed by the `notify(ctx, pi, message)` calls
   * below to drive the single per-invocation soft-dep probe -- even though
   * mp-level rows never inject soft-dep markers, the probe is threaded through
   * every notify entry for invariant symmetry.
   */
  readonly pi: ExtensionAPI;
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

function shouldCollectNotFound(opts: AutoupdateOptions, err: unknown): boolean {
  return opts.name !== undefined && err instanceof MarketplaceNotFoundError;
}

interface AutoupdateFlipRow {
  readonly name: string;
  readonly scope: Scope;
  readonly alreadyMatching: boolean;
  /**
   * I2 / PR #51: when true, the write-back was silently skipped because no
   * `source` could be synthesized for a first-time config write. The row
   * renders as a `(failed) {not found}` mp row instead of the success
   * marker. Pre-fix these names rendered as silent fresh flips even though
   * the config never landed.
   */
  readonly writeBackSkipped?: boolean;
}

function missingEverywhere(
  opts: AutoupdateOptions,
  result: {
    readonly rows: readonly AutoupdateFlipRow[];
    readonly errors: readonly unknown[];
    readonly scopes: readonly Scope[];
  },
): boolean {
  return (
    opts.name !== undefined &&
    result.rows.length === 0 &&
    result.errors.length === result.scopes.length
  );
}

/**
 * Builds the synthetic failed-plugin child that carries the underlying
 * autoupdate-flip error to the user. The marketplace header alone cannot
 * carry a cause (SNM-10), so the child's `cause` drives the renderer's
 * depth-5 cause-chain trailer. A held state lock narrows to the `lock held`
 * reason (its message carries the retry hint); anything else falls back to
 * the permissive `not found`.
 *
 * ATTR-05: this row no longer handles the missing-marketplace case -- an
 * explicit-scope `MarketplaceNotFoundError` is routed to the standalone
 * `MarketplaceNotAddedMessage` `{not added}` variant by `setMarketplaceAutoupdate`
 * BEFORE this helper is reached. This helper now only maps `StateLockHeldError`
 * (-> `lock held`, whose message carries the retry hint) and other non-not-found
 * flip errors (-> the permissive `not found` fallback).
 */
function autoupdateFailedRow(name: string, err: unknown): PluginFailedMessage {
  const reasons: readonly ContentReason[] =
    err instanceof StateLockHeldError ? (["lock held"] as const) : (["not found"] as const);
  return {
    status: "failed",
    name,
    reasons,
    cause: err instanceof Error ? err : new Error(errorMessage(err)),
  };
}

/**
 * Routes a non-collected per-scope autoupdate-flip failure (S1) to notify.
 *
 * ATTR-05 / D-48-C Shape 1: an explicit-scope `MarketplaceNotFoundError` is a
 * missing-marketplace precondition, NOT a flip failure -- it routes to the
 * standalone MarketplaceNotAddedMessage `⊘ <name> [<scope>] (failed) {not added}`
 * variant (Pattern 1) carrying the explicit scope bracket (the former
 * synthetic-child `{not found}` reason lied about the blocker). Every OTHER
 * error -- notably `StateLockHeldError`, whose message carries an actionable
 * retry hint -- keeps the synthetic failed-plugin child whose `cause` drives the
 * renderer's depth-5 cause-chain trailer (the MarketplaceNotificationMessage
 * header carries no `cause` per SNM-10).
 */
function notifyAutoupdateScopeFailure(opts: AutoupdateOptions, scope: Scope, err: unknown): void {
  const failureName = opts.name ?? "(unknown)";

  if (err instanceof MarketplaceNotFoundError) {
    notify(opts.ctx, opts.pi, {
      kind: "marketplace-not-added",
      name: failureName,
      scope,
    });
    return;
  }

  notify(opts.ctx, opts.pi, {
    marketplaces: [
      {
        name: failureName,
        scope,
        status: "failed",
        plugins: [autoupdateFailedRow(failureName, err)],
      },
    ],
  });
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
    if (current.marketplaces?.[name]?.autoupdate === enable) {
      reallyUnchanged.push(name);
    } else {
      reallyChanged.push(name);
    }
  }

  for (const name of result.unchanged) {
    const configValue = current.marketplaces?.[name]?.autoupdate;
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
): { source?: string; autoupdate: boolean } {
  const patch: { source?: string; autoupdate: boolean } = { autoupdate: enable };
  if (current.marketplaces?.[name]?.source !== undefined) {
    return patch;
  }

  const stateRecord = state.marketplaces[name] as { source?: unknown } | undefined;
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
 * Per-name sequential `writeMarketplaceConfigEntry` calls against the same
 * stale `current` snapshot were a last-write-wins clobber: each save rebuilt
 * the whole file from `current` (which never gained the previous iteration's
 * patch), so a bare-form flip over N marketplaces persisted only the LAST
 * one. The batched form applies all N patches in memory before the single
 * atomic save, which also makes a mid-write failure all-or-nothing (NFR-3).
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
    const hasConfigSource = current.marketplaces?.[name]?.source !== undefined;
    if (!hasConfigSource && patch.source === undefined) {
      // I2 / PR #51 / WR-06(b): unsynthesizable source. Pre-fix this entry
      // was silently dropped from the batch -- but the name STAYED in
      // `finalResult.changed`, so the final notify rendered success for a
      // flip that was never persisted. We now return the skipped names so
      // the orchestrator can demote them into an honest failed row.
      skipped.push(name);
      continue;
    }

    marketplaces[name] = patch;
  }

  if (Object.keys(marketplaces).length === 0) {
    return { skipped };
  }

  await writeBatchedConfigEntries(current, targetConfigPath, scopeRoot, { marketplaces });
  return { skipped };
}

async function flipOneScope(
  opts: AutoupdateOptions,
  scope: Scope,
): Promise<{
  changed: readonly string[];
  unchanged: readonly string[];
  skipped: readonly string[];
}> {
  const locations = locationsFor(scope, opts.cwd);
  const orchestrated = opts.notifications?.mode === "orchestrated";
  const targetConfigPath =
    opts.local === true ? locations.configLocalJsonPath : locations.configJsonPath;
  const configBasename = path.basename(targetConfigPath);

  return await withLockedStateTransaction(locations, async (tx) => {
    // CFG-03 (T-56-02-05): abort BEFORE any state mutation; basename-only.
    const cfg = await loadConfig(targetConfigPath);
    if (cfg.status === "invalid") {
      throw new Error(`Config file "${configBasename}" failed schema validation.`);
    }

    // SPLIT-01: idempotency is measured against the CONFIG-side
    // truth, not state. The D-13 scrub strips legacy `autoupdate` from state
    // once the config file exists, so a state-side idempotency check would
    // re-classify every same-value flip as a "fresh flip" (mtime drift).
    const current: ScopeConfig = cfg.status === "valid" ? cfg.config : { schemaVersion: 1 };
    const stateResult = classifyAutoupdateFlip(tx.state, opts.name, opts.enable);
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
        const patch = buildAutoupdatePatch(current, tx.state, name, opts.enable);
        const hasConfigSource = current.marketplaces?.[name]?.source !== undefined;
        if (!hasConfigSource && patch.source === undefined) {
          drySkipped.push(name);
        }
      }

      skipped = drySkipped;
    } else {
      const writeResult = await writeAutoupdateBack(
        current,
        tx.state,
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
  });
}

export async function setMarketplaceAutoupdate(opts: AutoupdateOptions): Promise<void> {
  const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];

  const rows: AutoupdateFlipRow[] = [];
  const errors: { scope: Scope; cause: unknown }[] = [];

  for (const scope of scopes) {
    try {
      const result = await flipOneScope(opts, scope);
      const skippedSet = new Set(result.skipped);
      for (const name of result.changed) {
        // I2 / PR #51: demote write-back-skipped names from success rows
        // (`<autoupdate>` fresh marker) to honest failed rows. A skipped
        // name appears in `result.changed` but its config write never
        // landed, so claiming success would lie about persistence.
        rows.push({ name, scope, alreadyMatching: false, writeBackSkipped: skippedSet.has(name) });
      }

      for (const name of result.unchanged) {
        rows.push({ name, scope, alreadyMatching: true });
      }
    } catch (err) {
      // For single-name flips: classifyAutoupdateFlip throws
      // MarketplaceNotFoundError when the name is absent from THIS
      // scope. With SC-6 bare-form, that is expected if the name only
      // lives in the OTHER scope; we collect and only surface if BOTH
      // scopes failed AND no flips happened anywhere.
      if (!shouldCollectNotFound(opts, err)) {
        notifyAutoupdateScopeFailure(opts, scope, err);
        return;
      }

      errors.push({ scope, cause: err });
    }
  }

  // If a single-name flip was requested but the name was missing
  // from EVERY iterated scope (no row accumulated and every scope
  // errored), surface as a single failure marketplace row.
  if (missingEverywhere(opts, { rows, errors, scopes })) {
    const first = errors[0];
    if (first !== undefined) {
      // ATTR-05 / D-48-C Shape 1: a single-name flip that missed in EVERY
      // iterated scope is a missing-marketplace precondition. Route it to the
      // standalone MarketplaceNotAddedMessage `(failed) {not added}` variant
      // (Pattern 1) instead of the former reason-LESS bare `(failed)` row.
      // Scope bracket: an explicit `opts.scope` carries it; the bare form
      // carries `first.scope` (the scope where the first not-found was
      // observed), per the RESEARCH recommendation.
      const failureName = opts.name ?? "(unknown)";
      notify(opts.ctx, opts.pi, {
        kind: "marketplace-not-added",
        name: failureName,
        scope: opts.scope ?? first.scope,
      });
    }

    return;
  }

  // Empty marketplaces[] -> notify emits the `(no marketplaces)` sentinel
  // verbatim. No orchestrator-side composition.
  if (rows.length === 0) {
    notify(opts.ctx, opts.pi, { marketplaces: [] });
    return;
  }

  // NotificationMessage construction recipe:
  // - One MarketplaceNotificationMessage per outcome, emitted via ONE
  //   notify(opts.ctx, opts.pi, ...) call; `plugins: []` is required.
  // - Discriminator: mp.status drawn from { "autoupdate enabled",
  //   "autoupdate disabled", "skipped" }; idempotent flips additionally carry
  //   `reasons: ["already autoupdate" | "already no autoupdate"]`.
  // - Severity (info / warning) and `/reload to pick up changes` are computed
  //   by notify(); callers MUST NOT compose.
  // - Caller order is honored end-to-end -- the SC-6 scopes-loop order is the
  //   visible iteration order. NO alphabetic sort here.
  // - Reference: catalog UAT fixtures `enable-fresh`, `disable-fresh`,
  //   `enable-idempotent`, `disable-idempotent`.
  const marketplaces: MarketplaceNotificationMessage[] = rows.map((row) => {
    if (row.alreadyMatching) {
      return {
        name: row.name,
        scope: row.scope,
        status: "skipped",
        reasons: [opts.enable ? "already autoupdate" : "already no autoupdate"],
        plugins: [],
      };
    }

    if (row.writeBackSkipped === true) {
      // I2 / PR #51: the config write-back was silently skipped because no
      // `source` could be synthesized for a first-time write. Pre-fix this
      // rendered as a `<autoupdate>` fresh-flip success even though nothing
      // landed in claude-plugins.json. Demote to a failed row using the
      // closed-set `not found` reason (matches the synthetic-child cascade
      // form used elsewhere in this orchestrator -- no new tokens).
      return {
        name: row.name,
        scope: row.scope,
        status: "failed",
        reasons: ["not found"],
        plugins: [],
      };
    }

    return {
      name: row.name,
      scope: row.scope,
      status: opts.enable ? "autoupdate enabled" : "autoupdate disabled",
      plugins: [],
    };
  });

  notify(opts.ctx, opts.pi, { marketplaces });
}
