import assert from "node:assert/strict";
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  saveHookOutput,
  sweepHookOutput,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/hook-output-files.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { PathContainmentError } from "../../../extensions/pi-claude-marketplace/shared/path-safety.ts";
import { captureDebugLog } from "../../platform/debug-log-capture.ts";

import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

const HOOK_ID = "3f2b8c1e-0d4a-4b6e-9a7c-5e1f2d3c4b5a";
const NOW = Date.UTC(2026, 10, 14);
const DAY_MS = 24 * 60 * 60 * 1000;

// A project scope over a temporary root of the case, so no case reaches the
// real home directory.
async function projectScope(t: TestContext, prefix: string) {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));

  return { root, loc: locationsFor("project", root) };
}

describe("saveHookOutput", () => {
  test("D-PG5-15: writes the whole text to hook-<id>-<source>.txt in _shared/hook-output", async (t) => {
    // arrange
    const { loc } = await projectScope(t, "hook-output-save-");
    const text = `${"x".repeat(12_000)}\n`;

    // act
    const savedPath = await saveHookOutput(loc, HOOK_ID, "additionalContext", text);

    // assert
    const expectedPath = path.join(
      loc.dataRoot,
      "_shared",
      "hook-output",
      `hook-${HOOK_ID}-additionalContext.txt`,
    );
    assert.deepStrictEqual(
      { savedPath, saved: await readFile(expectedPath, "utf8") },
      { savedPath: expectedPath, saved: text },
    );
  });

  test("NFR-10: refuses a hook-output folder that links outside the data root", async (t) => {
    // arrange
    const { root, loc } = await projectScope(t, "hook-output-link-");
    const outside = path.join(root, "outside");
    await mkdir(outside, { recursive: true });
    await mkdir(path.join(loc.dataRoot, "_shared"), { recursive: true });
    await symlink(outside, path.join(loc.dataRoot, "_shared", "hook-output"), "dir");

    // act
    const saving = saveHookOutput(loc, HOOK_ID, "systemMessage", "text");

    // assert
    await assert.rejects(saving, PathContainmentError);
    assert.deepStrictEqual(await readdir(outside), []);
  });
});

// Writes `name` in the scope's hook-output folder, last modified `ageMs`
// before NOW.
async function savedFile(loc: ScopedLocations, name: string, ageMs: number): Promise<void> {
  const folder = path.join(loc.dataRoot, "_shared", "hook-output");
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, name), "saved");
  const modified = new Date(NOW - ageMs);
  await utimes(path.join(folder, name), modified, modified);
}

function hookOutputNames(loc: ScopedLocations): Promise<string[]> {
  return readdir(path.join(loc.dataRoot, "_shared", "hook-output")).then((names) => names.sort());
}

describe("sweepHookOutput", () => {
  test("D-PG5-15: removes a saved file older than 30 days and keeps one of 30 days and a newer one", async (t) => {
    // arrange
    const { loc } = await projectScope(t, "hook-output-sweep-age-");
    await savedFile(loc, `hook-${HOOK_ID}-additionalContext.txt`, 31 * DAY_MS);
    await savedFile(loc, "hook-thirty-systemMessage.txt", 30 * DAY_MS);
    await savedFile(loc, "hook-new-stdout.txt", DAY_MS);

    // act
    await sweepHookOutput(loc, NOW);

    // assert
    assert.deepStrictEqual(await hookOutputNames(loc), [
      "hook-new-stdout.txt",
      "hook-thirty-systemMessage.txt",
    ]);
  });

  test("D-PG5-15: keeps an old regular file whose name is not a saved name", async (t) => {
    // arrange
    const { loc } = await projectScope(t, "hook-output-sweep-names-");
    const names = ["hook-a-other.txt", "hook-a-stdout.txt.bak", "hook-a_b-stdout.txt", "notes.txt"];
    await Promise.all(names.map((name) => savedFile(loc, name, 90 * DAY_MS)));

    // act
    await sweepHookOutput(loc, NOW);

    // assert
    assert.deepStrictEqual(await hookOutputNames(loc), [...names].sort());
  });

  test("NFR-10: keeps a link to an old file outside the folder, its target, and a sub-folder", async (t) => {
    // arrange
    const { root, loc } = await projectScope(t, "hook-output-sweep-links-");
    const folder = path.join(loc.dataRoot, "_shared", "hook-output");
    const target = path.join(root, "outside.txt");
    await mkdir(path.join(folder, "hook-dir-stdout.txt"), { recursive: true });
    await writeFile(target, "outside");
    const old = new Date(NOW - 90 * DAY_MS);
    await utimes(target, old, old);
    await utimes(path.join(folder, "hook-dir-stdout.txt"), old, old);
    await symlink(target, path.join(folder, "hook-link-stdout.txt"));

    // act
    await sweepHookOutput(loc, NOW);

    // assert
    assert.deepStrictEqual(
      { names: await hookOutputNames(loc), target: await readFile(target, "utf8") },
      { names: ["hook-dir-stdout.txt", "hook-link-stdout.txt"], target: "outside" },
    );
  });

  test("D-PG5-15: resolves with no debug line for a scope with no saved output", async (t) => {
    // arrange
    const { loc } = await projectScope(t, "hook-output-sweep-missing-");
    const logged = captureDebugLog(t);

    // act
    await sweepHookOutput(loc, NOW);

    // assert
    assert.deepStrictEqual(logged, []);
  });

  test("NFR-2: writes one debug line and removes nothing when the folder cannot be read", async (t) => {
    // arrange
    const { loc } = await projectScope(t, "hook-output-sweep-unreadable-");
    await savedFile(loc, "hook-old-stdout.txt", 90 * DAY_MS);
    const folder = path.join(loc.dataRoot, "_shared", "hook-output");
    await chmod(folder, 0o000);
    const logged = captureDebugLog(t);

    // act
    await sweepHookOutput(loc, NOW);
    await chmod(folder, 0o700);

    // assert
    assert.deepStrictEqual(
      {
        logged: logged.map((line) => line.startsWith("[hooks] hook-output: sweep failed: ")),
        names: await hookOutputNames(loc),
      },
      { logged: [true], names: ["hook-old-stdout.txt"] },
    );
  });

  test("NFR-10: writes one debug line and removes nothing through a folder link outside the data root", async (t) => {
    // arrange
    const { root, loc } = await projectScope(t, "hook-output-sweep-folder-link-");
    const outside = path.join(root, "outside");
    await mkdir(outside, { recursive: true });
    await writeFile(path.join(outside, "hook-old-stdout.txt"), "outside");
    const old = new Date(NOW - 90 * DAY_MS);
    await utimes(path.join(outside, "hook-old-stdout.txt"), old, old);
    await mkdir(path.join(loc.dataRoot, "_shared"), { recursive: true });
    await symlink(outside, path.join(loc.dataRoot, "_shared", "hook-output"), "dir");
    const logged = captureDebugLog(t);

    // act
    await sweepHookOutput(loc, NOW);

    // assert
    assert.deepStrictEqual(
      {
        logged: logged.map((line) => line.startsWith("[hooks] hook-output: sweep failed: ")),
        names: await readdir(outside),
      },
      { logged: [true], names: ["hook-old-stdout.txt"] },
    );
  });
});
