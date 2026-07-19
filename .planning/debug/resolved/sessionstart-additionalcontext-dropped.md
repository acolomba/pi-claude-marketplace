---
status: resolved
trigger: "After installing a hooks-only user-scope plugin whose SessionStart hook emits a Claude-style `{hookSpecificOutput: {additionalContext: \"...\"}}` JSON on stdout (e.g. learning-output-style), the hook fires end-to-end at Pi launch (proven by sentinel touch-file probe at 2026-06-17T08:17:47-04:00), but the additionalContext never reaches Pi's session prompt. The model's behavior is identical with the plugin installed vs uninstalled -- the prompt the plugin is supposed to inject (in this case the `learning-mode` prompt that should make Pi prefix educational notes with the literal `★ Insight` box and pause to request user code contributions at design decision points) has no observable effect on Pi's responses."
created: 2026-06-17T08:30:00Z
updated: 2026-06-19T00:00:00Z
---

> Pre-filled from operator-verified runtime evidence:
>   - Sentinel proof of dispatch: `/tmp/learning-fired.log` contains
>     `fired at 2026-06-17T08:17:47-04:00 pid=111077 CLAUDE_PLUGIN_ROOT=
>     /home/acolomba/pi-claude-marketplace/tmp/pi-uat/agent/pi-claude-marketplace/sources/claude-plugins-official/plugins/learning-output-style`
>     -- the bridge spawned the handler, CLAUDE_PLUGIN_ROOT resolves to
>     the actual source path (bugs 2 + 3 closed end-to-end).
>   - Behavioral probe: operator asked Pi "write me a simple in-memory
>     rate limiter for an HTTP API" -- no `★ Insight` box, no contribution
>     request, no learning-mode mention. additionalContext is being dropped
>     somewhere downstream of the handler exec.

## Symptoms

### Expected behavior
A Claude-style SessionStart hook emitting
`{hookSpecificOutput: {additionalContext: "<text>"}}` on stdout MUST inject
`<text>` into the session prompt so the model sees it on the FIRST agent
turn. This matches the upstream Claude Code contract.

### Actual behavior
The hook fires, the JSON is parsed (verified mechanically against
`bridges/hooks/wire-protocol.ts:154` which sets
`mutate.additionalContext = hso.additionalContext`), the composite handler
reduces a `mutate` HookExecResult with the content -- and then the result
hits `adaptObservationResult` in `bridges/hooks/event-adapters.ts:271`,
which has an explicit silent-drop for the mutate arm:

    case "mutate":
      // Observation events have no mutation surface -- silently drop.
      return undefined;

The bridge logs no error and Pi's session prompt is unmodified.

### Error messages
None. The drop is silent by design (the existing comment justifies it
under "Pi's handler return slot for these events is `void` -- there is
nowhere to thread a `block` or a `mutate` outcome").

### Timeline
v1.13 phase 63 hook bridge has shipped with this gap since the bridge
landed. Not caught by the unit suite because tests stop at the
HookExecResult layer (assertions check that wire-protocol.ts parses
additionalContext into a mutate arm) but never assert that the mutate
arm reaches Pi's session prompt. Not caught by 63-UAT because the
behavioral assertion (`★ Insight` box appearance, contribution requests)
was not part of the runtime UAT plan; tests 3/4/5 were blocked on the
hookify Stop-event issue, and the only hooks-only plugin available for
testing (learning-output-style) was masked by the cross-scope wipe
(bug 2) and CLAUDE_PLUGIN_ROOT synthesis (bug 3) until both landed
today.

### Reproduction
1. Branch at HEAD (features/v1.13-hook-bridge, currently `5248119`).
2. Cold-start pi-uat sandbox:

       scripts/pi.sh --clear --home /home/acolomba/pi-claude-marketplace/tmp/pi-uat

3. Install learning-output-style (only declares SessionStart, only
   bucket-A event):

       /claude:plugin install learning-output-style@claude-plugins-official

4. Quit Pi, relaunch:

       scripts/pi.sh --home /home/acolomba/pi-claude-marketplace/tmp/pi-uat

5. Ask: "write me a simple in-memory rate limiter for an HTTP API".

6. Observe: Pi implements straight through. No `★ Insight ──────` box,
   no pause-to-request-contribution at the algorithm-choice decision
   point, no mention of "learning mode". The plugin's additionalContext
   does not affect the model's behavior.

## Current Focus

hypothesis: |
  Pi's event lifecycle has TWO distinct return-slot surfaces for
  extension-supplied context:

    - `session_start` event: handler return type is `void`. Pi provides no
      mechanism to thread additionalContext through this event back into
      the session prompt.
    - `before_agent_start` event: fired before every agent turn (after
      user submits prompt but before the agent loop starts). Handler
      return type is `BeforeAgentStartEventResult`, which carries an
      optional `systemPrompt?: string`. Pi chains across extensions:
      each handler receives `event.systemPrompt = currentSystemPrompt`
      (the latest version) and may return a replacement, which Pi
      uses for the next handler in the chain and for the agent.

  Upstream Claude Code's SessionStart hook protocol assumes the runtime
  has a unified "inject context into the next agent turn" pathway. Pi
  does not -- it splits the lifecycle into session_start (void) and
  before_agent_start (returns systemPrompt). The phase-63 hooks bridge
  subscribed `session_start` (correctly mirroring the event name) but
  never wired the additionalContext payload over to Pi's actual
  context-injection surface (`before_agent_start`). The
  `adaptObservationResult` mutate-arm drop is the load-bearing leak
  point.

  Fix shape (independently verifiable):

    1. New module-state cell on event-router.ts: a
       `pendingSessionStartContext: string` buffer. SessionStart hook
       mutate-arm results that carry additionalContext append into the
       buffer (latest-wins or concat -- design decision, lean concat to
       support multiple SessionStart-bearing plugins).

    2. New `pi.on("before_agent_start", beforeAgentStartHandlerFor(...))`
       registration alongside the existing 7 in registerHooksBridge.

    3. The before_agent_start handler:
         - reads event.systemPrompt (whatever Pi + prior extensions
           assembled);
         - reads the pending buffer; if non-empty, returns
           { systemPrompt: event.systemPrompt + "\n\n" + buffer };
         - clears the buffer after return so subsequent agent turns
           don't re-inject stale context.
       (Drain-on-first-turn semantics. SessionStart fires once per
       session; the additionalContext is a one-shot turn primer, not
       a permanent system-prompt addition.)

    4. adaptObservationResult's mutate arm for SessionStart specifically
       captures into the buffer instead of silently dropping. Keep the
       silent drop for SessionEnd / PreCompact / PostCompact (those have
       no logical drain point in the upstream protocol).

  Out of scope for this fix:

    - PreCompact / PostCompact additionalContext. Their upstream
      semantics interact with compaction summaries, not the session
      prompt. Document and defer.
    - SessionEnd additionalContext. The session is ending -- there is
      no future turn to inject context into. Document and defer.

test: |
  Add a regression test that exercises the full chain:
    1. Boot the bridge with a SessionStart-emitting plugin whose
       handler returns `{hookSpecificOutput: {additionalContext: "MARK"}}`.
    2. Fire session_start -- assert the mutate arm captured into the
       pending buffer (not dropped).
    3. Fire before_agent_start with event.systemPrompt = "base" --
       assert the handler returns { systemPrompt: "base\n\nMARK" }.
    4. Fire before_agent_start a second time -- assert the buffer is
       drained and the handler returns undefined (no further injection).

  Plus an integration-level test (extending hooks-spawn-end-to-end or
  a new sibling) that exercises the real handler stdout JSON parse +
  capture + drain cycle.

expecting: |
  After wiring `before_agent_start` and the pending-buffer drain, a
  SessionStart hook emitting additionalContext causes Pi's first agent
  turn to receive a systemPrompt containing the injected text. The
  runtime UAT (operator asks "write a rate limiter") then exhibits the
  `★ Insight` box and/or the contribution-request pattern from
  learning-output-style's prompt.

next_action: |
  Independently verify the diagnosis by reading event-adapters.ts:271,
  wire-protocol.ts:154, event-router.ts:621 (the 7 pi.on call list),
  and Pi's runner.js:745-790 (the systemPrompt chaining loop). Then
  apply the fix per the scope above. TDD: write the regression test
  first (RED), then implement, then GREEN. Re-run npm run check.
  Operator runtime-verifies by re-running the rate-limiter probe and
  checking for the `★ Insight` markers.

reasoning_checkpoint: ""
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-06-17T08:17:47Z
  observation: |
    Sentinel proof of end-to-end dispatch (bug 3 closed):
    `/tmp/learning-fired.log` contains:
        fired at 2026-06-17T08:17:47-04:00 pid=111077
        CLAUDE_PLUGIN_ROOT=/home/acolomba/pi-claude-marketplace/tmp/pi-uat/agent/pi-claude-marketplace/sources/claude-plugins-official/plugins/learning-output-style
  conclusion: |
    Hook fires. CLAUDE_PLUGIN_ROOT resolves to actual source. Spawn
    works. Handler runs to completion. Therefore the additionalContext
    drop is downstream of dispatch-exec -- in the result-adapter layer.

- timestamp: 2026-06-17T08:30:00Z
  observation: |
    Mechanical confirmation in source:
      1. bridges/hooks/wire-protocol.ts:154 -- parseHookStdout sets
         `mutate.additionalContext = hso.additionalContext` from the
         handler's stdout JSON.
      2. bridges/hooks/event-adapters.ts:271 -- adaptObservationResult
         has explicit `case "mutate": ... silently drop ... return
         undefined`.
      3. bridges/hooks/event-router.ts:621 -- registerHooksBridge
         subscribes 7 events: session_start, session_shutdown,
         session_before_compact, session_compact, input, tool_call,
         tool_result. NOT before_agent_start.
      4. pi-coding-agent/dist/core/extensions/runner.js:745-790 --
         before_agent_start chains across extensions: each handler
         receives event.systemPrompt = currentSystemPrompt and may
         return { systemPrompt: X } to replace it for the next handler
         + the agent.
      5. pi-coding-agent/dist/core/extensions/types.d.ts:
         BeforeAgentStartEventResult.systemPrompt is the canonical
         extension-side context-injection slot.
  conclusion: |
    Pi's runtime DOES have a context-injection slot. The bridge just
    isn't wired to it for SessionStart's additionalContext. Fix is
    additive (new pi.on registration + new module-state buffer + new
    drain handler) and has no impact on the existing 7 event paths.

- timestamp: 2026-06-17T08:30:00Z
  observation: |
    Operator behavioral probe (negative result):
      prompt: "write me a simple in-memory rate limiter for an HTTP API"
      observed: Pi implemented the rate limiter straight through; no
      `★ Insight ──────` box, no pause to request a 5-10 line code
      contribution at the policy-choice decision point, no mention of
      "learning mode". This is the same output as with the plugin
      uninstalled.
  conclusion: |
    The plugin's intended behavioral effect (additionalContext injected
    into the session prompt) is not reaching the model. The dispatch
    pipeline works but the context-injection pipeline is severed at
    adaptObservationResult's mutate arm.

## Eliminated

(none -- diagnosis was confirmed by the source-code trace before this
session opened. No alternate hypotheses to eliminate.)

## Resolution

(to be populated after the fix is applied and re-verification passes.)

root_cause: |
  Pi's event lifecycle splits "session lifecycle" (session_start, return
  void) from "context injection" (before_agent_start, return
  systemPrompt). The Claude Code SessionStart-hook protocol assumes a
  unified surface. Phase 63's bridge subscribed session_start (correctly
  mirroring the upstream event name) but never wired the additionalContext
  payload over to Pi's actual context-injection slot. adaptObservationResult
  silently drops the mutate arm because the session_start handler return
  type IS void -- the drop is honest at the per-event level but the
  bridge is missing the cross-event plumbing.

fix: |
  Added the missing cross-event plumbing between Pi's `session_start`
  (void return slot) and `before_agent_start` (carries the systemPrompt
  chain extensions use to inject context into the next agent turn).

  Four atomic commits on features/v1.13-hook-bridge:

      f99f48d test(63): RED regression test for SessionStart additionalContext drain
      ce59eda fix(63): bridge SessionStart additionalContext to before_agent_start
      1ccd511 test(63): integration test for SessionStart additionalContext drain
      cbc4206 test(63): drop redundant type assertion in additionalcontext e2e

  Implementation:

    1. `bridges/hooks/event-router.ts` gains a
       `pendingSessionStartContext: string[]` module cell, an
       `appendPendingSessionStartContext(text)` setter, and a
       `beforeAgentStartHandlerFor(capturedEpoch)` factory.

    2. The before_agent_start handler reads `event.systemPrompt`,
       joins it with the buffered context via `\n\n` separators,
       returns `{ systemPrompt: <joined> }`, and clears the buffer.
       Subsequent agent turns drain to undefined (one-shot semantics).

    3. `bridges/hooks/event-adapters.ts` gains
       `adaptObservationResultForEvent(result, claudeEvent)`. The
       SessionStart mutate arm now calls
       `appendPendingSessionStartContext(result.additionalContext)`
       instead of silently dropping the payload. SessionEnd / PreCompact /
       PostCompact keep the silent-drop semantics -- no downstream Pi
       surface exists to carry their payloads. The legacy 4-arm
       `adaptObservationResult` shim is retained for the
       architecture-level exhaustiveness gate.

    4. `bridges/hooks/dispatch.ts` routes the four observation events
       through the per-event variant so the SessionStart capture path
       fires under production dispatch.

    5. `platform/pi-api.ts` re-exports BeforeAgentStartEvent and
       BeforeAgentStartEventResult from the peer dep.

    6. `registerHooksBridge` now registers 8 pi.on call sites:
       the 7 Bucket-A dispatch surfaces plus the new
       `before_agent_start` drain point. The buffer is cleared on
       every bridge entry so `/reload` cannot leak stale context
       across sessions. An epoch-mismatched stale closure
       short-circuits without draining the live buffer.

  Subtleties handled:

    - Multiple SessionStart-bearing plugins concat in declaration order
      (the bucket is already sort-stable via compareByNameThenScope +
      declarationIndex).
    - /reload re-emits session_start with reason="reload": buffer
      resets at registerHooksBridge entry so prior-session entries
      cannot accumulate.
    - Buffer does NOT leak across extension reloads. liveEpoch guards
      both the dispatch handlers AND the drain handler.
    - assertNever exhaustiveness pinning preserved on both the per-event
      variant AND the legacy shim (5 assertNever call sites total in
      event-adapters.ts vs the >= 4 required by the architecture gate).
verification: |
  TDD discipline: 12 unit tests authored RED in commit f99f48d,
  turned GREEN in ce59eda. Two integration tests (HOOK-E2E-03 and
  HOOK-E2E-04) added in 1ccd511 exercise the full handler-stdout-JSON
  -> wire-protocol parse -> mutate capture -> drain handler ->
  systemPrompt slot cycle through real `spawn(bash, [...])`. HOOK-E2E-04
  pins the /reload-clears-buffer contract by re-entering
  registerHooksBridge with a stale entry in the buffer.

  Test sweep (final, post-cbc4206):

      typecheck   PASS  (npx tsc --noEmit)
      lint        PASS  (eslint .)
      format      PASS  (prettier --check)
      unit tests  2296 pass + 1 skipped (up from 2285 + 1 in the
                  prior bug 3 close); 11 net-new passing assertions
                  from session-start-additional-context.test.ts plus
                  the 2-event-count bumps in tests/architecture/
                  hooks-dispatch.test.ts DISP-01 and
                  tests/shared/index-smoke.test.ts.
      integration 14 pass (up from 12); HOOK-E2E-03 and HOOK-E2E-04
                  cover the wire-side end-to-end path.

  Pending operator runtime probe to flip status from
  `resolved-pending-runtime` to `resolved`: re-run the rate-limiter
  probe against the pi-uat sandbox and confirm the `★ Insight` box
  / contribution-request markers from learning-output-style's prompt
  now appear:

      # Source handler is already in place from bug 3's probe; no
      # re-install needed -- additionalContext is delivered via the
      # source tree's hooks-handlers/session-start.sh stdout.
      scripts/pi.sh --home /home/acolomba/pi-claude-marketplace/tmp/pi-uat
      # In the Pi REPL:
      write me a simple in-memory rate limiter for an HTTP API

  Expected: Pi prefixes design-decision discussion with the literal
  `★ Insight ──────` box (or similar learning-mode framing) and pauses
  to request a 5-10 line user code contribution at the algorithm-choice
  point. This was absent in the pre-fix behavioral probe at
  2026-06-17T08:30Z.
files_changed:
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - tests/architecture/hooks-dispatch.test.ts
  - tests/shared/index-smoke.test.ts
  - tests/bridges/hooks/session-start-additional-context.test.ts
  - tests/integration/hooks-additionalcontext-end-to-end.test.ts
