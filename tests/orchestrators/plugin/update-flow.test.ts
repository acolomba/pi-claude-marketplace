import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { GENERATED_AGENT_PREFIX } from "../../../extensions/pi-claude-marketplace/bridges/agents/marker.ts";
import {
  createHooksRouting,
  createHooksRuntime,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { createPluginUpdateOperations } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { createNotificationBoundary } from "../../edge/notification-boundary.ts";

import { seedPathMarketplace, withHermeticHome } from "./update.test.ts";

test("owns plugin update flow composition", () => {
  // arrange
  const operations = createPluginUpdateOperations(
    createHooksRouting(createHooksRuntime()),
    createCompletionCache(),
  );

  // act and assert
  assert.strictEqual(typeof operations.updatePlugins, "function");
  assert.strictEqual(typeof operations.pluginUpdate, "function");
});

test("routes cascade-safe preflight outcomes through the flow owner", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "update-flow-preflight-"));
    const previousCwd = process.cwd();
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { present: { version: "1.0.0" } },
      });
      const operations = createPluginUpdateOperations(
        createHooksRouting(createHooksRuntime()),
        createCompletionCache(),
      );
      process.chdir(cwd);

      // act
      const outcome = await operations.pluginUpdate("present", "mp", "project");

      // assert
      assert.strictEqual(outcome.partition, "skipped");
      assert.strictEqual(outcome.name, "present");
      assert.deepStrictEqual(outcome.reasons, ["not installed"]);
    } finally {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PUP-6 happy: flow composes preflight, swap, state, tree, and notification", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "update-flow-success-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: {
            version: "1.0.1",
            hasSkill: true,
            hasCommand: true,
            hasAgent: true,
            hasMcp: true,
          },
        },
        installedVersions: { hello: "1.0.0" },
      });
      const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 4);
      const operations = createPluginUpdateOperations(
        createHooksRouting(createHooksRuntime()),
        createCompletionCache(),
      );

      // act
      await operations.updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      const state = await loadState(locations.extensionRoot);
      const record = state.marketplaces.mp?.plugins.hello;
      assert.ok(record !== undefined);
      assert.strictEqual(record.version, "1.0.1");
      assert.deepStrictEqual(record.resources.skills, ["hello-tool"]);
      assert.deepStrictEqual(record.resources.prompts, ["hello:deploy"]);
      assert.deepStrictEqual(record.resources.agents, [`${GENERATED_AGENT_PREFIX}hello-bot`]);
      assert.deepStrictEqual(record.resources.mcpServers, ["server1"]);
      assert.strictEqual(record.compatibility.installable, true);
      assert.strictEqual(record.compatibility.notes.includes("update-in-progress"), false);
      assert.ok(
        (await readFile(path.join(locations.skillsTargetDir, "hello-tool", "SKILL.md"), "utf8"))
          .length > 0,
      );
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation needs attention.\n\n" +
            "● mp [project]\n" +
            "  ● hello v1.0.0 → v1.0.1 (updated) {requires pi-subagents, requires pi-mcp}\n\n" +
            "/reload to pick up changes",
          severity: "warning",
        },
      ]);
      assert.ok(seeded.marketplaceRoot.length > 0);
      verifyBoundary();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
