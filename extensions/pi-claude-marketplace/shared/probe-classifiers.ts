// shared/probe-classifiers.ts
//
// Closed-set classifiers for the read-only orchestrator surfaces
// (`list`, `marketplace info`, `plugin info`). The two helpers map raw
// failure inputs onto the closed `Reason` vocabulary so every read-only
// surface over the same persistence layer surfaces the SAME user-facing
// reason for the same underlying failure.
//
// Lives in `shared/` because it is the only sanctioned cross-orchestrator
// import surface per the project's layering rules. Orchestrators import
// these directly; local wrappers (e.g. `list.ts::narrowListFailReason`)
// remain valid when a caller needs a distinct semantic name.

/**
 * Classify a thrown FS/JSON error into a closed-set probe Reason.
 *
 *   - `SyntaxError`           -> `unparseable` (JSON.parse on a
 *     malformed `plugin.json` / `marketplace.json`)
 *   - `EACCES` / `EPERM`      -> `permission denied`
 *   - `ENOENT` / `ENOTDIR`    -> `source missing`
 *   - any other thrown shape  -> `unreadable` (permissive fallback)
 *
 * Callers wrapping this for documentation (`narrowProbeError` /
 * `narrowListFailReason` on the list surface) keep their own names; the
 * classifier ladder lives here so the bodies cannot drift.
 */
export function narrowProbeError(
  err: unknown,
): "permission denied" | "source missing" | "unparseable" | "unreadable" {
  if (err instanceof SyntaxError) {
    return "unparseable";
  }

  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EPERM") {
      return "permission denied";
    }

    if (code === "ENOENT" || code === "ENOTDIR") {
      return "source missing";
    }
  }

  return "unreadable";
}

/**
 * Narrow resolver `notes` strings to closed-set REASONS members. The
 * manifest field carve-out passes `hooks` verbatim and maps the
 * manifest-field detection token `lspServers` to the emitted Reason
 * `lsp`; any other unsupported-source note falls through to
 * `unsupported source`. Empty notes -> empty reasons array.
 */
export function narrowResolverNotes(
  notes: readonly string[],
): readonly ("hooks" | "lsp" | "unsupported source")[] {
  const out: ("hooks" | "lsp" | "unsupported source")[] = [];
  const seen = new Set<string>();
  for (const note of notes) {
    if (note.includes("hooks") && !seen.has("hooks")) {
      out.push("hooks");
      seen.add("hooks");
      continue;
    }

    if (note.includes("lspServers") && !seen.has("lsp")) {
      out.push("lsp");
      seen.add("lsp");
      continue;
    }

    if (!seen.has("unsupported source")) {
      out.push("unsupported source");
      seen.add("unsupported source");
    }
  }

  return out;
}
