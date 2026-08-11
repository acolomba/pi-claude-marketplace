---
status: resolved
trigger: "v1.18 roadmap validation: INV-04 review surfaced that `isRecordedButDisabled` conjoins `compatibility.installable` with `!enabled`, while a partial install always persists `installable: false`"
created: 2026-08-07T00:00:00Z
updated: 2026-08-11T00:00:00Z
---

## Current Focus

RESOLVED 2026-08-11. The fix landed as ENBL-05 through ENBL-09, and the live
reproduction this session listed as its blind spot has now been run.

The repair continued the v1.12 enable/disable family because the defect is a
live violation of ENBL-04 — "declared / enabled / available are orthogonal
facts" — that the partial-install feature introduced. The four predicate copies
collapsed into one definition keyed only on `enabled`, and the five affected
surfaces were restored. See the Resolution section for what shipped.

reasoning_checkpoint:
  hypothesis: "Disabling a partially-installed plugin produces an on-disk record (enabled: false + compatibility.installable: false) that no surface recognizes as disabled, because every disabled-detection predicate also requires installable === true"
  confirming_evidence:
    - "Four independent copies of the predicate all conjoin the two axes: plugin-state-classifier.ts:130, enable-disable.ts:183, reconcile/plan.ts:275, plugin/update.ts:1353"
    - "A partial install always persists installable: false — install.ts:1151 writes `installable: c.resolved.state === 'installable'`, and resolver.ts:1416 returns the partially-available arm whenever unsupported is non-empty; reinstall.ts:1673 mirrors it"
    - "The state is reachable: the disable path has no installable gate. enable-disable.ts:476 evaluates isCurrentlyDisabled(installed) === !enable; for a partial record being disabled that is false === true, so it falls through to the disable branch and writes toDisabledRecord"
    - "installable === true is equivalent to unsupported.length === 0 across every write path, so installable: true with a non-empty unsupported set is unreachable — the two conditions are mutually exclusive by construction, which is what makes the guard silently wrong rather than merely redundant"
  falsification_test: "Finding any writer that persists installable: true alongside a non-empty unsupported set, or an installable gate on the disable path, would have shown the guard is load-bearing. Neither exists."
  fix_rationale: "Drop the compatibility.installable conjunct from all four copies. enabled: false is already written only by the disable orchestrator, and the schema migration fills enabled: true for legacy records, so the guard no longer protects what its comment claims it protects."
  blind_spots: "No live-Pi reproduction was run; the finding is source-level plus test-fixture analysis. A live run would confirm the enable no-op and the reconcile re-plan loop end to end."
  candidate_causes:
    - "predicate conjoins two axes that became mutually exclusive after partial installs landed — CONFIRMED"
    - "toDisabledRecord losing signal by zeroing resources — ELIMINATED as causal (see Eliminated)"
  and_gate: "no — single root cause. The conjunct alone fully explains all five surface behaviors; no second simultaneous condition is required."

## Symptoms

expected: "Disabling a partially-installed plugin behaves like disabling any other plugin: `list` shows `(disabled)`, `enable` re-materializes it, `disable` is idempotent on a second call, reconcile reaches steady state, and `update` leaves it alone."

actual: "None of that holds for a record with `enabled: false` and `compatibility.installable: false`. The record is invisible to every disabled-detection path, so each surface treats it as an ordinary enabled partial install."

errors: "None surfaced. Every affected path takes a silently wrong branch rather than failing, which is why this has gone unnoticed."

reproduction: "Install a plugin that declares an unsupported component kind so it resolves `partially-available`, force-install it partially, then run `/claude:plugin disable <plugin>@<marketplace>`. Inspect state.json: the record carries `enabled: false`, `compatibility.installable: false`, non-empty `compatibility.unsupported`, and zeroed `resources.*`. Then run `list`, `enable`, and `disable` again."

started: "Latent since the force-install milestone introduced partial installs; surfaced 2026-08-07 during v1.18 roadmap validation."

## Eliminated

- hypothesis: "`toDisabledRecord` zeroing the resources arrays is what breaks classification"
  evidence: "state-io.ts:117-127 zeroes all five `resources.*` arrays but preserves `compatibility` verbatim. Since the explicit `enabled` boolean replaced the old empty-resources heuristic, neither `isRecordedButDisabled` nor `classifyInstalledRecord` reads `resources` at all. The zeroing is not causal — but note that the preserved `compatibility.unsupported` is precisely the field that then steers the record into the partial arm, so zeroing removes the only signal that might have compensated."
  timestamp: 2026-08-07

- hypothesis: "This is a rendering bug confined to `list`"
  evidence: "The same predicate is copied into the reconcile planner, the update preflight, and the enable/disable idempotency gate. `list` is the most visible symptom, not the boundary."
  timestamp: 2026-08-07

## Evidence

- timestamp: 2026-08-07
  checked: "The four predicate copies"
  found: |
    plugin-state-classifier.ts:130 — if (record.compatibility.installable && !record.enabled)
    enable-disable.ts:183 — return installed.compatibility.installable && !installed.enabled;  (isCurrentlyDisabled)
    reconcile/plan.ts:275 — return record.compatibility.installable && !record.enabled;  (isRecordedButDisabled)
    plugin/update.ts:1353 — same body, third copy of the expression
  implication: "A single conceptual predicate is duplicated four times, so a fix must touch all four or the surfaces will disagree with each other."

- timestamp: 2026-08-07
  checked: "The doc comment justifying the guard, reconcile/plan.ts:20 and :269"
  found: "It argues the `installable === true` conjunct is safe because a soft-degraded plugin has `enabled: true` — 'it was never explicitly disabled; the disable orchestrator is the only writer of `enabled: false`'."
  implication: "The premise is false. The disable orchestrator will happily disable a partial plugin (enable-disable.ts:476 has no `installable` gate), so the excluded shape is producible. The comment documents an invariant the code does not enforce."

- timestamp: 2026-08-07
  checked: "What `installable` is set to for a partial install"
  found: "install.ts:1151 `installable: c.resolved.state === \"installable\"`; resolver.ts:1416 returns `partiallyAvailable(...)` whenever `partial.unsupported.length > 0`; reinstall.ts:1673 mirrors the same expression."
  implication: "`installable: true` and a non-empty `unsupported` set can never coexist. The guard therefore excludes exactly the partial-disabled shape and nothing else."

- timestamp: 2026-08-07
  checked: "Downstream fallout across surfaces"
  found: |
    list.ts:367 — isRecordedButDisabled(record) is false, so the (disabled) row is skipped and the record falls through to the partial arm, rendering (partially-installed) identically to an enabled one. The user sees no indication it is disabled.
    enable-disable.ts:476 — for enable, isCurrentlyDisabled is false and !enable is false, so the call reports idempotent "already enabled" and never re-materializes. Resources stay zeroed permanently.
    enable-disable.ts:476 — for disable, the same line always falls through, so disable is never idempotent and re-runs the cascade unstage every time.
    reconcile/plan.ts — a config declaring enabled: false re-plans a disable on every pass, the forever-loop the surrounding comment was written to prevent.
    update.ts:1353 — the disabled-record short-circuit does not fire, so a full update re-stages artifacts for a plugin the user disabled.
  implication: "Five surfaces, one root cause. The user-visible worst case is that enable becomes a permanent no-op — the plugin cannot be turned back on through the normal path."

- timestamp: 2026-08-07
  checked: "Test coverage for the combination"
  found: "No test exercises `enabled: false` together with a non-empty `unsupported`. Every disabled fixture pins `installable: true` with an empty `unsupported`. The only cell that touches the shape is a truth-table entry at tests/orchestrators/reconcile/plan.test.ts:724, which pins the current behavior as intended and whose helper always sets `unsupported: []`, so it never reaches the render path."
  implication: "The defect is unguarded, and a fix must also update that truth-table cell and the textual drift-guard that asserts the predicate body references both axes."

## Resolution

root_cause: |
The disabled-detection predicate `compatibility.installable && !enabled` is
duplicated across four files. It was written when `installable: false` implied
soft-degradation, a state the disable orchestrator was assumed never to produce.
The force-install feature broke that assumption: a partial install persists
`installable: false` with a non-empty `unsupported` set, and the disable path
has no `installable` gate, so disabling a partially-installed plugin writes a
record whose two fields make it invisible to every consumer of the predicate.
Because `installable: true` is now equivalent to `unsupported` being empty, the
conjunct excludes exactly one shape — the partial-disabled record — and nothing
else. Five surfaces then take a silently wrong branch: list renders it as an
ordinary partial install, enable reports "already enabled" and never
re-materializes it, disable is never idempotent, reconcile re-plans a disable
forever, and update re-stages artifacts for a plugin the user disabled.

fix: "Applied as ENBL-05 through ENBL-09. The four copies were not merely stripped of the conjunct but collapsed into ONE definition — `isRecordedButDisabled`, exported from persistence/state-io.ts and keyed only on `enabled` — with the three predicate twins and one inline conjunction deleted; six modules now read the single definition. The guard was confirmed not load-bearing: `enabled: false` is written only by the disable orchestrator, and the schema migration backfills `enabled: true` for legacy records. The truth-table cell at tests/orchestrators/reconcile/plan.test.ts that had pinned the wrong behavior as intended was corrected rather than left green, and the textual drift-guard was INVERTED from 'the twin has the right body' to 'no twin survives', later widened to catch the destructured, bracket-access and Boolean()-coercion spellings. The false premise in the reconcile/plan.ts comment was corrected. All five surfaces were restored: list and info rendering, enable and disable idempotency, reconcile steady state, and the update short-circuit."

verification: |
  Three independent levels, all green.
  Source: line references re-verified 2026-08-07; the single definition and its
  six consumers re-verified at the v1.18 integration audit 2026-08-11.
  Test: coverage added for the disabled-plus-partial shape across list, enable,
  disable, reconcile and update, including the CR-01 repro (a manifest-absent
  disabled partial renders the disabled cascade) and an enabled soft-degraded
  counter-case that proves the assertions discriminate.
  Live: the blind spot this session recorded — "No live-Pi reproduction was run;
  a live run would confirm the enable no-op and the reconcile re-plan loop end to
  end" — is CLOSED. tests/live-uat/manifest-absence-canary.mjs Flow B installs a
  genuine partial through the extension's own ledger (compatibility.installable
  false, asserted on the real record), disables it, and observes both list and
  info render `(disabled)`, with a second disable returning
  `(skipped) {already disabled}`. Run 2026-08-11 against pi 0.84.0: B0-B3 all
  pass.

files_changed:
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin-state-classifier.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - tests/orchestrators/reconcile/plan.test.ts
