---
phase: 02-built-in-materialization
verified: 2026-11-04T17:30:00Z
status: passed
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
  - "extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts"
  - "extensions/pi-claude-marketplace/platform/mcp-builtin-status.ts"
  - "features/lib/mcp-builtin-config-probe/extension.ts"
  - "features/lib/mcp-builtin-config-probe/snapshot.ts"
  - "features/lib/mcp-builtin-earlier-record.ts"
  - "features/lib/mcp-builtin-tool-search.ts"
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
  - "test/orchestrators/plugin/info-mcp-status.test.ts"
  - "test/orchestrators/plugin/info.test.ts"
  - "test/platform/mcp-builtin-status.test.ts"
covered_digest: "v4:sha256:6f7421e2bfe6a87aa6d5a00646c8c6a570031377b9aa0c5e6b7dfcfff2e10a68"
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "Under built-in, every enabled plugin's servers are registered after each /reload and in each new session of a running Pi, not only after a fresh Pi start (BLT-01, SC 1)"
    test: "Under the builtin profile, install a plugin with a stub server, run /reload in the running Pi (and, separately, start a new session in it), then list the registered MCP servers and prompt the scripted model to search for and call the tool"
    expected: "The registry holds plugin_<plugin>_<server> again, the tool is found through tool_search, and the stub receives the call, with no plugin command in between"
    why_human: "Every built-in lifecycle scenario starts a fresh Pi after the change, which the project's convention treats as the /reload stand-in (D-CF6-11). The one scenario that starts a new session inside a running Pi is @adapter-only (P2-DC-77: Pi 1.5.0's RPC new_session emits session_start twice and its built-in MCP leaks a second connection). P2-DC-88 records that no run checked /reload itself. The code path is shared (session_start handler, then the resync after loadReconcile), so risk is low, but presence checks cannot show it."
gaps: []
human_verification:
  - test: "Decide whether BLT-04 / SC 3 'a name collision or an mcp.json entry that overrides a plugin server is reported, never silent' is met by an info-only report (P2-DC-08) and, for a same-name registration by another extension, by a debug-log line only (P2-DC-46)"
    expected: "Either accept info plus Pi's own /mcp override list as 'reported', and accept the foreign-owner collision as a recorded gap, or open a follow-up for a load-time notice (a new closed-set message, listed under CONTEXT 'Deferred Ideas')"
    why_human: "This is a product decision. Code and tests match the recorded design: an mcp.json override shows 'overridden by mcp.json' in info (scenario passes) and Pi's /mcp. A plugin-to-plugin collision is refused at install (ANAME-03). A registration refused because another extension owns the name is only debug-logged, and info then shows the other extension's server state on the plugin row (documented in docs/mcp-compatibility.md 'A name that another extension registered'). A user who never runs info or /mcp does not learn of the override. The requirement text 'never silent' can be read either way."
  - test: "Run /reload in a running Pi under Pi's built-in MCP with an installed plugin (the BLT-01 /reload leg above)"
    expected: "The plugin's server is registered and its tool reachable through tool_search"
    why_human: "See behavior_unverified_items. No scenario drives /reload itself under the builtin profile."
deferred:
  - truth: "Builtin profile green: features/mcp-server/companion-missing.feature:61 ('Plugin info names pi-mcp-adapter as a missing companion') expects 'status unknown' for the stub server and now reads 'not loaded'"
    addressed_in: "Phase 3"
    evidence: "The file is Phase 3-owned (ROADMAP ownership table, marker and state assertions). Its own header says its assertions hold 'only where the run's shared Pi has no pi-mcp-adapter, until MREC-05 rewrites them'; MREC-05 is a Phase 3 requirement. The new reading is the correct BLT-05 answer: Pi lists no registration for a server installed after Pi started, so the reader answers 'unlisted', rendered 'not loaded'. Planned and logged as P2-DC-43; reproduced here (builtin profile 97/98, seed 641937)."
---

# Phase 2: Built-in Materialization Verification Report

**Phase Goal:** Without pi-mcp-adapter and with Pi's built-in MCP on, every enabled plugin's MCP servers connect through built-in on every startup and `/reload`, with the values and names Claude Code would give them, gated on project trust and visible in `info`; a switch between the adapter and built-in needs no plugin action (turning built-in MCP back on after the adapter turned it off is the user's step, D-MB-01).
**Verified:** 2026-11-04T17:30:00Z
**Status:** human_needed
**Re-verification:** No, initial verification (branch `features/mcp-builtin-phase-2`, HEAD `e6f22d7`, after the code review fixes)

## Goal Achievement

No truth is FAILED. The code exists, is wired, and is exercised by passing behavioral scenarios. Status is `human_needed` because of two judgment items the orchestrator asked me to weigh (P2-DC-08/46 "never silent", and the /reload and new-session legs of BLT-01), not because of a defect I could demonstrate.

### Observable Truths

The five ROADMAP success criteria are the contract. SC 1 and SC 3 each hold two separable claims, so I scored them as two truths each.

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1a | SC 1: Under built-in, after each startup every enabled plugin's runnable servers are registered and the scripted model calls their tools (deferred through `tool_search`, `alwaysLoad: true` directly); after disable or uninstall the next start has no such server, enable restores it, update replaces it (BLT-01, BLT-06) | ✓ VERIFIED | `builtin-registration-step.ts` `syncSession` registers `enabledRecords` (excludes disabled and `dependencyDisabled`) at `session_start` (wired through `createMcpSessionMaterializer`, `index.ts:128`) and again after `loadReconcile` (`index.ts:192`). Behavioral proof, builtin profile run by me (97/98): `lifecycle.feature` builtin twins for disable, uninstall, enable, update, published-change and autoapply-in-load; `invocation.feature` and `listing.feature` `tool_search` calls; `builtin-direct.feature` direct `alwaysLoad` call. |
| 1b | SC 1, the `/reload` and new-session-in-a-running-Pi legs of "after each startup and `/reload`" (BLT-01) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Same code path as 1a, but no builtin scenario drives `/reload` or a new session in a running Pi. See `behavior_unverified_items` and P2-DC-77, P2-DC-88. |
| 2  | SC 2: A built-in server receives what Claude Code would give it: stdio and streamable HTTP, `command`, `args`, `url`, `env`, `headers` with `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${VAR}`, `${VAR:-default}` expanded as upstream does, `timeout` in seconds, OAuth fields; a literal `$` or leading `!` unchanged; project-scope servers register only while Pi trusts the project (BLT-02, BLT-03) | ✓ VERIFIED | `domain/mcp-builtin-translation.ts` (closed table, `timeout` = ms/1000, `redirectUri` to `callbackUrl`, `exposure`), `bridges/mcp/builtin-escape.ts` (resolves each reference with Claude's rule, then `$` to `$$` and leading `!` to `$!` only in `env` and `headers`), `builtin-entry.ts` (also refuses a stdio value that resolves to a leading `~` that Pi would expand, WR-02), containment in `owningRoot`/`isContained` (UF-1, per-record clone root after WR-01). Trust: `syncSession` asks `ctx.isProjectTrusted()` on every call and drops the project scope when false. Proof: `test/integration/mcp-builtin-encoding-conformance.test.ts` (63/63, run by me) drives Pi 1.5.0's real resolver and validator; `configuration.feature` builtin twins (headers, env Outline with `$` and `!` rows, plugin root in args, unset variable keeps the literal); `builtin-values.feature` (timeout seconds, OAuth four keys and no secret, Pi-only fields dropped, description, `exposure: direct`); `builtin-trust.feature`, `project-scope.feature` trust twins. |
| 3a | SC 3: Server named `plugin_<plugin>_<server>`, tools `mcp__plugin_<plugin>_<server>__<tool>` with the `-` to `_` fold recorded as a divergence; `info` shows connected, not connected, disabled, overridden by `mcp.json`, project not trusted (BLT-04, BLT-05) | ✓ VERIFIED | `profileFor("builtin").serverName` used in the step and in `info-mcp-status.ts`; `listing.feature` pins the registry name, the hyphen fold and the 64-character cut; `docs/mcp-compatibility.md` "Divergences" lists the fold as a Pi capability gap. `platform/mcp-builtin-status.ts` reader plus `builtinStatus` order (`mcp.json` first, then owner, then reader). `builtin-status.feature` has one passing scenario per token: connected, not connected, not loaded (refused registration), `overridden by mcp.json`, `project not trusted`, `overridden by project scope`, and `disabled` driven through Pi's real `/mcp` TUI manager. |
| 3b | SC 3: "a name collision or an `mcp.json` entry that overrides a plugin server is reported, never silent" (BLT-04) | ? UNCERTAIN | Reported only through pull surfaces: an `mcp.json` override in `info` and Pi's `/mcp` (P2-DC-08, severity High, status open); plugin-to-plugin collisions refused at install by ANAME-03; a name another extension already owns is refused by Pi, debug-logged only, and `info` then shows the other extension's server state (P2-DC-46, documented). No load-time notice exists (CONTEXT "Deferred Ideas"). Human decision requested, see Human Verification Required. |
| 4  | SC 4: While the adapter is active or no implementation is active the extension registers nothing and Pi reports no extension error; install keeps writing adapter entries under built-in so a later adapter start serves them with no rewrite at load; a plugin installed before this milestone reaches its servers under either implementation with no reinstall (MSEL-03, MSEL-04, MREC-02) | ✓ VERIFIED | Gate: `syncSession` returns before reading context, state or registry unless `softDeps.mcpImplementation === "builtin"` (checked in code; unit tests in `builtin-registration-step.test.ts` pass). Scenarios (adapter profile run, 3/3): `listing.feature` "Under pi-mcp-adapter the extension registers no server with Pi (MSEL-03)"; `implementation-switch.feature` "installed under built-in runs through pi-mcp-adapter after a restart, with no rewrite at load (MSEL-04)" and the switch scenario's `none` leg (empty registry, no tool, `pi reports no extension error`); the `@mcp` MREC-02 scenario (record rewritten to drop `mcpServerConfigs`, via the frozen legacy reader) runs under both profiles. |
| 5  | SC 5: `implementation-switch.feature` installs a plugin, reaches its server under the adapter, then under built-in after the adapter is removed and built-in MCP is on, then under the adapter again, no plugin command in between; `docs/mcp-compatibility.md` has a built-in column whose statements each cite a scenario or the Pi 1.5.0 source (MSEL-02, MDOC-01) | ✓ VERIFIED | I ran `implementation-switch.feature` under the adapter profile (it is `@own-implementation`): 3/3 scenarios, 58/58 steps, seed 835581. The switch scenario has exactly one install step and no plugin command after it; restarts go adapter, none, built-in (`tool_search` plus a direct call), adapter. Docs: built-in columns in the naming, search, divergence and field tables, a "Pi's built-in MCP" section, and a status table with a built-in meaning column; every cited `features/...` and `extensions/...` path and every cited Pi `dist/...` file exists (scripted check, no misses). Statements citing the extension's own source (P2-DC-87) and `P2-DC` IDs as licenses (P2-DC-90) are recorded choices. |

**Score:** 5/7 truths verified (1 present, behavior-unverified; 1 uncertain)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | `companion-missing.feature:61` red under the builtin profile (`status unknown` expected, `not loaded` read) | Phase 3 | Phase 3 owns the file and the marker and state rows; the feature header says "until MREC-05 rewrites them". `not loaded` is the correct BLT-05 answer for an unregistered server. Reproduced by me: builtin profile 97/98 (seed 641937), the only failure. Adapter profile 1564/1564 per the gate. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `domain/mcp-builtin-translation.ts` | Closed field table | ✓ VERIFIED | 88 lines, pure, used by `builtin-entry.ts` |
| `bridges/mcp/builtin-escape.ts`, `substitute.ts` | Built-in encoder, encoder parameter | ✓ VERIFIED | Wired; adapter path passes `ADAPTER_FIELD_ENCODER` (default, P2-DC-53); `adapter-entry.ts` touched by 7 lines only |
| `bridges/mcp/builtin-entry.ts`, `builtin-description.ts` | Config builder, description reader | ✓ VERIFIED | Used by the step; description reader reuses `manifest-containment` |
| `bridges/mcp/builtin-registration.ts` | Idempotent sync | ✓ VERIFIED | JSON-compare skip, per-call try/catch for register and unregister |
| `bridges/mcp/builtin-overrides.ts` | Synchronous `mcp.json` reader | ✓ VERIFIED | Used by `info-mcp-status.ts`; all errors read as no server |
| `orchestrators/mcp/builtin-registration-step.ts` | Step and resync | ✓ VERIFIED | Replaces the Phase 1 seed; both entry points call one `syncSession` |
| `platform/mcp-builtin-status.ts` | Status reader | ✓ VERIFIED | Built at factory time without reading `pi` (`index.ts:105`) |
| `orchestrators/plugin/info-mcp-status.ts` | Built-in `info` arm | ✓ VERIFIED | Called from `info.ts:3159`; adapter arm unchanged |
| `docs/mcp-compatibility.md` | Built-in column | ✓ VERIFIED | See truth 5 |
| Feature files and step modules (11 features, 5 step modules, 4 libs) | Lifted and new scenarios | ✓ VERIFIED | All under `features/mcp-server/` and `features/lib/`; only owned files changed (`git diff --stat 87d3f28..HEAD` shows no frozen file edited) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `index.ts` factory | `builtinRegistrationStep` | `createMcpSessionMaterializer` at `session_start` | WIRED | `index.ts:128-131`, `session-materialize.ts:45-51` |
| `prepareResources` (`resources_discover`) | `resyncBuiltinRegistrations` | after `loadReconcile`, own try/catch | WIRED | `index.ts:188-195` |
| `index.ts` | `createBuiltinMcpStatusReader(pi)` | `mcpStatus.builtin` | WIRED | `index.ts:103-106` |
| `info.ts` | `withMcpServerStatus` | `lookup.implementation` picks the arm | WIRED | `info.ts:3159` |
| registration step | status owners and replaced-name notes | `noteBuiltinServerOwners`, `REGISTRATION_NOTES` | WIRED | `builtin-registration-step.ts` `syncSession`; read by `info-mcp-status.ts` `ownedElsewhere` and the reader |
| step | frozen `recordedMcpServers` / `createLegacyServersReader` | MREC-02 | WIRED | `recordRegistrations` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Registered config | `desired` map | `state.json` records, then recorded or legacy-read server configs, then the plugin's real `process.env`, `ctx.cwd`, data dir | Yes: scenarios show the stub receiving resolved `env`, `args`, `headers` | ✓ FLOWING |
| `info` built-in status | reader answer | Pi's live `getMcpServers()` and `getAllTools()` per lookup | Yes: scenarios show each token | ✓ FLOWING |
| Override and owner stamps | `configured`, `serverOwners` | `mcp.json` files read synchronously; the step's own last sync | Yes, process-level state written by the step (P2-DC-92) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Switch scenario (adapter, none, built-in, adapter) | `npm run test:cucumber:profile -- --profile adapter features/mcp-server/implementation-switch.feature` (nondac shell, as briefed) | 3 scenarios, 58 steps passed | ✓ PASS |
| Whole builtin cucumber profile | `... --profile builtin` | 98 scenarios, 97 passed; sole failure `companion-missing.feature:61` | ✓ PASS (known, deferred) |
| Phase unit pairs | `node --test` on the step, registration, status, escape, translation and info-mcp-status tests | 144/144 | ✓ PASS |
| Pi resolver conformance | `node --test test/integration/mcp-builtin-encoding-conformance.test.ts` | 63/63 | ✓ PASS |
| Static gate | `npm run check:static` | typecheck, lint, workflows lint, fallow, format, corresponding tests, `check:features` all passed | ✓ PASS |

Gate evidence cited, not re-run: `test:unpaired`, `test:integration`, `test:coverage:direct:all`, `test:modules` exit 0 and adapter profile 1564/1564 (seed 679076), per the orchestrator.

### Probe Execution

Step 7c: SKIPPED. The phase declares no `probe-*.sh` scripts.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| MSEL-02 | 02-07 | Switch needs no plugin action | ✓ SATISFIED | Switch scenario passes; `/reload` alone not run (P2-DC-88, listed under 1b) |
| MSEL-03 | 02-01, 02-07 | No registration under adapter or none | ✓ SATISFIED | Gate in `syncSession`; listing and switch scenarios |
| MSEL-04 | 02-07 | Adapter entries still written at install | ✓ SATISFIED | MSEL-04 scenario passes |
| MREC-02 | 02-01, 02-07 | Pre-milestone record works with no reinstall | ✓ SATISFIED | `@mcp` scenario under both profiles |
| BLT-01 | 02-01, 02-02, 02-03, 02-06, 02-09 | Registered on every startup and `/reload`; tools callable | ✓ SATISFIED for startup; `/reload` leg is a human item | See truths 1a, 1b |
| BLT-02 | 02-01, 02-02, 02-03 | Claude's values, no Pi reinterpretation | ✓ SATISFIED | Truth 2 |
| BLT-03 | 02-05 | Project servers only when trusted | ✓ SATISFIED | `builtin-trust.feature`, `project-scope.feature` |
| BLT-04 | 02-01, 02-04, 02-09 | Names, fold recorded, collision or override reported | ? NEEDS HUMAN | Names and fold verified; "never silent" is truth 3b |
| BLT-05 | 02-04 | `info` status tokens | ✓ SATISFIED | `builtin-status.feature` |
| BLT-06 | 02-06 | Disable, uninstall, enable, update effects | ✓ SATISFIED | `lifecycle.feature` twins |
| MDOC-01 | 02-08 | Built-in column with citations | ✓ SATISFIED | Truth 5 |

All 11 phase IDs appear in at least one PLAN `requirements:` field and in the matching SUMMARY `requirements-completed:`. No orphaned IDs: REQUIREMENTS.md maps exactly these 11 to Phase 2. REQUIREMENTS.md still shows them "Pending" and unchecked; that file belongs to the parent session, so I left it alone.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| Phase files | n/a | `TBD`, `FIXME`, `XXX`, `TODO`, `HACK` | None found | Debt-marker gate clear |
| `builtin-registration-step.ts`, `platform/mcp-builtin-status.ts` | n/a | Process-level mutable state (replaced names, name owners) written by the step, read by info | ℹ️ Info | Recorded as P2-DC-92 with completion-cache and routing-state as precedent; unit-tested |
| `info-mcp-status.ts` | `ownedElsewhere` | Foreign-extension collision not detectable | ⚠️ Warning | P2-DC-46, documented; part of truth 3b |

### Review Findings (02-REVIEW.md, 02-REVIEW-FIX.md)

The review found 0 critical, 5 warning, 2 info. I read the final code for each fix instead of trusting the fix report.
- WR-01 (containment): `owningRoot` selects one root per record (own `plugin-clones/<key>/`, else the marketplace root, which for a non-`path` marketplace must lie inside `sources/<mp>/`). Present in the code; unit-tested per the report and my 144/144 run.
- WR-02 (leading `~`): `startsWithHome` in `builtin-entry.ts`; scenario "arg resolves to a leading ~" is in `builtin-status.feature` and passes.
- WR-03 and WR-04 (status mapping): `replacedRegistrations` and `serverOwners` present and consulted; unit rows pass. The fix report marks WR-01, WR-03 and WR-04 "requires human verification (logic change)". Their cucumber coverage is partial by design: no scenario for the WR-03 race or the WR-04 cross-marketplace case (P2-DC-97), unit tests only.
- WR-05 (a `Then` that issued a Pi command): split into a `When` and a pure `Then`.
- IN-01, IN-02: redaction and per-removal try/catch present.

### Human Verification Required

### 1. Is an info-only report "never silent" for BLT-04?

**Test:** Decide whether the recorded design satisfies "a name collision or an `mcp.json` entry that overrides a plugin server is reported, never silent".
**Expected:** Either accept `info` plus Pi's `/mcp` as the report and the foreign-extension collision as a documented gap (P2-DC-08, P2-DC-46), or schedule a load-time notice (new closed-set message).
**Why human:** Product judgment. The behavior matches the recorded design and passes its scenarios, but a user who never runs `info` or `/mcp` gets no notice, and the foreign-owner case shows the other extension's server state on the plugin's row.

### 2. `/reload` and new-session legs of BLT-01 under built-in

**Test:** Under Pi's built-in MCP, run `/reload` in a running Pi with an installed plugin, then start a new session in the same Pi, then search for and call the plugin's tool.
**Expected:** The server is registered again each time and the call reaches the stub, with no plugin command.
**Why human:** No builtin scenario drives these. Fresh-Pi starts stand in for `/reload` by project convention (D-CF6-11); the in-process new-session scenario is `@adapter-only` because of a Pi 1.5.0 double `session_start` (P2-DC-77). Low risk, but unproven end to end.

### Gaps Summary

No blocking gap. Phase 2 delivers the registration step, the encoder and translation table, project-trust gating, the status reader and `info` arm, the switch and legacy-record scenarios, and the docs column, all wired and behaviorally exercised. I reproduced the builtin profile result (97/98) and the switch scenario (3/3). The one red scenario belongs to Phase 3's file and reads the correct BLT-05 answer. The remaining items are the two human decisions above, plus P2-DC-43 (the builtin profile is not fully green until Phase 3 rewrites that cell) which the parent must carry to the Phase 3 merge.

---

_Verified: 2026-11-04T17:30:00Z_
_Verifier: Claude (gsd-verifier)_


## Orchestrator disposition (2026-11-04)

The two human items above are persisted in `02-UAT.md` and accepted provisionally under the user's standing instruction for this autonomous run (P2-DC-100). The status is set to `passed` by that disposition, not by a human; the user reviews both items at the end of the milestone.
