---
phase: "03"
slug: "background-subagents"
status: verified
threats_open: 0
threats_open_nonblocking: 0
threats_total: 22
threats_closed: 22
asvs_level: 1
block_on: high
created: "2026-11-13"
---

# Phase 03 — Security

All 22 declared threats are closed: 18 high, 3 medium and 1 low. The auditor read current source and tests at `f6b162df` and ran no tests. The passing combined-tree gates are recorded in `03-VALIDATION.md`, waves 1 to 6.

## Trust Boundaries

| Boundary | Description | Data crossing |
| --- | --- | --- |
| Child process to parent hook state | A child must not reap, rewrite or kill the parent's or a sibling's hooks | Async-rewake journals, PIDs, dispatch markers |
| Companion prompt to hook identity | The child's type and id come from pi-subagents' prompt prefix, which plugin text can imitate | `agent_type`, `agent_id` |
| Child session to main-session events | A child runs tool hooks only; lifecycle events stay with the main session | Event routing policy |
| Installed agent file to converter | Generated launch mode and warnings change only through update or reinstall | `async` key, MCP warning text |
| Test fixture to host | Real companion children run against a loopback provider in sandbox homes | Processes, ports, environment |

## Threat Register

Paths without a prefix are relative to `extensions/pi-claude-marketplace/bridges/hooks/`; `agents/` is relative to `extensions/pi-claude-marketplace/bridges/`. Test and feature paths are repository-relative.

| Threat ID | Category | Component | Severity | Disposition | Mitigation evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T-03-01 | Denial of service | registry child startup/recovery | high | mitigate | Child journals in their own namespace (async-rewake/registry.ts:834-839); a child never reaps the parent table (692-694); recovery needs a dead owner and a matching marker (1004-1034). Proven by registry.test.ts:874-940 and test/integration/subagent-hook-ownership.test.ts:175-275. | closed |
| T-03-02 | Tampering | journal spawn/finalization/cleanup | high | mitigate | Owner captured once per scope and session (runtime.ts:416-430); bounded atomic writes behind path containment (registry.ts:864-891); per-path serialization (runtime.ts:479-492); a late exit edits only its own journal (registry.ts:507-571). Proven by runtime.test.ts:599-697 and registry.test.ts. | closed |
| T-03-03 | Denial of service | untrusted owner/PID metadata | high | mitigate | Strict envelope validation (registry.ts:894-964); only ESRCH counts as death, rechecked before signal and write (966-1033); capped scan of regular 64-hex files, symlinks refused. Proven by registry.test.ts:1706-2274. | closed |
| T-03-04 | Elevation of privilege | event-router hydration/policy | high | mitigate | Policy applies at dispatch after hydration and the project trust gate (event-router.ts:188, 1181-1213); untrusted projects never reaped (1342-1348). Proven by event-router.test.ts:4575-4636. | closed |
| T-03-05 | Denial of service | child Stop/compaction/teardown | high | mitigate | Exhaustive ten-event `CHILD_EVENT_POLICY` (event-router.ts:136-149); cleanup in `finally` (952-954). Proven by event-router.test.ts:4436-4692, features/plugin/subagent-child.feature:245, 273 and the real-child integration test. | closed |
| T-03-06 | Spoofing | runtime prefix parser and router capture | high | mitigate | Exact `PI_SUBAGENT_CHILD === "1"` (platform/subagent-child.ts:28-30); anchored prefix regex, one-pass decode, conflict and malformed give unavailable (runtime.ts:46-67, 373-396). Proven by runtime.test.ts:721-845 and subagent-child.feature:399-438. | closed |
| T-03-07 | Information disclosure | runtime/context/dispatch identity | high | mitigate | Session-scoped identity (runtime.ts:228-251, 398-404); immutable session-checked snapshots (translation-context.ts:65-78); captured at dispatch in every lane. Proven by translation-context.test.ts:236-270 and dispatch-exec.test.ts:858-1000. | closed |
| T-03-08 | Information disclosure | metadata diagnostic | medium | mitigate | Fixed constant, once per unavailable capture (event-router.ts:151-152, 279-281). Proven by event-router.test.ts:1443-1479 and subagent-child.feature:501-537. | closed |
| T-03-09 | Tampering | identity/ownership separation | high | mitigate | Routing reads only the child marker (event-router.ts:154-156); ownership uses session id and marker, never payload identity (registry.ts:261-263). Proven by registry.test.ts:874-940, 1133-1208. | closed |
| T-03-10 | Spoofing | child success/failure payload | high | mitigate | Identity added only on session match (payloads/pre-tool-use.ts:44-46, post-tool-use.ts:67-69, post-tool-use-failure.ts:64-66). All nine event/lane cells proven in registry.test.ts:1504-1600 and dispatch-exec.test.ts:914-1000. | closed |
| T-03-11 | Information disclosure | concurrent companion sessions | high | mitigate | Two sessions in one runner PID across two generations each keep their own identity: test/integration/pi-subagents-child-identity.test.ts:340-428, subagent-child.feature:566-602. | closed |
| T-03-12 | Denial of service | detached child completion | high | mitigate | Real background and MCP children complete past a blocking main Stop (pi-subagents-child-identity.test.ts:124-215); bounded waits and `finally` release (features/lib/real-subagent-child.ts:87-95, 653-711). | closed |
| T-03-13 | Information disclosure | fake-provider/process fixture | high | mitigate | Loopback-only provider that rejects other models (real-subagent-child.ts:380-421); allowlisted environment with `PI_OFFLINE=1` and no credentials (test/e2e/_rpc.ts:235-268); each case asserts the scripted model only. | closed |
| T-03-14 | Tampering | warning recognizer / grant candidate | high | mitigate | Exact full-string equality over two frozen generations (agents/mcp-async-warning.ts:22-54), scoped to the adapter (agents/grant-rewrite.ts:126-132). Proven by mcp-async-warning.test.ts:50-100 and agent-grants.feature:654-655. | closed |
| T-03-15 | Tampering | stored grant migration | high | mitigate | Provenance guard, containment, staged write under lock, index saved last (agents/grant-rewrite.ts:138-378). Proven by grant-rewrite.test.ts:378-399, 597-667. | closed |
| T-03-16 | Denial of service | legacy implementation-less record | medium | mitigate | Discovery and translation share `WARNING_GENERATIONS` (mcp-async-warning.ts:33, legacy-grant-form.ts:85-89). Proven by grant-rewrite.test.ts:233-246, 641-754 and agent-grants.feature:584-636. | closed |
| T-03-17 | Tampering | converter launch precedence | medium | mitigate | `async: true` only for an MCP grant or a strict-true `background`; no key otherwise (agents/convert.ts:971-974, 1035, 1081-1083). Proven by convert.test.ts:2136-2311. | closed |
| T-03-18 | Tampering | installed artifact migration | high | mitigate | Load keeps bytes; update and reinstall regenerate through existing transactions. Proven by update-swap.test.ts:2770, 2799, reinstall-flow.test.ts:1024, 1069 and features/agent/frontmatter.feature:72, 207. | closed |
| T-03-19 | Denial of service | ordinary background default | high | mitigate | The default change `b9e82f91` lands after child suppression and ownership (`ac952b64`, `4963f504`); an ordinary empty-body agent detaches and completes with identity: pi-subagents-child-identity.test.ts:217-281. | closed |
| T-03-20 | Tampering | emitted warning and diagnostic contract | low | mitigate | Corrected and historical warnings are exact literals (agents/mcp-async-warning.ts:12-34); current-literal owners in mcp-async-warning.test.ts and convert.test.ts; 03-04-01/02 passed. | closed |
| T-03-21 | Denial of service | process acceptance fixture | high | mitigate | `close()` kills only sandbox-HOME PIDs with a dispatch marker (features/lib/subagent-hook-session.ts:404-424, 579-593); bounded stages; release in `t.after` and `onRelease`; parent and sibling survival asserted. | closed |
| T-03-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package, lockfile, peer installer or peer version change between `cab4a540` and `f6b162df`. | closed |

## Accepted Risks Log

No risk accepted. Documented residuals outside the register:

- Research A1: another ambient extension could alter the companion prefix. Identity then reads as unavailable and only tool hooks run (T-03-06, T-03-09).
- A foreground pi-subagents child loads no ambient extension, so no plugin hook runs for its tool calls. Documented as a Pi capability gap in `docs/hooks-compatibility.md`.
- Advisory, test fixture only: `features/lib/real-subagent-child.ts:956` calls `kill(-(runner.pid ?? 0))` on the concurrent-runner timeout path. If spawn fails without a PID, this signals the test runner's own process group. Routed to the code-review fix pass.

No unregistered threat flags: all eight SUMMARY Threat Flags sections say None.

## Security Audit Trail

| Audit date | Threats total | Closed | Open blocking | Open nonblocking | Run by |
| --- | --- | --- | --- | --- | --- |
| 2026-11-13 | 22 | 22 | 0 | 0 | gsd-security-auditor: current-source read at f6b162df; T-03-20 confirmed by the orchestrator |

## Sign-Off

- [x] Every threat has a declared disposition and implementation evidence.
- [x] Residual risks documented; no new acceptance inferred.
- [x] No blocking or nonblocking threat remains open.
- [x] `status: verified`; `threats_open: 0`.

**Approval:** verified 2026-11-13 at f6b162df. No test suite was rerun by the auditor; the parent owns the combined-tree gate.
