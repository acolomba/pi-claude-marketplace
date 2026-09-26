---
phase: 03-dependency-resolution
fixed_at: 2026-09-15T14:32:55Z
review_path: .planning/phases/03-dependency-resolution/03-REVIEW.md
iteration: 1
findings_in_scope: 13
fixed: 13
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-09-15T14:32:55Z
**Source review:** `.planning/phases/03-dependency-resolution/03-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 13 (5 blocker, 8 warning; `fix_scope: critical_warning`, so the 3 Info findings were left alone)
- Fixed: 13
- Skipped: 0

Every finding was reproduced before it was fixed. Each source fix carries a test
that was run against the unfixed code and observed to fail; the per-finding
entries below name that test. `npm run check` is green end to end after the last
commit — typecheck, lint, `fallow` (dead-code ✓, health 0 above threshold, dupes
at the known pre-existing 1,035 lines), prettier, the corresponding-test gates,
6,363 unit tests and 32 integration tests.

## Fixed Issues

### CR-01: Cascade dependencies are never declared on the orchestrated path

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts`, `tests/orchestrators/plugin/install-flow.test.ts`
**Commit:** `52e2ac90`
**Applied fix:** Extracted `writeOrchestratedDeclarations`, which writes the
cascade-created dependency keys and the DFEN-04 disabled stamp through one
batched patch on `targetConfigPath`. WR-09 is not widened: the arm writes only
the keys this install itself created, never the full write-back.

**Deviation from the review's suggestion.** The review's snippet routed the
disabled stamp through `writeBatchedConfigEntries` too. Doing that regressed
`tests/orchestrators/reconcile/apply.test.ts` — the batched writer always emits
a `marketplaces` key, so the stamp-only case gained `"marketplaces": {}` in a
file that declares none. The stamp keeps `writePluginConfigEntry` (SPLIT-02 /
D-102-09's sanctioned single-entry writer) and the batched writer is used only
when several keys must land in one atomic save.

**Red-then-green test:** `RESV-01 / WR-09: an orchestrated install declares its
cascade dependencies, so the next reload keeps them` — runs `applyReconcile`,
asserts the dependency is declared, asserts `planReconcile` plans no uninstall,
then runs a second `applyReconcile` pass. Fails against the unfixed flow.

### CR-02: A project-scope install from a user-scope marketplace fails once the plugin declares a dependency

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts`, `.../install-flow.ts`, `.../install-cascade.ts`, `tests/orchestrators/plugin/shared.test.ts`, `tests/orchestrators/plugin/install-cascade.test.ts`, `tests/orchestrators/plugin/install-flow.test.ts`
**Commit:** `e155339d` (follow-up `52f6d29c`)
**Applied fix:** New `collectInstallReachableMarketplaces` returns the CMP-3-aware
set — the target scope's records plus, for a project-scope install, the user
scope's — and seeds `knownMarketplaces` from it.

**Deviation from the review's suggestion.** The review proposed adding only the
ROOT's marketplace to the raw key set. That fixes the reported scenario but
leaves a dependency naming a *different* user-scope marketplace failing for the
same wrong reason. Computing the whole reachable set is the same cost (one
`loadState`, which the per-marketplace resolver already pays on its fallback
arm) and closes the class. The D-03-08 trust rule is unchanged: every name in
that set is one the user added themselves.

The second half the review flagged — `resolveMemberTagSource` reading
`state.marketplaces` directly — is fixed by an injected `CascadeMarketplaceLookup`
that install-flow backs with `resolveInstallMarketplaceSource`, so the walk and
the pin probe cannot disagree about which source backs a member.

**Red-then-green tests:** `CMP-3 / D-03-08: a project install off a user-scope
marketplace resolves a same-marketplace dependency` (install-flow, fails with
`status: "failed"` unfixed) and `CMP-3 a constrained member whose marketplace the
snapshot does not record resolves through the caller's lookup` (cascade).
`collectInstallReachableMarketplaces` has two direct unit tests including the
CMP-4 negative (a user-target install must not see a project-only marketplace).

**Follow-up commit `52f6d29c`:** `fallow dead-code` reported a private-type leak
on the new exported lookup type; the record type is now spelled inline.

### CR-03: A failed cascade rollback is reported as a clean one

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts`, `tests/orchestrators/plugin/install-cascade.test.ts`
**Commit:** `9c5ec287`
**Applied fix:** `buildMemberPhase.undo` reads `cascadeUnstagePlugin`'s outcome,
folds what did drop through `applyPartialCascadeFold`, and throws — a throw
being the ledger's only partial-rollback channel. The record is deliberately
NOT deleted on that path: it is what still owns the artifacts on disk.

The review's critique of the existing test was correct and is the standard the
new ones meet. `Promise.reject` is a failure mode `cascadeUnstagePlugin` is
structurally incapable of producing (its whole body is a try/catch returning
`{ok: false, dropped, cause}`), so the double now returns that shape.

**Red-then-green tests:** the rewritten `RESV-06 an undo that itself fails
surfaces a rollback partial without throwing`, plus a new `RESV-06 an unstage
that dropped part of its inventory keeps the record honest` pinning the fold.
Both fail against the unfixed cascade.

### CR-04: A tag-pinned dependency is recorded under a sha version

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts`, `.../install-flow.ts`, `tests/orchestrators/plugin/install-cascade.test.ts`, `tests/orchestrators/plugin/install-flow.test.ts`, `docs/dependency-resolution.md`
**Commit:** `d623647f` (fixes WR-07 in the same change — see below)
**Applied fix:** `ResolvedCascadeMember` carries `pinnedVersion`, threaded onto
`core.pinVersion` and mapped to `pinVersionOverride`, which already outranks the
git-source `sha-<12hex>` branch.

**One correction to the review's framing.** The review says "the second run of
the *same* command fails". A literal re-run stops earlier, at the PI-5
already-installed guard, before any constraint check. The defect is real and
broader than that: once a dependency is installed under a tag pin, *any* later
install that constrains it fails, because `recordedVersionSatisfies` reads the
recorded `sha-<12hex>`. For this repository's own fixture sha that coerces to
`1.0.0`, which does not satisfy `^9.0.0` — measured, not assumed.

**Red-then-green test:** the existing `RESV-03: a constrained dependency is
materialized at the tag the probe selected` was itself pinning the defect as
contract (it asserted `sha-<12hex>`). It is rewritten to assert `9.9.9` and
extended with a SECOND dependent declaring the same range, whose install must
succeed with the dependency skipped. Fails against the unfixed flow.

### CR-05: A declared `sha` pin is silently dropped by the entire cascade

**Files modified:** `extensions/pi-claude-marketplace/domain/dependency-closure.ts`, `tests/domain/dependency-closure.test.ts`, `docs/dependency-resolution.md`
**Commit:** `5609f09c`
**Applied fix:** `buildChildEdge` refuses an element carrying `sha` with
`unusable-declaration` / `dependencies.N: sha pinning is not supported`, minted
as **D-03-36**. Documented in `docs/dependency-resolution.md`.

**Chosen among the two options the review offered**, on the project's own stated
principle (`domain/dependencies.ts`, and the doc line the review quotes): a
constraint that disappears quietly is worse than a declaration that is refused.
Supporting `sha` instead would need a diamond-conflict rule for two different
shas on one dependency and a `version` + `sha` precedence rule, neither of which
RESV-03 states.

**Human verification wanted.** This is the one finding whose fix is a *policy*
choice rather than a correctness repair. It turns a previously-installable
plugin into a hard failure when any plugin in its dependency graph declares a
`sha`. If the intended policy is to honor the pin instead, the refusal is the
wrong half of the fork.

**Red-then-green tests:** `D-03-36 a declared sha is refused rather than
resolved as no constraint` (also asserts the refused edge is never walked) and
`D-03-36 a sha declared beside a version is refused on the sha`.

### WR-01: A disabled dependency counts as "already installed" and is skipped at info severity

**Files modified:** `extensions/pi-claude-marketplace/shared/notification-types.ts`, `.../shared/notify-reasons.ts`, `.../orchestrators/plugin/install-cascade.ts`, `.../install-cascade.messaging.ts`, `docs/output-catalog.md`, `docs/dependency-resolution.md`, plus 6 test files
**Commit:** `c9695872`
**Applied fix:** Took the review's second option — keep the skip, raise the row,
add an actionable reason. `CascadeSkippedMember` carries `disabled`, and the row
joins a new closed-set member `dependency disabled` to `already installed`.
Severity comes from `skipSeverity(reasons)` rather than a producer-asserted
literal, so the benign idempotent skip stays `info` and this one computes
`warning` from the tokens themselves. (That also satisfies IN-02's convention
point as a side effect, though IN-02 itself was out of scope.)

Keeping the skip rather than failing the cascade is deliberate: enablement is
never decided on a dependency's behalf, so the row is the whole remedy.

**Closed-set amendment, 52 → 53**, done the way invariant 4 requires: appended at
the tail with an inline justification, added to the `compat-01` enumeration by
equality (never loosened to a subset), the length lock bumped, a byte-form entry
added to `docs/output-catalog.md` with its catalog fixture, and the catalog
count and byte locks moved with it.

**Human verification wanted.** A new user-visible token and a row that now
raises its block to `warning` is a messaging-policy change, not just a bug fix.

**Red-then-green tests:** `RESV-05 a skipped dependency reports whether the
record it rests on is disabled` (cascade, with an enabled sibling as the control
so a projection reporting every skip as disabled also fails) and `RESV-05 a
skipped member whose record is disabled names it and raises the block`
(messaging, byte-equality). Both fail against the unfixed code.

### WR-02: A cascade-installed dependency's hooks never reach the routing table

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts`, `.../install-cascade.ts`, `tests/orchestrators/plugin/install-flow.test.ts`
**Commit:** `3a4311ac`
**Applied fix:** Exactly as the review described. `CascadeMemberOutcome` now
carries `pluginRoot` and `hooksConfigPath`; a new `hydrateInstalledHooks` reads
and caches per member and rebuilds the routing table once at the end. The row
composer reads a structural subset declaring neither field, so no row can
interpolate the path.

The DFEN-04 skip narrowed from the whole block to the one member it can apply
to — a dependency is never install-disabled, so only the requesting plugin's own
landed-disabled verdict suppresses a hydrate.

**Red-then-green test:** `RESV-01 / WR-03: a cascade-installed dependency's hooks
reach the routing table too` — hooks are on the DEPENDENCY, and the assertion is
against the real `HooksRuntime` routing bucket. Fails against the unfixed flow.

### WR-03: A path-source dependency can never satisfy a constraint

**Files modified:** `docs/dependency-resolution.md`
**Commit:** `935f749c`
**Applied fix:** Documented, which is the review's first option. The second
option (reading a path source's own `plugin.json` version instead of reporting a
tag no-match) contradicts D-03-09 as `dependency-tag-probe.ts`'s header states
it — "no branch on how the source parsed, and no fallback to a repository head"
— so changing behavior here is a decision for the phase owner, not a review fix.

The new subsection names the precondition, names the remedy (declare such a
dependency with no version), and explains the asymmetry with the
already-installed check as two different questions rather than an inconsistency.

### WR-04: The documented failure table does not agree with the shipped reason set

**Files modified:** `docs/dependency-resolution.md`, `tests/architecture/dependency-doc-agreement.test.ts` (new)
**Commit:** `de872144`
**Applied fix:** The table is rewritten around the reason the user actually sees
in braces. Row 1 (which no code arm produces) is gone; rows were added for the
three transport tokens, `{invalid manifest}`, `{dependency failed}` — and
`{already installed}`, which the review did not list and which the new gate
caught while I was writing the table.

**Correction to the review's suggested gate.** The review says to register
`docs/dependency-resolution.md` in `VOCABULARY_GUARD_DOC_TARGETS`. That would not
have gated anything: that registry is read only positionally by
`hooks-cap-notify.test.ts` (`const [OUTPUT_CATALOG_REL] = ...`), and the
retired-vocabulary sweep in `partial-vocabulary-guard.test.ts` hardcodes its own
doc list and never imports the registry. Registering there is cosmetic.

So the gate is purpose-built and proves rather than reads: it DRIVES
`composeCascadeFailureMessage` once per failure arm and compares the tokens the
real composer emits against the tokens the table names. The arm fixtures are
proven total at compile time by `Exclude<...> extends never` proofs, so an arm
added to `DependencyClosureResult` or `CascadeConstraintFailure` without a
fixture is a TS2344 build failure rather than a silently narrower sweep.

**Verified by planting**, per the project's own rule that a gate wants a planted
violation: a deleted table row fails the set-equality test, and a duplicated row
fails both the set test and the exactly-once test. Observed, not assumed.

### WR-05: A doc this phase links to now states the opposite of what the phase shipped

**Files modified:** `docs/plugin-enablement.md`
**Commit:** `45bb32c5`
**Applied fix:** Rewrote the divergence section. The three false claims
("nothing here resolves…", "never resolved, never auto-installed", "with no
resolution mechanism") are replaced with what ships: the mechanism exists, the
cascade installs a declared dependency and declares it with a bare entry, and
D-04 reads that as enabled — the state upstream's explicit `true` reaches by
another route. The divergence that survives is narrower and is now stated as a
policy call: a dependency already installed and DISABLED is left alone and
reported at warning, where upstream would flip it on.

**Not done (outside my scope):** the review also asks to "close or re-scope
PDEP-01". PDEP-01 and DFEN-V2-01 live in `.planning/BACKLOG.md`,
`.planning/REQUIREMENTS.md` and the archived `defaults-enabled-*` milestone
documents. Those are planning artifacts owned by the workflow, not source, so I
removed the stale PDEP-01 citation from the shipped document and left the
backlog entry for the phase owner.

### WR-06: `notify-reasons.ts`'s header still describes a 44-entry closed set

**Files modified:** `extensions/pi-claude-marketplace/shared/notify-reasons.ts`
**Commit:** `4caabf81` (later moved 52 → 53 by `c9695872`)
**Applied fix:** Both counts corrected and the running narrative extended with
the `data kept` step and the seven RESV-02..06 members, mirroring the wording in
`notify-closed-set-locks.test.ts`. WR-01's own amendment then moved both to 53
and added its step, so the header, the enumeration, the length lock and the
catalog all moved together.

### WR-07: `ResolvedCascadeMember.pinnedRef` is written and never read

**Files modified:** see CR-04
**Commit:** `d623647f`
**Applied fix:** Removed. Its only reader was a test observing the field.
Committed together with CR-04 because they are one edit to one field set — the
tag name goes and the tag's semver arrives, and splitting them would have left
an intermediate commit carrying both a dead field and a duplicated concept.
Of the review's two options (remove, or put to use), remove was chosen: the
`{pinned <tag>}` diagnostic it suggested would be a closed-set amendment for a
diagnostic nothing has asked for.

### WR-08: Root-scoped install options are copied onto every cascade member

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts`, `tests/orchestrators/plugin/install-flow.test.ts`
**Commit:** `0f2c861f`
**Applied fix:** `pinVersionOverride` is no longer read off `opts` inside
`buildInstallLedgerOptions`; it arrives per-member on `core.pinVersion` and the
caller supplies it only when `member.key === rootKey`.

The two flags that DO apply cascade-wide now say so, which is the second half of
the review's ask. `--map-model` states how the user wants generated agents
written; `--partial` states which resolver gate the user accepts, and applying it
to the named plugin alone could not do the one thing the user asked for, since a
dependency failing the strict gate fails the whole install (D-03-07).

**Red-then-green test:** `RESV-01: the caller's version pin reaches the named
plugin and no dependency` — asserts the root records `7.7.7` and the dependency
records its own `0.0.1`. Fails against the unfixed builder, which stamped
`7.7.7` on both.

## Not in scope

`IN-01` (the tag memo's unreachable failure-delete), `IN-02` (the skipped row's
unstamped severity) and `IN-03` (the per-member marketplace manifest re-read)
were left alone: `fix_scope` is `critical_warning`.

Two of them moved incidentally and are worth naming so a later pass does not
re-file them:

- **IN-02 is now closed** as a side effect of WR-01. The skipped row stamps
  `severity: skipSeverity(reasons)` instead of relying on the renderer default.
- **IN-03's root cause is closed** by CR-02 — `resolveMemberTagSource` reaches the
  record through the caller's resolver rather than `state.marketplaces`. The
  duplication IN-03 actually objects to (two sites answering "which source backs
  this member") remains: the walk's lookup and the pin probe are still two calls.

## Verification

Gates ran in the **main checkout**, not an isolated worktree — this phase's
isolation is `none` and this checkout is itself a linked worktree, so the numbers
below are reproducible from the tree as it stands.

- `npm run check` green end to end at `52f6d29c`: typecheck, lint,
  `lint:workflows` (+negative), `fallow` (dead-code ✓ no issues; health 0 above
  threshold; dupes at the known pre-existing 1,035 lines, exit 0),
  `format:check`, `test:corresponding` (+negative),
  `test:coverage:direct:negative`, 6,363 unit tests, 32 integration tests.
- Every source fix has a test observed FAILING against the unfixed code before
  the fix was committed, by restoring the file from `HEAD` and re-running.
- The new WR-04 gate was additionally verified by planting two violations (a
  removed table row, a duplicated table row) and observing it fire on each.
- `pre-commit run --files <changed>` before every commit, with the whole-repo
  `npm-*` hooks covered once by the final `npm run check`. `SKIP=trufflehog` on
  every commit: TruffleHog cannot read the index from a linked worktree.
- Two hook rewrites (prettier on `install-flow.test.ts`, mdformat on
  `dependency-resolution.md`) were absorbed before their commits, so no
  follow-up repair commit was needed.

---

_Fixed: 2026-09-15T14:32:55Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
