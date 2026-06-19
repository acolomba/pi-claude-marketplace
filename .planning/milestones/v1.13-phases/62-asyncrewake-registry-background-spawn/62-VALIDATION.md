---
phase: 62
slug: asyncrewake-registry-background-spawn
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 62 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `62-RESEARCH.md` § "Validation Architecture" + the
> `tests/architecture/hooks-*.test.ts` single-file precedent established
> in Phases 60/61.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in, stable since Node 20) with `node --test` runner and TypeScript native type-stripping (Node 22.18+) |
| **Config file** | `package.json` `scripts.test` / `scripts.test:integration` / `scripts.check` |
| **Quick run command** | `npm test -- --test-name-pattern='async-rewake'` |
| **Full suite command** | `npm run check` (typecheck + lint + format:check + unit + integration) |
| **Estimated runtime** | ~6 seconds for the async-rewake architecture subset; ~45–60 seconds for `npm run check` end-to-end |

Unit tests live under `tests/architecture/`, `tests/bridges/`, `tests/domain/`,
`tests/shared/` etc. Integration tests live under `tests/integration/`.
Phase 62 adds:

- `tests/architecture/hooks-async-rewake.test.ts` (NEW — pins HOOK-06 + EXEC-05 invariants)
- Amends `tests/architecture/no-shell-out.test.ts` (TWO → THREE sanctioned `node:child_process` import sites, atomic with the first commit that introduces `registry.ts`)
- Integration test(s) under `tests/integration/` (or alongside `tests/bridges/hooks/`) for the `dispatch-exec.ts` delegation arm + declaration-order interleave between sync and async entries

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --test-name-pattern='async-rewake'` (quick subset)
- **After every plan wave:** Run `npm test` (full unit suite — covers schema admission + reducer + all hook architecture invariants)
- **Before `/gsd-verify-work`:** `npm run check` must be green (typecheck + lint + format + unit + integration)
- **Max feedback latency:** 10 seconds for the quick subset; 60 seconds for the full `check` run

---

## Per-Task Verification Map

Task IDs are placeholders — the planner assigns final IDs once PLAN.md
files are generated. Wave assignments mirror the research doc's
suggested ladder (Wave 1: parallel leaves; Wave 2: registry + atomic
test amendment in the same commit; Wave 3: integration arms).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 62-01-01 | 01 | 1 | HOOK-03 | — | Schema admits `asyncRewake` / `rewakeMessage` / `rewakeSummary` as optional; non-boolean `asyncRewake` treated as `false` (sync path); strings only for `rewakeMessage` / `rewakeSummary` | unit | `npm test -- --test-name-pattern='HOOK_HANDLER_SCHEMA.*asyncRewake'` | ❌ W0 | ⬜ pending |
| 62-01-02 | 01 | 1 | EXEC-05 | T-62-04 / `_truncated` marker on overflow | `ring-buffer.ts` circular Buffer length 65536 (stderr) / 1048576 (stdout); drop OLDEST bytes on fill; expose `wasTruncated()` predicate; UTF-8 wrap-boundary safe (no half-char emission) | unit | `npm test -- --test-name-pattern='ring-buffer'` | ❌ W0 | ⬜ pending |
| 62-01-03 | 01 | 1 | HOOK-06 / NFR-1 | T-62-05 / stranger-process protection | `pid-table.ts` atomic-write (tmp + rename) of `{ version: 1, entries: [...] }`; idempotent read (returns `[]` on `ENOENT`); `assertPathInside` containment; version=1 hardcoded | unit | `npm test -- --test-name-pattern='pid-table'` | ❌ W0 | ⬜ pending |
| 62-02-01 | 02 | 2 | EXEC-05 / HOOK-06 | T-62-01 / spawn options pinned | `registry.ts` `spawnAndRegister(entry, event, ctx)` uses `spawn(command, args, { detached: false, stdio: ["pipe","pipe","pipe"], env: { ...preparedEnv, PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH: dispatchId } })`; arms EXEC-02 timer ladder verbatim; captures `liveEpoch`; returns immediately after registry insert + PID-table sync | unit | `npm test -- --test-name-pattern='async-rewake.*spawn'` | ❌ W0 | ⬜ pending |
| 62-02-02 | 02 | 2 | HOOK-06 | T-62-02 / exit-code-2 inject only | Per-child exit handler: code 2 → `pi.sendMessage({ customType: "claude-hook-rewake", display: false, content: rewakeMessage + "\n\n" + stderrOrStdout }, { deliverAs: ctx.isIdle() ? "nextTurn" : "followUp" })`; code 0 or any non-2 → silent (no inject); SIGKILL (null exit code) → silent; `_truncated` prepended `[…truncated]\n\n` when buffer overflowed; `sendMessage` failure caught + `hookDebugLog` | unit | `npm test -- --test-name-pattern='async-rewake.*exit-handler'` | ❌ W0 | ⬜ pending |
| 62-02-03 | 02 | 2 | EXEC-05 | T-62-08 / atomic-supersession (D-58-01) | `tests/architecture/no-shell-out.test.ts` `EXACTLY_TWO_SANCTIONED_SHELL_OUT_SITES` constant becomes `EXACTLY_THREE_…`; entry list adds `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`; lands in the **same commit** as the first `import "node:child_process"` from the new path | unit | `npm test -- --test-name-pattern='no-shell-out'` | ✅ (amended) | ⬜ pending |
| 62-03-01 | 03 | 3 | HOOK-06 | T-62-03 / declaration-order interleave (D-62-02 preserved) | `dispatch-exec.ts` pre-spawn check: `if (entry.handlerDecl.asyncRewake === true) { await registry.spawnAndRegister(entry, event, ctx); return { kind: "noop" }; }`; reducer cannot distinguish sync `noop` from async-spawned `noop`; mixed sync + async entries in same bucket fire in JSON-declaration order | integration | `npm run test:integration -- --test-name-pattern='dispatch-exec.*asyncRewake'` | ❌ W0 | ⬜ pending |
| 62-03-02 | 03 | 3 | HOOK-06 / NFR-2 | T-62-06 / orphan reap + marker check | `registerHooksBridge` factory entry runs `reapOrphans()`: read PID table → `kill 0` liveness probe → `/proc/<pid>/environ` marker check on Linux (`PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=<dispatchId>` must match) → SIGKILL surviving owned PIDs → unlink table; macOS / read failure → soft-skip with `hookDebugLog` (NEVER SIGKILL strangers); on `/reload` re-entry, walk in-memory registry first then orphan-reap | integration | `npm run test:integration -- --test-name-pattern='registerHooksBridge.*reap'` | ❌ W0 | ⬜ pending |
| 62-03-03 | 03 | 3 | HOOK-06 | T-62-07 / captured-epoch zombie defense | Exit handler reads `currentEpoch()`; if `!== capturedEpoch` (factory re-ran during child's life), no-op silently (no inject, no notify, no PID-table mutation) | unit | `npm test -- --test-name-pattern='async-rewake.*epoch'` | ❌ W0 | ⬜ pending |
| 62-03-04 | 03 | 3 | HOOK-06 | T-62-09 / IL-2 exemption documented | `rewakeSummary` (when set) fires `ctx.ui.notify(rewakeSummary, "info")` at exit time; documented in `hooks-async-rewake.test.ts` as **IL-2 EXEMPTION** (runtime notify is generally forbidden but `rewakeSummary` is upstream-mandated UI behavior); SUMMARY-only, not gated on exit code | unit | `npm test -- --test-name-pattern='async-rewake.*notify'` | ❌ W0 | ⬜ pending |
| 62-03-05 | 03 | 3 | EXEC-05 / HOOK-06 | T-62-10 / multi-hook fan-in | Two `asyncRewake` hooks firing on the same triggering event create TWO independent registry entries with distinct `crypto.randomUUID()` `dispatchId`s; each child's exit handler fires independently without coordination; PID-table contains both entries; each marker env var is distinct | unit | `npm test -- --test-name-pattern='async-rewake.*fan-in'` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/architecture/hooks-async-rewake.test.ts` — NEW file; pins HOOK-06 + EXEC-05 invariants (spawn options, exit-code-2 inject shape, ring-buffer overflow `_truncated` flag, orphan reap + marker skip, declaration-order interleave, captured-epoch defense, multi-hook fan-in)
- [ ] `tests/architecture/no-shell-out.test.ts` — amend `EXACTLY_TWO_SANCTIONED_SHELL_OUT_SITES` → `EXACTLY_THREE_…` and add `bridges/hooks/async-rewake/registry.ts` to the entry list (atomic-supersession with first commit introducing the file)
- [ ] Integration test for the `dispatch-exec.ts` delegation arm + declaration-order interleave (location TBD by planner — likely `tests/integration/` or alongside existing `tests/bridges/hooks/`)
- [ ] Test helpers/fakes:
  - `spawn` mock (returns a `ChildProcess`-shaped object with controllable `stdout` / `stderr` streams + `exit` / `error` event triggers)
  - `pi.sendMessage` / `ctx.ui.notify` / `ctx.isIdle()` spies on a synthetic `ExtensionContext`
  - `kill 0` / `process.kill` stub via a `_setOrphanProbesForTest` seam in `registry.ts` (faster, deterministic, cross-platform — no real children spawned)
  - `/proc/<pid>/environ` fake via the same seam (Linux marker-check) — table-driven for "match" / "mismatch" / "read failure (soft-skip)" cases

*Framework install: not required. `node:test` is built-in.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end `/reload` recovery: kill the Pi process mid-flight while an async-rewake child is alive; relaunch Pi; verify the orphan child is SIGKILLed at next bridge load | HOOK-06 lifecycle / NFR-2 | Requires multi-process orchestration + a real child that survives parent death; the architecture test stubs `process.kill` so this end-to-end behavior is not covered by `node:test` alone | 1) Install a fixture plugin declaring an `asyncRewake: true` hook that runs `sleep 60`. 2) Trigger the hook. 3) Confirm PID appears in `~/.pi/agent/pi-claude-marketplace/data/_shared/async-rewake-pids.json`. 4) Kill Pi via `pkill -9 -f pi-coding-agent`. 5) Confirm the child is still alive via `ps -p <pid>`. 6) Relaunch Pi + `/reload`. 7) Confirm `ps -p <pid>` shows the child is gone; confirm PID file is unlinked. |
| End-to-end injection observability: a child exits with code 2 mid-stream; verify the model sees the `<system-reminder>`-equivalent followUp message and reacts | HOOK-06 core | Requires a live Pi session + a real LLM turn; out of scope for unit tests | 1) Install a fixture plugin with `rewakeMessage: "Security finding"` + a script that exits 2 with stderr `"sensitive token detected"`. 2) Run any tool call that fires the hook event. 3) During the same conversation, observe the model's next turn references the rewake message + stderr content. |
| `rewakeSummary` UI visibility | HOOK-06 | Pi's UI rendering of `ctx.ui.notify` is observed in the real Pi shell, not in unit tests (notify mocks confirm the call but not the visual surface) | Trigger a hook with `rewakeSummary: "Background review complete"` and confirm the message appears in Pi's status surface after the child exits. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`hooks-async-rewake.test.ts` + `no-shell-out.test.ts` amendment + integration helper)
- [ ] No watch-mode flags (`node:test` runs in single-shot mode under `npm test`)
- [ ] Feedback latency < 10s (quick subset) / < 60s (full `check`)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
