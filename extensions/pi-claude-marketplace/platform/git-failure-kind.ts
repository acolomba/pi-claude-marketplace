// platform/git-failure-kind.ts
//
// SG-PRC-05: reads the kind of a failed git command from its exit code and its
// stderr. platform/git-process.ts sets `LC_MESSAGES=C` on every command, so
// git prints its messages in English in every locale. Each row of the table
// below comes from git's own text (the E15 corpus, git 2.43) or from the
// OpenSSH text that git passes through (the E16 corpus). The first row that
// matches wins, so the order is part of the contract:
//
// - A changed host key also prints `Host key verification failed`, so its
//   banner row comes first.
// - A missing `file://` repository and an ssh DNS failure also print git's
//   generic `Could not read from remote repository`, so that row comes last.
// - `fatal: remote error: upload-pack: not our ref` is a missing commit, so
//   the commit rows come before the remote-error row.
// - A proxy refusal also prints a 403, so its row comes before the HTTPS
//   authentication row.
//
// D-SG-04: an `xcrun: error:` stderr or an exit 127 means git cannot run.
// D-SG-06: an exit 129 or an unknown-option line means the git is too old for
// an option the extension passes.

import type { GitFailure } from "../shared/errors.ts";

// A row fires on an exit code or on a stderr pattern.
type Trigger = number | RegExp;

// A row gives a fixed failure, or builds one from the stderr.
type Outcome = GitFailure | ((stderr: string) => GitFailure);

// `httpStatus` from `The requested URL returned error: <n>`, and `curlCode`
// from `RPC failed; curl <n>` or `RPC failed; HTTP <n> curl <n>`.
function networkFailure(stderr: string): GitFailure {
  const httpStatus = /The requested URL returned error: (\d{3})/.exec(stderr)?.[1];
  const curlCode = /RPC failed;(?: HTTP \d+)? curl (\d+)/.exec(stderr)?.[1];
  return {
    kind: "network",
    ...(httpStatus !== undefined && { httpStatus: Number(httpStatus) }),
    ...(curlCode !== undefined && { curlCode: Number(curlCode) }),
  };
}

const NETWORK_TEXT = new RegExp(
  [
    "Could not resolve host",
    "Failed to connect to",
    "Couldn't connect to server",
    "Connection timed out",
    "Connection refused",
    "Connection reset",
    "ssh: Could not resolve hostname",
    "ssh: connect to host",
    "fatal: unable to connect to ",
    String.raw`error: RPC failed;`,
    "SSL certificate problem",
    String.raw`The requested URL returned error: 5\d\d`,
  ].join("|"),
);

const ROWS: ReadonlyArray<readonly [Trigger, Outcome]> = [
  [/xcrun: error:/, { kind: "git-missing", detail: "macos-shim" }],
  [127, { kind: "git-missing", detail: "not-found" }],
  [129, { kind: "git-too-old" }],
  [/^error: unknown (?:option|switch) /m, { kind: "git-too-old" }],
  [/detected dubious ownership in repository at '/, { kind: "dubious-ownership" }],
  [/^fatal: transport '[^']+' not allowed/m, { kind: "protocol-refused" }],
  [/REMOTE HOST IDENTIFICATION HAS CHANGED/, { kind: "ssh-host-key-changed" }],
  [/Host key verification failed/, { kind: "ssh-host-key-unknown" }],
  [/^remote: access denied by the git proxy/m, { kind: "proxy-refused" }],
  [/Permission denied \(publickey/, { kind: "ssh-auth" }],
  [
    /could not read (?:Username|Password) for '|terminal prompts disabled|Authentication failed for '|The requested URL returned error: 40[13]\b/,
    { kind: "https-auth" },
  ],
  // git prints this line for an HTTP 404, without the status.
  [
    /^fatal: repository 'https?:\/\/.*' not found/m,
    { kind: "repository-not-found", httpStatus: 404 },
  ],
  [
    /^fatal: repository '.*' not found|does not appear to be a git repository|^fatal: repository '.*' does not exist|ERROR: Repository not found/m,
    { kind: "repository-not-found" },
  ],
  [/The requested URL returned error: 410\b/, { kind: "repository-not-found", httpStatus: 410 }],
  [
    /couldn't find remote ref |Remote branch .* not found in upstream origin/,
    { kind: "remote-ref-missing" },
  ],
  [/not our ref |reference is not a tree: /, { kind: "commit-missing" }],
  [/^error: pathspec '.*' did not match any file/m, { kind: "local-ref-missing" }],
  [/^fatal: not a git repository/m, { kind: "not-a-repository" }],
  [NETWORK_TEXT, networkFailure],
  [/^fatal: unable to access '/m, networkFailure],
  [/^fatal: remote error: /m, { kind: "remote-error" }],
  [/Could not read from remote repository/, { kind: "ssh-auth" }],
  [/^\s*$/, { kind: "no-stderr" }],
];

function fires(trigger: Trigger, exitCode: number | null, stderr: string): boolean {
  return typeof trigger === "number" ? trigger === exitCode : trigger.test(stderr);
}

/**
 * SG-PRC-05: the failure of a git command that exited with `exitCode` (null
 * when it closed without one) and printed `stderr`. Line ends are folded to LF
 * first, so a CRLF stderr reads the same. A stderr no row knows is `failed`.
 */
export function classifyGitExit(exitCode: number | null, stderr: string): GitFailure {
  const text = stderr.replace(/\r\n?/g, "\n");
  const row = ROWS.find(([trigger]) => fires(trigger, exitCode, text));
  if (row === undefined) {
    return { kind: "failed" };
  }

  const [, outcome] = row;
  return typeof outcome === "function" ? outcome(text) : { ...outcome };
}
