/** The text a body with no non-blank line falls back to, per component kind. */
export type DescriptionFallbackLabel = "Plugin skill" | "Plugin command";

const HEADING = /^#+\s+(\S.*)$/;
const MAX_LENGTH = 100;
const CUT_LENGTH = 97;

/**
 * D-CF1-04 / E3: the description Claude Code 2.1.316 (`A2e`) gives a skill or
 * command whose frontmatter has no `description`. The bridges for skills and
 * commands call it. The text is the first non-blank line, trimmed. A Markdown
 * heading gives its text without the `#` marks. Text longer than 100
 * characters keeps its first 97 characters and ends in `...`. A body with no
 * non-blank line gives `label`.
 */
export function descriptionFallback(body: string, label: DescriptionFallbackLabel): string {
  const line = body
    .split("\n")
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate !== "");
  if (line === undefined) {
    return label;
  }

  const text = HEADING.exec(line)?.[1] ?? line;
  return text.length > MAX_LENGTH ? `${text.substring(0, CUT_LENGTH)}...` : text;
}
