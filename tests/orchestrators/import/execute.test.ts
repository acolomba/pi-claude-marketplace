/* eslint-disable @typescript-eslint/require-await */

import assert from "node:assert/strict";
import test from "node:test";

import { importClaudeSettings } from "../../../extensions/pi-claude-marketplace/orchestrators/import/index.ts";
import { PluginShapeError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

interface MakeCtxOptions {
  readonly piSubagentsLoaded?: boolean;
  readonly piMcpAdapterLoaded?: boolean;
}

function makeCtx(options: MakeCtxOptions = {}): {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    cwd: "/tmp/project",
    ui: {
      notify: (message: string, severity?: string): void => {
        notifications.push(severity === undefined ? { message } : { message, severity });
      },
    },
  } as unknown as ExtensionContext;
  const piSubagentsLoaded = options.piSubagentsLoaded ?? true;
  const piMcpAdapterLoaded = options.piMcpAdapterLoaded ?? true;
  const tools: { name: string; sourceInfo?: { source?: string } }[] = [];
  if (piSubagentsLoaded) {
    tools.push({ name: "subagent" });
  }

  if (piMcpAdapterLoaded) {
    tools.push({ name: "mcp" });
  }

  const pi = { getAllTools: (): unknown[] => tools } as unknown as ExtensionAPI;
  return { ctx, pi, notifications };
}

test("importClaudeSettings skips matching existing marketplaces and already-installed plugins", async () => {
  const { ctx, pi, notifications } = makeCtx();
  const added: string[] = [];
  const installed: string[] = [];

  const result = await importClaudeSettings({
    ctx,
    pi,
    cwd: "/tmp/project",
    selectedScopes: ["user"],
    deps: {
      loadSettings: async () => ({
        paths: { basePath: "base", localPath: "local" },
        settings: {
          enabledPlugins: { "plugin@mp": true },
          extraKnownMarketplaces: { mp: { directory: "./mp" } },
        },
        diagnostics: [],
      }),
      loadState: async () => ({
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "user",
            source: { kind: "path", raw: "./mp", logical: "./mp" },
            addedFromCwd: "/tmp/project",
            manifestPath: "/tmp/mp/.claude-plugin/marketplace.json",
            marketplaceRoot: "/tmp/mp",
            plugins: {
              plugin: {
                version: "1.0.0",
                resolvedSource: "/tmp/mp/plugins/plugin",
                compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
                resources: { skills: [], prompts: [], agents: [], mcpServers: [] },
                installedAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
            },
          },
        },
      }),
      addMarketplace: async (opts) => {
        added.push(opts.rawSource);
      },
      installPlugin: async (opts) => {
        installed.push(`${opts.plugin}@${opts.marketplace}`);
        return {
          status: "installed",
          resourcesChanged: true,
          declaresAgents: false,
          declaresMcp: false,
        };
      },
    },
  });

  assert.deepEqual(added, []);
  assert.deepEqual(installed, []);
  assert.equal(result.skippedExistingMarketplaces[0]?.reason, "already-present");
  assert.equal(result.skippedExistingPlugins[0]?.reason, "already-installed");
  // Plan 20-02 / D-20-02: existing marketplace + already-installed plugin
  // renders structurally via the V2 cascade. Marketplace skip maps to
  // (updated); plugin skip carries `{already installed}` reason brace.
  // Severity: the only non-success row is the BENIGN plugin skip
  // (`already installed` is in BENIGN_REASONS), so per UXG-02 / D-28-06 the
  // cascade computes info (no severity arg). Under SNM-33 / D-22-01 the
  // only plugin row is `skipped` (no state-change token), so NO reload-hint
  // trailer -- a marketplace `(updated)` alone is not a Pi-visible change.
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.severity, undefined);
  assert.equal(
    notifications[0]?.message,
    "● mp [user] (updated)\n  ⊘ plugin (skipped) {already installed}",
  );
});

test("importClaudeSettings source mismatch skips dependent plugins without calling installPlugin", async () => {
  const { ctx, pi } = makeCtx();
  const installed: string[] = [];

  const result = await importClaudeSettings({
    ctx,
    pi,
    cwd: "/tmp/project",
    selectedScopes: ["project"],
    deps: {
      loadSettings: async () => ({
        paths: { basePath: "base", localPath: "local" },
        settings: {
          enabledPlugins: { "plugin@mp": true },
          extraKnownMarketplaces: { mp: { github: { repo: "owner/new" } } },
        },
        diagnostics: [],
      }),
      loadState: async () => ({
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: { kind: "github", raw: "owner/old", owner: "owner", repo: "old" },
            addedFromCwd: "/tmp/project",
            manifestPath: "/tmp/mp/.claude-plugin/marketplace.json",
            marketplaceRoot: "/tmp/mp",
            plugins: {},
          },
        },
      }),
      addMarketplace: async () => undefined,
      installPlugin: async (opts) => {
        installed.push(`${opts.plugin}@${opts.marketplace}`);
        return {
          status: "installed",
          resourcesChanged: true,
          declaresAgents: false,
          declaresMcp: false,
        };
      },
    },
  });

  assert.deepEqual(installed, []);
  assert.equal(result.sourceMismatches[0]?.reason, "source-mismatch");
  assert.equal(result.sourceMismatches[0]?.ref, "plugin@mp");
});

test("importClaudeSettings treats cross-kind source as mismatch (github planned, path stored)", async () => {
  const { ctx, pi } = makeCtx();
  const installed: string[] = [];

  const result = await importClaudeSettings({
    ctx,
    pi,
    cwd: "/tmp/project",
    selectedScopes: ["user"],
    deps: {
      loadSettings: async () => ({
        paths: { basePath: "base", localPath: "local" },
        settings: {
          enabledPlugins: { "plugin@mp": true },
          extraKnownMarketplaces: { mp: { github: { repo: "owner/repo" } } },
        },
        diagnostics: [],
      }),
      loadState: async () => ({
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "user",
            source: { kind: "path", raw: "./mp", logical: "./mp" },
            addedFromCwd: "/tmp/project",
            manifestPath: "/tmp/mp/.claude-plugin/marketplace.json",
            marketplaceRoot: "/tmp/mp",
            plugins: {},
          },
        },
      }),
      addMarketplace: async () => undefined,
      installPlugin: async (opts) => {
        installed.push(opts.plugin);
        return {
          status: "installed",
          resourcesChanged: false,
          declaresAgents: false,
          declaresMcp: false,
        };
      },
    },
  });

  assert.deepEqual(installed, []);
  assert.equal(result.sourceMismatches.length, 1);
});

test("importClaudeSettings skips when github source matches owner and repo", async () => {
  const { ctx, pi } = makeCtx();
  const installed: string[] = [];

  const result = await importClaudeSettings({
    ctx,
    pi,
    cwd: "/tmp/project",
    selectedScopes: ["user"],
    deps: {
      loadSettings: async () => ({
        paths: { basePath: "base", localPath: "local" },
        settings: {
          enabledPlugins: { "plugin@mp": true },
          // The import planner reads github.repo only, so planned source = "owner/repo"
          // (no ref). The stored source must also have no ref for samePlannedSource to match.
          extraKnownMarketplaces: { mp: { github: { repo: "owner/repo" } } },
        },
        diagnostics: [],
      }),
      loadState: async () => ({
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "user",
            source: {
              kind: "github",
              raw: "owner/repo",
              owner: "owner",
              repo: "repo",
              ref: undefined,
            },
            addedFromCwd: "/tmp/project",
            manifestPath: "/tmp/mp/.claude-plugin/marketplace.json",
            marketplaceRoot: "/tmp/mp",
            plugins: {
              plugin: {
                version: "1.0.0",
                resolvedSource: "/tmp/mp/plugins/plugin",
                compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
                resources: { skills: [], prompts: [], agents: [], mcpServers: [] },
                installedAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
            },
          },
        },
      }),
      addMarketplace: async () => undefined,
      installPlugin: async (opts) => {
        installed.push(opts.plugin);
        return {
          status: "installed",
          resourcesChanged: false,
          declaresAgents: false,
          declaresMcp: false,
        };
      },
    },
  });

  assert.deepEqual(installed, []);
  assert.equal(result.skippedExistingMarketplaces[0]?.marketplace, "mp");
  assert.equal(result.skippedExistingPlugins[0]?.plugin, "plugin");
});

test("importClaudeSettings marketplace add failure skips only dependent plugins", async () => {
  const { ctx, pi, notifications } = makeCtx();
  const installed: string[] = [];

  const result = await importClaudeSettings({
    ctx,
    pi,
    cwd: "/tmp/project",
    selectedScopes: ["user"],
    deps: {
      loadSettings: async () => ({
        paths: { basePath: "base", localPath: "local" },
        settings: {
          enabledPlugins: { "a@mp-a": true, "b@mp-b": true },
          extraKnownMarketplaces: { "mp-a": { directory: "./a" }, "mp-b": { directory: "./b" } },
        },
        diagnostics: [],
      }),
      loadState: async () => ({ schemaVersion: 1, marketplaces: {} }),
      addMarketplace: async (opts) => {
        if (opts.rawSource === "./a") {
          throw new Error("clone failed");
        }
      },
      installPlugin: async (opts) => {
        installed.push(`${opts.plugin}@${opts.marketplace}`);
        return {
          status: "installed",
          resourcesChanged: false,
          declaresAgents: false,
          declaresMcp: false,
        };
      },
    },
  });

  assert.deepEqual(installed, ["b@mp-b"]);
  assert.equal(result.marketplaceFailures[0]?.marketplace, "mp-a");
  assert.equal(result.warnings.find((w) => w.ref === "a@mp-a")?.reason, "marketplace-failed");
  // Plan 20-02 / D-20-02 + A1 DROP: marketplace-failed warning maps to no
  // V2 plugin row (the failing marketplace's own status: "failed" carries
  // the structural signal). mp-a renders as (failed) with no plugin rows;
  // mp-b renders as (added) with the successfully installed plugin row.
  // Severity: "error" (any failed marketplace -> D-16-11 first-match).
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.severity, "error");
  const message = notifications[0]?.message ?? "";
  assert.match(message, /⊘ mp-a \[user\] \(failed\)/);
  assert.match(message, /● mp-b \[user\] \(added\)\n {2}● b \(installed\)/);
});

test("importClaudeSettings classifies unavailable and unexpected plugin failures without aborting unrelated installs", async () => {
  const { ctx, pi, notifications } = makeCtx();
  const attempted: string[] = [];

  const result = await importClaudeSettings({
    ctx,
    pi,
    cwd: "/tmp/project",
    selectedScopes: ["project"],
    deps: {
      loadSettings: async () => ({
        paths: { basePath: "base", localPath: "local" },
        settings: {
          enabledPlugins: { "missing@mp": true, "boom@mp": true, "ok@mp": true },
          extraKnownMarketplaces: { mp: { directory: "./mp" } },
        },
        diagnostics: [],
      }),
      loadState: async () => ({
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: { kind: "path", raw: "./mp", logical: "./mp" },
            addedFromCwd: "/tmp/project",
            manifestPath: "/tmp/mp/.claude-plugin/marketplace.json",
            marketplaceRoot: "/tmp/mp",
            plugins: {},
          },
        },
      }),
      addMarketplace: async () => undefined,
      installPlugin: async (opts) => {
        attempted.push(opts.plugin);
        if (opts.plugin === "missing") {
          // Task 260525-cjr C3: collapsed failure shape -- the
          // import consumer narrows on `error instanceof
          // PluginShapeError` and reads `.kind` to recover the
          // pre-C3 semantic dispatch.
          return {
            status: "failed",
            error: new PluginShapeError({
              kind: "not-in-manifest",
              plugin: opts.plugin,
              marketplace: opts.marketplace,
            }),
            cause: "not found",
          };
        }

        if (opts.plugin === "boom") {
          return {
            status: "failed",
            error: new Error("disk full"),
            cause: "disk full",
          };
        }

        return {
          status: "installed",
          resourcesChanged: true,
          declaresAgents: false,
          declaresMcp: false,
        };
      },
    },
  });

  assert.deepEqual(attempted, ["missing", "boom", "ok"]);
  assert.equal(result.warnings.find((w) => w.ref === "missing@mp")?.cause, "not found");
  assert.equal(result.unexpectedPluginFailures[0]?.cause, "disk full");
  // Plan 20-02 / D-20-02: missing -> PluginUnavailableMessage
  // {no longer installable}; boom -> PluginFailedMessage {not in
  // manifest}; ok -> PluginInstalledMessage. Severity: "error" because
  // the cascade contains a failed plugin row per D-16-11. Reload-hint
  // fires because "installed" is in the state-changing set per D-16-12.
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.severity, "error");
  const message = notifications[0]?.message ?? "";
  assert.equal((message.match(/\/reload to pick up changes/g) ?? []).length, 1);
  assert.match(message, /⊘ missing \(unavailable\) \{no longer installable\}/);
  assert.match(message, /⊘ boom \(failed\) \{not in manifest\}/);
  assert.match(message, /● ok \(installed\)/);
});

test("importClaudeSettings catches unexpected installPlugin throws and surfaces a partial cascade row (WR-02)", async () => {
  // Plan 20-05 WR-02 gap closure: when installPlugin throws an unexpected
  // host-side error (not a structured {status: "failed"} return), the
  // executeScopedPlan try/catch MUST (a) keep iterating the per-plugin loop,
  // (b) record the throw in result.unexpectedPluginFailures matching the
  // dispatchFailedOutcome shape, and (c) leave the final notify() at
  // the final notify() at the end of importClaudeSettings to fire exactly once with the cascade row.
  const { ctx, pi, notifications } = makeCtx();
  const attempted: string[] = [];

  const result = await importClaudeSettings({
    ctx,
    pi,
    cwd: "/tmp/project",
    selectedScopes: ["project"],
    deps: {
      loadSettings: async () => ({
        paths: { basePath: "base", localPath: "local" },
        settings: {
          enabledPlugins: { "before@mp": true, "boom@mp": true, "after@mp": true },
          extraKnownMarketplaces: { mp: { directory: "./mp" } },
        },
        diagnostics: [],
      }),
      loadState: async () => ({
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: { kind: "path", raw: "./mp", logical: "./mp" },
            addedFromCwd: "/tmp/project",
            manifestPath: "/tmp/mp/.claude-plugin/marketplace.json",
            marketplaceRoot: "/tmp/mp",
            plugins: {},
          },
        },
      }),
      addMarketplace: async () => undefined,
      installPlugin: async (opts) => {
        attempted.push(opts.plugin);
        if (opts.plugin === "boom") {
          throw new Error("simulated host crash");
        }

        return {
          status: "installed",
          resourcesChanged: true,
          declaresAgents: false,
          declaresMcp: false,
        };
      },
    },
  });

  // (1) per-plugin loop continues across the throw: all three plugins attempted.
  assert.deepEqual(attempted, ["before", "boom", "after"]);

  // (2) catch handler pushed the discriminated entry matching
  // dispatchFailedOutcome's shape (the catch arm in executeScopedPlan's pluginsToInstall loop).
  assert.equal(result.unexpectedPluginFailures.length, 1);
  assert.equal(result.unexpectedPluginFailures[0]?.plugin, "boom");
  assert.equal(result.unexpectedPluginFailures[0]?.reason, "unexpected-failure");
  assert.equal(result.unexpectedPluginFailures[0]?.cause, "simulated host crash");

  // (3) final notify() at the end of importClaudeSettings fired exactly once;
  // severity routes to "error" per D-16-11 (cascade contains a failed row).
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.severity, "error");

  // (4) unexpectedPluginFailures round-trips through
  // buildImportNotificationMarketplaces (the V2 cascade builder in execute.ts) to the V2
  // PluginFailedMessage {not in manifest} row; the two surrounding plugins
  // STILL render as (installed), proving loop-continuation end-to-end.
  const message = notifications[0]?.message ?? "";
  assert.match(message, /⊘ boom \(failed\) \{not in manifest\}/);
  assert.match(message, /● before \(installed\)/);
  assert.match(message, /● after \(installed\)/);
});

test("importClaudeSettings continues to next scope after unexpected installPlugin throw on prior scope (WR-02 cross-scope)", async () => {
  // Plan 20-06 WR-02 cross-scope sibling: locks that an unexpected
  // installPlugin throw on scope A does NOT abort the outer
  // for (const scopePlan of plan.scopes) loop. Scope B still runs to
  // completion and a SINGLE merged notify() emits the combined cascade
  // for both scopes (the in-scope sibling at line 429 only covers
  // per-plugin loop continuation within a single scope).
  const { ctx, pi, notifications } = makeCtx();
  const attempted: string[] = [];

  const result = await importClaudeSettings({
    ctx,
    pi,
    cwd: "/tmp/project",
    selectedScopes: ["project", "user"],
    deps: {
      loadSettings: async (scope) => ({
        paths: { basePath: "base", localPath: "local" },
        settings: {
          enabledPlugins: { [`${scope === "project" ? "boom" : "other"}@mp`]: true },
          extraKnownMarketplaces: { mp: { directory: "./mp" } },
        },
        diagnostics: [],
      }),
      loadState: async () => ({
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: { kind: "path", raw: "./mp", logical: "./mp" },
            addedFromCwd: "/tmp/project",
            manifestPath: "/tmp/mp/.claude-plugin/marketplace.json",
            marketplaceRoot: "/tmp/mp",
            plugins: {},
          },
        },
      }),
      addMarketplace: async () => undefined,
      installPlugin: async (opts) => {
        attempted.push(`${opts.scope}:${opts.plugin}`);
        if (opts.scope === "project") {
          throw new Error("scope-A host crash");
        }

        return {
          status: "installed",
          resourcesChanged: true,
          declaresAgents: false,
          declaresMcp: false,
        };
      },
    },
  });

  // (1) Outer for (const scopePlan of plan.scopes) loop iterates across the
  // throw: BOTH scopes attempted.
  assert.deepEqual(attempted, ["project:boom", "user:other"]);

  // (2) Only the throwing scope's plugin lands in unexpectedPluginFailures.
  assert.equal(result.unexpectedPluginFailures.length, 1);
  assert.equal(result.unexpectedPluginFailures[0]?.scope, "project");
  assert.equal(result.unexpectedPluginFailures[0]?.plugin, "boom");

  // (3) Final notify() at the end of importClaudeSettings fires EXACTLY
  // ONCE for the combined cascade across both scopes (NOT one-per-scope).
  assert.equal(notifications.length, 1);

  // (4) The single notification renders BOTH scope A's failed row AND
  // scope B's installed row, proving cross-scope merge end-to-end.
  const message = notifications[0]?.message ?? "";
  assert.match(message, /⊘ boom \(failed\) \{not in manifest\}/);
  assert.match(message, /● other \(installed\)/);
});

test("importClaudeSettings classifies uninstallable plugins as warnings without aborting others", async () => {
  const { ctx, pi } = makeCtx();
  const attempted: string[] = [];

  const result = await importClaudeSettings({
    ctx,
    pi,
    cwd: "/tmp/project",
    selectedScopes: ["user"],
    deps: {
      loadSettings: async () => ({
        paths: { basePath: "base", localPath: "local" },
        settings: {
          enabledPlugins: { "blocked@mp": true, "ok@mp": true },
          extraKnownMarketplaces: { mp: { directory: "./mp" } },
        },
        diagnostics: [],
      }),
      loadState: async () => ({
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "user",
            source: { kind: "path", raw: "./mp", logical: "./mp" },
            addedFromCwd: "/tmp/project",
            manifestPath: "/tmp/mp/.claude-plugin/marketplace.json",
            marketplaceRoot: "/tmp/mp",
            plugins: {},
          },
        },
      }),
      addMarketplace: async () => undefined,
      installPlugin: async (opts) => {
        attempted.push(opts.plugin);
        if (opts.plugin === "blocked") {
          // Task 260525-cjr C3: collapsed failure shape -- uninstallable
          // is recovered from `error.shape.kind === "not-installable"`.
          return {
            status: "failed",
            error: new PluginShapeError({
              kind: "not-installable",
              plugin: opts.plugin,
              reasons: ["requires unsupported tool"],
            }),
            cause: "requires unsupported tool",
          };
        }

        return {
          status: "installed",
          resourcesChanged: false,
          declaresAgents: false,
          declaresMcp: false,
        };
      },
    },
  });

  assert.deepEqual(attempted, ["blocked", "ok"]);
  assert.equal(result.warnings.find((w) => w.ref === "blocked@mp")?.reason, "uninstallable");
  assert.equal(
    result.warnings.find((w) => w.ref === "blocked@mp")?.cause,
    "requires unsupported tool",
  );
  assert.equal(result.installedPlugins[0]?.ref, "ok@mp");
});

// CMC-13 / MSG-SD-1..3: predicates from `InstallPluginOutcome.installed`
// propagate through `case "installed"` onto every `installedPlugins[]`
// entry and onto the V2 `PluginInstalledMessage.dependencies` array.
// The renderer fires `{requires pi-subagents}` / `{requires pi-mcp}` iff
// `(declares && !companion-loaded)`; the test makeCtx is configured with
// BOTH companions unloaded so the markers actually surface on the
// rendered cascade body. Cases A-D exercise all four predicate combinations.

test("importClaudeSettings propagates declaresAgents=true (agents-only) onto outcome and cascade row", async () => {
  const { ctx, pi, notifications } = makeCtx({
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  });

  const result = await importClaudeSettings({
    ctx,
    pi,
    cwd: "/tmp/project",
    selectedScopes: ["user"],
    deps: {
      loadSettings: async () => ({
        paths: { basePath: "base", localPath: "local" },
        settings: {
          enabledPlugins: { "plugin@mp": true },
          extraKnownMarketplaces: { mp: { directory: "./mp" } },
        },
        diagnostics: [],
      }),
      loadState: async () => ({ schemaVersion: 1, marketplaces: {} }),
      addMarketplace: async () => undefined,
      installPlugin: async () => ({
        status: "installed",
        resourcesChanged: true,
        declaresAgents: true,
        declaresMcp: false,
      }),
    },
  });

  assert.equal(result.installedPlugins[0]?.declaresAgents, true);
  assert.equal(result.installedPlugins[0]?.declaresMcp, false);
  const message = notifications[0]?.message ?? "";
  assert.match(message, /● plugin \(installed\) \{requires pi-subagents\}/);
  assert.doesNotMatch(message, /requires pi-mcp/);
});

test("importClaudeSettings propagates declaresMcp=true (mcp-only) onto outcome and cascade row", async () => {
  const { ctx, pi, notifications } = makeCtx({
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  });

  const result = await importClaudeSettings({
    ctx,
    pi,
    cwd: "/tmp/project",
    selectedScopes: ["user"],
    deps: {
      loadSettings: async () => ({
        paths: { basePath: "base", localPath: "local" },
        settings: {
          enabledPlugins: { "plugin@mp": true },
          extraKnownMarketplaces: { mp: { directory: "./mp" } },
        },
        diagnostics: [],
      }),
      loadState: async () => ({ schemaVersion: 1, marketplaces: {} }),
      addMarketplace: async () => undefined,
      installPlugin: async () => ({
        status: "installed",
        resourcesChanged: true,
        declaresAgents: false,
        declaresMcp: true,
      }),
    },
  });

  assert.equal(result.installedPlugins[0]?.declaresAgents, false);
  assert.equal(result.installedPlugins[0]?.declaresMcp, true);
  const message = notifications[0]?.message ?? "";
  assert.match(message, /● plugin \(installed\) \{requires pi-mcp\}/);
  assert.doesNotMatch(message, /requires pi-subagents/);
});

test("importClaudeSettings propagates declaresAgents+declaresMcp (both) onto outcome and cascade row", async () => {
  const { ctx, pi, notifications } = makeCtx({
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  });

  const result = await importClaudeSettings({
    ctx,
    pi,
    cwd: "/tmp/project",
    selectedScopes: ["user"],
    deps: {
      loadSettings: async () => ({
        paths: { basePath: "base", localPath: "local" },
        settings: {
          enabledPlugins: { "plugin@mp": true },
          extraKnownMarketplaces: { mp: { directory: "./mp" } },
        },
        diagnostics: [],
      }),
      loadState: async () => ({ schemaVersion: 1, marketplaces: {} }),
      addMarketplace: async () => undefined,
      installPlugin: async () => ({
        status: "installed",
        resourcesChanged: true,
        declaresAgents: true,
        declaresMcp: true,
      }),
    },
  });

  assert.equal(result.installedPlugins[0]?.declaresAgents, true);
  assert.equal(result.installedPlugins[0]?.declaresMcp, true);
  const message = notifications[0]?.message ?? "";
  assert.match(message, /● plugin \(installed\) \{requires pi-subagents, requires pi-mcp\}/);
});

test("importClaudeSettings propagates declaresAgents=false+declaresMcp=false (neither) onto outcome and cascade row", async () => {
  const { ctx, pi, notifications } = makeCtx({
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  });

  const result = await importClaudeSettings({
    ctx,
    pi,
    cwd: "/tmp/project",
    selectedScopes: ["user"],
    deps: {
      loadSettings: async () => ({
        paths: { basePath: "base", localPath: "local" },
        settings: {
          enabledPlugins: { "plugin@mp": true },
          extraKnownMarketplaces: { mp: { directory: "./mp" } },
        },
        diagnostics: [],
      }),
      loadState: async () => ({ schemaVersion: 1, marketplaces: {} }),
      addMarketplace: async () => undefined,
      installPlugin: async () => ({
        status: "installed",
        resourcesChanged: true,
        declaresAgents: false,
        declaresMcp: false,
      }),
    },
  });

  assert.equal(result.installedPlugins[0]?.declaresAgents, false);
  assert.equal(result.installedPlugins[0]?.declaresMcp, false);
  const message = notifications[0]?.message ?? "";
  assert.match(message, /● plugin \(installed\)/);
  assert.doesNotMatch(message, /requires pi-subagents/);
  assert.doesNotMatch(message, /requires pi-mcp/);
});

test("importClaudeSettings emits the canonical reload-hint trailer on fresh install cascade", async () => {
  const { ctx, pi, notifications } = makeCtx();

  await importClaudeSettings({
    ctx,
    pi,
    cwd: "/tmp/project",
    selectedScopes: ["user"],
    deps: {
      loadSettings: async () => ({
        paths: { basePath: "base", localPath: "local" },
        settings: {
          enabledPlugins: { "my-plugin@mp": true },
          extraKnownMarketplaces: { mp: { directory: "./mp" } },
        },
        diagnostics: [],
      }),
      loadState: async () => ({ schemaVersion: 1, marketplaces: {} }),
      addMarketplace: async () => undefined,
      installPlugin: async () => ({
        status: "installed",
        resourcesChanged: true,
        declaresAgents: false,
        declaresMcp: false,
      }),
    },
  });

  assert.equal(notifications.length, 1);
  const message = notifications[0]?.message ?? "";
  // Plan 20-02 / D-20-02: cascade renders mp header + plugin row; the
  // reload-hint trailer fires because installed/added are in the
  // state-changing set per D-16-12. Severity: info (omitted).
  assert.match(message, /\/reload to pick up changes/);
  assert.match(message, /● mp \[user\] \(added\)\n {2}● my-plugin \(installed\)/);
  assert.equal(notifications[0]?.severity, undefined);
});

test("importClaudeSettings handles already-installed outcome from installPlugin (concurrent install race)", async () => {
  const { ctx, pi, notifications } = makeCtx();

  const result = await importClaudeSettings({
    ctx,
    pi,
    cwd: "/tmp/project",
    selectedScopes: ["user"],
    deps: {
      loadSettings: async () => ({
        paths: { basePath: "base", localPath: "local" },
        settings: {
          enabledPlugins: { "plugin@mp": true },
          extraKnownMarketplaces: { mp: { directory: "./mp" } },
        },
        diagnostics: [],
      }),
      loadState: async () => ({
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "user",
            source: { kind: "path", raw: "./mp", logical: "./mp" },
            addedFromCwd: "/tmp/project",
            manifestPath: "/tmp/mp/.claude-plugin/marketplace.json",
            marketplaceRoot: "/tmp/mp",
            plugins: {},
          },
        },
      }),
      addMarketplace: async () => undefined,
      installPlugin: async () => ({
        // Task 260525-cjr C3: collapsed failure shape -- already-installed
        // surfaces as `PluginShapeError({kind: "already-installed", ...})`
        // which the import consumer routes to the skip bucket.
        status: "failed",
        error: new PluginShapeError({
          kind: "already-installed",
          plugin: "plugin",
          marketplace: "mp",
        }),
        cause: 'Plugin "plugin" is already installed in marketplace "mp".',
      }),
    },
  });

  assert.equal(result.skippedExistingPlugins[0]?.reason, "already-installed");
  assert.equal(result.skippedExistingPlugins[0]?.ref, "plugin@mp");
  // Plan 20-02 / D-20-02: marketplace already present (skippedExistingMarketplaces)
  // renders as (updated). Plugin already-installed via concurrent-install
  // race surfaces as (skipped) {already installed} cascade row. Under
  // SNM-33 / D-22-01 the only plugin row is `skipped` (no state-change
  // token), so NO reload-hint trailer -- a marketplace `(updated)` alone is
  // not a Pi-visible resource change.
  assert.equal(notifications.length, 1);
  assert.equal(
    notifications[0]?.message,
    "● mp [user] (updated)\n  ⊘ plugin (skipped) {already installed}",
  );
});

test("importClaudeSettings surfaces skippedPlugins from plan as unmappable-marketplace-source warnings", async () => {
  const { ctx, pi } = makeCtx();

  const result = await importClaudeSettings({
    ctx,
    pi,
    cwd: "/tmp/project",
    selectedScopes: ["user"],
    deps: {
      loadSettings: async () => ({
        paths: { basePath: "base", localPath: "local" },
        settings: {
          enabledPlugins: { "plugin@unknown-mp": true },
          // no extraKnownMarketplaces entry for unknown-mp and it's not the
          // official marketplace, so buildClaudeImportPlan marks it as skipped
          extraKnownMarketplaces: {},
        },
        diagnostics: [],
      }),
      loadState: async () => ({ schemaVersion: 1, marketplaces: {} }),
      addMarketplace: async () => undefined,
      installPlugin: async () => ({
        status: "installed",
        resourcesChanged: false,
        declaresAgents: false,
        declaresMcp: false,
      }),
    },
  });

  const warning = result.warnings.find((w) => w.ref === "plugin@unknown-mp");
  assert.ok(warning, "expected a warning for the unmappable plugin");
  assert.equal(warning?.reason, "unmappable-marketplace-source");
});

test("importClaudeSettings includes postCommitWarnings from installed outcome in diagnostics", async () => {
  const { ctx, pi } = makeCtx();

  const result = await importClaudeSettings({
    ctx,
    pi,
    cwd: "/tmp/project",
    selectedScopes: ["user"],
    deps: {
      loadSettings: async () => ({
        paths: { basePath: "base", localPath: "local" },
        settings: {
          enabledPlugins: { "plugin@mp": true },
          extraKnownMarketplaces: { mp: { directory: "./mp" } },
        },
        diagnostics: [],
      }),
      loadState: async () => ({ schemaVersion: 1, marketplaces: {} }),
      addMarketplace: async () => undefined,
      installPlugin: async () => ({
        status: "installed",
        resourcesChanged: true,
        declaresAgents: false,
        declaresMcp: false,
        postCommitWarnings: ["data dir creation deferred at /tmp/x: ENOSPC"],
      }),
    },
  });

  assert.equal(result.installedPlugins.length, 1);
  const postWarn = result.diagnostics.find((d) => d.code === "post-install-warning");
  assert.ok(postWarn, "expected a post-install-warning diagnostic");
  assert.match(postWarn?.message ?? "", /ENOSPC/);
  assert.equal(postWarn?.ref, "plugin@mp");
});

test("importClaudeSettings keeps user and project operations independent", async () => {
  const { ctx, pi } = makeCtx();
  const installed: string[] = [];

  await importClaudeSettings({
    ctx,
    pi,
    cwd: "/tmp/project",
    selectedScopes: ["user", "project"],
    deps: {
      loadSettings: async (scope) => ({
        paths: { basePath: "base", localPath: "local" },
        settings: {
          enabledPlugins: { "plugin@mp": true },
          extraKnownMarketplaces: { mp: { directory: `./${scope}-mp` } },
        },
        diagnostics: [],
      }),
      loadState: async () => ({ schemaVersion: 1, marketplaces: {} }),
      addMarketplace: async () => undefined,
      installPlugin: async (opts) => {
        installed.push(`${opts.scope}:${opts.plugin}@${opts.marketplace}`);
        return {
          status: "installed",
          resourcesChanged: false,
          declaresAgents: false,
          declaresMcp: false,
        };
      },
    },
  });

  assert.deepEqual(installed, ["user:plugin@mp", "project:plugin@mp"]);
});
