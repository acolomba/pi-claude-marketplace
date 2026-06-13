import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { PINNED_SHA } from "./_pinned-sha.ts";
import { TARGETS, targetSourcePath } from "./_targets.ts";

const FIXTURE_ROOT = path.resolve("tests/e2e/_fixtures", PINNED_SHA);

test("pinned SHA and target catalog are deterministic", () => {
  assert.equal(PINNED_SHA, "6196a61bdeece7b9889ecda1e45bd7085788ae75");
  assert.deepEqual(
    TARGETS.map((target) => [target.plugin, target.kind, target.softDepMatrix]),
    [
      ["frontend-design", "skills", false],
      ["code-review", "commands", false],
      ["code-simplifier", "agents", true],
      ["context7", "mcp", true],
    ],
  );

  for (const target of TARGETS) {
    const sourcePath = targetSourcePath("/tmp/upstream", target);
    assert.ok(sourcePath.startsWith("/tmp/upstream/"));
    assert.match(sourcePath, new RegExp(`/${target.sourceDirectory}$`));
    assert.ok(target.rationale.length > 20, `${target.plugin} has rationale`);
  }
});

test("fixture snapshots live under the full pinned SHA", async () => {
  await access(path.join(FIXTURE_ROOT, "marketplace.json"));

  for (const target of TARGETS) {
    const fixturePath = path.join(FIXTURE_ROOT, target.fixtureDirectory, "plugin.json");
    const parsed = JSON.parse(await readFile(fixturePath, "utf8")) as { name?: unknown };
    assert.equal(parsed.name, target.plugin);
  }
});
