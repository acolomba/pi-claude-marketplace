/* eslint-disable @typescript-eslint/require-await */

import assert from "node:assert/strict";
import test from "node:test";

import {
  formatClaudeImportSummary,
  importClaudeSettings,
  type ClaudeImportExecutionResult,
} from "../../../extensions/pi-claude-marketplace/orchestrators/import/index.ts";

import type { ImportDiagnostic } from "../../../extensions/pi-claude-marketplace/orchestrators/import/index.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): { ctx: ExtensionContext; pi: ExtensionAPI; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    cwd: "/tmp/project",
    ui: {
      notify: (message: string, severity?: string): void => {
        notifications.push(severity === undefined ? { message } : { message, severity });
      },
    },
  } as unknown as ExtensionContext;
  const pi = { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;
  return { ctx, pi, notifications };
}

const diagnostic = (scope: "user" | "project", ref: string): ImportDiagnostic => ({
  severity: "warning",
  scope,
  code: "malformed-enabled-plugin-ref",
  ref,
  message: `Bad ref ${ref}`,
});

test("formatClaudeImportSummary reports already up to date for idempotent skips", () => {
  const result: ClaudeImportExecutionResult = {
    addedMarketplaces: [],
    installedPlugins: [],
    skippedExistingMarketplaces: [
      { kind: "marketplace-skip", scope: "user", marketplace: "mp", reason: "already-present" },
    ],
    skippedExistingPlugins: [
      {
        kind: "plugin-skip",
        scope: "user",
        plugin: "plugin",
        marketplace: "mp",
        ref: "plugin@mp",
        reason: "already-installed",
      },
    ],
    warnings: [],
    marketplaceFailures: [],
    sourceMismatches: [],
    unexpectedPluginFailures: [],
    diagnostics: [],
    changedResources: false,
  };

  assert.match(formatClaudeImportSummary(result), /already up to date/);
});

test("formatClaudeImportSummary keeps warning records actionable by scope plugin@marketplace reason and cause", () => {
  const result: ClaudeImportExecutionResult = {
    addedMarketplaces: [],
    installedPlugins: [],
    skippedExistingMarketplaces: [],
    skippedExistingPlugins: [],
    warnings: [
      {
        kind: "plugin-warning",
        scope: "project",
        plugin: "missing",
        marketplace: "mp",
        ref: "missing@mp",
        reason: "unavailable",
        cause: "Plugin not found",
      },
    ],
    marketplaceFailures: [],
    sourceMismatches: [],
    unexpectedPluginFailures: [],
    diagnostics: [diagnostic("project", "bad")],
    changedResources: false,
  };

  const summary = formatClaudeImportSummary(result);
  assert.match(summary, /project/);
  assert.match(summary, /missing@mp/);
  assert.match(summary, /unavailable/);
  assert.match(summary, /Plugin not found/);
  assert.match(summary, /Bad ref bad/);
});

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
        return { status: "installed", resourcesChanged: true };
      },
    },
  });

  assert.deepEqual(added, []);
  assert.deepEqual(installed, []);
  assert.equal(result.skippedExistingMarketplaces[0]?.reason, "already-present");
  assert.equal(result.skippedExistingPlugins[0]?.reason, "already-installed");
  assert.match(notifications[0]?.message ?? "", /already up to date/);
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
        return { status: "installed", resourcesChanged: true };
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
        return { status: "installed", resourcesChanged: false };
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
        return { status: "installed", resourcesChanged: false };
      },
    },
  });

  assert.deepEqual(installed, []);
  assert.equal(result.skippedExistingMarketplaces[0]?.marketplace, "mp");
  assert.equal(result.skippedExistingPlugins[0]?.plugin, "plugin");
});

test("importClaudeSettings marketplace add failure skips only dependent plugins", async () => {
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
        return { status: "installed", resourcesChanged: false };
      },
    },
  });

  assert.deepEqual(installed, ["b@mp-b"]);
  assert.equal(result.marketplaceFailures[0]?.marketplace, "mp-a");
  assert.equal(result.warnings.find((w) => w.ref === "a@mp-a")?.reason, "marketplace-failed");
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
          return { status: "unavailable", cause: "not found" };
        }

        if (opts.plugin === "boom") {
          return { status: "unexpected-failure", cause: "disk full" };
        }

        return { status: "installed", resourcesChanged: true };
      },
    },
  });

  assert.deepEqual(attempted, ["missing", "boom", "ok"]);
  assert.equal(result.warnings.find((w) => w.ref === "missing@mp")?.cause, "not found");
  assert.equal(result.unexpectedPluginFailures[0]?.cause, "disk full");
  // unexpected-failure outcomes escalate the summary notification to error severity.
  assert.equal(notifications[0]?.severity, "error");
  assert.equal((notifications[0]?.message.match(/Run \/reload/g) ?? []).length, 1);
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
          return { status: "uninstallable", cause: "requires unsupported tool" };
        }

        return { status: "installed", resourcesChanged: false };
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

test("formatClaudeImportSummary includes Run /reload when changedResources is true", () => {
  const result: ClaudeImportExecutionResult = {
    addedMarketplaces: [],
    installedPlugins: [
      {
        kind: "plugin-installed",
        scope: "user",
        plugin: "my-plugin",
        marketplace: "mp",
        ref: "my-plugin@mp",
        reason: "installed",
        resourcesChanged: true,
      },
    ],
    skippedExistingMarketplaces: [],
    skippedExistingPlugins: [],
    warnings: [],
    marketplaceFailures: [],
    sourceMismatches: [],
    unexpectedPluginFailures: [],
    diagnostics: [],
    changedResources: true,
  };

  const summary = formatClaudeImportSummary(result);
  assert.match(summary, /Run \/reload/);
  assert.match(summary, /my-plugin@mp/);
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
        status: "already-installed",
        cause: 'Plugin "plugin" is already installed in marketplace "mp".',
      }),
    },
  });

  assert.equal(result.skippedExistingPlugins[0]?.reason, "already-installed");
  assert.equal(result.skippedExistingPlugins[0]?.ref, "plugin@mp");
  assert.match(notifications[0]?.message ?? "", /Skipped existing items/);
});

test("importClaudeSettings emits diagnostic and skips scope when loadState throws", async () => {
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
          extraKnownMarketplaces: { mp: { directory: "./mp" } },
        },
        diagnostics: [],
      }),
      loadState: async () => {
        throw new Error("permission denied");
      },
      addMarketplace: async () => undefined,
      installPlugin: async (opts) => {
        installed.push(opts.plugin);
        return { status: "installed", resourcesChanged: false };
      },
    },
  });

  assert.deepEqual(installed, []);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0]?.code, "settings-read-error");
  assert.match(result.diagnostics[0]?.message ?? "", /permission denied/);
});

test("importClaudeSettings emits unrecognized-stored-source diagnostic and blocks dependent plugins", async () => {
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
            source: { kind: "unknown", raw: "??", reason: "unrecognized" },
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
        return { status: "installed", resourcesChanged: false };
      },
    },
  });

  assert.deepEqual(installed, []);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0]?.code, "unrecognized-stored-source");
  assert.equal(result.diagnostics[0]?.marketplace, "mp");
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
      installPlugin: async () => ({ status: "installed", resourcesChanged: false }),
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

test("importClaudeSettings catches top-level unexpected error and returns empty result", async () => {
  const { ctx, pi, notifications } = makeCtx();

  const result = await importClaudeSettings({
    ctx,
    pi,
    cwd: "/tmp/project",
    selectedScopes: ["user"],
    deps: {
      loadSettings: async () => {
        throw new Error("unexpected boom");
      },
    },
  });

  assert.equal(result.installedPlugins.length, 0);
  assert.equal(notifications[0]?.severity, "error");
  assert.match(notifications[0]?.message ?? "", /unexpected boom/);
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
        return { status: "installed", resourcesChanged: false };
      },
    },
  });

  assert.deepEqual(installed, ["user:plugin@mp", "project:plugin@mp"]);
});
