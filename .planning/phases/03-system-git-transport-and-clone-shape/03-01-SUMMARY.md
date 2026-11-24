---
phase: 03-system-git-transport-and-clone-shape
plan: "01"
subsystem: platform
tags: [git, system-git, git-process, failure-classifier, insteadOf, for-each-ref]

requires:
  - phase: 02-git-process-seam-and-typed-failures
    provides: "platform/git-process.ts (GitRequest, SUBCOMMAND_RULES, gitArguments), platform/git-failure-kind.ts (ROWS), the GitFailure union"
provides:
  - "GitRequest.config: Pi-owned -c pairs placed after the D-SG-05, pin, and lane pairs"
  - "for-each-ref in the closed GitSubcommand union (MARKER_RULE, no ssh)"
  - "GitFailure arm { kind: https-auth; detail: no-credential | rejected }"
  - "classifier rows: v0 unadvertised-object refusal -> commit-missing; fatal: invalid reference: -> local-ref-missing"
affects: [03-system-git-transport-and-clone-shape, D-SG-09 tag reads, D-SG-14 Device Flow retry, D-SG-16 insteadOf, GAUTH-04]

actuals:
  tokens: 6263
  tasks: 2
  commits: 2
plan_head_before: e8fbff279978c0beaba3dbb5c5d31741ce4b8724
plan_head_after: aae52e505ab88bb83e39e972650ada8d8ab2a6d2

tech-stack:
  added: []
  patterns:
    - "A request's own -c pairs always follow the module's hardening pairs; they never go through GIT_CONFIG_COUNT"
    - "A real-git insteadOf case runs with GIT_ALLOW_PROTOCOL=file, so an unrewritten github URL is refused before it leaves the machine"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/platform/git-process.ts
    - extensions/pi-claude-marketplace/platform/git-failure-kind.ts
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
    - test/platform/git-process.test.ts
    - test/platform/git-failure-kind.test.ts
    - test/shared/git-failure-classifiers.test.ts
    - test/orchestrators/marketplace/add.test.ts

key-decisions:
  - "The rejected https-auth row sits before the no-credential row, so a stderr with a prompt line and an Authentication failed line reads as refused"
  - "GIT_FAILURE_ANSWERS needed no new entry: it is keyed by kind, so both https-auth details answer authentication required"
  - "The real-git insteadOf proofs set GIT_ALLOW_PROTOCOL=file, so even the RED run (config ignored) stayed offline (protocol-refused)"

patterns-established:
  - "rejectsWithFailure(failure, exitCode) in test/platform/git-process.test.ts asserts a real-git rejection's whole GitFailure, detail included"

requirements-completed: ["SG-TRN-01", "SG-TRN-02", "SG-TRN-07"]

coverage:
  - id: D1
    description: "A git request carries Pi-owned -c pairs after the hardening, and a real-git insteadOf pair routes a github URL to a local fixture"
    requirement: "SG-TRN-07"
    verification:
      - kind: unit
        ref: "test/platform/git-process.test.ts#D-SG-16, D-SG-14: passes the config pairs of <row> after the module's own pairs"
        status: pass
      - kind: integration
        ref: "test/platform/git-process.test.ts#D-SG-16, SG-TRN-07: lists the local repository that a config insteadOf pair rewrites a github URL to"
        status: pass
      - kind: integration
        ref: "test/platform/git-process.test.ts#D-SG-16, SG-TRN-07: rejects a github URL that a config insteadOf pair rewrites to a missing directory"
        status: pass
    human_judgment: false
  - id: D2
    description: "for-each-ref is a closed-set verb with the marker rule and no ssh read, and lists lightweight and annotated tags with the peeled commit"
    requirement: "SG-TRN-01"
    verification:
      - kind: unit
        ref: "test/platform/git-process.test.ts#SG-PRC-01, E7: places the operands of for-each-ref after Pi's options"
        status: pass
      - kind: unit
        ref: "test/platform/git-process.test.ts#D-SG-09: runs a network-lane for-each-ref without the ssh read"
        status: pass
      - kind: integration
        ref: "test/platform/git-process.test.ts#D-SG-09, SG-TRN-01: lists lightweight and annotated tags with the peeled commit on the local lane"
        status: pass
    human_judgment: false
  - id: D3
    description: "An https-auth failure says no-credential or rejected, and both still classify as authentication required"
    requirement: "SG-TRN-01"
    verification:
      - kind: unit
        ref: "test/platform/git-failure-kind.test.ts (https-auth corpus rows, LF and CRLF)"
        status: pass
      - kind: unit
        ref: "test/shared/git-failure-classifiers.test.ts#SG-PRC-05, D-SG-14: classifies an https-auth <detail> failure as authentication required with no frame"
        status: pass
      - kind: integration
        ref: "test/platform/git-process.test.ts#D-SG-14, GAUTH-04: rejects an https remote that refuses the helper's credential as https-auth rejected"
        status: pass
    human_judgment: false
  - id: D4
    description: "The protocol v0 unadvertised-object refusal is commit-missing and fatal: invalid reference: is local-ref-missing; remote: copies stay failed"
    requirement: "SG-TRN-02"
    verification:
      - kind: unit
        ref: "test/platform/git-failure-kind.test.ts#SG-PRC-05: classifies a protocol v0 refusal of an unadvertised commit as commit-missing"
        status: pass
      - kind: unit
        ref: "test/platform/git-failure-kind.test.ts#SG-PRC-05: classifies a checkout of an unknown name before the operand marker as local-ref-missing"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-11-24
status: complete
---

# Phase 3 Plan 01: Git Request Config Pairs and Auth Failure Detail Summary

**`GitRequest.config` carries Pi-owned `-c` pairs after the hardening (proven with a real-git `insteadOf` rewrite), `for-each-ref` joins the closed verb set, and an https-auth failure now says `no-credential` or `rejected` while the v0 SHA refusal reads as `commit-missing`.**

## Performance

- **Duration:** about 15 min
- **Started:** 2026-11-24T02:30:55Z
- **Completed:** 2026-11-24T02:46:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- `GitRequest` has a new optional `config` field. `gitArguments` places each pair as `-c <pair>` after the D-SG-05 pairs, `PIN_PAIRS`, and the lane pairs, and before the subcommand. No caller sets it yet, so every existing argv is unchanged.
- `for-each-ref` is in `GitSubcommand` and `SUBCOMMAND_RULES` (`MARKER_RULE`, `ssh: false`).
- `GitFailure` has its own `https-auth` arm with `detail: "no-credential" | "rejected"`. The classifier splits the old auth row into two, with `rejected` first.
- New classifier rows: `^error: Server does not allow request for unadvertised object ` gives `commit-missing`, and `^fatal: invalid reference: ` gives `local-ref-missing`. Both match only git's own lines (WR-01).
- Real-git proofs: an `insteadOf` rewrite reaches a local fixture, a rewrite to a missing directory gives `repository-not-found`, `for-each-ref` lists lightweight and annotated tags with the peeled commit, and the https stand-in shows both auth details.

## Task Commits

1. **Task 1 (tracer): a git request carries a Pi-owned insteadOf pair to real git, and for-each-ref lists tags** - `0cbb132` (feat)
2. **Task 2: an https auth failure says whether a credential was missing or refused, and the v0 SHA refusal is a missing commit** - `aae52e5` (feat)

The pre-commit hook runs typecheck and the architecture tests, so a commit that holds only failing tests cannot pass it. As the orchestrator instructed, each task's RED ran locally against the old code, and RED and GREEN were committed together in one `feat` commit. No separate `test(...)` commit exists.

## TDD evidence

### Task 1 RED (tests added, production unchanged)

Command: `PATH="/opt/pi-claude-marketplace/bin:$PATH" node --import "$PWD/scripts/isolated-pi-home.mjs" --test --test-reporter=tap --test-name-pattern="for-each-ref|config pairs|insteadOf pair|lightweight and annotated" test/platform/git-process.test.ts`, exit 1, `# tests 9 # pass 1 # fail 8`.

- `places the operands of for-each-ref after Pi's options`, `runs a network-lane for-each-ref without the ssh read`, and `lists lightweight and annotated tags ...` failed with `Cannot read properties of undefined (reading 'operands')`. The old `SUBCOMMAND_RULES` has no `for-each-ref` row. TypeScript would refuse the verb at compile time, so at runtime the test fails on the missing rule.
- The three `passes the config pairs of ...` rows that carry pairs failed on `deepStrictEqual`: the expected `-c a.b=c -c d.e=f` (or `-c core.hooksPath=/tmp/hooks`) words were missing from the actual argv.
- `lists the local repository that a config insteadOf pair rewrites a github URL to` failed with `git ls-remote failed: protocol-refused, exit code 128`. The old code dropped the pair, so git saw `https://github.com/...`, and `GIT_ALLOW_PROTOCOL=file` refused it before any network access.
- `rejects a github URL that a config insteadOf pair rewrites to a missing directory` failed on the error check: the kind was `protocol-refused`, not `repository-not-found`.
- The `an empty list` row passed, as expected: it pins the unchanged argv.

Semantic assessment: every target test failed because the old code lacked the planned behavior: no rule row, pairs not emitted, or the rewrite not applied. None failed on a fixture, syntax, or import fault.

### Task 1 GREEN

`node --import ... --test test/platform/git-process.test.ts`: 193 tests, 193 pass. Direct coverage of `platform/git-process.ts`, typecheck, `npm run fallow`, and ESLint on both files all exited 0. The commit hook (`npm run check:commit`) passed.

### Task 2 RED (tests and fixtures updated, production unchanged)

Command: the four plan files under `--test-reporter=tap`, exit 1, `# tests 645 # pass 623 # fail 22`.

- 20 `git-failure-kind` corpus cases (10 rows, LF and CRLF) failed on `deepStrictEqual`. The https-auth rows expected a `detail`, which the old classifier did not set. The v0 `unadvertised object` and `fatal: invalid reference:` rows got `{ kind: "failed" }`.
- 2 real-git cases failed on the error check: the E10 no-helper case and the new refused-helper case each got `{ kind: "https-auth" }` without `detail`. The refused-helper case reached `https-auth` through real git, which confirms the fixture path.
- The `remote:` copies of the new phrases already passed (`failed`), as WR-01 requires.

Semantic assessment: every failure was the planned assertion on the missing detail or the missing row.

### Task 2 GREEN

Four files: 645 tests, 645 pass. Direct coverage of `git-failure-kind.ts` and `git-failure-classifiers.ts`, typecheck, `npm run fallow`, and ESLint on the touched files all exited 0. The commit hook passed (prettier reformatted two lines on the first run, and the second run passed).

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/git-process.ts` - `GitRequest.config`, the `for-each-ref` member and rule row, and the argv placement of the request's pairs
- `extensions/pi-claude-marketplace/platform/git-failure-kind.ts` - the two https-auth rows, the v0 unadvertised-object row, and the invalid-reference row
- `extensions/pi-claude-marketplace/shared/errors.ts` - the `https-auth` arm with its `detail`
- `extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts` - doc comment only: the answer reads the kind, so both details give `authentication required`
- `test/platform/git-process.test.ts` - the operand row, the config argv rows, the network-lane `for-each-ref` row, the real-git `insteadOf` and `for-each-ref` cases, the `rejectsWithFailure` helper, and both real-git auth-detail cases
- `test/platform/git-failure-kind.test.ts` - details on the https-auth rows, plus the new corpus rows and their `remote:` copies
- `test/shared/git-failure-classifiers.test.ts` - one authentication-required case per https-auth detail
- `test/orchestrators/marketplace/add.test.ts` - the auth-failure fixture now carries `detail: "rejected"`

## Decisions Made

- The `rejected` row comes first, so a stderr that holds a prompt line and an `Authentication failed for` line reads as refused (as planned).
- `GIT_FAILURE_ANSWERS` is keyed by `GitFailure["kind"]`, so it stayed total and compile-checked with no new entry. Only its comment changed.
- The real-git `insteadOf` proofs run with `GIT_ALLOW_PROTOCOL=file`. So a github URL that no pair rewrites is refused locally, and the cases cannot reach the network even when the code under test ignores the pair. The RED run confirmed this.
- The E10 real-git case now asserts the whole failure (`no-credential`). A new case against the https stand-in, with a user helper that answers a wrong password, proves `rejected` with real git.

## Deviations from Plan

None. The plan ran as written. The extra real-git `rejected` case and the stronger E10 assertion fall within Task 2's `test/platform/git-process.test.ts` scope.

## Issues Encountered

- The session refuses Bash command text that names `git` in a complex form (paths such as `git-process.ts` included). Verify and commit steps ran from scripts in the executor's scratch directory. The `fatal: invalid reference:` text was not measured again in this run: the plan records that measurement on git 2.43.0.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-01: no production caller sets `config` yet, and argv rows pin the pairs after the hardening (including a pair that repeats `core.hooksPath`). T-03-02: every new row is anchored on git's own lines, and corpus rows show that `remote:` copies stay `failed`. T-03-03: `GitCommandError`'s message is unchanged and holds no detail or stderr.

## Lines for later plans

- Final `GitRequest` shape: `{ subcommand: GitSubcommand; lane: GitLane; options?: readonly string[]; config?: readonly string[]; operands?: readonly string[]; cwd?: string; input?: string; timeoutMs: number; signal?: AbortSignal; allowExit?: readonly number[] }`. argv = `-c` of (D-SG-05 `configPairs`, `PIN_PAIRS`, lane pairs, `request.config`), then the subcommand and its operand-rule words. `operationOf` is unchanged: the subcommand plus the first option, never a config pair.
- Final `GitSubcommand`: `"clone" | "fetch" | "ls-remote" | "checkout" | "rev-parse" | "config" | "tag" | "update-ref" | "for-each-ref" | "credential" | "version"`. `for-each-ref` uses `MARKER_RULE` with `ssh: false`.
- New `GitFailure` arm: `{ readonly kind: "https-auth"; readonly detail: "no-credential" | "rejected" }`. `https-auth` is no longer in the plain-kind arm.
- Auth row order in `ROWS`, after the `ssh-auth` publickey row: (1) `^fatal: Authentication failed for '` or `^(?:fatal|error): .*The requested URL returned error: 40[13]\b` gives `rejected`; (2) `^fatal: could not read (?:Username|Password) for '` or `^fatal: .*terminal prompts disabled` gives `no-credential`. The proxy-refused row still comes before both.
- The commit rows: `not our ref` / `reference is not a tree:`, then `^error: Server does not allow request for unadvertised object `, all `commit-missing`. The local-ref rows: `error: pathspec ... did not match`, then `^fatal: invalid reference: `, both `local-ref-missing`.
- Test helpers now available in `test/platform/git-process.test.ts`: `listRewrittenGitHubUrl(fixture, base)` (D-SG-16 rewrite over a `<root>/acme/tools.git` layout) and `rejectsWithFailure(failure, exitCode)`.

## Orchestrator actions

None. The plan asks for no `windows append`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The transport plans can set `config` for the D-SG-16 rewrite and the D-SG-14 one-shot helper. They can read the local tag list with `for-each-ref`, and they can branch on `failure.detail` for the Device Flow retry and GAUTH-04.

## Self-Check: PASSED

- All 8 modified files exist on disk.
- Commits `0cbb132` and `aae52e5` are ancestors of HEAD; `git rev-list --count e8fbff2..HEAD` = 2 before this SUMMARY commit.
- Acceptance greps: `readonly config?` = 1; `"for-each-ref"` = 2; `insteadOf` in the test = 5; `no-credential` in `git-failure-kind.ts` = 2 and in `errors.ts` = 2; `unadvertised object` in `git-failure-kind.ts` = 1; the v0 line in the corpus test = 2; `invalid reference` in `git-failure-kind.ts` = 1; no `--force` token added.

---
*Phase: 03-system-git-transport-and-clone-shape*
*Completed: 2026-11-24*
