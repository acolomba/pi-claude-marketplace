---
phase: 03-dependency-cascade-rows-and-status
fixed_at: 2026-10-28T22:21:59Z
review_path: .planning/phases/03-dependency-cascade-rows-and-status/03-REVIEW.md
iteration: 1
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-10-28T22:21:59Z
**Source review:** `.planning/phases/03-dependency-cascade-rows-and-status/03-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 1
- Fixed: 1
- Skipped: 0

## Fixed Issues

### CR-01: A partially installed cascade dependency reports a fully installed row

**Status:** fixed: requires human verification

**Files modified:**

- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts`
- `test/orchestrators/plugin/install-cascade.test.ts`
- `test/orchestrators/plugin/install-cascade.messaging.test.ts`
- `features/plugin/install-dependencies.feature`

**Commit:** `0ee37cf01ac4e3e8830b502f8b003ed3d27a68e6` (`fix(plugin): report partial cascade members`)

**Applied fix:** A member whose ledger resolution is `partially-available` now carries its unsupported kinds through `CascadeMemberOutcome` and `CascadeInstalledRow`. The presence of `unsupported` marks the partial installation, as in the existing `installedPluginOutcome` projection. The composer returns the existing installed/partially-installed message union and narrows unsupported kinds through `narrowUnsupportedKinds`.

The member retains its current-copy fallback or re-enable reasons and companion severity. The requesting plugin's row and root status logic are unchanged, preserving D-PL3-06.

**Regression assertions:** The existing ledger-summary projection case now asserts the partial member's unsupported kinds and the independent root summary. New whole-row messaging assertions cover the parent's installed status, reason narrowing and deduplication, current-copy fallback, re-enable reasons, and unloaded-companion warnings. The new Cucumber scenario installs `app -> lib` fresh with `--partial`, where `lib` declares an output style. It asserts the complete plugin row set: `app` is installed and `lib` is partially-installed with `unsupported component`.

## Verification

All checks ran in the existing isolated worktree `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-c-369`, on `agent-reverify-c`, using Node `v26.12.1`. No additional worktree was created by the fixer. The orchestrator owns merging and teardown of this worktree.

- Mandatory reread: modified source and test sections inspected; surrounding code intact.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts`: exit 0. Both owner suites and 100% direct line, function, and branch coverage passed. The commit hook reran direct coverage on the final corrected fixture.
- `npx cucumber-js --parallel 1 --name '^Installing a fresh dependency partially reports its own partial status$'`: exit 0; 1 scenario, 9 steps, and 2 hooks passed.
- `SKIP=npm-check pre-commit run --files <the five modified files>`: exit 0. The corrected fixture also passed a focused rerun.
- `node_modules/.bin/fallow audit --base HEAD --format json --quiet`, before the fix commit: exit 0, verdict `pass`; zero dead-code issues, complexity findings, and duplication groups. Reran after the fixture correction.
- `git commit -m 'fix(plugin): report partial cascade members'`: exit 0 with all hooks enabled, including `npm run check:commit`. That hook passed static checks, feature validation, unpaired tests, and direct coverage for the staged source/test pairs. No hook was bypassed.
- `git diff --check`: exit 0 before the commit. The source tree was clean after the commit, before this report was written.

The initial Cucumber attempt could not bind its local test server in the sandbox. Initial file-fixer and Fallow runs also hit sandbox write restrictions. Authorized retries with the required access passed. The first commit attempt caught a fixture type error: the resolver's partial result remains materializable with `installable: true`, while persisted compatibility uses `false`. Removing the erroneous fixture override resolved the failure, and the normal commit retry passed.

The source review's hermetic reproduction supplies the pre-fix failure evidence. This fix run did not revert production code to repeat that reproduction. The targeted checks do not replace the combined-tree `npm run check` gate or the standard-depth re-review that `03-REVIEW.md` requires. The status above retains the fixer workflow's human-verification flag for a logic correction despite the passing automated regressions.

---

_Fixer: gsd-code-fixer_
_Iteration: 1_
