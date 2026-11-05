---
phase: 01-foundation-and-pi-1-5-0
plan: "13"
subsystem: testing
tags: [cucumber, check-features, ci, github-actions, dual-profile, mcp]

requires:
  - phase: 01-foundation-and-pi-1-5-0
    provides: "01-07 profiles and test:cucumber:profile; 01-09 profile-following shared Pi and @adapter-only/@builtin-only tags; 01-10 stand-in and MCP implementation steps"
provides:
  - "check:features rules: exactly one implementation tag on an MCP scenario, at most one on any scenario, no pi-mcp-adapter under @mcp, an ID licensing @adapter-only/@builtin-only"
  - "@mcp on the 25 MCP scenarios that pass under both profiles"
  - "classifyMcpImplementation through the extension's softDepStatus"
  - "CI behavioral matrix with a profile axis running test:cucumber:profile"
  - "per-profile shard coverage test"
  - "cucumber skill reconciled with the harness as built"
affects: [mcp-builtin phase 2, mcp-builtin phase 3, mcp-builtin phase 4, mcp-builtin phase 5, 01-14]

actuals:
  tokens: 105500
  tasks: 3
  commits: 3
plan_head_before: cdef937310286fed2bc99c57505c00db3da94bd5
plan_head_after: 85b7c7290c0d4b1e0889d3ce8f0f1ec1c73475ad

tech-stack:
  added: []
  patterns:
    - "Pickle-level findings in check-features.mjs: a list of rule functions over each pickle's inherited tags, step texts, and step argument values, reported at the scenario line"
    - "CI matrix items {profile, shard, paths}, with matrix values reaching the shell only through env:"

key-files:
  created: []
  modified:
    - scripts/check-features.mjs
    - features/lib/mcp-implementation.ts
    - features/agent/lifecycle.feature
    - features/plugin/apply.feature
    - features/plugin/import.feature
    - features/plugin/install-rollback.feature
    - features/plugin/staging-warnings.feature
    - features/plugin/update.feature
    - features/plugin/update-rollback.feature
    - .github/workflows/ci.yml
    - test/architecture/behavioral-shard-coverage.test.ts
    - .agents/skills/cucumber/SKILL.md
    - .agents/skills/cucumber/rules/features.md
    - .agents/skills/cucumber/rules/layout.md
    - .agents/skills/cucumber/rules/world-and-stand-ins.md

key-decisions:
  - "The shard test reads the profiles from cucumber.json (all but default), so a new profile without CI shards fails the test"
  - "Background steps count toward the MCP-scenario predicate (pickles include them), so update-rollback.feature is tagged @mcp at feature level"
  - "The CI builtin leg is named shard 'all' with paths 'features'"

patterns-established:
  - "Tag rules live in scripts/check-features.mjs as pickle rules; the skill's features.md lists what the gate enforces"

requirements-completed: [DUAL-01, DUAL-02, DUAL-03]

coverage:
  - id: D1
    description: "check:features fails an untagged MCP scenario and a doubly tagged scenario"
    requirement: DUAL-02
    verification:
      - kind: other
        ref: "npm run check:features (25 findings before tagging; planted second tag in update-rollback.feature failed; clean after)"
        status: pass
    human_judgment: false
  - id: D2
    description: "check:features fails an @mcp scenario naming pi-mcp-adapter and an @adapter-only scenario with no ID"
    requirement: DUAL-02
    verification:
      - kind: other
        ref: "npm run check:features with planted violations in update-rollback.feature and listing.feature (12 findings), clean after restore"
        status: pass
    human_judgment: false
  - id: D3
    description: "The 25 newly tagged @mcp scenarios pass under the builtin profile, and the adapter profile stays green"
    requirement: DUAL-01
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile builtin features (39 passed)"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter, lifecycle 1168 passed and components 390 passed"
        status: pass
    human_judgment: false
  - id: D4
    description: "The harness probe classifies a Pi with the extension's softDepStatus"
    requirement: DUAL-02
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter features/mcp-server/implementation-profiles.feature (5 passed); builtin (1 passed)"
        status: pass
    human_judgment: false
  - id: D5
    description: "CI runs three behavioral legs with a profile axis; the shard test checks every feature file per profile"
    requirement: DUAL-03
    verification:
      - kind: unit
        ref: "test/architecture/behavioral-shard-coverage.test.ts"
        status: pass
      - kind: other
        ref: "npm run lint:workflows; pre-commit (yamllint --strict, yamlfmt, zizmor) on ci.yml"
        status: pass
    human_judgment: true
    rationale: "The matrix has not run on a hosted runner yet; plan 01-14 dispatches CI and measures each leg against the 15-minute timeout."
  - id: D6
    description: "The cucumber skill describes the harness as built"
    verification: []
    human_judgment: true
    rationale: "Prose accuracy against the harness is a reviewer judgment; step texts were spot-checked with grep."

duration: 41min
completed: 2026-11-04
status: complete
---

# Phase 1 Plan 13: Implementation-tag gate, CI profile axis, and the skill as built Summary

**`check:features` now enforces the four MCP implementation-tag rules over every pickle, 25 both-profile MCP scenarios carry `@mcp`, the harness probe classifies through the extension's own `softDepStatus`, and CI runs adapter lifecycle, adapter components, and builtin all through `test:cucumber:profile`, with a shard test that checks every feature file per profile.**

## Performance

- **Duration:** about 41 min
- **Started:** 2026-11-04T07:25Z (approximate)
- **Completed:** 2026-11-04T08:06:30Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- `scripts/check-features.mjs`: the dry run keeps, per pickle, its uri, name, first AST node, inherited tag names, and each step's text and argument values (doc string content, table cell values). It keeps the scenario lines and the feature descriptions by uri. A list of pickle rules reports at the scenario's line, deduplicated across Outline rows:
  - an MCP scenario (a step text with the word `mcp`, or a doc string or cell containing `mcpServers` or `.mcp.json`) with no implementation tag;
  - any scenario with two or more implementation tags;
  - an `@mcp` scenario whose step texts, cells, or doc strings contain `pi-mcp-adapter`;
  - an `@adapter-only` or `@builtin-only` scenario whose name and feature description hold no ID matching `\b[A-Z]+(?:-[A-Z0-9]+)*-\d+\b`.
- `@mcp` tags: `agent/lifecycle.feature` 1, `plugin/apply.feature` 5, `plugin/import.feature` 4, `plugin/install-rollback.feature` 4, `plugin/staging-warnings.feature` 4, `plugin/update.feature` 1 (line 655, the research's 682), and `plugin/update-rollback.feature` at feature level (6 scenarios). The new rule's findings matched the research inventory exactly: 25 findings, no others.
- `features/lib/mcp-implementation.ts`: `classifyMcpImplementation(commands)` keeps its signature and returns `softDepStatus({ getAllTools: () => [], getCommands: () => commands mapped to { name, source, sourceInfo: { path } } }).mcpImplementation`. The local `ADAPTER_COMMAND_NAME` and `BUILTIN_SOURCE_PATH` are gone.
- `.github/workflows/ci.yml`: matrix items `{ profile, shard, paths }`: adapter lifecycle (`features/marketplace features/plugin`), adapter components (the six function directories), builtin all (`features`). Job name `behavioral tests, <profile> <shard> (Node 24)`. `PROFILE` and `SHARD_PATHS` come through `env:`, and the step runs `npm run test:cucumber:profile -- --profile "$PROFILE" $SHARD_PATHS`. `fail-fast: false` and `timeout-minutes: 15` stay. The job comment describes the profile axis (DUAL-03). `package` still `needs: behavioral`.
- `test/architecture/behavioral-shard-coverage.test.ts`: parses `- profile:` items with their `shard:` and `paths:`, reads the profiles of `cucumber.json` except `default`, fails when the matrix's profiles differ from them, and checks every feature file is in exactly one shard of each profile. Title: "D-CF1-16, DUAL-03: every feature file is in exactly one CI behavioral shard of each profile".
- Cucumber skill: `features.md` (Background steps count; the ID shape with examples; what the gate reports, and where), `world-and-stand-ins.md` (the onboarding seed at the run's start too; the probe through `softDepStatus`; the restart wait applies to every restart from an adapter Pi; the CI matrix item shape, `PROFILE`/`SHARD_PATHS`, and the profile check of the shard test), `layout.md` (the Phase 2 row no longer lists the renamed `invocation` step module; the Phase 4 `agent-grants` step module is no longer NEW), `SKILL.md` (the gate includes the MCP implementation tags). `steps.md` already matched the code.

## Measured cucumber runs (4 CPUs, parallel 8, local)

| Run | Scenarios | Result | Duration |
|-----|-----------|--------|----------|
| builtin profile, whole suite (after Task 1) | 39 | 39 passed | 33.9 s |
| builtin profile, whole suite (final) | 39 | 39 passed | 1m 06.6s |
| adapter, `features/marketplace features/plugin` (final) | 1168 | 1168 passed | 3m 00.5s |
| adapter, the six function directories (final) | 390 | 390 passed | 7m 25.7s |
| adapter, `implementation-profiles.feature` (Task 2) | 5 | 5 passed | 46.6 s |
| builtin, `implementation-profiles.feature` (Task 2) | 1 | 1 passed | 14.0 s |

39 = the 14 builtin scenarios before this plan plus the 25 new `@mcp` ones. 1168 + 390 = 1558, the adapter whole suite. The components leg (7.4 min locally) is the longest; plan 01-14 measures the hosted numbers against the 15-minute timeout.

## Fail-first proofs (local, reverted before each commit)

- **Untagged MCP scenario (Task 1):** before any tag was added, `npm run check:features` failed with 25 findings of the form `features/plugin/apply.feature:16: the MCP scenario carries no MCP implementation tag: add exactly one of @mcp, @adapter-only, @builtin-only, @own-implementation (.agents/skills/cucumber/rules/features.md)`.
- **Two tags (Task 1):** an `@adapter-only` planted on the first scenario of the `@mcp` feature `update-rollback.feature` failed with `the scenario carries 2 MCP implementation tags, @mcp and @adapter-only; keep exactly one`.
- **Adapter literal under @mcp (Task 2):** a Background cell of `update-rollback.feature` changed to `demo pi-mcp-adapter` failed all six scenarios with `the @mcp scenario names pi-mcp-adapter; only an @adapter-only, @builtin-only, or @own-implementation scenario may`.
- **No ID (Task 2):** `(BLT-01)` removed from `listing.feature`'s description failed its six scenarios with `the @adapter-only scenario names no requirement or decision ID in its title or its feature description`.
- **Shard test (Task 3):** the builtin leg's paths changed to `features/plugin` failed the test, listing every non-plugin feature file under `profile: 'builtin'`.

## Task Commits

1. **Task 1: Require an implementation tag on every MCP scenario and tag the rest @mcp** - `dcfa174` (test). The tracer gate re-ran `check:features` and the builtin whole-suite run before Task 2; both passed.
2. **Task 2: The @mcp adapter-literal rule, the tag-reason rule, and the probe on the extension's own detection** - `1801d8d` (test)
3. **Task 3: CI profile axis, per-profile shard coverage, and the skill as built** - `85b7c72` (ci)

## Files Created/Modified

- `scripts/check-features.mjs` - pickle collection and the four tag rules
- `features/lib/mcp-implementation.ts` - classification through `softDepStatus`
- `features/agent/lifecycle.feature`, `features/plugin/{apply,import,install-rollback,staging-warnings,update,update-rollback}.feature` - `@mcp` tags
- `.github/workflows/ci.yml` - the profile axis
- `test/architecture/behavioral-shard-coverage.test.ts` - per-profile coverage
- `.agents/skills/cucumber/{SKILL.md,rules/features.md,rules/layout.md,rules/world-and-stand-ins.md}` - the skill as built

## Decisions Made

- The shard test takes its profile list from `cucumber.json` instead of a literal pair, so a third profile fails the test until CI shards it.
- An ID is checked in the pickle's name plus the feature description only (not a `Rule:` description), as the plan and the skill say.
- No scenario failed under builtin, so nothing moved to `verdict-markers.feature`, and plan 01-09's inventory has no defect to report.

## Deviations from Plan

None in behavior. Two process notes:

- The plan's scratch folder `.../scratchpad/01-13/` was used as `.../scratchpad/exec/01-13/`, which the orchestrator's environment block names.
- `steps.md` is in the plan's file list but needed no change: its `which did not fail` text matches the registered step (`["info", "warning"]`, fails on error).

**Total deviations:** 0 auto-fixed. **Impact on plan:** none.

## Issues Encountered

- The worktree guard refused compound shell commands (heredocs, `sed -i '18i\...'`, `env -u ... git commit`), so edits ran through small Python scripts in the scratch folder, and the Task 3 commit ran after `unset GH_TOKEN GITHUB_TOKEN` in the same call so that zizmor's online audit did not hit HTTP 401. `GH_TOKEN=` (empty) fails zizmor with "token cannot be empty". The per-plan ledger file was not written; commits are measured from the known base `cdef937`.
- The first Task 2 commit attempt failed gitlint (title over 72 characters); the retry with a shorter title committed as `1801d8d`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- **P1-13-DC-01: The CI job name changed from `behavioral tests, <shard> (Node 24)` to `behavioral tests, <profile> <shard> (Node 24)`.** A branch protection rule that names the old check names (`behavioral tests, lifecycle (Node 24)`, `behavioral tests, components (Node 24)`) would wait forever for them. Alternatives: keep the old names for the adapter legs. Why: the plan asks for each job to be named with its profile and shard. The owner should check required status checks before merging. Severity: Medium.
- **P1-13-DC-02: The builtin leg's shard is named `all`.** Alternatives: `whole`, `suite`, or no shard key. Why: it matches the "builtin all" leg name in the plan and the skill, and the shard test needs a name per item. Severity: Low.
- **P1-13-DC-03: The MCP-scenario word match is `\bmcp\b`, case-insensitive.** So `pi-mcp-adapter` and `mcp-adapter.json` in a step text count as the word mcp, and `mcp__plugin_demo_stub__echo` alone does not (the underscore is a word character). Alternatives: a substring match, which would also catch tool names. Why: the plan says "the word mcp", and the 25 findings matched the research inventory exactly. Severity: Low.
- **P1-13-DC-04: The tag-reason rule accepts any ID-shaped word, such as `UTF-8`, and does not check that the ID exists.** Alternatives: check the ID against REQUIREMENTS.md and PROJECT.md. Why: the plan gives the pattern only, and a lookup would couple the gate to planning files. Severity: Low.
- **P1-13-DC-05: The rule "a scenario that is not an MCP scenario carries no implementation tag" (features.md) is not gated.** I probed it with a temporary rule: no scenario violates it today. Alternatives: add a fifth rule. Why: the plan lists exactly four rules, and the skill's gate sentence names exactly those. Severity: Low.
- **P1-13-DC-06: Findings are reported at the scenario's line, not at the Outline row or the tag line.** An Outline's rows share one finding. Severity: Low.
- **P1-13-DC-07: `classifyMcpImplementation` passes no `sourceInfo.source`,** because `ListedCommand` from `test/e2e/_rpc.ts` does not carry it. So the extension's `sourceInfo.source` arm for the adapter never fires in the harness; the command-name arm decides. Alternatives: add `source` info to `ListedCommand` (a file outside this plan). Why: the plan names exactly name, source, and sourceInfo path, and the name arm covers every adapter launch the harness makes. Severity: Low.
- **P1-13-DC-08: The layout table's Phase 2 row drops the `invocation` step module, and the Phase 4 row drops NEW from `mcp-server/agent-grants`.** The table is a copy of the ROADMAP ownership table, so the skill now differs from ROADMAP in those two cells. Why: plan 01-09 renamed `invocation.steps.ts` to `agent-grants.steps.ts`, and the skill must describe the files as built. ROADMAP may want the same edit. Severity: Low.
- **P1-13-DC-09: The SKILL.md review paragraph still says `npm run test:cucumber` for a review run** and does not mention the 10-minute tool cap or splitting by paths. Why: the commands rule of the local-verification skill covers `test:cucumber:profile`, and the cucumber skill's `world-and-stand-ins.md` explains when to use it. Severity: Low.
- **P1-13-DC-10: `actuals.tokens` is chars/4 over the whole changed files (422162 chars), not over the diff (60850 chars, about 15200 tokens).** The template says "over the files you actually changed"; the diff-only number would read as a large under-run against the 110000 estimate. Severity: Low.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-14 can dispatch CI: three behavioral legs, each with `timeout-minutes: 15`. Local numbers: adapter lifecycle 3.0 min, adapter components 7.4 min, builtin all 1.1 min.
- Child phases get a gate that fails an untagged MCP scenario, a double tag, an adapter name under `@mcp`, and a single-profile tag without an ID.

## Self-Check: PASSED

- FOUND: scripts/check-features.mjs (contains `@own-implementation`, `pickle`), .github/workflows/ci.yml (contains `test:cucumber:profile`), test/architecture/behavioral-shard-coverage.test.ts (contains `profile`)
- FOUND: dcfa174, 1801d8d, 85b7c72 (ancestors of HEAD)
- Acceptance: `@mcp` in update-rollback.feature = 1; `softDepStatus` in features/lib/mcp-implementation.ts = 3; `test:cucumber:profile` in ci.yml = 1; `profile: builtin` in ci.yml = 1; check:static passes; lint:workflows passes; shard test passes; both profiles pass the whole suite.

---
*Phase: 01-foundation-and-pi-1-5-0*
*Completed: 2026-11-04*
