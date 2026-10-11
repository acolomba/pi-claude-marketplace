---
phase: "1"
slug: "presentation-model"
status: verified
threats_open: 0
threats_total: 29
threats_closed: 29
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: "2026-10-01"
---

# Presentation Model Security Review

## Scope and Method

This review checks the threats recorded in all 16 phase plans and their
summary threat flags. The summaries report no additional security surface.
The register contains 28 numbered threats and one supply-chain threat repeated
across the plans. The repeated T-01-SC entry is counted once.

The configured review depth is ASVS level 1. Current code inspection and
existing passing tests support the mitigation checks below. The latest
verification report records the full test results and corpus comparison.
No implementation changed after those tests. No new risk is accepted here.

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| test process -> committed planning artifact | Captured notification text (which can embed paths and error text) is written into a file committed to git |
| capture preload -> extension source | The preload rewrites extension modules in memory while tests run |
| producer rows -> rendered notification | Caller-stamped row facts become the one user-visible string (IL-2) |
| thrown Error -> rendered text | Error messages from bridges and the filesystem cross into user-visible failure lines |
| host tool inventory -> rendered row | The soft-dep snapshot (host-controlled) decides whether a marker appears |
| resolved model -> text strategy | The text strategy consumes only resolved data; the host-controlled snapshot stops at resolve |
| host tool inventory -> run snapshot | The one probe per run reads host-controlled tool names |
| Pi host -> extension (lifecycle) | `resources_discover` runs inside Pi's load; a throw must never escape it (NFR-2) |
| host tool inventory -> run snapshot | The load pass's one probe reads host-controlled tool names |
| composer -> nested orchestrator | reconcile and import hand run state to verbs they drive in orchestrated mode |
| composer -> nested orchestrator | bootstrap, import, and reconcile hand run state to addMarketplace / setMarketplaceAutoupdate |
| host tool inventory -> severity and markers | The same host-controlled snapshot decides both the warning severity and the `{requires ...}` marker |
| host tool inventory -> enable severity and markers | One snapshot must decide both |
| Pi host -> extension (lifecycle) | the load pass must never let a throw escape `resources_discover` (NFR-2) |
| host tool inventory -> update severity and markers | One snapshot must decide both |
| LLM tool call -> list payload | Tool-driven reads must stay read-only and emit nothing (IL-2, NFR-5) |
| test boundary -> IL-2 sizing proof | The strict notification boundary is how the edge and orchestrator suites prove what reaches `ctx.ui.notify` |
| resolved model -> single ctx.ui.notify | The IL-2 sink is the only user-visible channel |

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Evidence | Status |
|-----------|----------|-----------|----------|-------------|----------|--------|
| T-01-01 | Information disclosure | baseline.jsonl | medium | mitigate | `scripts/notify-corpus.mjs:73` normalizes roots and random suffixes; current offline TruffleHog scan exits 0 with no findings. | closed |
| T-01-02 | Tampering | notify-corpus.hook.mjs | medium | mitigate | `scripts/notify-corpus.hook.mjs:29` gates the in-memory hook on NOTIFY_CORPUS_OUT; the no-test-only-production-surface test passed. | closed |
| T-01-03 | Repudiation | diff verb | medium | mitigate | Corpus negative controls passed during the final review; the current corpus has 2,661 entries and no missing entries. | closed |
| T-01-SC | Tampering | npm installs | low | accept | Existing plan acceptance: the presentation refactor installs no package. This carries the original disposition without accepting a new risk. | closed |
| T-01-04 | Tampering | resolveEnvelope / formatNotificationText | medium | mitigate | Current corpus comparison and catalog contract passed; `01-VERIFICATION.md` records the accepted upstream baseline. | closed |
| T-01-05 | Information disclosure | notification-resolve.ts | low | accept | Existing plan acceptance: resolve uses producer facts; the unchanged corpus proves no added output on exercised paths. | closed |
| T-01-06 | Information disclosure | serializeCauseChain | medium | mitigate | `shared/errors.ts:155,190,206` serializes messages and basename-only cleanup details; errors tests and corpus comparison passed. | closed |
| T-01-07 | Denial of service | serializeCauseChain | medium | mitigate | `shared/errors.ts:30,51` bounds the walk to five links; errors tests cover six-deep, self-cycle, and two-node-cycle cases. | closed |
| T-01-08 | Tampering | resolveRows missing-arm floor | low | mitigate | `shared/notification-resolve.ts:425` catches a rejected severity write and logs it; frozen-row cases passed. | closed |
| T-01-09 | Repudiation | CommandContext.markers / CENTRAL_MARKER_POLICY | medium | mitigate | Independent policy table and declared-context totality tests passed; corpus comparison preserves marker bytes. | closed |
| T-01-10 | Tampering | notification-resolve.ts | low | mitigate | The no-probe-in-workflows-bridge architecture test passed; resolve remains in shared and architecture checks passed. | closed |
| T-01-11 | Tampering | render arms (mechanical edit) | medium | mitigate | Messaging owner tests, catalog contract, and full corpus comparison passed. | closed |
| T-01-12 | Repudiation | softDepMarkers call sites | low | mitigate | The workflows-marker-coverage test checks the one derivation site and its planted offender; both passed. | closed |
| T-01-13 | Tampering | notification-dispatch.ts snapshotOf | medium | mitigate | `shared/notification-run.ts:21` captures the snapshot once; the registered-install SC-3 two-answer test passed. | closed |
| T-01-15 | Tampering | transitional inventory branch | low | mitigate | Current dispatcher and notify-context scans find no ToolInventory, snapshotOf, or softDepStatus; the two run roots are verified. | closed |
| T-01-14 | Denial of service | index.ts resources_discover | medium | mitigate | `index.ts:120` encloses run construction in try/catch; `platform/pi-api.ts:159,174,187` catches inventory errors; index tests passed. | closed |
| T-01-16 | Tampering | import / marketplace verbs (option-bag sweep) | low | mitigate | Import and marketplace owner tests passed with the run snapshot; current corpus comparison passed. | closed |
| T-01-17 | Repudiation | nested orchestrated calls | low | mitigate | Strict nested-call tests passed in the full unit run; root-only construction and removal of inventory forwarding were verified. | closed |
| T-01-18 | Tampering | add / autoupdate / bootstrap (option-bag sweep) | low | mitigate | Add, autoupdate, bootstrap, and handler owner tests passed; current corpus comparison passed. | closed |
| T-01-19 | Repudiation | install severity vs markers | medium | mitigate | `orchestrators/plugin/install-flow.ts:411` reads run.softDeps; the registered-install SC-3 severity-and-marker case passed. | closed |
| T-01-20 | Tampering | install option-bag sweep | low | mitigate | Install owner tests and architecture cases passed; current corpus comparison passed. | closed |
| T-01-21 | Repudiation | enable severity vs markers | low | mitigate | `orchestrators/plugin/enable-disable.ts:1350` supplies run.softDeps; severity and marker cases passed. | closed |
| T-01-22 | Denial of service | index.ts resources_discover | low | mitigate | `index.ts:120` retains the outer catch and inner last-ditch notification catch; index tests passed. | closed |
| T-01-23 | Repudiation | update-cascade severity vs markers | medium | mitigate | `orchestrators/plugin/update-cascade.ts:194` reads run.softDeps; both severity/marker cases passed. | closed |
| T-01-24 | Tampering | tools.ts list payload | low | mitigate | `orchestrators/plugin/list-flow.ts:138` defines payload options without a run; tool result tests passed. | closed |
| T-01-28 | Repudiation | tests/edge/notification-boundary.ts | low | mitigate | The test boundary no longer contains a Pi mock; root inventory reads remain covered by register and index tests. | closed |
| T-01-25 | Tampering | notification-dispatch.ts | medium | mitigate | Current dispatch and notify-context scans find no residual probe or inventory; the root-construction check passed. | closed |
| T-01-26 | Repudiation | stale docs and lint messages | low | mitigate | The refreshed verifier records the completed comment migration; stale-claim scans passed at plan completion. | closed |
| T-01-27 | Information disclosure | catalog fixtures | low | mitigate | Plan 01-16 summary records the fixture-only parameter rename; current catalog and corpus comparison passed after the documented upstream merge. | closed |

## Accepted Risks Log

These dispositions already exist in the phase plans. This review carries
them forward and does not create an operator acceptance.

| Risk ID | Threat Ref | Rationale | Authority |
|---------|------------|-----------|-----------|
| AR-01 | T-01-05 | Resolve reads existing producer facts and introduces no new output data. | 01-02-PLAN.md |
| AR-02 | T-01-SC | No package is installed by the presentation refactor. | All 16 phase plans |

Credential redaction in general cause text remains assigned to PMOD-04 in
phase 4 by the existing scope decision. Phase 1 preserves the accepted text
baseline. The scan below covers the committed test corpus.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-01 | 29 | 29 | 0 | Codex, secure-phase level 1 |

The current corpus was scanned with
`trufflehog filesystem --no-verification --no-update --fail --json .planning/phases/01-presentation-model/notify-corpus`.
The command exited 0 with zero findings. Credential verification was disabled,
so the scan did not contact credential providers.

## Sign-Off

- [x] All threats have a disposition.
- [x] Existing accepted risks have their plan authority recorded.
- [x] No open threats remain, including below the high-severity threshold.
- [x] `threats_open: 0` and `status: verified` are set.

**Approval:** verified 2026-10-01 at ASVS level 1.
