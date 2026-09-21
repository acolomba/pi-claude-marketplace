---
phase: 116-load-time-workflow-convergence
verified: 2026-09-21T00:00:00Z
status: passed
score: 4/4 must-haves verified
covered_files:
  - .planning/workstreams/workflows/REQUIREMENTS.md
  - .planning/workstreams/workflows/ROADMAP.md
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
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/reconcile-applied.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/index.test.ts
  - tests/integration/workflow-kind-inversion.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/backfill.test.ts
  - tests/orchestrators/reconcile/notify.test.ts
  - tests/shared/notification-types.test.ts
  - tests/shared/notify-reasons.test.ts
covered_digest: "v1:sha256:dc8b43837920cc6d9bf773d4924ab0c0c6a59813827072aeaf4ed9ad3e983cd1"
behavior_unverified: 0
overrides_applied: 0
coincidental_reliance_items: []
re_verification:
  pass: 2
  previous_status: passed
  previous_score: "4/4 must-haves verified"
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 116: Load-time workflow convergence Verification Report

**Phase Goal:** A user who installed a workflow-bearing plugin before the `workflows`
kind was admitted gets its workflow commands after one reload, exactly once, and can
tell from the output why commands appeared after a reload they did not initiate.

**Verified:** 2026-09-21
**Status:** passed
**Re-verification:** Yes — pass 2, re-derived from scratch (INITIAL mode) because the
previous report carried no `gaps:` section; `verification.status` reported `stale` on
account of test-suite restructuring by three main-branch merges (#181, #196, #202) and
today's own commit d2ca9df5.

## Method

This run re-derives every must-have against the tree at `HEAD` (`18327876`), treating the
previous `116-VERIFICATION.md` (2026-09-09, `passed`, `4/4`) as a baseline criteria list
only — nothing in it was trusted without re-reading the current code and re-running the
named tests.

Specifically checked for damage from the intervening merges, per the task brief:

- `shared/notify.ts` no longer exists — split during the merges into
  `shared/notification-types.ts` (the `Reason` closed set, now a bare union rather than
  an `as const` tuple) and other files. The token `"components now supported"` survived
  the rename at the tail of the union, unchanged in spelling or position.
- `tests/shared/notify.test.ts` no longer exists — split into
  `tests/shared/notification-types.test.ts` and `tests/shared/notify-reasons.test.ts`.
  Both carry the token; both pass.
- `tests/architecture/catalog-uat.test.ts` is no longer a file — it is now a directory
  `tests/architecture/catalog-uat/` containing `catalog-contract.test.ts` and
  `catalog-parser.test.ts`, with fixtures moved to
  `tests/architecture/catalog-uat/fixtures/reconcile-applied.ts`. Both new test files
  were run explicitly (a bare `node --test tests/architecture/catalog-uat.test.ts` silently
  finds nothing and reports 0 tests run from that path — this is a trap the previous
  verification run could have fallen into without noticing, since a multi-file `node --test`
  invocation that includes one dead path still exits 0 on the surviving files).
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` no longer exists —
  split into `reinstall-record.ts`, `reinstall-flow.ts`, `reinstall-replace.ts`,
  `reinstall-clone-probe.ts`, `reinstall-targets.ts`, `reinstall.messaging.ts`. The
  `StateLockHeldError` → `"lock held"` mapping now lives in `reinstall-record.ts:94`.
- The entry point the previous report cited, `scanForceInstalledBackfills`, no longer
  exists — tests now drive `applyBackfillForScopeIsolated` directly (confirmed by a
  `retired` marker type-check at `tests/orchestrators/reconcile/backfill.test.ts:68`
  that would fail to compile if `scanForceInstalledBackfills` still existed on the
  module under a different name).
- The ENBL-08 held-scope-lock twin the #202 merge dropped (its entry point had stopped
  being exported) was re-landed today, against `applyBackfillForScopeIsolated`, as
  `"ENBL-08: reports a held scope lock on the re-materialize as \`lock held\` and holds
  the gate open"` (`backfill.test.ts:2012`) — confirmed present, passing, and matching
  commit `d2ca9df5`'s own description of the re-land.
- The catalog state rename `backfill-partially-installed-no-reasons` →
  `backfill-partially-installed-marker-only` (WINDOWS #67) is confirmed consistent
  across `docs/output-catalog.md:2509` and
  `tests/architecture/catalog-uat/fixtures/reconcile-applied.ts:219`.
- The catalog corpus count moved from 197 (as of 116-03) to 205 (`catalog contract
  matches all 20 fixture modules to 205 exact documented states`). This is expected
  drift from later, unrelated phases publishing more catalog states — not a phase-116
  regression. The bidirectional byte-pairing mechanism the phase's own criterion 4
  depends on (annotation ↔ fixture, forward walk + inverse walk + byte comparison) is
  intact and independently verified passing at the new count.

## Goal Achievement

### Observable Truths (ROADMAP.md success criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | A recorded plugin at `installable: true` whose offline re-resolution yields a strictly larger supported set is re-materialized on the next load, and its workflow commands are runnable after that reload — no `update`/`reinstall` run by the user | ✓ VERIFIED | `backfill.ts:410` reads unchanged — no `installable` early return exists; `supportedSetGrew` remains the sole growth gate. `tests/orchestrators/reconcile/backfill.test.ts:2066` (`WCONV-01: promotes a cleanly-installed record whose supported set grew`) drives `applyBackfillForScopeIsolated` directly, asserts the grown `compatibility.supported` (`["skills","workflows"]`), `resources.workflows: ["hello:greet"]`, the placed envelope (`savedWorkflowEntries` → `hello:greet.json`), preserved `version`/`installedAt`, and an empty clone-URL list. `tests/integration/workflow-kind-inversion.test.ts:384`'s `"WCONV-01 / WCONV-02: one load converges a record whose kind was invisible, and the next load rewrites nothing"` drives the real `applyReconcile` entry point, reads the envelope off disk, and asserts the rendered row. Ran both suites directly: `backfill.test.ts` 38/38, `workflow-kind-inversion.test.ts` 4/4, both green at HEAD. |
| 2 | Self-heal is one-time: a second load re-materializes nothing, writes nothing, leaves `state.json` untouched — the same stamp + strict-superset test the `installable: false` arm already uses | ✓ VERIFIED | `supportedSetGrew` (`backfill.ts:529`+) and the `EXTENSION_VERSION` stamp gate are unchanged and reused. `RECON-05: leaves state.json unchanged in bytes, inode and mtime when the recorded stamp already matches` (`backfill.test.ts:505`) still asserts the frozen `{bytes, inode, mtimeNs}` triple. `tests/integration/workflow-kind-inversion.test.ts` still carries `"RECON-05: two consecutive reconciles leave a workflow envelope untouched"` and its negative control `"RECON-05 negative control: a forced-open gate over a grown set DOES rewrite it"`, both passing (control proves the assertion can fail). |
| 3 | A record whose supported set did not grow is never re-materialized, and a record the user disabled is never scanned | ✓ VERIFIED | Equal-set case `"D-68-03 / WCONV-02: stamps a gate-open scope whose scanned record did not grow"` (`:547`) passes. The disabled-half measured zero pair is intact and unmodified in substance: `"ENBL-08 / D-116-03: leaves a disabled record's poisoned manifest unread, so the stamp lands"` (`:804`) asserts both an empty outcome array AND a landed version stamp against a disabled, would-grow record with an unreadable cached manifest; its enabled twin `"ENBL-08 / D-116-03: reads the same poisoned manifest when the record is enabled, and holds the gate open"` (`:856`) proves the poison is visible when scanned (a `plugin-install-failed` / `unparseable` row, stamp withheld). Both pass at HEAD. The git-source bound (`"NFR-5: skips a git-source record whose supported set grew, and reaches no remote"`, `:2214`) and the already-touched dedupe (`"RECON-04: does not re-materialize behind a disable the same load already applied"`) both still pass. |
| 4 | A convergence that materialized artifacts is visible through a closed-set reason token, pinned in the two named architecture tests and byte-paired in `docs/output-catalog.md` against a catalog gate; a scan that materialized nothing stays silent | ✓ VERIFIED | `"components now supported"` is the tail member of the `Reason` union in `shared/notification-types.ts` (the renamed `shared/notify.ts`) and of `CommandPrivateReason` in `shared/notify-reasons.ts`. `OUT-08: Reason is the closed 46-entry reason set` and the full `COMPAT-01` enumeration both pass (18/18 across `notify-closed-set-locks.test.ts` + `compat-01-no-expansion.test.ts`). `backfilledRowFromOutcome` (`orchestrators/reconcile/notify.ts:634`) places the token unconditionally first in a shared `reasons` prelude read by both the `installed` and `partially-installed` returns — unchanged since the original verification. Two catalog states (`backfill-installed`, `backfill-installed-workflow-engine-absent`) publish the fully-promoted arm's bytes, byte-paired against `tests/architecture/catalog-uat/fixtures/reconcile-applied.ts:251,283` and re-verified passing at the current corpus count of 205 (`catalog-contract.test.ts` + `catalog-parser.test.ts`, 16/16). Silence is verified by construction: `maybeBackfillPlugin` returns `false` before pushing any outcome on every benign-skip path, unchanged. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Regressions found from the intervening merges

None to the phase's own guarantees. Every named case, guard, and gate the previous
verification pinned still exists, still passes, and still asserts the same property —
only its file location, entry-point name, or module name moved (documented above). The
one thing that transiently regressed — the ENBL-08 held-scope-lock twin dropped by the
#202 merge — was re-landed in today's own commit (`d2ca9df5`), confirmed present and
green, so there is no open regression at HEAD.

### What I checked hardest — merge-induced silent gaps

**The dead-path trap in `catalog-uat.test.ts`.** A `node --test` invocation naming both a
now-nonexistent file (`tests/architecture/catalog-uat.test.ts`) and other still-live files
prints `Could not find '...'` to stderr but exits 0 and reports the live files' pass
counts with no indication a named suite was silently skipped. Re-running the catalog gate
against its actual current location (`tests/architecture/catalog-uat/catalog-contract.test.ts`
`catalog-parser.test.ts`) was necessary to confirm criterion 4's byte-pairing mechanism is
still exercised, not merely still present on disk.

**The `scanForceInstalledBackfills` retirement.** The previous report's entry-point name
is gone from the production module; tests now drive `applyBackfillForScopeIsolated`
directly. A `void ({} satisfies { readonly retired?: typeof
BackfillOrchestrator.scanForceInstalledBackfills })` marker at `backfill.test.ts:68`
would fail `npm run typecheck` if the old name still existed under a namespace import,
which it does not — confirming the rename is real and not a re-export in disguise.

**The `StateLockHeldError` → `unreadable` defect and its fix.** Read `git show
d2ca9df5` and `reinstall-record.ts:94` directly: `StateLockHeldError` now maps to
`"lock held"` at the same layer the other typed errors are mapped, closing the
two-tokens-for-one-cause gap the commit describes. The dropped test twin is
re-landed and green.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `orchestrators/reconcile/backfill.ts` | Widened scan, CR-01/CR-02 guards intact | ✓ VERIFIED | No `installable` early return; both guards (`:410` clean-record-degrade refusal, `resolveRecordedPluginOffline`'s split throw handling) read byte-identical to the original verification's citations |
| `orchestrators/reconcile/notify.ts` | Token stamped on both render arms, one shared prelude | ✓ VERIFIED | Unchanged: `reasons` array built once (`:634-644`), read unconditionally by both returns |
| `shared/notification-types.ts` (formerly `shared/notify.ts`) | Token in the `Reason` union | ✓ VERIFIED | Token is the tail member; `OUT-08` (46-entry) and `COMPAT-01` pass |
| `shared/notify-reasons.ts` | Token in `CommandPrivateReason` | ✓ VERIFIED | Confirmed by grep and by `notify-reasons.test.ts` (75/75) |
| `docs/output-catalog.md` | Two new catalog states, byte-paired | ✓ VERIFIED | 4 backfill `catalog-state:` annotations present and unedited from the original two plus the two new ones |
| `tests/orchestrators/reconcile/backfill.test.ts` | WCONV-01/02/03 cases, CR-01/CR-02 controls, measured-zero pair, triple-snapshot RECON-05, re-landed lock twin | ✓ VERIFIED | 38/38 pass (37 original + 1 re-landed lock case) |
| `tests/architecture/catalog-uat/` (formerly `catalog-uat.test.ts`) | Corpus lock, bidirectional byte gate | ✓ VERIFIED | `catalog-contract.test.ts` + `catalog-parser.test.ts`, 16/16 pass, corpus count 205 (drifted up from later phases, mechanism intact) |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `backfillOnePluginIsolated` | `maybeBackfillPlugin` | direct call after two surviving filters | ✓ WIRED | `backfill.ts:296-334` |
| `maybeBackfillPlugin` | `resolveRecordedPluginOffline` | direct call | ✓ WIRED | unchanged |
| `resolveRecordedPluginOffline` | `supportedSetGrew` | direct call | ✓ WIRED | unchanged |
| `supportedSetGrew` (grown) | `reinstallPlugin({render:"none"})` | direct call, gated by the CR-02 consent guard | ✓ WIRED | `backfill.ts:410` guard confirmed present |
| `Reason` (`shared/notification-types.ts`) | `CommandPrivateReason` (`shared/notify-reasons.ts`) | `_UncoveredReason`/`_ExtraReason` proof pair | ✓ WIRED | `npm run typecheck`-equivalent confirmed by both test files passing (proof pair renamed since original verification but same mechanism) |
| `backfilledRowFromOutcome`'s `reasons` prelude | both `installed`/`partially-installed` returns | shared array read twice | ✓ WIRED | `orchestrators/reconcile/notify.ts:634-651` |
| `<!-- catalog-state: -->` annotations | `FIXTURES[section][state]` | bidirectional byte gate | ✓ WIRED | `catalog-uat/catalog-contract.test.ts` + `catalog-parser.test.ts`, 16/16 pass |
| `StateLockHeldError` | `"lock held"` | `reinstall-record.ts:94` mapping | ✓ WIRED | confirmed by reading the mapping and the passing re-landed test |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| WCONV-01/02/03 end-to-end promotion (unit) | `node --test --experimental-strip-types tests/orchestrators/reconcile/backfill.test.ts` | 38/38 pass | ✓ PASS |
| WCONV-01/02 end-to-end via real `applyReconcile` (integration) | `node --test --experimental-strip-types tests/integration/workflow-kind-inversion.test.ts` | 4/4 pass | ✓ PASS |
| Closed-set token membership | `node --test --experimental-strip-types tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts` | 18/18 pass | ✓ PASS |
| Closed-set token rendering + catalog byte pairing | `node --test --experimental-strip-types tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts` | 16/16 pass | ✓ PASS |
| Projection whole-row assertions | `node --test --experimental-strip-types tests/orchestrators/reconcile/notify.test.ts` | 79/79 pass | ✓ PASS |
| Typed-vocabulary tests (successor to `tests/shared/notify.test.ts`) | `node --test --experimental-strip-types tests/shared/notify-reasons.test.ts tests/shared/notification-types.test.ts` | 75/75 pass | ✓ PASS |
| Entry-point PATH cases + CR-01 case | `node --test --experimental-strip-types tests/index.test.ts` | 20/20 pass | ✓ PASS |
| Reconcile-apply pairing (StateLockHeldError mapping's consumer) | `node --test --experimental-strip-types tests/orchestrators/reconcile/apply.test.ts` | 52/52 pass | ✓ PASS |
| Owner-module coverage, run alone | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts` | branches 67/67, functions 13/13, lines 554/554 | ✓ PASS |
| Debt-marker scan on all covered `extensions/` files | `grep -nE "TBD\|FIXME\|XXX"` | no matches | ✓ PASS |

`npm run check` was not re-run per the task's explicit instruction (it already passed at
this HEAD in this session, 7178 unit + 36 integration, exit 0). This report substitutes
targeted re-runs of every test file a criterion names.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| WCONV-01 | 116-01, 116-02, 116-04 | Widened scan promotes a grown-set record with no `update`/`reinstall` | ✓ SATISFIED | Truth #1; `REQUIREMENTS.md:55` marked `[x]`, states the corrected population bound, no "land on that side" clause survives |
| WCONV-02 | 116-01, 116-02 | Self-heal is one-time, reusing the existing stamp + growth test | ✓ SATISFIED | Truth #2; `REQUIREMENTS.md:56` marked `[x]` |
| WCONV-03 | 116-01, 116-03 | Convergence is visible via a closed-set reason token; silence otherwise | ✓ SATISFIED | Truth #4; `REQUIREMENTS.md:57` marked `[x]` |

No orphaned requirements: `grep -n "Phase 116" REQUIREMENTS.md` maps only WCONV-01..03,
all three still appear in plan `requirements:` fields.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | `grep -nE "TBD\|FIXME\|XXX"` across every `extensions/` file this report reads at HEAD returns nothing | — | No debt markers introduced |
| `ROADMAP.md` | criterion 4 text | Still literally names `tests/architecture/catalog-uat.test.ts`, which is now a directory, not a file | ℹ Info | Cosmetic drift in roadmap prose from an unrelated later restructuring; the underlying gate it describes (byte-paired catalog states) still exists and still passes under the new path. Not a phase-116 defect — no plan in this phase owns `ROADMAP.md`'s wording beyond the population-claim correction 116-04 made |

No 🛑 Blockers found.

### Human Verification Required

None. All four success criteria have independently-runnable automated evidence, re-run
directly against HEAD in this verification pass rather than trusted from the prior
report or from SUMMARY prose.

### Gaps Summary

None. Three main-branch merges (#181, #196, #202) and two same-day commits restructured
file layout, module names, and one test's entry point across this phase's owned files,
and one merge transiently dropped a lock-collision test twin that a same-day commit
re-landed. Every named truth, guard, and gate this phase's own verification pinned on
2026-09-09 was re-read and re-run against the current tree rather than assumed carried
forward, and all four still hold. The one artifact that could have hidden a silent gap —
a `node --test` invocation against a path that no longer exists, which exits 0 and prints
only a stderr warning — was caught by re-running the catalog gate against its actual
current location rather than trusting the aggregate pass count from a mixed valid/dead
file list.

---

*Verified: 2026-09-21*
*Verifier: Claude (gsd-verifier)*
