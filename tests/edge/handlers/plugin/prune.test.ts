import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { makePruneHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/prune.ts";
import { locationsFor } from "../../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createCompletionCache } from "../../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { withHermeticEnvironment } from "../../../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../../../shared/notification-run-seeds.ts";
import { createNotificationBoundary } from "../../notification-boundary.ts";

function handler() {
  return makePruneHandler(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
  );
}

async function assertBothScopesUnchanged(cwd: string): Promise<void> {
  await assert.rejects(stat(locationsFor("user", cwd).extensionRoot), { code: "ENOENT" });
  await assert.rejects(stat(locationsFor("project", cwd).extensionRoot), { code: "ENOENT" });
}

test("defaults to the user scope with no target", async () => {
  await withHermeticEnvironment("prune-handler-user-", async ({ cwd }) => {
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, {
      value: cwd,
      reads: 1,
    });

    await handler()("", ctx, runWithNothingLoaded());

    assert.equal((await stat(locationsFor("user", cwd).extensionRoot)).isDirectory(), true);
    await assert.rejects(stat(locationsFor("project", cwd).extensionRoot), { code: "ENOENT" });
    assert.deepStrictEqual(notifications, [
      { message: "Nothing to prune in user scope: no orphaned dependency installs were found." },
    ]);
    verifyBoundary();
  });
});

test("selects the project scope", async () => {
  await withHermeticEnvironment("prune-handler-project-", async ({ cwd }) => {
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, {
      value: cwd,
      reads: 1,
    });

    await handler()("--scope project", ctx, runWithNothingLoaded());

    assert.equal((await stat(locationsFor("project", cwd).extensionRoot)).isDirectory(), true);
    await assert.rejects(stat(locationsFor("user", cwd).extensionRoot), { code: "ENOENT" });
    assert.deepStrictEqual(notifications, [
      { message: "Nothing to prune in project scope: no orphaned dependency installs were found." },
    ]);
    verifyBoundary();
  });
});

for (const args of ["--dry-run --scope project", "--scope project --dry-run"]) {
  test(`previews the project scope with ${args}`, async () => {
    await withHermeticEnvironment("prune-handler-preview-", async ({ cwd }) => {
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, {
        value: cwd,
        reads: 1,
      });

      await handler()(args, ctx, runWithNothingLoaded());

      await assertBothScopesUnchanged(cwd);
      assert.deepStrictEqual(notifications, [
        {
          message: "Nothing to prune in project scope: no orphaned dependency installs were found.",
        },
      ]);
      verifyBoundary();
    });
  });
}

test("duplicate --dry-run previews once without writing", async () => {
  await withHermeticEnvironment("prune-handler-duplicate-", async ({ cwd }) => {
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, {
      value: cwd,
      reads: 1,
    });

    await handler()("--dry-run --scope project --dry-run", ctx, runWithNothingLoaded());

    await assertBothScopesUnchanged(cwd);
    assert.deepStrictEqual(notifications, [
      { message: "Nothing to prune in project scope: no orphaned dependency installs were found." },
    ]);
    verifyBoundary();
  });
});

const USAGE = "Usage: /claude:plugin prune [--scope user|project] [--dry-run]";

for (const { args, message } of [
  { args: "-y", message: 'Unknown flag: "-y".' },
  { args: "--keep-data", message: 'Unknown flag: "--keep-data".' },
  { args: "--prune", message: 'Unknown flag: "--prune".' },
  { args: "--local", message: 'Unknown flag: "--local".' },
  { args: "--bogus", message: 'Unknown flag: "--bogus".' },
  { args: "app@mp", message: "Too many arguments." },
  { args: "--dry-run app@mp", message: "Too many arguments." },
  {
    args: "--scope local",
    message: 'Invalid --scope value: "local". Must be "user" or "project".',
  },
]) {
  test(`rejects ${args} before touching either scope`, async () => {
    await withHermeticEnvironment("prune-handler-reject-", async ({ cwd }) => {
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

      await handler()(args, ctx, runWithNothingLoaded());

      assert.deepStrictEqual(notifications, [
        { message: `${message}\n\n${USAGE}`, severity: "error" },
      ]);
      await assertBothScopesUnchanged(cwd);
      verifyBoundary();
    });
  });
}
