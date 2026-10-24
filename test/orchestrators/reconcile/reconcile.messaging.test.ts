import assert from "node:assert/strict";
import test from "node:test";

import {
  composeLayerMarketplaceCause,
  PENDING_CONTEXT,
  RECONCILE_APPLIED_CONTEXT,
  type PendingMsg,
  type ReconcileAppliedMsg,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts";
import { composePluginLines } from "../../../extensions/pi-claude-marketplace/shared/notification-grammar.ts";
import { resolveRows } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";

import type * as ReconcileMessaging from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts";
import type { ResolvedRow } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";

test("applied uninstall suppresses content while preserving the optional version", () => {
  // arrange
  const rows = [
    {
      name: "official",
      scope: "user",
      plugins: [
        {
          status: "uninstalled",
          name: "alpha",
          version: "1.0.0",
          reasons: ["lsp"],
          severity: "info",
          needsReload: true,
        },
      ],
    },
  ] as const;

  // act
  const resolved = resolveRows(
    rows,
    runWithNothingLoaded().softDeps,
    RECONCILE_APPLIED_CONTEXT.rowPolicies,
  );
  const lines = composePluginLines(resolved[0]!.plugins[0]!, "user");

  // assert
  assert.deepStrictEqual(resolved[0]!.plugins, [
    {
      status: "uninstalled",
      name: "alpha",
      version: "1.0.0",
      reasons: [],
      severity: "info",
      needsReload: true,
    },
  ]);
  assert.deepStrictEqual(lines, ["  ○ alpha v1.0.0 (uninstalled)"]);
});

// Both status sets are private literal unions; each row policy map is pinned
// to its own with `as const satisfies CommandContext<...>`, so a status without
// a policy is a TS2741 compile error and the policy keys asserted below are the
// exact set. Restoring the export makes the `satisfies` resolve and turns the
// directive below into an unused one (TS2578).
// @ts-expect-error reconcile.messaging.ts does not expose the pending status set
void ({} satisfies { readonly retired?: typeof ReconcileMessaging.PENDING_STATUSES });

void ({ name: "plugin", status: "will install" } satisfies PendingMsg);
void ({ name: "plugin", status: "will uninstall" } satisfies PendingMsg);
void ({ name: "plugin", status: "will enable" } satisfies PendingMsg);
void ({ name: "plugin", status: "will disable" } satisfies PendingMsg);
void ({ name: "plugin", status: "will update", from: "1.0.0", to: "1.1.0" } satisfies PendingMsg);
void ({
  name: "plugin",
  reasons: ["dependents constrain"],
  cause: new Error("held"),
  status: "skipped",
} satisfies PendingMsg);
void ({
  name: "plugin",
  reasons: ["unsupported component"],
  status: "partially-upgradable",
} satisfies PendingMsg);
void ({
  name: "plugin",
  reasons: ["not found"],
  severity: "error",
  status: "failed",
} satisfies PendingMsg);

void ({
  dependencies: [],
  name: "plugin",
  needsReload: true,
  severity: "info",
  status: "installed",
} satisfies ReconcileAppliedMsg);
void ({
  name: "plugin",
  needsReload: true,
  severity: "info",
  status: "uninstalled",
} satisfies ReconcileAppliedMsg);
void ({
  name: "plugin",
  needsReload: true,
  severity: "info",
  status: "disabled",
} satisfies ReconcileAppliedMsg);
void ({
  name: "plugin",
  reasons: ["not found"],
  severity: "error",
  status: "failed",
} satisfies ReconcileAppliedMsg);
void ({
  name: "plugin",
  reasons: ["lsp"],
  status: "partially-installed",
} satisfies ReconcileAppliedMsg);

// @ts-expect-error -- pending rows cannot use an applied status.
void ({ name: "plugin", status: "installed" } satisfies PendingMsg);
// @ts-expect-error -- failed rows require severity and reasons.
void ({ name: "plugin", status: "failed" } satisfies PendingMsg);
// @ts-expect-error -- applied rows cannot use a pending status.
void ({ name: "plugin", status: "will install" } satisfies ReconcileAppliedMsg);

test("reconcile contexts expose their exact labels and row policy statuses", () => {
  // arrange
  const expectedPendingStatuses = [
    "will install",
    "will uninstall",
    "will enable",
    "will disable",
    "will update",
    "skipped",
    "partially-upgradable",
    "failed",
  ];
  const expectedAppliedStatuses = [
    "installed",
    "partially-installed",
    "uninstalled",
    "disabled",
    "failed",
  ];

  // act
  const pendingPolicyStatuses = Object.keys(PENDING_CONTEXT.rowPolicies);
  const appliedPolicyStatuses = Object.keys(RECONCILE_APPLIED_CONTEXT.rowPolicies);

  // assert
  assert.deepStrictEqual(pendingPolicyStatuses, expectedPendingStatuses);
  assert.deepStrictEqual(appliedPolicyStatuses, expectedAppliedStatuses);
  assert.equal(PENDING_CONTEXT.Messaging.label, "Reconcile pending");
  assert.equal(RECONCILE_APPLIED_CONTEXT.Messaging.label, "Reconcile");
});

test("pending will-install omits optional tokens when they are absent", () => {
  // arrange
  const message = {
    name: "alpha",
    status: "will install",
    reasons: [],
  } as const satisfies ResolvedRow<PendingMsg>;

  // act
  const rendered = composePluginLines(message, "user")[0]!.slice(2);

  // assert
  assert.equal(rendered, "● alpha (will install)");
});

test("pending will-install renders the partial token and cross-scope bracket", () => {
  // arrange
  const message = {
    name: "alpha",
    partial: true,
    scope: "project",
    status: "will install",
    reasons: [],
  } as const satisfies ResolvedRow<PendingMsg>;

  // act
  const rendered = composePluginLines(message, "user")[0]!.slice(2);

  // assert
  assert.equal(rendered, "● alpha [project] (will partially install)");
});

test("pending will-uninstall renders its glyph and cross-scope bracket", () => {
  // arrange
  const message = {
    name: "alpha",
    scope: "user",
    status: "will uninstall",
    reasons: [],
  } as const satisfies ResolvedRow<PendingMsg>;

  // act
  const rendered = composePluginLines(message, "project")[0]!.slice(2);

  // assert
  assert.equal(rendered, "○ alpha [user] (will uninstall)");
});

test("pending will-enable renders its exact row bytes", () => {
  // arrange
  const message = {
    name: "alpha",
    status: "will enable",
    reasons: [],
  } as const satisfies ResolvedRow<PendingMsg>;

  // act
  const rendered = composePluginLines(message, "user")[0]!.slice(2);

  // assert
  assert.equal(rendered, "● alpha (will enable)");
});

test("pending will-disable renders its exact row bytes", () => {
  // arrange
  const message = {
    name: "alpha",
    status: "will disable",
    reasons: [],
  } as const satisfies ResolvedRow<PendingMsg>;

  // act
  const rendered = composePluginLines(message, "user")[0]!.slice(2);

  // assert
  assert.equal(rendered, "◍ alpha (will disable)");
});

test("pending will-update renders the catalog move's version arrow", () => {
  // arrange
  const message = {
    name: "alpha",
    status: "will update",
    from: "1.0.0",
    to: "1.1.0",
    reasons: [],
  } as const satisfies ResolvedRow<PendingMsg>;

  // act
  const rendered = composePluginLines(message, "user")[0]!.slice(2);

  // assert
  assert.equal(rendered, "● alpha v1.0.0 → v1.1.0 (will update)");
});

test("pending failed folds scope, version, and reasons while leaving failure detail to the envelope", () => {
  // arrange
  const failure = {
    cause: { causeChain: ["registry unavailable"], truncated: false },
    leaks: [],
    rollbackPartial: [],
  };
  const message = {
    failure,
    name: "broken",
    reasons: ["permission denied"],
    scope: "project",
    severity: "error",
    status: "failed",
    version: "1.2.3",
  } as const satisfies ResolvedRow<PendingMsg>;

  // act
  const rendered = composePluginLines(message, "user")[0]!.slice(2);

  // assert
  assert.equal(message.failure, failure);
  assert.equal(rendered, "⊘ broken [project] v1.2.3 (failed) {permission denied}");
});

test("applied installed omits optional row tokens when they are absent", () => {
  // arrange
  const message = {
    name: "alpha",
    needsReload: true,
    reasons: [],
    severity: "info",
    status: "installed",
  } as const satisfies ResolvedRow<ReconcileAppliedMsg>;

  // act
  const rendered = composePluginLines(message, "user")[0]!.slice(2);

  // assert
  assert.equal(rendered, "● alpha (installed)");
});

test("applied installed renders content reasons before the resolved markers", () => {
  // arrange
  const message = {
    name: "alpha",
    needsReload: true,
    reasons: ["orphan rewake", "requires pi-subagents", "requires pi-mcp-adapter"],
    scope: "project",
    severity: "info",
    status: "installed",
    version: "1.2.3",
  } as const satisfies ResolvedRow<ReconcileAppliedMsg>;

  // act
  const rendered = composePluginLines(message, "user")[0]!.slice(2);

  // assert
  assert.equal(
    rendered,
    "● alpha [project] v1.2.3 (installed) {orphan rewake, requires pi-subagents, requires pi-mcp-adapter}",
  );
});

test("applied uninstalled renders scope and version", () => {
  // arrange
  const message = {
    name: "alpha",
    needsReload: true,
    reasons: [],
    scope: "project",
    severity: "info",
    status: "uninstalled",
    version: "1.2.3",
  } as const satisfies ResolvedRow<ReconcileAppliedMsg>;

  // act
  const rendered = composePluginLines(message, "user")[0]!.slice(2);

  // assert
  assert.equal(rendered, "○ alpha [project] v1.2.3 (uninstalled)");
});

test("applied disabled renders optional reasons with its exact glyph", () => {
  // arrange
  const message = {
    name: "alpha",
    needsReload: true,
    reasons: ["not in manifest"],
    scope: "project",
    severity: "info",
    status: "disabled",
    version: "1.2.3",
  } as const satisfies ResolvedRow<ReconcileAppliedMsg>;

  // act
  const rendered = composePluginLines(message, "user")[0]!.slice(2);

  // assert
  assert.equal(rendered, "◍ alpha [project] v1.2.3 (disabled) {not in manifest}");
});

test("applied failed renders the shared failure row and preserves its stamps", () => {
  // arrange
  const failure = {
    cause: { causeChain: ["registry unavailable"], truncated: false },
    leaks: [],
    rollbackPartial: [],
  };
  const message = {
    failure,
    name: "broken",
    needsReload: false,
    reasons: ["not found"],
    severity: "warning",
    status: "failed",
  } as const satisfies ResolvedRow<ReconcileAppliedMsg>;

  // act
  const rendered = composePluginLines(message, "user")[0]!.slice(2);

  // assert
  assert.equal(message.needsReload, false);
  assert.equal(message.severity, "warning");
  assert.equal(message.failure, failure);
  assert.equal(rendered, "⊘ broken (failed) {not found}");
});

test("applied partially-installed renders content reasons before the resolved markers", () => {
  // arrange
  const message = {
    name: "alpha",
    needsReload: true,
    reasons: ["lsp", "requires pi-subagents", "requires pi-mcp-adapter"],
    scope: "project",
    severity: "info",
    status: "partially-installed",
    version: "1.2.3",
  } as const satisfies ResolvedRow<ReconcileAppliedMsg>;

  // act
  const rendered = composePluginLines(message, "user")[0]!.slice(2);

  // assert
  assert.equal(
    rendered,
    "◉ alpha [project] v1.2.3 (partially-installed) {lsp, requires pi-subagents, requires pi-mcp-adapter}",
  );
});

test("PENDING_CONTEXT declares complete row policies", () => {
  // act
  const policies = PENDING_CONTEXT.rowPolicies;

  // assert
  assert.deepStrictEqual(policies, {
    "will install": { markers: false, contentReasons: false },
    "will uninstall": { markers: false, contentReasons: false },
    "will enable": { markers: false, contentReasons: false },
    "will disable": { markers: false, contentReasons: false },
    "will update": { markers: false, contentReasons: true },
    skipped: { markers: false, contentReasons: true },
    "partially-upgradable": { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
  });
});

test("RECONCILE_APPLIED_CONTEXT declares complete row policies", () => {
  // act
  const policies = RECONCILE_APPLIED_CONTEXT.rowPolicies;

  // assert
  assert.deepStrictEqual(policies, {
    installed: { markers: true, contentReasons: true },
    "partially-installed": { markers: true, contentReasons: true },
    uninstalled: { markers: false, contentReasons: false },
    disabled: { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
  });
});

test("the local-layer cause names the plugin and the --local repair in its scope", () => {
  // act
  const cause = composeLayerMarketplaceCause(
    { layer: "local", keys: ["demo@fixtures"] },
    "project",
  );

  // assert
  assert.equal(
    cause,
    "The local config (claude-plugins.local.json) declares demo@fixtures, but only the base config (claude-plugins.json) declares its marketplace. Run /claude:plugin marketplace add <source> --local --scope project with the source the base config declares, or remove the plugin from the local config.",
  );
});

test("the base-layer cause names the plugins and the repair without --local in its scope", () => {
  // act
  const cause = composeLayerMarketplaceCause({ layer: "base", keys: ["a@mp", "b@mp"] }, "user");

  // assert
  assert.equal(
    cause,
    "The base config (claude-plugins.json) declares a@mp, b@mp, but only the local config (claude-plugins.local.json) declares their marketplaces. Run /claude:plugin marketplace add <source> --scope user with the source the local config declares, or remove the plugins from the base config.",
  );
});

test("the local-layer cause with two plugins uses the plural forms", () => {
  // act
  const cause = composeLayerMarketplaceCause({ layer: "local", keys: ["a@mp", "b@mp"] }, "user");

  // assert
  assert.equal(
    cause,
    "The local config (claude-plugins.local.json) declares a@mp, b@mp, but only the base config (claude-plugins.json) declares their marketplaces. Run /claude:plugin marketplace add <source> --local --scope user with the source the base config declares, or remove the plugins from the local config.",
  );
});

test("the base-layer cause with one plugin uses the singular forms", () => {
  // act
  const cause = composeLayerMarketplaceCause({ layer: "base", keys: ["demo@fixtures"] }, "project");

  // assert
  assert.equal(
    cause,
    "The base config (claude-plugins.json) declares demo@fixtures, but only the local config (claude-plugins.local.json) declares its marketplace. Run /claude:plugin marketplace add <source> --scope project with the source the local config declares, or remove the plugin from the base config.",
  );
});

test("the cause counts a plugin key that could forge the sentence", () => {
  // act
  const cause = composeLayerMarketplaceCause(
    { layer: "local", keys: ["demo. Run rm -rf ~@fixtures"] },
    "project",
  );

  // assert
  assert.equal(
    cause,
    "The local config (claude-plugins.local.json) declares 1 other plugin, but only the base config (claude-plugins.json) declares its marketplace. Run /claude:plugin marketplace add <source> --local --scope project with the source the base config declares, or remove the plugin from the local config.",
  );
});
