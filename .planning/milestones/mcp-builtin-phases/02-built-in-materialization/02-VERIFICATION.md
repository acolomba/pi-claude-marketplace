---
phase: 02-built-in-materialization
verified: 2026-11-05T09:00:00Z
status: human_needed
score: 5/7 must-haves verified
covered_files:
  - ".planning/phases/02-built-in-materialization/02-01-PLAN.md"
  - ".planning/phases/02-built-in-materialization/02-01-SUMMARY.md"
  - ".planning/phases/02-built-in-materialization/02-02-PLAN.md"
  - ".planning/phases/02-built-in-materialization/02-02-SUMMARY.md"
  - ".planning/phases/02-built-in-materialization/02-03-PLAN.md"
  - ".planning/phases/02-built-in-materialization/02-03-SUMMARY.md"
  - ".planning/phases/02-built-in-materialization/02-04-PLAN.md"
  - ".planning/phases/02-built-in-materialization/02-04-SUMMARY.md"
  - ".planning/phases/02-built-in-materialization/02-05-PLAN.md"
  - ".planning/phases/02-built-in-materialization/02-05-SUMMARY.md"
  - ".planning/phases/02-built-in-materialization/02-06-PLAN.md"
  - ".planning/phases/02-built-in-materialization/02-06-SUMMARY.md"
  - ".planning/phases/02-built-in-materialization/02-07-PLAN.md"
  - ".planning/phases/02-built-in-materialization/02-07-SUMMARY.md"
  - ".planning/phases/02-built-in-materialization/02-08-PLAN.md"
  - ".planning/phases/02-built-in-materialization/02-08-SUMMARY.md"
  - ".planning/phases/02-built-in-materialization/02-09-PLAN.md"
  - ".planning/phases/02-built-in-materialization/02-09-SUMMARY.md"
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
  - "extensions/pi-claude-marketplace/platform/mcp-builtin-status.ts"
  - "features/lib/mcp-builtin-config-probe/extension.ts"
  - "features/lib/mcp-builtin-config-probe/snapshot.ts"
  - "features/lib/mcp-builtin-earlier-record.ts"
  - "features/lib/turn-records.ts"
  - "features/lib/upstream/tool-search.ts"
  - "features/mcp-server/builtin-direct.feature"
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
covered_digest: "v4:sha256:2cf420864eedc6c531fc5a41042beccb07041ed74f743d7c1e16dd241d4b77ae"
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 5/7
  gaps_closed:
    - "New-session leg of BLT-01 under built-in: 'A new session offers the plugin's tool again (BLT-01)' now runs @mcp (both profiles) after the bounded stand-in wait (230b60d, P2-DC-77 resolved for the harness); passes under the builtin profile"
    - "Deferred item companion-missing.feature:61 (red under builtin): the file is now @own-implementation (Phase 3 rewrite), so no builtin scenario reads the old cell"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "Under built-in, every enabled plugin's servers are registered again after /reload in a running Pi (BLT-01, SC 1)"
    test: "Under Pi's built-in MCP, install a plugin with a stub server, run /reload in the running Pi, then search for and call the tool through tool_search"
    expected: "The registry holds plugin_<plugin>_<server> again, the tool is found through tool_search, and the stub receives the call, with no plugin command in between"
    why_human: "Pi's RPC mode cannot run the /reload builtin (it is terminal-only), so every built-in lifecycle scenario starts a fresh Pi, the project's stand-in for /reload (D-CF6-11). The new-session leg is now proven by a scenario; /reload itself is not (P2-DC-88). The code path is shared (the session_start handler, then resyncBuiltinRegistrations after loadReconcile at index.ts:192), so risk is low, but presence checks cannot show it."
gaps: []
human_verification:
  - test: "Decide whether BLT-04 / SC 3 'a name collision or an mcp.json entry that overrides a plugin server is reported, never silent' is met by an info-only report (P2-DC-08) and, for a same-name registration by another extension, by a debug-log line only (P2-DC-46)"
    expected: "Either accept info plus Pi's own /mcp override list as 'reported', and accept the foreign-owner collision as a recorded gap, or open a follow-up for a load-time notice (a new closed-set message, listed under CONTEXT 'Deferred Ideas')"
    why_human: "Product decision. Code and tests match the recorded design: an mcp.json override shows 'overridden by mcp.json' in info and Pi's /mcp. A plugin-to-plugin collision is refused at install (ANAME-03). A registration refused because another extension owns the name is only debug-logged. A user who never runs info or /mcp does not learn of the override. The requirement text 'never silent' can be read either way. No later phase added a load-time notice (grep of the closed sets finds none)."
  - test: "Run /reload in a running Pi under Pi's built-in MCP with an installed plugin (the BLT-01 /reload leg)"
    expected: "The plugin's server is registered and its tool reachable through tool_search"
    why_human: "See behavior_unverified_items. UAT item 2 should now read '/reload only': the new-session half is proven by lifecycle.feature:392 under the builtin profile."
deferred: []
---

# Phase 2: Built-in Materialization Verification Report

**Phase Goal:** Without pi-mcp-adapter and with Pi's built-in MCP on, every enabled plugin's MCP servers connect through built-in on every startup and `/reload`, with the values and names Claude Code would give them, gated on project trust and visible in `info`; a switch between the adapter and built-in needs no plugin action (turning built-in MCP back on after the adapter turned it off is the user's step, D-MB-01).
**Verified:** 2026-11-05T09:00:00Z
**Status:** human_needed
**Re-verification:** Yes. Milestone-close re-verification on the combined tree (branch `features/mcp-builtin`, HEAD `ca56636`). The earlier report (2026-11-04, branch `features/mcp-builtin-phase-2`, HEAD `e6f22d7`) set `passed` by orchestrator disposition (P2-DC-100), not by evidence; the two human items it carried are unchanged in substance, so the status here is the honest one, `human_needed`.

## Goal Achievement

No truth is FAILED. Every claim was re-checked against the current code and re-run, not read from SUMMARY files. The combined tree strengthened the covered surface in three places and weakened none.

### What later phases changed in the covered surface

| Change | Commit | Effect on Phase 2 |
| ------ | ------ | ----------------- |
| `substituteAndInject` takes a required `McpFieldEncoder` (no adapter default) | `c5445ba` (06-04) | Strengthens SC 2 and SC 4: both callers name their encoder (`adapter-entry.ts:188` passes the adapter one, `builtin-entry.ts:63` the built-in one); omission is now a type error (P2-DC-53). |
| Clone-root containment moved into `recorded-servers.ts` as `isPluginRootContained`, shared by the step and the legacy reader; the reader refuses an `uncontained` record before reading any file | `41bc6ae` (06-08) | Moved, not removed. `recordRegistrations` calls it at `builtin-registration-step.ts:162` before any read or expansion, and the reader re-checks (`recorded-servers.ts:253`). Code is the same logic as the removed `owningRoot`/`cloneKeyOf`/`CLONE_KEY`. Strengthens MREC-02 (UF-1, NFR-10). |
| Stand-in check waits up to 10 s; the BLT-01 new-session scenario lifted from `@adapter-only` to `@mcp` | `230b60d` (06-05) | Closes the new-session half of the old behavior-unverified item. I ran it under the builtin profile: 1 scenario, 13 steps, passed. |
| `tool_search` projection moved to `features/lib/upstream/tool-search.ts` | `ed1b7a7` (06-04) | Housekeeping. Old path gone; the step module and the fingerprint list use the new one. |
| Built-in status rows expect `requires mcp` (read-time verdicts); the switch scenario shows `requires mcp` between implementations | `7a2285a`, `58ab863` (Phase 3 merge) | Strengthens SC 5: the `list` row is asserted between the two restarts. `list` is read-only, so DUAL-04's "no plugin command" holds (D-P6-18). |
| `docs/mcp-compatibility.md` describes built-in agent grants and cites decision IDs | `8969c18` | Additive. Every cited `features/...`, `extensions/...` and Pi `dist/...` path exists (scripted check; the one "missing" hit, `docs/configuration.md`, is a path inside an external pi-mcp-adapter URL). |
| `SoftDepStatus.piMcpAdapterLoaded` dropped | `aeb9c7e` | The built-in gate reads `softDeps.mcpImplementation` only (`builtin-registration-step.ts:249`); no reader depends on the dropped flag. |

### Observable Truths

The five ROADMAP success criteria are the contract. SC 1 and SC 3 each hold two separable claims, so they are scored as two truths each. The new-session leg that the earlier report placed in 1b now counts under 1a.

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1a | SC 1: under built-in, after each startup **and each new session in a running Pi**, every enabled plugin's runnable servers are registered and the scripted model calls their tools (deferred through `tool_search`, `alwaysLoad: true` directly); after disable or uninstall the next start has no such server, enable restores it, update replaces it (BLT-01, BLT-06) | ✓ VERIFIED | `syncSession` (`builtin-registration-step.ts:248`) registers `enabledRecords` (excludes disabled and `dependencyDisabled`) at `session_start` (`index.ts:128`, `createMcpSessionMaterializer`) and again after `loadReconcile` (`index.ts:192`). Run by me under `--profile builtin`: `lifecycle.feature`, `listing.feature`, `invocation.feature`, `configuration.feature`, `project-scope.feature`, `sources.feature`: 43/43 scenarios, 564/564 steps (seed 812534), including the builtin twins for disable, uninstall, enable, update, published change, autoapply-in-load, and `lifecycle.feature:392` "A new session offers the plugin's tool again" (re-run alone, 1/1, seed 726526). `builtin-direct.feature` covers the direct `alwaysLoad` call. |
| 1b | SC 1, the `/reload` leg of "after each startup and `/reload`" (BLT-01) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `/reload` and the new-session path run the same two calls (`session_start` handler, then `resyncBuiltinRegistrations`). Pi's RPC mode cannot run the `/reload` builtin, so no scenario drives it (P2-DC-88). Fresh-Pi starts stand in for it by convention (D-CF6-11). See `behavior_unverified_items`. |
| 2  | SC 2: a built-in server receives what Claude Code would give it: stdio and streamable HTTP, `command`, `args`, `url`, `env`, `headers` with `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${VAR}`, `${VAR:-default}` expanded as upstream does, `timeout` in seconds, OAuth fields; a literal `$` or leading `!` unchanged; project-scope servers register only while Pi trusts the project (BLT-02, BLT-03) | ✓ VERIFIED | `domain/mcp-builtin-translation.ts` (closed table, `timeout` = ms / 1000, `redirectUri` to `callbackUrl`, `exposure`, no Pi-only fields); `bridges/mcp/builtin-escape.ts` (resolves each reference by Claude's rule, then `$` to `$$` and a leading `!` to `$!` in `env` and `headers` only); `builtin-entry.ts` (refuses a stdio value that resolves to a leading `~`). Trust: `syncSession` asks `ctx.isProjectTrusted()` on every call and drops the project scope when false (`:258`, `:243`). Proof: `test/integration/mcp-builtin-encoding-conformance.test.ts` (drives Pi 1.5.0's real resolver and validator) passed in my run; `builtin-values.feature`, `builtin-trust.feature`, `configuration.feature` builtin twins and `project-scope.feature` trust twins all passed (see 1a). The phase unit pairs: 298/298. |
| 3a | SC 3: server named `plugin_<plugin>_<server>`, tools `mcp__plugin_<plugin>_<server>__<tool>` with the `-` to `_` fold recorded as a divergence; `info` shows connected, not connected, disabled, overridden by `mcp.json`, project not trusted (BLT-04, BLT-05) | ✓ VERIFIED | `profileFor("builtin").serverName` is the one naming source; `listing.feature` pins the registry name, the fold and the 64-character cut; `docs/mcp-compatibility.md` lists the fold under divergences. `platform/mcp-builtin-status.ts` plus `info-mcp-status.ts` give one passing scenario per token in `builtin-status.feature` (16/16 scenarios across the four builtin-owned files, seed 743940). `info.test.ts` (489 lines added by Phase 3 for read-time verdicts) still passes with the built-in arm: 331/331 with the conformance test. |
| 3b | SC 3: "a name collision or an `mcp.json` entry that overrides a plugin server is reported, never silent" (BLT-04) | ? UNCERTAIN | Unchanged by the combined tree. Reported only through pull surfaces: an `mcp.json` override in `info` and Pi's `/mcp` (P2-DC-08, High, open); a plugin-to-plugin collision is refused at install (ANAME-03); a name another extension already owns is refused by Pi and only debug-logged (P2-DC-46). No load-time notice exists in the closed sets. Human decision requested. |
| 4  | SC 4: while the adapter is active or no implementation is active the extension registers nothing and Pi reports no extension error; install keeps writing adapter entries under built-in; a plugin installed before this milestone reaches its servers under either implementation with no reinstall (MSEL-03, MSEL-04, MREC-02) | ✓ VERIFIED | Gate: `syncSession` returns before reading context, state or registry unless `softDeps.mcpImplementation === "builtin"` (`:249`). Scenarios: `implementation-switch.feature` 3/3 under `--profile adapter` (61 steps, seed 56771): the MREC-02 scenario (`@mcp`, record rewritten with no `mcpServerConfigs`), the MSEL-04 scenario, and the switch scenario's `none` leg (empty registry, no tool, `pi reports no extension error`). The MREC-02 scenario also runs under the builtin profile through the legacy reader, whose containment check now lives in `recorded-servers.ts`; `recorded-servers.test.ts` passes. |
| 5  | SC 5: `implementation-switch.feature` installs a plugin, reaches its server under the adapter, then under built-in after the adapter is removed and built-in MCP is on, then under the adapter again, with no plugin command in between; `docs/mcp-compatibility.md` has a built-in column whose statements each cite a scenario or the Pi 1.5.0 source (MSEL-02, MDOC-01) | ✓ VERIFIED | The switch scenario (lines 50-130) has one `install` step and then only restarts (adapter, none, built-in with `tool_search` plus a direct call, adapter) and a read-only `/claude:plugin list` (asserted `requires mcp`, no state change). Passed in my run. Docs: built-in columns in the naming, search and field tables, a "Pi's built-in MCP" section, and a status table with a built-in meaning column; every cited feature, source and Pi `dist/` path exists. |

**Score:** 5/7 truths verified (1 present, behavior-unverified; 1 uncertain)

### Deferred Items

None. The earlier deferred item (`companion-missing.feature:61` red under the builtin profile) is closed: Phase 3 rewrote that file, every scenario in it is now `@own-implementation`, and the builtin profile selects none of them (my run: 0 scenarios, as expected).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `domain/mcp-builtin-translation.ts` | Closed field table | ✓ VERIFIED | 88 lines, pure, used by `builtin-entry.ts` |
| `bridges/mcp/builtin-escape.ts`, `substitute.ts` | Built-in encoder, required encoder parameter | ✓ VERIFIED | Both callers pass an encoder; no default |
| `bridges/mcp/builtin-entry.ts`, `builtin-description.ts` | Config builder, description reader | ✓ VERIFIED | Used by the step |
| `bridges/mcp/builtin-registration.ts` | Idempotent sync | ✓ VERIFIED | Wired from `syncSession` |
| `bridges/mcp/builtin-overrides.ts` | Synchronous `mcp.json` reader | ✓ VERIFIED | Used by `info-mcp-status.ts` |
| `orchestrators/mcp/builtin-registration-step.ts` | Step and resync | ✓ VERIFIED | Both entry points call one `syncSession`; containment now delegated to `recorded-servers.ts` |
| `orchestrators/mcp/recorded-servers.ts` | Recorded and legacy reader, shared containment | ✓ VERIFIED | `isPluginRootContained` exported and used twice |
| `platform/mcp-builtin-status.ts` | Status reader | ✓ VERIFIED | Built at factory time without reading `pi` (`index.ts:105`) |
| `orchestrators/plugin/info-mcp-status.ts` | Built-in `info` arm | ✓ VERIFIED | Picks the arm by implementation |
| `docs/mcp-compatibility.md` | Built-in column | ✓ VERIFIED | See truth 5 |
| Feature files, step modules, libs | Lifted and new scenarios | ✓ VERIFIED | All present; `features/lib/mcp-builtin-tool-search.ts` moved to `features/lib/upstream/tool-search.ts` |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `index.ts` factory | `builtinRegistrationStep` | `createMcpSessionMaterializer` at `session_start` | WIRED | `index.ts:128-131` |
| `resources_discover` handler | `resyncBuiltinRegistrations` | after `loadReconcile`, own try/catch | WIRED | `index.ts:188-195` |
| `index.ts` | `createBuiltinMcpStatusReader(pi)` | `mcpStatus.builtin` | WIRED | `index.ts:103-106` |
| registration step | `isPluginRootContained`, `recordedMcpServers`, `createLegacyServersReader` | containment, MREC-02 | WIRED | `builtin-registration-step.ts:162-169` |
| registration step | status owner and replaced-name notes | `noteBuiltinServerOwners`, `REGISTRATION_NOTES` | WIRED | `:261-267`; read by the status reader and `info-mcp-status.ts` |
| `substituteAndInject` | both encoders | required parameter | WIRED | `adapter-entry.ts:188`, `builtin-entry.ts:63` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Registered config | `desired` map | `state.json` records, recorded or legacy-read configs, real `process.env`, `ctx.cwd`, data dir | Yes: scenarios show the stub receiving resolved `env`, `args`, `headers` | ✓ FLOWING |
| `info` built-in status | reader answer | Pi's live `getMcpServers()` and `getAllTools()` per lookup | Yes: one scenario per token | ✓ FLOWING |
| Override and owner stamps | `configured`, `serverOwners` | `mcp.json` files read synchronously; the step's last sync | Yes (P2-DC-92) | ✓ FLOWING |

### Behavioral Spot-Checks

All run by me on the combined tree, one file group per call, no whole profile.

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase unit pairs (bridges/mcp builtin-*, index, substitute; translation; step; recorded-servers; info-mcp-status; status reader) | `node --test` on those 12 files | 298/298 | ✓ PASS |
| Pi 1.5.0 resolver conformance and `info` | `node --test test/integration/mcp-builtin-encoding-conformance.test.ts test/orchestrators/plugin/info.test.ts` | 331/331 | ✓ PASS |
| Builtin direct, status, trust, values | `cucumber-js --profile builtin` on the four files | 16 scenarios, 185 steps (seed 743940) | ✓ PASS |
| Builtin lifecycle, listing, invocation, configuration, project-scope, sources | `cucumber-js --profile builtin` on the six files | 43 scenarios, 564 steps (seed 812534) | ✓ PASS |
| BLT-01 new session under built-in | `cucumber-js --profile builtin features/mcp-server/lifecycle.feature:392` | 1 scenario, 13 steps (seed 726526) | ✓ PASS |
| Switch scenario (adapter, none, built-in, adapter) | `cucumber-js --profile adapter features/mcp-server/implementation-switch.feature` | 3 scenarios, 61 steps (seed 56771) | ✓ PASS |
| Old deferred item | `cucumber-js --profile builtin features/mcp-server/companion-missing.feature` | 0 scenarios selected (all `@own-implementation`) | ✓ closed |

Gate evidence cited, not re-run: `npm run check` exit 0 on 71a37c4 (same build inputs as HEAD apart from `.planning/`; static, unpaired, integration, cucumber adapter 1603/1603 and builtin 133/133, direct coverage); `test:modules` exit 0 on 2b6f2f4; CI run 41967152313 green on 2b6f2f4 after one known adapter flake (P3-DC-111, `lifecycle.feature:392` under the adapter profile).

### Probe Execution

Step 7c: SKIPPED. The phase declares no `probe-*.sh` scripts.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| MSEL-02 | 02-07 | Switch needs no plugin action | ✓ SATISFIED | Switch scenario passes; `/reload` alone not run (1b) |
| MSEL-03 | 02-01, 02-07 | No registration under adapter or none | ✓ SATISFIED | Gate at `:249`; listing and switch scenarios |
| MSEL-04 | 02-07 | Adapter entries still written at install | ✓ SATISFIED | MSEL-04 scenario passes |
| MREC-02 | 02-01, 02-07 | Pre-milestone record works with no reinstall | ✓ SATISFIED | `@mcp` scenario; shared containment in `recorded-servers.ts` |
| BLT-01 | 02-01, 02-02, 02-03, 02-06, 02-09 | Registered on every startup and `/reload`; tools callable | ✓ SATISFIED for startup and new session; `/reload` leg is a human item | Truths 1a, 1b |
| BLT-02 | 02-01, 02-02, 02-03 | Claude's values, no Pi reinterpretation | ✓ SATISFIED | Truth 2 |
| BLT-03 | 02-05 | Project servers only when trusted | ✓ SATISFIED | `builtin-trust.feature`, `project-scope.feature` |
| BLT-04 | 02-01, 02-04, 02-09 | Names, fold recorded, collision or override reported | ? NEEDS HUMAN | Names and fold verified; "never silent" is truth 3b |
| BLT-05 | 02-04 | `info` status tokens | ✓ SATISFIED | `builtin-status.feature` |
| BLT-06 | 02-06 | Disable, uninstall, enable, update effects | ✓ SATISFIED | `lifecycle.feature` builtin twins |
| MDOC-01 | 02-08 | Built-in column with citations | ✓ SATISFIED | Truth 5 |

All 11 phase IDs appear in a PLAN `requirements:` field and a SUMMARY `requirements-completed:`. REQUIREMENTS.md maps exactly these 11 to Phase 2 and marks them complete. No orphans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| Phase source, docs, features | n/a | `TBD`, `FIXME`, `XXX`, `TODO`, `HACK` | None found | Debt-marker gate clear (grep over every covered source, doc and feature file) |
| `builtin-registration-step.ts`, `platform/mcp-builtin-status.ts` | n/a | Process-level mutable state (replaced names, owners) | ℹ️ Info | P2-DC-92; unit-tested |
| `info-mcp-status.ts` | `ownedElsewhere` | Foreign-extension collision not detectable | ⚠️ Warning | P2-DC-46; part of 3b |
| `builtin-registration-step.ts:162`, `recorded-servers.ts:253` | n/a | The containment check runs twice for a legacy record (step, then reader) | ℹ️ Info | Redundant path walk, no behavior effect |

### Human Verification Required

#### 1. Is an info-only report "never silent" for BLT-04?

**Test:** Decide whether the recorded design satisfies "a name collision or an `mcp.json` entry that overrides a plugin server is reported, never silent".
**Expected:** Either accept `info` plus Pi's `/mcp` as the report and the foreign-extension collision as a documented gap (P2-DC-08, P2-DC-46), or schedule a load-time notice (new closed-set message).
**Why human:** Product judgment. Behavior matches the recorded design and passes its scenarios.

#### 2. `/reload` leg of BLT-01 under built-in

**Test:** Under Pi's built-in MCP, run `/reload` in a running Pi with an installed plugin, then search for and call the plugin's tool.
**Expected:** The server is registered again and the call reaches the stub, with no plugin command.
**Why human:** Pi's RPC mode cannot run `/reload`. The new-session half of the earlier item is now covered by `lifecycle.feature:392` under the builtin profile, so `02-UAT.md` item 2 can be narrowed to `/reload` alone. I left `02-UAT.md` unchanged because it is the user's record.

### Gaps Summary

No blocking gap. The combined tree keeps every Phase 2 deliverable wired and behaviorally exercised, and it closes two earlier open items (the built-in new-session leg and the `companion-missing` deferral). The score stays 5/7 because the same two judgment items remain: truth 1b (`/reload` itself, not drivable over RPC) and truth 3b (the "never silent" reading of BLT-04). Both stay routed to `02-UAT.md` for the user.

---

_Verified: 2026-11-05T09:00:00Z_
_Verifier: Claude (gsd-verifier)_
