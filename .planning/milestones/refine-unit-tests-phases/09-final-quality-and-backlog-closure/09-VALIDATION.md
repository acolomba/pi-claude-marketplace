---
phase: "09"
slug: "final-quality-and-backlog-closure"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-11"
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `09-RESEARCH.md` §"Validation Architecture". Every runtime below was
> measured in this tree during research, not estimated — except the two whole-tree sweep
> figures, which are explicitly inherited from 08-08 and labelled as such.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node's built-in runner), Node v26.8.2, npm 11.19.1 |
| **Config file** | none — the glob lives in `package.json` `scripts.test` |
| **Quick run command** | `node --test tests/bridges/hooks/event-router.test.ts` (~10s) |
| **Structural command** | `node scripts/revalidation.mjs scope-impact --check` (0.18s measured) |
| **Full suite command** | `npm run check` (246s measured, exit 0) |
| **Whole-tree coverage** | `npm run test:coverage:direct:all` (~492s, **inherited** from 08-08, not re-measured) |
| **Unit suite size** | 6004 tests / 300 suites, 0 fail, 0 skipped, 34.2s (measured) |
| **Integration suite size** | 32 tests, 0 fail, 10.8s (measured) |

---

## Sampling Rate

- **After every task commit:**
  - any `.planning/` + `scripts/` change → `node scripts/revalidation.mjs scope-impact --check` (0.18s)
  - any `extensions/` change → `node scripts/test-coverage-direct.mjs <changed source>` (~4s)
  - always → `SKIP=trufflehog pre-commit run --files <changed files>` (the repo is a git
    worktree, so trufflehog cannot read the index and must be skipped)
- **After every plan wave:** `npm run typecheck && npm run lint && npm run fallow && npm test` (~186s)
- **Before `/gsd-verify-work`:** `npm run check` green
- **Phase gate (before change B lands):** `npm run check` **and**
  `npm run test:coverage:direct:all`, both on the final tree, real output recorded
- **Max feedback latency:** 4s for a source change, 0.18s for a seal change

---

## Per-Task Verification Map

> Task IDs are assigned by the planner. This map is keyed by the ordering step research
> established, whose boundaries follow the fail-closed units — a step is the smallest
> change that leaves every gate green.

| Step | Requirement | Behavior | Test Type | Automated Command | Fails when | File Exists |
|------|-------------|----------|-----------|-------------------|------------|-------------|
| 1 | CLOSE-01 | No static `readFile` remains in `event-router.ts` | structural | `grep -n 'readFile' extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` | any hit outside the comment at ~575 | ✅ |
| 1 | CLOSE-01 | `index.ts` wiring matches its source-text gate | unit | `node --test tests/index.test.ts` | non-zero exit, or "fail 1" or greater in the summary | ✅ |
| 1 | CLOSE-01 | The hooks lifecycle parameter-list regex still matches | unit | `node --test tests/architecture/hooks-lifecycle.test.ts` | non-zero exit | ✅ |
| 1 | CLOSE-01 | The staleness case no longer counts `currentGeneration()` | unit | `node --test tests/bridges/hooks/event-router.test.ts` | non-zero exit | ✅ |
| 1 | CLOSE-01 | The port survives both complexity gates | structural | `npm run lint && npm run fallow` | non-zero exit from either | ✅ (113.4s + 3.5s) |
| 2 | CLOSE-01 | The event-router pair stays complete after the port | coverage | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` | any reading below `branches 114/114, functions 43/43, lines 967/967` | ✅ (4.1s) |
| 2 | CLOSE-01 | All 230 pairs pass the strict gate on the changed tree | full-sweep | `npm run test:coverage:direct:all` | non-zero exit, or a pair count below 230 | ✅ (~492s inherited) |
| 2 | RCOV-02 | The regenerated pin matches the committed one | structural | regenerate, then `git diff --exit-code scripts/test-coverage-direct.pin.json` | non-zero exit **and** the diff is not an intended reading change | ✅ |
| 3 | CLOSE-01 | Seal change A keeps the carriers in agreement | structural | `node scripts/revalidation.mjs scope-impact --check` | any output other than `Scope impact valid: 40 records.` | ✅ (0.18s) |
| 3 | CLOSE-01 | The seal's own control suite still passes after change A | unit | `node --test tests/architecture/revalidation.test.ts` | fewer than 136 passing cases | ✅ (18.6s, 136 cases) |
| 4 | CLOSE-02 | The window ledger's write verbs are unblocked | structural | any `windows` write verb exits 0 | the drift-guard refusal naming rows 9/30 | ✅ (proven in scratch) |
| 4 | CLOSE-02 | Entries 19/21/22 are closed and the counts agree | structural | `node .claude/gsd-core/bin/gsd-tools.cjs windows status --pick ledger.open_count` | any value other than `19` | ✅ |
| 5 | CLOSE-01 | The complete suite passes on the final tree | full-suite | `npm run check` | non-zero exit | ✅ (246s) |
| 5 | CLOSE-01, CLOSE-02 | Seal change B keeps the carriers in agreement | structural | `node scripts/revalidation.mjs scope-impact --check` | any output other than `Scope impact valid: 40 records.` | ✅ |
| 5 | CLOSE-01 | The seal's control suite still passes after change B | unit | `node --test tests/architecture/revalidation.test.ts` | fewer than 136 passing cases | ✅ |

---

## Wave 0 Requirements

No new test infrastructure. `node:test` is in place, 6004 unit cases pass today, and every
command in this document runs in this tree right now.

Four **existing** test files need edits as part of their causing commit — these are not
Wave 0 scaffolding, they are the blast radius of the changes themselves:

- [ ] `tests/index.test.ts:787-793` — the two `index.ts` source-text assertions (step 1)
- [ ] `tests/bridges/hooks/event-router.test.ts:1917` — the staleness case rewrite (step 1)
- [ ] `tests/architecture/hooks-lifecycle.test.ts:395-408` — the `HooksHydrationReader` literal (step 1)
- [ ] `tests/architecture/revalidation.test.ts:1219` (step 3) and `:1026` (step 5)

One new artifact: `09-CLOSURE-LEDGER.md`. It is a planning document, not code, and needs no
owner test.

**Constraint on D-09-08's shape:** `npm run test:corresponding` demands a paired
`tests/**` file for any **new `.ts` module** under `extensions/`. If planning creates a
separate port module, it must also create its paired test. Keeping the port inside
`event-router.ts` avoids this entirely.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Each of the seven backlog items carries a terminal disposition in the one vocabulary | CLOSE-02 | A document-consistency claim no gate in this repo can express | Read `.planning/BACKLOG.md` against `09-CLOSURE-LEDGER.md`; assert every row's disposition is one of `implemented`, `evidence-only`, `superseded`, `deferred`, `unresolved` |
| No ledger row describes a coverage reading as assertion strength | CLOSE-02 (D-09-18) | A semantic claim about prose | Read every row of `09-CLOSURE-LEDGER.md` |
| The two named pin claims are verified rather than deferred | CLOSE-02 (D-09-16) | 08-04's deliverable D5 established that only a reader can judge whether a `reasons` entry is true | `09-RESEARCH.md` §6 is the reading; the ledger records the argument and its residual |
| The `direct-coverage` CI job runs green on a real PR | CLOSE-01 (D-09-17) | The GitHub-side ref creation the in-job base assertions exist to catch cannot be produced locally | Recorded as the one `unresolved` ledger row; settles when the PR runs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are listed under Manual-Only above
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (none — no new infrastructure)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s for the per-task commands
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
