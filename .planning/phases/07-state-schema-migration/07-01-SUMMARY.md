---
phase: 07-state-schema-migration
plan: 01
subsystem: testing
tags: [cucumber, state-migration, stmig]
status: complete

requires:
  - phase: 01-foundation
    provides: "the earlier-release state.json writers (D-BG-13) and the three seeds of features/plugin/state-migration.feature"
provides:
  - "Then step: the migrated installation record of the {word} scope has schema version {int} and these plugins: (columns id, enabled, provenance)"
  - "Seven new scenarios in features/plugin/state-migration.feature covering STMIG-01 and STMIG-02"
affects: [phase 8 config migration, phase 16 background-child load]

requirements-completed: [STMIG-01, STMIG-02]
actuals:
  tasks: 3
  commits: 3
plan_head_before: 6122675804a7b9caf78f45ded56aed088d431933
plan_head_after: c7b8927aa4f33f52f3ebd852dcfa26fde55abbdf

tech-stack:
  added: []
  patterns:
    - "A record step reads state.json once and never waits, so a late ST-4 write fails it"

key-files:
  created:
    - features/step_definitions/plugin/state-migration.steps.ts
  modified:
    - features/plugin/state-migration.feature
---

# Phase 7 Plan 01: State migration coverage Summary

The cucumber suite now proves that an upgrade from release 0.6.0 (schema 1) or 0.19.2 (schema 2) loads silently, keeps the plugin's skill, rewrites `state.json` in schema 3, and that a second load changes nothing; a newer `state.json` is refused as unreadable by the load, `list`, and `disable`, with no byte changed. No product change was needed.

## Commits

| Task | Commit | Title |
| --- | --- | --- |
| 1 | da2fba9a | test(features): prove the first load migrates an older record |
| 2 | 81a526fd | test(features): cover repeat loads and disabled plugins in migration |
| 3 | c7b8927a | test(features): prove a newer installation record is left untouched |
| SUMMARY | 500fee97 | (wrong title: a copy of c7b8927a's message; P7-DC-15) |

## Step text (final)

`the migrated installation record of the {word} scope has schema version {int} and these plugins:` (columns `id`, `enabled`, `provenance`), in `features/step_definitions/plugin/state-migration.steps.ts`, the only step of the module. It reads the scope's `state.json` once.

New scenarios:

- S3 The first load after an upgrade from release 0.6.0 rewrites the installation record in the current schema
- S4 The first load after an upgrade from release 0.19.2 rewrites the installation record in the current schema
- S5 A second load after an upgrade from release 0.6.0 changes nothing
- S6 A second load after an upgrade from release 0.19.2 changes nothing
- S7 A plugin disabled before an upgrade from release 0.19.2 stays disabled
- S9 A load refuses a newer installation record and leaves it as it was
- S10 Disabling a plugin refuses a newer installation record and changes nothing

The seeds S1, S2, and S8 are unchanged.

## Red proofs

Each sabotage was an uncommitted edit, restored with `git checkout -- <file>` before the next step; `git status --short` showed no product change after each. Logs: `tmp/p7-red/<run>.log` (gitignored, in the worktree).

| Run | ID | File, function | Edit | Failed scenarios: first failing step (actual) | Exit |
| --- | --- | --- | --- | --- | --- |
| t1-r1 | R1 | state-io.ts, `loadState` gate | refuse schema 1 | S1: `the result has these fields:` (severity `error`); S3: `the session reports no results` (an error cascade with `state.json` failed `unreadable`) | 1 |
| t1-r3 | R3 | state-io.ts, `loadState` | drop `void persistMigratedState(...)` | S3: migrated-record step (file still `schemaVersion` 1, no `enabled`/`provenance`) | 1 |
| t1-r4 | R4 | migrate.ts, `ensurePluginProvenance` | fill `dependency` | S3: migrated-record step (`dependency` for `explicit`) | 1 |
| t2-r2 | R2 | state-io.ts, `loadState` gate | refuse schema 2 | S2: `the result has these fields:`; S4, S7: `the session reports no results`; S6: `Given the user has started a new pi session` | 1 |
| t2-r3 | R3 | as above | as above | S3, S4, S7: migrated-record step (old schema version). S5, S6 stay green: a load that never writes changes no byte | 1 |
| t2-r4 | R4 | as above | as above | S3, S4, S7: migrated-record step (`dependency`) | 1 |
| t2-r5 | R5 | migrate.ts, `ensurePluginEnabled` | stamp `updatedAt` and report a change on every load | S5, S6: `the config and installation record bytes of the user scope are unchanged`; no other scenario reddened | 1 |
| t2-r6 | R6 | migrate.ts, `ensurePluginEnabled` | fill `enabled: true` over a recorded `false` | S7: `the session reports no results` (a `Reconcile pending` cascade with `will disable`) | 1 |
| t3-r7 | R7 | state-io.ts, `loadState` gate | accept schema 4 | S8, S10: `the result has these fields:`; S9: `the session reports these results:` | 1 |
| t3-r8 | R8 | state-io.ts, refusal branch | write the record (still schema 4) before the throw | S8, S9, S10: bytes-unchanged step | 1 |

Every one of the ten scenarios has at least one red proof.

## Clean runs

`npx cucumber-js --profile adapter --parallel 2 features/plugin/state-migration.feature`, three times after each task: `4 scenarios (4 passed)` x3, `8 scenarios (8 passed)` x3, `10 scenarios (10 passed)` x3. The S9 payload order was the same in every run. `npx cucumber-js --profile builtin --dry-run features/plugin/state-migration.feature` reports `0 scenarios` (no implementation tag).

## Gate results

Run at `c7b8927a` as the parts of `npm run check`, in order, each in the background with its exit status in a file (`/tmp/claude-1000/bg-phase-7/gate1/`). This plan is the phase's only plan, so this is both the wave gate and the phase gate. No part needed a rerun.

| Part | Exit | Seconds |
| --- | --- | --- |
| `npm run check:static` | 0 | 27 |
| `npm run test:unpaired` | 0 | 23 |
| `npm run test:integration` | 0 | 69 |
| `npm run test:cucumber:profile -- --profile adapter --parallel 3` | 0 (`1647 scenarios (1647 passed)`) | 1780 |
| `npm run test:cucumber:profile -- --profile builtin --parallel 3` | 0 (`148 scenarios (148 passed)`) | 485 |
| `npm run test:coverage:direct:all` | 0 | 163 |
| `npm run test:modules` (phase-gate part) | 0 | 190 |

The adapter leg took about 30 minutes because fourteen other phases shared the machine.

## Hermetic home

`find ~/.pi -newer /tmp/claude-1000/bg-phase-7/home-marker -print` printed nothing after the gate.

## Deviations

- **The plan was executed inline by the orchestrator, not by a `gsd-executor` subagent.** The session's agent-isolation guard reads its sentinel from the parent checkout, where this child may not write, so it refused a sequential executor dispatch; the coordinator then asked for inline work.
- The root-pin guard script was not run (the harness refused a `bash <script>` call); every command used absolute paths under the worktree, and each commit was checked with `git log`.
- The gate logs and commit messages live in `/tmp/claude-1000/bg-phase-7/` (coordinator rule), not `tmp/p7-gate/`; the red-proof logs stayed in the worktree's gitignored `tmp/p7-red/`.
- The D-BG-704 branch did not fire: the record step never read a late write.
- No unowned feature file changed.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

1. (Medium) Inline execution by the orchestrator instead of a `gsd-executor` subagent (see Deviations).
2. (Low) The step narrows JSON with the frozen `jsonObject` and `for...of` loops, a shape unlike `installation.steps.ts`'s walk, so fallow dupes stays green.
3. (Low) R3 was replaced by `void stateJsonPath;` rather than a bare deletion, so the sabotaged file still type-checks for cucumber's TypeScript stripping; the effect is the same (no write).
4. (Low) S10 shows "unstages nothing" with the frozen staged-files step `the user scope stages these skills and prompts:`.

## Parent lines

- `.planning/BACKLOG.md`, proposed `STATEREAD-01`: a newer `state.json` is reported as `{unreadable}` by the load, `list`, `disable`, `pending`, and `apply`, but `install` reports the plugin row `failed` with no reason, `update` reports `failed {unreadable manifest}`, and `uninstall` and `info` report an `internal-error` whose cause is cut to `state.json at [path]`. Each refuses and changes nothing; the fix lies in those verbs' orchestrators (D-BG-703, P7-DC-03).
- `.planning/BACKLOG.md`, proposed `STATEVER-01`: a schema version 1 or 2 `state.json` whose marketplace records hold no plugin keeps its old `schemaVersion` on disk until the next save, because `loadState` writes only when the migration filled a field. No user-visible effect today; it matters if a later release stops reading versions 1 and 2 (P7-DC-06).
- `.planning/PROJECT.md` Key Decisions, four rows in the D-BG-01 format (`behavioral-gaps, Phase 7, settled with the recommended answer, pending user review`, outcome `-- Pending`):
  - D-BG-701: STMIG-01 is proven for schema 1 by release 0.6.0 and schema 2 by release 0.19.2, each with a first load, a second load, and the `list` seed; a 0.19.2 disabled plugin stays disabled; release 0.4.3 stays with Phase 8. Rationale: one earlier release per schema version, each the last of its version.
  - D-BG-702: the migration is silent; the first load after an upgrade reports nothing when the config and record agree (RECON-05). Rationale: it changes only the extension's own file.
  - D-BG-703: a newer `state.json` fails closed per scope as `{unreadable}` in the load, `list`, and `disable`, changes no byte, and the installed components keep working; other commands' reports are deferred (STATEREAD-01). Rationale: fail closed on data the release cannot read.
  - D-BG-704: the verb module adds one step that reads the migrated record's schema version and each plugin's `enabled` and `provenance`; the ST-4 fire-and-forget write stays unless a run shows the race. Rationale: no existing step reads the schema version or provenance.
- `CHANGELOG.md`, `README.md`, `README.es.md`, frozen files: none.
