---
phase: 05-stop-continuation-and-hook-failures
plan: "04"
subsystem: hooks-bridge
status: complete
tags: [hooks, context-limit, persisted-output, async, cucumber]
requires:
  - "05-01 (registry.ts RewakeExit.runtime; event-router.ts as the Stop move left it)"
  - "05-02 (dispatch-exec.ts failure carrier on the noop arm)"
  - "05-05 (registry.ts ladderFor and the plain lane with no timer)"
provides:
  - "capHookContext(text, source, write) and HookContextSource (bridges/hooks/context-cap.ts)"
  - "saveHookOutput(loc, id, source, text) and sweepHookOutput(loc, now) (bridges/hooks/hook-output-files.ts)"
  - "atomicWriteText(filePath, text) (shared/atomic-json.ts)"
  - "SpawnDeps.saveHookOutput (optional) and RewakeExit.saveHookOutput (module-private), registry.ts"
  - "asyncAnswerTexts returns readonly { source, text }[]"
  - "Then `the model receives these saved hook outputs:` (features/step_definitions/hook/additional-context.steps.ts)"
affects:
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/async-answer.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/shared/atomic-json.ts
tech-stack:
  added: []
  patterns:
    - "A pure cap with a required injected writer; a rejection becomes the failure line, so the cap never rejects"
    - "The sync settle split in two: claim() cancels the timer synchronously at close or error, and only the close path's resolve waits for the cap"
key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/context-cap.ts
    - extensions/pi-claude-marketplace/bridges/hooks/hook-output-files.ts
    - test/bridges/hooks/context-cap.test.ts
    - test/bridges/hooks/hook-output-files.test.ts
    - features/step_definitions/hook/additional-context.steps.ts
  modified:
    - extensions/pi-claude-marketplace/shared/atomic-json.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/async-answer.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - test/shared/atomic-json.test.ts
    - test/bridges/hooks/dispatch-exec.test.ts
    - test/bridges/hooks/async-rewake/async-answer.test.ts
    - test/bridges/hooks/async-rewake/registry.test.ts
    - test/bridges/hooks/event-router.test.ts
    - features/hook/additional-context.feature
decisions:
  - "The cap runs in the exec layer on the parsed result, before the onFailure block is decided and before any join; dispatch.ts and settle.ts import nothing from context-cap.ts (D-PG5-14, D-PG5-16)."
  - "The close handler computes the parsed result and the exit facts first, then claims the settle, so parse order and debug lines are as before; a close after an error returns without parsing a second result."
  - "sendAsyncAnswer caps every text with Promise.all, so saves run at once and the sends keep answer order, systemMessage first; it re-checks the generation after the saves (D-PG5-16, D-62-03)."
  - "The size label has no `bytes` arm: a capped string always has more than 10,000 characters, so that arm of upstream's helper cannot run."
metrics:
  duration: "~80 min"
  completed: 2026-11-14
estimate:
  tokens: 99000
actuals:
  tokens: 19165
  tasks: 3
  commits: 3
plan_head_before: ae9627d09df1d74c675c49465dce57cf3b2eec08
plan_head_after: 97be83c9
---

# Phase 5 Plan 04: The 10,000-Character Hook Context Limit Summary

A hook's context string over 10,000 characters no longer reaches the model whole. The bridge saves it to `<dataRoot>/_shared/hook-output/hook-<uuid>-<source>.txt` and sends Claude Code 2.1.323's `<persisted-output>` wrapper with the path and a 2,000-character preview. If the save fails, the model gets the head of the string and the failure line, within 10,000 characters, and the event goes on. Both lanes call one cap function. Each bridge load removes saved files older than 30 days.

`actuals.tokens` is chars/4 over the realized diff `ae9627d0..97be83c9` (76,658 characters). The plan estimate also counted reading and test runs.

## Commits

| Task | Commit | Title | Files |
|------|--------|-------|-------|
| 05-04-01 | `aa22bf45` | feat(hooks): save a hook context over 10,000 characters to a file | 11 |
| 05-04-02 | `c4e1e6b0` | feat(hooks): cap each text of a plain async hook's answer | 4 |
| 05-04-03 | `97be83c9` | feat(hooks): remove saved hook output older than 30 days at load | 4 |

All three commits went through the real hook. `npm run check:commit` reported Passed on the first commit attempt each time. Node v26.13.1, Linux.

## Exported names

- `bridges/hooks/context-cap.ts`: `capHookContext(text: string, source: HookContextSource, write: (text: string) => Promise<string>): Promise<string>`, and `type HookContextSource = "additionalContext" | "systemMessage" | "stdout"`.
- `bridges/hooks/hook-output-files.ts`: `saveHookOutput(loc, id, source, text): Promise<string>`, which rejects on failure, and `sweepHookOutput(loc, now): Promise<void>`, which never rejects.
- `shared/atomic-json.ts`: `atomicWriteText(filePath: string, text: string): Promise<void>`.
- `async-rewake/registry.ts`: optional `SpawnDeps.saveHookOutput`. Its default is the production writer, for the sync lane (through `dispatch-exec.ts`) and the background lane (through `RewakeExit.saveHookOutput`).
- `async-rewake/async-answer.ts`: `asyncAnswerTexts` now returns `readonly { source: "systemMessage" | "additionalContext"; text: string }[]`.

## Task 05-04-01: the sync lane, the writer, and the scenario

The new step text, in `features/step_definitions/hook/additional-context.steps.ts`:

```gherkin
Then the model receives these saved hook outputs:
  | label                                    | size   | path                                                                                               | preview characters | saved characters |
  | UserPromptSubmit hook additional context | 11.7KB | {project dir}/.pi/pi-claude-marketplace/data/_shared/hook-output/hook-{uuid}-additionalContext.txt | 2000               | 12000            |
```

The step reads every message of the last model call of the turn that holds `<persisted-output>`. Each one must match the exact wrapper shape after the bridge's label (`<label>: <persisted-output>\nOutput too large (<size>). Full output saved to: <path>\n\nPreview (first 2KB):\n<preview>\n...\n</persisted-output>`). The step then reads the file at the path. It fails unless the preview is the head of the file and the wrapper has at most 10,000 characters. It states one row per message, with run tokens projected and each UUID read as `{uuid}`. It compares the whole table with `deepStrictEqual` against `table.raw()` and calls `this.markTurnCompared()`.

**Red run (before the code change), `npm run test:cucumber:profile -- --profile adapter features/hook/additional-context.feature`:** exit 1, `9 scenarios (8 passed, 1 failed)`, `118 steps (117 passed, 1 failed)`. The new scenario failed in the new `Then`: the actual table had only its header row. No message of the call held a saved hook output, because the model received all 12,000 characters.

**Green run (after the change), same command:** exit 0, `9 scenarios (9 passed)`, `118 steps (118 passed)`.

Verify commands:

- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/context-cap.test.ts test/bridges/hooks/hook-output-files.test.ts test/shared/atomic-json.test.ts test/bridges/hooks/dispatch-exec.test.ts`: 127 tests, 127 pass.
- `npm run test:coverage:direct -- <context-cap.ts hook-output-files.ts atomic-json.ts dispatch-exec.ts registry.ts>`: exit 0 (100% direct line, branch, and function coverage).
- `npm run check:features`: exit 0.
- Also run: `npx tsc --noEmit` exit 0, `npm run fallow` exit 0, and ESLint on the changed files with `--max-warnings 0`, exit 0.

## Task 05-04-02: the background lane

- `node --import ... --test test/bridges/hooks/async-rewake/async-answer.test.ts test/bridges/hooks/async-rewake/registry.test.ts`: 14 tests and 133 tests, all pass. The existing table "gives a plain async hook's answer to the next call after ..." passes with its expectations unedited.
- `npm run test:coverage:direct -- async-answer.ts registry.ts`: exit 0.
- `npm run test:cucumber:profile -- --profile adapter features/hook/async.feature`: exit 0, `22 scenarios (22 passed)`, `338 steps (338 passed)`.
- The new owner cases wait on the promises the doubles expose (a counting Pi `sent(n)`, the saver's `called`, and a debug-line promise for the reload case). None waits on a timer or polls a file. Their PID-table writer is a no-op double, so no case writes the table to disk.
- `finalizeChild`, the `EXIT_HANDLERS` signature, the `rewake` arm, and the PID-table and journal code are unchanged in the diff.

## Task 05-04-03: the sweep

- `node --import ... --test test/bridges/hooks/hook-output-files.test.ts test/bridges/hooks/event-router.test.ts`, plus `test/architecture/hooks-lifecycle.test.ts` and `test/index.test.ts`: 284 tests, all pass. The registration count and order that hooks-lifecycle pins are unchanged.
- `npm run test:coverage:direct -- hook-output-files.ts event-router.ts`: exit 0.
- Owner cases: a file 31 days old goes, while one of exactly 30 days and a newer one stay. An old file with another name stays. A link to an old file outside the folder stays, its target stays, and a sub-folder stays. A missing folder writes no debug line. An unreadable folder (mode 000), or a folder link that leads outside the data root, writes one debug line and removes nothing. A bridge load removes the old file of the user scope (hermetic agent dir) and of the project scope. A project hydrate sweeps a trusted project and leaves an untrusted project's file in place.

## Callers' owner tests run

These ran after tasks 1 and 2: `test/bridges/hooks/dispatch*.test.ts`, `settle.test.ts`, `event-router.test.ts`, `event-adapters.test.ts`, `test/index.test.ts`, `test/bridges/hooks/async-rewake/*.test.ts`, and `test/architecture/hooks-*.test.ts`: 1,012 tests after task 1 and 929 tests after task 2 (a different selection), all pass. Also `test/integration/hooks-*.test.ts` and `test/architecture/no-shell-out.test.ts`: 50 tests, all pass.

I did not run the full `npm run check`, as the orchestrator asked. The wave gate is the orchestrator's.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] No `no-await-in-loop` disables in the sweep loop**
- **Found during:** Task 05-04-03
- **Issue:** The plan asks for a reasoned disable on each `await` inside the sweep loop, "as the analog has". The analog (`reapChildJournals`) has none. Its loop is a `for await` over `opendir`, and ESLint reports no `no-await-in-loop` finding inside that body. A disable there is an unused directive, which `--max-warnings 0` fails.
- **Fix:** No disable in `sweepHookOutput`, as in the analog. The second `await` in the `registerHooksBridgeWith` loop (a plain `for...of`) has its own reasoned disable, as planned.
- **Commit:** `97be83c9`

**2. [Rule 1 - Bug] A close after an error must not parse a second result**
- **Found during:** Task 05-04-01
- **Issue:** When the settle split in two, the `close` listener got its own claim. Its false arm (a `close` after an `error`) had no owner case, and the 100% branch gate would fail.
- **Fix:** The close handler computes the parsed result and the exit facts as before, then claims. Owner case: "settles a spawn error once when the process closes after it".
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts`, `test/bridges/hooks/dispatch-exec.test.ts`
- **Commit:** `aa22bf45`

**3. [Process] The em dash reached disk as a literal**
- **Found during:** Task 05-04-01 (pre-commit)
- **Issue:** The tool input turned the `—` escape into a literal U+2014, and `fix-unicode-dashes` then rewrote it to `--` in `context-cap.ts`, its test, and `dispatch-exec.test.ts`.
- **Fix:** I wrote the escape back with `chr(92)`. In the committed files, `grep -c` finds no literal em dash, and the escape is in `context-cap.ts`, `context-cap.test.ts`, `dispatch-exec.test.ts`, and `registry.test.ts`.

### Other choices inside the plan's latitude

- In task 1, `registry.ts` imported `saveHookOutput` type-only (only `typeof` used it). Task 2 made it a value import.
- `sendAsyncAnswer` caps the texts with `Promise.all`, so saves run at once and sends keep answer order.
- No guard keeps the wrapper within 10,000 characters for a path over about 7,700 characters. The path is `dataRoot` plus a fixed suffix of under 80 characters, and an owner case pins the bound for a 4,096-character path (PATH_MAX on Linux).

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug) and 1 process fix. **Impact:** none on scope.

## Flagged assumptions (from the plan, carried)

- **A7:** how upstream cuts the head in its write-failure text (`dy`, `qm`, `Z`) was not read. This project bounds the whole text at 10,000 characters, and no cut splits a surrogate pair. A failure line longer than the limit (a 20,000-character error) is cut at 10,000 too, so its closing `]` can be lost.
- **The neutralized tag:** only the ASCII forms of `persisted-output` and `/persisted-output`, in any letter case, are neutralized. A look-alike opener stays.
- **Every event:** the sync lane caps `additionalContext` on every event. On events that send no context to the model, an over-limit string writes a file that nothing reads.
- **An `onFailure` block after the cap:** a failed hook with `onFailure: "block"` and an over-limit context writes a file that the block then leaves out.
- **Sweep runs:** the project scope can be swept twice in one load (the factory loop at `opts.cwd` and the project hydrate). The sweep is idempotent.
- **The em dash:** kept as the escape `—` in the cap module and its tests. No feature states the failure line.
- **Retention:** 30 days and the folder are project choices (D-PG5-15, pending maintainer review).
- **Pre-write containment (new, residual):** `assertPathInside` checks the path before `write-file-atomic` creates its temporary file and renames it. A link swapped in between the check and the write is not caught, the same window as the PID-table writer.

## Parent-owned edits needed

1. `.agents/skills/cucumber/rules/layout.md`, the hooks paragraph: add that `additional-context.steps.ts` holds `the model receives these saved hook outputs:`.
2. `.planning/codebase/ARCHITECTURE.md`: `shared/atomic-json.ts` is described as "(JSON write-file-atomic wrapper)" and "one atomic-write primitive". It now also has `atomicWriteText`. Its chokepoint lists (lines 80 and 233) still name `bridges/agents/stage.ts`, which `rule-packs/architecture.json` no longer exempts.
3. `.planning/codebase/CONVENTIONS.md`: the same stale `bridges/agents/stage.ts` exemption in the `write-file-atomic-chokepoint` bullet. The `fallow-ignore` marker count (49) does not change, because this plan adds no marker.
4. `rule-packs/architecture.json` `write-file-atomic-chokepoint` message ("write JSON through atomicWriteJson"): it could also name `atomicWriteText`. This is optional, and the plan forbids editing it here.
5. `BACKLOG.md`: Claude Code's per-entry (100,000 characters) and per-dispatch (200,000 characters) limits of its hooks module chain (`BNt`, 05-RESEARCH U8) are left out of this phase.
6. VALIDATION evidence merge for PG-HOOK-14 (the limit): the red and green runs above.

## Known Stubs

None.

## Threat Flags

None. No security-relevant surface outside the plan's `<threat_model>` was added. The new file write and the sweep are T-05-12 and T-05-13, and the residual pre-write containment window is listed under the flagged assumptions.

## Self-Check: PASSED

- FOUND: `extensions/pi-claude-marketplace/bridges/hooks/context-cap.ts`, `hook-output-files.ts`, `test/bridges/hooks/context-cap.test.ts`, `test/bridges/hooks/hook-output-files.test.ts`, `features/step_definitions/hook/additional-context.steps.ts`
- FOUND: commits `aa22bf45`, `c4e1e6b0`, `97be83c9` on `features/gaps`
- `git rev-list --count ae9627d0..97be83c9` = 3
