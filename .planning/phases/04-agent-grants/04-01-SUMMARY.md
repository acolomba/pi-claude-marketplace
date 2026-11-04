---
phase: 04-agent-grants
plan: "01"
subsystem: agents-bridge
status: complete
tags: [agents, pi-subagents, mcp, builtin-mcp, agents-index, typebox]

requires:
  - phase: 01-foundation-and-pi-1-5-0
    provides: "frozen profileFor(id) with grantSelector and toolName (domain/mcp-implementation.ts)"
provides:
  - "convertAgent renders a generated agent in the adapter or the built-in MCP grant form (ConvertAgentInput.mcpImplementation)"
  - "mcpAsyncWarning(id): the D-CF6-10 async warning per MCP implementation"
  - "emitGeneratedAgentFrontmatter and ConvertedAgent.frontmatter: the file's frontmatter block"
  - "optional mcpImplementation and mcpForms on an agents-index row, schemaVersion 1"
  - "integration conformance of the built-in selectors against pi-subagents 0.84.0's own resolver"
affects: [04-03 agent staging, 04-04 load-time grant swap, agents-index]

actuals:
  tokens: 13785
  tasks: 3
  commits: 3
plan_head_before: 1b695f261776e3d6b49676641a48827fdafa933f
plan_head_after: feca3c30a625589f6eab9e052b55ca4338ae3685

tech-stack:
  added: []
  patterns:
    - "Per-implementation rendering through a per-grant excludeName closure built from profileFor(id)"
    - "Frontmatter block emitted separately from the body; the file is the block followed by the body"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/agents/mcp-async-warning.ts
    - test/bridges/agents/mcp-async-warning.test.ts
    - test/integration/agents-builtin-grant-conformance.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
    - extensions/pi-claude-marketplace/bridges/agents/types.ts
    - extensions/pi-claude-marketplace/persistence/agents-index-schema.ts
    - test/bridges/agents/convert.test.ts
    - test/bridges/agents/frontmatter.test.ts
    - test/bridges/agents/types.test.ts
    - test/persistence/agents-index-schema.test.ts
    - test/persistence/agents-index-io.test.ts

key-decisions:
  - "An absent mcpImplementation renders the adapter form, so every existing caller writes the bytes it wrote before MGRT-01"
  - "The adapter per-tool exclude keeps the verbatim Claude token (not adapterToolName), pinned by a dotted-token case"
  - "A per-tool exclude name is a closure on each grant (excludeNameFor), so the match carries its own spelling and no form id is threaded through the mapping helpers"
  - "The agents-index form schema stays private; no new type is exported (AgentsIndexEntry carries the fields)"

patterns-established:
  - "MGRT-01 conformance: render with convertAgent, then resolve the tools: line through pi-subagents' resolveMcpDirectToolResolution with a builtin:mcp host"

requirements-completed: [MGRT-01]

duration: 50min
completed: 2026-11-04
---

# Phase 4 Plan 01: Built-in Agent Grant Form Summary

**`convertAgent` renders a generated agent's MCP grants, per-tool excludes, and async warning in either MCP implementation's form. pi-subagents 0.84.0's own resolver accepts the built-in selectors. The converted agent exposes its frontmatter block, and an agents-index row can hold both forms without a schemaVersion bump.**

## Performance

- **Duration:** about 50 min
- **Completed:** 2026-11-04
- **Tasks:** 3 of 3
- **Files:** 3 created, 9 modified

## Accomplishments

- `ConvertAgentInput.mcpImplementation` (absent means adapter). Grants use the frozen `profileFor(id).grantSelector`. Under built-in, a per-tool `excludeTools` name is `profileFor("builtin").toolName`: `-` folded, and a name over 64 characters cut and hashed. The cannot-narrow warning names the form's selector.
- New `bridges/agents/mcp-async-warning.ts`: `mcpAsyncWarning(id)`. The adapter text is today's text byte for byte. The built-in text ends "a launch before Pi's built-in MCP has listed the server's tools still fails".
- `emitGeneratedAgentFrontmatter(input)` returns the block from `---\n` through `\n---\n`. `emitGeneratedAgentFile` builds the block through it, then appends the normalized body. `ConvertedAgent.frontmatter` carries the block.
- `AGENTS_INDEX_ENTRY_SCHEMA` gains optional `mcpImplementation` (`adapter` | `builtin`) and `mcpForms.{adapter,builtin}.{frontmatter,warnings,droppedTools}`. schemaVersion stays 1.
- `test/integration/agents-builtin-grant-conformance.test.ts` checks per-tool, whole-server, dashed-server, and long hashed-tool selectors against pi-subagents' resolver, with a host whose `mcp` command comes from `builtin:mcp`. Every built-in selector resolves (`builtin: true`, nothing unresolved). Every adapter selector of the same agent stays unresolved.

## Task Commits

1. **Task 1: Render the built-in grant form, proven against pi-subagents' own resolver**: `1774de6` (feat)
2. **Task 2: Expose each converted agent's frontmatter block beside its file content**: `cdfb6b7` (feat)
3. **Task 3: Let an agents-index row hold the grant form of each implementation**: `feca3c3` (feat)

## TDD RED evidence

The commit hook refuses a commit with only failing tests, so each task committed its tests and implementation together. These are the RED runs taken before each implementation.

- **Task 1** (`node --test test/bridges/agents/convert.test.ts`, before the `convert.ts` change): 7 new cases failed and 157 passed. Every built-in case failed because the file held the adapter selector and the adapter async text. Example: `actual tools: read,mcp:plugin_acme_a_b_c_/query` against `expected tools: read,mcp:plugin_acme_a_b_c/query`. Failing cases:
  - a built-in per-tool exclude longer than 64 characters is cut and hashed as Pi 1.5.0 does
  - a built-in per-tool exclude on an omitted list is Pi's built-in tool name
  - a built-in per-tool grant names the server's built-in name and the tool
  - a server name holding a newline and a comma yields one sanitized built-in exclude name
  - a server name holding a newline and a comma yields one sanitized built-in selector on one tools: line
  - built-in whole-server grants name each server once and keep a dash in the selector
  - the cannot-narrow warning of a built-in whole-server grant names the built-in selector

  `mcp-async-warning.test.ts` was written after its module, so it has no failing run. The module does not exist at the base commit, so the test cannot import there.
- **Task 2** (the new tests run against the Task 1 sources): `frontmatter.test.ts` failed to load with `SyntaxError: ... does not provide an export named 'emitGeneratedAgentFrontmatter'`. The run reported 22 failures: that file load, the 3 new block cases in `convert.test.ts`, and the 18 pre-existing whole-agent cases there, which now expect `frontmatter`. `tsc` reported that `frontmatter` does not exist on `ConvertedAgent`, and that the new `@ts-expect-error` in `types.test.ts` was unused.
- **Task 3** (before the schema change): 4 of 44 failed. They were the three row rejects (`none` implementation, a form without `frontmatter`, a non-string warning) and the load that drops the `none` row. `tsc` reported that `mcpImplementation` does not exist on the row type, which covers the type pin and the round-trip case. At runtime the "accepts" cases already passed before the change, because TypeBox `Type.Object` keeps additional properties. Their RED is type-level only.

## Verification

- `npm run typecheck`: passed.
- Owner tests: `convert.test.ts` and `mcp-async-warning.test.ts` (164 at Task 1, more after Task 2), `frontmatter.test.ts`, `types.test.ts`, `agents-index-schema.test.ts`, `agents-index-io.test.ts` (44), `provenance-invisibility.test.ts`, and all of `test/bridges/agents/*.test.ts`: passed.
- `test/integration/agents-builtin-grant-conformance.test.ts` against pi-subagents 0.84.0: 2 of 2 passed (tracer gate re-run end to end before expansion).
- `npm run test:coverage:direct` for `convert.ts`, `mcp-async-warning.ts`, `frontmatter.ts`, `types.ts`, `agents-index-schema.ts`, `agents-index-io.ts`: exit 0 (100% from each pair).
- `npm run check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features): passed after each task.
- `npm run test:modules`: exit 0.
- Every pre-existing adapter expectation passes with no change to its expected bytes. The only pre-existing test edits add the new `frontmatter` field to the 3 literal expected agents in `convert.test.ts` and to the `ConvertedAgent` literals in `types.test.ts`.

## Deviations from Plan

None. The plan ran as written. Two minor implementation choices:
- `types.test.ts` also gained a negative, "a converted agent always records its frontmatter block". It pins the new required field the same way the file pins `warnings`.
- `McpGrant` carries an `excludeName(token, tool)` closure, and `McpGrantMatch` copies it. This replaces passing the form id through `omittedToolMapping`, so the mapping helpers keep their signatures.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-01 is mitigated: every selector comes from the frozen `grantSelector`, and every built-in exclude name comes from `toolName`. Two cases pin that a server declared as `a\nb,c` yields one sanitized selector on the single `tools:` line (`mcp:plugin_acme_a_b_c/query`) and one sanitized exclude name.

## Dubious Choices

1. **Claude-Session trailer value**
   - Severity: Low
   - Choice: Every commit ends with `Claude-Session: https://claude.ai/code/session_01EDUMG7S9uXh4o5dikBwum8`, as the child brief and the plan's executor section require.
   - Alternatives: The harness's attribution reminder gave a different session URL (`session_01EDUMG87PKcySw33ikhvFmE`).
   - Why dubious: Two sources disagree. The executor prompt said the trailer must be "exactly as in the child brief", so I followed the brief.
   - Recorded in: this SUMMARY.
2. **The conformance test computes Pi's tool names itself**
   - Severity: Low
   - Choice: The host's tool names come from a test-side copy of Pi 1.5.0's `createMcpToolName` rule (node:crypto), not from an import of Pi's `dist/extensions/mcp/tools.js`.
   - Alternatives: Import Pi's own `createMcpToolName` by file URL from the devDependency.
   - Why dubious: Pi's own function would also prove the naming against Pi, not only against pi-subagents. No test imports Pi's `dist` internals today, and the subpath is outside Pi's `exports` map, so I did not set that precedent.
   - Recorded in: this SUMMARY; the test's header comment.
3. **Pinned TypeBox error text for the `none` row**
   - Severity: Low
   - Choice: The io test expects the corruption message `/mcpImplementation: must be equal to constant`.
   - Alternatives: Assert only the dropped row and the corruption count.
   - Why dubious: A TypeBox upgrade could change the wording. The existing io tests already pin TypeBox wording (`must have required properties generatedName`), so this follows the precedent.
   - Recorded in: this SUMMARY.
4. **RED evidence that is partly type-level**
   - Severity: Low
   - Choice: I wrote `mcp-async-warning.test.ts` after its module. The Task 3 "accepts" cases pass at runtime before the change, because TypeBox keeps extra properties, so their RED is the `tsc` error only.
   - Alternatives: Write each test strictly first, and add a runtime-failing accept case (none exists for an additive optional field).
   - Why dubious: A reviewer may want a failing runtime run for every new case.
   - Recorded in: this SUMMARY, under TDD RED evidence.

## Next Phase Readiness

- Plan 04-03 can call `convertAgent` once per implementation, with `mcpImplementation` and the per-form `mcpServerNames`, and store `frontmatter`, `warnings`, and `droppedTools` in `mcpForms`.
- Plan 04-04 can import both async texts from `mcp-async-warning.ts` for the legacy translation.
- No caller passes `mcpImplementation` yet, so no user-visible output changes in this plan.

## Self-Check: PASSED

- The created files exist: `mcp-async-warning.ts`, `mcp-async-warning.test.ts`, `agents-builtin-grant-conformance.test.ts`, and this SUMMARY.
- Commits `1774de6`, `cdfb6b7`, and `feca3c3` are ancestors of HEAD.
- `npm run test:modules` exited 0 on the final tree.
