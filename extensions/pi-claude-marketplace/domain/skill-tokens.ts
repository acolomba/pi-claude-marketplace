// domain/skill-tokens.ts
//
// SKTK-01: retarget same-plugin `<plugin>:<skill>` references inside staged
// skill content onto the generated names the install actually materializes.
// Skill prose written for Claude Code names siblings in the upstream
// namespace; the installed Pi name diverges from that spelling on Windows
// (`.` separator) and wherever RN-1 prefix elision applies
// (`acme:acme-foo` -> `acme:foo`). Mapping every token through
// `generatedSkillName` makes an already-aligned token its own replacement,
// so aligned content is byte-identical and only divergent references move.

import { escapeRegExp } from "../shared/regexp.ts";

import { generatedSkillName } from "./name.ts";

/** A fenced-code-block delimiter line (``` or ~~~), leading-whitespace-tolerant. */
const FENCE = /^(```|~~~)/;

/**
 * SKTK-01: rewrite `<pluginName>:<skill>` tokens to their generated skill
 * names, outside fenced code blocks.
 *
 * The token grammar matches the agents bridge's skill-legend detector: the
 * lookbehind rejects tokens embedded in a longer word, and the candidate
 * class excludes `.` so sentence punctuation never joins a candidate. Only
 * candidates resolving into `knownGeneratedNames` are replaced -- an
 * unknown or cross-plugin reference stays verbatim, and a candidate the
 * name generator rejects (e.g. one that elides to nothing) is skipped
 * rather than thrown. Fenced code blocks are left untouched: unlike the
 * agents legend (D-82-07), this rewrite mutates content in place, and a
 * fenced example documenting upstream syntax must survive verbatim.
 */
export function rewriteSkillTokens(
  content: string,
  pluginName: string,
  knownGeneratedNames: readonly string[],
): string {
  const known = new Set(knownGeneratedNames);
  const tokenRe = new RegExp(
    `(?<![A-Za-z0-9_.:-])${escapeRegExp(pluginName)}:([A-Za-z0-9_-]+)`,
    "g",
  );

  const rewriteLine = (line: string): string =>
    line.replaceAll(tokenRe, (token, candidate: string) => {
      let generated: string;
      try {
        generated = generatedSkillName(pluginName, candidate);
      } catch {
        return token;
      }

      return known.has(generated) ? generated : token;
    });

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
