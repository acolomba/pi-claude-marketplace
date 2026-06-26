# Phase 3: Desired-state output & atomic catalog supersession - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

User-visible summaries become **desired-state / outcome-oriented**:

1. A **leading severity sentence** (OUT-02) keyed to max severity.
2. A **trailing per-operation tally** (OUT-03/04) on bulk operations.
3. **Always-rendered marketplace headers** (OUT-05).
4. Severity reaches the user via `ctx.ui.notify(msg, "warning"|"error")` retaining
   the host `Error:`/`Warning:` label; info omits the 2nd arg (OUT-01).
5. **Mixed-subject cascades** (load-time reconcile, import) drop the subject noun
   and use the operation name in the tally (OUT-06).
6. The **Phase-2-deferred divergent severities** land here (full desired-state
   revisit — see D-01 map).

All of the above is shipped with **atomic catalog supersession** (OUT-08 / GATE-02):
`docs/output-catalog.md` and the `catalog-uat` byte fixtures are rewritten **in
lockstep with the code change**, so `catalog-uat` is **never red between commits**
(the atomic-supersession discipline — code + catalog + fixtures in the same task).

**Builds on:** Phase 1 (`CommandContext.Messaging.label` is the tally operation
label; structural tuple-vs-array cardinality), Phase 2 (caller-stamped severity is
now live; the reducer is dumb). This phase is the one that **changes rendered
bytes** — the prior two were output-neutral / output-preserving.

</domain>

<decisions>
## Implementation Decisions

### D-01: Full desired-state severity map (the deferred SEV-05 divergence)
The user chose a **full desired-state revisit** (not install-only). Apply the
tri-state contract (`info`=end-state-at-desired, `warning`=carried-out-but-fell-
short, `error`=could-not-carry-out) to every idempotent / absent-target case:

**Idempotent "already in the desired state" → `info`** (ensure-state met):
- `update` up-to-date *(locked anchor)*
- `enable` already-enabled
- `disable` already-disabled
- `autoupdate` already-autoupdate / `noautoupdate` already-no-autoupdate
- `bootstrap` already-bootstrapped
- `marketplace update` up-to-date

**Create-style "already exists" → `error`**:
- `install` already-installed *(locked anchor — CHANGE from today's benign info)*
- `marketplace add` duplicate-name *(keep — already error today)*

**Absent-target "can't operate" → `error` across the board** (the user named a
target not in the state the command needs):
- `uninstall` of a not-installed plugin *(CHANGE from today's warning / PU-5
  silent-converge — the already-gone case now reports `error`, not silence)*
- `reinstall` of a not-installed plugin *(CHANGE from today's warning)*
- `update` of a target-not-installed plugin *(CHANGE from today's warning)*
- `marketplace remove` of a not-added marketplace *(keep — already error)*
- the marketplace-not-added preconditions on install/uninstall/update/reinstall
  *(keep — already error)*

**Unchanged:** genuine success transitions → `info`; `failed` → `error`;
`manual recovery` → `warning`.

> **Implementation note:** the producer stamps these per Phase 2's caller-stamped
> model (the orchestrator's own desired-vs-actual judgment at the emit site). The
> deleted `BENIGN_REASONS`/content ladder does not return — each idempotent reason
> (`up-to-date`, `already enabled`, …) is stamped `info` by its producer; each
> absent-target case is stamped `error` by its producer. The `reasons` set stays
> CLOSED (OUT-08) — these are severity changes on existing reason rows, not new
> reasons. The PU-5 silent-converge path must now emit an `error` row (a behavior
> change captured in the catalog supersession).

### D-02: Leading severity sentence (OUT-02)
Exact format per OUT-02: `[A|Some] <subject> operation[s] has/have failed |
needs/need attention.` — `subject` = `plugin`|`marketplace`; `A`=1 row, `Some`>1;
verb = `has/have failed` for error, `needs/need attention` for warning; terminal
period kept. Emitted on error/warning only (info has no leading sentence). It
prevents the host `Error:`/`Warning:` label from gluing onto a detail row.

### D-03: Mixed-subject detection — RENDER-TIME (user's explicit choice)
**Mixed-subject is detected at RENDER TIME** from the actual rows' subjects (NOT a
structural type discriminant). When a cascade's rows span both plugin and
marketplace subjects (load-time `reconcile`, `import`), the leading sentence drops
the subject noun (`[A|Some] operation[s] …`) and the tally uses the operation name,
counting all rows uniformly (OUT-06).

> Note: this intentionally diverges from Phase 1's "structural, not render-time"
> philosophy for cardinality — the user chose render-time detection for the
> subject-homogeneity question specifically. (Cardinality itself stays structural,
> per D-04.)

### D-04: Tally trigger — bound to structural cardinality (OUT-03/04)
The trailing tally appears **iff the operation is plural** — bound to Phase 1's
structural tuple-vs-array cardinality (OUT-07): a single-target operation is the
`[Row]` 1-tuple → **omits** the tally (the row already embeds the outcome) but
still shows the leading severity sentence for error/warning; a plural operation is
the `Row[]` array → **emits** the tally. No separate render-time row-count
heuristic.

Tally format (OUT-03): `<Operation>: <n> failure(s), <n> warning(s), <n>
success(es)` — pluralized by count, zero-count categories omitted, no terminal
period. `<Operation>` is the command's human notification name from
`CommandContext.Messaging.label` (OUT-04), e.g. `Plugin install`, `Marketplace add`.

### D-05: Marketplace header always rendered (OUT-05)
A plugin row never appears without its marketplace header — the header is
unconditionally rendered above its plugin rows.

### D-06: Atomic catalog supersession (OUT-08 / GATE-02)
`docs/output-catalog.md` and the `catalog-uat` byte fixtures are rewritten **in the
same task/commit** as the code change that alters output — `catalog-uat` is never
left red between commits. Per-row grammar (icons, status tokens, reasons) is
preserved EXCEPT the `present`→`installed` catalog grammar collapse (the runtime
collapse landed in Phase 2; the catalog grammar collapse lands here). The `reasons`
set stays CLOSED. No generation/aggregation seam (MOD-06 floor — that's Phase 4
scope to document, but the catalog stays hand-authored).

### Claude's Discretion
- The exact mechanism for the render-time mixed-subject detection (D-03) and how the
  leading-sentence + tally read it.
- How each producer site stamps the D-01 severities (the emit-site desired-vs-actual
  judgment) and how the PU-5 silent-converge path is converted to an `error` row.
- Catalog supersession sequencing within the phase (which states rewrite in which
  task) — provided `catalog-uat` is green at every commit boundary.
- Exact wording of any catalog prose; the byte-compared fenced blocks are the
  contract.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/workstreams/notification-refactor/REQUIREMENTS.md` — OUT-01..06,
  OUT-08, GATE-02, and SEV-05 (the divergence capability now exercised).
- `.planning/workstreams/notification-refactor/ROADMAP.md` §"Phase 3" — success
  criteria 1–5.

### Prior phases (read for the model this builds on)
- `.../phases/02-caller-stamped-severity-reload-reducer/02-CONTEXT.md` — D-02
  deferred the divergent severities to THIS phase; the caller-stamped model + dumb
  reducer this builds on; the severity-reproduction map (D-03 there) that this phase
  now intentionally diverges from for the D-01 cases.
- `.../phases/01-localized-type-model-command-context-spine/01-CONTEXT.md` —
  `CommandContext.Messaging.label` (the tally operation label), structural
  tuple-vs-array cardinality (the tally trigger, D-04).

### The user contract being superseded (read before touching output)
- `docs/output-catalog.md` — the hand-authored byte contract: per-command H2
  sections + the status-token reference table. The leading sentence / tally /
  always-header invariants and the D-01 severity changes rewrite the relevant
  fenced blocks IN LOCKSTEP.
- `tests/architecture/catalog-uat.test.ts` — the `FIXTURES` map + byte-equality
  runner (GATE-02). Fixtures rewritten in lockstep; never left red.
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` — the closed reason
  groups (`IDEMPOTENT_REASONS`, `UNSUPPORTED_REASONS`, `FAILURE_REASONS`); the D-01
  map is severity changes on EXISTING reasons, set stays closed.

### Code (the summary surface being redesigned)
- `extensions/pi-claude-marketplace/shared/notify.ts` — `buildSummaryLine`,
  `buildSummaryLineForCascade`, `operationPhrase`, the tally count helpers, the
  `computeSeverity` dumb reducer, `emitWithSummary`, `RELOAD_HINT_TRAILER`. The
  leading sentence + tally are composed here; the host-channel emission (OUT-01) is
  the `ctx.ui.notify(msg, severity)` seam.
- `tests/architecture/notify-producer-wire-coverage.test.ts` (added in Phase 2
  review) — the producer→wire severity/trailer gate; the D-01 severity changes
  update its expectations in lockstep.
- The ~18 producers in `orchestrators/**` — emit-site stamping of the D-01
  severities.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildSummaryLine` / `operationPhrase` (pluralization) already exist — the
  leading sentence + tally extend these rather than replace them.
- `CommandContext.Messaging.label` (Phase 1) is the ready-made tally operation name.
- Structural tuple-vs-array cardinality (Phase 1) is the ready-made single-vs-bulk
  signal for D-04.
- `notify-producer-wire-coverage.test.ts` (Phase 2) already asserts producer→wire
  severity + trailer — extend it for the new D-01 severities.

### Established Patterns
- Atomic supersession (the milestone's stated discipline): code + catalog + fixtures
  in one task; `catalog-uat` green at every boundary.
- Closed `reasons` set; severity is now a stamped fact, so the D-01 changes touch
  stamps + fixtures, not the reason grammar.

### Integration Points
- `ctx.ui.notify(msg, severity)` host channel (OUT-01) — the emission seam; info
  omits the 2nd arg, warning/error pass it (host supplies the label + color).
- Producer emit sites stamp D-01 severities; `notify()` reduces (max) and composes
  the leading sentence + tally; the catalog/fixtures encode the bytes.

</code_context>

<specifics>
## Specific Ideas

- User chose the **full desired-state revisit** over the minimal install-only delta,
  and **error across the board** for absent targets (the named target can't be
  operated on → could-not-carry-out → error), and **info** for ensure-style
  idempotents (only install/marketplace-add are the create-style error exceptions).
- User chose **render-time** mixed-subject detection (explicitly, over the
  structural-discriminant recommendation).
- Tally bound to **structural cardinality** (reuses Phase 1's OUT-07).

</specifics>

<deferred>
## Deferred Ideas

- **Concern-module extraction** (hooks summary, soft-dep injection) and the
  **≤3-central-files / 0-notify.ts-edits open-closed proof** → **Phase 4**
  (MOD-04/05/06, GATE-03).
- **Catalog generation/aggregation seam** → explicitly OUT OF SCOPE (MOD-06 floor;
  the catalog stays hand-authored, one section per rendered state).

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-desired-state-output-atomic-catalog-supersession*
*Context gathered: 2026-06-24*
