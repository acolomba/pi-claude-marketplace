---
phase: "06"
slug: command-run-contract
status: verified
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: "2026-10-09"
---

# Command-run contract security verification

The independent security auditor verified all 15 declared threats against
live source and tests at the configured level 1. All retain their planned
mitigate disposition. No accepted risk or transfer replaced a mitigation.

## Trust Boundaries

| Boundary | Data crossing |
| --- | --- |
| Command input to root identity | Canonical command and invocation IDs |
| Concurrent roots to original sink | Command, load and hook payloads |
| Thrown values to wire data | Credentials, paths, accessors and cause chains |
| Setup to business work | Identity allocation and inventory construction |
| Handler output to completion | Outcome, reload and delivery state |
| Sink failure to handler catch | Transport exceptions and recovery |
| Settlement to retained callbacks | Late notification attempts |
| Fixture inventory to validation | Original payload attempts and corpus |

## Threat Register

All paths below are relative to the repository root.

| Threat ID | Category | Component | Severity | Disposition | Mitigation evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T-06-01 | Spoofing | Router/register | high | mitigate | extensions/pi-claude-marketplace/edge/register.ts:150; tests/edge/router.test.ts:323; one canonical selector | closed |
| T-06-02 | Information disclosure | Run/callback roots | high | mitigate | extensions/pi-claude-marketplace/shared/notification-run.ts:77; tests/edge/register.test.ts:1430; copied origin and independent runs | closed |
| T-06-03 | Tampering | Schema/converter | medium | mitigate | extensions/pi-claude-marketplace/shared/notification-wire.ts:264; notification-json.ts:233; tests/architecture/wire-schema.test.ts:135 | closed |
| T-06-04 | Information disclosure | Error resolver | high | mitigate | extensions/pi-claude-marketplace/shared/notification-command-error.ts:29; tests/architecture/no-credential-leak.test.ts:1064; safe serialization and masking | closed |
| T-06-05 | Denial of service | Cause resolution | medium | mitigate | extensions/pi-claude-marketplace/shared/errors.ts:43; tests/shared/notification-command-error.test.ts:54; bounded traversal and hostile-accessor fallback | closed |
| T-06-06 | Tampering | Setup | high | mitigate | extensions/pi-claude-marketplace/edge/command-run.ts:25; tests/edge/command-run.test.ts:744; identity before construction and no handler after setup failure | closed |
| T-06-07 | Spoofing | Outcome classification | high | mitigate | extensions/pi-claude-marketplace/shared/notification-dispatch.ts:57; tests/edge/command-run.test.ts:520; exhaustive command-only classification | closed |
| T-06-08 | Tampering | Reload/partial output | high | mitigate | extensions/pi-claude-marketplace/shared/notification-dispatch.ts:502; tests/edge/command-run.test.ts:79,569; reload OR before attempts and retained durable state | closed |
| T-06-09 | Denial of service | Recovery | high | mitigate | extensions/pi-claude-marketplace/shared/notification-dispatch.ts:164; tests/shared/notification-dispatch.test.ts:242; nonrecursive recovery and logger containment | closed |
| T-06-10 | Tampering | Business catches | high | mitigate | extensions/pi-claude-marketplace/shared/notification-dispatch.ts:173; tests/orchestrators/plugin/list-flow.test.ts:65; tests/edge/command-run.test.ts:420 | closed |
| T-06-11 | Repudiation | Settlement | medium | mitigate | extensions/pi-claude-marketplace/edge/command-run.ts:74; shared/notification-dispatch.ts:497; tests/shared/notification-dispatch.test.ts:618 | closed |
| T-06-12 | Repudiation | Awaited carriers | high | mitigate | extensions/pi-claude-marketplace/orchestrators/auth-host.ts:191; tests/edge/register.test.ts:454; tests/orchestrators/marketplace/update.test.ts:323; tests/orchestrators/plugin/enable-disable.test.ts:4973 | closed |
| T-06-13 | Tampering | Catalog/capture | high | mitigate | tests/architecture/catalog-uat/catalog-wire.test.ts:622,720; retained strict corpus result: 3149 entries, zero extras | closed |
| T-06-14 | Information disclosure | All-kind matrix | high | mitigate | tests/edge/json-capture.ts:29; tests/architecture/catalog-uat/catalog-wire.test.ts:419; tests/architecture/no-credential-leak.test.ts:1048 | closed |
| T-06-SC | Tampering | Dependencies | high | mitigate | package.json and package-lock.json unchanged from 26cb0056; no new package installation | closed |

D-08 permits one direct recovery per ordinary append fault. Success reopens
delivery; failed recovery closes it without guaranteeing output. Construction
fault tests inject an escaping openRun failure. Production inventory probes
retain their caught-error degradation in platform/pi-api.ts:162.

## Accepted Risks Log

No accepted risks.

## Unregistered Flags

Both descriptor-less prohibitions remain **flagged-unverified** and require
the final verifier's disposition. Neither is accepted or verified here:

- Invocation correlation must not become persistent user or cross-command
  tracking or telemetry.
- Internal errors or delivery failures must not imply that completed changes
  were rolled back.

They do not increment the declared-register threats_open count.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
| --- | --- | --- | --- | --- |
| 2026-10-09 | 15 | 15 | 0 | Independent gsd-security-auditor |

The auditor reused the passing parent `npm run check` at
`f8e2a3889501d13634e1ff2d0ccd368df6f5d274`, Node `v26.11.0`, exit 0,
266 direct-coverage pairs. It confirmed an empty executable diff and no
untracked inputs. No tests were rerun or implementation files changed.

## Sign-Off

- [x] Every threat has its planned mitigate disposition.
- [x] No accepted risks or transfers were substituted.
- [x] threats_open is 0 at the high blocking threshold.
- [x] status is verified; independent goal verification remains separate.

**Verification:** 2026-10-09, configured ASVS level 1.
