// orchestrators/marketplace/update.ts
//
// MU-1, MU-4, MU-5, MU-6, MU-7, MU-8, MU-9 + RH-1/RH-2/RH-5 + SC-6 + NFR-5.
//
// MU-2 and MU-3 are SUPERSEDED by Phase 4 D-14 ("follow upstream
// blindly" -- the local marketplace clone is read-only by contract;
// V1's pull --ff-only choreography and non-fast-forward divergence
// detection no longer apply). The supersession is recorded in
// REQUIREMENTS.md and PROJECT.md by Plan 04-10.
//
// Flow:
//   1. Resolve scope(s):
//      - opts.name === undefined → bare form (MU-1, SC-6)
//      - opts.name + opts.scope === undefined → resolveScopeFromState
//      - opts.name + opts.scope set → use it directly
//
//   2. For each (scope, marketplaceName) pair:
//      a. OUTER GUARD (D-04 + D-08 -- wraps refresh + persist, NOT cascade):
//           withStateGuard(locations, async (state) => {
//             record = state.marketplaces[name]
//             if (record.source.kind === "github"):
//               cloneAdvanced = false
//               try {
//                 refreshGitHubClone(cloneDir, record.source.ref, gitOps,
//                                    () => { cloneAdvanced = true; });
//                 // CR-05 / MU-5: the onFetchSucceeded callback flips
//                 // cloneAdvanced to true ONLY after gitOps.fetch returns.
//                 // Pre-fetch throws (DNS/network/auth) leave cloneAdvanced
//                 // at false so the "Retry the command." hint is suppressed.
//                 // Any later D-14 step throw (forceUpdateRef/checkout) or
//                 // manifest re-read throw still produces the retry hint.
//                 manifest = read+validate <marketplaceRoot>/.claude-plugin/marketplace.json
//                 record.lastUpdatedAt = now
//               } catch (err) {
//                 throw new MarketplaceUpdateError(..., { cause, retryHint: cloneAdvanced ? "Retry the command." : "" })
//               }
//             else if path:
//               refreshPathManifest(record)  // NO gitOps; NFR-5
//             // capture snapshot for cascade-outside-guard:
//             snapshot = { autoupdate: record.autoupdate ?? false, plugins: Object.keys(record.plugins) }
//             return snapshot
//           })
//
//      b. CASCADE OUTSIDE GUARD (D-08 honors MU-4 literal "persisted before cascade"):
//           if (snapshot.autoupdate === true && pluginUpdate is provided):
//             for each plugin in snapshot.plugins:
//               outcome = await pluginUpdate(plugin, name, scope);
//               partition[outcome.partition].push(outcome)
//           // MU-7: render in order updated → unchanged → skipped → failed
//
//   3. Compose user-visible output:
//      - failures (entire-marketplace error): notifyError with chained cause + (if MU-5) retry hint
//      - success: notifySuccess body + RH-5 soft-dep warnings + RH-1/RH-2 reload hint (verb 'refresh')
//
// D-14 sequence (Pattern 3, RESEARCH §3): fetch + (symbolic HEAD)
// forceUpdateRef + checkout, OR (detached HEAD) checkout directly.
// NO `pull` (D-13).
//
// API parameter shape note: `pi.getAllTools()` lives on `ExtensionAPI`
// (the factory `pi` parameter), NOT on `ExtensionContext`. The
// soft-dep warning composers (Plan 04-03) take `pi: ExtensionAPI`. The
// orchestrator therefore accepts an OPTIONAL `pi: ExtensionAPI` field
// in its options bag; when omitted (e.g. tests that don't exercise
// soft-dep composition), the warning composers are simply not called.
// Phase 7's index.ts wiring supplies the real `pi` reference at
// command-registration time. (Rule 3 deviation from PLAN.md snippet
// which mistakenly wrote `subagentWarningIfNeeded(ctx, ...)`.)

import { readFile } from "node:fs/promises";
import path from "node:path";

import { MARKETPLACE_VALIDATOR } from "../../domain/manifest.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";
import { mcpAdapterWarningIfNeeded, subagentWarningIfNeeded } from "../../presentation/soft-dep.ts";
import { MarketplaceNotFoundError, MarketplaceUpdateError } from "../../shared/errors.ts";
import { notifyError, notifySuccess } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";

import {
  DEFAULT_GIT_OPS,
  formatErrorWithCauses,
  resolveScopeFromState,
  type GitOps,
} from "./shared.ts";

import type { ParsedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { Scope } from "../../shared/types.ts";
import type { PluginUpdateFn, PluginUpdateOutcome } from "../types.ts";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

export interface UpdateMarketplaceOptions {
  readonly ctx: ExtensionContext;
  /** Single marketplace by name. Required for `updateMarketplace`; rejected by `updateAllMarketplaces` (which derives the list from state). */
  readonly name: string;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly gitOps?: GitOps;
  /**
   * D-05 injection seam. When omitted, autoupdate cascade is a NO-OP
   * (Phase 4 ships marketplace update without Phase 5 wiring; tests
   * inject a mock).
   */
  readonly pluginUpdate?: PluginUpdateFn;
  /**
   * Soft-dep probe target. `pi.getAllTools()` is the source of truth
   * for whether `pi-subagents` / `pi-mcp-adapter` are loaded. Optional
   * because tests that don't care about RH-5 can omit it.
   */
  readonly pi?: ExtensionAPI;
}

export interface UpdateAllMarketplacesOptions {
  readonly ctx: ExtensionContext;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly gitOps?: GitOps;
  readonly pluginUpdate?: PluginUpdateFn;
  readonly pi?: ExtensionAPI;
}

/** MU-1 single-name form. */
export async function updateMarketplace(opts: UpdateMarketplaceOptions): Promise<void> {
  const gitOps = opts.gitOps ?? DEFAULT_GIT_OPS;
  const userLocations = locationsFor("user", opts.cwd);
  const projectLocations = locationsFor("project", opts.cwd);
  const resolved =
    opts.scope !== undefined
      ? {
          scope: opts.scope,
          locations: opts.scope === "user" ? userLocations : projectLocations,
        }
      : await resolveScopeFromState(opts.name, userLocations, projectLocations);

  await refreshOneMarketplace({
    ctx: opts.ctx,
    name: opts.name,
    scope: resolved.scope,
    locations: resolved.locations,
    gitOps,
    ...(opts.pluginUpdate !== undefined && { pluginUpdate: opts.pluginUpdate }),
    ...(opts.pi !== undefined && { pi: opts.pi }),
  });
}

/**
 * MU-1 bare form (no name): refresh every marketplace in target scope(s).
 * SC-6 enumerates both scopes when --scope omitted.
 */
export async function updateAllMarketplaces(opts: UpdateAllMarketplacesOptions): Promise<void> {
  const gitOps = opts.gitOps ?? DEFAULT_GIT_OPS;
  const scopes: readonly Scope[] = opts.scope !== undefined ? [opts.scope] : ["user", "project"];

  // Collect (scope, marketplaceName) pairs from a single fresh state read per scope.
  const targets: { scope: Scope; locations: ScopedLocations; name: string }[] = [];
  for (const scope of scopes) {
    const locations = locationsFor(scope, opts.cwd);
    const state = await loadState(locations.extensionRoot);
    for (const name of Object.keys(state.marketplaces)) {
      targets.push({ scope, locations, name });
    }
  }

  // MU-1 empty-set succeeds silently with the marker string + NO reload hint.
  if (targets.length === 0) {
    notifySuccess(opts.ctx, "No marketplaces configured.");
    return;
  }

  // Process sequentially per CONTEXT.md (parallel refresh is a deferred perf optimization).
  for (const t of targets) {
    await refreshOneMarketplace({
      ctx: opts.ctx,
      name: t.name,
      scope: t.scope,
      locations: t.locations,
      gitOps,
      ...(opts.pluginUpdate !== undefined && { pluginUpdate: opts.pluginUpdate }),
      ...(opts.pi !== undefined && { pi: opts.pi }),
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
  readonly pi?: ExtensionAPI;
}

async function refreshOneMarketplace(args: RefreshOneArgs): Promise<void> {
  const { ctx, name, scope, locations, gitOps, pluginUpdate, pi } = args;

  let snapshot: { autoupdate: boolean; plugins: readonly string[] };
  try {
    snapshot = await withStateGuard(locations, async (state) => {
      const record = state.marketplaces[name];
      if (record === undefined) {
        throw new MarketplaceNotFoundError(name, [scope]);
      }

      // Schema stores `source` as Type.Unknown(); state-io's load funnel
      // guarantees it has the discriminated `kind` field of ParsedSource.
      const source = record.source as ParsedSource;
      let cloneAdvanced = false;
      try {
        if (source.kind === "github") {
          const cloneDir = await locations.sourceCloneDir(name);
          // MU-5 ordering (CR-05): cloneAdvanced is flipped to true ONLY
          // after `gitOps.fetch` returns successfully. A pre-fetch
          // failure (DNS, network unreachable, auth) is unrecoverable
          // from the user's perspective, so the "Retry the command."
          // hint would be misleading. refreshGitHubClone fires the
          // onFetchSucceeded callback the instant fetch returns, so any
          // later D-14 step throw (forceUpdateRef / checkout) still
          // produces the retry hint.
          await refreshGitHubClone(cloneDir, source.ref, gitOps, () => {
            cloneAdvanced = true;
          });
          await refreshManifestPointer(record, cloneDir);
        } else if (source.kind === "path") {
          // NFR-5: NO gitOps. Re-read + re-validate manifest at the
          // existing on-disk location.
          await refreshManifestPointer(record, record.marketplaceRoot);
        } else {
          throw new Error(
            `Cannot update marketplace "${name}": unsupported source kind "${source.kind}"`,
          );
        }

        record.lastUpdatedAt = new Date().toISOString();
      } catch (err) {
        // MU-5: clone advanced but manifest save failed → retry hint.
        // For path source or pre-clone failures, retry hint is "".
        //
        // ESLint cannot follow the control flow from the
        // onFetchSucceeded callback (passed to refreshGitHubClone) back
        // to this scope -- it concludes cloneAdvanced is "always
        // falsy". Disable the narrowing check here.
        throw new MarketplaceUpdateError(
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- cloneAdvanced is set via callback inside refreshGitHubClone (CR-05).
          cloneAdvanced
            ? `Marketplace "${name}" clone advanced but manifest could not be persisted.`
            : `Failed to update marketplace "${name}".`,
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- cloneAdvanced is set via callback inside refreshGitHubClone (CR-05).
          { cause: err, retryHint: cloneAdvanced ? "Retry the command." : "" },
        );
      }

      return {
        autoupdate: record.autoupdate ?? false,
        plugins: Object.keys(record.plugins),
      };
    });
  } catch (err) {
    // MU-5 + ES-4: surface MarketplaceUpdateError or any other failure
    // via notifyError with chained cause. The retryHint is appended
    // when present.
    if (err instanceof MarketplaceUpdateError && err.retryHint !== "") {
      notifyError(ctx, `${formatErrorWithCauses(err)}\n${err.retryHint}`, err.cause);
    } else {
      notifyError(ctx, formatErrorWithCauses(err), err);
    }

    return;
  }

  // CASCADE OUTSIDE the outer guard (D-08). Honors MU-4 literal
  // "persisted before any plugin cascade runs".
  const partitions: Record<PluginUpdateOutcome["partition"], PluginUpdateOutcome[]> = {
    updated: [],
    unchanged: [],
    skipped: [],
    failed: [],
  };
  if (snapshot.autoupdate && pluginUpdate !== undefined) {
    // MU-8: enumerate snapshot.plugins (state-driven, NOT manifest-driven).
    for (const plugin of snapshot.plugins) {
      let outcome: PluginUpdateOutcome;
      try {
        outcome = await pluginUpdate(plugin, name, scope);
      } catch (err) {
        // ES-4 / CR-03: walk Error.cause via formatErrorWithCauses so a
        // chained Error (the entire purpose of the chained-error contract)
        // does not have its tail truncated when it reaches the MU-7
        // "Failed:" partition. errorMessage() returns only .message.
        outcome = {
          partition: "failed",
          name: plugin,
          notes: [formatErrorWithCauses(err)],
        };
      }

      partitions[outcome.partition].push(outcome);
    }
  }

  // SUCCESS path composition:
  // - Body lists per-partition results in MU-7 order: updated → unchanged → skipped → failed
  // - RH-5 soft-dep warnings BEFORE the trailing reload hint
  // - RH-1 / RH-2: reload hint with verb 'refresh' iff updated[].length > 0
  const updatedNames = partitions.updated.map((o) => o.name).sort((a, b) => a.localeCompare(b));
  const baseLines: string[] = [`Updated marketplace "${name}" in ${scope} scope.`];
  if (snapshot.autoupdate && pluginUpdate !== undefined) {
    // MU-7 partition rendering. Empty partitions are omitted.
    renderPartition(baseLines, "Updated", partitions.updated, /*withVersions*/ true);
    renderPartition(baseLines, "Unchanged", partitions.unchanged, false);
    renderPartition(baseLines, "Skipped", partitions.skipped, false);
    renderPartition(baseLines, "Failed", partitions.failed, false);
  }

  let body = baseLines.join("\n");

  // RH-5 (per-marketplace; we don't yet know what was staged across the
  // cascade -- best-effort using the updated[] notes' kind hints if the
  // PluginUpdateFn surfaced them. Phase 4 conservatively treats both
  // soft-dep slots as "may need warning" iff any updated[] entries
  // exist). When `pi` is not supplied (legacy callers / minimal tests),
  // we skip the soft-dep composition entirely -- the helpers require an
  // ExtensionAPI reference.
  if (pi !== undefined) {
    const dummyAgentsHint = updatedNames.length > 0 ? ["plugin"] : [];
    const dummyMcpHint = updatedNames.length > 0 ? ["plugin"] : [];
    const subagentWarn = subagentWarningIfNeeded(pi, dummyAgentsHint);
    const mcpWarn = mcpAdapterWarningIfNeeded(pi, dummyMcpHint);
    if (subagentWarn !== "") {
      body = `${body}\n${subagentWarn}`;
    }

    if (mcpWarn !== "") {
      body = `${body}\n${mcpWarn}`;
    }
  }

  const hint = reloadHint("refresh", updatedNames);
  notifySuccess(ctx, appendReloadHint(body, hint));
}

function renderPartition(
  lines: string[],
  label: string,
  outcomes: readonly PluginUpdateOutcome[],
  withVersions: boolean,
): void {
  if (outcomes.length === 0) {
    return;
  }

  lines.push(`${label}:`);
  for (const o of [...outcomes].sort((a, b) => a.name.localeCompare(b.name))) {
    if (withVersions && o.fromVersion !== undefined && o.toVersion !== undefined) {
      lines.push(`  - ${o.name} (${o.fromVersion} → ${o.toVersion})`);
    } else if (o.notes !== undefined && o.notes.length > 0) {
      lines.push(`  - ${o.name}: ${o.notes.join("; ")}`);
    } else {
      lines.push(`  - ${o.name}`);
    }
  }
}

/**
 * D-14 follow-upstream-blindly sequence. Three forms:
 *   - storedRef === undefined (default-branch tracking):
 *       fetch + resolveRef('refs/remotes/origin/HEAD') + forceUpdateRef + checkout
 *   - storedRef is a branch on origin (symbolic HEAD):
 *       fetch + resolveRef('refs/remotes/origin/<ref>') + forceUpdateRef + checkout
 *   - storedRef is a tag/SHA (detached HEAD):
 *       fetch + checkout (resolveRef of refs/remotes/origin/<ref> fails →
 *       fall through to detached path; if SHA no longer exists,
 *       checkout throws -- caller wraps as MarketplaceUpdateError).
 */
async function refreshGitHubClone(
  cloneDir: string,
  storedRef: string | undefined,
  gitOps: GitOps,
  onFetchSucceeded?: () => void,
): Promise<void> {
  // Step 1: fetch (no merge, no working-tree changes -- just refresh remote refs).
  await gitOps.fetch({
    dir: cloneDir,
    remote: "origin",
    ...(storedRef !== undefined && { ref: storedRef }),
  });
  // CR-05: fetch returned cleanly -- signal "clone advanced" to the
  // caller so any later D-14 step that throws produces the MU-5
  // "Retry the command." hint. Pre-fetch throws skip this callback.
  onFetchSucceeded?.();

  if (storedRef === undefined) {
    // Default-branch tracking. Read remote HEAD's SHA and the symbolic
    // name of the local branch (e.g. "main"), then force-update
    // refs/heads/<branch> to that SHA and check out the branch by name.
    //
    // CR-01: previously, this path called resolveRef("HEAD") which
    // returns a SHA, then passed that SHA as the `ref` to
    // forceUpdateRef -- writing a meaningless `refs/<40-hex>` and
    // leaving the local branch unchanged. The fix routes through the
    // `currentBranch` primitive (returns the symbolic name or undefined
    // for detached HEAD). On detached HEAD the SHA is checked out
    // directly without writing any local ref.
    const remoteSha = await gitOps.resolveRef({
      dir: cloneDir,
      ref: "refs/remotes/origin/HEAD",
    });
    const localBranch = await gitOps.currentBranch({ dir: cloneDir });
    if (localBranch === undefined) {
      // Detached HEAD in the local clone -- just check out the remote
      // SHA directly. No local branch ref to advance.
      await gitOps.checkout({ dir: cloneDir, ref: remoteSha });
      return;
    }

    await gitOps.forceUpdateRef({
      dir: cloneDir,
      ref: `refs/heads/${localBranch}`,
      value: remoteSha,
    });
    await gitOps.checkout({ dir: cloneDir, ref: localBranch });
    return;
  }

  // Probe whether storedRef is a branch on origin.
  let remoteSha: string | undefined;
  try {
    remoteSha = await gitOps.resolveRef({
      dir: cloneDir,
      ref: `refs/remotes/origin/${storedRef}`,
    });
  } catch {
    remoteSha = undefined;
  }

  if (remoteSha !== undefined) {
    // Symbolic HEAD path.
    await gitOps.forceUpdateRef({
      dir: cloneDir,
      ref: `refs/heads/${storedRef}`,
      value: remoteSha,
    });
    await gitOps.checkout({ dir: cloneDir, ref: storedRef });
  } else {
    // Detached HEAD path. If the SHA/tag no longer exists, checkout
    // throws -- caller wraps as MarketplaceUpdateError.
    await gitOps.checkout({ dir: cloneDir, ref: storedRef });
  }
}

/**
 * MU-4 / MU-5: re-read and re-validate the marketplace.json from the
 * given root. Mutates `record.manifestPath` and `record.marketplaceRoot`
 * to the canonical post-refresh values. Throws on read or validation
 * failure -- the caller wraps as `MarketplaceUpdateError`.
 */
async function refreshManifestPointer(
  record: ExtensionState["marketplaces"][string],
  marketplaceRoot: string,
): Promise<void> {
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  const text = await readFile(manifestPath, "utf8");
  const parsed: unknown = JSON.parse(text);
  if (!MARKETPLACE_VALIDATOR.Check(parsed)) {
    throw new Error(`Refreshed marketplace manifest at ${manifestPath} failed schema validation`);
  }

  record.manifestPath = manifestPath;
  record.marketplaceRoot = marketplaceRoot;
}
