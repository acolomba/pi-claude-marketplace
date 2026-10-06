---
phase: 261004-u7n
plan: 01
subsystem: build-checks
tags: [checks, coverage, ci, docs]
status: complete
requires: []
provides:
  - direct-coverage gate that fails on any shortfall with no pin
  - check chain, unit globs, and selector without the unused type member gate
affects: [package.json, scripts/check-changed.mjs, scripts/test-coverage-direct.mjs, .github/workflows/ci.yml, .pre-commit-config.yaml]
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - package.json
    - scripts/check-changed.mjs
    - scripts/check-corresponding-tests.mjs
    - scripts/test-coverage-direct.mjs
    - tests/architecture/partial-vocabulary-guard.test.ts
    - .github/workflows/ci.yml
    - .pre-commit-config.yaml
    - tests/edge/completions/data.test.ts
    - tests/edge/completions/provider.test.ts
    - tests/edge/handlers/plugin/import.test.ts
    - tests/edge/handlers/plugin/pending.test.ts
    - CONTRIBUTING.md
    - skills/local-verification/SKILL.md
    - .planning/codebase/TESTING.md
    - .planning/codebase/CONVENTIONS.md
    - .planning/PROJECT.md
    - CHANGELOG.md
decisions:
  - "enforcePairs throws one Error with a sorted line per shortfall in the existing 'Incomplete direct coverage for <source>: <reading>' format, after the beforeVerdict completeness hook"
  - "Report tool and test:coverage:direct:report deleted; the six exports only it imported are now module-private"
metrics:
  duration: ~40m
  completed: 2026-10-04
actuals:
  tokens: 157000
  tasks: 3
  commits: 3
plan_head_before: be14d092
plan_head_after: 53a86f3d
---

# Quick Task 261004-u7n: Remove the unused type member gate and the direct-coverage pin

The unused type member gate (10 scripts/data files, 7 analyzer tests) and the direct-coverage pin (module, data, report tool, npm script) are gone. Direct coverage now fails on any shortfall with the per-pair message, and the four synced build-input lists admit only `.mjs` scripts.

## Commits

| Task | Commit | Title |
| ---- | ------ | ----- |
| 1 | 5e2bb35b | chore(checks): remove the unused type member gate |
| 2 | f342e3de | chore(coverage): remove the direct coverage pin |
| 3 | 53a86f3d | docs: drop the member gate and coverage pin from the docs |

## Evidence

Last line of every `tmp/u7n/*.log`:

- typecheck-1 `TYPECHECK_EXIT=0`, lint-1 `LINT_EXIT=0`, fallow-1 `FALLOW_EXIT=0`, corresponding-1 `CORRESPONDING_EXIT=0`, node-test-1 `NODE_TEST_EXIT=0`, selection-1 `LIST_EXIT=0`, precommit-1 `PRECOMMIT_EXIT=0`
- direct-2 `DIRECT_EXIT=0`, plant-2 `PLANT_EXIT=1`, typecheck-2 `TYPECHECK_EXIT=0`, lint-2 `LINT_EXIT=0`, fallow-2 `FALLOW_EXIT=0`, corresponding-2 `CORRESPONDING_EXIT=0`, format-2 `FORMAT_EXIT=0`, selection-2 `LIST_EXIT=0`, precommit-2 `PRECOMMIT_EXIT=0`
- precommit-3 `PRECOMMIT_EXIT=0`
- commit-1/2/3 (hook output of `git commit`): `npm changed checks....Passed`

Plant run line: `Incomplete direct coverage for extensions/pi-claude-marketplace/shared/compare-name-scope.ts: functions 1/2, lines 24/26`. The planted file was restored and is clean.

Positive run (`--base HEAD`) measured the four edited pairs (data, provider, pending, import), all complete.

Selection scope per pre-commit run: Task 1 `broad`, Task 2 `broad`, Task 3 `none`.

Staging rule: both saved operator diffs were empty (the operator's comment edits were already committed in e805dfd0), so neither shared file needed `update-index`; both were staged with `git add`.

Fallow audit verdicts: `pass`, `pass`, `pass`.

Gitlint passed for all three messages.

Final changelog wording (under the #236 entry):

- `` `npm run check` no longer runs the unused type member gate, and the `lint:type-members` and `test:analyzers` scripts no longer exist. ``
- `` Direct coverage no longer reads a pin file, so any shortfall fails, and the `test:coverage:direct:report` script no longer exists. ``

focused task verification passed; full phase/PR verification pending

## Deviations from Plan

- **[Rule 3 - Blocking] Prettier reflow of `enforcePairs`.** The first `format:check` in Task 2 failed on the new `.map(...)` line in `scripts/test-coverage-direct.mjs`. Ran `prettier --write` on that file and re-ran `format:check` (exit 0) before pre-commit. Formatting only; included in f342e3de.
- Shared-file staging rule not exercised (operator diffs empty), per the orchestrator's context update.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- All three task `<verify>` commands exited 0 on the committed tree.
- Commits 5e2bb35b, f342e3de, 53a86f3d exist on `features/faster-precommit`.
- `scripts/test-coverage-direct.mjs` contains `hooks.beforeVerdict?.(records);`; no `scripts/*.json` remains; `docs/unused-type-member-gate.md` is deleted.
