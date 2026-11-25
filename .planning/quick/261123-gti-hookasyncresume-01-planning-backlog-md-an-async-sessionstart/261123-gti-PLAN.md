---
phase: quick-261123-gti
plan: 01
type: execute
wave: 1
quick_id: 261123-gti
depends_on: []
files_modified:
  - features/hook/async.feature
  - features/step_definitions/hook/async.steps.ts
  - extensions/pi-claude-marketplace/bridges/hooks/session-start-context.ts
  - test/bridges/hooks/session-start-context.test.ts
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - test/bridges/hooks/async-rewake/registry.test.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - docs/hooks-compatibility.md
  - .planning/quick/261123-gti-hookasyncresume-01-planning-backlog-md-an-async-sessionstart/261123-gti-SUMMARY.md
autonomous: true
requirements:
  - HOOKASYNCRESUME-01
must_haves:
  truths:
    - "On a continued session, an async SessionStart hook whose answer the conversation already holds unchanged gives the model no second copy: call 2 of the new scenario is `first prompt`, `async-ctx`, `Hello.`, `second prompt`, `fresh-ctx`, as Claude Code 2.1.295's `o0o` decides it (HOOKASYNCRESUME-01)."
    - "An async SessionStart answer that the conversation does not hold still reaches the model's next call: the resume-only hook's `fresh-ctx` follows `second prompt`, so an implementation that drops every SessionStart answer fails the scenario (break B3)."
    - "The check reads the nearest SessionStart context with text, which is a synchronous context or an earlier answer of the same hook (plugin, marketplace, and declared command); it skips the answers of other hooks, holds the answer only when that context has every one of its texts, and runs for every source."
    - "The check compares the hook's own texts before the 10,000-character cap, kept whole in the answer's `details.values`, so an unchanged answer that the bridge saved to a file is held too, as upstream compares the uncapped response; no saved-file path is normalized."
    - "The synchronous HKRL-02 resume check still reads only `claude-hook-additional-context` messages and keeps its saved-path key; every existing case of `event-adapters.test.ts`, `event-router.test.ts`, and `registry.test.ts` passes unchanged, and every scenario of `features/hook/` passes under the adapter profile."
    - "An answer of any other event keeps the details `{ pluginId, dispatchId }`; a session that cannot be read holds nothing, so the answer is sent and a debug line is written (NFR-2); a held answer writes a debug line and saves no file."
    - "The scenario failed in its `Then` on the code without the fix (R0, logged before the fix commit), and breaks B1, B2, and B3 on the fix commit each fail the same `Then`, with `extensions/` restored clean; `check-red.mjs` prints `RED-PROOFS OK` for the `red-` and the `fix-` tables."
  artifacts:
    - path: extensions/pi-claude-marketplace/bridges/hooks/session-start-context.ts
      provides: "the two custom types, the synchronous SessionStart value reader, and the async answer check"
      exports: ["HOOK_CONTEXT_MESSAGE_TYPE", "ASYNC_RESPONSE_CUSTOM_TYPE", "SessionStartContextDetails", "AsyncAnswerHook", "AsyncSessionStartDetails", "sessionStartValues", "asyncAnswerHeld"]
    - path: test/bridges/hooks/session-start-context.test.ts
      provides: "the leaf's own 22 cases, 100% direct coverage alone"
    - path: features/hook/async.feature
      provides: "the continued-session scenario at line 261"
      contains: "Scenario: A continued session adds an async session start answer only when the conversation does not hold it"
    - path: features/step_definitions/hook/async.steps.ts
      provides: "the setup twin of the release step"
      contains: "the user has released the hook {string} and pi has handled its exit"
    - path: docs/hooks-compatibility.md
      provides: "the async SessionStart answer check and its three known gaps"
      contains: "Claude Code 2.1.295"
  key_links:
    - from: extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
      to: extensions/pi-claude-marketplace/bridges/hooks/session-start-context.ts
      via: "sendAsyncAnswer -> sessionStartAnswerHeld -> asyncAnswerHeld(ctx.sessionManager.buildSessionProjection().messages, hook, values) before the cap; answerDetails builds AsyncSessionStartDetails; sendMessage uses ASYNC_RESPONSE_CUSTOM_TYPE"
      pattern: "asyncAnswerHeld\\(ctx\\.sessionManager\\.buildSessionProjection\\(\\)\\.messages, hook, values\\)"
    - from: extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
      to: extensions/pi-claude-marketplace/bridges/hooks/session-start-context.ts
      via: "messageKeys keys sessionStartValues through contextKey; sendHookContextMessage sends HOOK_CONTEXT_MESSAGE_TYPE; HookContextSend.details is SessionStartContextDetails"
      pattern: "sessionStartValues\\(message\\)\\.map\\(\\(value\\) => contextKey\\(value\\)\\)"
    - from: extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
      to: extensions/pi-claude-marketplace/bridges/hooks/session-start-context.ts
      via: "HOOK_CONTEXT_MESSAGE_TYPE for the run-start context message and isHeldHookContext"
      pattern: "import \\{ HOOK_CONTEXT_MESSAGE_TYPE \\} from \"\\./session-start-context\\.ts\";"
    - from: features/hook/async.feature
      to: extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
      via: "the second release of `later` on the continued session reaches sendAsyncAnswer, which holds the answer; the release of `fresh` sends `fresh-ctx`"
---

# Quick 261123-gti: an unchanged async SessionStart answer is not added again on resume

<objective>
Close HOOKASYNCRESUME-01 (`.planning/BACKLOG.md:5532`). A plain `async` SessionStart hook's answer
reaches the model as `claude-hook-async-response` messages sent with `deliverAs: "nextTurn"`, whose
details hold only `{ pluginId, dispatchId }`. Nothing reads them back, so a resumed or forked
session gives the model the same answer again after its next prompt. Claude Code 2.1.295 fixed the
same repeat ("Fixed an async SessionStart hook's unchanged context being added to the conversation
again on every resume").

Port upstream's check, as the orchestrator decided (this overrides the task text's "apply the
HKRL-02 duplicate removal"): `o0o` in the async collector `CFi`. When the hook ends, the nearest
SessionStart context with text in the conversation decides alone. That context is a synchronous
context or an earlier answer of the same hook; the answers of other hooks are skipped. The answer
is not sent when that context has every one of its texts (all or nothing). No source gate. The
synchronous HKRL-02 reader stays blind to async answers, as upstream's `R2n` is.

Test first: the new scenario and its setup step fail in the `Then` on the code without the fix
(R0). Then the leaf module, the registry wiring, the moved reader, and the unit cases go in, and
one commit holds all eight files, so no commit holds a red scenario or an unpaired source. Breaks
B1, B2, and B3 on the fix commit fail the same `Then`. The docs follow in a commit of their own.

Purpose: the AGENTS.md upstream-parity constraint, and its rule that a user-visible change ships
with a scenario that fails without it.

Output: two commits (the fix; the docs) and `261123-gti-SUMMARY.md` with the red proofs, the
checks, the decisions, and the lines for the orchestrator.
</objective>

<execution_context>
@/home/user/pi-claude-marketplace/.claude/gsd-core/workflows/execute-plan.md
@/home/user/pi-claude-marketplace/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@.planning/quick/261123-gti-hookasyncresume-01-planning-backlog-md-an-async-sessionstart/261123-gti-RESEARCH.md
@.agents/skills/cucumber/rules/features.md
@.agents/skills/cucumber/rules/steps.md
@.agents/skills/typescript-unit-tests/rules/cases.md
@.agents/skills/typescript-unit-tests/rules/test-doubles.md
@.agents/skills/typescript-style/rules/comments.md
@.agents/skills/local-verification/rules/commands.md
@.agents/skills/committing/SKILL.md

`261123-gti-RESEARCH.md` is the research. Read its sections "Summary", "1. Upstream contract",
"2. Current product path", "4. Cucumber scenario", and "5. Pitfalls". Where this plan and the
research differ, this plan wins: the planner built the whole change on a scratch worktree of
85c323b and measured every count, coverage figure, gate, and break below.

All line numbers below were read at 85c323b.

**Where this plan differs from the research (measured):**

1. The check compares the hook's raw texts before the cap, kept whole in `details.values`. It does
   not key capped texts with `contextKey`. This resolves the research's assumption A3; the evidence
   follows.
2. `contextKey` and the saved-output prefix stay in `event-adapters.ts`: they belong to the
   synchronous check alone, as upstream's `gTt` belongs to `R2n` alone. The leaf takes only the
   label, the details type and guard, the value reader, and the two custom types.
3. The hook's identity has the marketplace too, because upstream's `pluginId` is
   `<plugin>@<marketplace>` (its `is` @311505842 reads the marketplace as the text after the last
   `@` of a plugin id, and `CFi` classifies the answer's plugin with it), and the bridge's
   `pluginId` is the bare plugin name.
4. The scenario has a second, resume-only hook `fresh`, so an implementation that drops every
   async SessionStart answer fails it (break B3). No separate guard scenario: the identity rule
   (another hook's answer is skipped) is pinned by unit rows, and a guard scenario could not pin
   it, because no answer of `fresh` is nearer than its own.

**Upstream contract, and the saved-file path (research A3).** Measured on
`/opt/claude-code/bin/claude` (`claude --version` prints 2.1.330), byte offsets from `grep -boa`:

- `O$r` @322928931 builds an async answer's `response` from the parsed JSON object. Nothing caps
  its `systemMessage` or `additionalContext`; only a plain-output answer is cut.
- `CFi` @326831939 stores the attachment with `response:hwn(k)` @326832876, and `hwn` @322922328
  removes only `metrics`.
- `o0o` @326742726 compares `D7(e.response)` (`let r=D7(e.response);if(r.length===0)return!1`
  @326742744) with the texts of the stored entries as they are.
- `yLe` @319414042 writes the `<persisted-output>` file. The synchronous hook paths call it
  (@326982601, @327010240, @327018749), and the async collector does not.

So upstream compares the hook's own uncapped texts, which hold no saved-file path, and it holds an
unchanged answer of any length. Pi's message content is the capped text, whose saved file
`hook-<dispatchId>-<source>.txt` differs per dispatch. Comparing that content raw would add a long
unchanged answer again on every resume. Keying it with `contextKey` would treat two long texts
with the same 2 KB preview and the same size label as one (research A3). Both are divergences, and
neither has a license. Pi can keep the uncapped texts in the message's details, so there is no Pi
capability gap: the bridge stores every uncapped text of a SessionStart answer in `details.values`
and compares raw. Against a synchronous context, which holds capped values, the raw comparison
matches a text of at most 10,000 characters and never a longer one, as upstream's raw comparison
against its capped `hook_additional_context` content does.

**The planner's inputs.** `$S` = `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad`.
`$I` = `$S/quick-261123-gti-inputs/`, listed in `$I/SHA256SUMS`; `$I/README.md` says what each
file is:

- `$I/brk/R0.json`: the empty edits file of the natural red run.
- `$I/brk/B1.json`, `$I/brk/B2.json`, `$I/brk/B3.json`: the three break definitions. Their old
  texts are the three prescribed lines of "The fix" below, so they apply only when Task 1 writes
  those lines as prescribed.
- `$I/ref/planner-prototype.diff`: the planner's measured prototype of the eight files. Read it as
  text for wording and placement. Never apply it, and never copy a test from it before you have
  written and run that test's red form yourself.
- `break.sh` and `check-red.mjs` are the reference tools in `$S/fix-07b/`; Task 1 copies them.

**The defect** (research section 2). `sendAsyncAnswer` (`bridges/hooks/async-rewake/registry.ts:704-750`)
caps each text of the answer and sends it with `details: { pluginId: entry.pluginId, dispatchId:
entry.dispatchId }` (`:742`). The custom type is the module-private constant at `:142-146`.
Nothing reads these messages back, and HKRL-02's reader (`event-adapters.ts:828-845`) accepts only
`claude-hook-additional-context`. Pi persists a `nextTurn` message with its details once a prompt
sends it, and the projection of a resumed session returns it with the details.

**The fix.**

1. New leaf `extensions/pi-claude-marketplace/bridges/hooks/session-start-context.ts` (fallow zone
   `bridges-hooks`; its one import is `import type { AgentMessage } from "../../platform/pi-api.ts";`).
   A file header says that the module reads back the SessionStart context that the conversation
   holds, that two kinds of message carry it (the synchronous hooks' hidden context message,
   HKRL-01 and HKRL-02, and a plain async hook's answer, D-BG-205), and that both readers live here
   beside the two custom types because each check needs what the other kind writes. Exports:
   - `HOOK_CONTEXT_MESSAGE_TYPE`, with the value `"claude-hook-additional-context"` and its JSDoc,
     moved from `event-adapters.ts:555-556`.
   - `ASYNC_RESPONSE_CUSTOM_TYPE`, with the value `"claude-hook-async-response"` and its D-BG-205
     JSDoc, moved from `registry.ts:142-146`.
   - `interface SessionStartContextDetails` (`event`, `values`), moved from
     `event-adapters.ts:577-585` with its HKRL-02 JSDoc and now exported.
   - `interface AsyncAnswerHook`: readonly `pluginId: string`, `marketplace: string`, and
     `command: string | undefined`. Its JSDoc says this is the hook of an async SessionStart
     answer as Claude Code 2.1.295 names it, the plugin and the command the hook declares
     (HOOKASYNCRESUME-01).
   - `interface AsyncSessionStartDetails extends AsyncAnswerHook, SessionStartContextDetails`,
     with readonly `dispatchId: string`. Its JSDoc says that `values` holds every text of the
     answer before the 10,000-character cap, as Claude Code keeps the hook's own response, so a
     later check compares the texts that the hook gave and not the per-run path of a saved file.
   - `sessionStartValues(message: AgentMessage): readonly string[]`: the body of
     `event-adapters.ts`'s `messageKeys` (`:828-845`) with its two `contextKey` calls removed, so
     it returns `details.values` when they join to the labeled rest, else `[text]`. Its JSDoc is
     the comment of `:821-827`, reworded to "values ... as written".
   - `asyncAnswerHeld(messages: readonly AgentMessage[], hook: AsyncAnswerHook, texts: readonly
     string[]): boolean`. Its JSDoc says: whether the conversation already holds every text of the
     hook's async SessionStart answer, as Claude Code 2.1.295 decides it; the nearest SessionStart
     context with text decides alone, which is a synchronous context or an earlier answer of the
     same hook; the answers of other hooks are skipped; an answer with no text is never held.

   Module-private: the label constant, moved from `event-adapters.ts:792-793`; the details guard,
   moved unchanged from `:807-819`; a `HeldContext` interface (an optional `hook` and `texts`); an
   async details guard that is the sync guard plus string `pluginId`, `marketplace`, and `command`;
   `heldContextOf(message)`, which gives an async-type message's hook and `values` when its
   details pass that guard, gives a synchronous message's `sessionStartValues` when they are not
   empty, and gives undefined otherwise; and `sameHook(left, right)`, which compares the three
   identity fields. `asyncAnswerHeld` returns false for no texts; otherwise it maps the messages
   through `heldContextOf`, keeps each defined context that names no hook or the same hook, and
   takes `.at(-1)` as `nearest` (the target is ES2022, so `findLast` and `toReversed` are not in
   the lib). Two of the three lines that the block below prescribes word for word are in the
   leaf, because breaks B2 and B1 replace them: the first line of `heldContextOf` and the last
   line of `asyncAnswerHeld`.

2. `bridges/hooks/event-adapters.ts`: remove the four items that move (the constant and its JSDoc,
   the details interface and its JSDoc, the label and its comment, and the guard). Import
   `HOOK_CONTEXT_MESSAGE_TYPE`, `sessionStartValues`, and `type SessionStartContextDetails` from
   `./session-start-context.ts` in one import placed after `./hook-labels.ts` and before
   `./tool-input.ts` (ESLint `import-x/order`, measured). `messageKeys` keeps its name and
   signature; its body is exactly `return sessionStartValues(message).map((value) => contextKey(value));`
   and its comment says that it keys the values that `sessionStartValues` reads, and that the
   synchronous check reads no async answer, as Claude Code 2.1.330's resume check reads no
   `async_hook_response`. The saved-output prefix, `contextKey`, `heldContextKeys`,
   `novelSessionStartValues`, `sendSessionStartContext`, and `HookContextSend` stay as they are.

3. `bridges/hooks/event-router.ts`: drop `HOOK_CONTEXT_MESSAGE_TYPE` from the `./event-adapters.ts`
   import (`:87-93`), and add `import { HOOK_CONTEXT_MESSAGE_TYPE } from "./session-start-context.ts";`
   after the `./routing-state.ts` import (`:104-112`) and before `./settle.ts` (`:113`).

4. `bridges/hooks/async-rewake/registry.ts`:
   - Remove the custom-type constant and its JSDoc (`:142-146`). Import `ASYNC_RESPONSE_CUSTOM_TYPE`,
     `asyncAnswerHeld`, `type AsyncAnswerHook`, and `type AsyncSessionStartDetails` from
     `../session-start-context.ts` in one import after `../process-group.ts` and before
     `../spawn-helpers.ts` (measured).
   - `RewakeExit` (`:187-194`) gains `readonly command: string | undefined;` between `lane` and
     `saveHookOutput`. Its JSDoc (`:181-186`) also names the command the hook declares, which names
     the hook of a SessionStart answer (HOOKASYNCRESUME-01).
   - `spawnAndRegister` sets `command: entry.handlerDecl.command,` in the `exit` literal
     (`:370-377`), after `lane`. Keep no `??` default: a hook that declares no command stores no
     command, so the reader never takes its answer as an entry, and its empty shell command answers
     nothing anyway.
   - `sendAsyncAnswer` takes `(entry: HooksRuntimeChildEntry, exit: RewakeExit)` and destructures
     `pi`, `runtime`, and `saveHookOutput: save` from `exit` in its first line. After the existing
     no-answer debug line it computes `values` (`answer.map(({ text }) => text)`, the uncapped
     texts) and `hook: AsyncAnswerHook` (`pluginId` and `marketplace` from `entry`, `command` from
     `exit`). Then comes the held check in the prescribed form below: for a held answer it writes
     the debug line `` `async-hook: answer not added, the conversation holds its text (${entry.pluginId}/${entry.claudeEvent})` ``
     and returns, before `capHookContext`, so a held answer saves no file. Then it computes
     `details` with `answerDetails(entry, hook, values)`, and each `sendMessage` passes `details`.
     Extend its JSDoc (`:704-712`): a SessionStart answer whose every text the conversation already
     holds is not sent and saves no file, as Claude Code 2.1.295 decides it, and each message of a
     SessionStart answer keeps the hook and every uncapped text in its details (HOOKASYNCRESUME-01).
   - New module-private `sessionStartAnswerHeld(entry, ctx: ExtensionContext, hook, values)`, right
     after `sendAsyncAnswer`: it returns `asyncAnswerHeld(ctx.sessionManager.buildSessionProjection().messages, hook, values)`
     inside a `try`; its `catch (err: unknown)` writes the debug line
     `` `async-hook: session read failed (${entry.pluginId}): ${errorMessage(err)}` `` and returns
     false. Its comment says: the projection, never the branch, as the synchronous resume check
     reads it; a read that throws holds nothing, so the answer is sent (NFR-2).
   - New module-private `answerDetails(entry, hook, values)`, after it: for a `SessionStart` entry
     it returns `{ ...hook, dispatchId: entry.dispatchId, event: "SessionStart", values }`, typed
     as `AsyncSessionStartDetails`; for any other event, `{ pluginId: entry.pluginId, dispatchId:
     entry.dispatchId }`, so the UserPromptSubmit cases at `registry.test.ts:440` and `:5788` stay
     as they are.

The three prescribed lines, as Prettier formats them (the old texts of B2, B1, and B3):

```ts
  if (message.role === "custom" && message.customType === ASYNC_RESPONSE_CUSTOM_TYPE) {
```

```ts
  return nearest !== undefined && texts.every((text) => nearest.texts.includes(text));
```

```ts
  if (
    entry.claudeEvent === "SessionStart" &&
    sessionStartAnswerHeld(entry, exit.ctx, hook, values)
  ) {
```

**The scenario** (Task 1 inserts it into `features/hook/async.feature` after line 260, the blank
line that ends "A plain async hook's answer reaches the model's next call and never the user", and
adds one blank line after it, so its `Scenario:` line is 261 and "A plain async hook runs past its
declared timeout" moves from 261 to 292). It names no MCP step, table cell, or doc string, so it is
not an MCP scenario and carries no implementation tag (DUAL-02): the adapter profile runs it, and
the builtin profile selects no scenario of the file.

```gherkin
  Scenario: A continued session adds an async session start answer only when the conversation does not hold it
    Given pi runs with the scripted model and saves its session
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event        | matcher | form   | async | waits | output                                                                                  |
      | later | SessionStart |         | script | true  | true  | {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"async-ctx"}} |
      | fresh | SessionStart | resume  | script | true  | true  | {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"fresh-ctx"}} |
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
    Given the user has released the hook "fresh" and pi has handled its exit
    When the user prompts "second prompt"
    Then the model receives these calls:
      | call | role      | text          |
      | 2    | user      | first prompt  |
      | 2    | user      | async-ctx     |
      | 2    | assistant | Hello.        |
      | 2    | user      | second prompt |
      | 2    | user      | fresh-ctx     |
```

Measured on the old code: `1 scenario (1 failed)`, `18 steps (17 passed, 1 failed)`; the `Then`
at `features/step_definitions/model.steps.ts:137` fails, because call 2 has one more
`| 2 | user | async-ctx |` row, between `second prompt` and `fresh-ctx`. Measured with the fix:
`1 scenario (1 passed)`, `18 steps (18 passed)`, in about 15 seconds.

**The docs paragraph** (Task 3 inserts it into `docs/hooks-compatibility.md` as a new paragraph
right after line 462, the paragraph that starts "When `UserPromptSubmit` and
`UserPromptExpansion` give context for one prompt", with one blank line before and after it). The
`### Additional context` tables stay as they are, so no table is realigned:

```markdown
A plain `async` hook on `SessionStart` gives its answer to the model on the model's next call, after your prompt (D-BG-205). When the hook ends, the bridge looks back through the conversation for the nearest `SessionStart` context that has text. That context is the context of the synchronous hooks or an earlier answer of the same hook: the same plugin and the same `command`. The bridge skips the answers of other `async` hooks. When that context has every text of the answer, the bridge does not add the answer again, as Claude Code 2.1.295 does (HOOKASYNCRESUME-01). The bridge compares the texts that the hook printed, before the 10,000-character limit, because Claude Code compares the hook's own answer. So an unchanged answer that the bridge saved to a file is not added again either. For this check, the bridge keeps each text of the answer whole in the session file, as Claude Code keeps the answer in its transcript. The check runs for every `source`, not only for a resume or a fork. Three cases differ from Claude Code:

- An answer with no text leaves nothing in the conversation. When the same hook answers again later, Claude Code adds that answer, but the bridge compares it with an older context.
- An answer that an earlier release added has no record of its texts. So the first resume after the update adds that answer once more.
- The bridge decides when the hook ends, not when it adds the answer to the next model call, as Claude Code does. So it does not compare the answer with an earlier answer that still waits for your next prompt.
```
</context>

## Scope note

One plan, three tasks. Task 1 is the tracer: the whole user-visible slice, test first. Its commit
holds eight files because no smaller commit passes the commit hook or the rules: no commit may
hold a red scenario (the natural red is logged, never committed); `test:corresponding` rejects the
leaf without its test; direct coverage rejects `registry.ts` without its new cases; and the code
that moves out of `event-adapters.ts`, with the router's import, must land with the leaf that
receives it. Task 2 proves the scenario with three breaks and changes no tracked file. Task 3
updates the docs in a commit of its own (`docs/hooks-compatibility.md` is not a build input, so
the hook runs no npm check for it).

## Execution rules

- `$S` and `$I` are as in the context. This plan's own folder is `$D` = `$S/quick-261123-gti`, so
  `break.sh`, copied into it, finds `$S/nondac-sh` and `$S/phase07-heavy.lock` in its parent.
  Before Task 1, create `$D`, `$D/brk`, and `$D/bin`; write the output of `git rev-parse HEAD` to
  `$D/plan-base`; copy `$S/fix-07b/break.sh` and `$S/fix-07b/check-red.mjs` into `$D` unchanged;
  copy `$I/brk/R0.json`, `B1.json`, `B2.json`, and `B3.json` into `$D/brk/`; and link `$D/bin/fd`
  to `/usr/bin/fdfind`. Never write to `$I`, to `$S/fix-07b`, or to another folder of `$S`, and
  never run a file there.
- Run every command from the root of this plan's own checkout (`git rev-parse --show-toplevel`).
  Every repository path in this plan is relative to that root. Never read, write, or run tests in
  another checkout.
- Put this prefix before every npm script: `npm_config_script_shell=$S/nondac-sh
  NODE_OPTIONS=--max-old-space-size=6144`. Run unit files through the wrapper with a minimal
  environment, in the form of the verify commands: `env -i HOME="$HOME" PATH="$PATH" LANG=C.UTF-8
  TMPDIR=/tmp "$S/nondac-sh" -c "node --import \"$PWD/scripts/isolated-pi-home.mjs\" --test
  --test-reporter=spec <files>"`. Run direct coverage with `env -i HOME="$HOME" PATH="$PATH"
  LANG=C.UTF-8 TMPDIR=/tmp` before the prefix, as the orchestrator asked. The sibling item
  261123-gtg (c8df983) has since fixed the `dispatch-exec.test.ts` case that needed it, so it is a
  precaution now; the planner measured the four pairs passing both with and without it.
- Sibling executors may share the CPUs. Run every cucumber run, the ESLint warm-up, every
  `check:static`, and every commit under `flock -w 3600 "$S/phase07-heavy.lock"`, and pass
  `--parallel 2` right after `--profile <name>` in every cucumber run. `break.sh` takes the lock and
  `--parallel 2` itself. Every cucumber run, a `break.sh` run included, puts `$D/bin` first on
  `PATH`, for Pi's find tool.
- Pass a tool's own flags through `npx` only after `--` (`npx --no -- fallow dupes ...`).
- A cucumber run whose only failures are cucumber step timeouts is evidence of nothing: rerun it
  and keep the rerun's log. Decide a run by its exit status and the log it wrote; never pipe a
  check into `tail`, `head`, or `grep` to judge it. The summary reporter prints a failed scenario
  as `  N) <title> # <file>:<line>` under `Failed scenarios:`, then its failing step, indented seven
  spaces. A `node --test` log is read by its ` tests `, ` pass `, and ` fail ` lines.
- A command that can outlast the tool's foreground limit (the `features/hook` run, about 7 minutes
  measured, or any run that waits for the lock) runs with the tool's background option; wait for
  its completion notification and never poll with `sleep`.
- Warm ESLint with one lone `npm run lint` under the lock before the first `check:static`.
- The worktree's shell guard refuses one-line commands that call `git` inside `$(...)`. When it
  refuses a command of this plan, write the command verbatim into a script under `$D` (for example
  `$D/verify-t1-1.sh`), run it with `bash`, and keep the script for the SUMMARY.
- Stage by explicit path only; never `git add -A`, `git add .`, or `git commit -a`. Commit with
  `flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh
  NODE_OPTIONS=--max-old-space-size=6144 git commit -F <message file>` and let the whole hook run
  (`npm run check:commit` for the fix commit: `check:static`, measured at 287 seconds, then
  `test:unpaired`, 32 seconds, and the four pairs' direct coverage, 12 seconds, which also passes
  under the session's full environment). Run it in the foreground with the longest
  tool timeout; when it can outlast the tool's foreground limit, as the fix commit can, run it
  once with the tool's background option and wait for its completion notification, never polling
  with `sleep` (committing skill). Do not run the pre-commit tool by hand with a skip list, and
  never set `SKIP` for a hook: the session's exported `SKIP=trufflehog` stays as it is.
  When a fixer hook changes a file, the commit fails: restage that file and commit again. Never
  `--no-verify`, `--amend`, a rebase, `git stash`, a push, or a commit on `main`. Inside a worktree
  the hook may check nothing, so the fix commit is preceded by its own `check:static` run and its
  pairs' direct coverage; the orchestrator's post-merge `npm run check` is the full verdict.
- Commit messages follow `.agents/skills/committing/SKILL.md`: a Conventional Commits title of 5
  to 72 characters with no quick id, batch id, backlog id, milestone, phase, plan, wave, or task in
  the title or scope; body lines of at most 80 characters; the attribution lines of your session's
  instructions at the end. Right after each commit, write `git rev-parse HEAD` to `$D/fix-commit`
  or `$D/docs-commit`.
- `break.sh` refuses to run while `extensions/` is dirty; every break runs on a tree whose
  `extensions/` is clean and whose HEAD is the commit that its table set names.
- Do not edit `CHANGELOG.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/BACKLOG.md`,
  `.planning/PROJECT.md`, `cucumber.json`, `.fallowrc.json`, `scripts/**`, a CI workflow, a skill
  rule, `features/support/**`, `features/lib/**`, a feature file but `features/hook/async.feature`,
  or a step module but `features/step_definitions/hook/async.steps.ts`. A line meant for one of
  those files goes under "For the orchestrator" in the SUMMARY.
- Add no suppression marker (`fallow-ignore`, `eslint-disable`), no coverage exception, and no
  `.fallowrc.json` entry. Do not copy a row array or helper body from `event-adapters.test.ts` or
  from another case of `registry.test.ts`: `fallow dupes` fails on every clone group.
- Rule 4. The planner measured every scenario and unit count of this plan. If a scenario or a unit
  case outside this plan's own fails on a tree of this plan, stop and report it with the log, so
  the orchestrator can route it.

<!-- planner-discipline-allow: isSessionStartContextDetails -->
<!-- planner-discipline-allow: SESSION_START_CONTEXT_LABEL -->
<!-- planner-discipline-allow: export const HOOK_CONTEXT_MESSAGE_TYPE -->
<!-- planner-discipline-allow: const ASYNC_RESPONSE_CUSTOM_TYPE -->
<!-- planner-discipline-allow: function timed out -->

## Red proofs

`check-red.mjs` reads these tables. The `red-` set is the natural red on the code without the fix
(Task 1, step 4); the `fix-` set is the breaks on the fix commit (Task 2). Each run names the
scenario by its line, 261.

<!-- red-break-runs:begin -->
| break | profile | scenarios | files |
| --- | --- | --- | --- |
| R0 | adapter | 1 | features/hook/async.feature:261 |
<!-- red-break-runs:end -->

<!-- red-must-fail:begin -->
| break | profile | file | title | row |
| --- | --- | --- | --- | --- |
| R0 | adapter | features/hook/async.feature | A continued session adds an async session start answer only when the conversation does not hold it | |
<!-- red-must-fail:end -->

<!-- fix-break-runs:begin -->
| break | profile | scenarios | files |
| --- | --- | --- | --- |
| B1 | adapter | 1 | features/hook/async.feature:261 |
| B2 | adapter | 1 | features/hook/async.feature:261 |
| B3 | adapter | 1 | features/hook/async.feature:261 |
<!-- fix-break-runs:end -->

<!-- fix-must-fail:begin -->
| break | profile | file | title | row |
| --- | --- | --- | --- | --- |
| B1 | adapter | features/hook/async.feature | A continued session adds an async session start answer only when the conversation does not hold it | |
| B2 | adapter | features/hook/async.feature | A continued session adds an async session start answer only when the conversation does not hold it | |
| B3 | adapter | features/hook/async.feature | A continued session adds an async session start answer only when the conversation does not hold it | |
<!-- fix-must-fail:end -->

What each break proves (all measured on the planner's prototype; each fails the same `Then`):

- B1 (`asyncAnswerHeld` always returns false): the answer of `later` is sent again on the resume.
- B2 (the reader no longer recognizes the async answer type): the earlier answer of `later` is not
  seen, so it is sent again.
- B3 (the registry drops every async SessionStart answer): `async-ctx` is missing from the first
  session, and `fresh-ctx` from the second.

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Hold an unchanged async SessionStart answer, end to end, test first, in one commit</name>
  <precondition>The file $S/nondac-sh is executable; `flock` is on PATH and /usr/bin/fdfind exists; `sha256sum -c --quiet SHA256SUMS` run inside $I exits 0 and `sha256sum "$I/SHA256SUMS"` prints `68500915374cba77d0446f54a534fca38a58627c1d20cf0aa06b8d8d708fced1  /tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/quick-261123-gti-inputs/SHA256SUMS`; node_modules/.package-lock.json exists in this checkout; and `git diff --quiet 85c323b HEAD -- extensions/pi-claude-marketplace/bridges/hooks/ test/bridges/hooks/event-adapters.test.ts test/bridges/hooks/event-router.test.ts test/bridges/hooks/async-rewake/registry.test.ts features/hook/async.feature features/step_definitions/hook/async.steps.ts docs/hooks-compatibility.md` exits 0, so the line numbers, the insertion points, and the break sites apply to this tree.</precondition>
  <reversibility rating="reversible">The new details fields are additive to a message type that nothing else reads, and the check only skips a send; reverting the commit restores every send, and messages that the fixed code wrote read as plain answers to the old code. No stored format that another reader relies on changes.</reversibility>
  <files>features/hook/async.feature, features/step_definitions/hook/async.steps.ts, test/bridges/hooks/session-start-context.test.ts, extensions/pi-claude-marketplace/bridges/hooks/session-start-context.ts, test/bridges/hooks/async-rewake/registry.test.ts, extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts, extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts, extensions/pi-claude-marketplace/bridges/hooks/event-router.ts</files>
  <behavior>
    - Scenario `features/hook/async.feature:261`: call 2 is first prompt, async-ctx, Hello., second prompt, fresh-ctx (fails before the fix: one more async-ctx after second prompt)
    - `sessionStartValues`: gives the values of the details when they join to the labeled text; gives the whole labeled text when an edit changed it; reads text content as one part; gives nothing for a part with another label or an image; gives the whole labeled text for details with another event, with values that are text, with a value that is a number, with no values, and for null details (five rows); gives nothing for an async answer or a prompt
    - `asyncAnswerHeld` (one test per row): holds an answer that the same hook gave before; holds an answer whose texts a synchronous context holds; does not hold an answer when one of its texts is new; decides by the nearest context, not an older one; skips the answer of another command of the plugin; skips the answer of a plugin of the same name from another marketplace; skips the answer of another plugin; skips a synchronous message with no session start part; does not read an answer whose details name no session start; does not read an answer whose details name no command; holds nothing in an empty conversation; never holds an answer with no text
    - Registry (each title ends with `(HOOKASYNCRESUME-01)`): keeps the hook and every text of a startup, and of a resume, SessionStart answer in its details (two rows); keeps the text of a SessionStart answer over the limit whole in its details; does not add or save a SessionStart answer that the hook gave before; does not add a SessionStart answer that a synchronous context holds; adds a SessionStart answer when the earlier one has a changed text, another command, or another marketplace (three rows); adds a SessionStart answer and debug-logs a session it cannot read (also NFR-2)
  </behavior>
  <action>
    Follow "The fix", "The scenario", and the execution rules. The order matters: the natural red
    runs while `extensions/` is still clean.

    1. Set up `$D` as the execution rules say.

    2. Insert "The scenario" into `features/hook/async.feature` at the place its paragraph names.
       Change nothing else in the file.

    3. In `features/step_definitions/hook/async.steps.ts`, add the setup twin of `When the user
       releases the hook {string} and pi handles its exit` (`:207-218`). Move that step's body, up
       to and including its turn-start assertion, into a module-private
       `releaseToHandledExit(world: ScenarioWorld, hook: string)` placed right after
       `releaseWaitingHook` (`:180`); it returns `{ lengths, from }`, the log lengths and the
       record count from before the release. The `When` keeps only the helper call and its
       `keepTurn(this, "release", lengths, from)`. Register `Given("the user has released the hook
       {string} and pi has handled its exit", ...)` right after `Given("the model has answered the
       woken turn", ...)` (`:182-184`): it calls the helper, asserts with `assert.deepStrictEqual`
       that `this.pi.recordsSince(from).filter(faultOf)` is `[]`, and keeps no turn. Extend the
       `@fileoverview`'s first sentence so the release of a waiting hook reads "whose exit wakes the
       model or shows nothing, also as a setup that keeps no turn". Write each comment by the
       comments rule (simple English, no planning reference).

    4. Run `node scripts/check-features.mjs` (exit 0). Then the natural red, with `extensions/`
       clean: `PATH="$D/bin:$PATH" bash "$D/break.sh" R0 adapter "$D/brk/R0.json"
       features/hook/async.feature:261`, then `node "$D/check-red.mjs" <this plan> "$D" <checkout
       root> <plan base> red-`, which must print `RED-PROOFS OK`. The log `$D/R0-adapter.log` must
       show the `Then` failing on the extra `async-ctx` row, as "The scenario" says. If the run
       fails anywhere else, stop and report it: the scenario or the step is wrong.

    5. Leaf, test first. Write `test/bridges/hooks/session-start-context.test.ts` with the
       `sessionStartValues` and `asyncAnswerHeld` cases of the behavior list, one top-level
       `describe` per export, arrange/act/assert comments, and whole-value assertions. Build the
       messages as `AgentMessage` literals through small seed functions of the file (a synchronous
       context message, an async answer of a hook, a prompt) and one hook constant checked with
       `satisfies AsyncAnswerHook`; data rows are typed and run one `test()` each, with no
       conditional in the loop body. Run it once before the module exists and keep that failing
       log as `$D/red-unit-leaf.log`. Then write the leaf by "The fix", item 1, and run the file
       until all 22 cases pass.

    6. Registry, test first. In `test/bridges/hooks/async-rewake/registry.test.ts`, give
       `endPlainAnswer` (`:5746`) an optional last parameter, a SessionStart run with the event's
       `source` (`SessionStartSource`, imported as a type beside `BucketAEvent`) and
       `prepare(context: ExtensionContext): ExtensionContext`. With it, the helper runs a
       `SessionStart` entry with the event `{ source }` and the prepared context; without it,
       nothing changes. Declare the run's interface above the helper's comment, and extend that
       comment. Add a helper that builds such a run whose session holds what an `append` callback
       adds: it creates `SessionManager.inMemory("/work", { id: "session-cap" })`, calls `append`
       with it, and returns `Object.assign(context, { sessionManager })`, which keeps the context's
       throwing getters and needs no cast. Add helpers for the expected SessionStart details
       (`pluginId: "plugin-lifecycle"`, `marketplace: "catalog-lifecycle"`, `command:
       "/opt/hooks/note"`, `dispatchId: "dispatch-cap"`, `event: "SessionStart"`, and the values)
       and for the expected message. Then add the nine cases of the behavior list right before the
       case "sends a plain async answer under the limit as it is and saves nothing (D-PG5-14)",
       reusing `createCountingPi`, `createAnswerSaver`, `hookDebugLineWritten`, `PLAIN_ANSWER`,
       `BIG_TEXT`, and `savedBigText`: the over-limit case expects the saved wrapper as content and
       `[BIG_TEXT]` as values; the held case seeds an earlier answer of the same hook with
       `[BIG_TEXT]` as values and a wrapper naming another saved path as content, then waits for the
       held debug line and expects no message and no save; the synchronous case seeds a
       `claude-hook-additional-context` message with the label part and SessionStart details, under
       the source `compact`; the unreadable case replaces the session with one whose
       `buildSessionProjection` throws `session closed`, waits for the read-failure debug line, and
       expects both messages. Run the nine with `--test-name-pattern 'HOOKASYNCRESUME-01'
       --test-timeout=20000` before changing `registry.ts`, and keep that failing log as
       `$D/red-unit-registry.log`: without the timeout, the three cases that wait for a debug line
       hang on the old registry (measured: ` tests 9`, ` pass 0`, ` fail 6`, ` cancelled 3`). Then
       change `registry.ts` by "The fix", item 4, until they pass.

    7. Move the reader and the constant: "The fix", items 2 and 3. Every other case of the three
       existing test files passes unchanged.

    8. Checks, each with its log under `$D`: the four unit files; direct coverage of the four
       pairs; the ESLint warm-up, then `check:static`; the scenario under the adapter profile;
       `features/hook/async.feature` under the builtin profile, which selects no scenario; and the
       whole of `features/hook` under the adapter profile, in the background. The verify block
       lists each command and what it must print.

    9. Commit the eight files by path, with a message file `$D/fix-message.txt` whose title is
       `fix(hooks): stop repeating an unchanged async session start answer` and whose body says,
       in lines of at most 80 characters, that a plain async SessionStart hook's unchanged answer
       reached the model again on every resume or fork; that the bridge now keeps the hook and
       every uncapped text of a SessionStart answer in the message details and skips an answer
       that the nearest SessionStart context of the conversation already holds, as Claude Code
       2.1.295 does; and that the reader of that context moved into its own module. Write the
       commit to `$D/fix-commit`.
  </action>
  <verify>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-gti; R=$(git rev-parse --show-toplevel); B=$(cat "$D/plan-base"); node "$D/check-red.mjs" .planning/quick/261123-gti-hookasyncresume-01-planning-backlog-md-an-async-sessionstart/261123-gti-PLAN.md "$D" "$R" "$B" red- > "$D/red-check.log" 2>&1; s=$?; echo "exit=$s" >> "$D/red-check.log"; test "$s" -eq 0 && grep -qx 'RED-PROOFS OK' "$D/red-check.log" && grep -qx '18 steps (17 passed, 1 failed)' "$D/R0-adapter.log" && grep -qF '       Then the model receives these calls: # features/step_definitions/model.steps.ts:137' "$D/R0-adapter.log" # [HEAD=absent EXPECT==present @85c323b]</automated>
    <fails_when>non-zero exit: the checker printed a `PROBLEM` line (the R0 log is missing, names another checkout root, lacks `restored=clean`, holds a step timeout, lacks `1 scenario (`, ends with `exit=0`, or the scenario failed outside a `When` or a `Then`), or the R0 log lacks the measured step count or the failing `Then` line</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-gti; grep -q 'ERR_MODULE_NOT_FOUND' "$D/red-unit-leaf.log" && grep -Eq ' fail [1-9][0-9]*$' "$D/red-unit-leaf.log" && grep -Eq ' tests 9$' "$D/red-unit-registry.log" && grep -Eq ' pass 0$' "$D/red-unit-registry.log" # [HEAD=absent EXPECT==present @85c323b]</automated>
    <fails_when>non-zero exit: the leaf's first run did not fail on the missing module, or one of the nine registry cases passed (or was missing) before the registry change (measured: the leaf ` tests 1`, ` fail 1`; the registry ` tests 9`, ` pass 0`, ` fail 6`, ` cancelled 3`)</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-gti; env -i HOME="$HOME" PATH="$PATH" LANG=C.UTF-8 TMPDIR=/tmp "$S/nondac-sh" -c "node --import \"$PWD/scripts/isolated-pi-home.mjs\" --test --test-reporter=spec test/bridges/hooks/session-start-context.test.ts test/bridges/hooks/async-rewake/registry.test.ts test/bridges/hooks/event-adapters.test.ts test/bridges/hooks/event-router.test.ts" > "$D/green-unit.log" 2>&1; s=$?; echo "exit=$s" >> "$D/green-unit.log"; test "$s" -eq 0 && grep -Eq ' tests 616$' "$D/green-unit.log" && grep -Eq ' fail 0$' "$D/green-unit.log" # [HEAD=error:1 EXPECT==616 @85c323b]</automated>
    <fails_when>non-zero exit: a case of the four files fails or does not compile, or the log lacks ` tests 616` and ` fail 0` (a case missing, added, or deleted against the behavior list; measured: 22 in the leaf file, 151 in `registry.test.ts`, 155 in `event-adapters.test.ts`, 288 in `event-router.test.ts`; at HEAD the last three hold 142, 155, and 288, and the leaf file does not exist)</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-gti; env -i HOME="$HOME" PATH="$PATH" LANG=C.UTF-8 TMPDIR=/tmp CI=1 npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/session-start-context.ts extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts extensions/pi-claude-marketplace/bridges/hooks/event-router.ts > "$D/coverage.log" 2>&1; s=$?; echo "exit=$s" >> "$D/coverage.log"; test "$s" -eq 0 && grep -qF 'Direct coverage passed: extensions/pi-claude-marketplace/bridges/hooks/session-start-context.ts (' "$D/coverage.log" && grep -qF 'Direct coverage passed: extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts (' "$D/coverage.log" && grep -qF 'Direct coverage passed: extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts (' "$D/coverage.log" && grep -qF 'Direct coverage passed: extensions/pi-claude-marketplace/bridges/hooks/event-router.ts (' "$D/coverage.log" # [HEAD=absent EXPECT==present @85c323b]</automated>
    <fails_when>non-zero exit: a case of the four pairs fails, or line, function, or branch coverage of one of the four sources is below 100% (the log names it; measured on the prototype: leaf 48/48 branches, registry 251/251, event-adapters 181/181, event-router 276/276)</fails_when>
    <automated>L=extensions/pi-claude-marketplace/bridges/hooks/session-start-context.ts; grep -q '^export const HOOK_CONTEXT_MESSAGE_TYPE = "claude-hook-additional-context";' "$L" && grep -q '^export const ASYNC_RESPONSE_CUSTOM_TYPE = "claude-hook-async-response";' "$L" && grep -q '^export function sessionStartValues(' "$L" && grep -q '^export function asyncAnswerHeld(' "$L" # [HEAD=error:2 EXPECT==present @85c323b]</automated>
    <fails_when>non-zero exit: the leaf does not exist, or it lacks one of the two constants or the two exported functions</fails_when>
    <automated>EA=extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts; c=$(grep -v -e '^\s*//' -e '^\s*\*' -e '^\s*/\*\*' "$EA" | grep -c -e 'isSessionStartContextDetails' -e 'SESSION_START_CONTEXT_LABEL' -e 'export const HOOK_CONTEXT_MESSAGE_TYPE'); test "$c" -eq 0 # [HEAD=6 EXPECT==0 @85c323b]</automated>
    <fails_when>non-zero exit: the code of `event-adapters.ts` (comment lines left out) still defines or names the details guard, the label, or the exported constant that move to the leaf</fails_when>
    <automated>test "$(grep -c 'return sessionStartValues(message).map((value) => contextKey(value));' extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts)" -ge 1 # [HEAD=0 EXPECT>=1 @85c323b]</automated>
    <fails_when>non-zero exit: `messageKeys` does not key the leaf's values through `contextKey` as prescribed</fails_when>
    <automated>RG=extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts; c=$(grep -v -e '^\s*//' -e '^\s*\*' -e '^\s*/\*\*' "$RG" | grep -c 'const ASYNC_RESPONSE_CUSTOM_TYPE'); test "$c" -eq 0 # [HEAD=1 EXPECT==0 @85c323b]</automated>
    <fails_when>non-zero exit: `registry.ts` still defines the custom type of the answer itself</fails_when>
    <automated>RG=extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts; grep -q 'from "../session-start-context.ts";' "$RG" && grep -q 'command: entry.handlerDecl.command,' "$RG" && grep -qF 'asyncAnswerHeld(ctx.sessionManager.buildSessionProjection().messages, hook, values)' "$RG" # [HEAD=absent EXPECT==present @85c323b]</automated>
    <fails_when>non-zero exit: `registry.ts` does not import the leaf, does not carry the declared command into `RewakeExit`, or does not run the check over the session projection</fails_when>
    <automated>test "$(grep -c 'import { HOOK_CONTEXT_MESSAGE_TYPE } from "./session-start-context.ts";' extensions/pi-claude-marketplace/bridges/hooks/event-router.ts)" -ge 1 # [HEAD=0 EXPECT>=1 @85c323b]</automated>
    <fails_when>non-zero exit: the router does not import the constant from the leaf</fails_when>
    <automated>test "$(grep -c '"the user has released the hook {string} and pi has handled its exit"' features/step_definitions/hook/async.steps.ts)" -ge 1 && n=$(grep -n '^  Scenario: A continued session adds an async session start answer only when the conversation does not hold it$' features/hook/async.feature) && test "$n" = "261:  Scenario: A continued session adds an async session start answer only when the conversation does not hold it" # [HEAD=absent EXPECT==present @85c323b]</automated>
    <fails_when>non-zero exit: the setup step is not registered, or the scenario is missing, appears twice, or does not start at line 261</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-gti; flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent check:static > "$D/check-static.log" 2>&1; s=$?; echo "exit=$s" >> "$D/check-static.log"; test "$s" -eq 0</automated>
    <fails_when>non-zero exit: the typecheck, ESLint (cognitive complexity and import order included), fallow (dead code, cycles, health, duplication, boundary zones), Prettier, the pairing, or `check:features` failed; `$D/check-static.log` names the step</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-gti; PATH="$D/bin:$PATH" flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent test:cucumber:profile -- --profile adapter --parallel 2 features/hook/async.feature:261 > "$D/green-adapter.log" 2>&1; s=$?; echo "exit=$s" >> "$D/green-adapter.log"; test "$s" -eq 0 && grep -qx '1 scenario (1 passed)' "$D/green-adapter.log" && grep -qx '18 steps (18 passed)' "$D/green-adapter.log" # [HEAD=absent EXPECT==present @85c323b]</automated>
    <fails_when>non-zero exit: cucumber exited non-zero, or the log lacks `1 scenario (1 passed)` and `18 steps (18 passed)`</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-gti; PATH="$D/bin:$PATH" flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent test:cucumber:profile -- --profile builtin --parallel 2 features/hook/async.feature > "$D/builtin-async.log" 2>&1; s=$?; echo "exit=$s" >> "$D/builtin-async.log"; test "$s" -eq 0 && grep -qx '0 scenarios' "$D/builtin-async.log" # [HEAD=present EXPECT==present @85c323b GUARD MUTATION: an MCP implementation tag on the new scenario]</automated>
    <fails_when>non-zero exit: the builtin run failed, or the log lacks the line `0 scenarios` (the new scenario gained an implementation tag)</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-gti; PATH="$D/bin:$PATH" flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent test:cucumber:profile -- --profile adapter --parallel 2 features/hook > "$D/hook-adapter.log" 2>&1; echo "exit=$?" >> "$D/hook-adapter.log"; grep -qx 'exit=0' "$D/hook-adapter.log" && grep -Eqx '([0-9]+) scenarios \(\1 passed\)' "$D/hook-adapter.log" && ! grep -q 'function timed out' "$D/hook-adapter.log" # [HEAD=present EXPECT==present @85c323b GUARD MUTATION: break B1 on the fixed tree]</automated>
    <fails_when>non-zero exit: a hook scenario failed or timed out under the adapter profile (an HKRL-02 scenario of `additional-context.feature` among them); Rule 4 applies to a failure outside the new scenario. Measured on the prototype: `315 scenarios (315 passed)` in 6 minutes 40 seconds; at HEAD the 314 hook scenarios passed inside the recorded `npm run check` at b9c0a04, whose `extensions/`, `features/`, and `test/` match 85c323b</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-gti; A=$(cat "$D/fix-commit") && test -n "$A" && c=$(git show -s --format=%ct "$A") && g=$(git show --name-only --format= "$A") && f=$(printf '%s\n' "$g" | LC_ALL=C sort | tr '\n' ' ') && test "$f" = "extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts extensions/pi-claude-marketplace/bridges/hooks/event-router.ts extensions/pi-claude-marketplace/bridges/hooks/session-start-context.ts features/hook/async.feature features/step_definitions/hook/async.steps.ts test/bridges/hooks/async-rewake/registry.test.ts test/bridges/hooks/session-start-context.test.ts " && for n in R0-adapter red-unit-leaf red-unit-registry; do m=$(stat -c %Y "$D/$n.log") && test "$m" -lt "$c" || exit 1; done && t=$(git show -s --format=%s "$A") && test "$t" = "fix(hooks): stop repeating an unchanged async session start answer" # [HEAD=absent EXPECT==present @85c323b]</automated>
    <fails_when>non-zero exit: `$D/fix-commit` is missing, the fix commit changed another file set than the eight, a red log is missing or not older than the fix commit, or the commit title differs</fails_when>
  </verify>
  <done>The scenario failed in its `Then` on the old code (R0, `RED-PROOFS OK` for `red-`), and passes with the fix; the 616 cases of the four unit files pass; the four pairs have 100% direct coverage; `check:static` passes; the builtin profile selects no scenario of `async.feature`; every scenario of `features/hook` passes under the adapter profile; one commit holds the eight files, after the red logs.</done>
</task>

<task type="auto">
  <name>Task 2: Prove the scenario with breaks B1, B2, and B3 on the fix commit</name>
  <precondition>`$D/fix-commit` names HEAD, and `git status --porcelain -- extensions/` prints nothing.</precondition>
  <files>No tracked file. Scratch files only, under $D: the break logs B1-adapter.log, B2-adapter.log, and B3-adapter.log, the checker log red-fix.log, and a rewritten break file only if one is needed.</files>
  <action>
    Run each break on the fix commit, one at a time, each through `break.sh`, which applies the
    break, runs the scenario, and restores `extensions/`:
    `PATH="$D/bin:$PATH" bash "$D/break.sh" B1 adapter "$D/brk/B1.json" features/hook/async.feature:261`,
    then the same for B2 and B3 with their own edits files. If a log says `refusing: an old text
    does not occur exactly once`, the code differs from a prescribed line of "The fix": rename the
    planner's file to `$D/brk/<id>.planner.json`, write `$D/brk/<id>.json` with the same break for
    the code as written (B1: the decision of `asyncAnswerHeld` returns false; B2: the async-type
    test of the reader never matches; B3: the registry's held condition keeps only its event test),
    run the break again, and record it under "Red proofs" in the SUMMARY with the words "rewrote a
    break", the old and the new text, and the reason. Then run `check-red.mjs` with the prefix
    `fix-`; it must print `RED-PROOFS OK`. Each log must show its diff and the same failing `Then`
    as R0. Finish with `extensions/` clean.
  </action>
  <verify>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-gti; R=$(git rev-parse --show-toplevel); B=$(cat "$D/plan-base"); node "$D/check-red.mjs" .planning/quick/261123-gti-hookasyncresume-01-planning-backlog-md-an-async-sessionstart/261123-gti-PLAN.md "$D" "$R" "$B" fix- > "$D/red-fix.log" 2>&1; s=$?; echo "exit=$s" >> "$D/red-fix.log"; test "$s" -eq 0 && grep -qx 'RED-PROOFS OK' "$D/red-fix.log" && for b in B1 B2 B3; do grep -qF '       Then the model receives these calls: # features/step_definitions/model.steps.ts:137' "$D/$b-adapter.log" && grep -q '^diff --git a/extensions/pi-claude-marketplace/bridges/hooks/' "$D/$b-adapter.log" || exit 1; done && y=$(git status --porcelain -- extensions/) && test -z "$y" # [HEAD=absent EXPECT==present @85c323b]</automated>
    <fails_when>non-zero exit: the checker printed a `PROBLEM` line (a log is missing, names another checkout root, lacks `restored=clean`, holds a step timeout, lacks `1 scenario (`, ends with `exit=0`, or the scenario failed outside a `When` or a `Then`), a log does not fail at the model-calls `Then` or holds no diff of a hooks-bridge file, or `extensions/` is dirty</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-gti; { [ ! -e "$D/brk/B1.planner.json" ] && [ ! -e "$D/brk/B2.planner.json" ] && [ ! -e "$D/brk/B3.planner.json" ]; } || grep -q 'rewrote a break' .planning/quick/261123-gti-hookasyncresume-01-planning-backlog-md-an-async-sessionstart/261123-gti-SUMMARY.md # [HEAD=present EXPECT==present @85c323b GUARD MUTATION: a rewritten break file that the SUMMARY does not record]</automated>
    <fails_when>non-zero exit: Task 2 rewrote a break file because the code differs from a prescribed line, and the SUMMARY does not say so with the words "rewrote a break" and the reason (run this check after the SUMMARY exists)</fails_when>
  </verify>
  <done>B1, B2, and B3 each fail the scenario at `Then the model receives these calls:`; `check-red.mjs` prints `RED-PROOFS OK` for `fix-`; `extensions/` is clean at the fix commit.</done>
</task>

<task type="auto">
  <name>Task 3: Document the async SessionStart answer check and its known gaps</name>
  <precondition>Task 2's `$D/red-fix.log` holds the line `RED-PROOFS OK`.</precondition>
  <files>docs/hooks-compatibility.md</files>
  <action>
    Insert "The docs paragraph" into `docs/hooks-compatibility.md` at the place its paragraph
    names, as one paragraph, then the three-item list, with a blank line before, between, and
    after. Change no table and no other line. The text is plain ASCII: the fix-unicode-dashes and
    smart-quotes hooks rewrite other dashes and quotes. Commit the file alone, with a message file
    `$D/docs-message.txt` whose title is `docs(hooks): describe the async session start answer check`
    and whose body says that the hooks guide now states when a plain async SessionStart answer is
    not added again and the three cases in which the bridge differs from Claude Code. When
    mdformat or markdownlint changes or rejects the file, restage it and commit again. Write the
    commit to `$D/docs-commit`.
  </action>
  <verify>
    <automated>f=docs/hooks-compatibility.md; test "$(grep -c 'as Claude Code 2.1.295 does (HOOKASYNCRESUME-01)' "$f")" -ge 1 && test "$(grep -c '^- An answer with no text leaves nothing in the conversation\.' "$f")" -ge 1 && test "$(grep -c '^- An answer that an earlier release added has no record of its texts\.' "$f")" -ge 1 && test "$(grep -c '^- The bridge decides when the hook ends, not when it adds the answer to the next model call' "$f")" -ge 1 # [HEAD=0 EXPECT>=1 @85c323b]</automated>
    <fails_when>non-zero exit: the paragraph's upstream sentence or one of the three gap items is missing</fails_when>
    <automated>n=$(grep -n '^A plain `async` hook on `SessionStart` gives its answer' docs/hooks-compatibility.md) && test "${n%%:*}" = 464 && test "$(printf '%s\n' "$n" | wc -l)" -eq 1 # [HEAD=absent EXPECT==present @85c323b]</automated>
    <fails_when>non-zero exit: the paragraph is missing, appears twice, or does not start at line 464 (right after the paragraph of line 462 and its blank line)</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-gti; A=$(cat "$D/docs-commit") && test -n "$A" && g=$(git show --name-only --format= "$A") && test "$g" = "docs/hooks-compatibility.md" && t=$(git show -s --format=%s "$A") && test "$t" = "docs(hooks): describe the async session start answer check" && ns=$(git diff --numstat "$A~1" "$A" -- docs/hooks-compatibility.md) && d=$(printf '%s\n' "$ns" | cut -f2) && test "$d" -eq 0 # [HEAD=absent EXPECT==present @85c323b]</automated>
    <fails_when>non-zero exit: `$D/docs-commit` is missing, the docs commit changed another file, its title differs, or it removed or rewrote a line of the file (the commit only adds lines; measured on the prototype: 6 added, 0 removed)</fails_when>
  </verify>
  <done>The hooks guide states the async SessionStart answer check, its upstream source, the raw comparison of uncapped texts, and the three known gaps; the docs commit adds only those lines.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| plugin hook process -> bridge | the stdout of a plain async hook (output of an installed plugin) becomes the answer's texts and its details |
| session file -> bridge | the details read back from the session at a resume or a fork (a file the user owns, which a hand edit or another extension's message of the same custom type can change) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-gti-01 | Spoofing | `asyncAnswerHeld` over the session's messages | low | accept | A message of the async custom type that another extension or a hand edit wrote with the same hook fields and texts makes the bridge skip a real answer. A writer that can add such a message can already put any text in front of the model; the bridge trusts the session and `pi.sendMessage` in the same way for HKRL-02, and Claude Code trusts its transcript the same way. |
| T-gti-02 | Tampering | the async details guard in `session-start-context.ts` | low | mitigate | The guard requires `event: "SessionStart"`, a string array `values`, and string `pluginId`, `marketplace`, and `command`; any other shape is no entry, and the reader never throws on one (leaf rows "does not read an answer whose details name no session start" and "... no command"). |
| T-gti-03 | Denial of service | the uncapped texts in `details.values` | low | accept | A plain async hook keeps at most the first 8,388,608 and the last 65,536 UTF-16 code units of its stdout (D-PG5-17), so one answer adds a bounded amount to the session file; Claude Code keeps the whole response in its transcript too. |
| T-gti-04 | Information disclosure | the session file under the agent directory | low | accept | The part of a long answer that the cap otherwise keeps only in the saved file under the scope's data root is now also in the user's own session file. It is the text the hook gave the model; the docs paragraph states it. |
| T-gti-05 | Denial of service | `sessionStartAnswerHeld` after a session replacement | low | mitigate | The projection read runs in a `try`; a throw is debug-logged and holds nothing, so the answer is sent and the existing `sendMessage` catch stays the last guard (NFR-2; registry row "adds a SessionStart answer and debug-logs a session it cannot read"). |
| T-gti-06 | Repudiation | a held answer that the user never sees | low | mitigate | Every held answer writes `async-hook: answer not added, the conversation holds its text (<plugin>/SessionStart)` to the debug channel (OBS-01; the held registry row waits for that line). |
| T-gti-SC | Tampering | npm/pip/cargo installs | low | accept | This plan installs no package and has no install task, so the package-legitimacy gate has nothing to check. |
</threat_model>

<verification>
- Task 1: the natural red (`RED-PROOFS OK` for `red-`), the leaf and registry red logs, the 616
  unit cases, direct coverage of the four pairs, the grep gates, `check:static`, the scenario
  green under the adapter profile, `0 scenarios` under the builtin profile, every scenario of
  `features/hook` under the adapter profile, and the fix commit's file set, title, and order.
- Task 2: `RED-PROOFS OK` for `fix-`, each break's diff and failing `Then`, `extensions/` clean.
- Task 3: the docs grep gates and the docs commit's file set, title, and added-lines-only diff.
- For the orchestrator, not the executor: `npm run check` in the main checkout after the merge
  (AGENTS.md, Build verification), the CHANGELOG parent line, and the BACKLOG closure.
</verification>

<success_criteria>
- A continued session no longer gives the model an unchanged async SessionStart answer again, and
  it still gives the model an answer that the conversation does not hold (the scenario at
  `features/hook/async.feature:261`).
- The check is upstream's 2.1.295 rule: the nearest SessionStart context with text, all or
  nothing, the same hook or a synchronous context, no source gate, raw uncapped texts; the
  synchronous HKRL-02 check is unchanged and blind to async answers.
- The leaf pair, `registry.ts`, `event-adapters.ts`, and `event-router.ts` keep 100% direct
  coverage; `check:static` passes; every scenario of `features/hook` passes under the adapter
  profile.
- Breaks B1 to B3 each fail the scenario's `Then`; `extensions/` ends clean.
- `docs/hooks-compatibility.md` states the rule and its three known gaps.
</success_criteria>

## Source audit

| Source | ID | Item | Plan | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| GOAL | 261123-gti | an async SessionStart answer does not repeat on resume or fork | Task 1 | COVERED | scenario at `async.feature:261` |
| REQ | HOOKASYNCRESUME-01 | give the async answer the SessionStart details shape | Task 1 | COVERED | `AsyncSessionStartDetails`: `event`, `values`, plus the hook |
| REQ | HOOKASYNCRESUME-01 | apply the duplicate removal to it | Task 1 | COVERED | as upstream `o0o`, per the orchestrator's override of the HKRL-02 wording |
| REQ | HOOKASYNCRESUME-01 | unit tests at 100% direct coverage | Task 1 | COVERED | leaf pair new; registry, event-adapters, event-router kept at 100% |
| REQ | HOOKASYNCRESUME-01 | a cucumber scenario that fails without the change | Tasks 1, 2 | COVERED | R0 natural red, breaks B1 to B3 |
| REQ | HOOKASYNCRESUME-01 | `docs/hooks-compatibility.md` updated | Task 3 | COVERED | paragraph and three gaps |
| REQ | HOOKASYNCRESUME-01 | a CHANGELOG parent line in the SUMMARY | output | COVERED | "For the orchestrator" |
| CONTEXT | orchestrator | nearest SessionStart entry with text, all or nothing, no source gate, sync reader blind | Task 1 | COVERED | `asyncAnswerHeld`; `messageKeys` reads only the sync type |
| CONTEXT | orchestrator | path normalization: compare raw, or record a Pi capability gap | context, Task 3 | COVERED | raw uncapped texts; no gap, because Pi can keep them in details (A3 evidence) |
| CONTEXT | orchestrator | record the three known gaps in the docs | Task 3 | COVERED | |
| CONTEXT | orchestrator | new leaf with its own test at 100%; registry and event-adapters pairs at 100% | Task 1 | COVERED | |
| CONTEXT | orchestrator | natural red in a When or Then, logged before the fix commit | Task 1 | COVERED | R0 table, log older than the commit |
| CONTEXT | orchestrator | B1 and B2 fail the same Then, reverted, `extensions/` clean, break.sh in own folder | Task 2 | COVERED | plus B3 |
| CONTEXT | orchestrator | decide on the optional guard scenario | context | COVERED | not needed: unit rows pin the identity rule; `fresh` pins over-removal |
| CONTEXT | orchestrator | complexity gates and fallow zones | Task 1 | COVERED | `check:static`; leaf in `bridges/hooks` |
| CONTEXT | orchestrator | verification commands, prefixes, `env -i`, `fd`, commit hook, no SKIP | rules, Tasks 1 to 3 | COVERED | |
| CONTEXT | orchestrator | SUMMARY parent lines; leaves never edit CHANGELOG, STATE, ROADMAP, BACKLOG | rules, output | COVERED | |
| CONTEXT | orchestrator | commit titles: Conventional Commits, no quick, batch, or backlog ids | rules, Tasks 1, 3 | COVERED | |
| RESEARCH | section 3.1 | leaf `session-start-context.ts` with the moved helpers and both custom types | Task 1 | COVERED | `contextKey` stays in event-adapters (difference 2) |
| RESEARCH | section 3.2 | registry: projection read in try/catch, held skip, details shape | Task 1 | COVERED | |
| RESEARCH | section 3.3 | keys: `contextKey` on capped texts | Task 1 | COVERED | replaced by raw uncapped texts, with evidence (difference 1) |
| RESEARCH | section 3.4 | no source gate | Task 1 | COVERED | registry rows under startup, resume, and compact |
| RESEARCH | known Pi gaps | empty answer, older messages, check at hook exit | Task 3 | COVERED | |
| RESEARCH | section 4 | scenario with a `Given` twin of the release step | Task 1 | COVERED | plus the resume-only hook `fresh` |
| RESEARCH | section 5 | waits and release, `nextTurn` order, direct coverage, complexity, stale ctx | Task 1 | COVERED | |
| RESEARCH | docs and records | docs sentence, CHANGELOG line, Threat Flags | Task 3, output | COVERED | |

## Inputs

`$I/SHA256SUMS` (sha256 `68500915374cba77d0446f54a534fca38a58627c1d20cf0aa06b8d8d708fced1`) lists
`README.md`, `brk/R0.json`, `brk/B1.json`, `brk/B2.json`, `brk/B3.json`, and
`ref/planner-prototype.diff`. The prototype (eight files, 826 insertions and 80 deletions against
85c323b) measured: `tsc` exit 0; ESLint clean once the two imports sat in the order "The fix"
gives; `fallow dead-code`, the cycle run, `fallow health`, and `fallow dupes` exit 0;
`check:static` exit 0 in 287 seconds; `test:corresponding` and `check:features` exit 0; the four
unit files 616 cases, 0 failures; direct coverage of the four pairs 100% (leaf 48/48 branches,
10/10 functions, 175/175 lines; registry 251/251, 69/69, 1340/1340; event-adapters 181/181,
39/39, 936/936; event-router 276/276, 96/96, 1872/1872); the scenario red on the old code and
green with the fix; B1, B2, and B3 each red at the same `Then`; `features/hook` under the adapter
profile 315 scenarios (315 passed) in 6 minutes 40 seconds; `features/hook/async.feature` under
the builtin profile `0 scenarios`; the docs paragraph unchanged by every pre-commit hook, at line
464. The leaf's red form (module absent) measured ` tests 1`, ` fail 1`, with
`ERR_MODULE_NOT_FOUND`; the nine registry rows on the old registry, with `--test-timeout=20000`,
measured ` tests 9`, ` pass 0`, ` fail 6`, ` cancelled 3` (the three cases that wait for a debug
line time out) in about a minute.

<output>
Create `.planning/quick/261123-gti-hookasyncresume-01-planning-backlog-md-an-async-sessionstart/261123-gti-SUMMARY.md`
with `status: complete` in its frontmatter, and these sections:

- "Red proofs": the R0, B1, B2, and B3 logs under `$D`, each one's count line and failing step,
  the two `check-red.mjs` outputs (`RED-PROOFS OK`), the two unit red logs, and any break file
  that Task 2 had to rewrite, with the words "rewrote a break" and the reason.
- "Checks": each command of the verify blocks with its exit status, the commit it ran on, the
  Node version, and the counts it printed (616 unit cases, 4 coverage lines, the `features/hook`
  scenario count).
- "Decisions": the raw comparison of uncapped texts (the A3 evidence of this plan's context and
  the measured divergence of both other options); the hook identity (plugin, marketplace, declared
  command); no source gate; no separate guard scenario, with the reason; the reader and the custom
  types in their own leaf, with `contextKey` left in `event-adapters.ts`.
- "For the orchestrator" (the executor edits none of these files):
  - CHANGELOG parent line: "An `async` `SessionStart` hook's unchanged answer no longer reaches the
    model again each time you resume or fork the session."
  - BACKLOG closure: "HOOKASYNCRESUME-01: closed 2026-11-23 by commit <fix commit>; an async
    SessionStart answer that the conversation already holds is not added again, as in Claude Code
    2.1.295 (raw uncapped texts, nearest SessionStart context, same hook or a synchronous one). The
    three known gaps are in `docs/hooks-compatibility.md`."
  - STATE.md: drop HOOKASYNCRESUME-01 from the integration-rescope "Still open" list.
  - `npm run check` in the main checkout after the merge.
- `## Threat Flags`, even when the answer is "None" (AGENTS.md, GSD records), as this line:
  None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
</output>
