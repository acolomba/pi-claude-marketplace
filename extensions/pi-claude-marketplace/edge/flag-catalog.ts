// edge/flag-catalog.ts
//
// Single source of truth for the PER-VERB CLI flags of `/claude:plugin`.
//
// Derived BY CONSTRUCTION from this catalog:
//   - the completion candidate list (provider.ts flagCompletions, via
//     `completionFlagEntries` + `isCatalogVerb`);
//   - the list/info handler parse sets (list.ts BOOLEAN_FLAGS, info.ts
//     ACCEPTED_FLAGS, via `parseFlagNames`);
//   - the install/update long-flag gates (the `extractLocalFlag` pass-through
//     lists and the `parsePositionalsWithFlags` recognized set, via
//     `passThroughFlagNames`);
//   - the scope-target flag name consumed by `extractLocalFlag`
//     (`SCOPE_TARGET_FLAG`).
//
// Guarded BY TEST (tests/architecture/flag-catalog-drift.test.ts): the
// uninstall/reinstall/enable/disable/fetch/pending/import/bootstrap handlers
// hard-reject unknown long flags inline rather than consuming the catalog, so
// the drift guard pins every verb's parse-set to the exact flags its handler
// accepts (and reconciles catalog vs emitted completions per verb).
//
// SCOPE: this catalog models ONLY the per-verb EXTRA flags. `--scope` is a
// global base flag consumed by the parseArgs tokenizer and hard-coded as the
// base entry in flagCompletions; it is deliberately EXCLUDED here (and from both
// sides of the drift guard) because it never varies per verb.
//
// Each entry carries two orthogonal visibility bits:
//   - parse:    the handler accepts the flag during argv parsing.
//   - complete: the completion offers the flag as a suggestion.
// Every catalog entry today sets both bits the same: a flag the handler
// accepts is also one completion offers. (`--local` previously diverged as
// parse=true/complete=false to keep completions quiet, but that hid the
// per-machine override path from the operator at exactly the scope-decision
// point where it matters, so it now completes too.)

/**
 * A single per-verb flag: its long-flag name, an optional completion
 * description, and the parse/complete visibility bits.
 */
interface FlagEntry {
  readonly name: string;
  readonly description?: string;
  readonly parse: boolean;
  readonly complete: boolean;
}

/**
 * Verb keys the catalog is indexed by. `ls` is the router alias for `list` and
 * maps to the `list` key at the call site (it is not a separate catalog entry).
 */
export type CatalogVerb =
  | "install"
  | "update"
  | "list"
  | "info"
  | "uninstall"
  | "reinstall"
  | "fetch"
  | "enable"
  | "disable"
  | "pending"
  | "import"
  | "bootstrap";

// The scope-target flag is parse-accepted AND completed on
// install/update/uninstall/reinstall/enable/disable. `--local` selects the
// per-machine override file (claude-plugins.local.json) as the write target
// instead of the shared base (claude-plugins.json), so a project-scope install
// or enable can stay out of a git-tracked config. It is orthogonal to `--scope`
// (which selects the scope's state tree, not the file within it) and is valid at
// both scopes. Surfacing it in completion puts it at the operator's fingertips at
// the scope-decision point rather than requiring it be known ahead of time.
const SCOPE_TARGET_FLAG_ENTRY: FlagEntry = {
  name: "--local",
  description:
    "Write to claude-plugins.local.json (per-machine override), not the shared claude-plugins.json",
  parse: true,
  complete: true,
};

const CATALOG: Record<CatalogVerb, readonly FlagEntry[]> = {
  install: [
    // AG-7 opt-in: `--map-model` surfaces as a completion suggestion.
    {
      name: "--map-model",
      description: "Enable model field mapping in generated agents (default: omit)",
      parse: true,
      complete: true,
    },
    // LIST-02 / D-67-02: `--partial` widens the install candidate set (available +
    // partially-available); FORCE-05 excludes unavailable.
    {
      name: "--partial",
      description: "Install over collisions and unsupported components (not unavailable)",
      parse: true,
      complete: true,
    },
    SCOPE_TARGET_FLAG_ENTRY,
  ],
  update: [
    {
      name: "--map-model",
      description: "Enable model field mapping in generated agents (default: omit)",
      parse: true,
      complete: true,
    },
    {
      name: "--partial",
      description: "Install over collisions and unsupported components (not unavailable)",
      parse: true,
      complete: true,
    },
    SCOPE_TARGET_FLAG_ENTRY,
  ],
  list: [
    // LIST-01 / D-67-01: the PL-1 filter family.
    { name: "--installed", description: "Show installed plugins", parse: true, complete: true },
    { name: "--available", description: "Show available plugins", parse: true, complete: true },
    {
      name: "--unavailable",
      description: "Show unavailable plugins",
      parse: true,
      complete: true,
    },
    {
      name: "--partial",
      description: "Show partially available plugins",
      parse: true,
      complete: true,
    },
    // RSTA-07 / D-80-07: `--remote` joins the filter family (the `(remote)` bucket).
    { name: "--remote", description: "Show remote plugins", parse: true, complete: true },
  ],
  info: [
    // FTCH-03: `info --fetch` warms the git-source clone cache, then resolves.
    {
      name: "--fetch",
      description: "Warm the plugin cache before showing info",
      parse: true,
      complete: true,
    },
  ],
  uninstall: [SCOPE_TARGET_FLAG_ENTRY],
  reinstall: [SCOPE_TARGET_FLAG_ENTRY],
  fetch: [],
  enable: [SCOPE_TARGET_FLAG_ENTRY],
  disable: [SCOPE_TARGET_FLAG_ENTRY],
  pending: [],
  import: [],
  bootstrap: [],
};

/** Every catalog verb, derived from the CATALOG keys (no hand-copied list). */
export const CATALOG_VERBS = Object.keys(CATALOG) as readonly CatalogVerb[];

/** Type guard narrowing a raw completion head to a catalog verb key. */
export function isCatalogVerb(value: string): value is CatalogVerb {
  return Object.hasOwn(CATALOG, value);
}

/**
 * The scope-target flag name (`--local`). The shared argv scanner
 * (edge/handlers/shared.ts `extractLocalFlag`) consumes this constant so the
 * catalog owns the name rather than a duplicated literal.
 */
export const SCOPE_TARGET_FLAG = SCOPE_TARGET_FLAG_ENTRY.name;

/**
 * Ordered completion entries (name + optional description) for a verb -- the
 * entries flagged `complete: true`, in catalog order. `flagCompletions` spreads
 * these after the global `--scope` base entry.
 */
export function completionFlagEntries(verb: CatalogVerb): { name: string; description?: string }[] {
  return CATALOG[verb]
    .filter((f) => f.complete)
    .map((f) =>
      f.description === undefined ? { name: f.name } : { name: f.name, description: f.description },
    );
}

/**
 * The set of parse-accepted flag names for a verb -- the entries flagged
 * `parse: true`. The handlers and the drift guard reconcile against this set.
 */
export function parseFlagNames(verb: CatalogVerb): Set<string> {
  return new Set(CATALOG[verb].filter((f) => f.parse).map((f) => f.name));
}

/**
 * The parse-accepted long flags a handler passes through `extractLocalFlag`
 * for downstream consumption -- the verb's parse-set minus the scope-target
 * flag (which `extractLocalFlag` consumes itself).
 */
export function passThroughFlagNames(verb: CatalogVerb): readonly string[] {
  return CATALOG[verb].filter((f) => f.parse && f.name !== SCOPE_TARGET_FLAG).map((f) => f.name);
}
