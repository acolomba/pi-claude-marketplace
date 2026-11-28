/**
 * shared/git-failure-remedy.ts -- the remedy sentence of a failed git command.
 *
 * D-SG-31, D-SG-33: upstream 2.1.332 gives a remedy for seven failure
 * classes of a marketplace clone. This module words each of them in plain
 * English, keeps upstream's commands and settings exactly, and names this
 * extension where upstream names its own product. `shared/errors.ts` maps each
 * git failure kind to its class and shows the sentence in the cause chain,
 * after the typed line and before git's own output.
 *
 * D-SG-34: every other class has no remedy upstream, so this module has none
 * for it either, and the cause chain shows git's output only.
 *
 * Host rules (upstream `IGo`, `zNi`, `KNi`): a host-key sentence names the
 * host of an scp address, else the `<host>` placeholder. An auth sentence
 * names GitHub when the request went to a GitHub address, else the host of
 * the URL, else a generic phrase.
 *
 * Leaf module: it imports nothing and keeps no module-level state, because
 * `shared/errors.ts` imports it.
 */

/** D-SG-33: the failure classes that have a remedy sentence. */
export type GitRemedyClass =
  | "timeout"
  | "ssh-host-key-changed"
  | "ssh-host-key-unknown"
  | "ssh-auth"
  | "https-auth"
  | "network"
  | "no-stderr";

/**
 * The facts a remedy reads. `timeoutMs` is the limit of a `timeout` failure,
 * `stderr` is git's redacted stderr, and `remote` is the remote the request
 * reached, with `gitHub` set when the URL git sent is a GitHub address.
 */
export interface GitRemedyFacts {
  readonly remedyClass: GitRemedyClass;
  readonly timeoutMs?: number;
  readonly exitCode: number | null;
  readonly stderr: string;
  readonly remote?: { readonly url: string; readonly gitHub: boolean };
}

/**
 * D-SG-33: the remedy sentence for `facts`. It is `undefined` only for a
 * network failure whose own lines name no timeout and no failed host lookup,
 * because upstream gives no remedy for any other network failure.
 */
export function gitFailureRemedy(facts: GitRemedyFacts): string | undefined {
  switch (facts.remedyClass) {
    case "timeout":
      return timeoutRemedy(facts.timeoutMs ?? 0);
    case "ssh-host-key-changed":
      return hostKeyChangedRemedy(scpHost(facts.remote?.url));
    case "ssh-host-key-unknown":
      return hostKeyUnknownRemedy(scpHost(facts.remote?.url));
    case "ssh-auth":
      return sshAuthRemedy(facts.remote);
    case "https-auth":
      return httpsAuthRemedy(facts.remote);
    case "network":
      return networkRemedy(facts.stderr);
    case "no-stderr":
      return noStderrRemedy(facts.exitCode);
  }
}

// D-SG-13: the limit in whole seconds, rounded from milliseconds.
function timeoutRemedy(timeoutMs: number): string {
  const seconds = Math.round(timeoutMs / 1000);
  const unit = seconds === 1 ? "second" : "seconds";
  return `This extension stopped git after ${seconds} ${unit}, the time limit for one git command. A large repository can need more time. To raise the limit, start Pi with CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS set to a number of milliseconds, for example 300000 for 5 minutes.`;
}

function hostKeyChangedRemedy(host: string | undefined): string {
  if (host === undefined) {
    return "The SSH host key of the server does not match the key in your known_hosts file. Either the server has a new key, or another computer acts as the server. To remove the old key, run ssh-keygen -R <host>. Then connect to the server once by hand, make sure that the new key is correct, and accept it.";
  }

  return `The SSH host key of ${host} does not match the key in your known_hosts file. Either the server has a new key, or another computer acts as the server. To remove the old key, run ssh-keygen -R ${host}. Then connect to the server once by hand, make sure that the new key is correct, and accept it.`;
}

function hostKeyUnknownRemedy(host: string | undefined): string {
  if (host === undefined) {
    return "The SSH host key of the server is not in your known_hosts file. To add it, run ssh -T git@<host> once, and make sure that the fingerprint it shows is correct. You can also use an HTTPS URL, which is the better choice for a public repository.";
  }

  return `The SSH host key of ${host} is not in your known_hosts file. To add it, run ssh -T git@${host} once, and make sure that the fingerprint it shows is correct. You can also use an HTTPS URL, which is the better choice for a public repository.`;
}

function sshAuthRemedy(remote: GitRemedyFacts["remote"]): string {
  const label = remote?.gitHub === true ? "GitHub" : (remoteHost(remote) ?? "your git host");
  return `SSH authentication with ${label} failed. Make sure that your SSH keys are set up for ${label}, or use an HTTPS URL.`;
}

function httpsAuthRemedy(remote: GitRemedyFacts["remote"]): string {
  if (remote?.gitHub === true) {
    return "HTTPS authentication with GitHub failed. Make sure that your git credential helper is set up, for example with gh auth login. This extension runs git with terminal prompts and askpass programs turned off, and it tells credential helpers not to prompt. So git can only use a credential that it gets without asking you, such as one that a credential helper already holds.";
  }

  const host = remoteHost(remote) ?? "this host";
  return `HTTPS authentication with ${host} failed. Make sure that your git credential helper has a valid credential for ${host}, for example a personal access token. This extension runs git with terminal prompts and askpass programs turned off, and it tells credential helpers not to prompt. So git can only use a credential that it gets without asking you, such as one that a credential helper already holds.`;
}

// WR-01: the lines a server sent start with `remote: `, so they are removed
// before the check, as the kind classifier removes them, and a server cannot
// pick the remedy.
const REMOTE_LINE = /^remote: .*(?:\n|$)/gm;
const NETWORK_TEXT = /timed out|timeout|Could not resolve host/;

function networkRemedy(stderr: string): string | undefined {
  const own = stderr.replace(/\r\n?/g, "\n").replace(REMOTE_LINE, "");
  return NETWORK_TEXT.test(own)
    ? "A network error or a network timeout stopped git. Make sure that your internet connection works. Then run the command again."
    : undefined;
}

function noStderrRemedy(code: number | null): string {
  if (code === null) {
    return "git stopped without an exit code and printed no error output. To see the git command that failed, start Pi with PI_CLAUDE_MARKETPLACE_DEBUG=1. Then run the command again.";
  }

  return `git exited with code ${code} and printed no error output. To see the git command that failed, start Pi with PI_CLAUDE_MARKETPLACE_DEBUG=1. Then run the command again.`;
}

// Upstream `IGo`: only an scp address such as `git@host:owner/repo.git` names
// the host of a host-key command; a URL with a scheme gives none.
const SCP_HOST = /^[^:]*@([^@:]+):/;

function scpHost(url: string | undefined): string | undefined {
  if (url === undefined || url.includes("://")) {
    return undefined;
  }

  return SCP_HOST.exec(url)?.[1];
}

// Upstream `zNi` and `KNi`: the host of a URL with a scheme, with its port
// when the port is not the default, else the host of an scp address.
const SCP_ADDRESS_HOST = /^(?:[^@/]*@)?([^@:/]+):/;

function remoteHost(remote: GitRemedyFacts["remote"]): string | undefined {
  if (remote === undefined) {
    return undefined;
  }

  if (remote.url.includes("://") && URL.canParse(remote.url)) {
    const { host } = new URL(remote.url);
    return host === "" ? undefined : host;
  }

  return SCP_ADDRESS_HOST.exec(remote.url)?.[1];
}
