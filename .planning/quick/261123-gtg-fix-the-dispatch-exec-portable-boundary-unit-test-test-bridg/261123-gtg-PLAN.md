---
quick_id: 261123-gtg
description: fix the dispatch-exec portable boundary unit test so it no longer depends on the size of process.env (test-only)
date: 2026-11-23
mode: quick-batch
phase: quick-261123-gtg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - test/bridges/hooks/dispatch-exec.test.ts
autonomous: true

must_haves:
  truths:
    - "The case 'executes a blocking hook through the portable process boundary' passes under the runner's full environment (10,718 characters as JSON in this container), under `env -i HOME PATH LANG TMPDIR`, and with one extra 50,000-character variable. At 85c323b it fails under the full and the padded environment with a SyntaxError on `<persisted-output>`"
    - "The case still proves that the hook child inherits the whole parent environment: the child writes `JSON.stringify(process.env)` to `environment.json` under the case root, and the case compares the parsed file whole, with `assert.deepStrictEqual`, against `expectedEnvironment`, which it builds from `process.env` and literals (the six CLAUDE_* variables that `prepareHookEnv` adds, and no `CLAUDE_CODE_REMOTE` or `CLAUDE_ENV_FILE`). A child that deletes HOME before the capture fails that assertion"
    - "The returned `additionalContext` still goes through `parseHookStdout` and the context cap, and the case still compares whole what the child saw (argv, cwd, execPath, the literal argument, stdin). It is 692 characters in this container, far below the 10,000-character cap, so its size no longer depends on the environment"
    - "Direct coverage of the dispatch-exec pair passes at 100% (branches 55/55, functions 15/15, lines 512/512 at 85c323b) under the full environment with no `env -i`, and also with the extra 50,000-character variable"
    - "Only `test/bridges/hooks/dispatch-exec.test.ts` changes, in one commit whose hook (`npm run check:commit`) passed: no product file changes, the case title stays, `fallow audit` reports a pass, and the deliberate break is never committed"
  artifacts:
    - path: test/bridges/hooks/dispatch-exec.test.ts
      provides: "the portable boundary case, with the hook child's environment compared whole through a capture file under the case root"
      contains: "assert.deepStrictEqual(childEnvironment, expectedEnvironment);"
  key_links:
    - from: test/bridges/hooks/dispatch-exec.test.ts
      to: extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts
      via: "prepareHookEnv builds the child env from process.env plus CLAUDE_PROJECT_DIR, CLAUDE_PLUGIN_ROOT, CLAUDE_PLUGIN_DATA, and claudeSessionEnvFor; the child captures that env, and the case compares the capture with expectedEnvironment"
      pattern: "assert\\.deepStrictEqual\\(childEnvironment, expectedEnvironment\\)"
    - from: test/bridges/hooks/dispatch-exec.test.ts
      to: extensions/pi-claude-marketplace/bridges/hooks/context-cap.ts
      via: "withCappedContext calls capHookContext, which returns a context of at most CONTEXT_LIMIT (10_000) characters unchanged; the observation without the environment stays below it, so the case can parse additionalContext as JSON"
      pattern: "argv: \\[literalArgument, stdoutCapturePath, stderrCapturePath, environmentCapturePath\\]"
    - from: test/bridges/hooks/dispatch-exec.test.ts
      to: extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
      via: "dispatchHookExec spawns the real child through the spawn default (deps.spawnImpl ?? spawn) and passes its stdout to parseHookStdout"
      pattern: "dispatchHookExec\\(entry, event, extensionContext, undefined, runtime\\)"
---

<objective>
Make the unit case "executes a blocking hook through the portable process boundary" (`test/bridges/hooks/dispatch-exec.test.ts`, lines 39-346 at 85c323b) pass whatever the size of the runner's environment, and keep its proof that the hook child inherits the whole environment. The change is test-only.

Why the case fails now: its child puts its whole `process.env` in the observation that it returns as `hookSpecificOutput.additionalContext`. The bridge caps that string at 10,000 characters (`CONTEXT_LIMIT` in `bridges/hooks/context-cap.ts`, D-PG5-14) and returns a longer string as a `<persisted-output>` wrapper. In this container the environment alone is 10,718 characters as JSON, so `JSON.parse(hookOutcome.additionalContext)` throws, and STATE.md tells every direct-coverage run to strip the environment with `env -i`. The product is right. The case is wrong.

After this plan, the child writes its environment to a fourth capture file, `environment.json`, under the case root, and the case compares that file whole with `expectedEnvironment`. The returned context keeps argv, cwd, execPath, the literal argument, and stdin (692 characters measured), so the cap never wraps it.

Purpose: the unit suite and 100% direct coverage pass on any machine, without the `env -i` workaround.
Output: one commit to `test/bridges/hooks/dispatch-exec.test.ts`, and the SUMMARY with the red, green, break, coverage, and audit evidence.
</objective>

<execution_context>
@/home/user/pi-claude-marketplace/.claude/gsd-core/workflows/execute-plan.md
@/home/user/pi-claude-marketplace/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/quick/261123-gtg-fix-the-dispatch-exec-portable-boundary-unit-test-test-bridg/261123-gtg-RESEARCH.md
@extensions/pi-claude-marketplace/bridges/hooks/context-cap.ts

Project rules that bind this plan: AGENTS.md "Git", "Build verification", and "Behavioral tests"; `.agents/skills/committing/SKILL.md`; `.agents/skills/local-verification/SKILL.md` with `rules/commands.md` and `rules/gates.md`; `.agents/skills/typescript-unit-tests/SKILL.md` with `rules/cases.md` and `rules/boundaries.md`; `.agents/skills/typescript-style/rules/comments.md`. No cucumber scenario: no user can see this change (AGENTS.md "Behavioral tests"). No CHANGELOG line and no version bump in this item.

Environment:
- Work from the executor's checkout root. Every path in this plan is relative to it.
- The npm prefix: run every `npm run` command, and the `git commit` whose hook runs npm, with `npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144` in front (the sandbox runs as root, which breaks the permission tests; STATE.md). The verify commands below already carry it. Plain `node --test` runs do not need it.
- In a fresh worktree without `node_modules/.package-lock.json`, run `npm ci --ignore-scripts --no-audit --no-fund` first. Never symlink the main checkout's `node_modules`.
- Write scratch files (run logs, the commit message) only under your session's scratchpad directory, never in the repository.

Executor rules:
- Read the case before you edit it. Only the one case changes; the other 117 cases of the file stay byte for byte.
- Do not edit `.planning/STATE.md`, `.planning/BACKLOG.md`, `.planning/ROADMAP.md`, or `CHANGELOG.md`, and do not commit the SUMMARY: the orchestrator owns them (see "For the orchestrator").
- Never `--no-verify`, never `--amend`, never `git add -A`, never a bare `git stash`.

Cross-item note: no sibling item of this batch touches this test file or the dispatch-exec pair (261123-gti works in `async-rewake/registry.ts`, `event-router.ts`, `event-adapters.ts`, and `session-start-context.ts`; 261123-gth in `features/`). This item needs no sibling first.
</context>

<interfaces>
Code at 85c323b, so the executor need not search.

The case, `test/bridges/hooks/dispatch-exec.test.ts`:
- Lines 42-45: `createHermeticEnvironment(t, "dispatch-exec-portable-")` gives `caseRoot` (an `mkdtemp` root that `t.after` removes) and sets `HOME` and `PI_CODING_AGENT_DIR` inside it.
- Lines 48-49: `stdoutCapturePath` and `stderrCapturePath`, each `path.join(caseRoot, ...)`.
- Lines 134-157: `childProgram`, a `String.raw` template run with `node -e`. Line 135 requires `readFileSync`, `writeFileSync`, `writeSync`. Line 136 destructures three argv values from `process.argv.slice(1)`. Lines 138-145: the `observation` literal with six properties in this order: argv, cwd, the environment property (its value is the child's `process.env`, line 141), execPath, literalArgument, stdin. Lines 146-151 build `stdout` from it. Lines 153-156: the stdout capture write, the stderr capture write, then `writeSync(2, stderr)` and `writeSync(1, stdout)`.
- Lines 158-164: `commandArguments`, which is `"-e"`, `childProgram`, `literalArgument`, `stdoutCapturePath`, `stderrCapturePath`.
- Lines 242-260: `expectedEnvironment`, which is every defined `process.env` entry, then `Object.assign` of `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDECODE: "1"`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_SESSION_ID`. The case deletes `CLAUDE_CODE_REMOTE` and `CLAUDE_ENV_FILE` from `process.env` at lines 75-76.
- Lines 261-268: `expectedObservation`, with the same six properties as the child's observation (its environment property holds `expectedEnvironment`, line 264). Lines 269-280 derive `expectedAdditionalContext`, `expectedStdout`, and `expectedHookOutcome` from it.
- Lines 283-289 (act): `dispatchHookExec(entry, event, extensionContext, undefined, runtime)`, then the stdout and stderr capture reads (284-285), then `childObservation`, which is `JSON.parse(hookOutcome.additionalContext) as unknown` (line 288, where the case fails today).
- Line 299: `assert.deepStrictEqual(childObservation, expectedObservation)`. Line 338: the `spawnargs` expectation `[process.execPath, ...commandArguments]`.

The product (read, do not edit):
- `bridges/hooks/context-cap.ts`: line 16 sets `CONTEXT_LIMIT = 10_000`. `capHookContext` returns the text unchanged when `text.length <= CONTEXT_LIMIT`, and otherwise saves it and returns the `<persisted-output>` wrapper.
- `bridges/hooks/dispatch-exec.ts`: `withCappedContext` (lines 280-296) caps `additionalContext`; line 390 takes `deps.spawnImpl ?? spawn`, so this case is the one that runs the real `spawn`; line 479 calls `parseHookStdout`.
- `bridges/hooks/hook-env.ts`: `prepareHookEnv` (line 87) builds the child env as `{ ...process.env, CLAUDE_PROJECT_DIR, CLAUDE_PLUGIN_ROOT, CLAUDE_PLUGIN_DATA, ...options, ...extra, ...claudeSessionEnvFor(sessionId) }`, so the key order follows `process.env` and is not a contract.
</interfaces>

## Planner measurements (at 85c323b; scratch worktrees, removed afterward; the executor reproduces them)

1. Red. The named case under this container's full environment fails: `SyntaxError [Error]: Unexpected token '<', "<persisted"... is not valid JSON` at line 288. It passes under `env -i HOME="$HOME" PATH="$PATH" LANG=C.UTF-8 TMPDIR=/tmp`. With `PORTABLE_ENV_PADDING` set to 50,000 `x` characters, it fails like the full-environment run.
2. Pair coverage at 85c323b. With the npm prefix and `CI=1`, `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` exits 1 under the full environment (`Focused test failed`, 117 of 118 pass) and under the padded environment. Under `env -i` it prints `Direct coverage passed: extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts (branches 55/55, functions 15/15, lines 512/512)`.
3. Green, with the Design applied. The named case passes under the full environment, under `env -i`, and padded. The returned `additionalContext` is 692 characters. Pair coverage prints the same 55/55, 15/15, 512/512 line under the full and the padded environment, 118 of 118 pass. All of `test/bridges/hooks/**/*.test.ts` passes under the full environment (2107 of 2107, against 2106 at 85c323b). `tsc --noEmit -p tsconfig.json`, `eslint --max-warnings 0 --no-cache` and `prettier --check` on the test file, and `npm run test:unpaired` pass. `fallow audit --base HEAD` on the change: verdict `pass`, no issues; the assertion count goes up by one, so no `weakened-tests` finding.
4. Break. With `delete process.env.HOME;` in the child just before the environment capture, the case fails under both environments with `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`, a diff line `-   HOME: '<case root>/home',`, and the failing frame at the line of `assert.deepStrictEqual(childEnvironment, expectedEnvironment)`. Every earlier assertion of the case passes.
5. That failing assertion prints the whole runner environment with its values, including session credentials and the account's e-mail address (T-261123-gtg-02).

## Design (planner's discretion; the SUMMARY reports each item as a choice)

1. Out of band, only what has no size bound. The environment moves to a capture file. Argv, cwd, execPath, the literal argument, and stdin stay in `additionalContext`, so the case still proves that the child's stdout reached `parseHookStdout` and the cap unchanged. The research rejected the alternatives: a digest (equality only, no diff on failure), the whole observation in a file (takes argv, cwd, and stdin off the product path), a smaller `process.env` (drops the whole-environment proof), and reading the `<persisted-output>` file (the branch taken would still depend on the environment size).
2. One comment, because the choice is not obvious and a later cleanup could put the environment back in band. Put these two lines directly above the `environmentCapturePath` declaration, with the case's two-space indent:
   `// The child writes its environment here, not to its hook output, because`
   `// the bridge caps a hook's context at 10,000 characters (D-PG5-14).`
   The text is written in simple-english Plain style and passes the humanizer check (`typescript-style/rules/comments.md` requires both skills for a new comment). Change it only if their self-checks flag it. Add no other comment.
3. The capture write sits right after the stderr capture write and before the two `writeSync` calls, so the three capture writes stay together. The case reads the files only after `dispatchHookExec` resolves, and that happens after the child closes.
4. `expectedEnvironment` stays as it is now. It becomes the expected value of the capture, and it is still built from `process.env` and literals, never from the product (`rules/cases.md`). `deepStrictEqual` on the parsed object ignores key order, which is not a contract (interfaces block).
5. In the child program, the four-name destructuring is split over two lines (`=` at the end of the first), so each line stays under the file's 100-character width. Prettier does not format the text inside a template.

## Source coverage audit

| Source | Item | Task | Status |
|--------|------|------|--------|
| GOAL | The case no longer depends on the size of `process.env` | 1 | COVERED |
| GOAL | Keep the proof that the child inherits the whole environment | 1, 2 | COVERED |
| GOAL | Test-only change | 1 (`files_modified`) | COVERED |
| RESEARCH section 2 | Capture file, environment out of the observation, whole comparison, argv and `commandArguments` updated | 1 | COVERED |
| RESEARCH section 3 | No other test has the same fragility, so nothing else changes | none needed | COVERED |
| RESEARCH section 4 | Pair coverage stays at 100% without `env -i` | 1 | COVERED |
| RESEARCH acceptance | A deliberate break fails the case, runs once, is reverted, and is never committed | 2 | COVERED |
| Orchestrator constraint | Runs under the full environment and under `env -i` | 1, 2 | COVERED |
| Orchestrator constraint | npm prefix; the hook runs `check:commit`; no `--no-verify`; no SKIP set for the commit | 1 | COVERED |
| Orchestrator constraint | Conventional Commits title, 5-72 characters, no quick id | 1 | COVERED |
| Orchestrator constraint | STATE.md note left to the orchestrator, not in `files_modified` | For the orchestrator | COVERED |
| REQ / CONTEXT | A quick-batch item has no requirement IDs and no CONTEXT.md | none | n/a |

<tasks>

<task type="tracer">
  <name>Task 1: Compare the hook child's environment through a capture file</name>
  <precondition>The non-DAC shell wrapper /tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/nondac-sh exists and is executable (`test -x` on that path succeeds).</precondition>
  <files>test/bridges/hooks/dispatch-exec.test.ts</files>
  <read_first>
    - test/bridges/hooks/dispatch-exec.test.ts lines 1-346 (the case and the imports; nothing after line 346 changes)
    - extensions/pi-claude-marketplace/bridges/hooks/context-cap.ts (whole file)
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts lines 273-296 and 383-391
    - extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts lines 87-115
    - test/platform/hermetic-environment.ts (the case root and its cleanup)
    - .agents/skills/typescript-unit-tests/rules/cases.md, .agents/skills/typescript-style/rules/comments.md, .agents/skills/committing/SKILL.md
  </read_first>
  <action>
Implements the research's primary recommendation, with Design items 1-5. The whole slice is the one case: the edit, the real process boundary end to end, and the commit.

1. Start. Write BASE = the output of `git rev-parse HEAD` in the SUMMARY. If `node_modules/.package-lock.json` is missing, install as the context block says.

2. Red. Before you edit, run the third verify command (the padded run) once, with its output saved to a file in your scratchpad. It must exit 1 and report `SyntaxError` with `"<persisted"... is not valid JSON` at the `JSON.parse(hookOutcome.additionalContext)` line (line 288). Write the exit status and that line in the SUMMARY. If it passes, stop and report: the checkout is not the expected tree.

3. Edit the case. Change only these places:
   a. Arrange, after the `stderrCapturePath` declaration (line 49): put the Design item 2 comment, and under it declare `const environmentCapturePath = path.join(caseRoot, "environment.json");`.
   b. Child program (lines 134-157): destructure a fourth argv value, `environmentCapturePath`, after `stderrCapturePath` (Design item 5). Remove the environment property from the `observation` literal, and keep its other five properties in their order: argv, cwd, execPath, literalArgument, stdin. Directly after the stderr capture write, add the statement `writeFileSync(environmentCapturePath, JSON.stringify(process.env));`, before the two `writeSync` calls (Design item 3).
   c. `commandArguments` (lines 158-164): append `environmentCapturePath` after `stderrCapturePath`. The `spawnargs` expectation spreads `commandArguments`, so leave it as it is.
   d. `expectedObservation` (lines 261-268): remove its environment property, and list `literalArgument, stdoutCapturePath, stderrCapturePath, environmentCapturePath` in its `argv`. Keep `expectedEnvironment` (lines 242-260) exactly as it is (Design item 4).
   e. Act, after the stderr capture read (line 285): add `const childEnvironment = JSON.parse(await readFile(environmentCapturePath, "utf8")) as unknown;`, in the same form that `childObservation` uses.
   f. Assert, directly after `assert.deepStrictEqual(childObservation, expectedObservation);` (line 299): add `assert.deepStrictEqual(childEnvironment, expectedEnvironment);`.
   Add no import: `readFile` and `path` are already imported, and the child already requires `writeFileSync`. Keep the title, the `// arrange`, `// act`, `// assert` markers, and every other assertion.

4. Green. Run verify commands 1-3 (full environment, `env -i`, padded). Each must exit 0. Then run verify commands 4-9 (the pair coverage under the full and the padded environment, and the four structure gates). Each must succeed, and both coverage runs must print the 55/55, 15/15, 512/512 line.

5. Commit, as the committing skill says.
   - First run `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files test/bridges/hooks/dispatch-exec.test.ts`. That SKIP covers this fixer run only. Restage any fixer edit, and repeat until the run is clean.
   - Stage only `test/bridges/hooks/dispatch-exec.test.ts`. Write the message to a file in your scratchpad.
   - Run `git commit -F <that file>` in the foreground with the npm prefix in front and the longest tool timeout. Set no SKIP of your own on this command: the hook's `npm-check` must run `npm run check:commit`. That runs the static checks, the unpaired tests, and the staged pair's direct coverage under the full environment, without `env -i`. If the hook can run longer than the foreground limit, run the commit once in the background and wait for the completion notification.
   - A failed hook means that no commit happened: fix, restage, and commit again.
   - If the hook's `npm run check:commit` line reports `(no files to check)`, the checks did not run. Then run `npm run check:static`, `npm run test:unpaired`, and verify command 4 by hand, with the npm prefix, and record the three results.
   - Title: `test(hooks): compare the hook child's environment through a file`.
   - Body: Plain English, lines of at most 80 characters, and no quick id, batch, plan, or task. Say three things. The case put the child's whole environment in its additionalContext. An environment over 10,000 characters as JSON (about 10.7 KB in a cloud container) makes the bridge return `<persisted-output>` (D-PG5-14), so the case failed. The child now writes its environment to a capture file that the case compares whole, and the returned context keeps argv, cwd, execPath, the literal argument, and stdin.
   - End the message with the attribution lines that your session's instructions give.

6. Right after the commit, run verify commands 10 and 11. Both find the commit by its exact title, not by a position relative to HEAD, because another session can commit to a shared checkout. Command 10 checks the commit's title and its file list. Command 11 runs the fallow audit with the commit's parent as the base. Write the commit's SHA in the SUMMARY.
  </action>
  <verify>
    <automated>node --import "$PWD/scripts/isolated-pi-home.mjs" --test --test-name-pattern 'executes a blocking hook through the portable process boundary' test/bridges/hooks/dispatch-exec.test.ts</automated>
    <automated>env -i HOME="$HOME" PATH="$PATH" LANG=C.UTF-8 TMPDIR=/tmp node --import "$PWD/scripts/isolated-pi-home.mjs" --test --test-name-pattern 'executes a blocking hook through the portable process boundary' test/bridges/hooks/dispatch-exec.test.ts</automated>
    <automated>PORTABLE_ENV_PADDING="$(node -e 'process.stdout.write("x".repeat(50000))')" node --import "$PWD/scripts/isolated-pi-home.mjs" --test --test-name-pattern 'executes a blocking hook through the portable process boundary' test/bridges/hooks/dispatch-exec.test.ts</automated>
    <automated>npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 CI=1 npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts 2>&1 | grep -c -F 'Direct coverage passed: extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts (branches 55/55, functions 15/15, lines 512/512)' # [HEAD=0 EXPECT==1 @85c323b]</automated>
    <automated>PORTABLE_ENV_PADDING="$(node -e 'process.stdout.write("x".repeat(50000))')" npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 CI=1 npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts 2>&1 | grep -c -F 'Direct coverage passed: extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts (branches 55/55, functions 15/15, lines 512/512)' # [HEAD=0 EXPECT==1 @85c323b]</automated>
    <automated>test "$(awk '/^test\("executes a blocking hook through the portable process boundary"/,/^}\);$/' test/bridges/hooks/dispatch-exec.test.ts | grep -v -E '^[[:space:]]*//' | grep -c -F 'environment: process.env')" -eq 0 # [HEAD=1 EXPECT==0 @85c323b]</automated>
    <automated>test "$(awk '/^test\("executes a blocking hook through the portable process boundary"/,/^}\);$/' test/bridges/hooks/dispatch-exec.test.ts | grep -v -E '^[[:space:]]*//' | grep -c -F 'environment: expectedEnvironment')" -eq 0 # [HEAD=1 EXPECT==0 @85c323b]</automated>
    <automated>test "$(awk '/^test\("executes a blocking hook through the portable process boundary"/,/^}\);$/' test/bridges/hooks/dispatch-exec.test.ts | grep -v -E '^[[:space:]]*//' | grep -c -F 'writeFileSync(environmentCapturePath, JSON.stringify(process.env));')" -eq 1 # [HEAD=0 EXPECT==1 @85c323b]</automated>
    <automated>test "$(awk '/^test\("executes a blocking hook through the portable process boundary"/,/^}\);$/' test/bridges/hooks/dispatch-exec.test.ts | grep -v -E '^[[:space:]]*//' | grep -c -F 'assert.deepStrictEqual(childEnvironment, expectedEnvironment);')" -eq 1 # [HEAD=0 EXPECT==1 @85c323b]</automated>
    <automated>C="$(git log -1 --format=%H -F --grep="test(hooks): compare the hook child's environment through a file")" && test -n "$C" && test "$(git log -1 --format=%s "$C")" = "test(hooks): compare the hook child's environment through a file" && test "$(git diff --name-only "$C^" "$C")" = "test/bridges/hooks/dispatch-exec.test.ts"</automated>
    <automated>C="$(git log -1 --format=%H -F --grep="test(hooks): compare the hook child's environment through a file")" && test -n "$C" && AUDIT_JSON="$(npx --no fallow audit --base "$C^" --format json)" && node -e 'const audit = JSON.parse(process.argv[1]); console.log(audit.verdict); process.exit(audit.verdict === "pass" && (audit.warnings ?? []).length === 0 ? 0 : 1);' "$AUDIT_JSON"</automated>
  </verify>
  <acceptance_criteria>
    - The padded run fails before the edit (exit 1, SyntaxError on `<persisted`), and the three named-case runs pass after it.
    - Both pair coverage runs print the 55/55, 15/15, 512/512 line without `env -i` [HEAD=0 EXPECT==1 @85c323b].
    - In the case's region, no line puts the environment in the child's observation [HEAD=1 EXPECT==0 @85c323b].
    - In the case's region, no line puts the environment in the expected observation [HEAD=1 EXPECT==0 @85c323b].
    - The case's region holds the environment capture write once [HEAD=0 EXPECT==1 @85c323b].
    - The case's region holds the whole-environment assertion once [HEAD=0 EXPECT==1 @85c323b].
    - The commit that carries the step 5 title has BASE as its parent, changes only the test file, and passed its hook, and the audit verdict against its parent is `pass` with no warnings.
  </acceptance_criteria>
  <done>The case passes under the full environment, under `env -i`, and with an extra 50,000-character variable, where it failed under the full and padded environments at BASE. It still compares the child's whole environment, now from `environment.json`. The pair's direct coverage is 100% without `env -i`. One commit, `test(hooks): compare the hook child's environment through a file`, changes only `test/bridges/hooks/dispatch-exec.test.ts`, its `check:commit` hook passed, and `fallow audit` reports a pass. The SUMMARY has BASE, the red run, the green runs, both coverage lines, the hook result, and the audit verdict.</done>
</task>

<task type="auto">
  <name>Task 2: Prove that the environment comparison fails when the child drops a variable</name>
  <files>test/bridges/hooks/dispatch-exec.test.ts</files>
  <read_first>
    - test/bridges/hooks/dispatch-exec.test.ts, the child program of the case as Task 1 committed it
    - .agents/skills/typescript-unit-tests/SKILL.md (a verified case fails when its behavior breaks)
  </read_first>
  <action>
A deliberate break that runs once and is never committed (research acceptance; the unit-test skill asks that a verified case fail when its behavior breaks). Do it on top of the Task 1 commit, with nothing staged. This task commits nothing.

1. With the Edit tool, insert `delete process.env.HOME;` as its own line in the child program, directly above the child's environment capture write, with the same four-space indent. `git diff --stat` must show one insertion in this one file.

2. Run the first verify command of Task 1 (the named case under the full environment) once, with its output saved to a file in your scratchpad. Expect all of these:
   - exit status 1 and `ℹ fail 1`;
   - `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`;
   - a diff line that starts with `-   HOME:`;
   - a stack frame whose line number is the line of `assert.deepStrictEqual(childEnvironment, expectedEnvironment);` in the broken file.
   Every earlier assertion of the case passes, so this assertion is the one that catches a variable that the child did not get.

3. In the SUMMARY, write only these items: the exit status, the `ℹ tests`, `ℹ pass`, and `ℹ fail` lines, the AssertionError line, the HOME diff line, and the frame's line number. Do not copy the report or its actual and expected objects into the SUMMARY or into any message. They list every variable of your session's environment with its value (T-261123-gtg-02). Other agents can share your scratchpad, so delete the saved report as soon as you have copied those lines.

4. Revert with `git restore -- test/bridges/hooks/dispatch-exec.test.ts`, then run this task's verify commands.

If the run in step 2 passes, the assertion does not discriminate. Then stop, revert, and report it as a deviation. Commit nothing.
  </action>
  <verify>
    <automated>git diff --exit-code HEAD -- test/bridges/hooks/dispatch-exec.test.ts</automated>
    <automated>git diff --cached --quiet</automated>
    <automated>node --import "$PWD/scripts/isolated-pi-home.mjs" --test --test-name-pattern 'executes a blocking hook through the portable process boundary' test/bridges/hooks/dispatch-exec.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - The broken run exited 1 at the whole-environment assertion with a `-   HOME:` diff line, and the SUMMARY records only the lines that step 3 names.
    - After the revert, the working tree and the index match the Task 1 commit, and the case passes again.
    - This task made no commit: `git log -1 --format=%H -- test/bridges/hooks/dispatch-exec.test.ts` still prints the Task 1 commit's SHA.
  </acceptance_criteria>
  <done>A child that drops HOME fails the case at `assert.deepStrictEqual(childEnvironment, expectedEnvironment)`. The break existed only in the working tree for one run. The file matches the Task 1 commit again, and the case passes. The SUMMARY records the failing run without any environment values.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| test process -> hook child | The case spawns a real `node -e` child that inherits the runner's whole environment, session credentials included |
| hook child -> capture files | The child writes its stdout, stderr, and environment captures under the case's temp root |
| run report -> SUMMARY.md, commit message | Text that the executor copies from a test report goes into a tracked file that the orchestrator commits |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261123-gtg-01 | Information disclosure | `environment.json` capture file | low | mitigate | The child writes it under the case root, which `createHermeticEnvironment` makes with `mkdtemp` (mode 0700) and removes in `t.after`. At BASE the `stdout.txt` capture under the same root held the same environment inside `additionalContext`, so the exposure does not grow |
| T-261123-gtg-02 | Information disclosure | report of a failing whole-environment assertion | medium | mitigate | The Task 2 break prints every environment variable with its value. The executor keeps that report in its scratchpad, copies only the lines that Task 2 step 3 names, then deletes the report, and the plan's verification checks the SUMMARY for credential-style key names. A future CI failure prints the CI environment, as the in-band observation did at BASE; GitHub masks registered secrets (accepted for that part) |
| T-261123-gtg-03 | Tampering | the deliberate break | low | mitigate | The break runs only after the Task 1 commit and is reverted with `git restore`. `git diff --exit-code HEAD` and `git diff --cached --quiet` prove that the tree and the index match the commit. A commit with the break could not pass the hook, because the hook's direct coverage runs the case |
| T-261123-gtg-SC | Tampering | npm/pip/cargo installs | low | accept | This plan adds no package. In a fresh worktree, `npm ci --ignore-scripts` installs only the versions that the committed lockfile pins |
</threat_model>

<verification>
- Each task's verify commands pass, and the Task 1 commit hook (`npm run check:commit`) passed.
- The SUMMARY records the red run (Task 1 step 2), the three green runs, both coverage lines, the hook result, the audit verdict, and the Task 2 break run, as Task 2 step 3 limits it.
- After you write the SUMMARY: `test "$(grep -c -E '_TOKEN|_EMAIL' .planning/quick/261123-gtg-fix-the-dispatch-exec-portable-boundary-unit-test-test-bridg/261123-gtg-SUMMARY.md)" -eq 0` [HEAD=error:2 EXPECT==0] and `test "$(grep -c -F '## Threat Flags' .planning/quick/261123-gtg-fix-the-dispatch-exec-portable-boundary-unit-test-test-bridg/261123-gtg-SUMMARY.md)" -ge 1` [HEAD=error:2 EXPECT>=1].
- `git status --porcelain -- test extensions` prints nothing.
- The orchestrator runs `npm run check` on the merged tree; this plan does not claim it.
</verification>

<success_criteria>
- The portable boundary case passes at any environment size: the full container environment, `env -i`, and an extra 50,000-character variable.
- It still compares the child's whole environment with an independently built expected value, and a child that drops one variable fails it.
- The dispatch-exec pair has 100% direct coverage without `env -i`, so the STATE.md workaround can go.
- One commit changes only `test/bridges/hooks/dispatch-exec.test.ts`; no product file changes; no break line is committed.
- The SUMMARY has `## Threat Flags` and `## Parent lines` and holds no environment values.
</success_criteria>

## For the orchestrator (not executor work)

1. STATE.md. Leaves never write it, so this item does not list it in `files_modified`. After this item merges, edit the bullet "[integration-rescope] Container facts measured 2026-11-21 (Phase 1 gate)" (line 1245 at 85c323b). Keep fact (1), about `fd`. Fact (2) says that the case fails and that direct coverage must run under `env -i HOME=$HOME PATH=$PATH ...` until the test is fixed. Replace it with a resolved line, for example: "(2) Fixed by quick task 261123-gtg (<commit from the SUMMARY>): the case 'executes a blocking hook through the portable process boundary' compares the hook child's environment through a capture file, so it passes at any environment size, and direct coverage runs without `env -i`."
2. Post-merge gate. This item commits a build input, so run `npm run check` in the main checkout after the merge (AGENTS.md "Build verification"), with the npm prefix of the context block. Fact (1) still applies to the cucumber part of that run: at planning time, `command -v fd` found nothing, and only `/usr/bin/fdfind` is installed.
3. This item adds no CHANGELOG line and no cucumber scenario: it changes only a test, and no user sees it.

<output>
Create `.planning/quick/261123-gtg-fix-the-dispatch-exec-portable-boundary-unit-test-test-bridg/261123-gtg-SUMMARY.md` with `status: complete` in its frontmatter. Do not commit it. Include:
- BASE, the commit (SHA and title), and the Node version.
- Each run: the command in short form, its exit status, and its deciding line. The runs are: the red padded run; the three green runs; both coverage result lines; the commit hook result; the audit verdict; the Task 2 break run, with only the lines that Task 2 step 3 names; and the run after the revert.
- `## Design choices`: Design items 1-5, each with the alternative and why the plan did not take it, plus any choice that you made during execution.
- `## Threat Flags` (AGENTS.md), even when the answer is "None -- no security-relevant surface outside the plan's `<threat_model>` was introduced."
- `## Parent lines` for the orchestrator: the STATE.md fact (2) replacement with the commit SHA filled in, and the post-merge `npm run check`.
- `## Deviations`, if any.
</output>
