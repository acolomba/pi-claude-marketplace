---
phase: 02-built-in-materialization
verified: 2026-11-06T20:00:00Z
status: passed
score: 7/7 must-haves verified
covered_files:
  - ".planning/milestones/mcp-builtin-phases/02-built-in-materialization/02-01-PLAN.md"
  - ".planning/milestones/mcp-builtin-phases/02-built-in-materialization/02-01-SUMMARY.md"
  - ".planning/milestones/mcp-builtin-phases/02-built-in-materialization/02-02-PLAN.md"
  - ".planning/milestones/mcp-builtin-phases/02-built-in-materialization/02-02-SUMMARY.md"
  - ".planning/milestones/mcp-builtin-phases/02-built-in-materialization/02-03-PLAN.md"
  - ".planning/milestones/mcp-builtin-phases/02-built-in-materialization/02-03-SUMMARY.md"
  - ".planning/milestones/mcp-builtin-phases/02-built-in-materialization/02-04-PLAN.md"
  - ".planning/milestones/mcp-builtin-phases/02-built-in-materialization/02-04-SUMMARY.md"
  - ".planning/milestones/mcp-builtin-phases/02-built-in-materialization/02-05-PLAN.md"
  - ".planning/milestones/mcp-builtin-phases/02-built-in-materialization/02-05-SUMMARY.md"
  - ".planning/milestones/mcp-builtin-phases/02-built-in-materialization/02-06-PLAN.md"
  - ".planning/milestones/mcp-builtin-phases/02-built-in-materialization/02-06-SUMMARY.md"
  - ".planning/milestones/mcp-builtin-phases/02-built-in-materialization/02-07-PLAN.md"
  - ".planning/milestones/mcp-builtin-phases/02-built-in-materialization/02-07-SUMMARY.md"
  - ".planning/milestones/mcp-builtin-phases/02-built-in-materialization/02-08-PLAN.md"
  - ".planning/milestones/mcp-builtin-phases/02-built-in-materialization/02-08-SUMMARY.md"
  - ".planning/milestones/mcp-builtin-phases/02-built-in-materialization/02-09-PLAN.md"
  - ".planning/milestones/mcp-builtin-phases/02-built-in-materialization/02-09-SUMMARY.md"
  - "docs/mcp-compatibility.md"
  - "extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts"
  - "extensions/pi-claude-marketplace/bridges/mcp/builtin-description.ts"
  - "extensions/pi-claude-marketplace/bridges/mcp/builtin-entry.ts"
  - "extensions/pi-claude-marketplace/bridges/mcp/builtin-escape.ts"
  - "extensions/pi-claude-marketplace/bridges/mcp/builtin-overrides.ts"
  - "extensions/pi-claude-marketplace/bridges/mcp/builtin-registration.ts"
  - "extensions/pi-claude-marketplace/bridges/mcp/index.ts"
  - "extensions/pi-claude-marketplace/bridges/mcp/substitute.ts"
  - "extensions/pi-claude-marketplace/domain/mcp-builtin-translation.ts"
  - "extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts"
  - "extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts"
  - "extensions/pi-claude-marketplace/platform/mcp-builtin-status.ts"
  - "features/lib/mcp-builtin-config-probe/extension.ts"
  - "features/lib/mcp-builtin-config-probe/snapshot.ts"
  - "features/lib/mcp-builtin-earlier-record.ts"
  - "features/lib/pi-tui.ts"
  - "features/lib/scripted-model/terminal-turn.ts"
  - "features/lib/turn-records.ts"
  - "features/lib/upstream/tool-search.ts"
  - "features/mcp-server/builtin-direct.feature"
  - "features/mcp-server/builtin-reload.feature"
  - "features/mcp-server/builtin-status.feature"
  - "features/mcp-server/builtin-trust.feature"
  - "features/mcp-server/builtin-values.feature"
  - "features/mcp-server/configuration.feature"
  - "features/mcp-server/implementation-switch.feature"
  - "features/mcp-server/invocation.feature"
  - "features/mcp-server/lifecycle.feature"
  - "features/mcp-server/listing.feature"
  - "features/mcp-server/project-scope.feature"
  - "features/mcp-server/sources.feature"
  - "features/step_definitions/mcp-server/builtin-status.steps.ts"
  - "features/step_definitions/mcp-server/builtin-tool-search.steps.ts"
  - "features/step_definitions/mcp-server/builtin-values.steps.ts"
  - "features/step_definitions/mcp-server/configuration.steps.ts"
  - "features/step_definitions/mcp-server/implementation-switch.steps.ts"
  - "features/step_definitions/session.steps.ts"
  - "test/bridges/mcp/builtin-description.test.ts"
  - "test/bridges/mcp/builtin-entry.test.ts"
  - "test/bridges/mcp/builtin-escape.test.ts"
  - "test/bridges/mcp/builtin-overrides.test.ts"
  - "test/bridges/mcp/builtin-registration.test.ts"
  - "test/bridges/mcp/index.test.ts"
  - "test/bridges/mcp/substitute.test.ts"
  - "test/domain/mcp-builtin-translation.test.ts"
  - "test/integration/mcp-builtin-encoding-conformance.test.ts"
  - "test/orchestrators/mcp/builtin-registration-step.test.ts"
  - "test/orchestrators/mcp/recorded-servers.test.ts"
  - "test/orchestrators/plugin/info-mcp-status.test.ts"
  - "test/orchestrators/plugin/info.test.ts"
  - "test/platform/mcp-builtin-status.test.ts"
covered_digest: "v4:sha256:f667c1c2ac7818409d520c4a501f0309e444597072aabac025b59dcab9188a12"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/7
  gaps_closed:
    - "Truth 1b (the /reload leg of BLT-01): features/mcp-server/builtin-reload.feature (quick 261106-m03, 1b5a90d) drives /reload in a terminal Pi under the builtin profile; passes in my run"
    - "Truth 3b (BLT-04 'never silent'): the user chose option 2 on 2026-11-06 (02-UAT.md check 1, D-MB-29). An mcp.json override is reported by info and Pi's /mcp; a registration refused because another extension holds the name now reads 'not loaded' in info (quick 261106-m02, 202ef11)"
  gaps_remaining: []
  regressions: []
gaps: []
deferred: []
---

# Phase 2: Built-in Materialization Verification Report

**Phase Goal:** Without pi-mcp-adapter and with Pi's built-in MCP on, every enabled plugin's MCP servers connect through built-in on every startup and `/reload`, with the values and names Claude Code would give them, gated on project trust and visible in `info`; a switch between the adapter and built-in needs no plugin action (turning built-in MCP back on after the adapter turned it off is the user's step, D-MB-01).
**Verified:** 2026-11-06T20:00:00Z
**Status:** passed
**Re-verification:** Yes. Second milestone-close re-verification on branch `features/mcp-builtin`, HEAD `9893782`, after the user's review fixes. The previous report (2026-11-05, `human_needed`, 5/7) carried one behavior-unverified truth (the `/reload` leg) and one uncertain truth (BLT-04 "never silent"). Both are now closed by evidence this run re-checked.

## Goal Achievement

No truth is FAILED, UNCERTAIN, or PRESENT_BEHAVIOR_UNVERIFIED. I read the changed code and re-ran the focused tests and scenarios on this tree. SUMMARY claims were not taken as evidence.

### What changed since the last report (c7a0358 to HEAD)

| Change | Commit | Effect on Phase 2 |
| ------ | ------ | ----------------- |
| `refused` note: `syncBuiltinRegistrations` calls `notes.refused(name)` when `registerMcpServer` throws; `platform/mcp-builtin-status.ts` keeps `refusedRegistrations`, cleared by a later replaced or fresh registration; `info-mcp-status.ts` reads such a name as `not loaded` after the mcp.json and other-owner checks | quick 261106-m02 (`8d318b0`, `1c8839f`, `9b4f606`, merged `202ef11`) | Closes the foreign-owner half of BLT-04 (P2-DC-46, D-MB-29). `info` also stamps the servers the registration step reads (`recordedMcpServers` passed in as `readServers`), so a legacy record is stamped as the step registers it (MREC-02). |
| `recordedMcpServers(record, source, readerFor)` refuses stored servers of a record whose plugin root is outside its owning clone root | quick 261106-m04 | Strengthens UF-1 and NFR-10. The same `isPluginRootContained` check now guards stored servers, the legacy reader, and the registration step (`recorded-servers.ts`). |
| New `@builtin-only` scenario that runs `/reload` in a terminal Pi | quick 261106-m03 (`39f0a28`, `1b5a90d`) | Closes truth 1b. Test-only; no `extensions/` change. |
| Harness waits for pi-mcp-adapter's tool listing | quick 261106-m05 | Test harness only. |
| Docs and comments only | quick 261106-m06, `2f04e5b`, `96b36a9`, `aee2da4`, `9893782` | No behavior change. |
| `02-UAT.md` `status: complete`, 2/2 pass | `283db43` | User's record of the two human items; not edited by me. |

### Observable Truths

The five ROADMAP success criteria are the contract. SC 1 and SC 3 each hold two separable claims, so they are scored as two truths each.

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1a | SC 1: under built-in, after each startup and each new session in a running Pi, every enabled plugin's runnable servers are registered and the scripted model calls their tools (deferred through `tool_search`, `alwaysLoad: true` directly); after disable or uninstall the next start has no such server, enable restores it, update replaces it (BLT-01, BLT-06) | ✓ VERIFIED | `syncSession` registers the enabled records at `session_start` and again after `loadReconcile`. Run by me under `--profile builtin`: `lifecycle.feature`, `listing.feature`, `invocation.feature`, `configuration.feature`, `project-scope.feature`, `sources.feature`: 43/43 scenarios, 564/564 steps (seed 154119), including the builtin twins for disable, uninstall, enable, update, autoapply-in-load, and `lifecycle.feature:392` "A new session offers the plugin's tool again". `builtin-direct.feature` covers the direct `alwaysLoad` call (in the 19/19 run below). |
| 1b | SC 1, the `/reload` leg of "after each startup and `/reload`" (BLT-01) | ✓ VERIFIED | `features/mcp-server/builtin-reload.feature` "The plugin's tool answers through tool search after a reload in the terminal (BLT-01, D-MB-10)": installs a plugin with a stdio stub, starts a terminal Pi with the scripted model, types `/reload` (step "the user reloads pi in the terminal and then prompts", `session.steps.ts:136`, waits on Pi's `Reloaded keybindings` status via `PiTuiSession.reload`), then the model finds the tool through `tool_search` and calls it; the stub answers `echo:ping`. Passed in my run (builtin profile, 19 scenarios, 220 steps, seed 449029, with `builtin-status`, `builtin-direct`, `builtin-trust`, `builtin-values`). The quick summary records a negative control: with `session_start` and the resync both skipped on a reload, the scenario fails at its Then; with either path alone it still passes, since the two paths are redundant by design. I did not re-run that control; I read the diffs in the summary and the production wiring at `index.ts:128` and `index.ts:192`. |
| 2  | SC 2: a built-in server receives what Claude Code would give it: stdio and streamable HTTP, `command`, `args`, `url`, `env`, `headers` with `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${VAR}`, `${VAR:-default}` expanded as upstream does, `timeout` in seconds, OAuth fields; a literal `$` or leading `!` unchanged; project-scope servers register only while Pi trusts the project (BLT-02, BLT-03) | ✓ VERIFIED | Translation, escape, and entry modules unchanged since the last report except for comments. `test/integration/mcp-builtin-encoding-conformance.test.ts` (drives Pi 1.5.0's real resolver and validator) passed in this run's 661-test unit and integration batch. `builtin-values.feature`, `builtin-trust.feature` (19/19 run), and the `configuration` and `project-scope` builtin twins (43/43 run) passed. |
| 3a | SC 3: server named `plugin_<plugin>_<server>`, tools `mcp__plugin_<plugin>_<server>__<tool>` with the `-` to `_` fold recorded as a divergence; `info` shows connected, not connected, disabled, overridden by `mcp.json`, project not trusted (BLT-04, BLT-05) | ✓ VERIFIED | `builtin-status.feature` now holds the foreign-owner scenario beside the token scenarios; all passed in the 19/19 run. `info-mcp-status.test.ts`, `info.test.ts`, `mcp-builtin-status.test.ts` passed (661/661 batch). Naming and the fold are pinned by `listing.feature` (43/43 run) and recorded in `docs/mcp-compatibility.md`. |
| 3b | SC 3: "a name collision or an `mcp.json` entry that overrides a plugin server is reported, never silent" (BLT-04) | ✓ VERIFIED (by recorded user decision) | The user resolved this on 2026-11-06 (`02-UAT.md` check 1, option 2; PROJECT.md D-MB-20 and D-MB-29 rows, "Locked"): the report is `info` and Pi's `/mcp`, as Claude Code reports a suppressed duplicate in `/plugin`; no load-time notice, no new message kind. Code and scenarios match that decision. An `mcp.json` override reads `overridden by mcp.json` (scenario in `builtin-status.feature`). A name another extension registered first reads `not loaded` (`info-mcp-status.ts:builtinStatus`, set by `notes.refused` in `builtin-registration.ts:80`; scenario "Plugin info shows a server whose name another extension registered first as not loaded (D-MB-29)" passed). A plugin-to-plugin collision is refused at install (ANAME-03). Residual: a user who never runs `info` or `/mcp` sees no load-time message; this is the accepted reading, and BACKLOG BLTOWNER-01 (narrowed) tracks what stays open. This is a decision-backed pass, not an automated proof of "never silent" in the strictest sense. |
| 4  | SC 4: while the adapter is active or no implementation is active the extension registers nothing and Pi reports no extension error; install keeps writing adapter entries under built-in; a plugin installed before this milestone reaches its servers under either implementation with no reinstall (MSEL-03, MSEL-04, MREC-02) | ✓ VERIFIED | `syncSession` returns before reading context, state, or registry unless `softDeps.mcpImplementation === "builtin"`. `--profile adapter` on `lifecycle.feature` and `implementation-switch.feature`: 12/12 scenarios, 192/192 steps (seed 193736), including the MREC-02, MSEL-04, and switch-through-`none` scenarios. `recorded-servers.test.ts` (with the new containment-on-stored-configs cases) passed. |
| 5  | SC 5: `implementation-switch.feature` installs a plugin, reaches its server under the adapter, then under built-in after the adapter is removed and built-in MCP is on, then under the adapter again, with no plugin command in between; `docs/mcp-compatibility.md` has a built-in column whose statements each cite a scenario or the Pi 1.5.0 source (MSEL-02, MDOC-01) | ✓ VERIFIED | The switch scenario passed (adapter run above). Docs unchanged in substance since the last report (comment and decision-ID edits only); the earlier citation scan stands. |

**Score:** 7/7 truths verified (0 behavior-unverified; truth 3b rests on the user's recorded decision)

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `domain/mcp-builtin-translation.ts`, `bridges/mcp/builtin-{escape,entry,description,overrides,registration}.ts`, `substitute.ts`, `adapter-entry.ts` | Translation, encoders, config builder, sync | ✓ VERIFIED | Present, used, unit pairs pass. `builtin-registration.ts` gained the `refused` note. |
| `orchestrators/mcp/builtin-registration-step.ts`, `recorded-servers.ts` | Step, shared reader and containment | ✓ VERIFIED | Step passes `REGISTRATION_NOTES.refused`; `recordedMcpServers(record, source, readerFor)` checks containment on stored configs. |
| `platform/mcp-builtin-status.ts`, `orchestrators/plugin/info-mcp-status.ts`, `info.ts` | Status reader, info arm | ✓ VERIFIED | `builtinRegistrationRefused` read in `builtinStatus`; `readServers` supplied by `info.ts`. |
| `docs/mcp-compatibility.md` | Built-in column | ✓ VERIFIED | See truth 5. |
| `features/mcp-server/builtin-reload.feature`, `builtin-status.feature`, harness libs | New and extended scenarios | ✓ VERIFIED | Present and green. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `index.ts` | `builtinRegistrationStep` | `createMcpSessionMaterializer` at `session_start` | WIRED | `index.ts:128` |
| `resources_discover` | `resyncBuiltinRegistrations` | after `loadReconcile`, own try/catch | WIRED | `index.ts:188-195` |
| `syncBuiltinRegistrations` | `noteRefusedBuiltinRegistration` | `notes.refused` in the `registerMcpServer` catch | WIRED | `builtin-registration.ts:80`, `builtin-registration-step.ts` `REGISTRATION_NOTES` |
| `info-mcp-status.ts` | `builtinRegistrationRefused` | `builtinStatus` after the other-owner check | WIRED | read once per server |
| `info.ts` | `withMcpServerStatus` | `readServers` port, backed by `recordedMcpServers` | WIRED | unit and scenario coverage |
| registration step and legacy reader | `isPluginRootContained` | `recorded-servers.ts` | WIRED | now also guards stored servers |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Registered config | `desired` map | `state.json` records, recorded or legacy-read configs, real `process.env`, `ctx.cwd` | Yes: scenarios show the stub receiving resolved values | ✓ FLOWING |
| `info` built-in status | reader answer plus `refusedRegistrations`, owners | Pi's live `getMcpServers()` and `getAllTools()`; the step's last sync | Yes: one scenario per token plus the refusal scenario | ✓ FLOWING |

### Behavioral Spot-Checks

All run by me on HEAD `9893782`, one group per call, no whole profile. Npm commands used the `npm_config_script_shell` and `NODE_OPTIONS` prefix from the task.

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase unit pairs, Pi 1.5.0 conformance, info, status reader | `node --test` on `test/bridges/mcp/builtin-*.test.ts`, `index`, `substitute`, `test/domain/mcp-builtin-translation.test.ts`, `test/orchestrators/mcp/*.test.ts`, `info-mcp-status`, `info`, `test/platform/mcp-builtin-status.test.ts`, the conformance test | 661 pass, 0 fail | ✓ PASS |
| Builtin status (incl. D-MB-29), reload, direct, trust, values | `test:cucumber:profile -- --profile builtin` on the five files | 19 scenarios, 220 steps (seed 449029) | ✓ PASS |
| Builtin lifecycle, listing, invocation, configuration, project-scope, sources | same, six files | 43 scenarios, 564 steps (seed 154119) | ✓ PASS |
| Adapter lifecycle and switch | `--profile adapter` on `lifecycle.feature` and `implementation-switch.feature` | 12 scenarios, 192 steps (seed 193736) | ✓ PASS |

Gate evidence cited, not re-run: `npm run check` passed on `c3547b8` (1604 adapter, 137 builtin scenarios) with quick tasks m02 to m05 merged. A second `npm run check` on `883e085` (m06, comments and docs only) was running in the parent session when this report was written.

### Probe Execution

Step 7c: SKIPPED. The phase declares no `probe-*.sh` scripts.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| MSEL-02 | 02-07 | Switch needs no plugin action | ✓ SATISFIED | Switch scenario; `/reload` scenario |
| MSEL-03 | 02-01, 02-07 | No registration under adapter or none | ✓ SATISFIED | Gate in `syncSession`; adapter-profile run |
| MSEL-04 | 02-07 | Adapter entries still written at install | ✓ SATISFIED | MSEL-04 scenario |
| MREC-02 | 02-01, 02-07 | Pre-milestone record works with no reinstall | ✓ SATISFIED | `@mcp` scenario; info now stamps by the step's own read |
| BLT-01 | 02-01, 02-02, 02-03, 02-06, 02-09 | Registered on every startup and `/reload`; tools callable | ✓ SATISFIED | Truths 1a, 1b |
| BLT-02 | 02-01, 02-02, 02-03 | Claude's values, no Pi reinterpretation | ✓ SATISFIED | Truth 2 |
| BLT-03 | 02-05 | Project servers only when trusted | ✓ SATISFIED | trust and project-scope scenarios |
| BLT-04 | 02-01, 02-04, 02-09 | Names, fold recorded, collision or override reported | ✓ SATISFIED (user-accepted reading) | Truths 3a, 3b |
| BLT-05 | 02-04 | `info` status tokens | ✓ SATISFIED | `builtin-status.feature` |
| BLT-06 | 02-06 | Disable, uninstall, enable, update effects | ✓ SATISFIED | `lifecycle.feature` builtin twins |
| MDOC-01 | 02-08 | Built-in column with citations | ✓ SATISFIED | Truth 5 |

All 11 phase IDs appear in a PLAN `requirements:` field. No orphans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| Phase source, docs, features | n/a | `TBD`, `FIXME`, `XXX`, `TODO`, `HACK` | None found in the files changed since the last report (diff scan) | Debt-marker gate clear |
| `platform/mcp-builtin-status.ts` | `refusedRegistrations` | Third process-level mutable set (beside replaced names and owners) | ℹ️ Info | D-MB-29, P2-DC-92; unit-tested, cleared by a later accepted registration or removal |
| `info-mcp-status.ts` | `builtinStatus` | A refused name reads `not loaded` only within the process that attempted the registration | ℹ️ Info | Matches the decision; the state is process-local by design |

### Human Verification Required

None. The two items of the previous report are closed: the `/reload` leg by `builtin-reload.feature` (truth 1b), and the BLT-04 reading by the user's decision (truth 3b, `02-UAT.md` 2/2 pass).

### Gaps Summary

No gap. Every Phase 2 deliverable is present, wired, and exercised by a passing test or scenario on HEAD `9893782`. The score rises from 5/7 to 7/7. Open follow-ups are recorded elsewhere and do not block the phase: BACKLOG BLTOWNER-01 (narrowed), and the stale `02-VALIDATION.md` (see the report's Dubious Choices).

---

_Verified: 2026-11-06T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
