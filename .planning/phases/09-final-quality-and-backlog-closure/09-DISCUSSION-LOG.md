# Phase 9: Final Quality and Backlog Closure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-11
**Phase:** 9-Final Quality and Backlog Closure
**Areas discussed:** Seal flip shape, WR-04 disposition, Windows + backlog, Audit trail shape

---

## Pre-question verification

Four facts were measured before the gray areas were put to the operator, because two of
them contradicted the inherited handoff:

| Claim checked | Source | Result |
|---|---|---|
| The seal is currently consistent | `node scripts/revalidation.mjs scope-impact --check` | `Scope impact valid: 40 records.` |
| Three IDs are `Pending` | `STATE.md` §"The one hard blocker Phase 9 must solve first" | **Wrong — eight are.** `SEALED_REQUIREMENT_ROUTES` also pins `GGAT-01/03/04` and `CLOSE-01/02` |
| `GGAT-01/03/04` are unfinished | inferred from their `Pending` status | **Wrong — pinned, not unfinished.** `07-VERIFICATION.md` reads `passed` 7/7, all three rows `SATISFIED` |
| The rows 9/30 desync is prose-only | `08-direct-coverage/deferred-items.md` | **Partly wrong.** Row 30's table status reads `fixed` while its JSON reads `open` — a status disagreement too |

---

## Seal flip shape

| Option | Description | Selected |
|--------|-------------|----------|
| One atomic change, all eight | Flip `GGAT-01/03/04`, `RCOV-01/02/03`, `CLOSE-01/02` in a single commit | |
| Staged: upstream, then closure | Flip the six verified-upstream IDs first; land `CLOSE-01/02` only after the suite is measured green on that tree | ✓ |
| Only `RCOV` + `CLOSE` | Leave `GGAT-01/03/04` at `Pending`, as the handoff implied | |

**User's choice:** Delegated to Claude's judgement under the standing rule.
**Notes:** Staged wins on the operator's own A-to-B test. Both routes reach the same end
state, but the single change writes `CLOSE-01` — "the suite passes after all terminal
work" — in the same commit as the work it describes, asserting something not yet
measured. The two ID sets are disjoint, so each change is internally consistent and
`scope-impact --check` exits 0 after each. Recorded as D-09-02. The third option was
rejected on evidence: `GGAT-01/03/04` are verified-passed, so leaving them `Pending`
would misreport delivered work.

---

## WR-04 disposition

| Option | Description | Selected |
|--------|-------------|----------|
| Asymmetric port | Add `readHooksJson` to `HooksHydrationReader`; port the hydrate site only, leaving site A on the static `readFile` | |
| Complete port | Both call sites go through one injected read port; both public factories receive it; no static `readFile` left in the module | ✓ |
| Decline, record the trail | Leave the test as-is with its sibling control and record a declined production-design change | |

**User's choice:** Delegated to Claude's judgement under the standing rule.
**Notes:** The asymmetric port was the only route 08-03's measurements left open, and it
is exactly the shape `D-08-13` refused for the removal port and `D-08-A14` records 08-07
declining for `install-outcome.ts` — a seam shaped by one test's reach. Under the A-to-B
rule that disqualifies it: a module designed correctly would not have one call site
injected and its sibling on a static import. Tracing the two sites showed they belong to
two different factories (`createHooksRouting` at line 285, `createHooksHydration` at
946), so the complete port changes a second public signature — more effort, which the
operator explicitly accepted. Declining was rejected for the same reason: it leaves a
known `D-08-A04` violation standing when a clean fix exists. Recorded as D-09-05 through
D-09-08.

---

## Windows + backlog

| Option | Description | Selected |
|--------|-------------|----------|
| Repair losslessly, then close what this milestone fixed | Write the table's authoritative text into the fenced JSON, regenerate, close entries 19/21/22 | ✓ |
| Leave it as an operator gate | Record the desync as a blocking environment debt, change nothing | |
| Repair and sweep all 23 open entries | Close every entry that now reads false, regardless of origin | |

**User's choice:** Delegated to Claude's judgement under the standing rule.
**Notes:** 08-08 re-routed this to the operator on the grounds that regenerating the
table destroys the prose side. That is true of a bare regeneration, and avoidable: the
prose regeneration would destroy is exactly the text you copy into the JSON first, which
makes the repair mechanical rather than a judgement call. The third option was rejected
as the boundary case — the remaining open entries come from phases 86, 88, 115, and 117,
and closing them on narrative rather than terminal evidence is what `D-22` bars and what
this milestone exists to retire. Uniformity governs how this milestone's own work is
recorded; it is not a licence to empty a four-milestone ledger. Recorded as D-09-11
through D-09-13.

---

## Audit trail shape

| Option | Description | Selected |
|--------|-------------|----------|
| New `09-CLOSURE-LEDGER.md` + in-place backlog dispositions | One artifact, one closed disposition vocabulary, backlog rewritten to match | ✓ |
| `BACKLOG.md` + `RETROSPECTIVE.md` only | No new artifact; dispositions spread across two existing files | |
| Let the milestone audit carry it | Defer the trail to `/gsd-audit-milestone` | |

**User's choice:** Delegated to Claude's judgement under the standing rule.
**Notes:** The uniformity requirement decided this: a single vocabulary
(`implemented` | `evidence-only` | `superseded` | `deferred` | `unresolved`) across
requirements, backlog items, window entries, and caveats is what stops a record drifting
from what happened, and it needs one home. Two sub-questions were folded in rather than
asked separately. The pin's `reasons` caveat — that no gate can check a reachability
claim — was resolved by *checking* the two claims 08-04 named as human-checkable rather
than recording them as unverifiable, since "accept the caveat" is only correct where the
claim genuinely cannot be checked. The never-run `direct-coverage` CI job genuinely
cannot be proved before a PR exists, so it gets one explicit `unresolved` row naming what
is unproven, not a fold into a passing claim. Recorded as D-09-14 through D-09-18.

---

## Claude's Discretion

The operator answered the area-selection question with a standing rule rather than a
selection:

> apply your best judgement. prefer complete solutions that are consistent and uniform
> all across even if they require more effort. the end result of going from A to B should
> be the same as if we'd done the right thing and done B to begin with.

All four areas were therefore decided by Claude under that rule, and it is recorded in
CONTEXT.md as the tie-breaker for any choice planning meets that the file does not name.
Explicitly left to planning: the exact interface shape for the read port (D-09-08), plan
decomposition and count, the ledger's column layout, and the wording of each backlog
disposition.

## Deferred Ideas

- Repairing the remaining open window entries from phases 86, 88, 115, 117 — barred by
  `D-22` without terminal evidence.
- Whether open windows should block `/gsd-ship` — operator ship-gate policy.
- Detecting unused code and unused type members — the reviewed-not-folded todo; stays a
  `v1.19` deferred item, named by `CLOSE-02` as retaining a deferred history.
- Proving the `direct-coverage` CI job end to end — impossible before a PR exists.
- Settling the four deferred-verification phases (01, 03, 04, 05) — belongs to the
  milestone audit, since their `covered_files` include planning documents every later
  phase rewrites.
