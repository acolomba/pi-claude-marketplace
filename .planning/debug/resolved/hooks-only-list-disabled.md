---
status: resolved
trigger: "After /claude:plugin install learning-output-style@claude-plugins-official, the install cascade emits the (installed) row correctly, but /claude:plugin list (both before and after /reload) renders the plugin with the (disabled) status token. State.json confirms the plugin is installed (installable: true, resources.hooks = [\"learning-output-style\"], every other resource array empty). The misclassification is on the read side, not the install path."
created: 2026-06-16T23:55:00Z
updated: 2026-06-17T01:30:00Z
---

> Pre-filled from /gsd-debug args after UAT test 8 (63-UAT.md commit
> 2f4d093) discovered the regression during the post-code-review UAT
> re-run for v1.13. Root cause is already pinned — this session is for
> formal diagnosis confirmation, fix application, and re-verification.

## Symptoms

### Expected behavior
After `/claude:plugin install learning-output-style@claude-plugins-official`,
running `/claude:plugin list` (both before and after `/reload`) should
render the plugin row with the `(installed)` status token. The plugin is
newly installed and has never been disabled.

### Actual behavior
The install cascade correctly emits:

    + learning-output-style@claude-plugins-official [user] (installed)

But `/claude:plugin list`, both before AND after `/reload`, renders the
row with the `(disabled)` token instead of `(installed)`.

### Error messages
None — there are no notify `Error:` / `Warning:` rows. The misclassification
is silent: the renderer emits the wrong status token but the byte-level
grammar of the row is otherwise correct.

### Timeline
Introduced by Phase 63 (lifecycle-cascade-user-facing-surface-docs, v1.13
hook bridge). Phase 63 added `resources.hooks` to the state schema
(D-63-04 / COMPONENT_KINDS 5-tuple) but did NOT extend the four "empty
resources + installable: true => recorded-but-disabled" predicates that
the read side relies on. The bug ships in every commit since the phase 63
hook-bridge plans landed; it was not caught by the unit suite (which
covers `available` hooks plugins through the list renderer but no
installed hooks-only plugin) and was first observed at the post-code-review
UAT cycle on 2026-06-16T23:55Z.

### Reproduction
1. Cold-start a pi-uat sandbox at HEAD:

       scripts/pi.sh --clear --home /home/acolomba/pi-claude-marketplace/tmp/pi-uat

2. In the Pi REPL:

       /claude:plugin install learning-output-style@claude-plugins-official
       /claude:plugin list
       /reload
       /claude:plugin list

3. Observe: install cascade emits `(installed)`; both list invocations
   emit `(disabled)`. Confirm with:

       cat tmp/pi-uat/agent/pi-claude-marketplace/state.json | jq '.marketplaces[].plugins["learning-output-style"]'

   which shows `installable: true` + `resources.hooks: ["learning-output-style"]`
   + every other resource array empty.

## Current Focus

hypothesis: |
  The phase-63 hook bridge added `resources.hooks` to the state schema but
  never extended the `isRecordedButDisabled` (and drift-twin) predicates
  that the read side uses to classify rows as `(disabled)`. All three
  predicate copies check `resources.{skills,prompts,agents,mcpServers}` for
  empty + `installable: true` and return true when all four are empty.
  A hooks-only installed plugin satisfies the predicate, so `list.ts:255`
  routes the row to the `(disabled)` arm instead of `(installed)`.

  Three drift-twin copies missing the new axis:
  - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:275-285
    (isRecordedButDisabled, the canonical one that list.ts:255 consumes)
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:958-968
    (duplicate, the IN-04 finding from 63-REVIEW.md)
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:175-191
    (isCurrentlyDisabled drift twin, pinned to plan.ts by the T5 drift
    gate at tests/orchestrators/reconcile/plan.test.ts:713)

  The drift gate and T5 truth-table tests pin the same 4-axis list
  textually, so they happily passed against three CONSISTENTLY-wrong
  predicate copies; the gate fires only on textual disagreement.

test: |
  Add a unit test asserting that `isRecordedButDisabled` returns FALSE for
  a record with `installable: true`, every standard resource array empty,
  AND `resources.hooks: ["some-name"]`. Currently the predicate would
  return TRUE for that shape -- the test will fail before the fix and
  pass after.

expecting: |
  After extending `isRecordedButDisabled` (and its two drift twins) with
  `resources.hooks.length === 0`, the predicate returns FALSE for a
  hooks-only installed record. `list.ts:255` falls through to the
  `(installed)` / `(upgradable)` arm. The runtime probe in
  tmp/pi-uat shows `(installed)` for learning-output-style on both list
  invocations.

next_action: |
  Confirm the diagnosis is precise by reading the three predicate sites
  and the `list.ts` consumer site. Then plan the fix scope:
    1. Add `resources.hooks.length === 0` axis to all three predicate
       copies (plan.ts, update.ts, enable-disable.ts).
    2. Extend the T5 drift-gate `requiredAxes` array (plan.test.ts:744).
    3. Extend the T5 truth-table fixtures (plan.test.ts:671) with a
       hooks-axis dimension.
    4. Add a list-renderer regression test for the hooks-only-installed
       case (no existing test covers this).
    5. Re-run `npm run check` -> green.
    6. Re-run the runtime probe against the pi-uat sandbox to confirm the
       (installed) row appears on both list invocations.
  Apply the fix as a single atomic commit (or split across the source/test
  pair if the changelog prefers).

reasoning_checkpoint: ""
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-06-16T23:52:35Z
  observation: |
    state.json for learning-output-style after install:
    {
      "version": "1.0.0",
      "compatibility": { "installable": true, "supported": ["hooks"] },
      "resources": {
        "skills": [], "prompts": [], "agents": [], "mcpServers": [],
        "hooks": ["learning-output-style"]
      },
      "installedAt": "2026-06-16T23:52:35.798Z"
    }
  conclusion: |
    Install path is correct (writes the right resources shape, installable=true).
    The bug is entirely on the read side that classifies this shape as "disabled".

- timestamp: 2026-06-16T23:55:00Z
  observation: |
    Predicate at orchestrators/reconcile/plan.ts:275-285 reads:
      return (
        record.compatibility.installable &&
        record.resources.skills.length === 0 &&
        record.resources.prompts.length === 0 &&
        record.resources.agents.length === 0 &&
        record.resources.mcpServers.length === 0
      );
    No `resources.hooks.length === 0` check. The recorded state above
    satisfies the predicate -> returns true -> list.ts:255 emits
    `(disabled)`.
  conclusion: |
    Mechanically confirms the misclassification: predicate returns true
    for a hooks-only installed record because hooks is not in its axis set.

- timestamp: 2026-06-16T23:55:00Z
  observation: |
    Drift twins:
    - orchestrators/plugin/update.ts:958-968 carries the same predicate body
      (IN-04 from 63-REVIEW.md noted the duplication).
    - orchestrators/plugin/enable-disable.ts:175-191 (isCurrentlyDisabled)
      pinned to plan.ts by tests/orchestrators/reconcile/plan.test.ts:713
      via the T5 drift gate's textual axis assertions.
  conclusion: |
    Fix must extend all three predicates atomically, plus the drift gate
    test's requiredAxes array, plus the truth-table fixture matrix.

- timestamp: 2026-06-16T23:55:00Z
  observation: |
    Test coverage gaps:
    - tests/orchestrators/plugin/list.test.ts:1083 (HOOK-01) exercises an
      `available` (not-installed) hooks-plugin. No test exercises an
      installed hooks-only plugin through the list renderer.
    - tests/orchestrators/reconcile/plan.test.ts:671 (T5 truth-table) and
      :713 (T5 drift gate) pin the 4-axis set textually; gate passes
      against three consistently-wrong predicates.
  conclusion: |
    The fix must include a new list-renderer regression test to prevent
    future regressions in the same direction.

- timestamp: 2026-06-17T01:30:00Z
  observation: |
    Fix applied as four atomic commits on features/v1.13-hook-bridge:
      dbad53f fix(63): add resources.hooks axis to recorded-but-disabled predicates
      3639048 fix(63): zero resources.hooks in disable + partial-cascade fold
      d43b480 test(63): cover hooks axis in drift gate, truth table, and list
      b563ca7 test(63): regression test for disable zeroing resources.hooks

    Test sweep after the fix:
      typecheck: green (tsc --noEmit)
      lint:      green (eslint .)
      format:    green (prettier --check)
      unit:      2282 passing + 1 skipped (was 2280 passing + 1 skipped pre-fix)
                 -- the 2 additional passing tests are the new hooks-only
                 list regression and the new disable-hooks-zero regression.
      integration: 10 passing
  conclusion: |
    Local verification complete. Runtime UAT re-verification (the pi-uat
    sandbox probe in 63-UAT.md test 8) requires the user's interactive Pi
    REPL session and is the operator's responsibility.

- timestamp: 2026-06-17T00:00:00Z
  observation: |
    Independent verification (session-manager second pass) confirmed all
    seven cited sites. Findings beyond the original Evidence section:

    (1) enable-disable.ts: the `isCurrentlyDisabled` structural TYPE LITERAL
        (lines 175-183) also omits the `hooks` field, so the fix is both a
        body edit (add `installed.resources.hooks.length === 0` to the
        conjunction) AND a type-signature edit (add
        `hooks: readonly string[]` to the resources literal).

    (2) plan.ts: the comment ABOVE `isRecordedButDisabled` (lines 269-273)
        explicitly states "the disable orchestrator empties all four
        arrays" -- a doc lie introduced by phase 63 that must be updated
        when the predicate body grows to five axes.

    (3) WRITE-SIDE COMPANION REGRESSION (latent, not yet user-visible but
        same v1.13 root cause):

        enable-disable.ts:292-295 (runDisableBranch) resets:
          installed.resources.skills = []
          installed.resources.prompts = []
          installed.resources.agents = []
          installed.resources.mcpServers = []
        but does NOT reset installed.resources.hooks. The cascade primitive
        DOES physically unstage hooks (cascadeUnstagePlugin at
        marketplace/shared.ts:376-377 calls removeHookConfig), but the
        in-memory record's hooks array is never zeroed. Consequence: after
        a hooks-only disable, state.json carries `resources.hooks:
        ["plugin-name"]` indefinitely -- the predicate (once fixed) will
        misclassify a disabled hooks-only plugin as INSTALLED on the next
        list call. Same v1.13 root cause, symmetric failure direction.

    (4) WRITE-SIDE COMPANION REGRESSION:

        orchestrators/plugin/shared.ts:687-710 (applyPartialCascadeFold)
        accepts a `dropped` argument that lacks a `hooks` axis and only
        filters skills/prompts/agents/mcpServers. The cascade primitive
        DOES surface `dropped.hooks` (shared.ts:332, 377, 392), but the
        partial-cascade fold consumes only four axes, so a disable/uninstall
        partial-cascade failure leaves the in-memory hooks array stale.
        Same root cause; same symmetric direction.
  conclusion: |
    The diagnosis as stated in Current Focus is precise and correct for the
    USER-VISIBLE symptom. But the actual v1.13 root cause -- "phase 63 added
    `resources.hooks` to the state schema but did NOT extend the per-resource
    axis enumerations elsewhere in the orchestrator graph" -- has TWO MORE
    latent twins (runDisableBranch reset + applyPartialCascadeFold) that
    will surface as the next bug if we ship only the three predicate edits.

    Recommended expanded scope:
      A. Three predicate sites (plan.ts, update.ts, enable-disable.ts) --
         add `resources.hooks.length === 0` axis. (in session file already)
      B. enable-disable.ts type literal (isCurrentlyDisabled parameter shape)
         -- add `hooks: readonly string[]`. (newly identified)
      C. plan.ts comment (lines 269-273) -- update "all four arrays" to
         "all five arrays". (newly identified)
      D. runDisableBranch -- add `installed.resources.hooks = []` next to
         the other four resets. (newly identified, latent companion bug)
      E. applyPartialCascadeFold -- add `hooks` to the structural type +
         add the filter line. (newly identified, latent companion bug)
      F. T5 drift-gate requiredAxes array -- add
         `"resources.hooks.length === 0"`. (in session file already)
      G. T5 truth-table fixtures -- extend recordWith / cases to include
         a hooks-populated axis. (in session file already)
      H. New list-renderer regression test for installed-hooks-only plugin.
         (in session file already)
      I. (optional) New plugin/enable-disable.test.ts or related regression
         test asserting that a disabled hooks-only record actually has an
         empty hooks array after runDisableBranch (covers companion bug D).
         Justified: would have caught D before runtime.

    Items D/E are write-side. Items B/C are doc/type quality. Items A/F/G/H
    are the reported fix scope. The user opted into find_and_fix from
    /gsd-debug rather than `--diagnose`, but the expansion to D+E doubles
    the blast radius and changes the test taxonomy -- worth asking the user
    to confirm or scope down before applying.

## Eliminated

(none — the diagnosis was pinned before this session opened. No alternate
hypotheses to eliminate; this is a known-root-cause repair, not an
investigation.)

## Resolution

root_cause: |
  Phase 63's hook-bridge work added `resources.hooks` to the state schema
  (COMPONENT_KINDS 5-tuple) but did NOT extend the four-axis
  empty-resources predicate that the read side uses to classify rows as
  recorded-but-disabled. Three drift-twin copies of the predicate
  (plan.ts::isRecordedButDisabled, update.ts::isRecordedButDisabled,
  enable-disable.ts::isCurrentlyDisabled) all return true for a hooks-only
  installed record, so list.ts:255 routes the row to the `(disabled)` arm.

  Two latent companion regressions surfaced during the diagnosis pass
  with the same v1.13 root cause -- "phase 63 added `resources.hooks` to
  the state schema but did NOT extend the per-resource axis enumerations
  elsewhere in the orchestrator graph": (1) `runDisableBranch` reset
  only four axes instead of five, (2) `applyPartialCascadeFold` consumed
  a four-axis `dropped` argument and only filtered four axes. Both leave
  a stale `resources.hooks` entry after the cascade primitive has
  physically unstaged the hook config from disk.

fix: |
  Broad scope (A+B+C+D+E+F+G+H+I) applied as four atomic commits on
  features/v1.13-hook-bridge:

    dbad53f fix(63): add resources.hooks axis to recorded-but-disabled predicates
            -- A: predicate body edits to plan.ts / update.ts / enable-disable.ts.
            -- B: enable-disable.ts isCurrentlyDisabled type literal carries
                  `hooks: readonly string[]`.
            -- C: plan.ts JSDoc updated ("all four arrays" -> "all five arrays").

    3639048 fix(63): zero resources.hooks in disable + partial-cascade fold
            -- D: runDisableBranch zeroes installed.resources.hooks alongside
                  the other four axes.
            -- E: applyPartialCascadeFold accepts dropped.hooks and filters
                  installed.resources.hooks.

    d43b480 test(63): cover hooks axis in drift gate, truth table, and list
            -- F: T5 drift-gate requiredAxes array includes
                  `resources.hooks.length === 0`.
            -- G: T5 truth-table expanded to a 3-axis matrix with a
                  hooksPopulated dimension; the (installable: true,
                  populated: false, hooksPopulated: true) cell pins the
                  hooks-only installed plugin.
            -- H: new list-renderer regression test asserting that a
                  hooks-only installed plugin renders `(installed)`, not
                  `(disabled)`.

    b563ca7 test(63): regression test for disable zeroing resources.hooks
            -- I: new enable-disable.test.ts test seeds a hooks-only enabled
                  record (resources.hooks populated, every other axis empty),
                  runs setPluginEnabled enable=false, and asserts that the
                  saved state.json carries resources.hooks = [] alongside the
                  other four emptied axes.

verification: |
  Local sweep:
    npm run check -> green
    - typecheck:    ok (tsc --noEmit)
    - lint:         ok (eslint .)
    - format:       ok (prettier --check)
    - unit tests:   2282 passing + 1 skipped (up from 2280 + 1 -- the 2
                    additions are the H + I regression tests)
    - integration:  10 passing

  Runtime UAT re-verification (the pi-uat sandbox probe in 63-UAT.md
  test 8) is deferred to the user. Instructions are in the gap-closure
  note on 63-UAT.md (rerun /claude:plugin install learning-output-style
  + /claude:plugin list + /reload + /claude:plugin list against the
  pi-uat sandbox; the row must render `(installed)` both before and
  after /reload).

files_changed:
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts"
  - "tests/orchestrators/reconcile/plan.test.ts"
  - "tests/orchestrators/plugin/list.test.ts"
  - "tests/orchestrators/plugin/enable-disable.test.ts"
