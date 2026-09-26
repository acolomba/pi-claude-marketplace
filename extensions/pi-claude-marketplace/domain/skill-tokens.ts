// domain/skill-tokens.ts
//
// Resolve references through the names selected by plugin discovery.
//
// A qualified sibling can be a command, a workflow, or a skill: all three are
// `/`-invocable, and each installs under a name the upstream spelling does not
// predict. The token grammar cannot tell the kinds apart, so a candidate is
// resolved through each generator in turn -- command, then skill, then
// workflow -- and replaced by the first generated name the plugin stages.

import { errorMessage } from "../shared/errors.ts";
import { escapeRegExp } from "../shared/regexp.ts";

import { generatedCommandName, generatedSkillName, generatedWorkflowName } from "./name.ts";

/** A known same-plugin skill, or the reason a source reference cannot map. */
export type SkillReferenceResolution =
  | { readonly kind: "known"; readonly generatedName: string }
  | { readonly kind: "foreign" | "unknown" }
  | { readonly kind: "malformed"; readonly reason: string };

/**
 * Names selected by discovery for one plugin. Every member is required: a
 * caller that stages no workflows says so with an empty list rather than by
 * omission, which would let a bridge that forgot to thread the names compile.
 */
export interface InstalledReferenceNames {
  readonly skills: readonly string[];
  readonly commands: readonly string[];
  readonly workflows: readonly string[];
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
 * Resolves a workflow reference, or `undefined` when the plugin stages no
 * workflow under it. A name the generator refuses is skipped rather than
 * thrown, so one malformed candidate cannot fail the whole rewrite.
 */
function resolveWorkflowReference(
  pluginName: string,
  source: string,
  workflows: ReadonlySet<string>,
): string | undefined {
  let generated: string;
  try {
    generated = generatedWorkflowName(pluginName, source);
  } catch {
    return undefined;
  }

  return workflows.has(generated) ? generated : undefined;
}

/** Rewrites known references to the invocation Pi actually loads. */
export function rewriteMarkdownReferences(
  content: string,
  pluginName: string,
  names: InstalledReferenceNames,
): string {
  const skills = new Set(names.skills);
  const commands = new Set(names.commands);
  const workflows = new Set(names.workflows);
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

      if (skill.kind === "known") {
        return `/skill:${skill.generatedName}`;
      }

      const workflowName = resolveWorkflowReference(pluginName, source, workflows);
      return workflowName === undefined ? token : `/${workflowName}`;
    });

  return content.split("\n").map(rewriteLine).join("\n");
}
