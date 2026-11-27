---
phase: 05-credential-surface
plan: 11
subsystem: credentials
tags: [system-git, credentials, device-flow, removal, git-process]

requires:
  - phase: 05-credential-surface
    provides: "05-06 stopped every throw of the print-mode refusal; 05-10 deleted platform/git-credential.ts, the last caller of the `credential` git subcommand"
provides:
  - "`stopsTheClone` stops a GitHub clone only after a `GitCommandError` whose kind is `git-missing` or `aborted`"
  - "`GitSubcommand` has no `credential` member and `GitRequest` has no `input` field, so every git run starts with stdin closed"
  - "`test/platform/git-process.test.ts` proves every property it proved before on `version --build-options` and on loopback https `ls-remote` runs"
affects: [05-12, 05-13, credential surface]

actuals:
  tokens: 12530
  tasks: 2
  commits: 2
plan_head_before: 8b83981905989bedaecb6330e70aa43053564446
plan_head_after: dc6446aff64025a863b43d4ad6ca274b11541c1f

tech-stack:
  added: []
  patterns:
    - "A real-git case that needs git to look for a credential lists a loopback https stand-in armed to ask for a password (`passwordRemote`)"
    - "Two git runs in flight together get their rejection handlers at once (`Promise.all` of the two `assert.rejects`)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/domain/github-transport.ts
    - extensions/pi-claude-marketplace/orchestrators/github-transport.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts
    - extensions/pi-claude-marketplace/platform/git-process.ts
    - test/shared/errors.test.ts
    - test/domain/github-transport.test.ts
    - test/domain/github-plugin-transport.test.ts
    - test/orchestrators/github-transport.test.ts
    - test/orchestrators/marketplace/clone-swap.test.ts
    - test/platform/git-process.test.ts
    - test/architecture/gate-targets.ts
    - test/architecture/no-credential-leak.test.ts

key-decisions:
  - "The two runs of the SG-PRC-03 planted-parent case are asserted with one `Promise.all`, because the ssh listing can reject while the test still awaits the other run, and Node then reports an unhandled rejection"
  - "The words table keeps both `version` rows: `version` (no option) and `version with an option` (`--build-options`), so the no-operand rule's option pass-through keeps a row"
  - "`platform/process-run.ts` keeps its generic `input` option, as the plan decided (OQ2 names only the git request)"

patterns-established:
  - "passwordRemote(t): the https stand-in with `acme/tools` armed for a password, plus its network-lane listing"

requirements-completed: [SG-AUTH-02, SG-AUTH-03]

coverage:
  - id: D1
    description: "A GitHub clone stops with no other attempt only after git is missing or the command was aborted; the print-mode refusal error and its stop branch are gone"
    requirement: SG-AUTH-02
    verification:
      - kind: unit
        ref: "test/domain/github-transport.test.ts, test/domain/github-plugin-transport.test.ts, test/orchestrators/github-transport.test.ts, test/orchestrators/marketplace/clone-swap.test.ts, test/shared/errors.test.ts (376 of 376)"
        status: pass
      - kind: other
        ref: "GUARD MUTATION: `|| failure.kind === \"aborted\"` dropped from stopsTheClone; 3 of 149 transport cases fail"
        status: pass
      - kind: e2e
        ref: "node scripts/cucumber.mjs --profile adapter features/marketplace/github-transport.feature features/plugin/github-transport.feature (32 of 32)"
        status: pass
    human_judgment: false
  - id: D2
    description: "No extension code can run `git credential` or write to git's stdin: the `credential` subcommand and `GitRequest.input` are gone, and D-SG-05's environment is unchanged"
    requirement: SG-AUTH-03
    verification:
      - kind: other
        ref: "npm run check:static (typecheck refuses a `credential` request)"
        status: pass
      - kind: unit
        ref: "test/platform/git-process.test.ts, test/platform/git.test.ts, test/architecture/no-credential-leak.test.ts, test/architecture/no-shell-out.test.ts (463 of 463)"
        status: pass
      - kind: other
        ref: "GUARD MUTATION: `credential.interactive=false` dropped; 46 of 208 git-process cases fail"
        status: pass
      - kind: e2e
        ref: "node scripts/cucumber.mjs --profile adapter features/marketplace/git-source.feature features/plugin/git-source.feature features/marketplace/credentials.feature (85 of 85)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The re-sampled real-git cases still fail when the hardening they guard is removed"
    verification:
      - kind: other
        ref: "mutations of platform/git-process.ts: no askpass hardening fails the three E10 cases; no safe.bareRepository=explicit fails the bare-layout case; no ceiling fails the enclosing-repository and planted-repository cases"
        status: pass
    human_judgment: false

duration: 31min
completed: 2026-11-27
status: complete
---

# Phase 5 Plan 11: No extension code can run git credential or hand git stdin Summary

**The Device Flow print-mode refusal error and the `stopsTheClone` branch that read it are deleted, so a GitHub clone stops early only for a missing git or an abort. `GitSubcommand` has no `credential` member and `GitRequest` has no `input` field, so `tsc` refuses any code that would run `git credential` or write to git's stdin. The git process tests prove the same properties on `version --build-options` and on loopback https listings.**

## Performance

- **Duration:** about 31 min
- **Started:** 2026-11-27T21:34:40Z
- **Completed:** 2026-11-27T22:05:30Z
- **Tasks:** 2 (2 commits)
- **Files modified:** 13 (0 created, 13 modified, 0 deleted)

PLAN_BASE: `8b83981905989bedaecb6330e70aa43053564446` (the worktree base).

## Accomplishments

- Task 1 (D-SG-27): the refusal error class, the first class of `shared/errors.ts`, is deleted with its doc. `stopsTheClone` is one expression: a `GitCommandError` whose kind is `git-missing` or `aborted`. `domain/github-transport.ts` imports only `GitCommandError`. Its header keeps the first two sentences of the stop-rule paragraph and drops the MODE-04 sentence. The `TransportPlan.after` doc and the comment above `stopsTheClone` name the two stop kinds. The `runAfter` doc in `orchestrators/github-transport.ts` says "an abort or no git". The `isUnreachable` doc of `clone-swap.ts` gives the invalid GitHub base as its example.
- Task 2 (OQ2, D-SG-28): `platform/git-process.ts` drops the `credential` member, its `SUBCOMMAND_RULES` row, `GitRequest.input` with its doc, and the launcher pass-through, so every git run starts with stdin closed. `NO_OPERANDS_RULE` stays for `version`. The header says git's stdin is closed and the launcher's timeout stops the process tree. The `-c` pairs sentence and the `config` doc cite D-SG-16 only, with the `insteadOf` rewrite as the example. The operand-rule comment says `version` takes no operands. The `operationOf` comment gives `rev-parse --verify` as its example. The D-SG-05 pairs and environment are unchanged.
- Leak gates: the git process entry of `CREDENTIAL_LEAK_TARGETS` says the module starts every git process and builds every git failure message. The spawn-site doc of `SHELL_OUT_EXEMPT_TARGETS` no longer names a credential launch. The git process scan of `no-credential-leak.test.ts` drops "a run's input" from its title, comment, regex, and message, and keeps the stdout check and its D-07-03 count. These are the two `gate-targets.ts` comments that the 05-10 SUMMARY left for this plan.

### Deleted files

None.

### Deleted symbols

`DeviceFlowUnavailableError` (`shared/errors.ts`); the refusal branch of `stopsTheClone`; the `credential` member of `GitSubcommand` and its `SUBCOMMAND_RULES` row; `GitRequest.input`. Test-side: `FILL` and `FILL_INPUT` (`test/platform/git-process.test.ts`).

### Deleted cases (Task 1)

- `test/shared/errors.test.ts`: `describe("DeviceFlowUnavailableError")` with `names the print refusal and its exact remedy`.
- `test/domain/github-transport.test.ts`: `MODE-04: gives no other transport after print mode refused the https attempt's sign-in`.
- `test/domain/github-plugin-transport.test.ts`: the `print mode refused the sign-in` row of `D-SG-18: gives no ssh retry when ${label}`.
- `test/orchestrators/github-transport.test.ts`: the `a retry whose sign-in print mode refused` row of `lets ${stop} reach the caller unchanged after the first attempt failed`.
- `test/orchestrators/marketplace/clone-swap.test.ts`: `D-SG-15: an ls-remote error that is no git failure, such as a Device Flow Pi cannot show, is thrown, not kept`. The `GHB-03: an invalid GitHub base from the ls-remote is thrown, not kept` case right after it proves the same branch.

### Deleted, re-sampled, and retitled cases in `test/platform/git-process.test.ts` (Task 2)

Deleted cases and rows (2 test runs fewer, 210 to 208; no case title was deleted):

- The `credential with an operand` row of `SG-PRC-01, E7: refuses ${label} before any lookup or spawn`. The `version with an operand` row stays and keeps the no-operand refusal.
- The `a network-lane credential` row of `D-SG-05: starts no ssh read and composes no ssh command for ${label}`. The `a network-lane version` row stays and now uses the shared `version --build-options` request.
- The stdin assertions `control.input()` and `control.inputEnded()` of `D-SG-04: spawns the first absolute git on PATH with the hardened argv and the neutral directory`. They were the only assertions about the removed input. The case stays and now asserts `stdio: ["ignore", "pipe", "pipe"]`.

Re-sampled onto `version --build-options` on the network lane, with no input. Argv tails, operation strings (`version --build-options`), and stdin `ignore` changed with it:

- `D-SG-04: spawns the first absolute git on PATH with the hardened argv and the neutral directory` (its stdout is `git version 2.43.0\n`)
- `SG-PRC-02, SG-PRC-03: forces the non-interactive values and keeps the user's git configuration`
- `SG-PRC-02: keeps the user's own proxy command, lazy-fetch, and replace-objects values`
- `SG-PRC-02: gives git an empty GIT_ASKPASS for ${label}` (3 rows)
- `SG-PRC-02: on Windows replaces every spelling of a forced variable and runs git.exe`
- `WR-03, D-SG-04: on macOS gives git-missing for a found git whose real path cannot be read`
- `SG-PRC-06: gives git-missing for ${label} and spawns nothing`
- `D-SG-04, SG-PRC-06: on macOS refuses ${label} as the xcrun shim before any spawn`
- `D-SG-04: reports a git that is gone at a spawn ${code} as git-missing and looks it up again`
- `D-SG-04: keeps a git that still exists after a spawn ENOENT and reports failed`
- `D-SG-04: reports ${label} as git-missing and looks git up again`
- `resolves a run that exits with 0 under a signal that never aborts`
- `resolves a run that exits with an allowed code`
- `SG-PRC-05: rejects ${label} as failed with redacted stderr`
- `WR-04: resolves a run whose stdout fills the capture exactly`
- `WR-04: rejects a run whose stdout outgrows the capture as failed`
- `SG-PRC-05: rejects a run that closes without an exit code or stderr as no-stderr`
- `SG-PRC-05: rejects a disallowed exit with the kind its C-locale stderr names`
- `D-SG-06: logs the git version once after a git-too-old failure`
- `D-SG-06: logs an unreadable version and keeps the git-too-old failure when the version read fails`
- `WR-06, D-SG-06: stops the version read when the failed request is cancelled`
- `SG-PRC-01: rejects a run past its timeout with the limit after stopping its process tree`
- `rejects an already-aborted request before any lookup or spawn`
- `rejects a run aborted while it runs as aborted after stopping its process tree`
- `rejects a run whose launcher throws as failed with that error as cause`
- `WR-03, E11: rejects as failed with the filesystem error of a working directory that does not exist`
- `SG-PRC-03: refuses a working directory whose parent holds the PATH delimiter`
- `SG-PRC-03: rejects as failed with the cause when the neutral directory cannot be made`
- `SG-PRC-01: starts git with closed stdin in the real path of the request's directory` (it ran a bare `credential` request before)
- `D-SG-02: gives a local-lane run and a network-lane run in flight together their own launch`
- `D-SG-05: passes ${label} to the network lane without the banned transports`
- `D-SG-05: on Windows keeps only the transports every spelling of GIT_ALLOW_PROTOCOL names`
- `D-SG-05: passes the config pairs of ${label} before the module's own pairs, so the last pair of a key is the module's`: the rows `a network-lane version` (was `a network-lane credential fill`) and `a request whose pair repeats a hardening pair`
- `SG-PRC-01, E7: places the operands of ${label} after Pi's options`: the `credential` row is now `version with an option` (`--build-options`)

Re-sampled onto an `ls-remote` of the in-file loopback `httpsFixture`, armed to ask for a password (`passwordRemote`). Each still asserts that the planted program never ran. The run now fails as `https-auth` with `no-credential`, exit 128, where it was asserted only as kind `https-auth`:

- `E10: never runs the user's ${label} program during a credential lookup` (core.askPass, GIT_ASKPASS, SSH_ASKPASS)
- `SG-PRC-03: never consults the credential helper of a repository enclosing the neutral directory`
- `SG-PRC-03: runs neither the credential helper nor the ssh command of ${layout} planted in the neutral directory's parent` (a repository, a bare repository layout). The `SSH_LIST` half is unchanged
- `SG-PRC-03: takes no bare repository layout for the working directory of a network-lane command`

Retitled:

- `SG-PRC-02, E10, D-SG-14: rejects an https remote that asks for a password as https-auth no-credential without askpass` is now `SG-PRC-02, E10: rejects ...`
- `D-SG-14, GAUTH-04: rejects an https remote that refuses the helper's credential as https-auth rejected` is now `GAUTH-04: rejects ...`

### The SG-PRC-03 planted-parent flake (`test/platform/git-process.test.ts:1821` at the base)

I found a likely cause. The case starts two runs together, the credential lookup and the `SSH_LIST` listing, then awaits the first and only after that attaches a handler to the second. If the ssh listing rejects first, nothing handles its rejection yet, and Node reports an unhandled rejection that fails the test. At the base, the first run was a local `credential fill` that usually settled first, so the order flipped only under load. After the re-sample, the first run is a loopback https listing, which is slower than the stub ssh. The failure then showed every time (2 of 2 rows, `GitCommandError ... ssh-auth`, on the first run of the re-sampled file). Both rejections are now asserted inside one `Promise.all`, so each run has its handler before either settles. The file passed 208 of 208 after that, and it passed again in the commit hook's all-pair run. I did not reproduce the original load failure, so this cause is likely, not proven.

### Mutations (all restored; `cmp` against the backup printed "restored")

- Task 1 GUARD: `|| failure.kind === "aborted"` dropped from `stopsTheClone`. These fail: `SG-SSH-02: gives no other transport when git fails as aborted`, `D-SG-18: gives no ssh retry when the command was aborted`, and `lets an aborted retry reach the caller unchanged after the first attempt failed` (3 of 149).
- Task 2 GUARD: `credential.interactive=false` dropped. 46 of 208 git-process cases fail.
- Re-sampled real-git cases (`--test-name-pattern 'E10|SG-PRC-03'`, 24 cases):
  - Without `core.askPass=` and `GIT_ASKPASS: ""`, 5 cases fail, all three E10 cases among them.
  - Without `safe.bareRepository=explicit`, the bare-layout case fails.
  - Without the `GIT_CEILING_DIRECTORIES` line, 6 cases fail, among them the enclosing-repository case and the planted-repository row.
  - The planted bare-layout row fails under neither single mutation. Both guards protect it, so each one alone is enough. That was true before the re-sample as well.

### Suite counts

- Task 1 unit verify (5 modules): 376 tests, 376 passed. The tracer gate re-ran the verify on the committed tree (interactive, `end-of-phase`, automated-only verify): 376 of 376.
- Task 1 cucumber verify, adapter (`marketplace/github-transport`, `plugin/github-transport`): 32 scenarios, 32 passed (463 steps).
- Task 1 direct coverage (`shared/errors.ts`, `domain/github-transport.ts`, `orchestrators/github-transport.ts`, `orchestrators/marketplace/clone-swap.ts`): exit 0, all at 100%.
- Task 2 `npm run --silent check:static`: the first run failed format:check on `test/platform/git-process.test.ts`. Prettier fixed it, and the rerun passed all seven steps.
- Task 2 unit verify (`git-process`, `git`, `no-credential-leak`, `no-shell-out`): 463 tests, 463 passed.
- Task 2 cucumber verify, adapter (`marketplace/git-source`, `plugin/git-source`, `marketplace/credentials`): 85 scenarios, 85 passed (1127 steps).
- Task 2 direct coverage (`platform/git-process.ts`): exit 0, 100%.
- Commit hooks: `npm run check:commit` passed on `98a87a8` and on `dc6446a`. On `dc6446a` it ran every pair's direct coverage, because the commit stages `test/architecture/gate-targets.ts`. `test:unpaired` ran in both hooks and passed.
- Plan verification, `features/marketplace features/plugin`: adapter 1539 scenarios, 1539 passed (18456 steps). Builtin 42 scenarios, 42 passed (544 steps). `git diff --stat 8b83981..HEAD -- features` is empty.

## Task Commits

1. **Task 1: A GitHub clone stops early only for a missing git or an abort, and otherwise tries its other transport, end to end** - `98a87a8` (refactor)
2. **Task 2: No extension code can run git credential or write to git's stdin** - `dc6446a` (refactor)

Neither task is a TDD task, so there is no RED commit.

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/errors.ts`: the refusal class is deleted
- `extensions/pi-claude-marketplace/domain/github-transport.ts`: `stopsTheClone` has two stop kinds, and its docs match
- `extensions/pi-claude-marketplace/orchestrators/github-transport.ts`, `orchestrators/marketplace/clone-swap.ts`: docs only
- `extensions/pi-claude-marketplace/platform/git-process.ts`: no `credential` subcommand, no `GitRequest.input`, docs match
- `test/shared/errors.test.ts`, `test/domain/github-transport.test.ts`, `test/domain/github-plugin-transport.test.ts`, `test/orchestrators/github-transport.test.ts`, `test/orchestrators/marketplace/clone-swap.test.ts`: refusal cases and rows deleted
- `test/platform/git-process.test.ts`: re-sampled (see above), with the `passwordRemote` helper and `REJECTS_WITHOUT_CREDENTIAL`
- `test/architecture/gate-targets.ts`, `test/architecture/no-credential-leak.test.ts`: leak gate comments, title, and regex

## Decisions Made

- The planted-parent case asserts both rejections in one `Promise.all` (see the flake section).
- The words table has a `version with an option` row next to the plain `version` row, so `NO_OPERANDS_RULE.words` keeps a row that passes options through.
- The two git-too-old cases name their first launch control `first` instead of `fill`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The planted-parent case left one run's rejection unhandled while it awaited the other**
- **Found during:** Task 2 (first run of the re-sampled file)
- **Issue:** Both rows of `SG-PRC-03: runs neither the credential helper nor the ssh command of ${layout} planted in the neutral directory's parent` failed with an unhandled `GitCommandError` (ssh-auth). The ssh listing rejected before the test attached its handler.
- **Fix:** Both `assert.rejects` calls run inside one `Promise.all`, with a one-line comment that says why.
- **Files modified:** `test/platform/git-process.test.ts`
- **Verification:** 208 of 208 cases passed, the mutation runs passed, and the hook's all-pair run passed.
- **Committed in:** `dc6446a`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix is test-only and likely also explains the earlier wave-gate flake. No behavior, scenario, or user-visible text changed.

## Issues Encountered

None beyond the deviation.

## Left for later

- Some lines outside this plan's file list still name the retired decision or the credential command. 05-12's sweep covers the D-SG-14 mentions in `extensions/` and `test/`, for example `shared/errors.ts`, `platform/git-failure-kind.ts`, `shared/git-failure-classifiers.ts`, and `test/shared/git-failure-classifiers.test.ts`. Two test samples still use `credential fill` as sample data: `test/shared/errors.test.ts` near line 815 (`operation: "credential fill"`) and `test/platform/git-failure-kind.test.ts:57` (the `credential fill with no helper` label). They are plain strings and run nothing. No acceptance grep names them.
- `orchestrators/auth-host.ts` keeps its hint text with `git credential approve`. That is the user's own command in the D-1-02 hint, and the plan keeps it.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-20 (mitigate): `GitSubcommand` has no `credential` member and `GitRequest` has no `input`, so `tsc` refuses any extension code that would run `git credential fill`, `approve`, `reject`, or `erase`, or write to git's stdin (D-SG-28, SG-AUTH-03). T-05-21 (mitigate): the guard criterion holds `failure.kind === "git-missing" || failure.kind === "aborted"`, and the transport scenarios (32 of 32) prove that every other failure still gets its other attempt once. T-05-SC (mitigate): no package was added, removed, or upgraded. No test reached a host other than a loopback stand-in, and no test ran a real ssh: the re-sampled cases use the in-file `httpsFixture` on 127.0.0.1 and the recording `ssh` script.

## Orchestrator actions

None. The plan asks for no `gsd-tools windows append`, and this plan leaves no stub, skipped test, or unrun verify.

## Next Phase Readiness

- 05-12 can sweep the remaining D-SG-14 and Device Flow mentions. Its `domain/github-transport.ts` and `platform/git-process.ts` lines from this plan already name only the current rules.
- 05-13 records OQ2 as taken: the `credential` git subcommand and `GitRequest.input` are gone.

## Self-Check: PASSED

- `98a87a8` and `dc6446a` are ancestors of HEAD. `git rev-list --count 8b83981..HEAD` is 2 before this SUMMARY commit.
- Task 1 acceptance: files naming `DeviceFlowUnavailableError` in `extensions` and `test`: 0. `print mode` in `domain/github-transport.ts`: 0. The stop-kind expression: 1.
- Task 2 acceptance: the `credential` member or row: 0. The input field: 0. Credential samples in the test: 0. `D-SG-14` in the module: 0. `D-SG-14` in the test: 0. Leak gate wording: 0. `credential.interactive=false`: 1.
- No file was deleted, so the Deleted files list is empty.

---
*Phase: 05-credential-surface*
*Completed: 2026-11-27*
