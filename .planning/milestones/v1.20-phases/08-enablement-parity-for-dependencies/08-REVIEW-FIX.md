---
phase: 08-enablement-parity-for-dependencies
fixed_at: 2026-09-22T01:13:00Z
review_path: .planning/phases/08-enablement-parity-for-dependencies/08-REVIEW.md
iteration: 4
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 08: Code Review Fix Report

**Fixed at:** 2026-09-22T01:13:00Z
**Source review:** .planning/phases/08-enablement-parity-for-dependencies/08-REVIEW.md
**Iteration:** 3

**Summary:**

- Findings in scope: 5 (1 critical + 4 warning; `fix_scope: critical+warning`, IN-01..08 out of scope per the orchestrator ruling)
- Fixed: 5
- Skipped: 0

Three commits on `features/manifest` (`e9c12cd4`, `1de413eb`, `ea686608`), made directly in this checkout per the orchestrator's sequential-mode ruling (this checkout is itself a worktree; no nested worktree was created). Every fix commit was staged by explicit path; the pre-existing dirty files (`.claude/settings.json`, `.codex/config.toml`, `.planning/config.json`, `.planning/state.json`, `.mcp.json`, `.planning/milestone.lock`, every `08-REVIEW*.md`) were never staged.

## Iteration 1

`08-REVIEW-FIX.iter1.md`: 12 in-scope findings (5 critical, 7 warning), all fixed across 13 commits (`2fa1bba5..f2378bac`). CR-01 (a re-enabled dependency's stale config entry survives), CR-02 (a `sha`-pinned declaration crashes the enable), CR-03 (a root failure after the cascade commits strands members), CR-04 (the install cascade's re-enable arm was not transitive) and CR-05 (the unwind/undo fault-injection tests proved nothing), plus WR-01..WR-07. The iteration-2 review found CR-01, CR-04 and WR-06 partial and two new Critical defects of the same false-narrowing class.

## Iteration 2

`08-REVIEW-FIX.iter2.md`: 6 in-scope findings (2 critical, 4 warning), all fixed across 10 commits (`a58215bd..3a0bd2c2`). CR-06 (the member config patch found only the target file; fixed by the shared `overwriteDisabledMemberEntries` selecting by declaration), CR-07 (`assertFoldingClosureSucceeded` was false; the fold's `not-found` was remapped onto the real dependent), WR-08 (the config writes became the enable ledger's final phase), WR-09 (docs), WR-10 (comments), WR-11 (the discovery walk stops at live dependencies; never-installed members found through a disabled one install). The iteration-3 review found the WR-11(b) fix regressed in the fold configuration its own test never reached (CR-08), the transitive members bypassing RESV-05 (WR-12), a third round of removed-code narration (WR-13), undocumented behaviour (WR-14) and an orphaned doc block (WR-15).

## Fixed Issues

### CR-08: The fold's closure is not filtered to the disabled set, so a never-installed member below a disabled dependency gets a re-enable phase

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts` (one comment naming a removed symbol), `tests/orchestrators/plugin/install-cascade.test.ts`, `scripts/check-unused-type-members.contracts.json`
**Commit:** `e9c12cd4` (shared with WR-12 and WR-15)
**Applied fix:** Restructured so ONE walk owns the answer, going one step further than the ruling's per-member sub-walks: the outer `resolveDependencyClosure` call now receives `liveInstalledKeys(state, options.installedKeys)` -- the caller's recorded set minus every record the snapshot marks disabled. `walkDependencyEdge` therefore reads through a disabled dependency exactly as it reads through a never-installed one: its declarations are walked, every range declared for it on every branch is merged by the walk's own `recordEdge` (D-03-10), it lands in `closure` in post order with the `requiredBy` of the declaration that first reached it, and the walk's memo de-duplicates a diamond. `resolveMemberConstraints` then partitions that single closure by the snapshot's record (`disabledRecordOf`): recorded-and-disabled becomes a `re-enable` entry carrying the record itself (the partition key, not an assumption -- `assertDisabledRecordExists` is gone, and `buildReEnableMemberPhase` takes the record as a parameter), everything else becomes an `install` entry with its resolved pin; the phase array maps that tagged list in walk order, so a member gets exactly one phase of exactly one kind and nothing runs before what it needs. The root keeps its exemption from the partition exactly as it has from the walk's guards, so a recorded-and-disabled requested plugin still reaches its own ledger's `already-installed` refusal (a new test pins this). Deleted: `partitionAlreadyInstalled`, `recordedDisabled`, `enabledInstalledKeys`, `TRANSITIVE_REENABLE_SYNTHETIC_ROOT_KEY`, `TransitiveReEnableResult`, `classifyReEnableCandidate`, `resolveTransitiveReEnableSet`, `FoldFailure`/`FoldNotFoundFailure`, `assertFoldedNotFoundFromSyntheticChild`, `assertDeclaredBySyntheticRoot`, `assertDisabledRecordExists` (375 lines removed, 153 added; the file is 1171 lines, down from 1393). No synthetic key exists anywhere, so no `requiredBy` can carry one. Every walk failure (`not-found`, `marketplace-not-added`, `cycle`, `unusable-declaration`) below a disabled member is the outer walk's own failure and routes through the existing `closure-failed` arm and `closureFailureFacts` naming the real dependent; the one remaining assertion (`assertReEnableLedgerInstalled`) cites its mechanism (the partition read the record out of `state.marketplaces`, a member's ledger adds a marketplace slot and never removes one, `resolveInstallMarketplaceSource` reads that slot first).

**Deviation from the ruling, stated:** the ruling asked for one sub-walk per disabled member with that member root-exempt from the catalog-absent guard. Under that shape a disabled dependency absent from its own manifest (CR-07's ATTR-08 case) would be tolerated as a root and could not produce the `not-found` the existing CR-07 test asserts and the review accepted as resolved; it also leaves two walks (outer and sub) to reconcile ranges across. The single walk applies the guard to every dependency uniformly -- a disabled dependency absent from its manifest is `not-found` naming its real dependent -- which is what the CR-07 test already pins (unchanged, retitled) and what re-enabling such a record would fail on anyway inside the ledger. Nine existing EDEP-03 fixtures that omitted `bar`'s catalog entry (relying on the disabled member never being looked up) now declare `[bar]: []`, as the reviewer's own reproductions already did.

**Tests added** (`install-cascade.test.ts`, each asserting the whole `{key, reEnabledFromRecord, requiredBy}` list via `memberOrigins`): both CR-08 graphs -- `foo -> bar`, `bar -> {baz, qux}` yields exactly `[baz (re-enabled, by bar), qux (installed, by bar), bar (re-enabled, by foo), foo]`; the diamond `foo -> {bar, qux}`, `bar -> {baz, qux}` yields the same list with `kind: "installed"` and no crash. Both fail against the previous cascade (verified by running them against `HEAD~`'s `install-cascade.ts`: the first sees two `qux` rows, the second sees `member-failed`). Plus the disabled-root case and the `not-found`-below-disabled case listed under WR-12.

### WR-12: Transitively discovered members bypass the RESV-05 recorded-version check, and a never-installed member's ranges come from the first walk that met it

**Files modified:** as CR-08
**Commit:** `e9c12cd4`
**Applied fix:** Falls out of the single walk. `checkRecordedMembers` runs `checkInstalledMember` over the walk's `alreadyInstalled` (enabled hits, now including the enabled members a disabled member declares a range on) AND over every disabled member the walk placed in the closure, before any tag query; a never-installed member's ranges arrive already merged across every declaring branch, so `resolveOneMember`'s intersection sees both of a diamond's declarations. **Tests added:** `foo -> bar`, `bar -> baz@^1.0.0`, both disabled, `baz` recorded `0.0.1` -> `constraint-failed` / `installed-unsatisfied` with `range: ">=1.0.0 <2.0.0-0"` and `recordedVersion: "0.0.1"`, footprint unchanged (mirrors the direct-member control at the `EDEP-03 a constraint conflict on a disabled already-installed member` case); the disabled range diamond `bar -> qux@^1.0.0`, `baz -> qux@^2.0.0` -> `constraint-failed` / `contradictory-declarations` on `qux` (first-sight-wins would have installed it); `foo -> bar` (disabled), `bar -> qux` with no catalog entry -> `closure-failed` `{reason: "not-found", key: qux, requiredBy: bar}`, footprint unchanged. The first two fail against the previous cascade (verified as above).

### WR-13: The iteration-2 fix commits introduced new removed-code narration in source and tests

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`, `scripts/check-unused-type-members.contracts.json` (pins below the shortened comments remapped); the three test-body sites in `tests/orchestrators/plugin/install-cascade.test.ts`
**Commits:** `1de413eb` (source), `e9c12cd4` (tests, rewritten with the restructure)
**Applied fix:** All six sites now state the present fact only, in the finding's own wording where given: `shared.ts` -> "Shared by the enable cascade's EDEP-01 arm and the install cascade's EDEP-03 re-enable arm."; `buildEnableRootPhase` -> "`runEnableCascadeWithRoot` pushes the config phase after this one, so a throw from THAT phase reaches back here through `runPhases`'s reverse-order undo, and the root's own materialized install unwinds exactly like a member's."; `buildEnableCascadeConfigPhase` -> "As the ledger's final phase, a throw from either write ... unwinds every phase before it through `runPhases`'s reverse-order undo (NFR-3)". The CR-04, CR-04-cycle, CR-07, WR-11(a) and WR-11(b) arrange comments name only the graph each builds; the CR-07 and WR-11(a) titles no longer name removed internals (`toReEnable`, "the discovery walk"). A grep over every file this phase touched for the policy's shapes (`no longer`, `before this`, `pre-fix`, `used to`, `the former`, `previously`, `before the fix`) finds one remaining hit, `tests/orchestrators/plugin/enable-disable.test.ts:694` ("Before this fix the flip landed in the BASE file"), which predates this phase (commit `8992d850`, an ancestor of `21126238`) and is left untouched as out of scope.

### WR-14: The docs do not describe the transitive re-enable, the never-installed-through-disabled install, or the fail-closed failures those walks add, and one sentence contradicts the paragraph above it

**Files modified:** `docs/dependency-resolution.md`, `docs/plugin-enablement.md`
**Commit:** `ea686608`
**Applied fix:** Written last, against what the restructure does. `dependency-resolution.md`'s already-installed section gains: the re-enable is transitive; a never-installed dependency below a disabled one installs as an ordinary cascade member; every such member answers to the recorded-version check and the range intersection wherever it sits (the WR-12 behaviour); a declaration under an already-enabled dependency is not walked; a disabled dependency that declares something unresolvable (not in its marketplace, in a marketplace this scope has not added, or part of a cycle) fails the install with its own reason even though the plugin you named never declared it. The same section's "but it no longer leaves it inert either" narration is gone. The "Where a dependency lands" sentence now reads "does not ADD a dependency to ... an entry the configuration already holds for it is overwritten as described above", agreeing with the overwrite eight lines up. The failure-table section gains a paragraph (not a table row: no new reason token exists, and `dependency-doc-agreement.test.ts` pins the table's token cells to the stamped set) stating that any reason in the table can name a disabled dependency's own declaration, with the row naming that dependency as the declarer. `plugin-enablement.md:40` carries the transitive sentence scoped to the install ("The install's re-enable is transitive: ..."), since `enable <plugin>`'s own walk does not stop at enabled members and does not install never-installed ones. `dependency-doc-agreement.test.ts`: 7/7 pass; mdformat clean.

### WR-15: `resolveTransitiveReEnableSet`'s 50-line doc comment is orphaned above `classifyReEnableCandidate`

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts`
**Commit:** `e9c12cd4`
**Applied fix:** Resolved by deletion: the orphaned block, `classifyReEnableCandidate` and `resolveTransitiveReEnableSet` no longer exist. Every remaining JSDoc block in the file sits directly on the declaration it documents (`disabledRecordOf`, `liveInstalledKeys`, `checkRecordedMembers`, `resolveMemberConstraints`, `CascadePhaseMember`); the design rationale lives in the file header's new EDEP-03 paragraph and in `runInstallCascade`'s call-site comment.

## Info findings the restructure touched (out of scope, recorded as the ruling asks)

- **IN-06** (the false "post order" comment at `install-cascade.ts:1041-1043`): deleted with the short-circuit it described. The `hydrateReEnabledMemberHooks`/`hydrateInstalledHooks` duplication is untouched.
- **IN-01..05, IN-07, IN-08**: untouched.

## Skipped Issues

None -- all 5 in-scope findings were fixed.

## Final verification

Every gate below ran in the main checkout of this worktree (`/home/acolomba/src/pi-claude-marketplace-manifest`, branch `features/manifest`), not in an isolated agent worktree, so the numbers are reproducible from the tree as committed. Exit codes were read from `$?` (or `PIPESTATUS[0]`), never from a glyph or through a pipe. Final tree `HEAD` = `ea686608`.

- `npm run typecheck` -- exit 0.
- `npx eslint extensions tests scripts` -- exit 0, whole tree, no output.
- `npx fallow health` -- `✗ 0 above threshold · 15255 analyzed · maintainability 91.7 (good)`, exit 0.
- `npx fallow dead-code` -- `✓ No issues found`, exit 0.
- `npm run lint:type-members` -- `Unused type member gate passed with 5 recorded exception(s).`, exit 0 (the same 5 pre-existing exceptions). Pins: three entries for deleted types (`TransitiveReEnableResult`, `FoldFailure`, `FoldNotFoundFailure`) dropped; `InstallCascadeResult.failure`, `toIntersectionFailure.failed`, `InstalledLedgerResult` remapped to their new lines; every `enable-disable.ts`/`shared.ts` pin below the shortened comments remapped by hunk delta. One gate finding surfaced and was fixed mid-session before the commit: with the closure members routed through an intermediate `{member, record}` pair, the gate's bounded flow analysis lost its witness for `MutableMember.requiredBy`; `resolveMemberConstraints` now iterates `options.closure` directly so the value-transfer from `resolveDependencyClosure`'s return is visible to it.
- `node scripts/test-coverage-direct.mjs --base 3a0bd2c2` (the `:commit` script compares against `HEAD`, which is a no-op once everything is committed) -- `Direct coverage passed` for all four changed pairs: `install-cascade.ts` (branches 131/131, functions 24/24, lines 1182/1182), `install-cascade.messaging.ts` (57/57, 13/13, 514/514), `enable-disable.ts` (279/279, 71/71, 2851/2851), `shared.ts` (186/186, 45/45, 1561/1561). No pins.
- `node --test` on touched/driving suites: `install-cascade.test.ts` 74/74 (68 existing + 6 new); `install-flow.test.ts` + `import/execute.test.ts` + `install-cascade.messaging.test.ts` + `edge/handlers/plugin/enable-disable.test.ts` + `shared.test.ts` 363/363; `enable-disable.test.ts` 102/102; `dependency-doc-agreement.test.ts` 7/7.
- `npm run test:coverage:unit` -- `ℹ tests 7423 / ℹ pass 7423 / ℹ fail 0`, `all files | 100.00 | 100.00 | 100.00`, exit 0. Full run, waited to completion.
- `SKIP=trufflehog pre-commit run --files <the 8 files the three commits changed>` -- every hook `Passed` (mdformat, markdownlint-cli2, prettier, npm lint, npm format check, npm typecheck, npm fallow, npm direct coverage (changed pairs), npm type members + negative controls, hygiene hooks), exit 0, no rewrites: `git status` afterward shows only the pre-existing dirty files.
- `docs/output-catalog.md` untouched, so `catalog-contract.test.ts`'s byte pin is unaffected (it ran green inside the full unit run).

REVIEW-FIX.md itself is intentionally left uncommitted; the orchestrator commits it separately.

## Iteration 4 (narrow re-review of the install-cascade seam)

The iteration-4 review (`08-REVIEW.md`, `iteration: 4`) re-derived the
`e9c12cd4` restructure against `domain/dependency-closure.ts` and found CR-08,
WR-12, WR-14 and WR-15 resolved, WR-13 resolved at every cited site, and no
Critical. One Warning remained:

### WR-16: Two comments still described the removed discovery/fold cascade

**Status:** fixed -- `a175df17`
**Files:** `tests/orchestrators/plugin/install-cascade.messaging.test.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts`
**Fix:** the messaging test's arrange comment no longer names the deleted
`partitionAlreadyInstalled`; `collectInstalledKeys`'s doc now states that the
cascade keeps a recorded ENABLED key as a walk wall and strips a recorded
DISABLED key so the walk re-enables it (`liveInstalledKeys`). Comment-only;
line counts unchanged, so no contract pin moved. Applied by the orchestrator
directly rather than through another fixer pass.

Info findings IN-01..IN-10 stay open by ruling (out of the Critical+Warning fix
scope); they are listed in `08-REVIEW.md` for the next pass that touches these
files.

**Loop note:** the `--auto` loop is capped at 3 iterations. Iteration 3 still
carried a reproduced crash (CR-08) on the install-cascade seam that had
regressed on every pass (CR-04 -> CR-07 -> CR-08), so the orchestrator ran one
targeted pass beyond the cap on that seam only, with the fixer model raised to
opus for it, then the narrow iteration-4 re-review. The per-iteration review
and fix reports are retained as `08-REVIEW.iter{1,2,3}.md` and
`08-REVIEW-FIX.iter{1,2,3}.md` for that post-mortem.

---

_Fixed: 2026-09-22T01:40:00Z_
_Fixer: Claude (gsd-code-fixer, iterations 1-3) / orchestrator (iteration 4)_
_Iteration: 4_
