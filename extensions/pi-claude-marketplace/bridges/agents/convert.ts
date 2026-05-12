// bridges/agents/convert.ts
//
// AG-7 conversion pipeline. Carry-forward of V1 agent/convert.ts (478 lines)
// with three successor deltas:
//   1. substituteClaudeVars from ../../shared/vars.ts (D-08 / PI-10) replaces
//      V1's substitutePluginVars import. Body substitution preserved
//      verbatim per PI-10 contract (PROJECT.md PI-10 + V1).
//   2. generatedAgentName from ../../domain/name.ts replaces V1's local
//      generateAgentName helper. Single source of truth for agent name
//      generation + AG-1 elision.
//   3. discoverPluginAgents moved to ./discover.ts (V1 had it co-located
//      here; the new layout keeps convert pure).
//
// MODEL_MAP, TOOL_MAP, THINKING_VALUES are byte-for-byte from V1 -- user
// contract; tests assert exact equality.

import { generatedSkillName } from "../../domain/name.ts";
import { substituteClaudeVars } from "../../shared/vars.ts";

import { emitGeneratedAgentFile } from "./frontmatter.ts";

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
 * omitted from the generated frontmatter. Byte-for-byte from V1.
 */
export const MODEL_MAP: Readonly<Record<string, string>> = Object.freeze({
  sonnet: "anthropic/claude-sonnet-4-6",
  opus: "anthropic/claude-opus-4-7",
  haiku: "anthropic/claude-haiku-4-5",
});

/**
 * AG-7 user contract: Claude tool name -> Pi tool name. Tokens not present
 * here are dropped. Byte-for-byte from V1.
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

/** Allowlist for thinking/effort values. Byte-for-byte from V1. */
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

  const mapped: string[] = [];
  const dropped: string[] = [];
  for (const token of tokens) {
    const piName = TOOL_MAP[token];
    if (piName === undefined) {
      dropped.push(token);
    } else {
      mapped.push(piName);
    }
  }

  // Apply disallowedTools after mapping. Disallowed values are Claude-side
  // names; map them to Pi names then filter the mapped list.
  const disallowedTokens = splitCsv(rawDisallowed);
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
      };
    }
  }

  return {
    mapped: dedupePreservingOrder(mapped),
    dropped,
    warnings,
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
    const generated = generatedSkillName(pluginName, token);
    if (known.has(generated)) {
      emit.push(generated);
    } else {
      warnings.push(`unknown skill reference "${token}" -- dropped`);
    }
  }

  return { emit, warnings };
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
}): ConvertedAgent {
  const { pluginName, pluginRoot, pluginDataDir, knownSkills, discovered, sourceHash } = input;
  const { raw, body, sourceName, generatedName, sourcePath } = discovered;

  const warnings: string[] = [];

  // 1. Description (with fallback)
  let description = raw.description ?? "";
  if (description === "") {
    description = `Imported Claude Code plugin agent ${sourceName} from plugin ${pluginName}.`;
    warnings.push("source description was missing or empty -- using fallback");
  }

  // 2. Model mapping
  const modelResult = mapModel(raw.model);
  if (modelResult.warning !== undefined) {
    warnings.push(modelResult.warning);
  }

  // 3. Tools mapping
  const toolsResult = mapTools(raw.tools, raw.disallowedTools);
  warnings.push(...toolsResult.warnings);
  if (toolsResult.mapped.length === 0) {
    // AG-11: empty mapped tool list. Include source values so the user can
    // correct upstream.
    throw new Error(
      `Cannot convert agent "${sourceName}" in plugin "${pluginName}": ` +
        `the mapped tool list is empty (pi-subagents has no safe representation of "no tools"). ` +
        `Source tools: ${raw.tools ?? "(default read,bash,edit)"}; ` +
        `disallowedTools: ${raw.disallowedTools ?? "(none)"}.`,
    );
  }

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

  // 7. Substitute plugin variables in the body (PI-10 + V1).
  // D-08 corollary: the shared primitive sides with PI-10 -- agents DO get
  // substitution. See PROJECT.md and 03-01-SUMMARY.md for the resolution.
  const substitutedBody = substituteClaudeVars(body, {
    pluginRoot,
    pluginData: pluginDataDir,
  });

  // 8. Hand off to the frontmatter emitter for final assembly. From here on,
  //    parser-safety (YAML quote-flipping, HTML-comment escaping, field
  //    ordering) lives behind a single seam.
  const fileContent = emitGeneratedAgentFile({
    frontmatter: {
      name: generatedName,
      description,
      ...optionalModel(modelResult.emit),
      tools: toolsResult.mapped,
      ...optionalThinking(thinkingResult.emit),
      skills: skillsResult.emit,
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
