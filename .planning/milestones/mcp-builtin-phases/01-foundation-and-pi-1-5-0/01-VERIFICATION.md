---
phase: 01-foundation-and-pi-1-5-0
verified: 2026-11-05T09:00:00Z
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
covered_digest: "v4:sha256:385ec464842921a4ef0a6cd53e55bd935a8fff66daf59e66ef87bcab853f46ee"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 1: Foundation and Pi 1.5.0 Verification Report

**Phase Goal:** Every parallel phase can start from frozen ground: the extension runs on Pi 1.5.0, each run knows its active MCP implementation, install records keep every declared server in its Claude form, both implementation profiles exist as pure code, and every MCP scenario runs under an adapter profile and a built-in profile. No user-visible output changes yet.
**Verified:** 2026-11-05T09:00:00Z
**Status:** passed
**Re-verification:** Yes. Milestone-close re-verification on the combined tree (`features/mcp-builtin`, HEAD `ca56636`). The 2026-11-04 report went stale only because Phases 2 to 6 changed files it covers.

## Goal Achievement

The five ROADMAP success criteria are the contract. Each was re-checked against the current code, not against the earlier report.

### What Phases 2 to 6 legitimately changed on the covered surface

The covered files changed in four ways, and none of them weakens a Phase 1 truth. `01-FROZEN.md` already records the amendments as "Amended by mcp-builtin Phase 6".

| Covered surface | Change since the Phase 1 gate (`8d03f4e`) | Why it is legitimate |
| --- | --- | --- |
| `platform/pi-api.ts` | `SoftDepStatus.piMcpAdapterLoaded` removed (3 lines). `mcpImplementation` and the adapter probe stay. | D-P6-09: no production code read the derived boolean. The probe order and counts are unchanged. |
| `orchestrators/mcp/recorded-servers.ts` | `LegacyServersSource.locations`, the `uncontained` refusal, `isPluginRootContained`, a redacted debug line; the error class and its reason type are module-private. | UF-1/NFR-10, UF-4, D-P6-21, D-P6-23. The reader still answers `recorded`, `re-resolved`, or `unreadable`, and still writes nothing. |
| `domain/mcp-implementation.ts` (since `f3ab832`) | `toolNamePrefix` returns `string \| undefined`. | CR-02 from the Phase 1 review, recorded in `01-FROZEN.md` before the Phase 1 gate closed. |
| `persistence/state-io.ts` | Adds `replaceCompatibility` and a comment on `compatibilityBasis`. | WR-02, recorded in `01-FROZEN.md`. |
| The "no-op seeds" | `builtin-registration-step.ts` (281 lines), `agent-grants-step.ts` (94), `platform/mcp-builtin-status.ts`, `info-mcp-status.ts` now have bodies. | Phase 1 criterion 5 required no-op seeds as frozen signatures; Phases 2 and 4 own the bodies. |
| "No user-visible output changes yet" | Phases 2 to 5 now change output: markers, `{requires mcp}` rows, status tokens. | The sentence scoped Phase 1 only. Phase 1 added the closed-set entries and emitted none. The combined tree emits all six (`01-FROZEN.md` section 4). |

The fallow `entry` and `ignoreExports` exemptions that Phase 1 added are gone: `.fallowrc.json` has one `entry` (the extension index) and no `ignoreExports`, because `effectiveMcpCompatibility` and `recordedMcpServers` now have consumers (`orchestrators/plugin/mcp-verdict-read.ts`, `builtin-registration-step.ts`, `orchestrators/reconcile/mcp-migration.ts`, `edge/handlers/plugin/info.ts`).

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Pi 1.5.0 raise (PI15-01..03): pins, lock, floor tests, version text, breakages fixed, suites pass on 1.5.0 | VERIFIED | `package.json` lines 19-21 and 62: pi-ai `1.5.0` exact, pi-coding-agent `^1.5.0` dev and `>=1.5.0` peer, pi-tui dev `^1.5.0`. The lock root entry (read with `node`) matches, and `packages` resolve pi-coding-agent, pi-ai, pi-tui, pi-agent-core, and pi-schema at 1.5.0. The installed `node_modules` copies of the three packages all read 1.5.0. `test/architecture/peer-floor.test.ts` asserts `>=1.5.0` and the dev pins, and it passes here. `test/e2e/pi-json-output.test.ts` asserts 1.5.0 twice. `test/e2e/pi-peer-floor/package.json` pins 1.5.0. Version text: README.md and README.es.md line 38, AGENTS.md line 57, STACK.md lines 32-34, PROJECT.md lines 32 and 1619, `docs/mcp-compatibility.md` lines 9 and 11, `docs/workflows-compatibility.md` lines 13 and 208. The three breakages were fixed in Phase 1 (01-01-SUMMARY), and the combined-tree gate proves the suites on 1.5.0 (see Spot-Checks). |
| 2 | Each run reads one active MCP implementation from its run snapshot; an architecture test rejects a factory-time probe (MSEL-01) | VERIFIED | `platform/pi-api.ts` `softDepStatus` (lines 361-370) returns `mcpImplementation` from `activeMcpImplementation(adapterLoaded, hasLoadedBuiltinMcp(commands))`: the adapter wins, built-in only for an extension command `mcp` with `sourceInfo.path === "builtin:mcp"`, else `none`. `shared/notification-run.ts:72` is the only production caller of `softDepStatus`. Command runs (`edge/command-invocation.ts:89`, `skill-aliases.ts:140`, `command-run.ts` injects `openRun`), the load (`index.ts:160`), and hook runs (`bridges/hooks/dispatch.ts:574`, `settle.ts:165`, `async-rewake/registry.ts:433`) open their runs through it. Tool runs read `openNotificationSnapshot` (`edge/handlers/tools.ts:161,511`; `bridges/hooks/mcp-tool-view.ts:103`). `index.ts:270-281` runs the session steps at `session_start`, and `index.ts:192` resyncs after `loadReconcile`. `register.ts` reads the implementation per completion lookup, not at registration. `test/architecture/no-factory-time-probe.test.ts` ran green here. |
| 3 | Install, update, reinstall, enable, import record every declared non-malformed server in Claude form before substitution; no absolute path; legacy records load (MREC-01) | VERIFIED | Producers: `domain/mcp-resolution.ts:387` (`declaredMcpServers`, merge order) and `:397` (`mcpBundle`); `install-outcome.ts:1655-1656` (statePhase for install, reinstall, enable, import); `update-swap.ts:950-954` (update); `update-preflight.ts:841-862,930-934` (disabled update). The schema in `persistence/state-io.ts:154-162` is optional and additive. `mcpServerConfigsOf` deep-copies the unexpanded configs. `test/integration/mcp-server-records.test.ts` drives the real operations and reads the saved `state.json`: it passed here, with `${CLAUDE_PLUGIN_ROOT}` kept unexpanded and a blocked server recorded. `test/orchestrators/mcp/recorded-servers.test.ts` passed, including the legacy re-resolve and every refusal. The last clause of the criterion ("list, info, and install output is unchanged") held at the Phase 1 gate and is superseded for the combined tree by Phase 3's verdict rows, which is the point of those phases. |
| 4 | Cucumber has adapter and builtin profiles with shared steps; each profile's Pi proves its implementation; an architecture check fails on an untagged one-profile MCP scenario; restart steps and built-in stand-in exist; CI runs both profiles within timeouts (DUAL-01..03) | VERIFIED | `cucumber.json` defines `adapter` (`not @builtin-only`) and `builtin` (`(@mcp or @builtin-only) and not @adapter-only`) with `worldParameters.mcpImplementation`. `scripts/check-features.mjs` enforces the implementation tags (including `@own-implementation`) and exits 0 on the current tree. I ran `features/mcp-server/implementation-profiles.feature` under both profiles: adapter 5/5 scenarios (58 steps), builtin 1/1 (13 steps); these cover the restart steps, the stand-in, and each Pi proving its implementation. `ci.yml` has the three-leg profile matrix (adapter lifecycle, adapter components, builtin all) with `timeout-minutes: 15` and `fail-fast: false`, unchanged since the Phase 1 gate; `behavioral-shard-coverage.test.ts` passes. Timings from CI run 41812979607 (204 s, 248 s, 79 s) stand and `01-FROZEN.md` records them. The combined-tree gate ran both profiles: adapter 1603/1603, builtin 133/133. CI run 41967152313 on `2b6f2f4` succeeded on attempt 2 after the known adapter flake P3-DC-111. |
| 5 | Every frozen file and interface exists; adapter-only tags name owners; D-MB-01..07 in PROJECT.md; APL-D1 text updated; `npm run check` and both profiles pass (MDEC-01) | VERIFIED | Every path in the 01-FROZEN.md section 1 list exists. Their diffs since the Phase 1 gate are only the amendments in the table above, plus the closed-set emitters (`notify-reasons.ts`, `docs/json-output.md`) and the parent-line edits (`edge/register.ts`). The interface signatures in section 2 match the code, with the section's recorded Phase 6 amendments. PROJECT.md carries D-MB-01..13 (and later D-MB-14..29); D-MB-03 amends APL-D1 (line 1760 names it). `npm run check` exit 0 on `71a37c4` (static, unpaired, integration, cucumber adapter 1603/1603 and builtin 133/133, direct coverage), from the fix-gate log. `git diff --stat 71a37c4 HEAD` and `git diff --stat 2b6f2f4 HEAD`, both excluding `.planning/`, print nothing, so HEAD has the same build inputs as the gated trees. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `package.json`, `package-lock.json` | Pi 1.5.0 pins | VERIFIED | As in Truth 1 |
| `domain/mcp-implementation.ts` | Pure profiles, effective compatibility | VERIFIED | Substantive and now consumed (`mcp-verdict-read.ts`, `builtin-registration-step.ts`, `mcp-migration.ts`, `info.ts`); unit pair `test/domain/mcp-implementation.test.ts` passes |
| `domain/mcp-builtin-features.ts`, `mcp-server-features.ts`, `name.ts` | Built-in scanner, `sse` split, `builtinMcpServerName` | VERIFIED | Unchanged since `f3ab832` |
| `platform/pi-api.ts` | `mcpImplementation`, `PiMcpRegistry`, id types | VERIFIED | Snapshot at lines 169-177 and 361-370; only the dead boolean was removed |
| `persistence/state-io.ts` | Record fields, `mcpServerConfigsOf`, `replaceCompatibility` | VERIFIED | Wired into install, update, preflight, and `mcp-migration.ts` |
| `orchestrators/mcp/recorded-servers.ts` | The one reader with the legacy re-resolve | VERIFIED | Hardened by UF-1 and UF-4; used by the registration step and the verdict read |
| `orchestrators/mcp/session-materialize.ts` | Fixed-order session steps, each in its own try/catch | VERIFIED | Composed at `index.ts:128`; its test passes |
| `cucumber.json`, `scripts/check-features.mjs`, `.github/workflows/ci.yml` | Dual-profile harness | VERIFIED | Unchanged since the gate; the check exits 0 |
| `features/lib/mcp-implementation.ts`, `features/lib/builtin-mcp-stand-in/**`, `features/mcp-server/implementation-profiles.feature` | Harness, stand-in, restart seeds | VERIFIED | The feature runs green under both profiles |
| `test/architecture/no-factory-time-probe.test.ts`, `behavioral-shard-coverage.test.ts` | Architecture tests | VERIFIED | Pass |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `index.ts` | `session-materialize.ts` and the step modules | `createMcpSessionMaterializer` at `session_start` | WIRED | `index.ts:128`, `270-281` |
| `index.ts` | `resyncBuiltinRegistrations` | after `loadReconcile`, own try/catch | WIRED | `index.ts:192` |
| `notification-run.ts` | `softDepStatus` | one probe per run | WIRED | `:72` |
| `info.ts` | `EdgeDeps.mcpStatus` | reader chosen by `run.softDeps.mcpImplementation` | WIRED | `edge/register.ts`, `edge/types.ts`, `orchestrators/plugin/info.ts` |
| install, update, preflight writers | `mcpServerConfigsOf`, `replaceCompatibility` | record producers | WIRED | grep list in Truth 3 |
| `recorded-servers.ts` | resolver `declaredMcpServers` | legacy re-resolve | WIRED | `recordedMcpServers` calls `resolveStrict` |
| `ci.yml` | `test:cucumber:profile` | matrix profile and shard | WIRED | `ci.yml:119-174` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `state.json` record | `mcpServerConfigs` | resolver `declaredMcpServers` from the plugin's real `.mcp.json` and manifest | Yes (integration test reads the saved file) | FLOWING |
| Run snapshot | `mcpImplementation` | `pi.getCommands()` and `getAllTools()` at run open | Yes (each profile's Pi proves its implementation) | FLOWING |
| Profiles and `effectiveMcpCompatibility` | verdicts | read by the Phase 2 and 3 consumers listed above | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Probe ban, floor, shard coverage, record writes, reader, profiles, session steps | `node --test` over `no-factory-time-probe`, `peer-floor`, `behavioral-shard-coverage`, `mcp-server-records` (integration), `recorded-servers`, `mcp-implementation`, `session-materialize` | 97 pass, 0 fail | PASS |
| Feature-tag rules | `node scripts/check-features.mjs` | exit 0 | PASS |
| Adapter profile Pi proof and restarts | `cucumber-js --profile adapter features/mcp-server/implementation-profiles.feature` | 5/5 scenarios, 58/58 steps | PASS |
| Builtin profile Pi proof | `cucumber-js --profile builtin features/mcp-server/implementation-profiles.feature` | 1/1 scenario, 13/13 steps | PASS |
| Full gate on the combined tree | `npm run check` on `71a37c4` (log `fix-gate.log`) | EXIT=0; adapter 1603/1603 (17397 steps), builtin 133/133 (1681 steps) | PASS (reported by the caller, log read here) |
| Module unit tests | `test:modules` on `2b6f2f4` | exit 0 (reported by the caller) | PASS (not re-run) |
| CI | run 41967152313 on `2b6f2f4` | success on attempt 2 after the known adapter flake P3-DC-111 | PASS (reported by the caller) |
| HEAD equals the gated build inputs | `git diff --stat 71a37c4 HEAD -- . ':(exclude).planning'`, same for `2b6f2f4` | empty | PASS |

I did not re-run whole cucumber profiles or `npm run check`; the caller's instructions bar the first, and the gate evidence covers the second on identical build inputs.

### Probe Execution

Step 7c: SKIPPED. No PLAN declares a `probe-*.sh`, and `scripts/*/tests/probe-*.sh` does not exist in this repo.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| PI15-01 | 01-01, 01-14 | Pins and lock at 1.5.0 | SATISFIED | Truth 1 |
| PI15-02 | 01-01, 01-14 | Floor tests and docs name 1.5.0 | SATISFIED | Truth 1 |
| PI15-03 | 01-01, 01-14 | 1.5.0 breakages fixed; suites pass | SATISFIED | Truth 1; combined-tree gate |
| MSEL-01 | 01-03, 01-05, 01-06, 01-11, 01-14 | One active implementation per run, no early probe | SATISFIED | Truth 2 |
| MREC-01 | 01-03, 01-08, 01-12, 01-14 | Claude-form servers recorded, legacy loads | SATISFIED | Truth 3 |
| DUAL-01 | 01-02, 01-07, 01-09, 01-10, 01-13, 01-14 | Two profiles, shared steps | SATISFIED | Truth 4 |
| DUAL-02 | 01-07, 01-09, 01-13, 01-14 | Pi proves implementation; tag rule | SATISFIED | Truth 4 |
| DUAL-03 | 01-13, 01-14 | CI within timeouts | SATISFIED | Truth 4; CI timings in `01-FROZEN.md`; D-CF1-16 |
| MDEC-01 | 01-02, 01-04, 01-14 | Decision IDs in PROJECT.md | SATISFIED | Truth 5 |

All nine IDs in ROADMAP and in plan frontmatter are accounted for, and REQUIREMENTS.md marks all nine `[x]` / `Complete`. No requirement mapped to Phase 1 is orphaned. DUAL-04 belongs to Phase 6.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `scripts/check-features.mjs` | 47-52, 552-556 | Tag-rule heuristics accept non-IDs (`UTF-8`) and miss `mcp__` names (IN-01) | Info | Out-of-scope review finding; the check exits 0 on the combined tree (P1-DC-36) |
| `docs/mcp-compatibility.md` | 80 | Dated measurement may still say "On Pi 1.4.0" | Info | A statement of a dated measurement, not a version claim (carried from the earlier report; not re-read this round) |
| TBD/FIXME/XXX markers | n/a | None looked for beyond the diffs read; `check:static` is green in the gate | n/a | |

### Human Verification Required

None, as in the earlier report. Every check above ran in this session or in the cited gate and CI runs.

### Gaps Summary

No gaps. The Phase 1 goal still holds on the combined tree: Pi 1.5.0 is pinned and exercised, the run snapshot carries the active implementation with no factory-time probe, records keep every declared server in Claude form through all write paths, both profiles exist as pure code and now have consumers, and every MCP scenario runs under both cucumber profiles inside the CI timeouts. The one clause that no longer holds literally, "no user-visible output changes", described Phase 1 alone and was superseded on purpose by Phases 2 to 5.

Residual risks that do not fail the phase:

- Decisions D-MB-08..13 were settled autonomously in Phase 1 and are marked pending the user's review in PROJECT.md.
- The built-in `grantSelector` was unchecked against pi-subagents' grant syntax at Phase 1; Phase 4 owns that check and its own verification covers it.
- The CI check names changed in Phase 1 (P1-DC-36). A branch protection rule that names the old checks waits forever; check the required status checks before the pull request merges.

---

_Verified: 2026-11-05T09:00:00Z_
_Verifier: Claude (gsd-verifier)_
