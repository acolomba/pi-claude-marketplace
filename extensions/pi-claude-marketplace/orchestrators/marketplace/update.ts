// orchestrators/marketplace/update.ts
//
// MU-1, MU-4, MU-5, MU-6, MU-7, MU-8, MU-9 + RH-1/RH-2/RH-5 + SC-6 + NFR-5.
//
// Each orchestration emits exactly one `notify(ctx, pi,...)` call with a
// discriminated `NotificationMessage` payload. Severity, reload-hint,
// soft-dep marker, and per-row glyph dispatch are owned by the renderer in
// `shared/notify.ts`.
//
// Outcomes -> NotificationMessage payloads:
//  - autoupdate OFF (manifest-only refresh): UXG-05 distinguishes a no-op from
//  a real change via a manifest-CONTENT compare (pre/post validated
//  marketplace.json content; NOT lastUpdatedAt, NOT git SHA). No change ->
//  `{ marketplaces: [{ name, scope, status: "skipped", reasons:
//  ["up-to-date"], plugins: [] }] }` (catalog UAT state `update-no-op-skipped`,
//  warning). Changed -> `{ marketplaces: [{ name, scope, status: "updated",
//  plugins: [] }] }` (catalog UAT state `manifest-refresh-changed`). NEITHER
//  fires the reload-hint: `shouldEmitReloadHint` triggers only on a PLUGIN row
//  with a state-changing status, never on a marketplace status, and these
//  payloads have no plugin rows.
//  - autoupdate ON (cascade): `{ marketplaces: [{ name, scope, status:
//  "updated", plugins: outcomes.map(outcomeToCascadePluginMessage) }] }`.
//  The per-plugin cause chain rides on `PluginFailedMessage.cause`;
//  `unchanged` renders as `⊘... (skipped) {up-to-date}`. Catalog UAT
//  fixture `mixed-outcomes`.
//  - mp-level failure (clone/manifest unreachable): the failed marketplace
//  header plus a synthetic `PluginFailedMessage` child carrying
//  `cause: err` so the underlying MarketplaceUpdateError reaches the user
//  (`err.retryHint` remains on the error for programmatic inspection).
//  - empty targets (no marketplaces configured): `{ marketplaces: [] }`
//  renders the `(no marketplaces)` sentinel.
//  - post-success cache cleanup: a `rm` runs to drop the stale completion
//  cache; a cleanup leak there is intentionally NOT surfaced (PU-4 / AS-6).
//
// Per-row soft-dep markers are driven by the per-plugin
// `dependencies: Dependency[]` field on `PluginUpdatedMessage` /
// `PluginInstalledMessage` / `PluginReinstalledMessage`, threaded through the
// notify-time `softDepStatus(pi)` probe.
//
// MU-2 and MU-3 do not apply under the "follow upstream blindly" contract --
// the local marketplace clone is read-only, so the pull --ff-only
// choreography and non-fast-forward divergence detection have no role.
//
// Flow:
//  1. Resolve scope(s):
//  - opts.name === undefined → bare form (MU-1, SC-6)
//  - opts.name + opts.scope === undefined → resolveScopeFromState
//  - opts.name + opts.scope set → use it directly
//
//  2. For each (scope, marketplaceName) pair:
//  a. OUTER GUARD (wraps refresh + persist, NOT cascade):
//  withStateGuard(locations, async (state) => {
//  record = state.marketplaces[name]
//  if (record.source.kind === "github"):
//  cloneAdvanced = false
//  try {
//  refreshGitHubClone(cloneDir, record.source.ref, gitOps,
//  => { cloneAdvanced = true; });
// MU-5: the onFetchSucceeded callback flips
//  // cloneAdvanced to true ONLY after gitOps.fetch returns.
//  // Pre-fetch throws (DNS/network/auth) leave cloneAdvanced
//  // at false so the "Retry the command." hint is suppressed.
//  // Any later step throw (forceUpdateRef/checkout) or
//  // manifest re-read throw still produces the retry hint.
//  manifest = read+validate <marketplaceRoot>/.claude-plugin/marketplace.json
//  record.lastUpdatedAt = now
//  } catch (err) {
//  throw new MarketplaceUpdateError(..., { cause, retryHint: cloneAdvanced ? "Retry the command." : "" })
//  }
//  else if path:
//  refreshPathManifest(record) // NO gitOps; NFR-5
//  // capture snapshot for cascade-outside-guard:
//  snapshot = { autoupdate: record.autoupdate ?? false, plugins: Object.keys(record.plugins) }
//  return snapshot
//  })
//
//  b. CASCADE OUTSIDE GUARD (honors MU-4 literal "persisted before cascade"):
//  if (snapshot.autoupdate === true && pluginUpdate is provided):
//  for each plugin in snapshot.plugins:
//  outcome = await pluginUpdate(plugin, name, scope);
//  partition[outcome.partition].push(outcome)
//  // MU-7: per-plugin outcomes feed outcomeToCascadePluginMessage construction
//
//  3. Compose user-visible output via a single notify(ctx, pi,...)
//  call per orchestration (see header comment above for
//  the catalog UAT fixtures bound to each shape). Empty targets,
//  mp-level failure, autoupdate-OFF success, and autoupdate-ON
//  cascade each map to a distinct NotificationMessage shape;
//  severity and reload-hint are renderer-computed and MUST NOT be
//  composed by callers.
//
//  D-14 sequence: fetch + (symbolic HEAD) forceUpdateRef + checkout, OR
//  (detached HEAD) checkout directly. NO `pull`.

import path from "node:path";

import { initiateDeviceFlow } from "../../domain/github-auth.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { loadMergedScopeConfig } from "../../persistence/config-merge.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { DEFAULT_CREDENTIAL_OPS } from "../../platform/git-credential.ts";
import { dropMarketplaceCache } from "../../shared/completion-cache.ts";
import {
  InvalidMarketplaceManifestError,
  MarketplaceUpdateError,
  PluginShapeError,
  assertNever,
  composeErrorWithCauseChain,
  errorMessage,
} from "../../shared/errors.ts";
import { makeRawNotifyFn, notify } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";

import {
  DEFAULT_GIT_OPS,
  refreshGitHubClone,
  resolveScopeOrNotifyNotAdded,
  type GitAuthBundle,
  type GitOps,
} from "./shared.ts";

import type { DeviceFlowHttp } from "../../domain/github-auth.ts";
import type { ParsedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { CredentialOps } from "../../platform/git-credential.ts";
import type { AuthAttemptResult, OnAuthRequiredFn } from "../../platform/git.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type {
  ContentReason,
  PluginFailedMessage,
  PluginNotificationMessage,
} from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";
import type {
  PluginUpdateFailedOutcome,
  PluginUpdateFn,
  PluginUpdateOutcome,
  PluginUpdateSkippedOutcome,
} from "../types.ts";

export interface UpdateMarketplaceOptions {
  readonly ctx: ExtensionContext;
  /** Single marketplace by name. Required for `updateMarketplace`; rejected by `updateAllMarketplaces` (which derives the list from state). */
  readonly name: string;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly gitOps?: GitOps;
  /**
   * Autoupdate-cascade injection seam. When omitted, the autoupdate cascade
   * is a NO-OP (tests inject a mock).
   */
  readonly pluginUpdate?: PluginUpdateFn;
  /**
   * Soft-dep probe target. `pi.getAllTools` is the source of truth for
   * whether `pi-subagents` / `pi-mcp-adapter` are loaded. Required (not
   * optional) so every `notify(ctx, pi, ...)` call has a non-null reference;
   * the renderer threads `softDepStatus(pi)` internally at notify-time.
   */
  readonly pi: ExtensionAPI;
  /**
   * AUTH-02 injection seam. Defaults to DEFAULT_CREDENTIAL_OPS which
   * wraps `git credential fill/approve/reject` via subprocess. Tests
   * inject makeMockCredentialOps() from tests/helpers/credential-mock.ts
   * so the developer's OS keychain is never touched.
   */
  readonly credentialOps?: CredentialOps;
  /**
   * Test seam for Device Flow integration tests. Production callers omit
   * this field and get DEFAULT_DEVICE_FLOW_HTTP (real github.com fetch)
   * inside the orchestrator's onAuthRequired closure.
   */
  readonly deviceFlowHttp?: DeviceFlowHttp;
}

export interface UpdateAllMarketplacesOptions {
  readonly ctx: ExtensionContext;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly gitOps?: GitOps;
  readonly pluginUpdate?: PluginUpdateFn;
  /** See `UpdateMarketplaceOptions.pi`. */
  readonly pi: ExtensionAPI;
  /**
   * AUTH-02 injection seam. Defaults to DEFAULT_CREDENTIAL_OPS which
   * wraps `git credential fill/approve/reject` via subprocess. Tests
   * inject makeMockCredentialOps() from tests/helpers/credential-mock.ts
   * so the developer's OS keychain is never touched.
   */
  readonly credentialOps?: CredentialOps;
  /**
   * Test seam for Device Flow integration tests. Production callers omit
   * this field and get DEFAULT_DEVICE_FLOW_HTTP (real github.com fetch)
   * inside the orchestrator's onAuthRequired closure.
   */
  readonly deviceFlowHttp?: DeviceFlowHttp;
}

/** MU-1 single-name form. */
export async function updateMarketplace(opts: UpdateMarketplaceOptions): Promise<void> {
  const gitOps = opts.gitOps ?? DEFAULT_GIT_OPS;
  const credentialOps = opts.credentialOps ?? DEFAULT_CREDENTIAL_OPS;
  const userLocations = locationsFor("user", opts.cwd);
  const projectLocations = locationsFor("project", opts.cwd);

  // MU-1 + ATTR-06 / SC#1: resolve scope and enforce the missing-marketplace
  // precondition. On a miss the helper has already emitted the standalone
  // `(failed) {not added}` variant, so return without entering the refresh path.
  const resolved = await resolveScopeOrNotifyNotAdded(opts, userLocations, projectLocations);
  if (resolved === undefined) {
    return;
  }

  await refreshOneMarketplace({
    ctx: opts.ctx,
    pi: opts.pi,
    name: opts.name,
    scope: resolved.scope,
    locations: resolved.locations,
    gitOps,
    credentialOps,
    ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
    ...(opts.pluginUpdate !== undefined && { pluginUpdate: opts.pluginUpdate }),
  });
}

/**
 * MU-1 bare form (no name): refresh every marketplace in target scope(s).
 * SC-6 enumerates both scopes when --scope omitted.
 */
export async function updateAllMarketplaces(opts: UpdateAllMarketplacesOptions): Promise<void> {
  const gitOps = opts.gitOps ?? DEFAULT_GIT_OPS;
  const credentialOps = opts.credentialOps ?? DEFAULT_CREDENTIAL_OPS;
  // Iteration order is project-first per MSG-GR-3 so same-name cross-scope
  // stable-sort ties render project-before-user.
  const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];

  // Collect (scope, marketplaceName) pairs from a single fresh state read per scope.
  const targets: { scope: Scope; locations: ScopedLocations; name: string }[] = [];
  for (const scope of scopes) {
    const locations = locationsFor(scope, opts.cwd);
    const state = await loadState(locations.extensionRoot);
    for (const name of Object.keys(state.marketplaces)) {
      targets.push({ scope, locations, name });
    }
  }

  // CMC-10: empty-set succeeds silently. The renderer emits the
  // "(no marketplaces)" sentinel when `message.marketplaces` is the empty
  // array; callers MUST NOT compose the sentinel text.
  if (targets.length === 0) {
    notify(opts.ctx, opts.pi, { marketplaces: [] });
    return;
  }

  // Process sequentially.
  for (const t of targets) {
    await refreshOneMarketplace({
      ctx: opts.ctx,
      pi: opts.pi,
      name: t.name,
      scope: t.scope,
      locations: t.locations,
      gitOps,
      credentialOps,
      ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
      ...(opts.pluginUpdate !== undefined && { pluginUpdate: opts.pluginUpdate }),
    });
  }
}

interface RefreshOneArgs {
  readonly ctx: ExtensionContext;
  readonly name: string;
  readonly scope: Scope;
  readonly locations: ScopedLocations;
  readonly gitOps: GitOps;
  readonly pluginUpdate?: PluginUpdateFn;
  readonly pi: ExtensionAPI;
  readonly credentialOps: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
}

/**
 * UXG-05 change-detection seam. Reads the persisted, schema-validated
 * `MarketplaceManifest` and returns a comparison key (the `JSON.stringify` of
 * the validated parsed content). Used to compare the manifest content PRE vs
 * POST refresh so the no-op vs changed decision (autoupdate-OFF and
 * autoupdate-ON alike) can distinguish a genuine change (`updated`) from a
 * no-op (`skipped {up-to-date}`).
 *
 * WR-01: `loadMarketplaceManifest` returns the RAW `JSON.parse` value -- it
 * runs `MARKETPLACE_VALIDATOR.Check()` but NEVER `.Parse()`/`.Clean()`. So the
 * comparison key is `JSON.stringify` of the schema-validated-but-raw parsed
 * manifest: its key order mirrors the source file and it retains any
 * unknown/extra fields. Any content delta -- including reordered keys or
 * changed extra fields -- reads as "changed", the conservative direction. Do
 * NOT "optimize" `loadMarketplaceManifest` into `.Parse()`: that would rewrite
 * the key order and could silently flip the no-op classification.
 *
 * Compares ONLY post-validation parsed content (T-27-05 mitigation): a tampered
 * manifest that fails the schema throws inside `loadMarketplaceManifest` and
 * routes to the `(failed)` path, never to the no-op `(skipped)` decision.
 *
 * WR-02: returns `undefined` ONLY for a genuine "no manifest yet" (ENOENT) PRE
 * read; a `undefined` PRE key compared against a defined POST key reads as
 * "changed", the safe default. Any OTHER PRE-read failure (EACCES, malformed
 * JSON, schema-invalid) is re-thrown so it propagates to `refreshRecord`'s
 * try/catch and routes to the existing `(failed)` path -- the same routing
 * `validateManifestAtRoot` already uses for POST-read failures. This removes
 * the silent always-`(updated)` failure mode for a corrupt/unreadable
 * pre-existing manifest.
 */
async function manifestContentKey(
  record: ExtensionState["marketplaces"][string],
): Promise<string | undefined> {
  try {
    const parsed = await loadMarketplaceManifest(record.manifestPath);
    return JSON.stringify(parsed);
  } catch (err) {
    // WR-02: only ENOENT (no manifest yet) maps to the changed-safe default.
    // Mirrors the errno-narrowing idiom `reasonsFromCascadeError` already uses
    // (gates on `(err as NodeJS.ErrnoException).code`). All other failures
    // propagate to `(failed)`.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw err;
  }
}

async function refreshRecord(
  record: ExtensionState["marketplaces"][string],
  args: RefreshOneArgs,
): Promise<boolean> {
  const { name, locations, gitOps } = args;
  const source = record.source as ParsedSource;
  let cloneAdvanced = false;
  try {
    // UXG-05: capture the PRE-refresh validated-manifest content key BEFORE the
    // refresh re-validates and re-persists. Read off the currently persisted
    // `record.manifestPath` (the manifest as the user last saw it). NOT keyed on
    // `record.lastUpdatedAt` -- it is stamped to `now` every refresh
    // regardless of content.
    // WR-01: this read lives INSIDE the try so a non-ENOENT PRE-read failure
    // (manifestContentKey re-throws per WR-02) is wrapped as MarketplaceUpdateError
    // exactly like a POST-read failure -- same `(failed)` routing, same cause
    // chain. Do NOT hoist it back outside the try (that bypasses the wrapper and
    // surfaces a bare, mislabeled reason).
    const preKey = await manifestContentKey(record);
    if (source.kind === "github") {
      const cloneDir = await locations.sourceCloneDir(name);
      // AUTH-02: bind the Device Flow trigger as the onAuthRequired
      // closure for this fetch. platform/git.ts::buildAuthCallbacks first
      // consults credentialOps.fill(host); on a hit (the post-add common
      // case) the stored token is returned and Device Flow does NOT trigger
      // -- this is the AUTH-02 silent-reuse contract. AUTH-09: the
      // closure interpolates ONLY user_code + verification_uri inside
      // initiateDeviceFlow's notifyFn -- the access token is acquired later
      // in the poll loop and never passed back to a notify or Error.
      //
      // host is the bare hostname; the supported scope is GitHub-only so the
      // literal "github.com" is correct here. AUTH-D02 parameterizes this
      // from the source.
      const host = "github.com";
      const { ctx, credentialOps, deviceFlowHttp } = args;
      const notifyFn = makeRawNotifyFn(ctx);
      const onAuthRequired: OnAuthRequiredFn = async (): Promise<AuthAttemptResult> =>
        initiateDeviceFlow({
          host,
          credentialOps,
          notifyFn,
          ...(deviceFlowHttp !== undefined && { http: deviceFlowHttp }),
        });
      const auth: GitAuthBundle = { credentialOps, host, onAuthRequired };

      await refreshGitHubClone(
        cloneDir,
        source.ref,
        gitOps,
        () => {
          cloneAdvanced = true;
        },
        auth,
      );
      await validateManifestAtRoot(record, cloneDir);
    } else if (source.kind === "path") {
      await validateManifestAtRoot(record, record.marketplaceRoot);
    } else {
      throw new Error(
        `Cannot update marketplace "${name}": unsupported source kind "${source.kind}"`,
      );
    }

    // UXG-05: capture the POST-refresh validated-manifest content key AFTER the
    // refresh re-validates (and `validateManifestAtRoot` repoints
    // `record.manifestPath` if the root moved). Whole-manifest equality of the
    // parsed/validated content -- source-kind-uniform (a path source whose local
    // marketplace.json is unchanged compares equal; a github source whose clone
    // advanced but yielded byte-identical manifest content also compares equal).
    const postKey = await manifestContentKey(record);
    const changed = preKey !== postKey;

    // lastUpdatedAt is stamped on EVERY refresh (used elsewhere); it is
    // deliberately NOT the change signal.
    record.lastUpdatedAt = new Date().toISOString();
    return changed;
  } catch (err) {
    throw new MarketplaceUpdateError(
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- cloneAdvanced is set via callback inside refreshGitHubClone.
      cloneAdvanced
        ? `Marketplace "${name}" clone advanced but manifest could not be persisted.`
        : `Failed to update marketplace "${name}".`,
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- cloneAdvanced is set via callback inside refreshGitHubClone.
      { cause: err, retryHint: cloneAdvanced ? "Retry the command." : "" },
    );
  }
}

interface RefreshSnapshot {
  readonly autoupdate: boolean;
  readonly plugins: readonly string[];
  /**
   * UXG-05: true when the refresh changed the validated marketplace.json
   * content; false when the manifest content was byte-identical pre/post
   * (the no-op case). Drives the autoupdate-OFF `updated` vs `skipped
   * {up-to-date}` emission. Source-kind-uniform (path + github).
   */
  readonly changed: boolean;
}

async function snapshotAfterRefresh(args: RefreshOneArgs): Promise<RefreshSnapshot | undefined> {
  const { name, locations } = args;
  // SPLIT-01 rewire: autoupdate lives in claude-plugins.json (config), not
  // state. Read it OUTSIDE the lock (read-only seam; mergeScopeConfigs is a
  // pure reducer over loadConfig, which never throws).
  const { merged } = await loadMergedScopeConfig(locations);
  const autoupdate = merged.marketplaces[name]?.entry.autoupdate ?? false;
  return withStateGuard(locations, async (state) => {
    const record = state.marketplaces[name];
    if (record === undefined) {
      // TOCTOU race: the marketplace was removed between
      // `resolveScopeOrNotifyNotAdded`'s pre-guard `loadState` and this guard's
      // fresh `loadState`. The pre-guard already proved existence and the
      // missing-marketplace precondition is handled there (routed to the
      // standalone `{not added}` variant); reaching here means a concurrent
      // removal in that window. Return undefined so the caller skips the
      // cascade and emits NOTHING further -- no raw MarketplaceNotFoundError
      // escapes (which `refreshOneMarketplace`'s catch would misattribute as the
      // lying `{network unreachable}` default, the exact ATTR-10/NFR-5 class this
      // milestone closes). Mirrors remove.ts:235-244's silent-return at the same
      // withStateGuard boundary. withStateGuard still saves the unmodified state
      // (a harmless re-write of the same content).
      return undefined;
    }

    const changed = await refreshRecord(record, args);
    return {
      autoupdate,
      plugins: Object.keys(record.plugins),
      changed,
    };
  });
}

async function cascadeAutoupdates(
  snapshot: RefreshSnapshot,
  name: string,
  scope: Scope,
  pluginUpdate: PluginUpdateFn | undefined,
): Promise<readonly PluginUpdateOutcome[]> {
  if (!snapshot.autoupdate || pluginUpdate === undefined) {
    return [];
  }

  const outcomes: PluginUpdateOutcome[] = [];
  for (const plugin of snapshot.plugins) {
    try {
      outcomes.push(await pluginUpdate(plugin, name, scope));
    } catch (err) {
      // `notes` is consumed by callers OUTSIDE the notify path (e.g.
      // JSON-mode outcome aggregation in tests) and by the
      // narrowFailReason notes-substring fallback below, so the cause-chain
      // trailer is composed inline here. The user-visible cause-chain trailer
      // renders via PluginFailedMessage.cause at the 4-space indent the
      // renderer owns; the `outcome.cause` stamp below carries the raw `err`
      // for that path.
      //
      // Pre-narrow the closed-set Reason via `reasonsFromCascadeError(err)`
      // so the cascade row renders the precise cause class (`permission
      // denied` / `source missing` / `no longer installable` / ...) instead
      // of degrading to the permissive `not in manifest` fallback via the
      // consumer's `narrowFailReasons` substring parse.
      const typedReasons = reasonsFromCascadeError(err);
      outcomes.push({
        partition: "failed",
        name: plugin,
        notes: [composeErrorWithCauseChain(err)],
        ...(typedReasons !== undefined && { reasons: typedReasons }),
        // CMC-13: required `boolean` on the outcome contract. `(failed)`
        // cascade rows do not render the soft-dep marker (MSG-SD-3), so the
        // value is deliberately `false`; explicit emission keeps every
        // producer site honest.
        declaresAgents: false,
        declaresMcp: false,
        // Carry the raw `err` so the cascade mapper
        // (outcomeToCascadePluginMessage) can attach it to
        // PluginFailedMessage.cause for the 4-space-indent cause-chain
        // trailer. `notes` above is retained for the non-notify consumers
        // (test fixtures + outcome aggregators) and for the narrowFailReason
        // notes-substring fallback.
        ...(err instanceof Error && { cause: err }),
      });
    }
  }

  return outcomes;
}

/**
 * Typed-dispatch helper for the `cascadeAutoupdates` catch. Maps a thrown
 * error to a closed-set Reason[] using the same priority order as the cascade
 * narrowers in `orchestrators/plugin/{update,reinstall}.ts::reasonsFromTypedError`:
 * PluginShapeError variants first, then errno-bearing FS errors, then
 * `undefined` to defer to the consumer's substring fallback.
 */
function reasonsFromCascadeError(err: unknown): readonly ContentReason[] | undefined {
  if (err instanceof PluginShapeError) {
    // Switch on `err.shape.kind` for compile-time exhaustiveness.
    switch (err.shape.kind) {
      case "no-longer-installable":
      case "not-installable":
        return ["no longer installable"] as const;
      case "not-in-manifest":
        return ["not in manifest"] as const;
      case "already-installed":
        // Cascade-path "already installed" is unexpected (we only
        // cascade-update plugins already in the record); map to the
        // permissive `not in manifest` fallback.
        return ["not in manifest"] as const;
    }
  }

  // ATTR-10 / D-48-B: a typed marketplace-manifest parse/validation failure
  // (malformed JSON or schema-invalid marketplace.json) maps to the closed-set
  // `invalid manifest` reason for BOTH path and github sources. A path-source
  // manifest failure is network-free (NFR-5), so it MUST NOT fall through to the
  // `?? ["network unreachable"]` default at the refreshOneMarketplace catch; a
  // github clone that advanced and then hit a malformed manifest is genuinely
  // `invalid manifest` too (only typed manifest errors map here, not generic
  // github network failures). The refreshOneMarketplace catch sees
  // the InvalidMarketplaceManifestError WRAPPED inside a MarketplaceUpdateError
  // (refreshRecord rethrows with `{ cause }`), so unwrap ONE level of cause as
  // well (mirrors add.ts::unwrapAddError). The cascadeAutoupdates catch passes
  // the raw error, which the direct `instanceof` covers. Placed before the errno
  // checks so the typed class takes precedence over any incidental errno on the
  // cause chain.
  if (
    err instanceof InvalidMarketplaceManifestError ||
    (err instanceof Error && err.cause instanceof InvalidMarketplaceManifestError)
  ) {
    return ["invalid manifest"] as const;
  }

  // Mirror the one-level cause unwrap above for errno-bearing FS errors: the
  // refreshOneMarketplace catch receives the errno error WRAPPED inside a
  // MarketplaceUpdateError (refreshRecord rethrows with `{ cause }`), so the
  // wrapper itself carries no `code`. Without the unwrap, a path-source
  // refresh that hits ENOENT/ENOTDIR/EACCES/EPERM -- a network-free failure
  // (NFR-5) -- would fall through to the lying `?? ["network unreachable"]`
  // default instead of the correct closed-set `source missing` /
  // `permission denied` reasons.
  if (err instanceof Error) {
    let errnoBearer: NodeJS.ErrnoException | undefined;
    if ((err as NodeJS.ErrnoException).code !== undefined) {
      errnoBearer = err;
    } else if (err.cause instanceof Error) {
      errnoBearer = err.cause;
    }

    const code = errnoBearer?.code;
    if (code === "EACCES" || code === "EPERM") {
      return ["permission denied"] as const;
    }

    if (code === "ENOENT" || code === "ENOTDIR") {
      return ["source missing"] as const;
    }
  }

  return undefined;
}

/**
 * Map a `PluginUpdateOutcome` to a discriminated `PluginNotificationMessage`.
 * The renderer (`renderPluginRow` in shared/notify.ts) owns the icon
 * dispatch, the version-arrow composition, the reasons-brace composition, and
 * the per-row soft-dep marker injection. The mapper's job is structural --
 * pick the variant that matches the partition and forward the
 * partition-specific fields.
 *
 * Per-partition mapping:
 *  - `updated`   -> `PluginUpdatedMessage{ from, to, dependencies }`. Renderer
 *                   composes `<name> v<from> → v<to> (updated)`; MSG-SD-3
 *                   allows the soft-dep marker, and `dependencies` carries the
 *                   declared kinds the notify-time probe combines with
 *                   `softDepStatus(pi)`.
 *  - `unchanged` -> `PluginSkippedMessage{ reasons: ["up-to-date"] }`. The
 *                   `skipped` status routes through the warning severity
 *                   ladder -> ⊘ glyph.
 *  - `skipped`   -> `PluginSkippedMessage{ reasons: [<narrowed>] }`, narrowed
 *                   via `narrowSkipReason`.
 *  - `failed`    -> `PluginFailedMessage{ reasons: [<narrowed>], cause? }`. The
 *                   cause chain rides on the per-plugin row; the cascade catch
 *                   in `cascadeAutoupdates` stamps `outcome.cause` so the
 *                   renderer emits a 4-space-indent trailer below the row.
 *
 * `scope` is forwarded so the renderer's orphan-fold logic
 * (`renderScopeBracket(plugin.scope, mp.scope)`) can suppress the redundant
 * `[<scope>]` bracket when the plugin scope matches the marketplace scope.
 */
function outcomeToCascadePluginMessage(
  outcome: PluginUpdateOutcome,
  scope: Scope,
): PluginNotificationMessage {
  // PluginUpdateOutcome is a discriminated union; the switch exhausts all 4
  // partitions and ends with an `assertNever` so any future variant addition
  // fails at compile time.
  switch (outcome.partition) {
    case "updated":
      return {
        status: "updated",
        name: outcome.name,
        scope,
        from: outcome.fromVersion,
        to: outcome.toVersion,
        // CMC-13: declared kinds drive the per-row soft-dep marker
        // (MSG-SD-3). The renderer narrows on `dependencies` membership
        // ("agents" / "mcp") + the notify-time probe; we forward the boolean
        // flags as the conventional Dependency[] representation.
        dependencies: [
          ...(outcome.declaresAgents ? (["agents"] as const) : []),
          ...(outcome.declaresMcp ? (["mcp"] as const) : []),
        ],
      };
    case "unchanged":
      return {
        status: "skipped",
        name: outcome.name,
        scope,
        // The renderer routes `skipped` through warning severity ->
        // ICON_UNINSTALLABLE (⊘).
        reasons: ["up-to-date"],
      };
    case "skipped":
      return {
        status: "skipped",
        name: outcome.name,
        scope,
        reasons: [narrowSkipReason(outcome)],
      };
    case "failed":
      return {
        status: "failed",
        name: outcome.name,
        scope,
        reasons: [narrowFailReason(outcome)],
        // The per-plugin cause-chain trailer. `outcome.cause` is populated by
        // the cascadeAutoupdates catch where the raw thrown Error is in scope;
        // failed outcomes produced by plugin/update.ts (no err in scope) leave
        // this undefined and the renderer simply omits the trailer.
        ...(outcome.cause !== undefined && { cause: outcome.cause }),
      };
    default:
      // Exhaustiveness guard. A new partition added to PluginUpdateOutcome
      // without updating this switch fails at compile time on
      // `assertNever(outcome)`.
      return assertNever(outcome);
  }
}

/**
 * Narrow a `skipped` outcome to a closed-set Reason.
 *
 * Prefer the pre-narrowed `outcome.reasons[0]` (populated by
 * `plugin/update.ts` producers) over the substring parse of `outcome.notes`.
 * The notes-fallback is retained for test fixtures that build outcomes
 * without `reasons`; once every producer populates `reasons`, the fallback
 * can be deleted.
 */
function narrowSkipReason(outcome: PluginUpdateSkippedOutcome): ContentReason {
  const firstReason = outcome.reasons[0];
  if (firstReason !== undefined) {
    return firstReason;
  }

  // Fallback: substring parse of `notes`. Retained for backward
  // compatibility with notes-only outcome fixtures.
  //
  // WR-06: a `partition: "skipped"` outcome with no reasons AND no notes
  // is a producer-contract violation -- the previous code masked it as
  // `"up-to-date"` (a SUCCESS reason), so the operator read
  // `skipped {up-to-date}` and assumed nothing was wrong while in fact
  // the producer failed to populate its outcome. Map empty-notes to
  // `"unreadable manifest"` instead so the brace surfaces a real failure
  // classification rather than a false success claim (mirrors the
  // narrowFailReason symmetric fallback below).
  const notes = outcome.notes;
  if (notes.length === 0) {
    return "unreadable manifest";
  }

  const text = notes.join(" ").toLowerCase();
  if (text.includes("not in manifest") || text.includes("not found in marketplace")) {
    return "not in manifest";
  }

  if (text.includes("source mismatch")) {
    return "source mismatch";
  }

  if (text.includes("no longer installable")) {
    return "no longer installable";
  }

  // WR-06: no-substring-match -> SAME treatment as empty-notes; do not
  // mask the unknown-class skip as `"up-to-date"`.
  return "unreadable manifest";
}

/**
 * Narrow a `failed` outcome to a closed-set Reason.
 *
 * Prefer pre-narrowed `outcome.reasons[0]` over notes parsing (same rationale
 * as `narrowSkipReason` above). The fallback is `"unreadable manifest"`
 * because most update failures bubble up from manifest re-reads.
 */
function narrowFailReason(outcome: PluginUpdateFailedOutcome): ContentReason {
  const firstReason = outcome.reasons?.[0];
  if (firstReason !== undefined) {
    return firstReason;
  }

  // Fallback: substring parse of `notes`. Retained for backward
  // compatibility with notes-only outcome fixtures.
  const notes = outcome.notes;
  if (notes.length === 0) {
    return "unreadable manifest";
  }

  const text = notes.join(" ").toLowerCase();
  if (text.includes("not in manifest") || text.includes("not found in marketplace")) {
    return "not in manifest";
  }

  if (text.includes("rollback partial")) {
    return "rollback partial";
  }

  if (text.includes("invalid manifest") || text.includes("unparseable")) {
    return "invalid manifest";
  }

  if (text.includes("unreadable")) {
    return "unreadable manifest";
  }

  return "unreadable manifest";
}

async function refreshOneMarketplace(args: RefreshOneArgs): Promise<void> {
  const { ctx, name, scope, locations, pluginUpdate, pi } = args;

  let snapshot: RefreshSnapshot | undefined;
  try {
    snapshot = await snapshotAfterRefresh(args);
  } catch (err) {
    // A marketplace refresh failure renders as the header
    // `⊘ <name> [<scope>] (failed)`. The MarketplaceNotificationMessage
    // shape carries no `cause` (SNM-10 confines `cause` to plugin-level
    // variants), so surface the underlying MarketplaceUpdateError cause
    // (and its retry-hint, carried in the cause chain) via a synthetic
    // failed-plugin child whose `cause` drives the depth-5 cause-chain
    // trailer the renderer appends. Mirrors the reinstall synthetic-failed
    // recipe (orchestrators/plugin/reinstall.ts).
    const typedReasons = reasonsFromCascadeError(err);
    const failedRow: PluginFailedMessage = {
      status: "failed",
      name,
      reasons: typedReasons ?? (["network unreachable"] as const),
      cause: err instanceof Error ? err : new Error(errorMessage(err)),
    };
    notify(ctx, pi, {
      marketplaces: [{ name, scope, status: "failed", plugins: [failedRow] }],
    });
    return;
  }

  if (snapshot === undefined) {
    // TOCTOU concurrent-removal no-op: the marketplace was removed between the
    // pre-guard existence read and snapshotAfterRefresh's fresh guard load. The
    // pre-guard already emitted the standalone `{not added}` notification, so
    // return silently -- NO second contradictory notification, and crucially NO
    // lying `{network unreachable}` (the raw MarketplaceNotFoundError no longer
    // escapes; mirrors remove.ts).
    return;
  }

  // Post-state-commit completion-cache invalidation. Manifest refresh may
  // have changed the plugin set; drop the cached plugin index so the next
  // completion read rebuilds from the freshly updated marketplace.json.
  // Defense-in-depth try/catch.
  try {
    await dropMarketplaceCache(await locations.pluginCacheFile(name), scope, name);
  } catch {
    // Intentional non-surfacing (PU-4 / AS-6): this cleanup runs AFTER the
    // durable atomic state save, so a leak here cannot corrupt state. A
    // cache-refresh failure is deliberately NOT surfaced -- emitting a second
    // notify after the primary would double severity routing. The cache `rm`
    // still runs above; only the user-facing warning is suppressed.
  }

  // CASCADE OUTSIDE the outer guard. Honors MU-4 literal
  // "persisted before any plugin cascade runs".
  const outcomes = await cascadeAutoupdates(snapshot, name, scope, pluginUpdate);

  // CMC-32 / UXG-05 binding: BOTH the autoupdate-OFF (manifest-only refresh)
  // and the autoupdate-ON (cascade) paths now DISTINGUISH a no-op from a
  // genuine change via the change detector + the cascade outcomes:
  //   - no change: the validated manifest content is byte-identical pre/post
  //     (snapshot.changed === false) AND every cascaded plugin was a no-op
  //     (`partition === "unchanged"`) -> emit `(skipped) {up-to-date}` (catalog
  //     state `update-no-op-skipped` / `update-autoupdate-noop-skipped`).
  //     Routes WARNING via computeSeverity (mp.status === "skipped"); this is
  //     intentional -- the benign-skip -> info softening is UXG-02, NOT
  //     pre-empted here.
  //   - changed: the manifest content changed OR any plugin actually
  //     updated/installed/reinstalled/uninstalled/failed (i.e. NOT every
  //     outcome is `unchanged`) -> emit `(updated)` (catalog state
  //     `manifest-refresh-changed`, or the cascade-rows shape on the ON path).
  // The autoupdate-OFF payload has no plugin rows; the autoupdate-ON no-op
  // payload deliberately drops the all-`unchanged` cascade rows (plugins:[])
  // for byte-form consistency with the OFF no-op.
  // NEITHER no-op emits a reload-hint: `shouldEmitReloadHint` fires only on a
  // PLUGIN row with a state-changing status, never on a marketplace status, and
  // these payloads have no plugin rows (plugins:[]). UXG-05 is orthogonal to
  // the reload-hint discipline.
  if (!snapshot.autoupdate || pluginUpdate === undefined) {
    if (!snapshot.changed) {
      notify(ctx, pi, {
        marketplaces: [{ name, scope, status: "skipped", reasons: ["up-to-date"], plugins: [] }],
      });
      return;
    }

    notify(ctx, pi, {
      marketplaces: [{ name, scope, status: "updated", plugins: [] }],
    });
    return;
  }

  // Autoupdate-ON no-op gate: a true no-op requires BOTH
  // (A) the validated manifest content is unchanged (snapshot.changed === false)
  // AND (B) every cascaded plugin outcome is `unchanged`. `updated` / `skipped`
  // (e.g. a source-mismatch skip) / `failed` outcomes are NOT no-ops -- a
  // `failed` outcome keeps the existing `(updated)`-with-rows emission so the
  // per-plugin failed routing is preserved (a thrown refresh failure is already
  // handled upstream in `refreshOneMarketplace`'s catch and never reaches here).
  // When both hold, emit the SAME `(skipped) {up-to-date}` payload as the OFF
  // no-op (plugins:[] -> shouldEmitReloadHint stays false, warning severity).
  const cascadeIsNoOp = outcomes.every((o) => o.partition === "unchanged");
  if (!snapshot.changed && cascadeIsNoOp) {
    notify(ctx, pi, {
      marketplaces: [{ name, scope, status: "skipped", reasons: ["up-to-date"], plugins: [] }],
    });
    return;
  }

  // Cascade rows -- per-plugin PluginFailedMessage.cause /
  // PluginUpdatedMessage{from,to,dependencies} / PluginSkippedMessage.
  // notify owns: severity (any failed -> error; any skipped/manual recovery
  // -> warning; otherwise info), reload-hint (fires only when a plugin row
  // carries a status in {installed, updated, reinstalled, uninstalled} -- the
  // marketplace status never triggers it), and the per-row soft-dep marker
  // (single probe per notify call, threaded into every renderPluginRow).
  // Caller-supplied plugin order is honored verbatim.
  notify(ctx, pi, {
    marketplaces: [
      {
        name,
        scope,
        status: "updated",
        plugins: outcomes.map((o) => outcomeToCascadePluginMessage(o, scope)),
      },
    ],
  });
}

/**
 * MU-4 / MU-5: re-read and re-validate the marketplace.json at the
 * given root. Throws on read or validation failure -- the caller wraps
 * as `MarketplaceUpdateError`.
 *
 * WR-03: for path sources the caller already passes
 * `record.marketplaceRoot`, and for github sources
 * `cloneDir === record.marketplaceRoot` after `add`, so the
 * `record.manifestPath` / `record.marketplaceRoot` writes are gated on a
 * real change. This keeps the function's purpose (validate) clear and lets
 * a "did anything change?" optimization rely on identity.
 */
async function validateManifestAtRoot(
  record: ExtensionState["marketplaces"][string],
  marketplaceRoot: string,
): Promise<void> {
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await loadMarketplaceManifest(manifestPath);

  if (record.manifestPath !== manifestPath) {
    record.manifestPath = manifestPath;
  }

  if (record.marketplaceRoot !== marketplaceRoot) {
    record.marketplaceRoot = marketplaceRoot;
  }
}

/**
 * Test seam for the outcome -> plugin-message mapper. Tests verify the
 * `outcome.reasons` typed-Reason preference over the notes-parsing fallback
 * AND the discriminated-union construction (per-plugin cause + glyph flip on
 * `unchanged` -> `skipped {up-to-date}`).
 */
export { outcomeToCascadePluginMessage as __test_outcomeToCascadePluginMessage };

/**
 * Test seam for the TOCTOU concurrent-removal regression (CR-01). Verifies that
 * `snapshotAfterRefresh` returns `undefined` (instead of throwing a raw
 * MarketplaceNotFoundError) when the marketplace record is absent at the guard's
 * fresh `loadState` -- the silent-return that prevents `refreshOneMarketplace`'s
 * catch from misattributing the race as the lying `{network unreachable}`.
 */
export { snapshotAfterRefresh as __test_snapshotAfterRefresh };
