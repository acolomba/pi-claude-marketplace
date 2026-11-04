---
phase: 04-agent-grants
plan: "03"
subsystem: agents-bridge
status: complete
tags: [agents, pi-subagents, mcp, builtin-mcp, agents-index, staging]

requires:
  - phase: 04-agent-grants
    provides: "04-01: convertAgent per MCP implementation, ConvertedAgent.frontmatter, optional mcpImplementation and mcpForms on an agents-index row"
provides:
  - "convertAgentGrantForms (bridges/agents/grant-forms.ts): the file's grant form plus the row fields that record both forms"
  - "convertAgentForm (bridges/agents/convert.ts): a conversion that returns undefined where convertAgent refuses with AG-11"
  - "StageAgentsInput.mcpGrantForms { active, declaredMcpServers }: the optional stage input that turns on per-form staging"
  - "prepareStagePluginAgents writes the active form and records mcpImplementation and mcpForms when the two forms differ"
affects: [04-04 load-time grant swap, 04-05 install and update call sites, agents-index]

estimate:
  tokens: 115000
  tasks: 2
actuals:
  tokens: 12460
  tasks: 2
  commits: 2
plan_head_before: 08fd4d45ec256b5473ccefa47368f2661cd19a15
plan_head_after: 476b2e7d43dc76392553a46e08b91412ae658f4e

tech-stack:
  added: []
  patterns:
    - "A module-private conversion core returns a discriminated result; convertAgent throws AG-11 from it and convertAgentForm maps the empty case to undefined, with no try/catch"
    - "Row fields spelled inline as Pick<AgentsIndexEntry, \"mcpImplementation\" | \"mcpForms\"> so no new type is exported"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/agents/grant-forms.ts
    - test/bridges/agents/grant-forms.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - extensions/pi-claude-marketplace/bridges/agents/stage.ts
    - extensions/pi-claude-marketplace/bridges/agents/types.ts
    - test/bridges/agents/convert.test.ts
    - test/bridges/agents/stage.test.ts
    - test/bridges/agents/unstage.test.ts

key-decisions:
  - "The file's form is builtin only when the active implementation is builtin; adapter and none both write the adapter form"
  - "Two forms count as equal when their frontmatter blocks are equal; the block already holds each form's warnings and dropped tools in its provenance"
  - "The built-in server set is the declaredMcpServers entries whose profileFor(\"builtin\").classify verdict is supported, read with Object.entries"
  - "The user-visible staging warnings come from the file's form only"

requirements-completed: [MGRT-01]

duration: 75min
completed: 2026-11-04
---

# Phase 4 Plan 03: Agent Staging in Both Grant Forms Summary

**The agents stage now renders each agent in both MCP grant forms. It writes the active implementation's form (adapter for `none`), and stores both forms on the agent's index row when they differ. An empty inactive form under AG-11 is left out instead of failing the staging. Without the new `mcpGrantForms` input, staging writes exactly what it wrote before.**

## Performance

- **Duration:** about 75 min
- **Completed:** 2026-11-04
- **Tasks:** 2 of 2
- **Files:** 2 created, 6 modified

## Accomplishments

- `StageAgentsInput.mcpGrantForms?: { active: ActiveMcpImplementation; declaredMcpServers: Readonly<Record<string, unknown>> }`. `mcpServerNames` stays the adapter form's server set.
- `convert.ts`: the body of `convertAgent` moved into the private `convertAgentOrEmpty`, which returns `{ kind: "converted", agent }` or `{ kind: "empty-tools" }`. `convertAgent` throws the AG-11 error with the same message from `emptyToolListError`. `convertAgentForm` returns `undefined` for the empty case. `assertMappedToolsNonEmpty` became the type guard `hasMappedTools` plus `emptyToolListError`. The order of the `raw.tools` reads is unchanged, so the malformed-accessor case still passes.
- New `bridges/agents/grant-forms.ts`: `convertAgentGrantForms(input, grantForms)`. With no `grantForms` it returns `convertAgent(input)` and `recorded: {}`. Otherwise:
  - The file's form converts through `convertAgent`, so AG-11 still fails the staging.
  - The other form converts through `convertAgentForm`.
  - If the other form's frontmatter equals the file's, nothing is recorded.
  - Otherwise `recorded` is `{ mcpImplementation, mcpForms }`. The forms hold copied `frontmatter`, `warnings`, and `droppedTools`.
- `stage.ts` step 2 converts each agent through `convertAgentGrantForms`. Step 8 spreads the recorded fields after `warnings`. Every other step (AG-9 guard, AS-9 noop, AG-5 soft fail, `formatAgentWarnings`, index save last) reads the same converted agents as before.

## Task Commits

1. **Task 1: Stage each agent in the active form and record both forms on its row**: `0938420` (feat)
2. **Task 2: Pin that rows with grant forms survive every staging and unstaging path**: `476b2e7` (test)

## TDD RED evidence

The commit hook refuses a commit that has only failing tests, so Task 1 committed its tests and code together. To get the RED run, I copied the new sources to scratch, restored `convert.ts`, `stage.ts`, and `types.ts` from the base commit, and moved `grant-forms.ts` aside. Then I ran the three test files and restored the new sources:

```
node --test --test-reporter=./scripts/test-reporter.mjs test/bridges/agents/grant-forms.test.ts test/bridges/agents/convert.test.ts test/bridges/agents/stage.test.ts
SyntaxError: The requested module '../../../extensions/pi-claude-marketplace/bridges/agents/convert.ts' does not provide an export named 'convertAgentForm'
✖ test/bridges/agents/convert.test.ts
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../bridges/agents/grant-forms.ts' imported from .../test/bridges/agents/grant-forms.test.ts
✖ test/bridges/agents/grant-forms.test.ts
✖ MGRT-01: a built-in staging writes the built-in form and records both forms on a row the loader keeps
    actual: [ { kind: 'hygiene', message: "[bot] tools include MCP tools, ... a launch before pi-mcp-adapter has cached the server's tools still fails" } ]
tests 38, suites 4, pass 35, fail 3
```

At the base, the stage case fails on behavior, not only on the import: the stage ignores `mcpGrantForms` and writes the adapter form and the adapter warning. The other two files fail to load because the new export and module do not exist yet.

Task 2 adds no product code. As the plan says, its cases pin existing invariants for the new fields, so they passed on their first run (49 of 49 in `stage.test.ts` and `unstage.test.ts`). There is no RED run for them.

## Verification

- `npm run typecheck`: passed.
- `node --test` over `grant-forms.test.ts`, `convert.test.ts`, and `stage.test.ts`: 214 of 214 passed after Task 1.
- `npm run test:coverage:direct` for `grant-forms.ts`, `convert.ts`, `stage.ts`, and `types.ts` (Task 1), and for `stage.ts` and `unstage.ts` (Task 2): exit 0. Each source has 100% coverage from its own pair.
- `npm run check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features): passed after each task.
- `npm run test:modules`: exit 0 on the final tree.
- Tracer gate: Task 1's automated `<verify>` passed end to end before Task 2.
- Acceptance greps: `convertAgentGrantForms` in `stage.ts` (2), `mcpGrantForms` in `types.ts` (1), `export function convertAgentForm` in `convert.ts` (1), `mcpForms` in `unstage.test.ts` (2).
- No pre-existing expected bytes changed. Every old stage and convert case passes unedited. The only edit to an existing test is in Task 2: Task 1's new stage case now builds its frontmatter through the shared `botQueryFrontmatter` helper.

## Deviations from Plan

None. The plan ran as written. Smaller choices:
- The stage test that pins the built-in file bytes also loads the index through `loadAgentsIndex` and expects the same row with no corruptions. That is T-04-06's round-trip mitigation.
- The `__proto__` test case makes the key with a computed literal key (`["__proto__"]: ...`), which creates an own property. `JSON.parse` would also work, but its `any` result fails `no-unsafe-assignment`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-06 is mitigated: each form is copied from the converter's own output, and a stage case round-trips the staged row through `loadAgentsIndex` with zero corruptions. T-04-07 is mitigated: the built-in form maps only servers whose built-in verdict is `supported`. A case pins that an sse grant is kept in the adapter form and dropped from the built-in form. T-04-08 holds: `declaredMcpServers` is read only for the verdict, and no config value reaches a row.

## Dubious Choices

1. **Claude-Session trailer value**
   - Severity: Low
   - Choice: Both commits end with `Claude-Session: https://claude.ai/code/session_01EDUMG7S9uXh4o5dikBwum8`. The child brief and the plan's executor section give this value, and 04-01 used it too.
   - Alternatives: The harness's attribution reminder for this run gave `session_01EDUMG87PKcySw33ikhvFmE`.
   - Why dubious: The two sources disagree. I followed the brief, which says "exactly these two lines", and kept the value the earlier plans of this phase used.
   - Recorded in: this SUMMARY.
2. **Declaration order of the built-in server set is not observable**
   - Severity: Low
   - Choice: `builtinServerNames` keeps declaration order (`Object.entries` plus `filter`). The test pins that every supported server is mapped, `__proto__` included, and that an sse server is dropped. It does not pin the order.
   - Alternatives: Add a case where the order changes the output.
   - Why dubious: The plan's behavior list names declaration order. `convert.ts` sorts the grants by prefix length before matching, and the `tools:` line follows the agent's own token order. So the server order cannot change a rendered agent, and no case can tell it apart.
   - Recorded in: this SUMMARY; the test title names only what is pinned.
3. **A staging without `mcpGrantForms` drops a row's stored forms**
   - Severity: Low
   - Choice: As the plan says, a stage with no `mcpGrantForms` records no forms. A re-stage through such a caller therefore replaces a row that had forms with one that has none. Until plan 04-05 wires the install and update call sites, every real staging is this kind.
   - Alternatives: Carry the previous row's forms forward when the input is absent.
   - Why dubious: Carrying them forward could keep a form that no longer matches the agent's new source. Dropping them is the safe default, and the load then leaves the file alone. A reviewer may still want this pinned or handled. No case pins it, because the plan pins only the adapter re-stage.
   - Recorded in: this SUMMARY.
4. **RED evidence taken after the implementation**
   - Severity: Low
   - Choice: I wrote the Task 1 tests after the code. For the RED run I restored the base sources by hand, ran the tests, then put the new sources back. For two of the three files the RED is an import failure, not a behavior failure.
   - Alternatives: Write each test first against a stub export.
   - Why dubious: A reviewer may want a behavior-level failing run for every new case. The stage case does fail on behavior at the base.
   - Recorded in: this SUMMARY, under TDD RED evidence.

## Next Phase Readiness

- Plan 04-05 can pass `mcpGrantForms: { active: opts.run.softDeps.mcpImplementation, declaredMcpServers: resolved.declaredMcpServers }` from `agentsPhase` and from the update staging. It keeps `mcpServerNames: Object.keys(resolved.mcpServers)`.
- Plan 04-04 can read `mcpImplementation` and `mcpForms[active].frontmatter` from each row to swap the file's block.
- No production caller passes `mcpGrantForms` yet, so no user-visible output changes in this plan.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/bridges/agents/grant-forms.ts` and `test/bridges/agents/grant-forms.test.ts` exist.
- Commits `0938420` and `476b2e7` are ancestors of HEAD.
- `npm run check:static` and `npm run test:modules` exited 0 on the final tree.
