import type { Reason } from "./notify.ts";
import type { SoftDepStatus } from "../platform/pi-api.ts";

/**
 * shared/notify-reasons.ts -- the topic-grouped organization of the closed
 * reasons set (D-09). The byte-critical runtime tuple `REASONS` stays declared
 * in `notify.ts` as the SINGLE source of catalog truth (OUT-08: the 39-entry
 * membership AND order must stay byte-identical for catalog stability); this
 * module reorganizes that closed set into shared topic-grouped enums + a
 * structural completeness proof WITHOUT recomposing the `REASONS` tuple (which
 * would risk reordering). The topic groups below are typed views over the same
 * closed `Reason` literals, so a command module can reference an
 * intent-meaningful group (e.g. the failure-class reasons) instead of the flat
 * 39-entry set.
 *
 * D-90-05 is what moved the count from 37 to 38: `"unsupported component"`
 * joined the set as the truthful marker for a dropped component kind that has
 * no carve-out of its own. OUT-01 / D-102-05 moved it from 38 to 39:
 * `"installs disabled"` joined as the marker for an install that landed
 * disabled because the plugin's own `defaultEnabled` declaration said so, and
 * brought the fourth topic group with it (D-102-06). `COMPAT-01` pins the
 * membership by enumeration and `notify-closed-set-locks.test.ts` pins the
 * length, so the two sentences above cannot drift from the tuple again without
 * a red test.
 *
 * The idempotent group keeps an `as const` tuple because `skipSeverity` needs
 * a runtime `Set` to test against; the unsupported and failure groups are
 * declared straight as literal unions, since nothing ever iterated their
 * tuples. Membership of every literal is checked at compile time against the
 * closed `Reason` set (each group's element type extends `Reason`), and the
 * `_ReasonsCoverageProof` at the bottom asserts the union of all groups + the
 * command-private reasons + the structural `"not added"` marker is EXACTLY the
 * closed set -- a literal added to `REASONS` without a home here, or a typo,
 * becomes a compile error.
 */

/**
 * D-09: idempotent / already-in-requested-state reasons. The resource already
 * matches the exact state the command requested. (These are also today's
 * benign-skip reasons; the benign-skip SET itself is a later-phase concern --
 * only the reason literals are grouped here.)
 */
const IDEMPOTENT_REASONS = [
  "up-to-date",
  "already installed",
  "already autoupdate",
  "already no autoupdate",
  "already enabled",
  "already disabled",
] as const;
type IdempotentReason = (typeof IDEMPOTENT_REASONS)[number];

const IDEMPOTENT_REASON_SET: ReadonlySet<Reason> = new Set(IDEMPOTENT_REASONS);

/**
 * SEV-01 / D-03: per-producer severity for a `skipped` row, classified from
 * the reasons the producer is about to stamp. A skip whose reasons are ALL
 * idempotent no-ops (the resource already matches the requested state) is
 * benign -> `info`; any non-idempotent reason -- or a missing/empty reason set
 * that cannot be PROVEN benign -- is actionable -> `warning`. This is the
 * producer-local replacement for the former centralized benign-reason lookup:
 * the command stamps its own desired-vs-actual judgment at the emit site.
 */
export function skipSeverity(reasons: readonly Reason[] | undefined): "info" | "warning" {
  return reasons !== undefined &&
    reasons.length > 0 &&
    reasons.every((r) => IDEMPOTENT_REASON_SET.has(r))
    ? "info"
    : "warning";
}

/**
 * SEV-01: per-producer severity for an otherwise-successful install/update row,
 * classified from the plugin's DECLARED soft-dep companions and the host's
 * companion-loaded probe. A declared `agents` kind requires `pi-subagents`; a
 * declared `mcp` kind requires `pi-mcp-adapter`. When a declared companion is
 * unloaded the clean operation is silently degraded -> `warning`; otherwise
 * (companion present, or none declared) -> `info`. The caller passes the single
 * sanctioned `softDepStatus(pi)` probe (the same one the renderer uses for the
 * `{requires pi-...}` marker), so the row bytes are unchanged -- only the
 * desired-state severity moves.
 */
export function companionSeverity(
  { declaresAgents, declaresMcp }: { declaresAgents: boolean; declaresMcp: boolean },
  probe: SoftDepStatus,
): "info" | "warning" {
  return (declaresAgents && !probe.piSubagentsLoaded) || (declaresMcp && !probe.piMcpAdapterLoaded)
    ? "warning"
    : "info";
}

/**
 * D-09: unsupported-components / soft-dep reasons -- the topic group the user
 * named explicitly (hooks / LSP / companion-extension soft deps / unsupported
 * source / no-longer-installable).
 */
type UnsupportedReason =
  | "unsupported hooks"
  | "lsp"
  | "requires pi-subagents"
  | "requires pi-mcp"
  | "unsupported source"
  // D-90-05: the truthful marker for a dropped non-carve-out component kind.
  | "unsupported component"
  | "no longer installable";

/**
 * D-09: failure-class reasons -- an operation could not complete (permission /
 * source / network / manifest / lock / concurrency / rollback failures).
 */
export type FailureReason =
  | "permission denied"
  | "source missing"
  | "network unreachable"
  // D-76-08: HTTP auth challenge (401/403) on a marketplace clone. A distinct
  // failure-class member -- truthful attribution keeps it out of `network
  // unreachable`.
  | "authentication required"
  | "unreadable"
  | "unparseable"
  | "unreadable manifest"
  | "invalid manifest"
  // MCPR-03 / D-02: a broken `mcpServers` STRING reference (missing file /
  // malformed JSON / wrapper-less / out-of-root). Failure-class, NOT
  // unsupported -- it is a malformation of a SUPPORTED feature the resolver
  // parses, so it lives here and NOT in `UnsupportedReason`.
  | "malformed mcp"
  // CLASS-01 / D-86-01: a skill / command whose source frontmatter could not be
  // parsed by Pi's own `parseFrontmatter`. Failure-class (a malformation of a
  // SUPPORTED component the skills/commands bridges stage), NOT unsupported --
  // the exact `malformed mcp` classification precedent, split per-kind for
  // truthful attribution.
  | "malformed skill"
  | "malformed command"
  | "not in manifest"
  | "rollback partial"
  | "lock held"
  | "source mismatch"
  // PURL-06: an orphaned plugin declaration whose `@<marketplace>` is not
  // declared in the merged config. A distinct failure-class member so the
  // reconcile dangling-reference diagnostic names the real problem instead of
  // reusing `source mismatch`.
  | "dangling reference"
  | "concurrently uninstalled"
  | "concurrently updated";

/**
 * D-102-06: author-declared install-time state -- a fact the plugin's OWN
 * manifest declares about HOW it installs, which is neither an idempotent no-op
 * (the resource already matched the request), nor a failure (the command could
 * not complete), nor an unsupported component (Pi cannot install the thing).
 * What these rows add is the author's DECLARATION as the cause.
 *
 * OUT-02 / OUT-03: a declaration is equally reportable before the
 * action and after it, so the group spans two tenses. On an install row the
 * desired state IS reached and the declaration explains why the result is
 * inert. On a not-installed candidate row nothing has happened yet and the
 * declaration explains what an install would produce. One group, two tenses,
 * the same cause.
 *
 * Declared as a bare union rather than as a `[...] as const` tuple like its
 * three sibling groups. Those tuples exist because something consumes them at
 * RUNTIME (`IDEMPOTENT_REASONS` builds `IDEMPOTENT_REASON_SET`); this group has
 * no such consumer, and a tuple that only ever feeds `(typeof X)[number]` is an
 * unreferenced runtime value. Add a member by extending the union; convert back
 * to a tuple if and when a runtime consumer appears.
 */
type DeclaredStateReason =
  // OUT-01 / DFEN-04: the install completed and left the plugin inert because
  // the plugin declared `defaultEnabled` false.
  "installs disabled";

/**
 * WARN-01 / CLASS-01 / D-86-03: a component kind that installs in DEGRADED form
 * when its SOURCE frontmatter cannot be parsed by Pi's own `parseFrontmatter`
 * (skill -> synthesized `disable-model-invocation` block; command -> neutralized
 * frontmatter). Both surfaces map a degraded kind to its `(installed)`-row reason
 * token through `malformedReasonsForKinds`.
 */
export type DegradeKind = "skill" | "command";

/**
 * The closed map from a degraded component kind to its one failure-class token.
 * A `Record<DegradeKind, FailureReason>` (via `satisfies`) so a new kind added to
 * `DegradeKind` fails to compile here until it is given a token -- the single
 * exhaustiveness guard replacing the two hand-maintained per-kind `if` ladders
 * the install and reconcile surfaces used to keep in sync by convention.
 */
const MALFORMED_REASON_BY_KIND = {
  skill: "malformed skill",
  command: "malformed command",
} as const satisfies Record<DegradeKind, FailureReason>;

/** Canonical emit order for the per-kind tokens: skill before command. */
const DEGRADE_KIND_ORDER = ["skill", "command"] as const satisfies readonly DegradeKind[];

/**
 * WARN-01 / CLASS-01 / D-86-03: map degraded component kinds onto ordered,
 * de-duplicated `(installed)`-row reason tokens -- one `malformed skill` /
 * `malformed command` per kind regardless of how many components of that kind
 * degraded, and regardless of duplicate or unordered input. Empty / absent in
 * -> empty out, so a clean install carries no reasons brace (NREG-01).
 */
export function malformedReasonsForKinds(
  kinds: Iterable<DegradeKind> | undefined,
): readonly FailureReason[] {
  if (kinds === undefined) {
    return [];
  }

  const present = new Set(kinds);
  return DEGRADE_KIND_ORDER.filter((kind) => present.has(kind)).map(
    (kind) => MALFORMED_REASON_BY_KIND[kind],
  );
}

/**
 * D-09: the shared topic-grouped reasons -- the union of the four groups
 * above. Command-private reasons (`duplicate name` / `stale clone` for
 * `marketplace add`, `not found` / `not installed` for `uninstall`,
 * `plugins remain` for `marketplace remove`, `orphan rewake` for `install`)
 * are NOT declared here -- they belong to the owning command's module. The
 * structural `"not added"` marketplace-absent marker is likewise not a shared
 * topic reason (it is excluded from `ContentReason` in `notify.ts`).
 */
type SharedTopicReason = IdempotentReason | UnsupportedReason | FailureReason | DeclaredStateReason;

/**
 * D-09: the command-private reasons, named here ONLY for the completeness
 * proof below -- they are owned by their command modules, not exported as a
 * shared group. `"not added"` is the structural marketplace-absent marker
 * (excluded from `ContentReason` in `notify.ts`); it is included here solely so
 * the coverage proof sees the full closed set.
 */
type CommandPrivateReason =
  | "not found"
  | "not installed"
  | "plugins remain"
  | "stale clone"
  | "duplicate name"
  | "not added"
  | "orphan rewake";

/**
 * OUT-08 completeness proof: the union of the four shared topic groups + the
 * command-private reasons + the structural marker must be EXACTLY the closed
 * `Reason` set. The two `Exclude` expressions resolve to `never` only when the
 * partition is total (no shared literal missing a home, no stray literal that
 * is not in `REASONS`). `_ReasonsCoverageProof` pins each to `never` via a
 * default-type constraint -- a non-`never` result is a TS2344 compile error.
 * It is a type-only check with no runtime footprint.
 */
type _AssertNever<T extends never> = T;
type _UncoveredReason = Exclude<Reason, SharedTopicReason | CommandPrivateReason>;
type _ExtraReason = Exclude<SharedTopicReason | CommandPrivateReason, Reason>;
// fallow-ignore-next-line unused-type, private-type-leak -- OUT-08 completeness proof; a non-never result is a TS2344 build failure, and the export is what keeps `noUnusedLocals` quiet. `_AssertNever` / `_UncoveredReason` / `_ExtraReason` are the proof's own internals, meaningless to a caller.
export type _ReasonsCoverageProof = [_AssertNever<_UncoveredReason>, _AssertNever<_ExtraReason>];
