# Quick Task 261120-i6p: Centralize environment allowlisting in the tests - Research

**Researched:** 2026-11-20
**Domain:** node:test and cucumber harness environment control (no production change)
**Confidence:** HIGH for the inventory and the file rules, MEDIUM for Node runner internals

<user_constraints>
## User Constraints (locked by the maintainer)

1. Every test that controls an environment allowlists ONLY the variables that matter to that specific test.
2. The allowlisting mechanism is centralized per test tier. Unit, integration, and cucumber tests MAY each have their own implementation or share one; within a tier there is one.

Scope: node:test tiers (`test/**` unit, `test/integration`, `test/e2e`, `test/architecture`) and the cucumber harness (`features/`). Out of scope: `scripts/`, `test/live-uat/`, and all of `extensions/`. `prepareHookEnv` keeps passing the whole `process.env` to hooks on purpose (Claude Code parity).
</user_constraints>

## Summary

Nine node:test files start a child with `{ ...process.env, X }` or with no `env` at all, which is shape (a). About ten cases let production code spawn a real child from `process.env`, which is shape (b). About 45 files set and restore single variables, each with its own copy of the save, delete-or-assign, and restore code. Eight local helpers already do this job and are not shared: `captureDebugLog`, `setGitHubBaseUrl`, `enterHermeticEnvironment`, the `withEnv` in adapter-expansion-conformance, the snapshot in plugin-path.test, the helpers in settings.test, hermetic-git-environment.test, and https-git-host-cgi.test. Cucumber is close to done. `rpcChildEnvironment` and `hermeticGitEnvironment` already build each child's environment from nothing and copy only `PATH` from the host. One inline `{ PATH }` remains, and `state-lock-holder.ts` still inherits the whole worker environment.

**Primary recommendation:** For node:test, add one module, `test/platform/process-environment.ts`. It holds a per-case **environment ledger**: the first change to a key records the key's original state, and one `t.after` puts every recorded key back. Three functions use the ledger: `setEnvironment` (set and restore), `useAllowlistedProcessEnvironment` (shape b), and `allowlistedEnvironment` (shape a, a pure builder). Rebuild `enterHermeticEnvironment`, `captureDebugLog`, and `setGitHubBaseUrl` on the ledger. When every change goes through one ledger, the order of the `t.after` hooks stops mattering. For cucumber, add `features/lib/child-environment.ts` with one `hostVariables(names)` picker. `rpcChildEnvironment`, `hermeticGitEnvironment`, the openssl launch, and the state-lock holder all build on it.

## Inventory

Legend: **a** = the test builds a child env; **b** = production spawns from `process.env`; **w** = code under test reads or asserts the whole `process.env` but starts no real child; **s** = set and restore of named variables.

| File (case) | Shape | Needs | Today |
|---|---|---|---|
| `test/bridges/hooks/dispatch-exec.test.ts` "executes a blocking hook through the portable process boundary" | b | `HOME`, `PI_CODING_AGENT_DIR` (from the hermetic env); overrides `PI_CLAUDE_MARKETPLACE_DEBUG=1`, `PORTABLE_HOOK_PROBE`, `PI_SUBAGENT_CHILD=1`. **Not `PATH`**: the command is the absolute `process.execPath` (line 183). `TEMP`/`TMP`/`TMPDIR`/`SystemRoot` are needed only if Windows matters | Hand-rolled: `PORTABLE_CASE_ENVIRONMENT` (lines 44-52), a snapshot at 56, prune at 78, restore at 57-65 |
| same file, the "dispatch-identity-real-" case (~line 1197, a real `spawn` inside `spawnImpl`) | b | nothing beyond the hermetic pair; the child only copies stdin to a file | inherits everything |
| `test/bridges/hooks/async-rewake/registry.test.ts`: the real spawns near lines 1585, 1605, 1785 (recordingSpawn), and 5171 ("uses the real spawn ... at the default boundary") | b | the hermetic pair, plus what each case sets (`PI_SUBAGENT_CHILD`, debug) | inherits everything |
| registry.test.ts ~2764 (`processEnvironment = { ...process.env }` compared with the spawn options) | w | the same names | spreads the whole env into `expected` |
| `test/bridges/hooks/event-router.test.ts:487` persisted orphan | a | `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH` only (absolute execPath) | `{ ...process.env, ... }` |
| `test/architecture/hook-script-cleanup.test.ts:27-29` | a | `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH` only | `{ ...process.env, ... }` |
| `test/orchestrators/plugin/state-fifo.ts:204` | a | `PATH` (the server runs `execFileSync("mkfifo")`), `PI_CM_FIFO_*` | `{ ...process.env, ... }` |
| `test/integration/concurrent-install.test.ts:124-131` (fork) | a | `HOME`, **`PI_CM_TEST_HOME`** (see Pitfall 1), `PI_CODING_AGENT_DIR` (today it is inherited from the runner, not set; decide whether it should be `env.home`) | `{ ...process.env, HOME }` |
| `test/integration/load-reconcile-race.test.ts:141-143` and `:519-525` (fork) | a | `HOME`, `PI_CODING_AGENT_DIR`, `PI_CM_TEST_HOME` | `{ ...process.env, ... }` |
| `test/integration/hooks-{additionalcontext,spawn,dispatch}-end-to-end.test.ts` (real `bash`/`node` hooks through the default spawn) | b | `PATH` (for `bash`/`node`), the hermetic pair; hooks-dispatch also sets `PI_SUBAGENT_CHILD` (line 493) | inherits everything |
| `test/architecture/json-output-docs.test.ts:52-54` | a | `PATH` + its two inputs | inline allowlist; move it to the helper |
| `test/e2e/json-output-runtime.ts:179-185` | a | `PATH`, `HOME`, `PI_CODING_AGENT_DIR`, `PI_CODING_AGENT_SESSION_DIR`, `PI_OFFLINE` | inline allowlist; move it to the helper |
| `test/e2e/pi-runtime-smoke.ts:38-44` | a | the same five as json-output-runtime | `{ ...process.env, ... }` |
| `test/e2e/upstream-marketplace.ts:36-48` (git over the public network) | a | `PATH`, `HOME`, the proxy/CA variables (`HTTPS_PROXY`, `HTTP_PROXY`, `NO_PROXY`, `GIT_SSL_CAINFO`/`SSL_CERT_FILE`) and `GITHUB_TOKEN` when set | three `git` calls inherit everything; the fetch passes `process.env` twice over (the GITHUB_TOKEN branch adds nothing) |
| `test/e2e/rpc-session.ts:253-258` | a | uses cucumber's `rpcChildEnvironment` | already allowlisted |
| `test/platform/package-manager.test.ts`, `prompt-shell.test.ts`, `git-credential.test.ts` | — | injected `env: {}` / fake spawn | already compliant; no change |
| `test/bridges/hooks/hook-env.test.ts:57,171`, `test/shared/session-env.test.ts` | w | the names each case sets | spread the whole env as the expected base |
| **s** class, ~45 files: `test/index.test.ts`, `edge/command-run`, `domain/mcp-resolution`, `orchestrators/{plugin-options,plugin-path,plugin/info,plugin/enable-disable,plugin/workflows-staging-gc,import/execute,import/settings,marketplace/background-*,mcp/builtin-registration-step,reconcile/apply}`, `bridges/hooks/{timeout,wire-protocol,event-adapters,dispatch,exec-timer,on-failure,runtime,settle,stream-text,async-rewake/pid-table}`, `bridges/mcp/{stage,collision-slots}`, `bridges/workflows/{stage,unstage}`, `persistence/locations`, `platform/{pi-api,workflow-home}`, `shared/{debug-log,completion-cache,notification-dispatch}`, `integration/{adapter-expansion-conformance,mcp-variable-expansion,skill-path-resolution,workflow-kind-inversion}`, `e2e/import-command`, `architecture/{no-factory-time-probe,https-git-host-cgi,hermetic-git-environment}` | s | the named variables (mostly `PI_CLAUDE_MARKETPLACE_DEBUG`, `PI_SUBAGENT_CHILD`, `PATH`, `PI_CLAUDE_MARKETPLACE_PATH`, `CLAUDE_*`, `HOME`, `PI_CODING_AGENT_DIR`, `CLAUDE_CONFIG_DIR`, `PI_OFFLINE`, `ANTHROPIC_API_KEY`, `PI_CM_AVAR_*`) | hand-rolled save/restore in each file, plus the shared helpers `test/platform/debug-log-capture.ts` (30 importers together with the next one) and `test/shared/github-base-url-environment.ts` |
| `features/lib/pi-rpc.ts:192-229` `rpcChildEnvironment` | a | `PATH` from the host, and every other value built from the sandbox | **already an allowlist** |
| `features/lib/hermetic-git.ts` `hermeticGitEnvironment`, and `features/lib/https-git-host/cgi.ts:46` | a | `PATH` from the host | **already an allowlist** |
| `features/lib/https-git-host/server.ts:376-379` (openssl) | a | `PATH` | inline `{ PATH }`; move it to the builder |
| `features/lib/state-lock-holder.ts:65` | a | nothing (absolute execPath; it imports `proper-lockfile` by file) | **no `env`, so it inherits the whole worker env**: a gap |
| `features/lib/pi-tui.ts:401`, `pi-json-mode.ts:90`, `real-subagent-child.ts:966` | a | `rpcChildEnvironment` + named extras | compliant |
| `features/support/isolated-pi-home.ts` | s | `HOME`, `PI_CODING_AGENT_DIR` per scenario (`onRelease`) | compliant; it sets two named variables |
| `features/step_definitions/hook/tool-failure.steps.ts:53` (the wrapper script runs inside Pi's MCP child), `features/lib/{hook-recorder,mcp-stub-server,mcp-server-environment,pi-launch-environment,run-start-probe}.ts`, and the `packages`/`session-start-hooks` step scripts | — | they run inside the already-allowlisted Pi child and only read it | no change |

Sources: Grep of `test/` and `features/` this session; each file named above was read at the cited lines.

## Recommended Boundary for Rule 1

A test "controls an environment" in one of three ways:
- **(s)** It sets or removes a named variable. It does so through the tier helper. The variable it sets is, by definition, the variable that matters.
- **(a) and (b)** Its code starts a real child, or the test passes the whole environment to the code under test. Such a test runs on an allowlisted environment. It lists the variables the child or the assertion reads, plus the run-isolation variables of Pitfall 1 where they apply.
- **(w)** Optional. These cases spread the whole env only to build the expected value. Allowlisting makes that value small and known. Do it in the same pass, because the same helper covers it.

Tests that inject `env: {}` into a factory need no change (`package-manager`, `prompt-shell`, `git-credential`).

## Proposed API

### node:test tier: `test/platform/process-environment.ts` (new; no `.test.ts` beside it)

```ts
import type { TestContext } from "node:test";

/** Shape (a): a fresh env with only `names` copied from this process (absent names are skipped), then `values`. */
export function allowlistedEnvironment(
  names: readonly string[],
  values?: Readonly<Record<string, string>>,
): NodeJS.ProcessEnv;

/** Shape (s): sets (string) or removes (undefined) each variable until `t` ends. */
export function setEnvironment(
  t: TestContext,
  values: Readonly<Record<string, string | undefined>>,
): void;

/** Shape (b): removes every variable not in `names` from process.env until `t` ends, then applies `values`. */
export function useAllowlistedProcessEnvironment(
  t: TestContext,
  names: readonly string[],
  values?: Readonly<Record<string, string | undefined>>,
): void;

/** Core for callers without `t` (withHermeticEnvironment): the same ledger with an explicit restore. */
export function enterEnvironment(values: Readonly<Record<string, string | undefined>>): () => void;
```

How the ledger works: a `WeakMap<TestContext, Map<name, { had: boolean; value?: string }>>`. The first time a case changes a key, the ledger records that key's original state, and it registers **one** `t.after` per context. Restore deletes each key that was absent and reassigns each key that was present. Restore never assigns `undefined`: `process.env` would store the text "undefined", the problem `github-base-url-environment.ts:13-16` already describes. When `useAllowlistedProcessEnvironment` runs, it also keeps the key set of the whole env at that moment. Restore deletes any key that is not in that set, because production code can add variables during the case, as `recomputePluginPath` does with `PATH` and `PI_CLAUDE_MARKETPLACE_PATH`.

- `enterHermeticEnvironment` (`test/platform/hermetic-environment.ts:29-57`) sets HOME and PI_CODING_AGENT_DIR through `enterEnvironment`. Its `restoreEnvironmentVariable` (lines 15-27) can then go. `createHermeticEnvironment` (lines 59-66) uses the `t` ledger, so pruning and the hermetic restore share one record.
- `captureDebugLog` and `setGitHubBaseUrl` become one-line wrappers over `setEnvironment`. Their 30 importers do not change.
- Where the file lives: `test/platform/` holds `hermetic-environment.ts` already, and the skill says support goes next to its concern, never in `test/helpers/` (`typescript-unit-tests/rules/pairing-and-design.md`). `features/` never imports it. That is correct, because `features/` counts as production for fallow dead-code, and PR #329 moved shared files out of `test/` for this reason. A `test/platform/*.ts` file without `.test.ts` needs no source pair (`scripts/check-corresponding-tests.mjs`: only `*.test.ts` outside `architecture|e2e|integration` must pair).
- The helper's test goes in **`test/architecture/process-environment.test.ts`**. It is unpaired, like `test/architecture/hermetic-git-environment.test.ts`, which tests the features builders. A `test/platform/process-environment.test.ts` would fail `test:corresponding`, because no `extensions/.../platform/process-environment.ts` exists. Cases: an absent key comes back absent, not "undefined"; both orders of `createHermeticEnvironment` and `useAllowlistedProcessEnvironment` return HOME and PI_CODING_AGENT_DIR to their values before the test; a key that production adds during the case is removed; two calls in one case register one restore; `allowlistedEnvironment` skips absent names.

### cucumber tier: `features/lib/child-environment.ts` (new)

```ts
/** Copies only `names` from the worker's environment; every other child variable is built by its owner. */
export function hostVariables(names: readonly ("PATH")[]): NodeJS.ProcessEnv;
```

Keep `rpcChildEnvironment` and `hermeticGitEnvironment` as the per-purpose builders. They already allowlist. Replace their `PATH: process.env.PATH ?? ""` with `...hostVariables(["PATH"])`, and do the same in `server.ts:378`. Give `state-lock-holder.ts:65` `env: {}`, or `hostVariables([])` if it needs nothing; the executor confirms this by running a scenario that holds the lock. Then the only reads of the host environment in the harness happen in that one function. Extend `test/architecture/hermetic-git-environment.test.ts`, or add `child-environment.test.ts` there, so a planted host variable such as `GIT_DIR` stays out of the openssl and lock-holder launches too. The e2e tier already shares `rpcChildEnvironment`. Rule 2 allows that.

## Common Pitfalls

1. **Forked children re-run `isolated-pi-home.mjs`.** `fork` passes on `process.execArgv`, which holds `--import isolated-pi-home.mjs`. The module changes nothing only when `PI_CM_TEST_HOME` is set [VERIFIED: scripts/isolated-pi-home.mjs:11-12 "a child that a case forks, inherits `--import` too. There the module finds `PI_CM_TEST_HOME` and changes nothing"; line 20 `if (process.env.PI_CM_TEST_HOME === undefined) {`]. A fork allowlist without `PI_CM_TEST_HOME` makes a new root and **overwrites the HOME the parent chose**. Every `fork` allowlist in concurrent-install and load-reconcile-race must keep it. `spawn(process.execPath, ...)` does not pass on execArgv, so this applies only to fork.
2. **Two restorers on one key.** node:test runs `after` hooks in the order they were added. This repo already relies on that [CITED: test/shared/github-base-url-environment.ts:12 "`after` hooks run in the order they were added"]. With today's separate restorers, the outcome depends on order. If the allowlist snapshot is taken after `createHermeticEnvironment`, the snapshot holds the hermetic HOME, and that restore runs last, so it puts back a deleted temp dir. f2225cc avoids this only by its call order: snapshot, then hermetic, then prune. The shared ledger removes the hazard, because each key keeps one record of its original value. Do not keep any separate whole-env snapshot restore.
3. **Concurrency.** Tests in one file run one at a time by default [CITED: nodejs.org/api/test.html "concurrency ... If `false`, only one test runs at a time ... Default: `false`"]. No case in `test/` or `features/` sets `concurrency: true` or a number (Grep this session). Each test file runs in its own process, so pruning reaches only that file. One risk remains: work from an earlier case that is still running, such as a timer or the exit handler of an async-rewake child, can read the pruned env. Wait for spawned children inside the case, as the existing `t.after` kills do.
4. **Runner variables.** `NODE_V8_COVERAGE` and `NODE_TEST_CONTEXT` are in the test process's env. f2225cc pruned both away for the length of the portable case, and that commit passed `check:commit`, which ran direct coverage for the `dispatch-exec` pair. So removing them for the length of a case did not break the runner or its coverage [inferred from the commit passing its hook, MEDIUM]. A child without `NODE_V8_COVERAGE` writes no coverage. That does not matter for `coverage/direct.lcov`: its children are `-e` scripts, not production modules. It can shrink `coverage/integration.lcov`, where forked children import production code, but Sonar does not read that file [ASSUMED: Node merges child coverage files from the shared `NODE_V8_COVERAGE` dir]. `--import` goes in as a CLI flag (package.json scripts and `scripts/test-coverage-direct.mjs:485-491`), not through `NODE_OPTIONS`, so no allowlist needs `NODE_OPTIONS`.
5. **Windows.** CI runs Linux only. If Windows matters, a Node child usually needs `SystemRoot`, and often `TEMP`/`TMP`, `PATHEXT`, and `COMSPEC`. Env names are case-insensitive there, and a copied `{ ...process.env }` loses that, so the helper's lookup must compare in uppercase on win32. `platform/package-manager.ts:287-288` already does this. Cost if Windows matters: one `win32` baseline list in each helper, which stretches rule 1. Cost if it does not: a developer on Windows may see failures. **The maintainer must decide.** Recommendation: Linux only, and no baseline.
6. **e2e over the real network.** `upstream-marketplace.ts` fetches from GitHub. In a proxied sandbox, git needs the proxy and CA variables. If the allowlist leaves them out, the fetch fails here but passes in CI.
7. **Commit hook cost.** `affectsEveryPair` runs **every** direct-coverage pair when any staged file under `test/` is not a `.test.ts` [VERIFIED: scripts/test-coverage-direct.mjs:683-688 `(projectPath.startsWith(`${testRoot}/`) && !projectPath.endsWith(".test.ts"))`]. So commits that touch `process-environment.ts`, `hermetic-environment.ts`, `debug-log-capture.ts`, `github-base-url-environment.ts`, or `state-fifo.ts` run the full pair suite, which takes minutes. Put those changes in as few commits as possible. A `features/lib` change triggers no pair run. The repo's hook also blocks shell commands that contain the literal `process.env`. Use the Grep tool for audits.
8. **The exact-equality assertions** in the portable case and in registry ~2764 compare the child env with `process.env` plus additions. After pruning, `expected` is built from the pruned env, and that stays correct. Do not hard-code the expected env.

## Validation Architecture

| Property | Value |
|---|---|
| Framework | `node:test` (Node v24.22.3 here), cucumber via `scripts/cucumber.mjs` |
| Quick run | `node --import "$PWD/scripts/isolated-pi-home.mjs" --test test/architecture/process-environment.test.ts` |
| Pair coverage | `npm run test:coverage:direct -- test/bridges/hooks/dispatch-exec.test.ts` (and the same for each migrated pair) |
| Full gate | `npm run check` in the main checkout after the merge (AGENTS.md) |

Wave 0: `test/architecture/process-environment.test.ts` (new), plus the cucumber builder test in `test/architecture/`.
No cucumber scenario: this change alters no `/claude:plugin` behavior a user can see.

## Suggested Plan Split

1. **Helpers.** Write `test/platform/process-environment.ts` and its architecture test. Rebuild `hermetic-environment.ts`, `debug-log-capture.ts`, and `github-base-url-environment.ts` on the ledger. Write `features/lib/child-environment.ts` and its architecture test, and migrate `pi-rpc.ts`, `hermetic-git.ts`, `server.ts:378`, and `state-lock-holder.ts`. This is one commit and runs the full pairs hook once.
2. **Children (shapes a, b, w).** Move the portable case onto `useAllowlistedProcessEnvironment` with `HOME` and `PI_CODING_AGENT_DIR` plus its three values, and delete `PORTABLE_CASE_ENVIRONMENT`. Migrate the other real-spawn cases in dispatch-exec, registry, and the integration hooks tests. Move every `{ ...process.env, X }` and inline allowlist to `allowlistedEnvironment`: hook-script-cleanup, event-router:487, state-fifo, concurrent-install, load-reconcile-race, json-output-docs, and the e2e runtime/smoke/upstream files.
3. **Set and restore (s).** Replace the hand-rolled save/restore in the ~45 files with `setEnvironment`. The change is mechanical. Batch it by directory to keep the diffs reviewable, and check for leftovers with the Grep tool for `deleteProperty\(process\.env|delete process\.env`, which should then match only inside `test/platform/process-environment.ts`.

## Assumptions Log

| # | Claim | Risk if wrong |
|---|---|---|
| A1 | Pruning `NODE_V8_COVERAGE`/`NODE_TEST_CONTEXT` while a case runs is safe (inferred from f2225cc passing its hook) | the direct coverage of a migrated pair breaks; then keep both names in the shape (b) helper |
| A2 | Child coverage merges into `integration.lcov` through the inherited `NODE_V8_COVERAGE` | integration.lcov shrinks; Sonar does not read it |
| A3 | `state-lock-holder` and the identity-real/registry children need no host variable on Linux | one case fails; add the variable the failure names |
| A4 | Windows is out of scope | Windows developers see failures |

## Open Questions

1. Windows: is support required (Pitfall 5)?
2. concurrent-install forks with the runner's `PI_CODING_AGENT_DIR` instead of one under `env.home`. Is that intended, or should the allowlist set it?
3. Include the (w) cases in this task, or leave them for later?

## Security Domain

Test-only change. The relevant point is secrets in the test environment: today `{ ...process.env }` passes every developer or CI secret (tokens, `ANTHROPIC_API_KEY`) to test children. With allowlisting, no secret reaches a child unless a case names it, such as `GITHUB_TOKEN` for the e2e fetch. No ASVS control applies beyond V8 data protection.

## Metadata

Inventory: HIGH (Grep and Read this session). Node runner internals: MEDIUM. Valid until the next test-harness refactor (~30 days).
