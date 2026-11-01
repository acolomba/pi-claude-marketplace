import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import {
  hookConfigDigest,
  projectHookChange,
  projectHookLedgerKey,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/project-ledger.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

describe("projectHookLedgerKey", () => {
  test("D-CF2-13 keys a plugin's hooks config with a slash no skill name holds", () => {
    // arrange
    const plugin = "demo";

    // act
    const key = projectHookLedgerKey(plugin);

    // assert
    assert.strictEqual(key, "hooks/demo");
  });
});

describe("hookConfigDigest", () => {
  for (const { bytes, sha256 } of [
    { bytes: "", sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
    { bytes: "café\n", sha256: "7b49b9e063bd91a4f9252b413261f5557b9c570aa61516989499f64a62dbcdd6" },
    {
      bytes: Buffer.from("café\n", "utf8"),
      sha256: "7b49b9e063bd91a4f9252b413261f5557b9c570aa61516989499f64a62dbcdd6",
    },
  ]) {
    test(`D-CF2-13 digests the ${typeof bytes} ${JSON.stringify(String(bytes))} as the hex SHA-256 of its UTF-8 bytes`, () => {
      // arrange
      const expectedDigest = sha256;

      // act
      const digest = hookConfigDigest(bytes);

      // assert
      assert.strictEqual(digest, expectedDigest);
    });
  }
});

describe("projectHookChange", () => {
  test("D-CF2-13 forgets the plugin's hooks in the project that holds the scope root", async (t) => {
    // arrange
    const projectDir = await mkdtemp(path.join(tmpdir(), "hooks-ledger-change-"));
    t.after(() => rm(projectDir, { recursive: true, force: true }));
    const locations = locationsFor("project", projectDir);

    // act
    const change = projectHookChange(locations, "demo");

    // assert
    assert.deepStrictEqual(change, {
      projectPath: projectDir,
      forget: ["hooks/demo"],
      remember: new Map(),
    });
  });

  test("D-CF2-13 makes no change for a user-scope location", async (t) => {
    // arrange
    const { agentDir } = await createHermeticEnvironment(t, "hooks-ledger-user-");
    const locations = locationsFor("user", agentDir);

    // act
    const change = projectHookChange(locations, "demo");

    // assert
    assert.strictEqual(change, undefined);
  });
});
