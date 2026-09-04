/**
 * tests/architecture/notify-stamp-coverage.test.ts -- GATE-01 / D-05
 * cross-projection backstop for required severity and reload stamps.
 *
 * Command render-map owners prove their row bytes directly. This suite keeps
 * the distinct architectural invariant: reconcile projections that accumulate
 * rows through the broad notification union must still stamp every realized
 * transition and failure.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReconcileAppliedCascade,
  buildReconcilePendingNotification,
} from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts";

import type { PerEntryOutcome } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts";
import type { ReconcilePlan } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import type {
  CascadeNotificationMessage,
  PluginStatus,
  ReconcileAppliedCascadeMessage,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";

const transitionStatusList = [
  "disabled",
  "installed",
  "partially-installed",
  "reinstalled",
  "uninstalled",
  "updated",
] as const satisfies readonly PluginStatus[];

function appliedOutcomes(): readonly PerEntryOutcome[] {
  return [
    { kind: "mp-added", marketplace: "fresh-mp", scope: "user" },
    {
      dependencies: [],
      kind: "plugin-installed",
      marketplace: "fresh-mp",
      plugin: "new-plugin",
      scope: "user",
      version: "1.0.0",
    },
    {
      kind: "plugin-uninstalled",
      marketplace: "fresh-mp",
      plugin: "gone-plugin",
      scope: "user",
      version: "0.9.0",
    },
    {
      kind: "plugin-enabled",
      marketplace: "fresh-mp",
      plugin: "rewoken-plugin",
      scope: "user",
      version: "2.1.0",
    },
    {
      kind: "plugin-disabled",
      marketplace: "fresh-mp",
      plugin: "muted-plugin",
      scope: "user",
      version: "3.0.0",
    },
    {
      kind: "plugin-install-failed",
      marketplace: "fresh-mp",
      plugin: "broken-plugin",
      reason: "network unreachable",
      scope: "user",
    },
    {
      kind: "plugin-uninstall-failed",
      marketplace: "fresh-mp",
      plugin: "stuck-plugin",
      reason: "permission denied",
      scope: "user",
    },
    {
      kind: "plugin-enable-failed",
      marketplace: "fresh-mp",
      plugin: "wedged-plugin",
      reason: "invalid manifest",
      scope: "user",
    },
    {
      kind: "plugin-disable-failed",
      marketplace: "fresh-mp",
      plugin: "pinned-plugin",
      reason: "permission denied",
      scope: "user",
    },
    {
      dependencies: [],
      installable: false,
      kind: "plugin-backfilled",
      marketplace: "fresh-mp",
      plugin: "partial-plugin",
      scope: "user",
      unsupported: ["lspServers"],
      version: "1.2.0",
    },
  ];
}

function pendingPlan(): ReconcilePlan {
  return {
    marketplacesToAdd: [
      {
        configSource: "base",
        marketplace: "pending-mp",
        scope: "user",
        source: "owner/repo",
      },
    ],
    marketplacesToRemove: [],
    pluginsToDisable: [{ marketplace: "pending-mp", plugin: "sleepable-plugin", scope: "user" }],
    pluginsToEnable: [{ marketplace: "pending-mp", plugin: "wakeable-plugin", scope: "user" }],
    pluginsToInstall: [
      {
        configSource: "base",
        marketplace: "pending-mp",
        plugin: "soon-plugin",
        scope: "user",
      },
    ],
    pluginsToUninstall: [{ marketplace: "pending-mp", plugin: "doomed-plugin", scope: "user" }],
    scope: "user",
    sourceMismatches: [],
  };
}

function isTransitionStatus(status: PluginStatus): boolean {
  return transitionStatusList.some((transitionStatus) => transitionStatus === status);
}

function rows(
  message: CascadeNotificationMessage | ReconcileAppliedCascadeMessage,
): CascadeNotificationMessage["marketplaces"][number]["plugins"] {
  return message.marketplaces.flatMap((marketplace) => marketplace.plugins);
}

test("GATE-01/D-05: applied projection stamps every realized-transition row", () => {
  // arrange
  const outcomes = appliedOutcomes();

  // act
  const message = buildReconcileAppliedCascade(outcomes);
  const stamps = rows(message)
    .filter((plugin) => isTransitionStatus(plugin.status))
    .map(({ name, needsReload, severity, status }) => ({
      name,
      needsReload,
      severity,
      status,
    }));

  // assert
  assert.deepEqual(stamps, [
    { name: "new-plugin", needsReload: true, severity: "info", status: "installed" },
    { name: "gone-plugin", needsReload: true, severity: "info", status: "uninstalled" },
    { name: "rewoken-plugin", needsReload: true, severity: "info", status: "installed" },
    { name: "muted-plugin", needsReload: true, severity: "info", status: "disabled" },
    {
      name: "partial-plugin",
      needsReload: true,
      severity: "info",
      status: "partially-installed",
    },
  ]);
});

test("GATE-01/D-06: applied projection stamps every failed row", () => {
  // arrange
  const outcomes = appliedOutcomes();

  // act
  const message = buildReconcileAppliedCascade(outcomes);
  const stamps = rows(message)
    .filter((plugin) => plugin.status === "failed")
    .map(({ name, needsReload, severity, status }) => ({
      name,
      needsReload,
      severity,
      status,
    }));

  // assert
  assert.deepEqual(stamps, [
    { name: "broken-plugin", needsReload: false, severity: "error", status: "failed" },
    { name: "stuck-plugin", needsReload: false, severity: "error", status: "failed" },
    { name: "wedged-plugin", needsReload: false, severity: "error", status: "failed" },
    { name: "pinned-plugin", needsReload: false, severity: "error", status: "failed" },
  ]);
});

test("GATE-01/D-05: pending projection emits no realized-transition row", () => {
  // arrange
  const plans = [pendingPlan()];

  // act
  const message = buildReconcilePendingNotification(plans);
  const transitionRows = rows(message).filter((plugin) => isTransitionStatus(plugin.status));

  // assert
  assert.deepEqual(transitionRows, []);
});
