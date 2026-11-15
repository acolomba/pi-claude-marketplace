---
phase: 08-workflow-agents-and-run-paths
fixed_at: 2026-11-15T06:22:40Z
review_path: .planning/phases/08-workflow-agents-and-run-paths/08-REVIEW.md
iteration: 2
findings_in_scope: 5
fixed: 5
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

_Fixed: 2026-11-15T06:03:51Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

## Iteration 2

**Fixed at:** 2026-11-15T06:22:40Z
**Source review:** .planning/phases/08-workflow-agents-and-run-paths/08-REVIEW.md (iteration 2, committed b3fdc46f)

The frontmatter now gives the iteration 2 counts. The iteration 1 counts are in the summary above (8 in scope, 8 fixed).

**Summary:**

- Findings in scope: 5 (WR2-01, IN2-01..04)
- Fixed: 5
- Skipped: 0

| Finding | Status | Commit | Notes |
| --- | --- | --- | --- |
| WR2-01 | fixed | e03e0408 | Pending maintainer review: T-08-13 acceptance and rating. |
| IN2-01 | fixed | 8975cda6 | Comment and catalog prose only; no owner case added. |
| IN2-02 | fixed | dffbb2da | Citations re-pointed at 8975cda6. |
| IN2-03 | fixed | 9a0e0e05 | Pending maintainer review: AGENT-10 decision. |
| IN2-04 | fixed | 6e2f0a11 | -- |

### WR2-01: T-08-13 marked closed on an acceptance that nobody owns

**Files modified:** `.planning/phases/08-workflow-agents-and-run-paths/08-SECURITY.md`
**Commit:** e03e0408
**Applied fix:** T-08-13 is now `open (nonblocking)` with the disposition "accept (pending maintainer acceptance)". It is below the `block_on: high` limit. The frontmatter now reads `threats_open: 0`, `threats_open_nonblocking: 1`, `threats_closed: 26`. `status: verified` stays, because the blocking gate (`threats_open`) is still 0. The intro gives the new counts (4 high, 14 medium, 9 low). One sign-off item is now unchecked and names the pending acceptance. The approval line says that the verification covers the blocking gate only. A new audit-trail row records the change. The rating is now `medium`, the rating of T-08-12, because a cloned repository can bring about that exposure with no consent from the user. `.planning/BACKLOG.md` is not edited here. The register says that the parent writes the drafted line to BACKLOG when it merges the branch. Pending maintainer review: the acceptance itself, the medium rating, and keeping `status: verified` with one open nonblocking threat.

Drafted BACKLOG line for the parent (the loader cite is now 122-134, its whole body):

`- [workflows] Ask the pi-dynamic-workflows engine to apply Pi project trust to <project>/.pi/workflows/settings.json (3.15.0 src/workflow-settings.ts:122-134 reads it untrusted; a cloned repo can set providerMiddlewareExtensions and inheritMainModel). Source: 08-REVIEW.md CR-01, 08-SECURITY.md T-08-13.`

### IN2-01: The comment and the catalog gave the wrong condition for the short count line

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts`, `docs/output-catalog.md`
**Commit:** 8975cda6
**Applied fix:** Both now say "when no missing-agent note comes before it", and they say that a restriction note may still come first. The comment changed, and the catalog prose outside the example block changed. So the byte pin, which counts example bytes only, stays at 55,018. The optional owner case (a restriction note and then the short count line) was not added.

### IN2-02: Stale line citations in 08-SECURITY.md

**Files modified:** `.planning/phases/08-workflow-agents-and-run-paths/08-SECURITY.md`
**Commit:** dffbb2da
**Applied fix:** T-08-04, T-08-05, T-08-06, T-08-07, T-08-24, T-08-25 and T-08-26 now cite the tree at 8975cda6. The intro says so. T-08-05 now also cites the owner cases and the scenario for a count line that no note precedes. T-08-25 records the +1 byte move from WR-02. The engine loader cite is now `src/workflow-settings.ts:122-134` (its whole body) in the row, in the log, and in the BACKLOG line. The other rows were checked and still match.

### IN2-03: The AG-11 refusal had no upstream statement

**Files modified:** `docs/mcp-compatibility.md`
**Commit:** 9a0e0e05
**Applied fix:** The 2.1.323 binary has a launch-time check, `subagent_tool_resolution` / `zero_tools_refused`. It throws "Agent '<type>' would be spawned with zero tools -- refusing. Its tools list resolved to nothing: ... not available to subagents [...]". `Workflow` is one of the tools that are not available to subagents. So Claude Code installs such an agent and refuses only its launch. The bullet now says this, says that the install refusal is a divergence that the recorded requirement AG-11 licenses, and points to AGENT-10 in `docs/research/parity-gaps/subagents.md`, which proposes to skip the agent instead. Pending maintainer review: the AGENT-10 decision.

### IN2-04: The settings paragraph named only two keys

**Files modified:** `docs/workflows-compatibility.md`
**Commit:** 6e2f0a11
**Applied fix:** The paragraph now names `defaultEffort`, `defaultTokenBudget` (`null` removes the user's budget), `defaultConcurrency`, `defaultAgentRetries`, `persistAgentSessions` (it writes subagent transcripts to disk) and `keywordTriggerEnabled`. All of them were checked against the engine 3.15.0 `WorkflowSettings` interface (`src/workflow-settings.ts:13-75`).

### Verification (iteration 2)

All work ran in the main checkout of the worktree `/home/acolomba/src/pi-claude-marketplace-gaps-agents`. No separate fixer worktree was used. Tests ran with a scratchpad HOME and `--import test/platform/isolated-pi-home.ts`.

- `test/architecture/catalog-uat/catalog-contract.test.ts` and `test/orchestrators/plugin/discover-names.test.ts`: 53 pass, 0 fail, after IN2-01.
- The commit hook ran in full on the IN2-01 commit (`check:commit` passed). The other commits change only docs or planning files. `SKIP=npm-check pre-commit run --files` was clean on each of them.
- `npm run check` was not run: the parent owns the combined-tree gate.

---

_Fixed: 2026-11-15T06:22:40Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
