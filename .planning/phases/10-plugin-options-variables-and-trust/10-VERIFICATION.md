---
phase: 10-plugin-options-variables-and-trust
verified: 2026-11-15T22:00:00Z
status: human_needed
score: 5/6 must-haves verified (the sixth is the maintainer's PG-SEC-02 confirmation, which only a human can give)
covered_files: [".planning/phases/10-plugin-options-variables-and-trust/10-01-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-01-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-02-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-02-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-03-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-03-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-04-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-04-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-05-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-05-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-06-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-06-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-07-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-07-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-08-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-08-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-09-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-09-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-10-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-10-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-11-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-11-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-12-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-12-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-13-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-13-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-14-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-14-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-15-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-15-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-16-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-16-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-17-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-17-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-18-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-18-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-19-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-19-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-20-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-20-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-21-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-21-SUMMARY.md","extensions/pi-claude-marketplace/bridges/agents/convert.ts","extensions/pi-claude-marketplace/bridges/agents/skill-preload.ts","extensions/pi-claude-marketplace/bridges/agents/stage.ts","extensions/pi-claude-marketplace/bridges/agents/types.ts","extensions/pi-claude-marketplace/bridges/commands/stage.ts","extensions/pi-claude-marketplace/bridges/commands/staged-command.ts","extensions/pi-claude-marketplace/bridges/commands/types.ts","extensions/pi-claude-marketplace/bridges/hooks/event-router.ts","extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts","extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts","extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts","extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts","extensions/pi-claude-marketplace/bridges/mcp/adapter-escape.ts","extensions/pi-claude-marketplace/bridges/mcp/builtin-entry.ts","extensions/pi-claude-marketplace/bridges/mcp/builtin-escape.ts","extensions/pi-claude-marketplace/bridges/mcp/stage.ts","extensions/pi-claude-marketplace/bridges/mcp/substitute.ts","extensions/pi-claude-marketplace/bridges/mcp/types.ts","extensions/pi-claude-marketplace/bridges/skills/stage.ts","extensions/pi-claude-marketplace/bridges/skills/types.ts","extensions/pi-claude-marketplace/domain/argument-substitution.ts","extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts","extensions/pi-claude-marketplace/domain/components/plugin.ts","extensions/pi-claude-marketplace/domain/plugin-resolver.ts","extensions/pi-claude-marketplace/domain/resolver-types.ts","extensions/pi-claude-marketplace/domain/unsupported-components.ts","extensions/pi-claude-marketplace/domain/user-config.ts","extensions/pi-claude-marketplace/index.ts","extensions/pi-claude-marketplace/orchestrators/command-invocation.ts","extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts","extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts","extensions/pi-claude-marketplace/orchestrators/plugin-options.ts","extensions/pi-claude-marketplace/orchestrators/plugin-path.ts","extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts","extensions/pi-claude-marketplace/orchestrators/plugin/info.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts","extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts","extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts","extensions/pi-claude-marketplace/persistence/state-io.ts","extensions/pi-claude-marketplace/shared/completion-cache.ts","extensions/pi-claude-marketplace/shared/errors-bridges.ts","extensions/pi-claude-marketplace/shared/notification-dispatch.ts","extensions/pi-claude-marketplace/shared/notification-json.ts","extensions/pi-claude-marketplace/shared/notification-mcp.ts","extensions/pi-claude-marketplace/shared/notification-resolve.ts","extensions/pi-claude-marketplace/shared/notification-types.ts","extensions/pi-claude-marketplace/shared/notification-wire.ts","extensions/pi-claude-marketplace/shared/notify-reasons.ts","extensions/pi-claude-marketplace/shared/probe-classifiers.ts","extensions/pi-claude-marketplace/shared/session-env.ts","extensions/pi-claude-marketplace/shared/vars.ts","features/agent/frontmatter.feature","features/agent/options.feature","features/hook/failures.feature","features/hook/process.feature","features/mcp-server/builtin-options.feature","features/mcp-server/options.feature","features/plugin/executables.feature","features/plugin/options.feature","features/plugin/project-trust.feature","features/skill/invocation.feature","features/skill/model-reads.feature","features/skill/options.feature","features/slash-command/invocation.feature","features/slash-command/model-runs.feature","features/slash-command/options.feature"]
covered_digest: "v4:sha256:a55ff653f67e4a88fd6df293de51f8c1ebbe8ed8ad1cea55c4d781eb603329e9"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "PG-SEC-02: read the D-PG10-01 row of .planning/PROJECT.md (and 10-CONTEXT.md decision 23), then confirm option A (keep the D-LOC-01 trust gap, every project effect gated on ctx.isProjectTrusted() alone) or reopen it (option B, an extension-kept consent record, which needs a new requirement)."
    expected: "The maintainer's answer is recorded in the D-PG10-01 row, which then stops saying 'Pending maintainer review'. If the gap is reopened, a new requirement is opened for the consent record."
    why_human: "PG-SEC-02 says the maintainer confirms or reopens the gap. An autonomous run took option A and marked it pending. No code or test can give the maintainer's decision."
  - test: "D-PG10-19: decide whether hooks and skill, command, and agent content keep getting each declared default, or follow Claude Code 2.1.323 exactly (defaults on MCP config only)."
    expected: "Keep: success criteria 1 and 2 stand as verified. Strict parity: the values map in domain/user-config.ts switches, and success criteria 1 and 2 (hook prints fast, content filled) are no longer met and must be amended in ROADMAP.md."
    why_human: "Criteria 1 and 2 pass only because of this recorded divergence beyond upstream, which is pending maintainer review."
  - test: "Review the other pending D-PG10 rows in .planning/PROJECT.md: D-PG10-04 (step 1 of userConfig now, including the 'Open /plugin manage to configure it' text Pi has no command for, review IN-04), D-PG10-06 (required option without default is partial, not parity), D-PG10-11 (option values reach pi-mcp-adapter and every Pi child, bash included, through process variables), D-PG10-16 (amends SUB-02), D-PG10-23 (project option variables wait for the trust answer; residual start-up race), D-PG10-24 (reinstall, not apply, refreshes an old partial install), and D-PG10-25 (an unreadable stored userConfig: under pi-mcp-adapter a stdio server still starts with empty option values, review IN-09)."
    expected: "Each row is confirmed or sent back; each row stops saying 'Pending maintainer review'."
    why_human: "Each is a recorded policy choice marked pending maintainer review; the code matches each row as written."
  - test: "Judgment-tier prohibitions of plans 10-02, 10-04, 10-07, 10-08, 10-09, 10-10, 10-16, 10-17, 10-18, 10-19, 10-20, and 10-21 (16 items, all verification: judgment, none test-tier)."
    expected: "No comment, title, or doc calls the hook or content default parity; no record calls the trust gap closed; no D-PG10 row is marked locked; no option value is written into mcp-adapter.json, staged sensitive content, a result row, or a file on the built-in path; an untrusted project's state.json feeds neither PATH nor option variables."
    why_human: "The verifier's check of these is an LLM judgment, not authoritative (see the Prohibitions section). Human review recommended."
---

# Phase 10: Plugin Options, Variables, and Trust Verification Report

**Phase Goal:** A plugin's `userConfig` defaults reach its hooks, its MCP servers, and its content, so that a plugin whose options all have a default installs without `--partial`. A user-scope skill or command gets the project directory. A plugin's `bin` directory joins `PATH` only when it exists and, for a project-scope plugin, only when Pi trusts the project. The accepted project trust gap is confirmed or reopened.
**Verified:** 2026-11-15T22:00:00Z
**Status:** human_needed
**Re-verification:** No. This is the first verification.

Evidence base. I read the code at HEAD e8be13fa. The full gate log `/tmp/pg10-phasegate2.log` exists and ends with `exit=0`, adapter `1983 scenarios (1983 passed)` and builtin `199 scenarios (199 passed)`. It ran at 16ef48af, and `git diff --name-only 16ef48af HEAD` lists only `10-REVIEW-FIX.md` and `10-VALIDATION.md`. So every scenario named below passed on the code that is verified here. I also ran three owner tests in a hermetic home: `test/domain/user-config.test.ts`, `test/orchestrators/plugin-path.test.ts`, and `test/bridges/hooks/spawn-helpers.test.ts` (116/116 pass).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: a plugin with `userConfig.mode` default `fast` gives its hook `CLAUDE_PLUGIN_OPTION_MODE=fast` and installs without `--partial`. A required option with no default is refused without `--partial` (PG-CORE-03). The fixture uses the full shape with `title` and `description` (D-PG10-20). | ✓ VERIFIED | `features/plugin/options.feature:13` (installed, no reasons) and `:71` (partially-available, `options not set`, `partial-install` hint, nothing installed). `features/hook/process.feature:110`: the hook's real `process.env` (`features/lib/hook-recorder.ts:115`, `claudeEnvironment(process.env)`) holds `CLAUDE_PLUGIN_OPTION_MODE=fast`. Code: `domain/user-config.ts` `resolveOptions` and `hookOptionVariableName`, exported in `bridges/hooks/hook-env.ts:99`; resolver `domain/plugin-resolver.ts:739-762` adds `userConfig` to `unsupported` only when `unsetRequired` is not empty; `unsupported-components.ts:38` leaves `userConfig` out of the unsupported set. A malformed `userConfig` is `unavailable` (`options.feature:37`, `:54`). |
| 2 | SC2: `${user_config.KEY}` is filled with the default in an exec-form hook command and its arguments, in `command`, `args`, `env`, `url`, and `headers` of a plugin server under both profiles, and in skill and agent content. A sensitive value is not written into content (PG-CORE-03). | ✓ VERIFIED | Hook: `process.feature:30` (args `fast --level=3 fast3`); `spawn-helpers.ts:68-79` fills `command` and each string arg; the owner test `spawn-helpers.test.ts:79` covers the command. A shell-form reference is refused (`failures.feature:177`). MCP under the adapter: args `mcp-server/options.feature:276` (@mcp, both profiles), command and env `:298`, url and header `:333`; these run real servers, so the value reaches them. Built-in: command and env `:381`, url and header `:420`, and `builtin-options.feature:74`. `mcp-adapter.json` holds `${PI_CLAUDE_MARKETPLACE_OPTION_8fd4b1ce5a5f54e0}` and no value (`options.feature:220`). Content: `skill/options.feature:7` (`fast`; sensitive gives `[sensitive option 'token' not available in skill content]`), `agent/options.feature:7` (the staged agent file on disk holds the placeholder, not `abc123`), `slash-command/options.feature:7`. Code: `shared/vars.ts:94-98`. |
| 3 | SC3: a user-scope command with `project ${CLAUDE_PROJECT_DIR}` sends the project path when typed and through `run_plugin_command`. A user-scope skill shows the path when the model reads its staged `SKILL.md`. An agent body stays as it is (PG-CORE-05). | ✓ VERIFIED | `slash-command/invocation.feature:113`, `slash-command/model-runs.feature:79`, `skill/model-reads.feature:43` (read of `{agent dir}/.../SKILL.md` returns `project {project dir}`), `skill/invocation.feature:204`, and the agent guard `agent/frontmatter.feature:72` (the staged body keeps `${CLAUDE_PROJECT_DIR}`). Code: `orchestrators/command-invocation.ts:164` and `orchestrators/skill-invocation.ts:152` set `CLAUDE_PROJECT_DIR: request.cwd`. |
| 4 | SC4: in a project marked "Do not trust", the bash tool does not find an enabled project plugin's `bin/hello`; in a trusted project it does. With two enabled plugins, one with `bin/`, the plugin `PATH` holds one entry (PG-CORE-06, PG-CORE-07). | ✓ VERIFIED | `plugin/executables.feature:7` (trusted: `greeted`), `:59` (refused trust: `absent`), `:33` (user-scope bin still found in an untrusted project), `:85` (one entry). The harness saves a real Pi `trust.json` value `false` (`features/support/world.ts:692-693`). Code: `index.ts:181` reads `ctx.isProjectTrusted()` once and passes it to `recomputePluginPath` (`index.ts:217`); `orchestrators/plugin-path.ts` reads the project `state.json` only when `projectTrusted`, and `keepsBinDir` keeps only an existing directory with no metacharacter. Note: the two-plugin scenario reads `PI_CLAUDE_MARKETPLACE_PATH`, the ledger that `applyPathLedger` returns in the same call that sets `PATH` (`plugin-path.ts` last lines), so it equals the plugin entries appended to `PATH`. |
| 5 | SC5: the decision on the trust gap of D-LOC-01 is in `PROJECT.md` with its premise and the Pi version it was checked against (PG-SEC-02). | ✓ VERIFIED | `.planning/PROJECT.md:2402` (D-PG10-01): the question, the Claude Code premise (`core.md` U9), Pi 1.5.0 and 1.5.2 read in source (`project-trust.js:22-23`, `trust-manager.js:8-17`, `:157-176`, byte-identical), options A and B, the security flag, the residual, and reversibility. D-LOC-01 (`:2150`) says "Confirmed by D-PG10-01 (Pi 1.5.0 and 1.5.2)". The upstream draft `.planning/upstream/pi-extension-trust-paths.md` exists; BACKLOG `PITRUSTPATHS-01` exists. |
| 6 | PG-SEC-02 (requirement text): the maintainer confirms or reopens the accepted trust gap. | ? UNCERTAIN (human) | The record says "Pending maintainer review". An autonomous discussion took option A. The maintainer has not confirmed it. Not marked done. See Human Verification item 1. |

**Score:** 5/6 truths verified (0 present, behavior-unverified; 1 needs the maintainer).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/domain/user-config.ts` | strict parse, resolve, variable names | ✓ VERIFIED | 317 lines, substantive; consumed by the resolver, the hooks env, the MCP escape, state-io, info, and every install, update, enable, and move path (25 call sites) |
| `extensions/pi-claude-marketplace/orchestrators/plugin-options.ts` | owned option variables, trust-gated | ✓ VERIFIED | called from `index.ts:231` with the load's `projectTrusted` |
| `extensions/pi-claude-marketplace/orchestrators/plugin-path.ts` | trust gate and existence check | ✓ VERIFIED | `recomputePluginPath(cwd, projectTrusted)`, one production caller `index.ts:217` |
| `extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts` | exec-form option fill, shell-form refusal | ✓ VERIFIED | `planSpawn` fills `command` and args, throws `ShellFormOptionReferenceError` |
| `extensions/pi-claude-marketplace/shared/vars.ts` | content fill with sensitive placeholder | ✓ VERIFIED | used by the skill, command, and agent stages |
| `persistence/state-io.ts` `recordedOptionsOf` | the one reader of the stored schema | ✓ VERIFIED | read by hooks hydrate, the built-in step, and the option variables |
| `.planning/upstream/pi-extension-trust-paths.md` | drafted Pi request | ✓ VERIFIED | present, not filed (as recorded) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `index.ts` load | `recomputePluginPath` | `ctx.isProjectTrusted()` read once at `:181` | WIRED | same constant feeds hooks hydrate, reconcile, PATH, and option variables |
| resolver | install refusal | `partial.unsupported.push("userConfig")` | WIRED | `options.feature:71` shows the refusal |
| install record `userConfig` | hooks env | `event-router.ts:696` -> `hook-env.ts:99` | WIRED | `process.feature:110`, and a same-session install scenario at `:145` |
| record options | adapter entry and process env | `adapter-escape.ts:148` `ownedOptionVariableName` | WIRED | `options.feature:220` and `:298` |
| record options | built-in registration | `builtin-registration-step.ts:264` | WIRED | `options.feature:381`, `builtin-options.feature:74` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| hook env | `CLAUDE_PLUGIN_OPTION_*` | manifest `userConfig` -> install record -> `recordedOptionsOf` | yes, recorded by a real hook process | ✓ FLOWING |
| MCP fields | `mcpValues` | same, through the escaped process variable or the in-memory built-in config | yes, real stub servers and an http server receive the values | ✓ FLOWING |
| `PATH` | `freshBinDirs` | `state.json` of each trusted scope -> `stat` | yes, the bash tool runs `hello` | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| option parse, PATH gate, exec fill | `node --import test/platform/isolated-pi-home.ts --test test/domain/user-config.test.ts test/orchestrators/plugin-path.test.ts test/bridges/hooks/spawn-helpers.test.ts` (hermetic `PI_CODING_AGENT_DIR`) | 116 pass, 0 fail | ✓ PASS |
| every named scenario | full gate log `/tmp/pg10-phasegate2.log` at 16ef48af (code identical to HEAD) | adapter 1983/1983, builtin 199/199, `exit=0` | ✓ PASS (artifact read, not re-run, per dispatch) |

### Probe Execution

Step 7c: SKIPPED. No plan or summary declares a `probe-*.sh`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PG-CORE-03 | 18 plans (10-02, 10-05 .. 10-19) | `userConfig` defaults and export, step 1 | ✓ SATISFIED (defaults on hooks and content rest on D-PG10-19, pending maintainer review) | Truths 1 and 2 |
| PG-CORE-05 | 10-03 and 2 others | `${CLAUDE_PROJECT_DIR}` at user scope | ✓ SATISFIED (D-PG10-16 pending maintainer review) | Truth 3 |
| PG-CORE-06 | 10-01, 10-04 and others | untrusted project's `bin` is not on `PATH` | ✓ SATISFIED | Truth 4 |
| PG-CORE-07 | 10-01, 10-04 and others | no `bin` adds nothing | ✓ SATISFIED | Truth 4 |
| PG-SEC-02 | 10-20 | maintainer confirms or reopens the gap; decision recorded with premise and Pi version | ? NEEDS HUMAN | the record part is done (Truth 5); the maintainer step is not (Truth 6) |

No orphaned requirements: REQUIREMENTS.md maps exactly these five IDs to Phase 10, and each appears in a plan's `requirements`. REQUIREMENTS.md still shows each as `[ ]` / Pending; the orchestrator updates that at phase completion.

### Prohibitions (judgment tier)

All 16 prohibitions in the plans are `verification: judgment`; none is test-tier. Non-authoritative LLM-judge verdict: no violation found. I searched the added lines of the phase diff for "parity" next to "default" or "option". Each hit says the hook and content default is "more than Claude Code does ... It is not parity". The one parity sentence in `unsupported-components.ts:40` is about installing without `--partial`, which Claude Code's install also does. The trust-gap docs say the gate applies only when Pi's answer is "not trusted". The D-PG10 rows in PROJECT.md all say "Pending maintainer review". `mcp-adapter.json` holds a reference and no value (`options.feature:220`). Flag: **unverified-prohibition, human review recommended** (Human Verification item 4).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| phase diff (`extensions`, `features`, `test`, `scripts`, from 75f01fc9) | - | TBD / FIXME / XXX | none found | - |
| added lines under `extensions` | - | TODO / HACK / placeholder | none found | - |
| `shared/errors-bridges.ts:328-331` | - | message tells the user to run `/plugin manage`, which Pi has no command for (review IN-04) | ℹ️ Info | a maintainer question under D-PG10-04 |
| `persistence/state-io.ts` (D-PG10-25) | - | a corrupt stored `userConfig` under pi-mcp-adapter still starts a stdio server with empty option values (review IN-09, now documented) | ℹ️ Info | a policy residual, pending maintainer review |
| `10-VALIDATION.md` | frontmatter | `nyquist_compliant: false` while the sign-off list ticks `nyquist_compliant: true` | ℹ️ Info | planning record inconsistency, no code impact |
| review IN-01 .. IN-08 | - | carried Info findings, left open | ℹ️ Info | none blocks the goal |

### Human Verification Required

### 1. PG-SEC-02: confirm or reopen the trust gap

**Test:** Read D-PG10-01 in `.planning/PROJECT.md` and decision 23 in `10-CONTEXT.md`. Confirm option A or reopen with option B.
**Expected:** The answer is recorded in D-PG10-01, which stops saying "Pending maintainer review". If reopened, a new requirement holds the consent record.
**Why human:** The requirement is the maintainer's decision. An autonomous run cannot make it.

### 2. D-PG10-19: defaults on hooks and content

**Test:** Decide whether hooks and content keep the declared default (more than Claude Code 2.1.323 does) or follow upstream exactly.
**Expected:** Keep: success criteria 1 and 2 stand. Strict parity: criteria 1 and 2 must be amended in ROADMAP.md.
**Why human:** Success criteria 1 and 2 hold only through this pending divergence.

### 3. The other pending D-PG10 rows

**Test:** Review D-PG10-04 (with the `/plugin manage` text), -06, -11, -16, -23, -24, and -25 in `PROJECT.md`.
**Expected:** Each row is confirmed or sent back.
**Why human:** Recorded policy choices pending maintainer review.

### 4. Judgment-tier prohibitions

**Test:** Spot-check the 16 prohibitions listed above against the code and docs.
**Expected:** No violation, as the non-authoritative check found.
**Why human:** A judgment verdict from the verifier is not authoritative.

### Gaps Summary

No gaps. The code delivers success criteria 1 to 5, and the scenarios that exercise them passed in the final gate on code identical to HEAD. The phase cannot be `passed` because PG-SEC-02 asks for the maintainer's decision. D-PG10-01 records option A as pending maintainer review. Criteria 1 and 2 also rest on D-PG10-19, which is pending review too.

---

_Verified: 2026-11-15T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
