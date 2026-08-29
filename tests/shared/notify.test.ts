import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import { ManualRecoveryError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  compareByNameThenScope,
  composeReasons,
  composeVersionArrow,
  emitContextCascade,
  emitReconcileAppliedContextCascade,
  emitUpdateNoOpCascade,
  ICON_AVAILABLE,
  ICON_DISABLED,
  ICON_INSTALLED,
  ICON_PARTIALLY_AVAILABLE,
  ICON_PARTIALLY_INSTALLED,
  ICON_REMOTE,
  ICON_UNINSTALLABLE,
  installedLikeRow,
  isScopeBearingListRow,
  joinTokens,
  makeRawNotifyFn,
  MARKETPLACE_STATUSES,
  notify,
  notifyAsyncRewakeSummary,
  notifyDiagnostic,
  notifyStopHookOverrideCap,
  notifyUsageError,
  partiallyInstalledRow,
  PLUGIN_STATUSES,
  pluginRow,
  REASONS,
  redactAbsolutePaths,
  renderAvailableRow,
  renderDisabledRow,
  renderPartiallyAvailableRow,
  renderRemoteRow,
  renderScopeBracket,
  renderUnavailableRow,
  renderUninstalledRow,
  renderVersion,
  STATUS_TOKENS,
  type NotificationMessage,
  type PluginInfoRow,
  type PluginNotificationMessage,
  type Reason,
  type UsageErrorMessage,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";

interface NotificationContext {
  ui: { notify: ReturnType<TestContext["mock"]["fn"]> };
}

function createContext(t: TestContext): NotificationContext {
  return { ui: { notify: t.mock.fn() } };
}

interface ToolDefinition {
  name?: string;
  sourceInfo?: { source?: string };
}

interface NotificationApi {
  getAllTools: () => ToolDefinition[];
}

function piWithBothLoaded(): NotificationApi {
  return {
    getAllTools: () => [{ name: "subagent" }, { name: "mcp" }],
  };
}

function piWithSubagentsLoaded(): NotificationApi {
  return {
    getAllTools: () => [{ name: "subagent" }],
  };
}

function piWithMcpLoaded(): NotificationApi {
  return {
    getAllTools: () => [{ name: "mcp" }],
  };
}

function piWithNothingLoaded(): NotificationApi {
  return {
    getAllTools: () => [],
  };
}

function messageWithKindSequence(
  fields: Record<string, unknown>,
  kinds: readonly string[],
): Record<string, unknown> {
  let index = 0;
  return Object.defineProperty({ ...fields }, "kind", {
    enumerable: true,
    get() {
      const kind = kinds[Math.min(index, kinds.length - 1)]!;
      index++;
      return kind;
    },
  });
}

test("notify renders single installed plugin with empty deps under added marketplace (info severity + reload-hint)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "commit-commands",
            version: "1.0.0",
            dependencies: [],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
});

test("notify renders installed plugin with agents dep + probe unloaded (soft-dep marker emitted inside brace)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithMcpLoaded(); // agents NOT loaded
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "commit-commands",
            version: "1.0.0",
            dependencies: ["agents"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v1.0.0 (installed) {requires pi-subagents}\n\n/reload to pick up changes`,
  ]);
});

test("notify renders updated plugin with version arrow + mcp dep marker", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithSubagentsLoaded(); // mcp NOT loaded
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "updated",
            severity: "info",
            needsReload: true,
            name: "commit-commands",
            from: "1.0.0",
            to: "1.1.0",
            dependencies: ["mcp"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v1.0.0 → v1.1.0 (updated) {requires pi-mcp}\n\n/reload to pick up changes`,
  ]);
});

test("notify renders reinstalled plugin with both deps loaded (no soft-dep marker, empty brace suppressed)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "reinstalled",
            severity: "info",
            needsReload: true,
            name: "commit-commands",
            version: "1.0.0",
            dependencies: ["agents", "mcp"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v1.0.0 (reinstalled)\n\n/reload to pick up changes`,
  ]);
});

test("notify renders uninstalled plugin (no dependencies field, ICON_AVAILABLE)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "uninstalled",
            severity: "info",
            needsReload: true,
            name: "commit-commands",
            version: "1.0.0",
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ○ commit-commands v1.0.0 (uninstalled)\n\n/reload to pick up changes`,
  ]);
});

test("notify renders available plugin (MSG-PL-6 carve-out: NO scope bracket ever, list-surface header)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "available",
            name: "commit-commands",
            version: "1.0.0",
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user]\n  ○ commit-commands v1.0.0 (available)`,
  ]);
});

test("notify renders unavailable plugin with reasons (MSG-PL-6 carve-out: NO scope bracket)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "unavailable",
            name: "commit-commands",
            reasons: ["unsupported hooks"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user]\n  ⊘ commit-commands (unavailable) {unsupported hooks}`,
  ]);
});

test("USTAT-01 / D-64-01: notify renders unsupported plugin with the ⊖ glyph (MSG-PL-6 carve-out: NO scope bracket)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "partially-available",
            name: "hookify",
            reasons: ["unsupported hooks"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(args[0], `● demo [user]\n  ⊖ hookify (partially-available) {unsupported hooks}`);
  assert.ok((args[0] as string).includes("⊖ hookify"));
  assert.ok(!(args[0] as string).includes("⊘ hookify"));
});

test("USTAT-01 / D-64-01: notify renders unsupported plugin with version and {lsp} brace", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "partially-available",
            name: "clangd-lsp",
            version: "1.0.0",
            reasons: ["lsp"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user]\n  ⊖ clangd-lsp v1.0.0 (partially-available) {lsp}`,
  ]);
});

test("XSURF-01: unsupported install-failure row with partialHint emits the --force install trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "partially-available",
            name: "hookify",
            version: "1.0.0",
            reasons: ["unsupported hooks", "lsp"],
            severity: "error",
            partialHint: true,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args[1], "error");
  assert.equal(
    args[0],
    `A plugin operation has failed.\n\n● demo [user]\n  ⊖ hookify v1.0.0 (partially-available) {unsupported hooks, lsp}\n    Re-run with --partial to install the supported components.`,
  );
});

test("XSURF-01: unsupported row WITHOUT partialHint stays byte-frozen (no trailer)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "partially-available",
            name: "hookify",
            version: "1.0.0",
            reasons: ["unsupported hooks"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● demo [user]\n  ⊖ hookify v1.0.0 (partially-available) {unsupported hooks}`,
  );
  assert.ok(!(args[0] as string).includes("--partial"));
});

test("XSURF-03: force-upgradable update-decline row with partialHint emits the --force update trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "partially-upgradable",
            name: "clean-plugin",
            version: "1.0.0",
            reasons: ["lsp"],
            severity: "warning",
            partialHint: true,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args[1], "warning");
  assert.equal(
    args[0],
    `A plugin operation needs attention.\n\n● demo [user]\n  ● clean-plugin v1.0.0 (partially-upgradable) {lsp}\n    Re-run with --partial to update with the supported components.`,
  );
});

test("XSURF-03: list-inventory force-upgradable row WITHOUT partialHint stays byte-frozen (no trailer)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "partially-upgradable",
            name: "clean-plugin",
            version: "1.0.0",
            reasons: ["unsupported hooks"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● demo [user]\n  ● clean-plugin v1.0.0 (partially-upgradable) {unsupported hooks}`,
  );
  assert.ok(!(args[0] as string).includes("--partial"));
});

test("notify renders upgradable plugin with version and reasons brace", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "upgradable",
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["stale clone"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user]\n  ● commit-commands v1.0.0 (upgradable) {stale clone}`,
  ]);
});

test("FSTAT-02 / D-66-03: force-installed renders the ◉ glyph distinct from ● installed", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "partially-installed",
            name: "degraded-plugin",
            version: "1.0.0",
            reasons: ["unsupported hooks"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● demo [user]\n  ◉ degraded-plugin v1.0.0 (partially-installed) {unsupported hooks}`,
  );
  assert.ok((args[0] as string).includes("◉ degraded-plugin"));
  assert.ok(!(args[0] as string).includes("● degraded-plugin"));
});

test("WR-03: force-installed success row threads dependencies -> soft-dep marker fires in the SAME brace as the dropped-component reason", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithMcpLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "partially-installed",
            name: "helper",
            version: "1.0.0",
            dependencies: ["agents"],
            reasons: ["lsp"],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    `● official [user]\n  ◉ helper v1.0.0 (partially-installed) {lsp, requires pi-subagents}\n\n/reload to pick up changes`,
  );
});

test("WR-03: force-installed INVENTORY row (no dependencies) renders no soft-dep marker even when a companion is unloaded", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "partially-installed",
            name: "degraded-plugin",
            version: "1.0.0",
            reasons: ["lsp"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    `● official [user]\n  ◉ degraded-plugin v1.0.0 (partially-installed) {lsp}`,
  );
});

test("FSTAT-04 / D-66-03: force-upgradable reuses the ● glyph like the upgradable arm", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "partially-upgradable",
            name: "clean-plugin",
            version: "1.0.0",
            reasons: ["unsupported hooks"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● demo [user]\n  ● clean-plugin v1.0.0 (partially-upgradable) {unsupported hooks}`,
  );
});

test("FSTAT-06 / D-66-04: will-install force modifier renders (will partially install)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "new-mp",
        scope: "user",
        plugins: [{ status: "will install", name: "degraded-plugin", partial: true }],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(args[0], `● new-mp [user]\n  ● degraded-plugin (will partially install)`);
});

test("FSTAT-06 / D-66-04: will-install WITHOUT the force modifier renders (will install)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "new-mp",
        scope: "user",
        plugins: [{ status: "will install", name: "plain-plugin", partial: false }],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args[0], `● new-mp [user]\n  ● plain-plugin (will install)`);
});

test("notify renders benign skipped plugin with up-to-date reason (info severity, UXG-02 / D-28-06)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "skipped",
            severity: "info",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["up-to-date"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ⊘ commit-commands v1.0.0 (skipped) {up-to-date}`,
  ]);
});

test("notify renders failed plugin with reasons only -- no cause, no rollback (error severity, NO reload-hint when mp.status=failed)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "failed",
        severity: "error",
        plugins: [
          {
            status: "failed",
            severity: "error",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["network unreachable"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `Some operations have failed.\n\n⊘ demo [user] (failed)\n  ⊘ commit-commands v1.0.0 (failed) {network unreachable}`,
    "error",
  ]);
});

test("notify renders added marketplace header alone (empty plugins -> header-only body, NO reload-hint per SNM-33/D-22-01)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "demo", scope: "user", status: "added", plugins: [] }],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● demo [user] (added)`]);
});

test("notify renders removed marketplace header alone (empty plugins -> header-only, NO reload-hint per SNM-33/D-22-01, G-MIL-02)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "demo", scope: "user", status: "removed", plugins: [] }],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● demo [user] (removed)`]);
});

test("notify renders updated marketplace header alone (empty plugins -> header-only, NO reload-hint per SNM-33/D-22-01, G-MIL-06)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "demo", scope: "user", status: "updated", plugins: [] }],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● demo [user] (updated)`]);
});

test("notify renders failed marketplace header alone (empty plugins -> NO reload-hint per D-16-12; no severity because no failed plugin)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "failed",
        plugins: [],
        severity: "error",
        needsReload: false,
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `A marketplace operation has failed.\n\n⊘ demo [user] (failed)`,
    "error",
  ]);
});

test("D-48-A: bare-(failed) add `failure-unreachable` form is byte-unchanged (reasons omitted -> brace collapses)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "unreachable-mp",
        scope: "user",
        status: "failed",
        plugins: [],
        severity: "error",
        needsReload: false,
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const rendered = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `A marketplace operation has failed.\n\n⊘ unreachable-mp [user] (failed)`,
    "error",
  ]);
  assert.match(rendered, /⊘ unreachable-mp \[user\] \(failed\)$/m);
  assert.doesNotMatch(rendered, /\(failed\) \{/);
});

test("D-48-A: bare-(failed) update `mp-failure-network` header is byte-unchanged (reasons omitted -> brace collapses)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        status: "failed",
        plugins: [],
        severity: "error",
        needsReload: false,
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const rendered = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `A marketplace operation has failed.\n\n⊘ official [user] (failed)`,
    "error",
  ]);
  assert.match(rendered, /⊘ official \[user\] \(failed\)$/m);
  assert.doesNotMatch(rendered, /\(failed\) \{/);
});

test("D-48-A: a reasons-omitted failed marketplace arm renders bare `(failed)` (the third bare form; arm byte-stable)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "missing-mp",
        scope: "project",
        status: "failed",
        plugins: [],
        severity: "error",
        needsReload: false,
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const rendered = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `A marketplace operation has failed.\n\n⊘ missing-mp [project] (failed)`,
    "error",
  ]);
  assert.match(rendered, /⊘ missing-mp \[project\] \(failed\)$/m);
  assert.doesNotMatch(rendered, /\(failed\) \{/);
});

test("notify renders autoupdate enabled marketplace header alone (UXG-04 <autoupdate> marker, info severity, NO reload-hint per SNM-33/D-22-01/D-22-03)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "foo", scope: "user", status: "autoupdate enabled", plugins: [] }],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● foo [user] <autoupdate>`]);
});

test("notify renders autoupdate disabled marketplace header alone (UXG-04 <no autoupdate> off-marker, info severity, NO reload-hint per SNM-33/D-22-01/D-22-03)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "foo", scope: "user", status: "autoupdate disabled", plugins: [] }],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● foo [user] <no autoupdate>`]);
});

test("notify renders idempotent-enable marketplace header with <autoupdate> marker + reasons brace (UXG-04, info severity per UXG-02 / D-28-07, NO reload-hint per D-17.1-05)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "foo",
        scope: "user",
        status: "skipped",
        severity: "info",
        needsReload: false,
        reasons: ["already autoupdate"],
        plugins: [],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● foo [user] <autoupdate> {already autoupdate}`,
  ]);
});

test("notify severity tier mp-skipped: idempotent-disable marketplace renders <no autoupdate> + brace, computes info (benign per UXG-02 / D-28-07)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "foo",
        scope: "user",
        status: "skipped",
        severity: "info",
        needsReload: false,
        reasons: ["already no autoupdate"],
        plugins: [],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments.length, 1);
});

test('UXG-05: marketplace update no-op (mp.skipped + reasons:["up-to-date"], plugins:[]) renders `● <mp> [<scope>] (skipped) {up-to-date}`, computes info (benign per UXG-02 / D-28-07), emits NO /reload trailer', (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "local-mp",
        scope: "user",
        status: "skipped",
        severity: "info",
        needsReload: false,
        reasons: ["up-to-date"],
        plugins: [],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  const body = args[0] as string;
  assert.equal(body, "● local-mp [user] (skipped) {up-to-date}");
  assert.equal(args.length, 1);
  assert.ok(
    !body.includes("/reload to pick up changes"),
    `expected body to NOT include reload-hint trailer, got: ${body}`,
  );
});

test('UXG-05 (UAT Test-3 gap): autoupdate-ON no-op payload (mp.skipped + reasons:["up-to-date"], plugins:[]) renders byte-identically to the OFF no-op `● <mp> [<scope>] (skipped) {up-to-date}`, computes info (benign per UXG-02 / D-28-07), emits NO /reload trailer', (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        status: "skipped",
        severity: "info",
        needsReload: false,
        reasons: ["up-to-date"],
        plugins: [],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  const body = args[0] as string;
  assert.equal(body, "● official [user] (skipped) {up-to-date}");
  assert.equal(args.length, 1);
  assert.ok(
    !body.includes("/reload to pick up changes"),
    `expected body to NOT include reload-hint trailer, got: ${body}`,
  );
});

test("notify benign-only cascade: benign mp.skipped coexists with healthy plugin row -> computes info (UXG-02 / D-28-06/07)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "foo",
        scope: "user",
        status: "skipped",
        severity: "info",
        needsReload: false,
        reasons: ["already autoupdate"],
        plugins: [
          {
            name: "p1",
            status: "available",
            version: "1.0.0",
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  const body = args[0] as string;
  assert.ok(
    body.includes(`● foo [user] <autoupdate> {already autoupdate}`),
    `expected body to include mp-skipped header, got: ${body}`,
  );
  assert.ok(
    !body.includes(`/reload to pick up changes`),
    `expected body to NOT include reload-hint trailer, got: ${body}`,
  );
});

test("notify renders SUB-BRANCH B list-surface marketplace header with autoupdate token; lastUpdatedAt field persists but is not rendered (UXG-01)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        details: { autoupdate: true, lastUpdatedAt: "2026-05-25T00:00:00Z" },
        plugins: [],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● demo [user] <autoupdate>`]);
});

test("notify renders header-only block on empty plugins under added marketplace (NO reload-hint per SNM-33/D-22-01)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "demo", scope: "user", status: "added", plugins: [] }],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● demo [user] (added)`]);
});

test("RLD-04: list-shaped message with an installed inventory row (needsReload:false) emits NO /reload trailer (RLD-02 OR-reduce)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: false,
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    body.includes("● alpha v1.0.0 (installed)"),
    `expected body to include the installed inventory row, got: ${body}`,
  );
  assert.ok(
    !body.includes("/reload to pick up changes"),
    `expected body to NOT include reload-hint trailer, got: ${body}`,
  );
});

test("RLD-02: cascade-shaped message with an installed transition row (needsReload:true) emits the /reload trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    body.includes("/reload to pick up changes"),
    `expected body to include reload-hint trailer, got: ${body}`,
  );
});

test("PL-4: installed inventory row with description emits a 4-space-indented second line", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: false,
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
            description: "A short description of the alpha plugin.",
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;

  // assert
  assert.equal(
    body,
    "● official [user]\n  ● alpha v1.0.0 (installed)\n    A short description of the alpha plugin.",
  );
});

test("PL-4: upgradable row with description emits description line", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "upgradable",
            name: "beta",
            version: "1.0.0",
            reasons: [],
            description: "Beta plugin description.",
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;

  // assert
  assert.equal(
    body,
    "● official [user]\n  ● beta v1.0.0 (upgradable)\n    Beta plugin description.",
  );
});

test("PL-4: available row with description emits description line", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "available",
            name: "gamma",
            version: "2.0.0",
            description: "Installable plugin with a description.",
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;

  // assert
  assert.equal(
    body,
    "● official [user]\n  ○ gamma v2.0.0 (available)\n    Installable plugin with a description.",
  );
});

test("PL-4: unavailable row with description emits description line", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "unavailable",
            name: "delta",
            reasons: ["unsupported hooks"],
            description: "Unavailable plugin that still surfaces its description.",
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;

  // assert
  assert.equal(
    body,
    "● official [user]\n  ⊘ delta (unavailable) {unsupported hooks}\n    Unavailable plugin that still surfaces its description.",
  );
});

test("PL-4 / CR-01: unsupported row with description emits description line", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "partially-available",
            name: "delta",
            reasons: ["lsp"],
            description: "Unsupported plugin that still surfaces its description.",
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;

  // assert
  assert.equal(
    body,
    "● official [user]\n  ⊖ delta (partially-available) {lsp}\n    Unsupported plugin that still surfaces its description.",
  );
});

test("PL-4: disabled inventory row with description emits description line", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "disabled",
            severity: "info",
            needsReload: false,
            name: "foo-plugin",
            version: "1.2.3",
            description: "Disabled plugin that still surfaces its description.",
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;

  // assert
  assert.equal(
    body,
    "● official [user]\n  ◍ foo-plugin v1.2.3 (disabled)\n    Disabled plugin that still surfaces its description.",
  );
});

test("PL-4: description absent -- no second line emitted", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "available", name: "gamma", version: "2.0.0" }],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;

  // assert
  assert.equal(body, "● official [user]\n  ○ gamma v2.0.0 (available)");
});

test("PL-4: description exactly 66 chars -- emitted verbatim (no truncation)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const exactly66 = "A".repeat(66);
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "available", name: "gamma", description: exactly66 }],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;

  // assert
  assert.ok(
    body.includes(`    ${exactly66}`),
    `expected 66-char description verbatim, got: ${body}`,
  );
});

test("PL-4: description 67 chars -- truncated to 63 + '...' (column 66)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const over = "B".repeat(67);
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "available", name: "gamma", description: over }],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;

  // assert
  assert.ok(
    body.includes(`    ${"B".repeat(63)}...`),
    `expected truncated description, got: ${body}`,
  );
});

test("PL-4: empty string description -- no second line emitted", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "available", name: "gamma", description: "" }],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;

  // assert
  assert.equal(body, "● official [user]\n  ○ gamma (available)");
});

test("D-22-04 NEGATIVE: empty `marketplace add` ({status:'added', plugins:[]}) emits NO /reload trailer (SNM-33 / G-MIL-01)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "local-mp", scope: "user", status: "added", plugins: [] }],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    !body.includes("/reload to pick up changes"),
    `expected empty add to NOT include reload-hint trailer, got: ${body}`,
  );
});

test("D-22-04 NEGATIVE: empty `marketplace remove` ({status:'removed', plugins:[]}) emits NO /reload trailer (SNM-33 / G-MIL-02)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "local-mp", scope: "user", status: "removed", plugins: [] }],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    !body.includes("/reload to pick up changes"),
    `expected empty remove to NOT include reload-hint trailer, got: ${body}`,
  );
});

test("D-22-04 NEGATIVE: no-op `marketplace update` (all plugin rows skipped) emits NO /reload trailer (SNM-33 / G-MIL-06)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "local-mp",
        scope: "user",
        status: "updated",
        plugins: [
          {
            status: "skipped",
            name: "alpha",
            reasons: ["up-to-date"],
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    !body.includes("/reload to pick up changes"),
    `expected all-skipped update to NOT include reload-hint trailer, got: ${body}`,
  );
});

test("D-22-04 POSITIVE: `marketplace remove` that uninstalled >=1 plugin emits the /reload trailer (SC#4)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "local-mp",
        scope: "user",
        status: "removed",
        plugins: [{ status: "uninstalled", name: "alpha", severity: "info", needsReload: true }],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    body.includes("/reload to pick up changes"),
    `expected non-empty remove to include reload-hint trailer, got: ${body}`,
  );
});

test("D-22-04 POSITIVE: `marketplace update` with >=1 changed plugin emits the /reload trailer (SC#4)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "local-mp",
        scope: "user",
        status: "updated",
        plugins: [
          {
            status: "updated",
            name: "alpha",
            from: "1.0.0",
            to: "2.0.0",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    body.includes("/reload to pick up changes"),
    `expected update with a changed plugin to include reload-hint trailer, got: ${body}`,
  );
});

test("notify renders (no marketplaces) sentinel for empty marketplaces array (no reload-hint, no severity)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = { marketplaces: [] };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`(no marketplaces)`]);
});

test("notify renders bare marketplace header when mp.status and mp.details are both undefined (no-crash, BLOCKER-3 coverage)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [],
      },
    ],
  };
  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● demo [user]`]);
});

test("notify renders single-plugin payload as 2-line body (header + 2-space indented row)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "project",
        status: "added",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [project] (added)\n  ● alpha v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
});

test("notify preserves caller-supplied plugin order across multi-plugin payload (D-16-06: no internal sort)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "gamma",
            version: "1.0.0",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
          {
            status: "installed",
            name: "alpha",
            version: "2.0.0",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
          {
            status: "installed",
            name: "beta",
            version: "3.0.0",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● gamma v1.0.0 (installed)\n  ● alpha v2.0.0 (installed)\n  ● beta v3.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
});

test("notify joins multi-marketplace blocks with single blank line and appends reload-hint at end (D-16-07)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "alpha-mp",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "alpha-plugin",
            version: "1.0.0",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
      {
        name: "beta-mp",
        scope: "project",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "beta-plugin",
            version: "2.0.0",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● alpha-mp [user] (added)\n  ● alpha-plugin v1.0.0 (installed)\n\n● beta-mp [project] (added)\n  ● beta-plugin v2.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
});

test("notify emits inline [scope] bracket on plugin row when p.scope set (orphan-fold PRESENT)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "project",
        status: "added",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "commit-commands",
            version: "1.0.0",
            dependencies: [],
            scope: "user", // orphan-fold: plugin scope differs from marketplace scope
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [project] (added)\n  ● commit-commands [user] v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
});

test("notify omits scope bracket on plugin row when p.scope is undefined (non-orphan-fold, BLOCKER-1 coverage)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "project",
        status: "added",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "commit-commands",
            version: "1.0.0",
            dependencies: [],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [project] (added)\n  ● commit-commands v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
  const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string];
  const body = callArgs[0];
  assert.ok(
    !body.includes("[undefined]"),
    "BLOCKER-1: row must not contain the literal [undefined] substring",
  );
  const lines = body.split("\n");
  const pluginRow = lines[1]!;
  assert.ok(
    !pluginRow.includes("[project]"),
    "BLOCKER-1: plugin row must not leak the marketplace's [project] bracket",
  );
  assert.ok(
    !pluginRow.includes("[user]"),
    "BLOCKER-1: plugin row must not contain a stray [user] bracket either",
  );
});

test("notify omits scope bracket on installed plugin row when p.scope === mp.scope (D-17.2-07a)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
            scope: "user", // same-scope: plugin scope matches marketplace scope -> no bracket
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● alpha v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
  const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string];
  const body = callArgs[0];
  assert.ok(
    !body.includes("[undefined]"),
    "D-17.2-07a: row must not contain the literal [undefined] substring",
  );
  const pluginRow = body.split("\n")[1]!;
  assert.ok(
    !pluginRow.includes("[user]"),
    "D-17.2-07a: same-scope plugin row must not contain a [user] bracket",
  );
  assert.ok(
    !pluginRow.includes("[project]"),
    "D-17.2-07a: same-scope plugin row must not leak any other [scope] bracket",
  );
});

test("notify emits [project] bracket on installed plugin row when p.scope !== mp.scope (D-17.2-07b)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
            scope: "project", // orphan-fold: plugin scope differs from marketplace scope
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● alpha [project] v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
  const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string];
  const body = callArgs[0];
  assert.ok(
    !body.includes("[undefined]"),
    "D-17.2-07b: row must not contain the literal [undefined] substring",
  );
  const pluginRow = body.split("\n")[1]!;
  assert.ok(
    pluginRow.includes("[project]"),
    "D-17.2-07b: orphan-fold plugin row must contain the [project] bracket",
  );
});

test("notify omits scope bracket on updated plugin row when p.scope === mp.scope (D-17.2-07c)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "project",
        status: "added",
        plugins: [
          {
            status: "updated",
            severity: "info",
            needsReload: true,
            name: "alpha",
            from: "0.9.0",
            to: "1.0.0",
            dependencies: [],
            scope: "project", // same-scope: no bracket
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [project] (added)\n  ● alpha v0.9.0 → v1.0.0 (updated)\n\n/reload to pick up changes`,
  ]);
  const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string];
  const body = callArgs[0];
  assert.ok(
    !body.includes("[undefined]"),
    "D-17.2-07c: row must not contain the literal [undefined] substring",
  );
  const pluginRow = body.split("\n")[1]!;
  assert.ok(
    !pluginRow.includes("[user]"),
    "D-17.2-07c: same-scope updated row must not contain a [user] bracket",
  );
  assert.ok(
    !pluginRow.includes("[project]"),
    "D-17.2-07c: same-scope updated row must not leak the [project] bracket",
  );
});

test("notify emits [project] bracket on failed plugin row when p.scope !== mp.scope (D-17.2-07d)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "failed",
            severity: "error",
            needsReload: false,
            name: "alpha",
            version: "1.0.0",
            reasons: ["unsupported source"],
            scope: "project", // orphan-fold on an error-class arm
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `A plugin operation has failed.\n\n● demo [user] (added)\n  ⊘ alpha [project] v1.0.0 (failed) {unsupported source}`,
    "error",
  ]);
  const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string, string];
  const body = callArgs[0];
  assert.ok(
    !body.includes("[undefined]"),
    "D-17.2-07d: row must not contain the literal [undefined] substring",
  );
  const pluginRow = body.split("\n")[3]!;
  assert.ok(
    pluginRow.includes("[project]"),
    "D-17.2-07d: orphan-fold failed row must contain the [project] bracket",
  );
});

test("notify renders rollbackPartial child rows at 4-space indent for failed plugin (no causes)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "failed",
        severity: "error",
        plugins: [
          {
            status: "failed",
            severity: "error",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["permission denied"],
            rollbackPartial: [{ phase: "skills" }, { phase: "agents" }],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `Some operations have failed.\n\n⊘ demo [user] (failed)\n  ⊘ commit-commands v1.0.0 (failed) {permission denied}\n    [skills] (rollback failed)\n    [agents] (rollback failed)`,
    "error",
  ]);
});

test("notify renders nested cause chains: per-plugin at 4-space indent, per-phase rollback cause at 6-space indent (D-16-08)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const inner = new Error("inner", { cause: new Error("root") });
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "failed",
        severity: "error",
        plugins: [
          {
            status: "failed",
            severity: "error",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["permission denied"],
            cause: inner,
            rollbackPartial: [{ phase: "skills", cause: new Error("EACCES") }],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `Some operations have failed.\n\n⊘ demo [user] (failed)\n  ⊘ commit-commands v1.0.0 (failed) {permission denied}\n    cause: inner -> root\n    [skills] (rollback failed)\n      cause: EACCES`,
    "error",
  ]);
});

test("notify emits per-plugin cause-chain inline below each failed row (multi-cause cascade, D-16-08)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "failed",
            severity: "error",
            needsReload: false,
            name: "alpha",
            version: "1.0.0",
            reasons: ["permission denied"],
            cause: new Error("alpha-root"),
          },
          {
            status: "failed",
            severity: "error",
            needsReload: false,
            name: "beta",
            version: "2.0.0",
            reasons: ["network unreachable"],
            cause: new Error("beta-root"),
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `Some plugin operations have failed.\n\n● demo [user] (added)\n  ⊘ alpha v1.0.0 (failed) {permission denied}\n    cause: alpha-root\n  ⊘ beta v2.0.0 (failed) {network unreachable}\n    cause: beta-root`,
    "error",
  ]);
});

test("notify severity tier info: installed plugin in added marketplace -> arguments length 1 (no severity arg)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments.length, 1);
});

test('notify severity tier warning: single actionable skipped plugin -> arguments = [..., "warning"]', (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            severity: "warning",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["not installed"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments.length, 2);
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments[1], "warning");
});

test('notify severity tier error first-match: failed + skipped in same payload -> "error" (failed beats warning)', (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            name: "alpha",
            version: "1.0.0",
            reasons: ["up-to-date"],
            severity: "info",
            needsReload: false,
          },
          {
            status: "failed",
            name: "beta",
            version: "2.0.0",
            reasons: ["permission denied"],
            severity: "error",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments.length, 2);
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments[1], "error");
});

test("notify suppresses reload-hint when payload contains only failed statuses (D-16-12 negative case)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "failed",
        severity: "error",
        plugins: [
          {
            status: "failed",
            severity: "error",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["permission denied"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string, string];
  const body = callArgs[0];
  assert.ok(
    !body.includes("/reload to pick up changes"),
    "D-16-12: reload-hint must be suppressed when no state-changing status is present",
  );
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `Some operations have failed.\n\n⊘ demo [user] (failed)\n  ⊘ commit-commands v1.0.0 (failed) {permission denied}`,
    "error",
  ]);
});

test("notifyUsageError emits ${msg.message}\\n\\n${msg.usage} with 'error' severity (SNM-13)", (t) => {
  // arrange
  const ctx = createContext(t);
  const msg: UsageErrorMessage = {
    message: "Unknown plugin",
    usage: "Usage: /claude:plugin install <name>",
  };

  // act
  notifyUsageError(ctx as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `Unknown plugin\n\nUsage: /claude:plugin install <name>`,
    "error",
  ]);
});

test("notify renders manual recovery plugin with cause-chain trailer (warning severity, status literal includes the space)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "manual recovery",
            severity: "warning",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["rollback partial"],
            cause: new Error("EACCES"),
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `A plugin operation needs attention.\n\n● demo [user]\n  ⊘ commit-commands v1.0.0 (manual recovery) {rollback partial}\n    cause: EACCES`,
    "warning",
  ]);
});

test("AS-7: manual recovery row names the leaked paths from ManualRecoveryError.leaks", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const leaks = [
    "/home/u/.pi/pi-claude-marketplace/agents-staging/foo.md",
    "/home/u/.pi/pi-claude-marketplace/agents-index.json",
  ];
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "manual recovery",
            severity: "warning",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["rollback partial"],
            cause: new ManualRecoveryError("agent index rewrite failed", leaks, {
              cause: new Error("EACCES"),
            }),
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const [rendered, severity] = ctx.ui.notify.mock.calls[0]!.arguments as [string, string];
  assert.equal(severity, "warning");
  assert.match(rendered, /cause: agent index rewrite failed -> EACCES/);
  for (const leak of leaks) {
    assert.match(rendered, new RegExp(`    leaked: ${leak.replace(/[.]/g, "\\.")}`));
  }
});

test("AS-7: manual recovery row with no leaks emits no leaked-paths child row", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "manual recovery",
            severity: "warning",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["rollback partial"],
            cause: new ManualRecoveryError("nothing leaked", [], {
              cause: new Error("EACCES"),
            }),
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const rendered = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;

  // assert
  assert.doesNotMatch(rendered, /leaked:/);
});

test("notify renders single-version hash row as v#<7hex> via renderVersion chokepoint (SNM-35)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "commit-commands",
            version: "hash-2ea95f85703d",
            dependencies: [],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v#2ea95f8 (installed)\n\n/reload to pick up changes`,
  ]);
});

test("D-77-01 / PURL-09 notify renders single-version sha row as v#<7hex> via renderVersion chokepoint", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "commit-commands",
            version: "sha-2ea95f857031",
            dependencies: [],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v#2ea95f8 (installed)\n\n/reload to pick up changes`,
  ]);
});

test("notify renders update arrow with hash on both sides as v#<7hex> → v#<7hex> via composeVersionArrow (SNM-35)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "updated",
            severity: "info",
            needsReload: true,
            name: "commit-commands",
            from: "hash-2ea95f85703d",
            to: "hash-1c3d9a0bbef1",
            dependencies: [],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v#2ea95f8 → v#1c3d9a0 (updated)\n\n/reload to pick up changes`,
  ]);
});

test("notify passes a SemVer version through unchanged -> v1.0.0 (non-hash pass-through guard, SNM-35)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "commit-commands",
            version: "1.0.0",
            dependencies: [],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
});

test('UXG-02 (D-28-03/06): actionable plugin skip ("not installed") computes warning', (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            severity: "warning",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["not installed"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 2);
  assert.equal(args[1], "warning");
});

test("UXG-02 (D-28-09): mixed cascade (benign skip + actionable skip) computes warning -- first-match poisoning", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            name: "alpha",
            version: "1.0.0",
            reasons: ["up-to-date"],
            severity: "info",
            needsReload: false,
          },
          {
            status: "skipped",
            name: "beta",
            version: "2.0.0",
            reasons: ["not installed"],
            severity: "warning",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 2);
  assert.equal(args[1], "warning");
});

test("UXG-02 (D-28-06): plugin skip with empty reasons:[] computes warning (allBenign guard on length)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            name: "alpha",
            version: "1.0.0",
            reasons: [],
            severity: "warning",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 2);
  assert.equal(args[1], "warning");
});

test("UXG-02 (D-28-08): mp-level skip with reasons OMITTED computes warning -- safe default", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "skipped",
        plugins: [],
        severity: "warning",
        needsReload: false,
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 2);
  assert.equal(args[1], "warning");
});

test("UXG-07 (D-29-02/03): error -- single failed plugin under failed mp -> 'Some operations have failed.' summary prepended", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "failed",
        severity: "error",
        plugins: [
          {
            status: "failed",
            severity: "error",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["network unreachable"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `Some operations have failed.\n\n⊘ demo [user] (failed)\n  ⊘ commit-commands v1.0.0 (failed) {network unreachable}`,
    "error",
  ]);
});

test("UXG-07 (D-29-03): error -- single failed plugin, non-failed mp -> 'A plugin operation has failed.' (single-type singular)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "failed",
            severity: "error",
            needsReload: false,
            name: "alpha",
            version: "1.0.0",
            reasons: ["unsupported source"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `A plugin operation has failed.\n\n● demo [user] (added)\n  ⊘ alpha v1.0.0 (failed) {unsupported source}`,
    "error",
  ]);
});

test("UXG-07 (D-29-03): error -- two failed plugins, non-failed mp -> 'Some plugin operations have failed.' (single-type plural)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "failed",
            name: "alpha",
            version: "1.0.0",
            reasons: ["permission denied"],
            severity: "error",
            needsReload: false,
          },
          {
            status: "failed",
            name: "beta",
            version: "2.0.0",
            reasons: ["network unreachable"],
            severity: "error",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    body.startsWith("Some plugin operations have failed.\n\n"),
    "two-failed-plugin cascade summary must read 'Some plugin operations have failed.'",
  );
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments[1], "error");
});

test("UXG-07 (D-29-03): error -- failed mp only, no plugin rows -> 'A marketplace operation has failed.' (single-type marketplace)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "failed",
        plugins: [],
        severity: "error",
        needsReload: false,
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `A marketplace operation has failed.\n\n⊘ demo [user] (failed)`,
    "error",
  ]);
});

test("UXG-07 (D-29-03/04): warning -- single actionable-skip plugin -> 'A plugin operation needs attention.'", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            severity: "warning",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["not installed"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    body.startsWith("A plugin operation needs attention.\n\n"),
    "single actionable-skip cascade summary must read 'A plugin operation needs attention.'",
  );
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments[1], "warning");
});

test("UXG-07 (D-29-04): warning -- manual-recovery plugin counts as an actionable skip -> 'A plugin operation needs attention.'", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "manual recovery",
            severity: "warning",
            needsReload: false,
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["rollback partial"],
            cause: new Error("EACCES"),
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `A plugin operation needs attention.\n\n● demo [user]\n  ⊘ commit-commands v1.0.0 (manual recovery) {rollback partial}\n    cause: EACCES`,
    "warning",
  ]);
});

test("UXG-07 (D-29-03/04): warning -- two actionable-skip plugins + one actionable-skip mp -> mixed plural summary", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            name: "alpha",
            version: "1.0.0",
            reasons: ["not installed"],
            severity: "warning",
            needsReload: false,
          },
          {
            status: "skipped",
            name: "beta",
            version: "2.0.0",
            reasons: ["not installed"],
            severity: "warning",
            needsReload: false,
          },
        ],
      },
      {
        name: "other",
        scope: "user",
        status: "skipped",
        plugins: [],
        severity: "warning",
        needsReload: false,
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    body.startsWith("Some operations need attention.\n\n"),
    "mixed actionable-skip cascade summary must read 'Some operations need attention.'",
  );
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments[1], "warning");
});

test("UXG-07 (D-29-02): info severity -- NO summary line prepended (byte-identical to prior info-severity behavior)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● alpha v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
});

test("UXG-07 (D-29-02): error -- summary prepended BEFORE cascade body AND reload-hint stays last", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "uninstalled",
            name: "alpha",
            version: "1.0.0",
            severity: "info",
            needsReload: true,
          },
          {
            status: "failed",
            name: "beta",
            version: "2.0.0",
            reasons: ["permission denied"],
            severity: "error",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    body.startsWith("A plugin operation has failed.\n\n"),
    "summary line must be the first line of the composed string",
  );
  assert.ok(
    body.endsWith("\n\n/reload to pick up changes"),
    "reload-hint must remain the last trailer after the cascade body",
  );
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments[1], "error");
});

test("UXG-07 (D-29-02): warning -- benign-only cascade routes to INFO so NO summary line is prepended", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            name: "alpha",
            version: "1.0.0",
            reasons: ["up-to-date"],
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1, "benign-only skip is info severity -- single-arg call, no summary");
  assert.ok(
    !(args[0] as string).includes("needs attention.") &&
      !(args[0] as string).includes("need attention."),
    "info-severity cascade must NOT carry a summary line",
  );
});

function pluginInfoDescriptionBlock(t: TestContext, description: string): string[] {
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: true },
    plugin: {
      status: "installed",
      name: "alpha",
      version: "1.0.0",
      description,
      componentsResolved: false,
    },
  };
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  const lines = body.split("\n");
  return lines.slice(2);
}

test("wrapDescription: empty description omits the wrap block entirely", (t) => {
  // arrange
  const description = "";

  // act
  const tail = pluginInfoDescriptionBlock(t, description);

  // assert
  assert.deepEqual(tail, ["    components: not resolved"]);
});

test("wrapDescription: short description renders as a single 4-space-indented line", (t) => {
  // arrange
  const description = "Hello world.";

  // act
  const tail = pluginInfoDescriptionBlock(t, description);

  // assert
  assert.deepEqual(tail, ["    Hello world.", "    components: not resolved"]);
});

test("wrapDescription: text fitting exactly 66 chars on a word boundary stays on one line", (t) => {
  // arrange
  const text = "x".repeat(66);

  // act
  const tail = pluginInfoDescriptionBlock(t, text);

  // assert
  assert.deepEqual(tail, [`    ${text}`, "    components: not resolved"]);
});

test("wrapDescription: long description wraps at word boundary at 66-char text width", (t) => {
  // arrange
  const first = "a".repeat(60);
  const second = "b".repeat(60);

  // act
  const tail = pluginInfoDescriptionBlock(t, `${first} ${second}`);

  // assert
  assert.deepEqual(tail, [`    ${first}`, `    ${second}`, "    components: not resolved"]);
});

test("wrapDescription: an over-length single word emits on its own line at indent with no ellipsis", (t) => {
  // arrange
  const word = "supercalifragilisticexpialidociousandevenlongerwithanotherwordtoexceed";

  // act
  const tail = pluginInfoDescriptionBlock(t, word);

  // assert
  assert.deepEqual(tail, [`    ${word}`, "    components: not resolved"]);
});

test("wrapDescription: whitespace collapsed (tabs, newlines, double spaces) into single-space-separated words", (t) => {
  // arrange
  const description = "  hello\t\tworld\n\nfoo  ";

  // act
  const tail = pluginInfoDescriptionBlock(t, description);

  // assert
  assert.deepEqual(tail, ["    hello world foo", "    components: not resolved"]);
});

test("WR-05 / wrapDescription: whitespace-only description reaches wrapDescription and returns no body lines", (t) => {
  // arrange
  const description = "   ";

  // act
  const tail = pluginInfoDescriptionBlock(t, description);

  // assert
  assert.deepEqual(tail, ["    components: not resolved"]);
});

test("WR-05 / wrapDescription: two words whose `current.length + 1 + word.length === wrapCol` stay on one line (boundary-equality)", (t) => {
  // arrange
  const a = "a".repeat(32);
  const b = "b".repeat(33);
  const expectedWidth = 66;

  // act
  const width = a.length + 1 + b.length;
  const tail = pluginInfoDescriptionBlock(t, `${a} ${b}`);

  // assert
  assert.equal(width, expectedWidth, "fixture precondition: joined width must be exactly 66");
  assert.deepEqual(tail, [`    ${a} ${b}`, "    components: not resolved"]);
});

test("GRAM-01 / GRAM-02: standalone {not added} row renders the two-block summary + separate detail block (marketplace subject, error severity)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-not-added",
    name: "my-mp",
    scope: "user",
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A marketplace operation has failed.\n\n⊘ my-mp [user] (failed) {not added}",
    "error",
  ]);
});

test("GRAM-02: standalone failed plugin-info renders `A plugin operation has failed.` + separate multi-line detail block", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info",
    marketplaceName: "bad-mp",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
    plugin: {
      status: "failed",
      name: "bad-mp",
      scope: "user",
      reasons: ["invalid manifest"],
      componentsResolved: false,
    },
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    [
      "A plugin operation has failed.",
      "",
      "● bad-mp [user] <no autoupdate>",
      "  ⊘ bad-mp (failed) {invalid manifest}",
      "    components: not resolved",
    ].join("\n"),
    "error",
  ]);
});

test("INFO-04: {not added} row never carries a reload-hint (read-only surface)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-not-added",
    name: "my-mp",
    scope: "user",
  };

  // act
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;

  // assert
  assert.ok(
    !body.includes("/reload"),
    "marketplace-not-added must NOT carry the reload-hint trailer",
  );
});

test("INFO-01: renderMarketplaceInfo (github source + ref + lastUpdated + description)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-info",
    name: "official",
    scope: "user",
    details: { autoupdate: true, lastUpdatedAt: "2026-05-01T12:34:56Z" },
    source: { sourceKind: "github", owner: "acolombo", repo: "official", ref: "main" },
    description: "The official Claude plugin marketplace.",
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    [
      "● official [user] <autoupdate>",
      "github: acolombo/official#main",
      "last_updated: 2026-05-01T12:34:56Z",
      "description: The official Claude plugin marketplace.",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-01: renderMarketplaceInfo (path source, no lastUpdated, no description)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-info",
    name: "local-mp",
    scope: "project",
    details: { autoupdate: false },
    source: { sourceKind: "path", absPath: "/home/user/projects/local-mp" },
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    ["● local-mp [project] <no autoupdate>", "path: /home/user/projects/local-mp"].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-02 / INFO-05: renderPluginInfo (componentsResolved:true with sorted components + dependencies + wrapping description)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: true },
    plugin: {
      status: "installed",
      name: "alpha",
      version: "1.0.0",
      description: "A short description of the alpha plugin.",
      componentsResolved: true,
      components: {
        agents: ["agent-a", "agent-b"],
        commands: ["cmd-a"],
        skills: ["skill-a", "skill-b"],
      },
      dependencies: ["beta@official", "gamma@official"],
    },
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    [
      "● official [user] <autoupdate>",
      "  ● alpha v1.0.0 (installed)",
      "    A short description of the alpha plugin.",
      "    agents: agent-a, agent-b",
      "    commands: cmd-a",
      "    skills: skill-a, skill-b",
      "    dependencies: beta@official, gamma@official",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-05: renderPluginInfo (componentsResolved:false emits the `components: not resolved` marker)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: true },
    plugin: {
      status: "available",
      name: "external",
      version: "2.0.0",
      componentsResolved: false,
    },
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    [
      "● official [user] <autoupdate>",
      "  ○ external v2.0.0 (available)",
      "    components: not resolved",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("SURF-02 / D-63-04: renderer emits multi-line `hooks:` block at 4-space header + 6-space per-entry indent (mixed tool/non-tool entries)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: true },
    plugin: {
      status: "installed",
      name: "alpha",
      version: "1.0.0",
      componentsResolved: true,
      components: {
        hooks: [
          { event: "PreToolUse", matcher: "Bash" },
          { event: "PreToolUse", matcher: "Edit|Write" },
          { event: "PostToolUse", matcher: "Edit" },
          { event: "SessionStart" },
        ],
      },
    },
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    [
      "● official [user] <autoupdate>",
      "  ● alpha v1.0.0 (installed)",
      "    hooks:",
      "      PreToolUse(Bash)",
      "      PreToolUse(Edit|Write)",
      "      PostToolUse(Edit)",
      "      SessionStart",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("SURF-02 / D-63-04: empty hooks ([]) emits NO `hooks:` header; non-hooks kinds still render their single-line comma-join", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: true },
    plugin: {
      status: "installed",
      name: "alpha",
      version: "1.0.0",
      componentsResolved: true,
      components: {
        agents: ["agent-a"],
        hooks: [],
      },
    },
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    ["● official [user] <autoupdate>", "  ● alpha v1.0.0 (installed)", "    agents: agent-a"].join(
      "\n",
    ),
  );
  assert.equal(args.length, 1);
});

test("SURF-02 / D-63-04: undefined hooks (field omitted) emits NO `hooks:` header; legacy 4-kind comma-join output is byte-stable", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: true },
    plugin: {
      status: "installed",
      name: "alpha",
      version: "1.0.0",
      componentsResolved: true,
      components: {
        agents: ["a"],
        commands: ["b"],
        mcp: ["c"],
        skills: ["d"],
      },
    },
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    [
      "● official [user] <autoupdate>",
      "  ● alpha v1.0.0 (installed)",
      "    agents: a",
      "    commands: b",
      "    mcp: c",
      "    skills: d",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("SURF-02: lenient `HookSummaryEntry` arm renders `<event> (unsupported)` when supported=false, bare `<event>` when supported=true", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: true },
    plugin: {
      status: "unavailable",
      name: "alpha",
      version: "1.0.0",
      componentsResolved: true,
      components: {
        hooks: [
          { kind: "lenient", event: "Notification", supported: false },
          { kind: "lenient", event: "PostToolUse", supported: true },
        ],
      },
    },
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    [
      "● official [user] <autoupdate>",
      "  ⊘ alpha v1.0.0 (unavailable)",
      "    hooks:",
      "      Notification (unsupported)",
      "      PostToolUse",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-03: marketplace-info-cascade with a single block byte-equals the bare marketplace-info render", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-info-cascade",
    blocks: [
      {
        kind: "marketplace-info",
        name: "official",
        scope: "user",
        details: { autoupdate: true, lastUpdatedAt: "2026-06-03T00:00:00Z" },
        source: {
          sourceKind: "github",
          owner: "anthropics",
          repo: "claude-plugins-official",
          ref: "main",
        },
        description: "Official Claude plugin marketplace.",
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    [
      "● official [user] <autoupdate>",
      "github: anthropics/claude-plugins-official#main",
      "last_updated: 2026-06-03T00:00:00Z",
      "description: Official Claude plugin marketplace.",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-03: marketplace-info-cascade with two blocks renders project-first then user, joined by one blank line", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-info-cascade",
    blocks: [
      {
        kind: "marketplace-info",
        name: "my-mp",
        scope: "project",
        details: { autoupdate: true },
        source: { sourceKind: "path", absPath: "/repo/path/my-mp" },
      },
      {
        kind: "marketplace-info",
        name: "my-mp",
        scope: "user",
        details: { autoupdate: false },
        source: { sourceKind: "github", owner: "someuser", repo: "my-mp" },
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    [
      "● my-mp [project] <autoupdate>",
      "path: /repo/path/my-mp",
      "",
      "● my-mp [user] <no autoupdate>",
      "github: someuser/my-mp",
    ].join("\n"),
  );
});

test("INFO-03: marketplace-info-cascade severity is always info (no second arg) and no reload-hint", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-info-cascade",
    blocks: [
      {
        kind: "marketplace-info",
        name: "my-mp",
        scope: "project",
        details: { autoupdate: true },
        source: { sourceKind: "path", absPath: "/repo/path/my-mp" },
      },
      {
        kind: "marketplace-info",
        name: "my-mp",
        scope: "user",
        details: { autoupdate: false },
        source: { sourceKind: "github", owner: "someuser", repo: "my-mp" },
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1, "info severity must omit the 2nd arg");
  assert.ok(
    !(args[0] as string).includes("/reload"),
    "info-surface marketplace-info-cascade must NOT carry the reload-hint trailer",
  );
});

test("INFO-03 + INFO-01: single-block fan-out (github source, all optional fields) byte form", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-info-cascade",
    blocks: [
      {
        kind: "marketplace-info",
        name: "claude-plugins-official",
        scope: "user",
        details: { autoupdate: true, lastUpdatedAt: "2026-05-01T12:34:56Z" },
        source: {
          sourceKind: "github",
          owner: "anthropics",
          repo: "claude-plugins-official",
          ref: "main",
        },
        description: "The official Claude plugin marketplace.",
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    [
      "● claude-plugins-official [user] <autoupdate>",
      "github: anthropics/claude-plugins-official#main",
      "last_updated: 2026-05-01T12:34:56Z",
      "description: The official Claude plugin marketplace.",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-03 + INFO-01: single-block fan-out (path source, minimal) byte form omits last_updated and description", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-info-cascade",
    blocks: [
      {
        kind: "marketplace-info",
        name: "local-mp",
        scope: "project",
        details: { autoupdate: false },
        source: { sourceKind: "path", absPath: "/home/user/projects/local-mp" },
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    ["● local-mp [project] <no autoupdate>", "path: /home/user/projects/local-mp"].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-02: plugin-info-cascade with a single block byte-equals the bare plugin-info render", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info-cascade",
    blocks: [
      {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "installed",
          name: "foo",
          version: "1.0.0",
          componentsResolved: true,
          components: { skills: ["s1"] },
        },
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    ["● mp [user] <no autoupdate>", "  ● foo v1.0.0 (installed)", "    skills: s1"].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-02 + INFO-03: plugin-info-cascade with two blocks renders project-first then user, joined by one blank line", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info-cascade",
    blocks: [
      {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "project",
        marketplaceDetails: { autoupdate: true },
        plugin: {
          status: "installed",
          name: "foo",
          version: "1.0.0",
          componentsResolved: true,
          components: { skills: ["s1"] },
        },
      },
      {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "installed",
          name: "foo",
          version: "2.0.0",
          componentsResolved: true,
          components: { agents: ["a1"] },
        },
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    [
      "● mp [project] <autoupdate>",
      "  ● foo v1.0.0 (installed)",
      "    skills: s1",
      "",
      "● mp [user] <no autoupdate>",
      "  ● foo v2.0.0 (installed)",
      "    agents: a1",
    ].join("\n"),
  );
});

test("INFO-02: plugin-info-cascade severity is always info (no second arg) and no reload-hint", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info-cascade",
    blocks: [
      {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "project",
        marketplaceDetails: { autoupdate: true },
        plugin: {
          status: "installed",
          name: "foo",
          version: "1.0.0",
          componentsResolved: true,
          components: { skills: ["s1"] },
        },
      },
      {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "installed",
          name: "foo",
          version: "2.0.0",
          componentsResolved: true,
          components: { agents: ["a1"] },
        },
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1, "info severity must omit the 2nd arg");
  assert.ok(
    !(args[0] as string).includes("/reload"),
    "info-surface plugin-info-cascade must NOT carry the reload-hint trailer",
  );
});

test("INFO-02: plugin-info-cascade single block installed with resolved components + dependencies renders full INFO-02 happy path", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info-cascade",
    blocks: [
      {
        kind: "plugin-info",
        marketplaceName: "official",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: true },
        plugin: {
          status: "installed",
          name: "commit-commands",
          version: "1.2.0",
          description: "Helpful git commit commands for everyday use.",
          componentsResolved: true,
          components: {
            agents: ["review-bot"],
            commands: ["c1", "c2"],
            skills: ["commit-summary"],
          },
          dependencies: ["helper@utils-mp"],
        },
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    [
      "● official [user] <autoupdate>",
      "  ● commit-commands v1.2.0 (installed)",
      "    Helpful git commit commands for everyday use.",
      "    agents: review-bot",
      "    commands: c1, c2",
      "    skills: commit-summary",
      "    dependencies: helper@utils-mp",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-05: plugin-info-cascade single block components-not-resolved emits the marker line at col 4", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info-cascade",
    blocks: [
      {
        kind: "plugin-info",
        marketplaceName: "remote-mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "installed",
          name: "remote-plugin",
          version: "1.0.0",
          description: "Remote plugin sourced from an external npm package.",
          componentsResolved: false,
        },
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    [
      "● remote-mp [user] <no autoupdate>",
      "  ● remote-plugin v1.0.0 (installed)",
      "    Remote plugin sourced from an external npm package.",
      "    components: not resolved",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("an omitted cascade kind renders byte-identically to an explicit cascade kind", (t) => {
  // arrange
  const ctxNoKind = createContext(t);
  const ctxWithKind = createContext(t);
  const pi = piWithBothLoaded();
  const noKindMsg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "installed",
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };
  const withKindMsg: NotificationMessage = {
    kind: "cascade",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "installed",
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };
  notify(ctxNoKind as never, pi as never, noKindMsg);

  // act
  notify(ctxWithKind as never, pi as never, withKindMsg);
  const noKindArgs = ctxNoKind.ui.notify.mock.calls[0]!.arguments;
  const withKindArgs = ctxWithKind.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.deepEqual(
    noKindArgs,
    withKindArgs,
    'Optional kind?:"cascade" must produce byte-identical notify() output to omitted kind',
  );
});

test("WILL-01: marketplace add renders a bare header + will-install plugin child (orphan-fold suppresses [scope])", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "new-mp",
        scope: "user",
        plugins: [{ status: "will install", name: "alpha" }],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(args[0], `● new-mp [user]\n  ● alpha (will install)`);
});

test("DIFF-02: will-uninstall plugin under existing (no-status) marketplace block", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "mp",
        scope: "user",
        plugins: [{ status: "will uninstall", name: "old-plugin" }],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● mp [user]\n  ○ old-plugin (will uninstall)`);
});

test("DIFF-02: will-enable + will-disable rows under same marketplace", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "mp",
        scope: "user",
        plugins: [
          { status: "will enable", name: "to-enable" },
          { status: "will disable", name: "to-disable" },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● mp [user]\n  ● to-enable (will enable)\n  ◍ to-disable (will disable)`);
});

test("DIFF-02: cross-scope orphan-fold -- plugin scope differs from marketplace scope -> [scope] bracket renders", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "shared",
        scope: "project",
        plugins: [{ status: "will install", name: "alpha", scope: "user" }],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● shared [project]\n  ● alpha [user] (will install)`);
});

test("DIFF-02: will-* cascade emits NO /reload to pick up changes trailer (pending rows are pre-transition)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "mp",
        scope: "user",
        plugins: [
          { status: "will install", name: "a" },
          { status: "will uninstall", name: "b" },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const emitted = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;

  // assert
  assert.ok(
    !emitted.includes("/reload to pick up changes"),
    "pending rows MUST NOT emit the reload-hint trailer",
  );
});

test("DIFF-02: will-* cascade computes info severity (no second arg to ctx.ui.notify)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "mp",
        scope: "user",
        plugins: [{ status: "will uninstall", name: "p" }],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
});

test("D-54-01: (disabled) inventory row renders subject-first with version under list-arm marketplace (info severity, no /reload)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        details: { autoupdate: true },
        plugins: [
          {
            status: "disabled",
            name: "foo-plugin",
            version: "1.2.3",
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● official [user] <autoupdate>\n  ◍ foo-plugin v1.2.3 (disabled)`);
});

test("D-54-01: (disabled) inventory row without version omits the v<version> slot cleanly", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "disabled", name: "foo-plugin", severity: "info", needsReload: false }],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● official [user]\n  ◍ foo-plugin (disabled)`);
});

test("D-54-01: (disabled) inventory row with orphan-fold scope bracket -- explicit p.scope differs from mp.scope", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "shared",
        scope: "user",
        plugins: [
          {
            status: "disabled",
            name: "foo-plugin",
            version: "1.2.3",
            scope: "project",
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● shared [user]\n  ◍ foo-plugin [project] v1.2.3 (disabled)`);
});

test("D-54-01: (disabled) inventory row WITHOUT orphan-fold -- p.scope matches mp.scope -> no row bracket", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "disabled",
            name: "foo-plugin",
            version: "1.2.3",
            scope: "user",
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● official [user]\n  ◍ foo-plugin v1.2.3 (disabled)`);
});

test("UAT-03 / RLD-05: a fresh (disabled) row stamping needsReload:true DOES emit the /reload trailer (realized transition; byte-identical row form)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "claude-plugins-official",
        scope: "user",
        plugins: [
          {
            status: "disabled",
            name: "foo-plugin",
            version: "1.2.3",
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    [
      "● claude-plugins-official [user]",
      "  ◍ foo-plugin v1.2.3 (disabled)",
      "",
      "/reload to pick up changes",
    ].join("\n"),
  );
});

test("UAT-03 / RLD-05: a (disabled) inventory row stamping needsReload:false stays trailer-free (stamp drives the hint, not the row status)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "claude-plugins-official",
        scope: "user",
        plugins: [
          {
            status: "disabled",
            name: "foo-plugin",
            version: "1.2.3",
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● claude-plugins-official [user]\n  ◍ foo-plugin v1.2.3 (disabled)`);
});

test("D-54-01 / ENBL idempotency: (skipped) {already enabled} row routes to info severity (benign reason)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "claude-plugins-official",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            severity: "info",
            needsReload: false,
            name: "foo-plugin",
            reasons: ["already enabled"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● claude-plugins-official [user]\n  ⊘ foo-plugin (skipped) {already enabled}`,
  );
});

test("D-54-01 / ENBL idempotency: (skipped) {already disabled} row routes to info severity (benign reason)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "claude-plugins-official",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            severity: "info",
            needsReload: false,
            name: "foo-plugin",
            reasons: ["already disabled"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● claude-plugins-official [user]\n  ⊘ foo-plugin (skipped) {already disabled}`,
  );
});

test("D-54-01: enable cascade (installed plugin row under added mp header) emits /reload trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "claude-plugins-official",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "foo-plugin",
            version: "1.2.3",
            dependencies: [],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● claude-plugins-official [user] (added)\n  ● foo-plugin v1.2.3 (installed)\n\n/reload to pick up changes`,
  );
});

test("D-54-01: disable cascade (uninstalled plugin row under list-arm mp) emits /reload trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "claude-plugins-official",
        scope: "user",
        plugins: [
          {
            status: "uninstalled",
            severity: "info",
            needsReload: true,
            name: "foo-plugin",
            version: "1.2.3",
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● claude-plugins-official [user]\n  ○ foo-plugin v1.2.3 (uninstalled)\n\n/reload to pick up changes`,
  );
});

test("RECON-04: success cascade -- mixed marketplace add + plugin install across both scopes, project-first ordering", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      {
        name: "new-mp",
        scope: "project",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "new-plugin",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
      {
        name: "other-mp",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "other-plugin",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● new-mp [project] (added)\n  ● new-plugin (installed)\n\n● other-mp [user] (added)\n  ● other-plugin (installed)`,
  );
});

test("RECON-04: success cascade NEVER emits `/reload to pick up changes` trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      {
        name: "new-mp",
        scope: "user",
        status: "added",
        plugins: [
          { status: "installed", name: "a", dependencies: [], severity: "info", needsReload: true },
          { status: "uninstalled", name: "b", severity: "info", needsReload: true },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const emitted = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;

  // assert
  assert.ok(
    !emitted.includes("/reload to pick up changes"),
    "RECON-04: reconcile-applied-cascade MUST NOT emit the reload-hint trailer (the reconcile already ran ON /reload)",
  );
});

test("RECON-04: soft-fail per-entry -- failed mp row mixed with successful install row routes to error + summary prepended", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      {
        name: "flaky-mp",
        scope: "user",
        status: "failed",
        severity: "error",
        needsReload: false,
        reasons: ["network unreachable"],
        plugins: [],
      },
      {
        name: "ok-mp",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "ok-plugin",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 2);
  assert.equal(args[1], "error");
  assert.equal(
    args[0],
    `A marketplace operation has failed.\n\n⊘ flaky-mp [user] (failed) {network unreachable}\n\n● ok-mp [user] (added)\n  ● ok-plugin (installed)`,
  );
});

test("RECON-04: CFG-03 invalid-config row carries BASENAME only (T-55-02-01 information-disclosure mitigation)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      {
        name: "claude-plugins.json",
        scope: "project",
        status: "failed",
        severity: "error",
        needsReload: false,
        reasons: ["invalid manifest"],
        plugins: [],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 2);
  assert.equal(args[1], "error");
  assert.equal(
    args[0],
    `A marketplace operation has failed.\n\n⊘ claude-plugins.json [project] (failed) {invalid manifest}`,
  );
});

test("REASONS includes the orphan-rewake public token", () => {
  // arrange
  const expectedReason = "orphan rewake";

  // act
  const includesReason = (REASONS as readonly string[]).includes(expectedReason);

  // assert
  assert.equal(includesReason, true);
});

test("SURF-05 / D-63-08: installed row renders `(installed) {orphan rewake}` via the existing reasons brace", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "installed",
            severity: "info",
            needsReload: true,
            name: "helper",
            version: "1.0.0",
            dependencies: [],
            reasons: ["orphan rewake"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● official [user]\n  ● helper v1.0.0 (installed) {orphan rewake}\n\n/reload to pick up changes`,
  ]);
});

test("REASONS keeps malformed component tokens in canonical order", () => {
  // arrange
  const flat = REASONS as readonly string[];
  const expectedReasons = ["malformed mcp", "malformed skill", "malformed command"];

  // act
  const at = flat.indexOf("malformed mcp");
  const malformedReasons = flat.slice(at, at + 3);

  // assert
  assert.notEqual(at, -1, "`malformed mcp` must still be a member");
  assert.deepEqual(malformedReasons, expectedReasons);
});

test("CLASS-01 / D-86-01: installed row renders `(installed) {malformed skill}` at warning severity", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "installed",
            severity: "warning",
            needsReload: true,
            name: "helper",
            version: "1.0.0",
            dependencies: [],
            reasons: ["malformed skill"],
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `A plugin operation needs attention.\n\n● official [user]\n  ● helper v1.0.0 (installed) {malformed skill}\n\n/reload to pick up changes`,
    "warning",
  ]);
});

type Probe = Parameters<typeof composeReasons>[3];

function bothLoadedProbe(): Probe {
  return { piSubagentsLoaded: true, piMcpAdapterLoaded: true };
}

function neitherLoadedProbe(): Probe {
  return { piSubagentsLoaded: false, piMcpAdapterLoaded: false };
}

test("closed notification constants preserve exact public values", () => {
  // arrange
  const expectedGlyphs = ["●", "○", "⊘", "◍", "◌", "◉", "⊖"];
  const expectedMarketplaceStatuses = [
    "added",
    "removed",
    "updated",
    "failed",
    "autoupdate enabled",
    "autoupdate disabled",
    "skipped",
  ];
  const expectedPluginStatuses = [
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
  ];

  // act
  const glyphs = [
    ICON_INSTALLED,
    ICON_AVAILABLE,
    ICON_UNINSTALLABLE,
    ICON_DISABLED,
    ICON_REMOTE,
    ICON_PARTIALLY_INSTALLED,
    ICON_PARTIALLY_AVAILABLE,
  ];

  // assert
  assert.deepStrictEqual(glyphs, expectedGlyphs);
  assert.deepStrictEqual(MARKETPLACE_STATUSES, expectedMarketplaceStatuses);
  assert.deepStrictEqual(PLUGIN_STATUSES, expectedPluginStatuses);
  assert.deepStrictEqual(STATUS_TOKENS, [
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
  ]);
  assert.equal(REASONS.length, 39);
});

for (const { name, input, expected } of [
  {
    name: "redacts a POSIX absolute path to its basename",
    input: "invalid /srv/private/state/config.json detail",
    expected: "invalid config.json detail",
  },
  {
    name: "redacts a Windows drive path to its basename",
    input: String.raw`invalid C:\\Users\\alice\\secret.json detail`,
    expected: "invalid secret.json detail",
  },
  {
    name: "redacts an extended UNC path to its basename",
    input: String.raw`invalid \\?\UNC\server\share\secret.json detail`,
    expected: "invalid secret.json detail",
  },
  {
    name: "preserves a single-segment JSON pointer",
    input: "invalid /schemaVersion detail",
    expected: "invalid /schemaVersion detail",
  },
] as const) {
  test(name, () => {
    // arrange
    const expectedText = expected;

    // act
    const text = redactAbsolutePaths(input);

    // assert
    assert.equal(text, expectedText);
  });
}

for (const { name, parts, expected } of [
  { name: "joins non-empty tokens with one space", parts: ["a", "b"], expected: "a b" },
  { name: "drops empty token slots", parts: ["a", "", "b", ""], expected: "a b" },
  { name: "joins an empty token list as an empty string", parts: [], expected: "" },
] as const) {
  test(name, () => {
    // arrange
    const expectedText = expected;

    // act
    const text = joinTokens(parts);

    // assert
    assert.equal(text, expectedText);
  });
}

for (const { name, version, expected } of [
  { name: "omits an undefined version", version: undefined, expected: "" },
  { name: "omits an empty version", version: "", expected: "" },
  { name: "renders a semantic version", version: "1.2.3", expected: "v1.2.3" },
  { name: "shortens an exact hash version", version: "hash-0123456789ab", expected: "v#0123456" },
  { name: "shortens an exact sha version", version: "sha-abcdef012345", expected: "v#abcdef0" },
  {
    name: "preserves an eleven-digit hash-like version",
    version: "hash-0123456789a",
    expected: "vhash-0123456789a",
  },
  {
    name: "preserves a thirteen-digit hash-like version",
    version: "hash-0123456789abc",
    expected: "vhash-0123456789abc",
  },
  {
    name: "preserves uppercase hash digits",
    version: "hash-0123456789AB",
    expected: "vhash-0123456789AB",
  },
  {
    name: "preserves an eleven-digit sha-like version",
    version: "sha-abcdef01234",
    expected: "vsha-abcdef01234",
  },
  {
    name: "preserves a thirteen-digit sha-like version",
    version: "sha-abcdef0123456",
    expected: "vsha-abcdef0123456",
  },
] as const) {
  test(name, () => {
    // arrange
    const expectedVersion = expected;

    // act
    const renderedVersion = renderVersion(version);

    // assert
    assert.equal(renderedVersion, expectedVersion);
  });
}

for (const { name, pluginScope, marketplaceScope, expected } of [
  {
    name: "omits an absent plugin scope",
    pluginScope: undefined,
    marketplaceScope: "user",
    expected: "",
  },
  {
    name: "omits a matching plugin scope",
    pluginScope: "user",
    marketplaceScope: "user",
    expected: "",
  },
  {
    name: "renders a differing plugin scope",
    pluginScope: "project",
    marketplaceScope: "user",
    expected: "[project]",
  },
] as const) {
  test(name, () => {
    // arrange
    const expectedBracket = expected;

    // act
    const bracket = renderScopeBracket(pluginScope, marketplaceScope);

    // assert
    assert.equal(bracket, expectedBracket);
  });
}

test("composeVersionArrow renders complete version bytes on both sides", () => {
  // arrange
  const expectedArrow = "v#0123456 → v2.0.0";

  // act
  const arrow = composeVersionArrow("hash-0123456789ab", "2.0.0");

  // assert
  assert.equal(arrow, expectedArrow);
});

for (const { name, reasons, agents, mcp, probe, expected } of [
  {
    name: "omits an empty reasons block",
    reasons: undefined,
    agents: false,
    mcp: false,
    probe: bothLoadedProbe(),
    expected: "",
  },
  {
    name: "renders caller reasons in their supplied order",
    reasons: ["not found", "permission denied"] satisfies readonly Reason[],
    agents: false,
    mcp: false,
    probe: bothLoadedProbe(),
    expected: "{not found, permission denied}",
  },
  {
    name: "appends missing companion markers after caller reasons",
    reasons: ["not found"] satisfies readonly Reason[],
    agents: true,
    mcp: true,
    probe: neitherLoadedProbe(),
    expected: "{not found, requires pi-subagents, requires pi-mcp}",
  },
] as const) {
  test(name, () => {
    // arrange
    const expectedReasons = expected;

    // act
    const renderedReasons = composeReasons(reasons, agents, mcp, probe);

    // assert
    assert.equal(renderedReasons, expectedReasons);
  });
}

test("pluginRow composes scope, version, label, and reasons exactly", () => {
  // arrange
  const expectedRow = "⊘ alpha [project] v1.0.0 (failed) {not found}";

  // act
  const row = pluginRow(
    "⊘",
    { name: "alpha", scope: "project", version: "1.0.0", reasons: ["not found"] },
    "user",
    "(failed)",
    bothLoadedProbe(),
  );

  // assert
  assert.equal(row, expectedRow);
});

test("partiallyInstalledRow composes dropped kinds before companion markers", () => {
  // arrange
  const expectedRow = "◉ alpha v1.0.0 (partially-installed) {lsp, requires pi-subagents}";

  // act
  const row = partiallyInstalledRow(
    { name: "alpha", version: "1.0.0", reasons: ["lsp"], dependencies: ["agents"] },
    "user",
    neitherLoadedProbe(),
  );

  // assert
  assert.equal(row, expectedRow);
});

test("installedLikeRow composes an exact transition row", () => {
  // arrange
  const expectedRow = "● alpha [project] v1.0.0 (installed) {orphan rewake}";

  // act
  const row = installedLikeRow(
    "●",
    { name: "alpha", scope: "project", dependencies: [] },
    "user",
    "v1.0.0",
    "(installed)",
    ["orphan rewake"],
    bothLoadedProbe(),
  );

  // assert
  assert.equal(row, expectedRow);
});

for (const { name, row, expected } of [
  {
    name: "renderUninstalledRow renders a realized removal",
    row: () =>
      renderUninstalledRow(
        {
          status: "uninstalled",
          name: "alpha",
          scope: "project",
          version: "1.0.0",
          severity: "info",
          needsReload: true,
        },
        bothLoadedProbe(),
        "user",
      ),
    expected: "○ alpha [project] v1.0.0 (uninstalled)",
  },
  {
    name: "renderAvailableRow renders an entry-derived reason",
    row: () =>
      renderAvailableRow(
        { status: "available", name: "alpha", version: "1.0.0" },
        bothLoadedProbe(),
        "user",
        ["installs disabled"],
      ),
    expected: "○ alpha v1.0.0 (available) {installs disabled}",
  },
  {
    name: "renderRemoteRow renders an entry-derived reason",
    row: () =>
      renderRemoteRow(
        { status: "remote", name: "alpha", version: "1.0.0" },
        bothLoadedProbe(),
        "user",
        ["installs disabled"],
      ),
    expected: "◌ alpha v1.0.0 (remote) {installs disabled}",
  },
  {
    name: "renderUnavailableRow renders structural reasons",
    row: () =>
      renderUnavailableRow(
        { status: "unavailable", name: "alpha", version: "1.0.0", reasons: ["invalid manifest"] },
        bothLoadedProbe(),
        "user",
      ),
    expected: "⊘ alpha v1.0.0 (unavailable) {invalid manifest}",
  },
  {
    name: "renderPartiallyAvailableRow renders dropped kinds",
    row: () =>
      renderPartiallyAvailableRow(
        { status: "partially-available", name: "alpha", version: "1.0.0", reasons: ["lsp"] },
        bothLoadedProbe(),
        "user",
      ),
    expected: "⊖ alpha v1.0.0 (partially-available) {lsp}",
  },
  {
    name: "renderDisabledRow renders an orphan-fold scope and reason",
    row: () =>
      renderDisabledRow(
        {
          status: "disabled",
          name: "alpha",
          scope: "project",
          version: "1.0.0",
          reasons: ["not in manifest"],
          severity: "info",
          needsReload: false,
        },
        bothLoadedProbe(),
        "user",
      ),
    expected: "◍ alpha [project] v1.0.0 (disabled) {not in manifest}",
  },
] as const) {
  test(name, () => {
    // arrange
    const expectedRow = expected;

    // act
    const renderedRow = row();

    // assert
    assert.equal(renderedRow, expectedRow);
  });
}

for (const { name, row, expected } of [
  {
    name: "recognizes an installed list row as scope-bearing",
    row: {
      status: "installed",
      name: "alpha",
      dependencies: [],
      severity: "info",
      needsReload: false,
    } satisfies PluginNotificationMessage,
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
    // arrange
    const expectedDecision = expected;

    // act
    const scopeBearing = isScopeBearingListRow(row);

    // assert
    assert.equal(scopeBearing, expectedDecision);
  });
}

test("notifyDiagnostic ignores an empty detail list", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyDiagnostic(ctx as never, "2 warnings", []);

  // assert
  assert.equal(ctx.ui.notify.mock.callCount(), 0);
});

test("notifyDiagnostic emits the exact warning block", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyDiagnostic(ctx as never, "2 warnings", ["first", "second"]);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "2 warnings\n\nfirst\nsecond",
    "warning",
  ]);
});

test("notifyAsyncRewakeSummary ignores an empty summary", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyAsyncRewakeSummary(ctx as never, "");

  // assert
  assert.equal(ctx.ui.notify.mock.callCount(), 0);
});

test("notifyAsyncRewakeSummary emits an exact info notification", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyAsyncRewakeSummary(ctx as never, "Background hook finished.");

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "Background hook finished.",
    "info",
  ]);
});

test("notifyStopHookOverrideCap emits the exact fixed-cap warning", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyStopHookOverrideCap(ctx as never, "alpha@official");

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "Stop hook override cap reached.\n\n`alpha@official`'s Stop hook blocked 8 times in a row; the turn ended despite its active block.",
    "warning",
  ]);
});

for (const { name, left, right, expected } of [
  {
    name: "sorts unequal names case-insensitively",
    left: { name: "alpha", scope: "user" },
    right: { name: "Beta", scope: "project" },
    expected: -1,
  },
  {
    name: "keeps equal names and equal scopes stable",
    left: { name: "Alpha", scope: "project" },
    right: { name: "alpha", scope: "project" },
    expected: 0,
  },
  {
    name: "sorts project before user for equal names",
    left: { name: "alpha", scope: "project" },
    right: { name: "ALPHA", scope: "user" },
    expected: -1,
  },
  {
    name: "sorts user after project for equal names",
    left: { name: "alpha", scope: "user" },
    right: { name: "ALPHA", scope: "project" },
    expected: 1,
  },
] as const) {
  test(name, () => {
    // arrange
    const expectedOrder = expected;

    // act
    const order = Math.sign(compareByNameThenScope(left, right));

    // assert
    assert.equal(order, expectedOrder);
  });
}

for (const { name, severity, expected } of [
  {
    name: "makeRawNotifyFn preserves an omitted severity",
    severity: undefined,
    expected: ["hello"],
  },
  {
    name: "makeRawNotifyFn preserves an explicit severity",
    severity: "error",
    expected: ["hello", "error"],
  },
] as const) {
  test(name, (t) => {
    // arrange
    const ctx = createContext(t);
    const rawNotify = makeRawNotifyFn(ctx as never);

    // act
    rawNotify("hello", severity);

    // assert
    assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, expected);
  });
}

test("emitContextCascade composes controlled rows, a plural tally, and a reload hint", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const renderCalls: Array<{ name: string; scope: string; probe: Probe }> = [];
  const renderRow = t.mock.fn<Parameters<typeof emitContextCascade>[3]>((row, probe, scope) => {
    renderCalls.push({ name: row.name, scope, probe: { ...probe } });
    return `controlled ${row.status} ${row.name}`;
  });
  const message = {
    kind: "cascade",
    cardinality: "plural",
    label: "Plugin install",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "installed",
            name: "alpha",
            dependencies: [],
            needsReload: true,
          },
        ],
      },
    ],
  };

  // act
  emitContextCascade(ctx as never, pi as never, message as never, renderRow);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user]\n  controlled installed alpha\n\nPlugin install: 1 success\n\n/reload to pick up changes",
  ]);
  assert.deepStrictEqual(renderCalls, [
    {
      name: "alpha",
      scope: "user",
      probe: { piSubagentsLoaded: true, piMcpAdapterLoaded: true },
    },
  ]);
});

test("emitContextCascade renders an empty cascade sentinel", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const renderRow = t.mock.fn<Parameters<typeof emitContextCascade>[3]>(() => "unused");
  const message = { kind: "cascade", marketplaces: [] } satisfies Parameters<
    typeof emitContextCascade
  >[2];

  // act
  emitContextCascade(ctx as never, pi as never, message, renderRow);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, ["(no marketplaces)"]);
  assert.equal(renderRow.mock.callCount(), 0);
});

test("emitUpdateNoOpCascade emits only the fixed headline for an empty cascade", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const renderRow = t.mock.fn<Parameters<typeof emitUpdateNoOpCascade>[3]>(() => "unused");
  const message = { kind: "cascade", marketplaces: [] } satisfies Parameters<
    typeof emitUpdateNoOpCascade
  >[2];

  // act
  emitUpdateNoOpCascade(ctx as never, pi as never, message, renderRow);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "Plugin update: nothing to update",
  ]);
  assert.equal(renderRow.mock.callCount(), 0);
});

test("emitUpdateNoOpCascade keeps a benign body above the fixed headline", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const renderRow = t.mock.fn<Parameters<typeof emitUpdateNoOpCascade>[3]>(
    () => "● alpha (partially-upgradable) {lsp}",
  );
  const message = {
    kind: "cascade",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "partially-upgradable",
            name: "alpha",
            reasons: ["lsp"],
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  } satisfies Parameters<typeof emitUpdateNoOpCascade>[2];

  // act
  emitUpdateNoOpCascade(ctx as never, pi as never, message, renderRow);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user]\n  ● alpha (partially-upgradable) {lsp}\n\nPlugin update: nothing to update",
  ]);
  assert.equal(renderRow.mock.callCount(), 1);
});

test("emitReconcileAppliedContextCascade suppresses reload while preserving tally and severity", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const renderRow = t.mock.fn<Parameters<typeof emitReconcileAppliedContextCascade>[3]>(
    () => "⊘ alpha (failed) {not found}",
  );
  const message = {
    kind: "reconcile-applied-cascade",
    cardinality: "plural",
    label: "Reconcile",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "failed",
            name: "alpha",
            reasons: ["not found"],
            severity: "error",
            needsReload: true,
          },
        ],
      },
    ],
  } satisfies Parameters<typeof emitReconcileAppliedContextCascade>[2];

  // act
  emitReconcileAppliedContextCascade(ctx as never, pi as never, message, renderRow);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A plugin operation has failed.\n\n● official [user]\n  ⊘ alpha (failed) {not found}\n\nReconcile: 1 failure",
    "error",
  ]);
  assert.equal(renderRow.mock.callCount(), 1);
});

test("notify renders a central remote row without inferred reasons", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "remote", name: "alpha", version: "sha-abcdef012345" }],
      },
    ],
  } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi as never, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user]\n  ◌ alpha v#abcdef0 (remote)",
  ]);
});

test("notify counts a warning in a plural tally", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = {
    kind: "cascade",
    cardinality: "plural",
    label: "Plugin update",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            name: "alpha",
            reasons: ["not installed"],
            severity: "warning",
            needsReload: false,
          },
        ],
      },
    ],
  } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi as never, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A plugin operation needs attention.\n\n● official [user]\n  ⊘ alpha (skipped) {not installed}\n\nPlugin update: 1 warning",
    "warning",
  ]);
});

for (const { name, tally, expected } of [
  {
    name: "a positive override tally renders the supplied verb",
    tally: { verb: "updated", count: 2 },
    expected: "(no marketplaces)\n\nPlugin update: 2 updated",
  },
  {
    name: "a zero override tally contributes no line",
    tally: { verb: "updated", count: 0 },
    expected: "(no marketplaces)",
  },
] as const) {
  test(name, (t) => {
    // arrange
    const ctx = createContext(t);
    const pi = piWithBothLoaded();
    const message = {
      kind: "cascade",
      cardinality: "plural",
      label: "Plugin update",
      tally,
      marketplaces: [],
    } satisfies NotificationMessage;

    // act
    notify(ctx as never, pi as never, message);

    // assert
    assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [expected]);
  });
}

test("a marketplace-level reload stamp emits the trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        status: "added",
        severity: "info",
        needsReload: true,
        plugins: [],
      },
    ],
  } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi as never, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user] (added)\n\n/reload to pick up changes",
  ]);
});

test("marketplace info renders complete URL-source fields", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = {
    kind: "marketplace-info",
    name: "remote-mp",
    scope: "user",
    details: { autoupdate: true, lastUpdatedAt: "2026-08-29T12:00:00Z" },
    source: { sourceKind: "url", url: "https://example.test/repo.git", ref: "main" },
    description: "Remote marketplace",
  } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi as never, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● remote-mp [user] <autoupdate>\nurl: https://example.test/repo.git#main\nlast_updated: 2026-08-29T12:00:00Z\ndescription: Remote marketplace",
  ]);
});

for (const { name, plugin, expected } of [
  {
    name: "plugin info renders a partially-installed row",
    plugin: {
      status: "partially-installed",
      name: "alpha",
      version: "1.0.0",
      reasons: ["lsp"],
      componentsResolved: false,
    } satisfies PluginInfoRow,
    expected:
      "● official [user] <autoupdate>\n  ◉ alpha v1.0.0 (partially-installed) {lsp}\n    components: not resolved",
  },
  {
    name: "plugin info renders a disabled row",
    plugin: {
      status: "disabled",
      name: "alpha",
      version: "1.0.0",
      reasons: ["not in manifest"],
      componentsResolved: false,
    } satisfies PluginInfoRow,
    expected:
      "● official [user] <autoupdate>\n  ◍ alpha v1.0.0 (disabled) {not in manifest}\n    components: not resolved",
  },
  {
    name: "plugin info renders a remote row",
    plugin: {
      status: "remote",
      name: "alpha",
      version: "1.0.0",
      componentsResolved: false,
    } satisfies PluginInfoRow,
    expected:
      "● official [user] <autoupdate>\n  ◌ alpha v1.0.0 (remote)\n    components: not resolved",
  },
  {
    name: "plugin info renders a partially-available row",
    plugin: {
      status: "partially-available",
      name: "alpha",
      version: "1.0.0",
      reasons: ["lsp"],
      componentsResolved: false,
    } satisfies PluginInfoRow,
    expected:
      "● official [user] <autoupdate>\n  ⊖ alpha v1.0.0 (partially-available) {lsp}\n    components: not resolved",
  },
] as const) {
  test(name, (t) => {
    // arrange
    const ctx = createContext(t);
    const pi = piWithBothLoaded();
    const message = {
      kind: "plugin-info",
      marketplaceName: "official",
      marketplaceScope: "user",
      marketplaceDetails: { autoupdate: true },
      plugin,
    } satisfies NotificationMessage;

    // act
    notify(ctx as never, pi as never, message);

    // assert
    assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [expected]);
  });
}

test("reconcile-pending-empty emits the exact zero-action advisory", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = { kind: "reconcile-pending-empty" } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi as never, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "Pending: next reload will apply 0 actions.",
  ]);
});

test("context emission renders the disabled enable hint", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const renderRow = t.mock.fn<Parameters<typeof emitContextCascade>[3]>(
    () => "◍ alpha v1.0.0 (disabled)",
  );
  const message = {
    kind: "cascade",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "disabled",
            name: "alpha",
            version: "1.0.0",
            enableHint: true,
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  } satisfies Parameters<typeof emitContextCascade>[2];

  // act
  emitContextCascade(ctx as never, pi as never, message, renderRow);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user]\n  ◍ alpha v1.0.0 (disabled)\n    Run enable on this plugin to use its components.",
  ]);
});

test("reconcile applied summarizes mixed failed subjects", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        status: "failed",
        severity: "error",
        needsReload: false,
        reasons: ["network unreachable"],
        plugins: [
          {
            status: "failed",
            name: "alpha",
            reasons: ["not found"],
            severity: "error",
            needsReload: false,
          },
        ],
      },
    ],
  } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi as never, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "Some operations have failed.\n\n⊘ official [user] (failed) {network unreachable}\n  ⊘ alpha (failed) {not found}",
    "error",
  ]);
});

for (const { name, message, expected } of [
  {
    name: "context emission suppresses reload for marketplace info envelopes",
    message: { kind: "marketplace-info", marketplaces: [] },
    expected: ["(no marketplaces)"],
  },
  {
    name: "context emission suppresses reload for plugin info envelopes",
    message: {
      kind: "plugin-info",
      plugin: { status: "available" },
      marketplaces: [],
    },
    expected: ["(no marketplaces)"],
  },
  {
    name: "context emission suppresses reload for marketplace info cascades",
    message: { kind: "marketplace-info-cascade", marketplaces: [] },
    expected: ["(no marketplaces)"],
  },
  {
    name: "context emission suppresses reload for plugin info cascades",
    message: { kind: "plugin-info-cascade", marketplaces: [] },
    expected: ["(no marketplaces)"],
  },
  {
    name: "context emission suppresses reload for absent marketplace envelopes",
    message: { kind: "marketplace-not-added", marketplaces: [] },
    expected: ["A marketplace operation has failed.\n\n(no marketplaces)", "error"],
  },
  {
    name: "context emission suppresses reload for pending-empty envelopes",
    message: { kind: "reconcile-pending-empty", marketplaces: [] },
    expected: ["(no marketplaces)"],
  },
  {
    name: "context emission suppresses reload for reconcile-applied envelopes",
    message: { kind: "reconcile-applied-cascade", marketplaces: [] },
    expected: ["(no marketplaces)"],
  },
] as const) {
  test(name, (t) => {
    // arrange
    const ctx = createContext(t);
    const pi = piWithBothLoaded();
    const renderRow = t.mock.fn<Parameters<typeof emitContextCascade>[3]>(() => "unused");

    // act
    emitContextCascade(ctx as never, pi as never, message as never, renderRow);

    // assert
    assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, expected);
    assert.equal(renderRow.mock.callCount(), 0);
  });
}

test("notify rejects an unknown marketplace status", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = {
    marketplaces: [{ name: "official", scope: "user", status: "corrupted", plugins: [] }],
  };

  // act & assert
  assert.throws(
    () => {
      notify(ctx as never, pi as never, message as never);
    },
    {
      name: "Error",
      message: "Unexpected value: [object Object]",
    },
  );
});

test("notify rejects an unknown plugin status", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "corrupted", name: "alpha" }],
      },
    ],
  };

  // act & assert
  assert.throws(
    () => {
      notify(ctx as never, pi as never, message as never);
    },
    {
      name: "Error",
      message: "Unexpected value: [object Object]",
    },
  );
});

test("notify rejects an unknown marketplace source kind", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = {
    kind: "marketplace-info",
    name: "official",
    scope: "user",
    details: { autoupdate: false },
    source: { sourceKind: "corrupted" },
  };

  // act & assert
  assert.throws(
    () => {
      notify(ctx as never, pi as never, message as never);
    },
    {
      name: "Error",
      message: "Unexpected value: [object Object]",
    },
  );
});

test("notify rejects an unknown plugin-info status", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
    plugin: { status: "corrupted", name: "alpha", componentsResolved: false },
  };

  // act & assert
  assert.throws(
    () => {
      notify(ctx as never, pi as never, message as never);
    },
    {
      name: "Error",
      message: "Unexpected value: corrupted",
    },
  );
});

test("notify rejects an unknown plugin-info component-resolution arm", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
    plugin: { status: "installed", name: "alpha", componentsResolved: "corrupted" },
  };

  // act & assert
  assert.throws(
    () => {
      notify(ctx as never, pi as never, message as never);
    },
    {
      name: "Error",
      message: "Unexpected value: [object Object]",
    },
  );
});

test("notify rejects an unknown top-level kind", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = { kind: "corrupted", marketplaces: [] };

  // act & assert
  assert.throws(
    () => {
      notify(ctx as never, pi as never, message as never);
    },
    {
      name: "Error",
      message: "Unexpected value: [object Object]",
    },
  );
});

test("the standalone dispatcher rejects a discriminator changed after narrowing", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = messageWithKindSequence({}, ["marketplace-info", "corrupted"]);

  // act & assert
  assert.throws(
    () => {
      notify(ctx as never, pi as never, message as never);
    },
    {
      name: "Error",
      message: "Unexpected value: [object Object]",
    },
  );
});

test("severity computation rejects a discriminator changed after narrowing", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = messageWithKindSequence({ name: "official", scope: "user" }, [
    ...Array<string>(11).fill("marketplace-not-added"),
    "corrupted",
  ]);

  // act & assert
  assert.throws(
    () => {
      notify(ctx as never, pi as never, message as never);
    },
    {
      name: "Error",
      message: "Unexpected value: [object Object]",
    },
  );
});

test("summary computation preserves its read-only empty fallback after narrowing", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = messageWithKindSequence({ name: "official", scope: "user" }, [
    ...Array<string>(17).fill("marketplace-not-added"),
    "marketplace-info",
  ]);

  // act
  notify(ctx as never, pi as never, message as never);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "\n\n⊘ official [user] (failed) {not added}",
    "error",
  ]);
});

test("summary computation rejects a discriminator changed after narrowing", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = messageWithKindSequence({ name: "official", scope: "user" }, [
    ...Array<string>(17).fill("marketplace-not-added"),
    "corrupted",
  ]);

  // act & assert
  assert.throws(
    () => {
      notify(ctx as never, pi as never, message as never);
    },
    {
      name: "Error",
      message: "Unexpected value: [object Object]",
    },
  );
});

test("reload-hint computation rejects a discriminator changed after narrowing", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = messageWithKindSequence({ marketplaces: [] }, ["marketplace-info", "corrupted"]);
  const renderRow = t.mock.fn<Parameters<typeof emitContextCascade>[3]>(() => "unused");

  // act & assert
  assert.throws(
    () => {
      emitContextCascade(ctx as never, pi as never, message as never, renderRow);
    },
    {
      name: "Error",
      message: "Unexpected value: [object Object]",
    },
  );
});

test("path redaction preserves a matched token when no separator can be selected", (t) => {
  // arrange
  t.mock.method(String.prototype, "lastIndexOf", () => -1);

  // act
  const redacted = redactAbsolutePaths("/root/secret.txt");
  t.mock.restoreAll();

  // assert
  assert.equal(redacted, "/root/secret.txt");
});

test("a list-surface marketplace with autoupdate disabled omits the marker", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        details: { autoupdate: false },
        plugins: [],
      },
    ],
  } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi as never, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, ["● official [user]"]);
});

test("a warning reconcile cascade summarizes a marketplace subject", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        status: "skipped",
        reasons: ["already installed"],
        severity: "warning",
        needsReload: false,
        plugins: [],
      },
    ],
  } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi as never, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A marketplace operation needs attention.\n\n● official [user] (skipped) {already installed}",
    "warning",
  ]);
});

test("a non-failed plugin fallback preserves the empty standalone summary", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  let statusIndex = 0;
  const statuses = ["available", "available", "failed", "available"] as const;
  const plugin = Object.defineProperty({ name: "alpha", componentsResolved: false }, "status", {
    enumerable: true,
    get() {
      const status = statuses[Math.min(statusIndex, statuses.length - 1)]!;
      statusIndex++;
      return status;
    },
  });
  const message = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
    plugin,
  };

  // act
  notify(ctx as never, pi as never, message as never);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "\n\n● official [user] <no autoupdate>\n  ○ alpha (available)\n    components: not resolved",
    "error",
  ]);
});

test("a defined empty cause does not add an indented cause trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "failed",
            name: "alpha",
            reasons: ["not found"],
            severity: "error",
            needsReload: false,
            cause: null,
          },
        ],
      },
    ],
  };

  // act
  notify(ctx as never, pi as never, message as never);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A plugin operation has failed.\n\n● official [user]\n  ⊘ alpha (failed) {not found}",
    "error",
  ]);
});

test("a URL marketplace without a ref omits the fragment suffix", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = {
    kind: "marketplace-info",
    name: "official",
    scope: "user",
    details: { autoupdate: false },
    source: { sourceKind: "url", url: "https://example.com/marketplace.git" },
  } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi as never, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user] <no autoupdate>\nurl: https://example.com/marketplace.git",
  ]);
});

test("an absent marketplace without a scope omits the scope bracket", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = {
    kind: "marketplace-not-added",
    name: "official",
  } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi as never, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A marketplace operation has failed.\n\n⊘ official (failed) {not added}",
    "error",
  ]);
});

test("an empty applied reconcile cascade renders the empty sentinel", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = {
    kind: "reconcile-applied-cascade",
    marketplaces: [],
  } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi as never, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, ["(no marketplaces)"]);
});

test("a failed stale-gate row emits its dedicated recovery trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "failed",
            name: "alpha",
            reasons: ["lsp"],
            severity: "error",
            needsReload: false,
            partialHint: true,
          },
        ],
      },
    ],
  } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi as never, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A plugin operation has failed.\n\n● official [user]\n  ⊘ alpha (failed) {lsp}\n    Run update --partial on this plugin, then enable it again.",
    "error",
  ]);
});

test("the central disabled arm preserves a caller-stamped reason", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "disabled",
            name: "alpha",
            version: "1.0.0",
            reasons: ["not in manifest"],
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi as never, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user]\n  ◍ alpha v1.0.0 (disabled) {not in manifest}",
  ]);
});

for (const { name, plugin, expected } of [
  {
    name: "the central available arm omits a reason that no central producer stamps",
    plugin: {
      status: "available",
      name: "alpha",
      version: "1.0.0",
      reasons: ["installs disabled"],
    },
    expected: "● official [user]\n  ○ alpha v1.0.0 (available)",
  },
  {
    name: "the central remote arm omits a reason that no central producer stamps",
    plugin: {
      status: "remote",
      name: "alpha",
      version: "1.0.0",
      reasons: ["installs disabled"],
    },
    expected: "● official [user]\n  ◌ alpha v1.0.0 (remote)",
  },
] as const) {
  test(name, (t) => {
    // arrange
    const ctx = createContext(t);
    const pi = piWithBothLoaded();
    const message = {
      marketplaces: [{ name: "official", scope: "user", plugins: [plugin] }],
    } satisfies NotificationMessage;

    // act
    notify(ctx as never, pi as never, message);

    // assert
    assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [expected]);
  });
}

for (const { name, reasons, expected } of [
  {
    name: "plugin info preserves a stamped reason on an available row",
    reasons: ["installs disabled"],
    expected:
      "● official [user] <autoupdate>\n  ○ alpha v1.0.0 (available) {installs disabled}\n    components: not resolved",
  },
  {
    name: "plugin info omits the reasons brace when reasons are absent",
    reasons: undefined,
    expected:
      "● official [user] <autoupdate>\n  ○ alpha v1.0.0 (available)\n    components: not resolved",
  },
  {
    name: "plugin info omits the reasons brace when reasons are empty",
    reasons: [],
    expected:
      "● official [user] <autoupdate>\n  ○ alpha v1.0.0 (available)\n    components: not resolved",
  },
] as const) {
  test(name, (t) => {
    // arrange
    const ctx = createContext(t);
    const pi = piWithBothLoaded();
    const plugin = {
      status: "available",
      name: "alpha",
      version: "1.0.0",
      componentsResolved: false,
      ...(reasons === undefined ? {} : { reasons }),
    } satisfies PluginInfoRow;
    const message = {
      kind: "plugin-info",
      marketplaceName: "official",
      marketplaceScope: "user",
      marketplaceDetails: { autoupdate: true },
      plugin,
    } satisfies NotificationMessage;

    // act
    notify(ctx as never, pi as never, message);

    // assert
    assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [expected]);
  });
}

test("a single-target label remains inert without plural cardinality", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithBothLoaded();
  const message = {
    label: "Plugin uninstall",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "failed",
            name: "alpha",
            reasons: ["not installed"],
            severity: "error",
            needsReload: false,
          },
        ],
      },
    ],
  } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi as never, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A plugin operation has failed.\n\n● official [user]\n  ⊘ alpha (failed) {not installed}",
    "error",
  ]);
});
