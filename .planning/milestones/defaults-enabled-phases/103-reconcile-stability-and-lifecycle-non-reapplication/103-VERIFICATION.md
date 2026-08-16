---
phase: 103-reconcile-stability-and-lifecycle-non-reapplication
verified: 2026-08-15T14:28:05Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: >-
      the new abort on an unreadable claude-plugins.local.json for the three
      standalone verbs
    reason: >-
      Accepted as scoped. The abort removes an inconsistency rather than adding
      a restriction: `applyReconcile` already treats an invalid
      `claude-plugins.local.json` as a hard block for the whole scope and
      renders the same `(failed) {invalid manifest}` row, so the standalone
      verbs were the outlier -- guessing around a file the load-time path
      refuses to guess around. The only alternative to aborting is choosing a
      write destination the code cannot determine, and choosing wrong writes to
      the file CFG-02 shadows, which is the defect this phase exists to close.
      The behavior is mutation-verified and the no-save discipline is asserted.
    accepted_by: "acolomba"
    accepted_at: "2026-08-15T15:00:00Z"
human_verification_resolved:
  - test: >-
      Accept (or reject) the NEW abort the code review introduced after every
      plan SUMMARY was written. Run a flagless `/claude:plugin install`,
      `enable`, or `disable` in a scope whose `claude-plugins.local.json` is
      unreadable (truncated, EACCES, or schema-violating).
    expected: >-
      The verb aborts with a `(failed) {invalid manifest}` row naming
      `claude-plugins.local.json`, writes no config and no `state.json`. Before
      this phase the same command silently wrote the base file and reported
      success. The behavior is correct, tested, and mutation-verified — the open
      question is product acceptance of a blast radius wider than this phase's
      four criteria: it changes three shipped verbs for ALL plugins, not only
      `defaultEnabled` ones.
    why_human: >-
      Not a correctness question — the row text and the no-save discipline are
      asserted by passing tests I ran. It is a UX scope decision that postdates
      the phase's recorded decisions (D-103-12/13/16 anticipated the write-target
      fix; none anticipated a new abort), so it warrants an explicit accept
      rather than being absorbed silently into a phase close.
---

# Phase 103: Reconcile stability and lifecycle non-reapplication Verification Report

**Phase Goal:** Once a plugin is installed disabled, nothing re-enables it behind the user's back — not the next `/reload`, not an `update`, not a `reinstall`.
**Requirements:** DFEN-06, DFEN-07
**Verified:** 2026-08-15T14:28:05Z
**Status:** human_needed (all four success criteria VERIFIED; one product-acceptance item)
**Re-verification:** No — initial verification

## Method

Verified against the tree at `01dfe8a1`, not against the SUMMARYs. Every criterion
was checked three ways: the production code that makes it true, a test that
proves it, and a **mutation** that reverts the production fix to confirm the test
actually discriminates. The working tree was restored to a byte-clean state after
every mutation (`git diff --stat HEAD` empty).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A `/reload` after installing a `defaultEnabled: false` plugin plans NO action — the record does not land in `acc.enable.push(...)` | ✓ VERIFIED | `orchestrators/reconcile/plan.ts:305-324`: `enabledExplicitFalse` is true and the disable branch is guarded by `!isRecordedButDisabled(record)`, so neither bucket is pushed. Proven at the planner (`plan.test.ts:541`, all seven buckets, plus the counter-case at `:592`), end to end for the reconcile-driven install (`apply.test.ts:2105`, `:2179`) and for the STANDALONE install (`install.test.ts:1565`). Mutation-confirmed below. |
| 2 | The steady state is a fixed point: a second and third `/reload` also plan nothing | ✓ VERIFIED | `apply.test.ts:2050-2069` loops passes 2 and 3, asserting zero notifications, a byte-identical declaring config and a `deepEqual` state record on each; the `planReconcile` capstone (`:2075-2082`) runs after the LAST pass over state and config re-read from disk. Run for the base-declared (`:2105`) and locally-declared (`:2179`) cases. |
| 3 | `update` and `reinstall` never consult `defaultEnabled` | ✓ VERIFIED | Structural: the only read of `resolved.defaultEnabled` outside `domain/` is the DFEN-04 verdict at `install.ts:1683` (repo-wide grep; every other hit is a comment). Gated by `tests/architecture/no-lifecycle-default-enabled-read.test.ts`, mutation-proven in both directions. Behavioral: `update.test.ts:3255` and `reinstall.test.ts:4007`, both with anti-vacuity controls. |
| 4 | A user who ran `enable` on a `defaultEnabled: false` plugin stays enabled across reload, update and reinstall | ✓ VERIFIED | `enable-disable.test.ts:2494` `runConverseEnableChain`, instantiated for BOTH declaration files (`:2642` base, `:2646` local). Six legs; `assertStaysEnabled` (`:2462`) checks the record AND the merged view on every leg, so a config the next reload would reverse cannot pass. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Mutation Testing — did the tests actually earn the pass

This is the evidence that separates "tests exist" from "tests discriminate". Each
row is a real edit to production source, the suite re-run, then a restore.

| # | Mutation applied | Expected to break | Result |
|---|---|---|---|
| M1 | Append `applyDefaultEnabled` to `reinstall.ts` | DFEN-07 gate | ✓ FAILED as required — and ONLY the `/\bapplyDefaultEnabled\b/` pattern fired, so the short pattern alone would MISS it |
| M2 | Append `defaultEnabled` to `update.ts` | DFEN-07 gate | ✓ FAILED as required — and ONLY the `/\bdefaultEnabled\b/` pattern fired, so the long pattern alone would MISS it |
| M3 | `selectDeclaringConfigWriteTarget` reverted to flag-only aiming (`targetIsLocal = opts.local === true`) | criteria 1, 2, 4 for local declarations | ✓ 3 install failures (incl. `the reload after a locally-declared install plans nothing`) + 3 enable-disable failures (incl. `an explicit enable of a LOCALLY-declared plugin survives reload, update and reinstall`). Base-declared variants stayed green, confirming the local case is the discriminating one |
| M4 | `isRecordedButDisabled` short-circuit removed from `reinstall.ts:1230` | criterion 3 / goal's "not a `reinstall`" | ✓ 4 reinstall failures |
| M5 | Review fix's `unreadable` abort arm removed from `shared.ts:522` | the review fix's new behavior | ✓ 2 failures (the CFG-03 abort tests for both install and enable) |

**M1 and M2 jointly settle the question posed about the gate's two token patterns:
both are independently necessary.** `defaultEnabled` is not a `\b`-delimited
substring of `applyDefaultEnabled` (case differs at the join and there is no word
boundary), so neither pattern subsumes the other. The gate mechanic itself is
real, not decorative: `tests/helpers/source-scan.ts:68` reads each target through
`readFile`, strips comments, and FAILS on a missing target (`:82-87`) rather than
greening over a file it never inspected.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `orchestrators/plugin/shared.ts:507` | `selectDeclaringConfigWriteTarget`, the one selector all three authoring verbs share | ✓ VERIFIED | Returns discriminated `DeclaringConfigWriteTarget` (`:438`). `selectConfigWriteTarget` is no longer exported (`:408`), so no caller can aim by flag alone — the compiler is the gate |
| `orchestrators/plugin/install.ts:1616` | Standalone install stamps the DECLARING file (D-103-16) | ✓ VERIFIED | One selection before any config read; `targetIsLocal` comes from the selector rather than being re-derived; both write arms (`:1764`, `:1799`) address `targetConfigPath` |
| `orchestrators/plugin/enable-disable.ts:548` | `enable`/`disable` write where the declaration lives (D-103-13) | ✓ VERIFIED | Same selector; all three write arms (`:617`, `:690`) and the config-truth promotion use `targetConfigPath` |
| `orchestrators/plugin/reinstall.ts:1230` | Disabled-record short-circuit mirroring `update` (D-103-12) | ✓ VERIFIED | Returns `partition: "skipped"`, `notes: ["already disabled"]` BEFORE the resolve; the `narrowReason` arm at `:1105` renders the token |
| `tests/architecture/no-lifecycle-default-enabled-read.test.ts` | DFEN-07 source gate (D-103-08, D-103-09) | ✓ VERIFIED | Two targets, two patterns, no `allowMissing`; delegates to the shared helper per D-98-09/D-98-10 |
| `orchestrators/reconcile/apply.ts:1147`, `:1249` | WR-05 comment correction after the reinstall change | ✓ VERIFIED | Comment-only diff; correctly names the second benign shape of a skipped backfill |
| `.planning/workstreams/defaults-enabled/ROADMAP.md` | D-103-02 / D-103-15 criterion-3 reword | ✓ VERIFIED | Landed in `e5b89bd3`; the clause now states DFEN-05's preservation rule instead of an outcome the install verb does not produce |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `install.ts` | `shared.ts::selectDeclaringConfigWriteTarget` | import `:158`, call `:1616` | ✓ WIRED | Both write arms consume the returned `targetConfigPath` |
| `enable-disable.ts` | `shared.ts::selectDeclaringConfigWriteTarget` | import `:93`, call `:548` | ✓ WIRED | `unreadable` arm routed to the existing `{ kind: "invalid-config" }` sentinel |
| `selector` | `install.ts::readDeclaredEnabled` | `targetIsLocal` + both parses `:1674` | ✓ WIRED | Locality is asked, not re-derived — the inversion hazard T-103-17 names |
| `reinstall.ts` | `persistence/state-io.ts::isRecordedButDisabled` | import `:72`, call `:1230` | ✓ WIRED | Single shared predicate; cannot drift from `update`'s |
| gate test | `tests/helpers/source-scan.ts` | `assertNoForbiddenSurface` | ✓ WIRED | Mutation-proven live (M1, M2) |

### Data-Flow Trace (Level 4)

The hazard this phase closes is precisely a data-flow one: a write landing in the
right *file* while the *merged view* the planner reads never moves.

| Value | Source | Reaches the planner? | Status |
|-------|--------|----------------------|--------|
| `enabled: false` stamp, base declaration | `writeBatchedConfigEntries` → `claude-plugins.json` | Yes — `apply.test.ts:2095-2100` reads `loadMergedScopeConfig` and asserts `entry.enabled === false` | ✓ FLOWING |
| `enabled: false` stamp, LOCAL declaration | `writeBatchedConfigEntries` → `claude-plugins.local.json` | Yes — `install.test.ts:1553-1558` and `apply.test.ts:2214-2219` assert `source === "local"` and `isDeclaredEnabled(entry) === false` on the MERGED read | ✓ FLOWING |
| `enabled: true` flip from `enable`, LOCAL declaration | `enable-disable.ts:690` | Yes — `assertStaysEnabled` compares `readMergedUserPluginEntry` on every chain leg | ✓ FLOWING |

Every assertion that could be satisfied by a shadowed write reads the MERGED
config, not one physical file. This was checked specifically because CFG-02
replaces entries wholesale, so a single-file read cannot discriminate — and M3
confirms the merged reads are what fail when the write is mis-aimed.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| DFEN-07 gate + planner cells | `node --test tests/architecture/no-lifecycle-default-enabled-read.test.ts tests/orchestrators/reconcile/plan.test.ts` | 40 pass / 0 fail | ✓ PASS |
| Reconcile fixed point, 3 passes, both declaration sites | `node --test tests/orchestrators/reconcile/apply.test.ts` | 33 pass / 0 fail | ✓ PASS |
| Criterion 4 converse chain, base + local | `node --test tests/orchestrators/plugin/enable-disable.test.ts` | 47 pass / 0 fail | ✓ PASS |
| Install write-target + reload half | `node --test tests/orchestrators/plugin/install.test.ts` | 124 pass / 0 fail | ✓ PASS |
| Reinstall short-circuit + update flip | `node --test tests/orchestrators/plugin/reinstall.test.ts tests/orchestrators/plugin/update.test.ts` | 189 pass / 0 fail | ✓ PASS |
| NFR-6 phase-boundary gate | `npm run check` | **exit 0** — 3518 tests, 3517 pass, 0 fail, 1 skipped; e2e 18/18 | ✓ PASS |

The single skip is a platform-conditional soft-skip (`D-62-05` non-Linux arm on a
Linux host), not a suppressed failure. The counts reproduce the SUMMARY's claim
exactly, verified in my own process rather than read from the report.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| DFEN-06 | The DFEN-04 state is reconcile-stable; a `/reload` plans no action and does not re-enable. Verified against the planner, not only at the install boundary | ✓ SATISFIED | Truths 1 and 2. The planner-level requirement is met literally: `planReconcile` is called directly and compared to `emptyReconcilePlan` |
| DFEN-07 | `update` and `reinstall` never re-apply `defaultEnabled`, so a release cannot flip an existing user | ✓ SATISFIED | Truths 3 and 4, gate + two flip tests with controls |

`REQUIREMENTS.md:81-82` still marks both rows `Pending`. That is the phase-close
bookkeeping step, not an implementation gap.

### Anti-Patterns Found

None. All six production/test files the phase touched were scanned for
`TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented` — zero hits. No stub
returns, no orphaned artifacts, no hardcoded empties reaching output.

### Observations (not gaps)

1. **`update`/`reinstall`'s post-success write-back still aims by the `--local`
   flag.** `shared.ts::maybeWritePluginConfigBack:965` picks its target from the
   flag alone, so a flagless `update` under a local-only declaration writes the
   shadowed base file. This is genuinely outside all four criteria and cannot flip
   enablement: the patch is `{}` (`:986`) and only runs when the key is ABSENT, so
   the entry stays fieldless and CFG-02 keeps the local entry effective. It is
   pinned rather than glossed — `enable-disable.test.ts:2607-2612` asserts the base
   entry stays `{}`, so a future change that writes a FIELD there fails a test.
   The install test's own comment (`install.test.ts:1487`) names it honestly as a
   rule statement rather than a coverage claim.

2. **The review fix did not break anything the phase had proven.** M3, M4 and the
   full-suite run confirm all six plans' behavioral claims still hold on the
   post-fix tree. The fix strictly narrowed the selector (an `unreadable` arm the
   compiler forces both callers to handle) and made `synthesizeAdoptedMarketplaceSource`
   skip rather than coerce an unreadable sibling; neither touches the criteria's
   code paths.

3. **`103-VALIDATION.md` frontmatter still says `status: draft`.** Every row in
   its verification map is `✅ green`; only the lifecycle marker is unset.

### Human Verification Required

#### 1. Accept the new flagless-verb abort over an unreadable `claude-plugins.local.json`

**Test:** In a scope whose `claude-plugins.local.json` is unreadable (truncated,
EACCES, or schema-violating), run a flagless `/claude:plugin install`, `enable`,
or `disable`.

**Expected:** The verb aborts with `(failed) {invalid manifest}` naming
`claude-plugins.local.json`, writing neither config nor `state.json`. Previously
the same command silently wrote the base file and reported success.

**Why human:** The behavior is correct and tested — `install.test.ts:4550`,
`enable-disable.test.ts:619` and `install.test.ts:4624` assert the row and the
no-save discipline, and M5 proves they discriminate. What needs a human is
*acceptance of the scope*: this changes three shipped verbs for ALL plugins, it
postdates every recorded phase decision (D-103-12/13/16 anticipated the
write-target fix, none anticipated a new abort), and `103-REVIEW-FIX.md` itself
asks the verifier to treat it as an intended change rather than collateral. The
rationale is sound — it matches what `applyReconcile` already does for that
scope, and a loud fixable error beats a silent write into the file CFG-02 shadows
— so the recommendation is to accept.

### Gaps Summary

None. All four success criteria are met in the current tree, each backed by a
test I ran and by a mutation confirming the test would fail without the
production fix. The phase's central claim — that the local-declared fixed point
holds because the write follows the declaration — is the one I attacked hardest
(M3), and it survived: reverting the fix breaks exactly the reload and converse
tests that assert it, and only for the locally-declared case, which is what the
plans predicted.

The single human item is a product-acceptance confirmation of a behavior change
that shipped after all six SUMMARYs were written, not a defect.

---

_Verified: 2026-08-15T14:28:05Z_
_Verifier: Claude (gsd-verifier)_
