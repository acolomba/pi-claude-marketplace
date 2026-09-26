import { type Reason } from "./notification-types.ts";

import type { SoftDepStatus } from "../platform/pi-api.ts";

/**
 * shared/notify-reasons.ts -- the topic-grouped organization of the closed
 * reasons set (D-09). `notification-types.ts` declares `Reason` as the SINGLE
 * source of catalog truth (OUT-08: its membership AND order must stay
 * byte-identical for catalog stability); this module reorganizes that closed set
 * into shared topic-grouped unions + a structural completeness proof WITHOUT
 * restating the vocabulary's order. The topic groups below are typed views over
 * the same closed `Reason` literals, so a command module can reference an
 * intent-meaningful group (e.g. the failure-class reasons) instead of the flat
 * set.
 *
 * The set is APPEND-ONLY: a new token joins at the tail, existing entries never
 * move, and the declared order is catalog-stable because a rendered brace
 * follows declaration order. `COMPAT-01` pins the membership by enumeration and
 * `notify-closed-set-locks.test.ts` pins the length, so the vocabulary cannot
 * drift unnoticed, and every member whose presence needs an argument carries its
 * own decision ID beside its literal in `notification-types.ts`. No running
 * count of the set lives in prose here: neither gate reads a comment, so a
 * number written here would be the one claim about this set that nothing turns
 * red for.
 *
 * The idempotent group keeps an `as const` tuple because `skipSeverity` needs
 * a runtime `Set` to test against; the unsupported and failure groups are
 * declared straight as literal unions, since nothing ever iterated their
 * tuples. Membership of every literal is checked at compile time against the
 * closed `Reason` set (each group's element type extends `Reason`), and the
 * coverage proof beside the per-kind reason map asserts the union of all groups
 * + the command-private reasons + the structural `"marketplace not added"`
 * marker is EXACTLY the closed set -- a literal added to `Reason` without a home
 * here, or a typo, becomes a compile error.
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
 * that cannot be PROVEN benign -- is actionable -> `warning`. The judgment is
 * producer-local: the command stamps its own desired-vs-actual verdict at the
 * emit site.
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
 * declared `mcp` kind requires `pi-mcp-adapter`; a declared `workflows` kind
 * requires the host workflow engine. When a declared companion is unloaded the
 * clean operation is silently degraded -> `warning`; otherwise (companion
 * present, or none declared) -> `info`. The caller passes the single sanctioned
 * `softDepStatus(pi)` probe (the same one the renderer uses for the
 * `{requires pi-...}` marker), so the row bytes are unchanged -- only the
 * desired-state severity moves.
 */
export function companionSeverity(
  {
    declaresAgents,
    declaresMcp,
    declaresWorkflows,
  }: { declaresAgents: boolean; declaresMcp: boolean; declaresWorkflows: boolean },
  probe: SoftDepStatus,
): "info" | "warning" {
  return (declaresAgents && !probe.piSubagentsLoaded) ||
    (declaresMcp && !probe.piMcpAdapterLoaded) ||
    (declaresWorkflows && !probe.workflowEngineLoaded)
    ? "warning"
    : "info";
}

/**
 * D-09: unsupported-components / soft-dep reasons -- the topic group the user
 * named explicitly (hooks / LSP / companion-extension soft deps / unsupported
 * source / unsupported component / no-longer-installable).
 */
type UnsupportedReason =
  | "unsupported hooks"
  | "lsp"
  | "requires pi-subagents"
  | "requires pi-mcp"
  // WDEP-04: the host workflow engine soft-dep marker.
  | "requires pi-dynamic-workflows"
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
 * Declared as a bare union rather than as a `[...] as const` tuple. Of its
 * three sibling groups only `IdempotentReason` is such a tuple, because
 * `IDEMPOTENT_REASONS` builds a runtime `Set` (`IDEMPOTENT_REASON_SET`) that
 * `skipSeverity` consumes; `UnsupportedReason` and `FailureReason` are bare
 * unions for the same reason this group is: nothing consumes them at
 * RUNTIME, and a tuple that only ever feeds `(typeof X)[number]` is an
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
 * OUT-08 completeness proof: the union of the four shared topic groups + the
 * command-private reasons + the structural marker must be EXACTLY the closed
 * `Reason` set. The two `Exclude` expressions resolve to `never` only when the
 * partition is total (no shared literal missing a home, no stray literal that is
 * not a `Reason`). `_AssertNever` pins each to `never` through a default-type
 * constraint, so a non-`never` result is a TS2344 compile error where the proof
 * is declared.
 *
 * `Proven<T>` is how the proof reaches the contract it protects: it resolves to
 * `T` only while the partition is total, and to `never` otherwise, which is what
 * the per-kind reason map below is annotated against. The proof is therefore
 * consumed by the mapping it guards rather than exported for a caller who has no
 * use for it. Both are type-only, with no runtime footprint.
 */
type _AssertNever<T extends never> = T;
type _UncoveredReason = Exclude<Reason, SharedTopicReason | CommandPrivateReason>;
type _ExtraReason = Exclude<SharedTopicReason | CommandPrivateReason, Reason>;
type ReasonsCoverageProof = [_AssertNever<_UncoveredReason>, _AssertNever<_ExtraReason>];
type Proven<T> = ReasonsCoverageProof extends [never, never] ? T : never;

/**
 * The closed map from a degraded component kind to its one failure-class token.
 * A `Record<DegradeKind, FailureReason>` (via `satisfies`) so a new kind added to
 * `DegradeKind` fails to compile here until it is given a token -- the single
 * exhaustiveness guard that keeps the install and reconcile surfaces from
 * drifting out of per-kind sync.
 *
 * The value type is `FailureReason` gated on the OUT-08 completeness proof, so
 * this one annotation carries both obligations: a kind without a token, and a
 * reason without a home.
 */
const MALFORMED_REASON_BY_KIND = {
  skill: "malformed skill",
  command: "malformed command",
} as const satisfies Record<DegradeKind, Proven<FailureReason>>;

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
 * structural `"marketplace not added"` marketplace-absent marker is likewise not a shared
 * topic reason (it is excluded from `ContentReason` in `notification-types.ts`).
 */
type SharedTopicReason = IdempotentReason | UnsupportedReason | FailureReason | DeclaredStateReason;

/**
 * D-09: the command-private reasons, named here ONLY for the completeness
 * proof -- they are owned by their command modules, not exported as a
 * shared group. `"marketplace not added"` and its two scope-qualified siblings are the three
 * structural marketplace-absent markers (all excluded from `ContentReason` in
 * `notification-types.ts`); they are included here solely so the coverage proof sees the
 * full closed set.
 */
type CommandPrivateReason =
  | "not found"
  | "not installed"
  // DATA-01 / WR-06: uninstall's data-disposition marker, stamped by the
  // preserving branch of the one command that offers the opt-out. Owned by that
  // verb, so it is named here for the proof rather than promoted to a shared
  // topic group.
  | "data kept"
  // SCOPE-01 / D-01: the cross-scope qualifier the lifecycle verbs join to
  // `not installed` on an absent-target row. Owned by those verbs' own
  // absent-target composer alongside `not installed`, so it is named here for
  // the proof rather than promoted to a shared topic group. Unlike the three
  // structural markers below it, this pair IS a `ContentReason`.
  | "marketplace in user scope"
  | "marketplace in project scope"
  // RESV-02..06: the dependency-cascade vocabulary, owned by
  // `orchestrators/plugin/install-cascade.messaging.ts`. Every one of them
  // describes the install cascade's relationship to ONE closure member, so they
  // are named here for the proof rather than promoted to a shared topic group.
  // All seven are `ContentReason`s -- each rides the row of the dependency (or,
  // for `dependency failed`, the requesting plugin) it is a fact about.
  | "no matching version"
  | "version conflict"
  | "constraint too complex"
  | "invalid version constraint"
  | "dependency marketplace not added"
  // D-11-06: the root marketplace's policy refuses this dependency edge.
  | "cross-marketplace"
  | "dependency cycle"
  | "dependency failed"
  // TAGS-02 / D-07-03: no marketplace tag satisfied the path-source
  // dependency's constraint, so the marketplace's CURRENT copy installed
  // instead of failing. Rides an `installed` row because the install
  // succeeded -- it is not an idempotent reason (a copy installed, which is
  // not a no-op) and not a failure reason (nothing failed). The constraint
  // itself is checked at load by the LOAD-01 check, not here.
  //
  // D-07-03 locks this reason's severity at `info`, a deliberate divergence
  // from Claude Code's own `warning` for the same fallback: the install
  // itself always succeeds, and the load-time check is what actually flags
  // and disables a dependent once the fallback copy is genuinely out of
  // range. `companionSeverity` (not this reason) still raises the row to
  // `warning` when the member's own soft-dep companion is unloaded, so a
  // real degradation is never masked. Do not raise this reason's severity to
  // match `warning` without recording a decision that supersedes D-07-03.
  | "dependency current copy"
  // D-08-02: install's already-installed arm and enable's own cascade member
  // row both stamp this when a disabled, already-installed dependency is
  // re-materialized through its record. Owned by
  // `orchestrators/plugin/enable-disable.messaging.ts` (EDEP-01's cascade
  // member row) and shared by `install-cascade.messaging.ts`'s
  // already-installed arm (EDEP-03).
  | "dependency enabled"
  // D-04-07: install's marker for a recorded dependency the user then named.
  // The record changed hands and nothing was materialized, so it joins
  // `already installed` on an `installed` row rather than a skipped one -- a
  // promotion mutates state, which is why it is not an idempotent reason.
  | "dependency promoted"
  | "plugins remain"
  // D-05-11 / PRUNE-04: uninstall's prune marker, owned by
  // `orchestrators/plugin/uninstall.messaging.ts`. The row's plugin was
  // recorded as another plugin's dependency and `--prune` removed it once
  // nothing installed declared it. NOT idempotent: a record left the state.
  | "dependency pruned"
  // LOAD-01: the load-time check's marker, owned by
  // `orchestrators/reconcile/reconcile.messaging.ts`. The row's plugin declares
  // a dependency the scope does not satisfy, so the check disabled it; the
  // remedy naming both parties rides the cause line. NOT idempotent: the record
  // changed state, and the user did not ask for it.
  | "dependency unsatisfied"
  // LOAD-01: the same check's marker on its version arm, owned by the same
  // module. The dependency is recorded and enabled, and the row's cause line
  // carries the range the recorded version missed. NOT idempotent, for the same
  // reason its neighbour is not.
  | "dependency version unsatisfied"
  // LOAD-03 / D-06-06: uninstall's consequence marker, owned by
  // `orchestrators/plugin/uninstall.messaging.ts`. Other installed plugins in
  // the scope still declared the plugin this command removed, and the removal
  // went through; the keys of those plugins ride the cause line. NOT
  // idempotent: a record left the state. It is the one member of this group
  // that rides a SUCCESS row -- the command was carried out in full, and the
  // consequence it names is reported at the next load, at warning, by the
  // check that owns `dependency unsatisfied`.
  | "dependents unsatisfied"
  | "stale clone"
  | "duplicate name"
  | "marketplace not added"
  | "marketplace not added to user scope"
  | "marketplace not added to project scope"
  | "orphan rewake"
  // EDEP-02: disable's refusal marker, owned by
  // `orchestrators/plugin/enable-disable.ts`. An installed and ENABLED
  // plugin in the same scope still declares the target, so the disable is
  // refused and nothing is written; the dependent keys ride the cause line.
  // It is the one member of this group that rides a `failed` row -- the
  // command was NOT carried out, unlike its `dependents unsatisfied`
  // neighbour above.
  | "dependents remain"
  // MISS-01 / D-09-09: reload's marker for a missing declared dependency the
  // dependency-install step materialized, owned by
  // `orchestrators/reconcile/notify.ts`. The row's plugin was never named by
  // the user; it exists to satisfy a declaration. NOT idempotent: a record
  // was materialized, and it is not a failure -- the install succeeded.
  | "dependency installed"
  // UPDT-02 / D-10-09: the update-preflight constraint gate's marker for a
  // plugin held to versions its installed dependents jointly admit. NOT
  // idempotent: the update the user asked for was not carried out.
  | "dependents constrain"
  // WLIF-06: the retired-workflow-command marker. Five verbs stamp it. The
  // three that RE-MATERIALIZE (enable / reinstall / update) take a
  // previous-minus-current difference through `retiresWorkflowCommand`; the two
  // that only REMOVE (uninstall / disable) read what their cascade reported
  // dropping. Enable and reinstall pass PLACED names; update passes its
  // PREPARED names, which equal the placed ones there because that call site
  // sits past the phase-3 failure guard -- a commit that placed any less took
  // the failure exit instead. Named here for the proof rather than promoted to
  // a shared topic group. Like the cross-scope pair above, it IS a
  // `ContentReason`.
  | "stale workflow command"
  // WCONV-03: the load-time convergence marker. The reconcile backfill
  // projection places it on both arms of a re-materialized record's row, so a
  // user can attribute new commands to a reload they did not initiate. Owned by
  // that one projection rather than shared across topic groups, so it is named
  // here for the proof. Like its neighbour above, it IS a `ContentReason`.
  | "components now supported";
