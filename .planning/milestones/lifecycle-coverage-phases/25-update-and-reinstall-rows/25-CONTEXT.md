# Phase 25: Update and Reinstall Rows - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous smart discuss; the run is autonomous and non-interactive, so every recommended answer below was taken without a prompt.

<domain>
## Phase Boundary

Update and reinstall rows always say which version and commit moved, and
their refusals match `uninstall`. Requirements: UPR-02, UPR-03, UPR-04. The
2026-10-23 second-round decision in ROADMAP "### Phase 25" is binding:
follow Claude Code unless a recorded divergence applies, and the user's own
call, "show the commit when the version is the same:
`1.0.0 (bfgaef) -> 1.0.0 (abe2a)`".

Folded in from Phase 18's review and verification ("Seams for phases 25 and
26" in `18-VERIFICATION.md`, IN-05 and WR-07 in `18-REVIEW-FIX.md`):

- a missing path-source directory reads `{source missing}` on update and
  reinstall;
- a failed clone reads its transport or host reason, not
  `{no longer installable}` (IN-05);
- `list`'s installed-row `upgradable` check follows the one version rule;
- the update constraint gate and the reconcile dependency verdict print
  declared ranges in Claude Code's `, ` form (INR-05's form);
- the constraint cause line on `updated` and `reinstalled` rows (WR-07's
  deferred half).

Files this phase owns: `orchestrators/plugin/update-swap.ts` (the `updated`
outcome literal only), `update-preflight.ts` (`resolveUpdateCandidate`'s
catch and `triageUpdateMembership` only), `update-row.ts`,
`update-cascade.ts`, `update-flow.ts` (failed-outcome versions),
`update-constraint-gate.ts` (`describeConstraint` and its callers),
`reinstall-record.ts`, `reinstall-flow.ts` (the pre-runner skip),
`reinstall.messaging.ts`, `orchestrators/plugin/shared.ts`
(`emitMarketplaceNotAddedSignal` only), `list-installed-row.ts`,
`orchestrators/marketplace/update.messaging.ts` (the autoupdate rows),
`orchestrators/reconcile/dependency-verdict.ts` (`unsatisfiedRange`),
`orchestrators/reconcile/backfill.ts` (the reinstall outcome arms),
`orchestrators/types.ts` (outcome shapes), `shared/notification-types.ts`,
`shared/notification-grammar.ts`, `shared/notification-json.ts`,
`schema/claude-plugin.schema.json`, `docs/json-output.md`,
`docs/output-catalog.md` and its catalog-UAT fixtures, their unit tests, and
`features/plugin/{update,reinstall,update-rollback,git-source-update,list}.feature`.

</domain>

<decisions>
## Implementation Decisions

### Upstream evidence (Claude Code 2.1.309 binary, grepped 2026-10-23)

Binary: `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.309/claude`.

- **D-01:** Upstream `update` reports `Plugin "<p>" updated from <old> to
  <new><xe> for scope <s>.`, where `<xe>` is
  ` (highest tag satisfying ${ranges.join(", ")} from ${dependents})` when a
  dependent's range chose the tag. A source pinned to a listed commit reads
  `updated to the listed commit ${sha.slice(0,7)} (version <v>)`. It reports
  `up_to_date` only when both the version and `gitCommitSha` are unchanged,
  and the outcome carries `gitCommitSha` and `pinChanged`. So upstream treats
  a new commit at the same version as an update and names short commits in
  7 hex characters. Confidence high (verbatim template strings).
- **D-02:** Upstream `update` of a plugin with no install record returns
  `{outcome:"failed", message:"Plugin \"<p>\" is not installed",
  failureCode:"not_installed"}` (`not_installed_at_scope` when another scope
  has it). It checks the install record before it reads the marketplace
  entry. Upstream `uninstall` fails the same way (`not found in installed
  plugins`, `failureCode:"not_installed"`). Upstream has no `reinstall` verb
  (D-18-01): its reinstall is uninstall plus install, so a not-installed
  target fails at the uninstall step. Confidence high.
- **D-03:** Upstream's up-to-date ceiling message prints the declared ranges
  joined with `, ` (`satisfying ${Re.join(", ")}`), the form phase 27 adopted
  for install (INR-05, 27-CONTEXT D-01/D-02). Confidence high.
- **D-04:** No upstream position exists for the row grammar itself (Pi's
  glyph/status/brace rows) or for the `reinstall` verb's row. Those
  decisions follow the user's decision and the project's existing rules.

### Same version, new commit (UPR-02)

- **D-05:** A row that shows a version transition shows each side's short
  commit only when the declared versions are equal AND both sides have a
  commit AND the commits differ. Text form, with the house `v` prefix from
  `renderVersion`: `v1.0.0 (abc1234) → v1.0.0 (def5678)`. In every other case
  the arrow renders exactly as today (NREG-01). The producer decides (the
  orchestrator stamps the commits, `notification-grammar.ts` only draws them;
  the "dumb renderer" rule), so the composer in
  `notification-grammar.ts::composeVersionArrow` gains an optional commit per
  side and nothing else.
- **D-06:** The commits come from the install record's `resolvedSha` (full
  40-hex, `persistence/state-io.ts`): the "from" side is the record the
  preflight read (`preflight.record.resolvedSha`), the "to" side is the
  candidate's (`preflight.resolvedSha`, which is `clone.resolvedSha()` for
  git sources and the tag-clone sha for a pinned path source). Both are
  already in scope in `update-swap.ts`'s `updated` outcome literal (~1458).
  The text shows the first 7 hex characters (upstream's `slice(0,7)`).
- **D-07:** Path sources: an unpinned path source records no `resolvedSha`,
  so its row never shows a commit. A switch between a git and a path source,
  or a pre-Phase-16 record with no sha, has a commit on one side only and
  shows none (no half-annotated arrow). A pinned path source carries the tag
  clone's sha on both sides and follows D-05.
- **D-08:** `sha-<12hex>` versions: the version is derived from the commit,
  so equal `sha-` versions imply the same commit prefix and D-05 never adds
  a second sha (no `v#abc1234 (abc1234)`). Different `sha-` versions already
  render as `v#abc1234 → v#def5678`. `hash-<12hex>` path versions carry no
  commit. No special case is needed beyond D-05's "versions equal" test.
- **D-09:** JSON: an `updated` row gains optional `fromCommit` and `toCommit`
  (full 40-hex, the raw value, as JSON carries raw `sha-`/`hash-` versions),
  present exactly when the text shows commits. Additive optional fields keep
  `schemaVersion` 1 (`docs/json-output.md`); `schema/claude-plugin.schema.json`
  and `docs/json-output.md` are updated, since the committed schema rejects
  unknown properties.
- **D-10:** The same commit rule applies wherever D-12 gives a row an arrow:
  `reinstalled`, update's `partially-installed`, and `failed` rows. The phase
  goal ("update and reinstall rows always say which version and commit
  moved") covers reinstall, and the shared composer
  (`update-row.ts::updatedRowFromOutcome`) already serves both update
  cascades, so the autoupdate cascade (`marketplace/update.messaging.ts`)
  gets the commits with no code of its own.

### Versions on every row (UPR-03)

- **D-11:** `reinstallOutcomeFromRun` (`reinstall-record.ts:67-111`) carries
  `run.fromVersion` and both commits onto the `reinstalled` outcome, and on
  the `failed` outcome whatever versions the run knew.
  `ReinstallReinstalledOutcome` and `ReinstallFailedOutcome`
  (`orchestrators/types.ts`) gain the fields; `PluginUpdateFailedOutcome`
  already has optional `fromVersion`/`toVersion`.
- **D-12:** One rule for every update and reinstall row: when the producer
  knows both the from and the to revision and they differ (version or
  commit), the row shows the arrow; when they are the same revision, or only
  one side is known, it shows the single version it knows. Applied:
  - `reinstalled`: arrow when the revision moved, else today's single
    `v1.0.0` (REI-01 rows stay byte-identical). This supersedes D-18-08's "no
    from/to arrow" and closes Phase 18's deferred idea, on the strength of
    this phase's goal text.
  - update's `partially-installed` (`update-row.ts`, today `version:
    toVersion` only): arrow `from → to`.
  - `failed` (update and reinstall): arrow when the failure came after the
    candidate was derived (swap phase 3, intent mark, finalize); the
    installed version alone when it came before (preflight, transport, D-16);
    no version when there is no record (D-14).
- **D-13:** Messages: `PluginReinstalledMessage`,
  `PluginPartiallyInstalledMessage`, and `PluginFailedMessage` gain an
  optional `from` (and the D-05 commits). `version` keeps its meaning (the
  version installed or attempted; the installed one on a pre-candidate
  failure, as the `skipped` rows already do via `projectSkippedOutcome`). The
  grammar draws the arrow for these statuses when `from` is present. JSON
  adds `from` (and `fromCommit`/`toCommit`) beside `version`; nothing is
  renamed (additive, `schemaVersion` 1). `updated` keeps its `from`/`to`.

### Not installed (UPR-04)

- **D-14:** `reinstall` and `update` of a plugin with no install record
  report `failed {not installed}` at `error` severity, as `uninstall` does
  (`uninstall.ts::emitAlreadyGone`, `absentTargetReasons`) and as upstream
  does (D-02). Sites, changed together:
  - reinstall's pre-runner skip, `reinstall-flow.ts:371-375`, returns a
    `failed` outcome; `reinstall.messaging.ts:332`'s severity flip for a
    `skipped {not installed}` row goes away with it;
  - update's `triageUpdateMembership`, `update-preflight.ts:598-620`: a
    missing record is `failed {not installed}` whether or not the manifest
    still lists the plugin. Upstream checks the record first (D-02), so the
    `not installed + absent from manifest` arm stops reading
    `failed {not in manifest}`;
  - the cross-scope form in `orchestrators/plugin/shared.ts::emitMarketplaceNotAddedSignal`
    (`{not installed, marketplace in <scope> scope}`) becomes a `failed` row
    for both verbs, matching uninstall's cross-scope row. It then needs a
    `CommandContext<"failed">` policy; both verbs' render maps already have
    a `failed` arm.
- **D-15:** Orchestrated callers keep their silence. Backfill
  (`reconcile/backfill.ts:433-466`) calls reinstall with `render: "none"`; a
  record removed under it is a concurrent uninstall, the WR-06 converge
  uninstall already treats as silent. Its `failed` arm must treat a
  `not installed` outcome as that benign converge (no row, gate may close),
  not as a `plugin-install-failed` row.

### Missing path source and failed clones (folded in, IN-05)

- **D-16:** The fix lives in one place, the shared preflight's candidate
  resolution `update-preflight.ts::resolveUpdateCandidate`'s catch
  (~476-521), so it fixes both verbs (`18-VERIFICATION.md` seams).
  - A `PluginShapeError` `no-longer-installable` whose resolver notes narrow
    to `source missing` (the phase-20 `SOURCE_DIR_MISSING_NOTE` arm, through
    the shared `shared/probe-classifiers.ts` narrowing, also covering a git
    tree whose plugin root is missing) becomes `failed {source missing}`,
    the reason `install`, `list`, and `info` already show (SRC-01, phase 20
    D-06). Upstream fails a missing local plugin directory (phase 20 D-01).
  - A throw from the clone seam is classified with install's ladder,
    `shared/git-failure-classifiers.ts::classifyGitHostFailure` (network
    unreachable, authentication required, source missing for 404/410 and a
    missing pin, network error for other HTTP statuses), instead of the
    narrower `classifyGitTransportFailure`. The row is `failed` with that
    reason and the thrown error as its cause chain, as install's runtime
    failure row composes it (`install.messaging.ts::runtimeFailureReasons` /
    `keepsRuntimeCause`: the auth row stays bare). Upstream's update outcome
    for a source it cannot fetch is `failed`, not a skip.
  - A throw that no ladder classifies keeps install's branch-4 shape: a
    `failed` row with no reason token and its cause chain, not
    `{no longer installable}` (the source has not stopped being
    installable). Reinstall's messaging must not substitute `{unreadable}`
    for the empty reason list when a cause is present, so both verbs render
    the same row.
  - A genuine resolver `no-longer-installable` (unsupported source, partial
    without `--partial`) keeps today's `skipped` rows.
- **D-17:** The `skipped {network unreachable}` / `{authentication
  required}` arm of the same catch becomes `failed` under D-16 too, for
  every caller of the shared preflight: the manual update cascade, the
  autoupdate cascade, reinstall, and backfill. Backfill's existing `failed`
  arm then emits a `plugin-install-failed` row and keeps the version gate
  open, so an offline load retries; that is the truthful outcome and is
  accepted (a warm mirror needs no network under reinstall's policy).
- **D-18:** GHB-03's rethrow of an invalid GitHub base override stays first
  in the catch (D-18-16).

### List upgradable (folded in)

- **D-19:** `list-installed-row.ts::composeInstalledListRow` (~96) stops
  comparing `manifestEntry.version` with `record.version`. It derives the
  candidate version by the one version rule the candidate rows already use
  (`list-candidate-row.ts`: `resolveDeclaredPluginVersion` for a path
  source; plugin.json, then the entry, then `shaVersion(resolvedSha)` for a
  warm git tree through the offline `makePresenceProbe`), and the row is
  upgradable when that version differs from the record's (VER-01/VER-02,
  phases 16 and 20). Extract or export the shared derivation rather than
  copy it (fallow dupes). A cold git tree (no mirror) or an unreadable root
  falls back to the entry version, today's behavior. Network-free (NFR-5).

### Range form (folded in)

- **D-20:** `update-constraint-gate.ts::describeConstraint` prints the
  holders' declared ranges joined with `, `, unquoted, bounded by
  `renderConstraintRange` (the `renderDeclaredRanges` shape in
  `install-cascade.ts:544`), instead of the folded intersection, on every arm
  that names a range (`disjoint`, `invalid`, `too-complex`,
  `out-of-range` at ~530, `already-resolved`, `range-only`). This matches
  upstream (D-01, D-03) and INR-05. `out-of-range` names only the rejecting
  holders' ranges. The `transport` arm keeps its classification detail.
- **D-21:** `orchestrators/reconcile/dependency-verdict.ts::unsatisfiedRange`
  (~204; the brief named `domain/`, the file is under `reconcile/`) prints
  the declared ranges joined with `, ` in both the unfoldable arm (today
  `ranges.join(" ")`) and the unsatisfied arm (today `folded.range`). The
  unconstrained short-circuit and the satisfies test still use the fold.
  Reuse one join-and-bound helper with D-20 rather than a third copy.

### Constraint cause line (folded in, WR-07)

- **D-22:** `updated` and `reinstalled` rows carry the constraint gate's
  disclosure (`constraint.disclosure`) as their cause line whenever the
  outcome has one, as the `unchanged` and held `skipped` rows already do
  through `update-row.ts::constraintCauseFor`. Upstream discloses the range
  on its `updated` message (D-01). `PluginUpdatedMessage` and
  `PluginReinstalledMessage` gain the optional `cause`; `constraintCauseFor`
  widens to the `updated` partition and reinstall reads the same carrier, so
  the two verbs cannot word it differently. The row's severity does not move
  (the `{dependency current copy}` token keeps its role).

### Phase 26 boundary

- **D-23:** Phase 26 runs in parallel and owns
  `orchestrators/plugin/clone-cache.ts`, `fetch.ts`, `info.ts` (`--fetch`),
  `update-preflight.ts::makeUpdateCloneProbe`/`probeUnpinned`, and
  `install-clone-probe.ts`. Phase 25 does not restructure, move, or edit any
  of them. Its `update-preflight.ts` edits stay in `resolveUpdateCandidate`'s
  catch and `triageUpdateMembership`. IN-05's reason mapping lives in that
  catch and in `shared/git-failure-classifiers.ts`'s existing exports, never
  in `clone-cache.ts`. `list-installed-row.ts` only calls
  `makePresenceProbe` as it does today.

### Scenarios and tests

- **D-24:** Cucumber (scenarios read the JSON wire; a column the table
  leaves out fails the comparison, so a new field must be stated):
  - UPR-02: `git-source-update.feature` "Updating a git-source plugin to a
    new commit with the same declared version updates it" gains
    `from commit` / `to commit` columns. A new scenario in the same file:
    after the repository moves to a new commit at the same version and the
    user runs `fetch`, `reinstall` reports `reinstalled` from 1.0.0 to 1.0.0
    with both commits. If the run tokens cannot name a full commit, add a
    commit token beside `{ghp revision N}` in `features/lib/run-tokens.ts`.
  - UPR-03: `update.feature` "Updating with --partial ... installs the parts
    Pi supports" states `from 1.0.0` / `version 1.1.0`;
    `update-rollback.feature` "An update that fails in its mcp phase" states
    the from/to versions on its failed row; `reinstall.feature` "Reinstalling
    a plugin the marketplace now offers at a newer version" states
    `from 1.0.0`; the REI-01 same-version reinstall scenarios keep their
    single `version` (proves D-12's same-revision arm).
  - UPR-04: `reinstall.feature:209` flips to `failed`; `update.feature` gains
    "Updating a plugin that is not installed fails as not installed and
    changes nothing", modeled on `uninstall.feature:47`.
  - `{source missing}`: `update.feature` and `reinstall.feature` each gain a
    scenario: after install, the marketplace republishes the entry with a
    `source` naming a missing directory (`the marketplace {string} publishes
    this manifest:`, as phase 20 D-09), the user runs `marketplace update`,
    and the verb fails `{source missing}` and keeps the record.
  - IN-05: `git-source-update.feature` gains an outline on update over the
    three refusals `git-source.feature:135-137` already uses (404 ->
    `source missing`, dropped -> `network unreachable`, 503 ->
    `network error`) with their cause chains. Reinstall reads a warm mirror
    offline, and no step empties the clone cache, so reinstall's arm is
    proven by a unit test in `reinstall-flow.test.ts` on the shared preflight.
  - List: `list.feature` gains "The list shows an installed path-source
    plugin whose plugin.json version matches the record as installed, not
    upgradable", with the entry declaring a different version.
  - Range form and cause lines: the existing held/ceiling scenarios in
    `update.feature:282-341` gain or update their `cause chain` cells to the
    declared-range form; one admitted-constraint scenario states the cause
    line on the `updated` row, and one on a `reinstalled` row.
- **D-25:** Unit tests: every touched source-test pair keeps 100% direct
  coverage. The grammar gets byte tests for the commit arrow, the
  single-side and no-commit fallbacks, and each new arrow status. The
  catalog states that change (`reinstall-*`, `update-not-installed-*`,
  `reinstall-runner-skips`, the failed and partially-installed update
  states) are updated in `docs/output-catalog.md` and
  `test/architecture/catalog-uat/fixtures/`, and new states are added for
  the commit arrow, `{source missing}`, and the host-failure rows.

### Claude's Discretion

- The outcome and message field names (`fromCommit`/`toCommit` or similar)
  and whether the commit pair travels as one optional sub-object (the
  `partialDegrade` precedent).
- The helper that D-20 and D-21 share and where it lives (it must not add a
  marketplace-to-plugin-ledger edge, BLOCK C).
- Scenario titles and step wording within `.agents/skills/cucumber/rules/`.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` -- "### Phase 25" (goal, user decision, success criteria, files)
- `.planning/REQUIREMENTS.md` -- UPR-02, UPR-03, UPR-04; VER-01, VER-02, SRC-01 (folded items)
- `.planning/phases/18-update-and-reinstall-unification/18-CONTEXT.md` -- D-04, D-08 (superseded in part by D-12), D-11, D-16, D-17
- `.planning/phases/18-update-and-reinstall-unification/18-VERIFICATION.md` -- "Seams for phases 25 and 26"
- `.planning/phases/18-update-and-reinstall-unification/18-REVIEW-FIX.md` -- IN-05 (skipped, deferred here), WR-07 (deferred cause line)
- `.planning/phases/18-update-and-reinstall-unification/18-REVIEW.md` -- IN-05
- `.planning/phases/20-path-source-version-and-missing-source/20-CONTEXT.md` -- D-01, D-02, D-06, D-09
- `.planning/phases/27-install-and-reconcile-reason-residue/27-CONTEXT.md` -- D-01, D-02 (range form)
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts` -- `resolveUpdateCandidate`, `triageUpdateMembership`
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts` -- the `updated` outcome literal
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts`, `update-cascade.ts`, `reinstall-record.ts`, `reinstall-flow.ts`, `reinstall.messaging.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` -- `emitAlreadyGone` (the `failed {not installed}` model)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` -- `runtimeFailureReasons`, `keepsRuntimeCause`, `classifyResolverReason`
- `extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts` -- `classifyGitHostFailure`
- `extensions/pi-claude-marketplace/shared/notification-grammar.ts` -- `renderVersion`, `composeVersionArrow`, `PLUGIN_ROW_LAYOUT`
- `extensions/pi-claude-marketplace/shared/notification-json.ts` -- `wireVersion`
- `docs/json-output.md` (additive-field policy), `schema/claude-plugin.schema.json`, `docs/output-catalog.md`
- `.agents/skills/cucumber/rules/` -- layout, features, steps
- Claude Code 2.1.309 binary -- update message templates, `not_installed` failure codes (D-01..D-03)

</canonical_refs>

<deferred>
## Deferred Ideas

- `list` marking a git plugin upgradable when the mirror's HEAD moved at the
  same declared version (sha-aware upgradable). D-19 compares versions only,
  as the folded item asked.
- `info`'s installed row showing an available upgrade by the same rule.
- WR-06 (a delisted record blocks every update and reinstall in its scope):
  still awaits a user decision.
- Physical rollback of a failed commit for both verbs (Phase 18 deferred).
- Showing the short commit with the house `#` form (`v1.0.0#abc1234`)
  instead of the user's parenthesized form; see the note below.

</deferred>

<notes>
## Notes for the user

- The user's form `1.0.0 (abc1234) → 1.0.0 (def5678)` puts parentheses
  around the commit, and the row grammar otherwise uses parentheses only for
  the status token, so a row reads
  `● ghp v1.0.0 (abc1234) → v1.0.0 (def5678) (updated)`. The renderer's
  existing short-commit form for `sha-` versions is `v#abc1234`. D-05 follows
  the user's decision as written, with the house `v` prefix.
- D-14 changes `update` of a never-installed plugin that the manifest no
  longer lists from `failed {not in manifest}` to `failed {not installed}`,
  on upstream's record-first order.
- D-16/D-17 turn update's `skipped {network unreachable}` /
  `{authentication required}` rows into `failed` rows on both cascades and
  in backfill.

</notes>
