// domain/skill-sibling-paths.ts
//
// Point a relative path from one skill into a sibling skill of the same
// plugin at the folder the sibling is staged in (PG-SKILL-04).
//
// Each skill stages alone under its generated name, in one flat folder of
// sibling skills, so `../b/ref.md` written beside skill `a` names a folder
// that does not exist beside the staged skill. The rewrite resolves each
// token against the source tree and climbs from the staged file to the flat
// folder instead. It reads no file.

import path from "node:path";

/** What one file's paths are resolved against. Every member is required. */
export interface SiblingSkillPathInput {
  /** Absolute source directory of the file the content came from. */
  readonly fileSourceDir: string;
  /** Absolute source directory of the skill that owns the file. */
  readonly skillSourceDir: string;
  /** Resolved source directory of each staged skill of the plugin, to its generated name. */
  readonly siblingSkills: ReadonlyMap<string, string>;
}

// A token is an optional skill directory variable, one or more `../`, then
// name segments joined by single slashes. A name segment holds a dot only
// between name characters, so sentence punctuation after a path stays out of
// the token. Every repeat starts with a separator the repeated class does not
// hold, so a failed match backtracks linearly.
const TOKEN_RE =
  /(?<![A-Za-z0-9_./-])(\$\{CLAUDE_SKILL_DIR\}\/)?((?:\.\.\/)+)([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*(?:\/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*)*)/g;

// A `.` or `..` segment right after a token, such as `/../` in `../b/../x`.
const DOT_SEGMENT_RE = /\/\.\.?(?![A-Za-z0-9_.-])/y;

/** The number of folders between `skillSourceDir` and `fileSourceDir`. */
function depthInSkill(input: SiblingSkillPathInput): number {
  return path
    .relative(input.skillSourceDir, input.fileSourceDir)
    .split(path.sep)
    .filter((segment) => segment !== "").length;
}

/**
 * The generated name of the first sibling folder that a prefix of
 * `segments` names from `start`, with the number of segments it took, or
 * `undefined` when no prefix is a staged sibling or the first match is the
 * file's own skill (D-PG4-06).
 */
function matchSibling(
  start: string,
  segments: readonly string[],
  input: SiblingSkillPathInput,
): { readonly generatedName: string; readonly taken: number } | undefined {
  const ownSkill = path.resolve(input.skillSourceDir);
  for (let taken = 1; taken <= segments.length; taken++) {
    const candidate = path.resolve(start, ...segments.slice(0, taken));
    const generatedName = input.siblingSkills.get(candidate);
    if (generatedName !== undefined) {
      return candidate === ownSkill ? undefined : { generatedName, taken };
    }
  }

  return undefined;
}

/**
 * D-PG4-04 / D-PG4-05: rewrites every relative path in `content` that
 * resolves at or inside a staged sibling skill. The part of the path up to
 * and including the sibling folder becomes the climb from the staged file to
 * the flat skills folder, then the sibling's generated name. The rest of the
 * path, a trailing `/` included, stays byte for byte. A
 * `${CLAUDE_SKILL_DIR}/` path resolves from the skill folder and keeps its
 * variable, so the caller runs this before variable substitution.
 *
 * D-PG4-06: a path that resolves outside every sibling, into the file's own
 * skill, or to a sibling that did not stage stays as written, and so does a
 * path that continues with a `.` or `..` segment.
 */
export function rewriteSiblingSkillPaths(content: string, input: SiblingSkillPathInput): string {
  if (input.siblingSkills.size === 0) {
    return content;
  }

  const fileDepth = depthInSkill(input);
  const rewriteLine = (line: string): string =>
    line.replaceAll(
      TOKEN_RE,
      (token, prefix: string | undefined, parents: string, names: string, offset: number) => {
        DOT_SEGMENT_RE.lastIndex = offset + token.length;
        if (DOT_SEGMENT_RE.test(line)) {
          return token;
        }

        const base = prefix === undefined ? input.fileSourceDir : input.skillSourceDir;
        const segments = names.split("/");
        const sibling = matchSibling(
          path.resolve(base, ...parents.split("/").filter((segment) => segment !== "")),
          segments,
          input,
        );
        if (sibling === undefined) {
          return token;
        }

        const climb = "../".repeat(prefix === undefined ? fileDepth + 1 : 1);
        const kept = [sibling.generatedName, ...segments.slice(sibling.taken)].join("/");
        return `${prefix ?? ""}${climb}${kept}`;
      },
    );

  return content.split("\n").map(rewriteLine).join("\n");
}
