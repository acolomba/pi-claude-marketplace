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
// in for Claude Code's display helpers), and a control character shows as
// its `\u` escape. The `file:` rule keeps the observable part of Claude
// Code's network-path test: a host, or a path that starts with two slashes
// or backslashes, is refused (assumption A2). Each rule is a small function
// with its patterns named, under the cognitive limit (Pitfall 11).

import { redactCredentials } from "../shared/redact-credentials.ts";

/** Claude Code's list of the accepted forms, which ends every protocol refusal. */
const GIT_URL_FORMS =
  "https, http, ssh (also written git+ssh or ssh+git), user@host:path, or a local file:// address with no host. git:// isn't supported because it isn't encrypted.";

/**
 * Claude Code's scp form: a user and a host, neither starting with `-`, then
 * a `:` that no `//` follows. A bracketed IPv6 literal may stand for the host.
 */
const SCP_ADDRESS = /^(?!-)[A-Za-z0-9._-]+@(?:(?!-)[A-Za-z0-9._-]+|\[[0-9A-Fa-f:.]+\]):(?!\/\/)/;

/** The host of an ssh URL: a hostname that does not start with `-`, or a bracketed IPv6 literal. */
const SSH_HOST = /^(?:(?!-)[A-Za-z0-9._-]+|\[[0-9A-Fa-f:.]+\])$/;

/** The user of an ssh URL: a plain name that does not start with `-`. */
const SSH_USER = /^(?!-)[A-Za-z0-9._-]+$/;

/** The protocols Claude Code accepts, as the WHATWG URL parser spells them. */
const ACCEPTED_PROTOCOLS: ReadonlySet<string> = new Set([
  "https:",
  "http:",
  "ssh:",
  "file:",
  "git+ssh:",
  "ssh+git:",
]);

const SSH_PROTOCOLS: ReadonlySet<string> = new Set(["ssh:", "git+ssh:", "ssh+git:"]);

/** The DEL character, the one control character above the C0 range. */
const DELETE_CODE = 0x7f;

/** A scheme spelled with its `//`, such as `ssh://`; a bracket rule reads its name. */
const SCHEME_WITH_SLASHES = /^([A-Za-z0-9][A-Za-z0-9+.-]*):\/\//;

/** A scheme URL as Claude Code requires it spelled: `scheme://`. */
const SPELLED_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/** The authority of a scheme URL: the text between `scheme://` and the first `/`. */
const URL_AUTHORITY = /^[a-z][a-z0-9+.-]*:\/\/([^/]*)/i;

/** A port that ends an authority, such as `:2222`. */
const AUTHORITY_PORT = /:\d{1,5}$/;

/** A bracketed IPv6 host after an optional user in a URL's authority, with an optional port. */
const URL_BRACKET_HOST = /^(?:[^@/?#\\[\]]+@)?(\[[0-9A-Fa-f:.]+\])(?::\d*)?(?=\/|$)/;

/** A bracketed IPv6 host after the user of an scp address. */
const SCP_BRACKET_HOST = /^[^@:/[\]]+@(\[[0-9A-Fa-f:.]+\])(?=:)/;

/** A local path that starts with a drive letter, such as `C:`. */
const DRIVE_LETTER = /^[A-Za-z]:/;

/** A `file:` URL whose `//` a host follows: `file://host/...`. */
const FILE_HOST = /^file:\/\/[^/\\]/i;

/** A `file:` URL with a backslash among the separators after its scheme. */
const FILE_BACKSLASH = /^file:[\\/]*\\/i;

/** A `file:` URL that names a drive letter, which Claude Code's message explains. */
const FILE_DRIVE = /^file:\/\/[a-z]:/i;

/** A path that starts with two separators, as a network or device path does. */
const NETWORK_PATH = /^[\\/]{2}/;

const SCP_WITH_SCHEME =
  'Invalid git URL: an address written as user@host:path can\'t contain "://", because git then reads the text before "://" as a protocol name, as in https://. Remove the "://".';

/** Whether `character` is a C0 control character or DEL. */
function isControlCharacter(character: string): boolean {
  const code = character.charCodeAt(0);
  return code < 0x20 || code === DELETE_CODE;
}

/** An address as a message shows it: its credentials redacted, its control characters escaped. */
function shown(address: string): string {
  return Array.from(redactCredentials(address), (character) =>
    isControlCharacter(character)
      ? `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`
      : character,
  ).join("");
}

/** `address` with everything from its first `?` or `#` on masked, as an ssh refusal shows it. */
function maskedQuery(address: string): string {
  const start = address.search(/[?#]/);
  return start === -1 ? address : `${address.slice(0, start + 1)}***`;
}

/** A refusal Claude Code gives before it parses an address, or undefined when the rule accepts it. */
type AddressRule = (address: string) => string | undefined;

/** A refusal for a URL Claude Code reads, or undefined when the rule accepts it. */
type UrlRule = (address: string, url: URL) => string | undefined;

function controlCharacterRefusal(address: string): string | undefined {
  return Array.from(address).some((character) => isControlCharacter(character))
    ? `Invalid git URL: ${shown(address)} \u2014 control characters are not allowed`
    : undefined;
}

function nulRefusal(address: string): string | undefined {
  return address.includes("%00")
    ? `Invalid git URL: ${shown(address)} \u2014 "%00" in a git address means different things to different versions of git, so it is not allowed. Remove it.`
    : undefined;
}

/** `text` with each `%5B` and `%5D` read as the bracket it encodes. */
function decodedBrackets(text: string): string {
  return text.replace(/%5b/gi, "[").replace(/%5d/gi, "]");
}

/**
 * Whether the text after the scheme names a server. Every scheme but `file`
 * does; with no scheme, an scp-like `host:path` does unless the `:` comes
 * after a `/` or is a drive letter's.
 */
function namesServer(scheme: string | undefined, rest: string): boolean {
  if (scheme !== undefined) {
    return scheme.toLowerCase() !== "file";
  }

  const colon = rest.indexOf(":");
  const slash = rest.indexOf("/");
  return colon !== -1 && (slash === -1 || colon < slash) && !DRIVE_LETTER.test(rest);
}

/** Whether a server address holds a bracket other than the pair around its IPv6 host. */
function serverHasStrayBracket(withScheme: boolean, rest: string): boolean {
  const decoded = decodedBrackets(rest);
  const host = (withScheme ? URL_BRACKET_HOST : SCP_BRACKET_HOST).exec(decoded);
  const literal = host?.[1];
  const skipped =
    host !== null && literal !== undefined && URL.canParse(`ssh://${literal}/`)
      ? host[0].length
      : 0;
  return /[[\]]/.test(decoded.slice(skipped));
}

/**
 * Whether git could read a bracket of `address` as marking a host or where a
 * local path starts: a server address may hold brackets only around its IPv6
 * host, and a local path may not start with one or hold `@[`.
 */
function hasStrayBracket(address: string): boolean {
  const trimmed = address.replace(/^ +/, "");
  const scheme = SCHEME_WITH_SLASHES.exec(trimmed);
  const rest = scheme === null ? trimmed : trimmed.slice(scheme[0].length);
  if (namesServer(scheme?.[1], rest)) {
    return serverHasStrayBracket(scheme !== null, rest);
  }

  const local = scheme === null ? rest : decodedBrackets(rest);
  return local.includes("@[") || local.startsWith("[");
}

function bracketRefusal(address: string): string | undefined {
  return hasStrayBracket(address)
    ? `Invalid git URL: ${shown(address)} \u2014 git can read a square bracket (also written %5B or %5D) as marking a server name or where a local path starts, so it could connect to a different server or open a different folder than this address names. In a server address, brackets may only surround an IPv6 address, as in git@[2001:db8::1]:repo.git. Remove them, or rename the folder whose name has them.`
    : undefined;
}

/** The rules that read any address, in Claude Code's order. */
const ADDRESS_RULES: readonly AddressRule[] = [controlCharacterRefusal, nulRefusal, bracketRefusal];

function protocolRefusal(address: string, url: URL): string | undefined {
  if (ACCEPTED_PROTOCOLS.has(url.protocol)) {
    return undefined;
  }

  return shown(address) === address
    ? `Invalid git URL protocol: ${url.protocol}. Supported: ${GIT_URL_FORMS}`
    : `Invalid git URL: ${shown(address)}. Supported: ${GIT_URL_FORMS}`;
}

/** Whether a backslash comes before the first `/` of the authority, which git and URL parsers read differently. */
function hasAuthorityBackslash(address: string): boolean {
  const afterScheme = address.slice(address.indexOf(":") + 1);
  const authorityAndPath = afterScheme.startsWith("//") ? afterScheme.slice(2) : afterScheme;
  const slash = authorityAndPath.indexOf("/");
  return (slash === -1 ? authorityAndPath : authorityAndPath.slice(0, slash)).includes("\\");
}

function backslashRefusal(address: string, url: URL): string | undefined {
  const web = url.protocol === "https:" || url.protocol === "http:";
  return web && hasAuthorityBackslash(address)
    ? `Invalid git URL: ${shown(address)} \u2014 a backslash before the first "/" can make git connect to a different server than this address names. Remove it, or write it as %5C if it is part of a user name.`
    : undefined;
}

/** Whether an ssh URL's host is a hostname or a bracketed IPv6 literal, with an optional port, and its user a plain name. */
function hasPlainSshAuthority(address: string): boolean {
  const authority = URL_AUTHORITY.exec(address)?.[1] ?? "";
  const at = authority.lastIndexOf("@");
  const hostAndPort = at === -1 ? authority : authority.slice(at + 1);
  const userValid = at === -1 || SSH_USER.test(authority.slice(0, at));
  return userValid && SSH_HOST.test(hostAndPort.replace(AUTHORITY_PORT, ""));
}

function sshRefusal(address: string, url: URL): string | undefined {
  if (!SSH_PROTOCOLS.has(url.protocol)) {
    return undefined;
  }

  if (!/[?#]/.test(address) && hasPlainSshAuthority(address)) {
    return undefined;
  }

  const masked = maskedQuery(shown(address));
  return `Invalid ssh git URL: the host must be a hostname or bracketed IPv6 literal (optionally :port), the user a plain name, and the URL may not carry ? or # (${masked})`;
}

function schemeSpellingRefusal(address: string): string | undefined {
  return SPELLED_SCHEME.test(address)
    ? undefined
    : `Invalid git URL: ${shown(address)} \u2014 a scheme URL must be spelled scheme://\u2026`;
}

/** The path of a `file:` URL after its `file://`, decoded; a malformed escape reads as a network path. */
function decodedFilePath(address: string): string {
  try {
    return decodeURIComponent(address.replace(/^file:\/\//i, ""));
  } catch {
    return "//malformed-percent-encoding";
  }
}

function namesNetworkFile(address: string, url: URL): boolean {
  return (
    url.host !== "" ||
    FILE_HOST.test(address) ||
    FILE_BACKSLASH.test(address) ||
    NETWORK_PATH.test(decodedFilePath(address))
  );
}

function fileRefusal(address: string, url: URL): string | undefined {
  if (url.protocol !== "file:" || !namesNetworkFile(address, url)) {
    return undefined;
  }

  const drive = FILE_DRIVE.test(address)
    ? " A drive letter such as C: counts as a local path only on Windows."
    : "";
  return `Refusing git URL ${shown(address)}: a file: URL must name a local path (no host, no network-shaped path).${drive}`;
}

/** The rules that read an address the URL parser accepts, in Claude Code's order. */
const URL_RULES: readonly UrlRule[] = [
  protocolRefusal,
  backslashRefusal,
  sshRefusal,
  schemeSpellingRefusal,
  fileRefusal,
];

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
  for (const rule of ADDRESS_RULES) {
    const refusal = rule(address);
    if (refusal !== undefined) {
      return refusal;
    }
  }

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
