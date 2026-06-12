// orchestrators/marketplace/add.ts
//
// MA-1..6, MA-8..11 (MA-7 does not apply per D-21 -- isomorphic-git
// eliminates the "git not found on PATH" failure mode entirely).
//
// Flow (D-04 outer guard wraps the ENTIRE flow including network IO):
//
//   parsePluginSource(rawSource) -> path | github | unknown
//   if unknown: throw new Error(parsed.reason)  // MA-10
//
//   withStateGuard(locations, async (state) => {
//     if (github):
//       MA-6  stale-clone check on final sources/<derivedName>/  (BEFORE clone)
//       MA-8  duplicate-name check on state.marketplaces[<derivedName>]
//       gitOps.clone(stagingDir)                            // network -- gated by NFR-5
//       read + MARKETPLACE_VALIDATOR.Check(<staging>/.claude-plugin/marketplace.json)
//       fs.rename(stagingDir, finalDir)                     // atomic, same-FS by D-09
//       state.marketplaces[derivedName] = { ... }
//
//     if (path):
//       resolve manifest path on disk per MA-3
//       read + MARKETPLACE_VALIDATOR.Check(manifest.json)
//       MA-8 duplicate-name check on state.marketplaces[<derivedName>]
//       state.marketplaces[derivedName] = { ... }            // NFR-5: NO gitOps calls
//   })
//
//   // The success notification is a single
//   //   notify(opts.ctx, opts.pi, { marketplaces: [{ status: "added", ... }] })
//   // call. Both github and path source kinds collapse to the same
//   // payload (the `<autoupdate>` marker lives on the list-surface header
//   // per D-17.1-01 / D-18-04). The `/reload to pick up changes` trailer
//   // is computed by `notify()` (mp.status `"added"` is state-changing);
//   // callers MUST NOT append it. See the construction recipe block-comment
//   // above the notify() call site for the full mirror template.
//
// Staging via D-09, GitOps injection via D-12, follow-upstream-blindly via
// D-14.
//
// WR-05 trade-off note: the MA-8 duplicate-name check for github sources
// runs AFTER the clone fills `stagingDir`. We accept the cost of one
// wasted network clone per duplicate-name attempt because the marketplace
// name is derived from the manifest's `name` field -- which only exists
// inside the cloned tree. Resolving without cloning would require a
// raw.githubusercontent.com manifest probe that bypasses the GitOps
// surface (and the D-12/D-13 layering rules); the current cost is
// considered acceptable per design.

import { randomUUID } from "node:crypto";
import { mkdir, rename, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { initiateDeviceFlow } from "../../domain/github-auth.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { loadConfig } from "../../persistence/config-io.ts";
import { writeMarketplaceConfigEntry } from "../../persistence/config-write-back.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { DEFAULT_CREDENTIAL_OPS } from "../../platform/git-credential.ts";
import { dropMarketplaceCache, invalidateMarketplaceNames } from "../../shared/completion-cache.ts";
import {
  InvalidMarketplaceManifestError,
  MarketplaceDuplicateNameError,
  StaleSourceCloneError,
  UnsupportedSourceError,
  appendLeakToError,
  errorMessage,
} from "../../shared/errors.ts";
import { cleanupStaging, pathExists } from "../../shared/fs-utils.ts";
import { makeRawNotifyFn, notify } from "../../shared/notify.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";

import { DEFAULT_GIT_OPS, type GitAuthBundle, type GitOps } from "./shared.ts";

import type { DeviceFlowHttp } from "../../domain/github-auth.ts";
import type { GitHubSource, PathSource } from "../../domain/source.ts";
import type { ScopeConfig } from "../../persistence/config-io.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { CredentialOps } from "../../platform/git-credential.ts";
import type { AuthAttemptResult } from "../../platform/git.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { ContentReason, Reason } from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * RECON-03: controls how `addMarketplace` surfaces
 * notifications. Mirrors the `InstallPluginNotifications` precedent.
 *
 * - `"standalone"` (default when option is omitted): the orchestrator fires
 *   one `notify(ctx, pi, ...)` per outcome arm with the per-variant
 *   `MarketplaceNotificationMessage` / `MarketplaceNotAddedMessage` payload.
 *   Byte-identical to today; every existing caller (edge handler, bootstrap
 *   composer, catalog UAT) observes zero output drift.
 * - `"orchestrated"`: suppresses every `ctx.ui.notify` call and returns the
 *   typed `AddMarketplaceOutcome` instead. Consumed by `applyReconcile`
 *   which aggregates per-entry outcomes into ONE notify() per load (IL-2).
 *   The orchestrated caller is contractually required to render the outcome
 *   itself.
 */
export type AddMarketplaceNotifications =
  | { readonly mode: "standalone" }
  | { readonly mode: "orchestrated" };

/**
 * RECON-03: discriminated outcome returned by `addMarketplace` in
 * orchestrated mode. Standalone mode returns `void` for back-compat.
 *
 * `success` (status: "added") carries the `name` of the newly recorded
 * marketplace so the apply cascade can render the row.
 *
 * `failed` collapses every classified precondition failure
 * (`classifyAddError` recognized: duplicate name / stale clone / invalid
 * manifest / unsupported source / source missing / network unreachable)
 * plus the catastrophic
 * fallback ("unparseable" -- chosen because every recognised add precondition
 * yields a typed error, so a non-enumerated throw is by construction an
 * unparseable / corrupted source-tree shape). Consumers narrow on
 * `instanceof MarketplaceDuplicateNameError` etc. via `outcome.error` to
 * recover the specific failure class.
 *
 * `cause` carries the formatted user-visible text for orchestrated callers
 * that surface it directly.
 */
/**
 * `reason` is typed as `Reason` (not `ContentReason`) so the `applyReconcile`
 * caller can dispatch on the broader closed set, including the
 * structural `"not added"` sentinel surfaced by the `remove` sibling. This
 * adopts a broader-than-the-plan type to keep the orchestrated outcome
 * dispatchable end-to-end without a separate marker field.
 */
export type AddMarketplaceOutcome =
  | { readonly status: "added"; readonly name: string }
  | {
      readonly status: "failed";
      readonly reason: Reason;
      readonly error: Error;
      readonly cause: string;
    };

export interface AddMarketplaceOptions {
  readonly ctx: ExtensionContext;
  /**
   * Required by `notify(ctx, pi, message)` for soft-dep probing.
   */
  readonly pi: ExtensionAPI;
  /** SC-5: the edge layer defaults this to "user"; orchestrator receives a fully resolved Scope. */
  readonly scope: Scope;
  /** Used to compute project-scope locations (`<cwd>/.pi`). Ignored when scope === "user". */
  readonly cwd: string;
  /** The user-supplied source string (`owner/repo`, `https://...`, `~/path`, `./path`, etc.). */
  readonly rawSource: string;
  /** D-12 injection seam. Defaults to DEFAULT_GIT_OPS (which wraps platform/git.ts). */
  readonly gitOps?: GitOps;
  /**
   * AUTH-01 injection seam. Defaults to DEFAULT_CREDENTIAL_OPS which
   * wraps `git credential fill/approve/reject` via subprocess. Tests
   * inject makeMockCredentialOps() from tests/helpers/credential-mock.ts
   * so the developer's OS keychain is never touched.
   */
  readonly credentialOps?: CredentialOps;
  /**
   * Test seam; production callers omit and get the default github.com
   * fetch. When provided, threads into the onAuthRequired closure so tests
   * can drive Device Flow end-to-end without network.
   */
  readonly deviceFlowHttp?: DeviceFlowHttp;
  /**
   * Composition seam for `bootstrapClaudePlugin` (ATTR-07). When `true`, the
   * enumerated precondition errors are re-thrown (typed) instead of being
   * routed through `notify` as a `(failed) {<reason>}` row. Bootstrap relies on
   * catching `MarketplaceDuplicateNameError` to detect the idempotent re-run
   * and SUPPRESS a duplicate add notification (one-signal-per-state-change). The
   * public `marketplace add` command path omits this flag and gets the ATTR-07
   * structured failed row. Omitted (undefined) => route through notify.
   */
  readonly rethrowPreconditionErrors?: boolean;
  /**
   * RECON-03: notification mode selector. Omitted
   * (undefined) === `{ mode: "standalone" }` -- byte-identical to today.
   * Orchestrated mode suppresses notify() and returns a typed outcome.
   */
  readonly notifications?: AddMarketplaceNotifications;
  /**
   * WB-01: when true, target
   * `claude-plugins.local.json` instead of `claude-plugins.json`. The base
   * file is NEVER touched on the --local path; loadConfig's `absent` arm
   * yields an empty starting shape that saveConfig writes back to the local
   * path.
   */
  readonly local?: boolean;
}

/**
 * Resolve the typed add-precondition error from a thrown value, unwrapping ONE
 * level of `Error.cause`. The github guard's MA-9 catch wraps a precondition
 * error via `appendLeakToError` when `cleanupStaging` itself leaks -- that
 * produces a generic `Error` whose `.cause` is the original typed error. Both
 * the unwrapped (no-leak) and wrapped (leak) shapes must classify identically,
 * so ATTR-07 routing survives a cleanup leak. Single level only --
 * a deeper chain is not an add-precondition shape this orchestrator produces.
 */
function unwrapAddError(err: unknown): unknown {
  if (
    err instanceof MarketplaceDuplicateNameError ||
    err instanceof StaleSourceCloneError ||
    err instanceof InvalidMarketplaceManifestError ||
    err instanceof UnsupportedSourceError
  ) {
    return err;
  }

  if (err instanceof Error && err.cause !== undefined) {
    return err.cause;
  }

  return err;
}

/**
 * ATTR-07 (Pattern 3): map an `addMarketplace` precondition error to its
 * closed-set `ContentReason`. Fully `instanceof`-driven (D-48-C A3) so the
 * catch-all returns `undefined` -- a non-enumerated error (e.g.
 * `StateLockHeldError`, an unforeseen catastrophic failure) re-throws at the
 * entrypoint rather than being silently mislabeled. No substring matching.
 */
function classifyAddError(rawErr: unknown): ContentReason | undefined {
  const err = unwrapAddError(rawErr);
  if (err instanceof MarketplaceDuplicateNameError) {
    return "duplicate name";
  }

  if (err instanceof StaleSourceCloneError) {
    return "stale clone";
  }

  if (err instanceof InvalidMarketplaceManifestError) {
    return "invalid manifest";
  }

  if (err instanceof UnsupportedSourceError) {
    return "unsupported source";
  }

  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return "source missing";
    }

    // WR-03: a clone network failure (errno-carrying
    // throw from the github guard's gitOps.clone) is the NFR-5 per-entry
    // soft-fail the catalog's `soft-fail-mixed` state documents as
    // `{network unreachable}`. The clone-catch only cleans staging and
    // rethrows unclassified, so the errno must be recognised HERE --
    // otherwise the reason falls through to `unparseable`, falsely implying
    // a corrupted manifest when the user's network is down.
    if (
      code === "ENETUNREACH" ||
      code === "ECONNREFUSED" ||
      code === "ENOTFOUND" ||
      code === "ETIMEDOUT" ||
      code === "ECONNRESET" ||
      code === "EAI_AGAIN"
    ) {
      return "network unreachable";
    }
  }

  return undefined;
}

/**
 * ATTR-07 (A2): the marketplace subject name for a failed-add row. Post-manifest
 * failures know the derived marketplace name (`MarketplaceDuplicateNameError`
 * carries `mpName`; `StaleSourceCloneError` carries the derived `mpName`), so
 * the row renders on the real subject. Pre-clone/pre-manifest failures
 * (unsupported source, source missing, invalid manifest) have no derived name,
 * so the user-typed `rawSource` is the subject.
 */
function addSubjectName(rawErr: unknown, rawSource: string): string {
  const err = unwrapAddError(rawErr);
  if (err instanceof MarketplaceDuplicateNameError) {
    return err.mpName;
  }

  if (err instanceof StaleSourceCloneError && err.mpName !== undefined) {
    return err.mpName;
  }

  return rawSource;
}

/**
 * WB-01 mitigation: a CFG-03 invalid-config arm aborts the
 * command BEFORE any state mutation or network call. Thrown so the
 * entrypoint catch routes through `classifyAddError` -> `invalid manifest`
 * with a basename-only cause (T-56-02-05 information disclosure mitigation).
 */
class ConfigInvalidError extends InvalidMarketplaceManifestError {
  constructor(configBasename: string) {
    super(`Config file "${configBasename}" failed schema validation.`);
    this.name = "ConfigInvalidError";
  }
}

/**
 * Dispatch the source-kind precondition + the in-guard add. Extracted so the
 * entrypoint try/catch (ATTR-07) wraps BOTH the synchronous source-kind refusal
 * (S5a/S5b -> UnsupportedSourceError) and the guard body uniformly.
 *
 * WB-01 / WR-09: converted from `withStateGuard` to
 * `withLockedStateTransaction` so config write-back happens inside the SAME
 * per-scope lock as the state mutation. The config write-back fires only in
 * standalone mode (orchestrated/reconcile-driven calls derive desired state
 * FROM the merged config; writing back would clobber a per-machine override).
 */
async function runAddInGuard(args: {
  opts: AddMarketplaceOptions;
  locations: ScopedLocations;
  source: ReturnType<typeof parsePluginSource>;
  gitOps: GitOps;
  credentialOps: CredentialOps;
  orchestrated: boolean;
}): Promise<string> {
  const { opts, locations, source, gitOps, credentialOps, orchestrated } = args;

  // S5a (MA-10): parser produced an unknown kind with a reason -- surface
  // verbatim on the cause, classified as `unsupported source` (D-48-C A3).
  if (source.kind === "unknown") {
    throw new UnsupportedSourceError(
      `Cannot add marketplace from "${opts.rawSource}": ${source.reason}`,
    );
  }

  // S5b: valid-but-unsupported kinds (url / git-subdir / npm).
  if (source.kind !== "github" && source.kind !== "path") {
    throw new UnsupportedSourceError(
      `Cannot add marketplace from "${opts.rawSource}": unsupported source kind ${source.kind}`,
    );
  }

  // WB-01: target-path selection happens ONCE before the lock so
  // the orchestrator NEVER falls back to the base file on ENOENT.
  const targetConfigPath =
    opts.local === true ? locations.configLocalJsonPath : locations.configJsonPath;
  const configBasename = path.basename(targetConfigPath);

  let recordedName: string | undefined;
  await withLockedStateTransaction(locations, async (tx) => {
    const state = tx.state;

    // CFG-03 (T-56-02-05): abort BEFORE any state mutation. The
    // basename-only error message prevents an absolute-path information leak.
    const cfg = await loadConfig(targetConfigPath);
    if (cfg.status === "invalid") {
      throw new ConfigInvalidError(configBasename);
    }

    if (source.kind === "github") {
      recordedName = await addGithubInGuard({
        ctx: opts.ctx,
        state,
        locations,
        source,
        gitOps,
        credentialOps,
        ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
        cwd: opts.cwd,
      });
    } else {
      recordedName = await addPathInGuard({
        state,
        locations,
        source,
        cwd: opts.cwd,
      });
    }

    // WB-01 / WR-09: write-back the marketplace entry to the user-authored
    // config. SKIPPED in orchestrated mode (reconcile derives desired state
    // FROM the config; writing back would clobber a per-machine override).
    // The `source` field is `opts.rawSource` VERBATIM so the reconcile
    // planner's `samePlannedSource` comparison stays a no-op on the next
    // load.
    //
    // WR-07: by this point `addGithubInGuard` has ALREADY
    // renamed the clone into its final `sources/<name>/` path, and its own
    // MA-9 cleanup catch is out of scope. If the config write-back or
    // tx.save() throws (disk full, EACCES on claude-plugins.json), the state
    // snapshot is discarded (no save) but the clone would be orphaned --
    // making every retry fail MA-6 `{stale clone}` until the user manually
    // deletes the directory (NFR-3 violation). Mirror the MA-9 discipline:
    // remove the committed final clone and append any cleanup leak to the
    // rethrown error.
    try {
      if (!orchestrated) {
        const current: ScopeConfig = cfg.status === "valid" ? cfg.config : { schemaVersion: 1 };
        await writeMarketplaceConfigEntry(
          current,
          targetConfigPath,
          locations.scopeRoot,
          recordedName,
          { source: opts.rawSource },
        );
      }

      await tx.save();
    } catch (err) {
      let wrapped: unknown = err;
      if (source.kind === "github") {
        const finalDir = await locations.sourceCloneDir(recordedName);
        const leak = await cleanupStaging(finalDir, `marketplace final clone ${finalDir}`);
        wrapped = appendLeakToError(wrapped, leak);
      }

      throw wrapped instanceof Error ? wrapped : new Error(errorMessage(wrapped));
    }
  });

  if (recordedName === undefined) {
    // Defensive: the guard always sets it on success.
    throw new Error("addMarketplace: internal error -- guard returned without recording a name");
  }

  return recordedName;
}

/**
 * RECON-03: route the catch arm of `addMarketplace` to either a typed
 * orchestrated outcome OR a standalone notify() row. Returns an
 * `AddMarketplaceOutcome` when orchestrated, otherwise `undefined` after
 * having fired the standalone notify().
 *
 * The non-enumerated catastrophic branch in orchestrated mode collapses to
 * the closed-set `"unparseable"` reason because every recognised add
 * precondition yields a typed error and network reachability failures are
 * classified by `classifyAddError`'s errno ladder (WR-03 -- the github
 * guard's clone-catch only cleans staging and rethrows unclassified), so an
 * unrecognised throw is by construction an opaque source-tree shape.
 */
function handleAddFailure(
  opts: AddMarketplaceOptions,
  err: unknown,
  orchestrated: boolean,
): AddMarketplaceOutcome | undefined {
  const reason = classifyAddError(err);
  if (reason === undefined) {
    if (orchestrated) {
      const wrapped = err instanceof Error ? err : new Error(errorMessage(err));
      return {
        status: "failed",
        reason: "unparseable",
        error: wrapped,
        cause: errorMessage(err),
      };
    }

    // Not an enumerated add precondition (e.g. a StateLockHeldError or an
    // unforeseen catastrophic error) -- never swallow it in standalone mode.
    throw err;
  }

  if (orchestrated) {
    const wrapped = err instanceof Error ? err : new Error(errorMessage(err));
    return { status: "failed", reason, error: wrapped, cause: errorMessage(err) };
  }

  notify(opts.ctx, opts.pi, {
    marketplaces: [
      {
        name: addSubjectName(err, opts.rawSource),
        scope: opts.scope,
        status: "failed",
        reasons: [reason],
        plugins: [],
      },
    ],
  });
  return undefined;
}

/**
 * RECON-03: returns `AddMarketplaceOutcome` in orchestrated mode and
 * `undefined` in standalone mode (after firing the standalone notify()).
 * Callers in orchestrated mode know the outcome is defined; standalone
 * callers ignore the return.
 */
export async function addMarketplace(
  opts: AddMarketplaceOptions,
): Promise<AddMarketplaceOutcome | undefined> {
  const gitOps = opts.gitOps ?? DEFAULT_GIT_OPS;
  const credentialOps = opts.credentialOps ?? DEFAULT_CREDENTIAL_OPS;
  const locations = locationsFor(opts.scope, opts.cwd);
  const source = parsePluginSource(opts.rawSource);
  // RECON-03: orchestrated mode suppresses every notify() call and returns the
  // typed outcome instead. Standalone (default/omitted) preserves byte-identity.
  const orchestrated = opts.notifications?.mode === "orchestrated";

  // ATTR-07: route every enumerated precondition failure through notify as a
  // structured `⊘ <subject> [<scope>] (failed) {<reason>}` row on the
  // marketplace subject (D-48-A reasons brace) instead of throwing raw past the
  // orchestrator. Genuinely unexpected/catastrophic errors re-throw -- only the
  // closed-set add preconditions are caught here. The github guard's own catch
  // (cleanupStaging + appendLeakToError) runs FIRST and re-throws; this catch
  // sees the already-cleaned error, so no staging dir leaks.
  let recordedName: string;
  try {
    recordedName = await runAddInGuard({
      opts,
      locations,
      source,
      gitOps,
      credentialOps,
      orchestrated,
    });
  } catch (err) {
    // rethrowPreconditionErrors short-circuits BEFORE the mode branch so the
    // bootstrap composer contract is preserved in BOTH standalone and
    // orchestrated modes (the typed precondition flows past the orchestrator).
    if (opts.rethrowPreconditionErrors === true) {
      // Composition seam (bootstrap): re-throw the typed precondition so the
      // caller can make a control-flow decision (e.g. swallow the idempotent
      // duplicate-name re-run) instead of emitting a structured failed row.
      throw err;
    }

    return handleAddFailure(opts, err, orchestrated);
  }

  // D-03-INV: post-state-commit completion-cache invalidation.
  // The marketplace-names cache for this scope and the plugin index for the
  // newly recorded marketplace are both stale-by-construction. Cache cleanup
  // runs after the state commit so a cache hiccup never rolls back the user's
  // primary success.
  try {
    await invalidateMarketplaceNames(locations.marketplaceNamesCacheFile, opts.scope);
    await dropMarketplaceCache(
      await locations.pluginCacheFile(recordedName),
      opts.scope,
      recordedName,
    );
  } catch {
    // Cache-refresh failures are swallowed: there is no clean notification
    // shape for "cache failure after a successful state mutation" and
    // emitting a second notify() would double severity routing. The state
    // mutation already succeeded; only the completion-cache is stale.
  }

  if (orchestrated) {
    return { status: "added", name: recordedName };
  }

  // Emit one MarketplaceNotificationMessage per outcome. Severity and
  // reload-hint are computed by notify(); callers MUST NOT compose them.
  // Catalog: `path-source` + `github-source` fixtures in catalog-uat.test.ts.
  notify(opts.ctx, opts.pi, {
    marketplaces: [
      {
        name: recordedName,
        scope: opts.scope,
        status: "added",
        plugins: [],
      },
    ],
  });
  return undefined;
}

async function addGithubInGuard(args: {
  ctx: ExtensionContext;
  state: ExtensionState;
  locations: ScopedLocations;
  source: GitHubSource;
  gitOps: GitOps;
  credentialOps: CredentialOps;
  deviceFlowHttp?: DeviceFlowHttp;
  cwd: string;
}): Promise<string> {
  const { ctx, state, locations, source, gitOps, credentialOps, deviceFlowHttp, cwd } = args;
  const stagingDir = await locations.sourcesStagingDir(randomUUID());
  const cloneUrl = `https://github.com/${source.owner}/${source.repo}.git`;

  // AUTH-01: bind the Device Flow trigger as the onAuthRequired closure
  // for this clone. platform/git.ts::buildAuthCallbacks first consults
  // credentialOps.fill(host); only on a miss does it invoke this closure.
  // AUTH-09: the closure interpolates ONLY user_code + verification_uri
  // (via initiateDeviceFlow's notifyFn) -- the access token is acquired
  // LATER in the poll loop and is never passed back to a notify or Error.
  //
  // host is the bare hostname; the supported scope is GitHub-only so the
  // literal "github.com" is correct here (matches the GitHubSource
  // parser's contract at domain/source.ts -- every github source resolves
  // to https://github.com/<owner>/<repo>). AUTH-D02 parameterizes this
  // from the source.
  const host = "github.com";
  const notifyFn = makeRawNotifyFn(ctx);
  const onAuthRequired = async (): Promise<AuthAttemptResult> =>
    initiateDeviceFlow({
      host,
      credentialOps,
      notifyFn,
      ...(deviceFlowHttp !== undefined && { http: deviceFlowHttp }),
    });
  const auth: GitAuthBundle = { credentialOps, host, onAuthRequired };

  // 1. Clone into staging (NFR-5: only github branch reaches gitOps.clone).
  try {
    await gitOps.clone({
      dir: stagingDir,
      url: cloneUrl,
      ...(source.ref !== undefined && { ref: source.ref, singleBranch: true }),
      auth,
    });
  } catch (err) {
    // Clone itself failed -- there is no staging dir to clean up beyond a
    // potentially partial mkdir. cleanupStaging is ENOENT-tolerant.
    const leak = await cleanupStaging(stagingDir, "marketplace clone staging");
    throw appendLeakToError(err, leak);
  }

  let stagedAtFinal = false;
  let finalDir: string | undefined;
  try {
    // 2. Read + validate manifest.
    const manifestPath = path.join(stagingDir, ".claude-plugin", "marketplace.json");
    const parsed = await loadMarketplaceManifest(manifestPath);

    const derivedName = (parsed as { name: string }).name;

    // 3. MA-8: duplicate name in this scope.
    if (derivedName in state.marketplaces) {
      throw new MarketplaceDuplicateNameError(derivedName, locations.scope);
    }

    // 4. MA-6: stale-clone refusal on the final destination.
    finalDir = await locations.sourceCloneDir(derivedName);
    if (await pathExists(finalDir)) {
      // Carry the derived name so the ATTR-07 entrypoint catch renders the
      // `(failed) {stale clone}` row on the marketplace SUBJECT (A2).
      throw new StaleSourceCloneError(finalDir, derivedName);
    }

    // 5. Atomic rename -- same FS by D-09 (sources-staging/ and sources/
    //    are siblings under extensionRoot). Ensure the parent (sources/)
    //    exists; on a fresh scope it has not been created yet.
    await mkdir(path.dirname(finalDir), { recursive: true });
    await rename(stagingDir, finalDir);
    stagedAtFinal = true;

    // 6. Mutate state.
    state.marketplaces[derivedName] = {
      name: derivedName,
      scope: locations.scope,
      source,
      addedFromCwd: cwd,
      manifestPath: path.join(finalDir, ".claude-plugin", "marketplace.json"),
      marketplaceRoot: finalDir,
      lastUpdatedAt: new Date().toISOString(),
      plugins: {},
    };
    return derivedName;
  } catch (err) {
    // MA-9: append leaks rather than mask original error.
    let wrapped: unknown = err;
    if (!stagedAtFinal) {
      const leak = await cleanupStaging(stagingDir, "marketplace clone staging");
      wrapped = appendLeakToError(wrapped, leak);
    } else if (finalDir !== undefined) {
      const leak = await cleanupStaging(finalDir, `marketplace final clone ${finalDir}`);
      wrapped = appendLeakToError(wrapped, leak);
    }

    throw wrapped instanceof Error ? wrapped : new Error(errorMessage(wrapped));
  }
}

async function addPathInGuard(args: {
  state: ExtensionState;
  locations: ScopedLocations;
  source: PathSource;
  cwd: string;
}): Promise<string> {
  const { state, locations, source, cwd } = args;

  // MA-3: source.resolved may point at a directory OR directly at a
  // marketplace.json file. Probe and dispatch.
  //
  // Note: domain/source.ts PathSource exposes `raw` and `logical` (no
  // `resolved` field). We use `source.logical` here since it equals `raw`
  // verbatim (SP-7) and is the on-disk lookup key for path-source `add`.
  //
  // CR-02 (SP-7 / MA-4): Node's fs APIs do NOT perform shell tilde
  // expansion -- stat("~/...") returns ENOENT against a literal "~"
  // directory. Expand "~" and "~/..." against os.homedir() before
  // probing on disk. The stored `source.raw` keeps the verbatim "~"
  // form (SP-7); only the on-disk lookup is rewritten.
  const onDiskPath = expandTildePath(source.logical);
  const probe = await stat(onDiskPath);
  let manifestPath: string;
  let marketplaceRoot: string;
  if (probe.isDirectory()) {
    marketplaceRoot = onDiskPath;
    manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  } else if (probe.isFile()) {
    manifestPath = onDiskPath;
    // Walk up two levels: <root>/.claude-plugin/marketplace.json -> <root>
    marketplaceRoot = path.dirname(path.dirname(manifestPath));
  } else {
    // ATTR-07 (S5e): a path that exists but is neither a regular file nor a
    // directory (e.g. a socket / fifo) is an unusable source. Tag it ENOTDIR so
    // classifyAddError routes it structurally to `source missing` alongside the
    // ENOENT (path absent) case -- no substring matching.
    const notUsable = new Error(
      `Local marketplace path is neither a file nor a directory: ${onDiskPath}`,
    ) as NodeJS.ErrnoException;
    notUsable.code = "ENOTDIR";
    throw notUsable;
  }

  // Read + validate manifest.
  const parsed = await loadMarketplaceManifest(manifestPath);

  const derivedName = (parsed as { name: string }).name;

  // MA-8: duplicate name in scope.
  if (derivedName in state.marketplaces) {
    throw new MarketplaceDuplicateNameError(derivedName, locations.scope);
  }

  // MA-4: source already preserves the user-typed `~` verbatim
  // (ParsedSource.raw) via pathSource() factory. We store the parsed
  // source object directly -- ST-6 funnel re-validates on next load.
  state.marketplaces[derivedName] = {
    name: derivedName,
    scope: locations.scope,
    source,
    addedFromCwd: cwd,
    manifestPath,
    marketplaceRoot,
    lastUpdatedAt: new Date().toISOString(),
    plugins: {},
  };
  return derivedName;
}

function expandTildePath(sourcePath: string): string {
  if (sourcePath === "~") {
    return os.homedir();
  }

  return sourcePath.startsWith("~/") ? path.join(os.homedir(), sourcePath.slice(2)) : sourcePath;
}
