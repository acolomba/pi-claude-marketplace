---
phase: 01-staging-warning-channels
reviewed: 2026-10-28T16:25:52Z
depth: standard
source_commit: 2cba203e0c694a2ef5567398f33971ca6a905829
review_head: 99747f3937f358c2aaa2720952985c7a0403422e
review_fix_commits:
  - 15e12fdf24c5c0444d5707646983980dae58b438
  - da9756bdb4362e255c829bb263b594e6f37bf1f4
  - 4bcdf9697b87ea97d21face0154933e6c7f625a5
  - 2cba203e0c694a2ef5567398f33971ca6a905829
files_reviewed: 22
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/staging-diagnostics.ts
  - extensions/pi-claude-marketplace/shared/compare-name-scope.ts
  - features/plugin/staging-warnings.feature
  - features/lib/npm-registry.ts
  - features/lib/layer-config.ts
  - features/step_definitions/config.steps.ts
  - features/support/world.ts
  - features/support/npm-registry.ts
  - test/orchestrators/plugin/install-flow-dependency-ledger.test.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - test/orchestrators/plugin/install-flow-planning.test.ts
  - test/orchestrators/plugin/install-flow-results.test.ts
  - test/orchestrators/plugin/install-flow-fixture.ts
  - test/platform/hermetic-environment.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 01: Code Review Report

**Reviewed:** 2026-10-28T16:25:52Z
**Depth:** standard
**Files reviewed:** 22
**Status:** clean

## Summary

CR-01, CR-02, and CR-03 are closed. No new Critical, Warning, or Info
findings were found in the reviewed fixes.

This is the final focused re-review of the four fix commits above.
The cleanup diff and affected cases were reviewed in full; the earlier
production fixes were traced through their current callers, result
projections, and relevant feature fixtures. Large pre-existing modules
were read at the changed sections and their supporting code. The earlier
Phase 1 review remains the baseline for unchanged phase implementations;
this report does not claim a fresh full-file review of the entire phase.

## Narrative Findings (AI reviewer)

None. All reviewed changes meet the applicable quality standards.

## Fix Dispositions

| Finding | Verdict | Evidence |
| --- | --- | --- |
| CR-01 | Closed. | Dependency-step notices reach the failed-move projection or the resumed install. Every normal terminal transaction arm reaches the common notice finalizer; caught failures merge prior notices and finalize separately. Successful roots, failed later moves, and invalid final configuration pass in both notification modes. |
| CR-02 | Closed. | Root display names and qualified member keys use the same comparator as cascade rows. The exact root key is excluded from member diagnostics; diagnostic headers retain plugin names. The runtime regression reports the dependency note before the root note. |
| CR-03 | Closed. | Each of the five iteration-1 cases now registers an awaited teardown immediately after allocation. Independent success and forced-assertion-failure probes leave their isolated temporary directories empty, including the chmod-000 failed-move fixtures. |

### CR-03 cleanup audit

The only test changes in `2cba203e` are the test-context parameters and
three teardown registrations, covering five concrete cases:

- `install-flow-planning.test.ts:405-407`: successful standalone and
  orchestrated installs.
- `install-flow-planning.test.ts:452-454`: failed later moves in
  standalone and orchestrated installs.
- `install-flow-ledger.test.ts:15646-15648`: dependency/root diagnostic
  ordering.

Each registration closes over its own `cwd` and awaits
`rm(cwd, { recursive: true, force: true })`. It precedes every subsequent
setup operation, install, and assertion. The tests retain their original
setup, actions, and assertions. No fixture helper or production seam was
changed.

`seedCatalogScope` creates the separate project tree under `tmpdir()`.
`withHermeticHome` removes its own environment in `finally`; the new
test teardown removes the sibling project tree even when the callback
throws. It does not depend on the environment variables restored by that
wrapper.

### CR-01 terminal-path audit

- Planning forwards `ran.mcpConfigNotices` on both failed moves and
  resumed installs (`install-flow-planning.ts:253-269`).
- `invalid-config`, `marketplace-absent`, `refused`, and `declared`
  preserve prior notices and reach the common finalizer at
  `install-flow-ledger.ts:1282`.
- `promoted`, `disable-cascade-failed`, and `installed` append current
  notices after prior notices before that finalizer.
- The catch merges prior notices with captured transaction notices and
  returns through its own finalizer (`install-flow-ledger.ts:1001-1021`).
- The dependency-moves arm delegates notice ownership. The resumed run
  uses its planned closure, so it does not start another planning pass.
- Orchestrated mode emits no notice directly. Standalone mode emits notices
  after the operation's rows and discovery diagnostics.
- The declaration helper rejects orchestrated mode before returning a
  declared outcome (`install-flow-results.ts:889-902`).

### CR-02 ordering audit

`cascadeStagingDiagnostics` at `install-flow-results.ts:810-839`
sorts the root and members together, using the same
`compareByNameThenScope` as cascade rows. It excludes the root by full
key, retains members from other marketplaces, and preserves each
member's manifest name in the diagnostic header. Empty warning arrays
produce no notification through `surfaceDiscoveryWarnings`.

## Verification Evidence and Limits

- Read project instructions, the previous review, the iteration-3 fix
  report, all four fix diffs, changed cases, fixture contracts, production
  notice paths, diagnostic ordering, and the relevant behavioral scenarios.
  Applied the TypeScript, unit-test, Cucumber, and local-verification
  review rules. The configured reviewer skill query returned no extra
  entries. No structural-findings payload or external evidence lane was
  supplied.
- Used CodeGraph for initial code navigation, then read current source
  where its index reported changed files.
- Independently ran each of the five cleanup cases with
  `node --test --test-reporter=tap --test-name-pattern '^<exact title>$' <owner test>`
  on Node `v26.12.1` at `99747f39`. Each used a fresh child-process
  `TMPDIR`, exited 0, and left that directory empty.
- Repeated each case with a child-only data-URL preload that throws an
  `AssertionError` at `assert.deepStrictEqual`. All five exited 1 and
  left their temporary directories empty. Assertion stack markers
  independently confirmed execution at planning-test lines 433 and 482
  and ledger-test line 15669, after each operation. In the corresponding
  successful probes, the same wrapper called the original assertion:
  two assertions per successful-install case, three per failed-move
  case, and one in the row-order case. This guards against mistaking an
  unmatched test filter for a cleanup pass.
- Probe markers and temporary directories lived outside the repository
  and were removed in the probe's own `finally`. No probe code was saved
  in source or tests. Initial probe attempts could not confirm assertion
  execution from Node's file-level output; they were superseded by the
  stack-marker probes and are not the failure-cleanup evidence.
- Independently reran both invalid-final-config cases with
  `node --test --test-reporter=tap --test-name-pattern 'keeps dependency MCP notices when the final config' test/orchestrators/plugin/install-flow-ledger.test.ts`.
  Exit 0; its isolated temporary directory was empty afterward.
- The iteration-3 fix report records passing direct coverage for both
  affected source/test pairs at `2cba203e`, with 100% line, function,
  and branch coverage, plus a passing commit hook and Fallow audit.
  Those are the fixer's recorded checks.
- The coordinating owner reported the final `npm run check` completed
  with exit 0 at `99747f3937f358c2aaa2720952985c7a0403422e` on Node
  `v26.12.1`: typecheck, lint, workflow lint, Fallow, formatting,
  source/test correspondence, and feature validation passed; 16 hooks,
  1,124 scenarios, and 11,468 steps passed; 309 direct-coverage LCOV
  records were merged. This is the owner's combined-tree gate evidence,
  not a duplicate run by this reviewer.
- `fallow review --base 2cba203e^ --brief` exited 0 and reported no
  consequential structural decision. This orientation output is not
  treated as a replacement for the owner's gate.
- Production and feature files are unchanged from `4bcdf969`.
  The non-planning-Markdown diff from `2cba203e` is empty, and no
  untracked inputs were present at review HEAD. The reviewer changed
  only this report, made no source/test edits, and made no commit.

---

_Reviewer: gsd-code-reviewer_
_Depth: standard_
