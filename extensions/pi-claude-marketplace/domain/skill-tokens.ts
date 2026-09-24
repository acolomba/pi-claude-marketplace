// domain/skill-tokens.ts
//
// Resolve references through the names selected by plugin discovery.

import { errorMessage } from "../shared/errors.ts";
import { escapeRegExp } from "../shared/regexp.ts";

import { generatedCommandName, generatedSkillName } from "./name.ts";

/** A known same-plugin skill, or the reason a source reference cannot map. */
export type SkillReferenceResolution =
  | { readonly kind: "known"; readonly generatedName: string }
  | { readonly kind: "foreign" | "unknown" }
  | { readonly kind: "malformed"; readonly reason: string };

/** Names selected by discovery for one plugin. */
export interface InstalledReferenceNames {
  readonly skills: readonly string[];
  readonly commands: readonly string[];
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

/** Rewrites known references to the invocation Pi actually loads. */
export function rewriteMarkdownReferences(
  content: string,
  pluginName: string,
  names: InstalledReferenceNames,
): string {
  const skills = new Set(names.skills);
  const commands = new Set(names.commands);
  const tokenRe = new RegExp(
    `(?<![A-Za-z0-9_.:/-])/?(?:(${escapeRegExp(pluginName)}):|skill:)([A-Za-z0-9_-]+(?:[:.][A-Za-z0-9_-]+)*)`,
    "g",
  );

  const rewriteLine = (line: string): string =>
    line.replaceAll(tokenRe, (token, qualifiedPlugin: string | undefined, source: string) => {
      if (qualifiedPlugin === undefined) {
        const skill = resolveSkillReference(pluginName, source, skills);
        return skill.kind === "known" ? `/skill:${skill.generatedName}` : token;
      }

      const commandName = generatedCommandName(pluginName, source.replaceAll(":", "/"));

      if (commands.has(commandName)) {
        return `/${commandName}`;
      }

      const skill = resolveSkillReference(pluginName, `${pluginName}:${source}`, skills);
      return skill.kind === "known" ? `/skill:${skill.generatedName}` : token;
    });

  return content.split("\n").map(rewriteLine).join("\n");
}
