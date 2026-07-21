// bridges/agents/convert.ts
//
// AG-7 conversion pipeline. Notable details:
//   1. substituteClaudeVars from ../../shared/vars.ts (D-08 / PI-10) handles
//      body substitution per the PI-10 contract.
//   2. generatedAgentName from ../../domain/name.ts is the single source of
//      truth for agent name generation + AG-1 elision.
//   3. discoverPluginAgents lives in ./discover.ts so convert stays pure.
//
// MODEL_MAP, TOOL_MAP, THINKING_VALUES are user contract; tests assert exact
// equality.

import { generatedSkillName } from "../../domain/name.ts";
import { substituteClaudeVars } from "../../shared/vars.ts";

import { emitGeneratedAgentFile } from "./frontmatter.ts";

import type { SkillLegendEntry } from "./frontmatter.ts";
import type { ConvertedAgent, DiscoveredAgent } from "./types.ts";

// Re-export so consumers can import the agent-name generator from the
// agents-bridge surface rather than knowing it lives in domain/.
export { generatedAgentName } from "../../domain/name.ts";

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
export const MODEL_MAP: Readonly<Record<string, string>> = Object.freeze({
  sonnet: "anthropic/claude-sonnet-4-6",
  opus: "anthropic/claude-opus-4-7",
  haiku: "anthropic/claude-haiku-4-5",
});

/**
 * AG-7 user contract: Claude tool name -> Pi tool name. Tokens not present
 * here are dropped.
 */
export const TOOL_MAP: Readonly<Record<string, string>> = Object.freeze({
  Read: "read",
  Bash: "bash",
  Edit: "edit",
  Write: "write",
  Grep: "grep",
  Glob: "find",
  LS: "ls",
});

/** Allowlist for thinking/effort values. */
export const THINKING_VALUES: ReadonlySet<string> = new Set([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]);

interface ToolMappingResult {
  readonly mapped: string[];
  readonly dropped: string[];
  readonly warnings: string[];
  /** AGSK-05 / D-83-01: Skill declared in tools: AND not disallowed. */
  readonly inheritSkills: boolean;
}

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
 * Escape regex metacharacters so a value can be interpolated into a RegExp
 * source verbatim (the MDN escape pattern). Plugin names are
 * assertSafeName-checked but may legally contain `.`; escaping neutralizes
 * the whole metacharacter class.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  // When source omits `tools:` entirely, Claude's documented behavior is to
  // grant the agent all tools; we mirror that with a Read/Bash/Edit default
  // for parity with pi-subagents. Warn so the user sees this implicit
  // default at install time and can pin tools: explicitly if a typo on the
  // key was the actual cause.
  const warnings: string[] = [];
  const tokens =
    rawTools === undefined
      ? ((): string[] => {
          warnings.push(
            "source agent omitted `tools:` -- defaulted to read,bash,edit. Add `tools: read,bash,edit` (or your intended subset) to the source agent to silence this warning.",
          );
          return ["Read", "Bash", "Edit"];
        })()
      : splitCsv(rawTools);

  // AGSK-05 / D-83-01: the inherit flag is computed ONCE from RAW
  // Claude-side tokens -- exact match, case-sensitive "Skill", like
  // TOOL_MAP lookups. The disallow check must read raw tokens because
  // Skill has no TOOL_MAP entry, so the Pi-name filter below can never
  // see it. The omitted-tools default (Read/Bash/Edit) contains no Skill,
  // so it never flips the flag.
  const disallowedTokens = splitCsv(rawDisallowed);
  const skillDeclared = tokens.includes("Skill");
  const inheritSkills = skillDeclared && !disallowedTokens.includes("Skill");

  const { mapped, dropped } = mapToolTokens(tokens);

  // Apply disallowedTools after mapping. Disallowed values are Claude-side
  // names; map them to Pi names then filter the mapped list.
  if (disallowedTokens.length > 0) {
    const disallowedPi = new Set<string>();
    for (const token of disallowedTokens) {
      const piName = TOOL_MAP[token];
      if (piName !== undefined) {
        disallowedPi.add(piName);
      }
    }

    if (disallowedPi.size > 0) {
      return {
        mapped: dedupePreservingOrder(mapped.filter((name) => !disallowedPi.has(name))),
        dropped,
        warnings,
        inheritSkills,
      };
    }
  }

  return {
    mapped: dedupePreservingOrder(mapped),
    dropped,
    warnings,
    inheritSkills,
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
 * AG-11: throws Error when mapped tool list is empty (pi-subagents has no
 * safe representation of "no tools"). Error message lists source tools and
 * disallowedTools so the user can correct upstream.
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
}): ConvertedAgent {
  const {
    pluginName,
    pluginRoot,
    pluginDataDir,
    knownSkills,
    discovered,
    sourceHash,
    mapModel: mapModelFlag,
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
  warnings.push(...toolsResult.warnings);
  if (toolsResult.mapped.length === 0) {
    // AG-11: empty mapped tool list. Include source values so the user can
    // correct upstream. AGSK-03 / D-83.1-02 (#86): Skill is silently
    // excluded from classification (it maps to inheritSkills, not a Pi
    // tool), so a `tools: Skill`-only agent would otherwise see one
    // declared tool produce zero mapped tools with no explanation --
    // append the note whenever Skill was among the raw source tokens.
    const skillNote = splitCsv(raw.tools).includes("Skill")
      ? " Note: the Skill tool maps to inheritSkills, not to a Pi tool, so it does not count toward the tool list."
      : "";
    throw new Error(
      `Cannot convert agent "${sourceName}" in plugin "${pluginName}": ` +
        `the mapped tool list is empty (pi-subagents has no safe representation of "no tools"). ` +
        `Source tools: ${raw.tools ?? "(default read,bash,edit)"}; ` +
        `disallowedTools: ${raw.disallowedTools ?? "(none)"}.${skillNote}`,
    );
  }

  // AG-11: the preceding throw guarantees the mapped list is non-empty. The
  // compiler cannot prove that from the length check, so assert the non-empty
  // tuple the frontmatter emitter requires (through `unknown` because a
  // string[] does not structurally overlap the tuple).
  const tools = toolsResult.mapped as unknown as readonly [string, ...string[]];

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

  // 7. Substitute plugin variables in the body (PI-10).
  // D-08 corollary: the shared primitive sides with PI-10 -- agents DO get
  // substitution.
  const substitutedBody = substituteClaudeVars(body, {
    pluginRoot,
    pluginData: pluginDataDir,
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
      tools,
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

function optionalThinking(thinking: string | undefined): { thinking?: string } {
  return thinking === undefined ? {} : { thinking };
}

/**
 * AG-12: detect generated-name collisions across an array of converted /
 * discovered agents. Throws Error listing the colliding generated name and
 * BOTH source names so the user can rename one. Multi-collision messages
 * are joined onto separate lines for readability.
 */
export function assertNoAgentCollisions(
  agents: readonly { sourceName: string; generatedName: string }[],
): void {
  const groups = new Map<string, string[]>();
  for (const agent of agents) {
    const arr = groups.get(agent.generatedName) ?? [];
    arr.push(agent.sourceName);
    groups.set(agent.generatedName, arr);
  }

  const collisions: string[] = [];
  for (const [generatedName, sources] of groups) {
    if (sources.length > 1) {
      const quotedSources = sources.map((s) => `"${s}"`).join(", ");
      collisions.push(`"${generatedName}" <- [${quotedSources}]`);
    }
  }

  if (collisions.length > 0) {
    throw new Error(
      `Generated agent name collision detected. Rename one of the source agents:\n  ` +
        collisions.join("\n  "),
    );
  }
}
