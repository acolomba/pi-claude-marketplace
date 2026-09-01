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
 * Closed-set REASONS vocabulary shared by the unsupported-classification
 * helpers below. The helpers accept two separate input axes.
 * `narrowResolverNotes` maps resolver notes to hooks, LSP, source, and
 * malformed-MCP reasons. `narrowUnsupportedKinds` maps typed kinds to hooks,
 * LSP, generic component, and workflows reasons. `kindToReason` owns the
 * typed-kind mappings.
 */
export type UnsupportedReason =
  "unsupported hooks" | "lsp" | "unsupported source" | "unsupported component" | "workflows";

/**
 * MCPR-03 / D-02: the return-type envelope for `narrowResolverNotes`. It widens
 * `UnsupportedReason` with the failure-class `malformed mcp` token. The shared
 * alias also contains the typed-kind-only `workflows` member, but this helper
 * never emits it. The sibling typed-kind helpers never emit `malformed mcp`.
 */
export type ResolverNoteReason = UnsupportedReason | "malformed mcp";

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
 * `unsupported source`. Workflows do not use this axis, so this helper never
 * emits `workflows`. Empty notes -> empty reasons array.
 *
 * Each note classifies into EXACTLY ONE bucket; once a bucket has been
 * pushed, repeated notes for the same bucket are no-ops (and crucially do
 * NOT fall through to the catch-all `unsupported source` arm -- WR-01).
 */
export function narrowResolverNotes(notes: readonly string[]): readonly ResolverNoteReason[] {
  const out: ResolverNoteReason[] = [];
  const seen = new Set<string>();
  for (const note of notes) {
    // First-wins dedup (WR-01): once a bucket is pushed, a repeated note for
    // the same bucket is a no-op and MUST NOT fall through to another arm.
    const reason = classifyResolverNote(note);
    if (!seen.has(reason)) {
      out.push(reason);
      seen.add(reason);
    }
  }

  return out;
}

/**
 * Classify a single resolver note into exactly one closed-set bucket. The arm
 * order is significant -- the `malformed mcp reference` arm matches its FULL
 * prefix BEFORE the permissive catch-all (MCPR-03 / D-02): a bare
 * `malformed mcp` match would also match the inline `malformed mcpServers` note
 * and silently reroute it away from `unsupported source`. Any note matching no
 * specific arm falls through to the permissive `unsupported source` bucket.
 */
function classifyResolverNote(note: string): ResolverNoteReason {
  const isHooksNote =
    note.startsWith("hooks.json is not valid JSON:") ||
    note.startsWith("hooks.json failed schema validation:") ||
    note.startsWith("unsupported hooks:") ||
    note.startsWith("malformed hooks.json:");
  if (isHooksNote) {
    return "unsupported hooks";
  }

  // WR-01: the specific `malformed mcp reference` prefix arm MUST run before
  // the broad `lspServers` substring arm. A broken reference embeds the
  // author-controlled raw path verbatim, so a note like
  // `malformed mcp reference: file not found: "config/lspServers/x.mcp.json"`
  // contains the `lspServers` substring and would otherwise misclassify as
  // `{lsp}` instead of `{malformed mcp}`.
  if (note.startsWith("malformed mcp reference")) {
    return "malformed mcp";
  }

  if (note.includes("lspServers")) {
    return "lsp";
  }

  return "unsupported source";
}

/**
 * D-64-02 / RSTATE-05: derive per-kind unsupported markers from the resolver's
 * typed `unsupported: string[]` component-kind list (NOT the free-form `notes`).
 *
 * This is the single shared render-time helper for the per-kind marker family
 * carried on the `partially-available` resolver arm. `list`, `info`, and the `install`
 * error surface all route through it so a given partially-available plugin renders
 * byte-identical per-kind markers across every surface (SURF-01 cross-surface
 * parity), by construction rather than by three drift-prone copies.
 *
 * Mapping (HOOK-04 / D-58-02 / D-71-04 / D-90-05): `lspServers` renders as
 * `lsp`. A typed `hooks` kind renders the aggregate `unsupported hooks` marker.
 * A typed `workflows` kind renders the dedicated `workflows` marker through
 * `kindToReason`; it is not a `narrowResolverNotes` result. Every other typed
 * kind renders `unsupported component` (D-90-05). This marker names the
 * component axis, unlike the source-axis `unsupported source` marker.
 * First-wins dedup matches `narrowResolverNotes` semantics (WR-01), so a
 * multi-kind list never emits a duplicate token.
 *
 * Structural reasons (malformed `hooks.json`, NFR-10 source escape) are NOT
 * in this family: a structural defect routes to the `unavailable` arm
 * (D-64-07) and its reason stays on the `notes`/structural path via
 * `narrowResolverNotes`. This helper covers only the partially-available per-kind
 * markers on the `partially-available` arm.
 */
export function narrowUnsupportedKinds(
  unsupported: readonly string[],
): readonly UnsupportedReason[] {
  const out: UnsupportedReason[] = [];
  const seen = new Set<string>();
  for (const kind of unsupported) {
    const reason = kindToReason(kind);
    if (!seen.has(reason)) {
      out.push(reason);
      seen.add(reason);
    }
  }

  return out;
}

// TD-3: `kind` is deliberately typed `string`, NOT the closed `UnsupportedKind`
// union. The resolver's `unsupported` array is `Type.Array(Type.String())` and
// legitimately carries `hooks` (a SUPPORTED kind flagged as dropped) alongside
// the `UnsupportedKind` literals, so no closed union spans the real input.
// D-90-05 / WDET-04: three kinds have dedicated mappings: `lspServers` ->
// `lsp`, `hooks` -> `unsupported hooks`, and `workflows` -> `workflows`. A kind
// outside these carve-outs collapses to `unsupported component`. This result
// names the component axis instead of borrowing the source-axis token.
function kindToReason(kind: string): UnsupportedReason {
  if (kind === "lspServers") {
    return "lsp";
  }

  if (kind === "hooks") {
    return "unsupported hooks";
  }

  if (kind === "workflows") {
    return "workflows";
  }

  return "unsupported component";
}
