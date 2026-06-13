# Research Summary — v1.13 Claude Hook Bridge

**Project:** pi-claude-marketplace v1.13
**Domain:** Subsequent-milestone bridge layer — Claude plugin hook events → Pi extension
event bus, integrated into the locked v1.12 declarative config + reconcile architecture.
**Researched:** 2026-06-13
**Confidence:** HIGH (all four research docs grounded in live source: `types.d.ts` peer dep,
`docs/research/claude-hooks-vs-pi-events.md` authority, real codebase file line citations,
and npm registry queries.)

---

## Executive Summary

The v1.13 hook bridge is a **brownfield addition** to a fully-shipped extension; it does
not re-derive the v1.0–v1.12 technology choices. The one new runtime dependency is
`chokidar@^5` (for `FileChanged` cross-platform watch synthesis), and the one API gate is
`pi.sendUserMessage(reason, { deliverAs: "followUp" })`, present since
`@earendil-works/pi-coding-agent` `>=0.74.0` (already within the existing peer floor). All
other stack additions are zero: built-in `node:child_process.spawn`, existing TypeBox 1.x
discriminated unions, existing `write-file-atomic`, existing `proper-lockfile`.

The bridge's central structural constraint is that **`pi.on()` returns `void` with no
`pi.off()` analogue**, verified in `dist/core/extensions/types.d.ts`. This forces the
composite-per-Pi-event dispatch model: one handler per Pi event type registered exactly
once at extension-factory time, with a mutable routing table (`shared/event-router.ts`)
rebuilt on every `/reload`. Any per-plugin handler approach would accumulate stale handlers
across reloads, permanently violating NFR-2. The routing-table rebuild is a sub-millisecond
synchronous pass triggered from `orchestrators/reconcile/apply.ts` after each scope's
apply pass, so the `/reload` lifecycle is the single path from config change to live
dispatch — no hot-swap is possible or desirable.

The highest correctness risk is the `Stop` bucket-D synthesis: `pi.on("agent_end", ...)`
is observation-only, so block-to-continue must be delivered as a synthetic user message via
`pi.sendUserMessage`. The canary plugin `ralph-wiggum` depends on this contract and serves
as the load-bearing integration test. Five bucket-D events have documented loss modes
(Stop timing-shift, CwdChanged bash-only, PostToolBatch count race, UserPromptExpansion
false-positive, StopFailure classifier). Five bucket-H events (`ConfigChange`, `Setup`,
`InstructionsLoaded`, `TaskCreated`, `TaskCompleted`) are semantically inapplicable and
silently dropped. Nine events are blocked on upstream PRs (buckets E/F/G); none of the 14
unsupported events appear in the official Anthropic first-party plugin catalog.

---

## Key Findings

### Stack Delta (STACK.md)

The v1.13 stack is the v1.12 stack plus exactly one new runtime dependency.

**New runtime dep:**

| Dependency | Version | Purpose |
|---|---|---|
| `chokidar` | `^5.0.0` | Cross-platform `fs.watch` wrapper for `FileChanged` synthesis (bucket B). Pure-JS in v5; engines `>=20.19.0` exactly matches NFR-4 floor. No native bindings, no new floor pressure. |

**No change (already present):**

| Item | Status |
|---|---|
| `@earendil-works/pi-coding-agent >=0.74.0` (peer floor) | `sendUserMessage` verified at `:292` and `:865` in `types.d.ts`; no peer-floor bump needed. |
| `typebox ^1.1.38`, `write-file-atomic ^8.0.0`, `proper-lockfile ^4.1.2` | Unchanged; hook bridge reuses all three. |
| `node:child_process.spawn`, `node:fs/promises`, `node:crypto` | No new built-in additions. |
| `memfs ^4.57.2` (dev) | chokidar does NOT respect `memfs`; hook bridge unit tests must mock behind a `WatchHost` seam. |

**Rejected alternatives:** `@parcel/watcher` (native bindings; install-failure surface);
`execa` (CLAUDE.md heuristic — `spawn` covers all needs); `p-debounce` / `lodash.debounce`
(chokidar's `awaitWriteFinish` + one inline `setTimeout` are sufficient).

**Do not add:** `fs.watchFile` (poll-based); `@types/chokidar` (chokidar v5 ships own `.d.ts`).

### Features (FEATURES.md)

**Table stakes (P1 — must ship in v1.13):**

| Feature | Notes |
|---|---|
| `hooks` component type in resolver + state schema | Blocker for all other features. |
| Bridge dispatch core (one composite `pi.on` per Pi event type) | NFR-2-forced; mutable routing table. |
| Per-event payload translators (16 supported events) | Bucket A (8 direct), B (FileChanged), D (Stop/CwdChanged/PostToolBatch/UserPromptExpansion/StopFailure), soft-dep (SubagentStart/Stop). |
| `Stop` JSON round-trip via `pi.sendUserMessage` — ralph-wiggum canary | Highest-risk synthesis; gates the milestone's correctness claim. |
| Typed `HookSummary` in `shared/notify.ts` | Blocks `info` surface and install-time warnings. |
| `info <plugin>`: `hooks:` line with matcher, gating, and soft-dep markers | `hooks` inserts between `commands` and `mcp` alphabetically. |
| Install-time bucket-D synthesis warnings | Per (plugin, bucket-D event); closed-set reason tokens. |
| Install-time hook-payload extension warnings | Known set: `asyncRewake`/`rewakeMessage`/`rewakeSummary`; unknown tolerated + debug-logged. |
| Hook execution context: Pi `ctx.cwd`; dual `CLAUDE_*` + `PI_*` env; per-hook `timeout` (default 60s) | Claude Code parity on cwd and timeout. |
| Lifecycle: hooks reconcile through v1.12 planner (`rebuildRoutingTables` call) | Zero new cascade rows; existing reload-hint trailer inherited. |
| Debug-log dispatch surface via `shared/debug-log.ts` (operator-only; env-gated) | Never `ctx.ui.notify` (IL-2). |
| H-bucket silent drop (5 events) at parse time | Debug-log only; no install-time warning. |

**Differentiators:**

- Bucket-D synthesis caveats disclosed AT INSTALL (unique to a bridge architecture).
- Per-entry gating disclosure on `info hooks:` line for G/H-bucket and soft-dep events.
- Typed `HookSummary` discriminated model makes match-trace and future per-entry surfaces
  cheap to add in v1.14+ without rebuilding.

**Deferred to v1.14+ (P2/P3):** match-trace command; G-bucket promotion when upstream PRs
land; full regex matcher support.

**Anti-features (do not implement):** per-hook telemetry (IL-4); hot-reload without
`/reload` (structurally impossible); per-hook enable/disable within a plugin; dedicated
`/claude:plugin hooks <plugin>` command; hook-config DSL extensions; refusing install for
H/G-bucket events; `list` hook-count column.

### Architecture (ARCHITECTURE.md)

The bridge is a **5th component bridge** parallel to skills/commands/agents/mcp, plus a
dispatch layer unique to this bridge.

**New files (key items):**

| Component | Path | Responsibility |
|---|---|---|
| Hook domain primitive | `domain/components/hooks.ts` | TypeBox schema; forward-compatible parser (`additionalProperties: true`); bucket-H tagging. |
| Bridge plan/stage/unstage/discover | `bridges/hooks/{plan,stage,unstage,discover}.ts` | Mirrors existing 4-bridge cascade; atomic `hooks.json` copy; idempotent `rm -rf`. |
| Matcher compiler | `bridges/hooks/matcher.ts` | Literal + pipe-OR → `Set<string>`; empty = MATCH_ALL; no regex engine. |
| Dispatch core | `bridges/hooks/dispatch.ts` | Composite `pi.on(...)` handlers; reads routing table. |
| Lifecycle | `bridges/hooks/lifecycle.ts` | `installComposites(pi)` (once from `index.ts`) + `rebuildRoutingTables(state, loc)` (from `reconcile/apply.ts`). |
| Routing-table singleton | `shared/event-router.ts` | Mutable `Map<PiEventName, Map<RoutingKey, RoutingEntry[]>>`; cleared + rebuilt per scope on every `/reload`. |
| Spawn + parse | `bridges/hooks/spawn.ts` | `node:child_process.spawn`; bounded stdout; SIGTERM→SIGKILL; tolerant JSON parse. |
| Per-event translators | `bridges/hooks/payloads/<event>.ts` (~16 files) | Bucket-D files carry loss-mode comment block from authority doc verbatim. |

**Modified files:** `persistence/state-io.ts` (schemaVersion widened; `resources.hooks`
added); `persistence/migrate.ts` (migrateV1ToV2); `domain/resolver.ts` (`hooks` moved to
supported set); `orchestrators/plugin/{install,uninstall,update,reinstall}.ts` (5th cascade
phase); `orchestrators/reconcile/apply.ts` (one-line rebuild call); `orchestrators/plugin/info.ts`
+ `list.ts` (hooks component); `shared/notify.ts` (`HookSummary`, new Reason member);
`index.ts` (one-line `installComposites(pi)` call).

**Dispatch ordering:** sorted by `compareByNameThenScope` (project-first, alphabetical);
within plugin, declaration order. Fan-out sequential and awaited within one handler
invocation.

### Critical Pitfalls (PITFALLS.md)

Full catalog is 22 pitfalls + integration gotchas + security mistakes in PITFALLS.md.
Top 5 by blast radius:

1. **Stale composite handler (zombie dispatch)** — `pi.on()` void return; handlers accumulate
   across reloads. Prevention: epoch guard in every composite handler closure; double-load
   test asserts exactly-one dispatch.

2. **`Stop` synthesis loop / contract break** — `agent_end` may fire multiple times; loop
   can run indefinitely. Prevention: idempotency guard per (plugin, turn-id); N-loop cap
   (default 10) with one-shot notify-warning; `ralph-wiggum` end-to-end integration test
   gates the milestone.

3. **State.json schema bump corrupts cross-version concurrency** — TypeBox strict mode
   rejects unknown fields in v1.12 reader. Prevention: widen `schemaVersion` to
   `Literal(1)|Literal(2)`; additive migration inside `withLockedStateTransaction`.

4. **`fs.watch` cross-platform brittleness breaks `FileChanged`** — atomic-rename makes
   watcher deaf after first save. Prevention: `chokidar@^5` with `awaitWriteFinish`;
   mandatory CI on Linux + macOS + Windows.

5. **Hook child-process timeout absent — agent loop hangs** — `spawn` defaults are wrong.
   Prevention: 60s default timeout + SIGTERM→SIGKILL; `maxBuffer: 1MB`; orphan cleanup on
   `session_shutdown`.

---

## Convergences

Cross-doc consensus — most reliable decisions for requirements anchoring.

| Convergence | Docs | Decision |
|---|---|---|
| Composite-per-Pi-event dispatch model | ARCHITECTURE §4 Pattern 1; PITFALLS §Pitfall 1 | Forced by `pi.on()` void return; only NFR-2-compliant design. |
| TypeBox discriminated `HookEventPayload` union | STACK §Focus area 4; ARCHITECTURE | Mirrors v1.10 `MarketplaceNotificationMessage`; Ajv rejected (no static narrowing). |
| `chokidar@^5` for `FileChanged` | STACK §Focus area 1; PITFALLS §Pitfall 4 | Sole new runtime dep; hand-rolled `fs.watch` rejected. |
| Typed `HookSummary` in `shared/notify.ts` | FEATURES §differentiators; ARCHITECTURE §6.3 | Must land with dispatch core; every `info`/install-warning surface depends on it. |
| `Stop` as milestone's load-bearing canary | FEATURES §MVP; ARCHITECTURE §Pattern 5; PITFALLS §Pitfall 6 | `ralph-wiggum` end-to-end test gates dispatch core phase. |
| IL-2 hook stderr → debug-log only at runtime | FEATURES §operator table stakes; PITFALLS §Pitfall 12 | Never routed through `ctx.ui.notify`. |
| Mid-reload event delivery is safe by Pi's call ordering | ARCHITECTURE §5.3; PITFALLS §Pitfall 2 | `resources_discover` is setup-phase; document assumption in `lifecycle.ts`. |
| `node:child_process.spawn` (not `execa`) | STACK §Focus area 6; PITFALLS §Integration gotchas | CLAUDE.md heuristic; `spawn` covers all needs. |
| Routing-table rebuild as side-effect of reconcile | ARCHITECTURE §Pattern 4; FEATURES §lifecycle | One `rebuildRoutingTables` call after each scope's apply pass; no parallel mechanism. |
| `additionalProperties: true` on hook-config TypeBox schema | STACK §Focus area 4; PITFALLS §Pitfall 7 | Strict rejection would block `security-guidance`. Known-extension list for install warnings. |

---

## Divergences

| Topic | Divergence | Consolidated decision |
|---|---|---|
| `Stop` synthesis disclosure | FEATURES: install warning; ARCHITECTURE: per-file comment; PITFALLS: idempotency guard + canary. | All three apply at different levels — not a conflict. |
| `StopFailure` install disclosure | FEATURES: no install warning; PITFALLS: classifier table + contract test. | Aligned: no user-visible install warning; classifier is code + test only. |
| Hook timeout default | FEATURES: 60s; PITFALLS: 30s. | 60s bridge-wide default when `timeout` field absent (matches Claude Code documented default). Per-hook-entry `timeout` field takes precedence. |
| SubagentStart/Stop soft-dep marker reuse | ARCHITECTURE: reuse `Dependency = "agents"` token; FEATURES: per-entry suffix on `info hooks:` line. | Both correct at different levels: top-level plugin row reuses `"agents"` token (no closed-set bump); per-entry suffix on `hooks:` line is a new inline annotation, not a `Dependency` token. |
| Debug-log seam | ARCHITECTURE: introduce `shared/debug-log.ts`; FEATURES: verify `pi.log`/`ctx.log.debug` at impl. | Introduce `shared/debug-log.ts`; check at Phase 5 implementation whether host exposes a preferred logger to route through. |

---

## What Requirements Should Anchor On

Each item maps to a contract that REQUIREMENTS.md should encode as a REQ-ID.

1. Bridge calls `pi.on(eventName, handler)` exactly once per supported Pi event type at
   extension-factory time; handlers read routing state from `shared/event-router.ts`; table
   is cleared and rebuilt synchronously in `rebuildRoutingTables(state, loc)` called from
   `reconcile/apply.ts` after each scope's apply pass.

2. Every composite handler closes over an epoch integer; a module-level `liveEpoch` cell
   is bumped on each bridge load; stale handlers from prior loads are no-ops.

3. `FileChanged` synthesis uses `chokidar@^5` with `awaitWriteFinish`; cross-platform CI
   matrix (Linux + macOS + Windows) is mandatory, not optional.

4. `Stop` synthesis intercepts `agent_end`; on hook returning `{decision: "block",
   reason: "..."}`, bridge calls `pi.sendUserMessage(reason, { deliverAs: "followUp" })`
   exactly once per logical agent end (idempotency guard); N-loop safety cap (default 10)
   with one-shot notify-warning when cap is hit.

5. Routing-table dispatch ordering is deterministic: entries sorted by
   `compareByNameThenScope`; within one plugin, declaration order from `hooks.json`;
   fan-out sequential and awaited within one handler invocation.

6. Hook child processes: 60s bridge-wide default timeout (overridden by per-hook-entry
   `timeout` field); SIGTERM after timeout, SIGKILL after 5s grace; `maxBuffer: 1MB`;
   stdin payload truncated at 256KB with `_truncated: true` marker; stderr debug-log only
   (never `ctx.ui.notify` — IL-2).

7. Hook config parser: TypeBox with `additionalProperties: true` at every nesting level;
   known payload-extension allow-list (`asyncRewake`, `rewakeMessage`, `rewakeSummary`);
   known fields → one-shot install notify warning; unknown fields → debug-log only.

8. Matcher translation: literal tool names and pipe-OR alternation only; regex matchers
   detected and rejected at install with per-entry notify error; plugin install NOT blocked
   (entry skipped, other entries install).

9. State schema bumps to `schemaVersion: 2`; migration additive (`hooks ??= []`),
   idempotent, inside `withLockedStateTransaction`; `schemaVersion` union widened to
   `Literal(1)|Literal(2)`.

10. Hook command path containment: every `command` must resolve (via `fs.realpath`) to a
    path inside the plugin's own tree; violation rejected at install via `assertPathInside`.

11. H-bucket events (5) silently dropped at parse; debug-log once per plugin per reload;
    `info` shows `(never fires) {inapplicable to Pi}` per entry.

12. G-bucket events (4) registered as never-fires; `info` shows
    `(never fires) {requires pi-<dep>}`; no dispatcher registered.

13. Soft-dep `SubagentStart`/`SubagentStop` wiring conditional on
    `softDepStatus(pi).agents.present`; per-entry `{requires pi-subagents}` marker on
    `info hooks:` line when probe reports unloaded.

14. All hook install/uninstall operations emit a plugin row through the v1.4
    `NotificationMessage` model, triggering the existing reload-hint cascade.

15. `shared/debug-log.ts` is the sole debug output seam for the hook bridge; gated on
    `PI_CLAUDE_MARKETPLACE_DEBUG=1`; never `console.error`, `process.stderr.write`, or
    `ctx.ui.notify` for runtime hook diagnostic output.

---

## Implications for Roadmap

The ARCHITECTURE.md §8 "Suggested Build Order" is the authoritative 9-phase structure.

### Phase 1: State Schema Bump + Migration

**Rationale:** LEAF dependency — every later phase's state mutations depend on the schema
shape. REQ 9.
**Code seam:** `persistence/state-io.ts::STATE_SCHEMA`, `persistence/migrate.ts::migrateV1ToV2`
**Pitfall owned:** Pitfall 9 (schema bump corrupts cross-version concurrency)
**Blocker for:** All phases. Must land first.
**Research flag:** Standard pattern (mirrors v1.12 autoupdate-scrub migration); skip research.

### Phase 2: Hook Parser + Matcher + Domain Primitive

**Rationale:** Pure leaf-pure code; no I/O; depends on Phase 1 schema shape only. REQs 7, 8.
**Code seam:** `domain/components/hooks.ts` (NEW); `bridges/hooks/matcher.ts` (NEW);
`domain/resolver.ts` (move `hooks` to supported set)
**Pitfall owned:** Pitfall 7 (strict TypeBox rejects `asyncRewake`); Pitfall 8 (regex
matcher silently treated as literal)
**Blocker for:** Phases 3 and 5. Parallel-eligible with nothing (depends on Phase 1 only).
**Research flag:** Standard; skip research.

### Phase 3: Hooks Bridge Plan/Stage/Unstage

**Rationale:** Depends on Phase 2. Mechanical copy of existing 4-bridge shape. REQ 10.
**Code seam:** `bridges/hooks/{plan,stage,unstage,discover}.ts` (NEW)
**Pitfall owned:** Pitfall 11 (containment escape); Pitfall 18 (exec bit absent); Pitfall 22
(missing hooks.json tolerance)
**Blocker for:** Phase 4. Parallel-eligible with Phase 5.
**Research flag:** Standard; skip research.

### Phase 4: Install Cascade Extension

**Rationale:** Depends on Phase 3. Extends from 4 bridges to 5 in `transaction/runPhases.ts`.
REQs 14, 20 (reload-hint).
**Code seam:** `orchestrators/plugin/{install,uninstall,update,reinstall}.ts`
**Pitfall owned:** Pitfall 3 (multi-process scope — lock scope extension); Pitfall 20
(reload-hint discipline)
**Blocker for:** Phase 8. Parallel-eligible with Phase 5.
**Research flag:** Standard; skip research.

### Phase 5: Dispatch Core

**Rationale:** Depends on Phase 2 (matcher + RoutingEntry shape); independent of Phases 3
and 4. REQs 1, 2, 5.
**Code seam:** `shared/event-router.ts` (NEW); `bridges/hooks/dispatch.ts` (NEW);
`bridges/hooks/lifecycle.ts` (NEW); `bridges/hooks/spawn.ts` (NEW); `index.ts` one-liner
**Pitfall owned:** Pitfall 1 (zombie dispatch — epoch guard); Pitfall 2 (mid-reload race —
document call ordering); Pitfall 17 (non-deterministic dispatch order)
**Blocker for:** Phases 6a/6b/6c, 7. Parallel-eligible with Phases 3, 4.
**Research flag:** Verify `pi.events` EventBus typing and `pi.on` overload signatures at
implementation start.

### Phase 6a: Bucket A Payload Translators (8 Events)

**Rationale:** Field renaming only; ~30–50 LoC each; zero synthesis risk. REQ 1 (per-event
round-trip).
**Code seam:** `bridges/hooks/payloads/{session-start,user-prompt-submit,pre-tool-use,
post-tool-use,post-tool-use-failure,pre-compact,post-compact,session-end}.ts`
**Pitfall owned:** Pitfall 21 (hook input payload size — stdin truncation)
**Parallel-eligible with 6b, 6c, 7.** Not a blocker for 6c.
**Research flag:** Standard; verify `PreToolUse` `updatedInput` mutation semantics at impl.

### Phase 6b: Bucket B — FileChanged

**Rationale:** One event; standalone cross-platform risk; mandates its own CI matrix. REQ 3.
**Code seam:** `bridges/hooks/payloads/file-changed.ts` (NEW); chokidar lifecycle in
`bridges/hooks/lifecycle.ts`
**Pitfall owned:** Pitfall 4 (fs.watch cross-platform brittleness) — owns it completely;
cross-platform CI matrix is this phase's gate.
**Parallel-eligible with 6a, 6c, 7.** Not a blocker for downstream phases.
**Research flag:** Confirm chokidar v5 `awaitWriteFinish` config options before implementation.

### Phase 6c: Bucket D — Stop First, Then Rest

**Rationale:** Stop separated — `ralph-wiggum` correctness gates the milestone. Stop ships
with its own regression test before the remaining 4 bucket-D events. REQs 4, 6.
**Code seam (Stop):** `bridges/hooks/payloads/stop.ts` (NEW); `tests/integration/ralph-wiggum.test.ts`
**Code seam (rest):** `bridges/hooks/payloads/{cwd-changed,post-tool-batch,
user-prompt-expansion,stop-failure}.ts` (NEW)
**Pitfall owned:** Pitfall 6 (Stop loop / contract break); Pitfalls 13–16 (D-event loss modes)
**Blocker for:** Phase 8 (dispatch fabric must be complete).
**Research flag:** Re-verify `pi.sendUserMessage` `deliverAs: "followUp"` semantics against
live peer dep at Phase 6c-stop start.

### Phase 7: Soft-Dep Wiring (SubagentStart/SubagentStop)

**Rationale:** Depends on Phase 5. Reuses `softDepStatus(pi)` probe. REQ 13.
**Code seam:** `bridges/hooks/lifecycle.ts::installComposites` (extend);
`bridges/hooks/payloads/{subagent-start,subagent-stop}.ts`
**Pitfall owned:** Pitfall 10 (soft-dep event-name drift — defensive try/catch)
**Parallel-eligible with 6a/6b/6c.** Not a blocker for Phase 8.
**Research flag:** Verify `pi.events.on` behavior when publisher absent; verify sync subagent
`tool_call` emission at implementation start.

### Phase 8: Lifecycle Integration with Reconcile

**Rationale:** Depends on Phases 5, 6, 7 (dispatch fabric complete). One-line code change
+ integration test. REQs 1, 9.
**Code seam:** `orchestrators/reconcile/apply.ts::applyPassForScope` (add
`bridge.rebuildRoutingTables(state, loc)`)
**Pitfall owned:** Pitfall 2 (mid-reload race — final verification); Pitfall 9 (schema bump —
end-to-end migration test)
**Cannot be parallel-eligible.** Depends on all Phase 6/7 work.
**Research flag:** Standard; skip research.

### Phase 9: Info/List Rendering + Install-Time Notify + Bucket-H/G Drop Policy

**Rationale:** All "what the user sees" in one merge: info.ts/list.ts rendering, install-time
cascade warnings, shared/notify.ts closed-set amendments, catalog-UAT byte-form lockstep.
REQs 11, 12, 14, 15.
**Code seam:** `orchestrators/plugin/info.ts` + `list.ts`; `shared/notify.ts` (new
`HookSummary`, new Reason member, new ClaudeHookEvent/GatingReason/FidelityNote tuples);
`docs/output-catalog.md` (byte-form additions); `bridges/hooks/plan.ts` (bucket-H drop)
**Pitfall owned:** Pitfall 19 (bucket-H drop UX); Pitfall 20 (reload-hint cascade — catalog
UAT fixture); Pitfall 12 (IL-2 — ESLint BLOCK A confirmed for all new files)
**Must be the final merge for catalog UAT coherence.**
**Research flag:** Standard; catalog UAT format well-established from v1.3/v1.4/v1.10/v1.11.

### Phase Ordering Rationale

- Phase 1 must precede all — schema shape is the base.
- Phase 2 must precede Phases 3 and 5 — both consume `ParsedHookEntry`.
- Phases 3, 4, 5 are parallel-eligible (all depend on Phase 2 only).
- Phases 6a, 6b, 6c, 7 are parallel-eligible (all depend on Phase 5 only).
- Phase 6c-stop MUST ship before 6c-rest (ralph-wiggum canary gates milestone credibility).
- Phase 8 must follow all Phase 6/7 work.
- Phase 9 must be the final merge.

### Research Flags

**Skip `/gsd-plan-phase --research-phase` for:** Phases 1, 2, 3, 4, 8, 9 (standard
patterns, well-documented in codebase).

**Verify at implementation start for:** Phase 5 (`pi.events` EventBus typing); Phase 6b
(chokidar v5 `awaitWriteFinish` options); Phase 6c-stop (`pi.sendUserMessage` `deliverAs`
semantics); Phase 7 (`pi.events.on` behavior when publisher absent; sync subagent
`tool_call` emission).

---

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack (delta) | HIGH | npm registry queried 2026-06-13; chokidar v5 engines verified; `sendUserMessage` confirmed in `types.d.ts:292,865`. |
| Features | HIGH | Grounded in locked authority doc + v1.12 output catalog discipline; PRD NFR/IL constraints are authoritative. |
| Architecture | HIGH | Every integration point cites real file + line numbers; no web ecosystem research used. |
| Pitfalls | HIGH (critical 1–12) / MEDIUM (bucket-D loss modes) | `pi.on()` non-removability and TypeBox strict-mode behavior verified; bucket-D synthesis failure modes documented but cannot be fully tested without live Pi runtime. |

**Overall confidence:** HIGH

### Gaps to Address

- **Pi EventBus typing for `pi.events.on`** — confirm throw-on-absent-publisher behavior
  at Phase 5/7 implementation start. Non-blocking: soft-dep wiring wraps in try/catch.
- **Sync subagent `tool_call`/`tool_result` emission** — confirm at Phase 7 via real run.
- **Chokidar v5 `awaitWriteFinish` exact config shape** — confirm defaults before Phase 6b.
- **`pi.sendUserMessage` `deliverAs: "followUp"` semantic** — verify against live Pi process
  as part of ralph-wiggum integration test in Phase 6c-stop.
- **Downgrade safety from v1.13 to v1.12** — whether to ship a v1.12 schema-relaxation
  patch before v1.13 is a release coordination decision not resolved in research. If not
  shipped, downgrade requires state.json delete; document in CHANGELOG.

---

## Sources

### Primary (HIGH confidence)

- `docs/research/claude-hooks-vs-pi-events.md` — authority doc: bucket assignments, synthesis
  approaches, soft-dep audit (pi-subagents@0.24.3 + pi-mcp-adapter@2.6.1), `pi.on()`
  non-removability, `ralph-wiggum` canary, `asyncRewake` discovery, official marketplace
  audit at commit `ca9f6045fc90c8244f9e787fb57d54b380f9a27c`.
- `@earendil-works/pi-coding-agent` `dist/core/extensions/types.d.ts` (at `^0.79.0`) —
  `sendUserMessage` at `:292` and `:865`; `pi.on()` void return; no `pi.off()`.
- npm registry (queried 2026-06-13) — `chokidar@5.0.0` engines `>=20.19.0`; pure-JS deps.
- `extensions/pi-claude-marketplace/` live codebase — all integration points cite real
  file + line numbers.
- `.planning/PROJECT.md` v1.13 milestone scope — locked decisions.
- `docs/prd/pi-claude-marketplace-prd.md` — NFR-1/2/3/5/7/10/11/12, IL-1/2/3/4, SC-1.

### Secondary (MEDIUM confidence)

- Node.js `fs.watch` platform-specific behavior (Node.js official docs).
- chokidar v4→v5 migration notes (paulmillr/chokidar README).
- `.planning/milestones/v1.12-research/` — v1.12 locked baseline; v1.13 inherits unchanged.

---

*Research completed: 2026-06-13*
*Milestone: v1.13 Claude Hook Bridge*
*Ready for requirements: yes*
