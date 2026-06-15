# Phase 60: Hook Execution, Payload Translators & Env Vars - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 60-hook-execution-payload-translators-env-vars
**Areas discussed:** HookExecResult shape + multi-entry result reduction, Per-event translator architecture, Phase 59 carry-forward (WR-01 + WR-03) timing, CLAUDE_ENV_FILE scratch lifecycle

---

## HookExecResult shape and reducer

### Turn 1 — TypeScript shape

| Option | Description | Selected |
|--------|-------------|----------|
| Discriminated union by outcome | `noop \| block \| mutate \| stop` outcome categories. Bridge normalizes Claude's stdout into these. Composite handler reduces via outcome precedence. Cleanest exhaustiveness via `assertNever`. | ✓ |
| Wide flat object | `{ block?, reason?, updatedInput?, updatedToolOutput?, ... }`. Closer to raw stdout shape; simpler to construct; reducer merges field-by-field. Loses outcome-as-data. | |
| Per-event union narrowed by call-site | `HookExecResult<E extends BucketAEvent>` — strongest typing but fights the reducer because all entries on the same handler share the same E. | |

**User's choice:** Discriminated union by outcome
**Notes:** Becomes D-60-01 in CONTEXT.md. Drives the rest of the dispatch chain — load-bearing data type.

### Turn 2 — Multi-entry reducer policy

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror Claude Code upstream | First-block-wins short-circuit; mutates compose left-to-right (each entry sees previous mutation); stop-on-first-stop. Matches user expectation of behavioral parity. | ✓ |
| All-entries-run, then merge | Every entry runs regardless of outcome; bridge accumulates results then merges. Deterministic. Divergent from Claude Code. | |
| Strict-conflict-error to debug log | First-block-wins but conflicting mutate-then-block writes to debug log + picks conservative outcome. Catches plugin-author bugs. | |

**User's choice:** Mirror Claude Code upstream
**Notes:** Becomes D-60-02. Requires architecture-test invariant: entry-2 not invoked if entry-1 blocks. DISP-04 still satisfied (sequential awaited fan-out preserved; early-exit is compatible).

### Turn 3 — Pi return-value adapter

| Option | Description | Selected |
|--------|-------------|----------|
| Per-event adapter at composite-handler exit | One `adapt*` function per Pi event (`adaptToolCall`, `adaptToolResult`, `adaptInput`, observation-no-op). Cleanest per-Pi-event typed returns. | ✓ |
| Single converter, Pi event ignored | One generic converter; loses Pi-event-specific contracts (e.g., UserPromptSubmit's `{ action: "handled" }`). | |
| Per-event adapter module split | Same as A but each adapter in its own file. Easier per-event unit tests; more boilerplate. | |

**User's choice:** Per-event adapter at composite-handler exit
**Notes:** Becomes D-60-03. Placement (module vs inline switch) is planner discretion.

---

## Per-event payload translator architecture

### Turn 1 — Author pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-authored translate() function per file | 8 files × ~30-60 lines. Most flexible; per-event edge cases inline; easy unit testing. TOOL-01 mapping imported per file. | ✓ |
| Declarative field-mapping table + engine | 8 specs + 1 engine. Uniform but engine needs its own tests; hard to express per-event edge cases. | |
| TypeBox schema-validated transform | Rigorous; ~3x more code per file; runtime validation cost at every dispatch. | |

**User's choice:** Hand-authored translate() function per file
**Notes:** Becomes D-60-04. Architecture-test fixtures follow Phase 59's hand-authored inline pattern.

---

## Phase 59 carry-forward (WR-01, WR-03) timing

### Turn 1 — Disposition

| Option | Description | Selected |
|--------|-------------|----------|
| WR-03 in Phase 60; WR-01 deferred to v1.13 cleanup | WR-03 is correctness-critical the moment exec lands; WR-01 is bounded info-disclosure with no exec dependency. | |
| Both addressed inside Phase 60 | Dedicated 'lifecycle hardening' plan alongside exec/translators/env vars. Zero carry-forward debt. | ✓ |
| Both deferred to separate v1.13 cleanup pass | Phase 60 ships exec without touching WR-01 or WR-03. /reload heals; NFR-2 satisfied. | |
| Both further deferred to v1.14+ | Phase 60 ships as-spec'd; carry-forward tracked in v1.14 backlog. | |

**User's choice:** Both addressed inside Phase 60
**Notes:** Becomes D-60-05. Phase 60 has 4 scope dimensions, not 3 (exec + translators + env vars + lifecycle hardening). Planner picks plan boundaries (3-5 plans total).

---

## CLAUDE_ENV_FILE scratch lifecycle

### Turn 1 (first ask) — Initial selection (reverted)

| Option | Description | Selected |
|--------|-------------|----------|
| Predictable per-(plugin,event) path; bridge does NOT create/delete | Simple contract; stale env contents could leak across sessions. | (initial selection — user requested re-ask) |
| Per-dispatch random; bridge creates + GCs | Collision-free; bridge participates in lifecycle. | |
| Per-session path; bridge does NOT create/delete | Session-scoped; needs sessionId. | |

**User's choice (first ask):** Predictable per-(plugin,event) — reverted, user requested re-ask
**Notes:** User asked "what does Claude set that variable to?" — triggered upstream-docs lookup via WebFetch on `code.claude.com/docs/en/hooks`.

### Upstream-docs lookup (between turns)

WebFetch revealed:
- Variables persist for "all subsequent Bash commands during the session"
- Multiple hooks expected to append (`>>`) — implies cross-hook accumulation
- Claude Code docs do NOT pin the literal path scheme, but the accumulation contract rules out per-dispatch-random.

Pi peer-dep check confirmed `ctx.sessionManager.getSessionId()` is available on `ReadonlySessionManager` — per-session path is structurally unblocked.

### Turn 1 (re-ask) — Final selection

| Option | Description | Selected |
|--------|-------------|----------|
| Per-session, plugin-scoped path; bridge sets env var only | `<pluginDataDir>/claude-env-<sessionId>.env`. Same-session hooks accumulate; cross-plugin doesn't (per HOOK-05). | |
| Per-session, plugin-scoped + event-suffixed | Adds future-proofing for CwdChanged/FileChanged in v1.14+. | |
| Per-session, NOT plugin-scoped (Claude Code upstream parity) | `<scopeRoot>/pi-claude-marketplace/data/_shared/claude-env-<sessionId>.env`. ALL plugins share one file per session. Matches upstream "preserve variables set by other hooks". | ✓ |

**User's choice:** Per-session, NOT plugin-scoped (Claude Code upstream parity)
**Notes:** Becomes D-60-06. **Requires REQ HOOK-05 amendment** — current wording says "under the plugin's data dir" but the chosen path is `_shared` cross-plugin. CONTEXT.md flags amendment for downstream agents. `_shared` mkdir-p'd at `registerHooksBridge` factory time alongside per-plugin data dirs.

---

## Claude's Discretion

User opted to leave the following details to research/planner discretion:

- **`TranslationContext` shape and source-of-truth** — researcher confirms `transcript_path` source (likely `ctx.sessionManager.getSessionFile()`; fallback if `undefined` is planner's choice).
- **stdin `_truncated: true` marker placement** — top-level field vs nested under `hookSpecificOutput`. Planner picks.
- **Timeout grace-timer mechanism** — custom timer ladder (`setTimeout(SIGTERM)` + `setTimeout(SIGKILL)` + `clearTimers()` on exit). Planner picks state holder.
- **stdout/stderr buffer-overflow handling at 1 MB / 64 KB** — conservative vs permissive default. Planner picks.
- **`CLAUDE_PLUGIN_DATA` mkdir-p timing** — at install time inside per-plugin lock per HOOK-05 wording. Existing pattern.
- **Exec-form vs shell-form `command` resolution detail** — discriminator locked by EXEC-04. Planner picks exact spawn-options construction.
- **Per-event architecture-test invariants beyond reducer + translator fixtures** — single file vs split by concern (Phase 59 per-block convention).
- **Wire-protocol exit-code mapping** — defaults in D-60-01 (`noop + debug-log` on non-0/non-2 exit). Planner picks.

---

## Deferred Ideas

(See CONTEXT.md `<deferred>` section for the canonical list — duplicated key items here for log self-containment.)

- `if`-field permission-rule matcher (MATCH-03) — Phase 61
- `asyncRewake` registry (HOOK-06 / EXEC-05) — Phase 62
- `Stop` / `StopFailure` lossy synthesis (PAYL-03 / PAYL-04) — v1.14+
- `PostToolBatch` / `UserPromptExpansion` / `ConfigChange` / `CwdChanged` / `FileChanged` events — v1.14+
- SURF-01 `info <plugin>` hooks-line rendering — Phase 63
- LIFE-01 5th cascade slot — Phase 63
- `HookExecResult` type-export through `bridges/hooks/index.ts` — future phase if needed
- Wire-protocol exit-1 (non-zero, non-2) defensive policy — v1.14+ security-review concern
- Telemetry for hook dispatch — IL-4 forbids in v1
