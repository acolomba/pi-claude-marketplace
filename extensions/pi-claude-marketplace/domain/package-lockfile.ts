// domain/package-lockfile.ts
//
// PKD-01 / D-PL9-08: checks a plugin's package.json and lockfile before npm or
// bun runs, and rewrites both, the way Claude Code does. A lockfile passes
// only when every package it lists comes from the registry at an exact
// version, with a download link that npm or bun cannot treat as a git
// repository and that sends no registry token over plain http to another
// host. Anything else is a refusal, which the package step turns into a note.
//
// The rewrite keeps only the fields that decide what gets installed, and it
// names the root package `plugin-dependencies` at 0.0.0, so nothing of the
// plugin's own package.json reaches npm or bun but its dependency lists.
//
// One leading byte-order mark is dropped before a lockfile is parsed, as
// Claude Code does (D-PL9-08).
//
// The module is pure: text and objects in, a rewrite or a refusal out.

import { parse, validRange } from "semver";
import stripJsonComments from "strip-json-comments";

import { stripBom } from "../shared/bom.ts";

type JsonObject = Readonly<Record<string, unknown>>;

/** What one lockfile check reads. */
export interface LockfileInput {
  readonly manager: "npm" | "bun";
  /** The lockfile's name in the plugin: package-lock.json, npm-shrinkwrap.json, or bun.lock. */
  readonly lockfileName: string;
  /** The plugin's package.json, already parsed. */
  readonly manifest: Readonly<Record<string, unknown>>;
  readonly lockfileText: string;
  /** npm's registry origin, when it is an http registry; an http link must match it. */
  readonly registryOrigin: string | undefined;
}

/** The files the package manager runs on, and how many packages they list. */
export interface SanitizedLockfile {
  readonly packageCount: number;
  readonly packageJson: Readonly<Record<string, unknown>>;
  /** npm always reads package-lock.json, also for an npm-shrinkwrap.json plugin. */
  readonly lockfileName: "package-lock.json" | "bun.lock";
  readonly lockfile: Readonly<Record<string, unknown>>;
}

export type LockfileCheck =
  { readonly sanitized: SanitizedLockfile } | { readonly refusal: string };

// Thrown by every check below and caught once in sanitizeLockfile.
class LockfileRefusal extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "LockfileRefusal";
  }
}

const ROOT_NAME = "plugin-dependencies";
const ROOT_VERSION = "0.0.0";
const ALL_LISTS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;
const ENTRY_LISTS = ["dependencies", "optionalDependencies", "peerDependencies"] as const;
const ENTRY_FLAGS = ["dev", "optional", "devOptional", "peer"] as const;
const PLATFORM_LISTS = ["os", "cpu", "libc"] as const;
const BUN_LOCKFILE_VERSIONS: readonly unknown[] = [0, 1, 2];
const INTEGRITY_TOKEN = /^(sha512|sha384|sha256|sha1)-[A-Za-z0-9+/]+={0,2}$/;
const SCOPED_NAME = /^@[a-z0-9][a-z0-9-._]*\/[a-z0-9][a-z0-9-._]*$/;
const UNSCOPED_NAME = /^[a-z0-9][a-z0-9-._]*$/;
const DIST_TAG = /^[a-z0-9][a-z0-9._-]{0,127}$/i;
// Claude Code's pattern, whose middle dot matches any character.
const TARBALL_SPEC = /\.(?:tgz|tar.gz|tar)$/i;
const HTTP_LINK = /^https?:\/\//i;
const UNSAFE_LINK_CHARACTER = /[\s#\\]/;
const FORGE_HOSTS: ReadonlySet<string> = new Set([
  // eslint-disable-next-line local/no-github-literal -- a parser host comparison
  "github.com",
  // eslint-disable-next-line local/no-github-literal -- a parser host comparison
  "gist.github.com",
  "gitlab.com",
  "bitbucket.org",
  "git.sr.ht",
]);
const MESSAGE_CUT = 120;

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cut(text: string): string {
  return text.slice(0, MESSAGE_CUT);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

// Only A-Z is lowered: a full toLowerCase would turn some non-ASCII letters
// into ASCII ones that the patterns accept.
function isNpmName(name: string): boolean {
  const lowered = name.replaceAll(/[A-Z]/g, (letter) => letter.toLowerCase());
  return (
    !lowered.includes("..") &&
    !lowered.includes("//") &&
    (SCOPED_NAME.test(lowered) || UNSCOPED_NAME.test(lowered))
  );
}

function isRangeOrTag(spec: string): boolean {
  return !TARBALL_SPEC.test(spec) && (validRange(spec) !== null || DIST_TAG.test(spec));
}

// A range, a dist-tag, or an `npm:<name>@<range>` alias.
function isRegistrySpec(spec: unknown): boolean {
  if (typeof spec !== "string") {
    return false;
  }

  const alias = spec.startsWith("npm:") ? spec.slice(4) : "";
  const at = alias.lastIndexOf("@");
  if (at < 1) {
    return isRangeOrTag(spec);
  }

  return isNpmName(alias.slice(0, at)) && isRangeOrTag(alias.slice(at + 1));
}

function isExactVersion(version: unknown): version is string {
  return typeof version === "string" && parse(version) !== null;
}

function readLists(
  source: JsonObject,
  fields: readonly string[],
  label: string,
): Record<string, JsonObject> {
  const lists: Record<string, JsonObject> = {};
  for (const field of fields) {
    const list = source[field];
    if (list === undefined) {
      continue;
    }

    if (!isPlainObject(list)) {
      throw new LockfileRefusal(`${label} has an unreadable ${field} list`);
    }

    const unsafe = Object.entries(list).find(
      ([name, spec]) => !isNpmName(name) || !isRegistrySpec(spec),
    );
    if (unsafe !== undefined) {
      throw new LockfileRefusal(
        `${label} has a dependency that is not a registry package and version range: ${cut(unsafe[0])}`,
      );
    }

    lists[field] = list;
  }

  return lists;
}

// The optional dependencies npm also lists under dependencies, which the
// lockfile root lists once.
function withoutOptionalNames(
  lists: Record<string, JsonObject>,
  fields: readonly string[],
): Record<string, JsonObject> {
  const optional = lists.optionalDependencies;
  if (optional === undefined) {
    return lists;
  }

  const kept = { ...lists };
  for (const field of fields) {
    const list = lists[field];
    if (list !== undefined) {
      kept[field] = Object.fromEntries(
        Object.entries(list).filter(([name]) => !Object.hasOwn(optional, name)),
      );
    }
  }

  return kept;
}

// Object keys are never equal, so the order never needs a 0.
function byName([left]: readonly [string, unknown], [right]: readonly [string, unknown]): number {
  return left < right ? -1 : 1;
}

function listsKey(lists: Record<string, JsonObject>): string {
  return JSON.stringify(ALL_LISTS.map((field) => Object.entries(lists[field] ?? {}).sort(byName)));
}

function normalizePeerMeta(meta: JsonObject): Record<string, { optional: boolean }> {
  const normalized: Record<string, { optional: boolean }> = {};
  for (const [name, value] of Object.entries(meta)) {
    if (isNpmName(name) && isPlainObject(value)) {
      normalized[name] = { optional: value.optional === true };
    }
  }

  return normalized;
}

// The root's dependency lists, which must be the lists package.json declares.
function rootDependencies(
  root: JsonObject,
  manifest: JsonObject,
  lockfileName: string,
): Record<string, JsonObject> {
  const locked = readLists(root, ALL_LISTS, `its ${lockfileName}`);
  const filtered =
    lockfileName === "bun.lock" ? ["dependencies", "devDependencies"] : ["dependencies"];
  const declared = withoutOptionalNames(
    readLists(manifest, ALL_LISTS, "its package.json"),
    filtered,
  );
  if (listsKey(locked) !== listsKey(declared)) {
    throw new LockfileRefusal(`its package.json and ${lockfileName} list different dependencies`);
  }

  return locked;
}

function peerMetaOf(manifest: JsonObject): Record<string, unknown> {
  const meta = manifest.peerDependenciesMeta;
  return isPlainObject(meta) ? { peerDependenciesMeta: normalizePeerMeta(meta) } : {};
}

function checkedIntegrity(value: unknown, label: string, hasLink: boolean): string {
  if (value === "") {
    throw new LockfileRefusal(
      hasLink
        ? `${label} has no integrity hash for its download link`
        : `${label} has an empty integrity hash`,
    );
  }

  if (
    typeof value !== "string" ||
    !value.split(" ").every((token) => INTEGRITY_TOKEN.test(token))
  ) {
    throw new LockfileRefusal(`${label} has an unreadable integrity hash`);
  }

  return value;
}

function isBinPath(binPath: string): boolean {
  return (
    binPath !== "" &&
    !binPath.startsWith("/") &&
    !/[\\:]/.test(binPath) &&
    !binPath.split("/").includes("..")
  );
}

function isBinName(name: string): boolean {
  return name !== "" && name !== "." && name !== ".." && !/[\\/:]/.test(name);
}

function isBin(value: unknown): boolean {
  if (typeof value === "string") {
    return isBinPath(value);
  }

  return (
    isPlainObject(value) &&
    Object.entries(value).every(
      ([name, target]) => isBinName(name) && typeof target === "string" && isBinPath(target),
    )
  );
}

function checkedBin(value: unknown, label: string): unknown {
  if (!isBin(value)) {
    throw new LockfileRefusal(
      `${label} has a bin link that points outside its package or has an invalid command name`,
    );
  }

  return value;
}

function checkedOptionalPeers(value: unknown, label: string): readonly string[] {
  if (!isStringArray(value)) {
    throw new LockfileRefusal(`${label} has an unreadable optionalPeers list`);
  }

  const unsafe = value.find((name) => !isNpmName(name));
  if (unsafe !== undefined) {
    throw new LockfileRefusal(
      `${label} has an optional peer that is not a registry package: ${cut(unsafe)}`,
    );
  }

  return value;
}

function hasControlCharacter(text: string): boolean {
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code < 32 || code === 127) {
      return true;
    }
  }

  return false;
}

// One trailing dot goes, then every leading `www.`.
function forgeHostname(hostname: string): string {
  let host = hostname.endsWith(".") ? hostname.slice(0, -1) : hostname;
  while (host.startsWith("www.")) {
    host = host.slice(4);
  }

  return host;
}

// GitLab's package API serves tarballs under /api/v4/.../-/..., which is not a
// repository link.
function isForgeLink(url: URL): boolean {
  const host = forgeHostname(url.hostname);
  const isGitLabPackage =
    host === "gitlab.com" && url.pathname.startsWith("/api/v4/") && url.pathname.includes("/-/");
  return FORGE_HOSTS.has(host) && !isGitLabPackage;
}

function linkProblem(
  link: string,
  manager: "npm" | "bun",
  registryOrigin: string | undefined,
): string | undefined {
  if (!HTTP_LINK.test(link) || !URL.canParse(link)) {
    return "is not an http or https link";
  }

  if (UNSAFE_LINK_CHARACTER.test(link) || hasControlCharacter(link)) {
    return 'contains a "#", whitespace, a backslash or a control character';
  }

  const url = new URL(link);
  if (isForgeLink(url)) {
    return `is on GitHub, GitLab, Bitbucket or SourceHut, where ${manager} may fetch it as a git repository and run its setup script`;
  }

  if (url.pathname.startsWith("//")) {
    return 'starts its path with "//"';
  }

  if (url.protocol === "http:" && url.origin !== registryOrigin) {
    return `is an unencrypted http link on a host other than your npm registry, so ${manager} could send your saved registry token to it in the clear`;
  }

  return undefined;
}

function checkedLink(
  link: unknown,
  label: string,
  manager: "npm" | "bun",
  registryOrigin: string | undefined,
): unknown {
  const problem =
    typeof link === "string" ? linkProblem(link, manager, registryOrigin) : "is not text";
  if (problem !== undefined) {
    throw new LockfileRefusal(`${label} has a download link that ${problem}`);
  }

  return link;
}

function keptPlatformLists(
  source: JsonObject,
  label: string,
  acceptsText: boolean,
): Record<string, unknown> {
  const kept: Record<string, unknown> = {};
  for (const field of PLATFORM_LISTS) {
    const list = source[field];
    if (list === undefined) {
      continue;
    }

    if (!isStringArray(list) && !(acceptsText && typeof list === "string")) {
      throw new LockfileRefusal(`${label} has an unreadable ${field} list`);
    }

    kept[field] = list;
  }

  return kept;
}

function parsedObject(text: string, lockfileName: string): JsonObject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripBom(text));
  } catch {
    // JSON.parse throws only a SyntaxError for text it cannot read.
    throw new LockfileRefusal(`its ${lockfileName} is not valid JSON`);
  }

  if (!isPlainObject(parsed)) {
    throw new LockfileRefusal(`its ${lockfileName} is not a JSON object`);
  }

  return parsed;
}

function isNodeModulesPath(key: string): boolean {
  return key.startsWith("node_modules/") && key.slice(13).split("/node_modules/").every(isNpmName);
}

// An npm entry's version and name, after the checks on what the entry is.
function npmEntryIdentity(value: JsonObject, label: string): Record<string, unknown> {
  if (value.link !== undefined || value.inBundle !== undefined) {
    throw new LockfileRefusal(`${label} is a folder link or a bundled copy`);
  }

  if (!isExactVersion(value.version)) {
    throw new LockfileRefusal(`${label} has no exact version`);
  }

  const { name } = value;
  if (name === undefined) {
    return { version: value.version };
  }

  if (typeof name !== "string" || !isNpmName(name)) {
    throw new LockfileRefusal(`${label} has a name that is not an npm package name`);
  }

  return { version: value.version, name };
}

function npmEntrySource(
  value: JsonObject,
  label: string,
  registryOrigin: string | undefined,
): Record<string, unknown> {
  const kept: Record<string, unknown> = {};
  if (value.resolved !== undefined) {
    kept.resolved = checkedLink(value.resolved, label, "npm", registryOrigin);
    if (value.integrity === undefined) {
      throw new LockfileRefusal(`${label} has no integrity hash for its download link`);
    }
  }

  if (value.integrity !== undefined) {
    kept.integrity = checkedIntegrity(value.integrity, label, value.resolved !== undefined);
  }

  return kept;
}

function npmEntry(
  key: string,
  value: unknown,
  lockfileName: string,
  registryOrigin: string | undefined,
): Record<string, unknown> {
  const label = `its ${lockfileName} entry "${cut(key)}"`;
  if (!isNodeModulesPath(key)) {
    throw new LockfileRefusal(`${label} is not a package in node_modules`);
  }

  if (!isPlainObject(value)) {
    throw new LockfileRefusal(`${label} is not an object`);
  }

  const entry = npmEntryIdentity(value, label);
  Object.assign(entry, npmEntrySource(value, label, registryOrigin));
  Object.assign(entry, readLists(value, ENTRY_LISTS, label));
  for (const flag of ENTRY_FLAGS) {
    if (value[flag] === true) {
      entry[flag] = true;
    }
  }

  Object.assign(entry, keptPlatformLists(value, label, false));
  if (value.bin !== undefined) {
    entry.bin = checkedBin(value.bin, label);
  }

  if (isPlainObject(value.peerDependenciesMeta)) {
    entry.peerDependenciesMeta = normalizePeerMeta(value.peerDependenciesMeta);
  }

  return entry;
}

function sanitizeNpm(input: LockfileInput): SanitizedLockfile {
  const { lockfileName, manifest } = input;
  const lock = parsedObject(input.lockfileText, lockfileName);
  if (lock.lockfileVersion !== 2 && lock.lockfileVersion !== 3) {
    throw new LockfileRefusal(
      `its ${lockfileName} is in an old format; regenerate it with npm 7 or later`,
    );
  }

  if (manifest.overrides !== undefined) {
    throw new LockfileRefusal("its package.json sets overrides, which this install does not apply");
  }

  const { packages } = lock;
  const root = isPlainObject(packages) ? packages[""] : undefined;
  if (!isPlainObject(packages) || !isPlainObject(root)) {
    throw new LockfileRefusal(`its ${lockfileName} has no packages section with the plugin in it`);
  }

  const dependencies = {
    ...rootDependencies(root, manifest, lockfileName),
    ...peerMetaOf(manifest),
  };
  const entries: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(packages)) {
    if (key !== "") {
      entries[key] = npmEntry(key, value, lockfileName, input.registryOrigin);
    }
  }

  return {
    packageCount: Object.keys(entries).length,
    packageJson: { name: ROOT_NAME, version: ROOT_VERSION, ...dependencies },
    lockfileName: "package-lock.json",
    lockfile: {
      name: ROOT_NAME,
      version: ROOT_VERSION,
      lockfileVersion: 3,
      requires: true,
      packages: { "": { name: ROOT_NAME, version: ROOT_VERSION, ...dependencies }, ...entries },
    },
  };
}

// bun.lock is JSON with trailing commas. A comment is refused, as Claude Code
// refuses it.
function parsedBunLockfile(markedText: string): JsonObject {
  const text = stripBom(markedText);
  if (stripJsonComments(text, { trailingCommas: false }) !== text) {
    throw new LockfileRefusal("its bun.lock is not valid JSON");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonComments(text, { trailingCommas: true }));
  } catch {
    // JSON.parse throws only a SyntaxError for text it cannot read.
    throw new LockfileRefusal("its bun.lock is not valid JSON");
  }

  if (!isPlainObject(parsed)) {
    throw new LockfileRefusal("its bun.lock is not valid JSON");
  }

  return parsed;
}

// A bun package path joins each `@scope` part to the part after it.
function isBunPackagePath(key: string): boolean {
  const names: string[] = [];
  let scope: string | undefined;
  for (const part of key.split("/")) {
    if (scope !== undefined) {
      names.push(`${scope}/${part}`);
      scope = undefined;
    } else if (part.startsWith("@")) {
      scope = part;
    } else {
      names.push(part);
    }
  }

  if (scope !== undefined) {
    names.push(scope);
  }

  return names.every(isNpmName);
}

function isRegistryIdent(ident: unknown): ident is string {
  if (typeof ident !== "string") {
    return false;
  }

  const at = ident.lastIndexOf("@");
  return at >= 1 && isNpmName(ident.slice(0, at)) && isExactVersion(ident.slice(at + 1));
}

function bunMeta(meta: JsonObject, label: string): Record<string, unknown> {
  const kept: Record<string, unknown> = {
    ...readLists(meta, ENTRY_LISTS, label),
    ...keptPlatformLists(meta, label, true),
  };
  if (meta.optionalPeers !== undefined) {
    kept.optionalPeers = checkedOptionalPeers(meta.optionalPeers, label);
  }

  if (meta.bin !== undefined) {
    kept.bin = checkedBin(meta.bin, label);
  }

  if (meta.binDir !== undefined) {
    if (typeof meta.binDir !== "string" || !isBinPath(meta.binDir)) {
      throw new LockfileRefusal(`${label} has a bin folder outside its package`);
    }

    kept.binDir = meta.binDir;
  }

  return kept;
}

function bunEntry(key: string, value: unknown, registryOrigin: string | undefined): unknown[] {
  const label = `its bun.lock entry "${cut(key)}"`;
  if (!isBunPackagePath(key)) {
    throw new LockfileRefusal(`${label} is not a package path`);
  }

  if (!Array.isArray(value) || value.length !== 4) {
    throw new LockfileRefusal(`${label} is not a registry package`);
  }

  const fields: readonly unknown[] = value;
  const [ident, resolved, meta, integrity] = fields;
  if (!isRegistryIdent(ident)) {
    throw new LockfileRefusal(`${label} is not a registry package at an exact version`);
  }

  if (resolved !== "") {
    checkedLink(resolved, label, "bun", registryOrigin);
  }

  if (!isPlainObject(meta)) {
    throw new LockfileRefusal(`${label} has unreadable metadata`);
  }

  return [
    ident,
    resolved,
    bunMeta(meta, label),
    checkedIntegrity(integrity, label, resolved !== ""),
  ];
}

function bunWorkspace(lock: JsonObject): JsonObject {
  const { workspaces } = lock;
  const workspace = isPlainObject(workspaces) ? workspaces[""] : undefined;
  if (
    !isPlainObject(workspaces) ||
    !isPlainObject(workspace) ||
    Object.keys(workspaces).length !== 1
  ) {
    throw new LockfileRefusal("its bun.lock does not list the plugin as its only workspace");
  }

  return workspace;
}

function sanitizeBun(input: LockfileInput): SanitizedLockfile {
  const { manifest } = input;
  const lock = parsedBunLockfile(input.lockfileText);
  if (!BUN_LOCKFILE_VERSIONS.includes(lock.lockfileVersion)) {
    throw new LockfileRefusal("its bun.lock is in a format this extension does not read");
  }

  if (lock.patchedDependencies !== undefined || manifest.patchedDependencies !== undefined) {
    throw new LockfileRefusal(
      "it patches its dependencies (patchedDependencies), which this install does not apply",
    );
  }

  const workspace = bunWorkspace(lock);
  const { packages } = lock;
  if (!isPlainObject(packages)) {
    throw new LockfileRefusal("its bun.lock lists no packages");
  }

  const workspaceLists = rootDependencies(workspace, manifest, "bun.lock");
  const workspaceEntry: Record<string, unknown> = { name: ROOT_NAME, ...workspaceLists };
  if (workspace.optionalPeers !== undefined) {
    workspaceEntry.optionalPeers = checkedOptionalPeers(workspace.optionalPeers, "its bun.lock");
  }

  const entries: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(packages)) {
    entries[key] = bunEntry(key, value, input.registryOrigin);
  }

  return {
    packageCount: Object.keys(entries).length,
    packageJson: {
      name: ROOT_NAME,
      version: ROOT_VERSION,
      ...workspaceLists,
      ...peerMetaOf(manifest),
    },
    lockfileName: "bun.lock",
    lockfile: {
      lockfileVersion: lock.lockfileVersion,
      ...(typeof lock.configVersion === "number" && { configVersion: lock.configVersion }),
      workspaces: { "": workspaceEntry },
      packages: entries,
    },
  };
}

/**
 * Checks a plugin's package.json and lockfile and returns the rewritten files
 * the package manager runs on, or the reason it must not run. Lockfile
 * content never throws.
 */
export function sanitizeLockfile(input: LockfileInput): LockfileCheck {
  try {
    return { sanitized: input.manager === "npm" ? sanitizeNpm(input) : sanitizeBun(input) };
  } catch (error: unknown) {
    if (error instanceof LockfileRefusal) {
      return { refusal: error.message };
    }

    throw error;
  }
}
