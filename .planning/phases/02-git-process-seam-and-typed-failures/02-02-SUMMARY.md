---
phase: 02-git-process-seam-and-typed-failures
plan: "02"
subsystem: errors
tags: [git, typed-errors, closed-set-reasons, notifications, json-schema]

requires:
  - phase: 01 (system-git)
    provides: hermetic git test stand-ins (not used directly here)
provides:
  - "`git missing` member of the closed Reason set (D-SG-07), with wire, schema, docs, and locks at 82"
  - "`GitFailure` closed union (22 kinds) and `GitCommandError` in shared/errors.ts (SG-PRC-05)"
  - "`instanceof GitCommandError` rung in classifyGitFailure mapping every kind to a closed-set reason"
  - "`marketplace add` failed child row with the requirement text for a git-missing failure (SG-PRC-06)"
  - "D-SG-07 Key Decisions row in PROJECT.md"
affects: [02-03 git process module, 02-05 git-required gate, transport swap phase, failure-message wording phase]

actuals:
  tokens: 13987
  tasks: 3
  commits: 3
plan_head_before: 6c342521c28e874354a0e98522353c306392be1c
plan_head_after: 613d9ed6de1586ac50dc6730d62415e0dd8aa5f7

tech-stack:
  added: []
  patterns:
    - "Exhaustive kind mapping through a `satisfies Record<kind, answer>` table plus a small no-default switch on the answer, which keeps a new kind a compile error under fallow's cyclomatic ceiling of 20"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - schema/claude-plugin.schema.json
    - docs/json-output.md
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - docs/output-catalog.md
    - .planning/PROJECT.md
    - test/architecture/notify-closed-set-locks.test.ts
    - test/architecture/compat-01-no-expansion.test.ts
    - test/shared/notification-types.test.ts
    - test/shared/notify-reasons.test.ts
    - test/shared/errors.test.ts
    - test/shared/git-failure-classifiers.test.ts
    - test/orchestrators/marketplace/add.test.ts
    - test/orchestrators/plugin/install.messaging.test.ts

key-decisions:
  - "D-SG-07: a git-missing failure has its own closed-set reason, `git missing`; every GitCommandError kind maps to a closed-set reason"
  - "The kind-to-reason map is a `satisfies Record` table plus a no-default switch, not one 22-case switch, because fallow's cyclomatic ceiling (20) rejects the single switch; exhaustiveness is still enforced by the compiler"
  - "A `remote-ref-missing` failure follows `rule.missingRef` only, so a rule with `unknown` but no `missingRef` leaves it unclassified, as the isomorphic-git NotFoundError rung does"

patterns-established:
  - "GitCommandError message: only git-missing and timeout have their own text; every other kind reads `git <operation> failed: <kind>[, exit code N]`, never stderr"

requirements-completed: ["SG-PRC-05", "SG-PRC-06"]

coverage:
  - id: D1
    description: "`git missing` is a closed-set Reason member, enrolled in the wire map, the FailureReason group, the regenerated JSON schema, the JSON-output reference, and the 82-member locks"
    requirement: "SG-PRC-06"
    verification:
      - kind: unit
        ref: "test/architecture/notify-closed-set-locks.test.ts, test/architecture/compat-01-no-expansion.test.ts, test/architecture/wire-schema.test.ts, test/architecture/json-output-docs.test.ts, test/shared/notification-types.test.ts, test/shared/notify-reasons.test.ts, test/shared/notification-wire.test.ts (298 pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "GitCommandError carries a closed GitFailure kind, redacted stderr, a null-or-number exit code, and a message that never holds stderr; git-missing messages use upstream's requirement text"
    requirement: "SG-PRC-05"
    verification:
      - kind: unit
        ref: "test/shared/errors.test.ts#GitCommandError (143 pass); npm run test:coverage:direct -- shared/errors.ts (100%)"
        status: pass
    human_judgment: false
  - id: D3
    description: "classifyGitFailure maps every GitCommandError kind to a closed-set reason under each rule, frames an HTTP status as `{status} on {url}`, and sees through a cleanup leak"
    requirement: "SG-PRC-05"
    verification:
      - kind: unit
        ref: "test/shared/git-failure-classifiers.test.ts (109 pass); npm run test:coverage:direct -- shared/git-failure-classifiers.ts (100%)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A git-missing marketplace add (url and GitHub sources) renders a failed child row with {git missing} and the requirement text; an auth kind keeps the bare row; a plugin install row carries {git missing} with its cause"
    requirement: "SG-PRC-06"
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/add.test.ts#SG-PRC-06, test/orchestrators/plugin/install.messaging.test.ts#SG-PRC-06, test/architecture/catalog-uat/catalog-contract.test.ts (285 pass); npm run test:coverage:direct -- orchestrators/marketplace/add.ts (100%)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The user-visible add and install output with a real missing git (no error raises GitCommandError until later plans)"
    verification: []
    human_judgment: true
    rationale: "No production code raises GitCommandError yet; the cucumber scenarios for SG-PRC-06 land with the git process module and the git-required gate, and the roadmap plans a manual check on macOS and Windows."

duration: 25min
completed: 2026-11-23
status: complete
---

# Phase 2 Plan 02: Typed git failures and the `git missing` reason Summary

**`GitCommandError` with a closed 22-kind `GitFailure` union, mapped kind by kind to the closed reason set in `classifyGitFailure`, plus a new `git missing` reason that a failed `marketplace add` shows with upstream's requirement text on its cause line.**

## Performance

- **Duration:** about 25 min
- **Started:** 2026-11-23T13:45:14Z
- **Completed:** 2026-11-23T14:10:02Z
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments

- `git missing` joined the closed `Reason` set at its tail (D-SG-07): the type, the wire map, `FailureReason`, the regenerated schema (9 lines), `docs/json-output.md`, and the locks (82 members).
- `GitFailure` and `GitCommandError` landed in `shared/errors.ts` (SG-PRC-05). Stderr is redacted with `redactCredentials`, and the message never holds stderr, an operand, or stdin.
- `classifyGitFailure` narrows a `GitCommandError` with `instanceof` right after `withoutCleanupLeaks`, before the `PinnedCommitMissingError` rung, and maps each kind. `classifyGitHostFailure` and `classifyGitSourceAccessFailure` include `git missing` in their return unions. No caller needed an edit, because each one types the reason as `ContentReason`.
- `marketplace add` keeps the cause row for a git-missing failure, and `unwrapAddError` passes a `GitCommandError` through (SG-PRC-06). D-SG-07 is recorded in PROJECT.md, and the reason is described in `docs/output-catalog.md`.

## Final `GitFailure` member list

- `{ kind: "git-missing"; detail: "not-found" | "macos-shim" | "batch-launcher" }`
- `{ kind: "timeout"; timeoutMs }`
- `{ kind: "network"; httpStatus?; curlCode? }`
- `{ kind: "repository-not-found"; httpStatus? }`
- bare kinds: `git-too-old`, `aborted`, `https-auth`, `ssh-auth`, `ssh-host-key-unknown`, `ssh-host-key-changed`, `proxy-refused`, `remote-ref-missing`, `local-ref-missing`, `commit-missing`, `pin-mismatch`, `refused-input`, `protocol-refused`, `dubious-ownership`, `not-a-repository`, `remote-error`, `no-stderr`, `failed`

Kind to reason: `git-missing` gives `git missing`. The four auth and host-key kinds give `authentication required`. `network` gives `rule.notFound` for 404 or 410, `network error` for another status, and `network unreachable` with no status. `timeout` gives `network unreachable`. `repository-not-found` gives `rule.notFound`. `remote-error` gives `network error`. `commit-missing` and `pin-mismatch` give `source missing`. `remote-ref-missing` gives `rule.missingRef`. `local-ref-missing` stays unclassified. Every other kind gives `rule.unknown` when the rule sets it. A failure with an HTTP status gets the `{status} on {url}` frame when the caller passes the URL.

## Task Commits

1. **Task 1: Make git missing a closed-set reason from the type to the published JSON schema** - `0b49c23` (feat, tracer)
2. **Task 2: Add GitCommandError with its closed failure union and map every kind in classifyGitFailure** - `f3d3c76` (feat, TDD: RED run locally, then RED+GREEN in one commit)
3. **Task 3: Keep the requirement text on a git-missing marketplace add row and record D-SG-07** - `613d9ed` (feat, TDD: RED run locally, then RED+GREEN in one commit)

Tracer gate (Task 1): the run is interactive, the mode is `end-of-phase`, and the verify block is automated only. Both verify commands were green on the committed tree, and the hook's `check:commit` passed, so execution expanded to Task 2.

## TDD evidence

The commit hook runs typecheck and every architecture test, so it rejects a commit that holds only failing tests. Each RED below ran locally against the old source. RED and GREEN were then committed together, one commit per task. `workflow.tdd_mode` is off, so no `test(...)` gate commit was required.

**Task 2 RED, classifier** (old `git-failure-classifiers.ts`, new `errors.ts`; `node --test --test-reporter=tap test/shared/git-failure-classifiers.test.ts`): exit 1, 109 tests, 85 pass, 24 fail. Each failure is a target case failing on its `deepStrictEqual` assertion. For example, "D-SG-07: classifies a git-missing failure as git missing" got `{ reason: 'network error' }` from the old `rule.unknown` fallback, and `classifyGitHostFailure` of git-missing got `undefined`. Semantic assessment: valid RED. The old ladder has no `GitCommandError` rung, so each new kind falls through to the generic fallback. The 18 `rule.unknown` rows and their plugin-clone twins passed in RED, because the old fallback already gives those answers. They pin that the new rung keeps them.

**Task 2 RED, errors** (old `errors.ts`; `test/shared/errors.test.ts`): exit 1, `SyntaxError: The requested module '.../shared/errors.ts' does not provide an export named 'GitCommandError'`. Semantic assessment: this is a load failure, which is the only RED a new exported class can have. It confirms the class did not exist. It is not an assertion RED.

**Task 2 GREEN:** errors 143/143 pass, classifier 109/109 pass. Direct coverage is 100% for both pairs. typecheck, fallow, and eslint (`--max-warnings 0`) are clean.

**Task 3 RED** (old `add.ts`; `--test-name-pattern 'SG-PRC|D-SG-07'` over the add and install messaging tests): exit 1, 5 tests, 2 pass, 3 fail. Both git-missing add cases got the bare row `'A marketplace operation has failed.\n\n⊘ https://gitlab.example.com/team/private-mp [project] (failed) {git missing}'` with no cause line. The cause-carrying case got `reason: 'source missing'`: the old `unwrapAddError` replaced the `GitCommandError` with its ENOENT cause. Semantic assessment: valid RED on the planned assertions. The auth-row case and the install messaging case passed in RED, because they pin behavior that Task 2 already provides and that this task must not change.

**Task 3 GREEN:** 285/285 pass, including `catalog-contract.test.ts`. Direct coverage of `add.ts` is 100%. typecheck, fallow, and eslint are clean.

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notification-types.ts`, `notification-wire.ts`, `notify-reasons.ts` - the `git missing` member and its enrollments
- `schema/claude-plugin.schema.json` - regenerated with `npm run schema:generate`
- `docs/json-output.md` - Reason enumeration line
- `extensions/pi-claude-marketplace/shared/errors.ts` - `GitFailure`, `GitCommandError`, `gitCommandMessage`
- `extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts` - the `GitCommandError` rung, `GIT_FAILURE_ANSWERS`, the status frame helpers, and the new header
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` - pass-through in `unwrapAddError`, and `showsAddCause` for the cause row
- `docs/output-catalog.md` - one sentence on `{git missing}` in the reasons paragraph
- `.planning/PROJECT.md` - D-SG-07 Key Decisions row after D-SG-06
- tests: the closed-set locks, `errors.test.ts`, `git-failure-classifiers.test.ts`, `add.test.ts`, `install.messaging.test.ts`

## Decisions Made

- The kind-to-reason map is a table checked with `satisfies Record<Exclude<kind, "network" | "repository-not-found">, answer>`, plus a no-default switch over the answer. `network` and `repository-not-found` are narrowed first, so no unreachable branch exists. The compiler still rejects a new kind that has no answer.
- `gitCommandMessage` uses two `if` checks (git-missing, timeout) and one generic return instead of a 22-case switch. Every other kind takes the generic form by design, so the generic return already covers a new kind.
- `remote-ref-missing` under a rule with `unknown` but no `missingRef` stays unclassified. This matches the isomorphic-git `NotFoundError` rung and the truth "remote-ref-missing gives rule.missingRef".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced the two 22-case switches to pass fallow's cyclomatic ceiling**
- **Found during:** Task 2
- **Issue:** `fallow health` reported `classifyGitCommandFailure` at cyclomatic 26 and `gitCommandMessage` at 25, above `maxCyclomatic: 20`. The plan asked for one exhaustive switch for each.
- **Fix:** The classifier uses a `satisfies Record` table plus an 8-case no-default switch on the answer. The message builder uses two `if` checks and one generic return. Exhaustiveness for the reason mapping is still a compile error (T-02-07).
- **Files modified:** `shared/git-failure-classifiers.ts`, `shared/errors.ts`
- **Verification:** `npm run fallow` is clean, and the classifier table has one row per kind. Coverage is 100%.
- **Committed in:** `f3d3c76`

**2. [Rule 3 - Blocking] The GitHub git-missing add case uses `acme/mp`, not `acme/tools`**
- **Found during:** Task 3
- **Issue:** The test's `createGitOps` fake allows only listed remotes. `https://github.com/acme/tools.git` is not listed, so the fake threw "blocked unplanned remote" before the planned failure.
- **Fix:** Used `acme/mp`, the GitHub remote this file already allows. The behavior under test does not change.
- **Files modified:** `test/orchestrators/marketplace/add.test.ts`
- **Committed in:** `613d9ed`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** The reason mapping and the user-visible output match the plan. Only the form of the exhaustive mapping changed, and the compiler still enforces it. No scope creep.

## Issues Encountered

- The first hook run for Task 1 failed with an ESLint heap out-of-memory error. The worktree had no ESLint cache, so the hook linted the whole tree in parallel with the other static checks. I ran `npm run lint` once with `NODE_OPTIONS=--max-old-space-size=8192` to warm `node_modules/.cache/eslint/`, and the hook then passed. No hook was skipped.
- My Prettier formatting step for Task 3 first reformatted `.planning/PROJECT.md` and `docs/output-catalog.md` across the whole file. I restored both files with `git checkout -- <file>` and reapplied only the intended one-row and one-sentence edits before committing. The committed diff is 1 and 2 lines.

## Note for the transport phase

The isomorphic-git name and code matchers are still in place: `orchestrators/marketplace/shared.ts` `isGitNotFoundError`, `orchestrators/plugin/clone-cache.ts` `isGitCommitNotFetchedError` and `isGitNotFoundError`, and the classifier's `HttpError`, `UserCanceledError`, and `NotFoundError` rungs. They become `instanceof GitCommandError` checks on `kind` when the transport swaps to system git. Until then, the string `"GitCommandError"` appears only in the constructor's `this.name` assignment (guard grep prints 0).

## Known Stubs

None. No production code raises `GitCommandError` yet. That is planned: plans 02-03 (git process module) and 02-05 (git-required gate) raise it.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-02-05 (stderr redaction) and T-02-06 (no stderr in the message) are mitigated, and `errors.test.ts` pins both. T-02-07 is mitigated by the `satisfies Record` table, and T-02-08 by the one-commit enrollment with the regenerated schema.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 02-03 and 02-05 can throw `new GitCommandError(failure, { operation, exitCode, stderr }, { cause })`. Every surface on the D-PL7-01 ladder then classifies it with no further edit.
- The orchestrator's wave gate runs `npm run check` on the combined tree. Per the plan, `npm run check` was not run here.

## Self-Check: PASSED

- All 18 modified files exist, and `git status` is clean.
- Commits `0b49c23`, `f3d3c76`, and `613d9ed` are on this branch (`git rev-list --count 6c342521..HEAD` = 3 before the SUMMARY commit).
- Every acceptance-criteria grep of the three tasks passed (logged during execution), including the GUARD MUTATION grep (0).

---
*Phase: 02-git-process-seam-and-typed-failures*
*Completed: 2026-11-23*
