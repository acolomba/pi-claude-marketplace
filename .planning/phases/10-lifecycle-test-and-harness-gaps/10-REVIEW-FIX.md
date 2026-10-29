---
phase: 10-lifecycle-test-and-harness-gaps
fixed_at: 2026-10-29T07:35:25Z
review_path: .planning/phases/10-lifecycle-test-and-harness-gaps/10-REVIEW.md
iteration: 6
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-10-29T07:35:25Z
**Source review:** `.planning/phases/10-lifecycle-test-and-harness-gaps/10-REVIEW.md`
**Iteration:** 6

Both final integrated review findings are fixed. The earlier evidence-binding
and integrated review fixes remain closed.

## Final Integrated Review Fixes

### CR-01: An apostrophe followed by whitespace terminates a quoted path early

**Status:** fixed: requires human verification
**Commit:** `d93cd43a` (`fix(redaction): retain paths across apostrophes`)
**Files modified:**

- `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts`
- `test/shared/redact-absolute-paths.test.ts`

The quoted-path branch now scans for the final diagnostic delimiter. It keeps
an apostrophe followed by a space inside the candidate when a later matching
quote closes a continued path. The scanner retains the existing handling for
Node errno messages, two-path diagnostics, state locks, POSIX paths, drive
paths, UNC paths, URLs, JSON pointers, and relative prose.

The RED owner cases showed that
`unlink '/tmp/O' Brien/秘密/secret.json'` leaked
`Brien/秘密/secret.json`. The GREEN cases require the complete output
`unlink 'secret.json'`, assert that the unique suffix is absent from a rebuilt
cause chain, and cover the unmatched-quote fallback. The complete owner module
passes 48 tests and the direct source-test pair passes 100% line, function,
and branch coverage.

### CR-02: A timed-out package-manager run resolves before its process group stops

**Status:** fixed: requires human verification
**Commit:** `bb50b890` (`fix(packages): await timeout escalation`)
**Files modified:**

- `extensions/pi-claude-marketplace/platform/package-manager.ts`
- `test/platform/package-manager.test.ts`
- `test/orchestrators/plugin/package-install.test.ts`

The runner now records a timed-out parent's close code without resolving the
run. It completes the existing SIGTERM and SIGKILL ladder, then resolves at the
existing final deadline. Normal close and launch-error paths still settle at
once. The deadline also gives asynchronous Windows `taskkill /T /F` its bounded
completion window before the caller can remove the work directory.

The RED fake settled immediately after parent close. The RED real-child case
also returned near the 300 ms timeout while a descendant that ignored SIGTERM
was still alive. The GREEN fake remains pending after parent close and after
SIGKILL until the final deadline. The real POSIX case returns only after the
300 ms timeout and two 400 ms grace intervals. The package-install owner case
proves that its work directory remains present until the runner settles and is
removed afterward.

## Earlier Validation Fix

### VAL-01: The move-diagnostics row cited evidence before the final ownership fixes

**Status:** fixed
**Commit:** `1c758fd3` — `test(coverage): bind final move diagnostics`
**Files modified:**

- `.planning/phases/10-lifecycle-test-and-harness-gaps/10-COVERAGE.md`
- `scripts/check-phase10-coverage.mjs`

The `XPH02-MOVE-DIAGNOSTICS` row now pins `741516af`, where the update warning
is owned by dependency `lib`, and binds all three final diagnostic scenarios.
The checker requires that row's exact three-scenario evidence set while
retaining its existing path, title, commit-existence, and committed-content
checks.

The RED proof showed that the old row passed 56/56 while its pinned scenario
still named root `app`. It also showed that a repinned row missing the newly
installed-dependency scenario still passed. After the fix, the missing-title
mutation fails the complete-set rule and the stale-commit mutation fails both
added titles against the cited commit.

## Prior Review Fixes

### CR-01: The wait-cap scenario exercises the hosted-download timeout, not the background gate

**Status:** fixed by integrated Phase 8 convergence
**Commit:** `4412c2cb` — `fix: gate background dependency settlement and verify cancellation`
**Files modified:**

- `features/lib/https-git-host/server.ts`
- `features/marketplace/background-update.feature`
- `features/step_definitions/marketplace/background-update.steps.ts`
- `test/orchestrators/marketplace/background-pass.test.ts`

The scenario now holds a streaming git smart-HTTP transfer that does not end at
the hosted-manifest fetcher's independent timeout. It proves the foreground
gate aborts the transfer before dependency settlement, with bounded elapsed
time and explicit cancellation evidence.

### CR-02: Set-normalized terminal output hides duplicate background notices

**Status:** fixed by integrated Phase 8 convergence
**Commit:** `7a436b05` — `test: distinguish aggregate background update notices`
**Files modified:**

- `features/lib/pi-tui.ts`
- `features/marketplace/background-update.feature`
- `features/step_definitions/marketplace/background-update.steps.ts`
- `test/architecture/pi-tui-notices.test.ts`

The final-screen same-name case remains, while a distinct `alpha`/`beta`
scenario requires one combined notice. The direct oracle tests reject separate
notices for distinct plugins without claiming that identical terminal redraws
are independent emission events.

### WR-01: The coverage checker does not bind evidence paths and titles to their cited commit

**Status:** fixed
**Commit:** `d4c3220b` — `fix(coverage): bind evidence to commits`
**Files modified:**

- `scripts/check-phase10-coverage.mjs`
- `.planning/phases/10-lifecycle-test-and-harness-gaps/10-COVERAGE.md`

The checker now reads every evidence path from its row's exact commit with an
argument-array `git show` call and requires the title in that committed
content. It retains the current-checkout containment, existence, and title
checks. Five rows now cite the exact integrated evidence commits: the network
guard decision, the split install fixture and root-commit owners, the git
cancellation scenario, and the distinct aggregate-notice scenario.

## Verification

Checks ran in the existing isolated Session A worktree at
`/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-a-14710`
with Node `v26.12.1`.

| Check | Result |
| --- | --- |
| Integrated `npm run check` before the checker-only fix | Passed at `28915add`: 1,131 scenarios, 11,584 steps, 309 direct LCOV records |
| Wait-cap git cancellation scenario | Passed: 1 scenario, 19 steps |
| Aggregate-notice oracle owner tests | Passed: 4/4 |
| Distinct `alpha`/`beta` PTY scenario | Passed: 1 scenario, 19 steps |
| Phase 10 coverage ledger | Passed: 56/56 rows |
| Negative commit-binding mutation | Rejected the context path absent from commit `7e2a3ca7`; mutation restored exactly |
| Final move-diagnostics scenarios | Passed: 3 scenarios, 48 steps |
| Missing final scenario mutation | Rejected by the `XPH02-MOVE-DIAGNOSTICS` complete-set rule |
| Stale ownership commit mutation | Rejected both added scenario titles at `291b2df1` |
| `node --check` | Passed for `scripts/check-phase10-coverage.mjs` |
| Prettier and ESLint | Passed for the checker |
| Fallow guard and audit | Passed; no introduced findings |
| Required pre-commit fixers | Passed |
| Commit hook, including `npm run check:commit` | Passed |
| `git diff --check` | Passed |

Final integrated review verification:

| Check | Result |
| --- | --- |
| CR-01 focused RED | Failed on the exact utility and cause-chain suffix leak |
| CR-01 owner tests | Passed: 48 tests |
| CR-01 direct coverage | Passed: 100% line, function, and branch coverage |
| CR-02 focused RED | Failed: promise settled before SIGKILL; real run returned before the two-grace bound |
| CR-02 platform owner tests | Passed: 40 tests, including the real parent and descendant |
| CR-02 package-install cleanup owner | Passed: work directory retained until runner settlement |
| CR-02 direct coverage | Passed for both changed source-test pairs at 100% |
| `npm run check:features` | Passed |
| Fallow guard | Passed for all changed source and test files |
| Fallow audit | Passed with no findings |
| Required pre-commit fixers | Passed for both commits |
| Commit hooks | Passed, including `npm run check:commit`, for both commits |

These checks ran in the existing Session A worktree with Node `v26.12.1`.

The orchestrator owns the final combined-tree gate, security recheck, clean
re-review, and goal verification on the unchanged integrated tree.

---

_Fixed: 2026-10-29T07:35:25Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 6_
