---
quick_id: 261123-gtg
phase: quick-261123-gtg
plan: 01
status: complete
subsystem: testing
tags: [hooks, dispatch-exec, node-test, direct-coverage]
provides:
  - "The portable boundary case passes at any environment size and still compares the hook child's whole environment"
affects: [bridges/hooks dispatch-exec direct coverage, STATE.md container fact (2)]
actuals:
  tokens: 960
  tasks: 2
  commits: 1
plan_head_before: 542aebea44dd647f9501ff7cf582bd16ce664a45
plan_head_after: c8df983e2f8d68059a373dcabdd154d17834ac90
tech-stack:
  added: []
  patterns: ["Unbounded child observations go to a capture file under the case root, not through the capped hook context"]
key-files:
  created: []
  modified: [test/bridges/hooks/dispatch-exec.test.ts]
key-decisions:
  - "The hook child writes its environment to environment.json under the case root; argv, cwd, execPath, the literal argument, and stdin stay in additionalContext"
requirements-completed: []
completed: 2026-11-23
---

# Quick 261123-gtg: dispatch-exec portable boundary case, environment through a capture file

The case "executes a blocking hook through the portable process boundary" now has its hook child write `process.env` to `environment.json` under the case root and compares that file whole with `expectedEnvironment`. The returned `additionalContext` no longer holds the environment, so the 10,000-character context cap (D-PG5-14) never wraps it, whatever the size of the runner's environment.

- BASE: `542aebea44dd647f9501ff7cf582bd16ce664a45` (`docs(planning): plan the local git marketplace tag scenario`), on the worktree branch, which descends from 85c323b.
- Commit: `c8df983e2f8d68059a373dcabdd154d17834ac90` `test(hooks): compare the hook child's environment through a file` (parent: BASE; one file, 10 insertions, 4 deletions).
- Node: v24.22.3.

## Runs

| Run | Command (short form) | Exit | Deciding line |
|-----|----------------------|------|---------------|
| Red (before the edit) | named case, `PORTABLE_ENV_PADDING` = 50,000 `x` | 1 | `SyntaxError [Error]: Unexpected token '<', "<persisted"... is not valid JSON` at `dispatch-exec.test.ts:288:15`; `ℹ fail 1` |
| Green 1 | named case, full environment | 0 | `ℹ tests 1`, `ℹ pass 1`, `ℹ fail 0` |
| Green 2 | named case, `env -i HOME PATH LANG=C.UTF-8 TMPDIR=/tmp` | 0 | `ℹ tests 1`, `ℹ pass 1`, `ℹ fail 0` |
| Green 3 | named case, padded | 0 | `ℹ tests 1`, `ℹ pass 1`, `ℹ fail 0` |
| Coverage, full environment | npm prefix, `CI=1 npm run test:coverage:direct -- .../dispatch-exec.ts` | 0 | `Direct coverage passed: extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts (branches 55/55, functions 15/15, lines 512/512)`; 118 of 118 pass |
| Coverage, padded | same, with the padding variable | 0 | the same `Direct coverage passed` line; 118 of 118 pass |
| Structure gates 6-9 | awk region counts | ok | `environment: process.env` 0, `environment: expectedEnvironment` 0, capture write 1, whole-environment assertion 1 |
| Formatting | `prettier --check` on the test file | 0 | `All matched files use Prettier code style!` |
| Commit hook | npm prefix, `git commit -F <msg>` | 0 | `npm run check:commit....Passed`, `prettier....Passed`, `gitlint....Passed` |
| Verify 10 | commit found by exact title | ok | title matches; `git diff --name-only c8df983^ c8df983` prints only `test/bridges/hooks/dispatch-exec.test.ts` |
| Verify 11 | `fallow audit --base 542aebe --format json` | 0 | verdict `pass`, 0 warnings, 0 dead-code issues, 0 complexity findings, 0 clone groups |
| Break (Task 2) | named case, full environment, `delete process.env.HOME;` above the capture write | 1 | see below |
| After the revert | named case, full environment | 0 | `ℹ tests 1`, `ℹ pass 1`, `ℹ fail 0` |
| Task 2 verify | `git diff --exit-code HEAD -- <file>`, `git diff --cached --quiet` | 0, 0 | tree and index match c8df983; `git log -1 -- <file>` still prints c8df983 |

Break run, only the lines that Task 2 step 3 names:

- Exit status: 1
- `ℹ tests 1`
- `ℹ pass 0`
- `ℹ fail 1`
- `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`
- A diff line of the form `-   HOME: '<case root>/home',` was present (one match).
- Failing frame: line 306 of the broken file, the line of `assert.deepStrictEqual(childEnvironment, expectedEnvironment);`.

The saved report was deleted from the scratchpad right after these lines were extracted. `git diff --stat` showed exactly one insertion before the run.

## Design choices

1. **Environment out of band, the rest in band.** Only the environment, which has no size bound, moves to a capture file. Argv, cwd, execPath, the literal argument, and stdin stay in `additionalContext`, so the case still proves the child's stdout reached `parseHookStdout` and the cap unchanged. Not taken: a digest of the environment (proves equality only, gives no diff on failure); the whole observation in a file (takes argv, cwd, and stdin off the product path); a smaller `process.env` for the child (drops the whole-environment proof); reading the `<persisted-output>` file (which branch runs would still depend on the environment size).
2. **One comment** above `environmentCapturePath`, with the two lines the plan gave, so a later cleanup does not put the environment back in band. No other comment was added.
3. **Capture write order.** The environment write sits right after the stderr capture write and before the two `writeSync` calls, so the three capture writes stay together. The case reads the files only after `dispatchHookExec` resolves, which happens after the child closes.
4. **`expectedEnvironment` unchanged.** It is still built from `process.env` and literals, never from the product. `deepStrictEqual` on the parsed object ignores key order, which `prepareHookEnv` does not promise.
5. **Destructuring over two lines** in the child program (`=` at the end of the first line), so each line stays under 100 characters; Prettier does not format text inside the template.
6. **Executor choice: no separate fixer pass.** The plan's `SKIP=npm-check... pre-commit run --files` step was not run, because the caller forbids setting or changing SKIP and the sandbox refused the command. Instead, `prettier --check` was run on the file, and the commit hook ran every pre-commit hook, the fixers included, and all passed on the first try.
7. **Executor choice: coverage runs in parallel.** The full-environment and padded coverage runs ran at the same time in the background. Both printed the full 100% line and 118 of 118 passing.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-261123-gtg-02 was handled as planned: only the named lines of the break report were kept, no environment value was copied, and the report file was deleted.

## Parent lines

- STATE.md, bullet "[integration-rescope] Container facts measured 2026-11-21 (Phase 1 gate)": keep fact (1) about `fd`, and replace fact (2) with: "(2) Fixed by quick task 261123-gtg (c8df983): the case 'executes a blocking hook through the portable process boundary' compares the hook child's environment through a capture file, so it passes at any environment size, and direct coverage runs without `env -i`."
- Post-merge gate: this item commits a build input, so run `npm run check` in the main checkout after the merge, with the npm prefix `npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`. This leaf did not run it.

## Deviations

1. **Fixer pass skipped** (Design choice 6). Plan Task 1 step 5 said to run `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files ...`. The caller's constraints forbid setting SKIP and the sandbox refused the command, so the commit hook's own run of every hook took its place. All hooks passed, `npm run check:commit` included. The commit is unaffected.
2. **Worktree `node_modules`.** A real `node_modules` directory with `.package-lock.json` was already present, so no install or symlink was needed.

## Self-Check: PASSED

- `test/bridges/hooks/dispatch-exec.test.ts` is changed in c8df983, and c8df983 is an ancestor of HEAD.
- `git status --porcelain -- test extensions` prints nothing.
