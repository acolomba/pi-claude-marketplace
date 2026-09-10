import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { PACKAGE_JSON_REL, PACKAGE_LOCK_REL } from "./gate-targets.ts";
import { REPO_ROOT } from "./source-scan.ts";

interface PackageJson {
  peerDependencies?: Record<string, string>;
}

interface PackageLockJson {
  packages?: Record<string, { peerDependencies?: Record<string, string> }>;
}

const PEER = "@earendil-works/pi-coding-agent";

test("package.json peerDependencies pins the pi-coding-agent floor at >=0.80.5 (FLOOR-01)", async () => {
  const raw = await readFile(path.join(REPO_ROOT, PACKAGE_JSON_REL), "utf8");
  const pkg = JSON.parse(raw) as PackageJson;

  const range = pkg.peerDependencies?.[PEER];
  assert.ok(range, `peerDependencies["${PEER}"] is missing`);
  assert.equal(range, ">=0.80.5", `FLOOR-01 violation: expected floor ">=0.80.5", got "${range}"`);
});

test("package-lock.json root peerDependencies stays in sync with package.json for pi-coding-agent (FLOOR-01)", async () => {
  const [pkgRaw, lockRaw] = await Promise.all([
    readFile(path.join(REPO_ROOT, PACKAGE_JSON_REL), "utf8"),
    readFile(path.join(REPO_ROOT, PACKAGE_LOCK_REL), "utf8"),
  ]);
  const pkg = JSON.parse(pkgRaw) as PackageJson;
  const lock = JSON.parse(lockRaw) as PackageLockJson;

  const pkgRange = pkg.peerDependencies?.[PEER];
  const lockRange = lock.packages?.[""]?.peerDependencies?.[PEER];

  // D-07-03: without this, a manifest that stopped declaring the peer would be
  // reported as a lock desync rather than as the missing declaration it is, and
  // the sync claim would rest on a field the gate never read.
  assert.ok(
    pkgRange,
    `D-07-03: ${PACKAGE_JSON_REL} declares no peerDependencies["${PEER}"], so there is nothing to compare the lock against`,
  );
  assert.ok(lockRange, `${PACKAGE_LOCK_REL} packages[""].peerDependencies["${PEER}"] is missing`);
  assert.equal(
    lockRange,
    pkgRange,
    `${PACKAGE_LOCK_REL} is out of sync: ${PACKAGE_JSON_REL} has "${pkgRange}", lock has "${lockRange}"`,
  );
});
