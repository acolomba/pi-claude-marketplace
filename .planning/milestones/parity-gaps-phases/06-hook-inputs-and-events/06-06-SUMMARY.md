---
phase: 06-hook-inputs-and-events
plan: "06"
subsystem: hooks
tags: [hooks, stdin, PreCompact, SessionStart, UserPromptSubmit, cucumber]
status: complete
requires: ["06-02", "06-03", "06-04"]
provides:
  - "`custom_instructions` on the PreCompact stdin (string or null, always present)"
  - "`model` and `sessionTitle` on TranslationContext"
  - "`model` and `session_title` on the SessionStart stdin; `session_title` on the UserPromptSubmit stdin"
  - "Steps: a compaction with instructions (`When`) and a session name (`Given`)"
affects: ["06-13 (compatibility page lists the three fields)"]
tech-stack:
  added: []
  patterns: ["conditional spread of optional context members (exactOptionalPropertyTypes)"]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts
    - extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-submit.ts
    - test/bridges/hooks/payloads/pre-compact.test.ts
    - test/bridges/hooks/translation-context.test.ts
    - test/bridges/hooks/payloads/session-start.test.ts
    - test/bridges/hooks/payloads/user-prompt-submit.test.ts
    - test/bridges/hooks/dispatch-exec.test.ts
    - test/integration/hooks-dispatch-end-to-end.test.ts
    - test/integration/hooks-spawn-end-to-end.test.ts
    - test/integration/hooks-additionalcontext-end-to-end.test.ts
    - test/integration/hooks-cross-scope-reconcile.test.ts
    - features/step_definitions/hook/session.steps.ts
    - features/hook/session.feature
    - features/hook/session-end.feature
    - features/hook/configuration.feature
    - features/hook/messages.feature
    - features/plugin/subagent-child.feature
decisions:
  - "`custom_instructions` is decided on the mapped trigger: `manual` sends Pi's text, or null when it is absent or empty; `auto` always sends null (D-PG6-08)."
  - "`buildTranslationContext` reads `ctx.model?.id` and `getSessionName()` once per dispatch and spreads each only when it is a non-empty string; its two call sites did not change (D-PG6-09)."
metrics:
  duration: "26 min"
  completed: 2026-11-14
actuals:
  tokens: 25528
  tasks: 2
  commits: 2
plan_head_before: ce5f377500a41d1ce3ff2a08f68ce5e9b785d1c9
plan_head_after: d5eba9c96fe9b47880e3ec34c75af5dc8812744d
---

# Phase 6 Plan 06: Session-event fields Summary

PreCompact hooks now get `custom_instructions` (the `/compact` text, or `null`). SessionStart hooks get `model` (the bare id of Pi's active model) and `session_title` (Pi's session name). UserPromptSubmit hooks get `session_title`. The model and the name are read once per dispatch in `buildTranslationContext`, and each is left out when Pi has none.

## Commits

| Task | Commit | Title |
|---|---|---|
| 06-06-01 | `c60528fd` | feat(hooks): send the compaction instructions to PreCompact hooks |
| 06-06-02 | `d5eba9c9` | feat(hooks): send the model and session title to session hooks |

`git rev-list --count ce5f3775..HEAD` = 2. Both commit hooks ran `npm run check:commit` and passed. The first attempt of the second commit failed at lint: `@typescript-eslint/no-useless-default-assignment` on `model: ExtensionContext["model"] = undefined` in `makeContext` of dispatch-exec.test.ts. I changed it to `model?: NonNullable<ExtensionContext["model"]>`, re-ran the test file (106 pass), and committed again. No commit was made by the failed attempt.

## Task 06-06-01: `custom_instructions` on PreCompact

- `PreCompactStdin` has `readonly custom_instructions: string | null` after `trigger`. `translatePreCompact` computes the trigger once. It sends `event.customInstructions` only when the trigger is `manual` and the text is not empty. In every other case it sends `null`. The header comment names the member and D-PG6-08.
- Owner cases (pre-compact.test.ts): the three-reason loop now passes an event that carries `Preserve decisions.`. It expects that text for `manual`, and `null` for `threshold` and `overflow` (the automatic case with a text). New cases: manual with `keep the API notes`, checked as the whole payload and its key order. Manual with no `customInstructions`, which gives `null` and `Object.hasOwn` true. Manual with `""`, which gives `null`.
- dispatch-exec.test.ts: the PreCompact translator case (`threshold`, `customInstructions: "Keep decisions."`) now expects `custom_instructions: null`. registry.test.ts pins no PreCompact payload, so it did not change.
- New step, in features/step_definitions/hook/session.steps.ts:

  ```
  When the user compacts the session with the instructions {string} and the hooks recording
  ```

  It sends RPC `{ type: "compact", customInstructions }` through `recordSessionAction`, using `compactSession(world, customInstructions?)`. That function gained the optional argument.
- New scenario: "A compaction with instructions gives the PreCompact hook the instructions" (session.feature). Its PreCompact row states `custom instructions` = `keep the API notes`.
- Sweep: the `custom instructions` column was added after `trigger` in the five tables that hold a PreCompact row (session.feature:107, 133, 161, 219, 246 at HEAD before the change). The cell is `null` on PreCompact rows and empty on the other rows. compaction.feature has no PreCompact row and did not change.

Red, on the unchanged production tree (adapter, session.feature + compaction.feature): `31 scenarios (25 passed, 6 failed)`. The 6 failures were the new scenario and the five swept tables. Each failed at `Then the hooks record these runs` because the actual table had no `custom instructions` column:

```
  1) A compaction with instructions gives the PreCompact hook the instructions # features/hook/session.feature:112
       -     'custom instructions',
       -     'keep the API notes',
  2) A PreCompact hook that exits 2 blocks the compaction when another PreCompact hook stops
  3) A compaction runs SessionStart with source compact between PreCompact and PostCompact
  4) A list matcher selects the PreCompact and PostCompact runs of a compaction
  5) A compaction trigger matcher selects the PreCompact and PostCompact runs
  6) A PreCompact hook that exits 2 blocks the compaction
```

Green, after the change: `31 scenarios (31 passed)`, `407 steps (407 passed)`.

Column-removal check (the `p0606-check.sh` script in the scratchpad, not committed; `COLS="custom instructions"`, base `ce5f3775`, new scenario dropped): `EQUAL  features/hook/session.feature`.

### Verification (task 1)

| Command | Result |
|---|---|
| `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/payloads/pre-compact.test.ts test/bridges/hooks/dispatch-exec.test.ts test/bridges/hooks/async-rewake/registry.test.ts test/architecture/hooks-translators.test.ts` | 246 pass, 0 fail, 0 cancelled |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts` | exit 0 (100%) |
| `npm run test:cucumber:profile -- --profile adapter features/hook/session.feature features/hook/compaction.feature` | red: 31 scenarios, 6 failed; green: 31 passed, 407 steps passed |
| `npm run check:features` | exit 0 |

## Task 06-06-02: `model` and `session_title`

- `TranslationContext` has two new optional members, `model` and `sessionTitle`. Each has a one-line doc comment that cites D-PG6-09. `buildTranslationContext(ctx, childIdentity?)` still takes two parameters. It reads `ctx.model?.id` and `ctx.sessionManager.getSessionName()`, and spreads each in only when it is a non-empty string. dispatch-exec.ts and async-rewake/registry.ts did not change. The header sentence that called more context a "v1.14+ scope expansion" now says which values the context carries. It also says that a new common field is read there once per dispatch and that each translator that sends the field still spreads it in.
- `SessionStartStdin` has `model?` and `session_title?` after `source`. `UserPromptSubmitStdin` has `session_title?` after `prompt`. No other translator reads the two members.
- The four integration tests gave their hand-built session managers `getSessionName: () => undefined`: cross-scope-reconcile (1), additionalcontext (1), spawn (2), dispatch (1). No pinned payload changed, because none of those contexts has a model or a name.
- Owner cases:
  - translation-context.test.ts: model `sonnet-5` plus session `Release prep` gives `model: "sonnet-5"` and `sessionTitle: "Release prep"`. No model and no name gives neither member (`Object.hasOwn` false). A name set to `""` gives no `sessionTitle`, while the model is still kept. `inMemoryContext` gained an optional `{ model, sessionName }` argument and names the session with `appendSessionInfo`.
  - session-start.test.ts: a context with both members gives `model` and `session_title` after `source`, checked as the whole payload and its key order. A context with neither gives today's payload, with `Object.hasOwn` false for both.
  - user-prompt-submit.test.ts: a context with a title and a model gives `session_title` after `prompt` and no `model`, checked by key order. The four existing cases cover a context without a title.
  - dispatch-exec.test.ts: a new loop runs every `TRANSLATOR_CASES` event through `dispatchHookExec` with a context that has a model (`dispatch-model`) and the session name `Release prep`. It compares the exact stdin bytes. Only SessionStart gains `model` and `session_title`, only UserPromptSubmit gains `session_title`, and the other eight events gain nothing. `makeContext` gained the optional `model` and `sessionName` parameters.
- New step, in features/step_definitions/hook/session.steps.ts:

  ```
  Given the user has named the session {string}
  ```

  It sends RPC `set_session_name` and asserts `success`. Then it sends `get_state` and asserts that `sessionName` equals the name.
- New scenarios in session.feature:
  - "A named session's SessionStart holds the session title and the model". The session is named `Release prep`, the user prompts, then compacts. The `SessionStart` `compact` row states `model` `faux-1` and `session title` `Release prep`.
  - "A prompt in a named session carries the session title". The `UserPromptSubmit` row states `session title` `Release prep` and has no `model` column.
  - "A continued named session starts with its title". This uses the saved-session steps from plan 06-03: the session is named and prompted, then pi starts again with `--continue`. The `SessionStart` row states `source` `resume`, `model` `faux-1`, `session title` `Release prep`, and the transcript path `{session file}`.
- Sweep: a `model` column was added after `source` in every runs table with a SessionStart row: 20 existing tables, and the two new SessionStart scenarios hold it too. Per file: session.feature 12, session-end.feature 4, configuration.feature 1, messages.feature 2, subagent-child.feature 1. The SessionStart rows hold `faux-1`, and the other rows have an empty cell.

**SessionStart rows without a model: none.** Every SessionStart row in the five files holds `faux-1`. This includes launch rows: subagent-child.feature's startup session, session-end.feature's json-mode `startup` and saved-session `resume`, and the `startup`/`resume`/`fork` launches of session.feature. The harness starts Pi with `--provider faux --model faux-1`, which agrees with the S7 spike Result (`ctx.model?.id` is `faux-1` at `session_start`). It also covers the new-session (`clear`), fork, and compact rows. The green run proves each row, because the runs step lists any stdin field that a table leaves out.

Red, on the unchanged production tree (adapter, the five features): `90 scenarios (63 passed, 27 failed)`, `1131 steps (1100 passed, 4 skipped, 27 failed)`. All 27 failures were at the runs step (26 `the hooks record these runs:`, 1 `... in any order:`). They were the three new scenarios and every swept table; the session-end.feature Outline at line 145 counts once per example. A changed table:

```
  5) A new session runs SessionEnd with reason clear and SessionStart with source clear # features/hook/session.feature:7
       Then the hooks record these runs:
           -     'model',
```

The new scenarios:

```
  18) A named session's SessionStart holds the session title and the model # features/hook/session.feature:135
           -     'model',
           -     'session title',
           -     'faux-1',
  4) A prompt in a named session carries the session title # features/hook/session.feature:159
           -     'session title',
           -     'Release prep',
  8) A continued named session starts with its title # features/hook/session.feature:465
```

Green, after the change: adapter, the five features: `90 scenarios (90 passed)`, `1131 steps (1131 passed)`. Builtin, subagent-child.feature: `14 scenarios (14 passed)`, `185 steps (185 passed)`.

Column-removal check (`p0606-check.sh`, columns `custom instructions,model,session title`, the four new scenarios dropped by title), against base `ce5f3775` and against `c60528fd`:

```
EQUAL  features/hook/session.feature
EQUAL  features/hook/session-end.feature
EQUAL  features/hook/configuration.feature
EQUAL  features/hook/messages.feature
EQUAL  features/plugin/subagent-child.feature
```

### Verification (task 2)

| Command | Result |
|---|---|
| `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/translation-context.test.ts test/bridges/hooks/payloads/session-start.test.ts test/bridges/hooks/payloads/user-prompt-submit.test.ts test/bridges/hooks/dispatch-exec.test.ts test/bridges/hooks/async-rewake/registry.test.ts test/bridges/hooks/hook-env.test.ts test/architecture/hooks-translators.test.ts` | 289 pass, 0 fail, 0 cancelled |
| `npm run test:coverage:direct --` translation-context.ts, session-start.ts, user-prompt-submit.ts | exit 0 (100%) |
| `node scripts/install-test-peers.mjs && node --import ... --test` the four hooks integration tests | 10 pass, 0 fail |
| Owner tests of other callers and hand-built contexts: test/architecture/hooks-lifecycle.test.ts, test/index.test.ts, test/bridges/hooks/event-router.test.ts, dispatch.test.ts, index.test.ts, test/integration/pi-subagents-child-identity.test.ts | 583 pass, 0 fail |
| adapter profile, the five features | red 27 failed of 90; green 90 passed |
| builtin profile, features/plugin/subagent-child.feature | 14 passed |
| `npm run check:features` | exit 0 |

Node v26.13.1. I did not run `npm run check`, because the orchestrator owns the wave gate.

## Acceptance greps

`custom_instructions` in pre-compact.ts: 3. `custom instructions` in session.feature: 6. `customInstructions` in session.steps.ts: 3. `sessionTitle` in translation-context.ts: 3. `session_title` in session-start.ts: 2, and in user-prompt-submit.ts: 2. `session title` in session.feature: 5. `set_session_name` in session.steps.ts: 2. Neither commit contains dispatch-exec.ts, async-rewake/registry.ts, runtime.ts, event-router.ts, dispatch.ts, a tool translator, or a feature file of plan 06-05.

## Deviations from Plan

**1. [Rule 2 - Coverage of a must-have] A dispatch-level case for "no other translator gains a member"**
- **Found during:** Task 2
- **Issue:** The behavior "no other translator's payload gains a member from the two context values" had no owner case. The existing dispatch cases all use a context without a model or a name.
- **Fix:** A loop in dispatch-exec.test.ts runs all ten translator cases with a context that has a model and a session name, and compares the exact stdin bytes.
- **Files modified:** test/bridges/hooks/dispatch-exec.test.ts
- **Commit:** d5eba9c9

**2. [Scope] registry.test.ts not changed.** The plan lists it for both tasks. It pins no PreCompact, SessionStart, or UserPromptSubmit payload, and its contexts have no model or name. It passes unedited (it is in both test runs above).

**3. [Rule 3 - Blocking] Lint fix before the second commit.** This is the `no-useless-default-assignment` failure described under Commits.

## Flagged assumptions

- **`session_title` on `UserPromptSubmit` goes one step past the requirement's wording (D-PG6-09).** The requirement names `SessionStart`. Claude Code's 2.1.323 schema carries the member on both events, and it costs the same read. Pending maintainer review.
- **An empty text is none.** Pi's `customInstructions` and session name are sent only when they are strings that are not empty, and an empty `customInstructions` reads as `null`. I did not read how Claude Code handles an empty `/compact` argument. Its builder (2.1.323) passes `custom_instructions: n.customInstructions` straight through, and its schema is `o().nullable()`. Pi already returns `undefined` for an empty session name (`getSessionName` trims and maps `""` to `undefined`).
- **Which `SessionStart` rows have a model.** Every row in the suite does, as the runs show (see above). A row without a model would still be correct, because the field is optional ("It can be omitted").
- **The title of a new session.** A session that Pi starts with `new_session` has no name, so its `SessionStart` has no `session_title`. The named-session scenario therefore uses a compaction, which stays in the same session.
- **The fields disclose more than before.** A plugin's hook now reads the session's name, the model's id, and the user's compaction instructions. These are Claude Code's fields; plan 06-13 lists them on the compatibility page.
- **Platform:** the scenarios run on Linux, in RPC mode.

## Records for the orchestrator (parent-owned lines, not applied)

This plan edits no parent-owned file. Lines for the maintainer to apply:

- PROJECT.md Key Decisions: D-PG6-08 and D-PG6-09, each pending maintainer review; D-PG6-09 notes that `session_title` is also sent on `UserPromptSubmit`.
- `.agents/skills/cucumber/rules/layout.md`: `hook/session.steps.ts` now also holds the compaction-with-instructions `When` and the session-name `Given`.

Exact step texts for that layout line:

- `When the user compacts the session with the instructions {string} and the hooks recording`
- `Given the user has named the session {string}`

Requirement for the parent to mark: PG-HOOK-04 (the `custom_instructions`, `model`, and `session_title` parts; the other parts belong to plans 06-02, 06-04, 06-05, and the `effort` plan).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-06-15 (accept) and T-06-16 (mitigate) hold as planned. The three values travel only as JSON members of the hook's stdin. None of them goes into an argument, an environment variable, or a file name.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts, translation-context.ts, payloads/session-start.ts, payloads/user-prompt-submit.ts
- FOUND: features/hook/session.feature (4 new scenarios)
- FOUND: c60528fd, d5eba9c9 (both ancestors of HEAD)
