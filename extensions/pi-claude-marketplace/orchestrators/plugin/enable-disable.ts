// orchestrators/plugin/enable-disable.ts
//
// D-54-01 / ENBL-01 / ENBL-02 / ENBL-03 / ENBL-04 (Phase 54 Plan 02).
//
// Single orchestrator parameterized by `enable: boolean`. Mirrors the
// `setMarketplaceAutoupdate` shape: composes `resolveCrossScopePluginTarget`
// + `withStateGuard` (CFG-03 abort + cascadeUnstagePlugin OR install-ledger)
// + `saveConfig` + a single terminal `notify()` per IL-2.
//
// NFR-5 (no network): this file MUST NOT import platform/git or DEFAULT_GIT_OPS.
// The Phase 54 Plan 01 architecture gate at
// `tests/architecture/no-orchestrator-network.test.ts` (FORBIDDEN_TARGETS) is
// armed for this file -- adding any forbidden surface fails the gate.
//
// Pitfall 54-1 / A6: `loadConfig(targetConfigPath)` runs INSIDE the
// `withStateGuard` closure so a concurrent flip from another process either
// fails fast at lock acquisition or retries against the fresh post-flip
// state.
//
// Pitfall 54-2: this file lands in the SAME atomic commit as the
// `(disabled)` token + variant + renderer arm + catalog amendment. Any
// intermediate state would trip a drift gate (closed-set length lock,
// catalog-uat byte equality, etc.).
//
// Pitfall 54-4 / ENBL-02 version pin: the enable branch passes
// `pinVersionOverride: installed.version` to `installPlugin` so the install
// ledger does NOT call `resolvePluginVersion` (which could bump the version
// if `plugin.json` or the marketplace entry drifted between disable and
// enable). The cached marketplace manifest read happens inside `installPlugin`
// via `loadMarketplaceManifest(` -- the cached PI-2 read, never the network.
//
// Pitfall 54-5 / --local file isolation: when `opts.local === true`,
// `targetConfigPath = locations.configLocalJsonPath` UNCONDITIONALLY -- the
// orchestrator NEVER falls back to the base file on ENOENT (`loadConfig`'s
// absent arm yields an empty starting shape that `saveConfig` writes back to
// the local file, creating it fresh).
//
// T-53-02-02 / T-54-02-02 information disclosure mitigation: the CFG-03
// abort row carries `path.basename(targetConfigPath)` -- never the absolute
// path -- reusing the Phase 53 preview pattern.

import path from "node:path";

import { loadConfig, saveConfig } from "../../persistence/config-io.ts";
import { errorMessage } from "../../shared/errors.ts";
import { notify } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";
import { cascadeUnstagePlugin } from "../marketplace/shared.ts";

import { installPlugin } from "./install.ts";
import { resolveCrossScopePluginTarget } from "./shared.ts";

import type { ScopeConfig } from "../../persistence/config-io.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { ContentReason, PluginNotificationMessage } from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * D-54-01 options bundle for `setPluginEnabled`. Mirrors
 * `UninstallPluginOptions` + `enable: boolean` + an opt-in `local?: boolean`
 * for the per-machine override file (Pitfall 54-5).
 */
export interface EnableDisablePluginOptions {
  readonly ctx: ExtensionContext;
  /** Factory `pi` reference -- threaded into `notify()` for the single softDepStatus(pi) probe. */
  readonly pi: ExtensionAPI;
  /** Project-scope cwd (ignored for user scope; see locationsFor). */
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  /** true -> enable; false -> disable. */
  readonly enable: boolean;
  /** When undefined, resolves the scope via project-then-user precedence (CMP-5). */
  readonly scope?: Scope;
  /**
   * Pitfall 54-5: when true, target `claude-plugins.local.json` instead of
   * `claude-plugins.json`. The base file is NEVER touched on the --local path.
   */
  readonly local?: boolean;
}

/** Outcome sentinel populated by the withStateGuard closure. */
type SetEnabledOutcome =
  | { kind: "idempotent" }
  | { kind: "fresh"; version?: string }
  | { kind: "invalid-config" }
  | { kind: "not-recorded" }
  | { kind: "enable-failed"; cause: Error; recordedVersion?: string }
  | { kind: "disable-failed"; cause: Error; recordedVersion?: string };

/**
 * The "currently disabled" marker -- the empty-resources + installable:true
 * intersection that `orchestrators/reconcile/plan.ts::isRecordedButDisabled`
 * uses. Duplicated locally to avoid pulling the reconcile module into the
 * orchestrator's import graph (the planner is the canonical owner; this
 * predicate is the deliberate same-rule mirror).
 */
function isCurrentlyDisabled(installed: {
  compatibility: { installable: boolean };
  resources: {
    skills: readonly string[];
    prompts: readonly string[];
    agents: readonly string[];
    mcpServers: readonly string[];
  };
}): boolean {
  return (
    installed.compatibility.installable &&
    installed.resources.skills.length === 0 &&
    installed.resources.prompts.length === 0 &&
    installed.resources.agents.length === 0 &&
    installed.resources.mcpServers.length === 0
  );
}

/**
 * Run the enable branch: invoke `installPlugin` in orchestrated mode with the
 * pinned version override (Pitfall 54-4). Returns the outcome sentinel.
 */
async function runEnableBranch(
  opts: EnableDisablePluginOptions,
  scope: Scope,
  recordedVersion: string,
): Promise<SetEnabledOutcome> {
  try {
    const installOutcome = await installPlugin({
      ctx: opts.ctx,
      pi: opts.pi,
      scope,
      cwd: opts.cwd,
      marketplace: opts.marketplace,
      plugin: opts.plugin,
      notifications: { mode: "orchestrated" },
      pinVersionOverride: recordedVersion,
    });
    if (installOutcome.status === "failed") {
      return { kind: "enable-failed", cause: installOutcome.error, recordedVersion };
    }

    return { kind: "fresh", version: recordedVersion };
  } catch (err) {
    return {
      kind: "enable-failed",
      cause: err instanceof Error ? err : new Error(errorMessage(err)),
      recordedVersion,
    };
  }
}

/**
 * Run the disable branch: cascade-unstage artefacts via the existing
 * `cascadeUnstagePlugin` primitive, then reset `resources.*` to [] in place
 * (PRESERVING `version` / `resolvedSource` / `compatibility` / `installedAt`
 * per ENBL-02). Returns the outcome sentinel.
 */
async function runDisableBranch(
  opts: EnableDisablePluginOptions,
  locations: ScopedLocationsLike,
  installed: InstalledPluginRecord,
): Promise<SetEnabledOutcome> {
  const recordedVersion = installed.version;
  const cascade = await cascadeUnstagePlugin(
    opts.plugin,
    opts.marketplace,
    locations as never,
    installed as never,
  );
  if (!cascade.ok) {
    return {
      kind: "disable-failed",
      cause: cascade.cause ?? new Error(`Cascade unstage failed for plugin "${opts.plugin}".`),
      recordedVersion,
    };
  }

  // PRESERVE version / resolvedSource / compatibility / installedAt;
  // RESET resources.*; BUMP updatedAt.
  installed.resources.skills = [];
  installed.resources.prompts = [];
  installed.resources.agents = [];
  installed.resources.mcpServers = [];
  installed.updatedAt = new Date().toISOString();

  return { kind: "fresh", version: recordedVersion };
}

/** Write the patched config entry via the SOLE sanctioned saveConfig seam. */
async function writeConfigEntry(
  current: ScopeConfig,
  targetConfigPath: string,
  scopeRoot: string,
  plugin: string,
  marketplace: string,
  enable: boolean,
): Promise<void> {
  const key = `${plugin}@${marketplace}`;
  const existingPluginEntry = current.plugins?.[key] ?? {};
  const patched: ScopeConfig = {
    ...current,
    schemaVersion: 1,
    plugins: {
      ...(current.plugins ?? {}),
      [key]: {
        ...existingPluginEntry,
        enabled: enable,
      },
    },
  };
  await saveConfig(targetConfigPath, patched, scopeRoot);
}

/**
 * Internal narrow types for the helpers above -- pulled out so the runDisable
 * helper does not need to import the full ScopedLocations branded type.
 */
interface InstalledPluginRecord {
  readonly version: string;
  readonly compatibility: { readonly installable: boolean };
  resources: {
    skills: string[];
    prompts: string[];
    agents: string[];
    mcpServers: string[];
  };
  updatedAt: string;
}

interface ScopedLocationsLike {
  readonly scopeRoot: string;
  readonly configJsonPath: string;
  readonly configLocalJsonPath: string;
}

/**
 * D-54-01 entrypoint. Never re-throws -- every failure surfaces through a
 * single `notify()` call per IL-2.
 */
export async function setPluginEnabled(opts: EnableDisablePluginOptions): Promise<void> {
  const { ctx, pi, cwd, marketplace, plugin, enable } = opts;

  // SCOPE-01 / ATTR-04: resolve the cross-scope target. The discriminated
  // resolver distinguishes "marketplace container absent" (loud `{not added}`)
  // from "container present, plugin row absent" (downstream handled inside
  // the guard closure).
  const resolution = await resolveCrossScopePluginTarget({
    cwd,
    marketplace,
    plugin,
    ...(opts.scope !== undefined && { explicitScope: opts.scope }),
  });

  if (resolution.kind === "marketplace-absent" || resolution.kind === "other-scope") {
    // M3 / M4: the marketplace the operator asked for is not added in the
    // requested scope. Standalone `MarketplaceNotAddedMessage` per D-47-A.
    const requestedScope: Scope | undefined = resolution.requestedScope;
    notify(ctx, pi, {
      kind: "marketplace-not-added",
      name: marketplace,
      ...(requestedScope !== undefined && { scope: requestedScope }),
    });
    return;
  }

  const { scope, locations } = resolution;
  const targetConfigPath =
    opts.local === true ? locations.configLocalJsonPath : locations.configJsonPath;
  const configBasename = path.basename(targetConfigPath);

  let outcome: SetEnabledOutcome | undefined;

  try {
    await withStateGuard(locations, async (state) => {
      // Pitfall 54-1 / A6: CFG-03 load inside the lock.
      const cfg = await loadConfig(targetConfigPath);
      if (cfg.status === "invalid") {
        outcome = { kind: "invalid-config" };
        return;
      }

      const mp = state.marketplaces[marketplace];
      const installed = mp?.plugins[plugin];
      if (mp === undefined || installed === undefined) {
        // Either the container disappeared (concurrent removal race) or the
        // plugin row was never written. Surface as not-recorded; the
        // post-guard branch renders an actionable failed row.
        outcome = { kind: "not-recorded" };
        return;
      }

      // ENBL-02 idempotency: empty-resources + installable:true marker.
      if (isCurrentlyDisabled(installed) === !enable) {
        outcome = { kind: "idempotent" };
        return;
      }

      outcome = enable
        ? await runEnableBranch(opts, scope, installed.version)
        : await runDisableBranch(opts, locations, installed);

      if (outcome.kind !== "fresh") {
        return;
      }

      // Config write-back via the SOLE sanctioned saveConfig seam (SPLIT-02).
      const current: ScopeConfig = cfg.status === "valid" ? cfg.config : { schemaVersion: 1 };
      await writeConfigEntry(
        current,
        targetConfigPath,
        locations.scopeRoot,
        plugin,
        marketplace,
        enable,
      );
    });
  } catch (err) {
    // withStateGuard rethrew (lock-held, save failure, etc.). Surface as a
    // failed plugin row carrying the cause.
    const cause = err instanceof Error ? err : new Error(errorMessage(err));
    notify(ctx, pi, {
      marketplaces: [
        {
          name: marketplace,
          scope,
          plugins: [
            {
              status: "failed",
              name: plugin,
              reasons: [] as const,
              cause,
            },
          ],
        },
      ],
    });
    return;
  }

  dispatchOutcome({ ctx, pi, marketplace, scope, plugin, enable, configBasename, outcome });
}

/**
 * Compose the per-outcome `PluginNotificationMessage` and emit a single
 * `notify()` per IL-2. Extracted from `setPluginEnabled` to keep the main
 * orchestrator's cognitive complexity within the project's lint budget.
 */
function dispatchOutcome(args: {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly plugin: string;
  readonly enable: boolean;
  readonly configBasename: string;
  readonly outcome: SetEnabledOutcome | undefined;
}): void {
  const { ctx, pi, marketplace, scope, plugin, enable, configBasename, outcome } = args;
  const row = composeOutcomeRow({ plugin, enable, configBasename, outcome });
  notify(ctx, pi, {
    marketplaces: [
      {
        name: marketplace,
        scope,
        ...(row.mpStatus !== undefined && { status: row.mpStatus }),
        plugins: [row.plugin],
      },
    ],
  });
}

/** Internal: build the (plugin row, optional mp status) pair for the outcome. */
function composeOutcomeRow(args: {
  readonly plugin: string;
  readonly enable: boolean;
  readonly configBasename: string;
  readonly outcome: SetEnabledOutcome | undefined;
}): { plugin: PluginNotificationMessage; mpStatus?: "added" } {
  const { plugin, enable, configBasename, outcome } = args;
  if (outcome === undefined) {
    return {
      plugin: {
        status: "failed",
        name: plugin,
        reasons: [] as const,
        cause: new Error(
          `setPluginEnabled: internal error -- guard returned cleanly without populating outcome for plugin "${plugin}".`,
        ),
      },
    };
  }

  switch (outcome.kind) {
    case "invalid-config":
      return {
        plugin: {
          status: "failed",
          name: plugin,
          reasons: ["invalid manifest"] as const,
          cause: new Error(`Config file "${configBasename}" failed schema validation.`),
        },
      };
    case "not-recorded":
      return {
        plugin: {
          status: "failed",
          name: plugin,
          reasons: ["not in manifest"] as const,
        },
      };
    case "idempotent": {
      const reason: ContentReason = enable ? "already enabled" : "already disabled";
      return {
        plugin: {
          status: "skipped",
          name: plugin,
          reasons: [reason],
        },
      };
    }

    case "enable-failed":
      return {
        plugin: {
          status: "failed",
          name: plugin,
          reasons: narrowEnableFailure(outcome.cause),
          ...(outcome.recordedVersion !== undefined && { version: outcome.recordedVersion }),
          cause: outcome.cause,
        },
      };
    case "disable-failed":
      return {
        plugin: {
          status: "failed",
          name: plugin,
          reasons: narrowDisableFailure(outcome.cause),
          ...(outcome.recordedVersion !== undefined && { version: outcome.recordedVersion }),
          cause: outcome.cause,
        },
      };
    case "fresh":
      return enable
        ? {
            mpStatus: "added",
            plugin: {
              status: "installed",
              name: plugin,
              dependencies: [],
              ...(outcome.version !== undefined && { version: outcome.version }),
            },
          }
        : {
            plugin: {
              status: "uninstalled",
              name: plugin,
              ...(outcome.version !== undefined && { version: outcome.version }),
            },
          };
  }
}

/**
 * Narrow an enable-branch failure cause to a closed Reason. ENOENT-class
 * failures surface as `source missing` (ENBL-03 missing-clone path);
 * everything else falls back to an empty array so the renderer suppresses
 * the brace and surfaces the cause-chain trailer.
 */
function narrowEnableFailure(cause: Error): readonly ContentReason[] {
  if (isErrnoException(cause) && cause.code === "ENOENT") {
    return ["source missing"];
  }

  const chained = cause.cause;
  if (chained !== undefined && isErrnoException(chained) && chained.code === "ENOENT") {
    return ["source missing"];
  }

  // Defensive: an empty reasons array lets the renderer suppress the brace
  // while still surfacing the cause via the 4-space-indent trailer.
  return [];
}

/**
 * Narrow a disable-branch cascade failure to a closed Reason. Mirrors the
 * uninstall.ts `narrowCascadeFailure` taxonomy (permission denied / source
 * missing / unreadable). The full taxonomy is duplicated locally rather than
 * exported from uninstall.ts because the disable branch is structurally a
 * cascade re-use of uninstall's primitives -- the two should drift together.
 */
function narrowDisableFailure(cause: Error): readonly ContentReason[] {
  if (isErrnoException(cause)) {
    switch (cause.code) {
      case "EACCES":
      case "EPERM":
        return ["permission denied"];
      case "ENOENT":
        return ["source missing"];
      default:
        break;
    }
  }

  return ["unreadable"];
}

/** Structural predicate for `NodeJS.ErrnoException`. */
function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return (
    err instanceof Error && "code" in err && typeof (err as { code?: unknown }).code === "string"
  );
}
