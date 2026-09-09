---
phase: 116-load-time-workflow-convergence
verified: 2026-09-09T18:30:00Z
status: passed
score: 4/4 must-haves verified
covered_files:
  - .planning/workstreams/workflows/phases/116-load-time-workflow-convergence/116-01-PLAN.md
  - .planning/workstreams/workflows/phases/116-load-time-workflow-convergence/116-01-SUMMARY.md
  - .planning/workstreams/workflows/phases/116-load-time-workflow-convergence/116-02-PLAN.md
  - .planning/workstreams/workflows/phases/116-load-time-workflow-convergence/116-02-SUMMARY.md
  - .planning/workstreams/workflows/phases/116-load-time-workflow-convergence/116-03-PLAN.md
  - .planning/workstreams/workflows/phases/116-load-time-workflow-convergence/116-03-SUMMARY.md
  - .planning/workstreams/workflows/phases/116-load-time-workflow-convergence/116-04-PLAN.md
  - .planning/workstreams/workflows/phases/116-load-time-workflow-convergence/116-04-SUMMARY.md
  - .planning/workstreams/workflows/phases/116-load-time-workflow-convergence/116-CONTEXT.md
  - .planning/workstreams/workflows/phases/116-load-time-workflow-convergence/116-PATTERNS.md
  - .planning/workstreams/workflows/phases/116-load-time-workflow-convergence/116-RESEARCH.md
  - .planning/workstreams/workflows/phases/116-load-time-workflow-convergence/116-REVIEW-FIX.md
  - .planning/workstreams/workflows/phases/116-load-time-workflow-convergence/116-REVIEW.md
  - .planning/workstreams/workflows/phases/116-load-time-workflow-convergence/116-SECURITY.md
  - .planning/workstreams/workflows/phases/116-load-time-workflow-convergence/116-VALIDATION.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/index.test.ts
  - tests/integration/workflow-kind-inversion.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/backfill.test.ts
  - tests/orchestrators/reconcile/notify.test.ts
  - tests/shared/notify.test.ts
covered_digest: "v1:sha256:16a04b1a531ee6e87c9c4bd098c54578578b2dd324c1a7331c2543a96d29dee1"
behavior_unverified: 0
overrides_applied: 0
coincidental_reliance_items: []
---

# Phase 116: Load-time workflow convergence Verification Report

**Phase Goal:** A user who installed a workflow-bearing plugin before the `workflows`
kind was admitted gets its workflow commands after one reload, exactly once, and can
tell from the output why commands appeared after a reload they did not initiate.

**Verified:** 2026-09-09
**Status:** passed
**Re-verification:** No — initial verification

## Method

This is an initial verification of a phase whose own executors ran a code-review
cycle (`116-REVIEW.md`, 2 critical + 9 warnings) and a fix pass (`116-REVIEW-FIX.md`,
10/11 fixed) inside the phase, plus a security audit (`116-SECURITY.md`, 15/15
mitigated/accepted, `threats_open: 0`) and a Nyquist validation
(`116-VALIDATION.md`). SUMMARY claims were treated as narrative only. What follows is
independently re-derived from the tree at `HEAD` (`a5c05365`):

- Read `backfill.ts`, `orchestrators/reconcile/notify.ts`, `shared/notify.ts`,
  `shared/notify-reasons.ts` in full at HEAD and cross-checked every claim in the four
  SUMMARYs and the REVIEW-FIX report against the actual code, not the prose describing it.
- Ran the six suites the plans and the review-fix report claim are green, individually,
  and read each `pass`/`fail` count rather than trusting an aggregate.
- Ran `node scripts/test-coverage-direct.mjs` on the owner module alone.
- Confirmed `git diff --name-only 04642d1d..HEAD -- extensions/ tests/ docs/` is empty,
  so the `npm run check` exit-0 result recorded in `116-REVIEW-FIX.md` still describes
  the current tree (not re-run, per the task's constraint).
- Cross-referenced `REQUIREMENTS.md` and `ROADMAP.md` for the corrected population
  claim, and grepped for the retired unqualified clause.
- Specifically re-verified the two code-review criticals (CR-01, CR-02) that each
  collided with a roadmap success criterion, reading the actual guard code rather
  than accepting the REVIEW-FIX narrative.

## Goal Achievement

### Observable Truths (ROADMAP.md success criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | A recorded plugin at `installable: true` whose offline re-resolution yields a strictly larger supported set is re-materialized on the next load, and its workflow commands are runnable after that reload — no `update`/`reinstall` run by the user | ✓ VERIFIED | `backfill.ts:392` deletes the `installable` early return; `supportedSetGrew` is the sole growth gate. `tests/orchestrators/reconcile/backfill.test.ts:1906` (`WCONV-01: promotes a cleanly-installed record...`) drives the real `scanForceInstalledBackfills` → `reinstallPlugin({render:"none"})` path, asserting the grown `compatibility.supported` (`["skills","workflows"]`), `resources.workflows: ["hello:greet"]`, and the placed envelope (`savedWorkflowEntries` → `hello:greet.json`). The end-to-end integration case `tests/integration/workflow-kind-inversion.test.ts:384` drives the real `applyReconcile` entry point (not a hand-built outcome), reads the envelope file off disk and asserts its parsed JSON matches the same shape a normal install produces, and asserts the rendered notification bytes `/\(installed\) \{components now supported\}/` (added in the review fix, WR-08, replacing a weaker `notDeepStrictEqual(…, [])` check that a control proved would stay green under a regression). Both suites pass at HEAD (37/37, 4/4). |
| 2 | Self-heal is one-time: a second load re-materializes nothing, writes nothing, leaves `state.json` untouched — the same stamp + strict-superset test the `installable: false` arm already uses | ✓ VERIFIED | No new machinery: `supportedSetGrew` (`backfill.ts:529`) and the `EXTENSION_VERSION` stamp gate (`:76`) are reused unchanged. `RECON-05` in `backfill.test.ts` was strengthened from byte-only equality to a frozen `{bytes, inode, mtimeNs}` triple; the plan's own negative control shows an atomic rewrite of *identical bytes* still moving inode/mtime and failing the triple (116-02-SUMMARY.md, "atomic rewrite of identical content"), so the strengthening is proven to have bought something, not just added an assertion. The integration twin (`workflow-kind-inversion.test.ts:384`) drives two real `applyReconcile` loads and asserts the post-first-load state/envelope snapshot survives the second, with a stale-stamp control proving the assertion can fail. Both suites pass at HEAD. |
| 3 | A record whose supported set did not grow is never re-materialized, and a record the user disabled is never scanned | ✓ VERIFIED | Equal-set case `D-68-03 / WCONV-02: stamps a gate-open scope whose scanned record did not grow` passes at HEAD. The disabled half is a genuine measured zero, not an absence inference: `ENBL-08 / D-116-03: leaves a disabled record's poisoned manifest unread, so the stamp lands` seeds a disabled, would-grow record against an unreadable cached manifest and asserts BOTH empty outcomes AND a landed version stamp; its enabled twin (`ENBL-08 / D-116-03: reads the same poisoned manifest when the record is enabled, and holds the gate open`) proves the poison is visible when scanned. Both pass at HEAD. **Note (see "What I checked hardest" below):** the pre-existing case `ENBL-08: skips a disabled record whose supported set grew` does NOT gate the `isRecordedButDisabled` filter — it stays green when that filter is deleted, because reinstall's own refusal produces the same missing row. This is correctly not relied on for criterion 3; the new measured-zero pair is what gates it, and the inert old case is filed as WINDOWS #41/#42/#44 (non-blocking, tracked). |
| 4 | A convergence that materialized artifacts is visible through a closed-set reason token, pinned in the two named architecture tests and byte-paired in `docs/output-catalog.md` against `catalog-uat.test.ts`; a scan that materialized nothing stays silent | ✓ VERIFIED | `"components now supported"` is appended at the tail of `REASONS` (`shared/notify.ts:277`) and given a home in `CommandPrivateReason` (`shared/notify-reasons.ts:277`); `OUT-08` lock asserts length 46, `COMPAT-01` asserts the full ordered enumeration — both pass at HEAD (4/4, 14/14). `backfilledRowFromOutcome` (`orchestrators/reconcile/notify.ts:635`) places the token unconditionally as the first element of a shared `reasons` prelude read by both the `installed` and `partially-installed` returns — one line, not two edits that could drift. Two new catalog states (`backfill-installed`, `backfill-installed-workflow-engine-absent`) publish the fully-promoted arm's bytes for the first time; corpus-count lock moved 195→197 in one edit (literal, comment, failure message together); `catalog-uat.test.ts` passes at HEAD (6/6). The byte-change control (swap the token for another legal `REASONS` member, `up-to-date`) is recorded going RED while the 18/18 membership locks stayed GREEN in the same transcript (`116-03-SUMMARY.md`), which is the specific proof criterion 4 asks for — membership and rendering are two independently-gated facts. Silence is verified by construction: `maybeBackfillPlugin` returns `false` before pushing any outcome on every benign-skip path, and the CR-01 fix (below) extends that silence to a clean record whose manifest cannot be resolved. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### What I checked hardest — the two criticals

**CR-01 (criterion 4's "a scan that materialized nothing stays silent," vs. an unreadable manifest producing a permanent per-load `(failed)` row).**

Read `resolveRecordedPluginOffline` at HEAD (`backfill.ts:500-520`):

```ts
} catch (err) {
  if (record.compatibility.installable) {
    return undefined;
  }
  throw err;
}
```

This is exactly the fix the REVIEW-FIX report describes and it sits precisely on the
pre-widening boundary: a record already recorded `installable: false` (the population
that had this `(failed)`-row surface before the phase) still rethrows, reaches
`backfillOnePluginIsolated`'s catch, and surfaces its row — verified live via
`SF-02: surfaces a plugin-scoped failure row when the cached manifest cannot be parsed`
and `SF-02: promotes a healthy plugin under one marketplace while a corrupt manifest
fails its own`, both still green, unedited. A record recorded `installable: true` (the
population the widening added) gets a benign `undefined` and produces nothing. This
split is independently confirmed by two new tests that pass at HEAD:
`WCONV-01: converges over a clean record whose manifest cannot be read, emitting
nothing` and the discriminator `SF-02 / WCONV-01: still fails a degraded record under
the same unreadable manifest` (one clean + one degraded record sharing one poisoned
manifest; asserts exactly one row, not zero and not two). `tests/index.test.ts` carries
the entry-point case `converges silently over a recorded plugin whose marketplace
source is absent (WCONV-01)`. All pass at HEAD (37/37 in `backfill.test.ts`, 15/15 in
`index.test.ts`). The pre-existing `installable: false` population's SF-02 surface is
unmodified — confirmed by reading the rethrow branch, not merely by the passing count.

**CR-02 (criterion 3's "reverses no explicit user decision," vs. a clean record silently degrading).**

Read `maybeBackfillPlugin` at HEAD (`backfill.ts:392-394`):

```ts
if (record.compatibility.installable && resolved.state !== "installable") {
  return false;
}
```

This guard sits after the growth test and before `reinstallPlugin` is called, exactly
where the review proposed it. It is reachable and gated, not decorative: the case
`WCONV-01: declines to degrade a clean record whose re-resolve is partially-available`
seeds a clean record whose set grows AND whose re-resolve simultaneously drops a kind,
and passes at HEAD; the REVIEW-FIX transcript shows it failing (a `plugin-backfilled`
outcome with `installable: false` and a dropped-kind list) with the guard removed. A
record already `installable: false` is confirmed to keep its prior behavior by
inspection — the guard's left operand (`record.compatibility.installable`) is `false`
for that population, so the `&&` short-circuits and the branch never taints an
already-degraded record's promotion path.

Both fixes are silent, in-scope, one-line production changes; neither widened scope
beyond the two roadmap criteria they touch, and both are covered by tests that fail
when the guard is removed (confirmed by reading the REVIEW-FIX transcripts, which show
the actual failing assertion bodies, not a description of one).

### The retired population claim — confirmed corrected, no live site restates it

```
$ test "$(grep -v '^>' REQUIREMENTS.md ROADMAP.md | grep -c 'land on that side')" = "0"  → PASS
$ grep -c 'clone-cache resolver' REQUIREMENTS.md  → 1 (non-zero, PASS)
```

`REQUIREMENTS.md:55` and `ROADMAP.md:71-79` both state the corrected claim in the
code's own vocabulary (no clone-cache resolver on the offline path → path-source
records only), report `code-modernization` as a measured path source and
`claude-security` as absent-and-unmeasured, and state every success criterion holds
either way. `116-CONTEXT.md` carries the history (both the original discussion
sentence and the two re-measurements, dated). No live source, test, or doc site
retains the retired "both Anthropic-authored plugins land on the `installable: true`
side" sentence.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `orchestrators/reconcile/backfill.ts` | Widened scan, CR-01/CR-02 guards, corrected comments | ✓ VERIFIED | Filter deleted; two production guards present and gated (see above); 12+ comment sites restated in present tense; `hasForceInstalledPlugin` body byte-unchanged, doc corrected to name the TOCTOU-window property rather than a false "narrower on purpose" claim (WR-04, confirmed by reading `apply.ts:108`/`with-state-guard.ts:89`/`state-io.ts:394` chain) |
| `orchestrators/reconcile/notify.ts` | Token stamped on both render arms, one shared prelude | ✓ VERIFIED | `reasons` array built once (`:634-640`), read unconditionally by both `installed` and `partially-installed` returns; WR-06 divergence (info vs. warning on an absent companion) documented in the doc block as a bounded projection-wide property, not silently accepted |
| `shared/notify.ts` / `shared/notify-reasons.ts` | Token in `REASONS` + `CommandPrivateReason`, all five derivations moved | ✓ VERIFIED | Confirmed by grep and by the passing `OUT-08`/`COMPAT-01`/`notify.test.ts`/typecheck suite; WR-09's ungated running-count prose removed from all four non-title sites, count retained only in the test title (deliberately, per REVIEW-FIX rationale) and the assertion beside it |
| `docs/output-catalog.md` | Two new catalog states, corpus count 197, two re-byted backfill states | ✓ VERIFIED | Confirmed 4 `catalog-state:` annotations under the backfill family; corpus assertion literal is 197 |
| `tests/orchestrators/reconcile/backfill.test.ts` | WCONV-01/02/03 cases, CR-01/CR-02 controls, measured-zero pair, triple-snapshot RECON-05 | ✓ VERIFIED | 37/37 pass at HEAD; case titles for all named truths present |
| `docs/output-catalog.md` corpus lock | 197, one edit | ✓ VERIFIED | `catalog-uat.test.ts:5673` — `197` |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `backfillOnePluginIsolated` | `maybeBackfillPlugin` | direct call after two surviving filters | ✓ WIRED | Confirmed by reading `backfill.ts:289-333` |
| `maybeBackfillPlugin` | `resolveRecordedPluginOffline` | direct call | ✓ WIRED | `backfill.ts:361` |
| `resolveRecordedPluginOffline` | `supportedSetGrew` | direct call | ✓ WIRED | `backfill.ts:375` |
| `supportedSetGrew` (grown) | `reinstallPlugin({render:"none"})` | direct call, gated by the CR-02 consent guard | ✓ WIRED | `backfill.ts:392-406` |
| `REASONS` (`shared/notify.ts`) | `CommandPrivateReason` (`shared/notify-reasons.ts`) | `_ReasonsCoverageProof` | ✓ WIRED | `npm run typecheck` clean at HEAD; both files carry the literal |
| `backfilledRowFromOutcome`'s `reasons` prelude | both `installed`/`partially-installed` returns | shared array read twice | ✓ WIRED | `orchestrators/reconcile/notify.ts:634-651` |
| `<!-- catalog-state: -->` annotations | `FIXTURES[section][state]` | bidirectional byte gate | ✓ WIRED | `catalog-uat.test.ts` 6/6 pass; forward + inverse walks both exercised by control per `116-03-SUMMARY.md` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| WCONV-01 end-to-end promotion (unit) | `node --test tests/orchestrators/reconcile/backfill.test.ts` | 37/37 pass | ✓ PASS |
| WCONV-01/02 end-to-end via real `applyReconcile` (integration) | `node --test tests/integration/workflow-kind-inversion.test.ts` | 4/4 pass | ✓ PASS |
| Closed-set token membership + rendering | `node --test tests/architecture/catalog-uat.test.ts tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts` | 6/6, 4/4, 14/14 pass | ✓ PASS |
| Projection whole-row assertions | `node --test tests/orchestrators/reconcile/notify.test.ts` | 79/79 pass | ✓ PASS |
| Entry-point PATH cases + new CR-01 case | `node --test tests/index.test.ts` | 15/15 pass | ✓ PASS |
| Owner-module coverage, run alone | `node scripts/test-coverage-direct.mjs .../reconcile/backfill.ts` | branches 67/67, functions 13/13, lines 536/536 | ✓ PASS |
| Whole-tree gate unchanged since exit-0 fix-pass commit | `git diff --name-only 04642d1d..HEAD -- extensions/ tests/ docs/` | empty | ✓ PASS (confirms `npm run check` exit-0 result still describes HEAD; not re-run per task constraint) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| WCONV-01 | 116-01, 116-02, 116-04 | Widened scan promotes a grown-set record with no `update`/`reinstall` | ✓ SATISFIED | Truth #1 above; `REQUIREMENTS.md:55` marked `[x]` and states the corrected population bound |
| WCONV-02 | 116-01, 116-02 | Self-heal is one-time, reusing the existing stamp + growth test | ✓ SATISFIED | Truth #2 above; `REQUIREMENTS.md:56` marked `[x]` |
| WCONV-03 | 116-01, 116-03 | Convergence is visible via a closed-set reason token; silence otherwise | ✓ SATISFIED | Truth #4 above; `REQUIREMENTS.md:57` marked `[x]` |

No orphaned requirements: `grep -E "Phase 116" REQUIREMENTS.md` maps only WCONV-01..03, and all three appear in at least one plan's `requirements:` field (116-01, 116-02, 116-03, 116-04).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | `grep -nE "TBD\|FIXME\|XXX"` across the 8 changed `extensions/` files at HEAD returns nothing | — | No debt markers introduced |
| `backfill.ts` | 175-185 (`hasForceInstalledPlugin`), `239-266` (`scanForceInstalledBackfills`) | Names retained (`scanForceInstalledBackfills`, `hasForceInstalledPlugin`) that no longer describe the filter they once gated (review WR-03) | ℹ Info | Deliberately skipped — reverses `116-CONTEXT.md`'s operator-locked "Names are left alone" decision; the review's own vocabulary-guard rationale for the lock does not survive contact with the proposed names, but the "rename is churn beyond WCONV-01..03" half stands on its own. Filed as WINDOWS #44 (`open`, `todo`, non-blocking, "Operator call for a later phase") — correctly tracked, not silently dropped |
| `backfill.test.ts:1445`/`:557` citation drift | — | Two stale line-number citations in `116-SECURITY.md`/`116-04-SUMMARY.md` prose, caught by the security audit itself | ℹ Info | Non-blocking, documentation only, filed as WINDOWS #43 |

No 🛑 Blockers found. All flagged items are pre-existing, non-blocking, operator-facing, and correctly filed to `.planning/WINDOWS.md` rather than hidden in prose.

### Human Verification Required

None. All four success criteria have independently-runnable automated evidence
(unit + integration + architecture suites), and the two review criticals were
re-derived from source rather than trusted from the fix report.

### Gaps Summary

None. The phase's own code-review cycle (2 criticals) already surfaced the two
scenarios most likely to falsify success criteria 3 and 4, and both fixes were
independently re-verified against the code at HEAD (not just re-read from the
REVIEW-FIX narrative): the guard code, its test coverage, and its negative controls
all check out. The one item that looked like it might be a criterion-3 gap on first
read — the pre-existing `ENBL-08: skips a disabled record whose supported set grew`
case not actually gating the filter it names — was confirmed to be correctly
non-load-bearing for criterion 3 (a genuinely new measured-zero pair gates it
instead) and is already tracked as an open, non-blocking window rather than an
unaddressed gap.

---

*Verified: 2026-09-09*
*Verifier: Claude (gsd-verifier)*
