# Phase 98: Lifecycle regression and contract documentation - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning

<domain>
## Phase Boundary

The v1.18 read behavior and the disabled-state repair ship without mutation,
persistence, network, or public-contract regressions. Deliverables: LIFE-04/05/06
characterization coverage (uninstall after manifest-entry removal across all five
resource kinds; targeted, marketplace-bulk, and global-bulk update skip; marketplace
autoupdate skip), the COMPAT-01 no-expansion contract gate, DOC-08 documentation
reconciliation (output catalog + PRD + the named defects), and — by operator
decision at this discuss — the four Phase-97 review-loop code carriers
(IN-07, WR-06, WR-02, WR-04).

</domain>

<decisions>
## Implementation Decisions

### Review-carrier disposition (operator: fold ALL FOUR into Phase 98 as code changes)
- **D-98-01:** IN-07 lands: thread `orphanRewake` through `InstallPluginOutcome`
  so the reconcile cascade renders `{orphan rewake}` for a fresh install exactly as
  it now does for a re-enable. Mirror the WR-07 `EnableDegradationSignals` shape —
  the carrier todo raises whether the signals interface should become a shared
  shape both outcomes inherit; prefer that if it makes the asymmetry class a
  compile error without a layering violation.
- **D-98-02:** WR-06 lands: fresh-enable rows stop hard-coding `dependencies: []`;
  thread the staged agent/MCP counts from `installCtx` (`stagedAgentNames` /
  `stagedMcpServerNames`) through both enable arms so `{requires pi-subagents}` /
  `{requires pi-mcp}` render and the SEV-01 info→warning raise applies on
  re-enable as it does on install.
- **D-98-03:** WR-02 lands: a failed enable whose persisted gate is stale gains a
  remediation affordance pointing at `update --partial`. Use the existing hint /
  cause-trailer mechanism (as install does for `--partial`); if a new rendered
  form results, it is a catalog amendment with byte pins in the same commit.
- **D-98-04:** WR-04 lands: `update --partial` completion must offer the disabled
  records it is the only remedy for. The classifier-contract direction (distinct
  `disabled` classification consumed by the completion path vs making the
  short-circuit reachable without `--partial`) is Claude's discretion at plan
  time — research both, pick the one that keeps `classifyPluginState`'s existing
  consumers byte-stable, and record the choice as a decision in the plan.
  — **Reversibility:** costly — the classifier's outcome set is pinned by
  `tests/orchestrators/edge-deps.test.ts` and consumed by the completion provider;
  changing direction later re-touches both.
- **D-98-05:** Sequencing — the four carriers land BEFORE the COMPAT-01 gate is
  authored, so the enumeration pins capture the post-carrier closed sets. WR-06 and
  IN-07 thread existing reason tokens; WR-02 rides the existing trailer mechanism;
  none of the four may mint a new status token, reason token, or glyph — if one
  appears to need it, that is a blocker to surface, not a silent addition.

### DOC-08 reconciliation depth
- **D-98-06:** Named defects + falsified prose. Fix every named defect (PRD PL-6
  row; PRD §5.3.1 flowchart; catalog brace-bearing-variant count; missing
  `(partially-installed)` status-token reference row; `notify-reasons.ts` 37→38
  header; `orchestrators/reconcile/README.md:34` two-axis-marker prose; D-96-01
  fold-divergence documentation; stale `shared/notify.ts` ~2171-2193 +
  `edge/handlers/tools.ts` RLD-04/D-08 comments; catalog ~line 411 on-disk
  materialization claim). While inside each touched section, also correct any
  statement v1.18 falsified (manifest-absent rows, disabled-partial parity,
  enable-partial rows). No restructuring beyond that — bounded accuracy sweep,
  not a rewrite.
- **D-98-07:** The PRD §5.3.1 flowchart is REDRAWN to the current decision path
  (manifest load → lookup → `ManifestLookup` discriminant → row form), not
  patched in place and not dropped.

### COMPAT-01 gate shape
- **D-98-08:** Closed sets (status tokens, reason tokens, glyphs) are pinned by
  ENUMERATION EQUALITY: the architecture test holds the full literal member list
  and asserts set equality against the source constants, so any add/remove/rename
  fails and forces a deliberate amendment. No count-only pins, no snapshot file.
- **D-98-09:** One new architecture test file in `tests/architecture/` citing
  COMPAT-01 holds all structural clauses together (no manifest-snapshot field, no
  orphan field, no state-schema migration/version bump, no new network path,
  closed-set equality). It DELEGATES to the existing no-orchestrator-network gate
  rather than duplicating it. — **Reversibility:** reversible.
- **D-98-10:** Any source-scanning assertion reads files directly with Node fs —
  NEVER shells out to `grep` — because `orchestrators/plugin/info.ts` contains a
  literal NUL byte and `grep` silently classifies it binary and skips it (the one
  file this milestone changed most).

### LIFE coverage shape
- **D-98-11:** Coverage extends the EXISTING per-orchestrator suites
  (uninstall coverage in `tests/orchestrators/plugin/uninstall.test.ts`,
  update-skip in `tests/orchestrators/plugin/update.test.ts`, autoupdate-skip in
  the marketplace autoupdate suite), factories extended in place per house
  convention. No new consolidated lifecycle suite file.
- **D-98-12:** LIFE-04 uninstall coverage is PER-KIND: five separate cases, one
  resource kind each (skills, commands, agents, hooks, MCP), each seeding a
  manifest-absent installed record, uninstalling, and asserting that kind's
  artifact is gone on disk (including the mcp.json entry and staged hooks copy
  for those kinds) plus the installation record removed. Operator chose per-kind
  isolation over a single composite fixture.
- **D-98-13:** LIFE-05 spans all three enumeration paths explicitly — targeted,
  marketplace-bulk, global-bulk — each asserting the `(skipped) {not in manifest}`
  byte form; LIFE-06 covers the autoupdate-on-marketplace-update path explicitly
  (the skip originates in the shared update preflight and is re-narrowed by the
  cascade mapper).

### Claude's Discretion
- COMPAT-01 clause internals (how the no-migration and no-new-field assertions
  read the schema/source), plan/wave structure, commit granularity, and the
  WR-04 direction choice per D-98-04.
- LIFE fixture details within the chosen suites (reuse of existing seed factories
  vs local extensions), and whether autoupdate coverage lives beside the existing
  autoupdate tests or the marketplace update suite — whichever file owns that
  path today.

### Folded Todos
- `2026-08-08-notify-stale-comments-doc08-reconciliation.md` — stale
  `notify.ts`/`tools.ts` comments + catalog line ~411; core DOC-08 scope (D-98-06).
- `2026-08-09-install-arm-orphan-rewake-asymmetry.md` — IN-07 (D-98-01).
- `2026-08-09-enable-row-suppresses-soft-dep-markers.md` — WR-06 (D-98-02).
- `2026-08-09-enable-partial-remediation-affordance.md` — WR-02 (D-98-03).
- `2026-08-09-update-partial-completion-excludes-disabled-records.md` — WR-04
  (D-98-04).
- Phase 97 `deferred-items.md` §1 — `orchestrators/reconcile/README.md:34`
  two-axis-marker prose; DOC-08 scope (D-98-06).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and contract
- `.planning/REQUIREMENTS.md` §Lifecycle / §Compatibility / §Documentation —
  LIFE-04/05/06, COMPAT-01, DOC-08 full statements (incl. the NUL-byte grep
  caveat and the four named documentation defects).
- `.planning/ROADMAP.md` §Phase 98 — success criteria 1-4.

### Documentation targets
- `docs/output-catalog.md` — the byte-level rendering authority; brace-variant
  count, status-token reference table, line ~411 claim, and any new
  carrier-driven states are amended here.
- `docs/prd/pi-claude-marketplace-prd.md` — PL-6 row + §5.3.1 flowchart (redraw
  per D-98-07); list/info sections get the falsified-prose sweep.
- `orchestrators/reconcile/README.md` line 34 — stale two-axis-marker prose.
- `.planning/phases/97-disabled-state-classification-repair/deferred-items.md`
  — the accumulated DOC-08 prose inventory from Phase 97.

### Carrier sources (mechanism + why-deferred detail)
- `.planning/todos/pending/2026-08-09-install-arm-orphan-rewake-asymmetry.md`
- `.planning/todos/pending/2026-08-09-enable-row-suppresses-soft-dep-markers.md`
- `.planning/todos/pending/2026-08-09-enable-partial-remediation-affordance.md`
- `.planning/todos/pending/2026-08-09-update-partial-completion-excludes-disabled-records.md`
- `.planning/todos/pending/2026-08-08-notify-stale-comments-doc08-reconciliation.md`
- `.planning/phases/97-disabled-state-classification-repair/97-REVIEW.md` +
  `97-REVIEW-FIX.md` — finding statements and fix-loop dispositions the carriers
  cite.

### Prior-phase contracts this phase must not break
- `.planning/phases/97-disabled-state-classification-repair/97-VERIFICATION.md`
  — the verified ENBL-05..09 behavior.
- `tests/architecture/catalog-uat.test.ts` — the byte-equality catalog gate.
- `tests/architecture/no-orchestrator-network.test.ts` — the existing network
  gate COMPAT-01 delegates to (D-98-09).
- `tests/orchestrators/edge-deps.test.ts` — pins the classifier outcome set
  WR-04 touches (D-98-04).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EnableDegradationSignals` (`orchestrators/plugin/enable-disable.ts`, exported;
  intersected into both enable outcome arms) — the shape IN-07's install-arm
  threading should mirror or share (D-98-01).
- `runInstallLedger`'s `installCtx` (`stagedAgentNames` / `stagedMcpServerNames`)
  — already carries what WR-06 needs; `install.ts` shows the consuming pattern.
- `narrowUnsupportedKinds` / `malformedReasonsForKinds` — shared reason
  composition seams used by install and (post-97) enable rows.
- Existing per-suite seed factories (`seedRealDisabledMarketplace`,
  `makePluginRecord` variants, hermetic-HOME helpers) — extend in place per
  D-98-11.

### Established Patterns
- Closed-set catalog discipline: every rendered form lives in
  `docs/output-catalog.md` under byte-equality tests; amendments ship in the same
  commit as the behavior change.
- Notify is a dumb renderer: orchestrators stamp status/severity/reasons;
  severity model info=desired-reached / warning=short / error=not-carried-out;
  SEV-03 parity ruling (clean partial shortfall = info) and WARN-01
  (malformed-frontmatter degrade = warning) are settled — do not revisit.
- Comment policy: durable requirement/decision IDs only; bare backtick
  `unsupported` reserved (write `unsupported` array/kind).
- Architecture gates live in `tests/architecture/` and read source directly.

### Integration Points
- `InstallPluginOutcome` (`orchestrators/plugin/install.ts` ~1856-1865) →
  `reconcile/apply.ts` → `reconcile/notify.ts::installedRowFromOutcome` — the
  IN-07 threading path.
- `narrowEnableFailure` + the enable failure row — WR-02's hint attachment point.
- `classifyPluginState` (`orchestrators/plugin/plugin-state-classifier.ts`) +
  completion provider — WR-04's surface.
- Shared update preflight → cascade mapper — where LIFE-05/06's skip originates.

</code_context>

<specifics>
## Specific Ideas

- The COMPAT-01 test file is the single audit surface for the milestone's
  no-expansion promise — a reviewer should be able to read that one file and know
  the whole contract (operator preference from gate-home selection).
- Uninstall per-kind cases exist to isolate which resource kind regresses when
  one does (operator chose isolation over fixture economy).

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- `2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md`
  — broad rare-failure-arm sweep predating this milestone; stays backlog.
- `2026-08-09-disabled-record-stale-resolvedsource-on-unchanged-version.md`
  — deliberately routed to backlog during the Phase 97 fix loop (no
  `resolves_phase`); a mutation-path fix outside this phase's contract scope.

</deferred>

---

*Phase: 98-lifecycle-regression-and-contract-documentation*
*Context gathered: 2026-08-09*
