---
phase: 05-hooks
verified: 2026-11-03T12:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/05-hooks/05-01-PLAN.md"
  - ".planning/phases/05-hooks/05-01-SUMMARY.md"
  - ".planning/phases/05-hooks/05-02-PLAN.md"
  - ".planning/phases/05-hooks/05-02-SUMMARY.md"
  - ".planning/phases/05-hooks/05-03-PLAN.md"
  - ".planning/phases/05-hooks/05-03-SUMMARY.md"
  - ".planning/phases/05-hooks/05-04-PLAN.md"
  - ".planning/phases/05-hooks/05-04-SUMMARY.md"
  - ".planning/phases/05-hooks/05-05-PLAN.md"
  - ".planning/phases/05-hooks/05-05-SUMMARY.md"
  - ".planning/phases/05-hooks/05-06-PLAN.md"
  - ".planning/phases/05-hooks/05-06-SUMMARY.md"
  - ".planning/phases/05-hooks/05-07-PLAN.md"
  - ".planning/phases/05-hooks/05-07-SUMMARY.md"
  - ".planning/phases/05-hooks/05-08-PLAN.md"
  - ".planning/phases/05-hooks/05-08-SUMMARY.md"
  - ".planning/phases/05-hooks/05-09-PLAN.md"
  - ".planning/phases/05-hooks/05-09-SUMMARY.md"
  - "docs/hooks-compatibility.md"
  - "extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/event-router.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/on-failure.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/runtime.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts"
  - "extensions/pi-claude-marketplace/domain/hooks-resolution.ts"
  - "features/hook/failures.feature"
  - "features/hook/session.feature"
  - "features/hook/tool-use.feature"
  - "features/plugin/project-locality.feature"
  - "features/plugin/project-trust.feature"
covered_digest: "v4:sha256:6891ea4da3477a7c0a51d4991edb01363bee135fec0085919a0429b698eb0ef9"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 5: Hooks Verification Report

**Phase Goal:** Plugin hooks fire on Pi's session, tool, prompt, and stop events with Claude's event names, stdin, and environment, the session parity fixes for `new`, `compact`, and `fork` are in place, and every hook option either works as upstream or is reported, never silently dropped.
**Verified:** 2026-11-03 (first verified 2026-11-01)
**Status:** passed
**Re-verification:** Yes. This run rechecks every criterion at `03f9a45` after T-05-33 (hook output read whole, `onFailure` aligned with Claude Code 2.1.316) and the locality redesign (D-LOC-01). See "Re-verification 2026-11-03" below.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SessionStart gets `source: "clear"` after Pi `new` and `"compact"` after each compaction; two compactions give two runs while the duplicate bind (pi#10470) gives one; `clear`/`compact`/`fork` matchers select runs; the migrated `session-start-hooks.feature` passes | VERIFIED | `payloads/session-start.ts` `claudeSessionStartSource` (`:33`, `new`->`clear`); `domain/components/hook-events.ts:233` `SESSION_START_SOURCES = startup, resume, clear, compact, fork`; `event-router.ts` `sessionCompactCallback` (`:941`, wired at `:1176`) runs SessionStart `compact` outside the SSDEDUP-01 guard. Scenarios in `features/hook/session.feature` (12) pass: new session (`clear`), `clear` matcher, compaction order PreCompact/SessionStart(compact)/PostCompact, second compaction runs again, fork. `features/plugin/session-start-hooks.feature` (2) records `clear` and passes; its "once" scenario proves the duplicate bind still gives one. |
| 2 | SessionEnd gets `reason: "clear"` after Pi `new`; other reasons, matchers, and SessionStart on Pi `reload` behave as FG-20/FG-21 decide | VERIFIED | `payloads/session-end.ts` `claudeSessionEndReason` (`:48`): `new`->`clear`, `resume`/`fork`->`resume`, `quit`->`prompt_input_exit` (tui) or `other`; the `session_shutdown` and `session_start` callbacks skip `reload` (D-CF5-03). Scenarios pass: the SessionEnd matcher selects by reason, fork (`resume`), RPC stop (`other`), TUI quit (`prompt_input_exit`), TUI reload runs no session hook. Not touched by T-05-33 or D-LOC-01. |
| 3 | PreToolUse/PostToolUse/PostToolUseFailure fire with Claude's tool names and stdin; matchers select; exit codes and JSON decisions block or allow; a plugin MCP tool hook fires once per call under the real name; outer `mcp` proxy handled as decided | VERIFIED | `dispatch.ts`: `runHooks` (`:225`) uses `Promise.all` (parallel), `dedupeHooks` (`:194`) keyed as upstream, `isMcpProxyCall` (`:622`) makes a call-mode proxy event run no hook (D-CF5-12). `tool-use.feature` (21 scenarios, all pass): Claude name/input, deny JSON at exit 1, exit 2 with stderr, `onFailure`, parallel, dedupe (one plugin and two plugins), MCP tool with the real pi-mcp-adapter and the Phase 1 stub (literal and `*` hook each once), `ask` blocks headless, `updatedInput`, `continue:false`, PostToolUse block/updated output/context, denied-call context, PostToolUseFailure not PostToolUse. **Refreshed (T-05-33):** the "overflow" scenarios the 2026-11-01 report cited are now "...fails after printing more than 1 MB blocks the tool call" (`:115`) and "...exits 2 after printing more than 1 MB blocks the tool call with its stderr" (`:142`). Three were added: a deny larger than 1 MB blocks (`:169`), a deny keeps its own reason at exit 1 under `onFailure: "block"` (`:196`), an unclosed JSON object under `onFailure: "block"` lets the call run (`:223`). Both lanes read output whole through `stream-text.ts::collectStreamText` (`dispatch-exec.ts:316-320`, `async-rewake/registry.ts:266-271`). The ring buffer and the 1 MB / 64 KB cuts are deleted (209a4ba). `dispatch-exec.ts:345` passes the event to `parseHookStdout`. |
| 4 | UserPromptSubmit, Stop, and other admitted events fire with Claude's stdin and upstream outputs; exec-form hooks substitute `${CLAUDE_PLUGIN_ROOT}`/`${CLAUDE_PLUGIN_DATA}` in `command` and each `args` element; `if`, `once`, `onFailure`, manifest `hooks`, unsupported events behave as FG-22..FG-24 decide and are never silent | VERIFIED | `spawn-helpers.ts::planSpawn` (`:47`) substitutes `command` and every string `args` element on the exec-form arm only (both lanes share it). **`on-failure.ts` (refreshed):** it still implements upstream's four failure outcomes (cannot start, exit other than 0 and 2, timeout, broken JSON) and still ignores the field on Stop and on `async`/`asyncRewake` hooks (`ignoredLane`). T-05-33 narrowed broken JSON to trimmed `{...}` that does not parse and is not JSON lines (`isBrokenJson`, `isJsonLines`). It also made a printed JSON block apply with its own reason unless the hook timed out (`onFailureBlock`, `answer.kind === "block" && !facts.timedOut`). `hooks-resolution.ts:168` reports manifest/entry `hooks` as `unsupported hooks` (D-CF5-27). Scenarios pass in `process.feature` (3), `configuration.feature` (9), `failures.feature` (4, steps reworded by T-05-33), `prompt-and-stop.feature` (3), `additional-context.feature` (8), `messages.feature` (7), and `prompt-commands.feature` (2, added after phase close). |
| 5 | Disable, uninstall, and update stop or replace the hooks per the recorder; `docs/hooks-compatibility.md` matches tested behavior | VERIFIED | `lifecycle.feature` (4) passes (disable, enable restores, uninstall, update replaces). **Docs refreshed and still match:** large output row "no size limit, as upstream" (`docs/hooks-compatibility.md:250`) matches the >1 MB scenarios; the `onFailure` section (`:220-233`) states the four failures, the kept JSON deny, the timeout reason and the Stop/async exclusions, as `on-failure.ts` does; a new paragraph (`:344`) says a project's hooks run only when Pi trusts the project, with no record in the home directory (D-LOC-01), as `project-trust.feature` "A project hook of an untrusted project does not run" and `project-locality.feature` "A project hook runs with no record of the install in the user scope" show. `bypass_permissions_disabled` stays gone from the doc and `hook-events.ts`. |

**Score:** 5/5 truths verified (0 behavior-unverified)

### Plan must-haves (rechecked)

`gsd-tools query verify.artifacts` passes for all nine plans. `verify.key-links` passes for all but 05-06 (2/3). Its pattern `parseHookStdout\(code, stdout, stderr, entry.claudeEvent\)` no longer matches, because 8da30e5 (a review fix from before the 2026-11-01 verification) renamed the locals. The link is wired: `dispatch-exec.ts:345` calls `parseHookStdout(code, outText, errText, entry.claudeEvent)`.

Plans 05-01, 05-06 and 05-09 have truths that keep the project hydrate as "one funnel" so the D-CF2-13 provenance guard could later be added as one call. The funnel stands: `hydrateCacheFromDisk` (`:558`), `hydrateScopeFromState` (`:602`), `tryHydrateOnePlugin` (`:671`) and `hydrateProjectScopeForCwdWith` (`:768`) keep their names. The guard that went there is now Pi's trust answer, not the ledger. `hydrateProjectScopeForCwdWith` records it and returns early when the project is untrusted (`:799-803`). The command-time writer checks the recorded answer (`:160`, `runtime.ts:216-222`). The 05-09 truth about the SUMMARY's parent line is a fact about the SUMMARY text and still holds, although D-LOC-01 has since reversed the decision that line names.

### Behavioral Spot-Checks (run by this verifier)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All hook scenarios plus the migrated session feature | `npx cucumber-js features/hook features/plugin/session-start-hooks.feature` (seed 222108) | 85 scenarios, 1044 steps passed | PASS |
| Project hook trust and locality | `npx cucumber-js features/plugin/autoapply.feature features/plugin/project-trust.feature features/plugin/project-locality.feature` (seed 513417) | 42/42 scenarios | PASS |
| Hook unit, architecture and resolution tests | `node --test 'test/bridges/hooks/**/*.test.ts' 'test/architecture/hooks-*.test.ts' test/domain/hooks-resolution.test.ts` | 1051 tests, 0 fail | PASS |
| Whole-product gate (parent evidence, not re-run) | `npm run check` at `b9f40ad`, exit 0, cucumber 1537/1537 | after it only 03d7c97 changed code (reconcile autoapply), outside `bridges/hooks` | ACCEPTED |

### Requirements Coverage

| Requirement | Source plans | Status | Evidence |
|-------------|--------------|--------|----------|
| HOOK-01 | 05-01, 05-09 | SATISFIED | `clear`/`compact`/`fork` sources and matchers; migrated feature passes |
| HOOK-02 | 05-01, 05-09 | SATISFIED | SessionEnd reason map, matchers, reload skip, all with scenarios |
| HOOK-03 | 05-01, 05-09 | SATISFIED | two-compactions scenario; dedupe guard only on `session_start` |
| HOOK-04 | 05-03, 05-08, 05-09 | SATISFIED | `tool-use.feature`, including the whole-output and kept-deny scenarios |
| HOOK-05 | 05-06, 05-07, 05-08, 05-09 | SATISFIED | `prompt-and-stop`, `additional-context`, `messages`, `prompt-commands` features |
| HOOK-06 | 05-02, 05-09 | SATISFIED | `process.feature`, `planSpawn` |
| HOOK-07 | 05-02, 05-04, 05-09 | SATISFIED | `configuration.feature`, `failures.feature`, `on-failure.ts` |
| HOOK-08 | 05-03, 05-09 | SATISFIED | MCP scenario with pi-mcp-adapter; `isMcpProxyCall` |
| HOOK-09 | 05-05, 05-09 | SATISFIED | `lifecycle.feature`; docs |

All nine IDs appear in at least one PLAN frontmatter and in REQUIREMENTS.md, now `[x]` (lines 94-102) and `Complete` (lines 195-203). No orphaned requirement maps to Phase 5.

### Anti-Patterns Found

None blocking. No `TBD`, `FIXME`, or `XXX` in `bridges/hooks`, `features/hook`, or `features/step_definitions/hook`.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.planning/phases/05-hooks/05-06-PLAN.md` | 73 | Stale key-link pattern (`stdout, stderr` locals renamed) | ℹ️ Info | Checker reports 2/3; the link is wired |
| `bridges/hooks/stream-text.ts` | - | Output is read whole with no cut, so a hook whose output never ends holds the turn until its timeout. Upstream blocks with "output distrusted" | ℹ️ Info | Recorded as not aligned in DC-42 item 9 (BACKLOG HKDR-01). Not a success criterion. |

### Known Open Items (not gaps)

- Two iteration-3 review warnings (follow-up prompt-context edge cases, P5-DC-24; BACKLOG parent lines).
- Deferred by decision, each reported rather than silent: D-CF5-06 (`--resume`/`--fork` launch sources), D-CF5-08 (growth move), D-CF5-16 (extra env vars), D-CF5-20 (manifest `hooks` merge: the plugin is reported `{unsupported hooks}`), D-CF5-28 (`tool_use_id`, `mcp_server` stdin extras), HOOKSCHEMAFAIL-01 (output schema validation), HKDR-01 (never-ending output).
- T-05-33 is closed (209a4ba, merged ed29766). T-05-34 is closed as consistent with D-LOC-01: a project's `CLAUDE_PLUGIN_DATA` stays in the project.

### Notes for the orchestrator (bookkeeping)

1. The 2026-11-01 note that REQUIREMENTS.md showed HOOK-01..09 as Pending is resolved: they read `[x]` / `Complete`.
2. `docs/research/claude-hook-config-syntax.md:103` still lists `bypass_permissions_disabled` (historical research file, unchanged).

### Human Verification Required

None. Every truth is exercised by a passing scenario or unit test. The two fixes `05-REVIEW-FIX.md` once marked for human verification are still pinned. CR-01 (exit 2 after large output) is the renamed `tool-use.feature:142` scenario. WR-02 (follow-up context lifecycle) is in `additional-context.feature`. Both passed in this run.

## Re-verification 2026-11-03

**What I rechecked:** all five ROADMAP criteria and HOOK-01..09 at `03f9a45`. I ran `features/hook` plus `session-start-hooks.feature` (85/85), the trust, locality and autoapply features (42/42), and the hook unit and architecture tests (1051/1051). I also ran the artifact and key-link checks on all nine plans.

**What changed since 2026-11-01:**

- **T-05-33 (209a4ba, ed29766).** Hook output is read whole in both lanes. `async-rewake/ring-buffer.ts` and the 1 MB / 64 KB cuts are gone, replaced by `stream-text.ts`. `on-failure.ts` now uses upstream's broken-JSON rule and keeps a printed JSON deny unless the hook timed out. The old report cited "overflow cases" in `tool-use.feature`. Those scenarios now mean "printed more than 1 MB, read whole", and three were added. SC3 and SC4 evidence is refreshed, and `docs/hooks-compatibility.md` matches.
- **D-LOC-01 (5ecd962).** The hooks bridge gates a project's hooks on `ctx.isProjectTrusted()` (hydrate `event-router.ts:799-803`, command-time writer `:160`). No hook ledger is written (the `bridges/hooks/project-ledger.ts` that the reversed hooks provenance had added is deleted). `features/hook/project-provenance.feature` was deleted. It was added after the 2026-11-01 verification and was never cited here. The docs carry the new trust paragraph (`:344`).
- All covered files still exist. Added to `covered_files`: `stream-text.ts`, `dispatch-exec.ts`, `async-rewake/registry.ts`, `runtime.ts`, `features/hook/failures.feature`, `features/plugin/project-trust.feature`, `features/plugin/project-locality.feature`. The digest is recomputed.

**Verdict:** still passed, 5/5. No gap.

---

_Verified: 2026-11-03_
_Verifier: Claude (gsd-verifier)_
