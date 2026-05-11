// domain/name.ts
//
// Pure name validation (RN-2) and generated-name helpers (RN-1) per PRD
// §6.5. THREE different rules per resource type -- see RESEARCH.md
// Pitfall 8. The single helper that handled all three in V1 was a
// recurring bug surface; Phase 2 splits into three explicit functions.

/**
 * RN-2: validate that a name is safe to use as a path basename / generated
 * resource name. Throws Error with descriptive message on failure.
 *
 * Rules (verbatim from PRD §6.5):
 *   - non-empty after trim
 *   - not "." or ".."
 *   - no path separators ("/" or "\\")
 *   - no ASCII control chars (charCode < 0x20 or === 0x7f)
 *
 * The optional `label` argument is prepended to error messages
 * (e.g. `assertSafeName(skill.generatedName, "generated skill name")` -->
 * `generated skill name "..." must not contain path separators.`). When
 * omitted, messages use the legacy capitalized "Name" form for
 * backward-compatibility with Phase 2 call sites and tests.
 */
export function assertSafeName(name: string, label?: string): void {
  // When `label` is provided, prepend it (lowercase form for sentence-flow);
  // when omitted, fall back to "Name" so legacy single-arg call sites and
  // their tests keep matching the same regexes.
  const prefix = label !== undefined ? `${label} ` : "Name ";

  if (typeof name !== "string") {
    throw new Error(`${prefix}must be a string (got ${typeof name}).`);
  }

  if (name.trim() === "") {
    throw new Error(`${prefix}must be a non-empty string.`);
  }

  if (name === "." || name === "..") {
    throw new Error(`${prefix}must not be "." or "..".`);
  }

  if (name.includes("/") || name.includes("\\")) {
    throw new Error(`${prefix}"${name}" must not contain path separators.`);
  }

  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);

    if (code < 0x20 || code === 0x7f) {
      throw new Error(`${prefix}"${name}" must not contain ASCII control characters.`);
    }
  }
}

/**
 * Skill name generator (RN-1 / SK-2).
 *
 * Format: `<plugin>:<skill>` -- the `<plugin>-` prefix is elided from
 * `source` (acme + acme-foo -> acme:foo, NOT acme:acme-foo). A source
 * equal to the plugin name does not elide and becomes acme:acme.
 */
export function generatedSkillName(plugin: string, source: string): string {
  assertSafeName(plugin);
  assertSafeName(source);
  const prefix = `${plugin}-`;
  const elided = source.startsWith(prefix) ? source.slice(prefix.length) : source;
  assertSafeName(elided);
  const generated = `${plugin}:${elided}`;
  assertSafeName(generated);
  return generated;
}

/**
 * Command name generator (RN-1 / CM-2).
 *
 * Format: `<plugin>:<command>` -- the SEPARATOR is a colon, distinct from
 * the dash separator used by skills/agents. The `<plugin>-` prefix is
 * elided from `source` (acme + acme-foo -> acme:foo, NOT acme:acme-foo).
 */
export function generatedCommandName(plugin: string, source: string): string {
  assertSafeName(plugin);
  assertSafeName(source);
  const prefix = `${plugin}-`;
  const elided = source.startsWith(prefix) ? source.slice(prefix.length) : source;
  // Re-validate the elided portion in isolation to catch e.g. an "acme-"
  // source that elides to empty.
  assertSafeName(elided);
  const generated = `${plugin}:${elided}`;
  // Note: assertSafeName on the colon-bearing form -- colon is allowed
  // (PRD §6.5 RN-2 forbids only "/" and "\"), so this passes.
  assertSafeName(generated);
  return generated;
}

/**
 * Agent name generator (RN-1 / AG-1).
 *
 * Format: `claude-marketplace-<plugin>-<agent>` (Pi-namespacing prefix
 * keeps cross-extension agents distinguishable). The `<plugin>-` prefix
 * is elided from `source` (acme + acme-bot -> claude-marketplace-acme-bot,
 * NOT claude-marketplace-acme-acme-bot).
 */
export function generatedAgentName(plugin: string, source: string): string {
  assertSafeName(plugin);
  assertSafeName(source);
  const prefix = `${plugin}-`;
  const elided = source.startsWith(prefix) ? source.slice(prefix.length) : source;
  assertSafeName(elided);
  const generated = `claude-marketplace-${plugin}-${elided}`;
  assertSafeName(generated);
  return generated;
}
