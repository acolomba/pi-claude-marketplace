import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { unstagePluginCommands } from "../../../extensions/claude-marketplace/bridges/commands/unstage.ts";
import { locationsFor } from "../../../extensions/claude-marketplace/persistence/locations.ts";
import { pathExists } from "../../../extensions/claude-marketplace/shared/fs-utils.ts";

import type { ScopedLocations } from "../../../extensions/claude-marketplace/persistence/locations.ts";

interface TmpScope {
  loc: ScopedLocations;
  cleanup: () => Promise<void>;
}

async function tmpScope(): Promise<TmpScope> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "unstage-cmds-"));
  const loc = locationsFor("project", dir);
  await mkdir(loc.promptsTargetDir, { recursive: true });

  return {
    loc,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

test("unstagePluginCommands removes named files and reports removedNames", async () => {
  const scope = await tmpScope();

  try {
    // Pre-create three command files.
    const a = path.join(scope.loc.promptsTargetDir, "acme:one.md");
    const b = path.join(scope.loc.promptsTargetDir, "acme:two.md");
    const c = path.join(scope.loc.promptsTargetDir, "other:keep.md");
    await writeFile(a, "1");
    await writeFile(b, "2");
    await writeFile(c, "3");

    const result = await unstagePluginCommands({
      locations: scope.loc,
      previousCommandNames: ["acme:one", "acme:two"],
    });

    assert.deepEqual([...result.removedNames], ["acme:one", "acme:two"]);
    assert.equal(await pathExists(a), false);
    assert.equal(await pathExists(b), false);
    // Untouched file still present.
    assert.equal(await pathExists(c), true);
  } finally {
    await scope.cleanup();
  }
});

test("unstagePluginCommands tolerates ENOENT on missing files (idempotent)", async () => {
  const scope = await tmpScope();

  try {
    // Only one of two named files exists.
    const present = path.join(scope.loc.promptsTargetDir, "acme:present.md");
    await writeFile(present, "x");

    const result = await unstagePluginCommands({
      locations: scope.loc,
      previousCommandNames: ["acme:present", "acme:never-existed"],
    });

    // Only the file that actually existed shows up in removedNames; the
    // ENOENT-skipped name is omitted but the function does not throw.
    assert.deepEqual([...result.removedNames], ["acme:present"]);
    assert.equal(await pathExists(present), false);
  } finally {
    await scope.cleanup();
  }
});

test("unstagePluginCommands returns empty result when previousCommandNames is empty", async () => {
  const scope = await tmpScope();

  try {
    const result = await unstagePluginCommands({
      locations: scope.loc,
      previousCommandNames: [],
    });

    assert.deepEqual([...result.removedNames], []);
    assert.deepEqual([...result.warnings], []);
  } finally {
    await scope.cleanup();
  }
});

test("unstagePluginCommands is repeat-safe (calling twice yields same end state)", async () => {
  const scope = await tmpScope();

  try {
    const target = path.join(scope.loc.promptsTargetDir, "acme:once.md");
    await writeFile(target, "x");

    // First call removes the file and reports it.
    const first = await unstagePluginCommands({
      locations: scope.loc,
      previousCommandNames: ["acme:once"],
    });
    assert.deepEqual([...first.removedNames], ["acme:once"]);
    assert.equal(await pathExists(target), false);

    // Second call is a no-op (ENOENT silenced); removedNames is empty.
    const second = await unstagePluginCommands({
      locations: scope.loc,
      previousCommandNames: ["acme:once"],
    });
    assert.deepEqual([...second.removedNames], []);
  } finally {
    await scope.cleanup();
  }
});
