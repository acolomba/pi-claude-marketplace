import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { EXTENSION_VERSION } from "../../extensions/pi-claude-marketplace/shared/extension-version.ts";

import { PACKAGE_JSON_REL } from "./gate-targets.ts";
import { REPO_ROOT } from "./source-scan.ts";

/**
 * BFILL-02 -- drift guard pinning the checked-in EXTENSION_VERSION constant
 * to the repo-root package.json `version`. The constant is the version-gate
 * input for the load-time backfill scan; if the two desync, the gate would
 * compare against a stale version. This test turns any desync into a hard CI
 * failure so the constant must be bumped in lockstep with package.json.
 *
 * D-07-05: the manifest is addressed through `PACKAGE_JSON_REL` and the shared
 * `REPO_ROOT`, so the only path this gate names is one a literal-match scan of
 * the registry already sees.
 */

test("BFILL-02 EXTENSION_VERSION is a non-empty semver-shaped string", () => {
  assert.equal(typeof EXTENSION_VERSION, "string");
  assert.match(EXTENSION_VERSION, /^\d+\.\d+\.\d+/);
});

test("BFILL-02 EXTENSION_VERSION equals the repo-root package.json version", async () => {
  const pkgRaw = await readFile(path.join(REPO_ROOT, PACKAGE_JSON_REL), "utf8");
  const pkg = JSON.parse(pkgRaw) as { version?: string };

  // D-07-03: a manifest that parsed without a `version` key would make the
  // comparison below `undefined === undefined` on a stale constant, greening
  // the drift guard over a field it never actually read.
  assert.equal(
    typeof pkg.version,
    "string",
    `D-07-03: ${PACKAGE_JSON_REL} declares no version, so this gate compared nothing`,
  );
  assert.equal(EXTENSION_VERSION, pkg.version);
});
