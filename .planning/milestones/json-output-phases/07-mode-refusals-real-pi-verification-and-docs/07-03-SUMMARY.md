---
phase: 07-mode-refusals-real-pi-verification-and-docs
plan: "03"
subsystem: testing
tags: [pi, json, rpc, e2e, peer-floor, ci]
requires:
  - phase: 06-command-run-contract
    provides: Command-origin outcomes and invocation identity in the production extension
provides:
  - Real CLI output and lifecycle evidence on Pi 0.87.1 and exact Pi 0.86.1
  - Isolated peer-floor manifest, lock, artifact audit, and CI provisioning
  - Positive startup-memory and RPC retrieval controls with separate persistence proof
affects: [07-04, 07-05, 07-06, json-output-documentation]
actuals:
  tokens: 24701
  tasks: 3
  commits: 3
plan_head_before: 763dc5b9a92c908c73bf2e9ce887160625e00907
plan_head_after: 80264efec45d93f66476972312025a3b3a22620b
tech-stack:
  added: ["@earendil-works/pi-coding-agent@0.86.1 (private test fixture only)"]
  patterns: [Isolated offline CLI contract shared by installed and exact-floor targets]
key-files:
  created:
    - tests/e2e/json-output-runtime.ts
    - tests/e2e/pi-json-output.test.ts
    - tests/e2e/fixtures/startup-entries.ts.txt
    - tests/e2e/pi-peer-floor/package.json
    - tests/e2e/pi-peer-floor/package-lock.json
    - .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-PEER-FLOOR-AUDIT.md
    - .planning/phases/07-mode-refusals-real-pi-verification-and-docs/deferred-items.md
  modified:
    - .github/workflows/ci.yml
    - .github/workflows/e2e-nightly.yml
    - .pre-commit-config.yaml
key-decisions:
  - Require a fixture-local manifest and realpath CLI containment before resolving the floor runtime.
  - Check each executed CLI's --version output against its package manifest.
  - Preserve the upstream fixture tree and record the pre-existing brace-expansion advisory with its constrained-input disposition.
patterns-established:
  - Keep RPC stdin open until all request-ID-correlated replies arrive, then close it for orderly shutdown.
  - Prove startup memory presence independently of stream absence and persistence timing.
requirements-completed: [TENB-03, JDOC-02]
coverage:
  - id: D1
    description: Installed Pi emits schema-valid empty-list outcomes and proves startup and persistence limits.
    requirement: TENB-03
    verification:
      - kind: e2e
        ref: "node --test --test-name-pattern='installed runtime' tests/e2e/pi-json-output.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: Exact-floor artifact identity and existing authorization are recorded before provisioning.
    verification:
      - kind: other
        ref: "npm view @earendil-works/pi-coding-agent@0.86.1 name version repository dist.integrity scripts.postinstall --json --fetch-retries=0 --fetch-timeout=15000"
        status: pass
    human_judgment: false
  - id: D3
    description: The same four real-runtime cases pass on exact Pi 0.86.1, provisioned independently for both CI e2e entry points.
    requirement: JDOC-02
    verification:
      - kind: e2e
        ref: "node --test tests/e2e/pi-json-output.test.ts"
        status: pass
      - kind: other
        ref: "node scripts/check-workflow-install-scripts.mjs"
        status: pass
    human_judgment: false
  - id: D4
    description: Per-command correlation must not become cross-session tracking, telemetry, or collection of operator credentials by test fixtures.
    verification: []
    human_judgment: true
    rationale: "flagged-unverified: the plan declares a descriptor-less judgment; no automated negative-check descriptor is invented."
duration: 18min
completed: 2026-10-10
status: complete
---

# Phase 7 Plan 3: Real-Pi Output and Peer-Floor Verification Summary

**Pi 0.87.1 and exact 0.86.1 both emit validated list outcomes, retain unstreamed startup markers, expose them through RPC, and defer slash-only session persistence.**

## Performance

- **Duration:** 18 minutes
- **Started:** 2026-10-10T02:07:25Z
- **Completed:** 2026-10-10T02:25:27Z
- **Tasks:** 3
- **Task files changed:** 9; deferred record and summary added at closeout
- **Actual token scale:** ceiling of 98,801 realized task-diff characters / 4.
- **Commit measurement:** three task commits from the persisted ledger through `80264efe`; excludes this subsequent metadata commit.

## Accomplishments

- A bounded subprocess harness loads this worktree's production extension with fresh home, project, agent, and session directories. Its environment allows only PATH and fixture-specific HOME/Pi settings. JSON stdin closes explicitly; RPC retains stdin until correlated replies arrive. Both streams have 1 MiB limits and children have 20-second deadlines. Cleanup runs in `finally`.
- Every streamed custom `claude-plugin` payload passes the compiled production schema. Every case requires a nonempty command outcome with `plugin list` identity and an empty marketplace array. Spawn errors fail even with status zero; nonzero exits, signals, malformed JSON, missing outcomes, and missing markers fail.
- A text fixture copied into a temporary TypeScript extension marks both startup hooks. A later command reads both markers from session memory and emits a proof. Tests require the markers to be absent from streamed `entry_appended` events, while the later proof and production outcome are present. RPC `get_entries` independently returns both markers.
- The persistence case omits `--no-session`, selects an explicit initially empty session directory, completes the slash command successfully, and requires zero session files.
- The floor manifest and lock pin exactly 0.86.1. Tests reject absent/mismatched manifests before resolver parent-search, enforce realpath CLI containment, and check actual `--version` output. Both pinned and nightly CI jobs provision this fixture with scripts disabled.

## Task Commits

1. **Prove live stdout, startup visibility, and slash-only persistence** — `07edb1fc` (`test: prove real Pi JSON and RPC output lifecycle`).
2. **Record authorized exact-floor package identity** — `60e00be5` (`docs: record authorized Pi peer-floor artifact audit`).
3. **Run the same contract on the separately pinned fixture in CI** — `80264efe` (`test: verify output on the exact Pi peer floor in CI`).

Every task commit passed normal hooks. The first task's initial commit attempt failed on style findings; corrections passed the retry without amending history. Shared test-support changes caused the hook to run all-pair direct coverage. No tracked files were deleted.

## Verification Evidence

Runtime: Node `v26.11.1`. Final executable inputs are committed at `80264efe`; the passing dedicated suite ran on those inputs before commit, and the hook made no later changes.

| Command / check | Result |
| --- | --- |
| `node --test --test-name-pattern='installed runtime' tests/e2e/pi-json-output.test.ts` | Exit 0; 4 passed, 0 failed/skipped. Repeated after tracer commit `07edb1fc` before expansion. |
| Exact-version `npm view` command in D2 above | Exit 0; package, version, repository, and SHA-512 match research; no postinstall. |
| `npm --prefix tests/e2e/pi-peer-floor install --package-lock-only --ignore-scripts --fetch-retries=0 --fetch-timeout=15000` | Exit 0; independent lock generated. |
| `npm --prefix tests/e2e/pi-peer-floor ci --ignore-scripts --fetch-retries=0 --fetch-timeout=15000` | Exit 0; independent fixture provisioned. |
| `node --test tests/e2e/pi-json-output.test.ts` | Exit 0; 8 passed, 0 failed/cancelled/skipped/todo; final run 16.29 seconds. |
| `node scripts/check-workflow-install-scripts.mjs` | Exit 0; both fixture provisioning steps disable scripts. |
| `fallow audit --base HEAD` before each task commit | Exit 0; final task audit reports no issues in eight changed files. |
| Explicit-file `SKIP=npm-check pre-commit run --files ...` and commit hooks | Passed after formatter/style corrections; `npm run check:commit` passed for both executable task commits. |
| Root manifests, shared tracking, baseline, and catalog diff against `763dc5b9` | Empty. |

| Runtime target | CLI version | List outcome | JSON startup controls | RPC controls | Persistence-enabled case |
| --- | --- | --- | --- | --- | --- |
| Installed runtime | 0.87.1 | Exit 0; one schema-valid command cascade | Both markers in memory; zero streamed startup markers; one later proof | Same controls plus correlated `get_entries` retrieving both markers | Exit 0; zero files |
| Peer floor | 0.86.1 | Exit 0; one schema-valid command cascade | Both markers in memory; zero streamed startup markers; one later proof | Same controls plus correlated `get_entries` retrieving both markers | Exit 0; zero files |

The required list invocation uses each manifest's `bin.pi` through `process.execPath`, with `-p --mode json --no-session --offline`, `--no-extensions`, an explicit production-extension path, and `/claude:plugin list`. Full arguments and target labels appear in test diagnostics. JSON startup adds `/startup-proof`; RPC sends list/probe prompts and `get_entries` with distinct request IDs, then closes stdin and exits 0.

Provisioning is setup, not runtime proof. Hosted Actions was not run from this worktree. The parent owns the combined-tree `npm run check`, final corpus gate, and phase verification.

## Decisions Made

Followed D-11's existing authorization without another age-only permission gate. Kept all root dependencies and peer ranges unchanged. Used package-local identity plus executed version checks to prevent false peer-floor evidence. Preserved the upstream fixture tree instead of silently applying `npm audit fix`.

## Deviations from Plan

1. **[Rule 2 - Missing Critical] Provision the fixture in nightly CI too.** The nightly script selects the same test glob, so adding mandatory floor cases without setup would break it. Added the same isolated `npm ci --ignore-scripts` step to `.github/workflows/e2e-nightly.yml`; workflow checks and runtime tests pass. Commit: `80264efe`.
2. **[Rule 3 - Blocking] Permit the fixture lock through the size hook.** The new lock is 74,743 bytes, above the repository's 64 KiB threshold. Extended the existing root-lock exception only to `tests/e2e/pi-peer-floor/package-lock.json` in `.pre-commit-config.yaml`. The size hook and all other hooks pass. Commit: `80264efe`.

**Total deviations:** 2. Both are necessary to ship the requested independent fixture; no product behavior changed.

## Issues Encountered

- The sandbox terminated the initial test worker and prevented Fallow's temporary comparison worktree. Authorized escalated executions passed. A metrics subprocess also hit the sandbox's `spawnSync git EPERM`; read-only shell Git commands supplied the measurements instead.
- The first hook reported ten style findings. ESLint's automatic removal of an Error assertion exposed its rejection-type rule; wrapping the caught cause in an Error resolved that conflict. The next commit hook passed.
- npm reports one high-severity transitive package (`brace-expansion@5.0.9`). The exact artifact already appears in the root lock. The audit record preserves all three advisories and explains why the fixture's fixed inputs expose no attacker-controlled brace-pattern path. This is not a clean npm audit. General root remediation is recorded as `DEP-07-03-01` in `deferred-items.md`.

## Threat Flags

| Flag | File | Description |
| --- | --- | --- |
| threat_flag: dependency-advisory | tests/e2e/pi-peer-floor/package-lock.json | Pre-existing brace-expansion availability advisories also occur in the root lock. Fixed inputs, fresh directories, offline execution, disabled install scripts, and child deadlines mitigate the fixture surface. General root remediation is deferred explicitly. |

No new network endpoint, product authentication path, operator-store access, or schema trust boundary was introduced. The planned subprocess and registry boundaries are covered by the implementation. The descriptor-less correlation/privacy prohibition remains **flagged-unverified** for the phase reviewer; it is not reported as automatically passed.

## Known Stubs

None. No skipped/todo tests or unrun task verification commands remain.

## User Setup Required

None for this completed execution. Fresh local checkouts run `npm --prefix tests/e2e/pi-peer-floor ci --ignore-scripts` before the e2e suite; CI provisions it automatically. Missing fixtures fail with that command instead of skipping.

## Next Phase Readiness

Ready for 07-04 and 07-05 to document the verified transport and persistence behavior. Parent-owned tracking files remain untouched. Parent review retains the privacy judgment and the disclosed pre-existing dependency issue.

## Self-Check: PASSED

All six task-created artifacts exist. All three task commits are ancestors of HEAD. The working tree was clean after the last task commit. Required runtime cases pass on both real CLIs with no skips, and root dependency/tracking/corpus/catalog files match the captured base.
