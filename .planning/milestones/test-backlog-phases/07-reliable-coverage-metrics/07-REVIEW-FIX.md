---
phase: 07-reliable-coverage-metrics
fixed_at: 2026-09-18T22:10:00Z
review_path: .planning/phases/07-reliable-coverage-metrics/07-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 07: Code Review Fix Report

**Fixed at:** 2026-09-18T22:10:00Z
**Source review:** .planning/phases/07-reliable-coverage-metrics/07-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (WR-01..WR-05; `fix_scope: critical_warning`, no CR/BL findings)
- Fixed: 5
- Skipped: 0

Every fix carries a `node:test` control that fails against the pre-fix code (each was run against the reverted source before committing) and passes after.

## Fixed Issues

### WR-01: Risk gate reads the map path from an unverified manifest field

**Files modified:** `scripts/check-coverage-risk.mjs`, `tests/scripts/check-coverage-risk.test.ts`
**Commit:** feefd42c
**Applied fix:** `riskVerdict` now builds `mapPath` from the imported `PUBLIC_ISTANBUL_PATH` constant, the path whose digest `verifyCaptureBundle` checks, instead of `manifest.acceptance.artifacts.public.istanbul`. Control: rewrites the pointer in both manifest copies to a nonexistent path and expects the gate to pass with the same report. The optional "refuse a divergent pointer" hardening was not added: with the constant in place the pointer no longer selects anything, so the smaller change closes the hole without a new refusal kind.

### WR-02: Producer code runs before its identity is qualified

**Files modified:** `scripts/coverage-producer.convert.mjs`, `tests/scripts/coverage-producer.test.ts`
**Commit:** bc8f5496
**Applied fix:** `loadProducer` computes `identity` and `deliveryFailures` from the bytes on disk and throws for an unqualified installed producer before `await import(entryUrl)`; the `convert` export check follows the import. Receipt identity/delivery fields are unchanged. Control: a child process installs a `module.registerHooks` load hook, calls `loadProducer` against a root whose lockfile does not resolve the delivery, and asserts the `ProducerError` kinds plus that no `node_modules/ast-v8-to-istanbul/` URL was evaluated.

### WR-03: Public artifacts survive a non-refusal crash of the acceptance pipeline

**Files modified:** `scripts/coverage-unit.mjs`, `tests/scripts/coverage-unit.test.ts`, `docs/coverage-metrics.md`
**Commit:** 958ce3c4
**Applied fix:** `refuse` calls `removePublicArtifacts(root)` before classifying the error, so a crash and a refusal leave the same public state; header comment and docs ("A refusal or a crash ... removes every public artifact") updated. Control: a fixture unit test plants a directory at `<run>/unit.request.json` via `PI_CM_COVERAGE_RUN_DIR`, so the pipeline crashes with EISDIR after the capture published; the case expects exit 1, no `{ kind }` rows, no public file, and one retained run directory.

### WR-04: Consumer stderr is discarded when Fallow fails

**Files modified:** `scripts/check-coverage-risk.mjs`, `tests/scripts/check-coverage-risk.test.ts`
**Commit:** 54857a54
**Applied fix:** `consumerReport` re-emits the consumer's stderr (indented, via the existing `reemit`) on the launch/signal path and on a non-zero status, before throwing the status row. Deviation from the suggested unconditional relay: Fallow prints a `WARN node_modules directory not found` line on stderr even when it reports successfully, so an unconditional relay put that noise on a passing gate's stderr and broke the cases that pin `stderr: ""`. The relay is therefore limited to the no-report paths the finding names. Control: a stand-in consumer writes one message and exits 3; the case asserts the exact stderr (relayed line, refusal message, status row).

### WR-05: Run directories grow without bound

**Files modified:** `scripts/coverage-unit.mjs`, `tests/scripts/coverage-unit.test.ts`, `tests/architecture/coverage-metrics-pipeline.test.ts`, `docs/coverage-metrics.md`
**Commit:** 0844c2a7
**Applied fix:** After `publish` succeeds (bundle written and read back), `pruneSupersededRuns` removes every entry of `coverage/runs/` in the capture's run-id form (`/^[0-9TZ]+-[0-9a-f]{8}$/u`) other than the accepted run. A refusal prunes nothing (its evidence and the last accepted run stay); entries not in run-id form are left alone. Docs updated in the run-directory paragraph. Controls: new case (accepted run, then a failed run, then a replacement beside a foreign `not-a-run/` directory expects `[accepted.runId, "not-a-run"]`); the "second run of an unchanged tree" case now reads the first run's map and summary before the replacement removes its directory; the architecture case "captures again once a production source changed" now expects `runs: [report.runId]` rather than a count of 2. Effect observed in this checkout: `coverage/runs` went from three directories (about 2.4 GB) to one after the hook's capture.

## Skipped Issues

None.

## Verification

- `node --test tests/scripts/coverage-*.test.ts tests/scripts/check-coverage-risk*.test.ts`: 210 pass, 0 fail (final tree).
- `node --test tests/architecture/coverage-metrics-pipeline.test.ts`: 30 pass.
- `npm run coverage:unit:negative`: 32 of 32; `npm run coverage:risk:negative`: 20 of 20.
- `npx tsc --noEmit`, `npx eslint`, `npx prettier --check` on the touched files: clean. `npm run fallow`: exit 0.
- `SKIP=trufflehog pre-commit run --files <all touched files>` on the final tree: every hook Passed, including `npm-coverage-unit` (full 6900-test capture, verified bundle) and `npm-coverage-risk`. Trufflehog `filesystem` scan: 0 verified, 0 unverified.
- Where verification ran: in the main checkout (`/home/acolomba/src/pi-claude-marketplace-test-backlog`, branch `features/test-backlog`), not in an isolated worktree. The project rules for this run direct committing in this linked worktree and forbid creating branches; a nested hand-rolled worktree would also lack `node_modules` for the hooks. No `.review-fix-recovery-pending.json` sentinel was written and no temporary branch exists.
- Commit sequencing: all edits were made first, the full hook set was run once on the final tree (the pre-commit config's coverage hooks recapture on every script change, ~8 min each), and the five commits were then cut from that verified tree by staging per-finding hunks (`git apply --cached`). The intermediate commit states were not individually run through the coverage hooks; each finding's fix and control are independent and each control was run in isolation.
- Commit messages: Conventional Commits (`fix(coverage): ...`), gitlint clean, no planning references, required trailers present. Committed with `git commit -F`, explicit paths only.

---

_Fixed: 2026-09-18T22:10:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
