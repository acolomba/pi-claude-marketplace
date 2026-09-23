import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { createPrunePlugin } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts";
import { REAL_UNINSTALL_TRANSACTION } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { makeCtx } from "../../e2e/_helpers.ts";
import { withHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

function prune() {
  return createPrunePlugin(
    REAL_UNINSTALL_TRANSACTION,
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
  );
}

async function seedRecord(scope: Scope, cwd: string, manifestText: string): Promise<void> {
  const locations = locationsFor(scope, cwd);
  const marketplaceRoot = path.join(locations.extensionRoot, "sources", "mp");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, manifestText);
  const state: ExtensionState = {
    schemaVersion: 3,
    marketplaces: {
      mp: {
        name: "mp",
        scope,
        source: pathSource("./mp"),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins: {
          orphan: {
            version: "1.0.0",
            resolvedSource: "/unused",
            compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
            resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
            enabled: true,
            provenance: "dependency",
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    },
  };
  await saveState(locations.extensionRoot, state);
}

test("removes an orphan from the default user scope and reports it", async () => {
  await withHermeticEnvironment("prune-owner-user-", async ({ cwd }) => {
    await seedRecord(
      "user",
      cwd,
      JSON.stringify({ name: "mp", plugins: [{ name: "orphan", source: "./orphan" }] }),
    );
    const { ctx, notifications } = makeCtx(cwd);
    const locations = locationsFor("user", cwd);

    await prune()({ ctx, pi: { getAllTools: () => [] }, cwd });

    assert.deepStrictEqual((await loadState(locations.extensionRoot)).marketplaces.mp?.plugins, {});
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [user]\n  ○ orphan v1.0.0 (uninstalled) {dependency pruned}\n\n/reload to pick up changes",
      },
    ]);
  });
});

test("does not save or notify when the selected project scope has no installs", async () => {
  await withHermeticEnvironment("prune-owner-empty-", async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await saveState(locations.extensionRoot, { schemaVersion: 3, marketplaces: {} });
    const before = await readFile(locations.stateJsonPath);
    const { ctx, notifications } = makeCtx(cwd);

    await prune()({ ctx, pi: { getAllTools: () => [] }, cwd, scope: "project" });

    assert.deepStrictEqual(await readFile(locations.stateJsonPath), before);
    assert.deepStrictEqual(notifications, []);
  });
});

test("refuses an unreadable declarer before saving or removing it", async () => {
  await withHermeticEnvironment("prune-owner-unreadable-", async ({ cwd }) => {
    await seedRecord("user", cwd, "{");
    const locations = locationsFor("user", cwd);
    const before = await readFile(locations.stateJsonPath);
    const { ctx, notifications } = makeCtx(cwd);

    await prune()({ ctx, pi: { getAllTools: () => [] }, cwd });

    assert.deepStrictEqual(await readFile(locations.stateJsonPath), before);
    assert.deepStrictEqual(
      Object.keys((await loadState(locations.extensionRoot)).marketplaces.mp?.plugins ?? {}),
      ["orphan"],
    );
    assert.equal(notifications.length, 1);
    assert.match(notifications[0]?.message ?? "", /orphan.*failed.*unreadable/);
    assert.doesNotMatch(notifications[0]?.message ?? "", /\/reload|\/tmp\//);
  });
});
