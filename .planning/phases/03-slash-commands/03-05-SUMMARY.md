---
phase: 03-slash-commands
plan: 05
subsystem: testing
tags: [commands, cucumber, lifecycle, disable, enable, uninstall, update]

requires:
  - phase: 03-slash-commands
    provides: the command-file Given and the empty prompt-template listing Then (plan 03-01)
provides:
  - features/slash-command/lifecycle.feature, six CMD-05 scenarios that pin disable, enable, uninstall, and update through Pi's listing and the model call log
affects: [03-03 invocation handler (shares the typed-command path), later changes to the commands bridge or the plugin verbs]

actuals:
  tokens: 1020
  tasks: 2
  commits: 2

plan_head_before: 0ab69e590d8119ba4541225ae06d9899616dcd37
plan_head_after: 3aefc01fb89b7516ca7450a5220c734aed39e3a9

tech-stack:
  added: []
  patterns:
    - "A lifecycle pin of existing behavior is proven by a temporary negative edit in the verb's own code path, then reverted"

key-files:
  created:
    - features/slash-command/lifecycle.feature
  modified: []

key-decisions:
  - "`Given pi runs with the scripted model` sits in the Background, because the listing step needs the profile Pi and so all six scenarios need it"
  - "One negative edit (skipping `unstagePluginCommands` in `cascadeUnstagePlugin`) proves the disable listing, the disabled typed text, and the uninstall scenarios together, because disable and uninstall share that primitive"

patterns-established:
  - "Slash-command lifecycle scenarios mirror features/skill/lifecycle.feature: one Background that publishes and installs, one scenario per verb"

requirements-completed: [CMD-05]

coverage:
  - id: D1
    description: "A new session after disable or uninstall offers no prompt-template command of the plugin, and a disabled command typed by the user reaches the model as the typed text"
    requirement: CMD-05
    verification:
      - kind: e2e
        ref: "features/slash-command/lifecycle.feature#Disabling a plugin removes its slash commands from a new session"
        status: pass
      - kind: e2e
        ref: "features/slash-command/lifecycle.feature#A disabled plugin's slash command reaches the model as the typed text"
        status: pass
      - kind: e2e
        ref: "features/slash-command/lifecycle.feature#Uninstalling a plugin removes its slash commands from a new session"
        status: pass
    human_judgment: false
  - id: D2
    description: "A new session after enable offers the command again with its description"
    requirement: CMD-05
    verification:
      - kind: e2e
        ref: "features/slash-command/lifecycle.feature#Enabling a disabled plugin offers its slash commands again"
        status: pass
    human_judgment: false
  - id: D3
    description: "A new session after update lists the new description, and the typed command sends the model the new body"
    requirement: CMD-05
    verification:
      - kind: e2e
        ref: "features/slash-command/lifecycle.feature#Updating a plugin lists the new description of its slash command"
        status: pass
      - kind: e2e
        ref: "features/slash-command/lifecycle.feature#Updating a plugin sends the model the new body of its slash command"
        status: pass
    human_judgment: false

duration: 21min
completed: 2026-11-01
status: complete
---

# Phase 3 Plan 05: Slash command lifecycle pins Summary

**Six cucumber scenarios now pin that disable, enable, uninstall, and update each change what a new session offers for a bridged command and what the model receives. Each scenario was proven by a temporary negative edit in the product; no product file changed.**

## Performance

- **Duration:** about 21 min
- **Started:** 2026-11-01T18:16:14Z
- **Completed:** 2026-11-01T18:36:57Z
- **Tasks:** 2 of 2
- **Files modified:** 1 (created)
- **Baseline:** `BASE=0ab69e590d8119ba4541225ae06d9899616dcd37`

## Accomplishments

- `features/slash-command/lifecycle.feature` with a Background that starts the profile Pi, publishes `demo` 1.0.0 with the command `greet` (`Greets a person by name.`, body `Greet the person by name.`), adds `fixtures` to the project scope, and installs `demo`.
- Six scenarios (D-CF3-11): disable lists no prompt-template command; a disabled `/demo:greet` reaches the model as `/demo:greet`; enable lists `/demo:greet | Greets a person by name.` again; uninstall lists no prompt-template command; update to 1.1.0 lists `/demo:greet | Greets someone warmly.`; update sends the model `Greet the person warmly.`.
- Every invocation types no arguments, and every body holds no placeholder and no `!`, so the scenarios send the same text under Pi's expansion or plan 03-03's handler.

## Task Commits

1. **Task 1: Pin that disabling a plugin removes its commands from a new session, end to end** - `a8ec605` (test)
2. **Task 2: Pin enable, uninstall, update, and the disabled command's typed text** - `3aefc01` (test)

## Negative-edit proofs (each reverted with `git checkout -- <file>` before committing)

**Edit A: skip `unstagePluginCommands` in `cascadeUnstagePlugin`** (`orchestrators/marketplace/shared.ts`; replaced the call with `{ removedNames: [] }`). Task 1, the tracer alone:

```text
1) Disabling a plugin removes its slash commands from a new session # features/slash-command/lifecycle.feature:20
     Then pi offers no slash commands from prompt templates
         + [
         +   'demo:greet'
         + ]
         - []
1 scenario (1 failed)
```

Task 2, the same edit over the whole file:

```text
1) Disabling a plugin removes its slash commands from a new session # lifecycle.feature:20
     + [ 'demo:greet' ]   - []
2) A disabled plugin's slash command reaches the model as the typed text # lifecycle.feature:26
     +     'Greet the person by name.'
     -     '/demo:greet'
3) Uninstalling a plugin removes its slash commands from a new session # lifecycle.feature:46
     + [ 'demo:greet' ]   - []
6 scenarios (3 passed, 3 failed)
```

**Edit B: skip the commands phase on enable** (`orchestrators/plugin/install-outcome.ts`; `commandsPhase.do` returned early when `opts.allowExistingRecord === true`, which only the enable path sets):

```text
1) Enabling a disabled plugin offers its slash commands again # lifecycle.feature:37
     Then pi offers these slash commands from prompt templates:
           [ 'command', 'description' ],
         -   [ '/demo:greet', 'Greets a person by name.' ]
6 scenarios (5 passed, 1 failed)
```

**Edit C: keep the previous staged file on update** (`orchestrators/plugin/update-swap.ts`; replaced `await commitPreparedCommands(ops, handles.commands)` with `undefined`):

```text
1) Updating a plugin lists the new description of its slash command # lifecycle.feature:52
     +     'Greets a person by name.'
     -     'Greets someone warmly.'
2) Updating a plugin sends the model the new body of its slash command # lifecycle.feature:70
     +     'Greet the person by name.'
     -     'Greet the person warmly.'
6 scenarios (4 passed, 2 failed)
```

After each revert, `git status --short` showed only the feature file. `git diff --stat 0ab69e5..HEAD -- extensions` prints nothing.

## Files Created/Modified

- `features/slash-command/lifecycle.feature` - the six CMD-05 lifecycle scenarios

## Decisions Made

- **The profile Pi starts in the Background.** `When the user lists the slash commands pi offers` calls `profileHarness()`, so it needs `Given pi runs with the scripted model`, just as every listing scenario of plan 03-01 does. All six scenarios need it, and the feature rules say a Background holds the Givens every scenario needs.
- **One edit proves three scenarios.** Disable and uninstall both run `cascadeUnstagePlugin`. So skipping its command unstage fails the disable listing, the disabled typed text, and the uninstall listing together.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `Given pi runs with the scripted model` moved into the Background**
- **Found during:** Task 1
- **Issue:** The plan's Background and its listing scenarios do not start the profile Pi. The listing step needs it (`profileHarness()`), and the plan names the step only in the two model scenarios.
- **Fix:** The step is the Background's first Given. The two model scenarios do not repeat it.
- **Files modified:** `features/slash-command/lifecycle.feature`
- **Verification:** all six scenarios pass. `npm run check:features` passes.
- **Committed in:** `a8ec605`

---

**Total deviations:** 1 (blocking). **Impact:** none on scope. Each scenario still states the plan's steps and rows.

## Non-owned test edits

None. `git diff --stat 0ab69e5..HEAD` lists only `features/slash-command/lifecycle.feature` (and this SUMMARY).

## Verification

- `npx cucumber-js features/slash-command/lifecycle.feature`: 6 scenarios, 79 steps pass.
- `npx cucumber-js features/slash-command`: 17 scenarios, 200 steps pass. That includes plan 03-01's listing scenarios on this branch.
- `npm run check:features`: pass.
- Task 1's commit hook ran `check:commit`. Typecheck, fallow, format, test:corresponding, and check:features passed. ESLint was killed by memory on a cold cache. A lone `npm run lint` then passed, and the retried commit went through. Task 2's commit hook printed "(no files to check)" for `check:commit`, as expected inside the worktree. Task 2 changed only the feature file, and `check:features` passed on it.
- Acceptance: `grep -c '^  Scenario'` = 6; `grep -c 'Greets someone warmly.'` = 3; the tracer title appears once; `git diff --stat "$BASE"..HEAD -- extensions` is empty.

## Issues Encountered

- The first Task 1 commit failed because ESLint ran out of memory on a cold cache, with three other executors running. A lone `npm run lint` warmed the cache, and the second commit passed.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-03-15 is mitigated as planned: the disable and uninstall scenarios pin, through Pi's listing, that the command is gone. Edit A proves they fail when it stays.

## Dubious Choices

1. **The update scenarios replace the whole command file.** The command-file Given writes `greet` with a frontmatter `description` (the seed Given wrote the same key), so the update changes the description and the body together. A scenario that changes only the body would not tell a stale description from a stale body. The listing scenario pins the description and the model scenario pins the body.
2. **Edit B keys on `allowExistingRecord`.** It is the only option that the enable path alone passes to `runInstallLedger`. A future caller that also passes it would fall inside the edit, but the edit was temporary.

## Parent lines

- **CHANGELOG.md:** none. No user-visible behavior changed.
- **PROJECT.md Key Decisions:** none.
- **REQUIREMENTS.md:** CMD-05 is pinned by these scenarios. The before-reload abort for an uninstalled command stays with plan 03-03.

## Next Phase Readiness

- Plan 03-03 replaces Pi's expansion for staged commands. The two model scenarios type no arguments, and their bodies hold no placeholder and no `!`, so they must keep passing under the new handler.

## Self-Check: PASSED

- FOUND: `features/slash-command/lifecycle.feature`
- FOUND commits on this branch: `a8ec605`, `3aefc01`. `git rev-list --count 0ab69e5..3aefc01` = 2

---
*Phase: 03-slash-commands*
*Completed: 2026-11-01*
