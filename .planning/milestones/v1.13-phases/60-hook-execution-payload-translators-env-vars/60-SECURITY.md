---
phase: 60-hook-execution-payload-translators-env-vars
status: secured
threats_open: 0
threats_total: 31
threats_mitigate: 21
threats_accept: 6
threats_na: 4
asvs_level: 1
block_on: high
created: 2026-06-15
audited: 2026-06-15
---

# Phase 60: Security Audit

**Phase:** 60 — hook-execution-payload-translators-env-vars
**Threats Closed:** 31/31
**ASVS Level:** 1

This audit verifies each declared `<threat_model>` mitigation from PLAN files
60-01..60-04 against the implemented source. Mitigation evidence is by direct
grep / source inspection of the artifacts cited in each plan's mitigation
clause. Accepted risks are confirmed as documented; `n/a` supply-chain
threats are confirmed as zero-new-dependency.

## Disposition Summary

| Disposition | Count |
|-------------|-------|
| mitigate    | 16    |
| accept      | 4     |
| n/a (SC)    | 4     |
| **Total**   | **24** |

All `mitigate` threats verified CLOSED via grep / source inspection of the
artifacts named in each plan's mitigation clause.

## Plan 60-01 — Translators + TOOL-01 helper

| Threat ID | Category | Disposition | Verification | Evidence |
|-----------|----------|-------------|--------------|----------|
| T-60-01-01 | Information disclosure (CustomToolCallEvent passthrough) | accept | Documented as upstream behavior; `mapPiToClaudeToolName` exposes plugin-supplied `event.toolName` verbatim. No secret material flows through this field. | `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts:143-145` (passthrough via `?? name`); confirmed in 60-VERIFICATION.md observable truth #1. |
| T-60-01-02 | Tampering (field drop/rename) | mitigate | Per-event round-trip fixtures + per-event byte-equal unit tests. | `tests/architecture/hooks-translators.test.ts` (Block B round-trip × 8) + 8 per-event tests under `tests/bridges/hooks/payloads/`; verified GREEN in 60-VERIFICATION.md. |
| T-60-01-03 | Tampering (new event without translator) | mitigate | Closed-set tuple iteration asserts file presence. | `tests/architecture/hooks-translators.test.ts` Block A iterates `BUCKET_A_EVENTS` from `domain/components/hook-events.ts`; missing translator fails presence assertion. |
| T-60-01-04 | Information disclosure (empty transcriptPath) | accept | `transcriptPath` falls back to `""` when `getSessionFile()` is undefined; alternative (synthesized fake path) is more misleading. | `extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts` empty-string fallback; covered by `tests/bridges/hooks/translation-context.test.ts`. |
| T-60-01-SC | Supply chain | n/a | Zero new npm/pip/cargo dependencies. | 60-01-SUMMARY.md `tech-stack.added: []`; no `package.json` dependency added. |

## Plan 60-02 — Exec body + wire-protocol + env vars

| Threat ID | Category | Disposition | Verification | Evidence |
|-----------|----------|-------------|--------------|----------|
| T-60-02-01 | Tampering (shell metacharacter relied on no expansion) | mitigate | EXEC-04 exec-form vs shell-form discrimination: `args !== undefined` → `spawn(cmd, args, { shell: false })`. | `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:322-336` `planSpawn`; `Array.isArray(argsField)` arm returns `shell: false`. |
| T-60-02-02 | DoS (long-running hang) | mitigate | EXEC-02 SIGTERM → 5s → SIGKILL timer ladder with `.unref()`, canceled on natural exit. | `extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts:21,54-66` `SIGKILL_GRACE_MS = 5_000`, both timers `.unref()`'d; `child.killed` guard for TOCTOU. Caller wires `ladder.cancel` on `close` AND `error` events at `dispatch-exec.ts:362-370,429-448`. |
| T-60-02-03 | DoS (stdout flood) | mitigate | Manual 1 MB stdout / 64 KB stderr UTF-8-byte caps with kill-on-overflow + `hookDebugLog` + `noop`. Post-CR-02 fix uses `Buffer.byteLength(..., "utf8")`. | `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:84-88,381-405,479-507` (`STDOUT_MAX_BYTES`, `STDERR_MAX_BYTES`, `accumulateStream` with `Buffer.byteLength` at line 493). WR-01/WR-07 fix detaches `data` listeners on overflow and arms tight escalation ladder. |
| T-60-02-04 | DoS (stdin > 256 KB) | mitigate | 256 KB UTF-8-byte truncation + top-level `_truncated: true` marker (CR-02 + WR-02 fix). | `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:249-269` `serializeWithTruncation`; `Buffer.byteLength(raw, "utf8")` at :251; marker assigned LAST at :261 (WR-02 fix: payload-supplied `_truncated` cannot override). |
| T-60-02-05 | Path traversal (PLUGIN_ROOT/PLUGIN_DATA) | mitigate | `assertPathInside` guards on both env-var path constructions. | `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:282` (`CLAUDE_PLUGIN_ROOT`) and `:285` (`CLAUDE_PLUGIN_DATA`). |
| T-60-02-06 | Path traversal (CLAUDE_ENV_FILE) | mitigate | `assertPathInside(loc.dataRoot, envFile, "CLAUDE_ENV_FILE")` guards SessionStart env-file path. | `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:296`. |
| T-60-02-07 | Information disclosure (process.env inheritance) | accept | Matches Claude Code upstream behavior; future REQ may add denylist. | `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:287-292` env spreads `...process.env`; documented in 60-02-PLAN.md threat model. |
| T-60-02-08 | Information disclosure / IL-2 (stderr leak via ctx.ui.notify) | mitigate | Stderr routed only through `hookDebugLog`; zero `ctx.ui.notify` live calls. | `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:442-445` (sole sink); `grep "ctx\.ui\.notify"` returns only comment lines at `:35` and `:442`; architecture-test Block C in `tests/architecture/hooks-exec.test.ts` pins via static-grep. |
| T-60-02-09 | Tampering (malformed JSON) | mitigate | `try/catch JSON.parse` + non-object reject + 11 fixtures default to noop on unrecognized shape. | `extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts:54-64,73-75` (JSON.parse try/catch, defaults to `noop`); `tests/bridges/hooks/wire-protocol.test.ts` 11 fixtures GREEN per 60-02-SUMMARY.md. |
| T-60-02-10 | Tampering (EPIPE uncaught) | mitigate | `child.stdin.on("error", ...)` attached BEFORE `child.stdin.end(payload)`; outer try/catch wraps body. | `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:454-459` error listener BEFORE `end`; outer try/catch at `:151-161` (never-throws). |
| T-60-02-11 | Spoofing (silent whitelist widening) | mitigate | Whitelist asserts exactly 2-element set via sibling test. | `tests/architecture/no-shell-out.test.ts:57-60` 2-entry Set; `:112-117` "exactly two files" assertion with full sorted-array equality. |
| T-60-02-SC | Supply chain | n/a | Zero new dependencies. | 60-02-SUMMARY.md `tech-stack.added: []`. |

## Plan 60-03 — Reducer + per-event adapters

| Threat ID | Category | Disposition | Verification | Evidence |
|-----------|----------|-------------|--------------|----------|
| T-60-03-01 | Tampering (event.input crash-shape from prior hook) | accept | Matches Claude Code sequential-chain upstream; never-throws contract in dispatchHookExec converts corrupted next-entry to `noop`. | `dispatch-exec.ts:151-161` outer try/catch; documented in 60-03-PLAN threat model. |
| T-60-03-02 | Tampering (executor returns unknown kind) | mitigate | `assertNever(r)` in reducer default arm; TypeScript exhaustiveness compile-time check. | `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:51,199` `import { assertNever }` + `default: return assertNever(r);` in `reduceBucket`. |
| T-60-03-03 | Information disclosure (observation block reason dropped) | accept | `adaptObservationResult` debug-logs the dropped reason; telemetry is IL-4 out-of-scope. | `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:271-293` (`hookDebugLog` on block/stop arms). |
| T-60-03-04 | Tampering (mutation visibility ordering) | mitigate | `applyMutationInPlace(event, r)` runs synchronously inside loop body BEFORE next iteration. | `dispatch.ts:184` `applyMutationInPlace(event, r)` synchronous-call site; Block B reducer test pins B-1 + B-2 left-to-right composition. |
| T-60-03-05 | DoS (mutate-chain payload accumulation) | accept | Documented upstream behavior; per-entry 256 KB stdin cap from Plan 60-02 bounds size. | `serializeWithTruncation` at `dispatch-exec.ts:249-269` caps each entry independently. |
| T-60-03-SC | Supply chain | n/a | Zero new dependencies. | 60-03-SUMMARY.md `tech-stack.added: []`. |

**Bonus mitigation (CR-01, post-review fix):** `applyMutationInPlace` now
applies a **field-by-field whitelist** for `tool_result` (only `content` /
`isError` may mutate) and **rejects non-object patches** for `tool_call`
(defuses prototype pollution and discriminator rewrite). See
`extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:77-126`.
This narrows T-60-03-01's blast radius further than the accepted upstream
contract.

## Plan 60-04 — Lifecycle hardening + REQ amendment

| Threat ID | Category | Disposition | Verification | Evidence |
|-----------|----------|-------------|--------------|----------|
| T-60-04-01 | Information disclosure (WR-01 phantom-cache entry) | mitigate | Clear-cache prefix removes stale project-scope entries before re-hydrate; post-WR-04 snapshot-keys. | `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:458-481` `hydrateProjectScopeForCwd` (`Array.from` snapshot at :477, `startsWith("project\x00")` delete at :478-480). |
| T-60-04-02 | Tampering (install routing-table stale) | mitigate | `rebuildRoutingTables` called immediately after `addInstalledPluginHooksToCache` inside per-plugin lock. | `orchestrators/plugin/install.ts:1013` cache add helper + `:1020` `rebuildRoutingTables(state, locations)`. Post-WR-06 the call site is after `tx.save()` so a tx-save throw cannot strand a phantom entry. |
| T-60-04-03 | Tampering (uninstall routing-table stale) | mitigate | `rebuildRoutingTables` called immediately after `removePluginConfigFromCache` inside `withLockedStateTransaction`. | `orchestrators/plugin/uninstall.ts:47` (import), `:456` (cache remove), `:464` (rebuild). |
| T-60-04-04 | Tampering (reinstall/update stale entry) | mitigate | Explicit cache remove + rebuild + add wiring inside per-plugin locks. | `orchestrators/plugin/reinstall.ts:42-44,1114,1124,1174` (remove + rebuild + add); `orchestrators/plugin/update.ts:67-69,1118,1128,1165` (same pattern). |
| T-60-04-05 | Tampering (concurrent install race) | mitigate | Per-plugin lock serializes cache mutation; `rebuildRoutingTables` is synchronous and reads consistent snapshot; DISP-02 preserved. | `event-router.ts:191-211` `rebuildRoutingTables` is synchronous + zero disk I/O; all orchestrator call sites are inside their per-plugin lock body. |
| T-60-04-06 | Tampering (silent regression in future orchestrator) | mitigate | Architecture-test negative pin Block F asserts every cache-mutator file also calls `rebuildRoutingTables`. | `tests/architecture/hooks-lifecycle.test.ts:265-307` Block F iterates `orchestrators/plugin/*.ts`, asserts ≥ 4 matched files, fails on any cache mutator without a sibling rebuild call. |
| T-60-04-07 | Information disclosure (doc drift HOOK-05 wording) | mitigate | REQUIREMENTS.md HOOK-05 amended with audit trail; doc-vs-code grep gate. | `.planning/REQUIREMENTS.md:27` contains `per-session scratch file under \`<scopeRoot>/pi-claude-marketplace/data/_shared/claude-env-<sessionId>.env\`` and trailer `(amended 2026-06-14 per D-60-06)`; `grep "per-hook scratch file"` returns 0. |
| T-60-04-SC | Supply chain | n/a | Zero new dependencies. | 60-04-SUMMARY.md `tech-stack.added: []`. |

## Unregistered Flags

SUMMARY.md `## Threat Flags` sections were not present as explicit blocks
in 60-01..60-04 summaries; however, all observed new attack surfaces map
to existing threats in the register:

- **node:child_process whitelist widening (Plan 60-02)** — maps to T-60-02-11. New attack surface (hook spawn) is the explicit subject of EXEC-01..04 + T-60-02-01..04.
- **Hook stdin/stdout/stderr wire protocol (Plan 60-02)** — maps to T-60-02-04 / T-60-02-09 / T-60-02-10.
- **`_shared` per-session env file path scheme (Plan 60-02)** — maps to T-60-02-06.
- **In-place mutation of Pi events across reducer iterations (Plan 60-03)** — maps to T-60-03-01 / T-60-03-04; CR-01 fix narrows the surface beyond the planned mitigation.
- **State-cache mutation outside per-plugin lock (Plan 60-04)** — maps to T-60-04-02..05; WR-06 fix moves cache mutation past `tx.save()` to eliminate the strand window.

No unregistered new attack surfaces detected.

## Accepted Risk Log

| ID | Risk | Rationale |
|----|------|-----------|
| T-60-01-01 | CustomToolCallEvent toolName passthrough to Claude stdin | Plugin-supplied; matches upstream; no secret material; documented for plugin authors in Phase 63 SURF-06. |
| T-60-01-04 | Empty-string `transcriptPath` may mislead a hook reading it | Documented; alternative (synthesized fake path) is more misleading; documented for plugin authors. |
| T-60-02-07 | Hook child inherits Pi's full `process.env` (including secrets) | Matches Claude Code upstream behavior; explicit v1.13 acceptance; future REQ may add denylist. |
| T-60-03-01 | Hook entry can mutate `event.input` into a shape that breaks the next entry's translator | Matches Claude Code sequential-chain upstream contract; never-throws dispatch converts the corrupted entry to `noop`. CR-01 whitelist narrows the practical blast radius. |
| T-60-03-03 | `stop`/`block` reason on observation events silently dropped | Telemetry is IL-4 Out of Scope for v1; reason is debug-logged via hookDebugLog so operators with `PI_CLAUDE_MARKETPLACE_DEBUG=1` can observe. |
| T-60-03-05 | Large mutate-chain payload accumulation across entries | Documented upstream; 256 KB per-entry stdin truncation from Plan 60-02 bounds per-child overhead. |

## Code-Review Carry-Forward Concerns (info-only, post-fix)

Quick scan of the 4 `IN-NN` info findings left out of scope by 60-REVIEW-FIX.md:

- **IN-01 (stderr ledger formatting):** Stylistic — full 64 KB stderr emitted as a single `console.error` line when `PI_CLAUDE_MARKETPLACE_DEBUG=1`. No security impact; secrets-in-stderr risk is the operator's, gated behind the debug env var.
- **IN-02 (`compositeHandlerFor` early-exit cast):** TypeScript narrowing-cast doc polish. No runtime security impact.
- **IN-03 (magic-string `"tool_call"` / `"tool_result"` literals in event-adapters):** Forward-compat hazard if Pi's `event.type` discriminator renames; would degrade `applyMutationInPlace` to a no-op (fail-closed), not a vulnerability. No security impact.
- **IN-04 (`serializeWithTruncation` re-check doc note):** Marker overshoot ≤ 20 bytes documented at `dispatch-exec.ts:236-237`. No security impact.

**None of the 4 carry-forward info findings have post-fix security implications.**

## Audit Conclusion

`## SECURED` — every declared `mitigate` threat is verified present in the
implemented source via grep / static inspection of the cited artifacts;
every `accept` threat's disposition is documented and remains within the
accepted-risk envelope; every `n/a` supply-chain threat is confirmed at
zero new dependencies. The 9 critical+warning code-review findings from
60-REVIEW.md were closed in 60-REVIEW-FIX.md before audit; the CR-01 +
CR-02 + WR-06 fixes materially strengthen the mitigation posture vs. the
originally-planned implementation.

---

_Audited: 2026-06-15_
_Auditor: gsd-secure-phase (Claude)_
