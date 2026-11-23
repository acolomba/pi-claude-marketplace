---
phase: 06-hooks-and-auth
verified: 2026-11-22T14:20:00Z
status: passed
score: 9/9 must-haves verified
covered_files:
  - .planning/phases/06-hooks-and-auth/06-01-PLAN.md
  - .planning/phases/06-hooks-and-auth/06-01-SUMMARY.md
  - .planning/phases/06-hooks-and-auth/06-02-PLAN.md
  - .planning/phases/06-hooks-and-auth/06-02-SUMMARY.md
  - features/hook/additional-context.feature
  - features/hook/lifecycle.feature
  - features/hook/session.feature
  - features/lib/hook-files.ts
  - features/lib/pi-json-mode.ts
  - features/lib/pi-one-shot.ts
  - features/lib/turn-records.ts
  - features/marketplace/device-flow.feature
  - features/step_definitions/command.steps.ts
  - features/step_definitions/hook/session.steps.ts
  - features/step_definitions/project.steps.ts
  - features/step_definitions/session.steps.ts
  - features/support/world.ts
  - test/integration/auth-e2e.test.ts
  - test/integration/hooks-dispatch-end-to-end.test.ts
covered_digest: "v4:sha256:7f5723ae93e09cbc8a141f3039cf8af5dba4ff91bd47c15ce1ac0dafb99a9d40"
behavior_unverified: 0
overrides_applied: 0
human_verification_resolved:
  - item: "HOOK-E2E-04 deletion while the parity question is open"
    resolution: "User decision 2026-11-22: research upstream first. The integration case is restored (ea41268) with a header naming the open question; the scenario at additional-context.feature:230 stays."
---

# Phase 6: Hooks and Auth Verification Report

**Phase Goal:** Cucumber scenarios prove that hooks in both scopes still run after `apply` and after a load, that a reload before the first prompt clears buffered SessionStart context, that a hook dispatch creates no `.pi` directory, and that a print-mode sign-in refuses cleanly and a rejected credential is replaced; the integration cases they replace are gone.
**Verified:** 2026-11-22T14:20:00Z
**Status:** passed (all truths verified; the HOOK-E2E-04 governance item was resolved by the user on 2026-11-22: research upstream first, integration case restored in ea41268)
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC1: with hook plugins in both scopes, their hooks run after `/claude:plugin apply` and after a load; scenarios pass, fail under a break; `hooks-cross-scope-reconcile` is gone (ITMIG-12) | VERIFIED | `lifecycle.feature:70` (load: new session) and `:91` (apply) assert both the project `guard` and user `watch` PreToolUse rows with distinct plugin roots and data dirs. Background installs the project plugin. Break logs `phase06-plan01/X1-adapter.log` (both fail at `Then`, `restored=clean`) and `X2-adapter.log` (`:91` fails; `:70` the recorded survivor, X1 covers it). `test/integration/hooks-cross-scope-reconcile.test.ts` does not exist. |
| 2 | SC2: a `/reload` before the first prompt drops buffered SessionStart context, and a dispatch in a project with no `.pi` leaves none; scenarios pass, fail under a break; replaced cases gone (ITMIG-12) | VERIFIED | AC1 `additional-context.feature:230` now first asserts the startup `SessionStart` run of `primer` (6619dd8), then reloads the same terminal Pi and asserts call 1 holds only `hello there`. H4/H4b logs fail AC1 at `Then the model receives these calls:`; fixer re-proved H4 three times on the strengthened scenario (`fix-06/WR03-H4-*`). SS1 `session.feature:567` ends with `Then the project directory is empty` (`readdir(projectDir)` deep-equals `[]`, whole directory). W1 and U1 logs fail SS1. `hooks-additionalcontext-end-to-end.test.ts` deleted; `hooks-dispatch-end-to-end.test.ts` holds one test (`:172`, the throwing hydrate). |
| 3 | SC3: print-mode `marketplace add` needing sign-in refuses with its remedy and leaves no staged clone; a rejected stored credential is evicted and the next clone signs in through Device Flow (AUTH-07); replaced cases gone from `auth-e2e` (ITMIG-13) | VERIFIED | `device-flow.feature:331` (DF3) deep-equals exit 0, empty stdout, stderr = the remedy line, one 401, no sign-in request, and `the files of the project scope are unchanged` (whole scope). `:257` (DF1) asserts `authentication required`, two 401s, no sign-in, empty credential store, no record/checkout. `:289` (DF2) asserts the Device Flow prompt, 401 then 200, the sign-in requests, and the new stored token. `:355` (DF4) print `apply`, titled as a Pi gap (PROJECT.md:481). Break logs E1, E2, R1, R2, R3 fail these at `Then` steps. `auth-e2e.test.ts` holds one test (`:150`, cleanup fault injection). |
| 4 | F1: the release reads an unreaped hook process (ESRCH) as gone, as ENOENT | VERIFIED | `features/lib/hook-files.ts` `registeredHookMatch`/`processGroupOf` treat ENOENT and ESRCH as gone (hardened in 355388b, 1c6e3ff to kill a group whose leader exited). Repro logs `repro-f1-before.log` (throw) / `repro-f1-after.log` (`ok`); two full adapter runs plus later full runs passed with `async.feature:261`. |
| 5 | F2: the stand-in log reader does not fail on a half-written line | VERIFIED | `features/lib/turn-records.ts` `finishedLogLines` waits up to 1 s for an unfinished trailing line and parses complete lines only (d6136f4); baseline counts the partial line (66a3bbc). Repros in `fix-06b/` before/after. |
| 6 | A print-mode one-shot driver exists, and the json driver delegates to it (D-BG-601) | VERIFIED | `features/lib/pi-one-shot.ts` exports `OneShotLaunch`, `OneShotOutput`, `runOneShotPi` (spawns with `-p` for print, `detached`, group kill handed to `onRelease` before the wait). `pi-json-mode.ts` calls `runOneShotPi(` at :68 and has no `spawn` of its own. `command.steps.ts:158` `the user runs {string} in pi's print mode` sets `this.printModeRun`. |
| 7 | A routed one-shot Pi gets the git environment and the GitHub redirect together (D-BG-01, D-BG-1101) | VERIFIED | `world.ts:797-806` `oneShotPiLaunch()` returns `git: this.tuiEnvironment ?? piEnvironment` and `extensions: this.tuiExtensions`; `world.ts:1125-1140` sets both together and throws unless the extensions include `GITHUB_REDIRECT_EXTENSION`. All four new device-flow scenarios carry `Given pi runs with github's requests routed to the stand-ins`. |
| 8 | The kept internal cases are ITSCOPE-01-headed and pass | VERIFIED | Both headers name ITSCOPE-01 and the feature files. Ran here: `node --test test/integration/hooks-dispatch-end-to-end.test.ts test/integration/auth-e2e.test.ts` -> `tests 2, pass 2, fail 0`. |
| 9 | No product code changed; plan commits stayed in their declared files | VERIFIED | `git diff --stat 4a01e6d HEAD -- extensions/` is empty; `git diff --name-only 4a01e6d HEAD` lists nothing outside `features/`, `test/`, `.planning/`. Each plan commit (2963239, b054c45, 95e41f8, 7b7182d, d0d3b18, 1fbb71b, d5e7849, c5f196c) touched only its plan's `files_modified`/`files_deleted`. `git status --porcelain` is clean. |

**Score:** 9/9 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `features/lib/hook-files.ts` | ESRCH as gone | VERIFIED | Substantive, used by `world.ts` release (`stopHookScripts`) |
| `features/lib/turn-records.ts` | complete-line reader | VERIFIED | The 06-01 frontmatter `contains` text (`.slice(0, text.lastIndexOf(`) was replaced by the review fix `finishedLogLines`; same intent, stronger |
| `features/step_definitions/project.steps.ts` | `the project directory is empty` | VERIFIED | :33, whole-directory `readdir` |
| `features/hook/session.feature` | WR-05 scenario | VERIFIED | :567 |
| `features/hook/lifecycle.feature` | load and apply scenarios | VERIFIED | :70, :91 |
| `features/hook/additional-context.feature` | reload scenario | VERIFIED | :230 |
| `features/lib/pi-one-shot.ts` | one-shot runner | VERIFIED | 108 lines, imported by `pi-json-mode.ts` and `command.steps.ts` |
| `features/lib/pi-json-mode.ts` | delegates to runner | VERIFIED | :15 import, :68 call |
| `features/support/world.ts` | routed one-shot launch | VERIFIED | :797-806 |
| `features/step_definitions/command.steps.ts` | print-mode When and two Thens | VERIFIED | :158, :204, :211 |
| `features/marketplace/device-flow.feature` | AUTH-07 and MODE-04 scenarios | VERIFIED | :257, :289, :331, :355 |
| `test/integration/hooks-dispatch-end-to-end.test.ts` | one ITSCOPE-01 case | VERIFIED | 1 test |
| `test/integration/auth-e2e.test.ts` | one ITSCOPE-01 case | VERIFIED | 1 test |
| `hooks-cross-scope-reconcile.test.ts`, `hooks-additionalcontext-end-to-end.test.ts` | deleted | VERIFIED | absent; no stale references outside `.planning/` |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `lifecycle.feature` | `bridges/hooks/event-router.ts`, `orchestrators/reconcile/apply.ts` | cross-scope rebuild, `closeScopePass` | WIRED | X1/X2 edits at those sites fail LC1/LC2 |
| `session.feature` | `event-router.ts` `prepareSessionStartDataDirs`, `hydrateTargets` | W1, U1 | WIRED | both fail SS1 |
| `additional-context.feature` | `bridges/hooks/runtime.ts` buffer, reload return | H4, H4b | WIRED | both fail AC1; H4a control survives as planned |
| `device-flow.feature` | `platform/git-auth-callbacks.ts`, `orchestrators/auth-host.ts`, `marketplace/add.ts` | E1-E3, R1-R3 | WIRED | all fail new scenarios at `Then` |
| `command.steps.ts` / `pi-json-mode.ts` | `pi-one-shot.ts` | `runOneShotPi(` | WIRED | grep-confirmed |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| The 8 new scenarios have every step defined | `cucumber-js --profile adapter --dry-run` on the 8 `file:line` targets | `8 scenarios (8 skipped)`, 133 steps, no undefined/ambiguous | PASS |
| Builtin profile selects none of the four files' scenarios (DUAL-02) | `cucumber-js --profile builtin --dry-run` on the four feature files | `0 scenarios`; no tags in any of the four files | PASS |
| Kept integration cases pass | `node --test` on the two trimmed files | 2 pass, 0 fail | PASS |
| New scenarios pass on the final code | fixer full adapter run (`fix-06b/final-full-adapter.log`) | `2267 scenarios (2267 passed)`, exit 0; `git diff 5dc92b2 HEAD -- features test extensions` is empty, so it covers the final code | PASS (recorded) |
| Red-proof logs | re-parsed both plans' break logs with `check-red.mjs` | failure lists match the SUMMARYs; the final git step fails only because the plan worktrees are removed (`spawnSync git ENOENT`); recorded `red.log` files say `RED-PROOFS OK` | PASS (recorded) |

I did not execute the scenarios myself: the orchestrator's gate on 31aef67 was running `cucumber --parallel 4` on the same 4-CPU host, and an extra run risked timeouts in that gate.

### Probe Execution

No `scripts/*/tests/probe-*.sh` exists, and the plans declare none. Step 7c: not applicable.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| ITMIG-12 | 06-01 | hooks in both scopes after apply and load; reload drops buffered SessionStart context; no `.pi` from a dispatch | SATISFIED | Truths 1, 2 |
| ITMIG-13 | 06-02 | print-mode add refuses, no staging; rejected credential evicted, new Device Flow sign-in | SATISFIED | Truth 3 |

No orphaned requirements: REQUIREMENTS.md maps only ITMIG-12 and ITMIG-13 to Phase 6, and both are claimed. Their checkboxes still read Pending; the orchestrator updates them at phase completion.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (phase diff) | - | TBD/FIXME/XXX/TODO/HACK | none | no markers in added lines |
| `features/lib/hook-files.ts` | 815-833 | REVIEW IN-05: one throwing stop aborts the rest of the release | Info | rare conditions; carried by the review |
| `features/step_definitions/hook/session.steps.ts` | 564-582 | REVIEW IN-06: inner waits sum above the default step timeout | Info | pre-existing |

### Human Verification Required

### 1. HOOK-E2E-04 deletion under the milestone parity rule

**Test:** Read ROADMAP "Milestone rules: Upstream parity", CONTEXT [HOOK-E2E-04 parity], and `features/hook/additional-context.feature:230`. Decide whether the documented `/reload` drop of buffered SessionStart context may be pinned now, with its integration case deleted, or whether the case must stay until upstream behavior is checked.
**Expected:** An override accepting the deletion, or a request to research Claude Code's `/reload-plugins` handling first (then restore the case from 547ca25 or record a BACKLOG entry).
**Why human:** The rule says such a case "stays until the user answers". The decision to pin it was made autonomously, not by the user. Whether the drop diverges from upstream at all is an upstream fact.

If the user accepts, add to this file's frontmatter:

```yaml
overrides:
  - must_have: "A /reload before the first prompt drops the SessionStart context buffered before it"
    reason: "AC1 pins the behavior docs/hooks-compatibility.md:449 documents; the parity question goes to the milestone end"
    accepted_by: "<user>"
    accepted_at: "<ISO timestamp>"
```

### Gaps Summary

No gaps. Each roadmap success criterion has scenarios in the code. Every new scenario fails under a recorded, reverted break at a `Then` step. The integration cases they replace are deleted, and no product code changed. One governance item is open: the HOOK-E2E-04 case was deleted although the milestone rule keeps a possible unlicensed-divergence case until the user answers. The orchestrator's running gate on 31aef67 gives the builtin-profile verdict for the iteration-2 harness changes. This phase's new scenarios select 0 under builtin, so that verdict concerns regressions in other scenarios, not this goal.

---

_Verified: 2026-11-22T14:20:00Z_
_Verifier: Claude (gsd-verifier)_
