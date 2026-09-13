import assert from "node:assert/strict";
import test from "node:test";

import {
  isScopeBearingListRow,
  MARKETPLACE_STATUSES,
  PLUGIN_STATUSES,
  REASONS,
  STATUS_TOKENS,
  type ContentReason,
  type MarketplaceNotificationMessage,
  type NotificationMessage,
  type PluginInstalledMessage,
  type PluginNotificationMessage,
  type PluginSkippedMessage,
  type Severity,
} from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

const EXPECTED_REASONS = [
  "up-to-date",
  "not found",
  "already installed",
  "not installed",
  "not in manifest",
  "invalid manifest",
  "no longer installable",
  "unsupported source",
  "unsupported component",
  "unsupported hooks",
  "lsp",
  "requires pi-subagents",
  "requires pi-mcp",
  "rollback partial",
  "unreadable",
  "unparseable",
  "unreadable manifest",
  "source mismatch",
  "plugins remain",
  "concurrently uninstalled",
  "concurrently updated",
  "stale clone",
  "duplicate name",
  "lock held",
  "already autoupdate",
  "already no autoupdate",
  "already enabled",
  "already disabled",
  "permission denied",
  "source missing",
  "network unreachable",
  "marketplace not added",
  "marketplace not added to user scope",
  "marketplace not added to project scope",
  "orphan rewake",
  "authentication required",
  "dangling reference",
  "malformed mcp",
  "malformed skill",
  "malformed command",
  "installs disabled",
  "marketplace in user scope",
  "marketplace in project scope",
  "workflows",
] as const;

const EXPECTED_STATUS_TOKENS = [
  "installed",
  "updated",
  "reinstalled",
  "uninstalled",
  "added",
  "removed",
  "available",
  "unavailable",
  "upgradable",
  "skipped",
  "failed",
  "rollback failed",
  "manual recovery",
  "no marketplaces",
  "no plugins",
  "will install",
  "will uninstall",
  "will enable",
  "will disable",
  "disabled",
  "partially-installed",
  "partially-upgradable",
  "partially-available",
  "remote",
] as const;

const EXPECTED_PLUGIN_STATUSES = [
  "installed",
  "updated",
  "reinstalled",
  "uninstalled",
  "available",
  "unavailable",
  "upgradable",
  "failed",
  "skipped",
  "manual recovery",
  "will install",
  "will uninstall",
  "will enable",
  "will disable",
  "disabled",
  "partially-installed",
  "partially-upgradable",
  "partially-available",
  "remote",
] as const;

const EXPECTED_MARKETPLACE_STATUSES = [
  "added",
  "removed",
  "updated",
  "failed",
  "autoupdate enabled",
  "autoupdate disabled",
  "skipped",
] as const;

function pluginStatusIsExhaustive(message: PluginNotificationMessage): string {
  switch (message.status) {
    case "installed":
    case "updated":
    case "reinstalled":
    case "uninstalled":
    case "available":
    case "remote":
    case "unavailable":
    case "partially-available":
    case "upgradable":
    case "failed":
    case "skipped":
    case "manual recovery":
    case "will install":
    case "will uninstall":
    case "will enable":
    case "will disable":
    case "disabled":
    case "partially-installed":
    case "partially-upgradable":
      return message.status;
  }
}

function marketplaceStatusIsExhaustive(message: MarketplaceNotificationMessage): string {
  switch (message.status) {
    case "added":
    case "removed":
    case "updated":
    case "failed":
    case "autoupdate enabled":
    case "autoupdate disabled":
    case "skipped":
      return message.status;
    case undefined:
      return "list";
  }
}

function notificationKindIsExhaustive(message: NotificationMessage): string {
  switch (message.kind) {
    case "cascade":
    case undefined:
      return "cascade";
    case "marketplace-info":
    case "plugin-info":
    case "marketplace-info-cascade":
    case "plugin-info-cascade":
    case "marketplace-not-added":
    case "reconcile-pending-empty":
    case "reconcile-applied-cascade":
      return message.kind;
  }

  const exhaustive: never = message;
  return exhaustive;
}

const installedMessage = {
  status: "installed",
  name: "alpha",
  dependencies: [],
  severity: "info",
  needsReload: true,
} satisfies PluginInstalledMessage;

const skippedMessage = {
  status: "skipped",
  name: "alpha",
  reasons: ["up-to-date"],
} satisfies PluginSkippedMessage;

const contentReason: ContentReason = "marketplace in user scope";
const severity: Severity = "warning";

void pluginStatusIsExhaustive;
void marketplaceStatusIsExhaustive;
void notificationKindIsExhaustive;
void installedMessage;
void skippedMessage;
void contentReason;
void severity;

void ({
  status: "installed",
  name: "alpha",
  dependencies: [],
  severity: "info",
  // @ts-expect-error transition messages require needsReload
} satisfies PluginInstalledMessage);

void ({
  status: "skipped",
  name: "alpha",
  // @ts-expect-error skipped messages require reasons
} satisfies PluginSkippedMessage);

// @ts-expect-error structural marketplace absence is not a content reason
const structuralReason: ContentReason = "marketplace not added";
void structuralReason;

test("exports the exact notification vocabulary from its named owner", () => {
  assert.deepStrictEqual(REASONS, EXPECTED_REASONS);
  assert.deepStrictEqual(STATUS_TOKENS, EXPECTED_STATUS_TOKENS);
  assert.deepStrictEqual(PLUGIN_STATUSES, EXPECTED_PLUGIN_STATUSES);
  assert.deepStrictEqual(MARKETPLACE_STATUSES, EXPECTED_MARKETPLACE_STATUSES);
});

for (const { name, row, expected } of [
  {
    name: "recognizes an installed list row as scope-bearing",
    row: installedMessage,
    expected: true,
  },
  {
    name: "recognizes a disabled list row as scope-bearing",
    row: {
      status: "disabled",
      name: "alpha",
      severity: "info",
      needsReload: false,
    } satisfies PluginNotificationMessage,
    expected: true,
  },
  {
    name: "recognizes an available row as not scope-bearing",
    row: { status: "available", name: "alpha" } satisfies PluginNotificationMessage,
    expected: false,
  },
  {
    name: "recognizes a failed row as not list-scope-bearing",
    row: {
      status: "failed",
      name: "alpha",
      reasons: ["not found"],
      severity: "error",
      needsReload: false,
    } satisfies PluginNotificationMessage,
    expected: false,
  },
] as const) {
  test(name, () => {
    // act
    const scopeBearing = isScopeBearingListRow(row);

    // assert
    assert.equal(scopeBearing, expected);
  });
}
