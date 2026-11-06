// bridges/agents/convert.ts
//
// AG-7 conversion pipeline. Notable details:
//   1. substituteClaudeVars from ../../shared/vars.ts (D-08 / PI-10) handles
//      body substitution per the PI-10 contract.
//   2. resolveSkillReference from ../../domain/skill-tokens.ts maps skill
//      preloads and body references to the names staged by the skills bridge.
//      Agent name generation happens in ./discover.ts.
//   3. discoverPluginAgents lives in ./discover.ts so convert stays pure.
//
// Model, tool, and thinking mappings are user contracts; owner tests assert
// their exact converted output.

import { profileFor } from "../../domain/mcp-implementation.ts";
import { declaredAgentName, generatedMcpServerKey } from "../../domain/name.ts";
import { resolveSkillReference, rewriteMarkdownReferences } from "../../domain/skill-tokens.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { substituteClaudeVars } from "../../shared/vars.ts";

import { emitGeneratedAgentFile, emitGeneratedAgentFrontmatter } from "./frontmatter.ts";
import { mcpAsyncWarning } from "./mcp-async-warning.ts";

import type { GeneratedToolsFields } from "./frontmatter.ts";
import type {
  ConvertedAgent,
  DiscoveredAgent,
  RawAgentFrontmatter,
  SkillPreload,
} from "./types.ts";
import type { McpImplementationId } from "../../domain/mcp-implementation.ts";
import type {
  InstalledReferenceNames,
  SkillReferenceResolution,
} from "../../domain/skill-tokens.ts";

/**
 * Source frontmatter fields the converter actively consumes. Anything else
 * is recorded in droppedFields.
 */
const SUPPORTED_SOURCE_FIELDS = new Set([
  "name",
  "description",
  "when_to_use",
  "when-to-use",
  "model",
  "tools",
  "disallowedTools",
  "thinking",
  "effort",
  "skills",
  "background",
]);

/**
 * AG-7 / D-CF4-07 as amended: Claude Code's model aliases, keyed lower-case,
 * mapped to the first-party models of Claude Code's model catalog.
 * `opusplan` runs a subagent on sonnet, because its plan-mode upgrade to opus
 * applies only to a session that inherits it; `best` selects fable.
 */
const MODEL_MAP: ReadonlyMap<string, string> = new Map([
  ["sonnet", "anthropic/claude-sonnet-5-5"],
  ["opusplan", "anthropic/claude-sonnet-5-5"],
  ["opus", "anthropic/claude-opus-5-5"],
  ["haiku", "anthropic/claude-haiku-5-5"],
  ["fable", "anthropic/claude-fable-5-1"],
  ["best", "anthropic/claude-fable-5-1"],
]);

/** The suffix of Claude Code's one-million-token context aliases. */
const LONG_CONTEXT_SUFFIX = "[1m]";

/**
 * AG-7 user contract: Claude tool name -> Pi tool name. Tokens not present
 * here are dropped. A `Map`, so a token such as `constructor` cannot find an
 * `Object.prototype` member.
 */
const TOOL_MAP: ReadonlyMap<string, string> = new Map([
  ["Read", "read"],
  ["Bash", "bash"],
  ["Edit", "edit"],
  ["Write", "write"],
  ["Grep", "grep"],
  ["Glob", "find"],
  ["LS", "ls"],
]);

/**
 * ANAME-02 / MGRT-01: one MCP server the rendered form maps. `selector` is the
 * pi-subagents `mcp:` entry for every tool of the server under the form's MCP
 * implementation; `claudePrefix` is the Claude Code tool-name prefix of the
 * same server, `mcp__` plus the adapter key without its trailing `_`, which is
 * the same under both implementations. `excludeName` gives the `excludeTools`
 * name of one tool of the server from its Claude token and its tool part.
 */
interface McpGrant {
  readonly selector: string;
  readonly claudePrefix: string;
  readonly excludeName: (token: string, tool: string) => string;
}

/** ANAME-02: a Claude-form MCP name matched to a written server. */
interface McpGrantMatch {
  /** The grant's selector, the pi-subagents entry for every tool of the server. */
  readonly server: string;
  /** The raw MCP tool name; absent when the name covers the whole server. */
  readonly tool?: string;
  /** The `excludeTools` name of the matched tool (see `McpGrant`). */
  readonly excludeName: (token: string, tool: string) => string;
}

/**
 * MGRT-01: the `excludeTools` name of one per-tool MCP disallow. The adapter
 * form keeps the Claude token verbatim (a `.` in the tool part included),
 * because the Claude name is the delivered tool name there (ANAME-02). The
 * built-in form takes Pi's own tool name, which differs from the Claude name
 * whenever the server name holds a `-` or the name passes 64 characters.
 */
function excludeNameFor(
  id: McpImplementationId,
  pluginName: string,
  server: string,
): (token: string, tool: string) => string {
  if (id === "adapter") {
    return (token) => token;
  }

  const profile = profileFor(id);
  return (_token, tool) => profile.toolName(pluginName, server, tool);
}

/**
 * ANAME-02: the pi-subagents form of a disallowed MCP name on an explicit
 * `tools:` list. `exact` holds the Pi names and `mcp:` entries to remove;
 * `servers` holds the `mcp:` selector of each disallowed whole server, whose
 * per-tool entries are removed too. `perTool` keeps each per-tool disallow
 * with its source token for the cannot-narrow warning.
 */
interface ExplicitDisallow {
  readonly exact: ReadonlySet<string>;
  readonly servers: ReadonlySet<string>;
  readonly perTool: readonly { readonly token: string; readonly server: string }[];
}

/**
 * Allowlist for thinking/effort values. D-CF4-06 as amended: `max` is one of
 * Claude Code's effort levels (`low`, `medium`, `high`, `xhigh`, `max`).
 */
const THINKING_VALUES: ReadonlySet<string> = new Set([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);

interface ToolMappingBase {
  readonly dropped: string[];
  readonly warnings: string[];
}

interface ExplicitToolMapping extends ToolMappingBase {
  readonly omitted: false;
  /**
   * Deduped, disallow-filtered Pi allowlist: Pi tool names and, for the
   * servers this install writes, pi-subagents `mcp:` entries (ANAME-02).
   * AG-11 gates it non-empty.
   */
  readonly mapped: string[];
  /** AGSK-05 / D-83-01: Skill declared in tools: AND not disallowed. */
  readonly inheritSkills: boolean;
}

interface OmittedToolMapping extends ToolMappingBase {
  readonly omitted: true;
  /**
   * Names for `excludeTools:`: source disallowedTools via TOOL_MAP, plus each
   * per-tool MCP name of a written server as the form's implementation names
   * the delivered tool: the Claude name for the adapter (ANAME-02), Pi's
   * built-in tool name for the built-in MCP (MGRT-01).
   */
  readonly excludeTools: string[];
  /**
   * An omitted tools: implicitly declares every subagent tool (Skill
   * included), so the flag follows the disallow check alone (#179).
   */
  readonly inheritSkills: boolean;
}

/**
 * Discriminated on `omitted`, so each arm carries only the fields that
 * mean something there (the NFR-7 `installable` idiom).
 */
type ToolMappingResult = ExplicitToolMapping | OmittedToolMapping;

/** The AG-11 validator proves the explicit allowlist is nonempty. */
type ValidatedToolMapping =
  (ExplicitToolMapping & { readonly mapped: [string, ...string[]] }) | OmittedToolMapping;

/**
 * D-CF4-08 as amended: splits a `tools`, `disallowedTools`, or `skills` value
 * as Claude Code does, on commas and on whitespace outside parentheses, so
 * `Read Grep` is two entries and `Bash(git log *)` stays one. Empty parts
 * are dropped.
 */
function splitToolList(value: string | undefined): string[] {
  if (value === undefined) {
    return [];
  }

  // Accept both the bare CSV form (`tools: Read, Bash, Edit`) and the YAML
  // inline-array form (`tools: ["Read", "Bash", "Edit"]`). Many real agents
  // -- including Anthropic's own claude-plugins-official -- use the array
  // form, which our line-based frontmatter parser hands us as a single
  // string with the brackets and surrounding quotes intact.
  let raw = value.trim();
  if (raw.startsWith("[") && raw.endsWith("]")) {
    raw = raw.slice(1, -1);
  }

  return topLevelParts(raw)
    .map((part) => withoutMatchingQuotes(part.trim()))
    .filter((part) => part !== "");
}

/** The parts of `raw` between commas and whitespace outside parentheses. */
function topLevelParts(raw: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (const char of raw) {
    if (depth === 0 && (char === "," || /\s/.test(char))) {
      parts.push(current);
      current = "";
      continue;
    }

    if (char === "(") {
      depth += 1;
    } else if (char === ")" && depth > 0) {
      depth -= 1;
    }

    current += char;
  }

  parts.push(current);
  return parts;
}

/**
 * D-CF4-08 as amended: Claude Code resolves a `Tool(spec)` entry to its
 * tool, so the bridge maps it by the tool name and drops the spec. A grant
 * becomes the whole tool and a disallow removes the whole tool.
 */
function toolNameOf(token: string): string {
  const open = token.indexOf("(");
  return open > 0 && token.endsWith(")") ? token.slice(0, open) : token;
}

/**
 * AGSK-03 / D-CF4-08 as amended: whether `token` names the Skill tool,
 * bare or as `Skill(spec)`. Exact match on the tool name, like TOOL_MAP.
 */
function isSkillToken(token: string): boolean {
  return toolNameOf(token) === "Skill";
}

/** The value with one pair of matching surrounding quotes removed. */
function withoutMatchingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function dedupePreservingOrder(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }

  return out;
}

interface ModelMapping {
  readonly emit: string | undefined;
  readonly originalModel: string | undefined;
  readonly warning: string | undefined;
}

/**
 * AG-7 / D-CF4-07 as amended: the model a source `model` selects, read as
 * Claude Code reads it. The value is trimmed; `inherit`, in any case, leaves
 * the session's model; an alias maps through MODEL_MAP; a full `claude-` ID
 * passes through. `originalModel` keeps the source value.
 */
function mapModel(raw: string | undefined): ModelMapping {
  const value = raw?.trim() ?? "";
  if (raw === undefined || value === "") {
    return { emit: undefined, originalModel: undefined, warning: undefined };
  }

  if (value.toLowerCase() === "inherit") {
    return { emit: undefined, originalModel: raw, warning: undefined };
  }

  const emit = aliasModel(value) ?? fullModelId(value);
  return {
    emit,
    originalModel: raw,
    warning:
      emit === undefined
        ? `unknown model "${raw}" -- omitted from generated frontmatter`
        : undefined,
  };
}

/**
 * D-CF4-07 as amended: Claude Code matches its aliases case-insensitively,
 * and one trailing `[1m]` selects the same model with a longer context.
 */
function aliasModel(value: string): string | undefined {
  const lower = value.toLowerCase();
  const alias = lower.endsWith(LONG_CONTEXT_SUFFIX)
    ? lower.slice(0, -LONG_CONTEXT_SUFFIX.length)
    : lower;
  return MODEL_MAP.get(alias);
}

/**
 * D-CF4-07 as amended: Claude Code sends any other value as a model ID. Only
 * a `claude-` ID with no whitespace and no `:` passes through, because
 * pi-subagents reads a `:` suffix as a thinking level (T-04-06).
 */
function fullModelId(value: string): string | undefined {
  return value.startsWith("claude-") && !/[\s:]/.test(value) ? `anthropic/${value}` : undefined;
}

/**
 * ANAME-02 / MGRT-01: the grant table of the MCP servers the form maps,
 * longest Claude prefix first, so a token that two prefixes match takes the
 * longer one. The Claude prefix comes from `generatedMcpServerKey` and the
 * selector from the implementation's frozen `grantSelector`, which both
 * normalize the server name, so a declared name cannot inject a frontmatter
 * line or an extra grant (T-04-01).
 */
function buildMcpGrants(
  pluginName: string,
  serverNames: readonly string[] | undefined,
  id: McpImplementationId,
): readonly McpGrant[] {
  const profile = profileFor(id);
  const grants = (serverNames ?? []).map((server) => ({
    selector: profile.grantSelector(pluginName, server),
    claudePrefix: `mcp__${generatedMcpServerKey(pluginName, server).slice(0, -1)}`,
    excludeName: excludeNameFor(id, pluginName, server),
  }));
  grants.sort((a, b) => b.claudePrefix.length - a.claudePrefix.length);
  return grants;
}

/**
 * ANAME-02: matches a Claude-form MCP name against the written servers.
 * `<prefix>` and `<prefix>__*` name the whole server; `<prefix>__<tool>`
 * names one tool. Matching is exact and case-sensitive. An empty tool part
 * matches nothing, and neither does a tool part holding `/`: Claude Code
 * never puts `/` in a tool name, and pi-subagents splits `mcp:` entries on
 * the first `/`. A tool part holding whitespace or `,` matches nothing
 * either: Claude Code never puts one in a tool name, and the generated
 * `tools:` line would split on it, or a line break would start a new
 * frontmatter key (T-04-01).
 */
function matchMcpGrant(token: string, grants: readonly McpGrant[]): McpGrantMatch | undefined {
  const grant = grants.find(
    (candidate) =>
      token === candidate.claudePrefix || token.startsWith(`${candidate.claudePrefix}__`),
  );
  if (grant === undefined) {
    return undefined;
  }

  const server = grant.selector;
  const { excludeName } = grant;
  const tool = token.slice(grant.claudePrefix.length + 2);
  if (token === grant.claudePrefix || tool === "*") {
    return { server, excludeName };
  }

  return tool === "" || /[\s,/]/u.test(tool) ? undefined : { server, tool, excludeName };
}

function mcpEntry(match: McpGrantMatch): string {
  return match.tool === undefined ? match.server : `${match.server}/${match.tool}`;
}

/** A TOOL_MAP name, or the `mcp:` entry of a written server's MCP name. */
function mapToolName(token: string, grants: readonly McpGrant[]): string | undefined {
  const piName = TOOL_MAP.get(toolNameOf(token));
  if (piName !== undefined) {
    return piName;
  }

  const match = matchMcpGrant(token, grants);
  return match === undefined ? undefined : mcpEntry(match);
}

/**
 * Maps source tool tokens to Pi names via TOOL_MAP, and Claude-form MCP names
 * of the written servers to pi-subagents `mcp:` entries (ANAME-02); other
 * tokens land in `dropped`. Pure mapping/dropping -- no warnings here.
 * AGSK-03 / AGSK-05 / D-83.1-01 / D-83.1-02: `Skill` is excluded from
 * classification entirely (neither mapped nor dropped) because it translates
 * to the `inheritSkills` flag computed in mapTools from the raw tokens --
 * both branches operate exactly as Claude Code does, so there is no
 * droppedTools entry and no warning in any branch. Every other miss still
 * records a `droppedTools` entry.
 */
function mapToolTokens(
  tokens: readonly string[],
  grants: readonly McpGrant[],
): { mapped: string[]; dropped: string[] } {
  const mapped: string[] = [];
  const dropped: string[] = [];
  for (const token of tokens) {
    // AGSK-03 / D-83.1-02: Skill is translated to inheritSkills (computed
    // in mapTools from raw tokens), never dropped -- no droppedTools entry
    // and no warning in any branch. Exact match, like TOOL_MAP lookups.
    if (isSkillToken(token)) {
      continue;
    }

    const name = mapToolName(token, grants);
    if (name === undefined) {
      dropped.push(token);
    } else {
      mapped.push(name);
    }
  }

  return { mapped, dropped };
}

function mapTools(
  rawTools: string | undefined,
  rawDisallowed: string | undefined,
  grants: readonly McpGrant[],
): ToolMappingResult {
  const disallowedTokens = splitToolList(rawDisallowed);
  const tokens = splitToolList(rawTools);
  // D-CF4-08 as amended: Claude Code reads a `*` entry as every tool, which
  // is what an omitted list grants.
  if (rawTools === undefined || tokens.includes("*")) {
    return omittedToolMapping(disallowedTokens, grants);
  }

  // AGSK-05 / D-83-01: the inherit flag is computed ONCE from RAW
  // Claude-side tokens -- exact match, case-sensitive "Skill", bare or as
  // `Skill(spec)` (D-CF4-08 as amended), like TOOL_MAP lookups. The
  // disallow check must read raw tokens because
  // Skill has no TOOL_MAP entry, so the Pi-name filter below can never
  // see it.
  const inheritSkills = tokens.some(isSkillToken) && !disallowedTokens.some(isSkillToken);

  // Apply disallowedTools after mapping.
  const { mapped, dropped } = mapToolTokens(tokens, grants);
  const disallow = explicitDisallow(disallowedTokens, grants);
  const kept = dedupePreservingOrder(mapped.filter((name) => !isDisallowed(name, disallow)));

  return {
    omitted: false,
    mapped: kept,
    dropped,
    warnings: explicitMcpWarnings(kept, disallow),
    inheritSkills,
  };
}

/**
 * Disallowed values are Claude-side names. A TOOL_MAP name and a written
 * server's MCP name have a pi-subagents spelling to filter by; any other
 * name has nothing to filter from an explicit allowlist (ANAME-02).
 */
function explicitDisallow(
  disallowedTokens: readonly string[],
  grants: readonly McpGrant[],
): ExplicitDisallow {
  const exact = new Set<string>();
  const servers = new Set<string>();
  const perTool: { token: string; server: string }[] = [];
  for (const token of disallowedTokens) {
    const name = mapToolName(token, grants);
    if (name !== undefined) {
      exact.add(name);
    }

    const match = matchMcpGrant(token, grants);
    if (match === undefined) {
      continue;
    }

    if (match.tool === undefined) {
      servers.add(match.server);
    } else {
      perTool.push({ token, server: match.server });
    }
  }

  return { exact, servers, perTool };
}

/** A whole-server disallow also removes every per-tool entry of that server. */
function isDisallowed(entry: string, disallow: ExplicitDisallow): boolean {
  const slash = entry.indexOf("/");
  return disallow.exact.has(entry) || (slash !== -1 && disallow.servers.has(entry.slice(0, slash)));
}

/**
 * ANAME-02: a per-tool disallow cannot narrow a whole-server grant that
 * survives the filter, so it warns. pi-subagents 0.62 and later do apply
 * `excludeTools` beside an explicit `tools:` list (D-CF4-08); the per-tool
 * warning text still says otherwise and stays unchanged, because it belongs
 * to the MCP-07 warning surface.
 */
function explicitMcpWarnings(kept: readonly string[], disallow: ExplicitDisallow): string[] {
  const keptSet = new Set(kept);
  const warnings = disallow.perTool
    .filter(({ server }) => keptSet.has(server))
    .map(
      ({ token, server }) =>
        `disallowedTools entry ${token} cannot narrow the whole-server grant ${server} -- ` +
        "pi-subagents takes no excludeTools beside an explicit tools: list, so the agent keeps every tool of that server",
    );
  return dedupePreservingOrder(warnings);
}

/**
 * ANAME-02 / MGRT-01: the `excludeTools` name of a per-tool MCP name of a
 * written server, in the form's spelling (`excludeNameFor`). A whole-server
 * name has no `excludeTools` form.
 */
function perToolMcpName(token: string, grants: readonly McpGrant[]): string | undefined {
  const match = matchMcpGrant(token, grants);
  return match?.tool === undefined ? undefined : match.excludeName(token, match.tool);
}

/**
 * #179: when source omits `tools:` entirely, Claude grants the agent every
 * tool available to subagents. The faithful pi-subagents equivalent is
 * omitting the allowlist -- the child then gets Pi's normal builtin tools
 * (and, for background children, ambient extension tools such as
 * pi-mcp-adapter's MCP tools). disallowedTools narrows that default set via
 * excludeTools (pi-subagents 0.62.0; earlier versions store-and-ignore the
 * key). A per-tool MCP name of a written server joins excludeTools in the
 * form's spelling (ANAME-02, MGRT-01). Both degradations on that path warn:
 * a disallow token with no such mapping cannot narrow anything, and an
 * emitted excludeTools is inert below the version floor -- each is an
 * author-written restriction that must not weaken without a trace.
 */
function omittedToolMapping(
  disallowedTokens: readonly string[],
  grants: readonly McpGrant[],
): OmittedToolMapping {
  const excluded: string[] = [];
  const unmapped: string[] = [];
  for (const token of disallowedTokens) {
    // Skill is excluded: it maps to inheritSkills below, not to a Pi tool.
    if (isSkillToken(token)) {
      continue;
    }

    const name = TOOL_MAP.get(toolNameOf(token)) ?? perToolMcpName(token, grants);
    if (name === undefined) {
      unmapped.push(token);
    } else {
      excluded.push(name);
    }
  }

  const warnings: string[] = [];
  const unmappedNames = dedupePreservingOrder(unmapped);
  if (unmappedNames.length > 0) {
    warnings.push(
      `disallowedTools entries with no Pi tool mapping (${unmappedNames.join(", ")}) cannot narrow the default tool set -- ignored`,
    );
  }

  const excludeTools = dedupePreservingOrder(excluded);
  if (excludeTools.length > 0) {
    warnings.push(
      "`excludeTools` requires pi-subagents >= 0.62.0 -- earlier versions ignore it and keep the default tool set",
    );
  }

  return {
    omitted: true,
    excludeTools,
    dropped: [],
    warnings,
    inheritSkills: !disallowedTokens.some(isSkillToken),
  };
}

/**
 * Picks the `thinking:` value to emit. Thinking wins over effort. When
 * `thinking` is set BUT invalid, the result falls back to `effort` only if
 * `effort` is set and valid; otherwise it omits the value.
 *
 * - thinking set and valid       -> emit thinking
 * - thinking set and invalid     -> warn; if effort set+valid emit effort, else omit
 * - thinking absent, effort set+valid -> emit effort
 * - thinking absent, effort set+invalid -> warn, omit
 * - both absent -> omit silently
 *
 * `thinking` matches exactly; `effort` is normalized first (D-CF4-06).
 */
function mapThinking(
  rawThinking: string | undefined,
  rawEffort: string | undefined,
): { emit: string | undefined; warning: string | undefined } {
  const effort = mapEffort(rawEffort);
  if (rawThinking === undefined || rawThinking === "") {
    return effort;
  }

  if (THINKING_VALUES.has(rawThinking)) {
    return { emit: rawThinking, warning: undefined };
  }

  // thinking present but invalid -- try effort as documented fallback
  if (effort.emit !== undefined) {
    return {
      emit: effort.emit,
      warning: `unknown thinking value "${rawThinking}" -- using effort "${rawEffort}" as fallback`,
    };
  }

  return {
    emit: undefined,
    warning: `unknown thinking value "${rawThinking}" -- omitted from generated frontmatter`,
  };
}

/**
 * D-CF4-06 as amended: Claude Code trims and lower-cases `effort` and reads
 * `med` as `medium`. Claude Code also takes an integer effort, which
 * pi-subagents has no level for, so it is dropped with the unknown-effort
 * warning.
 */
function mapEffort(rawEffort: string | undefined): {
  emit: string | undefined;
  warning: string | undefined;
} {
  if (rawEffort === undefined || rawEffort === "") {
    return { emit: undefined, warning: undefined };
  }

  const lower = rawEffort.trim().toLowerCase();
  const level = lower === "med" ? "medium" : lower;
  if (THINKING_VALUES.has(level)) {
    return { emit: level, warning: undefined };
  }

  return {
    emit: undefined,
    warning: `unknown effort value "${rawEffort}" -- omitted from generated frontmatter`,
  };
}

/**
 * D-CF4-04: the deduped generated names of the skills of this plugin that an
 * agent's `skills:` value names, in `skills:` order. The stage reads the
 * preloads of exactly these names.
 */
export function preloadedSkillNames(
  rawSkills: string | undefined,
  pluginName: string,
  knownSkills: readonly string[],
): readonly string[] {
  const known = new Set(knownSkills);
  const names = splitToolList(rawSkills).flatMap((token) => {
    const resolution = resolveSkillReference(pluginName, token, known);
    return resolution.kind === "known" ? [resolution.generatedName] : [];
  });
  return dedupePreservingOrder(names);
}

/** The converted `skills:` entries, the inlined skill texts, and the warnings. */
interface SkillsMapping {
  readonly emit: string[];
  readonly inline: string[];
  readonly warnings: string[];
}

/**
 * Converts the agent's `skills:` value. A known reference with an inline
 * preload is written after the body and left out of `skills:`, one with a
 * skip preload is left out with a warning, and one with no preload stays a
 * `skills:` entry (D-CF4-04). Each generated name counts once, as in
 * mapTools, so a bare token and its same-plugin self-qualified form
 * (AGSK-02) converge on one entry.
 */
function mapSkills(
  rawSkills: string | undefined,
  pluginName: string,
  knownSkills: readonly string[],
  preloads: ReadonlyMap<string, SkillPreload>,
): SkillsMapping {
  const known = new Set(knownSkills);
  const seen = new Set<string>();
  const mapping: SkillsMapping = { emit: [], inline: [], warnings: [] };
  for (const token of splitToolList(rawSkills)) {
    const resolution = resolveSkillReference(pluginName, token, known);
    if (resolution.kind !== "known") {
      mapping.warnings.push(unresolvedSkillWarning(token, resolution));
    } else if (!seen.has(resolution.generatedName)) {
      seen.add(resolution.generatedName);
      addKnownSkill(
        mapping,
        token,
        resolution.generatedName,
        preloads.get(resolution.generatedName),
      );
    }
  }

  return mapping;
}

function addKnownSkill(
  mapping: SkillsMapping,
  token: string,
  generatedName: string,
  preload: SkillPreload | undefined,
): void {
  if (preload === undefined) {
    mapping.emit.push(generatedName);
  } else if (preload.kind === "inline") {
    mapping.inline.push(preload.text);
  } else {
    mapping.warnings.push(skippedPreloadWarning(token, preload.reason));
  }
}

/**
 * D-CF4-04: the warning of a preload that is skipped. Claude Code keeps a
 * skill the model cannot invoke, or a plugin skill with no description, out
 * of the pool it preloads from.
 */
function skippedPreloadWarning(
  token: string,
  reason: Extract<SkillPreload, { kind: "skip" }>["reason"],
): string {
  switch (reason) {
    case "disable-model-invocation":
      return `skill reference "${token}" names a skill with disable-model-invocation: true -- not preloaded (Claude Code skips it too)`;
    case "no-description":
      return `skill reference "${token}" names a skill with no description -- not preloaded (Claude Code skips it too)`;
    case "unparseable":
      return `skill reference "${token}" names a skill whose frontmatter does not parse -- not preloaded`;
  }
}

function unresolvedSkillWarning(
  token: string,
  resolution: Exclude<SkillReferenceResolution, { kind: "known" }>,
): string {
  if (resolution.kind === "malformed") {
    hookDebugLog(`generatedSkillName rejected skill token "${token}": ${resolution.reason}`);
    return `malformed skill reference "${token}" -- dropped`;
  }

  if (resolution.kind === "foreign") {
    return `skill reference "${token}" is qualified with a different plugin -- dropped (only this plugin's skills can be preloaded)`;
  }

  return `unknown skill reference "${token}" -- dropped`;
}

/**
 * D-CF4-04: the converted body, then each inlined skill text after one blank
 * line, in `skills:` order. Residuals: the texts sit in the system prompt,
 * not in Claude Code's first user message, because pi-subagents has no hook
 * on a child's first message; `$ARGUMENTS` and inline `!` commands stay
 * literal; the cross-plugin fallback and the frontmatter-name alias lookup
 * are not modeled.
 */
function bodyWithPreloads(body: string, inline: readonly string[]): string {
  return inline.length === 0 ? body : [body.trimEnd(), ...inline].join("\n\n");
}

// A frontmatter value trimmed, or undefined when it is not a string or is
// blank, so a blank value counts as missing.
function nonBlank(value: unknown): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed === "" ? undefined : trimmed;
}

/**
 * D-CF4-03: the description Claude Code lists for a plugin agent, in the
 * order of Claude Code's `zie` lookup: the first non-blank value of
 * `description`, `when_to_use`, and `when-to-use`, trimmed, and otherwise
 * `Agent from <plugin> plugin`.
 * `sourceDescriptionMissing` is true when `description` itself is missing or
 * blank.
 */
function agentDescription(
  raw: RawAgentFrontmatter,
  pluginName: string,
): { description: string; sourceDescriptionMissing: boolean } {
  const sourceDescription = nonBlank(raw.description);
  const description =
    sourceDescription ??
    nonBlank(raw.when_to_use) ??
    nonBlank(raw["when-to-use"]) ??
    `Agent from ${pluginName} plugin`;
  return { description, sourceDescriptionMissing: sourceDescription === undefined };
}

/** The arguments of `convertAgent`. */
export interface ConvertAgentInput {
  pluginName: string;
  pluginRoot: string;
  pluginDataDir: string;
  knownSkills: readonly string[];
  referenceNames?: InstalledReferenceNames | undefined;
  discovered: DiscoveredAgent;
  sourceHash: string;
  /**
   * AG-7 opt-in. When false (the default at the call sites), the AG-7
   * model-mapping table is NOT consulted and the generated frontmatter
   * omits `model:` entirely (Pi picks its own default). When true (only
   * passed when the user supplies `--map-model` on install/update), the
   * mapping table applies. The marketplace autoupdate cascade never passes
   * this flag, so cascade-driven re-installs always omit `model:`.
   */
  mapModel: boolean;
  /**
   * SUB-02: the install cwd (project root) substituted for
   * `${CLAUDE_PROJECT_DIR}` in the agent body. Supplied only for
   * project-scope installs; absent leaves the token literal (pass-through).
   */
  projectDir?: string | undefined;
  /**
   * ANAME-02 / MGRT-01: the declared names of the MCP servers the rendered
   * form maps, the servers its implementation runs. An agent's Claude-form MCP
   * names of these servers map to pi-subagents `mcp:` entries; every other
   * `mcp__` name is dropped, so a caller leaves out a server the
   * implementation cannot run.
   */
  mcpServerNames?: readonly string[] | undefined;
  /**
   * MGRT-01: the MCP implementation whose grant form the file gets: the
   * `mcp:` selectors, the per-tool `excludeTools` names, and the D-CF6-10
   * async warning. Absent means the adapter form.
   */
  mcpImplementation?: McpImplementationId | undefined;
  /**
   * D-CF4-04: the preloads the stage read, keyed by generated skill name. A
   * known `skills:` reference with no entry stays a `skills:` entry.
   */
  skillPreloads?: ReadonlyMap<string, SkillPreload> | undefined;
}

/**
 * AG-7 / PI-10 / D-08 corollary: pure conversion. Performs all field
 * mappings, substitutes ${CLAUDE_PLUGIN_ROOT}/${CLAUDE_PLUGIN_DATA} in the
 * body via shared/vars.ts, and assembles the file content via the
 * frontmatter emitter.
 *
 * AG-11: throws Error when an explicit `tools:` declaration maps to an empty
 * list (pi-subagents reads an empty allowlist as "no tools", which has no
 * safe representation). An omitted `tools:` is NOT an error -- the generated
 * frontmatter omits the allowlist so pi-subagents grants its default
 * builtins (#179). Error message lists source tools and disallowedTools so
 * the user can correct upstream.
 */
export function convertAgent(input: ConvertAgentInput): ConvertedAgent {
  const conversion = convertAgentOrEmpty(input);
  if (conversion.kind === "empty-tools") {
    throw emptyToolListError(input.discovered.raw, input.discovered.sourceName, input.pluginName);
  }

  return conversion.agent;
}

/**
 * MGRT-01 / AG-11 per form: the conversion `convertAgent` performs, or
 * `undefined` where `convertAgent` refuses with AG-11 because an explicit
 * `tools:` list maps to nothing in this form. The stage renders the grant
 * form the file does not get through it, so that form's empty list leaves
 * the form out instead of failing the staging.
 */
export function convertAgentForm(input: ConvertAgentInput): ConvertedAgent | undefined {
  const conversion = convertAgentOrEmpty(input);
  return conversion.kind === "converted" ? conversion.agent : undefined;
}

/**
 * The outcome of one conversion: the converted agent, or the AG-11 case of
 * an explicit `tools:` list that maps to nothing. Each export decides what
 * the empty case means for its caller.
 */
type AgentConversion =
  { readonly kind: "converted"; readonly agent: ConvertedAgent } | { readonly kind: "empty-tools" };

function convertAgentOrEmpty(input: ConvertAgentInput): AgentConversion {
  const {
    pluginName,
    pluginRoot,
    pluginDataDir,
    knownSkills,
    referenceNames,
    discovered,
    sourceHash,
    mapModel: mapModelFlag,
    projectDir,
    mcpServerNames,
    mcpImplementation = "adapter",
  } = input;
  const { raw, body, sourceName, generatedName, sourcePath } = discovered;

  // AG-1a: the name the file DECLARES, which is not the name it is stored
  // under. `generatedName` stays the basename so the AG-5 ownership marker
  // keeps matching; `declaredName` is what pi-subagents takes as the agent's
  // localName and what the host workflow engine keys its agentType registry
  // on, so a bridged workflow's agent({ agentType }) call resolves.
  // D-CF4-01: a nested file's folders name it as Claude Code does,
  // `<plugin>:<folder>...:<name>`.
  const declaredName = declaredAgentName(pluginName, sourceName, discovered.namespace);

  const warnings: string[] = [];

  // 1. Description (with fallback)
  const { description, sourceDescriptionMissing } = agentDescription(raw, pluginName);
  if (sourceDescriptionMissing) {
    warnings.push("source description was missing or empty -- using fallback");
  }

  // 2. Model mapping. AG-7 is opt-in: when `mapModel` is false the
  //    generated frontmatter omits `model:` entirely (no mapping, no
  //    originalModel provenance, no unknown-model warning -- absence is
  //    self-documenting). When true the mapping table applies.
  const modelResult = mapModelFlag
    ? mapModel(raw.model)
    : { emit: undefined, originalModel: undefined, warning: undefined };
  if (modelResult.warning !== undefined) {
    warnings.push(modelResult.warning);
  }

  // 3. Tools mapping
  const toolsResult = mapTools(
    raw.tools,
    raw.disallowedTools,
    buildMcpGrants(pluginName, mcpServerNames, mcpImplementation),
  );
  if (!hasMappedTools(toolsResult)) {
    return { kind: "empty-tools" };
  }

  warnings.push(...toolsResult.warnings);
  const backgroundForMcp = runsMcpTools(toolsResult, mcpServerNames);
  if (backgroundForMcp) {
    warnings.push(mcpAsyncWarning(mcpImplementation));
  }

  // 4. Thinking / effort mapping
  const thinkingResult = mapThinking(raw.thinking, raw.effort);
  if (thinkingResult.warning !== undefined) {
    warnings.push(thinkingResult.warning);
  }

  // 5. Skills mapping (D-CF4-04: preloaded skills are inlined or skipped)
  const skillsResult = mapSkills(
    raw.skills,
    pluginName,
    knownSkills,
    input.skillPreloads ?? new Map(),
  );
  warnings.push(...skillsResult.warnings);

  // 6. Dropped fields (anything in source frontmatter that isn't supported).
  const droppedFields: string[] = [];
  for (const key of Object.keys(raw)) {
    if (!SUPPORTED_SOURCE_FIELDS.has(key)) {
      droppedFields.push(key);
    }
  }

  warnings.push(...droppedFieldWarnings(droppedFields, declaredName));

  // 7. Substitute plugin variables in the body (PI-10).
  // D-08 corollary: the shared primitive sides with PI-10 -- agents DO get
  // substitution.
  // SUB-02: projectDir is scope-gated upstream (agents/stage.ts). Agents are
  // not skill-scoped, so no skillDir is supplied and ${CLAUDE_SKILL_DIR} stays
  // literal via the helper's pass-through.
  const substitutedBody = substituteClaudeVars(body, {
    pluginRoot,
    pluginData: pluginDataDir,
    projectDir,
  });

  // Resolve references against the names that this install stages.
  const convertedBody = rewriteMarkdownReferences(
    substitutedBody,
    pluginName,
    referenceNames ?? { skills: knownSkills, commands: [], workflows: [] },
  );

  // 8. Hand off to the frontmatter emitter for final assembly. From here on,
  //    parser-safety (YAML quote-flipping, newline normalization, field
  //    ordering) lives behind a single seam. The frontmatter block comes
  //    from the same fields, so the file is that block followed by the body
  //    (MGRT-01).
  const emitted = {
    frontmatter: {
      name: declaredName,
      description,
      aliases: [generatedName],
      ...optionalModel(modelResult.emit),
      ...toolsFields(toolsResult),
      ...optionalThinking(thinkingResult.emit),
      skills: skillsResult.emit,
      inheritSkills: toolsResult.inheritSkills,
      async: backgroundForMcp || isTrueBackground(raw.background),
    },
    provenance: {
      pluginName,
      sourceName,
      sourcePath,
      ...(modelResult.originalModel !== undefined && { originalModel: modelResult.originalModel }),
      droppedFields,
      droppedTools: toolsResult.dropped,
      warnings,
    },
  };
  const fileContent = emitGeneratedAgentFile({
    ...emitted,
    body: bodyWithPreloads(convertedBody, skillsResult.inline),
  });

  const result: ConvertedAgent = {
    sourceName,
    generatedName,
    sourcePath,
    fileContent,
    frontmatter: emitGeneratedAgentFrontmatter(emitted),
    sourceHash,
    droppedFields,
    droppedTools: toolsResult.dropped,
    warnings,
    ...(modelResult.originalModel !== undefined && { originalModel: modelResult.originalModel }),
  };

  return { kind: "converted", agent: result };
}

/**
 * D-CF4-05: whether the source asks for a background launch. Claude Code runs
 * a plugin agent in the foreground unless its source sets `background` to
 * `true` or `"true"`, so the agent gets `async: true` for that value and
 * `async: false` otherwise, which replaces pi-subagents' background default.
 * Residual: a pi-subagents call can still ask for either launch mode, where
 * Claude Code forces the background for `background: true`.
 *
 * D-CF6-10 amends D-CF4-05: an agent that runs plugin MCP tools always gets
 * `async: true`, even for `background: false`. pi-subagents 0.84.0 loads no
 * ambient extension, pi-mcp-adapter among them, into a foreground child
 * (its docs/agents.md), so a foreground launch could not reach the tools.
 */
function isTrueBackground(rawBackground: unknown): boolean {
  return typeof rawBackground === "string" && withoutMatchingQuotes(rawBackground) === "true";
}

/**
 * An explicit list that maps an `mcp:` entry, or an omitted list, which
 * grants the ambient tools, in a plugin that writes MCP servers.
 */
function runsMcpTools(
  toolsResult: ToolMappingResult,
  mcpServerNames: readonly string[] | undefined,
): boolean {
  if (toolsResult.omitted) {
    return (mcpServerNames ?? []).length > 0;
  }

  return toolsResult.mapped.some((name) => name.startsWith("mcp:"));
}

function optionalModel(model: string | undefined): { model?: string } {
  return model === undefined ? {} : { model };
}

/**
 * AG-11: whether a tool mapping is representable -- an omitted `tools:`, or
 * an explicit one that maps to at least one entry. pi-subagents reads an
 * empty allowlist as "no tools", which has no safe representation.
 */
function hasMappedTools(toolsResult: ToolMappingResult): toolsResult is ValidatedToolMapping {
  return toolsResult.omitted || toolsResult.mapped.length > 0;
}

/**
 * AG-11: the error for an explicit `tools:` declaration whose mapped list is
 * empty. The message includes source values so the user can correct
 * upstream. AGSK-03 / D-83.1-02 (#86): Skill is silently excluded from
 * classification (it maps to inheritSkills, not a Pi tool), so a
 * `tools: Skill`-only agent would otherwise see one declared tool produce
 * zero mapped tools with no explanation -- the note is appended whenever
 * Skill was among the raw source tokens. The `?? "(omitted)"` label covers a
 * malformed `raw.tools` accessor whose value disappears between reads
 * (pinned by the malformed-accessor test); a genuinely omitted `tools:`
 * never reaches the error (#179).
 */
function emptyToolListError(
  raw: RawAgentFrontmatter,
  sourceName: string,
  pluginName: string,
): Error {
  const skillNote = splitToolList(raw.tools).some(isSkillToken)
    ? " Note: the Skill tool maps to inheritSkills, not to a Pi tool, so it does not count toward the tool list."
    : "";
  return new Error(
    `Cannot convert agent "${sourceName}" in plugin "${pluginName}": ` +
      `the mapped tool list is empty (pi-subagents has no safe representation of "no tools"). ` +
      `Source tools: ${raw.tools ?? "(omitted)"}; ` +
      `disallowedTools: ${raw.disallowedTools ?? "(none)"}.${skillNote}`,
  );
}

/**
 * AG-11 / #179: an explicit source `tools:` declaration emits a non-empty
 * allowlist; an omitted one emits no `tools:` at all, so pi-subagents
 * grants its default builtin tools, with disallowedTools narrowing that
 * set via excludeTools. The GeneratedToolsFields return type is what keeps
 * the two lines from ever rendering together. The validated mapping carries
 * the nonempty explicit list proved by hasMappedTools, so the
 * emitter does not need a second runtime check.
 */
function toolsFields(result: ValidatedToolMapping): GeneratedToolsFields {
  if (result.omitted) {
    const [first, ...rest] = result.excludeTools;
    return first === undefined ? {} : { excludeTools: [first, ...rest] };
  }

  return { tools: result.mapped };
}

/**
 * #179: targeted guidance for dropped fields that read like conversion gaps
 * but are upstream-parity drops. Claude Code's sub-agents documentation
 * states plugin subagents do not support `hooks`, `mcpServers`, or
 * `permissionMode` (the fields are ignored when agents load from a plugin),
 * and `allowed-tools` is a slash-command field absent from the agent
 * frontmatter schema. Dropping them here matches upstream, so each warning
 * points at the mechanism that does work instead. GUIDED_DROPPED_FIELDS is
 * derived from this table, which keeps the stage layer's generic
 * `dropped fields:` summary and these warnings in lockstep.
 *
 * D-CF4-05: Claude Code 2.1.316 also ignores `initialPrompt`, `observer`,
 * `observerMessage`, and `observeSubagents` for plugin agents, with a
 * warning of its own, so each gets the same guided warning. `memory`,
 * `maxTurns`, `isolation`, `color`, `omitClaudeMd`, `autoCompactWindow`, and
 * `experimental`, which Claude Code applies, stay in the generic line.
 */
function pluginIgnoredFieldWarning(field: string): string {
  return `agent-level \`${field}\` is not converted -- dropped (Claude Code ignores it for plugin agents too).`;
}

const GUIDED_DROPPED_FIELD_WARNINGS: Readonly<Record<string, (declaredName: string) => string>> =
  Object.freeze({
    "allowed-tools": (): string =>
      "`allowed-tools` is a slash-command field, not an agent frontmatter field -- dropped (Claude Code ignores it on agents too). Declare `tools:` in the source agent instead.",
    mcpServers: (declaredName: string): string =>
      "agent-level `mcpServers` is not converted -- dropped (Claude Code ignores it for plugin agents too). " +
      `To grant this agent MCP tools, set subagents.agentOverrides["${declaredName}"].tools ` +
      "(e.g. read,bash,mcp:<server>) in Pi settings.",
    permissionMode: (): string =>
      "agent-level `permissionMode` is not converted -- dropped (Claude Code ignores it for plugin agents too).",
    hooks: (): string =>
      "agent-level `hooks` is not converted -- dropped (Claude Code ignores it for plugin agents too; plugin-level hooks/hooks.json still installs).",
    initialPrompt: (): string => pluginIgnoredFieldWarning("initialPrompt"),
    observer: (): string => pluginIgnoredFieldWarning("observer"),
    observerMessage: (): string => pluginIgnoredFieldWarning("observerMessage"),
    observeSubagents: (): string => pluginIgnoredFieldWarning("observeSubagents"),
  });

/**
 * #179: dropped fields that carry a targeted warning from the table above.
 * The stage layer's generic `dropped fields:` summary line skips these so
 * the user is not told about the same field twice.
 */
export const GUIDED_DROPPED_FIELDS: ReadonlySet<string> = new Set(
  Object.keys(GUIDED_DROPPED_FIELD_WARNINGS),
);

function droppedFieldWarnings(droppedFields: readonly string[], declaredName: string): string[] {
  const warnings: string[] = [];
  for (const [field, warningFor] of Object.entries(GUIDED_DROPPED_FIELD_WARNINGS)) {
    if (droppedFields.includes(field)) {
      warnings.push(warningFor(declaredName));
    }
  }

  return warnings;
}

function optionalThinking(thinking: string | undefined): { thinking?: string } {
  return thinking === undefined ? {} : { thinking };
}
