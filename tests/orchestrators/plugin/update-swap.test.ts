import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { preparePluginUpdate } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts";
import { swapPluginUpdate } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

// The flow suite supplies the real bridge, filesystem, rollback, and
// state-ledger fixtures while this mirrored owner pair proves they execute
// through the extracted swap module.
import { seedPathMarketplace, withHermeticHome } from "./update-flow.test.ts";

test("exposes the atomic plugin update swap owner", () => {
  // act and assert
  assert.strictEqual(typeof swapPluginUpdate, "function");
});

test("atomically replaces staged resources and finalizes the update ledger", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "update-swap-success-"));
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "2.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const locations = locationsFor("project", cwd);
      const preflight = await preparePluginUpdate({
        plugin: "hello",
        marketplace: "mp",
        scope: "project",
        locations,
        cleanupClones: () => Promise.resolve(),
      });
      assert.ok(!("partition" in preflight));

      // act
      const outcome = await swapPluginUpdate(
        {
          plugin: "hello",
          marketplace: "mp",
          scope: "project",
          cwd,
          locations,
          hooksRouting: createHooksRouting(createHooksRuntime()),
          completionCache: createCompletionCache(),
          cascade: true,
          cleanupClones: () => Promise.resolve(),
        },
        preflight,
      );

      // assert
      assert.strictEqual(outcome.partition, "updated");
      assert.strictEqual(outcome.fromVersion, "1.0.0");
      assert.strictEqual(outcome.toVersion, "2.0.0");
      const state = await loadState(locations.extensionRoot);
      const record = state.marketplaces.mp?.plugins.hello;
      assert.strictEqual(record?.version, "2.0.0");
      assert.strictEqual(record?.compatibility.installable, true);
      assert.deepStrictEqual(record?.resources.skills, ["hello-tool"]);
      assert.match(
        await readFile(path.join(locations.skillsTargetDir, "hello-tool", "SKILL.md"), "utf8"),
        /Body for hello 2\.0\.0\./,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("retains the intent ledger and old resource tree after a replacement failure", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "update-swap-failure-"));
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "2.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const locations = locationsFor("project", cwd);
      await mkdir(locations.skillsTargetDir, { recursive: true });
      const skillObstacle = path.join(locations.skillsTargetDir, "hello-tool");
      await writeFile(skillObstacle, "old-resource-tree");
      const preflight = await preparePluginUpdate({
        plugin: "hello",
        marketplace: "mp",
        scope: "project",
        locations,
        cleanupClones: () => Promise.resolve(),
      });
      assert.ok(!("partition" in preflight));

      // act
      const outcome = await swapPluginUpdate(
        {
          plugin: "hello",
          marketplace: "mp",
          scope: "project",
          cwd,
          locations,
          hooksRouting: createHooksRouting(createHooksRuntime()),
          completionCache: createCompletionCache(),
          cascade: true,
          cleanupClones: () => Promise.resolve(),
        },
        preflight,
      );

      // assert
      assert.strictEqual(outcome.partition, "failed");
      assert.ok("phaseFailures" in outcome);
      assert.deepStrictEqual(
        outcome.phaseFailures.map((failure) => failure.phase),
        ["skills"],
      );
      const state = await loadState(locations.extensionRoot);
      const record = state.marketplaces.mp?.plugins.hello;
      assert.strictEqual(record?.version, "1.0.0");
      assert.strictEqual(record?.compatibility.installable, false);
      assert.deepStrictEqual(record?.compatibility.notes, ["update-in-progress"]);
      assert.deepStrictEqual(record?.resources.skills, ["seeded-skill"]);
      assert.strictEqual(await readFile(skillObstacle, "utf8"), "old-resource-tree");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
