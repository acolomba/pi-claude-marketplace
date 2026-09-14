// platform/os.ts
//
// Host-operating-system facts the rest of the extension has to adapt to.

/**
 * The separator that joins the namespace segments of a generated command
 * name (CM-4): `.` on Windows, `:` everywhere else.
 *
 * A command materializes as `<generatedName>.md` under `resources/prompts/`,
 * so the generated name is a filename. NTFS reads `:` as the alternate-data-
 * stream delimiter and rejects it in a basename, which makes a colon-joined
 * name unwritable on Windows (#143). POSIX filesystems accept it, and there
 * it is also what Claude Code registers.
 *
 * `process.platform` is read on every call, so the answer follows the host
 * rather than freezing at import time.
 */
export function commandNamespaceSeparator(): string {
  return process.platform === "win32" ? "." : ":";
}
