// tests/platform/removal-ops-fake.ts
//
// Two doubles for the `RemovalOps` removal port, one per question a case asks.
//
// `createRemovalOpsFake` is the in-memory model: it records every call in
// order and simulates the outcome against its own entry map; it performs NO
// real filesystem work and imports no filesystem module. That is a security
// property rather than a style preference: a double that really removed things
// could reach outside the fixture the case owns.
//
// `createDelegatingRemovalOps` is the recording decorator: it answers the
// seeded faults itself and forwards every other call to a collaborator the
// case supplies. A case needs it when the partition between what leaked and
// what did not must be read from the real filesystem -- the in-memory model
// removes nothing, so a sibling target it was asked to remove is still on
// disk, and "this one leaked, that one did not" cannot be stated about disk
// state through it. The decorator imports no filesystem module either; the
// real collaborator arrives as a parameter.
//
// Fault injection is keyed per target path, which is the seam the removal port
// exists for -- it is how "one cleanup fails while its siblings succeed"
// becomes expressible without patching a builtin module.
//
// Two fidelity limits, recorded so a case does not read the fake as total:
//
//   - It models PATHS, not inodes. A directory is an entry seeded through
//     `directories`; a file is an entry seeded through `files`. Containment is
//     decided by the `/` separator, so every seeded path must be absolute and
//     `/`-separated (the tree's own fakes use synthetic `/memory/...` roots).
//   - It simulates only the errno outcomes its contract pins: ENOENT for an
//     unforced removal or a rename of an absent source, and ERR_FS_EISDIR for
//     a non-recursive removal of a directory. Permission, quota, and
//     cross-device failures arrive through the per-target fault map instead.

import type { RemovalOps } from "../../extensions/pi-claude-marketplace/shared/fs-utils.ts";

export interface RemovalOpsFakeOptions {
  readonly boundary: "memory";
  /** Absolute file paths the fake considers present, with their contents. */
  readonly files?: ReadonlyArray<readonly [path: string, contents: string]>;
  /** Absolute directory paths the fake considers present. */
  readonly directories?: readonly string[];
  /** Errors `rm` rejects with, keyed by the absolute target path. */
  readonly rmErrors?: ReadonlyArray<readonly [target: string, error: Error]>;
  /** Errors `rename` rejects with, keyed by the absolute source path. */
  readonly renameErrors?: ReadonlyArray<readonly [from: string, error: Error]>;
}

export interface RemovalOpsFakeCalls {
  readonly rm: Array<{
    readonly target: string;
    readonly options: { readonly recursive?: boolean; readonly force?: boolean };
  }>;
  readonly rename: Array<{ readonly from: string; readonly to: string }>;
}

export interface RemovalOpsFake {
  readonly removalOps: RemovalOps;
  /** Every call the port received, in the order it received them. */
  readonly calls: RemovalOpsFakeCalls;
  /** Whether the fake still considers `target` present; `false` once removed. */
  present(target: string): boolean;
  /** The contents of a present file, or `null` for a directory or an absent path. */
  readFile(target: string): string | null;
}

/** A directory entry carries no contents; a file entry carries its bytes. */
type FakeEntry = string | null;

function errnoError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

function byPath<T>(pairs: ReadonlyArray<readonly [string, T]> | undefined): Map<string, T> {
  return new Map(pairs ?? []);
}

export function createRemovalOpsFake(options: RemovalOpsFakeOptions): RemovalOpsFake {
  if (options.boundary !== "memory") {
    throw new Error("createRemovalOpsFake requires the explicit memory boundary");
  }

  const entries = new Map<string, FakeEntry>(options.files ?? []);
  for (const directory of options.directories ?? []) {
    entries.set(directory, null);
  }

  const rmErrors = byPath(options.rmErrors);
  const renameErrors = byPath(options.renameErrors);
  const calls: RemovalOpsFakeCalls = { rm: [], rename: [] };

  const descendantsOf = (target: string): string[] =>
    [...entries.keys()].filter((candidate) => candidate.startsWith(`${target}/`));

  const removalOps: RemovalOps = {
    async rm(target, rmOptions) {
      calls.rm.push({ target, options: { ...rmOptions } });
      const failure = rmErrors.get(target);
      if (failure !== undefined) {
        throw failure;
      }

      await Promise.resolve();
      const descendants = descendantsOf(target);
      if (!entries.has(target) && descendants.length === 0) {
        if (rmOptions.force === true) {
          return;
        }

        throw errnoError("ENOENT", `ENOENT: no such file or directory, lstat '${target}'`);
      }

      if (
        (entries.get(target) === null || descendants.length > 0) &&
        rmOptions.recursive !== true
      ) {
        throw errnoError(
          "ERR_FS_EISDIR",
          `Path is a directory: rm returned EISDIR (is a directory) ${target}`,
        );
      }

      entries.delete(target);
      for (const descendant of descendants) {
        entries.delete(descendant);
      }
    },
    async rename(from, to) {
      calls.rename.push({ from, to });
      const failure = renameErrors.get(from);
      if (failure !== undefined) {
        throw failure;
      }

      await Promise.resolve();
      if (!entries.has(from)) {
        throw errnoError(
          "ENOENT",
          `ENOENT: no such file or directory, rename '${from}' -> '${to}'`,
        );
      }

      const moved: Array<readonly [string, FakeEntry]> = [
        [to, entries.get(from) ?? null],
        ...descendantsOf(from).map(
          (descendant) =>
            [`${to}${descendant.slice(from.length)}`, entries.get(descendant) ?? null] as const,
        ),
      ];

      for (const descendant of descendantsOf(from)) {
        entries.delete(descendant);
      }

      entries.delete(from);
      for (const [movedPath, movedEntry] of moved) {
        entries.set(movedPath, movedEntry);
      }
    },
  };

  return {
    removalOps,
    calls,
    present: (target) => entries.has(target),
    readFile: (target) => entries.get(target) ?? null,
  };
}

export interface DelegatingRemovalOpsOptions {
  /**
   * Explicit acknowledgement that this double reaches the boundary its
   * `delegate` owns, unlike the `"memory"` fake above.
   */
  readonly boundary: "delegate";
  /** The collaborator every unfaulted call is forwarded to. */
  readonly delegate: RemovalOps;
  /** Errors `rm` rejects with, keyed by the absolute target path. */
  readonly rmErrors?: ReadonlyArray<readonly [target: string, error: Error]>;
  /** Errors `rename` rejects with, keyed by the absolute source path. */
  readonly renameErrors?: ReadonlyArray<readonly [from: string, error: Error]>;
  /**
   * Errors `rename` rejects with, keyed by the absolute DESTINATION path. The
   * backup-restore stage of a replacement rollback moves a backup whose path
   * was minted inside the forward pass's own unported rename, so a case that
   * faults the restore cannot key on a source it has not seen yet. It always
   * knows the destination: the target the backup is restored to.
   */
  readonly renameDestinationErrors?: ReadonlyArray<readonly [to: string, error: Error]>;
}

/** One recorded call, in a shape that keeps `rm` and `rename` comparable. */
export type RemovalOpsOperation =
  | {
      readonly verb: "rm";
      readonly target: string;
      readonly options: { readonly recursive?: boolean; readonly force?: boolean };
    }
  | { readonly verb: "rename"; readonly from: string; readonly to: string };

export interface DelegatingRemovalOps {
  readonly removalOps: RemovalOps;
  /**
   * Every call in the order it was received, both verbs in one list. The
   * interleaving across verbs is itself a contract some cases pin, which the
   * in-memory fake's per-verb `calls` cannot express.
   */
  readonly operations: RemovalOpsOperation[];
}

export function createDelegatingRemovalOps(
  options: DelegatingRemovalOpsOptions,
): DelegatingRemovalOps {
  if (options.boundary !== "delegate") {
    throw new Error("createDelegatingRemovalOps requires the explicit delegate boundary");
  }

  const rmErrors = byPath(options.rmErrors);
  const renameErrors = byPath(options.renameErrors);
  const renameDestinationErrors = byPath(options.renameDestinationErrors);
  const operations: RemovalOpsOperation[] = [];

  return {
    operations,
    removalOps: {
      async rm(target, rmOptions) {
        operations.push({ verb: "rm", target, options: { ...rmOptions } });
        const failure = rmErrors.get(target);
        if (failure !== undefined) {
          throw failure;
        }

        await options.delegate.rm(target, rmOptions);
      },
      async rename(from, to) {
        operations.push({ verb: "rename", from, to });
        const failure = renameErrors.get(from) ?? renameDestinationErrors.get(to);
        if (failure !== undefined) {
          throw failure;
        }

        await options.delegate.rename(from, to);
      },
    },
  };
}
