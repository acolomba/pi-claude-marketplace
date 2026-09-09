# Phase 116: Load-time workflow convergence - Context

**Gathered:** 2026-09-09
**Status:** Ready for planning

<domain>
## Phase Boundary

A user who installed a workflow-bearing plugin before the `workflows` kind was
admitted gets its workflow commands after one reload, exactly once, and can tell
from the output why commands appeared after a reload they did not initiate.

The seam is `orchestrators/reconcile/` -- specifically the load-time backfill
step (`backfill.ts`) and the row it emits through
`orchestrators/reconcile/notify.ts`. This phase does NOT touch
`domain/workflow-script.ts` or `bridges/workflows/`, which are Phase 115's
territory, and does not touch the live-UAT canary, which is Phase 117's.

Requirements in scope: WCONV-01, WCONV-02, WCONV-03.

</domain>

<decisions>
## Implementation Decisions

### D-116-01: Scan widening

- **The filter widens by deletion, not by branching.** Remove the
  `if (record.compatibility.installable) { return false; }` early return in
  `backfillOnePluginIsolated` (`orchestrators/reconcile/backfill.ts:267`)
  outright, leaving `supportedSetGrew` as the sole growth gate. Measured
  justification: `supportedSetGrew` already returns `false` when
  `resolved.length <= recorded.length`, so a record at `installable: true`
  whose set did not move costs one offline re-resolve and no write -- which is
  exactly what success criterion 3 requires. A two-arm shape would state the
  growth policy twice.
- **`hasForceInstalledPlugin` is verified before it is widened, not widened on
  assumption.** The guard at `backfill.ts:167` decides whether a stamp write is
  worth bringing a `state.json` into existence for, and today it answers "only
  if some record is `installable: false`". After the deletion above, any record
  is a candidate, so the guard looks like it must widen too. But
  `applyBackfillForScope` already returns early when `state === undefined`, and
  the guard is only consulted when `!readResult.stateExisted` -- so if a
  non-existent `state.json` always implies zero records, the guard cannot
  matter and must be left alone. Plant the case and measure which it is before
  editing. Widening a guard that cannot fire is dead code; leaving a guard that
  can fire makes the widened scan unreachable.
- **D-68-03 is amended, not left standing.** Its "scan ONLY partially-installed
  plugins" clause is superseded by WCONV-01 and the comment says so. Its other
  two halves -- the strict-superset growth test and stamp-on-gate-open -- are
  still live and stay cited. A comment that argues for a filter the phase just
  deleted is worse than no comment.
- **The set of sites encoding "only `installable: false` is scannable" is
  derived by removal.** Flip the filter first, run the suite, and treat every
  red assertion as a member; then `grep` `installable` across
  `orchestrators/reconcile/` as an independent cross-check. Do not enumerate
  the sites by reading. This milestone's most repeated defect is an enumeration
  shorter than the set it names -- five times, every one found by removing
  something and watching what went red.

### D-116-02: The WCONV-03 signal

- **A new closed-set reason token, because the gap is measured.** A backfilled
  row with `installable: true` and no degrade signals renders
  `status: "installed"` with no `reasons` brace
  (`orchestrators/reconcile/notify.ts:619-628`) -- byte-identical to a fresh
  install row. No existing token in the closed 45-entry `REASONS` set means
  "this appeared because the supported set grew", so the amendment is
  necessary rather than stylistic.
- **The token rides the existing `plugin-backfilled` outcome.** It already
  carries `installable`, `unsupported`, `orphanRewake` and `degradedKinds`, and
  already routes through `backfilledRowFromOutcome`. A new `PerEntryOutcome`
  member would need its own arm in the union, the projection switch and the
  catalog for no behavioural gain.
- **Both render arms carry it.** The `partially-installed` arm gets the token
  as well as the `installed` one: a user who gets some new commands is as
  surprised as one who gets all of them, and WCONV-03 is about explaining a
  reload the user did not initiate.
- **Silence is asserted, not built.** `maybeBackfillPlugin` returns before
  pushing any outcome when `supportedSetGrew` is false, so a scan that
  materialized nothing produces no row and needs no suppression path. Add a
  case that asserts the silence; do not add a no-op outcome to represent it.
- **The closed-set amendment sites are measured, not listed.** Adding a member
  to a closed set compiles clean at every derivation site -- that exact defect
  shipped three times in one milestone, and the "exact-length tuple" guard
  meant to catch it never guarded. Derive the amendment sites the same way as
  D-116-01: by planting.

### D-116-03: Proving it

- **Tests live beside what they test.** The scan, growth and one-time behavior
  go in `tests/orchestrators/reconcile/backfill.test.ts`, which already exists.
  The token goes in the three architecture tests success criterion 4 names:
  `tests/architecture/notify-closed-set-locks.test.ts`,
  `tests/architecture/compat-01-no-expansion.test.ts`, and the byte pairing in
  `docs/output-catalog.md` against `tests/architecture/catalog-uat.test.ts`. A
  new integration file only if a real reload path cannot be reached from a unit
  test.
- **"One-time" is proven on bytes AND mtime.** RECON-05's invariant is stated
  in mtime terms, and byte-equality alone would pass an implementation that
  atomically rewrites identical content -- a green run that checked nothing.
  Capture both before and after the second load.
- **Criterion 3's two halves are two cases, not one.** An equal-set record
  (scanned, not materialized) and a disabled record (never scanned) fail
  differently and must be separable. The disabled half is asserted through a
  resolve-counting seam so "never scanned" is a measured zero rather than an
  absence inferred from a missing row.
- **Every new gate gets a negative control, run before it is believed.**
  Reverting the widened filter must turn the WCONV-01 case red; removing the
  new token from the closed set must turn the lock test red. Paste the failing
  transcripts into the SUMMARY, not a summary of them. A guard that is green
  because it checks nothing has shipped three times here.

### Claude's Discretion

Token spelling, the exact wording of the amended D-68-03 comment, test names,
and task/wave decomposition are at the planner's discretion within the
constraints above.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `supportedSetGrew` (`orchestrators/reconcile/backfill.ts:454`) -- the strict-
  superset growth test. WCONV-02 explicitly reuses it; no change needed.
- The `EXTENSION_VERSION` stamp gate (`backfill.ts:76`) -- the existing
  one-time bound. WCONV-02 explicitly reuses it; no change needed.
- `PluginBackfilledOutcome` (`orchestrators/reconcile/apply-outcomes.ts:135`)
  -- already models a re-materialization with its own installability and
  degrade signals.
- `backfilledRowFromOutcome` (`orchestrators/reconcile/notify.ts:610`) -- the
  single projection from that outcome to a rendered row, with both arms
  already written.
- `tests/orchestrators/reconcile/backfill.test.ts` -- the existing owner suite.

### Established Patterns

- Per-plugin fault isolation: `backfillOnePluginIsolated` catches per record so
  one bad plugin does not abort the scan or wrongly close the version gate.
- Returning `true` from a backfill path means "keep the version gate OPEN and
  retry next load"; benign outcomes return `false`. Any new arm must pick a
  side deliberately.
- Closed sets are locked by architecture tests that assert an exact count
  (`REASONS` at 45, `STATUS_TOKENS` at 24, `PLUGIN_STATUSES` at 19,
  `MARKETPLACE_STATUSES` at 7 in
  `tests/architecture/notify-closed-set-locks.test.ts`). Amending one moves a
  pinned count.
- Row grammar is subject-first: `<glyph> <name> [scope] (status) {reason}`. A
  new token is a closed-set catalog amendment, not free text.

### Integration Points

- `applyBackfillForScope` is called from `applyReconcile`
  (`orchestrators/reconcile/apply.ts:793`), after `applyPlan`, in the
  no-outer-lock apply region, so promotion rows ride the same single cascade.
- `alreadyTouched` in `scanForceInstalledBackfills` prevents double-emitting
  over a plugin `applyPlan` already handled this load. Widening the scan
  increases how often that guard actually fires -- worth a case.
- `docs/output-catalog.md` and `tests/architecture/catalog-uat.test.ts` are in
  Phase 114's verification `covered_files`, so a catalog amendment here will
  make Phase 114's verification stale. That is expected and is why 114's
  re-verification is sequenced after 116 and 117 rather than before.

</code_context>

<specifics>
## Specific Ideas

The population WCONV-01 names is concrete: both Anthropic-authored workflow
plugins land on the `installable: true` side, because the kind they were
missing was invisible rather than unsupported. A case built on that shape is
worth more than a synthetic one.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>
