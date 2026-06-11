// orchestrators/plugin/enable-disable.ts
//
// D-54-01 / ENBL-01 / ENBL-02 / ENBL-03 / ENBL-04 (Phase 54 Plan 02).
//
// Single orchestrator parameterized by `enable: boolean`. Mirrors the
// `setMarketplaceAutoupdate` shape: composes `resolveCrossScopePluginTarget`
// + `withLockedStateTransaction` (CFG-03 abort + cascadeUnstagePlugin OR the
// guard-free install ledger) + `saveConfig` + a single terminal `notify()`
// per IL-2.
//
// CR-01 (Phase 54 review) locking model: exactly ONE per-scope lock owns the
// whole critical section. The enable branch calls `runInstallLedger` (the
// guard-FREE ledger body exported by install.ts) against THIS transaction's
// state snapshot -- calling `installPlugin` here would nest a second
// `withStateGuard` on the same `stateLockFile`, and `proper-lockfile`
// (`retries: 0`) is not re-entrant, so every fresh enable would self-deadlock
// (ELOCKED -> StateLockHeldError). The single snapshot also guarantees the
// ledger's state mutation is what gets saved (no outer stale-snapshot
// clobber; ST-7 / D-06 single-writer preserved).
//
// WR-01 (Phase 54 review) save discipline: `tx.save()` fires ONLY on the
// `fresh` arms. The `invalid-config` / `idempotent` / `not-recorded` /
// `*-failed` arms return without saving, so state.json's mtime is UNCHANGED
// on every abort/no-op -- exactly what the catalog's CFG-03 states claim.
//
// NFR-5 (no network): this file MUST NOT import platform/git or DEFAULT_GIT_OPS.
// The Phase 54 Plan 01 architecture gate at
// `tests/architecture/no-orchestrator-network.test.ts` (FORBIDDEN_TARGETS) is
// armed for this file -- adding any forbidden surface fails the gate.
//
// Pitfall 54-1 / A6: `loadConfig(targetConfigPath)` runs INSIDE the locked
// transaction so a concurrent flip from another process either fails fast at
// lock acquisition or retries against the fresh post-flip state.
//
// Pitfall 54-2: this file lands in the SAME atomic commit as the
// `(disabled)` token + variant + renderer arm + catalog amendment. Any
// intermediate state would trip a drift gate (closed-set length lock,
// catalog-uat byte equality, etc.).
//
// Pitfall 54-4 / ENBL-02 version pin: the enable branch passes
// `pinVersionOverride: installed.version` to `runInstallLedger` so the
// install ledger does NOT call `resolvePluginVersion` (which could bump the
// version if `plugin.json` or the marketplace entry drifted between disable
// and enable). The cached marketplace manifest read happens inside the
// ledger via `loadMarketplaceManifest(` -- the cached PI-2 read, never the
// network.
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

import { loadConfig } from "../../persistence/config-io.ts";
import { writeBatchedConfigEntries } from "../../persistence/config-write-back.ts";
import { errorMessage, MarketplaceNotFoundError, StateLockHeldError } from "../../shared/errors.ts";
import { notify } from "../../shared/notify.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
import { cascadeUnstagePlugin } from "../marketplace/shared.ts";

import { runInstallLedger } from "./install.ts";
import { resolveCrossScopePluginTarget, synthesizeUndeclaredMarketplaceSource } from "./shared.ts";

import type { ScopeConfig } from "../../persistence/config-io.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { ContentReason, PluginNotificationMessage, Reason } from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * RECON-03 (Phase 55 Plan 01): controls how `setPluginEnabled` surfaces
 * notifications. Mirrors `AddMarketplaceNotifications`.
 *
 * - `"standalone"` (default when option is omitted): byte-identical to today.
 * - `"orchestrated"`: suppresses every `ctx.ui.notify` call and returns the
 *   typed `EnableDisablePluginOutcome` for `applyReconcile` (Plan 02).
 */
export type EnableDisablePluginNotifications =
  | { readonly mode: "standalone" }
  | { readonly mode: "orchestrated" };

/**
 * RECON-03: discriminated outcome returned by `setPluginEnabled` in
 * orchestrated mode.
 *
 * - `"enabled"` -- the enable branch re-materialized the plugin.
 * - `"disabled"` -- the disable branch cascaded-unstaged the artefacts and
 *   reset `resources.*` while preserving the state record.
 * - `"skipped"` -- the idempotent already-enabled / already-disabled arm.
 *   The `reason` carries the standalone benign Reason for parity with the
 *   standalone rendering token set.
 * - `"failed"` -- enable / disable / not-recorded / invalid-config /
 *   marketplace-not-added paths. `reason` typed `Reason` so the
 *   structural `"not added"` sentinel can flow through the same field.
 */
export type EnableDisablePluginOutcome =
  | { readonly status: "enabled"; readonly name: string; readonly version?: string }
  | { readonly status: "disabled"; readonly name: string; readonly version?: string }
  | {
      readonly status: "skipped";
      readonly name: string;
      readonly reason: "already enabled" | "already disabled" | "not installed";
    }
  | {
      readonly status: "failed";
      readonly reason: Reason;
      readonly error: Error;
      readonly cause: string;
    };

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
  /**
   * RECON-03 (Phase 55 Plan 01): notification mode selector. Omitted
   * (undefined) === `{ mode: "standalone" }` -- byte-identical to today.
   */
  readonly notifications?: EnableDisablePluginNotifications;
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
 * Run the enable branch: invoke the guard-FREE `runInstallLedger` against the
 * OUTER transaction's state snapshot with the pinned version override
 * (Pitfall 54-4) and `allowExistingRecord: true` (the disabled record is
 * deliberately KEPT per ENBL-02, so the PI-15 "already installed" sanity
 * throw must not fire for the re-materialization). Returns the outcome
 * sentinel.
 *
 * CR-01: `installPlugin` MUST NOT be called here -- it opens its own
 * `withStateGuard` on the same `stateLockFile`, and `proper-lockfile`
 * (`retries: 0`) is not re-entrant, so the nested acquisition would throw
 * `StateLockHeldError` and every fresh enable would fail.
 */
async function runEnableBranch(
  opts: EnableDisablePluginOptions,
  scope: Scope,
  locations: ScopedLocations,
  state: ExtensionState,
  recordedVersion: string,
): Promise<SetEnabledOutcome> {
  try {
    const result = await runInstallLedger(state, locations, {
      scope,
      cwd: opts.cwd,
      marketplace: opts.marketplace,
      plugin: opts.plugin,
      pinVersionOverride: recordedVersion,
      allowExistingRecord: true,
    });
    if (result.kind === "marketplace-absent") {
      // Defensive: the caller already verified the marketplace container is
      // recorded in this scope's state, so the CMP-2..4 source resolution
      // should never miss. Surface a failed row rather than wedging.
      return {
        kind: "enable-failed",
        cause: new Error(`Marketplace "${opts.marketplace}" is not added in the ${scope} scope.`),
        recordedVersion,
      };
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
 *
 * WR-04: parameters carry the REAL types (`ScopedLocations` and the state
 * record shape) so the `cascadeUnstagePlugin` call type-checks without
 * casts -- an argument-order swap or a schema field rename is a COMPILE
 * error here, not a runtime corruption.
 */
async function runDisableBranch(
  opts: EnableDisablePluginOptions,
  locations: ScopedLocations,
  installed: InstalledPluginRecord,
): Promise<SetEnabledOutcome> {
  const recordedVersion = installed.version;
  const cascade = await cascadeUnstagePlugin(opts.plugin, opts.marketplace, locations, installed);
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

/**
 * WR-04: the REAL state-record shape (the exact type
 * `cascadeUnstagePlugin` requires), aliased for readability. No local
 * structural mirror -- a schema field rename surfaces as a compile error in
 * this module instead of being silenced by an `as never` cast.
 */
type InstalledPluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

/**
 * D-54-01 entrypoint. Never re-throws -- every failure surfaces through a
 * single `notify()` call per IL-2 (standalone) OR a typed outcome per
 * RECON-03 (orchestrated).
 */
export async function setPluginEnabled(
  opts: EnableDisablePluginOptions,
): Promise<EnableDisablePluginOutcome | undefined> {
  const { ctx, pi, cwd, marketplace, plugin, enable } = opts;
  const orchestrated = opts.notifications?.mode === "orchestrated";

  // SCOPE-01 / ATTR-04: resolve the cross-scope target.
  const resolution = await resolveCrossScopePluginTarget({
    cwd,
    marketplace,
    plugin,
    ...(opts.scope !== undefined && { explicitScope: opts.scope }),
  });

  if (resolution.kind === "marketplace-absent" || resolution.kind === "other-scope") {
    const requestedScope: Scope | undefined = resolution.requestedScope;
    if (orchestrated) {
      const scopeList: readonly Scope[] =
        requestedScope === undefined ? ["project", "user"] : [requestedScope];
      const err = new MarketplaceNotFoundError(marketplace, scopeList);
      return {
        status: "failed",
        reason: "not added",
        error: err,
        cause: errorMessage(err),
      };
    }

    // M3 / M4: standalone `MarketplaceNotAddedMessage` per D-47-A.
    notify(ctx, pi, {
      kind: "marketplace-not-added",
      name: marketplace,
      ...(requestedScope !== undefined && { scope: requestedScope }),
    });
    return undefined;
  }

  const { scope, locations } = resolution;
  const targetConfigPath =
    opts.local === true ? locations.configLocalJsonPath : locations.configJsonPath;
  const configBasename = path.basename(targetConfigPath);

  let outcome: SetEnabledOutcome | undefined;

  try {
    // CR-01 / WR-01: a single per-scope lock owns the whole critical section.
    await withLockedStateTransaction(locations, async (tx) => {
      const state = tx.state;
      const cfg = await loadConfig(targetConfigPath);
      if (cfg.status === "invalid") {
        outcome = { kind: "invalid-config" };
        return;
      }

      const mp = state.marketplaces[marketplace];
      const installed = mp?.plugins[plugin];
      if (mp === undefined || installed === undefined) {
        outcome = { kind: "not-recorded" };
        return;
      }

      // ENBL-02 idempotency: empty-resources + installable:true marker.
      if (isCurrentlyDisabled(installed) === !enable) {
        // WR-03 (Phase 56 review): state-side truth alone is not enough.
        // When the targeted config carries the OPPOSITE EXPLICIT `enabled`
        // value (hand-edited config, or base/local divergence pending
        // reconcile), skipping here would leave the config diverged -- and
        // the next reconcile would apply the config side and INVERT the
        // user's explicit command. Mirror autoupdate's
        // `reclassifyByConfigTruth` promotion: the flip is fresh for the
        // CONFIG write even though the state side already matches (state
        // untouched -- no tx.save(), mtime stable). A MISSING entry /
        // missing `enabled` field keeps the state-side classification
        // as-is, exactly like the autoupdate analog.
        const current: ScopeConfig = cfg.status === "valid" ? cfg.config : { schemaVersion: 1 };
        const configEnabled = current.plugins?.[`${plugin}@${marketplace}`]?.enabled;
        if (!orchestrated && configEnabled !== undefined && configEnabled !== enable) {
          const adoptedSource = synthesizeUndeclaredMarketplaceSource(current, state, marketplace);
          await writeBatchedConfigEntries(current, targetConfigPath, locations.scopeRoot, {
            ...(adoptedSource !== undefined && {
              marketplaces: { [marketplace]: { source: adoptedSource } },
            }),
            plugins: { [`${plugin}@${marketplace}`]: { enabled: enable } },
          });
          outcome = { kind: "fresh", version: installed.version };
          return;
        }

        outcome = { kind: "idempotent" };
        return;
      }

      outcome = enable
        ? await runEnableBranch(opts, scope, locations, state, installed.version)
        : await runDisableBranch(opts, locations, installed);

      if (outcome.kind !== "fresh") {
        return;
      }

      // Config write-back via the SOLE sanctioned saveConfig seam (SPLIT-02).
      //
      // WR-09 (Phase 55 review): SKIPPED in orchestrated mode. A
      // reconcile-driven call derives the desired state FROM the merged
      // config (base + local), so the declaration already exists by
      // construction -- possibly ONLY in `claude-plugins.local.json` (the
      // per-machine override, Pitfall 54-5). Writing it back here would
      // copy the local override's `enabled` flag into the shared BASE file
      // and clobber a user-authored base declaration. The config is the
      // reconcile's INPUT; only standalone commands author declarations.
      // CR-02 (Phase 56 review): when the targeted config does not declare
      // the marketplace (CMP-3 clone-adoption legacy, or a hand-pruned
      // config), declare it in the SAME batched patch -- a bare plugin key
      // would otherwise be a dangling declaration the planner converts into
      // a marketplace removal + perpetual failed row.
      if (!orchestrated) {
        const current: ScopeConfig = cfg.status === "valid" ? cfg.config : { schemaVersion: 1 };
        const adoptedSource = synthesizeUndeclaredMarketplaceSource(current, state, marketplace);
        await writeBatchedConfigEntries(current, targetConfigPath, locations.scopeRoot, {
          ...(adoptedSource !== undefined && {
            marketplaces: { [marketplace]: { source: adoptedSource } },
          }),
          plugins: { [`${plugin}@${marketplace}`]: { enabled: enable } },
        });
      }

      await tx.save();
    });
  } catch (err) {
    const cause = err instanceof Error ? err : new Error(errorMessage(err));
    if (orchestrated) {
      return {
        status: "failed",
        reason: classifyTransactionThrow(cause),
        error: cause,
        cause: errorMessage(cause),
      };
    }

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
    return undefined;
  }

  if (orchestrated) {
    return outcomeToTypedResult({ plugin, enable, outcome, configBasename });
  }

  dispatchOutcome({ ctx, pi, marketplace, scope, plugin, enable, configBasename, outcome });
  return undefined;
}

/**
 * WR-04 (Phase 55 review): closed-set reason for an orchestrated transaction
 * throw. The transaction body also runs loadConfig, writeConfigEntry /
 * saveConfig, and tx.save() -- an EACCES on the config write or a disk-full
 * on state save is NOT a lock conflict. Only a genuine StateLockHeldError
 * may render `{lock held}`; other throws narrow through the same errno
 * ladder the standalone disable arm uses (permission denied / source
 * missing / unreadable).
 */
function classifyTransactionThrow(cause: Error): Reason {
  return cause instanceof StateLockHeldError
    ? "lock held"
    : (narrowDisableFailure(cause)[0] ?? "unreadable");
}

/**
 * RECON-03: map the internal `SetEnabledOutcome` sentinel to the typed
 * `EnableDisablePluginOutcome` for orchestrated callers. Mirrors the
 * standalone `composeOutcomeRow` taxonomy.
 */
function outcomeToTypedResult(args: {
  plugin: string;
  enable: boolean;
  configBasename: string;
  outcome: SetEnabledOutcome | undefined;
}): EnableDisablePluginOutcome {
  const { plugin, enable, configBasename, outcome } = args;
  if (outcome === undefined) {
    const err = new Error(
      `setPluginEnabled: internal error -- guard returned cleanly without populating outcome for plugin "${plugin}".`,
    );
    return { status: "failed", reason: "unreadable", error: err, cause: errorMessage(err) };
  }

  switch (outcome.kind) {
    case "invalid-config": {
      const err = new Error(`Config file "${configBasename}" failed schema validation.`);
      return { status: "failed", reason: "invalid manifest", error: err, cause: errorMessage(err) };
    }

    case "not-recorded": {
      return { status: "skipped", name: plugin, reason: "not installed" };
    }

    case "idempotent": {
      return {
        status: "skipped",
        name: plugin,
        reason: enable ? "already enabled" : "already disabled",
      };
    }

    case "enable-failed": {
      return {
        status: "failed",
        reason: narrowEnableFailure(outcome.cause)[0] ?? "unreadable",
        error: outcome.cause,
        cause: errorMessage(outcome.cause),
      };
    }

    case "disable-failed": {
      return {
        status: "failed",
        reason: narrowDisableFailure(outcome.cause)[0] ?? "unreadable",
        error: outcome.cause,
        cause: errorMessage(outcome.cause),
      };
    }

    case "fresh": {
      return enable
        ? {
            status: "enabled",
            name: plugin,
            ...(outcome.version !== undefined && { version: outcome.version }),
          }
        : {
            status: "disabled",
            name: plugin,
            ...(outcome.version !== undefined && { version: outcome.version }),
          };
    }
  }
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
      // WR-03: the marketplace container is PRESENT but the plugin row is
      // absent from state.json (never installed, or concurrently
      // uninstalled). The established taxonomy (ATTR-08, reinstall/update
      // precedent) reserves `{not in manifest}` for "plugin absent from a
      // PRESENT manifest" and uses `(skipped) {not installed}` for
      // "marketplace present, plugin not installed". Non-benign reason ->
      // warning severity (catalog `enable-not-installed` state).
      return {
        plugin: {
          status: "skipped",
          name: plugin,
          reasons: ["not installed"] as const,
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
