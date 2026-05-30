---
phase: 21-final-teardown-green-gate
fixed_at: 2026-05-27T00:00:00Z
review_path: .planning/phases/21-final-teardown-green-gate/21-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 6
skipped: 2
status: partial
---

# Phase 21: Code Review Fix Report

**Fixed at:** 2026-05-27T00:00:00Z
**Source review:** .planning/phases/21-final-teardown-green-gate/21-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope (Critical + Warning): 8
- Fixed: 6 (CR-01, CR-02, WR-01, WR-04, WR-05, WR-06)
- Skipped: 2 (WR-02, WR-03)

All fix commits keep `npm run check` GREEN at 1120 pass / 0 fail / 0 skipped.

## Fixed Issues

### WR-04: Stale documentation references to retired `presentation/` and `shared/grammar/` paths

**Files modified:**
`extensions/pi-claude-marketplace/shared/notify.ts`,
`extensions/pi-claude-marketplace/shared/errors.ts`,
`extensions/pi-claude-marketplace/transaction/rollback.ts`,
`extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`
**Commit:** `cc04941`
**Applied fix:** Rewrote every comment referencing
`presentation/compact-line.ts`, `presentation/cause-chain.ts`,
`presentation/sort.ts`, `presentation/rollback-partial.ts`,
`presentation/reload-hint.ts`, `presentation/version-arrow.ts`,
`shared/grammar/status-tokens.ts`, and `shared/grammar/reasons.ts` to use
the form "canonicalised here in Phase 21 from the retired `<old-path>`".
A new contributor following the comment now lands on the right file
(the file they are reading) rather than on a path that no longer exists.

### CR-02 + WR-05: Redundant row-level `scope` on `PluginFailedMessage`

**Files modified:**
`extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
**Commit:** `a2d01e9`
**Applied fix:** The two findings describe the same defect class
(per-row `scope` field always matches the marketplace block's `scope`,
which the renderer suppresses anyway). Combined into one atomic commit:
- `install.ts`: defensive internal-error arm now omits the row-level
  `scope`, matching the IN-04 convention pinned at install.ts:936-944.
- `update.ts`: `notifyDirectFailure` and `notifyBareFormEnumerateFailure`
  now construct `PluginFailedMessage` rows without `scope`, matching
  uninstall.ts and reinstall.ts. No byte-output change on the wire (the
  renderer's `renderScopeBracket` already suppressed the redundant
  bracket); the contract divergence is gone.

### CR-01: `updatePlugins` silently drops successful outcomes on phase-3a abort

**Files modified:**
`extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
**Commit:** `039bde1`
**Applied fix:** When the batch hits a phase-3a aggregate failure (which
has already fired its own `notifyDirectFailure` inline), emit the
cascade for the already-accumulated successful outcomes before
returning. Previously, plugins #1-#3 that successfully updated and
committed state to disk inside their own `withStateGuard` closures
were never reported when plugin #4 hit phase-3a -- the on-disk state
and the user-visible report diverged. Extracted the discriminator and
the conditional emit into named helpers
(`isPhase3aAggregateFailure` / `renderUpdateCascadeIfAny`) to keep the
loop body inside the sonarjs/cognitive-complexity ceiling. **Requires
human verification** -- the change is a logic fix on a hot path
that no test currently exercises directly; semantic correctness
should be confirmed by a developer.

### WR-01: marketplace-form failure path puts mp name in plugin-row slot

**Files modified:**
`extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`,
`tests/orchestrators/plugin/update.test.ts`
**Commit:** `56dc008`
**Applied fix:** When the user runs `/claude:plugin update @<marketplace>`
and the marketplace lookup fails, the synthetic plugin-row identity is
now the marketplace name wrapped in parens
(`(${target.marketplace})`), mirroring the
`SYNTHETIC_UPDATE_PLACEHOLDER_NAME = "(update)"` precedent that the
bare-form path adopted in WR-05. The row now reads
`⊘ (<marketplace>) (failed) {<reason>}` and is visually distinguishable
from the surrounding marketplace header (previously it rendered as
`⊘ <marketplace> (failed) ...` directly under a header also named
`<marketplace>`). Adopted Option A (parens-wrapped synthetic) rather
than Option B (mp-level structural failure) so the 4-space cause-chain
trailer (D-16-08) is preserved for the operator's primary diagnostic.
Updated the `PUP-1-missing-marketplace` test fixture to pin the new
byte form.

### WR-06: `narrowSkipReason` empty-notes fallback returned `"up-to-date"` (a SUCCESS reason)

**Files modified:**
`extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`,
`tests/orchestrators/marketplace/update.test.ts`
**Commit:** `d347451`
**Applied fix:** Map the two `"up-to-date"` return paths in
`narrowSkipReason` (empty-notes and no-substring-match) to
`"unreadable manifest"` instead, matching the symmetric
`narrowFailReason` fallback. A `partition: "skipped"` outcome with
neither reasons nor a recognisable notes substring is a
producer-contract violation; the brace must surface a real failure
classification rather than falsely claiming up-to-date success.
Updated the `mixed-outcomes` cascade test's `c` row fixture
(`skipped + reasons=[] + notes=[]`) to pin the new byte form.

## Skipped Issues

### WR-02: `narrowDirectFailReason` and peer narrowers fall back to misleading closed-set Reasons

**File:**
`extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1350,1440,1464`;
`orchestrators/plugin/reinstall.ts:846`;
`orchestrators/marketplace/remove.ts:170`
**Reason:** skipped: would require closed-set REASONS frontmatter
extension and catalog UAT rewrite -- blast radius exceeds review-fix
scope. The fix requires either (a) adding `"unknown"` / `"unclassified"`
to the closed `REASONS` tuple in `shared/notify.ts` and the
`docs/messaging-style-guide.md` frontmatter (the binding contract), then
updating every consumer; or (b) making the `{<reason>}` brace optional
on the failed/skipped arms and threading `undefined` through the
narrowers. Approach (a) breaks the closed-set frontmatter binding and
~10+ catalog UAT tests pinning `{not in manifest}` as the documented
permissive default (`reinstall.ts:846` cites it explicitly as "the
catalog's most-permissive cascade skip reason ... matches the operator
mental model 'we couldn't reconcile this row'"). Approach (b) changes
the byte output of every row that currently falls through to the
default reason. Both fall outside the targeted-fix scope of a
code-review iteration and should be addressed in a dedicated planning
phase.
**Original issue:** Several narrowers default to a closed-set Reason
(`"unreadable manifest"`, `"not in manifest"`) that does not describe
the underlying failure when no narrower predicate matches, masking the
actual error class behind a recognisable but incorrect token.

### WR-03: `narrowCascadeFailure` substring-fallback branches advertised as "possibly dead"

**File:**
`extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:152-170`;
`extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1264-1311`
**Reason:** skipped: branches have explicit "defense-in-depth"
test coverage that proves the substring classification works
(`tests/orchestrators/marketplace/remove.test.ts:647-652` exercises
the `unreadable` substring fallback). No production producer was
found throwing bare `Error` with `unreadable`/`unparseable` substrings,
but every bridge would need an audit to confirm. The review's two
suggested fixes (audit-and-delete, or convert-to-assertion) both
require breaking changes: audit-and-delete drops the tests that
document the fallback as intentional, and convert-to-assertion would
crash production if the dead-code assumption is wrong for any
future bridge. Carrying forward as a deferred decision rather than
applying a half-measure inside the review-fix iteration. The JSDoc
hedges that the review correctly identified will need a dedicated
audit phase to retire.
**Original issue:** Defensive textual fallback in `narrowCascadeFailure`
(and the parallel `narrowResolverReasons` in install.ts) carries
substring-matching branches with a TODO-style "may be dead code" hedge
in the JSDoc. Either the branches are needed (bug elsewhere) or they
are dead (should be deleted).

---

_Fixed: 2026-05-27T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
