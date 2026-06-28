import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { EXTENSION_VERSION } from "../../extensions/pi-claude-marketplace/shared/extension-version.ts";

/**
 * BFILL-02 -- drift guard pinning the checked-in EXTENSION_VERSION constant
 * to the repo-root package.json `version`. The constant is the version-gate
 * input for the load-time backfill scan; if the two desync, the gate would
 * compare against a stale version. This test turns any desync into a hard CI
 * failure so the constant must be bumped in lockstep with package.json.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("BFILL-02 EXTENSION_VERSION is a non-empty semver-shaped string", () => {
  assert.equal(typeof EXTENSION_VERSION, "string");
  assert.match(EXTENSION_VERSION, /^\d+\.\d+\.\d+/);
});

test("BFILL-02 EXTENSION_VERSION equals the repo-root package.json version", async () => {
  const pkgRaw = await readFile(path.join(REPO_ROOT, "package.json"), "utf8");
  const pkg = JSON.parse(pkgRaw) as { version: string };
  assert.equal(EXTENSION_VERSION, pkg.version);
});
