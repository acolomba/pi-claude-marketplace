import {
  cp,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  symlink,
} from "node:fs/promises";
import path from "node:path";

import writeFileAtomic from "write-file-atomic";

import { assertSafeName } from "../../domain/name.ts";
import { loadAgentsIndex } from "../../persistence/agents-index-io.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { pathExists } from "../../shared/fs-utils.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import type { IndexedRecord } from "./dependency-index.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { Stats } from "node:fs";

interface SavedPath {
  readonly target: string;
  readonly root: string;
  readonly backup?: string;
  readonly phase: string;
}

/** One restore failure, kept structured for the failed notification row. */
export interface PruneRestoreFailure {
  readonly phase: string;
  readonly cause: Error;
}

/** Filesystem operations faultable at the restore seam. */
export interface PruneRestoreOps {
  readonly link?: typeof link;
  readonly removeBackup: typeof rm;
  readonly afterMetadataRead?: (target: string) => Promise<void>;
  readonly inspectBackup?: (target: string) => Promise<Stats>;
}

/** Snapshot held until state persistence succeeds or every restore completes. */
export interface PruneRollback {
  readonly backupName: string;
  readonly rollback: () => Promise<readonly PruneRestoreFailure[]>;
  readonly discard: () => Promise<void>;
}

function recoveryEntry(
  locations: ScopedLocations,
  saved: SavedPath,
): {
  readonly phase: string;
  readonly root: string;
  readonly target: string;
  readonly backup: string | null;
} {
  const root = path.relative(locations.scopeRoot, saved.root) || ".";
  const target = path.relative(saved.root, saved.target);
  // ScopedLocations provides roots within scopeRoot; snapshotPath already
  // checked each target against its root before this mapping is written.

  return {
    phase: saved.phase,
    root,
    target,
    backup: saved.backup === undefined ? null : path.basename(saved.backup),
  };
}

async function snapshotPath(
  root: string,
  target: string,
  phase: string,
  backupRoot: string,
  index: number,
): Promise<SavedPath> {
  await assertPathInside(root, target, `prune ${phase} snapshot`);
  if (!(await pathExists(target))) {
    return { target, root, phase };
  }

  const stat = await lstat(target);
  const backup = path.join(backupRoot, String(index));
  await cp(target, backup, {
    recursive: stat.isDirectory(),
    dereference: false,
    verbatimSymlinks: true,
  });
  return { target, root, phase, backup };
}

async function sameEntry(left: string, right: string): Promise<boolean> {
  const [leftStat, rightStat] = await Promise.all([lstat(left), lstat(right)]);
  if (leftStat.isFile() && rightStat.isFile()) {
    const [leftBytes, rightBytes] = await Promise.all([readFile(left), readFile(right)]);
    return leftBytes.equals(rightBytes) && leftStat.mode === rightStat.mode;
  }

  if (leftStat.isSymbolicLink() && rightStat.isSymbolicLink()) {
    return (await readlink(left)) === (await readlink(right));
  }

  if (!leftStat.isDirectory() || !rightStat.isDirectory()) {
    return false;
  }

  const [leftNames, rightNames] = await Promise.all([readdir(left), readdir(right)]);
  leftNames.sort((leftName, rightName) => leftName.localeCompare(rightName));
  rightNames.sort((leftName, rightName) => leftName.localeCompare(rightName));
  if (leftNames.length !== rightNames.length) {
    return false;
  }

  for (const [index, name] of leftNames.entries()) {
    if (
      name !== rightNames[index] ||
      !(await sameEntry(path.join(left, name), path.join(right, name)))
    ) {
      return false;
    }
  }

  return leftStat.mode === rightStat.mode;
}

async function publishBackupEntry(
  backup: string,
  target: string,
  ops: PruneRestoreOps,
): Promise<void> {
  const entry = await (ops.inspectBackup ?? lstat)(backup);
  if (entry.isFile()) {
    await (ops.link ?? link)(backup, target);
    return;
  }

  if (entry.isSymbolicLink()) {
    await symlink(await readlink(backup), target);
    return;
  }

  if (!entry.isDirectory()) {
    throw new Error(`Prune rollback cannot publish unsupported artifact at ${target}.`);
  }

  await mkdir(target, { mode: entry.mode & 0o777 });
  for (const name of await readdir(backup)) {
    await publishBackupEntry(path.join(backup, name), path.join(target, name), ops);
  }
}

async function restoreArtifact(saved: SavedPath, ops: PruneRestoreOps): Promise<void> {
  if (saved.backup === undefined) {
    return;
  }

  await assertPathInside(saved.root, saved.target, `prune ${saved.phase} restore`);
  if (await pathExists(saved.target)) {
    if (await sameEntry(saved.target, saved.backup)) {
      return;
    }

    throw new Error(`Prune rollback found an occupied artifact at ${saved.target}.`);
  }

  await mkdir(path.dirname(saved.target), { recursive: true });
  try {
    await publishBackupEntry(saved.backup, saved.target, ops);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`Prune rollback found an occupied artifact at ${saved.target}.`, {
        cause: error,
      });
    }

    throw error;
  }
}

async function metadataMatchesBackup(saved: SavedPath): Promise<boolean> {
  await assertPathInside(saved.root, saved.target, `prune ${saved.phase} restore`);
  if (saved.backup === undefined) {
    return !(await pathExists(saved.target));
  }

  if (!(await pathExists(saved.target))) {
    return false;
  }

  const stat = await lstat(saved.target);
  if (!stat.isFile()) {
    throw new Error(`Prune rollback found an occupied metadata path at ${saved.target}.`);
  }

  const backupStat = await lstat(saved.backup);
  if (!backupStat.isFile()) {
    throw new Error(`Prune rollback found an occupied metadata backup at ${saved.backup}.`);
  }

  return (
    stat.mode === backupStat.mode &&
    (await readFile(saved.target)).equals(await readFile(saved.backup))
  );
}

async function restoreMetadata(saved: SavedPath, ops: PruneRestoreOps): Promise<void> {
  const matchesBackup = await metadataMatchesBackup(saved);
  await ops.afterMetadataRead?.(saved.target);
  if (matchesBackup) {
    return;
  }

  // Other writers do not share the state lock. The original remains in the
  // recovery manifest for a manual merge without replacing independent edits.
  throw new Error(`Prune rollback found an occupied metadata path at ${saved.target}.`);
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(errorMessage(error));
}

function bridgeCanMutateNamedPath(name: string, label: string): boolean {
  try {
    assertSafeName(name, label);
    return true;
  } catch {
    // The unstage bridge rejects this name before touching its path.
    return false;
  }
}

async function artifactTargets(
  locations: ScopedLocations,
  members: readonly IndexedRecord[],
): Promise<readonly SavedPath[]> {
  const targets = new Map<string, SavedPath>();
  const ownerKeys = new Set(members.map((member) => `${member.plugin}@${member.marketplace.name}`));
  const add = (root: string, target: string, phase: string): void => {
    targets.set(target, { root, target, phase });
  };

  const addNamed = (
    root: string,
    name: string,
    suffix: string,
    phase: string,
    label: string,
  ): void => {
    if (bridgeCanMutateNamedPath(name, label)) {
      add(root, path.join(root, `${name}${suffix}`), phase);
    }
  };

  for (const member of members) {
    for (const skill of member.record.resources.skills) {
      addNamed(locations.skillsTargetDir, skill, "", "skills", "skill to prune");
    }

    for (const command of member.record.resources.prompts) {
      addNamed(locations.promptsTargetDir, command, ".md", "commands", "command to prune");
    }

    addNamed(locations.hooksDir, member.plugin, "", "hooks", "plugin to prune");
  }

  const agentsIndex = await loadAgentsIndex(locations);
  for (const agent of agentsIndex.agents) {
    if (ownerKeys.has(`${agent.plugin}@${agent.marketplace}`)) {
      add(locations.agentsDir, agent.targetPath, "agents");
    }
  }

  return [...targets.values()];
}

/** Captures only paths the selected members' unstage bridges may change. */
export async function preparePruneRollback(
  locations: ScopedLocations,
  members: readonly IndexedRecord[],
  ops: PruneRestoreOps,
): Promise<PruneRollback> {
  const targets = await artifactTargets(locations, members);
  const backupRoot = await mkdtemp(path.join(locations.extensionRoot, "prune-backup-"));
  const artifacts: SavedPath[] = [];
  let agentsIndex: SavedPath;
  let mcp: SavedPath;
  let state: SavedPath;
  try {
    for (const [index, { root, target, phase }] of targets.entries()) {
      artifacts.push(await snapshotPath(root, target, phase, backupRoot, index));
    }

    agentsIndex = await snapshotPath(
      locations.extensionRoot,
      locations.agentsIndexPath,
      "agents index",
      backupRoot,
      targets.length,
    );
    mcp = await snapshotPath(
      locations.scopeRoot,
      locations.mcpJsonPath,
      "mcp",
      backupRoot,
      targets.length + 1,
    );
    state = await snapshotPath(
      locations.extensionRoot,
      locations.stateJsonPath,
      "state",
      backupRoot,
      targets.length + 2,
    );
    const entries = [...artifacts, agentsIndex, mcp, state].map((saved) =>
      recoveryEntry(locations, saved),
    );
    await writeFileAtomic(
      path.join(backupRoot, "manifest.json"),
      `${JSON.stringify({ schemaVersion: 1, entries }, null, 2)}\n`,
    );
  } catch (error: unknown) {
    await ops.removeBackup(backupRoot, { recursive: true, force: true });
    throw error;
  }

  return {
    backupName: path.basename(backupRoot),
    rollback: async (): Promise<readonly PruneRestoreFailure[]> => {
      const failures: PruneRestoreFailure[] = [];
      for (const saved of artifacts) {
        try {
          await restoreArtifact(saved, ops);
        } catch (error: unknown) {
          failures.push({ phase: saved.phase, cause: asError(error) });
        }
      }

      for (const saved of [agentsIndex, mcp]) {
        try {
          await restoreMetadata(saved, ops);
        } catch (error: unknown) {
          failures.push({ phase: saved.phase, cause: asError(error) });
        }
      }

      try {
        await assertPathInside(state.root, state.target, "prune state restore");
        if (state.backup === undefined) {
          await rm(state.target, { force: true });
        } else {
          await writeFileAtomic(state.target, await readFile(state.backup));
        }
      } catch (error: unknown) {
        failures.push({ phase: state.phase, cause: asError(error) });
      }

      if (failures.length === 0) {
        try {
          await ops.removeBackup(backupRoot, { recursive: true, force: true });
        } catch (error: unknown) {
          failures.push({ phase: "backup cleanup", cause: asError(error) });
        }
      }

      return failures;
    },
    discard: async (): Promise<void> => {
      try {
        await ops.removeBackup(backupRoot, { recursive: true, force: true });
      } catch (error: unknown) {
        // Persistence has already committed; a backup cleanup leak is diagnostic only.
        hookDebugLog(`prune: backup cleanup failed: ${errorMessage(error)}`);
      }
    },
  };
}
