import assert from "node:assert/strict";
import test from "node:test";

import {
  PENDING_CONTEXT,
  PENDING_STATUSES,
  RECONCILE_APPLIED_CONTEXT,
  type PendingMsg,
  type ReconcileAppliedMsg,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts";

import type { SoftDepStatus } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

function allSoftDependenciesLoaded(): SoftDepStatus {
  return { piMcpAdapterLoaded: true, piSubagentsLoaded: true };
}

function noSoftDependenciesLoaded(): SoftDepStatus {
  return { piMcpAdapterLoaded: false, piSubagentsLoaded: false };
}

void ({ name: "plugin", status: "will install" } satisfies PendingMsg);
void ({ name: "plugin", status: "will uninstall" } satisfies PendingMsg);
void ({ name: "plugin", status: "will enable" } satisfies PendingMsg);
void ({ name: "plugin", status: "will disable" } satisfies PendingMsg);
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

test("reconcile contexts expose their exact labels and declared render arms", () => {
  // arrange
  const expectedPendingStatuses = [
    "will install",
    "will uninstall",
    "will enable",
    "will disable",
    "failed",
  ];
  const expectedAppliedStatuses = [
    "installed",
    "uninstalled",
    "disabled",
    "failed",
    "partially-installed",
  ];

  // act
  const pendingStatuses = [...PENDING_STATUSES];
  const pendingRenderArms = Object.keys(PENDING_CONTEXT.render);
  const appliedRenderArms = Object.keys(RECONCILE_APPLIED_CONTEXT.render);

  // assert
  assert.deepEqual(pendingStatuses, expectedPendingStatuses);
  assert.deepEqual(pendingRenderArms, expectedPendingStatuses);
  assert.deepEqual(appliedRenderArms, expectedAppliedStatuses);
  assert.equal(PENDING_CONTEXT.Messaging.label, "Reconcile pending");
  assert.equal(RECONCILE_APPLIED_CONTEXT.Messaging.label, "Reconcile");
});

test("pending will-install omits optional tokens when they are absent", () => {
  // arrange
  const message = { name: "alpha", status: "will install" } as const satisfies PendingMsg;

  // act
  const rendered = PENDING_CONTEXT.render["will install"](
    message,
    allSoftDependenciesLoaded(),
    "user",
  );

  // assert
  assert.deepEqual(message, { name: "alpha", status: "will install" });
  assert.equal(rendered, "● alpha (will install)");
});

test("pending will-install renders the partial token and cross-scope bracket", () => {
  // arrange
  const message = {
    name: "alpha",
    partial: true,
    scope: "project",
    status: "will install",
  } as const satisfies PendingMsg;

  // act
  const rendered = PENDING_CONTEXT.render["will install"](
    message,
    allSoftDependenciesLoaded(),
    "user",
  );

  // assert
  assert.equal(rendered, "● alpha [project] (will partially install)");
});

test("pending will-uninstall renders its glyph and cross-scope bracket", () => {
  // arrange
  const message = {
    name: "alpha",
    scope: "user",
    status: "will uninstall",
  } as const satisfies PendingMsg;

  // act
  const rendered = PENDING_CONTEXT.render["will uninstall"](
    message,
    allSoftDependenciesLoaded(),
    "project",
  );

  // assert
  assert.equal(rendered, "○ alpha [user] (will uninstall)");
});

test("pending will-enable renders its exact row bytes", () => {
  // arrange
  const message = { name: "alpha", status: "will enable" } as const satisfies PendingMsg;

  // act
  const rendered = PENDING_CONTEXT.render["will enable"](
    message,
    allSoftDependenciesLoaded(),
    "user",
  );

  // assert
  assert.equal(rendered, "● alpha (will enable)");
});

test("pending will-disable renders its exact row bytes", () => {
  // arrange
  const message = { name: "alpha", status: "will disable" } as const satisfies PendingMsg;

  // act
  const rendered = PENDING_CONTEXT.render["will disable"](
    message,
    allSoftDependenciesLoaded(),
    "user",
  );

  // assert
  assert.equal(rendered, "◍ alpha (will disable)");
});

test("pending failed folds scope, version, and reasons while leaving cause to the envelope", () => {
  // arrange
  const cause = new Error("registry unavailable");
  const message = {
    cause,
    name: "broken",
    reasons: ["permission denied"],
    scope: "project",
    severity: "error",
    status: "failed",
    version: "1.2.3",
  } as const satisfies PendingMsg;

  // act
  const rendered = PENDING_CONTEXT.render.failed(message, noSoftDependenciesLoaded(), "user");

  // assert
  assert.equal(message.cause, cause);
  assert.equal(rendered, "⊘ broken [project] v1.2.3 (failed) {permission denied}");
});

test("applied installed omits optional row tokens when they are absent", () => {
  // arrange
  const message = {
    dependencies: [],
    name: "alpha",
    needsReload: true,
    severity: "info",
    status: "installed",
  } as const satisfies ReconcileAppliedMsg;

  // act
  const rendered = RECONCILE_APPLIED_CONTEXT.render.installed(
    message,
    allSoftDependenciesLoaded(),
    "user",
  );

  // assert
  assert.deepEqual(message, {
    dependencies: [],
    name: "alpha",
    needsReload: true,
    severity: "info",
    status: "installed",
  });
  assert.equal(rendered, "● alpha (installed)");
});

test("applied installed composes reasons and independent missing soft-dependency markers", () => {
  // arrange
  const message = {
    dependencies: ["agents", "mcp"],
    name: "alpha",
    needsReload: true,
    reasons: ["orphan rewake"],
    scope: "project",
    severity: "info",
    status: "installed",
    version: "1.2.3",
  } as const satisfies ReconcileAppliedMsg;

  // act
  const rendered = RECONCILE_APPLIED_CONTEXT.render.installed(
    message,
    noSoftDependenciesLoaded(),
    "user",
  );

  // assert
  assert.equal(
    rendered,
    "● alpha [project] v1.2.3 (installed) {orphan rewake, requires pi-subagents, requires pi-mcp}",
  );
});

test("applied uninstalled renders scope and version without soft-dependency markers", () => {
  // arrange
  const message = {
    name: "alpha",
    needsReload: true,
    scope: "project",
    severity: "info",
    status: "uninstalled",
    version: "1.2.3",
  } as const satisfies ReconcileAppliedMsg;

  // act
  const rendered = RECONCILE_APPLIED_CONTEXT.render.uninstalled(
    message,
    noSoftDependenciesLoaded(),
    "user",
  );

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
  } as const satisfies ReconcileAppliedMsg;

  // act
  const rendered = RECONCILE_APPLIED_CONTEXT.render.disabled(
    message,
    noSoftDependenciesLoaded(),
    "user",
  );

  // assert
  assert.equal(rendered, "◍ alpha [project] v1.2.3 (disabled) {not in manifest}");
});

test("applied failed renders the shared failure row and preserves its stamps", () => {
  // arrange
  const cause = new Error("registry unavailable");
  const message = {
    cause,
    name: "broken",
    needsReload: false,
    reasons: ["not found"],
    severity: "warning",
    status: "failed",
  } as const satisfies ReconcileAppliedMsg;

  // act
  const rendered = RECONCILE_APPLIED_CONTEXT.render.failed(
    message,
    noSoftDependenciesLoaded(),
    "user",
  );

  // assert
  assert.equal(message.needsReload, false);
  assert.equal(message.severity, "warning");
  assert.equal(message.cause, cause);
  assert.equal(rendered, "⊘ broken (failed) {not found}");
});

test("applied partially-installed composes reasons and missing soft-dependency markers", () => {
  // arrange
  const message = {
    dependencies: ["agents", "mcp"],
    name: "alpha",
    needsReload: true,
    reasons: ["lsp"],
    scope: "project",
    severity: "info",
    status: "partially-installed",
    version: "1.2.3",
  } as const satisfies ReconcileAppliedMsg;

  // act
  const rendered = RECONCILE_APPLIED_CONTEXT.render["partially-installed"](
    message,
    noSoftDependenciesLoaded(),
    "user",
  );

  // assert
  assert.equal(
    rendered,
    "◉ alpha [project] v1.2.3 (partially-installed) {lsp, requires pi-subagents, requires pi-mcp}",
  );
});
