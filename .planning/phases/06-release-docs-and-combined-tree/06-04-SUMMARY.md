---
phase: 06-release-docs-and-combined-tree
plan: "04"
subsystem: mcp
tags: [mcp, builtin-mcp, manifest, cucumber, encoder]

requires:
  - phase: 02-built-in-materialization
    provides: "substituteAndInject with an encoder parameter, readBuiltinServerDescription, and the tool_search projection"
provides:
  - "substituteAndInject(translated, ctx, encoder) with a required encoder and no default (P2-DC-53)"
  - "the readBuiltinServerDescription half of the MANF-01 manifest read agreement gate, in the D-PL2-24 link-shape block too"
  - "features/lib/upstream/tool-search.ts, moved from features/lib/mcp-builtin-tool-search.ts (P2-DC-18)"
affects: [mcp-builtin, manifest readers, cucumber upstream projections]

actuals:
  tokens: 5000
  tasks: 3
  commits: 3
plan_head_before: 37f1cfdb09cf4cd77d4b1a8f6ff7de6358b8480f
plan_head_after: ed1b7a70a827458625c2b8f501f21c785cfb11ba

tech-stack:
  added: []
  patterns:
    - "Every caller of the MCP field walk names its encoder; no implementation's encoding is a default"
    - "A planted manifest describes the plugin by its own location, so a description reader's answer names the file that won"

key-files:
  created:
    - features/lib/upstream/tool-search.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/mcp/substitute.ts
    - test/bridges/mcp/substitute.test.ts
    - test/integration/adapter-expansion-conformance.test.ts
    - test/architecture/manifest-read-agreement.test.ts
    - features/step_definitions/mcp-server/builtin-tool-search.steps.ts
  deleted:
    - features/lib/mcp-builtin-tool-search.ts

key-decisions:
  - "substituteAndInject's encoder is required; the adapter conformance test passes ADAPTER_FIELD_ENCODER, and the unit case whose premise was the default is deleted (P2-DC-53)"
  - "The built-in description reader joins every location case of the MANF-01 gate and the D-PL2-24 link-shape block"
  - "The tool_search projection moves with git mv and stays out of upstream/index.ts, so the frozen calls step is unchanged (P6-DC-19)"

patterns-established:
  - "Projections of upstream text live under features/lib/upstream/, including ones a dedicated step calls directly"

requirements-completed: [BLT-01, BLT-02]

coverage:
  - id: D1
    description: "substituteAndInject requires its encoder; pi-mcp-adapter's output stays byte for byte"
    requirement: BLT-02
    verification:
      - kind: unit
        ref: "test/bridges/mcp/substitute.test.ts (71/71)"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/substitute.ts (lines 224/224, branches 49/49, functions 14/14)"
        status: pass
      - kind: integration
        ref: "test/integration/adapter-expansion-conformance.test.ts (64/64) and npm run test:integration (exit 0)"
        status: pass
      - kind: other
        ref: "npm run check:static (typecheck fails on a caller with no encoder)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The MANF-01 gate drives readBuiltinServerDescription on the same planted manifests and link shapes"
    requirement: BLT-02
    verification:
      - kind: unit
        ref: "test/architecture/manifest-read-agreement.test.ts (15/15; 9 fail under a reversed candidate walk, not committed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The tool_search projection lives in features/lib/upstream/tool-search.ts and the built-in tool-search scenarios pass through it"
    requirement: BLT-01
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile builtin features/mcp-server/listing.feature (8 scenarios, 98 steps passed)"
        status: pass
      - kind: other
        ref: "npm run check:features and npm run check:static (exit 0)"
        status: pass
    human_judgment: false

duration: 43min
completed: 2026-11-05
status: complete
---

# Phase 6 Plan 04: Required MCP encoder, built-in description gate half, and tool_search projection move Summary

**`substituteAndInject` now requires its encoder (no adapter default), the MANF-01 manifest read agreement gate drives `readBuiltinServerDescription` as a fifth half including the D-PL2-24 link shapes, and Pi's `tool_search` projection moved to `features/lib/upstream/tool-search.ts`.**

The plan ran in two executors. The first executor committed Tasks 1 and 2 and was killed by a container restart while Task 3 was staged. A second executor fast-forwarded onto its branch (`worktree-agent-ad8a6092b535be82a`), applied the saved Task 3 patch, checked Tasks 1 and 2 against their acceptance criteria, finished and verified Task 3, and committed it.

## Performance

- **Duration:** 43 min wall clock, including the restart gap
- **Started:** 2026-11-04T23:51:44Z (first executor)
- **Completed:** 2026-11-05T00:35Z (second executor)
- **Tasks:** 3
- **Files modified:** 6 (one of them a rename)

## Accomplishments

- No caller of the MCP field walk can write pi-mcp-adapter's encoding into a built-in registration by leaving the encoder out: typecheck fails instead (P2-DC-53, T-06-08).
- The built-in description reader cannot drift from the shared manifest order or the shared link containment without the MANF-01 gate failing (T-06-09).
- Every cucumber projection of upstream text lives under `features/lib/upstream/` (P2-DC-18).

## Task Commits

1. **Task 1 (tracer): Every caller of the MCP field walk names its encoder** - `c5445ba` (refactor), first executor
2. **Task 2: The MANF-01 gate drives the built-in description reader** - `ec36113` (test), first executor
3. **Task 3: The tool_search projection moves into features/lib/upstream/** - `ed1b7a7` (test), second executor from the first executor's staged patch

## Owned parent lines (06-PARENT-LINES.md)

| Parent line | Outcome | Commit |
|---|---|---|
| 02-01 SUMMARY line 1 / 02-08 item 10 / MANF-01 note: add `builtin-description.ts` to the MANF-01 gate | Applied. The reader is a fifth half in every location case and in the D-PL2-24 link-shape block | `ec36113` |
| 02-01 SUMMARY line 2 / 02-08 item 11 / P2-DC-53 note: pass `ADAPTER_FIELD_ENCODER` at the two conformance calls, then make the encoder required | Applied | `c5445ba` |
| 02-01 SUMMARY line 3 / 02-08 items 4(a) and 12 / P2-DC-18 note: move the tool_search projection into `features/lib/upstream/` | Applied with `git mv`; `git log --follow` reaches `f7478b2` on the old path | `ed1b7a7` |

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/mcp/substitute.ts`: the encoder parameter has no default; the doc comment says every caller names its encoder.
- `test/bridges/mcp/substitute.test.ts`: the "without an encoder" case is deleted.
- `test/integration/adapter-expansion-conformance.test.ts`: imports `ADAPTER_FIELD_ENCODER` and passes it at both `substituteAndInject` calls.
- `test/architecture/manifest-read-agreement.test.ts`: the header lists the new half. `plantPlugin` writes a `marketplace.json` that lists the plugin. Each manifest's `description` names its location. A `readDescription` helper drives the reader, and its expectation is added to every location case and to the link-shape block.
- `features/lib/upstream/tool-search.ts` (from `features/lib/mcp-builtin-tool-search.ts`): the import is now `../run-tokens.ts` and the header names the sibling `./mcp.ts`. No logic changed.
- `features/step_definitions/mcp-server/builtin-tool-search.steps.ts`: imports `toolSearchCallRows` from `../../lib/upstream/tool-search.ts`.

## Red proofs

- **Task 2 (MANF-01 half):** in the working tree only, `reads.find(...)` in `builtin-description.ts::manifestDescription` was changed to `[...reads].reverse().find(...)`, which makes the reader prefer the last present candidate. `test/architecture/manifest-read-agreement.test.ts` then failed 9 of 15 cases: wrapped over bare, the three stop cases, and the five D-PL2-24 wrapped-link shapes. The bare-only, neither-present, and fall-through cases passed, as they should, because there the order cannot matter. The file was restored with `git checkout --`, and `git status --short` showed only the staged Task 3 files. The first executor's run (`mutation.log`) failed the same 9 cases. The second executor repeated the run because the first executor's exact mutation was not recorded. Nothing from either run was committed.

## Checks

| Command | Exit | Duration | At sha | Result |
|---|---|---|---|---|
| `node --test test/bridges/mcp/substitute.test.ts` | 0 | <1 s | ed1b7a7 tree (Task 1 files unchanged since c5445ba) | 71/71 |
| `npm run test:coverage:direct -- .../bridges/mcp/substitute.ts` | 0 | 1 s | same | 100% lines, branches, functions |
| `node --test test/integration/adapter-expansion-conformance.test.ts` | 0 | 13 s | same | 64/64 |
| `TEST_CONCURRENCY=2 npm run test:integration` | 0 | 72 s | same | all files passed |
| `node --test test/architecture/manifest-read-agreement.test.ts` | 0 | 2 s | same | 15/15 |
| same, with the reversed walk (not committed) | 1 | 2 s | working tree | 9 fail / 6 pass |
| `npm run check:features` | 0 | 5 s | Task 3 staged | passed |
| `npm run test:cucumber:profile -- --profile builtin features/mcp-server/listing.feature` | 0 | 85 s | Task 3 staged | 8 scenarios, 98 steps passed |
| `npm run lint` (warm-up) | 0 | 225 s | Task 3 staged | passed |
| `npm run check:static` | 0 | 71 s | Task 3 staged (= ed1b7a7) | all 7 checks passed |
| `npm run check:static` (first executor) | 0 | - | after c5445ba and after ec36113 | all 7 checks passed (`static1.log`, `static2.log`) |

## Decisions Made

- Followed the plan. The judgment calls are listed under Dubious Choices.

## Deviations from Plan

None. The plan was executed as written. The continuation (two executors) is a process note, not a deviation.

## Issues Encountered

- A container restart killed the first executor during Task 3. Its staged rename was saved as a patch and applied cleanly with `git apply --3way --index`. It already held the full Task 3 change, so it needed no edits. No other file named the old path outside `.planning/`. The historical Phase 2 planning documents still name the old path and were left unchanged.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Window records

None.

## Dubious Choices

1. **P6-DC-0401 - "both readers" titles renamed to "three readers".** The plan asked only to change the "all four readers" titles to "five". The first executor also renamed the three `plantPlugin` cases from "both readers" to "three readers", because those cases now assert three readers. Alternatives: keep "both", which is now false, or name the readers in each title. A title that counts the readers matches the existing "all five" style. Severity: Low.
2. **P6-DC-0402 - The entry fallback is proven with a description in one case only.** `plantPlugin` writes a `marketplace.json` whose entry has a description, so the neither-present case shows the reader falls back to the entry's text. The stop and link cases use `seedScopedMarketplace`, whose entry has no description, so they expect `undefined`. In those cases `undefined` cannot tell "fell back to the entry" from "returned nothing". Alternative: give that entry a description, which would also change the inputs of the other four readers in those cases. Severity: Low.
3. **P6-DC-0403 - The red proof reversed the walk instead of reordering `MANIFEST_CANDIDATES`.** Reordering the shared constant would also break the other readers, so the failures would not isolate the new half. Reversing the `find` in `builtin-description.ts` breaks only the fifth reader. The first executor did not record its mutation, so the second executor ran its own, and it failed the same 9 cases. Severity: Low.
4. **P6-DC-0404 - The integration suite ran with `TEST_CONCURRENCY=2`.** The plan's command sets no concurrency. The second executor limited it because other executors were running on the same 4 CPUs. The test set is the same. Only the scheduling differs. Severity: Low.
5. **P6-DC-0405 - The Task 1 tracer gate evidence was re-run after Tasks 2 and 3.** The first executor's logs show `check:static` passing after Task 1, but no record of its direct-coverage or `test:integration` runs. The second executor re-ran both on the final tree, where the Task 1 files are unchanged since `c5445ba`, instead of before the expansion tasks. A failure there would have pointed to Task 1, but none occurred. Severity: Low.
6. **P6-DC-0406 - `requirements-completed` lists BLT-01 and BLT-02, but REQUIREMENTS.md was not marked.** The orchestrator owns the shared-file writes in worktree mode, and other Phase 6 plans may also declare these IDs (shared-ID gate, #2388). So this executor did not run `requirements.mark-complete`. Severity: Low.

## Next Phase Readiness

- Plan 06-04 is complete. The parent's wave gate runs `npm run check` (both cucumber profiles) on the merged wave.

## Self-Check: PASSED

- FOUND: features/lib/upstream/tool-search.ts; absent: features/lib/mcp-builtin-tool-search.ts
- FOUND commits on this branch: c5445ba, ec36113, ed1b7a7
- Acceptance: `ADAPTER_FIELD_ENCODER` in the conformance test = 3 (>= 3); `encoder: McpFieldEncoder = ` in substitute.ts = 0; `readBuiltinServerDescription` in the gate = 3 (>= 2); `upstream/tool-search.ts` in the step file = 1 (>= 1); `git log --follow` on the new path lists `f7478b2` from the old path.

---
*Phase: 06-release-docs-and-combined-tree*
*Completed: 2026-11-05*
