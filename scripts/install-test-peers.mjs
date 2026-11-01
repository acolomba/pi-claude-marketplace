// Installs the optional peers that the integration tests import into
// node_modules/.cache/optional-peers. PIFL-03 keeps pi-mcp-adapter,
// pi-subagents, and @quintinshaw/pi-dynamic-workflows out of package.json
// dependencies and package-lock.json, so the tests read them from this cache.
// Each peer is the lowest version that its package.json `peerDependencies`
// range admits (PIFL-02).
//
// With no lockfile, the peers' own dependency ranges would resolve to the
// newest release on each run. `--before` caps resolution at the newest floor's
// registry publish time, so every machine gets the same tree and a release
// published later cannot enter. `--omit=peer` keeps the peers' own peers out;
// the modules the tests import link none of them. `npm run --silent` exports a
// silent log level to child processes, so each npm call passes `--loglevel=warn`
// to keep npm's error text. The install lands in a temporary sibling directory
// and replaces the cache only after it verifies, so an interrupted run never
// leaves a partial cache.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { minVersion } from "semver";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
// test/integration/optional-peer.ts reads this directory; change the two together.
const cacheParent = path.join(projectRoot, "node_modules", ".cache");
const cacheDir = path.join(cacheParent, "optional-peers");
const peerNames = ["pi-mcp-adapter", "pi-subagents", "@quintinshaw/pi-dynamic-workflows"];
const retryHint = "Run `node scripts/install-test-peers.mjs` to retry.";

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function readFloors() {
  const { peerDependencies = {} } = readJson(path.join(projectRoot, "package.json"));

  return peerNames.map((name) => {
    const range = peerDependencies[name];
    if (range === undefined) {
      throw new Error(`package.json declares no ${name} peer range`);
    }

    const floor = minVersion(range);
    if (floor === null) {
      throw new Error(`package.json declares no usable ${name} peer range: ${range}`);
    }

    return { name, version: floor.version };
  });
}

function toSpecs(floors) {
  return floors.map(({ name, version }) => `${name}@${version}`);
}

function holdsFloor(dir, { name, version }) {
  const manifestPath = path.join(dir, "node_modules", name, "package.json");
  if (!existsSync(manifestPath)) {
    return false;
  }

  try {
    const manifest = readJson(manifestPath);
    return manifest.name === name && manifest.version === version;
  } catch {
    // An unreadable manifest is a damaged cache, which the install replaces.
    return false;
  }
}

function holdsFloors(dir, floors) {
  return floors.every((floor) => holdsFloor(dir, floor));
}

function runNpm(args) {
  const result = spawnSync("npm", args, { encoding: "utf8" });
  if (result.error === undefined && result.status === 0) {
    return result.stdout;
  }

  const output = [result.error?.message, result.stdout, result.stderr]
    .filter((text) => typeof text === "string" && text.trim() !== "")
    .join("\n")
    .trim();
  throw new Error(
    `npm ${args[0]} failed. The first install of the optional test peers needs the npm registry.\n${output}\n${retryHint}`,
  );
}

function readPublishTime({ name, version }) {
  const publishTimes = JSON.parse(
    runNpm(["view", `${name}@${version}`, "time", "--json", "--loglevel=warn"]),
  );
  const published = new Date(publishTimes[version]);
  if (Number.isNaN(published.getTime())) {
    throw new Error(`The npm registry reports no publish time for ${name}@${version}.`);
  }

  return published;
}

function readCutoff(floors) {
  const times = floors.map((floor) => readPublishTime(floor).getTime());
  return new Date(Math.max(...times)).toISOString();
}

// Every package npm fetched carries the registry's sha512 `integrity`, which npm
// checked against the tarball. A git or URL source carries none. An `inBundle`
// entry ships inside a parent tarball whose integrity covers it.
function assertRegistryIntegrity(dir) {
  const { packages = {} } = readJson(path.join(dir, "node_modules", ".package-lock.json"));

  for (const [location, entry] of Object.entries(packages)) {
    if (location !== "" && entry.inBundle !== true && typeof entry.integrity !== "string") {
      throw new Error(
        `${location} in the optional test peer install has no registry integrity hash.`,
      );
    }
  }
}

function installInto(dir, floors, cutoff) {
  runNpm([
    "install",
    "--prefix",
    dir,
    "--ignore-scripts",
    "--omit=peer",
    "--no-save",
    "--no-package-lock",
    "--no-audit",
    "--no-fund",
    "--loglevel=warn",
    `--before=${cutoff}`,
    ...toSpecs(floors),
  ]);

  if (!holdsFloors(dir, floors)) {
    throw new Error(`npm did not install ${toSpecs(floors).join(" ")} into ${dir}.`);
  }

  assertRegistryIntegrity(dir);
}

function swapIntoCache(tmpDir, floors) {
  rmSync(cacheDir, { recursive: true, force: true });

  try {
    renameSync(tmpDir, cacheDir);
  } catch (error) {
    // A concurrent run can put its verified cache in place first.
    if (!holdsFloors(cacheDir, floors)) {
      throw error;
    }
  }
}

function installPeers(floors) {
  const cutoff = readCutoff(floors);
  mkdirSync(cacheParent, { recursive: true });
  const tmpDir = mkdtempSync(path.join(cacheParent, "optional-peers-"));

  try {
    installInto(tmpDir, floors, cutoff);
    swapIntoCache(tmpDir, floors);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }

  return cutoff;
}

function main() {
  const floors = readFloors();
  const specs = toSpecs(floors).join(" ");

  if (holdsFloors(cacheDir, floors)) {
    if (process.env.CI) {
      process.stdout.write(`Optional test peers ${specs} are cached.\n`);
    }

    return;
  }

  const cutoff = installPeers(floors);
  process.stdout.write(
    `Installed optional test peers ${specs} (published by ${cutoff}) into ${path.relative(projectRoot, cacheDir)}.\n`,
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
