import assert from "node:assert/strict";
import test from "node:test";

import { gitFailureRemedy } from "../../extensions/pi-claude-marketplace/shared/git-failure-remedy.ts";

import type { GitRemedyFacts } from "../../extensions/pi-claude-marketplace/shared/git-failure-remedy.ts";

const TIMEOUT_TAIL =
  "the time limit for one git command. A large repository can need more time. To raise the limit, start Pi with CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS set to a number of milliseconds, for example 300000 for 5 minutes.";
const HTTPS_TAIL =
  "This extension runs git with terminal prompts and askpass programs turned off, and it tells credential helpers not to prompt. So git can only use a credential that it gets without asking you, such as one that a credential helper already holds.";
const NETWORK_REMEDY =
  "A network error or a network timeout stopped git. Make sure that your internet connection works. Then run the command again.";
const DEBUG_TAIL =
  "To see the git command that failed, start Pi with PI_CLAUDE_MARKETPLACE_DEBUG=1. Then run the command again.";

function facts(overrides: Partial<GitRemedyFacts>): GitRemedyFacts {
  return { remedyClass: "network", exitCode: 128, stderr: "", ...overrides };
}

for (const { name, input, expected } of [
  {
    name: "D-SG-33 names one second for a limit of 1499 ms",
    input: facts({ remedyClass: "timeout", timeoutMs: 1499 }),
    expected: `This extension stopped git after 1 second, ${TIMEOUT_TAIL}`,
  },
  {
    name: "D-SG-33 rounds a limit of 1500 ms up to 2 seconds",
    input: facts({ remedyClass: "timeout", timeoutMs: 1500 }),
    expected: `This extension stopped git after 2 seconds, ${TIMEOUT_TAIL}`,
  },
  {
    name: "D-SG-33 names the limit of 120000 ms as 120 seconds",
    input: facts({ remedyClass: "timeout", timeoutMs: 120_000 }),
    expected: `This extension stopped git after 120 seconds, ${TIMEOUT_TAIL}`,
  },
  {
    name: "D-SG-33 names 0 seconds for a timeout whose limit is not given",
    input: facts({ remedyClass: "timeout" }),
    expected: `This extension stopped git after 0 seconds, ${TIMEOUT_TAIL}`,
  },
  {
    name: "D-SG-33 names the scp host in the changed host key remedy and its command",
    input: facts({
      remedyClass: "ssh-host-key-changed",
      remote: { url: "git@git.example.org:acme/tools.git", gitHub: false },
    }),
    expected:
      "The SSH host key of git.example.org does not match the key in your known_hosts file. Either the server has a new key, or another computer acts as the server. To remove the old key, run ssh-keygen -R git.example.org. Then connect to the server once by hand, make sure that the new key is correct, and accept it.",
  },
  {
    name: "D-SG-33 names the server and the <host> placeholder for a changed host key of an ssh:// URL",
    input: facts({
      remedyClass: "ssh-host-key-changed",
      remote: { url: "ssh://git@git.example.org/acme/tools.git", gitHub: false },
    }),
    expected:
      "The SSH host key of the server does not match the key in your known_hosts file. Either the server has a new key, or another computer acts as the server. To remove the old key, run ssh-keygen -R <host>. Then connect to the server once by hand, make sure that the new key is correct, and accept it.",
  },
  {
    name: "D-SG-33 names the scp host in the unknown host key remedy and its command",
    input: facts({
      remedyClass: "ssh-host-key-unknown",
      remote: { url: "git@git.example.org:acme/tools.git", gitHub: false },
    }),
    expected:
      "The SSH host key of git.example.org is not in your known_hosts file. To add it, run ssh -T git@git.example.org once, and make sure that the fingerprint it shows is correct. You can also use an HTTPS URL, which is the better choice for a public repository.",
  },
  {
    name: "D-SG-33 names the server and the <host> placeholder for an unknown host key with no remote",
    input: facts({ remedyClass: "ssh-host-key-unknown" }),
    expected:
      "The SSH host key of the server is not in your known_hosts file. To add it, run ssh -T git@<host> once, and make sure that the fingerprint it shows is correct. You can also use an HTTPS URL, which is the better choice for a public repository.",
  },
  {
    name: "D-SG-33 names the server for an unknown host key of an address with no user",
    input: facts({
      remedyClass: "ssh-host-key-unknown",
      remote: { url: "git.example.org:acme/tools.git", gitHub: false },
    }),
    expected:
      "The SSH host key of the server is not in your known_hosts file. To add it, run ssh -T git@<host> once, and make sure that the fingerprint it shows is correct. You can also use an HTTPS URL, which is the better choice for a public repository.",
  },
  {
    name: "D-SG-33 names GitHub in the SSH auth remedy for a GitHub address",
    input: facts({
      remedyClass: "ssh-auth",
      remote: { url: "git@github.example:acme/tools.git", gitHub: true },
    }),
    expected:
      "SSH authentication with GitHub failed. Make sure that your SSH keys are set up for GitHub, or use an HTTPS URL.",
  },
  {
    name: "D-SG-33 names the host and port of an ssh:// URL in the SSH auth remedy",
    input: facts({
      remedyClass: "ssh-auth",
      remote: { url: "ssh://***@git.example.org:2222/acme/tools.git", gitHub: false },
    }),
    expected:
      "SSH authentication with git.example.org:2222 failed. Make sure that your SSH keys are set up for git.example.org:2222, or use an HTTPS URL.",
  },
  {
    name: "D-SG-33 names the scp host in the SSH auth remedy",
    input: facts({
      remedyClass: "ssh-auth",
      remote: { url: "git@git.example.org:acme/tools.git", gitHub: false },
    }),
    expected:
      "SSH authentication with git.example.org failed. Make sure that your SSH keys are set up for git.example.org, or use an HTTPS URL.",
  },
  {
    name: "D-SG-33 names your git host in the SSH auth remedy with no remote",
    input: facts({ remedyClass: "ssh-auth" }),
    expected:
      "SSH authentication with your git host failed. Make sure that your SSH keys are set up for your git host, or use an HTTPS URL.",
  },
  {
    name: "D-SG-33 names your git host for a URL with a scheme and no host",
    input: facts({
      remedyClass: "ssh-auth",
      remote: { url: "file:///srv/tools.git", gitHub: false },
    }),
    expected:
      "SSH authentication with your git host failed. Make sure that your SSH keys are set up for your git host, or use an HTTPS URL.",
  },
  {
    name: "D-SG-33 names your git host for a local path",
    input: facts({ remedyClass: "ssh-auth", remote: { url: "/srv/tools.git", gitHub: false } }),
    expected:
      "SSH authentication with your git host failed. Make sure that your SSH keys are set up for your git host, or use an HTTPS URL.",
  },
  {
    name: "D-SG-33 names GitHub and gh auth login in the HTTPS auth remedy for a GitHub address",
    input: facts({
      remedyClass: "https-auth",
      remote: { url: "https://github.example/acme/tools.git", gitHub: true },
    }),
    expected: `HTTPS authentication with GitHub failed. Make sure that your git credential helper is set up, for example with gh auth login. ${HTTPS_TAIL}`,
  },
  {
    name: "D-SG-33 names the host and port of an https URL in the HTTPS auth remedy",
    input: facts({
      remedyClass: "https-auth",
      remote: { url: "https://***@127.0.0.1:8443/acme/tools.git", gitHub: false },
    }),
    expected: `HTTPS authentication with 127.0.0.1:8443 failed. Make sure that your git credential helper has a valid credential for 127.0.0.1:8443, for example a personal access token. ${HTTPS_TAIL}`,
  },
  {
    name: "D-SG-33 leaves the default port out of the host of an https URL",
    input: facts({
      remedyClass: "https-auth",
      remote: { url: "https://git.example.org:443/acme/tools.git", gitHub: false },
    }),
    expected: `HTTPS authentication with git.example.org failed. Make sure that your git credential helper has a valid credential for git.example.org, for example a personal access token. ${HTTPS_TAIL}`,
  },
  {
    name: "D-SG-33 names this host in the HTTPS auth remedy with no remote",
    input: facts({ remedyClass: "https-auth" }),
    expected: `HTTPS authentication with this host failed. Make sure that your git credential helper has a valid credential for this host, for example a personal access token. ${HTTPS_TAIL}`,
  },
  {
    name: "D-SG-33 gives the network remedy when git's line says timed out",
    input: facts({
      stderr: "fatal: unable to access 'https://git.example.org/x.git/': Connection timed out",
    }),
    expected: NETWORK_REMEDY,
  },
  {
    name: "D-SG-33 gives the network remedy when git's line says timeout",
    input: facts({ stderr: "error: RPC failed; curl 28 Operation timeout" }),
    expected: NETWORK_REMEDY,
  },
  {
    name: "D-SG-33 gives the network remedy when git could not resolve the host",
    input: facts({
      stderr:
        "fatal: unable to access 'https://git.example.org/x.git/': Could not resolve host: git.example.org",
    }),
    expected: NETWORK_REMEDY,
  },
  {
    name: "D-SG-33 reads git's lines after CRLF line ends",
    input: facts({
      stderr: "remote: busy\r\nfatal: unable to access 'x': Connection timed out\r\n",
    }),
    expected: NETWORK_REMEDY,
  },
  {
    name: "D-SG-34 gives no network remedy for a refused connection",
    input: facts({
      stderr: "fatal: unable to access 'https://git.example.org/x.git/': Connection refused",
    }),
    expected: undefined,
  },
  {
    name: "WR-01 gives no network remedy when only a remote: line says timed out",
    input: facts({
      stderr:
        "remote: the request timed out\nfatal: unable to access 'https://git.example.org/x.git/': Empty reply from server",
    }),
    expected: undefined,
  },
  {
    name: "D-SG-33 names the exit code of a failure with no error output",
    input: facts({ remedyClass: "no-stderr", exitCode: 128 }),
    expected: `git exited with code 128 and printed no error output. ${DEBUG_TAIL}`,
  },
  {
    name: "D-SG-33 says git stopped without an exit code when it gave none",
    input: facts({ remedyClass: "no-stderr", exitCode: null }),
    expected: `git stopped without an exit code and printed no error output. ${DEBUG_TAIL}`,
  },
] satisfies ReadonlyArray<{ name: string; input: GitRemedyFacts; expected: string | undefined }>) {
  test(name, () => {
    // act
    const remedy = gitFailureRemedy(input);

    // assert
    assert.strictEqual(remedy, expected);
  });
}
