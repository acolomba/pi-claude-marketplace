import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("PRL-01/03/04/05/13/14/15/16: README documents reinstall command forms and semantics", async () => {
  const readme = await readFile(path.join(REPO_ROOT, "README.md"), "utf8");

  for (const expected of [
    "/claude:plugin reinstall pr-review-toolkit@claude-plugins-official",
    "/claude:plugin reinstall @claude-plugins-official",
    "/claude:plugin reinstall",
    "/claude:plugin reinstall --scope project",
    "/claude:plugin reinstall pr-review-toolkit@claude-plugins-official --force",
    "cached marketplace manifest",
    "does not fetch, pull, or otherwise sync the marketplace from the network",
    "installed record's existing version",
    "Reinstall targets installed plugins only.",
    "the marketplace reference identifies the source marketplace",
    "reports `not installed` in the selected scope instead of failing just because that marketplace is configured in another scope",
    "No plugins installed.",
    "does not emit a reload hint",
    "Plugin data directories are deleted only after replacement resources and `state.json` commit successfully",
  ]) {
    assert.ok(readme.includes(expected), `README should include: ${expected}`);
  }
});
