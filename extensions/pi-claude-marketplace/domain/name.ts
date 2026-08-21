// domain/name.ts
//
// Pure name validation (RN-2) and generated-name helpers (RN-1) per PRD
// §6.5. THREE different rules per resource type, split into three explicit
// functions (one shared helper that handled all three was a recurring bug
// surface).

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
 * omitted, messages use the capitalized "Name" form.
 */
export function assertSafeName(name: string, label?: string): void {
  // When `label` is provided, prepend it (lowercase form for sentence-flow);
  // when omitted, fall back to "Name".
  const prefix = label === undefined ? "Name " : `${label} `;

  if (typeof name !== "string") {
    throw new TypeError(`${prefix}must be a string (got ${typeof name}).`);
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
    const code = name.codePointAt(i) ?? 0;

    if (code < 0x20 || code === 0x7f) {
      throw new Error(`${prefix}"${name}" must not contain ASCII control characters.`);
    }
  }
}

/**
 * Skill name generator (RN-1 / SK-2).
 *
 * Format: `<plugin>-<skill>` -- the `<plugin>-` prefix is elided from
 * `source` (acme + acme-foo -> acme-foo, NOT acme-acme-foo). A source
 * equal to the plugin name becomes the plugin name itself (acme + acme ->
 * acme), matching Pi's `/skill:<name>` invocation surface.
 *
 * Pi validates skill names as lowercase a-z, 0-9, and hyphens only, so skills
 * cannot use the colon separator that command prompt filenames use.
 */
export function generatedSkillName(plugin: string, source: string): string {
  assertSafeName(plugin);
  assertSafeName(source);
  if (source === plugin) {
    return plugin;
  }

  const prefix = `${plugin}-`;
  const elided = source.startsWith(prefix) ? source.slice(prefix.length) : source;
  assertSafeName(elided);
  const generated = `${plugin}-${elided}`;
  assertSafeName(generated);
  return generated;
}

/**
 * Command name generator (RN-1 / CM-2).
 *
 * Format: `<plugin>:<command>` -- the SEPARATOR is a colon, distinct from
 * the dash separator used by skills/agents. The `<plugin>-` prefix is
 * elided from `source` (acme + acme-foo -> acme:foo, NOT acme:acme-foo).
 *
 * CM-4: `source` may be a `/`-separated relative path reflecting
 * a nested command file (e.g. "build/web" for commands/build/web.md). RN-2
 * forbids path separators in a single safe name, so the path is split into
 * segments and each segment is validated independently; the `<plugin>-`
 * prefix is elided from the FIRST segment only; and the segments are joined
 * with `:` so the nested file becomes `<plugin>:build:web` -- matching
 * Claude Code's nested-command convention. A flat source ("foo") has a
 * single segment and behaves exactly as before ("acme:foo"); "acme-foo"
 * still elides to "acme:foo".
 *
 * D-141-02: an elision that would empty the head does not fire. A head of
 * exactly "acme-" in plugin "acme" keeps its verbatim form, so
 * `commands/acme-.md` becomes "acme:acme-" and `commands/acme-/lint.md`
 * becomes "acme:acme-:lint" -- the two names Claude Code registers for the
 * same tree. The elision exists to remove a stutter, and a head that is
 * nothing but the stutter has no command name left underneath it.
 *
 * Commands only. `generatedSkillName` and `generatedAgentName` keep their
 * throw, because Pi validates a skill name and rejects both a trailing and
 * a doubled hyphen: keeping the head there would yield "acme-acme-" and
 * move the same failure to a worse message further downstream.
 */
export function generatedCommandName(plugin: string, source: string): string {
  assertSafeName(plugin);

  const segments = source.split("/");

  for (const seg of segments) {
    assertSafeName(seg, `command path segment in "${source}"`);
  }

  const prefix = `${plugin}-`;
  const head = segments[0] ?? "";
  const stripped = head.startsWith(prefix) ? head.slice(prefix.length) : head;
  // D-141-02: keep the head verbatim when the elision would empty it.
  const elidedHead = stripped === "" ? head : stripped;
  // The stripped head still needs validation on its own: a safe head can
  // strip down to an unsafe remainder ("acme-." leaves ".").
  assertSafeName(elidedHead, `elided command path head in "${source}"`);

  const generated = [plugin, elidedHead, ...segments.slice(1)].join(":");
  // Note: assertSafeName on the colon-bearing form -- colon is allowed
  // (PRD §6.5 RN-2 forbids only "/" and "\"), so this passes.
  assertSafeName(generated);

  return generated;
}

/**
 * Agent name generator (RN-1 / AG-1).
 *
 * Format: `pi-claude-marketplace-<plugin>-<agent>` (Pi-namespacing prefix
 * keeps cross-extension agents distinguishable). The `<plugin>-` prefix
 * is elided from `source` (acme + acme-bot -> pi-claude-marketplace-acme-bot,
 * NOT pi-claude-marketplace-acme-acme-bot).
 */
export function generatedAgentName(plugin: string, source: string): string {
  assertSafeName(plugin);
  assertSafeName(source);
  const prefix = `${plugin}-`;
  const elided = source.startsWith(prefix) ? source.slice(prefix.length) : source;
  assertSafeName(elided);
  const generated = `pi-claude-marketplace-${plugin}-${elided}`;
  assertSafeName(generated);
  return generated;
}
