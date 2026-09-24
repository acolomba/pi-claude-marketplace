import assert from "node:assert/strict";
import test from "node:test";

import {
  isScopeBearingListRow,
  pluginScopeOrFallback,
  pluginVersion,
  type ContentReason,
  type MarketplaceNotificationMessage,
  type MarketplaceStatus,
  type NotificationMessage,
  type PluginInstalledMessage,
  type PluginNotificationMessage,
  type PluginSkippedMessage,
  type PluginUpdateSkippedMessage,
  type PluginStatus,
  type Reason,
  type Severity,
  type StatusToken,
} from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

/**
 * The four closed vocabularies are declared privately by their owner and reach
 * this file only as the literal unions `Reason`, `StatusToken`, `PluginStatus`
 * and `MarketplaceStatus`. The lists below are this file's OWN hand-written
 * copies -- independent literals, never derived from the owner -- and the
 * `IsExact` proofs under them run BOTH directions. A one-sided
 * `satisfies readonly Reason[]` would accept a list missing half the members,
 * so it cannot prove no expansion and is not used here.
 */
type IsExact<Actual, Expected> = [Actual] extends [Expected]
  ? [Expected] extends [Actual]
    ? true
    : false
  : false;

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
  "dependency promoted",
  "dependency pruned",
  "dependency unsatisfied",
  "dependency version unsatisfied",
  "dependents unsatisfied",
  "dependency current copy",
  "dependency enabled",
  "dependents remain",
  "dependency installed",
  "dependents constrain",
  "cross-marketplace",
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
    case "prune-empty":
    case "prune-committed-warning":
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
const crossMarketplaceReason: ContentReason = "cross-marketplace";
const severity: Severity = "warning";

void pluginStatusIsExhaustive;
void marketplaceStatusIsExhaustive;
void notificationKindIsExhaustive;
void ({ kind: "prune-empty", scope: "user" } satisfies NotificationMessage);
// @ts-expect-error a prune empty result must name its selected scope
void ({ kind: "prune-empty" } satisfies NotificationMessage);
void ({
  kind: "prune-committed-warning",
  scope: "project",
  cause: new Error("release failed"),
} satisfies NotificationMessage);
// @ts-expect-error a committed prune warning must carry its failure cause
void ({ kind: "prune-committed-warning", scope: "project" } satisfies NotificationMessage);
void installedMessage;
void skippedMessage;
void contentReason;
void crossMarketplaceReason;
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

// UPDT-02 / D-10-11: the cause trailer is update's alone. The base skipped
// row has no slot for one, so no other producer can grow a trailer on a
// byte-frozen row.
const updateSkippedMessage = {
  status: "skipped",
  name: "alpha",
  reasons: ["dependents constrain"],
  cause: new Error('the declared ranges admit no version in common -- required by "beta@mp"'),
} satisfies PluginUpdateSkippedMessage;
void updateSkippedMessage;

void ({
  status: "skipped",
  name: "alpha",
  reasons: ["up-to-date"],
  // @ts-expect-error a base skipped row structurally excludes a failure cause
  cause: new Error("boom"),
} satisfies PluginSkippedMessage);

// @ts-expect-error structural marketplace absence is not a content reason
const structuralReason: ContentReason = "marketplace not added";
void structuralReason;

// Each public union holds EXACTLY the members its list above names. Adding a
// member to the owner's vocabulary without adding it here, or removing one,
// collapses the corresponding proof to `false` and fails the build.
void (true satisfies IsExact<Reason, (typeof EXPECTED_REASONS)[number]>);
void (true satisfies IsExact<StatusToken, (typeof EXPECTED_STATUS_TOKENS)[number]>);
void (true satisfies IsExact<PluginStatus, (typeof EXPECTED_PLUGIN_STATUSES)[number]>);
void (true satisfies IsExact<MarketplaceStatus, (typeof EXPECTED_MARKETPLACE_STATUSES)[number]>);

// Discriminating controls for the four proofs above: they assert `false`, so a
// proof that had degenerated into something always-true would fail HERE. One
// control per direction, on the largest set -- a member the union does not hold,
// and a member it holds that the list drops.
void (false satisfies IsExact<Reason, (typeof EXPECTED_REASONS)[number] | "not a reason">);
void (false satisfies IsExact<Reason, Exclude<(typeof EXPECTED_REASONS)[number], "workflows">>);
void (false satisfies IsExact<
  StatusToken,
  (typeof EXPECTED_STATUS_TOKENS)[number] | "not a token"
>);
void (false satisfies IsExact<
  PluginStatus,
  (typeof EXPECTED_PLUGIN_STATUSES)[number] | "not a status"
>);
void (false satisfies IsExact<
  MarketplaceStatus,
  (typeof EXPECTED_MARKETPLACE_STATUSES)[number] | "not a status"
>);

const VOCABULARIES: readonly {
  readonly name: string;
  readonly members: readonly string[];
}[] = [
  { name: "reason", members: EXPECTED_REASONS },
  { name: "status token", members: EXPECTED_STATUS_TOKENS },
  { name: "plugin status", members: EXPECTED_PLUGIN_STATUSES },
  { name: "marketplace status", members: EXPECTED_MARKETPLACE_STATUSES },
];

for (const { name, members } of VOCABULARIES) {
  test(`the ${name} vocabulary names every member once`, () => {
    // arrange
    const expectedDuplicates: readonly string[] = [];

    // act
    // A union deduplicates, so the proofs above cannot see a literal written
    // twice. This clause is what makes "the union holds exactly these N members"
    // a statement about N: the list is its own witness.
    const duplicates: readonly string[] = members.filter(
      (member, index) => members.indexOf(member) !== index,
    );

    // assert
    assert.deepStrictEqual(duplicates, expectedDuplicates);
  });
}

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

const pluginVersionCases: readonly {
  readonly title: string;
  readonly row: PluginNotificationMessage;
  readonly expectedVersion: string | undefined;
}[] = [
  {
    title: "returns the version field for an installed row",
    row: {
      status: "installed",
      name: "a",
      version: "1.0",
      dependencies: [],
      severity: "info",
      needsReload: false,
    },
    expectedVersion: "1.0",
  },
  {
    title: "returns the version field for a reinstalled row",
    row: {
      status: "reinstalled",
      name: "a",
      version: "1.0",
      dependencies: [],
      severity: "info",
      needsReload: false,
    },
    expectedVersion: "1.0",
  },
  {
    title: "returns the version field for an uninstalled row",
    row: { status: "uninstalled", name: "a", version: "1.0", severity: "info", needsReload: false },
    expectedVersion: "1.0",
  },
  {
    title: "returns the version field for a disabled row",
    row: { status: "disabled", name: "a", version: "1.0", severity: "info", needsReload: false },
    expectedVersion: "1.0",
  },
  {
    title: "returns the version field for an available row",
    row: { status: "available", name: "a", version: "1.0" },
    expectedVersion: "1.0",
  },
  {
    title: "returns the version field for a remote row",
    row: { status: "remote", name: "a", version: "1.0" },
    expectedVersion: "1.0",
  },
  {
    title: "returns the version field for an unavailable row",
    row: { status: "unavailable", name: "a", version: "1.0", reasons: [] },
    expectedVersion: "1.0",
  },
  {
    title: "returns the version field for a partially-available row",
    row: { status: "partially-available", name: "a", version: "1.0", reasons: [] },
    expectedVersion: "1.0",
  },
  {
    title: "returns the version field for an upgradable row",
    row: { status: "upgradable", name: "a", version: "1.0", reasons: [] },
    expectedVersion: "1.0",
  },
  {
    title: "returns the version field for a partially-installed row",
    row: {
      status: "partially-installed",
      name: "a",
      version: "1.0",
      reasons: [],
      severity: "info",
      needsReload: false,
    },
    expectedVersion: "1.0",
  },
  {
    title: "returns the version field for a partially-upgradable row",
    row: { status: "partially-upgradable", name: "a", version: "1.0", reasons: [] },
    expectedVersion: "1.0",
  },
  {
    title: "returns the version field for a failed row",
    row: { status: "failed", name: "a", version: "1.0", reasons: [], severity: "error" },
    expectedVersion: "1.0",
  },
  {
    title: "returns the version field for a skipped row",
    row: { status: "skipped", name: "a", version: "1.0", reasons: [] },
    expectedVersion: "1.0",
  },
  {
    title: "returns the target version for an updated row",
    row: {
      status: "updated",
      name: "a",
      from: "1.0",
      to: "2.0",
      dependencies: [],
      severity: "info",
      needsReload: false,
    },
    expectedVersion: "2.0",
  },
  {
    title: "returns undefined for a manual recovery row",
    row: { status: "manual recovery", name: "a", severity: "warning", reasons: [] },
    expectedVersion: undefined,
  },
  {
    title: "returns undefined for a will-install row",
    row: { status: "will install", name: "a" },
    expectedVersion: undefined,
  },
  {
    title: "returns undefined for a will-uninstall row",
    row: { status: "will uninstall", name: "a" },
    expectedVersion: undefined,
  },
  {
    title: "returns undefined for a will-enable row",
    row: { status: "will enable", name: "a" },
    expectedVersion: undefined,
  },
  {
    title: "returns undefined for a will-disable row",
    row: { status: "will disable", name: "a" },
    expectedVersion: undefined,
  },
];

for (const { title, row, expectedVersion } of pluginVersionCases) {
  test(title, () => {
    // act
    const version = pluginVersion(row);

    // assert
    assert.equal(version, expectedVersion);
  });
}

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
