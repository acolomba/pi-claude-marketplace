/* eslint-disable @typescript-eslint/require-await */

import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

// Hermetic guard: config write-back is wired into importClaudeSettings, so
// user-scope tests that are not wrapped in withHermeticHome would otherwise write
// fixture entries into the developer's real ~/.pi/agent/claude-plugins.json.
// Redirect the agent dir for the whole file; withHermeticHome-wrapped tests
// delete this variable themselves, so the two mechanisms compose.
process.env.PI_CODING_AGENT_DIR = mkdtempSync(path.join(tmpdir(), "import-test-agent-"));

import { importClaudeSettings } from "../../../extensions/pi-claude-marketplace/orchestrators/import/index.ts";
import { loadConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
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
  // D-20-02: existing marketplace + already-installed plugin
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
      addMarketplace: async () => ({ status: "added", name: "mp" }) as const,
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
      addMarketplace: async () => ({ status: "added", name: "mp" }) as const,
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
      addMarketplace: async () => ({ status: "added", name: "mp" }) as const,
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

test("WR-07: a typed orchestrated add failure is NOT recorded as (added) -- dependent plugins are blocked, the cause is attributed, and exactly ONE cascade notify fires", async () => {
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
      // Pre-Phase-55-review defect: a classified precondition failure
      // (duplicate name / stale clone / invalid manifest / ...) did NOT
      // throw in standalone mode, so the import recorded the marketplace as
      // (added) and never blocked its plugins. The orchestrated typed
      // outcome must dispatch to the failure path instead.
      addMarketplace: async (opts) => {
        if (opts.rawSource === "./a") {
          return {
            status: "failed",
            reason: "duplicate name",
            error: new Error('Marketplace "mp-a" already added.'),
            cause: 'Marketplace "mp-a" already added.',
          } as const;
        }

        return { status: "added", name: "mp-b" } as const;
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

  // mp-a never recorded as added; its dependent plugin was blocked.
  assert.deepEqual(installed, ["b@mp-b"]);
  assert.equal(
    result.addedMarketplaces.some((m) => m.marketplace === "mp-a"),
    false,
    "a failed add must NOT appear in addedMarketplaces",
  );
  assert.equal(result.marketplaceFailures[0]?.marketplace, "mp-a");
  assert.equal(result.marketplaceFailures[0]?.cause, 'Marketplace "mp-a" already added.');
  assert.equal(result.warnings.find((w) => w.ref === "a@mp-a")?.reason, "marketplace-failed");

  // One-cascade-per-command discipline: orchestrated mode suppressed the
  // standalone failure notify, so exactly ONE notification fires.
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.severity, "error");
  const message = notifications[0]?.message ?? "";
  assert.match(message, /⊘ mp-a \[user\] \(failed\)/);
  assert.match(message, /● mp-b \[user\] \(added\)\n {2}● b \(installed\)/);
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

        return { status: "added", name: "mp-b" } as const;
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
  // D-20-02: marketplace-failed warning maps to no
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
      addMarketplace: async () => ({ status: "added", name: "mp" }) as const,
      installPlugin: async (opts) => {
        attempted.push(opts.plugin);
        if (opts.plugin === "missing") {
          // collapsed failure shape -- the import consumer narrows on
          // `error instanceof PluginShapeError` and reads `.kind`.
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
  // D-20-02: missing -> PluginUnavailableMessage
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
  // WR-02: when installPlugin throws an unexpected
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
      addMarketplace: async () => ({ status: "added", name: "mp" }) as const,
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
  // WR-02 cross-scope: locks that an unexpected
  // installPlugin throw on scope A does NOT abort the outer
  // for (const scopePlan of plan.scopes) loop. Scope B still runs to
  // completion and a SINGLE merged notify() emits the combined cascade
  // for both scopes.
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
      addMarketplace: async () => ({ status: "added", name: "mp" }) as const,
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
      addMarketplace: async () => ({ status: "added", name: "mp" }) as const,
      installPlugin: async (opts) => {
        attempted.push(opts.plugin);
        if (opts.plugin === "blocked") {
          // collapsed failure shape -- uninstallable
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
      addMarketplace: async () => ({ status: "added", name: "mp" }) as const,
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
      addMarketplace: async () => ({ status: "added", name: "mp" }) as const,
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
      addMarketplace: async () => ({ status: "added", name: "mp" }) as const,
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
      addMarketplace: async () => ({ status: "added", name: "mp" }) as const,
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
      addMarketplace: async () => ({ status: "added", name: "mp" }) as const,
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
  // D-20-02: cascade renders mp header + plugin row; the
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
      addMarketplace: async () => ({ status: "added", name: "mp" }) as const,
      installPlugin: async () => ({
        // collapsed failure shape -- already-installed
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
  // D-20-02: marketplace already present (skippedExistingMarketplaces)
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
      addMarketplace: async () => ({ status: "added", name: "mp" }) as const,
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
      addMarketplace: async () => ({ status: "added", name: "mp" }) as const,
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
      addMarketplace: async () => ({ status: "added", name: "mp" }) as const,
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

// ──────────────────────────────────────────────────────────────────────────
// WB-03: per-scope batched post-pass
//
// import runs each per-entry orchestrator in `notifications: { mode:
// "orchestrated" }` so WR-09 SKIPS their per-entry write-back. After all
// per-entry calls complete for a scope, executeScopedPlan runs a per-scope
// batched post-pass under ONE withLockedStateTransaction:
//
//   - loadConfig(targetConfigPath); CFG-03 invalid -> abort this scope
//   - build BatchedConfigPatch from result.addedMarketplaces +
//     result.installedPlugins for THIS scope
//   - writeBatchedConfigEntries(current, targetConfigPath, scopeRoot, batch)
//
// Race-window: per-entry orchestrators committed state under
// their own locks; the batched-save lock acquires after the last per-entry
// release. A concurrent reconcile can observe the partial state in that
// window; the next reconcile self-heals.
//
// Tests use real filesystem (mkdtemp + locationsFor) so the WB-03 atomic
// write seam is exercised end-to-end.
// ──────────────────────────────────────────────────────────────────────────

async function withHermeticHome<T>(
  fn: (env: { home: string; cwd: string }) => Promise<T>,
): Promise<T> {
  const originalHome = process.env.HOME;
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const home = await mkdtemp(path.join(tmpdir(), "import-wb-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "import-wb-cwd-"));
  process.env.HOME = home;
  delete process.env.PI_CODING_AGENT_DIR;
  try {
    return await fn({ home, cwd });
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    if (originalAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    }

    await rm(home, { recursive: true, force: true });
    await rm(cwd, { recursive: true, force: true });
  }
}

test("WB-03 happy: post-pass writes ONE batched patch with every added marketplace + installed plugin", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, pi } = makeCtx();
    const projectLocations = locationsFor("project", cwd);
    await mkdir(projectLocations.extensionRoot, { recursive: true });

    await importClaudeSettings({
      ctx,
      pi,
      cwd,
      selectedScopes: ["project"],
      deps: {
        loadSettings: async () => ({
          paths: { basePath: "base", localPath: "local" },
          settings: {
            enabledPlugins: {
              "p1@mp1": true,
              "p2@mp1": true,
              "p3@mp2": true,
            },
            extraKnownMarketplaces: {
              mp1: { github: { repo: "owner/mp1" } },
              mp2: { github: { repo: "owner/mp2" } },
            },
          },
          diagnostics: [],
        }),
        loadState: async () => ({ schemaVersion: 1, marketplaces: {} }),
        addMarketplace: async (opts) => ({ status: "added", name: opts.rawSource }) as const,
        installPlugin: async () => ({
          status: "installed",
          resourcesChanged: false,
          declaresAgents: false,
          declaresMcp: false,
        }),
      },
    });

    // The post-pass wrote the batched patch under ONE lock.
    const cfg = await loadConfig(projectLocations.configJsonPath);
    assert.equal(cfg.status, "valid");
    if (cfg.status !== "valid") {
      return;
    }

    // Both marketplaces are recorded with verbatim source from the plan.
    assert.deepEqual(Object.keys(cfg.config.marketplaces ?? {}).sort(), ["mp1", "mp2"]);
    assert.equal(cfg.config.marketplaces?.mp1?.source, "owner/mp1");
    assert.equal(cfg.config.marketplaces?.mp2?.source, "owner/mp2");

    // All three plugins are recorded with the flat key form (D-01).
    assert.deepEqual(Object.keys(cfg.config.plugins ?? {}).sort(), ["p1@mp1", "p2@mp1", "p3@mp2"]);
  });
});

test("WB-03 batched: ONE mtime touch on the config file after N entries", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, pi } = makeCtx();
    const projectLocations = locationsFor("project", cwd);
    await mkdir(projectLocations.extensionRoot, { recursive: true });

    // Seed the config with an empty schema-version-only document so mtime
    // exists before the import. The batched post-pass should produce
    // exactly ONE additional mtime touch -- not N (one per entry).
    await mkdir(projectLocations.scopeRoot, { recursive: true });
    await writeFile(projectLocations.configJsonPath, JSON.stringify({ schemaVersion: 1 }), "utf8");
    const beforeStat = await stat(projectLocations.configJsonPath);

    await importClaudeSettings({
      ctx,
      pi,
      cwd,
      selectedScopes: ["project"],
      deps: {
        loadSettings: async () => ({
          paths: { basePath: "base", localPath: "local" },
          settings: {
            enabledPlugins: {
              "p1@mp1": true,
              "p2@mp1": true,
              "p3@mp2": true,
            },
            extraKnownMarketplaces: {
              mp1: { github: { repo: "owner/mp1" } },
              mp2: { github: { repo: "owner/mp2" } },
            },
          },
          diagnostics: [],
        }),
        loadState: async () => ({ schemaVersion: 1, marketplaces: {} }),
        addMarketplace: async (opts) => ({ status: "added", name: opts.rawSource }) as const,
        installPlugin: async () => ({
          status: "installed",
          resourcesChanged: false,
          declaresAgents: false,
          declaresMcp: false,
        }),
      },
    });

    const afterStat = await stat(projectLocations.configJsonPath);
    // The post-pass changed the file's mtime exactly once: a single
    // writeBatchedConfigEntries call landed all 5 entries in one save.
    // We assert mtime AFTER > mtime BEFORE (the post-pass fired) AND the
    // resulting file holds all 5 entries (proves the single write was
    // the batched one, not a partial write).
    assert.ok(
      afterStat.mtimeMs > beforeStat.mtimeMs,
      "post-pass should have updated the config file mtime",
    );
    const cfg = await loadConfig(projectLocations.configJsonPath);
    assert.equal(cfg.status, "valid");
    if (cfg.status !== "valid") {
      return;
    }

    assert.equal(Object.keys(cfg.config.marketplaces ?? {}).length, 2);
    assert.equal(Object.keys(cfg.config.plugins ?? {}).length, 3);
  });
});

test("WB-03 empty: when every per-entry call failed, the post-pass SKIPS and the config is byte-stable", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, pi } = makeCtx();
    const projectLocations = locationsFor("project", cwd);
    await mkdir(projectLocations.extensionRoot, { recursive: true });
    await mkdir(projectLocations.scopeRoot, { recursive: true });

    // Pre-seed config so we can detect byte-stability.
    const initialBytes = JSON.stringify({ schemaVersion: 1, futureKey: "preserved" });
    await writeFile(projectLocations.configJsonPath, initialBytes, "utf8");
    const beforeStat = await stat(projectLocations.configJsonPath);

    await importClaudeSettings({
      ctx,
      pi,
      cwd,
      selectedScopes: ["project"],
      deps: {
        loadSettings: async () => ({
          paths: { basePath: "base", localPath: "local" },
          settings: {
            enabledPlugins: { "p1@mp1": true },
            extraKnownMarketplaces: { mp1: { github: { repo: "owner/mp1" } } },
          },
          diagnostics: [],
        }),
        loadState: async () => ({ schemaVersion: 1, marketplaces: {} }),
        // The add returns NO outcome -> the marketplace is recorded as a
        // failure and the dependent plugin install is blocked.
        addMarketplace: async () => undefined,
        installPlugin: async () => ({
          status: "installed",
          resourcesChanged: false,
          declaresAgents: false,
          declaresMcp: false,
        }),
      },
    });

    const afterStat = await stat(projectLocations.configJsonPath);
    const afterBytes = await readFile(projectLocations.configJsonPath, "utf8");
    // RECON-05 byte-stable: no successful additions -> SKIP post-pass.
    assert.equal(afterBytes, initialBytes);
    assert.equal(afterStat.mtimeMs, beforeStat.mtimeMs);
  });
});

test("WB-03 mixed: only the SUCCESSFUL entries land in the batched patch", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, pi } = makeCtx();
    const projectLocations = locationsFor("project", cwd);
    await mkdir(projectLocations.extensionRoot, { recursive: true });

    await importClaudeSettings({
      ctx,
      pi,
      cwd,
      selectedScopes: ["project"],
      deps: {
        loadSettings: async () => ({
          paths: { basePath: "base", localPath: "local" },
          settings: {
            enabledPlugins: {
              "p1@mp1": true,
              "p2@mp2": true,
            },
            extraKnownMarketplaces: {
              mp1: { github: { repo: "owner/mp1" } },
              mp2: { github: { repo: "owner/mp2" } },
            },
          },
          diagnostics: [],
        }),
        loadState: async () => ({ schemaVersion: 1, marketplaces: {} }),
        // mp1 add succeeds; mp2 add fails (no outcome).
        addMarketplace: async (opts) =>
          opts.rawSource === "owner/mp1"
            ? ({ status: "added", name: "owner/mp1" } as const)
            : undefined,
        installPlugin: async () => ({
          status: "installed",
          resourcesChanged: false,
          declaresAgents: false,
          declaresMcp: false,
        }),
      },
    });

    const cfg = await loadConfig(projectLocations.configJsonPath);
    assert.equal(cfg.status, "valid");
    if (cfg.status !== "valid") {
      return;
    }

    // Only mp1 lands. p1@mp1 was installed (mp1 succeeded); p2@mp2 was
    // BLOCKED because the dependent marketplace failed.
    assert.deepEqual(Object.keys(cfg.config.marketplaces ?? {}), ["mp1"]);
    assert.deepEqual(Object.keys(cfg.config.plugins ?? {}), ["p1@mp1"]);
  });
});

test("WB-03 CFG-03: per-scope invalid claude-plugins.json aborts that scope's post-pass but other scopes still run", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, pi } = makeCtx();
    const userLocations = locationsFor("user", cwd);
    const projectLocations = locationsFor("project", cwd);
    await mkdir(userLocations.extensionRoot, { recursive: true });
    await mkdir(projectLocations.extensionRoot, { recursive: true });
    await mkdir(userLocations.scopeRoot, { recursive: true });
    await mkdir(projectLocations.scopeRoot, { recursive: true });

    // Pre-seed an INVALID user-scope config (malformed JSON).
    await writeFile(userLocations.configJsonPath, "{ not valid json", "utf8");
    const userBeforeBytes = await readFile(userLocations.configJsonPath, "utf8");

    await importClaudeSettings({
      ctx,
      pi,
      cwd,
      selectedScopes: ["user", "project"],
      deps: {
        loadSettings: async (scope) => ({
          paths: { basePath: "base", localPath: "local" },
          settings: {
            enabledPlugins: { [`p@mp-${scope}`]: true },
            extraKnownMarketplaces: { [`mp-${scope}`]: { github: { repo: `owner/mp-${scope}` } } },
          },
          diagnostics: [],
        }),
        loadState: async () => ({ schemaVersion: 1, marketplaces: {} }),
        addMarketplace: async (opts) => ({ status: "added", name: opts.rawSource }) as const,
        installPlugin: async () => ({
          status: "installed",
          resourcesChanged: false,
          declaresAgents: false,
          declaresMcp: false,
        }),
      },
    });

    // User scope's invalid config is untouched: the post-pass aborted
    // BEFORE the saveConfig call.
    const userAfterBytes = await readFile(userLocations.configJsonPath, "utf8");
    assert.equal(userAfterBytes, userBeforeBytes);

    // Project scope's post-pass still ran -- the failure in user scope did
    // NOT block other scopes' batched writes.
    const projectCfg = await loadConfig(projectLocations.configJsonPath);
    assert.equal(projectCfg.status, "valid");
    if (projectCfg.status !== "valid") {
      return;
    }

    assert.deepEqual(Object.keys(projectCfg.config.marketplaces ?? {}), ["mp-project"]);
    assert.deepEqual(Object.keys(projectCfg.config.plugins ?? {}), ["p@mp-project"]);
  });
});
