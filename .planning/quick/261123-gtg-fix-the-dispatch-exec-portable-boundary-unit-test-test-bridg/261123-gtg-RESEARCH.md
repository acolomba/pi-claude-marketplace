# Quick 261123-gtg: dispatch-exec portable boundary test - Research

**Researched:** 2026-11-23
**Domain:** one `node:test` unit case (`test/bridges/hooks/dispatch-exec.test.ts:39-346`), test-only
**Confidence:** HIGH (every claim below was measured or read in this session)

## Summary

The case "executes a blocking hook through the portable process boundary" spawns a real
`node -e` child. The child puts its whole `process.env` in the observation it returns as
`hookSpecificOutput.additionalContext` (`test/bridges/hooks/dispatch-exec.test.ts:138-151`,
`environment: process.env,` at line 141). The product caps that string: `withCappedContext`
(`extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:280-296`) calls
`capHookContext`, and `context-cap.ts:16` sets `const CONTEXT_LIMIT = 10_000;` with
`if (text.length <= CONTEXT_LIMIT) { return text; }` at lines 86-88. A longer string comes back
wrapped as `<persisted-output>`. The product is right and the test is wrong: the result depends
on the size of the runner's environment.

**Primary recommendation:** the child writes `JSON.stringify(process.env)` to a fourth capture
file, `environment.json`, and leaves `environment` out of the observation in
`additionalContext`. The test parses that file and compares it whole with
`expectedEnvironment`. Every other assertion keeps its form. The returned context then holds only
argv, cwd, execPath, the literal argument, and stdin, so its size no longer depends on the
environment.

## 1. Failure mechanism (measured)

| Run | Env JSON length | Result |
|-----|-----------------|--------|
| `node --import "$PWD/scripts/isolated-pi-home.mjs" --test --test-name-pattern '<title>' test/bridges/hooks/dispatch-exec.test.ts` | 10,697 chars (`node -e 'console.log(JSON.stringify(process.env).length)'`) | exit 1 |
| same under `env -i HOME=$HOME PATH=$PATH LANG=C.UTF-8 TMPDIR=/tmp` | 542 chars | exit 0, `pass 1` |

The failure output from the full-environment run:

```
✖ executes a blocking hook through the portable process boundary (111.73524ms)
  SyntaxError [Error]: Unexpected token '<', "<persisted"... is not valid JSON
      at JSON.parse (<anonymous>)
      at TestContext.<anonymous> (file:///home/user/pi-claude-marketplace/test/bridges/hooks/dispatch-exec.test.ts:288:15)
```

Line 288 is `JSON.parse(hookOutcome.additionalContext)`. The environment alone is above the
10,000 limit, and the JSON-in-JSON escaping and the stdin add more. [VERIFIED: run in this session]

All of `test/bridges/hooks/**/*.test.ts` under the full environment: `tests 2107`, `pass 2106`,
`fail 1`. That one failure is this case. [VERIFIED: run in this session]

## 2. Recommended change (test-only)

Move only the part of unbounded size, the environment, out of band. Keep everything else in
band, so the outcome still proves that the child's stdout reached `parseHookStdout` and the cap
unchanged.

Edits, all inside the one case:

1. Arrange: `const environmentCapturePath = path.join(caseRoot, "environment.json");`
2. Child program: destructure a fourth argv value, `environmentCapturePath`. Remove
   `environment: process.env,` from `observation`. Add
   `writeFileSync(environmentCapturePath, JSON.stringify(process.env));`
3. `commandArguments`: append `environmentCapturePath` after `stderrCapturePath`. This also flows
   into the `spawnargs` assertion, which is already `[process.execPath, ...commandArguments]`.
4. `expectedObservation`: drop `environment`, and set
   `argv: [literalArgument, stdoutCapturePath, stderrCapturePath, environmentCapturePath]`.
5. Act: `const childEnvironment = JSON.parse(await readFile(environmentCapturePath, "utf8")) as unknown;`
6. Assert: add `assert.deepStrictEqual(childEnvironment, expectedEnvironment);` beside the
   existing `childObservation` assertion. Keep `expectedEnvironment` as built now: all
   defined `process.env` entries, then `Object.assign` of `CLAUDE_PROJECT_DIR`,
   `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDECODE: "1"`,
   `CLAUDE_CODE_SESSION_ID`, and `CLAUDE_SESSION_ID` (lines 242-260).

Sketch of the child (only the changed lines):

```js
const [literalArgument, stdoutCapturePath, stderrCapturePath, environmentCapturePath] =
  process.argv.slice(1);
const observation = {
  argv: process.argv.slice(1),
  cwd: process.cwd(),
  execPath: process.execPath,
  literalArgument,
  stdin,
};
// ... stdout built from observation as today ...
writeFileSync(environmentCapturePath, JSON.stringify(process.env));
```

### How this keeps each assertion's intent

| Current proof | After the change |
|---------------|------------------|
| The child inherits the whole parent env, with the CLAUDE_* additions and without `CLAUDE_CODE_REMOTE`/`CLAUDE_ENV_FILE` | `deepStrictEqual(childEnvironment, expectedEnvironment)`. This is still a whole-object comparison against an independently built expected value. A missing, extra, or changed variable fails it. |
| argv, cwd, execPath, the literal argument, stdin | Still inside `childObservation`, parsed from the product's `additionalContext`, with `deepStrictEqual` |
| The outcome shape `{ kind: "mutate", additionalContext, permissionDecision: "allow" }` | Unchanged `deepStrictEqual(hookOutcome, expectedHookOutcome)` |
| The stdout bytes | Unchanged `strictEqual(stdout, expectedStdout)`. The bytes no longer contain the env. |
| stderr, the debug log, the timers, the child lifecycle | Unchanged |

One side effect: the old string comparisons also fixed the order of the env keys inside
`additionalContext`. That order is not a contract. `prepareHookEnv` builds the env as
`{ ...process.env, CLAUDE_PROJECT_DIR, CLAUDE_PLUGIN_ROOT, CLAUDE_PLUGIN_DATA, ...options,
...extra, ...claudeSessionEnvFor(...) }` (`bridges/hooks/hook-env.ts:98-109`), so the order only
follows whatever order `process.env` has. `deepStrictEqual` on the parsed object ignores key
order. [VERIFIED: hook-env.ts read this session]

### Alternatives rejected

- **Digest in `additionalContext`** (the child hashes the observation, and the test hashes
  `expectedObservation`). It proves equality, but a mismatch tells you nothing about which
  variable differs. It also hashes a key-ordered string, so it keeps the incidental
  key-order dependence. The capture file gives a full diff on failure.
- **Whole observation to a file, with a constant `additionalContext`.** This takes argv, cwd,
  and stdin out of the product path for no reason. The returned value would no longer carry
  anything the child observed.
- **Shrink `process.env` for the case.** This drops the proof that the child inherits the
  real, whole environment. Replacing all of `process.env` is also risky for the rest of the
  file.
- **Accept `<persisted-output>` and read the saved file.** The branch taken would then still
  depend on the env size, so the coverage path would change from machine to machine.

### Unit-test rules check (`.agents/skills/typescript-unit-tests/rules/cases.md`)

- "Compare whole values with `assert.deepStrictEqual()`": met. The env, the observation, and
  the outcome are each compared whole.
- "Build expected values independently": met. `expectedEnvironment` is built from
  `process.env` plus literals, not taken from the product.
- "When bytes are the contract (a file ...), compare the complete bytes": `environment.json`
  is the test child's own capture, not a product artifact. Parsing it is fine. The product's
  stdout bytes are still compared whole.
- Names: `environmentCapturePath` and `childEnvironment` follow the existing
  `stdoutCapturePath` and `childObservation` pattern. No `// arrange / act / assert` changes
  are needed.
- Precedent: `features/lib/hook-recorder.ts:108-116` also records a hook child's environment to
  a file (`appendHarnessLine`), not to hook output.

Residual bound: the in-band observation now holds about six copies of the temp-root path
(argv ×3 + the new path, cwd, and the cwd in stdin), plus about 300 characters of stdin. With
any realistic `TMPDIR`, this stays far below 10,000. Only a `TMPDIR` path over ~1,500
characters could reach the cap. [ASSUMED: estimate, not measured]

## 3. Other tests with the same fragility

None found. Searched `test/` and `features/` for `stringify(process.env`, `environment:
process.env`, `printenv`, and `Object.entries/keys(process.env)`:

- `test/bridges/hooks/dispatch-exec.test.ts:141` is the only child that echoes `process.env`
  into hook output.
- `features/lib/hook-recorder.ts:115` writes `claudeEnvironment(process.env)` to a harness log
  file, filtered to CLAUDE variables (lines 77-85). It does not write it to hook stdout.
- `test/bridges/hooks/async-rewake/registry.test.ts:2764` spreads `process.env` into an
  expected spawn-options env for an injected fake spawn. No real child output is involved.
- Measured: every other test in `test/bridges/hooks/**` passes under the full 10.7 KB
  environment.

## 4. Direct coverage of the `dispatch-exec.ts` pair

- Baseline under the stripped env, where the test's context is under the cap (the same
  condition the fix creates everywhere), with
  `CI=1 node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts`:
  `Direct coverage passed: ... (branches 55/55, functions 15/15, lines 512/512)`.
  [VERIFIED: run in this session]
- So the over-cap path of this case adds no coverage. The `save` arrow on `dispatch-exec.ts:294`
  is covered by the injected-saver cases (`saveHookOutput: saver.saveHookOutput` at test lines
  3205 and 3372). The `deps.saveHookOutput ?? saveHookOutput` and `deps.dispatchId ?? randomUUID`
  defaults (lines 292-293) are still evaluated for an under-cap context.
- This case stays the one that runs the real `spawn` default (`deps.spawnImpl ?? spawn`, line
  390). The change keeps the real spawn, so that branch stays covered.
- Effect: the pair's coverage no longer depends on the environment, and the `env -i`
  workaround in STATE.md ("Run direct coverage with `env -i HOME=$HOME PATH=$PATH ...` until
  the test is fixed") can be retired.

## Validation Architecture

| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` |
| Quick run | `node --import "$PWD/scripts/isolated-pi-home.mjs" --test --test-name-pattern 'executes a blocking hook through the portable process boundary' test/bridges/hooks/dispatch-exec.test.ts` |
| Pair coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` (must report 55/55, 15/15, 512/512) |
| Gate | `npm run check` in the main checkout after merge (test file is a build input; AGENTS.md "Build verification") |

Acceptance:
- The quick run passes under the full container env (10.7 KB) and under the `env -i` env.
- To prove the env assertion still discriminates, break it on purpose once and do not commit
  the break: for example, add `delete process.env.HOME;` in the child before the env write.
  `deepStrictEqual(childEnvironment, expectedEnvironment)` must then fail.
- Direct coverage stays at 100%, run without `env -i`.
- No cucumber scenario: the change is test-only, and no user sees it (AGENTS.md "Behavioral tests").

## Project Constraints (from AGENTS.md)

- Test-only change; no product edits. Commit on the quick-task branch, never `main`. Use no
  `--no-verify`.
- The pre-commit hook runs `check:commit`, which covers the staged `dispatch-exec` pair
  directly. Then run the full `npm run check` after the worktree merge.
- Comments and test titles cite no phase or plan IDs. Keep the title unchanged.

## Security Domain

Not applicable. The change adds no product surface. The capture file is written under the
case-owned temp root (`createHermeticEnvironment`), and its `t.after` cleanup removes it.

## Assumptions Log

| # | Claim | Risk if wrong |
|---|-------|---------------|
| A1 | The in-band observation stays well under 10,000 chars for any realistic `TMPDIR` | Low: only a `TMPDIR` path over ~1,500 chars would bring the cap back |
