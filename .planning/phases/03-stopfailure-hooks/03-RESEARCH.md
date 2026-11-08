# Phase 3: StopFailure Hooks - Research

**Researched:** 2026-11-08
**Domain:** Claude Code `StopFailure` hook parity in the Pi hooks bridge, plus cucumber behavioral coverage
**Confidence:** HIGH (every scenario shape below was run as a probe against the real profile Pi in this worktree; upstream evidence comes from CONTEXT.md, already verified against Claude Code 2.1.319)

## Summary

The bridge already runs StopFailure correctly for the main cases. A provider error ends the turn, `agent_settled` routes `error`/`length` to `runStopFailure`, the hook gets the classified `error` and Pi's error text, Stop hooks stay silent, and the outcome is discarded. Probes in this session confirm all of this end to end: each of the eight D-BG-304 error messages makes exactly one model call and records exactly one StopFailure run with the expected `error`. No Stop, PreCompact, or PostCompact run happens. A `length` reply also makes one call and no compaction run. Hooks that exit 2, print a block JSON with `systemMessage`/`additionalContext`, or fail with `on failure: block` all run, show the user nothing, and add no model call. The next prompt gets a normal turn, and its Stop hook records `stop hook active: false`.

The three parity bugs are real and each has a probe-verified red row. D-BG-301: `account_on_hold`, `verification_required`, and `cloud_credential_error` make `info` report `partially-available` with `unsupported hooks`. D-BG-302: `rate_limit|overloaded` is refused by a plain install. After `--partial`, the hook never runs on a 429 turn. D-BG-303: a `length` turn records an extra `last assistant message` column with an empty value.

The product fixes are small. Each one touches one owned file and adds one new case or row to three shared files. One trap is not visible from CONTEXT.md. If `settle.ts` stops importing `matcherFiresOnClosedSetValue` ("in place of" in D-BG-302), that export loses its only production consumer, and `fallow dead-code` (production mode) fails. Recommendation: settle's new StopFailure predicate *composes* the shared one, so `dispatch.ts` stays untouched.

**Primary recommendation:** Write the scenarios using only existing steps (no `hook/stop-failure.steps.ts` is needed). Put one helper `stopFailureMatcherTypes(rawMatcher)` in `domain/components/hook-events.ts`. Call it from a new StopFailure case in `partition.ts` and from a file-private predicate in `settle.ts` that ORs it with `matcherFiresOnClosedSetValue`. Make `last_assistant_message` optional in `stop-failure.ts`, and set it in `runStopFailure` only when the trimmed text is non-empty.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Upstream evidence (claude-code-compat-research)

The phase touches the upstream contract: a hook event's payload, matcher, and lifecycle. Evidence came from the binary `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.319/claude` (grepped 2026-11-08) and from https://code.claude.com/docs/en/hooks (read 2026-11-08).

1. **When StopFailure runs, and whether Stop also runs.** Claude Code runs StopFailure *instead of* Stop when the turn ends in an API error. In the binary, the turn loop's `if(R?.isApiErrorMessage){ ... return W8e(Z??R,T),{reason:"api_error",...}}` returns before the Stop-hook step (`Ea` -> `Jd`). `W8e` is `executeStopFailureHooks`. The docs say: "Runs instead of Stop when the turn ends due to an API error", and under Stop, "API errors fire StopFailure instead." The other StopFailure call sites (autocompact thrashing, prompt too long after a failed compaction, a malformed tool call after its retry, an empty completion after its retry) all `return` without Stop too. **Confidence: high.** The bridge already does this: `settle.ts` routes `error` and `length` endings to StopFailure and `stop` to Stop (STOP-01, SFAIL-01).
2. **Output and exit code.** Claude Code ignores them. The binary's event table says "Fire-and-forget — hook output and exit codes are ignored." `kTn` leaves Stop, SubagentStop, and StopFailure out of the exit-2 block arm. The docs list StopFailure with "No decision control" and say: "Claude Code ignores your JSON on any exit code, apart from side-effect fields like `terminalSequence`". **Confidence: high.** The bridge discards every outcome (SFAIL-01) and drops a `systemMessage` with a debug line (D-CF5-14). `terminalSequence` is a documented Pi gap ("no Pi surface to render it").
3. **Payload.** `RKr` builds `{...common fields, hook_event_name:"StopFailure", error:h, error_details:e.errorDetails, last_assistant_message:s}`, where `h = e.error ?? "unknown"` and `s = <the error message's text blocks joined by "\n">.trim() || void 0`. So `last_assistant_message` is left out when the error text is empty. The docs call it "The rendered error text shown in the conversation" and mark it optional. **Confidence: high.** The bridge sends `last_assistant_message: ""` on a `length` ending. That is a parity bug (D-BG-303). `error_details` is optional upstream. Pi's assistant message carries only `errorMessage`, so the bridge never sends it (SFAIL-02, a Pi gap).
4. **Error-type vocabulary.** The payload schema enum in 2.1.319 (`ia`) holds 13 values: `authentication_failed`, `oauth_org_not_allowed`, `account_on_hold`, `verification_required`, `billing_error`, `rate_limit`, `overloaded`, `invalid_request`, `model_not_found`, `server_error`, `unknown`, `max_output_tokens`, `cloud_credential_error`. The event table's `matcherMetadata.values` lists the same 13, with `account_on_hold` shown only behind a feature check (`edn()`). The docs list 12 (no `verification_required`), and say `cloud_credential_error` arrived in v2.1.267. **Confidence: high** for the 12 in the docs, **medium-high** for `verification_required` (in the binary's schema and matcher list, absent from the docs). The bridge's closed set (SFAIL-03, D-88-02, taken from an older release) holds 10. The three missing values are dropped as `closed-set`, so a plugin that matches on one installs only as `partially-available`. That is a parity bug (D-BG-301).
5. **Matcher syntax.** The binary's matcher parser `Plt` reads a matcher made only of `[a-zA-Z0-9_|]` as a `|` list of exact names. Any other matcher is a JavaScript regular expression. The docs: "`FileChanged` and `StopFailure` use a narrower exact-match set of letters, digits, `_`, and `|` only. A hyphen, space, or comma in a matcher for those two events keeps it on the regular-expression path, and only `|` separates alternatives." **Confidence: high.** The bridge compares the whole matcher string with the closed set, so `rate_limit|overloaded` is dropped as `closed-set`. A comment in `hook-events.ts` records this ("no pipe-OR splitting"), but no decision ID licenses it, so it is a parity bug (D-BG-302). Regex matchers stay unsupported for every event (MATCH-V2-01, a recorded deferral).
6. **How errors map to types.** Upstream classifies by HTTP status and error body: 401/403 to `authentication_failed`, 429 to `rate_limit`, 529 or `overloaded_error` to `overloaded`, 5xx to `server_error`, 400 to `invalid_request` (prompt too long included), a missing model to `model_not_found`, credit and billing to `billing_error`. A truncated response goes to `max_output_tokens` after recovery fails. Pi gives the bridge only the rendered `errorMessage` and the stop reason. So the bridge classifies by substring (D-88-02, recorded), and maps `length` to `max_output_tokens`. **Confidence: medium.** The binary has many classification sites, and the table above is the main one. No change: the scenarios pin the D-88-02 table on one representative message per type (D-BG-304).

#### StopFailure parity fixes (D-BG-301 to D-BG-303)

- **D-BG-301: the StopFailure error vocabulary is Claude Code 2.1.319's 13 values.** Append `account_on_hold`, `verification_required`, and `cloud_credential_error` at the end of `STOP_FAILURE_ERROR_TYPES` in `domain/components/hook-events.ts`. The tuple's order stays as it is, and the new values go last. A matcher that names one of them is admitted, so the plugin installs `available`. The classifier never produces them, because Pi reports no such error. `oauth_org_not_allowed` is the precedent. `docs/hooks-compatibility.md`'s StopFailure matcher row lists the 13 values. Rejected: following the docs' 12 values. The binary's payload schema is the stronger evidence, and an extra admitted value only means a matcher that never fires. Leaving it out means a plugin that installs only with `--partial`.
- **D-BG-302: a StopFailure matcher is a `|` list of exact error types, as Claude Code reads it.** A matcher made only of letters, digits, `_`, and `|` is split on `|`. Empty alternatives are dropped, as upstream's `.filter(Boolean)` does. The group is admitted when at least one alternative is a vocabulary member. It fires when the classified error equals any alternative, compared exactly and case-sensitively. Any other non-empty matcher keeps today's `closed-set` drop. That drop covers a list whose alternatives are all outside the vocabulary, and a regex-path matcher (MATCH-V2-01). `""` and `"*"` stay match-all. This is StopFailure's own code path:
  - a new StopFailure case in `domain/components/hooks/partition.ts` for parse time;
  - a StopFailure predicate that `settle.ts`'s `runStopFailure` uses in place of the shared `matcherFiresOnClosedSetValue`, for dispatch time;
  - one helper that both read, placed next to the vocabulary in `hook-events.ts`. Domain code cannot import a bridge.

  `NON_TOOL_EVENT_CLOSED_SETS`, `matcherFiresOnClosedSetValue`, and the other closed-set events stay unchanged. SessionStart, SessionEnd, PreCompact, and PostCompact have the same pipe gap, and upstream also accepts `,` for them. That fix is a shared-module change, so it goes to the parent as a parent line and a dubious choice, not into this phase.
- **D-BG-303: `last_assistant_message` is Pi's error text, trimmed, and left out when it is empty, as Claude Code builds it.** A `length` ending has no error text, so its payload has no `last_assistant_message`. `StopFailureEvent` and `StopFailureStdin` make the field optional, and `runStopFailure` sets it only when the trimmed `errorMessage` is non-empty. `docs/hooks-compatibility.md`'s `last_assistant_message` row changes its StopFailure half only. Rejected: sending the truncated reply text. Upstream's field holds error text, not conversational output.

#### Scenario design (D-BG-304)

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

### Deferred Ideas (OUT OF SCOPE)

- `|` and `,` matcher lists for the other closed-set events (SessionStart, SessionEnd, PreCompact, PostCompact). Upstream accepts both, and the bridge drops them as `closed-set`. This is a shared-module change: a parent line and a dubious choice.
- Upstream does not await StopFailure hooks. `W8e` runs fire-and-forget, so the turn ends while they run. The bridge awaits them inside its `agent_settled` handler. No scenario observes the difference today. A slow-hook scenario would depend on timing.
- `asyncRewake` and plain `async` StopFailure hooks: today the settle path degrades an `asyncRewake` entry to a no-op. This is Phase 2's scope (the async branches).
- Upstream skips StopFailure inside a subagent context (`Xs(n.agentContext)`). Hooks in pi-subagents children are outside this phase.
- A bare context-overflow message without a status code (`prompt is too long: ...`) classifies as `unknown`, where upstream reports `invalid_request`. Real provider messages carry `400`, which the D-88-02 table already maps to `invalid_request`, and Pi recovers from an overflow before the turn ends. So no change.
- `terminalSequence`: a Pi gap, already documented.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STOPF-01 | `StopFailure` hooks run when a turn ends in an error, with Claude Code's payload, and matchers select them by error type. | Probe P1 (8 messages, one call each, exact payload rows), P2 (`length`), P3 (Stop silent on error turn, StopFailure silent on normal turn), P4 (outputs ignored), P5 (next prompt normal), P6/P7 (matcher selection, `\|` lists, vocabulary via `info`). Product paths and unit-test deltas in "Product changes". |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Upstream parity is the default; a divergence needs a recorded decision ID or a Pi gap (AGENTS.md "Upstream parity"). D-BG-301..304 are those IDs here.
- Behavioral tests: a user-visible `/claude:plugin` behavior change ships with a cucumber scenario that fails without it (AGENTS.md "Behavioral tests"); milestone rule: every scenario has a red proof in the plan SUMMARY (ROADMAP "Behavioral tests").
- `npm run check` is the gate at every wave and the phase gate; the phase gate also runs `npm run test:modules` (ROADMAP "Gates"). 100% direct coverage per source-test pair (NFR-6).
- Two independent complexity gates: ESLint `sonarjs/cognitive-complexity` 15 and fallow `health.maxCognitive` 15 / `maxCyclomatic` 20 (CONVENTIONS.md).
- fallow `production.deadCode: true` with entry `extensions/pi-claude-marketplace/index.ts`: an export only tests import is an unused export (CONVENTIONS.md; see Pitfall 1).
- Boundaries: `domain` may import only `shared` and `platform`; `bridges-hooks` may import `domain`, `persistence`, `shared`, `platform` [VERIFIED: .fallowrc.json `boundaries.rules`, printed this session: `{'from': 'bridges-hooks', 'allow': ['domain', 'persistence', 'shared', 'platform']}`, `{'from': 'domain', 'allow': ['shared', 'platform']}`].
- Shared hook files (`settle.ts`, `dispatch.ts`, `hook-events.ts`, `hooks/**`, `docs/hooks-compatibility.md`): add only a new case / function / row for StopFailure; never reshape an existing function or reorder a shared table; docs: StopFailure rows only (ROADMAP "Shared product files").
- Frozen: build/CI files, `features/support/**`, `features/lib/**`, every existing step module, `.agents/skills/cucumber/**`, `platform/pi-api.ts`.
- Never edited by a stream: `CHANGELOG.md`, `README*.md`, PROJECT.md Key Decisions, BACKLOG.md (parent lines instead).
- Comments cite durable IDs (D-BG-30x, SFAIL-0x), never phase/plan numbers (CONVENTIONS.md "Comments").
- Commit titles: no milestone/phase/plan identifiers; follow `.agents/skills/committing/SKILL.md`. Every plan SUMMARY has `## Threat Flags`.
- Tests touching Pi state use the hermetic home (`--import "$PWD/test/platform/isolated-pi-home.ts"`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| StopFailure vocabulary (13 values) | domain (`domain/components/hook-events.ts`) | — | Single source of truth already there; classifier type derives from it |
| `\|`-list matcher reading | domain (`hook-events.ts` helper) | — | Both partition (domain) and settle (bridge) need it; domain cannot import bridges |
| Parse-time admission (available vs partially-available) | domain (`domain/components/hooks/partition.ts`) | orchestrators/plugin/info.ts (renders) | `partitionHooks` is the sole admission gate (only caller `domain/components/hooks.ts:306`) |
| Dispatch-time selection | bridges/hooks (`settle.ts` `runStopFailure`) | `dispatch.ts` `matcherFiresOnClosedSetValue` (composed) | Settle owns turn-boundary dispatch |
| Payload shape (`last_assistant_message` omission) | bridges/hooks (`settle.ts` builds event, `payloads/stop-failure.ts` translates) | — | Translator is a pass-through; settle decides content |
| Behavioral proof | features (`hook/stop-failure.feature`) | existing shared/topic steps | No new step module needed |

## Standard Stack

No new packages. The phase uses what exists:

| Tool | Version | Purpose |
|------|---------|---------|
| `@cucumber/cucumber` (via `npx cucumber-js`) | repo pin | Behavioral scenarios |
| `node:test` + `node:assert/strict` | Node 26.13.0 locally (CI Node 24) | Unit pairs |
| Pi (`@earendil-works/pi-coding-agent`) | 1.5.0 [VERIFIED: node_modules package.json, read this session] | Profile Pi in scenarios |
| Scripted model (`features/lib/scripted-model`) | frozen harness | `error` and `stop reason: length` steps |

## Package Legitimacy Audit

No external packages are installed by this phase. `node scripts/install-test-peers.mjs` (already run once in this worktree this session) installs the repo's pinned optional peers `pi-mcp-adapter@7.0.0 pi-subagents@0.84.0 @quintinshaw/pi-dynamic-workflows@3.15.0` into `node_modules/.cache/optional-peers`; that is existing tooling, not a phase dependency.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Probe Results (ground truth for the planner)

All probes ran in this worktree (`features/hook/zz-probe-stop-failure.feature`, since deleted) with `npx cucumber-js --profile adapter --parallel 3 <file>`, at commit `6f953611`, Node v26.13.0, Pi 1.5.0. Each table below **passed as written**, unless it is marked as today's red output. A passing scenario also passed the world's `After` checks: no unused script step, no call past the script, and the last turn compared [VERIFIED: features/support/world.ts:1161-1195]. So a one-step script that passes proves **exactly one model call**.

Common setup for every runtime probe (verbatim from the seed, `features/hook/stop-failure.feature`):

```gherkin
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      ...
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      ...
    When the user prompts "hello"
```

### P1 (Q1): eight error messages, one call each, exact payload row — PASSED

Hooks: `failure | StopFailure | *`, `stop | Stop | (empty)`, `compact | PreCompact | (empty)`, `after | PostCompact | (empty)`. Script `| reply | error |` / `|  | <message> |`. Both Thens passed for every row. So only the StopFailure hook ran: no Stop, PreCompact, or PostCompact run, and exactly one model call.

```gherkin
    Then the model receives these calls:
      | call | role | text  |
      | 1    | user | hello |
    Then the hooks record these runs:
      | event       | session | error        | last assistant message | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | StopFailure | first   | <error type> | <message>              | {project dir} |                 | failure   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

    Examples:
      | message                                                                                                              | error type            |
      | Authentication failed (401)                                                                                          | authentication_failed |
      | Rate limit reached (429)                                                                                             | rate_limit            |
      | Overloaded (529)                                                                                                     | overloaded            |
      | Internal server error (500)                                                                                          | server_error          |
      | Invalid request (400)                                                                                                | invalid_request       |
      | Model not found (404)                                                                                                | model_not_found       |
      | Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits. | billing_error         |
      | The provider closed the connection                                                                                   | unknown               |
```

Note: the `arguments` column holds the hook's name (the recorder's first argument).

**Proposed wordings (Claude's discretion), each verified by P1:**
- model_not_found: `Model not found (404)`. It matches the table substring `"model not found"` [VERIFIED: bridges/hooks/payloads/stop-failure.ts:100 `["model_not_found", ["model not found", "model_not_found"]],`]. `404` matches no status regex in the table.
- billing_error: `Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.` It matches `"billing"` [VERIFIED: stop-failure.ts:74-84, first entry `"billing"`]. Billing is the first table entry, so it wins even if a status code is present.
- unknown: `The provider closed the connection`. No substring or status regex in `CLASSIFIER_TABLE` matches it [VERIFIED: stop-failure.ts:71-102].
- None of the eight matches Pi's overflow patterns [VERIFIED: node_modules/@earendil-works/pi-ai/dist/utils/overflow.js `OVERFLOW_PATTERNS`, read this session; for example `/prompt (?:is )?too long/i`, `/too many tokens/i`, `/token limit exceeded/i`, `/^(?:[\w -]+ API error \(413\):|413(?:\s|:|$))/i`]. P1's single-call pass is the end-to-end proof.

### P2 (Q2): `length` reply — one call, no compaction, today's red row for D-BG-303

Script: `| reply | stop reason |` / `| The answer is cu | length |`. Same four hooks as P1. `the model receives these calls:` with the single `1 | user | hello` row **passed**. So Pi made no extra call, and no PreCompact or PostCompact run appeared.

The runs table below (the **post-fix** expectation, no `last assistant message` column) **failed today**. The actual header appended `'last assistant message'` as its last column, with value `''`:

```gherkin
    Then the hooks record these runs:
      | event       | session | error             | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | StopFailure | first   | max_output_tokens | {project dir} |                 | failure   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
```

Today's actual output: the same columns plus a trailing `last assistant message` column whose cell is empty. This is the D-BG-303 red proof, with no temporary break needed.

Why no extra call: Pi's `_checkCompaction` treats this as `recoverableLength`. It calls `_omitRecoveryAttempt(assistantMessage)`, then `_runAutoCompaction("overflow", true)`. That returns `false` when `prepareCompaction` finds nothing to compact, before `compaction_start` [VERIFIED: node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js:2455-2491 and 2539-2551, read this session]. So no `session_before_compact` event fires and no PreCompact hook runs. Side effect to know about: `_omitRecoveryAttempt` appends a context edit that removes the truncated reply from later context [VERIFIED: agent-session.js:856-880]. That matters only if a scenario prompts again after a `length` turn. None is planned.

### P3 (Q3, criterion 3): error turn silences Stop; normal turn silences StopFailure — PASSED

- Error turn: P1 already proves it. The Stop hook was declared and did not run.
- Normal turn: hooks `failure | StopFailure | *`, `stop | Stop | (empty)`. Script `| reply |` / `| Hi. |`. Passed:

```gherkin
    Then the hooks record these runs:
      | event | session | last assistant message | stop hook active | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | Stop  | first   | Hi.                    | false            | {project dir} |                 | stop      | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
```

### P4 (Q4, criterion 4): output and exit codes ignored — PASSED

Hooks table (passed as written; `fails` has no stdout, so `on failure: block` would turn exit 1 into a block on any event with decision control):

```gherkin
      | name    | event       | matcher | form   | stderr          | output                                                                                                                                         | exit code | on failure |
      | exits   | StopFailure | *       | script | blocked by hook |                                                                                                                                                | 2         |            |
      | decides | StopFailure | *       | script |                 | {"decision":"block","reason":"retry","systemMessage":"Shown?","hookSpecificOutput":{"hookEventName":"StopFailure","additionalContext":"more"}} |           |            |
      | fails   | StopFailure | *       | script |                 |                                                                                                                                                | 1         | block      |
```

Script `| reply | error |` / `|  | Authentication failed (401) |`. Thens that passed:

```gherkin
    Then the hooks show the user no messages
    Then the model receives these calls:
      | call | role | text  |
      | 1    | user | hello |
    Then the hooks record these runs in any order:
      | event       | session | error                 | last assistant message      | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | StopFailure | first   | authentication_failed | Authentication failed (401) | {project dir} |                 | decides   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | StopFailure | first   | authentication_failed | Authentication failed (401) | {project dir} |                 | exits     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | StopFailure | first   | authentication_failed | Authentication failed (401) | {project dir} |                 | fails     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
```

Use the any-order step: the three hooks run in parallel (D-CF5-09), and the runs log is append-ordered [VERIFIED: features/step_definitions/hook/runs.steps.ts:1-14 header]. `the user prompts` also asserts no `extension_error` or dialog records during the turn [VERIFIED: features/step_definitions/session.steps.ts:56-63, 119].

### P5 (Q3, criterion 4): next prompt after an error turn — PASSED

The same three StopFailure hooks as P4, plus `stop | Stop | (empty) | script`. Script:

```gherkin
    Given the scripted model plays these steps:
      | reply | error                       |
      |       | Authentication failed (401) |
      | Hi.   |                             |
    Given the user has prompted "hello"
    When the user prompts "again"
    Then the model receives these calls:
      | call | role      | text  |
      | 2    | user      | hello |
      | 2    | assistant |       |
      | 2    | user      | again |
    Then the hooks show the user no messages
    Then the hooks record these runs:
      | event | session | last assistant message | stop hook active | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | Stop  | first   | Hi.                    | false            | {project dir} |                 | stop      | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
```

Findings:
- `the user has prompted {string}` accepts an error turn as setup. It asserts only disposition `started`, `aborted === false`, no faults, and no overflowing call [VERIFIED: features/step_definitions/hook/session.steps.ts:252-266]. The error turn settles with `aborted: false`.
- **Pi keeps the failed assistant message in context.** Call 2 carries an `assistant` row with **empty text** (the error step's message has empty content, `fauxAssistantMessage([], { stopReason: "error", errorMessage })` [VERIFIED: features/lib/scripted-model/extension.ts:251-252]). This is Pi's own context building, not the bridge's. The scenario may state it (it is what Pi sends). Or the scenario can skip the calls table, because the one-step-per-call `After` check plus the Stop run's `last assistant message: Hi.` already prove that the model answered. Recommendation: keep the calls table, because criterion 4 says "the model receives the call".
- The Stop run on the second turn records `stop hook active: false`. So no StopFailure outcome (exit 2, block JSON, onFailure block) set loop state.
- The first turn's StopFailure runs are not in the second turn's runs table. `the hooks record these runs:` reads only the logs of the last `the user prompts` window [VERIFIED: runs.steps.ts:125-133; session.steps.ts:101-127].

### P6 (Q5): `/claude:plugin info` rows for the vocabulary — today

Setup: marketplace added (no install). Hooks `failure | StopFailure | <matcher>`. Then `When the user runs "/claude:plugin info demo@fixtures"`.

**Admitted (passed today)** for `rate_limit`, `overloaded`, `authentication_failed`, `oauth_org_not_allowed`, `billing_error`, `invalid_request`, `model_not_found`, `server_error`, `max_output_tokens`, `unknown`, and `*`:

```gherkin
    Then the result has these fields:
      | kind                           | plugin-info               |
      | marketplace details autoupdate | false                     |
      | marketplace name               | fixtures                  |
      | marketplace scope              | project                   |
      | needs reload                   | false                     |
      | plugin components hooks        | [{"event":"StopFailure"}] |
      | plugin components resolved     | true                      |
      | plugin components skills       | demo-skill                |
      | plugin id                      | demo@fixtures             |
      | plugin name                    | demo                      |
      | plugin reasons                 |                           |
      | plugin status                  | available                 |
      | plugin version                 | 1.0.0                     |
      | severity                       | info                      |
```

Note: an admitted non-tool event shows **no matcher** in `plugin components hooks`. The untagged non-tool arm of `HookSummaryEntry` carries none [VERIFIED: shared/concerns/hooks.ts `| { readonly event: Exclude<ClaudeHookEvent, HookSummaryToolEvent> }`].

**Dropped today (actual output)** for `account_on_hold`, `verification_required`, `cloud_credential_error`, `rate_limit|overloaded`, `network_error`, and `Rate_Limit`. These differ from the table above in exactly three rows:

```gherkin
      | plugin components hooks        | [{"kind":"lenient","event":"StopFailure","supported":true}] |
      | plugin reasons                 | unsupported hooks                                           |
      | plugin status                  | partially-available                                         |
```

- Red proof for D-BG-301: the three new values (P3-DC-01) produce the dropped rows today and must produce the admitted rows after the fix.
- Red proof for D-BG-302 (info): `rate_limit\|overloaded` (written with Gherkin's `\|` escape in the table cell) produces the dropped rows today.
- `network_error` (a value outside the vocabulary) and `Rate_Limit` (case differs) stay dropped after the fix. Use one of them for the "type Claude Code does not send" scenario. It passes before and after, so its red proof needs a temporary local break (for example, admitting every matcher in partition).
- After-fix shape for an admitted pipe list or new value: `[{"event":"StopFailure"}]`, `available`, empty reasons, the same as `rate_limit` today. [ASSUMED by analogy, HIGH: the info renderer does not depend on the matcher string for an admitted non-tool group. Confirm on the first green run.]

### P7 (Q5/D-BG-302): matcher selection and `|` lists at runtime

- **Matcher selects (PASSED today):** hooks `limited | StopFailure | rate_limit`, `busy | StopFailure | overloaded`. Error `Rate limit reached (429)`. Only `limited` ran:

```gherkin
    Then the hooks record these runs:
      | event       | session | error      | last assistant message   | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | StopFailure | first   | rate_limit | Rate limit reached (429) | {project dir} |                 | limited   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
```

- **Install of a `|` list without `--partial` (PASSED today, the D-BG-302 red rows):** hooks `either | StopFailure | rate_limit\|overloaded`. `When the user runs "/claude:plugin install demo@fixtures --scope project"`:

```gherkin
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status              | reasons           | hint            |
      | fixtures         | project           | demo@fixtures | demo | partially-available | unsupported hooks | partial-install |
```

- **`|` list after `--partial` (red today):** hooks `either | StopFailure | rate_limit\|overloaded` and `other | StopFailure | server_error\|unknown`, installed with `--partial`, error 429. The expected single `either` run (same columns as above, `arguments` = `either`) **failed**. Today no StopFailure hook runs at all, because both groups were partitioned out. For the planner's scenario 8, use a plain install (`/claude:plugin install demo@fixtures --scope project`). Red: the install step fails today, because `the user has run` asserts success. Green after the fix: `either` runs and `other` does not.

## Architecture Patterns

### System Architecture Diagram

```
plugin hooks.json ──► parseHooksConfig ──► partitionHooks ──► (admitted groups) ──► install / info
                         (domain)          │  matcherCondition                         │
                                           │   ├─ tool events: parseMatcher            ▼
                                           │   ├─ "" / "*": admit             routing table (RoutingEntry.rawMatcher)
                                           │   └─ nonToolMatcherCondition                │
                                           │        ├─ NEW: StopFailure → stopFailureMatcherTypes(raw)
                                           │        │      some ∈ vocabulary ? admit : "closed-set"
                                           │        └─ other closed sets (unchanged)
                                           └─► dropped → info lenient row / "unsupported hooks"

Pi turn ─► agent_end (cache last assistant) ─► agent_settled ─► settleHandlerFor
                                                    ├─ stop      → runStopBucket (Stop hooks, decision control)
                                                    ├─ error/length → classifyStopFailure(errorMessage, stopReason)
                                                    │                 → runStopFailure
                                                    │                     event = { error, [last_assistant_message if trim ≠ ""] }  (NEW omission)
                                                    │                     filter = matcherFiresOnClosedSetValue(entry, err)
                                                    │                              || stopFailureMatcherTypes(raw).includes(err)   (NEW)
                                                    │                     collectBucketOutcomes → hooks run → outcomes DISCARDED
                                                    └─ pending/aborted/toolUse/deferred → nothing
```

### Product changes (Q6), file by file

**1. `extensions/pi-claude-marketplace/domain/components/hook-events.ts` (shared; StopFailure rows only)**
- Today's tuple [VERIFIED: hook-events.ts:207-218]:
  `const STOP_FAILURE_ERROR_TYPES = [ "rate_limit", "overloaded", "authentication_failed", "oauth_org_not_allowed", "billing_error", "invalid_request", "model_not_found", "server_error", "max_output_tokens", "unknown", ] as const;`
  D-BG-301 appends `"account_on_hold"`, `"verification_required"`, `"cloud_credential_error"` after `"unknown"`. `NON_TOOL_EVENT_CLOSED_SETS.StopFailure: new Set<string>(STOP_FAILURE_ERROR_TYPES)` [VERIFIED: hook-events.ts:318] picks them up with no other change.
- New helper next to the tuple (name at the planner's discretion). Recommended:
  ```ts
  // D-BG-302: Claude Code reads a StopFailure matcher made only of letters,
  // digits, `_`, and `|` as a `|` list of exact error types, empty
  // alternatives dropped; any other matcher takes its regex path (MATCH-V2-01).
  const STOP_FAILURE_LIST_MATCHER = /^[A-Za-z0-9_|]+$/;

  export function stopFailureMatcherTypes(rawMatcher: string): readonly string[] {
    return STOP_FAILURE_LIST_MATCHER.test(rawMatcher)
      ? rawMatcher.split("|").filter((type) => type !== "")
      : [];
  }
  ```
  `[ASSUMED]` name and shape. Cognitive complexity is about 1. The regex is anchored and uses a single character class, so it runs in linear time with no ReDoS.
- Comments to update (owned StopFailure rows only): lines 181-187 (the `[ASSUMED -- field-name label]` note; upstream now confirms the field is `error`, CONTEXT evidence 3), lines 292-298 ("closed 10-value set ... no pipe-OR splitting"), and lines 314-317 ("Exact whole-string membership only -- no pipe-OR splitting").

**2. `extensions/pi-claude-marketplace/domain/components/hooks/partition.ts` (shared; new case only)**
- Today [VERIFIED: partition.ts:47-57]:
  ```ts
  function nonToolMatcherCondition(event: Exclude<BucketAEvent, ToolEvent>, rawMatcher: string): MatcherCondition | null {
    if (NON_TOOL_EVENT_FIELDS[event] === null) { return "no-matcher-support"; }
    const closedSetEvent = event as keyof typeof NON_TOOL_EVENT_CLOSED_SETS;
    return NON_TOOL_EVENT_CLOSED_SETS[closedSetEvent].has(rawMatcher) ? null : "closed-set";
  }
  ```
  `matcherCondition` handles `""`/`"*"` before it calls this [VERIFIED: partition.ts:64-66].
- Recommended: a new file-private `stopFailureMatcherCondition(rawMatcher)` that returns `stopFailureMatcherTypes(rawMatcher).some((type) => NON_TOOL_EVENT_CLOSED_SETS.StopFailure.has(type)) ? null : "closed-set"`. Call it from a new first branch `if (event === "StopFailure") { return stopFailureMatcherCondition(rawMatcher); }`, inserted in `nonToolMatcherCondition` above the existing lines. The existing lines stay unchanged. `"closed-set"` stays the drop condition, a member of the `cond` union [VERIFIED: partition.ts:20 `cond: "regex" | "unmapped-tool" | "no-matcher-support" | "closed-set";`].
- `partitionHooks` is the only admission gate. Its only production caller is `domain/components/hooks.ts:306` [VERIFIED: grep this session]. No other product code checks a StopFailure matcher against the closed set.

**3. `extensions/pi-claude-marketplace/bridges/hooks/settle.ts` (shared; StopFailure arm only)**
- Today [VERIFIED: settle.ts:402-405 and 417-425]:
  ```ts
  const event: StopFailureEvent = { error: classifiedError, last_assistant_message: last.errorMessage ?? "" };
  ...
  (entry) => matcherFiresOnClosedSetValue(entry, classifiedError),
  ```
- D-BG-303: `const errorText = (last.errorMessage ?? "").trim();` then `{ error: classifiedError, ...(errorText === "" ? {} : { last_assistant_message: errorText }) }`.
- D-BG-302 predicate: add a file-private `stopFailureMatcherFires(entry, error)` = `matcherFiresOnClosedSetValue(entry, error) || stopFailureMatcherTypes(entry.rawMatcher).includes(error)`. **Keep the `matcherFiresOnClosedSetValue` import** (Pitfall 1). The doc comment at settle.ts:407-416 ("the parse-time gate admits only match-all ... exact members") needs updating.
- `classifyStopFailure` (settle.ts:172-181) is unchanged. `hookDebugLog` for `unknown` stays.

**4. `extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts` (owned)**
- Today [VERIFIED: stop-failure.ts:16-51]: `readonly last_assistant_message: string;` in both `StopFailureStdin` and `StopFailureEvent`, and the translator sets `last_assistant_message: event.last_assistant_message,` unconditionally.
- Make the field optional in both interfaces. The translator spreads it conditionally, the same way it already spreads `error_details`: `...(event.error_details !== undefined ? { error_details: event.error_details } : {})` [VERIFIED: stop-failure.ts:48]. Keep the translator a pass-through. Settle decides the content.
- Update the comments that say "closed 10-value" (lines 8 and 112) to 13.
- `classifyStopFailure` and `CLASSIFIER_TABLE` stay unchanged (D-BG-304, P3-DC-04).

**5. `docs/hooks-compatibility.md` (shared; StopFailure rows only)**
- Line 22 (event row): `fires on error / length endings; observation-only (output/exit code ignored)`. This is still accurate, so leave it unless the planner wants to cite D-BG-30x.
- Line 127 (matcher row) today: `closed 10-value set: rate_limit, ... unknown; exact whole-string match against the closed set (no case-folding, no pipe-OR splitting; any other value drops the group as closed-set)`. Rewrite it to list the 13 values and say that a matcher of only letters, digits, `_`, and `|` is a `|` list of exact, case-sensitive types (admitted when at least one is in the set). Any other matcher drops the group as `closed-set` (MATCH-V2-01).
- Line 249 (`last_assistant_message`) StopFailure half today: `StopFailure: Pi's rendered error text (errorMessage; empty on length endings)`. Change it to: trimmed error text, left out when empty (a `length` ending).
- No test or script reads this file [VERIFIED: `grep -rln hooks-compatibility test scripts` returned nothing]. Pre-commit `mdformat` may realign the wide tables when it commits. That is expected.

### Unit-test deltas (Q6)

| Test file (pair) | Existing assertion that must change | New cases needed for 100% direct coverage |
|---|---|---|
| `test/domain/components/hook-events.test.ts` | `NON_TOOL_EVENT_CLOSED_SETS` deepStrictEqual expects the 10-value `StopFailure: new Set([ "rate_limit", ... "unknown", ])` [VERIFIED: hook-events.test.ts:120-148]. Append the 3 values. | `stopFailureMatcherTypes`: a single name, a `\|` list, empty alternatives dropped (`"rate_limit\|\|"`), a regex-path matcher (`"rate_limit\|server-error"`, `"rate limit"`) returns `[]`, and `"*"` returns `[]` (match-all is handled by callers). Optional type proofs `void ("cloud_credential_error" satisfies StopFailureErrorType)` next to lines 26-28. |
| `test/domain/components/hooks/partition.test.ts` | "keeps a closed-set value and drops values outside the set" expects `StopFailure` `rate_limit\|server_error` dropped as `closed-set` [VERIFIED: partition.test.ts:178-213]. After D-BG-302 it is admitted. Change only its StopFailure rows: move the compound to the supported side, or swap it for a value outside the vocabulary. | Admit `rate_limit\|overloaded`, admit `network_error\|rate_limit` (one member is enough), drop `network_error\|timeout`, drop `rate_limit\|server-error` (regex path), drop `\|`, admit `cloud_credential_error`, and drop `Rate_Limit` (case-sensitive). |
| `test/bridges/hooks/settle.test.ts` | "a failure without text reports unknown with an empty message" asserts `[{ error: "unknown", last_assistant_message: "" }]` [VERIFIED: settle.test.ts:1381-1401]. The new expectation is `[{ error: "unknown" }]` with a new title. | A whitespace-only `errorMessage` leaves the field out. A padded `"  Rate limit (429)\n"` is trimmed. A `length` ending with no `errorMessage` (use `failureEnd("length")`) gives `[{ error: "max_output_tokens" }]`. Pipe entries in the "an error ending reaches matching failure observers" bucket (`failureEntry("list", "overloaded\|rate_limit")` runs, `failureEntry("miss", "overloaded\|billing_error")` does not). Unchanged: "a length ending reports max-output classification without re-entry" uses `errorMessage` `"provider text"` and still expects it [settle.test.ts:1356-1379]. |
| `test/bridges/hooks/payloads/stop-failure.test.ts` | None break. Existing events with `last_assistant_message: ""` still typecheck and pass through. The comment at line 147 says "closed 10-value vocab". | "omits last_assistant_message when the event omits it", which covers the new conditional spread (both branches needed). Optionally assert `Object.hasOwn(payload, "last_assistant_message") === false`. |

No architecture test locks the StopFailure vocabulary, the docs rows, or the closed-set table shape. `test/architecture/closed-set-enrollment.test.ts` counts only `BUCKET_A_EVENTS` (10) and `TOOL_EVENTS` (3) [VERIFIED: closed-set-enrollment.test.ts:65-96]. `test/architecture/hooks-translators.test.ts` checks only the translator file and export names. No `test/integration/**` file names StopFailure [VERIFIED: grep this session]. `matcherFiresOnClosedSetValue` is also imported by `test/bridges/hooks/dispatch.test.ts`. Do not touch it.

### Recommended feature layout (`features/hook/stop-failure.feature`)

All scenarios use existing steps only. **Do not create `hook/stop-failure.steps.ts`** (CONTEXT: not empty, and not needed). No scenario has an MCP surface, so none takes a tag.

| # | Scenario (suggested title) | Steps / literals from | Red proof |
|---|---|---|---|
| 1 | Seed, kept as is | existing | already green; keep (its steps stay used) |
| 2 | Outline "A turn the model ends in <error type> runs the StopFailure hook whose matcher names it": hooks `named \| StopFailure \| <error type>` and `other \| StopFailure \| <other type>`; 8 rows from P1 (add an `other type` column) | P1 + P7 | temporary local break (e.g., settle predicate returns `true`, or classifier returns `"unknown"`), never committed |
| 3 | "A reply cut off at the output limit runs the StopFailure hook with no assistant message" | P2 | today's output (extra `last assistant message` column), no break needed |
| 4a | "An error turn runs the StopFailure hook and not the Stop hook" | P1 row (Stop hook declared) | temporary break: route `error` to Stop in settle |
| 4b | "A normal turn runs the Stop hook and not the StopFailure hook" | P3 | temporary break: route `stop` to StopFailure |
| 5 | "The outcome of a StopFailure hook changes nothing" | P4 | temporary break, e.g. settle passes StopFailure outcomes to `stopFeedback`/re-entry |
| 6 | "The prompt after an error turn gets a normal turn" | P5 | temporary break, e.g. `runtime.recordStopReentry()` in the StopFailure arm, which sets `stop hook active` |
| 7a | Outline "Info on a plugin whose StopFailure hook names <error type> shows it available": 13 rows | P6 admitted table | 3 new rows red today (P6 dropped rows); the 10 old rows are regression rows |
| 7b | "Info on a plugin whose StopFailure hook names a type Claude Code does not send shows it partially available" (`network_error`) | P6 dropped rows | temporary break: admit every matcher |
| 8 | "A StopFailure matcher that lists error types runs on a listed type": `either \| StopFailure \| rate_limit\|overloaded` (escaped `\|`), `other \| StopFailure \| server_error\|unknown`, plain install, 429 | P7 | red today: `the user has run` install fails (partially-available) |

A Gherkin table cell with a literal `|` must be written as `\|` [VERIFIED: features/marketplace/help.feature:12 uses `<add\|remove\|...>`; the P6/P7 probes used `rate_limit\|overloaded` and it reached the hooks file]. `npm run check:features` passed on the tree after the probe was deleted (exit 0).

### Anti-Patterns to Avoid
- **Removing the `matcherFiresOnClosedSetValue` import from settle:** breaks `fallow dead-code` (Pitfall 1).
- **Reshaping `nonToolMatcherCondition` or `matcherFiresOnClosedSetValue`:** violates the shared-file rule and would change SessionStart, SessionEnd, PreCompact, and PostCompact (deferred).
- **Stating `last assistant message` with an empty cell for the length scenario:** that passes today and proves nothing. The column must be absent from the stated table.
- **Using `--partial` in the pipe scenario:** that hides the D-BG-302 install refusal. Plain install is both the red proof and the user-facing parity.
- **A `length` scenario followed by a second prompt:** Pi's `_omitRecoveryAttempt` removed the truncated reply from context (P2). Not needed; avoid it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Prove "exactly one model call" | a call-count step | a one-step script + the world's `After` checks | `unusedScriptSteps`/`callsPastScript` already fail a scenario [world.ts:1161-1195] |
| Prove "no extra hook ran" | per-hook negative steps | whole-set `the hooks record these runs:` | It compares every run of the turn |
| Prove a field is absent | a custom "field absent" step | omit the column from the runs table | `recordTable` appends any column the table leaves out [VERIFIED: features/lib/field-rows.ts:93-99] |
| Red proofs for existing behavior | committed negative tests | a temporary local product break, reverted, recorded in SUMMARY | Milestone rule; CONVENTIONS forbids committed negative controls |
| Error classification | new classifier rules | the existing D-88-02 `CLASSIFIER_TABLE` | D-BG-304 / P3-DC-04 |

## Common Pitfalls

### Pitfall 1: Dropping settle's `matcherFiresOnClosedSetValue` import fails fallow
**What goes wrong:** D-BG-302 says settle uses a StopFailure predicate "in place of" the shared one. `settle.ts` is the only production importer of that export. `fallow dead-code --trace` this session printed: `USED matcherFiresOnClosedSetValue ... Reason: Used by 1 file(s) ... -> extensions/pi-claude-marketplace/bridges/hooks/settle.ts (named import)`. Production mode ignores test imports (`dispatch.test.ts`), so the export becomes unused and `npm run fallow` fails.
**How to avoid:** Compose it: `matcherFiresOnClosedSetValue(entry, err) || stopFailureMatcherTypes(entry.rawMatcher).includes(err)`. Removing the `export` from `dispatch.ts` would edit a shared file and break `dispatch.test.ts`.
**Warning sign:** `npm run fallow` reports `unused-export` on `bridges/hooks/dispatch.ts`.

### Pitfall 2: A table that passes today for D-BG-303
**What goes wrong:** Writing `| last assistant message |` with an empty cell matches today's `""`.
**How to avoid:** Leave the column out (P2 table).

### Pitfall 3: Error turns that consume extra script steps
**What goes wrong:** An overflow-pattern message, or a retry (TUI Pi only), makes extra calls (Phase 1 Pitfall 3).
**How to avoid:** Use only the P1 messages in a profile Pi (`pi runs with the scripted model`). A `length` reply only with the default `keepRecentTokens`. Never use `pi keeps only one recent token when the hooks session compacts` in a `length` scenario.
**Warning sign:** "the model was called past the end of its script".

### Pitfall 4: Info shows no matcher for an admitted StopFailure group
**What goes wrong:** A planner may expect `[{"event":"StopFailure","matcher":"rate_limit"}]`. The real value is `[{"event":"StopFailure"}]` (P6).
**How to avoid:** Copy P6's literals.

### Pitfall 5: Escaping `|` in Gherkin cells
**What goes wrong:** An unescaped `|` splits the cell, and the hooks table gets an extra column.
**How to avoid:** `rate_limit\|overloaded`.

### Pitfall 6: Two runs of one event append in any order
**How to avoid:** Use `the hooks record these runs in any order:` when two or more StopFailure hooks run in one turn (P4).

### Pitfall 7: Coverage of the new branches must come from each pair's own test
**What goes wrong:** Direct coverage runs each pair alone. The helper in `hook-events.ts` is covered only by `hook-events.test.ts`, not by `partition.test.ts`.
**How to avoid:** See the table in "Unit-test deltas". Run `npm run test:coverage:direct -- <the four sources>`.

### Pitfall 8: Complexity gates on `nonToolMatcherCondition` / `runStopFailure`
**What goes wrong:** Inlining the list logic adds nesting. ESLint sonarjs and fallow each cap cognitive complexity at 15.
**How to avoid:** Keep the list logic in the helper and the file-private condition and predicate functions.

## Code Examples

Composed settle predicate (recommended; keeps `dispatch.ts` untouched):

```ts
// D-BG-302: Claude Code fires a StopFailure hook when the classified error is
// any alternative of its `|` list; match-all and a single exact name keep the
// shared closed-set predicate.
function stopFailureMatcherFires(entry: RoutingEntry, error: StopFailureErrorType): boolean {
  return (
    matcherFiresOnClosedSetValue(entry, error) ||
    stopFailureMatcherTypes(entry.rawMatcher).includes(error)
  );
}
```

`[ASSUMED]` names. `RoutingEntry` is the type of the `entry` that settle's filter receives. It is exported from `bridges/hooks/routing-state.ts:51` [VERIFIED: `export interface RoutingEntry {`], and `dispatch.ts:88` imports it as `import type { RoutingEntry } from "./routing-state.ts";`. Import it the same way in settle.

Settle event construction (D-BG-303):

```ts
const errorText = (last.errorMessage ?? "").trim();
const event: StopFailureEvent = {
  error: classifiedError,
  ...(errorText === "" ? {} : { last_assistant_message: errorText }),
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 10-value StopFailure vocabulary (D-88-02 era) | 13 values in Claude Code 2.1.319 (`ia` enum) | upstream `cloud_credential_error` since v2.1.267 | D-BG-301 |
| Whole-string StopFailure matcher | `\|` list of exact names (`Plt`) | upstream, documented | D-BG-302 |
| `last_assistant_message: ""` | field left out when the trimmed text is empty (`trim() \|\| void 0`) | upstream `RKr` | D-BG-303 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | After D-BG-301/302, `info` shows `[{"event":"StopFailure"}]` / `available` / empty reasons for a newly admitted value or `\|` list, the same as `rate_limit` today | P6 | Low: copy the actual row on the first green run |
| A2 | Helper name `stopFailureMatcherTypes` and the predicate name `stopFailureMatcherFires` | Product changes | None: discretion |
| A3 | Wording `Model not found (404)` reflects a "real provider message" well enough for D-BG-304 (real Anthropic not-found text is a `not_found_error` body that the D-88-02 table would classify `unknown`) | P1 | Low: D-BG-304 only asks for a message that classifies as `model_not_found` |
| A4 | Red-proof breaks listed per scenario are sufficient and revertible | Feature layout | Low |

## Open Questions

1. **Keeping or dropping the second-turn model-calls table (P5).** The `assistant` row with empty text is Pi's context behavior (the failed message stays in history). Recommendation: keep it. It is what Pi sends, and the bridge does not shape it. If a future Pi drops error messages from context, only this row changes.
2. **D-BG-302 "in place of" wording vs the fallow constraint.** Recommendation: compose (Pitfall 1), and record the composition as a dubious choice.
3. **Outline 7a red proof.** Only the 3 new rows fail before the fix. Recommendation: accept that (the 10 old rows are regression rows), or split it into a 3-row Outline (red) plus the existing coverage. The planner decides; record it in the SUMMARY.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v26.13.0 (CI 24) | — |
| Pi coding agent | profile Pi | ✓ | 1.5.0 | — |
| Optional peers cache | cucumber `BeforeAll` (`features/support/pi-process.ts:131`) | ✓ (installed this session) | pi-mcp-adapter 7.0.0, pi-subagents 0.84.0, pi-dynamic-workflows 3.15.0 | `node scripts/install-test-peers.mjs` (the first cucumber run in a fresh worktree fails with "the peer cache holds no pi-mcp-adapter") |
| fallow | `npm run fallow` | ✓ | repo pin | — |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `@cucumber/cucumber` (behavioral); `node:test` (unit) |
| Config file | `cucumber.json` (profiles `adapter`, `builtin`; `parallel: 8`) |
| Quick run command | `npx cucumber-js --profile adapter features/hook/stop-failure.feature` |
| Full suite command | `npm run check` (includes both cucumber profiles and direct coverage of all pairs) |

### Exact commands (Q7)
- One-time per fresh worktree: `node scripts/install-test-peers.mjs`
- Focused behavioral: `npx cucumber-js --profile adapter features/hook/stop-failure.feature` (or `npm run test:cucumber:profile -- --profile adapter features/hook/stop-failure.feature`). Add `--parallel 3` on this shared machine. One scenario: `npx cucumber-js --profile adapter --name '<title>'`.
- Unit (each): `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/domain/components/hook-events.test.ts` (and the same for `test/domain/components/hooks/partition.test.ts`, `test/bridges/hooks/settle.test.ts`, `test/bridges/hooks/payloads/stop-failure.test.ts`)
- Direct coverage for the four pairs (green at baseline this session, exit 0): `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hook-events.ts extensions/pi-claude-marketplace/domain/components/hooks/partition.ts extensions/pi-claude-marketplace/bridges/hooks/settle.ts extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts`
- Feature-file gate (green at baseline this session, exit 0): `npm run check:features`
- Dead code after the settle change: `npx fallow dead-code --trace extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:matcherFiresOnClosedSetValue` (must still say "Used by 1 file(s)")
- Wave and phase gates: `npm run check`. The phase gate also runs `npm run test:modules`.

### Phase Requirements → Test Map
| Req / criterion | Behavior | Test Type | Automated Command | What failure looks like | File Exists? |
|--------|----------|-----------|-------------------|---|-------------|
| STOPF-01 / SC1 | Error turn runs StopFailure once with Claude's payload, error type included | behavioral | `npx cucumber-js --profile adapter features/hook/stop-failure.feature` | runs table diff (wrong `error`, missing or extra row), "the model was called past its script", or "no model call used these steps" | ✅ (seed); Outline ❌ Wave 1 |
| STOPF-01 / SC2 | Matcher selects by error type; `\|` list fires on a listed type | behavioral + unit | same feature; `node --import ... --test test/bridges/hooks/settle.test.ts` | extra or missing run row; install step fails (pipe, before the fix) | ❌ |
| STOPF-01 / SC3 | Normal turn: no StopFailure; error turn: no Stop | behavioral | same feature | a Stop row on an error turn, or a StopFailure row on a normal turn | ❌ |
| STOPF-01 / SC4 | Output and exit code ignored; next prompt normal | behavioral | same feature | a `hook-notice` in the turn's records; an extra model call; `stop hook active` true on the next turn | ❌ |
| D-BG-301 | 13 values admitted | behavioral + unit | `/claude:plugin info` Outline; `test/domain/components/hook-events.test.ts` | `partially-available` / `unsupported hooks` for the 3 new values; the set diff | ❌ |
| D-BG-302 | `\|` list admitted and fired | behavioral + unit | scenario 8; `partition.test.ts`, `hook-events.test.ts`, `settle.test.ts` | install refused; no run | ❌ |
| D-BG-303 | `last_assistant_message` omitted when empty, trimmed otherwise | behavioral + unit | scenario 3; `settle.test.ts`, `stop-failure.test.ts` | an extra `last assistant message` column; `""` in the unit event | ❌ |
| NFR-6 | 100% direct coverage of the 4 pairs | unit | `npm run test:coverage:direct -- <4 sources>` | the script names the source and its coverage | ✅ |

### Sampling Rate
- **Per task commit:** the pre-commit hook (`npm run check:commit`, staged pairs) plus the focused cucumber run of `features/hook/stop-failure.feature`
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` and `npm run test:modules` green before `/gsd-verify-work`

### Wave 0 Gaps
None. Existing infrastructure covers all phase requirements: the scripted model's `error` and `stop reason` columns, the hook recorder, and the runs, messages, model-calls, and info steps. No new step module and no new test file are needed.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Plugin `hooks.json` matcher strings are untrusted input: an anchored single-class regex `^[A-Za-z0-9_\|]+$`, a `split`, and exact `Set.has`. No dynamic regex is built from plugin text (regex-path matchers stay dropped, MATCH-V2-01) |
| V6 Cryptography | no | — |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| ReDoS via a crafted matcher | DoS | The helper regex is linear (no nested quantifiers). Never `new RegExp(rawMatcher)` |
| A hook's output steering the model through StopFailure | Tampering | Outcomes are discarded (SFAIL-01). P4/P5 prove it end to end. Keep `runStopFailure` from touching `sendMessage`/re-entry |
| Error text leaking into a hook | Info disclosure | Already upstream behavior (the field is the rendered error text). Trimming does not change exposure |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/03-stopfailure-hooks/03-CONTEXT.md`: upstream evidence for Claude Code 2.1.319 (binary plus code.claude.com/docs/en/hooks), not redone here
- Codebase files read this session: `domain/components/hook-events.ts`, `domain/components/hooks/partition.ts`, `bridges/hooks/settle.ts`, `bridges/hooks/payloads/stop-failure.ts`, `bridges/hooks/dispatch.ts:163-175, 897-998`, `orchestrators/plugin/info.ts:680-720, 925-960`, `shared/concerns/hooks.ts`, the four test files, `test/architecture/closed-set-enrollment.test.ts`, `docs/hooks-compatibility.md`, `features/lib/scripted-model/script.ts`, `features/lib/field-rows.ts`, `features/support/world.ts`, and the step modules `session`, `model`, `hook/runs`, `hook/messages`, `hook/session`
- Pi 1.5.0 `agent-session.js` and pi-ai `overflow.js`, read this session
- Probe runs (two runs, 16 + 19 scenarios) under `--profile adapter`, with output in the session scratchpad
- `npx fallow dead-code --trace ...:matcherFiresOnClosedSetValue`

### Secondary / Tertiary
- None. No web research was needed. The upstream contract is locked in CONTEXT.md.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. There is no new stack.
- Architecture and product changes: HIGH. Each touchpoint was read, and the fallow trace was run.
- Scenario literals: HIGH. Every runtime and info row was run. A1 (post-fix info shape) is by analogy.
- Pitfalls: HIGH. Pitfall 1 was verified with fallow, and Pitfalls 2-6 with probes.

**Research date:** 2026-11-08
**Valid until:** 2026-12-08, or until Pi or the scripted-model harness changes
