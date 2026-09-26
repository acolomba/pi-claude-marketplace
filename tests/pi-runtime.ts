// The single module that finds the Pi CLI this repository runs. Every
// caller that launches Pi -- the e2e runtime-smoke helper
// (tests/e2e/_helpers.ts), the live-UAT canaries
// (tests/live-uat/stop-canary.mjs, tests/live-uat/manifest-absence-canary.mjs)
// and scripts/pi.sh -- resolves through `resolvePiRuntime` and then runs
// `process.execPath` (or `node`) with the returned `cliPath` as its first
// argument. None of them look up a `pi` on PATH, NODE_PATH, Node's global
// folders, or npm's bin-link shim.
//
// The lookup reads the installed package's own `package.json` directly
// instead of resolving it through `require.resolve`, because the package
// declares an `exports` map with no `./package.json` entry: that resolution
// throws ERR_PACKAGE_PATH_NOT_EXPORTED.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** The repository's own Pi CLI, resolved from the installed devDependency. */
export interface PiRuntime {
  /** Absolute path of the script the package's `bin.pi` entry names. */
  readonly cliPath: string;
  /** The package's own `version` field. */
  readonly version: string;
}

const PACKAGE_RELATIVE_PATH = path.join(
  "node_modules",
  "@earendil-works",
  "pi-coding-agent",
  "package.json",
);

/**
 * Finds the installed `@earendil-works/pi-coding-agent` manifest starting at
 * `startDir`, following Node's own package lookup order: the directory
 * itself, then each parent up to the filesystem root.
 */
function findManifestPath(startDir: string): string {
  let dir = startDir;
  for (;;) {
    const candidate = path.join(dir, PACKAGE_RELATIVE_PATH);
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `resolvePiRuntime: no @earendil-works/pi-coding-agent install found above ` +
          `${startDir}. Run \`npm ci\` to install the version package-lock.json pins.`,
      );
    }

    dir = parent;
  }
}

/**
 * Resolves the repository's own Pi CLI from the `@earendil-works/pi-coding-agent`
 * devDependency, searching from `repoRoot` upward. Throws a plain `Error`
 * naming what is missing (the search start, the manifest, or the CLI file)
 * and telling the reader to run `npm ci`.
 */
export function resolvePiRuntime(repoRoot: string): PiRuntime {
  const manifestPath = findManifestPath(path.resolve(repoRoot));
  const raw: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`resolvePiRuntime: ${manifestPath} is not a JSON object. Run \`npm ci\`.`);
  }

  if (!("version" in raw) || typeof raw.version !== "string") {
    throw new Error(`resolvePiRuntime: ${manifestPath} has no string "version". Run \`npm ci\`.`);
  }

  if (!("bin" in raw) || typeof raw.bin !== "object" || raw.bin === null || !("pi" in raw.bin)) {
    throw new Error(`resolvePiRuntime: ${manifestPath} has no "bin.pi" entry. Run \`npm ci\`.`);
  }

  const { pi } = raw.bin;
  if (typeof pi !== "string") {
    throw new Error(`resolvePiRuntime: ${manifestPath} "bin.pi" is not a string. Run \`npm ci\`.`);
  }

  const cliPath = path.resolve(path.dirname(manifestPath), pi);
  if (!existsSync(cliPath)) {
    throw new Error(`resolvePiRuntime: ${cliPath} does not exist. Run \`npm ci\`.`);
  }

  return { cliPath, version: raw.version };
}
