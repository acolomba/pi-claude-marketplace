import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { unstagePluginCommands } from "../../../extensions/pi-claude-marketplace/bridges/commands/unstage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  PathContainmentError,
  SymlinkRefusedError,
} from "../../../extensions/pi-claude-marketplace/shared/path-safety.ts";

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

test("returns an empty result when no prompt names were recorded", async (t) => {
  // arrange
  const { locations } = await createCommandScope(t, "commands-unstage-empty-");
  const foreignPromptPath = path.join(locations.promptsTargetDir, "other:keep.md");
  await writeFile(foreignPromptPath, "foreign bytes\n");

  // act
  const unstagedCommands = await unstagePluginCommands({
    locations,
    previousCommandNames: [],
  });

  // assert
  assert.deepStrictEqual(unstagedCommands, { removedNames: [], warnings: [] });
  assert.deepStrictEqual(await readdir(locations.promptsTargetDir), ["other:keep.md"]);
  assert.strictEqual(await readFile(foreignPromptPath, "utf8"), "foreign bytes\n");
});

test("makes repeated unstaging a missing-file fixed point", async (t) => {
  // arrange
  const { locations } = await createCommandScope(t, "commands-unstage-repeat-");
  const promptPath = path.join(locations.promptsTargetDir, "acme:once.md");
  await writeFile(promptPath, "prompt bytes\n");

  // act
  const firstUnstage = await unstagePluginCommands({
    locations,
    previousCommandNames: ["acme:once"],
  });
  const replayedUnstage = await unstagePluginCommands({
    locations,
    previousCommandNames: ["acme:once"],
  });

  // assert
  assert.deepStrictEqual(firstUnstage, { removedNames: ["acme:once"], warnings: [] });
  assert.deepStrictEqual(replayedUnstage, { removedNames: [], warnings: [] });
  assert.deepStrictEqual(await readdir(locations.promptsTargetDir), []);
});

test("keeps removal order when missing prompt names are interleaved", async (t) => {
  // arrange
  const { locations } = await createCommandScope(t, "commands-unstage-order-");
  const firstPromptPath = path.join(locations.promptsTargetDir, "acme:first.md");
  const secondPromptPath = path.join(locations.promptsTargetDir, "acme:second.md");
  await writeFile(firstPromptPath, "first bytes\n");
  await writeFile(secondPromptPath, "second bytes\n");

  // act
  const unstagedCommands = await unstagePluginCommands({
    locations,
    previousCommandNames: ["acme:second", "acme:missing", "acme:first"],
  });

  // assert
  assert.deepStrictEqual(unstagedCommands, {
    removedNames: ["acme:second", "acme:first"],
    warnings: [],
  });
  assert.deepStrictEqual(await readdir(locations.promptsTargetDir), []);
});

test("rejects a traversal name without removing the escaped prompt", async (t) => {
  // arrange
  const { locations } = await createCommandScope(t, "commands-unstage-traversal-");
  const escapedPromptPath = path.join(locations.promptsTargetDir, "..", "escape.md");
  await writeFile(escapedPromptPath, "escaped bytes\n");
  const expectedError = {
    name: "PathContainmentError",
    message: `command to unstage escapes ${locations.promptsTargetDir} (resolved: ${escapedPromptPath}).`,
    parent: locations.promptsTargetDir,
    child: escapedPromptPath,
  };
  let containmentError: unknown;

  // act
  try {
    await unstagePluginCommands({
      locations,
      previousCommandNames: ["../escape"],
    });
  } catch (error) {
    containmentError = error;
  }

  // assert
  assert.ok(containmentError instanceof PathContainmentError);
  assert.strictEqual(containmentError instanceof SymlinkRefusedError, false);
  assert.deepStrictEqual(
    {
      name: containmentError.name,
      message: containmentError.message,
      parent: containmentError.parent,
      child: containmentError.child,
    },
    expectedError,
  );
  assert.strictEqual(await readFile(escapedPromptPath, "utf8"), "escaped bytes\n");
  assert.deepStrictEqual(await readdir(locations.promptsTargetDir), []);
});

test("refuses a symlinked prompt path without removing foreign bytes", async (t) => {
  // arrange
  const { directory, locations } = await createCommandScope(t, "commands-unstage-symlink-");
  const foreignDirectory = path.join(directory, "foreign-prompts");
  const foreignPromptPath = path.join(foreignDirectory, "deploy.md");
  const linkPath = path.join(locations.promptsTargetDir, "linked");
  const linkedPromptPath = path.join(linkPath, "deploy.md");
  await mkdir(foreignDirectory);
  await writeFile(foreignPromptPath, "foreign bytes\n");
  await symlink(foreignDirectory, linkPath, "dir");
  const expectedError = {
    name: "SymlinkRefusedError",
    message: `command to unstage contains symlink ${linkPath} -> ${foreignDirectory} (parent: ${locations.promptsTargetDir}, target: ${linkedPromptPath}).`,
    parent: locations.promptsTargetDir,
    child: linkedPromptPath,
    linkPath,
    linkTarget: foreignDirectory,
  };
  let symlinkError: unknown;

  // act
  try {
    await unstagePluginCommands({
      locations,
      previousCommandNames: ["linked/deploy"],
    });
  } catch (error) {
    symlinkError = error;
  }

  // assert
  assert.ok(symlinkError instanceof SymlinkRefusedError);
  assert.ok(symlinkError instanceof PathContainmentError);
  assert.deepStrictEqual(
    {
      name: symlinkError.name,
      message: symlinkError.message,
      parent: symlinkError.parent,
      child: symlinkError.child,
      linkPath: symlinkError.linkPath,
      linkTarget: symlinkError.linkTarget,
    },
    expectedError,
  );
  assert.strictEqual(await readFile(foreignPromptPath, "utf8"), "foreign bytes\n");
  assert.deepStrictEqual(await readdir(locations.promptsTargetDir), ["linked"]);
});

test("rethrows an unlink failure after removing only earlier prompts", async (t) => {
  // arrange
  const { locations } = await createCommandScope(t, "commands-unstage-failure-");
  const removedPromptPath = path.join(locations.promptsTargetDir, "acme:removed.md");
  const blockedPromptPath = path.join(locations.promptsTargetDir, "acme:blocked.md");
  const retainedPromptPath = path.join(locations.promptsTargetDir, "acme:retained.md");
  await writeFile(removedPromptPath, "removed bytes\n");
  await mkdir(blockedPromptPath);
  await writeFile(retainedPromptPath, "retained bytes\n");
  const expectedError = {
    name: "Error",
    message: `EISDIR: illegal operation on a directory, unlink '${blockedPromptPath}'`,
    code: "EISDIR",
    errno: -21,
    syscall: "unlink",
    path: blockedPromptPath,
  };
  let unstageError: unknown;

  // act
  try {
    await unstagePluginCommands({
      locations,
      previousCommandNames: ["acme:removed", "acme:blocked", "acme:retained"],
    });
  } catch (error) {
    unstageError = error;
  }

  // assert
  assert.ok(unstageError instanceof Error);
  const filesystemError = unstageError as NodeJS.ErrnoException;
  assert.deepStrictEqual(
    {
      name: filesystemError.name,
      message: filesystemError.message,
      code: filesystemError.code,
      errno: filesystemError.errno,
      syscall: filesystemError.syscall,
      path: filesystemError.path,
    },
    expectedError,
  );
  assert.deepStrictEqual(await readdir(locations.promptsTargetDir), [
    "acme:blocked.md",
    "acme:retained.md",
  ]);
  assert.strictEqual(await readFile(retainedPromptPath, "utf8"), "retained bytes\n");
});
