import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { PACKAGE_JSON_REL, PACKAGE_LOCK_REL } from "./gate-targets.ts";
import { REPO_ROOT } from "./source-scan.ts";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

interface PackageLockJson {
  packages?: Record<string, { peerDependencies?: Record<string, string> }>;
}

const PEER = "@earendil-works/pi-coding-agent";
const SUBAGENTS_PEER = "pi-subagents";
const MCP_ADAPTER_PEER = "pi-mcp-adapter";

async function readPackageJson(): Promise<PackageJson> {
  return JSON.parse(await readFile(path.join(REPO_ROOT, PACKAGE_JSON_REL), "utf8")) as PackageJson;
}

async function readPackageLock(): Promise<PackageLockJson> {
  return JSON.parse(
    await readFile(path.join(REPO_ROOT, PACKAGE_LOCK_REL), "utf8"),
  ) as PackageLockJson;
}

test("package.json peerDependencies pins the pi-coding-agent floor at >=1.0.0 (FLOOR-01)", async () => {
  // arrange
  const pkg = await readPackageJson();

  // act
  const range = pkg.peerDependencies?.[PEER];

  // assert
  assert.ok(range, `peerDependencies["${PEER}"] is missing`);
  assert.equal(range, ">=1.0.0", `FLOOR-01 violation: expected floor ">=1.0.0", got "${range}"`);
});

test("package-lock.json root peerDependencies stays in sync with package.json for pi-coding-agent (FLOOR-01)", async () => {
  // arrange
  const [pkg, lock] = await Promise.all([readPackageJson(), readPackageLock()]);

  // act
  const pkgRange = pkg.peerDependencies?.[PEER];
  const lockRange = lock.packages?.[""]?.peerDependencies?.[PEER];

  // assert
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

test("package.json declares the optional pi-subagents peer at >=0.74.0 and the lock root mirrors it (PIFL-02)", async () => {
  // arrange
  const [pkg, lock] = await Promise.all([readPackageJson(), readPackageLock()]);

  // act
  const pkgRange = pkg.peerDependencies?.[SUBAGENTS_PEER];
  const lockRange = lock.packages?.[""]?.peerDependencies?.[SUBAGENTS_PEER];
  const meta = pkg.peerDependenciesMeta?.[SUBAGENTS_PEER];

  // assert
  assert.equal(pkgRange, ">=0.74.0");
  assert.equal(lockRange, pkgRange);
  assert.deepStrictEqual(meta, { optional: true });
});

test("package.json declares pi-mcp-adapter as an optional peer at >=5.2.0 <6 (PIFL-03)", async () => {
  // arrange
  const pkg = await readPackageJson();

  // act
  const range = pkg.peerDependencies?.[MCP_ADAPTER_PEER];
  const meta = pkg.peerDependenciesMeta?.[MCP_ADAPTER_PEER];

  // assert
  assert.equal(range, ">=5.2.0 <6");
  assert.deepStrictEqual(meta, { optional: true });
});

test("pi-mcp-adapter is never installed as a dependency, a devDependency, or a lock package (PIFL-03)", async () => {
  // arrange
  const [pkg, lock] = await Promise.all([readPackageJson(), readPackageLock()]);

  // act
  const declaredAsDependency = Object.hasOwn(pkg.dependencies ?? {}, MCP_ADAPTER_PEER);
  const declaredAsDevDependency = Object.hasOwn(pkg.devDependencies ?? {}, MCP_ADAPTER_PEER);
  const lockedAsPackage = Object.hasOwn(lock.packages ?? {}, `node_modules/${MCP_ADAPTER_PEER}`);

  // assert
  assert.deepStrictEqual(
    { declaredAsDependency, declaredAsDevDependency, lockedAsPackage },
    { declaredAsDependency: false, declaredAsDevDependency: false, lockedAsPackage: false },
  );
});

test("package-lock.json root peerDependencies mirrors package.json for pi-mcp-adapter (PIFL-03)", async () => {
  // arrange
  const [pkg, lock] = await Promise.all([readPackageJson(), readPackageLock()]);

  // act
  const pkgRange = pkg.peerDependencies?.[MCP_ADAPTER_PEER];
  const lockRange = lock.packages?.[""]?.peerDependencies?.[MCP_ADAPTER_PEER];

  // assert
  assert.equal(pkgRange, ">=5.2.0 <6");
  assert.equal(lockRange, pkgRange);
});
