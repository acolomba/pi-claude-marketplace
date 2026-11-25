# Phase 6: Hooks and Auth - Research

**Researched:** 2026-11-22
**Domain:** Moving integration cases to cucumber scenarios, a print-mode Pi driver, and two harness races (test-only; no product change found necessary)
**Confidence:** HIGH. All 8 scenario drafts ran green under the `adapter` profile against the real extension, first with scratch step code and then against the validated in-tree step code. `builtin` selects 0 of them, as DUAL-02 expects, because none has an MCP surface. I ran 23 breaks. 22 failed their target scenarios on a `Then`, and the one that passed is a planned control. The `[Async flake]` inner error was captured in a full adapter run, then reproduced deterministically, and a fix was validated. Every experiment was reverted. `git status --porcelain` was clean at the end, except for this file.

## Summary

The four integration files hold **17 tests** (1 + 2 + 7 + 7). **13 move to cucumber or are already covered** and get deleted. **2 stay** for Phase 8, as CONTEXT says: `hooks-dispatch-end-to-end.test.ts:403` (a throwing project hydrate) and `auth-e2e.test.ts:204` (a staging cleanup failure, fault injection). The other 2 are the HOOK-E2E-03 halves that `hook/additional-context.feature` already covers. The drafts add **8 new scenarios to four existing owner files**, and no new feature file is needed:

- `hook/lifecycle.feature`: 2 (both scopes after a load, both scopes after `apply`)
- `hook/session.feature`: 1 (WR-05, which also covers HOOK-E2E-01)
- `hook/additional-context.feature`: 1 (HOOK-E2E-04)
- `marketplace/device-flow.feature`: 4 (AUTH-07 evict, AUTH-07 sign in again, print `marketplace add`, print `apply`)

All 8 are untagged. They run under `adapter`, and `builtin` selects 0 (measured, DUAL-02).

**Print driver.** Pi's print mode gives the extension a no-op `notify` (`@earendil-works/pi-coding-agent` 1.5.1 `dist/core/extensions/runner.js:136`). It prints an error that a command throws on stderr as `Extension error (command:claude:plugin): <message>` (`dist/core/agent-session.js:1793-1803` with the print-mode `onError` in `dist/modes/print-mode.js`), and it exits 0. So `pi -p "/claude:plugin marketplace add acme/tools --scope project"` with the routed stand-ins exits 0, prints nothing on stdout, and prints exactly this on stderr: `Extension error (command:claude:plugin): Device-flow authentication is unavailable in print mode. Retry with --mode json or interactive Pi.` (measured). A first driver that copied `pi-json-mode.ts` failed `fallow dupes` with a 27-line clone (`dup:077716d6`). The validated design is one NEW library, `features/lib/pi-one-shot.ts` (`runOneShotPi(launch, "json" | "print", ...)`). The json driver delegates to it, and a print `When` plus two `Then` steps go in `command.steps.ts`. `OneShotPiLaunch` gains the routed git environment and `extensions`, so a one-shot Pi of a routed scenario also loads the GitHub redirect (D-BG-01). tsc, ESLint, Prettier, `npm run fallow` (all sub-gates), and `npm run check:features` pass. The check:features run used a scratch copy of the tree with the drafts appended.

**[Async flake] captured and fixed in research.** The After hook of `hook/async.feature:261` failed with `ESRCH: no such process, open '/proc/<pid>/environ'`. The error comes from `isRegisteredHookProcess` (`features/lib/hook-files.ts:676`), on the path `stopHookScripts` (`:747`) → profile-Pi release (`features/support/world.ts:1222-1226`). The hook process exited after `pi.stop()`. Its new parent is PID 1 (`process_api`), which reaps orphans only after seconds, and reading a zombie's `environ` fails with ESRCH, not ENOENT. This is the same race that 2c7d42d fixed in `subagent-hook-session.ts`. A script that makes an orphan zombie and lists it in a scope's PID table reproduces the error on every run. The fix treats ESRCH as "gone", and the script then passes. A **second harness race** showed up in an in-tree run: `async.feature:538` failed once in a `When` with `SyntaxError: Unterminated string in JSON` from `features/lib/turn-records.ts:62`. The JSONL reader parsed a line that a hook recorder had not finished writing. A fix that keeps only newline-terminated lines was validated (deterministic repro, lint). With both fixes and the 06-02 harness changes in tree, a full adapter run passed 2259/2259 (626 s).

**No product bug found.** One upstream-parity question blocks the HOOK-E2E-04 title (Open Question 1).

**Primary recommendation:** two plans in one wave, with disjoint files. **06-01 Hooks** (ITMIG-12) owns `hook-files.ts`, `turn-records.ts`, `project.steps.ts`, the three hook feature files, and the three hook integration files. **06-02 Auth** (ITMIG-13) owns `pi-one-shot.ts` (NEW), `pi-json-mode.ts`, `world.ts`, `command.steps.ts`, `device-flow.feature`, and `auth-e2e.test.ts`. Land the ESRCH fix as 06-01's first commit, because every gate depends on it.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- [Print driver] Q: "How do scenarios run Pi in print mode?" → Selected: "A new `features/lib/` module that starts Pi with `-p` (print mode) in the scenario sandbox and returns its exit status and output, modelled on `features/lib/pi-json-mode.ts` (process-group kill handed to `onRelease`), plus a step in the module that owns its topic (named in the plan)" — follows the ROADMAP note; harness code is cheap to change.
- [Tags] Q: "How are the scenarios tagged?" → Selected: "Untagged when the scenario has no MCP surface (runs under adapter; builtin selects 0, DUAL-02); `@mcp` only if a scenario touches MCP. Research checks each" — DUAL-02.
- [Device Flow] Q: "How are the eviction and the new sign-in shown?" → Selected: "With the stand-ins of `marketplace/device-flow.feature` and routed GitHub requests (D-BG-1101); the scenario shows the rejected credential, that the stored credential is gone, and the new sign-in prompt and clone" — reuses the harness.
- [Unchanged checks] Q: "How are 'leaves no staged clone' and 'leaves no .pi directory' proved?" → Selected: "Whole-directory checks (the whole-scope remembered/unchanged steps, or an absence step for the directory), never one file; Phases 2-5 reviews found narrow checks let regressions pass" — test approach.
- [Breaks] Q: "How is each replaced case checked before deletion?" → Selected: "One reverted deliberate break per behavior, run under every profile the scenario selects, failing on a When/Then assertion (not a Given), recorded in SUMMARY.md; already-covered cases get a break too" — the Phase 5 checker rule.
- [Deletion] Q: "What happens to the four files?" → Selected: "`hooks-cross-scope-reconcile` is deleted; `hooks-additionalcontext-end-to-end` goes if both cases are covered; `hooks-dispatch-end-to-end` and `auth-e2e` keep only their internal cases with a header saying why" — git history keeps the rest.
- [Async flake] Q: "The Phase 5 gate saw `features/hook/async.feature:261` fail in its After hook (`scenario releases failed`) in 2 of 4 full adapter runs; does this phase look at it?" → Selected: "Yes, as research: capture the inner release error under full-suite load and say whether it is a harness race (fix it in the plan that owns the hook harness module, with the scenario passing in repeated full runs) or a product bug (rule 4: small fix with a unit test, or a BACKLOG entry)" — it sits in this phase's hook harness and affects every gate.
- [Bugs] Q: "What if a scenario exposes a product bug?" → Selected: "Rule 4: fix it when small, with a unit test beside its source pair and a CHANGELOG parent line; otherwise a BACKLOG.md entry and the guarding integration case stays" — milestone rule.
- [Parallelism] Q: "How are plans split?" → Selected: "By feature-file ownership (hooks vs auth) so plans in a wave touch disjoint files; a shared step module or `features/lib/**` file changes in only one plan per wave" — wave layout is local to the plan.

### Claude's Discretion
- Scenario titles, step wording, tables; break edits; plan count and waves.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ITMIG-12 | Scenarios cover the hook cases: hook plugins in both scopes still run after an `apply` and after a load, a reload before the first prompt drops buffered SessionStart context, and a hook dispatch creates no `.pi` directory in a project that had none. | Drafts `research-06/final/{lifecycle,session,additional-context}.feature` (4 scenarios, untagged, green). Breaks X1, X2, H4 (H4a control), H4b, W1, and U1 fail them on a `Then`. P1, O1, O2, C1, C2, CH1, and CH2 confirm the already-covered cases before deletion. The harness fixes are F1 (ESRCH) and F2 (partial JSONL line). |
| ITMIG-13 | Scenarios cover the auth cases: a print-mode `marketplace add` that needs a sign-in refuses and leaves no staging behind, and a host that rejects the stored credential leads to the credential being evicted and a new Device Flow sign-in. | Draft `research-06/final/device-flow.feature` (4 scenarios, untagged, green) and the print driver `features/lib/pi-one-shot.ts`. Breaks E1, E2, R1, R2, and R3 fail the new scenarios. E3 and E4 confirm AUTH-01 and AUTH-02/08 in the existing `device-flow.feature`. |
</phase_requirements>

## Project Constraints (from AGENTS.md / CLAUDE.md)

- Read a file before you edit it, and trace a function's callers before you change it. Never commit to `main`. Update by merging, never by rebasing. Commit as `.agents/skills/committing/SKILL.md` describes, and never use `--no-verify`.
- Every plan `SUMMARY.md` has `## Threat Flags`, even when the answer is "None".
- GSD gates run `npm run check` on the combined tree. Inside `.claude/worktrees/...` the commit hook may check nothing, so run `npm run check:static` and the touched scenarios by hand before you commit.
- **Behavioral tests:** a user-visible `/claude:plugin` change ships with a scenario. This phase changes no product code.
- **Upstream parity:** a scenario expects Claude Code's behavior, or it names the decision ID or the Pi gap that licenses a divergence. The IDs these drafts use: DISP-02 (cross-scope rebuild, `event-router.ts:410-433` comment), WR-05, D-CF5-13 (pending Open Question 1), AUTH-07, D-BG-1101, and the accepted print-mode Pi limitation (`.planning/PROJECT.md:476-482`: "Print mode therefore stays silent -- a Pi limitation, accepted; scripted use is `--mode json`").
- **Parent lines:** no phase edits `CHANGELOG.md`, `.planning/BACKLOG.md`, or the PROJECT.md Key Decisions table. No CHANGELOG line is needed, because there is no product change. The harness fixes are test-only.
- **fallow audit:** each deleted or trimmed integration file gives a `weakened-tests` warn. Record it in the SUMMARY and move on. Do not change `.fallowrc.json` or the CI workflows (user decision, STATE.md).
- **Environment:** prefix npm with `npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`. Cucumber runs use `npm run test:cucumber:profile -- --profile <adapter|builtin> --parallel 2 <files>`. For a full suite run, put `fd` on `PATH` (`research-06/bin/fd -> /usr/bin/fdfind` exists).
- **Cucumber rules that shaped the drafts:** one `When` per scenario (`features.md` "Scenarios"), so the `apply` is a `Given`. A `Given` never follows a `When`. Tables list every row. Every new step must be used (`check:features`). No scenario reaches the network: every auth draft runs a routed Pi, and the print step loads the same redirect.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cross-scope routing rebuild (DISP-02) | `bridges/hooks/event-router.ts:434-455` (`rebuildRoutingTablesWith` walks the whole cache, `collectAllCachedPlugins` `:501-512`) | `orchestrators/reconcile/read-pass.ts:516-531` (`rebuildScopeRoutingTable`), called per scope by `apply.ts:2395` and `load.ts:211` through `closeScopePass` (`read-pass.ts:622-633`) | apply and the load both rebuild once per scope, project then user |
| Booted hook entries | `event-router.ts:824-855` (`hydrateTargets`: enabled records, `options: recordedOptionsOf(pluginRecord)` `:849`) | `persistence/state-io.ts:371-385` (`recordedOptionsOf`, the malformed arm gives `unreadable: true`) | D-PG10-23 and D-PG10-25 |
| SessionStart dispatch, lazy project hydrate | `event-router.ts:1463-1520` (`hydrateProjectScopeForCwdWith` `:1473`; reload returns before dispatch `:1499`, D-CF5-03) | `prepareSessionStartDataDirs` `:1180-1197` (mkdir `_shared` only for a scope with SessionStart entries, `:1187`, WR-05) | |
| Buffered SessionStart context | `bridges/hooks/runtime.ts:326` (buffer), `:433-438` (drained on each bridge load) | `event-adapters.ts:801` (append), `event-router.ts:390` (drain at `before_agent_start`), `event-router.ts:1396` (registration clears) | Pi builds a fresh runtime per load (`moduleCache: false`, Pi `dist/core/extensions/loader.js:487`), so the clear is defensive |
| Child tool-hook identity | `bridges/hooks/payloads/post-tool-use.ts:84`, `post-tool-use-failure.ts:80` | `translation-context.ts` | |
| Stale credential eviction (AUTH-07) | `platform/git-auth-callbacks.ts:250-262` (`onAuthFailure`: `credentialOps.reject`, then `{ cancel: true }`) | `onAuth` `:199-213` (fill hit, then Device Flow on a miss) | The eviction is in one command, and the new sign-in is in the next |
| Print-mode refusal | `orchestrators/auth-host.ts:197-199` (`ctx.mode === "print"` throws `DeviceFlowUnavailableError`) | `git-auth-callbacks.ts:219-222` (rethrown, never turned into a cancel), `shared/errors.ts:6-13` (text), `edge/command-run.ts:74-79` + `notification-dispatch.ts:172-175` (print rethrows to Pi) | Pi prints the throw on stderr |
| Staging cleanup | `orchestrators/marketplace/add.ts:1811-1823` (`cleanupStaging` of `sources-staging/<uuid>`) | | An empty `sources-staging/` stays, on success and on refusal (measured) |
| Behavioral proof | the four owner feature files | `command.steps.ts`, `project.steps.ts`, `pi-one-shot.ts`, `world.ts` | Test tier |

## Standard Stack

No packages are installed. The phase uses the harness that is already in the repo.

| Tool | Version | Purpose |
|------|---------|---------|
| `@cucumber/cucumber` via `scripts/cucumber.mjs` | `^13.3.0` `[VERIFIED: package.json]` | Profiles `adapter` (`not @builtin-only`) and `builtin` (`(@mcp or @builtin-only) and not @adapter-only`) `[VERIFIED: cucumber.json]` |
| `@earendil-works/pi-coding-agent` | 1.5.1 `[VERIFIED: node_modules/.../package.json]` | Print mode `dist/modes/print-mode.js`; `-p`/`--print` flag `dist/cli/args.js:145`; mode resolution `dist/main.js:84-95` |
| Node | v24.22.3 | Runtime `[VERIFIED: node --version]` |

## Package Legitimacy Audit

None. The phase installs no external package.

## Architecture Patterns

### How the scenarios reach each behavior

```
hooks:  profile Pi (scripted model) ─► dir marketplaces "fixtures" (project) + "shared" (user) ─► install demo / audit
          ─► Given new session (load: read pass rebuilds per scope)  [and] Given "/claude:plugin apply" (apply rebuilds per scope)
          ─► When prompt (model calls bash) ─► Then the hooks record these runs in any order (guard=project, watch=user)
        user plugin with SessionStart ─► When new session with the hooks recording ─► Then run row ─► Then the project directory is empty
        project SessionStart primer ─► When terminal pi starts (SessionStart buffers ss-ctx), /reload, prompt ─► Then model call 1 = prompt only
auth:   github source "tools" + git host requires x-access-token/stand-in-access-token + poll script ─► routed profile Pi
          ─► stale stored credential ─► When add ─► 401,401; failed; store empty            (AUTH-07 evict)
          ─► Given add failed ─► When add ─► device-flow-prompt + added; 401,200,200; store holds new  (AUTH-07 sign in again)
          ─► When add / apply in pi's print mode (one-shot Pi with the redirect) ─► exit 0 + stderr remedy | nothing; scope unchanged
```

### Case inventory: what each integration case asserts and what replaces it

"Visible" means that a user can see it: a run, a model message, a file, a printed line. Draft lines are in-tree landing lines, measured by appending the drafts to a scratch copy of the tree. Break IDs refer to the break table.

**`hooks-cross-scope-reconcile.test.ts` (1 case, delete the file)**

| Case | Asserts | Visible | Replacement | Breaks |
|---|---|---|---|---|
| `:101` | After a boot that hydrates both scopes, `applyReconcile` (both scopes) leaves the `PreToolUse` bucket with `project/project-plugin` and `user/user-plugin` | yes (both scopes' hooks run) | `hook/lifecycle.feature:91` "An apply keeps the hooks of the plugins in both scopes running" and `:70` "A load keeps the hooks of the plugins in both scopes running" | X1 fails `:70` and `:91`; X2 (apply-only) fails `:91` alone |

**`hooks-additionalcontext-end-to-end.test.ts` (2 cases, delete the file)**

| Case | Asserts | Visible | Replacement | Breaks |
|---|---|---|---|---|
| `:196` HOOK-E2E-03 | the SessionStart stdout envelope is buffered, the first `before_agent_start` returns `{customType: "claude-hook-additional-context", content: [...], display: false}`, the buffer drains, and the second turn returns `undefined` | the model receives the context once, on the first turn | **already covered**: `hook/additional-context.feature:140` "A session start hook's additional context reaches the model on the first turn" and `:205` "... stays in the history of the next turn" (the second turn has it only once, in the history). The hidden-message shape is unit-covered: `test/bridges/hooks/event-router.test.ts:1028`, `:1455`, `:1671` (`display: false`) | C1 fails `:140`; C2 fails `:205` |
| `:272` HOOK-E2E-04 | a second `registerHooksBridge` empties a buffer that the first load filled, and the drain returns `undefined` | yes (the prompt after the reload carries no SessionStart context) | `hook/additional-context.feature:230` "Reloading pi before the first prompt drops the session start hook's additional context" (title ID pending Open Question 1) | H4 fails it; H4a (control: a shared buffer, clear kept) passes; H4b fails it and `session.feature:391` |

**`hooks-dispatch-end-to-end.test.ts` (7 cases, keep `:403`)**

| Case | Asserts | Visible | Replacement | Breaks |
|---|---|---|---|---|
| `:186` HOOK-E2E-01 | a user-scope SessionStart entry survives the boot rebuild and dispatches | yes | the new WR-05 scenario `hook/session.feature:567` asserts the user plugin's SessionStart run (`source clear`, `CLAUDE_ENV_FILE {agent dir}/.../_shared/claude-env-first.env`). No earlier scenario asserts a user-scope SessionStart run: `session.feature:391` only waits for one in a `Given` | U1 fails `:567` on its `Then the hooks record these runs` |
| `:280` D-PG10-23 | a booted entry holds its record's options, and the hook dispatches | yes (the hook gets `CLAUDE_PLUGIN_OPTION_*`) | **covered**: `hook/process.feature:110` (a new session boots the entry from the record) | O1 fails `:110` |
| `:293` D-PG10-25 | a record whose `userConfig` is a string boots declared with no values, and dispatches | yes | **covered**: `hook/failures.feature:211` (the observer hook still runs, and the token hook fails as unreadable) | O2 fails `:211` |
| `:304` HOOK-E2E-02 | a project-scope SessionStart dispatches through the session_start lazy project hydrate | yes | **covered**: `hook/session.feature:7`, `plugin/session-start-hooks.feature:6` and `:19` | P1 fails all three |
| `:355` WR-05 | with only a user plugin, `session_start` leaves the pristine project cwd empty (`readdir` is `[]`) | yes (no `.pi` in the user's project) | `hook/session.feature:567` "A user plugin's session start hook leaves a project with no .pi directory empty (WR-05)", with a NEW whole-directory step `the project directory is empty` | W1 fails it on that step |
| `:403` | a ctx with no `cwd` (the hydrate throws) still dispatches the user entry | internal (a malformed host context) | **stays** (CONTEXT, ROADMAP) | — |
| `:450` | in a child, PostToolUse and PostToolUseFailure stdin hold `tool_use_id`, the response or error, `is_interrupt`, `agent_type`, and `agent_id` | yes | **covered**: `plugin/subagent-child.feature:406` Outline (4 rows `:442-445`, `@mcp`) and `:207` | CH1 (failure payload) and CH2 (success payload) fail all 4 rows under adapter and under builtin |

**`auth-e2e.test.ts` (7 cases, keep `:204`)**

| Case | Asserts | Visible | Replacement | Breaks |
|---|---|---|---|---|
| `:169` print add | rejects with `DeviceFlowUnavailableError` and its exact text, empties the staging root, leaves `state.json` bytes, writes no config and no `sources/`, notifies nothing, one `info/refs` request, `fill` once, no Device Flow call | yes | `marketplace/device-flow.feature:327` "Adding a private GitHub marketplace in pi's print mode refuses with the remedy and leaves the scope as it was (D-BG-1101)": the exact stderr, exit 0, no stdout, one 401 request, no sign-in request, one routed request, and the **whole project scope unchanged** (a url marketplace added first, so `state.json`, `claude-plugins.json`, `sources/`, and the empty `sources-staging/` already exist) | R1, R2, R3, E2 |
| `:179` orchestrated print add | an orchestrated add returns `{status: failed, reason: unreadable, cause: <remedy>}` and cleans staging | the outcome fields are internal (print mode shows no row), but the leftover clone is not | `device-flow.feature:351` "Applying a config that declares a private GitHub marketplace in pi's print mode adds nothing and leaves no staged clone (D-BG-1101)": exit 0, prints nothing (the accepted Pi limitation), the config still declares `tools`, no record, no checkout (`sources/` and `sources-staging/` both empty), no git clones | R1, R2 |
| `:204` | an `fs.rm` failure on the staging dir keeps the refusal as the primary cause | internal (fault injection) | **stays** (CONTEXT) | — |
| `:232` | a real `clone()` rethrows the refusal from `onAuthRequired` and does not turn it into a cancel | yes, through the remedy text | `:327` (the stderr shows the remedy only if the refusal survives the clone) | R3 fails `:327` |
| `:332` AUTH-01 | a fill miss runs Device Flow and approves the token | yes | **covered**: `device-flow.feature:10` (prompt row, sign-in requests, credential store) | E4 fails `:10` (and new `:287`) |
| `:373` AUTH-02/08 | a fill hit returns the stored credential, with no Device Flow | yes | **covered**: `device-flow.feature:49` (an update after sign-in: no sign-in request), `:231` (background update with a stored credential) | E3 fails `:49` and `:231` |
| `:412` AUTH-07 | `onAuthFailure` evicts the stale credential and returns `cancel`, and the next `onAuth` (a fill miss) runs Device Flow again and approves | yes | `device-flow.feature:256` "Adding a GitHub marketplace whose host rejects the stored credential fails as authentication required and removes the credential (AUTH-07)" and `:287` "After the GitHub host rejected the stored credential, the next add signs in through Device Flow again (AUTH-07)" | E1 fails both; E2 fails `:287` |

**Counts.** 17 cases. Delete 15. Keep 2: `hooks-dispatch-end-to-end:403` and `auth-e2e:204`. Delete two files: `hooks-cross-scope-reconcile` and `hooks-additionalcontext-end-to-end`.

### Helpers after the trim (tsc `noUnusedLocals`/`noUnusedParameters` are on, `tsconfig.json:13-14`)

- `hooks-dispatch-end-to-end.test.ts` keeps `:403` with `makeMockPi`, `buildStateWithHooksPlugin`, `E2E_SESSION`, `HOOKS_JSON_BYTES`, `withHermeticPiHome`, `seedHooksPlugin`, `ExecutorCall`, `recordingExecutor`, `findSessionStartHandler`, `SESSION_START_EVENT`, and the hydration imports. These go: `bootWithRecordedOptions`, and `readFile` and `readdir` from `node:fs/promises`. The `userConfig` parameter of `seedHooksPlugin`/`buildStateWithHooksPlugin` loses its callers. tsc does not flag it, because the body uses it, so drop it for clarity. The new header says that the file keeps the throwing-hydrate dispatch as an internal case (a host context with no `cwd`), and that `features/hook/session.feature` and `plugin/session-start-hooks.feature` cover what a user sees.
- `auth-e2e.test.ts` keeps `:204` with `createPrintAdd`, `assertPrintRefusal`, `assertUncommittedPrintAdd`, `fs` (default import, for the `rm` mock), `readFile`, `readdir`, `join`, `http`, `addMarketplace`, `locationsFor`, `loadState`, `saveState`, `createCompletionCache`, `DeviceFlowUnavailableError`, `createDeviceFlowFake`, `createCredentialOpsFake`, `createHermeticEnvironment`, `runWithNothingLoaded`, and the types `AddMarketplaceOptions`, `GitHttpRequest`, and `GitHttpResponse`. These go: `mkdtemp`, `rm`, `tmpdir`, `initiateDeviceFlow`, `buildAuthCallbacks`, `clone`, `notifyDeviceFlowPrompt`, `NotifyCall`, `makeNotifyCapture`, `deviceCodeResponse`, `successfulPoll`, and the types `DeviceCodeResponse`, `InitiateDeviceFlowOpts`, `PollResult`, and `NotificationContext`. The new header says that the file keeps the cleanup-failure fault injection (ITSCOPE-01) and that `features/marketplace/device-flow.feature` covers the print refusal, AUTH-01, AUTH-02/08, and AUTH-07.
- `test/domain/device-flow-fake.ts` and `test/platform/credential-ops-fake.ts` stay, because the kept case uses both.
- Measured: the four files run 17 tests in 3.5 s today.

### Existing steps used (file:line, read this session)

| Step | Module |
|---|---|
| `the published plugin {string} of the marketplace {string} has these hooks, each recording its runs:` | `hook/runs.steps.ts:126` |
| `the hooks record these runs:` / `... in any order:` | `hook/runs.steps.ts:164` / `:169` |
| `the user starts a new pi session with the hooks recording` | `hook/session.steps.ts:413` |
| `the user reloads pi in the terminal and then prompts {string}` (starts its own scripted TUI, reloads, sends a turn) | `session.steps.ts:148` |
| `the user has started a new pi session`, `the user prompts {string}` | `session.steps.ts:74`, `:109` |
| `the model receives these calls:` | `model.steps.ts:135` |
| `the user has run {string}` / `..., which failed` | `command.steps.ts:91` / `:97` |
| `github's sign-in answers its polls with these outcomes:`, `pi runs with github's requests routed to the stand-ins` | `git-host.steps.ts:234`, `:250` |
| `the git host requires the user {string} with the password {string} for the {git repository}` | `git-host.steps.ts:141` |
| `the user has stored a credential for github.com with the user {string} and the password {string}` (writes `.gitconfig` with `wx`, so it cannot follow `the user's git keeps credentials in its credential store`) | `marketplace/device-flow.steps.ts:21-39` |
| `the user's git credential store holds these credentials:` / `holds no credentials` | `marketplace/device-flow.steps.ts:54`, `:72` |
| `the git host receives these requests:`, `github's sign-in receives these requests:` / `no request`, `pi routes these github requests:` | `git-host.steps.ts:268`, `:284`, `:297`, `:303` (each reads only the last `When`'s window, `support/https-git-host.ts:13-16`, `world.ts:517`) |
| `the files of the {word} scope are remembered` / `are unchanged` (lists every entry, directories included) | `scope-state.steps.ts:63` / `:70` |
| `the {word} scope holds no marketplace checkout` (`sources/` and `sources-staging/` both empty) / `holds no marketplace record` | `marketplace/checkout.steps.ts:118` / `:140` |
| `the {word} scope holds no git clones` | `plugin/installation.steps.ts:636` |
| `the {string} file of the {word} scope does not exist` / `declares these marketplaces:` | `config.steps.ts:286` / (same module) |
| `a config in scope {word} and layer {word}, with these marketplaces:` (columns `name`, `source`, `autoupdate`) | `config.steps.ts:189` |

### New steps and harness changes (validated in tree, then reverted)

| # | Change | Module | Owner plan |
|---|---|---|---|
| S1 | `When the user runs {string} in pi's print mode` | `command.steps.ts` (beside the json and terminal forms) | 06-02 |
| S2 | `Then pi's print mode exits with code {int} and prints this error:` (doc string; compares exit code, empty stdout, and the whole stderr) | `command.steps.ts` | 06-02 |
| S3 | `Then pi's print mode exits with code {int} and prints nothing` | `command.steps.ts` | 06-02 |
| S4 | `Then the project directory is empty` (`readdir(projectDir)` is `[]`; `Before()` empties the project, `features/support/pi-process.ts:228-236`) | `project.steps.ts` | 06-01 |
| L1 | NEW `features/lib/pi-one-shot.ts`: `OneShotLaunch`, `OneShotOutput`, `runOneShotPi(launch, "json" \| "print", command, onRelease, timeoutMs)` | lib | 06-02 |
| L2 | `features/lib/pi-json-mode.ts` delegates to `runOneShotPi`; `JsonModeLaunch = OneShotLaunch` | lib | 06-02 |
| W1 | `world.ts`: `OneShotPiLaunch.extensions`; `oneShotPiLaunch()` returns `git: this.tuiEnvironment ?? piEnvironment` and `extensions: this.tuiExtensions` (the routed launch that `keepTerminalSessionLocal` stores, `world.ts:1105-1121`); public field `printModeRun: OneShotOutput \| undefined` | support | 06-02 |
| F1 | `features/lib/hook-files.ts:681` treats `ESRCH` as gone in `isRegisteredHookProcess` | lib | 06-01 |
| F2 | `features/lib/turn-records.ts:37-39` `logLines` keeps only newline-terminated lines | lib | 06-01 (Open Question 3) |

Validated with the changes in tree: `npx tsc --noEmit -p .` exit 0; ESLint `--max-warnings 0` on the changed files exit 0 (after moving the `pi-one-shot.ts` type import above `pi-process.ts`, which `import-x/order` requires); `npx prettier --check` clean; `npm run fallow` exit 0 (the separate print-driver copy failed `fallow dupes` first). On a scratch copy of the tree with the drafts appended, `node scripts/check-features.mjs` exited 0. The tree's own feature files were not changed. The drafts ran green against the in-tree steps (8/8 in 20 s). The json-mode, owner, and async features also ran against them: `bootstrap`, `session-end`, `async`, `device-flow`, `lifecycle`, `additional-context`, `session`, and the `subagent-child` json rows, 107/108 plus 28/28. The one failure was the F2 race, found then (see the Async flake section). The full patch is `research-06/intree-final.diff`: steps, lib, world, and fixes in `intree-steps.diff`, and the feature appends in `intree-features.diff`.

The **print driver's routed launch** matters for safety. A one-shot Pi that started with the routed git environment but without the redirect would reach GitHub's real address. W1 and L1 avoid that: the launch carries both or neither. The json driver now also loads `launch.extensions`, so a routed json one-shot is safe too. Today no routed scenario uses json mode.

### Anti-patterns to avoid

- **The scratch drafts' feature header.** Each draft file under `research-06/final/` starts with a `Feature: Draft ...` line, and `lifecycle.feature` repeats the Background. Append only the scenario bodies, from the first `  Scenario`, to the owner files. `lifecycle.feature` already has that Background.
- **Pairing `the user has stored a credential for github.com ...` with `the user's git keeps credentials in its credential store`.** Both write `.gitconfig` with `wx`, so the second fails. The stored-credential step already sets the `store` helper.
- **A second `When` for the `apply`.** `features.md` asks for one `When`, so the apply is `Given the user has run "/claude:plugin apply"`. Its `reconcile-pending-empty` result is info. The prompt is the `When`.
- **The whole-scope check on a fresh scope for the print add.** The refusal creates an empty `pi-claude-marketplace/sources-staging/`. A success leaves one too (measured). On a scope with no prior checkout, `the files of the project scope are unchanged` fails for that empty directory. The `:327` draft first adds a url marketplace, so the scope already holds `sources-staging/`. The orchestrated draft `:351` uses the absence steps instead.
- **A print-mode `When` without the redirect.** Never start a one-shot Pi with the routed git environment unless the GitHub redirect is in its extensions (W1).
- **Breaks only in `extensions/`.** The Phase 5 `break.sh` restores `extensions/` only. F1 and F2 are fixes, not breaks; commit them, never revert them with a break.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| A second spawn-and-wait loop for print mode | a copy of `pi-json-mode.ts` | `runOneShotPi` in `pi-one-shot.ts` | `fallow dupes` fails on the 27-line clone (measured) |
| A GitHub sign-in in a test | a fake `fetch` | `github's sign-in answers its polls ...` + `pi runs with github's requests routed to the stand-ins` | D-BG-1101; the redirect logs every request |
| A stale stored credential | a hand-written `.git-credentials` | `the user has stored a credential for github.com with the user ... and the password ...` | It writes the `store` helper config too, and registers its release |
| "Leaves nothing" for the print add | narrow file checks | the whole-scope remembered/unchanged pair, on a scope that already holds a checkout | CONTEXT [Unchanged checks] |
| "No `.pi`" | `the "..." file ... does not exist` | S4, `the project directory is empty` | A whole-directory check; the integration case read the whole cwd |
| `/reload` | an RPC request | `the user reloads pi in the terminal and then prompts {string}` | Pi offers `/reload` only in the terminal (RPC has no reload command, Pi `dist/modes/rpc/rpc-mode.js:314-562`) |

## Runtime State Inventory

Not a rename or migration phase. Nothing is renamed. The phase adds scenarios, two test-harness fixes, and a test library, and it deletes or trims tests. No stored data, live service config, OS registration, secret, or build artifact changes.

## Common Pitfalls

### Pitfall 1: The reload clear is defensive in production
Pi builds a fresh extension runtime on `/reload` (`moduleCache: false`), so `runtime.preparePendingContextForRegistration()` (`event-router.ts:1396`) never has anything to clear in production. Removing the clear alone breaks nothing (H4a, the control). The H4 break also makes the buffer survive a reload, with a `globalThis` buffer and no drain, and the scenario fails. Record both in the SUMMARY, so a reviewer sees why the break has two edits.

### Pitfall 2: A break that removes Device Flow also removes the print refusal
`E2` (`onAuth` never calls `onAuthRequired`) fails the print scenario `:327` too, because the print refusal is thrown inside `onAuthRequired` (`auth-host.ts:197`). Expected; name it in the SUMMARY.

### Pitfall 3: Two parallel executors on 4 CPUs
Use `--parallel 1` per executor, or the shared flock that Phase 5 used (`scratchpad/phase05-heavy.lock`; make a `phase06-heavy.lock`). Measured at `--parallel 2` on an otherwise idle machine: every break run took 13-21 s, and the 8 drafts took 20 s.

### Pitfall 4: The two harness races hit any gate
F1 failed `async.feature:261` in 2 of 4 Phase 5 runs and in 1 of 1 instrumented run here. F2 failed `async.feature:538` once in a 108-scenario run. Land F1 (and F2, if accepted) before the phase gate, as the first commit of 06-01.

### Pitfall 5: Break verify commands
A failed scenario prints as `  N) <title> # <file>:<line>`. An Outline row prints its Examples line (`subagent-child.feature:442-445`). A `file:line` filter must point at a `Scenario:` line, and the run must not print `0 scenarios`. The Phase 5 checker (`plan-05/inputs/check-red.mjs`) applies as is: every break here edits `extensions/` only, and every failure is on a `Then`.

### Pitfall 6: Scratch paths in failure lines
A draft run from outside the tree prints `../../../tmp/.../research-06/final/<file>`. In-tree runs print `features/...`. Use in-tree lines in the plan.

## Code Examples

The validated in-tree code, from `research-06/intree-steps.diff`. Imports are verified by tsc: `runOneShotPi` and `OneShotOutput` (`features/lib/pi-one-shot.ts`), `projectTokens` and `expandTokens` (`features/lib/run-tokens.ts`, already imported in `command.steps.ts:38`), `piArguments`, `killProcessGroup`, `resolveRpcSandbox`, and `rpcChildEnvironment` (`features/lib/pi-rpc.ts:162`, `:192`, `:254`, `:274`).

```ts
// features/lib/pi-one-shot.ts (NEW) -- the core; see the diff for the doc comments.
export interface OneShotLaunch {
  readonly sandbox: RpcSandbox;
  readonly git: RpcGitEnvironment;
  readonly environment: RpcProfileEnvironment;
  readonly extensions: readonly string[];
}
export interface OneShotOutput {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}
// json: `--mode json` + command; print: the terminal form (no --mode) + `-p` + command.
function oneShotArguments(mode: "json" | "print", extensions: readonly string[], command: string): string[] {
  const loaded = [SCRIPTED_MODEL_EXTENSION, ...extensions];
  return mode === "json"
    ? [...piArguments("json", loaded), ...SCRIPTED_MODEL_ARGUMENTS, command]
    : [...piArguments("tui", loaded), ...SCRIPTED_MODEL_ARGUMENTS, "-p", command];
}
export async function runOneShotPi(launch, mode, command, onRelease, timeoutMs): Promise<OneShotOutput> {
  // the spawn (detached, stdin "ignore", rpcChildEnvironment), killGroup handed to onRelease,
  // once(child, "close", { signal: AbortSignal.timeout(timeoutMs) }), finally killGroup() --
  // moved unchanged from pi-json-mode.ts; the error says `${command} in ${mode} mode ...`.
}

// features/step_definitions/command.steps.ts
const PRINT_MODE_MS = 25_000;
When("the user runs {string} in pi's print mode", async function (this: ScenarioWorld, command: string) {
  this.printModeRun = await runOneShotPi(await this.oneShotPiLaunch(), "print",
    expandTokens(command, this.tokens), (release) => { this.onRelease(release); }, PRINT_MODE_MS);
});
Then("pi's print mode exits with code {int} and prints this error:",
  function (this: ScenarioWorld, exitCode: number, text: string) {
    assert.deepStrictEqual(printModeOutput(this), { exitCode, stdout: "", stderr: `${text}\n` });
  });
Then("pi's print mode exits with code {int} and prints nothing", function (this: ScenarioWorld, exitCode: number) {
  assert.deepStrictEqual(printModeOutput(this), { exitCode, stdout: "", stderr: "" });
});

// features/step_definitions/project.steps.ts (imports gain `readdir` and `Then`)
Then("the project directory is empty", async function (this: ScenarioWorld) {
  assert.deepStrictEqual(await readdir(this.tokens.projectDir), []);
});

// features/lib/hook-files.ts:680 (F1)
    if (error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ESRCH")) {
      return false;
    }

// features/lib/turn-records.ts:37 (F2)
async function logLines(file: string): Promise<string[]> {
  const text = await readFile(file, "utf8");
  return text.slice(0, text.lastIndexOf("\n") + 1).split("\n").filter((line) => line !== "");
}
```

### The drafts (green; in-tree landing lines)

`hook/lifecycle.feature` (in its Background: `demo@fixtures` in the project with `guard | PreToolUse | Bash`):

```gherkin
  Scenario: A load keeps the hooks of the plugins in both scopes running
    Given the marketplace "shared" is published as a dir source
    Given the marketplace "shared" offers these plugins:
      | name  | version |
      | audit | 1.0.0   |
    Given the published plugin "audit" of the marketplace "shared" has these hooks, each recording its runs:
      | name  | event      | matcher |
      | watch | PreToolUse | Bash    |
    Given the marketplace "shared" is added to the user scope
    Given the user has run "/claude:plugin install audit@shared --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs in any order:
      | event      | session | tool name | tool use id  | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {tool use 1} | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PreToolUse | first   | Bash      | {tool use 1} | {"command":"echo from-model"} | {project dir} |                 | watch     | {project dir}      | {home}/marketplaces/shared/plugins/audit  | {agent dir}/pi-claude-marketplace/data/shared/audit        | first                  | first             | 1          |

  Scenario: An apply keeps the hooks of the plugins in both scopes running
    (the same Givens, then:)
    Given the user has run "/claude:plugin apply"
    When the user prompts "run the echo"
    Then the hooks record these runs in any order:
      (the same two rows)
```

`hook/session.feature:567`:

```gherkin
  Scenario: A user plugin's session start hook leaves a project with no .pi directory empty (WR-05)
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event        | matcher |
      | start | SessionStart | *       |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    When the user starts a new pi session with the hooks recording
    Then the hooks record these runs:
      | event        | session | source | model  | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                   | CLAUDE_ENV_FILE                                                     | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | SessionStart | first   | clear  | faux-1 | {project dir} |                 | start     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {agent dir}/pi-claude-marketplace/data/fixtures/demo | {agent dir}/pi-claude-marketplace/data/_shared/claude-env-first.env | first                  | first             | 1          |
    Then the project directory is empty
```

`hook/additional-context.feature:230`:

```gherkin
  Scenario: Reloading pi before the first prompt drops the session start hook's additional context (D-CF5-13)
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event        | matcher | form   | output                                                                               |
      | primer | SessionStart |         | script | {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"ss-ctx"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the scripted model plays these steps:
      | reply | tool | arguments |
      | Done. |      |           |
    When the user reloads pi in the terminal and then prompts "hello there"
    Then the model receives these calls:
      | call | role | text        |
      | 1    | user | hello there |
```

`marketplace/device-flow.feature:256`, `:287`, `:327`, `:351`. The full text is in `research-06/final/device-flow.feature`, with the `autoupdate` column already added to `declares these marketplaces:`. The key Thens:

```gherkin
  # :256 (AUTH-07, evict) -- stored "x-access-token"/"expired-token"; poll script: authorization_pending
    When the user runs "/claude:plugin marketplace add acme/tools --scope user"
    Then the result has these fields:      kind cascade | severity error | needs reload false | summary A marketplace operation has failed.
    Then the result lists these marketplaces:  acme/tools | user | failed | authentication required
    Then the git host receives these requests:  GET info/refs 401 | GET info/refs 401
    Then github's sign-in receives no request
    Then pi routes these github requests:  GET info/refs -> git host (twice)
    Then the user's git credential store holds no credentials
    Then the "claude-plugins.json" file of the user scope does not exist
    Then the user scope holds no marketplace record
    Then the user scope holds no marketplace checkout
  # :287 (AUTH-07, sign in again) -- poll: authorization_pending, authorized
    Given the user has run "/claude:plugin marketplace add acme/tools --scope user", which failed
    When the user runs "/claude:plugin marketplace add acme/tools --scope user"
    Then the command reports these results:  device-flow-prompt (https://github.com/login/device, WDJB-MJHT) | cascade info
    Then the results list these marketplaces and plugins:  tools | user | added
    Then the git host receives these requests:  401 | 200 | POST 200
    Then github's sign-in receives these requests:  device/code | access_token | access_token
    Then pi routes these github requests:  (6 rows, as device-flow.feature:37-44)
    Then the user's git credential store holds these credentials:  https | github.com | x-access-token | stand-in-access-token
  # :327 (print add) -- Given url marketplace "fixtures" added to the project; remembered
    When the user runs "/claude:plugin marketplace add acme/tools --scope project" in pi's print mode
    Then pi's print mode exits with code 0 and prints this error:
      """
      Extension error (command:claude:plugin): Device-flow authentication is unavailable in print mode. Retry with --mode json or interactive Pi.
      """
    Then the git host receives these requests:  GET info/refs 401
    Then github's sign-in receives no request
    Then pi routes these github requests:  GET info/refs -> git host
    Then the files of the project scope are unchanged
  # :351 (print apply) -- Given a config in scope project and layer base declares tools/acme/tools/false
    When the user runs "/claude:plugin apply --scope project" in pi's print mode
    Then pi's print mode exits with code 0 and prints nothing
    Then the git host receives these requests:  GET info/refs 401
    Then github's sign-in receives no request
    Then pi routes these github requests:  GET info/refs -> git host
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:  tools | acme/tools | false
    Then the project scope holds no marketplace record
    Then the project scope holds no marketplace checkout
    Then the project scope holds no git clones
```

The `:351` title should also name the Pi gap, for example "..., and pi's print mode shows nothing, a Pi gap (D-BG-1101)". Titles in `hook/mcp-tool-names.feature:210` follow that precedent.

## Deliberate breaks (each applied, run, and reverted in this session)

The edit definitions are in `research-06/breaks.py`, and the `break.sh`-compatible JSON (`[file, old, new]` triples under `extensions/pi-claude-marketplace/`) is in `research-06/breaks-json/<ID>.json`. Logs are in `research-06/logs/brk-<ID>-<profile>.log`. Each old text matched exactly once. Every failure listed was on a `Then`, confirmed in each log. The profile is adapter unless noted. `G` means `(globalThis as any).__pcmScope`.

| ID | Site (HEAD line) | Edit | Failed |
|---|---|---|---|
| X1 | `orchestrators/reconcile/read-pass.ts:526` + `bridges/hooks/event-router.ts:502` | set `G = scope` before each per-scope rebuild; `collectAllCachedPlugins` keeps only `e.scope === G` (the original cross-scope wipe) | `lifecycle :70`, `:91` |
| X2 | `orchestrators/reconcile/apply.ts:2395` + `event-router.ts:502` | the same, set only in apply's per-scope close | `lifecycle :91` only (the load scenario passes) |
| H4 | `bridges/hooks/runtime.ts:326` + `:434` | buffer on `globalThis` (survives the reload) and no drain on registration | `additional-context :230` (model call 1 gains `SessionStart hook additional context: ss-ctx`) |
| H4a | `runtime.ts:326` only | the `globalThis` buffer, drain kept | **nothing** (control: the registration clear guards it) |
| H4b | `event-router.ts:1499` | run SessionStart on `reload` | `additional-context :230`; `session.feature:391` |
| W1 | `event-router.ts:1187` | `if (true)`: prepare `_shared` for every scope | `session :567` (`the project directory is empty`) |
| U1 | `event-router.ts:839` | do not boot user-scope entries | `session :567` (`Then the hooks record these runs`) |
| P1 | `event-router.ts:1473` | skip the session_start lazy project hydrate | `session.feature:7`, `plugin/session-start-hooks.feature:6`, `:19` |
| O1 | `event-router.ts:849` | `recordedOptionsOf({})` | `process.feature:110` |
| O2 | `event-router.ts:839` | skip a record whose options are unreadable | `failures.feature:211` |
| C1 | `bridges/hooks/event-adapters.ts:801` | do not append SessionStart context | `additional-context.feature:140` |
| C2 | `event-router.ts:390` | read the buffer without draining it | `additional-context.feature:205` |
| CH1 | `bridges/hooks/payloads/post-tool-use-failure.ts:80` | drop `agent_type`/`agent_id` | `subagent-child.feature:442-445` (adapter **and** builtin) |
| CH2 | `bridges/hooks/payloads/post-tool-use.ts:84` | the same for PostToolUse | `subagent-child.feature:442-445` (adapter and builtin) |
| E1 | `platform/git-auth-callbacks.ts:251` | do not `reject` the stale credential | `device-flow :256` (store still holds it), `:287` |
| E2 | `git-auth-callbacks.ts:209` | `onAuth` never runs Device Flow | `device-flow :287`, `:327` (Pitfall 2) |
| E3 | `git-auth-callbacks.ts:199` | ignore a fill hit | `device-flow.feature:49`, `:231` (AUTH-02/08) |
| E4 | `domain/github-auth.ts:362` | do not `approve` the new token | `device-flow.feature:10` (AUTH-01), `:287` |
| R1 | `orchestrators/auth-host.ts:197` | no print refusal (Device Flow runs in print mode) | `device-flow :327`, `:351` (sign-in requests appear; stderr empty) |
| R2 | `orchestrators/marketplace/add.ts:1813` | skip the staging cleanup | `device-flow :256`, `:327`, `:351` |
| R3 | `git-auth-callbacks.ts:220` | turn the refusal into a cancel | `device-flow :327` (stderr empty) |

In the table, `lifecycle :NN`, `session :NN`, `additional-context :NN`, and `device-flow :NN` mean the in-tree landing lines above. The break runs used the scratch files. The executors re-run each break from their worktrees with `break.sh`, which roots itself at `git rev-parse --show-toplevel`.

**Gaps:** none. Every replaced or already-covered case has a break that fails a `Then`.

## The [Async flake] (`features/hook/async.feature:261`)

**Captured.** I added a scratch-only instrumentation to `ScenarioWorld.release` (`world.ts:1042-1054`) that prints each inner error, then ran the full adapter suite with `fd` on `PATH` (619 s; 2259 scenarios, 2258 passed). `async.feature:261` failed in its After hook, as in Phase 5. The one inner error:

```
[release-probe] release failed: async () => {
      await pi.stop();
      await stopHookScripts(harness, hookGate, [this.scopeRoot("user"), this.scopeRoot("project")]);
      await assertStandInsStopped(harness);
    }
[release-probe] error: Error: ESRCH: no such process, open '/proc/7720/environ'
    at async isRegisteredHookProcess (features/lib/hook-files.ts:676:21)
    at async stopRegisteredHookProcess (features/lib/hook-files.ts:690:9)
    at async stopHookScripts (features/lib/hook-files.ts:747:7)
    at async features/support/world.ts:1228:7
    at async ScenarioWorld.release (features/support/world.ts:1046:9)
```

**Cause: a harness race, not a product bug.** The "slow" hook (`async: true, timeout: 1, sleep: 3, exit code: 3`) writes its `end` lifecycle line from its EXIT trap (`hook-files.ts:427-433`), runs `rm -f "$pidfile"`, and exits. The scenario's last `Then` reads that `end` line, and the release stops Pi at once. When Pi dies before it reaps the hook, the exited hook becomes a zombie whose new parent is PID 1 (`/process_api`). Measured: PID 1 leaves an orphan zombie in place for over 1 s, and it is gone after 5 s. The bridge's PID table still lists the hook, because the entry is removed only once Pi sees the exit (`bridges/hooks/async-rewake/registry.ts:463-496`). `isRegisteredHookProcess` then reads `/proc/<pid>/environ` of the zombie, which fails with `ESRCH`. It treats only `ENOENT` as gone (`hook-files.ts:680-685`), so the error escapes. This is the race that 2c7d42d fixed in `features/lib/subagent-hook-session.ts:300-314`. It needs load: 8 runs of the scenario alone, under six busy-loop CPU hogs, all passed.

**Deterministic repro:** `research-06/zombie-repro.ts`. It makes an orphan zombie, lists it in a scope's `async-rewake-pids.json`, opens a gate, and calls `stopHookScripts`. At HEAD it prints `stopHookScripts threw: ESRCH: no such process, open '/proc/<pid>/environ'`. With F1 it prints `stopHookScripts: ok`.

**Fix (F1), owner 06-01:** treat `ESRCH` like `ENOENT` in `isRegisteredHookProcess`, with a comment, as 2c7d42d did. A zombie runs nothing, so not killing its group is right. Its group has no live member, because Pi starts each hook as the leader of a group of its own. The only other `/proc/*/environ` reads in `features/` already tolerate this: `real-subagent-child.ts:587` catches everything, and `subagent-hook-session.ts:303` has the 2c7d42d fix. Proof for the SUMMARY: the repro before and after, then `async.feature` green, then repeated full adapter runs, as CONTEXT asks. Measured here: a full adapter run with F1, F2, and the 06-02 harness changes in tree passed 2259/2259 in 626 s (`research-06/logs/full-f2.log`). One green run is evidence, not proof, at a failure rate of about 1 in 2, so the executor runs at least two more.

**Residual risk (not seen):** if the release ever kills a lifecycle hook before its trap removes the pid file, `assertStandInsStopped` (`turn-records.ts:132-142`) counts the zombie as running (`process.kill(pid, 0)` succeeds on a zombie) until PID 1 reaps it, and the wait is up to 10 s. Measured reaping took under 5 s. No change is proposed.

**Second race found (F2):** an in-tree run failed `async.feature:538` once in its `When`, with `SyntaxError: Unterminated string in JSON at position 1694` at `turn-records.ts:62`, through `waitForHookLifecycle` (`hook-recorder.ts:191`). `logLines` (`turn-records.ts:37-39`) parses every line, including a last line whose `appendFileSync` (`hook-recorder.ts:106`) a reader saw half done. `research-06/partial-line-repro.ts` shows that a log ending in an unterminated line throws at HEAD. With F2, `logLines` keeps only the lines that end in a newline, so the repro returns the complete line. `readLogLengths` uses the same function, so the counts stay consistent.

## State of the Art

| Old approach | Current approach | Impact |
|---|---|---|
| Mock `pi.on` registrations and a placeholder `ctx` | a real profile Pi, real hook processes, the scripted model | Two-scope routing, the reload, and WR-05 are seen as a user sees them |
| `t.mock.method(http, "request")` returning 401 | the run's https git host with a credential arm, the Device Flow stand-in, and the in-process redirect | The rejection, eviction, and new sign-in are real git and credential-store traffic |
| Calling `addMarketplace` with `ctx.mode = "print"` | `pi -p` in the sandbox | Pi's own print-mode behavior: a no-op notify, the stderr line, exit 0 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | In Claude Code, SessionStart `additionalContext` is part of the session, and `/reload-plugins` (which keeps the session, D-CF5-03) does not remove it, so the first prompt after a reload still carries it `[ASSUMED]` | Open Question 1 | If upstream also drops it, the drop is parity and needs no license |
| A2 | `features/lib/pi-one-shot.ts` is an acceptable library name under `layout.md` ("name the kind": one-shot Pi) `[ASSUMED]` | New steps | Rename to `pi-print-mode.ts` and keep the shared runner there; `check:features` passed with this name |
| A3 | Routing the json one-shot launch the same way as print is acceptable, though no routed json scenario exists | W1 | Without it, a future routed json scenario would reach GitHub's real address |

## Open Questions

1. **HOOK-E2E-04 is a parity question.** The drafted scenario passes: a `/reload` before the first prompt drops the buffered SessionStart context. `docs/hooks-compatibility.md:449` documents this ("Each bridge load, `/reload` included, empties the context that waits for the next prompt"). The code comment at `runtime.ts:430` cites D-CF5-13. But D-CF5-13 itself (`PROJECT.md:2273`) says "every event's `additionalContext` reaches the model ... SessionStart context past the first turn". And D-CF5-03 (`PROJECT.md:2263`) makes Pi's `/reload` keep the session, as upstream `/reload-plugins` does. So the drop loses context inside one session. Upstream probably keeps it (A1). The ROADMAP criterion and ITMIG-12 both say "drops". No recorded decision ID licenses a divergence from upstream.
   - Recommendation: ask the user one question before the plan locks the title. "Pin the documented drop, licensed by `docs/hooks-compatibility.md:449`, under D-CF5-13 or a new ID? Or treat it as a bug (rule 4: keep the buffer across a reload)?" If the user confirms the drop, title it as drafted, with the ID the user names.
2. **The print `apply` scenario (`:351`) pins print-mode silence.** It is licensed by the accepted Pi limitation (`PROJECT.md:476-482`: "Print mode therefore stays silent -- a Pi limitation, accepted"). Recommendation: include it, and name the Pi gap in the title. The alternative is to keep `auth-e2e:179` for Phase 8 as an internal outcome check.
3. **F2 (partial JSONL line) is outside the CONTEXT [Async flake] item.** It sits in the hook harness, it was observed once, and the fix has 5 lines. Recommendation: fix it in 06-01 beside F1, and record both in the SUMMARY.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v24.22.3 | — |
| non-DAC shell wrapper | npm scripts | ✓ | `scratchpad/nondac-sh` | CI runs as non-root |
| `fd` | full-suite runs (`hook/tool-use.feature` Glob scenarios) | ✓ as `fdfind`; symlink at `research-06/bin/fd` | 9.0.0 | put the symlink dir first on `PATH` |
| Device Flow stand-in, https git host, GitHub redirect | auth scenarios | ✓ (in-repo harness) | — | — |
| pi-mcp-adapter test peer | adapter profile | ✓ | 7.0.1 | — |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `@cucumber/cucumber` ^13.3.0 (behavior); `node:test` (integration) |
| Config file | `cucumber.json` (profiles `adapter`, `builtin`) |
| Quick run command | `<prefix> npm run test:cucumber:profile -- --profile adapter --parallel 2 features/hook/lifecycle.feature features/hook/session.feature features/hook/additional-context.feature` (06-01); `... features/marketplace/device-flow.feature` (06-02) |
| Integration files | `node --import "$PWD/scripts/isolated-pi-home.mjs" --test test/integration/hooks-dispatch-end-to-end.test.ts test/integration/auth-e2e.test.ts` (today, with all four files: 17 tests in 3.5 s) |
| Harness repros | `node research-06/zombie-repro.ts` (F1), `node research-06/partial-line-repro.ts` (F2) |
| Full suite command | `npm run check` (with the prefix; `fd` on `PATH`) |

Measured times (`--parallel 2`; each owner file's drafts):

| Run | adapter | builtin |
|---|---|---|
| 8 drafts together | 8 scenarios, 20-21 s | 0 scenarios, 4 s |
| each break run (1-5 scenarios) | 13-21 s | 15-16 s (CH1, CH2) |
| owner + json-mode regression set (108 scenarios) | 139 s | — |
| full adapter suite | 2259 scenarios, 619 s | — |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ITMIG-12 | both scopes after a load and after apply | behavioral | quick run of `hook/lifecycle.feature` | ✅ (append) |
| ITMIG-12 | WR-05 (+ HOOK-E2E-01) | behavioral | quick run of `hook/session.feature` | ✅ (append) |
| ITMIG-12 | HOOK-E2E-04 | behavioral | quick run of `hook/additional-context.feature` | ✅ (append) |
| ITMIG-13 | AUTH-07, print add, print apply | behavioral | quick run of `marketplace/device-flow.feature` | ✅ (append) |
| both | kept internal cases | integration | the integration command above | ✅ (trim) |
| both | steps, layout, dead code, clones | static | `npm run check:features`, `npm run fallow`, `npx tsc --noEmit -p .`, `npm run lint` | ✅ |
| [Async flake] | F1, F2 | harness | the two repros, then `hook/async.feature` and full adapter runs | ❌ Wave 0 (fixes) |

### Sampling Rate
- **Per task commit:** the quick run of the touched owner file, plus `npm run check:static` (inside a worktree the hook may check nothing).
- **Per wave merge:** `npm run check`.
- **Phase gate:** `npm run check` green on the combined tree, with `async.feature:261` passing in repeated full adapter runs (CONTEXT). Each break is recorded in the SUMMARY with its `N) <title> # <file>:<line>` lines.

### Wave 0 Gaps
- [ ] F1 in `features/lib/hook-files.ts` (06-01, first commit), and F2 in `features/lib/turn-records.ts` (06-01, Open Question 3)
- [ ] S4 in `project.steps.ts` (06-01)
- [ ] L1 `pi-one-shot.ts`, L2 `pi-json-mode.ts`, W1 `world.ts`, and S1-S3 in `command.steps.ts` (06-02)

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (tests only) | The Device Flow and credential-eviction contract is tested, not changed. The stand-ins hold only fixed fake tokens, and the credential store lives in the sandbox HOME (D-BG-1102). |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | — |
| V6 Cryptography | no | — |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A test Pi reaching GitHub's real address | Information disclosure | Every auth scenario starts a routed Pi; the print step loads the same redirect (W1); `pi routes these github requests:` pins each request |
| A credential in output | Information disclosure | The scenarios compare whole outputs (AUTH-09); the stderr line names no credential |

## Sources

### Primary (HIGH confidence)
- Read this session: the four integration files; `features/hook/{additional-context,session,lifecycle,async}.feature`, `features/plugin/{session-start-hooks,subagent-child}.feature`, `features/marketplace/{device-flow,git-source}.feature`; the step modules `command`, `session`, `hook/session`, `hook/runs`, `git-host`, `scope-state`, `project`, `config`, `marketplace/device-flow`, and `marketplace/checkout`; `features/lib/{pi-json-mode,pi-rpc,hook-files,turn-records,github-device-flow/extension}.ts`; `features/support/world.ts`; the cucumber skill (`SKILL.md`, `layout.md`, `features.md`); the product sites in the break table; Pi 1.5.1 `dist/modes/print-mode.js`, `dist/core/agent-session.js:1782-1805` and `:3094-3134`, `dist/core/extensions/runner.js:136`, `dist/cli/args.js:145`, and `dist/main.js:84-95` and `:776-830`; `.planning/PROJECT.md:476-482`, `:2263`, `:2273`, `:2373`, and `:2408`; `docs/hooks-compatibility.md:135` and `:449`.
- Measured: every probe, draft, break, repro, and in-tree run, under `research-06/` (`logs/`, `dump/`, `timings.txt`, `batch1.log`).

## Metadata

**Confidence breakdown:**
- Scenarios and steps: HIGH. All ran green. The static gates, `check:features` included, passed with the changes in place.
- Breaks: HIGH. 22 of 23 failed their targets on a `Then`, and the one that passed is a planned control.
- [Async flake]: HIGH for the cause (captured in a full run, reproduced deterministically). The fix passed one full adapter run (2259/2259); CONTEXT asks for repeated runs, so the executor adds at least two.
- HOOK-E2E-04 title: MEDIUM (Open Question 1).

**Research date:** 2026-11-22
**Valid until:** 2026-12-22 (stable tree, no dependency changes)
