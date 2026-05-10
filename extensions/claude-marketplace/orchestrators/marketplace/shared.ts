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
//   - applyAutoupdateFlip (MAU-1..4): single helper used by
//     autoupdate.ts. Idempotent -- already-matching marketplaces land
//     in `unchanged[]`.
//
//   - formatErrorWithCauses (ES-4 / Pitfall 10): depth-5 Error.cause
//     walker. Local to Phase 4; Phase 6 may promote to shared/errors.ts
//     without changing this file's public signature.
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
import { loadState } from "../../persistence/state-io.ts";
import * as defaultGit from "../../platform/git.ts";
import { MarketplaceAmbiguousScopeError, MarketplaceNotFoundError } from "../../shared/errors.ts";

import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * D-12, D-13: marketplace orchestrator git surface. EXACTLY 5 primitives.
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
}

/**
 * D-13 default implementation. Four primitives wrap `platform/git.ts`
 * verbatim; `forceUpdateRef` uses isomorphic-git's `writeRef({force:true})`
 * directly because `platform/git.ts` does not expose a force-ref-update
 * wrapper. Dynamic import keeps the platform layer authoritative -- this
 * file is the only orchestrator-tier site that touches isomorphic-git
 * directly, and it does so for D-14 only.
 *
 * Source: node_modules/isomorphic-git/index.d.ts:695
 *   writeRef({ fs, dir, ref, value, force, symbolic? })
 */
export const DEFAULT_GIT_OPS: GitOps = {
  clone: defaultGit.clone,
  fetch: async (o): Promise<void> => {
    await defaultGit.fetch(o);
  },
  forceUpdateRef: async ({ dir, ref, value }): Promise<void> => {
    const git = await import("isomorphic-git");
    const fs = await import("node:fs");
    await git.writeRef({ fs: fs.default, dir, ref, value, force: true });
  },
  checkout: defaultGit.checkout,
  resolveRef: defaultGit.resolveRef,
};

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
      const reasons = agentsResult.failed.map((f) => `${f.generatedName}: ${f.reason}`).join("; ");
      throw new Error(`Failed to remove ${agentsResult.failed.length} agent(s): ${reasons}`);
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
 * The `state` parameter is mutated in place (the caller is INSIDE
 * a withStateGuard closure; the guard saves on no-throw).
 */
export function applyAutoupdateFlip(
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

    return Object.freeze({
      changed: Object.freeze(changed),
      unchanged: Object.freeze(unchanged),
    });
  }

  for (const [mp, record] of Object.entries(state.marketplaces)) {
    if ((record.autoupdate ?? false) === enable) {
      unchanged.push(mp);
    } else {
      record.autoupdate = enable;
      changed.push(mp);
    }
  }

  return Object.freeze({
    changed: Object.freeze(changed),
    unchanged: Object.freeze(unchanged),
  });
}

/**
 * MR-1 cross-scope resolution. Without --scope, search both scopes;
 * throw on dual-found (`MarketplaceAmbiguousScopeError`) or not-found
 * (`MarketplaceNotFoundError`). Used by `remove.ts` and `update.ts`
 * when --scope is omitted.
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
  const inUser = mpName in userState.marketplaces;
  const inProject = mpName in projectState.marketplaces;
  if (inUser && inProject) {
    throw new MarketplaceAmbiguousScopeError(mpName);
  }

  if (inUser) {
    return { scope: "user", locations: userLocations };
  }

  if (inProject) {
    return { scope: "project", locations: projectLocations };
  }

  throw new MarketplaceNotFoundError(mpName, ["user", "project"]);
}

/**
 * ES-4 / Pitfall 10: walk Error.cause up to depth 5 and join the
 * messages with ` -- caused by: `. Phase 4-local; Phase 6 may
 * promote to shared/errors.ts without changing this signature.
 *
 * The depth bound prevents pathological cycles (an Error whose
 * cause is itself or forms a loop). 5 levels matches V1's
 * reference (marketplace/update.ts::formatErrorWithCauses).
 */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types -- explicit `: number = 5` matches the plan's grep-gate done criterion (Plan 04-02 Task 2).
export function formatErrorWithCauses(err: unknown, maxDepth: number = 5): string {
  const parts: string[] = [];
  let current: unknown = err;
  for (let depth = 0; depth < maxDepth && current !== undefined; depth++) {
    // Rule 1 deviation from verbatim: `String(current)` violates @typescript-eslint/no-base-to-string
    // on unknown-with-toString. Equivalent semantics via instanceof / typeof / Object.prototype.toString.
    const message =
      current instanceof Error
        ? current.message
        : typeof current === "string"
          ? current
          : Object.prototype.toString.call(current);

    parts.push(message);
    if (current instanceof Error && current.cause !== undefined && current.cause !== current) {
      current = current.cause;
    } else {
      break;
    }
  }

  return parts.join(" -- caused by: ");
}
