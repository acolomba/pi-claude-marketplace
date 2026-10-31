---
phase: "07"
slug: "mode-refusals-real-pi-verification-and-docs"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-10-10"
---

# Phase 7 — Security

## Trust Boundaries

| Boundary | Description | Data crossing |
| --- | --- | --- |
| Mode admission | Refuse unsupported interaction before state/HTTP work | Command mode and fixed remedy |
| Authentication | Bound host and stored credentials before optional new flow | Credentials remain host-scoped |
| Runtime fixture | Isolated subprocess with bounded lifecycle | Fixed commands and custom entries |
| Consumer examples | Command-origin isolation and conservative verdicts | Captured JSON data |
| Corpus closeout | Exact ledger and fresh evidence before retirement | Immutable samples and input hashes |

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T-07-01 | Tampering | browse admission | medium | mitigate | `makeBrowseHandler` returns before state/picker work for non-TUI; browse and register owner tests passed. | closed |
| T-07-02 | Repudiation | registered command outcome | medium | mitigate | Register tests assert one schema-valid refusal with separate invocation IDs for explicit/empty/whitespace calls. | closed |
| T-07-03 | Information disclosure | git-auth-callbacks | high | mitigate | `buildAuthCallbacks` checks HTTPS and bound host before credential fill; foreign-host and credential-leak tests passed. | closed |
| T-07-04 | Denial of service | lazy device flow | medium | mitigate | `buildAuthForHost` checks live print mode after memo reuse and before device-flow initiation; zero-HTTP tests passed. | closed |
| T-07-05 | Tampering | marketplace staging cleanup | high | mitigate | `tests/integration/auth-e2e.test.ts` exercises real clone/marketplace-add staging cleanup and unchanged prior state. | closed |
| T-07-06 | Information disclosure | refusal cause and output | high | mitigate | `DeviceFlowUnavailableError` has fixed text; only that type escapes callback cancellation; cause and credential-output checks passed. | closed |
| T-07-07 | Information disclosure | runtime helper environment | high | mitigate | `tests/e2e/json-output-runtime.ts` constructs an allowlisted environment and fresh home/project/session directories. | closed |
| T-07-08 | Denial of service | subprocess lifecycle | medium | mitigate | Runtime helper closes JSON stdin, correlates RPC responses, bounds output to 1 MiB and execution to 20 seconds, then cleans up. | closed |
| T-07-09 | Spoofing | claimed floor proof | high | mitigate | `resolvePeerFloor` requires manifest version 0.86.1 and real CLI containment; fresh eight-case run passed without skips. | closed |
| T-07-10 | Repudiation | startup visibility evidence | medium | mitigate | `pi-json-output.test.ts` requires startup memory/get_entries positive controls and later streamed command entries on both runtimes. | closed |
| T-07-11 | Spoofing | consumer verdict | high | mitigate | Actual guide snippets are tested for outcome presence, invocation isolation, maximum severity, and invalid envelopes. | closed |
| T-07-12 | Tampering | snippet execution | medium | mitigate | Guide uses data files/stdin and `jq --arg` for invocation IDs; shell-sensitive ID cases execute without eval. | closed |
| T-07-13 | Repudiation | partial failures | medium | mitigate | Guide prints every selected payload before failure, retains earlier successes, and ORs reload flags; executable tests passed. | closed |
| T-07-14 | Spoofing | reference completeness | medium | mitigate | Schema-derived recursive inventory checks kinds and requiredness; missing-kind/field and wrong-requiredness negative controls passed. | closed |
| T-07-15 | Repudiation | delivery and process claims | medium | mitigate | Limitations state startup/persistence/process facts from both runtimes and bounded append recovery from Phase 6 evidence. | closed |
| T-07-16 | Tampering | frozen catalog | high | mitigate | Merged audit compares all 264 catalog fences with 26cb0056 and unchanged owner locks (260 states, 39143 bytes). | closed |
| T-07-17 | Tampering | baseline amendment | high | mitigate | Independent exact tuple/count ledger preserves the immutable 3149-record multiset and original serialized prefix; seven negative controls passed. | closed |
| T-07-18 | Repudiation | corpus success evidence | high | mitigate | Durable final report records exit 0, completed test counts, 3150 present/0 extra, and concrete file/runtime hashes; merged recheck passed. | closed |
| T-07-19 | Tampering | premature retirement | high | mitigate | Task commits preserve ledger -> amendment/proof -> deletion order. Retirement audit reads 848 files; final combined-tree npm run check passed. | closed |
| T-07-SC | Tampering | dependency acquisition | high | mitigate | Exact authorized 0.86.1 identity/integrity recorded in 07-PEER-FLOOR-AUDIT.md; independent lock, scripts disabled in CI and local provisioning. Other plans acquired no packages. | closed |

## Verification Basis

The register was authored at plan time. Level 1 review found each planned
mitigation in the implementation and executed evidence, so the workflow's
zero-open-threat short circuit applies. No new threat scan or risk acceptance
was substituted for mitigation verification. Source review covered the browse
admission path, lazy auth callback and narrow exception handling, runtime
helper and exact-floor resolver, guide verdict examples, and phase-local
corpus auditor. Task summaries and all four parent wave gates corroborate
those controls. Latest combined-tree gate: `77300475`, Node v26.11.1,
`npm run check` exit 0, including 266 direct coverage pairs.

## Accepted Risks Log

No accepted risks.

The constrained fixture's existing brace-expansion advisory is recorded in
`07-PEER-FLOOR-AUDIT.md` and `deferred-items.md` (DEP-07-03-01). Its fixed,
isolated, bounded inputs do not introduce the attacker-controlled glob surface.
General root dependency remediation remains open; this report does not claim
npm audit passes or waive that existing issue. The optional-peer test skip
TEST-07-06-01 / WINDOWS 89 also remains visible and is not counted as executed.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
| --- | --- | --- | --- | --- |
| 2026-10-10 | 20 | 20 | 0 | GSD orchestrator, Level 1 source/evidence review |

## Sign-Off

- [x] All threats have a mitigation disposition and evidence.
- [x] No implicit accepted risks.
- [x] `threats_open: 0` confirmed for the planned phase register.
- [x] `status: verified` set; descriptor-less human judgments remain separate.

**Approval:** Planned mitigations verified 2026-10-10.

## Post-review verification

WR-01 added the executable guide to both check selectors in `0dffe6c1`.
Fresh full capture, strict zero-extra comparison, both real-Pi runtimes,
retirement audit, and `npm run check` all passed after the correction.
See `07-REVIEW-FIXES.md` and the refreshed durable evidence. Human judgments
and pre-existing deferred items retain their prior disposition.
