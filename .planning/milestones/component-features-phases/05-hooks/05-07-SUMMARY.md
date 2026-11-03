---
phase: 05-hooks
plan: 07
subsystem: hooks
tags: [hooks, notifications, system-message, hook-notice, cucumber, dispatch]

requires:
  - phase: 05-hooks (plan 05-03)
    provides: routing-order fold with every outcome's systemMessage, hookEventLabel, hookErrorText, the exit-2 fromStderr marker
  - phase: 05-hooks (plan 05-02)
    provides: the hooks table writer (form, output, stderr, exit code, on failure columns)
  - phase: 05-hooks (plan 05-01)
    provides: the hooks-recording new-session When, session results
provides:
  - "hook-notice: a new raw HookSurface kind (info) across every notification closed set, the wire schema, docs/json-output.md, and a docs/output-catalog.md example outside the counted sections"
  - "notifyHookNotice(ctx, run, text) in shared/notification-dispatch.ts"
  - "hook-labels.ts: hookSaysText, promptBlockedText, hookMatchLabel"
  - "dispatch.ts: notices after every composite fold (tool-result composite included) through one hook-origin run"
  - "features/hook/messages.feature (6 scenarios) and features/step_definitions/hook/messages.steps.ts"
affects: [05-08, 05-09, docs/hooks-compatibility.md]

actuals:
  tokens: 18800
  tasks: 2
  commits: 2
plan_head_before: f2dc357a515694a725f93cdf3c8c0f748ed317bb
plan_head_after: fbd0f9b8116a554d169e26b8a753d30658477ba5

tech-stack:
  added: []
  patterns:
    - "A bridge composes a notice's text and shows it through one hook-origin NotificationRun; with no Pi API, or when the notify throws, it writes a debug line and never fails the event"
    - "One match value per composite event feeds both the matcher filter and the notice label, as Claude Code names a hook `<event>:<matchQuery>`"
    - "A cucumber Then reads a turn's `entry_appended` records for `claude-plugin` payloads, so a notice appended to a session that a new session replaced is still seen"

key-files:
  created:
    - features/hook/messages.feature
    - features/step_definitions/hook/messages.steps.ts
    - test/architecture/hooks-notice-notify.test.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-resolve.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/shared/notification-json.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - schema/claude-plugin.schema.json
    - docs/json-output.md
    - docs/output-catalog.md
    - extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - test/shared/notification-types.test.ts
    - test/shared/notification-resolve.test.ts
    - test/shared/notification-grammar.test.ts
    - test/shared/notification-json.test.ts
    - test/shared/notification-wire.test.ts
    - test/shared/notification-dispatch.test.ts
    - test/architecture/catalog-uat/catalog-wire.test.ts
    - test/architecture/json-output-docs.test.ts
    - test/architecture/wire-schema.test.ts
    - test/bridges/hooks/hook-labels.test.ts
    - test/bridges/hooks/dispatch.test.ts

key-decisions:
  - "A SessionStart notice is labeled SessionStart:<source>, as Claude Code 2.1.316 names the hook (hook_name SessionStart:startup in research-c/probe/run1/stream.jsonl; nEt(\"SessionStart\", ..., `SessionStart:${n}`) in the binary); SessionEnd and PostCompact follow the same <event>:<matchQuery> rule"
  - "The blocked-prompt notice keeps D-CF5-24's two lines and leaves out upstream's third `Original prompt:` line"
  - "The blocked-prompt message is composed as a block reason is (`[<command>]: <stderr>` for exit 2), matching upstream's `${hookEvent} operation blocked by hook:\\n${blockingError}`"
  - "A UserPromptSubmit fold shows its system messages first, then the blocked-prompt notice; a stop shows no blocked-prompt notice"
  - "hook-notice sits in the payload union after background-update, before the internal-error command arm, beside the other raw kinds"

patterns-established:
  - "New raw kind footprint: types union, RAW_SURFACE_SEVERITY, resolve pass-through, grammar arm, JSON arm, wire payload + union, isRawOutcome, schema:generate, json-output.md section, catalog example outside counted sections, byte lock"

requirements-completed: []
requirements-advanced: [HOOK-05]

coverage:
  - id: D1
    description: "A hook's systemMessage is a validated hook-notice the user sees and the model never receives, on PreToolUse, PostToolUse, PostToolUseFailure, UserPromptSubmit, and SessionStart"
    requirement: HOOK-05
    verification:
      - kind: e2e
        ref: "features/hook/messages.feature#A prompt hook's system message is shown to the user and not sent to the model"
        status: pass
      - kind: e2e
        ref: "features/hook/messages.feature#A tool hook's system message names the event and the tool"
        status: pass
      - kind: e2e
        ref: "features/hook/messages.feature#A session start hook's system message is shown with the session's results"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/dispatch.test.ts#hook notices (HOOK-05 / D-CF5-14)"
        status: pass
      - kind: unit
        ref: "test/architecture/hooks-notice-notify.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "SessionEnd, PreCompact, and PostCompact drop a systemMessage with a debug line; an empty systemMessage shows nothing; notices follow routing order"
    requirement: HOOK-05
    verification:
      - kind: e2e
        ref: "features/hook/messages.feature#A session end hook's system message is not shown"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/dispatch.test.ts#drops a SessionEnd system message with a debug line (D-CF5-14)"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/dispatch.test.ts#shows each prompt hook's non-empty system message in routing order whatever order the hooks finish in"
        status: pass
    human_judgment: false
  - id: D3
    description: "A blocked prompt shows why and does not reach the model; a SessionStart, SessionEnd, or PostCompact block shows as the event's hook error"
    requirement: HOOK-05
    verification:
      - kind: e2e
        ref: "features/hook/messages.feature#A blocked prompt shows the user why and does not reach the model"
        status: pass
      - kind: e2e
        ref: "features/hook/messages.feature#A session start hook that exits 2 shows its error to the user"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/hook-labels.test.ts#promptBlockedText"
        status: pass
    human_judgment: false

duration: 95min
completed: 2026-11-01
status: complete
---

# Phase 5 Plan 07: Hook messages Summary

**A new `hook-notice` notification kind carries what plugin hooks show the user: each `systemMessage` as `<label> says: <text>` on the five events Claude Code shows it on, the blocked-prompt notice, and a block on SessionStart, SessionEnd, or PostCompact as `<label> hook error: <message>`, all through the notify chokepoint and never to the model.**

## Performance

- **Duration:** about 95 min
- **Started:** 2026-11-01T16:45Z (approximate)
- **Completed:** 2026-11-01T18:20Z
- **Tasks:** 2
- **Files modified:** 25 (3 created, 22 modified)

## Accomplishments

- `hook-notice` (`HookNoticeSurface { kind, text }`) joins `HookSurface` and every closed set at its tail: severity `info`, the verbatim text arm (empty text emits nothing), the JSON arm (`text`), `HOOK_NOTICE_PAYLOAD` in the wire union, `isRawOutcome` (`false`), the regenerated schema, a `#### hook-notice` section in `docs/json-output.md`, and a catalog example under "Out-of-band notifications" in `docs/output-catalog.md`, which the catalog parser skips.
- `notifyHookNotice(ctx, run, text)` is the IL-2 seam; `test/architecture/hooks-notice-notify.test.ts` locks its bytes to the catalog block.
- `dispatch.ts`: after each fold (both composite factories), `hookNotices` builds the notices and `showHookNotices` shows them through one `openNotificationRun(pi, { kind: "hook" })`. `entryFires` and the new `noticeLabel` share one `matchValue`.
- `hook-labels.ts`: `hookSaysText`, `promptBlockedText`, `hookMatchLabel`.

## Task Commits

1. **Task 1: Show a UserPromptSubmit hook's systemMessage through a new hook-notice kind, end to end** - `9795530` (feat). The kind plus its first caller, in one commit.
2. **Task 2: Show every hook notice on the events that show them, and the blocks no event can honor** - `fbd0f9b` (feat)

Tracer gate after Task 1: `auto_advance` false, `human_verify_mode` end-of-phase, automated-only `<verify>`. I re-ran the unit and architecture tests, direct coverage, the feature, and `npm run check:static` (fallow and check:features included). All passed, so Task 2 continued without a checkpoint.

### The kind's own commit (`git show --stat 9795530`)

25 files, all from Task 1's list: `docs/json-output.md`, `docs/output-catalog.md`, `bridges/hooks/dispatch.ts`, `bridges/hooks/hook-labels.ts`, the six `shared/notification-*.ts`, `features/hook/messages.feature`, `features/step_definitions/hook/messages.steps.ts`, `schema/claude-plugin.schema.json`, `test/architecture/catalog-uat/catalog-wire.test.ts`, `test/architecture/hooks-notice-notify.test.ts`, `test/architecture/json-output-docs.test.ts`, `test/architecture/wire-schema.test.ts`, `test/bridges/hooks/dispatch.test.ts`, `test/bridges/hooks/hook-labels.test.ts`, and the six `test/shared/notification-*.test.ts`. No file outside the list.

## Step texts added

`features/step_definitions/hook/messages.steps.ts`:

- `Then the hooks show the user these messages:` with a `| severity | text |` table. It reads the `entry_appended` records of the last turn whose entry is a `claude-plugin` custom entry of kind `hook-notice`, validates each against `NOTIFICATION_PAYLOAD_SCHEMA`, projects the run tokens in `text`, and compares the whole payloads (`schemaVersion` 1, origin `hook`, `needsReload` false) in emission order.
- `Then the hooks show the user no messages`, the empty form, because a header-only table cannot be compared (see Deviations).

Assumption A6 holds: Pi's RPC stream reports each appended entry as an `entry_appended` record, so the step reads the turn's records and needs no `get_entries` When of its own.

## Red proofs

- **Task 1** (`npx cucumber-js features/hook/messages.feature`, before the product change): the scenario failed at the messages Then with `actual []`. The runs table matched. The model calls step was not reached.
- **Task 2** (same command, before the dispatch change, after the kind existed): 4 of 6 scenarios failed. The tool notice, the blocked prompt, the SessionStart notice, and the SessionStart hook error each got no notice (`[]` from the messages Then, or an empty session results table). The Task 1 scenario passed.
- **SessionEnd drop pin.** "A session end hook's system message is not shown" passed before the change, as a pin should. I proved it with a temporary wrong edit that showed SessionEnd system messages. With only `the session reports no results`, the wrong edit still passed: the SessionEnd notice is appended to the session that the new session replaces, and that step reads only the new session. So I added `Then the hooks show the user no messages`, which reads the turn's records. With it, the wrong edit failed with `SessionEnd:clear says: goodbye`. I restored the file from a saved copy, and `showsSystemMessages` returns `false` for SessionEnd again.

After the fixes, `npx cucumber-js features/hook features/plugin/session-start-hooks.feature`: 55 of 56 passed (seed 889804). The one failure was the missing optional-peer cache (`pi-mcp-adapter`). After `node scripts/install-test-peers.mjs`, that scenario passed. `features/hook/messages.feature`: 6 of 6 passed (seed 926858).

## Upstream evidence (Claude Code 2.1.316)

- **Says text:** the TUI renders `hook_system_message` as `[hookName, " says: ", content]`, and the hook runner yields it with `hookName: pt`, the hook's name (binary strings). Probe texts: `UserPromptSubmit says: UPS-SYSMSG-MARK`, `PreToolUse:Bash says: PREA-SYSMSG-MARK`.
- **SessionStart label:** every SessionStart probe run names the hook `SessionStart:startup` (`research-c/probe/run1/stream.jsonl`, `research-b/probeC.M888/out/fail-ss-block-2.jsonl`: `"hook_name":"SessionStart:startup"`). The SessionStart block report is `nEt("SessionStart", yt.blockingError, \`SessionStart:${n}\`)`, where `n` is the source. So the plan's probe answers `SessionStart:<source>`, and Pi's new session reads `SessionStart:clear`.
- **Blocked prompt:** `function qKe(e){return\`UserPromptSubmit operation blocked by hook:\n${e.blockingError}\`}` in the binary, and `research-c/probe/run4/stream.jsonl` shows `blocked by hook:\nUPS-BLOCK-REASON\n\nOriginal prompt: secret prompt text` at `"level":"warning"`. The exit-2 `blockingError` is `[${command}]: ${stderr||"No stderr output"}` (as found in plan 05-03).
- **Hook error on events that cannot block:** `research-c/hooks.md` lines 985-1025: SessionStart, SessionEnd, and PostCompact "show stderr to user only", and SessionStart renders exit-2 stderr as a `<hook name> hook error` notice (`hook_non_blocking_error` renders `[hookName, " hook error"]` and then the stderr).

## Files edited outside the phase's ownership table (for the parent's merge)

These are closed-set or shared notification files, edited only for this kind. Another phase may append a kind to the same sets:

- `extensions/pi-claude-marketplace/shared/notification-{types,resolve,grammar,json,wire,dispatch}.ts`
- `test/shared/notification-{types,resolve,grammar,json,wire,dispatch}.test.ts`
- `schema/claude-plugin.schema.json` (regenerated by `npm run schema:generate`; 24 members)
- `docs/json-output.md` (the common-fields row now says "twenty-four kind sections"; new `#### hook-notice` section)
- `docs/output-catalog.md` (new `<!-- catalog-state: hook-notice -->` block under "Out-of-band notifications", outside the counted sections)
- `test/architecture/catalog-uat/catalog-wire.test.ts` (`RAW_ORIGINS`, `RAW_SAMPLES`, `emitRawSample`, sorted kind list; "24 kinds"; `PRESENTED.length` 336 to 337)
- `test/architecture/json-output-docs.test.ts` (the "X only" kind list)
- `test/architecture/wire-schema.test.ts` (member list; 23 to 24 members)

The catalog counters did not move: `node --test test/architecture/catalog-uat/catalog-contract.test.ts` passes with `EXPECTED_STATE_COUNT = 324` and `EXPECTED_UTF8_BYTES = 54_615` unchanged. A merge that also adds a raw kind must recount the 24 members, the "twenty-four" wording, the catalog-wire kind list, and `PRESENTED.length`.

## Decisions Made

See `key-decisions` in the frontmatter. Also:
- The notice runs after the fold and before the adapter, so a blocked prompt shows its notice before Pi answers `handled`.
- A PreToolUse block and a PostToolUse block show no notice: their text goes to the model, as plan 05-03 made it.
- A PreCompact block keeps the adapter's debug line and shows nothing.
- A SessionStart, SessionEnd, or PostCompact block still reaches the observation adapter, which logs it, so the block changes nothing else.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The SessionEnd drop scenario could not catch a wrong implementation**
- **Found during:** Task 2 (negative control)
- **Issue:** `the session reports no results` reads the new session's entries, and a SessionEnd notice is appended to the session the new one replaced. A wrong implementation passed.
- **Fix:** a second messages Then, `the hooks show the user no messages`, which reads every record of the turn. The scenario states it before `the session reports no results`.
- **Files modified:** `features/step_definitions/hook/messages.steps.ts`, `features/hook/messages.feature`
- **Committed in:** `fbd0f9b`

**2. [Plan refinement] `promptBlockedText(reason, command, fromStderr)` instead of `promptBlockedText(reason)`**
- **Reason:** the message must be composed as a block reason is (`[<command>]: <stderr>` for exit 2). The composer is private to `hook-labels.ts`, so the function takes the same three values as `hookErrorText`.

**3. [Plan refinement] `hookMatchLabel` added to `hook-labels.ts`**
- **Reason:** the SessionStart probe answered `SessionStart:<source>`. `hookEventLabel` maps its second argument through the Pi-to-Claude tool-name table, which is wrong for a source. `dispatch.ts` calls `hookEventLabel(` for the tool labels (the key link still holds).

**4. [Plan refinement] `entryFires` reads a shared `matchValue`**
- **Reason:** the notice label and the matcher filter need the same per-event value (source, reason, tool name, or trigger). One switch serves both, so the two cannot drift.

---

**Total deviations:** 1 auto-fixed (bug in the scenario) and 3 plan refinements
**Impact on plan:** none on scope; every behavior row holds.

## Issues Encountered

- `npx prettier --write` on `docs/*.md` rewrote unrelated lines (`______` rules to `---`). The repo formats Markdown with mdformat, not Prettier. I restored both docs from HEAD and applied the edits again.
- `pre-commit run --files` reports TruffleHog "verified" findings on the pre-existing fake GitHub token fixtures (the redaction cases) in `test/shared/notification-json.test.ts` and `test/shared/notification-resolve.test.ts`. The verification request goes through the session's agent proxy, which seems to make any GitHub token verify. The fixtures are fake and predate this plan. During `git commit`, the TruffleHog hook reported Skipped, and both commits passed every other hook. No hook was skipped by hand.
- The worktree had no optional-peer cache. `node scripts/install-test-peers.mjs` installed it (no tracked file changed).

## Deferred Issues

- Non-blocking error notices (`<hook name> hook error` with `Failed with non-blocking status code:` for exits other than 0 and 2): upstream shows them; no decision covers them. For plan 05-09's BACKLOG parent line.
- A UserPromptSubmit `continue: false` stops the prompt with no notice. The binary has `Operation stopped by hook: ${stopReason}` for it. No decision covers it. For the BACKLOG parent line.

## Parent lines

- CHANGELOG candidate (for the docs plan's merged entry): "Plugin hooks now show the user what Claude Code shows. A hook's `systemMessage` appears as `<Event>[:<Tool>] says: <text>` on PreToolUse, PostToolUse, PostToolUseFailure, UserPromptSubmit, and SessionStart, and never reaches the model. A blocked prompt shows why. A SessionStart, SessionEnd, or PostCompact hook that blocks shows its hook error. JSON and RPC output carry each notice as a new `hook-notice` entry."
- BACKLOG: "Hooks: show Claude Code's non-blocking error notice (`<hook name> hook error`, `Failed with non-blocking status code: ...`) for a hook that exits other than 0 and 2. No decision covers it yet."
- BACKLOG: "Hooks: a UserPromptSubmit `continue: false` stops the prompt silently. Claude Code shows `Operation stopped by hook: <reason>`."
- BACKLOG (D-CF5-24 follow-up): "Hooks: decide whether the blocked-prompt notice adds Claude Code's third line, `Original prompt: <prompt>`."
- `docs/hooks-compatibility.md` (phase-owned, docs plan): rows for `systemMessage` per event, the blocked-prompt notice, the `<event>:<value>` session labels, and the no-block-event hook error.
- Shared closed-set files touched: see "Files edited outside the phase's ownership table" above.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The register's mitigations are implemented:
- T-05-21: every notice carries its hook label (`<Event>[:<Tool>] says:`, `hook error:`, `operation blocked by hook:`) and the `hook-notice` kind with origin `hook`.
- T-05-23: the text strategy renders the notice verbatim through the notification grammar, like `async-rewake-summary`; the byte lock pins it.
- T-05-25: notices go only through `notifyHookNotice`; the prompt and tool scenarios state the model's calls without the notice text.
- T-05-22 (accepted): the notice passes author text through unredacted; `notification-resolve.test.ts` pins that the kind comes back as the same object.

## User Setup Required

None - no external service configuration required.

## Verification

- `node --test` on `test/shared/notification-*.test.ts`, `test/architecture/*.test.ts`, `test/architecture/catalog-uat/*.test.ts`, `test/bridges/hooks/**/*.test.ts`, and `test/index.test.ts`: 3302/3302 passed. The four `test/integration/hooks-*.test.ts`: 9/9 passed.
- `npm run test:coverage:direct --` on the six `shared/notification-*.ts`, `hook-labels.ts`, and `dispatch.ts`: exit 0, no shortfall line.
- `npm run check:static` (typecheck, lint, lint:workflows, fallow with dupes, format:check, test:corresponding, check:features): passed after the last edit of each task.
- Acceptance greps:
  - `hook-notice` in `notification-types.ts`: 1.
  - `"hook-notice"` in the schema: 1.
  - `notifyHookNotice(` in `dispatch.ts`: 1.
  - `^Feature: Hook messages$`: 1.
  - `operation blocked by hook` in `hook-labels.ts`: 3.
  - `^  Scenario: ` in `messages.feature`: 6.
  - `hookEventLabel(` in `dispatch.ts`: 2.

## Next Phase Readiness

- Plan 05-08 can import `hookSaysText` from `hook-labels.ts` and `notifyHookNotice` from `shared/notification-dispatch.ts` for the Stop notices.
- `the hooks show the user these messages:` and `the hooks show the user no messages` are ready for Stop scenarios.

## Self-Check: PASSED

- FOUND: `features/hook/messages.feature`, `features/step_definitions/hook/messages.steps.ts`, `test/architecture/hooks-notice-notify.test.ts`
- FOUND commits: `9795530`, `fbd0f9b` (ancestors of HEAD; `git rev-list --count f2dc357..HEAD` = 2 before this SUMMARY)

---
*Phase: 05-hooks*
*Completed: 2026-11-01*
