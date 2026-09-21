---
phase: "06"
slug: "unused-type-member-gate"
status: secured
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-19"
register_authored_at_plan_time: true
---

# Phase 06 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

Consolidated from all 17 plans' `<threat_model>` blocks. Plans 01–08 declare an identical three-row set; plans 09–17 each add plan-specific rows.

| Boundary | Description | Declared in |
|----------|-------------|-------------|
| Compiler input to analyzer | Source, configuration and overlay text is parsed as data and must never execute. | 01–09, 15, 16, 17 |
| Evidence to clean verdict | Symbol, flow and contract records must not manufacture observations or hide unexplained members. A repair must clear a row by removing a declaration, never by manufacturing an observation. | 01–11, 13, 17 |
| Gate process to quality checks | Intended member findings must remain distinguishable from launch, configuration or budget failures. | 01–08, 09, 15, 16, 17 |
| Hook patch to Pi event | A hook-supplied `tool_result` patch crosses into a live Pi event object; only whitelisted slots may be written. | 09 |
| Rollback ledger to the filesystem | The repaired shape feeds the only path that removes replacement artifacts and restores user backups after a failed install. | 10 |
| Coordinate-addressed records to source | Contract entries, disposition rows and pin readings address source by position, so an edit can silently invalidate a proof. | 10, 12, 15, 16, 17 |
| Bridge to sibling bridge | A shared shape parked in a sibling bridge would cross an architecture boundary the fallow gate is the only enforcer of. | 10 |
| Extension to Pi tool surface | The `details` payload of both registered tools leaves this tree for the host and the calling agent; a removed slot is removed from a shipped contract no compiler here checks. | 11 |
| Evidence to contract file | A contract entry must be an engine acceptance against this tree, not an assertion written into a JSON file. | 11, 14 |
| Record to measured tree | The triage record must reconcile against a digest recomputed from disk, not against the report it describes. | 11, 14 |
| Source repair to ledger behaviour | A type edit above transactional install/update/uninstall flows can change what a rollback carries. | 12 |
| Orchestrator tier to network surface | NFR-5 forbids a named set of orchestrator files from reaching git/network surfaces; a relocated type must not carry one across. | 12 |
| Peer dependency to local mirror | A hand-written mirror states a shape this project does not own; nothing checks it unless the compiler is made to. | 13 |
| Written file to consumer | The migration's config bytes and the agents-index schema are read by code outside this process. | 13 |
| Repair to observable behaviour | A type-level repair must not move any rendered byte, error identity, frozen copy or cause chain a user or caller can observe. | 14 |
| Owner scope to the rest of the tree | Five sibling repair plans run in the same wave; an edit outside this owner's files is a collision and a scope breach. | 14 |
| Engine change to clean verdict | A widened prover or observation model can manufacture evidence, turning a real finding into a silent pass. | 15 |
| Contract document to gate acceptance | The contract file is the only source of accepted exceptions; a new category is a new class of accepted exception and must refuse its neighbours by name. | 15, 16 |
| Analyzer cost to gate usability | A traversal widening can exhaust memory or the step budget; a cut-off run must refuse, never report clean. | 15, 16 |
| New evidence category to clean verdict | A category that refuses nothing turns every future member of the same shape into a silent pass. | 16 |
| Arrival walk to boundary proof | The arrival walk is shared by every `external-output`/necessity proof, so a widening there is felt by entries this plan did not write. | 16 |
| Architecture zone edges | `domain/` may not reach `bridges/`; `orchestrators/` may not reach `edge/`. A collapse trades a reported finding for an unreported structural defect. | 17 |
| Completions seam to persistence | `edge/` reaches persistence/domain surfaces only through the injected resolver; the seam must not leak those imports into `edge/`. | 17 |

---

## Threat Register

82 declared threats across 17 plans (all carry a `<threat_model>` block — no retroactive construction needed). Plans 01–08 declare four materially identical rows each, consolidated per the Phase 07 convention into bracketed-range IDs. All dispositions are `mitigate` except two `accept` (low severity).

| Threat ID | Category | Severity | Disposition | Mitigation | Status |
|-----------|----------|----------|-------------|------------|--------|
| T-06-0[1-8]-01 | Tampering | high | mitigate | Exact declaration identity via `byDeclaration` map, not spelling; contract drift refused by name; site grammar rejects wildcard/absolute/traversal. Sibling control requires offender to survive a real production read of the same spelling — live PASS. | closed |
| T-06-0[1-8]-02 | Elevation of privilege | high | mitigate | Parse-never-execute (`ts.createProgram`/`createSourceFile` only); overlay containment + existing-`.ts`-only; all subprocesses use argv arrays, no shell; `mkdtempSync` + `finally{rmSync}`; overlay-escape readback after pass and failure. `no-shell-out.test.ts` 24/24 PASS, `child_process` whitelisted to exactly 3 files. | closed |
| T-06-0[1-8]-03 | Denial of service | medium | mitigate | Bounded budgets; exhaustion raises `AnalysisSetupError` → exit 2, never a clean verdict; 8-hop arrival bound, cycle-safe recursion. Refusal control requires exit 2 + no report — live PASS both arms. | closed |
| T-06-0[1-8]-04 | Repudiation | medium | mitigate | Deterministic member-level report; every excused member re-printed every run; population never narrowed by an exception. Live gate exit 0 with 5 named exceptions; negative controls 7/7 PASS. | closed |
| T-06-09-01 | Tampering | high | mitigate | Rows cleared by declaration removal only; negative controls prove a clear cannot be faked. Live gate exit 0. | closed |
| T-06-09-02 | Tampering | high | mitigate | `bridges/hooks/event-adapters.ts:131-138` — two guarded `if` statements survive verbatim, whitelist only `content`/`isError`; direct write, no cast; `type`/`toolName` remain unwritable. | closed |
| T-06-09-03 | Tampering | medium | mitigate | Contract id resolves exactly to the `kind` member (column-count confirmed). Live gate exit 0, not 2 — a detached pin would have refused the run. | closed |
| T-06-09-04 | Denial of service | medium | mitigate | `bridges/hooks/exec-timer.ts:49-70` guards on `exitCode`/`signalCode`, not `child.killed`/`pid`; `ChildLike` declares no `pid`. Test suite PASS. | closed |
| T-06-09-05 | Repudiation | medium | mitigate | Record regenerated at plan close; summary addresses all five rows by ID. | closed |
| T-06-10-01 | Tampering | high | mitigate | `shared/fs-utils.ts:66-79` — `RemovalOps` holds exactly two members, options and leak text unchanged. Fault-injection suite PASS. | closed |
| T-06-10-02 | Repudiation | high | mitigate | Measured: `eslint-disable` count unchanged (15→15) across the phase; zero `@ts-expect-error`/`@ts-ignore` added. Live gate exit 0. | closed |
| T-06-10-03 | Tampering | medium | mitigate | All 108 contract entries resolve — live gate exit 0; a mis-anchored entry raises exit 2, never a quiet allowance. | closed |
| T-06-10-04 | Elevation of privilege | medium | mitigate | `npm run fallow` all four sub-gates exit 0 (verified via `$?`); import-boundaries test PASS. | closed |
| T-06-10-05 | Information disclosure | low | accept | Absolute `dir` interpolated into the leak message, unchanged by the repair; removed slot never reached a message. Compensating-control claim not substantiated — logged with caveat. | closed — accepted (caveat) |
| T-06-11-01 | Tampering | high | mitigate | Six `external-output` entries preserve the Pi tool `details` slots rather than deleting them, each with an engine-checked boundary. | closed |
| T-06-11-02 | Tampering | high | mitigate | Live gate exit 0; negative controls 7/7 including offender plant into the real `EdgeDeps` declaration. | closed |
| T-06-11-03 | Tampering | medium | mitigate | Contract fails by name when a contracted member becomes readable; live gate exit 0 (not 2). | closed |
| T-06-11-04 | Repudiation | medium | mitigate | Record regenerated at plan close. | closed |
| T-06-12-01 | Tampering | high | mitigate | Five `undo:` arms intact in `orchestrators/plugin/install-outcome.ts`; fs-utils fault-injection and stage suites PASS. | closed |
| T-06-12-02 | Repudiation | high | mitigate | Live gate exit 0 with measured repaired/contracted/outstanding split (5 exceptions, 108 contracts, 0 outstanding). | closed |
| T-06-12-03 | Tampering | high | mitigate | Live gate exit preserved, never 2 — every pin in every edited file resolves. | closed |
| T-06-12-04 | Elevation of privilege | medium | mitigate | `no-orchestrator-network.test.ts` PASS including planted-offender and comment-stripping controls; all five forbidden patterns present. | closed |
| T-06-12-05 | Spoofing | medium | mitigate | Mirror collapsed into one shared declaration, never half-edited; sibling import is type-only. | closed |
| T-06-13-01 | Tampering | high | mitigate | Bidirectional `Same<>` pins against real peer types; suite PASS; no mirror member removed. | closed |
| T-06-13-02 | Repudiation | high | mitigate | 352 recorded dispositions, all `explained`, zero pending. Record regenerated at plan close. | closed |
| T-06-13-03 | Tampering | high | mitigate | Contracts test 101/101 PASS (prover + refusal cases); all 108 live entries accepted by the real engine. | closed |
| T-06-13-04 | Spoofing | medium | mitigate | Negative controls prove a row cannot leave the unread set by a fake read; live gate exit 0. | closed |
| T-06-13-05 | Denial of service | medium | mitigate | Migration + agents-index suites 63/63 PASS (byte-exact first-run/replay + both throw paths). | closed |
| T-06-14-01 | Tampering | high | mitigate | Engine acceptance of every entry proven live; record is audit-generated, not hand-written. Retirement removals are the sanctioned path. | closed |
| T-06-14-02 | Repudiation | high | mitigate | Fresh live run: exit 0, zero `shared/` findings (superseded by a later plan's repair). | closed |
| T-06-14-03 | Denial of service | medium | mitigate | `shared/notify-context.ts:341-347` severity write sits in try/catch degrading on frozen/sealed rows; no throw escapes the notify seam. | closed |
| T-06-14-04 | Tampering | medium | mitigate | Owner-scope prohibition; no cross-owner damage detectable (all suites green). Weakest row — plan-time process control, no durable artifact. | closed |
| T-06-14-05 | Information disclosure | low | accept | Repairs touch annotations/declaration homes only; `no-credential-leak.test.ts` (12 assertions) PASS confirms no leak. | closed — accepted |
| T-06-15-01 | Tampering | critical | mitigate | 101/101 prover counterexample tests PASS; each category ships as a test-first commit pair. One category's counterexample landed in the immediately preceding commit rather than the same commit — letter deviation, substance met. | closed |
| T-06-15-02 | Repudiation | critical | mitigate | Live gate exit 0; every residual named on every run with decision text. | closed |
| T-06-15-03 | Spoofing | high | mitigate | Withdrawn drafts re-submitted and each refusal recorded (50 references); engine refusal proven by the 101-test prover suite. | closed |
| T-06-15-04 | Denial of service | high | mitigate | Caps never raised after this phase's own single authorized change; exhaustion controls still refuse live. | closed |
| T-06-15-05 | Tampering | high | mitigate | Live gate exit 0, not 2 — every re-derived coordinate in both edited files resolves. | closed |
| T-06-15-06 | Tampering | medium | mitigate | Two `?: never` refusal markers make a producer obligation a compile error, preceded by their own test pair. | closed |
| T-06-15-07 | Elevation of privilege | medium | mitigate | Same evidence as T-06-0[1-8]-02. | closed |
| T-06-16-01 | Tampering | critical | mitigate | Three new evidence categories each with their own prover and schema keys; counterexamples ship in the same commits. 101/101 PASS. | closed |
| T-06-16-02 | Tampering | critical | mitigate | Destructured step carries the selected key; `reaches()` refuses containment-alone; hop bound unchanged; all 8 `external-output` entries re-validated live. | closed |
| T-06-16-03 | Repudiation | critical | mitigate | Live gate exit 0; all standing rows named by identity on every run. | closed |
| T-06-16-04 | Elevation of privilege | high | mitigate | `external-mirror` refuses a required upstream slot by name; disjointness documented; per-category key scoping plus unknown-key refusal. | closed |
| T-06-16-05 | Denial of service | high | mitigate | Same cap evidence as T-06-15-04; hop bound not raised. | closed |
| T-06-16-06 | Tampering | high | mitigate | Live gate exit 0, not 2 — including three entries pinned inside `node_modules/`. See Unregistered Flags #2. | closed |
| T-06-16-07 | Spoofing | medium | mitigate | 44 refusal references recorded; prover suite enforces each refusal. | closed |
| T-06-16-08 | Elevation of privilege | medium | mitigate | Same evidence as T-06-0[1-8]-02. | closed |
| T-06-17-01 | Tampering | high | mitigate | Live gate exit 0; negative controls 7/7 reject a clear achieved by a new reader or test. | closed |
| T-06-17-02 | Elevation of privilege | high | mitigate | `npm run fallow` all four sub-gates exit 0; import-boundaries PASS (zone matrix, 24/24). No zone/restricted-path entry edited. | closed |
| T-06-17-03 | Tampering | high | mitigate | Deep-compare of the projected value PASS; seam import is type-only — `edge/` gains no runtime persistence/domain dependency. | closed |
| T-06-17-04 | Tampering | medium | mitigate | `Same<>` pin present unmodified, with six `satisfies` proofs and the domain-side alias. | closed |
| T-06-17-05 | Tampering | medium | mitigate | Live gate exit 0 — no contract entry detached; a detached entry would exit 2. | closed |
| T-06-17-06 | Repudiation | medium | mitigate | Documentation-ledger reconciliation drifted after phase close (see below). Enforcing verdict intact; only the ledger is stale. | open — below high threshold (non-blocking) |

*Status: open · closed · closed — accepted · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Open — Below Threshold (Non-Blocking)

**T-06-17-06** — a fresh live run of `node scripts/check-unused-type-members.audit.mjs --check --ledger <archived path>` exits 1 with 31 problems (1 `stale-source`, 13 `stale-record`, 12 `missing`, 5 `unread` by design). Drift was introduced by a later `merge origin/main` commit that changed `scripts/check-unused-type-members.contracts.json` after the phase's last reconciliation and shifted lines in three files. **Impact bounded:** no `unread` member is hidden — all 12 `missing` rows carry passing statuses, the 5 genuinely-unread residuals are recorded and re-printed on every run, and the digest control detected the drift rather than silently accepting it (fail-closed). Only the documentation ledger is stale, not the enforcing verdict.

**Remediation:** `node scripts/check-unused-type-members.audit.mjs --inventory --ledger .planning/milestones/test-backlog-phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md`, then `--check` to confirm only the 5 by-design `unread` rows remain.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-06-01 | T-06-10-05 | Absolute `dir` path is interpolated into a leak message unchanged by the repair; the removed slot never reached a message. **Caveat:** the stated compensating control ("absolute paths already handled at the notify boundary") is not substantiated — no path redaction/relativization exists in `shared/notify-context.ts`. Accepted with this caveat noted for future reference. | gsd-security-auditor (retroactive audit) | 2026-09-19 |
| AR-06-02 | T-06-14-05 | Repairs touch type annotations and declaration homes only; `no-credential-leak.test.ts` (12 assertions) confirms no message/field/cause value leaks. | gsd-security-auditor (retroactive audit) | 2026-09-19 |

---

## Unregistered Flags

1. **WARNING — the record-reconciliation control is both unreachable and unenforced.** `scripts/check-unused-type-members.audit.mjs` hard-codes a ledger path under the pre-archive `.planning/phases/...` location, which ceased to exist when the milestone was archived; a bare invocation now exits 2 with "No triage document at …". Compounding this, the audit verb is **not** in the `npm run check` chain, so nothing in CI would ever notice. This is the mechanism by which T-06-17-06 went undetected — no existing threat row covers "the reconciliation control itself decays."
2. **Informational.** Three contract entries pin coordinates inside `node_modules/` (a peer-dependency `.d.ts` file). A version bump detaches them and the gate exits 2 (fail-closed, correct direction), but no threat row covers coordinate coupling to an artifact outside version control.
3. **Process gap, not a code vulnerability.** Six SUMMARY files (06-04, 06-10, 06-11, 06-12, 06-14, 06-17) carry no `## Threat Flags` section; five of those six are precisely the plans that edit production source under `extensions/` — the highest-risk plans in the phase never declared whether new attack surface appeared. Verified directly against code instead of accepting the absence as "no flags".

**Follow-up worth tracking, not blocking:** fix the audit ledger's default path for the post-archive location, and add `lint:type-members:audit` to the `npm run check` chain so ledger drift is caught automatically going forward.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-19 | 82 | 81 | 1 (non-blocking) | gsd-security-auditor (retroactive audit ahead of catch-up PR; live-executed the gate, negative controls, and 4 architecture test suites — 24/24, 109/109, 101/101, 63/63 all PASS) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-19
