// platform/git-neutral-directory.ts
//
// SG-PRC-03: the neutral directory is where a git command without a working
// directory runs, and where the user's ssh starts. It is a private, empty
// directory, `<agentDir>/pi-claude-marketplace/git-neutral`, that only the
// current user may read or change. platform/git-process.ts sets
// GIT_CEILING_DIRECTORIES to its parent, so git looks for a repository in this
// directory only, and finds none there. The shared temporary directory cannot
// serve: any user may plant a `.git` or a bare repository layout in it, and
// git would then read that repository's `credential.helper` and
// `core.sshCommand`.
//
// NFR-10: platform/git-process.ts keeps the directory inside the user scope's
// extension root. The directory is made on first use with one mkdir of mode
// 0700, which is atomic. mkdir keeps a path that exists, so the directory is
// checked before every use. It must be a real directory, not a symbolic link,
// and it must be empty. Where the platform has user ids (POSIX), the current
// user must own it, and no group or other permission bit may be set. A
// directory that fails a check is refused, never repaired, because its
// contents may not be the user's.

import { lstat, mkdir, readdir, realpath } from "node:fs/promises";
import path from "node:path";

const NEUTRAL_NAME = "git-neutral";
const PRIVATE_MODE = 0o700;
const GROUP_AND_OTHER_BITS = 0o077;

/**
 * Binds the neutral directory to `host`. The returned function makes the
 * directory when it does not exist, checks it, and resolves with its real
 * path. It rejects when the directory cannot be made or fails a check.
 */
export function createNeutralDirectory(host: {
  /** The directory that holds the neutral directory. */
  readonly parent: () => string;
  /** Returns the current user's id. Undefined where the platform has no user ids. */
  readonly uid: (() => number) | undefined;
}): () => Promise<string> {
  return async () => {
    const directory = path.join(host.parent(), NEUTRAL_NAME);
    // The parent keeps the default mode; only the neutral directory is private.
    await mkdir(host.parent(), { recursive: true });
    await mkdir(directory, { recursive: true, mode: PRIVATE_MODE });
    const stats = await lstat(directory);
    const uid = host.uid?.();
    const isPrivate =
      uid === undefined || (stats.uid === uid && (stats.mode & GROUP_AND_OTHER_BITS) === 0);
    if (!stats.isDirectory() || !isPrivate || (await readdir(directory)).length > 0) {
      throw new Error(`${directory} is not a private, empty directory`);
    }

    return realpath(directory);
  };
}
