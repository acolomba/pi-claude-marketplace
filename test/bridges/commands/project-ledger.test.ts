import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import {
  commandFileDigest,
  projectCommandChange,
} from "../../../extensions/pi-claude-marketplace/bridges/commands/project-ledger.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

describe("commandFileDigest", () => {
  for (const { text, sha256 } of [
    { text: "", sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
    {
      text: "Status: ran\n",
      sha256: "a9f9f3dbcc3be393074debc4c80a0bef02b1970f2510dc5e53c5c2bb9d9543c4",
    },
    { text: "café\n", sha256: "7b49b9e063bd91a4f9252b413261f5557b9c570aa61516989499f64a62dbcdd6" },
  ]) {
    test(`D-CF3-07 digests ${JSON.stringify(text)} as the lowercase hex SHA-256 of its UTF-8 bytes`, () => {
      // arrange
      const expectedDigest = sha256;

      // act
      const digest = commandFileDigest(text);

      // assert
      assert.strictEqual(digest, expectedDigest);
    });
  }
});

describe("projectCommandChange", () => {
  test("D-CF3-07 forgets the names in the project that holds the scope root", async (t) => {
    // arrange
    const projectDir = await mkdtemp(path.join(tmpdir(), "commands-ledger-change-"));
    t.after(() => rm(projectDir, { recursive: true, force: true }));
    const locations = locationsFor("project", projectDir);

    // act
    const change = projectCommandChange(locations, ["acme:old", "acme:build:web"]);

    // assert
    assert.deepStrictEqual(change, {
      projectPath: projectDir,
      forget: ["acme:old", "acme:build:web"],
      remember: new Map(),
    });
  });

  test("D-CF3-07 makes no change for a user-scope location", async (t) => {
    // arrange
    const { agentDir } = await createHermeticEnvironment(t, "commands-ledger-user-");
    const locations = locationsFor("user", agentDir);

    // act
    const change = projectCommandChange(locations, ["acme:old"]);

    // assert
    assert.strictEqual(change, undefined);
  });
});
