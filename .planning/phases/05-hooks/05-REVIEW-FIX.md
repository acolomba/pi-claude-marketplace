---
phase: 05-hooks
fixed_at: 2026-11-01T23:30:00Z
review_path: /home/user/pi-claude-marketplace/.planning/phases/05-hooks/05-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 6
skipped: 1
status: partial
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-11-01T23:30:00Z
**Source review:** /home/user/pi-claude-marketplace/.planning/phases/05-hooks/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (CR-01, CR-02, WR-01..WR-05; scope `critical_warning`)
- Fixed: 6
- Skipped: 1 (WR-01: the fix would diverge from upstream)

**Where verification ran:** in the main checkout `/home/user/pi-claude-marketplace`, on branch `features/component-features-phase-5`. No worktree was used, as the caller's binding run rules require. The numbers below come from that tree.

Each fix followed the same steps: a red unit test in the paired `test/**` file, then the fix, then 100% direct coverage (`npm run test:coverage:direct -- <source>`). Each user-visible change also got a cucumber scenario. I recorded it failing with the source fix reverted and passing with the fix in place. Then I ran `npx cucumber-js features/hook` (all passed: 71 scenarios, 856 steps after the last fix) and `npm run check:static` (all passed). Each commit's hook ran `npm run check:commit` and passed. I also ran the hook integration suites (`node --test test/integration/hooks-*.test.ts`, 9 passed) and `features/plugin/session-start-hooks.feature` (2 passed). I did not run the full `npm run check`; the GSD gate still has to run it.

## Fixed Issues

### CR-01: Output overflow makes an `onFailure: "block"` hook fail open

**Status:** fixed: requires human verification (logic: an early return skipped the onFailure check)
**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts`, `test/bridges/hooks/dispatch-exec.test.ts`, `features/lib/hook-files.ts`, `features/hook/tool-use.feature`
**Commit:** 0d877aa
**Applied fix:** The overflow branch of the `close` handler now runs `onFailureBlock` with the close code (null after the bridge's SIGTERM, so it counts as a failure under E6). It passes empty stdout, so the truncated output is not parsed. A child that exits 0 by itself after an overflow stays a noop, and a unit case pins that. The owned fixture helper `features/lib/hook-files.ts` gains an `output bytes` column, so a script hook can print past the 1 MB stdout limit.
**Scenario:** `features/hook/tool-use.feature`, "A PreToolUse hook with onFailure block that overflows its output blocks the tool call". The scenario floods stdout, not stderr: stderr chunks arrive at nondeterministic boundaries, so the reason text would vary from run to run. Both streams take the same code path.
**Red (fix reverted):**
```
-     'bash failed: PreToolUse:Bash hook error: [${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh]: failed; blocking because onFailure is "block"'
+     'bash returned: from-model\n'
1 scenario (1 failed)
```

### CR-02: A blocking or stopping SessionStart hook drops every other hook's `additionalContext`

**Status:** fixed: requires human verification (state handling)
**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts`, `test/bridges/hooks/event-adapters.test.ts`, `features/hook/additional-context.feature`
**Commit:** 0df61e7
**Applied fix:** `adaptObservationResultForEvent` now buffers a SessionStart fold's non-empty `additionalContext` whatever the arm (block, stop, mutate, noop). Block and stop are still debug-logged. Unit cases cover all three non-mutate arms. A PostCompact case shows that the other events still drop context.
**Scenario:** "A session start hook's additional context reaches the model when another session start hook exits 2".
**Red (fix reverted):**
```
-   [ '1', 'user', 'SessionStart hook additional context: ss-ctx' ]
1 scenario (1 failed)
```

### WR-02: UserPromptSubmit context can attach to a later prompt's turn

**Status:** fixed: requires human verification (state handling across Pi's input/run lifecycle)
**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`, `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts`, `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`, `test/bridges/hooks/dispatch.test.ts`, `test/bridges/hooks/event-adapters.test.ts`, `features/step_definitions/hook/prompt-and-stop.steps.ts`, `features/hook/additional-context.feature`, `docs/hooks-compatibility.md`
**Commit:** 8e35210
**Applied fix:**
1. The UserPromptSubmit composite now drains stale prompt context when it starts, before the bucket check, so it drains even when no hook is routed. This is the "at minimum" part. The drain cannot go in the second `input` subscription: Pi runs `input` handlers in registration order, so that handler would drain the context the current prompt just buffered.
2. `adaptInputResult` delivers the context of a queued steer or follow-up (`event.streamingBehavior !== undefined`) at once, with `pi.sendMessage(..., { triggerTurn: false })`. It does not buffer it. The message uses the same `claude-hook-additional-context` custom type and text as the `before_agent_start` carrier. The constant moved to `event-adapters.ts`, and `event-router.ts` imports it. A blank context, no Pi API, or a send that throws (debug-logged) sends nothing.
**Scenario:** "A prompt hook's additional context for a steer reaches the model on the turn that reads the steer". It uses a new step, `the user prompts {string} and steers with {string} while the tool runs`. The step sends an RPC `prompt` with `streamingBehavior: "steer"` while a `sleep 3` bash call runs, asserts the disposition is `queued`, and keeps the whole run as the turn.
**Red (fix reverted):**
```
+    "UserPromptSubmit hook additional context: ctx-from-hook"   (missing before "also say hi" on call 2)
1 scenario (1 failed)
```
**Note:** The context lands just before the queued prompt, not after it as upstream places it. Pi queues the steer text only after its `input` handlers return, and no Pi carrier can put a message after a queued prompt. This Pi gap is documented in `docs/hooks-compatibility.md`.

### WR-03: Hook notices reach the user verbatim and unbounded

**Status:** fixed
**Files modified:** `extensions/pi-claude-marketplace/shared/notification-resolve.ts`, `extensions/pi-claude-marketplace/shared/notification-dispatch.ts`, `extensions/pi-claude-marketplace/shared/notification-grammar.ts` (comment only), `test/shared/notification-resolve.test.ts`, `test/shared/notification-dispatch.test.ts`, `features/hook/messages.feature`, `docs/hooks-compatibility.md`, `docs/json-output.md`, `docs/output-catalog.md`
**Commit:** 40f3d52
**Applied fix:** A new `terminalSafeHookNotice` in `notification-resolve.ts` (the resolve step already redacts raw surfaces) does three things. It applies `stripVTControlCharacters`, as `orchestrators/plugin/package-install.ts` does. It replaces every remaining `\p{Cc}` except `\n` and `\t` with a space. It cuts the text at 2,000 grapheme clusters, ending it with `… (+N chars)`. That marker matches the project's existing D-PL3-10 marker form. `notifyHookNotice` calls it once before it builds the surface, so the TUI and JSON strategies both get the cleaned text. A notice that holds nothing but escapes emits nothing. The sanitizer could not live in `notification-dispatch.ts`: the D-16 / SC-5 presentation-sink gate (`test/architecture/presentation-sink.test.ts`) forbids composing text there, and my first attempt failed that gate in the commit hook. The `hook-notice` catalog block is unchanged, so the byte lock (`test/architecture/hooks-notice-notify.test.ts`) still passes. The prose next to it, the `json-output.md` field row, and `hooks-compatibility.md` now describe the strip and the cap.
**Scenario:** "A hook's system message is shown without its terminal escape sequences". It sends an OSC title, an SGR color, and a NUL through `systemMessage`.
**Red (fix reverted):**
```
+     text: 'UserPromptSubmit says: \x1B]0;title\x07remember\x1B[31m the\x00 tests'
-     text: 'UserPromptSubmit says: remember the  tests'
1 scenario (1 failed)
```

### WR-04: A PreCompact block does nothing and shows nothing, although Pi can cancel

**Status:** fixed: requires human verification (new decision path)
**Upstream evidence (Claude Code 2.1.316, `/opt/claude-code/bin/claude`):** The PreCompact runner `q0e` collects the blocked hooks: `Z = q.map(Se => "[" + Se.command + "]" + (out ? ": " + out : "")).join("\n")`, returned as `blockedBy`. Every compaction path then skips or throws: `Compaction blocked by PreCompact hook: ${blockedBy}` (manual, reactive, and precomputed). It also posts the notification `compaction blocked by PreCompact hook` with `color: "warning"`. So upstream does block the compaction.
**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts`, `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`, `extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts`, `test/bridges/hooks/event-adapters.test.ts`, `test/bridges/hooks/dispatch.test.ts`, `test/bridges/hooks/hook-labels.test.ts`, `features/step_definitions/hook/session.steps.ts`, `features/hook/session.feature`, `docs/hooks-compatibility.md`, `docs/json-output.md`
**Commit:** c17046a
**Applied fix:**
- New `adaptPreCompactResult`: a folded block returns `{ cancel: true }`, Pi's `SessionBeforeCompactResult.cancel`, typed structurally as `CompactionCancel`, because the frozen `platform/pi-api.ts` does not re-export Pi's type. A stop is debug-logged; context is dropped.
- `CompositeReturnFor<"PreCompact">` now includes the cancel. `adaptObservationResultForEvent` no longer takes PreCompact, and its PreCompact test rows moved to PostCompact.
- `blockNotices` shows one notice for a folded PreCompact block: `Compaction blocked by PreCompact hook: <message>`, with one message per blocking hook in routing order, joined by `\n`, as upstream does. The new `compactionBlockedText` / `HookBlock` in `hook-labels.ts` builds it. The `blockTexts` helper was folded into a shared `blocks()`.
- On Pi's side, a manual compaction then fails with `Compaction cancelled`. A new step, `the user compacts the session with the hooks recording, which fails with {string}`, states that error.
**Scenario:** "A PreCompact hook that exits 2 blocks the compaction". It checks the PreCompact run only (no SessionStart compact, no PostCompact) and the notice.
**Red (fix reverted):**
```
+   error: 'Turn prefix summarization failed: scripted model: call 2 has no step; the script has 1',
-   error: 'Compaction cancelled',
1 scenario (1 failed)
```
(Without the fix, Pi went on to summarize. A bigger script would have shown the compaction succeeding.)

### WR-05: The reload scenario's "no runs" check depends on a one-second quiet window

**Status:** fixed
**Files modified:** `features/step_definitions/hook/session.steps.ts`, `features/hook/session.feature`
**Commit:** 40367d9
**Applied fix:** The step `the user reloads pi in the terminal with the hooks recording` and its `TERMINAL_QUIET_MS` window are replaced by `the user reloads pi in the terminal and then prompts {string} with the hooks recording`. After the reload status line, the step types a prompt and polls the hook log until that prompt's UserPromptSubmit run appears. Pi runs `input` handlers before any model check, and the marker hook exits 2, so the prompt never reaches the model. The scenario now states the whole turn: the marker's run, and no SessionStart or SessionEnd run. The startup-run wait and the new wait share one `waitForRun` helper.
**Demonstration it can fail:** I removed the D-CF5-03 SessionStart reload filter in `event-router.ts`, temporarily and without committing it. The scenario failed with an extra `SessionStart ... start ... claude-env-first.env` row before the marker row. Then I restored the file (`git checkout`).

## Skipped Issues

### WR-01: The input rewrite is the last one in routing order, not the rewrite of the winning decision

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:315-323, 355-359`
**Reason:** The suggested fix would diverge from upstream. In Claude Code 2.1.316, the PreToolUse permission fold `jFt` sets `if(Ae)h=Ae` for every hook result that carries `updatedInput`, whatever that hook's `permissionBehavior` is. It then returns `q.updatedInput=h` next to the winning deny, ask, or allow. So upstream applies the last rewrite in completion order, independent of the decision. That matches E11 ("with two input rewrites ... the last to finish won"), and the current code does the same with routing order standing in for completion order. D-CF5-09 does say "the input rewrite of the winning decision", but it cites E11 as its evidence, and the binary shows no decision filter. Under AGENTS.md "Upstream parity", the gap between the decision's wording and upstream goes to the user as a question. I did not change the code.
**Original issue:** `foldMutations` takes `lastSet(mutations, "updatedInput")` over all mutations, so with A `ask`+X and B `allow`+Y, the fold asks (attributed to A) and then applies B's Y.

---

_Fixed: 2026-11-01T23:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
