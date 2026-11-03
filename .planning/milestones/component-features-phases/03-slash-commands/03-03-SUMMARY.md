---
phase: 03-slash-commands
plan: 03
subsystem: orchestrators/command-invocation, edge/command-invocation
tags: [commands, invocation, argument-substitution, context-injection, cucumber]

requires:
  - phase: 01-harness-and-version-raise
    provides: the frozen invocation cores (substituteArguments, expandContextInjections, selectPromptShell), the seed input handler
  - phase: 03-slash-commands plan 01
    provides: the staged-command writer and the pi-claude-marketplace {pluginRoot, pluginData} record
provides:
  - invokeStagedCommand, the D-CF3-06 invocation of a typed staged command (send, refuse, not-staged)
  - registerCommandInvocation, the input handler that sends a typed staged command through it
  - readCommandRecord, the session-time reader of the install-time record
  - features/slash-command/invocation.feature (CMD-02 argument forms, variables, injection, refusals, D-CF1-03 pin)
affects: [03-06 project-command ledger record, 03-07 provenance check before the phase gate]

actuals:
  tokens: 16231
  tasks: 3
  commits: 3

plan_head_before: 0ab69e590d8119ba4541225ae06d9899616dcd37
plan_head_after: 828987f79f4d74d560d98ec72f583d35579c1b40

tech-stack:
  added: []
  patterns:
    - "The command invocation refuses through `.catch(refusalFor)`: only the cores' own errors become a refusal, anything else propagates to the edge, which reports it as a usage error"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/command-invocation.ts
    - test/orchestrators/command-invocation.test.ts
    - features/slash-command/invocation.feature
    - features/step_definitions/slash-command/invocation.steps.ts
  modified:
    - extensions/pi-claude-marketplace/edge/command-invocation.ts
    - test/edge/command-invocation.test.ts
    - extensions/pi-claude-marketplace/bridges/commands/command-record.ts
    - test/bridges/commands/command-record.test.ts
    - test/index.test.ts

key-decisions:
  - "The path-variable scenario expects `{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo`, the value install gives a command (pluginDataDir(mp, plugin)), not the `data/demo` literal of the hooks feature the plan cited"
  - "The handler splits `/<name> <rest>` with startsWith and a single `\\s` search, because the regex form trips sonarjs/super-linear-regex"
  - "The trust refusal runs before the file read, and the bash-missing refusal after the substitution, as the plan orders the steps"

patterns-established:
  - "A typed slash command reaches the invocation only when Pi lists a `prompt` command of that name; the pass-through rows return synchronously"

requirements-completed: [CMD-02, CMD-03]

coverage:
  - id: D1
    description: "A typed staged command reaches the model with Claude Code's appended-arguments rule"
    requirement: CMD-02
    verification:
      - kind: e2e
        ref: "features/slash-command/invocation.feature#Invoking a command sends the model its body with the typed arguments"
        status: pass
      - kind: unit
        ref: "test/edge/command-invocation.test.ts"
        status: pass
      - kind: unit
        ref: "test/orchestrators/command-invocation.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every argument form, the session id and effort, and the install-time path variables fill a command as Claude Code fills them"
    requirement: CMD-02
    verification:
      - kind: e2e
        ref: "features/slash-command/invocation.feature#Arguments fill a command's placeholders as Claude Code fills them (6 rows)"
        status: pass
      - kind: e2e
        ref: "features/slash-command/invocation.feature#A command's session id and effort are filled in when it runs"
        status: pass
      - kind: e2e
        ref: "features/slash-command/invocation.feature#A command's path variables keep the values install gave them"
        status: pass
      - kind: unit
        ref: "test/bridges/commands/command-record.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "A command's ! commands run after the substitution; failures, a missing Bash, an oversized invocation, an untrusted project, and a removed file refuse with a usage error"
    requirement: CMD-03
    verification:
      - kind: e2e
        ref: "features/slash-command/invocation.feature#A context command in a command runs before the model sees the command"
        status: pass
      - kind: e2e
        ref: "features/slash-command/invocation.feature#A failing context command stops the command and reports Claude Code's message"
        status: pass
      - kind: e2e
        ref: "features/slash-command/invocation.feature#An argument that starts with an exclamation mark reaches the model escaped and runs nothing"
        status: pass
      - kind: e2e
        ref: "features/slash-command/invocation.feature#Invoking a command that an uninstall removed before a reload reports the missing file"
        status: pass
      - kind: unit
        ref: "test/orchestrators/command-invocation.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "A slash command the user wrote keeps Pi's 1-based expansion, and extension input and non-slash text pass through"
    requirement: CMD-02
    verification:
      - kind: e2e
        ref: "features/slash-command/invocation.feature#A slash command the user wrote keeps pi's own argument expansion"
        status: pass
      - kind: unit
        ref: "test/edge/command-invocation.test.ts#T-03-06: passes extension input through without reading pi or the context"
        status: pass
    human_judgment: false

duration: 44min
completed: 2026-11-01
status: complete
---

# Phase 3 Plan 03: Slash command invocation Summary

**A typed bridged slash command now reaches the model as Claude Code sends it. The body is filled by the frozen `T2e` core with the typed arguments, the session id, the effort, the project directory, and the plugin root and data from the install-time record. Its `!` commands run after the substitution, and every failure refuses with a usage error and sends nothing to the model.**

## Performance

- **Duration:** about 44 min
- **Started:** 2026-11-01T18:16:21Z
- **Completed:** 2026-11-01T19:00:38Z
- **Tasks:** 3 of 3
- **Files modified:** 9 (4 created, 5 modified)
- **Baseline:** `BASE=0ab69e590d8119ba4541225ae06d9899616dcd37`

## Accomplishments

- `orchestrators/command-invocation.ts` (`invokeStagedCommand`) runs these steps in order:
  1. It finds the `prompt` command and matches its resolved path against the two staged prompt paths.
  2. It refuses a project command when Pi does not trust the project, before it reads anything.
  3. It reads and parses the staged file once. A file it cannot read or parse is refused.
  4. It calls `substituteArguments` with the session, effort, project, and recorded plugin variables.
  5. It picks the shell with `selectPromptShell` and refuses when Bash is missing.
  6. It runs `expandContextInjections` in the session directory.

  `ContextInjectionError` and `InvocationTooLargeError` become refusals. Any other error propagates.
- `edge/command-invocation.ts` returns `continue` at once for `extension` input, for text that does not start with `/`, and for a token Pi does not list as a `prompt` command. In those cases it reads nothing else. For a staged command it builds the request and maps the outcome to `transform` (images kept), `handled` (a usage error through `openNotificationRun` and `notifyUsageError`, origin `commandId: <name>`), or `continue`.
- `bridges/commands/command-record.ts` gains `readCommandRecord`, a reader backed by a closed typebox schema.
- `features/slash-command/invocation.feature`: 9 scenarios, one of them a 6-row Outline, so 14 runs in all. Added step: `Given the user's pi directory has the slash command {string} with this command file:`.

## Task Commits

1. **Task 1: Send a typed staged command's body with Claude Code's argument rule, end to end** - `b75a8dd` (feat)
2. **Task 2: Fill every argument form and invocation variable, read the stored record, leave the user's own templates to Pi** - `a83dfd9` (feat)
3. **Task 3: Run a command's context commands and abort with Claude Code's messages** - `828987f` (feat)

## Red proofs (every scenario run before any product code existed)

I wrote all the scenarios first and ran them against the base tree. Result: `14 scenarios (2 passed, 12 failed)`. The two that passed are the user-template pin and the `no arguments` Outline row, where Pi's expansion gives the same `Deploy  now`. I then split the file across the three task commits.

```text
6) Invoking a command sends the model its body with the typed arguments  # invocation.feature:7
   +     'Greet the person named in the arguments.'
   -     'Greet the person named in the arguments.\n\nARGUMENTS: Ada'
7) Outline row "named"          + 'Hello $name from $place.'      - 'Hello Ada from New York.'
1) Outline row "positional"     + ' and Ada'                      - 'Ada and Grace'
8) Outline row "indexed"        + 'Second: Ada Grace[1]'          - 'Second: Grace'
11) Outline row "missing index" + 'Third: Grace'                  - 'Third: $2\n\nARGUMENTS: Ada Grace'
2) Outline row "raw"            + 'All: Ada New York'             - "All: Ada 'New York'"
9) A command's session id and effort are filled in when it runs   # invocation.feature:63
   +     'Session ${CLAUDE_SESSION_ID} at effort ${CLAUDE_EFFORT}.'
   -     'Session {uuid} at effort low.'
5) A context command in a command runs before the model sees the command
   +     'Status: !`printf ok`'
   -     'Status: ok'
4) An argument that starts with an exclamation mark reaches the model escaped and runs nothing
   +     'Echo: !`printf pwned`'
   -     'Echo: \\! `printf pwned`'
3) A failing context command stops the command and reports Claude Code's message
       When the user runs "/demo:check"
   +   disposition: 'started'
   -   disposition: 'handled'
12) Invoking a command that an uninstall removed before a reload reports the missing file
       When the user runs "/demo:greet Ada"
   +   disposition: 'started'
   -   disposition: 'handled'
```

The tracer was also run alone before Task 1's code: `1 scenario (1 failed)`, with the same diff as row 6.

Failure 10 (the path scenario) failed only on my first literal (`data/demo`). Pi already sent `data/fixtures/demo`. See Deviation 1. It is a pin, proved by the negative edit below.

## Negative-edit proofs (Task 2, each reverted before committing)

1. **Path variables keep their install-time values.** Skipping only the install-time substitution in `bridges/commands/staged-command.ts` (`substituteClaudeVars` replaced by identity) left the scenario green: `1 scenario (1 passed)`. The invocation fills `${CLAUDE_*}` in the body too, from the same record values and `cwd`. Skipping both that and the invocation variables (`variables: {}`) fails it:
   ```text
   +     'Root ${CLAUDE_PLUGIN_ROOT}, data ${CLAUDE_PLUGIN_DATA}, project ${CLAUDE_PROJECT_DIR}.'
   -     'Root {home}/marketplaces/fixtures/plugins/demo, data {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo, project {project dir}.'
   1 scenario (1 failed)
   ```
   With the install substitution restored and the invocation variables still dropped, the scenario passes again. So the install-time values alone carry it. Both files were reverted. `git diff --stat` for `staged-command.ts` prints nothing.
2. **The user's own template keeps Pi's expansion.** I sent every listed prompt command through the invocation (`locateStagedCommand` returned `{ file, scope: staged?.[0] ?? "user" }`):
   ```text
   +     'First: Grace. All: Ada Grace.'
   -     'First: Ada. All: Ada Grace.'
   1 scenario (1 failed)
   ```
   Reverted.

## E8 residual (D-CF1-01)

No safe way exists to stop Pi from expanding a returned body again when it starts with `/<template>`. The handler returns the substituted text as the `transform` text unchanged, and Pi expands it a second time. Claude Code sends it literally. Two unit cases pin our side:
- `test/edge/command-invocation.test.ts`: "D-CF1-01: returns a sent body that starts with another command unchanged, which pi expands again"
- `test/orchestrators/command-invocation.test.ts`: "D-CF1-01: sends a body that starts with another command as it is, which pi expands again"

## `test/index.test.ts` diff (whole, `git diff 0ab69e5..HEAD -- test/index.test.ts`)

```diff
@@ -119,7 +119,10 @@ type BackgroundInputListener = (
 /** The bridged-command input listener, which answers with an input result. */
-type CommandInvocationListener = (event: InputEvent, ctx: ExtensionContext) => InputEventResult;
+type CommandInvocationListener = (
+  event: InputEvent,
+  ctx: ExtensionContext,
+) => InputEventResult | Promise<InputEventResult>;
@@ -137,6 +140,7 @@ interface HermeticScope {
 interface LoadedExtension {
+  readonly pi: ExtensionAPI;
   readonly bridgeSessionStart: BridgeSessionStartListener;
@@ -519,6 +523,7 @@ async function loadExtension(
   return {
+    pi,
     bridgeSessionStart,
@@ -2361,7 +2366,10 @@ function backgroundContext(
 test("D-CF1-01: the command invocation handler registered after the skill aliases passes a bridged command through", async (t) => {
   // arrange
   await createHermeticScope(t, "command-invocation");
-  const { commandInvocation, ctx, verifyBoundary } = await loadExtension(0, 0);
+  const { pi, commandInvocation, ctx, verifyBoundary } = await loadExtension(0, 0);
+  when(() => pi.getCommands())
+    .thenReturn([])
+    .times(1);
```

The changes touch only `LoadedExtension`, the `loadExtension` return object, `CommandInvocationListener`, and the D-CF1-01 case. The `{ action: "continue" }` assertion is kept. `git diff --stat 0ab69e5..HEAD -- extensions/pi-claude-marketplace/index.ts` prints nothing.

## Non-owned test edits

Only `test/index.test.ts`, as the plan lists it, with the diff above. Every other test file is a pair this plan owns.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/command-invocation.ts`: the invocation (new)
- `extensions/pi-claude-marketplace/edge/command-invocation.ts`: the input handler, which replaces the pass-through seed
- `extensions/pi-claude-marketplace/bridges/commands/command-record.ts`: `readCommandRecord`
- `test/orchestrators/command-invocation.test.ts` (new), `test/edge/command-invocation.test.ts`, `test/bridges/commands/command-record.test.ts`: paired tests, 100% direct coverage each
- `test/index.test.ts`: the four edits above
- `features/slash-command/invocation.feature` (new), `features/step_definitions/slash-command/invocation.steps.ts` (new)

## Decisions Made

- **Abort origin.** `commandId` is the typed name without its slash (for example `demo:greet`), as the plan assumed. This needed no closed-set edit.
- **Order of refusals.** The trust check runs before the read, so an untrusted project's file is never read. The unit case passes no file, so a read would show up as a different message. Bash-missing is checked after the substitution, so an oversized invocation refuses with the size message first.
- **Body as Pi gives it.** The parsed body is used as `parseFrontmatter` returns it. Pi trims it already when the file has frontmatter, and every staged command has frontmatter because the record is added last.
- **`D-CF3-07` cited in the trust comment.** The skills side cites T-02-17. The command rule is D-CF3-07's "only when Pi trusts the project". The D-CF3-07 ledger half is not implemented here (plans 03-06 and 03-07).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in the plan's literal] The path scenario's data directory**
- **Found during:** red run before Task 1, then Task 2
- **Issue:** The plan's expected text had `data {project dir}/.pi/pi-claude-marketplace/data/demo`, copied from `features/hook/tool-use.feature`. Install gives a command `locations.pluginDataDir(mp, plugin)`, which is `data/fixtures/demo`. That is the same value the skills record stores (see `features/plugin/install-dependencies.feature:1296`, `data/tools/aaa`).
- **Fix:** The scenario expects `{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo`. The pin is proved by the negative edit above.
- **Committed in:** `a83dfd9`

**2. [Rule 3 - Blocking] The slash-line regex**
- **Found during:** Task 1 lint
- **Issue:** `/^\/(\S+)(?:\s+([\s\S]*))?$/` fails `sonarjs/super-linear-regex`.
- **Fix:** `splitSlashLine` uses `startsWith("/")` and one `text.search(/\s/)`. The rest of the line is trimmed into `args`, as before.
- **Committed in:** `b75a8dd`

**3. [Rule 3 - Blocking] fallow `private-type-leak`**
- **Found during:** Task 1 `npm run fallow`
- **Issue:** A module-private `CommandInvoker` alias appeared in the exported `registerCommandInvocation` signature.
- **Fix:** The invoker type is written inline in the parameter.
- **Committed in:** `b75a8dd`

**4. [Acceptance-criterion conflict] `ThinkingLevel` grep on the edge file**
- **Found during:** Task 1 acceptance gate
- **Issue:** `grep -cE 'ThinkingLevel|InputSource' edge/command-invocation.ts` prints `1`. The match is the method call `pi.getThinkingLevel()`, which the plan's own action requires. No `ThinkingLevel` or `InputSource` type is imported, so neither `fallow-ignore-next-line unused-type` marker in `platform/pi-api.ts` goes stale. `npm run fallow` passes. The orchestrator prints `0`.
- **Fix:** None needed. The criterion's intent (no import of the two types) holds.

**5. [Proof mechanics] The path-variable negative edit needed a second edit**
- **Found during:** Task 2
- **Issue:** The edit the plan named (skip the install-time substitution) leaves the scenario green, because the invocation fills the same `${CLAUDE_*}` names in the body with the same values.
- **Fix:** I recorded both runs (see Negative-edit proofs). Nothing was committed.

---

**Total deviations:** 5 (1 plan-literal bug, 2 blocking, 1 criterion conflict, 1 proof mechanics). **Impact:** none on scope.

## Verification

- `node --test test/index.test.ts test/edge/command-invocation.test.ts test/orchestrators/command-invocation.test.ts test/bridges/commands/command-record.test.ts`: 97 pass.
- `npm run test:coverage:direct --` for `bridges/commands/command-record.ts`, `edge/command-invocation.ts`, and `orchestrators/command-invocation.ts`: no shortfall.
- `npx cucumber-js features/slash-command`: 25 scenarios (284 steps) pass.
- `npx cucumber-js features/skill`: 81 scenarios pass with the live handler, `collisions.feature` (`/demo:clash`) included.
- `npm run check:static` (typecheck, lint, fallow, format, pairing, check:features): pass after every task. `npx fallow dupes --fail-on-issues --format human --quiet`: exit 0. `npm run test:unpaired`: pass.
- `npm run check` on the whole tree was not run here, as the parallel-wave instructions ask. The post-merge wave gate runs it.

## Issues Encountered

- Inside the worktree, the commit hook's npm checks reported "(no files to check)" for the second pre-commit pass. So I ran `check:static`, the owner tests, and coverage by hand before each commit.
- The first commit attempt failed gitlint T1 (a 73-character title). No commit was made. I retried with a shorter title.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

The mitigations are in place:
- T-03-06: the extension-input row returns before anything is read (unit case "T-03-06: passes extension input through without reading pi or the context").
- T-03-07: the substitution runs before the injection (`substituteArguments(` at line 203, before `expandContextInjections(` at line 212), pinned by the escaped-argument scenario and the T-01-22 unit case.
- T-03-08: the failure scenario shows the usage error and no model call.
- T-03-09: the user-template scenario and its negative edit.
- T-03-10: the T-03-10 size-limit unit case.

## Dubious Choices

1. **`"kind" in loaded` narrows the read result.** The read-and-parse step resolves to either a parsed file or a refusal outcome. The `in` check tells them apart. It is safe because a parsed file never has a `kind` member: `parseFrontmatter` returns `{ frontmatter, body }`. A reviewer might prefer an explicit discriminated union.
2. **Bash-missing is checked even for a body with no `!` command.** A command whose frontmatter says `shell: bash` refuses on a machine without Bash, even when it runs nothing. The skills side does the same. Claude Code may check only when a pattern exists. Not verified upstream.
3. **The `placeholder` column of the Outline is not used by any step.** It only labels the row, as in the skills Outline.
4. **A parse failure of the staged file has no unit case of its own.** It goes through the same `.catch` as a read failure, so coverage stays complete, and the YAML library's message would be a long, version-dependent literal.
5. **The data-directory literal in the hooks feature differs from the command one.** `features/hook/tool-use.feature` shows `data/demo` for hooks. Commands and skills record `data/<marketplace>/<plugin>`. One of the two may be wrong. Not this plan's file.

## Parent lines

- **Pi gap report (E8, D-CF1-01 residual):** a `transform` result whose text starts with `/<template>` is expanded again by Pi's `expandPromptTemplate`. Claude Code sends a substituted body literally. Pi has no flag to skip the second expansion.
- **Hooks phase (data directory):** `features/hook/tool-use.feature:26` expects `CLAUDE_PLUGIN_DATA={project dir}/.pi/pi-claude-marketplace/data/demo`. Install's `pluginDataDir` for commands and skills is `data/fixtures/demo`. Check whether the hooks bridge uses a different data root.
- **`docs/json-output.md`:** a refused slash command is a `usage-error` entry whose origin is `{ kind: "command", commandId: "<plugin>:<command>", invocationId }`.
- **CHANGELOG.md (suggested line):** "Bridged slash commands now fill their arguments as Claude Code does: arguments are appended when the body has no placeholder, `$0` is the first argument, named `arguments:` work, and so do `${CLAUDE_SESSION_ID}` and `${CLAUDE_EFFORT}`. Their `` !`cmd` `` context commands run before the model sees them."
- **PROJECT.md Key Decisions:** none.

## Next Phase Readiness

- Plan 03-06 records the project-command ledger, and plan 03-07 adds the D-CF3-07 ledger check to `invokeStagedCommand`, after the trust refusal and before the read.

## Self-Check: PASSED

- FOUND: `orchestrators/command-invocation.ts`, `test/orchestrators/command-invocation.test.ts`, `features/slash-command/invocation.feature`, `features/step_definitions/slash-command/invocation.steps.ts`
- FOUND commits on this branch: `b75a8dd`, `a83dfd9`, `828987f`. `git rev-list --count 0ab69e5..828987f` = 3
- Acceptance greps: `export async function invokeStagedCommand` 1; `ThinkingLevel|InputSource` orchestrator 0, edge 1 (`pi.getThinkingLevel()`, Deviation 4); `ui.notify` in edge 0; `index.ts` diff empty; `export function readCommandRecord` 1; non-comment `CLAUDE_SKILL_DIR` 0; Outline title 1 with 6 rows; user-template step 1; `expandContextInjections(` 1 (line 212, after `substituteArguments(` at 203); `Run /reload to load the installed commands again.` 1; `fallow dupes` exit 0

---
*Phase: 03-slash-commands*
*Completed: 2026-11-01*
