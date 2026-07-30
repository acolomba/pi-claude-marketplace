import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

interface PackageJson {
  peerDependencies?: Record<string, string>;
}

interface PackageLockJson {
  packages?: Record<string, { peerDependencies?: Record<string, string> }>;
}

const PEER = "@earendil-works/pi-coding-agent";

test("package.json peerDependencies pins the pi-coding-agent floor at >=0.80.5 (FLOOR-01)", async () => {
  const raw = await readFile(path.join(REPO_ROOT, "package.json"), "utf8");
  const pkg = JSON.parse(raw) as PackageJson;

  const range = pkg.peerDependencies?.[PEER];
  assert.ok(range, `peerDependencies["${PEER}"] is missing`);
  assert.equal(range, ">=0.80.5", `FLOOR-01 violation: expected floor ">=0.80.5", got "${range}"`);
});

test("package-lock.json root peerDependencies stays in sync with package.json for pi-coding-agent (FLOOR-01)", async () => {
  const [pkgRaw, lockRaw] = await Promise.all([
    readFile(path.join(REPO_ROOT, "package.json"), "utf8"),
    readFile(path.join(REPO_ROOT, "package-lock.json"), "utf8"),
  ]);
  const pkg = JSON.parse(pkgRaw) as PackageJson;
  const lock = JSON.parse(lockRaw) as PackageLockJson;

  const pkgRange = pkg.peerDependencies?.[PEER];
  const lockRange = lock.packages?.[""]?.peerDependencies?.[PEER];

  assert.ok(lockRange, `package-lock.json packages[""].peerDependencies["${PEER}"] is missing`);
  assert.equal(
    lockRange,
    pkgRange,
    `package-lock.json is out of sync: package.json has "${pkgRange}", lock has "${lockRange}"`,
  );
});
