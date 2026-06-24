# Phase 2: Caller-stamped severity & reload reducer - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Relocate correctness from one audited central reducer to the ~18 producers:
every outcome row carries a **caller-stamped `severity` and `needsReload`**, and
`notify()` becomes a dumb reducer — **max-severity** over rows, **OR-reduce** of
`needsReload` for the `/reload` trailer, and a tally — with **no content/reason
inference**. The content-derived ladders are deleted. GATE-01 gates the
relocation.

**Builds on Phase 1:** `severity`/`needsReload` already exist as optional
`MessageBase` fields (inert in Phase 1). Each command already owns a
`CommandContext` + command-local statuses/render map, and the command-local
contract is compile-enforced. This phase turns the fields live.

**This phase is OUTPUT-PRESERVING** (see D-01): the caller-stamped values must
reproduce today's exact emission so `catalog-uat` stays byte-identical. The new
*capability* to diverge (SEV-05) is established structurally, but the *exercise*
of divergent desired-state judgments (output changes) is deferred to Phase 3.

**Deleted this phase (the spine being replaced — research Part B.4):**
`BENIGN_REASONS`, `allBenign`, `cascadeSeverity`, `reconcileAppliedSeverity`, the
content-derivation in `computeSeverity`, and the `shouldEmitReloadHint`
status-token→reload mapping. The `present` plugin status collapses into
`installed` (RLD-04); the `disable-cascade` cascade kind is removed (RLD-05).

</domain>

<decisions>
## Implementation Decisions

### Output scope — reproduce now, diverge in Phase 3
- **D-01:** Phase 2 stamps `severity`/`needsReload` to **reproduce today's exact
  emitted output** — `catalog-uat` stays **byte-identical** through this phase, no
  fixture rewrites. The relocation is mechanism-only.
- **D-02:** The divergent desired-state judgments that *change* output (e.g.
  `install` of an already-installed plugin → `error`; `update` of an up-to-date
  plugin → `info`) are **deferred to Phase 3**, landing atomically with the catalog
  supersession (the phase that owns all output changes + fixture rewrites). SEV-05's
  *capability* is established structurally here; its *exercise* is Phase 3.
- **D-03 (severity reproduction map):** Each producer stamps the severity the
  current content ladder would have computed, so output is unchanged:
  - `failed` (plugin or mp) → `error`
  - `manual recovery` → `warning`
  - `skipped` whose reasons are NOT all-benign → `warning`; `skipped` that is a
    benign idempotent no-op → `info` (the producer knows which — it replaces the
    deleted `BENIGN_REASONS`/`allBenign` content lookup with its own
    desired-vs-actual knowledge at the emit site)
  - all success/inventory rows → `info` (absent severity)
  - `notify()` emits the host `severity` arg as the numeric **max** over rows
    (`info=0 < warning=1 < error=2`), no reason/status inference (SEV-02).

### GATE-01 enforcement — type-level required on transitions
- **D-04:** `severity` and `needsReload` are made **required fields on the
  state-change (transition) message types** — omitting either on a transition row is
  a **compile error** (TS2741-class). This is the primary GATE-01 mechanism and
  matches the Phase 1 "can't be forgotten" bar. Non-transition rows (list/info
  inventory) keep the fields **optional** (absent severity defaults to `info`,
  absent `needsReload` defaults to `false` per SEV-01/RLD-01).
  - Mechanically: the transition message interfaces redeclare the two base fields as
    required (interface narrowing over the optional `MessageBase`).
- **D-05:** A **thin architecture-test backstop** remains for the cases the type
  system can't reach — projected/dynamic rows, notably the reconcile-applied cascade
  where rows are built by a projection (`reconcile/notify.ts`) outside the literal
  message-construction sites. The test asserts every cascade-producing orchestrator
  stamps both fields on its state-change rows. (Refines GATE-01: enforcement is
  primarily type-level, with the architecture test as the dynamic-case backstop —
  not the sole mechanism.)

### needsReload stamping
- **D-06:** **Only successful state transitions** stamp `needsReload: true`:
  `installed`, `uninstalled`, `updated`, `reinstalled`, and the realized
  enable/disable transitions. Everything else stamps `false`: `failed`, `skipped`,
  `manual recovery`, and all list/info inventory rows (`available`, `unavailable`,
  `upgradable`, list-surface `installed`, `disabled`). This reproduces today's
  reload-hint trigger set exactly (D-01).
- **D-07:** `notify()` emits the `/reload to pick up changes` trailer **iff the
  OR-reduce of `needsReload` over all rows is true** (RLD-02), with no status-token
  inference. The `disable` command stamps `needsReload: true` on its realized
  rows directly — which is what lets the `disable-cascade` cascade *kind* be removed
  (RLD-05): list/info `disabled` inventory rows stamp `false`, the disable
  transition stamps `true`, so the kind-based straddle disappears.

### present → installed collapse (RLD-04)
- **D-08:** The `present` plugin status collapses into `installed`. Its only role
  was reload suppression on the list surface, now handled by `needsReload: false` on
  the list-surface `installed` row. The render output for that row must stay
  byte-identical (D-01) — the collapse is a status-token/needsReload change, not a
  rendered-bytes change. (Cross-check: the catalog `present`→`installed` grammar
  collapse is documented as Phase 3 / OUT-08; here the runtime status collapses but
  rendered bytes are preserved.)

### Claude's Discretion
- Exact TypeScript shape for narrowing the two base fields to required on transition
  interfaces (interface extension vs. `Required<>`-style utility vs. a transition
  base type), provided omission on a transition row is a compile error and
  non-transition rows keep them optional.
- The architecture-test mechanism (AST walk vs. runtime introspection of producer
  outputs vs. a typed registry of transition statuses) for the D-05 backstop.
- How each skip-emitting site determines benign-vs-actionable to reproduce today's
  severity (D-03) — the producer's own desired-vs-actual judgment replacing the
  deleted content lookup; the `catalog-uat` byte gate catches any drift.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap (this workstream)
- `.planning/workstreams/notification-refactor/REQUIREMENTS.md` — SEV-01..05,
  RLD-01..05, GATE-01 (Phase 2 set). Note GATE-01 enforcement is refined to
  type-level-primary + test-backstop per D-04/D-05.
- `.planning/workstreams/notification-refactor/ROADMAP.md` §"Phase 2" — success
  criteria 1–5.

### Phase 1 (the model this builds on — read first)
- `.planning/workstreams/notification-refactor/phases/01-localized-type-model-command-context-spine/01-CONTEXT.md`
  — `CommandContext`, command-local statuses/render maps, the optional `MessageBase`
  `severity`/`needsReload`/`dependencies` fields now turned live, the compile-time
  contract bar.

### Coupling audit (the spine being replaced)
- `.planning/workstreams/notification-refactor/research/MESSAGING-COUPLING.md`
  §Part B.4 — the exact severity/summary/reload ladder inventory and locations, with
  STAY/RELOCATE/DELETE classifications. Part D.5 (caller-stamped severity moves
  invariants from one reducer to ~18 producers) and D.6 (`disable-cascade` straddle
  that caller-stamped `needsReload` cleans up).

### Code (the constructs to delete / rewrite)
- `extensions/pi-claude-marketplace/shared/notify.ts`:
  - DELETE: `BENIGN_REASONS` (~:150), `allBenign` (~:166), `cascadeSeverity`
    (~:2198), `reconcileAppliedSeverity`, the content-derivation arms of
    `computeSeverity`, and the `shouldEmitReloadHint` status-token→reload mapping
    (trigger list / `disable-cascade` straddle).
  - REWRITE: `computeSeverity` cascade branch → `max` over `row.severity`;
    reload-hint → OR-reduce over `row.needsReload`; the row-counting helpers
    (`countFailedRows`/`countSkippedRows`) → tally by stamped facts.
  - `MessageBase.severity`/`needsReload` (~:606) — base optional fields; transition
    interfaces narrow them to required (D-04).
  - `RELOAD_HINT_TRAILER` literal (~:2144) STAYS.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` — the
  reconcile-applied cascade projection; the D-05 architecture-test backstop must
  cover its projected rows.
- The ~18 producer call sites across `orchestrators/{plugin,marketplace,import,reconcile}/`
  — each stamps `severity`/`needsReload` at its emit sites (the `*.messaging.ts`
  modules from Phase 1 and their orchestrators).

### Gates
- `tests/architecture/catalog-uat.test.ts` + `docs/output-catalog.md` — GATE-02
  byte-equality; **must stay byte-identical** this phase (D-01).
- `tests/shared/notify-v2.test.ts` — per-status grammar mini-spec; severity/reload
  invariants.
- `tests/shared/notify-inert-fields.test.ts` (added in Phase 1 review fixes) — the
  "inert fields" guard; this phase makes the fields LIVE, so that guard's premise
  changes — update or supersede it rather than letting it block the relocation.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `notify()` reducer spine, `emitWithSummary`, `operationPhrase` pluralization,
  `buildSummaryLine` — STAY; only their *inputs* change from content-matching to
  stamped-fact tallying.
- Phase 1's `notifyWithContext` / `emitContextCascade` + the `MarketplaceRows<Msg>`
  constraint — the typed call path that now also threads stamped severity/needsReload.

### Established Patterns
- First-match severity ladder semantics (today): `failed→error`,
  `manual recovery→warning`, non-benign `skipped→warning`, else `info`. D-03 maps
  these onto per-producer stamps to preserve output.
- Interface narrowing of a base optional field to required (transition types) is a
  standard TS pattern — the planner picks the cleanest shape (D-04 discretion).

### Integration Points
- Every producer emit site stamps the two fields; `notify()` reduces. The
  `catalog-uat` byte gate is the end-to-end correctness check that the stamps
  reproduce today's output (D-01).
- `reconcile/notify.ts` projection feeds `RECONCILE_APPLIED_CONTEXT` — the one place
  the type system can't guarantee stamping, hence the D-05 backstop.

</code_context>

<specifics>
## Specific Ideas

- User confirmed the reducer trailer rule in their own words: *"if any of
  needsReload in a cascade is true, output the message"* — the RLD-02 OR-reduce.
- User reaffirmed the compile-time-contract preference from Phase 1 by choosing
  type-level required fields on transitions for GATE-01.

</specifics>

<deferred>
## Deferred Ideas

- **Divergent desired-state severities** (install-already→error, update-up-to-date→
  info, and any other case where caller judgment differs from today's content
  ladder) → **Phase 3**, landing atomically with the catalog supersession (D-02).
- **Catalog markdown `present`→`installed` grammar collapse + fixture rewrites** →
  **Phase 3 / OUT-08** (this phase preserves rendered bytes).
- **Summary surface redesign** (leading severity sentence, trailing tally, header
  invariants) → **Phase 3**.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-caller-stamped-severity-reload-reducer*
*Context gathered: 2026-06-24*
