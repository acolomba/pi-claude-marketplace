import assert from "node:assert/strict";
import test from "node:test";

import {
  isScopeBearingListRow,
  pluginScopeOrFallback,
  pluginVersion,
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
  "data kept",
  "no matching version",
  "version conflict",
  "constraint too complex",
  "invalid version constraint",
  "dependency marketplace not added",
  "dependency cycle",
  "dependency failed",
  "dependency disabled",
  "dependency promoted",
  "dependency pruned",
  "dependency unsatisfied",
  "dependency version unsatisfied",
  "dependents unsatisfied",
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

test("pluginScopeOrFallback returns row scope when present on scope-bearing row", () => {
  const row = {
    status: "installed",
    name: "alpha",
    version: "1.0.0",
    dependencies: [],
    severity: "info",
    needsReload: false,
    scope: "project",
  } satisfies PluginNotificationMessage;
  assert.equal(pluginScopeOrFallback(row, "user"), "project");
});

test("pluginScopeOrFallback falls back to marketplace scope when scope absent on scope-bearing row", () => {
  const row = {
    status: "installed",
    name: "alpha",
    version: "1.0.0",
    dependencies: [],
    severity: "info",
    needsReload: false,
  } satisfies PluginNotificationMessage;
  assert.equal(pluginScopeOrFallback(row, "user"), "user");
});

test("pluginScopeOrFallback falls back to marketplace scope for non-scope-bearing row", () => {
  const row = {
    status: "available",
    name: "alpha",
  } satisfies PluginNotificationMessage;
  assert.equal(pluginScopeOrFallback(row, "project"), "project");
});

test("pluginVersion returns version when present on supported row", () => {
  const row = {
    status: "installed",
    name: "alpha",
    version: "1.2.3",
    dependencies: [],
    severity: "info",
    needsReload: false,
  } satisfies PluginNotificationMessage;
  assert.equal(pluginVersion(row), "1.2.3");
});

test("pluginVersion returns target version on updated row", () => {
  const row = {
    status: "updated",
    name: "alpha",
    from: "1.0.0",
    to: "2.0.0",
    dependencies: [],
    severity: "info",
    needsReload: false,
  } satisfies PluginNotificationMessage;
  assert.equal(pluginVersion(row), "2.0.0");
});

test("pluginVersion handles each status arm", () => {
  const cases: readonly PluginNotificationMessage[] = [
    {
      status: "installed",
      name: "a",
      version: "1.0",
      dependencies: [],
      severity: "info",
      needsReload: false,
    },
    {
      status: "reinstalled",
      name: "a",
      version: "1.0",
      dependencies: [],
      severity: "info",
      needsReload: false,
    },
    { status: "uninstalled", name: "a", version: "1.0", severity: "info", needsReload: false },
    { status: "disabled", name: "a", version: "1.0", severity: "info", needsReload: false },
    { status: "available", name: "a", version: "1.0" },
    { status: "remote", name: "a", version: "1.0" },
    { status: "unavailable", name: "a", version: "1.0", reasons: [] },
    { status: "partially-available", name: "a", version: "1.0", reasons: [] },
    { status: "upgradable", name: "a", version: "1.0", reasons: [] },
    {
      status: "partially-installed",
      name: "a",
      version: "1.0",
      reasons: [],
      severity: "info",
      needsReload: false,
    },
    { status: "partially-upgradable", name: "a", version: "1.0", reasons: [] },
    { status: "failed", name: "a", version: "1.0", reasons: [], severity: "error" },
    { status: "skipped", name: "a", version: "1.0", reasons: [] },
    {
      status: "updated",
      name: "a",
      from: "1.0",
      to: "2.0",
      dependencies: [],
      severity: "info",
      needsReload: false,
    },
    { status: "manual recovery", name: "a", severity: "warning", reasons: [] },
    { status: "will install", name: "a" },
    { status: "will uninstall", name: "a" },
    { status: "will enable", name: "a" },
    { status: "will disable", name: "a" },
  ];
  for (const c of cases) {
    if (c.status === "updated") {
      assert.equal(pluginVersion(c), "2.0");
    } else if (
      c.status === "manual recovery" ||
      c.status === "will install" ||
      c.status === "will uninstall" ||
      c.status === "will enable" ||
      c.status === "will disable"
    ) {
      assert.equal(pluginVersion(c), undefined);
    } else {
      assert.equal(pluginVersion(c), "1.0");
    }
  }
});

test("pluginVersion returns undefined when version omitted on supported row", () => {
  const row = {
    status: "available",
    name: "alpha",
  } satisfies PluginNotificationMessage;
  assert.equal(pluginVersion(row), undefined);
});

test("pluginVersion returns undefined for non-versioned row statuses", () => {
  const row = {
    status: "will install",
    name: "alpha",
  } satisfies PluginNotificationMessage;
  assert.equal(pluginVersion(row), undefined);
});
