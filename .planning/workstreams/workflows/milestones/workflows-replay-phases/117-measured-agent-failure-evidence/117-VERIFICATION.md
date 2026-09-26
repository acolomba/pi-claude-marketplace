---
phase: 117-measured-agent-failure-evidence
verified: 2026-09-21T17:10:00Z
status: passed
score: 6/6 must-haves verified
covered_files: [".planning/workstreams/workflows/milestones/workflows-phases/105-workflow-degradation-and-documentation/105-VERIFICATION.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-01-PLAN.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-01-SUMMARY.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-02-PLAN.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-02-SUMMARY.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-03-PLAN.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-03-SUMMARY.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-CONTEXT.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-RESEARCH.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-REVIEW-FIX.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-REVIEW.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-SECURITY.md", ".planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-VALIDATION.md", "docs/workflows-compatibility.md", "tests/live-uat/README.md", "tests/live-uat/workflow-agent-failure-canary.mjs"]
covered_digest: "v1:sha256:f2dd01e2611d88e022a535355ea3684f0f7116bd6a724b47ec60a639ef692dfd"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  pass: 3
  previous_status: gaps_found
  previous_score: "5/6 must-haves verified"
  gaps_closed:
    - "The dangling ledger citation in 105-VERIFICATION.md now names what today's ledger actually holds: all three sites (lines 56, 136, 198-210) cite entry id 72 (the live position), with dated 2026-09-21 correction blocks quoting the retired id 45 and naming the current `waived` status and BACKLOG.md WSTOR-01 carrier."
  gaps_remaining: []
  regressions: []
---

# Phase 117: Measured `agent()` failure evidence Verification Report (Re-verification, pass 3)

**Phase Goal:** The claim that decides whether a copied workflow script degrades or dies rests
on a measurement against a real engine rather than a source read, and every document that
states it says so at the grade it actually holds.
**Verified:** 2026-09-21
**Status:** passed
**Re-verification:** Yes — closing the single gap found in pass 2 (2026-09-21T16:20:00Z,
`gaps_found`, 5/6): a stale `.planning/WINDOWS.md` ledger citation in the archived
`105-VERIFICATION.md`, left dangling by main PR #202's merge (`9e48255a`), which renumbered this
branch's Broken Windows ledger ids 32-55 to 59-82.

## Gap closure verification (Truth 6 — full 3-level check)

**Must-have (from pass 2, carried forward unchanged):** "The dangling ledger citation in
`105-VERIFICATION.md` names what today's ledger actually holds at that position, and the
obligation it was tracking is carried by an entry that exists (D-117-07, `117-03-PLAN.md`
must_haves.truths)."

**1. Exists — the correction is present at all three cited sites.**
`grep -n "id 45\|id 72\|entry id" 105-VERIFICATION.md` now returns seven hits, not the three
bare `id 45` citations pass 2 found:

- `:56-57` — evidence block: `` `.planning/WINDOWS.md` entry id 72 (`unrun-verify`, prefixed `[workflows-replay]`; cited as id 45 until 2026-09-21 -- the merge of main PR #202 renumbered this branch's ledger ids 32-55 to 59-82) ``
- `:136` — artifact-row correction note: `` obligation is carried by `.planning/WINDOWS.md` entry id 72 (id 45 until the #202 merge renumbered the ledger on 2026-09-21; waived the same day, carried by `BACKLOG.md` WSTOR-01) ``
- `:188` — Gaps Summary body: `` an `unrun-verify` entry in `.planning/WINDOWS.md` (id 72) `` (the live citation, unqualified — the body prose itself was corrected, not just annotated)
- `:198-215` — two stacked dated correction blocks under the Gaps Summary: the pre-existing
  2026-09-09 block (unchanged, itself a historical record that quotes the *then*-current id 45 —
  not a live citation, and not counted as a gap per the task's framing, matching how this file
  already treats its retired "id 5" citation) followed by a **new** 2026-09-21 block that names
  the #202 merge, the renumbering mechanism (`+27`, ids 32-55 → 59-82), the successor id (72),
  its `recorded_at` match, its `waived` disposition, and the `BACKLOG.md` WSTOR-01 carrier.

**2. Substantive — the correction states the right facts, checked against the live ledger.**
`node .claude/gsd-core/bin/gsd-tools.cjs windows status --raw`, inspected directly (not
summarized from SUMMARY.md):

- Entry id 45 today: `{kind: "deviation", phase: "07", file: "tests/scripts/coverage-source-map-fixtures.ts", status: "open", recorded_at: "2026-09-17T20:09:28.640Z"}` — confirms it is the unrelated phase-07 entry the correction describes, not the storage-canary obligation.
- Entry id 72 today: `{kind: "unrun-verify", phase: "117", file: ".../105-VERIFICATION.md", line: 91, description: "[workflows-replay] The W1/W2/W3 storage assertions were never driven against a live engine...", status: "waived", reason: "Carried to BACKLOG.md WSTOR-01: needs a scratch engine...", recorded_at: "2026-09-09T19:27:52.900Z", resolved_at: "2026-09-21T15:05:10.144Z"}` — confirms id 72 is the genuine successor (matching `recorded_at` cited by the correction), its `waived` status, and the WSTOR-01 carrier, all exactly as the new correction states.
- `.planning/BACKLOG.md:3240` carries `## WSTOR-01: the W1/W2/W3 storage assertions were never driven against a live engine`, opening with "Carried from the workflows-replay close (WINDOWS #72; OPEN-QUESTIONS Q7)." — the carrier the correction names exists and cross-references back to id 72.
- The file's own convention (quote the retired id, don't erase it — used for the earlier "id 5" correction) is followed: the new block states "cited as id 45 until 2026-09-21" rather than silently rewriting history.

**3. Wired — the correction is reachable from every site D-117-07 requires, and the ledger
renumbering mechanism itself is documented where a reader would look for it.**
`.planning/workstreams/workflows/workflows-replay-MILESTONE-AUDIT.md` gained a
"Close-out note, 2026-09-21" section (confirmed via `git diff`, +26 lines) that records the same
`+27` renumbering for every pre-#202 ledger id cited in this milestone's dated records (34→61,
39→66, 45→72, 46→73, 47→74) and states the general rule: "Find an entry by its
`[workflows-replay]` prefix and its `recorded_at` stamp, never by its number." This gives the
`105-VERIFICATION.md` correction an independent, cross-referenced record of the same mechanism,
rather than leaving it as an isolated claim.

**Verdict: ✓ VERIFIED.** All three cited sites now name id 72 as the live position; both id 45
and id 72's ledger fields were independently confirmed against `windows status --raw`, not
trusted from the correction's prose; the WSTOR-01 carrier resolves in `BACKLOG.md`; and the
renumbering mechanism is documented a second, independent place
(`workflows-replay-MILESTONE-AUDIT.md`). This is not a second instance of the same failure mode
recurring silently — the correction quotes the retired position and dates itself, exactly as
D-117-07 requires.

## Regression check on the five previously-passed truths (existence + sanity only)

None of the five files this check covers has a commit since pass 2 (2026-09-21T16:20:00Z); the
only working-tree changes in this pass are to `105-VERIFICATION.md` (the gap fix) and
`workflows-replay-MILESTONE-AUDIT.md` (the supporting close-out note), neither of which pass 2
graded any of Truths 1-5 against.

| # | Truth | Regression check | Result |
|---|-------|-------------------|--------|
| 1 | Canary drives real engine failure path, asserts observed behavior | `tests/live-uat/workflow-agent-failure-canary.mjs` unchanged (last commit `4bc0859f`, 2026-09-09); `node --check` parses clean | ✓ no regression |
| 2 | Negative control (`--invert`) turns the run red | Same file, unchanged; `117-01-SUMMARY.md` transcript unchanged | ✓ no regression |
| 3 | Canary run recorded at corrected version 3.10.1 / corrected HUMAN-UAT framing | `117-01-SUMMARY.md` unchanged since 09-09 | ✓ no regression |
| 4 | `docs/workflows-compatibility.md` states divergence at measured grade, corrected census | File unchanged since `285ad6fb` (2026-09-14, pre-pass-2); doc-pin gate re-run this pass, 9/9 pass | ✓ no regression |
| 5 | `105-VERIFICATION.md` internally consistent on outcome/evidence/status/artifact (separate from the ledger citation) | Re-read: `result: UNRUN`, status line non-closure parenthetical, artifact row both-trees framing all still present and unchanged by this pass's edit (only the ledger-citation prose changed) | ✓ no regression |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Canary driver still parses | `node --check tests/live-uat/workflow-agent-failure-canary.mjs` | exit 0 | ✓ PASS |
| Doc-pin and citation gates still pass | `node --test --experimental-strip-types tests/architecture/workflows-doc-pins.test.ts tests/architecture/no-stale-test-citations.test.ts` | `tests 9 / pass 9 / fail 0` | ✓ PASS |
| Ledger citation in `105-VERIFICATION.md` resolves to the obligation it names | `windows status --raw`, inspect id 45 (unrelated) and id 72 (the real entry, `waived`) | id 72 confirmed as successor with matching `recorded_at` and BACKLOG carrier | ✓ PASS |
| `npm run check` | Not re-run per task constraint; green at HEAD this session (7178 unit / 36 integration) | accepted from session record | ✓ PASS (not re-run, per constraint) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| WEVID-01 | 117-01 | Live-UAT canary drives `agent()` failure, negative control proves it can fail | ✓ SATISFIED | Unchanged since pass 1; re-confirmed unchanged this pass |
| WEVID-02 | 117-02 | Doc restates divergence at measured grade, census with provenance | ✓ SATISFIED | Unchanged since pass 1; re-confirmed unchanged this pass |
| WDOCS-02 | 117-03 | Archived record no longer contradicts itself | ✓ SATISFIED | Both the outcome/evidence/status/artifact quartet (Truth 5) and the ledger citation (Truth 6, this pass's fix) are now internally consistent |

No orphaned requirement IDs found for this phase.

### Anti-Patterns Found

None. No unreferenced `TBD`/`FIXME`/`XXX` markers in either file touched this pass
(`105-VERIFICATION.md`, `workflows-replay-MILESTONE-AUDIT.md`) — the one `TBD`/`FIXME`/`XXX`-shaped
string found by grep (`105-VERIFICATION.md:148`) is prose describing the *absence* of such
markers, not a marker itself.

### Human Verification Required

None.

### Gaps Summary

No gaps. All six must-haves for this phase are verified against the live codebase and the live
`.planning/WINDOWS.md` ledger, not against SUMMARY.md or prior-pass claims. The one gap found in
pass 2 — a ledger citation left dangling by an unrelated merge's renumbering — is closed: all
three cited sites in `105-VERIFICATION.md` now name the live position (id 72), each with a dated
correction that quotes the retired id 45 rather than silently rewriting history, and the
renumbering mechanism itself is documented a second, independent place
(`workflows-replay-MILESTONE-AUDIT.md`'s new close-out note) so it does not depend on a single
file staying correct.

---

*Verified: 2026-09-21*
*Verifier: Claude (gsd-verifier, re-verification pass 3)*
