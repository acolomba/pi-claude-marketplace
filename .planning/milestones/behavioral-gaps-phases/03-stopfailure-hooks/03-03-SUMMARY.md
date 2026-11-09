---
phase: 03-stopfailure-hooks
plan: 03
subsystem: hooks
tags: [stopfailure, payload, cucumber]
requirements-completed: [STOPF-01]
key-files:
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts
    - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
    - test/bridges/hooks/payloads/stop-failure.test.ts
    - test/bridges/hooks/settle.test.ts
    - features/hook/stop-failure.feature
    - docs/hooks-compatibility.md
completed: 2026-11-08
---

# Phase 3 Plan 03: Leave out an empty StopFailure assistant message

**A StopFailure payload carries Pi's error text, trimmed, as `last_assistant_message`, and leaves the field out when that text is empty, as Claude Code builds it (D-BG-303).**

## Accomplishments

- `StopFailureStdin.last_assistant_message` and `StopFailureEvent.last_assistant_message` are optional, and `translateStopFailure` spreads the field only when it is present.
- `runStopFailure` trims `errorMessage` and sets the field only when the trimmed text is not empty.
- Unit cases:
  - The translator gets new type proofs, and its omit-envelope case now omits both optional fields.
  - The settle cases become one row loop of four cases: no text, a `length` ending, whitespace only, and text with surrounding whitespace. Previously one case expected `""`.
- Scenario S3: a reply cut off at the output limit runs the StopFailure hook with `max_output_tokens` and no `last assistant message` column. Pi made one call with no compaction.
- The docs `last_assistant_message` row now states the StopFailure rule (1 line added, 1 deleted).

## Red proof

| Scenario | Before the fix | Result |
|---|---|---|
| S3 (`length` ending) | product as committed by 03-02 | failed at `the hooks record these runs:`: the record had an extra `last assistant message` column with an empty cell (`/tmp/claude-1000/bg-phase-3/red-s3.log`) |

The trim cannot be stated in a scenario, because cucumber trims table cells. The settle unit rows pin it.

## Deviations from Plan

- Executed inline by the phase session, not by an executor subagent (coordinator instruction).
- The four settle cases are one loop over typed rows instead of four tests, to avoid a clone group.
- The translator's existing "omits error_details" case was changed to omit both fields, instead of adding a near-identical case.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- The translator's omit-envelope case now covers both optional fields at once.

## Parent lines

CHANGELOG.md (one line for the milestone's aggregate entry):

```text
StopFailure hook matchers accept Claude Code's newer error types (`account_on_hold`, `verification_required`, `cloud_credential_error`) and `|` lists of error types, and a StopFailure hook gets no `last_assistant_message` when Pi reports no error text, as in Claude Code.
```

.planning/BACKLOG.md (a new entry; the ID is a proposal):

```text
## CLOSEDLIST-01: `|` and `,` lists in the SessionStart, SessionEnd, PreCompact, and PostCompact matchers

Claude Code reads a matcher of these events as a list of exact values separated by `|` or `,`. The bridge compares the whole matcher with the event's closed set, so a list drops as `closed-set` and the plugin installs only with `--partial`. StopFailure has its own list reading (D-BG-302). The fix for these four events changes the shared `nonToolMatcherCondition` and `matcherFiresOnClosedSetValue`, which a behavioral-gaps hook stream may not reshape (P3-DC-02). Found by the behavioral-gaps StopFailure phase.
```

.planning/PROJECT.md Key Decisions (four rows, in the table's format):

```text
| **D-BG-301 (behavioral-gaps, Phase 3, settled with the recommended answer, pending user review): the StopFailure error vocabulary is Claude Code 2.1.319's 13 values**. `account_on_hold`, `verification_required`, and `cloud_credential_error` are appended at the end of `STOP_FAILURE_ERROR_TYPES` in `domain/components/hook-events.ts`, so a matcher that names one is admitted and the plugin installs `available`. The classifier never produces them, because Pi reports no such error, as with `oauth_org_not_allowed`. | The binary's payload schema and its matcher list hold all 13 values; the docs list 12, without `verification_required`. An extra admitted value only means a matcher that never fires, while a missing one means a plugin that installs only with `--partial`. Rejected: the docs' 12 values. | -- Pending |
| **D-BG-302 (behavioral-gaps, Phase 3, settled with the recommended answer, pending user review): a StopFailure matcher is a `\|` list of exact error types, as Claude Code reads it**. A matcher made only of letters, digits, `_`, and `\|` is split on `\|`, and empty alternatives are dropped. The group is admitted when at least one alternative is in the vocabulary, and it fires when the classified error equals any alternative, exactly and case-sensitively. Any other non-empty matcher keeps the `closed-set` drop (MATCH-V2-01), and `""` and `*` stay match-all. It is StopFailure's own code path: `stopFailureMatcherTypes` in `hook-events.ts`, a StopFailure case in `hooks/partition.ts`, and a list-aware filter in `runStopFailure` (`settle.ts`) that still calls the shared `matcherFiresOnClosedSetValue` (P3-DC-06). | Claude Code's matcher parser reads such a matcher as a `\|` list, and its docs say so for `FileChanged` and `StopFailure`; no decision ID licensed a whole-string comparison. SessionStart, SessionEnd, PreCompact, and PostCompact have the same gap, which BACKLOG CLOSEDLIST-01 carries, because their fix changes shared modules. | -- Pending |
| **D-BG-303 (behavioral-gaps, Phase 3, settled with the recommended answer, pending user review): `last_assistant_message` is Pi's error text, trimmed, and left out when it is empty, as Claude Code builds it**. A `length` ending has no error text, so its StopFailure payload has no `last_assistant_message`. `StopFailureEvent` and `StopFailureStdin` make the field optional, and `runStopFailure` sets it only when the trimmed `errorMessage` is not empty. | Claude Code builds the field from the error message's text, trimmed, or leaves it undefined when that is empty, and its docs mark the field optional. A hook that reads the field with `jq -r` gets `null` instead of an empty string on a `length` ending (P3-DC-03). Rejected: sending the truncated reply text, because upstream's field holds error text. | -- Pending |
| **D-BG-304 (behavioral-gaps, Phase 3, settled with the recommended answer, pending user review): the StopFailure scenarios pin the D-88-02 classifier on one representative message per type that Pi can produce, and keep away from Pi's own recovery paths**. `Authentication failed (401)`, `Rate limit reached (429)`, `Overloaded (529)`, `Internal server error (500)`, `Invalid request (400)`, `Model not found (404)`, Anthropic's credit-balance text, `The provider closed the connection`, and a reply with stop reason `length` give `authentication_failed`, `rate_limit`, `overloaded`, `server_error`, `invalid_request`, `model_not_found`, `billing_error`, `unknown`, and `max_output_tokens`. No message matches Pi's context-overflow patterns, and the profile Pi turns auto retry off, so each turn is one model call. | Pi gives the bridge only the rendered `errorMessage` and the stop reason, so the bridge classifies by substring (D-88-02), and the table stays as it is (P3-DC-04). A message on Pi's overflow path would start Pi's compact-and-retry and add model calls. | -- Pending |
```

Frozen files: none. README.md and README.es.md: none. Unowned feature files whose rows changed: none.
