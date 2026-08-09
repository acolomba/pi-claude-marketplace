# Phase 97: Disabled-state classification repair - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning

<domain>
## Phase Boundary

A disabled partially-installed plugin is recognized as disabled by every
surface, restoring the orthogonality of declared, enabled, and available that
ENBL-04 asserts. One disabled-state predicate keyed only on `enabled` replaces
the four independently-drifting copies (ENBL-05); `list`/`info` render the
disabled partial as `(disabled)` distinct from an enabled partial and without
`{not in manifest}` when manifest-absent (ENBL-06, composing with INV-04);
`enable` re-materializes and `disable` is idempotent on partials (ENBL-07);
reconcile reaches steady state (ENBL-08); `update` leaves the record alone
(ENBL-09). No state migration or schema-version change — on-disk records in
the unrecognized shape reclassify on next load.

</domain>

<decisions>
## Implementation Decisions

### Requirements are the spec (operator decision at discuss)
- **D-97-01:** The operator reviewed the two surfaced gray areas (disabled-
  partial row reasons; enable on a manifest-absent partial) and ruled that the
  requirements suffice — both go to Claude's discretion anchored on **"keep
  existing semantics"**. No additional constraints beyond ENBL-05..09 and the
  Phase 97 success criteria.

### Claude's Discretion
- **Disabled-partial row reasons:** whether the `(disabled)` row for a partial
  record shows the persisted unsupported-kind reasons or renders bare like the
  canonical disabled row. Anchor: the conservative default is parity with the
  existing canonical `(disabled)` rendering (bare) — a new visible form is a
  deliberate catalog amendment; decide at planning from catalog precedent and
  pin byte-exact either way. INV-04's composition is non-negotiable: never
  `{not in manifest}` on a disabled row.
- **Enable on a manifest-absent disabled partial:** re-materialization needs a
  resolvable manifest entry; when the record is manifest-absent, the expected
  outcome is the EXISTING enable resolve-failure semantics (fail clean, no
  partial materialization) — pin it as a boundary test. Do not invent new
  behavior.
- Where the single predicate lives (`shared/`, `domain/`, or the classifier
  module) and its name, provided every surface consumes the one definition and
  the textual drift-guard is updated to assert the new body.
- Test organization for the ENBL-06..09 behavior suites.

### Folded Todos
- `2026-08-09-disabled-partial-reaches-state-only-info-arm.md`
  (resolves_phase: 97, from 96-REVIEW.md CR-01) — folded: soft-degraded
  (`installable: false`) disabled records bypass `partitionDisabledScopes`
  (predicate keys on `compatibility.installable && !enabled`) and reach Phase
  96's state-only info arm, rendering `(partially-installed) {not in manifest,
  ...}` with an empty resolved component map. The ENBL-05 single-predicate
  collapse (keyed only on `enabled`) fixes that arm; ENBL-06 must widen the
  guard test at `tests/orchestrators/plugin/info-manifest-absent.test.ts`
  (~line 841) that today covers only the `installable: true` half.
  `enable-disable.ts:476` has no installable guard on disable and
  `toDisabledRecord` empties every `resources.*` array — the disabled partial
  with empty resources is a REACHABLE persisted shape the new predicate must
  classify as disabled.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and contracts
- `.planning/REQUIREMENTS.md` §ENBL-05..09 — the five phase requirements; note
  ENBL-05's drift-guard + truth-table-cell update obligations and INV-04's
  canonical-shape carve-out that ENBL-06 widens
- `docs/output-catalog.md` — binding user contract; any disabled-partial
  rendering choice lands here under the byte gate
- `.planning/todos/pending/2026-08-09-disabled-partial-reaches-state-only-info-arm.md`
  — the folded CR-01 carrier with the reachable-shape analysis

### Prior phase state this builds on
- `.planning/phases/95-manifest-independent-installed-inventory/95-CONTEXT.md`
  — D-95 decisions; Phase 95's disabled-row characterization (canonical shape)
- `.planning/phases/96-installation-record-backed-plugin-info/96-CONTEXT.md`
  and `96-REVIEW.md` — the state-only info arm, `partitionDisabledScopes`,
  and the CR-01 finding text
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` —
  disable branch (no installable guard, ~line 476), `toDisabledRecord`,
  `isRecordedButDisabled` (one predicate copy)
- `extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts`
  — classification chokepoint (likely predicate copy site)
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` (`partitionDisabledScopes`)
  and `list.ts` (`isRecordedButDisabled` usage) — the other predicate consumers
- `extensions/pi-claude-marketplace/orchestrators/reconcile/` — ENBL-08's
  steady-state surface
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` — ENBL-09's
  disabled-record short-circuit

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 95/96 test fixture idioms (hermetic HOME, byte-exact join("\n")
  assertions, seedMarketplace helpers) in `list-manifest-absent.test.ts` /
  `info-manifest-absent.test.ts` — copy, don't import.
- The truth-table / drift-guard tests ENBL-05 names (research must locate the
  exact files asserting the predicate body and the defective cell).

### Established Patterns
- Characterize before change: pin the current (defective) partial-disabled
  behavior only as far as needed to prove the repair changes it — the roadmap
  forbids pinning it as CORRECT; write the desired-state tests instead.
- Orchestrator stamps reasons, notify renders; closed-set vocabulary; catalog
  states under the byte gate.
- 5-phase ledger enable path (`runInstallLedger` guard-free body) for ENBL-07
  re-materialization; existing disable idempotency precedent for the canonical
  shape.

### Integration Points
- The predicate collapse touches all four consumer surfaces plus the reconcile
  planner and update short-circuit; no schema change means the classifier must
  handle the empty-resources disabled-partial shape already on disk.

</code_context>

<specifics>
## Specific Ideas

- After the collapse, Phase 96's `partitionDisabledScopes` must partition a
  soft-degraded disabled record OUT of the state-only arm (the CR-01 repro
  becomes the regression test).
- ENBL-08's test shape: two consecutive reconcile passes over a disabled
  partial with a disabling config produce zero planned actions on the second
  pass.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- `2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md`
  — update/reinstall failure-arm coverage; out of scope, stays pending.
- `2026-08-08-notify-stale-comments-doc08-reconciliation.md` — Phase 98 DOC-08
  carrier.

</deferred>

---

*Phase: 97-disabled-state-classification-repair*
*Context gathered: 2026-08-09*
