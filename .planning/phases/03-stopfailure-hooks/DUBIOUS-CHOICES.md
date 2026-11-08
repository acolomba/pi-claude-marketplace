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

## Planning step

- **P3-DC-10 (Low, open). Three plans in three waves.** The suggested two plans became three, to keep each executor under its context budget. D-BG-303 is its own plan, which costs one more wave gate.
- **P3-DC-11 (Low, open). The next-turn scenario's reason narrowed.** `stop hook active: false` on the next turn cannot show that the StopFailure block set no loop state, because the user's next prompt clears that flag anyway (STOP-07). The red proof is a break that sends the block back to the model instead.
- **P3-DC-12 (Low, open). The list matcher.** The `|`-list scenario uses `network_error|rate_limit|overloaded`, so a reader that takes only the first or last type, or requires every type to be known, fails it.
- **P3-DC-13 (Low, open). Dropped matchers as an Outline.** The "type Claude Code does not send" scenario became three rows (`network_error`, `Rate_Limit`, `network_error|timeout`), which pins the case-sensitive drop and the drop of a list with no known type.
- **P3-DC-14 (Low, open). Look-alike other matchers.** In the error-type Outline, the hook that must not run names a type easily confused with the real one (401 with `oauth_org_not_allowed`, 500 with `unknown`).
- **P3-DC-15 (Low, open). A seven-file tracer.** The 03-02 tracer touches seven files, because each source edit commits with its paired test and the list scenario needs all three layers.
- **P3-DC-16 (Low, open). Docs row rewritten once.** The StopFailure matcher row of `docs/hooks-compatibility.md` is rewritten in 03-02 task 2 for both fixes, so it stays stale for one commit. The StopFailure event row stays unchanged, because it is still accurate.
- **P3-DC-17 (Low, open). Inline list rule in settle.** The D-BG-302 rule is inline in `runStopFailure`'s filter; `partition.ts` gets a small private condition function.
- **P3-DC-18 (Low, open). The planner filled the validation map.** It replaced the `3-xx` rows of `03-VALIDATION.md` with its task IDs.
- **P3-DC-19 (Low, open). BACKLOG ID.** The parent line for the other closed-set events' lists proposes the ID `CLOSEDLIST-01`.
- **P3-DC-20 (Low, open). Two planner detectors skipped.** The assumption-delta and schema-gate detectors did not run, because their fragments are not installed in this worktree. The api-coverage check ran and reported no external API.
