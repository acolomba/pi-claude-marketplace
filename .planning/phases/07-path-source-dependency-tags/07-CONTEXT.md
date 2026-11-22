# Phase 7: Path-Source Dependency Tags - Context

**Gathered:** 2026-11-22
**Status:** Ready for planning

<domain>
## Phase Boundary

A cucumber step publishes a marketplace repository with a tag, and scenarios replace the user-visible cases of `test/integration/path-source-tag-install.test.ts` (ITMIG-07):

- A plugin whose path-source dependency carries a version constraint installs that dependency from the marketplace tag the constraint selects (such as `formatter--v1.0.0`) while the marketplace HEAD has moved past the tag; the installed dependency shows the tag's version and content (TAGS-01, TAGS-03).
- When no marketplace tag satisfies the constraint, both plugins still install, from the current checkout (TAGS-02).
- CR-01 (an untracked file in the marketplace root kept out of the materialized tag clone) is borderline: it gets a scenario if a user can see the file, otherwise it stays as an internal case.
- Internal, staying for Phase 8: two cascade members leave the marketplace clone's `.git/index` and `.git/HEAD` unchanged.

Each replaced case is deleted after a deliberate break fails its scenario (rules 1-4).

Tag steps exist only for plugin repositories today (`features/lib/git-plugin.ts`). The new marketplace-tag step is a shared harness addition in the marketplace publishing harness (`features/step_definitions/marketplace/publishing.steps.ts` and its library under `features/lib/`), which Phase 3 also changed (merged).

Feature files this phase may edit: the dependency feature that owns constrained installs (research names it, e.g. `features/plugin/dependencies.feature` or `features/marketplace/*`), and a NEW file only if none owns the behavior.

</domain>

<decisions>
## Implementation Decisions

### Decided autonomously
- [Tag step] Q: "Where does the marketplace-tag step go?" → Selected: "In `features/step_definitions/marketplace/publishing.steps.ts`, with its builder in the marketplace library under `features/lib/` beside the plugin tag builder of `features/lib/git-plugin.ts` (reuse, do not copy: fallow dupes fails on clones); step text names the marketplace and the tag" — layout rule; harness code is cheap to change.
- [Placement] Q: "Which feature file gets the scenarios?" → Selected: "The existing feature that owns constrained dependency installs (research maps it by file:line); a new file only when none does" — reversible.
- [Tags] Q: "How are the scenarios tagged?" → Selected: "Untagged when they have no MCP surface (adapter only; builtin selects 0, DUAL-02)" — DUAL-02.
- [CR-01] Q: "Does the untracked-file case get a scenario?" → Selected: "Only if a user can see the file in the installed plugin (research checks what lands under the plugin root); otherwise it stays internal for Phase 8 with the reason in the file header" — follows the ROADMAP note.
- [Content checks] Q: "How is 'shows the tag's version and content' proved?" → Selected: "The list/info row with the version, and the installed artifact's text from the tag (not HEAD), compared whole; the fallback scenario shows both plugins installed with HEAD's content" — whole checks per the review lessons.
- [Breaks] Q: "How is each replaced case checked before deletion?" → Selected: "One reverted deliberate break per behavior, failing on a When/Then (not a Given), recorded in SUMMARY.md, checked with Phase 6's `check-red.mjs` if it fits" — test approach.
- [Deletion] Q: "What happens to path-source-tag-install?" → Selected: "It keeps only its internal cases (the `.git/index`/`.git/HEAD` check, and CR-01 if it stays internal) with a header saying why; helpers no remaining case uses go" — git history keeps the rest.
- [Bugs] Q: "What if a scenario exposes a product bug?" → Selected: "Rule 4: fix it when small, with a unit test beside its source pair and a CHANGELOG parent line; otherwise a BACKLOG.md entry and the guarding integration case stays" — milestone rule.

### Claude's Discretion
- Scenario titles, step wording, tables; break edits; plan count (one plan is likely).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/lib/git-plugin.ts` (plugin repository tags), `features/step_definitions/marketplace/publishing.steps.ts` (marketplace publishing, incl. the Phase 3 own-repository offer step).
- `features/step_definitions/scope-state.steps.ts` (whole-scope remembered/unchanged).
- The integration file being replaced: `test/integration/path-source-tag-install.test.ts` (4 tests).
- Red-proof tooling of Phase 6: `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/plan-06/inputs/` (`break.sh`, `check-red.mjs`).

### Established Patterns
- Red proofs as in `.planning/phases/06-hooks-and-auth/06-02-SUMMARY.md`.

### Integration Points
- Phase 8 takes the internal cases left in this file.

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
- From the Phase 2-6 reviews: every "shows" or "keeps" claim checks whole files or rows.
- Never set `SKIP=` for a pre-commit hook; commit normally (inside a worktree the hook may check nothing; run `npm run check:static` by hand).
- The container can restart; commit planning files as soon as they are written.
- Upstream parity: if a case pins behavior that may differ from Claude Code and names no decision ID, its integration case stays and the question goes to the user (milestone rule).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
