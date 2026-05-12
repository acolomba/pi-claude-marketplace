import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { generateSkillName, substitutePluginVars } from "../plugin/vars.ts";
import { assertSafeName } from "../validation.ts";

import { emitGeneratedAgentFile, parseFrontmatter } from "./frontmatter.ts";

export interface DiscoveredAgent {
  /** Source agent name from frontmatter `name:` (or filename stem if missing). */
  sourceName: string;
  /** Generated pi-subagent name -- pi-claude-marketplace-<plugin>-<stripped> */
  generatedName: string;
  /** Absolute path to the source .md file. */
  sourcePath: string;
  /** Raw frontmatter object (string-valued, before mapping). */
  rawFrontmatter: Record<string, string>;
  /** Body of the source file (after the closing ---). */
  body: string;
  /** Stable sha256 hex digest of the source file's raw bytes. */
  sourceHash: string;
}

export interface ConvertedAgent {
  sourceName: string;
  generatedName: string;
  sourcePath: string;
  /** Raw text to write to <generatedName>.md, including the provenance comment,
   *  generated frontmatter, and substituted body. */
  fileContent: string;
  /** Stable sha256 hex digest of the source file's raw bytes (full digest). */
  sourceHash: string;
  /** Original `model:` field from the source if present (for index/comment). */
  originalModel?: string;
  /** Frontmatter fields dropped because they are unsupported. */
  droppedFields: string[];
  /** Tool tokens dropped during mapping (e.g. WebFetch, NotebookEdit). */
  droppedTools: string[];
  /** Human-readable warnings (unknown skills, fallback description, unknown thinking values, etc.). */
  warnings: string[];
}

/** Source frontmatter fields the converter actively consumes. Anything else
 *  is recorded in droppedFields. */
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

/** Allowlisted Claude model strings. Anything else is omitted from the
 *  generated frontmatter. */
const MODEL_MAP: Record<string, string> = {
  sonnet: "anthropic/claude-sonnet-4-6",
  opus: "anthropic/claude-opus-4-7",
  haiku: "anthropic/claude-haiku-4-5",
};

/** Claude tool name -> Pi tool name. Tokens not present here are dropped. */
const TOOL_MAP: Record<string, string> = {
  Read: "read",
  Bash: "bash",
  Edit: "edit",
  Write: "write",
  Grep: "grep",
  Glob: "find",
  LS: "ls",
};

/** Allowlist for thinking/effort values. */
const THINKING_VALUES = new Set(["off", "minimal", "low", "medium", "high", "xhigh"]);

/** Pure name generator with prefix stripping.
 *  Format: `pi-claude-marketplace-<plugin>-<suffix>` where `<suffix>` strips
 *  a leading `<plugin>-` from the source agent name if present. */
export function generateAgentName(pluginName: string, sourceAgentName: string): string {
  assertSafeName(pluginName, "plugin name");
  assertSafeName(sourceAgentName, "source agent name");
  const suffix = sourceAgentName.startsWith(pluginName + "-")
    ? sourceAgentName.slice(pluginName.length + 1)
    : sourceAgentName;
  const generatedName = `pi-claude-marketplace-${pluginName}-${suffix}`;
  assertSafeName(generatedName, "generated agent name");
  return generatedName;
}

/** Discover and parse flat agents/*.md (non-recursive). Honors only .md files. */
export async function discoverPluginAgents(input: {
  pluginName: string;
  agentsDir: string;
}): Promise<DiscoveredAgent[]> {
  const { pluginName, agentsDir } = input;

  let entries;
  try {
    entries = await readdir(agentsDir, { withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return [];
    }

    throw err;
  }

  // Sort by filename for determinism.
  const mdFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .sort((a, b) => a.name.localeCompare(b.name));

  const discovered: DiscoveredAgent[] = [];
  for (const entry of mdFiles) {
    const sourcePath = path.join(agentsDir, entry.name);
    // Hash raw bytes (not utf8 text) so the digest survives BOM/line-ending normalization.
    const bytes = await readFile(sourcePath);
    const sourceHash = createHash("sha256").update(bytes).digest("hex");
    const text = bytes.toString("utf8");

    const { frontmatter, body } = parseFrontmatter(text);
    const stem = entry.name.slice(0, -3);
    const sourceName = frontmatter.name ?? stem;
    assertSafeName(sourceName, `agent name in ${sourcePath}`);
    discovered.push({
      sourceName,
      generatedName: generateAgentName(pluginName, sourceName),
      sourcePath,
      rawFrontmatter: frontmatter,
      body,
      sourceHash,
    });
  }

  return discovered;
}

interface ToolMappingResult {
  mapped: string[];
  dropped: string[];
  warnings: string[];
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
    const generated = generateSkillName(pluginName, token);
    if (known.has(generated)) {
      emit.push(generated);
    } else {
      warnings.push(`unknown skill reference "${token}" -- dropped`);
    }
  }

  return { emit, warnings };
}

/** Pure conversion. Performs all field mappings, substitutes plugin vars in
 *  the body, and assembles the file content via the frontmatter emitter. */
export function convertAgent(input: {
  pluginName: string;
  pluginRoot: string;
  pluginDataDir: string;
  knownSkills: readonly string[];
  discovered: DiscoveredAgent;
  sourceHash: string;
}): ConvertedAgent {
  const { pluginName, pluginRoot, pluginDataDir, knownSkills, discovered, sourceHash } = input;
  const { rawFrontmatter, body, sourceName, generatedName, sourcePath } = discovered;

  const warnings: string[] = [];

  // 1. Description (with fallback)
  let description = rawFrontmatter.description ?? "";
  if (description === "") {
    description = `Imported Claude Code plugin agent ${sourceName} from plugin ${pluginName}.`;
    warnings.push("source description was missing or empty -- using fallback");
  }

  // 2. Model mapping
  const modelResult = mapModel(rawFrontmatter.model);
  if (modelResult.warning !== undefined) {
    warnings.push(modelResult.warning);
  }

  // 3. Tools mapping
  const toolsResult = mapTools(rawFrontmatter.tools, rawFrontmatter.disallowedTools);
  warnings.push(...toolsResult.warnings);
  if (toolsResult.mapped.length === 0) {
    throw new Error(
      `Cannot convert agent "${sourceName}" in plugin "${pluginName}": ` +
        `the mapped tool list is empty (pi-subagents has no safe representation of "no tools"). ` +
        `Source tools: ${rawFrontmatter.tools ?? "(default read,bash,edit)"}; ` +
        `disallowedTools: ${rawFrontmatter.disallowedTools ?? "(none)"}.`,
    );
  }

  // 4. Thinking / effort mapping
  const thinkingResult = mapThinking(rawFrontmatter.thinking, rawFrontmatter.effort);
  if (thinkingResult.warning !== undefined) {
    warnings.push(thinkingResult.warning);
  }

  // 5. Skills mapping
  const skillsResult = mapSkills(rawFrontmatter.skills, pluginName, knownSkills);
  warnings.push(...skillsResult.warnings);

  // 6. Dropped fields (anything in source frontmatter that isn't supported).
  const droppedFields: string[] = [];
  for (const key of Object.keys(rawFrontmatter)) {
    if (!SUPPORTED_SOURCE_FIELDS.has(key)) {
      droppedFields.push(key);
    }
  }

  // 7. Substitute plugin variables in the body.
  const substitutedBody = substitutePluginVars(body, pluginRoot, pluginDataDir);

  // 8. Hand off to the frontmatter emitter for final assembly. From here on,
  //    parser-safety (YAML quote-flipping, HTML-comment escaping, field
  //    ordering) lives behind a single seam.
  const fileContent = emitGeneratedAgentFile({
    frontmatter: {
      name: generatedName,
      description,
      ...(modelResult.emit !== undefined ? { model: modelResult.emit } : {}),
      tools: toolsResult.mapped,
      ...(thinkingResult.emit !== undefined ? { thinking: thinkingResult.emit } : {}),
      skills: skillsResult.emit,
    },
    provenance: {
      pluginName,
      sourceName,
      sourcePath,
      ...(modelResult.originalModel !== undefined
        ? { originalModel: modelResult.originalModel }
        : {}),
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
  };
  if (modelResult.originalModel !== undefined) {
    result.originalModel = modelResult.originalModel;
  }

  return result;
}

/** Detect generated-name collisions across an array of converted/discovered agents. */
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
      collisions.push(`"${generatedName}" <- [${sources.map((s) => `"${s}"`).join(", ")}]`);
    }
  }

  if (collisions.length > 0) {
    throw new Error(
      `Generated agent name collision detected. Rename one of the source agents:\n  ` +
        collisions.join("\n  "),
    );
  }
}
