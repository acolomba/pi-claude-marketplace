// domain/name.ts
//
// Pure name validation (RN-2) and generated-name helpers (RN-1) per PRD
// §6.5. THREE different rules per resource type, split into three explicit
// functions (one shared helper that handled all three was a recurring bug
// surface).

import { createHash } from "node:crypto";

import { commandNamespaceSeparator } from "../platform/os.ts";

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
    // `codePointAt` types `number | undefined`; `Number()` folds the
    // out-of-range `undefined` (impossible here: i < name.length) to NaN,
    // which fails both comparisons, without adding an unreachable branch.
    const code = Number(name.codePointAt(i));

    if (code < 0x20 || code === 0x7f) {
      throw new Error(`${prefix}"${name}" must not contain ASCII control characters.`);
    }
  }
}

/**
 * Skill name generator (RN-1 / SK-2).
 *
 * Format: `<plugin>-<skill>` on every platform. Elides a matching plugin
 * prefix from the source, including Claude's colon-qualified form. The
 * result satisfies Pi's skill-name rules: lowercase ASCII letters, digits,
 * single interior hyphens, and at most 64 characters. Long names retain a
 * stable hash suffix so distinct sources do not collapse on truncation. A
 * source with no ASCII letters or digits also gets a hash-based segment.
 */
export function generatedSkillName(plugin: string, source: string): string {
  assertSafeName(plugin);
  assertSafeName(source);

  let elided = source;
  for (const separator of ["-", ":", "."]) {
    const prefix = `${plugin}${separator}`;
    if (source.startsWith(prefix)) {
      elided = source.slice(prefix.length);
      break;
    }
  }

  assertSafeName(elided);

  const normalizedPlugin = normalizePiSkillPart(plugin);
  const normalizedSkill = normalizePiSkillPart(elided);
  const generated = source === plugin ? normalizedPlugin : `${normalizedPlugin}-${normalizedSkill}`;
  if (generated.length <= 64) {
    return generated;
  }

  const suffix = createHash("sha256").update(`${plugin}\0${source}`).digest("hex").slice(0, 8);
  return `${generated.slice(0, 55).replace(/-$/, "")}-${suffix}`;
}

/** Converts one source-name segment into a nonempty Pi skill-name segment. */
function normalizePiSkillPart(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-/, "")
    .replace(/-$/, "");
  if (normalized === "") {
    const suffix = createHash("sha256").update(value).digest("hex").slice(0, 8);

    return `name-${suffix}`;
  }

  return normalized;
}

/**
 * Command name generator (RN-1 / CM-2).
 *
 * Format: `<plugin><separator><command>`, where the separator comes from
 * `commandNamespaceSeparator()`: a colon on POSIX, matching what Claude Code
 * registers, and a dot on Windows, because the generated name becomes a
 * filename and NTFS forbids a colon in one. The `<plugin>-` prefix is elided
 * from `source` (acme + acme-foo -> acme:foo, NOT acme:acme-foo).
 *
 * CM-4: `source` may be a `/`-separated relative path reflecting
 * a nested command file (e.g. "build/web" for commands/build/web.md). RN-2
 * forbids path separators in a single safe name, so the path is split into
 * segments and each segment is validated independently; the `<plugin>-`
 * prefix is elided from the FIRST segment only; and the segments are joined
 * with the separator, so the nested file becomes `<plugin>:build:web` --
 * matching Claude Code's nested-command convention -- or
 * `<plugin>.build.web` on Windows. A flat source ("foo") has a single
 * segment; "acme-foo" elides to the same name "foo" produces.
 *
 * The dot separator lets two sources collide on Windows when a source name
 * itself contains a dot: in plugin "acme", `commands/foo/bar.md` and
 * `commands/foo.bar.md` both name "acme.foo.bar". That is the D-07
 * first-wins skip, which discovery already resolves with a warning naming
 * the winner.
 *
 * D-141-02: an elision that would empty the head does not fire. A head of
 * exactly "acme-" in plugin "acme" keeps its verbatim form, so
 * `commands/acme-.md` becomes "acme:acme-" and `commands/acme-/lint.md`
 * becomes "acme:acme-:lint" -- the two names Claude Code registers for the
 * same tree -- and "acme.acme-" / "acme.acme-.lint" on Windows. The elision
 * exists to remove a stutter, and a head that is nothing but the stutter has
 * no command name left underneath it.
 *
 * `generatedSkillName` still rejects an empty elided suffix. Agent names
 * preserve the complete source name without elision.
 */
export function generatedCommandName(plugin: string, source: string): string {
  assertSafeName(plugin);

  const segments = source.split("/") as [string, ...string[]];

  for (const seg of segments) {
    assertSafeName(seg, `command path segment in "${source}"`);
  }

  const prefix = `${plugin}-`;
  const head = segments[0];
  const stripped = head.startsWith(prefix) ? head.slice(prefix.length) : head;
  // D-141-02: keep the head verbatim when the elision would empty it.
  const elidedHead = stripped === "" ? head : stripped;
  // The stripped head still needs validation on its own: a safe head can
  // strip down to an unsafe remainder ("acme-." leaves ".").
  assertSafeName(elidedHead, `elided command path head in "${source}"`);

  const generated = [plugin, elidedHead, ...segments.slice(1)].join(commandNamespaceSeparator());
  // PRD §6.5 RN-2 forbids only "/" and "\", so a name joined with either
  // separator passes.
  assertSafeName(generated);

  return generated;
}

/**
 * Agent name generator (RN-1 / AG-1).
 *
 * Format: `pi-claude-marketplace-<plugin>-<agent>` (Pi-namespacing prefix
 * keeps cross-extension agents distinguishable). Appends the complete source
 * name so bot and acme-bot remain distinct within plugin acme.
 */
export function generatedAgentName(plugin: string, source: string): string {
  assertSafeName(plugin);
  assertSafeName(source);
  const generated = `pi-claude-marketplace-${plugin}-${source}`;
  assertSafeName(generated);
  return generated;
}
