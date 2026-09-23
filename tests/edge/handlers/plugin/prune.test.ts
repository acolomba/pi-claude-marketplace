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
import { createNotificationBoundary } from "../../notification-boundary.ts";

import type { ExtensionAPI } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

function handler(pi: ExtensionAPI) {
  return makePruneHandler(
    pi,
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
  );
}

test("defaults to the user scope with no target", async () => {
  await withHermeticEnvironment("prune-handler-user-", async ({ cwd }) => {
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(0, 0, {
      value: cwd,
      reads: 1,
    });

    await handler(pi)("", ctx);

    assert.equal((await stat(locationsFor("user", cwd).extensionRoot)).isDirectory(), true);
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
  });
});

test("selects the project scope", async () => {
  await withHermeticEnvironment("prune-handler-project-", async ({ cwd }) => {
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(0, 0, {
      value: cwd,
      reads: 1,
    });

    await handler(pi)("--scope project", ctx);

    assert.equal((await stat(locationsFor("project", cwd).extensionRoot)).isDirectory(), true);
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
  });
});

test("rejects an unknown option before touching state", async () => {
  await withHermeticEnvironment("prune-handler-option-", async ({ cwd }) => {
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 0);

    await handler(pi)("--keep-data", ctx);

    assert.deepStrictEqual(notifications, [
      {
        message:
          'Unknown option: "--keep-data".\n\nUsage: /claude:plugin prune [--scope user|project]',
        severity: "error",
      },
    ]);
    await assert.rejects(stat(locationsFor("user", cwd).extensionRoot));
    verifyBoundary();
  });
});

test("rejects a positional target", async () => {
  await withHermeticEnvironment("prune-handler-target-", async ({ cwd }) => {
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 0);

    await handler(pi)("app@mp", ctx);

    assert.deepStrictEqual(notifications, [
      {
        message: "Too many arguments.\n\nUsage: /claude:plugin prune [--scope user|project]",
        severity: "error",
      },
    ]);
    await assert.rejects(stat(locationsFor("user", cwd).extensionRoot));
    verifyBoundary();
  });
});
