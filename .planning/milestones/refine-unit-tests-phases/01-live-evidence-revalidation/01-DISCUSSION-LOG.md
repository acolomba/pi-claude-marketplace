# Phase 1: Live Evidence Revalidation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution
> agents. Decisions are captured in CONTEXT.md; this log preserves the
> alternatives considered.

**Date:** 2026-09-04
**Phase:** 01-live-evidence-revalidation
**Areas discussed:** Manifest structure, confirmation threshold, operator
decisions, scope rewriting

---

## Manifest Structure

| Decision | Selected | Alternatives considered |
| -------- | -------- | ----------------------- |
| Audit representation | File index plus linked finding ledger | One record per file; one record per finding |
| Finding identity | Namespaced source identities | New global sequence; path and ordinal only |
| Disposition model | Separate evidence status and routing | Single combined status; freeform conclusion |
| Required evidence | Uniform evidence record with explicit `N/A` reasons | Status-dependent fields; report-level evidence |
| File completion | Claims enumerated, linked, and reconciled | Read acknowledgment; automatic discovery |
| File summary | Derived file outcome | Reviewer-written summary; coverage only |
| Canonical order | Full corpus-path order, then report finding order | Severity order; destination-phase order |
| Completeness enforcement | Blocking machine validation | Manual checklist; advisory validator |
| Storage format | Structured ledger plus generated Markdown | Markdown tables only; YAML records only |
| Artifact location | Phase 1 directory | Review corpus; `.planning/` root |
| Corpus baseline | Lock the 110 paths without content hashes | Content fingerprint; rolling review |
| Mid-phase correction | Allow edits and reopen the changed file | Read-only corpus; edits without rereview |
| Duplicate claims | Preserve each claim and link one canonical finding | Collapse duplicates; prefer adversarial copy |
| Conflicting passes | Current evidence governs | Adversarial verdict wins; conservative verdict wins |
| Control documents | Extract actionable claims | File coverage only; record every assertion |
| Final authority | New ledger is authoritative | Corrected reports authoritative; both must agree |

**User's choice:** The recommended option was selected for every decision except
the corpus baseline. The user chose path locking without content hashes, then
required any corrected file to be reopened and reviewed again.

**Notes:** Every one of the 110 paths needs a completed record even when the
file contains no live findings. Historical claims remain auditable rather than
being erased during deduplication.

---

## Confirmation Threshold

| Decision | Selected | Alternatives considered |
| -------- | -------- | ----------------------- |
| Confirmation proof | Evidence ladder by claim type | Executable reproduction only; source inspection only |
| Stale proof | Locate current code, rerun an equivalent probe, explain failed premise | Missing reference; green current tests |
| Inconclusive result | Blocks unless explicitly deferred by the user | Treat as confirmed; allow unresolved entries |
| Probe safety | Hermetic by default; explicit approval for real state, credentials, network, or destructive access | Read-only live probes; existing environment with backups |

**User's choice:** All recommended confirmation rules.

**Notes:** A passing suite or missing old line reference is not proof that a
finding is stale. Structural claims may use current call-graph or static proof
when no honest executable probe exists.

---

## Operator Decisions

| Decision | Selected | Alternatives considered |
| -------- | -------- | ----------------------- |
| Presentation | One evidence dossier at a time, only for surviving premises | One batch table; automatic defaults |
| Ordering | Risk and dependency order | Original document order; destination-phase order |
| Recommendation principle | Maximize guideline conformity; eliminate test-only exports, dead branches, and dishonest cases; safety remains highest priority | Preserve public behavior by default; minimize churn |
| Durable record | Evidence, selected and rejected options, affected findings, and downstream changes | Context summary only; amend historical synthesis |

**User's choice:** Individual evidence dossiers, risk-first ordering, guideline
conformity, and durable decision records.

**Notes:** The user clarified that current evidence may justify public API or
behavior changes when required for guideline conformity; safety defects still
take precedence.

---

## Scope Rewriting

| Decision | Selected | Alternatives considered |
| -------- | -------- | ----------------------- |
| Wholly stale requirement | Trace-preserving removal from active scope | Delete completely; mark complete |
| Empty later phase | Retire without renumbering later phases | Evidence-only phase; delete and renumber |
| Mixed requirement | Split and narrow | Keep whole requirement; remove whole requirement |
| Newly discovered issue | Add only when it fits the milestone boundary | Defer every discovery; fit into an existing requirement |

**User's choice:** Trace-preserving removal, stable phase numbering, split mixed
requirements, and boundary-based amendments.

**Notes:** The user initially selected marking a stale requirement complete,
then immediately corrected that answer to trace-preserving removal. The
corrected decision is canonical.

---

## the agent's Discretion

- Exact JSON field names and normalization details.
- How the 110 files are divided into safe execution batches.
- Which hermetic command or probe satisfies each evidence-ladder rung.

## Deferred Ideas

None. Discussion stayed within Phase 1's evidence and scope-gate boundary.
