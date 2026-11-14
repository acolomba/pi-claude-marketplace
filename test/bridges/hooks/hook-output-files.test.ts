import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import { saveHookOutput } from "../../../extensions/pi-claude-marketplace/bridges/hooks/hook-output-files.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { PathContainmentError } from "../../../extensions/pi-claude-marketplace/shared/path-safety.ts";

const HOOK_ID = "3f2b8c1e-0d4a-4b6e-9a7c-5e1f2d3c4b5a";

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
