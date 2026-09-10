# Open questions — workflows-replay

**Raised:** 2026-09-10
**Status:** awaiting operator discussion
**Blocks:** nothing mechanically. All nine phases are complete, verified, threat-verified
and validated. The milestone can archive with these open.

Twelve Broken Windows entries are open, all tagged `[workflows-replay]`. Each is
filed with its mechanism written down and none contradicts a shipped behavior.
This document exists because they are **decisions**, not a work queue — several
have more than one defensible answer, and two would change conventions that apply
to every phase in the workstream.

Ledger is the source of truth for the entries themselves
(`gsd-tools windows status`). This file carries the framing the ledger has no
field for: what the options are, what each costs, and a recommendation.

---

## Group A — Two conventions, not two bugs

These two are halves of one defect and cannot be settled independently.

### Q1. What should `covered_files` cover? (#39, #53)

**What is true today.** A phase's `VERIFICATION.md` lists the files its
conclusions depend on and stores a digest over them. Any later edit to a listed
file flips the phase to `stale`.

Both failure directions have now been observed for real:

- **Too broad** (#39, filed against phase 115): a list naming a file a later pass
  rewrites makes its phase permanently un-completable. Seen twice more since —
  phase 114 went stale from a docs quick task on 2026-09-09, and again this
  session.
- **Too narrow** (#53, filed against phase 114): the inclusion rule is
  inconsistent. Phase 114 listed `114-CONTEXT.md`, `114-REVIEW.md` and
  `114-REVIEW-FIX.md` while omitting `114-PATTERNS.md`, `114-RESEARCH.md`,
  `114-SECURITY.md`, `114-VALIDATION.md` and `deferred-items.md`. That last one
  moved during the quick task and the staleness signal never saw it. The file
  that DID trip it was caught by luck of inclusion rather than by design.

**Why it needs a decision rather than a fix.** Any rule change alters what
`stale` means for every phase in the workstream, and phase completion is computed
from it. Picking a rule per phase is what produced the inconsistency.

**Options.**

| Option | Effect | Cost |
|---|---|---|
| State one rule and apply it everywhere | Staleness becomes predictable | Re-derive 9 phases' lists and digests; some may flip to `stale` on the spot |
| Exclude planning artifacts entirely; cover only source and tests | A doc edit stops staling a phase | Loses the signal that a graded document changed — which is exactly what caught the real drift this session |
| Cover graded files only, named per criterion | Tightest possible signal | Every criterion needs a file list; largest authoring cost |
| Leave as-is, re-verify at each boundary | Zero change | Re-verification stays a recurring boundary cost, and #39's "permanently un-completable" case can recur |

**Recommendation.** State one rule: cover what a criterion actually grades, plus
the phase's own PLAN and SUMMARY files. Exclude CONTEXT, RESEARCH, PATTERNS,
REVIEW and the sibling security and validation artifacts, none of which any
criterion grades. Do it as its own task after the archive, not inside it — it
touches nine files and can flip completion state.

---

## Group B — Behavior claims that need measuring, not reading

Each of these is a statement about runtime behavior that no one has driven. None
can be settled by re-reading source, which is why they are grouped.

### Q2. Does the succeeded-arm record the right names? (#52)

`update.ts:1992-1994` sets `resources.workflows` from the prepare's
`stagedNames` when the commit succeeded, and from the commit-reported
`placedNames` otherwise. The rationale is "on a commit that ran, what it staged
is the truth."

**The problem.** A staging-cleanup leak is a recorded failure over a commit that
fully succeeded — and the comment directly above that line reasons about exactly
that case: envelopes left in `.previous/` rather than at their targets, producing
a false `{stale workflow command}` stamp on the next update and phantom `info`
entries. So the arm whose premise is "the commit ran, therefore the intent is the
truth" is the same arm that handles the case where the commit ran and the
placement did not survive.

Surfaced while writing the WLIF-02 architecture gate: the gate could not be
written to the property as originally promised, and that impossibility is what
exposed the question.

**To settle it:** drive the leak path and observe what gets recorded. Do not
decide from the source.

### Q3. Is the reload-hint mechanism claim stale? (#47)

`docs/messaging-style-guide.md:90` and `:37` describe the trailer as emitted on a
status-set test plus a cascade kind. `shouldEmitReloadHint` (`notify.ts:3393`)
instead OR-reduces a caller-stamped per-row `needsReload`, with a kind-level
short-circuit for info surfaces and `reconcile-applied-cascade`. Its own comment
says "no status-token or cascade-kind inference." `needsReload` occurs 34 times
in `notify.ts` and once in the guide.

**To settle it:** measure the `needsReload` plumbing across the producers that
stamp it, then restate the guide at the grade that holds.

### Q4. Wrong reason token for a held lock (#55)

A held state lock during a backfill re-materialize reaches the user as
`unreadable`, not `lock held`. `reinstallPlugin` catches `StateLockHeldError` and
falls through `narrowReason`'s last-resort return (`reinstall.messaging.ts:404`);
the wrapper one layer up maps the same error correctly via
`classifyOrchestratorThrow` (`apply-outcomes.ts:380`). One cause, two tokens from
the same closed set, depending on which layer catches it.

`narrowReason`'s own comment for the adjacent arm states the principle this
breaks: falling through to `unreadable` makes the row claim the cascade could not
read the plugin, which is false. The operator loses the one word that would tell
them to retry.

Found while building the ENBL-08 lock-collision twin. The test pins `unreadable`
as **observed, not endorsed**, with the mechanism in its assert block, so a fix
reddens it loudly rather than silently disagreeing.

**This is the one I would fix first.** It is a small, well-located change with a
clear correct answer, and it is user-visible.

---

## Group C — Real code changes to a shipped bridge

### Q5. The saved-directory symlink asymmetry (#48)

`stage.ts:215` anchors its containment check one level **above** the staging
directory, precisely so a symlink planted at that segment is `lstat`'d. Its
sibling saved directory gets no equivalent: `commitPreparedWorkflows` calls
`mkdir(workflowsSavedDir, {recursive: true})` at `stage.ts:414` with nothing
anchored above it, and `workflowArtifactPath` trusts `workflowsSavedDir` as its
own boundary. A symlink at `~/.pi/workflows/saved` would be followed.

**Why it is not obviously worth fixing.** Planting that link requires write
access to the user's home, which is outside the "careless or malicious plugin
author" model recorded at `path-safety.ts:70-74`. The retroactive security audit
that found it explicitly did not count it in `threats_open`.

**Why it might be.** The reasoning at `stage.ts:207-214` was applied to one of
two sibling directories. An asymmetry with no stated reason reads as deliberate
to the next person.

**Recommendation.** Fix it, or write down why not, directly beside the existing
justification. Either resolves the ambiguity; leaving it silent does not.

### Q6. `PathContainmentError` interpolates an untrusted path (#37)

`shared/path-safety.ts:13` interpolates the untrusted resolved child path raw
into its message, so escaping a caller's label cannot close the forgery. Five
bridges share the class and there are 58 measured `assertPathInside` call sites.

**Recommendation.** Scope this deliberately before touching it. It is the widest
blast radius of anything on this list.

---

## Group D — Needs something this machine does not have

### Q7. The storage assertions were never driven live (#45)

The W1/W2/W3 storage assertions in the archived phase-105 verification were never
driven against a live engine, and their driver
(`tests/live-uat/workflow-storage-canary.mjs`) was never re-landed on this
branch. So the storage half of the host-engine contract rests on a source read.

**To settle it:** re-land the driver and run it against a real engine, the way
the `agent()` failure canary was driven at 3.10.1. There is a recorded route for
this — a disposable scratch install plus `PI_WORKFLOW_ENGINE_ROOT`, with a
negative control.

### Q8. Fifteen line-range citations into an unvendored package (#34)

`docs/workflows-compatibility.md` cites 15 exact line ranges inside
`@quintinshaw/pi-dynamic-workflows` 3.10.1, which this repo does not vendor. No
gate can detect that an engine upgrade moved them.

This is what the deferred `WPIN-01` requirement exists for. **Recommendation:**
leave it, and let `WPIN-01` carry it. Nothing cheaper is available without
vendoring the package, which is explicitly out of scope.

---

## Group E — Small and self-contained

### Q9. A catalog state id under-describes its row (#40)

`docs/output-catalog.md`'s `backfill-partially-installed-no-reasons` now carries
the components-now-supported marker, so it is not brace-less and the id no longer
describes the row. The rename was deferred to the plan that owns the catalog.

Cheap. Needs care only because catalog states are byte-pinned by
`catalog-uat.test.ts`, so the id and its fixture must move together.

### Q10. The threat-flag channel is never populated (#51)

Zero of 21 summaries across phases 109-113 carry a `## Threat Flags` section —
absent, not empty. So every security audit's cross-check against
executor-detected surface was vacuous. All four auditors flagged it independently
and none treated absence as evidence that no new surface appeared.

**Recommendation.** A template change so the section is emitted even when the
answer is "None." Cheap, and it makes the next milestone's audits meaningfully
stronger rather than nominally so.

### Q11. The abort-path enumeration stays ungated (#54)

An accepted residual, recorded rather than hidden. The removed grep threshold
guarded that no unwind path omits the workflows arm. That property holds, and
`update.test.ts#WLIF-02` catches the single-function regression — what nothing
catches is a **second** function-level entry point skipping the workflows arm on
a different failure branch.

You chose the two gates and not a third. Listed so the absence stays visible.

---

## Suggested order, if you want one

1. **Q4** (#55) — wrong reason token. Small, located, user-visible, clear answer.
2. **Q10** (#51) — template change. Cheap, improves every future audit.
3. **Q5** (#48) — fix the asymmetry or write down why not.
4. **Q1** (#39, #53) — the `covered_files` rule, as its own task.
5. **Q2** (#52) and **Q3** (#47) — measure, then restate.
6. **Q7** (#45) — live canary, when a scratch engine is available.
7. **Q6** (#37) — scope first.
8. **Q9** (#40), **Q8** (#34), **Q11** (#54) — small, carried, and accepted respectively.

None of this blocks `/gsd-complete-milestone workflows-replay`.
