---
phase: 08-workflow-agents-and-run-paths
fixed_at: 2026-11-15T06:03:51Z
review_path: .planning/phases/08-workflow-agents-and-run-paths/08-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 8: Code Review Fix Report

**Fixed at:** 2026-11-15T06:03:51Z
**Source review:** .planning/phases/08-workflow-agents-and-run-paths/08-REVIEW.md (committed 3826ad12)
**Iteration:** 1

**Summary:**

- Findings in scope: 8 (all: CR-01, WR-01..04, IN-01..03)
- Fixed: 8
- Skipped: 0

Every fix below is a reversible default chosen in the autonomous run. Each is pending maintainer review.

## Fixed Issues

### CR-01: Docs say the engine applies Pi project trust to the in-repo workflow settings file

**Files modified:** `docs/workflows-compatibility.md`, `.planning/phases/08-workflow-agents-and-run-paths/08-SECURITY.md`
**Commit:** 1cd464ac
**Applied fix:** The page now says that engine 3.15.0 reads `<project>/.pi/workflows/settings.json` whether or not the project is trusted (`src/workflow-settings.ts`). It says that a cloned repository can use this to turn on `providerMiddlewareExtensions` and `inheritMainModel`. It tells users to read the file in a repository they did not write. T-08-13 changed from "transfer" to "accept": a flagged residual that the engine owns. It has an Accepted Risks Log entry and an audit-trail row. Pending maintainer review. Parent line for BACKLOG (not written here): `- [workflows] Ask the pi-dynamic-workflows engine to apply Pi project trust to <project>/.pi/workflows/settings.json (3.15.0 src/workflow-settings.ts:122-133 reads it untrusted; a cloned repo can set providerMiddlewareExtensions and inheritMainModel). Source: 08-REVIEW.md CR-01, 08-SECURITY.md T-08-13.`

### WR-01: The count line says "N more" when no note came before it

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts`, `test/orchestrators/plugin/discover-names.test.ts`, `features/workflow/agent-types.feature`, `docs/output-catalog.md`
**Commit:** 9976a646
**Applied fix:** When no note precedes the count line, it now reads `runs N agent type(s) longer than 128 characters that this plugin does not install; the workflow engine runs a default agent in its place / in place of each, where Claude Code fails the step`. The "N more" form is kept when notes come before it. There are owner cases for one and two too-long types, and a new scenario. The scenario was red on the old code (1 failed) and is green now. The catalog prose describes the line. Pending maintainer review (wording).

### WR-02: The note says "where Claude Code stops the run"

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts`, `docs/output-catalog.md`, `docs/workflows-compatibility.md`, `features/workflow/agent-types.feature`, `test/architecture/catalog-uat/fixtures/plugin-info.ts`, `test/architecture/catalog-uat/catalog-contract.test.ts`, `test/orchestrators/plugin/discover-names.test.ts`, `test/orchestrators/plugin/info.test.ts`
**Commit:** 06d6013d
**Applied fix:** The note now ends "where Claude Code fails the step". The same text is in the code, the catalog state and prose, the catalog-uat fixture, the scenario tables and title, the owner tests, and the `agentType` docs row. The docs row now says that `agent()` throws and that `parallel()` and `pipeline()` turn the throw into `null`. The catalog byte pin moved from 55,017 to 55,018 (+1 byte, one state). The scenario tables assert the exact bytes, so they fail on the old text. Pending maintainer review.

### WR-03: The restriction join still keys on the generated flat name

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts`, `test/orchestrators/plugin/discover-names.test.ts`, `features/workflow/agent-types.feature`, `docs/workflows-compatibility.md`
**Commit:** f9ebd499
**Status:** fixed: requires human verification (logic)
**Applied fix:** `restrictedAgentTools` now keys only on the frontmatter `name`. This matches the engine registry (`src/agent-registry.ts:98`: `fmName || basename`). The fix dropped the `generatedName` entry, the orphaned `WorkflowNoteAgent.generatedName` field, and the stale comment. The owner case moved to the no-note list. A new scenario was red on the old code and is green now. Decision: an exact generated flat name gets no missing-agent note. The existing namespace rule is kept, and the `agentType` row records this as a fifth limit of the note. Pending maintainer review.

### WR-04: The model-precedence row has the wrong order and leaves out `meta.model`

**Files modified:** `docs/workflows-compatibility.md`
**Commit:** 729c0391
**Applied fix:** The order is now: call or agent-type `model` > `tier` > phase `model` > the script's `meta.model` > the inherited main model (`inheritMainModel`) > the `medium` tier (only with a model-tiers config) > Pi's default. It cites `src/workflow.ts`, `src/workflow-capability-contract.ts`, and `src/agent.ts`. It says that a `tier` beats the phase model.

### IN-01: The install header counts the count line as one "declared component"

**Files modified:** `docs/output-catalog.md`
**Commit:** 729c0391
**Applied fix:** The counting rule is unchanged. The same `discoveryClause` counts lines for every bridge. The catalog now says that the header counts lines, not scripts or agent types, and that seven missing types read "6 declared components have notes". Pending maintainer review: we could still change the rule.

### IN-02: The "still runs" scenario never shows that a default agent ran

**Files modified:** `features/workflow/agent-types.feature`
**Commit:** 18f6510d
**Applied fix:** The fix added `Then the model receives these calls:`. Measured at 3.15.0, the engine sends `Act as workflow subagent type: demo:ghost\n\nTask label: agent 1\n\nAnswer the task.`: a type label and no agent body. The review's guessed text left out the label. A red mutation binds the step to `demo:helper`: the step fails, and the call holds the helper's body.

### IN-03: An upstream claim with no evidence grade

**Files modified:** `docs/mcp-compatibility.md`
**Commit:** 729c0391
**Applied fix:** The sentence "Claude Code fails such an agent when it launches" is removed. No evidence for it was found in the phase artifacts, and it was not checked against the binary. Pending maintainer review: if the 2.1.323 binary confirms it, restore it with a grade.

## Verification

All checks ran in the main checkout of the worktree `/home/acolomba/src/pi-claude-marketplace-gaps-agents`. No separate fixer worktree was used. Each run used a temporary HOME under the scratchpad, with `test/platform/isolated-pi-home.ts` imported for the unit runs.

- `test/orchestrators/plugin/discover-names.test.ts` and `info.test.ts`: pass (339 after WR-03).
- `test/architecture/**`: 856 pass, 0 fail.
- `features/workflow/agent-types.feature`, adapter profile: 9 scenarios, 115 steps, all pass. The feature has no `@mcp` tag, so the builtin profile does not run it.
- `npm run typecheck`: clean. ESLint on the changed TS files: clean. The commit hook (`check:commit`) passed on every commit.
- `npm run check` was not run: the parent owns the combined-tree gate.

---

_Fixed: 2026-11-15T06:03:51Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
