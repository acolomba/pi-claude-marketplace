---
workstream: notification-refactor
milestone: Notification Refactor
created: 2026-06-24
---

# Roadmap: Notification Refactor

**Milestone goal:** Restructure the notification subsystem so commands own outcome
intent and `notify()` becomes a dumb reducer. Severity and reload-need become
caller-stamped (not inferred from status/reasons), user-visible output becomes
desired-state / outcome-oriented, and the surface becomes open-closed — adding a
command touches its own vertical slice plus ≤3 central files, zero `notify.ts` edits.

**Through-line:** caller owns intent (severity, reload-need, status, reasons, cause);
renderer owns presentation + environment (soft-dep probe, formatting, reduction).

**Coverage:** 27 requirements (SEV ×5, RLD ×5, OUT ×8, MOD ×6, GATE ×3) → 4 phases, 100% mapped.

## Sequencing rationale

The coupling audit (`research/MESSAGING-COUPLING.md`) fixes the order:

1. **The exhaustiveness anchors must exist before correctness relocates.** Part C.2:
   message shapes must stay nominal types pinned via `satisfies`, and per-status
   render dispatch must be a total `Record<Status, RenderFn>` mapped type — otherwise
   a missing render arm becomes a runtime `undefined` instead of a `TS2741` compile
   error. So the registry/type-model scaffold lands first (Phase 1), output-neutral.
2. **The spine then relocates correctness to producers** (Phase 2): rows gain
   caller-stamped `severity` + `needsReload`, `notify()` becomes max-severity /
   OR-needsReload / tally; the content-derived ladders (`BENIGN_REASONS`/`allBenign`/
   `cascadeSeverity`, `shouldEmitReloadHint` token mapping, `present` status,
   `disable-cascade` kind) are deleted. GATE-01 (architecture test that every producer
   stamps both fields) lands with the spine so the relocation is gated.
3. **The summary surface redesign + atomic catalog supersession** (Phase 3): the
   leading severity sentence, trailing tally, header invariants. Per the atomic-
   supersession lesson, the code change, `docs/output-catalog.md`, and the
   `catalog-uat` byte fixtures land together — the UAT is never red between phases.
4. **Concern extraction + the ≤3-files proof** (Phase 4): hooks-summary and soft-dep
   injection move to concern-modules; `notify.ts` slims to the envelope + reducer +
   shared vocabulary; the open-closed target is measured against the audit baseline.

`npm run check` (GATE-03) and the `catalog-uat` byte runner (GATE-02) stay green at
every phase boundary. The catalog generation seam is out of scope (MOD-06 floor accepted).

## Phases

- [ ] **Phase 1: Localized type model & registry spine** - Per-command grammar contributions union into the type model with compile-time exhaustiveness anchors; rows gain `severity`/`needsReload`/structural-cardinality shape (output-neutral).
- [ ] **Phase 2: Caller-stamped severity & reload reducer** - `notify()` becomes a dumb reducer; every producer stamps `severity` + `needsReload`; content-derived ladders deleted; relocation gated by an architecture test.
- [ ] **Phase 3: Desired-state output & atomic catalog supersession** - Leading severity sentence, trailing tally, header invariants; catalog markdown + byte fixtures rewritten in lockstep.
- [ ] **Phase 4: Concern-module extraction & open-closed proof** - Hooks-summary and soft-dep injection extracted; `notify.ts` slims to envelope + reducer + vocabulary; ≤3-central-files / 0-notify-edits target proven and green.

## Phase Details

### Phase 1: Localized type model & registry spine
**Goal**: Each command declares its grammar contribution co-located with its vertical slice, a central registry unions them into the type model, and the row type model gains caller-intent fields and structural cardinality — all with zero rendered-output change.
**Depends on**: Nothing (first phase)
**Requirements**: MOD-01, MOD-02, MOD-03, OUT-07
**Success Criteria** (what must be TRUE):
  1. Each command's status token(s), owned reasons, operation label, and render arm are declared in its own module, not hand-appended to central tuples in `notify.ts`.
  2. A central registry unions the per-command contributions; dropping a contribution out of lockstep (value tuple vs. nominal message type) is a compile error via `satisfies`, replacing the bidirectional `notify-types.test.ts` proofs.
  3. Omitting a per-status render arm is a `TS2741` compile error via a total `Record<Status, RenderFn>` mapped type (the exhaustiveness anchor replacing the hand-maintained `switch` + `assertNever`).
  4. The row type model expresses cascade cardinality (single marketplace/plugin vs. plural) structurally — render-time row counting no longer determines cardinality.
  5. `npm run check` and `catalog-uat` are green with byte-identical rendered output (this phase is output-neutral; the reducer spine arrives in Phase 2).
**Plans**: TBD

### Phase 2: Caller-stamped severity & reload reducer
**Goal**: Correctness relocates from one audited reducer to the producers — every outcome row carries caller-stamped `severity` and `needsReload`, `notify()` reduces them with no content inference, and an architecture test gates the relocation.
**Depends on**: Phase 1
**Requirements**: SEV-01, SEV-02, SEV-03, SEV-04, SEV-05, RLD-01, RLD-02, RLD-03, RLD-04, RLD-05, GATE-01
**Success Criteria** (what must be TRUE):
  1. Every outcome row (plugin- and marketplace-level) carries a caller-stamped `severity` (`info|warning|error`, absent defaults to `info`) and a caller-stamped `needsReload` boolean; `notify()` emits severity as the numeric max over rows and the `/reload to pick up changes` trailer iff the OR-reduce of `needsReload` is true — with no reason/status inference.
  2. `BENIGN_REASONS`, `allBenign`, the `cascadeSeverity` content ladder, and the `shouldEmitReloadHint` status-token→reload mapping are removed; severity no longer reads `reasons` and reload is no longer inferred from status tokens.
  3. Two commands can stamp different severity for an identical `(status, reasons)` pair from their own desired-vs-actual judgment (e.g. `install` of an already-installed plugin → `error`; `update` of an up-to-date plugin → `info`), and the tri-state desired-state contract (info=at-desired, warning=fell-short, error=could-not-carry-out) holds.
  4. The `present` plugin status collapses into `installed` (reload suppression now via `needsReload: false`) and the `disable-cascade` cascade kind is removed (disable stamps `needsReload: true`, list/info stamp `false`).
  5. An architecture test asserts every cascade-producing orchestrator stamps both `severity` and `needsReload` on its state-change rows (no silent reliance on defaults for transitions); `npm run check` and `catalog-uat` stay green.
**Plans**: TBD

### Phase 3: Desired-state output & atomic catalog supersession
**Goal**: User-visible summaries become desired-state / outcome-oriented — a leading severity sentence, a trailing per-operation tally, and always-rendered marketplace headers — with the catalog markdown and byte fixtures superseded atomically so the UAT is never red.
**Depends on**: Phase 2
**Requirements**: OUT-01, OUT-02, OUT-03, OUT-04, OUT-05, OUT-06, OUT-08, GATE-02
**Success Criteria** (what must be TRUE):
  1. Severity reaches the user via `ctx.ui.notify(msg, "warning"|"error")` retaining the host `Error:`/`Warning:` label (info omits the second arg), and a leading severity sentence keyed to the max severity (`[A|Some] <subject> operation[s] has/have failed | needs/need attention.`) prevents the host label from gluing onto a detail row.
  2. Bulk operations carry a trailing tally line (`<Operation>: <n> failure(s), <n> warning(s), <n> success(es)` — pluralized by count, zero-count categories omitted, no terminal period) using the command's human notification name; single-target operations omit the tally but still show the leading severity sentence for error/warning.
  3. The marketplace header is always rendered — a plugin row never appears without its marketplace header.
  4. Mixed-subject cascades (load-time `reconcile`, `import`) drop the subject noun in the leading sentence and use the operation name in the tally, counting all rows uniformly.
  5. `docs/output-catalog.md` and the `catalog-uat` byte fixtures are rewritten in lockstep with the code change (atomic supersession); per-row grammar is preserved except the `present`→`installed` collapse, the `reasons` set stays closed, and `catalog-uat` is green — never left red between phases.
**Plans**: TBD

### Phase 4: Concern-module extraction & open-closed proof
**Goal**: Cross-cutting concerns leave the monolith, `notify.ts` slims to the envelope + reducer spine + shared vocabulary, and the open-closed target (≤3 central files, 0 `notify.ts` edits per new command) is measured and proven green.
**Depends on**: Phase 3
**Requirements**: MOD-04, MOD-05, MOD-06, GATE-03
**Success Criteria** (what must be TRUE):
  1. The hooks summary (`appendHooksBlock`) and soft-dep marker injection (`composeReasons` soft-dep branch + `DEPENDENCIES` + the host probe) are extracted into concern-modules that contribute to the central composer; `shared/notify.ts` slims to the envelope, the reducer spine, and the shared presentation vocabulary (`ICON_*`, scope/version/reason composers).
  2. Adding a command touches ≤3 central files (router registration, `register.ts` wiring, one catalog section) and zero `notify.ts` edits, demonstrably down from the 5 (no new grammar) / 9–11 (new grammar) audit baseline.
  3. The catalog floor is documented as the deliberate milestone boundary — one central catalog section per new rendered state, no generation/aggregation seam (deferred).
  4. `npm run check` (typecheck + ESLint + Prettier + tests) is green and `catalog-uat` byte-equality holds at the milestone close.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Localized type model & registry spine | 0/? | Not started | - |
| 2. Caller-stamped severity & reload reducer | 0/? | Not started | - |
| 3. Desired-state output & atomic catalog supersession | 0/? | Not started | - |
| 4. Concern-module extraction & open-closed proof | 0/? | Not started | - |
