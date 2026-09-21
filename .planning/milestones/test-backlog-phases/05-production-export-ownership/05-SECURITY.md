---
phase: "05"
slug: "production-export-ownership"
status: secured
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-19"
register_authored_at_plan_time: true
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|----------------|
| Production operation to injected or filesystem boundary | Export cleanup must preserve validation, ownership checks, and lifecycle state | Public operation results, error contracts, emitted bytes, lifecycle/lock state, containment decisions, credential attributes |
| Source/configuration to analyzer and test runner | A missing caller, malformed report, or relaxed scope must not appear as a successful gate | Analyzer config (`.fallowrc.json`), argv, dead-code JSON report, finding identities, entry-point count, process exit status |

---

## Threat Register

The 28 plan registers (`05-01` through `05-28`) are row-identical in category, disposition, and mitigation shape except for the `-01` row's owner component (and two severities); each row below stands for its 28 plan-scoped IDs. All dispositions are `mitigate`. Evidence paths are relative to the repository root. All 28 `*-PLAN.md` files carry a `<threat_model>` block — no retroactive construction was needed.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-0[1-20]-01, T-05-23-01…T-05-28-01 (26 rows) | Tampering | Plan's owner module (see per-plan map below) | medium | mitigate | Every cited owner module exists and retains a live owner unit test; `test:corresponding` pairing gate + negative control in `npm run check`; caller-tracing proven mechanically — every named retirement (`resolveLoose`, `_ReasonInSet`, `RemovePrivateReason`, `SUPPORTED_COMPONENT_KINDS`, `check-phase-06-hub-ledger.mjs`) is 0 refs repo-wide; `tests/architecture/no-test-only-production-surface.test.ts` walks the whole tree and asserts a non-zero file count — no test-only substitution surface introduced. | closed |
| T-05-21-01 | Tampering | `platform/git.ts` | high | mitigate | `buildAuthCallbacks` and the callback protocol moved to `platform/git-auth-callbacks.ts:114` with 3 real production call sites (`git.ts:139,156,217`); `listBranches`/`listRemotes` retired with a `satisfies` retirement probe pinning their absence; `DEFAULT_CREDENTIAL_OPS` composed in `orchestrators/auth-host.ts:64`; construction-launches-nothing is an active throwing control (`tests/platform/git-credential.test.ts:116`); AUTH-09 credential-leak gate follows the move (`CREDENTIAL_LEAK_TARGETS`, `DECLARED_MODULE_ORDER` extended, registry order asserted by position, `scannedCallSites > 0` fails if either module holds no call site). | closed |
| T-05-22-01 | Tampering | `shared/path-safety.ts` | high | mitigate | Containment policy separated from the Node binding: `createPathSafetyGuard` at `shared/path-containment.ts:104` with `PathContainmentError`/`SymlinkRefusedError` (D-14 refuse-all-symlinks preserved); `path-safety.ts:15,18` binds the real `lstat`/`readlink` inspector, keeps public `assertPathInside`; `LexicalTraversalError` now module-private but identity still asserted in tests; `assertPathInside` retains 9 live production call sites — containment did not lose an enforcement point; `ConcurrentUninstallError`/`AgentForeignContentError`/`STATE_LOCK_HELD_PREFIX` retired with 0 remaining references anywhere. | closed |
| T-05-0[1-28]-02 (28 rows) | Repudiation | Finding census and public contract evidence | medium | mitigate | Census pinned by exact identity, not count: `UNOWNED_EXPORT_CENSUS`/`PRODUCTION_FINDING_CENSUS` asserted empty with drift controls rejecting addition, removal, **and equal-count swap**; shipping argv vs. explicit `--production` argv proven identical; `entryPointCount > 0` asserted; every routed finding requires an answering record row anchored to the leading cell; offender/benign calibration runs the shipping `.fallowrc.json` with only the entry overridden; config matches D-05 exactly (`deadCode: true, health: false, dupes: false`, `includeEntryExports: true`, `private-type-leaks: "error"`). | closed |
| T-05-0[1-28]-03 (28 rows) | Information disclosure | Test filesystem and subprocess boundaries | low | mitigate | 100/101 `mkdtemp` test files pair with `t.after`/`finally` cleanup (the one exception is pre-existing, outside this phase's scope — see Unregistered Flags); every analyzer/subprocess launch uses fixed array argv with no shell, backed by `tests/architecture/no-shell-out.test.ts`; credential fixtures are obvious fakes only, no live credential store or network reached. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Per-Plan `-01` Component Map

| Plan | Threat ID | Component | Severity | Owner test |
|------|-----------|-----------|----------|------------|
| 05-01 | T-05-01-01 | `tests/architecture/fallow-production-mode.test.ts` | medium | self (control harness) |
| 05-02 | T-05-02-01 | `tests/architecture/markers-snapshot.test.ts` | medium | self |
| 05-03 | T-05-03-01 | `bridges/agents/convert.ts` | medium | `tests/bridges/agents/convert.test.ts` (45 assertions) |
| 05-04 | T-05-04-01 | `edge/handlers/plugin/enable-disable.test.ts` | medium | self |
| 05-05 | T-05-05-01 | `bridges/hooks/event-router.ts` | medium | `tests/bridges/hooks/event-router.test.ts` (112) |
| 05-06 | T-05-06-01 | `bridges/hooks/if-field/index.ts` | medium | `tests/bridges/hooks/if-field/index.test.ts` (27) |
| 05-07 | T-05-07-01 | `bridges/hooks/stage.ts` | medium | `tests/bridges/hooks/stage.test.ts` (57) |
| 05-08 | T-05-08-01 | `bridges/mcp/index.ts` | medium | `tests/bridges/mcp/index.test.ts` (7) |
| 05-09 | T-05-09-01 | `bridges/mcp/marker.ts` | medium | `tests/bridges/mcp/marker.test.ts` (10) |
| 05-10 | T-05-10-01 | `domain/plugin-resolver.ts` | medium | `tests/domain/plugin-resolver.test.ts` (297) |
| 05-11 | T-05-11-01 | `domain/components/hooks.ts` | medium | `tests/domain/components/hooks.test.ts` (14) |
| 05-12 | T-05-12-01 | `persistence/config-io.ts` | medium | `tests/persistence/config-io.test.ts` (23) |
| 05-13 | T-05-13-01 | `edge/completions/data.ts` | medium | `tests/edge/completions/data.test.ts` (51) |
| 05-14 | T-05-14-01 | `orchestrators/import/settings.ts` | medium | `tests/orchestrators/import/settings.test.ts` (48) |
| 05-15..18 | T-05-1[5-8]-01 | `orchestrators/plugin/operations.ts` | medium | `tests/orchestrators/plugin/operations.test.ts` (41) |
| 05-19 | T-05-19-01 | `orchestrators/plugin/install.messaging.ts` | medium | `tests/orchestrators/plugin/install.messaging.test.ts` (39) |
| 05-20 | T-05-20-01 | `orchestrators/reconcile/apply.ts` | medium | `tests/orchestrators/reconcile/apply.test.ts` (192) |
| 05-21 | T-05-21-01 | `platform/git.ts` | **high** | `tests/platform/git.test.ts` + `tests/platform/git-auth-callbacks.test.ts` (21, new owner) |
| 05-22 | T-05-22-01 | `shared/path-safety.ts` | **high** | `tests/shared/path-safety.test.ts` + `tests/shared/path-containment.test.ts` |
| 05-23 | T-05-23-01 | `shared/notification-types.ts` | medium | `tests/shared/notification-types.test.ts` (12) |
| 05-24 | T-05-24-01 | `bridges/hooks/payloads/pre-tool-use.ts` | medium | `tests/bridges/hooks/payloads/pre-tool-use.test.ts` (6) |
| 05-25 | T-05-25-01 | `bridges/hooks/payloads/session-start.ts` | medium | `tests/bridges/hooks/payloads/session-start.test.ts` (9) |
| 05-26 | T-05-26-01 | `bridges/hooks/payloads/pre-compact.ts` | medium | `tests/bridges/hooks/payloads/pre-compact.test.ts` (3) |
| 05-27 | T-05-27-01 | `bridges/hooks/payloads/stop.ts` | medium | `tests/bridges/hooks/payloads/stop.test.ts` (11) |
| 05-28 | T-05-28-01 | `index.ts` | medium | `tests/index.test.ts` (74) |

All paths under `extensions/pi-claude-marketplace/`. All 25 distinct cited component paths resolve on disk.

**Suppression-set cross-check** (phase base `2c67f391` vs. now): `private-type-leak` 3→2 (one **removed**, plan 05-14); `unused-type` 1→1 (unchanged, predates the phase); `unused-export` 0→1 (D-06-authorized Pi manifest-loaded default, `index.ts:44`); `unused-class-member` 0→1 (D-06-authorized `RingBuffer.read`, `ring-buffer.ts:137`). Net delta is exactly D-06's two authorized additions plus one removal — no blanket exemption of any kind.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-12-01 | `loadConfig`/`saveConfig`/`loadState`/`saveState` take validity and the diagnostic from `VALIDATOR.Errors(value)`'s first entry rather than narrowing through `VALIDATOR.Check(value)` (code review WR-03: fail-closed → fail-open trade). In `typebox@1.3.28`, `Validator.Errors` calls the same accelerated `Check` first, so the first error *is* the validity answer for these schemas. The boundary refusal itself is present and tested (`config-io.ts:186-188` throws before any byte reaches disk; `tests/persistence/config-io.test.ts:345`, `tests/persistence/state-io.test.ts:887`). **Reopening trigger:** a change to the validator dependency's `Errors` implementation, not the schema shape. | Operator (recorded in `deferred-items.md`, status `closed — deliberate and approved`) | 2026-09-15 |

---

## Unregistered Flags

**None with a security gap.** 7 SUMMARY files (05-07, 05-12, 05-21, 05-24, 05-25, 05-26, 05-27) carry a `## Threat Flags` section, each declaring "None" and mapped to their own threat IDs — verified in code, not accepted as prose. The other 21 SUMMARY files carry no `## Threat Flags` section at all; those 21 plans' mitigations were verified directly against implementation and the whole-tree gates (empty identity-pinned census, `no-test-only-production-surface`, `no-shell-out`, `no-credential-leak`, `no-orchestrator-network`, `test:corresponding`) instead.

**Informational, no gap:**
1. `tests/orchestrators/plugin/clone-cache.test.ts` is the one `mkdtemp` user without `t.after`/`finally` root cleanup — not named in any Phase 05 plan's `files_modified`, so it's pre-existing hygiene outside this phase's mitigation scope (and below the `high` threshold regardless).
2. Code-review warnings WR-01 (production dead-code mode un-gating `tests/`/`scripts/` cycle detection) and WR-02 (credential-leak gate scanning a zero-call-site file) are both fixed in the tree (`dfe78c9e`, `2c4c6d72`). WR-04/WR-05 are documentation-claim findings with no security surface.
3. Both security-relevant `deferred-items.md` entries are recorded `closed` and independently confirmed: `orchestrators/plugin/operations.ts` is a member of `NETWORK_FREE_TARGETS`; `platform/git-auth-callbacks.ts` is a member of `CREDENTIAL_LEAK_TARGETS` with `DECLARED_MODULE_ORDER` extended in lockstep.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-19 | 84 (28 plan registers × 3 rows) | 84 | 0 | gsd-security-auditor (retroactive audit ahead of catch-up PR; covers the post-execution code review whose five warnings were addressed in `2c4c6d72`..`dfe78c9e`) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-19
