import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";

import { ManualRecoveryError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  emitContextCascade,
  emitReconcileAppliedContextCascade,
  emitUpdateNoOpCascade,
  makeRawNotifyFn,
  notify,
  notifyAsyncRewakeSummary,
  notifyDiagnostic,
  notifyMcpConfigNotices,
  notifyMcpMigration,
  notifyStopHookOverrideCap,
  notifyUsageError,
  notifyUsageInfo,
} from "../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";
import { adapterCommand } from "../platform/pi-inventory-seed.ts";

import type {
  CommandInventoryItem,
  SoftDepStatus,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type {
  CascadeNotificationMessage,
  NotificationMessage,
  PluginInfoRow,
  UsageErrorMessage,
} from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

interface NotificationContext {
  readonly ui: { readonly notify: ReturnType<TestContext["mock"]["fn"]> };
}

function createContext(t: TestContext): NotificationContext {
  return { ui: { notify: t.mock.fn() } };
}

interface ToolDefinition {
  readonly name?: string;
  readonly sourceInfo?: { readonly source?: string };
}

interface NotificationApi {
  readonly getAllTools: () => ToolDefinition[];
  readonly getCommands: () => CommandInventoryItem[];
}

/**
 * Probe reports all three companions loaded -- pi-subagents, pi-mcp-adapter and
 * the host workflow engine -- so no soft-dep marker fires on any row, whatever
 * that row declares.
 */
function piWithAllLoaded(): NotificationApi {
  return {
    getAllTools: () => [{ name: "subagent" }, { name: "workflow_control" }],
    getCommands: () => [adapterCommand()],
  };
}

function piWithSubagentsLoaded(): NotificationApi {
  return {
    getAllTools: () => [{ name: "subagent" }],
    getCommands: () => [],
  };
}

function piWithMcpLoaded(): NotificationApi {
  return {
    getAllTools: () => [],
    getCommands: () => [adapterCommand()],
  };
}

function piWithNothingLoaded(): NotificationApi {
  return {
    getAllTools: () => [],
    getCommands: () => [],
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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v1.0.0 → v1.1.0 (updated) {requires pi-mcp-adapter}\n\n/reload to pick up changes`,
  ]);
});

test("notify renders reinstalled plugin with both deps loaded (no soft-dep marker, empty brace suppressed)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user]\n  ⊖ clangd-lsp v1.0.0 (partially-available) {lsp}`,
  ]);
});

test("XSURF-01: partially-available install-failure row with partialHint emits the --partial install trailer", (t) => {
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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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

test("XSURF-03: partially-upgradable update-decline row with partialHint emits the --partial update trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args[1], "warning");
  assert.equal(
    args[0],
    `A plugin operation needs attention.\n\n● demo [user]\n  ● clean-plugin v1.0.0 (partially-upgradable) {lsp}\n    Re-run with --partial to update with the supported components.`,
  );
});

test("XSURF-03: list-inventory partially-upgradable row WITHOUT partialHint stays byte-frozen (no trailer)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user]\n  ● commit-commands v1.0.0 (upgradable) {stale clone}`,
  ]);
});

test("FSTAT-02 / D-66-03: partially-installed renders the ◉ glyph distinct from ● installed", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

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

test("WR-03: partially-installed success row threads dependencies -> soft-dep marker fires in the SAME brace as the dropped-component reason", (t) => {
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
  notify(ctx as never, pi, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    `● official [user]\n  ◉ helper v1.0.0 (partially-installed) {lsp, requires pi-subagents}\n\n/reload to pick up changes`,
  );
});

test("WR-03: partially-installed INVENTORY row (no dependencies) renders no soft-dep marker even when a companion is unloaded", (t) => {
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
  notify(ctx as never, pi, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    `● official [user]\n  ◉ degraded-plugin v1.0.0 (partially-installed) {lsp}`,
  );
});

test("FSTAT-04 / D-66-03: partially-upgradable reuses the ● glyph like the upgradable arm", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● demo [user]\n  ● clean-plugin v1.0.0 (partially-upgradable) {unsupported hooks}`,
  );
});

test("FSTAT-06 / D-66-04: the will-install partial modifier renders (will partially install)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(args[0], `● new-mp [user]\n  ● degraded-plugin (will partially install)`);
});

test("FSTAT-06 / D-66-04: will-install WITHOUT the partial modifier renders (will install)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments.length, 1);
});

test('UXG-05: marketplace update no-op (mp.skipped + reasons:["up-to-date"], plugins:[]) renders `● <mp> [<scope>] (skipped) {up-to-date}`, computes info (benign per UXG-02 / D-28-07), emits NO /reload trailer', (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● demo [user] (added)`]);
});

test("RLD-04: list-shaped message with an installed inventory row (needsReload:false) emits NO /reload trailer (RLD-02 OR-reduce)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;

  // assert
  assert.equal(body, "● official [user]\n  ○ gamma v2.0.0 (available)");
});

test("PL-4: description exactly 66 chars -- emitted verbatim (no truncation)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;

  // assert
  assert.equal(body, "● official [user]\n  ○ gamma (available)");
});

test("D-22-04 NEGATIVE: empty `marketplace add` ({status:'added', plugins:[]}) emits NO /reload trailer (SNM-33 / G-MIL-01)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "local-mp", scope: "user", status: "added", plugins: [] }],
  };

  // act
  notify(ctx as never, pi, msg);

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
  const pi = piWithAllLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "local-mp", scope: "user", status: "removed", plugins: [] }],
  };

  // act
  notify(ctx as never, pi, msg);

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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`(no marketplaces)`]);
});

test("WR-06: notify folds caller-supplied advisory lines between the body and the tally", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [],
    advisories: ["first advisory", "second advisory"],
  };

  // act
  notify(ctx as never, pi, msg);

  // assert
  assert.strictEqual(ctx.ui.notify.mock.calls.length, 1);
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "(no marketplaces)\n\nfirst advisory\nsecond advisory",
  ]);
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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);
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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v#2ea95f8 (installed)\n\n/reload to pick up changes`,
  ]);
});

test("notify renders update arrow with hash on both sides as v#<7hex> → v#<7hex> via composeVersionArrow (SNM-35)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  notify(ctx as never, pi, msg);

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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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

test("GRAM-01 / GRAM-02: standalone {marketplace not added} row renders the two-block summary + separate detail block (marketplace subject, error severity)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-not-added",
    name: "my-mp",
    scope: "user",
  };

  // act
  notify(ctx as never, pi, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A marketplace operation has failed.\n\n⊘ my-mp [user] (failed) {marketplace not added}",
    "error",
  ]);
});

test("GRAM-02: standalone failed plugin-info renders `A plugin operation has failed.` + separate multi-line detail block", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

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

test("INFO-04: {marketplace not added} row never carries a reload-hint (read-only surface)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-not-added",
    name: "my-mp",
    scope: "user",
  };

  // act
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-info",
    name: "official",
    scope: "user",
    details: { autoupdate: true, lastUpdatedAt: "2026-05-01T12:34:56Z" },
    source: { sourceKind: "github", owner: "acolombo", repo: "official", ref: "main" },
    description: "The official Claude plugin marketplace.",
  };

  // act
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-info",
    name: "local-mp",
    scope: "project",
    details: { autoupdate: false },
    source: { sourceKind: "path", absPath: "/home/user/projects/local-mp" },
  };

  // act
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
        mcp: [{ name: "plugin:alpha:c" }],
        skills: ["d"],
      },
    },
  };

  // act
  notify(ctx as never, pi, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(
    args[0],
    [
      "● official [user] <autoupdate>",
      "  ● alpha v1.0.0 (installed)",
      "    agents: a",
      "    commands: b",
      "    mcp: plugin:alpha:c",
      "    skills: d",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("SURF-02: lenient `HookSummaryEntry` arm renders `<event> (unsupported)` when supported=false, bare `<event>` when supported=true", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctxNoKind as never, pi, noKindMsg);

  // act
  notify(ctxWithKind as never, pi, withKindMsg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(args[0], `● new-mp [user]\n  ● alpha (will install)`);
});

test("DIFF-02: will-uninstall plugin under existing (no-status) marketplace block", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● mp [user]\n  ○ old-plugin (will uninstall)`);
});

test("DIFF-02: will-enable + will-disable rows under same marketplace", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● mp [user]\n  ● to-enable (will enable)\n  ◍ to-disable (will disable)`);
});

test("DIFF-02: cross-scope orphan-fold -- plugin scope differs from marketplace scope -> [scope] bracket renders", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● shared [project]\n  ● alpha [user] (will install)`);
});

test("DIFF-02: will-* cascade emits NO /reload to pick up changes trailer (pending rows are pre-transition)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
});

test("D-54-01: (disabled) inventory row renders subject-first with version under list-arm marketplace (info severity, no /reload)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● official [user] <autoupdate>\n  ◍ foo-plugin v1.2.3 (disabled)`);
});

test("D-54-01: (disabled) inventory row without version omits the v<version> slot cleanly", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● official [user]\n  ◍ foo-plugin (disabled)`);
});

test("D-54-01: (disabled) inventory row with orphan-fold scope bracket -- explicit p.scope differs from mp.scope", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● shared [user]\n  ◍ foo-plugin [project] v1.2.3 (disabled)`);
});

test("D-54-01: (disabled) inventory row WITHOUT orphan-fold -- p.scope matches mp.scope -> no row bracket", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● official [user]\n  ◍ foo-plugin v1.2.3 (disabled)`);
});

test("UAT-03 / RLD-05: a fresh (disabled) row stamping needsReload:true DOES emit the /reload trailer (realized transition; byte-identical row form)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 1);
  assert.equal(args[0], `● claude-plugins-official [user]\n  ◍ foo-plugin v1.2.3 (disabled)`);
});

test("D-54-01 / ENBL idempotency: (skipped) {already enabled} row routes to info severity (benign reason)", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
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
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;

  // assert
  assert.equal(args.length, 2);
  assert.equal(args[1], "error");
  assert.equal(
    args[0],
    `A marketplace operation has failed.\n\n⊘ claude-plugins.json [project] (failed) {invalid manifest}`,
  );
});

test("SURF-05 / D-63-08: installed row renders `(installed) {orphan rewake}` via the existing reasons brace", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● official [user]\n  ● helper v1.0.0 (installed) {orphan rewake}\n\n/reload to pick up changes`,
  ]);
});

test("CLASS-01 / D-86-01: installed row renders `(installed) {malformed skill}` at warning severity", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, msg);

  // assert
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `A plugin operation needs attention.\n\n● official [user]\n  ● helper v1.0.0 (installed) {malformed skill}\n\n/reload to pick up changes`,
    "warning",
  ]);
});

test("notify renders a central remote row without inferred reasons", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user]\n  ◌ alpha v#abcdef0 (remote)",
  ]);
});

test("notify counts a warning in a plural tally", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, message);

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
    const pi = piWithAllLoaded();
    const message = {
      kind: "cascade",
      cardinality: "plural",
      label: "Plugin update",
      tally,
      marketplaces: [],
    } satisfies NotificationMessage;

    // act
    notify(ctx as never, pi, message);

    // assert
    assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [expected]);
  });
}

test("an empty default plural cascade emits only its sentinel", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
  const message = {
    kind: "cascade",
    cardinality: "plural",
    label: "Marketplace list",
    marketplaces: [],
  } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, ["(no marketplaces)"]);
});

test("a marketplace-level reload stamp emits the trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user] (added)\n\n/reload to pick up changes",
  ]);
});

test("marketplace info renders complete URL-source fields", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
  const message = {
    kind: "marketplace-info",
    name: "remote-mp",
    scope: "user",
    details: { autoupdate: true, lastUpdatedAt: "2026-08-29T12:00:00Z" },
    source: { sourceKind: "url", url: "https://example.test/repo.git", ref: "main" },
    description: "Remote marketplace",
  } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi, message);

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
    const pi = piWithAllLoaded();
    const message = {
      kind: "plugin-info",
      marketplaceName: "official",
      marketplaceScope: "user",
      marketplaceDetails: { autoupdate: true },
      plugin,
    } satisfies NotificationMessage;

    // act
    notify(ctx as never, pi, message);

    // assert
    assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [expected]);
  });
}

test("reconcile-pending-empty emits the exact zero-action advisory", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
  const message = { kind: "reconcile-pending-empty" } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "Pending: next reload will apply 0 actions.",
  ]);
});

for (const scope of ["user", "project"] as const) {
  test(`prune-empty emits the scoped informational sentence for ${scope}`, (t) => {
    // arrange
    const ctx = createContext(t);
    const pi = piWithAllLoaded();
    const message = { kind: "prune-empty", scope } satisfies NotificationMessage;

    // act
    notify(ctx as never, pi, message);

    // assert
    assert.deepStrictEqual(
      ctx.ui.notify.mock.calls.map((call) => call.arguments),
      [[`Nothing to prune in ${scope} scope: no orphaned dependency installs were found.`]],
    );
  });
}

test("prune-committed-warning reports a saved scope and requests reload", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
  const message = {
    kind: "prune-committed-warning",
    scope: "project",
    cause: new Error("lock release failed after save"),
  } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi, message);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        "Prune committed; finalization needs attention.\n\n" +
          "Prune committed in project scope.\n" +
          "  cause: lock release failed after save\n\n" +
          "/reload to pick up changes",
        "warning",
      ],
    ],
  );
});

test("context emission renders the disabled enable hint", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  emitContextCascade(ctx as never, pi, message, renderRow);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user]\n  ◍ alpha v1.0.0 (disabled)\n    Run enable on this plugin to use its components.",
  ]);
});

test("reconcile applied summarizes mixed failed subjects", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, message);

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
    const pi = piWithAllLoaded();
    const renderRow = t.mock.fn<Parameters<typeof emitContextCascade>[3]>(() => "unused");

    // act
    emitContextCascade(ctx as never, pi, message as never, renderRow);

    // assert
    assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, expected);
    assert.strictEqual(renderRow.mock.callCount(), 0);
  });
}

test("summary computation preserves its read-only empty fallback after narrowing", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
  const message = messageWithKindSequence({ name: "official", scope: "user" }, [
    ...Array<string>(17).fill("marketplace-not-added"),
    "marketplace-info",
  ]);

  // act
  notify(ctx as never, pi, message as never);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "\n\n⊘ official [user] (failed) {marketplace not added}",
    "error",
  ]);
});

test("a list-surface marketplace with autoupdate disabled omits the marker", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, ["● official [user]"]);
});

test("a warning reconcile cascade summarizes a marketplace subject", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A marketplace operation needs attention.\n\n● official [user] (skipped) {already installed}",
    "warning",
  ]);
});

test("a non-failed plugin fallback preserves the empty standalone summary", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, message as never);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "\n\n● official [user] <no autoupdate>\n  ○ alpha (available)\n    components: not resolved",
    "error",
  ]);
});

test("a defined empty cause does not add an indented cause trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, message as never);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A plugin operation has failed.\n\n● official [user]\n  ⊘ alpha (failed) {not found}",
    "error",
  ]);
});

test("a URL marketplace without a ref omits the fragment suffix", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
  const message = {
    kind: "marketplace-info",
    name: "official",
    scope: "user",
    details: { autoupdate: false },
    source: { sourceKind: "url", url: "https://example.com/marketplace.git" },
  } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user] <no autoupdate>\nurl: https://example.com/marketplace.git",
  ]);
});

test("an absent marketplace without a scope omits the scope bracket", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
  const message = {
    kind: "marketplace-not-added",
    name: "official",
  } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A marketplace operation has failed.\n\n⊘ official (failed) {marketplace not added}",
    "error",
  ]);
});

for (const { scope, expectedReason } of [
  { scope: "user", expectedReason: "marketplace not added to user scope" },
  { scope: "project", expectedReason: "marketplace not added to project scope" },
] as const) {
  test(`an absent marketplace present in the other scope names the ${scope} scope that missed`, (t) => {
    // arrange
    const ctx = createContext(t);
    const pi = piWithAllLoaded();
    const message = {
      kind: "marketplace-not-added",
      name: "official",
      scope,
      presentInOtherScope: true,
    } satisfies NotificationMessage;

    // act
    notify(ctx as never, pi, message);

    // assert
    assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
      `A marketplace operation has failed.\n\n⊘ official [${scope}] (failed) {${expectedReason}}`,
      "error",
    ]);
  });
}

test("an absent marketplace claiming a sibling scope with no bracket keeps the plain token", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
  const message = {
    kind: "marketplace-not-added",
    name: "official",
    presentInOtherScope: true,
  } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A marketplace operation has failed.\n\n⊘ official (failed) {marketplace not added}",
    "error",
  ]);
});

test("an empty applied reconcile cascade renders the empty sentinel", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
  const message = {
    kind: "reconcile-applied-cascade",
    marketplaces: [],
  } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, ["(no marketplaces)"]);
});

test("a failed stale-gate row emits its dedicated recovery trailer", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A plugin operation has failed.\n\n● official [user]\n  ⊘ alpha (failed) {lsp}\n    Run update --partial on this plugin, then enable it again.",
    "error",
  ]);
});

test("the central disabled arm preserves a caller-stamped reason", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, message);

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
    const pi = piWithAllLoaded();
    const message = {
      marketplaces: [{ name: "official", scope: "user", plugins: [plugin] }],
    } satisfies NotificationMessage;

    // act
    notify(ctx as never, pi, message);

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
    const pi = piWithAllLoaded();
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
    notify(ctx as never, pi, message);

    // assert
    assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [expected]);
  });
}

test("a single-target label remains inert without plural cardinality", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  notify(ctx as never, pi, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A plugin operation has failed.\n\n● official [user]\n  ⊘ alpha (failed) {not installed}",
    "error",
  ]);
});

test("diagnostic dispatch preserves empty and ordered warning captures", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyDiagnostic(ctx as never, "Warnings", []);
  notifyDiagnostic(ctx as never, "Warnings", ["first", "second"]);

  // assert
  assert.equal(ctx.ui.notify.mock.callCount(), 1);
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "Warnings\n\nfirst\nsecond",
    "warning",
  ]);
});

test("async rewake dispatch preserves empty and repeated input behavior", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyAsyncRewakeSummary(ctx as never, "");
  notifyAsyncRewakeSummary(ctx as never, "ready");
  notifyAsyncRewakeSummary(ctx as never, "ready");

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      ["ready", "info"],
      ["ready", "info"],
    ],
  );
});

test("stop override dispatch preserves exact warning bytes", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyStopHookOverrideCap(ctx as never, "official:guard");

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "Stop hook override cap reached.\n\n`official:guard`'s Stop hook blocked 8 times in a row; the turn ended despite its active block.",
    "warning",
  ]);
});

test("AFILE-04: an empty MCP config notice list sends nothing", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, []);

  // assert
  assert.equal(ctx.ui.notify.mock.callCount(), 0);
});

test("AFILE-04: one comments-dropped notice sends its exact warning bytes", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    { kind: "comments-dropped", scope: "user", file: "mcp-adapter.json" },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        "MCP config comments removed.\n\nThe user-scope mcp-adapter.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.",
        "warning",
      ],
    ],
  );
});

test("AFILE-04: comments-dropped notices for two scopes share one warning with a line each", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    { kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" },
    { kind: "comments-dropped", scope: "user", file: "mcp-adapter.json" },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        "MCP config comments removed.\n\n" +
          "The project-scope mcp-adapter.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.\n" +
          "The user-scope mcp-adapter.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.",
        "warning",
      ],
    ],
  );
});

test("AFILE-04: a repeated MCP config notice renders once", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    { kind: "left-unchanged", scope: "project", file: "mcp-adapter.json" },
    { kind: "left-unchanged", scope: "project", file: "mcp-adapter.json" },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        "MCP config left unchanged.\n\nThe project-scope mcp-adapter.json is not a valid MCP config, so it was left unchanged. Fix it before you install or update a plugin that has MCP servers.",
        "warning",
      ],
    ],
  );
});

test("AFILE-04: mixed MCP config notices send comments-dropped first, then left-unchanged", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    { kind: "left-unchanged", scope: "user", file: "mcp-adapter.json" },
    { kind: "comments-dropped", scope: "project", file: "mcp.json" },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        "MCP config comments removed.\n\nThe project-scope mcp.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.",
        "warning",
      ],
      [
        "MCP config left unchanged.\n\nThe user-scope mcp-adapter.json is not a valid MCP config, so it was left unchanged. Fix it before you install or update a plugin that has MCP servers.",
        "warning",
      ],
    ],
  );
});

test("AFILE-06: one override-kept notice sends its exact warning bytes", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    {
      kind: "override-kept",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "srv",
      fields: ["env", "headers"],
    },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        'MCP server override kept.\n\nhello now provides "srv" in the project-scope mcp-adapter.json. Your override for "srv" is kept, but these fields of it stop applying: env, headers. It comes back when you uninstall or disable hello.',
        "warning",
      ],
    ],
  );
});

test("AFILE-06: override-kept notices for two servers share one warning with a line each, in list order", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    {
      kind: "override-kept",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "alpha",
      fields: ["env"],
    },
    {
      kind: "override-kept",
      scope: "user",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "beta",
      fields: ["cwd"],
    },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        "MCP server override kept.\n\n" +
          'hello now provides "alpha" in the project-scope mcp-adapter.json. Your override for "alpha" is kept, but these fields of it stop applying: env. It comes back when you uninstall or disable hello.\n' +
          'hello now provides "beta" in the user-scope mcp-adapter.json. Your override for "beta" is kept, but these fields of it stop applying: cwd. It comes back when you uninstall or disable hello.',
        "warning",
      ],
    ],
  );
});

test("AFILE-06: a repeated override-kept notice renders once", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    {
      kind: "override-kept",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "srv",
      fields: ["env", "headers"],
    },
    {
      kind: "override-kept",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "srv",
      fields: ["env", "headers"],
    },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        'MCP server override kept.\n\nhello now provides "srv" in the project-scope mcp-adapter.json. Your override for "srv" is kept, but these fields of it stop applying: env, headers. It comes back when you uninstall or disable hello.',
        "warning",
      ],
    ],
  );
});

test("AFILE-06: mixed MCP config notices send comments-dropped, then left-unchanged, then override-kept", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    {
      kind: "override-kept",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "srv",
      fields: ["env", "headers"],
    },
    { kind: "left-unchanged", scope: "project", file: "mcp-adapter.json" },
    { kind: "comments-dropped", scope: "user", file: "mcp-adapter.json" },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        "MCP config comments removed.\n\nThe user-scope mcp-adapter.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.",
        "warning",
      ],
      [
        "MCP config left unchanged.\n\nThe project-scope mcp-adapter.json is not a valid MCP config, so it was left unchanged. Fix it before you install or update a plugin that has MCP servers.",
        "warning",
      ],
      [
        'MCP server override kept.\n\nhello now provides "srv" in the project-scope mcp-adapter.json. Your override for "srv" is kept, but these fields of it stop applying: env, headers. It comes back when you uninstall or disable hello.',
        "warning",
      ],
    ],
  );
});

test("AFILE-06: an override-restored notice alone sends nothing", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    { kind: "override-restored", scope: "project", file: "mcp-adapter.json", server: "srv" },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [],
  );
});

test("AFILE-06: an override-restored notice cancels an earlier override-kept notice for the same server", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    {
      kind: "override-kept",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "srv",
      fields: ["env", "headers"],
    },
    { kind: "override-restored", scope: "project", file: "mcp-adapter.json", server: "srv" },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [],
  );
});

test("AFILE-06: an override-kept notice after an override-restored notice for the same server stands", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    { kind: "override-restored", scope: "project", file: "mcp-adapter.json", server: "srv" },
    {
      kind: "override-kept",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "srv",
      fields: ["env", "headers"],
    },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        'MCP server override kept.\n\nhello now provides "srv" in the project-scope mcp-adapter.json. Your override for "srv" is kept, but these fields of it stop applying: env, headers. It comes back when you uninstall or disable hello.',
        "warning",
      ],
    ],
  );
});

test("AFILE-06: a restore for another server, scope or file leaves the override-kept line standing", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    {
      kind: "override-kept",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "srv",
      fields: ["env", "headers"],
    },
    { kind: "override-restored", scope: "project", file: "mcp-adapter.json", server: "other" },
    { kind: "override-restored", scope: "user", file: "mcp-adapter.json", server: "srv" },
    { kind: "override-restored", scope: "project", file: "mcp.json", server: "srv" },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        'MCP server override kept.\n\nhello now provides "srv" in the project-scope mcp-adapter.json. Your override for "srv" is kept, but these fields of it stop applying: env, headers. It comes back when you uninstall or disable hello.',
        "warning",
      ],
    ],
  );
});

test("AFILE-06: comments-dropped notices still render beside a cancelled override", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    { kind: "comments-dropped", scope: "user", file: "mcp-adapter.json" },
    {
      kind: "override-kept",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "srv",
      fields: ["env", "headers"],
    },
    { kind: "override-restored", scope: "project", file: "mcp-adapter.json", server: "srv" },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        "MCP config comments removed.\n\nThe user-scope mcp-adapter.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.",
        "warning",
      ],
    ],
  );
});

test("AVAR-04: variables-missing notices for two servers send MCP server variables not set. with a line each", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    {
      kind: "variables-missing",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_alpha_",
      names: ["DD_API_KEY", "DD_SITE"],
    },
    {
      kind: "variables-missing",
      scope: "user",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_beta_",
      names: ["BETA_TOKEN"],
    },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        "MCP server variables not set.\n\n" +
          'Server "plugin_hello_alpha_" from hello in the project-scope mcp-adapter.json uses environment variables that were not set at install: DD_API_KEY, DD_SITE.\n' +
          'Server "plugin_hello_beta_" from hello in the user-scope mcp-adapter.json uses environment variables that were not set at install: BETA_TOKEN.',
        "warning",
      ],
    ],
  );
});

test("AVAR-04: a repeated variables-missing notice renders once", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    {
      kind: "variables-missing",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      names: ["DD_SITE"],
    },
    {
      kind: "variables-missing",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      names: ["DD_SITE"],
    },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        'MCP server variables not set.\n\nServer "plugin_hello_srv_" from hello in the project-scope mcp-adapter.json uses environment variables that were not set at install: DD_SITE.',
        "warning",
      ],
    ],
  );
});

test("AVAR-04: a variables-missing notice listed first still sends after the override-kept warning", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    {
      kind: "variables-missing",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      names: ["DD_SITE"],
    },
    {
      kind: "override-kept",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      fields: ["env"],
    },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        'MCP server override kept.\n\nhello now provides "plugin_hello_srv_" in the project-scope mcp-adapter.json. Your override for "plugin_hello_srv_" is kept, but these fields of it stop applying: env. It comes back when you uninstall or disable hello.',
        "warning",
      ],
      [
        'MCP server variables not set.\n\nServer "plugin_hello_srv_" from hello in the project-scope mcp-adapter.json uses environment variables that were not set at install: DD_SITE.',
        "warning",
      ],
    ],
  );
});

test("AVAR-05: credentials-blanked notices for two servers send MCP server credentials withheld. with a line each", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    {
      kind: "credentials-blanked",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_alpha_",
      names: ["ANTHROPIC_API_KEY", "AWS_SESSION_TOKEN"],
    },
    {
      kind: "credentials-blanked",
      scope: "user",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_beta_",
      names: ["NPM_TOKEN"],
    },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        "MCP server credentials withheld.\n\n" +
          'Server "plugin_hello_alpha_" from hello in the project-scope mcp-adapter.json references credential variables that Claude Code never sends to a remote server: ANTHROPIC_API_KEY, AWS_SESSION_TOKEN. They were written as empty values.\n' +
          'Server "plugin_hello_beta_" from hello in the user-scope mcp-adapter.json references credential variables that Claude Code never sends to a remote server: NPM_TOKEN. They were written as empty values.',
        "warning",
      ],
    ],
  );
});

test("AVAR-05: a repeated credentials-blanked notice renders once", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    {
      kind: "credentials-blanked",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      names: ["ANTHROPIC_API_KEY"],
    },
    {
      kind: "credentials-blanked",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      names: ["ANTHROPIC_API_KEY"],
    },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        'MCP server credentials withheld.\n\nServer "plugin_hello_srv_" from hello in the project-scope mcp-adapter.json references credential variables that Claude Code never sends to a remote server: ANTHROPIC_API_KEY. They were written as empty values.',
        "warning",
      ],
    ],
  );
});

test("AVAR-05: a credentials-blanked notice listed first still sends after the variables-missing warning", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    {
      kind: "credentials-blanked",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      names: ["ANTHROPIC_API_KEY"],
    },
    {
      kind: "variables-missing",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      names: ["DD_SITE"],
    },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        'MCP server variables not set.\n\nServer "plugin_hello_srv_" from hello in the project-scope mcp-adapter.json uses environment variables that were not set at install: DD_SITE.',
        "warning",
      ],
      [
        'MCP server credentials withheld.\n\nServer "plugin_hello_srv_" from hello in the project-scope mcp-adapter.json references credential variables that Claude Code never sends to a remote server: ANTHROPIC_API_KEY. They were written as empty values.',
        "warning",
      ],
    ],
  );
});

test("AFILE-04: notices of every kind send one warning per kind in section order", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    {
      kind: "leftover-removed",
      scope: "user",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "srv",
    },
    {
      kind: "tool-rules-unenforced",
      scope: "user",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      fields: ["toolPermissions"],
    },
    {
      kind: "credentials-blanked",
      scope: "user",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      names: ["ANTHROPIC_API_KEY"],
    },
    {
      kind: "variables-missing",
      scope: "user",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      names: ["DD_SITE"],
    },
    {
      kind: "override-kept",
      scope: "user",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      fields: ["env"],
    },
    { kind: "left-unchanged", scope: "user", file: "mcp.json" },
    { kind: "comments-dropped", scope: "user", file: "mcp.json" },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        "MCP config comments removed.\n\nThe user-scope mcp.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.",
        "warning",
      ],
      [
        "MCP config left unchanged.\n\nThe user-scope mcp.json is not a valid MCP config, so it was left unchanged. Fix it before you install or update a plugin that has MCP servers.",
        "warning",
      ],
      [
        'MCP server override kept.\n\nhello now provides "plugin_hello_srv_" in the user-scope mcp-adapter.json. Your override for "plugin_hello_srv_" is kept, but these fields of it stop applying: env. It comes back when you uninstall or disable hello.',
        "warning",
      ],
      [
        'MCP server variables not set.\n\nServer "plugin_hello_srv_" from hello in the user-scope mcp-adapter.json uses environment variables that were not set at install: DD_SITE.',
        "warning",
      ],
      [
        'MCP server credentials withheld.\n\nServer "plugin_hello_srv_" from hello in the user-scope mcp-adapter.json references credential variables that Claude Code never sends to a remote server: ANTHROPIC_API_KEY. They were written as empty values.',
        "warning",
      ],
      [
        'MCP server tool rules not enforced.\n\nServer "plugin_hello_srv_" from hello in the user-scope mcp-adapter.json declares tool permission rules that pi-mcp-adapter does not enforce: toolPermissions. Its tools run without these rules.',
        "warning",
      ],
      [
        'Old MCP server settings removed.\n\nRemoved "srv" from the user-scope mcp-adapter.json: pi-mcp-adapter had written it under the old name of a server from hello, for example for /mcp-adapter disable, and it no longer applies.',
        "warning",
      ],
    ],
  );
});

test("ANAME-07: tool-rules-unenforced notices send MCP server tool rules not enforced. after the credentials-withheld warning, with a line each", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    {
      kind: "tool-rules-unenforced",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_alpha_",
      fields: ["tools[].permission_policy", "toolPermissions"],
    },
    {
      kind: "credentials-blanked",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_alpha_",
      names: ["ANTHROPIC_API_KEY"],
    },
    {
      kind: "tool-rules-unenforced",
      scope: "user",
      file: "mcp-adapter.json",
      plugin: "acme",
      server: "plugin_acme_beta_",
      fields: ["tools[].permission_policy"],
    },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        'MCP server credentials withheld.\n\nServer "plugin_hello_alpha_" from hello in the project-scope mcp-adapter.json references credential variables that Claude Code never sends to a remote server: ANTHROPIC_API_KEY. They were written as empty values.',
        "warning",
      ],
      [
        "MCP server tool rules not enforced.\n\n" +
          'Server "plugin_hello_alpha_" from hello in the project-scope mcp-adapter.json declares tool permission rules that pi-mcp-adapter does not enforce: tools[].permission_policy, toolPermissions. Its tools run without these rules.\n' +
          'Server "plugin_acme_beta_" from acme in the user-scope mcp-adapter.json declares tool permission rules that pi-mcp-adapter does not enforce: tools[].permission_policy. Its tools run without these rules.',
        "warning",
      ],
    ],
  );
});

test("ANAME-07: a repeated tool-rules-unenforced notice renders once", (t) => {
  // arrange
  const ctx = createContext(t);
  const toolRules = {
    kind: "tool-rules-unenforced",
    scope: "project",
    file: "mcp-adapter.json",
    plugin: "hello",
    server: "plugin_hello_srv_",
    fields: ["toolPermissions"],
  } as const;

  // act
  notifyMcpConfigNotices(ctx as never, [toolRules, toolRules]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        'MCP server tool rules not enforced.\n\nServer "plugin_hello_srv_" from hello in the project-scope mcp-adapter.json declares tool permission rules that pi-mcp-adapter does not enforce: toolPermissions. Its tools run without these rules.',
        "warning",
      ],
    ],
  );
});

test("AMIG-01: leftover-removed notices send Old MCP server settings removed. after the tool-rules warning, with a line each", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    {
      kind: "leftover-removed",
      scope: "user",
      file: "mcp-adapter.json",
      plugin: "acme",
      server: "github",
    },
    {
      kind: "tool-rules-unenforced",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      fields: ["toolPermissions"],
    },
    {
      kind: "leftover-removed",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "srv",
    },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        'MCP server tool rules not enforced.\n\nServer "plugin_hello_srv_" from hello in the project-scope mcp-adapter.json declares tool permission rules that pi-mcp-adapter does not enforce: toolPermissions. Its tools run without these rules.',
        "warning",
      ],
      [
        "Old MCP server settings removed.\n\n" +
          'Removed "github" from the user-scope mcp-adapter.json: pi-mcp-adapter had written it under the old name of a server from acme, for example for /mcp-adapter disable, and it no longer applies.\n' +
          'Removed "srv" from the project-scope mcp-adapter.json: pi-mcp-adapter had written it under the old name of a server from hello, for example for /mcp-adapter disable, and it no longer applies.',
        "warning",
      ],
    ],
  );
});

test("AMIG-01: a repeated leftover-removed notice renders once", (t) => {
  // arrange
  const ctx = createContext(t);
  const leftover = {
    kind: "leftover-removed",
    scope: "project",
    file: "mcp-adapter.json",
    plugin: "hello",
    server: "srv",
  } as const;

  // act
  notifyMcpConfigNotices(ctx as never, [leftover, leftover]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        'Old MCP server settings removed.\n\nRemoved "srv" from the project-scope mcp-adapter.json: pi-mcp-adapter had written it under the old name of a server from hello, for example for /mcp-adapter disable, and it no longer applies.',
        "warning",
      ],
    ],
  );
});

test("AMIG-01: control characters in a leftover's old name render as \\u escapes", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyMcpConfigNotices(ctx as never, [
    {
      kind: "leftover-removed",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "s\u001b[2Jr\nv",
    },
  ]);

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [
      [
        'Old MCP server settings removed.\n\nRemoved "s\\u001b[2Jr\\u000av" from the project-scope mcp-adapter.json: pi-mcp-adapter had written it under the old name of a server from hello, for example for /mcp-adapter disable, and it no longer applies.',
        "warning",
      ],
    ],
  );
});

const MCP_MIGRATION_COST_LINE =
  "The new names reset what pi-mcp-adapter keeps for each server name: sign in again to servers that use OAuth, and approve project servers again. Until you reload, pi-mcp-adapter can still show the old names.";

describe("notifyMcpMigration", () => {
  test("AMIG-03: a report with no row sends nothing, even with config notices", (t) => {
    // arrange
    const ctx = createContext(t);

    // act
    notifyMcpMigration(ctx as never, {
      rows: [],
      notices: [{ kind: "comments-dropped", scope: "project", file: "mcp.json" }],
    });

    // assert
    assert.equal(ctx.ui.notify.mock.callCount(), 0);
  });

  test("AMIG-03: moved rows sort project first, then by plugin and old name in code-unit order, at info", (t) => {
    // arrange
    const ctx = createContext(t);

    // act
    notifyMcpMigration(ctx as never, {
      rows: [
        {
          kind: "moved",
          scope: "user",
          plugin: "acme",
          marketplace: "mp",
          from: "srv",
          to: "plugin_acme_srv_",
        },
        {
          kind: "moved",
          scope: "project",
          plugin: "beta",
          marketplace: "mp",
          from: "alpha",
          to: "plugin_beta_alpha_",
        },
        {
          kind: "moved",
          scope: "project",
          plugin: "acme",
          marketplace: "mp",
          from: "web",
          to: "plugin_acme_web_",
        },
        {
          kind: "moved",
          scope: "project",
          plugin: "acme",
          marketplace: "mp",
          from: "api",
          to: "plugin_acme_api_",
        },
        {
          kind: "moved",
          scope: "project",
          plugin: "Zed",
          marketplace: "mp",
          from: "srv",
          to: "plugin_Zed_srv_",
        },
      ],
      notices: [],
    });

    // assert
    assert.deepStrictEqual(
      ctx.ui.notify.mock.calls.map((call) => call.arguments),
      [
        [
          [
            "Plugin MCP servers moved from mcp.json to mcp-adapter.json.",
            "",
            "Moved to mcp-adapter.json:",
            "  srv -> plugin_Zed_srv_ (Zed) [project]",
            "  api -> plugin_acme_api_ (acme) [project]",
            "  web -> plugin_acme_web_ (acme) [project]",
            "  alpha -> plugin_beta_alpha_ (beta) [project]",
            "  srv -> plugin_acme_srv_ (acme) [user]",
            MCP_MIGRATION_COST_LINE,
            "/reload to pick up changes",
          ].join("\n"),
          "info",
        ],
      ],
    );
  });

  test("AMIG-03: a stopped row with nothing moved is a warning with no cost line and no reload hint", (t) => {
    // arrange
    const ctx = createContext(t);

    // act
    notifyMcpMigration(ctx as never, {
      rows: [{ kind: "stopped", scope: "user", detail: "state.json is locked" }],
      notices: [],
    });

    // assert
    assert.deepStrictEqual(
      ctx.ui.notify.mock.calls.map((call) => call.arguments),
      [
        [
          "Plugin MCP servers in mcp.json need attention.\n\nLeft in mcp.json:\n  The user-scope move stopped: state.json is locked. The next /reload tries again.",
          "warning",
        ],
      ],
    );
  });

  test("AMIG-03: moved and stopped rows share one warning, stopped rows sorted by scope then detail", (t) => {
    // arrange
    const ctx = createContext(t);

    // act
    notifyMcpMigration(ctx as never, {
      rows: [
        { kind: "stopped", scope: "user", detail: "b@mp: denied" },
        { kind: "stopped", scope: "project", detail: "z@mp: denied" },
        {
          kind: "moved",
          scope: "user",
          plugin: "acme",
          marketplace: "mp",
          from: "srv",
          to: "plugin_acme_srv_",
        },
        { kind: "stopped", scope: "project", detail: "a@mp: denied" },
      ],
      notices: [],
    });

    // assert
    assert.deepStrictEqual(
      ctx.ui.notify.mock.calls.map((call) => call.arguments),
      [
        [
          [
            "Plugin MCP servers in mcp.json need attention.",
            "",
            "Moved to mcp-adapter.json:",
            "  srv -> plugin_acme_srv_ (acme) [user]",
            "Left in mcp.json:",
            "  The project-scope move stopped: a@mp: denied. The next /reload tries again.",
            "  The project-scope move stopped: z@mp: denied. The next /reload tries again.",
            "  The user-scope move stopped: b@mp: denied. The next /reload tries again.",
            MCP_MIGRATION_COST_LINE,
            "/reload to pick up changes",
          ].join("\n"),
          "warning",
        ],
      ],
    );
  });

  test("AMIG-03: config notices render as their distinct lines after the cost line, in section order, at warning", (t) => {
    // arrange
    const ctx = createContext(t);
    const variablesMissing = {
      kind: "variables-missing",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "acme",
      server: "plugin_acme_srv_",
      names: ["TOKEN"],
    } as const;

    // act
    notifyMcpMigration(ctx as never, {
      rows: [
        {
          kind: "moved",
          scope: "project",
          plugin: "acme",
          marketplace: "mp",
          from: "srv",
          to: "plugin_acme_srv_",
        },
      ],
      notices: [
        variablesMissing,
        { kind: "comments-dropped", scope: "project", file: "mcp.json" },
        variablesMissing,
      ],
    });

    // assert
    assert.deepStrictEqual(
      ctx.ui.notify.mock.calls.map((call) => call.arguments),
      [
        [
          [
            "Plugin MCP servers moved from mcp.json to mcp-adapter.json.",
            "",
            "Moved to mcp-adapter.json:",
            "  srv -> plugin_acme_srv_ (acme) [project]",
            MCP_MIGRATION_COST_LINE,
            "The project-scope mcp.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.",
            'Server "plugin_acme_srv_" from acme in the project-scope mcp-adapter.json uses environment variables that were not set at install: TOKEN.',
            "/reload to pick up changes",
          ].join("\n"),
          "warning",
        ],
      ],
    );
  });

  test("AMIG-03: a tool-rules-unenforced notice renders its line after the credentials-withheld line, at warning", (t) => {
    // arrange
    const ctx = createContext(t);

    // act
    notifyMcpMigration(ctx as never, {
      rows: [
        {
          kind: "moved",
          scope: "project",
          plugin: "acme",
          marketplace: "mp",
          from: "srv",
          to: "plugin_acme_srv_",
        },
      ],
      notices: [
        {
          kind: "tool-rules-unenforced",
          scope: "project",
          file: "mcp-adapter.json",
          plugin: "acme",
          server: "plugin_acme_srv_",
          fields: ["tools[].permission_policy", "toolPermissions"],
        },
        {
          kind: "credentials-blanked",
          scope: "project",
          file: "mcp-adapter.json",
          plugin: "acme",
          server: "plugin_acme_srv_",
          names: ["NPM_TOKEN"],
        },
      ],
    });

    // assert
    assert.deepStrictEqual(
      ctx.ui.notify.mock.calls.map((call) => call.arguments),
      [
        [
          [
            "Plugin MCP servers moved from mcp.json to mcp-adapter.json.",
            "",
            "Moved to mcp-adapter.json:",
            "  srv -> plugin_acme_srv_ (acme) [project]",
            MCP_MIGRATION_COST_LINE,
            'Server "plugin_acme_srv_" from acme in the project-scope mcp-adapter.json references credential variables that Claude Code never sends to a remote server: NPM_TOKEN. They were written as empty values.',
            'Server "plugin_acme_srv_" from acme in the project-scope mcp-adapter.json declares tool permission rules that pi-mcp-adapter does not enforce: tools[].permission_policy, toolPermissions. Its tools run without these rules.',
            "/reload to pick up changes",
          ].join("\n"),
          "warning",
        ],
      ],
    );
  });

  for (const { notice, severity } of [
    {
      notice: {
        kind: "variables-missing",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "acme",
        server: "plugin_acme_srv_",
        names: ["TOKEN"],
      },
      severity: "warning",
    },
    {
      notice: {
        kind: "credentials-blanked",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "acme",
        server: "plugin_acme_srv_",
        names: ["NPM_TOKEN"],
      },
      severity: "warning",
    },
    {
      notice: {
        kind: "tool-rules-unenforced",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "acme",
        server: "plugin_acme_srv_",
        fields: ["toolPermissions"],
      },
      severity: "warning",
    },
    {
      notice: { kind: "comments-dropped", scope: "project", file: "mcp.json" },
      severity: "info",
    },
  ] as const) {
    test(`AMIG-03: a ${notice.kind} notice alone sends an all-moved report at ${severity}`, (t) => {
      // arrange
      const ctx = createContext(t);

      // act
      notifyMcpMigration(ctx as never, {
        rows: [
          {
            kind: "moved",
            scope: "project",
            plugin: "acme",
            marketplace: "mp",
            from: "srv",
            to: "plugin_acme_srv_",
          },
        ],
        notices: [notice],
      });

      // assert
      assert.deepStrictEqual(
        ctx.ui.notify.mock.calls.map((call) => call.arguments[1]),
        [severity],
      );
    });
  }

  test("AMIG-03: a leftover-removed notice makes an all-moved report a warning, its line last", (t) => {
    // arrange
    const ctx = createContext(t);

    // act
    notifyMcpMigration(ctx as never, {
      rows: [
        {
          kind: "moved",
          scope: "project",
          plugin: "acme",
          marketplace: "mp",
          from: "srv",
          to: "plugin_acme_srv_",
        },
      ],
      notices: [
        {
          kind: "leftover-removed",
          scope: "project",
          file: "mcp-adapter.json",
          plugin: "acme",
          server: "srv",
        },
        {
          kind: "tool-rules-unenforced",
          scope: "project",
          file: "mcp-adapter.json",
          plugin: "acme",
          server: "plugin_acme_srv_",
          fields: ["toolPermissions"],
        },
      ],
    });

    // assert
    assert.deepStrictEqual(
      ctx.ui.notify.mock.calls.map((call) => call.arguments),
      [
        [
          [
            "Plugin MCP servers moved from mcp.json to mcp-adapter.json.",
            "",
            "Moved to mcp-adapter.json:",
            "  srv -> plugin_acme_srv_ (acme) [project]",
            MCP_MIGRATION_COST_LINE,
            'Server "plugin_acme_srv_" from acme in the project-scope mcp-adapter.json declares tool permission rules that pi-mcp-adapter does not enforce: toolPermissions. Its tools run without these rules.',
            'Removed "srv" from the project-scope mcp-adapter.json: pi-mcp-adapter had written it under the old name of a server from acme, for example for /mcp-adapter disable, and it no longer applies.',
            "/reload to pick up changes",
          ].join("\n"),
          "warning",
        ],
      ],
    );
  });

  test("AMIG-03: control characters in names and details render as \\u escapes", (t) => {
    // arrange
    const ctx = createContext(t);

    // act
    notifyMcpMigration(ctx as never, {
      rows: [
        {
          kind: "moved",
          scope: "project",
          plugin: "ac\u0000me",
          marketplace: "mp",
          from: "s\u001b[2Jrv",
          to: "plugin_acme_srv_",
        },
        { kind: "stopped", scope: "project", detail: "line\nbreak\u007f\u009f\u00a0" },
      ],
      notices: [],
    });

    // assert
    assert.deepStrictEqual(
      ctx.ui.notify.mock.calls.map((call) => call.arguments),
      [
        [
          [
            "Plugin MCP servers in mcp.json need attention.",
            "",
            "Moved to mcp-adapter.json:",
            "  s\\u001b[2Jrv -> plugin_acme_srv_ (ac\\u0000me) [project]",
            "Left in mcp.json:",
            "  The project-scope move stopped: line\\u000abreak\\u007f\\u009f\u00a0. The next /reload tries again.",
            MCP_MIGRATION_COST_LINE,
            "/reload to pick up changes",
          ].join("\n"),
          "warning",
        ],
      ],
    );
  });

  test("AMIG-01 / AMIG-04: each left-in-place kind renders its remedy, project first, with no cost line and no reload hint", (t) => {
    // arrange
    const ctx = createContext(t);

    // act
    notifyMcpMigration(ctx as never, {
      rows: [
        {
          kind: "collision",
          scope: "user",
          plugin: "dbtools",
          marketplace: "official",
          servers: ["db"],
          key: "plugin_dbtools_db_",
          source: "user-scope mcp-adapter.json",
        },
        {
          kind: "source-unreadable",
          scope: "user",
          plugin: "acme",
          marketplace: "official",
          servers: ["github", "slack"],
        },
        {
          kind: "unowned",
          scope: "project",
          plugin: "gone",
          marketplace: "mp",
          servers: ["orphan"],
        },
        { kind: "file-unreadable", scope: "project", file: "mcp-adapter.json" },
      ],
      notices: [],
    });

    // assert
    assert.deepStrictEqual(
      ctx.ui.notify.mock.calls.map((call) => call.arguments),
      [
        [
          [
            "Plugin MCP servers in mcp.json need attention.",
            "",
            "Left in mcp.json:",
            "  The project-scope mcp-adapter.json is not a valid MCP config, so nothing in this scope moved. Fix it, then run /reload.",
            "  orphan (gone) [project] No plugin installed in the project scope owns it. Install gone@mp or remove it from mcp.json.",
            "  github, slack (acme) [user] The plugin source is not available offline. Run /claude:plugin reinstall acme@official to move it.",
            "  db (dbtools) [user] plugin_dbtools_db_ is already defined in the user-scope mcp-adapter.json, so no server of dbtools moved. Remove or rename that server, then run /reload.",
          ].join("\n"),
          "warning",
        ],
      ],
    );
  });

  for (const { row, line } of [
    {
      row: { kind: "unowned", scope: "user", plugin: "p", marketplace: "m", servers: ["s"] },
      line: "  s (p) [user] No plugin installed in the user scope owns it. Install p@m or remove it from mcp.json.",
    },
    {
      row: { kind: "not-listed", scope: "user", plugin: "p", marketplace: "m", servers: ["s"] },
      line: "  s (p) [user] The m marketplace no longer lists p in a valid form. Run /claude:plugin marketplace update m, or /claude:plugin uninstall p@m to remove it.",
    },
    {
      row: {
        kind: "source-unreadable",
        scope: "user",
        plugin: "p",
        marketplace: "m",
        servers: ["s"],
      },
      line: "  s (p) [user] The plugin source is not available offline. Run /claude:plugin reinstall p@m to move it.",
    },
    {
      row: {
        kind: "marketplace-unreadable",
        scope: "user",
        plugin: "p",
        marketplace: "m",
        servers: ["s"],
      },
      line: "  s (p) [user] The m marketplace copy cannot give the source of p. Run /claude:plugin marketplace update m, or /claude:plugin uninstall p@m to remove it.",
    },
    {
      row: {
        kind: "collision",
        scope: "user",
        plugin: "p",
        marketplace: "m",
        servers: ["s"],
        key: "plugin_p_s_",
        source: "mcp.json",
      },
      line: "  s (p) [user] plugin_p_s_ is already defined in the mcp.json, so no server of p moved. Remove or rename that server, then run /reload.",
    },
    {
      row: { kind: "file-unreadable", scope: "user", file: "mcp.json" },
      line: "  The user-scope mcp.json is not a valid MCP config, so nothing in this scope moved. Fix it, then run /reload.",
    },
  ] as const) {
    test(`AMIG-03: a ${row.kind} row beside a moved row makes the notice a warning that keeps the reload hint`, (t) => {
      // arrange
      const ctx = createContext(t);

      // act
      notifyMcpMigration(ctx as never, {
        rows: [
          row,
          {
            kind: "moved",
            scope: "project",
            plugin: "acme",
            marketplace: "mp",
            from: "srv",
            to: "plugin_acme_srv_",
          },
        ],
        notices: [],
      });

      // assert
      assert.deepStrictEqual(
        ctx.ui.notify.mock.calls.map((call) => call.arguments),
        [
          [
            [
              "Plugin MCP servers in mcp.json need attention.",
              "",
              "Moved to mcp-adapter.json:",
              "  srv -> plugin_acme_srv_ (acme) [project]",
              "Left in mcp.json:",
              line,
              MCP_MIGRATION_COST_LINE,
              "/reload to pick up changes",
            ].join("\n"),
            "warning",
          ],
        ],
      );
    });
  }

  test("AMIG-03: left-in-place rows sort with the stopped rows by scope, then plugin, then first old name", (t) => {
    // arrange
    const ctx = createContext(t);

    // act
    notifyMcpMigration(ctx as never, {
      rows: [
        { kind: "unowned", scope: "project", plugin: "b", marketplace: "mp", servers: ["x"] },
        { kind: "stopped", scope: "project", detail: "a@mp: denied" },
        { kind: "unowned", scope: "project", plugin: "a", marketplace: "mp", servers: ["z", "b"] },
        { kind: "unowned", scope: "user", plugin: "a", marketplace: "mp", servers: ["a"] },
        {
          kind: "source-unreadable",
          scope: "project",
          plugin: "a",
          marketplace: "other",
          servers: ["m"],
        },
        { kind: "file-unreadable", scope: "project", file: "mcp.json" },
      ],
      notices: [],
    });

    // assert
    assert.deepStrictEqual(
      ctx.ui.notify.mock.calls.map((call) => call.arguments),
      [
        [
          [
            "Plugin MCP servers in mcp.json need attention.",
            "",
            "Left in mcp.json:",
            "  The project-scope mcp.json is not a valid MCP config, so nothing in this scope moved. Fix it, then run /reload.",
            "  m (a) [project] The plugin source is not available offline. Run /claude:plugin reinstall a@other to move it.",
            "  z, b (a) [project] No plugin installed in the project scope owns it. Install a@mp or remove it from mcp.json.",
            "  The project-scope move stopped: a@mp: denied. The next /reload tries again.",
            "  x (b) [project] No plugin installed in the project scope owns it. Install b@mp or remove it from mcp.json.",
            "  a (a) [user] No plugin installed in the user scope owns it. Install a@mp or remove it from mcp.json.",
          ].join("\n"),
          "warning",
        ],
      ],
    );
  });

  test("AMIG-04: control characters in a left-in-place row's file-derived strings render as \\u escapes", (t) => {
    // arrange
    const ctx = createContext(t);

    // act
    notifyMcpMigration(ctx as never, {
      rows: [
        {
          kind: "collision",
          scope: "project",
          plugin: "p\u001b",
          marketplace: "m\u0007",
          servers: ["s\nx", "t"],
          key: "k\u009b",
          source: "f\r.json",
        },
        {
          kind: "unowned",
          scope: "user",
          plugin: "q\u0000",
          marketplace: "m\u007f",
          servers: ["o"],
        },
        {
          kind: "source-unreadable",
          scope: "user",
          plugin: "r",
          marketplace: "m\u0085",
          servers: ["u"],
        },
      ],
      notices: [],
    });

    // assert
    assert.deepStrictEqual(
      ctx.ui.notify.mock.calls.map((call) => call.arguments),
      [
        [
          [
            "Plugin MCP servers in mcp.json need attention.",
            "",
            "Left in mcp.json:",
            "  s\\u000ax, t (p\\u001b) [project] k\\u009b is already defined in the f\\u000d.json, so no server of p\\u001b moved. Remove or rename that server, then run /reload.",
            "  o (q\\u0000) [user] No plugin installed in the user scope owns it. Install q\\u0000@m\\u007f or remove it from mcp.json.",
            "  u (r) [user] The plugin source is not available offline. Run /claude:plugin reinstall r@m\\u0085 to move it.",
          ].join("\n"),
          "warning",
        ],
      ],
    );
  });

  test("AMIG-03: removed rows render between moved and left-in-place rows, each with its reason, at warning", (t) => {
    // arrange
    const ctx = createContext(t);

    // act
    notifyMcpMigration(ctx as never, {
      rows: [
        {
          kind: "removed",
          scope: "user",
          plugin: "broken",
          marketplace: "mp",
          server: "bad",
          cause: "malformed",
        },
        {
          kind: "unowned",
          scope: "project",
          plugin: "ghost",
          marketplace: "mp",
          servers: ["old"],
        },
        {
          kind: "removed",
          scope: "project",
          plugin: "hello",
          marketplace: "mp",
          server: "live",
          cause: "unsupported-feature",
          feature: "ws",
        },
        {
          kind: "removed",
          scope: "project",
          plugin: "hello",
          marketplace: "mp",
          server: "gone",
          cause: "not-declared",
        },
        {
          kind: "removed",
          scope: "project",
          plugin: "acme",
          marketplace: "mp",
          server: "srv",
          cause: "disabled",
        },
        {
          kind: "moved",
          scope: "project",
          plugin: "hello",
          marketplace: "mp",
          from: "srv",
          to: "plugin_hello_srv_",
        },
      ],
      notices: [],
    });

    // assert
    assert.deepStrictEqual(
      ctx.ui.notify.mock.calls.map((call) => call.arguments),
      [
        [
          [
            "Plugin MCP servers in mcp.json need attention.",
            "",
            "Moved to mcp-adapter.json:",
            "  srv -> plugin_hello_srv_ (hello) [project]",
            "Removed from mcp.json:",
            "  srv (acme) [project] acme is disabled.",
            "  gone (hello) [project] hello no longer declares it.",
            "  live (hello) [project] {unsupported mcp} ws: pi-mcp-adapter cannot run it.",
            "  bad (broken) [user] {malformed mcp}: broken's MCP config is not valid, so none of its servers are installed.",
            "Left in mcp.json:",
            "  old (ghost) [project] No plugin installed in the project scope owns it. Install ghost@mp or remove it from mcp.json.",
            MCP_MIGRATION_COST_LINE,
            "/reload to pick up changes",
          ].join("\n"),
          "warning",
        ],
      ],
    );
  });

  test("AMIG-03: not-declared and disabled removals alone stay info, with no cost line but the reload hint", (t) => {
    // arrange
    const ctx = createContext(t);

    // act
    notifyMcpMigration(ctx as never, {
      rows: [
        {
          kind: "removed",
          scope: "project",
          plugin: "hello",
          marketplace: "mp",
          server: "gone",
          cause: "not-declared",
        },
        {
          kind: "removed",
          scope: "project",
          plugin: "acme",
          marketplace: "mp",
          server: "srv",
          cause: "disabled",
        },
      ],
      notices: [],
    });

    // assert
    assert.deepStrictEqual(
      ctx.ui.notify.mock.calls.map((call) => call.arguments),
      [
        [
          [
            "Plugin MCP servers removed from mcp.json.",
            "",
            "Removed from mcp.json:",
            "  srv (acme) [project] acme is disabled.",
            "  gone (hello) [project] hello no longer declares it.",
            "/reload to pick up changes",
          ].join("\n"),
          "info",
        ],
      ],
    );
  });

  test("AMIG-03: a move with a not-declared removal stays info", (t) => {
    // arrange
    const ctx = createContext(t);

    // act
    notifyMcpMigration(ctx as never, {
      rows: [
        {
          kind: "moved",
          scope: "user",
          plugin: "hello",
          marketplace: "mp",
          from: "srv",
          to: "plugin_hello_srv_",
        },
        {
          kind: "removed",
          scope: "user",
          plugin: "hello",
          marketplace: "mp",
          server: "gone",
          cause: "not-declared",
        },
      ],
      notices: [],
    });

    // assert
    assert.deepStrictEqual(
      ctx.ui.notify.mock.calls.map((call) => call.arguments),
      [
        [
          [
            "Plugin MCP servers moved from mcp.json to mcp-adapter.json.",
            "",
            "Moved to mcp-adapter.json:",
            "  srv -> plugin_hello_srv_ (hello) [user]",
            "Removed from mcp.json:",
            "  gone (hello) [user] hello no longer declares it.",
            MCP_MIGRATION_COST_LINE,
            "/reload to pick up changes",
          ].join("\n"),
          "info",
        ],
      ],
    );
  });

  for (const { cause, line } of [
    {
      cause: "unsupported-feature",
      line: "  live (hello) [project] {unsupported mcp} sdk: pi-mcp-adapter cannot run it.",
    },
    {
      cause: "malformed",
      line: "  live (hello) [project] {malformed mcp}: hello's MCP config is not valid, so none of its servers are installed.",
    },
  ] as const) {
    test(`AMIG-03: a removal for ${cause} alone is a warning with the reload hint`, (t) => {
      // arrange
      const ctx = createContext(t);

      // act
      notifyMcpMigration(ctx as never, {
        rows: [
          {
            kind: "removed",
            scope: "project",
            plugin: "hello",
            marketplace: "mp",
            server: "live",
            cause,
            ...(cause === "unsupported-feature" && { feature: "sdk" }),
          },
        ],
        notices: [],
      });

      // assert
      assert.deepStrictEqual(
        ctx.ui.notify.mock.calls.map((call) => call.arguments),
        [
          [
            [
              "Plugin MCP servers removed from mcp.json.",
              "",
              "Removed from mcp.json:",
              line,
              "/reload to pick up changes",
            ].join("\n"),
            "warning",
          ],
        ],
      );
    });
  }

  test("AMIG-03: an unsupported removal with no feature names only the token", (t) => {
    // arrange
    const ctx = createContext(t);

    // act
    notifyMcpMigration(ctx as never, {
      rows: [
        {
          kind: "removed",
          scope: "project",
          plugin: "hello",
          marketplace: "mp",
          server: "live",
          cause: "unsupported-feature",
        },
      ],
      notices: [],
    });

    // assert
    assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]?.arguments, [
      [
        "Plugin MCP servers removed from mcp.json.",
        "",
        "Removed from mcp.json:",
        "  live (hello) [project] {unsupported mcp}: pi-mcp-adapter cannot run it.",
        "/reload to pick up changes",
      ].join("\n"),
      "warning",
    ]);
  });

  test("AMIG-02: an unfinished move renders under the left-in-place rows at warning", (t) => {
    // arrange
    const ctx = createContext(t);

    // act
    notifyMcpMigration(ctx as never, {
      rows: [
        {
          kind: "unfinished",
          scope: "project",
          plugin: "hello",
          marketplace: "mp",
          servers: ["srv", "web"],
          detail: "permission denied",
        },
      ],
      notices: [],
    });

    // assert
    assert.deepStrictEqual(
      ctx.ui.notify.mock.calls.map((call) => call.arguments),
      [
        [
          [
            "Plugin MCP servers in mcp.json need attention.",
            "",
            "Left in mcp.json:",
            "  srv, web (hello) [project] The new entries are written, but mcp.json could not be updated: permission denied. The next /reload finishes the move.",
          ].join("\n"),
          "warning",
        ],
      ],
    );
  });

  test("AMIG-03: control characters in removed and unfinished rows render as \\u escapes", (t) => {
    // arrange
    const ctx = createContext(t);

    // act
    notifyMcpMigration(ctx as never, {
      rows: [
        {
          kind: "removed",
          scope: "project",
          plugin: "p\u001b",
          marketplace: "mp",
          server: "s\nv",
          cause: "unsupported-feature",
          feature: "w\u0007s",
        },
        {
          kind: "removed",
          scope: "project",
          plugin: "q\u009b",
          marketplace: "mp",
          server: "t",
          cause: "not-declared",
        },
        {
          kind: "unfinished",
          scope: "user",
          plugin: "r\r",
          marketplace: "mp",
          servers: ["u\u0000"],
          detail: "d\u007f",
        },
      ],
      notices: [],
    });

    // assert
    assert.deepStrictEqual(
      ctx.ui.notify.mock.calls.map((call) => call.arguments),
      [
        [
          [
            "Plugin MCP servers in mcp.json need attention.",
            "",
            "Removed from mcp.json:",
            "  s\\u000av (p\\u001b) [project] {unsupported mcp} w\\u0007s: pi-mcp-adapter cannot run it.",
            "  t (q\\u009b) [project] q\\u009b no longer declares it.",
            "Left in mcp.json:",
            "  u\\u0000 (r\\u000d) [user] The new entries are written, but mcp.json could not be updated: d\\u007f. The next /reload finishes the move.",
            "/reload to pick up changes",
          ].join("\n"),
          "warning",
        ],
      ],
    );
  });
});

test("usage info dispatch preserves usage message at info severity", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyUsageInfo(ctx as never, "Usage: /claude:plugin ...");

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "Usage: /claude:plugin ...",
    "info",
  ]);
});

test("raw dispatch preserves absent and explicit severity once each", (t) => {
  // arrange
  const ctx = createContext(t);
  const rawNotify = makeRawNotifyFn(ctx as never);

  // act
  rawNotify("plain");
  rawNotify("failed", "error");

  // assert
  assert.deepStrictEqual(
    ctx.ui.notify.mock.calls.map((call) => call.arguments),
    [["plain"], ["failed", "error"]],
  );
});

function renderOwnedRow(
  row: Parameters<typeof emitContextCascade>[2]["marketplaces"][number]["plugins"][number],
  _probe: SoftDepStatus,
): string {
  return `${row.name} (${row.status})`;
}

test("context dispatch preserves ordered rows and stamped reload hint", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
  const renderRow = t.mock.fn<Parameters<typeof emitContextCascade>[3]>(renderOwnedRow);
  const message = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            name: "first",
            status: "installed",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
          {
            name: "second",
            status: "available",
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  } satisfies CascadeNotificationMessage;

  // act
  emitContextCascade(ctx as never, pi, message, renderRow);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user]\n  first (installed)\n  second (available)\n\n/reload to pick up changes",
  ]);
  assert.equal(renderRow.mock.callCount(), 2);
});

test("context dispatch forwards the row, the probe, and the enclosing marketplace scope", (t) => {
  // arrange
  // The renderer is an argument, so `(row, probe, mpScope)` is a contract of the
  // emitter: the probe must be the one derived from the `pi` handle and the
  // scope must be the ENCLOSING marketplace's, not the row's.
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
  const renderCalls: Array<{ name: string; scope: string; probe: SoftDepStatus }> = [];
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
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  } satisfies CascadeNotificationMessage;

  // act
  emitContextCascade(ctx as never, pi, message, renderRow);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user]\n  controlled installed alpha\n\nPlugin install: 1 success\n\n/reload to pick up changes",
  ]);
  assert.deepStrictEqual(renderCalls, [
    {
      name: "alpha",
      scope: "user",
      probe: { piSubagentsLoaded: true, piMcpAdapterLoaded: true, workflowEngineLoaded: true },
    },
  ]);
});

test("context dispatch keeps independent parallel captures", async (t) => {
  // arrange
  const first = createContext(t);
  const second = createContext(t);
  const pi = piWithAllLoaded();
  const renderRow = t.mock.fn<Parameters<typeof emitContextCascade>[3]>(renderOwnedRow);
  const message = { marketplaces: [] } satisfies CascadeNotificationMessage;

  // act
  await Promise.all([
    Promise.resolve().then(() => {
      emitContextCascade(first as never, pi, message, renderRow);
    }),
    Promise.resolve().then(() => {
      emitContextCascade(second as never, pi, message, renderRow);
    }),
  ]);

  // assert
  assert.deepStrictEqual(first.ui.notify.mock.calls[0]!.arguments, ["(no marketplaces)"]);
  assert.deepStrictEqual(second.ui.notify.mock.calls[0]!.arguments, ["(no marketplaces)"]);
  // The `(no marketplaces)` sentinel is composed without any row, so a renderer
  // call here would mean a phantom row the emitted bytes cannot reveal.
  assert.equal(renderRow.mock.callCount(), 0);
});

test("update no-op dispatch preserves empty and non-empty folds", (t) => {
  // arrange
  const empty = createContext(t);
  const nonEmpty = createContext(t);
  const pi = piWithAllLoaded();
  const emptyRenderRow = t.mock.fn<Parameters<typeof emitUpdateNoOpCascade>[3]>(renderOwnedRow);
  const nonEmptyRenderRow = t.mock.fn<Parameters<typeof emitUpdateNoOpCascade>[3]>(renderOwnedRow);
  const emptyMessage = { marketplaces: [] } satisfies CascadeNotificationMessage;
  const message = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            name: "alpha",
            status: "available",
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  } satisfies CascadeNotificationMessage;

  // act
  emitUpdateNoOpCascade(empty as never, pi, emptyMessage, emptyRenderRow);
  emitUpdateNoOpCascade(nonEmpty as never, pi, message, nonEmptyRenderRow);

  // assert
  assert.deepStrictEqual(empty.ui.notify.mock.calls[0]!.arguments, [
    "Plugin update: nothing to update",
  ]);
  assert.deepStrictEqual(nonEmpty.ui.notify.mock.calls[0]!.arguments, [
    "● official [user]\n  alpha (available)\n\nPlugin update: nothing to update",
  ]);
  assert.equal(emptyRenderRow.mock.callCount(), 0);
  assert.equal(nonEmptyRenderRow.mock.callCount(), 1);
});

test("reconcile context dispatch keeps its tally and omits reload", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
  const renderRow =
    t.mock.fn<Parameters<typeof emitReconcileAppliedContextCascade>[3]>(renderOwnedRow);
  const message = {
    kind: "reconcile-applied-cascade",
    cardinality: "plural",
    label: "Reconcile",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        status: "added",
        severity: "info",
        needsReload: false,
        plugins: [],
      },
    ],
  } as const;

  // act
  emitReconcileAppliedContextCascade(ctx as never, pi, message, renderRow);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user] (added)\n\nReconcile: 1 success",
  ]);
  assert.equal(renderRow.mock.callCount(), 0);
});

test("reconcile context dispatch suppresses reload and stamps error severity", (t) => {
  // arrange
  // RECON-04: the reconcile ran ON /reload, so a row that asks for a reload must
  // still produce no reload-hint trailer. The standalone `notify()` arm is gated
  // in tests/architecture/notify-grammar-invariant.test.ts; production reaches
  // this emitter from shared/notify-context.ts, so the suppression, the
  // failure tally, and the stamped severity argument are pinned here.
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
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
  emitReconcileAppliedContextCascade(ctx as never, pi, message, renderRow);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A plugin operation has failed.\n\n● official [user]\n  ⊘ alpha (failed) {not found}\n\nReconcile: 1 failure",
    "error",
  ]);
  assert.equal(renderRow.mock.callCount(), 1);
});

/*
 * Summary delivery through the public entry points.
 *
 * The seam that prepends the summary line is module-private, so each case below
 * drives it from the path production uses. The assertion is therefore the
 * complete emitted string and the exact notify argument list, not a body the
 * test handed in.
 */

test("a mixed actionable-skip cascade emits the plural attention summary", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
  const message = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        status: "skipped",
        severity: "warning",
        reasons: ["not found"],
        plugins: [
          {
            name: "alpha",
            status: "skipped",
            reasons: ["not installed"],
            severity: "warning",
            needsReload: false,
          },
        ],
      },
    ],
  } satisfies CascadeNotificationMessage;

  // act
  emitContextCascade(ctx as never, pi, message, (row) => `${row.name} (${row.status})`);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "Some operations need attention.\n\n● official [user] (skipped) {not found}\n  alpha (skipped)",
    "warning",
  ]);
});

test("a marketplace-only failure cascade emits the marketplace failure summary", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
  const message = {
    marketplaces: [
      { name: "official", scope: "user", status: "failed", severity: "error", plugins: [] },
    ],
  } satisfies CascadeNotificationMessage;

  // act
  emitContextCascade(ctx as never, pi, message, (row) => `${row.name} (${row.status})`);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A marketplace operation has failed.\n\n⊘ official [user] (failed)",
    "error",
  ]);
});

test("an unstamped cascade plugin defaults to info severity and a success tally", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
  const message = {
    cardinality: "plural",
    label: "Plugin list",
    marketplaces: [
      { name: "official", scope: "user", plugins: [{ name: "alpha", status: "available" }] },
    ],
  } satisfies CascadeNotificationMessage;

  // act
  emitContextCascade(ctx as never, pi, message, (row) => `${row.name} (${row.status})`);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "● official [user]\n  alpha (available)\n\nPlugin list: 1 success",
  ]);
});

test("an applied reconcile with a failed plugin emits the plural failure summary", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
  const message = {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        status: "failed",
        severity: "error",
        plugins: [
          {
            name: "alpha",
            status: "failed",
            reasons: ["not found"],
            severity: "error",
            needsReload: true,
          },
        ],
      },
    ],
  } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "Some operations have failed.\n\n⊘ official [user] (failed)\n  ⊘ alpha (failed) {not found}",
    "error",
  ]);
});

test("an applied reconcile with only a skipped marketplace emits the marketplace attention summary", (t) => {
  // arrange
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
  const message = {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      { name: "official", scope: "user", status: "skipped", severity: "warning", plugins: [] },
    ],
  } satisfies NotificationMessage;

  // act
  notify(ctx as never, pi, message);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A marketplace operation needs attention.\n\n● official [user] (skipped)",
    "warning",
  ]);
});

test("summary computation preserves its available-plugin empty fallback after narrowing", (t) => {
  // arrange
  // The sibling case above lands the summary switch on a read-only kind; this
  // one lands it on a `plugin-info` whose row is NOT failed, which is the other
  // arm that yields no summary sentence. The body is still the
  // marketplace-absence render, because the body is composed from an earlier
  // read -- what this case pins is that the arm reached at the summary read
  // contributes an empty sentence rather than a hard-count-1 one.
  const ctx = createContext(t);
  const pi = piWithAllLoaded();
  const message = messageWithKindSequence(
    {
      name: "official",
      scope: "user",
      plugin: { name: "alpha", status: "available", componentsResolved: false },
    },
    [...Array<string>(17).fill("marketplace-not-added"), "plugin-info"],
  );

  // act
  notify(ctx as never, pi, message as never);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "\n\n⊘ official [user] (failed) {marketplace not added}",
    "error",
  ]);
});
