import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { unstagePluginCommands } from "../../../extensions/pi-claude-marketplace/bridges/commands/unstage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

interface CommandScope {
  readonly directory: string;
  readonly locations: ScopedLocations;
}

async function createCommandScope(t: TestContext, prefix: string): Promise<CommandScope> {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const locations = locationsFor("project", directory);
  await mkdir(locations.promptsTargetDir, { recursive: true });
  return { directory, locations };
}

test("removes the recorded prompts in order and preserves foreign prompt bytes", async (t) => {
  // arrange
  const { locations } = await createCommandScope(t, "commands-unstage-recorded-");
  const firstPromptPath = path.join(locations.promptsTargetDir, "acme:deploy.md");
  const secondPromptPath = path.join(locations.promptsTargetDir, "acme:status.md");
  const foreignPromptPath = path.join(locations.promptsTargetDir, "other:keep.md");
  await writeFile(firstPromptPath, "deploy bytes\n");
  await writeFile(secondPromptPath, "status bytes\n");
  await writeFile(foreignPromptPath, "foreign bytes\n");
  const expectedUnstagedCommands = {
    removedNames: ["acme:status", "acme:deploy"],
    warnings: [],
  };

  // act
  const unstagedCommands = await unstagePluginCommands({
    locations,
    previousCommandNames: ["acme:status", "acme:deploy"],
  });

  // assert
  assert.deepStrictEqual(unstagedCommands, expectedUnstagedCommands);
  assert.strictEqual(Object.isFrozen(unstagedCommands.removedNames), true);
  assert.strictEqual(Object.isFrozen(unstagedCommands.warnings), true);
  assert.deepStrictEqual(await readdir(locations.promptsTargetDir), ["other:keep.md"]);
  assert.strictEqual(await readFile(foreignPromptPath, "utf8"), "foreign bytes\n");
});
