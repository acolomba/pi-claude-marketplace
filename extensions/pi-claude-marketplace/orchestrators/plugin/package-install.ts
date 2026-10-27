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
// D-PL9-06: the install ledger leaves alone a plugin root that already holds
// node_modules. After an update that moves to a new revision, the step runs
// over it, because the new revision may carry a new lockfile (D-PL9-07).
//
// NFR-10 / D-PL9-03: the install writes only inside the extension root. A
// plugin that runs from the user's own folder (a path-source marketplace) is
// never written to: when that folder has no node_modules, a note names the
// plugin's marketplace and the command to run in the plugin's folder. It names
// no absolute path, which every surface would redact to a basename.
//
// D-PL9-04: the package manager runs in a fresh work dir under sources-staging
// that holds only package.json and the lockfile, so the plugin's own .npmrc or
// bunfig.toml is never read. On success its node_modules moves into the plugin
// root by rename: sources-staging and both clone roots sit under the extension
// root, on one filesystem. A node_modules it replaces waits inside the work
// dir, is moved back when the new one cannot move in, and is deleted with the
// work dir after a success. The work dir is removed afterwards.
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
import { lstat, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";

import {
  createPackageManagerRunner,
  NODE_PACKAGE_MANAGER_SPAWN,
} from "../../platform/package-manager.ts";
import { errorMessage, isErrnoException } from "../../shared/errors.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import type { UpdateRunOutcome } from "./update-swap.ts";
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

interface RefusedLockfile {
  readonly lockfile: string;
  readonly refusal: string;
}

// D-PL9-01: Claude Code's table, in its priority order. The first lockfile
// present wins, so a bun.lock or package-lock.json beside a bun.lockb runs.
const LOCKFILE_TABLE = [
  {
    lockfile: "bun.lock",
    command: "bun",
    args: BUN_INSTALL_ARGUMENTS,
    cacheDirVariable: "BUN_INSTALL_CACHE_DIR",
  },
  { lockfile: "npm-shrinkwrap.json", command: "npm", args: NPM_CI_ARGUMENTS },
  { lockfile: "package-lock.json", command: "npm", args: NPM_CI_ARGUMENTS },
  {
    lockfile: "bun.lockb",
    refusal:
      "its bun.lockb is a binary lockfile that cannot be checked; ship a text bun.lock instead",
  },
] as const satisfies readonly (RunnableLockfile | RefusedLockfile)[];

// Claude Code refuses these when no table lockfile is present.
const UNSUPPORTED_LOCKFILES = ["yarn.lock", "pnpm-lock.yaml"] as const;
const UNSUPPORTED_LOCKFILE_NOTE =
  "Skipped: yarn/pnpm lockfiles are not supported (resolution-time hooks bypass --ignore-scripts). Use bun or npm.";

const LISTING_FIELDS = [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
  "workspaces",
] as const;

const PACKAGE_INSTALL_TIMEOUT_MS = 60_000;
const PACKAGE_INSTALL_KILL_GRACE_MS = 5_000;
const NOTE_LIMIT = 500;
// Claude Code's 32 MB cap on package.json and on the lockfile.
const MAX_INPUT_FILE_BYTES = 33_554_432;
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
  readonly marketplace: string;
  readonly resolved: { readonly pluginRoot: string };
  readonly discoveryWarnings: string[];
}

/** The plugin one package step runs for. */
export interface PackageStepTarget {
  readonly locations: ScopedLocations;
  /** The marketplace that lists the plugin, which a D-PL9-03 note names. */
  readonly marketplace: string;
  readonly pluginRoot: string;
  /**
   * D-PL9-06: `true` replaces an existing node_modules. The update hook sets
   * it when the swap moved to another revision, which may carry another
   * lockfile; the install ledger and a swap that re-materialized the recorded
   * revision keep node_modules and stay offline.
   */
  readonly force: boolean;
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
  /** The plugin root held node_modules when the checks listed it. */
  readonly replacesNodeModules: boolean;
}

// What the checks before the run decided: run nothing quietly, run nothing
// and say why, or run the package manager on these inputs.
type Detection =
  | { readonly kind: "skip" }
  | { readonly kind: "note"; readonly note: string }
  | { readonly kind: "run"; readonly inputs: PackageInstallInputs };

type Checked<T> = { readonly value: T } | { readonly refusal: string };

const NOTHING_DONE: PackageStepOutcome = { createdNodeModules: false };
const SKIP: Detection = { kind: "skip" };

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function listsSomething(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return isPlainObject(value) && Object.keys(value).length > 0;
}

function listsPackages(manifest: Readonly<Record<string, unknown>>): boolean {
  return LISTING_FIELDS.some((field) => listsSomething(manifest[field]));
}

function skippedNote(reason: string): string {
  return `${SKIPPED_PREFIX}${reason}.`.slice(0, NOTE_LIMIT);
}

// lstat then read leaves a narrow window in which the file could be swapped;
// Claude Code closes it with open-and-fstat. The inputs here come from a clone
// this extension made or from the user's own folder.
async function readBoundedFile(pluginRoot: string, name: string): Promise<Checked<Buffer>> {
  const filePath = path.join(pluginRoot, name);
  const stats = await lstat(filePath);
  if (!stats.isFile()) {
    return { refusal: `its ${name} is not a regular file` };
  }

  if (stats.size > MAX_INPUT_FILE_BYTES) {
    return { refusal: `its ${name} is not a regular file of at most 32 MB` };
  }

  return { value: await readFile(filePath) };
}

// D-PL9-16: a package.json that does not parse is a note, never a throw.
function parseManifest(bytes: Buffer): Checked<Readonly<Record<string, unknown>>> {
  let manifest: unknown;
  try {
    manifest = JSON.parse(bytes.toString("utf8"));
  } catch {
    // JSON.parse throws only a SyntaxError, which this check reports as such.
    return { refusal: "its package.json is not valid JSON" };
  }

  return isPlainObject(manifest)
    ? { value: manifest }
    : { refusal: "its package.json is not a JSON object" };
}

// The first table row present, or why nothing runs: a refused row's reason,
// Claude Code's yarn/pnpm note, or a quiet skip.
function chooseLockfile(entries: ReadonlySet<string>): RunnableLockfile | Detection {
  const row = LOCKFILE_TABLE.find((candidate) => entries.has(candidate.lockfile));
  if (row === undefined) {
    return UNSUPPORTED_LOCKFILES.some((lockfile) => entries.has(lockfile))
      ? { kind: "note", note: UNSUPPORTED_LOCKFILE_NOTE }
      : SKIP;
  }

  return "refusal" in row ? { kind: "note", note: skippedNote(row.refusal) } : row;
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
// extension root, or a segment on the way is a symlink.
async function isInsideExtensionRoot(extensionRoot: string, pluginRoot: string): Promise<boolean> {
  return assertPathInside(extensionRoot, pluginRoot, "plugin package install").then(
    () => true,
    () => false,
  );
}

// D-PL9-03: a folder that already holds node_modules gets no note. Only a
// forced run reaches here with one.
function outsideRootDetection(
  marketplace: string,
  row: RunnableLockfile,
  hasNodeModules: boolean,
): Detection {
  if (hasNodeModules) {
    return SKIP;
  }

  return {
    kind: "note",
    note: skippedNote(
      `its folder in the marketplace "${marketplace}" is outside the folders this extension manages, so it was not changed. To install them, run "${row.command} ${row.args.join(" ")}" in that folder`,
    ),
  };
}

async function detectInstall(target: PackageStepTarget): Promise<Detection> {
  const { pluginRoot, locations } = target;
  const entries = await readEntryNames(pluginRoot);
  if (!entries?.has("package.json")) {
    return SKIP;
  }

  const hasNodeModules = entries.has("node_modules");
  if (hasNodeModules && !target.force) {
    return SKIP;
  }

  const row = chooseLockfile(entries);
  if ("kind" in row) {
    return row;
  }

  const packageJson = await readBoundedFile(pluginRoot, "package.json");
  if ("refusal" in packageJson) {
    return { kind: "note", note: skippedNote(packageJson.refusal) };
  }

  const manifest = parseManifest(packageJson.value);
  if ("refusal" in manifest) {
    return { kind: "note", note: skippedNote(manifest.refusal) };
  }

  if (!listsPackages(manifest.value)) {
    return SKIP;
  }

  if (!(await isInsideExtensionRoot(locations.extensionRoot, pluginRoot))) {
    return outsideRootDetection(target.marketplace, row, hasNodeModules);
  }

  const lockfile = await readBoundedFile(pluginRoot, row.lockfile);
  if ("refusal" in lockfile) {
    return { kind: "note", note: skippedNote(lockfile.refusal) };
  }

  return {
    kind: "run",
    inputs: {
      pluginRoot,
      row,
      packageJson: packageJson.value,
      lockfile: lockfile.value,
      replacesNodeModules: hasNodeModules,
    },
  };
}

function failedNote(command: string, detail: string): string {
  return `Plugin dependency install failed (${command}): ${detail}`.slice(0, NOTE_LIMIT);
}

function runFailed(run: PackageManagerRun): boolean {
  return run.code !== 0 || run.timedOut || run.error !== undefined;
}

const NPM_WARN_LINE = /^npm warn\b/i;
const NPM_ERROR_PREFIX = /^npm (?:ERR!|error) ?/;

// The output as one line for a note: escape sequences and control characters
// gone, npm's own prefixes dropped, and npm's warnings left out when anything
// else was printed, so the error is what the 500-character cut keeps.
function compactOutput(output: string): string {
  const lines = stripVTControlCharacters(output)
    .split(/[\r\n]+/)
    .map((line) => line.replaceAll(/\p{Cc}/gu, " ").trim())
    .filter((line) => line !== "");
  const errors = lines.filter((line) => !NPM_WARN_LINE.test(line));
  return (errors.length > 0 ? errors : lines)
    .map((line) => line.replace(NPM_ERROR_PREFIX, ""))
    .join("; ");
}

function failureDetail(run: PackageManagerRun): string {
  if (run.timedOut) {
    return `timed out after ${PACKAGE_INSTALL_TIMEOUT_MS / 1_000} seconds`;
  }

  const detail = compactOutput(run.stderr) || compactOutput(run.stdout) || run.error?.message;
  return detail === undefined || detail === "" ? "no output" : detail;
}

function ignoreFailure(): undefined {
  return undefined;
}

// D-PL9-04: a replaced node_modules waits in the work dir, never in the plugin
// root, where the content hash walk would read it.
async function moveNodeModules(
  workDir: string,
  inputs: PackageInstallInputs,
): Promise<PackageStepOutcome> {
  const liveModules = path.join(inputs.pluginRoot, "node_modules");
  const parkedModules = path.join(workDir, "previous-node_modules");
  if (inputs.replacesNodeModules) {
    await rename(liveModules, parkedModules);
  }

  try {
    await rename(path.join(workDir, "node_modules"), liveModules);
  } catch (error: unknown) {
    // A package set that installs nothing leaves no node_modules to move.
    if (isErrnoException(error) && error.code === "ENOENT") {
      if (inputs.replacesNodeModules) {
        await rename(parkedModules, liveModules);
      }

      return NOTHING_DONE;
    }

    if (inputs.replacesNodeModules) {
      // The failed move is the note the user sees; a restore that fails too
      // is not reported, and running update again repeats the install.
      await rename(parkedModules, liveModules).catch(ignoreFailure);
    }

    throw error;
  }

  return { createdNodeModules: !inputs.replacesNodeModules };
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

  return moveNodeModules(workDir, inputs);
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
      // A run settled at its deadline may leave the package manager writing
      // here; the removal then fails or races it, and the plugin root stays
      // untouched, because a timed-out run moves nothing.
      await rm(workDir, { recursive: true, force: true }).catch(ignoreFailure);
    }
  } catch (error: unknown) {
    return { note: failedNote(inputs.row.command, errorMessage(error)), createdNodeModules: false };
  }
}

async function installPluginPackages(
  target: PackageStepTarget,
  ops: PackageInstallOps,
): Promise<PackageStepOutcome> {
  let detection: Detection;
  try {
    detection = await detectInstall(target);
  } catch (error: unknown) {
    return { note: skippedNote(errorMessage(error)), createdNodeModules: false };
  }

  if (detection.kind === "skip") {
    return NOTHING_DONE;
  }

  return detection.kind === "note"
    ? { note: detection.note, createdNodeModules: false }
    : runInstallStage(detection.inputs, target.locations, ops);
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
      const outcome = await installPluginPackages(
        {
          locations: c.locations,
          marketplace: c.marketplace,
          pluginRoot: c.resolved.pluginRoot,
          force: false,
        },
        ops,
      );
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

/**
 * D-PL9-07: an update's new version gets the package install, and a failure
 * is a note on the `updated` outcome that never turns it into a failure
 * (PKD-02). Every other outcome passes through unread.
 */
export async function installUpdatedPackages(
  ops: PackageInstallOps,
  outcome: UpdateRunOutcome,
  target: PackageStepTarget,
): Promise<UpdateRunOutcome> {
  if (outcome.partition !== "updated") {
    return outcome;
  }

  const { note } = await installPluginPackages(target, ops);
  return note === undefined ? outcome : { ...outcome, notes: [...(outcome.notes ?? []), note] };
}
