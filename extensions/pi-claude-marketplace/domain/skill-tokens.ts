// domain/skill-tokens.ts
//
// SKTK-01: retarget same-plugin `<plugin>:<skill>` references inside staged
// skill content onto the generated names the install actually materializes.
// Skill prose written for Claude Code names siblings in the upstream
// namespace; the installed Pi name uses the hyphenated Agent Skills form.
// The resolver below is shared by skill text and agent conversion so every
// reference follows the name that discovery materializes.

import { errorMessage } from "../shared/errors.ts";
import { escapeRegExp } from "../shared/regexp.ts";

import { generatedSkillName } from "./name.ts";

/** A fenced-code-block delimiter line (``` or ~~~), leading-whitespace-tolerant. */
const FENCE = /^(```|~~~)/;

/** A known same-plugin skill, or the reason a source reference cannot map. */
export type SkillReferenceResolution =
  | { readonly kind: "known"; readonly generatedName: string }
  | { readonly kind: "foreign" | "unknown" }
  | { readonly kind: "malformed"; readonly reason: string };

/** Matches Claude-qualified skill references in prose and agent bodies. */
export function skillReferencePattern(pluginName: string): RegExp {
  return new RegExp(
    `(?<![A-Za-z0-9_.:-])${escapeRegExp(pluginName)}:([A-Za-z0-9_-]+(?:\\.[A-Za-z0-9_-]+)*)`,
    "g",
  );
}

/** Resolves bare and qualified source references to installed Pi skill names. */
export function resolveSkillReference(
  pluginName: string,
  reference: string,
  knownGeneratedNames: ReadonlySet<string>,
): SkillReferenceResolution {
  const colon = reference.indexOf(":");
  let sourceName = reference;
  if (colon !== -1) {
    if (reference.slice(0, colon).trim() !== pluginName) {
      return { kind: "foreign" };
    }

    sourceName = reference.slice(colon + 1).trim();
  }

  let generatedName: string;
  try {
    generatedName = generatedSkillName(pluginName, sourceName);
  } catch (error) {
    return { kind: "malformed", reason: errorMessage(error) };
  }

  return knownGeneratedNames.has(generatedName)
    ? { kind: "known", generatedName }
    : { kind: "unknown" };
}

/**
 * SKTK-01: rewrite `<pluginName>:<skill>` tokens to their generated skill
 * names, outside fenced code blocks.
 *
 * The token grammar matches the agents bridge's skill-legend detector: the
 * lookbehind rejects tokens embedded in a longer word, and the candidate
 * class accepts interior dots but excludes sentence punctuation. Only
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
  const tokenRe = skillReferencePattern(pluginName);

  const rewriteLine = (line: string): string =>
    line.replaceAll(tokenRe, (token) => {
      const resolution = resolveSkillReference(pluginName, token, known);
      return resolution.kind === "known" ? resolution.generatedName : token;
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
