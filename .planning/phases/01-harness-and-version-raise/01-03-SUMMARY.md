---
phase: 01-harness-and-version-raise
plan: 03
subsystem: testing
tags: [cucumber, pi-rpc, faux-provider, scripted-model, companions, profile-pi, jiti]

requires:
  - phase: 01-harness-and-version-raise
    provides: "Pi 1.4.0, the exact pi-ai faux provider, and the three-companion peer cache (plan 01-01); the profile Pi and scripted-model rules (plan 01-02)"
provides:
  - "A per-scenario profile Pi: the real extension, the scripted model, and the companions a table names, with a trust.json entry and TMPDIR in the sandbox home (D-CF1-15, D-CF1-07)"
  - "The scripted model: a file-backed faux provider with a call log, no fallback reply, and an unused-step check (D-CF1-17)"
  - "The model-turn When, which waits for agent_settled and keeps every record and stand-in log line of the turn (HAR-03)"
  - "The companion resolver over the peer cache's pi.extensions entries with a floor check (HAR-01)"
  - "The stand-in pid check and the uncompared-turn check in the reset (HAR-05)"
  - "The skill seed: features/skill/invocation.feature with two scenarios (HAR-07, D-CF1-08)"
affects: [01-04, 01-05, 01-06, 01-07, 01-08, 01-09, skills, slash-commands, agents, hooks, mcp-servers, workflows]

actuals:
  tokens: 13157    # chars/4 over the added diff lines (52,628 chars)
  tasks: 3
  commits: 4       # MEASURED: git rev-list --count 9a815c5..HEAD
plan_head_before: 9a815c57e5be80e7c6c7ca4df70dbebe7f7bb60c
plan_head_after: a6c8d6045bd92ba4d26e7033facef3daddc580bc

tech-stack:
  added: []
  patterns:
    - "Profile Pi per scenario: world.usePiWithProfile() replaces the run's Pi until the scenario's release stops it"
    - "Stand-in convention: <home>/harness/<name>.jsonl, one JSON line per event, and <home>/harness/<name>-<pid>.pid"
    - "A Pi extension under features/lib/ carries a fallow-ignore-next-line unused-export marker on its default export"
    - "The scripted model registers through a provider config with a literal key, so Pi counts it as configured at once"

key-files:
  created:
    - features/lib/scripted-model/extension.ts
    - features/lib/scripted-model/script.ts
    - features/lib/turn-records.ts
    - features/lib/companions.ts
    - features/lib/skill-files.ts
    - features/step_definitions/model.steps.ts
    - features/step_definitions/companion.steps.ts
    - features/step_definitions/skill/invocation.steps.ts
    - features/skill/invocation.feature
  modified:
    - test/e2e/_rpc.ts
    - test/architecture/hermetic-git-environment.test.ts
    - features/lib/pi-process.ts
    - features/support/world.ts
    - features/step_definitions/session.steps.ts

key-decisions:
  - "The jiti compile cache of a profile Pi ({home}/tmp/jiti) is a symlink to <run root>/jiti-cache, so the cache survives the sandbox reset; a cold cache cost 9-17 s per Pi start"
  - "The scripted model registers with pi.registerProvider(name, config) and the literal key scripted-model instead of the faux Provider object, because a new session otherwise raced Pi's background availability pass and started with no model"
  - "PiProcess cancels every dialog, also one outside a request, because Pi waits on a dialog that arrives during a model turn"
  - "The model script table has the columns reply, tool, and arguments; a row is a reply or a tool call with JSON arguments"
  - "The calls Then renders a tool call as 'tool call <name> <json>' and a tool result as role 'tool result' with '<tool> returned|failed: <text>'"

patterns-established:
  - "Model turns: note recordCount() and the harness log lengths, send the prompt, wait for agent_settled through waitForRecord, slice records and logs"
  - "A passing scenario fails when a model script step went unused or the last model turn went uncompared"

requirements-completed: [HAR-01, HAR-02, HAR-03, HAR-05, HAR-07]

coverage:
  - id: D1
    description: "A profile Pi starts with the scripted model and no companion; get_commands lists no command from the peer cache; the run's shared Pi is unchanged"
    requirement: HAR-01
    verification:
      - kind: e2e
        ref: "features/skill/invocation.feature#Invoking a skill sends the model its body in a skill block"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber -- features/marketplace features/plugin (1154/1154)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A profile Pi loads pi-subagents, pi-mcp-adapter, and pi-dynamic-workflows from their pi.extensions entries at the declared floors, and each lists a command from its own package"
    requirement: HAR-01
    verification:
      - kind: e2e
        ref: "features/skill/invocation.feature#Invoking a skill with the companions loaded sends the model the same skill block"
        status: pass
    human_judgment: false
  - id: D3
    description: "The scripted model plays the file-backed script, logs each call whole, fails a call past the script, and an unused step fails the scenario"
    requirement: HAR-02
    verification:
      - kind: e2e
        ref: "features/skill/invocation.feature (both scenarios)"
        status: pass
      - kind: manual_procedural
        ref: "red proofs (a) and (b) in this SUMMARY, run on a temporary feature edit, not committed"
        status: pass
    human_judgment: false
  - id: D4
    description: "The model-turn When waits for agent_settled with aborted false, keeps every record and stand-in log line, and uses no fixed sleep"
    requirement: HAR-03
    verification:
      - kind: e2e
        ref: "features/skill/invocation.feature (both scenarios)"
        status: pass
      - kind: other
        ref: "grep -cE 'setTimeout\\(resolve, [0-9]' features/step_definitions/session.steps.ts (0)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Profile Pis are hermetic: TMPDIR in the sandbox home, the allowlist plus the git keys plus TMPDIR only, a trust.json entry, and a release that stops the group and checks stand-in pids"
    requirement: HAR-05
    verification:
      - kind: unit
        ref: "test/architecture/hermetic-git-environment.test.ts#adds the profile's TMPDIR, not the shell's, to the git environment"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber, twice in random order (1156/1156, seeds 185332 and 378183)"
        status: pass
    human_judgment: true
    rationale: "No Phase 1 stand-in writes a pid file yet, so the pid check has run only on an empty harness directory; plans 01-05 and 01-08 add the first stand-ins"
  - id: D6
    description: "The skill seed: invoking /skill:demo-greet Ada sends one user message, Pi's skill block followed by the argument, compared whole"
    requirement: HAR-07
    verification:
      - kind: e2e
        ref: "features/skill/invocation.feature"
        status: pass
      - kind: other
        ref: "npm run check:features"
        status: pass
    human_judgment: false

duration: 1h 17m
completed: 2026-11-01
status: complete
---

# Phase 1 Plan 03: Profile Pi, Scripted Model, and Skill Seed Summary

**A scenario now starts its own Pi with a file-backed faux model and the three companions from the peer cache, invokes a bridged skill, and compares the whole message Pi sent the model; the reset fails on unused script steps, uncompared turns, and leftover stand-in processes.**

## Performance

- **Duration:** 1h 17m
- **Started:** 2026-11-01T02:56:48Z
- **Completed:** 2026-11-01T04:13:24Z
- **Tasks:** 3 (plus one fix commit)
- **Files modified:** 14

## Accomplishments

- `startRpcPi(sandbox, git, profile?)` takes an `RpcProfile` (extra extensions and a typed `TMPDIR`), and `rpcChildEnvironment` adds `TMPDIR` only when given. The hermetic test pins the whole object with a shell `TMPDIR` set.
- `PiProcess` keeps every record in a log, waits for a record without polling, cancels every dialog, and reports busy during a model turn.
- The scripted model plays `<home>/harness/model-script.json`. It takes its step from the line count of `<home>/harness/model-calls.jsonl` and logs each call whole. A call past the script fails, and there is no fallback reply.
- `world.usePiWithProfile()` starts the profile Pi with a `trust.json` entry, `set_model` faux/faux-1, and auto retry off. The world keeps the last model turn. The reset fails on unused script steps, an uncompared turn, and a stand-in pid that is still alive.
- `features/skill/invocation.feature` has two scenarios, with and without the companions. Both compare the user message whole.

## Task Commits

1. **Task 1: A profile Pi with the scripted model runs a skill invocation end to end**: `61500db` (test)
2. **Task 2: Load the three companions into the profile Pi**: `cb083db` (test)
3. **Fix: keep the scripted model selected after a new session**: `1447628` (fix, deviation 2)
4. **Task 3: Make the profile reset hermetic and fail on unused steps and uncompared turns**: `a6c8d60` (test)

## Contracts for the wave-3 plans

### Step texts added

| Keyword | Text | Module |
| --- | --- | --- |
| Given | `pi runs with the scripted model` | `features/step_definitions/model.steps.ts` |
| Given | `pi runs with the scripted model and these companions:` (one column, `companion`: `pi-subagents`, `pi-mcp-adapter`, `pi-dynamic-workflows`) | `features/step_definitions/companion.steps.ts` |
| Given | `the scripted model plays these steps:` (columns `reply`, or `reply`, `tool`, and `arguments`; a row is a reply, or a tool call whose arguments are a JSON object; cells expand run tokens) | `features/step_definitions/model.steps.ts` |
| Given | `the published plugin {string} of the marketplace {string} has the skill {string} described as {string} with this body:` (doc string) | `features/step_definitions/skill/invocation.steps.ts` |
| When | `the user prompts {string}` | `features/step_definitions/session.steps.ts` |
| Then | `the model receives these calls:` (columns `call`, `role`, `text`; one row per message of every call of the last turn, system messages left out; roles `user`, `assistant`, `tool result`; a tool call reads `tool call <name> <json>`, a tool result `<tool> returned: <text>` or `<tool> failed: <text>`; run tokens projected) | `features/step_definitions/model.steps.ts` |

### World members added (`features/support/world.ts`)

- `interface PiProfile { readonly companions: readonly CompanionName[]; readonly extraExtensions?: readonly string[]; readonly trust?: "trusted" | "untrusted" }`
- `interface ModelTurn { readonly prompt: string; readonly disposition: string; readonly records: readonly RpcRecord[]; readonly logs: ReadonlyMap<string, readonly unknown[]> }`
- `usePiWithProfile(profile: PiProfile): Promise<void>` loads, in fixed order, the real extension, the scripted model, the companions (pi-subagents, pi-mcp-adapter, pi-dynamic-workflows), and then `extraExtensions`. `trust: "untrusted"` writes no `trust.json` entry. Plan 01-07 must still write `<project>/.pi/settings.json` itself.
- `profileHarness(): string` returns the harness directory, or fails when no profile Pi started.
- `recordTurn(turn)`, `requireTurn()`, `markTurnCompared()`, `lastTurnUncompared` (getter), and `unusedScriptSteps()`.

### Library exports

- `test/e2e/_rpc.ts`: `RpcProfile { extensions; environment }`, `RpcProfileEnvironment { TMPDIR }`, `startRpcPi(sandbox, git, profile?)`, `rpcChildEnvironment(sandbox, git?, profileEnvironment?)`.
- `features/lib/pi-process.ts`: `PiProcess.start(sandbox, git, profile?)`, `recordCount()`, `recordsSince(index)`, `waitForRecord(fromIndex, matches, timeoutMs)`, and the `RpcRecord` and `RpcProfile` types.
- `features/lib/turn-records.ts`: `harnessDirectory(home)`, `readLogLengths(dir)`, `readLogLinesSince(dir, lengths)`, `assertStandInsStopped(dir)`.
- `features/lib/scripted-model/script.ts`: `ScriptStep`, `ModelCall`, `modelCallsPath`, `parseScriptTable`, `writeModelScript`, `readModelScript`, `readModelCalls`, `modelCallsOf(turn.logs)`, `callMessageRows(calls)`.
- `features/lib/companions.ts`: `CompanionName`, `Companion`, `isInPeerCache`, `parseCompanionName`, `inLoadOrder`, `resolveCompanion`.
- `features/lib/skill-files.ts`: `PluginSkill`, `skillFileText`, `publishSkill`.

### Stand-in convention

A stand-in appends one JSON line per event to `<home>/harness/<name>.jsonl`, and a stand-in process writes its pid to `<home>/harness/<name>-<pid>.pid`. A turn's `logs` maps each `*.jsonl` file name to the lines it gained during the turn. After it stops the profile Pi, the release asserts that every pid file's process has exited.

## Evidence

### Companion load (Task 2)

| Companion | Version | Resolved `pi.extensions` entry | Command the load check found (first in Pi's order) |
| --- | --- | --- | --- |
| pi-subagents | 0.84.0 | `node_modules/.cache/optional-peers/node_modules/pi-subagents/bundle/index.js` | `subagents-watchdog` (also `subagents`, `run`, `subagents-doctor`, and others) |
| pi-mcp-adapter | 7.0.0 | `node_modules/.cache/optional-peers/node_modules/pi-mcp-adapter/index.ts` | `mcp-adapter` (also `mcp`, `mcp-auth`) |
| pi-dynamic-workflows | 3.15.0 | `node_modules/.cache/optional-peers/node_modules/@quintinshaw/pi-dynamic-workflows/extensions/workflow.ts` | `workflows` (also `workflows-models`, `deep-research`, and others) |

No companion changed the message. The companion scenario states the same user message as the first scenario.

### Red proofs (Task 3; temporary feature edits, reverted, not committed)

(a) An extra script step (`| Goodbye. |`) in the first scenario fails in `After`:

```text
AssertionError [ERR_ASSERTION]: no model call used these steps of the model script
+ [
+   {
+     reply: 'Goodbye.'
+   }
+ ]
- []
```

(b) No extra step, but a second `When the user prompts "/skill:demo-greet Bea"` fails the turn:

```text
When the user prompts "/skill:demo-greet Bea" # features/step_definitions/session.steps.ts:84
AssertionError [ERR_ASSERTION]: the model was called past the end of its script
+ [
+   'call 2'
+ ]
- []
```

(c) The calls `Then` removed fails in `After`:

```text
AssertionError [ERR_ASSERTION]: no step compared the last model turn
true !== false
```

After the reverts, `git diff HEAD --stat -- features/skill/invocation.feature` printed nothing.

### Suite runs

- Task 1 acceptance: `npm run test:cucumber -- features/marketplace features/plugin` 1154/1154 scenarios (seed 902370).
- Task 3: `npm run test:cucumber` twice, 1156/1156 each (seeds 185332 and 378183). The second run started after the last `world.ts` edit (the try/finally around the script read), so it ran the committed code.
- `node --test test/architecture/hermetic-git-environment.test.ts`: 5/5. `npm run check:features`: pass. `npx fallow dead-code --fail-on-issues`: pass. The commit hook's `check:commit` passed on every commit.
- Startup cost: a profile Pi with a cold jiti cache takes 13-20 s to answer its first request (20 s with the three companions). With the warm per-worker cache it takes about 1.4 s.

## Files Created/Modified

- `test/e2e/_rpc.ts`: `RpcProfile`, profile-aware `startRpcPi` and `rpcChildEnvironment`.
- `test/architecture/hermetic-git-environment.test.ts`: the inherited `TMPDIR` and the profile `TMPDIR` case.
- `features/lib/pi-process.ts`: record log, `waitForRecord`, turn-aware `idle`, dialog cancel outside requests.
- `features/lib/scripted-model/extension.ts`: the scripted model Pi extension.
- `features/lib/scripted-model/script.ts`: script and call-log format, table parser, call rows.
- `features/lib/turn-records.ts`: harness directory, log slicing, stand-in pid check.
- `features/lib/companions.ts`: companion names, load order, peer cache resolver with floor check.
- `features/lib/skill-files.ts`: `SKILL.md` writer for published plugins.
- `features/support/world.ts`: the profile Pi, the last model turn, and the reset checks.
- `features/step_definitions/model.steps.ts`, `companion.steps.ts`, `session.steps.ts`, `skill/invocation.steps.ts`: the steps listed above.
- `features/skill/invocation.feature`: the skill seed, two scenarios.

## Decisions Made

- Step texts: `pi runs with the scripted model` follows the existing `pi runs with the github base address ...`. `the user prompts {string}` is distinct from `the user sends the message {string}`.
- The calls `Then` reads the turn's log lines (`turn.logs`), never the script.
- The unused-step check counts calls without `overflow` against the script length. A call past the script takes no step.
- `profileHarness()` is a world method, so the steps and the prompt `When` share one source for the harness directory. A prompt to the shared Pi fails with "no step started a profile Pi in this scenario".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A cold jiti cache made every profile Pi start take 13-20 s**

- **Found during:** Task 1
- **Issue:** Pi compiles TypeScript extensions through jiti, which caches under `$TMPDIR/jiti`. The plan puts `TMPDIR` at `{home}/tmp`, and `Before()` empties the home before every scenario, so each profile Pi recompiled the real extension and the scripted model. Measured: 9.4 s cold and 1.2 s warm for the same Pi.
- **Fix:** `usePiWithProfile` links `{home}/tmp/jiti` to `<run root>/jiti-cache`, which lasts the worker's run, and documents why. `TMPDIR` stays `{home}/tmp`, and the environment is still the allowlist plus the git keys plus `TMPDIR`.
- **Files modified:** `features/support/world.ts`
- **Verification:** the second profile start in one worker took 1.4 s, against 16.8 s before.
- **Committed in:** `61500db`

**2. [Rule 1 - Bug] A prompt right after a new session sometimes found no model**

- **Found during:** Task 3 (the first red-proof run failed for an unrelated reason). The scenario then failed in 1 of 6 plain runs.
- **Issue:** Pi rejected the prompt with "No API key found for the selected model". The model was Pi's placeholder `unknown`. A new session keeps the saved default model only when `hasConfiguredAuth` holds (`findInitialModel`). The faux `Provider` object resolves its key at request time, so Pi marks it configured only after a background availability pass, which a new session can outrun.
- **Fix:** the scripted model now registers `createFauxCore`'s stream through `pi.registerProvider("faux", { apiKey: "scripted-model", api, streamSimple, models, baseUrl })`. Pi marks a literal key configured at once (`markProvisionallyConfigured`). The key reaches no service, because the faux stream makes no request.
- **Files modified:** `features/lib/scripted-model/extension.ts`
- **Verification:** 8/8 consecutive runs of the first scenario passed, against 5/6 before. Both full suite runs passed.
- **Committed in:** `1447628` (its own commit)

**3. [Rule 2 - Missing critical] Dialogs during a model turn were never answered**

- **Found during:** Task 1
- **Issue:** `PiProcess` cancelled a dialog only while a request was in flight. A model turn runs after Pi answers the prompt, so a dialog during the turn would leave Pi waiting until the deadline.
- **Fix:** `PiProcess` cancels every dialog. A dialog during a request is still recorded on that request's exchange. The prompt `When` also fails on any dialog or extension error in the turn's records.
- **Files modified:** `features/lib/pi-process.ts`
- **Committed in:** `61500db`

**4. [File order] `features/lib/companions.ts` was created in Task 1, and `model.steps.ts` was edited in Task 2**

- The Task 1 profile `Given` must assert that no command comes from the peer cache (HAR-01 empty), so Task 1 needed the cache path. Task 2 completed the file and changed the `Given`'s profile to `{ companions: [] }`.

**5. [Wording] The unused-step message reads "no model call used these steps of the model script"**

- The plan suggested "no step used these steps of the model script". "Step" would name both a cucumber step and a script step there.

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug, 1 missing critical), plus 2 small ordering and wording changes.
**Impact on plan:** All necessary for a usable and reliable frozen harness. No scope creep.

## Issues Encountered

- The worktree guard refused compound shell commands that named git or ran a computed program. The commands ran as separate plain calls.
- Three commit hooks ran longer than the 10-minute tool limit, so the tool moved them to the background. Their early output was lost. The hook output that remained shows `npm run check:commit ... Passed` for the Task 2, fix, and Task 3 commits. The Task 1 commit completed (exit 0), so its pre-commit stage passed too.

## Known Stubs

None.

## Dubious Choices

1. **jiti cache outside the sandbox home.** `{home}/tmp/jiti` links to `<run root>/jiti-cache`, which is outside the sandbox but inside the run's own temporary root, and `AfterAll` removes it. It holds only compiled copies of repository and peer sources. The alternatives were 13-20 s per profile scenario, or `JITI_FS_CACHE` in the child environment, which breaks the "allowlist plus TMPDIR only" truth.
2. **Literal provider key `scripted-model`.** This works around a Pi race on new sessions with an extension provider whose key resolves late (a Pi behavior, not this extension's). A user's real provider is unaffected. If Pi changes how it marks a provider configured, the flake can return.
3. **Dialog cancel for the run's shared Pi too.** The shared Pi now also cancels a dialog that arrives outside a request. That was a hang before. Both shared suite runs passed.
4. **System prompt rendering in the call record.** `systemPrompt` is the leading system message's content plus its non-null sections, joined by a blank line. I did not check this against Pi's provider rendering. Every message is recorded whole as well, so a later step can read the original.
5. **Script table and row formats.** The `reply`/`tool`/`arguments` columns, `tool call <name> <json>`, and `<tool> returned|failed: <text>` are my choices. The wave-3 plans that use tool calls (agents, MCP, hooks, workflows) are the first real test of them.
6. **HAR-02 empty and HAR-03 empty are proven by design, not by a scenario.** No scenario runs a `handled` prompt through the model `When`, or a model call with no script armed. With no script file, `readModelScript` returns no steps, so the first call is logged with `overflow` as call 1, and the `When` fails.
7. **Stand-in pid check untested on a live pid.** No Phase 1 stand-in writes a pid file yet. A pid file whose content is not an integer counts as a failure.
8. **Companion load check uses commands.** Each companion must list at least one command whose source lies in its package root. A tool-level check waits for the registry probe (plan 01-04).
9. **Companion table order equals load order in the seed.** The seed names the companions in load order, so it cannot show that the world reorders them. The reorder is in `inLoadOrder` and is not proven by a scenario.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: file-access | features/support/world.ts | `{home}/tmp/jiti` is a symlink from the sandbox to `<run root>/jiti-cache`, a directory that outlives each scenario's sandbox reset (deviation 1). It holds compiled sources only, and `AfterAll` removes it with the run root. |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 01-04 to 01-08 can write their scenarios against the step texts, world members, and stand-in convention above.
- Plan 01-04 adds the registry probe through `extraExtensions` or a profile field. Plan 01-07 writes `<project>/.pi/settings.json` beside `trust: "untrusted"`.
- Plan 01-09 should reconcile `.agents/skills/cucumber/rules/world-and-stand-ins.md` with three facts: the jiti cache link, the literal-key registration, and the final step texts.

---
*Phase: 01-harness-and-version-raise*
*Completed: 2026-11-01*

## Self-Check: PASSED

- FOUND: all nine created files; `features/skill/invocation.feature` holds 2 scenarios.
- FOUND on HEAD: `61500db`, `cb083db`, `1447628`, `a6c8d60` (`git rev-list --count 9a815c5..a6c8d60` = 4).
- Acceptance criteria re-run: the Task 1 greps (1 marker, 4 `agent_settled`, 0 fixed sleeps), the Task 2 greps (`pi-dynamic-workflows` in `companions.ts`, 2 scenarios), and an empty feature diff after the red proofs.
