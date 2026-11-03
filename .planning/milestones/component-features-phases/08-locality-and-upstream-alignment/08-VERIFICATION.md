---
phase: 08-locality-and-upstream-alignment
verified: 2026-11-03T02:10:00Z
status: passed
score: 4/4 must-haves verified
covered_files:
  - .planning/phases/08-locality-and-upstream-alignment/08-01-PLAN.md
  - .planning/phases/08-locality-and-upstream-alignment/08-01-SUMMARY.md
  - .planning/phases/08-locality-and-upstream-alignment/08-02-PLAN.md
  - .planning/phases/08-locality-and-upstream-alignment/08-02-SUMMARY.md
  - .planning/phases/08-locality-and-upstream-alignment/08-03-PLAN.md
  - .planning/phases/08-locality-and-upstream-alignment/08-03-SUMMARY.md
  - .planning/phases/08-locality-and-upstream-alignment/08-04-PLAN.md
  - .planning/phases/08-locality-and-upstream-alignment/08-04-SUMMARY.md
  - README.md
  - docs/hooks-compatibility.md
  - docs/workflows-compatibility.md
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/on-failure.ts
  - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
  - extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts
  - extensions/pi-claude-marketplace/bridges/workflows/stage.ts
  - extensions/pi-claude-marketplace/bridges/workflows/unstage.ts
  - extensions/pi-claude-marketplace/edge/command-tool.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/autoapply.ts
  - extensions/pi-claude-marketplace/edge/skill-read.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/command-invocation.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/autoapply-setting.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts
  - extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts
  - extensions/pi-claude-marketplace/persistence/locations.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - features/agent/lifecycle.feature
  - features/hook/failures.feature
  - features/hook/tool-use.feature
  - features/plugin/autoapply.feature
  - features/plugin/project-locality.feature
  - features/plugin/project-trust.feature
  - features/skill/model-reads.feature
  - features/slash-command/model-runs.feature
  - features/step_definitions/hook/session.steps.ts
  - features/step_definitions/slash-command/model-runs.steps.ts
  - features/step_definitions/workflow/storage.steps.ts
  - features/workflow/storage.feature
covered_digest: "v4:sha256:2aa4664cbe8dad4c4c6906733921a2db0c91a1916d027111df332271d9821786"
behavior_unverified: 0
overrides_applied: 0
human_verification: []
---

# Phase 8: Locality and Upstream Alignment Verification Report

**Phase Goal:** A project-scope operation keeps its effects in its project scope, trusting the project through Pi alone; hook output reaches the model as Claude Code delivers it; a skill file the model reads is filled only while it is the skill's own text; and the audit warnings W2 and W4 are pinned by scenarios.
**Verified:** 2026-11-03
**Status:** passed (all four success criteria verified; the wording question was settled by the user on 2026-11-03, DC-45)
**Re-verification:** No. Initial verification.

## Goal Achievement

This phase records work that was already merged, so I read the code and the scenarios at HEAD f51140f, not the summaries. The latest full gate is `npm run check` exit 0 at b9f40ad (cucumber 1537/1537, seed 469568). I did not run the full suite. I ran these myself:

- `npx cucumber-js features/plugin/project-trust.feature features/plugin/project-locality.feature features/workflow/storage.feature features/skill/project-trust.feature features/skill/model-reads.feature`: 17 scenarios passed, 228 steps passed (seed 187353).
- `npx cucumber-js --name ...` on the 5 hook-output scenarios, the 2 guard scenarios from b9f40ad, and the untrusted autoapply scenario: 8 scenarios passed, 112 steps passed (seed 20596).
- `node --test` on the workflow stage/unstage and locations tests: 75/75 passed. On the dispatch-exec, on-failure, stream-text, async-rewake registry and wire-protocol tests: 193/193 passed.

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Project skills, commands, aliases, the model command tool, the skill-read fill and hooks are gated on Pi's project trust alone. No provenance ledger is written to the user folder. Project workflows are saved and staged inside the project. The only writes outside the project are the git credential helper and the confirmed cleanup of a plugin's own old workflow copies (LOC-01) | ✓ VERIFIED | **Ledger gone:** `persistence/project-installs.ts`, `bridges/commands/project-ledger.ts` and `bridges/hooks/project-ledger.ts` are deleted (5ecd962). No `project-installs` or admission code is left under `extensions/`. **Trust gates:** each gate reads only `ctx.isProjectTrusted()`: skill `skill-invocation.ts:240` and fill `:357`; command `command-invocation.ts:249,380`; aliases `skill-alias-state.ts:205`; command tool `edge/command-tool.ts:116,132`; skill-read `edge/skill-read.ts:67`; discovery `index.ts:211`. Hooks: the hydrate records Pi's answer and returns early when untrusted (`event-router.ts:799-803`). The command-time cache writer checks the recorded answer (`event-router.ts:160`, `runtime.ts:216-222`). Session start re-hydrates with `ctx.isProjectTrusted()` (`event-router.ts:1124`). Autoapply applies only the user scope when untrusted (`reconcile/load.ts:127-130`). The background pass does the same (`background-pass.ts:431`). **Workflows:** project `workflowsSavedDir` = `<cwd>/.pi/workflows/saved` and `workflowsStagingDir` = `<extensionRoot>/workflows-staging` (`locations.ts:259-277`). **Outside writes:** I checked every module that writes. Each one composes its paths from the operation's own `ScopedLocations`. The npm and bun caches are set inside the work dir (`package-install.ts:513-515`). The one name-derived path outside the project is `formerWorkflowArtifactPath`, and it is used only for unlinking recorded names (`unstage.ts:82-87`, `stage.ts:562-578`). Git credentials go through `platform/git-credential.ts` approve/reject. **Scenarios:** `project-trust.feature` (4) shows untrusted hook, command, alias and command tool. `skill/project-trust.feature` (3) shows untrusted skills. `project-locality.feature` (3) shows trusted skill, command and hook runs with no `project-installs` in the user scope. `workflow/storage.feature` (2) saves `demo:hello.json` in the project, leaves the user's workflow dir with no saved or staged file, and runs the workflow. `autoapply.feature` "...does not trust leaves the plugins ... pending" passes. Old-copy cleanup and the untrusted background pass are unit-tested (`unstage.test.ts:239`, `stage.test.ts:815`, `background-pass.test.ts:220`). |
| 2 | A hook's whole output is read with no size cut, and `onFailure: "block"` keeps a printed deny as Claude Code 2.1.316 does (LOC-02) | ✓ VERIFIED | `stream-text.ts` collects each stream whole, with no limit and a UTF-8 decoder. Both lanes use it: `dispatch-exec.ts:316-320` and `async-rewake/registry.ts:266-271`. The ring buffer and the 1 MB / 64 KB cuts are deleted (209a4ba). No size slice is left in `bridges/hooks`. `on-failure.ts`: broken JSON is trimmed `{...}` that does not parse and is not JSON lines (`:53-71`). A wire-protocol block applies with its own reason unless the hook timed out (`:125-130`). `wire-protocol.ts:141-153` applies the JSON of a non-0/2 exit. Scenarios that passed: "A PreToolUse hook's deny decision larger than 1 MB blocks the tool call" (`tool use: too large to skip`), "...keeps its own reason when the hook exits 1 with onFailure block" (`no echo`), "...prints an unclosed JSON object lets the tool call run", "...fails after printing more than 1 MB blocks the tool call", and "...exits 2 after printing more than 1 MB ... with its stderr". The unit test "keeps a hook that exits 0 after more than 1 MB of plain stdout a noop when onFailure is block" (`dispatch-exec.test.ts:1891`) pins that no 1 MB cut turns into broken JSON under `onFailure: "block"`. |
| 3 | A skill file the model reads with Pi's read tool is filled only while the result equals Pi's own read of the staged file. A hook-replaced result reaches the model as written (LOC-03) | ✓ VERIFIED | `readToolReturns` (`platform/pi-api.ts:301-318`) re-runs Pi's `createReadTool` over the staged text with the call's offset and limit, and compares `content` with `isDeepStrictEqual`. `fillSkillRead` returns `undefined` (pass-through) unless it matches (`skill-invocation.ts:357-369`). `edge/skill-read.ts` passes `offset`/`limit` and the read text. Scenarios that passed: "A read hook's replacement of a skill file reaches the model as the hook wrote it, with no variable filled". The model gets `${CLAUDE_EFFORT}` and `$ARGUMENTS` literal. The three positive fill scenarios (whole, part, and hook-observed) still fill. DC-43 records the red proof. |
| 4 | A scenario shows that an install whose mcp phase fails leaves no agent of the plugin, and one shows that a new session after the plugin's commands are gone offers no `run_plugin_command` (LOC-04) | ✓ VERIFIED | Both scenarios from b9f40ad exist and passed: `features/agent/lifecycle.feature:114` "An install that fails in its mcp phase leaves no agent of the plugin in the list". A directory blocks the user `mcp-adapter.json`, the install fails, and the subagent list holds only `demo:reviewer`, not `tools:auditor`. `features/slash-command/model-runs.feature:105` "A new session after the plugin's commands are gone no longer offers the tool" uses the new step `the model call {int} is not offered the tool {string}` (`model-runs.steps.ts:32-44`). The shared `promptSetup` body is in `hook/session.steps.ts`. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Plan must-haves (merged)

| Plan | Truth | Status |
| --- | --- | --- |
| 08-01 | Components check only `ctx.isProjectTrusted()`. Nothing about project installs is read from or written to the user folder | ✓ (ledger removed; see SC1) |
| 08-01 | Autoapply and background autoupdate cover the project scope only when trusted | ✓ (`load.ts:127-130`, `background-pass.ts:431`; scenario plus unit test) |
| 08-01 | Saves to `<cwd>/.pi/workflows/saved/`, stages under `<cwd>/.pi/pi-claude-marketplace/workflows-staging/` | ✓ (`locations.ts:259-277`; `storage.feature`) |
| 08-01 | Only outside writes are the credential helper and removal of recorded old copies | ✓ (write-site audit; see SC1) |
| 08-02 | Both lanes read stdout and stderr whole | ✓ |
| 08-02 | A large exit-0 JSON deny blocks | ✓ |
| 08-02 | Under `onFailure: "block"`, a JSON block or deny applies with its own reason, and a timeout still blocks | ✓ (`on-failure.ts:125-130`; unit tests "applies the JSON deny ... exits 1" and "blocks a hook its timeout killed") |
| 08-03 | Filled only when equal to Pi's re-read with the same offset/limit | ✓ |
| 08-03 | A hook's replacement reaches the model unfilled | ✓ |
| 08-04 | Failed mcp phase leaves no agent; new session offers no `run_plugin_command` | ✓ |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `persistence/project-installs.ts` | deleted | ✓ VERIFIED | absent, no references |
| `persistence/locations.ts` | in-project saved/staging, `formerWorkflowArtifactPath` | ✓ VERIFIED | containment-checked against the engine home |
| `bridges/workflows/{stage,unstage}.ts` | in-project placement; recorded old-copy removal | ✓ VERIFIED | unit tests 75/75 |
| `bridges/hooks/stream-text.ts` | whole-stream collector | ✓ VERIFIED | used by both lanes |
| `bridges/hooks/on-failure.ts` | upstream broken-JSON rule; kept deny | ✓ VERIFIED | unit tests pass |
| `platform/pi-api.ts::readToolReturns` | Pi read re-run | ✓ VERIFIED | wired into `fillSkillRead` |
| `features/plugin/project-{trust,locality}.feature`, `features/workflow/storage.feature` | trust and locality scenarios | ✓ VERIFIED | 9 scenarios pass |
| `features/agent/lifecycle.feature`, `features/slash-command/model-runs.feature` | W2/W4 guards | ✓ VERIFIED | both pass |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `resources_discover` | hooks hydrate, autoapply, discovery | `ctx.isProjectTrusted()` read once in `prepareResources` (`index.ts:144`) and again for discovery (`index.ts:211`) | ✓ WIRED |
| hydrate | install/update/enable/apply hook cache writer | `recordProjectTrust` → `isProjectTrusted(cwd)` (`event-router.ts:799`, `:160`) | ✓ WIRED |
| project install | `<cwd>/.pi/workflows/saved/` | `locationsFor("project").workflowArtifactPath` | ✓ WIRED (scenario reads the file) |
| uninstall/disable/re-stage | `~/.pi/workflows/projects/<key>/saved/<name>.json` unlink | `formerWorkflowArtifactPath` | ✓ WIRED (unit tests) |
| hook child stdout/stderr | `parseHookStdout` / `onFailureBlock` | `collectStreamText(...).text()` | ✓ WIRED |
| `tool_result` (read) | `fillSkillRead` → `readToolReturns` | `edge/skill-read.ts` | ✓ WIRED |

### Data-Flow Trace (Level 4)

Not applicable to rendered UI. The model-visible values in the scenarios come from real Pi RPC turns against the scripted model, real hook child processes, and the real engine 3.15.0. No values are hardcoded in the steps.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Trust, locality, storage, skill trust, model reads | `npx cucumber-js <5 feature files>` | 17/17 scenarios, 228/228 steps | ✓ PASS |
| Hook output, guards, untrusted autoapply | `npx cucumber-js --name ... (8 names)` | 8/8 scenarios, 112/112 steps | ✓ PASS |
| Workflow placement and old-copy cleanup | `node --test test/bridges/workflows/{stage,unstage}.test.ts test/persistence/locations.test.ts` | 75/75 | ✓ PASS |
| Hook lanes and onFailure | `node --test test/bridges/hooks/{dispatch-exec,on-failure,stream-text,wire-protocol}.test.ts test/bridges/hooks/async-rewake/registry.test.ts` | 193/193 | ✓ PASS |

### Probe Execution

SKIPPED. The phase declares no `probe-*.sh` scripts. DC-44 records ad-hoc red probes for W2 and W4. I did not re-run them.

### Requirements Coverage

Plan frontmatter IDs: 08-01 [LOC-01], 08-02 [LOC-02], 08-03 [LOC-03], 08-04 [LOC-04]. REQUIREMENTS.md maps exactly LOC-01..04 to Phase 8. There are no orphans.

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| LOC-01 | 08-01 | project op reads/writes only in its project; trust via Pi alone; in-project workflows; two outside writes | ✓ SATISFIED for writes and trust; reads clause escalated (see Human Verification) | SC1 |
| LOC-02 | 08-02 | whole hook output; `onFailure: "block"` keeps a printed deny | ✓ SATISFIED | SC2 |
| LOC-03 | 08-03 | fill only when equal to Pi's read; hook text as written | ✓ SATISFIED | SC3 |
| LOC-04 | 08-04 | W2 and W4 guard scenarios | ✓ SATISFIED | SC4 |

### Anti-Patterns Found

No `TBD`, `FIXME`, `XXX` or `TODO` in any covered file.

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `README.md` | 144 | Says "The one exception is a git credential" and leaves out the old-workflow-copy cleanup that D-LOC-01 (a) allows | ℹ️ Info | The cleanup is documented in `docs/workflows-compatibility.md:269`. README wording only. |
| `.planning/PROJECT.md` | 1797 | D-LOC-01 (a) lists "uninstall, update and reinstall". The code and DC-42 item 2 also clean up on disable (`unstage.ts:82-87`) | ℹ️ Info | Record wording only |
| `features/step_definitions/plugin/installation.steps.ts` | 370-374 | "the user scope holds no record of project installs" checks only that the `project-installs` path is absent, not that the user home is unchanged | ℹ️ Info | The broad "no other outside write" claim rests on the write-site audit above, not on a scenario |
| `features/slash-command/model-runs.feature` | 105-120 | The W4 guard does not assert in the same scenario that session 1 was offered the tool | ℹ️ Info | DC-44 records the probe, and the feature's first scenario pins that the tool is offered |
| `orchestrators/reconcile/load.ts` | 117-130 | In an untrusted project, a project config could still turn on a user-scope autoapply | ℹ️ Info | Fixed 2026-11-03 by user decision (DC-45): an untrusted project's configs no longer count; scenario "A project Pi does not trust cannot turn on autoapply for the plugins a user config declares". |

### Human Verification Required

None open. The one question raised (does "reads and writes only inside its project" cover the user-scope marketplace fallback?) was settled by the user on 2026-11-03 (DC-45): locality is about keeping effects in their scope. A project-scope operation may use what the project inherits from the user scope, such as a marketplace, which a project install first brings into the project scope; it never materializes resources in the user scope. D-LOC-01, LOC-01 and the phase goal now say so.

### Gaps Summary

There are no gaps. Each success criterion has code at the cited lines and a passing scenario (or, for old-copy cleanup and the untrusted background pass, a passing unit test). The provenance ledger and its scenarios are gone. Project trust is Pi's answer alone. Project workflows live in `.pi/`. Hook output is read whole. The skill-read fill touches only Pi's own read text. The two guard scenarios from b9f40ad exist and pass. The wording question about reads was settled by the user (DC-45).

---

_Verified: 2026-11-03_
_Verifier: Claude (gsd-verifier)_
