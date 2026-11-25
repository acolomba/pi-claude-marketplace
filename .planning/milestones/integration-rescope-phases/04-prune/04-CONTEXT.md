# Phase 4: Prune - Context

**Gathered:** 2026-11-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Cucumber scenarios replace the user-visible cases of `test/integration/standalone-prune.test.ts` that the suite left out (ITMIG-08): the remaining empty-scope variants of `prune` and `prune --dry-run`, with and without `--scope`; a malformed state file reported by both forms without showing its path; held neighbours kept across alternating marketplaces; an actual prune that selects again after a stale preview changed on disk; a failed member that keeps its dependency until a later retry removes both; a preview with no project state that leaves both scopes as they were; an unreadable declarer manifest that refuses without changing either scope; `-y`, `--keep-data`, and `--prune` refused with the prune usage line before any orphan is selected, both scopes unchanged; a project-only prune; and a dependent-first chain whose preview matches the actual prune. Each replaced case is deleted after a deliberate break fails its scenario (rules 1-4).

Already covered (delete after a deliberate break): the held lock, the orphan removal, the dry-run preview, the usage errors that `plugin/prune.feature` already shows. Internal cases stay for Phase 8: prune never calls `applyReconcile` or `installMissingDependencies` and makes no git call; the repeated legacy previews (state only older releases wrote) unless a scenario can show them through `features/lib/earlier-version-state.ts` at no extra harness cost.

Feature file this phase owns: `features/plugin/prune.feature`. Verb step module: `features/step_definitions/plugin/prune.steps.ts` (new; the name behavioral-gaps reserved for prune and never created).

</domain>

<decisions>
## Implementation Decisions

### Decided autonomously
- [Failed member] Q: "How does a scenario make a prune member fail, when the integration case tampers a record to a skill path of `../invalid`?" → Selected: "Use a failure a user could meet if one exists (for example a staged artifact the prune cannot remove because its directory is not writable, which the non-DAC wrapper makes real for the root container); if no user-reachable failure exists, keep the case as fault injection for Phase 8 (Out of Scope) and say why in the SUMMARY" — matches the ROADMAP note; the choice is local to the test.
- [Unchanged checks] Q: "How do 'changes nothing' and 'both scopes unchanged' get proved?" → Selected: "With the whole-scope steps `the files of the {word} scope are remembered` / `... are unchanged` for every scope the command can touch (Phases 2 and 3 found narrower checks let regressions pass)" — reuses existing steps.
- [Steps] Q: "Where do new prune steps go?" → Selected: "In the new verb module `features/step_definitions/plugin/prune.steps.ts`, with text that names prune (D-08); a step a second verb needs goes to a topic module in its own commit" — layout rule.
- [Malformed state] Q: "How is 'without showing its path' checked?" → Selected: "The scenario checks the complete notification rows and asserts the absolute state path and the sandbox home do not appear in them" — test approach.
- [Breaks] Q: "How is each replaced case checked before deletion?" → Selected: "As in Phases 1-3: one reverted deliberate break per behavior, recorded in SUMMARY.md; already-covered cases get a break too" — test approach only.
- [Deletion] Q: "What happens to standalone-prune?" → Selected: "It keeps only its internal cases (and the failed-member case if no user-reachable failure exists); the file header says what it keeps and why" — git history keeps the rest.
- [Bugs] Q: "What if a scenario exposes a product bug?" → Selected: "Rule 4: fix it when small, with a unit test beside its source pair and a CHANGELOG parent line; otherwise a BACKLOG.md entry and the guarding integration case stays" — milestone rule.

- [Failed member, after research] Q: "Is a prune member failure user-reachable?" → Selected: "Yes: a plugin that ships a read-only skill directory makes the prune fail that member with `{permission denied}` and keep its dependency, and a second prune after the user makes it writable removes both; the case moves to a scenario (research F01, F02) and its integration case goes" — measured under the non-DAC wrapper.
- [Backup leak] Q: "What happens to the leak research found (that failed prune leaves `prune-backup-XXXXXX/` behind because the backup copy keeps the read-only mode, `orchestrators/plugin/prune-rollback.ts:117`, `:497-504`)?" → Selected: "Rule 4: a small fix (owner write on each backup directory before removal, with an ENOENT guard), in its own plan after the scenario plan, with a unit test beside `prune-rollback.ts`, the scenario that shows no backup is left, and a CHANGELOG parent line for the milestone PR" — small, local product fix the milestone rules authorize.
- [Legacy previews] Q: "Does the repeated legacy-preview case (`:621`) move?" → Selected: "Yes: a scenario with a real earlier-release record through `features/lib/earlier-version-state.ts` (research L01) costs no extra harness and fails the same break; the integration case goes" — supersedes the earlier 'Phase 8 unless cheap' default, since it is cheap.
- [Kept carriers] Q: "How are the internal checks (no `applyReconcile`, no `installMissingDependencies`, no git call) kept for Phase 8?" → Selected: "`standalone-prune` keeps one actual-prune case (`:284`) and one preview case (`:317`), which carry those checks; every other case goes, with helpers no remaining case uses" — research.
- [Same-bytes save] Q: "A break that re-saves an unchanged record with the same bytes survives every scenario (K2); does a scenario need to catch it?" → Selected: "No: it is not visible to a user (bytes are unchanged); record it in the SUMMARY as an accepted survivor" — the user-visible contract is the bytes.

### Claude's Discretion
- Scenario titles, step wording, tables; break edits; plan count and waves (one feature file and one new step module suggest one or two plans).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/plugin/prune.feature` (12 scenarios today) and the plugin step modules it uses.
- `features/step_definitions/scope-state.steps.ts`: whole-scope remembered/unchanged steps; `config.steps.ts`: record-byte steps (`the installation record bytes of the {word} scope are remembered` / `are unchanged`, added in Phase 3).
- `features/lib/earlier-version-state.ts`: states an earlier release wrote.
- `test/integration/standalone-prune.test.ts` (cases at lines 223-852).

### Established Patterns
- Untagged scenarios run under `adapter` only; `builtin` selects 0 (DUAL-02).
- Red proofs as in `.planning/phases/03-marketplace-layers-and-cross-scope-install/03-0*-SUMMARY.md`.

### Integration Points
- Phase 8 takes the internal cases left in `standalone-prune`.

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
- From the Phase 2 and Phase 3 reviews: every "changes nothing" claim gets the whole-scope file steps; a narrow check let a plausible regression pass in both phases.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
