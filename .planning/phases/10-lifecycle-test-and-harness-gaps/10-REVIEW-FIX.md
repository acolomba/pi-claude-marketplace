---
phase: 10-lifecycle-test-and-harness-gaps
fixed_at: 2026-10-29T08:52:46Z
review_path: .planning/phases/10-lifecycle-test-and-harness-gaps/10-REVIEW.md
iteration: 11
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-10-29T08:52:46Z
**Source review:** `.planning/phases/10-lifecycle-test-and-harness-gaps/10-REVIEW.md`
**Iteration:** 11

Iteration 11 fixes the complete boundary set after embedded quotes and bounds
unclosed paths before later diagnostic prose. The package
manager settlement fix and the earlier integration fixes remain closed.

## Iteration 11 Fixes

### CR-01: Embedded quotes followed by other boundaries leak paths

**Status:** fixed: requires human verification
**Commit:** `9ce72385` (`fix(redaction): accept all embedded quote boundaries`)
**Files modified:**

- `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts`
- `test/shared/redact-absolute-paths.test.ts`
- `test/shared/notification-present.test.ts`

The forward scan now applies the existing balanced-suffix state machine after
every embedded matching quote. It no longer limits continuation to ASCII
space and tab. The state machine still stops before balanced later quoted
values, so the earlier prose controls stay intact.

The RED run failed 56 cases: 54 utility cases across three platform forms,
two quote types, and nine unsupported boundary characters, plus one cause
case and one public-presentation case. The GREEN owners pass 275 tests. Both
direct pairs pass 100% line, function, and branch coverage. The first commit
hook rejected the nested matrix because it raised cognitive complexity. The
flattened case data passes Fallow and the complete normal hook.

### CR-02: An unclosed path consumes later slash-bearing prose

**Status:** fixed: requires human verification
**Commit:** `98683fb7` (`fix(redaction): bound unclosed quoted paths`)
**Files modified:**

- `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts`
- `test/shared/redact-absolute-paths.test.ts`
- `test/shared/notification-present.test.ts`

The delimiter scan now returns `undefined` when it finds no trustworthy
closing quote. The caller uses the first whitespace as the conservative end
of that unclosed path token. This keeps later slash-bearing prose, quoted
values, and URLs outside the redacted candidate while preserving the existing
simple and embedded-apostrophe unclosed-path cases.

The RED run failed five cases: three platform utility cases, one cause-chain
case, and one public-presentation case. The later quoted-value and URL control
already passed and remains covered. The final GREEN owners pass 281 tests.
Both direct pairs pass 100% line, function, and branch coverage. Type checking,
Fallow guard and audit, pre-commit fixers, and the normal commit hook pass.

## Iteration 10 Fix

### CR-01: The quote-role heuristic exposes valid multi-quote paths

**Status:** fixed: requires human verification
**Commit:** `893e91b2` (`fix(redaction): parse quoted path boundaries`)
**Files modified:**

- `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts`
- `test/shared/redact-absolute-paths.test.ts`
- `test/shared/notification-present.test.ts`

The parser collects matching quote positions once. A backward finite-state
pass records whether each suffix is balanced when it starts inside or outside
a separate quoted value. The forward pass keeps scanning when an apparent
delimiter leaves an unmatched closing quote and a path separator remains.
This rule keeps embedded quote characters inside the path. It still stops
before balanced quoted diagnostic values. An unclosed quoted path is redacted
through the end of the message instead of exposing a suffix after an embedded
quote.

The RED run failed 17 cases: 15 utility cases, one cause-chain case, and one
public-presentation case. The final utility matrix contains 72 combinations:
three platform forms, two quote types, three embedded-quote counts, and four
trailing-whitespace states. It retains the 33 later-value cases from iteration
9. The GREEN owner run passes all 207 focused tests. Both direct pairs pass
100% line, function, and branch coverage.

Type checking and Fallow guard and audit pass. The pre-commit fixers and the
normal commit hook pass, including `npm run check:commit`. These checks ran in
the existing Session A worktree with Node `v26.12.1` because
`workflow.use_worktrees` was false for the fixer.

## Iteration 9 Fix

### CR-01: The quote-role heuristic consumes slash-bearing prose

**Status:** fixed: requires human verification
**Commit:** `c6a1fab2` (`fix(redaction): distinguish quoted value boundaries`)
**Files modified:**

- `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts`
- `test/shared/redact-absolute-paths.test.ts`
- `test/shared/notification-present.test.ts`

An ambiguous apostrophe now continues a quoted path only when the text before
the next matching quote contains a separator and ends with non-whitespace path
text. A later opening quote is preceded by whitespace, so it cannot close the
path candidate. This rule keeps multi-word path components such as
`O' Mary Jane/秘密` and stops before later quoted diagnostic values.

The RED run failed 35 cases. The utility matrix covers POSIX, drive, and UNC
paths followed by slash-bearing prose. It uses every punctuation delimiter in
`isQuotedPathBoundary` and representative horizontal, line, and Unicode
whitespace values. Cause-chain and public-presentation cases prove the same
boundary. The GREEN owner run passes all 132 focused tests. Both direct pairs
pass 100% line, function, and branch coverage.

Type checking and Fallow guard and audit pass. The first normal commit hook
rejected a compact regular expression for super-linear backtracking. The
linear predicate form passes the required fixers and the complete normal
commit hook, including `npm run check:commit`. These checks ran in the existing
Session A worktree with Node `v26.12.1`.

## Iteration 8 Fix

### CR-01: The quote-continuation heuristic leaks paths and consumes prose

**Status:** fixed: requires human verification
**Commit:** `442ffb14` (`fix(redaction): disambiguate quoted path boundaries`)
**Files modified:**

- `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts`
- `test/shared/redact-absolute-paths.test.ts`
- `test/shared/notification-present.test.ts`

The scanner now treats an apostrophe followed by whitespace as an internal
path character only when the next matching quote is a valid closing delimiter.
This keeps multi-word path components such as `O' Mary Jane/秘密` inside the
redacted span. It also stops at a real closing quote before immediate prose
such as `docs/errors 'E_READ'`, because that next quote opens `E_READ`.

The RED run failed six cases across the utility, cause-chain, and public
presentation boundaries. The GREEN owner run passes all 97 focused tests. The
redaction and notification-presentation direct pairs each pass 100% line,
function, and branch coverage. Type checking, Fallow guard and audit,
pre-commit fixers, and the normal commit hook also pass.

## Iteration 7 Fixes

### CR-01: The quote-continuation heuristic consumes unrelated slash-bearing prose

**Status:** fixed: requires human verification
**Commit:** `b000050e` (`fix(redaction): bound quoted path continuations`)
**Files modified:**

- `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts`
- `test/shared/redact-absolute-paths.test.ts`
- `test/shared/notification-present.test.ts`

A quote followed by whitespace is now treated as an internal path apostrophe
only when the text immediately after it contains one path component followed
by a separator. The scanner retains the exact `O' Brien/秘密` continuation
without searching later prose for an unrelated slash. Exact POSIX, drive, and
UNC controls preserve the full diagnostic after a closed path. Cause-chain and
public notification-presentation cases prove that the same boundary reaches
user-visible diagnostics intact.

The RED owner cases produced `open 'errors 'E_READ'` for all three platform
forms. The GREEN owners pass 52 redaction tests and 39 notification-presentation
tests. Both direct source-test pairs pass 100% line, function, and branch
coverage.

### CR-02: Unreferenced escalation timers can leave a run unsettled forever

**Status:** fixed: requires human verification
**Commit:** `1b77dd7b` (`fix(packages): retain timeout deadline handles`)
**Files modified:**

- `extensions/pi-claude-marketplace/platform/package-manager.ts`
- `test/platform/package-manager.test.ts`

The initial timeout remains unreferenced while the live child keeps the run
reachable. Once timeout starts escalation, both the grace timer and final
settlement deadline stay referenced until `settle()` clears them. An isolated
Node probe supplies a referenced handle only long enough to reach SIGKILL. The
old code exits with status 13 and an unsettled top-level await; the fixed runner
reaches its bounded deadline and resolves.

The GREEN platform owner passes 41 tests and its direct pair passes 100% line,
function, and branch coverage. The package-install cleanup-order case and its
direct pair also pass, proving the work directory stays available until runner
settlement and is removed afterward. Fallow guards, pre-commit fixers, and both
normal commit hooks passed.

## Iteration 6 Review Fixes

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
| Iteration 11 CR-01 focused RED | Failed 56 cases across utility, cause, and public-presentation boundaries |
| Iteration 11 CR-02 focused RED | Failed 5 cases across utility, cause, and public-presentation boundaries |
| Final focused owners | Passed: 281/281 |
| Redactor direct coverage | Passed: 100% line, function, and branch coverage |
| Notification-presentation direct coverage | Passed: 100% line, function, and branch coverage |
| Type checking | Passed |
| Fallow guard and audit | Passed with no final findings |
| Required pre-commit fixers | Passed for both commits |
| Commit hooks | Passed, including `npm run check:commit`, for both commits |

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

_Fixed: 2026-10-29T08:52:46Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 11_
