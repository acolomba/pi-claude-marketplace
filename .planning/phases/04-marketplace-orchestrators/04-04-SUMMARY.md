---
plan: 04-04
phase: 04-marketplace-orchestrators
status: complete
tasks_completed: 2
tasks_total: 2
---

# Plan 04-04 Summary: Phase 4 Test Infrastructure

## Goal achieved

Landed the Phase 4 test infrastructure that every Wave 4 marketplace orchestrator test depends on: an in-memory `GitOps` mock factory with call logs and override hooks, plus three marketplace JSON fixtures (`valid-marketplace`, `invalid-manifest`, `empty-marketplace`) under `tests/orchestrators/marketplace/_fixtures/`.

## Tasks

### Task 1: tests/helpers/git-mock.ts

Created the in-memory `GitOps` mock factory implementing all five `GitOps` methods (`clone`, `fetch`, `forceUpdateRef`, `checkout`, `resolveRef`). The factory exposes:

- **`MockGitState`** interface -- `remoteRefs` / `localRefs` maps, `head` SHA, `fixtureSourceDir` (optional copy-on-clone source), five `*Calls` arrays for D-14 sequence assertions, three throw-override hooks (`cloneThrows`, `fetchThrows`, `checkoutThrows`) so tests can simulate failure paths.
- **`MockGitOpsHandle`** interface -- `{ gitOps: GitOps; state: MockGitState }`.
- **`makeMockGitOps(initial?)`** factory function -- returns a fresh handle. `clone()` honours `fixtureSourceDir` via `node:fs/promises::cp({ recursive: true })`. `checkout()` throws on unknown refs (matching isomorphic-git's SHA-no-longer-exists behaviour); accepts 40-char hex SHAs as direct refs. `resolveRef()` walks local refs → remote refs → `HEAD` fallback → `refs/remotes/origin/HEAD` fallback.
- **`fixtureMarketplaceDir(name)`** -- returns the absolute path to `tests/orchestrators/marketplace/_fixtures/<name>` so test files don't recompute it.

Commit: `feat(04-04): add tests/helpers/git-mock.ts in-memory GitOps factory`

### Task 2: tests/orchestrators/marketplace/_fixtures/ + lint fixes

Created three fixture marketplaces, each with a `.claude-plugin/marketplace.json` at the fixture root (mirroring PRD §6.3's `<repoRoot>/.claude-plugin/marketplace.json` layout per MA-3):

- **`valid-marketplace/`** -- happy path; one plugin entry `{ name: "hello", source: "./plugins/hello", description, version }`; passes `MARKETPLACE_VALIDATOR.Check`.
- **`invalid-manifest/`** -- syntactically broken JSON (missing closing brace + bracket, trailing comma after `"broken"`). Drives the MA-9 cleanup catch path; `JSON.parse` throws so `addMarketplace`'s staging cleanup runs.
- **`empty-marketplace/`** -- valid; `plugins: []`. Drives MU-1 silent-succeed path (bare-form update against an empty marketplace) and the cascade-no-op path.

Added a `README.md` documenting each fixture's purpose. Tooling adjustments to accommodate the intentionally-malformed fixture:

- `.prettierignore` -- added `tests/orchestrators/marketplace/_fixtures/invalid-manifest/.claude-plugin/marketplace.json` so `npm run format:check` doesn't choke on the broken JSON.
- `.pre-commit-config.yaml` -- added `exclude: ^tests/orchestrators/marketplace/_fixtures/invalid-manifest/` to the `check-json` hook for the same reason.

Commit: `feat(04-04): add marketplace test fixtures + git-mock lint fixes`

## Deviations from plan

**Rule 1 auto-fix -- `git-mock.ts` async-no-await.** The verbatim plan declares `fetch`, `checkout`, and `resolveRef` as `async` (to match the `GitOps` interface's `Promise<void>`/`Promise<string>` return types) but with bodies that never `await`. ESLint's `@typescript-eslint/require-await` flags this. Added an explicit `await Promise.resolve()` no-op marker in each -- semantically equivalent (an `async` function returning a `Promise<T>` with no actual async work still returns a `Promise<T>`).

**Rule 1 auto-fix -- `.prettierignore` + `.pre-commit-config.yaml`.** The plan doesn't anticipate that `prettier --check` and pre-commit's `check-json` hook both fail on the intentionally-malformed `invalid-manifest/.claude-plugin/marketplace.json`. Added narrow exclude entries for that one file path -- preserves coverage for every other JSON in the tree.

## Key files created/modified

- `tests/helpers/git-mock.ts` -- created (199 lines)
- `tests/orchestrators/marketplace/_fixtures/valid-marketplace/.claude-plugin/marketplace.json` -- created
- `tests/orchestrators/marketplace/_fixtures/invalid-manifest/.claude-plugin/marketplace.json` -- created (intentionally malformed)
- `tests/orchestrators/marketplace/_fixtures/empty-marketplace/.claude-plugin/marketplace.json` -- created
- `tests/orchestrators/marketplace/_fixtures/README.md` -- created
- `.prettierignore` -- added one exclude line
- `.pre-commit-config.yaml` -- added one `exclude:` line on `check-json`

## Verification

- `npm run check` -- typecheck + ESLint + Prettier + 470 tests all pass
- `test -f tests/helpers/git-mock.ts && grep -q "export function makeMockGitOps" …` -- present
- `test -f tests/orchestrators/marketplace/_fixtures/valid-marketplace/.claude-plugin/marketplace.json` -- present
- `test -f tests/orchestrators/marketplace/_fixtures/invalid-manifest/.claude-plugin/marketplace.json` -- present (negative JSON parse)
- `test -f tests/orchestrators/marketplace/_fixtures/empty-marketplace/.claude-plugin/marketplace.json` -- present
- `test -f tests/orchestrators/marketplace/_fixtures/README.md` -- present
- `node -e "JSON.parse(...)"` -- passes on valid + empty, fails on invalid (as expected)

## What this enables

Wave 4 orchestrator tests can import:

- `makeMockGitOps`, `fixtureMarketplaceDir` from `tests/helpers/git-mock.ts`
- The three fixture marketplaces to drive happy-path, MA-9 cleanup, and MU-1 silent-succeed scenarios

This unblocks `04-05 add.test.ts`, `04-06 remove.test.ts`, `04-08 update.test.ts`, and (transitively) `04-07 list.test.ts` and `04-09 autoupdate.test.ts`.

## Self-Check: PASSED

- [x] All tasks executed (2/2)
- [x] Each task committed individually (2 commits: git-mock → fixtures)
- [x] SUMMARY.md created in plan directory
- [x] No modifications to STATE.md or ROADMAP.md (orchestrator owns those writes)
- [x] `npm run check` green
