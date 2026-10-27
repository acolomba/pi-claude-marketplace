// domain/name.ts
//
// Pure name validation (RN-2) and generated-name helpers (RN-1) per PRD
// §6.5. THREE different rules per resource type, split into three explicit
// functions (one shared helper that handled all three was a recurring bug
// surface).

import { createHash } from "node:crypto";

import { commandNamespaceSeparator } from "../platform/os.ts";
import {
  errorMessage,
  ReservedMarketplaceNameError,
  UnsafeGeneratedNameError,
} from "../shared/errors.ts";

import type { ParsedSource } from "./source.ts";

/**
 * RN-2: validate that a name is safe to use as a path basename / generated
 * resource name. Throws Error with descriptive message on failure.
 *
 * Rules (verbatim from PRD §6.5):
 *   - non-empty after trim
 *   - not "." or ".."
 *   - no path separators ("/" or "\\")
 *   - no ASCII control chars (charCode < 0x20 or === 0x7f)
 *
 * The optional `label` argument is prepended to error messages
 * (e.g. `assertSafeName(skill.generatedName, "generated skill name")` -->
 * `generated skill name "..." must not contain path separators.`). When
 * omitted, messages use the capitalized "Name" form.
 */
export function assertSafeName(name: string, label?: string): void {
  // When `label` is provided, prepend it (lowercase form for sentence-flow);
  // when omitted, fall back to "Name".
  const prefix = label === undefined ? "Name " : `${label} `;

  if (typeof name !== "string") {
    throw new TypeError(`${prefix}must be a string (got ${typeof name}).`);
  }

  if (name.trim() === "") {
    throw new Error(`${prefix}must be a non-empty string.`);
  }

  if (name === "." || name === "..") {
    throw new Error(`${prefix}must not be "." or "..".`);
  }

  if (name.includes("/") || name.includes("\\")) {
    throw new Error(`${prefix}"${name}" must not contain path separators.`);
  }

  for (let i = 0; i < name.length; i++) {
    // `codePointAt` types `number | undefined`; `Number()` folds the
    // out-of-range `undefined` (impossible here: i < name.length) to NaN,
    // which fails both comparisons, without adding an unreachable branch.
    const code = Number(name.codePointAt(i));

    if (code < 0x20 || code === 0x7f) {
      throw new Error(`${prefix}"${name}" must not contain ASCII control characters.`);
    }
  }
}

/**
 * D-08-07: whether `name` is a state map key that a bracket write turns into a
 * prototype change. Every state read and write uses own keys, so `constructor`,
 * `toString` and the other `Object.prototype` names stay valid names.
 */
export function isReservedRecordKey(name: string): boolean {
  return name === "__proto__";
}

/**
 * The official marketplace names of Claude Code 2.1.291, copied
 * from the binary. Upstream lowercases a marketplace name before it checks
 * this set.
 */
export const OFFICIAL_MARKETPLACE_NAMES: ReadonlySet<string> = new Set([
  "claude-code-marketplace",
  "claude-code-plugins",
  "claude-plugins-official",
  "anthropic-marketplace",
  "anthropic-plugins",
  "agent-skills",
  "anthropic-agent-skills",
  "life-sciences",
  "knowledge-work-plugins",
  "claude-for-legal",
  "claude-for-financial-services",
  "financial-services-plugins",
  "first-party-plugins",
  "claude-tag-plugins",
]);

/**
 * MKT-01: the marketplace names Claude Code 2.1.310 reserves for the
 * anthropics GitHub organization, the official names plus the community and
 * plugin-directory names.
 */
const RESERVED_MARKETPLACE_NAMES: ReadonlySet<string> = new Set([
  ...OFFICIAL_MARKETPLACE_NAMES,
  "claude-community",
  "claude-plugins-community",
  "healthcare",
  "anthropic-plugin-directory",
  "claude-plugin-directory",
]);

/**
 * MKT-01 / D-PL5-01 / D-PL5-02: Claude Code's refusal of a reserved
 * marketplace `name` declared by a manifest from `source`, or undefined when
 * the name is not reserved or the source is a github repository of the
 * anthropics organization. Both comparisons ignore case, as upstream's do.
 */
export function reservedMarketplaceNameRefusal(
  name: string,
  source: ParsedSource,
): string | undefined {
  if (!RESERVED_MARKETPLACE_NAMES.has(name.toLowerCase())) {
    return undefined;
  }

  if (source.kind === "github" && source.owner.toLowerCase() === "anthropics") {
    return undefined;
  }

  return source.kind === "github" || source.kind === "url"
    ? // eslint-disable-next-line local/no-github-literal -- GHB-02: Claude Code's user-facing refusal names github.com verbatim
      `The name '${name}' is reserved for official Anthropic marketplaces. Only repositories from 'github.com/anthropics/' can use this name.`
    : `The name '${name}' is reserved for official Anthropic marketplaces and can only be used with GitHub sources from the 'anthropics' organization.`;
}

/**
 * MKT-01 / D-PL5-28: Claude Code's refusal of the marketplace `name` a
 * manifest declares to `marketplace add`, or undefined when Claude Code 2.1.310
 * accepts it. The rules run in Claude Code's add order: a look-alike or one of
 * Claude Code's own names, the reserved set (D-PL5-01), the `claudeai-` prefix,
 * another spelling of a reserved name, and an `Object.prototype` member.
 *
 * `repairedName` is the record a re-materialized checkout repairs (D-PL5-17),
 * which grandfathers a soft look-alike that keeps its name. `recorded` says the
 * scope already records `name`, which Claude Code exempts from the member rule.
 */
export function addedMarketplaceNameRefusal(
  name: string,
  source: ParsedSource,
  registration: { readonly repairedName: string | undefined; readonly recorded: boolean },
): string | undefined {
  return (
    catalogMarketplaceNameRefusal(name, registration.repairedName) ??
    reservedMarketplaceNameRefusal(name, source) ??
    claudeaiPrefixRefusal(name) ??
    spellingRefusal(name) ??
    objectMemberRefusal(name, registration.recorded)
  );
}

const IMPERSONATION_REFUSAL =
  "Marketplace name impersonates an official Anthropic/Claude marketplace";

/**
 * MKT-01 / D-PL5-28: the refusal of a catalog that declares `declaredName`,
 * read for the marketplace registered as `registeredName` (undefined for a new
 * add): a look-alike, then one of Claude Code's own names. Claude Code runs both
 * rules on every catalog it parses.
 */
export function catalogMarketplaceNameRefusal(
  declaredName: string,
  registeredName: string | undefined,
): string | undefined {
  return isRefusedLookalike(declaredName, registeredName)
    ? IMPERSONATION_REFUSAL
    : ownNameRefusal(declaredName);
}

const OFFICIAL_WORDS = ["marketplace", "plugins", "official"];

const LOOKALIKE_WORDS = [...OFFICIAL_WORDS, "directory", "directories"];

const OFFICIAL_PATTERN =
  "official[^a-z0-9]*(anthropic|claude)|(?:anthropic|claude)[^a-z0-9]*official";

function lookalikePattern(words: readonly string[]): RegExp {
  return new RegExp(
    `(?:${OFFICIAL_PATTERN}|^(?:anthropic|claude)[^a-z0-9]*(${words.join("|")}))`,
    "i",
  );
}

const LOOKALIKE = lookalikePattern(LOOKALIKE_WORDS);

const STRONG_LOOKALIKE = lookalikePattern(OFFICIAL_WORDS);

const OUTSIDE_PRINTABLE_ASCII = /[^\u0020-\u007E]/;

const JOINED_LOOKALIKE = new RegExp(
  `^(?:anthropic|claude)(?:${LOOKALIKE_WORDS.join("|")})s?$`,
  "i",
);

// Claude Code stops joining tokens once the joined prefix outgrows the longest
// name its pattern can match: `anthropic`, the longest word, and an `s`.
const JOINED_PREFIX_LIMIT = "anthropic".length + "directories".length + 1;

/**
 * MKT-01 / D-PL5-28: Claude Code's strong look-alike test (2.1.282+), a name
 * outside printable ASCII or one that matches the official pattern. An exact
 * reserved name, in any case, is never a look-alike: the reserved set owns it.
 */
function isStrongLookalike(name: string): boolean {
  return (
    !RESERVED_MARKETPLACE_NAMES.has(name.toLowerCase()) &&
    (OUTSIDE_PRINTABLE_ASCII.test(name) || STRONG_LOOKALIKE.test(name))
  );
}

/**
 * MKT-01 / D-PL5-28: Claude Code's full look-alike test, the strong test plus
 * the directory words, a name that matches once its leading symbols go, the
 * official words run together, and a token-joined prefix such as
 * `claude-market-place`.
 */
function isLookalike(name: string): boolean {
  if (RESERVED_MARKETPLACE_NAMES.has(name.toLowerCase())) {
    return false;
  }

  return (
    isStrongLookalike(name) ||
    LOOKALIKE.test(name) ||
    LOOKALIKE.test(name.replace(/^[^a-z0-9]+/i, "")) ||
    /official(?:anthropic|claude)|(?:anthropic|claude)official/i.test(
      name.replaceAll(/[^a-z0-9]+/gi, ""),
    ) ||
    joinedPrefixLooksAlike(name)
  );
}

function joinedPrefixLooksAlike(name: string): boolean {
  let joined = "";
  for (const token of name.split(/[^a-z0-9]+/i).filter((part) => part !== "")) {
    joined += token;
    if (JOINED_LOOKALIKE.test(joined)) {
      return true;
    }

    if (joined.length > JOINED_PREFIX_LIMIT) {
      return false;
    }
  }

  return false;
}

/**
 * MKT-01 / D-PL5-28: Claude Code grandfathers a soft look-alike that a
 * registered marketplace already holds. A catalog that keeps that name, in any
 * case, is refused only for a strong look-alike, and any other name is refused
 * for any look-alike.
 */
function isRefusedLookalike(declaredName: string, registeredName: string | undefined): boolean {
  return declaredName.toLowerCase() === registeredName?.toLowerCase()
    ? isStrongLookalike(declaredName)
    : isLookalike(declaredName);
}

/** MKT-01 / D-PL5-28: the names Claude Code 2.1.310 uses itself, by what each holds. */
const CLAUDE_CODE_OWN_NAMES: ReadonlyMap<string, string> = new Map([
  ["inline", "--plugin-dir session plugins"],
  ["builtin", "built-in plugins"],
  ["skills-dir", "plugins auto-loaded from .claude/skills/"],
  ["synced", "plugins synced from your claude.ai account"],
  ["claude-plugin-test", "plugins loaded by claude plugin test"],
  [
    "npm",
    "plugins installed from an npm registry (`<package>@npm`); remove this marketplace and add it again under another name",
  ],
  ["pip", "plugins installed from a Python package index (reserved; not yet available)"],
  ["uv", "plugins installed from a Python package index through uv (reserved; not yet available)"],
  ["cargo", "plugins installed from a Rust crate registry (reserved; not yet available)"],
  [
    "github",
    "plugins installed straight from a GitHub repository (`<owner>/<repo>@github`; reserved; not yet available)",
  ],
  ["gh", "plugins installed straight from a GitHub repository (reserved; not yet available)"],
]);

/** MKT-01 / D-PL5-28: one of Claude Code's own names, in any case (2.1.275+). */
function ownNameRefusal(name: string): string | undefined {
  const lowered = name.toLowerCase();
  const holds = CLAUDE_CODE_OWN_NAMES.get(lowered);

  return holds === undefined ? undefined : `Marketplace name "${lowered}" is reserved for ${holds}`;
}

const CLAUDEAI_PREFIX = "claudeai-";

/**
 * MKT-01 / D-PL5-28: a name that starts with `claudeai-` once Claude Code folds
 * it. Pi has no claude.ai-hosted marketplaces, so the sentence drops Claude
 * Code's `--claudeai` remedy.
 */
function claudeaiPrefixRefusal(name: string): string | undefined {
  const folded = foldedName(name.normalize("NFKC"));
  if (
    !folded.startsWith(CLAUDEAI_PREFIX) &&
    !dashedName(folded).toLowerCase().startsWith(CLAUDEAI_PREFIX)
  ) {
    return undefined;
  }

  return `Cannot add marketplace ${JSON.stringify(name)}: names starting with "claudeai-" are reserved for marketplaces hosted on claude.ai.`;
}

const INVISIBLE_CHARACTERS = /[\u200C-\u200F\u202A-\u202E\u206A-\u206F\uFEFF]/g;

/** Claude Code's name fold: no invisible characters, case folded, no trailing dots or spaces. */
function foldedName(name: string): string {
  let folded = name.replaceAll(INVISIBLE_CHARACTERS, "").toUpperCase().toLowerCase();
  while (folded.endsWith(".") || folded.endsWith(" ")) {
    folded = folded.slice(0, -1);
  }

  return folded;
}

function dashedName(name: string): string {
  return name.replaceAll(/[^\w-]/g, "-");
}

const ANTHROPIC_PLUGIN_DIRECTORY = "anthropic-plugin-directory";

const DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  ANTHROPIC_PLUGIN_DIRECTORY,
  "claude-plugin-directory",
]);

// Claude Code checks the Anthropic Directory first, then the reserved set in order.
const SPELLING_ORDER = [ANTHROPIC_PLUGIN_DIRECTORY, ...RESERVED_MARKETPLACE_NAMES];

/**
 * MKT-01 / D-PL5-28: another spelling of a reserved name (2.1.280+), such as
 * `claude.code.plugins` or `healthcare.`. The exact `anthropic-plugin-directory`
 * stays open to the anthropics organization, because Pi has no built-in
 * Anthropic Directory to own the name; its other spellings are refused.
 */
function spellingRefusal(name: string): string | undefined {
  const lowered = name.toLowerCase();
  const reserved = SPELLING_ORDER.find(
    (candidate) => candidate !== lowered && spellsReservedName(name, candidate),
  );
  if (reserved === undefined) {
    return undefined;
  }

  if (DIRECTORY_NAMES.has(reserved)) {
    return `"${name}" is a reserved marketplace name.`;
  }

  return /^\w[\w.@-]*$/.test(name)
    ? `"${name}" is another spelling of "${reserved}", a reserved marketplace name.`
    : `This marketplace's name is another spelling of "${reserved}", a reserved marketplace name. It is not exactly the reserved name it appears to be.`;
}

function spellsReservedName(name: string, reserved: string): boolean {
  const normalized = name.normalize("NFKC");

  return [name, normalized, foldedName(normalized)].some(
    (form) => dashedName(form).toLowerCase() === reserved,
  );
}

/**
 * MKT-01 / D-PL5-28: an `Object.prototype` member name (2.1.296+), which Claude
 * Code cannot register. A name the scope already records keeps working.
 */
function objectMemberRefusal(name: string, recorded: boolean): string | undefined {
  return !recorded && Object.hasOwn(Object.prototype, name)
    ? `Cannot add marketplace "${name}": Claude Code reserves this name and cannot register a marketplace under it. The name is set by "name" in the marketplace's marketplace.json; ask its maintainer to change it.`
    : undefined;
}

/**
 * MKT-01 / D-PL5-28: throws `ReservedMarketplaceNameError` when Claude Code
 * refuses the marketplace recorded as `recordName` from `source`, whose
 * catalog declares `declaredName` when it was read. See
 * `recordedMarketplaceNameRefusal` for the rules.
 */
export function assertRecordedMarketplaceName(
  recordName: string,
  source: ParsedSource,
  declaredName?: string,
): void {
  const refusal = recordedMarketplaceNameRefusal(recordName, source, declaredName);
  if (refusal !== undefined) {
    throw new ReservedMarketplaceNameError(refusal);
  }
}

/**
 * MKT-01 / D-PL5-28: Claude Code's refusal of a marketplace an earlier version
 * recorded, or undefined when Claude Code loads it. The record's own name is
 * refused as another spelling of a reserved name, or as a reserved name from a
 * source outside the anthropics organization; Claude Code checks it before it
 * reads or refreshes the catalog. A catalog `declaredName` is then refused as
 * a look-alike, grandfathered against the record's name, or as one of Claude
 * Code's own names.
 *
 * The look-alike sentence echoes the record's name only when it is printable
 * ASCII, so no unprintable name reaches a terminal.
 */
function recordedMarketplaceNameRefusal(
  recordName: string,
  source: ParsedSource,
  declaredName?: string,
): string | undefined {
  const spelling = spellingRefusal(recordName);
  if (spelling !== undefined) {
    return spelling;
  }

  const reserved = reservedMarketplaceNameRefusal(recordName, source);
  if (reserved !== undefined) {
    return `Marketplace "${recordName}" is registered from an untrusted source: ${reserved} To fix it, remove the marketplace and re-add it from the official source.`;
  }

  if (declaredName === undefined) {
    return undefined;
  }

  if (isRefusedLookalike(declaredName, recordName)) {
    return OUTSIDE_PRINTABLE_ASCII.test(recordName)
      ? "Claude Code refuses this marketplace's name: it looks like one of Anthropic's own."
      : `Claude Code refuses the marketplace name "${recordName}": it looks like one of Anthropic's own`;
  }

  return ownNameRefusal(declaredName);
}

/**
 * Skill name generator (RN-1 / SK-2).
 *
 * Format: `<plugin>-<skill>` on every platform. Elides a matching plugin
 * prefix from the source, including Claude's colon-qualified form. The
 * result satisfies Pi's skill-name rules: lowercase ASCII letters, digits,
 * single interior hyphens, and at most 64 characters. Long names retain a
 * stable hash suffix so distinct sources do not collapse on truncation. A
 * source with no ASCII letters or digits also gets a hash-based segment.
 */
export function generatedSkillName(plugin: string, source: string): string {
  assertSafeName(plugin);
  assertSafeName(source);

  let elided = source;
  for (const separator of ["-", ":", "."]) {
    const prefix = `${plugin}${separator}`;
    if (source.startsWith(prefix)) {
      elided = source.slice(prefix.length);
      break;
    }
  }

  assertSafeName(elided);

  const normalizedPlugin = normalizePiSkillPart(plugin);
  const normalizedSkill = normalizePiSkillPart(elided);
  const generated = source === plugin ? normalizedPlugin : `${normalizedPlugin}-${normalizedSkill}`;
  if (generated.length <= 64) {
    return generated;
  }

  const suffix = createHash("sha256").update(`${plugin}\0${source}`).digest("hex").slice(0, 8);
  return `${generated.slice(0, 55).replace(/-$/, "")}-${suffix}`;
}

/** Converts one source-name segment into a nonempty Pi skill-name segment. */
function normalizePiSkillPart(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-/, "")
    .replace(/-$/, "");
  if (normalized === "") {
    const suffix = createHash("sha256").update(value).digest("hex").slice(0, 8);

    return `name-${suffix}`;
  }

  return normalized;
}

/**
 * Command name generator (RN-1 / CM-2).
 *
 * Format: `<plugin><separator><command>`, where the separator comes from
 * `commandNamespaceSeparator()`: a colon on POSIX, matching what Claude Code
 * registers, and a dot on Windows, because the generated name becomes a
 * filename and NTFS forbids a colon in one. The `<plugin>-` prefix is elided
 * from `source` (acme + acme-foo -> acme:foo, NOT acme:acme-foo).
 *
 * CM-4: `source` may be a `/`-separated relative path reflecting
 * a nested command file (e.g. "build/web" for commands/build/web.md). RN-2
 * forbids path separators in a single safe name, so the path is split into
 * segments and each segment is validated independently; the `<plugin>-`
 * prefix is elided from the FIRST segment only; and the segments are joined
 * with the separator, so the nested file becomes `<plugin>:build:web` --
 * matching Claude Code's nested-command convention -- or
 * `<plugin>.build.web` on Windows. A flat source ("foo") has a single
 * segment; "acme-foo" elides to the same name "foo" produces.
 *
 * The dot separator lets two sources collide on Windows when a source name
 * itself contains a dot: in plugin "acme", `commands/foo/bar.md` and
 * `commands/foo.bar.md` both name "acme.foo.bar". That is the D-07
 * first-wins skip, which discovery already resolves with a warning naming
 * the winner.
 *
 * D-141-02: an elision that would empty the head does not fire. A head of
 * exactly "acme-" in plugin "acme" keeps its verbatim form, so
 * `commands/acme-.md` becomes "acme:acme-" and `commands/acme-/lint.md`
 * becomes "acme:acme-:lint" -- the two names Claude Code registers for the
 * same tree -- and "acme.acme-" / "acme.acme-.lint" on Windows. The elision
 * exists to remove a stutter, and a head that is nothing but the stutter has
 * no command name left underneath it.
 *
 * Commands only. `generatedWorkflowName` applies the same rule to the same
 * join. `generatedSkillName` still rejects an empty elided suffix. Agent names
 * preserve the complete source name without elision.
 */
export function generatedCommandName(plugin: string, source: string): string {
  assertSafeName(plugin);

  const segments = source.split("/") as [string, ...string[]];

  for (const seg of segments) {
    assertSafeName(seg, `command path segment in "${source}"`);
  }

  const prefix = `${plugin}-`;
  const head = segments[0];
  const stripped = head.startsWith(prefix) ? head.slice(prefix.length) : head;
  // D-141-02: keep the head verbatim when the elision would empty it.
  const elidedHead = stripped === "" ? head : stripped;
  // The stripped head still needs validation on its own: a safe head can
  // strip down to an unsafe remainder ("acme-." leaves ".").
  assertSafeName(elidedHead, `elided command path head in "${source}"`);

  const generated = [plugin, elidedHead, ...segments.slice(1)].join(commandNamespaceSeparator());
  // PRD §6.5 RN-2 forbids only "/" and "\", so a name joined with either
  // separator passes.
  assertSafeName(generated);

  return generated;
}

/**
 * Agent name generator (RN-1 / AG-1).
 *
 * Format: `pi-claude-marketplace-<plugin>-<agent>` (Pi-namespacing prefix
 * keeps cross-extension agents distinguishable). Appends the complete source
 * name so bot and acme-bot remain distinct within plugin acme.
 */
export function generatedAgentName(plugin: string, source: string): string {
  assertSafeName(plugin);
  assertSafeName(source);
  const generated = `pi-claude-marketplace-${plugin}-${source}`;
  assertSafeName(generated);
  return generated;
}

/**
 * Declared agent name generator (RN-1 / AG-1a).
 *
 * Format: `<plugin>:<agent>` -- the name the agent DECLARES in its frontmatter,
 * as distinct from `generatedAgentName`, which names the file on disk and
 * carries the AG-5 ownership marker. Two consumers read this field and both
 * take it verbatim: pi-subagents as the agent's `localName`, and the host
 * workflow engine as its `agentType` registry key. A workflow script authored
 * against Claude Code addresses a plugin agent as `<plugin>:<agent>`, so any
 * other shape makes every `agent({ agentType })` call in a bridged workflow
 * resolve to nothing and silently fall back to default tools and model.
 *
 * The separator is a literal `:` on every platform rather than
 * `commandNamespaceSeparator()`. That helper exists because command and skill
 * names BECOME filenames, and Windows cannot spell `:` in one. This name never
 * reaches the filesystem, so the colon is safe everywhere -- and a Windows dot
 * here would miss the agentType the script names just as the old flat form did.
 *
 * The complete source name is preserved without elision, exactly as
 * `generatedAgentName` preserves it, so bot and acme-bot stay distinct
 * within plugin acme.
 */
export function declaredAgentName(plugin: string, source: string): string {
  assertSafeName(plugin);
  assertSafeName(source);
  const declared = `${plugin}:${source}`;
  assertSafeName(declared);
  return declared;
}

/**
 * ANAME-01: the name Claude Code registers a plugin MCP server under,
 * `plugin:<plugin>:<server>`. The declared server name is kept verbatim;
 * `generatedMcpServerKey` normalizes this same string, so the name `info`
 * shows and the key install writes cannot drift apart.
 */
export function mcpServerDisplayName(plugin: string, server: string): string {
  return `plugin:${plugin}:${server}`;
}

/**
 * MCP server key generator (ANAME-01).
 *
 * Format: `plugin_<plugin>_<server>_`. Claude Code names a plugin server
 * `plugin:<plugin>:<server>` and replaces every character outside
 * `[A-Za-z0-9_-]` with `_` when it builds a tool name. This builder applies
 * the same rule to `mcpServerDisplayName`'s string, then appends one `_`. pi-mcp-adapter
 * names a tool `<toolPrefix>__<key>_<tool>`, so the trailing `_` and the
 * entry's `toolPrefix: "mcp"` give Claude Code's `mcp__plugin_<p>_<s>__<tool>`.
 *
 * The pattern has no `u` flag, so it replaces each UTF-16 code unit as Claude
 * Code does: an astral character becomes two `_`. This is the only copy of the
 * pattern; every generated MCP server key comes from here.
 *
 * Only `plugin` is screened. A declared server name is a JSON key that may
 * hold any character, and the replacement makes every key safe.
 */
export function generatedMcpServerKey(plugin: string, server: string): string {
  assertSafeName(plugin);
  const claudeServerName = mcpServerDisplayName(plugin, server);
  return `${claudeServerName.replaceAll(/[^A-Za-z0-9_-]/g, "_")}_`;
}

/**
 * ANAME-03: a server key with every `-` folded to `_`. pi-mcp-adapter names a
 * server's deferred-tool namespace `mcp__` plus the key with `-` folded, so
 * two keys equal after the fold share one namespace in Pi. Claude Code keeps
 * `-`, so refusing such a pair is a Pi capability gap. This is the only fold
 * of a server key.
 */
export function foldedMcpServerKey(key: string): string {
  return key.replaceAll("-", "_");
}

/**
 * Workflow name generator (RN-1 / WNAM-06).
 *
 * Format: `<plugin>:<workflow>` -- the same colon separator command names use.
 * The `<plugin>-` prefix is elided from `source` (acme + acme-audit ->
 * acme:audit, NOT acme:acme-audit).
 *
 * `source` is the workflow's `meta.name`, not its file stem: the two diverge in
 * real plugins, and the declared name is the one the host engine answers to.
 *
 * Workflow discovery is flat and non-recursive (WBRG-02), so this takes the
 * single-segment shape of `generatedSkillName` rather than
 * `generatedCommandName`'s `/`-separated path handling. Sharing a helper with
 * the command generator would mean pulling its nested-path handling into a
 * caller that can never produce that shape.
 *
 * D-141-02: an elision that would empty the head does not fire, exactly as it
 * does not for `generatedCommandName`'s identically-joined name. A `meta.name`
 * of "acme-" in plugin "acme" therefore yields "acme:acme-", not the bare
 * "acme:" -- a name whose command half is empty. The elision exists to remove a
 * stutter, and a name that is nothing but the stutter has nothing left under it.
 *
 * Only the WHOLE name is screened by the dot, empty and whitespace rules,
 * because the whole name is the only thing the engine judges. Screening `source`
 * or the elided remainder for those would refuse names the engine accepts: it
 * rejects a saved name that IS "." but not one that merely ENDS in it, so a
 * `meta.name` of "." makes "acme:.", which its own `isSafeSavedWorkflowName`
 * admits and its own `sourcePath` writes as the one-segment file "acme:..json".
 * The path separator and control-character screens do still catch a defect the
 * join cannot fix, and `assertSafeName(generated)` sees each of them in the
 * joined name.
 *
 * Every failure of the NAME leaves as `UnsafeGeneratedNameError`, never as the
 * bare `Error` the RN-2 validators throw. `domain/workflow-script.ts` turns
 * exactly this failure into one file's `refused` verdict, and the typed class is
 * what lets it -- and this module's own tests -- discriminate by `instanceof`
 * instead of by an exact message string, which is the error contract every other
 * domain failure follows.
 *
 * One screen deliberately EXCEEDS the engine: a name carrying a lone surrogate
 * is refused. That is not a parity excess in any useful sense -- such a name
 * cannot round-trip through a path at all, so the engine's own save/load pair
 * silently collapses two of them onto one file. See the comment at the check.
 *
 * The `plugin` check stays OUTSIDE that conversion and keeps its bare `Error`:
 * an unsafe plugin name disqualifies every script in the plugin at once, so it
 * is not one file's fault and must never be rendered as one file's refusal.
 */
export function generatedWorkflowName(plugin: string, source: string): string {
  assertSafeName(plugin);

  const prefix = `${plugin}-`;
  const stripped = source.startsWith(prefix) ? source.slice(prefix.length) : source;
  const elided = stripped === "" ? source : stripped;
  const generated = `${plugin}:${elided}`;

  // The one emptiness rule that survives as a check on the part: the join always
  // carries "<plugin>:", so a `source` of nothing at all still produces a
  // non-empty name that every whole-name screen below would admit.
  if (source.trim() === "") {
    throw new UnsafeGeneratedNameError(generated, "Workflow name must be a non-empty string.");
  }

  // The conversion wraps one RN-2 call and nothing else, so what it can relabel
  // is bounded by one pure string validator. The engine-parity gate below raises
  // the typed class itself rather than being round-tripped through this catch.
  try {
    assertSafeName(generated);
  } catch (error) {
    throw new UnsafeGeneratedNameError(generated, errorMessage(error));
  }

  assertSafeSavedWorkflowName(generated);

  // The one screen this gate adds to the engine's, kept OUT of the mirror above
  // so that function stays a faithful replica. A lone surrogate has no UTF-8
  // encoding, so Node substitutes U+FFFD when it turns a name into a path:
  // "acme:\uD800.json" and "acme:\uDC00.json" are ONE file on disk, and the
  // second write destroys the first without an error. The engine screens only
  // \p{Cc} and \p{Cf}, so its own `sourcePath` -- which writes `${name}.json` --
  // cannot keep the two apart either, and neither can
  // `domain/workflow-script.ts`'s collision gate, which compares names as exact
  // strings and correctly sees two. Refusing the name is the only point at
  // which the collapse is visible. `/u` matches CODE POINTS, so a well-formed
  // astral pair is a single non-surrogate code point and passes.
  if (/\p{Cs}/u.test(generated)) {
    throw new UnsafeGeneratedNameError(
      generated,
      `Generated workflow name "${generated}" must not contain unpaired surrogates.`,
    );
  }

  return generated;
}

/**
 * WNAM-06 / SC-4: replicate the host engine's `isSafeSavedWorkflowName`
 * (`@quintinshaw/pi-dynamic-workflows` 3.10.1, `dist/workflow-saved.js`) for a
 * name this module has already generated.
 *
 * Four of the engine's six clauses live here: the 128-character cap, the
 * trim-equality rule, the whitespace/separator/NUL screen, and the
 * control-and-format screen. The other two are satisfied by the SHAPE of what
 * `generatedWorkflowName` produces rather than by a check: a `<plugin>:<name>`
 * join is never the empty string and can never be exactly "." or "..", because
 * the plugin half is itself a non-empty RN-2 name and the colon always follows
 * it. Neither clause is replicated as a test on the joined name, because a test
 * that can never fire would read as a rule the generator has to obey.
 *
 * The last two screens overlap `assertSafeName` without being covered by it.
 * That validator refuses only code points below 0x20 plus 0x7f, so a plain
 * space at 0x20 and every `\p{Cf}` code point pass it while the engine refuses
 * the name -- which in practice is an envelope on disk that never registers as
 * a command. Both patterns carry `/u` so the property escapes match code points
 * the way the engine's do.
 *
 * Matching the engine exactly is the goal, never exceeding it: a gate stricter
 * than the engine refuses a name the engine would accept, and only the lax
 * direction self-corrects when a later engine relaxes a rule. That is a rule
 * about THIS function. `generatedWorkflowName` carries one deliberate screen
 * the engine has no counterpart for, and keeps it out here so this stays a
 * replica a reader can diff against `dist/workflow-saved.js`.
 *
 * This wraps rather than widens `assertSafeName`, which skills, commands and
 * agents all share and none of which wants a 128-character cap or a whitespace
 * ban. Only `generatedWorkflowName` calls this.
 */
function assertSafeSavedWorkflowName(name: string): void {
  if (name.length > 128) {
    throw new UnsafeGeneratedNameError(
      name,
      `Generated workflow name "${name}" must be at most 128 characters (got ${name.length}).`,
    );
  }

  if (name.trim() !== name) {
    throw new UnsafeGeneratedNameError(
      name,
      `Generated workflow name "${name}" must not have leading or trailing whitespace.`,
    );
  }

  if (/[\s/\\\0]/u.test(name)) {
    throw new UnsafeGeneratedNameError(
      name,
      `Generated workflow name "${name}" must not contain whitespace, path separators, or NUL.`,
    );
  }

  if (/[\p{Cc}\p{Cf}]/u.test(name)) {
    throw new UnsafeGeneratedNameError(
      name,
      `Generated workflow name "${name}" must not contain control or format characters.`,
    );
  }
}
