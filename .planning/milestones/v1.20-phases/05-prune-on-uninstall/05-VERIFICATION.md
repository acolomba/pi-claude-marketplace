---
phase: 05-prune-on-uninstall
verified: 2026-09-24T17:02:30Z
status: passed
score: 6/6 must-haves verified
covered_files:
  - .planning/BACKLOG.md
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/phases/05-prune-on-uninstall/05-01-PLAN.md
  - .planning/phases/05-prune-on-uninstall/05-01-SUMMARY.md
  - .planning/phases/05-prune-on-uninstall/05-02-PLAN.md
  - .planning/phases/05-prune-on-uninstall/05-02-SUMMARY.md
  - .planning/phases/05-prune-on-uninstall/05-03-PLAN.md
  - .planning/phases/05-prune-on-uninstall/05-03-SUMMARY.md
  - .planning/phases/05-prune-on-uninstall/05-CONTEXT.md
  - .planning/phases/05-prune-on-uninstall/05-RESEARCH.md
  - .planning/phases/05-prune-on-uninstall/05-REVIEW-FIX.md
  - .planning/phases/05-prune-on-uninstall/05-REVIEW.md
  - .planning/phases/05-prune-on-uninstall/05-VALIDATION.md
  - README.md
  - docs/dependency-resolution.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/domain/dependency-orphans.ts
  - extensions/pi-claude-marketplace/edge/flag-catalog.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-uninstall.ts
  - tests/architecture/catalog-uat/fixtures/reconcile-applied.ts
  - tests/architecture/flag-catalog-drift.test.ts
  - tests/domain/dependency-orphans.test.ts
  - tests/edge/handlers/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/dependency-index.test.ts
  - tests/orchestrators/plugin/uninstall.messaging.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/notify.test.ts
covered_digest: "v1:sha256:c7e3203df13fc7908384d0e3bc3904f4ed4c7ac820f958159df4ca5dd6cedd1b"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Install a plugin that declares a dependency on a scratch scope, run `/claude:plugin uninstall <dependency>@<mp>`."
    expected: "The uninstall is refused; the row reads `(failed) {dependents remain}` and the `cause:` line names the dependent plugin as `name@marketplace`."
    why_human: "Requires a live Pi session against a real scratch scope and human judgment on message readability; not runnable from the automated suite (harvested from 05-03-PLAN.md Task 3 `<human-check>`)."
  - test: "On the same scratch scope, run `/claude:plugin uninstall <root>@<mp> --prune`."
    expected: "The dependency's row reads `(uninstalled) {dependency pruned}`, and `list` shows neither the root plugin nor the pruned dependency afterward."
    why_human: "Requires a live Pi session; the byte-level composition is pinned by the catalog and unit tests, but the end-to-end CLI experience is not."
  - test: "On the operator's own dev tree (not a scratch scope), run `uninstall <plugin> --prune` against plugins installed before the provenance field existed (Phase 3 era, back-filled as `explicit` by D-04-03)."
    expected: "`--prune` declines to remove those records (their provenance reads `explicit`), which is correct per PRUNE-02 and is NOT a bug; the remedy to get them prune-eligible is to uninstall and reinstall them, not to debug `--prune`."
    why_human: "Depends on the specific historical state of the operator's own machine; not reproducible in the automated suite (04-06-SUMMARY item 1, restated in 05-03-SUMMARY.md)."
  - test: "Seed two installed records in one scope that are BOTH absent from their marketplace manifests (the A-2 / two-stale-records scenario), then try to uninstall either."
    expected: "Each uninstall is refused with `{unreadable}` naming the other as the unreadable declarer, mutually blocking; `/claude:plugin marketplace remove <name>` on one of them clears the deadlock."
    why_human: "This is the scenario the planner flagged as the trigger for possibly reversing D-05-07 (fail-closed on an unreadable declarer, rated reversible). The operator must confirm the rows read sensibly and decide whether D-05-07 stands or should be relaxed (05-VALIDATION.md § Manual-Only Verifications, item 3; 05-03-SUMMARY.md coverage id D3, `human_judgment: true`)."
---

# Phase 05: Prune on uninstall Verification Report

**Phase Goal:** `uninstall --prune` removes the dependency-installed plugins that no remaining plugin needs, and nothing else, and says which ones it removed. With it the uninstall flag surface closes at exactly the two extra flags upstream defines.
**Verified:** 2026-09-17T02:30:00Z
**Status:** passed (human validation 2026-09-17: all 4 items approved by the operator; D-05-07 stands)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Merged from ROADMAP.md's six Phase 5 success criteria and the three plans'
`must_haves.truths`. Requirement IDs: PRUNE-01, PRUNE-02, PRUNE-03, PRUNE-04,
PRUNE-05, FLAG-01.

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | PRUNE-01: `uninstall --prune <plugin>` also removes each dependency-installed plugin that no remaining installed plugin declares, transitively, across marketplaces, including pre-existing orphans, in one save | ✓ VERIFIED | `domain/dependency-orphans.ts::pruneOrphans` (whole-scope fixpoint, import-free); wired in `uninstall.ts::sweepOrphans` between `commitPluginRemoval` and the single `tx.save()`. `node --test` on `tests/domain/dependency-orphans.test.ts` and `tests/orchestrators/plugin/uninstall.test.ts` green (titles `D-05-01`, `D-05-02` pass; ran locally, 0 failures). |
| 2 | PRUNE-02: `--prune` never removes a plugin the user installed directly, even one another installed plugin also declares as a dependency | ✓ VERIFIED | `pruneOrphans` filters `provenance === "dependency"` before consulting any declaration (`dependency-orphans.ts:119`). Tests titled `PRUNE-02` pass in both `dependency-orphans.test.ts` and `uninstall.test.ts` (explicit record survives whether or not declared). |
| 3 | PRUNE-03: `--prune` never removes a dependency while any remaining installed plugin — disabled included — still declares it | ✓ VERIFIED | `isHeldBy` (one-pass predicate, index does not filter on `enabled`) gates each batch; re-checked per member just before removal (CR-01 fix, `uninstall.ts:614`) so a failed member's own dependencies are correctly kept. Tests titled `PRUNE-03` and `PRUNE-03 / D-05-13` pass, including the CR-01 regression case ("a failed member is still a declarer"). Code review (iteration 2, `05-REVIEW.md`) traced this invariant explicitly and found it sound. |
| 4 | PRUNE-04: the user is told which plugins `--prune` removed | ✓ VERIFIED | `composePrunedRow` / `composeRemovalBlocks` in `uninstall.messaging.ts` render each pruned plugin its own `(uninstalled) {dependency pruned}` row under its marketplace, blocks in first-appearance order. `tests/orchestrators/plugin/uninstall.messaging.test.ts` (`PRUNE-04`) and the `success-prune` / `success-prune-keep-data` / `prune-partial-failure` catalog states pass. |
| 5 | FLAG-01: `uninstall` accepts exactly `--keep-data` and `--prune` as extra flags, with `--local`/`--scope` unchanged, pinned by the flag-catalog drift guard | ✓ VERIFIED | `edge/flag-catalog.ts`'s `uninstall` row is `[KEEP_DATA_FLAG_ENTRY, PRUNE_FLAG_ENTRY, WRITE_TARGET_FLAG_ENTRY]`; handler maps `PRUNE_FLAG` onto `prune: true` by omission discipline. `tests/architecture/flag-catalog-drift.test.ts` green (0 failures); rejected-token cases (`-y`, `--yes`, `--delete-data`, `--keep-data=false`, unknown) still reject in `tests/edge/handlers/plugin/uninstall.test.ts`. |
| 6 | PRUNE-05: `uninstall <plugin>` refuses to remove a plugin another installed record in the same scope still declares (disabled included), names the dependents, removes nothing; the reconcile path refuses the same way on every pass until fixed | ✓ VERIFIED | `assertNoDependents` throws `UninstallRefusedError` inside the locked closure before the cascade runs (no save on the guard's contract); `narrowCascadeFailure` renders it. Tests titled `D-05-14`, `D-05-15`, `D-05-04`, `D-05-05`, `D-05-07`, `D-05-16` pass. Reconcile retry loop (WR-01 fix, `apply.ts:423-448`) reconverges dependency-then-dependent config drops in one pass; `RECON-03` refused-uninstall pinned rows unchanged. |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

### Deviations From the Plan, Traced and Accepted

Two deliberate, gate-verified deviations from the PLAN's literal wording surfaced
during code review and were fixed before this verification, both narrowing rather
than weakening the guarantees:

- The D-05-07 unreadable-declarer refusal renders `{unreadable}` (the existing
  D-47-B closed-set member), not the PLAN's originally sketched `{not in
  manifest}` / `{invalid manifest}` split — WR-03 fix, because stamping the
  declarer's own read-failure token on the *target's* row made a false claim
  about the target's manifest. The cause line still names the declarer and why
  (`dependency-index.test.ts` and `uninstall.test.ts` `D-05-07` cases assert the
  cause message). `EXPECTED_UTF8_BYTES` was re-locked (28,548 → 28,543); no
  closed-set member count changed.
- Reconcile retries a refused uninstall within the same pass (WR-01 fix,
  `applyPluginUninstalls`'s retry loop) rather than requiring a second `/reload`
  when a dependency and its dependent are dropped from config together in the
  cascade's write order. This is a strict improvement on D-05-16's "every pass
  until fixed" contract, not a narrowing of it.

Both are recorded in `05-REVIEW-FIX.md` with commit hashes (`d3e3405f`,
`7afaece9`) and are covered by passing regression tests observed in this
verification's own `node --test` runs.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `extensions/pi-claude-marketplace/domain/dependency-orphans.ts` | `findDependents`, `isHeldBy`, `pruneOrphans`, import-free | ✓ VERIFIED | 132 lines, no `import` statement, all three exported and tested (25 cases pass). |
| `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts` | `buildScopeDeclarationIndex`, offline, fail-closed | ✓ VERIFIED | `grep -c "path.join"` = 0; composes only `loadMarketplaceManifest`/`lookupDeclaredPlugin`/`readDependencyDeclaration`; pinned in `NETWORK_FREE_TARGETS` (`tests/architecture/gate-targets.ts`). |
| `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` | `UninstallRefusedError`, guard, sweep, no outer-function complexity growth | ✓ VERIFIED | `uninstallPluginWithTransaction` measures fallow 15/14 (re-measured directly in this verification, matches plan ceiling and SUMMARY claim). |
| `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts` | `composePrunedRow`, `composeRemovalBlocks` | ✓ VERIFIED | Exported, tested, wired into the emit path. |
| `extensions/pi-claude-marketplace/edge/flag-catalog.ts` | `PRUNE_FLAG` on the `uninstall` row | ✓ VERIFIED | Confirmed by grep and by the drift-guard test passing. |
| `docs/output-catalog.md` | `refused-dependents-remain`, `refused-declarer-unreadable`, `reconcile-uninstall-refused-dependents`, `success-prune`, `success-prune-keep-data`, `prune-partial-failure` | ✓ VERIFIED | `grep -c 'catalog-state:'` = 217; `EXPECTED_STATE_COUNT` = 212, contract test passes. |
| `tests/orchestrators/plugin/uninstall.test.ts` | `D-05-01`, `D-05-02`, `D-05-03`, `D-05-04`, `D-05-05`, `D-05-07`, `D-05-09`, `D-05-12`, `D-05-13`, `D-05-14`, `D-05-15`, `PRUNE-02`, `PRUNE-03` titled cases | ✓ VERIFIED | All present, all pass in this verification's own run. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `edge/handlers/plugin/uninstall.ts` | `orchestrators/plugin/uninstall.ts` `UninstallPluginOptions.prune` | `consumedFlags.has(PRUNE_FLAG) && { prune: true }` (omission discipline) | ✓ WIRED | Confirmed by grep and by the `FLAG-01 / D-05-10` end-to-end edge tests, which seed a real orphaned dependency and assert it is pruned only when `--prune` is present. |
| `uninstall.ts` lock closure | `dependency-index.ts::buildScopeDeclarationIndex` | `assertNoDependents` called after `removedVersion` capture, before `cascade(...)` | ✓ WIRED | Confirmed by reading the closure (`uninstall.ts:1035-1094`) and by `D-05-14`/`D-05-03` tests. |
| `uninstall.ts`'s sweep | `dependency-orphans.ts::pruneOrphans` / `isHeldBy` | `sweepOrphans` computes the order once, re-checks `isHeldBy` per member | ✓ WIRED | Confirmed by reading `sweepOrphans` (`uninstall.ts:595-635`) and the CR-01 regression test. |
| `orchestrators/reconcile/apply.ts` | `UninstallRefusedError` | `instanceof` narrowing in `applyOnePluginUninstall` and `isRefusedUninstall` | ✓ WIRED | Confirmed by grep and by `D-05-16` reconcile tests; the reconcile call site passes no `prune` key (grep confirms only one `prune` occurrence in `apply.ts`, in a comment). |
| `orchestrators/reconcile/notify.ts` | `PluginUninstallFailedOutcome.cause` | conditional spread on `plugin-uninstall-failed` kind | ✓ WIRED | `D-05-16` reconcile-notify test passes; RECON-03 `{permission denied}` pinned rows remain byte-unchanged (still passing). |

### Data-Flow Trace (Level 4)

Not applicable in the UI-rendering sense (no frontend); the equivalent trace for
this phase is the notification-byte pipeline, exercised above: `notify()` is
driven over each new fixture through the same `makeCtx` boundary the catalog
contract test uses, and the catalog's fenced blocks are asserted byte-for-byte
against the fixtures (`catalog-contract.test.ts`, passing). No static/hardcoded
row was found substituting for a real declaration-index read.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Targeted phase test suites (uninstall, dependency-orphans, dependency-index, edge uninstall handler, reconcile apply, flag-catalog-drift) | `node --test tests/orchestrators/plugin/uninstall.test.ts tests/domain/dependency-orphans.test.ts tests/orchestrators/plugin/dependency-index.test.ts tests/edge/handlers/plugin/uninstall.test.ts tests/orchestrators/reconcile/apply.test.ts tests/architecture/flag-catalog-drift.test.ts` | 0 `not ok`, exit 0 | ✓ PASS |
| Closed-set / catalog gates | `node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/shared/notification-types.test.ts tests/architecture/no-orchestrator-network.test.ts tests/architecture/dependency-doc-agreement.test.ts tests/orchestrators/plugin/uninstall.messaging.test.ts` | 0 `not ok`, exit 0 | ✓ PASS |
| `REASONS` closed-set tail and length | `node -e 'import(...).then(m=>console.log(m.REASONS.length+" "+m.REASONS.at(-1)))'` | `56 dependency pruned` | ✓ PASS |
| Catalog anchor and state count | `grep -c 'catalog-state:' docs/output-catalog.md` / `EXPECTED_STATE_COUNT` | `217` / `212` | ✓ PASS |
| `uninstallPluginWithTransaction` complexity ceiling | `fallow health --complexity --max-cyclomatic 1 --max-cognitive 1 --format json` filtered to the function | `15/14` | ✓ PASS (matches plan ceiling and both SUMMARYs) |
| Typecheck | `npm run typecheck` | exit 0, no diagnostics | ✓ PASS |
| Lint | `npm run lint` | exit 0 | ✓ PASS |
| Debt markers in phase-touched production files | `grep -n "TBD\|FIXME\|XXX"` across the six touched production files | no matches | ✓ PASS |

`npm run check`'s full unit/integration counts were not re-run in this
verification (6461 unit / 32 integration, 0 failures per `05-03-SUMMARY.md`'s
own measured run, which is consistent with `05-REVIEW-FIX.md`'s independently
recorded 6467/6467 after the fixer's five commits, and typecheck/lint were
independently re-run above and confirmed clean).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| PRUNE-01 | 05-02 | `--prune` removes orphaned dependency-installed plugins | ✓ SATISFIED | `pruneOrphans`, `sweepOrphans`, `D-05-01`/`D-05-02` tests |
| PRUNE-02 | 05-02 | `--prune` never removes a directly-installed plugin | ✓ SATISFIED | provenance filter, `PRUNE-02` tests |
| PRUNE-03 | 05-02 | `--prune` never removes a still-declared dependency | ✓ SATISFIED | `isHeldBy`, CR-01 fix, `PRUNE-03`/`D-05-13` tests |
| PRUNE-04 | 05-02 | User is told which plugins were pruned | ✓ SATISFIED | `composePrunedRow`/`composeRemovalBlocks`, catalog states |
| PRUNE-05 | 05-01 | `uninstall` refuses while dependents remain, both entry points | ✓ SATISFIED | `UninstallRefusedError` guard, reconcile cause spread, `D-05-14..16` tests |
| FLAG-01 | 05-02, 05-03 | `uninstall` accepts exactly `--keep-data`/`--prune` | ✓ SATISFIED | catalog row, drift guard, edge end-to-end tests |

No orphaned requirements: `.planning/REQUIREMENTS.md`'s PRUNE section lists
exactly these five plus FLAG-01, all mapped by at least one plan's
`requirements:` frontmatter field.

### Anti-Patterns Found

None blocking. Eight Info-level findings remain from `05-REVIEW.md` iteration 2
(IN-01 through IN-08), all reviewed and none rated Critical or Warning:

| File | Finding | Severity | Impact |
|---|---|---|---|
| `uninstall.ts:1082-1094` | `prune` honored on the orchestrated overload with no type-level fence (IN-01) | ℹ️ Info | Latent — no orchestrated caller sets `prune` today (confirmed: `apply.ts` never sets it) |
| `uninstall.ts:986-989` | `prune` wrapper object comment states an unneeded rationale (IN-02) | ℹ️ Info | Cosmetic |
| `dependency-index.ts:60,69-73` | `IndexedRecord` repeats an existing type alias (IN-03) | ℹ️ Info | Cosmetic |
| `orchestrators/reconcile/apply.ts` (marketplace removal) | `marketplace remove` bypasses the dependents guard (IN-04) | ℹ️ Info | Documented, filed as `PRUNE-GUARD-MR-01` in BACKLOG.md, confirmed present |
| `dependency-index.ts:30-36` | operator decision left open: unusable own-manifest fallback (IN-05) | ℹ️ Info | Documented in code header and docs, consistent |
| `uninstall.ts:248-250` | `{unreadable}` token is non-specific (IN-06) | ℹ️ Info | Operator decision, documented |
| `docs/output-catalog.md:1163` | dangling modifier in `prune-partial-failure` prose (IN-07) | ℹ️ Info | Cosmetic prose only, `docs/dependency-resolution.md` phrases the same fact correctly |
| `orchestrators/reconcile/apply.ts:436-447` | one extra no-op reconcile pass in an edge ordering (IN-08) | ℹ️ Info | Efficiency only, no incorrect output |

No `TBD`/`FIXME`/`XXX` markers found in the phase's changed production files.
No `TODO`/`HACK`/`PLACEHOLDER` markers found either.

## Human Verification Required

Harvested from `05-03-PLAN.md` Task 3's `<human-check>` block and
`05-03-SUMMARY.md`'s "Manual verification carried into phase UAT" section
(also recorded in `05-VALIDATION.md` § Manual-Only Verifications). These are
live-session UX and an open design-reversibility decision that cannot be
settled by static analysis or the unit suite:

### 1. Live refusal row reads correctly

**Test:** On a scratch scope, install a plugin that declares a dependency, then run `/claude:plugin uninstall <dependency>@<marketplace>`.
**Expected:** The refusal row names the dependent on its `cause:` line and reads clearly to a human.
**Why human:** Requires a live Pi session; message clarity is a human judgment.

### 2. Live prune removes and reports correctly

**Test:** On the same scratch scope, run `/claude:plugin uninstall <root>@<marketplace> --prune`.
**Expected:** The dependency's `{dependency pruned}` row appears and `/claude:plugin list` shows neither plugin afterward.
**Why human:** Requires a live Pi session end to end.

### 3. Dev-tree provenance residue declines correctly

**Test:** On the operator's own dev tree, run `--prune` against plugins installed before the provenance field existed.
**Expected:** `--prune` declines to remove them (back-filled as `explicit`); this is correct behavior, not a defect. The remedy is uninstall + reinstall.
**Why human:** Depends on the specific state of the operator's own machine.

### 4. Two-stale-records scenario and the D-05-07 reversibility decision

**Test:** Seed two installed records in one scope that are both absent from their marketplace manifests; try to uninstall either.
**Expected:** Each refuses the other's uninstall with mutual `{unreadable}` rows; `marketplace remove` clears the deadlock.
**Why human:** This is the operator-flagged decision point: whether the fail-closed D-05-07 rule (rated reversible) stands as shipped or should be relaxed after seeing it live. `05-CONTEXT.md`'s A-2 assumption and `05-01-SUMMARY.md`'s "Next Phase Readiness" both flag this as an open call for the operator, not something this verification can resolve.

## Gaps Summary

None. Every must-have truth, artifact, and key link resolved to VERIFIED against
the current codebase; every requirement ID from the plans' frontmatter is
accounted for in REQUIREMENTS.md with no orphans. The phase is blocked from a
`passed` verdict only by four harvested human-verification items — three are
UX confirmations on a running system, and the fourth is a design decision the
plans explicitly deferred to the operator (whether to relax D-05-07). None of
the four reflects an automated check that failed or a gap in the shipped code.

---

*Verified: 2026-09-17T02:30:00Z*
*Verifier: Claude (gsd-verifier)*

## Current-tree re-verification (2026-09-24)

The orphan sweep, explicit-record protection, data preservation, and `--prune` rows still pass. The historical PRUNE-05 refusal in truth 6 was superseded by LOAD-03: uninstall now succeeds when readable dependents remain and reports them; an unreadable declarer still fails closed. `06-VERIFICATION.md` proves the replacement, and `12-UAT.md` proves standalone prune against a live Pi scope. Truths 1–5 remain active; truth 6 is historical.

The current milestone run passed 7,760 unit tests and all 15 integration files. `npm run typecheck`, `npm run lint:type-members`, and the network, notification, and planner architecture tests also passed. The historical truth table and line numbers above record the original verification run. The full `npm run check` still stops on formatting in the operator-owned `.planning/config.json`. No implementation change was needed for this re-verification.
