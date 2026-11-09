---
phase: 09-legacy-mcp-entry-move
verified: 2026-11-08T16:55:00Z
status: passed
score: 3/3 must-haves verified
covered_files:
  - .planning/phases/09-legacy-mcp-entry-move/09-01-PLAN.md
  - .planning/phases/09-legacy-mcp-entry-move/09-01-SUMMARY.md
  - features/mcp-server/legacy-move.feature
  - features/step_definitions/mcp-server/legacy-move.steps.ts
covered_digest: "v4:sha256:de0dd2941661a282838db7f31bd5dc89cca7faebd9c54a487ae5498c72939882"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 9: Legacy MCP Entry Move — Verification Report

**Phase goal:** A user upgrading from a release that wrote plugin MCP servers into `mcp.json` has them moved to `mcp-adapter.json` on load, with the servers still running and the user's own entries left alone.

The verification ran inline in the child session, following `.claude/agents/gsd-verifier.md` (coordinator rule; P9-DC-13). The evidence is the scenario text, the executor's red proofs, and the gate runs listed below. Every scenario was run by the gates, not only read.

## Roadmap success criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | On load, the entries a plugin owns in a legacy `mcp.json` move to `mcp-adapter.json`, and the plugin's servers still connect afterwards (AMIG-01) | ✓ VERIFIED | The seed and the project-scope scenario pin the `moved` row and the whole text of both files, for the user scope and the project scope. In "After the move, the next session offers the plugin's server tools under its new name", the active implementation lists `mcp__plugin_demo_stub__echo`, and `mcp.json` keeps only the user's server. With the move turned off, this scenario fails at the tool table under adapter and at the `mcp.json` text under builtin (09-01-SUMMARY red proofs). |
| 2 | The user's own, unmarked `mcp.json` entries stay byte for byte as they were (AMIG-02) | ✓ VERIFIED | "A load moves only the plugin's marked servers and leaves each of the user's own servers as written" compares the whole `mcp.json` text after the load. The text covers args and env, an unexpanded `${ALPHA_HOME:-/srv/alpha}`, an unmarked copy of the plugin's entry, and a top-level member. A mutated move that also deletes the unmarked copy fails it (probe B). P9-DC-01 records how "byte for byte" is read. |
| 3 | A second load moves nothing and reports nothing, and each scenario passes under every MCP implementation it applies to (AMIG-01, AMIG-02) | ✓ VERIFIED | "A second load after the move reports nothing and leaves both mcp files as the first load left them" pins `the session reports no results` and the whole text of both files. All 5 scenarios carry `@mcp` and passed under both the `adapter` and the `builtin` profile, both in the owned-file runs and in the gate runs. |

## Requirements

| Requirement | Plan | Status |
|-------------|------|--------|
| AMIG-01 | 09-01 | ✓ Satisfied |
| AMIG-02 | 09-01 | ✓ Satisfied |

## Decisions (09-CONTEXT.md)

The plan covers D-BG-901 to D-BG-907; the decision-coverage gate reported 7 of 7. The feature holds exactly five scenarios, so no scenario covers a D-BG-907 case.

## Gates

| Run | Result |
|-----|--------|
| Wave gate, run in parts: `check:static`, `test:unpaired`, `test:integration`, `test:coverage:direct:all` | all exit 0 |
| Wave gate cucumber, `--parallel 3` | First run red. Adapter: 14 failures, builtin: 3 failures, all in feature files this phase does not touch (autoapply, update, install, skill, BLT-01/04). The load average was 80-90 on 28 cores. A rerun of those exact scenarios passed: 14/14 adapter and 3/3 builtin. |
| Phase gate `npm run check` | Static checks, unpaired tests, and integration tests passed. Adapter cucumber: 1641/1644, with 3 unrelated failures (update.feature:800 and :670, disable.feature:34) at load average 126-134. A rerun of those 3 passed. The run stopped there, so the builtin profile and coverage ran separately. Builtin: 150/152; its 2 failures (agent-grants.feature:147 and :253) passed on rerun. `test:coverage:direct:all` exited 0. |
| `npm run test:modules` | exit 0 |
| `find ~/.pi -newer <marker>` during the gates | no change |

Every failure seen was in a feature file outside Phase 9. None reproduced on rerun, and each run happened while the shared machine was heavily overloaded. All of Phase 9's own scenarios passed on every run.

## Anti-patterns

None. No product file changed, and no frozen file or unowned feature file was edited.

## Human verification

None needed.

---

_Verified: 2026-11-08T16:55:00Z_
_Verifier: Claude (gsd-verifier, inline)_
