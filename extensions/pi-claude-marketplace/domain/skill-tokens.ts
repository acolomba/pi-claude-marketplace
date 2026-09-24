// domain/skill-tokens.ts
//
// SKTK-01: retarget same-plugin `<plugin>:<name>` references inside staged
// skill content onto the generated names the install actually materializes.
// Skill prose written for Claude Code names siblings in the upstream
// namespace; the installed Pi name diverges from that spelling on Windows
// (`.` separator) and wherever RN-1 prefix elision applies
// (`acme:acme-foo` -> `acme:foo`). Mapping every token through the generator
// of the kind it names makes an already-aligned token its own replacement,
// so aligned content is byte-identical and only divergent references move.
//
// A sibling can be a skill or a workflow: both are `/`-invocable commands a
// skill's prose may tell the model to run, and both install under a name the
// upstream spelling does not predict. The token grammar cannot tell the two
// kinds apart, so a candidate is resolved through each generator in turn and
// replaced by the first generated name the plugin actually stages.

import { escapeRegExp } from "../shared/regexp.ts";

import { generatedSkillName, generatedWorkflowName } from "./name.ts";

/** A fenced-code-block delimiter line (``` or ~~~), leading-whitespace-tolerant. */
const FENCE = /^(```|~~~)/;

/**
 * The generated names one plugin stages, per kind, so a token is replaced
 * only by a name that will exist once the install lands. Both members are
 * required: a caller that stages no workflows says so with an empty list
 * rather than by omission, which would let a bridge that forgot to thread
 * the names compile.
 */
export interface SiblingNames {
  readonly skills: readonly string[];
  readonly workflows: readonly string[];
}

/**
 * SKTK-01: rewrite `<pluginName>:<name>` tokens to the generated skill or
 * workflow names they resolve to, outside fenced code blocks.
 *
 * The token grammar matches the agents bridge's skill-legend detector: the
 * lookbehind rejects tokens embedded in a longer word, and the candidate
 * class excludes `.` so sentence punctuation never joins a candidate. Only
 * candidates resolving into `siblings` are replaced -- an unknown or
 * cross-plugin reference stays verbatim, and a candidate a name generator
 * rejects (e.g. one that elides to nothing) is skipped rather than thrown.
 * Fenced code blocks are left untouched: unlike the agents legend (D-82-07),
 * this rewrite mutates content in place, and a fenced example documenting
 * upstream syntax must survive verbatim.
 */
export function rewriteSkillTokens(
  content: string,
  pluginName: string,
  siblings: SiblingNames,
): string {
  const resolvers = [
    { known: new Set(siblings.skills), generate: generatedSkillName },
    { known: new Set(siblings.workflows), generate: generatedWorkflowName },
  ];
  const tokenRe = new RegExp(
    `(?<![A-Za-z0-9_.:-])${escapeRegExp(pluginName)}:([A-Za-z0-9_-]+)`,
    "g",
  );

  const resolve = (candidate: string): string | undefined => {
    for (const { known, generate } of resolvers) {
      let generated: string;
      try {
        generated = generate(pluginName, candidate);
      } catch {
        continue;
      }

      if (known.has(generated)) {
        return generated;
      }
    }

    return undefined;
  };

  const rewriteLine = (line: string): string =>
    line.replaceAll(tokenRe, (token, candidate: string) => resolve(candidate) ?? token);

  const out: string[] = [];
  let inFence = false;

  for (const line of content.split("\n")) {
    if (FENCE.test(line.trimStart())) {
      inFence = !inFence;
      out.push(line);
    } else {
      out.push(inFence ? line : rewriteLine(line));
    }
  }

  return out.join("\n");
}
