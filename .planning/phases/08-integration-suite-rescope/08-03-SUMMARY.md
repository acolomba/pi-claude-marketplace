---
phase: 08-integration-suite-rescope
plan: "03"
subsystem: testing
tags: [integration-tests, itscope, headers, conformance, docs]

requires:
  - phase: 08-integration-suite-rescope
    provides: "the frozen edit lists of plan-08/inputs (08-03-t1 to t3) and apply-edits.mjs"
provides:
  - "ITSCOPE-01 class headers on twenty integration files"
  - "whole-object git-call assertion in both standalone-prune cases"
  - "read-in-source wording of the openUi cache claim in docs/mcp-compatibility.md"
affects: [08-05 ITSCOPE-04 header gate, milestone audit]

actuals:
  tokens: 8544
  tasks: 3
  commits: 4
plan_head_before: 17fca7ad0a642c66fd01799d08ee233390cc7449
plan_head_after: 382ec65f99afb20ce4c31273adee07250c302d38

tech-stack:
  added: []
  patterns:
    - "Integration file header: `// test/integration/<file>.test.ts` path line, then the ITSCOPE-01 class and what cucumber does not cover"

key-files:
  created: []
  modified:
    - test/integration/standalone-prune.test.ts
    - test/integration/mcp-verdict-migration.test.ts
    - test/integration/concurrent-install.test.ts
    - test/integration/marketplace-add-seed-mirrors.test.ts
    - test/integration/mcp-server-records.test.ts
    - test/integration/mcp-verdict-update.test.ts
    - test/integration/plugin-layer-verbs.test.ts
    - test/integration/marketplace-layer-remove.test.ts
    - test/integration/hooks-result-boundary.test.ts
    - test/integration/pi-subagents-child-launch-conformance.test.ts
    - test/integration/adapter-expansion-conformance.test.ts
    - test/integration/adapter-tool-name-conformance.test.ts
    - test/integration/agents-adapter-grant-conformance.test.ts
    - test/integration/agents-builtin-grant-conformance.test.ts
    - test/integration/mcp-adapter-entry-conformance.test.ts
    - test/integration/mcp-builtin-encoding-conformance.test.ts
    - test/integration/mcp-status-conformance.test.ts
    - test/integration/provenance-invisibility.test.ts
    - test/integration/skill-path-resolution.test.ts
    - test/integration/workflow-engine-agent-registry.test.ts
    - docs/mcp-compatibility.md

key-decisions:
  - "The fallow audit weakened-tests warn on standalone-prune (assertions 16 -> 14) is left to the milestone under the user decision of 2026-11-21: two whole-object checks replace four field checks and cover the same fields plus five more"

patterns-established:
  - "Every kept integration file states its ITSCOPE-01 class (peer conformance, multi-process, or internal) in its first twenty lines"

requirements-completed: [ITSCOPE-02, ITSCOPE-01]

duration: 18min
completed: 2026-11-23
status: complete
---

# Phase 8 Plan 03: Integration File Headers Summary

**Twenty integration files now name their ITSCOPE-01 class and what cucumber does not cover; both standalone-prune cases compare the whole recorded git-call object, and the openUi cache claim in docs/mcp-compatibility.md says it was read in the two peers' source.**

## Performance

- **Duration:** about 18 min
- **Started:** 2026-11-23T04:21Z
- **Completed:** 2026-11-23T04:39Z
- **Tasks:** 3 (tracer + 2 auto)
- **Files modified:** 21

## Accomplishments

- Settled the two carried overclaims: `standalone-prune` (Phase 4 IN-03) and `mcp-verdict-migration` (Phase 5).
- Wrote the multi-process and internal headers of six files.
- Wrote the peer conformance headers of twelve files.
- Marked the Phase 1 IN-02 `openUi: false` claim as read in source.

## Header map

| File | Class in the header | What the header says cucumber does not cover | Task | Commit |
| --- | --- | --- | --- | --- |
| standalone-prune | internal: calls that must not happen | every recorded git call and the two seams; the state and config mtimes | 1 | 9019bd3 |
| mcp-verdict-migration | internal: a record a released build left | the whole rendered move notice and `list` text | 1 | 9019bd3 |
| concurrent-install | multi-process | two installs racing for the state lock (D-15) | 2 | e89a9e6 |
| marketplace-add-seed-mirrors | internal: stored files and calls that must not happen | `plugin-clones/` and the git and credential calls of the seeding (D-SEED-01) | 2 | e89a9e6 |
| mcp-server-records | internal: a stored record field | `mcpServerConfigs` (MREC-01, D-MB-04) | 2 | e89a9e6 |
| mcp-verdict-update | internal: a stored record field | `compatibilityBasis` (D-P3-02, MREC-03) | 2 | e89a9e6 |
| plugin-layer-verbs | internal: fault injection (a tampered source kind) | LAYER-06 with a source kind no release writes | 2 | e89a9e6 |
| marketplace-layer-remove | internal: fault injection (EACCES) | a remove whose unstage fails (MR-7, PRUNE-03) | 2 | e89a9e6 |
| hooks-result-boundary | peer conformance: Pi's `ExtensionRunner` | what a later Pi handler reads (D-PG2-06) | 3 | 8484ced |
| pi-subagents-child-launch-conformance | peer conformance: pi-subagents' launch planner | the launch plans no real child shows | 3 | 8484ced |
| adapter-expansion-conformance | peer conformance: pi-mcp-adapter's expansion code | the table, the property, and the drift guard | 3 | 8484ced |
| adapter-tool-name-conformance | peer conformance: pi-mcp-adapter's tool names | the name edges and the screenshot tool's pinned name | 3 | 8484ced |
| agents-adapter-grant-conformance | peer conformance: pi-subagents' resolver and the adapter's names | the grant side of a long name (AGTLONGNAME-01) | 3 | 8484ced |
| agents-builtin-grant-conformance | peer conformance: pi-subagents' selector resolver | whole-server selectors and unresolved adapter selectors | 3 | 8484ced |
| mcp-adapter-entry-conformance | peer conformance: the adapter's config loader and OAuth check | the stored choices and the unset header | 3 | 8484ced |
| mcp-builtin-encoding-conformance | peer conformance: Pi's resolver and validator | the table, PI-1, PI-2, and the validator check | 3 | 8484ced |
| mcp-status-conformance | peer conformance: the adapter's status contract | the shutdown snapshot and the drift guard | 3 | 8484ced |
| provenance-invisibility | peer conformance: pi-subagents' frontmatter parser | the injected lines and block headers | 3 | 8484ced |
| skill-path-resolution | peer conformance: pi-subagents' skill resolver | the global catalog check | 3 | 8484ced |
| workflow-engine-agent-registry | peer conformance: the engine's agent registry | the other descriptions, provenance values, and source names | 3 | 8484ced |

MCP doc claim: `docs/mcp-compatibility.md:770` now says the `openUi: false` cache-key mismatch was read in source (`dist/metadata-cache.js` of pi-mcp-adapter 7.0.1 hashes `openUi: false`; `computeMcpServerHash` in `src/runs/shared/mcp-direct-tool-allowlist.js` of pi-subagents 0.88.1 leaves it out), and that no test runs `openUi: false`. Commit 382ec65. Before the edit, I read both source ranges in the installed peer cache, and they match the new wording.

## Task Commits

1. **Task 1 (tracer): Settle the two carried overclaims**: `9019bd3` (test)
2. **Task 2: Headers of the multi-process and internal files**: `e89a9e6` (test)
3. **Task 3: Peer conformance headers**: `8484ced` (test). **The openUi doc claim**: `382ec65` (docs)

## Checks

- Inputs: `sha256sum -c --quiet SHA256SUMS` exit 0; `sha256sum SHA256SUMS` = `9ad855343cdbf5b04dbaff9df15f70f367082a31a171b980cebd5616d1541746`.
- `node --version`: v24.22.3. Plan base: `17fca7ad0a642c66fd01799d08ee233390cc7449` (in `$D/plan-base`).
- `apply-edits.mjs dry` of t1, t2, and t3 at the plan base: `EDITS DRY OK` (all three).
- The verify commands ran verbatim as scripts under `$D = <scratchpad>/phase08-plan03/` (`verify-t1-1.sh` through `verify-t3-6.sh`), because the worktree shell guard refuses inline `git` in `$(...)`.

| Verify | Ran on | Exit | Log / result |
| --- | --- | --- | --- |
| t1 edits check | working tree over 17fca7a | 0 | `edits-check-t1.log`: EDITS CHECK OK |
| t1 group (2 files) | working tree over 17fca7a | 0 | `group-t1.log`: tests 5, pass 5, fail 0 |
| t1 header gate | working tree over 17fca7a | 0 | no BAD line; 2 whole-object checks; corrected sentence present |
| ESLint warm-up (`npm run lint`) | working tree over 17fca7a | 0 | `lint-warm.log` |
| t1 check:static | working tree over 17fca7a | 0 | `check-static-1.log` |
| t1 file scope | 9019bd3 | 0 | exactly the 2 files; clean tree |
| t2 edits check | working tree over 9019bd3 | 0 | `edits-check-t2.log`: EDITS CHECK OK |
| t2 group (6 files) | working tree over 9019bd3 | 0 | `group-t2.log`: tests 23, pass 23, fail 0 |
| t2 header gate | working tree over 9019bd3 | 0 | no BAD line |
| t2 check:static | working tree over 9019bd3 | 0 | `check-static-2.log` |
| t2 file scope | e89a9e6 | 0 | exactly the 8 files; clean tree |
| t3 edits check | working tree over e89a9e6 | 0 | `edits-check-t3.log`: EDITS CHECK OK |
| t3 group (12 files) | working tree over e89a9e6 | 0 | `group-t3.log`: tests 224, pass 224, fail 0 |
| t3 header gate + doc sentence | working tree over e89a9e6 | 0 | no BAD line; `No test runs \`openUi: false\`.` once |
| t3 check:static | working tree over e89a9e6 | 0 | `check-static-3.log` |
| fallow audit `--base 17fca7a` | 382ec65 | 0 | `audit.json`: verdict=warn, dead_code 0, complexity 0, clone groups 0, risks = weakened-tests on standalone-prune only |
| final file scope | 382ec65 | 0 | exactly the 21 files of `files_modified`; nothing under `extensions/` or `features/`; clean tree |

Acceptance greps: `gitCalls.clone` 0; `records every git operation it serves except` 1; `pin user-visible text that no scenario shows yet` 0; `Two multi-process cases (ITSCOPE-01)` 1; `Six internal cases (ITSCOPE-01)` 1 in each of the two files; `Three internal cases (ITSCOPE-01) of fault injection` 1; the old openUi sentence 0; `read in source, ...` 1.

Commit hooks: all four commits ran the full pre-commit hook in the foreground under the lock. No fixer changed a file. In this worktree, `prettier` and `npm run check:commit` reported "no files to check" for the test commits, so the `check:static` run by hand before each commit is the static verdict. mdformat and markdownlint-cli2 passed on the doc commit.

## Issues for the milestone

- `fallow audit --base 17fca7a` verdict `warn` with one `weakened-tests` finding (`assertion-drop`) on `test/integration/standalone-prune.test.ts`: `assertions: 16 -> 14`. Cause: two whole-object `assert.deepStrictEqual(gitCalls, {...})` checks replace four field checks (`gitCalls.clone`/`gitCalls.fetch` in each case). They cover the same two fields plus `checkout`, `currentBranch`, `forceUpdateRef`, `resolveRef`, and `resolveRemoteRef`, so the change makes the cases stronger even though fallow counts fewer assertions. Under the user decision of 2026-11-21 this stays open for the milestone, with no `.fallowrc.json`, suppression marker, or CI change.

## Decisions Made

None beyond the plan. The audit finding is handled as the plan says.

## Deviations from Plan

None. The plan ran as written.

- The optional peer cache (`node_modules/.cache/optional-peers`) was empty in this worktree. As the task 3 action says, `node scripts/install-test-peers.mjs` installed pi-mcp-adapter@7.0.1, pi-subagents@0.88.1, and @quintinshaw/pi-dynamic-workflows@3.15.0 into it. These are the pinned suite versions, and the run changed no tracked file.
- No header states more than its cases assert. I checked each new header against the file's `test(` titles and assertions, the case counts (2, 6, 6, 4, 2, 3 in task 2), and the feature files each header names. All the named feature files exist.

## Issues Encountered

None.

## Known Stubs

None.

## User Setup Required

None.

## Parent lines

- `CHANGELOG.md`: None.
- `.planning/BACKLOG.md`: None.
- Key Decisions table: None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

- With plan 08-02's three trimmed headers and the five files that already state their class, every remaining integration file now names its class. The 08-05 ITSCOPE-04 gate can check `(ITSCOPE-01)` mechanically.
- The wave's post-merge `npm run check` on the combined tree is the full verdict.

## Self-Check: PASSED

- Twenty-one modified files present; commits 9019bd3, e89a9e6, 8484ced, and 382ec65 are ancestors of HEAD.
