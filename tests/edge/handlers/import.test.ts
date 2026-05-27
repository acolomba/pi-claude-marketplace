import assert from "node:assert/strict";
import test from "node:test";

import { makeImportHandler } from "../../../extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts";

import type { ImportClaudeSettingsOptions } from "../../../extensions/pi-claude-marketplace/orchestrators/import/execute.ts";
import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): { ctx: ExtensionCommandContext; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    cwd: "/tmp/project",
    ui: {
      notify: (message: string, severity?: string): void => {
        notifications.push(severity === undefined ? { message } : { message, severity });
      },
    },
  } as unknown as ExtensionCommandContext;
  return { ctx, notifications };
}

function makeHandler(): {
  handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  calls: ImportClaudeSettingsOptions[];
} {
  const calls: ImportClaudeSettingsOptions[] = [];
  const pi = { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;
  const gitOps = {} as GitOps;
  const handler = makeImportHandler(pi, {
    gitOps,
    importClaudeSettings: (opts) => {
      calls.push(opts);
      return Promise.resolve({
        addedMarketplaces: [],
        installedPlugins: [],
        skippedExistingMarketplaces: [],
        skippedExistingPlugins: [],
        warnings: [],
        marketplaceFailures: [],
        sourceMismatches: [],
        unexpectedPluginFailures: [],
        diagnostics: [],
        changedResources: false,
      });
    },
  });
  return { handler, calls };
}

test("import handler defaults omitted --scope to project and user scopes (project-first per MSG-GR-3)", async () => {
  const { ctx, notifications } = makeCtx();
  const { handler, calls } = makeHandler();

  await handler("", ctx);

  // Phase 14.2-fix CR-01: the bare-import handler iterates scopes
  // project-first to match the MSG-GR-3 contract. Orphan diagnostic
  // lines (insertion-ordered) render project-before-user in same-key
  // ties; per-marketplace cascade blocks are sorted independently
  // via compareByNameThenScope.
  assert.deepEqual(
    calls.map((call) => call.selectedScopes),
    [["project", "user"]],
  );
  assert.equal(calls[0]?.cwd, "/tmp/project");
  assert.deepEqual(notifications, []);
});

test("import handler narrows explicit --scope project and --scope user", async () => {
  const project = makeHandler();
  await project.handler("--scope project", makeCtx().ctx);
  assert.deepEqual(
    project.calls.map((call) => call.selectedScopes),
    [["project"]],
  );

  const user = makeHandler();
  await user.handler("--scope user", makeCtx().ctx);
  assert.deepEqual(
    user.calls.map((call) => call.selectedScopes),
    [["user"]],
  );
});

test("import handler accepts --scope at any parseArgs-supported position", async () => {
  const { ctx } = makeCtx();
  const { handler, calls } = makeHandler();

  await handler("--scope project", ctx);

  assert.deepEqual(calls[0]?.selectedScopes, ["project"]);
});

test("import handler rejects invalid --scope value with usage error", async () => {
  const { ctx, notifications } = makeCtx();
  const { handler, calls } = makeHandler();

  await handler("--scope bad", ctx);

  assert.deepEqual(calls, []);
  assert.equal(notifications[0]?.severity, "error");
  assert.match(notifications[0]?.message ?? "", /Usage:/);
});

test("import handler rejects positional input with usage and does not call orchestrator", async () => {
  const { ctx, notifications } = makeCtx();
  const { handler, calls } = makeHandler();

  await handler("foo", ctx);

  assert.deepEqual(calls, []);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.severity, "error");
  assert.match(
    notifications[0]?.message ?? "",
    /Usage: \/claude:plugin import \[--scope user\|project\]/,
  );
});
