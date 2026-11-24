// platform/git-one-shot-credential.ts
//
// D-SG-14: after a Device Flow sign-in, `platform/git.ts` runs the failed git
// request once more, and git must get the new token for that one run. The
// token must not go into an argv, a URL, an environment variable, or a log
// line, and git cannot call back into Node. So the token goes into a file that
// only the current user may read, and the retry carries two `-c` pairs: an
// empty `credential.helper`, which drops every helper configured before it,
// then a shell helper that answers git's `get` with that file and ignores
// `store` and `erase`. The file is removed when the retry settles.
//
// The file lives in a fresh directory made with `mkdtemp` (mode 0700) under
// the user scope's extension root, beside the neutral directory. The neutral
// directory itself cannot hold it: it must stay empty, and a git command
// started there while the file exists would fail its check (CR-01).
//
// Threat (accepted, T-03-16): a crash between the write and the removal leaves
// the 0600 file in its 0700 directory under the user's own agent directory.
// That is the trust of the user's own credential store, which the sign-in has
// already approved the token into.
//
// Windows: git runs a `!` helper through the `sh` of Git for Windows, and the
// path stays in single quotes. The manual Windows check covers it.

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { getAgentDir } from "./pi-api.ts";

const FILE_NAME = "credential";
const FILE_MODE = 0o600;

/** The directory under the user scope's extension root that holds each one-shot directory. */
function extensionRoot(): string {
  return path.join(getAgentDir(), "pi-claude-marketplace");
}

/** A `'` inside a single-quoted POSIX shell word: end the word, an escaped quote, reopen it. */
const QUOTED_QUOTE = String.raw`'\''`;

/** `value` as one POSIX shell word: single quotes, with each `'` written as `'\''`. */
function shellQuoted(value: string): string {
  return `'${value.replaceAll("'", QUOTED_QUOTE)}'`;
}

/**
 * The git credential lines of `credential`. A value with a line break or a NUL
 * would let one value pose as another attribute, so it is refused; the error
 * names no value (AUTH-09).
 */
function credentialLines(credential: {
  readonly username?: string | undefined;
  readonly password?: string | undefined;
}): string {
  const attributes = [
    ["username", credential.username],
    ["password", credential.password],
  ].filter((attribute): attribute is [string, string] => attribute[1] !== undefined);
  if (attributes.some(([, value]) => /[\r\n\0]/.test(value))) {
    throw new Error("a one-shot credential value holds a line break or a NUL");
  }

  return attributes.map(([name, value]) => `${name}=${value}\n`).join("");
}

/**
 * Writes `credential`, the one a git run gets, with an absent value left out,
 * to a 0600 file in a fresh 0700 directory under
 * `parent()`, runs `run` with the two `-c` pairs that make git read it, and
 * removes the directory once `run` settles, whether it resolved or rejected.
 * `parent` defaults to the user scope's extension root, read on every call.
 */
export async function withOneShotCredential<T>(
  credential: { readonly username?: string | undefined; readonly password?: string | undefined },
  run: (config: readonly string[]) => Promise<T>,
  parent: () => string = extensionRoot,
): Promise<T> {
  const lines = credentialLines(credential);
  const root = parent();
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(path.join(root, "git-credential-"));
  try {
    const file = path.join(directory, FILE_NAME);
    await writeFile(file, lines, { mode: FILE_MODE, flag: "wx" });
    return await run([
      "credential.helper=",
      `credential.helper=!f() { test "$1" = get && cat ${shellQuoted(file)}; }; f`,
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
