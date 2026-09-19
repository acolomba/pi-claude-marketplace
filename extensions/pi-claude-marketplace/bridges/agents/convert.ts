// bridges/agents/convert.ts
//
// AG-7 conversion pipeline. Notable details:
//   1. substituteClaudeVars from ../../shared/vars.ts (D-08 / PI-10) handles
//      body substitution per the PI-10 contract.
//   2. generatedSkillName from ../../domain/name.ts is the single source of
//      truth for the skill-legend names this converter resolves; agent name
//      generation (generatedAgentName, complete source name) happens in ./discover.ts,
//      not here.
//   3. discoverPluginAgents lives in ./discover.ts so convert stays pure.
//
// Model, tool, and thinking mappings are user contracts; owner tests assert
// their exact converted output.

import { generatedSkillName } from "../../domain/name.ts";
import { escapeRegExp } from "../../shared/regexp.ts";
import { substituteClaudeVars } from "../../shared/vars.ts";

import { emitGeneratedAgentFile } from "./frontmatter.ts";

import type { GeneratedToolsFields, SkillLegendEntry } from "./frontmatter.ts";
import type { ConvertedAgent, DiscoveredAgent, RawAgentFrontmatter } from "./types.ts";

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
  /** Deduped, disallow-filtered Pi allowlist. AG-11 gates it non-empty. */
  readonly mapped: string[];
  /** AGSK-05 / D-83-01: Skill declared in tools: AND not disallowed. */
  readonly inheritSkills: boolean;
}

interface OmittedToolMapping extends ToolMappingBase {
  readonly omitted: true;
  /** Pi names for `excludeTools:` -- source disallowedTools via TOOL_MAP. */
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

/**
 * AGSK-04 / D-82-06 / D-82-07: detect `<pluginName>:<skill>` tokens in the
 * emitted body and build the legend entries.
 *
 * The whole body is scanned verbatim, fenced code blocks included
 * (D-82-07: the legend is aggregated at the top and nothing is rewritten
 * inline, so code-block matches are safe and useful). The lookbehind
 * rejects tokens embedded in a longer word (`other-spec-tree:x` is not a
 * `spec-tree:` reference, and `.` sits in the boundary class so a dotted
 * plugin-name prefix `other.spec-tree:x` is not one either); the
 * candidate class excludes `.` so sentence
 * punctuation never joins a candidate (skill names containing dots would
 * be missed -- none exist in the wild). Only candidates resolving into
 * knownSkills get an entry (D-82-06); cross-plugin and unknown tokens get
 * none. Entries dedupe by full token, first occurrence wins.
 */
function detectSkillTokens(
  body: string,
  pluginName: string,
  knownSkills: readonly string[],
): SkillLegendEntry[] {
  const known = new Set(knownSkills);
  const tokenRe = new RegExp(
    `(?<![A-Za-z0-9_.:-])${escapeRegExp(pluginName)}:([A-Za-z0-9_-]+)`,
    "g",
  );
  const seen = new Set<string>();
  const entries: SkillLegendEntry[] = [];
  for (const match of body.matchAll(tokenRe)) {
    const token = match[0];
    const candidate = match[1];
    if (candidate === undefined || seen.has(token)) {
      continue;
    }

    seen.add(token);
    // generatedSkillName elides a `<plugin>-` prefix; a candidate of
    // exactly `<plugin>-` would elide to "" and make assertSafeName throw.
    // A body scan must never turn into a throw -- catch the validator (as
    // mapSkills does) and skip the candidate instead of aborting the install.
    let generated: string | null;
    try {
      generated = generatedSkillName(pluginName, candidate);
    } catch {
      generated = null;
    }

    if (generated !== null && known.has(generated)) {
      entries.push({ token, generatedName: generated });
    }
  }

  return entries;
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
 * Map source tool tokens to Pi names via TOOL_MAP; unknown tokens land in
 * `dropped`. Pure mapping/dropping -- no warnings here. AGSK-03 / AGSK-05 /
 * D-83.1-01 / D-83.1-02: `Skill` is excluded from classification entirely
 * (neither mapped nor dropped) because it translates to the `inheritSkills`
 * flag computed in mapTools from the raw tokens -- both branches operate
 * exactly as Claude Code does, so there is no droppedTools entry and no
 * warning in any branch. Every other TOOL_MAP miss still records a
 * `droppedTools` entry.
 */
function mapToolTokens(tokens: readonly string[]): { mapped: string[]; dropped: string[] } {
  const mapped: string[] = [];
  const dropped: string[] = [];
  for (const token of tokens) {
    // AGSK-03 / D-83.1-02: Skill is translated to inheritSkills (computed
    // in mapTools from raw tokens), never dropped -- no droppedTools entry
    // and no warning in any branch. Exact match, like TOOL_MAP lookups.
    if (token === "Skill") {
      continue;
    }

    const piName = TOOL_MAP[token];
    if (piName === undefined) {
      dropped.push(token);
    } else {
      mapped.push(piName);
    }
  }

  return { mapped, dropped };
}

function mapTools(
  rawTools: string | undefined,
  rawDisallowed: string | undefined,
): ToolMappingResult {
  // Disallowed values are Claude-side names; map them to Pi names. An
  // unmapped name has no Pi spelling -- nothing to filter from an explicit
  // allowlist, and nothing to emit into `excludeTools`.
  const disallowedTokens = splitCsv(rawDisallowed);
  const disallowedPi: string[] = [];
  for (const token of disallowedTokens) {
    const piName = TOOL_MAP[token];
    if (piName !== undefined) {
      disallowedPi.push(piName);
    }
  }

  if (rawTools === undefined) {
    return omittedToolMapping(disallowedTokens, disallowedPi);
  }

  const tokens = splitCsv(rawTools);

  // AGSK-05 / D-83-01: the inherit flag is computed ONCE from RAW
  // Claude-side tokens -- exact match, case-sensitive "Skill", like
  // TOOL_MAP lookups. The disallow check must read raw tokens because
  // Skill has no TOOL_MAP entry, so the Pi-name filter below can never
  // see it.
  const inheritSkills = tokens.includes("Skill") && !disallowedTokens.includes("Skill");

  // Apply disallowedTools after mapping.
  const { mapped, dropped } = mapToolTokens(tokens);
  const disallowedSet = new Set(disallowedPi);

  return {
    omitted: false,
    mapped: dedupePreservingOrder(mapped.filter((name) => !disallowedSet.has(name))),
    dropped,
    warnings: [],
    inheritSkills,
  };
}

/**
 * #179: when source omits `tools:` entirely, Claude grants the agent every
 * tool available to subagents. The faithful pi-subagents equivalent is
 * omitting the allowlist -- the child then gets Pi's normal builtin tools
 * (and, for background children, ambient extension tools such as
 * pi-mcp-adapter's MCP tools). disallowedTools narrows that default set via
 * excludeTools (pi-subagents 0.62.0; earlier versions store-and-ignore the
 * key). Both degradations on that path warn: a disallow token with no
 * TOOL_MAP entry cannot narrow anything, and an emitted excludeTools is
 * inert below the version floor -- each is an author-written restriction
 * that must not weaken without a trace.
 */
function omittedToolMapping(
  disallowedTokens: readonly string[],
  disallowedPi: readonly string[],
): OmittedToolMapping {
  const warnings: string[] = [];
  // Skill is excluded: it maps to inheritSkills below, not to a Pi tool.
  const unmapped = dedupePreservingOrder(
    disallowedTokens.filter((token) => token !== "Skill" && TOOL_MAP[token] === undefined),
  );
  if (unmapped.length > 0) {
    warnings.push(
      `disallowedTools entries with no Pi tool mapping (${unmapped.join(", ")}) cannot narrow the default tool set -- ignored`,
    );
  }

  const excludeTools = dedupePreservingOrder(disallowedPi);
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

/** Pick the `thinking:` value to emit.
 *
 *  Per the plan, "thinking wins over effort." Implementation choice for the
 *  edge case where `thinking` is set BUT invalid: fall back to `effort` only
 *  if `effort` is set and valid; otherwise omit.
 *
 *  - thinking set and valid       -> emit thinking
 *  - thinking set and invalid     -> warn; if effort set+valid emit effort, else omit
 *  - thinking absent, effort set+valid -> emit effort
 *  - thinking absent, effort set+invalid -> warn, omit
 *  - both absent -> omit silently
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
    // AGSK-02 (#86): a token qualified with this plugin's own name
    // (`spec-tree:review-changes`) maps like its bare form -- strip the
    // qualifier and delegate to generatedSkillName, whose prefix elision
    // makes both spellings converge. A cross-plugin qualifier is dropped
    // with a warning naming the full token (installability of the other
    // plugin is unknown at convert time).
    let effective = token;
    const colon = token.indexOf(":");
    if (colon !== -1) {
      // Tolerate conventional YAML `key: value` spacing around the colon:
      // `spec-tree: review-changes` and `spec-tree :review-changes`
      // resolve like the tight form instead of silently dropping the
      // preload the user obviously intended.
      const qualifier = token.slice(0, colon).trim();
      const rest = token.slice(colon + 1).trim();
      if (qualifier !== pluginName) {
        warnings.push(
          `skill reference "${token}" is qualified with a different plugin -- dropped (only this plugin's skills can be preloaded)`,
        );
        continue;
      }

      effective = rest;
    }

    // AGSK-02 (#86): assertSafeName rejects empty, "." / "..", path
    // separators, and control characters. A warn-drop must never become a
    // throw -- catch the validator instead of enumerating its conditions,
    // so every unsafe token (qualified remainder or bare) falls through to
    // the unknown-reference drop below.
    let generated: string | null;
    try {
      generated = generatedSkillName(pluginName, effective);
    } catch {
      generated = null;
    }

    if (generated !== null && known.has(generated)) {
      emit.push(generated);
    } else {
      // The warning names the FULL original token (qualifier included) so
      // the user can find it verbatim in the source frontmatter.
      warnings.push(`unknown skill reference "${token}" -- dropped`);
    }
  }

  // Mirror mapTools: collapse duplicate generated skill names so the emitter
  // never renders a repeated `skills:` entry. A bare token and its same-plugin
  // self-qualified form (AGSK-02) converge on one generated name.
  return { emit: dedupePreservingOrder(emit), warnings };
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
export function convertAgent(input: {
  pluginName: string;
  pluginRoot: string;
  pluginDataDir: string;
  knownSkills: readonly string[];
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
}): ConvertedAgent {
  const {
    pluginName,
    pluginRoot,
    pluginDataDir,
    knownSkills,
    discovered,
    sourceHash,
    mapModel: mapModelFlag,
    projectDir,
  } = input;
  const { raw, body, sourceName, generatedName, sourcePath } = discovered;

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
  const toolsResult = mapTools(raw.tools, raw.disallowedTools);
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

  warnings.push(...droppedFieldWarnings(droppedFields, generatedName));

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

  // 7.5 AGSK-04: detect same-plugin skill tokens in the emitted body and
  //     build the legend. Empty when the body references none -- the
  //     emitter then keeps the byte-identical no-legend layout
  //     (reference-gated).
  const legend = detectSkillTokens(substitutedBody, pluginName, knownSkills);

  // 8. Hand off to the frontmatter emitter for final assembly. From here on,
  //    parser-safety (YAML quote-flipping, newline normalization, field
  //    ordering) lives behind a single seam.
  const fileContent = emitGeneratedAgentFile({
    frontmatter: {
      name: generatedName,
      description,
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
    body: substitutedBody,
    legend,
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
 * AG-11: reject an explicit `tools:` declaration whose mapped list is empty
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
const GUIDED_DROPPED_FIELD_WARNINGS: Readonly<Record<string, (generatedName: string) => string>> =
  Object.freeze({
    "allowed-tools": (): string =>
      "`allowed-tools` is a slash-command field, not an agent frontmatter field -- dropped (Claude Code ignores it on agents too). Declare `tools:` in the source agent instead.",
    mcpServers: (generatedName: string): string =>
      "agent-level `mcpServers` is not converted -- dropped (Claude Code ignores it for plugin agents too). " +
      `To grant this agent MCP tools, set subagents.agentOverrides["${generatedName}"].tools ` +
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

function droppedFieldWarnings(droppedFields: readonly string[], generatedName: string): string[] {
  const warnings: string[] = [];
  for (const [field, warningFor] of Object.entries(GUIDED_DROPPED_FIELD_WARNINGS)) {
    if (droppedFields.includes(field)) {
      warnings.push(warningFor(generatedName));
    }
  }

  return warnings;
}

function optionalThinking(thinking: string | undefined): { thinking?: string } {
  return thinking === undefined ? {} : { thinking };
}
