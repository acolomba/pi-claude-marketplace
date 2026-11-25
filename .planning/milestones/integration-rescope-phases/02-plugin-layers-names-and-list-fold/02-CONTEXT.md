# Phase 2: Plugin Layers, Names, and List Fold - Context

**Gathered:** 2026-11-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Cucumber scenarios replace the user-visible cases of four integration files: `plugin-layer-verbs` (the 12 LAYER-04 refusals, ITMIG-01), `plugin-layer-consistency` (ITMIG-02), `reserved-record-keys` (plugin and marketplace names that are `Object.prototype` members, ITMIG-03), and `fold-adoption` (the unfiltered `list` fold, ITMIG-04). Each replaced case is deleted after a deliberate break fails its scenario (REQUIREMENTS.md rules 1-4). A file left with no case is deleted. The two LAYER-06 cases of `plugin-layer-verbs` tamper `state.json` to a future source kind; they are internal and stay for Phase 8. The two LAYER-08 cases are already covered (`plugin/reinstall.feature`, `plugin/update.feature`); the phase deletes them after a deliberate break fails those scenarios.

Feature files this phase owns (ROADMAP): `plugin/{install,uninstall,enable,disable,update,reinstall,configuration,config-migration,pending,list,info,import}.feature` and one NEW file under `plugin/` for the `constructor` and `__proto__` names. It edits no `marketplace/` feature file. Shared step modules and `features/lib/**` may change when a plan names them.

</domain>

<decisions>
## Implementation Decisions

### Decided autonomously
- [LAYER-04 shape] Q: "How are the 12 LAYER-04 cases written?" → Selected: "Each verb's refusal lands in that verb's own feature file (install, uninstall, enable, disable, update, reinstall), as two plain scenarios, one per direction (revised after research: the update and reinstall Backgrounds already install the target in the base layer, so a uniform two-row Outline cannot set up both directions, and features.md asks for three or more variants per Outline), for the two directions (target in the base layer with the local config unreadable; target in the local layer with the base config unreadable). Each scenario checks the exact failure row the command prints (the CFG-03 row: `⊘ <plugin> (failed) {invalid manifest}` with the `Config file ... failed schema validation` cause), that the config files, the installation record, and the plugin's staged artifacts are unchanged" — scenario layout is cheap to change; one Outline per verb keeps each verb's file the owner of its behavior.
- [LAYER-04 harness] Q: "Which steps do the refusals use?" → Selected: "Existing steps first: `a config in scope {word} and layer {word}, with this text:` writes the unreadable config; `the config and installation record bytes of the {word} scope are remembered` / `... are unchanged` check bytes. If no step checks that staged artifacts are unchanged, add one to the shared topic module that owns scope state (named in the plan), not to a verb module" — reuses the audit's cheapest moves.
- [ITMIG-02 cases] Q: "Which plugin-layer-consistency cases become scenarios?" → Selected: "All seven listed in ITMIG-02 and the audit: the user-scope local gap, the base-layer gap that stops the reload and changes no file, a legacy local layer from an earlier `--local` install kept byte for byte with its plugin still recorded, `pending` before the first-run migration reporting the layer error, the malformed key `demo@` reported as a source mismatch with no layer error, and the dangling reference row beside a declared plugin that still installs. Each lands in `plugin/configuration.feature`, `plugin/config-migration.feature`, or `plugin/pending.feature`, by the verb it exercises" — placement is reversible.
- [Reserved names file] Q: "Where do the constructor and __proto__ scenarios go?" → Selected: "One new feature file `features/plugin/reserved-names.feature` (`Feature: Plugin reserved names`), the counterpart of `marketplace/reserved-name.feature`. It covers the whole ITMIG-03 list: `constructor` installs, lists, shows in `info`, disables, enables, updates, uninstalls, imports (and its config entry is written back on disable and uninstall), goes when its marketplace is removed, and a reload that declares `constructor@mp` installs it as an own record; a marketplace that declares `__proto__` lists it as unavailable and refuses its install with no file change; a reload that declares `hello@constructor` records nothing (D-PL5-28); and each named verb on an uninstalled `constructor` prints what it prints for an absent name. Scenarios cite D-08-07 and D-PL5-28" — a new file is easy to split later.
- [Reserved names steps] Q: "Where do any new steps for this file go?" → Selected: "In existing shared or verb modules whose text already fits; a step that fits none goes in a new verb-free topic module under `features/step_definitions/plugin/` named for what it is about, per the layout rules (no catch-all names)" — module placement is reversible.
- [List fold] Q: "How is the unfiltered list fold shown?" → Selected: "Two scenarios in `plugin/list.feature`: a project install from a marketplace that only the user scope records lists as a `[project]` row under that user marketplace's header (CMC-21, D-13-17); and an independently added project marketplace with the SAME name but a different source (the D-13-17 exception) lists under its own header with its own row and no duplicate (research F03; the only form that fails when the fold ignores the source). The integration file's two-different-names case (F02) is optional: add it only if it catches a break F01 and F03 miss. Each checks the complete list output, not a sample of rows" — scenario wording is cheap to change.
- [Breaks] Q: "How is each replaced case checked before deletion?" → Selected: "As in Phase 1: one deliberate break per behavior, reverted in an EXIT trap and never committed; the plan's SUMMARY.md records the break, the command, and the failing scenario. This includes the two already-covered LAYER-08 cases. A break that fails no scenario means the scenario is missing or too weak, and the plan fixes the scenario before deleting the case" — test approach only.
- [Deletion] Q: "Which files go?" → Selected: "`fold-adoption` and `reserved-record-keys` are deleted when their cases are covered; `plugin-layer-consistency` goes if all seven cases move; `plugin-layer-verbs` keeps only its two LAYER-06 cases (Phase 8 owns them); any helper no remaining test imports goes with its last user. Each deleted file is listed in `files_deleted`" — deletion is backed by git history.
- [Bugs] Q: "What if a scenario exposes a product bug?" → Selected: "Rule 4: fix it in the phase when small (with a unit test beside its source pair); otherwise add a BACKLOG.md entry and keep the integration case that guards it, its header naming the BACKLOG ID" — follows the milestone rule.
- [Parallelism] Q: "How are plans split?" → Selected: "By feature-file ownership so plans in a wave touch disjoint files; a shared step module or `features/lib/**` file changes in only one plan per wave" — wave layout is local to the plan.

### Claude's Discretion
- Scenario titles, step wording, and table columns, within the cucumber skill's rules.
- The exact code edit of each deliberate break.
- Plan count and wave split.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/step_definitions/config.steps.ts`: `a config in scope {word} and layer {word}, with this text:` / `with these plugins:` / `with these marketplaces:`, `the config and installation record bytes of the {word} scope are remembered` and `are unchanged`, the `the {string} file of the {word} scope ...` checks.
- `features/step_definitions/plugin/` verb modules (`installation`, `uninstall`, `update`, `import`, ...) and `command.steps.ts` (run any `/claude:plugin` command, read its result).
- `marketplace/reserved-name.feature` (the marketplace-side counterpart of the new file).
- The integration files being replaced: `test/integration/plugin-layer-verbs.test.ts` (`NAMED_VERBS` x `DIRECTIONS`, `invalidLayerRow`), `plugin-layer-consistency.test.ts` (seven cases, `layerError`, `BASE_GAP_CAUSE`, `USER_LOCAL_GAP_CAUSE`), `reserved-record-keys.test.ts` (seven tests including a verb loop), `fold-adoption.test.ts` (two tests).

### Established Patterns
- A scenario with no MCP surface carries no implementation tag and runs once, under `adapter`; under `builtin` it is "0 selected" (DUAL-02). An MCP-surface scenario carries `@mcp` or a licensed `@adapter-only`/`@builtin-only` pair.
- Red proofs are recorded in SUMMARY.md like `.planning/milestones/behavioral-gaps-phases/04-posttoolusefailure-hooks/04-02-SUMMARY.md` "Red proofs".

### Integration Points
- `features/plugin/list.feature` already covers filtered lists only (audit).
- `test/integration/` files left after this phase are Phase 8's input.

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

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
