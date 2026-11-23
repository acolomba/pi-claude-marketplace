import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyGitExit } from "../../extensions/pi-claude-marketplace/platform/git-failure-kind.ts";

import type { GitFailure } from "../../extensions/pi-claude-marketplace/shared/errors.ts";

interface CorpusRow {
  readonly label: string;
  readonly exitCode: number | null;
  readonly stderr: string;
  readonly failure: GitFailure;
}

const SHA = "0123456789abcdef0123456789abcdef01234567";

// The block git prints after an ssh failure or a missing local repository.
const READ_FAILED_BLOCK = `fatal: Could not read from remote repository.

Please make sure you have the correct access rights
and the repository exists.
`;

const HOST_KEY_BANNER = `@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
`;

// SG-PRC-05: the E15 (git) and E16 (OpenSSH through git) corpus lines.
const CORPUS: readonly CorpusRow[] = [
  {
    label: "an HTTP 401",
    exitCode: 128,
    stderr:
      "fatal: could not read Username for 'http://127.0.0.1:18931': terminal prompts disabled\n",
    failure: { kind: "https-auth" },
  },
  {
    label: "an HTTP 401 with a user in the URL",
    exitCode: 128,
    stderr:
      "fatal: could not read Password for 'http://alice@127.0.0.1:18931': terminal prompts disabled\n",
    failure: { kind: "https-auth" },
  },
  {
    label: "an HTTP 401 with a password in the URL",
    exitCode: 128,
    stderr: "fatal: Authentication failed for 'http://127.0.0.1:18931/auth/x.git/'\n",
    failure: { kind: "https-auth" },
  },
  {
    label: "credential fill with no helper",
    exitCode: 128,
    stderr:
      "fatal: could not read Username for 'https://example.test': terminal prompts disabled\n",
    failure: { kind: "https-auth" },
  },
  {
    label: "an HTTP 403",
    exitCode: 128,
    stderr:
      "fatal: unable to access 'http://127.0.0.1:18931/forbidden/x.git/': The requested URL returned error: 403\n",
    failure: { kind: "https-auth" },
  },
  {
    label: "an HTTP 404",
    exitCode: 128,
    stderr: "fatal: repository 'http://127.0.0.1:18931/missing/x.git/' not found\n",
    failure: { kind: "repository-not-found", httpStatus: 404 },
  },
  {
    label: "an HTTP 410",
    exitCode: 128,
    stderr:
      "fatal: unable to access 'http://127.0.0.1:18931/gone/x.git/': The requested URL returned error: 410\n",
    failure: { kind: "repository-not-found", httpStatus: 410 },
  },
  {
    label: "an HTTP 500",
    exitCode: 128,
    stderr:
      "fatal: unable to access 'http://127.0.0.1:18931/err/x.git/': The requested URL returned error: 500\n",
    failure: { kind: "network", httpStatus: 500 },
  },
  {
    label: "a refused port",
    exitCode: 128,
    stderr:
      "fatal: unable to access 'http://127.0.0.1:9/x.git/': Failed to connect to 127.0.0.1 port 9 after 0 ms: Couldn't connect to server\n",
    failure: { kind: "network" },
  },
  {
    label: "an unknown HTTP host",
    exitCode: 128,
    stderr:
      "fatal: unable to access 'http://nonexistent.invalid/x.git/': Could not resolve host: nonexistent.invalid\n",
    failure: { kind: "network" },
  },
  {
    label: "a missing file:// repository",
    exitCode: 128,
    stderr: `fatal: '/srv/missing.git' does not appear to be a git repository\n${READ_FAILED_BLOCK}`,
    failure: { kind: "repository-not-found" },
  },
  {
    label: "a missing plain-path repository",
    exitCode: 128,
    stderr: "fatal: repository '/srv/missing.git' does not exist\n",
    failure: { kind: "repository-not-found" },
  },
  {
    label: "a branch the remote does not have",
    exitCode: 128,
    stderr: "fatal: Remote branch nope not found in upstream origin\n",
    failure: { kind: "remote-ref-missing" },
  },
  {
    label: "a fetched ref the remote does not have",
    exitCode: 128,
    stderr: "fatal: couldn't find remote ref refs/heads/nope\n",
    failure: { kind: "remote-ref-missing" },
  },
  {
    label: "an unknown commit from upload-pack",
    exitCode: 128,
    stderr: `fatal: git upload-pack: not our ref ${SHA}\n`,
    failure: { kind: "commit-missing" },
  },
  {
    label: "an unknown commit as a remote error",
    exitCode: 128,
    stderr: `fatal: remote error: upload-pack: not our ref ${SHA}\n`,
    failure: { kind: "commit-missing" },
  },
  {
    label: "a checkout of an unknown commit",
    exitCode: 128,
    stderr: `fatal: reference is not a tree: ${SHA}\n`,
    failure: { kind: "commit-missing" },
  },
  {
    label: "a checkout of an unknown name",
    exitCode: 1,
    stderr: "error: pathspec 'nope' did not match any file(s) known to git\n",
    failure: { kind: "local-ref-missing" },
  },
  {
    label: "no repository below the ceiling",
    exitCode: 128,
    stderr: "fatal: not a git repository (or any of the parent directories): .git\n",
    failure: { kind: "not-a-repository" },
  },
  {
    label: "a refused ext transport",
    exitCode: 128,
    stderr: "fatal: transport 'ext' not allowed\n",
    failure: { kind: "protocol-refused" },
  },
  {
    label: "an unknown option",
    exitCode: 129,
    stderr: "error: unknown option `no-such-flag'\nusage: git ls-remote [--branches] [--tags]\n",
    failure: { kind: "git-too-old" },
  },
  {
    label: "dubious ownership",
    exitCode: 128,
    stderr:
      "fatal: detected dubious ownership in repository at '/srv/repo'\nTo add an exception for this directory, call:\n\n\tgit config --global --add safe.directory /srv/repo\n",
    failure: { kind: "dubious-ownership" },
  },
  {
    label: "a refused ssh key",
    exitCode: 128,
    stderr: `git@stand-in.test: Permission denied (publickey).\n${READ_FAILED_BLOCK}`,
    failure: { kind: "ssh-auth" },
  },
  {
    label: "an unknown ssh host key",
    exitCode: 128,
    stderr: `Host key verification failed.\n${READ_FAILED_BLOCK}`,
    failure: { kind: "ssh-host-key-unknown" },
  },
  {
    label: "a changed ssh host key",
    exitCode: 128,
    stderr: `${HOST_KEY_BANNER}Host key verification failed.\n${READ_FAILED_BLOCK}`,
    failure: { kind: "ssh-host-key-changed" },
  },
  {
    label: "an unknown ssh host",
    exitCode: 128,
    stderr: `ssh: Could not resolve hostname stand-in.test: Name or service not known\n${READ_FAILED_BLOCK}`,
    failure: { kind: "network" },
  },
  {
    label: "a curl failure during the transfer",
    exitCode: 128,
    stderr:
      "error: RPC failed; curl 56 GnuTLS recv error (-9): Error decoding the received TLS packet.\nfatal: early EOF\n",
    failure: { kind: "network", curlCode: 56 },
  },
  {
    label: "a curl failure with an HTTP status",
    exitCode: 128,
    stderr:
      "error: RPC failed; HTTP 500 curl 22 The requested URL returned error: 500\nfatal: expected flush after ref listing\n",
    failure: { kind: "network", httpStatus: 500, curlCode: 22 },
  },
  {
    label: "an HTTPS failure no other row knows",
    exitCode: 128,
    stderr:
      "fatal: unable to access 'https://example.test/x.git/': gnutls_handshake() failed: An unexpected TLS packet was received.\n",
    failure: { kind: "network" },
  },
  {
    label: "a remote error",
    exitCode: 128,
    stderr: "fatal: remote error: access denied\n",
    failure: { kind: "remote-error" },
  },
  {
    label: "a proxy refusal with a 403",
    exitCode: 128,
    stderr:
      "remote: access denied by the git proxy\nfatal: unable to access 'https://github.com/x/y.git/': The requested URL returned error: 403\n",
    failure: { kind: "proxy-refused" },
  },
  {
    label: "the macOS xcrun shim",
    exitCode: 1,
    stderr:
      "xcrun: error: invalid active developer path (/Library/Developer/CommandLineTools), missing xcrun at: /Library/Developer/CommandLineTools/usr/bin/xcrun\n",
    failure: { kind: "git-missing", detail: "macos-shim" },
  },
  {
    label: "an exit 127 with stderr",
    exitCode: 127,
    stderr: "/usr/bin/git: not found\n",
    failure: { kind: "git-missing", detail: "not-found" },
  },
  {
    label: "an exit 127 without stderr",
    exitCode: 127,
    stderr: "",
    failure: { kind: "git-missing", detail: "not-found" },
  },
  {
    label: "an unknown switch",
    exitCode: 128,
    stderr: "error: unknown switch `x'\n",
    failure: { kind: "git-too-old" },
  },
  {
    label: "an exit 129 without stderr",
    exitCode: 129,
    stderr: "",
    failure: { kind: "git-too-old" },
  },
  {
    label: "a non-HTTP repository not found",
    exitCode: 128,
    stderr: "fatal: repository '/srv/missing.git' not found\n",
    failure: { kind: "repository-not-found" },
  },
  {
    label: "a host's repository-not-found text",
    exitCode: 128,
    stderr: `ERROR: Repository not found.\n${READ_FAILED_BLOCK}`,
    failure: { kind: "repository-not-found" },
  },
  {
    label: "the read-failed block alone",
    exitCode: 128,
    stderr: READ_FAILED_BLOCK,
    failure: { kind: "ssh-auth" },
  },
  {
    label: "a progress line that ends in CR before the failure",
    exitCode: 128,
    stderr: "Receiving objects:  50% (1/2)\rfatal: not a git repository: '/srv/x'\n",
    failure: { kind: "not-a-repository" },
  },
  {
    label: "an empty stderr",
    exitCode: 128,
    stderr: "",
    failure: { kind: "no-stderr" },
  },
  {
    label: "a whitespace-only stderr",
    exitCode: 128,
    stderr: "  \n",
    failure: { kind: "no-stderr" },
  },
  {
    label: "no exit code and no stderr",
    exitCode: null,
    stderr: "",
    failure: { kind: "no-stderr" },
  },
  {
    label: "a stderr no row knows",
    exitCode: 128,
    stderr: "fatal: something new\n",
    failure: { kind: "failed" },
  },
];

for (const { label, exitCode, stderr, failure } of CORPUS) {
  test(`SG-PRC-05: classifies ${label} as ${failure.kind}`, () => {
    // act
    const classified = classifyGitExit(exitCode, stderr);

    // assert
    assert.deepStrictEqual(classified, failure);
  });

  test(`SG-PRC-05: classifies ${label} with CRLF line ends as ${failure.kind}`, () => {
    // arrange
    const crlf = stderr.replaceAll("\n", "\r\n");

    // act
    const classified = classifyGitExit(exitCode, crlf);

    // assert
    assert.deepStrictEqual(classified, failure);
  });
}

test("SG-PRC-05: gives each call its own failure object", () => {
  // arrange
  const first = classifyGitExit(128, "fatal: transport 'ext' not allowed\n");

  // act
  const second = classifyGitExit(128, "fatal: transport 'ext' not allowed\n");

  // assert
  assert.deepStrictEqual(second, { kind: "protocol-refused" });
  assert.notStrictEqual(second, first);
});
