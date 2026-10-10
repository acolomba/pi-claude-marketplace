---
phase: 08-address-tech-debt-ledger-dispositions-and-advisory
fixed_at: 2026-10-10T00:00:00Z
review_path: .planning/phases/08-address-tech-debt-ledger-dispositions-and-advisory/08-REVIEW.md
iteration: 2
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 08: Code Review Fix Report

**Fixed at:** 2026-10-10
**Source review:** .planning/phases/08-address-tech-debt-ledger-dispositions-and-advisory/08-REVIEW.md
**Iteration:** 2 (this report also carries the iteration-1 fix)

**Summary:**

- Findings in scope this iteration: 1 (iteration-2 WR-01; scope is critical and warning)
- Fixed: 1
- Skipped: 0
- Out of scope, left as recorded: IN-01, IN-02, IN-03, IN-04, IN-05 (Info)

## Fixed Issues

### Iteration 2 -- WR-01: An installed global peer with no `src/` tree still skips silently

**Files modified:** `tests/integration/skill-path-resolution.test.ts`, `tests/integration/provenance-invisibility.test.ts`
**Commit:** eddd3cf0
**Status:** fixed: requires human verification (it changes skip/fail logic)

**Applied fix:** Each loader now decides "peer present" by whether the package is installed. When the resolved root has no `src/` tree, the loader calls `assert.fail` if `<root>/package.json` exists, or if an explicit `PI_SUBAGENTS_ROOT` names an existing directory. The message is `pi-subagents at <dir> is present but has no src/ tree`. It returns `undefined` (skip) only when no root resolves or the root has neither `src/` nor `package.json` (and is not an existing explicit directory). The header comment in `skill-path-resolution.test.ts` and the loader doc comments in both files now state this contract. The same change is in both files, because the shared-helper consolidation is IN-01 and outside the fix scope.

### Iteration 1 -- WR-01: A load failure skips the test instead of failing it, even with an explicit `PI_SUBAGENTS_ROOT` opt-in

**Files modified:** `tests/integration/skill-path-resolution.test.ts`, `tests/integration/provenance-invisibility.test.ts`
**Commit:** ab350dd2
**Status:** fixed: requires human verification (it changes skip/fail logic)

**Interpretation applied.** The reviewer's sketch failed whenever `PI_SUBAGENTS_ROOT` is set. That would break the CI simulation in the 08-02 and 08-04 verify commands and in 08-VALIDATION.md, which set `PI_SUBAGENTS_ROOT=/nonexistent` and expect `# skipped 2`. The fix draws the line by whether the peer is present, not by whether the variable is set.

**Applied fix:** `resolvePiSubagentsPackageRoot` returns `{ dir, explicit }`, where `explicit` is true when `PI_SUBAGENTS_ROOT` supplied the root. The `catch {}` blocks around `cp` and `import()` were removed, so copy and import errors reach the test. A missing target module (`agents/skills.ts` or `agents/frontmatter.ts`) trips `assert.ok`. The iteration-2 fix above widened the "present" test for a root with no `src/` tree.

## Verification

All runs used this main checkout (`/home/acolomba/src/pi-claude-marketplace-json`, branch `features/json`). No isolated worktree was used, because the caller told me to work in this checkout. Both tests stay hermetic: SC-2 writes only inside its `createHermeticEnvironment` root, and T-d8i-01 writes only inside its `mkdtemp` root.

Command: `node --test --test-reporter=tap tests/integration/skill-path-resolution.test.ts tests/integration/provenance-invisibility.test.ts`

Iteration 2 (after eddd3cf0):

| Scenario | Result |
| --- | --- |
| Global peer present (pi-subagents@0.47.1 at `npm root -g`) | exit 0, `# pass 2`, `# skipped 0` |
| `PI_SUBAGENTS_ROOT=/nonexistent` | exit 0, `# pass 0`, `# skipped 2` |
| No global peer (`NPM_CONFIG_PREFIX` set to an empty prefix) | exit 0, `# pass 0`, `# skipped 2` |
| Global peer with `package.json` but no `src/` (`NPM_CONFIG_PREFIX` set to a scratch prefix) | exit 1, `# fail 2` (`is present but has no src/ tree`) |
| `PI_SUBAGENTS_ROOT` set to a directory with `package.json` but no `src/` | exit 1, `# fail 2` (`is present but has no src/ tree`) |
| `PI_SUBAGENTS_ROOT` set to an existing empty directory | exit 1, `# fail 2` (`is present but has no src/ tree`) |

The two `NPM_CONFIG_PREFIX` scenarios used prefixes under the repo's gitignored `tmp/` directory, removed afterwards. A prefix under the session scratchpad does not work: npm redacts the UUID path segment as `***` in `npm root -g` output, so the resolved root does not exist and the test skips for that reason alone.

Iteration 1 (after ab350dd2) additionally showed: a root with `src/` but no target module fails (`has a src/ tree but no agents/...`), and a module that fails type stripping fails (`ERR_INVALID_TYPESCRIPT_SYNTAX`). The iteration-2 change does not touch those paths.

For both commits, `SKIP=npm-check pre-commit run --files <both tests>` was clean, and the hook's `npm run check:commit` ran in the main checkout during `git commit` and passed. The hook result does not count as a full `npm run check` verdict.

---

_Fixed: 2026-10-10_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
