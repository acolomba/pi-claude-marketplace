---
phase: 06-command-run-contract
plan: "04"
subsystem: testing
tags: [node-test, notifications, json, rpc, preservation]
requires:
  - phase: 06-command-run-contract
    provides: Plans 06-01 through 06-03 explicit origins, command errors, and settlement accounting
provides:
  - Deferred registered-command, authentication, cascade, and enable/install ordering witnesses
  - Explicit producing roots across the retained catalog and raw inventory
  - Machine-only internal-error disclosure and metadata controls
  - Strict unchanged text-corpus and catalog evidence with parent gates kept pending
affects: [command-run-contract, phase-verification]
actuals:
  tokens: 15863
  tasks: 2
  commits: 2
plan_head_before: d89714c3b2d0fbecafe8e1cfbdb45fd3ad9da132
plan_head_after: 8a0d27805faf8382502790e0941b4655a6865643
tech-stack:
  added: []
  patterns:
    - Controlled deferred promises and exact payload/settlement logs through existing owner seams
    - Explicit test-owned catalog origins with retained original capture failures
key-files:
  created: []
  modified:
    - tests/edge/register.test.ts
    - tests/orchestrators/auth-host.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/architecture/catalog-uat/catalog-wire.test.ts
    - tests/architecture/no-credential-leak.test.ts
    - tests/architecture/wire-schema.test.ts
    - .planning/phases/06-command-run-contract/06-VALIDATION.md
key-decisions:
  - Preserve the existing awaited carriers and successful-recovery reopening behavior without production changes.
  - Keep internal-error checks machine-only and preserve every original text probe and catalog tuple.
  - Leave combined-wave and final phase verification to the parent and both descriptor-less prohibitions flagged-unverified.
patterns-established: []
requirements-completed: ["WIRE-02", "WIRE-07", "JOUT-03", "JOUT-04"]
coverage:
  - id: D1
    description: Deferred carriers retain outer identity and finish output before settlement in JSON and RPC.
    requirement: JOUT-03
    verification:
      - kind: unit
        ref: node --test tests/edge/register.test.ts tests/orchestrators/auth-host.test.ts tests/orchestrators/marketplace/update.test.ts tests/orchestrators/plugin/enable-disable.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: All 260 catalog tuples, eight raw samples, and the separate internal error retain valid metadata.
    requirement: WIRE-02
    verification:
      - kind: unit
        ref: tests/architecture/catalog-uat/catalog-wire.test.ts
        status: pass
      - kind: unit
        ref: tests/architecture/wire-schema.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Actual internal-error resolution and machine delivery hide credentials and local paths.
    requirement: JOUT-04
    verification:
      - kind: unit
        ref: tests/architecture/no-credential-leak.test.ts
        status: pass
    human_judgment: false
  - id: D4
    description: The unchanged text corpus contains 3149 entries with zero extras and the catalog matches its baseline.
    verification:
      - kind: other
        ref: TEST_CONCURRENCY=4 node scripts/notify-corpus.mjs check plus strict file-backed 3149/zero-extra assertions
        status: pass
      - kind: other
        ref: git diff --exit-code 26cb0056 -- docs/output-catalog.md
        status: pass
    human_judgment: false
duration: 24 min
completed: 2026-10-09
status: complete
---

# Phase 6 Plan 4: Command-Run Contract Summary

**Deferred carrier tests prove output-before-settlement ordering, while the complete metadata inventory and disclosure checks preserve all 3149 text entries.**

## Performance

- Started: 2026-10-09T20:49:00Z (isolated worktree dispatch).
- Completed: 2026-10-09T21:13:00Z.
- Tasks: 2 of 2.
- Files modified by tasks: 8; this summary is the additional metadata artifact.
- Actual token estimate: 63,452 realized diff characters divided by four, rounded up.
- Task commit count: 2, measured from the persisted plan ledger through plan_head_after; the summary commit is excluded.

## Accomplishments

- Registered JSON/RPC commands now have exact ordered witnesses for delayed success, typed failure, missing outcome, and unexpected throw. Prompts precede outcomes; reload survives a later throw; retained callbacks add nothing after settlement. Overlapping identical commands settle independently of load and hook emissions.
- The real authentication owner joins deferred device-code and token-poll work using mocked timers. Marketplace cascade children and delegated enable/install work retain the supplied outer invocation. Every test-owned promise is released and awaited.
- The original 260 catalog tuples and eight raw samples remain exercised. Explicit test-owned producing roots replace generic command attribution in both conversion and dispatch. The separate machine-only internal error completes all 19 kinds without adding a text fixture.
- Missing envelope and command metadata, non-command internal-error origins, and recovery-caught malformed attempts have negative controls. All prior empty-converter, off-vocabulary, foreign-member, path, Error, undefined, and schema-drift controls remain.
- AUTH-09 now checks actual internal-error resolution, conversion, and JSON/RPC delivery across the whole payload. Planted credentials, POSIX/Windows paths, bare UNC roots, and single/triple-slash file URLs are rejected. Original three-channel text probes are untouched.

## Task Commits

1. **Verify delayed auth and delegated commands through settlement:** `f3e5d1df03ed49515b3d7dc6ed532d1c5b9c2c2e` - `test: prove asynchronous command carrier settlement`.
2. **Close the full inventory and preservation gates:** `8a0d27805faf8382502790e0941b4655a6865643` - `test: verify notification inventory and disclosure preservation`.

Both commits passed `fallow audit --base HEAD`, clean `SKIP=npm-check pre-commit run --files ...`, and normal commit hooks including `npm run check:commit`. Task one exercised 100% direct coverage for the four staged source/test pairs; task two exercised the architecture owners through the unpaired suite. No hook was bypassed, history rewritten, or tracked file deleted.

The final metadata commit contains this summary and final validation evidence. Its SHA is reported in the completion message; it is outside the measured task-commit interval above.

## Verification Results

All checks used Node `v26.11.0` in this isolated worktree.

| Check | Exact command / reference | Result and input |
| --- | --- | --- |
| Task one post-commit tracer | `node --test tests/edge/register.test.ts tests/orchestrators/auth-host.test.ts tests/orchestrators/marketplace/update.test.ts tests/orchestrators/plugin/enable-disable.test.ts` | Exit 0; four owner files, no failures/skips; 5.991 s at `f3e5d1df03ed49515b3d7dc6ed532d1c5b9c2c2e` |
| Task two final owner check | `node --test tests/architecture/catalog-uat/catalog-wire.test.ts tests/architecture/no-credential-leak.test.ts tests/architecture/wire-schema.test.ts` | Exit 0; 95 tests, zero skips; 4.704 s at `8a0d27805faf8382502790e0941b4655a6865643` |
| Final strict corpus producer | `TEST_CONCURRENCY=4 node scripts/notify-corpus.mjs check` | Exit 0; 142.62 s; 9385 tests, 9384 passing, one inherited skip, zero failures; task-two commit |
| Strict corpus assertions | Read unchanged `/tmp/0604-corpus-final.log`; require no `missing in ` / `extra in ` lines and the exact `Notify corpus check passed: 3149 baseline entries present, 0 extra.` line | Exit 0; both assertions passed |
| Catalog preservation | `git diff --exit-code 26cb0056 -- docs/output-catalog.md` | Exit 0; empty diff |
| Review orientation | `fallow review --base d89714c3b2d0fbecafe8e1cfbdb45fd3ad9da132 --brief` | Zero dead-code, complexity, or duplication issues |
| Combined-wave / final phase gate | `npm run check` on the parent's merged checkout | Pending; explicitly owned by parent |

Corpus and large hooks ran sequentially. No corpus was recaptured and no new skipped test was added. The producer was run twice; the final run used the exact clean task-two commit. Only planning Markdown changed afterward, and the executable diff from that reference was verified empty.

The earlier dirty-tree check is fully identified in 06-VALIDATION.md by the task-one SHA, retained exact diff, SHA-256, command, runtime, result, and duration. Final evidence uses the clean task-two commit instead. Local logs are `/tmp/0604-tracer.log`, `/tmp/0604-task2-final.log`, `/tmp/0604-corpus-final.log`, and `/tmp/0604-corpus-final-time.log`.

## Requirement and Decision Coverage

- **WIRE-02:** Required origins and envelope metadata across the retained inventory, generated-schema equality, and metadata-removal controls.
- **WIRE-07:** Outer invocation identity through delayed delegation and independent overlapping roots; missing command identity controls. This does not close the tracking prohibition flag.
- **JOUT-03:** Awaited real owner carriers, exact output/settlement order, prompt-only missing-outcome completion, and retained-callback suppression.
- **JOUT-04:** Safe internal-error delivery, retained partial output and reload, whole-payload disclosure controls, and malformed-attempt ledger retention. This does not claim rollback.

D-01, D-02, and D-04 remain covered by the prior live router/registration witnesses. D-03 and D-09 gain delegated/root inventory evidence; D-05, D-06, and D-10 gain delayed outcome/lifetime evidence; D-07 gains partial-output and disclosure evidence. D-08 is unchanged: successful recovery reopens delivery and permits later output; only failed recovery closes delivery. No production lifecycle mechanism was introduced.

## TDD Evidence

The behavior already existed in plans 06-01 through 06-03. Tests therefore used temporary negative-control mutations to demonstrate RED before committing passing tests:

- Task one disabled missing-outcome finalization. The named registered JSON target expected prompt, internal-error, settlement, but observed prompt and settlement. Its real TAP evidence passed RED_EVIDENCE_OK; semantic inspection confirmed the intended missing outcome. Record: `tmp/06-04-01-red.json`.
- Task two removed internal-error origin in the converter. The named JSON inventory target failed its complete payload assertion on absent origin. Its real TAP evidence passed RED_EVIDENCE_OK with one executed failing test and no load/fixture error. Record: `tmp/06-04-02-red.json`.

Both mutations were completely restored. Following the project override, no failing RED commit was made. No production fix or refactor was needed.

## Decisions Made

Used existing deferred-promise and injection seams, with mocked authentication timers. Kept the original inventory and all text-producing probes. Used explicit catalog-root assignments, including load/hook and shared diagnostic roots. Added internal-error as a separate machine-only case. Kept final phase and combined-tree gates with the parent.

## Deviations from Plan

No implementation scope deviation: exactly the eight declared files changed across the tasks. The user-supplied execution contract supersedes the plan's generic combined-gate instruction: the parent runs that gate after merge. As in the prior plans, strict corpus assertions read the unchanged saved report instead of a stdin pipe; their content is identical. Neither adjustment weakens verification or changes a baseline.

## Issues Encountered

The first task's commit hook found eight import-order and blank-line errors in new tests. They were fixed, and normal hooks passed on retry. Fallow's existing generated TypeScript-cache entrypoint warning did not produce an audit finding. Its review suppression advisory identifies the deliberate `@ts-expect-error` negative test for command-only internal-error origins.

Sandbox restrictions required approved execution of the normal Git worktree operations and process-heavy checks. A temporary Git LFS storage directory under `/tmp` kept those operations confined to this task. No package was installed and no parent checkout was edited.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-06-12 has controlled carrier/settlement witnesses; T-06-13 has retained inventory, controls, and strict unchanged preservation results; T-06-14 has original-attempt validation and actual whole-payload disclosure checks. T-06-SC is satisfied by no dependency or installation changes. Final phase threat review remains parent-owned.

Two descriptor-less prohibitions remain **flagged-unverified** for the parent/verifier:

- Correlation must not become persistent user or cross-command tracking or telemetry.
- Internal errors or delivery failures must not be presented as proof that completed changes were rolled back.

Passing behavioral checks do not erase either flag. 06-VALIDATION.md keeps `nyquist_compliant: false` and the parent-owned gates pending.

## User Setup Required

None.

## Next Phase Readiness

Both tasks are complete and ready for the parent's merge, combined-wave `npm run check`, and phase verification. No product fix, stub, or new skipped test remains. No PR, release, Phase 7 behavior, or shared-state change was made.

STATE.md, state.json, ROADMAP.md, config.json, REQUIREMENTS.md, production code, dependencies, generated schema, and catalog are unchanged from the initial worktree base.

## Self-Check: PASSED

The parent merged this plan as `f8e2a388` and ran `npm run check` on the
clean combined tree with Node `v26.11.0`. It passed with exit 0, including
integration tests and direct coverage for all 266 source/test pairs.
The schema-drift gate passed; codebase-map drift remains advisory.
Independent phase validation, security review, code review, and goal
verification follow this combined-wave result.

All eight declared task files and this summary exist. Both exact task SHAs are
ancestors of HEAD. The persisted ledger and recorded boundaries measure two
task commits. Protected-file and executable-input comparisons passed. No
temporary RED mutation remains. The only pre-existing untracked item is the
runtime `.codex/gsd-core` symlink; it was not staged or changed.

## Parent remediation closeout

Code review found CR-01 after the initial combined-wave gate. Three fixes
closed it: `e7a8182f`, `6680ff1b`, and `045f53cd`. The machine error resolver
now masks recognized local paths and suppresses ambiguous cause messages.
The shared text redactor remains unchanged. Independent re-review is clean,
and security reassessment closes all fifteen declared threats.

The parent ran `npm run check` at
`045f53cd5060082c5df6371853338f6765cd1c2d`, Node `v26.11.0`: exit 0.
Log: `/tmp/json-output-cr01-iter3-check.log`. Integration tests and all
266 direct source/test pairs passed. The strict corpus at this commit
retains 3149 entries with zero extras. Log: `/tmp/cr01-iter3-corpus.log`.
Only planning Markdown changed after these results. Validation now records
`nyquist_compliant: true` for the automated coverage.

Developer confirmation of the redaction logic remains required before
final goal verification. Both descriptor-less prohibition flags remain
unresolved. These checks do not mark Phase 6 complete.

## Developer confirmation

On 2026-10-09, the user selected option 1, "Accept and continue verification."
The accepted machine-error behavior replaces local paths with `[path]` and
ambiguous affected causes with `Command failure details omitted.`. Text
output remains unchanged. This resolves the redaction confirmation required
by the fix workflow. It does not resolve the two prohibition flags or claim
native Windows filesystem execution.
