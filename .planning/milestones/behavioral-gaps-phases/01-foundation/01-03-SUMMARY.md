---
phase: 01-foundation
plan: 03
subsystem: testing
tags: [cucumber, harness, scripted-model, faux-provider, compaction, stop-failure, upstream-projection]

requires:
  - phase: 01-foundation
    provides: "01-01: the Behavioral gaps layout section that freezes features/lib/** after Phase 1"
provides:
  - "Model script columns `error` (a step that ends its call with stop reason error and the chosen message) and `stop reason` (reply-only, value `length`) (D-BG-06)"
  - "Model script column `context tokens` (reply-only, positive integer): the call's usage reports that many input tokens, through a wrapper around faux.streamSimple keyed to the call's own message (D-BG-07)"
  - "projectArgumentValidationFailure(tool, text) in features/lib/upstream/pi.ts, applied first to every failed tool result by projectToolResult; projected form `invalid arguments: <path>, <path>`"
  - "Seeds: features/hook/stop-failure.feature (STOPF-01), features/hook/compaction.feature (PCOMP-01), features/plugin/model-tools.feature (TOOL-01, TOOL-03)"
affects: [phase 3 stop failure, phase 5 compaction, phase 10 model tools, 01-08 frozen record]

actuals:
  tokens: 6117
  tasks: 3
  commits: 3
plan_head_before: f5367a4010add4987149e2887cc3769f000b5d32
plan_head_after: 4c1edaffba0ffb2a0de38bc6c1287206bb245f7b

tech-stack:
  added: []
  patterns:
    - "A per-call value from the faux player to the provider stream rides on the call's own message as a plain field, which the wrapper strips from every event; no module state"
    - "An upstream projector anchors on our value (the quoted tool name) plus structure (first line ends with a colon), never on Pi's words"

key-files:
  created:
    - features/hook/stop-failure.feature
    - features/hook/compaction.feature
    - features/plugin/model-tools.feature
  modified:
    - features/lib/scripted-model/script.ts
    - features/lib/scripted-model/extension.ts
    - features/lib/upstream/pi.ts
    - features/lib/upstream/index.ts

key-decisions:
  - "The context-tokens carrier is stripped from every forwarded event (partials and error messages too), not only from the done message, so Pi never receives the field"
  - "The TOOL-01 seed installs demo in the user scope, so the list tool reports 1 plugin(s) rather than a 0 a broken counter would also print"
  - "The validation projector anchors on the quoted tool name in a first line that ends with a colon, deduplicates the refused paths, and sorts them"

patterns-established:
  - "Script row kinds: exactly one of reply, tool, or error per row; reply-only columns are listed once in REPLY_ONLY_COLUMNS"

requirements-completed: [FND-01]

coverage:
  - id: D1
    description: "A model-script error row ends the turn in that error and runs the plugin's StopFailure hook with error type authentication_failed"
    requirement: FND-01
    verification:
      - kind: other
        ref: "npm run test:cucumber:profile -- --profile adapter features/hook/stop-failure.feature features/hook/session.feature features/skill/aliases.feature"
        status: pass
    human_judgment: false
  - id: D2
    description: "A reply row with context tokens 120000 makes Pi compact on its own, and PostCompact runs with trigger auto"
    requirement: FND-01
    verification:
      - kind: other
        ref: "npm run test:cucumber:profile -- --profile adapter features/hook/compaction.feature features/hook/session.feature features/hook/stop-failure.feature"
        status: pass
    human_judgment: false
  - id: D3
    description: "The scripted model calls the list tool and the calls step shows the result it read; a refused argument reads as the projection, not Pi's text"
    requirement: FND-01
    verification:
      - kind: other
        ref: "npm run test:cucumber:profile -- --profile adapter features/plugin/model-tools.feature features/hook/tool-use.feature features/agent/invocation.feature"
        status: pass
      - kind: other
        ref: "npm run check:features"
        status: pass
    human_judgment: false

duration: 27min
completed: 2026-11-08
status: complete
---

# Phase 1 Plan 03: Scripted Model Error, Usage, and Tool Seeds Summary

**The scripted model can now end a call in a chosen provider error or a `length` stop, and can report its own call's context tokens through a stream wrapper, so Pi runs StopFailure and its own threshold compaction. A Pi argument-validation projector lets a seed state a refused tool call without Pi's wording.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-11-08T01:47:18Z
- **Completed:** 2026-11-08T02:14:28Z
- **Tasks:** 3
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments

- `script.ts`: the new columns `error`, `stop reason`, and `context tokens`, and the `ScriptStep` arms `{ error }` and `{ reply, stopReason?: "length", contextTokens? }`. The row parser is split into per-kind helpers. A row must set exactly one of reply, tool, or error, and a reply-only column on another row kind is refused with the row number. Every existing script table still parses: the `reply` column stays required.
- `extension.ts`: an error step returns `fauxAssistantMessage([], { stopReason: "error", errorMessage })`. A reply step with context tokens carries the value on its own message, and `streamSimple` wraps `faux.streamSimple`. The wrapper forwards every event without the carrier field, and on `done` it sets the usage to `input = totalTokens = <tokens>`, with zeros elsewhere.
- `upstream/pi.ts` + `index.ts`: `projectArgumentValidationFailure` reduces Pi 1.5.0's validation failure to `invalid arguments: <sorted paths>`. It returns `undefined` for any other text, and throws when the text starts like a validation failure but names no path. `projectToolResult` applies it first to any failed result.
- Four seeds in three new feature files, none tagged (D-BG-05). All use existing steps only.

## Task Commits

1. **Task 1: End a turn in a chosen provider error and seed StopFailure (D-BG-06)**: `b206cd4a` (test)
2. **Task 2: Report context usage per call so Pi compacts on its own (D-BG-07)**: `d6b0038e` (test)
3. **Task 3: Seed the model-facing tools and project Pi's argument validation text (D-BG-08)**: `4c1edaff` (test)

## Red Proofs

- **STOPF-01** (`features/hook/stop-failure.feature`): with the script row changed to the reply `Hello.`, no StopFailure run is recorded and `the hooks record these runs:` fails: the actual table is empty, and the expected row is missing. With the error row, the hook receives error type **`authentication_failed`** and `last assistant message` `Authentication failed (401)`.
- **PCOMP-01** (`features/hook/compaction.feature`): with `context tokens` `1000`, Pi does not compact, and the runs step fails with an empty table instead of the PostCompact row. The model made one call, so the `Summary A.` step went unused. The world's After check reports unused script steps only for a passing scenario, so that failure does not show as a separate message.
- **TOOL-01** (`features/plugin/model-tools.feature`): with the expected row changed to `2 plugin(s)`, the calls step fails: actual `[user] fixtures -- 1 plugin(s) -- {home}/marketplaces/fixtures`.
- **TOOL-03** (`features/plugin/model-tools.feature`): with `projectToolResult` skipping the projector (`const refused = undefined`), the calls step fails with Pi's raw text, `Validation failed for tool "pi_claude_marketplace_plugin_list":\n  - scope: expected "user"\n\nReceived arguments:...`, instead of `invalid arguments: scope`.

All four files were restored byte for byte (checked with `cmp`) after each red run.

## Verification

- Plan verification: `npm run test:cucumber:profile -- --profile adapter features/hook/stop-failure.feature features/hook/compaction.feature features/plugin/model-tools.feature features/hook/session.feature features/hook/tool-use.feature features/skill/aliases.feature`: 49 scenarios passed. `aliases.feature` covers the terminal turn through the new stream wrapper.
- `npm run check:features`, `npm run typecheck`, `npm run lint`, and `npm run fallow`: all exit 0.
- Extra spot-check: the builtin profile on `features/hook/tool-use.feature` and `features/hook/mcp-tool-names.feature` passed 5 scenarios. These are scripted `@mcp` turns through the wrapper under Pi's built-in MCP.
- Each commit's hook ran `npm run check:commit` and passed.
- The full `npm run check` is left to the orchestrator's wave gate.

## Decisions Made

- The carrier field is removed from every forwarded event: the partials, the error message, and the done message. The plan says only the done message is patched and other events pass through unchanged. The faux core's partials are copies of the scripted message, though, and Pi's agent loop puts the partial in its context while the call streams. Stripping the field from every event keeps the truth "removed before Pi sees the message" exact. Events of a call without the field are shallow copies with the same content.
- TOOL-01 installs `demo@fixtures` in the user scope. The list tool counts installed plugins (`Object.keys(mp.plugins).length`, D-09), so a seed with no install would pin `0 plugin(s)`, which a counter that always returns 0 also passes.
- TOOL-03 publishes no marketplace: Pi refuses the arguments before the tool runs.

## Deviations from Plan

None that change behavior. The two seed and wrapper choices above go a little past the plan's wording, and they are listed under Dubious Choices.

## Issues Encountered

- The worktree guard refuses a heredoc-fed `python3` whose body it cannot verify. Edit scripts were written to the scratchpad with the Write tool and run from there.
- ESLint's `switch-exhaustiveness-check` does not accept a `default` arm on the `AssistantMessageEvent` union, so `forwardedEvent` uses two `if` statements.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-1-07 is mitigated: the context tokens ride on the call's own message, the wrapper strips them from every event, and no module state holds them. T-1-08 is mitigated: the projector anchors on the quoted tool name, keeps only parameter paths, and throws on unreadable text.

## Dubious Choices

1. **Carrier stripped from every event, not only `done`.** The plan says "every other event ... passes through unchanged". I strip the field from the partials and the error messages too, because Pi's agent loop holds the partial while the call streams. The cost is a shallow copy of every event.
2. **TOOL-01 installs the plugin.** The plan lists only "the marketplace `fixtures` with plugin `demo` added to the user scope". I added `Given the user has run "/claude:plugin install demo@fixtures --scope user"` so the count is 1, which makes the plan's wrong-count red proof discriminating.
3. **The PCOMP-01 seed pins Pi's compaction summary framing.** The `compact summary` cell is `No prior history.\n\n---\n\n**Turn Context (split turn):**\n\nSummary A.`, and the frame around `Summary A.` is Pi's wording. The plan asked for the whole row "as in the manual compaction scenario of `features/hook/session.feature`", which pins the same text. The prohibition names the summarization prompt, not the summary, but a Pi release that rewords this frame would break both scenarios. Phase 5 may want a projection.
4. **The projector anchors on structure.** It matches a first line that quotes the tool name and ends with `:`, and reads paths only before the first blank line. It deduplicates the paths (one path can fail several union branches) and sorts them with `localeCompare`. Pi's other refusal, `Invalid arguments for tool "<name>": <parse error>`, does not end with `:`, so it passes through unprojected. Pi's `Tool "<name>" not found` passes through the same way.
5. **Parser refusal wording.** The old message `needs a reply and no arguments` became `needs exactly one of a reply, a tool, or an error`, plus the new messages `has arguments but no tool` and `sets <columns>, which only a reply takes`. No scenario states these messages.
6. **`context tokens` syntax.** The column accepts only a decimal positive integer (`/^[1-9]\d*$/` and a safe integer). The validator mirrors this with `Type.Integer({ minimum: 1 })`.
7. **Red-proof evidence for PCOMP-01's unused summary step.** It is inferred from the single call, not from a reported failure, because the After check that reports unused steps runs only for passing scenarios.

## User Setup Required

None.

## Next Phase Readiness

The scripted-model and upstream libraries now hold everything Phases 3, 5, and 10 need for StopFailure, automatic compaction, and the model tools. Ready for 01-04.

## Self-Check: PASSED

- FOUND: features/hook/stop-failure.feature, features/hook/compaction.feature, features/plugin/model-tools.feature
- FOUND: b206cd4a, d6b0038e, 4c1edaff (ancestors of HEAD)
- Acceptance: `Feature: Hook stop failure`, `Feature: Hook compaction`, and `Feature: Plugin model tools` head their files. `errorMessage` and `createAssistantMessageEventStream` are in extension.ts, `context tokens` is in script.ts, and `export function projectArgumentValidationFailure` is in pi.ts. model-tools.feature has 2 scenarios and 0 `Validation failed` lines.
