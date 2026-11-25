# Quick 261123-gti: HOOKASYNCRESUME-01 (async SessionStart answer repeats on resume) - Research

**Researched:** 2026-11-23
**Domain:** hooks bridge, async lane (`bridges/hooks/async-rewake/registry.ts`) + HKRL-02 duplicate removal (`bridges/hooks/event-adapters.ts`)
**Confidence:** HIGH (upstream read from the 2.1.330 binary; product path read in source)

## Summary

Claude Code does **not** reuse HKRL-02's resume comparator (`W6e`/`R2n`) for async answers. Its 2.1.295 fix lives in the async attachment collector: `CFi` drops a SessionStart `async_hook_response` when `o0o` finds that the conversation already holds the same text. `o0o` is a different rule from W6e. It scans the conversation backward for the nearest SessionStart entry that carries text. It skips async entries of *other* hooks. It drops the answer only if **every** text of the answer is in that one entry (all-or-nothing). It is not gated on `resume`/`fork`, and it does not normalize `saved to:` paths, because it compares the raw response. Sync resume deduplication (`R2n`) does **not** read async entries.

Today the bridge sends each async text as its own `claude-hook-async-response` message with `deliverAs: "nextTurn"` and `details: { pluginId, dispatchId }`. Nothing reads these messages back. So on a resume, an unchanged async SessionStart answer reaches the model a second time, after the second prompt.

**Primary recommendation:** Add a leaf module `bridges/hooks/session-start-context.ts`. Move the HKRL-02 key helpers into it (`contextKey`, the details guard, the sync `messageKeys`). Add an `o0o`-equivalent there (`asyncAnswerHeld`). In `sendAsyncAnswer`, for `claudeEvent === "SessionStart"` only: (a) read the projection, (b) skip the whole answer when it is held, and (c) otherwise send each text with `details: { pluginId, dispatchId, event: "SessionStart", values: <all capped texts>, command }`. Leave the sync path's `novelSessionStartValues` blind to async messages, as upstream's `R2n` is.

## 1. Upstream contract (Claude Code 2.1.330, `/opt/claude-code/bin/claude`, `claude --version` = 2.1.330; byte offsets from `grep -boa`)

- **Delivery.** `Wf("async_hook_responses",async()=>CFi(h??[],o))` @326761922 is part of the attachment collection that runs for each query. Async answers are picked up at the next model call, as Pi's `nextTurn` does. [VERIFIED: binary]
- **The 2.1.295 check, `CFi` @326831939:** `H==="SessionStart"&&o0o({response:k,command:qe,pluginId:X},g)` → `t("Hooks: Not adding the output of ... Claude already sees the same text from an earlier SessionStart run");continue`. `g` = the attachments of `Or(e)`. Each attachment the check keeps is pushed onto `g`, so a second answer in the same batch is compared with the first. The `async_hook_response` carries `command` and `pluginId` only for SessionStart: `...H==="SessionStart"&&{command:qe,pluginId:X}`. [VERIFIED: binary]
- **`o0o` @~326742700 (verbatim):** `let r=D7(e.response);if(r.length===0)return!1;for(let g=o.length-1;g>=0;g--){let h=KDi(o[g]);if(h===void 0)continue;let y=h.command===e.command&&h.pluginId===e.pluginId;if(h.command!==void 0&&!y)continue;if(h.texts.length>0)return r.every((k)=>h.texts.includes(k));if(y&&h.exitCode===0)return!1}return!1`. [VERIFIED: binary]
- **`KDi`** parses only SessionStart `async_hook_response` (`texts:D7(response)` plus command, pluginId, and exitCode), `hook_additional_context` (`texts:content`), and `hook_success` (`texts:[content]` if non-empty). [VERIFIED: binary @326742161]
- **`D7` @322922176:** `[systemMessage, hookSpecificOutput.additionalContext].filter(non-empty string)`, so **systemMessage counts as a text**. [VERIFIED: binary]
- **No path normalization.** `o0o` compares the raw strings of the stored response. `gTt` (the `saved to: <persisted>` rewrite) is used only by `R2n`. [VERIFIED: binary @324043133-324043600]
- **Sync comparator ignores async.** `R2n` keys only `hook_additional_context`, `hook_success`, and `hook_non_blocking_error`, with no `async_hook_response`. [VERIFIED: binary @324043133]
- **Source.** No source gate. It applies wherever the conversation holds a matching entry: resume, `--fork-session`, and `/branch` (which copies attachments, per 06.1-UPSTREAM-EVIDENCE-FORK-COMPACT.md), and also startup, clear, or compact if a sync SessionStart entry of that run holds the same text. `Or(e)` probably slices from the last compact boundary (`function Or(e,r){let o=Yxe(e);return o===-1?e:e.slice(o)}`, where `Yxe` = last index matching `On`). [ASSUMED: same minified name in another chunk; MEDIUM]
- **What the model sees.** The renderer `case"async_hook_response"` @327650554 emits `Me({content:RF(systemMessage),isMeta:!0})`, then `Me({content:RF(additionalContext)})`. That is **no SessionStart label**: the text goes out raw, escaped against `<system-reminder>`. The one exception is `isPlainOutput`, which gets `"<hookName> hook success: <ctx>"`. The bridge's current raw content already matches. [VERIFIED: binary]
- **CHANGELOG.** `## 2.1.295`: "Fixed an async SessionStart hook's unchanged context being added to the conversation again on every resume". [VERIFIED: raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md line 3028, fetched 2026-11-23]

## 2. Current product path

- **The constant.** `const ASYNC_RESPONSE_CUSTOM_TYPE = "claude-hook-async-response" as const;` [VERIFIED: registry.ts:146]
- **`sendAsyncAnswer` (registry.ts:714-750).** It caps each `asyncAnswerTexts` text (`capHookContext`, which can save to `hook-${id}-${source}.txt` with id = dispatchId, so the path differs per run), checks the generation, then for each text: `pi.sendMessage({ customType: ASYNC_RESPONSE_CUSTOM_TYPE, content, display: false, details: { pluginId: entry.pluginId, dispatchId: entry.dispatchId } }, { deliverAs: "nextTurn" })`. [VERIFIED: registry.ts:735-745] It has no label and no `event`, and nothing reads these messages back.
- **Available at answer time.** `RewakeExit` holds `ctx`, `pi`, `runtime`, `label`, `lane`, and `saveHookOutput` (registry.ts:187-194). `ctx.sessionManager.buildSessionProjection()` works there: the child was spawned during `session_start`, after Pi loaded the resumed conversation. The hook command is `entry.handlerDecl.command?: string` (`domain/components/hooks/schema.ts:6`). `HooksRuntimeChildEntry` does not carry it, so put `command` (and `claudeEvent`) on `RewakeExit` in `spawnAndRegister` (registry.ts:370-377). The source (`(event as ClaudeSessionStartEvent).source`, payloads/session-start.ts:27-28) is available there too, but upstream does not need it.
- **Pi `nextTurn`.** `if (options?.deliverAs === "nextTurn") { this._pendingNextTurnMessages.push(appMessage); }` (agent-session.js:1956-1957). These messages are injected after the starting prompt: `messages.push(...this._pendingNextTurnMessages);` (:1576). They are persisted with their details at `message_end`: `appendCustomMessageEntry(event.message.customType, event.message.content, event.message.display, event.message.details)` (:819). [VERIFIED: node_modules/@earendil-works/pi-coding-agent 1.5.1] So the first session's answer is in the session file, with details, after the first prompt. A **pending** (not yet prompted) answer is not in the projection.
- **HKRL-02 helpers (all private to event-adapters.ts).** `SESSION_START_CONTEXT_LABEL = "SessionStart hook additional context: "` (:793), `PERSISTED_OUTPUT_PREFIX = "<persisted-output>"` (:796), and `contextKey` (:801-805), which rewrites `/(saved to: ).*$/mu` → `"$1<persisted>"`. `messageKeys` (:828-845) accepts only `message.customType !== HOOK_CONTEXT_MESSAGE_TYPE` → `[]`. `heldContextKeys` (:851-858) reads `buildSessionProjection().messages`, and a read that throws gives an empty Set. `novelSessionStartValues` (:864-879) is gated `if (source !== "resume" && source !== "fork") return values;`. `HOOK_CONTEXT_MESSAGE_TYPE = "claude-hook-additional-context"` (:556) is exported and imported by event-router.ts:89. [VERIFIED: event-adapters.ts read this session]

## 3. Design (smallest change that matches upstream)

1. **New leaf `bridges/hooks/session-start-context.ts`** (zone `bridges-hooks`, so there are no new boundary edges). Move these from event-adapters.ts: the label, the prefix, `contextKey`, `SessionStartContextDetails` + guard, and `messageKeys` (exported as the sync key reader). Add the async SessionStart details type + guard and `asyncAnswerHeld(messages, answer: { pluginId, command, keys })`. The latter ports `o0o`: walk the messages backward. A `HOOK_CONTEXT_MESSAGE_TYPE` message with SessionStart parts gives texts = `messageKeys(m)` and no hook. A `claude-hook-async-response` message whose details have `event: "SessionStart"` gives hook = (pluginId, command) and texts = `values.map(contextKey)`. Skip other messages and other hooks' async messages. The first entry with texts decides `keys.every(k => texts.has(k))`. Move both custom-type strings into the leaf, because event-adapters cannot import registry, so the reader needs both constants in one place. event-adapters.ts and event-router.ts import `HOOK_CONTEXT_MESSAGE_TYPE` from the leaf, and registry imports the async one. `fallow trace` shows no path from event-adapters to registry today [VERIFIED: `fallow trace --path`], so neither direction makes a cycle. The leaf is still needed because the reader must know both types.
2. **registry.ts `sendAsyncAnswer`.** When `entry.claudeEvent === "SessionStart"`, read `exit.ctx.sessionManager.buildSessionProjection().messages` in a try/catch; on a throw, hold nothing and send (NFR-2, as `heldContextKeys` does). If `asyncAnswerHeld` matches, `hookDebugLog` and return without sending. Otherwise send each text with `details: { pluginId, dispatchId, event: "SessionStart", values: texts, command }`. Every message of the answer carries the whole answer, so the backward scan sees the whole answer on its last message. Other events keep today's details, so the UserPromptSubmit tests at registry.test.ts:440 and :5788 stay unchanged.
3. **Keys: use `contextKey` on the capped texts.** Pi's capped text names a per-dispatch file, and upstream compares the uncapped response. Normalizing the path is the nearest equivalent, and it is HKRL-02's existing key. **A sync value and an async text with the same text count as the same value**, because upstream `o0o` reads `hook_additional_context`. In the reverse direction (sync on resume vs a held async text), they do **not** match, because upstream `R2n` ignores async. So `novelSessionStartValues` keeps the sync-only `messageKeys`.
4. **No source gate**, as upstream. The planner may prefer gating on resume/fork, as the task text says. That diverges only on startup, clear, or compact when a sync SessionStart value equals the async text. Recommend no gate; it is also less code.

**Known Pi gaps to record (no license needed beyond the Pi capability gap):**
- An empty async answer sends nothing, so it leaves no entry. Upstream's `if(y&&h.exitCode===0)return!1` cannot apply.
- Messages written before this change have no `event`, so the first resume after upgrading repeats once.
- The decision is made at child exit, not at the next query. An earlier answer that is still pending in `_pendingNextTurnMessages` is invisible to it.

## 4. Cucumber scenario (features/hook/async.feature)

There is no async SessionStart answer scenario today (async.feature:413/432 SessionStart rows only test the stop on `/reload`). The resume steps exist: `Given pi runs with the scripted model and saves its session`, and `Given the user has started pi again and continued the last session` (session.steps.ts:451, `restartPi("continue-session")`). Under Pi's `--continue`, the launch maps to source `resume` (payloads/session-start.ts:63, `launch.holdsMessages ? "resume" : "startup"`), and `new_session` maps to `clear` (:77-78). Rule: every `Given` comes before the first `When` (cucumber rules/features.md:41). So **add a `Given` twin** of `When the user releases the hook {string} and pi handles its exit` (async.steps.ts:207-219), e.g. `Given the user has released the hook {string} and pi has handled its exit`. It is the same body without `keepTurn`, as `the user has prompted ... goes on in the background` pairs with its `When` (prompt-and-stop.steps.ts:235-247).

```gherkin
  Scenario: A continued session does not give the model an unchanged async session start answer again
    Given pi runs with the scripted model and saves its session
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event        | matcher | form   | async | waits | output                                                                                  |
      | later | SessionStart |         | script | true  | true  | {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"async-ctx"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Hello. |
      | Done.  |
    Given the user has released the hook "later" and pi has handled its exit
    Given the user has prompted "first prompt"
    Given the user has started pi again and continued the last session
    Given the user has released the hook "later" and pi has handled its exit
    When the user prompts "second prompt"
    Then the model receives these calls:
      | call | role      | text          |
      | 2    | user      | first prompt  |
      | 2    | user      | async-ctx     |
      | 2    | assistant | Hello.        |
      | 2    | user      | second prompt |
```

- **Red today:** call 2 ends with an extra `| 2 | user | async-ctx |` after `second prompt`, so the `Then` fails. [ASSUMED: from the code path; run it to confirm]
- **Breaks on the fixed code:**
  - B1: `asyncAnswerHeld` always returns false.
  - B2: the reader ignores the `claude-hook-async-response` type.

  Each must fail the same `Then`. The summary line has the form `N) <title> # features/hook/async.feature:<line>`.
- **Optional guard scenario** against over-removal: a second async hook `fresh` with matcher `resume` and output `fresh-ctx`. Its answer must still arrive on the resume, because another hook's async entries are skipped. A break that drops held text from any hook fails it.
- Leave the scenario untagged (builtin profile selects 0, DUAL-02).

## 5. Pitfalls

- **Async timing.** Use `waits: true` and the release step. A non-waiting hook races the prompt: its answer may become pending after the first prompt and show up only in call 2. `releaseWaitingHook` writes the marker with `wx` and waits until a run takes it. The hook gives up after `RELEASE_TENTHS = 600` (60 s, hook-files.ts:176). `waitForHandledExit` waits for the reap plus two `get_state` calls. `sendAsyncAnswer` awaits `capHookContext` before sending, which is fast for short text. Keep the answer under 10,000 characters in the main scenario.
- **`nextTurn` on resume.** The answer stays in memory (`_pendingNextTurnMessages`) until the next prompt and goes **after** the prompt. Expected rows are prompt, then answer. A restart before a prompt loses a pending answer, which upstream also does in effect. The first session's answer is held in the projection only because "first prompt" persisted it.
- **Direct coverage.** Moving code into the leaf means `test/bridges/hooks/session-start-context.test.ts` must cover every branch alone: the string-content part, a non-label part, a details/join mismatch, an older message with no details, an async message without `event`, another hook, the nearest-entry decision, and an empty scan. event-adapters tests no longer count for that code. registry.test.ts already uses `SessionManager.inMemory` (registry.test.ts:648), so a test can `appendCustomMessageEntry` held messages. Run coverage under `env -i ...`, as 06.1 did.
- **Complexity gates.** Keep the backward scan flat. ESLint cognitive complexity 15 and fallow cognitive 15 / cyclomatic 20 are scored separately. Extract `entryOf(message)` so the loop stays simple.
- **Stale ctx** after a session replacement: the projection read throws, so the bridge sends; then `sendMessage` throws, which is logged. Never rethrow.

## Docs and records

- `docs/hooks-compatibility.md:364` (the `async` row) and `:462` (the SessionStart paragraph): add one sentence. An `async` SessionStart answer that the conversation already holds unchanged (every text, compared with the nearest earlier SessionStart context, from the same hook or a synchronous one) is not added again, as Claude Code 2.1.295 does. It then states the gaps above.
- CHANGELOG parent line for the SUMMARY: "An `async` SessionStart hook's unchanged answer no longer reaches the model again on every resume, as in Claude Code 2.1.295."
- SUMMARY needs `## Threat Flags` (None).

## Assumptions Log

| # | Claim | Risk if wrong |
|---|-------|---------------|
| A1 | `Or(e)` = messages from the last compact boundary | Post-compaction async answers might be compared with pre-compaction entries upstream; Pi's projection behavior would differ only after a compaction |
| A2 | The scenario fails today on the `Then` (not earlier) | The red-proof grep needs adjusting |
| A3 | `contextKey` on capped text is an acceptable stand-in for upstream's raw comparison | Two different >10k texts with the same 2 KB preview and size label would be treated as the same |

## Validation

- Unit tests: `test/bridges/hooks/session-start-context.test.ts` (new) and `test/bridges/hooks/async-rewake/registry.test.ts` (the SessionStart held, changed, sync-held, other-hook, and read-throws cases). Direct coverage: `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/session-start-context.ts extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`.
- Scenario: `npm run test:cucumber:profile -- --profile adapter --parallel 2 features/hook/async.feature features/hook/additional-context.feature`. The HKRL-02 scenarios must stay green.
- Gate: `npm run check` after the merge, per AGENTS.md.

## Sources

- Claude Code 2.1.330 binary `/opt/claude-code/bin/claude`: `CFi`, `o0o`, `KDi`, `D7`, `R2n`, `gTt`, the `async_hook_response` renderer (offsets above).
- Upstream CHANGELOG 2.1.295 (raw GitHub, 2026-11-23).
- Pi 1.5.1 `dist/core/agent-session.js` lines 1576, 1956-1957, 819.
- Repo: registry.ts, async-answer.ts, event-adapters.ts, payloads/session-start.ts, features/hook/{async,additional-context}.feature, features/step_definitions/hook/{async,session,prompt-and-stop}.steps.ts, features/lib/hook-files.ts, and the 06.1 evidence records.
