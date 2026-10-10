---
phase: 08-clear-milestone-debt
plan: 14
subsystem: docs
tags: [docs, mcp, d-08-01, d-08-02, d-08-03, d-08-04, d-08-05, debt-02, debt-03, debt-04]

requires:
  - phase: 08-clear-milestone-debt
    provides: "08-02 source-outdated row and missing-checkout catalog sentence; 08-03 choice store; 08-04 reinstall mirror fallback; 08-05 IN-07 code half; 08-08 pinned enable and import shapes; 08-10 OAuth beside headers and its side-check table"
provides:
  - "docs/mcp-compatibility.md: User overrides with openUi, trace, the serverChoices store and the /mcp-adapter disable write target; a User choices divergence (D-08-02)"
  - "docs/mcp-compatibility.md: the auth: \"oauth\" translated-field row, an OAuth beside headers section with the 12-row header table, the reworded dropped-auth text and an OAuth refusal divergence (D-08-04)"
  - "docs/mcp-compatibility.md: the source-outdated, mirror-fallback and missing-checkout remedies (D-08-05)"
  - "docs/output-catalog.md: openUi and trace in the carried list, the store sentence, and the Fresh enable severity paragraph (D-08-03); no code block changed"
  - "README pair: key collision example, per-tool mcp: launch failure with the whole-server workaround, the pi-subagents 0.74.0 floor"
affects: [08-21 ledger plan (closes the doc findings and the DEBT verdicts)]

actuals:
  tokens: 8400
  tasks: 3
  commits: 3
plan_head_before: c58d06d52aa6186f3c490e3f95c7df280c256222
plan_head_after: c2e89982381523b26f72a23a8fa274e181a68086

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - docs/mcp-compatibility.md
    - docs/output-catalog.md
    - README.md
    - README.es.md
    - .planning/phases/04-variable-expansion-at-claude-code-parity/04-SECURITY.md

key-decisions:
  - "The per-project versus per-scope divergence sits in a new `### User choices` subsection of Divergences, after Loading"
  - "README prerequisites now name pi-subagents 0.74.0 or newer, because the plan's premise that they already did was false"

requirements-completed: []

duration: 15min
completed: 2026-10-10
status: complete
---

# Phase 08 Plan 14: User docs for the choice store, OAuth beside headers and the move remedies Summary

**The MCP docs now say where a user's per-server choices live and how long they last, when this extension writes `auth: "oauth"` and which headers keep a server off OAuth, and how to clear each migration cause. The doc-only review findings are fixed in English and Spanish. No catalog code block changed.**

## Performance

- **Duration:** about 15 min (2026-10-10T05:54Z to 06:01Z for the three commits)
- **Tasks:** 3/3
- **Files modified:** 5

## Findings closed

| Finding | Where | Commit |
| ------- | ----- | ------ |
| D-08-01, D-08-02 docs (MCPOVR-01) | `docs/mcp-compatibility.md` User overrides and `### User choices`; `docs/output-catalog.md` override-kept prose | 73200878 |
| D-08-03 catalog sentence (MCPROW-01) | `docs/output-catalog.md` `### Fresh enable` paragraph, citing the enable-disable and import execute pinned cases | 73200878 |
| D-08-04 docs (P3 WR-02 docs) | translated-field row, `### OAuth beside headers`, Dropped fields, Variables divergence | de427118 |
| D-08-05 docs (P5 IN-07, IN-08 docs) | `### Entries that stay in mcp.json` rows | de427118 |
| P4 IN-07 (docs half) | `### The project directory at user scope` | de427118 |
| P4 IN-08 | Variables divergence load-order item; AR-04-04 in 04-SECURITY.md | de427118 |
| P4 IN-09 | split-token wording in `### Syntax that only pi-mcp-adapter knows` | de427118 |
| P3 WR-03a (docs) | `## Server and tool names` collision paragraph | c2e89982 |
| P3 IN-05 | `docs/mcp-compatibility.md` and both READMEs | c2e89982 |
| P3 WR-04 | `## Hooks and agents` and both READMEs | c2e89982 |
| P1 IN-03 | both READMEs | c2e89982 |

## WR-04 source check (pi-subagents 0.74.0)

Checked in `/var/tmp/mcp4-reverify-p1/subagents/node_modules/pi-subagents` (package.json version `0.74.0`):

- `src/runs/shared/mcp-direct-tool-grant.js:46`: `if (toolFilter !== true && !toolFilter.has(tool.name)) continue;`. A per-tool selector matches only the exact tool name in the cached server metadata.
- `src/runs/shared/mcp-direct-tool-grant.js:73-75`: a selector that granted nothing goes into `unresolvedSelectors`.
- `src/runs/shared/child-tool-plan.js:218-221`: any unresolved selector throws `formatUnresolvedMcpDirectToolSelectors(...)`, so the whole child launch fails.

## OAuth claims checked against pi-mcp-adapter 5.2.0

- `dist/mcp-auth-fetch.js:3-30` (`resolveOAuthHeaders`): an unset or empty `${VAR}`, `$env:VAR` or `{env:VAR}` throws `Missing environment credential in OAuth HTTP headers`, and an empty resolved value throws `Failed to resolve OAuth HTTP headers`.
- `dist/server-manager.js:1313-1314`: `connectHttpClient` calls it with no catch when `supportsOAuth` is true. So a header whose variable is unset at run time stops the connection. The docs state this in the OAuth divergence item.
- The header table in the docs copies the 08-10 SUMMARY side-check table, with generic variable names (`TEAM` for `PI_CM_SET`/`PI_CM_UNSET`).

## Task Commits

1. **Task 1: Users learn where their per-server choices live and how long they last.** Commit `73200878` (docs). Pre-commit log: `PRECOMMIT_EXIT=0` on the first run. Hook: `npm run check:commit` Passed (the catalog is a build input).
2. **Task 2: OAuth beside headers, the migration remedies, and the Phase 4 variable wording.** Commit `de427118` (docs). Pre-commit: the first run failed (mdformat realigned two tables; markdownlint MD038 on the code spans `` `Bearer ` `` and a spaces-only span). I reworded those two cells, shortened the new translated-field row so the existing table keeps its column widths, and the rerun gave `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` skipped (no build input staged).
3. **Task 3: Rollback wording, per-tool agent entries, key uniqueness and the pi-subagents floor, in both READMEs.** Commit `c2e89982` (docs). Pre-commit log: `PRECOMMIT_EXIT=0` on the first run. Hook: `npm run check:commit` skipped (no build input staged).

## Verify results (final lines)

- Task 1: the grep chain passed, and `node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/mcp-config-notices.test.ts tests/architecture/mcp-migration-notice.test.ts` gave `ℹ pass 40 / ℹ fail 0` before the commit and again after it (tracer gate).
- Task 2: the five-statement grep chain exited 0. The Dropped fields awk check prints the reworded `auth` line ("For `auth`, only the plugin's own value is dropped.").
- Task 3: the verify chain exited 0 (`0.62.0` absent from both READMEs; `plugin_a_b_c_` in all three files; `mcp:plugin_<plugin>_<server>_` in both READMEs). `grep -n "before it writes anything" docs/mcp-compatibility.md` prints nothing. `git show --stat --format= HEAD -- README.md README.es.md` shows 8 insertions and 8 deletions in each file.
- I did not run `npm run check`. The orchestrator runs it at the wave boundary.

## Deviations from Plan

**1. [Rule 2 - Missing info] The README prerequisites did not name the pi-subagents floor**
- **Found during:** Task 3
- **Issue:** The plan drops the "needs pi-subagents 0.62.0 or newer" clause "since the prerequisites already require 0.74.0". They did not: the pi-subagents prerequisite line had no version, while `package.json` declares `>=0.74.0`. Dropping the clause alone would leave no stated floor.
- **Fix:** Dropped the clause and added "0.74.0 or newer" ("0.74.0 o posterior") to the pi-subagents prerequisite line in both READMEs. This is the triage's second option for P1 IN-03.
- **Commit:** c2e89982

**2. Divergence link target**
- The OAuth section points to the Divergences heading instead of `#variables-1`, because the page has two Variables headings and the numbered anchor is fragile.

**3. Requirements not marked complete**
- DEBT-02, DEBT-03 and DEBT-04 cover the whole phase. Plan 08-21 owns their verdicts.

## Notes for later plans

- 08-21: the doc halves of P1 IN-03, P3 WR-03a, WR-04, IN-05, P4 IN-07, IN-08, IN-09 and the docs for D-08-01..05 are closed by 73200878, de427118 and c2e89982.
- The optional WR-04 conversion warning in `bridges/agents/convert.ts` was not added. The docs now state the launch failure, which the triage says is enough.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

Mitigation T-08-31: every behavior claim comes from the shipped SUMMARYs (08-02, 08-03, 08-04, 08-08, 08-10) and the peer sources cited above. Each new divergence item names its reason. The three catalog lock tests passed after the catalog edit.

## Self-Check: PASSED

- All five modified files exist, and commits 73200878, de427118 and c2e89982 are ancestors of HEAD.
