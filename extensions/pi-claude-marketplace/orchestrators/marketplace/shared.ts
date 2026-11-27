// orchestrators/marketplace/shared.ts
//
// Cross-subcommand helpers (D-01 -- shared.ts cap ~300 LOC).
//
//   - GitOps interface + DEFAULT_GIT_OPS (D-12, D-13). Six primitives:
//     clone + fetchCommit + checkout + resolveRef + resolveRemoteRef +
//     listRemotes, each on system git (SG-TRN-01). A marketplace checkout and
//     a plugin mirror refresh by D-SG-10's freshness check, re-clone, and swap
//     (`clone-swap.ts`), never by a fetch and checkout in place.
//
//   - GitHubSshOps + DEFAULT_GITHUB_SSH_OPS (SG-SSH-02, D-SG-18): the ssh
//     probe that orders a GitHub clone's transports, and the user's ssh
//     settings a plugin clone checks; defaultPluginTransportContext binds a
//     command's plugin transport context to that port.
//
//   - lacksStoredCredential (GAUTH-04): whether an auth failure gains the
//     line that names how to store a credential.
//
//   - cascadeUnstagePlugin (D-02, D-03): per-plugin hand-rolled
//     try/catch envelope that composes the 6 bridge unstage*
//     primitives in PU-1 order (skills → commands → agents → hooks
//     → mcp → workflows). Reused by plugin uninstall -- preserve the
//     public signature.
//
//   - resolveScopeFromState (MR-1): cross-scope ambiguity funnel.
//     Throws MarketplaceNotFoundError or MarketplaceAmbiguousScopeError
//     (both exported by shared/errors.ts).
//
// Per D-02 ANTI-PATTERN: this file MUST NOT import from `transaction/`
// (no phase-ledger runner). The cascade is the wrong shape for ledger
// semantics (MR-3 requires continuation across plugin failures; the
// ledger runner halts on first throw). Code review enforces; ESLint
// does not.

import path from "node:path";

import { unstagePluginAgents } from "../../bridges/agents/index.ts";
import { unstagePluginCommands } from "../../bridges/commands/index.ts";
import { removeHookConfig } from "../../bridges/hooks/index.ts";
import { unstageMcpServers } from "../../bridges/mcp/index.ts";
import { unstagePluginSkills } from "../../bridges/skills/index.ts";
import { unstagePluginWorkflows } from "../../bridges/workflows/index.ts";
import { generatedMcpServerKey } from "../../domain/name.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import * as defaultGit from "../../platform/git.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import {
  McpUnstagePartialError,
  WorkflowsUnstageRefusedError,
  type McpWrittenFile,
} from "../../shared/errors-bridges.ts";
import {
  errorMessage,
  InvalidMarketplaceManifestError,
  isErrnoException,
  MarketplaceInBaseLayerOnlyError,
  MarketplaceInLocalLayerOnlyError,
  MarketplaceNotFoundError,
  PluginShapeError,
  StoredCredentialRejectedError,
} from "../../shared/errors.ts";
import { classifyGitFailure } from "../../shared/git-failure-classifiers.ts";
import { notify } from "../../shared/notification-dispatch.ts";
import { type ContentReason } from "../../shared/notification-types.ts";
import { type MarketplaceRows, type Single } from "../../shared/notify-context.ts";
import { ownValue } from "../../shared/own-key.ts";
import { createPluginTransportContext } from "../github-transport.ts";

import type { UnstageAgentFailure } from "../../bridges/agents/types.ts";
import type { UnstageWorkflowFailure } from "../../bridges/workflows/types.ts";
import type { ConfigLoadResult, ScopeConfig } from "../../persistence/config-io.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { GitAuthBundle } from "../../platform/git-credential.ts";
import type { ListRemotesResult, SshProbeResult } from "../../platform/git.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type {
  MarketplaceNotAddedMessage,
  McpConfigNotice,
  PluginFailedMessage,
} from "../../shared/notification-types.ts";
import type { Scope } from "../../shared/types.ts";
import type { PluginSshOps, PluginTransportContext } from "../github-transport.ts";

/**
 * CR-06: AG-5 foreign-content failure carries the structured per-agent
 * `failed[]` from the agents bridge so downstream consumers (partial-success
 * removal, diagnostics, tests) can read individual failure reasons WITHOUT
 * re-parsing the textual message. The message formatting is preserved for the
 * user-visible surface.
 *
 * @param message The formatted user-visible failure message.
 * @param failedAgents The structured per-agent failures from the agents bridge.
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
 * WLIF-03: a workflows unstage that could not remove every recorded name.
 *
 * Sits beside `AgentsUnstageFailureError` because this module is the one
 * marketplace file a plugin ledger may import from, and the cascade needs the
 * same class.
 *
 * Unlike its sibling next door, the payload is a FROZEN DEFENSIVE COPY. The
 * names identify EXECUTABLE files left on disk, and the error crosses the
 * ledger boundary into a renderer that reads it long after the bridge
 * returned; a frozen copy is the only way the field is provably the same list
 * at read time as at throw time.
 */
export class WorkflowsUnstageFailureError extends Error {
  readonly failedWorkflows: readonly UnstageWorkflowFailure[];
  constructor(message: string, failedWorkflows: readonly UnstageWorkflowFailure[]) {
    super(message);
    this.name = "WorkflowsUnstageFailureError";
    this.failedWorkflows = Object.freeze([...failedWorkflows]);
  }
}

/**
 * The optional auth bundle of GitOps.clone, GitOps.fetchCommit, and
 * GitOps.resolveRemoteRef, owned by `platform/git-credential.ts`. It decides
 * what an authentication failure of the git run leads to (D-SG-14); when it is
 * undefined, every call site behaves identically to the public-only path.
 * The marketplace and plugin orchestrators import it from here, beside the
 * git surface that takes it.
 */
export type { GitAuthBundle };

/**
 * D-12, D-13: marketplace orchestrator git surface.
 *
 * Six primitives. `clone` and `resolveRemoteRef` carry D-SG-10's refresh:
 * the freshness check asks `resolveRemoteRef`, and a stale checkout is cloned
 * again and swapped in. `fetchCommit` (SG-TRN-02) fetches one pinned commit,
 * `checkout` checks it out, and `resolveRef` reads a local commit. D-SG-10
 * removed the D-14 fetch, ref update, and branch read with the in-place
 * refresh that used them.
 * `resolveRemoteRef` (D-77-05) also lets the plugin clone-cache seam pin an
 * unpinned source's remote HEAD to a SHA without a full clone at install
 * time. `listRemotes` (D-3-03; MA-12, MA-13) lets the `marketplace add`
 * leftover-clone guard tell its own leftover clone apart from a foreign or
 * unreadable tree.
 *
 * `clone`, `fetchCommit`, and `resolveRemoteRef` each accept an optional
 * `auth` bundle. When provided, `DEFAULT_GIT_OPS` forwards it to
 * `platform/git.ts`, which maps an auth failure of the git run by it (D-SG-14,
 * GAUTH-04). When omitted, each behaves identically to the public-only path
 * (NFR-5 surfaces untouched).
 */
export interface GitOps {
  /**
   * MA-5, C5: clone url into dir at depth 1 with no submodules, optional ref,
   * single-branch when ref is set. SG-TRN-02: `noCheckout` writes no work
   * tree, the first rung of the pin ladder.
   */
  clone(opts: {
    dir: string;
    url: string;
    ref?: string;
    singleBranch?: boolean;
    noCheckout?: boolean;
    auth?: GitAuthBundle;
  }): Promise<void>;
  /**
   * SG-TRN-02, C5: fetch the commit `sha` into the clone `dir` with `fetch
   * --depth 1 origin <sha>`. When that fails other than by an abort, a
   * shallow clone falls back to `fetch --unshallow origin [<ref>]`, whose
   * failure is the one thrown; a complete clone, or `unshallow: false`
   * (D-SG-09), throws the first failure.
   */
  fetchCommit(opts: {
    dir: string;
    sha: string;
    ref?: string;
    unshallow?: boolean;
    auth?: GitAuthBundle;
  }): Promise<void>;
  /**
   * Move HEAD to ref/SHA and write its tree. D-SG-11: set
   * `fromCopiedGitDir` when `dir/.git` is a copy of another clone's git
   * directory, so the clone keys a clone made by an earlier version of this
   * extension carries are unset before the checkout.
   */
  checkout(opts: { dir: string; ref: string; fromCopiedGitDir?: boolean }): Promise<void>;
  /**
   * Resolve a ref name to the commit it names, or undefined when it names no
   * commit.
   */
  resolveRef(opts: { dir: string; ref: string }): Promise<string | undefined>;
  /**
   * D-77-05 / PURL-09: resolve a remote ref (or the default-branch HEAD) to
   * its full commit SHA WITHOUT a full clone. Used by the plugin clone-cache
   * seam to pin an unpinned source at install time, or undefined when the
   * remote advertises no such ref, or no HEAD. An optional `auth` bundle
   * threads through to `listServerRefs` so an unpinned PRIVATE-repo HEAD
   * resolution can authenticate (PROV-03); omitted = public-only.
   */
  resolveRemoteRef(opts: {
    url: string;
    ref?: string;
    auth?: GitAuthBundle;
  }): Promise<string | undefined>;
  /**
   * D-3-03 / MA-12 / MA-13: report whether `dir` is a readable git clone and,
   * if so, what its `origin` remote names. Used by the `marketplace add`
   * leftover-clone guard to recognize its own leftover clone before removing
   * it. This is the only member of this interface that does not throw on
   * failure: the caller must tell a foreign tree apart from a directory it
   * could not read, and a throw-and-catch shape would collapse both into one
   * outcome.
   */
  listRemotes(opts: { dir: string }): Promise<ListRemotesResult>;
}

/**
 * D-13 default implementation. All primitives delegate to
 * `platform/git.ts`, which runs system git through the git process module
 * (D-SG-01). No dynamic imports.
 */
export const DEFAULT_GIT_OPS: GitOps = {
  // The `auth?` field of each GitOps member is the `auth?` field of the
  // matching platform/git.ts options, so the bound functions take the opts
  // shape as it is.
  clone: defaultGit.clone,
  fetchCommit: defaultGit.fetchCommit,
  checkout: defaultGit.checkout,
  resolveRef: defaultGit.resolveRef,
  resolveRemoteRef: defaultGit.resolveRemoteRef,
  listRemotes: defaultGit.listRemotes,
};

/**
 * SG-SSH-02: the user's ssh as the GitHub transport choice reads it. A port
 * of its own, beside `GitOps`, so a test of a GitHub clone states the probe's
 * answer and no test runs the machine's ssh.
 */
export interface GitHubSshOps {
  /** Claude Code's probe of whether the user's ssh authenticates to GitHub. */
  readonly probe: () => Promise<SshProbeResult>;
}

/**
 * D-SG-18: the port a plugin clone's checks read, the probe plus the user's
 * own ssh settings (`PluginSshOps`). The marketplace path reads the probe
 * only, so its callers keep the narrower `GitHubSshOps`.
 */
export type GitHubPluginSshOps = GitHubSshOps & PluginSshOps;

/**
 * SG-SSH-02, D-SG-18: the default port, on the system ssh and git through
 * `platform/git.ts`; `userOverride` reads this process's environment. NFR-5:
 * only a `NETWORK_SEAMS` module may name it (BLOCK F).
 */
export const DEFAULT_GITHUB_SSH_OPS: GitHubPluginSshOps = {
  probe: () => defaultGit.probeGitHubSsh(),
  userOverride: () => defaultGit.userSshOverride({ env: process.env }),
  urlRewritten: (sshUrl) => defaultGit.sshUrlRewritten(sshUrl),
  showsDirectGitHub: () => defaultGit.sshShowsDirectGitHub(),
  showsDirectGitHubThroughGit: (sshUrl) => defaultGit.sshShowsDirectGitHubThroughGit(sshUrl),
};

/**
 * D-SG-18: a new transport context bound to `DEFAULT_GITHUB_SSH_OPS`, for a
 * command root outside `NETWORK_SEAMS`, which may not name the port.
 */
export function defaultPluginTransportContext(
  env: NodeJS.ProcessEnv = process.env,
): PluginTransportContext {
  return createPluginTransportContext({ env, ssh: DEFAULT_GITHUB_SSH_OPS });
}

/**
 * D-PL8-24: the git abort scope, re-exported here so `index.ts` hands it to the
 * background pass without naming `platform/git.ts`.
 */
export { runWithGitAbortSignal } from "../../platform/git.ts";

/**
 * GAUTH-04: an auth failure that a stored credential could answer, so the
 * failure gains the `NO_STORED_CREDENTIAL_CAUSE` line. git's `https-auth`
 * failure with the `no-credential` detail qualifies: no helper gave git a
 * credential. A refused credential (`StoredCredentialRejectedError`) does not
 * qualify, because a helper produced it and the host was sent it. Each caller
 * places the line.
 */
export function lacksStoredCredential(err: unknown): err is Error {
  return (
    err instanceof Error &&
    !(err instanceof StoredCredentialRejectedError) &&
    classifyGitFailure(err, { notFound: "network error" })?.reason === "authentication required"
  );
}

/**
 * D-02, D-03: result of one plugin's cascade through the 6 bridges.
 * Discriminated implicitly by `ok` -- on success `cause` is absent;
 * on failure `cause` carries the FIRST throw (D-03 fail-fast). Names
 * already dropped before the throw are still reported in `dropped`
 * because the bridges are idempotent and their writes already
 * committed.
 */
export interface UnstageOutcome {
  /** True when all SIX bridges' unstage* calls returned cleanly. */
  readonly ok: boolean;
  /**
   * Names actually removed across all six bridges. Empty when nothing was
   * staged. LIFE-01 / D-63-01: `hooks` lands between `agents` and
   * `mcpServers`; WLIF-03: `workflows` lands last (declaration order matches
   * cascade order).
   */
  readonly dropped: {
    readonly skills: readonly string[];
    readonly commands: readonly string[];
    readonly agents: readonly string[];
    readonly hooks: readonly string[];
    readonly mcpServers: readonly string[];
    readonly workflows: readonly string[];
  };
  /** Set on failure: the FIRST throw, wrapped to Error if needed (D-03 fail-fast). */
  readonly cause?: Error;
  /**
   * AFILE-04: the MCP slot's config notices, carried for the caller to show
   * after its rows instead of being dropped with the bridge's hygiene
   * warnings. Set only when non-empty, on success and on failure: a later
   * slot can fail after the MCP slot rewrote the file.
   */
  readonly mcpConfigNotices?: readonly McpConfigNotice[];
  /**
   * NFR-3: each MCP config file the MCP slot rewrote and the exact bytes it
   * wrote, so a prune rollback can recognize its own rewrite. Set only when
   * non-empty, on success and on failure, like `mcpConfigNotices`.
   */
  readonly writtenMcpFiles?: readonly McpWrittenFile[];
}

/**
 * AFILE-04: spreads `mcpConfigNotices` onto an outcome only when there is at
 * least one notice, so an empty list never appears on the outcome.
 */
export function mcpConfigNoticesMember(notices: readonly McpConfigNotice[]): {
  readonly mcpConfigNotices?: readonly McpConfigNotice[];
} {
  return notices.length === 0 ? {} : { mcpConfigNotices: notices };
}

/**
 * Whether `notice` describes what the unstage of `plugin` in `scope` removed;
 * `removed` holds the keys of the dropped entries.
 */
function describesUnstaged(
  notice: McpConfigNotice,
  scope: Scope,
  plugin: string,
  removed: ReadonlySet<string>,
): boolean {
  if (notice.scope !== scope) {
    return false;
  }

  if (notice.kind === "option-blocked") {
    return notice.plugin === plugin;
  }

  return (
    (notice.kind === "variables-missing" ||
      notice.kind === "credentials-blanked" ||
      notice.kind === "tool-rules-unenforced" ||
      notice.kind === "ca-file-removed") &&
    removed.has(notice.server)
  );
}

/**
 * AVAR-04 / ANAME-07 / D-PG9-14: appends an unstage's MCP config notices to a
 * command's notices, in place. It first drops the `variables-missing`,
 * `credentials-blanked`, `tool-rules-unenforced` and `ca-file-removed` notices
 * of the servers the unstage removed, because they describe entries that the
 * scope's mcp-adapter.json no longer holds. `droppedServers` holds declared
 * names, as `UnstageOutcome.dropped.mcpServers` does. D-PG10-21: it drops
 * every `option-blocked` notice of the unstaged plugin and scope, whatever
 * its server, because a blocked server is in no recorded list and so is never
 * among the dropped servers. File notices stay, because the files were still
 * rewritten.
 */
export function foldUnstageNotices(
  notices: McpConfigNotice[],
  unstaged: {
    readonly scope: Scope;
    readonly plugin: string;
    readonly droppedServers: readonly string[];
    readonly notices: readonly McpConfigNotice[];
  },
): void {
  const removed = new Set(
    unstaged.droppedServers.map((name) => generatedMcpServerKey(unstaged.plugin, name)),
  );
  const standing = notices.filter(
    (notice) => !describesUnstaged(notice, unstaged.scope, unstaged.plugin, removed),
  );
  notices.splice(0, notices.length, ...standing, ...unstaged.notices);
}

/** NFR-3: spreads `writtenMcpFiles` onto an outcome only when a file was rewritten. */
function writtenMcpFilesMember(files: readonly McpWrittenFile[]): {
  readonly writtenMcpFiles?: readonly McpWrittenFile[];
} {
  return files.length === 0 ? {} : { writtenMcpFiles: files };
}

/**
 * TR-03 / ANAME-01: the record's declared server names whose entry the MCP
 * unstage removed, in record order. An entry sits under
 * `generatedMcpServerKey(plugin, name)`, or under the declared name itself
 * when it was written under that name (the legacy mcp.json, or an adapter
 * entry staged under its declared name).
 */
function droppedMcpServers(
  plugin: string,
  declaredNames: readonly string[],
  removedNames: readonly string[],
): string[] {
  const removed = new Set(removedNames);
  return declaredNames.filter(
    (name) => removed.has(generatedMcpServerKey(plugin, name)) || removed.has(name),
  );
}

/**
 * D-02: hand-rolled per-plugin cascade. PU-1 order (skills → commands →
 * agents → hooks → MCP → workflows). D-03 fail-fast: the FIRST bridge throw halts THIS
 * plugin and the plugin lands in failedPlugins[] in the caller; already
 * unstaged resources stay unstaged (bridges are idempotent). Plugin
 * uninstall reuses this primitive -- preserve the signature.
 *
 * AG-5 foreign-content: the agents bridge does NOT throw on foreign
 * content -- it preserves the index row and reports via `result.failed[]`.
 * The cascade primitive opts into strict semantics by throwing when
 * failed.length > 0, so the per-plugin try/catch lands the plugin in
 * failedPlugins[].
 *
 * WLIF-03: the workflows bridge takes the same strict opt-in for the same
 * reason -- it accumulates per-name failures rather than throwing, and the
 * names it could not remove identify executable files left on disk.
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
    workflows: [] as string[],
  };
  let mcpConfigNotices: readonly McpConfigNotice[] = [];
  let writtenMcpFiles: readonly McpWrittenFile[] = [];

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
    dropped.mcpServers = droppedMcpServers(
      plugin,
      installedPlugin.resources.mcpServers,
      mcpResult.removedNames,
    );
    mcpConfigNotices = mcpResult.notices;
    writtenMcpFiles = mcpResult.written;

    // WLIF-03: 6th cascade slot, after mcp so no existing ordering shifts. The
    // names come from the RECORD, never from a re-derivation off the plugin
    // source: the source may have changed since the install, and the envelope
    // on disk is the one the record names. Envelopes live outside every scope
    // root, so nothing else will ever find them.
    const workflowsResult = await unstagePluginWorkflows({
      locations,
      previousWorkflowNames: installedPlugin.resources.workflows,
    });
    dropped.workflows = [...workflowsResult.removedNames];

    if (workflowsResult.failed.length > 0) {
      // Mirrors the agents guard above: the bridge accumulates per-name
      // failures rather than throwing, so the cascade opts into strict
      // semantics here. The `; `-joined text is the user-visible surface; the
      // structured array is what a consumer reads without re-parsing prose.
      const reasons = workflowsResult.failed.map((f) => `${f.name}: ${f.reason}`).join("; ");
      throw new WorkflowsUnstageFailureError(
        `Failed to remove ${workflowsResult.failed.length} workflow(s): ${reasons}`,
        workflowsResult.failed,
      );
    }

    return Object.freeze({
      ok: true,
      dropped: freezeDropped(dropped),
      ...mcpConfigNoticesMember(mcpConfigNotices),
      ...writtenMcpFilesMember(writtenMcpFiles),
    });
  } catch (err) {
    // AFILE-04: an MCP unstage that rewrote the adapter file before its legacy
    // write failed still reports the comments it dropped there, the servers no
    // file still holds (TR-03), and the bytes it wrote (NFR-3). The write
    // failure is the plugin's cause.
    let failure: unknown = err;
    if (err instanceof McpUnstagePartialError) {
      dropped.mcpServers = droppedMcpServers(
        plugin,
        installedPlugin.resources.mcpServers,
        err.removedNames,
      );
      mcpConfigNotices = err.notices;
      writtenMcpFiles = err.written;
      failure = err.cause;
    } else if (err instanceof WorkflowsUnstageRefusedError) {
      // PI-14: a refusal after some envelopes were removed still reports
      // those names as dropped, so the record stops naming files that are
      // gone. The refusal itself stays the plugin's cause.
      dropped.workflows = [...err.removedNames];
      failure = err.refusal;
    }

    return Object.freeze({
      ok: false,
      dropped: freezeDropped(dropped),
      cause: failure instanceof Error ? failure : new Error(String(failure)),
      ...mcpConfigNoticesMember(mcpConfigNotices),
      ...writtenMcpFilesMember(writtenMcpFiles),
    });
  }
}

function freezeDropped(dropped: UnstageOutcome["dropped"]): UnstageOutcome["dropped"] {
  return Object.freeze({
    skills: Object.freeze([...dropped.skills]),
    commands: Object.freeze([...dropped.commands]),
    agents: Object.freeze([...dropped.agents]),
    hooks: Object.freeze([...dropped.hooks]),
    mcpServers: Object.freeze([...dropped.mcpServers]),
    workflows: Object.freeze([...dropped.workflows]),
  });
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
async function resolveScopeFromState(
  mpName: string,
  userLocations: ScopedLocations,
  projectLocations: ScopedLocations,
): Promise<{ scope: Scope; locations: ScopedLocations }> {
  const [userState, projectState] = await Promise.all([
    loadState(userLocations.extensionRoot),
    loadState(projectLocations.extensionRoot),
  ]);

  if (ownValue(projectState.marketplaces, mpName) !== undefined) {
    return { scope: "project", locations: projectLocations };
  }

  if (ownValue(userState.marketplaces, mpName) !== undefined) {
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
 * MarketplaceNotAddedMessage `(failed) {marketplace not added}` variant (SC#1 cross-op
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
 * Takes the structural subset of the caller opts ({ ctx, run, name, scope? })
 * so both UpdateMarketplaceOptions and RemoveMarketplaceOptions satisfy it.
 * D-05: both not-added emissions render from the command run's snapshot.
 */
export async function resolveScopeOrNotifyNotAdded(
  opts: { ctx: NotificationContext; run: NotificationRun; name: string; scope?: Scope },
  userLocations: ScopedLocations,
  projectLocations: ScopedLocations,
): Promise<{ scope: Scope; locations: ScopedLocations } | undefined> {
  // Bare form: resolveScopeFromState proves existence across both scopes.
  if (opts.scope === undefined) {
    try {
      return await resolveScopeFromState(opts.name, userLocations, projectLocations);
    } catch (err) {
      if (err instanceof MarketplaceNotFoundError) {
        notify(opts.ctx, opts.run, { kind: "marketplace-not-added", name: opts.name });
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
  if (ownValue(preState.marketplaces, opts.name) === undefined) {
    const otherLocations = opts.scope === "user" ? projectLocations : userLocations;
    const elsewhere = await marketplaceRecordedIn(
      otherLocations.scope,
      () => otherLocations,
      opts.name,
    );
    notify(opts.ctx, opts.run, {
      kind: "marketplace-not-added",
      name: opts.name,
      scope: opts.scope,
      ...(elsewhere && { presentInOtherScope: true }),
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
    // eslint-disable-next-line no-await-in-loop -- at most two scopes, one state read each
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

// ───────────────────────────────────────────────────────────────────────────
// It lives here, beside `AgentsUnstageFailureError`, because that class is the
// first thing it dispatches on. A narrower kept apart from the error it
// narrows is how two cascade-failure mappings drift (FLOW-09).
// ───────────────────────────────────────────────────────────────────────────

/**
 * Narrow a per-plugin cascade Error.cause to a closed-set Reason for the
 * failed-plugin children block by dispatching on the typed cause
 * (`AgentsUnstageFailureError` or `NodeJS.ErrnoException.code`) rather than
 * substring-matching message text. Falls back to `"not in manifest"` when no
 * typed case matches -- the closed `ContentReason` vocabulary has no
 * "unclassified" member, so an untyped error or an unrecognized errno code
 * is mislabeled as this token; the raw `cause` still travels alongside it,
 * so the real failure survives in the cause-chain trailer.
 */
export function narrowCascadeFailure(cause: Error): ContentReason {
  if (cause instanceof AgentsUnstageFailureError) {
    // ATTR-09 / D-NCF: foreign content owned by another process is a
    // content/ownership mismatch, not a manifest absence. Aligned with
    // uninstall.ts's mapping (`AgentsUnstageFailureError` -> "source mismatch")
    // so the two cascade-failure narrowers do not drift.
    return "source mismatch";
  }

  if (cause instanceof InvalidMarketplaceManifestError) {
    return "unparseable";
  }

  if (
    cause instanceof MarketplaceNotFoundError ||
    (cause instanceof PluginShapeError && cause.kind === "not-in-manifest")
  ) {
    return "not in manifest";
  }

  const errnoReason = isErrnoException(cause) ? fsErrnoReason(cause.code) : undefined;
  return errnoReason ?? "not in manifest";
}

/**
 * D-PL5-18: the one filesystem errno mapping `narrowCascadeFailure` and
 * `marketplace add` share, so `list`, `info`, and `add` read a code alike.
 * Undefined for a code it does not name.
 */
export function fsErrnoReason(
  code: string | undefined,
): "permission denied" | "source missing" | "unreadable" | undefined {
  switch (code) {
    case "EACCES":
    case "EPERM":
      return "permission denied";
    case "ENOENT":
    case "ENOTDIR":
      return "source missing";
    case "EBADF":
    case "EIO":
    case "EISDIR":
      return "unreadable";
    case undefined:
    default:
      return undefined;
  }
}

/**
 * CMP-4 / SCOPE-01: does a `marketplace-absent` row deserve the qualified
 * cross-scope reason token -- i.e. is the marketplace CONTAINER registered in
 * the scope the command did not target?
 *
 * Shared by every verb that renders `MarketplaceNotAddedMessage` with an
 * explicit scope. Call it ONLY when a single scope was consulted: an absent
 * `[scope]` bracket means both scopes were already checked and both missed
 * (D-03), so there is no other scope left to probe.
 *
 * Both directions are live. A user target probes project; a project target
 * probes user. For `install` specifically the project direction always answers
 * `false` -- `resolveInstallMarketplaceSource` has already consulted user
 * scope through the CMP-3 fallback before the absent arm is reached -- but the
 * read is harmless there and other verbs carry no such fallback.
 *
 * NEVER throws. The caller sits OUTSIDE the `withLockedStateTransaction`
 * try/catch and no edge handler catches, so a throw here would replace a clean
 * `{marketplace not added}` failure row with an unhandled rejection and NO `ctx.ui.notify`
 * call at all (IL-2). `loadState` throws on malformed JSON, schema violation
 * and any non-ENOENT read error, and a project `state.json` we are not
 * installing into is exactly the file most likely to be broken or unreadable.
 * The cross-scope claim is advisory; losing it is a strictly better outcome
 * than losing the failure row, so an unreadable other scope degrades to the
 * plain `{marketplace not added}` token.
 *
 * Read-only and network-free (NFR-5), but NOT side-effect-free: `loadState`
 * normalizes a legacy record in place and fires a fire-and-forget
 * `persistMigratedState` write (ST-4) when it does. Probing the sibling scope
 * can therefore rewrite that scope's `state.json` to the current schema. The
 * write is best-effort and never observed here -- a failure surfaces through
 * the IL-3 sanctioned warn inside `persistMigratedState`, not through this
 * function's `boolean`.
 */
export async function marketplaceInOtherScope(opts: {
  readonly cwd: string;
  readonly marketplace: string;
  readonly scope: Scope;
}): Promise<boolean> {
  const other: Scope = opts.scope === "user" ? "project" : "user";
  return await marketplaceRecordedIn(other, () => locationsFor(other, opts.cwd), opts.marketplace);
}

/** Build the shared marketplace-absence message without reading state. */
export function marketplaceNotAddedMessage(opts: {
  readonly name: string;
  readonly scope: Scope | undefined;
  readonly presentInOtherScope?: true;
}): MarketplaceNotAddedMessage {
  return {
    kind: "marketplace-not-added",
    name: opts.name,
    ...(opts.scope !== undefined && { scope: opts.scope }),
    ...(opts.presentInOtherScope === true && { presentInOtherScope: true }),
  };
}

/**
 * CMP-4 / SCOPE-01: is `name` recorded in the state file of `scope`?
 *
 * NEVER throws -- see `marketplaceInOtherScope`. `false` on any read failure,
 * which degrades the row to the plain `{marketplace not added}` token rather
 * than taking the failure row down with it.
 *
 * `resolveLocations` is a thunk rather than a `ScopedLocations` value so that
 * callers which must BUILD the bundle do it INSIDE this try: `locationsFor`
 * calls the host's `getAgentDir()`, so it is itself part of the surface the
 * never-throws contract has to cover. Callers holding a bundle already proven
 * safe pass `() => bundle`.
 *
 * The swallow is deliberate but not silent: the discarded cause is the only
 * answer to "why did the cross-scope hint never appear", so it is filed to the
 * debug channel before `false` is returned.
 */
async function marketplaceRecordedIn(
  scope: Scope,
  resolveLocations: () => ScopedLocations,
  name: string,
): Promise<boolean> {
  try {
    const state = await loadState(resolveLocations().extensionRoot);
    return ownValue(state.marketplaces, name) !== undefined;
  } catch (err) {
    hookDebugLog(
      `cross-scope probe for "${name}" in ${scope} scope failed: ${errorMessage(err)}`,
      "scope",
    );
    return false;
  }
}

/**
 * CMP-4 / SCOPE-01: the spreadable `presentInOtherScope` fragment every
 * `MarketplaceNotAddedMessage` construction site folds into its message.
 *
 * Returns an EMPTY object when no single scope was consulted. An absent
 * `[scope]` bracket means both scopes already missed (D-03), so no probe is
 * owed and none is performed.
 */
export async function crossScopeFlag(opts: {
  readonly cwd: string;
  readonly marketplace: string;
  readonly scope: Scope | undefined;
}): Promise<{ readonly presentInOtherScope?: true }> {
  if (opts.scope === undefined) {
    return {};
  }

  const elsewhere = await marketplaceInOtherScope({
    cwd: opts.cwd,
    marketplace: opts.marketplace,
    scope: opts.scope,
  });
  return elsewhere ? { presentInOtherScope: true } : {};
}

/**
 * WR-02 / D-01 / D-02: the manifest file of a recorded marketplace. Every
 * marketplace is a directory on disk: the managed clone of a github or url
 * source, or the user's own directory of a path source. The add records the
 * absolute path of the manifest inside that directory: the conventional
 * `.claude-plugin/marketplace.json` for a clone or a directory source, and the
 * exact file for a file source. Every reader locates the manifest here. The
 * typed source and the add-time directory only say where the marketplace came
 * from.
 */
export function recordedManifestPath(record: ExtensionState["marketplaces"][string]): string {
  return record.manifestPath;
}

/**
 * The rows of a marketplace-level failure that has a cause: a `(failed)`
 * marketplace header with one failed child of the same name. A marketplace
 * header carries no cause (SNM-10), so the child carries the reason and the
 * cause line. The child stands for the marketplace, so its JSON id is the
 * marketplace name alone (D-PL5-12).
 */
export function marketplaceFailureRows(
  name: string,
  scope: Scope,
  reason: ContentReason,
  cause: Error,
): Single<MarketplaceRows<PluginFailedMessage>> {
  return [
    {
      name,
      scope,
      status: "failed",
      severity: "error",
      plugins: [
        {
          status: "failed",
          name,
          reasons: [reason],
          cause,
          marketplaceSubject: true,
          severity: "error",
          needsReload: false,
        },
      ],
    },
  ];
}

/**
 * Where a marketplace a named command targets is declared, as seen from the
 * command's target layer:
 *
 * - `declared`: the target layer declares it; `other` says whether the other
 *   layer declares it too, or could not be read.
 * - `refused`: only the other layer declares it; `refusal` is the cause line.
 * - `undeclared`: neither layer declares it (a recorded marketplace).
 * - `other-unreadable`: the target layer does not declare it and the other
 *   file is invalid; `otherBasename` names that file without its path.
 */
export type MarketplaceLayerVerdict =
  | { readonly kind: "declared"; readonly other: "declares" | "silent" | "unreadable" }
  | {
      readonly kind: "refused";
      readonly reason: "marketplace in local layer only" | "marketplace in base layer only";
      readonly refusal: MarketplaceInLocalLayerOnlyError | MarketplaceInBaseLayerOnlyError;
    }
  | { readonly kind: "undeclared" }
  | { readonly kind: "other-unreadable"; readonly otherBasename: string };

/**
 * LAYER-02 / D-MF-03: a named command changes only its target layer, and fails
 * when that layer does not declare the marketplace while the other one does.
 *
 * Pure: the caller loads both files inside its lock and handles a CFG-03
 * invalid target first. Membership is an own-key read, so a `__proto__` or
 * `constructor` name is declared only by an own entry. An unreadable other
 * file is never read as declaring nothing, as with
 * `localOnlyMarketplaceRefusal`: it may declare the marketplace.
 */
export function marketplaceLayerVerdict(args: {
  readonly target: ScopeConfig;
  readonly other: ConfigLoadResult;
  readonly targetIsLocal: boolean;
  readonly marketplace: string;
}): MarketplaceLayerVerdict {
  const inTarget = ownValue(args.target.marketplaces, args.marketplace) !== undefined;
  if (args.other.status === "invalid") {
    return inTarget
      ? { kind: "declared", other: "unreadable" }
      : { kind: "other-unreadable", otherBasename: path.basename(args.other.filePath) };
  }

  const inOther =
    args.other.status === "valid" &&
    ownValue(args.other.config.marketplaces, args.marketplace) !== undefined;
  if (inTarget) {
    return { kind: "declared", other: inOther ? "declares" : "silent" };
  }

  if (!inOther) {
    return { kind: "undeclared" };
  }

  return args.targetIsLocal
    ? {
        kind: "refused",
        reason: "marketplace in base layer only",
        refusal: new MarketplaceInBaseLayerOnlyError(args.marketplace),
      }
    : {
        kind: "refused",
        reason: "marketplace in local layer only",
        refusal: new MarketplaceInLocalLayerOnlyError(args.marketplace),
      };
}
