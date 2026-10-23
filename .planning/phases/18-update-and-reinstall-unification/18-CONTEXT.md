# Phase 18: Update and Reinstall Unification - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous smart discuss; the run is autonomous and non-interactive, so every recommended answer below was taken without a prompt.

<domain>
## Phase Boundary

After a marketplace update, `update` and `reinstall` behave as one operation
that installs the latest version the scope knows about and reports it
truthfully. Requirements: REI-04, UPR-01. The user's 2026-10-23 decision in
ROADMAP "### Phase 18" is binding: no per-plugin version pinning; `reinstall`
installs whatever version the marketplace currently offers (the same or
newer) and records and reports it (supersedes D-68-02); unify the `update`
and `reinstall` paths as much as possible.

Today the two verbs have two materialization paths:

- `update` (`update-flow.ts` -> `update-preflight.ts::preparePluginUpdate`
  -> `update-swap.ts::swapPluginUpdate`) resolves the marketplace's current
  entry (refreshing a git plugin's mirror), runs the dependency-constraint
  gate, derives the version by the one version rule, and swaps the plugin in
  three phases (prepare, intent-mark, commit + finalize).
- `reinstall` (`reinstall-flow.ts` -> `reinstall-clone-probe.ts`,
  `reinstall-replace.ts`, `reinstall-record.ts`) resolves the marketplace's
  current entry too, but re-pins a git source to the recorded sha and writes
  the OLD recorded version. Phase 8 found the result: after the marketplace
  moves `demo` to 1.1.0, `reinstall` stages 1.1.0 files and records 1.0.0.

Phase 16's deferred IN-01 is also this phase's: an `update` that finds no new
commit leaves a record made before Phase 16 (its `resolvedSource` is the
mutable mirror) on the mirror.

Files this phase owns: `orchestrators/plugin/update-flow.ts`,
`update-preflight.ts`, `update-swap.ts`, the `reinstall-*` family
(`reinstall-flow.ts`, `reinstall-record.ts`, `reinstall-replace.ts`,
`reinstall-clone-probe.ts`, `reinstall-targets.ts`, `reinstall.messaging.ts`),
a new shared leaf module, `orchestrators/reconcile/backfill.ts` (comments and
the reinstall outcome it reads only), `operations.ts` and `edge/register.ts`
(wiring only), `orchestrators/types.ts` (reinstall outcome shape), their unit
tests, the architecture gates that name these files, and
`features/plugin/reinstall.feature`, `features/plugin/update.feature`.

</domain>

<decisions>
## Implementation Decisions

### Upstream evidence (Claude Code 2.1.309 binary)
- **D-01:** Claude Code's `/plugin` has no `reinstall` verb. Its own recovery
  text is "uninstall and reinstall it to accept new content", and an install
  always takes the catalog's current version, so an upstream reinstall lands
  the latest version. Its `update` reports `is already at the latest version
  (<v>)` only when the version (and, for git, the commit sha) did not move
  (`gitCommitSha` compare, `up_to_date` outcome). The user's decision matches
  upstream; no divergence is introduced.

### One materialization path (UPR-01)
- **D-02:** The shared path is update's: candidate resolution
  (`preparePluginUpdate`) followed by the three-phase swap
  (`swapPluginUpdate`). It already does everything a reinstall needs:
  current-entry resolution, per-commit git copies, the version rule, the
  constraint gate, the partial gate, hooks re-routing, clone cleanup, and
  completion-cache refresh. Reinstall's own replacement machinery
  (`reinstall-replace.ts`'s prepare/replace/rollback/finalize, the
  `recordReinstalledOutcome` record writer, and `reinstall-clone-probe.ts`)
  is deleted, with its unit tests. Rationale: update's path is the larger and
  stricter of the two, keeping it leaves the update tests (the larger suite)
  and the autoupdate cascade untouched, and reinstall reduces to target
  selection and messaging, which is what UPR-01 asks for.
- **D-03:** The preflight + swap composition that `update-flow.ts` holds
  privately today (`runPluginUpdate`, minus the layer refusal) moves into a
  new leaf module under `orchestrators/plugin/` that both `update-flow.ts`
  and `reinstall-flow.ts` import. Both flows are plugin ledgers (BLOCK C
  `PLUGIN_LEDGERS`), so neither may import the other; the leaf is not a
  ledger, joins no `NETWORK_SEAMS` entry (it names no git surface), and is
  absent from the ledger lists.
- **D-04:** The shared runner takes a per-verb policy with exactly three
  knobs (the third is D-15's), and those knobs are the only behavioral
  difference inside it:
  - **source refresh:** `update` refreshes a git plugin's mirror before it
    reads its HEAD (today's behavior, network). `reinstall` reads the
    mirror's current HEAD offline and copies that commit; only a missing
    mirror (a cache miss) clones, which NFR-5 allows. A source pinned to a
    `sha` in the marketplace entry needs no network either way.
  - **same revision:** `update` returns `unchanged` when the candidate is the
    revision the record holds (D-09 of Phase 16, extended by D-08 below).
    `reinstall` always re-materializes, which is how it restores deleted
    artifacts (REI-01/REI-02).
- **D-05:** Per-verb code outside the shared runner is target selection and
  messaging only:
  - `update`: marketplace clone sync (`makeSyncCloneOnce`), target
    enumeration, the named-layer refusal, the disabled-record pin refresh
    (it lives in the preflight and is reached only by update, since reinstall
    skips a disabled record first), and the `updated`/`unchanged` rows.
  - `reinstall`: target selection (`reinstall-targets.ts`, unchanged), the
    named-layer refusal, the `not installed` and `already disabled` skips
    before the runner (ENBL-05 unchanged), the post-success plugin-data
    directory removal and completion-cache drop it already runs
    (`runPostSuccessMaintenance`, kept as reinstall's own step), and the
    `reinstalled` row.
- **D-06:** `reinstall` runs the shared runner with `partial` admitted, as it
  is partial-capable today (BFILL-01): a still-partial plugin re-materializes
  in place. A reinstall that would newly degrade a clean record is admitted
  too, as today; backfill keeps its own WCONV-01 refusal.
- **D-07:** `reinstall` runs the same dependency-constraint gate as `update`.
  A held verdict skips the reinstall with `dependents constrain`; an
  admitting pin installs the tag the range selects. The gate's tag listing is
  the network use D-03-03 already allows for `reinstall`.

### Reinstall version (REI-04)
- **D-08:** `reinstall` records and reports the version the shared runner
  derived (`toVersion`), the commit it materialized (`resolvedSha`, absent for
  a path source with no pin), and the copy it used (`resolvedSource`). A
  reinstall of an up-to-date plugin derives the recorded version, so REI-01's
  row still reads `1.0.0`. The `reinstalled` row keeps its single version
  column and shows the new version; no from/to arrow is added.
- **D-09:** `provenance` and `installedAt` carry forward from the old record
  on every path that rewrites it (D-04-01). The shared swap already preserves
  them (it mutates the existing record); a test pins that for the reinstall
  verb.
- **D-10:** Failure semantics for `reinstall` become update's: a prepare
  failure aborts the staged handles and changes nothing; an intent-mark
  failure (a held state lock, ST-9) aborts likewise; a commit or finalize
  failure is a `rollback partial` failure whose recovery hint is to run
  `reinstall` again. Reinstall no longer holds one lock across the whole
  operation; it uses update's intent-mark and finalize guards. The lock-held
  row keeps `lock held` and its cause chain (FLR-01, state-lock.feature).

### Records made before Phase 16 (IN-01)
- **D-11:** A candidate is the same revision only when the version, the sha,
  AND the plugin root (`resolvedSource`) equal the record's. A pre-Phase-16
  unpinned git record names the mirror as `resolvedSource` while the
  candidate is the per-commit copy, so `update` treats it as a new revision,
  swaps it onto the copy, and reports `updated` with equal from and to
  versions (the D-09 precedent). `reinstall` moves it by D-04's always
  re-materialize. A unit test pins each verb.

### Reconcile backfill
- **D-12:** Backfill keeps calling the reinstall operation (`render: "none"`).
  It now records the version the re-materialize derived instead of the old
  one. Its comments that cite D-68-02 are rewritten to cite this decision.
  Backfill triggers only when a plugin's supported set grew; on that path the
  constraint gate and a cold mirror may reach the network, which the
  reconcile network seam already admits.

### Gaps the plan check found (recorded before execution)
- **D-15:** RINST-01 (force-install milestone, shipped) stays: `reinstall`
  always overwrites collisions and foreign content as a repair primitive.
  The policy's third knob, `overwrite`, is `true` for reinstall and `false`
  for update, and the shared swap passes it to the agents commit (the
  `force` option the plan adds to `commitPreparedAgents`, as the old
  replace path took). RINST-01 as shipped: the workflows commit (WR-06,
  occupied target, possibly a user's hand-saved workflow) and the MCP commit
  (ANAME-03, colliding keys) refused for reinstall before and still refuse;
  skills and commands already replace stray content. Update keeps its
  refusal. A
  shipped requirement is superseded only by a user decision, and the
  2026-10-23 decision does not mention RINST-01.
- **D-16:** An invalid GitHub base override fails a GitHub-source `reinstall`
  even with a warm cache, as it already fails `update` (GHB-03). It is a
  misconfiguration the user must fix, the failure is loud and changes
  nothing, and keeping a warm-cache exemption would be per-verb code inside
  the shared path.
- **D-17:** A dependency walk that cannot read a recorded plugin's
  declarations fails closed (the house rule: refuse on corrupt data) for
  both verbs, and the row names the true cause: `unreadable`, never
  `dependents constrain`. The constraint gate's hold reason is reserved for
  a real range hold (D-07).
- **D-18:** D-06's second clause gets a unit test: a clean record whose
  source lost a supported kind is reinstalled as partial and recorded
  `installable: false`.

### Scenarios
- **D-13:** `reinstall.feature` gains the REI-04 scenarios: after the
  marketplace offers `demo` 1.1.0 and the user ran `marketplace update`,
  `reinstall demo@fixtures` reports `reinstalled` at 1.1.0, and the record,
  `list`, `info`, and a new session all show 1.1.0. One scenario pins the
  equivalence: after the same marketplace update, `update` reports
  `updated 1.0.0 -> 1.1.0` and records the same version `reinstall` would.
  The existing REI-01/02/03 scenarios stay unchanged and green.
- **D-14:** A git-source reinstall scenario (in `git-source-update.feature`
  or `reinstall.feature`, whichever stream owns git reinstall steps): after
  `fetch` brings revision 2 into the mirror, `reinstall` installs revision 2
  from the mirror's current HEAD with no network request, and the record
  names revision 2. If the fetch/request-log steps cannot express "no
  request", assert the record and the installed revision only.

### Claude's Discretion
- The shared module's name, the policy object's shape, and how reinstall's
  outcome mapping reads the old record's inventory for `resourcesChanged`
  and `staleWorkflowCommand`.
- How much of `reinstall-flow.test.ts` is rewritten versus deleted: tests of
  the deleted replacement machinery go; tests of target selection, skips,
  layer refusal, messaging, maintenance, and failure rows stay, rebased onto
  the new seam. Every remaining source-test pair keeps 100% direct coverage.
- Scenario titles and step wording within `.agents/skills/cucumber/rules/`.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` -- "### Phase 18" (goal, decision, success criteria, files)
- `.planning/REQUIREMENTS.md` -- REI-01..04, UPD-01..05, UPR-01
- `.planning/phases/08-plugin-reinstall/08-CONTEXT.md` -- D-06 (the 1.0.0-record / 1.1.0-files finding)
- `.planning/phases/16-git-plugin-copies-and-version-rule/16-CONTEXT.md` -- D-05, D-08, D-09; `16-VERIFICATION.md` "For the user" (IN-01)
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts`, `update-preflight.ts`, `update-swap.ts`, `reinstall-flow.ts`
- `eslint.config.js` BLOCK C (`PLUGIN_LEDGERS`) and BLOCK F (`NETWORK_SEAMS`)
- `.agents/skills/cucumber/rules/layout.md` -- stream file ownership

</canonical_refs>

<deferred>
## Deferred Ideas

- Physical rollback of a failed commit (reinstall's old behavior) for both
  verbs; update's swap reports `rollback partial` instead.
- A from/to arrow on a `reinstalled` row whose version moved.

</deferred>
