---
phase: 112-install-and-removal-lifecycle
fixed_at: 2026-09-05T20:05:00Z
review_path: .planning/workstreams/workflows/phases/112-install-and-removal-lifecycle/112-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 9
skipped: 1
status: partial
---

# Phase 112: Code Review Fix Report

**Fixed at:** 2026-09-05T20:05:00Z
**Source review:** `.planning/workstreams/workflows/phases/112-install-and-removal-lifecycle/112-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 10 (2 critical, 8 warning)
- Fixed: 9
- Deferred with a carrier: 1 (WR-03)
- Rejected: 0

`npm run check` exits 0. All four touched source files stay at 100% line
**and** branch coverage (`hit === found`), so the new branches are covered and
nothing moved onto the `D-116-01a` accepted-shortfall list:

| File | LF/LH | BRF/BRH |
|---|---|---|
| `orchestrators/plugin/workflows-staging-gc.ts` | 189/189 | 29/29 |
| `orchestrators/plugin/reinstall.ts` | 1806/1806 | 255/255 |
| `orchestrators/plugin/install.ts` | 2568/2568 | 262/262 |
| `bridges/workflows/stage.ts` | 456/456 | 68/68 |

Verification ran in the **main checkout**, not an isolated worktree:
`.planning/config.json` sets `workflow.use_worktrees: false`, so per that
opt-out no worktree was created and the numbers above are reproducible from the
tree as it stands.

## Fixed Issues

### CR-01: `replaceAll`'s catch discarded the placed-envelope report

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`,
`tests/orchestrators/plugin/reinstall.test.ts`
**Commit:** `42f7821a`

The catch now builds its removal payload from `placedWorkflowNames` and calls
`unplaceWorkflows(hooks.locations, ...)`. No new parameter was needed —
`HooksReplaceArgs` already carries the same `locations` bundle every other step
in the function uses, so threading a second copy through the signature would
have been redundant.

The false premise at the heart of both blockers is corrected in place rather
than left standing: the comment now says the commit being last means no *later*
step can fail, and that the commit's own partial failure still places envelopes
this catch must take back.

### CR-02: the abort arm recursively deleted the staging root the commit preserved

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`,
`tests/orchestrators/plugin/reinstall.test.ts`
**Commit:** `42f7821a`

Took the narrower of the reviewer's two options: a `workflowsCommitEntered`
flag set immediately before the commit call, threaded to
`abortHandles(handles, { skipWorkflows })`. Once the commit has been entered it
owns its staging root on both its paths — it cleans up after a success, and
after a failed restore it keeps the root because `.previous/` holds the only
copy. The alternative (teaching `abortPreparedWorkflows` to refuse a root
holding `.previous/`) would have put the same knowledge in two layers; the
sweeper needed that predicate anyway for WR-02, and the orchestrator does not.

### WR-07: the abort test's premise was false, and both blockers rode on it

**Files modified:** `tests/orchestrators/plugin/reinstall.test.ts`
**Commit:** `42f7821a`

Corrected the comment and added the two cases the review named. **Both were
proven non-vacuous**: with the fix temporarily reverted, `CR-01` and `CR-02`
both fail; with it restored, both pass, and the full 270-case
install+reinstall suite is green.

- `CR-01: a partially failed workflows commit unplaces what it stranded` —
  the old install ships no workflows, so both new envelope names are absent
  from the old record and a stranded one is a true orphan. Faults the `wave`
  placement and then the `greet` reversal, which is the shape that produces a
  non-empty `stranded` set; asserts the saved directory ends empty.
- `CR-02: a failed restore keeps the staging root holding the only copy` —
  faults the `wave` placement and the restore out of `.previous/`; asserts the
  staging root survives and still holds the previous envelope byte-unchanged.

### WR-01: a containment refusal made the sweeper permanently inert

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts`,
`tests/orchestrators/plugin/workflows-staging-gc.test.ts`
**Commit:** `7ed19e4f`

Fixed at the sweeper, not the call sites. Both call sites swallow deliberately
under D-19-01 ("hygienic cleanup never becomes the primary user-facing path"),
which is a standing decision this review did not ask to overturn; the defect is
that one refusing entry ended the pass for *every remaining tree*. The
assertion is now caught per entry and recorded as a leak, and it still sits
outside the `rm`'s try, so a refusal is never mistaken for an rm failure.

This required rewriting the existing symlink case, which pinned the old
throw-out-of-the-sweep behavior. The replacement plants **two** aged entries
behind the same symlinked segment and asserts both are refused — which is the
assertion that actually proves the sweep no longer dies at the first one.

### WR-02: the sweeper deleted the manual-recovery copy on a 24-hour delay

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts`,
`extensions/pi-claude-marketplace/bridges/workflows/stage.ts`,
`tests/orchestrators/plugin/workflows-staging-gc.test.ts`
**Commit:** `7ed19e4f`

Chose the **contents predicate over the sentinel file** the review offered
first. A `.retained` sentinel written by the commit only marks the deliberate
path; a crash mid-commit strands the identical bytes in the identical place and
would still be swept. Skipping any aged root whose `.previous/` is non-empty is
cause-independent, needs no write on a failure path that is already failing,
and answers the question the reviewer actually posed — "does this hold the only
copy" — rather than "was this kept on purpose".

`DISPLACED_DIR` is now exported from `bridges/workflows/stage.ts` rather than
duplicated as a literal, so the layout has one owner. `orchestrators` already
allows `bridges-workflows` in `.fallowrc.json`, so no boundary changed.

The predicate reads contents, not mere presence, so an empty `.previous/` is
still collected — pinned by a dedicated case. Any read failure reads as
"nothing displaced": ENOENT is the ordinary case, and no other errno is
evidence that the directory holds bytes, so none of them justifies keeping an
aged tree forever. Folding them into one `catch` also avoids a branch that
could only be driven by a root-fragile `chmod`.

### WR-04: the install ledger lost the prepare's warnings on a commit throw

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
**Commit:** `240a63d1`

Applied as suggested — the push moved above the commit.

### WR-05: the sweeper took a scoped bundle for two scope-independent fields

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts`
**Commit:** `7ed19e4f`

Applied. Weighed the churn and it is one line with no caller impact — narrowing
a parameter is always caller-compatible. The `ScopedLocations` brand exists to
stop one scope's path reaching another scope's operation, so a signature that
falsely implies a per-scope sweep is worth correcting cheaply.

### WR-06: `resourcesFromHandles` defaulted `placedWorkflowNames` to `[]`

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`
**Commit:** `42f7821a`

Made required. Required parameters cannot follow optional ones, so it moved to
second position ahead of the pre-existing `plugin?` / `installable?` optionals.
`successOutcome` now passes `[]` explicitly with the reasoning that makes it
safe stated at that site: the projection reads only `agents`/`mcpServers` and
no state write happens on that path.

### WR-08: the permission-denial tests had no root guard

**Files modified:** `tests/orchestrators/plugin/workflows-staging-gc.test.ts`
**Commit:** `7ed19e4f`

Applied, but **not with the snippet the review supplied**. The review cited
`tests/orchestrators/reconcile/apply.test.ts:204` as the precedent for
`t.skip`; that precedent actually **throws** with a message naming the
environment. I matched the real house idiom via a `requireNonRoot()` helper.

This is the better behavior here regardless of precedent: these two cases are
the only coverage of the sweeper's leak-recording branches, and this phase is
held to `hit === found`. Skipping under root would silently drop that coverage
and break the coverage gate instead of the test — a quieter failure, not a
smaller one.

## Deferred

### WR-03: `update` never re-stages workflows, and nothing tells the user

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
**Carrier commit:** `bcadbf89`
**Disposition:** deferred to Phase 113 with a named carrier — not skipped, not
rejected.

The behavior half is Phase 113's stated work: ROADMAP criterion 1 for that
phase already reads "`update` prepares, aborts, commits and records workflows
as a sixth bridge, so an author's workflow fix reaches the user and a withdrawn
workflow stops being registered." Forcing it into 112 would pull a whole verb
across a phase boundary.

What was **not** carried anywhere was the review's second point — that the
three type widenings pre-consume the compile-forcing signal
`PHASE3_FAILURE_PHASES` exists to give, and that the deferral lived only in a
source comment. That is now ROADMAP Phase 113 criterion 6, following the
WR-08/WR-09 precedent from Phase 111, and it records the user-visible gap in
full (an update reports success while the envelopes hold the previous version's
script).

**I did not revert the three widenings**, against the review's suggestion. They
are type-only, they buy back a signal for exactly one phase, and criterion 1 of
the very next phase makes them honest. Re-adding them in 113 is pure churn
against a compiler error that has one phase to live. The exposure is bounded:
nothing outside this branch sees it, because the `workflows` kind is not fully
shipped until Phase 114.

## Notes for the human reviewer

Two items are judgment calls rather than mechanical applications, and are worth
a look:

1. **WR-02's discriminator.** I rejected the sentinel-file mechanism in favor
   of "`.previous/` is non-empty". The tradeoff is stated above; the case
   against the sentinel is that it does not protect the crash path.
2. **WR-01's blast radius.** Making the refusal per-entry changed the sweeper's
   observable contract, so an existing passing test had to be rewritten rather
   than extended. That is the intended consequence of the finding, but it is
   the one place where a green suite before and after does not mean "no
   behavior changed".

Nothing in `scope_boundaries` was touched: `remove.ts`'s `CASCADEAX-01`
omission, `EXTENSION_VERSION`, the five inverted Phase 109 files, and the
`PathContainmentError` raise contract in the bridge / `phase-ledger.ts` are all
unmodified.

---

_Fixed: 2026-09-05T20:05:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
