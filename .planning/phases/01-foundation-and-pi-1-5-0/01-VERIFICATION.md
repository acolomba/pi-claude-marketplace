---
phase: 01-foundation-and-pi-1-5-0
verified: 2026-11-04T11:10:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .github/workflows/ci.yml
  - .planning/phases/01-foundation-and-pi-1-5-0/01-01-PLAN.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-01-SUMMARY.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-02-PLAN.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-02-SUMMARY.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-03-PLAN.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-03-SUMMARY.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-04-PLAN.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-04-SUMMARY.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-05-PLAN.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-05-SUMMARY.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-06-PLAN.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-06-SUMMARY.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-07-PLAN.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-07-SUMMARY.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-08-PLAN.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-08-SUMMARY.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-09-PLAN.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-09-SUMMARY.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-10-PLAN.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-10-SUMMARY.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-11-PLAN.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-11-SUMMARY.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-12-PLAN.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-12-SUMMARY.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-13-PLAN.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-13-SUMMARY.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-14-PLAN.md
  - .planning/phases/01-foundation-and-pi-1-5-0/01-14-SUMMARY.md
  - cucumber.json
  - extensions/pi-claude-marketplace/domain/mcp-implementation.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts
  - extensions/pi-claude-marketplace/orchestrators/mcp/session-materialize.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - package.json
  - scripts/check-features.mjs
covered_digest: "v4:sha256:295616ac267b1c102762b50e2970c63536e77bf4ea483f4e12bb3df8c5216c75"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 1: Foundation and Pi 1.5.0 Verification Report

**Phase Goal:** Every parallel phase can start from frozen ground: the extension runs on Pi 1.5.0, each run knows its active MCP implementation, install records keep every declared server in its Claude form, both implementation profiles exist as pure code, and every MCP scenario runs under an adapter profile and a built-in profile. No user-visible output changes yet.
**Verified:** 2026-11-04T11:10:00Z
**Status:** passed
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths

The five ROADMAP success criteria are the contract. They were checked against the code at HEAD `75e4d97` (code identical to `8d03f4e`, which CI tested; later commits touch docs only).

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Pi 1.5.0 raise (PI15-01..03): pins, lock, floor tests, version text, breakages fixed, suites pass on 1.5.0 | VERIFIED | `package.json` lines 19-21 and 62: pi-ai `1.5.0` exact, pi-coding-agent `^1.5.0` dev and `>=1.5.0` peer, pi-tui dev `^1.5.0`. `package-lock.json` root (lines 21-23, 44) matches and resolves pi-agent-core, pi-ai, pi-coding-agent at 1.5.0 (adds `pi-schema` 1.5.0). Installed `node_modules` all read 1.5.0. `test/architecture/peer-floor.test.ts` asserts `>=1.5.0`; `test/e2e/pi-json-output.test.ts` asserts 1.5.0 twice; `test/e2e/pi-peer-floor/package.json` pins 1.5.0. Version text: README.md and README.es.md line 38, AGENTS.md line 57, STACK.md lines 32-34, PROJECT.md line 1567, `docs/mcp-compatibility.md` line 9, `docs/workflows-compatibility.md`. The three breakages: no test quotes the moved pi-schema validation text (01-01-SUMMARY); 17 untrusted-start scenarios pass under the `isProjectTrusted()` fix; `clientRegistration` needs no code (D-MB-11). Unit, integration, and cucumber suites pass (see Spot-Checks). |
| 2 | Each run reads one active MCP implementation from its run snapshot; an architecture test rejects a factory-time probe (MSEL-01) | VERIFIED | `platform/pi-api.ts` `softDepStatus` returns `mcpImplementation` from `activeMcpImplementation(adapterLoaded, hasLoadedBuiltinMcp(commands))` (adapter wins, then built-in only for an extension command `mcp` with `sourceInfo.path === "builtin:mcp"`, else `none`). `shared/notification-run.ts:72` and `openNotificationRun` take `softDepStatus(pi)` once per run; command, load, and hook runs open their runs through it (`edge/command-invocation.ts`, `index.ts:160`, `bridges/hooks/dispatch.ts:553`, `settle.ts:165`, `async-rewake/registry.ts:433`). `session-materialize.ts` runs at `session_start` (`index.ts:270-281`). `test/architecture/no-factory-time-probe.test.ts` runs the real factory against a recording Pi, fails on any `getCommands`/`getAllTools`/`getActiveTools`/`getMcpServers` read there, and requires a read at `session_start`; it passes in `test:unpaired`. |
| 3 | Install, update, reinstall, enable, import record every declared non-malformed server in Claude form before substitution; no absolute path; legacy records load; output unchanged (MREC-01) | VERIFIED | Producers: `domain/mcp-resolution.ts:362` (`declaredMcpServers` in merge order, blocked servers included; `mcpBundle` at 372), `install-outcome.ts:1610-1611` (statePhase, used by install, reinstall, enable, import), `update-swap.ts:893-897` and `update-preflight.ts:780-798` (update, enabled and disabled). Schema in `persistence/state-io.ts:154-162` is optional and additive (no schema bump); `mcpServerConfigsOf` deep-copies unexpanded configs. Reader `orchestrators/mcp/recorded-servers.ts` answers `recorded`/`re-resolved`/`unreadable`. `test/integration/mcp-server-records.test.ts` drives the real operations for install, update, enable, disabled update, reinstall, and import and reads the saved `state.json`: 6/6 pass, unexpanded `${CLAUDE_PLUGIN_ROOT}` kept, blocked server recorded. No output change: see Truth 5 check. |
| 4 | Cucumber has adapter and builtin profiles; shared steps; each profile's Pi proves its implementation; an architecture check fails on an untagged one-profile MCP scenario; restart steps and built-in stand-in exist; CI runs both profiles within timeouts (DUAL-01..03) | VERIFIED | `cucumber.json` defines `adapter` (`not @builtin-only`) and `builtin` (`(@mcp or @builtin-only) and not @adapter-only`) with `worldParameters.mcpImplementation`. `scripts/check-features.mjs:559-600` enforces exactly one implementation tag on an MCP scenario, bans naming pi-mcp-adapter in `@mcp`, and requires an ID on `@adapter-only`/`@builtin-only`; it runs in `check:static` and exits 0. `features/mcp-server/implementation-profiles.feature` holds the restart seeds (without adapter, adapter, built-in on, no mcp); the stand-in is `features/lib/builtin-mcp-stand-in/`. I ran the builtin profile (39/39 scenarios, 529 steps) and `features/mcp-server` under adapter (65/65, 879 steps). `ci.yml` has a profile axis (adapter lifecycle, adapter components, builtin all); `behavioral-shard-coverage.test.ts` passes. CI run 41812979607 (re-read with `gh`): all nine jobs success; adapter lifecycle 204 s, adapter components 248 s, builtin 79 s, all under the 15-minute `timeout-minutes`. |
| 5 | Every frozen file and interface exists with no-op session seeds; adapter-only tags name owners; D-MB-01..07 in PROJECT.md; APL-D1 text updated; `npm run check` and both profiles pass (MDEC-01) | VERIFIED | `01-FROZEN.md` lists files and the ten interfaces as built; spot-checked against code: `domain/mcp-implementation.ts` (`profileFor`, `effectiveMcpCompatibility`, `RecordedMcpServers` union, `toolNamePrefix` returning `string \| undefined` per CR-02), `session-materialize.ts` (`createMcpSessionMaterializer`, two steps each in its own try/catch), `builtin-registration-step.ts`/`agent-grants-step.ts`/`platform/mcp-builtin-status.ts` seeds, `EdgeDeps.mcpStatus`, status call in `orchestrators/plugin/info.ts:3152`. PROJECT.md lines 1983-1995 carry D-MB-01..13; D-MB-03 amends APL-D1; D-CF1-16 amended for DUAL-03. Closed-set entries (`requires mcp`, `requires builtin mcp`, two statuses, two companions) appear in `docs/json-output.md` and the lock tests. `git diff 2799bd1..HEAD -- docs/output-catalog.md test/architecture/catalog-uat` prints nothing, so no catalog or visible output changed. The orchestrator's `npm run check` exit 0 (1558 adapter + 39 builtin scenarios) is corroborated by CI success on the same code. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `package.json`, `package-lock.json` | Pi 1.5.0 pins | VERIFIED | Pins as in Truth 1; lock matches |
| `extensions/pi-claude-marketplace/domain/mcp-implementation.ts` | Pure profiles, effective compatibility | VERIFIED | Substantive (profiles, hashing rule, effective read); consumed by `recorded-servers.ts`/tests; Phase 3 consumer expected (fallow `entry` exemption recorded in FROZEN section 3) |
| `extensions/pi-claude-marketplace/domain/mcp-builtin-features.ts`, `mcp-server-features.ts` | Built-in scanner, `sse` split | VERIFIED | Imported by the profile file |
| `extensions/pi-claude-marketplace/domain/name.ts` | `builtinMcpServerName` | VERIFIED | Used by both profile functions |
| `extensions/pi-claude-marketplace/platform/pi-api.ts` | `mcpImplementation`, `PiMcpRegistry`, id types | VERIFIED | Lines 173-179, 336-369 |
| `extensions/pi-claude-marketplace/persistence/state-io.ts` | Record fields, `mcpServerConfigsOf`, `replaceCompatibility` | VERIFIED | Wired into install, update, preflight, mcp-migration |
| `extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts` | Only reader with legacy re-resolve | VERIFIED | Real reader with `version-mismatch` refusal and debug log; test pair passes |
| `extensions/pi-claude-marketplace/orchestrators/mcp/session-materialize.ts` + two step seeds | No-op seeds, fixed order | VERIFIED | Composed in `index.ts:128`; seeds intentionally no-op (Phase 2 and 4 own bodies) |
| `platform/mcp-builtin-status.ts`, `mcp-status.ts`, `edge/{types,register}.ts`, `info.ts` | Status reader pair and call | VERIFIED | `mcpStatus` readers wired; seed answers `no-snapshot` |
| `shared/{notification-types,notification-wire,notify-reasons}.ts`, `docs/json-output.md` | Closed-set entries, not emitted | VERIFIED | Entries present, lock counts consistent, catalog unchanged |
| `cucumber.json`, `scripts/check-features.mjs`, `.github/workflows/ci.yml`, `features/support/mcp-implementation.ts`, `features/lib/mcp-implementation.ts`, `features/lib/builtin-mcp-stand-in/**`, `features/mcp-server/implementation-profiles.feature` | Dual-profile harness | VERIFIED | Run green under both profiles |
| `test/architecture/no-factory-time-probe.test.ts`, `behavioral-shard-coverage.test.ts` | Architecture tests | VERIFIED | Pass in `test:unpaired` |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `index.ts` | `session-materialize.ts` + step modules | `createMcpSessionMaterializer` at `session_start` | WIRED | `index.ts:128`, `270-281` |
| `index.ts` | `resyncBuiltinRegistrations` | after `loadReconcile`, own try/catch | WIRED | `index.ts:192` |
| `notification-run.ts` | `softDepStatus` | one probe per run | WIRED | `:72`, `openNotificationRun` |
| `info.ts` | `EdgeDeps.mcpStatus` reader | `withServerStatus` picks reader by `run.softDeps.mcpImplementation` | WIRED | `info.ts:3152` |
| install, update, preflight writers | `mcpServerConfigsOf` / `replaceCompatibility` | record producers | WIRED | grep list above; integration test reads `state.json` |
| `recorded-servers.ts` | resolver `declaredMcpServers` | legacy re-resolve | WIRED | `recorded-servers.ts:181-185` |
| `ci.yml` | `test:cucumber:profile` | matrix profile and shard | WIRED | `ci.yml:119-174` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `state.json` record | `mcpServerConfigs` | resolver `declaredMcpServers` from the plugin's real `.mcp.json` and manifest | Yes (integration test reads saved file) | FLOWING |
| Run snapshot | `mcpImplementation` | `pi.getCommands()` / `getAllTools()` at run open | Yes (builtin and adapter profile scenarios prove each Pi's implementation) | FLOWING |

No consumer of `effectiveMcpCompatibility`, `recordedMcpServers`, or the status seed exists yet. That is by design: Phases 2 and 3 own those consumers, and `.fallowrc.json` carries the recorded `entry` exemptions that Phase 6 removes.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Records written by every operation | `node --test test/integration/mcp-server-records.test.ts` | 6 pass, 0 fail | PASS |
| Feature-tag rules | `npm run check:features` | exit 0 | PASS |
| Architecture and unpaired tests | `npm run test:unpaired` | exit 0 | PASS |
| All module unit tests | `npm run test:modules` | exit 0 (132 s) | PASS |
| Builtin profile | `npm run test:cucumber:profile -- --profile builtin features` | 39/39 scenarios, 529/529 steps | PASS |
| Adapter profile, MCP features | `npm run test:cucumber:profile -- --profile adapter features/mcp-server` | 65/65 scenarios, 879/879 steps | PASS |
| No visible output change | `git diff 2799bd1..HEAD --stat -- docs/output-catalog.md test/architecture/catalog-uat` | empty | PASS |
| CI on the tested code | `gh run view 41812979607` | all jobs success on head 8d03f4e | PASS |

I did not re-run the full `npm run check` (513 s, run by the orchestrator at 8d03f4e). CI ran the same gates on that commit and the only later commits change documents.

### Probe Execution

Step 7c: SKIPPED. No PLAN declares a `probe-*.sh`, and `scripts/*/tests/probe-*.sh` does not exist in this repo.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| PI15-01 | 01-01, 01-14 | Pins and lock at 1.5.0 | SATISFIED | Truth 1 |
| PI15-02 | 01-01, 01-14 | Floor tests and docs name 1.5.0 | SATISFIED | Truth 1 (peer-floor, pi-json-output, README x2, AGENTS, STACK, PROJECT, compatibility docs) |
| PI15-03 | 01-01, 01-14 | 1.5.0 breakages fixed; suites pass | SATISFIED | Truth 1; modules, unpaired, builtin, and adapter MCP runs green here; full check green in CI |
| MSEL-01 | 01-03, 01-05, 01-06, 01-11, 01-14 | One active implementation per run, no early probe | SATISFIED | Truth 2 |
| MREC-01 | 01-03, 01-08, 01-12, 01-14 | Claude-form servers recorded, legacy loads | SATISFIED | Truth 3 |
| DUAL-01 | 01-02, 01-07, 01-09, 01-10, 01-13, 01-14 | Two profiles, shared steps | SATISFIED | Truth 4 |
| DUAL-02 | 01-07, 01-09, 01-13, 01-14 | Pi proves implementation; tag rule | SATISFIED | Truth 4 |
| DUAL-03 | 01-13, 01-14 | CI within timeouts | SATISFIED | CI jobs 204 s, 248 s, 79 s; D-CF1-16 recorded |
| MDEC-01 | 01-02, 01-04, 01-14 | Decision IDs in PROJECT.md | SATISFIED | PROJECT.md 1983-1995 (D-MB-01..13), APL-D1 amended by D-MB-03 |

All nine IDs in ROADMAP and in plan frontmatter are accounted for. Plans 01-05, 01-08, 01-09, 01-11 omit a `requirements:` line in their frontmatter but the ROADMAP plan list names the IDs they serve. No requirement mapped to Phase 1 in REQUIREMENTS.md is orphaned. DUAL-04 belongs to Phase 6.

REQUIREMENTS.md still shows these nine as `[ ]` / `Pending`. The orchestrator should flip them when it commits the phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `orchestrators/mcp/builtin-registration-step.ts`, `agent-grants-step.ts`, `platform/mcp-builtin-status.ts` | n/a | Empty/no-op bodies | Info | Intended seeds with frozen signatures; later phases own the bodies (ROADMAP success criterion 5 says "no-op seeds") |
| `docs/mcp-compatibility.md` | 80 | Dated measurement still says "On Pi 1.4.0" | Info | A statement of a 2026-11-01 measurement, not a version claim; not stale text, but not re-measured on 1.5.0 |
| `scripts/check-features.mjs` | 47-52, 552-556 | Tag-rule heuristics accept non-IDs (`UTF-8`) and miss `mcp__` names (IN-01) | Info | Out-of-scope review finding; no current scenario slips through (P1-DC-36) |
| TBD/FIXME/XXX markers | n/a | none found in the changed extension files by the review and gate (`check:static` is green) | n/a | |

### Human Verification Required

None. Every check above ran in this session or in CI.

### Gaps Summary

No gaps. The phase goal holds: Pi 1.5.0 is pinned and exercised, the run snapshot carries the active implementation and no factory-time probe exists, records keep every declared server in Claude form through all five write paths, both profiles exist as pure code, and every MCP scenario runs under both cucumber profiles in CI inside the timeouts. No visible output changed.

Residual risks that do not fail the phase:

- Review fixes CR-02 (`toolNamePrefix` may be `undefined`) and WR-01 (legacy reader `version-mismatch`) changed frozen interfaces after the plans ran. `01-FROZEN.md` records both, and unit tests pin them. Child sessions must read `01-FROZEN.md`, not the ROADMAP interface text.
- Decisions D-MB-08..13 were settled autonomously and wait for the user's review (marked "pending user review" in PROJECT.md).
- The adapter `toolName` rule matches pi-mcp-adapter 7.0.0; the built-in `grantSelector` is unchecked against pi-subagents' grant syntax (Phase 4).

---

_Verified: 2026-11-04T11:10:00Z_
_Verifier: Claude (gsd-verifier)_
