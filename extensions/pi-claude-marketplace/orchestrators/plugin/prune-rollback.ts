import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rename,
  rm,
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

interface SavedPath {
  readonly target: string;
  readonly root: string;
  readonly backup?: string;
  readonly phase: string;
}

type MetadataVersion =
  | { readonly kind: "absent" }
  | { readonly kind: "file"; readonly bytes: Buffer; readonly mode: number };

/** One restore failure, kept structured for the failed notification row. */
export interface PruneRestoreFailure {
  readonly phase: string;
  readonly cause: Error;
}

/** The one filesystem operation faultable at the artifact restore seam. */
export interface PruneRestoreOps {
  readonly rename: typeof rename;
  readonly removeBackup: typeof rm;
}

/** Snapshot held until state persistence succeeds or every restore completes. */
export interface PruneRollback {
  readonly backupName: string;
  readonly markUnstaged: () => Promise<void>;
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
  await ops.rename(saved.backup, saved.target);
}

async function metadataVersion(saved: SavedPath): Promise<MetadataVersion> {
  await assertPathInside(saved.root, saved.target, `prune ${saved.phase} restore`);
  if (!(await pathExists(saved.target))) {
    return { kind: "absent" };
  }

  const stat = await lstat(saved.target);
  if (!stat.isFile()) {
    throw new Error(`Prune rollback found an occupied metadata path at ${saved.target}.`);
  }

  return { kind: "file", bytes: await readFile(saved.target), mode: stat.mode };
}

function sameMetadataVersion(left: MetadataVersion, right: MetadataVersion): boolean {
  if (left.kind === "absent" || right.kind === "absent") {
    return left.kind === right.kind;
  }

  return left.bytes.equals(right.bytes) && left.mode === right.mode;
}

async function restoreMetadata(saved: SavedPath, expected?: MetadataVersion): Promise<void> {
  const current = await metadataVersion(saved);
  const original =
    saved.backup === undefined
      ? ({ kind: "absent" } as const)
      : await metadataVersion({ ...saved, target: saved.backup, root: path.dirname(saved.backup) });
  if (expected === undefined && sameMetadataVersion(current, original)) {
    return;
  }

  if (expected === undefined || !sameMetadataVersion(current, expected)) {
    throw new Error(`Prune rollback found an occupied metadata path at ${saved.target}.`);
  }

  if (saved.backup === undefined) {
    if (await pathExists(saved.target)) {
      await rm(saved.target);
    }

    return;
  }

  await writeFileAtomic(saved.target, await readFile(saved.backup));
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
  let unstagedMetadata: readonly [MetadataVersion, MetadataVersion] | undefined;
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
    markUnstaged: async (): Promise<void> => {
      unstagedMetadata = await Promise.all([metadataVersion(agentsIndex), metadataVersion(mcp)]);
    },
    rollback: async (): Promise<readonly PruneRestoreFailure[]> => {
      const failures: PruneRestoreFailure[] = [];
      for (const saved of artifacts) {
        try {
          await restoreArtifact(saved, ops);
        } catch (error: unknown) {
          failures.push({ phase: saved.phase, cause: asError(error) });
        }
      }

      for (const [index, saved] of [agentsIndex, mcp].entries()) {
        try {
          await restoreMetadata(saved, unstagedMetadata?.[index]);
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
