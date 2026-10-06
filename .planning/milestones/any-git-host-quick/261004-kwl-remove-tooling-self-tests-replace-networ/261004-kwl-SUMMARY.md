---
phase: 261004-kwl
plan: 01
subsystem: architecture-gates
tags: [eslint, nfr-5, d-11, test-cleanup, tooling]
status: complete
requires: []
provides:
  - "eslint.config.js BLOCK C ledger zones (D-11)"
  - "eslint.config.js BLOCK F network-free rules (NFR-5) with NETWORK_FREE_TARGETS"
affects:
  - tests/architecture
  - eslint.config.js
tech-stack:
  added: []
  patterns:
    - "Architecture rules enforced as ESLint rules at the offending line instead of source-scan tests"
    - "Shared rule options hoisted into constants so a files-scoped block can restate them"
key-files:
  created: []
  modified:
    - eslint.config.js
    - tests/architecture/gate-targets.ts
    - tests/architecture/compat-01-no-expansion.test.ts
    - tests/architecture/no-test-only-production-surface.test.ts
  deleted:
    - tests/architecture/import-boundaries.test.ts
    - tests/architecture/no-orchestrator-network.test.ts
    - tests/architecture/gate-targets.test.ts
    - tests/architecture/unowned-exports-census.test.ts
    - tests/architecture/fallow-report.ts
    - tests/architecture/fallow-production-mode.test.ts
    - tests/architecture/eslint-effective-config.test.ts
    - tests/architecture/eslint-effective-config.ts
    - tests/architecture/unit-suite-glob-completeness.test.ts
    - tests/architecture/unused-type-member-gate.test.ts
decisions:
  - "NFR-5 network-free rule lives in eslint.config.js BLOCK F; NETWORK_FREE_TARGETS is declared only there"
  - "D-11 ledger-import rule lives in eslint.config.js BLOCK C as four import-x zones (cross-family and intra-family)"
  - "Tooling self-tests (fallow scope, export census, unit glob, type-member wiring, registry gate, effective ESLint config, compile-time false controls) are retired; each tool's run over the real tree is its proof"
metrics:
  duration: "~45 min"
  completed: 2026-10-04
actuals:
  tokens: 47031
  tasks: 3
  commits: 3
plan_head_before: 5e161ce3c3a75cb3be909c65e27591f456bb33a0
plan_head_after: babd67ccfb0727d54a0c60b98925bcfa1705bbd6
---

# Quick Task 261004-kwl: Replace the network and ledger gates with ESLint rules; remove tooling self-tests

The NFR-5 network-free rule and the D-11 ledger-import rule now live in `eslint.config.js` and report at the offending line. Their tests are deleted, as are the tooling self-tests and compile-time controls. The finished tree passes `npm run check` (exit 0, 679 s, 8364 unit tests).

This implements the user's decision to trust the toolset. STATE.md can record two facts. First, the network-free and ledger rules live in `eslint.config.js` (BLOCK F and BLOCK C). Second, the tooling self-tests are retired.

## Commits

| Task | Commit | Title | Shortstat |
| ---- | ------ | ----- | --------- |
| 1 | `ee970169` | test(architecture): enforce ledger imports with ESLint zones | 4 files, +58 / -469 |
| 2 | `20218c4c` | test(architecture): move the network-free gate into ESLint | 36 files, +330 / -854 |
| 3 | `babd67cc` | test: remove tooling self-tests and type-gate controls | 12 files, +11 / -1619 |

`git rev-list --count 5e161ce3..HEAD` = 3.

## New ESLint rules

- **BLOCK C (D-11).** Four `import-x/no-restricted-paths` zones follow the eight layer zones and use the `PLUGIN_LEDGERS` and `MARKETPLACE_LEDGERS` constants:
  - orchestrators/marketplace/ must not import a plugin ledger.
  - A plugin ledger must not import a marketplace ledger.
  - Plugin ledgers must not import each other.
  - Marketplace ledgers must not import each other.
- **BLOCK F (NFR-5 / PI-2 / PL-3 / PRL-07).** The block uses `files: NETWORK_FREE_TARGETS`, which holds 27 paths, all present. It does not list `update-flow.ts` or `update-preflight.ts`.
  - `no-restricted-imports` restates the Pi peer path and adds a `platform/git` regex pattern. The pattern also catches type-only imports.
  - `no-restricted-syntax` restates the seven IL-2 selectors (`...OUTPUT_DISCIPLINE_SELECTORS`) and adds the five selectors in `NETWORK_FREE_SYNTAX_SELECTORS`. They cover dynamic `import()`, type-position `import()`, identifiers and private names, string literals, and template text.
- BLOCK A now uses `...OUTPUT_DISCIPLINE_SELECTORS`, and BLOCK E uses `paths: [PI_PEER_IMPORT_RESTRICTION]`. Their behavior is unchanged.

## Lint-only offender results (D-04)

Nothing was written to disk. Each offender went through `ESLint#lintText` with the real config and a real file path.

- Task 1 verify printed `ledger plants fired`. A type-only import fired in each of the four zones.
- Task 2 verify printed `network plants fired on a listed file and stayed off an exempt one`. On `info.ts`, every form was reported: type-only `platform/git` import, Pi peer import, dynamic import, type-position `import()`, `gitOps` member, string key, and the IL-2 `console.log`. On `update-flow.ts`, no NFR-5 message appeared, and the IL-2 and Pi peer messages still fired.
- Extra probe on `info.ts`:
  - `#gitOps` private field: 2 NFR-5 messages.
  - Template text naming `gitOps`: 1.
  - `export { DEFAULT_GIT_OPS } from`: 2.
  - `gitOpsSeam` identifier plus a `// gitOps` comment: 0, as intended.
- The real tree passed `npm run lint` in each commit's broad pre-commit run.

## `npm run lint:type-members` (Task 2)

Passed: "Unused type member gate passed with 4 recorded exception(s)." All 19 extension files kept their line counts: numstat showed added = deleted for each file.

## Pre-commit runs

Node v26.10.0 for all three runs. Each run was `pre-commit run --verbose --files <modified paths>`, with output in `/tmp/kwl-precommit-taskN.log`. Each selected the broad scope: format:check, typecheck, lint, lint:workflows, fallow, test:corresponding, plus the selected tests.

| Task | Commit | Exit | Scope / reason | check-changed durationMs | exitStatus | lockWaitMs | npm changed hook | TruffleHog |
| ---- | ------ | ---- | -------------- | ------------------------ | ---------- | ---------- | ---------------- | ---------- |
| 1 | ee970169 | 0 | broad: eslint.config.js, import-boundaries.test.ts (5 files) | 98476 | 0 | 2 | 99.41 s | 112.85 s |
| 2 | 20218c4c | 0 | broad: eslint.config.js, reconcile/README.md, gate-targets.test.ts, no-orchestrator-network.test.ts (37 files). The run also included direct coverage for the extension pairs and `test:architecture`. | 201266 | 0 | 1 | 202.11 s | 12.96 s |
| 3 | babd67cc | 0 | broad: the seven deleted files (13 files). The run also included direct coverage for hook-events, notification-types, and notify-reasons. | 44467 | 0 | 1 | 45.44 s | 12.17 s |

The Fallow audit (`--gate-marker agent`) returned `pass` before each commit. It reported 2 duplication clone groups, which are inherited from before this task (the hooks-hydration loop in `enable-disable.ts` and `install-flow.ts`). This task changed no code there.

## Final verification

The explicit `npm run check` below is the full verification of the finished tree. The hooks supplied only focused and broad evidence.

- `HEAD=babd67ccfb0727d54a0c60b98925bcfa1705bbd6 NODE=v26.10.0 CACHE_EMPTY=yes CHECK_EXIT=0 CHECK_SECONDS=679`. The run deleted `node_modules/.cache/eslint/` before it started.
- Unit: `tests 8364, suites 333, pass 8364, fail 0, cancelled 0, skipped 0, todo 0, duration_ms 341060.181847`
- Integration: `tests 67, suites 0, pass 67, fail 0, cancelled 0, skipped 0, todo 0, duration_ms 13308.539458`

| Metric | Before (261004-f34 final) | After |
| ------ | ------------------------- | ----- |
| `npm run check` seconds | 669 | 679 |
| Unit tests | 8399 | 8364 |
| Unit `duration_ms` | 329656 | 341060 |
| Integration tests | 67 | 67 |
| Integration `duration_ms` | 12634 | 13309 |

Each figure comes from a single run on one machine. The run took 10 s longer even though it ran 35 fewer cases. The deleted cases were short, so the difference is within run-to-run noise rather than a measured cost.

## Removed

- **Files (10):**
  - `import-boundaries.test.ts`
  - `no-orchestrator-network.test.ts`
  - `gate-targets.test.ts`
  - `unowned-exports-census.test.ts`
  - `fallow-report.ts`
  - `fallow-production-mode.test.ts`
  - `eslint-effective-config.test.ts`
  - `eslint-effective-config.ts`
  - `unit-suite-glob-completeness.test.ts`
  - `unused-type-member-gate.test.ts`

  All ten are under `tests/architecture/`.
- **Test cases:** 8399 - 8364 = **35**, which matches the plan. Task 1 removed 5, Task 2 removed 10, and Task 3 removed 20, including the 2 hook-events planted-compile cases.
- **Compile-time controls:**
  - The hook-events loop and its four imports (`fs/promises`, `os`, `path`, `typescript`).
  - The notify-reasons partition controls.
  - The `false` proofs in notify-closed-set-locks (2) and notification-types (5).
- **Registry:** 20 exports were deleted in total. Task 1 deleted 2, Task 2 moved 1 out, and Task 3 deleted 17. 21 exports remain, and each one has an importer.
- **Lines by area** (`git diff --shortstat 5e161ce3 HEAD`): 48 files, +398 / -2941 in total.

  | Area | Files | Added | Deleted |
  | ---- | ----- | ----- | ------- |
  | eslint.config.js | 1 | 286 | 47 |
  | extensions | 19 | 46 | 46 |
  | docs | 3 | 4 | 4 |
  | tests | 25 | 62 | 2844 |

- CHANGELOG.md and `.planning/codebase/*.md` are unchanged.

## Judgment calls (from the plan's "Choices made")

All were applied as planned:

- Intra-family ledger zones were added.
- Type-position `import()` in a marketplace file stays uncovered by BLOCK C (T-kwl-04).
- IL-2 and Pi peer options were hoisted and restated, because a later flat-config block replaces earlier options.
- The selectors also cover type-position import, string, template, and private-name forms.
- Silent misses on renamed paths are accepted (T-kwl-03).
- Offenders were tested lint-only, never planted on disk.
- The registry gate was deleted in Task 2.
- The compat-01 delegation case was deleted, not re-pointed.
- `MARKETPLACE_LEDGER_TARGETS` stays as a type-annotation source.
- The registry was pruned by consumer grep.
- Extension comment line counts were preserved.
- The ESLint content cache was deleted only before the final check.

Out-of-scope staleness, reported and not edited:

- The reconcile README "Preview path" section describes `preview.ts`, which no longer exists.
- `workflows-staging-gc.ts` names `install.ts`, which no longer exists.
- `.planning/codebase/*.md` still describes both deleted gates.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stale group name in a surviving registry doc (Task 1)**

- **Found during:** Task 1 verify.
- **Issue:** The `ZONE_REPRESENTATIVE_TARGETS` doc said "in `ZONE_FOLDER_TARGETS` order". The verify grep rejects any mention of the deleted group.
- **Fix:** Reworded it to "one real module per layer zone folder, in BLOCK C zone order." Task 3 deleted the group anyway.
- **Files modified:** tests/architecture/gate-targets.ts
- **Commit:** ee970169

**2. [Rule 3 - Blocking] CIT-19 OLD text ended mid-line**

- **Found during:** Task 2.
- **Issue:** In `workflows-staging-gc.ts`, the paragraph's last line continues with "It needs no state load", followed by one more line. The plan's OLD block ended at "directly." and did not match the file.
- **Fix:** Rewrote the whole 7-line paragraph in the same 7 lines. The meaning is the same as the plan's NEW text, reflowed to absorb the trailing sentence. The line count is unchanged, so no type-member pin moved.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts
- **Commit:** 20218c4c

**3. Hook runs in the background (Tasks 1 and 3)**

The plan said to run the Task 1 and Task 3 hooks in the foreground. I ran each once in the background and waited for its completion notification, because the constraints allow this when a run may exceed the 10-minute foreground limit. Each run was not polled and not piped, and each log ends with `PRECOMMIT_EXIT=0`.

The plan-commit ledger file (`.git/gsd-plan-head-before-*`) was not written. The base comes from `/tmp/kwl-start.txt` (5e161ce3), and `commits: 3` was measured from that base.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- The 10 deleted files are absent.
- Commits ee970169, 20218c4c, and babd67cc exist on `features/faster-precommit`.
- `/tmp/kwl-final.txt` records CHECK_EXIT=0.
- `git status --short` lists only the `.planning/quick/261004-kwl-*` directory.
- `.git/check-changed-full.lock` is absent.
