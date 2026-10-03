---
phase: 03-typed-raw-surfaces
fixed_at: 2026-10-03T00:00:00Z
review_path: .planning/phases/03-typed-raw-surfaces/03-REVIEW.md
iteration: 2
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-10-03
**Source review:** .planning/phases/03-typed-raw-surfaces/03-REVIEW.md
**Iteration:** 2

**Summary:**

- Findings in scope: 1 (WR-01). The fix scope is critical_warning, so IN-01,
  IN-02, and IN-03 are out of scope.
- Fixed: 1
- Skipped: 0

**Earlier iteration:** iteration 1 fixed the first review's two warnings.

- WR-01 (AUTH-09 device-code gate missed indirect call forms): commit
  95237f7c.
- WR-02 (SC-5 sink gate accepted composed text passed to the structured
  formatter): commit 16f507cd.

The iteration-2 review confirmed that both fixes hold.

**Where verification ran:** in the main checkout
(`/home/acolomba/src/pi-claude-marketplace-json`, branch `features/json`).
No isolated worktree was created, because the orchestrator's project rules
say to work in this checkout. A worktree also has no `node_modules`, so the
npm pre-commit hooks could not run there. Every result below can be
reproduced from this tree.

## Fixed Issues

### WR-01: The D-16 sink gate still misses `.call`, destructured, and aliased sink calls

**Files modified:** `tests/architecture/presentation-sink.test.ts`
**Commit:** 13729cd8
**Applied fix:** This changes only the test file. No production source
changed.

- `assertSinkPlacement` now counts mentions as well as calls in the
  comment-stripped dispatch module:
  - Every `\bui\b` mention must be one of the notify calls inside `deliver`.
    The clause compares against `sinkCalls`, which the existing clause
    already pins at 2.
  - Every `\bdeliver\b` mention must be the declaration or a direct
    `deliver(<ctx>, formatEnvelopeArguments(` / `formatRawSurface(` call.
    The context may be a member chain, as in the pattern clause. Today the
    module has 3 mentions: 1 declaration and 2 calls.
- There are three new planted offenders: `ctx.ui.notify.call(ctx.ui, ...)`,
  `const { notify: n } = ctx.ui; n(...)`, and
  `const d = deliver; d(ctx, [...])`. Each one passes an optional per-offender
  `rejection` regex. The regex pins the mention message the offender must fail
  with: "names ui 4 time(s)", "names ui 3 time(s)", and "names deliver 4
  time(s)". So each offender is proven to fail on the new clause, and not on
  any D-16 message. The older offenders keep `/D-16/` (IN-01 is out of scope).
- Negative control: the reviewer's probe copy of the pre-fix gate
  (`scratchpad/probe-sink.test.ts`) still reports "Missing expected rejection"
  for all three forms. The fixed gate rejects each one with its pinned message.
- The header gains a "Mentions" section and a "Limit" section. The Limit
  section says that a body variable's provenance is not checked, and that the
  literal clause bounds only what this module composes. So
  `deliver(ctx, formatEnvelopeArguments(envelope, body))` passes whatever
  `body` holds. This is the reviewer's fourth probe, and it stays documented,
  not enforced.

## Verification

- Owner test: `node --test tests/architecture/presentation-sink.test.ts` ran
  13 tests: 13 passed, 0 failed.
- Bytes: `git diff --exit-code 4e6c568a -- docs/output-catalog.md` exits 0.
  The fix touches no production source, so output cannot change.
- Pre-commit: `SKIP=trufflehog pre-commit run --files
  tests/architecture/presentation-sink.test.ts` exited 0, with no files
  modified. The `npm changed checks` hook chose a full `npm run check` for
  this architecture-gate change, and it passed.
- `fallow audit --format json --quiet --explain --gate-marker agent` returned
  verdict `warn`, not `fail`. It reports 0 dead-code findings, 0 complexity
  findings, and 17 clone groups. The 17 clone groups were inherited from the
  branch base, as the review notes.
- Per the hook evidence above, the full `npm run check` passed on this tree
  before the commit. The combined phase/PR gate is still the orchestrator's
  call.

---

_Fixed: 2026-10-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
