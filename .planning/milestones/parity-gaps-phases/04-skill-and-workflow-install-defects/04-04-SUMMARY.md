---
phase: 04-skill-and-workflow-install-defects
plan: "04"
subsystem: domain/skill-tokens, cucumber harness (workflow vertical)
status: complete
tags: [workflows, skill-tokens, cucumber, PG-WF-01]
requirements: [PG-WF-01]
requires: []
provides:
  - "rewriteMarkdownReferences keeps the leading-slash state of a workflow reference (D-PG4-08)"
  - "projectWorkflowResult (features/lib/upstream/workflows.ts), registered for the tool name workflow"
  - "When: the user prompts {string} and the model starts a workflow run"
affects:
  - bridges/skills/stage.ts, bridges/commands/staged-command.ts, bridges/agents/convert.ts, bridges/agents/skill-preload.ts (inherit the rule, unedited)
  - docs/workflows-compatibility.md (Naming section; plan 04-06 edits other places later)
tech-stack:
  added: []
  patterns: ["upstream-text projection anchored on our value, throws on unreadable text"]
key-files:
  created:
    - features/workflow/references.feature
    - features/lib/upstream/workflows.ts
  modified:
    - extensions/pi-claude-marketplace/domain/skill-tokens.ts
    - test/domain/skill-tokens.test.ts
    - docs/workflows-compatibility.md
    - features/lib/upstream/index.ts
    - features/step_definitions/workflow/runs.steps.ts
    - .agents/skills/cucumber/rules/world-and-stand-ins.md
decisions:
  - "D-PG4-08 implemented: a workflow reference keeps the slash its source wrote; command and skill arms and the command > skill > workflow precedence unchanged"
  - "projectWorkflowResult throws on a failed workflow call as well as on an unreadable start text; no scenario states engine failure wording"
metrics:
  duration: "~45 min"
  completed: 2026-11-13
estimate:
  tokens: 54000
  tasks: 2
actuals:
  tokens: 43510
  tasks: 2
  commits: 2
plan_head_before: 281c518e7c989b192d2fa0c4fa129fe0411df952
plan_head_after: 72aa6d63ef837f2061a196a9c6ce2fa48a4a7be8
---

# Phase 04 Plan 04: Workflow reference slash state Summary

A plugin's bare workflow reference such as `Workflow({ name: "demo:scan" })` now stays bare when staged, so the engine's `workflow` tool loads it. A `/demo:scan` reference keeps its slash. A scenario shows the scripted model start the workflow by the copied name, and the run completes.

## What changed

- `extensions/pi-claude-marketplace/domain/skill-tokens.ts`: the workflow arm of `rewriteMarkdownReferences` returns `/<name>` only when the matched token starts with an ASCII `/`. Otherwise it returns the bare installed name. Name elision still applies (`acme:acme-audit` becomes `acme:audit`). The file header now says that a workflow reference keeps its slash state (D-PG4-08, PG-WF-01). The signature is unchanged, and the four bridge callers are unedited.
- `test/domain/skill-tokens.test.ts`: the two cases D-PG4-09 names now expect `acme:audit`. New cases cover: a reference written with a slash keeps it; the tool-call form `Workflow({ name: "acme:acme-audit" })` and the unchanged `Workflow(acme:audit)`; the installed spelling, bare and slash, stays byte-identical; a U+FF0F full-width solidus is not a slash; an empty workflow list leaves the text verbatim; empty content comes back unchanged. All the existing command and skill cases pass with no edit.
- `features/workflow/references.feature` (new, untagged, adapter profile) has three scenarios:
  1. A command that names its workflow in a tool call reaches the model with the name the engine loads.
  2. A skill that names its workflow keeps the name without a slash in its staged files: `allowed-tools: Workflow(demo:scan)`, a bare `demo:scan` in the body, `/demo:scan` kept, and the tool call in the supporting `jobs/start.md`.
  3. The model starts a workflow by the name a command gave it.
- `features/lib/upstream/workflows.ts` (new): `projectWorkflowResult(text, failed)`. It is registered under `workflow` in `RESULT_PROJECTORS` of `features/lib/upstream/index.ts`.
- `features/step_definitions/workflow/runs.steps.ts`: one new When, a fault check, and an `agent_settled` predicate. The file overview and the comment on the run-ending Then steps are updated.
- `.agents/skills/cucumber/rules/world-and-stand-ins.md`: one sentence for the projection under "Upstream text", and one for the new When under "The model turn".
- `docs/workflows-compatibility.md`, "Naming" section: the sentence "so the prose the model reads matches the command the session has" is replaced. The new text says retargeting keeps the leading slash the source wrote, and cites D-PG4-08, D-PG4-10, and the new feature. A new paragraph names three residuals: the engine's opt-in guidance for the `workflow` tool, `parallel()` rejecting on a non-recoverable error, and the workflow and command name collision. The `agentType` row (PG-WF-02) and the failure-behavior paragraphs (PG-WF-04) are untouched.

### The new When (verbatim step text)

`the user prompts {string} and the model starts a workflow run`

It sends the prompt and requires the disposition `started`. It waits for `agent_settled` and for the run-ending progress entry (`endsRun`, `WORKFLOW_RUN_TIMEOUT_MS`) at the same time, in either order, and never for a fixed time. It fails on an aborted turn, an extension error, a dialog, or a model call past the script. It records the turn, so `the model receives these calls:` and the run-ending Then read the same records.

### The projection's fixed form

`started the workflow <name>`. `<name>` is the first quoted name on the first line of the engine's start text: the `meta.name` of the started script, which is `scan` here. The projection drops the run id, the track and cancel hints, and the advice to the model. It throws on any text it cannot read, a failed call included.

Scenario 3 states this tool result: `workflow returned: started the workflow scan`.

## Red and green evidence

| Run | Tree | Command | Result |
| --- | --- | --- | --- |
| Red, task 1 | unchanged (281c518e) | `npm run test:cucumber:profile -- --profile adapter features/workflow/references.feature` | exit 1; 2 scenarios failed. Scenario 1: the model received `Call Workflow({ name: "/demo:scan" }) now. Slash form: /demo:scan.`. Scenario 2: the staged `allowed-tools: Workflow(/demo:scan)`, body `Start /demo:scan, or type /demo:scan.`, and `jobs/start.md` `Call Workflow({ name: "/demo:scan" }) now.` |
| Green, task 1 | arm changed | same | exit 0; 2 scenarios, 28 steps passed |
| Red, task 2 | workflow arm neutralized in the working tree only (it always returned the slash form), then restored with `git checkout -- <file>` | `npm run test:cucumber:profile -- --profile adapter features/workflow/references.feature:67` | exit 1; the calls Then failed. Calls 1 and 2 held `Call Workflow({ name: "/demo:scan" }) now.` (13 passed, 1 failed, 1 skipped) |
| Green, task 2 | HEAD 72aa6d63 tree | `npm run test:cucumber:profile -- --profile adapter features/workflow/references.feature features/workflow/run.feature features/workflow/listing.feature` | exit 0; 12 scenarios, 155 steps passed |

Other verify commands, all on Node v26.13.1:

- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/domain/skill-tokens.test.ts test/bridges/skills/stage.test.ts test/bridges/commands/staged-command.test.ts test/bridges/agents/convert.test.ts test/bridges/agents/skill-preload.test.ts` gave 303 tests, 303 passed, 0 failed. The caller tests needed no edit.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/skill-tokens.ts` exited 0, so direct coverage is 100%.
- `npm run check:features` exited 0.
- `npx --no fallow dupes --format json` reported 0 clone groups (see deviation 1).
- `SKIP=npm-check pre-commit run --files ...` on each task's files exited 0 and rewrote nothing.
- Both commits ran the hook's `npm run check:commit`, and it passed.
- The full `npm run check` was NOT run. The orchestrator runs it after the wave.

## Commits

- `f7845127` fix(workflows): keep a bare workflow reference bare when staged
- `72aa6d63` test(workflows): prove the model starts a workflow by the name it read

## Deviations from Plan

**1. [Rule 3, blocking] The new When is restructured so fallow finds no clone.**
- **Found during:** Task 2.
- **Issue:** The first draft of the When followed the model-turn When of `features/step_definitions/session.steps.ts` line by line. `npx --no fallow dupes` exited 0 but listed two clone groups (`dup:eecfce71`, `dup:29e21ca5`) between the two modules. The gate's `--fail-on-issues` run fails on every clone group.
- **Fix:** The body stays private to `runs.steps.ts`, as the plan allows, in a different shape. The start state is held as one object. The two waits are one `Promise.all` over the two predicates. The fault check and the script-overflow check are one whole-value assertion. The checks themselves did not change. `session.steps.ts` was not touched, and the re-run reported 0 clone groups.
- **Files:** `features/step_definitions/workflow/runs.steps.ts`. **Commit:** `72aa6d63`.

**2. [Design choice within the plan] `projectWorkflowResult` throws on a failed call.** The plan says the projection throws on text it cannot read. A failed `workflow` result is engine wording that no scenario states, so the projection throws on it too, and the message carries the text. Pi's argument refusal is still projected first by `projectToolResult`. A later scenario that expects a failed start (Phase 8) can extend the projection.

**3. [Clarification] Supporting-file name.** The skill scenario's supporting Markdown is `skills/scanner/jobs/start.md`, modeled on `claude-security/skills/.../jobs/scan-*.md`. The Background's `offers these plugins` step also gives `demo` its default `demo-skill`, so the staged listing holds both skills.

## Residual and assumption

- **Residual, recorded and not fixed (for BACKLOG):** a bare reference to a workflow that shares its installed name with a command of the same plugin still gets a slash. The command arm runs first, and `names.commands` still lists the command that staging later drops for the workflow (`dropWorkflowNamedCommands`). D-PG4-08 locks the precedence. No official plugin has the collision. `docs/workflows-compatibility.md` states it.
- **Assumption A3 (04-RESEARCH.md):** the background `workflow` call settles inside the model turn. The new When does not depend on it, because it waits for the settled turn and the run-ending entry in either order. In every run of this plan, the turn settled and the run completed, and the engine's delivery of the result started no further model call: the world's `After()` check for calls past the script passed.

## Parent lines (for the orchestrator)

- **BACKLOG.md:** "Workflow reference rewriting: a bare `plugin:wf` reference to a workflow whose installed name equals a command of the plugin still becomes `/plugin:wf`, because `names.commands` lists the command that staging later drops for the workflow (D-PG4-08 precedence; see docs/workflows-compatibility.md Naming)."
- **PROJECT.md:** the D-PG4-08 decision row (workflow references keep the source's slash state) and the D-PG4-10 doc correction land with this plan, as CONTEXT.md's "Parent lines" already list.
- **CHANGELOG.md (at PR time):** staged text changes only when a plugin re-materializes, so users of workflow plugins should run `update` or `reinstall` once.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The bridge adds no text that claims the user's opt-in (T-04-07, the prohibition in `must_haves.prohibitions`). It keeps the reference the author wrote, and the compatibility page names the engine's opt-in guidance as a residual.

## Self-Check: PASSED

- FOUND: features/workflow/references.feature
- FOUND: features/lib/upstream/workflows.ts
- FOUND: f7845127 (ancestor of HEAD)
- FOUND: 72aa6d63 (ancestor of HEAD)
