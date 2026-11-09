# Phase 3: StopFailure Hooks - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning
**Mode:** autonomous smart discuss in a child session; the user asked for the recommended answer on every question, so each decision below is the recommendation, auto-accepted. Every decision that changes what a user sees is also a `P3-DC` entry in `DUBIOUS-CHOICES.md`.

<domain>
## Phase Boundary

Phase 3 adds the behavioral coverage of `StopFailure` hooks (STOPF-01) to `features/hook/stop-failure.feature`, which Phase 1 seeded with one scenario. The scenarios pin, against Claude Code's contract: a turn that ends in a provider error runs the plugin's `StopFailure` hooks once with Claude Code's payload; matchers select the hooks by error type; a normal turn runs no `StopFailure` hook and an error turn runs no `Stop` hook; a `StopFailure` hook's output and exit code change nothing; and the next prompt gets a normal turn.

Research against Claude Code 2.1.319 found three parity bugs in the StopFailure arm. Phase 3 fixes them in its own files, each with a scenario that fails without the fix (D-BG-301 to D-BG-303). It changes no other hook event's behavior.

</domain>

<decisions>
## Implementation Decisions

### Upstream evidence (claude-code-compat-research)

The phase touches the upstream contract: a hook event's payload, matcher, and lifecycle. Evidence came from the binary `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.319/claude` (grepped 2026-11-08) and from https://code.claude.com/docs/en/hooks (read 2026-11-08).

1. **When StopFailure runs, and whether Stop also runs.** Claude Code runs StopFailure *instead of* Stop when the turn ends in an API error. In the binary, the turn loop's `if(R?.isApiErrorMessage){ ... return W8e(Z??R,T),{reason:"api_error",...}}` returns before the Stop-hook step (`Ea` -> `Jd`). `W8e` is `executeStopFailureHooks`. The docs say: "Runs instead of Stop when the turn ends due to an API error", and under Stop, "API errors fire StopFailure instead." The other StopFailure call sites (autocompact thrashing, prompt too long after a failed compaction, a malformed tool call after its retry, an empty completion after its retry) all `return` without Stop too. **Confidence: high.** The bridge already does this: `settle.ts` routes `error` and `length` endings to StopFailure and `stop` to Stop (STOP-01, SFAIL-01).
2. **Output and exit code.** Claude Code ignores them. The binary's event table says "Fire-and-forget — hook output and exit codes are ignored." `kTn` leaves Stop, SubagentStop, and StopFailure out of the exit-2 block arm. The docs list StopFailure with "No decision control" and say: "Claude Code ignores your JSON on any exit code, apart from side-effect fields like `terminalSequence`". **Confidence: high.** The bridge discards every outcome (SFAIL-01) and drops a `systemMessage` with a debug line (D-CF5-14). `terminalSequence` is a documented Pi gap ("no Pi surface to render it").
3. **Payload.** `RKr` builds `{...common fields, hook_event_name:"StopFailure", error:h, error_details:e.errorDetails, last_assistant_message:s}`, where `h = e.error ?? "unknown"` and `s = <the error message's text blocks joined by "\n">.trim() || void 0`. So `last_assistant_message` is left out when the error text is empty. The docs call it "The rendered error text shown in the conversation" and mark it optional. **Confidence: high.** The bridge sends `last_assistant_message: ""` on a `length` ending. That is a parity bug (D-BG-303). `error_details` is optional upstream. Pi's assistant message carries only `errorMessage`, so the bridge never sends it (SFAIL-02, a Pi gap).
4. **Error-type vocabulary.** The payload schema enum in 2.1.319 (`ia`) holds 13 values: `authentication_failed`, `oauth_org_not_allowed`, `account_on_hold`, `verification_required`, `billing_error`, `rate_limit`, `overloaded`, `invalid_request`, `model_not_found`, `server_error`, `unknown`, `max_output_tokens`, `cloud_credential_error`. The event table's `matcherMetadata.values` lists the same 13, with `account_on_hold` shown only behind a feature check (`edn()`). The docs list 12 (no `verification_required`), and say `cloud_credential_error` arrived in v2.1.267. **Confidence: high** for the 12 in the docs, **medium-high** for `verification_required` (in the binary's schema and matcher list, absent from the docs). The bridge's closed set (SFAIL-03, D-88-02, taken from an older release) holds 10. The three missing values are dropped as `closed-set`, so a plugin that matches on one installs only as `partially-available`. That is a parity bug (D-BG-301).
5. **Matcher syntax.** The binary's matcher parser `Plt` reads a matcher made only of `[a-zA-Z0-9_|]` as a `|` list of exact names. Any other matcher is a JavaScript regular expression. The docs: "`FileChanged` and `StopFailure` use a narrower exact-match set of letters, digits, `_`, and `|` only. A hyphen, space, or comma in a matcher for those two events keeps it on the regular-expression path, and only `|` separates alternatives." **Confidence: high.** The bridge compares the whole matcher string with the closed set, so `rate_limit|overloaded` is dropped as `closed-set`. A comment in `hook-events.ts` records this ("no pipe-OR splitting"), but no decision ID licenses it, so it is a parity bug (D-BG-302). Regex matchers stay unsupported for every event (MATCH-V2-01, a recorded deferral).
6. **How errors map to types.** Upstream classifies by HTTP status and error body: 401/403 to `authentication_failed`, 429 to `rate_limit`, 529 or `overloaded_error` to `overloaded`, 5xx to `server_error`, 400 to `invalid_request` (prompt too long included), a missing model to `model_not_found`, credit and billing to `billing_error`. A truncated response goes to `max_output_tokens` after recovery fails. Pi gives the bridge only the rendered `errorMessage` and the stop reason. So the bridge classifies by substring (D-88-02, recorded), and maps `length` to `max_output_tokens`. **Confidence: medium.** The binary has many classification sites, and the table above is the main one. No change: the scenarios pin the D-88-02 table on one representative message per type (D-BG-304).

### StopFailure parity fixes (D-BG-301 to D-BG-303)

- **D-BG-301: the StopFailure error vocabulary is Claude Code 2.1.319's 13 values.** Append `account_on_hold`, `verification_required`, and `cloud_credential_error` at the end of `STOP_FAILURE_ERROR_TYPES` in `domain/components/hook-events.ts`. The tuple's order stays as it is, and the new values go last. A matcher that names one of them is admitted, so the plugin installs `available`. The classifier never produces them, because Pi reports no such error. `oauth_org_not_allowed` is the precedent. `docs/hooks-compatibility.md`'s StopFailure matcher row lists the 13 values. Rejected: following the docs' 12 values. The binary's payload schema is the stronger evidence, and an extra admitted value only means a matcher that never fires. Leaving it out means a plugin that installs only with `--partial`.
- **D-BG-302: a StopFailure matcher is a `|` list of exact error types, as Claude Code reads it.** A matcher made only of letters, digits, `_`, and `|` is split on `|`. Empty alternatives are dropped, as upstream's `.filter(Boolean)` does. The group is admitted when at least one alternative is a vocabulary member. It fires when the classified error equals any alternative, compared exactly and case-sensitively. Any other non-empty matcher keeps today's `closed-set` drop. That drop covers a list whose alternatives are all outside the vocabulary, and a regex-path matcher (MATCH-V2-01). `""` and `"*"` stay match-all. This is StopFailure's own code path:
  - a new StopFailure case in `domain/components/hooks/partition.ts` for parse time;
  - a StopFailure predicate that `settle.ts`'s `runStopFailure` uses in place of the shared `matcherFiresOnClosedSetValue`, for dispatch time;
  - one helper that both read, placed next to the vocabulary in `hook-events.ts`. Domain code cannot import a bridge.

  `NON_TOOL_EVENT_CLOSED_SETS`, `matcherFiresOnClosedSetValue`, and the other closed-set events stay unchanged. SessionStart, SessionEnd, PreCompact, and PostCompact have the same pipe gap, and upstream also accepts `,` for them. That fix is a shared-module change, so it goes to the parent as a parent line and a dubious choice, not into this phase.
- **D-BG-303: `last_assistant_message` is Pi's error text, trimmed, and left out when it is empty, as Claude Code builds it.** A `length` ending has no error text, so its payload has no `last_assistant_message`. `StopFailureEvent` and `StopFailureStdin` make the field optional, and `runStopFailure` sets it only when the trimmed `errorMessage` is non-empty. `docs/hooks-compatibility.md`'s `last_assistant_message` row changes its StopFailure half only. Rejected: sending the truncated reply text. Upstream's field holds error text, not conversational output.

### Scenario design (D-BG-304)

- **D-BG-304: the scenarios pin the D-88-02 classifier on one representative message per type that Pi can produce, and keep away from Pi's own recovery paths.** Each message carries the status code that a real provider message carries:
  - `Authentication failed (401)` gives `authentication_failed` (the seed's message);
  - `Rate limit reached (429)` gives `rate_limit`;
  - `Overloaded (529)` gives `overloaded`;
  - `Internal server error (500)` gives `server_error`;
  - `Invalid request (400)` gives `invalid_request`;
  - a model-not-found message gives `model_not_found`;
  - Anthropic's credit-balance text, which contains "Billing", gives `billing_error`;
  - a message that matches nothing gives `unknown`;
  - a reply with stop reason `length` gives `max_output_tokens`.

  No message may match Pi's context-overflow patterns (`prompt is too long`, `too many tokens`, `token limit exceeded`, a leading `413`, and the rest). Those start Pi's compact-and-retry and make extra model calls. The profile Pi turns auto retry off (`set_auto_retry false`), so a retryable message (429, 529, 5xx) is one call. A `length` reply below `faux-1`'s `maxTokens` takes Pi's recoverable-length path. With the default `keepRecentTokens`, a one-turn session has nothing to compact, so Pi makes no extra call. The executor confirms this on its first run. If a message makes an extra call, the executor rewords the message and records a deviation. It does not add a script step to absorb the call.
- Every new scenario has no MCP surface, so it carries no implementation tag and runs once, under `adapter` (D-BG-04).
- The scenarios to write (the planner may merge or split them; every one fails without the behavior it names, with the red proof in the plan SUMMARY):
  1. The seed ("A turn the model ends in an authentication error runs the StopFailure hook") stays, with its whole payload row.
  2. A Scenario Outline over the classified types above: a hook whose matcher names the turn's type runs, with the full payload row, and a hook whose matcher names another type does not run. This covers criteria 1 and 2.
  3. A reply cut off at the output limit (`length`) runs the StopFailure hook with `max_output_tokens` and no `last assistant message` column (D-BG-303).
  4. An error turn runs the StopFailure hook and not the plugin's Stop hook. A normal turn runs the Stop hook and not the StopFailure hook. These are two scenarios, because the payload columns differ (criterion 3).
  5. On an error turn, a StopFailure hook that exits 2 with stderr, one that prints a block decision with a `systemMessage` and `additionalContext`, and a failing hook with `on failure: block` all run. The hooks show the user no messages, and the model gets no further call (criterion 4).
  6. After such an error turn, the next prompt gets a normal turn. The model receives the call, and the plugin's Stop hook records `stop hook active: false`, so the StopFailure block set no loop state (criterion 4).
  7. A Scenario Outline over all 13 error types: `/claude:plugin info` on a plugin whose StopFailure hook names that type shows it `available`, with the hook listed (D-BG-301). Another scenario covers a type that Claude Code does not send: it shows the plugin `partially-available` with `unsupported hooks`. That drop is D-58-06's never-fire rule.
  8. A StopFailure matcher that lists types with `|` installs `available` and runs on a listed type, and a hook that names another type does not run (D-BG-302).
- New steps go only in the reserved verb module `features/step_definitions/hook/stop-failure.steps.ts`, and only if the existing shared and topic steps cannot state a scenario. Do not create the module empty. The seed's shared steps stay in use.

### Claude's Discretion

- The helper's name and signature for D-BG-302, and whether partition's StopFailure case calls it directly or through a small condition function. It must stay a new code path for StopFailure, without reshaping `nonToolMatcherCondition`'s existing lines.
- The exact model-not-found, billing, and unknown messages, as long as each classifies as stated and stays off Pi's overflow patterns.
- How the plans split. Suggested: Wave 1, coverage of the behavior that exists today (scenarios 1, 2, 4, 5, and 6), with red proofs made by a temporary local break of the product, never committed. Wave 2, the three parity fixes, each scenario red first and then fixed (scenarios 3, 7, and 8, plus docs rows and unit pairs). Both plans edit `hook/stop-failure.feature`, so they cannot share a wave.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- Seed: `features/hook/stop-failure.feature`, one scenario, common steps only, with the `error` column of `the scripted model plays these steps:` (`features/step_definitions/model.steps.ts`).
- Scripted model: `features/lib/scripted-model/{script,extension}.ts`. A row is a `reply`, a `tool`, or an `error`. A reply may set `stop reason` `length`, or `context tokens`.
- Hooks table (`features/lib/hook-files.ts`): columns `name | event | matcher`, then optional `form` (`script` is needed for behavior), `output`, `stderr`, `exit code`, `on reentry`, `on failure`, `timeout`, and others.
- Hook steps: `the hooks record these runs:` and `... in any order:`, and `the hooks record no runs` (`hook/runs.steps.ts`). `the hooks show the user these messages:` and `... no messages` (`hook/messages.steps.ts`). `the model receives these calls:` (`model.steps.ts`). `the user prompts {string}` (`session.steps.ts`). `the user has prompted {string}` (`hook/session.steps.ts`). `the user runs {string}` with `the result has these fields:` (`command.steps.ts`). The info scenarios in `features/hook/configuration.feature` are the pattern for `plugin components hooks` and `plugin status`.
- The runs table compares whole records. A stdin field that a stated table does not name shows up as an extra column, and a record that lacks a stated field changes the header. So D-BG-303's omission is observable as a missing `last assistant message` column.

### Established Patterns

- StopFailure product path: `bridges/hooks/settle.ts` (`settleHandlerFor` dispatches `error`/`length` to `runStopFailure`, which uses `matcherFiresOnClosedSetValue`); `bridges/hooks/payloads/stop-failure.ts` (`translateStopFailure`, `classifyStopFailure`, and the D-88-02 `CLASSIFIER_TABLE`); `domain/components/hook-events.ts` (`STOP_FAILURE_ERROR_TYPES`, `NON_TOOL_EVENT_CLOSED_SETS.StopFailure`); `domain/components/hooks/partition.ts` (`nonToolMatcherCondition` drops a non-member as `closed-set`).
- Unit pairs: `test/bridges/hooks/payloads/stop-failure.test.ts` (owned); the StopFailure cases of `test/bridges/hooks/settle.test.ts`, `test/domain/components/hook-events.test.ts`, and `test/domain/components/hooks/partition.test.ts` (shared files, StopFailure rows only). Every pair keeps 100% direct coverage.
- `docs/hooks-compatibility.md`: Phase 3 edits only the StopFailure event row, the StopFailure error-type matcher row, and the StopFailure half of the `last_assistant_message` row.

### Integration Points

- Pi 1.5.0: `agent_end` caches the last assistant message, and `agent_settled` dispatches. The profile Pi has auto retry off (`features/support/world.ts`, `set_auto_retry`). Pi's `_checkCompaction` runs the context-overflow and recoverable-length paths before `agent_settled`.

</code_context>

<specifics>
## Specific Ideas

- Upstream's docs example payload is `{"hook_event_name":"StopFailure","error":"rate_limit","error_details":"429 Too Many Requests","last_assistant_message":"API Error: Rate limit reached"}`. Pi has no separate detail text, so the bridge's payload never has `error_details` (SFAIL-02), and the seed's table pins that the column is absent.
- Parent lines expected at the end of the phase:
  - CHANGELOG: StopFailure matchers accept Claude Code's newer error types and `|` lists, and `last_assistant_message` is left out when Pi reports no error text.
  - BACKLOG: `|` (and `,`) lists for the SessionStart, SessionEnd, PreCompact, and PostCompact matchers.
  - PROJECT.md Key Decisions: rows for D-BG-301 to D-BG-304.

</specifics>

<deferred>
## Deferred Ideas

- `|` and `,` matcher lists for the other closed-set events (SessionStart, SessionEnd, PreCompact, PostCompact). Upstream accepts both, and the bridge drops them as `closed-set`. This is a shared-module change: a parent line and a dubious choice.
- Upstream does not await StopFailure hooks. `W8e` runs fire-and-forget, so the turn ends while they run. The bridge awaits them inside its `agent_settled` handler. No scenario observes the difference today. A slow-hook scenario would depend on timing.
- `asyncRewake` and plain `async` StopFailure hooks: today the settle path degrades an `asyncRewake` entry to a no-op. This is Phase 2's scope (the async branches).
- Upstream skips StopFailure inside a subagent context (`Xs(n.agentContext)`). Hooks in pi-subagents children are outside this phase.
- A bare context-overflow message without a status code (`prompt is too long: ...`) classifies as `unknown`, where upstream reports `invalid_request`. Real provider messages carry `400`, which the D-88-02 table already maps to `invalid_request`, and Pi recovers from an overflow before the turn ends. So no change.
- `terminalSequence`: a Pi gap, already documented.

</deferred>
