// domain/git-url.ts
//
// D-SG-17: the port of Claude Code's git address validator. Every git address
// a source names, a plugin url object's `url` and `raw`, a git-subdir `url`,
// and a marketplace git address, passes here before git sees it. The rules
// run in Claude Code's order, and the first refusal wins. An scp address
// (`user@host:path`) returns early, as Claude Code's does, so the URL rules
// never read it. The D-SG-05 protocol bans on git's network lane stay as the
// second layer.
//
// Each address a message shows goes through `shared/redact-credentials.ts`,
// so userinfo never reaches a message (assumption A1: Pi's redaction stands
// in for Claude Code's display helpers).

import { redactCredentials } from "../shared/redact-credentials.ts";

/** Claude Code's list of the accepted forms, which ends every protocol refusal. */
const GIT_URL_FORMS =
  "https, http, ssh (also written git+ssh or ssh+git), user@host:path, or a local file:// address with no host. git:// isn't supported because it isn't encrypted.";

/**
 * Claude Code's scp form: a user and a host, neither starting with `-`, then
 * a `:` that no `//` follows. A bracketed IPv6 literal may stand for the host.
 */
const SCP_ADDRESS = /^(?!-)[A-Za-z0-9._-]+@(?:(?!-)[A-Za-z0-9._-]+|\[[0-9A-Fa-f:.]+\]):(?!\/\/)/;

/** The protocols Claude Code accepts, as the WHATWG URL parser spells them. */
const ACCEPTED_PROTOCOLS: ReadonlySet<string> = new Set([
  "https:",
  "http:",
  "ssh:",
  "file:",
  "git+ssh:",
  "ssh+git:",
]);

const SCP_WITH_SCHEME =
  'Invalid git URL: an address written as user@host:path can\'t contain "://", because git then reads the text before "://" as a protocol name, as in https://. Remove the "://".';

/** An address as a message shows it: its credentials redacted. */
function shown(address: string): string {
  return redactCredentials(address);
}

/** A refusal for a URL Claude Code reads, or undefined when the rule accepts it. */
type UrlRule = (address: string, url: URL) => string | undefined;

function protocolRefusal(address: string, url: URL): string | undefined {
  if (ACCEPTED_PROTOCOLS.has(url.protocol)) {
    return undefined;
  }

  return shown(address) === address
    ? `Invalid git URL protocol: ${url.protocol}. Supported: ${GIT_URL_FORMS}`
    : `Invalid git URL: ${shown(address)}. Supported: ${GIT_URL_FORMS}`;
}

/** The rules that read an address the URL parser accepts, in Claude Code's order. */
const URL_RULES: readonly UrlRule[] = [protocolRefusal];

/** Whether `address` is the scp form `user@host:path` that Claude Code accepts as written. */
export function isScpGitAddress(address: string): boolean {
  return SCP_ADDRESS.test(address);
}

/**
 * D-SG-17: Claude Code's refusal of the git address `address`, or undefined
 * when Claude Code accepts it. It accepts `https`, `http`, `ssh`, `git+ssh`,
 * `ssh+git`, the scp form, and a `file:` URL with no host; it refuses `git://`.
 */
export function gitUrlRefusal(address: string): string | undefined {
  if (isScpGitAddress(address)) {
    return address.includes("://") ? SCP_WITH_SCHEME : undefined;
  }

  if (!URL.canParse(address)) {
    return `Invalid git URL: ${shown(address)} (it could not be read as a URL). Supported: ${GIT_URL_FORMS}`;
  }

  const url = new URL(address);
  for (const rule of URL_RULES) {
    const refusal = rule(address, url);
    if (refusal !== undefined) {
      return refusal;
    }
  }

  return undefined;
}
