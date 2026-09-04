---
phase: 109
slug: shared-contracts
status: verified
threats_open: 0
asvs_level: 1
block_on: high
created: 2026-08-29
---

# Phase 109 — Security

> Post-execution verification of the STRIDE registers authored in all 19 Phase 109 plans.

---

## Trust Boundaries

| Boundary                              | Description                                                                                         | Data Crossing                                                                            |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Production caller to shared export    | Inputs cross into the shared modules whose public-value and side-effect contracts Phase 109 locks.  | Paths, cache data, errors, environment values, notification context, and public scalars. |
| Shared module to host runtime         | Shared code crosses filesystem, process environment, console, cache, and notification boundaries.   | Local files, process state, diagnostic text, and rendered notification bytes.            |
| Owner test to runtime boundary        | Each owner controls and restores the mutable runtime state it exercises.                            | Case-local temporary trees, environment snapshots, cache keys, and strict mocks.         |
| External identity or package boundary | Phase 109 performs no authentication decision, external service call, or package-manager operation. | None.                                                                                    |

## Threat Register

| Threat ID   | Category                                   | Component                                                                   | Severity | Disposition | Verification evidence                                                                                                                  | Status |
| ----------- | ------------------------------------------ | --------------------------------------------------------------------------- | -------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-109-01    | Tampering                                  | Atomic JSON filesystem boundary                                             | medium   | mitigate    | `atomic-json.test.ts` pins parent creation, complete UTF-8 bytes, concurrent replacement, and rejected writes.                         | closed |
| T-109-01-NA | Spoofing                                   | External identity boundary                                                  | low      | accept      | The pair performs no authentication or external identity decision.                                                                     | closed |
| T-109-02    | Tampering / Denial of service              | Completion-cache memory and disk boundary                                   | high     | mitigate    | `completion-cache.test.ts` pins schema versions, corrupt JSON, poison semantics, TTL boundaries, and narrow/whole invalidation.        | closed |
| T-109-02-NA | Spoofing                                   | External identity boundary                                                  | low      | accept      | The pair performs no authentication or external identity decision.                                                                     | closed |
| T-109-03    | Tampering                                  | Hook summary type-to-byte projection                                        | medium   | mitigate    | `concerns/hooks.test.ts` pins closed unions and complete hook-block bytes for every strict and lenient arm.                            | closed |
| T-109-03-NA | Spoofing                                   | External identity boundary                                                  | low      | accept      | The pair performs no authentication or external identity decision.                                                                     | closed |
| T-109-04    | Tampering                                  | Soft-dependency marker selection                                            | medium   | mitigate    | `concerns/soft-dep.test.ts` covers all Boolean combinations with exact ordered marker arrays.                                          | closed |
| T-109-04-NA | Spoofing                                   | External identity boundary                                                  | low      | accept      | The pair performs no authentication or external identity decision.                                                                     | closed |
| T-109-05    | Information disclosure                     | Environment-gated console output                                            | medium   | mitigate    | `debug-log.test.ts` proves near-match gates are silent, the exact gate emits once, and process/console state is restored.              | closed |
| T-109-05-NA | Spoofing                                   | External identity boundary                                                  | low      | accept      | The pair performs no authentication or external identity decision.                                                                     | closed |
| T-109-06    | Information disclosure                     | Bridge error values crossing into callers                                   | medium   | mitigate    | `errors-bridges.test.ts` compares every stable public field, complete message, causes, and defensive collection behavior.              | closed |
| T-109-06-NA | Spoofing                                   | External identity boundary                                                  | low      | accept      | The pair performs no authentication or external identity decision.                                                                     | closed |
| T-109-07    | Information disclosure / Denial of service | Shared error and cause-chain projection                                     | medium   | mitigate    | `errors.test.ts` pins bounded cause traversal, cycle termination, stable fields, discriminants, and leak de-duplication.               | closed |
| T-109-07-NA | Spoofing                                   | External identity boundary                                                  | low      | accept      | The pair performs no authentication or external identity decision.                                                                     | closed |
| T-109-08    | Tampering                                  | Checked-in extension version constant                                       | low      | mitigate    | `extension-version.test.ts` pins the direct literal while the package-sync architecture test remains intact.                           | closed |
| T-109-08-NA | Spoofing                                   | External identity boundary                                                  | low      | accept      | The pair performs no authentication or external identity decision.                                                                     | closed |
| T-109-09    | Tampering / Denial of service              | Filesystem cleanup and rollback boundary                                    | medium   | mitigate    | `fs-utils.test.ts` uses case-owned trees and deterministic failures to pin cleanup, rollback, and tolerant-read contracts.             | closed |
| T-109-09-NA | Spoofing                                   | External identity boundary                                                  | low      | accept      | The pair performs no authentication or external identity decision.                                                                     | closed |
| T-109-10    | Spoofing / Denial of service               | Git error-to-reason classifier                                              | medium   | mitigate    | `git-failure-classifiers.test.ts` pins authentication/network boundaries and proves unrelated failures stay unclassified.              | closed |
| T-109-10-NA | Spoofing                                   | External identity boundary                                                  | low      | accept      | The pair performs no authentication or external identity decision.                                                                     | closed |
| T-109-11    | Tampering                                  | Stable user-visible marker prefixes                                         | low      | mitigate    | `markers.test.ts` compares both complete byte strings and the independent architecture snapshots remain green.                         | closed |
| T-109-11-NA | Spoofing                                   | External identity boundary                                                  | low      | accept      | The pair performs no authentication or external identity decision.                                                                     | closed |
| T-109-12    | Tampering / Repudiation                    | Command-context notification dispatch                                       | medium   | mitigate    | `notify-context.test.ts` uses controlled renderers and complete interaction checks for exact, once-only projection.                    | closed |
| T-109-12-NA | Spoofing                                   | External identity boundary                                                  | low      | accept      | The pair performs no authentication or external identity decision.                                                                     | closed |
| T-109-13    | Tampering                                  | Reason and severity selection                                               | medium   | mitigate    | `notify-reasons.test.ts` uses complete matrices and compile-time exhaustiveness for every public arm and ordering rule.                | closed |
| T-109-13-NA | Spoofing                                   | External identity boundary                                                  | low      | accept      | The pair performs no authentication or external identity decision.                                                                     | closed |
| T-109-14    | Information disclosure                     | Path redaction, diagnostics, cause rendering, and notification entry points | high     | mitigate    | `notify.test.ts` pins redaction and complete output bytes at path/cause boundaries without adding diagnostic fields.                   | closed |
| T-109-14-D  | Tampering / Repudiation                    | Legacy notification-suite consolidation                                     | medium   | mitigate    | The reconciliation ledger was completed, destination evidence is green, and exactly seven superseded suites are absent.                | closed |
| T-109-14-SC | Tampering                                  | Dependency installation                                                     | low      | accept      | The plan performed no package-manager operation and changed no dependency manifest.                                                    | closed |
| T-109-15    | Tampering / Elevation of privilege         | Path containment and symlink boundary                                       | high     | mitigate    | `path-safety.test.ts` proves pre-I/O containment, every-position symlink refusal, structured errors, fallbacks, and error propagation. | closed |
| T-109-15-NA | Spoofing                                   | External identity boundary                                                  | low      | accept      | The pair performs no authentication or external identity decision.                                                                     | closed |
| T-109-16    | Tampering                                  | Probe failure and note classifiers                                          | medium   | mitigate    | `probe-classifiers.test.ts` pins precedence, cause walking, de-duplication, fallthrough buckets, and complete ordered outputs.         | closed |
| T-109-16-NA | Spoofing                                   | External identity boundary                                                  | low      | accept      | The pair performs no authentication or external identity decision.                                                                     | closed |
| T-109-17    | Tampering / Information disclosure         | Process environment and PATH ledger                                         | high     | mitigate    | `session-env.test.ts` pins owned keys, unrelated-key preservation, absolute entries, de-duplication, order, and restoration.           | closed |
| T-109-17-NA | Spoofing                                   | External identity boundary                                                  | low      | accept      | The pair performs no authentication or external identity decision.                                                                     | closed |
| T-109-18    | Tampering                                  | Closed runtime/type scope set                                               | medium   | mitigate    | `types.test.ts` keeps exact runtime tuples aligned with positive and negative compile-time evidence.                                   | closed |
| T-109-18-NA | Spoofing                                   | External identity boundary                                                  | low      | accept      | The pair performs no authentication or external identity decision.                                                                     | closed |
| T-109-19    | Tampering / Information disclosure         | Template-variable substitution                                              | medium   | mitigate    | `vars.test.ts` pins token mapping, pass-through, adjacency, repetition, and one-pass behavior with independent outputs.                | closed |
| T-109-19-NA | Spoofing                                   | External identity boundary                                                  | low      | accept      | The pair performs no authentication or external identity decision.                                                                     | closed |

_Status: open · closed · open below threshold (non-blocking)._

## Accepted Risks Log

| Risk ID   | Threat Ref                                                          | Rationale                                                                                                     | Accepted By              | Date       |
| --------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------- |
| AR-109-01 | T-109-01-NA through T-109-13-NA and T-109-15-NA through T-109-19-NA | These pairs have no authentication or external identity boundary, so the spoofing category is non-applicable. | Phase 109 plan contracts | 2026-08-29 |
| AR-109-02 | T-109-14-SC                                                         | The plan performs no dependency installation and changes no dependency manifest.                              | Phase 109 plan contract  | 2026-08-29 |

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By                                |
| ---------- | ------------: | -----: | ---: | ------------------------------------- |
| 2026-08-29 |            39 |     39 |    0 | GSD secure-phase ASVS L1 verification |

All 19 direct owner gates passed with 100% applicable branch, function, and line coverage. The four high-severity controls have direct behavioral evidence. Because the register was authored at plan time, no threat remains open, and the configured level is ASVS L1, the workflow's clean-register short-circuit applies.

## Sign-Off

- [x] All threats have a disposition.
- [x] Accepted risks are documented in the Accepted Risks Log.
- [x] `threats_open: 0` is confirmed.
- [x] `status: verified` is set in frontmatter.

**Approval:** verified 2026-08-29
