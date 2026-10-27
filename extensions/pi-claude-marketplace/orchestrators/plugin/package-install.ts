// orchestrators/plugin/package-install.ts
//
// PKD-01 / PKD-02: installs a plugin's own npm or bun packages the way Claude
// Code does: frozen, with no lifecycle scripts, and bounded in time. One
// closed table maps each lockfile to its command, and the first lockfile
// present wins, so the order is data rather than branches (D-PL9-01).
//
// D-PL9-02: the install runs only when the plugin root holds package.json, a
// lockfile from the table, and a package.json that lists something under
// dependencies, optionalDependencies, peerDependencies, or workspaces.
// D-PL9-06: a plugin root that already holds node_modules is left alone.
//
// NFR-10 / D-PL9-03: the install writes only inside the extension root. A
// plugin that runs from the user's own folder (a path-source marketplace) is
// never written to.
//
// D-PL9-04: the package manager runs in a fresh work dir under sources-staging
// that holds only package.json and the lockfile, so the plugin's own .npmrc or
// bunfig.toml is never read. On success its node_modules moves into the plugin
// root by rename: sources-staging and both clone roots sit under the extension
// root, on one filesystem. The work dir is removed afterwards.
//
// D-PL9-14 / D-19-01: every note goes to discoveryWarnings, because
// bridgeWarnings never reaches a standalone user. A failed package install is
// a note and never a throw, so the plugin stays installed (PKD-02).
//
// D-PL9-08: Claude Code's lockfile-content sanitizer is not ported;
// --ignore-scripts and the bare work dir carry the protection.
//
// D-PL9-10: this is the only module that imports platform/package-manager.ts.

import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createPackageManagerRunner,
  NODE_PACKAGE_MANAGER_SPAWN,
} from "../../platform/package-manager.ts";
import { errorMessage, isErrnoException } from "../../shared/errors.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import type { ScopedLocations } from "../../persistence/locations.ts";
import type { PackageManagerRun, PackageManagerRunner } from "../../platform/package-manager.ts";
import type { Phase } from "../../transaction/phase-ledger.ts";

const NPM_CI_ARGUMENTS = [
  "ci",
  "--ignore-scripts",
  "--workspaces=false",
  "--no-audit",
  "--no-fund",
] as const;
const BUN_INSTALL_ARGUMENTS = ["install", "--frozen-lockfile", "--ignore-scripts"] as const;

interface RunnableLockfile {
  readonly lockfile: string;
  readonly command: "bun" | "npm";
  readonly args: readonly string[];
  /** The variable that points the package manager's cache into the work dir. */
  readonly cacheDirVariable?: string;
}

// D-PL9-01: Claude Code's table, in its priority order.
const LOCKFILE_TABLE = [
  {
    lockfile: "bun.lock",
    command: "bun",
    args: BUN_INSTALL_ARGUMENTS,
    cacheDirVariable: "BUN_INSTALL_CACHE_DIR",
  },
  { lockfile: "npm-shrinkwrap.json", command: "npm", args: NPM_CI_ARGUMENTS },
  { lockfile: "package-lock.json", command: "npm", args: NPM_CI_ARGUMENTS },
] as const satisfies readonly RunnableLockfile[];

const LISTING_FIELDS = [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
  "workspaces",
] as const;

const PACKAGE_INSTALL_TIMEOUT_MS = 60_000;
const PACKAGE_INSTALL_KILL_GRACE_MS = 5_000;
const NOTE_LIMIT = 500;
const SKIPPED_PREFIX = "Skipped installing this plugin's dependencies: ";

/** The ports the package step drives, declared by this consumer (D-PL9-12). */
export interface PackageInstallOps {
  readonly runPackageManager: PackageManagerRunner;
  readonly newWorkDirName: () => string;
}

/**
 * The production binding: the real launcher, the 60-second timeout, a
 * 5-second kill grace, the process environment, and a random work dir name.
 */
export const DEFAULT_PACKAGE_INSTALL_OPS: PackageInstallOps = Object.freeze({
  runPackageManager: createPackageManagerRunner({
    spawn: NODE_PACKAGE_MANAGER_SPAWN,
    timeoutMs: PACKAGE_INSTALL_TIMEOUT_MS,
    killGraceMs: PACKAGE_INSTALL_KILL_GRACE_MS,
    env: process.env,
  }),
  newWorkDirName: randomUUID,
});

/** The slice of the install ledger context the packages phase reads. */
export interface PackagesPhaseContext {
  readonly locations: ScopedLocations;
  readonly resolved: { readonly pluginRoot: string };
  readonly discoveryWarnings: string[];
}

interface PackageStepOutcome {
  readonly note?: string;
  readonly createdNodeModules: boolean;
}

interface PackageInstallInputs {
  readonly pluginRoot: string;
  readonly row: RunnableLockfile;
  readonly packageJson: Buffer;
  readonly lockfile: Buffer;
}

const NOTHING_DONE: PackageStepOutcome = { createdNodeModules: false };

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function listsSomething(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return isPlainObject(value) && Object.keys(value).length > 0;
}

function listsPackages(manifest: unknown): boolean {
  return isPlainObject(manifest) && LISTING_FIELDS.some((field) => listsSomething(manifest[field]));
}

async function readEntryNames(pluginRoot: string): Promise<ReadonlySet<string> | undefined> {
  try {
    return new Set(await readdir(pluginRoot));
  } catch (error: unknown) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

// Any rejection means the root is not ours to write: it lies outside the
// extension root, or a segment on the way is a symlink. The note for a root
// outside the extension root is a separate decision (D-PL9-03).
async function isInsideExtensionRoot(extensionRoot: string, pluginRoot: string): Promise<boolean> {
  return assertPathInside(extensionRoot, pluginRoot, "plugin package install").then(
    () => true,
    () => false,
  );
}

async function detectInstall(
  pluginRoot: string,
  locations: ScopedLocations,
): Promise<PackageInstallInputs | undefined> {
  const entries = await readEntryNames(pluginRoot);
  if (entries === undefined || !entries.has("package.json") || entries.has("node_modules")) {
    return undefined;
  }

  const row = LOCKFILE_TABLE.find((candidate) => entries.has(candidate.lockfile));
  if (row === undefined) {
    return undefined;
  }

  const packageJson = await readFile(path.join(pluginRoot, "package.json"));
  if (!listsPackages(JSON.parse(packageJson.toString("utf8")))) {
    return undefined;
  }

  if (!(await isInsideExtensionRoot(locations.extensionRoot, pluginRoot))) {
    return undefined;
  }

  const lockfile = await readFile(path.join(pluginRoot, row.lockfile));
  return { pluginRoot, row, packageJson, lockfile };
}

function failedNote(command: string, detail: string): string {
  return `Plugin dependency install failed (${command}): ${detail}`.slice(0, NOTE_LIMIT);
}

function runFailed(run: PackageManagerRun): boolean {
  return run.code !== 0 || run.timedOut || run.error !== undefined;
}

function failureDetail(run: PackageManagerRun): string {
  if (run.timedOut) {
    return `timed out after ${PACKAGE_INSTALL_TIMEOUT_MS / 1_000} seconds`;
  }

  const detail = run.stderr.trim() || run.stdout.trim() || run.error?.message;
  return detail === undefined || detail === "" ? "no output" : detail;
}

async function moveNodeModules(workDir: string, pluginRoot: string): Promise<PackageStepOutcome> {
  try {
    await rename(path.join(workDir, "node_modules"), path.join(pluginRoot, "node_modules"));
  } catch (error: unknown) {
    // A package set that installs nothing leaves no node_modules to move.
    if (isErrnoException(error) && error.code === "ENOENT") {
      return NOTHING_DONE;
    }

    throw error;
  }

  return { createdNodeModules: true };
}

async function installInWorkDir(
  workDir: string,
  inputs: PackageInstallInputs,
  ops: PackageInstallOps,
): Promise<PackageStepOutcome> {
  const { row } = inputs;
  await mkdir(workDir, { recursive: true });
  await writeFile(path.join(workDir, "package.json"), inputs.packageJson, { flag: "wx" });
  await writeFile(path.join(workDir, row.lockfile), inputs.lockfile, { flag: "wx" });
  const run = await ops.runPackageManager({
    command: row.command,
    args: row.args,
    cwd: workDir,
    ...(row.cacheDirVariable !== undefined && {
      env: { [row.cacheDirVariable]: path.join(workDir, "bun-cache") },
    }),
  });
  if (runFailed(run)) {
    return { note: failedNote(row.command, failureDetail(run)), createdNodeModules: false };
  }

  return moveNodeModules(workDir, inputs.pluginRoot);
}

async function runInstallStage(
  inputs: PackageInstallInputs,
  locations: ScopedLocations,
  ops: PackageInstallOps,
): Promise<PackageStepOutcome> {
  try {
    const workDir = await locations.sourcesStagingDir(ops.newWorkDirName());
    try {
      return await installInWorkDir(workDir, inputs, ops);
    } finally {
      // Claude Code ignores a failed removal too: a leftover work dir costs
      // disk only, and the install itself has already succeeded or failed.
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  } catch (error: unknown) {
    return { note: failedNote(inputs.row.command, errorMessage(error)), createdNodeModules: false };
  }
}

async function installPluginPackages(
  pluginRoot: string,
  locations: ScopedLocations,
  ops: PackageInstallOps,
): Promise<PackageStepOutcome> {
  let inputs: PackageInstallInputs | undefined;
  try {
    inputs = await detectInstall(pluginRoot, locations);
  } catch (error: unknown) {
    return {
      note: `${SKIPPED_PREFIX}${errorMessage(error)}.`.slice(0, NOTE_LIMIT),
      createdNodeModules: false,
    };
  }

  return inputs === undefined ? NOTHING_DONE : runInstallStage(inputs, locations, ops);
}

/**
 * D-PL9-05: a fresh packages phase for one ledger run. Its closure remembers
 * whether `do` created node_modules, so `undo` removes only what `do` made.
 * `undo` uses a plain `rm` and no containment check, because a
 * PathContainmentError thrown by an undo escapes the ledger.
 */
export function createPackagesPhase(ops: PackageInstallOps): Phase<PackagesPhaseContext> {
  let createdNodeModules = false;
  return {
    name: "packages",
    do: async (c) => {
      const outcome = await installPluginPackages(c.resolved.pluginRoot, c.locations, ops);
      createdNodeModules = outcome.createdNodeModules;
      if (outcome.note !== undefined) {
        c.discoveryWarnings.push(outcome.note);
      }
    },
    undo: async (c) => {
      if (createdNodeModules) {
        await rm(path.join(c.resolved.pluginRoot, "node_modules"), {
          recursive: true,
          force: true,
        });
      }
    },
  };
}
