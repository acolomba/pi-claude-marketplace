---
phase: "05"
slug: mode-selected-json-sink
status: verified
threats_open: 0
asvs_level: 1
created: "2026-10-07"
---

# Phase 05 — Security

## Trust Boundaries

Mode validation precedes new command and lifecycle mutations. Explicit redacted
DTOs cross the Pi session boundary. Original runs and live contexts cross delayed
authentication and hook callbacks. Terminal cleanup and Stop-cap state precede
fallible output. Tests and lint rules protect transport ownership and evidence.

## Threat Register

Production paths below are relative to `extensions/pi-claude-marketplace/`;
`tests/`, `eslint.config.js`, and planning references are repository-relative or
local to this phase. The repeated supply-chain threat is deduplicated.

| Threat ID | Category | Component | Severity | Disposition | Mitigation evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T-05-01 | Tampering | edge/register.ts mode guard | high | mitigate | shared/notification-run.ts:13; edge/register.ts:141; tests/edge/register.test.ts:469 | closed |
| T-05-02 | Information Disclosure | notification-dispatch.ts transport | high | mitigate | shared/notification-dispatch.ts:388,403; shared/notification-json.ts:59,141,269; tests/architecture/catalog-uat/catalog-wire.test.ts:618 | closed |
| T-05-03 | Tampering | eslint.config.js rule composition | medium | mitigate | eslint.config.js:108,345,378; independent six append controls and retained NFR-5 control passed | closed |
| T-05-04 | Repudiation | tests/edge/json-capture.ts | medium | mitigate | tests/edge/json-capture.ts:29,35,41,46; tests/shared/notification-dispatch.test.ts:222,276,305 | closed |
| T-05-SC | Tampering | Package installation | high | mitigate | Dependencies unchanged from 26cb0056; no installation task or audit install; 05-07-SUMMARY.md:184,199 | closed |
| T-05-05 | Spoofing | Usage helper/run plumbing | medium | mitigate | edge/router.ts:209,228,258,267; tests/edge/router.test.ts:54 | closed |
| T-05-06 | Tampering | Mixed entry order | medium | mitigate | shared/notification-run.ts:37; shared/notification-dispatch.ts:403; tests/shared/notification-dispatch.test.ts:103 | closed |
| T-05-07 | Information Disclosure | Diagnostic raw transport | high | mitigate | orchestrators/plugin/shared.ts:1593; orchestrators/reconcile/apply.ts:1473; shared/notification-resolve.ts:617; tests/orchestrators/plugin/shared.test.ts:2202 | closed |
| T-05-08 | Repudiation | Post-commit diagnostic validation | medium | mitigate | tests/edge/json-capture.ts:35,46; tests/orchestrators/reconcile/apply.test.ts:2602,2688 | closed |
| T-05-09 | Information Disclosure | auth-host.ts onDeviceCode | high | mitigate | domain/github-auth.ts:420; orchestrators/auth-host.ts:195; shared/notification-json.ts:157; tests/architecture/no-credential-leak.test.ts:212,220; tests/orchestrators/auth-host.test.ts:146,182 | closed |
| T-05-10 | Elevation of Privilege | Optional update auth capability | medium | mitigate | orchestrators/plugin/update-preflight.ts:208,217; tests/orchestrators/plugin/update-preflight.test.ts:1291 | closed |
| T-05-11 | Spoofing | Delayed auth notification run | medium | mitigate | orchestrators/auth-host.ts:177,185,196; tests/orchestrators/auth-host.test.ts:121 | closed |
| T-05-12 | Tampering | index.ts load/session guards | high | mitigate | index.ts:88,96,114,148,175; tests/index.test.ts:928,1093 | closed |
| T-05-13 | Denial of Service | Lifecycle output and stale getters | high | mitigate | index.ts:107,118,142; edge/register.ts:162; tests/index.test.ts:970,1051,1132 | closed |
| T-05-14 | Tampering | event-router.ts factory mkdir | high | mitigate | bridges/hooks/event-router.ts:847,859,891,906,908,915; tests/bridges/hooks/event-router.test.ts:2202,2250,2309 | closed |
| T-05-15 | Repudiation | Lifecycle debug visibility | low | accept | Accepted risk AR-05-01 below; 05-CONTEXT.md:30,40; shared/debug-log.ts:22 | closed |
| T-05-16 | Denial of Service | Async-rewake terminal handling | high | mitigate | bridges/hooks/async-rewake/registry.ts:397,404,428,441,467; tests/bridges/hooks/async-rewake/registry.test.ts:138 | closed |
| T-05-17 | Spoofing | Stale callback host/context | high | mitigate | bridges/hooks/async-rewake/registry.ts:419; bridges/hooks/settle.ts:134,150,278; tests/bridges/hooks/settle.test.ts:264,786,990 | closed |
| T-05-18 | Denial of Service | Stop cap transition | high | mitigate | bridges/hooks/settle.ts:398; bridges/hooks/runtime.ts:177; tests/bridges/hooks/settle.test.ts:154 | closed |
| T-05-19 | Repudiation | Catalog transport capture | medium | mitigate | tests/architecture/catalog-uat/catalog-wire.test.ts:353,375,382,390,407,420,618 | closed |
| T-05-20 | Repudiation | Final verification record | medium | mitigate | 05-07-SUMMARY.md:169,282; 05-VALIDATION.md:294; parent check/corpus logs inspected | closed |

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
| --- | --- | --- | --- | --- |
| AR-05-01 | T-05-15 | Lifecycle output failures remain silent unless the existing opt-in debug logger is enabled. D-05-03 rejects an always-on fallback channel. | User; approval recorded in 05-CONTEXT.md:30 and decision at :40–42 | 2026-10-06 |

This records existing approval, not a new acceptance. `shared/debug-log.ts:22–24`
requires `PI_CLAUDE_MARKETPLACE_DEBUG=1`; the lifecycle catches use that logger.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
| --- | --- | --- | --- | --- |
| 2026-10-07 | 21 | 20 | 1 (low, non-blocking) | Independent gsd-security-auditor |
| 2026-10-07 | 21 | 21 | 0 | Orchestrator: persisted and checked prior D-05-03 acceptance |

The independent auditor verified all 20 code mitigations at ASVS L1, with no
unregistered flags. Its sole open item was the missing accepted-risk log entry;
AR-05-01 supplies that record. Blocking threshold is high; `threats_open: 0`.
The auditor also reran six append-entry lint controls and the retained network
restriction control successfully. Full check and strict corpus evidence comes
from verified commit `5ba904966f9d76e0f83651edc6c98b7967b88e22`, Node v26.10.0,
264 direct pairs and 3149 baseline entries with zero extras. No implementation
files, dependencies, or installed tools changed during this audit.

## Sign-Off

- [x] All threats have a disposition.
- [x] Accepted risks documented from existing authorization.
- [x] `threats_open: 0` confirmed.
- [x] `status: verified` set.

**Approval:** Security verification complete 2026-10-07. This does not resolve
A-05-01/02 or P-05-01/02 or declare the overall phase passed.

## Post-review mitigation check

Code review CR-01 exposed additional fresh callback roots beyond the initial
guard inventory. Commit `cd569d2aeb02f2691a636e325fc3c7976c4952c1` adds live
mode validation before six registered hook dispatch paths. This strengthens
the mode and stale-context mitigations without changing cleanup ownership.
The independent reviewer verified the original failure no longer occurs,
all callbacks use narrow validation catches, executor errors propagate,
and generation checks precede context access. Existing shutdown, orphan,
and terminal-child cleanup remains independent. No new threat or accepted
risk was introduced; `threats_open` remains zero.

The corrected combined tree passed `npm run check` (exit 0, Node v26.10.0,
264 direct pairs); see `/tmp/json-phase5-fixed-parent-check.log` and
05-REVIEW.md for the independent callback review.

The subsequent A-05-01 audit found state-changing bookkeeping callbacks also
needed guards. Commit `191f75e83dfa3fc26a43edaee315ce72da831ac2` covers those
roots and validates mode before assistant-cache consumption. Independent
review verifies all 11 registrations, preserves generation-first ordering,
and confirms cap/cache state and cleanup behavior. No threat acceptance was
added; zero threats remain open. The latest combined-tree gate passed with
264 direct pairs; see 05-STATE-GUARD-FIX.md for exact evidence and the
current commit reference.
