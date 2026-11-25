# Phase 3: Marketplace Layers and Cross-Scope Install - Context

**Gathered:** 2026-11-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Cucumber scenarios replace the user-visible cases of five integration files (ITMIG-05, ITMIG-06): `marketplace-layer-autoupdate` (D-09 named and unnamed flips of a marketplace the scope records but no layer declares; CFG-03 for a named flip while the other layer's config is invalid), `marketplace-layer-redeclare` (a re-declaration with no second clone and no git request, in the local layer and after the scope records it undeclared), `marketplace-layer-remove` (a named remove of a recorded but undeclared url marketplace; LAYER-02 refusing a remove when the other layer cannot be read; a base-layer remove of a url marketplace; a refused remove that changes no state, config, clone, or skill; LAYER-03 keeping a url-source dependency, its clone, and its data while the scope converges), `marketplace-add-seed-mirrors` (only its user-visible case: installing a same-repository url plugin after the add makes no git request), and `project-install-adds-user-marketplace` (WR-07, MA-12, MA-13, D-MF-04, and a dependency's user git marketplace added to the project with a clone in each scope). Each replaced case is deleted after a deliberate break fails its scenario (REQUIREMENTS.md rules 1-4); a file left with no case is deleted.

Internal cases stay for Phase 8: the EACCES unstage cases of `marketplace-layer-remove` (partial remove, failure-only, PRUNE-03; fault injection the harness lacks, Out of Scope) and the mirror seeding, mirror remote, unseeded pin, mirror GC, and no-call checks of `marketplace-add-seed-mirrors`. Already covered (delete after a deliberate break): LAYER-02 and D-07 of `marketplace-layer-autoupdate`; the blockers, D-05-07, and held-lock cases of `marketplace-layer-remove`; LAYER-07's kept marketplace after a user-scope remove (`marketplace/remove.feature`).

Feature files this phase owns (ROADMAP): `marketplace/{add,autoupdate,remove,url-source}.feature` and `plugin/cross-scope-install.feature`. Phase 7 later changes the marketplace publishing harness too (it depends on this phase).

</domain>

<decisions>
## Implementation Decisions

### Decided autonomously
- [Placement] Q: "Where does each moved case go?" → Selected: "Autoupdate flips (D-09, CFG-03) in `marketplace/autoupdate.feature`; re-declarations in `marketplace/add.feature` (url sources may go in `marketplace/url-source.feature` if that is where url stand-ins are set up); remove cases in `marketplace/remove.feature`; the same-repo url plugin install with no git request in `marketplace/url-source.feature` or `plugin/cross-scope-install.feature`, whichever already holds url-plugin installs; all project-install cases in `plugin/cross-scope-install.feature`" — placement is reversible.
- [Unchanged checks] Q: "How does a scenario prove 'changes nothing'?" → Selected: "With the whole-scope steps Phase 2 added, `the files of the {word} scope are remembered` / `... are unchanged` (`features/step_definitions/scope-state.steps.ts`), for every scope the command can touch, plus 'the git host receives no request' where the integration case checked for no git call; the narrower config/record byte steps only where a scenario must allow other files to change" — reuses existing steps; Phase 2's review showed the narrow steps miss real regressions.
- [Harness] Q: "How are a leftover clone, a foreign tree, and a stale user clone set up?" → Selected: "New Given steps in the marketplace topic modules (`marketplace/publishing.steps.ts` or `marketplace/checkout.steps.ts`, whichever owns clones), named for what they set up: the extension's own leftover clone at the project clone path (MA-12), a foreign tree there (MA-13), and a user clone older than the marketplace so that the fresh project clone holds a different dependency list (D-MF-04). Library code they need goes in the marketplace library under `features/lib/` that the plan names" — shared harness additions are named in the plan, as the ROADMAP requires.
- [Breaks] Q: "How is each replaced case checked before deletion?" → Selected: "As in Phases 1 and 2: one deliberate break per behavior, reverted in an EXIT trap in the plan's own worktree and never committed; SUMMARY.md records the break, the command, and the failing scenario; already-covered cases get a break too" — test approach only.
- [Deletion] Q: "Which files go?" → Selected: "`marketplace-layer-autoupdate`, `marketplace-layer-redeclare`, and `project-install-adds-user-marketplace` when all their cases are covered; `marketplace-layer-remove` keeps its three EACCES cases; `marketplace-add-seed-mirrors` keeps its internal mirror cases; helpers no remaining test imports go with their last user; each deleted file goes in `files_deleted`" — git history keeps them.
- [Parallelism] Q: "How are plans split?" → Selected: "By feature-file ownership; the plan that adds the clone-setup steps owns the marketplace topic module and library changes in its wave; another plan that needs them depends on it" — wave layout is local to the plan.
- [Bugs] Q: "What if a scenario exposes a product bug?" → Selected: "Rule 4: fix it in the phase when small, with a unit test beside its source pair; otherwise a BACKLOG.md entry and the guarding integration case stays with a header naming the BACKLOG ID" — milestone rule.

- [Seeding bug] Q: "What happens to the mirror-seeding defect research found (D-SEED-01 never seeds a `git-subdir` plugin whose url ends in `.git`, `orchestrators/plugin/clone-cache.ts:800`)?" → Selected: "Rule 4: it is a small fix, so the plan that owns `marketplace/url-source.feature` fixes it (compare the urls without the `.git` suffix and key the seed by the plugin's own url), with a unit test beside `clone-cache.ts` and the scenario that shows the plugin as `available`, not `remote`, right after the add; the SUMMARY lists a CHANGELOG parent line for the milestone PR" — a small, local product fix the milestone rules authorize.
- [Seed-mirror test] Q: "Does `marketplace-add-seed-mirrors.test.ts:155` go?" → Selected: "No: mirror seeding is internal (domain section); the file keeps its seeding cases for Phase 8" — keeps the internal guard.
- [Same-repo install] Q: "How is 'installing a url plugin from the same repository after the add makes no git request' shown, given that an unpinned install always refreshes a warm mirror (MIRR-02)?" → Selected: "With a pinned plugin, where the claim holds as written; the unpinned case is shown by `list` reporting `available` right after the add" — matches the product's documented behavior.
- [Base-layer remove] Q: "ITMIG-05 says a base-layer remove of a url marketplace removes its clone and data directory, but the integration case keeps both while the local layer still declares it; which?" → Selected: "Both scenarios: one where the local layer still declares the marketplace (clone and data kept) and one where no layer does (both removed)" — covers both readings.

### Claude's Discretion
- Scenario titles, step wording, and tables, within the cucumber skill's rules; break edits; plan count and waves.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/step_definitions/config.steps.ts`: `a config in scope {word} and layer {word}, with this text:` (an invalid or a recorded-but-undeclared layer), the `the {string} file of the {word} scope ...` checks.
- `features/step_definitions/scope-state.steps.ts`: `the files of the {word} scope are remembered` / `are unchanged` (whole-scope comparison, added in Phase 2).
- `features/step_definitions/git-host.steps.ts`: `the git host receives no request`.
- `features/step_definitions/marketplace/publishing.steps.ts` and `marketplace/checkout.steps.ts`: the shared marketplace topic modules.
- The integration files listed in the domain section.

### Established Patterns
- Untagged scenarios (no MCP surface) run under `adapter` only; `builtin` selects 0 (DUAL-02).
- Red proofs as in `.planning/phases/02-plugin-layers-names-and-list-fold/02-0*-SUMMARY.md`.

### Integration Points
- Phase 7 depends on this phase's changes to the marketplace publishing harness.

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
- From Phase 2's review: prefer the whole-scope file steps for every "changes nothing" claim; a narrow byte step let a plausible regression pass twice.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
