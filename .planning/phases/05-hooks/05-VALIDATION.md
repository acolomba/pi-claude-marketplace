---
phase: "5"
slug: "hooks"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: true) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-01"
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit, architecture, integration), `@cucumber/cucumber` (behavioral) |
| **Config file** | `cucumber.json` and `package.json` scripts (both frozen after Phase 1) |
| **Quick run command** | `node --test test/bridges/hooks/<file>.test.ts`, `npx cucumber-js features/hook`, `npm run test:coverage:direct -- <changed source>` |
| **Full suite command** | `npm run check` (phase gate adds `npm run test:modules` and `npm run test:cucumber`), always with `npm_config_script_shell=<scratchpad>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144` |
| **Estimated runtime** | ~60 s quick (one feature file), ~25-40 min full |

---

## Sampling Rate

- **After every task commit:** the owner tests plus `npm run test:coverage:direct -- <changed source>`; the commit hook runs `check:commit`.
- **After every plan wave:** `npm run check` on the merged tree, after a lone `npm run lint` warm-up.
- **Before `/gsd-verify-work`:** `npm run check`, `npm run test:modules`, and `npm run test:cucumber` green.
- **Max feedback latency:** 120 seconds for the per-task loop.

---

## Per-Task Verification Map

Requirement-level map (task IDs are filled when plans exist; every plan task carries its own `<automated>` command).

| Requirement | Behavior | Scenario / test | Red proof (fails today because) | Test Type | File Exists | Status |
|-------------|----------|-----------------|--------------------------------|-----------|-------------|--------|
| HOOK-01 | SessionStart `clear` on new, `compact` after compaction, `clear`/`compact`/`fork` matchers | `features/hook/session.feature`; migrated `features/plugin/session-start-hooks.feature` | `source "new"`; no SessionStart on compaction; `clear` matcher trips `closed-set` | cucumber | ❌ / ✅ | ✅ | ✅ green
| HOOK-01 | mapping and matcher filter | `test/domain/components/hook-events.test.ts`, `test/bridges/hooks/payloads/session-start.test.ts`, `dispatch.test.ts`, `event-router.test.ts` | — | unit | ✅ change | ✅ | ✅ green
| HOOK-02 | SessionEnd `clear`/`resume`/`other`/`prompt_input_exit`; reload runs neither event; SessionEnd matchers | `features/hook/session.feature` (fork, quit, TUI reload) | `reason "new"`/`"fork"`/`"quit"`; reload sends `reload`; SessionEnd matchers trip `closed-set` | cucumber | ❌ | ✅ | ✅ green
| HOOK-02 | reason mapping by mode, reload skip, resume | `payloads/session-end.test.ts`, `event-router.test.ts` | — | unit | ✅ change | ✅ | ✅ green
| HOOK-03 | two compactions give two `compact` runs; RPC new session gives one `clear` run | `features/hook/session.feature` | no SessionStart on compaction | cucumber | ❌ | ✅ | ✅ green
| HOOK-04 | Claude names and stdin; exit 2 and deny JSON at any exit block; `ask` blocks headless; `updatedInput` replaces; PostToolUse block keeps output; parallel; dedupe | `features/hook/tool-use.feature` | exit-1 deny JSON lets the tool run; sequential dispatch; duplicates give two runs | cucumber | ✅ seed / ❌ new | ✅ | ✅ green
| HOOK-04 | fold, parse, adapters | `wire-protocol.test.ts`, `dispatch.test.ts`, `event-adapters.test.ts`, `exec-result.test.ts` | — | unit | ✅ change | ✅ | ✅ green
| HOOK-05 | UserPromptSubmit context beside the prompt; SessionStart context persists; tool context after the result; every Stop reason; `systemMessage` shown; plain-stdout context | `features/hook/prompt-and-stop.feature` | model saw the hook's context instead of the prompt; PostToolUse context missing; no `systemMessage` notice | cucumber | ❌ | ✅ | ✅ green
| HOOK-05 | settle, router, notification kind | `settle.test.ts`, `event-router.test.ts`, `test/integration/hooks-additionalcontext-end-to-end.test.ts`, notification closed-set tests | — | unit / integration | ✅ change | ✅ | ✅ green
| HOOK-06 | exec-form substitution in `command` and `args`; env | `features/hook/process.feature` | literal `${CLAUDE_PLUGIN_ROOT}/x` in arguments | cucumber | ❌ | ✅ | ✅ green
| HOOK-06 | both lanes substitute | `spawn-helpers.test.ts`, `dispatch-exec.test.ts`, `async-rewake/registry.test.ts` | — | unit | ✅ change | ✅ | ✅ green
| HOOK-07 | `if` selects; `once` inert; `onFailure` block; manifest `hooks` partial (standard path stays supported); unsupported event partial | `features/hook/configuration.feature` | `onFailure` exit 1 is a noop; manifest hooks silently ignored | cucumber | ❌ | ✅ | ✅ green
| HOOK-07 | schema, resolution, failure marker | `test/domain/components/hooks/schema.test.ts`, `test/domain/hooks-resolution.test.ts`, `wire-protocol.test.ts`, `exec-timer.test.ts` | — | unit | ✅ change | ✅ | ✅ green
| HOOK-08 | MCP tool hook once per call under the real name; `*` once; outer proxy runs no hook | `features/hook/tool-use.feature` MCP scenario (Phase 1 MCP stub, hook-owned `.mcp.json`) | `*` PreToolUse and PostToolUse ran twice | cucumber | ❌ | ✅ | ✅ green
| HOOK-09 | disable and uninstall stop hooks; enable restores; update replaces | `features/hook/lifecycle.feature` | regression guards (negative controls) | cucumber | ❌ | ✅ | ✅ green
| HOOK-09 | docs match tested behavior | `docs/hooks-compatibility.md` against the scenarios (D-CF5-21) | — | review | ✅ change | ✅ | ✅ green

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Harness additions live in Phase 5's owned files and land with the wave-1 plans:

- [x] `features/hook/{session,prompt-and-stop,process,configuration,lifecycle}.feature` — new.
- [x] `features/step_definitions/hook/*.steps.ts` — new topic modules.
- [x] `features/step_definitions/hook/runs.steps.ts` — an any-order runs step and the embedded session-id projection.
- [x] `features/lib/hook-files.ts` — optional columns, script hooks, `.mcp.json` writer.
- [x] A mirrored test for every new source file.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SessionStart `resume` after Pi `switch_session` | HOOK-01/HOOK-02 | `--no-session` profile Pi never writes a session file (D-CF5-26) | covered by unit tests in `payloads/session-start.test.ts` and `event-router.test.ts` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-01 (Nyquist audit: 16/16 rows green; 1158 unit/architecture/integration tests and 68 cucumber scenarios pass; gap filled: PostToolUseFailure scenario in `features/hook/tool-use.feature`)
