// shared/bom.ts
//
// FMBOM-01: the single leading-BOM strip used by every bridge read site that
// parses author-supplied frontmatter. It lives here because fallow's zone
// boundaries forbid bridges-agents, bridges-skills and bridges-commands from
// importing one another, and all three need it.

/**
 * Remove exactly one leading U+FEFF byte-order mark from decoded source text.
 *
 * FMBOM-01: a marker at index 0 defeats every anchored `---` fence match --
 * the agents parser's `/^---\r?\n/`, the skills name rewrite's
 * `startsWith("---")`, and the frontmatter gate in Pi's own loader at the
 * `>=0.80.5` peer floor. Callers strip before parsing AND before writing the
 * staged artifact, so the parsed bytes and the staged bytes agree.
 *
 * T-FMBOM-02: exactly ONE marker is removed -- never a loop, never a global
 * regex. Stripping repeatedly would let a doubled marker smuggle a fence past
 * a `startsWith` guard; with a single strip a doubled marker still fails
 * closed to the no-frontmatter path. `startsWith` + `slice` also keeps the
 * helper free of regex backtracking on attacker-supplied plugin text
 * (T-FMBOM-04).
 */
export function stripBom(text: string): string {
  // The marker is non-printable, so it is written as an escape rather than as
  // an invisible literal.
  return text.startsWith("\uFEFF") ? text.slice(1) : text;
}
