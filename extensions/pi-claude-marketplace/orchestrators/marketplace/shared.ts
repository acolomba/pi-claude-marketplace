// orchestrators/marketplace/shared.ts
//
// Cross-subcommand helpers (D-01 -- shared.ts cap ~300 LOC).
//
//   - GitOps interface + DEFAULT_GIT_OPS (D-12, D-13). Five primitives:
//     clone + fetch + forceUpdateRef + checkout + resolveRef.
//     NO `pull` -- D-14 follow-upstream-blindly semantics require the
//     three-step force-overwrite path that `pull --ff-only` cannot
//     express.
//
//   - cascadeUnstagePlugin (D-02, D-03): per-plugin hand-rolled
//     try/catch envelope that composes the 4 bridge unstage*
//     primitives in PU-1 order (skills → commands → agents → mcp).
//     Reused by plugin uninstall -- preserve the public signature.
//
//   - resolveScopeFromState (MR-1): cross-scope ambiguity funnel.
//     Throws MarketplaceNotFoundError or MarketplaceAmbiguousScopeError
//     (both exported by shared/errors.ts).
//
//   - classifyAutoupdateFlip (MAU-1..4): single helper used by
//     autoupdate.ts. Idempotent -- already-matching marketplaces land
//     in `unchanged[]`.
//
// Per D-02 ANTI-PATTERN: this file MUST NOT import from `transaction/`
// (no phase-ledger runner). The cascade is the wrong shape for ledger
// semantics (MR-3 requires continuation across plugin failures; the
// ledger runner halts on first throw). Code review enforces; ESLint
// does not.

import { unstagePluginAgents } from "../../bridges/agents/index.ts";
import { unstagePluginCommands } from "../../bridges/commands/index.ts";
import { removeHookConfig } from "../../bridges/hooks/index.ts";
import { unstageMcpServers } from "../../bridges/mcp/index.ts";
import { unstagePluginSkills } from "../../bridges/skills/index.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import * as defaultGit from "../../platform/git.ts";
import { MarketplaceNotFoundError } from "../../shared/errors.ts";
import { notify } from "../../shared/notify.ts";

import type { UnstageAgentFailure } from "../../bridges/agents/types.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { CredentialOps } from "../../platform/git-credential.ts";
import type { OnAuthRequiredFn } from "../../platform/git.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { Scope } from "../../shared/types.ts";
import type { PluginUpdateOutcome } from "../types.ts";

/**
 * CR-06: AG-5 foreign-content failure carries the structured per-agent
 * `failed[]` from the agents bridge so downstream consumers (partial-success
 * removal, diagnostics, tests) can read individual failure reasons WITHOUT
 * re-parsing the textual message. The message formatting is preserved for the
 * user-visible surface.
 */
export class AgentsUnstageFailureError extends Error {
  readonly failedAgents: readonly UnstageAgentFailure[];
  constructor(message: string, failedAgents: readonly UnstageAgentFailure[]) {
    super(message);
    this.name = "AgentsUnstageFailureError";
    this.failedAgents = failedAgents;
  }
}

/**
 * Optional auth bundle passed through GitOps.clone / GitOps.fetch and
 * refreshGitHubClone. Mirrors the shape accepted by platform/git.ts
 * `CloneOptions.auth?` / `FetchOptions.auth?`. When undefined, every call
 * site behaves identically to the public-only path.
 *
 * D-13 boundary: this re-exports only TYPES from the platform tier
 * (`CredentialOps`, `OnAuthRequiredFn`) -- no isomorphic-git symbol
 * crosses into the orchestrator tier.
 */
export interface GitAuthBundle {
  readonly credentialOps: CredentialOps;
  readonly host: string;
  readonly onAuthRequired: OnAuthRequiredFn;
}

/**
 * D-12, D-13: marketplace orchestrator git surface.
 *
 * Seven primitives. The 5 base primitives (clone / fetch / forceUpdateRef
 * / checkout / resolveRef) cover the standard D-14 sequence. CR-01
 * added a 6th -- `currentBranch` -- because the D-14 default-branch
 * tracking path needs to distinguish "what is the symbolic name of the
 * local branch" from "what SHA does HEAD point at". `resolveRef('HEAD')`
 * returns a SHA; using that SHA as the `ref` to forceUpdateRef writes a
 * meaningless `refs/<40-hex>` -- the local branch never advances.
 * D-77-05 added a 7th -- `resolveRemoteRef` -- so the plugin clone-cache
 * seam can pin an unpinned source's remote HEAD to a SHA without a full
 * clone at install time.
 *
 * No `pull` -- D-14 requires the three-step force-overwrite path
 * (fetch → forceUpdateRef → checkout) that `pull --ff-only` cannot
 * express because the local branch may diverge from the remote SHA.
 *
 * `clone` and `fetch` each accept an optional `auth` bundle. When
 * provided, `DEFAULT_GIT_OPS` forwards it to `platform/git.ts`, which
 * builds the isomorphic-git `onAuth`/`onAuthFailure` callbacks via
 * `buildAuthCallbacks`. When omitted, both primitives behave identically
 * to the public-only path (NFR-5 surfaces untouched).
 */
export interface GitOps {
  /** MA-5: clone url into dir, optional ref, single-branch when ref is set. */
  clone(opts: {
    dir: string;
    url: string;
    ref?: string;
    singleBranch?: boolean;
    auth?: GitAuthBundle;
  }): Promise<void>;
  /** D-14 step 1: refresh remote refs (no merge, no working-tree changes). */
  fetch(opts: { dir: string; remote?: string; ref?: string; auth?: GitAuthBundle }): Promise<void>;
  /** D-14 step 2 (symbolic HEAD): force-set local branch ref to remote SHA. */
  forceUpdateRef(opts: { dir: string; ref: string; value: string }): Promise<void>;
  /** D-14 step 3: move HEAD to ref/SHA. */
  checkout(opts: { dir: string; ref: string }): Promise<void>;
  /** Resolve a ref name to its SHA (used to read remote SHA after fetch). */
  resolveRef(opts: { dir: string; ref: string }): Promise<string>;
  /**
   * CR-01: return the symbolic name of the currently checked-out branch
   * (e.g. "main"), or undefined when HEAD is detached. Required by the
   * D-14 default-branch path so the caller can build
   * `refs/heads/<branch>` for forceUpdateRef.
   */
  currentBranch(opts: { dir: string }): Promise<string | undefined>;
  /**
   * D-77-05 / PURL-09: resolve a remote ref (or the default-branch HEAD) to
   * its full commit SHA WITHOUT a full clone. Used by the plugin clone-cache
   * seam to pin an unpinned source at install time. An optional `auth` bundle
   * threads through to `listServerRefs` so an unpinned PRIVATE-repo HEAD
   * resolution can authenticate (PROV-03); omitted = public-only.
   */
  resolveRemoteRef(opts: { url: string; ref?: string; auth?: GitAuthBundle }): Promise<string>;
}

/**
 * D-13 default implementation. All primitives delegate to
 * `platform/git.ts`, which is the only file that imports isomorphic-git.
 * No dynamic imports -- D-13's "no orchestrator-tier isomorphic-git
 * dependency" boundary is now enforced statically.
 */
export const DEFAULT_GIT_OPS: GitOps = {
  // The `auth?` field on GitOps.clone / .fetch is structurally compatible
  // with platform/git.ts CloneOptions.auth? / FetchOptions.auth?. No wrapper
  // code change is required -- the bound function references already accept
  // the widened opts shape.
  clone: defaultGit.clone,
  fetch: async (o): Promise<void> => {
    await defaultGit.fetch(o);
  },
  forceUpdateRef: defaultGit.forceUpdateRef,
  checkout: defaultGit.checkout,
  resolveRef: defaultGit.resolveRef,
  currentBranch: defaultGit.currentBranch,
  resolveRemoteRef: defaultGit.resolveRemoteRef,
};

/**
 * Recognize isomorphic-git's `NotFoundError` without importing the library
 * into the orchestrator tier (D-13). The class sets both `name` and `code`
 * to the string `"NotFoundError"` (see `node_modules/isomorphic-git`
 * `index.cjs` -- `NotFoundError.code = 'NotFoundError'` and
 * `this.code = this.name = NotFoundError.code`), and `Errors.NotFoundError`
 * is the documented surface used by `git.resolveRef` when a ref is absent.
 * Matching on the name keeps the boundary in `platform/git.ts` intact.
 */
function isGitNotFoundError(err: unknown): boolean {
  return err instanceof Error && err.name === "NotFoundError";
}

/**
 * D-14 follow-upstream-blindly sequence. Three forms:
 *   - storedRef === undefined (default-branch tracking):
 *       fetch + resolveRef('refs/remotes/origin/HEAD') + forceUpdateRef + checkout
 *   - storedRef is a branch on origin (symbolic HEAD):
 *       fetch + resolveRef('refs/remotes/origin/<ref>') + forceUpdateRef + checkout
 *   - storedRef is a tag/SHA (detached HEAD):
 *       fetch + checkout (resolveRef of refs/remotes/origin/<ref> fails, then
 *       checkout throws if the SHA no longer exists).
 *
 * The optional `auth` parameter is forwarded to `gitOps.fetch` so
 * private-repository refreshes can trigger Device Flow on a credential
 * miss. `gitOps.clone` is not called from here (`add.ts` is the only caller
 * of clone); the auth bundle therefore only flows into the fetch primitive
 * within this helper.
 */
export async function refreshGitHubClone(
  cloneDir: string,
  storedRef: string | undefined,
  gitOps: GitOps,
  onFetchSucceeded?: () => void,
  auth?: GitAuthBundle,
): Promise<void> {
  await gitOps.fetch({
    dir: cloneDir,
    remote: "origin",
    ...(storedRef !== undefined && { ref: storedRef }),
    ...(auth !== undefined && { auth }),
  });
  onFetchSucceeded?.();

  if (storedRef === undefined) {
    const remoteSha = await gitOps.resolveRef({
      dir: cloneDir,
      ref: "refs/remotes/origin/HEAD",
    });
    const localBranch = await gitOps.currentBranch({ dir: cloneDir });
    if (localBranch === undefined) {
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

  let remoteSha: string | undefined;
  try {
    remoteSha = await gitOps.resolveRef({
      dir: cloneDir,
      ref: `refs/remotes/origin/${storedRef}`,
    });
  } catch (err) {
    // isomorphic-git's `resolveRef` throws `NotFoundError` (with
    // `name === "NotFoundError"` and `code === "NotFoundError"`) when the
    // requested ref does not exist on the remote -- the documented case
    // where falling back to a detached-HEAD checkout of the stored ref is
    // the right behavior (D-14 third form). Every OTHER kind of throw
    // (corrupted git dir, EACCES on .git, EIO, OOM, programming bugs in
    // a `GitOps` stub) is a real failure: rethrow it so the caller
    // surfaces the actual cause instead of silently falling back to
    // stale local state. Name-check rather than `instanceof` keeps the
    // orchestrator tier free of a direct `isomorphic-git` import (D-13).
    if (isGitNotFoundError(err)) {
      remoteSha = undefined;
    } else {
      throw err;
    }
  }

  if (remoteSha === undefined) {
    await gitOps.checkout({ dir: cloneDir, ref: storedRef });
  } else {
    await gitOps.forceUpdateRef({
      dir: cloneDir,
      ref: `refs/heads/${storedRef}`,
      value: remoteSha,
    });
    await gitOps.checkout({ dir: cloneDir, ref: storedRef });
  }
}

export function renderPartition(
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
    // Narrow on the discriminated partition before reading partition-specific
    // fields. The renderer's `withVersions`
    // gate maps to the (updated)/(unchanged) partitions that carry
    // `fromVersion` + `toVersion`; the notes-bearing branch maps to
    // (skipped)/(failed). The bare-row fallback is the (updated) +
    // !withVersions case.
    if (withVersions && (o.partition === "updated" || o.partition === "unchanged")) {
      lines.push(`  - ${o.name} (${o.fromVersion} → ${o.toVersion})`);
      continue;
    }

    if ((o.partition === "skipped" || o.partition === "failed") && o.notes.length > 0) {
      lines.push(`  - ${o.name}: ${o.notes.join("; ")}`);
      continue;
    }

    lines.push(`  - ${o.name}`);
  }
}

/**
 * D-02, D-03: result of one plugin's cascade through the 4 bridges.
 * Discriminated implicitly by `ok` -- on success `cause` is absent;
 * on failure `cause` carries the FIRST throw (D-03 fail-fast). Names
 * already dropped before the throw are still reported in `dropped`
 * because the bridges are idempotent and their writes already
 * committed.
 */
export interface UnstageOutcome {
  /** True when all FIVE bridges' unstage* calls returned cleanly. */
  readonly ok: boolean;
  /**
   * Names actually removed across all five bridges. Empty when nothing was
   * staged. LIFE-01 / D-63-01: `hooks` lands between `agents` and
   * `mcpServers` (declaration order matches cascade order).
   */
  readonly dropped: {
    readonly skills: readonly string[];
    readonly commands: readonly string[];
    readonly agents: readonly string[];
    readonly hooks: readonly string[];
    readonly mcpServers: readonly string[];
  };
  /** Set on failure: the FIRST throw, wrapped to Error if needed (D-03 fail-fast). */
  readonly cause?: Error;
}

/**
 * D-02: hand-rolled per-plugin cascade. PU-1 order (skills → commands →
 * agents → MCP). D-03 fail-fast: the FIRST bridge throw halts THIS
 * plugin and the plugin lands in failedPlugins[] in the caller; already
 * unstaged resources stay unstaged (bridges are idempotent). Plugin
 * uninstall reuses this primitive -- preserve the signature.
 *
 * AG-5 foreign-content: the agents bridge does NOT throw on foreign
 * content -- it preserves the index row and reports via `result.failed[]`.
 * The cascade primitive opts into strict semantics by throwing when
 * failed.length > 0, so the per-plugin try/catch lands the plugin in
 * failedPlugins[].
 */
export async function cascadeUnstagePlugin(
  plugin: string,
  marketplace: string,
  locations: ScopedLocations,
  installedPlugin: ExtensionState["marketplaces"][string]["plugins"][string],
): Promise<UnstageOutcome> {
  const dropped = {
    skills: [] as string[],
    commands: [] as string[],
    agents: [] as string[],
    hooks: [] as string[],
    mcpServers: [] as string[],
  };

  try {
    const skillsResult = await unstagePluginSkills({
      locations,
      previousSkillNames: installedPlugin.resources.skills,
    });
    dropped.skills = [...skillsResult.removedNames];

    const cmdResult = await unstagePluginCommands({
      locations,
      previousCommandNames: installedPlugin.resources.prompts,
    });
    dropped.commands = [...cmdResult.removedNames];

    const agentsResult = await unstagePluginAgents({
      locations,
      marketplaceName: marketplace,
      pluginName: plugin,
    });
    dropped.agents = [...agentsResult.removedNames];

    if (agentsResult.failed.length > 0) {
      // AG-5 foreign content: index rows preserved by the bridge;
      // surface as plugin failure so MR-3 aggregation runs.
      //
      // CR-06: preserve the structured `failed[]` array on the thrown
      // error so downstream consumers (partial-success removal,
      // diagnostics, tests) can read per-agent reasons WITHOUT having
      // to re-parse the textual message. The textual message remains
      // the same so the existing user-visible surface is unchanged.
      const reasons = agentsResult.failed.map((f) => `${f.generatedName}: ${f.reason}`).join("; ");
      const err = new AgentsUnstageFailureError(
        `Failed to remove ${agentsResult.failed.length} agent(s): ${reasons}`,
        agentsResult.failed,
      );
      throw err;
    }

    // LIFE-01 / D-63-01: 5th cascade slot between the agents foreign-content
    // guard and mcp. removeHookConfig is idempotent (NFR-3) -- a plugin that
    // never staged hooks returns `{ removed: pluginName }` cleanly.
    const hooksResult = await removeHookConfig({ locations, pluginName: plugin });
    dropped.hooks = [hooksResult.removed];

    const mcpResult = await unstageMcpServers({
      locations,
      marketplaceName: marketplace,
      pluginName: plugin,
    });
    dropped.mcpServers = [...mcpResult.removedNames];

    return Object.freeze({
      ok: true,
      dropped: Object.freeze({
        skills: Object.freeze([...dropped.skills]),
        commands: Object.freeze([...dropped.commands]),
        agents: Object.freeze([...dropped.agents]),
        hooks: Object.freeze([...dropped.hooks]),
        mcpServers: Object.freeze([...dropped.mcpServers]),
      }),
    });
  } catch (err) {
    return Object.freeze({
      ok: false,
      dropped: Object.freeze({
        skills: Object.freeze([...dropped.skills]),
        commands: Object.freeze([...dropped.commands]),
        agents: Object.freeze([...dropped.agents]),
        hooks: Object.freeze([...dropped.hooks]),
        mcpServers: Object.freeze([...dropped.mcpServers]),
      }),
      cause: err instanceof Error ? err : new Error(String(err)),
    });
  }
}

/** MAU-1..4: idempotent autoupdate-flip outcome. */
export interface AutoupdateFlipResult {
  /** Marketplace names whose flag actually changed in this call. */
  readonly changed: readonly string[];
  /** Marketplace names whose flag already matched the requested value. */
  readonly unchanged: readonly string[];
}

/**
 * MAU-1..4: idempotent autoupdate-flip classification.
 * - When `name` is undefined, classify every marketplace in this scope's
 *   state (MAU-2 bare form).
 * - When `name` is given but missing, throw MarketplaceNotFoundError
 *   with an empty scope list -- the caller fills the scope detail.
 * - MAU-3: already-matching marketplaces report as "unchanged"; the
 *   caller composes the user-visible "Already enabled/disabled: ..."
 *   line.
 * - MAU-4: missing/undefined `record.autoupdate` is read as `false`
 *   via the `=== true` comparison.
 *
 * WR-05: CLASSIFY ONLY -- the legacy state-side
 * `autoupdate` field is READ (a state record pre-dating the D-13 scrub may
 * still carry it) but NEVER written. SPLIT-01 moved the truth into the
 * per-marketplace config entry; the config write-back is the real flip.
 * Writing the carved-out field back into state.json would re-introduce a
 * schema-stripped legacy field that the D-13 scrub removes again on the
 * next load -- pointless state churn the architecture gate at
 * tests/architecture/no-split-01-cast-reads.test.ts now forbids (the
 * assignment-form sibling pattern). The caller reclassifies this state-side
 * result against the CONFIG truth (`reclassifyByConfigTruth`) before any
 * write.
 */
export function classifyAutoupdateFlip(
  state: ExtensionState,
  name: string | undefined,
  enable: boolean,
): AutoupdateFlipResult {
  const changed: string[] = [];
  const unchanged: string[] = [];

  // D-04: undefined === false. Read through `Record<string, unknown>` cast
  // (legacy field; not on MARKETPLACE_RECORD_SCHEMA since SPLIT-01).
  if (name !== undefined) {
    const record = state.marketplaces[name];
    if (record === undefined) {
      throw new MarketplaceNotFoundError(name, []);
    }

    const legacy = record as unknown as Record<string, unknown>;
    if ((legacy.autoupdate === true) === enable) {
      unchanged.push(name);
    } else {
      changed.push(name);
    }

    return { changed, unchanged };
  }

  for (const [mp, record] of Object.entries(state.marketplaces)) {
    const legacy = record as unknown as Record<string, unknown>;
    if ((legacy.autoupdate === true) === enable) {
      unchanged.push(mp);
    } else {
      changed.push(mp);
    }
  }

  return { changed, unchanged };
}

/**
 * MR-1 cross-scope resolution. Without --scope, search both scopes;
 * project-scope takes precedence when found in both (CMP-5 applied to
 * marketplace operations for consistent unqualified-command behavior).
 * Throws `MarketplaceNotFoundError` when absent from both scopes.
 * Used by `remove.ts` and `update.ts` when --scope is omitted.
 *
 * D-04 boundary: this helper performs READ-ONLY state loads. The
 * caller's withStateGuard wraps the state mutation that follows; an
 * additional fresh load happens inside that guard.
 */
export async function resolveScopeFromState(
  mpName: string,
  userLocations: ScopedLocations,
  projectLocations: ScopedLocations,
): Promise<{ scope: Scope; locations: ScopedLocations }> {
  const [userState, projectState] = await Promise.all([
    loadState(userLocations.extensionRoot),
    loadState(projectLocations.extensionRoot),
  ]);

  if (mpName in projectState.marketplaces) {
    return { scope: "project", locations: projectLocations };
  }

  if (mpName in userState.marketplaces) {
    return { scope: "user", locations: userLocations };
  }

  throw new MarketplaceNotFoundError(mpName, ["project", "user"]);
}

/**
 * ATTR-06 / D-48-C Shape 1: resolve the target scope and enforce the
 * missing-marketplace precondition BEFORE the caller enters its state guard
 * (`removeMarketplace`'s withStateGuard / `updateMarketplace`'s
 * snapshotAfterRefresh). Shared by remove.ts and update.ts.
 *
 * Returns the resolved `{ scope, locations }` when the marketplace record
 * exists in the target scope. Returns `undefined` when the marketplace is
 * absent -- in which case it has ALREADY emitted the standalone
 * MarketplaceNotAddedMessage `(failed) {not added}` variant (SC#1 cross-op
 * convergence), so the caller must return without entering the guard (no raw
 * MarketplaceNotFoundError escapes past the orchestrator boundary, state
 * untouched). NFR-5: every read here is a network-free `loadState`.
 *
 * Bracket discipline: the bare form absent from BOTH scopes emits NO scope
 * bracket (resolveScopeFromState's MarketplaceNotFoundError is caught here, NOT
 * re-thrown; its throw contract is unmodified). The explicit-scope miss emits
 * the requested scope bracket (SCOPE-01). A non-MarketplaceNotFoundError from
 * resolveScopeFromState is re-thrown -- genuine clone/manifest/lock failures
 * arise later inside the caller's refresh path and keep their `(failed)`
 * cascade.
 *
 * Takes the structural subset of the caller opts ({ ctx, pi, name, scope? })
 * so both UpdateMarketplaceOptions and RemoveMarketplaceOptions satisfy it.
 */
export async function resolveScopeOrNotifyNotAdded(
  opts: { ctx: ExtensionContext; pi: ExtensionAPI; name: string; scope?: Scope },
  userLocations: ScopedLocations,
  projectLocations: ScopedLocations,
): Promise<{ scope: Scope; locations: ScopedLocations } | undefined> {
  // Bare form: resolveScopeFromState proves existence across both scopes.
  if (opts.scope === undefined) {
    try {
      return await resolveScopeFromState(opts.name, userLocations, projectLocations);
    } catch (err) {
      if (err instanceof MarketplaceNotFoundError) {
        notify(opts.ctx, opts.pi, { kind: "marketplace-not-added", name: opts.name });
        return undefined;
      }

      throw err;
    }
  }

  // Explicit scope: a single pre-guard loadState read blocks the miss BEFORE it
  // reaches the caller's state guard (which would otherwise throw
  // MarketplaceNotFoundError(name, [scope]) raw past the orchestrator).
  const locations = opts.scope === "user" ? userLocations : projectLocations;
  const preState = await loadState(locations.extensionRoot);
  if (preState.marketplaces[opts.name] === undefined) {
    notify(opts.ctx, opts.pi, {
      kind: "marketplace-not-added",
      name: opts.name,
      scope: opts.scope,
    });
    return undefined;
  }

  return { scope: opts.scope, locations };
}

/**
 * D-02: structural loader for the LLM-tool surface. Walks
 * loadState across the requested scope set (or both scopes when undefined)
 * and returns a flat array of {scope, record} tuples. Read-only: no
 * notifications, no mutation. Used by `edge/handlers/tools.ts` to feed
 * `pi_claude_marketplace_list` and `pi_claude_marketplace_plugin_list` without
 * crossing the edge -> persistence import boundary (BLOCK C).
 *
 * Returned `record` is the persistence-tier MarketplaceRecord verbatim.
 * Callers project the fields they need (name, source, plugins map, etc.).
 */
export async function loadVisibleMarketplaces(opts: {
  readonly cwd: string;
  /** When undefined, enumerate BOTH scopes (SC-6). */
  readonly scope?: Scope;
}): Promise<readonly { scope: Scope; record: ExtensionState["marketplaces"][string] }[]> {
  // Iteration order is project-first per MSG-GR-3 so same-name cross-scope
  // stable-sort ties render project-before-user.
  const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];
  const out: { scope: Scope; record: ExtensionState["marketplaces"][string] }[] = [];
  for (const scope of scopes) {
    const locations = locationsFor(scope, opts.cwd);
    const state = await loadState(locations.extensionRoot);
    for (const record of Object.values(state.marketplaces)) {
      out.push({ scope, record });
    }
  }

  return out;
}

// The depth-5 cause-chain walker lives at `shared/errors.ts::causeChainTrailer`
// and renders as `cause: <l1> -> <l2> -> ... [(truncated)]`. Callers pass
// failure facts to `notify()`; the renderer composes the trailer internally.
// Callers that need the trailer outside the notify path compose it inline via
// `causeChainTrailer(err)` imported from `shared/errors.ts`.
