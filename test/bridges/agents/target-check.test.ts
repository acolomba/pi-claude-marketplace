import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { prepareStagePluginAgents } from "../../../extensions/pi-claude-marketplace/bridges/agents/stage.ts";
import { assertAgentTargetsFree } from "../../../extensions/pi-claude-marketplace/bridges/agents/target-check.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  AgentOwnershipConflictError,
  AgentTargetOccupiedError,
} from "../../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";
import { createRemovalOps } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";

import type { AgentsIndex } from "../../../extensions/pi-claude-marketplace/persistence/agents-index-schema.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { TestContext } from "node:test";

const GENERATED_NAME = "pi-claude-marketplace-acme-bot";
const OWNED_BYTES = "---\nname: acme:bot\nprovenance:\n  generatedBy: pi-claude-marketplace\n---\n";
const USER_BYTES = "---\nname: my-bot\n---\nMy own agent.\n";

async function createScope(t: TestContext): Promise<ScopedLocations> {
  const scopeRoot = await realpath(await mkdtemp(path.join(tmpdir(), "agent-target-check-")));
  t.after(() => rm(scopeRoot, { recursive: true, force: true }));
  const locations = locationsFor("project", scopeRoot);
  await mkdir(locations.agentsDir, { recursive: true });
  return locations;
}

async function seedIndexRow(
  locations: ScopedLocations,
  marketplace: string,
  targetPath: string,
): Promise<void> {
  const index: AgentsIndex = {
    schemaVersion: 1,
    agents: [
      {
        plugin: "acme",
        marketplace,
        sourceAgent: "bot",
        generatedName: GENERATED_NAME,
        sourcePath: "/previous/bot.md",
        targetPath,
        sourceHash: "hash-bot",
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
    ],
  };
  await mkdir(locations.extensionRoot, { recursive: true });
  await writeFile(locations.agentsIndexPath, `${JSON.stringify(index, null, 2)}\n`);
}

function assertOccupiedRefusal(target: string): (error: unknown) => boolean {
  return (error: unknown) => {
    assert.ok(error instanceof AgentTargetOccupiedError);
    assert.strictEqual(error.targetPath, target);
    assert.strictEqual(
      error.message,
      `Cannot replace agent target with non-previous content at ${path.basename(target)}`,
    );
    return true;
  };
}

function assertOwnershipRefusal(error: unknown): boolean {
  assert.ok(error instanceof AgentOwnershipConflictError);
  assert.deepStrictEqual(error.stagingFor, { marketplace: "catalog", plugin: "acme" });
  assert.deepStrictEqual(error.conflicts, [
    { generatedName: GENERATED_NAME, owner: { marketplace: "other", plugin: "acme" } },
  ]);
  assert.strictEqual(
    error.message,
    'Refusing to stage agents for catalog/acme: "pi-claude-marketplace-acme-bot" already owned by other/acme.',
  );
  return true;
}

test("D-PL4-04: refuses a target that holds a file no index row of the plugin names and writes nothing", async (t) => {
  // arrange
  const locations = await createScope(t);
  const target = path.join(locations.agentsDir, `${GENERATED_NAME}.md`);
  await writeFile(target, USER_BYTES);

  // act & assert
  await assert.rejects(
    assertAgentTargetsFree(locations, { marketplace: "catalog", plugin: "acme" }, [GENERATED_NAME]),
    assertOccupiedRefusal(target),
  );

  // assert
  await assert.rejects(readFile(locations.agentsIndexPath), { code: "ENOENT" });
  assert.deepStrictEqual(await readdir(locations.agentsDir), [`${GENERATED_NAME}.md`]);
  assert.strictEqual(await readFile(target, "utf8"), USER_BYTES);
});

test("D-PL4-04: admits a target the plugin's own index row names while its file carries the generated marker", async (t) => {
  // arrange
  const locations = await createScope(t);
  const target = path.join(locations.agentsDir, `${GENERATED_NAME}.md`);
  await writeFile(target, OWNED_BYTES);
  await seedIndexRow(locations, "catalog", target);

  // act & assert
  await assert.doesNotReject(
    assertAgentTargetsFree(locations, { marketplace: "catalog", plugin: "acme" }, [GENERATED_NAME]),
  );
});

test("D-PL4-04: refuses a target the plugin's own index row names once a user changed its file", async (t) => {
  // arrange
  const locations = await createScope(t);
  const target = path.join(locations.agentsDir, `${GENERATED_NAME}.md`);
  await writeFile(target, USER_BYTES);
  await seedIndexRow(locations, "catalog", target);

  // act & assert
  await assert.rejects(
    assertAgentTargetsFree(locations, { marketplace: "catalog", plugin: "acme" }, [GENERATED_NAME]),
    assertOccupiedRefusal(target),
  );
});

test("D-PL4-04: refuses a target that a same-named plugin of another marketplace owns", async (t) => {
  // arrange
  const locations = await createScope(t);
  const target = path.join(locations.agentsDir, `${GENERATED_NAME}.md`);
  await writeFile(target, OWNED_BYTES);
  await seedIndexRow(locations, "other", target);

  // act & assert
  await assert.rejects(
    assertAgentTargetsFree(locations, { marketplace: "catalog", plugin: "acme" }, [GENERATED_NAME]),
    assertOwnershipRefusal,
  );
});

test("refuses a foreign index claim with no target file in both preview and staging without writes", async (t) => {
  // arrange
  const locations = await createScope(t);
  const target = path.join(locations.agentsDir, `${GENERATED_NAME}.md`);
  await seedIndexRow(locations, "other", target);
  const indexBytes = await readFile(locations.agentsIndexPath, "utf8");
  const pluginRoot = path.join(locations.scopeRoot, "plugin");
  const agentsDir = path.join(pluginRoot, "agents");
  await mkdir(agentsDir, { recursive: true });
  await writeFile(path.join(agentsDir, "bot.md"), "---\nname: bot\ndescription: Bot\n---\nBot.\n");

  // act & assert
  await assert.rejects(
    assertAgentTargetsFree(locations, { marketplace: "catalog", plugin: "acme" }, [GENERATED_NAME]),
    assertOwnershipRefusal,
  );
  await assert.rejects(
    prepareStagePluginAgents(createRemovalOps(), {
      locations,
      marketplaceName: "catalog",
      pluginName: "acme",
      cwd: locations.scopeRoot,
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "catalog", "acme"),
      agentsDirs: [agentsDir],
    }),
    assertOwnershipRefusal,
  );

  // assert
  assert.strictEqual(await readFile(locations.agentsIndexPath, "utf8"), indexBytes);
  assert.deepStrictEqual(await readdir(locations.agentsDir), []);
  await assert.rejects(readdir(locations.agentsStagingDir), { code: "ENOENT" });
});

test("D-PL4-04: admits a generated name whose target holds no file", async (t) => {
  // arrange
  const locations = await createScope(t);

  // act & assert
  await assert.doesNotReject(
    assertAgentTargetsFree(locations, { marketplace: "catalog", plugin: "acme" }, [GENERATED_NAME]),
  );
});

test("admits the plugin's own index claim when its target file is missing", async (t) => {
  // arrange
  const locations = await createScope(t);
  const target = path.join(locations.agentsDir, `${GENERATED_NAME}.md`);
  await seedIndexRow(locations, "catalog", target);

  // act & assert
  await assert.doesNotReject(
    assertAgentTargetsFree(locations, { marketplace: "catalog", plugin: "acme" }, [GENERATED_NAME]),
  );
});

test("D-PL4-04: refuses an occupied target behind a free one", async (t) => {
  // arrange
  const locations = await createScope(t);
  const second = "pi-claude-marketplace-acme-helper";
  const target = path.join(locations.agentsDir, `${second}.md`);
  await writeFile(target, USER_BYTES);

  // act & assert
  await assert.rejects(
    assertAgentTargetsFree(locations, { marketplace: "catalog", plugin: "acme" }, [
      GENERATED_NAME,
      second,
    ]),
    assertOccupiedRefusal(target),
  );
});
