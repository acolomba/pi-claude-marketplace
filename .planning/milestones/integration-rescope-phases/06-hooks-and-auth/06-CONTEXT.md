# Phase 6: Hooks and Auth - Context

**Gathered:** 2026-11-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Cucumber scenarios replace the user-visible cases of four integration files (ITMIG-12, ITMIG-13):

- `hooks-cross-scope-reconcile` (deleted): with hook plugins installed in both scopes, their hooks still run after `/claude:plugin apply` and after a load.
- `hooks-additionalcontext-end-to-end`: HOOK-E2E-04, a `/reload` before the first prompt drops the SessionStart context buffered before it (HOOK-E2E-03 is already covered by `hook/additional-context.feature`; it gets a break and goes).
- `hooks-dispatch-end-to-end`: WR-05, a hook dispatch in a project that had no `.pi` directory leaves none behind. Five of its seven cases are already covered (user and project SessionStart, D-PG10-23, D-PG10-25, child tool payloads); they get a break and go. The throwing project hydrate that must not block dispatch is internal and stays for Phase 8.
- `auth-e2e`: in print mode, a `marketplace add` that needs a sign-in refuses with its remedy and leaves no staged clone behind (the four print-mode tests); AUTH-07, a git host that rejects the stored credential leads to the credential evicted and the next clone signing in through Device Flow again. AUTH-01 and AUTH-02/08 are covered by `marketplace/device-flow.feature` (break, then delete). The staging cleanup failure that keeps the print refusal as the primary cause is fault injection and stays for Phase 8.

No feature runs Pi in print mode and no print driver exists (D-BG-601), so this phase adds one as a NEW `features/lib/` module (next to `features/lib/pi-json-mode.ts`, the json-mode driver). The eviction and new sign-in use the stand-ins of `marketplace/device-flow.feature`, with GitHub's requests routed to them (D-BG-1101). `marketplace/git-source.feature` stops at the rejected credential today.

Each replaced case is deleted after a deliberate break fails its scenario (rules 1-4).

Feature files this phase may edit: `features/hook/*.feature` (e.g. `additional-context.feature`, `session.feature`), `features/plugin/session-start-hooks.feature`, `features/marketplace/{device-flow,git-source}.feature`, and a NEW feature file only if no existing one owns a behavior. Shared step modules and `features/lib/**` may change when a plan names them.

</domain>

<decisions>
## Implementation Decisions

### Decided autonomously
- [Print driver] Q: "How do scenarios run Pi in print mode?" → Selected: "A new `features/lib/` module that starts Pi with `-p` (print mode) in the scenario sandbox and returns its exit status and output, modelled on `features/lib/pi-json-mode.ts` (process-group kill handed to `onRelease`), plus a step in the module that owns its topic (named in the plan)" — follows the ROADMAP note; harness code is cheap to change.
- [Tags] Q: "How are the scenarios tagged?" → Selected: "Untagged when the scenario has no MCP surface (runs under adapter; builtin selects 0, DUAL-02); `@mcp` only if a scenario touches MCP. Research checks each" — DUAL-02.
- [Device Flow] Q: "How are the eviction and the new sign-in shown?" → Selected: "With the stand-ins of `marketplace/device-flow.feature` and routed GitHub requests (D-BG-1101); the scenario shows the rejected credential, that the stored credential is gone, and the new sign-in prompt and clone" — reuses the harness.
- [Unchanged checks] Q: "How are 'leaves no staged clone' and 'leaves no .pi directory' proved?" → Selected: "Whole-directory checks (the whole-scope remembered/unchanged steps, or an absence step for the directory), never one file; Phases 2-5 reviews found narrow checks let regressions pass" — test approach.
- [Breaks] Q: "How is each replaced case checked before deletion?" → Selected: "One reverted deliberate break per behavior, run under every profile the scenario selects, failing on a When/Then assertion (not a Given), recorded in SUMMARY.md; already-covered cases get a break too" — the Phase 5 checker rule.
- [Deletion] Q: "What happens to the four files?" → Selected: "`hooks-cross-scope-reconcile` is deleted; `hooks-additionalcontext-end-to-end` goes if both cases are covered; `hooks-dispatch-end-to-end` and `auth-e2e` keep only their internal cases with a header saying why" — git history keeps the rest.
- [Async flake] Q: "The Phase 5 gate saw `features/hook/async.feature:261` fail in its After hook (`scenario releases failed`) in 2 of 4 full adapter runs; does this phase look at it?" → Selected: "Yes, as research: capture the inner release error under full-suite load and say whether it is a harness race (fix it in the plan that owns the hook harness module, with the scenario passing in repeated full runs) or a product bug (rule 4: small fix with a unit test, or a BACKLOG entry)" — it sits in this phase's hook harness and affects every gate.
- [Bugs] Q: "What if a scenario exposes a product bug?" → Selected: "Rule 4: fix it when small, with a unit test beside its source pair and a CHANGELOG parent line; otherwise a BACKLOG.md entry and the guarding integration case stays" — milestone rule.
- [Parallelism] Q: "How are plans split?" → Selected: "By feature-file ownership (hooks vs auth) so plans in a wave touch disjoint files; a shared step module or `features/lib/**` file changes in only one plan per wave" — wave layout is local to the plan.

- [HOOK-E2E-04 parity] Q: "The reload-before-first-prompt scenario pins that a `/reload` drops buffered SessionStart context (documented in `docs/hooks-compatibility.md:449`, asserted by the integration case), but D-CF5-03/D-CF5-13 suggest upstream may keep it and no decision ID licenses the drop; pin it?" → Selected: "Pin the current, documented behavior with a neutral title that cites the doc: this milestone moves tests and changes no behavior. The possible parity gap is reported to the user at the end of the milestone as a question (and a BACKLOG entry if they want it researched), not decided here" — a scenario is cheap to change; changing the behavior would be a product decision for the user.
- [Print apply] Q: "Include the print-mode `apply` scenario that shows print mode prints nothing?" → Selected: "Yes, titled as a Pi gap and citing the accepted limitation in PROJECT.md" — documents a known limitation.
- [JSONL race] Q: "Fix the second harness race research found (`features/lib/turn-records.ts:37` parsing a half-written JSONL line)?" → Selected: "Yes, in the hooks plan beside the ESRCH fix in `features/lib/hook-files.ts`, each as its own first commits, with the suite passing in at least two more full adapter runs" — same reason as [Async flake].
- [Assumption delta] Q: "The detector fired on 'additional' (pluralization)?" → Selected: "False positive: it matched the file name `additional-context.feature`; decision `no-change`" — no identity-model change.

### Claude's Discretion
- Scenario titles, step wording, tables; break edits; plan count and waves.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/lib/pi-json-mode.ts` (json-mode driver, the analog for a print driver); `features/support/world.ts` (releases, Pi start).
- `features/marketplace/device-flow.feature` and its stand-ins; `features/marketplace/git-source.feature`.
- `features/hook/additional-context.feature`, `features/plugin/session-start-hooks.feature`, `features/hook/session.feature`.
- `features/step_definitions/scope-state.steps.ts` (whole-scope remembered/unchanged).
- The integration files being replaced: `test/integration/{hooks-cross-scope-reconcile,hooks-additionalcontext-end-to-end,hooks-dispatch-end-to-end,auth-e2e}.test.ts`.

### Established Patterns
- Red proofs and the red-proof checker of Phase 5 (`/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/plan-05/inputs/check-red.mjs`: rejects a failure only in a Given, a hook, a timeout, or 0 scenarios).

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
- From the Phase 2-5 reviews: every "leaves nothing" or "keeps" claim checks whole files or directories.
- From Phase 4: never set `SKIP=` for a pre-commit hook; the classifier refuses `SKIP=npm-check pre-commit run --files`, so commit normally (inside a worktree the hook may check nothing; run `npm run check:static` by hand).
- From Phase 5: the container can restart; commit planning files as soon as they are written.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
