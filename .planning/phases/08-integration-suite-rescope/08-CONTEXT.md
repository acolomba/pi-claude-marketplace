# Phase 8: Integration Suite Rescope - Context

**Gathered:** 2026-11-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Every case left in `test/integration/` must guard something cucumber and the unit tests cannot reach (ITSCOPE-01): peer conformance against a peer's own code, a multi-process race, or an internal case (stored record fields, state only older releases wrote, fault injection, or calls that must not happen), apart from a case kept under rule 4. Every other case moves to a unit test beside its source pair, or goes because a scenario or unit test covers it. No helper module in `test/integration/` is left without an importer. Each remaining file's opening comment names its class and the behavior cucumber does not cover (ITSCOPE-02). The charter is written in the `typescript-unit-tests` skill, the `cucumber` skill, and `.planning/codebase/TESTING.md` (ITSCOPE-03). `npm run check` passes on the combined tree at the end (ITSCOPE-04).

Inputs:
- The 21 files no migration phase touched (ROADMAP Phase 8 notes): `adapter-expansion-conformance`, `adapter-tool-name-conformance`, `agents-adapter-grant-conformance`, `agents-builtin-grant-conformance`, `mcp-adapter-entry-conformance`, `mcp-builtin-encoding-conformance`, `mcp-status-conformance`, `provenance-invisibility`, `skill-path-resolution`, `workflow-engine-agent-registry`, `pi-subagents-child-launch-conformance`, `hooks-result-boundary`, `concurrent-install`, `load-reconcile-race`, `subagent-hook-ownership`, `mcp-server-records`, `mcp-verdict-list`, `mcp-verdict-update`, `transaction-lifecycle-cascade`, `workflow-kind-inversion`, `reconcile-plan-convergence`.
- The files earlier phases trimmed to internal cases: `plugin-layer-verbs` (2 LAYER-06 cases), `marketplace-layer-remove` (3 EACCES cases), `marketplace-add-seed-mirrors` (6 mirror cases), `standalone-prune` (2 call-absence carriers), `mcp-migration` (1 fault injection), `mcp-verdict-migration` (3 released-build record cases), `mcp-verdict-list` (2 kept cases), `hooks-dispatch-end-to-end` (throwing hydrate), `auth-e2e` (cleanup fault injection), `path-source-tag-install` (CR-01 and the D-07-04 git-state case). Phase 6.1 deletes `hooks-additionalcontext-end-to-end` (it may still be present while Phase 6.1 executes; do not edit it).
- Helper modules: `concurrent-install-child.ts`, `ipc-child.ts`, `load-reconcile-race-child.ts`, `mcp-plugin-seed.ts`, `optional-peer.ts`, `optional-peer-suite-versions.json`, `pi-mcp-adapter-peer.ts`, `pi-subagents-peer.ts`; `test/bridges/mcp/expansion-cases.ts` serves only the conformance tests and stays with them.

Known moves (ROADMAP): the single-process D-13 case of `load-reconcile-race` and test 1 of `subagent-hook-ownership` are covered by scenarios and go; the pure in-memory fixed points of `reconcile-plan-convergence` move to unit tests beside their source pair (`test:corresponding`, 100% direct coverage). The `integration` CI job and `test:integration` stay (Out of Scope).

Carried review items to settle here: Phase 4 IN-03 (`standalone-prune` header says "no git call" but asserts only clone and fetch); Phase 5 (the `mcp-verdict-migration` header says its kept cases pin some rendered text no scenario shows); Phase 1 IN-02/IN-03 (source-read claims at `docs/mcp-compatibility.md:770` and `docs/hooks-compatibility.md:77`, a doc pass candidate).

</domain>

<decisions>
## Implementation Decisions

### Decided autonomously
- [Classification] Q: "How is each remaining case classified?" → Selected: "Research lists every case of every remaining file with its class (peer conformance, multi-process race, internal: stored fields / earlier-release state / fault injection / call absence, or rule 4), the evidence for the class, and for any case that fits none: the scenario or unit test that covers it (delete) or the source pair it moves beside (unit test)" — ITSCOPE-01.
- [Moves to unit tests] Q: "How does a case move to a unit test?" → Selected: "Beside its source pair under `test/<layer>/...`, following the typescript-unit-tests skill, with 100% direct coverage of the pair kept; the integration case goes in the same commit" — test layout rule.
- [Deletion proof] Q: "Does a case deleted as covered need a break?" → Selected: "Yes, as in Phases 1-7: one reverted deliberate break shows the covering scenario or unit test fails on a When/Then or an assertion before the case goes" — milestone rules.
- [Headers] Q: "What does each remaining file's header say?" → Selected: "Its class and the behavior cucumber does not cover, in the `// path` + prose style of the trimmed files (e.g. `test/integration/standalone-prune.test.ts`); fix the overclaims carried from Phases 4 and 5 (state exactly what the cases assert)" — ITSCOPE-02.
- [Charter] Q: "Where does the charter go and what does it say?" → Selected: "One short section in each of `.agents/skills/typescript-unit-tests/` (SKILL.md or a rules file), `.agents/skills/cucumber/`, and `.planning/codebase/TESTING.md`, with the same rule: what belongs in an integration test (the ITSCOPE-01 classes), and what goes to cucumber (user-visible behavior) or a unit test (one source pair); written plainly (simple-english)" — ITSCOPE-03.
- [Docs pass] Q: "Fix the Phase 1 source-read doc claims?" → Selected: "Yes if research confirms them as wrong or unverifiable; reword to what a test or scenario shows" — small, in scope as cleanup of claims about the suite.
- [Upstream parity] Q: "A case that pins behavior that may differ from Claude Code with no decision ID?" → Selected: "It stays and the question goes to the user (milestone rule), as in Phase 6" — milestone rule.
- [Bugs] Q: "A case exposing a product bug?" → Selected: "Rule 4: small fix with a unit test and CHANGELOG parent line, else BACKLOG entry and the case stays" — milestone rule.
- [Final gate] Q: "When is ITSCOPE-04 checked?" → Selected: "After the last Phase 8 merge and after Phase 6.1 merges: `npm run check` on the combined tree, both cucumber profiles green, 100% direct coverage" — ITSCOPE-04.

- [Moved-catalog row] Q: "Does the moved-catalog `list` row of `mcp-verdict-migration:202` become a scenario?" → Selected: "No: the file header says the kept cases compare whole rendered text while the scenarios compare result fields" — research recommendation.
- [Charter wording] Q: "'multi-process' or 'multi-process race'?" → Selected: "'multi-process' (a hand-off to a dead process is not a race)" — research.
- [TESTING.md counts] Q: "Refresh the whole dated count block in TESTING.md?" → Selected: "No: fix only the integration bullet (it still says 16 files)" — scope.
- [Doc claims] Q: "The Phase 1 source-read claims (`docs/mcp-compatibility.md:770`, `docs/hooks-compatibility.md:77`) match the peer sources but no test shows them" → Selected: "Reword each to say it was read in the peer's source, as research drafts; also fix the stale pointer in `docs/output-catalog.md:695` the deletions create" — research.

### Claude's Discretion
- Plan count and waves (likely: classification and moves per group of files; charter and headers; final gate).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.planning/research/INTEGRATION-OVERLAP.md` (the audit: Groups A, B, C, "Cheapest moves").
- Trimmed-file headers from Phases 2-7 (e.g. `test/integration/standalone-prune.test.ts:1-12`, `auth-e2e.test.ts:1-13`).
- `scripts/check-corresponding-tests.mjs` (`test:corresponding`), `npm run test:coverage:direct`.
- Red-proof tooling: `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/plan-07/inputs/` (`break.sh`, `check-red.mjs`).

### Integration Points
- This is the last phase; the milestone audit follows.

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
- Never set `SKIP=` for a pre-commit hook (including `SKIP=... pre-commit run`); commit normally. A commit can fail once when a fixer hook rewrites a file: re-add and commit again.
- The container can restart; commit planning files as soon as they are written.
- Phase 6.1 executes in parallel on hook files (`bridges/hooks/**`, `test/bridges/hooks/**`, `features/hook/additional-context.feature`, `docs/hooks-compatibility.md`, `.planning/PROJECT.md`) and deletes `test/integration/hooks-additionalcontext-end-to-end.test.ts`; Phase 8 research must not edit those, and Phase 8 execution starts after 6.1 merges.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
