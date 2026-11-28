---
phase: 06-failure-message-parity
plan: 02
subsystem: debug-log
tags: [system-git, failure-messages, redaction, debug-log, d-sg-35, d-sg-33]

requires:
  - phase: 06-failure-message-parity
    provides: "redactShownText, the one per-line D-SG-35 pass (06-01)"
provides:
  - "one [git] debug line per failed git command: git <operation> failed (<kind>, exit code <code or none>)"
  - "hookDebugLog writes every line through redactShownText while the gate is open"
  - "call-site subject redaction in the GitHub transport and marketplace refresh fallback lines"
  - "RpcGitEnvironment.PI_CLAUDE_MARKETPLACE_DEBUG, ScenarioWorld.usePiWithDebugLog, ScenarioWorld.ownPiStarted"
  - "steps: pi runs with PI_CLAUDE_MARKETPLACE_DEBUG set; pi's debug log holds these git lines; pi's debug log does not contain"
  - "scenario: With the debug log on, a failed marketplace add logs the git command that failed and no secret of its URL"
affects: [06-03, 06-04, no-stderr remedy wording, debug-log readers]

actuals:
  tokens: 11873
  tasks: 2
  commits: 2
plan_head_before: e6158c4593040d342ca9a1cce22cf46fe02ab6b4
plan_head_after: ca4743ac90c376a525acc57d9cf7a61b9d1328a3

tech-stack:
  added: []
  patterns:
    - "Every debug line goes through the one redaction pass at the debug-log seam; call sites that name a subject redact it as well"
    - "A scenario that reads the debug log starts its own Pi with the debug variable; the read steps refuse the run's shared Pi"

key-files:
  created:
    - .planning/phases/06-failure-message-parity/06-02-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/platform/git-process.ts
    - extensions/pi-claude-marketplace/shared/debug-log.ts
    - extensions/pi-claude-marketplace/orchestrators/github-transport.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts
    - features/lib/pi-rpc.ts
    - features/support/world.ts
    - features/step_definitions/git-host.steps.ts
    - features/step_definitions/command.steps.ts
    - features/marketplace/failure-messages.feature

key-decisions:
  - "The [git] line is written in run()'s catch for every GitCommandError, so the internal git version read (which goes through execute) adds no line of its own"
  - "ScenarioWorld.ownPiStarted (scenarioPi set) is the guard of the two debug log steps; a profile Pi counts, the run's shared Pi does not"
  - "The tagged-line guard of the absence step matches any [tag] line, not only [git], so it also serves a later scenario whose log holds another tag"
  - "Debug expectations that held an absolute path now hold what the run shows: the path's last segment, written as a literal or as path.basename of the test's own variable"

patterns-established:
  - "D-SG-35 at the debug seam: hookDebugLog(detail, tag) logs [tag] redactShownText(detail)"

requirements-completed: [SG-ERR-02, SG-ERR-01]

coverage:
  - id: D1
    description: "A failed git command adds one [git] line naming its operation, kind, and exit code (or none), and never an operand"
    requirement: SG-ERR-01
    verification:
      - kind: unit
        ref: "test/platform/git-process.test.ts#D-SG-33, AUTH-09: logs one line naming the operation, the kind, and the exit code of a failed run, and no operand"
        status: pass
      - kind: unit
        ref: "test/platform/git-process.test.ts#D-SG-33: logs exit code none for a failed run that has no exit code"
        status: pass
    human_judgment: false
  - id: D2
    description: "With the debug log on, a failed url-source marketplace add logs exactly the [git] clone line and neither the URL password nor its query token"
    requirement: SG-ERR-02
    verification:
      - kind: e2e
        ref: "features/marketplace/failure-messages.feature#With the debug log on, a failed marketplace add logs the git command that failed and no secret of its URL"
        status: pass
    human_judgment: false
  - id: D3
    description: "hookDebugLog redacts URL credentials, query tokens, and absolute paths per line, and logs a clean detail byte for byte"
    requirement: SG-ERR-02
    verification:
      - kind: unit
        ref: "test/shared/debug-log.test.ts#D-SG-35"
        status: pass
    human_judgment: false
  - id: D4
    description: "Transport and refresh fallback lines show the subject redacted while the clone note keeps the raw subject key"
    requirement: SG-ERR-02
    verification:
      - kind: unit
        ref: "test/orchestrators/github-transport.test.ts#D-SG-35, D-SG-22: logs a subject's credential redacted and keeps the note under the raw subject"
        status: pass
      - kind: unit
        ref: "test/orchestrators/marketplace/clone-swap.test.ts#D-SG-35: a freshness check's fallback line shows the subject's credential redacted"
        status: pass
    human_judgment: false

duration: 31min
completed: 2026-11-28
status: complete
---

# Phase 6 Plan 02: Debug log redaction and failed-run line Summary

**Every failed git command now writes one `[git]` debug line, `git <operation> failed (<kind>, exit code <code or none>)`, and every debug line from all call sites goes through `redactShownText`, so the debug log names the failed command but shows no credential and no absolute path. A scenario proves it end to end for a URL that carries a password and a query token.**

## Performance

- **Duration:** about 31 min
- **Started:** 2026-11-28T17:17:30Z
- **Completed:** 2026-11-28T17:48:00Z
- **Tasks:** 2
- **Files modified:** 28
- **PLAN_BASE:** `e6158c4593040d342ca9a1cce22cf46fe02ab6b4`

## Accomplishments

- `platform/git-process.ts` `run()`: for every `GitCommandError`, `hookDebugLog(\`git ${error.operation} failed (${error.kind}, exit code ${error.exitCode ?? "none"})\`, "git")`, before the D-SG-06 version read. The module header's debug paragraph names the line (D-SG-33, AUTH-09).
- `shared/debug-log.ts`: `console.error(\`[${tag}] ${redactShownText(detail)}\`)` inside the existing gate. The header now says that the module imports the one pass and that no cycle forms. OBS-01, the gate rule, IL-2/IL-3, and the rule-pack note are kept.
- `orchestrators/github-transport.ts`: the probe-choice line and both fallback lines in `runAfter` show `redactCredentials(subject)`. `recordNote` still keys by the raw subject (D-SG-22), and the `subject` doc comment says so.
- `orchestrators/marketplace/clone-swap.ts`: `listRemoteHead`'s fallback line shows `redactCredentials(args.subject ?? plan.first.url)`. The subject passed to `cloneOverGitHubTransports` stays raw, with a comment that it is the notes key.
- Harness: `RpcGitEnvironment.PI_CLAUDE_MARKETPLACE_DEBUG` (copied only when set), the `ScenarioPiVariables` member, `ScenarioWorld.usePiWithDebugLog(value)`, and `ScenarioWorld.ownPiStarted`.
- Steps: `pi runs with the environment variable "PI_CLAUDE_MARKETPLACE_DEBUG" set to {string}` (git-host.steps.ts); `pi's debug log holds these git lines:` and `pi's debug log does not contain {string}` (command.steps.ts). Both read steps fail unless the scenario started its own Pi. The absence step also fails on a log with no tagged line (D-07-03).
- Scenario "With the debug log on, a failed marketplace add logs the git command that failed and no secret of its URL" in `features/marketplace/failure-messages.feature`. The run shows exactly one git line: `[git] git clone --depth failed (repository-not-found, exit code 128)`.

## Task Commits

1. **Task 1: With the debug log on, a failed git command logs one line that names it and no secret of its URL, end to end** - `f6d6a2a` (feat)
2. **Task 2: Every debug line goes through the one redaction pass, and the transport lines redact their subject at the call site** - `ca4743a` (fix)

## Task 1: red then green

- **RED:** I wrote the base version of `platform/git-process.ts` over the working file and ran `node scripts/cucumber.mjs --profile adapter features/marketplace/failure-messages.feature --name 'With the debug log on'`. Result: `1 scenario (1 failed)`, `12 steps (9 passed, 2 skipped, 1 failed)`. The step `pi's debug log holds these git lines:` failed because the actual table had only the header row, with no `[git] git clone --depth failed (repository-not-found, exit code 128)` row. The working file was restored right after.
- **GREEN:** `features/marketplace/failure-messages.feature` and `features/marketplace/failed-add.feature` under the adapter profile: `10 scenarios (10 passed)`, `127 steps (127 passed)`. The builtin profile selects none of these scenarios (`0 scenarios`).
- The unit RED was the three D-SG-06 cases, which failed once the line was added (their captured array gained the new line). They now spell the line out. The two new D-SG-33 cases pin the line with an exit code (a `clone --depth 1` request whose operands hold a URL with a password, logged as `git clone --depth failed (protocol-refused, exit code 128)`) and without one (a timeout, `exit code none`).
- Not a `type: tdd` plan. RED ran locally, and the test and the change went into one commit, because the hook runs typecheck and every architecture test.
- Tracer gate: auto mode is off and `human_verify_mode` is `end-of-phase`, and the tracer's verify is automated only. I re-ran it (unit test plus both feature files) before Task 2, and it passed.

## Test files the central pass changed (Task 2)

The plan named these files, and the run changed them: `test/orchestrators/plugin/uninstall.test.ts`, `test/bridges/hooks/event-router.test.ts`, `test/orchestrators/skill-alias-state.test.ts`, and `test/orchestrators/plugin/install-flow-ledger.test.ts`. The plan also named `test/bridges/mcp/builtin-description.test.ts`, but no assertion in it changed, so it was not edited.

The run also changed these files, which the plan did not list:

- `test/bridges/agents/grant-rewrite.test.ts`: the agent target shows `path.basename(renamed)`
- `test/orchestrators/command-invocation.test.ts`: the command file shows its basename
- `test/orchestrators/mention-attachments.test.ts`: eight D-PG11-06 lines show the mention's last segment; the dangling-link cause has the link path replaced by `link.md`
- `test/orchestrators/plugin/shared.test.ts`: the staging GC line shows `'staging'`
- `test/orchestrators/skill-invocation.test.ts`: the three fill-log patterns read `SKILL\.md`
- `test/bridges/hooks/async-rewake/pid-table.test.ts`: three cases check for the table's (or `_shared`'s) basename instead of its full path
- `test/bridges/hooks/async-rewake/registry.test.ts`: the refused command shows `scan`, not `/opt/hooks/scan`
- `test/domain/mcp-resolution.test.ts`: the three D-CF6-02 lines show `alpha`, not `/plugins/alpha`
- `test/orchestrators/marketplace/background-pass.test.ts`: `state.json at state.json`
- `test/orchestrators/plugin-options.test.ts`: `state.json at state.json`
- `test/orchestrators/plugin-path.test.ts`: the dropped and kept bins show `bin` (or `path.basename`). The metacharacter loop now carries the shown form of each character's path, which is what the pass leaves: `plug"in/bin`, `plug'in/bin`, `plug$in/bin`, ``plug`in/bin``, `bin` for the backslash, `plug\nin/bin`, and `plug\rin/bin`.

Each edit sets the line the run shows. No assertion was dropped or weakened to a substring check. The pid-table cases already used `includes`, and they keep that shape.

## Integration result

`npm run --silent test:integration` exited 0. No integration case depends on a full path in a debug line, so D-SG-35 was not narrowed.

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/git-process.ts`: the `[git]` failed-run line and the header paragraph
- `extensions/pi-claude-marketplace/shared/debug-log.ts`: the central `redactShownText` pass and the header
- `extensions/pi-claude-marketplace/orchestrators/github-transport.ts`: subject redaction in three debug lines, and the `subject` doc
- `extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts`: subject redaction in the refresh fallback line, and the notes-key comment
- `features/lib/pi-rpc.ts`, `features/support/world.ts`, `features/step_definitions/git-host.steps.ts`, `features/step_definitions/command.steps.ts`, `features/marketplace/failure-messages.feature`: the debug log harness, steps, and scenario
- Tests: `test/platform/git-process.test.ts`, `test/shared/debug-log.test.ts` (five D-SG-35 rows), `test/orchestrators/github-transport.test.ts` (one case), `test/orchestrators/marketplace/clone-swap.test.ts` (the fallback case is now a two-row table, the second row a subject with userinfo), plus the expectation updates listed above

## Decisions Made

- The `[git]` line is written in `run()` and not in `execute()`, so the D-SG-06 version read adds no line of its own. A `git-too-old` failure logs the failed-run line first and the version line after it.
- The debug log steps read `world.pi.stderrText` and are guarded by `ownPiStarted`, a new world getter that is true when the scenario started its own Pi. The run's shared Pi never has the debug log on.
- The clone-swap fallback case became a two-row table, not a second copy of the same body, so `fallow dupes` sees no new clone group.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] More debug expectations than the plan listed**
- **Found during:** Task 2
- **Issue:** The central pass cut absolute paths in debug lines that eleven unlisted test files assert, in addition to the four listed files that changed.
- **Fix:** Each expectation now holds the line the run shows. The plan allows this ("A file the run shows that is not listed is edited and named in the SUMMARY"). The files are listed above.
- **Verification:** `npm run test:modules` and `npm run test:unpaired` pass, as do all 37 debug-capture test files plus `test/shared/debug-log.test.ts` (2934 tests).
- **Committed in:** `ca4743a`

**2. Acceptance grep wording**
- **Found during:** Task 1
- **Issue:** The `pi's debug log` grep expects exactly 2 hits in `command.steps.ts`. My first assertion messages repeated the phrase.
- **Fix:** The messages now read "the debug log ...", so only the two step texts hold the phrase.
- **Committed in:** `f6d6a2a`

---

**Total deviations:** 2 (1 blocking, 1 wording)
**Impact on plan:** None changes scope. Both keep the locked rules.

## Issues Encountered

- The worktree had no optional-peer cache. I copied it from the main checkout (no network, no install).
- Prettier reformatted staged files during `pre-commit run`, and they were restaged before each commit.

## Verification

- Task 1: `node --test test/platform/git-process.test.ts`: 213 tests, all passed. Direct coverage for `git-process.ts`: 100%. Cucumber adapter on `failure-messages.feature` and `failed-add.feature`: 10 scenarios passed. `npm run --silent check:features`: exit 0. Acceptance greps: `failed (${error.kind}, exit code` 1, `PI_CLAUDE_MARKETPLACE_DEBUG` in pi-rpc.ts 2, `pi's debug log` in command.steps.ts 2, `debug log` in the feature 4.
- Task 2: the 37 debug-capture test files plus `test/shared/debug-log.test.ts`: 2934 tests, all passed. Direct coverage for `debug-log.ts`, `github-transport.ts`, and `clone-swap.ts`: 100%. `npm run --silent test:integration`: exit 0. `npm run --silent fallow`: exit 0. Greps: `redactShownText` 3, `Pure leaf module` 0, non-comment `console.` 1.
- Plan level: `check:static` passed inside both commit hooks (`npm run check:commit` passed). `npm run test:modules` passed after Task 2. `features/plugin/subagent-child.feature` plus `failure-messages.feature` under the adapter profile: 23 scenarios passed. `features/marketplace features/plugin` under the adapter profile: 1545 scenarios passed, 18549 steps passed.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Orchestrator actions

None. The plan asks for no `gsd-tools windows append`, and no stub, skipped test, or unrun verify remains.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The no-stderr remedy (D-SG-33, a later plan) can point at the debug log: every failed git command leaves a `[git] git <operation> failed (...)` line there.
- A later scenario can read the debug log with `pi's debug log holds these git lines:` and `pi's debug log does not contain {string}` after `pi runs with the environment variable "PI_CLAUDE_MARKETPLACE_DEBUG" set to "1"`.

---
*Phase: 06-failure-message-parity*
*Completed: 2026-11-28*

## Self-Check: PASSED
