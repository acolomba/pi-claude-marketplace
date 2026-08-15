---
phase: quick-260815-h7g
plan: 01
subsystem: tooling
tags: [static-analysis, lint, ci, dead-code, dependencies]
status: complete
requires: []
provides:
  - fallow boundary-violation gate (npm run fallow)
  - fallow audit CI job on pull_request
affects:
  - .fallowrc.json
  - package.json
  - .github/workflows/lint.yml
  - sonar-project.properties
tech-stack:
  added: []
  patterns:
    - "fallow invoked via npx --yes; no package.json dependency entry"
    - "boundary zones split per bridge kind to enforce the cross-bridge import ban"
key-files:
  created:
    - .fallowrc.json
  modified:
    - package.json
    - package-lock.json
    - .github/workflows/lint.yml
    - sonar-project.properties
    - .planning/codebase/STACK.md
    - .planning/codebase/CONVENTIONS.md
  deleted:
    - extensions/pi-claude-marketplace/domain/index.ts
    - extensions/pi-claude-marketplace/edge/index.ts
    - extensions/pi-claude-marketplace/orchestrators/index.ts
    - extensions/pi-claude-marketplace/persistence/index.ts
    - extensions/pi-claude-marketplace/transaction/index.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/info.messaging.ts
decisions:
  - "Local fallow script uses --fail-on-issues; without it the CLI prints violations and exits 0"
  - "Retained 4 of the 10 spike-listed dead-file candidates because tests still import them"
metrics:
  duration: ~25m
  completed: 2026-08-15
actuals:
  tokens: 12500
  tasks: 3
  commits: 1
---

# Quick Task 260815-h7g: Adopt Fallow Static Analysis as a Linting Gate Summary

Wired `fallow` as a boundary-violation gate (12 zones, one per bridge kind) plus a
PR-scoped `fallow audit` CI job, and acted on the spike's confirmed findings:
six unreachable files deleted, three stale devDependencies dropped, four
duplicate `*.messaging.ts` files added to the CPD exclusions, and two stale
codebase docs corrected.

**Commit:** `1d4f478b` build: adopt fallow static analysis as a linting gate

## What Was Built

### Task 1: Fallow wiring

- `.fallowrc.json` at the worktree root, copied verbatim from the spike's
  `fallowrc-boundaries-finegrained.json`: explicit `entry`, `production: true`,
  and a 12-zone `boundaries` block. `fallow list --boundaries` reports
  **12 zones, 12 rules**, including all five per-bridge zones.
- Two npm scripts, sorted between `check` and `format`:
  - `fallow`: `npx --yes fallow dead-code --boundary-violations --fail-on-issues --format human`
  - `fallow:audit`: `npx --yes fallow audit --format human`
- A `fallow` job in `.github/workflows/lint.yml` with `fetch-depth: 0` (commented
  to explain the merge-base requirement) running
  `fallow audit --changed-since "origin/${{ github.event.pull_request.base.ref || 'main' }}"`.

No entry was added to `dependencies` or `devDependencies`. Neither `fallow fix`
nor `fallow security` is wired into any script, hook, or workflow.

### Task 2: Acting on findings

Six files deleted, three devDeps dropped, CPD exclusions extended from 3 to 7
entries with a rationale comment, and STACK.md / CONVENTIONS.md corrected.

### Task 3: Gate and commit

`npm run check` green, filesystem secret scan clean, `pre-commit --files` clean,
one ASCII Conventional Commits commit.

## Files Deleted (6)

All six confirmed zero importers by a resolver-based check (below):

| File | Deleted |
|------|---------|
| `extensions/pi-claude-marketplace/domain/index.ts` | yes |
| `extensions/pi-claude-marketplace/edge/index.ts` | yes |
| `extensions/pi-claude-marketplace/orchestrators/index.ts` | yes |
| `extensions/pi-claude-marketplace/persistence/index.ts` | yes |
| `extensions/pi-claude-marketplace/transaction/index.ts` | yes |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/info.messaging.ts` | yes |

## Candidates Retained (4) and the Importer That Saved Each

| File | Saved by |
|------|----------|
| `orchestrators/import/index.ts` | `tests/orchestrators/import/{refs,marketplaces,execute,settings}.test.ts` (4 test files) |
| `orchestrators/plugin/index.ts` | `tests/orchestrators/plugin/info.test.ts` |
| `orchestrators/marketplace/index.ts` | `tests/orchestrators/marketplace/info.test.ts` |
| `transaction/rollback.ts` | `tests/transaction/rollback.test.ts` |

These four remain in fallow's `--unused-files` report after the change. That is
correct behavior, not an outstanding defect: they are unreachable from the
**production** entry point precisely because their only consumers are tests, and
`production: true` excludes test files from the consumer graph. They are live
code by every other measure.

Each of the four was also the sole production consumer of nothing that survived:
`orchestrators/index.ts` was the only production importer of the three
sub-barrels and `transaction/index.ts` the only production importer of
`rollback.ts`. Both importers were themselves deleted, so nothing was orphaned.

## Verification Method for the Deletions

The plan proposed exact-path-suffix greps. Path-suffix greps match test imports
(`../../extensions/pi-claude-marketplace/domain/index.ts`) but would **miss**
intra-extension relative imports such as `from "./index.ts"` or
`from "../domain/index.ts"`. To close that gap, importers were resolved
programmatically instead: every module specifier across `extensions/`, `tests/`,
and `eslint.config.js` was extracted (covering `from "..."`, `await import("...")`,
`require("...")`, and bare `import "..."`), resolved against the importing file's
directory, and matched to candidate paths (trying the literal path, `+ ".ts"`,
and `/index.ts` for directory imports).

Results agreed with the plan exactly: 6 dead, 4 live. A separate string-literal
grep across `*.ts`, `*.js`, `*.json`, and `*.md` confirmed no architecture or
docs test names any of the six deleted paths.

## devDependencies Dropped (3)

`memfs`, `yaml`, `@typescript-eslint/rule-tester` — all three confirmed to have
zero module specifiers anywhere under `extensions/` or `tests/`.

## package-lock.json Changes Beyond the Three Removed Packages

The lockfile diff is **3 insertions, 706 deletions**. Two effects go beyond the
plain removal of those three packages, and both are direct consequences of it:

1. **`@typescript-eslint/*` un-hoisting (not removal).** The top-level entries
   for `parser`, `project-service`, `scope-manager`, `tsconfig-utils`,
   `typescript-estree`, `utils`, and `visitor-keys` disappear from the lockfile.
   They were **not** removed from the tree — `rule-tester` was what pinned the
   hoisted top-level copies, and with it gone npm re-nested them under
   `node_modules/typescript-eslint/node_modules/`. No version changed.
   `npm run lint` passes, confirming the relocation is harmless.
2. **`tslib` gained `"optional": true`.** Version unchanged at 2.8.1. Its
   non-optional dependent came in through the `memfs` / `@jsonjoy.com/*` chain;
   with that chain gone, every surviving dependent references it optionally.

Note that `yaml` itself **remains** in the lockfile as a transitive dependency of
other packages. Only the direct `devDependencies` reference was removed.

No unrelated version bumps appeared.

## Fallow Version Resolved

`npx` resolved **fallow 3.16.0** (unchanged from spike time), reported as
`verified: yes ... fallow 3.16.0 signed`, served from the warm npx cache.

## Deviations from Plan

**1. [Orchestrator correction] Added `--fail-on-issues` to the `fallow` script**

- **Issue:** The plan's script (`fallow dead-code --boundary-violations --format human`)
  does not exit non-zero on findings. It would print violations and still exit 0,
  making the gate useless and the plan's own done-condition vacuously true.
- **Fix:** The script is
  `npx --yes fallow dead-code --boundary-violations --fail-on-issues --format human`.
- **Proof the gate is now meaningful:** running `fallow dead-code --fail-on-issues`
  *without* `--boundary-violations` exits **1** (10 files, 190 exports,
  8 circular deps). With `--boundary-violations` it exits **0**. So the zero is a
  real zero-violations result, not a suppressed exit code.
- `fallow audit` was left without `--fail-on-issues` per the correction; it
  already exits 1 on a fail verdict and defaults to `--gate new-only`.

**2. [Rule 3 - Verification method] Resolver-based importer check instead of greps**

- **Issue:** Path-suffix greps cannot see relative intra-extension imports.
- **Fix:** Programmatic module-specifier resolution (described above).
- **Outcome:** Same verdict as the plan (6 delete / 4 keep), reached by a method
  that cannot produce the false negative the grep approach risked.

**3. [Formatting] `yamlfmt` collapsed the folded CI command**

The `run: >-` folded scalar for the audit step was rewritten by the `yamlfmt`
pre-commit hook onto a single line. Accepted; `yamllint`, `yamlfmt`, and
`check-yaml` all pass on the final file.

## Verification Results

| Check | Result |
|-------|--------|
| `fallow list --boundaries` | 12 zones, 12 rules, all 5 bridge zones present |
| `npm run fallow` (before deletions) | exit 0, zero boundary violations |
| `npm run fallow` (after deletions) | exit 0, zero boundary violations |
| `--unused-files` after deletions | 4 files, all deliberately retained; the 6 deleted no longer appear |
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| **`npm run check`** | **pass (exit 0)** — typecheck, lint, format:check, unit, integration |
| `prettier --check .fallowrc.json package.json` | pass |
| `check-yaml` / `yamllint` / `yamlfmt` | pass |
| trufflehog filesystem scan | exit 0, `verified_secrets: 0`, `unverified_secrets: 0` |
| `pre-commit run --files ...` | all pass except trufflehog (structural worktree failure, documented in CLAUDE.md) |
| `gitlint` | pass |
| Commit message | title 53 chars, no body line over 80, pure ASCII |

## Notes for the Orchestrator

- `.planning/` docs were **not** committed, per instruction. Only implementation
  files are in `1d4f478b` (this includes `.planning/codebase/STACK.md` and
  `CONVENTIONS.md`, which are Task 2d implementation).
- `STATE.md` and `ROADMAP.md` were **not** modified.
- Version was **not** bumped and `CHANGELOG.md` was **not** edited, per
  instruction — that is offered separately at PR time.

## Known Stubs

None.

## Self-Check: PASSED

- `.fallowrc.json` exists at the worktree root.
- All six deleted files confirmed absent; all four retained files confirmed present.
- Commit `1d4f478b` exists on `features/fallow-static-analysis-spike`.
- `git status --porcelain` shows only the untracked planning directory.
