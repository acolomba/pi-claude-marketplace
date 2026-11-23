/**
 * @fileoverview Stand-ins for programs a user configured for git: an askpass
 * program (`core.askPass`) and a credential helper (`credential.helper`). Each
 * answers with a given user and password, as the user's own program would,
 * and records every run to a file beside it. The product must never run
 * either during a credential lookup (SG-PRC-02, SG-PRC-03), so a scenario
 * states that the record holds no run.
 *
 * A program lives in the sandbox HOME, and its record beside it. Both are
 * shell scripts that use only shell builtins, so they run on any PATH.
 */

import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/** The kind of program a user configures for git. */
export type UserGitProgramKind = "askpass" | "credential-helper";

/** The credential a program answers with. */
export interface UserGitCredential {
  readonly user: string;
  readonly password: string;
}

function programPath(home: string, kind: UserGitProgramKind): string {
  return path.join(home, `user-${kind}`);
}

function recordPath(home: string, kind: UserGitProgramKind): string {
  return `${programPath(home, kind)}.runs`;
}

// Every value goes into the script inside single quotes, which nothing in the
// shell can end except another quote, so a value may not hold one.
function quoted(value: string): string {
  if (/['\n\r]/.test(value)) {
    throw new Error(`a user git program cannot answer with ${JSON.stringify(value)}`);
  }

  return `'${value}'`;
}

// Git runs an askpass program with the prompt as its one argument, and a
// credential helper with its action, writing the request on stdin and closing
// it. The helper reads stdin to its end, and answers only a `get`.
function scriptText(
  kind: UserGitProgramKind,
  record: string,
  credential: UserGitCredential,
): string {
  const recordRun = `printf '%s\\n' "$*" >> ${quoted(record)}`;
  const user = quoted(credential.user);
  const password = quoted(credential.password);
  const answer =
    kind === "askpass"
      ? [
          'case "$1" in',
          `  Username*) printf '%s\\n' ${user} ;;`,
          `  Password*) printf '%s\\n' ${password} ;;`,
          "esac",
        ]
      : [
          "while read -r line; do :; done",
          'if [ "$1" = get ]; then',
          `  printf 'username=%s\\npassword=%s\\n' ${user} ${password}`,
          "fi",
        ];
  return ["#!/bin/sh", recordRun, ...answer, ""].join("\n");
}

/**
 * Writes the program of `kind` in `home`, with an empty record, and returns
 * its absolute path. It fails when that program or its record exists already,
 * so a scenario cannot overwrite a program it did not make.
 */
export async function writeUserGitProgram(
  home: string,
  kind: UserGitProgramKind,
  credential: UserGitCredential,
): Promise<string> {
  const program = programPath(home, kind);
  const record = recordPath(home, kind);
  await writeFile(record, "", { flag: "wx" });
  await writeFile(program, scriptText(kind, record, credential), { flag: "wx", mode: 0o700 });
  return program;
}

/** Removes the program of `kind` and its record from `home`. */
export async function removeUserGitProgram(home: string, kind: UserGitProgramKind): Promise<void> {
  await rm(programPath(home, kind), { force: true });
  await rm(recordPath(home, kind), { force: true });
}

/** Returns the arguments of each recorded run of the program of `kind`, in run order. */
export async function readUserGitProgramRuns(
  home: string,
  kind: UserGitProgramKind,
): Promise<string[]> {
  const text = await readFile(recordPath(home, kind), "utf8");
  return text.split("\n").slice(0, -1);
}
