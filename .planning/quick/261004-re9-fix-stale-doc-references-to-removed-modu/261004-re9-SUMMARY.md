---
phase: 261004-re9
plan: 01
subsystem: docs
tags: [docs, comments, eslint, nfr-5, d-11, reconcile]
status: complete
requires: []
provides:
  - reconcile README that names pending.ts and every module in its directory
  - orchestrator comments that name install-outcome.ts, reinstall-flow.ts, and BLOCK F
  - codebase docs that describe BLOCK C, BLOCK F, the current check chain, and the real-tree-proof gate policy
affects:
  - .planning/codebase/ARCHITECTURE.md
  - .planning/codebase/CONVENTIONS.md
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/README.md
    - extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts
    - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - .planning/codebase/ARCHITECTURE.md
    - .planning/codebase/CONVENTIONS.md
    - .planning/codebase/INTEGRATIONS.md
    - .planning/codebase/STRUCTURE.md
    - .planning/codebase/TESTING.md
decisions:
  - Scope limited to sentences that name a deleted file or npm script, describe a deleted test by role, or carry a reported rename; other staleness is reported, not edited
  - workflows-staging-gc.ts names install-outcome.ts, the gated install owner that imports the workflows bridge
  - The CONVENTIONS planted-violation bullet is rewritten to the current real-tree-proof policy, not deleted
metrics:
  duration: ~10 min
  completed: 2026-10-05
actuals:
  tokens: 10934
  tasks: 3
  commits: 3
plan_head_before: a55e8ba5e0bfa0cd33dcd8f359f1ef5fd04e43bf
plan_head_after: 67ba13cb90faf3f6268c1a3ae294a3556f6c2dca
---

# Quick Task 261004-re9: Fix stale doc references to removed modules and tests Summary

The reconcile README, three orchestrator comments, and five `.planning/codebase/` docs now name `pending.ts`, `install-outcome.ts`, `reinstall-flow.ts`, ESLint BLOCK C / BLOCK F, and the current `npm run check` chain instead of deleted modules, tests, and scripts.

## Commits

| Task | Commit | Title | Shortstat |
| ---- | ------ | ----- | --------- |
| 1 (tracer) | 119aee22 | docs(reconcile): describe the pending orchestrator in the README | 1 file, +15 / -12 |
| 2 | 7b9ed0fb | docs(orchestrators): name current modules and gates in comments | 3 files, +6 / -6 |
| 3 | 67ba13cb | docs(planning): describe the ESLint network and ledger gates | 5 files, +15 / -17 |

## Verification evidence

Node v26.10.0 throughout. Verification scope: focused task verification passed; full phase/PR verification pending. No `npm run check` ran.

| Task | `<verify>` | `pre-commit run --files <task paths>` | `.git/check-changed.log` | fallow audit |
| ---- | ---------- | ------------------------------------- | ------------------------ | ------------ |
| 1 | exit 0 (no `preview`, all new names present, Files tree lists all 10 entries, `no-stale-test-citations.test.ts` 1/1 pass) | exit 0 (mdformat, markdownlint, smartquotes, unicode-dashes, TruffleHog passed) | `scope: broad`, `durationMs: 78188`, `exitStatus: 0` | `pass` |
| 2 | exit 0 | exit 0 | `scope: focused`, `durationMs: 86170`, `exitStatus: 0` | `pass` |
| 3 | exit 0 (negative grep clean, check chain matches `package.json` in both docs, Network boundary bullet names all 27 targets) | exit 0 | `scope: none` ("No executable inputs changed"), `durationMs: 118`, `exitStatus: 0` | `pass` |

Task 2 extras:

- `npm run lint:type-members`: `Unused type member gate passed with 4 recorded exception(s).`
- Numstat parity (added = removed, every changed line a `//` line): `auth-host.ts` 2/2, `uninstall.ts` 1/1, `workflows-staging-gc.ts` 3/3.

Final state: `git status --short` lists only `.planning/quick/261004-re9-*`; CHANGELOG.md unchanged since a55e8ba5; no `.git/check-changed-full.lock`.

## Choices made

- **Scope.** Edit only sentences that (a) name a file or npm script this branch deleted, (b) describe a deleted test by its role, or (c) carry a reported rename. STRUCTURE.md and CONCERNS.md also name modules removed before this branch; those 2026-08-18 snapshots need a `/gsd-map-codebase` refresh, not reference patches.
- **`workflows-staging-gc.ts` names `install-outcome.ts`**, the gated install owner that imports the workflows bridge.
- **The CONVENTIONS planted-violation bullet is rewritten, not deleted.** It now states the real-tree-proof policy and where the D-11 and NFR-5 rules live (BLOCK C and BLOCK F).
- **TESTING.md examples** use existing gates: `reconcile-planner-purity.test.ts` and `no-shell-out.test.ts`.
- **ARCHITECTURE Circular imports** keeps the fact that per-issue flags narrow a fallow run.
- **Verification** is per-commit pre-commit plus each task's `<verify>`; no `npm run check`.
- **CHANGELOG.md unchanged** (internal docs and comments only).

## Deviations from Plan

None - plan executed exactly as written. (The first fallow audit attempt for Task 2 mixed a stderr WARN line into the JSON capture; re-running with stderr separated returned verdict `pass`. Not a plan deviation.)

## Out-of-scope staleness

Not edited here. Recommendation: refresh `.planning/codebase/` through `/gsd-map-codebase`, and fix the four outside-`.planning/` sites (item 8) in a follow-up quick task.

1. `.planning/codebase/STRUCTURE.md` (2026-08-18 snapshot) names modules that no longer exist:
   - `orchestrators/plugin/install.ts`, in Directory Purposes, Core Logic, Naming Conventions, and Where to Add New Code
   - `orchestrators/plugin/update.ts`
   - `domain/resolver.ts`
   - `shared/notify.ts`

   Its per-directory file lists and line counts predate the module splits. It needs a `/gsd-map-codebase` refresh.
2. `.planning/codebase/CONCERNS.md` (2026-08-18 snapshot):
   - It cites `orchestrators/plugin/install.ts:2423`.
   - Its CI `paths-ignore` concern is resolved: `.github/workflows/ci.yml` no longer ignores Markdown. That concern also cites `tests/architecture/catalog-uat.test.ts`, which is now `tests/architecture/catalog-uat/catalog-contract.test.ts`.
   - It describes `.fallowrc.json` as `production: false`. The value is now an object.

   It needs a re-audit.
3. `.planning/codebase/STACK.md`, from PR #234:
   - The pre-commit bullet names local hooks `npm-lint`, `npm-format-check`, `npm-typecheck`, and `npm-fallow`. The config now has `prettier` and `npm-check-changed`.
   - The `ci.yml` bullet lists jobs `integration-tests` and `e2e-tests`. The jobs are now `check`, `sonarcloud`, `direct-coverage`, and `package`.
4. `.planning/codebase/CONVENTIONS.md`:
   - `production: false`.
   - "Seven exact type-only owners", where `eslint.config.js` lists ten.
   - The suppressions bullet cites `scripts/revalidation.mjs`, which does not exist.
   - `npm run fallow:audit` is not a script.
   - The line references `eslint.config.js:77`, `:94`, and `:145,158,172,315`.
5. `.planning/codebase/ARCHITECTURE.md`: the notify bullet's `eslint.config.js:130` and `:143` line references.
6. `.planning/codebase/TESTING.md`, Coverage section: the "Requirements" line says coverage is not gated in `npm run check`. The check runs `test:coverage:unit` with 100% line, function, and branch thresholds.
7. `.planning/codebase/INTEGRATIONS.md`: the network-policy sentence omits the D-03-03 amendment, under which a version-constrained dependency may read its source repository's tag list.
8. Outside `.planning/`:
   - `.github/workflows/ci.yml:19` and `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:715` cite `catalog-uat.test.ts`. (`ci.yml` is left to quick task 261004-rpt.)
   - `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts` lines 5-7 credit a grep gate in `tests/orchestrators/marketplace/info.test.ts`. That test has no such gate. BLOCK F lists the file.
   - `tests/architecture/no-probe-in-workflows-bridge.test.ts:15` names a `FORBIDDEN_TARGETS` constant that the file does not declare.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- All nine modified files exist.
- Commits 119aee22, 7b9ed0fb, 67ba13cb are on `features/faster-precommit`; `git rev-list --count a55e8ba5..HEAD` = 3.
