---
phase: 03-resource-bridges
plan: 05
subsystem: bridges-agents
tags: [agents, frontmatter, marker, ag-1, ag-2, ag-3, ag-5, ag-7, ag-9, ag-12, pi-10, t-03-25, t-03-27, t-03-32]

requires:
  - phase: 02-domain-persistence
    provides: locations, agents-index-schema, name-validation, errors-bridges
  - phase: 03-resource-bridges (Plan 03-01)
    provides: shared/vars.substituteClaudeVars, errors-bridges (AgentForeignContentError, AgentOwnershipConflictError), foreign-agents fixtures
  - phase: 03-resource-bridges (Plan 03-02)
    provides: persistence/agents-index-io (loadAgentsIndex/saveAgentsIndex)

provides:
  - bridges/agents (full module surface)
  - prepareStagePluginAgents / commitPreparedAgents / abortPreparedAgents (10-step two-phase commit)
  - unstagePluginAgents (per-entry Outcome union with AG-5 soft-fail)
  - convertAgent + assertNoAgentCollisions + MODEL_MAP/TOOL_MAP/THINKING_VALUES (AG-7 user contract)
  - parseFrontmatter / emitGeneratedAgentFile (AG-6/AG-8 line-based round-trip)
  - isOwnedAgentFile + GENERATED_AGENT_PREFIX/MARKER (AG-5 two-part check)
  - partitionByOwner / findOwnershipConflicts (AG-3/AG-9 pure helpers)
  - discoverPluginAgents (AG-1 + BOM-tolerant sourceHash + symlink/dotfile skip)
  - StageAgentsCommitResult.recorded[] (W-05 fix for Phase 5 state.json.installs)
  - StageAgentsCommitResult.failed[] (W-08 fix for AG-5 prepare-time soft-fail)

affects:
  - phase 04-orchestrator-shell: consumes prepareStagePluginAgents + StageAgentsCommitResult.recorded[]
  - phase 05-install-update: consumes recorded[] for state.json.installs population
  - phase 05-install-update: routes failed[] entries to notifyWarning per CONTEXT.md "Integration Points"
  - phase 05-install-update: catches AgentOwnershipConflictError + PathContainmentError per PI-14

tech-stack:
  added: []
  patterns:
    - "Two-phase prepare/commit with discriminated PreparedAgentsStaging (noop|staged) union"
    - "AG-5 marker constants exposed via shared/markers-snapshot test for byte-for-byte stability"
    - "AG-3 partition + AG-9 conflict detection hoisted into pure index-mutation.ts module (testable without IO)"
    - "AG-5 prepare-time foreign content soft-fail via failed[] (D-06 corollary), NOT throw"
    - "saveAgentsIndex is the LAST step in commit (V1 self-heal property preserved)"

key-files:
  created:
    - extensions/claude-marketplace/bridges/agents/types.ts
    - extensions/claude-marketplace/bridges/agents/marker.ts
    - extensions/claude-marketplace/bridges/agents/frontmatter.ts
    - extensions/claude-marketplace/bridges/agents/convert.ts
    - extensions/claude-marketplace/bridges/agents/discover.ts
    - extensions/claude-marketplace/bridges/agents/index-mutation.ts
    - extensions/claude-marketplace/bridges/agents/stage.ts
    - extensions/claude-marketplace/bridges/agents/unstage.ts
    - extensions/claude-marketplace/bridges/agents/index.ts
    - tests/bridges/agents/marker.test.ts
    - tests/bridges/agents/frontmatter.test.ts
    - tests/bridges/agents/convert.test.ts
    - tests/bridges/agents/discover.test.ts
    - tests/bridges/agents/index-mutation.test.ts
    - tests/bridges/agents/stage.test.ts
    - tests/bridges/agents/unstage.test.ts
  modified:
    - tests/architecture/markers-snapshot.test.ts (extended with AG-5 byte-for-byte assertions)

key-decisions:
  - "PI-10 substitution preserved in agent bodies (D-08 corollary): convertAgent calls substituteClaudeVars on body verbatim; matches V1 + 03-01-SUMMARY resolution. Tested via 'AG-7 / PI-10 convertAgent passes ${CLAUDE_PLUGIN_ROOT} substitution through to body'."
  - "AG-5 prepare-time foreign content surfaces via result.failed[] (W-08/B-08/D-06 corollary), NOT thrown. AgentForeignContentError is reserved for hypothetical future throw sites; AG-9 cross-owner conflict THROWS as AgentOwnershipConflictError (distinct case)."
  - "_foreignPreservedEntries are kept in agents-index.json across commit; on-disk file untouched. A subsequent prepare will surface the same warning, giving the user a stable retry signal."
  - "saveAgentsIndex is invoked as the LAST step of commit, after all rm + rename succeed. If commit dies between rm and saveAgentsIndex, the index still points at OLD targetPaths -- next unstage's ENOENT tolerance + the old paths self-heals (V1 carry-forward)."
  - "Source hash computed over raw bytes (not utf8 text) so BOM and line-ending changes are detectable. RESEARCH.md 'What V1 got right' #5 carry-forward."
  - "Stage tests construct AgentsIndex via atomicWriteJson directly so they can seed pre-existing rows (mp2 cross-owner, foreign-content fixtures) without going through bridge plumbing."

patterns-established:
  - "Pattern: AG-3 partition + AG-9 conflict detection in pure index-mutation.ts (no IO, no fs touch). Stage and unstage both consume partitionByOwner; only stage uses findOwnershipConflicts."
  - "Pattern: per-entry Outcome union ({removed, name} | {preserved, entry, failure}) lets unstage parallelize rm calls with Promise.all and partition results into removedNames + failed + preservedEntries."
  - "Pattern: opaque-handle prepared-staging discriminated-union -- consumers narrow on `kind`, internal underscore-prefixed fields (_previousEntries, _foreignPreservedEntries, etc.) are NOT re-exported from index.ts barrel."
  - "Pattern: marker constants (GENERATED_AGENT_PREFIX, GENERATED_AGENT_MARKER) exposed for tests via markers-snapshot architectural test; byte-for-byte equality enforced as user contract."

requirements-completed: [AG-1, AG-2, AG-3, AG-4, AG-5, AG-6, AG-7, AG-8, AG-9, AG-10, AG-11, AG-12, AS-9, RN-4]

duration: 19min
completed: 2026-05-10
---

# Phase 03 Plan 05: AgentsBridge Summary

**8 source modules + barrel implementing the agents bridge: AG-5 marker discipline, AG-7 mapping (MODEL_MAP/TOOL_MAP user contract), AG-3 partition + AG-9 cross-owner guard, two-phase prepare/commit with AG-5 prepare-time soft-fail, and unstage with foreign-content preservation -- 14 of the 33 Phase 3 REQ-IDs land here.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-05-10T18:07:17Z
- **Completed:** 2026-05-10T18:26:43Z
- **Tasks:** 3
- **Files created:** 16
- **Files modified:** 1
- **Tests added:** 89 (passing) -- total project suite 410 (passing)

## Accomplishments

- Full agents bridge module: marker / frontmatter / convert / discover / index-mutation / stage / unstage / barrel
- AG-5 two-part marker check enforced (basename prefix `claude-marketplace-` AND body marker `generated by pi-claude-marketplace`)
- AG-7 conversion: MODEL_MAP / TOOL_MAP / THINKING_VALUES carried byte-for-byte from V1 with snapshot tests
- AG-9/RN-4 cross-owner guard throws `AgentOwnershipConflictError` with full conflict list
- AG-5 prepare-time foreign content surfaces softly via `result.failed[]` per D-06 corollary; `_foreignPreservedEntries` keeps index rows + on-disk files untouched through commit
- AS-9 noop short-circuit (no agentsSourceDir AND no previous entries) materializes neither agents/ nor agents-index.json
- PI-10 `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}` substitution applied to agent bodies via shared/vars.ts (D-08 corollary)
- markers-snapshot architectural test extended with AG-5 byte-for-byte assertions

## Task Commits

Each task was committed atomically:

1. **Task 1: marker + frontmatter + convert + discover + tests + markers-snapshot extension** -- `f1bf92d` (feat)
2. **Task 2: index-mutation + stage (10-step prepare + commit + abort) + tests** -- `6bfe131` (feat)
3. **Task 3: unstage (foreign-content soft-fail) + barrel + tests** -- `59a4e96` (feat)

## Files Created/Modified

### Source modules (extensions/claude-marketplace/bridges/agents/)

- `types.ts` -- Type contracts: discriminated PreparedAgentsStaging (noop|staged), StagedAgentRecord (W-05), UnstageAgentFailure / failed[] (W-08), all internal `_`-prefixed fields ARE on PreparedAgentsStaged but NOT re-exported from index.ts
- `marker.ts` -- AG-5 isOwnedAgentFile + GENERATED_AGENT_PREFIX + GENERATED_AGENT_MARKER user-contract constants (V1 isSafeToTouch hoisted from agent-stage.ts)
- `frontmatter.ts` -- parseFrontmatter (AG-6 line-based, colon-tolerant) + emitGeneratedAgentFile (AG-8 deterministic field order + sanitize `-->` HTML-comment escape) + emitYamlScalar (quote-flip) + sanitizeProvenance + normalizeBody. Re-exports GENERATED_AGENT_MARKER from marker.ts
- `convert.ts` -- AG-7 conversion pipeline: MODEL_MAP/TOOL_MAP/THINKING_VALUES (user contract), convertAgent (description fallback / model mapping / tool mapping with disallowedTools / thinking+effort fallback / skills cross-validation / dropped-fields tracking / PI-10 substituteClaudeVars), assertNoAgentCollisions (AG-12 throw with both source names listed)
- `discover.ts` -- AG-1 + AG-6 plugin agent discovery: ENOENT/ENOTDIR -> []; sorted by filename; sha256 over RAW BYTES (BOM-tolerant); skip dotfiles, non-.md, symlinks (T-03-27); name fallback frontmatter `name:` -> filename stem
- `index-mutation.ts` -- AG-3 partitionByOwner + AG-9/RN-4 findOwnershipConflicts (pure in-memory; no IO; frozen result arrays for defense-in-depth)
- `stage.ts` -- 10-step prepareStagePluginAgents (V1 carry-forward + AG-5 soft-fail delta) + commitPreparedAgents (rm safe-to-overwrite + mkdir + rename + saveAgentsIndex LAST) + abortPreparedAgents (cleanup-only)
- `unstage.ts` -- unstagePluginAgents per-entry Outcome union (`{removed, name}` | `{preserved, entry, failure}`); AG-5 soft-fail PRESERVES index row + surfaces failed[]; ENOENT-tolerant happy path; saveAgentsIndex with `nonMatching ∪ preservedMatching`
- `index.ts` -- Public-surface barrel; internal `_`-prefixed fields intentionally NOT re-exported (D-01 opaque-handle discipline)

### Tests (tests/bridges/agents/)

- `marker.test.ts` (8 tests) -- ENOENT ok:true, basename-mismatch ok:false, body-missing-marker ok:false, ok:true happy path, EISDIR propagation, byte-for-byte constant assertions, mid-body marker substring detection
- `frontmatter.test.ts` (15 tests) -- colon-in-description tolerance, no-leading-/-no-closing-`---` paths, CRLF, emitYamlScalar quote-flip variants, sanitizeProvenance escape, deterministic field order, model/skills omission rules, marker substring presence, `-->` sanitize end-to-end, `(none)` rendering
- `convert.test.ts` (22 tests) -- model mapping (3 keys × 1 unknown × inherit), tools mapping (Read,Bash,Edit / disallowed strip / WebFetch dropped), thinking valid + invalid + fallback, description fallback, skills knownSkills cross-validation + unknown warning, AG-11 throw with full message, AG-12 throw with both source names, PI-10 substitution, MODEL_MAP/TOOL_MAP/THINKING_VALUES snapshot equality, droppedFields/droppedTools recording
- `discover.test.ts` (8 tests) -- fixture parse, AG-1 elision (with + without prefix), BOM-tolerant sourceHash, ENOENT empty, dotfile/non-md skip, symlink skip (T-03-27), filename-stem fallback
- `index-mutation.test.ts` (7 tests) -- partitionByOwner separation + frozen-array invariant + empty-previous case, findOwnershipConflicts single + multi (input order) + no-overlap + last-win-on-dup
- `stage.test.ts` (16 tests) -- happy path file landing + agents-index.json + recorded[], AG-3 cross-marketplace preservation, AG-5 wrong-basename + missing-marker soft-fail variants, AG-5 commit preserves byte-identical foreign + preserves index row, AG-9 cross-owner throw, AS-9 noop variants (kind + commit no-op + dir non-creation), AG-7 substitution end-to-end, marker substring + basename invariants, re-stage path, abort cleanup
- `unstage.test.ts` (7 tests) -- happy path, AG-3 cross-marketplace, AG-5 wrong-basename + missing-marker soft-fail (preserve index row), ENOENT idempotent, no-match noop, per-row corruption surfaces in warnings[]

### Modified

- `tests/architecture/markers-snapshot.test.ts` -- Imports GENERATED_AGENT_MARKER + GENERATED_AGENT_PREFIX from bridges/agents/marker.ts; adds 2 byte-for-byte equality tests (AG-5 user contract)

## Decisions Made

- **PI-10 vs D-08 resolution applied here:** D-08 said "agents do NOT need substitution" but PI-10 + V1 mandate body-level substitution. 03-01-SUMMARY sided with PI-10 (the shared primitive substitutes both agents AND skills/commands). This plan honors PI-10 by calling `substituteClaudeVars` on agent bodies -- verified via test "AG-7 / PI-10 convertAgent passes ${CLAUDE_PLUGIN_ROOT} substitution through to body".
- **AG-5 prepare-time soft-fail (W-08/B-08/D-06 corollary):** Foreign content found at a previous targetPath does NOT throw; it surfaces via `result.failed[]` and the Phase 5 orchestrator routes those entries to `notifyWarning`. Cross-owner (AG-9) is a distinct error class that DOES throw. `AgentForeignContentError` is exported (extends PathContainmentError per Plan 03-01) but never thrown by stage.ts in this implementation -- reserved for hypothetical future throw sites.
- **`_foreignPreservedEntries` survives commit:** A foreign-content row at prepare time is preserved in agents-index.json across the commit. On-disk file is untouched. A future prepare will re-surface the same warning, giving the user a stable retry signal until they manually clean up. Mirrors V1 unstage behavior on the prepare path.
- **`saveAgentsIndex` is the LAST step in commit:** rm + mkdir + rename run first, then saveAgentsIndex. If commit dies between the on-disk writes and saveAgentsIndex, the index still describes the OLD targetPaths -- next unstage's ENOENT tolerance + old paths self-heals on retry. V1 self-heal property carry-forward.
- **Source hash over raw bytes (not utf8 text):** BOM-tolerant + line-ending-tolerant. Two source files with identical post-decoding content but different bytes get different hashes; this is the desired property -- a manual edit that adds a BOM should be observable. Tested in discover.test.ts.

## Deviations from Plan

None -- plan executed as written. All eight source modules + tests + barrel landed at the paths and with the exports the plan specifies. No Rule-1/2/3 auto-fixes triggered.

## Issues Encountered

**1. WIP carry-forward review.** Prior capped attempt left WIP for Task 1 only at `.planning/.wip-cap-resume-2026-05-10/03-05/` (5 source files + 5 tests covering marker/frontmatter/convert/discover/markers-snapshot). I reviewed each WIP file against the plan, V1 reference, and CONTEXT.md, found them to align with the plan's contract, and adopted them as the baseline for Task 1. WIP did NOT cover index-mutation, stage, unstage, or the barrel -- those were written from scratch following the plan + V1 reference.

**2. Lint formatter feedback loop.** ESLint flagged 6 issues across Task 1 files (import-order grouping, unnecessary-type-assertion in frontmatter parser, void-expression in test arrow shorthand) -- all autofixable. Prettier reformatted convert.test.ts and stage.ts/.test.ts. None reflected logic changes.

**3. Plan grep heuristics.** Plan's done-criteria grep for `saveAgentsIndex` expects "returns 1" but the actual file has 4 occurrences (1 import + 1 awaited call + 2 doc-comment references). The functional invariant (one `await saveAgentsIndex(` call site in commit) holds -- the grep is a heuristic, not a contract.

## Confirmation: PI-10 substitution behavior preserved

`extensions/claude-marketplace/bridges/agents/convert.ts` line ~358 calls
`substituteClaudeVars(body, { pluginRoot, pluginData: pluginDataDir })`
on the agent body BEFORE handoff to `emitGeneratedAgentFile`. Test
`AG-7 / PI-10 convertAgent passes ${CLAUDE_PLUGIN_ROOT} substitution through to body`
verifies that input body `Use ${CLAUDE_PLUGIN_ROOT}/foo and ${CLAUDE_PLUGIN_DATA}/bar` produces output containing the absolute pluginRoot/pluginData paths and NO remaining `${...}` placeholders. Matches V1 + PI-10 + 03-01-SUMMARY's PI-10-side resolution.

## V1 Algorithm Carry-Forward Verified

| V1 lines | Successor module | Algorithm preserved? |
|----------|------------------|----------------------|
| `agent-stage.ts:200-230` (isSafeToTouch) | `marker.ts::isOwnedAgentFile` | YES (renamed; identical algorithm) |
| `agent-stage.ts:280-525` (prepare/commit/abort) | `stage.ts` | YES with documented W-05/W-08/D-06 deltas |
| `agent-stage.ts:591-663` (unstagePluginAgents) | `unstage.ts` | YES (per-entry Outcome union verbatim) |
| `agent-frontmatter.ts:1-226` (parser+emitter) | `frontmatter.ts` | YES (marker constant re-exported instead of redefined) |
| `agent-convert.ts:1-478` (mapping pipeline) | `convert.ts` | YES (substitutePluginVars→substituteClaudeVars; generatedAgentName imported from domain/) |
| `agent-stage.ts:232-280` (discoverPluginAgents) | `discover.ts` | YES (hoisted into dedicated module) |

## Next Phase Readiness

- Plan 03-06 (MCP bridge, parallel wave 2) depends only on Plan 03-01 + 03-02 outputs and does not import from bridges/agents. No coupling risk.
- Plan 04 / 05 (orchestrator + install/update) consume `prepareStagePluginAgents` / `unstagePluginAgents` / `recorded[]` / `failed[]` / typed errors. Surface is stable + tested.
- No blockers. No deferred items. All 14 in-scope REQ-IDs (AG-1..AG-12, AS-9, RN-4) covered with tests.

## Self-Check: PASSED

Verified post-write:
- `extensions/claude-marketplace/bridges/agents/types.ts` exists ✓
- `extensions/claude-marketplace/bridges/agents/marker.ts` exists ✓
- `extensions/claude-marketplace/bridges/agents/frontmatter.ts` exists ✓
- `extensions/claude-marketplace/bridges/agents/convert.ts` exists ✓
- `extensions/claude-marketplace/bridges/agents/discover.ts` exists ✓
- `extensions/claude-marketplace/bridges/agents/index-mutation.ts` exists ✓
- `extensions/claude-marketplace/bridges/agents/stage.ts` exists ✓
- `extensions/claude-marketplace/bridges/agents/unstage.ts` exists ✓
- `extensions/claude-marketplace/bridges/agents/index.ts` exists ✓
- All 7 test files exist ✓
- `tests/architecture/markers-snapshot.test.ts` modified with AG-5 assertions ✓
- Commits f1bf92d, 6bfe131, 59a4e96 present in git log ✓
- `npm test` exits 0 with 410 passing tests ✓
- `npx tsc --noEmit` exits 0 ✓
- `npx eslint extensions/claude-marketplace/bridges/agents/ tests/bridges/agents/` exits 0 ✓
- `npx prettier --check extensions/claude-marketplace/bridges/agents/ tests/bridges/agents/` exits 0 ✓
- No cross-bridge imports detected (grep returns empty) ✓

---
*Phase: 03-resource-bridges*
*Completed: 2026-05-10*
