---
phase: 62-asyncrewake-registry-background-spawn
verified: 2026-06-16T01:30:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
---

# Phase 62: `asyncRewake` Registry & Background-Spawn — Verification Report

**Phase Goal:** Implement `asyncRewake: true` fire-and-forget hook dispatch
with background-spawn, ring-buffered output capture, PID-table-backed orphan
reap, captured-epoch zombie defense, and exit-code-2 model injection via
`pi.sendMessage`.
**Verified:** 2026-06-16T01:30:00Z
**Status:** PASS
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `asyncRewake: true` in `handlerDecl` causes dispatch to return `{kind:"noop"}` immediately without blocking the tool call | VERIFIED | `dispatch-exec.ts:169` strict `=== true` check delegates to `spawnAndRegister`; architecture test Block G pins the noop return |
| 2 | Child exit code 2 injects `rewakeMessage + body` into Pi context via `pi.sendMessage({ customType:"claude-hook-rewake", display:false, ... })` | VERIFIED | `registry.ts:409` `pi.sendMessage` call; Block B architecture tests cover code-2 path, content, display flag, customType |
| 3 | Exit codes other than 2 (0, SIGKILL) are silent — no `pi.sendMessage` call | VERIFIED | `registry.ts:384` `if (code !== 2)` guard; architecture tests "exit code 0 silent" and "SIGKILL silent" pass |
| 4 | Stdout ring-buffered at 1 MiB, stderr ring-buffered at 64 KiB with tail-drop and `_truncated` latch | VERIFIED | `ring-buffer.ts:42-45` exports `STDERR_CAP_BYTES = 65_536`, `STDOUT_CAP_BYTES = 1_048_576`; Block C tests pin overflow + truncated prefix |
| 5 | SIGTERM→5s→SIGKILL timer ladder (EXEC-02) inherited verbatim | VERIFIED | `registry.ts:276` `installTimerLadder(child, timeoutMs)` call; `exec-timer.ts` shared helper; same constants as `dispatch-exec.ts` |
| 6 | PID table written atomically under `<scopeRoot>/pi-claude-marketplace/data/_shared/async-rewake-pids.json` with `{version:1, entries:[...]}` envelope and `assertPathInside` containment | VERIFIED | `pid-table.ts:98-99` path composition; `pid-table.ts:148` `assertPathInside` before `atomicWriteJson`; `pid-table.ts:85-87` version=1 discriminator |
| 7 | Orphan reap at factory entry: liveness probe via `kill 0`, marker-check via `/proc/<pid>/environ` on Linux, soft-skip on non-Linux, SIGKILL only owned PIDs, unlink table | VERIFIED | `registry.ts:509-540` `reapOrphans`; Block D tests pin Linux marker match/mismatch and non-Linux soft-skip |
| 8 | Captured-epoch defense: stale child from prior `/reload` cycle does not inject into new session | VERIFIED | `registry.ts:361-368` epoch comparison; Block E test "D-59-03 captured-epoch mismatch -> handler no-ops" passes |
| 9 | `rewakeSummary` routes through `notifyAsyncRewakeSummary` (IL-2 exemption), fires independent of exit code | VERIFIED | `registry.ts:378` `notifyAsyncRewakeSummary(ctx, entry.rewakeSummary)`; `shared/notify.ts:325-331` helper exists; Block F tests fire on code 0 and code 2 |
| 10 | Multi-hook fan-in: distinct `crypto.randomUUID()` dispatchIds per spawn; independent exit handlers | VERIFIED | `registry.ts:223` `dispatchIdGenerator()`; Block H tests "two concurrent spawnAndRegister calls produce distinct dispatchIds" passes |

**Score:** 10/10 truths verified

---

## Requirement Coverage

### HOOK-06

`asyncRewake: true` triggers background spawn that does not block the dispatch
turn. Child exit code 2 injects `rewakeMessage` + (stderr or stdout-if-empty)
blob via `pi.sendMessage({ customType: "claude-hook-rewake", display: false,
content }, { deliverAs: ctx.isIdle() ? "nextTurn" : "followUp" })`. Codes
other than 2 are silent. Multi-hook fan-in via distinct `dispatchId` UUIDs.

**Status: VERIFIED**

Evidence:
- `dispatch-exec.ts:169-186` delegation arm with `=== true` strict discriminator
- `registry.ts:300-301` per-child `once("exit", ...)` handler wired inside `spawnAndRegister`
- `registry.ts:384-427` `onChildExit` body: code-2 inject with `display: false`,
  stdout fallback, `deliverAs` lane selection via `ctx.isIdle()`
- Architecture tests Block B (8 tests): all exit-code-2 inject paths, code-0 silence,
  deliverAs idle/busy, sendMessage throw trapping, empty-body skip

### EXEC-05

Stdout/stderr ring-buffered with tail-drop at 1 MiB / 64 KiB + `_truncated`
latch surfaced in inject payload. Timer ladder SIGTERM→5s→SIGKILL inherited
from EXEC-02. PID-table atomic write under `_shared/async-rewake-pids.json`
with `assertPathInside` containment and `{version:1, entries:[...]}` envelope.

**Status: VERIFIED**

Evidence:
- `ring-buffer.ts:42-45`: `STDERR_CAP_BYTES = 65_536`, `STDOUT_CAP_BYTES = 1_048_576`
- `ring-buffer.ts:94-105`: tail-drop on overflow, `truncated` latch set on any drop
- `registry.ts:276`: `installTimerLadder(child, timeoutMs)` — EXEC-02 ladder shared helper
- `pid-table.ts:98-99`: path under `dataRoot/_shared/async-rewake-pids.json`
- `pid-table.ts:111,148,164`: `assertPathInside` at every read/write/unlink site
- `pid-table.ts:149-152`: `{ version: 1, entries: [...] }` envelope; `atomicWriteJson`

---

## NFR / Constraint Coverage

| NFR | Description | Status | Evidence |
|-----|-------------|--------|----------|
| NFR-1 | Atomic writes (tmp + rename) | VERIFIED | `pid-table.ts:153` `atomicWriteJson` at every write site |
| NFR-2 | `/reload` always suffices for recovery | VERIFIED | `event-router.ts:597` `shutdownInMemoryChildren()` + `624` `await reapOrphans(loc)` in `registerHooksBridge` |
| NFR-3 | Idempotent / fail-clean | VERIFIED | `pid-table.ts` never-throws contract; `readPidTable` returns `[]` on ENOENT, malformed JSON, version mismatch |
| NFR-10 | Path containment via `assertPathInside` | VERIFIED | 3 call sites in `pid-table.ts` + 2 in `prepareAsyncEnv` in `registry.ts` |
| NFR-7 | Discriminated union exhaustiveness | VERIFIED | `registry.ts:338` `OutcomeKind = "inject" | "silent" | "noop"` + `assertOutcome` + `assertNever` |
| IL-2 | No direct `ctx.ui.notify` in bridge code | VERIFIED | ESLint `no-restricted-syntax` gate GREEN; `notifyAsyncRewakeSummary` in `shared/notify.ts` is the sole call site |
| IL-3 | Single `console.warn` legacy exemption | VERIFIED | No `console.*` in any Phase 62 file |
| SC-1 | `user` / `project` scope model | VERIFIED | `PidTableEntry.scope: "user" | "project"` + `event-router.ts` iterates `SCOPES` in `reapOrphans` loop |

---

## Decision Coverage

| Decision | Description | Status | Evidence |
|----------|-------------|--------|----------|
| D-62-01 | `dispatch-exec.ts` pre-spawn delegation arm | VERIFIED | `dispatch-exec.ts:169-187` |
| D-62-02 | Declaration-order interleave for mixed sync + async entries | VERIFIED | Reducer in `dispatch.ts` walks bucket sequentially; async arm returns `{kind:"noop"}` immediately; architecture Block G tests sync/async mix |
| D-62-03 | EXEC-02 timer ladder inherited verbatim; on timeout, non-2 exit code -> silent | VERIFIED | `registry.ts:276` `installTimerLadder`; timer constants match Phase 60 |
| D-62-04 | Ring-buffer tail-drop + `_truncated` latch | VERIFIED | `ring-buffer.ts:94-119`; Block C truncated-prefix test |
| D-62-05 | Persisted PID table + marker env + stranger protection + factory-time orphan reap | VERIFIED | `pid-table.ts` full module; `registry.ts:509-540` `reapOrphans`; Block D tests |
| D-58-01 | Atomic-supersession: whitelist amendment + first `import "node:child_process"` in same commit | VERIFIED | `git show --stat 8ef02c5` confirms both `registry.ts` and `no-shell-out.test.ts` in commit `8ef02c5` |
| D-59-03 | Captured-epoch zombie defense reused | VERIFIED | `registry.ts:224` `currentEpoch()` at spawn; `registry.ts:361-368` epoch check at exit |

---

## VALIDATION.md T-62-NN Row Check

| Task ID | Requirement | Test Pattern | File Exists | Result |
|---------|-------------|--------------|-------------|--------|
| 62-01-01 | HOOK-03 schema admission | `hooks.ts` asyncRewake fields; `tests/domain/components/hooks.test.ts` | YES | PASS — 3 optional `unknown` fields in schema + interface |
| 62-01-02 | EXEC-05 ring-buffer | `tests/bridges/hooks/async-rewake/ring-buffer.test.ts` | YES | PASS — 14 tests, all green |
| 62-01-03 | HOOK-06 / NFR-1 pid-table | `tests/bridges/hooks/async-rewake/pid-table.test.ts` | YES | PASS — 13 tests, assertPathInside at 3 sites |
| 62-02-01 | EXEC-05 / HOOK-06 spawnAndRegister | Block A + Block D tests in `hooks-async-rewake.test.ts` | YES | PASS — detached:false, stdio pipe, marker env, registry add |
| 62-02-02 | HOOK-06 exit-handler | Block B tests in `hooks-async-rewake.test.ts` | YES | PASS — code-2 inject, code-0 silent, sendMessage throw trapped |
| 62-02-03 | D-58-01 atomic-supersession | `no-shell-out.test.ts` | YES | PASS — 3-element set, commit 8ef02c5 atomic |
| 62-03-01 | HOOK-06 delegation arm | Block G tests in `hooks-async-rewake.test.ts` | YES | PASS — noop return, strict === true, HOOK-03 lenient |
| 62-03-02 | HOOK-06 / NFR-2 orphan reap | Block D tests in `hooks-async-rewake.test.ts`; `event-router.ts` wiring | YES | PASS — reapOrphans called in registerHooksBridge loop |
| 62-03-03 | HOOK-06 captured-epoch | Block E test in `hooks-async-rewake.test.ts` | YES | PASS — bumpEpochForTest, no-op confirmed |
| 62-03-04 | HOOK-06 IL-2 exemption | Block F tests in `hooks-async-rewake.test.ts` | YES | PASS — routes through `notifyAsyncRewakeSummary` |
| 62-03-05 | EXEC-05 multi-hook fan-in | Block H tests in `hooks-async-rewake.test.ts` | YES | PASS — distinct UUIDs, independent exit handlers |

All 10 VALIDATION.md rows: PASS.

---

## D-58-01 Atomic-Supersession Verification

**Requirement:** `no-shell-out.test.ts` whitelist amendment must land in the
SAME commit as the first `import "node:child_process"` from `registry.ts`.

**Evidence:**

- Commit `8ef02c5` ("feat(hooks): add async-rewake registry skeleton with
  whitelist amendment") contains BOTH:
  - `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`
    (new file with `import { spawn, type ChildProcess } from "node:child_process"`)
  - `tests/architecture/no-shell-out.test.ts` (whitelist grown 2→3)
- Confirmed via `git show --stat 8ef02c5`: 2 files changed.
- The subsequent commit `e53f190` fills the registry body but adds NO new
  `node:child_process` import site — the architecture test stayed GREEN
  throughout.

**Status: VERIFIED**

---

## `npm run check` Result

**Status: GREEN** (exit code 0)

- Typecheck: PASS
- ESLint: PASS
- Prettier: PASS
- Unit tests: 2222 total — 2221 pass, 1 skip (non-Linux marker-check arm,
  intentional), 0 fail
- Integration tests: 10 total — 10 pass

Test delta from Phase 62: +38 (hooks-async-rewake.test.ts: 38 architecture
tests; 37 pass + 1 skip on Linux host).

---

## Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `dispatch-exec.ts:dispatchHookExec` | `registry.ts:spawnAndRegister` | `import + if (=== true) arm` | WIRED |
| `event-router.ts:registerHooksBridge` | `registry.ts:shutdownInMemoryChildren` | `import + call after liveEpoch bump` | WIRED |
| `event-router.ts:registerHooksBridge` | `registry.ts:reapOrphans` | `import + await in per-scope loop` | WIRED |
| `dispatch.ts:reduceBucket` | `dispatch-exec.ts:dispatchHookExec` | `activeExecutor(entry, event, ctx, pi)` with pi threaded | WIRED |
| `registry.ts:onChildExit` | `shared/notify.ts:notifyAsyncRewakeSummary` | `import + call in IL-2 EXEMPTION arm` | WIRED |
| `registry.ts:onChildExit` | `pi.sendMessage` | closure over `pi: ExtensionAPI` from `spawnAndRegister` signature | WIRED |
| `pid-table.ts:writePidTable` | `shared/atomic-json.ts:atomicWriteJson` | `import + direct call` | WIRED |

---

## Anti-Patterns

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `ring-buffer.ts:6` | `Plan 02's registry constructs...` | Warning | Comment-policy violation (`.claude/rules/typescript-comments.md` forbids `Plan NN` references). NOT a lint gate; no CI enforcement. Does not affect runtime behavior. |
| `ring-buffer.ts:23` | `The exit handler in Plan 02 reads...` | Warning | Same as above |

No `TBD`, `FIXME`, `XXX`, `TODO`, or `PLACEHOLDER` markers found in any Phase
62 source file. No stub implementations (no `return null`, `return {}`,
`return []` in behavior paths). The `Plan 02` comment references are
policy-only violations with no associated formal follow-up issue — they are
documented here but do not block the phase goal.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `hooks-async-rewake.test.ts` 38 tests run | `node --test tests/architecture/hooks-async-rewake.test.ts` | 37 pass / 1 skip / 0 fail | PASS |
| `no-shell-out.test.ts` whitelist 3-element assertion | captured in full unit run | PASS | PASS |
| `npm run check` end-to-end | exit 0 | 2221/2222 pass + 1 skip | PASS |

---

## Human Verification Required

### 1. End-to-End `/reload` Orphan Reap

**Test:** Kill Pi process while an `asyncRewake: true` hook is running a
`sleep 60` child. Relaunch Pi and `/reload`.
**Expected:** Child in `async-rewake-pids.json` is SIGKILLed; file is unlinked.
**Why human:** Requires multi-process orchestration with a real child surviving
parent death — not testable with `node:test` stubs.

### 2. End-to-End Model Injection Observability

**Test:** Install a plugin with `rewakeMessage: "Security finding"` + a script
that exits with code 2 and writes to stderr. Trigger the event. Observe the
model's next turn.
**Expected:** Model acknowledges the rewake message and stderr content.
**Why human:** Requires a live Pi session with a real LLM turn.

### 3. `rewakeSummary` UI Visibility

**Test:** Trigger a hook with `rewakeSummary: "Background review complete"`.
**Expected:** Message appears in Pi's status surface after child exits.
**Why human:** Pi's `ctx.ui.notify` visual surface is not covered by unit
mocks — only call-site recording is verifiable programmatically.

---

## Gaps Summary

No blocking gaps. Phase 62 goal is fully achieved:

- All required artifacts exist and are substantive (no stubs).
- All key links are wired end-to-end.
- All 10 VALIDATION.md tasks have passing tests.
- `npm run check` is GREEN: 2221 pass, 1 intentional skip, 0 fail.
- D-58-01 atomic-supersession was honored in commit `8ef02c5`.

**Non-blocking comment-policy finding:** Two `Plan 02` references in
`ring-buffer.ts:6` and `ring-buffer.ts:23` violate the comment policy in
`.claude/rules/typescript-comments.md`. These should be cleaned up in a
follow-up (strip the `Plan 02's` clause; the surrounding technical context
is self-explanatory). Not tracked in a formal issue; the finding is recorded
here for auditability.

---

_Verified: 2026-06-16T01:30:00Z_
_Verifier: Claude (gsd-verifier)_
