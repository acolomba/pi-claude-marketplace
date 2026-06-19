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

import { InvalidMarketplaceManifestError } from "./errors.ts";

/**
 * Classify a thrown FS/JSON error into a closed-set probe Reason.
 *
 *   - `SyntaxError`           -> `unparseable` (raw JSON.parse on a
 *     `plugin.json` / `marketplace.json` with no typed wrapper)
 *   - `InvalidMarketplaceManifestError` whose `cause` is a `SyntaxError`
 *     -> `unparseable` (malformed JSON wrapped in the typed manifest error);
 *     the SAME typed error with NO `SyntaxError` cause (schema-invalid
 *     manifest) -> `invalid manifest` (D-48-B IN-02 close, SC#1 manifest
 *     cross-surface parity): the read-only `info`/`list` surfaces report the
 *     same truthful `{invalid manifest}` reason the write path
 *     (`marketplace add::classifyAddError`) already does, instead of the
 *     generic `unreadable` fallback.
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
): "invalid manifest" | "permission denied" | "source missing" | "unparseable" | "unreadable" {
  if (err instanceof SyntaxError) {
    return "unparseable";
  }

  // D-48-B IN-02: a marketplace-manifest failure is surfaced as a typed
  // InvalidMarketplaceManifestError. A malformed-JSON manifest carries the
  // original SyntaxError as cause -> `unparseable`; a schema-invalid manifest
  // (typed error, NO SyntaxError cause) -> `invalid manifest`, matching the
  // write path so the read-only surfaces classify the SAME on-disk condition
  // identically rather than falling through to the generic `unreadable`.
  if (err instanceof InvalidMarketplaceManifestError) {
    return err.cause instanceof SyntaxError ? "unparseable" : "invalid manifest";
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
 * Narrow resolver `notes` strings to closed-set REASONS members.
 *
 * HOOK-04 detection is anchored on the three reason-prefix tokens emitted
 * by `domain/components/hooks.ts::parseHooksConfig` plus the
 * `malformed hooks.json: ` wrapper applied at the resolver call site --
 * substring-match was tightened to `startsWith` checks so a free-form
 * note that happens to contain the word `hooks` mid-string does NOT
 * classify as `unsupported hooks`.
 *
 * The manifest-field detection token `lspServers` (camelCase, sliced from
 * the resolver's `"contains lspServers"` note) maps to the emitted
 * Reason `lsp`. Any other unsupported-source note falls through to
 * `unsupported source`. Empty notes -> empty reasons array.
 *
 * Each note classifies into EXACTLY ONE bucket; once a bucket has been
 * pushed, repeated notes for the same bucket are no-ops (and crucially do
 * NOT fall through to the catch-all `unsupported source` arm -- WR-01).
 */
export function narrowResolverNotes(
  notes: readonly string[],
): readonly ("unsupported hooks" | "lsp" | "unsupported source")[] {
  const out: ("unsupported hooks" | "lsp" | "unsupported source")[] = [];
  const seen = new Set<string>();
  for (const note of notes) {
    const isHooksNote =
      note.startsWith("hooks.json is not valid JSON:") ||
      note.startsWith("hooks.json failed schema validation:") ||
      note.startsWith("unsupported hooks:") ||
      note.startsWith("malformed hooks.json:");
    if (isHooksNote) {
      if (!seen.has("unsupported hooks")) {
        out.push("unsupported hooks");
        seen.add("unsupported hooks");
      }

      continue;
    }

    if (note.includes("lspServers")) {
      if (!seen.has("lsp")) {
        out.push("lsp");
        seen.add("lsp");
      }

      continue;
    }

    if (!seen.has("unsupported source")) {
      out.push("unsupported source");
      seen.add("unsupported source");
    }
  }

  return out;
}
