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

import { declaredAgentName, generatedMcpServerKey } from "../../domain/name.ts";
import { resolveSkillReference, rewriteMarkdownReferences } from "../../domain/skill-tokens.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { substituteClaudeVars } from "../../shared/vars.ts";

import { emitGeneratedAgentFile } from "./frontmatter.ts";

import type { GeneratedToolsFields } from "./frontmatter.ts";
import type { ConvertedAgent, DiscoveredAgent, RawAgentFrontmatter } from "./types.ts";
import type { InstalledReferenceNames } from "../../domain/skill-tokens.ts";

/**
 * Source frontmatter fields the converter actively consumes. Anything else
 * is recorded in droppedFields.
 */
const SUPPORTED_SOURCE_FIELDS = new Set([
  "name",
  "description",
  "model",
  "tools",
  "disallowedTools",
  "thinking",
  "effort",
  "skills",
]);

/**
 * AG-7 user contract: allowlisted Claude model strings. Anything else is
 * omitted from the generated frontmatter.
 */
const MODEL_MAP: Readonly<Record<string, string>> = Object.freeze({
  sonnet: "anthropic/claude-sonnet-4-6",
  opus: "anthropic/claude-opus-4-7",
  haiku: "anthropic/claude-haiku-4-5",
});

/**
 * AG-7 user contract: Claude tool name -> Pi tool name. Tokens not present
 * here are dropped.
 */
const TOOL_MAP: Readonly<Record<string, string>> = Object.freeze({
  Read: "read",
  Bash: "bash",
  Edit: "edit",
  Write: "write",
  Grep: "grep",
  Glob: "find",
  LS: "ls",
});

/**
 * ANAME-02: one MCP server this install writes. `key` is the server's
 * pi-mcp-adapter key, which pi-subagents `mcp:` entries name; `claudePrefix`
 * is the Claude Code tool-name prefix of the same server, `mcp__` plus the key
 * without its trailing `_`.
 */
interface McpGrant {
  readonly key: string;
  readonly claudePrefix: string;
}

/** ANAME-02: a Claude-form MCP name matched to a written server. */
interface McpGrantMatch {
  /** `mcp:<key>`, the pi-subagents entry for every tool of the server. */
  readonly server: string;
  /** The raw MCP tool name; absent when the name covers the whole server. */
  readonly tool?: string;
}

/**
 * ANAME-02: the pi-subagents form of a disallowed MCP name on an explicit
 * `tools:` list. `exact` holds the Pi names and `mcp:` entries to remove;
 * `servers` holds the `mcp:<key>` of each disallowed whole server, whose
 * per-tool entries are removed too. `perTool` keeps each per-tool disallow
 * with its source token for the cannot-narrow warning.
 */
interface ExplicitDisallow {
  readonly exact: ReadonlySet<string>;
  readonly servers: ReadonlySet<string>;
  readonly perTool: readonly { readonly token: string; readonly server: string }[];
}

const MCP_ASYNC_WARNING =
  "tools include MCP tools, which pi-subagents runs only in background launches -- " +
  "launch this agent with `async: true`; a foreground launch fails, and so does a launch " +
  "before pi-mcp-adapter has cached the server's tools";

/** Allowlist for thinking/effort values. */
const THINKING_VALUES: ReadonlySet<string> = new Set([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
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
   * per-tool MCP name of a written server verbatim, because the Claude name
   * is the delivered tool name (ANAME-02).
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

function splitCsv(value: string | undefined): string[] {
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

  return raw
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ) {
        return trimmed.slice(1, -1);
      }

      return trimmed;
    })
    .filter((part) => part !== "");
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

function mapModel(raw: string | undefined): {
  emit: string | undefined;
  originalModel: string | undefined;
  warning: string | undefined;
} {
  if (raw === undefined || raw === "") {
    return { emit: undefined, originalModel: undefined, warning: undefined };
  }

  if (raw === "inherit") {
    return { emit: undefined, originalModel: "inherit", warning: undefined };
  }

  const mapped = MODEL_MAP[raw];
  if (mapped !== undefined) {
    return { emit: mapped, originalModel: raw, warning: undefined };
  }

  return {
    emit: undefined,
    originalModel: raw,
    warning: `unknown model "${raw}" -- omitted from generated frontmatter`,
  };
}

/**
 * ANAME-02: the grant table of the MCP servers this install writes, longest
 * Claude prefix first, so a token that two prefixes match takes the longer
 * one. Each key comes from `generatedMcpServerKey`, the only normalization
 * of a server name.
 */
function buildMcpGrants(
  pluginName: string,
  serverNames: readonly string[] | undefined,
): readonly McpGrant[] {
  const grants = (serverNames ?? []).map((server) => {
    const key = generatedMcpServerKey(pluginName, server);
    return { key, claudePrefix: `mcp__${key.slice(0, -1)}` };
  });
  grants.sort((a, b) => b.claudePrefix.length - a.claudePrefix.length);
  return grants;
}

/**
 * ANAME-02: matches a Claude-form MCP name against the written servers.
 * `<prefix>` and `<prefix>__*` name the whole server; `<prefix>__<tool>`
 * names one tool. Matching is exact and case-sensitive. An empty tool part
 * matches nothing, and neither does a tool part holding `/`: Claude Code
 * never puts `/` in a tool name, and pi-subagents splits `mcp:` entries on
 * the first `/`.
 */
function matchMcpGrant(token: string, grants: readonly McpGrant[]): McpGrantMatch | undefined {
  const grant = grants.find(
    (candidate) =>
      token === candidate.claudePrefix || token.startsWith(`${candidate.claudePrefix}__`),
  );
  if (grant === undefined) {
    return undefined;
  }

  const server = `mcp:${grant.key}`;
  const tool = token.slice(grant.claudePrefix.length + 2);
  if (token === grant.claudePrefix || tool === "*") {
    return { server };
  }

  return tool === "" || tool.includes("/") ? undefined : { server, tool };
}

function mcpEntry(match: McpGrantMatch): string {
  return match.tool === undefined ? match.server : `${match.server}/${match.tool}`;
}

/** A TOOL_MAP name, or the `mcp:` entry of a written server's MCP name. */
function mapToolName(token: string, grants: readonly McpGrant[]): string | undefined {
  const piName = TOOL_MAP[token];
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
    if (token === "Skill") {
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
  const disallowedTokens = splitCsv(rawDisallowed);
  if (rawTools === undefined) {
    return omittedToolMapping(disallowedTokens, grants);
  }

  const tokens = splitCsv(rawTools);

  // AGSK-05 / D-83-01: the inherit flag is computed ONCE from RAW
  // Claude-side tokens -- exact match, case-sensitive "Skill", like
  // TOOL_MAP lookups. The disallow check must read raw tokens because
  // Skill has no TOOL_MAP entry, so the Pi-name filter below can never
  // see it.
  const inheritSkills = tokens.includes("Skill") && !disallowedTokens.includes("Skill");

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
 * ANAME-02: pi-subagents takes no `excludeTools` beside an explicit `tools:`
 * list, so a per-tool disallow cannot narrow a whole-server grant that
 * survives the filter, and it warns. Any `mcp:` entry in the final list
 * needs a background launch, which this extension states and never injects.
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
  if (kept.some((name) => name.startsWith("mcp:"))) {
    warnings.push(MCP_ASYNC_WARNING);
  }

  return dedupePreservingOrder(warnings);
}

/**
 * ANAME-02: a per-tool MCP name of a written server, verbatim. A whole-server
 * name has no `excludeTools` form.
 */
function perToolMcpName(token: string, grants: readonly McpGrant[]): string | undefined {
  return matchMcpGrant(token, grants)?.tool === undefined ? undefined : token;
}

/**
 * #179: when source omits `tools:` entirely, Claude grants the agent every
 * tool available to subagents. The faithful pi-subagents equivalent is
 * omitting the allowlist -- the child then gets Pi's normal builtin tools
 * (and, for background children, ambient extension tools such as
 * pi-mcp-adapter's MCP tools). disallowedTools narrows that default set via
 * excludeTools (pi-subagents 0.62.0; earlier versions store-and-ignore the
 * key). A per-tool MCP name of a written server joins excludeTools verbatim
 * (ANAME-02). Both degradations on that path warn: a disallow token with no
 * such mapping cannot narrow anything, and an emitted excludeTools is inert
 * below the version floor -- each is an author-written restriction that must
 * not weaken without a trace.
 */
function omittedToolMapping(
  disallowedTokens: readonly string[],
  grants: readonly McpGrant[],
): OmittedToolMapping {
  const excluded: string[] = [];
  const unmapped: string[] = [];
  for (const token of disallowedTokens) {
    // Skill is excluded: it maps to inheritSkills below, not to a Pi tool.
    if (token === "Skill") {
      continue;
    }

    const name = TOOL_MAP[token] ?? perToolMcpName(token, grants);
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
    inheritSkills: !disallowedTokens.includes("Skill"),
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
 */
function mapThinking(
  rawThinking: string | undefined,
  rawEffort: string | undefined,
): { emit: string | undefined; warning: string | undefined } {
  if (rawThinking !== undefined && rawThinking !== "") {
    if (THINKING_VALUES.has(rawThinking)) {
      return { emit: rawThinking, warning: undefined };
    }

    // thinking present but invalid -- try effort as documented fallback
    if (rawEffort !== undefined && rawEffort !== "" && THINKING_VALUES.has(rawEffort)) {
      return {
        emit: rawEffort,
        warning: `unknown thinking value "${rawThinking}" -- using effort "${rawEffort}" as fallback`,
      };
    }

    return {
      emit: undefined,
      warning: `unknown thinking value "${rawThinking}" -- omitted from generated frontmatter`,
    };
  }

  if (rawEffort !== undefined && rawEffort !== "") {
    if (THINKING_VALUES.has(rawEffort)) {
      return { emit: rawEffort, warning: undefined };
    }

    return {
      emit: undefined,
      warning: `unknown effort value "${rawEffort}" -- omitted from generated frontmatter`,
    };
  }

  return { emit: undefined, warning: undefined };
}

function mapSkills(
  rawSkills: string | undefined,
  pluginName: string,
  knownSkills: readonly string[],
): { emit: string[]; warnings: string[] } {
  const tokens = splitCsv(rawSkills);
  if (tokens.length === 0) {
    return { emit: [], warnings: [] };
  }

  const known = new Set(knownSkills);
  const emit: string[] = [];
  const warnings: string[] = [];
  for (const token of tokens) {
    const resolution = resolveSkillReference(pluginName, token, known);
    if (resolution.kind === "known") {
      emit.push(resolution.generatedName);
    } else if (resolution.kind === "malformed") {
      hookDebugLog(`generatedSkillName rejected skill token "${token}": ${resolution.reason}`);
      warnings.push(`malformed skill reference "${token}" -- dropped`);
    } else if (resolution.kind === "foreign") {
      warnings.push(
        `skill reference "${token}" is qualified with a different plugin -- dropped (only this plugin's skills can be preloaded)`,
      );
    } else {
      warnings.push(`unknown skill reference "${token}" -- dropped`);
    }
  }

  // Mirror mapTools: collapse duplicate generated skill names so the emitter
  // never renders a repeated `skills:` entry. A bare token and its same-plugin
  // self-qualified form (AGSK-02) converge on one generated name.
  return { emit: dedupePreservingOrder(emit), warnings };
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
   * ANAME-02: the declared names of the MCP servers this install writes. An
   * agent's Claude-form MCP names of these servers map to pi-subagents `mcp:`
   * entries; every other `mcp__` name is dropped.
   */
  mcpServerNames?: readonly string[] | undefined;
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
  } = input;
  const { raw, body, sourceName, generatedName, sourcePath } = discovered;

  // AG-1a: the name the file DECLARES, which is not the name it is stored
  // under. `generatedName` stays the basename so the AG-5 ownership marker
  // keeps matching; `declaredName` is what pi-subagents takes as the agent's
  // localName and what the host workflow engine keys its agentType registry
  // on, so a bridged workflow's agent({ agentType }) call resolves.
  const declaredName = declaredAgentName(pluginName, sourceName);

  const warnings: string[] = [];

  // 1. Description (with fallback)
  let description = raw.description ?? "";
  if (description === "") {
    description = `Imported Claude Code plugin agent ${sourceName} from plugin ${pluginName}.`;
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
    buildMcpGrants(pluginName, mcpServerNames),
  );
  assertMappedToolsNonEmpty(toolsResult, { raw, sourceName, pluginName });
  warnings.push(...toolsResult.warnings);

  // 4. Thinking / effort mapping
  const thinkingResult = mapThinking(raw.thinking, raw.effort);
  if (thinkingResult.warning !== undefined) {
    warnings.push(thinkingResult.warning);
  }

  // 5. Skills mapping
  const skillsResult = mapSkills(raw.skills, pluginName, knownSkills);
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
  //    ordering) lives behind a single seam.
  const fileContent = emitGeneratedAgentFile({
    frontmatter: {
      name: declaredName,
      description,
      aliases: [generatedName],
      ...optionalModel(modelResult.emit),
      ...toolsFields(toolsResult),
      ...optionalThinking(thinkingResult.emit),
      skills: skillsResult.emit,
      inheritSkills: toolsResult.inheritSkills,
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
    body: convertedBody,
  });

  const result: ConvertedAgent = {
    sourceName,
    generatedName,
    sourcePath,
    fileContent,
    sourceHash,
    droppedFields,
    droppedTools: toolsResult.dropped,
    warnings,
    ...(modelResult.originalModel !== undefined && { originalModel: modelResult.originalModel }),
  };

  return result;
}

function optionalModel(model: string | undefined): { model?: string } {
  return model === undefined ? {} : { model };
}

/**
 * AG-11: rejects an explicit `tools:` declaration whose mapped list is empty
 * -- pi-subagents reads an empty allowlist as "no tools", which has no safe
 * representation. The message includes source values so the user can correct
 * upstream. AGSK-03 / D-83.1-02 (#86): Skill is silently excluded from
 * classification (it maps to inheritSkills, not a Pi tool), so a
 * `tools: Skill`-only agent would otherwise see one declared tool produce
 * zero mapped tools with no explanation -- the note is appended whenever
 * Skill was among the raw source tokens. The `?? "(omitted)"` label covers a
 * malformed `raw.tools` accessor whose value disappears between reads
 * (pinned by the malformed-accessor test); a genuinely omitted `tools:`
 * never reaches the throw (#179).
 */
function assertMappedToolsNonEmpty(
  toolsResult: ToolMappingResult,
  input: { raw: RawAgentFrontmatter; sourceName: string; pluginName: string },
): asserts toolsResult is ValidatedToolMapping {
  const { raw, sourceName, pluginName } = input;
  if (toolsResult.omitted || toolsResult.mapped.length > 0) {
    return;
  }

  const skillNote = splitCsv(raw.tools).includes("Skill")
    ? " Note: the Skill tool maps to inheritSkills, not to a Pi tool, so it does not count toward the tool list."
    : "";
  throw new Error(
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
 * the nonempty explicit list proved by assertMappedToolsNonEmpty, so the
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
 */
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
