---
phase: 115-composition-orchestrators
plan: 04
subsystem: testing
tags: [node-test, strong-mock, git-ops-fake, idempotence, on-disk-composition]

requires:
  - phase: 115-composition-orchestrators
    plan: 01
    provides: "The measured environment facts: git hooks absent, scoped pre-commit only, filesystem trufflehog route, pre-existing format:check noise from untracked files"
  - phase: 114-plugin-and-marketplace-lifecycle
    plan: "14-17"
    provides: "tests/orchestrators/plugin/scope-tree-inventory.ts and the two-call retry-proof idiom in uninstall.test.ts"
provides:
  - "A contract-compliant sole owner for orchestrators/plugin/bootstrap.ts"
  - "A genuine repeated-call idempotence proof: one case calls bootstrapClaudePlugin twice and pins the notification log, the state and config bytes, and the scope-root inventory"
  - "tests/orchestrators/plugin/scope-tree-inventory.ts header widened once to name the bootstrap and reconcile consumers"
affects: [115-05, 115-06, 115-08]

actuals:
  tokens: 8382
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Notification boundary returning an explicit verifyBoundary() so every strict mock is verified at the end of the case, after the result and state assertions, rather than inside the notify callback"
    - "Repeated-call idempotence expressed as byte equality against a snapshot captured between the two calls, so nothing is re-derived from production at assert time"
    - "Boundary members declared as arrow-function properties, not methods, so destructuring them does not trip @typescript-eslint/unbound-method"

key-files:
  created: []
  modified:
    - tests/orchestrators/plugin/bootstrap.test.ts
    - tests/orchestrators/plugin/scope-tree-inventory.ts

key-decisions:
  - "Folded the standalone WB-04 config smoke case into the clean-state case as a whole-value config assertion; it shared the same act and asserted a subset of the same end state"
  - "Removed the `as unknown as` seed cast by seeding the SPLIT-01 shape honestly: the marketplace record in state.json, the autoupdate flag in claude-plugins.json"
  - "Used t.mock.timers.enable({ apis: ['Date'] }) only in the clean-state case, where lastUpdatedAt is inside the asserted whole value; the seeded and two-call cases compare bytes and need no clock"
  - "Kept the // act & assert marker for the single assert.rejects case and let the follow-on state assertions live in that block, per the rule's one-throwing-expression allowance"

patterns-established:
  - "A cardinality promise is proved by planting the violation: over-state the expected notification count and confirm the case goes red, then restore"
  - "A tree-inventory literal is proved by perturbing it: drop one entry and confirm every case that asserts it goes red"

requirements-completed: [MOD-08]

coverage:
  - id: D1
    description: "Repeated bootstrapClaudePlugin calls are proved idempotent within one case by notification log, state and config bytes, and tree inventory"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/bootstrap.test.ts#converges on a second bootstrap without changing the recorded state or the tree"
        status: pass
      - kind: unit
        ref: "planted violation: expected notification count 3 -> 4, case failed; second bootstrapClaudePlugin call removed, case failed; both restored, suite green"
        status: pass
    human_judgment: false
  - id: D2
    description: "orchestrators/plugin/bootstrap.ts keeps 100 percent direct functions, lines, and branches with no coverage exception added"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The real addMarketplace + setMarketplaceAutoupdate composition runs against a case-owned temporary tree with only the git remote faked and no production seam added"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "git diff --quiet -- extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts extensions/pi-claude-marketplace/orchestrators/marketplace (exit 0)"
        status: pass
      - kind: unit
        ref: "createBootstrapGitOps allowedRemoteUrls holds exactly the canonical Anthropic remote; every case asserts clonedUrls() as a whole array"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every context and Pi double is a strict mock with exact parameters and an explicit final verification; no double built through an unknown cast remains"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "rg on tests/orchestrators/plugin/bootstrap.test.ts for as unknown as / as any / It.isAny() / anyTimes() / verifyAll(): no match"
        status: pass
    human_judgment: false
  - id: D5
    description: "The shared tree-inventory helper is widened once and its three existing consumers still pass"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "node --test tests/orchestrators/plugin/{install,reinstall,uninstall}.test.ts (300 tests, 300 pass)"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-01
status: complete
---

# Phase 115 Plan 04: Bootstrap Composition Owner Summary

**Bootstrap onboarding is now proved idempotent by actually calling it twice — the notification log, the state and config bytes, and the scope-root inventory are all pinned across the second call, on a suite that finally carries the mandated phase markers, strict verified doubles, and `t.after()` teardown.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 1 of 1
- **Files modified:** 2

## Accomplishments

- Added the repeated-call case the phase's fourth success criterion needed. One case
  creates a hermetic user scope, calls `bootstrapClaudePlugin` twice against the same
  working directory, and asserts the complete three-row notification log across both
  calls, `state.json` and `claude-plugins.json` byte-identical to the snapshot taken
  between the calls, an identical `retryTree` inventory, and both clone calls with the
  WR-05 reason recorded in one line. The previous three "idempotence" cases all seeded
  the post-state by hand and called the orchestrator exactly once.
- Rewrote all five behavioral cases against the on-disk regime: separate lowercase
  `// arrange`, `// act`, `// assert` phases, whole-value comparisons in place of
  existence checks, and byte comparisons where the bytes are the contract.
- Replaced the three doubles built by casting through `unknown` with `strong-mock`
  strict mocks (`exactParams: true`) whose complete promised interaction is stated by
  exact call count and verified through an explicit `verifyBoundary()` at the end of
  each case, after the result and state assertions. The clone-failure case states zero
  notifications, so any emission fails immediately — that is the silence proof.
- Replaced the `finally`-only environment restore with one `mkdtemp` pair per case,
  removed together with the `HOME` and `PI_CODING_AGENT_DIR` restore through a
  `t.after()` registered before the act phase.
- Removed the `as unknown as ExtensionState["marketplaces"][string]` seed cast by
  seeding the SPLIT-01 shape honestly: the marketplace record in `state.json`, the
  autoupdate flag in `claude-plugins.json`.
- Deleted the header's work-session narrative (the two sentences weighing a
  pre-execution planning claim against observed behavior) and moved the durable
  clone-before-name-check fact onto the two-call case that depends on it.

## Task Commits

1. **Task 1: Rewrite the bootstrap owner and add a genuine two-call idempotence proof** — `4c0c4694` (test)

## Files Created/Modified

- `tests/orchestrators/plugin/bootstrap.test.ts` — sole mirrored owner for
  `orchestrators/plugin/bootstrap.ts`; 6 cases, 415 lines (was 6 cases, 404 lines, none
  marked).
- `tests/orchestrators/plugin/scope-tree-inventory.ts` — header widened once, from "the
  install, reinstall, and uninstall retry proofs" to also name the bootstrap idempotence
  proof and the reconcile owners. No behavior change; this plan is its sole editor in
  the phase.

## Decisions Made

- **Folded WB-04 into the clean-state case.** The standalone WB-04 smoke test ran the
  clean-state case's act phase and asserted a strict subset of the same end state.
  The clean-state case now asserts the complete parsed `claude-plugins.json` as one
  value, carrying the WB-04 anchor. Case count is unchanged at 6 because the
  repeated-call case took its place.
- **Faked `Date` in exactly one case.** The clean-state case asserts the whole state
  record, which carries `addMarketplace`'s `lastUpdatedAt: new Date().toISOString()`, so
  it enables `t.mock.timers.enable({ apis: ["Date"], now })` — the same mechanism
  `tests/orchestrators/marketplace/update.test.ts` already uses under
  `withLockedStateTransaction`. The seeded and two-call cases compare bytes to bytes, so
  they need no clock and do not touch a process global they do not have to.
- **Kept `// act & assert` for the clone-failure case.** It has one `assert.rejects()`
  performing both the action and the error assertion; the follow-on state, tree, and
  boundary assertions stay in that block. This is the one place in the file where the
  combined marker appears.
- **Boundary members are arrow-function properties, not methods.** Declaring
  `clonedUrls()` / `verifyBoundary()` as methods on the returned type made every
  destructuring site an `@typescript-eslint/unbound-method` error (11 of them). Declaring
  them as `readonly clonedUrls: () => readonly string[]` fixes the rule at the source
  rather than suppressing it.

## Deviations from Plan

None — plan executed as written. The two adjustments above (folding WB-04, arrow-property
boundary members) are inside the plan's stated latitude: the plan named the five
behavioral cases to keep and left the WB-04 smoke case unlisted, and the lint fix is a
type-declaration choice, not a scope change.

## Issues Encountered

- **`structuredClone` cannot record the clone `auth` bundle.** `createGitOpsFake`
  records call arguments with `structuredClone`, and `addMarketplace` passes an `auth`
  bundle carrying credential callbacks, which are functions. Passing the raw options
  through throws `DOMException [DataCloneError]`. The previous suite already worked
  around this; the rewrite keeps the strip and now explains why in a comment on the
  wrapper.
- **`npm run check` stops at `format:check`.** The chain is
  `typecheck && lint && fallow && format:check && test && test:integration`, and
  `format:check` fails on the pre-existing untracked `.mcp.json` and seven
  `.planning/research/.cache/*.json` files (`.prettierignore` lacks `.planning/`). Those
  files are untouched by this plan. `npm test` (4755 tests, 4755 pass) and
  `npm run test:integration` (28 tests, 28 pass) were therefore run separately to
  complete the gate; both are green.

## Verification Evidence

Measured, not estimated:

- `node --test tests/orchestrators/plugin/bootstrap.test.ts` — **6 tests, 6 pass, 0 fail.**
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts` —
  verbatim verdict line:
  `Direct coverage passed: extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts (branches 6/6, functions 1/1, lines 134/134)`
  (baseline before the rewrite was `branches 5/5, functions 1/1, lines 134/134`; the
  branch denominator rose because the new cases reach a branch the old suite never
  entered, and both endpoints are 100 percent).
- `npm run typecheck` — clean.
- `npm exec -- eslint` on both changed files — 0 problems.
- `npm exec -- prettier --check` on both changed files — all matched files use Prettier
  code style.
- `npm run fallow` — exit code 0 (checked as a real exit status, not a piped tail); no
  finding names `tests/orchestrators/plugin/bootstrap.test.ts`, only the informational
  hotspot listing.
- `node --test tests/orchestrators/plugin/{install,reinstall,uninstall}.test.ts` —
  **300 tests, 300 pass, 0 fail.**
- `npm test` — **4755 tests, 4755 pass, 0 fail.**
- `npm run test:integration` — **28 tests, 28 pass, 0 fail.**
- Prohibited-pattern scan (`test.only|skip|todo`, `node:coverage ignore`, `c8 ignore`,
  `as unknown as`, `as any`, `anyTimes()`, `It.isAny()`, `verifyAll()`, capitalized
  phase markers, `pre-execution claim`) — no match.
- `git diff --quiet -- extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts extensions/pi-claude-marketplace/orchestrators/marketplace` —
  exit 0; `git diff --stat -- extensions/` is empty.
- Phase-marker count: 6 `// arrange`, 6 case bodies, 6 `// act` (five plain, one
  `// act & assert`), 5 `// assert`.
- `pre-commit run --files <the two changed files>` (scoped, per the execution
  environment) — every hook passes except `npm format check`, which fails only on the
  pre-existing untracked files listed above.
- TruffleHog filesystem scan over both changed paths with
  `--results=verified,unknown --fail` — `verified_secrets: 0, unverified_secrets: 0`.

## Planted-Violation Proofs

Per the carry-forward warning about proofs that pass while proving nothing, three
controls were run and reverted:

1. Over-stated the repeated-call notification promise from 3 to 4 — the repeated-call
   case failed, the other five passed. The cardinality promise is real.
2. Removed the second `bootstrapClaudePlugin` call from the repeated-call case — the
   case failed. The three-row log is not reachable from a single call.
3. Dropped `"pi-claude-marketplace/sources-staging/"` from the expected scope tree —
   three cases failed. The tree literals discriminate.

Every expected value in the file is an authored literal or a byte snapshot captured
between the two acts. No expected value is produced by calling the code under test.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, file access pattern, or schema change was
introduced; the change is test-only and adds no production surface.

## Self-Check: PASSED

- `tests/orchestrators/plugin/bootstrap.test.ts` — FOUND
- `tests/orchestrators/plugin/scope-tree-inventory.ts` — FOUND
- Commit `4c0c4694` — FOUND in `git log`
