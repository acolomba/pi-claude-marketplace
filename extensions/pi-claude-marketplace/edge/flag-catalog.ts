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
//   - the uninstall long-flag gate (the `extractLocalFlag` CONSUMING list, also
//     via `passThroughFlagNames`);
//   - the scope-target flag name consumed by `extractLocalFlag`
//     (`SCOPE_TARGET_FLAG`).
//
// Guarded BY TEST (tests/architecture/flag-catalog-drift.test.ts): the
// reinstall/enable/disable/fetch/pending/import/bootstrap handlers hard-reject
// unknown long flags inline rather than consuming the catalog, so the drift
// guard pins every verb's parse-set to the exact flags its handler accepts (and
// reconciles catalog vs emitted completions per verb).
//
// SCOPE: this catalog models ONLY the per-verb EXTRA flags. `--scope` is a
// global base flag consumed by the parseArgs tokenizer and hard-coded as the
// base entry in flagCompletions; it is deliberately EXCLUDED here (and from both
// sides of the drift guard). Bootstrap rejects it explicitly.
//
// Each entry carries two orthogonal visibility bits:
//   - parse:    the handler accepts the flag during argv parsing.
//   - complete: the completion offers the flag as a suggestion.
// Every entry currently sets both the same. The bits stay separate because a
// flag MAY legitimately be parse-only, not because one is today.

/**
 * A single per-verb flag: its long-flag name, its completion description, and
 * the parse/complete visibility bits. The description is REQUIRED so that a
 * completable entry without one cannot be constructed; `completionFlagEntries`
 * therefore needs no presence test.
 */
interface FlagEntry {
  readonly name: string;
  readonly description: string;
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
  | "prune"
  | "reinstall"
  | "fetch"
  | "enable"
  | "disable"
  | "pending"
  | "import"
  | "bootstrap"
  | "browse"
  | "help"
  | "marketplace help"
  | "marketplace add"
  | "marketplace remove"
  | "marketplace info"
  | "marketplace list"
  | "marketplace update"
  | "marketplace autoupdate"
  | "marketplace noautoupdate";

// The write-target flag, shared by install/update/uninstall/reinstall/enable/
// disable. It selects the PHYSICAL config file within a scope
// (`claude-plugins.local.json` instead of the shared `claude-plugins.json`), so
// a change can stay out of a git-tracked config. It is orthogonal to `--scope`,
// which selects the scope's state tree rather than the file inside it, and it is
// valid at both scopes.
//
// Completion offers it because every one of those six verbs documents
// `[--local]` in its `USAGE` string.
const WRITE_TARGET_FLAG_ENTRY: FlagEntry = {
  name: "--local",
  description:
    "Write to claude-plugins.local.json (per-machine override), not the shared claude-plugins.json",
  parse: true,
  complete: true,
};

// DATA-01 / D-02-02: `--keep-data` opts out of uninstall's default data
// deletion; the plugin's artifacts and installation record are removed either
// way.
//
// WR-01: the name is EXPORTED (as `KEEP_DATA_FLAG` below) because the uninstall
// handler must map the consumed flag onto its `keepData` option field, and a
// hand-written literal at that mapping site fails OPEN -- a catalog rename would
// leave `consumedFlags.has("--keep-data")` false, so the command would delete
// the data the operator asked to keep while reporting success. Reading the name
// from here makes a rename a compile-time break at the mapping site instead.
const KEEP_DATA_FLAG_ENTRY: FlagEntry = {
  name: "--keep-data",
  description: "Preserve the plugin's persistent data directory",
  parse: true,
  complete: true,
};

// FLAG-01 / D-05-10: `--prune` also removes, after the named plugin, every
// dependency-installed record in the scope that no remaining installed plugin
// declares. A plugin the operator installed by name is never pruned.
//
// WR-01 applies here exactly as it does to `--keep-data`: the name is EXPORTED
// (as `PRUNE_FLAG` below) because the uninstall handler maps the consumed flag
// onto its `prune` option field, and a hand-written literal there fails OPEN --
// a catalog rename would leave `consumedFlags.has("--prune")` false, so the
// sweep the operator asked for would silently not run while the command
// reported success.
const PRUNE_FLAG_ENTRY: FlagEntry = {
  name: "--prune",
  description: "Also remove dependency-installed plugins no remaining plugin needs",
  parse: true,
  complete: true,
};

const DRY_RUN_FLAG_ENTRY: FlagEntry = {
  name: "--dry-run",
  description: "Preview dependency plugins that prune would remove",
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
    WRITE_TARGET_FLAG_ENTRY,
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
    WRITE_TARGET_FLAG_ENTRY,
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
  uninstall: [KEEP_DATA_FLAG_ENTRY, PRUNE_FLAG_ENTRY, WRITE_TARGET_FLAG_ENTRY],
  prune: [DRY_RUN_FLAG_ENTRY],
  reinstall: [WRITE_TARGET_FLAG_ENTRY],
  fetch: [],
  enable: [WRITE_TARGET_FLAG_ENTRY],
  disable: [WRITE_TARGET_FLAG_ENTRY],
  pending: [],
  import: [],
  bootstrap: [],
  // The three documentation/navigation verbs take no flags at all, not even
  // the global `--scope`: `browse` and `marketplace help` reject any argument,
  // and `help` reads whatever follows as a topic name. They are catalog
  // members so the drift guard sees them; `NO_FLAG_VERBS` in
  // completions/provider.ts is what keeps `--scope` off their suggestions.
  browse: [],
  help: [],
  "marketplace help": [],
  "marketplace add": [WRITE_TARGET_FLAG_ENTRY],
  "marketplace remove": [WRITE_TARGET_FLAG_ENTRY],
  "marketplace info": [],
  "marketplace list": [],
  "marketplace update": [],
  "marketplace autoupdate": [WRITE_TARGET_FLAG_ENTRY],
  "marketplace noautoupdate": [WRITE_TARGET_FLAG_ENTRY],
};

/** Type guard narrowing a raw completion head to a catalog verb key. */
export function isCatalogVerb(value: string): value is CatalogVerb {
  return Object.hasOwn(CATALOG, value);
}

/**
 * The scope-target flag name (`--local`). The shared argv scanner
 * (edge/handlers/shared.ts `extractLocalFlag`) consumes this constant so the
 * catalog owns the name rather than a duplicated literal.
 */
export const SCOPE_TARGET_FLAG = WRITE_TARGET_FLAG_ENTRY.name;

/**
 * WR-01 / DATA-01: the data-preservation flag name (`--keep-data`). The
 * uninstall handler reads this constant when mapping the scanner's consumed
 * flags onto the `keepData` option, so the catalog owns the name rather than a
 * duplicated literal whose desynchronization would silently delete data.
 */
export const KEEP_DATA_FLAG = KEEP_DATA_FLAG_ENTRY.name;

/**
 * WR-01 / FLAG-01 / D-05-10: the orphan-sweep flag name (`--prune`). The
 * uninstall handler reads this constant when mapping the scanner's consumed
 * flags onto the `prune` option, so the catalog owns the name rather than a
 * duplicated literal whose desynchronization would silently skip the sweep.
 */
export const PRUNE_FLAG = PRUNE_FLAG_ENTRY.name;

/** The standalone prune preview flag name. */
export const DRY_RUN_FLAG = DRY_RUN_FLAG_ENTRY.name;

/**
 * Ordered completion entries (name + description) for a verb -- the entries
 * flagged `complete: true`, in catalog order. `flagCompletions` spreads these
 * after the global `--scope` base entry. Every entry carries a description
 * because `FlagEntry` requires one, so no presence test is needed here.
 */
export function completionFlagEntries(verb: CatalogVerb): { name: string; description?: string }[] {
  return CATALOG[verb]
    .filter((f) => f.complete)
    .map((f) => ({ name: f.name, description: f.description }));
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
