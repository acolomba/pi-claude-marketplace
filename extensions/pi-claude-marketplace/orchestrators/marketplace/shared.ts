// orchestrators/marketplace/shared.ts
//
// Cross-subcommand helpers (Phase 4 D-01 -- shared.ts cap ~300 LOC).
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
//     Phase 5 reuses this when it ships plugin uninstall -- preserve
//     the public signature.
//
//   - resolveScopeFromState (MR-1): cross-scope ambiguity funnel.
//     Throws MarketplaceNotFoundError or MarketplaceAmbiguousScopeError
//     (both already exported by shared/errors.ts via Plan 04-01).
//
//   - applyAutoupdateFlipInPlace (MAU-1..4): single helper used by
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
import { unstageMcpServers } from "../../bridges/mcp/index.ts";
import { unstagePluginSkills } from "../../bridges/skills/index.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import * as defaultGit from "../../platform/git.ts";
import { MarketplaceNotFoundError } from "../../shared/errors.ts";

import type { UnstageAgentFailure } from "../../bridges/agents/types.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { Scope } from "../../shared/types.ts";
import type { PluginUpdateOutcome } from "../types.ts";

/**
 * CR-06: AG-5 foreign-content failure carries the structured per-agent
 * `failed[]` from the agents bridge so downstream consumers (Phase 5
 * partial-success removal, diagnostics, tests) can read individual
 * failure reasons WITHOUT re-parsing the textual message. The message
 * formatting is preserved for the user-visible surface.
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
 * D-12, D-13: marketplace orchestrator git surface.
 *
 * Six primitives. The 5 base primitives (clone / fetch / forceUpdateRef
 * / checkout / resolveRef) cover the standard D-14 sequence. CR-01
 * added a 6th -- `currentBranch` -- because the D-14 default-branch
 * tracking path needs to distinguish "what is the symbolic name of the
 * local branch" from "what SHA does HEAD point at". `resolveRef('HEAD')`
 * returns a SHA; using that SHA as the `ref` to forceUpdateRef writes a
 * meaningless `refs/<40-hex>` -- the local branch never advances.
 *
 * No `pull` -- D-14 requires the three-step force-overwrite path
 * (fetch → forceUpdateRef → checkout) that `pull --ff-only` cannot
 * express because the local branch may diverge from the remote SHA.
 */
export interface GitOps {
  /** MA-5: clone url into dir, optional ref, single-branch when ref is set. */
  clone(opts: { dir: string; url: string; ref?: string; singleBranch?: boolean }): Promise<void>;
  /** D-14 step 1: refresh remote refs (no merge, no working-tree changes). */
  fetch(opts: { dir: string; remote?: string; ref?: string }): Promise<void>;
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
}

/**
 * D-13 default implementation. All five primitives delegate to
 * `platform/git.ts`, which is the only file that imports isomorphic-git.
 * No dynamic imports -- D-13's "no orchestrator-tier isomorphic-git
 * dependency" boundary is now enforced statically.
 */
export const DEFAULT_GIT_OPS: GitOps = {
  clone: defaultGit.clone,
  fetch: async (o): Promise<void> => {
    await defaultGit.fetch(o);
  },
  forceUpdateRef: defaultGit.forceUpdateRef,
  checkout: defaultGit.checkout,
  resolveRef: defaultGit.resolveRef,
  currentBranch: defaultGit.currentBranch,
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
 */
export async function refreshGitHubClone(
  cloneDir: string,
  storedRef: string | undefined,
  gitOps: GitOps,
  onFetchSucceeded?: () => void,
): Promise<void> {
  await gitOps.fetch({
    dir: cloneDir,
    remote: "origin",
    ...(storedRef !== undefined && { ref: storedRef }),
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
    // !withVersions case (typically the legacy unchanged-row form).
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
  /** True when all four bridges' unstage* calls returned cleanly. */
  readonly ok: boolean;
  /** Names actually removed across all four bridges. Empty when nothing was staged. */
  readonly dropped: {
    readonly skills: readonly string[];
    readonly commands: readonly string[];
    readonly agents: readonly string[];
    readonly mcpServers: readonly string[];
  };
  /** Set on failure: the FIRST throw, wrapped to Error if needed (D-03 fail-fast). */
  readonly cause?: Error;
}

/**
 * D-02: hand-rolled per-plugin cascade. PU-1 order (skills → commands →
 * agents → MCP). D-03 fail-fast: the FIRST bridge throw halts THIS
 * plugin and the plugin lands in failedPlugins[] in the caller; already
 * unstaged resources stay unstaged (bridges are idempotent). Phase 5's
 * plugin uninstall reuses this primitive -- preserve the signature.
 *
 * AG-5 foreign-content (Pitfall 8): the agents bridge does NOT throw
 * on foreign content -- it preserves the index row and reports via
 * `result.failed[]`. The cascade primitive opts into strict semantics
 * by throwing when failed.length > 0, so the per-plugin try/catch
 * lands the plugin in failedPlugins[].
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
      // error so downstream consumers (Phase 5 partial-success removal,
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
 * MAU-1..4 / RESEARCH Pattern 7: idempotent autoupdate-flip.
 * - When `name` is undefined, flip every marketplace in this scope's
 *   state (MAU-2 bare form).
 * - When `name` is given but missing, throw MarketplaceNotFoundError
 *   with an empty scope list -- the caller fills the scope detail.
 * - MAU-3: already-matching marketplaces report as "unchanged"; the
 *   caller composes the user-visible "Already enabled/disabled: ..."
 *   line.
 * - MAU-4: missing/undefined `record.autoupdate` is read as `false`
 *   via the `?? false` coalescing.
 *
 * WR-06: name suffix "InPlace" is deliberate -- the `state` parameter
 * is MUTATED in place (the caller is INSIDE a withStateGuard closure;
 * the guard saves on no-throw). Returning the result as a plain object
 * (no Object.freeze) makes that contract unambiguous: callers must not
 * conclude from a frozen return that the function is pure.
 */
export function applyAutoupdateFlipInPlace(
  state: ExtensionState,
  name: string | undefined,
  enable: boolean,
): AutoupdateFlipResult {
  const changed: string[] = [];
  const unchanged: string[] = [];

  if (name !== undefined) {
    const record = state.marketplaces[name];
    if (record === undefined) {
      throw new MarketplaceNotFoundError(name, []);
    }

    if ((record.autoupdate ?? false) === enable) {
      unchanged.push(name);
    } else {
      record.autoupdate = enable;
      changed.push(name);
    }

    return { changed, unchanged };
  }

  for (const [mp, record] of Object.entries(state.marketplaces)) {
    if ((record.autoupdate ?? false) === enable) {
      unchanged.push(mp);
    } else {
      record.autoupdate = enable;
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
 * Plan 06-04 D-02: structural loader for the LLM-tool surface. Walks
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
  // Iteration order is project-first per MSG-GR-3 / compareByNameThenScope
  // so same-name cross-scope stable-sort ties render project-before-user.
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
// `causeChainTrailer(err)` imported from `shared/errors.ts` (canonicalised
// there in Phase 21 from the retired `presentation/cause-chain.ts`).
