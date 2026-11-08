# Phase 3 (StopFailure Hooks): Dubious Choices

This log lists the choices Phase 3 made without the user. Entries are numbered in the
milestone form `P{N}-DC-NN`, with N = 3.
Only the Phase 3 child session writes this file. It copies each item from the report
of each step and from the `## Dubious Choices` section of each plan
SUMMARY.md. A subagent never edits this file. The parent merges it into the root
log at the phase's merge.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.
- **IDs.** `P{N}-DC-NN` is a choice of phase N; this log holds Phase 3's.

## Discuss step

The autonomous run took the recommended option at every discuss question. The answers are the decisions D-BG-301 to D-BG-304 in `03-CONTEXT.md`. The entries below are the ones a reviewer may reverse.

- **P3-DC-01 (High, open). D-BG-301: three more StopFailure error types.** The closed vocabulary grows from 10 to 13 values: `account_on_hold`, `verification_required`, and `cloud_credential_error`. Without them, a plugin whose StopFailure matcher names one installs only as `partially-available`. The docs list 12 values without `verification_required`, but the 2.1.319 binary's payload schema and matcher list both have it, so it is included. Pi never reports these errors, so such a hook never runs, as `oauth_org_not_allowed` already never runs.
- **P3-DC-02 (High, open). D-BG-302: `|` lists on StopFailure matchers only.** Upstream documents `|` lists for StopFailure, and the bridge dropped them. The fix is a new StopFailure code path, so the other closed-set events (SessionStart, SessionEnd, PreCompact, PostCompact) keep exact whole-string matching, although upstream accepts `|` and `,` lists for them too. This leaves one inconsistency between events until the parent takes the BACKLOG line. A list is admitted when at least one alternative is in the vocabulary, as the tool matchers degrade per alternative (#217).
- **P3-DC-03 (Medium, open). D-BG-303: `last_assistant_message` left out when empty.** Upstream leaves the field out (`trim() || undefined`), and the bridge sent `""` on a `length` ending. A hook that reads the field with `jq -r` now gets `null` instead of an empty string on a `length` ending. The trim also applies to error text, but no scenario can state it, because cucumber trims table cells. A unit test pins it.
- **P3-DC-04 (Medium, open). D-BG-304: no new classifier rules.** The D-88-02 substring table stays as it is. A bare overflow text without a status code (`prompt is too long: ...`) still classifies as `unknown`, where upstream says `invalid_request`. Real provider messages carry the `400` that the table already maps.
- **P3-DC-05 (Low, open). Fire-and-forget not pinned.** Upstream does not await StopFailure hooks, and the bridge awaits them inside `agent_settled`. The difference is only timing, so no scenario pins it. The phase records it as a deferred idea.

## Research step

- **P3-DC-06 (Low, open). Settle keeps the shared matcher check.** D-BG-302 said the StopFailure predicate replaces `matcherFiresOnClosedSetValue` in `runStopFailure`. Settle is that function's only production consumer, so replacing it would make fallow report an unused export. The new predicate calls the shared check and adds the `|` list, and `dispatch.ts` stays unchanged.
- **P3-DC-07 (Low, open). Scenario messages.** `Model not found (404)`, Anthropic's credit-balance text, and `The provider closed the connection` stand for `model_not_found`, `billing_error`, and `unknown`. A real Anthropic not-found error (`not_found_error`, no "model not found" text) classifies as `unknown` today; no scenario pins that.
- **P3-DC-08 (Low, open). Pi's empty assistant row.** The next-prompt scenario states the empty `assistant` row Pi 1.5.0 sends for the failed turn, which ties it to how Pi builds its context.
- **P3-DC-09 (Low, open). Pattern mapper skipped.** The research already maps every file and analog, so the plan step ran without a PATTERNS.md.
