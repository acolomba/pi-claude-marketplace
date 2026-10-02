---
quick_id: 261001-iad
status: complete
description: Deduplicate CI checks and run isolated direct coverage pairs concurrently
---

# CI deduplication and parallel direct coverage

## Scope

First implementation of the approved build optimization work. Keep `npm run check`
and local commit hooks authoritative. Implement CI deduplication and concurrent
direct coverage before changing the local edit/check workflow.

Work runs inline on `features/ci-check-efficiency`. The quick workflow's Codex
single-agent isolation fallback applies. No production behavior changes.

## Task 1: Give each CI check one owner

Files: `.github/workflows/ci.yml`, `.github/workflows/sonarcloud.yml`,
`.github/workflows/lint.yml`, `.github/workflows/publish.yml`, and a focused
architecture regression test.

Action: Keep the complete npm check in CI. Remove the standalone integration job
because that suite already runs in the check chain. Upload its accepted unit
coverage and call Sonar as a dependent reusable workflow, downloading only the
current run's report. Keep fork/Dependabot secret restrictions and prevent nested
workflow concurrency collisions. The lint workflow runs unique hygiene hooks and
the separate Fallow audit; redundant local hooks remain active locally. Preserve
the complete release dependency chain and pinned and nightly end-to-end tests.

Verify: Exercise workflow wiring assertions, the workflow-install-scripts gate,
YAML/workflow security validators, and the existing architecture wiring tests.

Done: Unit coverage, integration, and pinned end-to-end tests each have one CI
execution. Sonar cannot consume another run's report or rerun tests. Every skipped
CI hook has an explicit authoritative replacement.

## Task 2: Run direct coverage pairs concurrently

Files: `scripts/test-coverage-direct.mjs`, its negative controls and report command,
and `CONTRIBUTING.md`.

Action: Replace blocking pair subprocesses with asynchronous child processes and
use a bounded worker pool. Preserve separate processes, temporary coverage files,
all pin comparisons, deterministic returned records, streamed report completeness,
and nonzero failures. Drain started work before rejecting. Provide a conservative
default and a serial override for diagnosis and performance comparisons.

Verify: Negative controls prove the bound, overlap, completion ordering, failure
propagation, and pin/report checks. Compare serial and parallel real pair runs,
then run the full all-pair gate under the CI Node version when available.

Done: Both changed-pair and all-pair gates retain their coverage guarantees while
running independent pairs concurrently. The reporting command uses the same bound.

## Task 3: Verify and record

Run focused tests, full `npm run check`, applicable pre-commit hooks, and the Fallow
audit before committing. Record measurements and environmental limitations in the
summary. Keep code and planning commits separate. No PR, version bump, or publish
is part of this task.

## Threat model

Coverage artifacts remain untrusted data, scoped to the current workflow run and
exact checkout. Do not introduce privileged `workflow_run` execution, broaden
secret access, execute artifact contents, or weaken npm install-script policy.
Worker failures must never become clean coverage verdicts. Bound concurrency and
wait for active child cleanup before reporting a failed run.

## Approved follow-up work

After this first task: incremental TypeScript checking, changed-file formatting,
a conservative `check:changed` command, separate module/architecture/analyzer test
commands, and local gate scheduling. Preserve full uncached typed ESLint at the
completion boundary until dependency-aware invalidation is implemented.
