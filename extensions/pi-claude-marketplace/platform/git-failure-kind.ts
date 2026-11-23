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
// WR-01: a server's `remote:` lines reach stderr too, so a host could print
// a phrase that picks the kind. Every row reads git's own lines, with the
// `remote:` lines removed, and anchors its pattern where git or ssh starts
// the line. Only the proxy row reads a `remote:` line, because the proxy
// speaks through one, and the no-stderr row reads the whole stderr.
//
// D-SG-04: an exit 127, or a stderr whose every line is an `xcrun: error:`
// line, means git cannot run. The xcrun shim prints only that line, while a
// git that ran and failed prints its own `fatal:` line as well, so a server
// cannot make a working git look missing.
// D-SG-06: an exit 129 or an unknown-option line means the git is too old for
// an option the extension passes.

import type { GitFailure } from "../shared/errors.ts";

// A row fires on an exit code, on a pattern over git's own lines, or on a
// pattern over the whole stderr, `remote:` lines included.
type Trigger = number | RegExp | { readonly wholeStderr: RegExp };

// A row gives a fixed failure, or builds one from git's own lines.
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

// curl's and ssh's network texts, inside git's `fatal: unable to access` or
// `error: RPC failed` line, or on a line ssh starts.
const NETWORK_TEXT = new RegExp(
  [
    "Could not resolve host",
    "Failed to connect to",
    "Couldn't connect to server",
    "Connection timed out",
    "Connection refused",
    "Connection reset",
    "SSL certificate problem",
    String.raw`The requested URL returned error: 5\d\d`,
  ]
    .map((text) => String.raw`^(?:fatal|error): .*${text}`)
    .concat([
      "^ssh: Could not resolve hostname",
      "^ssh: connect to host",
      "^fatal: unable to connect to ",
      String.raw`^error: RPC failed;`,
    ])
    .join("|"),
  "m",
);

const ROWS: ReadonlyArray<readonly [Trigger, Outcome]> = [
  [/^(?:xcrun: error:.*(?:\n|$))+$/, { kind: "git-missing", detail: "macos-shim" }],
  [127, { kind: "git-missing", detail: "not-found" }],
  [129, { kind: "git-too-old" }],
  [/^error: unknown (?:option|switch) /m, { kind: "git-too-old" }],
  [/^fatal: detected dubious ownership in repository at '/m, { kind: "dubious-ownership" }],
  [/^fatal: transport '[^']+' not allowed/m, { kind: "protocol-refused" }],
  [/^@ +WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!/m, { kind: "ssh-host-key-changed" }],
  [/^Host key verification failed\./m, { kind: "ssh-host-key-unknown" }],
  [{ wholeStderr: /^remote: access denied by the git proxy/m }, { kind: "proxy-refused" }],
  [/^\S+: Permission denied \(publickey/m, { kind: "ssh-auth" }],
  [
    /^fatal: could not read (?:Username|Password) for '|^fatal: .*terminal prompts disabled|^fatal: Authentication failed for '|^(?:fatal|error): .*The requested URL returned error: 40[13]\b/m,
    { kind: "https-auth" },
  ],
  // git prints this line for an HTTP 404, without the status.
  [
    /^fatal: repository 'https?:\/\/.*' not found/m,
    { kind: "repository-not-found", httpStatus: 404 },
  ],
  [
    /^fatal: repository '.*' not found|^fatal: '.*' does not appear to be a git repository|^fatal: repository '.*' does not exist|^ERROR: Repository not found/m,
    { kind: "repository-not-found" },
  ],
  [
    /^(?:fatal|error): .*The requested URL returned error: 410\b/m,
    { kind: "repository-not-found", httpStatus: 410 },
  ],
  [
    /^fatal: couldn't find remote ref |^fatal: Remote branch .* not found in upstream origin/m,
    { kind: "remote-ref-missing" },
  ],
  [/^fatal: .*not our ref |^fatal: reference is not a tree: /m, { kind: "commit-missing" }],
  [/^error: pathspec '.*' did not match any file/m, { kind: "local-ref-missing" }],
  [/^fatal: not a git repository/m, { kind: "not-a-repository" }],
  [NETWORK_TEXT, networkFailure],
  [/^fatal: unable to access '/m, networkFailure],
  [/^fatal: remote error: /m, { kind: "remote-error" }],
  [/^fatal: Could not read from remote repository/m, { kind: "ssh-auth" }],
  [{ wholeStderr: /^\s*$/ }, { kind: "no-stderr" }],
];

// The stderr lines a server sent through git, which start with `remote: `.
const REMOTE_LINE = /^remote: .*(?:\n|$)/gm;

function fires(trigger: Trigger, exitCode: number | null, stderr: string, own: string): boolean {
  if (typeof trigger === "number") {
    return trigger === exitCode;
  }

  return trigger instanceof RegExp ? trigger.test(own) : trigger.wholeStderr.test(stderr);
}

/**
 * SG-PRC-05: the failure of a git command that exited with `exitCode` (null
 * when it closed without one) and printed `stderr`. Line ends are folded to LF
 * first, so a CRLF stderr reads the same. A stderr no row knows is `failed`.
 */
export function classifyGitExit(exitCode: number | null, stderr: string): GitFailure {
  const text = stderr.replace(/\r\n?/g, "\n");
  const own = text.replace(REMOTE_LINE, "");
  const row = ROWS.find(([trigger]) => fires(trigger, exitCode, text, own));
  if (row === undefined) {
    return { kind: "failed" };
  }

  const [, outcome] = row;
  return typeof outcome === "function" ? outcome(own) : { ...outcome };
}
