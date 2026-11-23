# Phase 5: MCP Install, Legacy Move, and Overrides - Context

**Gathered:** 2026-11-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Cucumber scenarios replace the user-visible cases of seven integration files (ITMIG-09, ITMIG-10, ITMIG-11):

- `mcp-home-path-partial` and `mcp-tool-rules` (both deleted): a literal `~/` in stdio args refused with `{unsupported mcp}` and the `--partial` hint, `--partial` installing the plugin without that server, and the warning that tool permission rules are not enforced.
- `mcp-variable-expansion`: AVAR-04 notices after the result rows on `update`, `reinstall`, and `enable`; AVAR-05 (a deny-listed credential withheld with a notice); `${CLAUDE_PROJECT_DIR}` reaching the server expanded; `!` written as `!!`; a secret value never in `mcp-adapter.json`; D-PG10-11 entries holding a reference and no option value in all five fields.
- `mcp-legacy-sweep`, `mcp-migration`, `mcp-verdict-migration`: the install-time sweep (AMIG-02) of marked entries, old-name stubs, and direct-tools copies with the user's own servers kept; one notice for both scopes with project rows first; the AMIG-04 unowned-entry warnings; undeclared, unsupported, and malformed entries; a load with a cold clone cache; the stub notice; the user-scope stub removed from the project file; a user-scope install that leaves the project `mcp-adapter.json` alone; a plugin that lists as partly installed after the move; the `list` row of a legacy record with no MCP trace.
- `mcp-override-lifecycle`: a project install that keeps a user stub and writes it back on uninstall; a user plugin disabled in the project through install, update, reinstall, and uninstall; an `/mcp-adapter enable` that survives; an update that drops a server keeping its choice and a later version restoring it; `openUi` and `trace` kept on reinstall; carried fields written back with the values the entry holds at uninstall; the ANAME-07 stub timeout; a foreign `serverChoices` key left alone; an emptied stub removed.

Each replaced case is deleted after a deliberate break fails its scenario (rules 1-4). A file left with no case is deleted.

Internal, staying for Phase 8: the `keptOverride` and `serverChoices` field checks; the recovery after a refused write between the two writes of the move (fault injection, Out of Scope); the released-build record cases of `mcp-verdict-migration` other than the partly-installed list row.

Tags: the override cases and the legacy move are pi-mcp-adapter behavior, so their scenarios carry `@adapter-only` with the licensing ID (AFILE-06, D-08-01, D-08-02, AMIG-01, AMIG-02, AMIG-04). The install refusals and variable cases carry `@mcp` (run under both profiles) or a licensed `@adapter-only`/`@builtin-only` pair where the two implementations differ.

Feature files this phase may edit: `features/mcp-server/*.feature` (likely `options.feature`, `configuration.feature`, `legacy-move.feature`, `lifecycle.feature`, `project-scope.feature`, `verdict-list.feature`, `verdict-install.feature`; research names the owners), and a NEW file under `features/mcp-server/` only if no existing file owns a behavior. Shared step modules and `features/lib/**` may change when a plan names them.

</domain>

<decisions>
## Implementation Decisions

### Decided autonomously
- [Placement] Q: "Which feature file gets each case?" → Selected: "The existing `mcp-server/` file that already owns the behavior (research maps each case to its owner by file:line); a new file only when none does" — placement is reversible.
- [Tags] Q: "How are the scenarios tagged?" → Selected: "Install refusals and variable cases: `@mcp` when both implementations behave the same, else a licensed `@adapter-only`/`@builtin-only` pair with the licensing decision ID in a comment; legacy move and override cases: `@adapter-only` with the ID (AFILE-06, D-08-01, D-08-02, AMIG-01, AMIG-02, AMIG-04)" — follows the ROADMAP note and DUAL-02.
- [Earlier records] Q: "How do scenarios get records an earlier release wrote?" → Selected: "Through `features/lib/mcp-builtin-earlier-record.ts` and `features/lib/earlier-version-state.ts` (real released-build records); no hand-made record that no release wrote" — matches Phase 4's L01 approach.
- [Group B fields] Q: "The audit says no step reads `compatibilityBasis`, `mcpServerConfigs`, `resources.mcpServers`, `keptOverride`, or `serverChoices`; do scenarios read them?" → Selected: "No: a scenario checks what a user sees (notices, list rows, the `mcp-adapter.json` and `mcp.json` contents a user edits, server behavior); a check only a record field shows stays internal for Phase 8" — the user-visible contract.
- [Unchanged checks] Q: "How are 'leaves the file alone' and 'keeps the user's servers' proved?" → Selected: "With the whole file content (exact JSON or the whole-scope remembered/unchanged steps), never a sample of keys; Phases 2-4 reviews found narrow checks let regressions pass" — reuses existing steps.
- [Breaks] Q: "How is each replaced case checked before deletion?" → Selected: "As in Phases 1-4: one reverted deliberate break per behavior, run under every profile the scenario selects, recorded in SUMMARY.md; already-covered cases get a break too" — test approach only.
- [Deletion] Q: "What happens to the seven files?" → Selected: "`mcp-home-path-partial` and `mcp-tool-rules` are deleted; the others keep only their internal cases with a header saying what they keep and why, or are deleted if none remains; helpers no remaining case uses go" — git history keeps the rest.
- [Bugs] Q: "What if a scenario exposes a product bug?" → Selected: "Rule 4: fix it when small, with a unit test beside its source pair and a CHANGELOG parent line; otherwise a BACKLOG.md entry and the guarding integration case stays" — milestone rule.
- [Parallelism] Q: "How are plans split?" → Selected: "By feature-file ownership so plans in a wave touch disjoint files; a shared step module or `features/lib/**` file changes in only one plan per wave; plans in one wave share the 4 CPUs (`--parallel 1` or a shared flock for heavy runs)" — wave layout is local to the plan.

- [Tags, after research] Q: "The legacy-move and override drafts give byte-identical results under both profiles (research measured); keep `@adapter-only`?" → Selected: "No: tag them `@mcp` so they run under both profiles. The extension writes `mcp-adapter.json` the same way under either implementation, the cucumber skill reserves `@adapter-only` for expectations that hold only under pi-mcp-adapter, and success criteria 3 and 4 require both profiles. The one case that differs (the list row of a moved plugin whose only server needs an elicitation handler, MREC-03, D-P3-16) is a licensed `@adapter-only`/`@builtin-only` pair" — supersedes the [Tags] bullet for these scenarios; a tag is cheap to change.
- [Override file] Q: "Which integration cases are the internal `keptOverride`/`serverChoices` field checks?" → Selected: "None stands alone: no case in the seven files checks those fields except through the file text a user sees, so `mcp-override-lifecycle` is deleted whole once its cases move" — research.
- [Kept cases] Q: "Which cases stay?" → Selected: "`mcp-migration:749` (refused write between the two writes, fault injection) and `mcp-verdict-migration:117`, `:149`, `:250` (released-build record internals); the other five files are deleted (home-path-partial, tool-rules, variable-expansion, legacy-sweep, override-lifecycle)" — research.
- [Optional cases] Q: "The user re-install scenario and the 'no `mcp.json` is created' check?" → Selected: "Include the re-install scenario; show the no-`mcp.json` claim with the whole-scope remembered/unchanged steps or an existing absence step if one fits, else leave it out and say so in the SUMMARY" — cheap user-visible coverage.
- [MCPMIG-01] Q: "One draft pins the known backlog item MCPMIG-01 (`cause: \"not-declared\"` for a skipped server)?" → Selected: "Keep the scenario with a comment naming MCPMIG-01, so fixing that item updates the scenario on purpose" — existing backlog item, no new bug.

### Claude's Discretion
- Scenario titles, step wording, tables; break edits; plan count and waves.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/mcp-server/` (27 feature files; `legacy-move.feature` covers the AMIG-01 move in both scopes and the silent second load; `lifecycle.feature` the user-scope disabled choice).
- `features/lib/mcp-builtin-earlier-record.ts`, `features/lib/earlier-version-state.ts`.
- `features/step_definitions/scope-state.steps.ts` (whole-scope remembered/unchanged), `config.steps.ts` (record bytes), the MCP step modules under `features/step_definitions/`.
- The integration files being replaced: `test/integration/mcp-{home-path-partial,tool-rules,variable-expansion,legacy-sweep,migration,verdict-migration,override-lifecycle}.test.ts`.

### Established Patterns
- `@mcp` scenarios run under both profiles; `@adapter-only` / `@builtin-only` carry a licensing ID (DUAL-02, D-BG-04).
- Red proofs as in `.planning/phases/04-prune/04-01-SUMMARY.md`.

### Integration Points
- Phase 8 takes the internal cases left in these files.

</code_context>

<specifics>
## Specific Ideas

Lessons from Phase 1 (2026-11-21), for planners and executors:
- The cucumber summary formatter prints a failed scenario as `  N) <title> # <file>:<line>`, not `Scenario: <file>:<line>`. A verify command that proves a break failed a scenario must match that form.
- `fallow audit` gives `weakened-tests` (`warn`) for every deleted test file. User decision 2026-11-21: no `.fallowrc.json` change; do not edit it or the CI workflows. Record the finding in the SUMMARY and move on; it is not a gap.
- A break must be applied and reverted in the plan's own worktree (helper roots itself at `git rev-parse --show-toplevel`), never the main checkout.

Environment facts for every agent of this run (root container; measured 2026-11-21):
- Run every npm script, and every commit whose hook runs npm scripts, with `npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144` (drops the root DAC override so permission tests behave as for a normal user).
- Node here is v24.22.3 after the container restart.
- `fd` must be on `PATH` for Pi's find tool (the Glob scenarios of `hook/tool-use.feature`); `fdfind` is installed (`apt-get install -y fd-find` in a fresh container).
- Run `npm run test:coverage:direct:all` (and single-pair direct coverage of `bridges/hooks/dispatch-exec.ts`) with a minimal environment, `env -i HOME=$HOME PATH=$PATH LANG=C.UTF-8 TMPDIR=/tmp npm_config_script_shell=... NODE_OPTIONS=...`: this container's ~10.6 KB environment makes one hook unit test pass the 10,000-character context cap (environmental; recorded in STATE.md).
- Warm ESLint with a lone `npm run lint` first. Inside `.claude/worktrees/...` the commit hook may check nothing; run `npm run check:static` and the touched scenarios by hand before committing.
- If zizmor fails with 401, run the commit with `env -u GH_TOKEN -u GITHUB_TOKEN`. Give each executor its own scratchpad subfolder. Declare deletions in `files_deleted`. Every cucumber run passes `--parallel 2` when two executors share the 4 CPUs.
- From the Phase 2-4 reviews: every "changes nothing" or "keeps" claim checks whole files; a narrow check let a plausible regression pass in each phase.
- From Phase 4: never set `SKIP=` for a pre-commit hook; the auto-mode classifier refuses `SKIP=npm-check pre-commit run --files`, so commit normally and let the full hook run (inside a worktree it may check nothing; run `npm run check:static` by hand).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
